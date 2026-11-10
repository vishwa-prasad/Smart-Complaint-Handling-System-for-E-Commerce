import asyncio
import os
from datetime import datetime, timezone, timedelta
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

# ── Fix: SQLite returns naive datetimes; make FastAPI always emit UTC "Z" suffix
# so the browser converts to local time (IST) correctly.
from fastapi.encoders import jsonable_encoder
import fastapi.encoders as _enc
_orig_encode = _enc.jsonable_encoder

def _patched_encode(obj, *args, **kwargs):
    if isinstance(obj, datetime) and obj.tzinfo is None:
        obj = obj.replace(tzinfo=timezone.utc)
    return _orig_encode(obj, *args, **kwargs)

_enc.jsonable_encoder = _patched_encode

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import engine, Base, SessionLocal
import models
from routers import auth_router, complaints, admin, chat

SLA_DAYS = 3


def check_sla_breaches(db):
    cutoff = datetime.now(timezone.utc) - timedelta(days=SLA_DAYS)

    unresolved = db.query(models.Complaint).filter(
        models.Complaint.status.in_(["Open", "In Progress"]),

        models.Complaint.created_at <= cutoff,

    ).all()

    breached = 0

    escalated = 0

    for c in unresolved:
        if not c.sla_breached:
            c.sla_breached = True
            breached += 1

        # Upgrade priority to High if SLA breached and priority is Medium or Low
        if c.priority in ("Medium", "Low"):
            c.priority = "High"
            c.resolution_note = (c.resolution_note or "") + \
                f"\n[PRIORITY UPGRADED] Priority raised to High due to SLA breach on " \
                f"{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')} UTC."

        # Escalate all Open High-priority complaints (includes just-upgraded ones)
        if c.status == "Open" and c.priority == "High":
            c.status = "Escalated"
            c.resolution_note = (c.resolution_note or "") + \
                f"\n[AUTO-ESCALATED] SLA of {SLA_DAYS} days breached on " \
                f"{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')} UTC."
            escalated += 1

    if breached or escalated:
        db.commit()

        print(f"[SLA Scheduler] {breached} breached, {escalated} auto-escalated.")

    return escalated, breached


async def sla_scheduler():
    while True:
        await asyncio.sleep(3600)

        db = SessionLocal()

        try:
            check_sla_breaches(db)

        except Exception as e:
            print(f"[SLA Scheduler] Error: {e}")

        finally:
            db.close()


@asynccontextmanager


async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)

    print("Database tables created/verified ✓")

    db = SessionLocal()

    try:
        check_sla_breaches(db)

    finally:
        db.close()

    task = asyncio.create_task(sla_scheduler())

    print(f"SLA scheduler started (threshold: {SLA_DAYS} days) ✓")

    yield

    task.cancel()

app = FastAPI(
    title="Smart Complaint Handling System",

    description="E-Commerce complaint management with NLP-powered classification",

    version="2.0.0",

    lifespan=lifespan,

)

app.add_middleware(
    CORSMiddleware,

    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],

)

app.include_router(auth_router.router)

app.include_router(complaints.router)

app.include_router(admin.router)

app.include_router(chat.router)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")

os.makedirs(UPLOAD_DIR, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/", tags=["Health"])


def root():
    return {"message": "Smart Complaint Handling System API v2", "status": "running"}


@app.get("/health", tags=["Health"])


def health():
    return {"status": "ok", "sla_days": SLA_DAYS}
