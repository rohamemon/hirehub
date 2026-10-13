"""Student profile, CV and avatar management, plus the dashboard summary."""
import uuid

from fastapi import APIRouter, UploadFile
from sqlalchemy import func, select

from app.core.dependencies import CurrentUser, DbSession, StudentUser
from app.core.errors import NotFound
from app.models import FileKind, JobApplication, SavedJob, StudentProfile, User
from app.schemas.common import Message
from app.schemas.user import StudentProfileIn, StudentProfileOut
from app.services import storage
from app.services.auth import user_company_id

router = APIRouter(tags=["students"])


def _profile(db, user: User) -> StudentProfile:
    p = db.get(StudentProfile, user.id)
    if p is None:  # defensive: should always exist for students
        p = StudentProfile(user_id=user.id, skills=[])
        db.add(p)
        db.flush()
    return p


@router.get("/students/me", response_model=StudentProfileOut)
def get_profile(user: StudentUser, db: DbSession):
    return _profile(db, user)


@router.put("/students/me", response_model=StudentProfileOut)
def update_profile(data: StudentProfileIn, user: StudentUser, db: DbSession):
    p = _profile(db, user)
    values = data.model_dump(exclude_unset=True)
    if values.get("full_name"):
        user.full_name = values.pop("full_name")
    values.pop("full_name", None)
    for k, v in values.items():
        setattr(p, k, v if k != "skills" else (v or []))
    db.commit()
    return p


def _replace_file(db, user: User, p: StudentProfile, attr: str, kind: FileKind, upload: UploadFile):
    new = storage.save_upload(db, user, kind, upload)
    old_id = getattr(p, attr)
    setattr(p, attr, new.id)
    db.flush()
    if old_id:
        old = db.get(storage.UploadedFile, old_id)
        # An old CV that an application still points to must be kept for the employer.
        in_use = db.scalar(select(func.count()).select_from(JobApplication).where(JobApplication.cv_file_id == old_id))
        if old and not in_use:
            storage.delete_file(db, old)
    db.commit()


@router.post("/students/me/cv", response_model=StudentProfileOut, status_code=201)
def upload_cv(file: UploadFile, user: StudentUser, db: DbSession):
    p = _profile(db, user)
    _replace_file(db, user, p, "cv_file_id", FileKind.cv, file)
    return p


@router.delete("/students/me/cv", response_model=Message)
def delete_cv(user: StudentUser, db: DbSession):
    p = _profile(db, user)
    if p.cv_file_id:
        old = p.cv_file
        in_use = db.scalar(select(func.count()).select_from(JobApplication).where(JobApplication.cv_file_id == old.id))
        p.cv_file_id = None
        db.flush()
        if not in_use:
            storage.delete_file(db, old)
        db.commit()
    return Message(message="CV removed")


@router.get("/students/me/cv")
def download_my_cv(user: StudentUser, db: DbSession):
    p = _profile(db, user)
    if not p.cv_file:
        raise NotFound("No CV uploaded")
    return _pdf(p.cv_file)


def _pdf(record):
    return storage.file_response(record, {"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
                                 record.original_name)


@router.post("/students/me/avatar", response_model=StudentProfileOut, status_code=201)
def upload_avatar(file: UploadFile, user: StudentUser, db: DbSession):
    p = _profile(db, user)
    _replace_file(db, user, p, "avatar_file_id", FileKind.avatar, file)
    return p


@router.get("/users/{user_id}/avatar")
def get_avatar(user_id: uuid.UUID, viewer: CurrentUser, db: DbSession):
    """Avatar visible to: the owner, admins, and employers who received an application from them."""
    p = db.get(StudentProfile, user_id)
    if p is None or p.avatar_file is None:
        raise NotFound("No avatar")
    allowed = viewer.id == user_id or viewer.role == "admin"
    if not allowed and viewer.role == "employer":
        from app.models import Job
        cid = user_company_id(viewer)
        allowed = bool(cid and db.scalar(select(JobApplication.id).join(Job, Job.id == JobApplication.job_id)
                                         .where(JobApplication.student_id == user_id, Job.company_id == cid).limit(1)))
    if not allowed:
        raise NotFound("No avatar")
    return storage.file_response(p.avatar_file, {"Cache-Control": "private, max-age=60", "X-Content-Type-Options": "nosniff"})


@router.get("/students/me/stats")
def student_stats(user: StudentUser, db: DbSession):
    rows = dict(db.execute(select(JobApplication.status, func.count()).where(JobApplication.student_id == user.id)
                           .group_by(JobApplication.status)).all())
    saved = db.scalar(select(func.count()).select_from(SavedJob).where(SavedJob.user_id == user.id)) or 0
    return {"total_applications": sum(rows.values()), "pending": rows.get("pending", 0),
            "shortlisted": rows.get("shortlisted", 0), "saved_jobs": saved, "by_status": rows}
