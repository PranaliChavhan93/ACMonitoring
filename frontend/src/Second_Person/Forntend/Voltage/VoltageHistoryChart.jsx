import React from "react";
import MetricHistoryChart from "../shared/MetricHistoryChart";

// Voltage history, read from the backend database (telemetry_aggregate).
const CONFIG = {
  metric: "voltage",
  title: "⚡ Voltage History",
  subtitleDevice: "Voltage supplied to the selected AC",
  subtitleScope: "Average voltage per AC in the selected scope",
  seriesName: "Voltage",
  unit: "V",
  yLabel: "Voltage (V)",
  decimals: 1,
  color: "#3182BD",
  // A device that is off is drawn as 0 V, so the axis starts at 0.
};

// `data` is accepted for backwards compatibility; history no longer depends on it.
export default function VoltageHistoryChart({ deviceId = "", scope = {}, height = 280 }) {
  return <MetricHistoryChart config={CONFIG} deviceId={deviceId} scope={scope} height={height} />;
}
