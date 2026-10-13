import os
from pathlib import Path

from tests.conftest import PDF, PNG, auth, make_job, register, upload_cv

API = "/api/v1"


def apply(client, headers, job_id, letter=None):
    return client.post(f"{API}/jobs/{job_id}/apply", json={"cover_letter": letter}, headers=headers)


def test_apply_requires_cv(client, student, employer):
    job = make_job(client, employer)
    r = apply(client, student, job["id"])
    assert r.status_code == 400 and r.json()["error"]["code"] == "cv_required"


def test_apply_flow_and_duplicate_prevention(client, student, employer):
    job = make_job(client, employer)
    assert upload_cv(client, student).status_code == 201
    r = apply(client, student, job["id"], "Hello!")
    assert r.status_code == 201
    assert r.json()["status"] == "pending" and r.json()["has_cv"] is True
    dup = apply(client, student, job["id"])
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "already_applied"
    assert client.get(f"{API}/jobs/{job['id']}", headers=student).json()["has_applied"] is True
    mine = client.get(f"{API}/applications/me", headers=student).json()
    assert mine["total"] == 1 and mine["items"][0]["job"]["title"] == job["title"]


def test_only_students_can_apply_and_auth_required(client, employer, student):
    job = make_job(client, employer)
    assert apply(client, employer, job["id"]).status_code == 403
    assert client.post(f"{API}/jobs/{job['id']}/apply", json={}).status_code == 401


def test_cannot_apply_to_closed_or_draft(client, student, employer):
    upload_cv(client, student)
    closed = make_job(client, employer)
    client.post(f"{API}/employer/jobs/{closed['id']}/close", headers=employer)
    r = apply(client, student, closed["id"])
    assert r.status_code == 400 and r.json()["error"]["code"] == "job_closed"
    draft = make_job(client, employer, publish=False)
    assert apply(client, student, draft["id"]).status_code == 404


def test_notifications_created_on_apply(client, student, employer):
    job = make_job(client, employer)
    upload_cv(client, student)
    apply(client, student, job["id"])
    assert client.get(f"{API}/notifications", headers=employer).json()["total"] == 1
    assert client.get(f"{API}/notifications", headers=student).json()["total"] == 1
    n = client.get(f"{API}/notifications", headers=employer).json()["items"][0]
    assert client.get(f"{API}/notifications/unread-count", headers=employer).json()["count"] == 1
    # Can't read another user's notification.
    assert client.post(f"{API}/notifications/{n['id']}/read", headers=student).status_code == 404
    assert client.post(f"{API}/notifications/{n['id']}/read", headers=employer).json()["is_read"] is True


def _applied(client, student, employer):
    job = make_job(client, employer)
    upload_cv(client, student)
    return job, apply(client, student, job["id"]).json()


def test_status_transitions(client, student, employer):
    _, app = _applied(client, student, employer)
    url = f"{API}/applications/{app['id']}/status"

    def set_status(s, h=employer):
        return client.patch(url, json={"status": s}, headers=h)

    assert set_status("accepted").status_code == 400  # pending -> accepted not allowed
    assert set_status("interview").status_code == 400
    assert set_status("reviewed").status_code == 200
    assert set_status("shortlisted").status_code == 200
    assert set_status("interview").status_code == 200
    r = set_status("accepted")
    assert r.status_code == 200
    assert [h["to_status"] for h in r.json()["history"]] == ["pending", "reviewed", "shortlisted", "interview", "accepted"]
    assert set_status("rejected").status_code == 400  # terminal
    assert set_status("bogus").status_code == 422
    # Student receives a notification for each change.
    assert client.get(f"{API}/notifications", headers=student).json()["total"] == 5


def test_student_cannot_change_status(client, student, employer):
    _, app = _applied(client, student, employer)
    r = client.patch(f"{API}/applications/{app['id']}/status", json={"status": "accepted"}, headers=student)
    assert r.status_code == 400 or r.status_code == 403
    assert client.get(f"{API}/applications/{app['id']}", headers=student).json()["status"] == "pending"


def test_employer_cannot_touch_other_employers_applications(client, student, employer, employer2):
    _, app = _applied(client, student, employer)
    aid = app["id"]
    assert client.get(f"{API}/applications/{aid}", headers=employer2).status_code == 404
    assert client.patch(f"{API}/applications/{aid}/status", json={"status": "reviewed"}, headers=employer2).status_code == 404
    assert client.get(f"{API}/applications/{aid}/cv", headers=employer2).status_code == 404
    assert client.get(f"{API}/employer/applications", headers=employer2).json()["total"] == 0
    assert client.get(f"{API}/employer/applications", headers=employer).json()["total"] == 1


def test_other_student_cannot_view_or_withdraw(client, student, student2, employer):
    _, app = _applied(client, student, employer)
    assert client.get(f"{API}/applications/{app['id']}", headers=student2).status_code == 404
    assert client.post(f"{API}/applications/{app['id']}/withdraw", headers=student2).status_code == 404


def test_withdraw(client, student, employer):
    _, app = _applied(client, student, employer)
    r = client.post(f"{API}/applications/{app['id']}/withdraw", headers=student)
    assert r.json()["status"] == "withdrawn"
    assert client.post(f"{API}/applications/{app['id']}/withdraw", headers=student).status_code == 400
    r = client.patch(f"{API}/applications/{app['id']}/status", json={"status": "reviewed"}, headers=employer)
    assert r.status_code == 400
    # And cannot re-apply after withdrawing (unique per job/student).
    assert apply(client, student, app["job"]["id"]).status_code == 409


def test_applicant_search_and_filter(client, student, student2, employer):
    job = make_job(client, employer)
    for h in (student, student2):
        upload_cv(client, h)
        apply(client, h, job["id"])
    apps = client.get(f"{API}/employer/applications", headers=employer).json()["items"]
    client.patch(f"{API}/applications/{apps[0]['id']}/status", json={"status": "shortlisted"}, headers=employer)
    assert client.get(f"{API}/employer/applications", params={"status": "shortlisted"}, headers=employer).json()["total"] == 1
    assert client.get(f"{API}/employer/applications", params={"q": "second"}, headers=employer).json()["total"] == 1
    r = client.get(f"{API}/employer/applications", headers=employer).json()["items"][0]
    assert "phone" not in r["student"] and r["student"]["full_name"]


def test_employer_stats(client, student, employer):
    job, app = _applied(client, student, employer)
    s = client.get(f"{API}/employer/stats", headers=employer).json()
    assert s["published_jobs"] == 1 and s["total_applications"] == 1 and s["by_status"] == {"pending": 1}
    assert sum(p["applications"] for p in s["trend"]) == 1
    jobs = client.get(f"{API}/employer/jobs", headers=employer).json()["items"]
    assert jobs[0]["application_count"] == 1
    # Jobs with applications can't be deleted.
    assert client.delete(f"{API}/employer/jobs/{job['id']}", headers=employer).status_code == 400


def test_student_stats(client, student, employer):
    job, _ = _applied(client, student, employer)
    client.put(f"{API}/saved-jobs/{job['id']}", headers=student)
    s = client.get(f"{API}/students/me/stats", headers=student).json()
    assert s["total_applications"] == 1 and s["pending"] == 1 and s["saved_jobs"] == 1


# ---- uploads & CV access ------------------------------------------------------

def test_cv_upload_validation(client, student):
    assert upload_cv(client, student, b"not a pdf at all", "cv.pdf").status_code == 400
    # Spoofed: PNG bytes named .pdf with a PDF content type
    assert upload_cv(client, student, PNG, "cv.pdf").status_code == 400
    assert upload_cv(client, student, b"").status_code == 400
    big = PDF + b"0" * (5 * 1024 * 1024)
    r = upload_cv(client, student, big)
    assert r.status_code == 400 and r.json()["error"]["code"] == "file_too_large"
    ok = upload_cv(client, student, PDF, "../../evil name.pdf")
    assert ok.status_code == 201 and ok.json()["cv_filename"] == "evil name.pdf"
    stored = os.listdir(os.environ["UPLOAD_DIR"])
    assert all(len(f) == 36 and f.endswith(".pdf") for f in stored)  # random names, not user input


def test_cv_download_permissions(client, student, student2, employer, employer2, admin):
    _, app = _applied(client, student, employer)
    url = f"{API}/applications/{app['id']}/cv"
    assert client.get(url).status_code == 401
    assert client.get(url, headers=student2).status_code == 404
    assert client.get(url, headers=employer2).status_code == 404
    for h in (student, employer, admin):
        r = client.get(url, headers=h)
        assert r.status_code == 200 and r.content == PDF
        assert "no-store" in r.headers["cache-control"]
    assert client.get(f"{API}/students/me/cv", headers=student).content == PDF
    assert client.get(f"{API}/students/me/cv", headers=student2).status_code == 404  # no CV of their own


def test_replacing_cv_keeps_file_used_by_application(client, student, employer):
    _, app = _applied(client, student, employer)
    upload_cv(client, student, PDF + b"v2", "new.pdf")
    assert client.get(f"{API}/applications/{app['id']}/cv", headers=employer).content == PDF
    assert client.delete(f"{API}/students/me/cv", headers=student).status_code == 200
    assert client.get(f"{API}/students/me", headers=student).json()["cv_filename"] is None


def test_logo_upload_and_public_access(client, employer):
    r = client.post(f"{API}/employer/company/logo", files={"file": ("l.png", PNG, "image/png")}, headers=employer)
    assert r.status_code == 201 and r.json()["has_logo"] is True
    assert client.get(f"{API}/companies/{r.json()['id']}/logo").status_code == 200
    bad = client.post(f"{API}/employer/company/logo", files={"file": ("l.png", PDF, "image/png")}, headers=employer)
    assert bad.status_code == 400


def test_student_profile_update(client, student):
    r = client.put(f"{API}/students/me", json={"headline": "Aspiring dev", "skills": ["Python", "SQL"],
                                               "github_url": "https://github.com/x", "full_name": "Stu Updated"}, headers=student)
    assert r.status_code == 200 and r.json()["skills"] == ["Python", "SQL"] and r.json()["full_name"] == "Stu Updated"
    assert client.put(f"{API}/students/me", json={"github_url": "javascript:alert(1)"}, headers=student).status_code == 422
    assert client.get(f"{API}/students/me", headers=register_employer(client)).status_code == 403


def register_employer(client):
    return auth(register(client, "e3@example.com", "employer"))


def test_s3_storage_backend_roundtrip(client, student, employer, monkeypatch):
    """Same upload/authorization behaviour when files live in an S3-compatible bucket (fake in-memory client)."""
    from app.core.config import get_settings
    from app.services import storage

    class FakeS3:
        def __init__(self): self.objs = {}
        def put_object(self, Bucket, Key, Body, ContentType): self.objs[Key] = Body
        def get_object(self, Bucket, Key):
            import io
            return {"Body": io.BytesIO(self.objs[Key])}
        def delete_object(self, Bucket, Key): self.objs.pop(Key, None)

    fake = FakeS3()
    monkeypatch.setattr(get_settings(), "storage_backend", "s3")
    monkeypatch.setattr(storage, "_s3", lambda: fake)
    before = set(os.listdir(os.environ["UPLOAD_DIR"]))
    job, app = _applied(client, student, employer)
    assert len(fake.objs) == 1 and set(os.listdir(os.environ["UPLOAD_DIR"])) == before  # nothing written to local disk
    r = client.get(f"{API}/applications/{app['id']}/cv", headers=employer)
    assert r.status_code == 200 and r.content == PDF and "attachment" in r.headers["content-disposition"]
    assert client.get(f"{API}/applications/{app['id']}/cv", headers=student).content == PDF
