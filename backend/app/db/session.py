from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import get_settings

_s = get_settings()
if _s.serverless:
    # Serverless functions are short-lived and many may run at once: don't keep a pool
    # (the database's pooler does that), and disable prepared statements so Supabase's
    # transaction pooler (port 6543) works.
    engine = create_engine(_s.database_url, poolclass=NullPool, connect_args={"prepare_threshold": None})
else:
    engine = create_engine(_s.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """One session per request; endpoints/services commit explicitly."""
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
