# Creates tables, job categories and your admin account in a remote database (e.g. Supabase).
# Run from the hirehub\backend folder:   .\scripts\setup_remote_db.ps1
# Values are typed into this window only; nothing is written to disk or sent anywhere except your database.

$url = Read-Host "Supabase SESSION pooler URL (port 5432, starts with postgresql+psycopg://)" -MaskInput
if ($url -notmatch '^postgresql\+psycopg://') { Write-Error "URL must start with postgresql+psycopg://"; exit 1 }
$email = Read-Host "Admin email"
$pw = Read-Host "Admin password (letters + numbers, 8+ chars)" -MaskInput

$env:DATABASE_URL = $url
$env:ADMIN_PASSWORD = $pw
try {
    Write-Host "`n1/3 Creating tables..." -ForegroundColor Cyan
    & .\.venv\Scripts\alembic upgrade head
    if ($LASTEXITCODE -ne 0) { throw "Migration failed" }
    Write-Host "`n2/3 Adding job categories..." -ForegroundColor Cyan
    & .\.venv\Scripts\python -m scripts.seed --categories-only
    if ($LASTEXITCODE -ne 0) { throw "Seeding failed" }
    Write-Host "`n3/3 Creating admin account..." -ForegroundColor Cyan
    & .\.venv\Scripts\python -m scripts.create_admin $email "Admin"
    if ($LASTEXITCODE -ne 0) { throw "Admin creation failed" }
    Write-Host "`nDone. Database is ready." -ForegroundColor Green
} finally {
    Remove-Item Env:DATABASE_URL, Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue
}
