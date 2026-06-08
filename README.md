# WEEK_1-aptcoder

# 🌱 Smart Greenhouse Automation System (No-Code IoT Rule Engine)

An automated hydroponic greenhouse monitoring panel that allows non-technical operators to deploy custom environmental logic. This application bridges a visual **Google Blockly** workspace with a live-simulated **ESP32 Microcontroller hardware cluster** via a high-velocity JavaScript orchestration system.

---

## 📅 Milestone Archive: Day 1 Summary
* **Hardware Layer Mapping:** Configured and wired the complete virtual ESP32 sensor matrix on Wokwi.
* **Local Project Scaffolding:** Initialized the vanilla Single Page Application (SPA) container architecture (`index.html`, `app.js`, `styles.css`).
* **Blockly Pipeline Injection:** Integrated the core Google Blockly visual workspace workspace modules via distributed CDN pipelines.
* **Hardware Sanity Calibration:** Deployed driver firmware directly to the virtual ESP32 layout to verify operational signal integrity across all I/O pins.

---

## 🏗️ Hardware Architecture & Schematic Pins

The system leverages an ESP32 edge processing unit configured with the following localized physical sensor and actuator components:

| Hardware Component | Description | ESP32 Pin Assignment | Communication Protocol |
| :--- | :--- | :--- | :--- |
| **DHT22 Sensor** | Ambient Temperature & Relative Humidity | `D23` | Single-Wire Digital Signal |
| **Rotary Potentiometer** | Soil Moisture Volumetric Simulation | `D34` | Analog Input (`ADC1_CH6`) |
| **Relay Module** | Water Pump Solenoid Switch (Status LED) | `D25` | Digital Output (High/Low) |
| **Micro Servo Motor** | Automated Ventilation Window Control Panel | `D26` | Hardware PWM Duty Signal |
| **LiquidCrystal 2004 LCD** | Localized Status Dashboard Monitor | `D21` (SDA), `D22` (SCL) | $I^2C$ Standard Protocol |

---

## 📂 File Directory Matrix

```text
greenhouse-engine/
├── index.html        # Main visual application layout & Blockly workspace injector
├── app.js            # JavaScript Execution Framework (Middleware Logic)
├── styles.css        # Layout style architecture definitions 
├── sketch.ino        # Day 1 hardware validation and diagnostic ESP32 firmware
└── diagram.json      # Wokwi Canvas virtual hardware layout configurations
Day 2 introduced semantic translations, transforming raw programmatic data variables into highly readable blocks for farm management:

### 🌾 Sensor Inputs (Green Category)
* `🌡️ Current Temperature (°C)` $\rightarrow$ Compiles to: `greenhouseSensors.getTemperature()`
* `💧 Current Air Humidity (%)` $\rightarrow$ Compiles to: `greenhouseSensors.getHumidity()`
* `🌱 Current Soil Moisture (%)` $\rightarrow$ Compiles to: `greenhouseSensors.getSoilMoisture()`

### ⚙️ Actuator Outputs (Blue Category)
* `🌊 Turn Water Pump [ON / OFF]` $\rightarrow$ Compiles to: `greenhouseActuators.setPumpState("HIGH" / "LOW");`
* `🪟 Set Ventilation Window to [0-90] Degrees` $\rightarrow$ Compiles to: `greenhouseActuators.setWindowAngle(value);`

---

## 📂 File Directory Matrix

```text
greenhouse-engine/
├── index.html        # Main visual application layout & Blockly workspace injector
├── app.js            # Unified custom block definitions, compilation triggers, & middleware
├── styles.css        # Dashboard styling, side-by-side split grid container architecture
├── sketch.ino        # Hardware validation and diagnostic ESP32 firmware
└── diagram.json      # Wokwi Canvas virtual hardware layout configurations
