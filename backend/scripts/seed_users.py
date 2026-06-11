"""
Seed default users for development.

Usage (from backend/ folder):
  python scripts/seed_users.py

Creates:
  admin    / admin123    (role: admin)
  agent1   / agent123    (role: agent)
  customer1/ customer123 (role: customer)
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal
from app.db.models import User
from app.core.security import hash_password

USERS = [
    {"username": "admin",     "email": "admin@resolvai.com",     "password": "admin123",    "role": "admin",    "full_name": "Admin User"},
    {"username": "agent1",    "email": "agent1@resolvai.com",    "password": "agent123",    "role": "agent",    "full_name": "Support Agent"},
    {"username": "customer1", "email": "customer1@resolvai.com", "password": "customer123", "role": "customer", "full_name": "Test Customer"},
]

def seed():
    db = SessionLocal()
    try:
        created = 0
        for u in USERS:
            exists = db.query(User).filter(User.username == u["username"]).first()
            if exists:
                print(f"  [SKIP] {u['username']} already exists (role={exists.role})")
                continue
            user = User(
                username=u["username"],
                email=u["email"],
                hashed_password=hash_password(u["password"]),
                role=u["role"],
                full_name=u["full_name"],
                is_active=True,
            )
            db.add(user)
            created += 1
            print(f"  [OK]   {u['username']} / {u['password']}  (role={u['role']})")
        db.commit()
        print(f"\nDone. {created} user(s) created.")
        print("\nCredentials:")
        print("  Admin:    username=admin      password=admin123")
        print("  Agent:    username=agent1     password=agent123")
        print("  Customer: username=customer1  password=customer123")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
