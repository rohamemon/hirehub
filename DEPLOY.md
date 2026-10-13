# Deploying HireHub (Render + Supabase, free tier)

You need three free accounts: **GitHub**, **Supabase** (database + file storage), **Render** (hosts backend + frontend).
Nothing here is deployed until you complete these steps.

## 1. Put the code on GitHub
```powershell
cd hirehub
git add -A
git commit -m "HireHub"
```
Create an empty repo on github.com (e.g. `hirehub`, can be private), then:
```powershell
git remote add origin https://github.com/<you>/hirehub.git
git branch -M main
git push -u origin main
```
`.env` files are git-ignored. Check on GitHub that no `.env` was uploaded.

## 2. Supabase: database and file bucket
1. supabase.com → New project. Choose a region near you and **save the database password**.
2. **Database URL:** Project → *Connect* → "Session pooler" connection string. Convert it for our driver:
   `postgresql://postgres.xxx:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres`
   becomes
   `postgresql+psycopg://postgres.xxx:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres`
   (only the `postgresql+psycopg://` prefix changes).
3. **Storage:** Storage → New bucket → name `hirehub-files`, **keep it Private** (do not tick "Public").
4. **S3 keys:** Storage → *S3 Connection* (or Project Settings → Storage): copy the **Endpoint**
   (looks like `https://xxxx.storage.supabase.co/storage/v1/s3`), the **Region**, and click *New access key*
   to get an **Access key ID** and **Secret**. The secret is shown once.

## 3. Render: deploy
1. render.com → sign in with GitHub → **New → Blueprint** → pick your repo. Render reads `render.yaml` and creates
   `hirehub-api` (backend) and `hirehub-web` (frontend).
2. Fill the prompted variables on **hirehub-api**:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the `postgresql+psycopg://…` string from step 2 |
| `S3_ENDPOINT_URL` / `S3_REGION` | from Supabase S3 Connection |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | the new access key |
| `FRONTEND_URL` and `CORS_ORIGINS` | your site URL, e.g. `https://hirehub-web.onrender.com` (no trailing slash) |

   `SECRET_KEY` is generated for you. On first start the backend runs the database migrations and creates the job categories.
3. If your service names differ from `hirehub-api` / `hirehub-web`, edit the two `destination:` URLs in `render.yaml`
   to match your real backend URL, commit and push.
4. Wait for both services to show **Live**. Open `https://hirehub-api.onrender.com/health` → `{"status":"ok"}`.

## 4. Create your admin account
Render → **hirehub-api → Shell**:
```bash
ADMIN_PASSWORD='choose-a-strong-password-1' python -m scripts.create_admin you@yourmail.com "Your Name"
```

## 5. Check it works
Open your site URL → register a student → upload a CV → register an employer in a private window → post a job →
apply → review the applicant → log in as admin at `/admin`.

## Real emails (optional, later)
Create a free Brevo/Mailgun account, then on Render set `EMAIL_BACKEND=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASSWORD`, `EMAIL_FROM`. Until then verification/reset emails are only written to the Render logs.

## Free-tier notes
- The free backend **sleeps after ~15 min idle**; the first request after that takes ~30-60 s.
- Supabase free projects pause after a week of inactivity. Open the dashboard to resume.
- Demo seed data is **not** loaded in production (`seed.py` refuses). Add real data through the app.

## Troubleshooting
- **Backend crashes on boot:** the log says which variable is missing (e.g. `SECRET_KEY`, `S3_*`).
- **Login works but you get logged out / 401 loop:** the browser must call `/api` on the *same* domain as the site
  (the `rewrite` rule in `render.yaml`). Don't point the frontend straight at the backend URL.
- **CORS error:** `CORS_ORIGINS` must exactly equal the site URL (https, no trailing slash).
- **`relation … does not exist`:** migrations didn't run; check the backend deploy log.
- **File upload fails:** check the bucket name matches `S3_BUCKET` and the keys/endpoint are correct.
