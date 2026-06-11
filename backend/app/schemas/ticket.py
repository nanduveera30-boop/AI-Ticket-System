from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class TicketCreate(BaseModel):
    title:       str = Field(..., min_length=3, max_length=255)
    description: str = Field(..., min_length=10)
    priority:    str = Field(default="P2", pattern="^(P1|P2|P3)$")
    category:    Optional[str] = None
    user_type:   str = Field(default="STANDARD", pattern="^(VIP|STANDARD)$")
    attachment_url: Optional[str] = None


class TicketResponse(BaseModel):
    id:          int
    title:       str
    description: str
    priority:    str
    category:    Optional[str]
    user_type:   str
    status:      str
    customer_id: Optional[int]
    assigned_to: Optional[int]
    attachment_url: Optional[str] = None
    created_at:  datetime
    updated_at:  datetime
    model_config = {"from_attributes": True}


class SimilarTicket(BaseModel):
    ticket_id: int
    title:     str
    score:     float


class ConfidenceBreakdown(BaseModel):
    classification_prob: float
    similarity_score:    float
    historical_success:  float
    risk_adjustment:     float


class Explanation(BaseModel):
    reason:               str
    similarity_matches:   List[SimilarTicket]
    confidence_breakdown: ConfidenceBreakdown
    ticket_category:      str
    financial_category:   str
    classifier_confidence: float
    apology_message:      str
    suggested_actions:    List[str]


class ProcessTicketResponse(BaseModel):
    ticket_id:  int
    confidence: float
    risk:       str
    action:     str
    explanation: Explanation


class MetricsResponse(BaseModel):
    total_tickets:       int
    auto_resolved_count: int
    escalated_count:     int
    suggested_count:     int
    auto_resolved_pct:   float
    escalated_pct:       float
    avg_confidence:      float
