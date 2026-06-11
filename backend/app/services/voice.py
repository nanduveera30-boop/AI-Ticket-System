"""
Voice Service
=============
Transcribes audio using OpenAI Whisper.
Extracts ticket fields using the zero-shot classifier (same model as AI pipeline)
for precise category detection — not just keyword matching.
"""

import io
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

import numpy as np
import whisper

from app.utils.logger import get_logger

logger = get_logger(__name__)

_whisper_model = None

# ── Priority keyword patterns (scored) ───────────────────────────────────────
PRIORITY_PATTERNS = {
    "P1": [
        "critical", "urgent", "emergency", "p1", "priority one", "priority 1",
        "system down", "outage", "production down", "cannot work", "completely broken",
        "not working at all", "total failure", "data loss", "security breach",
        "immediately", "asap", "right now", "right away", "down", "crashed",
    ],
    "P2": [
        "high", "important", "p2", "priority two", "priority 2", "broken",
        "failing", "not working", "error", "bug", "issue", "problem",
        "incorrect", "wrong", "failed", "crash", "crashing", "slow",
    ],
    "P3": [
        "low", "minor", "p3", "priority three", "priority 3", "question",
        "inquiry", "feature request", "suggestion", "improvement", "enhancement",
        "when possible", "no rush", "whenever", "nice to have", "wondering",
        "how do i", "how to", "what is", "can you", "please add", "would like",
        "export", "import", "dark mode",
    ],
}

VIP_KEYWORDS = ["vip", "enterprise", "premium", "executive", "key account", "platinum"]

# ── Ticket categories (for zero-shot) ────────────────────────────────────────
TICKET_CATEGORIES = [
    "Technical Issue",
    "Billing Question",
    "Account Access",
    "Feature Request",
    "General Inquiry",
]

# Category → icon mapping (sent to frontend)
CATEGORY_ICONS = {
    "Technical Issue":  "build",
    "Billing Question": "receipt_long",
    "Account Access":   "lock_person",
    "Feature Request":  "lightbulb",
    "General Inquiry":  "help_outline",
}


def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        # 'tiny' = fastest (39M params, ~1s on CPU), 'base' = balanced (74M, ~2s)
        # For production accuracy use 'small' (244M, ~5s)
        for model_size in ("tiny", "base"):
            try:
                logger.info("whisper_loading", model=model_size)
                _whisper_model = whisper.load_model(model_size)
                logger.info("whisper_loaded", model=model_size)
                break
            except Exception as e:
                logger.warning("whisper_load_failed", model=model_size, error=str(e))
    return _whisper_model


# ── Audio decoding ────────────────────────────────────────────────────────────

def _has_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None


def _decode_with_pyav(audio_bytes: bytes, file_ext: str = "webm") -> np.ndarray:
    """Decode any audio using PyAV (bundled ffmpeg — no system install needed)."""
    import av
    buf = io.BytesIO(audio_bytes)
    try:
        container = av.open(buf)
    except Exception:
        # Try with explicit format hint
        buf.seek(0)
        container = av.open(buf, format="webm")

    samples = []
    sr = 16000
    for stream in container.streams.audio:
        sr = stream.rate or 16000
        break

    for frame in container.decode(audio=0):
        arr = frame.to_ndarray()
        if arr.ndim > 1:
            arr = arr.mean(axis=0)
        arr = arr.astype(np.float32)
        # Normalize int16 PCM
        if arr.max() > 1.5:
            arr = arr / 32768.0
        samples.append(arr)

    container.close()

    if not samples:
        return np.zeros(16000, dtype=np.float32)

    audio = np.concatenate(samples)

    # Resample to 16kHz
    if sr and int(sr) != 16000:
        from scipy.signal import resample_poly
        from math import gcd
        g = gcd(int(sr), 16000)
        audio = resample_poly(audio, 16000 // g, int(sr) // g).astype(np.float32)

    return audio


def _decode_with_soundfile(audio_bytes: bytes) -> np.ndarray:
    import soundfile as sf
    buf = io.BytesIO(audio_bytes)
    data, sr = sf.read(buf, dtype="float32", always_2d=False)
    if data.ndim > 1:
        data = data.mean(axis=1)
    if sr != 16000:
        from scipy.signal import resample_poly
        from math import gcd
        g = gcd(sr, 16000)
        data = resample_poly(data, 16000 // g, sr // g).astype(np.float32)
    return data


def transcribe_audio(audio_bytes: bytes, file_ext: str = "webm") -> str:
    """
    Transcribe audio bytes → text using Whisper.
    Uses PyAV for decoding (no system ffmpeg needed).
    """
    model = get_whisper_model()

    # Strategy 1: PyAV (primary — handles webm/opus natively)
    try:
        audio = _decode_with_pyav(audio_bytes, file_ext)
        result = model.transcribe(
            audio,
            language="en",
            fp16=False,
            temperature=0.0,   # deterministic — no sampling overhead
            best_of=1,
            beam_size=1,       # greedy decode — 3x faster than beam_size=5
            condition_on_previous_text=False,
        )
        transcript = result["text"].strip()
        logger.info("transcription_complete", method="pyav", length=len(transcript))
        return transcript
    except Exception as e:
        logger.warning("pyav_decode_failed", error=str(e))

    # Strategy 2: system ffmpeg
    if _has_ffmpeg():
        try:
            with tempfile.NamedTemporaryFile(suffix=f".{file_ext}", delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name
            result = model.transcribe(tmp_path, language="en", fp16=False, temperature=0.0, beam_size=5)
            Path(tmp_path).unlink(missing_ok=True)
            transcript = result["text"].strip()
            logger.info("transcription_complete", method="ffmpeg", length=len(transcript))
            return transcript
        except Exception as e:
            logger.warning("ffmpeg_decode_failed", error=str(e))

    # Strategy 3: soundfile for wav/ogg
    if file_ext in ("wav", "ogg", "flac"):
        try:
            audio = _decode_with_soundfile(audio_bytes)
            result = model.transcribe(audio, language="en", fp16=False, temperature=0.0)
            transcript = result["text"].strip()
            logger.info("transcription_complete", method="soundfile", length=len(transcript))
            return transcript
        except Exception as e:
            logger.warning("soundfile_decode_failed", error=str(e))

    logger.error("all_decode_strategies_failed")
    return ""


# ── Smart field extraction ────────────────────────────────────────────────────

def _detect_priority(text_lower: str) -> str:
    """Score-based priority detection."""
    scores = {"P1": 0, "P2": 0, "P3": 0}
    for priority, keywords in PRIORITY_PATTERNS.items():
        for kw in keywords:
            if kw in text_lower:
                scores[priority] += 1
    if scores["P1"] > 0:
        return "P1"
    if scores["P2"] >= scores["P3"]:
        return "P2"
    return "P3"


def _detect_category_ai(transcript: str) -> tuple[str, float]:
    """
    Use the zero-shot classifier for precise category detection.
    Falls back to keyword matching if confidence < 40% or classifier unavailable.
    """
    try:
        from app.services.classifier import get_zero_shot_classifier
        clf = get_zero_shot_classifier()
        result = clf(
            transcript,
            candidate_labels=TICKET_CATEGORIES,
            hypothesis_template="This support ticket is about {}.",
        )
        top_label = result["labels"][0]
        top_score = float(result["scores"][0])

        # If AI confidence is low, blend with keyword detection
        if top_score < 0.40:
            kw_cat = _detect_category_keywords(transcript.lower())
            logger.info("voice_category_low_confidence_fallback",
                        ai_cat=top_label, ai_score=round(top_score, 3), kw_cat=kw_cat)
            # Use keyword result but keep AI score for display
            return kw_cat, top_score

        logger.info("voice_category_detected", category=top_label, score=round(top_score, 3))
        return top_label, top_score
    except Exception as e:
        logger.warning("ai_category_detection_failed", error=str(e))
        kw_cat = _detect_category_keywords(transcript.lower())
        return kw_cat, 0.5


def _detect_category_keywords(text_lower: str) -> str:
    """Keyword fallback for category detection."""
    patterns = {
        "Technical Issue":  [
            "error", "bug", "crash", "not working", "broken", "slow", "wifi",
            "network", "install", "app", "login failed", "500", "404", "down",
            "outage", "system", "server", "database", "connection", "timeout",
            "freeze", "blank", "screen", "software", "hardware", "update",
        ],
        "Billing Question": [
            "billing", "invoice", "charge", "payment", "refund", "subscription",
            "price", "cost", "overcharged", "charged twice", "credit card",
            "debit", "transaction", "receipt", "cancel", "renewal", "discount",
        ],
        "Account Access":   [
            "login", "password", "locked", "access", "sign in", "2fa",
            "authentication", "account", "username", "email", "reset",
            "forgot", "unauthorized", "permission", "role",
        ],
        "Feature Request":  [
            "feature", "request", "suggestion", "improve", "add", "would like",
            "enhancement", "dark mode", "export", "import", "integration",
            "new", "wish", "want", "could you", "please add",
        ],
        "General Inquiry":  [
            "question", "how do i", "how to", "what is", "can you",
            "help me", "information", "wondering", "curious", "explain",
        ],
    }
    scores = {cat: sum(1 for kw in kws if kw in text_lower) for cat, kws in patterns.items()}
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "General Inquiry"


def _build_title(transcript: str) -> str:
    """
    Build a clean, concise title from the transcript.
    Strips filler words, takes first meaningful sentence, caps at 80 chars.
    """
    # Remove leading filler words
    cleaned = re.sub(
        r"^(um+|uh+|so+|well+|okay+|ok+|hi+|hello+|hey+|yeah+|yes+|no+|like+)[,\s]+",
        "", transcript.strip(), flags=re.IGNORECASE
    )
    # Remove "I want to report that", "I'm calling about", etc.
    cleaned = re.sub(
        r"^(i('m| am) (calling|writing|reporting|contacting) (about|because|to report|to say)|"
        r"i want to (report|say|tell you|let you know) (that )?|"
        r"i have (a|an) (issue|problem|question|concern) (with |about )?)",
        "", cleaned, flags=re.IGNORECASE
    ).strip()

    # Take first sentence
    sentences = re.split(r"[.!?]", cleaned)
    first = sentences[0].strip() if sentences else cleaned

    # If too short, use more
    if len(first) < 8 and len(cleaned) > 8:
        first = cleaned[:80]

    # If too long, take first 10 words
    if len(first) > 80:
        words = first.split()
        first = " ".join(words[:10])

    # Capitalize
    title = first.strip()
    if title:
        title = title[0].upper() + title[1:]

    return title[:255] if title else "Support Request"


def extract_ticket_fields(transcript: str) -> dict:
    """
    AI-powered field extraction from voice transcript.

    Uses:
    - Whisper for transcription
    - facebook/bart-large-mnli (zero-shot) for category detection
    - Keyword scoring for priority
    - Smart title generation

    Returns:
        title, description, priority, user_type, category, category_confidence
    """
    if not transcript or not transcript.strip():
        return {
            "title": "Support Request",
            "description": "Voice input received — please add details.",
            "priority": "P2",
            "user_type": "STANDARD",
            "category": "General Inquiry",
            "category_confidence": 0.0,
        }

    text_lower = transcript.lower()

    title    = _build_title(transcript)
    priority = _detect_priority(text_lower)
    user_type = "VIP" if any(kw in text_lower for kw in VIP_KEYWORDS) else "STANDARD"

    # AI-powered category detection
    category, cat_confidence = _detect_category_ai(transcript)

    # Description — full transcript
    description = transcript.strip()
    if len(description) < 10:
        description = f"{transcript.strip()} — submitted via voice input"

    logger.info(
        "fields_extracted",
        title=title,
        priority=priority,
        category=category,
        cat_confidence=round(cat_confidence, 3),
        user_type=user_type,
    )

    return {
        "title":               title,
        "description":         description,
        "priority":            priority,
        "user_type":           user_type,
        "category":            category,
        "category_confidence": round(cat_confidence, 3),
    }
