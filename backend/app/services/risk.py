from app.utils.logger import get_logger

logger = get_logger(__name__)

RISK_ADJUSTMENT_MAP = {
    "LOW": 0.2,
    "HIGH": 0.0,
}


def evaluate_risk(priority: str, user_type: str) -> tuple[str, float]:
    """
    Rules:
      - P1 priority → HIGH risk
      - VIP user    → HIGH risk
      - Otherwise   → LOW risk

    Returns (risk_label, risk_adjustment).
    """
    if priority == "P1" or user_type == "VIP":
        risk = "HIGH"
    else:
        risk = "LOW"

    adjustment = RISK_ADJUSTMENT_MAP[risk]
    logger.debug(f"Risk evaluated: {risk} (priority={priority}, user_type={user_type})")
    return risk, adjustment
