const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const WebSocket = require("ws");

const app = express();
app.use(cors());

// Serves front-end assets located in the parent directory of this server script
app.use(express.static(path.join(__dirname, "../")));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let latestTelemetry = {
  temperature: 28,
  humidity: 65,
  soilMoisture: 45
};

let latestCommandState = {
  pump: "OFF",
  window: 0
};

function broadcast(message, exceptClient = null) {
  const payload = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client !== exceptClient && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

wss.on("connection", (ws) => {
  console.log("✅ WebSocket client connected to FarmLogic Hub");

  ws.send(JSON.stringify({ type: "telemetry", payload: latestTelemetry }));
  ws.send(JSON.stringify({ type: "command_state", payload: latestCommandState }));

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === "telemetry") {
        latestTelemetry = { ...latestTelemetry, ...data.payload };
        broadcast(data, ws);
      }
      if (data.type === "command") {
        if (data.actuator === "pump") latestCommandState.pump = data.state;
        if (data.actuator === "window") latestCommandState.window = data.angle;
        broadcast(data, ws);
      }
    } catch (error) {
      console.error("❌ Invalid WebSocket message payload:", error.message);
    }
  });

  ws.on("close", () => {
    console.log("⚠️ WebSocket client disconnected");
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`\n🌱 FarmLogic Orchestrator online!`);
  console.log(`🖥️  Dashboard accessible at: http://localhost:${PORT}`);
});