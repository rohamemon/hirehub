import re
import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, EmailStr, Field, StringConstraints, field_validator

from app.schemas.common import ORM

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
Url = Annotated[str, StringConstraints(strip_whitespace=True, max_length=300, pattern=r"^https?://\S+$")]


def validate_password_strength(v: str) -> str:
    if len(v) < 8 or len(v) > 128:
        raise ValueError("Password must be 8-128 characters")
    if not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
        raise ValueError("Password must contain at least one letter and one number")
    return v


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    full_name: Name
    # Admin is intentionally not an option: public users can only be students/employers.
    role: Literal["student", "employer"]
    company_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=160)] | None = None

    _pw = field_validator("password")(validate_password_strength)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str
    password: str

    _pw = field_validator("password")(validate_password_strength)


class TokenIn(BaseModel):
    token: str


class UserOut(ORM):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    email_verified: bool
    created_at: datetime
    company_id: uuid.UUID | None = None


class AuthOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class StudentProfileIn(BaseModel):
    full_name: Name | None = None
    headline: Annotated[str, StringConstraints(strip_whitespace=True, max_length=160)] | None = None
    bio: Annotated[str, StringConstraints(max_length=3000)] | None = None
    phone: Annotated[str, StringConstraints(strip_whitespace=True, max_length=30)] | None = None
    location: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)] | None = None
    education: Annotated[str, StringConstraints(max_length=3000)] | None = None
    experience: Annotated[str, StringConstraints(max_length=3000)] | None = None
    skills: list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]] | None = Field(default=None, max_length=30)
    portfolio_url: Url | None = None
    github_url: Url | None = None
    linkedin_url: Url | None = None

    @field_validator("headline", "bio", "phone", "location", "education", "experience",
                     "portfolio_url", "github_url", "linkedin_url", mode="before")
    @classmethod
    def _blank_to_none(cls, v):
        return None if isinstance(v, str) and not v.strip() else v


class StudentProfileOut(ORM):
    user_id: uuid.UUID
    full_name: str
    email: str
    headline: str | None
    bio: str | None
    phone: str | None
    location: str | None
    education: str | None
    experience: str | None
    skills: list[str]
    portfolio_url: str | None
    github_url: str | None
    linkedin_url: str | None
    cv_filename: str | None
    has_avatar: bool


class StudentPublicOut(ORM):
    """What an employer sees about an applicant (no phone/email beyond need)."""
    user_id: uuid.UUID
    full_name: str
    email: str
    headline: str | None
    bio: str | None
    location: str | None
    education: str | None
    experience: str | None
    skills: list[str]
    portfolio_url: str | None
    github_url: str | None
    linkedin_url: str | None
    has_avatar: bool
