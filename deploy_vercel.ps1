# One-command deploy to Vercel. Run from the hirehub folder:
#   powershell -ExecutionPolicy Bypass -File .\deploy_vercel.ps1
# Secrets are typed into this window (hidden) and sent only to Vercel. Nothing is saved to disk.
$ErrorActionPreference = "Stop"

function Read-Secret($prompt) {
    $sec = Read-Host $prompt -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
function Set-VercelEnv($name, $value) {
    & npx --yes vercel env rm $name production --yes 2>$null | Out-Null
    & npx --yes vercel env add $name production --value $value --yes | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not set $name" }
    Write-Host "  set $name" -ForegroundColor DarkGray
}

Write-Host "`n1/5 Log in to Vercel (a browser window will open; approve it)" -ForegroundColor Cyan
& npx --yes vercel login
$suffix = -join ((97..122) | Get-Random -Count 5 | ForEach-Object { [char]$_ })
$project = Read-Host "Project name (press Enter for 'hirehub-$suffix')"
if (-not $project) { $project = "hirehub-$suffix" }

Write-Host "`n2/5 Creating/linking project '$project'" -ForegroundColor Cyan
& npx --yes vercel link --yes --project $project
if ($LASTEXITCODE -ne 0) { throw "Link failed" }
$site = "https://$project.vercel.app"

Write-Host "`n3/5 Enter your secrets (typing is hidden)" -ForegroundColor Cyan
$dbUrl = Read-Secret "Supabase TRANSACTION pooler URL (port 6543, starts with postgresql+psycopg://)"
if ($dbUrl -notmatch '^postgresql\+psycopg://') { throw "URL must start with postgresql+psycopg://" }
$s3Endpoint = Read-Host "S3 endpoint URL (not secret)"
$s3Region   = Read-Host "S3 region (not secret)"
$s3Key      = Read-Secret "S3 access key ID"
$s3Secret   = Read-Secret "S3 secret access key"
$secretKey  = -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 64 | ForEach-Object { [char]$_ })   # generated here, never shown

Write-Host "`n4/5 Sending settings to Vercel" -ForegroundColor Cyan
Set-VercelEnv ENVIRONMENT "production"
Set-VercelEnv SERVERLESS "true"
Set-VercelEnv COOKIE_SECURE "true"
Set-VercelEnv DOCS_ENABLED "false"
Set-VercelEnv STORAGE_BACKEND "s3"
Set-VercelEnv S3_BUCKET "hirehub-files"
Set-VercelEnv FRONTEND_URL $site
Set-VercelEnv CORS_ORIGINS $site
Set-VercelEnv SECRET_KEY $secretKey
Set-VercelEnv DATABASE_URL $dbUrl
Set-VercelEnv S3_ENDPOINT_URL $s3Endpoint
Set-VercelEnv S3_REGION $s3Region
Set-VercelEnv S3_ACCESS_KEY $s3Key
Set-VercelEnv S3_SECRET_KEY $s3Secret

Write-Host "`n5/5 Deploying (takes a few minutes)" -ForegroundColor Cyan
& npx --yes vercel deploy --prod --yes
if ($LASTEXITCODE -ne 0) { throw "Deploy failed" }

Write-Host "`nChecking $site/health ..." -ForegroundColor Cyan
try { (Invoke-WebRequest -UseBasicParsing "$site/health" -TimeoutSec 60).Content } catch { Write-Host "Health check failed: $($_.Exception.Message)" -ForegroundColor Yellow }
Write-Host "`nSite: $site" -ForegroundColor Green
