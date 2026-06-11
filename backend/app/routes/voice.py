"""
Voice Route
===========
POST /voice/transcribe   — transcribe audio, return text only
POST /voice/process      — transcribe + run full AI pipeline, return ticket result
"""

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, BackgroundTasks, Request
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db.database import get_db
from app.db.models import Ticket
from app.services.voice import transcribe_audio, extract_ticket_fields
from app.services.ai_pipeline import run_pipeline
from app.workers.tasks import persist_prediction, persist_audit_log
from app.core.security import get_current_user
from app.schemas.ticket import ProcessTicketResponse
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/voice", tags=["voice"])
limiter = Limiter(key_func=get_remote_address)

ALLOWED_TYPES = {
    "audio/webm", "audio/webm;codecs=opus", "audio/webm;codecs=vp8",
    "audio/wav", "audio/wave", "audio/x-wav",
    "audio/mpeg", "audio/mp3", "audio/mp4",
    "audio/ogg", "audio/ogg;codecs=opus",
    "audio/x-m4a", "audio/aac",
}
MAX_SIZE_MB = 10


def _validate_audio(file: UploadFile) -> None:
    # Strip codec params for comparison: "audio/webm;codecs=opus" → "audio/webm"
    ct = (file.content_type or "").split(";")[0].strip().lower()
    base_allowed = {t.split(";")[0].strip() for t in ALLOWED_TYPES}
    if ct and ct not in base_allowed and ct != "application/octet-stream":
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported audio format: {file.content_type}. Supported: webm, wav, mp3, ogg, m4a",
        )


def _get_extension(file: UploadFile) -> str:
    if file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower()
        if ext in ("webm", "wav", "mp3", "ogg", "m4a", "mp4", "aac"):
            return ext
    ct = (file.content_type or "").lower()
    if "wav" in ct:                    return "wav"
    if "mpeg" in ct or "mp3" in ct:    return "mp3"
    if "ogg" in ct:                    return "ogg"
    if "m4a" in ct or "aac" in ct:     return "m4a"
    if "mp4" in ct:                    return "mp4"
    return "webm"  # default — Chrome/Firefox record as webm


@router.post("/transcribe")
@limiter.limit("10/minute")
async def transcribe(
    request: Request,
    audio: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Transcribe audio and return extracted ticket fields — no DB write."""
    _validate_audio(audio)
    audio_bytes = await audio.read()

    if len(audio_bytes) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Audio file exceeds {MAX_SIZE_MB}MB limit")
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")

    ext = _get_extension(audio)
    transcript = transcribe_audio(audio_bytes, ext)

    if not transcript:
        raise HTTPException(
            status_code=422,
            detail="Could not transcribe audio. Install ffmpeg for best results: https://ffmpeg.org/download.html"
        )

    fields = extract_ticket_fields(transcript)
    logger.info("voice_transcribed", actor=current_user["username"], length=len(transcript))

    return {
        "transcript": transcript,
        "extracted_fields": fields,
    }


@router.post("/process", response_model=ProcessTicketResponse)
@limiter.limit("5/minute")
async def voice_process(
    request: Request,
    audio: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Full voice-to-ticket pipeline:
    1. Transcribe audio
    2. Extract ticket fields
    3. Run AI pipeline
    4. Persist ticket + prediction + audit log
    5. Return full result with confidence breakdown
    """
    _validate_audio(audio)
    audio_bytes = await audio.read()

    if len(audio_bytes) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Audio file exceeds {MAX_SIZE_MB}MB limit")
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")

    ext = _get_extension(audio)
    transcript = transcribe_audio(audio_bytes, ext)

    if not transcript:
        raise HTTPException(status_code=422, detail="Could not transcribe audio — please speak clearly")

    fields = extract_ticket_fields(transcript)

    # Persist ticket
    ticket = Ticket(
        title=fields["title"],
        description=fields["description"],
        priority=fields["priority"],
        user_type=fields["user_type"],
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    # Run AI pipeline
    result = run_pipeline(
        ticket_id=ticket.id,
        title=ticket.title,
        description=ticket.description,
        priority=ticket.priority,
        user_type=ticket.user_type,
    )

    input_text = f"{ticket.title}. {ticket.description}"
    background_tasks.add_task(persist_prediction, db, result)
    background_tasks.add_task(persist_audit_log, db, result, input_text, current_user["username"])

    logger.info(
        "voice_ticket_processed",
        ticket_id=ticket.id,
        confidence=result.confidence,
        action=result.action,
        actor=current_user["username"],
    )
    return result
