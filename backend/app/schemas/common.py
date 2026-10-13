import math
import uuid
from datetime import datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int

    @classmethod
    def build(cls, items: list, total: int, page: int, page_size: int):
        return cls(items=items, total=total, page=page, page_size=page_size,
                   pages=max(1, math.ceil(total / page_size)))


class Message(BaseModel):
    message: str


class NotificationOut(ORM):
    id: uuid.UUID
    title: str
    body: str | None
    link: str | None
    is_read: bool
    created_at: datetime
