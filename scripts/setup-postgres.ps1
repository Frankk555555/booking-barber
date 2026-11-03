$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
if (-not (Test-Path -LiteralPath (Join-Path $pgBin 'initdb.exe'))) { throw 'Install PostgreSQL 18 with command-line tools first.' }
$localDir = Join-Path $taskRoot '.local'
[IO.Directory]::CreateDirectory($localDir) | Out-Null
$dataDir = Join-Path $localDir 'postgres-data'
$pwFile = Join-Path $localDir 'postgres-admin.password'
if (-not (Test-Path -LiteralPath $pwFile)) { [IO.File]::WriteAllText($pwFile, [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24)), [Text.UTF8Encoding]::new($false)) }
if (-not (Test-Path -LiteralPath (Join-Path $dataDir 'PG_VERSION'))) {
  & (Join-Path $pgBin 'initdb.exe') -D $dataDir -U barber_admin --pwfile=$pwFile --auth=scram-sha-256 --encoding=UTF8 --locale=C
  if ($LASTEXITCODE -ne 0) { throw 'initdb failed' }
  Add-Content -LiteralPath (Join-Path $dataDir 'postgresql.conf') -Value "`nport = 5433`nlisten_addresses = '127.0.0.1'`ntimezone = 'UTC'`n"
}
$pgPassword = [IO.File]::ReadAllText($pwFile).Trim()
$adminUrl = "postgresql://barber_admin:${pgPassword}@127.0.0.1:5433/postgres"
[IO.File]::WriteAllText((Join-Path $localDir 'postgres-admin.url'), $adminUrl, [Text.UTF8Encoding]::new($false))
$serviceName = 'booking-barber-postgresql'
$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if (-not $service) {
  & (Join-Path $pgBin 'pg_ctl.exe') register -N $serviceName -D $dataDir -S auto
  if ($LASTEXITCODE -eq 0) { $service = Get-Service -Name $serviceName }
}
if ($service) { if ($service.Status -ne 'Running') { Start-Service -Name $serviceName }; Write-Output 'Dedicated PostgreSQL Windows service is running on 127.0.0.1:5433.' }
else {
  & (Join-Path $pgBin 'pg_ctl.exe') status -D $dataDir | Out-Null
  if ($LASTEXITCODE -ne 0) { & (Join-Path $pgBin 'pg_ctl.exe') start -D $dataDir -l (Join-Path $localDir 'postgres.log') -w; if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL failed to start' } }
  Write-Output 'Dedicated PostgreSQL is running on 127.0.0.1:5433. Service registration needs Windows Administrator rights.'
}
