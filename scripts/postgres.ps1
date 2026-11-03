param([ValidateSet('start','stop','status')][string]$Action='start')
$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
$pgCtl='C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe'
$dataDir=Join-Path $taskRoot '.local\postgres-data'
if (-not (Test-Path -LiteralPath (Join-Path $dataDir 'PG_VERSION'))) { throw 'Run scripts/setup-postgres.ps1 first, or use your own PostgreSQL via DATABASE_URL.' }
if ($Action -eq 'start') { & $pgCtl status -D $dataDir | Out-Null; if ($LASTEXITCODE -ne 0) { & $pgCtl start -D $dataDir -l (Join-Path $taskRoot '.local\postgres.log') -w; exit $LASTEXITCODE }; Write-Output 'PostgreSQL is already running.'; exit 0 }
if ($Action -eq 'stop') { & $pgCtl stop -D $dataDir -m fast -w; exit $LASTEXITCODE }
& $pgCtl status -D $dataDir
exit $LASTEXITCODE
