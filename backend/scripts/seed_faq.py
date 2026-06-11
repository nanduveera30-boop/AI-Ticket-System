"""Seed FAQ data via the API."""
import httpx, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

FAQS = [
    {"question": "How do I reset my password?", "answer": "Go to the login page and click 'Forgot Password'. Enter your email address and we will send you a reset link within 5 minutes. Check your spam folder if you do not receive it.", "category": "Account"},
    {"question": "How long does it take to resolve a ticket?", "answer": "P1 Critical tickets are addressed within 1 hour. P2 High priority within 4 hours. P3 Normal priority within 1 business day. You will receive email updates at each stage.", "category": "Support"},
    {"question": "Can I update my ticket after submitting?", "answer": "Yes. Open your ticket from My Tickets and use the chat to add more information. Our support team will see your updates immediately.", "category": "Support"},
    {"question": "What does AUTO_RESOLVE mean?", "answer": "Our AI system analyzed your ticket and determined it can be resolved automatically based on similar past issues. You will receive a resolution summary within 15 minutes.", "category": "AI System"},
    {"question": "What does ESCALATE mean?", "answer": "Your ticket has been flagged as high priority or complex and has been assigned to a senior support specialist who will contact you directly.", "category": "Support"},
    {"question": "How do I check my ticket status?", "answer": "Log in and go to My Tickets. Each ticket shows its current status: Open, In Progress, Escalated, Resolved, or Closed.", "category": "Support"},
    {"question": "Can I submit a ticket by voice?", "answer": "Yes. On the Submit Ticket page, click the microphone icon and describe your issue. Our AI will transcribe it and fill in the form automatically. You can review and confirm before submitting.", "category": "Features"},
    {"question": "How is my ticket priority determined?", "answer": "You can set the priority when submitting. P1 is for critical issues affecting your business operations. P2 is for significant issues. P3 is for general questions or minor issues.", "category": "Support"},
    {"question": "What information should I include in my ticket?", "answer": "Include a clear title, detailed description of the issue, when it started, any error messages you see, and steps to reproduce the problem. More detail helps us resolve faster.", "category": "Support"},
    {"question": "How do I contact support urgently?", "answer": "For P1 critical issues, submit a ticket with P1 priority and it will be escalated immediately. You can also use the live chat on your ticket for real-time communication with our team.", "category": "Support"},
]

def seed(base_url: str, token: str):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    with httpx.Client(base_url=base_url, timeout=30) as client:
        for faq in FAQS:
            r = client.post("/faq", json=faq, headers=headers)
            print(f"  {'OK' if r.status_code == 201 else 'FAIL'}: {faq['question'][:50]}")

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--url", default="http://localhost:8000")
    p.add_argument("--token", required=True)
    args = p.parse_args()
    seed(args.url, args.token)
