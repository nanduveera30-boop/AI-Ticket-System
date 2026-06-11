from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Confidence-Governed AI Ticket Resolution System"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"  # development | staging | production
    DEBUG: bool = False

    # Database
    DATABASE_URL: str

    # AI Model
    MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"
    CLASSIFIER_MODEL: str = "Dragneel/ticket-classification-v1"
    ZERO_SHOT_MODEL: str = "facebook/bart-large-mnli"
    FAISS_INDEX_PATH: str = "data/faiss.index"
    FAISS_META_PATH: str = "data/faiss_meta.json"

    # Confidence
    CONFIDENCE_THRESHOLD: float = 0.92

    # Auth (JWT)
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 60

    # Gemini AI
    GEMINI_API_KEY: str = ""

    # CORS — comma-separated origins
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    class Config:
        env_file = ".env"

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
