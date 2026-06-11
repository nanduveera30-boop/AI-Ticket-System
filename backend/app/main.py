from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import engine
from app.db.models import Base
from app.routes import tickets, metrics
from app.services.embeddings import get_model
from app.utils.logger import get_logger

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables and warm up the embedding model
    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Warming up embedding model...")
    get_model()
    logger.info("Application ready.")
    yield
    logger.info("Application shutting down.")


app = FastAPI(
    title="Confidence-Governed AI Ticket Resolution System",
    version="1.0.0",
    description="RAG-powered support ticket triage with confidence scoring and explainability.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tickets.router)
app.include_router(metrics.router)
