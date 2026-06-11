import numpy as np
from sentence_transformers import SentenceTransformer
from app.core.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)

# Load model once at module import — not per request
_model: SentenceTransformer | None = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        logger.info(f"Loading embedding model: {settings.MODEL_NAME}")
        _model = SentenceTransformer(settings.MODEL_NAME)
        logger.info("Embedding model loaded.")
    return _model


def generate_embedding(text: str) -> np.ndarray:
    """Generate a normalized L2 embedding vector for the given text."""
    model = get_model()
    embedding = model.encode(text, normalize_embeddings=True)
    return embedding.astype(np.float32)
