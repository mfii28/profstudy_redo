@echo off
REM ============================================================
REM Profs Training Solutions — Development Starter (Windows)
REM Starts both the Python backend and Next.js frontend.
REM Usage:   double-click or run:  start-dev.bat
REM ============================================================
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo [INFO] Starting backend ...
cd backend

if exist ".venv\Scripts\python.exe" (
    set PYTHON=.venv\Scripts\python.exe
) else (
    set PYTHON=python
)

start "Backend" "%PYTHON%" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
if errorlevel 1 (
    echo [ERROR] Backend failed to start. Check backend\.env and database connection.
    pause
    exit /b 1
)
echo [OK] Backend starting at http://localhost:8000

timeout /t 3 /nobreak >nul

echo [INFO] Starting frontend ...
cd /d "%~dp0\frontend"

start "Frontend" cmd /c "npx next dev --port 3000"
if errorlevel 1 (
    echo [ERROR] Frontend failed to start.
    pause
    exit /b 1
)
echo [OK] Frontend starting at http://localhost:3000

echo.
echo ============================================
echo   Both services are starting up!
echo   Frontend -^> http://localhost:3000
echo   Backend  -^> http://localhost:8000
echo   Health   -^> http://localhost:8000/health
echo   Close the terminal windows to stop.
echo ============================================
echo.
pause
