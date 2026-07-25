param([Parameter(Mandatory=$true)][string]$AppPath)
$ErrorActionPreference = 'Stop'
Push-Location $AppPath
try {
  npm.cmd test
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  npm.cmd run build
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  npm.cmd run eval:golden
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  npm.cmd run e2e
  exit $LASTEXITCODE
} finally { Pop-Location }
