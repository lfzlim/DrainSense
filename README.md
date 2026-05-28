# DrainSense

**Live Catchment Monitor.** Real-time distributed IoT sensor network with AI correlation for detecting illegal pollutant dumping and dry-weather flow anomalies.

Built for live pitch demo.

## Tech Stack
- **Frontend:** React, Vite, Leaflet, Tailwind CSS, Recharts
- **Backend:** FastAPI, Python, SQLite, Open-Meteo API
- **Hardware:** ESP32/Arduino, Ultrasonic Distance Sensors, DFrobot Analog TDS Sensors

## Quick Start

You can instantly launch all services using the provided run scripts:
- **Windows:** Double-click `run.bat`
- **macOS/Linux:** Run `./run.sh`

### Manual Startup

If you prefer to start services manually:

#### 1. Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

#### 2. Serial Bridge (USB Arduino Connection)
```bash
cd backend
source venv/bin/activate
python serial_bridge.py
```

#### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:5173**

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stream` | SSE stream for live telemetry & alerts |
| GET | `/api/events` | Fetch historical dumping events |
| POST | `/api/readings` | Ingest sensor telemetry |
| POST | `/api/beam_event` | Ingest IR beam triggers |
| POST | `/api/simulate` | Trigger baseline simulation |
| POST | `/api/test_spike` | Inject an artificial TDS spike |
| POST | `/api/test_uts_dump` | Simulate a dumping event near UTS |
| POST | `/api/reset_baseline` | Recalibrate sensor baselines |
| POST | `/api/clear` | Clear event history and database |

## Requirements
- **Node 18+** for the frontend dashboard.
- **Python 3.9+** for the backend engine.
- Optional: Arduino IDE for flashing firmware to the nodes.

## License
MIT
