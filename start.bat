@echo off
echo ===================================================
echo Starting Question Platform (Frontend + Backend)
echo ===================================================

echo Starting Python Backend API on Port 8000...
start cmd /k "cd backend && call venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

echo Waiting for backend to initialize...
ping 127.0.0.1 -n 4 > nul

echo Starting Next.js Frontend Server on Port 3000...
start cmd /k "cd frontend && npm run dev"

echo Both services have been launched in separate windows!
echo Opening http://localhost:3000 in your default browser...
start http://localhost:3000
