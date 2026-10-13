from enum import Enum


class Role(str, Enum):
    student = "student"
    employer = "employer"
    admin = "admin"


class JobStatus(str, Enum):
    draft = "draft"
    published = "published"
    closed = "closed"
    removed = "removed"  # taken down by an admin


class EmploymentType(str, Enum):
    full_time = "full_time"
    part_time = "part_time"
    internship = "internship"
    contract = "contract"
    temporary = "temporary"


class ExperienceLevel(str, Enum):
    entry = "entry"
    junior = "junior"
    mid = "mid"
    senior = "senior"


class WorkplaceType(str, Enum):
    remote = "remote"
    hybrid = "hybrid"
    on_site = "on_site"


class ApplicationStatus(str, Enum):
    pending = "pending"
    reviewed = "reviewed"
    shortlisted = "shortlisted"
    interview = "interview"
    accepted = "accepted"
    rejected = "rejected"
    withdrawn = "withdrawn"


# Allowed transitions for the employer/admin side. Students may only withdraw.
EMPLOYER_TRANSITIONS: dict[ApplicationStatus, set[ApplicationStatus]] = {
    ApplicationStatus.pending: {ApplicationStatus.reviewed, ApplicationStatus.shortlisted, ApplicationStatus.rejected},
    ApplicationStatus.reviewed: {ApplicationStatus.shortlisted, ApplicationStatus.rejected},
    ApplicationStatus.shortlisted: {ApplicationStatus.interview, ApplicationStatus.rejected},
    ApplicationStatus.interview: {ApplicationStatus.accepted, ApplicationStatus.rejected},
    ApplicationStatus.accepted: set(),
    ApplicationStatus.rejected: set(),
    ApplicationStatus.withdrawn: set(),
}
WITHDRAWABLE = {
    ApplicationStatus.pending,
    ApplicationStatus.reviewed,
    ApplicationStatus.shortlisted,
    ApplicationStatus.interview,
}


class FileKind(str, Enum):
    cv = "cv"
    logo = "logo"
    avatar = "avatar"


class ReportStatus(str, Enum):
    open = "open"
    resolved = "resolved"
    dismissed = "dismissed"


def check_in(column: str, enum_cls: type[Enum], name: str):
    from sqlalchemy import CheckConstraint

    values = ", ".join(f"'{e.value}'" for e in enum_cls)
    return CheckConstraint(f"{column} IN ({values})", name=name)
