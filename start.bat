@echo off
title Question Parser Platform
echo ========================================
echo   Starting Question Parser Platform...
echo ========================================
echo.

:: Kill any old instances on these ports
echo [1/3] Clearing ports 3000 and 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000"') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000"') do taskkill /F /PID %%a >nul 2>&1
timeout /t 1 /nobreak >nul

:: Start Backend
echo [2/3] Starting Backend (port 8000)...
cd /d "%~dp0backend"
start "Backend API" cmd /k ".\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000"
timeout /t 3 /nobreak >nul

:: Start Frontend
echo [3/3] Starting Frontend (port 3000)...
cd /d "%~dp0frontend"
start "Frontend UI" cmd /k "npm.cmd run dev"
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo   Platform is starting up!
echo   Open: http://localhost:3000
echo ========================================
echo.
start "" "http://localhost:3000"
