#include <Arduino.h>
#include <ArduinoJson.h>

#include "config.h"
#include "network_client.h"
#include "water_sensors.h"

static unsigned long last_post_time = 0;

static void publishReading(const WaterSensors::Reading& r, unsigned long now) {
    JsonDocument doc;
    doc["type"] = "reading";
    doc["sensor_id"] = SENSOR_ID;
    doc["timestamp_ms"] = now;
    doc["water_level_mm"] = r.water_level_mm;
    doc["tds_raw"] = r.tds_raw;
    doc["tds_ppm"] = r.tds_ppm;
    doc["uptime_ms"] = now;

    String payload;
    serializeJson(doc, payload);
    Net::postJson("/api/readings", payload);
}

void setup() {
    Serial.begin(115200);
    pinMode(PIN_LED, OUTPUT);

    WaterSensors::begin();
    Net::connectWiFi();
}

void loop() {
    unsigned long now = millis();

    if (now - last_post_time >= POST_INTERVAL_MS) {
        last_post_time = now;
        digitalWrite(PIN_LED, HIGH);

        WaterSensors::Reading r = WaterSensors::sample();
        publishReading(r, now);

        digitalWrite(PIN_LED, LOW);
    }
}
