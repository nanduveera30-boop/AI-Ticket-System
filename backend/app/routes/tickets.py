from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Ticket
from app.schemas.ticket import TicketCreate, TicketResponse, ProcessTicketResponse
from app.services.ai_pipeline import run_pipeline
from app.workers.tasks import persist_prediction, persist_audit_log
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["tickets"])


@router.post("/tickets", response_model=TicketResponse, status_code=201)
def create_ticket(payload: TicketCreate, db: Session = Depends(get_db)):
    """Create and persist a new support ticket."""
    ticket = Ticket(
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        user_type=payload.user_type,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    logger.info(f"Ticket created: id={ticket.id}")
    return ticket


@router.post("/process-ticket", response_model=ProcessTicketResponse)
def process_ticket(
    payload: TicketCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Create a ticket, run the full AI pipeline, persist results,
    and return the confidence-governed decision with explainability.
    """
    # Persist ticket first
    ticket = Ticket(
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        user_type=payload.user_type,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    # Run AI pipeline
    result = run_pipeline(
        ticket_id=ticket.id,
        title=ticket.title,
        description=ticket.description,
        priority=ticket.priority,
        user_type=ticket.user_type,
    )

    # Persist prediction and audit log in background
    input_text = f"{ticket.title}. {ticket.description}"
    background_tasks.add_task(persist_prediction, db, result)
    background_tasks.add_task(persist_audit_log, db, result, input_text)

    return result


@router.get("/tickets/{ticket_id}", response_model=TicketResponse)
def get_ticket(ticket_id: int, db: Session = Depends(get_db)):
    """Retrieve a ticket by ID."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail=f"Ticket {ticket_id} not found")
    return ticket
