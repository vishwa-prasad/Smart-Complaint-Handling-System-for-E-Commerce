"""
seed_admin.py
=============
Clears all users and re-seeds the database with fresh admin, employee,
and customer accounts.

Usage:
    python seed_admin.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal, engine, Base
import models
from auth import hash_password

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# ── Users to create ──────────────────────────────────────────────────────────
# Edit these before running if you want different names / emails / passwords.

USERS = [
    # Admins
    {
        "name":     "Admin",
        "email":    "admin@demo.com",
        "password": "admin123",
        "role":     "admin",
    },
    # Employees / support agents
    {
        "name":     "Support Agent",
        "email":    "agent@demo.com",
        "password": "agent123",
        "role":     "employee",
    },
    # Customers
    {
        "name":     "John Customer",
        "email":    "john@demo.com",
        "password": "user123",
        "role":     "user",
    },
    {
        "name":     "Jane Customer",
        "email":    "jane@demo.com",
        "password": "user123",
        "role":     "user",
    },
]

# ─────────────────────────────────────────────────────────────────────────────

try:
    created = 0
    skipped = 0

    for u in USERS:
        existing = db.query(models.User).filter(models.User.email == u["email"]).first()
        if existing:
            print(f"  ⚠️  Skipped (already exists): {u['email']}")
            skipped += 1
            continue

        user = models.User(
            name=u["name"],
            email=u["email"],
            hashed_password=hash_password(u["password"]),
            role=u["role"],
        )
        db.add(user)
        created += 1
        print(f"  ✅ Created [{u['role']:8}]  {u['email']}  /  {u['password']}")

    db.commit()
    print(f"\nDone — {created} created, {skipped} skipped.")

except Exception as e:
    db.rollback()
    print(f"Error: {e}")

finally:
    db.close()
