// =============================================================================
// 🌱 DAY 2: GOOGLE BLOCKLY CUSTOM GREENHOUSE SEMANTIC BLOCK DEFINITIONS
// =============================================================================

Blockly.defineBlocksWithJsonArray([
  // --- INPUT SENSORS CATEGORY ---
  {
    "type": "get_temperature",
    "message0": "🌡️ Current Temperature (°C)",
    "output": "Number",
    "colour": "#10b981",
    "tooltip": "Reads live temperature data from the greenhouse DHT22 sensor.",
    "helpUrl": ""
  },
  {
    "type": "get_humidity",
    "message0": "💧 Current Air Humidity (%)",
    "output": "Number",
    "colour": "#10b981",
    "tooltip": "Reads live relative humidity data from the greenhouse DHT22 sensor.",
    "helpUrl": ""
  },
  {
    "type": "get_soil_moisture",
    "message0": "🌱 Current Soil Moisture (%)",
    "output": "Number",
    "colour": "#10b981",
    "tooltip": "Reads live volumetric soil saturation percentages from the analog potentiometer sensor.",
    "helpUrl": ""
  },

  // --- OUTPUT ACTUATORS CATEGORY ---
  {
    "type": "set_pump",
    "message0": "🌊 Turn Water Pump %1",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "PUMP_STATE",
        "options": [
          ["ON", "HIGH"],
          ["OFF", "LOW"]
        ]
      }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": "#3b82f6",
    "tooltip": "Commands the relay module switch to energize or shut down the water distribution node.",
    "helpUrl": ""
  },
  {
    "type": "set_window",
    "message0": "🪟 Set Ventilation Window to %1 Degrees (0-90)",
    "args0": [
      {
        "type": "field_number",
        "name": "WINDOW_ANGLE",
        "value": 0,
        "min": 0,
        "max": 90
      }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": "#3b82f6",
    "tooltip": "Drives the PWM micro-servo motor angle to position the mechanical vent window overhead.",
    "helpUrl": ""
  }
]);

// =============================================================================
// ⚡ MODERN CODE GENERATOR CONFIGURATIONS (javascript.javascriptGenerator)
// =============================================================================

// --- SENSOR INPUT GENERATORS ---
javascript.javascriptGenerator.forBlock['get_temperature'] = function(block) {
  return ['greenhouseSensors.getTemperature()', javascript.Order.ATOMIC];
};

javascript.javascriptGenerator.forBlock['get_humidity'] = function(block) {
  return ['greenhouseSensors.getHumidity()', javascript.Order.ATOMIC];
};

javascript.javascriptGenerator.forBlock['get_soil_moisture'] = function(block) {
  return ['greenhouseSensors.getSoilMoisture()', javascript.Order.ATOMIC];
};

// --- ACTUATOR OUTPUT GENERATORS ---
javascript.javascriptGenerator.forBlock['set_pump'] = function(block) {
  const dropdown_state = block.getFieldValue('PUMP_STATE');
  return `greenhouseActuators.setPumpState("${dropdown_state}");\n`;
};

javascript.javascriptGenerator.forBlock['set_window'] = function(block) {
  const number_angle = block.getFieldValue('WINDOW_ANGLE');
  return `greenhouseActuators.setWindowAngle(${number_angle});\n`;
};

// =============================================================================
// ⚙️ INITIALIZATION & INTERACTION CONTROLLER (Single DomContentLoaded)
// =============================================================================
document.addEventListener("DOMContentLoaded", function () {
  // 1. Inject the workspace layout canvas
  const workspace = Blockly.inject('blocklyDiv', {
    toolbox: document.getElementById('toolbox'),
    scrollbars: true,
    trashcan: true,
    grid: {
      spacing: 20,
      length: 3,
      colour: '#ccc',
      snap: true
    }
  });

  // Handle Window Resize Responsiveness dynamically
  window.addEventListener('resize', () => Blockly.svgResize(workspace), false);

  // 2. Setup the Code Execution Compilation Button
  document.getElementById('runCodeBtn').addEventListener('click', function() {
    let generatedCode = javascript.javascriptGenerator.workspaceToCode(workspace);
    const codePreview = document.getElementById('codePreview');

    if (generatedCode.trim() === "") {
      codePreview.textContent = "// ⚠️ Drag some blocks together and snap them in first!";
    } else {
      codePreview.textContent = generatedCode;
    }
  });
});