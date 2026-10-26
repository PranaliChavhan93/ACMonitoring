import React, { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { buildSeries, formatTick, makeTicks } from "./shared/metricHistory";
import { useMetricHistory } from "./shared/useMetricHistory";

const DEFAULT_WINDOW_MINUTES = 60;
const DEFAULT_REFRESH_MS = 10_000; // re-read the DB every 10 s

const toNumber = (value) => {
  const n = Number(value);
  return value === null || value === undefined || value === "" || !Number.isFinite(n) ? 0 : n;
};

/**
 * Live active-power graph.
 *
 * The line is read from the backend database (the per-minute telemetry
 * aggregates that ingest already stores) and refreshed every few seconds, so
 * it survives page reloads and never calls ThingsBoard/3TP.  The number in the
 * header is the same `value` the Active Power KPI card shows.
 */
function CurrentFluctuationChart({
  value = 0,
  deviceId = "",
  scope = {},
  windowMinutes = DEFAULT_WINDOW_MINUTES,
  refreshMs = DEFAULT_REFRESH_MS,

  unit = "W",
  lineColor = "#3182BD",
  title = "⚡ Active Power",
  seriesLabel = "Power",
  yAxisLabel = "Active Power (W)",
  height = 250,
}) {
  const { points, range, loading, error } = useMetricHistory({
    metric: "power",
    agg: "sum", // total power of the ACs in scope, like the KPI card
    deviceId,
    scope,
    windowMs: windowMinutes * 60_000,
    refreshMs,
  });

  const series = useMemo(() => buildSeries(points, "last-hour", range), [points, range]);
  const ticks = useMemo(() => makeTicks("last-hour", range), [range]);
  const hasData = series.some((p) => p.count > 0);

  return (
    <div className="chart-box">
      <div className="chart-header">
        <h3>{title}</h3>
        <span style={{ fontSize: 13, fontWeight: 600, color: lineColor, fontVariantNumeric: "tabular-nums" }}>
          {toNumber(value).toFixed(2)} {unit}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[range.from, range.to]}
            ticks={ticks}
            allowDataOverflow
            tickFormatter={(t) => formatTick(t, "last-hour")}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            label={{ value: yAxisLabel, angle: -90, position: "insideLeft", fontSize: 11 }}
            domain={[0, "auto"]}
            width={56}
          />
          <Tooltip
            formatter={(v) => [`${Number(v).toFixed(2)} ${unit}`, seriesLabel]}
            labelFormatter={(t) => `Time: ${formatTick(t, "last-hour")}`}
          />
          <Line
            type="monotone"
            dataKey="avg"
            name={seriesLabel}
            stroke={lineColor}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>

      {!hasData && (
        <div style={{ textAlign: "center", fontSize: 12, color: error ? "#b45309" : "#94a3b8", marginTop: 6 }}>
          {loading
            ? "Loading stored readings…"
            : error || `No readings stored in the last ${windowMinutes} minutes.`}
        </div>
      )}
    </div>
  );
}

export default CurrentFluctuationChart;
