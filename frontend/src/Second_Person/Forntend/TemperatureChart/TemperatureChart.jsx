
import React from "react";
import MetricHistoryChart from "../shared/MetricHistoryChart";

function TemperatureChart({
  deviceId = "",
  scope = {},
  data = [],
  locationName = "",
  status = "idle",
  error = "",
}) {
  return (
    <MetricHistoryChart
      config={{
        metric: "temperature",
        title: "🌡️ Temperature Monitoring",
        seriesName: "Indoor Temperature",
        subtitleDevice: "Selected AC · Historical temperature",
        subtitleScope: "Branch · Historical temperature",
        unit: "°C",
        yLabel: "Temperature (°C)",
        decimals: 1,
        color: "#3182bd",
        yDomain: ["auto", "auto"],
      }}
      deviceId={deviceId}
      scope={scope}
      height={280}
      outdoorData={data}
      outdoorKey="temperature"
      outdoorSeriesName="Outdoor Temperature"
      locationName={locationName}
      outdoorStatus={status}
      outdoorError={error}
    />
  );
}

export default TemperatureChart;
