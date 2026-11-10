from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float

from sqlalchemy.orm import relationship

from sqlalchemy.sql import func

from database import Base

import enum


class UserRole(str, enum.Enum):
    user = "user"

    admin = "admin"

    employee = "employee"


class ComplaintStatus(str, enum.Enum):
    Open = "Open"

    In_Progress = "In Progress"

    Awaiting_Response = "Awaiting Response"

    Escalated = "Escalated"

    Resolved = "Resolved"

    Closed = "Closed"


class ComplaintPriority(str, enum.Enum):
    Low = "Low"

    Medium = "Medium"

    High = "High"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(120), nullable=False)

    email = Column(String(200), unique=True, index=True, nullable=False)

    hashed_password = Column(String(200), nullable=False)

    role = Column(String(20), default="user", nullable=False)

    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    complaints = relationship("Complaint", back_populates="owner", foreign_keys="[Complaint.user_id]")

    assigned_complaints = relationship("Complaint", back_populates="assigned_to", foreign_keys="[Complaint.assigned_to_id]")


class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)

    complaint_id = Column(String(20), unique=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    complaint_text = Column(Text, nullable=False)

    cleaned_text = Column(Text, nullable=True)

    category = Column(String(80), nullable=True)

    priority = Column(String(20), default="Medium")

    status = Column(String(30), default="Open")

    resolution_note = Column(Text, nullable=True)

    internal_note = Column(Text, nullable=True)

    channel = Column(String(40), default="Web Form")

    sla_breached = Column(Boolean, default=False)

    sla_deadline = Column(DateTime(timezone=True), nullable=True)

    sla_paused_at = Column(DateTime(timezone=True), nullable=True)

    sla_extra_seconds = Column(Integer, default=0)

    satisfaction_rating = Column(Integer, nullable=True)

    satisfaction_comment = Column(Text, nullable=True)

    resolved_at = Column(DateTime(timezone=True), nullable=True)

    reopened_at = Column(DateTime(timezone=True), nullable=True)

    first_response_at = Column(DateTime(timezone=True), nullable=True)

    image_path = Column(String(255), nullable=True)

    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship("User", back_populates="complaints", foreign_keys=[user_id])

    assigned_to = relationship("User", back_populates="assigned_complaints", foreign_keys=[assigned_to_id])


class ComplaintStatusHistory(Base):
    __tablename__ = "complaint_status_history"

    id              = Column(Integer, primary_key=True, index=True)

    complaint_id    = Column(String(20), index=True, nullable=False)

    status          = Column(String(30), nullable=False)

    changed_by_name = Column(String(120), nullable=False)

    changed_by_role = Column(String(20), nullable=False)

    note            = Column(Text, nullable=True)

    created_at      = Column(DateTime(timezone=True), server_default=func.now())


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id           = Column(Integer, primary_key=True, index=True)

    complaint_id = Column(String(20), index=True, nullable=False)

    sender_id    = Column(Integer, ForeignKey("users.id"), nullable=False)

    sender_name  = Column(String(120), nullable=False)

    sender_role  = Column(String(20), nullable=False)

    message      = Column(Text, nullable=False)

    image_path   = Column(String(255), nullable=True)

    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    sender = relationship("User")


class CannedResponse(Base):
    __tablename__ = "canned_responses"

    id         = Column(Integer, primary_key=True, index=True)

    title      = Column(String(120), nullable=False)

    body       = Column(Text, nullable=False)

    category   = Column(String(80), nullable=True)

    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CategoryAssignment(Base):
    __tablename__ = "category_assignments"

    id               = Column(Integer, primary_key=True, index=True)

    category         = Column(String(80), unique=True, nullable=False)

    assigned_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    assigned_user = relationship("User")


class CategoryAgentMap(Base):
    """Many-to-many: one category can have multiple agents."""
    __tablename__ = "category_agent_map"

    id       = Column(Integer, primary_key=True, index=True)
    category = Column(String(80), nullable=False, index=True)
    user_id  = Column(Integer, ForeignKey("users.id"), nullable=False)

    agent = relationship("User")


class ResolutionNote(Base):
    __tablename__ = "resolution_notes"

    id           = Column(Integer, primary_key=True, index=True)

    complaint_id = Column(String(20), index=True, nullable=False)

    author_id    = Column(Integer, ForeignKey("users.id"), nullable=False)

    author_name  = Column(String(120), nullable=False)

    author_role  = Column(String(20), nullable=False)

    note         = Column(Text, nullable=False)

    is_internal  = Column(Boolean, default=False)

    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    author = relationship("User")
