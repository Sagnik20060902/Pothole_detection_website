/*
  =============================================================================
  ESP32 Automatic Pothole Detection System (with calibration & Website Integration)
  MPU6500 + HC-SR04 + NEO-6M GPS + LED + Buzzer + Dual Wi-Fi & USB Telemetry
  =============================================================================

  Hardware Wiring:
    - MPU6500 Accelerometer: SDA -> GPIO 21, SCL -> GPIO 22
    - HC-SR04 Ultrasonic: TRIG -> GPIO 5, ECHO -> GPIO 18 (use a voltage divider 1k/2k for 3.3V safety!)
    - NEO-6M GPS Module: TX -> ESP32 GPIO 16 (GPS RX), RX -> ESP32 GPIO 17 (GPS TX)
    - LED: GPIO 2 (through current limiting resistor)
    - Buzzer: GPIO 4 (use transistor driver if required)

  Three Data Ingestion Options Supported by this Firmware:
    1. OPTION 1: Manual Upload -> Input coordinates or paste CSV/JSON in website.
    2. OPTION 2: WiFi Connection -> ESP32 directly HTTP POSTs JSON readings to the
                  Django Backend API (http://<YOUR_PC_IP>:8000/api/readings/).
    3. OPTION 3: USB Cable Connection -> ESP32 streams structured JSON telemetry
                  over Serial (115200 baud) directly into the browser's Web Serial API
                  or via python usb_serial_bridge.py.

  Calibration Features:
    1. STARTUP (vehicle must be still): averages ~100 accelerometer samples to find
       the real resting magnitude (replaces assumed 1.000 g), and ~30 ultrasonic
       samples (outliers rejected via median) to find the baseline distance.
       Blinks LED during calibration. 1 beep = success, 3 beeps = issue.
    2. WHILE DRIVING: rolling mean / standard deviation of normal readings gives
       adaptive thresholds: threshold = clamp(mean + SIGMA * stdDev, MIN, MAX).
    3. RE-CALIBRATE anytime from the on-board web page (/recalibrate) or button.

  Before uploading:
    1. Set WIFI_SSID and WIFI_PASSWORD below.
    2. Set API_ENDPOINT to your PC's LAN IP address running the Django backend.
    3. Flash to ESP32 at 115200 baud.
  =============================================================================
*/

#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <HardwareSerial.h>
#include <TinyGPSPlus.h>
#include <math.h>

// -------------------- 1. Wi-Fi & Website Backend Config --------------------
const char* WIFI_SSID = "Home";
const char* WIFI_PASSWORD = "Bhatter@123";

// Set this to your computer's local IP address running the Django website backend (port 8000)
// Run 'ipconfig' (Windows) or 'ifconfig' (Mac/Linux) to find your local IP (e.g. 192.168.1.15)
const char* API_ENDPOINT = "http://192.168.1.15:8000/api/readings/";

WebServer server(80);

// -------------------- 2. MPU6500 --------------------
const uint8_t MPU_ADDR = 0x68;
const int SDA_PIN = 21;
const int SCL_PIN = 22;

// -------------------- 3. HC-SR04 Ultrasonic --------------------
const int TRIG_PIN = 5;
const int ECHO_PIN = 18;

// -------------------- 4. NEO-6M GPS --------------------
const int GPS_RX = 16;
const int GPS_TX = 17;
HardwareSerial GPS(2);
TinyGPSPlus gps;

// -------------------- 5. LED and buzzer --------------------
const int LED_PIN = 2;
const int BUZZER_PIN = 4;

// -------------------- 6. Detection timing --------------------
// The acceleration and distance threshold crossings must be close in time.
const unsigned long MATCH_WINDOW_MS = 700;
// Ignore repeat detections for this long after an event.
const unsigned long COOLDOWN_MS = 5000;
// Keep the alarm on briefly without blocking sensor reading/web server.
const unsigned long ALARM_DURATION_MS = 500;
// Show detected status for this long, then return webpage to normal.
const unsigned long STATUS_DURATION_MS = 3000;
const unsigned long ULTRASONIC_INTERVAL_MS = 100;
const unsigned long WIFI_RETRY_INTERVAL_MS = 10000;
// After calibration, wait this long before allowing detections.
const unsigned long SETTLE_AFTER_CAL_MS = 1000;

// -------------------- 7. Threshold limits (adaptive thresholds are clamped to these) --------------------
// Acceleration deviation from the resting magnitude, in g.
const float ACCEL_MIN_G = 0.20f;   // floor: stops the threshold collapsing on smooth roads
const float ACCEL_MAX_G = 0.80f;   // ceiling: stops it rising so high that real potholes are missed
// Absolute difference from the tracked distance baseline, in cm.
const float DIST_MIN_CM = 5.0f;
const float DIST_MAX_CM = 20.0f;
// How many standard deviations above the normal level counts as an event. TUNE with real drive tests.
const float ACCEL_SIGMA = 4.0f;
const float DIST_SIGMA = 4.0f;
// Rolling-statistics speed (per sample). ~0.01 at ~15 Hz is a window of roughly 5 to 8 s.
const float ACCEL_STATS_ALPHA = 0.01f;
const float DIST_STATS_ALPHA = 0.02f;   // ultrasonic samples arrive at ~10 Hz

// -------------------- 8. Calibration settings --------------------
const int CAL_ACCEL_SAMPLES = 100;
const int CAL_DIST_SAMPLES = 30;
const int CAL_DIST_MIN_VALID = 15;
const int CAL_MAX_ATTEMPTS = 3;
const float CAL_MAX_ACCEL_STD_G = 0.05f;   // more vibration than this = vehicle not still
const float CAL_MAX_DIST_STD_CM = 2.0f;    // more spread than this = unstable surface/echo
const float CAL_OUTLIER_CM = 3.0f;         // readings further than this from the median are dropped

// -------------------- 9. Current (adaptive) thresholds --------------------
// Defaults match the original fixed values (mean + 4*sigma): used until/unless calibration succeeds.
float accelThreshold = 0.35f;
float distThreshold = 8.0f;

// Rolling statistics of the "normal" deviation values.
float accelDevMean = 0.07f;
float accelDevVar = 0.0049f;   // sigma = 0.07 -> 0.07 + 4*0.07 = 0.35 g
float distDevMean = 3.2f;
float distDevVar = 1.44f;      // sigma = 1.2  -> 3.2 + 4*1.2 = 8.0 cm

// Calibration results.
float restMagnitude = 1.0f;    // measured resting magnitude of the accelerometer, in g
bool calibrating = false;
bool recalibrateRequested = false;
unsigned long calibratedAt = 0;
String calibrationStatus = "Not calibrated (using default thresholds)";

// -------------------- 10. Sensor readings --------------------
float ax = 0, ay = 0, az = 0;
float totalAcceleration = 0;
float accelerationDeviation = 0;

float currentDistance = -1;
float baselineDistance = -1;
float distanceChange = 0;

unsigned long lastUltrasonicRead = 0;
unsigned long lastPotholeTime = 0;
unsigned long lastAccelCrossing = 0;
unsigned long lastDistanceCrossing = 0;
unsigned long lastWifiRetry = 0;
unsigned long alarmStartedAt = 0;
unsigned long statusStartedAt = 0;

bool previousAccelerationEvent = false;
bool previousDistanceEvent = false;
bool potholeDetected = false;
bool alarmActive = false;

String lastEvent = "No pothole detected";

// -------------------- MPU6500 helpers --------------------
bool writeMPURegister(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  Wire.write(value);
  return Wire.endTransmission() == 0;
}

void initMPU() {
  Wire.begin(SDA_PIN, SCL_PIN);
  delay(50);

  // Wake the MPU6500 (PWR_MGMT_1 register).
  if (!writeMPURegister(0x6B, 0x00)) {
    Serial.println("[ERROR] Could not communicate with MPU6500.");
    return;
  }

  // Accelerometer range: +/- 2 g (register 0x1C = 0x00).
  writeMPURegister(0x1C, 0x00);
  delay(100);
  Serial.println("[MPU] Initialized; accelerometer range +/-2 g.");
}

bool readMPU(float &x, float &y, float &z) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B); // ACCEL_XOUT_H
  if (Wire.endTransmission(false) != 0) return false;

  uint8_t count = Wire.requestFrom((uint8_t)MPU_ADDR, (uint8_t)6);
  if (count < 6) return false;

  int16_t rawX = (int16_t)((Wire.read() << 8) | Wire.read());
  int16_t rawY = (int16_t)((Wire.read() << 8) | Wire.read());
  int16_t rawZ = (int16_t)((Wire.read() << 8) | Wire.read());

  // +/-2 g range: 16384 LSB per g.
  x = rawX / 16384.0f;
  y = rawY / 16384.0f;
  z = rawZ / 16384.0f;
  return true;
}

// -------------------- HC-SR04 helpers --------------------
float readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  unsigned long duration = pulseIn(ECHO_PIN, HIGH, 30000UL);
  if (duration == 0) return -1;

  float distance = duration * 0.0343f / 2.0f;
  if (distance < 2.0f || distance > 400.0f) return -1;
  return distance;
}

// -------------------- Adaptive threshold helpers --------------------
// Updates an exponentially weighted mean/variance with one "normal" sample.
void updateRollingStats(float x, float alpha, float &mean, float &var) {
  float sigma = sqrtf(var);
  if (sigma < 0.01f) sigma = 0.01f;
  float limit = mean + 3.0f * sigma;
  if (x > limit) x = limit;

  float diff = x - mean;
  mean += alpha * diff;
  var = (1.0f - alpha) * (var + alpha * diff * diff);
}

float computeThreshold(float mean, float var, float sigmas, float lo, float hi) {
  float t = mean + sigmas * sqrtf(var);
  if (t < lo) t = lo;
  if (t > hi) t = hi;
  return t;
}

// -------------------- Calibration --------------------
void blinkLED(int i, int step) {
  digitalWrite(LED_PIN, (i / step) % 2);
}

void beep(int times, int onMs, int offMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    digitalWrite(LED_PIN, HIGH);
    delay(onMs);
    digitalWrite(BUZZER_PIN, LOW);
    digitalWrite(LED_PIN, LOW);
    delay(offMs);
  }
}

// Measures the resting magnitude and the noise of the accelerometer.
bool calibrateAccelerometer() {
  float mags[CAL_ACCEL_SAMPLES];
  int n = 0;

  for (int i = 0; i < CAL_ACCEL_SAMPLES * 2 && n < CAL_ACCEL_SAMPLES; i++) {
    float x, y, z;
    if (readMPU(x, y, z)) {
      mags[n++] = sqrtf(x * x + y * y + z * z);
    }
    blinkLED(i, 5);
    delay(10);
  }

  if (n < CAL_ACCEL_SAMPLES / 2) {
    Serial.println("[CAL] Accelerometer: not enough valid readings.");
    return false;
  }

  float sum = 0;
  for (int i = 0; i < n; i++) sum += mags[i];
  float mean = sum / n;

  float varSum = 0;
  for (int i = 0; i < n; i++) varSum += (mags[i] - mean) * (mags[i] - mean);
  float stdDev = sqrtf(varSum / n);

  if (mean < 0.8f || mean > 1.2f) {
    Serial.printf("[CAL] Accelerometer: resting magnitude %.3f g is implausible.\n", mean);
    return false;
  }
  if (stdDev > CAL_MAX_ACCEL_STD_G) {
    Serial.printf("[CAL] Accelerometer: too much movement (std %.3f g). Keep the vehicle still.\n", stdDev);
    return false;
  }

  // Statistics of |magnitude - mean|, which is exactly what the detector uses.
  float devSum = 0;
  for (int i = 0; i < n; i++) devSum += fabsf(mags[i] - mean);
  float devMean = devSum / n;

  float devVarSum = 0;
  for (int i = 0; i < n; i++) {
    float d = fabsf(mags[i] - mean) - devMean;
    devVarSum += d * d;
  }

  restMagnitude = mean;
  accelDevMean = devMean;
  accelDevVar = devVarSum / n;

  Serial.printf("[CAL] Accelerometer OK: rest magnitude %.4f g, noise std %.4f g\n", mean, stdDev);
  return true;
}

// Finds the baseline distance from many samples, rejecting outliers.
bool calibrateDistance() {
  float vals[CAL_DIST_SAMPLES];
  int n = 0;

  for (int tries = 0; tries < CAL_DIST_SAMPLES * 3 && n < CAL_DIST_SAMPLES; tries++) {
    float d = readDistanceCm();
    if (d > 0) vals[n++] = d;
    blinkLED(tries, 2);
    delay(60);
  }

  if (n < CAL_DIST_MIN_VALID) {
    Serial.println("[CAL] Distance: not enough valid ultrasonic readings.");
    return false;
  }

  // Median (insertion sort on a copy).
  float sorted[CAL_DIST_SAMPLES];
  for (int i = 0; i < n; i++) sorted[i] = vals[i];
  for (int i = 1; i < n; i++) {
    float key = sorted[i];
    int j = i - 1;
    while (j >= 0 && sorted[j] > key) {
      sorted[j + 1] = sorted[j];
      j--;
    }
    sorted[j + 1] = key;
  }
  float median = sorted[n / 2];

  // Keep only readings close to the median.
  float kept[CAL_DIST_SAMPLES];
  int k = 0;
  for (int i = 0; i < n; i++) {
    if (fabsf(vals[i] - median) <= CAL_OUTLIER_CM) kept[k++] = vals[i];
  }
  if (k < CAL_DIST_MIN_VALID) {
    Serial.println("[CAL] Distance: readings too scattered.");
    return false;
  }

  float sum = 0;
  for (int i = 0; i < k; i++) sum += kept[i];
  float mean = sum / k;

  float varSum = 0;
  for (int i = 0; i < k; i++) varSum += (kept[i] - mean) * (kept[i] - mean);
  float stdDev = sqrtf(varSum / k);

  if (stdDev > CAL_MAX_DIST_STD_CM) {
    Serial.printf("[CAL] Distance: unstable (std %.2f cm).\n", stdDev);
    return false;
  }

  // Statistics of |distance - baseline|.
  float devSum = 0;
  for (int i = 0; i < k; i++) devSum += fabsf(kept[i] - mean);
  float devMean = devSum / k;

  float devVarSum = 0;
  for (int i = 0; i < k; i++) {
    float d = fabsf(kept[i] - mean) - devMean;
    devVarSum += d * d;
  }

  baselineDistance = mean;
  currentDistance = mean;
  distDevMean = devMean;
  distDevVar = devVarSum / k;

  Serial.printf("[CAL] Distance OK: baseline %.1f cm (%d of %d samples kept), noise std %.2f cm\n",
                mean, k, n, stdDev);
  return true;
}

void runCalibration() {
  Serial.println("\n[CAL] Starting calibration. Keep the vehicle still...");
  calibrating = true;
  calibrationStatus = "Calibrating...";
  delay(500); // let the vehicle settle

  bool accelOk = false;
  for (int a = 1; a <= CAL_MAX_ATTEMPTS && !accelOk; a++) {
    Serial.printf("[CAL] Accelerometer attempt %d/%d\n", a, CAL_MAX_ATTEMPTS);
    accelOk = calibrateAccelerometer();
    if (!accelOk) delay(500);
  }

  baselineDistance = -1;
  distanceChange = 0;
  bool distOk = false;
  for (int a = 1; a <= CAL_MAX_ATTEMPTS && !distOk; a++) {
    Serial.printf("[CAL] Distance attempt %d/%d\n", a, CAL_MAX_ATTEMPTS);
    distOk = calibrateDistance();
    if (!distOk) delay(500);
  }

  if (accelOk) {
    accelThreshold = computeThreshold(accelDevMean, accelDevVar, ACCEL_SIGMA, ACCEL_MIN_G, ACCEL_MAX_G);
  }
  if (distOk) {
    distThreshold = computeThreshold(distDevMean, distDevVar, DIST_SIGMA, DIST_MIN_CM, DIST_MAX_CM);
  }

  // Reset detection state so stale values can't cause a false trigger.
  previousAccelerationEvent = false;
  previousDistanceEvent = false;
  lastAccelCrossing = 0;
  lastDistanceCrossing = 0;
  calibratedAt = millis();
  calibrating = false;

  if (accelOk && distOk) {
    calibrationStatus = "Calibrated (accelerometer and distance)";
  } else if (accelOk) {
    calibrationStatus = "Partial: accelerometer OK, distance failed (baseline taken from first reading)";
  } else if (distOk) {
    calibrationStatus = "Partial: distance OK, accelerometer failed (using 1 g and default threshold)";
  } else {
    calibrationStatus = "FAILED: using default thresholds";
  }

  Serial.printf("[CAL] Result: %s\n", calibrationStatus.c_str());
  Serial.printf("[CAL] Initial thresholds: accel %.3f g, distance %.1f cm\n",
                accelThreshold, distThreshold);

  digitalWrite(LED_PIN, LOW);
  if (accelOk && distOk) beep(1, 150, 100);
  else beep(3, 150, 150);
}

// -------------------- Ultrasonic update --------------------
void updateUltrasonic() {
  unsigned long now = millis();
  if (now - lastUltrasonicRead < ULTRASONIC_INTERVAL_MS) return;
  lastUltrasonicRead = now;

  float measured = readDistanceCm();
  if (measured <= 0) return; // Ignore invalid readings

  currentDistance = measured;

  // Fallback: initialize the baseline from the first valid reading if calibration couldn't.
  if (baselineDistance < 0) {
    baselineDistance = currentDistance;
    distanceChange = 0;
    Serial.printf("[HC-SR04] Initial baseline: %.1f cm\n", baselineDistance);
    return;
  }

  distanceChange = fabsf(currentDistance - baselineDistance);
  bool distanceEvent = distanceChange >= distThreshold;

  // Record only the crossing into the distance-event state, not every loop.
  if (distanceEvent && !previousDistanceEvent) {
    lastDistanceCrossing = now;
  }
  previousDistanceEvent = distanceEvent;

  // Update baseline and distance statistics slowly, only when both sensors look calm.
  bool accelerationCalm = accelerationDeviation < accelThreshold;
  bool cooldownOver = (now - lastPotholeTime >= COOLDOWN_MS);
  if (!distanceEvent && accelerationCalm) {
    baselineDistance = (baselineDistance * 0.98f) + (currentDistance * 0.02f);
    distanceChange = fabsf(currentDistance - baselineDistance);

    if (cooldownOver) {
      updateRollingStats(distanceChange, DIST_STATS_ALPHA, distDevMean, distDevVar);
      distThreshold = computeThreshold(distDevMean, distDevVar, DIST_SIGMA, DIST_MIN_CM, DIST_MAX_CM);
    }
  } else {
    distanceChange = fabsf(currentDistance - baselineDistance);
  }
}

// -------------------- GPS --------------------
void readGPS() {
  while (GPS.available() > 0) {
    gps.encode(GPS.read());
  }
}

String getIsoTimestamp() {
  if (gps.date.isValid() && gps.time.isValid()) {
    char buf[32];
    snprintf(buf, sizeof(buf), "%04d-%02d-%02dT%02d:%02d:%02dZ",
             gps.date.year(), gps.date.month(), gps.date.day(),
             gps.time.hour(), gps.time.minute(), gps.time.second());
    return String(buf);
  }
  return "";
}

String getGPSHTML() {
  String output;
  if (gps.location.isValid()) {
    output += "<b>Status:</b> FIXED<br>";
    output += "<b>Latitude:</b> " + String(gps.location.lat(), 6) + "<br>";
    output += "<b>Longitude:</b> " + String(gps.location.lng(), 6) + "<br>";
    output += "<b>Satellites:</b> ";
    output += gps.satellites.isValid() ? String(gps.satellites.value()) : "Unknown";
  } else {
    output += "<b>Status:</b> NO FIX (Indoors or searching satellites)";
  }
  return output;
}

// -------------------- Wi-Fi --------------------
void connectWiFi() {
  Serial.printf("[Wi-Fi] Connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 20000UL) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[Wi-Fi] Connected.");
    Serial.print("[Wi-Fi] IP address: ");
    Serial.println(WiFi.localIP());
    Serial.print("[Wi-Fi] Signal: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    Serial.print("[WEB] Open ESP32 Local Page: http://");
    Serial.println(WiFi.localIP());
    Serial.print("[BACKEND] Ingesting to Website: ");
    Serial.println(API_ENDPOINT);
  } else {
    Serial.println("\n[Wi-Fi] Connection timed out; will retry in background.");
  }
}

// -------------------- Central Website Backend Ingestion --------------------
void postReadingToWebsite(double lat, double lng, float depth, String timestampStr) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(API_ENDPOINT);
  http.addHeader("Content-Type", "application/json");

  String jsonBody = "{\"latitude\":" + String(lat, 6) +
                    ",\"longitude\":" + String(lng, 6) +
                    ",\"pothole_depth\":" + String(depth, 1) +
                    ",\"source\":\"wifi\"";
  if (timestampStr.length() > 0) {
    jsonBody += ",\"sensor_timestamp\":\"" + timestampStr + "\"";
  }
  jsonBody += "}";

  int httpCode = http.POST(jsonBody);
  if (httpCode > 0) {
    Serial.printf("[WIFI POST] Pothole telemetry synced to website! HTTP Status: %d\n", httpCode);
  } else {
    Serial.printf("[WIFI POST ERROR] Failed: %s (Code: %d)\n", http.errorToString(httpCode).c_str(), httpCode);
  }
  http.end();
}

// -------------------- Webpage --------------------
String createWebPage() {
  String page;
  page.reserve(7500);

  page += "<!doctype html><html><head>";
  page += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
  page += "<meta http-equiv='refresh' content='1'>";
  page += "<title>ESP32 Pothole Detection</title>";
  page += "<style>";
  page += "body{font-family:Arial,sans-serif;background:#f2f4f7;margin:0;padding:16px;color:#202632}";
  page += ".wrap{max-width:720px;margin:auto}.card{background:white;padding:16px;margin:12px 0;border-radius:12px;box-shadow:0 2px 8px #0000000d}";
  page += "h1{font-size:25px}h2{font-size:18px;margin-top:0}.value{font-size:19px;font-weight:bold}";
  page += ".normal{background:#dff5e1;padding:14px;border-radius:10px}.danger{background:#ffe0e0;padding:14px;border-radius:10px}";
  page += ".muted{color:#596273;font-size:13px}a.btn{display:inline-block;margin-top:10px;padding:8px 14px;background:#2b6cb0;color:white;border-radius:8px;text-decoration:none}";
  page += ".hub{background:#e8f4fd;border-left:4px solid #3182ce}";
  page += "</style></head><body><div class='wrap'>";
  page += "<h1>Automatic Pothole Detection</h1>";

  if (potholeDetected) {
    page += "<div class='danger'><h2>POTHOLE DETECTED</h2><div>Both acceleration and distance-change conditions were met.</div></div>";
  } else {
    page += "<div class='normal'><h2>ROAD STATUS: NORMAL</h2><div>Monitoring sensor readings...</div></div>";
  }

  page += "<div class='card hub'><h2>Central Website Dashboard</h2>";
  page += "<b>Live Telemetry API:</b> <code>" + String(API_ENDPOINT) + "</code><br><br>";
  page += "All detected potholes are automatically synced to the central website dashboard via WiFi &amp; USB Serial Cable!</div>";

  page += "<div class='card'><h2>MPU6500</h2>";
  page += "X: <span class='value'>" + String(ax, 3) + " g</span><br><br>";
  page += "Y: <span class='value'>" + String(ay, 3) + " g</span><br><br>";
  page += "Z: <span class='value'>" + String(az, 3) + " g</span><br><br>";
  page += "Total acceleration: <span class='value'>" + String(totalAcceleration, 3) + " g</span><br><br>";
  page += "Deviation from rest (" + String(restMagnitude, 3) + " g): <span class='value'>" + String(accelerationDeviation, 3) + " g</span><br><br>";
  page += "Adaptive threshold: <span class='value'>" + String(accelThreshold, 3) + " g</span></div>";

  page += "<div class='card'><h2>HC-SR04 Ultrasonic Sensor</h2>Current distance: <span class='value'>";
  page += currentDistance > 0 ? String(currentDistance, 1) + " cm" : "NO READING";
  page += "</span><br><br>Baseline distance: <span class='value'>";
  page += baselineDistance > 0 ? String(baselineDistance, 1) + " cm" : "NO BASELINE";
  page += "</span><br><br>Distance change (Pothole Depth): <span class='value'>" + String(distanceChange, 1) + " cm</span>";
  page += "<br><br>Adaptive threshold: <span class='value'>" + String(distThreshold, 1) + " cm</span></div>";

  page += "<div class='card'><h2>Calibration</h2>" + calibrationStatus;
  page += "<br><a class='btn' href='/recalibrate'>Recalibrate</a>";
  page += "<p class='muted'>Only press this while the vehicle is stationary. The page may pause for a few seconds.</p></div>";

  page += "<div class='card'><h2>NEO-6M GPS</h2>" + getGPSHTML() + "</div>";
  page += "<div class='card'><h2>Last Event</h2>" + lastEvent + "</div>";

  page += "<div class='card'><h2>Wi-Fi</h2><b>IP address:</b> ";
  page += WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : "Disconnected";
  page += "<br><br><b>Signal:</b> ";
  page += WiFi.status() == WL_CONNECTED ? String(WiFi.RSSI()) + " dBm" : "Unavailable";
  page += "<p class='muted'>Phone and ESP32 must be connected to the same network.</p></div>";

  page += "</div></body></html>";
  return page;
}

void handleRoot() {
  server.send(200, "text/html", createWebPage());
}

void handleRecalibrate() {
  recalibrateRequested = true;
  server.sendHeader("Location", "/");
  server.send(303, "text/plain", "Recalibrating...");
}

// -------------------- Event handling --------------------
void triggerPotholeEvent() {
  unsigned long now = millis();
  lastPotholeTime = now;
  statusStartedAt = now;
  potholeDetected = true;
  alarmActive = true;
  alarmStartedAt = now;

  digitalWrite(LED_PIN, HIGH);
  digitalWrite(BUZZER_PIN, HIGH);

  double lat = gps.location.isValid() ? gps.location.lat() : 22.572645;
  double lng = gps.location.isValid() ? gps.location.lng() : 88.363892;
  float depth = distanceChange > 0 ? distanceChange : 5.0f;
  String timestampStr = getIsoTimestamp();

  // -------------------------------------------------------------------------
  // OPTION 3: TRANSMIT OVER USB CABLE (Structured JSON for Web Serial API)
  // -------------------------------------------------------------------------
  // This JSON line is parsed in real time by the website's Web Serial terminal
  // and by python usb_serial_bridge.py
  Serial.printf("{\"latitude\":%.6f,\"longitude\":%.6f,\"pothole_depth\":%.1f,\"source\":\"usb_serial\",\"sensor_timestamp\":\"%s\"}\n",
                lat, lng, depth, timestampStr.c_str());

  // -------------------------------------------------------------------------
  // OPTION 2: TRANSMIT OVER WIFI (HTTP POST to Django Backend API)
  // -------------------------------------------------------------------------
  if (WiFi.status() == WL_CONNECTED) {
    postReadingToWebsite(lat, lng, depth, timestampStr);
  }

  Serial.println("\n========================================");
  Serial.println("         POTENTIAL POTHOLE DETECTED");
  Serial.println("========================================");
  Serial.printf("Acceleration magnitude: %.3f g (rest %.3f g)\n", totalAcceleration, restMagnitude);
  Serial.printf("Acceleration deviation: %.3f g (threshold %.3f g)\n", accelerationDeviation, accelThreshold);
  Serial.printf("Current distance: %.1f cm\n", currentDistance);
  Serial.printf("Distance change (Depth): %.1f cm (threshold %.1f cm)\n", distanceChange, distThreshold);

  if (gps.location.isValid()) {
    Serial.printf("Latitude: %.6f\nLongitude: %.6f\n", lat, lng);
    if (gps.satellites.isValid()) {
      Serial.printf("Satellites: %u\n", gps.satellites.value());
    }
    lastEvent = "POTENTIAL POTHOLE DETECTED<br><br>Latitude: " +
                String(lat, 6) + "<br>Longitude: " + String(lng, 6) +
                "<br>Depth: " + String(depth, 1) + " cm";
  } else {
    Serial.println("GPS: NO FIX (Using fallback coordinates for map demo)");
    lastEvent = "POTENTIAL POTHOLE DETECTED<br><br>Depth: " + String(depth, 1) + " cm<br>GPS: NO FIX";
  }
  Serial.println("LED and buzzer activated.");
  Serial.println("Cooldown started.");
}

void updateAlarmAndStatus() {
  unsigned long now = millis();

  if (alarmActive && now - alarmStartedAt >= ALARM_DURATION_MS) {
    digitalWrite(LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
    alarmActive = false;
    Serial.println("[ALERT] LED and buzzer turned off.");
  }

  if (potholeDetected && now - statusStartedAt >= STATUS_DURATION_MS) {
    potholeDetected = false;
    Serial.println("[STATUS] Road status display reset to NORMAL.");
  }
}

// -------------------- Setup --------------------
void setup() {
  Serial.begin(115200);
  delay(800);
  Serial.println("\n=== ESP32 AUTOMATIC POTHOLE DETECTION (CALIBRATED) ===");
  Serial.println("  Hardware: MPU6500 + HC-SR04 + NEO-6M GPS + LED + Buzzer");
  Serial.println("  Outputs: USB Cable (Serial JSON) + WiFi HTTP Telemetry + Local WebServer");

  pinMode(TRIG_PIN, OUTPUT);
  digitalWrite(TRIG_PIN, LOW);
  pinMode(ECHO_PIN, INPUT);

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  initMPU();

  GPS.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
  Serial.println("[GPS] NEO-6M UART2 initialized (RX=16, TX=17).");

  // Calibrate first, right at power-up, before Wi-Fi connection.
  runCalibration();

  connectWiFi();

  server.on("/", handleRoot);
  server.on("/recalibrate", handleRecalibrate);
  server.begin();
  Serial.println("[WEB] Local Web server started on port 80.");
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[WEB] Open local status page: http://");
    Serial.println(WiFi.localIP());
  }
  Serial.println("[SYSTEM] Ready.");
}

// -------------------- Main loop --------------------
void loop() {
  server.handleClient();
  readGPS();

  if (recalibrateRequested) {
    recalibrateRequested = false;
    runCalibration();
  }

  if (WiFi.status() != WL_CONNECTED &&
      millis() - lastWifiRetry >= WIFI_RETRY_INTERVAL_MS) {
    lastWifiRetry = millis();
    connectWiFi();
  }

  updateUltrasonic();

  if (!readMPU(ax, ay, az)) {
    Serial.println("[ERROR] MPU6500 read failed.");
    updateAlarmAndStatus();
    delay(50);
    return;
  }

  totalAcceleration = sqrtf(ax * ax + ay * ay + az * az);
  // Deviation from the MEASURED resting magnitude.
  accelerationDeviation = fabsf(totalAcceleration - restMagnitude);

  unsigned long now = millis();
  bool accelerationEvent = accelerationDeviation >= accelThreshold;
  bool distanceEvent = distanceChange >= distThreshold;
  bool cooldownOver = (now - lastPotholeTime >= COOLDOWN_MS);
  bool settled = (now - calibratedAt >= SETTLE_AFTER_CAL_MS);

  // Update adaptive acceleration threshold from normal samples only
  if (!accelerationEvent && cooldownOver) {
    updateRollingStats(accelerationDeviation, ACCEL_STATS_ALPHA, accelDevMean, accelDevVar);
    accelThreshold = computeThreshold(accelDevMean, accelDevVar, ACCEL_SIGMA, ACCEL_MIN_G, ACCEL_MAX_G);
  }

  // Capture moment condition first becomes true
  if (accelerationEvent && !previousAccelerationEvent) {
    lastAccelCrossing = now;
  }
  previousAccelerationEvent = accelerationEvent;

  // Detect only if both threshold crossings occurred close together (MATCH_WINDOW_MS = 700ms)
  bool eventsCloseInTime = false;
  if (lastAccelCrossing > 0 && lastDistanceCrossing > 0) {
    unsigned long difference = (lastAccelCrossing > lastDistanceCrossing)
      ? (lastAccelCrossing - lastDistanceCrossing)
      : (lastDistanceCrossing - lastAccelCrossing);
    eventsCloseInTime = difference <= MATCH_WINDOW_MS;
  }

  if (accelerationEvent && distanceEvent && eventsCloseInTime && cooldownOver && settled) {
    triggerPotholeEvent();
    lastAccelCrossing = 0;
    lastDistanceCrossing = 0;
  }

  // Debug logging line
  Serial.printf("X=%.3f g | Y=%.3f g | Z=%.3f g | Total=%.3f g | Dev=%.3f/%.3f g | ",
                ax, ay, az, totalAcceleration, accelerationDeviation, accelThreshold);

  if (currentDistance > 0) Serial.printf("Distance=%.1f cm", currentDistance);
  else Serial.print("Distance=NO READING");
  Serial.printf(" | Baseline=%.1f cm | Change=%.1f/%.1f cm",
                baselineDistance, distanceChange, distThreshold);

  if (gps.location.isValid()) {
    Serial.printf(" | GPS=%.6f,%.6f", gps.location.lat(), gps.location.lng());
  } else {
    Serial.print(" | GPS=NO FIX");
  }

  if (now - lastPotholeTime < COOLDOWN_MS) {
    Serial.printf(" | COOLDOWN=%.1f s",
                  (COOLDOWN_MS - (now - lastPotholeTime)) / 1000.0f);
  }
  Serial.println();

  updateAlarmAndStatus();
  delay(50);
}
