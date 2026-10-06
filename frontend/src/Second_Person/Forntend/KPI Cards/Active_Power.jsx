import React from "react";

function Active_Power({ value = 0 }) {
  return (
    <div className="kpi-card">
      <div className="kpi-icon">⚡</div>

      <div className="kpi-content">
        <p>Active Power</p>

        <h2>{Number(value).toFixed(2)}</h2>

        <span>W</span>
      </div>
    </div>
  );
}

export default Active_Power;