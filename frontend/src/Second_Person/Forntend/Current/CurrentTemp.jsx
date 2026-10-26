
import React, { useMemo } from "react";
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

const WINDOW_MS = 24 * 60 * 60 * 1000;
const BUCKET_MS = 5 * 60 * 1000;

function getTimestamp(row) {
  const raw =
    row?.bucket ??
    row?.timestamp ??
    row?.ts ??
    row?.time ??
    row?.created_at ??
    row?.datetime;

  if (raw == null || raw === "") return NaN;

  const n = Number(raw);

  if (Number.isFinite(n)) {
    return n < 1e12 ? n * 1000 : n;
  }

  return Date.parse(raw);
}

function unwrap(row) {
  let payload = row?.value ?? row?.data ?? row;

  for (let i = 0; i < 2 && typeof payload === "string"; i++) {
    try {
      payload = JSON.parse(payload);
    } catch {
      return row;
    }
  }

  return payload && typeof payload === "object"
    ? { ...row, ...payload }
    : row;
}

function getNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getCurrent(row) {
  const p = unwrap(row);

  return getNumber(
    p?.current ??
    p?.Current ??
    p?.avg ??
    p?.current_avg ??
    p?.avg_current ??
    p?.values?.current
  );
}

function getTemperature(row) {
  const p = unwrap(row);

  return getNumber(
    p?.indoor_temperature ??
    p?.indoor_temp ??
    p?.temperature ??
    p?.temp
  );
}

function CurrentTemperatureChart({
  currentData = [],
  indoorData = [],
  loading = false,
  error = "",
}) {
  const { chartData, start, end } = useMemo(() => {
    const end = Date.now();
    const start = end - WINDOW_MS;
    const buckets = new Map();

    function getBucket(ts) {
      const key = Math.floor(ts / BUCKET_MS) * BUCKET_MS;

      if (!buckets.has(key)) {
        buckets.set(key, {
          timestampMs: key,
          current: null,
          temperature: null,
        });
      }

      return buckets.get(key);
    }

    // Current telemetry
    for (const row of currentData) {
      const ts = getTimestamp(row);
      const value = getCurrent(row);

      if (
        !Number.isFinite(ts) ||
        ts < start ||
        ts > end ||
        value == null
      ) continue;

      const point = getBucket(ts);
      point.current = value;
    }

    // Indoor temperature telemetry
    for (const row of indoorData) {
      const ts = getTimestamp(row);
      const value = getTemperature(row);

      if (
        !Number.isFinite(ts) ||
        ts < start ||
        ts > end ||
        value == null
      ) continue;

      const point = getBucket(ts);
      point.temperature = value;
    }

    const chartData = [...buckets.values()]
      .sort((a, b) => a.timestampMs - b.timestampMs)
      .map((point) => ({
        ...point,
        time: new Date(point.timestampMs).toLocaleTimeString(
          [],
          { hour: "2-digit", minute: "2-digit" }
        ),
      }));

    return { chartData, start, end };
  }, [currentData, indoorData]);

  const ticks = useMemo(() => {
    const result = [];
    const step = 2 * 60 * 60 * 1000;

    for (
      let t = Math.ceil(start / step) * step;
      t <= end;
      t += step
    ) {
      result.push(t);
    }

    return result;
  }, [start, end]);

  const hasCurrent = chartData.some((p) => p.current != null);
  const hasTemperature = chartData.some(
    (p) => p.temperature != null
  );

  return (
    <div className="chart-box">
      <div className="chart-header">
        <div>
          <h3>⚡ Current & Temperature</h3>
          <span>
            Current and indoor temperature over the last 24 hours
          </span>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: "center" }}>
          Loading chart data...
        </div>
      ) : error && !chartData.length ? (
        <div style={{ padding: 24, textAlign: "center" }}>
          {error}
        </div>
      ) : chartData.length ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 20, left: 5, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis
              dataKey="timestampMs"
              type="number"
              scale="time"
              domain={[start, end]}
              ticks={ticks}
              tickFormatter={(value) =>
                new Date(value).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              }
              tick={{ fontSize: 10 }}
              minTickGap={20}
            />

            {/* Both lines share this single Y-axis */}
            <YAxis
              tick={{ fontSize: 11 }}
              domain={["auto", "auto"]}
              label={{
                value: "Current (A) / Temperature (°C)",
                angle: -90,
                position: "insideLeft",
                style: { textAnchor: "middle", fontSize: 11 },
              }}
            />

            <Tooltip
              labelFormatter={(value) =>
                new Date(value).toLocaleString([], {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              }
              formatter={(value, name) => [
                value == null
                  ? "No reading"
                  : `${Number(value).toFixed(2)} ${
                      name === "Current" ? "A" : "°C"
                    }`,
                name,
              ]}
            />

            <Legend />

            <Line
              type="monotone"
              dataKey="current"
              name="Current"
              stroke="#2563eb"
              strokeWidth={2.5}
              dot={false}
              connectNulls
            />

            <Line
              type="monotone"
              dataKey="temperature"
              name="Temperature"
              stroke="#f97316"
              strokeWidth={2.5}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ padding: 24, textAlign: "center" }}>
          No current or temperature history available for the last 24 hours.
        </div>
      )}

      {(!hasCurrent || !hasTemperature) && !loading && (
        <small
          style={{
            display: "block",
            padding: "0 12px 8px",
            color: "#64748b",
          }}
        >
          {!hasCurrent && "Waiting for current telemetry. "}
          {!hasTemperature && "Waiting for indoor temperature telemetry."}
        </small>
      )}
    </div>
  );
}

export default CurrentTemperatureChart;




// import React, { useMemo } from "react";
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
// import './CurrentTemp.css'

// const WINDOW_MS = 24 * 60 * 60 * 1000;
// const BUCKET_MS = 5 * 60 * 1000;

// function getTimestamp(row) {
//   const raw =
//     row?.bucket ??
//     row?.timestamp ??
//     row?.ts ??
//     row?.time ??
//     row?.created_at ??
//     row?.datetime;

//   if (raw == null || raw === "") return NaN;

//   const n = Number(raw);

//   if (Number.isFinite(n)) {
//     return n < 1e12 ? n * 1000 : n;
//   }

//   return Date.parse(raw);
// }

// function unwrap(row) {
//   let payload = row?.value ?? row?.data ?? row;

//   for (let i = 0; i < 2 && typeof payload === "string"; i++) {
//     try {
//       payload = JSON.parse(payload);
//     } catch {
//       return row;
//     }
//   }

//   return payload && typeof payload === "object"
//     ? { ...row, ...payload }
//     : row;
// }

// function getNumber(value) {
//   if (value == null || value === "") return null;
//   const n = Number(value);
//   return Number.isFinite(n) ? n : null;
// }

// function getCurrent(row) {
//   const p = unwrap(row);

//   return getNumber(
//     p?.current ??
//     p?.Current ??
//     p?.avg ??
//     p?.current_avg ??
//     p?.avg_current ??
//     p?.values?.current
//   );
// }

// function getTemperature(row) {
//   const p = unwrap(row);

//   return getNumber(
//     p?.indoor_temperature ??
//     p?.indoor_temp ??
//     p?.temperature ??
//     p?.temp
//   );
// }

// function CurrentTemperatureChart({
//   currentData = [],
//   indoorData = [],
//   loading = false,
//   error = "",
// }) {
//     const { chartData, start, end } = useMemo(() => {
//     const end = Date.now();
//     const start = end - WINDOW_MS;
//     const buckets = new Map();

//     function getBucket(ts) {
//       const key = Math.floor(ts / BUCKET_MS) * BUCKET_MS;

//       if (!buckets.has(key)) {
//         buckets.set(key, {
//           timestampMs: key,
//           current: null,
//           temperature: null,
//         });
//       }

//       return buckets.get(key);
//     }

//     // Current telemetry
//     for (const row of currentData) {
//       const ts = getTimestamp(row);
//       const value = getCurrent(row);

//       if (
//         !Number.isFinite(ts) ||
//         ts < start ||
//         ts > end ||
//         value == null
//       ) continue;

//       const point = getBucket(ts);
//       point.current = value;
//     }

//     // Indoor temperature telemetry
//     for (const row of indoorData) {
//       const ts = getTimestamp(row);
//       const value = getTemperature(row);

//       if (
//         !Number.isFinite(ts) ||
//         ts < start ||
//         ts > end ||
//         value == null
//       ) continue;

//       const point = getBucket(ts);
//       point.temperature = value;
//     }

//     const chartData = [...buckets.values()]
//       .sort((a, b) => a.timestampMs - b.timestampMs)
//       .map((point) => ({
//         ...point,
//         time: new Date(point.timestampMs).toLocaleTimeString(
//           [],
//           { hour: "2-digit", minute: "2-digit" }
//         ),
//       }));

//     return { chartData, start, end };
//   }, [currentData, indoorData]);

//   const ticks = useMemo(() => {
//     const result = [];
//     const step = 2 * 60 * 60 * 1000;

//     for (
//       let t = Math.ceil(start / step) * step;
//       t <= end;
//       t += step
//     ) {
//       result.push(t);
//     }

//     return result;
//   }, [start, end]);

//   const hasCurrent = chartData.some((p) => p.current != null);
//   const hasTemperature = chartData.some((p) => p.temperature != null);

//   return (
//     <div className="chart-box">
//       <div className="chart-header">
//         <div>
//           <h3>⚡ Current & Temperature</h3>
//           <span>Current and indoor temperature over the last 24 hours</span>
//         </div>
//       </div>

//       {loading ? (
//         <div style={{ padding: 24, textAlign: "center" }}>
//           Loading chart data...
//         </div>
//       ) : error && !chartData.length ? (
//         <div style={{ padding: 24, textAlign: "center" }}>{error}</div>
//       ) : chartData.length ? (
//         <ResponsiveContainer width="100%" height={320}>
            
//           <LineChart
//             data={chartData}
//             margin={{ top: 10, right: 70, left: 10, bottom: 5 }}
//         >
//             <CartesianGrid strokeDasharray="3 3" />

//             <XAxis
//               dataKey="timestampMs"
//               type="number"
//               scale="time"
//               domain={[start, end]}
//               ticks={ticks}
//               tickFormatter={(value) =>
//                 new Date(value).toLocaleTimeString([], {
//                   hour: "2-digit",
//                   minute: "2-digit",
//                 })
//               }
//               tick={{ fontSize: 10 }}
//               minTickGap={20}
//             />

//             {/* LEFT axis — Current (A) */}
//             <YAxis
//               yAxisId="left"
//               tick={{ fontSize: 11, fill: "#2563eb" }}
//               axisLine={{ stroke: "#2563eb" }}
//               tickLine={{ stroke: "#2563eb" }}
//               domain={["auto", "auto"]}
//               label={{
//                 value: "Current (A)",
//                 angle: -90,
//                 position: "insideLeft",
//                 style: {
//                   textAnchor: "middle",
//                   fontSize: 11,
//                   fill: "#2563eb",
//                 },
//               }}
//             />

//             {/* RIGHT axis — Temperature (°C) */}
//             <YAxis
//               yAxisId="right"
//               orientation="right"
//               tick={{ fontSize: 11, fill: "#f97316" }}
//               axisLine={{ stroke: "#f97316" }}
//               tickLine={{ stroke: "#f97316" }}
//               domain={["auto", "auto"]}
//               label={{
//                 value: "Temperature (°C)",
//                 angle: 90,
//                 position: "insideRight",
//                 style: {
//                   textAnchor: "middle",
//                   fontSize: 11,
//                   fill: "#f97316",
//                 },
//               }}
//             />

//             <Tooltip
//               labelFormatter={(value) =>
//                 new Date(value).toLocaleString([], {
//                   day: "2-digit",
//                   month: "short",
//                   hour: "2-digit",
//                   minute: "2-digit",
//                 })
//               }
//               formatter={(value, name) => [
//                 value == null
//                   ? "No reading"
//                   : `${Number(value).toFixed(2)} ${
//                       name === "Current" ? "A" : "°C"
//                     }`,
//                 name,
//               ]}
//             />

//             <Legend />

//             <Line
//               yAxisId="left"
//               type="monotone"
//               dataKey="current"
//               name="Current"
//               stroke="#2563eb"
//               strokeWidth={2.5}
//               dot={false}
//               connectNulls
//             />

//             <Line
//               yAxisId="right"
//               type="monotone"
//               dataKey="temperature"
//               name="Temperature"
//               stroke="#f97316"
//               strokeWidth={2.5}
//               dot={false}
//               connectNulls
//             />
//           </LineChart>
//         </ResponsiveContainer>
//       ) : (
//         <div style={{ padding: 24, textAlign: "center" }}>
//           No current or temperature history available for the last 24 hours.
//         </div>
//       )}

//       {(!hasCurrent || !hasTemperature) && !loading && (
//         <small
//           style={{
//             display: "block",
//             padding: "0 12px 8px",
//             color: "#64748b",
//           }}
//         >
//           {!hasCurrent && "Waiting for current telemetry. "}
//           {!hasTemperature && "Waiting for indoor temperature telemetry."}
//         </small>
//       )}
//     </div>
//   );
// }

// export default CurrentTemperatureChart;