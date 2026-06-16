/**
 * server.js — FarmLogic Orchestration Server
 *
 * Acts as the WebSocket hub between:
 *   - The web dashboard (browser)
 *   - The ESP32 Wokwi simulation (via ngrok WSS tunnel)
 *
 * Message flow:
 *   ESP32  → telemetry  → server → dashboard
 *   Dashboard → command → server → ESP32
 *
 * Run: node server/server.js
 * Then expose with: ngrok http 3000
 */

const express = require("express");
const http    = require("http");
const path    = require("path");
const cors    = require("cors");
const WebSocket = require("ws");

/* ─── Express ────────────────────────────────────────────────── */
const app = express();
app.use(cors());

// Serve the dashboard from /public (server.js lives in /server)
app.use(express.static(path.join(__dirname, "../public")));

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    clients: wss ? wss.clients.size : 0,
    telemetry: latestTelemetry,
    commands:  latestCommandState
  });
});

/* ─── HTTP + WebSocket Server ────────────────────────────────── */
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

/* ─── Shared State ───────────────────────────────────────────── */
let latestTelemetry = {
  temperature:  28,
  humidity:     65,
  soilMoisture: 45
};

let latestCommandState = {
  pump:   "LOW",
  window: 0
};

/* ─── Helpers ────────────────────────────────────────────────── */

/**
 * Normalise incoming telemetry payloads.
 * Accepts both "soilMoisture" (dashboard) and "soil" (legacy ESP32 key).
 */
function normalizeTelemetry(payload = {}) {
  return {
    temperature:  Number(payload.temperature  ?? 0),
    humidity:     Number(payload.humidity      ?? 0),
    soilMoisture: Number(payload.soilMoisture ?? payload.soil ?? 0)
  };
}

/**
 * Broadcast a JSON message to all connected clients except the sender.
 */
function broadcast(message, exceptClient = null) {
  const json = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client !== exceptClient && client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  });
}

/* ─── WebSocket Logic ────────────────────────────────────────── */
wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`✅ Client connected: ${ip}  [total: ${wss.clients.size}]`);

  // Immediately send latest known state to the new client
  ws.send(JSON.stringify({ type: "telemetry",     payload: latestTelemetry   }));
  ws.send(JSON.stringify({ type: "command_state", payload: latestCommandState }));

  ws.on("message", (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch (err) {
      console.error("❌ Invalid JSON:", raw.toString().slice(0, 200));
      return;
    }

    console.log("📩 Received:", JSON.stringify(data).slice(0, 120));

    /* ── Telemetry from ESP32 ── */
    if (data.type === "telemetry") {
      latestTelemetry = normalizeTelemetry(data.payload);
      console.log("🌡️  Telemetry:", latestTelemetry);

      // Forward normalised telemetry to all dashboards
      broadcast({ type: "telemetry", payload: latestTelemetry }, ws);
      return;
    }

    /* ── Command from Dashboard ── */
    if (data.type === "command") {
      if (data.actuator === "pump") {
        latestCommandState.pump = data.state;
        console.log(`⚙️  Pump → ${data.state}`);
      }
      if (data.actuator === "window") {
        latestCommandState.window = Number(data.angle ?? 0);
        console.log(`⚙️  Window → ${latestCommandState.window}°`);
      }

      // Forward command to all ESP32 devices (and other clients)
      broadcast({
        type:     "command",
        actuator: data.actuator,
        state:    data.state,
        angle:    data.angle
      }, ws);

      return;
    }

    console.warn("⚠️  Unknown message type:", data.type);
  });

  ws.on("close", () => {
    console.log(`⚠️  Client disconnected: ${ip}  [remaining: ${wss.clients.size}]`);
  });

  ws.on("error", (err) => {
    console.error(`❌ Client error (${ip}):`, err.message);
  });
});

/* ─── Start ──────────────────────────────────────────────────── */
const PORT = process.env.PORT ?? 3000;

server.listen(PORT, () => {
  console.log("\n╔═══════════════════════════════════════╗");
  console.log("║   🌱  FarmLogic Orchestrator Online   ║");
  console.log("╠═══════════════════════════════════════╣");
  console.log(`║  Dashboard : http://localhost:${PORT}     ║`);
  console.log(`║  WebSocket : ws://localhost:${PORT}       ║`);
  console.log("║                                       ║");
  console.log("║  To expose to Wokwi:                  ║");
  console.log(`║  $ ngrok http ${PORT}                    ║`);
  console.log("║  Then paste host into sketch.ino      ║");
  console.log("╚═══════════════════════════════════════╝\n");
});
