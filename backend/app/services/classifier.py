"""
Ticket Classifier Service
=========================
Fast keyword-based classification as primary (0ms).
BART zero-shot as fallback only when keyword confidence is low.

Financial category uses instant keyword mapping — no model call needed.
"""

import re
from functools import lru_cache
from pathlib import Path
from app.utils.logger import get_logger

logger = get_logger(__name__)

MODEL_DIR = Path(__file__).parent.parent.parent / "models" / "ticket_classifier"

# ── Category resolvability weights ───────────────────────────────────────────
CATEGORY_RESOLVABILITY = {
    "Billing Question": 0.85,
    "Technical Issue":  0.75,
    "General Inquiry":  0.70,
    "Feature Request":  0.40,
    "Account Access":   0.65,
    "Other":            0.55,
}

# ── Keyword scoring maps ──────────────────────────────────────────────────────
TICKET_KEYWORDS: dict[str, list[str]] = {
    "Technical Issue": [
        "error", "bug", "crash", "crashing", "not working", "broken", "slow",
        "wifi", "network", "internet", "connection", "timeout", "install",
        "installation", "update", "upgrade", "download", "app", "application",
        "software", "hardware", "device", "server", "database", "api",
        "integration", "sync", "performance", "freeze", "frozen", "blank",
        "white screen", "black screen", "500", "404", "502", "503", "outage",
        "down", "offline", "failed to load", "cannot connect", "login error",
        "authentication error", "access denied", "403", "401", "500 error",
    ],
    "Billing Question": [
        "billing", "invoice", "charge", "charged", "payment", "refund",
        "subscription", "plan", "price", "pricing", "cost", "fee",
        "overcharged", "double charged", "credit card", "debit", "transaction",
        "receipt", "cancel", "cancellation", "renewal", "auto-renew",
        "discount", "coupon", "promo", "upgrade plan", "downgrade",
        "money", "paid", "bill", "statement", "account balance",
    ],
    "Account Access": [
        "login", "log in", "sign in", "password", "reset password",
        "forgot password", "locked out", "account locked", "cannot access",
        "access denied", "two factor", "2fa", "authentication", "username",
        "email change", "account suspended", "banned", "permissions",
        "role", "admin access", "unauthorized", "verify", "verification",
        "otp", "code", "account recovery",
    ],
    "Feature Request": [
        "feature", "request", "suggestion", "improve", "improvement",
        "add", "would like", "wish", "want", "need a way", "it would be great",
        "enhancement", "new functionality", "capability", "option", "setting",
        "dark mode", "export", "import", "integration with", "please add",
        "could you add", "can you add", "would be nice", "missing feature",
    ],
    "General Inquiry": [
        "question", "how do i", "how to", "what is", "can you", "is it possible",
        "wondering", "curious", "information", "help me understand", "explain",
        "documentation", "guide", "tutorial", "support", "assistance",
        "inquiry", "asking about", "want to know", "need help with",
    ],
}

# ── Financial domain keyword mapping (instant, no model) ─────────────────────
FINANCIAL_KEYWORDS: dict[str, list[str]] = {
    "credit card or prepaid card": [
        "credit card", "debit card", "prepaid card", "card", "visa", "mastercard",
        "amex", "american express", "card number", "cvv", "expiry",
    ],
    "bank account or services": [
        "bank", "account", "transfer", "wire", "ach", "direct deposit",
        "checking", "savings", "balance", "statement", "overdraft",
    ],
    "theft or dispute reporting": [
        "fraud", "stolen", "theft", "dispute", "unauthorized", "chargeback",
        "scam", "hack", "compromised", "suspicious", "report",
    ],
    "mortgage or loan": [
        "mortgage", "loan", "refinance", "interest rate", "payment plan",
        "installment", "emi", "debt", "borrow", "lend",
    ],
    "investments or retirement": [
        "invest", "investment", "stock", "portfolio", "retirement", "401k",
        "ira", "pension", "dividend", "fund", "mutual fund",
    ],
}

_zero_shot_classifier = None


def _model_is_trained() -> bool:
    return (MODEL_DIR / "config.json").exists()


def get_zero_shot_classifier():
    """Lazy-load BART zero-shot — only used as fallback."""
    global _zero_shot_classifier
    if _zero_shot_classifier is None:
        from transformers import pipeline
        from app.core.config import settings
        model_name = settings.ZERO_SHOT_MODEL
        logger.info("zero_shot_loading", model=model_name)
        _zero_shot_classifier = pipeline(
            "zero-shot-classification",
            model=model_name,
            device=-1,
        )
        logger.info("zero_shot_loaded", model=model_name)
    return _zero_shot_classifier


def get_ticket_classifier():
    """Return trained DistilBERT if available, else None (keyword fallback used)."""
    if not _model_is_trained():
        return None
    try:
        from transformers import pipeline
        import json
        clf = pipeline(
            "text-classification",
            model=str(MODEL_DIR),
            tokenizer=str(MODEL_DIR),
            device=-1,
            truncation=True,
            max_length=128,
        )
        logger.info("classifier_loaded_local", path=str(MODEL_DIR))
        return clf
    except Exception as e:
        logger.warning("classifier_load_failed", error=str(e))
        return None


# ── Fast keyword classifier ───────────────────────────────────────────────────
@lru_cache(maxsize=256)
def _keyword_classify(text_lower: str) -> tuple[str, float]:
    """
    Score-based keyword classification. Returns (label, confidence).
    Confidence = normalized score (0.5 min to distinguish from random).
    """
    scores: dict[str, int] = {cat: 0 for cat in TICKET_KEYWORDS}
    for cat, keywords in TICKET_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                # Longer keyword matches = higher weight
                scores[cat] += len(kw.split())

    total = sum(scores.values())
    if total == 0:
        return "General Inquiry", 0.50

    best_cat = max(scores, key=scores.get)
    best_score = scores[best_cat]
    # Normalize: confidence between 0.55 and 0.95
    confidence = min(0.55 + (best_score / max(total, 1)) * 0.40, 0.95)
    return best_cat, round(confidence, 4)


@lru_cache(maxsize=256)
def _keyword_financial(text_lower: str) -> tuple[str, float]:
    """Instant financial category from keywords."""
    scores: dict[str, int] = {cat: 0 for cat in FINANCIAL_KEYWORDS}
    for cat, keywords in FINANCIAL_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                scores[cat] += 1

    best = max(scores, key=scores.get)
    if scores[best] == 0:
        # Default based on ticket category context
        return "bank account or services", 0.40
    confidence = min(0.50 + scores[best] * 0.10, 0.90)
    return best, round(confidence, 4)


# ── Public API ────────────────────────────────────────────────────────────────
def classify_ticket(title: str, description: str) -> dict:
    """
    Classify ticket category.

    Priority:
    1. Trained DistilBERT (~50ms) — if model exists
    2. Keyword scoring (~0ms) — fast, accurate for clear cases
    3. BART zero-shot (~3-19s) — only if keyword confidence < 0.60

    Returns: {label, score, resolvability, source}
    """
    text = f"{title}. {description}".lower()[:512]

    # 1. Try trained model first
    clf = get_ticket_classifier()
    if clf is not None:
        try:
            result = clf(f"{title}. {description}"[:512])[0]
            label = result["label"]
            score = float(result["score"])
            resolvability = CATEGORY_RESOLVABILITY.get(label, 0.60)
            logger.info("ticket_classified", label=label, score=round(score, 4), source="local_model")
            return {"label": label, "score": score, "resolvability": resolvability, "source": "local_model"}
        except Exception as e:
            logger.warning("local_model_classify_failed", error=str(e))

    # 2. Keyword scoring (instant)
    kw_label, kw_conf = _keyword_classify(text)

    # If keyword confidence is high enough, use it directly
    if kw_conf >= 0.60:
        resolvability = CATEGORY_RESOLVABILITY.get(kw_label, 0.60)
        logger.info("ticket_classified", label=kw_label, score=round(kw_conf, 4), source="keyword")
        return {"label": kw_label, "score": kw_conf, "resolvability": resolvability, "source": "keyword"}

    # 3. BART zero-shot only for ambiguous cases (low keyword confidence)
    try:
        zs = get_zero_shot_classifier()
        labels = list(CATEGORY_RESOLVABILITY.keys())
        result = zs(f"{title}. {description}"[:512], candidate_labels=labels)
        label = result["labels"][0]
        score = float(result["scores"][0])
        resolvability = CATEGORY_RESOLVABILITY.get(label, 0.60)
        logger.info("ticket_classified", label=label, score=round(score, 4), source="zero_shot")
        return {"label": label, "score": score, "resolvability": resolvability, "source": "zero_shot"}
    except Exception as e:
        logger.warning("zero_shot_classify_failed", error=str(e))
        # Final fallback: use keyword result regardless of confidence
        resolvability = CATEGORY_RESOLVABILITY.get(kw_label, 0.60)
        return {"label": kw_label, "score": kw_conf, "resolvability": resolvability, "source": "keyword_fallback"}


def classify_financial_category(title: str, description: str) -> dict:
    """
    Instant financial domain classification via keyword mapping.
    No model call — returns in < 1ms.
    """
    text = f"{title}. {description}".lower()[:512]
    category, score = _keyword_financial(text)
    logger.info("financial_category_classified", category=category, score=score, source="keyword")
    return {"category": category, "score": score}
