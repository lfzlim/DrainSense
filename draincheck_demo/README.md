# DrainCheck - Live Pitch Demo Guide

This guide outlines exactly how to set up the software, hardware, and physical props to run the perfect live pitch for DrainCheck.

## 1. Hardware Setup (The Physical Pipe)
1. Mount the **Ultrasonic Sensor (HC-SR04)** facing downwards into your primary testing bucket or acrylic pipe. Connect `Trigger` to Pin 5 and `Echo` to Pin 6 on the Arduino Uno.
2. Mount the **TDS Sensor (Gravity SEN0244)** so its probes rest at the bottom of the bucket/pipe. Connect it to `Pin A1`.
3. Plug the Arduino Uno into your laptop via the USB cable.

## 2. Software Startup
To run the full stack, you need to open **three separate terminal tabs** on your laptop.

### Terminal 1: The Backend API
This runs the Python FastApi server that ingests sensor data and runs the correlation/weather mathematics.
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### Terminal 2: The React Dashboard
This runs the live frontend UI that displays the charts, maps, and alerts.
```bash
cd frontend
npm install
npm run dev
```

### Terminal 3: The USB Serial Bridge
This tiny Python script listens to the Arduino over the USB cable and forwards the sensor data to the backend API.
```bash
cd backend
pip install pyserial requests
# NOTE: Open serial_bridge.py and edit line 8 to match your Arduino's COM port! (e.g., 'COM3' or '/dev/ttyACM0')
python serial_bridge.py
```

## 3. How to Run the Live Demo

### Step 1: Establish the Baseline
- As soon as the `serial_bridge.py` starts, Sensor 4 will begin streaming data to the React Dashboard. 
- The backend will automatically auto-start the simulation engine, so Sensors 1, 2, and 3 will begin plotting normal baseline noise.
- **Action:** Talk to the judges for 30 seconds while the system establishes a flat, clean-water baseline.

### Step 2: The "Dilution Cheat" (Flood Detection)
- **Action:** Tell the judges that factories often try to cheat TDS sensors by heavily diluting their chemicals with thousands of liters of clean tap water. 
- Suddenly place your hand very close to the Ultrasonic sensor (or pour a massive bucket of clean water in).
- **Result:** The water level will spike > 20mm. The backend will query the live Open-Meteo API. Since it is currently sunny/dry, the UI will instantly drop down a flashing **CRITICAL DRY-WEATHER ANOMALY** red alert, proving you caught the factory trying to cheat!

### Step 3: The Chemical Dump (TDS Triangulation)
- **Action:** Hit the "Clear Data" button on the UI to reset the event. Now, pour your "chemicals" (raw milk) into the bucket where the TDS sensor is.
- **Result:** The TDS line will violently spike, and the (extrapolated) Turbidity line will plummet. 
- **The Chain Reaction:** Over the next 15 seconds, the audience will watch the contamination spike ripple down the pipe across the charts for Sensor 3, Sensor 2, and Sensor 1.
- **The Reveal:** Once the event resolves, the algorithm will mathematically analyze the "diffusion sharpness" of the milk, triangulate the exact factory (e.g., *Apex Chemicals*), and publicly name them in the Red Alert banner!
