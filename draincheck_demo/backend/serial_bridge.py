import serial
import json
import requests
import time

# ==========================================
# CONFIGURATION
# ==========================================
# Change this to match your Arduino's COM port! (e.g., 'COM3' on Windows, '/dev/ttyACM0' on Mac/Linux)
SERIAL_PORT = '/dev/ttyACM0' 
BAUD_RATE = 115200
API_URL = 'http://127.0.0.1:8000/api/readings'

def main():
    print(f"Connecting to Arduino on {SERIAL_PORT}...")
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        print("Connected! Listening for sensor data...")
    except Exception as e:
        print(f"FAILED to connect to {SERIAL_PORT}. Please check the port name.")
        print(e)
        return

    while True:
        try:
            if ser.in_waiting > 0:
                line = ser.readline().decode('utf-8').strip()
                
                # Only process JSON lines
                if line.startswith('{') and line.endswith('}'):
                    # Parse JSON to verify it's valid
                    data = json.loads(line)
                    
                    # Add current timestamp
                    data["timestamp_ms"] = int(time.time() * 1000)
                    
                    print(f"Sending to Backend: {data['tds_ppm']} ppm | {data['water_level_mm']} mm")
                    
                    # Forward to API
                    try:
                        requests.post(API_URL, json=data, timeout=2)
                    except requests.exceptions.RequestException as e:
                        print(f"Failed to reach backend API: {e}")
                else:
                    # Ignore non-JSON debug prints
                    print(f"[Arduino Debug]: {line}")
                    
        except KeyboardInterrupt:
            print("\nExiting...")
            break
        except Exception as e:
            print(f"Error reading serial: {e}")
            time.sleep(1)

    ser.close()

if __name__ == '__main__':
    main()
