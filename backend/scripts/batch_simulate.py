"""
Batch simulation — generates N random tickets and processes them,
printing a summary table and confidence distribution.

Usage:
  python scripts/batch_simulate.py --count 50 --url http://localhost:8000
"""

import argparse
import random
import time
import httpx

TITLES = [
    "Cannot login to account", "Password reset not working", "Billing invoice incorrect",
    "App crashes on startup", "Slow dashboard loading", "Unable to update profile",
    "Email notifications not sending", "API returning 500 error", "Subscription not activated",
    "Account locked unexpectedly", "Data export stuck", "Search not returning results",
    "Two-factor auth failing", "Refund not processed", "Admin panel inaccessible",
    "Mobile app not syncing", "Wrong currency on invoice", "Install fails on Windows",
    "Rate limit too aggressive", "VIP features not available",
]

DESCRIPTIONS = [
    "User reports the issue persists after multiple attempts and cache clearing.",
    "Error occurs consistently since the last system update was applied.",
    "Issue affects multiple users in the same organization account.",
    "Logs show no errors but the feature is completely non-functional.",
    "Customer has been waiting for resolution for over 48 hours.",
    "The problem started after the recent billing cycle renewal.",
    "Reproducible on all browsers and devices tested by the user.",
    "Critical business workflow is blocked until this is resolved.",
    "User has already tried the standard troubleshooting steps.",
    "This is the third time this issue has been reported this month.",
]

PRIORITIES = ["P1", "P2", "P3"]
USER_TYPES  = ["STANDARD", "VIP"]
PRIORITY_WEIGHTS = [0.2, 0.5, 0.3]
USER_WEIGHTS     = [0.8, 0.2]


def simulate(base_url: str, count: int) -> None:
    results = {"AUTO_RESOLVE": 0, "SUGGEST": 0, "ESCALATE": 0}
    confidences = []

    print(f"Running batch simulation: {count} tickets → {base_url}\n")
    print(f"{'#':<5} {'Title':<40} {'Pri':<4} {'User':<9} {'Conf':<8} {'Risk':<5} {'Action'}")
    print("-" * 90)

    with httpx.Client(base_url=base_url, timeout=30) as client:
        for i in range(1, count + 1):
            payload = {
                "title":       random.choice(TITLES),
                "description": random.choice(DESCRIPTIONS),
                "priority":    random.choices(PRIORITIES, PRIORITY_WEIGHTS)[0],
                "user_type":   random.choices(USER_TYPES, USER_WEIGHTS)[0],
            }
            try:
                res = client.post("/process-ticket", json=payload)
                res.raise_for_status()
                d = res.json()
                results[d["action"]] += 1
                confidences.append(d["confidence"])
                print(
                    f"{i:<5} {payload['title'][:39]:<40} {payload['priority']:<4} "
                    f"{payload['user_type']:<9} {d['confidence']:.4f}   {d['risk']:<5} {d['action']}"
                )
            except Exception as e:
                print(f"{i:<5} ERROR: {e}")
            time.sleep(0.05)

    total = sum(results.values())
    avg_conf = sum(confidences) / len(confidences) if confidences else 0

    print("\n" + "=" * 90)
    print("SIMULATION SUMMARY")
    print("=" * 90)
    print(f"  Total processed : {total}")
    print(f"  AUTO_RESOLVE    : {results['AUTO_RESOLVE']} ({results['AUTO_RESOLVE']/total*100:.1f}%)")
    print(f"  SUGGEST         : {results['SUGGEST']} ({results['SUGGEST']/total*100:.1f}%)")
    print(f"  ESCALATE        : {results['ESCALATE']} ({results['ESCALATE']/total*100:.1f}%)")
    print(f"  Avg Confidence  : {avg_conf:.4f}")

    # Confidence distribution buckets
    buckets = {"0.0-0.4": 0, "0.4-0.6": 0, "0.6-0.8": 0, "0.8-0.92": 0, "0.92-1.0": 0}
    for c in confidences:
        if c < 0.4:   buckets["0.0-0.4"] += 1
        elif c < 0.6: buckets["0.4-0.6"] += 1
        elif c < 0.8: buckets["0.6-0.8"] += 1
        elif c < 0.92:buckets["0.8-0.92"] += 1
        else:         buckets["0.92-1.0"] += 1

    print("\n  Confidence Distribution:")
    for bucket, cnt in buckets.items():
        bar = "█" * int(cnt / total * 40)
        print(f"    {bucket}: {bar} {cnt}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url",   default="http://localhost:8000")
    parser.add_argument("--count", type=int, default=20)
    args = parser.parse_args()
    simulate(args.url, args.count)
