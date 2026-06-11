from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class ChatMessageCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


class ChatMessageResponse(BaseModel):
    id:          int
    ticket_id:   int
    sender_id:   Optional[int]
    sender_role: str
    message:     str
    is_ai:       bool
    created_at:  datetime
    model_config = {"from_attributes": True}
