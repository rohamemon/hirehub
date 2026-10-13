import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models import Job, JobApplication, SavedJob, User
from tests.conftest import PASSWORD, auth, make_job, register, upload_cv

API = "/api/v1"


@pytest.mark.parametrize("path", ["/admin/stats", "/admin/users", "/admin/jobs", "/admin/reports", "/admin/audit-logs"])
def test_admin_routes_forbidden_for_non_admins(client, student, employer, path):
    assert client.get(API + path).status_code == 401
    assert client.get(API + path, headers=student).status_code == 403
    assert client.get(API + path, headers=employer).status_code == 403


def test_admin_stats_and_users(client, admin, student, employer):
    s = client.get(f"{API}/admin/stats", headers=admin).json()
    assert s["students"] == 1 and s["employers"] == 1 and s["admins"] == 1 and s["companies"] == 1
    r = client.get(f"{API}/admin/users", params={"q": "stu@"}, headers=admin).json()
    assert r["total"] == 1 and "password_hash" not in str(r)
    assert client.get(f"{API}/admin/users", params={"role": "employer"}, headers=admin).json()["total"] == 1


def test_admin_cannot_disable_self_or_admins(client, admin):
    me = client.get(f"{API}/auth/me", headers=admin).json()
    assert client.patch(f"{API}/admin/users/{me['id']}", json={"is_active": False}, headers=admin).status_code == 400


def test_non_admin_cannot_disable_users(client, student, employer):
    me = client.get(f"{API}/auth/me", headers=employer).json()
    assert client.patch(f"{API}/admin/users/{me['id']}", json={"is_active": False}, headers=student).status_code == 403


def test_moderation_and_reports(client, admin, student, employer):
    job = make_job(client, employer)
    client.post(f"{API}/jobs/{job['id']}/report", json={"reason": "scam"}, headers=student)
    reports = client.get(f"{API}/admin/reports", headers=admin).json()
    assert reports["total"] == 1
    rid = reports["items"][0]["id"]
    r = client.post(f"{API}/admin/reports/{rid}/resolve", json={"action": "resolve", "remove_job": True}, headers=admin)
    assert r.status_code == 200
    assert client.get(f"{API}/jobs").json()["total"] == 0
    assert client.get(f"{API}/jobs/{job['id']}").status_code == 404
    # The employer can no longer edit or republish a removed job.
    assert client.put(f"{API}/employer/jobs/{job['id']}", json={**job, "skills": []}, headers=employer).status_code == 403
    assert client.post(f"{API}/employer/jobs/{job['id']}/publish", headers=employer).status_code == 403
    # Restore -> closed; employer may republish.
    r = client.post(f"{API}/admin/jobs/{job['id']}/moderate", json={"action": "restore"}, headers=admin)
    assert r.json()["status"] == "closed"
    assert client.post(f"{API}/employer/jobs/{job['id']}/publish", headers=employer).status_code == 200
    actions = {a["action"] for a in client.get(f"{API}/admin/audit-logs", headers=admin).json()["items"]}
    assert {"job.published", "report.resolved", "job.restored"} <= actions


def test_category_management(client, admin, student):
    r = client.post(f"{API}/admin/categories", json={"name": "Data Science"}, headers=admin)
    assert r.status_code == 201 and r.json()["slug"] == "data-science"
    assert client.post(f"{API}/admin/categories", json={"name": "Data Science"}, headers=admin).status_code == 409
    assert client.post(f"{API}/admin/categories", json={"name": "Hack"}, headers=student).status_code == 403
    assert len(client.get(f"{API}/categories").json()) == 1
    cid = r.json()["id"]
    assert client.delete(f"{API}/admin/categories/{cid}", headers=admin).status_code == 200


def test_deleting_category_keeps_jobs(client, admin, employer):
    cid = client.post(f"{API}/admin/categories", json={"name": "Ops"}, headers=admin).json()["id"]
    job = make_job(client, employer, category_id=cid)
    assert job["category"]["name"] == "Ops"
    client.delete(f"{API}/admin/categories/{cid}", headers=admin)
    assert client.get(f"{API}/jobs/{job['id']}").json()["category"] is None


# ---- database-level constraints (bypassing the API) -------------------------------

def _user(db, email="u@example.com", role="student"):
    u = User(email=email, password_hash="x", full_name="U", role=role)
    db.add(u)
    db.flush()
    return u


def test_db_rejects_invalid_role(db):
    db.add(User(email="bad@example.com", password_hash="x", full_name="Bad", role="superuser"))
    with pytest.raises(IntegrityError):
        db.commit()


def test_db_unique_application_and_saved_job(client, db, employer):
    job = make_job(client, employer)
    jid = uuid.UUID(job["id"])
    u = _user(db)
    db.add(JobApplication(job_id=jid, student_id=u.id))
    db.commit()
    db.add(JobApplication(job_id=jid, student_id=u.id))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    db.add(SavedJob(user_id=u.id, job_id=jid))
    db.commit()
    db.add(SavedJob(user_id=u.id, job_id=jid))
    with pytest.raises(IntegrityError):
        db.commit()


def test_db_rejects_invalid_application_status_and_salary(client, db, employer):
    job = make_job(client, employer)
    u = _user(db)
    db.add(JobApplication(job_id=uuid.UUID(job["id"]), student_id=u.id, status="maybe"))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    row = db.scalar(select(Job))
    row.salary_min, row.salary_max = 9, 1
    with pytest.raises(IntegrityError):
        db.commit()


def test_db_application_requires_valid_job(db):
    u = _user(db)
    db.add(JobApplication(job_id=uuid.uuid4(), student_id=u.id))
    with pytest.raises(IntegrityError):
        db.commit()


# ---- error handling ------------------------------------------------------------------

def test_error_format_and_404(client):
    r = client.get(f"{API}/jobs/{uuid.uuid4()}")
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"
    assert client.get(f"{API}/jobs/not-a-uuid").status_code == 422
    assert client.get("/health").json() == {"status": "ok"}


def test_security_headers(client):
    r = client.get("/health")
    assert r.headers["x-content-type-options"] == "nosniff" and r.headers["x-frame-options"] == "DENY"
