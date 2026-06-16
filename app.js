/**
 * app.js — Application Bootstrap & Wiring
 *
 * Responsibilities:
 *   - Initialise Blockly workspace
 *   - Manage WebSocket connection (real or demo)
 *   - Drive the demo telemetry loop
 *   - Handle all UI interactions (Deploy, Export, Modals, etc.)
 *   - Update the dashboard, gauges, chart, and greenhouse scene
 */

/* ═══════════════════════════════════════════════════════════════
   MODULE STATE
   ═══════════════════════════════════════════════════════════════ */

let workspace = null;
let socket    = null;
let demoMode  = true;
let demoTimer = null;

/** Configurable WebSocket URL — user can override via Config modal */
let wsUrl = "ws://localhost:3000";

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", () => {
  initBlockly();
  initChart();
  bindUI();
  updateDashboard();
  connectWebSocket();
  startDemoTelemetry();
});

/* ─── Blockly ────────────────────────────────────────────────── */
function initBlockly() {
  workspace = Blockly.inject("blocklyDiv", {
    toolbox: document.getElementById("toolbox"),
    trashcan: true,
    scrollbars: true,
    zoom: { controls: true, wheel: true, startScale: 0.95 },
    grid: { spacing: 24, length: 4, colour: "#1e293b", snap: true },
    theme: Blockly.Theme.defineTheme("farmlogic", {
      base: Blockly.Themes.Classic,
      componentStyles: {
        workspaceBackgroundColour: "#020617",
        toolboxBackgroundColour:   "#0f172a",
        toolboxForegroundColour:   "#94a3b8",
        flyoutBackgroundColour:    "#0f172a",
        flyoutForegroundColour:    "#cbd5e1",
        flyoutOpacity: 1,
        scrollbarColour: "#334155",
        scrollbarOpacity: 0.8
      }
    })
  });
}

/* ─── UI Bindings ────────────────────────────────────────────── */
function bindUI() {
  // Deploy
  document.getElementById("deployBtn").addEventListener("click", runDeploy);

  // Clear workspace
  document.getElementById("clearBtn").addEventListener("click", () => {
    if (confirm("Clear all blocks?")) workspace.clear();
  });

  // Hot & Dry profile
  document.getElementById("hotDryBtn").addEventListener("click", loadHotDryProfile);

  // Export
  document.getElementById("exportBtn").addEventListener("click", exportRules);

  // Clear log
  document.getElementById("clearLogBtn").addEventListener("click", () => {
    document.getElementById("runtimePreview").textContent = "Log cleared.";
  });

  // Greenhouse scene modal
  document.getElementById("greenhouseBtn").addEventListener("click", () => {
    document.getElementById("greenhouseModal").classList.remove("hidden");
    updateGreenhouse();
  });
  document.getElementById("closeGreenhouseBtn").addEventListener("click", () => {
    document.getElementById("greenhouseModal").classList.add("hidden");
  });
  document.getElementById("closeGreenhouseBtn2").addEventListener("click", () => {
    document.getElementById("greenhouseModal").classList.add("hidden");
  });

  // Debug drawer
  document.getElementById("drawerToggle").addEventListener("click", () => {
    document.getElementById("drawer").classList.toggle("open");
  });
  document.getElementById("drawerClose").addEventListener("click", () => {
    document.getElementById("drawer").classList.remove("open");
  });

  // Ngrok / WS config modal
  document.getElementById("ngrokBtn").addEventListener("click", () => {
    document.getElementById("wsUrlInput").value = wsUrl;
    document.getElementById("ngrokModal").classList.remove("hidden");
  });
  document.getElementById("closeNgrokBtn").addEventListener("click", () => {
    document.getElementById("ngrokModal").classList.add("hidden");
  });
  document.getElementById("closeNgrokBackdrop").addEventListener("click", () => {
    document.getElementById("ngrokModal").classList.add("hidden");
  });
  document.getElementById("connectBtn").addEventListener("click", () => {
    const val = document.getElementById("wsUrlInput").value.trim();
    if (val) {
      wsUrl = val;
      document.getElementById("ngrokModal").classList.add("hidden");
      reconnectWebSocket();
    }
  });
  document.getElementById("demoBtn").addEventListener("click", () => {
    demoMode = true;
    document.getElementById("ngrokModal").classList.add("hidden");
    setConnectionStatus("demo");
    toast("Running in Demo Mode 🌼", "warn");
  });
}

/* ═══════════════════════════════════════════════════════════════
   WEBSOCKET
   ═══════════════════════════════════════════════════════════════ */

function connectWebSocket() {
  try {
    socket = new WebSocket(wsUrl);
  } catch (e) {
    console.warn("WebSocket init failed:", e.message);
    enterDemoMode();
    return;
  }

  socket.onopen = () => {
    demoMode = false;
    setConnectionStatus("connected");
    toast("Connected to greenhouse server ✅", "success");
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleServerMessage(data);
    } catch (e) {
      console.error("WS parse error:", e);
    }
  };

  socket.onerror = () => enterDemoMode();

  socket.onclose = () => {
    enterDemoMode();
    // Auto-reconnect after 5 s
    setTimeout(connectWebSocket, 5000);
  };
}

function reconnectWebSocket() {
  if (socket) {
    socket.onclose = null; // prevent auto-reconnect loop
    socket.close();
  }
  connectWebSocket();
}

function handleServerMessage(data) {
  if (data.type === "telemetry") {
    greenhouseState.temperature  = Number(data.payload.temperature);
    greenhouseState.humidity     = Number(data.payload.humidity);
    greenhouseState.soilMoisture = Number(data.payload.soilMoisture ?? data.payload.soil ?? 0);

    pushChartData(
      greenhouseState.temperature,
      greenhouseState.humidity,
      greenhouseState.soilMoisture
    );

    updateDashboard();

    const log = evaluateRules();
    if (log) appendLog(log);
  }

  if (data.type === "command_state") {
    greenhouseState.pump        = data.payload.pump ?? "LOW";
    greenhouseState.windowAngle = Number(data.payload.window ?? 0);
    updateDashboard();
  }
}

function sendCommand(command) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(command));
  }
}

function enterDemoMode() {
  demoMode = true;
  setConnectionStatus("demo");
}

/* ═══════════════════════════════════════════════════════════════
   DEMO TELEMETRY  (only runs when no real connection)
   ═══════════════════════════════════════════════════════════════ */

function startDemoTelemetry() {
  if (demoTimer) clearInterval(demoTimer);

  demoTimer = setInterval(() => {
    if (!demoMode) return;

    // Smooth random walk for realistic-looking data
    greenhouseState.temperature  = clamp(greenhouseState.temperature  + jitter(3), 18, 45);
    greenhouseState.humidity     = clamp(greenhouseState.humidity     + jitter(4), 30, 95);
    greenhouseState.soilMoisture = clamp(greenhouseState.soilMoisture + jitter(5), 0,  100);

    pushChartData(
      greenhouseState.temperature,
      greenhouseState.humidity,
      greenhouseState.soilMoisture
    );

    updateDashboard();

    const log = evaluateRules();
    if (log) appendLog(log);
  }, 1000);
}

function jitter(range) {
  return (Math.random() - 0.5) * range;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, Math.round(val * 10) / 10));
}

/* ═══════════════════════════════════════════════════════════════
   DEPLOY PIPELINE
   ═══════════════════════════════════════════════════════════════ */

async function runDeploy() {
  // Reset pipeline UI
  setPipelineStep("compile",  "active",  "…");
  setPipelineStep("validate", "idle",    "—");
  setPipelineStep("deploy",   "idle",    "—");

  await delay(200);

  /* Step 1 — Compile */
  const code = javascript.javascriptGenerator.workspaceToCode(workspace);
  document.getElementById("codePreview").textContent = code || "// No blocks placed.";

  const rules = extractRules(workspace);
  document.getElementById("rulePreview").textContent = JSON.stringify(rules, null, 2);

  if (!code.trim()) {
    setPipelineStep("compile", "error", "empty");
    toast("No blocks to compile. Build some logic first.", "error");
    return;
  }

  setPipelineStep("compile", "success", "OK");
  await delay(200);

  /* Step 2 — Validate */
  setPipelineStep("validate", "active", "…");
  await delay(200);

  const { valid, errors } = validateRules(rules);
  document.getElementById("validationPreview").textContent =
    valid ? "✅ All rules passed validation." : errors.join("\n");

  if (!valid) {
    setPipelineStep("validate", "error", "fail");
    errors.forEach((e) => toast(e, "error"));
    return;
  }

  setPipelineStep("validate", "success", "OK");
  await delay(200);

  /* Step 3 — Deploy */
  setPipelineStep("deploy", "active", "…");
  await delay(300);

  deployedRules = rules;

  // Reset debounce cache so newly deployed rules take effect immediately
  lastSent.pump        = null;
  lastSent.windowAngle = null;

  setPipelineStep("deploy", "success", "LIVE");
  toast(`${rules.length} rule${rules.length !== 1 ? "s" : ""} deployed and active ✅`, "success");
  appendLog(`[${new Date().toLocaleTimeString()}] ── Rules deployed (${rules.length} active) ──`);
}

function setPipelineStep(step, state, label) {
  const el = document.getElementById(`step-${step}`);
  const stateEl = document.getElementById(`${step}State`);
  el.className = `pipeline-step ${state === "idle" ? "" : state}`;
  stateEl.textContent = label;
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════════════ */

function updateDashboard() {
  const { temperature, humidity, soilMoisture, pump, windowAngle } = greenhouseState;

  // Gauges
  setGauge("temp",    temperature,  0, 50);
  setGauge("humid",   humidity,     0, 100);
  setGauge("soil",    soilMoisture, 0, 100);

  document.getElementById("tempValue").textContent     = temperature.toFixed(1);
  document.getElementById("humidityValue").textContent = humidity.toFixed(0);
  document.getElementById("soilValue").textContent     = soilMoisture.toFixed(0);

  // Actuator badges
  const pumpBadge   = document.getElementById("pumpStatus");
  const windowBadge = document.getElementById("windowStatus");
  const pumpCard    = document.getElementById("pumpCard");

  const pumpOn = pump === "HIGH";
  pumpBadge.textContent   = pumpOn ? "ON" : "OFF";
  pumpBadge.className     = `actuator-badge${pumpOn ? " on" : ""}`;
  pumpCard.classList.toggle("active", pumpOn);

  windowBadge.textContent = `${windowAngle}°`;

  // Greenhouse scene (only if visible)
  if (!document.getElementById("greenhouseModal").classList.contains("hidden")) {
    updateGreenhouse();
  }
}

function setGauge(id, value, min, max) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  document.getElementById(`${id}Bar`).style.width = `${pct}%`;
}

/* ═══════════════════════════════════════════════════════════════
   GREENHOUSE SCENE
   ═══════════════════════════════════════════════════════════════ */

function updateGreenhouse() {
  const el = (id) => document.getElementById(id);
  const { temperature: t, humidity: h, soilMoisture: s, pump, windowAngle } = greenhouseState;

  el("vizTemp").textContent     = t.toFixed(1);
  el("vizHumidity").textContent = h.toFixed(0);
  el("vizSoil").textContent     = s.toFixed(0);
  el("vizPump").textContent     = pump === "HIGH" ? "ON" : "OFF";
  el("vizWindow").textContent   = windowAngle;

  const scene = document.getElementById("greenhouseScene");
  const plant = el("plant");
  const sun   = el("sunGlow");

  scene.classList.remove("hot-env", "normal-env", "humid-env", "dry-env");
  plant.classList.remove("healthy", "dry", "weak", "dying");

  // Plant health + scene atmosphere
  if (t >= 36 || s <= 10) {
    scene.classList.add("dry-env");
    plant.textContent = "🥀";
  } else if (t > 30 || s < 30) {
    scene.classList.add("hot-env");
    plant.textContent = "🌿";
  } else if (h > 75) {
    scene.classList.add("humid-env");
    plant.textContent = "🌱";
  } else {
    scene.classList.add("normal-env");
    plant.textContent = "🌱";
  }

  sun.classList.toggle("hot", t > 30);

  // Mist when humid
  el("mist").classList.toggle("active", h > 70);

  // Water droplets when pump on
  el("waterDrop").classList.toggle("active", pump === "HIGH");

  // Window servo angle visualised as CSS transform
  el("windowPane").style.transform = `rotateY(${windowAngle}deg)`;
}

/* ═══════════════════════════════════════════════════════════════
   SAMPLE PROFILE — Hot & Dry Weather
   ═══════════════════════════════════════════════════════════════ */

function loadHotDryProfile() {
  workspace.clear();

  // Build the rule programmatically via Blockly's API
  // Rule: IF temperature > 32 THEN pump ON + window 75°
  const ifBlock = workspace.newBlock("controls_if");
  ifBlock.initSvg();
  ifBlock.render();

  const compareBlock = workspace.newBlock("logic_compare");
  compareBlock.setFieldValue("GT", "OP");
  compareBlock.initSvg();
  compareBlock.render();

  const tempBlock = workspace.newBlock("get_temperature");
  tempBlock.initSvg();
  tempBlock.render();

  const numBlock = workspace.newBlock("math_number");
  numBlock.setFieldValue("32", "NUM");
  numBlock.initSvg();
  numBlock.render();

  const pumpBlock = workspace.newBlock("set_pump");
  pumpBlock.setFieldValue("HIGH", "PUMP_STATE");
  pumpBlock.initSvg();
  pumpBlock.render();

  const windowBlock = workspace.newBlock("set_window");
  windowBlock.setFieldValue("75", "WINDOW_ANGLE");
  windowBlock.initSvg();
  windowBlock.render();

  // Wire up connections
  compareBlock.getInput("A").connection.connect(tempBlock.outputConnection);
  compareBlock.getInput("B").connection.connect(numBlock.outputConnection);
  ifBlock.getInput("IF0").connection.connect(compareBlock.outputConnection);
  ifBlock.getInput("DO0").connection.connect(pumpBlock.previousConnection);
  pumpBlock.nextConnection.connect(windowBlock.previousConnection);

  ifBlock.moveBy(60, 60);

  // Simulate hot dry sensor readings
  greenhouseState.temperature  = 38;
  greenhouseState.humidity     = 38;
  greenhouseState.soilMoisture = 14;

  updateDashboard();
  pushChartData(38, 38, 14);

  toast("Hot & Dry profile loaded. Press Deploy to activate. 🌵", "warn");
}

/* ═══════════════════════════════════════════════════════════════
   EXPORT
   ═══════════════════════════════════════════════════════════════ */

function exportRules() {
  if (deployedRules.length === 0) {
    toast("No deployed rules to export. Deploy first.", "warn");
    return;
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    rules: deployedRules
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href     = URL.createObjectURL(blob);
  link.download = "greenhouse-rules.json";
  link.click();

  toast("Rules exported as JSON ⬇", "success");
}

/* ═══════════════════════════════════════════════════════════════
   LOG
   ═══════════════════════════════════════════════════════════════ */

const LOG_MAX_LINES = 100;

function appendLog(text) {
  const el = document.getElementById("runtimePreview");
  const lines = el.textContent.split("\n");

  if (lines.length > LOG_MAX_LINES) {
    lines.splice(0, lines.length - LOG_MAX_LINES);
    el.textContent = lines.join("\n");
  }

  el.textContent += (el.textContent ? "\n" : "") + text;
  el.scrollTop = el.scrollHeight;
}

/* ═══════════════════════════════════════════════════════════════
   CONNECTION STATUS
   ═══════════════════════════════════════════════════════════════ */

function setConnectionStatus(state) {
  const dot  = document.getElementById("statusDot");
  const label = document.getElementById("connectionStatus");

  dot.className = "status-dot";

  if (state === "connected") {
    dot.classList.add("connected");
    label.textContent = "Connected ✅";
  } else if (state === "demo") {
    dot.classList.add("demo");
    label.textContent = "Demo Mode 🌼";
  } else {
    dot.classList.add("error");
    label.textContent = "Disconnected ❌";
  }
}

/* ═══════════════════════════════════════════════════════════════
   TOAST NOTIFICATIONS
   ═══════════════════════════════════════════════════════════════ */

function Toast(message, type = "success") {
  let container = document.querySelector(".toast-container");

  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "fadeOut 0.35s ease forwards";

    setTimeout(() => {
      toast.remove();
    }, 350);
  }, 2500);
}

/* ═══════════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════════ */

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
