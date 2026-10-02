import time
import math
import random
import urllib.request
import json

API_URL = 'http://127.0.0.1:8000/api/readings/'

print("==================================================")
print("  ESP32 Live Telemetry Simulator Started")
print("  Streaming geotagged pothole data to website...")
print("==================================================")

# Starting coordinate (Kolkata / City center)
lat = 22.5726
lng = 88.3639

for i in range(1, 11):
    # Simulate movement along route
    lat += random.uniform(0.0002, 0.0006)
    lng += random.uniform(-0.0003, 0.0005)
    depth = round(random.uniform(5.0, 25.0), 1)

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
        response = urllib.request.urlopen(req)
        res_data = json.loads(response.read().decode('utf-8'))
        print(f"[POINT #{i}] Live Telemetry Posted -> Lat: {res_data['latitude']}, Lng: {res_data['longitude']}, Depth: {res_data['pothole_depth']} cm")
    except Exception as e:
        print(f"[ERROR] Failed to post telemetry: {e}")

    time.sleep(2)

print("\nLive telemetry test batch stream completed!")
