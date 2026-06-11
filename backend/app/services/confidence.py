from app.utils.logger import get_logger

logger = get_logger(__name__)


def compute_confidence(
    classification_prob: float,
    similarity_score: float,
    historical_success: float,
    risk_adjustment: float,
) -> float:
    """
    Weighted confidence formula:
      0.35 * classification_prob
    + 0.35 * similarity_score
    + 0.20 * historical_success
    + 0.10 * risk_adjustment
    """
    confidence = (
        0.35 * classification_prob
        + 0.35 * similarity_score
        + 0.20 * historical_success
        + 0.10 * risk_adjustment
    )
    confidence = round(min(max(confidence, 0.0), 1.0), 6)
    logger.debug(
        f"Confidence computed: {confidence} "
        f"(cls={classification_prob}, sim={similarity_score}, "
        f"hist={historical_success}, risk_adj={risk_adjustment})"
    )
    return confidence
