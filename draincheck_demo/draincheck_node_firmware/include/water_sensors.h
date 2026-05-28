#pragma once

#include <Arduino.h>

namespace WaterSensors {

    struct Reading {
        float water_level_mm;
        int tds_raw;
        float tds_ppm;
    };

    void begin();

    Reading sample();

}  // namespace WaterSensors
