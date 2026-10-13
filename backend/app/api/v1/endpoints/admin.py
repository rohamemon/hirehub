"""Administrator endpoints. Every route requires the admin role, enforced server-side."""
import uuid
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload

from app.core.dependencies import AdminUser, DbSession, require_roles
from app.core.errors import AppError, Conflict, NotFound
from app.models import (
    AuditLog,
    Company,
    Job,
    JobApplication,
    JobCategory,
    JobStatus,
    ReportedJob,
    ReportStatus,
    Role,
    User,
)
from app.schemas.common import ORM, Message, Page
from app.schemas.job import CategoryIn, CategoryOut, JobListItem
from app.schemas.user import UserOut
from app.services import auth as auth_svc
from app.services.common import audit, notify, paginate, slugify
from app.services.jobs import _like

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_roles(Role.admin))])

PageNo = Annotated[int, Query(ge=1)]
PageSize = Annotated[int, Query(ge=1, le=100)]


@router.get("/stats")
def stats(db: DbSession):
    def count(model, *where):
        return db.scalar(select(func.count()).select_from(model).where(*where)) or 0

    roles = dict(db.execute(select(User.role, func.count()).group_by(User.role)).all())
    jobs = dict(db.execute(select(Job.status, func.count()).group_by(Job.status)).all())
    recent = db.scalars(select(AuditLog).options(joinedload(AuditLog.actor)).order_by(AuditLog.created_at.desc()).limit(8)).all()
    return {
        "total_users": sum(roles.values()),
        "students": roles.get("student", 0),
        "employers": roles.get("employer", 0),
        "admins": roles.get("admin", 0),
        "companies": count(Company),
        "total_jobs": sum(jobs.values()),
        "published_jobs": jobs.get("published", 0),
        "closed_jobs": jobs.get("closed", 0),
        "total_applications": count(JobApplication),
        "open_reports": count(ReportedJob, ReportedJob.status == "open"),
        "recent_activity": [AuditOut.model_validate(a).model_dump(mode="json") for a in recent],
    }


# ---- users ----------------------------------------------------------------

@router.get("/users", response_model=Page[UserOut])
def users(db: DbSession, q: Annotated[str | None, Query(max_length=100)] = None, role: Role | None = None,
          is_active: bool | None = None, page: PageNo = 1, page_size: PageSize = 20):
    stmt = select(User).options(joinedload(User.employer_profile))
    if q:
        t = _like(q.strip())
        stmt = stmt.where(User.email.ilike(t) | User.full_name.ilike(t))
    if role:
        stmt = stmt.where(User.role == role.value)
    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)
    rows, total = paginate(db, stmt.order_by(User.created_at.desc()), page, page_size)
    return Page.build(rows, total, page, page_size)


class UserPatch(BaseModel):
    is_active: bool


@router.patch("/users/{user_id}", response_model=UserOut)
def set_user_active(user_id: uuid.UUID, data: UserPatch, admin: AdminUser, db: DbSession):
    target = db.get(User, user_id)
    if target is None:
        raise NotFound("User not found")
    if target.id == admin.id:
        raise AppError("You cannot change your own account status", code="invalid_action")
    if target.role == Role.admin.value:
        raise AppError("Administrator accounts cannot be disabled here", code="invalid_action")
    target.is_active = data.is_active
    if not data.is_active:
        auth_svc.revoke_all_for_user(db, target.id)
    audit(db, admin.id, "user.reactivated" if data.is_active else "user.disabled", "user", target.id)
    db.commit()
    return target


# ---- jobs & reports ---------------------------------------------------------

@router.get("/jobs", response_model=Page[JobListItem])
def all_jobs(db: DbSession, status: JobStatus | None = None, q: Annotated[str | None, Query(max_length=100)] = None,
             page: PageNo = 1, page_size: PageSize = 20):
    stmt = select(Job).options(joinedload(Job.company), joinedload(Job.category))
    if status:
        stmt = stmt.where(Job.status == status.value)
    if q:
        stmt = stmt.where(Job.title.ilike(_like(q.strip())))
    rows, total = paginate(db, stmt.order_by(Job.created_at.desc()), page, page_size)
    return Page.build(rows, total, page, page_size)


class ModerateIn(BaseModel):
    action: Literal["remove", "restore"]


@router.post("/jobs/{job_id}/moderate", response_model=JobListItem)
def moderate_job(job_id: uuid.UUID, data: ModerateIn, admin: AdminUser, db: DbSession):
    job = db.scalar(select(Job).options(joinedload(Job.company), joinedload(Job.category)).where(Job.id == job_id))
    if job is None:
        raise NotFound("Job not found")
    if data.action == "remove":
        job.status = JobStatus.removed.value
    elif job.status == JobStatus.removed.value:
        job.status = JobStatus.closed.value  # restored as closed; the employer can republish
    else:
        raise AppError("Job is not removed", code="invalid_state")
    audit(db, admin.id, f"job.{data.action}d", "job", job.id, {"title": job.title})
    notify(db, job.posted_by_id, f"Listing {data.action}d by moderator", job.title, "/employer/jobs")
    db.commit()
    return job


class ReportOut(ORM):
    id: uuid.UUID
    reason: str
    details: str | None
    status: str
    created_at: datetime
    job: JobListItem


@router.get("/reports", response_model=Page[ReportOut])
def reports(db: DbSession, status: ReportStatus | None = ReportStatus.open, page: PageNo = 1, page_size: PageSize = 20):
    stmt = select(ReportedJob).options(joinedload(ReportedJob.job).options(joinedload(Job.company), joinedload(Job.category)))
    if status:
        stmt = stmt.where(ReportedJob.status == status.value)
    rows, total = paginate(db, stmt.order_by(ReportedJob.created_at.desc()), page, page_size)
    return Page.build(rows, total, page, page_size)


class ResolveIn(BaseModel):
    action: Literal["resolve", "dismiss"]
    remove_job: bool = False


@router.post("/reports/{report_id}/resolve", response_model=Message)
def resolve_report(report_id: uuid.UUID, data: ResolveIn, admin: AdminUser, db: DbSession):
    r = db.get(ReportedJob, report_id)
    if r is None:
        raise NotFound("Report not found")
    r.status = ReportStatus.resolved.value if data.action == "resolve" else ReportStatus.dismissed.value
    r.resolved_by_id = admin.id
    if data.remove_job:
        r.job.status = JobStatus.removed.value
    audit(db, admin.id, f"report.{r.status}", "report", r.id, {"job_removed": data.remove_job})
    db.commit()
    return Message(message="Report updated")


# ---- categories -------------------------------------------------------------

@router.post("/categories", response_model=CategoryOut, status_code=201)
def create_category(data: CategoryIn, admin: AdminUser, db: DbSession):
    cat = JobCategory(name=data.name, slug=slugify(data.name), icon=data.icon)
    db.add(cat)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise Conflict("A category with this name already exists")
    audit(db, admin.id, "category.created", "category", cat.id)
    db.commit()
    return cat


@router.put("/categories/{cat_id}", response_model=CategoryOut)
def update_category(cat_id: uuid.UUID, data: CategoryIn, admin: AdminUser, db: DbSession):
    cat = db.get(JobCategory, cat_id)
    if cat is None:
        raise NotFound("Category not found")
    cat.name, cat.slug, cat.icon = data.name, slugify(data.name), data.icon
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise Conflict("A category with this name already exists")
    audit(db, admin.id, "category.updated", "category", cat.id)
    db.commit()
    return cat


@router.delete("/categories/{cat_id}", response_model=Message)
def delete_category(cat_id: uuid.UUID, admin: AdminUser, db: DbSession):
    cat = db.get(JobCategory, cat_id)
    if cat is None:
        raise NotFound("Category not found")
    audit(db, admin.id, "category.deleted", "category", cat.id, {"name": cat.name})
    db.delete(cat)  # jobs keep existing; category_id becomes NULL (ON DELETE SET NULL)
    db.commit()
    return Message(message="Category deleted")


# ---- audit log ----------------------------------------------------------------

class AuditOut(ORM):
    id: uuid.UUID
    action: str
    entity_type: str | None
    entity_id: str | None
    detail: dict | None
    created_at: datetime
    actor_email: str | None = None

    @classmethod
    def model_validate(cls, obj, **kw):  # type: ignore[override]
        o = super().model_validate(obj, **kw)
        o.actor_email = obj.actor.email if getattr(obj, "actor", None) else None
        return o


@router.get("/audit-logs", response_model=Page[AuditOut])
def audit_logs(db: DbSession, action: Annotated[str | None, Query(max_length=80)] = None,
               page: PageNo = 1, page_size: PageSize = 30):
    stmt = select(AuditLog).options(joinedload(AuditLog.actor))
    if action:
        stmt = stmt.where(AuditLog.action == action)
    rows, total = paginate(db, stmt.order_by(AuditLog.created_at.desc()), page, page_size)
    return Page.build([AuditOut.model_validate(r) for r in rows], total, page, page_size)
