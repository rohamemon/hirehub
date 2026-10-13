import uuid
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import func, select, update

from app.core.dependencies import CurrentUser, DbSession
from app.core.errors import NotFound
from app.models import Notification
from app.schemas.common import Message, NotificationOut, Page
from app.services.common import paginate

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=Page[NotificationOut])
def list_notifications(user: CurrentUser, db: DbSession, unread_only: bool = False,
                       page: Annotated[int, Query(ge=1)] = 1, page_size: Annotated[int, Query(ge=1, le=50)] = 20):
    stmt = select(Notification).where(Notification.user_id == user.id)
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))
    rows, total = paginate(db, stmt.order_by(Notification.created_at.desc()), page, page_size)
    return Page.build(rows, total, page, page_size)


@router.get("/unread-count")
def unread_count(user: CurrentUser, db: DbSession):
    n = db.scalar(select(func.count()).select_from(Notification).where(Notification.user_id == user.id, Notification.is_read.is_(False)))
    return {"count": n or 0}


@router.post("/read-all", response_model=Message)
def read_all(user: CurrentUser, db: DbSession):
    db.execute(update(Notification).where(Notification.user_id == user.id).values(is_read=True))
    db.commit()
    return Message(message="All notifications marked as read")


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_read(notification_id: uuid.UUID, user: CurrentUser, db: DbSession):
    n = db.get(Notification, notification_id)
    if n is None or n.user_id != user.id:
        raise NotFound("Notification not found")
    n.is_read = True
    db.commit()
    return n
