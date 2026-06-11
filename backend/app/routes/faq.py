"""
FAQ Routes
==========
GET  /faq              — list all active FAQs (public)
GET  /faq/search       — search FAQs by keyword
GET  /faq/{id}         — get single FAQ + increment view count
POST /faq              — create FAQ (admin only)
PATCH /faq/{id}        — update FAQ (admin only)
DELETE /faq/{id}       — deactivate FAQ (admin only)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.database import get_db
from app.db.models import FAQ
from app.schemas.faq import FAQCreate, FAQResponse
from app.core.security import get_current_user, require_role
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/faq", tags=["faq"])


@router.get("", response_model=List[FAQResponse])
def list_faqs(
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(FAQ).filter(FAQ.is_active == True)
    if category:
        q = q.filter(FAQ.category == category)
    return q.order_by(FAQ.view_count.desc()).all()


@router.get("/search", response_model=List[FAQResponse])
def search_faqs(
    q: str = Query(..., min_length=2),
    db: Session = Depends(get_db),
):
    term = f"%{q}%"
    return (
        db.query(FAQ)
        .filter(FAQ.is_active == True)
        .filter(FAQ.question.ilike(term) | FAQ.answer.ilike(term))
        .order_by(FAQ.view_count.desc())
        .limit(20)
        .all()
    )


@router.get("/{faq_id}", response_model=FAQResponse)
def get_faq(faq_id: int, db: Session = Depends(get_db)):
    faq = db.query(FAQ).filter(FAQ.id == faq_id, FAQ.is_active == True).first()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ not found")
    faq.view_count += 1
    db.commit()
    db.refresh(faq)
    return faq


@router.post("", response_model=FAQResponse, status_code=201)
def create_faq(
    payload: FAQCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin", "agent")),
):
    faq = FAQ(**payload.model_dump())
    db.add(faq)
    db.commit()
    db.refresh(faq)
    logger.info("faq_created", faq_id=faq.id)
    return faq


@router.patch("/{faq_id}", response_model=FAQResponse)
def update_faq(
    faq_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin", "agent")),
):
    faq = db.query(FAQ).filter(FAQ.id == faq_id).first()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ not found")
    for k, v in payload.items():
        if hasattr(faq, k):
            setattr(faq, k, v)
    db.commit()
    db.refresh(faq)
    return faq


@router.delete("/{faq_id}")
def delete_faq(
    faq_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin")),
):
    faq = db.query(FAQ).filter(FAQ.id == faq_id).first()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ not found")
    faq.is_active = False
    db.commit()
    return {"message": "FAQ deactivated"}
