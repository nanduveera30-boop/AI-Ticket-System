"""
Admin Routes — role:admin only
================================
GET  /admin/users              — list all users
GET  /admin/users/{id}         — get user
PATCH /admin/users/{id}        — update role / active status
DELETE /admin/users/{id}       — deactivate user
GET  /admin/system             — system info (models, FAISS, DB stats)
POST /admin/system/reindex     — rebuild FAISS index from DB
GET  /admin/audit-logs         — full audit log with filters
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from typing import List, Optional

from app.db.database import get_db
from app.db.models import User, Ticket, Prediction, AuditLog
from app.core.security import require_role
from app.services.rag import index_size
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])

admin_only = require_role("admin")


@router.get("/users")
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: dict = Depends(admin_only),
):
    users = db.query(User).offset(skip).limit(limit).all()
    return [
        {
            "id": u.id, "username": u.username, "email": u.email,
            "role": u.role, "is_active": u.is_active,
            "created_at": u.created_at,
        }
        for u in users
    ]


@router.get("/users/{user_id}")
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(admin_only),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user.id, "username": user.username, "email": user.email,
        "role": user.role, "is_active": user.is_active, "created_at": user.created_at,
    }


@router.patch("/users/{user_id}")
def update_user(
    user_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    _: dict = Depends(admin_only),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    allowed = {"role", "is_active"}
    for key, val in payload.items():
        if key in allowed:
            setattr(user, key, val)

    db.commit()
    db.refresh(user)
    logger.info("admin_user_updated", user_id=user_id, changes=payload)
    return {"id": user.id, "username": user.username, "role": user.role, "is_active": user.is_active}


@router.delete("/users/{user_id}")
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(admin_only),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    db.commit()
    logger.info("admin_user_deactivated", user_id=user_id)
    return {"message": f"User {user.username} deactivated"}


@router.get("/system")
def system_info(
    db: Session = Depends(get_db),
    _: dict = Depends(admin_only),
):
    total_tickets     = db.query(func.count(Ticket.id)).scalar() or 0
    total_predictions = db.query(func.count(Prediction.id)).scalar() or 0
    total_users       = db.query(func.count(User.id)).scalar() or 0
    total_logs        = db.query(func.count(AuditLog.id)).scalar() or 0

    action_dist = dict(
        db.query(Prediction.action, func.count(Prediction.id))
        .group_by(Prediction.action).all()
    )
    risk_dist = dict(
        db.query(Prediction.risk, func.count(Prediction.id))
        .group_by(Prediction.risk).all()
    )
    priority_dist = dict(
        db.query(Ticket.priority, func.count(Ticket.id))
        .group_by(Ticket.priority).all()
    )
    avg_conf = db.query(func.avg(Prediction.confidence)).scalar() or 0.0

    return {
        "database": {
            "total_tickets":     total_tickets,
            "total_predictions": total_predictions,
            "total_users":       total_users,
            "total_audit_logs":  total_logs,
        },
        "ai": {
            "faiss_index_size":  index_size(),
            "avg_confidence":    round(float(avg_conf), 4),
            "action_distribution": action_dist,
            "risk_distribution":   risk_dist,
            "priority_distribution": priority_dist,
        },
    }


@router.post("/system/reindex")
def reindex(
    db: Session = Depends(get_db),
    _: dict = Depends(admin_only),
):
    """Rebuild FAISS index from all tickets in DB."""
    from app.services.rag import load_index, add_to_index, _index, _metadata
    from app.services.embeddings import generate_embedding
    import app.services.rag as rag_module

    # Reset index
    import faiss
    rag_module._index = faiss.IndexFlatIP(384)
    rag_module._metadata = []

    tickets = db.query(Ticket).all()
    for t in tickets:
        emb = generate_embedding(f"{t.title}. {t.description}")
        add_to_index(t.id, t.title, t.description, emb)

    logger.info("admin_reindex_complete", total=len(tickets))
    return {"message": f"Reindexed {len(tickets)} tickets", "index_size": index_size()}


@router.get("/audit-logs")
def admin_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    decision: Optional[str] = Query(None),
    actor: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: dict = Depends(admin_only),
):
    q = db.query(AuditLog)
    if decision:
        q = q.filter(AuditLog.decision == decision)
    if actor:
        q = q.filter(AuditLog.actor == actor)
    logs = q.order_by(AuditLog.timestamp.desc()).offset(skip).limit(limit).all()
    return [
        {
            "id": l.id, "ticket_id": l.ticket_id,
            "input_text": l.input_text[:120],
            "confidence": l.confidence, "risk": l.risk,
            "decision": l.decision, "actor": l.actor,
            "timestamp": l.timestamp,
        }
        for l in logs
    ]
