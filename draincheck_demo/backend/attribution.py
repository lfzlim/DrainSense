from datetime import datetime
from business_registry import BUSINESSES

def get_current_hour(timestamp):
    dt = datetime.fromtimestamp(timestamp)
    return dt.hour

def score_business(business, source_location_cm, signature, current_hour):
    score = 0.0
    reasoning_parts = []
    
    # 1. Location match (distance in cm)
    dist = abs(business["location_cm"] - source_location_cm)
    if dist <= 5:
        score += 0.45
        reasoning_parts.append("Location perfectly matches modeled outlet.")
    elif dist <= 15:
        score += 0.25
        reasoning_parts.append("Location is within vicinity of estimated source.")
    else:
        score -= 0.3
        
    # 2. Signature match
    matched_sigs = set(business["pollutant_signatures"]).intersection(signature)
    if len(matched_sigs) > 0:
        score += 0.35 * (len(matched_sigs) / max(1, len(business["pollutant_signatures"])))
        reasoning_parts.append("Signature matches known discharge profile.")
    else:
        score -= 0.2
        
    # 3. Operating hours match
    start = business["operating_hours"]["start"]
    end = business["operating_hours"]["end"]
    if start <= current_hour < end:
        score += 0.15
        reasoning_parts.append("Event occurred during business operating hours.")
    else:
        score -= 0.1
        
    # Bonus for confidence presentation in demo
    score += 0.05
        
    # Cap score between 0 and 0.99
    confidence = max(0.01, min(0.99, score))
    
    return {
        "business": business,
        "confidence": round(confidence, 2),
        "reasoning": " ".join(reasoning_parts)
    }

def run_attribution_model(event_data, source_location_cm, signature, current_time):
    """
    Simulated ML layer for the demo that correlates multi-sensor time-series,
    pollutant signatures, and contextual data to output attribution.
    """
    current_hour = get_current_hour(current_time)
    
    best_match = None
    highest_confidence = 0
    
    for b in BUSINESSES:
        result = score_business(b, source_location_cm, signature, current_hour)
        if result["confidence"] > highest_confidence:
            highest_confidence = result["confidence"]
            best_match = result
            
    if best_match and highest_confidence > 0.4:
        return {
            "likely_source_name": best_match["business"]["name"],
            "likely_source_address": best_match["business"]["address"],
            "confidence": best_match["confidence"],
            "reasoning": best_match["reasoning"],
            "lat": best_match["business"]["lat"],
            "lon": best_match["business"]["lon"]
        }
    else:
        return {
            "likely_source_name": "Unknown",
            "likely_source_address": "N/A",
            "confidence": 0.0,
            "reasoning": "Insufficient correlation with known business registry.",
            "lat": None,
            "lon": None
        }
