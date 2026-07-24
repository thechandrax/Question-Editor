@echo off
title Diksha Automation Bot
cd /d "C:\Users\thego\.gemini\antigravity\scratch\diksha_automation"
echo =======================================================
echo   Launching Diksha Automation in Visible Browser Mode
echo =======================================================
echo.
venv\Scripts\python.exe main.py
echo.
echo Press any key to close this window...
pause > nul
