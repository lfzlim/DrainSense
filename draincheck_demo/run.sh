#!/bin/bash

# Start Backend
echo "Starting Backend API..."
cd backend
if [ -d "venv/bin" ]; then
    source venv/bin/activate
elif [ -d "venv/Scripts" ]; then
    source venv/Scripts/activate
fi
uvicorn main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!

echo "Waiting for Backend to initialize..."
sleep 2

echo "Connecting to Arduino Serial Bridge..."
venv/bin/python serial_bridge.py &
SERIAL_PID=$!

# Start Frontend
echo "Starting Frontend Dashboard..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo "==========================================================="
echo " DrainCheck is running!"
echo " - Backend API: http://127.0.0.1:8000"
echo " - Frontend Dashboard: http://localhost:5173"
echo " Press Ctrl+C to shut down all services."
echo "==========================================================="

# Wait for Ctrl+C
trap "echo 'Shutting down services...'; kill $BACKEND_PID $SERIAL_PID $FRONTEND_PID; exit" SIGINT
wait
