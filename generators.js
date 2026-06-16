/**
 * generators.js — Custom JavaScript Code Generators
 *
 * Maps each custom block type to the JavaScript string it emits
 * when the workspace is compiled via Blockly's JS generator.
 *
 * Generated code calls into the live greenhouse* API objects
 * that are wired up in engine.js (greenhouseSensors / greenhouseActuators).
 */

/* ── SENSOR GENERATORS (return [expression, precedence]) ────── */

javascript.javascriptGenerator.forBlock["get_temperature"] = function () {
  return [
    "greenhouseSensors.getTemperature()",
    javascript.Order.ATOMIC
  ];
};

javascript.javascriptGenerator.forBlock["get_humidity"] = function () {
  return [
    "greenhouseSensors.getHumidity()",
    javascript.Order.ATOMIC
  ];
};

javascript.javascriptGenerator.forBlock["get_soil_moisture"] = function () {
  return [
    "greenhouseSensors.getSoilMoisture()",
    javascript.Order.ATOMIC
  ];
};

/* ── ACTUATOR GENERATORS (return statement string) ──────────── */

javascript.javascriptGenerator.forBlock["set_pump"] = function (block) {
  const state = block.getFieldValue("PUMP_STATE");
  return `greenhouseActuators.setPumpState("${state}");\n`;
};

javascript.javascriptGenerator.forBlock["set_window"] = function (block) {
  const angle = Number(block.getFieldValue("WINDOW_ANGLE"));
  return `greenhouseActuators.setWindowAngle(${angle});\n`;
};
