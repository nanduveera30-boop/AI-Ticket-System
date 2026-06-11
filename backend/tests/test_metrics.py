"""Tests for metrics and health endpoints."""


def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "database" in data


def test_metrics_requires_auth(client):
    res = client.get("/metrics")
    assert res.status_code == 401


def test_metrics(client, auth_headers):
    res = client.get("/metrics", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "total_tickets" in data
    assert "avg_confidence" in data
    assert "auto_resolved_pct" in data


def test_detailed_metrics(client, auth_headers):
    res = client.get("/metrics/detailed", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "priority_distribution" in data
    assert "faiss_index_size" in data
    assert "recent_decisions" in data
