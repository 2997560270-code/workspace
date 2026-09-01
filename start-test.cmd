@echo off
setlocal EnableExtensions

set "REPO_ROOT=%~dp0"
set "APP_DIR=%REPO_ROOT%product-drill-app"

if not exist "%APP_DIR%\package.json" (
  echo [Product Drill] Cannot find product-drill-app\package.json.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [Product Drill] Node.js is required. Install Node.js LTS and try again.
  pause
  exit /b 1
)

echo [Product Drill] Checking port 3000...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%product-drill-app\scripts\free-port-3000.ps1"
if errorlevel 1 (
  echo [Product Drill] Failed to free port 3000. Port 3000 is still in use - check the PID above, stop it, then retry.
  pause
  exit /b 1
)

if not exist "%APP_DIR%\node_modules\.bin\next.cmd" (
  echo [Product Drill] Installing dependencies...
  pushd "%APP_DIR%"
  call npm.cmd ci
  if errorlevel 1 (
    popd
    echo [Product Drill] Dependency installation failed.
    pause
    exit /b 1
  )
  popd
)

echo [Product Drill] Starting the development server...
pushd "%APP_DIR%"
start "Product Drill dev server" cmd /k "npm.cmd run dev -- -p 3000"
popd

echo [Product Drill] Waiting for http://localhost:3000 ...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$url = 'http://localhost:3000'; $deadline = (Get-Date).AddSeconds(30); do { try { $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2; if ($response.StatusCode -ge 200) { Start-Process $url; exit 0 } } catch { } Start-Sleep -Seconds 1 } while ((Get-Date) -lt $deadline); Start-Process $url"

endlocal
