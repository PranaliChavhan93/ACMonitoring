import React from "react";
import MetricHistoryChart from "../shared/MetricHistoryChart";

const CONFIG = {
  metric: "current",
  title: "⚡ Current History",
  subtitleDevice: "Current drawn by the selected AC",
  subtitleScope: "Average current per AC in the selected scope",
  seriesName: "Current",
  unit: "A",
  yLabel: "Current (A)",
  decimals: 3,
  color: "#3182BD",
};

function CurrentHistoryChart({ 
  deviceId = "", 
  scope = {}, 
  height = 280 }) {
  return (
    <MetricHistoryChart 
      config={CONFIG} 
      deviceId={deviceId} 
      scope={scope} 
      height={height} 
    />
  )
}

export default CurrentHistoryChart;