"""
Chat Routes — Gemini-powered AI support chat
============================================
GET  /tickets/{id}/chat   — load chat history
POST /tickets/{id}/chat   — send message (REST fallback)
WS   /ws/chat/{ticket_id} — WebSocket real-time chat
"""

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from typing import List, Dict
import json

from app.db.database import get_db
from app.db.models import ChatMessage, Ticket, User, Prediction
from app.schemas.chat import ChatMessageCreate, ChatMessageResponse
from app.core.security import get_current_user
from app.services.ai_chat import generate_ai_response
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["chat"])


# ── WebSocket connection manager ─────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active: Dict[int, List[WebSocket]] = {}

    async def connect(self, ticket_id: int, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(ticket_id, []).append(ws)

    def disconnect(self, ticket_id: int, ws: WebSocket):
        if ticket_id in self.active:
            try:
                self.active[ticket_id].remove(ws)
            except ValueError:
                pass

    async def broadcast(self, ticket_id: int, data: dict):
        dead = []
        for ws in self.active.get(ticket_id, []):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ticket_id, ws)


manager = ConnectionManager()


def _get_ticket_context(db: Session, ticket_id: int) -> dict:
    """Load ticket + prediction context for AI."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        return {}
    pred = (
        db.query(Prediction)
        .filter(Prediction.ticket_id == ticket_id)
        .order_by(Prediction.created_at.desc())
        .first()
    )
    return {
        "title":       ticket.title,
        "description": ticket.description,
        "category":    ticket.category or "General",
        "priority":    ticket.priority,
        "action":      pred.action if pred else "SUGGEST",
        "confidence":  pred.confidence if pred else 0.5,
        "ticket_category":    pred.ticket_category if pred else ticket.category or "General",
        "financial_category": pred.financial_category if pred else "General",
    }


def _get_history(db: Session, ticket_id: int, limit: int = 20) -> List[dict]:
    """Get recent chat history as plain dicts for AI context."""
    msgs = (
        db.query(ChatMessage)
        .filter(ChatMessage.ticket_id == ticket_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
        .all()
    )
    return [{"sender_role": m.sender_role, "message": m.message} for m in reversed(msgs)]


def _build_ai_reply(db: Session, ticket_id: int, user_message: str) -> str:
    """Generate AI reply with full ticket + history context."""
    ctx = _get_ticket_context(db, ticket_id)
    if not ctx:
        return "I'm having trouble accessing your ticket details. Please try again."
    history = _get_history(db, ticket_id)
    return generate_ai_response(
        ticket_title=ctx["title"],
        ticket_description=ctx["description"],
        ticket_category=ctx["ticket_category"],
        ticket_priority=ctx["priority"],
        ai_action=ctx["action"],
        ai_confidence=ctx["confidence"],
        conversation_history=history,
        user_message=user_message,
    )


# ── REST endpoints ────────────────────────────────────────────────────────────
@router.get("/tickets/{ticket_id}/chat", response_model=List[ChatMessageResponse])
def get_chat_history(
    ticket_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.ticket_id == ticket_id)
        .order_by(ChatMessage.created_at.asc())
        .offset(skip).limit(limit).all()
    )


@router.post("/tickets/{ticket_id}/chat", response_model=ChatMessageResponse)
def send_message(
    ticket_id: int,
    payload: ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    user = db.query(User).filter(User.username == current_user["username"]).first()
    role = current_user.get("role", "customer")

    # Save user message
    msg = ChatMessage(
        ticket_id=ticket_id,
        sender_id=user.id if user else None,
        sender_role=role,
        message=payload.message,
        is_ai=False,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    # AI reply for customers
    if role == "customer":
        ai_text = _build_ai_reply(db, ticket_id, payload.message)
        ai_msg = ChatMessage(
            ticket_id=ticket_id,
            sender_id=None,
            sender_role="ai",
            message=ai_text,
            is_ai=True,
        )
        db.add(ai_msg)
        db.commit()

    return msg


# ── WebSocket ─────────────────────────────────────────────────────────────────
@router.websocket("/ws/chat/{ticket_id}")
async def websocket_chat(
    ticket_id: int,
    websocket: WebSocket,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    from app.core.security import decode_token
    from fastapi.concurrency import run_in_threadpool

    try:
        payload = decode_token(token)
        username = payload.get("sub")
        role = payload.get("role", "customer")
    except Exception:
        await websocket.close(code=4001)
        return

    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        await websocket.close(code=4004)
        return

    user = db.query(User).filter(User.username == username).first()
    await manager.connect(ticket_id, websocket)
    logger.info("ws_connected", ticket_id=ticket_id, user=username)

    try:
        while True:
            data = await websocket.receive_text()
            try:
                body = json.loads(data)
                text = body.get("message", "").strip()
            except Exception:
                text = data.strip()

            if not text:
                continue

            # Persist user message
            msg = ChatMessage(
                ticket_id=ticket_id,
                sender_id=user.id if user else None,
                sender_role=role,
                message=text,
                is_ai=False,
            )
            db.add(msg)
            db.commit()
            db.refresh(msg)

            await manager.broadcast(ticket_id, {
                "id": msg.id,
                "ticket_id": ticket_id,
                "sender_role": role,
                "message": text,
                "is_ai": False,
                "created_at": msg.created_at.isoformat(),
                "sender": username,
            })

            # AI reply for customers — run in thread pool (Gemini is sync)
            if role == "customer":
                ai_text = await run_in_threadpool(_build_ai_reply, db, ticket_id, text)

                ai_msg = ChatMessage(
                    ticket_id=ticket_id,
                    sender_id=None,
                    sender_role="ai",
                    message=ai_text,
                    is_ai=True,
                )
                db.add(ai_msg)
                db.commit()
                db.refresh(ai_msg)

                await manager.broadcast(ticket_id, {
                    "id": ai_msg.id,
                    "ticket_id": ticket_id,
                    "sender_role": "ai",
                    "message": ai_text,
                    "is_ai": True,
                    "created_at": ai_msg.created_at.isoformat(),
                    "sender": "ResolvAI",
                })

    except WebSocketDisconnect:
        manager.disconnect(ticket_id, websocket)
        logger.info("ws_disconnected", ticket_id=ticket_id, user=username)
    except Exception as e:
        logger.error("ws_error", ticket_id=ticket_id, error=str(e))
        manager.disconnect(ticket_id, websocket)
