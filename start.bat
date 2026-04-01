@echo off
chcp 65001 >nul

echo ==============================================
echo   DataCenter Monitoring System - Startup
echo ==============================================

echo [1/4] Starting Docker containers (Kafka, InfluxDB, MongoDB, Grafana)...
docker-compose up -d

echo.
echo [2/4] Setting up Python Backend...
echo Starting FastAPI Backend (in new window)...
start cmd /k "title Backend && cd /d %~dp0backend && python -m uvicorn main:app --host 127.0.0.1 --port 9000 --reload"

timeout /t 3 /nobreak >nul

echo.
echo [3/4] Setting up Next.js Frontend...
cd /d %~dp0frontend
call npm install --workspaces=false
echo Starting Next.js Dev Server (in new window, port 9001)...
start cmd /k "title Frontend && cd /d %~dp0frontend && set NODE_OPTIONS=--max-old-space-size=8192 && npm run dev -- -H 127.0.0.1 -p 9001"
cd ..

echo.
echo [4/4] Starting In-Band Telemetry Agents...
echo   - SERVER-015 (standard mode: CPU + Temp)
start cmd /k "title Agent-SERVER-015 && cd /d %~dp0backend && python client_agent.py --server-id SERVER-015"
echo   - CDU-001 (DLC mode: + liquid cooling metrics)
start cmd /k "title Agent-CDU-001 && cd /d %~dp0backend && python client_agent.py --server-id CDU-001 --mode dlc"

echo.
echo ==============================================
echo All services started!
echo.
echo Backend API : http://127.0.0.1:9000/docs
echo Frontend    : http://127.0.0.1:9001
echo Grafana     : http://127.0.0.1:3002
echo.
echo Agents      : SERVER-015 (standard), CDU-001 (DLC)
echo Auth Login  : POST http://127.0.0.1:9000/api/auth/login
echo SSE Stream  : GET  http://127.0.0.1:9000/stream
echo.
echo IMPORTANT: Please use http://127.0.0.1:9001 in your browser.
echo ==============================================
pause
