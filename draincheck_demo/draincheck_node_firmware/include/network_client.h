#pragma once

#include <Arduino.h>

namespace Net {

    void connectWiFi();

    bool postJson(const char* endpoint, const String& payload);

}  // namespace Net
