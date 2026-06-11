from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"
    CONFIDENCE_THRESHOLD: float = 0.92

    class Config:
        env_file = ".env"


settings = Settings()
