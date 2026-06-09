let workspace;
let socket;
let deployedRules = [];
let demoMode = true;

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
  setPumpState(state) {
    greenhouseState.pump = state;
    sendCommand({ type: "command", actuator: "pump", state });
    updateDashboard();
  },

  setWindowAngle(angle) {
    const safeAngle = Math.max(0, Math.min(90, Number(angle)));
    greenhouseState.windowAngle = safeAngle;
    sendCommand({ type: "command", actuator: "window", angle: safeAngle });
    updateDashboard();
  }
};

/* CUSTOM BLOCKS */
Blockly.defineBlocksWithJsonArray([
  {
    type: "get_temperature",
    message0: "🌡️ Current Temperature (°C)",
    output: "Number",
    colour: "#10b981"
  },
  {
    type: "get_humidity",
    message0: "💧 Current Humidity (%)",
    output: "Number",
    colour: "#10b981"
  },
  {
    type: "get_soil_moisture",
    message0: "🌱 Current Soil Moisture (%)",
    output: "Number",
    colour: "#10b981"
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
    colour: "#3b82f6"
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
    colour: "#3b82f6"
  }
]);

/* JAVASCRIPT GENERATORS */
javascript.javascriptGenerator.forBlock["get_temperature"] = () => [
  "greenhouseSensors.getTemperature()",
  javascript.Order.ATOMIC
];

javascript.javascriptGenerator.forBlock["get_humidity"] = () => [
  "greenhouseSensors.getHumidity()",
  javascript.Order.ATOMIC
];

javascript.javascriptGenerator.forBlock["get_soil_moisture"] = () => [
  "greenhouseSensors.getSoilMoisture()",
  javascript.Order.ATOMIC
];

javascript.javascriptGenerator.forBlock["set_pump"] = (block) => {
  const state = block.getFieldValue("PUMP_STATE");
  return `greenhouseActuators.setPumpState("${state}");\n`;
};

javascript.javascriptGenerator.forBlock["set_window"] = (block) => {
  const angle = block.getFieldValue("WINDOW_ANGLE");
  return `greenhouseActuators.setWindowAngle(${angle});\n`;
};

/* INIT */
document.addEventListener("DOMContentLoaded", () => {
  workspace = Blockly.inject("blocklyDiv", {
    toolbox: document.getElementById("toolbox"),
    trashcan: true,
    scrollbars: true,
    grid: {
      spacing: 20,
      length: 3,
      colour: "#d1fae5",
      snap: true
    }
  });

  document.getElementById("deployBtn").addEventListener("click", deployRules);
  document.getElementById("greenhouseBtn").addEventListener("click", openGreenhouse);
  document.getElementById("closeGreenhouseBtn").addEventListener("click", closeGreenhouse);
  document.getElementById("hotDryBtn").addEventListener("click", loadHotDryProfile);
  document.getElementById("exportBtn").addEventListener("click", exportRules);

  updateDashboard();
  connectWebSocket();
  startDemoTelemetry();
});

/* WEBSOCKET */
function connectWebSocket() {
  socket = new WebSocket("ws://localhost:3000");

  socket.onopen = () => {
    demoMode = false;
    document.getElementById("connectionStatus").textContent = "Connected ✅";
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "telemetry") {
      greenhouseState.temperature = Number(data.payload.temperature);
      greenhouseState.humidity = Number(data.payload.humidity);
      greenhouseState.soilMoisture = Number(data.payload.soil);
      updateDashboard();
      evaluateRules();
    }
  };

  socket.onerror = () => {
    document.getElementById("connectionStatus").textContent = "Demo Mode 🌼";
  };

  socket.onclose = () => {
    demoMode = true;
    document.getElementById("connectionStatus").textContent = "Demo Mode 🌼";
  };
}

function sendCommand(command) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(command));
  }
}

/* DEMO TELEMETRY */
function startDemoTelemetry() {
  setInterval(() => {
    if (!demoMode) return;

    greenhouseState.temperature = Math.floor(Math.random() * 16) + 22;
    greenhouseState.humidity = Math.floor(Math.random() * 31) + 50;
    greenhouseState.soilMoisture = Math.floor(Math.random() * 101);

    updateDashboard();
    evaluateRules();
  }, 1000);
}

/* DEPLOY RULES */
function deployRules() {
  const code = javascript.javascriptGenerator.workspaceToCode(workspace);

  document.getElementById("codePreview").textContent =
    code || "// No generated JavaScript.";

  deployedRules = extractRules();

  document.getElementById("rulePreview").textContent =
    JSON.stringify(deployedRules, null, 2);

  validateRules();

  document.getElementById("runtimePreview").textContent =
    "✅ Rules deployed. Runtime is evaluating telemetry.";
}

/* JSON RULE COMPILER */
function extractRules() {
  const rules = [];

  workspace.getTopBlocks(true).forEach((block) => {
    if (block.type !== "controls_if") return;

    const condition = parseCondition(block.getInputTargetBlock("IF0"));
    const actions = parseActions(block.getInputTargetBlock("DO0"));

    if (condition && condition.sensor !== "unknown" && actions.length > 0) {
      rules.push({
        id: `rule_${rules.length + 1}`,
        condition,
        actions
      });
    }
  });

  return rules;
}

function parseCondition(block) {
  if (!block || block.type !== "logic_compare") return null;

  return {
    sensor: parseSensor(block.getInputTargetBlock("A")),
    operator: block.getFieldValue("OP"),
    value: parseNumber(block.getInputTargetBlock("B"))
  };
}

function parseSensor(block) {
  if (!block) return "unknown";

  if (block.type === "get_temperature") return "temperature";
  if (block.type === "get_humidity") return "humidity";
  if (block.type === "get_soil_moisture") return "soilMoisture";

  return "unknown";
}

function parseNumber(block) {
  if (!block) return null;
  if (block.type === "math_number") return Number(block.getFieldValue("NUM"));
  return null;
}

function parseActions(block) {
  const actions = [];
  let current = block;

  while (current) {
    if (current.type === "set_pump") {
      actions.push({
        type: "pump",
        state: current.getFieldValue("PUMP_STATE")
      });
    }

    if (current.type === "set_window") {
      actions.push({
        type: "window",
        angle: Number(current.getFieldValue("WINDOW_ANGLE"))
      });
    }

    current = current.getNextBlock();
  }

  return actions;
}

/* VALIDATION */
function validateRules() {
  const box = document.getElementById("validationPreview");

  if (deployedRules.length === 0) {
    box.textContent = "❌ No valid rules. Put actuator blocks inside IF/DO.";
    return false;
  }

  const errors = [];

  deployedRules.forEach((rule) => {
    const pumpStates = rule.actions
      .filter((a) => a.type === "pump")
      .map((a) => a.state);

    if (pumpStates.includes("HIGH") && pumpStates.includes("LOW")) {
      errors.push(`${rule.id}: Pump cannot be ON and OFF in the same rule.`);
    }

    rule.actions.forEach((action) => {
      if (action.type === "window" && (action.angle < 0 || action.angle > 90)) {
        errors.push(`${rule.id}: Window angle must be 0–90.`);
      }
    });
  });

  box.textContent = errors.length ? errors.join("\n") : "✅ Validation passed.";
  return errors.length === 0;
}

/* RUNTIME */
function evaluateRules() {
  if (deployedRules.length === 0) return;

  let log =
    `Runtime running...\n` +
    `Temp=${greenhouseState.temperature}°C | ` +
    `Humidity=${greenhouseState.humidity}% | ` +
    `Soil=${greenhouseState.soilMoisture}%\n`;

  deployedRules.forEach((rule) => {
    const active = evaluateCondition(rule.condition);

    log += `\n${rule.id}: ${active ? "ACTIVE ✅" : "inactive"}`;

    if (active) {
      rule.actions.forEach(executeAction);
    }
  });

  log +=
    `\n\nFinal State: Pump=${greenhouseState.pump === "HIGH" ? "ON" : "OFF"}, ` +
    `Window=${greenhouseState.windowAngle}°`;

  document.getElementById("runtimePreview").textContent = log;
  updateDashboard();
}

function evaluateCondition(condition) {
  const value = greenhouseState[condition.sensor];

  switch (condition.operator) {
    case "GT":
      return value > condition.value;
    case "GTE":
      return value >= condition.value;
    case "LT":
      return value < condition.value;
    case "LTE":
      return value <= condition.value;
    case "EQ":
      return value === condition.value;
    case "NEQ":
      return value !== condition.value;
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

/* DASHBOARD */
function updateDashboard() {
  document.getElementById("tempValue").textContent = greenhouseState.temperature;
  document.getElementById("humidityValue").textContent = greenhouseState.humidity;
  document.getElementById("soilValue").textContent = greenhouseState.soilMoisture;

  document.getElementById("pumpStatus").textContent =
    greenhouseState.pump === "HIGH" ? "ON" : "OFF";

  document.getElementById("windowStatus").textContent =
    greenhouseState.windowAngle;

  updateGreenhouse();
}

/* GREENHOUSE MODAL */
function openGreenhouse() {
  document.getElementById("greenhouseModal").classList.remove("hidden");
  updateGreenhouse();
}

function closeGreenhouse() {
  document.getElementById("greenhouseModal").classList.add("hidden");
}

function updateGreenhouse() {
  if (!document.getElementById("vizTemp")) return;

  const temp = greenhouseState.temperature;
  const humidity = greenhouseState.humidity;
  const soil = greenhouseState.soilMoisture;
  const pump = greenhouseState.pump;
  const windowAngle = greenhouseState.windowAngle;

  document.getElementById("vizTemp").textContent = temp;
  document.getElementById("vizHumidity").textContent = humidity;
  document.getElementById("vizSoil").textContent = soil;
  document.getElementById("vizPump").textContent = pump === "HIGH" ? "ON" : "OFF";
  document.getElementById("vizWindow").textContent = windowAngle;

  const scene = document.querySelector(".greenhouse-scene");
  const plant = document.getElementById("plant");
  const sun = document.getElementById("sunGlow");
  const mist = document.getElementById("mist");
  const water = document.getElementById("waterDrop");
  const windowPane = document.getElementById("windowPane");

  scene.classList.remove("hot-env", "normal-env", "humid-env", "dry-env");
  plant.classList.remove("healthy", "dry", "weak", "dying");

  if (temp >= 36 || soil <= 15) {
    scene.classList.add("dry-env");
    plant.classList.add("dying");
    plant.textContent = "🥀";
  } else if (temp > 30 || soil < 35) {
    scene.classList.add("hot-env");
    plant.classList.add("weak");
    plant.textContent = "🌿";
  } else if (humidity > 75) {
    scene.classList.add("humid-env");
    plant.classList.add("healthy");
    plant.textContent = "🌱";
  } else {
    scene.classList.add("normal-env");
    plant.classList.add("healthy");
    plant.textContent = "🌱";
  }

  sun.classList.toggle("hot", temp > 30);
  mist.classList.toggle("active", humidity > 70);
  water.classList.toggle("active", pump === "HIGH");

  windowPane.style.transform = `rotateY(${windowAngle}deg)`;
}
/* SAMPLE PROFILE */
function loadHotDryProfile() {
  alert("Hot & Dry Clicked");

  greenhouseState.temperature = 35;
  greenhouseState.humidity = 42;
  greenhouseState.soilMoisture = 18;

  updateDashboard();
  evaluateRules();
}

/* EXPORT JSON */
function exportRules() {
  const blob = new Blob([JSON.stringify(deployedRules, null, 2)], {
    type: "application/json"
  });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "greenhouse-rules.json";
  link.click();
}