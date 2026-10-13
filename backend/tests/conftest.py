import os
import tempfile

# Must be set BEFORE the app is imported. Tests use a dedicated database.
TEST_DB = os.environ.get("TEST_DATABASE_URL", "postgresql+psycopg://hirehub:hirehub_dev_password@localhost:5433/hirehub_test")
assert TEST_DB.rsplit("/", 1)[-1].endswith("_test"), "Refusing to run tests against a non-test database"
os.environ.update(DATABASE_URL=TEST_DB, ENVIRONMENT="test", RATE_LIMIT_ENABLED="false",
                  UPLOAD_DIR=tempfile.mkdtemp(prefix="hirehub_test_uploads_"),
                  CORS_ORIGINS="http://localhost:5173")

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.rate_limit import reset_rate_limits  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Role, User  # noqa: E402

PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


@pytest.fixture(scope="session", autouse=True)
def _schema():
    """Build the schema by running the real Alembic migrations (tests them too)."""
    cfg = Config("alembic.ini")
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    yield


@pytest.fixture(autouse=True)
def _clean():
    reset_rate_limits()
    yield
    with engine.begin() as conn:
        tables = conn.execute(text("select tablename from pg_tables where schemaname='public' and tablename <> 'alembic_version'")).scalars().all()
        conn.execute(text("TRUNCATE " + ", ".join(f'"{t}"' for t in tables) + " RESTART IDENTITY CASCADE"))


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def db():
    with SessionLocal() as s:
        yield s


PASSWORD = "Passw0rd!x"


def register(client, email, role="student", name="Test User", company=None):
    body = {"email": email, "password": PASSWORD, "full_name": name, "role": role}
    if company:
        body["company_name"] = company
    r = client.post("/api/v1/auth/register", json=body)
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def student(client):
    return auth(register(client, "stu@example.com", "student", "Stu Dent"))


@pytest.fixture
def student2(client):
    return auth(register(client, "stu2@example.com", "student", "Second Student"))


@pytest.fixture
def employer(client):
    return auth(register(client, "emp@example.com", "employer", "Emma Ployer", company="Acme Labs"))


@pytest.fixture
def employer2(client):
    return auth(register(client, "emp2@example.com", "employer", "Other Boss", company="Globex"))


@pytest.fixture
def admin(client, db):
    db.add(User(email="admin@example.com", password_hash=hash_password(PASSWORD), full_name="Root Admin",
                role=Role.admin.value, is_active=True, email_verified=True))
    db.commit()
    r = client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": PASSWORD})
    return auth(r.json()["access_token"])


JOB = {
    "title": "Backend Engineering Intern",
    "description": "Build APIs with Python and FastAPI alongside a friendly team.",
    "responsibilities": "Write endpoints", "requirements": "Know Python",
    "skills": ["Python", "SQL"], "employment_type": "internship", "experience_level": "entry",
    "workplace_type": "hybrid", "location": "Berlin", "salary_min": 1000, "salary_max": 2000,
}


def make_job(client, headers, publish=True, **over):
    r = client.post("/api/v1/employer/jobs", json={**JOB, **over}, headers=headers)
    assert r.status_code == 201, r.text
    job = r.json()
    if publish:
        r = client.post(f"/api/v1/employer/jobs/{job['id']}/publish", headers=headers)
        assert r.status_code == 200, r.text
        job = r.json()
    return job


def upload_cv(client, headers, content=PDF, name="cv.pdf"):
    return client.post("/api/v1/students/me/cv", files={"file": (name, content, "application/pdf")}, headers=headers)
