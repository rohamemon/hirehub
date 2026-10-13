"""Small shared helpers: audit log, notifications, pagination, slugs."""
import re
import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import AuditLog, Notification


def audit(db: Session, actor_id: uuid.UUID | None, action: str, entity_type: str | None = None,
          entity_id: Any = None, detail: dict | None = None) -> None:
    db.add(AuditLog(actor_id=actor_id, action=action, entity_type=entity_type,
                    entity_id=str(entity_id) if entity_id else None, detail=detail))


def notify(db: Session, user_id: uuid.UUID, title: str, body: str | None = None, link: str | None = None) -> None:
    db.add(Notification(user_id=user_id, title=title, body=body, link=link))


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "item"


def paginate(db: Session, stmt, page: int, page_size: int) -> tuple[list, int]:
    """Run `stmt` with LIMIT/OFFSET and return (rows, total)."""
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.scalars(stmt.limit(page_size).offset((page - 1) * page_size)).all()
    return list(rows), total
