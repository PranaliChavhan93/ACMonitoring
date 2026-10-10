import React from "react";
import "./dashboard-insight.css";

export default function DashboardInsight({ insight, fallback }) {
  const text = (typeof insight === "string" && insight.trim()) ? insight.trim() : fallback;
  return (
    <div className="dashboard-insight" title="Short dashboard insight">
      <span className="dashboard-insight-label">AI Insight</span>
      <p>{text || "Analysis is not available yet."}</p>
    </div>
  );
}
