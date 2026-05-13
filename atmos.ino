#include <ESP8266WiFi.h>
#include <Firebase_ESP_Client.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>
#include <DHT.h>

#define WIFI_SSID      "POCO C75 5G"
#define WIFI_PASSWORD  "hayaitachii"
#define API_KEY        "AIzaSyCoumP_vQfqXhgPyXZyaJm6P9lUKr57MNw"
#define DATABASE_URL   "atmos-10f2c-default-rtdb.asia-southeast1.firebasedatabase.app"

#define DHTPIN    D5
#define DHTTYPE   DHT11
#define MQ135_PIN A0
#define RAIN_PIN  D6

DHT dht(DHTPIN, DHTTYPE);
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

unsigned long lastUpload = 0;
const unsigned long INTERVAL = 5000;

String getAirQuality(int raw) {
  if (raw < 150) return "Excellent";
  if (raw < 300) return "Good";
  if (raw < 500) return "Moderate";
  if (raw < 700) return "Poor";
  if (raw < 900) return "Bad";
  return "Hazardous";
}

String getComfort(float t, float h) {
  if (h < 30) return "Dry";
  if (h <= 60 && t <= 30) return "Comfortable";
  if (h > 60 && t > 30) return "Hot & Humid";
  return "Normal";
}

void setup() {
  Serial.begin(115200);
  pinMode(RAIN_PIN, INPUT);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(500);
  }
  Serial.println("\nWiFi Connected! IP: " + WiFi.localIP().toString());

  dht.begin();

  config.api_key       = API_KEY;
  config.database_url  = DATABASE_URL;
  config.signer.test_mode = true;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  Serial.println("Firebase Ready");
}

void loop() {
  if (!Firebase.ready()) return;

  unsigned long now = millis();
  if (now - lastUpload < INTERVAL) return;
  lastUpload = now;

  float t = dht.readTemperature();
  float h = dht.readHumidity();

  if (isnan(t) || isnan(h)) {
    Serial.println("DHT read failed, retrying...");
    return;
  }

  int   airRaw  = analogRead(MQ135_PIN);
  int   ppm     = map(airRaw, 0, 1023, 400, 5000);
  bool  rain    = digitalRead(RAIN_PIN) == LOW;
  float feels   = dht.computeHeatIndex(t, h, false);

  FirebaseJson json;
  json.set("temp",       t);
  json.set("hum",        h);
  json.set("feels",      feels);
  json.set("ppm",        ppm);
  json.set("airRaw",     airRaw);
  json.set("airQuality", getAirQuality(airRaw));
  json.set("comfort",    getComfort(t, h));
  json.set("rain",       rain);
  json.set("gasAlert",   airRaw > 700);

  Serial.printf("T:%.1f H:%.1f PPM:%d Rain:%d\n", t, h, ppm, rain);

  if (Firebase.RTDB.setJSON(&fbdo, "/sensorData", &json)) {
    Serial.println("Upload OK");
  } else {
    Serial.println("Upload FAILED: " + fbdo.errorReason());
  }
}