"""Create (or promote) the first administrator. Run on the server only:

    python -m scripts.create_admin you@example.com "Your Name"

The password is read from the ADMIN_PASSWORD env var or prompted (hidden). There is
deliberately no HTTP endpoint for this.
"""
import getpass
import os
import sys

from email_validator import EmailNotValidError, validate_email
from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import Role, User
from app.schemas.user import validate_password_strength
from app.services.common import audit


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit('Usage: python -m scripts.create_admin EMAIL ["Full Name"]')
    try:  # same rules the login form uses, so the admin can actually sign in
        email = validate_email(sys.argv[1], check_deliverability=False).normalized.lower()
    except EmailNotValidError as e:
        sys.exit(f"Invalid email: {e}")
    name = sys.argv[2] if len(sys.argv) > 2 else "Administrator"
    password = os.environ.get("ADMIN_PASSWORD") or getpass.getpass("Admin password: ")
    try:
        validate_password_strength(password)
    except ValueError as e:
        sys.exit(str(e))
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        if user:
            user.role, user.password_hash, user.is_active = Role.admin.value, hash_password(password), True
            print(f"Existing user {email} promoted to admin and password updated.")
        else:
            user = User(email=email, password_hash=hash_password(password), full_name=name,
                        role=Role.admin.value, email_verified=True)
            db.add(user)
            print(f"Admin {email} created.")
        db.flush()
        audit(db, user.id, "admin.provisioned", "user", user.id)
        db.commit()


if __name__ == "__main__":
    main()
