"""
RAG service — FAISS vector store with disk persistence.
Index is saved to FAISS_INDEX_PATH on every write so it survives restarts.
"""

import json
import os
from pathlib import Path
from typing import List, Tuple

import faiss
import numpy as np

from app.core.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)

EMBEDDING_DIM = 384  # all-MiniLM-L6-v2

_index: faiss.IndexFlatIP | None = None
_metadata: List[dict] = []


def _index_path() -> Path:
    return Path(settings.FAISS_INDEX_PATH)


def _meta_path() -> Path:
    return Path(settings.FAISS_META_PATH)


def load_index() -> None:
    """Load FAISS index and metadata from disk if they exist."""
    global _index, _metadata
    idx_path = _index_path()
    meta_path = _meta_path()

    if idx_path.exists() and meta_path.exists():
        try:
            _index = faiss.read_index(str(idx_path))
            with open(meta_path, "r") as f:
                _metadata = json.load(f)
            logger.info("faiss_index_loaded", total=_index.ntotal, path=str(idx_path))
            return
        except Exception as e:
            logger.warning("faiss_load_failed", error=str(e))

    _index = faiss.IndexFlatIP(EMBEDDING_DIM)
    _metadata = []
    logger.info("faiss_index_initialized_fresh")


def _save_index() -> None:
    """Persist index and metadata to disk."""
    try:
        idx_path = _index_path()
        idx_path.parent.mkdir(parents=True, exist_ok=True)
        faiss.write_index(_index, str(idx_path))
        with open(_meta_path(), "w") as f:
            json.dump(_metadata, f)
    except Exception as e:
        logger.error("faiss_save_failed", error=str(e))


def _get_index() -> faiss.IndexFlatIP:
    global _index
    if _index is None:
        load_index()
    return _index


def add_to_index(ticket_id: int, title: str, description: str, embedding: np.ndarray) -> None:
    index = _get_index()
    vec = embedding.reshape(1, -1).astype(np.float32)
    index.add(vec)
    _metadata.append({"ticket_id": ticket_id, "title": title, "description": description})
    _save_index()
    logger.info("faiss_ticket_added", ticket_id=ticket_id, total=index.ntotal)


def search_similar(embedding: np.ndarray, top_k: int = 3) -> List[Tuple[int, str, float]]:
    index = _get_index()
    if index.ntotal == 0:
        return []

    k = min(top_k, index.ntotal)
    vec = embedding.reshape(1, -1).astype(np.float32)
    scores, indices = index.search(vec, k)

    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx == -1:
            continue
        meta = _metadata[idx]
        results.append((meta["ticket_id"], meta["title"], float(score)))
    return results


def index_size() -> int:
    return _get_index().ntotal
