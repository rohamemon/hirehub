"""Job search and lifecycle (draft -> published -> closed) with ownership enforcement."""
import uuid
from dataclasses import dataclass
from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.errors import AppError, Forbidden, NotFound
from app.core.security import utcnow
from app.models import Job, JobApplication, JobStatus, SavedJob, User
from app.schemas.job import JobIn
from app.services.auth import user_company_id
from app.services.common import audit, paginate

SORTS = {
    "newest": [Job.published_at.desc().nullslast(), Job.created_at.desc()],
    "salary": [Job.salary_max.desc().nullslast(), Job.published_at.desc().nullslast()],
    "deadline": [Job.deadline.asc().nullslast(), Job.published_at.desc().nullslast()],
}

_LOAD = (joinedload(Job.company), joinedload(Job.category))


@dataclass
class JobFilters:
    q: str | None = None
    location: str | None = None
    employment_type: str | None = None
    category_id: uuid.UUID | None = None
    experience_level: str | None = None
    workplace_type: str | None = None
    salary_min: int | None = None
    salary_max: int | None = None
    company_id: uuid.UUID | None = None
    sort: str = "newest"


def _like(term: str) -> str:
    # Escape LIKE wildcards in user input so "%" or "_" are matched literally.
    return "%" + term.replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_") + "%"


def public_query(f: JobFilters):
    stmt = (select(Job).options(*_LOAD)
            .where(Job.status == JobStatus.published.value,
                   or_(Job.deadline.is_(None), Job.deadline >= date.today())))
    if f.q:
        t = _like(f.q.strip())
        stmt = stmt.where(or_(Job.title.ilike(t), Job.description.ilike(t),
                              func.array_to_string(Job.skills, " ").ilike(t)))
    if f.location:
        stmt = stmt.where(Job.location.ilike(_like(f.location.strip())))
    if f.employment_type:
        stmt = stmt.where(Job.employment_type == f.employment_type)
    if f.experience_level:
        stmt = stmt.where(Job.experience_level == f.experience_level)
    if f.workplace_type:
        stmt = stmt.where(Job.workplace_type == f.workplace_type)
    if f.category_id:
        stmt = stmt.where(Job.category_id == f.category_id)
    if f.company_id:
        stmt = stmt.where(Job.company_id == f.company_id)
    if f.salary_min is not None:  # job pays at least this much at the top of its range
        stmt = stmt.where(Job.salary_max >= f.salary_min)
    if f.salary_max is not None:  # job starts at or below this
        stmt = stmt.where(Job.salary_min <= f.salary_max)
    return stmt.order_by(*SORTS.get(f.sort, SORTS["newest"]), Job.id)


def search_jobs(db: Session, f: JobFilters, page: int, page_size: int, user: User | None):
    rows, total = paginate(db, public_query(f), page, page_size)
    mark_saved(db, rows, user)
    return rows, total


def mark_saved(db: Session, jobs: list[Job], user: User | None, applied: bool = False) -> None:
    """Attach is_saved / has_applied flags using one query per flag (avoids N+1)."""
    ids = [j.id for j in jobs]
    saved: set[uuid.UUID] = set()
    done: set[uuid.UUID] = set()
    if user and ids:
        saved = set(db.scalars(select(SavedJob.job_id).where(SavedJob.user_id == user.id, SavedJob.job_id.in_(ids))))
        if applied:
            done = set(db.scalars(select(JobApplication.job_id).where(
                JobApplication.student_id == user.id, JobApplication.job_id.in_(ids))))
    for j in jobs:
        j.is_saved = j.id in saved  # type: ignore[attr-defined]
        j.has_applied = j.id in done  # type: ignore[attr-defined]


def attach_counts(db: Session, jobs: list[Job]) -> None:
    ids = [j.id for j in jobs]
    counts = dict(db.execute(select(JobApplication.job_id, func.count()).where(JobApplication.job_id.in_(ids))
                             .group_by(JobApplication.job_id)).all()) if ids else {}
    for j in jobs:
        j.application_count = counts.get(j.id, 0)  # type: ignore[attr-defined]


def get_public_job(db: Session, job_id: uuid.UUID, user: User | None) -> Job:
    job = db.scalar(select(Job).options(*_LOAD).where(Job.id == job_id))
    # Non-published jobs are visible only to their owner company and admins.
    visible = job is not None and (
        job.status in (JobStatus.published.value, JobStatus.closed.value)
        or (user is not None and (user.role == "admin" or (user.role == "employer" and user_company_id(user) == job.company_id)))
    )
    if not visible:
        raise NotFound("Job not found")
    mark_saved(db, [job], user, applied=True)
    return job


# ---- employer operations --------------------------------------------------

def _require_company(user: User) -> uuid.UUID:
    cid = user_company_id(user)
    if cid is None:
        raise AppError("Create your company profile before posting jobs", code="company_required")
    return cid


def get_owned_job(db: Session, user: User, job_id: uuid.UUID) -> Job:
    job = db.scalar(select(Job).options(*_LOAD).where(Job.id == job_id))
    if job is None:
        raise NotFound("Job not found")
    if job.company_id != user_company_id(user):
        # Same message as missing, so other employers can't probe for job IDs.
        raise NotFound("Job not found")
    return job


def create_job(db: Session, user: User, data: JobIn) -> Job:
    job = Job(company_id=_require_company(user), posted_by_id=user.id, **data.model_dump())
    db.add(job)
    audit(db, user.id, "job.created", "job", None)
    db.commit()
    return get_owned_job(db, user, job.id)


def update_job(db: Session, user: User, job_id: uuid.UUID, data: JobIn) -> Job:
    job = get_owned_job(db, user, job_id)
    if job.status == JobStatus.removed.value:
        raise Forbidden("This listing was removed by a moderator and cannot be edited")
    for k, v in data.model_dump().items():
        setattr(job, k, v)
    db.commit()
    return get_owned_job(db, user, job_id)


def publish_job(db: Session, user: User, job_id: uuid.UUID) -> Job:
    job = get_owned_job(db, user, job_id)
    if job.status == JobStatus.removed.value:
        raise Forbidden("This listing was removed by a moderator")
    if job.status == JobStatus.published.value:
        raise AppError("Job is already published", code="invalid_state")
    if job.deadline and job.deadline < date.today():
        raise AppError("The application deadline is in the past", code="invalid_deadline")
    job.status = JobStatus.published.value
    job.published_at = job.published_at or utcnow()
    audit(db, user.id, "job.published", "job", job.id)
    db.commit()
    return job


def close_job(db: Session, user: User, job_id: uuid.UUID) -> Job:
    job = get_owned_job(db, user, job_id)
    if job.status != JobStatus.published.value:
        raise AppError("Only published jobs can be closed", code="invalid_state")
    job.status = JobStatus.closed.value
    audit(db, user.id, "job.closed", "job", job.id)
    db.commit()
    return job


def delete_job(db: Session, user: User, job_id: uuid.UUID) -> None:
    job = get_owned_job(db, user, job_id)
    has_apps = db.scalar(select(func.count()).select_from(JobApplication).where(JobApplication.job_id == job.id))
    if has_apps:
        raise AppError("Jobs with applications cannot be deleted. Close the listing instead.", code="has_applications")
    audit(db, user.id, "job.deleted", "job", job.id, {"title": job.title})
    db.delete(job)
    db.commit()


def employer_jobs(db: Session, user: User, status: str | None, q: str | None, page: int, page_size: int):
    stmt = select(Job).options(*_LOAD).where(Job.company_id == _require_company(user))
    if status:
        stmt = stmt.where(Job.status == status)
    if q:
        stmt = stmt.where(Job.title.ilike(_like(q.strip())))
    rows, total = paginate(db, stmt.order_by(Job.created_at.desc()), page, page_size)
    attach_counts(db, rows)
    return rows, total
