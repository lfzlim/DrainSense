#include <WiFi.h>
#include <HTTPClient.h>
#include <EEPROM.h>
#include "GravityTDS.h"

// ==========================================
// CONFIGURATION
// ==========================================
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
// Change this to the IP address of your laptop running the backend!
const char* serverUrl = "http://192.168.X.X:8000/api/readings"; 

// Pin Definitions
#define TdsSensorPin 34      // ADC Pin for TDS
#define TRIG_PIN 5           // Ultrasonic Trigger Pin
#define ECHO_PIN 18          // Ultrasonic Echo Pin
#define IR_PIN 19            // IR Break Beam Pin (Optional)

GravityTDS gravityTds;
float temperature = 25.0; // Assume 25C if no temp sensor
float tdsValue = 0;
float waterLevelMm = 0;

void setup() {
    Serial.begin(115200);

    // 1. Connect to WiFi
    Serial.print("Connecting to WiFi");
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nWiFi Connected!");

    // 2. Initialize TDS Sensor
    gravityTds.setPin(TdsSensorPin);
    // CRITICAL FIX FOR ESP32: 
    // ESP32 uses 3.3V ADC and 12-bit resolution (4096), unlike Arduino Uno (5V, 1024)
    gravityTds.setAref(3.3);  
    gravityTds.setAdcRange(4096); 
    gravityTds.begin();

    // 3. Initialize Ultrasonic Sensor
    pinMode(TRIG_PIN, OUTPUT);
    pinMode(ECHO_PIN, INPUT);
    
    // 4. Initialize IR Sensor (Optional fallback)
    pinMode(IR_PIN, INPUT_PULLUP);
}

void loop() {
    // ==========================================
    // 1. READ SENSORS
    // ==========================================
    
    // Read TDS
    gravityTds.setTemperature(temperature); 
    gravityTds.update();
    tdsValue = gravityTds.getTdsValue();

    // Read Ultrasonic Water Level
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);
    long duration = pulseIn(ECHO_PIN, HIGH);
    // Speed of sound is 343 m/s. Convert time to distance in mm.
    waterLevelMm = (duration * 0.343) / 2.0; 

    // Read IR Beam
    int irState = digitalRead(IR_PIN); 

    // ==========================================
    // 2. SEND TO BACKEND
    // ==========================================
    if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        http.begin(serverUrl);
        http.addHeader("Content-Type", "application/json");

        // Construct JSON Payload manually for speed (You can also use ArduinoJson library)
        String jsonPayload = "{";
        jsonPayload += "\"type\":\"reading\",";
        jsonPayload += "\"sensor_id\":\"S4\",";
        jsonPayload += "\"timestamp_ms\":0,";
        jsonPayload += "\"water_level_mm\":" + String(waterLevelMm) + ",";
        jsonPayload += "\"tds_raw\":0,";
        jsonPayload += "\"tds_ppm\":" + String(tdsValue) + ",";
        jsonPayload += "\"ir_beam_state\":" + String(irState) + ",";
        jsonPayload += "\"uptime_ms\":" + String(millis());
        jsonPayload += "}";

        // Send POST request
        int httpResponseCode = http.POST(jsonPayload);

        if (httpResponseCode > 0) {
            Serial.print("Data sent! HTTP Response: ");
            Serial.println(httpResponseCode);
            Serial.print("TDS: "); Serial.print(tdsValue);
            Serial.print(" ppm | Level: "); Serial.print(waterLevelMm); Serial.println(" mm");
        } else {
            Serial.print("Error sending data. Code: ");
            Serial.println(httpResponseCode);
        }
        http.end();
    } else {
        Serial.println("WiFi Disconnected!");
    }

    // Send data every 500ms for real-time dashboard updates!
    delay(500); 
}
