"""Applications: submit, withdraw, employer review with enforced status transitions."""
import uuid

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.errors import AppError, Conflict, NotFound
from app.models import (
    EMPLOYER_TRANSITIONS,
    WITHDRAWABLE,
    ApplicationStatus,
    ApplicationStatusHistory,
    Job,
    JobApplication,
    JobStatus,
    StudentProfile,
    User,
)
from app.services.auth import user_company_id
from app.services.common import audit, notify, paginate
from app.services.email import send_email
from app.services.jobs import _like

_JOB_LOAD = joinedload(JobApplication.job).options(joinedload(Job.company), joinedload(Job.category))


def apply_to_job(db: Session, student: User, job_id: uuid.UUID, cover_letter: str | None) -> JobApplication:
    job = db.scalar(select(Job).options(joinedload(Job.company)).where(Job.id == job_id))
    if job is None or job.status == JobStatus.removed.value or job.status == JobStatus.draft.value:
        raise NotFound("Job not found")
    if not job.is_open:
        raise AppError("This job is no longer accepting applications", code="job_closed")
    profile = db.get(StudentProfile, student.id)
    if profile is None or profile.cv_file_id is None:
        raise AppError("Upload your CV in your profile before applying", code="cv_required")
    if db.scalar(select(JobApplication.id).where(JobApplication.job_id == job_id, JobApplication.student_id == student.id)):
        raise Conflict("You have already applied to this job", code="already_applied")

    app = JobApplication(job_id=job_id, student_id=student.id, cv_file_id=profile.cv_file_id,
                         cover_letter=cover_letter or None)
    app.history.append(ApplicationStatusHistory(from_status=None, to_status=ApplicationStatus.pending.value,
                                                changed_by_id=student.id))
    db.add(app)
    try:
        db.flush()
    except IntegrityError:  # concurrent double-submit: the DB unique constraint is the final guard
        db.rollback()
        raise Conflict("You have already applied to this job", code="already_applied")

    notify(db, student.id, "Application submitted", f"You applied to {job.title} at {job.company.name}.", "/dashboard/applications")
    send_email(student.email, f"Application received: {job.title}",
               f"Hi {student.full_name}, your application to {job.title} at {job.company.name} was received.")
    # Notify every recruiter of the company.
    from app.models import EmployerProfile
    for uid in db.scalars(select(EmployerProfile.user_id).where(EmployerProfile.company_id == job.company_id)):
        notify(db, uid, "New application", f"{student.full_name} applied to {job.title}.", "/employer/applicants")
        recruiter = db.get(User, uid)
        send_email(recruiter.email, f"New applicant for {job.title}", f"{student.full_name} just applied to {job.title}.")
    db.commit()
    return get_application(db, app.id)


def get_application(db: Session, app_id: uuid.UUID) -> JobApplication:
    app = db.scalar(select(JobApplication).options(
        _JOB_LOAD, joinedload(JobApplication.student).joinedload(User.student_profile),
        selectinload(JobApplication.history)).where(JobApplication.id == app_id))
    if app is None:
        raise NotFound("Application not found")
    return app


def can_view(user: User, app: JobApplication) -> bool:
    if user.role == "admin":
        return True
    if user.role == "student":
        return app.student_id == user.id
    if user.role == "employer":
        return user_company_id(user) == app.job.company_id
    return False


def get_viewable(db: Session, user: User, app_id: uuid.UUID) -> JobApplication:
    app = get_application(db, app_id)
    if not can_view(user, app):
        raise NotFound("Application not found")  # don't reveal existence
    return app


def student_applications(db: Session, student: User, status: str | None, page: int, page_size: int):
    stmt = select(JobApplication).options(_JOB_LOAD).where(JobApplication.student_id == student.id)
    if status:
        stmt = stmt.where(JobApplication.status == status)
    return paginate(db, stmt.order_by(JobApplication.created_at.desc()), page, page_size)


def employer_applications(db: Session, employer: User, status: str | None, q: str | None,
                          job_id: uuid.UUID | None, page: int, page_size: int):
    cid = user_company_id(employer)
    if cid is None:
        return [], 0
    stmt = (select(JobApplication)
            .join(Job, Job.id == JobApplication.job_id)
            .join(User, User.id == JobApplication.student_id)
            .options(_JOB_LOAD, joinedload(JobApplication.student).joinedload(User.student_profile))
            .where(Job.company_id == cid))
    if status:
        stmt = stmt.where(JobApplication.status == status)
    if job_id:
        stmt = stmt.where(JobApplication.job_id == job_id)
    if q:
        t = _like(q.strip())
        stmt = stmt.where(or_(User.full_name.ilike(t), User.email.ilike(t), Job.title.ilike(t)))
    return paginate(db, stmt.order_by(JobApplication.created_at.desc()), page, page_size)


def _record(app: JobApplication, new: ApplicationStatus, actor: User) -> None:
    app.history.append(ApplicationStatusHistory(from_status=app.status, to_status=new.value, changed_by_id=actor.id))
    app.status = new.value


def change_status(db: Session, actor: User, app_id: uuid.UUID, new: ApplicationStatus) -> JobApplication:
    if actor.role not in ("employer", "admin"):
        raise AppError("Not allowed", code="forbidden")
    app = get_viewable(db, actor, app_id)
    current = ApplicationStatus(app.status)
    if new not in EMPLOYER_TRANSITIONS[current]:
        raise AppError(f"Cannot change status from '{current.value}' to '{new.value}'", code="invalid_transition")
    _record(app, new, actor)
    audit(db, actor.id, "application.status_changed", "application", app.id, {"from": current.value, "to": new.value})
    student = app.student
    title = app.job.title
    notify(db, student.id, f"Application {new.value}", f"Your application for {title} is now: {new.value}.", "/dashboard/applications")
    send_email(student.email, f"Update on your application: {title}", f"Your application status is now '{new.value}'.")
    db.commit()
    return app


def withdraw(db: Session, student: User, app_id: uuid.UUID) -> JobApplication:
    app = get_viewable(db, student, app_id)
    if app.student_id != student.id:
        raise NotFound("Application not found")
    if ApplicationStatus(app.status) not in WITHDRAWABLE:
        raise AppError("This application can no longer be withdrawn", code="invalid_transition")
    _record(app, ApplicationStatus.withdrawn, student)
    db.commit()
    return app
