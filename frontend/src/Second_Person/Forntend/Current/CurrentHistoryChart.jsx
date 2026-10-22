import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

import {
  PERIODS,
  buildSeries,
  formatLabel,
  formatTick,
  getRange,
  liveSample,
  makeTicks,
  normalizeRows,
  rowsToPoints,
  summarize,
} from "./currentHistory";

import { Maximize2, X } from "lucide-react";

const CURRENT_HISTORY_URL = "http://localhost:8000/api/current-history/";

const REFRESH_MS = 60_000;
const MAX_LIVE_POINTS = 10_000;

const getToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("authToken") ||
  localStorage.getItem("access_token") ||
  localStorage.getItem("accessToken") ||
  "";

const getDeviceId = (row) =>
  String(
    row?.tpt_device_id ??
      row?.thingsboard_device_id ??
      row?.device_id ??
      row?.ac_id ??
      ""
  );


async function fetchHistoryRows({
  deviceId,
  scope,
  period,
  from,
  to,
  signal,
}) {
  const params = new URLSearchParams({
    period,
    from: String(from.getTime()),
    to: String(to.getTime()),
  });

  if (deviceId) {
    params.set("device_id", deviceId);
  } else {
    Object.entries(scope || {}).forEach(([key, value]) => {
      if (typeof value === "string" && value) {
        params.set(key, value);
      }
    });
  }

  const token = getToken();

  const response = await fetch(
    `${CURRENT_HISTORY_URL}?${params.toString()}`,
    {
      headers: token
        ? { Authorization: `Bearer ${token}` }
        : {},
      cache: "no-store",
      signal,
    }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      result?.message || result?.detail || `HTTP ${response.status}`
    );
  }

  return normalizeRows(result);
}

function getViewRange(viewMode, selectedHour, now = new Date()) {
  if (viewMode === "last-hour") {
    const to = now.getTime();
    return { from: to - 60 * 60 * 1000, to };
  }

  if (viewMode === "selected-hour") {
    const from = new Date(now);
    from.setHours(selectedHour, 0, 0, 0);

    const end = new Date(from);
    end.setHours(end.getHours() + 1);

    return {
      from: from.getTime(),
      to: Math.min(end.getTime(), now.getTime()),
    };
  }

  return getRange(viewMode, now);
}


function CurrentHistoryChart({ data = [], deviceId = "", scope = {}, height = 280 }) {
  const [historyPoints, setHistoryPoints] = useState([]);
  const [livePoints, setLivePoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  
  const [viewMode, setViewMode] = useState("today");
  const [selectedHour, setSelectedHour] = useState(
    new Date().getHours()
  );

  const hourOptions = Array.from({ length: 24 }, (_, hour) => ({
    value: hour,
    label: `${String(hour).padStart(2, "0")}:00 – ${String(
      (hour + 1) % 24
    ).padStart(2, "0")}:00`,
  }));

  const [expanded, setExpanded] = useState(false);
  // Device(s) currently in scope. Live samples are cleared when this changes.
  const scopeKey = useMemo(
    () => deviceId || rows.map(getDeviceId).sort().join("|"),
    [deviceId, rows]
  );
  const scopeKeyRef = useRef(scopeKey);

  /* ----- live: one sample every time the dashboard receives new data ----- */
  useEffect(() => {
    const sample = liveSample(rows);
    const scopeChanged = scopeKeyRef.current !== scopeKey;
    scopeKeyRef.current = scopeKey;

    setLivePoints((prev) => {
      const base = scopeChanged ? [] : prev;
      return sample ? [...base, sample].slice(-MAX_LIVE_POINTS) : base;
    });
  }, [rows, scopeKey]);

  /* ----- history: fetch for the selected period ----- */
  const scopeJson = JSON.stringify(scope || {});


  const chartPeriod =
    viewMode === "week" || viewMode === "month"
      ? viewMode
      : "today";

  const range = useMemo(
    () => getViewRange(viewMode, selectedHour),
    [viewMode, selectedHour, tick]
  );

  const load = useCallback(
    async (signal) => {
      setLoading(true);

      try {
        const result = await fetchHistoryRows({
          deviceId,
          scope: JSON.parse(scopeJson),
          period: chartPeriod,
          from: range.from,
          to: range.to,
          signal,
        });

        setHistoryPoints(rowsToPoints(result));
        setError("");
      } catch (err) {
        if (err.name === "AbortError") return;

        setHistoryPoints([]);
        setError(err.message || "Unable to load current history.");
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [deviceId, scopeJson, chartPeriod, range.from, range.to]
  );

  useEffect(() => {
    setHistoryPoints([]);

    const controller = new AbortController();
    load(controller.signal);

    const timer = window.setInterval(() => {
      load(controller.signal);
    }, REFRESH_MS);

    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [load]);


  useEffect(() => {
    setHistoryPoints([]);
    const controller = new AbortController();
    load(controller.signal);

    const timer = window.setInterval(() => {
      load(controller.signal);
      setTick((n) => n + 1);
    }, REFRESH_MS);

    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [load]);

  /* ----- chart data ----- */
  
const { series, ticks } = useMemo(() => {
  const now = new Date();
  const merged = [...historyPoints, ...livePoints];

  const allSeries = buildSeries(merged, chartPeriod, now);

  const filtered = allSeries.filter(
    (point) =>
      point.t >= range.from &&
      point.t <= range.to
  );

  let chartTicks;

  if (viewMode === "last-hour" || viewMode === "selected-hour") {
    const step = 10 * 60 * 1000;
    chartTicks = [];

    for (
      let t = Math.ceil(range.from / step) * step;
      t <= range.to;
      t += step
    ) {
      chartTicks.push(t);
    }
  } else {
    chartTicks = makeTicks(chartPeriod, range.from, range.to);
  }

  return {
    series: filtered,
    ticks: chartTicks,
  };
}, [
  historyPoints,
  livePoints,
  chartPeriod,
  range,
  viewMode,
  tick,
]);

const stats = useMemo(() => summarize(series), [series]);

const liveOnly = Boolean(error) && series.length > 0;

const placeholder = loading && !series.length
  ? "Loading current history…"
  : error && !series.length
  ? error
  : "No current readings for this period yet.";


  return (
      <div
        className={`chart-box current-history-card ${
          expanded ? "current-history-expanded" : ""
        }`}
      >
      <div className="chart-header">
        <div>
          <h3>⚡ Current consumption</h3>
          <span>
            {deviceId
              ? "Current drawn by the selected AC"
              : "Average current per AC in the selected scope"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* {latest !== null && (
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: COLORS.avg,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {latest.toFixed(3)} A
            </span>
          )} */}
          
          <select
            className="chart-select"
            value={viewMode}
            onChange={(e) => {
              setViewMode(e.target.value);
              setTick((n) => n + 1);
            }}
            aria-label="Graph time range"
          >
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="last-hour">Last 60 minutes</option>
            <option value="selected-hour">Select hour</option>
          </select>

          {viewMode === "selected-hour" && (
            <select
              className="chart-select"
              value={selectedHour}
              onChange={(e) => setSelectedHour(Number(e.target.value))}
              aria-label="Select hour"
            >
              {hourOptions.map((hour) => (
                <option key={hour.value} value={hour.value}>
                  {hour.label}
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

      {stats && (
        <div
          style={{
            display: "flex",
            gap: 16,
            fontSize: 12,
            color: "#64748b",
            margin: "0 0 6px",
            fontVariantNumeric: "tabular-nums",
          }}
        >
        </div>
      )}

      {series.length ? (
        <ResponsiveContainer
          width="100%"
          height={expanded ? 520 : height}
        >
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={[range.from, range.to]}
              ticks={ticks}
              tickFormatter={(t) => formatTick(t, chartPeriod)}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              width={60}
              tick={{ fontSize: 11 }}
              domain={[0, "auto"]}
              tickFormatter={(v) => Number(v).toFixed(2)}
              label={{
                value: "Current (A)",
                angle: -90,
                position: "insideLeft",
                fontSize: 11,
              }}
            />
            <Tooltip
              labelFormatter={(t) => formatLabel(t, chartPeriod)}
              formatter={(value, name) => [
                `${Number(value).toFixed(3)} A`,
                name,
              ]}
            />
            <Legend />

            <Line
              type="monotone"
              dataKey="avg"
              name="Current"
              stroke="#3182BD"
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
            color: "#64748b",
            fontSize: 13,
          }}
        >
          {placeholder}
        </div>
      )}

      {liveOnly && (
        <small style={{ display: "block", color: "#b45309", marginTop: 4 }}>
          History is unavailable ({error}). Showing live readings collected since this page opened.
        </small>
      )}
    </div>
  );
}

export default CurrentHistoryChart;
