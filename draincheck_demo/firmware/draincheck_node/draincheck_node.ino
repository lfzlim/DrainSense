#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#define SENSOR_ID         "S1"   // change per node: S1, S2, S3
#define WIFI_SSID         "DrainCheckDemo"
#define WIFI_PASSWORD     "DemoPassword123"
#define BACKEND_BASE_URL  "http://192.168.4.1:8000"
#define POST_INTERVAL_MS  500
#define IR_BEAM_PIN       4

#define PIN_TRIG 5
#define PIN_ECHO 18
#define PIN_TURB 34
#define PIN_EC 35
#define PIN_TDS 32
#define PIN_LED 2

volatile bool beam_event_pending = false;
volatile int latest_beam_state = -1;
volatile unsigned long beam_trigger_time = 0;

unsigned long last_post_time = 0;

void IRAM_ATTR isr_beam() {
  unsigned long t = millis();
  int state = digitalRead(IR_BEAM_PIN);
  if (state != latest_beam_state) {
    latest_beam_state = state;
    beam_trigger_time = t;
    beam_event_pending = true;
  }
}

int readMedian(int pin, int samples = 10) {
  int vals[samples];
  for (int i = 0; i < samples; i++) {
    vals[i] = analogRead(pin);
    delay(2);
  }
  // Sort
  for (int i = 0; i < samples - 1; i++) {
    for (int j = i + 1; j < samples; j++) {
      if (vals[i] > vals[j]) {
        int t = vals[i];
        vals[i] = vals[j];
        vals[j] = t;
      }
    }
  }
  return vals[samples / 2];
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_LED, OUTPUT);
  
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  
  pinMode(IR_BEAM_PIN, INPUT_PULLUP);
  latest_beam_state = digitalRead(IR_BEAM_PIN);
  attachInterrupt(digitalPinToInterrupt(IR_BEAM_PIN), isr_beam, CHANGE);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    digitalWrite(PIN_LED, !digitalRead(PIN_LED));
  }
  Serial.println("\nConnected.");
  digitalWrite(PIN_LED, LOW);
}

void post_json(const char* endpoint, const String& payload) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = String(BACKEND_BASE_URL) + endpoint;
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(1000);
    int httpResponseCode = http.POST(payload);
    http.end();
  }
}

void loop() {
  unsigned long now = millis();
  
  if (beam_event_pending) {
    beam_event_pending = false;
    StaticJsonDocument<200> doc;
    doc["type"] = "beam_event";
    doc["sensor_id"] = SENSOR_ID;
    doc["timestamp_ms"] = beam_trigger_time;
    doc["new_state"] = latest_beam_state;
    doc["uptime_ms"] = now;
    
    String payload;
    serializeJson(doc, payload);
    post_json("/api/beam_event", payload);
  }

  if (now - last_post_time >= POST_INTERVAL_MS) {
    last_post_time = now;
    digitalWrite(PIN_LED, HIGH);

    // Ultrasonic
    digitalWrite(PIN_TRIG, LOW);
    delayMicroseconds(2);
    digitalWrite(PIN_TRIG, HIGH);
    delayMicroseconds(10);
    digitalWrite(PIN_TRIG, LOW);
    long duration = pulseIn(PIN_ECHO, HIGH, 30000); // 30ms timeout
    float distance_mm = (duration * 0.343) / 2.0;
    if (duration == 0) distance_mm = 0;

    // Analog
    int turb_raw = readMedian(PIN_TURB);
    float turb_v = turb_raw * (3.3 / 4095.0); 

    int ec_raw = readMedian(PIN_EC);
    float ec_v = ec_raw * (3.3 / 4095.0);
    float ec_us_cm = 1000.0 * ec_v; // Dummy vendor formula

    int tds_raw = readMedian(PIN_TDS);
    float tds_v = tds_raw * (3.3 / 4095.0);
    float tds_ppm = (133.42 * tds_v * tds_v * tds_v - 255.86 * tds_v * tds_v + 857.39 * tds_v) * 0.5; // DFRobot standard assuming 25C, adapted

    int current_beam = digitalRead(IR_BEAM_PIN);

    StaticJsonDocument<400> doc;
    doc["type"] = "reading";
    doc["sensor_id"] = SENSOR_ID;
    doc["timestamp_ms"] = now;
    doc["water_level_mm"] = distance_mm;
    doc["turbidity_raw"] = turb_raw;
    doc["turbidity_voltage"] = turb_v;
    doc["ec_raw"] = ec_raw;
    doc["ec_us_cm"] = ec_us_cm;
    doc["tds_raw"] = tds_raw;
    doc["tds_ppm"] = tds_ppm;
    doc["ir_beam_state"] = current_beam;
    doc["uptime_ms"] = now;

    String payload;
    serializeJson(doc, payload);
    post_json("/api/readings", payload);

    digitalWrite(PIN_LED, LOW);
  }
}
