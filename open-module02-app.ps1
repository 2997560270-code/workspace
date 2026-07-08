$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$App = Join-Path $Root "product-drill-mvp\apps\web"
$Port = 3200
$Url = "http://127.0.0.1:$Port"
$LogDir = Join-Path $Root "product-drill-mvp\apps\web\.local-logs"
$LogFile = Join-Path $LogDir "module02-next-dev.log"

function Test-HttpReady($TargetUrl) {
  try {
    $response = Invoke-WebRequest -Uri $TargetUrl -UseBasicParsing -TimeoutSec 2
    return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
  } catch {
    return $false
  }
}

if (!(Test-Path -LiteralPath (Join-Path $App "package.json"))) {
  Write-Host "Cannot find app package.json: $App"
  Read-Host "Press Enter to close"
  exit 1
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

if (!(Test-HttpReady $Url)) {
  Write-Host "Starting Product Drill MVP dev server on $Url ..."
  Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--hostname", "127.0.0.1", "--port", "$Port") -WorkingDirectory $App -WindowStyle Hidden -RedirectStandardOutput $LogFile -RedirectStandardError ($LogFile + ".err")

  $ready = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 750
    if (Test-HttpReady $Url) {
      $ready = $true
      break
    }
  }

  if (-not $ready) {
    Write-Host "Dev server did not become ready. Log file: $LogFile"
    Read-Host "Press Enter to close"
    exit 1
  }
}

Write-Host "Opening $Url ..."
Start-Process $Url