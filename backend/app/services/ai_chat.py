"""
AI Chat Service
===============
Groq (llama-3.3-70b) as primary — ~0.5s response time.
Gemini 2.0 Flash as fallback.
Smart rule-based responses as last resort.

All responses are context-aware: ticket title, description, category,
priority, AI decision, and full conversation history are injected.
"""

from typing import List
from app.core.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)

# ── Clients (lazy-loaded) ─────────────────────────────────────────────────────
_groq_client   = None
_gemini_client = None

SYSTEM_PROMPT = """You are ResolvAI, an expert customer support AI for a software company.

You have the customer's full ticket context and conversation history.

Your role:
1. Give helpful, accurate, empathetic responses
2. Provide specific troubleshooting steps when relevant
3. Escalate urgency when the customer indicates critical issues
4. Keep responses concise (2-4 sentences unless steps are needed)
5. Acknowledge frustration when present
6. Never make up information — say you'll escalate if unsure

Tone: Professional, warm, solution-focused. Never robotic or generic."""


def _get_groq():
    global _groq_client
    if _groq_client is None and settings.GROQ_API_KEY:
        try:
            from groq import Groq
            _groq_client = Groq(api_key=settings.GROQ_API_KEY)
            logger.info("groq_client_initialized")
        except Exception as e:
            logger.warning("groq_init_failed", error=str(e))
    return _groq_client


def _get_gemini():
    global _gemini_client
    if _gemini_client is None and settings.GEMINI_API_KEY:
        try:
            from google import genai
            _gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
            logger.info("gemini_client_initialized")
        except Exception as e:
            logger.warning("gemini_init_failed", error=str(e))
    return _gemini_client


# ── Rule-based fallback ───────────────────────────────────────────────────────
def _rule_based(ticket_title: str, ticket_desc: str, user_message: str, action: str = "") -> str:
    msg = user_message.lower()

    if any(w in msg for w in ["status", "update", "progress", "when", "how long", "any news"]):
        return (
            f"Your ticket '{ticket_title}' is being actively reviewed by our team. "
            "We typically respond within 2 business hours. "
            "I'll make sure you're notified as soon as there's an update."
        )
    if any(w in msg for w in ["urgent", "critical", "emergency", "asap", "immediately", "now"]):
        return (
            "I understand this is urgent — I'm escalating your ticket to our priority queue right now. "
            "A senior agent will contact you within 30 minutes. Please stay available on this chat."
        )
    if any(w in msg for w in ["thank", "thanks", "resolved", "fixed", "working", "solved", "great"]):
        return (
            "Wonderful, glad to hear that's resolved! I'll mark this ticket as resolved. "
            "Don't hesitate to reach out if anything else comes up — we're always here to help."
        )
    if any(w in msg for w in ["cancel", "refund", "charge", "billing", "invoice", "overcharged"]):
        return (
            "I understand your billing concern and I'm flagging this for our billing team immediately. "
            "You'll receive a response within 1 business hour with a full resolution."
        )
    if action == "AUTO_RESOLVE":
        return (
            f"Based on our AI analysis, your issue with '{ticket_title}' matches a known pattern "
            "with an available solution. Could you try the steps in the resolution summary? "
            "Let me know if that doesn't work and I'll connect you with a specialist right away."
        )
    if action == "ESCALATE":
        return (
            f"Your ticket regarding '{ticket_title}' has been escalated to our specialist team. "
            "A senior engineer will review this and contact you within 1 hour. "
            "Is there any additional context you'd like to add?"
        )
    return (
        f"Thank you for your message about '{ticket_title}'. "
        "I've noted your update and a support agent will follow up shortly. "
        "Can you provide any additional details that might help us resolve this faster?"
    )


# ── Groq (primary — llama-3.3-70b, ~0.5s) ────────────────────────────────────
def _call_groq(system: str, user: str) -> str:
    client = _get_groq()
    if not client:
        raise RuntimeError("Groq not configured")

    resp = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        max_tokens=300,
        temperature=0.4,
        top_p=0.9,
    )
    return resp.choices[0].message.content.strip()


# ── Gemini (fallback) ─────────────────────────────────────────────────────────
GEMINI_MODELS = ["gemini-2.0-flash-lite", "gemini-2.0-flash", "gemini-2.5-flash"]

def _call_gemini(prompt: str) -> str:
    client = _get_gemini()
    if not client:
        raise RuntimeError("Gemini not configured")

    last_err = None
    for model in GEMINI_MODELS:
        try:
            resp = client.models.generate_content(model=model, contents=prompt)
            return resp.text.strip()
        except Exception as e:
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                last_err = e
                continue
            raise
    raise last_err or RuntimeError("All Gemini models exhausted")


# ── Public API ────────────────────────────────────────────────────────────────
def generate_ai_response(
    ticket_title: str,
    ticket_description: str,
    ticket_category: str,
    ticket_priority: str,
    ai_action: str,
    ai_confidence: float,
    conversation_history: List[dict],
    user_message: str,
) -> str:
    """
    Generate a contextual AI response.
    Priority: Groq (fast) → Gemini (fallback) → rule-based (always works).
    """
    # Build context block
    ticket_ctx = (
        f"TICKET: {ticket_title}\n"
        f"Description: {ticket_description[:300]}\n"
        f"Category: {ticket_category} | Priority: {ticket_priority}\n"
        f"AI Decision: {ai_action} (confidence: {ai_confidence * 100:.0f}%)"
    )

    # Build conversation history (last 8 messages)
    history_lines = []
    for m in conversation_history[-8:]:
        role = "Customer" if m.get("sender_role") == "customer" else "ResolvAI"
        history_lines.append(f"{role}: {m.get('message', '')}")
    history_block = "\n".join(history_lines)

    # ── Try Groq first ────────────────────────────────────────────────────────
    try:
        system = f"{SYSTEM_PROMPT}\n\n{ticket_ctx}"
        user   = f"{history_block}\n\nCustomer: {user_message}" if history_block else f"Customer: {user_message}"
        text   = _call_groq(system, user)
        logger.info("ai_response_groq", length=len(text))
        return text
    except Exception as e:
        logger.warning("groq_failed", error=str(e)[:100])

    # ── Try Gemini ────────────────────────────────────────────────────────────
    try:
        prompt = f"{SYSTEM_PROMPT}\n\n{ticket_ctx}\n\n{history_block}\n\nCustomer: {user_message}\n\nResolvAI:"
        text   = _call_gemini(prompt)
        logger.info("ai_response_gemini", length=len(text))
        return text
    except Exception as e:
        logger.warning("gemini_failed", error=str(e)[:100])

    # ── Rule-based fallback ───────────────────────────────────────────────────
    logger.info("ai_response_rule_based")
    return _rule_based(ticket_title, ticket_description, user_message, ai_action)


def generate_ticket_explanation(
    ticket_title: str,
    ticket_description: str,
    action: str,
    risk: str,
    confidence: float,
    ticket_category: str,
    financial_category: str,
    reason: str,
) -> str:
    """
    Generate a human-readable explanation for the result panel.
    Uses Groq for speed, Gemini as fallback, raw reason as last resort.
    """
    prompt_content = (
        f"A customer submitted a support ticket and our AI analyzed it.\n"
        f"Write a clear, friendly 2-3 sentence explanation of what the AI found and what happens next.\n"
        f"Do NOT use bullet points. Write in plain conversational English.\n\n"
        f"Ticket: \"{ticket_title}\"\n"
        f"Description: \"{ticket_description[:200]}\"\n"
        f"AI Decision: {action} | Risk: {risk} | Confidence: {confidence * 100:.0f}%\n"
        f"Category: {ticket_category} | Domain: {financial_category}\n"
        f"Technical reason: {reason}\n\n"
        f"Write the explanation now:"
    )

    # Try Groq
    try:
        text = _call_groq("You are ResolvAI, a support AI. Be concise and friendly.", prompt_content)
        logger.info("explanation_groq")
        return text
    except Exception:
        pass

    # Try Gemini
    try:
        text = _call_gemini(f"You are ResolvAI. {prompt_content}")
        logger.info("explanation_gemini")
        return text
    except Exception:
        pass

    return reason
