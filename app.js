

let workspace;
let deployedRuleCode = "";
let deployedRules = [];

const greenhouseState = {
  temperature: 28,
  humidity: 65,
  soilMoisture: 45,
  pump: "LOW",
  windowAngle: 0
};

const greenhouseSensors = {
  getTemperature: () => greenhouseState.temperature,
  getHumidity: () => greenhouseState.humidity,
  getSoilMoisture: () => greenhouseState.soilMoisture
};

const greenhouseActuators = {
  setPumpState: (state) => {
    greenhouseState.pump = state;
    addRuntimeLine(`Pump turned ${state === "HIGH" ? "ON" : "OFF"}`);
  },

  setWindowAngle: (angle) => {
    const safeAngle = Math.max(0, Math.min(90, Number(angle)));
    greenhouseState.windowAngle = safeAngle;
    addRuntimeLine(`Ventilation window set to ${safeAngle}°`);
  }
};

function addRuntimeLine(message) {
  const runtimePreview = document.getElementById("runtimePreview");
  if (!runtimePreview) return;

  runtimePreview.textContent += `\n${new Date().toLocaleTimeString()} - ${message}`;
}

// =============================================================================
// 🧱 CUSTOM BLOCK DEFINITIONS
// =============================================================================

Blockly.defineBlocksWithJsonArray([
  {
    type: "get_temperature",
    message0: "🌡️ Current Temperature (°C)",
    output: "Number",
    colour: "#10b981",
    tooltip: "Reads live temperature from the DHT22 sensor.",
    helpUrl: ""
  },
  {
    type: "get_humidity",
    message0: "💧 Current Air Humidity (%)",
    output: "Number",
    colour: "#10b981",
    tooltip: "Reads live humidity from the DHT22 sensor.",
    helpUrl: ""
  },
  {
    type: "get_soil_moisture",
    message0: "🌱 Current Soil Moisture (%)",
    output: "Number",
    colour: "#10b981",
    tooltip: "Reads soil moisture from the analog sensor.",
    helpUrl: ""
  },
  {
    type: "set_pump",
    message0: "🌊 Turn Water Pump %1",
    args0: [
      {
        type: "field_dropdown",
        name: "PUMP_STATE",
        options: [
          ["ON", "HIGH"],
          ["OFF", "LOW"]
        ]
      }
    ],
    previousStatement: null,
    nextStatement: null,
    colour: "#3b82f6",
    tooltip: "Turns water pump relay ON or OFF.",
    helpUrl: ""
  },
  {
    type: "set_window",
    message0: "🪟 Set Ventilation Window to %1 Degrees",
    args0: [
      {
        type: "field_number",
        name: "WINDOW_ANGLE",
        value: 0,
        min: 0,
        max: 90
      }
    ],
    previousStatement: null,
    nextStatement: null,
    colour: "#3b82f6",
    tooltip: "Moves the ventilation servo window.",
    helpUrl: ""
  }
]);

// =============================================================================
// ⚙️ CUSTOM JAVASCRIPT GENERATORS
// =============================================================================

javascript.javascriptGenerator.forBlock["get_temperature"] = function () {
  return ["greenhouseSensors.getTemperature()", javascript.Order.ATOMIC];
};

javascript.javascriptGenerator.forBlock["get_humidity"] = function () {
  return ["greenhouseSensors.getHumidity()", javascript.Order.ATOMIC];
};

javascript.javascriptGenerator.forBlock["get_soil_moisture"] = function () {
  return ["greenhouseSensors.getSoilMoisture()", javascript.Order.ATOMIC];
};

javascript.javascriptGenerator.forBlock["set_pump"] = function (block) {
  const state = block.getFieldValue("PUMP_STATE");
  return `greenhouseActuators.setPumpState("${state}");\n`;
};

javascript.javascriptGenerator.forBlock["set_window"] = function (block) {
  const angle = block.getFieldValue("WINDOW_ANGLE");
  return `greenhouseActuators.setWindowAngle(${angle});\n`;
};

// =============================================================================
// 🚀 INIT
// =============================================================================

document.addEventListener("DOMContentLoaded", function () {
  workspace = Blockly.inject("blocklyDiv", {
    toolbox: document.getElementById("toolbox"),
    scrollbars: true,
    trashcan: true,
    grid: {
      spacing: 20,
      length: 3,
      colour: "#d1fae5",
      snap: true
    }
  });

  window.addEventListener("resize", () => Blockly.svgResize(workspace));

  document.getElementById("runCodeBtn").addEventListener("click", deployRules);

  updateSensorDashboard();
  startTelemetryLoop();
});

// =============================================================================
// 🧠 COMPILE + DEPLOY
// =============================================================================

function deployRules() {
  const codePreview = document.getElementById("codePreview");
  const rulePreview = document.getElementById("rulePreview");
  const runtimePreview = document.getElementById("runtimePreview");

  try {
    const generatedCode = javascript.javascriptGenerator.workspaceToCode(workspace);

    if (generatedCode.trim() === "") {
      codePreview.textContent = "// ⚠️ Drag and connect blocks first.";
      rulePreview.textContent = "// No rules compiled.";
      runtimePreview.textContent = "⚠️ No rules deployed.";
      return;
    }

    deployedRuleCode = generatedCode;
    deployedRules = extractRulesFromWorkspace();

    codePreview.textContent = generatedCode;
    rulePreview.textContent = JSON.stringify(deployedRules, null, 2);

    runtimePreview.textContent = "✅ Rules deployed successfully.\nRuntime engine is continuously evaluating telemetry.";
  } catch (error) {
    runtimePreview.textContent = `❌ Compile Error: ${error.message}`;
  }
}

// =============================================================================
// 📦 STRUCTURED JSON RULE COMPILER
// =============================================================================

function extractRulesFromWorkspace() {
  const rules = [];
  const topBlocks = workspace.getTopBlocks(true);

  topBlocks.forEach((block) => {
    if (block.type === "controls_if") {
      const conditionBlock = block.getInputTargetBlock("IF0");
      const actionBlock = block.getInputTargetBlock("DO0");

      const condition = parseConditionBlock(conditionBlock);
      const actions = parseActionChain(actionBlock);

      if (condition && actions.length > 0) {
        rules.push({
          id: `rule_${rules.length + 1}`,
          condition,
          actions
        });
      }
    }
  });

  return rules;
}

function parseConditionBlock(block) {
  if (!block) return null;

  if (block.type === "logic_compare") {
    const leftBlock = block.getInputTargetBlock("A");
    const rightBlock = block.getInputTargetBlock("B");

    return {
      sensor: parseSensorBlock(leftBlock),
      operator: block.getFieldValue("OP"),
      value: parseNumberBlock(rightBlock)
    };
  }

  return null;
}

function parseSensorBlock(block) {
  if (!block) return "unknown";

  if (block.type === "get_temperature") return "temperature";
  if (block.type === "get_humidity") return "humidity";
  if (block.type === "get_soil_moisture") return "soilMoisture";

  return "unknown";
}

function parseNumberBlock(block) {
  if (!block) return null;

  if (block.type === "math_number") {
    return Number(block.getFieldValue("NUM"));
  }

  return null;
}

function parseActionChain(block) {
  const actions = [];
  let currentBlock = block;

  while (currentBlock) {
    if (currentBlock.type === "set_pump") {
      actions.push({
        type: "pump",
        state: currentBlock.getFieldValue("PUMP_STATE")
      });
    }

    if (currentBlock.type === "set_window") {
      actions.push({
        type: "window",
        angle: Number(currentBlock.getFieldValue("WINDOW_ANGLE"))
      });
    }

    currentBlock = currentBlock.getNextBlock();
  }

  return actions;
}

// =============================================================================
// 🔁 CONTINUOUS TELEMETRY + RUNTIME ENGINE
// =============================================================================

function startTelemetryLoop() {
  setInterval(() => {
    greenhouseState.temperature = Math.floor(Math.random() * 16) + 22;
    greenhouseState.humidity = Math.floor(Math.random() * 31) + 50;
    greenhouseState.soilMoisture = Math.floor(Math.random() * 101);

    updateSensorDashboard();

    if (deployedRuleCode.trim() !== "") {
      runJavaScriptRuntime();
      runJsonRuleRuntime();
    }
  }, 1000);
}

function runJavaScriptRuntime() {
  try {
    const safeRunner = new Function(
      "greenhouseSensors",
      "greenhouseActuators",
      deployedRuleCode
    );

    safeRunner(greenhouseSensors, greenhouseActuators);
  } catch (error) {
    document.getElementById("runtimePreview").textContent +=
      `\n❌ JavaScript Runtime Error: ${error.message}`;
  }
}

function runJsonRuleRuntime() {
  const runtimePreview = document.getElementById("runtimePreview");

  runtimePreview.textContent =
    `Runtime running...\n` +
    `Temp=${greenhouseState.temperature}°C | ` +
    `Humidity=${greenhouseState.humidity}% | ` +
    `Soil=${greenhouseState.soilMoisture}%\n`;

  deployedRules.forEach((rule) => {
    const active = evaluateCondition(rule.condition);

    runtimePreview.textContent +=
      `\n${rule.id}: ${active ? "ACTIVE ✅" : "inactive"}`;

    if (active) {
      rule.actions.forEach(executeAction);
    }
  });

  runtimePreview.textContent +=
    `\n\nFinal State: Pump=${greenhouseState.pump === "HIGH" ? "ON" : "OFF"}, Window=${greenhouseState.windowAngle}°`;

  updateSensorDashboard();
}

function evaluateCondition(condition) {
  const currentValue = greenhouseState[condition.sensor];

  switch (condition.operator) {
    case "GT":
      return currentValue > condition.value;
    case "GTE":
      return currentValue >= condition.value;
    case "LT":
      return currentValue < condition.value;
    case "LTE":
      return currentValue <= condition.value;
    case "EQ":
      return currentValue === condition.value;
    case "NEQ":
      return currentValue !== condition.value;
    default:
      return false;
  }
}

function executeAction(action) {
  if (action.type === "pump") {
    greenhouseActuators.setPumpState(action.state);
  }

  if (action.type === "window") {
    greenhouseActuators.setWindowAngle(action.angle);
  }
}

function updateSensorDashboard() {
  document.getElementById("tempValue").textContent = greenhouseState.temperature;
  document.getElementById("humidityValue").textContent = greenhouseState.humidity;
  document.getElementById("soilValue").textContent = greenhouseState.soilMoisture;

  document.getElementById("pumpStatus").textContent =
    greenhouseState.pump === "HIGH" ? "ON" : "OFF";

  document.getElementById("windowStatus").textContent =
    greenhouseState.windowAngle;
}