
// // // // // import React, { useMemo } from "react";
// // // // // import {
// // // // //   ResponsiveContainer,
// // // // //   LineChart,
// // // // //   Line,
// // // // //   CartesianGrid,
// // // // //   XAxis,
// // // // //   YAxis,
// // // // //   Tooltip,
// // // // //   Legend,
// // // // // } from "recharts";

// // // // // const WINDOW_MS = 24 * 60 * 60 * 1000;
// // // // // const BUCKET_MS = 5 * 60 * 1000;

// // // // // function getTimestamp(row) {
// // // // //   const raw =
// // // // //     row?.bucket ??
// // // // //     row?.timestamp ??
// // // // //     row?.ts ??
// // // // //     row?.time ??
// // // // //     row?.created_at ??
// // // // //     row?.datetime;

// // // // //   if (raw == null || raw === "") return NaN;

// // // // //   const n = Number(raw);

// // // // //   if (Number.isFinite(n)) {
// // // // //     return n < 1e12 ? n * 1000 : n;
// // // // //   }

// // // // //   return Date.parse(raw);
// // // // // }

// // // // // function unwrap(row) {
// // // // //   let payload = row?.value ?? row?.data ?? row;

// // // // //   for (let i = 0; i < 2 && typeof payload === "string"; i++) {
// // // // //     try {
// // // // //       payload = JSON.parse(payload);
// // // // //     } catch {
// // // // //       return row;
// // // // //     }
// // // // //   }

// // // // //   return payload && typeof payload === "object"
// // // // //     ? { ...row, ...payload }
// // // // //     : row;
// // // // // }

// // // // // function getNumber(value) {
// // // // //   if (value == null || value === "") return null;
// // // // //   const n = Number(value);
// // // // //   return Number.isFinite(n) ? n : null;
// // // // // }

// // // // // function getCurrent(row) {
// // // // //   const p = unwrap(row);

// // // // //   return getNumber(
// // // // //     p?.current ??
// // // // //     p?.Current ??
// // // // //     p?.avg ??
// // // // //     p?.current_avg ??
// // // // //     p?.avg_current ??
// // // // //     p?.values?.current
// // // // //   );
// // // // // }

// // // // // function getTemperature(row) {
// // // // //   const p = unwrap(row);

// // // // //   return getNumber(
// // // // //     p?.indoor_temperature ??
// // // // //     p?.indoor_temp ??
// // // // //     p?.temperature ??
// // // // //     p?.temp
// // // // //   );
// // // // // }

// // // // // function CurrentTemperatureChart({
// // // // //   currentData = [],
// // // // //   indoorData = [],
// // // // //   loading = false,
// // // // //   error = "",
// // // // // }) {
// // // // //   const { chartData, start, end } = useMemo(() => {
// // // // //     const end = Date.now();
// // // // //     const start = end - WINDOW_MS;
// // // // //     const buckets = new Map();

// // // // //     function getBucket(ts) {
// // // // //       const key = Math.floor(ts / BUCKET_MS) * BUCKET_MS;

// // // // //       if (!buckets.has(key)) {
// // // // //         buckets.set(key, {
// // // // //           timestampMs: key,
// // // // //           current: null,
// // // // //           temperature: null,
// // // // //         });
// // // // //       }

// // // // //       return buckets.get(key);
// // // // //     }

// // // // //     // Current telemetry
// // // // //     for (const row of currentData) {
// // // // //       const ts = getTimestamp(row);
// // // // //       const value = getCurrent(row);

// // // // //       if (
// // // // //         !Number.isFinite(ts) ||
// // // // //         ts < start ||
// // // // //         ts > end ||
// // // // //         value == null
// // // // //       ) continue;

// // // // //       const point = getBucket(ts);
// // // // //       point.current = value;
// // // // //     }

// // // // //     // Indoor temperature telemetry
// // // // //     for (const row of indoorData) {
// // // // //       const ts = getTimestamp(row);
// // // // //       const value = getTemperature(row);

// // // // //       if (
// // // // //         !Number.isFinite(ts) ||
// // // // //         ts < start ||
// // // // //         ts > end ||
// // // // //         value == null
// // // // //       ) continue;

// // // // //       const point = getBucket(ts);
// // // // //       point.temperature = value;
// // // // //     }

// // // // //     const chartData = [...buckets.values()]
// // // // //       .sort((a, b) => a.timestampMs - b.timestampMs)
// // // // //       .map((point) => ({
// // // // //         ...point,
// // // // //         time: new Date(point.timestampMs).toLocaleTimeString(
// // // // //           [],
// // // // //           { hour: "2-digit", minute: "2-digit" }
// // // // //         ),
// // // // //       }));

// // // // //     return { chartData, start, end };
// // // // //   }, [currentData, indoorData]);

// // // // //   const ticks = useMemo(() => {
// // // // //     const result = [];
// // // // //     const step = 2 * 60 * 60 * 1000;

// // // // //     for (
// // // // //       let t = Math.ceil(start / step) * step;
// // // // //       t <= end;
// // // // //       t += step
// // // // //     ) {
// // // // //       result.push(t);
// // // // //     }

// // // // //     return result;
// // // // //   }, [start, end]);

// // // // //   const hasCurrent = chartData.some((p) => p.current != null);
// // // // //   const hasTemperature = chartData.some(
// // // // //     (p) => p.temperature != null
// // // // //   );

// // // // //   return (
// // // // //     <div className="chart-box">
// // // // //       <div className="chart-header">
// // // // //         <div>
// // // // //           <h3>⚡ Current & Temperature</h3>
// // // // //           <span>
// // // // //             Current and indoor temperature over the last 24 hours
// // // // //           </span>
// // // // //         </div>
// // // // //       </div>

// // // // //       {loading ? (
// // // // //         <div style={{ padding: 24, textAlign: "center" }}>
// // // // //           Loading chart data...
// // // // //         </div>
// // // // //       ) : error && !chartData.length ? (
// // // // //         <div style={{ padding: 24, textAlign: "center" }}>
// // // // //           {error}
// // // // //         </div>
// // // // //       ) : chartData.length ? (
// // // // //         <ResponsiveContainer width="100%" height={300}>
// // // // //           <LineChart
// // // // //             data={chartData}
// // // // //             margin={{ top: 10, right: 20, left: 5, bottom: 5 }}
// // // // //           >
// // // // //             <CartesianGrid strokeDasharray="3 3" />

// // // // //             <XAxis
// // // // //               dataKey="timestampMs"
// // // // //               type="number"
// // // // //               scale="time"
// // // // //               domain={[start, end]}
// // // // //               ticks={ticks}
// // // // //               tickFormatter={(value) =>
// // // // //                 new Date(value).toLocaleTimeString([], {
// // // // //                   hour: "2-digit",
// // // // //                   minute: "2-digit",
// // // // //                 })
// // // // //               }
// // // // //               tick={{ fontSize: 10 }}
// // // // //               minTickGap={20}
// // // // //             />

// // // // //             {/* Both lines share this single Y-axis */}
// // // // //             <YAxis
// // // // //               tick={{ fontSize: 11 }}
// // // // //               domain={["auto", "auto"]}
// // // // //               label={{
// // // // //                 value: "Current (A) / Temperature (°C)",
// // // // //                 angle: -90,
// // // // //                 position: "insideLeft",
// // // // //                 style: { textAnchor: "middle", fontSize: 11 },
// // // // //               }}
// // // // //             />

// // // // //             <Tooltip
// // // // //               labelFormatter={(value) =>
// // // // //                 new Date(value).toLocaleString([], {
// // // // //                   day: "2-digit",
// // // // //                   month: "short",
// // // // //                   hour: "2-digit",
// // // // //                   minute: "2-digit",
// // // // //                 })
// // // // //               }
// // // // //               formatter={(value, name) => [
// // // // //                 value == null
// // // // //                   ? "No reading"
// // // // //                   : `${Number(value).toFixed(2)} ${
// // // // //                       name === "Current" ? "A" : "°C"
// // // // //                     }`,
// // // // //                 name,
// // // // //               ]}
// // // // //             />

// // // // //             <Legend />

// // // // //             <Line
// // // // //               type="monotone"
// // // // //               dataKey="current"
// // // // //               name="Current"
// // // // //               stroke="#2563eb"
// // // // //               strokeWidth={2.5}
// // // // //               dot={false}
// // // // //               connectNulls
// // // // //             />

// // // // //             <Line
// // // // //               type="monotone"
// // // // //               dataKey="temperature"
// // // // //               name="Temperature"
// // // // //               stroke="#f97316"
// // // // //               strokeWidth={2.5}
// // // // //               dot={false}
// // // // //               connectNulls
// // // // //             />
// // // // //           </LineChart>
// // // // //         </ResponsiveContainer>
// // // // //       ) : (
// // // // //         <div style={{ padding: 24, textAlign: "center" }}>
// // // // //           No current or temperature history available for the last 24 hours.
// // // // //         </div>
// // // // //       )}

// // // // //       {(!hasCurrent || !hasTemperature) && !loading && (
// // // // //         <small
// // // // //           style={{
// // // // //             display: "block",
// // // // //             padding: "0 12px 8px",
// // // // //             color: "#64748b",
// // // // //           }}
// // // // //         >
// // // // //           {!hasCurrent && "Waiting for current telemetry. "}
// // // // //           {!hasTemperature && "Waiting for indoor temperature telemetry."}
// // // // //         </small>
// // // // //       )}
// // // // //     </div>
// // // // //   );
// // // // // }

// // // // // export default CurrentTemperatureChart;




// // import React, { useMemo } from "react";
// // import {
// //   ResponsiveContainer,
// //   LineChart,
// //   Line,
// //   CartesianGrid,
// //   XAxis,
// //   YAxis,
// //   Tooltip,
// //   Legend,
// // } from "recharts";
// // import './CurrentTemp.css'

// // const WINDOW_MS = 24 * 60 * 60 * 1000;
// // const BUCKET_MS = 5 * 60 * 1000;

// // function getTimestamp(row) {
// //   const raw =
// //     row?.bucket ??
// //     row?.timestamp ??
// //     row?.ts ??
// //     row?.time ??
// //     row?.created_at ??
// //     row?.datetime;

// //   if (raw == null || raw === "") return NaN;

// //   const n = Number(raw);

// //   if (Number.isFinite(n)) {
// //     return n < 1e12 ? n * 1000 : n;
// //   }

// //   return Date.parse(raw);
// // }

// // function unwrap(row) {
// //   let payload = row?.value ?? row?.data ?? row;

// //   for (let i = 0; i < 2 && typeof payload === "string"; i++) {
// //     try {
// //       payload = JSON.parse(payload);
// //     } catch {
// //       return row;
// //     }
// //   }

// //   return payload && typeof payload === "object"
// //     ? { ...row, ...payload }
// //     : row;
// // }

// // function getNumber(value) {
// //   if (value == null || value === "") return null;
// //   const n = Number(value);
// //   return Number.isFinite(n) ? n : null;
// // }

// // function getCurrent(row) {
// //   const p = unwrap(row);

// //   return getNumber(
// //     p?.current ??
// //     p?.Current ??
// //     p?.avg ??
// //     p?.current_avg ??
// //     p?.avg_current ??
// //     p?.values?.current
// //   );
// // }

// // function getTemperature(row) {
// //   const p = unwrap(row);

// //   return getNumber(
// //     p?.indoor_temperature ??
// //     p?.indoor_temp ??
// //     p?.temperature ??
// //     p?.temp
// //   );
// // }

// // function CurrentTemperatureChart({
// //   currentData = [],
// //   indoorData = [],
// //   loading = false,
// //   error = "",
// // }) {
// //     const { chartData, start, end } = useMemo(() => {
// //     const end = Date.now();
// //     const start = end - WINDOW_MS;
// //     const buckets = new Map();

// //     function getBucket(ts) {
// //       const key = Math.floor(ts / BUCKET_MS) * BUCKET_MS;

// //       if (!buckets.has(key)) {
// //         buckets.set(key, {
// //           timestampMs: key,
// //           current: null,
// //           temperature: null,
// //         });
// //       }

// //       return buckets.get(key);
// //     }

// //     // Current telemetry
// //     for (const row of currentData) {
// //       const ts = getTimestamp(row);
// //       const value = getCurrent(row);

// //       if (
// //         !Number.isFinite(ts) ||
// //         ts < start ||
// //         ts > end ||
// //         value == null
// //       ) continue;

// //       const point = getBucket(ts);
// //       point.current = value;
// //     }

// //     // Indoor temperature telemetry
// //     for (const row of indoorData) {
// //       const ts = getTimestamp(row);
// //       const value = getTemperature(row);

// //       if (
// //         !Number.isFinite(ts) ||
// //         ts < start ||
// //         ts > end ||
// //         value == null
// //       ) continue;

// //       const point = getBucket(ts);
// //       point.temperature = value;
// //     }

// //     const chartData = [...buckets.values()]
// //       .sort((a, b) => a.timestampMs - b.timestampMs)
// //       .map((point) => ({
// //         ...point,
// //         time: new Date(point.timestampMs).toLocaleTimeString(
// //           [],
// //           { hour: "2-digit", minute: "2-digit" }
// //         ),
// //       }));

// //     return { chartData, start, end };
// //   }, [currentData, indoorData]);

// //   const ticks = useMemo(() => {
// //     const result = [];
// //     const step = 2 * 60 * 60 * 1000;

// //     for (
// //       let t = Math.ceil(start / step) * step;
// //       t <= end;
// //       t += step
// //     ) {
// //       result.push(t);
// //     }

// //     return result;
// //   }, [start, end]);

// //   const hasCurrent = chartData.some((p) => p.current != null);
// //   const hasTemperature = chartData.some((p) => p.temperature != null);

// //   return (
// //     // <div className="chart-box">
// //     <div className="chart-box current-temp-chart">
// //       <div className="chart-header">
// //         <div>
// //           <h3>⚡ Current & Temperature</h3>
// //           <span>Current and indoor temperature over the last 24 hours</span>
// //         </div>
// //       </div>

// //       {loading ? (
// //         <div style={{ padding: 24, textAlign: "center" }}>
// //           Loading chart data...
// //         </div>
// //       ) : error && !chartData.length ? (
// //         <div style={{ padding: 24, textAlign: "center" }}>{error}</div>
// //       ) : chartData.length ? (
// //         <ResponsiveContainer width="100%" height={320}>
            
// //           <LineChart
// //             data={chartData}
// //             margin={{ top: 10, right: 70, left: 10, bottom: 5 }}
// //         >
// //             <CartesianGrid strokeDasharray="3 3" />

// //             <XAxis
// //               dataKey="timestampMs"
// //               type="number"
// //               scale="time"
// //               domain={[start, end]}
// //               ticks={ticks}
// //               tickFormatter={(value) =>
// //                 new Date(value).toLocaleTimeString([], {
// //                   hour: "2-digit",
// //                   minute: "2-digit",
// //                 })
// //               }
// //               tick={{ fontSize: 10 }}
// //               minTickGap={20}
// //             />

// //             {/* LEFT axis — Current (A) */}
// //             <YAxis
// //               yAxisId="left"
// //               tick={{ fontSize: 11, fill: "#2563eb" }}
// //               axisLine={{ stroke: "#2563eb" }}
// //               tickLine={{ stroke: "#2563eb" }}
// //               domain={["auto", "auto"]}
// //               label={{
// //                 value: "Current (A)",
// //                 angle: -90,
// //                 position: "insideLeft",
// //                 style: {
// //                   textAnchor: "middle",
// //                   fontSize: 11,
// //                   fill: "#2563eb",
// //                 },
// //               }}
// //             />

// //             {/* RIGHT axis — Temperature (°C) */}
// //             <YAxis
// //               yAxisId="right"
// //               orientation="right"
// //               tick={{ fontSize: 11, fill: "#f97316" }}
// //               axisLine={{ stroke: "#f97316" }}
// //               tickLine={{ stroke: "#f97316" }}
// //               domain={["auto", "auto"]}
// //               label={{
// //                 value: "Temperature (°C)",
// //                 angle: 90,
// //                 position: "insideRight",
// //                 style: {
// //                   textAnchor: "middle",
// //                   fontSize: 11,
// //                   fill: "#f97316",
// //                 },
// //               }}
// //             />

// //             <Tooltip
// //               labelFormatter={(value) =>
// //                 new Date(value).toLocaleString([], {
// //                   day: "2-digit",
// //                   month: "short",
// //                   hour: "2-digit",
// //                   minute: "2-digit",
// //                 })
// //               }
// //               formatter={(value, name) => [
// //                 value == null
// //                   ? "No reading"
// //                   : `${Number(value).toFixed(2)} ${
// //                       name === "Current" ? "A" : "°C"
// //                     }`,
// //                 name,
// //               ]}
// //             />

// //             <Legend />

// //             <Line
// //               yAxisId="left"
// //               type="monotone"
// //               dataKey="current"
// //               name="Current"
// //               stroke="#2563eb"
// //               strokeWidth={2.5}
// //               dot={false}
// //               connectNulls
// //             />

// //             <Line
// //               yAxisId="right"
// //               type="monotone"
// //               dataKey="temperature"
// //               name="Temperature"
// //               stroke="#f97316"
// //               strokeWidth={2.5}
// //               dot={false}
// //               connectNulls
// //             />
// //           </LineChart>
// //         </ResponsiveContainer>
// //       ) : (
// //         <div style={{ padding: 24, textAlign: "center" }}>
// //           No current or temperature history available for the last 24 hours.
// //         </div>
// //       )}

// //       {(!hasCurrent || !hasTemperature) && !loading && (
// //         <small
// //           style={{
// //             display: "block",
// //             padding: "0 12px 8px",
// //             color: "#64748b",
// //           }}
// //         >
// //           {!hasCurrent && "Waiting for current telemetry. "}
// //           {!hasTemperature && "Waiting for indoor temperature telemetry."}
// //         </small>
// //       )}
// //     </div>
// //   );
// // }

// // export default CurrentTemperatureChart;



// // // import React, { useMemo } from "react";
// // // import {
// // //   ResponsiveContainer,
// // //   LineChart,
// // //   Line,
// // //   CartesianGrid,
// // //   XAxis,
// // //   YAxis,
// // //   Tooltip,
// // //   Legend,
// // // } from "recharts";

// // // import { useMetricHistory } from "../shared/useMetricHistory";

// // // const TEMP_CONFIG = {
// // //   metric: "temperature",
// // //   title: "Temperature & Current History",
// // //   seriesName: "Temperature",
// // //   unit: "°C",
// // //   decimals: 1,
// // //   color: "#e76f51",
// // // };

// // // const CURRENT_CONFIG = {
// // //   metric: "current",
// // //   seriesName: "Current",
// // //   unit: "A",
// // //   decimals: 3,
// // //   color: "#3182bd",
// // // };

// // // function getTimestamp(point) {
// // //   const value = point?.t ?? point?.timestamp ?? point?.time;
// // //   if (typeof value === "number") return value;
// // //   if (value == null) return NaN;

// // //   const parsed = new Date(value).getTime();
// // //   return Number.isFinite(parsed) ? parsed : NaN;
// // // }

// // // function getValue(point) {
// // //   const value =
// // //     point?.avg ??
// // //     point?.value ??
// // //     point?.temperature ??
// // //     point?.current;

// // //   if (value === null || value === undefined || value === "") {
// // //     return null;
// // //   }

// // //   const number = Number(value);
// // //   return Number.isFinite(number) ? number : null;
// // // }

// // // function formatTime(timestamp) {
// // //   return new Date(timestamp).toLocaleTimeString([], {
// // //     hour: "2-digit",
// // //     minute: "2-digit",
// // //   });
// // // }

// // // function CurrentTempChart({
// // //   deviceId = "",
// // //   scope = {},
// // //   height = 320,
// // // }) {
// // //   // Fetch temperature and current independently, using the existing
// // //   // history hook and API. Both must return historical point arrays.
// // //   const temperatureHistory = useMetricHistory({
// // //     config: TEMP_CONFIG,
// // //     deviceId,
// // //     scope,
// // //   });

// // //   const currentHistory = useMetricHistory({
// // //     config: CURRENT_CONFIG,
// // //     deviceId,
// // //     scope,
// // //   });

// // //   const temperaturePoints =
// // //     temperatureHistory?.data ??
// // //     temperatureHistory?.points ??
// // //     temperatureHistory?.series ??
// // //     [];

// // //   const currentPoints =
// // //     currentHistory?.data ??
// // //     currentHistory?.points ??
// // //     currentHistory?.series ??
// // //     [];

// // //   const chartData = useMemo(() => {
// // //     const byTime = new Map();

// // //     temperaturePoints.forEach((point) => {
// // //       const t = getTimestamp(point);
// // //       if (!Number.isFinite(t)) return;

// // //       byTime.set(t, {
// // //         ...(byTime.get(t) || { timestamp: t }),
// // //         timestamp: t,
// // //         temperature: getValue(point),
// // //       });
// // //     });

// // //     currentPoints.forEach((point) => {
// // //       const t = getTimestamp(point);
// // //       if (!Number.isFinite(t)) return;

// // //       byTime.set(t, {
// // //         ...(byTime.get(t) || { timestamp: t }),
// // //         timestamp: t,
// // //         current: getValue(point),
// // //       });
// // //     });

// // //     return Array.from(byTime.values()).sort(
// // //       (a, b) => a.timestamp - b.timestamp
// // //     );
// // //   }, [temperaturePoints, currentPoints]);

// // //   const loading =
// // //     temperatureHistory?.loading || currentHistory?.loading;

// // //   const error =
// // //     temperatureHistory?.error || currentHistory?.error;

// // //   return (
// // //     <section className="metric-history-card">
// // //       <div className="metric-history-card__header">
// // //         <h3>{TEMP_CONFIG.title}</h3>
// // //         <p>
// // //           Temperature on the left axis · Current on the right axis
// // //         </p>
// // //       </div>

// // //       {error && (
// // //         <p className="metric-history-card__error">
// // //           Unable to load one or both histories.
// // //         </p>
// // //       )}

// // //       {loading && chartData.length === 0 ? (
// // //         <div style={{ height, display: "grid", placeItems: "center" }}>
// // //           Loading temperature and current history...
// // //         </div>
// // //       ) : (
// // //         <ResponsiveContainer width="100%" height={height}>
// // //           <LineChart
// // //             data={chartData}
// // //             margin={{ top: 12, right: 20, left: 8, bottom: 8 }}
// // //           >
// // //             <CartesianGrid strokeDasharray="3 3" />

// // //             <XAxis
// // //               dataKey="timestamp"
// // //               type="number"
// // //               scale="time"
// // //               domain={["dataMin", "dataMax"]}
// // //               tickFormatter={formatTime}
// // //               tick={{ fontSize: 12 }}
// // //               minTickGap={30}
// // //             />

// // //             <YAxis
// // //               yAxisId="temperature"
// // //               orientation="left"
// // //               domain={["auto", "auto"]}
// // //               label={{
// // //                 value: "Temperature (°C)",
// // //                 angle: -90,
// // //                 position: "insideLeft",
// // //               }}
// // //             />

// // //             <YAxis
// // //               yAxisId="current"
// // //               orientation="right"
// // //               domain={["auto", "auto"]}
// // //               label={{
// // //                 value: "Current (A)",
// // //                 angle: 90,
// // //                 position: "insideRight",
// // //               }}
// // //             />

// // //             <Tooltip
// // //               labelFormatter={(value) =>
// // //                 new Date(value).toLocaleString()
// // //               }
// // //               formatter={(value, name) => {
// // //                 if (value == null) return ["No reading", name];

// // //                 return [
// // //                   name === "Temperature"
// // //                     ? `${Number(value).toFixed(1)} °C`
// // //                     : `${Number(value).toFixed(3)} A`,
// // //                   name,
// // //                 ];
// // //               }}
// // //             />

// // //             <Legend />

// // //             <Line
// // //               yAxisId="temperature"
// // //               type="monotone"
// // //               dataKey="temperature"
// // //               name="Temperature"
// // //               stroke={TEMP_CONFIG.color}
// // //               strokeWidth={2.5}
// // //               dot={false}
// // //               connectNulls={false}
// // //               isAnimationActive={false}
// // //             />

// // //             <Line
// // //               yAxisId="current"
// // //               type="monotone"
// // //               dataKey="current"
// // //               name="Current"
// // //               stroke={CURRENT_CONFIG.color}
// // //               strokeWidth={2.5}
// // //               dot={false}
// // //               connectNulls={false}
// // //               isAnimationActive={false}
// // //             />
// // //           </LineChart>
// // //         </ResponsiveContainer>
// // //       )}
// // //     </section>
// // //   );
// // // }

// // // export default CurrentTempChart;



// // // import React, { useMemo, useState } from "react";
// // // import {
// // //   ResponsiveContainer,
// // //   LineChart,
// // //   Line,
// // //   CartesianGrid,
// // //   XAxis,
// // //   YAxis,
// // //   Tooltip,
// // //   Legend,
// // // } from "recharts";

// // // import { useMetricHistory } from "../shared/useMetricHistory";
// // // import "./CurrentTemp.css";

// // // const TEMP_CONFIG = {
// // //   key: "indoor_temperature",
// // //   metric: "temperature",
// // //   title: "Temperature & Current History",
// // //   seriesName: "Temperature",
// // //   unit: "°C",
// // //   decimals: 1,
// // //   color: "#e76f51",
// // // };

// // // const CURRENT_CONFIG = {
// // //   key: "current",
// // //   metric: "current",
// // //   seriesName: "Current",
// // //   unit: "A",
// // //   decimals: 3,
// // //   color: "#3182bd",
// // // };

// // // const PERIODS = [
// // //   { label: "Today", value: "today" },
// // //   { label: "12 HR", value: "12hr" },
// // //   { label: "24 HR", value: "24hr" },
// // //   { label: "Week", value: "week" },
// // //   { label: "Month", value: "month" },
// // // ];

// // // const PERIOD_MS = {
// // //   "12hr": 12 * 60 * 60 * 1000,
// // //   "24hr": 24 * 60 * 60 * 1000,
// // //   week: 7 * 24 * 60 * 60 * 1000,
// // //   month: 30 * 24 * 60 * 60 * 1000,
// // // };

// // // function getTimestamp(point) {
// // //   const raw =
// // //     point?.t ??
// // //     point?.timestamp ??
// // //     point?.timestampMs ??
// // //     point?.bucket ??
// // //     point?.time ??
// // //     point?.created_at;

// // //   if (raw == null || raw === "") return NaN;

// // //   if (typeof raw === "number" || /^\d+$/.test(String(raw))) {
// // //     const n = Number(raw);
// // //     return n < 1e12 ? n * 1000 : n;
// // //   }

// // //   return Date.parse(raw);
// // // }

// // // function getValue(point) {
// // //   const raw =
// // //     point?.avg ??
// // //     point?.value ??
// // //     point?.temperature ??
// // //     point?.current ??
// // //     point?.indoor_temperature;

// // //   if (raw == null || raw === "") return null;

// // //   const n = Number(raw);
// // //   return Number.isFinite(n) ? n : null;
// // // }

// // // function getRange(period, now = new Date()) {
// // //   const end = now.getTime();

// // //   if (period === "today") {
// // //     const start = new Date(now);
// // //     start.setHours(0, 0, 0, 0);
// // //     return { start: start.getTime(), end };
// // //   }

// // //   return {
// // //     start: end - PERIOD_MS[period],
// // //     end,
// // //   };
// // // }

// // // function formatXAxis(timestamp, period) {
// // //   const date = new Date(timestamp);

// // //   if (period === "today" || period === "12hr" || period === "24hr") {
// // //     return date.toLocaleTimeString([], {
// // //       hour: "2-digit",
// // //       minute: "2-digit",
// // //     });
// // //   }

// // //   return date.toLocaleDateString([], {
// // //     day: "2-digit",
// // //     month: "short",
// // //   });
// // // }

// // // function CurrentTempChart({
// // //   deviceId = "",
// // //   scope = {},
// // //   height = 320,
// // // }) {
// // //   const [period, setPeriod] = useState("today");
// // //   const [clock, setClock] = useState(Date.now());

// // //   // Pass the selected period to both history hooks.
// // //   // useMetricHistory must use period when requesting backend history.
// // //   const temperatureHistory = useMetricHistory({
// // //     metric: "indoor_temperature",
// // //     deviceId,
// // //     scope,
// // //     viewMode: period || "today",
// // //   });

// // //   const currentHistory = useMetricHistory({
// // //     metric: "current",
// // //     deviceId,
// // //     scope,
// // //     viewMode: period || "today",
// // //   });

// // //   const temperaturePoints =
// // //     temperatureHistory?.data ??
// // //     temperatureHistory?.points ??
// // //     temperatureHistory?.series ??
// // //     [];

// // //   const currentPoints =
// // //     currentHistory?.data ??
// // //     currentHistory?.points ??
// // //     currentHistory?.series ??
// // //     [];

// // //   const range = useMemo(
// // //     () => getRange(period, new Date(clock)),
// // //     [period, clock]
// // //   );

// // //   const chartData = useMemo(() => {
// // //     const byTime = new Map();

// // //     function addPoints(points, metric) {
// // //       if (!Array.isArray(points)) return;

// // //       points.forEach((point) => {
// // //         const timestamp = getTimestamp(point);

// // //         if (
// // //           !Number.isFinite(timestamp) ||
// // //           timestamp < range.start ||
// // //           timestamp > range.end
// // //         ) {
// // //           return;
// // //         }

// // //         const existing = byTime.get(timestamp) || {
// // //           timestamp,
// // //           temperature: null,
// // //           current: null,
// // //         };

// // //         existing[metric] = getValue(point);
// // //         byTime.set(timestamp, existing);
// // //       });
// // //     }

// // //     addPoints(temperaturePoints, "temperature");
// // //     addPoints(currentPoints, "current");

// // //     return Array.from(byTime.values()).sort(
// // //       (a, b) => a.timestamp - b.timestamp
// // //     );
// // //   }, [temperaturePoints, currentPoints, range]);

// // //   const ticks = useMemo(() => {
// // //     const step =
// // //       period === "today"
// // //         ? 2 * 60 * 60 * 1000
// // //         : period === "12hr"
// // //         ? 60 * 60 * 1000
// // //         : period === "24hr"
// // //         ? 2 * 60 * 60 * 1000
// // //         : period === "week"
// // //         ? 24 * 60 * 60 * 1000
// // //         : 5 * 24 * 60 * 60 * 1000;

// // //     const result = [];

// // //     for (
// // //       let timestamp = Math.ceil(range.start / step) * step;
// // //       timestamp <= range.end;
// // //       timestamp += step
// // //     ) {
// // //       result.push(timestamp);
// // //     }

// // //     return result;
// // //   }, [range, period]);

// // //   const loading =
// // //     Boolean(temperatureHistory?.loading) ||
// // //     Boolean(currentHistory?.loading);

// // //   const hasTemperature = chartData.some(
// // //     (point) => point.temperature != null
// // //   );

// // //   const hasCurrent = chartData.some(
// // //     (point) => point.current != null
// // //   );

// // //   return (
// // //     <div className="chart-box current-temp-chart">
// // //       <div className="chart-header">
// // //         <div>
// // //           <h3>Temperature & Current</h3>
// // //           <span>
// // //             Temperature on the left axis · Current on the right axis
// // //           </span>
// // //         </div>

// // //         <div className="current-temp-periods">
// // //           {PERIODS.map((item) => (
// // //             <button
// // //               key={item.value}
// // //               type="button"
// // //               className={
// // //                 period === item.value
// // //                   ? "current-temp-period active"
// // //                   : "current-temp-period"
// // //               }
// // //               onClick={() => {
// // //                 setPeriod(item.value);
// // //                 setClock(Date.now());
// // //               }}
// // //               aria-pressed={period === item.value}
// // //             >
// // //               {item.label}
// // //             </button>
// // //           ))}
// // //         </div>
// // //       </div>

// // //       {loading && chartData.length === 0 ? (
// // //         <div className="current-temp-message">
// // //           Loading history...
// // //         </div>
// // //       ) : chartData.length === 0 ? (
// // //         <div className="current-temp-message">
// // //           No readings available for this period.
// // //         </div>
// // //       ) : (
// // //         <ResponsiveContainer width="100%" height={height}>
// // //           <LineChart
// // //             data={chartData}
// // //             margin={{ top: 12, right: 65, left: 12, bottom: 8 }}
// // //           >
// // //             <CartesianGrid strokeDasharray="3 3" />

// // //             <XAxis
// // //               dataKey="timestamp"
// // //               type="number"
// // //               scale="time"
// // //               domain={[range.start, range.end]}
// // //               ticks={ticks}
// // //               tickFormatter={(value) => formatXAxis(value, period)}
// // //               tick={{ fontSize: 10 }}
// // //               minTickGap={20}
// // //             />

// // //             <YAxis
// // //               yAxisId="temperature"
// // //               orientation="left"
// // //               domain={["auto", "auto"]}
// // //               tick={{ fill: TEMP_CONFIG.color, fontSize: 11 }}
// // //               axisLine={{ stroke: TEMP_CONFIG.color }}
// // //               tickLine={{ stroke: TEMP_CONFIG.color }}
// // //               label={{
// // //                 value: "Temperature (°C)",
// // //                 angle: -90,
// // //                 position: "insideLeft",
// // //                 style: {
// // //                   textAnchor: "middle",
// // //                   fill: TEMP_CONFIG.color,
// // //                 },
// // //               }}
// // //             />

// // //             <YAxis
// // //               yAxisId="current"
// // //               orientation="right"
// // //               domain={["auto", "auto"]}
// // //               tick={{ fill: CURRENT_CONFIG.color, fontSize: 11 }}
// // //               axisLine={{ stroke: CURRENT_CONFIG.color }}
// // //               tickLine={{ stroke: CURRENT_CONFIG.color }}
// // //               label={{
// // //                 value: "Current (A)",
// // //                 angle: 90,
// // //                 position: "insideRight",
// // //                 style: {
// // //                   textAnchor: "middle",
// // //                   fill: CURRENT_CONFIG.color,
// // //                 },
// // //               }}
// // //             />

// // //             <Tooltip
// // //               labelFormatter={(value) =>
// // //                 new Date(value).toLocaleString()
// // //               }
// // //               formatter={(value, name) => {
// // //                 if (value == null) return ["No reading", name];

// // //                 return [
// // //                   name === "Temperature"
// // //                     ? `${Number(value).toFixed(1)} °C`
// // //                     : `${Number(value).toFixed(3)} A`,
// // //                   name,
// // //                 ];
// // //               }}
// // //             />

// // //             <Legend />

// // //             <Line
// // //               yAxisId="temperature"
// // //               type="monotone"
// // //               dataKey="temperature"
// // //               name="Temperature"
// // //               stroke={TEMP_CONFIG.color}
// // //               strokeWidth={2.5}
// // //               dot={false}
// // //               connectNulls={false}
// // //               isAnimationActive={false}
// // //             />

// // //             <Line
// // //               yAxisId="current"
// // //               type="monotone"
// // //               dataKey="current"
// // //               name="Current"
// // //               stroke={CURRENT_CONFIG.color}
// // //               strokeWidth={2.5}
// // //               dot={false}
// // //               connectNulls={false}
// // //               isAnimationActive={false}
// // //             />
// // //           </LineChart>
// // //         </ResponsiveContainer>
// // //       )}

// // //       {!loading && (
// // //         <small className="current-temp-status">
// // //           {!hasTemperature && "No temperature readings. "}
// // //           {!hasCurrent && "No current readings."}
// // //         </small>
// // //       )}
// // //     </div>
// // //   );
// // // }

// // // export default CurrentTempChart;




// import React, { useMemo, useState } from "react";
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


// const PERIOD_OPTIONS = [
//   { value: "today", label: "Today" },
//   { value: "12h", label: "12 hr" },
//   { value: "24h", label: "24 hr" },
//   { value: "week", label: "Week" },
//   { value: "month", label: "Month" },
// ];

// const MINUTE = 60 * 1000;
// const HOUR = 60 * MINUTE;

// const MONTH_NAMES = [
//   "Jan", "Feb", "Mar", "Apr", "May", "Jun",
//   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
// ];

// const pad2 = (n) => String(n).padStart(2, "0");

// function getRange(period, now = new Date()) {
//   const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
//   switch (period) {
//     case "12h":
//       return { from: new Date(now.getTime() - 12 * HOUR), to: now };
//     case "24h":
//       return { from: new Date(now.getTime() - 24 * HOUR), to: now };
//     case "week": {
//       const from = new Date(midnight);
//       from.setDate(from.getDate() - 6);
//       return { from, to: now };
//     }
//     case "month":
//       return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
//     case "today":
//     default:
//       return { from: midnight, to: now };
//   }
// }

// function bucketKey(ts, period) {
//   if (period === "today" || period === "12h" || period === "24h") {
//     return Math.floor(ts / (5 * MINUTE)) * 5 * MINUTE; // 5-minute buckets
//   }
//   if (period === "week") {
//     const d = new Date(ts);
//     d.setMinutes(0, 0, 0); // hourly
//     return d.getTime();
//   }
//   const d = new Date(ts); // daily (local midnight)
//   return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
// }

// function makeTicks(period, from, to) {
//   const fromMs = from.getTime();
//   const toMs = to.getTime();
//   const ticks = [];

//   if (period === "today") {
//     for (let h = 0; h < 24; h += 3) {
//       const t = new Date(from.getFullYear(), from.getMonth(), from.getDate(), h).getTime();
//       if (t >= fromMs && t <= toMs) ticks.push(t);
//     }
//     return ticks;
//   }

//   if (period === "12h" || period === "24h") {
//     const stepH = period === "12h" ? 2 : 3;
//     const start = new Date(from);
//     start.setMinutes(0, 0, 0);
//     start.setHours(start.getHours() + ((stepH - (start.getHours() % stepH)) % stepH));
//     for (let t = start.getTime(); t <= toMs; t += stepH * HOUR) ticks.push(t);
//     return ticks;
//   }

//   const stepD = period === "week" ? 1 : 3;
//   const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
//   while (d.getTime() <= toMs) {
//     if (d.getTime() >= fromMs) ticks.push(d.getTime());
//     d.setDate(d.getDate() + stepD);
//   }
//   return ticks;
// }

// function formatTick(ts, period) {
//   const d = new Date(ts);
//   if (period === "today" || period === "12h" || period === "24h") {
//     return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
//   }
//   return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
// }

// function formatLabel(ts, period) {
//   const d = new Date(ts);
//   const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
//   if (period === "today" || period === "12h" || period === "24h") return time;
//   return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}, ${time}`;
// }

// /* ------------------------------------------------------------------ *
//  *  Row parsers (unchanged from original component)
//  * ------------------------------------------------------------------ */
// function unwrap(row) {
//   let payload = row?.value ?? row?.data ?? row?.values ?? row;
//   for (let i = 0; i < 2 && typeof payload === "string"; i++) {
//     try {
//       payload = JSON.parse(payload);
//     } catch {
//       return row;
//     }
//   }
//   return payload && typeof payload === "object" ? { ...row, ...payload } : row;
// }

// function toNumber(value) {
//   if (value == null || value === "") return null;
//   const n = Number(value);
//   return Number.isFinite(n) ? n : null;
// }

// function parseTs(row) {
//   const raw =
//     row?.bucket ??
//     row?.bucket_start ??
//     row?.ts ??
//     row?.timestamp ??
//     row?.created_at ??
//     row?.time ??
//     row?.datetime;
//   if (raw == null || raw === "") return null;

//   const n = Number(raw);
//   if (Number.isFinite(n) && String(raw).trim() !== "") {
//     return n < 1e12 ? n * 1000 : n;
//   }
//   const ms = Date.parse(raw);
//   return Number.isFinite(ms) ? ms : null;
// }

// function getCurrent(row) {
//   const p = unwrap(row);
//   return toNumber(
//     p?.current ??
//       p?.Current ??
//       p?.avg ??
//       p?.current_avg ??
//       p?.avg_current ??
//       p?.values?.current
//   );
// }

// function getTemperature(row) {
//   const p = unwrap(row);
//   return toNumber(
//     p?.indoor_temperature ??
//       p?.indoor_temp ??
//       p?.temperature ??
//       p?.temp
//   );
// }

// function toPoints(rows, getValue) {
//   if (!Array.isArray(rows)) return [];
//   const out = [];
//   for (const row of rows) {
//     const ts = parseTs(row);
//     if (ts == null) continue;
//     const value = getValue(row);
//     if (value == null) continue;
//     out.push({ ts, value });
//   }
//   return out;
// }

// function aggregate(points, period, fromMs, toMs) {
//   const buckets = new Map();
//   for (const { ts, value } of points) {
//     if (ts < fromMs || ts > toMs) continue;
//     const key = bucketKey(ts, period);
//     let b = buckets.get(key);
//     if (!b) {
//       b = { t: key, sum: 0, count: 0 };
//       buckets.set(key, b);
//     }
//     b.sum += value;
//     b.count += 1;
//   }
//   return [...buckets.values()]
//     .sort((a, b) => a.t - b.t)
//     .map((b) => ({
//       t: b.t,
//       avg: Number((b.sum / b.count).toFixed(3)),
//       count: b.count,
//     }));
// }

// /* ------------------------------------------------------------------ *
//  *  Component
//  * ------------------------------------------------------------------ */
// function CurrentTemperatureChart({
//   currentData = [],
//   indoorData = [],
//   loading = false,
//   error = "",
//   height = 320,
// }) {
//   const [period, setPeriod] = useState("today");
//   const [expanded, setExpanded] = useState(false);

//   const { chartData, from, to, ticks, hasCurrent, hasTemperature } = useMemo(() => {
//     const now = new Date();
//     const { from, to } = getRange(period, now);
//     const fromMs = from.getTime();
//     const toMs = to.getTime();

//     const currentSeries = aggregate(
//       toPoints(currentData, getCurrent),
//       period,
//       fromMs,
//       toMs
//     );
//     const tempSeries = aggregate(
//       toPoints(indoorData, getTemperature),
//       period,
//       fromMs,
//       toMs
//     );

//     const merged = new Map();
//     for (const p of currentSeries) {
//       merged.set(p.t, { t: p.t, current: p.avg, temperature: null });
//     }
//     for (const p of tempSeries) {
//       const existing = merged.get(p.t);
//       if (existing) existing.temperature = p.avg;
//       else merged.set(p.t, { t: p.t, current: null, temperature: p.avg });
//     }

//     const chartData = [...merged.values()].sort((a, b) => a.t - b.t);

//     return {
//       chartData,
//       from,
//       to,
//       ticks: makeTicks(period, from, to),
//       hasCurrent: chartData.some((p) => p.current != null),
//       hasTemperature: chartData.some((p) => p.temperature != null),
//     };
//   }, [period, currentData, indoorData]);

//   const subtitle = (() => {
//     switch (period) {
//       case "12h":
//         return "Current and indoor temperature over the last 12 hours";
//       case "24h":
//         return "Current and indoor temperature over the last 24 hours";
//       case "week":
//         return "Current and indoor temperature this week (hourly averages)";
//       case "month":
//         return "Current and indoor temperature this month (daily averages)";
//       case "today":
//       default:
//         return "Current and indoor temperature for today (5-minute averages)";
//     }
//   })();

//   const chartHeight = expanded ? 600 : height;

//   return (
//     <div className={`chart-box current-temp-chart${expanded ? " expanded" : ""}`}>
//       {/* ---------------- header: title + dropdown + expand ---------------- */}
//       <div className="chart-header">
//         <div className="chart-title">
//           <h3>⚡ Current &amp; Temperature</h3>
//           <span>{subtitle}</span>
//         </div>

//         <div className="chart-controls">
//           <select
//             className="chart-period-select"
//             value={period}
//             onChange={(e) => setPeriod(e.target.value)}
//             aria-label="Select time range"
//           >
//             {PERIOD_OPTIONS.map((opt) => (
//               <option key={opt.value} value={opt.value}>
//                 {opt.label}
//               </option>
//             ))}
//           </select>

//           <button
//             type="button"
//             className="chart-expand-btn"
//             onClick={() => setExpanded((v) => !v)}
//             aria-label={expanded ? "Collapse chart" : "Expand chart"}
//             title={expanded ? "Collapse" : "Expand"}
//           >
//             {expanded ? "⤡" : "⤢"}
//           </button>
//         </div>
//       </div>

//       {/* ---------------- body ---------------- */}
//       {loading ? (
//         <div className="chart-empty">Loading chart data...</div>
//       ) : error && !chartData.length ? (
//         <div className="chart-empty">{error}</div>
//       ) : chartData.length ? (
//         <ResponsiveContainer width="100%" height={chartHeight}>
//           <LineChart
//             data={chartData}
//             margin={{ top: 10, right: 70, left: 10, bottom: 5 }}
//           >
//             <CartesianGrid strokeDasharray="3 3" />

//             <XAxis
//               dataKey="t"
//               type="number"
//               scale="time"
//               domain={[from.getTime(), to.getTime()]}
//               ticks={ticks}
//               tickFormatter={(v) => formatTick(v, period)}
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
//                 style: { textAnchor: "middle", fontSize: 11, fill: "#2563eb" },
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
//                 style: { textAnchor: "middle", fontSize: 11, fill: "#f97316" },
//               }}
//             />

//             <Tooltip
//               labelFormatter={(v) => formatLabel(v, period)}
//               formatter={(value, name) =>
//                 value == null
//                   ? ["No reading", name]
//                   : [
//                       `${Number(value).toFixed(2)} ${
//                         name === "Current" ? "A" : "°C"
//                       }`,
//                       name,
//                     ]
//               }
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
//         <div className="chart-empty">
//           No current or temperature history available for this period.
//         </div>
//       )}

//       {(!hasCurrent || !hasTemperature) && !loading && (
//         <small className="chart-note">
//           {!hasCurrent && "Waiting for current telemetry. "}
//           {!hasTemperature && "Waiting for indoor temperature telemetry."}
//         </small>
//       )}
//     </div>
//   );
// }

// export default CurrentTemperatureChart;

// Current & Temperature chart -- one AC at a time, straight from the database.
//
// What changed compared with the previous version
//  * It fetches its own data (/current-history/ with by_device=1), so the range
//    follows the dropdown (Week / Month used to be limited to the last 24 h).
//  * Every AC is its own series.  Readings of different ACs are never averaged
//    into one line; with several ACs in scope a selector picks which one to draw.
//  * 1-minute resolution for Today / 12 h / 24 h (was 5-minute averages), linear
//    lines (was "monotone", which invented curves) and no connectNulls, so a real
//    gap in the data is shown as a gap instead of a straight interpolated line.
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
import { API_BASE, getJSON, scopeToParams } from "../shared/api";

const PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "12h", label: "12 hr" },
  { value: "24h", label: "24 hr" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const pad2 = (n) => String(n).padStart(2, "0");

function getRange(period, now = new Date()) {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (period) {
    case "12h":
      return { from: new Date(now.getTime() - 12 * HOUR), to: now };
    case "24h":
      return { from: new Date(now.getTime() - 24 * HOUR), to: now };
    case "week": {
      const from = new Date(midnight);
      from.setDate(from.getDate() - 6);
      return { from, to: now };
    }
    case "month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
    case "today":
    default:
      return { from: midnight, to: now };
  }
}

function makeTicks(period, from, to) {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const ticks = [];

  if (period === "today") {
    for (let h = 0; h < 24; h += 3) {
      const t = new Date(from.getFullYear(), from.getMonth(), from.getDate(), h).getTime();
      if (t >= fromMs && t <= toMs) ticks.push(t);
    }
    return ticks;
  }

  if (period === "12h" || period === "24h") {
    const stepH = period === "12h" ? 2 : 3;
    const start = new Date(from);
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + ((stepH - (start.getHours() % stepH)) % stepH));
    for (let t = start.getTime(); t <= toMs; t += stepH * HOUR) ticks.push(t);
    return ticks;
  }

  const stepD = period === "week" ? 1 : 3;
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  while (d.getTime() <= toMs) {
    if (d.getTime() >= fromMs) ticks.push(d.getTime());
    d.setDate(d.getDate() + stepD);
  }
  return ticks;
}

function formatTick(ts, period) {
  const d = new Date(ts);
  if (period === "today" || period === "12h" || period === "24h") {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

function formatLabel(ts, period) {
  const d = new Date(ts);
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  if (period === "today" || period === "12h" || period === "24h") return time;
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}, ${time}`;
}


/* ------------------------------------------------------------------ *
 *  Data loading
 * ------------------------------------------------------------------ */
const REFRESH_MS = 10_000;

// what the backend needs for each dropdown value
function requestFor(period) {
  switch (period) {
    case "week":
      return { apiPeriod: "week", intervalSeconds: 900 };
    case "month":
      return { apiPeriod: "month", intervalSeconds: 3600 };
    case "24h":
      return { apiPeriod: "24h", intervalSeconds: 60 };
    default: // today, 12h
      return { apiPeriod: "today", intervalSeconds: 60 };
  }
}

const toNum = (v) => {
  const n = Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(n) ? null : n;
};

function useDeviceSeries({ period, deviceId, scope }) {
  const [state, setState] = useState({ current: [], temperature: [], loading: true, error: "" });
  const scopeJson = JSON.stringify(scope || {});

  useEffect(() => {
    let disposed = false;
    let controller = null;
    setState({ current: [], temperature: [], loading: true, error: "" });

    const run = async () => {
      controller?.abort();
      controller = new AbortController();
      const { signal } = controller;
      const { from, to } = getRange(period, new Date());
      const { apiPeriod, intervalSeconds } = requestFor(period);

      const build = (key) => {
        const params = new URLSearchParams({
          key,
          by_device: "1",
          period: apiPeriod,
          interval_seconds: String(intervalSeconds),
          from: String(from.getTime()),
          to: String(to.getTime()),
        });
        if (deviceId) params.set("device_id", String(deviceId));
        else scopeToParams(JSON.parse(scopeJson), params);
        return `${API_BASE}/current-history/?${params}`;
      };

      try {
        const [cur, temp] = await Promise.all([
          getJSON(build("current"), signal),
          getJSON(build("temperature"), signal),
        ]);
        if (disposed || signal.aborted) return;
        setState({
          current: cur?.series || [],
          temperature: temp?.series || [],
          loading: false,
          error: "",
        });
      } catch (err) {
        if (err?.name === "AbortError" || disposed) return;
        // keep what is on screen, just report the problem
        setState((prev) => ({ ...prev, loading: false, error: err?.message || "Unable to load history." }));
      }
    };

    run();
    const timer = window.setInterval(() => {
      if (!document.hidden) run();
    }, REFRESH_MS);
    return () => {
      disposed = true;
      controller?.abort();
      window.clearInterval(timer);
    };
  }, [period, deviceId, scopeJson]);

  return state;
}

// {bucket, avg}[] -> Map(ts -> value)
const toMap = (rows) => {
  const m = new Map();
  for (const r of rows || []) {
    const ts = Date.parse(r.bucket);
    const v = toNum(r.avg);
    if (Number.isFinite(ts) && v !== null) m.set(ts, v);
  }
  return m;
};

// One AC: merge current + temperature on the same timestamps.  Whenever two
// neighbouring readings are further apart than `maxGap`, a null point is put
// between them so the line breaks there (the device really sent nothing).
function buildChartData(currentRows, temperatureRows, stepMs) {
  const cur = toMap(currentRows);
  const tmp = toMap(temperatureRows);
  const times = [...new Set([...cur.keys(), ...tmp.keys()])].sort((a, b) => a - b);
  const maxGap = stepMs * 3;
  const out = [];
  let prev = null;
  for (const t of times) {
    if (prev !== null && t - prev > maxGap) out.push({ t: prev + stepMs, current: null, temperature: null });
    out.push({ t, current: cur.get(t) ?? null, temperature: tmp.get(t) ?? null });
    prev = t;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 *  Component
 * ------------------------------------------------------------------ */
function CurrentTemperatureChart({ deviceId = "", scope = {}, height = 320 }) {
  const [period, setPeriod] = useState("24h");
  const [expanded, setExpanded] = useState(false);
  const [picked, setPicked] = useState("");

  const { current, temperature, loading, error } = useDeviceSeries({ period, deviceId, scope });

  // every AC that has current or temperature rows
  const devices = useMemo(() => {
    const byId = new Map();
    [...current, ...temperature].forEach((s) => {
      if (!byId.has(s.device_id)) byId.set(s.device_id, s.device_name || s.device_id);
    });
    return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [current, temperature]);

  const activeId = devices.some((d) => d.id === picked) ? picked : devices[0]?.id || "";

  const { chartData, from, to, ticks, hasCurrent, hasTemperature } = useMemo(() => {
    const { from, to } = getRange(period, new Date());
    const { intervalSeconds } = requestFor(period);
    const rows = (list) => list.find((s) => s.device_id === activeId)?.data || [];
    const chartData = buildChartData(rows(current), rows(temperature), intervalSeconds * 1000);
    return {
      chartData,
      from,
      to,
      ticks: makeTicks(period, from, to),
      hasCurrent: chartData.some((p) => p.current != null),
      hasTemperature: chartData.some((p) => p.temperature != null),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, activeId, current, temperature]);

  const subtitle = {
    "12h": "Current and indoor temperature over the last 12 hours",
    "24h": "Current and indoor temperature over the last 24 hours",
    week: "Current and indoor temperature this week (15-minute averages)",
    month: "Current and indoor temperature this month (hourly averages)",
  }[period] || "Current and indoor temperature for today (1-minute averages)";

  const chartHeight = expanded ? 600 : height;

  return (
    <div className={`chart-box current-temp-chart${expanded ? " expanded" : ""}`}>
      <div className="chart-header">
        <div className="chart-title">
          <h3>⚡ Current &amp; Temperature</h3>
          <span>{subtitle}</span>
        </div>

        <div className="chart-controls">
          {devices.length > 1 && (
            <select
              className="chart-period-select"
              value={activeId}
              onChange={(e) => setPicked(e.target.value)}
              aria-label="Select AC"
            >
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}

          <select
            className="chart-period-select"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            aria-label="Select time range"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="chart-expand-btn"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Collapse chart" : "Expand chart"}
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? "⤡" : "⤢"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="chart-empty">Loading chart data...</div>
      ) : error && !chartData.length ? (
        <div className="chart-empty">{error}</div>
      ) : chartData.length ? (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart data={chartData} margin={{ top: 10, right: 70, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={[from.getTime(), to.getTime()]}
              ticks={ticks}
              tickFormatter={(v) => formatTick(v, period)}
              tick={{ fontSize: 10 }}
              minTickGap={20}
            />

            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: "#2563eb" }}
              axisLine={{ stroke: "#2563eb" }}
              tickLine={{ stroke: "#2563eb" }}
              domain={[0, "auto"]}
              label={{
                value: "Current (A)",
                angle: -90,
                position: "insideLeft",
                style: { textAnchor: "middle", fontSize: 11, fill: "#2563eb" },
              }}
            />

            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: "#f97316" }}
              axisLine={{ stroke: "#f97316" }}
              tickLine={{ stroke: "#f97316" }}
              domain={["auto", "auto"]}
              label={{
                value: "Temperature (°C)",
                angle: 90,
                position: "insideRight",
                style: { textAnchor: "middle", fontSize: 11, fill: "#f97316" },
              }}
            />

            <Tooltip
              labelFormatter={(v) => formatLabel(v, period)}
              formatter={(value, name) =>
                value == null
                  ? ["No reading", name]
                  : [`${Number(value).toFixed(2)} ${name === "Current" ? "A" : "°C"}`, name]
              }
            />

            <Legend />

            <Line
              yAxisId="left"
              type="linear"
              dataKey="current"
              name="Current"
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />

            <Line
              yAxisId="right"
              type="linear"
              dataKey="temperature"
              name="Temperature"
              stroke="#f97316"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="chart-empty">No current or temperature history available for this period.</div>
      )}

      {(!hasCurrent || !hasTemperature) && !loading && chartData.length > 0 && (
        <small className="chart-note">
          {!hasCurrent && "No current readings for this AC in this period. "}
          {!hasTemperature && "No indoor temperature readings for this AC in this period."}
        </small>
      )}
    </div>
  );
}

export default CurrentTemperatureChart;
