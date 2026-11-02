import React, { useMemo } from "react";
import "./DeviceTelemetryTable.css";

const getTimestamp = (row) =>
  row.last_timestamp ||
  row.device_timestamp ||
  row.telemetry_timestamp ||
  row.timestamp ||
  row.bucket_start ||
  row.ts ||
  row.time;

const formatTimestamp = (value) => {
  if (!value) return "--";

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString();
};

const getValue = (row, ...keys) => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  return "--";
};

export default function DeviceTelemetryTable({ data = [], deviceId = "" }) {
  const latestRows = useMemo(() => {
    return [...data]
      .filter((row) => {
        const id = String(row.device_id || row.ac_id || "");
        return !deviceId || id === String(deviceId);
      })
      .sort((a, b) => {
        const timeA = new Date(getTimestamp(a) || 0).getTime();
        const timeB = new Date(getTimestamp(b) || 0).getTime();

        return timeB - timeA;
      })
      .slice(0, 10);
  }, [data, deviceId]);

  return (
    <section className="device-telemetry-panel">
      <div className="device-telemetry-heading">
        <div>
          <h2>Latest Telemetry</h2>
          <p>
            {deviceId ? `Device: ${deviceId}` : "Select an AC device"}
          </p>
        </div>

        <span className="device-telemetry-count">
          {latestRows.length} / 10 readings
        </span>
      </div>

      <div className="device-telemetry-table-wrap">
        <table className="device-telemetry-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>AC ID</th>
              <th>Voltage (V)</th>
              <th>Current (A)</th>
              <th>Power (W)</th>
              <th>Energy (kWh)</th>
              <th>Temperature (°C)</th>
              <th>Humidity (%)</th>
              <th>Frequency (Hz)</th>
              <th>Power Factor</th>
              <th>Alarm</th>
              <th>Relay</th>
            </tr>
          </thead>

          <tbody>
            {latestRows.length > 0 ? (
              latestRows.map((row, index) => (
                <tr key={`${getTimestamp(row)}-${index}`}>
                  <td>{formatTimestamp(getTimestamp(row))}</td>
                  <td>{row.device_id || row.ac_id || deviceId || "--"}</td>
                  <td>{getValue(row, "voltage", "avg_voltage")}</td>
                  <td>{getValue(row, "current", "avg_current")}</td>
                  <td>{getValue(row, "power", "avg_power")}</td>
                  <td>{getValue(row, "energy", "latest_energy_counter")}</td>
                  <td>
                    {getValue(row, "temperature", "indoor_temperature", "avg_temperature")}
                  </td>
                  <td>
                    {getValue(row, "humidity", "indoor_humidity", "avg_humidity")}
                  </td>
                  <td>{getValue(row, "frequency", "avg_frequency")}</td>
                  <td>{getValue(row, "power_factor", "avg_power_factor")}</td>
                  <td>{getValue(row, "alarm_status")}</td>
                  <td>{getValue(row, "relay", "latest_relay")}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="12" className="device-telemetry-empty">
                  No telemetry data available for this device.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}