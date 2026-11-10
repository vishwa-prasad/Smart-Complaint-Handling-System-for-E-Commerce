from pydantic import BaseModel, EmailStr

from typing import Optional, List

from datetime import datetime


class UserCreate(BaseModel):
    name: str

    email: EmailStr

    password: str

    role: Optional[str] = "user"


class UserLogin(BaseModel):
    email: EmailStr

    password: str


class UserOut(BaseModel):
    id: int

    name: str

    email: str

    role: str

    is_active: bool

    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str

    token_type: str

    user: UserOut


class ComplaintCreate(BaseModel):
    complaint_text: str

    channel: Optional[str] = "Web Form"


class ComplaintUpdate(BaseModel):
    status: Optional[str] = None

    priority: Optional[str] = None

    resolution_note: Optional[str] = None

    internal_note: Optional[str] = None

    assigned_to_id: Optional[int] = None


class ComplaintRate(BaseModel):
    rating: int
    comment: Optional[str] = None


class RequestInfoSchema(BaseModel):
    message: str


class ReopenSchema(BaseModel):
    reason: str


class ResolutionNoteCreate(BaseModel):
    note: str
    is_internal: Optional[bool] = False


class ResolutionNoteOut(BaseModel):
    id: int
    complaint_id: str
    author_name: str
    author_role: str
    note: str
    is_internal: bool
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class ComplaintOut(BaseModel):
    id: int

    complaint_id: str

    complaint_text: str

    category: Optional[str]

    priority: str

    status: str

    resolution_note: Optional[str]

    internal_note: Optional[str]

    channel: Optional[str]

    sla_breached: bool

    sla_deadline: Optional[datetime]

    satisfaction_rating: Optional[int]

    satisfaction_comment: Optional[str]

    resolved_at: Optional[datetime]

    reopened_at: Optional[datetime]

    first_response_at: Optional[datetime]

    created_at: Optional[datetime]

    updated_at: Optional[datetime]

    image_path: Optional[str]

    assigned_to_id: Optional[int]

    owner: Optional[UserOut]

    assigned_to: Optional[UserOut]

    class Config:
        from_attributes = True


class ComplaintListOut(BaseModel):
    total: int

    items: List[ComplaintOut]


class CategoryAssignmentOut(BaseModel):
    id: int

    category: str

    assigned_user_id: Optional[int]

    assigned_user: Optional[UserOut]

    class Config:
        from_attributes = True


class CategoryAssignmentSet(BaseModel):
    user_id: Optional[int] = None


# ── Multi-agent assignment schemas ───────────────────────────────────────────
class CategoryAgentMapOut(BaseModel):
    id: int
    category: str
    user_id: int
    agent: Optional[UserOut]

    class Config:
        from_attributes = True


class CategoryAgentsOut(BaseModel):
    """All agents assigned to a single category."""
    category: str
    agents: List[UserOut]


class CategoryAgentsSet(BaseModel):
    """List of user IDs to assign to a category (replaces existing list)."""
    user_ids: List[int]


class AnalyticsSummary(BaseModel):
    total_complaints: int

    open_count: int

    in_progress_count: int

    escalated_count: int

    resolved_count: int

    high_priority: int

    critical_priority: int

    medium_priority: int

    low_priority: int

    sla_breached_count: int

    avg_satisfaction: Optional[float]

    category_breakdown: dict

    recent_complaints: List[ComplaintOut]


class CannedResponseCreate(BaseModel):
    title: str

    body: str

    category: Optional[str] = None


class CannedResponseOut(BaseModel):
    id: int

    title: str

    body: str

    category: Optional[str]

    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class BulkUpdateRequest(BaseModel):
    complaint_ids: List[str]

    status: Optional[str] = None

    priority: Optional[str] = None
