/**
 * blocks.js — Custom Blockly Block Definitions
 *
 * Defines farmer-friendly semantic blocks for:
 *   Sensors  : get_temperature, get_humidity, get_soil_moisture
 *   Actuators: set_pump, set_window
 *
 * Blocks are visually distinct from default Blockly blocks
 * and use domain language a non-technical farmer understands.
 */

Blockly.defineBlocksWithJsonArray([

  /* ── SENSOR: Temperature ──────────────────────────────────── */
  {
    type: "get_temperature",
    message0: "🌡️ Temperature (°C)",
    output: "Number",
    colour: "#dc2626",
    tooltip: "Returns the current greenhouse temperature in degrees Celsius.",
    helpUrl: ""
  },

  /* ── SENSOR: Humidity ─────────────────────────────────────── */
  {
    type: "get_humidity",
    message0: "💧 Air Humidity (%)",
    output: "Number",
    colour: "#0284c7",
    tooltip: "Returns the current relative humidity percentage (0–100).",
    helpUrl: ""
  },

  /* ── SENSOR: Soil Moisture ────────────────────────────────── */
  {
    type: "get_soil_moisture",
    message0: "🌱 Soil Moisture (%)",
    output: "Number",
    colour: "#15803d",
    tooltip: "Returns the current soil moisture percentage (0 = bone dry, 100 = saturated).",
    helpUrl: ""
  },

  /* ── ACTUATOR: Water Pump ─────────────────────────────────── */
  {
    type: "set_pump",
    message0: "🌊 Turn Water Pump %1",
    args0: [
      {
        type: "field_dropdown",
        name: "PUMP_STATE",
        options: [
          ["ON  ▶", "HIGH"],
          ["OFF ■", "LOW"]
        ]
      }
    ],
    previousStatement: null,
    nextStatement: null,
    colour: "#1d4ed8",
    tooltip: "Turns the greenhouse water pump on or off.",
    helpUrl: ""
  },

  /* ── ACTUATOR: Ventilation Window ─────────────────────────── */
  {
    type: "set_window",
    message0: "🪟 Open Vent Window %1 °",
    args0: [
      {
        type: "field_number",
        name: "WINDOW_ANGLE",
        value: 45,
        min: 0,
        max: 90,
        precision: 1
      }
    ],
    previousStatement: null,
    nextStatement: null,
    colour: "#7c3aed",
    tooltip: "Sets the ventilation window servo angle (0° = closed, 90° = fully open).",
    helpUrl: ""
  }

]);
