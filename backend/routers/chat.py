import os
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session

from database import get_db, SessionLocal
import models
import auth as auth_utils

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE_MB   = 5

router = APIRouter(tags=["Chat"])


class ConnectionManager:
    def __init__(self):
        self.rooms: Dict[str, List[WebSocket]] = {}

    async def connect(self, complaint_id: str, ws: WebSocket):
        await ws.accept()
        self.rooms.setdefault(complaint_id, []).append(ws)

    def disconnect(self, complaint_id: str, ws: WebSocket):
        if complaint_id in self.rooms:
            self.rooms[complaint_id].remove(ws)
            if not self.rooms[complaint_id]:
                del self.rooms[complaint_id]

    async def broadcast(self, complaint_id: str, payload: dict):
        for ws in self.rooms.get(complaint_id, []):
            try:
                await ws.send_json(payload)
            except Exception:
                pass

    def online_count(self, complaint_id: str) -> int:
        return len(self.rooms.get(complaint_id, []))

manager = ConnectionManager()


def _get_user_from_token(token: str, db: Session) -> models.User:
    try:
        payload = auth_utils.decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("bad token")
        user = db.query(models.User).filter(models.User.id == int(user_id)).first()
        if not user or not user.is_active:
            raise ValueError("user not found")
        return user
    except Exception:
        return None


@router.websocket("/ws/chat/{complaint_id}")
async def websocket_chat(
    websocket: WebSocket,
    complaint_id: str,
    token: str = Query(...),
):
    db = SessionLocal()
    try:
        user = _get_user_from_token(token, db)
        if not user:
            await websocket.close(code=4001)
            return

        complaint = db.query(models.Complaint).filter(
            models.Complaint.complaint_id == complaint_id
        ).first()
        if not complaint:
            await websocket.close(code=4004)
            return
        if complaint.user_id != user.id and user.role not in ("admin", "employee"):
            await websocket.close(code=4003)
            return

        await manager.connect(complaint_id, websocket)

        await manager.broadcast(complaint_id, {
            "type":   "system",
            "text":   f"{user.name} joined the chat",
            "online": manager.online_count(complaint_id),
        })

        try:
            while True:
                data = await websocket.receive_text()
                text = data.strip()
                if not text:
                    continue

                msg = models.ChatMessage(
                    complaint_id=complaint_id,
                    sender_id=user.id,
                    sender_name=user.name,
                    sender_role=user.role,
                    message=text,
                )
                db.add(msg)

                if user.role in ("admin", "employee") and not complaint.first_response_at:
                    complaint.first_response_at = datetime.now(timezone.utc)

                db.commit()
                db.refresh(msg)

                await manager.broadcast(complaint_id, {
                    "type":         "message",
                    "id":           msg.id,
                    "complaint_id": complaint_id,
                    "sender_id":    user.id,
                    "sender_name":  user.name,
                    "sender_role":  user.role,
                    "text":         text,
                    "image_path":   None,
                    "created_at":   msg.created_at.isoformat() if msg.created_at else "",
                })

        except WebSocketDisconnect:
            manager.disconnect(complaint_id, websocket)
            await manager.broadcast(complaint_id, {
                "type":   "system",
                "text":   f"{user.name} left the chat",
                "online": manager.online_count(complaint_id),
            })
    finally:
        db.close()


@router.get("/api/chat/{complaint_id}/messages")
def get_chat_history(
    complaint_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    complaint = db.query(models.Complaint).filter(
        models.Complaint.complaint_id == complaint_id
    ).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if complaint.user_id != current_user.id and current_user.role not in ("admin", "employee"):
        raise HTTPException(status_code=403, detail="Access denied")

    messages = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.complaint_id == complaint_id)
        .order_by(models.ChatMessage.created_at.asc())
        .all()
    )
    return [
        {
            "id":          m.id,
            "sender_id":   m.sender_id,
            "sender_name": m.sender_name,
            "sender_role": m.sender_role,
            "text":        m.message,
            "image_path":  m.image_path,
            "created_at":  m.created_at.isoformat() if m.created_at else "",
        }
        for m in messages
    ]


@router.post("/api/chat/{complaint_id}/upload")
async def upload_chat_image(
    complaint_id: str,
    image: UploadFile = File(...),
    message: Optional[str] = Form(""),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    complaint = db.query(models.Complaint).filter(
        models.Complaint.complaint_id == complaint_id
    ).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if complaint.user_id != current_user.id and current_user.role not in ("admin", "employee"):
        raise HTTPException(status_code=403, detail="Access denied")

    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, WEBP or GIF allowed.")
    contents = await image.read()
    if len(contents) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Image must be under {MAX_SIZE_MB}MB.")
    ext      = image.filename.rsplit(".", 1)[-1] if "." in image.filename else "jpg"
    filename = f"{uuid.uuid4().hex}.{ext}"
    with open(os.path.join(UPLOAD_DIR, filename), "wb") as f:
        f.write(contents)

    msg = models.ChatMessage(
        complaint_id=complaint_id,
        sender_id=current_user.id,
        sender_name=current_user.name,
        sender_role=current_user.role,
        message=message or "📎 Image",
        image_path=filename,
    )
    db.add(msg)

    if current_user.role in ("admin", "employee") and not complaint.first_response_at:
        complaint.first_response_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(msg)

    await manager.broadcast(complaint_id, {
        "type":         "message",
        "id":           msg.id,
        "complaint_id": complaint_id,
        "sender_id":    current_user.id,
        "sender_name":  current_user.name,
        "sender_role":  current_user.role,
        "text":         msg.message,
        "image_path":   filename,
        "created_at":   msg.created_at.isoformat() if msg.created_at else "",
    })

    return {"id": msg.id, "image_path": filename, "created_at": msg.created_at.isoformat() if msg.created_at else ""}
