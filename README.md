# Geotagged Pothole Detection & Road Surface Quality Dashboard

An end-to-end IoT and Geospatial telemetry platform for detecting, classifying, and mapping road potholes and surface anomalies using an **ESP32**, **Ultrasonic Distance Sensor (HC-SR04 / JSN-SR04T)**, and **Neo-6M GPS Module**.

---

## 🛠️ Hardware Setup

| Component | Pin / Interface | ESP32 Pin | Description |
| :--- | :--- | :--- | :--- |
| **HC-SR04 Ultrasonic Sensor** | VCC | `VIN` (5V) | Power |
| | GND | `GND` | Ground |
| | TRIG | `GPIO 5` | Ultrasonic trigger pulse output |
| | ECHO | `GPIO 18` | Echo pulse return input |
| **Neo-6M GPS Module** | VCC | `3.3V` or `5V` | Power |
| | GND | `GND` | Ground |
| | TX | `GPIO 16` (RX2) | HardwareSerial UART2 Receive |
| | RX | `GPIO 17` (TX2) | HardwareSerial UART2 Transmit |

### Ultrasonic Pothole Detection Principle
1. The ultrasonic sensor is mounted under the vehicle facing downward toward the road at a fixed ground clearance baseline (default: `20.0 cm`).
2. On normal flat pavement, measured echo distance $\approx 20\text{ cm}$.
3. When driving over a pothole or depression, the measured distance suddenly spikes (e.g. $32.5\text{ cm}$).
4. Pothole depth is calculated as:
   $$\text{Pothole Depth} = \text{Measured Distance} - \text{Baseline Clearance} = 32.5 - 20.0 = 12.5\text{ cm}$$
5. If $\text{Pothole Depth} \ge 3.5\text{ cm}$, a detection event is triggered, tagged with live GPS coordinates, and transmitted via your chosen channel.

---

## 📡 Three Data Ingestion & Connection Options

This project provides three distinct channels for streaming or uploading pothole data:

### 1. Option 1: Manual Data Upload
- **Single Pothole Form**: Enter Latitude, Longitude, and Pothole Depth.
  - **Browser Geolocation**: Click *"Use My Device's Current GPS Location"* to auto-fill your exact coordinates.
  - **Ultrasonic Depth Assistant**: Toggle the built-in calculator to enter road baseline clearance and measured distance to auto-compute depth.
- **Batch Dump & File Upload**:
  - Drag-and-drop or select `.csv`, `.json`, or `.txt` logs.
  - Paste raw serial lines or CSV numbers.
  - 1-click *"Generate Sample Data"* button.

### 2. Option 2: WiFi Connection (ESP32 $\leftrightarrow$ Website)
- **Direct HTTP Telemetry**: ESP32 connects to your local WiFi router or mobile hotspot.
- When an ultrasonic pothole trigger occurs, it issues an HTTP POST request with JSON payload directly to the Django REST endpoint:
  ```json
  {
    "latitude": 22.572645,
    "longitude": 88.363892,
    "pothole_depth": 12.5,
    "source": "wifi",
    "sensor_timestamp": "2026-10-25T13:20:00Z"
  }
  ```
- **Live In-Browser Simulator**: Click *"Start WiFi Stream"* inside the website to test live telemetry streaming without hardware plugged in.
- **Python WiFi Streamer**: Run `python simulate_esp32.py` or `python live_route_demo.py`.

### 3. Option 3: USB Cable Connection (ESP32 $\leftrightarrow$ PC)
- **Direct Web Serial (Browser Native USB Connection)**:
  - Plug your ESP32 into your computer via a standard micro-USB / USB-C cable.
  - Click **"Connect USB Cable"** in Google Chrome or Microsoft Edge.
  - The browser requests port access (`navigator.serial.requestPort()`) and opens the COM port at `115200` baud.
  - Live **USB Serial Monitor Console** displays real-time incoming sensor streams.
  - Incoming pothole JSON lines are **automatically ingested** into the database with `source: "usb_serial"`!
- **Python USB Serial Bridge (`usb_serial_bridge.py`)**:
  - For headless machines, Firefox, or CLI environments:
    ```bash
    python usb_serial_bridge.py --port COM3
    # or auto-detect port:
    python usb_serial_bridge.py
    ```

---

## 🚀 Getting Started

### 1. Backend (Django REST Framework)
```bash
cd backend
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py seed_readings --count 25   # Optional: seed sample data
python manage.py runserver 0.0.0.0:8000
```
API Endpoint: `http://127.0.0.1:8000/api/readings/`

### 2. Frontend (React + Vite + Leaflet)
```bash
cd frontend
npm install
npm run dev
```
Website UI will open on `http://localhost:5173`.

### 3. ESP32 Firmware
1. Open `esp32/pothole_esp32_collector.ino` in the Arduino IDE.
2. Install `TinyGPSPlus` from the Arduino Library Manager.
3. Configure your WiFi credentials:
   ```cpp
   const char* WIFI_SSID     = "YOUR_WIFI_NAME";
   const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
   const char* API_ENDPOINT  = "http://<YOUR_COMPUTER_LAN_IP>:8000/api/readings/";
   ```
4. Flash the code to your ESP32 board.
5. Plug the ESP32 into your vehicle or computer to start capturing road anomalies!

