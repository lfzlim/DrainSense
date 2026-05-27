import time
import requests
import random
import asyncio

API_URL = "http://127.0.0.1:8000/api"
SENSORS = ["S1", "S2", "S3", "S4"]

# Baseline normal values
BASELINES = {
    "water_level_mm": 50.0,
    "turbidity_voltage": 3.8,  # high voltage = clean water
    "ec_us_cm": 200.0,
    "tds_ppm": 100.0
}

def generate_noise(val, variance=0.05):
    return val * (1.0 + random.uniform(-variance, variance))

def send_reading(sensor_id, data):
    payload = {
        "type": "reading",
        "sensor_id": sensor_id,
        "timestamp_ms": int(time.time() * 1000),
        "water_level_mm": data["water_level_mm"],
        "turbidity_raw": int(data["turbidity_voltage"] * 1000),
        "turbidity_voltage": data["turbidity_voltage"],
        "ec_raw": int(data["ec_us_cm"]),
        "ec_us_cm": data["ec_us_cm"],
        "tds_raw": int(data["tds_ppm"]),
        "tds_ppm": data["tds_ppm"],
        "ir_beam_state": data.get("ir_beam_state", 1),
        "uptime_ms": 10000
    }
    try:
        requests.post(f"{API_URL}/readings", json=payload)
    except:
        pass

def send_beam_event(sensor_id, state):
    payload = {
        "type": "beam_event",
        "sensor_id": sensor_id,
        "timestamp_ms": int(time.time() * 1000),
        "new_state": state,
        "uptime_ms": 10000
    }
    try:
        requests.post(f"{API_URL}/beam_event", json=payload)
    except:
        pass

async def main():
    print("Starting Fake Data Generator...")
    tick = 0
    event_active = False
    event_ticks_remaining = 0
    
    while True:
        tick += 1
        
        # Trigger an event every 30 seconds (60 ticks at 0.5s)
        if tick % 60 == 0 and not event_active:
            print("--- TRIGGERING FAKE EVENT ON S4 ---")
            event_active = True
            event_ticks_remaining = 20 # 10 seconds of anomaly
            send_beam_event("S4", 0) # Break beam
            
        if event_active:
            event_ticks_remaining -= 1
            if event_ticks_remaining <= 0:
                print("--- ENDING FAKE EVENT ---")
                event_active = False
                send_beam_event("S4", 1) # Restore beam
                
        # Send readings for all sensors
        for s in SENSORS:
            # Generate noisy baseline
            reading = {k: generate_noise(v) for k, v in BASELINES.items()}
            reading["ir_beam_state"] = 1
            
            # Apply anomaly if event is active and it's the target sensor
            if event_active and s == "S4":
                reading["ir_beam_state"] = 0
                reading["turbidity_voltage"] = generate_noise(1.5, 0.1) # Cloudy water
                reading["ec_us_cm"] = generate_noise(600.0, 0.05)       # High conductivity
                reading["tds_ppm"] = generate_noise(450.0, 0.05)        # High dissolved solids
                
            send_reading(s, reading)
            
        await asyncio.sleep(0.5)

if __name__ == "__main__":
    asyncio.run(main())
