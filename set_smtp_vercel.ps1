# Turns on real email delivery (verification, password reset, application notifications) for the live site.
# Run from the hirehub folder:   powershell -ExecutionPolicy Bypass -File .\set_smtp_vercel.ps1
# Secrets are typed here (hidden) and sent only to Vercel. Nothing is saved to disk.
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

$host_ = Read-Host "SMTP host (Enter for smtp-relay.brevo.com)"
if (-not $host_) { $host_ = "smtp-relay.brevo.com" }
$port = Read-Host "SMTP port (Enter for 587)"
if (-not $port) { $port = "587" }
$user = Read-Host "SMTP login (Brevo: the login shown under SMTP & API > SMTP)"
$pass = Read-Secret "SMTP password / key"
$from = Read-Host "From address (must be a sender you verified, e.g. you@gmail.com)"
$fromHeader = "HireHub <$from>"

Write-Host "`nSending settings to Vercel..." -ForegroundColor Cyan
Set-VercelEnv EMAIL_BACKEND "smtp"
Set-VercelEnv SMTP_HOST $host_
Set-VercelEnv SMTP_PORT $port
Set-VercelEnv SMTP_USER $user
Set-VercelEnv SMTP_PASSWORD $pass
Set-VercelEnv EMAIL_FROM $fromHeader

Write-Host "`nRedeploying so the new settings take effect..." -ForegroundColor Cyan
& npx --yes vercel deploy --prod --yes
if ($LASTEXITCODE -ne 0) { throw "Deploy failed" }
Write-Host "`nDone. Register a new account with your real email on the live site; a verification email should arrive within a minute." -ForegroundColor Green
