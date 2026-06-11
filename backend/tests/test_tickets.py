"""Integration tests for ticket endpoints."""
import pytest


TICKET_PAYLOAD = {
    "title": "App crashes on startup",
    "description": "Application crashes immediately on launch with error code 0x80004005.",
    "priority": "P1",
    "user_type": "STANDARD",
}


def test_create_ticket(client, auth_headers):
    res = client.post("/tickets", json=TICKET_PAYLOAD, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == TICKET_PAYLOAD["title"]
    assert data["priority"] == "P1"
    assert "id" in data


def test_create_ticket_invalid_priority(client, auth_headers):
    bad = {**TICKET_PAYLOAD, "priority": "P9"}
    res = client.post("/tickets", json=bad, headers=auth_headers)
    assert res.status_code == 422


def test_create_ticket_short_description(client, auth_headers):
    bad = {**TICKET_PAYLOAD, "description": "short"}
    res = client.post("/tickets", json=bad, headers=auth_headers)
    assert res.status_code == 422


def test_get_ticket(client, auth_headers):
    create = client.post("/tickets", json=TICKET_PAYLOAD, headers=auth_headers)
    ticket_id = create.json()["id"]
    res = client.get(f"/tickets/{ticket_id}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["id"] == ticket_id


def test_get_ticket_not_found(client, auth_headers):
    res = client.get("/tickets/99999", headers=auth_headers)
    assert res.status_code == 404


def test_list_tickets(client, auth_headers):
    client.post("/tickets", json=TICKET_PAYLOAD, headers=auth_headers)
    res = client.get("/tickets", headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_list_tickets_filter_priority(client, auth_headers):
    res = client.get("/tickets?priority=P1", headers=auth_headers)
    assert res.status_code == 200
    for t in res.json():
        assert t["priority"] == "P1"


def test_process_ticket(client, auth_headers):
    res = client.post("/process-ticket", json=TICKET_PAYLOAD, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "confidence" in data
    assert "risk" in data
    assert data["action"] in ("AUTO_RESOLVE", "SUGGEST", "ESCALATE")
    assert "explanation" in data
    assert "ticket_category" in data["explanation"]
    assert "financial_category" in data["explanation"]
    assert 0.0 <= data["confidence"] <= 1.0


def test_process_ticket_vip_high_risk(client, auth_headers):
    payload = {**TICKET_PAYLOAD, "user_type": "VIP", "priority": "P1"}
    res = client.post("/process-ticket", json=payload, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["risk"] == "HIGH"


def test_audit_logs(client, auth_headers):
    client.post("/process-ticket", json=TICKET_PAYLOAD, headers=auth_headers)
    res = client.get("/audit-logs", headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)
