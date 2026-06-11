"""
Embeddings Service
==================
sentence-transformers/all-MiniLM-L6-v2 — 384-dim, fast CPU inference.
LRU cache on generate_embedding to avoid re-encoding identical texts.
"""

import hashlib
from functools import lru_cache
import numpy as np
from sentence_transformers import SentenceTransformer
from app.core.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)

_model: SentenceTransformer | None = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        logger.info("embedding_model_loading", model=settings.MODEL_NAME)
        _model = SentenceTransformer(settings.MODEL_NAME)
        # Warm up with a dummy encode so first real request is fast
        _model.encode("warmup", normalize_embeddings=True)
        logger.info("embedding_model_loaded", model=settings.MODEL_NAME)
    return _model


@lru_cache(maxsize=512)
def _cached_encode(text: str) -> bytes:
    """Cache embeddings by text content (LRU, max 512 entries)."""
    model = get_model()
    vec = model.encode(text, normalize_embeddings=True).astype(np.float32)
    return vec.tobytes()


def generate_embedding(text: str) -> np.ndarray:
    """
    Generate a normalized L2 embedding vector.
    Results are LRU-cached — identical texts return instantly.
    """
    # Truncate to 512 chars for consistent cache keys and speed
    text = text.strip()[:512]
    raw = _cached_encode(text)
    return np.frombuffer(raw, dtype=np.float32).copy()
