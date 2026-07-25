@echo off
setlocal
title Open Product Drill Module02 App
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0open-module02-app.ps1"
if errorlevel 1 pause
