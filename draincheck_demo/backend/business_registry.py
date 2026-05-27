# Mock database of businesses along the catchment channel
BUSINESSES = [
    {
        "id": "B001",
        "name": "Metal Plating Corp",
        "address": "Lot 14, Industrial Drive",
        "location_cm": 15, # 15cm from start, upstream of S1 (which is at 20cm)
        "lat": -33.86875,
        "lon": 151.20925,
        "operating_hours": {"start": 8, "end": 18}, # 8 AM to 6 PM
        "pollutant_signatures": ["high_turbidity", "elevated_conductivity", "elevated_tds"]
    },
    {
        "id": "B002",
        "name": "Fresh Dairy Processing",
        "address": "22 Milkway Blvd",
        "location_cm": 5, # 5cm from start
        "lat": -33.86860,
        "lon": 151.20910,
        "operating_hours": {"start": 4, "end": 14}, # 4 AM to 2 PM
        "pollutant_signatures": ["high_turbidity", "elevated_tds"]
    },
    {
        "id": "B003",
        "name": "Acme Construction Site",
        "address": "Block 9, River Road",
        "location_cm": 35, # Between S1 and S2
        "lat": -33.86885,
        "lon": 151.20935,
        "operating_hours": {"start": 6, "end": 16},
        "pollutant_signatures": ["high_turbidity"] # Sediment run-off
    }
]
