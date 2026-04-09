@echo off
cd /d "%~dp0"
title DCIM-start-debug
echo Current folder: %CD%
echo.
call start.bat
echo.
echo start.bat finished, errorlevel=%ERRORLEVEL%
pause
