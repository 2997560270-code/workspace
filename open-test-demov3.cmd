@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "SERVE_DIR=%ROOT_DIR%"
if not exist "%SERVE_DIR%demov3.html" (
  if exist "%ROOT_DIR%work\demov3.html" (
    set "SERVE_DIR=%ROOT_DIR%work\"
  )
)

set "PORT=3013"
set "URL=http://127.0.0.1:%PORT%/demov3.html"

if not exist "%SERVE_DIR%demov3.html" (
  echo Cannot find demov3.html.
  echo Checked:
  echo %ROOT_DIR%demov3.html
  echo %ROOT_DIR%work\demov3.html
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing '%URL%' -TimeoutSec 2; if ($r.StatusCode -lt 500) { exit 0 } } catch { exit 1 }"

if errorlevel 1 (
  start "Product Drill demov3 Static Server" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT_DIR%serve-demov3-static.ps1" -Root "%SERVE_DIR%" -Port %PORT%
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$deadline = (Get-Date).AddSeconds(20); do { try { $r = Invoke-WebRequest -UseBasicParsing '%URL%' -TimeoutSec 2; if ($r.StatusCode -lt 500) { exit 0 } } catch {}; Start-Sleep -Milliseconds 500 } while ((Get-Date) -lt $deadline); exit 1"

if errorlevel 1 (
  echo demov3 local server did not become ready.
  echo Please check whether port %PORT% is occupied.
  pause
  exit /b 1
)

start "" "%URL%"
exit /b 0
