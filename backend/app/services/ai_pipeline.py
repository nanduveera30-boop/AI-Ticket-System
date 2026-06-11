"""
AI Pipeline — full production flow using pre-trained models.

Steps:
  1. Generate embedding (all-MiniLM-L6-v2)
  2. RAG: retrieve top-3 similar tickets from FAISS
  3. classification_prob: DistilBERT ticket classifier (Dragneel/ticket-classification-v1)
  4. similarity_score: avg cosine similarity from RAG
  5. financial_category: zero-shot BART (facebook/bart-large-mnli)
  6. Risk evaluation
  7. Confidence computation
  8. Decision
  9. Return structured result with full explainability
"""

from typing import List
import numpy as np

from app.services.embeddings import generate_embedding
from app.services.rag import search_similar, add_to_index
from app.services.classifier import classify_ticket, classify_financial_category
from app.services.confidence import compute_confidence
from app.services.risk import evaluate_risk
from app.services.decision import make_decision
from app.schemas.ticket import (
    SimilarTicket,
    ConfidenceBreakdown,
    Explanation,
    ProcessTicketResponse,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)

HISTORICAL_SUCCESS_RATE = 0.8  # Structured baseline — updated per category in future


def _avg_similarity(matches: List[tuple]) -> float:
    if not matches:
        return 0.0
    return round(float(np.mean([m[2] for m in matches])), 6)


def run_pipeline(
    ticket_id: int,
    title: str,
    description: str,
    priority: str,
    user_type: str,
) -> ProcessTicketResponse:
    """
    Full AI pipeline. Adds ticket to FAISS after processing
    so future tickets can match against it.
    """
    combined_text = f"{title}. {description}"

    # 1. Embedding
    embedding = generate_embedding(combined_text)

    # 2. RAG — search before adding current ticket
    raw_matches = search_similar(embedding, top_k=3)
    similar_tickets: List[SimilarTicket] = [
        SimilarTicket(ticket_id=tid, title=t, score=round(s, 4))
        for tid, t, s in raw_matches
    ]

    # 3. DistilBERT classification
    clf_result = classify_ticket(title, description)
    classification_prob = round(
        clf_result["score"] * clf_result["resolvability"], 6
    )
    ticket_category = clf_result["label"]

    # 4. Similarity score from RAG
    similarity_score = _avg_similarity(raw_matches)

    # 5. Financial domain category (zero-shot BART)
    fin_result = classify_financial_category(title, description)
    financial_category = fin_result["category"]

    # 6. Risk
    risk, risk_adjustment = evaluate_risk(priority, user_type)

    # 7. Confidence
    confidence = compute_confidence(
        classification_prob=classification_prob,
        similarity_score=similarity_score,
        historical_success=HISTORICAL_SUCCESS_RATE,
        risk_adjustment=risk_adjustment,
    )

    # 8. Decision
    action, reason = make_decision(confidence, risk)

    # 9. Add to FAISS index
    add_to_index(ticket_id, title, description, embedding)

    breakdown = ConfidenceBreakdown(
        classification_prob=classification_prob,
        similarity_score=similarity_score,
        historical_success=HISTORICAL_SUCCESS_RATE,
        risk_adjustment=risk_adjustment,
    )

    explanation = Explanation(
        reason=reason,
        similarity_matches=similar_tickets,
        confidence_breakdown=breakdown,
        ticket_category=ticket_category,
        financial_category=financial_category,
        classifier_confidence=round(clf_result["score"], 4),
    )

    logger.info(
        "pipeline_complete",
        ticket_id=ticket_id,
        confidence=confidence,
        risk=risk,
        action=action,
        category=ticket_category,
        financial_category=financial_category,
    )

    return ProcessTicketResponse(
        ticket_id=ticket_id,
        confidence=confidence,
        risk=risk,
        action=action,
        explanation=explanation,
    )
