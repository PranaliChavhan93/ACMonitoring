
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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

const STALE_REFRESH_MS = 60_000;
const FALLBACK_REFRESH_MS = 5 * 60_000;
const PRIMARY_WINDOW_MS = 31 * 24 * 60 * 60 * 1000;

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

/* =========================================================
   DATA HELPERS
========================================================= */

// Handles ThingsBoard timestamps in milliseconds or seconds.
function parseDate(item) {
  const raw =
    item?.ts ??
    item?.timestamp ??
    item?.date ??
    item?.created_at ??
    item?.bucket_start;

  if (raw === undefined || raw === null || raw === "") {
    return null;
  }

  const numeric = Number(raw);
  const isNumeric =
    String(raw).trim() !== "" && Number.isFinite(numeric);

  const date = isNumeric
    ? new Date(numeric < 1e12 ? numeric * 1000 : numeric)
    : new Date(raw);

  return Number.isNaN(date.getTime()) ? null : date;
}

// Your ThingsBoard response contains JSON inside item.value.
function unwrapTelemetry(item) {
  let value = item?.value ?? item?.data ?? item?.values ?? item;

  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }

  return value && typeof value === "object" ? value : null;
}

// Supports both ThingsBoard JSON readings and aggregate records.
// function getEnergy(item) {
//   const payload = unwrapTelemetry(item);

//   if (!payload) return null;

//   const candidates = [
//     payload.energy_consumption,
//     payload.energy_kwh,
//     payload.energy,
//     payload.kwh,
//     payload.energy_avg,
//     payload.energy_average,
//     payload.avg_energy,
//     payload.avg?.energy,
//     payload.average?.energy,
//     payload.values?.energy,

//     item?.energy_consumption,
//     item?.energy_kwh,
//     item?.energy,
//     item?.energy_avg,
//     item?.avg_energy,
//     item?.kwh,
//   ];

//   for (const value of candidates) {
//     if (value !== undefined && value !== null && value !== "") {
//       const number = Number(value);

//       if (Number.isFinite(number)) {
//         return number;
//       }
//     }
//   }

//   return null;
// }

function getEnergy(item) {
  const payload = unwrapTelemetry(item);
  if (!payload) return null;

  const candidates = [
    item?.energy_delta,
    payload?.energy_delta,
    item?.energy_consumption,
    item?.latest_energy_counter,
    payload?.energy_consumption,
    payload?.energy,
    payload?.energy_kwh,
    payload?.kwh,
  ];

  for (const value of candidates) {
    if (value !== undefined && value !== null && value !== "") {
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
  }

  return null;
}

function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== "object") {
    return [];
  }

  for (const key of ["data", "results", "records", "items"]) {
    if (Array.isArray(payload[key])) {
      return payload[key];
    }
  }

  // Supports a single record as well as an array.
  if (
    payload.data &&
    typeof payload.data === "object" &&
    !Array.isArray(payload.data)
  ) {
    return [payload.data];
  }

  return [];
}

/* =========================================================
   CHART BUCKETS
========================================================= */

// Daily: each hour of the day.
// Weekly: each calendar day across the last seven days.
// Monthly: each calendar day in the current month.
// function getBucket(date, granularity) {
//   const year = date.getFullYear();
//   const month = date.getMonth();
//   const day = date.getDate();

//   if (granularity === "daily") {
//     const start = new Date(date);
//     start.setMinutes(0, 0, 0);

//     const hour = start.getHours();

//     return {
//       key: String(start.getTime()),
//       label: `${pad2(hour)}:00`,
//       sort: start.getTime(),
//     };
//   }

//   if (granularity === "weekly") {
//     const start = new Date(year, month, day);
//     start.setDate(start.getDate() - ((start.getDay() + 6) % 7));

//     return {
//       key: `${start.getFullYear()}-${pad2(
//         start.getMonth() + 1
//       )}-${pad2(start.getDate())}`,
//       label: `${start.getDate()} ${MONTH_NAMES[start.getMonth()]}`,
//       sort: start.getTime(),
//     };
//   }

//   const start = new Date(year, month, day);

//   return {
//     key: `${year}-${pad2(month + 1)}-${pad2(day)}`,
//     label: `${day} ${MONTH_NAMES[month]}`,
//     sort: start.getTime(),
//   };
// }


function getBucket(date, granularity) {
  // Daily → hourly bucket
  if (granularity === "daily") {
    const start = new Date(date);
    start.setMinutes(0, 0, 0);

    return {
      key: String(start.getTime()),
      label: `${pad2(start.getHours())}:00`,
      sort: start.getTime(),
    };
  }

  // Weekly & Monthly → daily bucket
  // (User wants "every day should point" / "every date should point")
  const start = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  return {
    key: `${start.getFullYear()}-${pad2(
      start.getMonth() + 1
    )}-${pad2(start.getDate())}`,
    label: `${start.getDate()} ${MONTH_NAMES[start.getMonth()]}`,
    sort: start.getTime(),
  };
}

function getDisplayRange(granularity, now = new Date()) {
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  if (granularity === "daily") {
    return {
      from: today,
      to: new Date(today.getTime() + 24 * 60 * 60 * 1000),
    };
  }

  if (granularity === "weekly") {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);

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

// Keep only records inside the displayed period and group them.
// Energy is assumed to be a cumulative meter counter, so each
// bucket shows last reading minus first reading.
function buildChartData(rows, granularity, now = new Date()) {
  const { from, to } = getDisplayRange(granularity, now);
  const buckets = new Map();

  const sortedRows = [...rows]
    .map((item) => ({
      item,
      date: parseDate(item),
    }))
    .filter(({ date }) => date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  sortedRows.forEach(({ item, date }) => {
    if (date < from || date >= to) return;

    const energy = getEnergy(item);
    if (energy === null) return;

    const bucket = getBucket(date, granularity);

    if (!buckets.has(bucket.key)) {
      buckets.set(bucket.key, {
        name: bucket.label,
        sort: bucket.sort,
        firstEnergy: energy,
        lastEnergy: energy,
      });
    } else {
      buckets.get(bucket.key).lastEnergy = energy;
    }
  });

  return [...buckets.values()]
    .sort((a, b) => a.sort - b.sort)
    .map(({ name, firstEnergy, lastEnergy }) => ({
      name,
      currentMonth: Number(
        Math.max(0, lastEnergy - firstEnergy).toFixed(2)
      ),
    }));
}

/* =========================================================
   NETWORK HELPERS
========================================================= */

async function requestJSON(url) {
  const token = getToken();

  const response = await fetch(url, {
    headers: {
      ...(token
        ? { Authorization: `Bearer ${token}` }
        : {}),
    },
    cache: "no-store",
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      result?.message ||
      result?.detail ||
      `HTTP ${response.status}`
    );
  }

  return result;
}

async function fetchFromAggregates(from, to) {
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  });

  const result = await requestJSON(
    `${API_URL}?${params.toString()}`
  );

  return normalizeRows(result);
}

async function fetchFromThingsBoard(deviceId, from, to) {
  if (!deviceId) {
    throw new Error(
      "A ThingsBoard device ID is required to load history."
    );
  }

  const params = new URLSearchParams({
    from: String(from.getTime()),
    to: String(to.getTime()),
    device_id: String(deviceId),
  });

  const result = await requestJSON(
    `${TB_HISTORY_URL}?${params.toString()}`
  );

  const rows = normalizeRows(result);

  console.log("ThingsBoard historical response:", result);
  console.log("Normalized historical rows:", rows);
  console.log(
    "First parsed energy:",
    rows.length ? getEnergy(rows[0]) : null
  );

  return rows;
}

/* =========================================================
   STYLES
========================================================= */

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
  flexShrink: 0,
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

/* =========================================================
   ENERGY CONSUMPTION TREND
========================================================= */

// function EnergyConsumptionChart({ data, deviceId }) {
  function EnergyConsumptionChart({ data, deviceId }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [granularity, setGranularity] = useState("daily");
  const [historyRows, setHistoryRows] = useState([]);
  const [usingFallback, setUsingFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fallbackCacheRef = useRef({
    key: "",
    rows: [],
    ts: 0,
  });

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
        const now = new Date();
        const start = new Date(
            now.getTime() - PRIMARY_WINDOW_MS
        );

        // An individual device must use its own history.
        if (deviceId) {
            const rows = await fetchFromThingsBoard(
                deviceId,
                start,
                now
            );

            fallbackCacheRef.current = {
                key: `${deviceId}:${start.getTime()}:${now.getTime()}`,
                rows,
                ts: Date.now(),
            };

            setHistoryRows(rows);
            setUsingFallback(true);
            return;
        }

        // Organization/branch view: use available aggregates.
        const primaryRows = await fetchFromAggregates(
            start,
            now
        );

        const hasUsableEnergy = primaryRows.some(
            (row) =>
                parseDate(row) &&
                getEnergy(row) !== null
        );

        if (hasUsableEnergy) {
            setHistoryRows(primaryRows);
            setUsingFallback(false);
            return;
        }

        setHistoryRows([]);
        setUsingFallback(false);

        setError(
            "No usable aggregate energy history was returned. " +
            "Select an individual device to load its ThingsBoard history, " +
            "or configure the backend to return branch/organization history."
        );
    } catch (err) {
        console.error(
            "Energy trend loading failed:",
            err
        );

        setError(
            err.message ||
            "Unable to load historical energy data."
        );

        setHistoryRows([]);
        setUsingFallback(false);
    } finally {
        setLoading(false);
    }
}, [deviceId]);

  useEffect(() => {
    fetchHistory();

    const timer = window.setInterval(
      fetchHistory,
      STALE_REFRESH_MS
    );

    return () => window.clearInterval(timer);
  }, [fetchHistory]);

  // Close the expanded chart with Escape and prevent background scrolling.
  useEffect(() => {
    if (!isExpanded) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsExpanded(false);
      }
    };

    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isExpanded]);

  const sourceRows =
    Array.isArray(data) && data.length > 0
      ? data
      : historyRows;

  const chartData = useMemo(
    () => buildChartData(sourceRows, granularity),
    [sourceRows, granularity]
  );

  const renderChart = (height) => (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={chartData}
        margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#e5e7eb"
        />

        <XAxis
          dataKey="name"
          tick={{ fontSize: 11 }}
          minTickGap={12}
        />

        <YAxis
          tick={{ fontSize: 11 }}
          width={65}
          label={{
            value: "Energy (kWh)",
            angle: -90,
            position: "insideLeft",
            fontSize: 11,
          }}
        />

        <Tooltip
          formatter={(value) => [
            `${Number(value).toFixed(2)} kWh`,
            "Energy consumed",
          ]}
          labelFormatter={(label) => `Period: ${label}`}
        />

        <Legend />

        <Line
          type="monotone"
          dataKey="currentMonth"
          name="Energy Consumption"
          stroke="#3182BD"
          strokeWidth={3}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );

  const fallbackNote = usingFallback ? (
    <small
      style={{
        color: "#b45309",
        display: "block",
        marginTop: 4,
      }}
    >
      Showing historical data from ThingsBoard.
    </small>
  ) : null;

  const renderContent = (height) => {
    if (loading) {
      return <p>Loading historical energy data...</p>;
    }

    if (error) {
      return <p role="alert">{error}</p>;
    }

    if (chartData.length === 0) {
      return (
        <p>
          No usable energy readings were found for the selected period.
          Check the API response, timestamps, and energy values.
        </p>
      );
    }

    return renderChart(height);
  };

  return (
    <>
      <div className="chart-box">
        <div className="chart-header">
          <h3>▥ Energy Consumption Trend</h3>

          <div style={{ display: "flex", gap: 8 }}>
            <select
              className="chart-select"
              value={granularity}
              onChange={(event) =>
                setGranularity(event.target.value)
              }
              aria-label="Trend time period"
            >
              {GRANULARITY_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              style={iconButtonStyle}
              onClick={() => setIsExpanded(true)}
              title="Expand chart"
              aria-label="Expand chart"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          </div>
        </div>

        {fallbackNote}
        {renderContent(250)}
      </div>

      {isExpanded && (
        <div
          style={overlayStyle}
          onClick={() => setIsExpanded(false)}
        >
          <div
            style={modalStyle}
            role="dialog"
            aria-modal="true"
            aria-label="Energy Consumption Trend"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="chart-header">
              <h3>▥ Energy Consumption Trend</h3>

              <button
                type="button"
                style={iconButtonStyle}
                onClick={() => setIsExpanded(false)}
                aria-label="Close chart"
              >
                ×
              </button>
            </div>

            {fallbackNote}

            <div style={{ flex: 1, minHeight: 0 }}>
              {renderContent("100%")}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default EnergyConsumptionChart;
