from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class FAQCreate(BaseModel):
    question: str = Field(..., min_length=5, max_length=500)
    answer:   str = Field(..., min_length=10)
    category: Optional[str] = None


class FAQResponse(BaseModel):
    id:         int
    question:   str
    answer:     str
    category:   Optional[str]
    view_count: int
    is_active:  bool
    created_at: datetime
    model_config = {"from_attributes": True}
