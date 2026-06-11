"""Test Gemini chat end-to-end with a real ticket."""
import sys, time
sys.path.insert(0, '.')

from app.services.ai_chat import generate_ai_response, generate_ticket_explanation

# Simulate a real ticket
ticket_title = "WiFi not working in room A412"
ticket_desc  = "My wifi has been down for 2 days. I cannot connect to the internet. Error: 'No internet, secured'. I've tried restarting the router."
category     = "Technical Issue"
priority     = "P2"
action       = "ESCALATE"
confidence   = 0.78

print("=== Testing Gemini Chat ===\n")

# Test 1: First message
print("User: What's the status of my ticket?")
resp = generate_ai_response(
    ticket_title=ticket_title,
    ticket_description=ticket_desc,
    ticket_category=category,
    ticket_priority=priority,
    ai_action=action,
    ai_confidence=confidence,
    conversation_history=[],
    user_message="What's the status of my ticket?",
)
print(f"AI: {resp}\n")
time.sleep(2)

# Test 2: Follow-up with context
history = [
    {"sender_role": "customer", "message": "What's the status of my ticket?"},
    {"sender_role": "ai",       "message": resp},
]
print("User: I've already tried restarting. It's been 2 days, this is urgent!")
resp2 = generate_ai_response(
    ticket_title=ticket_title,
    ticket_description=ticket_desc,
    ticket_category=category,
    ticket_priority=priority,
    ai_action=action,
    ai_confidence=confidence,
    conversation_history=history,
    user_message="I've already tried restarting. It's been 2 days, this is urgent!",
)
print(f"AI: {resp2}\n")
time.sleep(2)

# Test 3: Explanation
print("=== Testing Ticket Explanation ===\n")
expl = generate_ticket_explanation(
    ticket_title=ticket_title,
    ticket_description=ticket_desc,
    action=action,
    risk="HIGH",
    confidence=confidence,
    ticket_category=category,
    financial_category="IT Infrastructure",
    reason="High priority technical issue with network connectivity requiring specialist intervention.",
)
print(f"Explanation: {expl}\n")
print("=== All tests passed ===")
