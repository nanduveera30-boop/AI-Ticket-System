from datetime import datetime
from sqlalchemy.orm import Session

from app.db.models import Prediction, AuditLog
from app.schemas.ticket import ProcessTicketResponse
from app.utils.logger import get_logger

logger = get_logger(__name__)


def persist_prediction(db: Session, result: ProcessTicketResponse) -> None:
    try:
        prediction = Prediction(
            ticket_id=result.ticket_id,
            confidence=result.confidence,
            risk=result.risk,
            action=result.action,
        )
        db.add(prediction)
        db.commit()
        logger.info("prediction_persisted", ticket_id=result.ticket_id)
    except Exception as e:
        db.rollback()
        logger.error("prediction_persist_failed", ticket_id=result.ticket_id, error=str(e))


def persist_audit_log(
    db: Session,
    result: ProcessTicketResponse,
    input_text: str,
    actor: str = "system",
) -> None:
    try:
        log = AuditLog(
            ticket_id=result.ticket_id,
            input_text=input_text,
            output_text=result.explanation.reason,
            confidence=result.confidence,
            risk=result.risk,
            decision=result.action,
            actor=actor,
            timestamp=datetime.utcnow(),
        )
        db.add(log)
        db.commit()
        logger.info("audit_log_persisted", ticket_id=result.ticket_id, actor=actor)
    except Exception as e:
        db.rollback()
        logger.error("audit_log_persist_failed", ticket_id=result.ticket_id, error=str(e))
