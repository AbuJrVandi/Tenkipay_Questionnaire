$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$dataDirectory = Join-Path (Get-Location) '.local\mysql'
$mysqlExecutable = 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe'
if (-not (Test-Path -LiteralPath '.env')) { throw 'Missing .env. Follow README.md to configure the database first.' }
$localConnection = Get-NetTCPConnection -LocalPort 3307 -State Listen -ErrorAction SilentlyContinue
if (-not $localConnection -and (Test-Path -LiteralPath $dataDirectory)) {
    $mysqlArguments = @('--no-defaults', "--datadir=`"$dataDirectory`"", '--port=3307', '--bind-address=127.0.0.1', '--mysqlx=OFF')
    Start-Process -FilePath $mysqlExecutable -ArgumentList $mysqlArguments -WindowStyle Hidden
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if (Get-NetTCPConnection -LocalPort 3307 -State Listen -ErrorAction SilentlyContinue) { break }
        Start-Sleep -Milliseconds 500
    }
}
node scripts/dev.mjs
