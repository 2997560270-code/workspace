@echo off
cd /d "%~dp0"

set "LOG_DIR=%~dp0..\work\logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
set "LOG_FILE=%LOG_DIR%\product-drill-next-dev-3000.log"

echo.>> "%LOG_FILE%"
echo ===== Product Drill dev server start %date% %time% =====>> "%LOG_FILE%"
echo APP_DIR=%cd%>> "%LOG_FILE%"

if exist "C:\Program Files\nodejs\npm.cmd" (
  "C:\Program Files\nodejs\npm.cmd" run dev -- --hostname 127.0.0.1 --port 3000 >> "%LOG_FILE%" 2>&1
) else (
  npm.cmd run dev -- --hostname 127.0.0.1 --port 3000 >> "%LOG_FILE%" 2>&1
)
