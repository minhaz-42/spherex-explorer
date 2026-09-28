@echo off
rem Double-click to start SPHEREx Explorer on Windows. Options are passed on to start.py.
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 start.py %*
) else (
  python start.py %*
)
if errorlevel 1 pause
