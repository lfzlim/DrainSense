// ============================================================
//  Sensor Test Sketch
//  - IR Break Beam Sensor  (DFRobot SEN0503 / 50cm)
//  - Gravity Analog TDS Sensor/Meter (DFRobot SEN0244)
//
//  Wiring:
//    IR Break Beam Receiver  → Digital Pin 2  (+ 5V, GND)
//    TDS Sensor signal wire  → Analog Pin A0  (+ 5V, GND)
//
//  Open Serial Monitor at 115200 baud to see readings.
// ============================================================

// ---------- Pin Definitions ----------
#define IR_BEAM_PIN    2     // Digital pin for IR receiver output
#define TDS_PIN        A0    // Analog pin for TDS sensor signal

// ---------- TDS Constants ----------
#define VREF           5.0   // Reference voltage (5V Arduino)
                             // Change to 3.3 if using a 3.3V board
#define ADC_RESOLUTION 1024.0// 10-bit ADC
#define TEMP_CELSIUS   25.0  // Assumed water temperature for compensation
                             // Replace with a real thermometer reading
                             // if accuracy is critical

// ---------- Sampling config ----------
#define SAMPLE_INTERVAL 30   // ms between each ADC sample
#define PRINT_INTERVAL 1000  // ms between Serial prints

// ---------- State ----------
unsigned long lastPrintTime  = 0;
unsigned long lastSampleTime = 0;
bool          beamWasBroken  = false;  // tracks edge for IR event log

long adcSum = 0;
int sampleCount = 0;

// ============================================================
void setup() {
  Serial.begin(115200);
  while (!Serial) { ; }  // wait for USB Serial on Leonardo/Micro

  pinMode(IR_BEAM_PIN, INPUT_PULLUP);
  // The SEN0503 receiver pulls the line LOW when the beam is
  // INTACT, and lets it float HIGH when the beam is BROKEN.
  // INPUT_PULLUP keeps the line defined when the beam is broken.

  Serial.println(F("========================================="));
  Serial.println(F("  Sensor Test — IR Break Beam + TDS"));
  Serial.println(F("========================================="));
  Serial.println(F("Columns: Time(ms) | IR Beam | TDS Voltage(V) | TDS(ppm)"));
  Serial.println();
}

// ============================================================
void loop() {
  unsigned long now = millis();

  // --- IR Break Beam (check every loop for instant event logging) ---
  bool beamBroken = digitalRead(IR_BEAM_PIN) == HIGH;
  // HIGH → beam is broken (pullup + open-collector receiver)

  if (beamBroken != beamWasBroken) {            // state changed
    Serial.print(F("[EVENT] "));
    Serial.print(now);
    Serial.print(F(" ms — Beam "));
    Serial.println(beamBroken ? F("BROKEN  ⚠") : F("RESTORED ✓"));
    beamWasBroken = beamBroken;
  }

  // --- TDS Non-blocking Sampling ---
  if (now - lastSampleTime >= SAMPLE_INTERVAL) {
    lastSampleTime = now;
    adcSum += analogRead(TDS_PIN);
    sampleCount++;
  }

  // --- Periodic full reading printout ---
  if (now - lastPrintTime >= PRINT_INTERVAL) {
    lastPrintTime = now;

    float voltage = 0.0;
    float tds = 0.0;

    if (sampleCount > 0) {
      float adcAvg   = (float)adcSum / sampleCount;
      voltage  = adcAvg * (VREF / ADC_RESOLUTION);

      // Temperature compensation coefficient (1% per °C from 25°C)
      float tempCoeff     = 1.0 + 0.02 * (TEMP_CELSIUS - 25.0);
      float compVoltage   = voltage / tempCoeff;

      // DFRobot empirical formula (from SEN0244 wiki)
      // Replaced pow() with multiplication for better performance on Arduino
      float cv2 = compVoltage * compVoltage;
      float cv3 = cv2 * compVoltage;
      tds = (133.42 * cv3 - 255.86 * cv2 + 857.39 * compVoltage) * 0.5;

      // Clamp negatives (can appear near 0 V with clean water)
      if (tds < 0) tds = 0;

      // Reset accumulators
      adcSum = 0;
      sampleCount = 0;
    }

    // -- IR current state --
    const char* beamStatus = beamBroken ? "BROKEN  " : "INTACT  ";

    // -- Print row --
    Serial.print(now);
    Serial.print(F(" ms\t| Beam: "));
    Serial.print(beamStatus);
    Serial.print(F(" | Voltage: "));
    Serial.print(voltage, 3);
    Serial.print(F(" V | TDS: "));
    Serial.print(tds, 1);
    Serial.println(F(" ppm"));
  }
}
