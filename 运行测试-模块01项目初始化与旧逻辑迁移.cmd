@echo off
setlocal
title Product Drill Module01 Test

set "ROOT=%~dp0"
set "APP=%ROOT%product-drill-mvp\apps\web"

echo ========================================
echo Product Drill Module01 Test
echo Project init and reusable logic migration
echo ========================================
echo.

if not exist "%APP%\package.json" (
  echo [ERROR] Cannot find app package.json:
  echo %APP%\package.json
  echo.
  echo Please check product-drill-mvp\apps\web exists.
  echo.
  pause
  exit /b 1
)

cd /d "%APP%"
if errorlevel 1 (
  echo [ERROR] Cannot enter app directory:
  echo %APP%
  echo.
  pause
  exit /b 1
)

echo Current test directory: %CD%
echo.
echo Running npm.cmd test ...
echo.
call npm.cmd test
set "EXIT_CODE=%ERRORLEVEL%"
echo.

if "%EXIT_CODE%"=="0" (
  echo [PASS] Module01 tests passed.
  echo Expected: Test Files 6 passed, Tests 9 passed.
) else (
  echo [FAIL] Module01 tests failed. Exit code: %EXIT_CODE%
)

echo.
echo Press any key to close this window...
pause >nul
exit /b %EXIT_CODE%
