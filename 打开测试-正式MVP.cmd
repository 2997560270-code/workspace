@echo off
chcp 65001 >nul
setlocal

set "APP_DIR=%USERPROFILE%\Desktop\workspace\product-drill-mvp\apps\web"
set "PORT=3200"
set "URL=http://127.0.0.1:%PORT%"

if not exist "%APP_DIR%\package.json" (
  echo [ERROR] ????? MVP ?????
  echo %APP_DIR%
  echo.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [ERROR] ???????? npm.cmd????? Node.js / npm ????
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$port=%PORT%; $alive=$false; try { $c=New-Object Net.Sockets.TcpClient; $iar=$c.BeginConnect('127.0.0.1',$port,$null,$null); $alive=$iar.AsyncWaitHandle.WaitOne(400,$false); if($alive){$c.EndConnect($iar)}; $c.Close() } catch { $alive=$false }; if(-not $alive){ Start-Process -FilePath 'cmd.exe' -ArgumentList '/k','cd /d "%APP_DIR%" && npm.cmd run dev -- --hostname 127.0.0.1 --port %PORT%' -WindowStyle Normal; Start-Sleep -Seconds 4 }; Start-Process '%URL%'"

exit /b 0
