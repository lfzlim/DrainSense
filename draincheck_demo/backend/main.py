import os
import json
import time
import uuid
import sqlite3
import asyncio
import random
import requests
import time
from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

import config
import correlation

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

DB_PATH = "events.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS events (
            event_id TEXT PRIMARY KEY,
            started_at REAL NOT NULL,
            resolved_at REAL,
            first_sensor TEXT,
            triggered_sensors TEXT,        
            beam_trigger_times TEXT,       
            flow_velocity_cm_s REAL,
            source_location_cm REAL,
            source_description TEXT,
            pollutant_signature TEXT,      
            confidence TEXT
        )
    ''')
    conn.commit()
    conn.close()

init_db()

class ReadingPayload(BaseModel):
    type: str = Field(..., pattern="^reading$")
    sensor_id: str = Field(..., min_length=2, max_length=10)
    timestamp_ms: int = Field(..., ge=0)
    water_level_mm: float = Field(..., ge=0)
    turbidity_raw: Optional[int] = Field(None, ge=0, le=4095)
    turbidity_voltage: Optional[float] = Field(None, ge=0.0, le=5.0)
    ec_raw: Optional[int] = Field(None, ge=0, le=4095)
    ec_us_cm: Optional[float] = Field(None, ge=0.0)
    tds_raw: int = Field(..., ge=0, le=4095)
    tds_ppm: float = Field(..., ge=0.0)
    ir_beam_state: int = Field(..., ge=0, le=1)
    uptime_ms: int = Field(..., ge=0)

class BeamEventPayload(BaseModel):
    type: str = Field(..., pattern="^beam_event$")
    sensor_id: str = Field(..., min_length=2, max_length=10)
    timestamp_ms: int = Field(..., ge=0)
    new_state: int = Field(..., ge=0, le=1)
    uptime_ms: int = Field(..., ge=0)

sensor_history: Dict[str, List[dict]] = {s: [] for s in config.SENSORS}
baselines: Dict[str, dict] = {s: {"turbidity_voltage": 0, "ec_us_cm": 0, "tds_ppm": 0, "water_level_mm": 0} for s in config.SENSORS}

active_event: Optional[dict] = None
event_subscribers: List[asyncio.Queue] = []

def notify_subscribers(msg: dict):
    for q in event_subscribers:
        q.put_nowait(msg)

def compute_baselines():
    global baselines
    for s in config.SENSORS:
        hist = sensor_history.get(s, [])
        if len(hist) > 0:
            baselines[s]["turbidity_voltage"] = sum(r["turbidity_voltage"] for r in hist) / len(hist)
            baselines[s]["ec_us_cm"] = sum(r["ec_us_cm"] for r in hist) / len(hist)
            baselines[s]["tds_ppm"] = sum(r["tds_ppm"] for r in hist) / len(hist)
            baselines[s]["water_level_mm"] = sum(r["water_level_mm"] for r in hist) / len(hist)

last_flood_alert_times = {}

def check_weather_and_alert(sensor_id: str, level: float, spike: float):
    try:
        lat = config.SENSORS[sensor_id]["lat"]
        lon = config.SENSORS[sensor_id]["lon"]
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=precipitation"
        resp = requests.get(url, timeout=3).json()
        rain = resp.get("current", {}).get("precipitation", 0.0)
        
        if rain > 0.0:
            alert_type = "weather_flood"
        else:
            alert_type = "dry_flood"
            
        notify_subscribers({
            "type": "flood_alert",
            "alert_subtype": alert_type,
            "sensor_id": sensor_id,
            "level": level,
            "spike": spike,
            "rain": rain
        })
    except Exception as e:
        print(f"Weather API error: {e}")

@app.post("/api/readings")
async def receive_reading(payload: ReadingPayload):
    global simulation_active, has_auto_started, chain_reaction_active, chain_reaction_tick, s4_peak_tds, s4_peak_ec
    received_at = time.time()
    sensor_id = payload.sensor_id
    if sensor_id not in config.SENSORS:
        raise HTTPException(status_code=400, detail="Unknown sensor ID")
        
    # Auto-start simulation if S4 sends data (only trigger once so manual stop works)
    if sensor_id == "S4":
        if not simulation_active and not has_auto_started:
            simulation_active = True
            has_auto_started = True
            notify_subscribers({"type": "simulation_state", "active": True})
            
        # Detect TDS spike on S4 to start chain reaction
        base_tds = baselines["S4"]["tds_ppm"]
        if base_tds > 0 and payload.tds_ppm > base_tds + config.EVENT_THRESHOLD_TDS_RISE_PPM:
            if not chain_reaction_active:
                chain_reaction_active = True
                chain_reaction_tick = 0
                s4_peak_tds = payload.tds_ppm
                s4_peak_ec = payload.ec_us_cm if payload.ec_us_cm else (payload.tds_ppm * 2)
                evt = BeamEventPayload(type="beam_event", sensor_id="S4", timestamp_ms=int(time.time()*1000), new_state=0, uptime_ms=10000)
                await receive_beam_event(evt)
                
    if payload.turbidity_voltage is None:
        payload.turbidity_voltage = round(max(0.0, 3.8 - (payload.tds_ppm / 200.0) + random.uniform(-0.15, 0.15)), 2)
        payload.turbidity_raw = int(payload.turbidity_voltage * 1000)
        
    if payload.ec_us_cm is None:
        payload.ec_us_cm = 0.0
        payload.ec_raw = 0
        
    # Flood Detection
    base_level = baselines[sensor_id]["water_level_mm"]
    if base_level > 0 and payload.water_level_mm > base_level + 20:
        current_time = time.time()
        if current_time - last_flood_alert_times.get(sensor_id, 0) > 10:
            last_flood_alert_times[sensor_id] = current_time
            asyncio.create_task(asyncio.to_thread(check_weather_and_alert, sensor_id, payload.water_level_mm, round(payload.water_level_mm - base_level, 1)))
    
    reading_dict = payload.model_dump()
    reading_dict["t"] = received_at
    
    hist = sensor_history[sensor_id]
    hist.append(reading_dict)
    # keep last 600 readings (5 mins at 2Hz)
    if len(hist) > 600:
        hist.pop(0)
        
    # Update baseline if no active event
    if not active_event:
        # For simplicity, we just use the naive compute here. In real system, rolling average
        compute_baselines()
        
    # SSE update
    sse_msg = {
        "type": "reading",
        "sensor_id": sensor_id,
        "t": received_at,
        "water_level_mm": payload.water_level_mm,
        "turbidity_voltage": payload.turbidity_voltage,
        "turbidity_baseline": baselines[sensor_id]["turbidity_voltage"],
        "ec_us_cm": payload.ec_us_cm,
        "ec_baseline": baselines[sensor_id]["ec_us_cm"],
        "tds_ppm": payload.tds_ppm,
        "tds_baseline": baselines[sensor_id]["tds_ppm"],
        "ir_beam_state": payload.ir_beam_state
    }
    notify_subscribers(sse_msg)
    
    return {"ok": True}

@app.post("/api/beam_event")
async def receive_beam_event(payload: BeamEventPayload):
    global active_event
    received_at = time.time()
    sensor_id = payload.sensor_id
    if sensor_id not in config.SENSORS:
        raise HTTPException(status_code=400, detail="Unknown sensor ID")
        
    if payload.new_state == 0:
        if not active_event:
            # Start new event
            active_event = {
                "event_id": f"evt_{uuid.uuid4().hex[:8]}",
                "started_at": received_at,
                "first_sensor": sensor_id,
                "triggered_sensors": [sensor_id],
                "beam_trigger_times": {sensor_id: received_at},
                "pollutant_signature": set()
            }
            notify_subscribers({
                "type": "event_start",
                "event_id": active_event["event_id"],
                "first_sensor": sensor_id,
                "t": received_at
            })
            
            # Start a background task to resolve event after correlation window
            asyncio.create_task(resolve_event_after_window(active_event["event_id"], config.CORRELATION_WINDOW_SECONDS))
        else:
            # Add to active event
            if sensor_id not in active_event["triggered_sensors"]:
                active_event["triggered_sensors"].append(sensor_id)
                active_event["beam_trigger_times"][sensor_id] = received_at
                notify_subscribers({
                    "type": "sensor_triggered",
                    "event_id": active_event["event_id"],
                    "sensor_id": sensor_id,
                    "t": received_at
                })
    return {"ok": True}

async def resolve_event_after_window(event_id: str, delay: float):
    global active_event
    await asyncio.sleep(delay)
    if active_event and active_event["event_id"] == event_id:
        # resolve event
        resolve_event()

def check_analog_signatures(event: dict):
    # Check analog sensors for signatures
    for s in event["triggered_sensors"]:
        hist = sensor_history.get(s, [])
        # Look at readings during the event window
        event_readings = [r for r in hist if event["started_at"] <= r["t"] <= time.time()]
        if not event_readings:
            continue
            
        min_turb = min([r["turbidity_voltage"] for r in event_readings])
        max_ec = max([r["ec_us_cm"] for r in event_readings])
        max_tds = max([r["tds_ppm"] for r in event_readings])
        max_level = max([r["water_level_mm"] for r in event_readings])
        
        base = baselines[s]
        
        if min_turb < base["turbidity_voltage"] - config.EVENT_THRESHOLD_TURBIDITY_DROP_V:
            event["pollutant_signature"].add("High Turbidity")
        if max_tds > base["tds_ppm"] + config.EVENT_THRESHOLD_TDS_RISE_PPM:
            event["pollutant_signature"].add("Elevated TDS")
        if max_level > base["water_level_mm"] + config.EVENT_THRESHOLD_LEVEL_RISE_MM:
            event["pollutant_signature"].add("High Water Level (Possible Rainfall)")

def resolve_event():
    global active_event
    if not active_event:
        return
        
    check_analog_signatures(active_event)
    
    # Run localization
    active_event["pollutant_signature"] = list(active_event["pollutant_signature"])
    loc_data = correlation.localize_source(active_event, config.SENSORS, sensor_history)
    
    active_event.update(loc_data)
    active_event["resolved_at"] = time.time()
    
    # Save to db
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('''
            INSERT INTO events (
                event_id, started_at, resolved_at, first_sensor, triggered_sensors,
                beam_trigger_times, flow_velocity_cm_s, source_location_cm,
                source_description, pollutant_signature, confidence
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            active_event["event_id"],
            active_event["started_at"],
            active_event["resolved_at"],
            active_event["first_sensor"],
            json.dumps(active_event["triggered_sensors"]),
            json.dumps(active_event["beam_trigger_times"]),
            active_event.get("flow_velocity_cm_s", 0.0),
            active_event.get("source_location_cm", 0.0),
            active_event.get("source_description", ""),
            json.dumps(active_event["pollutant_signature"]),
            active_event.get("confidence", "low")
        ))
        conn.commit()
    except Exception as e:
        print(f"DB Error: {e}")
    finally:
        if 'conn' in locals():
            conn.close()
            
    # Notify
    msg = {
        "type": "event_resolved",
        "event_id": active_event["event_id"],
        "first_sensor": active_event["first_sensor"],
        "triggered_sensors": active_event["triggered_sensors"],
        "beam_trigger_times": active_event["beam_trigger_times"],
        "flow_velocity_cm_s": active_event.get("flow_velocity_cm_s", 0.0),
        "source_location_cm": active_event.get("source_location_cm", 0.0),
        "source_description": active_event.get("source_description", ""),
        "pollutant_signature": active_event["pollutant_signature"],
        "confidence": active_event.get("confidence", "low")
    }
    notify_subscribers(msg)
    
    active_event = None

@app.post("/api/reset_baseline")
async def reset_baseline():
    compute_baselines()
    return {"ok": True}

@app.post("/api/clear")
async def clear_data():
    global sensor_history, active_event, has_auto_started, chain_reaction_active, chain_reaction_tick
    
    # Clear memory state
    for s in config.SENSORS:
        sensor_history[s].clear()
    active_event = None
    has_auto_started = False
    chain_reaction_active = False
    chain_reaction_tick = 0
    
    # Clear database
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("DELETE FROM events")
        conn.commit()
    except Exception as e:
        print(f"DB Clear Error: {e}")
    finally:
        if 'conn' in locals():
            conn.close()
            
    notify_subscribers({"type": "clear_data"})
    return {"ok": True}

# --- SIMULATION ENGINE ---
simulation_active = False
has_auto_started = False
chain_reaction_active = False
chain_reaction_tick = 0
uts_dump_active = False
s4_peak_tds = 300.0
s4_peak_ec = 500.0

BASELINES_SIM = {
    "water_level_mm": 50.0,
    "turbidity_voltage": 3.8,
    "ec_us_cm": 200.0,
    "tds_ppm": 100.0
}

def generate_noise(val, variance=0.05):
    return val * (1.0 + random.uniform(-variance, variance))

async def simulation_loop():
    global simulation_active, chain_reaction_active, chain_reaction_tick
    
    while True:
        if not simulation_active and not uts_dump_active:
            await asyncio.sleep(0.5)
            continue
            
        if chain_reaction_active:
            chain_reaction_tick += 1
            
            # Fire beam events exactly on the target ticks
            if chain_reaction_tick == 8:
                await receive_beam_event(BeamEventPayload(type="beam_event", sensor_id="S3", timestamp_ms=int(time.time()*1000), new_state=0, uptime_ms=10000))
            if chain_reaction_tick == 16:
                await receive_beam_event(BeamEventPayload(type="beam_event", sensor_id="S2", timestamp_ms=int(time.time()*1000), new_state=0, uptime_ms=10000))
            if chain_reaction_tick == 24:
                await receive_beam_event(BeamEventPayload(type="beam_event", sensor_id="S1", timestamp_ms=int(time.time()*1000), new_state=0, uptime_ms=10000))
            
            if chain_reaction_tick >= 40:
                chain_reaction_active = False
                await receive_beam_event(BeamEventPayload(type="beam_event", sensor_id="S4", timestamp_ms=int(time.time()*1000), new_state=1, uptime_ms=10000))
                await receive_beam_event(BeamEventPayload(type="beam_event", sensor_id="S3", timestamp_ms=int(time.time()*1000), new_state=1, uptime_ms=10000))
                await receive_beam_event(BeamEventPayload(type="beam_event", sensor_id="S2", timestamp_ms=int(time.time()*1000), new_state=1, uptime_ms=10000))
                await receive_beam_event(BeamEventPayload(type="beam_event", sensor_id="S1", timestamp_ms=int(time.time()*1000), new_state=1, uptime_ms=10000))
                
        # Send readings ONLY for S1, S2, S3 (S4 is real hardware)
        for s in ["S1", "S2", "S3"]:
            reading = {k: generate_noise(v) for k, v in BASELINES_SIM.items()}
            reading["ir_beam_state"] = 1
            
            if uts_dump_active and s == "S1":
                reading["ir_beam_state"] = 0
                reading["tds_ppm"] = generate_noise(350.0, 0.05)
                reading["ec_us_cm"] = generate_noise(550.0, 0.05)
                
            if chain_reaction_active:
                if s == "S3" and chain_reaction_tick >= 8:
                    reading["ir_beam_state"] = 0
                    reading["tds_ppm"] = generate_noise(s4_peak_tds * 0.85, 0.05)
                    reading["ec_us_cm"] = generate_noise(s4_peak_ec * 0.85, 0.05)
                if s == "S2" and chain_reaction_tick >= 16:
                    reading["ir_beam_state"] = 0
                    reading["tds_ppm"] = generate_noise(s4_peak_tds * 0.70, 0.05)
                    reading["ec_us_cm"] = generate_noise(s4_peak_ec * 0.70, 0.05)
                if s == "S1" and chain_reaction_tick >= 24:
                    reading["ir_beam_state"] = 0
                    reading["tds_ppm"] = generate_noise(s4_peak_tds * 0.55, 0.05)
                    reading["ec_us_cm"] = generate_noise(s4_peak_ec * 0.55, 0.05)
                
            # Tie simulated turbidity tightly to the simulated TDS with a small random jitter
            reading["turbidity_voltage"] = round(max(0.0, 3.8 - (reading["tds_ppm"] / 200.0) + random.uniform(-0.10, 0.10)), 2)
                
            payload = ReadingPayload(
                type="reading", sensor_id=s, timestamp_ms=int(time.time()*1000),
                water_level_mm=reading["water_level_mm"],
                turbidity_raw=int(reading["turbidity_voltage"]*1000),
                turbidity_voltage=reading["turbidity_voltage"],
                ec_raw=int(reading["ec_us_cm"]),
                ec_us_cm=reading["ec_us_cm"],
                tds_raw=int(reading["tds_ppm"]),
                tds_ppm=reading["tds_ppm"],
                ir_beam_state=reading["ir_beam_state"],
                uptime_ms=10000
            )
            await receive_reading(payload)
            
        await asyncio.sleep(0.5)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(simulation_loop())

class SimulateToggleRequest(BaseModel):
    active: bool

@app.post("/api/simulate")
async def toggle_simulate(payload: SimulateToggleRequest):
    global simulation_active
    simulation_active = payload.active
    notify_subscribers({"type": "simulation_state", "active": simulation_active})
    return {"ok": True, "simulation_active": simulation_active}

class TestSpikeRequest(BaseModel):
    tds_ppm: float

@app.post("/api/test_spike")
async def trigger_test_spike(payload: TestSpikeRequest):
    global chain_reaction_active, chain_reaction_tick, s4_peak_tds, s4_peak_ec, simulation_active, has_auto_started
    
    simulation_active = True
    has_auto_started = True
    
    chain_reaction_active = True
    chain_reaction_tick = 0
    s4_peak_tds = payload.tds_ppm
    s4_peak_ec = payload.tds_ppm * 2.0
    
    evt = BeamEventPayload(type="beam_event", sensor_id="S4", timestamp_ms=int(time.time()*1000), new_state=0, uptime_ms=10000)
    await receive_beam_event(evt)
    
    reading = ReadingPayload(
        type="reading",
        sensor_id="S4",
        timestamp_ms=int(time.time()*1000),
        water_level_mm=50.0,
        tds_raw=int(payload.tds_ppm),
        tds_ppm=payload.tds_ppm,
        turbidity_voltage=max(0.0, 3.8 - (payload.tds_ppm / 200.0)),
        ec_us_cm=payload.tds_ppm * 2.0,
        ir_beam_state=0,
        uptime_ms=10000
    )
    await receive_reading(reading)
    return {"ok": True}

@app.get("/api/events")
async def get_events(hours: Optional[int] = None):
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        if hours is not None:
            threshold = time.time() - (hours * 3600)
            c.execute("SELECT * FROM events WHERE started_at >= ? ORDER BY started_at DESC", (threshold,))
        else:
            c.execute("SELECT * FROM events ORDER BY started_at DESC LIMIT 10")
        rows = c.fetchall()
        cols = [description[0] for description in c.description]
        events = [dict(zip(cols, row)) for row in rows]
        # parse json strings
        for ev in events:
            ev["triggered_sensors"] = json.loads(ev["triggered_sensors"])
            ev["beam_trigger_times"] = json.loads(ev["beam_trigger_times"])
            ev["pollutant_signature"] = json.loads(ev["pollutant_signature"])
        return events
    except Exception as e:
        raise HTTPException(status_code=500, detail="DB Error")
    finally:
        if 'conn' in locals():
            conn.close()

@app.get("/api/stream")
async def stream(request: Request):
    async def event_generator():
        q = asyncio.Queue()
        event_subscribers.append(q)
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=5.0)
                    yield {"data": json.dumps(msg)}
                except asyncio.TimeoutError:
                    yield {"data": json.dumps({"type": "heartbeat", "t": time.time()})}
        finally:
            event_subscribers.remove(q)
            
    return EventSourceResponse(event_generator())

if __name__ == "__main__":
    import uvicorn
    # According to security rules, MUST use localhost for testing
    uvicorn.run(app, host="127.0.0.1", port=8000)

async def trigger_uts_dump_task():
    global uts_dump_active
    print("Initiating UTS dump in 2 seconds...")
    await asyncio.sleep(2)
    print("UTS dump triggered!")
    uts_dump_active = True
    evt = BeamEventPayload(type="beam_event", sensor_id="S1", timestamp_ms=int(time.time()*1000), new_state=0, uptime_ms=10000)
    await receive_beam_event(evt)
    await asyncio.sleep(10)
    uts_dump_active = False
    evt_end = BeamEventPayload(type="beam_event", sensor_id="S1", timestamp_ms=int(time.time()*1000), new_state=1, uptime_ms=10000)
    await receive_beam_event(evt_end)
    print("UTS dump ended.")

@app.post("/api/test_uts_dump")
async def test_uts_dump(background_tasks: BackgroundTasks):
    background_tasks.add_task(trigger_uts_dump_task)
    return {"ok": True}
