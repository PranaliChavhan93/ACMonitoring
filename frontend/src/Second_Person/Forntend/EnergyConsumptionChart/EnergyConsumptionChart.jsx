// import React from "react";
// import {
//   ResponsiveContainer,
//   LineChart,
//   Line,
//   CartesianGrid,
//   XAxis,
//   YAxis,
//   Tooltip,
//   Legend,
// } from "recharts";

// function EnergyConsumptionChart({ data = [] }) {
//   const chartData =
//     data.length > 0
//       ? data.map((item, index) => ({
//           name: item.timestamp?.slice(11, 16) || item.date || `P${index + 1}`,
//           currentMonth: Number( item.energy_consumption 
//             ?? item.energy 
//             ?? item.kwh 
//             ?? 0 ),
//           previousMonth: Number( item.previous_energy 
//             ?? item.previous_month_energy 
//             ?? 0 ),
//         }))
//       : [
//           // { name: "1 Sep", currentMonth: 28, previousMonth: 24 },
//           // { name: "3 Sep", currentMonth: 35, previousMonth: 28 },
//           // { name: "5 Sep", currentMonth: 42, previousMonth: 31 },
//           // { name: "7 Sep", currentMonth: 55, previousMonth: 36 },
//           // { name: "9 Sep", currentMonth: 61, previousMonth: 42 },
//           // { name: "11 Sep", currentMonth: 67, previousMonth: 44 },
//           // { name: "13 Sep", currentMonth: 74, previousMonth: 48 },
//           // { name: "15 Sep", currentMonth: 68, previousMonth: 46 },
//         ];

//   return (
//     <div className="chart-box">
//       <div className="chart-header">
//         <h3>▥ Energy Consumption Trend</h3>

//         {/* <select className="chart-select">
//           <option>Daily</option>
//           <option>Weekly</option>
//           <option>Monthly</option>
//         </select> */}
//       </div>

//       <ResponsiveContainer width="100%" height={250}>
//         <LineChart data={chartData}>
//           <CartesianGrid
//             strokeDasharray="3 3"
//             stroke="#e5e7eb"
//           />

//           <XAxis
//             dataKey="name"
//             tick={{ fontSize: 11 }}
//           />

//           <YAxis
//             tick={{ fontSize: 11 }}
//             label={{
//               value: "Energy (kWh)",
//               angle: -90,
//               position: "insideLeft",
//               fontSize: 11,
//             }}
//           />

//           <Tooltip />

//           <Legend />

//           <Line
//             type="monotone"
//             dataKey="currentMonth"
//             name="This Month"
//             stroke="#3182BD"
//             strokeWidth={3}
//             dot={{ r: 3 }}
//           />

//           <Line
//             type="monotone"
//             dataKey="previousMonth"
//             name="Previous Month"
//             stroke="#94a3b8"
//             strokeWidth={2}
//             dot={{ r: 2 }}
//           />
//         </LineChart>
//       </ResponsiveContainer>
//     </div>
//   );
// }

// export default EnergyConsumptionChart;



import React, { useEffect, useMemo, useState } from "react";
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

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const pad2 = (n) => String(n).padStart(2, "0");

const GRANULARITY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

/** Fallback data used when no `data` prop is supplied. */
const FALLBACK_DATA = [
  { timestamp: "2025-09-01T08:00:00", energy_consumption: 28, previous_energy: 24 },
  { timestamp: "2025-09-03T08:00:00", energy_consumption: 35, previous_energy: 28 },
  { timestamp: "2025-09-05T08:00:00", energy_consumption: 42, previous_energy: 31 },
  { timestamp: "2025-09-07T08:00:00", energy_consumption: 55, previous_energy: 36 },
  { timestamp: "2025-09-09T08:00:00", energy_consumption: 61, previous_energy: 42 },
  { timestamp: "2025-09-11T08:00:00", energy_consumption: 67, previous_energy: 44 },
  { timestamp: "2025-09-13T08:00:00", energy_consumption: 74, previous_energy: 48 },
  { timestamp: "2025-09-15T08:00:00", energy_consumption: 68, previous_energy: 46 },
];

/** Parse a row's date out of the usual field names. */
function parseDate(item) {
  const raw = item?.timestamp ?? item?.date ?? item?.created_at;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Map a date to a bucket (key + display label + sort value). */
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
    // Week starts on Monday
    const start = new Date(y, m, d);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return {
      key: `W-${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`,
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

/** Group + sum the raw rows into the shape recharts expects. */
function buildChartData(rows, granularity) {
  const buckets = new Map();

  rows.forEach((item, index) => {
    const date = parseDate(item);

    const bucket = date
      ? getBucket(date, granularity)
      : {
          key: `row-${index}`,
          label: item?.date || item?.timestamp || `P${index + 1}`,
          sort: index,
        };

    const current =
      Number(item?.energy_consumption ?? item?.energy ?? item?.kwh ?? 0) || 0;
    const previous =
      Number(item?.previous_energy ?? item?.previous_month_energy ?? 0) || 0;

    if (!buckets.has(bucket.key)) {
      buckets.set(bucket.key, {
        name: bucket.label,
        sort: bucket.sort,
        currentMonth: 0,
        previousMonth: 0,
      });
    }

    const entry = buckets.get(bucket.key);
    entry.currentMonth += current;
    entry.previousMonth += previous;
  });

  return [...buckets.values()]
    .sort((a, b) => a.sort - b.sort)
    .map(({ name, currentMonth, previousMonth }) => ({
      name,
      currentMonth: Math.round(currentMonth * 100) / 100,
      previousMonth: Math.round(previousMonth * 100) / 100,
    }));
}

const iconButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 30,
  height: 30,
  padding: 0,
  // border: none,
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  background: "#fff",
  color: "#475569",
  cursor: "pointer",
  flex: "0 0 auto",
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

const modalHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const ExpandIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

const CloseIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);


function EnergyConsumptionChart({ data = [] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [granularity, setGranularity] = useState("daily");

  const sourceData =
    Array.isArray(data) && data.length > 0 ? data : FALLBACK_DATA;

  // Re-aggregates whenever the raw data or the selected granularity changes
  const chartData = useMemo(
    () => buildChartData(sourceData, granularity),
    [sourceData, granularity]
  );

  /* Close on Escape + lock body scroll while expanded */
  useEffect(() => {
    if (!isExpanded) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsExpanded(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isExpanded]);

  /* Single chart renderer shared by the small box and the big modal */
  const renderChart = (height) => (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
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
          name="This Month"
          stroke="#3182BD"
          strokeWidth={3}
          dot={{ r: 3 }}
        />

        <Line
          type="monotone"
          dataKey="previousMonth"
          name="Previous Month"
          stroke="#94a3b8"
          strokeWidth={2}
          dot={{ r: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );

  return (
    <>
      {/* ---------------- Small (inline) card ---------------- */}
      <div className="chart-box">
        <div className="chart-header">
          <h3>▥ Energy Consumption Trend</h3>

          <button
            type="button"
            className="chart-expand-btn"
            style={iconButtonStyle}
            onClick={() => setIsExpanded(true)}
            title="Expand chart"
            aria-label="Expand chart"
          >
            <ExpandIcon />
          </button>
        </div>

        {renderChart(250)}
      </div>

      {isExpanded && (
        <div
          style={overlayStyle}
          role="presentation"
          onClick={() => setIsExpanded(false)}
        >
          <div
            style={modalStyle}
            role="dialog"
            aria-modal="true"
            aria-label="Energy Consumption Trend"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="chart-header" style={modalHeaderStyle}>
              <h3>▥ Energy Consumption Trend</h3>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                  className="chart-close-btn"
                  style={iconButtonStyle}
                  onClick={() => setIsExpanded(false)}
                  title="Close"
                  aria-label="Close"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 0 }}>{renderChart("100%")}</div>
          </div>
        </div>
      )}
    </>
  );
}

export default EnergyConsumptionChart;