import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from typing import Optional

from database import get_db
import models, schemas, auth as auth_utils
from ml_service import classify_complaint, get_resolution_advice
from email_service import send_submission_email, send_status_update_email, send_request_info_email, send_agent_message_email

SLA_HOURS = {"High": 24, "Medium": 48, "Low": 72}

router = APIRouter(prefix="/api/complaints", tags=["Complaints"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE_MB   = 5


def _generate_id(db: Session) -> str:
    count = db.query(models.Complaint).count()
    return f"CMP{str(count + 1).zfill(5)}"


def _save_image(file: UploadFile) -> str:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, WEBP or GIF images are allowed.")
    contents = file.file.read()
    if len(contents) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Image must be under {MAX_SIZE_MB}MB.")
    ext      = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
    filename = f"{uuid.uuid4().hex}.{ext}"
    with open(os.path.join(UPLOAD_DIR, filename), "wb") as f:
        f.write(contents)
    return filename


@router.post("/", response_model=schemas.ComplaintOut, status_code=201)
def submit_complaint(
    complaint_text: str = Form(...),
    channel: Optional[str] = Form("Web Form"),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    if not complaint_text.strip():
        raise HTTPException(status_code=400, detail="Complaint text cannot be empty")
    if len(complaint_text.strip()) < 10:
        raise HTTPException(status_code=400, detail="Please describe your complaint in at least 10 characters.")

    category, priority = classify_complaint(complaint_text)
    resolution_note    = get_resolution_advice(category, priority, complaint_text)

    image_path = None
    if image and image.filename:
        image_path = _save_image(image)

    # Pick the agent with the fewest open complaints from the pool (load balancing)
    pool = db.query(models.CategoryAgentMap).filter(
        models.CategoryAgentMap.category == category
    ).all()

    assigned_to_id = None
    if pool:
        def open_count(uid):
            return db.query(models.Complaint).filter(
                models.Complaint.assigned_to_id == uid,
                models.Complaint.status.in_(["Open", "In Progress", "Escalated"]),
            ).count()
        assigned_to_id = min(pool, key=lambda r: open_count(r.user_id)).user_id
    else:
        # Fall back to legacy single-agent assignment
        assignment = db.query(models.CategoryAssignment).filter(
            models.CategoryAssignment.category == category
        ).first()
        assigned_to_id = assignment.assigned_user_id if assignment else None

    sla_deadline = datetime.now(timezone.utc) + timedelta(hours=SLA_HOURS.get(priority, 48))

    complaint = models.Complaint(
        complaint_id=_generate_id(db),
        user_id=current_user.id,
        complaint_text=complaint_text,
        category=category,
        priority=priority,
        status="Open",
        resolution_note=resolution_note,
        channel=channel or "Web Form",
        sla_breached=False,
        sla_deadline=sla_deadline,
        sla_extra_seconds=0,
        image_path=image_path,
        assigned_to_id=assigned_to_id,
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)

    db.add(models.ComplaintStatusHistory(
        complaint_id=complaint.complaint_id,
        status="Open",
        changed_by_name=current_user.name,
        changed_by_role=current_user.role,
        note="Complaint submitted by customer.",
    ))
    db.commit()

    send_submission_email(
        to_email=current_user.email,
        user_name=current_user.name,
        complaint_id=complaint.complaint_id,
        category=complaint.category,
        priority=complaint.priority,
        complaint_text=complaint.complaint_text,
        resolution_note=complaint.resolution_note or "",
    )

    return complaint


@router.get("/my", response_model=schemas.ComplaintListOut)
def get_my_complaints(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    query = db.query(models.Complaint).filter(models.Complaint.user_id == current_user.id)

    if search:
        query = query.filter(models.Complaint.complaint_text.ilike(f"%{search}%"))
    if status:
        query = query.filter(models.Complaint.status == status)
    if date_from:
        try:
            df = datetime.strptime(date_from, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            query = query.filter(models.Complaint.created_at >= df)
        except ValueError:
            pass
    if date_to:
        try:
            dt = datetime.strptime(date_to, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
            query = query.filter(models.Complaint.created_at <= dt)
        except ValueError:
            pass

    total = query.count()
    items = query.order_by(models.Complaint.created_at.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": items}


@router.get("/{complaint_id}", response_model=schemas.ComplaintOut)
def get_complaint(
    complaint_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    c = db.query(models.Complaint).filter(models.Complaint.complaint_id == complaint_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if c.user_id != current_user.id and current_user.role not in ("admin", "employee"):
        raise HTTPException(status_code=403, detail="Access denied")
    return c


@router.get("/{complaint_id}/history")
def get_status_history(
    complaint_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    c = db.query(models.Complaint).filter(models.Complaint.complaint_id == complaint_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if c.user_id != current_user.id and current_user.role not in ("admin", "employee"):
        raise HTTPException(status_code=403, detail="Access denied")

    history = (
        db.query(models.ComplaintStatusHistory)
        .filter(models.ComplaintStatusHistory.complaint_id == complaint_id)
        .order_by(models.ComplaintStatusHistory.created_at.asc())
        .all()
    )
    return [
        {
            "id":              h.id,
            "status":          h.status,
            "changed_by_name": h.changed_by_name,
            "changed_by_role": h.changed_by_role,
            "note":            h.note,
            "created_at":      h.created_at.isoformat() if h.created_at else "",
        }
        for h in history
    ]


@router.post("/{complaint_id}/rate", response_model=schemas.ComplaintOut)
def rate_complaint(
    complaint_id: str,
    data: schemas.ComplaintRate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    if not 1 <= data.rating <= 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    c = db.query(models.Complaint).filter(models.Complaint.complaint_id == complaint_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if c.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only rate your own complaints")
    if c.status not in ("Resolved", "Closed"):
        raise HTTPException(status_code=400, detail="Only resolved complaints can be rated")
    if c.satisfaction_rating is not None:
        raise HTTPException(status_code=400, detail="You have already rated this complaint")
    c.satisfaction_rating = data.rating
    c.satisfaction_comment = data.comment
    db.commit()
    db.refresh(c)
    return c


@router.post("/{complaint_id}/request-info", response_model=schemas.ComplaintOut)
def request_more_info(
    complaint_id: str,
    data: schemas.RequestInfoSchema,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    if current_user.role not in ("admin", "employee"):
        raise HTTPException(status_code=403, detail="Only agents can request more info")
    c = db.query(models.Complaint).filter(models.Complaint.complaint_id == complaint_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if c.status in ("Resolved", "Closed"):
        raise HTTPException(status_code=400, detail="Cannot request info on a resolved complaint")

    now = datetime.now(timezone.utc)
    c.status = "Awaiting Response"
    c.sla_paused_at = now

    db.add(models.ComplaintStatusHistory(
        complaint_id=complaint_id,
        status="Awaiting Response",
        changed_by_name=current_user.name,
        changed_by_role=current_user.role,
        note=f"Agent requested more information: {data.message}",
    ))
    db.add(models.ResolutionNote(
        complaint_id=complaint_id,
        author_id=current_user.id,
        author_name=current_user.name,
        author_role=current_user.role,
        note=f"📋 More information requested: {data.message}",
        is_internal=False,
    ))
    db.commit()
    db.refresh(c)

    owner = db.query(models.User).filter(models.User.id == c.user_id).first()
    if owner:
        try:
            send_request_info_email(
                to_email=owner.email,
                user_name=owner.name,
                complaint_id=complaint_id,
                message=data.message,
            )
        except Exception:
            pass
    return c


@router.post("/{complaint_id}/resume-sla", response_model=schemas.ComplaintOut)
def resume_sla(
    complaint_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    c = db.query(models.Complaint).filter(models.Complaint.complaint_id == complaint_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")

    now = datetime.now(timezone.utc)
    if c.sla_paused_at:
        paused_seconds = int((now - c.sla_paused_at).total_seconds())
        c.sla_extra_seconds = (c.sla_extra_seconds or 0) + paused_seconds
        if c.sla_deadline:
            c.sla_deadline = c.sla_deadline + timedelta(seconds=paused_seconds)
        c.sla_paused_at = None

    if c.status == "Awaiting Response":
        c.status = "In Progress"
        db.add(models.ComplaintStatusHistory(
            complaint_id=complaint_id,
            status="In Progress",
            changed_by_name=current_user.name,
            changed_by_role=current_user.role,
            note="Customer responded. SLA timer resumed.",
        ))
    db.commit()
    db.refresh(c)
    return c


@router.post("/{complaint_id}/reopen", response_model=schemas.ComplaintOut)
def reopen_complaint(
    complaint_id: str,
    data: schemas.ReopenSchema,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    c = db.query(models.Complaint).filter(models.Complaint.complaint_id == complaint_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if c.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only reopen your own complaints")
    if c.status not in ("Resolved", "Closed"):
        raise HTTPException(status_code=400, detail="Only resolved complaints can be reopened")

    if c.resolved_at:
        days_since = (datetime.now(timezone.utc) - c.resolved_at).days
        if days_since > 7:
            raise HTTPException(status_code=400, detail="Complaints can only be reopened within 7 days of resolution")

    now = datetime.now(timezone.utc)
    c.status = "In Progress"
    c.reopened_at = now
    c.sla_deadline = now + timedelta(hours=SLA_HOURS.get(c.priority, 48))
    c.sla_breached = False
    c.sla_paused_at = None

    db.add(models.ComplaintStatusHistory(
        complaint_id=complaint_id,
        status="In Progress",
        changed_by_name=current_user.name,
        changed_by_role=current_user.role,
        note=f"Complaint reopened by customer: {data.reason}",
    ))
    db.commit()
    db.refresh(c)
    return c


@router.get("/{complaint_id}/notes")
def get_resolution_notes(
    complaint_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    c = db.query(models.Complaint).filter(models.Complaint.complaint_id == complaint_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if c.user_id != current_user.id and current_user.role not in ("admin", "employee"):
        raise HTTPException(status_code=403, detail="Access denied")

    query = db.query(models.ResolutionNote).filter(
        models.ResolutionNote.complaint_id == complaint_id
    )
    if current_user.role not in ("admin", "employee"):
        query = query.filter(models.ResolutionNote.is_internal == False)

    notes = query.order_by(models.ResolutionNote.created_at.asc()).all()
    return [
        {
            "id": n.id,
            "complaint_id": n.complaint_id,
            "author_name": n.author_name,
            "author_role": n.author_role,
            "note": n.note,
            "is_internal": n.is_internal,
            "created_at": n.created_at.isoformat() if n.created_at else "",
        }
        for n in notes
    ]


@router.post("/{complaint_id}/notes")
def add_resolution_note(
    complaint_id: str,
    data: schemas.ResolutionNoteCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    c = db.query(models.Complaint).filter(models.Complaint.complaint_id == complaint_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if c.user_id != current_user.id and current_user.role not in ("admin", "employee"):
        raise HTTPException(status_code=403, detail="Access denied")

    if data.is_internal and current_user.role not in ("admin", "employee"):
        raise HTTPException(status_code=403, detail="Only agents can add internal notes")

    note = models.ResolutionNote(
        complaint_id=complaint_id,
        author_id=current_user.id,
        author_name=current_user.name,
        author_role=current_user.role,
        note=data.note,
        is_internal=data.is_internal or False,
    )
    db.add(note)

    if c.status == "Awaiting Response" and current_user.role == "user":
        paused_seconds = 0
        now = datetime.now(timezone.utc)
        if c.sla_paused_at:
            paused_seconds = int((now - c.sla_paused_at).total_seconds())
            c.sla_extra_seconds = (c.sla_extra_seconds or 0) + paused_seconds
            if c.sla_deadline:
                c.sla_deadline = c.sla_deadline + timedelta(seconds=paused_seconds)
            c.sla_paused_at = None
        c.status = "In Progress"
        db.add(models.ComplaintStatusHistory(
            complaint_id=complaint_id,
            status="In Progress",
            changed_by_name=current_user.name,
            changed_by_role=current_user.role,
            note="Customer provided additional information.",
        ))

    if current_user.role in ("admin", "employee") and not c.first_response_at:
        c.first_response_at = datetime.now(timezone.utc)

    db.commit()

    # Email the customer when an agent sends a public (non-internal) message
    if current_user.role in ("admin", "employee") and not (data.is_internal or False):
        owner = db.query(models.User).filter(models.User.id == c.user_id).first()
        if owner:
            try:
                send_agent_message_email(
                    to_email=owner.email,
                    user_name=owner.name,
                    complaint_id=complaint_id,
                    agent_name=current_user.name,
                    message=data.note,
                )
            except Exception:
                pass

    return {"id": note.id, "created_at": note.created_at.isoformat() if note.created_at else ""}
