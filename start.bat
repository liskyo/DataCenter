@echo off
chcp 65001 >nul

echo ==============================================
echo   DataCenter Monitoring System - Startup
echo ==============================================

echo [1/3] Starting Docker containers (Kafka, InfluxDB, MongoDB, Grafana)...
docker-compose up -d

echo.
echo [2/3] Setting up Python Backend...
cd backend
echo Installing Python requirements...
pip install -r requirements.txt
echo Starting FastAPI Backend (in new window)...
start cmd /k "title Backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
cd ..

echo.
echo [3/3] Setting up Next.js Frontend...
cd frontend
echo Installing NPM packages...
call npm install
echo Starting Next.js Dev Server (in new window, port 3001)...
start cmd /k "title Frontend && npm run dev -- -p 3001"
cd ..

echo.
echo ==============================================
echo All services started!
echo Backend API : http://localhost:8000/docs
echo Frontend    : http://localhost:3001
echo Grafana     : http://localhost:3000
echo ==============================================
pause
