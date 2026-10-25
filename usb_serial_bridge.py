"""
=============================================================================
USB Serial Cable Bridge for ESP32 Pothole & Road Quality Detector
=============================================================================
This bridge connects your ESP32 device plugged via a USB cable directly to the
Django backend REST API (http://127.0.0.1:8000/api/readings/).

Features:
 - Automatic scanning and detection of ESP32 / CH340 / CP210x COM ports.
 - Continuous streaming & parsing of Ultrasonic + Neo-6M GPS data lines.
 - Automatic HTTP POST ingestion with source tagged as 'usb_serial'.
 - Built-in simulation mode (`--simulate`) for testing without hardware.

Usage:
  python usb_serial_bridge.py                  # Auto-connects to detected port
  python usb_serial_bridge.py --port COM3      # Connects to specific port
  python usb_serial_bridge.py --simulate       # Runs live USB stream simulation
=============================================================================
"""

import sys
import time
import json
import argparse
import urllib.request
import urllib.error
from datetime import datetime

try:
    import serial
    import serial.tools.list_ports
    HAS_PYSERIAL = True
except ImportError:
    HAS_PYSERIAL = False


DEFAULT_API_URL = "http://127.0.0.1:8000/api/readings/"
DEFAULT_BAUD = 115200


def list_com_ports():
    if not HAS_PYSERIAL:
        print("[WARN] pyserial is not installed. Run: pip install pyserial")
        return []
    ports = list(serial.tools.list_ports.comports())
    return ports


def post_reading_to_api(api_url, payload):
    data_bytes = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        api_url,
        data=data_bytes,
        headers={'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            status_code = resp.getcode()
            response_body = resp.read().decode('utf-8')
            return status_code, json.loads(response_body)
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8')
        return e.code, {"error": err_msg}
    except Exception as e:
        return 0, {"error": str(e)}


def run_simulation(api_url):
    import random
    print("\n=======================================================")
    print("   USB CABLE SIMULATION MODE (VIRTUAL ESP32)")
    print(f"   Target Server: {api_url}")
    print("   Sensors: Ultrasonic (HC-SR04) + Neo-6M GPS")
    print("   Press Ctrl+C to stop simulation.")
    print("=======================================================\n")

    lat = 22.5726
    lng = 88.3639
    baseline_cm = 20.0
    count = 0

    try:
        while True:
            count += 1
            # Simulate driving
            lat += random.uniform(0.0002, 0.0006)
            lng += random.uniform(-0.0003, 0.0005)
            # Simulated ultrasonic reading: normal is ~20cm, pothole is 24-42cm
            measured_dist = round(baseline_cm + random.uniform(4.0, 22.0), 1)
            pothole_depth = round(measured_dist - baseline_cm, 1)

            payload = {
                "latitude": round(lat, 6),
                "longitude": round(lng, 6),
                "pothole_depth": pothole_depth,
                "source": "usb_serial",
                "sensor_timestamp": datetime.utcnow().isoformat() + "Z"
            }

            # Emulate raw serial log line
            print(f"[USB SERIAL IN] {json.dumps(payload)}")
            print(f"  |- [ULTRASONIC] Echo: {measured_dist}cm | Baseline: {baseline_cm}cm -> Depth: {pothole_depth}cm")
            print(f"  |- [NEO-6M GPS] Lat: {payload['latitude']}, Lng: {payload['longitude']}")

            code, res = post_reading_to_api(api_url, payload)
            if code == 201:
                print(f"  |- [API SYNC] HTTP 201 Created -> Stored Pothole ID #{res.get('id', 'N/A')}\n")
            else:
                print(f"  |- [API ERROR] HTTP {code}: {res}\n")

            time.sleep(2.5)
    except KeyboardInterrupt:
        print("\n[USB] Simulation stopped.")


def run_serial_bridge(port_name, baud_rate, api_url):
    if not HAS_PYSERIAL:
        print("[ERROR] pyserial is required to run the hardware bridge. Run: pip install pyserial")
        sys.exit(1)

    print("\n=======================================================")
    print("   USB SERIAL CABLE BRIDGE ACTIVE")
    print(f"   Port: {port_name} @ {baud_rate} Baud")
    print(f"   Destination API: {api_url}")
    print("   Press Ctrl+C to disconnect.")
    print("=======================================================\n")

    try:
        ser = serial.Serial(port_name, baud_rate, timeout=1.0)
    except Exception as e:
        print(f"[ERROR] Could not open serial port '{port_name}': {e}")
        print("Tip: Check device cable connection or close Arduino Serial Monitor.")
        return

    time.sleep(2.0)  # Wait for ESP32 auto-reset
    print(f"[READY] Connected to {port_name}. Listening for incoming telemetry packets...\n")

    try:
        while True:
            if ser.in_waiting > 0:
                raw_line = ser.readline().decode('utf-8', errors='ignore').strip()
                if not raw_line:
                    continue

                timestamp = datetime.now().strftime("%H:%M:%S")
                print(f"[{timestamp}] [USB] {raw_line}")

                # Check if this line is a JSON telemetry packet
                if raw_line.startswith('{') and raw_line.endswith('}'):
                    try:
                        data = json.loads(raw_line)
                        if 'latitude' in data and 'longitude' in data and ('pothole_depth' in data or 'particle_depth' in data):
                            if 'source' not in data:
                                data['source'] = 'usb_serial'
                            code, res = post_reading_to_api(api_url, data)
                            if code == 201:
                                print(f"  ==> [POST SUCCESS] Pothole #{res.get('id')} synced to website! Lat: {data['latitude']}, Lng: {data['longitude']}, Depth: {data.get('pothole_depth')} cm")
                            else:
                                print(f"  ==> [POST FAILED] Code {code}: {res}")
                    except json.JSONDecodeError:
                        pass
            time.sleep(0.02)
    except KeyboardInterrupt:
        print("\n[USB] Disconnecting serial port...")
    finally:
        ser.close()
        print("[USB] Serial port closed.")


def main():
    parser = argparse.ArgumentParser(description="ESP32 USB Cable Telemetry Bridge to Django Website")
    parser.add_argument('--port', type=str, default=None, help="COM port (e.g. COM3 or /dev/ttyUSB0)")
    parser.add_argument('--baud', type=int, default=DEFAULT_BAUD, help=f"Baud rate (default: {DEFAULT_BAUD})")
    parser.add_argument('--url', type=str, default=DEFAULT_API_URL, help=f"API Endpoint (default: {DEFAULT_API_URL})")
    parser.add_argument('--simulate', action='store_true', help="Run synthetic virtual ESP32 telemetry generator")
    parser.add_argument('--list-ports', action='store_true', help="List all detected COM ports and exit")

    args = parser.parse_args()

    if args.list_ports:
        ports = list_com_ports()
        print("\nDetected COM / Serial Ports:")
        if not ports:
            print("  No active COM ports detected. Please plug in your ESP32 via USB cable.")
        for p in ports:
            print(f"  - {p.device}: {p.description} [{p.hwid}]")
        print("")
        return

    if args.simulate:
        run_simulation(args.url)
        return

    port = args.port
    if not port:
        ports = list_com_ports()
        if not ports:
            print("[INFO] No active USB Serial COM ports detected.")
            print("[INFO] Running in simulation mode instead. To test with real ESP32, connect the USB cable and specify --port COMx.")
            run_simulation(args.url)
            return

        print("\nAvailable COM ports:")
        for idx, p in enumerate(ports):
            print(f"  [{idx + 1}] {p.device} - {p.description}")

        # Auto-pick ESP32 / USB UART if detected, else choose first
        selected = ports[0].device
        for p in ports:
            desc = p.description.lower()
            if any(k in desc for k in ['cp210', 'ch340', 'usb serial', 'uart', 'ftdi', 'esp']):
                selected = p.device
                break
        print(f"Auto-selected device port: {selected}")
        port = selected

    run_serial_bridge(port, args.baud, args.url)


if __name__ == '__main__':
    main()

