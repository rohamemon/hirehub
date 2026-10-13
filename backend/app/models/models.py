"""SQLAlchemy 2.0 typed ORM models.

Enum-like columns are stored as strings and protected by CHECK constraints (easy to
migrate, enforced by the database). All timestamps are timezone-aware UTC.
"""
import uuid
from datetime import date, datetime

from sqlalchemy import (
    ARRAY,
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import (
    ApplicationStatus,
    EmploymentType,
    ExperienceLevel,
    FileKind,
    JobStatus,
    ReportStatus,
    Role,
    WorkplaceType,
    check_in,
)


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(primary_key=True, default=uuid.uuid4)


def _created() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now())


def _updated() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class User(Base):
    __tablename__ = "users"
    __table_args__ = (check_in("role", Role, "role_valid"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)  # stored lower-case
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(20), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = _created()
    updated_at: Mapped[datetime] = _updated()

    student_profile: Mapped["StudentProfile | None"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")
    employer_profile: Mapped["EmployerProfile | None"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")

    @property
    def company_id(self) -> uuid.UUID | None:
        return self.employer_profile.company_id if self.employer_profile else None


class UploadedFile(Base):
    """Metadata only; bytes live in private storage under a random name."""

    __tablename__ = "uploaded_files"
    __table_args__ = (check_in("kind", FileKind, "kind_valid"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    original_name: Mapped[str] = mapped_column(String(255))
    stored_name: Mapped[str] = mapped_column(String(100), unique=True)
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = _created()


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    headline: Mapped[str | None] = mapped_column(String(160))
    bio: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(String(30))
    location: Mapped[str | None] = mapped_column(String(120))
    education: Mapped[str | None] = mapped_column(Text)
    experience: Mapped[str | None] = mapped_column(Text)
    skills: Mapped[list[str]] = mapped_column(ARRAY(String(60)), default=list)
    portfolio_url: Mapped[str | None] = mapped_column(String(300))
    github_url: Mapped[str | None] = mapped_column(String(300))
    linkedin_url: Mapped[str | None] = mapped_column(String(300))
    cv_file_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("uploaded_files.id", ondelete="SET NULL"))
    avatar_file_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("uploaded_files.id", ondelete="SET NULL"))
    updated_at: Mapped[datetime] = _updated()

    user: Mapped[User] = relationship(back_populates="student_profile")
    cv_file: Mapped[UploadedFile | None] = relationship(foreign_keys=[cv_file_id])
    avatar_file: Mapped[UploadedFile | None] = relationship(foreign_keys=[avatar_file_id])

    @property
    def full_name(self) -> str:
        return self.user.full_name

    @property
    def email(self) -> str:
        return self.user.email

    @property
    def cv_filename(self) -> str | None:
        return self.cv_file.original_name if self.cv_file else None

    @property
    def has_avatar(self) -> bool:
        return self.avatar_file_id is not None


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = _uuid_pk()
    name: Mapped[str] = mapped_column(String(160), unique=True)
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    website: Mapped[str | None] = mapped_column(String(300))
    location: Mapped[str | None] = mapped_column(String(120))
    industry: Mapped[str | None] = mapped_column(String(100))
    size: Mapped[str | None] = mapped_column(String(40))
    logo_file_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("uploaded_files.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = _created()
    updated_at: Mapped[datetime] = _updated()

    logo_file: Mapped[UploadedFile | None] = relationship()

    @property
    def has_logo(self) -> bool:
        return self.logo_file_id is not None


class EmployerProfile(Base):
    __tablename__ = "employer_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    company_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("companies.id", ondelete="SET NULL"), index=True)
    job_title: Mapped[str | None] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(30))

    user: Mapped[User] = relationship(back_populates="employer_profile")
    company: Mapped[Company | None] = relationship()


class JobCategory(Base):
    __tablename__ = "job_categories"

    id: Mapped[uuid.UUID] = _uuid_pk()
    name: Mapped[str] = mapped_column(String(80), unique=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    icon: Mapped[str | None] = mapped_column(String(40))


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        check_in("status", JobStatus, "status_valid"),
        check_in("employment_type", EmploymentType, "employment_type_valid"),
        check_in("experience_level", ExperienceLevel, "experience_level_valid"),
        check_in("workplace_type", WorkplaceType, "workplace_type_valid"),
        CheckConstraint("salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max", name="salary_range_valid"),
        Index("ix_jobs_status_published_at", "status", "published_at"),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    posted_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    category_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("job_categories.id", ondelete="SET NULL"), index=True)
    title: Mapped[str] = mapped_column(String(200), index=True)
    description: Mapped[str] = mapped_column(Text)
    responsibilities: Mapped[str | None] = mapped_column(Text)
    requirements: Mapped[str | None] = mapped_column(Text)
    skills: Mapped[list[str]] = mapped_column(ARRAY(String(60)), default=list)
    employment_type: Mapped[str] = mapped_column(String(20), index=True)
    experience_level: Mapped[str] = mapped_column(String(20), index=True)
    workplace_type: Mapped[str] = mapped_column(String(20), index=True)
    location: Mapped[str | None] = mapped_column(String(120), index=True)
    salary_min: Mapped[int | None] = mapped_column(Integer)
    salary_max: Mapped[int | None] = mapped_column(Integer)
    salary_currency: Mapped[str] = mapped_column(String(3), default="USD")
    deadline: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default=JobStatus.draft.value)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = _created()
    updated_at: Mapped[datetime] = _updated()

    company: Mapped[Company] = relationship()
    category: Mapped[JobCategory | None] = relationship()

    @property
    def is_open(self) -> bool:
        return self.status == JobStatus.published.value and (self.deadline is None or self.deadline >= date.today())


class JobApplication(Base):
    __tablename__ = "job_applications"
    __table_args__ = (
        UniqueConstraint("job_id", "student_id", name="uq_application_job_student"),
        check_in("status", ApplicationStatus, "status_valid"),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()
    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    cv_file_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("uploaded_files.id", ondelete="SET NULL"))
    cover_letter: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default=ApplicationStatus.pending.value, index=True)
    created_at: Mapped[datetime] = _created()
    updated_at: Mapped[datetime] = _updated()

    job: Mapped[Job] = relationship()
    student: Mapped[User] = relationship()
    cv_file: Mapped[UploadedFile | None] = relationship()
    @property
    def has_cv(self) -> bool:
        return self.cv_file_id is not None

    @property
    def applicant(self) -> "StudentProfile":
        return self.student.student_profile

    history: Mapped[list["ApplicationStatusHistory"]] = relationship(
        back_populates="application", order_by="ApplicationStatusHistory.created_at", cascade="all, delete-orphan"
    )


class ApplicationStatusHistory(Base):
    __tablename__ = "application_status_history"

    id: Mapped[uuid.UUID] = _uuid_pk()
    application_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("job_applications.id", ondelete="CASCADE"), index=True)
    from_status: Mapped[str | None] = mapped_column(String(20))
    to_status: Mapped[str] = mapped_column(String(20))
    changed_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = _created()

    application: Mapped[JobApplication] = relationship(back_populates="history")


class SavedJob(Base):
    __tablename__ = "saved_jobs"
    __table_args__ = (UniqueConstraint("user_id", "job_id", name="uq_saved_user_job"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = _created()

    job: Mapped[Job] = relationship()


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str | None] = mapped_column(Text)
    link: Mapped[str | None] = mapped_column(String(300))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = _created()


class AuthToken(Base):
    """Single-use, hashed tokens for password reset and email verification."""

    __tablename__ = "auth_tokens"
    __table_args__ = (CheckConstraint("purpose IN ('password_reset', 'email_verify')", name="purpose_valid"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    purpose: Mapped[str] = mapped_column(String(20))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = _created()


class RefreshToken(Base):
    """Rotating refresh tokens. `family_id` groups a login session so reuse of a
    rotated token revokes the whole family (token-theft detection)."""

    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    family_id: Mapped[uuid.UUID] = mapped_column(index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = _created()


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = _uuid_pk()
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    action: Mapped[str] = mapped_column(String(80), index=True)
    entity_type: Mapped[str | None] = mapped_column(String(50))
    entity_id: Mapped[str | None] = mapped_column(String(64))
    detail: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    actor: Mapped[User | None] = relationship()


class ReportedJob(Base):
    __tablename__ = "reported_jobs"
    __table_args__ = (
        UniqueConstraint("job_id", "reporter_id", name="uq_report_job_reporter"),
        check_in("status", ReportStatus, "status_valid"),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()
    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    reporter_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    reason: Mapped[str] = mapped_column(String(80))
    details: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default=ReportStatus.open.value, index=True)
    resolved_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = _created()

    job: Mapped[Job] = relationship()
    reporter: Mapped[User] = relationship(foreign_keys=[reporter_id])
