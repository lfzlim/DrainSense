import statistics

def map_sharpness_to_distance(sharpness_tds_per_s: float):
    # Simulating the milk dilution demo
    if sharpness_tds_per_s > 80.0:
        return 10, "USYD Chemicals"
    if sharpness_tds_per_s > 40.0:
        return 25, "UNSW Manufacturing"
    return 50, "UTS Industries"

def compute_rise_sharpness(sensor_id: str, trigger_time: float, history: list) -> float:
    """
    Computes rise sharpness for the first-triggered sensor.
    history is a list of readings dicts.
    Look at the tds_ppm readings in the 2 seconds before the IR beam trip and the 2 seconds after.
    """
    before_window = [r for r in history if trigger_time - 2 <= r["t"] <= trigger_time]
    after_window = [r for r in history if trigger_time <= r["t"] <= trigger_time + 2]
    
    if not before_window or not after_window:
        return 0.0
        
    mean_tds_before = statistics.mean([r["tds_ppm"] for r in before_window])
    
    max_tds_after = max([r["tds_ppm"] for r in after_window])
    time_of_max = next(r["t"] for r in after_window if r["tds_ppm"] == max_tds_after)
    time_to_max = time_of_max - trigger_time
    if time_to_max <= 0:
        time_to_max = 0.1 # avoid division by zero
        
    delta_tds_per_second = max(0, max_tds_after - mean_tds_before) / time_to_max
    return delta_tds_per_second

def localize_source(event_data: dict, sensors_config: dict, sensor_history: dict) -> dict:
    triggered_sensors = list(event_data["beam_trigger_times"].keys())
    if len(triggered_sensors) < 1:
        return {}
        
    if len(triggered_sensors) == 1:
        s_first = triggered_sensors[0]
        pos = sensors_config[s_first]["position_cm"]
        source_location_cm = pos - 10
        return {
            "source_location_cm": source_location_cm,
            "source_description": f"upstream of {s_first}, location uncertain",
            "confidence": "35%",
            "flow_velocity_cm_s": 0.0
        }

    # Sort triggers by time ascending
    sorted_triggers = sorted(event_data["beam_trigger_times"].items(), key=lambda item: item[1])
    s_first, t_first = sorted_triggers[0]
    
    velocities = []
    for i in range(len(sorted_triggers) - 1):
        s_a, t_a = sorted_triggers[i]
        s_b, t_b = sorted_triggers[i+1]
        dx = sensors_config[s_b]["position_cm"] - sensors_config[s_a]["position_cm"]
        dt = t_b - t_a
        if dt > 0.05:
            velocities.append(dx / dt)
            
    v = statistics.median(velocities) if velocities else 0.0
    
    # Validate velocity is plausible
    velocity_consistent = False
    if 5 <= v <= 30:
        if len(velocities) > 1:
            if (statistics.stdev(velocities) / v) < 0.3:
                velocity_consistent = True
        else:
            velocity_consistent = True

    # Compute sharpness
    history = sensor_history.get(s_first, [])
    rise_sharpness = compute_rise_sharpness(s_first, t_first, history)
    X_cm, factory_name = map_sharpness_to_distance(rise_sharpness)
    X_cm = max(2, min(X_cm, sensors_config[s_first]["position_cm"]))
    
    source_location_cm = sensors_config[s_first]["position_cm"] - X_cm
    source_description = f"{factory_name} (approximately {X_cm}cm upstream of {s_first})"
    
    confidence = "92%" if (velocity_consistent and len(event_data.get("pollutant_signature", [])) >= 2) else "65%"
    
    return {
        "source_location_cm": source_location_cm,
        "source_description": source_description,
        "confidence": confidence,
        "flow_velocity_cm_s": round(v, 1)
    }
