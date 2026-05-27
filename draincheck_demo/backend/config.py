# configuration for DrainCheck Demo
SENSORS = {
    "S1": {"position_cm": 20, "lat": -33.8688, "lon": 151.2093},
    "S2": {"position_cm": 50, "lat": -33.8689, "lon": 151.2094},
    "S3": {"position_cm": 80, "lat": -33.8690, "lon": 151.2095},
    "S4": {"position_cm": 110, "lat": -33.8691, "lon": 151.2096},
}

BASELINE_WINDOW_SECONDS = 30
EVENT_THRESHOLD_TURBIDITY_DROP_V = 0.4   # turbidity voltage drop below baseline
EVENT_THRESHOLD_EC_RISE_US = 50          # µS/cm rise above baseline
EVENT_THRESHOLD_TDS_RISE_PPM = 30        # ppm rise above baseline
EVENT_THRESHOLD_LEVEL_RISE_MM = 5        # used for optional clog detection
CORRELATION_WINDOW_SECONDS = 10
RECOVERY_PERIOD_SECONDS = 30             # baseline frozen after event resolves
