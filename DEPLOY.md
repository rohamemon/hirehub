# Deploying HireHub (Vercel + Supabase, no credit card)

One **Vercel** project serves both the React site and the FastAPI backend (`/api/*`) on the same domain, so the
login cookie works without CORS tricks. **Supabase** holds the PostgreSQL database and the private file bucket.
Nothing here is deployed until you complete these steps.

> Alternative: `render.yaml` deploys backend + frontend on Render, but Render requires a credit card even for free services.

## 1. Supabase (database + files)
1. Project + private bucket `hirehub-files` + S3 access key (see the S3 Configuration page). Keep the secret safe.
2. **Database URL** — Connect → **Transaction pooler** (port **6543**). Change the prefix to `postgresql+psycopg://`
   and put your database password in. Example:
   `postgresql+psycopg://postgres.PROJECTREF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres`
   (Use letters/numbers only in the password, or percent-encode special characters.)

## 2. Create the tables (run once, on your own PC)
This applies the database migrations and creates the job categories and your admin account. Run in PowerShell
(the URL stays only in that window, not in any file):
```powershell
cd hirehub\backend
$env:DATABASE_URL = "postgresql+psycopg://postgres.PROJECTREF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"   # SESSION pooler (5432) for migrations
.\.venv\Scripts\alembic upgrade head
.\.venv\Scripts\python -m scripts.seed --categories-only
$env:ADMIN_PASSWORD = "choose-a-strong-password-1"
.\.venv\Scripts\python -m scripts.create_admin you@yourmail.com "Your Name"
```
(Port 5432 session pooler here; the app itself uses the 6543 transaction pooler.)

## 3. Vercel
1. vercel.com → **Sign Up with GitHub** (Hobby plan, free).
2. **Add New → Project** → import `rohamemon/hirehub`. Leave *Root Directory* as the repo root and Framework as *Other*.
   (`vercel.json` already sets the build command, output folder and routing.)
3. Open **Environment Variables** and add:

| Name | Value |
|---|---|
| `ENVIRONMENT` | `production` |
| `SERVERLESS` | `true` |
| `COOKIE_SECURE` | `true` |
| `DOCS_ENABLED` | `false` |
| `SECRET_KEY` | long random string (56+ characters) |
| `DATABASE_URL` | the **6543** transaction-pooler URL from step 1 |
| `STORAGE_BACKEND` | `s3` |
| `S3_BUCKET` | `hirehub-files` |
| `S3_ENDPOINT_URL`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | from Supabase |
| `FRONTEND_URL` | `https://<your-project>.vercel.app` (fill in after the first deploy, then redeploy) |
| `CORS_ORIGINS` | same as `FRONTEND_URL` |

4. **Deploy.** Then copy the final `https://<project>.vercel.app` address, put it into `FRONTEND_URL` and
   `CORS_ORIGINS`, and **Redeploy** (Deployments → ⋯ → Redeploy).

## 4. Check
Open `https://<project>.vercel.app/health` → `{"status":"ok"}`. Register a student, upload a CV, register an employer
(private window), post a job, apply, review the applicant, and log in as the admin at `/admin`.

## Serverless limits (honest notes)
- **Uploads are limited to 4 MB** (Vercel request bodies are capped around 4.5 MB). The app enforces 4 MB.
- **Rate limiting is per function instance** (in memory), so it only slows abuse, it doesn't strictly cap it.
- First request after idle can be slow (cold start).
- Emails are only logged until you add an SMTP provider (`EMAIL_BACKEND=smtp`, `SMTP_*`).
- Supabase free projects pause after a week of inactivity; open the dashboard to resume.

## Troubleshooting
- **500 on every API call:** Vercel → project → Logs. Usually a wrong `DATABASE_URL` or missing env var.
- **`relation does not exist`:** step 2 (migrations) wasn't run against this database.
- **Login works, then 401 loop:** `FRONTEND_URL`/`CORS_ORIGINS` don't exactly match the site address (https, no trailing slash).
- **Build too large:** the Python bundle must stay under 250 MB; tell me and I'll slim it down.
