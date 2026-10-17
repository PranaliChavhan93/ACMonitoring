import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

const API_URL = "http://localhost:8000/api/telemetry-aggregates/";

const TB_HISTORY_URL = "http://localhost:8000/api/thingsboard/history/";

const STALE_REFRESH_MS = 60000;
const FALLBACK_REFRESH_MS = 5 * 60 * 1000; // don’t hammer ThingsBoard
const PRIMARY_WINDOW_MS = 31 * 24 * 60 * 60 * 1000; // match backend cap

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const GRANULARITY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const pad2 = (n) => String(n).padStart(2, "0");

const getToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("authToken") ||
  localStorage.getItem("access_token") ||
  localStorage.getItem("accessToken") ||
  "";

/* ---------------- data helpers ---------------- */

function parseDate(item) {
  const raw =
    item?.timestamp ?? item?.ts ?? item?.date ??
    item?.created_at ?? item?.bucket_start;

  if (raw === undefined || raw === null) return null;

  const value =
    typeof raw === "number" || /^\d+$/.test(String(raw))
      ? Number(raw)
      : raw;

  const date =
    typeof value === "number"
      ? new Date(value < 1e12 ? value * 1000 : value)
      : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getEnergy(item) {
  const candidates = [
    item?.energy_consumption,
    item?.energy_avg,
    item?.energy_average,
    item?.avg_energy,
    item?.energy,
    item?.avg?.energy,
    item?.average?.energy,
    item?.values?.energy,
    item?.kwh,
  ];

  for (const value of candidates) {
    if (value !== undefined && value !== null && value !== "") {
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
  }
  return null;
}

function getStartOfDay(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}

function getChartRange(granularity, now = new Date()) {
  const today = getStartOfDay(now);

  if (granularity === "daily") {
    return {
      from: today,
      to: new Date(today.getTime() + 24 * 60 * 60 * 1000),
    };
  }

  if (granularity === "weekly") {
    const from = new Date(today);
    from.setDate(from.getDate() - 7);

    return {
      from,
      to: new Date(today.getTime() + 24 * 60 * 60 * 1000),
    };
  }

  return {
    from: new Date(today.getFullYear(), today.getMonth(), 1),
    to: new Date(today.getTime() + 24 * 60 * 60 * 1000),
  };
}

// function buildChartData(rows, granularity, now = new Date()) {
//   const { from, to } = getChartRange(granularity, now);
//   const buckets = new Map();

//   const makeBucket = (date) => {
//     if (granularity === "daily") {
//       const hour = date.getHours();
//       const start = new Date(date);
//       start.setMinutes(0, 0, 0);

//       return {
//         key: String(start.getTime()),
//         name: `${String(hour).padStart(2, "0")}:00`,
//         sort: start.getTime(),
//       };
//     }

//     const start = getStartOfDay(date);
//     const key =
//       `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;

//     return {
//       key,
//       name: `${start.getDate()} ${MONTH_NAMES[start.getMonth()]}`,
//       sort: start.getTime(),
//     };
//   };

//   // Create every expected interval, including intervals without readings.
//   const cursor = new Date(from);

//   while (cursor < to) {
//     const bucket = makeBucket(cursor);

//     buckets.set(bucket.key, {
//       name: bucket.name,
//       sort: bucket.sort,
//       sum: 0,
//       count: 0,
//       currentMonth: null,
//       previousMonth: null,
//     });

//     if (granularity === "daily") {
//       cursor.setHours(cursor.getHours() + 1);
//     } else {
//       cursor.setDate(cursor.getDate() + 1);
//     }
//   }

//   // Merge multiple readings into their matching hour/day.
//   rows.forEach((item) => {
//     const date = parseDate(item);
//     const energy = getEnergy(item);

//     if (!date || energy === null || date < from || date >= to) {
//       return;
//     }

//     const bucket = makeBucket(date);
//     const entry = buckets.get(bucket.key);

//     if (!entry) return;

//     entry.sum += energy;
//     entry.count += 1;
//   });

//   return [...buckets.values()]
//     .sort((a, b) => a.sort - b.sort)
//     .map(({ name, sum, count }) => ({
//       name,
//       currentMonth: count
//         ? Number((sum / count).toFixed(2))
//         : null,
//       previousMonth: null,
//     }));
// }

function getBucket(date, granularity) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();

  if (granularity === "monthly") {
    return {
      key: `${y}-${pad2(m + 1)}`,
      label: `${MONTH_NAMES[m]} ${y}`,
      sort: new Date(y, m, 1).getTime(),
    };
  }

  if (granularity === "weekly") {
    const start = new Date(y, m, d);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return {
      key: `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`,
      label: `Wk ${start.getDate()} ${MONTH_NAMES[start.getMonth()]}`,
      sort: start.getTime(),
    };
  }

  return {
    key: `${y}-${pad2(m + 1)}-${pad2(d)}`,
    label: `${d} ${MONTH_NAMES[m]}`,
    sort: new Date(y, m, d).getTime(),
  };
}

function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ["results", "data", "records", "items"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

function buildChartData(rows, granularity) {
  const buckets = new Map();

  rows.forEach((item) => {
    const date = parseDate(item);
    const energy = getEnergy(item);
    if (!date || energy === null) return;

    const bucket = getBucket(date, granularity);
    if (!buckets.has(bucket.key)) {
      buckets.set(bucket.key, {
        name: bucket.label,
        sort: bucket.sort,
        currentMonth: 0,
        previousMonth: 0,
      });
    }
    buckets.get(bucket.key).currentMonth += energy;
  });

  return [...buckets.values()]
    .sort((a, b) => a.sort - b.sort)
    .map(({ name, currentMonth, previousMonth }) => ({
      name,
      currentMonth: Number(currentMonth.toFixed(2)),
      previousMonth: Number(previousMonth.toFixed(2)),
    }));
}

/* ---------------- network helpers ---------------- */

async function fetchFromAggregates(from, to) {
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  });

  const token = getToken();
  const response = await fetch(`${API_URL}?${params.toString()}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    cache: "no-store",
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.message || result?.detail || `HTTP ${response.status}`);
  }
  return normalizeRows(result);
}

async function fetchFromThingsBoard() {
  const now = Date.now();

  // Wide-open range. The backend clamps to what ThingsBoard actually has.
  const params = new URLSearchParams({
    from: "0",
    to: String(now),
  });

  const token = getToken();
  const response = await fetch(`${TB_HISTORY_URL}?${params.toString()}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    cache: "no-store",
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.message || result?.detail || `HTTP ${response.status}`);
  }
  return normalizeRows(result);
}

/* ---------------- UI bits ---------------- */

const iconButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 30,
  height: 30,
  padding: 0,
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  background: "#fff",
  color: "#475569",
  cursor: "pointer",
};

const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  display: "flex",
  padding: 24,
  boxSizing: "border-box",
  background: "rgba(15, 23, 42, 0.55)",
};

const modalStyle = {
  margin: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  width: "min(1200px, 100%)",
  height: "min(760px, 100%)",
  padding: "20px 24px 16px",
  boxSizing: "border-box",
  background: "#fff",
  borderRadius: 14,
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
  overflow: "hidden",
};

function EnergyConsumptionChart({ data }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [granularity, setGranularity] = useState("daily");
  const [historyRows, setHistoryRows] = useState([]);
  const [usingFallback, setUsingFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Cache for the expensive ThingsBoard “all history” query.
  const fallbackCacheRef = useRef({ rows: [], ts: 0 });

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const now = new Date();
      const start = new Date(now.getTime() - PRIMARY_WINDOW_MS);

      // 1. Try the last 31 days (local aggregate table).
      const primaryRows = await fetchFromAggregates(start, now);

      if (primaryRows.length > 0) {
        setHistoryRows(primaryRows);
        setUsingFallback(false);
        return;
      }

      // 2. No local data in the last month → use ThingsBoard “all history”.
      //    Guard with a short cache so 60s polling doesn’t hammer TB.
      const cache = fallbackCacheRef.current;
      const nowTs = Date.now();

      if (cache.rows.length > 0 && nowTs - cache.ts < FALLBACK_REFRESH_MS) {
        setHistoryRows(cache.rows);
        setUsingFallback(true);
        return;
      }

      const fallbackRows = await fetchFromThingsBoard();
      fallbackCacheRef.current = { rows: fallbackRows, ts: nowTs };
      setHistoryRows(fallbackRows);
      setUsingFallback(true);
    } catch (err) {
      setError(err.message || "Unable to load historical energy data.");
      setHistoryRows([]);
      setUsingFallback(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    const timer = window.setInterval(fetchHistory, STALE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [fetchHistory]);

  useEffect(() => {
    if (!isExpanded) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") setIsExpanded(false);
    };

    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isExpanded]);

  const chartData = useMemo(
    () =>
      buildChartData(
        Array.isArray(data) && data.length ? data : historyRows,
        granularity
      ),
    [data, historyRows, granularity]
  );

  const renderChart = (height) => (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={chartData}
        margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis
          tick={{ fontSize: 11 }}
          label={{
            value: "Energy (kWh)",
            angle: -90,
            position: "insideLeft",
            fontSize: 11,
          }}
        />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="currentMonth"
          name="Energy Consumption"
          stroke="#3182BD"
          strokeWidth={3}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );

  const fallbackNote = usingFallback ? (
    <small style={{ color: "#b45309", display: "block", marginTop: 4 }}>
      No data in the last 31 days — showing all available ThingsBoard history.
    </small>
  ) : null;

  return (
    <>
      <div className="chart-box">
        <div className="chart-header">
          <h3>▥ Energy Consumption Trend</h3>

          <button
            type="button"
            style={iconButtonStyle}
            onClick={() => setIsExpanded(true)}
            title="Expand chart"
            aria-label="Expand chart"
          >
            <svg width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
        </div>

        {fallbackNote}

        {loading ? (
          <p>Loading historical energy data...</p>
        ) : error ? (
          <p role="alert">{error}</p>
        ) : chartData.length === 0 ? (
          <p>No historical energy data available for this period.</p>
        ) : (
          renderChart(250)
        )}
      </div>

      {isExpanded && (
        <div style={overlayStyle} onClick={() => setIsExpanded(false)}>
          <div
            style={modalStyle}
            role="dialog"
            aria-modal="true"
            aria-label="Energy Consumption Trend"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="chart-header">
              <h3>▥ Energy Consumption Trend</h3>

              <div style={{ display: "flex", gap: 10 }}>
                <select
                  className="chart-select"
                  value={granularity}
                  onChange={(event) => setGranularity(event.target.value)}
                >
                  {GRANULARITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  style={iconButtonStyle}
                  onClick={() => setIsExpanded(false)}
                  aria-label="Close chart"
                >
                  ×
                </button>
              </div>
            </div>

            {fallbackNote}

            {loading ? (
              <p>Loading historical energy data...</p>
            ) : error ? (
              <p role="alert">{error}</p>
            ) : chartData.length === 0 ? (
              <p>No historical energy data available.</p>
            ) : (
              <div style={{ flex: 1, minHeight: 0 }}>
                {renderChart("100%")}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default EnergyConsumptionChart;