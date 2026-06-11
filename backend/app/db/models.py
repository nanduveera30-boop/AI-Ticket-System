from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    username        = Column(String(100), nullable=False, unique=True)
    email           = Column(String(255), nullable=False, unique=True)
    hashed_password = Column(String(255), nullable=False)
    role            = Column(String(20), nullable=False, default="agent")  # admin | agent | viewer
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime, default=datetime.utcnow)


class Ticket(Base):
    __tablename__ = "tickets"

    id          = Column(Integer, primary_key=True, index=True)
    title       = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    priority    = Column(String(10), nullable=False)
    user_type   = Column(String(20), nullable=False)
    created_at  = Column(DateTime, default=datetime.utcnow)


class Prediction(Base):
    __tablename__ = "predictions"

    id         = Column(Integer, primary_key=True, index=True)
    ticket_id  = Column(Integer, ForeignKey("tickets.id"), nullable=False, index=True)
    confidence = Column(Float, nullable=False)
    risk       = Column(String(10), nullable=False)
    action     = Column(String(20), nullable=False)
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
    actor       = Column(String(100), nullable=True)   # username who triggered
    timestamp   = Column(DateTime, default=datetime.utcnow, index=True)
