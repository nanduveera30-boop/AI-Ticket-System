"""
Ticket Classifier Service
=========================
Loads YOUR locally trained DistilBERT model from models/ticket_classifier/.

If you haven't trained yet, run:
    python scripts/train_classifier.py

The model is trained on data/training_data.csv using distilbert-base-uncased
fine-tuned on 4 support ticket categories:
  - Billing Question
  - Technical Issue
  - General Inquiry
  - Feature Request

For financial domain sub-classification (matching the notebook's dataset),
we use zero-shot NLI with facebook/bart-large-mnli — no training needed.
"""

import json
from pathlib import Path
from transformers import pipeline
from app.core.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)

MODEL_DIR  = Path(__file__).parent.parent.parent / "models" / "ticket_classifier"
LABEL_MAP  = Path(__file__).parent.parent.parent / "models" / "label_map.json"

# Financial domain categories — from the notebook's complaint dataset
FINANCIAL_CATEGORIES = [
    "credit card or prepaid card",
    "bank account or services",
    "theft or dispute reporting",
    "mortgage or loan",
    "investments or retirement",
]

# How auto-resolvable each category is (used in confidence formula)
CATEGORY_RESOLVABILITY = {
    "Billing Question": 0.85,
    "Technical Issue":  0.75,
    "General Inquiry":  0.70,
    "Feature Request":  0.40,
}

_ticket_classifier   = None
_zero_shot_classifier = None


def _model_is_trained() -> bool:
    """Check if the locally trained model exists."""
    return (MODEL_DIR / "config.json").exists()


def get_ticket_classifier():
    global _ticket_classifier
    if _ticket_classifier is not None:
        return _ticket_classifier

    if _model_is_trained():
        logger.info("classifier_loading_local", path=str(MODEL_DIR))
        _ticket_classifier = pipeline(
            "text-classification",
            model=str(MODEL_DIR),
            tokenizer=str(MODEL_DIR),
            device=-1,
            truncation=True,
            max_length=128,
        )
        # Load label map to verify
        if LABEL_MAP.exists():
            with open(LABEL_MAP) as f:
                meta = json.load(f)
            logger.info(
                "classifier_loaded_local",
                labels=list(meta["id2label"].values()),
                path=str(MODEL_DIR),
            )
    else:
        # Model not trained yet — warn and use base DistilBERT with zero-shot
        logger.warning(
            "local_model_not_found",
            hint="Run: python scripts/train_classifier.py",
            fallback="Using zero-shot classification as fallback",
        )
        _ticket_classifier = None  # handled in classify_ticket()

    return _ticket_classifier


def get_zero_shot_classifier():
    global _zero_shot_classifier
    if _zero_shot_classifier is None:
        model_name = settings.ZERO_SHOT_MODEL
        logger.info("zero_shot_loading", model=model_name)
        _zero_shot_classifier = pipeline(
            "zero-shot-classification",
            model=model_name,
            device=-1,
        )
        logger.info("zero_shot_loaded", model=model_name)
    return _zero_shot_classifier


# All 4 categories for zero-shot fallback
_FALLBACK_LABELS = list(CATEGORY_RESOLVABILITY.keys())


def classify_ticket(title: str, description: str) -> dict:
    """
    Classify ticket using YOUR trained DistilBERT model.
    Falls back to zero-shot if model hasn't been trained yet.

    Returns:
        {
            "label": "Technical Issue",
            "score": 0.9312,
            "resolvability": 0.75,
            "source": "local_model" | "zero_shot_fallback"
        }
    """
    text = f"{title}. {description}"[:512]
    clf = get_ticket_classifier()

    if clf is not None:
        # YOUR trained model
        result = clf(text)[0]
        label  = result["label"]
        score  = float(result["score"])
        source = "local_model"
    else:
        # Zero-shot fallback until model is trained
        zs = get_zero_shot_classifier()
        result = zs(text, candidate_labels=_FALLBACK_LABELS)
        label  = result["labels"][0]
        score  = float(result["scores"][0])
        source = "zero_shot_fallback"

    resolvability = CATEGORY_RESOLVABILITY.get(label, 0.60)

    logger.info(
        "ticket_classified",
        label=label,
        score=round(score, 4),
        resolvability=resolvability,
        source=source,
    )
    return {
        "label":         label,
        "score":         score,
        "resolvability": resolvability,
        "source":        source,
    }


def classify_financial_category(title: str, description: str) -> dict:
    """
    Zero-shot classification into financial domain categories.
    Matches the notebook's complaint dataset categories.

    Returns:
        {"category": "credit card or prepaid card", "score": 0.78}
    """
    text = f"{title}. {description}"[:512]
    clf  = get_zero_shot_classifier()
    result = clf(text, candidate_labels=FINANCIAL_CATEGORIES)

    top_label = result["labels"][0]
    top_score = float(result["scores"][0])

    logger.info(
        "financial_category_classified",
        category=top_label,
        score=round(top_score, 4),
    )
    return {"category": top_label, "score": top_score}
