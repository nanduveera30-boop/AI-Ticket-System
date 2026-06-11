from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from prometheus_fastapi_instrumentator import Instrumentator

from app.core.config import settings
from app.core.exceptions import (
    http_exception_handler,
    validation_exception_handler,
    unhandled_exception_handler,
)
from app.db.database import engine
from app.db.models import Base
from app.routes import tickets, metrics, auth
from app.routes.voice import router as voice_router
from app.routes.admin import router as admin_router
from app.routes.chat import router as chat_router
from app.routes.faq import router as faq_router
from app.services.embeddings import get_model
from app.services.rag import load_index, _save_index
from app.services.classifier import get_ticket_classifier, get_zero_shot_classifier
from app.services.voice import get_whisper_model
from app.utils.logger import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)

limiter = Limiter(key_func=get_remote_address, default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"])

from app.workers.tasks import auto_escalate_tickets
import asyncio

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("startup_begin", environment=settings.ENVIRONMENT)
    Base.metadata.create_all(bind=engine)
    load_index()
    get_model()
    get_ticket_classifier()
    get_zero_shot_classifier()
    get_whisper_model()
    escalate_task = asyncio.create_task(auto_escalate_tickets())
    logger.info("startup_complete")
    yield
    # Graceful shutdown — persist FAISS index
    try:
        _save_index()
        logger.info("faiss_index_saved_on_shutdown")
    except Exception as e:
        logger.error("faiss_shutdown_save_failed", error=str(e))
    escalate_task.cancel()
    logger.info("shutdown")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Production-grade RAG-powered support ticket triage with confidence scoring.",
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# GZip compression for responses > 1KB
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

Instrumentator().instrument(app).expose(app, endpoint="/metrics-prom", include_in_schema=False)

@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    import uuid
    import structlog
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(request_id=request_id)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response

from fastapi.staticfiles import StaticFiles
import os
os.makedirs("data/uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="data/uploads"), name="uploads")

app.include_router(auth.router)
app.include_router(tickets.router)
app.include_router(metrics.router)
app.include_router(voice_router)
app.include_router(admin_router)
app.include_router(chat_router)
app.include_router(faq_router)
