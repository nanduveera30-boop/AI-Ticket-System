from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime,
    Text, ForeignKey, Boolean, Enum
)
import enum
from app.db.database import Base


class UserRole(str, enum.Enum):
    admin   = "admin"
    agent   = "agent"
    customer = "customer"
    viewer  = "viewer"


class TicketStatus(str, enum.Enum):
    open        = "open"
    in_progress = "in_progress"
    escalated   = "escalated"
    resolved    = "resolved"
    closed      = "closed"


class User(Base):
    __tablename__ = "users"
    id              = Column(Integer, primary_key=True, index=True)
    username        = Column(String(100), nullable=False, unique=True)
    email           = Column(String(255), nullable=False, unique=True)
    hashed_password = Column(String(255), nullable=False)
    role            = Column(String(20), nullable=False, default="customer")
    full_name       = Column(String(200), nullable=True)
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime, default=datetime.utcnow)


class Ticket(Base):
    __tablename__ = "tickets"
    id          = Column(Integer, primary_key=True, index=True)
    title       = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    priority    = Column(String(10), nullable=False, default="P2")
    category    = Column(String(50), nullable=True)
    user_type   = Column(String(20), nullable=False, default="STANDARD")
    status      = Column(String(20), nullable=False, default="open")
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    attachment_url = Column(String(500), nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Prediction(Base):
    __tablename__ = "predictions"
    id         = Column(Integer, primary_key=True, index=True)
    ticket_id  = Column(Integer, ForeignKey("tickets.id"), nullable=False, index=True)
    confidence = Column(Float, nullable=False)
    risk       = Column(String(10), nullable=False)
    action     = Column(String(20), nullable=False)
    ticket_category   = Column(String(50), nullable=True)
    financial_category = Column(String(100), nullable=True)
    ai_explanation    = Column(Text, nullable=True)
    apology_message   = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id          = Column(Integer, primary_key=True, index=True)
    ticket_id   = Column(Integer, ForeignKey("tickets.id"), nullable=False, index=True)
    input_text  = Column(Text, nullable=False)
    output_text = Column(Text, nullable=False)
    confidence  = Column(Float, nullable=False)
    risk        = Column(String(10), nullable=False)
    decision    = Column(String(20), nullable=False)
    actor       = Column(String(100), nullable=True)
    timestamp   = Column(DateTime, default=datetime.utcnow, index=True)


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id         = Column(Integer, primary_key=True, index=True)
    ticket_id  = Column(Integer, ForeignKey("tickets.id"), nullable=False, index=True)
    sender_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
    sender_role = Column(String(20), nullable=False, default="customer")
    message    = Column(Text, nullable=False)
    is_ai      = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class FAQ(Base):
    __tablename__ = "faqs"
    id         = Column(Integer, primary_key=True, index=True)
    question   = Column(String(500), nullable=False)
    answer     = Column(Text, nullable=False)
    category   = Column(String(100), nullable=True)
    is_active  = Column(Boolean, default=True)
    view_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
