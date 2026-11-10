import csv
import io
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from database import get_db
import models, schemas, auth as auth_utils
from email_service import send_status_email

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("/complaints", response_model=schemas.ComplaintListOut)
def list_all_complaints(
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    category: Optional[str] = None,
    sla_breached: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.require_admin),
):
    query = db.query(models.Complaint)
    if current_user.role == "employee":
        query = query.filter(models.Complaint.assigned_to_id == current_user.id)
    if status:
        query = query.filter(models.Complaint.status == status)
    if priority:
        query = query.filter(models.Complaint.priority == priority)
    if category:
        query = query.filter(models.Complaint.category == category)
    if sla_breached is not None:
        query = query.filter(models.Complaint.sla_breached == sla_breached)
    if search:
        query = query.filter(models.Complaint.complaint_text.contains(search))
    total = query.count()
    items = query.order_by(
        models.Complaint.sla_breached.desc(),
        models.Complaint.created_at.desc()
    ).offset(skip).limit(limit).all()
    return {"total": total, "items": items}


@router.post("/complaints/bulk")
def bulk_update_complaints(
    data: schemas.BulkUpdateRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth_utils.require_admin),
):
    if not data.complaint_ids:
        raise HTTPException(status_code=400, detail="No complaint IDs provided")
    if not data.status and not data.priority:
        raise HTTPException(status_code=400, detail="Provide at least status or priority to update")

    updated = 0
    for cid in data.complaint_ids:
        c = db.query(models.Complaint).filter(models.Complaint.complaint_id == cid).first()
        if not c:
            continue
        old_status = c.status
        if data.status:
            c.status = data.status
            if data.status == "Resolved" and not c.resolved_at:
                c.resolved_at = datetime.now(timezone.utc)
                c.sla_breached = False
            if not c.first_response_at and admin.role in ("admin", "employee"):
                c.first_response_at = datetime.now(timezone.utc)
            if data.status != old_status:
                db.add(models.ComplaintStatusHistory(
                    complaint_id=c.complaint_id,
                    status=data.status,
                    changed_by_name=admin.name,
                    changed_by_role=admin.role,
                    note=f"Bulk update by {admin.name}",
                ))
        if data.priority:
            c.priority = data.priority
        updated += 1

    db.commit()
    return {"updated": updated, "total_requested": len(data.complaint_ids)}


@router.patch("/complaints/{complaint_id}", response_model=schemas.ComplaintOut)
def update_complaint(
    complaint_id: str,
    data: schemas.ComplaintUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth_utils.require_admin),
):
    c = db.query(models.Complaint).filter(models.Complaint.complaint_id == complaint_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")

    old_status = c.status

    if data.status is not None:
        c.status = data.status
        if data.status == "Resolved":
            c.resolved_at = datetime.now(timezone.utc)
            c.sla_breached = False
        if not c.first_response_at:
            c.first_response_at = datetime.now(timezone.utc)
    if data.priority is not None:
        c.priority = data.priority
    if data.resolution_note is not None:
        c.resolution_note = data.resolution_note
    if data.internal_note is not None:
        c.internal_note = data.internal_note
    if data.assigned_to_id is not None:
        agent = db.query(models.User).filter(models.User.id == data.assigned_to_id).first()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        c.assigned_to_id = data.assigned_to_id

    if data.status is not None and data.status != old_status:
        db.add(models.ComplaintStatusHistory(
            complaint_id=c.complaint_id,
            status=data.status,
            changed_by_name=admin.name,
            changed_by_role=admin.role,
            note=data.resolution_note or f"Status updated to {data.status}",
        ))
        if c.owner and c.owner.email:
            send_status_email(
                to_email=c.owner.email,
                user_name=c.owner.name,
                complaint_id=c.complaint_id,
                status=data.status,
                complaint_text=c.complaint_text,
                resolution_note=data.resolution_note or c.resolution_note or "",
                old_status=old_status,
            )

    db.commit()
    db.refresh(c)
    return c


@router.post("/sla/check")
def run_sla_check(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.require_super_admin),
):
    from main import check_sla_breaches
    escalated, breached = check_sla_breaches(db)
    return {"message": f"SLA check done. {breached} breached, {escalated} auto-escalated."}


@router.get("/analytics", response_model=schemas.AnalyticsSummary)
def get_analytics(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.require_admin),
):
    total = db.query(models.Complaint).count()

    def count_by(field, value):
        return db.query(models.Complaint).filter(field == value).count()

    cat_rows = (
        db.query(models.Complaint.category, func.count(models.Complaint.id))
        .group_by(models.Complaint.category)
        .all()
    )
    category_breakdown = {row[0] or "Unknown": row[1] for row in cat_rows}

    avg_row = db.query(func.avg(models.Complaint.satisfaction_rating)).filter(
        models.Complaint.satisfaction_rating.isnot(None)
    ).scalar()
    avg_satisfaction = round(float(avg_row), 2) if avg_row else None

    recent = (
        db.query(models.Complaint)
        .order_by(models.Complaint.created_at.desc())
        .limit(10)
        .all()
    )

    return {
        "total_complaints":   total,
        "open_count":         count_by(models.Complaint.status, "Open"),
        "in_progress_count":  count_by(models.Complaint.status, "In Progress"),
        "escalated_count":    count_by(models.Complaint.status, "Escalated"),
        "resolved_count":     count_by(models.Complaint.status, "Resolved"),
        "critical_priority":  0,
        "high_priority":      count_by(models.Complaint.priority, "High"),
        "medium_priority":    count_by(models.Complaint.priority, "Medium"),
        "low_priority":       count_by(models.Complaint.priority, "Low"),
        "sla_breached_count": count_by(models.Complaint.sla_breached, True),
        "avg_satisfaction":   avg_satisfaction,
        "category_breakdown": category_breakdown,
        "recent_complaints":  recent,
    }


@router.get("/export")
def export_complaints_csv(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.require_admin),
):
    complaints = db.query(models.Complaint).order_by(models.Complaint.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Complaint ID", "User", "Email", "Category", "Priority", "Status",
        "SLA Breached", "Satisfaction Rating", "Channel",
        "Complaint Text", "Resolution Note", "Created At", "Resolved At"
    ])
    for c in complaints:
        writer.writerow([
            c.complaint_id,
            c.owner.name if c.owner else "",
            c.owner.email if c.owner else "",
            c.category or "",
            c.priority,
            c.status,
            "Yes" if c.sla_breached else "No",
            c.satisfaction_rating or "",
            c.channel or "",
            c.complaint_text,
            c.resolution_note or "",
            c.created_at.strftime("%Y-%m-%d %H:%M") if c.created_at else "",
            c.resolved_at.strftime("%Y-%m-%d %H:%M") if c.resolved_at else "",
        ])

    output.seek(0)
    filename = f"complaints_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/users", response_model=List[schemas.UserOut])
def list_users(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.require_super_admin),
):
    return db.query(models.User).offset(skip).limit(limit).all()


@router.patch("/users/{user_id}/toggle", response_model=schemas.UserOut)
def toggle_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth_utils.require_super_admin),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot disable your own account")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}/role", response_model=schemas.UserOut)
def change_role(
    user_id: int,
    role: str = Query(..., pattern="^(user|admin|employee)$"),
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.require_super_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = role
    db.commit()
    db.refresh(user)
    return user



ALL_CATEGORIES = [
    "Account Issue",
    "Payment Issue",
    "Refund Request",
    "Product Issue",
    "Delivery Issue",
    "Customer Service",
]


@router.get("/assignments", response_model=List[schemas.CategoryAssignmentOut])
def list_assignments(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.require_super_admin),
):
    rows = {a.category: a for a in db.query(models.CategoryAssignment).all()}
    result = []
    for cat in ALL_CATEGORIES:
        if cat in rows:
            result.append(rows[cat])
        else:
            result.append(models.CategoryAssignment(id=0, category=cat, assigned_user_id=None))
    return result


@router.put("/assignments/{category}", response_model=schemas.CategoryAssignmentOut)
def set_assignment(
    category: str,
    data: schemas.CategoryAssignmentSet,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.require_super_admin),
):
    if category not in ALL_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Unknown category: {category}")

    if data.user_id is not None:
        agent = db.query(models.User).filter(
            models.User.id == data.user_id,
            models.User.role.in_(["admin", "employee"]),
        ).first()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found (must be admin or employee role)")

    assignment = db.query(models.CategoryAssignment).filter(
        models.CategoryAssignment.category == category
    ).first()

    if assignment:
        assignment.assigned_user_id = data.user_id
    else:
        assignment = models.CategoryAssignment(
            category=category,
            assigned_user_id=data.user_id,
        )
        db.add(assignment)

    db.commit()
    db.refresh(assignment)
    return assignment


# ── Multi-agent assignment endpoints ─────────────────────────────────────────

@router.get("/category-agents", response_model=List[schemas.CategoryAgentsOut])
def list_category_agents(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.require_super_admin),
):
    """Return all agents assigned to each category."""
    rows = db.query(models.CategoryAgentMap).all()
    # Group by category
    grouped: dict = {cat: [] for cat in ALL_CATEGORIES}
    for row in rows:
        if row.category in grouped:
            grouped[row.category].append(row.agent)
    return [{"category": cat, "agents": agents} for cat, agents in grouped.items()]


@router.put("/category-agents/{category}", response_model=schemas.CategoryAgentsOut)
def set_category_agents(
    category: str,
    data: schemas.CategoryAgentsSet,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.require_super_admin),
):
    """Replace the full agent list for a category."""
    if category not in ALL_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Unknown category: {category}")

    # Validate all user IDs
    agents = []
    for uid in data.user_ids:
        agent = db.query(models.User).filter(
            models.User.id == uid,
            models.User.role.in_(["admin", "employee"]),
            models.User.is_active == True,
        ).first()
        if not agent:
            raise HTTPException(status_code=404, detail=f"Agent ID {uid} not found or not an agent")
        agents.append(agent)

    # Delete existing mappings for this category and replace
    db.query(models.CategoryAgentMap).filter(
        models.CategoryAgentMap.category == category
    ).delete()

    for agent in agents:
        db.add(models.CategoryAgentMap(category=category, user_id=agent.id))

    db.commit()
    return {"category": category, "agents": agents}


@router.get("/agents", response_model=List[schemas.UserOut])
def list_agents(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.require_admin),
):
    return db.query(models.User).filter(
        models.User.role.in_(["admin", "employee"]),
        models.User.is_active == True,
    ).all()


@router.get("/workload")
def get_agent_workload(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.require_super_admin),
):
    agents = db.query(models.User).filter(
        models.User.role.in_(["admin", "employee"]),
        models.User.is_active == True,
    ).all()

    result = []
    for agent in agents:
        total = db.query(models.Complaint).filter(
            models.Complaint.assigned_to_id == agent.id
        ).count()
        open_count = db.query(models.Complaint).filter(
            models.Complaint.assigned_to_id == agent.id,
            models.Complaint.status.in_(["Open", "In Progress", "Escalated"]),
        ).count()
        resolved_count = db.query(models.Complaint).filter(
            models.Complaint.assigned_to_id == agent.id,
            models.Complaint.status == "Resolved",
        ).count()
        high_count = db.query(models.Complaint).filter(
            models.Complaint.assigned_to_id == agent.id,
            models.Complaint.priority == "High",
            models.Complaint.status.in_(["Open", "In Progress", "Escalated"]),
        ).count()
        result.append({
            "id":            agent.id,
            "name":          agent.name,
            "email":         agent.email,
            "role":          agent.role,
            "total":         total,
            "open":          open_count,
            "resolved":      resolved_count,
            "high_priority": high_count,
        })

    result.sort(key=lambda x: x["open"], reverse=True)
    return result


@router.get("/canned-responses", response_model=List[schemas.CannedResponseOut])
def list_canned_responses(
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.require_admin),
):
    q = db.query(models.CannedResponse)
    if category:
        q = q.filter(
            (models.CannedResponse.category == category) |
            (models.CannedResponse.category == None)
        )
    return q.order_by(models.CannedResponse.title).all()


@router.post("/canned-responses", response_model=schemas.CannedResponseOut, status_code=201)
def create_canned_response(
    data: schemas.CannedResponseCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth_utils.require_admin),
):
    cr = models.CannedResponse(
        title=data.title,
        body=data.body,
        category=data.category or None,
        created_by=admin.id,
    )
    db.add(cr)
    db.commit()
    db.refresh(cr)
    return cr


@router.put("/canned-responses/{cr_id}", response_model=schemas.CannedResponseOut)
def update_canned_response(
    cr_id: int,
    data: schemas.CannedResponseCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.require_admin),
):
    cr = db.query(models.CannedResponse).filter(models.CannedResponse.id == cr_id).first()
    if not cr:
        raise HTTPException(status_code=404, detail="Canned response not found")
    cr.title = data.title
    cr.body = data.body
    cr.category = data.category or None
    db.commit()
    db.refresh(cr)
    return cr


@router.delete("/canned-responses/{cr_id}", status_code=204)
def delete_canned_response(
    cr_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.require_admin),
):
    cr = db.query(models.CannedResponse).filter(models.CannedResponse.id == cr_id).first()
    if not cr:
        raise HTTPException(status_code=404, detail="Canned response not found")
    db.delete(cr)
    db.commit()


@router.get("/performance")
def get_agent_performance(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.require_super_admin),
):
    agents = db.query(models.User).filter(
        models.User.role.in_(["admin", "employee"]),
        models.User.is_active == True,
    ).all()

    result = []
    for agent in agents:
        complaints = db.query(models.Complaint).filter(
            models.Complaint.assigned_to_id == agent.id
        ).all()

        total    = len(complaints)
        resolved = [c for c in complaints if c.status == "Resolved"]
        open_    = [c for c in complaints if c.status in ("Open", "In Progress", "Escalated")]

        res_times = [
            (c.resolved_at - c.created_at).total_seconds() / 3600
            for c in resolved
            if c.resolved_at and c.created_at
        ]
        avg_resolution_hrs = round(sum(res_times) / len(res_times), 1) if res_times else None

        resp_times = [
            (c.first_response_at - c.created_at).total_seconds() / 3600
            for c in complaints
            if c.first_response_at and c.created_at
        ]
        avg_response_hrs = round(sum(resp_times) / len(resp_times), 1) if resp_times else None

        ratings = [c.satisfaction_rating for c in resolved if c.satisfaction_rating]
        avg_satisfaction = round(sum(ratings) / len(ratings), 2) if ratings else None

        result.append({
            "id":                 agent.id,
            "name":               agent.name,
            "email":              agent.email,
            "role":               agent.role,
            "total":              total,
            "open":               len(open_),
            "resolved":           len(resolved),
            "avg_resolution_hrs": avg_resolution_hrs,
            "avg_response_hrs":   avg_response_hrs,
            "avg_satisfaction":   avg_satisfaction,
            "rated_count":        len(ratings),
        })

    result.sort(key=lambda x: x["resolved"], reverse=True)
    return result
