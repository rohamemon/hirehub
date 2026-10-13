import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, field_validator, model_validator

from app.models import EmploymentType, ExperienceLevel, WorkplaceType
from app.schemas.common import ORM
from app.schemas.user import Url

Short = Annotated[str, StringConstraints(strip_whitespace=True, max_length=160)]


class CategoryIn(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]
    icon: str | None = Field(default=None, max_length=40)


class CategoryOut(ORM):
    id: uuid.UUID
    name: str
    slug: str
    icon: str | None


class CompanyIn(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=160)]
    description: Annotated[str, StringConstraints(max_length=5000)] | None = None
    website: Url | None = None
    location: Short | None = None
    industry: Short | None = None
    size: Annotated[str, StringConstraints(max_length=40)] | None = None

    @field_validator("description", "website", "location", "industry", "size", mode="before")
    @classmethod
    def _blank(cls, v):
        return None if isinstance(v, str) and not v.strip() else v


class CompanyOut(ORM):
    id: uuid.UUID
    name: str
    slug: str
    description: str | None
    website: str | None
    location: str | None
    industry: str | None
    size: str | None
    has_logo: bool = False
    open_jobs: int = 0


class CompanyBrief(ORM):
    id: uuid.UUID
    name: str
    slug: str
    location: str | None
    has_logo: bool = False


class JobIn(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=200)]
    description: Annotated[str, StringConstraints(strip_whitespace=True, min_length=20, max_length=10000)]
    responsibilities: Annotated[str, StringConstraints(max_length=5000)] | None = None
    requirements: Annotated[str, StringConstraints(max_length=5000)] | None = None
    skills: list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]] = Field(default_factory=list, max_length=30)
    category_id: uuid.UUID | None = None
    employment_type: EmploymentType
    experience_level: ExperienceLevel
    workplace_type: WorkplaceType
    location: Short | None = None
    salary_min: int | None = Field(default=None, ge=0, le=10_000_000)
    salary_max: int | None = Field(default=None, ge=0, le=10_000_000)
    salary_currency: Annotated[str, StringConstraints(min_length=3, max_length=3, to_upper=True)] = "USD"
    deadline: date | None = None

    @model_validator(mode="after")
    def _check(self):
        if self.salary_min is not None and self.salary_max is not None and self.salary_min > self.salary_max:
            raise ValueError("Minimum salary cannot exceed maximum salary")
        if self.workplace_type != WorkplaceType.remote and not (self.location or "").strip():
            raise ValueError("Location is required unless the job is remote")
        return self


class JobOut(ORM):
    id: uuid.UUID
    title: str
    description: str
    responsibilities: str | None
    requirements: str | None
    skills: list[str]
    employment_type: str
    experience_level: str
    workplace_type: str
    location: str | None
    salary_min: int | None
    salary_max: int | None
    salary_currency: str
    deadline: date | None
    status: str
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime
    company: CompanyBrief
    category: CategoryOut | None
    is_open: bool = False
    is_saved: bool = False
    has_applied: bool = False
    application_count: int | None = None


class JobListItem(ORM):
    id: uuid.UUID
    title: str
    employment_type: str
    experience_level: str
    workplace_type: str
    location: str | None
    salary_min: int | None
    salary_max: int | None
    salary_currency: str
    deadline: date | None
    status: str
    published_at: datetime | None
    created_at: datetime
    company: CompanyBrief
    category: CategoryOut | None
    skills: list[str]
    is_saved: bool = False
    application_count: int | None = None


class ReportIn(BaseModel):
    reason: Literal["spam", "scam", "discriminatory", "misleading", "other"]
    details: Annotated[str, StringConstraints(max_length=2000)] | None = None
