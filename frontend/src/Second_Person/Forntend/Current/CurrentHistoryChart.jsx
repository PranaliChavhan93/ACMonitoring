import React from "react";
import MetricHistoryChart from "../shared/MetricHistoryChart";

// Current history, read from the backend database (telemetry_aggregate).
const CONFIG = {
  metric: "current",
  title: "⚡ Current Consumption",
  subtitleDevice: "Current drawn by the selected AC",
  subtitleScope: "Average current per AC in the selected scope",
  seriesName: "Current",
  unit: "A",
  yLabel: "Current (A)",
  decimals: 3,
  color: "#3182BD",
};

// `data` is accepted for backwards compatibility; history no longer depends on it.
export default function CurrentHistoryChart({ deviceId = "", scope = {}, height = 280 }) {
  return <MetricHistoryChart config={CONFIG} deviceId={deviceId} scope={scope} height={height} />;
}
