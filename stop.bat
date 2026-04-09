@echo off
setlocal EnableExtensions
cd /d "%~dp0" || exit /b 1
set "ROOT=%CD%"

chcp 65001 >nul 2>nul

echo ==============================================
echo   DataCenter Monitoring System - Shutdown
echo ==============================================
echo Root: %ROOT%
echo.

echo [1/3] Docker Compose - stopping containers...
docker compose down 2>nul
if errorlevel 1 docker-compose down 2>nul
if errorlevel 1 echo       Docker not available or not running - skipped.

echo.
echo [2/3] Freeing ports 9000 ^(backend^) and 9001 ^(frontend^)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ports = @(9000, 9001); foreach ($port in $ports) { Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $procId = $_.OwningProcess; Write-Host ('       Stopping PID ' + $procId + ' on port ' + $port); Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue } }"

echo.
echo [3/3] Stopping telemetry agents - client_agent.py...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq 'python.exe' -and $_.CommandLine -match 'client_agent' } | ForEach-Object { Write-Host ('       Stopping agent PID ' + $_.ProcessId); Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

echo.
echo ==============================================
echo Done. Close any remaining Backend or Frontend CMD windows manually if needed.
echo ==============================================
echo.
pause
endlocal
exit /b 0
