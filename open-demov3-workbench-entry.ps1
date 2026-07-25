$ErrorActionPreference = "Stop"

$rootDir = $PSScriptRoot
$serveDir = $rootDir

function Find-EntryFile {
  param([string]$Directory)

  if (-not (Test-Path -LiteralPath $Directory -PathType Container)) {
    return $null
  }

  return Get-ChildItem -LiteralPath $Directory -File -Filter "*.html" |
    Where-Object { $_.Name -ne "demov3.html" -and $_.Name -like "*demov3*" } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
}

$entryFile = Find-EntryFile -Directory $serveDir
if ($null -eq $entryFile) {
  $fallbackServeDir = Join-Path $rootDir "work"
  $entryFile = Find-EntryFile -Directory $fallbackServeDir
  if ($null -ne $entryFile) {
    $serveDir = $fallbackServeDir
  }
}

$demoPath = Join-Path $serveDir "demov3.html"
$serverScript = Join-Path $rootDir "serve-demov3-static.ps1"

if ($null -eq $entryFile) {
  Write-Host "Cannot find test entry:" -ForegroundColor Red
  Write-Host "Expected an html file containing demov3 in its name, excluding demov3.html."
  exit 1
}

if (-not (Test-Path -LiteralPath $demoPath -PathType Leaf)) {
  Write-Host "Cannot find demov3.html:" -ForegroundColor Red
  Write-Host $demoPath
  exit 1
}

if (-not (Test-Path -LiteralPath $serverScript -PathType Leaf)) {
  Write-Host "Cannot find static server script:" -ForegroundColor Red
  Write-Host $serverScript
  exit 1
}

function Test-DemoServer {
  param(
    [int]$Port,
    [string]$EntryName
  )

  $demoUrl = "http://127.0.0.1:$Port/demov3.html"
  $entryUrl = "http://127.0.0.1:$Port/$([uri]::EscapeDataString($EntryName))"

  try {
    $demoResponse = Invoke-WebRequest -UseBasicParsing $demoUrl -TimeoutSec 2
    $entryResponse = Invoke-WebRequest -UseBasicParsing $entryUrl -TimeoutSec 2
    return $demoResponse.StatusCode -eq 200 -and $entryResponse.StatusCode -eq 200
  } catch {
    return $false
  }
}

foreach ($port in 3013..3020) {
  $entryUrl = "http://127.0.0.1:$port/$([uri]::EscapeDataString($entryFile.Name))"

  if (Test-DemoServer -Port $port -EntryName $entryFile.Name) {
    Start-Process $entryUrl
    exit 0
  }

  Start-Process -WindowStyle Minimized -FilePath "powershell" -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    $serverScript,
    "-Root",
    $serveDir,
    "-Port",
    "$port"
  )

  $deadline = (Get-Date).AddSeconds(8)
  do {
    if (Test-DemoServer -Port $port -EntryName $entryFile.Name) {
      Start-Process $entryUrl
      exit 0
    }

    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)
}

Write-Host "demov3 local server did not become ready. Please check whether ports 3013-3020 are occupied." -ForegroundColor Red
exit 1
