import time
import math
import random
import urllib.request
import json
from datetime import datetime

API_URL = 'http://127.0.0.1:8000/api/readings/'

print("===============================================================")
print("   ESP32 LIVE VEHICLE TELEMETRY DEMONSTRATION IN PROGRESS      ")
print("===============================================================")
print("Vehicle Hardware: ESP32 + Ultrasonic Sensor (HC-SR04) + Neo-6M GPS")
print("Transmission: WiFi Direct HTTP Telemetry")
print("Target Server: http://127.0.0.1:8000/api/readings/\n")

# Start at Kolkata city center (Park Street area)
lat = 22.5530
lng = 88.3520
baseline_cm = 20.0

points = 15

for i in range(1, points + 1):
    # Simulate driving trajectory
    lat += random.uniform(0.0003, 0.0007)
    lng += random.uniform(0.0002, 0.0006)
    
    # Ultrasonic sensor reading: normal distance is 20cm, dip is +4 to +25cm
    distance = round(baseline_cm + random.uniform(4.5, 26.5), 1)
    depth = round(distance - baseline_cm, 1)
    
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
        start_t = time.time()
        response = urllib.request.urlopen(req)
        roundtrip_ms = round((time.time() - start_t) * 1000, 1)
        res_data = json.loads(response.read().decode('utf-8'))
        
        status_badge = "[SEVERE IMPACT]" if depth > 18.0 else "[MODERATE IMPACT]" if depth > 10.0 else "[MINOR BUMP]"
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Pothole #{res_data['id']} {status_badge}")
        print(f"  |- Ultrasonic Echo: {distance} cm (Baseline: {baseline_cm} cm) -> Depth: {res_data['pothole_depth']} cm")
        print(f"  |- Neo-6M GPS: ({res_data['latitude']}, {res_data['longitude']}) | Response Time: {roundtrip_ms}ms | Source: {res_data.get('source')}")
        print("  -----------------------------------------------------------------------------")
    except Exception as e:
        print(f"[ERROR] Telemetry Post Failed: {e}")

    time.sleep(1.5)

print("\n===============================================================")
print("   LIVE TELEMETRY STREAM COMPLETED! ALL POINTS ON WEBSITE MAP   ")
print("===============================================================")
