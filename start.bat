@echo off
chcp 65001 >nul

echo ==============================================
echo   DataCenter Monitoring System - Startup
echo ==============================================

echo [1/3] Starting Docker containers (Kafka, InfluxDB, MongoDB, Grafana)...
docker-compose up -d

echo.
echo [2/3] Setting up Python Backend...
echo Starting FastAPI Backend (in new window)...
start cmd /k "title Backend && cd /d %~dp0backend && python -m uvicorn main:app --host 127.0.0.1 --port 9000 --reload"

echo.
echo [3/3] Setting up Next.js Frontend...
echo Installing NPM packages...
cd /d %~dp0frontend
call npm install --workspaces=false
echo Starting Next.js Dev Server (in new window, port 9001)...
REM NODE_OPTIONS 8192MB: avoid Turbopack dev OOM on large graphs
start cmd /k "title Frontend && cd /d %~dp0frontend && set NODE_OPTIONS=--max-old-space-size=2048 && npm run dev -- -H 127.0.0.1 -p 9001"
cd ..

echo.
echo ==============================================
echo All services started!
echo.
echo Backend API : http://127.0.0.1:9000/docs
echo Frontend    : http://127.0.0.1:9001
echo Grafana     : http://127.0.0.1:3002
echo.
echo IMPORTANT: Please use http://127.0.0.1:9001 in your browser.
echo ==============================================
pause
