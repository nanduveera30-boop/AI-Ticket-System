
from typing import List
import numpy as np

from app.services.embeddings import generate_embedding
from app.services.rag import search_similar, add_to_index
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

# Keywords that indicate a well-understood, resolvable ticket category
RESOLVABLE_KEYWORDS = [
    "password", "reset", "login", "access", "account", "billing",
    "invoice", "refund", "subscription", "update", "install", "error",
    "crash", "slow", "timeout", "not working", "cannot", "unable",
]

HISTORICAL_SUCCESS_RATE = 0.8  # Structured mock — represents avg past resolution rate


def _classification_prob(title: str, description: str) -> float:
    """
    Heuristic classification probability.
    Counts how many resolvable keywords appear in the combined text,
    normalized to [0.3, 0.95] range.
    """
    text = (title + " " + description).lower()
    hits = sum(1 for kw in RESOLVABLE_KEYWORDS if kw in text)
    # Normalize: 0 hits → 0.30, 5+ hits → 0.95
    prob = 0.30 + min(hits / 5.0, 1.0) * 0.65
    return round(prob, 6)


def _avg_similarity(matches: List[tuple]) -> float:
    """Average cosine similarity score from top-k matches. Returns 0 if no matches."""
    if not matches:
        return 0.0
    scores = [m[2] for m in matches]
    return round(float(np.mean(scores)), 6)


def run_pipeline(
    ticket_id: int,
    title: str,
    description: str,
    priority: str,
    user_type: str,
) -> ProcessTicketResponse:
    """
    Full AI pipeline for a ticket.
    Adds the ticket to the FAISS index after processing so future tickets
    can match against it.
    """
    combined_text = f"{title}. {description}"

    # 1. Embedding
    embedding = generate_embedding(combined_text)

    # 2. RAG — retrieve similar tickets before adding current one
    raw_matches = search_similar(embedding, top_k=3)
    similar_tickets: List[SimilarTicket] = [
        SimilarTicket(ticket_id=tid, title=t, score=round(s, 4))
        for tid, t, s in raw_matches
    ]

    # 3. Classification probability
    classification_prob = _classification_prob(title, description)

    # 4. Similarity score
    similarity_score = _avg_similarity(raw_matches)

    # 5. Risk
    risk, risk_adjustment = evaluate_risk(priority, user_type)

    # 6. Confidence
    confidence = compute_confidence(
        classification_prob=classification_prob,
        similarity_score=similarity_score,
        historical_success=HISTORICAL_SUCCESS_RATE,
        risk_adjustment=risk_adjustment,
    )

    # 7. Decision
    action, reason = make_decision(confidence, risk)

    # 8. Add current ticket to index for future lookups
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
    )

    logger.info(
        f"Pipeline complete | ticket={ticket_id} confidence={confidence} "
        f"risk={risk} action={action}"
    )

    return ProcessTicketResponse(
        ticket_id=ticket_id,
        confidence=confidence,
        risk=risk,
        action=action,
        explanation=explanation,
    )
