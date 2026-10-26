import React, { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Maximize2, X } from "lucide-react";

import {
  VIEW_MODES,
  buildSeries,
  formatLabel,
  formatTick,
  makeTicks,
} from "./metricHistory";
import { useMetricHistory } from "./useMetricHistory";

const pad2 = (n) => String(n).padStart(2, "0");

/**
 * Generic history line chart backed by the database.
 *
 * config: { metric, title, subtitleDevice, subtitleScope, seriesName, unit,
 *           yLabel, decimals, color, yDomain }
 */
export default function MetricHistoryChart({
  config,
  deviceId = "",
  scope = {},
  height = 280,
}) {
  const [viewMode, setViewMode] = useState("last-24-hours");
  const [selectedHour, setSelectedHour] = useState(() => new Date().getHours());
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  });
  const [customTo, setCustomTo] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  });
  const [expanded, setExpanded] = useState(false);

  const { points, range, loading, error, updatedAt } = useMetricHistory({
    metric: config.metric,
    viewMode,
    selectedHour,
    customFrom: viewMode === "custom" ? customFrom : "",
    customTo: viewMode === "custom" ? customTo : "",
    deviceId,
    scope,
  });

  const chartMode = viewMode === "custom"
    ? (range.to - range.from > 2 * 24 * 60 * 60 * 1000 ? "month" : "week")
    : viewMode;
  const series = useMemo(() => buildSeries(points, chartMode, range), [points, chartMode, range]);
  const ticks = useMemo(() => makeTicks(chartMode, range), [chartMode, range]);
  const hasData = series.some((p) => p.count > 0);

  // Only hours that have started can be picked (future hours have no data).
  const currentHour = new Date().getHours();
  const hourOptions = Array.from({ length: 24 }, (_, hour) => ({
    value: hour,
    label: `${pad2(hour)}:00 – ${pad2((hour + 1) % 24)}:00`,
    disabled: hour > currentHour,
  }));

  const placeholder = loading
    ? `Loading ${config.seriesName.toLowerCase()} history…`
    : error
    ? error
    : `No ${config.seriesName.toLowerCase()} readings stored for this period.`;

  return (
    <div className={`chart-box current-history-card ${expanded ? "current-history-expanded" : ""}`}>
      <div className="chart-header">
        <div>
          <h3>{config.title}</h3>
          <span>{deviceId ? config.subtitleDevice : config.subtitleScope}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <select
            className="chart-select"
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            aria-label="Graph time range"
          >
            {VIEW_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          {viewMode === "custom" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <input
                className="chart-select"
                type="date"
                aria-label="History start date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <span style={{ color: "#64748b", fontSize: 12 }}>to</span>
              <input
                className="chart-select"
                type="date"
                aria-label="History end date"
                value={customTo}
                min={customFrom || undefined}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          )}

          {viewMode === "selected-hour" && (
            <select
              className="chart-select"
              value={Math.min(selectedHour, currentHour)}
              onChange={(e) => setSelectedHour(Number(e.target.value))}
              aria-label="Select hour"
            >
              {hourOptions.map((h) => (
                <option key={h.value} value={h.value} disabled={h.disabled}>
                  {h.label}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            className="chart-expand-btn"
            onClick={() => setExpanded((prev) => !prev)}
            title={expanded ? "Restore Window" : "Expand Window"}
            aria-label={expanded ? "Restore Window" : "Expand Window"}
          >
            {expanded ? <X size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      {hasData ? (
        <ResponsiveContainer width="100%" height={expanded ? 520 : height}>
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={[range.from, range.to]}
              ticks={ticks}
              allowDataOverflow
              tickFormatter={(t) => formatTick(t, chartMode)}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              width={60}
              tick={{ fontSize: 11 }}
              domain={config.yDomain || [0, "auto"]}
              tickFormatter={(v) => Number(v).toFixed(config.decimals)}
              label={{ value: config.yLabel, angle: -90, position: "insideLeft", fontSize: 11 }}
            />
            <Tooltip
              labelFormatter={(t) => formatLabel(t, chartMode)}
              formatter={(value, name) => [`${Number(value).toFixed(config.decimals)} ${config.unit}`, name]}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="avg"
              name={config.seriesName}
              stroke={config.color}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div
          style={{
            minHeight: height,
            display: "grid",
            placeItems: "center",
            padding: 16,
            textAlign: "center",
            color: error ? "#b45309" : "#64748b",
            fontSize: 13,
          }}
        >
          {placeholder}
        </div>
      )}

      {hasData && error && (
        <small style={{ display: "block", color: "#b45309", marginTop: 4 }}>
          Couldn’t refresh ({error}). Showing the last data loaded.
        </small>
      )}
      {viewMode === "custom" && (
        <small style={{ display: "block", color: "#64748b", marginTop: 4 }}>
          Select any saved date range (backend limit: 93 days per request). Older data appears only if it was stored by the backend.
        </small>
      )}
      {hasData && !error && updatedAt && (
        <small style={{ display: "block", color: "#94a3b8", marginTop: 4, textAlign: "right" }}>
          Updated {new Date(updatedAt).toLocaleTimeString([], { hour12: false })}
        </small>
      )}
    </div>
  );
}
