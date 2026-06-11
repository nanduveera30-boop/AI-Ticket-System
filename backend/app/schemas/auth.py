from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class UserCreate(BaseModel):
    username:  str = Field(..., min_length=3, max_length=100)
    email:     EmailStr
    password:  str = Field(..., min_length=8)
    role:      str = Field(default="customer", pattern="^(admin|agent|customer|viewer)$")
    full_name: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class LoginRequest(BaseModel):
    username: str
    password: str
