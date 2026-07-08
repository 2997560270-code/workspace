@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "APP_DIR=%ROOT_DIR%product-drill-app"
set "FALLBACK_APP_DIR=C:\Users\A\Documents\Codex\2026-06-17\web-web\product-drill-app"
set "TARGET_URL=%~1"
if "%TARGET_URL%"=="" set "TARGET_URL=http://127.0.0.1:3000"

if not exist "%APP_DIR%\node_modules\next\package.json" (
  if exist "%FALLBACK_APP_DIR%\node_modules\next\package.json" (
    set "APP_DIR=%FALLBACK_APP_DIR%"
  )
)

if not exist "%APP_DIR%\node_modules\next\package.json" (
  echo Product Drill local server cannot start because dependencies are missing.
  echo %APP_DIR%
  echo.
  echo Expected dependency:
  echo %APP_DIR%\node_modules\next\package.json
  echo.
  echo Please run npm install in the app folder, or keep the original Codex project folder available:
  echo %FALLBACK_APP_DIR%
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:3000' -TimeoutSec 2; if ($r.StatusCode -lt 500) { exit 0 } else { exit 1 } } catch { exit 1 }"

if errorlevel 1 (
  start "Product Drill Dev Server" /min "%APP_DIR%\start-dev-server.cmd"
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$deadline = (Get-Date).AddSeconds(60); do { try { $r = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:3000' -TimeoutSec 2; if ($r.StatusCode -lt 500) { exit 0 } } catch {}; Start-Sleep -Milliseconds 800 } while ((Get-Date) -lt $deadline); exit 1"

if errorlevel 1 (
  echo Product Drill local server did not become ready within 60 seconds.
  echo Please check whether port 3000 is occupied or Node.js is unavailable.
  pause
  exit /b 1
)

start "" "%TARGET_URL%"
exit /b 0
