"""
AI Chat Service — Gemini-powered support assistant.
Uses ticket context + full conversation history for coherent multi-turn chat.
Falls back to rule-based responses if Gemini is unavailable.
"""

from typing import List, Optional
from app.core.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)

_client = None

SYSTEM_PROMPT = """You are ResolvAI, an expert customer support AI assistant for a software/tech company.

You have access to the customer's ticket details and conversation history.
Your role is to:
1. Provide helpful, accurate, and empathetic support responses
2. Give specific troubleshooting steps when relevant
3. Escalate urgency when the customer indicates critical issues
4. Keep responses concise but complete (2-4 sentences max unless steps are needed)
5. Always acknowledge the customer's frustration when present
6. Never make up information — if unsure, say you'll escalate to a human agent

Tone: Professional, warm, solution-focused. Never robotic.
"""


def _get_client():
    global _client
    if _client is None and settings.GEMINI_API_KEY:
        try:
            from google import genai
            _client = genai.Client(api_key=settings.GEMINI_API_KEY)
            logger.info("gemini_client_initialized")
        except Exception as e:
            logger.warning("gemini_init_failed", error=str(e))
    return _client


# Models to try in order (fastest/cheapest first)
GEMINI_MODELS = [
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.5-flash",
]


def _call_gemini(prompt: str) -> str:
    """Try Gemini models in order, return text or raise."""
    client = _get_client()
    if not client:
        raise RuntimeError("No Gemini client")

    from google import genai
    last_err = None
    for model in GEMINI_MODELS:
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
            )
            logger.info("gemini_ok", model=model)
            return response.text.strip()
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                logger.warning("gemini_rate_limited", model=model)
                last_err = e
                continue  # try next model
            raise  # non-rate-limit error — propagate
    raise last_err or RuntimeError("All Gemini models exhausted")


def _rule_based_response(ticket_title: str, ticket_desc: str, user_message: str, action: str = "") -> str:
    """Fallback rule-based responses when Gemini is unavailable."""
    msg = user_message.lower()

    if any(w in msg for w in ["status", "update", "progress", "when", "how long"]):
        return (
            f"Your ticket '{ticket_title}' is being actively reviewed. "
            "Our team typically responds within 2 business hours. "
            "I'll notify you as soon as there's an update."
        )
    if any(w in msg for w in ["urgent", "critical", "emergency", "asap", "immediately"]):
        return (
            "I understand this is urgent — I'm escalating your ticket to our priority queue right now. "
            "A senior agent will contact you within 30 minutes. Please stay available."
        )
    if any(w in msg for w in ["thank", "thanks", "resolved", "fixed", "working", "solved"]):
        return (
            "Glad to hear that's resolved! I'll mark this ticket as resolved. "
            "Don't hesitate to reach out if anything else comes up."
        )
    if any(w in msg for w in ["cancel", "refund", "charge", "billing", "invoice"]):
        return (
            "I understand your billing concern. I'm flagging this for our billing team to review immediately. "
            "You'll receive a response within 1 business hour with a resolution."
        )
    if action == "AUTO_RESOLVE":
        return (
            f"Based on our AI analysis, your issue with '{ticket_title}' appears to be a known issue "
            "with an available solution. Could you try the steps in the resolution summary above? "
            "Let me know if that doesn't work and I'll connect you with a specialist."
        )
    if action == "ESCALATE":
        return (
            f"Your ticket regarding '{ticket_title}' has been escalated to our specialist team. "
            "A senior engineer will review this and contact you within 1 hour. "
            "Is there any additional context you'd like to add?"
        )
    return (
        f"Thank you for reaching out about '{ticket_title}'. "
        "I've noted your message and a support agent will follow up shortly. "
        "Can you provide any additional details that might help us resolve this faster?"
    )


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
    Generate a contextual AI response using Gemini with full ticket context.

    Args:
        ticket_title: The ticket title
        ticket_description: Full ticket description
        ticket_category: Category (Technical Issue, Billing, etc.)
        ticket_priority: P1/P2/P3
        ai_action: AUTO_RESOLVE / SUGGEST / ESCALATE
        ai_confidence: 0-1 confidence score
        conversation_history: List of {role, message} dicts
        user_message: The latest user message

    Returns:
        AI response string
    """
    client = _get_client()

    if not client:
        logger.warning("gemini_unavailable_using_fallback")
        return _rule_based_response(ticket_title, ticket_description, user_message, ai_action)

    # Build context-rich prompt
    ticket_context = f"""
TICKET CONTEXT:
- Title: {ticket_title}
- Description: {ticket_description}
- Category: {ticket_category}
- Priority: {ticket_priority}
- AI Decision: {ai_action} (confidence: {ai_confidence * 100:.1f}%)
"""

    # Build conversation history for Gemini
    history_text = ""
    if conversation_history:
        history_text = "\nCONVERSATION HISTORY:\n"
        for msg in conversation_history[-10:]:  # last 10 messages for context
            role = "Customer" if msg.get("sender_role") == "customer" else "AI Assistant"
            history_text += f"{role}: {msg.get('message', '')}\n"

    full_prompt = f"{SYSTEM_PROMPT}\n{ticket_context}{history_text}\nCustomer: {user_message}\n\nAI Assistant:"

    try:
        text = _call_gemini(full_prompt)
        logger.info("gemini_response_generated", length=len(text))
        return text
    except Exception as e:
        err_str = str(e)
        if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "exhausted" in err_str.lower():
            logger.warning("gemini_all_models_rate_limited_using_fallback")
        else:
            logger.error("gemini_error", error=err_str)
        return _rule_based_response(ticket_title, ticket_description, user_message, ai_action)


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
    Generate a human-readable AI explanation for the ticket result panel.
    """
    client = _get_client()

    if not client:
        return reason

    prompt = f"""You are ResolvAI. A customer submitted a support ticket and our AI analyzed it.
Write a clear, friendly 2-3 sentence explanation of what the AI found and what happens next.
Do NOT use bullet points. Write in plain conversational English.

Ticket: "{ticket_title}"
Description: "{ticket_description[:200]}"
AI Decision: {action}
Risk Level: {risk}
Confidence: {confidence * 100:.1f}%
Category: {ticket_category}
Domain: {financial_category}
Technical reason: {reason}

Write the explanation now:"""

    try:
        text = _call_gemini(prompt)
        return text
    except Exception as e:
        logger.warning("gemini_explanation_failed", error=str(e))
        return reason
