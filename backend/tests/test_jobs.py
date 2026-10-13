from datetime import date, timedelta

from tests.conftest import JOB, auth, make_job, register

API = "/api/v1"


def test_employer_needs_company_to_post(client):
    h = auth(register(client, "nocompany@example.com", "employer"))
    r = client.post(f"{API}/employer/jobs", json=JOB, headers=h)
    assert r.status_code == 400 and r.json()["error"]["code"] == "company_required"
    r = client.post(f"{API}/employer/company", json={"name": "Fresh Co", "website": "https://fresh.example"}, headers=h)
    assert r.status_code == 201
    assert client.post(f"{API}/employer/jobs", json=JOB, headers=h).status_code == 201


def test_student_cannot_post_jobs(client, student):
    assert client.post(f"{API}/employer/jobs", json=JOB, headers=student).status_code == 403


def test_draft_publish_close_lifecycle(client, employer):
    job = make_job(client, employer, publish=False)
    assert job["status"] == "draft"
    # Drafts are not public.
    assert client.get(f"{API}/jobs/{job['id']}").status_code == 404
    assert client.get(f"{API}/jobs").json()["total"] == 0
    client.post(f"{API}/employer/jobs/{job['id']}/publish", headers=employer)
    assert client.get(f"{API}/jobs/{job['id']}").json()["is_open"] is True
    assert client.get(f"{API}/jobs").json()["total"] == 1
    assert client.post(f"{API}/employer/jobs/{job['id']}/publish", headers=employer).status_code == 400
    r = client.post(f"{API}/employer/jobs/{job['id']}/close", headers=employer)
    assert r.json()["status"] == "closed"
    assert client.get(f"{API}/jobs").json()["total"] == 0
    assert client.get(f"{API}/jobs/{job['id']}").json()["is_open"] is False


def test_job_validation(client, employer):
    bad = {**JOB, "salary_min": 5000, "salary_max": 100}
    assert client.post(f"{API}/employer/jobs", json=bad, headers=employer).status_code == 422
    bad = {**JOB, "location": None}  # hybrid needs a location
    assert client.post(f"{API}/employer/jobs", json=bad, headers=employer).status_code == 422
    bad = {**JOB, "employment_type": "bogus"}
    assert client.post(f"{API}/employer/jobs", json=bad, headers=employer).status_code == 422
    assert client.post(f"{API}/employer/jobs", json={**JOB, "workplace_type": "remote", "location": None}, headers=employer).status_code == 201


def test_ownership_edit_close_delete(client, employer, employer2):
    job = make_job(client, employer)
    jid = job["id"]
    assert client.put(f"{API}/employer/jobs/{jid}", json=JOB, headers=employer2).status_code == 404
    assert client.post(f"{API}/employer/jobs/{jid}/close", headers=employer2).status_code == 404
    assert client.delete(f"{API}/employer/jobs/{jid}", headers=employer2).status_code == 404
    assert client.get(f"{API}/employer/jobs/{jid}", headers=employer2).status_code == 404
    r = client.put(f"{API}/employer/jobs/{jid}", json={**JOB, "title": "Renamed role"}, headers=employer)
    assert r.json()["title"] == "Renamed role"
    assert client.delete(f"{API}/employer/jobs/{jid}", headers=employer).status_code == 200


def test_search_and_filters(client, employer):
    make_job(client, employer, title="Python Developer", description="Ship services in our core platform team.", location="Berlin", employment_type="full_time",
             experience_level="mid", workplace_type="on_site", salary_min=60000, salary_max=80000)
    make_job(client, employer, title="Design Intern", skills=["UX"], location="Paris", employment_type="internship",
             workplace_type="remote", salary_min=500, salary_max=900, description="Figma and user research all day long.")
    make_job(client, employer, title="Marketing Lead", description="Own campaigns across every channel.", location="Berlin", employment_type="full_time",
             experience_level="senior", salary_min=90000, salary_max=120000, skills=["SEO"])

    def total(**params):
        r = client.get(f"{API}/jobs", params=params)
        assert r.status_code == 200, r.text
        return r.json()["total"]

    assert total() == 3
    assert total(q="python") == 1
    assert total(q="figma") == 1  # matches description
    assert total(q="seo") == 1    # matches skills
    assert total(location="berlin") == 2
    assert total(employment_type="internship") == 1
    assert total(workplace_type="remote") == 1
    assert total(experience_level="senior") == 1
    assert total(salary_min=100000) == 1
    assert total(salary_max=1000) == 1
    assert total(q="%") == 0  # wildcard is escaped, not a match-all
    assert client.get(f"{API}/jobs", params={"employment_type": "nope"}).status_code == 422
    assert client.get(f"{API}/jobs", params={"page_size": 500}).status_code == 422
    assert client.get(f"{API}/jobs", params={"page": 0}).status_code == 422


def test_pagination_and_sorting(client, employer):
    for i in range(5):
        make_job(client, employer, title=f"Role number {i}", salary_max=1000 * (i + 1), salary_min=1)
    r = client.get(f"{API}/jobs", params={"page_size": 2, "page": 3}).json()
    assert r["total"] == 5 and r["pages"] == 3 and len(r["items"]) == 1
    newest = client.get(f"{API}/jobs").json()["items"]
    assert newest[0]["title"] == "Role number 4"
    by_salary = client.get(f"{API}/jobs", params={"sort": "salary"}).json()["items"]
    assert by_salary[0]["title"] == "Role number 4"
    assert client.get(f"{API}/jobs", params={"sort": "evil"}).status_code == 422


def test_past_deadline_hidden_and_not_applicable(client, employer, db):
    from app.models import Job
    job = make_job(client, employer)
    db.query(Job).update({"deadline": date.today() - timedelta(days=1)})
    db.commit()
    assert client.get(f"{API}/jobs").json()["total"] == 0
    assert client.get(f"{API}/jobs/{job['id']}").json()["is_open"] is False


def test_saved_jobs(client, student, employer):
    job = make_job(client, employer)
    jid = job["id"]
    assert client.put(f"{API}/saved-jobs/{jid}").status_code == 401
    assert client.put(f"{API}/saved-jobs/{jid}", headers=student).status_code == 201
    assert client.put(f"{API}/saved-jobs/{jid}", headers=student).status_code == 201  # idempotent, no duplicate
    assert client.get(f"{API}/saved-jobs", headers=student).json()["total"] == 1
    assert client.get(f"{API}/jobs/{jid}", headers=student).json()["is_saved"] is True
    assert client.get(f"{API}/jobs", headers=student).json()["items"][0]["is_saved"] is True
    assert client.delete(f"{API}/saved-jobs/{jid}", headers=student).status_code == 200
    assert client.get(f"{API}/saved-jobs", headers=student).json()["total"] == 0


def test_company_pages(client, employer):
    make_job(client, employer)
    r = client.get(f"{API}/companies/acme-labs")
    assert r.status_code == 200 and r.json()["open_jobs"] == 1
    cid = r.json()["id"]
    assert client.get(f"{API}/jobs", params={"company_id": cid}).json()["total"] == 1
    assert client.get(f"{API}/companies/missing").status_code == 404
    r = client.put(f"{API}/employer/company", json={"name": "Acme Labs", "location": "Oslo"}, headers=employer)
    assert r.json()["location"] == "Oslo" and r.json()["slug"] == "acme-labs"


def test_report_job(client, student, employer):
    job = make_job(client, employer)
    body = {"reason": "spam", "details": "looks fake"}
    assert client.post(f"{API}/jobs/{job['id']}/report", json=body, headers=student).status_code == 201
    assert client.post(f"{API}/jobs/{job['id']}/report", json=body, headers=student).status_code == 409
    assert client.post(f"{API}/jobs/{job['id']}/report", json=body).status_code == 401
