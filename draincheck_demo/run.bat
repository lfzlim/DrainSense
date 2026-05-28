@echo off
echo Starting Backend API...
cd backend
IF EXIST venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
) ELSE IF EXIST venv\bin\activate.bat (
    call venv\bin\activate.bat
)

start "Backend API" cmd /k "uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

echo Waiting for Backend to initialize...
timeout /t 2 /nobreak >nul

echo Connecting to Arduino Serial Bridge...
start "Serial Bridge" cmd /k "python serial_bridge.py"

echo Starting Frontend Dashboard...
cd ..\frontend
start "Frontend Dashboard" cmd /k "npm run dev"

echo ===========================================================
echo  DrainSense is running!
echo  - Backend API: http://127.0.0.1:8000
echo  - Frontend Dashboard: http://localhost:5173
echo.
echo  Three new windows have opened running your background tasks.
echo  To safely shut down the demo, simply close those 3 windows!
echo ===========================================================
pause
