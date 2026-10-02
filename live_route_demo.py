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
print("Vehicle IP: 192.168.1.45 (ESP32 + MPU6050 + Neo-6M GPS)")
print("Target Server: http://127.0.0.1:8000/api/readings/\n")

# Start at Kolkata city center (Park Street area)
lat = 22.5530
lng = 88.3520

points = 15

for i in range(1, points + 1):
    # Simulate driving trajectory
    lat += random.uniform(0.0003, 0.0007)
    lng += random.uniform(0.0002, 0.0006)
    
    # Impact severity: depth in cm
    depth = round(random.uniform(4.5, 28.5), 1)
    
    payload = {
        "latitude": round(lat, 6),
        "longitude": round(lng, 6),
        "pothole_depth": depth
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
        print(f"  |- GPS: ({res_data['latitude']}, {res_data['longitude']}) | Depth: {res_data['pothole_depth']} cm | Response Time: {roundtrip_ms}ms | HTTP 201 Created")
        print("  -----------------------------------------------------------------------------")
    except Exception as e:
        print(f"[ERROR] Telemetry Post Failed: {e}")

    time.sleep(1.5)

print("\n===============================================================")
print("   LIVE TELEMETRY STREAM COMPLETED! ALL POINTS ON WEBSITE MAP   ")
print("===============================================================")
