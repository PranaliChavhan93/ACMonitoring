
import React from "react";
import MetricHistoryChart from "../shared/MetricHistoryChart";

function HumidityChart({
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
        metric: "humidity",
        title: "💧Humidity Monitoring",
        seriesName: "Indoor Humidity",
        subtitleDevice: "Selected AC · Historical humidity",
        subtitleScope: "Branch · Historical humidity",
        unit: "%",
        yLabel: "Humidity (%)",
        decimals: 1,
        color: "#3182bd",
        yDomain: [0, 100],
      }}
      deviceId={deviceId}
      scope={scope}
      height={280}
      outdoorData={data}
      outdoorKey="humidity"
      outdoorSeriesName="Outdoor Humidity"
      locationName={locationName}
      outdoorStatus={status}
      outdoorError={error}
    />
  );
}

export default HumidityChart;
