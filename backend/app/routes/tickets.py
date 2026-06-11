from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.database import get_db
from app.db.models import Ticket, Prediction, AuditLog
from app.schemas.ticket import TicketCreate, TicketResponse, ProcessTicketResponse
from app.services.ai_pipeline import run_pipeline
from app.workers.tasks import persist_prediction, persist_audit_log
from app.core.security import get_current_user
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["tickets"])


@router.post("/tickets", response_model=TicketResponse, status_code=201)
def create_ticket(
    payload: TicketCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    ticket = Ticket(**payload.model_dump())
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    logger.info("ticket_created", ticket_id=ticket.id, actor=current_user["username"])
    return ticket


@router.post("/process-ticket", response_model=ProcessTicketResponse)
def process_ticket(
    payload: TicketCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    ticket = Ticket(**payload.model_dump())
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    result = run_pipeline(
        ticket_id=ticket.id,
        title=ticket.title,
        description=ticket.description,
        priority=ticket.priority,
        user_type=ticket.user_type,
    )

    input_text = f"{ticket.title}. {ticket.description}"
    background_tasks.add_task(persist_prediction, db, result)
    background_tasks.add_task(persist_audit_log, db, result, input_text, current_user["username"])

    logger.info(
        "ticket_processed",
        ticket_id=ticket.id,
        confidence=result.confidence,
        action=result.action,
        actor=current_user["username"],
    )
    return result


@router.get("/tickets", response_model=List[TicketResponse])
def list_tickets(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    priority: Optional[str] = Query(None, pattern="^(P1|P2|P3)$"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    q = db.query(Ticket)
    if priority:
        q = q.filter(Ticket.priority == priority)
    return q.order_by(Ticket.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/tickets/{ticket_id}", response_model=TicketResponse)
def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail=f"Ticket {ticket_id} not found")
    return ticket


@router.get("/tickets/{ticket_id}/prediction", response_model=dict)
def get_ticket_prediction(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    prediction = (
        db.query(Prediction)
        .filter(Prediction.ticket_id == ticket_id)
        .order_by(Prediction.created_at.desc())
        .first()
    )
    if not prediction:
        raise HTTPException(status_code=404, detail="No prediction found for this ticket")
    return {
        "ticket_id": ticket_id,
        "confidence": prediction.confidence,
        "risk": prediction.risk,
        "action": prediction.action,
        "created_at": prediction.created_at,
    }


@router.post("/tickets/check-duplicate")
def check_duplicate(
    payload: TicketCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Duplicate detection — checks FAISS for highly similar existing tickets.
    Returns matches above 0.92 cosine similarity threshold.
    """
    from app.services.embeddings import generate_embedding
    from app.services.rag import search_similar

    embedding = generate_embedding(f"{payload.title}. {payload.description}")
    matches = search_similar(embedding, top_k=3)

    duplicates = [
        {"ticket_id": tid, "title": title, "similarity": round(score, 4)}
        for tid, title, score in matches
        if score >= 0.92
    ]

    return {
        "is_duplicate": len(duplicates) > 0,
        "duplicates": duplicates,
        "message": (
            f"This issue already exists. Follow Ticket #{duplicates[0]['ticket_id']}"
            if duplicates else "No duplicate found"
        ),
    }


@router.get("/audit-logs", response_model=List[dict])
def get_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    logs = (
        db.query(AuditLog)
        .order_by(AuditLog.timestamp.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": l.id,
            "ticket_id": l.ticket_id,
            "confidence": l.confidence,
            "risk": l.risk,
            "decision": l.decision,
            "actor": l.actor,
            "timestamp": l.timestamp,
        }
        for l in logs
    ]
