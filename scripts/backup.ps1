param([string]$OutputPath)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
if (-not $OutputPath) { $OutputPath=Join-Path $taskRoot ('backups\booking-barber-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.dump') }
$OutputPath=[IO.Path]::GetFullPath($OutputPath)
[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($OutputPath)) | Out-Null
if (Test-Path -LiteralPath $OutputPath) { throw 'Refusing to overwrite an existing backup.' }
$line=Get-Content -LiteralPath (Join-Path $taskRoot '.env') | Where-Object { $_.StartsWith('DATABASE_URL=') } | Select-Object -First 1
if (-not $line) { throw 'Missing DATABASE_URL in .env' }
$connection=[Uri]$line.Substring(13)
$parts=$connection.UserInfo.Split(':',2)
$priorPassword=$env:PGPASSWORD
try { $env:PGPASSWORD=[Uri]::UnescapeDataString($parts[1]); & 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe' -h $connection.Host -p $connection.Port -U ([Uri]::UnescapeDataString($parts[0])) -d $connection.AbsolutePath.TrimStart('/') -Fc -f $OutputPath; if ($LASTEXITCODE -ne 0) { throw 'Backup failed' }; Write-Output "Backup saved: $OutputPath" } finally { $env:PGPASSWORD=$priorPassword }
