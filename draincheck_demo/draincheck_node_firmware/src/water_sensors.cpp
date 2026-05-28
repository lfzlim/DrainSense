#include "water_sensors.h"

#include "config.h"

namespace {

    int readMedian(int pin, int samples = 10) {
        int vals[16];
        if (samples > 16)
            samples = 16;
        for (int i = 0; i < samples; i++) {
            vals[i] = analogRead(pin);
            delay(2);
        }
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

    float adcToVoltage(int raw) {
        return raw * (ADC_REF_VOLTAGE / ADC_RESOLUTION);
    }

    float measureDistanceMm() {
        digitalWrite(PIN_TRIG, LOW);
        delayMicroseconds(2);
        digitalWrite(PIN_TRIG, HIGH);
        delayMicroseconds(10);
        digitalWrite(PIN_TRIG, LOW);

        long duration = pulseIn(PIN_ECHO, HIGH, ULTRASONIC_TIMEOUT_US);
        if (duration == 0)
            return 0.0f;
        // speed of sound ~ 0.343 mm/us; round-trip → divide by 2
        return (duration * 0.343f) / 2.0f;
    }

}  // namespace

namespace WaterSensors {

    void begin() {
        pinMode(PIN_TRIG, OUTPUT);
        pinMode(PIN_ECHO, INPUT);
    }

    Reading sample() {
        Reading r{};
        r.water_level_mm = measureDistanceMm();

        r.tds_raw = readMedian(PIN_TDS);
        float tds_v = adcToVoltage(r.tds_raw);
        // DFRobot TDS standard formula at ~25C, halved per original sketch
        r.tds_ppm =
            (133.42f * tds_v * tds_v * tds_v - 255.86f * tds_v * tds_v + 857.39f * tds_v) * 0.5f;
        return r;
    }

}  // namespace WaterSensors
