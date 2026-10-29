$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path -LiteralPath '.env')) { throw 'Missing .env. Follow README.md to configure the database first.' }
$postgresServices = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue
if (-not $postgresServices) { throw 'PostgreSQL is not installed as a Windows service. Install PostgreSQL or start it yourself, then run npm run dev.' }
if (-not ($postgresServices | Where-Object { $_.Status -eq 'Running' })) {
    Write-Host 'Starting PostgreSQL...'
    Start-Service ($postgresServices | Select-Object -First 1)
}
node scripts/dev.mjs
