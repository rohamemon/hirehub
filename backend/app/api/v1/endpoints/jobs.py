"""Public job browsing, saved jobs, applying, reporting and categories."""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.dependencies import CurrentUser, DbSession, OptionalUser, StudentUser
from app.core.errors import Conflict, NotFound
from app.core.rate_limit import rate_limit
from app.models import (
    EmploymentType,
    ExperienceLevel,
    Job,
    JobCategory,
    JobStatus,
    ReportedJob,
    SavedJob,
    WorkplaceType,
)
from app.schemas.application import ApplicationOut, ApplyIn
from app.schemas.common import Message, Page
from app.schemas.job import CategoryOut, JobListItem, JobOut, ReportIn
from app.services import applications as app_svc
from app.services import jobs as svc
from app.services.common import paginate

router = APIRouter(tags=["jobs"])


@router.get("/categories", response_model=list[CategoryOut])
def categories(db: DbSession):
    return db.scalars(select(JobCategory).order_by(JobCategory.name)).all()


@router.get("/jobs", response_model=Page[JobListItem])
def list_jobs(
    db: DbSession,
    user: OptionalUser,
    q: Annotated[str | None, Query(max_length=100)] = None,
    location: Annotated[str | None, Query(max_length=100)] = None,
    employment_type: EmploymentType | None = None,
    experience_level: ExperienceLevel | None = None,
    workplace_type: WorkplaceType | None = None,
    category_id: uuid.UUID | None = None,
    company_id: uuid.UUID | None = None,
    salary_min: Annotated[int | None, Query(ge=0)] = None,
    salary_max: Annotated[int | None, Query(ge=0)] = None,
    sort: Annotated[str, Query(pattern="^(newest|salary|deadline)$")] = "newest",
    page: Annotated[int, Query(ge=1, le=10000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 10,
):
    f = svc.JobFilters(q=q, location=location,
                       employment_type=employment_type.value if employment_type else None,
                       experience_level=experience_level.value if experience_level else None,
                       workplace_type=workplace_type.value if workplace_type else None,
                       category_id=category_id, company_id=company_id,
                       salary_min=salary_min, salary_max=salary_max, sort=sort)
    rows, total = svc.search_jobs(db, f, page, page_size, user)
    return Page.build(rows, total, page, page_size)


@router.get("/jobs/facets")
def job_facets(db: DbSession):
    """Distinct job titles and locations of open jobs, for search dropdowns."""
    open_jobs = svc.public_query(svc.JobFilters()).subquery()
    titles = db.scalars(select(open_jobs.c.title).distinct().order_by(open_jobs.c.title).limit(300)).all()
    locations = db.scalars(select(open_jobs.c.location).where(open_jobs.c.location.is_not(None))
                           .distinct().order_by(open_jobs.c.location).limit(300)).all()
    return {"titles": titles, "locations": locations}


@router.get("/jobs/{job_id}", response_model=JobOut)
def job_detail(job_id: uuid.UUID, db: DbSession, user: OptionalUser):
    return svc.get_public_job(db, job_id, user)


@router.get("/jobs/{job_id}/related", response_model=list[JobListItem])
def related_jobs(job_id: uuid.UUID, db: DbSession, user: OptionalUser):
    job = svc.get_public_job(db, job_id, user)
    f = svc.JobFilters(category_id=job.category_id) if job.category_id else svc.JobFilters(employment_type=job.employment_type)
    rows = [j for j in svc.search_jobs(db, f, 1, 5, user)[0] if j.id != job.id][:4]
    return rows


@router.post("/jobs/{job_id}/apply", response_model=ApplicationOut, status_code=201,
             dependencies=[Depends(rate_limit("apply", 30, 3600))])
def apply(job_id: uuid.UUID, data: ApplyIn, user: StudentUser, db: DbSession):
    return app_svc.apply_to_job(db, user, job_id, data.cover_letter)


@router.post("/jobs/{job_id}/report", response_model=Message, status_code=201,
             dependencies=[Depends(rate_limit("report", 10, 3600))])
def report_job(job_id: uuid.UUID, data: ReportIn, user: CurrentUser, db: DbSession):
    job = db.get(Job, job_id)
    if job is None or job.status != JobStatus.published.value:
        raise NotFound("Job not found")
    db.add(ReportedJob(job_id=job_id, reporter_id=user.id, reason=data.reason, details=data.details))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise Conflict("You have already reported this job")
    return Message(message="Thanks, our team will review this listing.")


# ---- saved jobs ----------------------------------------------------------

@router.get("/saved-jobs", response_model=Page[JobListItem])
def saved_jobs(user: StudentUser, db: DbSession,
               page: Annotated[int, Query(ge=1)] = 1, page_size: Annotated[int, Query(ge=1, le=50)] = 10):
    from sqlalchemy.orm import joinedload
    stmt = (select(Job).join(SavedJob, SavedJob.job_id == Job.id)
            .options(joinedload(Job.company), joinedload(Job.category))
            .where(SavedJob.user_id == user.id, Job.status.in_(["published", "closed"]))
            .order_by(SavedJob.created_at.desc()))
    rows, total = paginate(db, stmt, page, page_size)
    for r in rows:
        r.is_saved = True  # type: ignore[attr-defined]
    return Page.build(rows, total, page, page_size)


@router.put("/saved-jobs/{job_id}", response_model=Message, status_code=201)
def save_job(job_id: uuid.UUID, user: StudentUser, db: DbSession):
    job = db.get(Job, job_id)
    if job is None or job.status != JobStatus.published.value:
        raise NotFound("Job not found")
    if not db.scalar(select(SavedJob.id).where(SavedJob.user_id == user.id, SavedJob.job_id == job_id)):
        db.add(SavedJob(user_id=user.id, job_id=job_id))
        try:
            db.commit()
        except IntegrityError:  # idempotent under concurrent requests
            db.rollback()
    return Message(message="Saved")


@router.delete("/saved-jobs/{job_id}", response_model=Message)
def unsave_job(job_id: uuid.UUID, user: StudentUser, db: DbSession):
    row = db.scalar(select(SavedJob).where(SavedJob.user_id == user.id, SavedJob.job_id == job_id))
    if row:
        db.delete(row)
        db.commit()
    return Message(message="Removed")
