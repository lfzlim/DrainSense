#include "network_client.h"

#include <HTTPClient.h>
#include <WiFi.h>

#include "config.h"

namespace Net {

    void connectWiFi() {
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

    bool postJson(const char* endpoint, const String& payload) {
        if (WiFi.status() != WL_CONNECTED)
            return false;

        HTTPClient http;
        String url = String(BACKEND_BASE_URL) + endpoint;
        http.begin(url);
        http.addHeader("Content-Type", "application/json");
        http.setTimeout(HTTP_TIMEOUT_MS);
        int code = http.POST(payload);
        http.end();
        return code > 0 && code < 400;
    }

}  // namespace Net
