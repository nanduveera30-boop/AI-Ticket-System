"""
Background task workers — persist predictions and audit logs after pipeline runs.
These are called via FastAPI BackgroundTasks (no Celery needed for MVP).
"""

from datetime import datetime
from sqlalchemy.orm import Session

from app.db.models import Prediction, AuditLog
from app.schemas.ticket import ProcessTicketResponse
from app.utils.logger import get_logger

logger = get_logger(__name__)


def persist_prediction(db: Session, result: ProcessTicketResponse) -> None:
    """Write prediction record to DB."""
    try:
        prediction = Prediction(
            ticket_id=result.ticket_id,
            confidence=result.confidence,
            risk=result.risk,
            action=result.action,
        )
        db.add(prediction)
        db.commit()
        logger.info(f"Prediction persisted for ticket {result.ticket_id}")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to persist prediction: {e}")


def persist_audit_log(
    db: Session,
    result: ProcessTicketResponse,
    input_text: str,
) -> None:
    """Write audit log record to DB."""
    try:
        log = AuditLog(
            ticket_id=result.ticket_id,
            input_text=input_text,
            output_text=result.explanation.reason,
            confidence=result.confidence,
            risk=result.risk,
            decision=result.action,
            timestamp=datetime.utcnow(),
        )
        db.add(log)
        db.commit()
        logger.info(f"Audit log persisted for ticket {result.ticket_id}")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to persist audit log: {e}")
