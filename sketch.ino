#include <DHT.h>
#include <ESP32Servo.h>
#include <LiquidCrystal_I2C.h>

// --- PIN DEFINITIONS ---
#define DHTPIN 23          // DHT22 Data pin linked to D23
#define DHTTYPE DHT22      // Setting sensor type as DHT22
#define SOIL_PIN 34        // Potentiometer Signal pin linked to D34 (Analog Input)
#define PUMP_PIN 25        // Relay Module IN pin linked to D25
#define SERVO_PIN 26       // Servo Motor PWM pin linked to D26

// --- INITIALIZE INSTANCES ---
DHT dht(DHTPIN, DHTTYPE);
Servo windowServo;
// Set the LCD address to 0x27 for a 20x4 display (20 chars, 4 rows)
LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  // Start the hardware serial pipeline for local debugging
  Serial.begin(115200);
  Serial.println("=========================================");
  Serial.println("🌱 Greenhouse Automation Hardware System Booting");
  Serial.println("=========================================");

  // Initialize Sensors
  dht.begin();
  
  // Initialize Actuators
  windowServo.attach(SERVO_PIN, 500, 2400); // Attach servo with standard timing pulses
  pinMode(PUMP_PIN, OUTPUT);
  digitalWrite(PUMP_PIN, LOW); // Start with water pump turned OFF Safely
  
  // Initialize LCD Screen
  lcd.init();
  lcd.backlight();
  lcd.clear();
  
  // Print Bootup Messages
  lcd.setCursor(0, 0);
  lcd.print("  GREENHOUSE IOT   ");
  lcd.setCursor(0, 1);
  lcd.print("   SYSTEM READY   ");
  delay(2000);
  lcd.clear();
}
void loop() {
  // 1. READ DATA FROM SENSORS
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  int rawSoil = analogRead(SOIL_PIN);
  int soilMoisture = map(rawSoil, 0, 4095, 0, 100); 

  // Check if readings are valid
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("⚠️ Error: Failed to read from DHT sensor!");
    return;
  }

  // 2. LOG DATA TO SERIAL MONITOR (To verify values are changing)
  Serial.print("Temp: "); Serial.print(temperature, 1);
  Serial.print("C | Hum: "); Serial.print(humidity, 1);
  Serial.print("% | Soil: "); Serial.print(soilMoisture);
  Serial.println("%");

  // 3. REFRESH LCD DISPLAY (Wiping clean first to prevent overwriting)
 lcd.clear();

 lcd.setCursor(0, 0);
 lcd.print("T:");
 lcd.print(temperature, 1);
 lcd.print("C H:");
 lcd.print(humidity, 0);
 lcd.print("%");

 lcd.setCursor(0, 1);
 lcd.print("Soil:");
 lcd.print(soilMoisture);
 lcd.print("% Pump:");
 lcd.print(digitalRead(PUMP_PIN) ? "ON" : "OFF");
 // Actuator cycle
 digitalWrite(PUMP_PIN, HIGH);
 windowServo.write(90);
 delay(2000);

 digitalWrite(PUMP_PIN, LOW);
 windowServo.write(0);
 delay(2000);
}