import time
import math
import random
import urllib.request
import json
from datetime import datetime

API_URL = 'http://127.0.0.1:8000/api/readings/'

print("==================================================")
print("  ESP32 WiFi Live Telemetry Simulator Started")
print("  Sensors: Ultrasonic (HC-SR04) + Neo-6M GPS")
print("  Mode: WiFi HTTP POST -> Django Backend API")
print("==================================================")

# Starting coordinate (Kolkata / City center)
lat = 22.5726
lng = 88.3639
baseline_cm = 20.0

for i in range(1, 11):
    # Simulate vehicle movement along road
    lat += random.uniform(0.0002, 0.0006)
    lng += random.uniform(-0.0003, 0.0005)
    
    # Ultrasonic sensor measurement:
    # Baseline ground clearance = 20 cm
    # Road dip / pothole increases distance to 25.0 - 45.0 cm
    measured_distance = round(baseline_cm + random.uniform(3.5, 24.0), 1)
    depth = round(measured_distance - baseline_cm, 1)

    payload = {
        "latitude": round(lat, 6),
        "longitude": round(lng, 6),
        "pothole_depth": depth,
        "source": "wifi",
        "sensor_timestamp": datetime.utcnow().isoformat() + "Z"
    }

    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )

    try:
        response = urllib.request.urlopen(req)
        res_data = json.loads(response.read().decode('utf-8'))
        print(f"[POINT #{i}] WiFi Telemetry -> Lat: {res_data['latitude']}, Lng: {res_data['longitude']} | Ultrasonic: {measured_distance}cm (Depth: {res_data['pothole_depth']} cm) | Source: {res_data.get('source')}")
    except Exception as e:
        print(f"[ERROR] Failed to post telemetry: {e}")

    time.sleep(2)

print("\nWiFi live telemetry test batch stream completed!")
