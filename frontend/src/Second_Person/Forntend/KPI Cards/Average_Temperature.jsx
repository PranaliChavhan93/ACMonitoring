import React from "react";

function Average_Temperature({ value = 0 }) {
  return (
    <div className="kpi-card">
      <div className="kpi-icon">🌡️</div>

      <div className="kpi-content">
        <p>Avg. Temperature</p>

        <h2>{Number(value).toFixed(1)}°C</h2>

        <span>Indoor Temperature</span>
      </div>
    </div>
  );
}

export default Average_Temperature;