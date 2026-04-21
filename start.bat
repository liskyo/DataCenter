@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
if errorlevel 1 (
  echo [ERROR] Cannot change to folder.
  pause
  exit /b 1
)

set "ROOT=%CD%"
set "VENV_ACTIVATE=%ROOT%\.venv\Scripts\activate.bat"
set "VENV_PY=%ROOT%\.venv\Scripts\python.exe"

:: Help script find Node.js on new computer without restart
if not exist "%ProgramFiles%\nodejs" (
  set "PATH=C:\Program Files\nodejs;%PATH%"
) else (
  set "PATH=%ProgramFiles%\nodejs;%PATH%"
)

chcp 65001 >nul 2>nul

if not exist "%VENV_ACTIVATE%" (
  echo [INFO] Virtual environment not found. Creating...
  python -m venv .venv
)
echo [INFO] Verifying Python requirements...
"%VENV_PY%" -m pip install -r backend\requirements.txt >nul
if errorlevel 1 (
  echo [ERROR] Failed to install requirements.
  pause
  exit /b 1
)

if exist "%ROOT%\.env" (
  echo [INFO] Loading environment variables from .env ...
  for /f "usebackq eol=# tokens=1* delims==" %%A in ("%ROOT%\.env") do (
    if not "%%~A"=="" call set "%%~A=%%~B"
  )
) else (
  echo [INFO] .env not found. Using current system environment.
)

echo ==============================================
echo   DataCenter Monitoring System - Startup
echo ==============================================
echo Root:   %ROOT%
echo Python: %VENV_PY%
echo.

echo [1/4] Starting Docker containers - Kafka, InfluxDB, MongoDB, Mailpit, Grafana
docker compose up -d 2>nul
if errorlevel 1 docker-compose up -d 2>nul
if errorlevel 1 echo [WARN] Docker step skipped - install Docker Desktop or add compose to PATH.

set "KAFKA_CID="
for /f %%i in ('docker compose ps -q kafka 2^>nul') do set "KAFKA_CID=%%i"
if not defined KAFKA_CID for /f %%i in ('docker-compose ps -q kafka 2^>nul') do set "KAFKA_CID=%%i"
if defined KAFKA_CID (
  echo Waiting for Kafka healthcheck...
  set "KAFKA_STATUS="
  for /L %%n in (1,1,30) do (
    for /f %%s in ('docker inspect -f "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" !KAFKA_CID! 2^>nul') do set "KAFKA_STATUS=%%s"
    if /I "!KAFKA_STATUS!"=="healthy" goto kafka_ready
    if /I "!KAFKA_STATUS!"=="running" goto kafka_ready
    timeout /t 2 /nobreak >nul
  )
  echo [WARN] Kafka did not become healthy in time. Backend will still start and use fallback mode.
)
:kafka_ready

echo.
echo [2/4] Setting up Python Backend...
echo Starting FastAPI Backend in new window...
start "Backend" cmd /k "cd /d %ROOT%\backend && call %VENV_ACTIVATE% && python -m uvicorn main:app --host 127.0.0.1 --port 9000 --reload"

timeout /t 3 /nobreak >nul

timeout /t 3 /nobreak >nul

echo.
echo [3/4] Setting up Next.js Frontend...
cd /d "%ROOT%\frontend"
call npm install --workspaces=false
echo Starting Next.js Dev Server in new window, port 9001...
start "Frontend" cmd /k "cd /d %ROOT%\frontend && set NODE_OPTIONS=--max-old-space-size=8192 && npm run dev -- -H 127.0.0.1 -p 9001"
cd /d "%ROOT%"

echo.
echo [4/4] Starting In-Band Telemetry Agents...
echo   - SERVER-015 - standard mode: CPU and Temp
start "Agent-SERVER-015" cmd /k "cd /d %ROOT%\backend && call %VENV_ACTIVATE% && python client_agent.py --server-id SERVER-015"
echo   - CDU-001 - DLC mode: liquid cooling metrics
start "Agent-CDU-001" cmd /k "cd /d %ROOT%\backend && call %VENV_ACTIVATE% && python client_agent.py --server-id CDU-001 --mode dlc"
echo   - IMM-TAN-001 - Immersion mode
start "Agent-IMM-TAN-001" cmd /k "cd /d %ROOT%\backend && call %VENV_ACTIVATE% && python client_agent.py --server-id IMM-TAN-001 --mode immersion"


echo.
echo ==============================================
echo All services started!
echo.
echo Backend API : http://127.0.0.1:9000/docs
echo Frontend    : http://127.0.0.1:9001
echo Grafana     : http://127.0.0.1:3002
echo Mailpit UI  : http://127.0.0.1:8025
echo.
echo Agents      : SERVER-015 standard, CDU-001 DLC
echo Auth Login  : POST http://127.0.0.1:9000/api/auth/login
echo SSE Stream  : GET  http://127.0.0.1:9000/stream
echo.
echo IMPORTANT: Please use http://127.0.0.1:9001 in your browser.
echo ==============================================
echo.
pause
endlocal
exit /b 0
