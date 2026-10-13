import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

from app.models import ApplicationStatus
from app.schemas.common import ORM
from app.schemas.job import JobListItem
from app.schemas.user import StudentPublicOut


class ApplyIn(BaseModel):
    cover_letter: Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)] | None = None


class StatusIn(BaseModel):
    status: ApplicationStatus


class HistoryOut(ORM):
    from_status: str | None
    to_status: str
    created_at: datetime


class ApplicationOut(ORM):
    id: uuid.UUID
    status: str
    cover_letter: str | None
    has_cv: bool
    created_at: datetime
    updated_at: datetime
    job: JobListItem


class ApplicantOut(ORM):
    id: uuid.UUID
    status: str
    cover_letter: str | None
    has_cv: bool
    created_at: datetime
    updated_at: datetime
    job: JobListItem
    student: StudentPublicOut = Field(validation_alias="applicant")
    history: list[HistoryOut] = []
