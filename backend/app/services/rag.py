import numpy as np
import faiss
from typing import List, Tuple
from app.utils.logger import get_logger

logger = get_logger(__name__)

# In-memory FAISS index and metadata store
_index: faiss.IndexFlatIP | None = None
_metadata: List[dict] = []   # [{ticket_id, title, description}]
EMBEDDING_DIM = 384           # all-MiniLM-L6-v2 output dim


def _get_index() -> faiss.IndexFlatIP:
    global _index
    if _index is None:
        _index = faiss.IndexFlatIP(EMBEDDING_DIM)  # Inner product = cosine on normalized vecs
        logger.info("FAISS index initialized.")
    return _index


def add_to_index(ticket_id: int, title: str, description: str, embedding: np.ndarray) -> None:
    """Add a ticket embedding to the FAISS index."""
    index = _get_index()
    vec = embedding.reshape(1, -1).astype(np.float32)
    index.add(vec)
    _metadata.append({"ticket_id": ticket_id, "title": title, "description": description})
    logger.info(f"Ticket {ticket_id} added to FAISS index. Total: {index.ntotal}")


def search_similar(embedding: np.ndarray, top_k: int = 3) -> List[Tuple[int, str, float]]:
    """
    Search for top_k similar tickets.
    Returns list of (ticket_id, title, score).
    """
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
