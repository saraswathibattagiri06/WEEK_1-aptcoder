/**
 * engine.js — JavaScript Orchestration Engine
 *
 * Responsibilities:
 *   1. Maintain live greenhouse state (sensors + actuators)
 *   2. Expose sensor/actuator APIs consumed by generated Blockly code
 *   3. Compile Blockly workspace into a structured JSON rule set
 *   4. Validate rules for conflicts and constraint violations
 *   5. Evaluate rules every tick against live telemetry
 *   6. Debounce actuator commands (only send when state changes)
 */

/* ═══════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════ */

const greenhouseState = {
  temperature:  25,
  humidity:     65,
  soilMoisture: 45,
  pump:         "LOW",
  windowAngle:  0
};

/** Tracks last command sent to avoid hammering the relay / servo */
const lastSent = {
  pump:        null,
  windowAngle: null
};

/** Active compiled rule set — populated on Deploy */
let deployedRules = [];

/* ═══════════════════════════════════════════════════════════════
   SENSOR API  (called by generated Blockly JS code)
   ═══════════════════════════════════════════════════════════════ */

const greenhouseSensors = {
  getTemperature:  () => greenhouseState.temperature,
  getHumidity:     () => greenhouseState.humidity,
  getSoilMoisture: () => greenhouseState.soilMoisture
};

/* ═══════════════════════════════════════════════════════════════
   ACTUATOR API  (called by generated Blockly JS code)
   ═══════════════════════════════════════════════════════════════ */

const greenhouseActuators = {
  setPumpState(state) {
    greenhouseState.pump = state;
    updateDashboard();
  },

  setWindowAngle(angle) {
    const safe = Math.max(0, Math.min(90, Number(angle)));
    greenhouseState.windowAngle = safe;
    updateDashboard();
  }
};

/* ═══════════════════════════════════════════════════════════════
   RULE COMPILER  (Blockly workspace → JSON rule array)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Walks every top-level "controls_if" block in the workspace and
 * converts it into a plain JSON rule object:
 *
 *   {
 *     id: "rule_1",
 *     condition: { sensor, operator, value },
 *     actions: [{ type: "pump"|"window", ... }]
 *   }
 *
 * Only blocks with a recognised sensor comparison AND at least one
 * valid actuator action are included.
 */
function extractRules(workspace) {
  const rules = [];

  workspace.getTopBlocks(true).forEach((block) => {
    if (block.type !== "controls_if") return;

    const condition = parseCondition(block.getInputTargetBlock("IF0"));
    const actions   = parseActions(block.getInputTargetBlock("DO0"));

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

  const sensor   = parseSensor(block.getInputTargetBlock("A"));
  const operator = block.getFieldValue("OP");
  const value    = parseNumber(block.getInputTargetBlock("B"));

  if (sensor === "unknown" || value === null) return null;

  return { sensor, operator, value };
}

function parseSensor(block) {
  if (!block) return "unknown";
  const map = {
    get_temperature:  "temperature",
    get_humidity:     "humidity",
    get_soil_moisture: "soilMoisture"
  };
  return map[block.type] ?? "unknown";
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
      actions.push({ type: "pump", state: current.getFieldValue("PUMP_STATE") });
    }
    if (current.type === "set_window") {
      actions.push({ type: "window", angle: Number(current.getFieldValue("WINDOW_ANGLE")) });
    }
    current = current.getNextBlock();
  }

  return actions;
}

/* ═══════════════════════════════════════════════════════════════
   VALIDATOR
   ═══════════════════════════════════════════════════════════════ */

/**
 * Returns { valid: bool, errors: string[] }.
 *
 * Catches:
 *   - No rules compiled
 *   - Pump ON and OFF in the same rule (contradictory)
 *   - Window angle out of 0–90 range
 *   - Missing / null condition value
 */
function validateRules(rules) {
  if (rules.length === 0) {
    return {
      valid: false,
      errors: ["No valid rules found. Place actuator blocks inside an IF/DO block."]
    };
  }

  const errors = [];

  rules.forEach((rule) => {
    // Conflicting pump commands in one rule
    const pumpStates = rule.actions
      .filter((a) => a.type === "pump")
      .map((a) => a.state);

    if (pumpStates.includes("HIGH") && pumpStates.includes("LOW")) {
      errors.push(`${rule.id}: Pump cannot be set ON and OFF in the same rule.`);
    }

    // Window angle out of bounds
    rule.actions.forEach((a) => {
      if (a.type === "window" && (a.angle < 0 || a.angle > 90)) {
        errors.push(`${rule.id}: Window angle must be 0–90° (got ${a.angle}°).`);
      }
    });

    // Null condition value (user left a number block empty)
    if (rule.condition.value === null) {
      errors.push(`${rule.id}: Comparison value is missing — connect a number block.`);
    }
  });

  return { valid: errors.length === 0, errors };
}

/* ═══════════════════════════════════════════════════════════════
   RUNTIME EVALUATOR
   ═══════════════════════════════════════════════════════════════ */

/**
 * Evaluates all deployed rules against current sensor readings.
 * Returns a log string for display.
 *
 * Actuator commands are only dispatched when the desired state
 * differs from what was last sent (debounce), preventing relay
 * chatter on every telemetry tick.
 */
function evaluateRules() {
  if (deployedRules.length === 0) return null;

  const { temperature, humidity, soilMoisture } = greenhouseState;

  let log =
    `[${timestamp()}] Temp=${temperature}°C | Humidity=${humidity}% | Soil=${soilMoisture}%\n`;

  deployedRules.forEach((rule) => {
    const active = evaluateCondition(rule.condition);
    log += `  ${rule.id} (${describeCondition(rule.condition)}): ${active ? "ACTIVE ✅" : "inactive"}\n`;

    if (active) {
      rule.actions.forEach((action) => executeAction(action));
    }
  });

  log += `  → Pump: ${greenhouseState.pump === "HIGH" ? "ON" : "OFF"} | Window: ${greenhouseState.windowAngle}°`;

  return log;
}

function evaluateCondition({ sensor, operator, value }) {
  const current = greenhouseState[sensor];

  switch (operator) {
    case "GT":  return current >  value;
    case "GTE": return current >= value;
    case "LT":  return current <  value;
    case "LTE": return current <= value;
    case "EQ":  return current === value;
    case "NEQ": return current !== value;
    default:    return false;
  }
}

/**
 * Dispatches an actuator command via WebSocket only when the
 * desired state has changed from the previously sent state.
 */
function executeAction(action) {
  if (action.type === "pump") {
    if (action.state !== lastSent.pump) {
      lastSent.pump = action.state;
      greenhouseActuators.setPumpState(action.state);
      sendCommand({ type: "command", actuator: "pump", state: action.state });
    } else {
      greenhouseState.pump = action.state; // keep local state correct
    }
  }

  if (action.type === "window") {
    const safe = Math.max(0, Math.min(90, action.angle));
    if (safe !== lastSent.windowAngle) {
      lastSent.windowAngle = safe;
      greenhouseActuators.setWindowAngle(safe);
      sendCommand({ type: "command", actuator: "window", angle: safe });
    } else {
      greenhouseState.windowAngle = safe;
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

function describeCondition({ sensor, operator, value }) {
  const sensorLabel = { temperature: "Temp", humidity: "Humidity", soilMoisture: "Soil" };
  const opLabel     = { GT: ">", GTE: "≥", LT: "<", LTE: "≤", EQ: "=", NEQ: "≠" };
  return `${sensorLabel[sensor] ?? sensor} ${opLabel[operator] ?? operator} ${value}`;
}

function timestamp() {
  return new Date().toLocaleTimeString();
}
