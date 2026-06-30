@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0open-demov3-workbench-entry.ps1"
if errorlevel 1 pause
