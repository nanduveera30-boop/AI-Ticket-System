"""
AI Pipeline — full production flow.
Generates confidence score, decision, apology message, and suggested actions.
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
    SimilarTicket, ConfidenceBreakdown, Explanation, ProcessTicketResponse,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)

HISTORICAL_SUCCESS_RATE = 0.8

# Apology templates per category
APOLOGY_TEMPLATES = {
    "Technical Issue": (
        "We sincerely apologize for the technical difficulties you are experiencing. "
        "Our engineering team takes these issues very seriously and we understand how "
        "frustrating this can be. We are committed to resolving this as quickly as possible."
    ),
    "Billing Question": (
        "We apologize for any confusion or inconvenience regarding your billing. "
        "We understand how important accurate billing is and we will ensure this is "
        "reviewed and corrected promptly."
    ),
    "General Inquiry": (
        "Thank you for reaching out to us. We appreciate your patience and will "
        "ensure your inquiry is addressed thoroughly and promptly."
    ),
    "Feature Request": (
        "Thank you for your valuable feedback and feature suggestion. "
        "We truly appreciate customers who help us improve our product."
    ),
}

SUGGESTED_ACTIONS = {
    "AUTO_RESOLVE": [
        "Your ticket has been automatically processed based on our AI analysis.",
        "You will receive a resolution summary via email within 15 minutes.",
        "If the issue persists, please reply to this ticket to escalate.",
    ],
    "SUGGEST": [
        "A support agent will review your ticket within 2 business hours.",
        "You can track the status of your ticket in the My Tickets section.",
        "Feel free to add more details via the chat on this ticket.",
    ],
    "ESCALATE": [
        "Your ticket has been escalated to our senior support team.",
        "A specialist will contact you within 1 business hour.",
        "For urgent matters, please call our priority support line.",
    ],
}


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
    combined_text = f"{title}. {description}"

    # 1. Embedding
    embedding = generate_embedding(combined_text)

    # 2. RAG
    raw_matches = search_similar(embedding, top_k=3)
    similar_tickets: List[SimilarTicket] = [
        SimilarTicket(ticket_id=tid, title=t, score=round(s, 4))
        for tid, t, s in raw_matches
    ]

    # 3. DistilBERT classification
    clf_result = classify_ticket(title, description)
    classification_prob = round(clf_result["score"] * clf_result["resolvability"], 6)
    ticket_category = clf_result["label"]

    # 4. Similarity
    similarity_score = _avg_similarity(raw_matches)

    # 5. Financial category
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

    # 9. Add to FAISS
    add_to_index(ticket_id, title, description, embedding)

    # 10. Apology + suggested actions
    apology = APOLOGY_TEMPLATES.get(ticket_category, APOLOGY_TEMPLATES["General Inquiry"])
    actions = SUGGESTED_ACTIONS.get(action, SUGGESTED_ACTIONS["SUGGEST"])

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
        apology_message=apology,
        suggested_actions=actions,
    )

    logger.info(
        "pipeline_complete",
        ticket_id=ticket_id, confidence=confidence,
        risk=risk, action=action, category=ticket_category,
    )

    return ProcessTicketResponse(
        ticket_id=ticket_id,
        confidence=confidence,
        risk=risk,
        action=action,
        explanation=explanation,
    )
