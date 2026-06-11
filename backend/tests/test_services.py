"""Unit tests for core AI services."""
import numpy as np
import pytest
from unittest.mock import patch, MagicMock

from app.services.confidence import compute_confidence
from app.services.risk import evaluate_risk
from app.services.decision import make_decision


# ── Confidence ────────────────────────────────────────────────────────────────
def test_confidence_formula():
    c = compute_confidence(
        classification_prob=0.9,
        similarity_score=0.8,
        historical_success=0.8,
        risk_adjustment=0.2,
    )
    expected = round(0.35*0.9 + 0.35*0.8 + 0.20*0.8 + 0.10*0.2, 6)
    assert c == expected


def test_confidence_clamped_to_1():
    c = compute_confidence(1.0, 1.0, 1.0, 1.0)
    assert c <= 1.0


def test_confidence_clamped_to_0():
    c = compute_confidence(0.0, 0.0, 0.0, 0.0)
    assert c >= 0.0


# ── Risk ──────────────────────────────────────────────────────────────────────
def test_risk_p1_is_high():
    risk, adj = evaluate_risk("P1", "STANDARD")
    assert risk == "HIGH"
    assert adj == 0.0


def test_risk_vip_is_high():
    risk, adj = evaluate_risk("P2", "VIP")
    assert risk == "HIGH"
    assert adj == 0.0


def test_risk_standard_p2_is_low():
    risk, adj = evaluate_risk("P2", "STANDARD")
    assert risk == "LOW"
    assert adj == 0.2


def test_risk_standard_p3_is_low():
    risk, adj = evaluate_risk("P3", "STANDARD")
    assert risk == "LOW"
    assert adj == 0.2


# ── Decision ──────────────────────────────────────────────────────────────────
def test_decision_auto_resolve():
    action, reason = make_decision(0.95, "LOW")
    assert action == "AUTO_RESOLVE"


def test_decision_suggest():
    action, reason = make_decision(0.75, "LOW")
    assert action == "SUGGEST"


def test_decision_escalate_low_confidence():
    action, reason = make_decision(0.4, "LOW")
    assert action == "ESCALATE"


def test_decision_escalate_high_risk():
    # Even with high confidence, HIGH risk should not auto-resolve
    action, reason = make_decision(0.95, "HIGH")
    assert action != "AUTO_RESOLVE"


def test_decision_suggest_high_risk_medium_conf():
    action, reason = make_decision(0.75, "HIGH")
    assert action == "SUGGEST"
