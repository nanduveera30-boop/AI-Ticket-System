"""Test voice field extraction with realistic inputs."""
import sys
sys.path.insert(0, '.')
from app.services.voice import extract_ticket_fields

tests = [
    "My wifi is not working at room A412, I cannot connect to the internet",
    "I was charged twice on my credit card for the subscription this month",
    "I cannot login to my account, the password reset is not working",
    "I would like to request a dark mode feature for the dashboard",
    "How do I export my data from the system?",
    "The app keeps crashing every time I open it, this is urgent",
    "I haven't seen my life life",  # garbled input test
]

for t in tests:
    f = extract_ticket_fields(t)
    title = f["title"]
    cat = f["category"]
    conf = f["category_confidence"]
    pri = f["priority"]
    print(f"Input:    {t[:65]}")
    print(f"  Title:    {title}")
    print(f"  Category: {cat} ({conf*100:.0f}% confidence)")
    print(f"  Priority: {pri}")
    print()
