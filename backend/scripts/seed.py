"""
Seed script — loads tickets from data/seed_tickets.csv and processes each
through the AI pipeline via the running API.

Usage:
  python scripts/seed.py [--url http://localhost:8000]
"""

import argparse
import csv
import time
import httpx
from pathlib import Path

DATA_FILE = Path(__file__).parent.parent / "data" / "seed_tickets.csv"


def seed(base_url: str) -> None:
    with open(DATA_FILE, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"Seeding {len(rows)} tickets to {base_url} ...\n")
    passed = failed = 0

    with httpx.Client(base_url=base_url, timeout=30) as client:
        for row in rows:
            payload = {
                "title":       row["title"].strip(),
                "description": row["description"].strip(),
                "priority":    row["priority"].strip(),
                "user_type":   row["user_type"].strip(),
            }
            try:
                res = client.post("/process-ticket", json=payload)
                res.raise_for_status()
                d = res.json()
                print(
                    f"  [#{d['ticket_id']:>3}] {payload['title'][:45]:<45} "
                    f"conf={d['confidence']:.4f}  risk={d['risk']:<4}  action={d['action']}"
                )
                passed += 1
            except Exception as e:
                print(f"  [FAIL] {payload['title']}: {e}")
                failed += 1
            time.sleep(0.1)

    print(f"\nDone. {passed} succeeded, {failed} failed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://localhost:8000")
    args = parser.parse_args()
    seed(args.url)
