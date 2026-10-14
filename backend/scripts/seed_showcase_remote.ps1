# Adds fictional companies + open jobs to your remote (Supabase) database so the live site isn't empty.
# Creates no usable logins. Safe to run more than once.
# Run from the hirehub\backend folder:
#   powershell -ExecutionPolicy Bypass -File .\scripts\seed_showcase_remote.ps1
function Read-Secret($prompt) {
    $sec = Read-Host $prompt -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
$url = Read-Secret "Supabase SESSION pooler URL (port 5432, starts with postgresql+psycopg://)"
if ($url -notmatch '^postgresql\+psycopg://') { Write-Error "URL must start with postgresql+psycopg://"; exit 1 }
$env:DATABASE_URL = $url
try { & .\.venv\Scripts\python -m scripts.seed --showcase } finally { Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue }
