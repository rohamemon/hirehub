import uuid
from typing import Annotated

from fastapi import APIRouter, Query

from app.core.dependencies import CurrentUser, DbSession, EmployerUser, StudentUser
from app.core.errors import NotFound
from app.models import ApplicationStatus
from app.schemas.application import ApplicantOut, ApplicationOut, StatusIn
from app.schemas.common import Page
from app.services import applications as svc
from app.services import storage
from app.services.common import audit

router = APIRouter(tags=["applications"])

PageNo = Annotated[int, Query(ge=1)]
PageSize = Annotated[int, Query(ge=1, le=50)]


@router.get("/applications/me", response_model=Page[ApplicationOut])
def my_applications(user: StudentUser, db: DbSession, status: ApplicationStatus | None = None,
                    page: PageNo = 1, page_size: PageSize = 10):
    rows, total = svc.student_applications(db, user, status.value if status else None, page, page_size)
    return Page.build(rows, total, page, page_size)


@router.get("/employer/applications", response_model=Page[ApplicantOut])
def applicants(user: EmployerUser, db: DbSession, status: ApplicationStatus | None = None,
               q: Annotated[str | None, Query(max_length=100)] = None, job_id: uuid.UUID | None = None,
               page: PageNo = 1, page_size: PageSize = 10):
    rows, total = svc.employer_applications(db, user, status.value if status else None, q, job_id, page, page_size)
    return Page.build(rows, total, page, page_size)


@router.get("/applications/{app_id}", response_model=ApplicantOut)
def get_application(app_id: uuid.UUID, user: CurrentUser, db: DbSession):
    return svc.get_viewable(db, user, app_id)


@router.patch("/applications/{app_id}/status", response_model=ApplicantOut)
def update_status(app_id: uuid.UUID, data: StatusIn, user: CurrentUser, db: DbSession):
    return svc.change_status(db, user, app_id, data.status)


@router.post("/applications/{app_id}/withdraw", response_model=ApplicationOut)
def withdraw(app_id: uuid.UUID, user: StudentUser, db: DbSession):
    return svc.withdraw(db, user, app_id)


@router.get("/applications/{app_id}/cv")
def download_cv(app_id: uuid.UUID, user: CurrentUser, db: DbSession):
    """Only the applicant, the employing company's recruiters, and admins may read a CV."""
    app = svc.get_viewable(db, user, app_id)
    if app.cv_file is None:
        raise NotFound("No CV attached")
    if user.id != app.student_id:
        audit(db, user.id, "cv.accessed", "application", app.id)
        db.commit()
    return storage.file_response(app.cv_file, {"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
                                 app.cv_file.original_name)
