from sqlalchemy import select

from app.models import AuthToken, User
from tests.conftest import PASSWORD, auth, register

API = "/api/v1"


def test_register_and_login(client):
    register(client, "a@example.com")
    r = client.post(f"{API}/auth/login", json={"email": "A@Example.com", "password": PASSWORD})
    assert r.status_code == 200
    body = r.json()
    assert body["user"]["role"] == "student"
    assert "password" not in str(body)
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie


def test_cannot_register_as_admin(client):
    r = client.post(f"{API}/auth/register", json={"email": "x@example.com", "password": PASSWORD,
                                                  "full_name": "Evil", "role": "admin"})
    assert r.status_code == 422


def test_duplicate_email_rejected(client):
    register(client, "a@example.com")
    r = client.post(f"{API}/auth/register", json={"email": "a@example.com", "password": PASSWORD,
                                                  "full_name": "Again", "role": "student"})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "email_taken"


def test_weak_password_rejected(client):
    r = client.post(f"{API}/auth/register", json={"email": "w@example.com", "password": "short",
                                                  "full_name": "Weak", "role": "student"})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"


def test_invalid_credentials(client):
    register(client, "a@example.com")
    for email, pw in [("a@example.com", "WrongPass1"), ("nobody@example.com", PASSWORD)]:
        r = client.post(f"{API}/auth/login", json={"email": email, "password": pw})
        assert r.status_code == 401
        assert r.json()["error"]["code"] == "invalid_credentials"


def test_authentication_required(client):
    assert client.get(f"{API}/auth/me").status_code == 401
    assert client.get(f"{API}/auth/me", headers=auth("garbage")).status_code == 401
    assert client.get(f"{API}/applications/me").status_code == 401


def test_me(client, student):
    r = client.get(f"{API}/auth/me", headers=student)
    assert r.json()["email"] == "stu@example.com"


def test_refresh_rotation_and_reuse_detection(client):
    register(client, "a@example.com")
    h = {"X-Requested-With": "HireHub"}
    old_cookie = client.cookies.get("hirehub_refresh")
    r = client.post(f"{API}/auth/refresh", headers=h)
    assert r.status_code == 200 and r.json()["access_token"]
    new_cookie = client.cookies.get("hirehub_refresh")
    assert new_cookie != old_cookie
    # Replaying the old (rotated) token is treated as theft: the whole family is revoked.
    client.cookies.set("hirehub_refresh", old_cookie, path="/api/v1/auth")
    assert client.post(f"{API}/auth/refresh", headers=h).status_code == 401
    client.cookies.set("hirehub_refresh", new_cookie, path="/api/v1/auth")
    assert client.post(f"{API}/auth/refresh", headers=h).status_code == 401


def test_refresh_requires_csrf_header_and_allowed_origin(client):
    register(client, "a@example.com")
    assert client.post(f"{API}/auth/refresh").status_code == 403
    r = client.post(f"{API}/auth/refresh", headers={"X-Requested-With": "HireHub", "Origin": "http://evil.example"})
    assert r.status_code == 403
    r = client.post(f"{API}/auth/refresh", headers={"X-Requested-With": "HireHub", "Origin": "http://localhost:5173"})
    assert r.status_code == 200


def test_logout_revokes_refresh(client):
    register(client, "a@example.com")
    h = {"X-Requested-With": "HireHub"}
    cookie = client.cookies.get("hirehub_refresh")
    assert client.post(f"{API}/auth/logout", headers=h).status_code == 200
    client.cookies.set("hirehub_refresh", cookie, path="/api/v1/auth")
    assert client.post(f"{API}/auth/refresh", headers=h).status_code == 401


def test_password_reset_flow(client, db, monkeypatch):
    register(client, "a@example.com")
    sent = []
    monkeypatch.setattr("app.services.auth.send_email", lambda to, subj, body: sent.append(body))
    r = client.post(f"{API}/auth/forgot-password", json={"email": "a@example.com"})
    assert r.status_code == 200
    # Unknown emails get an identical response (no enumeration).
    r2 = client.post(f"{API}/auth/forgot-password", json={"email": "ghost@example.com"})
    assert r2.json() == r.json()
    assert len(sent) == 1
    token = sent[0].split("token=")[1].split()[0]
    # Only the hash is stored.
    assert all(t.token_hash != token for t in db.scalars(select(AuthToken)))
    new_pw = "BrandNew123"
    assert client.post(f"{API}/auth/reset-password", json={"token": token, "password": new_pw}).status_code == 200
    assert client.post(f"{API}/auth/reset-password", json={"token": token, "password": new_pw}).status_code == 400  # single use
    assert client.post(f"{API}/auth/login", json={"email": "a@example.com", "password": new_pw}).status_code == 200
    assert client.post(f"{API}/auth/login", json={"email": "a@example.com", "password": PASSWORD}).status_code == 401


def test_email_verification(client, db, monkeypatch):
    sent = []
    monkeypatch.setattr("app.services.auth.send_email", lambda to, subj, body: sent.append(body))
    register(client, "a@example.com")
    token = sent[0].split("token=")[1].split()[0]
    assert client.post(f"{API}/auth/verify-email", json={"token": token}).status_code == 200
    assert db.scalar(select(User.email_verified).where(User.email == "a@example.com")) is True
    assert client.post(f"{API}/auth/verify-email", json={"token": "nope"}).status_code == 400


def test_disabled_user_loses_access_immediately(client, admin, db):
    token = register(client, "a@example.com")
    uid = client.get(f"{API}/auth/me", headers=auth(token)).json()["id"]
    assert client.patch(f"{API}/admin/users/{uid}", json={"is_active": False}, headers=admin).status_code == 200
    assert client.get(f"{API}/auth/me", headers=auth(token)).status_code == 401
    assert client.post(f"{API}/auth/login", json={"email": "a@example.com", "password": PASSWORD}).status_code == 401


def test_login_rate_limit(client):
    from app.core.config import get_settings
    s = get_settings()
    s.rate_limit_enabled = True
    try:
        codes = [client.post(f"{API}/auth/login", json={"email": "a@example.com", "password": "Wrong1234"}).status_code
                 for _ in range(12)]
    finally:
        s.rate_limit_enabled = False
    assert codes[:10] == [401] * 10 and codes[10] == 429
