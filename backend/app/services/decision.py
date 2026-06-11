from app.core.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)


def make_decision(confidence: float, risk: str) -> tuple[str, str]:
    """
    Decision rules:
      confidence > THRESHOLD AND risk == LOW  → AUTO_RESOLVE
      confidence > 0.6                        → SUGGEST
      else                                    → ESCALATE

    Returns (action, reason).
    """
    threshold = settings.CONFIDENCE_THRESHOLD

    if confidence > threshold and risk == "LOW":
        action = "AUTO_RESOLVE"
        reason = (
            f"Confidence {confidence:.4f} exceeds threshold {threshold} "
            f"and risk is LOW. Safe to auto-resolve."
        )
    elif confidence > 0.6:
        action = "SUGGEST"
        reason = (
            f"Confidence {confidence:.4f} is moderate (>0.6). "
            f"Suggesting resolution for human review."
        )
    else:
        action = "ESCALATE"
        reason = (
            f"Confidence {confidence:.4f} is too low or risk is HIGH. "
            f"Escalating to human agent."
        )

    logger.info(f"Decision: {action} | {reason}")
    return action, reason
