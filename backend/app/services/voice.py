"""
Voice Service
=============
Transcribes audio using OpenAI Whisper (whisper-base, CPU-only, ~150MB).
Extracts ticket fields from the transcript using rule-based NLP.

No API keys needed — runs fully offline after first model download.
"""

import re
import tempfile
from pathlib import Path
from typing import Optional

import whisper
import numpy as np

from app.utils.logger import get_logger

logger = get_logger(__name__)

_whisper_model = None

# Priority keywords
PRIORITY_PATTERNS = {
    "P1": ["critical", "urgent", "emergency", "p1", "priority one", "down", "outage", "production"],
    "P2": ["high", "important", "p2", "priority two", "broken", "failing"],
    "P3": ["low", "minor", "p3", "priority three", "question", "inquiry", "feature"],
}

VIP_KEYWORDS = ["vip", "enterprise", "premium", "executive", "key account"]


def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        logger.info("whisper_loading", model="base")
        _whisper_model = whisper.load_model("base")   # ~150MB, CPU-friendly
        logger.info("whisper_loaded", model="base")
    return _whisper_model


def transcribe_audio(audio_bytes: bytes, file_ext: str = "webm") -> str:
    """
    Transcribe raw audio bytes to text using Whisper.
    Supports: webm, wav, mp3, m4a, ogg
    """
    model = get_whisper_model()

    with tempfile.NamedTemporaryFile(suffix=f".{file_ext}", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        result = model.transcribe(tmp_path, language="en", fp16=False)
        transcript = result["text"].strip()
        logger.info("transcription_complete", length=len(transcript))
        return transcript
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def extract_ticket_fields(transcript: str) -> dict:
    """
    Extract ticket fields from a voice transcript.

    Heuristics:
    - Title: first sentence or first 10 words
    - Description: full transcript
    - Priority: keyword matching
    - User type: VIP keyword detection
    """
    text_lower = transcript.lower()

    # Title — first sentence, max 80 chars
    sentences = re.split(r"[.!?]", transcript)
    title = sentences[0].strip()[:80] if sentences else transcript[:80]
    if len(title) < 5:
        title = transcript[:80]

    # Priority detection
    priority = "P2"  # default
    for p, keywords in PRIORITY_PATTERNS.items():
        if any(kw in text_lower for kw in keywords):
            priority = p
            break

    # User type detection
    user_type = "VIP" if any(kw in text_lower for kw in VIP_KEYWORDS) else "STANDARD"

    # Description — full transcript, min 10 chars
    description = transcript.strip()
    if len(description) < 10:
        description = f"{transcript.strip()} - submitted via voice"

    return {
        "title":       title,
        "description": description,
        "priority":    priority,
        "user_type":   user_type,
    }
