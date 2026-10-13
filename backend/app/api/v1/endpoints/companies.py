"""Public company pages. Logos are intentionally public."""
import uuid
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.core.dependencies import DbSession
from app.core.errors import NotFound
from app.models import Company, Job
from app.schemas.common import Page
from app.schemas.job import CompanyOut
from app.services import storage
from app.services.common import paginate

router = APIRouter(prefix="/companies", tags=["companies"])


def _with_counts(db, companies: list[Company]) -> list[CompanyOut]:
    ids = [c.id for c in companies]
    counts = dict(db.execute(select(Job.company_id, func.count()).where(Job.company_id.in_(ids), Job.status == "published")
                             .group_by(Job.company_id)).all()) if ids else {}
    out = []
    for c in companies:
        o = CompanyOut.model_validate(c)
        o.open_jobs = counts.get(c.id, 0)
        out.append(o)
    return out


@router.get("", response_model=Page[CompanyOut])
def list_companies(db: DbSession, q: Annotated[str | None, Query(max_length=100)] = None,
                   page: Annotated[int, Query(ge=1)] = 1, page_size: Annotated[int, Query(ge=1, le=50)] = 12):
    stmt = select(Company)
    if q:
        stmt = stmt.where(Company.name.ilike(f"%{q.strip()}%"))
    rows, total = paginate(db, stmt.order_by(Company.name), page, page_size)
    return Page.build(_with_counts(db, rows), total, page, page_size)


@router.get("/{slug}", response_model=CompanyOut)
def company_detail(slug: str, db: DbSession):
    c = db.scalar(select(Company).where(Company.slug == slug))
    if c is None:
        raise NotFound("Company not found")
    return _with_counts(db, [c])[0]


@router.get("/{company_id}/logo")
def company_logo(company_id: uuid.UUID, db: DbSession):
    c = db.get(Company, company_id)
    if c is None or c.logo_file is None:
        raise NotFound("No logo")
    return storage.file_response(c.logo_file, {"Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff"})
