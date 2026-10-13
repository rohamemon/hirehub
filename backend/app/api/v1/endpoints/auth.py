from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Response

from app.core.config import get_settings
from app.core.dependencies import CurrentUser, DbSession, require_csrf_header
from app.core.rate_limit import rate_limit
from app.schemas.common import Message
from app.schemas.user import (
    AuthOut,
    ForgotPasswordIn,
    LoginIn,
    RegisterIn,
    ResetPasswordIn,
    TokenIn,
    UserOut,
)
from app.services import auth as svc

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE = "hirehub_refresh"
# Cookie is only sent to the auth routes, never to the rest of the API.
COOKIE_PATH = "/api/v1/auth"


def _set_cookie(response: Response, raw: str) -> None:
    s = get_settings()
    response.set_cookie(COOKIE, raw, max_age=s.refresh_token_days * 86400, httponly=True,
                        secure=s.cookie_secure, samesite=s.cookie_samesite, path=COOKIE_PATH)


@router.post("/register", response_model=AuthOut, status_code=201,
             dependencies=[Depends(rate_limit("register", 10, 3600))])
def register(data: RegisterIn, response: Response, db: DbSession):
    user = svc.register_user(db, data)
    access, refresh = svc.start_session(db, user)
    _set_cookie(response, refresh)
    return AuthOut(access_token=access, user=user)


@router.post("/login", response_model=AuthOut, dependencies=[Depends(rate_limit("login", 10, 300))])
def login(data: LoginIn, response: Response, db: DbSession):
    user = svc.authenticate(db, data.email, data.password)
    access, refresh = svc.start_session(db, user)
    _set_cookie(response, refresh)
    return AuthOut(access_token=access, user=user)


@router.post("/refresh", response_model=AuthOut, dependencies=[Depends(require_csrf_header)])
def refresh(response: Response, db: DbSession, hirehub_refresh: Annotated[str | None, Cookie()] = None):
    user, access, new_raw = svc.rotate_refresh(db, hirehub_refresh)
    _set_cookie(response, new_raw)
    return AuthOut(access_token=access, user=user)


@router.post("/logout", response_model=Message, dependencies=[Depends(require_csrf_header)])
def logout(response: Response, db: DbSession, hirehub_refresh: Annotated[str | None, Cookie()] = None):
    svc.revoke_refresh(db, hirehub_refresh)
    response.delete_cookie(COOKIE, path=COOKIE_PATH)
    return Message(message="Signed out")


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user


@router.post("/forgot-password", response_model=Message, dependencies=[Depends(rate_limit("forgot", 5, 3600))])
def forgot_password(data: ForgotPasswordIn, db: DbSession):
    svc.request_password_reset(db, data.email)
    # Same response whether or not the account exists.
    return Message(message="If that email is registered, a reset link has been sent.")


@router.post("/reset-password", response_model=Message, dependencies=[Depends(rate_limit("reset", 10, 3600))])
def reset_password(data: ResetPasswordIn, db: DbSession):
    svc.reset_password(db, data.token, data.password)
    return Message(message="Password updated. Please sign in.")


@router.post("/verify-email", response_model=Message, dependencies=[Depends(rate_limit("verify", 20, 3600))])
def verify_email(data: TokenIn, db: DbSession):
    svc.verify_email(db, data.token)
    return Message(message="Email verified.")


@router.post("/resend-verification", response_model=Message, dependencies=[Depends(rate_limit("resend", 3, 3600))])
def resend_verification(user: CurrentUser, db: DbSession):
    if not user.email_verified:
        svc.send_verification_email(db, user)
        db.commit()
    return Message(message="Verification email sent.")
