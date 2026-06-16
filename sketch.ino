#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <ESP32Servo.h>
#include <LiquidCrystal_I2C.h>

#define DHTPIN      23
#define DHTTYPE     DHT22
#define SOIL_PIN    34
#define PUMP_PIN    25
#define SERVO_PIN   26

const char* ssid     = "Wokwi-GUEST";
const char* password = "";

// Ensure this matches your active PowerShell ngrok domain perfectly!
const char* websocketHost = "jalapeno-footbath-deduct.ngrok-free.dev";

const unsigned long TELEMETRY_INTERVAL_MS = 1000;

DHT               dht(DHTPIN, DHTTYPE);
Servo             windowServo;
LiquidCrystal_I2C lcd(0x27, 16, 2);
WebSocketsClient  webSocket;

unsigned long lastTelemetryMs = 0;

void handleCommand(uint8_t* payload) {
  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, payload);

  if (err) {
    Serial.print("JSON parse error: ");
    Serial.println(err.c_str());
    return;
  }

  const char* type     = doc["type"]     | "";
  const char* actuator = doc["actuator"] | "";

  if (strcmp(type, "command") == 0 && strcmp(actuator, "pump") == 0) {
    const char* state = doc["state"] | "LOW";
    bool on = strcmp(state, "HIGH") == 0;
    digitalWrite(PUMP_PIN, on ? HIGH : LOW);
    Serial.printf("🌊 Pump %s\n", on ? "ON" : "OFF");
  }

  if (strcmp(type, "command") == 0 && strcmp(actuator, "window") == 0) {
    int angle = constrain((int)(doc["angle"] | 0), 0, 90);
    windowServo.write(angle);
    Serial.printf("🪟 Window %d°\n", angle);
  }
}

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      Serial.println("✅ WebSocket connected to server");
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Server: OK");
      break;

    case WStype_DISCONNECTED:
      Serial.println("⚠️  WebSocket disconnected – retrying…");
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Server: LOST");
      break;

    case WStype_TEXT:
      Serial.print("📩 ");
      Serial.println((char*)payload);
      handleCommand(payload);
      break;

    case WStype_ERROR:
      Serial.println("❌ WebSocket error");
      break;

    default:
      break;
  }
}

void sendTelemetry() {
  float temperature = dht.readTemperature();
  float humidity    = dht.readHumidity();

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("⚠️  DHT22 read failed – skipping");
    return;
  }
  
  int rawSoil      = analogRead(SOIL_PIN);
  int soilMoisture = map(rawSoil, 0, 4095, 0, 100);

  StaticJsonDocument<256> doc;
  doc["type"] = "telemetry";

  JsonObject payload = doc.createNestedObject("payload");
  payload["temperature"]  = round(temperature * 10.0) / 10.0;
  payload["humidity"]     = round(humidity);
  payload["soilMoisture"] = soilMoisture;

  String json;
  serializeJson(doc, json);
  webSocket.sendTXT(json);

  Serial.println(json);
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("T:");
  lcd.print(temperature, 1);
  lcd.print(" H:");
  lcd.print((int)humidity);
  lcd.print("%");

  lcd.setCursor(0, 1);
  lcd.print("Soil:");
  lcd.print(soilMoisture);
  lcd.print("% ");

  lcd.setCursor(10, 1);
  lcd.print(digitalRead(PUMP_PIN) == HIGH ? "P:ON " : "P:OFF");
}

void setup() {
  Serial.begin(115200);
  Serial.println("\n🌱 FarmLogic ESP32 Node booting…");

  dht.begin();
  pinMode(PUMP_PIN, OUTPUT);
  digitalWrite(PUMP_PIN, LOW);
  windowServo.attach(SERVO_PIN, 500, 2400);
  windowServo.write(0);

  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.print("Connecting WiFi");

  WiFi.begin(ssid, password);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi failed!");
    lcd.clear();
    lcd.print("WiFi FAILED");
    return;
  }

  Serial.print("✅ WiFi connected: ");
  Serial.println(WiFi.localIP());

  lcd.clear();
  lcd.print("WiFi: OK");
  lcd.setCursor(0, 1);
  lcd.print(WiFi.localIP());

  delay(1000);
  webSocket.setExtraHeaders("ngrok-skip-browser-warning: true");
  webSocket.beginSSL(
  "jalapeno-footbath-deduct.ngrok-free.dev",
  443,
  "/"
);
  webSocket.getWiFiClient()->setInsecure();
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);

  Serial.printf("🔌 Connecting WS → ws://%s:443/\n", websocketHost);
}

void loop() {
  webSocket.loop();

  if (millis() - lastTelemetryMs >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryMs = millis();
    sendTelemetry();
  }
}