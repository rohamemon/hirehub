"""Reusable FastAPI dependencies: DB session, authentication, role checks."""
import uuid
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.errors import Forbidden, Unauthorized
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import Role, User

bearer = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbSession, creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]
) -> User:
    if creds is None:
        raise Unauthorized("Authentication required")
    payload = decode_access_token(creds.credentials)
    if payload is None:
        raise Unauthorized("Invalid or expired token")
    user = db.get(User, uuid.UUID(payload["sub"]))
    # Re-checked on every request so disabling an account takes effect immediately.
    if user is None or not user.is_active:
        raise Unauthorized("Account not available")
    return user


def get_optional_user(
    db: DbSession, creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]
) -> User | None:
    if creds is None:
        return None
    try:
        return get_current_user(db, creds)
    except Unauthorized:
        return None


def require_roles(*roles: Role):
    allowed = {r.value for r in roles}

    def checker(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.role not in allowed:
            raise Forbidden("You do not have permission to perform this action")
        return user

    return checker


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]
StudentUser = Annotated[User, Depends(require_roles(Role.student))]
EmployerUser = Annotated[User, Depends(require_roles(Role.employer))]
AdminUser = Annotated[User, Depends(require_roles(Role.admin))]


def require_csrf_header(request: Request) -> None:
    """Cookie-authenticated endpoints (refresh/logout) must carry a custom header.
    Browsers cannot add it on cross-site form posts, and CORS blocks it for other
    origins, which defeats CSRF. We also verify Origin when it is present."""
    from app.core.config import get_settings

    if request.headers.get("x-requested-with") != "HireHub":
        raise Forbidden("Missing CSRF header")
    origin = request.headers.get("origin")
    if origin and origin not in get_settings().cors_origin_list:
        raise Forbidden("Origin not allowed")
