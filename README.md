# HireHub

A full-stack job and internship platform connecting **students**, **employers** and **administrators**.
Built as a portfolio project with React + TypeScript on the front end and FastAPI + PostgreSQL on the back end.

> **Live demo:** <https://hirehub-roha.vercel.app> (Vercel + Supabase free tiers; first request after idle can be slow).
> The production site starts with job categories only, so the job list is empty until employers post jobs.
> See [Verification](#verification) for exactly what was tested, and [`DEPLOY.md`](DEPLOY.md) to deploy your own copy.

## Features

- **Students:** profile, PDF CV upload (private), photo, search/filter jobs, save jobs, apply with optional cover letter, track status, withdraw.
- **Employers:** company profile + logo, create drafts / publish / edit / close / delete jobs, applicant list with search + status filter, review cover letters and CVs, move candidates through a validated pipeline, analytics (Recharts).
- **Admins:** platform stats, user search + disable/reactivate, job moderation, reported listings, category management, audit log.
- **Platform:** JWT access tokens + rotating refresh cookie, role- and resource-level authorization, rate limiting, in-app notifications, email abstraction (console in dev, SMTP in prod), dynamic sitemap, JSON-LD `JobPosting` data.

## Tech stack (and why)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React 18, TypeScript, Vite 5, Tailwind 3, React Router 6, TanStack Query 5, React Hook Form + Zod, Recharts, Lucide | Vite 5 (not 6) because Vitest 2 bundles Vite 5; Tailwind 3 is the stable, widely documented line |
| Backend | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0 (typed ORM), Alembic, psycopg 3 | OpenAPI docs come free with FastAPI |
| Auth | PyJWT (HS256), Argon2id (`argon2-cffi`) | |
| DB | PostgreSQL 16 | |
| Tests | Pytest + HTTPX/TestClient; Vitest + React Testing Library | |
| Infra | Docker Compose, nginx | |

## Architecture

```
Browser ──► nginx (static React build)  ──/api/*──►  FastAPI  ──►  PostgreSQL
              one origin, so cookies need no CORS          └──► private upload dir (volume)
```

- **Layers:** `api/v1/endpoints` (thin HTTP, validation via Pydantic) → `services` (business rules, queries, authorization) → `models` (SQLAlchemy). I did not add a separate *repositories* layer: SQLAlchemy sessions already act as one, and an extra wrapper would be indirection without benefit at this size.
- **Same-origin by design.** Vite's dev proxy and nginx both forward `/api` to FastAPI, so the browser sees a single origin. That makes `SameSite=Lax` cookies work and keeps CORS a fallback rather than a dependency.
- **Server state** lives in TanStack Query; the only client auth state is the current user and an in-memory access token.

```
hirehub/
  backend/
    app/
      core/        config, security (hash/JWT), dependencies (auth/roles), errors, rate_limit
      db/          Base + session
      models/      typed ORM models + enums (CHECK-constrained)
      schemas/     Pydantic request/response models
      services/    auth, jobs, applications, storage, email, common (audit/notify/paginate)
      api/v1/      router + endpoints (auth, students, jobs, employer, applications, companies, notifications, admin)
    alembic/       migrations      scripts/  seed.py, create_admin.py      tests/
  frontend/src/
    app/ components/(ui) features/<domain>/hooks.ts layouts/ pages/ routes/ services/api.ts hooks/ utils/ types/
  docker-compose.yml  .env.example
```

## Prerequisites

Python 3.12+, Node 20+ (tested on 26), Docker Desktop (for PostgreSQL), Git.

## Local setup (recommended for development)

```powershell
# 1. Config (placeholders only; defaults also work for local dev)
copy .env.example backend\.env        # then edit values; never commit .env

# 2. Database (Postgres on host port 5433)
docker compose up -d db
docker compose exec db psql -U hirehub -d hirehub -c "create database hirehub_test"   # for tests

# 3. Backend
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements-dev.txt
.\.venv\Scripts\alembic upgrade head                 # migrations
.\.venv\Scripts\python -m scripts.seed               # demo data (dev only; safe to re-run)
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000

# 4. Frontend (new terminal)
cd frontend
npm install
npm run dev                                          # http://localhost:5173
```

- API docs (Swagger): <http://localhost:8000/docs> · Health: <http://localhost:8000/health>
- **Demo logins (development only):** `student1@example.com` … `student6@…`, `employer1@example.com` … `employer5@…`, password `Demo1234!`.
- Emails in development are **logged to the backend console, not delivered** (`EMAIL_BACKEND=console`).
- Reset dev data: `alembic downgrade base && alembic upgrade head && python -m scripts.seed`.

### Creating the first administrator

There is deliberately **no** HTTP endpoint for this. Run on the server/your machine:

```powershell
$env:ADMIN_PASSWORD = "choose-a-strong-password-1"
.\.venv\Scripts\python -m scripts.create_admin you@example.com "Your Name"
```
(omit `ADMIN_PASSWORD` to be prompted). Public registration only accepts `student` and `employer` (enforced by the API schema and tested).

## Running everything with Docker Compose

```powershell
copy .env.example .env      # set POSTGRES_PASSWORD and SECRET_KEY
docker compose up --build   # app at http://localhost:8080, API docs at http://localhost:8000/docs
```
The backend container applies migrations and seeds the category list on start (not the demo data). Load demo data with
`docker compose exec backend python -m scripts.seed`. Health checks cover Postgres, backend (`/health`) and nginx.

## Tests

```powershell
cd backend;  .\.venv\Scripts\python -m pytest -q     # needs the db container + hirehub_test database
cd frontend; npm test                                # Vitest + React Testing Library
cd frontend; npm run build                           # typecheck + production build
```
Backend tests run against a **separate `*_test` database** (the suite refuses to start otherwise), build the schema by running the real Alembic migrations, and truncate between tests.

## Security design

| Concern | Approach |
|---|---|
| Passwords | Argon2id; login does a hash check even for unknown emails (timing); generic error message |
| Access token | JWT, 15 min, held **in memory only** (never localStorage) |
| Refresh token | Opaque random token in an **HttpOnly, SameSite=Lax, Secure (prod)** cookie scoped to `/api/v1/auth`; only its SHA-256 hash is stored; **rotated on every use**; presenting an already-used token revokes the whole session family (theft detection) |
| CSRF | Cookie endpoints (`refresh`, `logout`) require a custom `X-Requested-With` header and a whitelisted `Origin`; all other endpoints use the Bearer header, which browsers never attach automatically |
| AuthZ | Role dependencies on every protected route; ownership checked in services (employer ↔ company ↔ job ↔ application). Other tenants' resources return **404**, not 403, so IDs can't be probed. Active status is re-checked per request, so disabling a user is immediate |
| Rate limits | login 10/5 min, register 10/h, forgot-password 5/h, apply, report, … (in-memory; use Redis for multi-instance, see limitations) |
| Uploads | Size limits; type decided from **magic bytes** (not filename/MIME); random stored names; stored outside any public dir; downloads go through authorized endpoints with `no-store` and `nosniff`; employers' CV access is audit-logged. Logos are intentionally public |
| Reset/verify tokens | Random, single-use, expiring, stored hashed; reset revokes all sessions |
| Input | Pydantic validation everywhere, LIKE wildcards escaped, bounded pagination, URL fields restricted to http(s) |
| Errors | Uniform `{"error": {code, message, details}}`; unhandled exceptions are logged server-side, never returned |
| DB integrity | CHECK constraints (role, statuses, salary range), unique (job, student) and (user, job), deliberate FK delete rules |
| Secrets | `.env` is git-ignored; production refuses to start with a default/short `SECRET_KEY` or without `COOKIE_SECURE` |

## API overview

Interactive docs at `/docs` (disable in production with `DOCS_ENABLED=false`). Base path `/api/v1`.

| Area | Examples |
|---|---|
| Auth | `POST /auth/register` `login` `refresh` `logout` · `GET /auth/me` · `POST /auth/forgot-password` `reset-password` `verify-email` |
| Jobs | `GET /jobs?q=&location=&employment_type=&category_id=&experience_level=&workplace_type=&salary_min=&sort=&page=&page_size=` · `GET /jobs/{id}` · `POST /jobs/{id}/apply` · `POST /jobs/{id}/report` |
| Saved | `GET /saved-jobs` · `PUT/DELETE /saved-jobs/{job_id}` |
| Student | `GET/PUT /students/me` · `POST/GET/DELETE /students/me/cv` · `POST /students/me/avatar` · `GET /applications/me` · `POST /applications/{id}/withdraw` |
| Employer | `GET/POST/PUT /employer/company` · `POST /employer/company/logo` · `GET/POST /employer/jobs` · `PUT /employer/jobs/{id}` · `POST /employer/jobs/{id}/publish\|close` · `GET /employer/applications` · `PATCH /applications/{id}/status` · `GET /applications/{id}/cv` · `GET /employer/stats` |
| Admin | `GET /admin/stats` `users` `jobs` `reports` `audit-logs` · `PATCH /admin/users/{id}` · `POST /admin/jobs/{id}/moderate` · categories CRUD |

```bash
curl -X POST localhost:8000/api/v1/auth/login -H 'Content-Type: application/json' \
     -d '{"email":"student1@example.com","password":"Demo1234!"}'
curl 'localhost:8000/api/v1/jobs?q=python&employment_type=internship&page_size=5'
```

Application status flow (employer/admin): `pending → reviewed/shortlisted/rejected`, `reviewed → shortlisted/rejected`, `shortlisted → interview/rejected`, `interview → accepted/rejected`. Accepted/rejected/withdrawn are final. Students can only **withdraw** (from pending/reviewed/shortlisted/interview).

## SEO

The front end is a client-rendered SPA. Each page sets its title, description, canonical URL and Open Graph tags at runtime, job pages emit JSON-LD `JobPosting`, `robots.txt` blocks dashboards, and the backend serves a dynamic `/sitemap.xml` (nginx exposes it at the site root). Googlebot executes JavaScript so this is indexable, but **metadata does not guarantee rankings**, and many social-preview scrapers do *not* run JS, so shared links show only the default `index.html` tags. If SEO becomes a priority, add pre-rendering/SSR for `/jobs/:id` and `/companies/:slug` (e.g. a prerender service or migrating those routes to a framework with SSR).

## Deployment

The live site runs on **Vercel** (React build + FastAPI as a serverless function) with **Supabase** (PostgreSQL + private
S3-compatible bucket). The step-by-step guide for that setup is [`DEPLOY.md`](DEPLOY.md). Other options for a container-based setup
(accounts/keys are yours to create):

| Piece | Option | What you need |
|---|---|---|
| Backend (Docker) | Render, Railway, Fly.io | Account; deploy `backend/` Dockerfile; set env vars below |
| PostgreSQL | Managed: Neon, Supabase, Render/Railway Postgres | Connection string → `DATABASE_URL` (`postgresql+psycopg://…`, add `?sslmode=require` if needed) |
| Frontend | Same host as a Docker service (nginx image proxies `/api`), **or** Vercel/Netlify/Cloudflare Pages with a rewrite of `/api/*` to the backend | Keep the API same-site so cookies work; if on different sites set `COOKIE_SAMESITE=none` + `COOKIE_SECURE=true` + exact `CORS_ORIGINS` |
| Uploaded files | Attach a persistent disk/volume at `UPLOAD_DIR`. For multi-instance, replace `services/storage.py` with an S3-compatible private bucket + short-lived signed URLs | Not implemented yet |
| Email | Any SMTP provider (Brevo, Mailgun, SES, Resend SMTP) | `EMAIL_BACKEND=smtp`, `SMTP_*`, `EMAIL_FROM` |

**Production environment variables**

```
ENVIRONMENT=production
SECRET_KEY=<python -c "import secrets;print(secrets.token_urlsafe(48))">
DATABASE_URL=postgresql+psycopg://user:pass@host:5432/db
COOKIE_SECURE=true
FRONTEND_URL=https://your-domain
CORS_ORIGINS=https://your-domain
DOCS_ENABLED=false
EMAIL_BACKEND=smtp  SMTP_HOST=… SMTP_PORT=587 SMTP_USER=… SMTP_PASSWORD=… EMAIL_FROM="HireHub <no-reply@your-domain>"
UPLOAD_DIR=/data/uploads
```

**Steps:** provision Postgres → set env vars → deploy backend (container start runs `alembic upgrade head` and seeds categories) → create the admin with `python -m scripts.create_admin` in a one-off shell → deploy frontend → verify `/health`, register, login, apply.
**HTTPS is mandatory** (the refresh cookie is `Secure`); platforms above terminate TLS for you. **Backups:** enable the provider's daily automated Postgres backups + point-in-time recovery, test a restore, and back up the uploads volume. **Monitoring:** point the platform's health check at `/health`; backend logs go to stdout (ship to your platform's log viewer); add Sentry (`sentry-sdk[fastapi]`) for error tracking.
**Troubleshooting:** `401` loops after login → cookie not stored (check HTTPS/`COOKIE_SECURE`, same-site setup); CORS errors → `CORS_ORIGINS` must exactly match the browser origin; container exits on boot → `SECRET_KEY` too short or `COOKIE_SECURE` false in production (by design); `relation does not exist` → migrations didn't run.

## Verification

Last run on the author's Windows machine:

- Backend: `pytest` → 60 passed (auth, authorization/ownership, jobs, search/filters, applications, uploads, admin, DB constraints).
- Frontend: `vitest` → 25 passed; `npm run build` (typecheck + production build) succeeds.
- Docker Compose: images build; db, backend (`/health`) and nginx start healthy; the nginx → API proxy, SPA fallback, sitemap, login and admin stats were exercised with `curl`.
- Production (Vercel + Supabase): home and SPA routes, `/health`, categories, register, login, refresh-cookie flow, and CV upload/download through the private Supabase bucket were exercised with `curl`.
- Visual check: screenshots of the home, jobs and login pages at desktop width and at a true 390 px mobile width looked correct (no horizontal overflow). Dashboards, admin screens and keyboard/screen-reader accessibility were **not** visually checked.
- **Not verified:** real SMTP delivery; backend tests were not re-run after the serverless changes (Docker was unavailable at the time).

## Screenshots

_Add screenshots here after running the app (home, jobs, job details, dashboards)._ 

## Known limitations

- Rate limiting is in-memory (per process); use Redis for multiple instances.
- Uploads support local disk or an S3-compatible bucket (streamed through the API after authorization; no signed URLs). On Vercel, CVs are limited to 4 MB.
- Search uses `ILIKE` with B-tree indexes on filter columns. For large datasets add `pg_trgm`/full-text indexes.
- SPA rendering limits social-preview/SEO as described above.
- Emails are logged in development; real delivery requires SMTP configuration and was not tested against a live provider.
- No email-change flow, no 2FA, no account-deletion self-service yet.
- A student cannot re-apply to a job after withdrawing (unique per job/student by design).
- Visual QA in a real browser, and a full Docker-Compose end-to-end run, are listed in the final report with their actual status.
