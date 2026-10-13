"""Employer-only endpoints: company, job management, analytics."""
import uuid
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Query, UploadFile
from sqlalchemy import func, select

from app.core.dependencies import DbSession, EmployerUser
from app.core.errors import AppError, NotFound
from app.core.security import utcnow
from app.models import Company, FileKind, Job, JobApplication, JobStatus
from app.schemas.common import Message, Page
from app.schemas.job import CompanyIn, CompanyOut, JobIn, JobListItem, JobOut
from app.services import jobs as svc
from app.services import storage
from app.services.auth import unique_slug, user_company_id
from app.services.common import audit

router = APIRouter(prefix="/employer", tags=["employer"])


def _company_out(db, c: Company) -> CompanyOut:
    out = CompanyOut.model_validate(c)
    out.open_jobs = db.scalar(select(func.count()).select_from(Job).where(Job.company_id == c.id, Job.status == "published")) or 0
    return out


@router.get("/company", response_model=CompanyOut)
def my_company(user: EmployerUser, db: DbSession):
    cid = user_company_id(user)
    if cid is None:
        raise NotFound("No company profile yet")
    return _company_out(db, db.get(Company, cid))


@router.post("/company", response_model=CompanyOut, status_code=201)
def create_company(data: CompanyIn, user: EmployerUser, db: DbSession):
    if user_company_id(user):
        raise AppError("You already have a company profile", code="company_exists")
    if db.scalar(select(Company.id).where(Company.name == data.name)):
        raise AppError("A company with this name already exists", code="company_taken")
    c = Company(**data.model_dump(), slug=unique_slug(db, data.name))
    db.add(c)
    db.flush()
    user.employer_profile.company_id = c.id
    audit(db, user.id, "company.created", "company", c.id)
    db.commit()
    return _company_out(db, c)


@router.put("/company", response_model=CompanyOut)
def update_company(data: CompanyIn, user: EmployerUser, db: DbSession):
    cid = user_company_id(user)
    if cid is None:
        raise NotFound("No company profile yet")
    c = db.get(Company, cid)
    clash = db.scalar(select(Company.id).where(Company.name == data.name, Company.id != cid))
    if clash:
        raise AppError("A company with this name already exists", code="company_taken")
    for k, v in data.model_dump().items():
        setattr(c, k, v)  # slug stays stable so public URLs don't break
    db.commit()
    return _company_out(db, c)


@router.post("/company/logo", response_model=CompanyOut, status_code=201)
def upload_logo(file: UploadFile, user: EmployerUser, db: DbSession):
    cid = user_company_id(user)
    if cid is None:
        raise NotFound("Create your company profile first")
    c = db.get(Company, cid)
    new = storage.save_upload(db, user, FileKind.logo, file)
    old = c.logo_file
    c.logo_file_id = new.id
    db.flush()
    storage.delete_file(db, old)
    db.commit()
    return _company_out(db, c)


# ---- jobs ------------------------------------------------------------------

@router.get("/jobs", response_model=Page[JobListItem])
def my_jobs(user: EmployerUser, db: DbSession, status: JobStatus | None = None,
            q: Annotated[str | None, Query(max_length=100)] = None,
            page: Annotated[int, Query(ge=1)] = 1, page_size: Annotated[int, Query(ge=1, le=50)] = 10):
    rows, total = svc.employer_jobs(db, user, status.value if status else None, q, page, page_size)
    return Page.build(rows, total, page, page_size)


def _job_out(db, job: Job) -> Job:
    svc.attach_counts(db, [job])
    return job


@router.post("/jobs", response_model=JobOut, status_code=201)
def create_job(data: JobIn, user: EmployerUser, db: DbSession):
    """Creates a DRAFT. Publish with POST /employer/jobs/{id}/publish."""
    return _job_out(db, svc.create_job(db, user, data))


@router.get("/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: uuid.UUID, user: EmployerUser, db: DbSession):
    return _job_out(db, svc.get_owned_job(db, user, job_id))


@router.put("/jobs/{job_id}", response_model=JobOut)
def update_job(job_id: uuid.UUID, data: JobIn, user: EmployerUser, db: DbSession):
    return _job_out(db, svc.update_job(db, user, job_id, data))


@router.post("/jobs/{job_id}/publish", response_model=JobOut)
def publish(job_id: uuid.UUID, user: EmployerUser, db: DbSession):
    return _job_out(db, svc.publish_job(db, user, job_id))


@router.post("/jobs/{job_id}/close", response_model=JobOut)
def close(job_id: uuid.UUID, user: EmployerUser, db: DbSession):
    return _job_out(db, svc.close_job(db, user, job_id))


@router.delete("/jobs/{job_id}", response_model=Message)
def delete(job_id: uuid.UUID, user: EmployerUser, db: DbSession):
    svc.delete_job(db, user, job_id)
    return Message(message="Job deleted")


# ---- analytics ------------------------------------------------------------

@router.get("/stats")
def stats(user: EmployerUser, db: DbSession):
    cid = user_company_id(user)
    empty = {"total_jobs": 0, "published_jobs": 0, "active_vacancies": 0, "total_applications": 0,
             "by_status": {}, "trend": []}
    if cid is None:
        return empty
    job_counts = dict(db.execute(select(Job.status, func.count()).where(Job.company_id == cid).group_by(Job.status)).all())
    by_status = dict(db.execute(select(JobApplication.status, func.count()).join(Job, Job.id == JobApplication.job_id)
                                .where(Job.company_id == cid).group_by(JobApplication.status)).all())
    since = utcnow() - timedelta(days=29)
    day = func.date_trunc("day", JobApplication.created_at)
    trend_rows = db.execute(select(day, func.count()).join(Job, Job.id == JobApplication.job_id)
                            .where(Job.company_id == cid, JobApplication.created_at >= since)
                            .group_by(day).order_by(day)).all()
    return {
        "total_jobs": sum(job_counts.values()),
        "published_jobs": job_counts.get("published", 0),
        "active_vacancies": job_counts.get("published", 0),
        "total_applications": sum(by_status.values()),
        "by_status": by_status,
        "trend": [{"date": d.date().isoformat(), "applications": n} for d, n in trend_rows],
    }
