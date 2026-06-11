from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.database import get_db
from app.db.models import Prediction, Ticket
from app.schemas.ticket import MetricsResponse
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["metrics"])


@router.get("/metrics", response_model=MetricsResponse)
def get_metrics(db: Session = Depends(get_db)):
    """Aggregate metrics across all processed tickets."""
    total_tickets = db.query(func.count(Ticket.id)).scalar() or 0

    action_counts = (
        db.query(Prediction.action, func.count(Prediction.id))
        .group_by(Prediction.action)
        .all()
    )
    counts = {action: cnt for action, cnt in action_counts}

    auto_resolved = counts.get("AUTO_RESOLVE", 0)
    escalated = counts.get("ESCALATE", 0)
    suggested = counts.get("SUGGEST", 0)

    avg_confidence = db.query(func.avg(Prediction.confidence)).scalar() or 0.0

    total_predictions = auto_resolved + escalated + suggested

    def pct(n: int) -> float:
        return round((n / total_predictions * 100), 2) if total_predictions > 0 else 0.0

    return MetricsResponse(
        total_tickets=total_tickets,
        auto_resolved_count=auto_resolved,
        escalated_count=escalated,
        suggested_count=suggested,
        auto_resolved_pct=pct(auto_resolved),
        escalated_pct=pct(escalated),
        avg_confidence=round(float(avg_confidence), 4),
    )


@router.get("/health")
def health_check():
    return {"status": "ok"}
