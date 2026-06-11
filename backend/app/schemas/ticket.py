from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class TicketCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    description: str = Field(..., min_length=10)
    priority: str = Field(..., pattern="^(P1|P2|P3)$")
    user_type: str = Field(..., pattern="^(VIP|STANDARD)$")


class TicketResponse(BaseModel):
    id: int
    title: str
    description: str
    priority: str
    user_type: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SimilarTicket(BaseModel):
    ticket_id: int
    title: str
    score: float


class ConfidenceBreakdown(BaseModel):
    classification_prob: float
    similarity_score: float
    historical_success: float
    risk_adjustment: float


class Explanation(BaseModel):
    reason: str
    similarity_matches: List[SimilarTicket]
    confidence_breakdown: ConfidenceBreakdown
    # Real model outputs
    ticket_category: str        # Billing Question | Technical Issue | General Inquiry | Feature Request
    financial_category: str     # credit card | bank account | loans | mortgage | investments
    classifier_confidence: float  # raw DistilBERT confidence score


class ProcessTicketResponse(BaseModel):
    ticket_id: int
    confidence: float
    risk: str
    action: str
    explanation: Explanation


class MetricsResponse(BaseModel):
    total_tickets: int
    auto_resolved_count: int
    escalated_count: int
    suggested_count: int
    auto_resolved_pct: float
    escalated_pct: float
    avg_confidence: float
