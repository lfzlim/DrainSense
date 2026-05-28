#include <EEPROM.h>
#include "GravityTDS.h"

#define TdsSensorPin A1
#define TRIG_PIN 5           // Ultrasonic Trigger Pin
#define ECHO_PIN 6           // Ultrasonic Echo Pin

GravityTDS gravityTds;
float temperature = 25.0; // Assume 25C if no temp sensor
float tdsValue = 0;
float waterLevelMm = 0;

void setup() {
    Serial.begin(115200);

    // 1. Initialize TDS Sensor
    gravityTds.setPin(TdsSensorPin);
    gravityTds.setAref(5.0);  // Arduino Uno uses 5V reference
    gravityTds.setAdcRange(1024); // Arduino Uno has 10-bit ADC
    gravityTds.begin();

    // 2. Initialize Ultrasonic Sensor
    pinMode(TRIG_PIN, OUTPUT);
    pinMode(ECHO_PIN, INPUT);
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
    long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout
    if (duration == 0) {
        waterLevelMm = 0; // Timeout
    } else {
        // Speed of sound is 343 m/s. Convert time to distance in mm.
        waterLevelMm = (duration * 0.343) / 2.0; 
    }

    // ==========================================
    // 2. SEND TO LAPTOP VIA SERIAL (JSON)
    // ==========================================
    // We format it as a JSON string so the Python script can read it.
    
    Serial.print("{\"type\":\"reading\",");
    Serial.print("\"sensor_id\":\"S4\",");
    Serial.print("\"timestamp_ms\":0,");
    Serial.print("\"water_level_mm\":"); Serial.print(waterLevelMm); Serial.print(",");
    Serial.print("\"tds_raw\":0,");
    Serial.print("\"tds_ppm\":"); Serial.print(tdsValue); Serial.print(",");
    Serial.print("\"ir_beam_state\":1,"); // Assuming intact
    Serial.print("\"uptime_ms\":"); Serial.print(millis());
    Serial.println("}");

    // Send data every 500ms for real-time dashboard updates!
    delay(500); 
}
