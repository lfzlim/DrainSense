# configuration for DrainCheck Demo
SENSORS = {
    "S1": {"position_cm": 20, "lat": -33.9130, "lon": 151.2280},
    "S2": {"position_cm": 50, "lat": -33.9145, "lon": 151.2270},
    "S3": {"position_cm": 80, "lat": -33.9160, "lon": 151.2260},
    "S4": {"position_cm": 110, "lat": -33.9173, "lon": 151.2253},
}

BASELINE_WINDOW_SECONDS = 30
EVENT_THRESHOLD_TURBIDITY_DROP_V = 0.4   # turbidity voltage drop below baseline
EVENT_THRESHOLD_EC_RISE_US = 50          # µS/cm rise above baseline
EVENT_THRESHOLD_TDS_RISE_PPM = 30        # ppm rise above baseline
EVENT_THRESHOLD_LEVEL_RISE_MM = 5        # used for optional clog detection
CORRELATION_WINDOW_SECONDS = 20
RECOVERY_PERIOD_SECONDS = 30             # baseline frozen after event resolves
