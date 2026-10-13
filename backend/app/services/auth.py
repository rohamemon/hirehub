"""Authentication business logic: registration, login, refresh rotation, reset/verify."""
import uuid
from datetime import timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError, Conflict, Unauthorized
from app.core.security import (
    create_access_token,
    generate_token,
    hash_password,
    hash_token,
    utcnow,
    verify_password,
)
from app.models import (
    AuthToken,
    Company,
    EmployerProfile,
    RefreshToken,
    Role,
    StudentProfile,
    User,
)
from app.schemas.user import RegisterIn
from app.services.common import audit, slugify
from app.services.email import send_email

# Used to equalise timing when the email does not exist (avoids user enumeration).
_DUMMY_HASH = hash_password("not-a-real-password-1")


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.lower()))


def unique_slug(db: Session, name: str) -> str:
    base = slugify(name)
    slug, n = base, 2
    while db.scalar(select(Company.id).where(Company.slug == slug)):
        slug, n = f"{base}-{n}", n + 1
    return slug


def register_user(db: Session, data: RegisterIn) -> User:
    if get_user_by_email(db, data.email):
        raise Conflict("An account with this email already exists", code="email_taken")
    user = User(email=data.email.lower(), password_hash=hash_password(data.password),
                full_name=data.full_name, role=data.role)
    db.add(user)
    db.flush()
    if data.role == Role.student.value:
        db.add(StudentProfile(user_id=user.id, skills=[]))
    else:
        company = None
        if data.company_name:
            if db.scalar(select(Company.id).where(Company.name == data.company_name)):
                raise Conflict("A company with this name already exists", code="company_taken")
            company = Company(name=data.company_name, slug=unique_slug(db, data.company_name))
            db.add(company)
            db.flush()
        db.add(EmployerProfile(user_id=user.id, company_id=company.id if company else None))
    audit(db, user.id, "user.registered", "user", user.id, {"role": data.role})
    send_verification_email(db, user)
    db.commit()
    return user


def _issue_auth_token(db: Session, user: User, purpose: str, ttl: timedelta) -> str:
    raw = generate_token()
    db.add(AuthToken(user_id=user.id, purpose=purpose, token_hash=hash_token(raw), expires_at=utcnow() + ttl))
    db.flush()
    return raw


def send_verification_email(db: Session, user: User) -> None:
    s = get_settings()
    raw = _issue_auth_token(db, user, "email_verify", timedelta(hours=s.verify_token_hours))
    send_email(user.email, "Verify your HireHub email",
               f"Hi {user.full_name},\n\nConfirm your email: {s.frontend_url}/verify-email?token={raw}\n")


def authenticate(db: Session, email: str, password: str) -> User:
    user = get_user_by_email(db, email)
    # Always run a hash verification so response time doesn't reveal whether the email exists.
    ok = verify_password(password, user.password_hash if user else _DUMMY_HASH)
    if not user or not ok:
        raise Unauthorized("Incorrect email or password", code="invalid_credentials")
    if not user.is_active:
        raise Unauthorized("This account has been disabled", code="account_disabled")
    return user


def start_session(db: Session, user: User) -> tuple[str, str]:
    """Create a new refresh-token family. Returns (access_token, raw_refresh_token)."""
    return _new_refresh(db, user, uuid.uuid4())


def _new_refresh(db: Session, user: User, family_id: uuid.UUID) -> tuple[str, str]:
    raw = generate_token()
    db.add(RefreshToken(user_id=user.id, family_id=family_id, token_hash=hash_token(raw),
                        expires_at=utcnow() + timedelta(days=get_settings().refresh_token_days)))
    db.commit()
    return create_access_token(user.id, user.role), raw


def rotate_refresh(db: Session, raw: str | None) -> tuple[User, str, str]:
    """Exchange a refresh token for a new pair. Presenting an already-used token means it
    was probably stolen, so the entire token family is revoked."""
    if not raw:
        raise Unauthorized("Not signed in")
    tok = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw)))
    if tok is None:
        raise Unauthorized("Invalid session")
    if tok.revoked_at is not None:
        db.execute(update(RefreshToken).where(RefreshToken.family_id == tok.family_id, RefreshToken.revoked_at.is_(None))
                   .values(revoked_at=utcnow()))
        db.commit()
        raise Unauthorized("Session expired, please sign in again")
    if tok.expires_at < utcnow():
        raise Unauthorized("Session expired, please sign in again")
    user = db.get(User, tok.user_id)
    if user is None or not user.is_active:
        raise Unauthorized("Account not available")
    tok.revoked_at = utcnow()
    access, new_raw = _new_refresh(db, user, tok.family_id)
    return user, access, new_raw


def revoke_refresh(db: Session, raw: str | None) -> None:
    if not raw:
        return
    tok = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw)))
    if tok:
        db.execute(update(RefreshToken).where(RefreshToken.family_id == tok.family_id, RefreshToken.revoked_at.is_(None))
                   .values(revoked_at=utcnow()))
        db.commit()


def revoke_all_for_user(db: Session, user_id: uuid.UUID) -> None:
    db.execute(update(RefreshToken).where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
               .values(revoked_at=utcnow()))


def request_password_reset(db: Session, email: str) -> None:
    """Silently does nothing for unknown emails so callers can't enumerate accounts."""
    user = get_user_by_email(db, email)
    if user and user.is_active:
        s = get_settings()
        raw = _issue_auth_token(db, user, "password_reset", timedelta(minutes=s.reset_token_minutes))
        send_email(user.email, "Reset your HireHub password",
                   f"Use this link within {s.reset_token_minutes} minutes: {s.frontend_url}/reset-password?token={raw}\n"
                   "If you didn't request this, ignore this email.")
        db.commit()


def _consume_token(db: Session, raw: str, purpose: str) -> AuthToken:
    tok = db.scalar(select(AuthToken).where(AuthToken.token_hash == hash_token(raw), AuthToken.purpose == purpose))
    if tok is None or tok.used_at is not None or tok.expires_at < utcnow():
        raise AppError("This link is invalid or has expired", code="invalid_token")
    tok.used_at = utcnow()
    return tok


def reset_password(db: Session, raw: str, new_password: str) -> None:
    tok = _consume_token(db, raw, "password_reset")
    user = db.get(User, tok.user_id)
    user.password_hash = hash_password(new_password)
    revoke_all_for_user(db, user.id)  # force re-login everywhere
    audit(db, user.id, "user.password_reset", "user", user.id)
    db.commit()


def verify_email(db: Session, raw: str) -> None:
    tok = _consume_token(db, raw, "email_verify")
    db.get(User, tok.user_id).email_verified = True
    db.commit()


def user_company_id(user: User) -> uuid.UUID | None:
    return user.employer_profile.company_id if user.employer_profile else None
