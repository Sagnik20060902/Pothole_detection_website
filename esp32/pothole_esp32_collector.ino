/*
  =============================================================================
  ESP32 Pothole & Road Quality Detector - Live WiFi Telemetry Firmware
  =============================================================================
  Hardware Required:
   - ESP32 Development Board
   - MPU6050 Accelerometer / Gyroscope (I2C: SDA -> GPIO 21, SCL -> GPIO 22)
   - Neo-6M GPS Module (UART2: TX -> GPIO 16 (RX2), RX -> GPIO 17 (TX2))

  Required Arduino Libraries (Install via Arduino Library Manager):
   1. Adafruit MPU6050 & Adafruit Unified Sensor
   2. TinyGPSPlus (by Mikal Hart)
   3. ArduinoJson (or built-in HTTPClient)
  =============================================================================
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <TinyGPS++.h>

// ---------------------------------------------------------------------------
// 1. CONFIGURATION (UPDATE THESE VALUES)
// ---------------------------------------------------------------------------
// Your WiFi Router SSID or Mobile Hotspot Name
const char* WIFI_SSID     = "YOUR_WIFI_OR_MOBILE_HOTSPOT_NAME";

// Your WiFi Router / Hotspot Password
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Your Computer's Local IP Address running Django Backend
// Command to find IP: Windows -> Run 'ipconfig' (e.g., 192.168.1.15 or 172.20.10.2)
const char* API_ENDPOINT  = "http://192.168.1.15:8000/api/readings/";

// Pothole Impact Detection Threshold (in m/s^2)
// Standard gravity is ~9.8 m/s^2. A hit > 15.0 m/s^2 indicates a significant bump/pothole.
const float BUMP_THRESHOLD_MS2 = 15.0; 

// Minimum delay between uploaded points to avoid duplicate triggers (milliseconds)
const unsigned long COOLDOWN_MS = 2500;

// ---------------------------------------------------------------------------
// 2. GLOBALS & OBJECTS
// ---------------------------------------------------------------------------
Adafruit_MPU6050 mpu;
TinyGPSPlus gps;
HardwareSerial gpsSerial(2); // Use ESP32 UART2 (GPIO 16, GPIO 17)

unsigned long lastUploadTime = 0;

// ---------------------------------------------------------------------------
// 3. SETUP
// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n[ESP32] Initializing Pothole Detection System...");

  // Initialize GPS UART
  gpsSerial.begin(9600, SERIAL_8N1, 16, 17);
  Serial.println("[ESP32] GPS Serial Initialized on RX=16, TX=17.");

  // Initialize MPU6050 I2C
  Wire.begin(21, 22);
  if (!mpu.begin()) {
    Serial.println("[ERROR] MPU6050 not detected! Check wiring (SDA=21, SCL=22).");
    while (1) { delay(500); }
  }
  Serial.println("[ESP32] MPU6050 Accelerometer Online.");
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);

  // Connect to WiFi / Mobile Hotspot
  connectToWiFi();
}

// ---------------------------------------------------------------------------
// 4. MAIN LOOP
// ---------------------------------------------------------------------------
void loop() {
  // Feed GPS byte stream constantly
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // Read MPU6050 accelerometer frame
  sensors_event_t accel, gyro, temp;
  mpu.getEvent(&accel, &gyro, &temp);

  // Calculate 3-axis total magnitude acceleration vector
  float totalAccel = sqrt(accel.acceleration.x * accel.acceleration.x +
                          accel.acceleration.y * accel.acceleration.y +
                          accel.acceleration.z * accel.acceleration.z);

  // Check if shock threshold is breached
  if (totalAccel > BUMP_THRESHOLD_MS2) {
    unsigned long now = millis();
    if (now - lastUploadTime >= COOLDOWN_MS) {
      
      // Obtain GPS coordinates (or use fallback test coordinates if indoors without lock)
      double lat = gps.location.isValid() ? gps.location.lat() : 22.572645;
      double lng = gps.location.isValid() ? gps.location.lng() : 88.363892;
      
      // Calculate depth approximation (cm) relative to standard 9.8 m/s^2
      float depthCm = (totalAccel - 9.8) * 1.4;
      if (depthCm < 1.0) depthCm = 1.0;
      if (depthCm > 50.0) depthCm = 50.0;

      Serial.printf("[SPIKE DETECTED] Accel: %.2f m/s^2 | Lat: %.6f | Lng: %.6f | Depth: %.1f cm\n",
                    totalAccel, lat, lng, depthCm);

      // Upload reading to Django REST API over WiFi
      postReadingToBackend(lat, lng, depthCm);
      lastUploadTime = now;
    }
  }

  delay(10); // Small yield for ESP32 watchdog reset
}

// ---------------------------------------------------------------------------
// 5. HELPER FUNCTIONS
// ---------------------------------------------------------------------------
void connectToWiFi() {
  Serial.printf("[WIFI] Connecting to %s...", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    delay(500);
    Serial.print(".");
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Connected successfully!");
    Serial.print("[WIFI] ESP32 IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WARNING] WiFi Connection failed! ESP32 will retry during POST.");
  }
}

void postReadingToBackend(double lat, double lng, float depth) {
  // Ensure WiFi connection is alive
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[ERROR] Skipping POST: WiFi disconnected.");
      return;
    }
  }

  HTTPClient http;
  http.begin(API_ENDPOINT);
  http.addHeader("Content-Type", "application/json");

  // Construct JSON String
  String jsonBody = "{\"latitude\":" + String(lat, 6) + 
                    ",\"longitude\":" + String(lng, 6) + 
                    ",\"pothole_depth\":" + String(depth, 1) + "}";

  Serial.print("[HTTP] Sending POST request: ");
  Serial.println(jsonBody);

  int httpCode = http.POST(jsonBody);

  if (httpCode > 0) {
    Serial.printf("[HTTP] Success! Server Response Code: %d\n", httpCode);
    String response = http.getString();
    Serial.println("[HTTP] Server Response: " + response);
  } else {
    Serial.printf("[HTTP] Error sending POST: %s (Code: %d)\n", http.errorToString(httpCode).c_str(), httpCode);
  }

  http.end();
}
