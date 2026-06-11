from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.database import get_db
from app.db.models import Prediction, Ticket, AuditLog
from app.schemas.ticket import MetricsResponse
from app.services.rag import index_size
from app.core.security import get_current_user
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["metrics"])


@router.get("/metrics", response_model=MetricsResponse)
def get_metrics(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    total_tickets = db.query(func.count(Ticket.id)).scalar() or 0

    action_counts = (
        db.query(Prediction.action, func.count(Prediction.id))
        .group_by(Prediction.action)
        .all()
    )
    counts = {action: cnt for action, cnt in action_counts}
    auto_resolved = counts.get("AUTO_RESOLVE", 0)
    escalated     = counts.get("ESCALATE", 0)
    suggested     = counts.get("SUGGEST", 0)
    total_preds   = auto_resolved + escalated + suggested

    avg_confidence = db.query(func.avg(Prediction.confidence)).scalar() or 0.0

    def pct(n: int) -> float:
        return round(n / total_preds * 100, 2) if total_preds > 0 else 0.0

    return MetricsResponse(
        total_tickets=total_tickets,
        auto_resolved_count=auto_resolved,
        escalated_count=escalated,
        suggested_count=suggested,
        auto_resolved_pct=pct(auto_resolved),
        escalated_pct=pct(escalated),
        avg_confidence=round(float(avg_confidence), 4),
    )


@router.get("/metrics/detailed", response_model=dict)
def get_detailed_metrics(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Extended metrics: per-priority breakdown, risk distribution, FAISS index size."""
    priority_counts = (
        db.query(Ticket.priority, func.count(Ticket.id))
        .group_by(Ticket.priority)
        .all()
    )
    risk_counts = (
        db.query(Prediction.risk, func.count(Prediction.id))
        .group_by(Prediction.risk)
        .all()
    )
    recent_logs = (
        db.query(AuditLog)
        .order_by(AuditLog.timestamp.desc())
        .limit(5)
        .all()
    )
    return {
        "priority_distribution": {p: c for p, c in priority_counts},
        "risk_distribution":     {r: c for r, c in risk_counts},
        "faiss_index_size":      index_size(),
        "recent_decisions": [
            {
                "ticket_id": l.ticket_id,
                "decision":  l.decision,
                "confidence": l.confidence,
                "timestamp": l.timestamp,
            }
            for l in recent_logs
        ],
    }


@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    """Public health endpoint — no auth required."""
    from sqlalchemy import text
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:
        db_status = "error"
    return {
        "status": "ok",
        "database": db_status,
        "faiss_index_size": index_size(),
    }
