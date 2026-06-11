"""
Test configuration — uses SQLite in-memory DB and mocks the AI models
so tests run fast on any machine without GPU or model downloads.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import patch, MagicMock
import numpy as np

from app.db.database import Base, get_db
from app.main import app

TEST_DB_URL = "sqlite:///./test.db"

engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="session")
def mock_models():
    """Mock all AI models so tests don't download anything."""
    fake_embedding = np.random.rand(384).astype(np.float32)

    with patch("app.services.embeddings.get_model") as mock_emb, \
         patch("app.services.classifier.get_ticket_classifier") as mock_clf, \
         patch("app.services.classifier.get_zero_shot_classifier") as mock_zs, \
         patch("app.services.rag.load_index"), \
         patch("app.services.rag._save_index"):

        mock_emb.return_value.encode = MagicMock(return_value=fake_embedding)

        mock_clf_pipeline = MagicMock()
        mock_clf_pipeline.return_value = [{"label": "Technical Issue", "score": 0.92}]
        mock_clf.return_value = mock_clf_pipeline

        mock_zs_pipeline = MagicMock()
        mock_zs_pipeline.return_value = {
            "labels": ["credit card or prepaid card"],
            "scores": [0.85],
        }
        mock_zs.return_value = mock_zs_pipeline

        yield


@pytest.fixture
def client(mock_models):
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(client):
    """Register + login, return Bearer headers."""
    client.post("/auth/register", json={
        "username": "testuser",
        "email": "test@example.com",
        "password": "testpass123",
        "role": "agent",
    })
    res = client.post("/auth/token", json={
        "username": "testuser",
        "password": "testpass123",
    })
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
