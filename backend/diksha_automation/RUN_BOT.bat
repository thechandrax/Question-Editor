@echo off
title Diksha Automation Bot
cd /d "C:\Users\thego\.gemini\antigravity\scratch\Question-Editor\backend\diksha_automation"
echo =======================================================
echo   Launching Diksha Automation in Visible Browser Mode
echo =======================================================
echo.
if exist venv\Scripts\python.exe (
    venv\Scripts\python.exe main.py
) else (
    python main.py
)
echo.
echo Press any key to close this window...
pause > nul
