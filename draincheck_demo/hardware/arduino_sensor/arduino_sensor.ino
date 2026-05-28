/**
 DFRobot Gravity: Analog TDS Sensor/Meter + HC-SR04 Ultrasonic Sensor
 
 TDS sensor reads water TDS (ppm).
 Ultrasonic sensor (HC-SR04) measures distance in cm.
   - Trig: A5
   - Echo: A4
 **/

#include <EEPROM.h>
#include "GravityTDS.h"

#define TdsSensorPin A1
#define TrigPin      A5
#define EchoPin      A4

GravityTDS gravityTds;

float temperature = 25, tdsValue = 0;
float distanceCm = 0;
float waterLevelMm = 0;

void setup()
{
    Serial.begin(115200);

    // TDS sensor setup
    gravityTds.setPin(TdsSensorPin);
    gravityTds.setAref(5.0);        // reference voltage on ADC, default 5.0V on Arduino UNO
    gravityTds.setAdcRange(1024);   // 1024 for 10bit ADC; 4096 for 12bit ADC
    gravityTds.begin();             // initialization

    // Ultrasonic sensor setup
    // A4 and A5 are used as digital pins here
    pinMode(TrigPin, OUTPUT);
    pinMode(EchoPin, INPUT);
    digitalWrite(TrigPin, LOW);
}

float readDistanceCm()
{
    // Send a 10us HIGH pulse to trigger the measurement
    digitalWrite(TrigPin, LOW);
    delayMicroseconds(2);
    digitalWrite(TrigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(TrigPin, LOW);

    // Read echo pulse duration (timeout 30 ms ≈ 5 m range)
    unsigned long duration = pulseIn(EchoPin, HIGH, 30000UL);

    if (duration == 0) {
        return 0.0;  // no echo received (out of range / not connected)
    }

    // Speed of sound ~343 m/s -> 0.0343 cm/us, divide by 2 for round trip
    return (duration * 0.0343f) / 2.0f;
}

void loop()
{
    // --- TDS reading ---
    //temperature = readTemperature();  // add your temperature sensor and read it
    gravityTds.setTemperature(temperature);  // set temperature for compensation
    gravityTds.update();                     // sample and calculate
    tdsValue = gravityTds.getTdsValue();     // get the TDS value

    // --- Ultrasonic reading ---
    distanceCm = readDistanceCm();
    
    // Assume the pipe/container is 190mm (19cm) tall. 
    // Water height = Total Height - Distance from top sensor to water
    float pipeHeightMm = 190.0;
    waterLevelMm = pipeHeightMm - (distanceCm * 10.0); 
    if (waterLevelMm < 0) waterLevelMm = 0;

    // --- JSON Output for Python Backend ---
    Serial.print("{\"type\":\"reading\",");
    Serial.print("\"sensor_id\":\"S4\",");
    Serial.print("\"timestamp_ms\":0,");
    
    Serial.print("\"water_level_mm\":"); 
    Serial.print(waterLevelMm); 
    Serial.print(",");
    
    Serial.print("\"tds_raw\":0,");
    
    Serial.print("\"tds_ppm\":"); 
    Serial.print(tdsValue); 
    Serial.print(",");
    
    Serial.print("\"ir_beam_state\":1,"); // Assuming intact for now
    
    Serial.print("\"uptime_ms\":"); 
    Serial.print(millis());
    
    Serial.println("}");

    delay(500); // 500ms delay so the dashboard updates 2x a second!
}
