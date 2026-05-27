# DrainCheck Demo

This repository contains the code and instructions for the DrainCheck low-fidelity demo.

## Setup

1. **Backend API**:
   - Requires Python 3.11+.
   - Navigate to `backend/`.
   - Install dependencies: `pip install -r requirements.txt`.
   - Run the API server: `uvicorn main:app --host 127.0.0.1 --port 8000`.

2. **Frontend Dashboard**:
   - Requires Node.js.
   - Navigate to `frontend/`.
   - Install dependencies: `npm install`.
   - Run the development server: `npm run dev`.
   - Open your browser to the local URL provided in the terminal (usually `http://localhost:5173`).

3. **Firmware**:
   - Open `firmware/draincheck_node/draincheck_node.ino` in Arduino IDE.
   - Install `ArduinoJson` library via Library Manager.
   - Flash each of the 3 ESP32 boards, changing `SENSOR_ID` to `"S1"`, `"S2"`, and `"S3"` respectively before uploading.

4. **Network**:
   - Setup a mobile hotspot on your laptop with SSID `DrainCheckDemo` and password `DemoPassword123` (or match whatever is in the firmware).
   - Ensure the laptop's IP on that interface is `192.168.4.1` (or update `BACKEND_BASE_URL` in firmware).

## Troubleshooting
- If nodes aren't connecting, verify the hotspot is active and using 2.4GHz band.
- If IR beam stays red, wipe the channel walls or realign the emitter.
