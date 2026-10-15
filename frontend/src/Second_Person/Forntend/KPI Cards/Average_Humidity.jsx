import React from "react";

function Average_Humidity({ value = 0 }) {
  return (
    <div className="kpi-card">
      <div className="kpi-icon">💧</div>

      <div className="kpi-content">
        <p>Avg. Humidity</p>

        <h2>{Number(value).toFixed(1)}%</h2>

        <span>Indoor Humidity</span>
      </div>
    </div>
  );
}

export default Average_Humidity;