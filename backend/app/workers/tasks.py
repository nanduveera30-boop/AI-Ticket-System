from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import asyncio
from typing import NoReturn

from app.db.database import SessionLocal
from app.db.models import Prediction, AuditLog, Ticket
from app.schemas.ticket import ProcessTicketResponse
from app.utils.logger import get_logger

logger = get_logger(__name__)

async def auto_escalate_tickets() -> NoReturn:
    """Background loop that evaluates open tickets every 60 seconds."""
    logger.info("bg_worker_started", worker="auto_escalate_tickets")
    while True:
        try:
            with SessionLocal() as db:
                now = datetime.utcnow()
                open_tickets = db.query(Ticket).filter(Ticket.status == "open").all()
                escalated_count = 0
                for t in open_tickets:
                    age = now - t.created_at
                    # Escalate if > 24h OR if P1 and > 1h
                    if age > timedelta(hours=24) or (t.priority == "P1" and age > timedelta(hours=1)):
                        t.status = "escalated"
                        # Create audit log
                        log = AuditLog(
                            ticket_id=t.id,
                            input_text="System auto-escalation check.",
                            output_text=f"Ticket auto-escalated after {age.total_seconds() / 3600:.1f} hours.",
                            confidence=1.0, risk="HIGH", decision="ESCALATE", actor="system",
                            timestamp=now,
                        )
                        db.add(log)
                        escalated_count += 1
                
                if escalated_count > 0:
                    db.commit()
                    logger.info("tickets_auto_escalated", count=escalated_count)
                    
        except Exception as e:
            logger.error("auto_escalation_error", error=str(e))
        
        await asyncio.sleep(60)


def persist_prediction(db: Session, result: ProcessTicketResponse) -> None:
    try:
        prediction = Prediction(
            ticket_id=result.ticket_id,
            confidence=result.confidence,
            risk=result.risk,
            action=result.action,
            ticket_category=result.explanation.ticket_category,
            financial_category=result.explanation.financial_category,
            ai_explanation=result.explanation.reason,
            apology_message=result.explanation.apology_message,
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
