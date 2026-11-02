import React, { useMemo } from "react";

const value = (item, ...keys) => {
  for (const key of keys) {
    if (item?.[key] !== undefined && item?.[key] !== null && item?.[key] !== "") return item[key];
  }
  return "—";
};
const numeric = (item, ...keys) => {
  const raw = value(item, ...keys);
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

function ACDeviceTable({ data = [] }) {
  const rows = useMemo(() => (Array.isArray(data) ? data : []).map((item, index) => ({
    key: value(item, "device_id", "tpt_device_id", "id", "ac_id") || index,
    id: value(item, "ac_id", "device_name", "device_id", "id"),
    status: String(value(item, "relay", "status", "ac_status", "state")).toLowerCase(),
    energy: numeric(item, "energy_consumption", "energy", "kwh", "kWh"),
    power: numeric(item, "active_power", "power", "Power"),
    voltage: numeric(item, "voltage", "Voltage"),
    current: numeric(item, "current", "Current"),
    temperature: numeric(item, "indoor_temperature", "indoor_temp", "temperature", "temp"),
    humidity: numeric(item, "indoor_humidity", "humidity"),
    timestamp: value(item, "timestamp", "ts", "last_updated", "time"),
  })), [data]);

  return (
    <div className="chart-box table-chart-box">
      <div className="chart-header">
        <div><h3>AC Units in Current Scope</h3><span>Live telemetry available for the selected location</span></div>
      </div>
      {rows.length === 0 ? <div className="chart-empty">No AC telemetry available for this location.</div> : (
        <div className="table-wrapper">
          <table className="ac-table ac-device-table">
            <thead><tr><th>AC / Device</th><th>Status</th><th>Energy (kWh)</th><th>Power (W)</th><th>Voltage (V)</th><th>Current (A)</th><th>Temp (°C)</th><th>Humidity (%)</th><th>Timestamp</th></tr></thead>
            <tbody>{rows.map((row) => {
              const onlineState = ["1", "on", "active", "running", "true"].includes(row.status);
              return <tr key={row.key}>
                <td className="branch-name">{row.id}</td>
                <td><span className={`ac-device-status ${onlineState ? "is-on" : "is-off"}`}>{row.status === "—" ? "Unknown" : row.status}</span></td>
                <td>{row.energy === null ? "—" : row.energy.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                <td>{row.power === null ? "—" : row.power.toFixed(2)}</td>
                <td>{row.voltage === null ? "—" : row.voltage.toFixed(1)}</td>
                <td>{row.current === null ? "—" : row.current.toFixed(2)}</td>
                <td>{row.temperature === null ? "—" : row.temperature.toFixed(1)}</td>
                <td>{row.humidity === null ? "—" : row.humidity.toFixed(1)}</td>
                <td>{row.timestamp === "—" ? "—" : String(row.timestamp)}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ACDeviceTable