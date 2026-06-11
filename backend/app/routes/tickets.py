from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import secrets

from app.db.database import get_db
from app.db.models import Ticket, Prediction, AuditLog, User
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
    # Attach customer_id if the caller is a customer
    user = db.query(User).filter(User.username == current_user["username"]).first()
    if user:
        ticket.customer_id = user.id
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
    role = current_user.get("role", "customer")
    if role not in ("admin", "agent"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
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

    role = current_user.get("role", "customer")
    if role == "customer":
        user_id = current_user.get("id")
        if not user_id:
            user = db.query(User).filter(User.username == current_user["username"]).first()
            user_id = user.id if user else None
        if ticket.customer_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to view this ticket")

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

    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if ticket:
        role = current_user.get("role", "customer")
        if role == "customer":
            user_id = current_user.get("id")
            if not user_id:
                user = db.query(User).filter(User.username == current_user["username"]).first()
                user_id = user.id if user else None
            if ticket.customer_id != user_id:
                raise HTTPException(status_code=403, detail="Not authorized to view this ticket's prediction")

    return {
        "ticket_id":        ticket_id,
        "confidence":       prediction.confidence,
        "risk":             prediction.risk,
        "action":           prediction.action,
        "ticket_category":  prediction.ticket_category,
        "financial_category": prediction.financial_category,
        "ai_explanation":   prediction.ai_explanation,
        "apology_message":  prediction.apology_message,
        "created_at":       prediction.created_at,
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


@router.get("/my-tickets", response_model=List[TicketResponse])
def my_tickets(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Customer: list only their own tickets."""
    user_id = current_user.get("id")
    if not user_id:
        user = db.query(User).filter(User.username == current_user["username"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user_id = user.id
    q = db.query(Ticket).filter(Ticket.customer_id == user_id)
    if status:
        q = q.filter(Ticket.status == status)
    return q.order_by(Ticket.created_at.desc()).offset(skip).limit(limit).all()


@router.patch("/tickets/{ticket_id}/status")
def update_ticket_status(
    ticket_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Admin/agent: update ticket status."""
    from app.core.security import require_role
    role = current_user.get("role", "customer")
    if role not in ("admin", "agent"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    allowed_statuses = {"open", "in_progress", "escalated", "resolved", "closed"}
    new_status = payload.get("status")
    if new_status not in allowed_statuses:
        raise HTTPException(status_code=422, detail=f"Invalid status. Must be one of: {allowed_statuses}")

    ticket.status = new_status
    if payload.get("assigned_to"):
        ticket.assigned_to = payload["assigned_to"]
    db.commit()
    db.refresh(ticket)
    logger.info("ticket_status_updated", ticket_id=ticket_id, status=new_status, actor=current_user["username"])
    return {"ticket_id": ticket_id, "status": ticket.status}


@router.post("/tickets/upload", status_code=201)
async def upload_attachment(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    # Validate file type
    ALLOWED_TYPES = {
        "image/jpeg", "image/png", "image/gif", "image/webp",
        "application/pdf", "text/plain",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5MB

    content = await file.read()
    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 5MB limit")

    ct = (file.content_type or "").split(";")[0].strip()
    if ct and ct not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"File type not allowed. Supported: images, PDF, text, Word documents"
        )

    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "bin"
    filename = f"{secrets.token_hex(12)}.{ext}"
    os.makedirs("data/uploads", exist_ok=True)
    filepath = f"data/uploads/{filename}"
    with open(filepath, "wb") as f:
        f.write(content)

    logger.info("attachment_uploaded", filename=filename, size=len(content), actor=current_user["username"])
    return {"attachment_url": f"/uploads/{filename}", "filename": file.filename, "size": len(content)}
