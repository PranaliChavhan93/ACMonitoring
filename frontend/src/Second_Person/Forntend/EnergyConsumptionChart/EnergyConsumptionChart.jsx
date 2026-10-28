
// // import { Maximize2, X } from "lucide-react";
// // import React, {
// //   useEffect,
// //   useMemo,
// //   useState,
// // } from "react";

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

// // import { HISTORY_URL, getJSON, scopeToParams } from "../shared/api";

// // // History comes from the backend's own database (telemetry_aggregate), never from ThingsBoard.
// // const REFRESH_MS = 2_000; // live: re-read the DB every 10 s
// // const BUCKET_SECONDS = 1800; // 30 min lines up with local hours/days (incl. IST)

// // const MONTH_NAMES = [
// //   "Jan", "Feb", "Mar", "Apr", "May", "Jun",
// //   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
// // ];

// // const GRANULARITY_OPTIONS = [
// //   { value: "daily", label: "Daily" },
// //   { value: "weekly", label: "Weekly" },
// //   { value: "monthly", label: "Monthly" },
// // ];

// // const pad2 = (n) => String(n).padStart(2, "0");

// // /* =========================================================
// //    DATA HELPERS
// // ========================================================= */

// // // Bucket start time: ISO string from the backend (or epoch seconds / milliseconds).
// // function parseDate(item) {
// //   const raw =
// //     item?.bucket ??
// //     item?.ts ??
// //     item?.timestamp ??
// //     item?.date ??
// //     item?.created_at ??
// //     item?.bucket_start;

// //   if (raw === undefined || raw === null || raw === "") {
// //     return null;
// //   }

// //   const numeric = Number(raw);
// //   const isNumeric =
// //     String(raw).trim() !== "" && Number.isFinite(numeric);

// //   const date = isNumeric
// //     ? new Date(numeric < 1e12 ? numeric * 1000 : numeric)
// //     : new Date(raw);

// //   return Number.isNaN(date.getTime()) ? null : date;
// // }

// // // Energy consumed inside one stored bucket (kWh), as summed by the backend.
// // function getEnergy(item) {
// //   const value = item?.avg ?? item?.energy_delta;
// //   if (value === undefined || value === null || value === "") return null;
// //   const number = Number(value);
// //   return Number.isFinite(number) ? number : null;
// // }

// // function normalizeRows(payload) {
// //   if (Array.isArray(payload)) return payload;

// //   if (!payload || typeof payload !== "object") {
// //     return [];
// //   }

// //   for (const key of ["data", "results", "records", "items"]) {
// //     if (Array.isArray(payload[key])) {
// //       return payload[key];
// //     }
// //   }

// //   // Supports a single record as well as an array.
// //   if (
// //     payload.data &&
// //     typeof payload.data === "object" &&
// //     !Array.isArray(payload.data)
// //   ) {
// //     return [payload.data];
// //   }

// //   return [];
// // }

// // /* =========================================================
// //    CHART BUCKETS
// // ========================================================= */

// // // Daily: each hour of the day.
// // // Weekly: each calendar day across the last seven days.
// // // Monthly: each calendar day in the current month.
// // // function getBucket(date, granularity) {
// // //   const year = date.getFullYear();
// // //   const month = date.getMonth();
// // //   const day = date.getDate();

// // //   if (granularity === "daily") {
// // //     const start = new Date(date);
// // //     start.setMinutes(0, 0, 0);

// // //     const hour = start.getHours();

// // //     return {
// // //       key: String(start.getTime()),
// // //       label: `${pad2(hour)}:00`,
// // //       sort: start.getTime(),
// // //     };
// // //   }

// // //   if (granularity === "weekly") {
// // //     const start = new Date(year, month, day);
// // //     start.setDate(start.getDate() - ((start.getDay() + 6) % 7));

// // //     return {
// // //       key: `${start.getFullYear()}-${pad2(
// // //         start.getMonth() + 1
// // //       )}-${pad2(start.getDate())}`,
// // //       label: `${start.getDate()} ${MONTH_NAMES[start.getMonth()]}`,
// // //       sort: start.getTime(),
// // //     };
// // //   }

// // //   const start = new Date(year, month, day);

// // //   return {
// // //     key: `${year}-${pad2(month + 1)}-${pad2(day)}`,
// // //     label: `${day} ${MONTH_NAMES[month]}`,
// // //     sort: start.getTime(),
// // //   };
// // // }


// // function getBucket(date, granularity) {
// //   // Daily → hourly bucket
// //   if (granularity === "daily") {
// //     const start = new Date(date);
// //     start.setMinutes(0, 0, 0);

// //     return {
// //       key: String(start.getTime()),
// //       label: `${pad2(start.getHours())}:00`,
// //       sort: start.getTime(),
// //     };
// //   }

// //   // Weekly & Monthly → daily bucket
// //   // (User wants "every day should point" / "every date should point")
// //   const start = new Date(
// //     date.getFullYear(),
// //     date.getMonth(),
// //     date.getDate()
// //   );

// //   return {
// //     key: `${start.getFullYear()}-${pad2(
// //       start.getMonth() + 1
// //     )}-${pad2(start.getDate())}`,
// //     label: `${start.getDate()} ${MONTH_NAMES[start.getMonth()]}`,
// //     sort: start.getTime(),
// //   };
// // }

// // function getDisplayRange(granularity, now = new Date()) {
// //   const today = new Date(
// //     now.getFullYear(),
// //     now.getMonth(),
// //     now.getDate()
// //   );

// //   if (granularity === "daily") {
// //     return {
// //       from: today,
// //       to: new Date(today.getTime() + 24 * 60 * 60 * 1000),
// //     };
// //   }

// //   if (granularity === "weekly") {
// //     const from = new Date(today);
// //     from.setDate(from.getDate() - 6);

// //     return {
// //       from,
// //       to: new Date(today.getTime() + 24 * 60 * 60 * 1000),
// //     };
// //   }

// //   return {
// //     from: new Date(today.getFullYear(), today.getMonth(), 1),
// //     to: new Date(today.getTime() + 24 * 60 * 60 * 1000),
// //   };
// // }

// // // Keep only buckets inside the displayed period and add up the energy used in
// // // each chart bucket (hour for "daily", calendar day for "weekly"/"monthly").
// // function buildChartData(rows, granularity, now = new Date()) {
// //   const { from, to } = getDisplayRange(granularity, now);
// //   const buckets = new Map();

// //   rows.forEach((item) => {
// //     const date = parseDate(item);
// //     if (!date || date < from || date >= to) return;

// //     const energy = getEnergy(item);
// //     if (energy === null) return;

// //     const bucket = getBucket(date, granularity);
// //     const entry = buckets.get(bucket.key);
// //     if (entry) entry.total += energy;
// //     else buckets.set(bucket.key, { name: bucket.label, sort: bucket.sort, total: energy });
// //   });

// //   return [...buckets.values()]
// //     .sort((a, b) => a.sort - b.sort)
// //     .map(({ name, total }) => ({
// //       name,
// //       currentMonth: Number(Math.max(0, total).toFixed(2)),
// //     }));
// // }

// // /* =========================================================
// //    NETWORK HELPERS
// // ========================================================= */

// // async function fetchEnergyHistory({ deviceId, scope, from, to, signal }) {
// //   const params = new URLSearchParams({
// //     key: "energy",
// //     period: "today",
// //     interval_seconds: String(BUCKET_SECONDS),
// //     from: String(from.getTime()),
// //     to: String(to.getTime()),
// //   });

// //   if (deviceId) params.set("device_id", String(deviceId));
// //   else scopeToParams(scope, params);

// //   return normalizeRows(await getJSON(`${HISTORY_URL}?${params}`, signal));
// // }

// // /* =========================================================
// //    STYLES
// // ========================================================= */

// // const iconButtonStyle = {
// //   display: "inline-flex",
// //   alignItems: "center",
// //   justifyContent: "center",
// //   width: 30,
// //   height: 30,
// //   padding: 0,
// //   border: "1px solid #e5e7eb",
// //   borderRadius: 8,
// //   background: "#fff",
// //   color: "#475569",
// //   cursor: "pointer",
// //   flexShrink: 0,
// // };

// // const overlayStyle = {
// //   position: "fixed",
// //   inset: 0,
// //   zIndex: 1000,
// //   display: "flex",
// //   padding: 24,
// //   boxSizing: "border-box",
// //   background: "rgba(15, 23, 42, 0.55)",
// // };

// // const modalStyle = {
// //   margin: "auto",
// //   display: "flex",
// //   flexDirection: "column",
// //   gap: 12,
// //   width: "min(1200px, 100%)",
// //   height: "min(760px, 100%)",
// //   padding: "20px 24px 16px",
// //   boxSizing: "border-box",
// //   background: "#fff",
// //   borderRadius: 14,
// //   boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
// //   overflow: "hidden",
// // };

// // /* =========================================================
// //    ENERGY CONSUMPTION TREND
// // ========================================================= */

// // function EnergyConsumptionChart({ deviceId = "", scope = {} }) {
// //   const [isExpanded, setIsExpanded] = useState(false);
// //   const [granularity, setGranularity] = useState("daily");
// //   const [historyRows, setHistoryRows] = useState([]);
// //   const [loading, setLoading] = useState(true);
// //   const [error, setError] = useState("");
// //   const [expanded, setExpanded] = useState(false);

// //   const scopeJson = JSON.stringify(scope || {});

// //   // One effect + one timer; changing device/scope aborts the previous request.
// //   useEffect(() => {
// //     let controller = null;
// //     let disposed = false;

// //     setHistoryRows([]);
// //     setError("");
// //     setLoading(true);

// //     const load = async () => {
// //       controller?.abort();
// //       controller = new AbortController();
// //       const { signal } = controller;

// //       try {
// //         // Longest period the chart can show: this month, or the last 7 days if longer.
// //         const now = new Date();
// //         const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
// //         const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
// //         const from = monthStart < weekStart ? monthStart : weekStart;

// //         const rows = await fetchEnergyHistory({
// //           deviceId,
// //           scope: JSON.parse(scopeJson),
// //           from,
// //           to: now,
// //           signal,
// //         });
// //         if (disposed || signal.aborted) return;
// //         setHistoryRows(rows);
// //         setError("");
// //       } catch (err) {
// //         if (err?.name === "AbortError" || disposed) return;
// //         setError(err?.message || "Unable to load historical energy data.");
// //       } finally {
// //         if (!disposed && !signal.aborted) setLoading(false);
// //       }
// //     };

// //     load();
// //     const timer = window.setInterval(() => {
// //       if (!document.hidden) load();
// //     }, REFRESH_MS);

// //     return () => {
// //       disposed = true;
// //       controller?.abort();
// //       window.clearInterval(timer);
// //     };
// //   }, [deviceId, scopeJson]);

// //   // Close the expanded chart with Escape and prevent background scrolling.
// //   useEffect(() => {
// //     if (!isExpanded) return;

// //     const onKeyDown = (event) => {
// //       if (event.key === "Escape") {
// //         setIsExpanded(false);
// //       }
// //     };

// //     const oldOverflow = document.body.style.overflow;
// //     document.body.style.overflow = "hidden";
// //     document.addEventListener("keydown", onKeyDown);

// //     return () => {
// //       document.body.style.overflow = oldOverflow;
// //       document.removeEventListener("keydown", onKeyDown);
// //     };
// //   }, [isExpanded]);

// //   const chartData = useMemo(
// //     () => buildChartData(historyRows, granularity),
// //     [historyRows, granularity]
// //   );

// //   const renderChart = (height) => (
// //     <ResponsiveContainer width="100%" height={height}>
// //       <LineChart
// //         data={chartData}
// //         margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
// //       >
// //         <CartesianGrid
// //           strokeDasharray="3 3"
// //           stroke="#e5e7eb"
// //         />

// //         <XAxis
// //           dataKey="name"
// //           tick={{ fontSize: 11 }}
// //           minTickGap={12}
// //         />

// //         <YAxis
// //           tick={{ fontSize: 11 }}
// //           width={65}
// //           label={{
// //             value: "Energy (kWh)",
// //             angle: -90,
// //             position: "insideLeft",
// //             fontSize: 11,
// //           }}
// //         />

// //         <Tooltip
// //           formatter={(value) => [
// //             `${Number(value).toFixed(2)} kWh`,
// //             "Energy consumed",
// //           ]}
// //           labelFormatter={(label) => `Time: ${label}`}
// //         />

// //         <Legend />

// //         <Line
// //           type="monotone"
// //           dataKey="currentMonth"
// //           name="Energy Consumption"
// //           stroke="#3182BD"
// //           strokeWidth={3}
// //           dot={{ r: 3 }}
// //           activeDot={{ r: 5 }}
// //           connectNulls={false}
// //         />
// //       </LineChart>
// //     </ResponsiveContainer>
// //   );

// //   const renderContent = (height) => {
// //     if (loading) {
// //       return <p>Loading historical energy data...</p>;
// //     }

// //     if (error && chartData.length === 0) {
// //       return <p role="alert">{error}</p>;
// //     }

// //     if (chartData.length === 0) {
// //       return (
// //         <p>
// //           No energy readings are stored for the selected period.
// //         </p>
// //       );
// //     }

// //     return renderChart(height);
// //   };

// //   return (
// //     <>
// //       <div className="chart-box">
// //         <div className="chart-header">
// //           <h3>▥ Energy Consumption Trend</h3>

// //           <div style={{ display: "flex", gap: 8 }}>
// //             <select
// //               className="chart-select"
// //               value={granularity}
// //               onChange={(event) =>
// //                 setGranularity(event.target.value)
// //               }
// //               aria-label="Trend time period"
// //             >
// //               {GRANULARITY_OPTIONS.map((option) => (
// //                 <option
// //                   key={option.value}
// //                   value={option.value}
// //                 >
// //                   {option.label}
// //                 </option>
// //               ))}
// //             </select>

// //             <button
// //               type="button"
// //               style={iconButtonStyle}
// //               onClick={() => setIsExpanded(true)}
// //               title="Expand chart"
// //               aria-label="Expand chart"
// //             >
// //               <svg
// //                 width="16"
// //                 height="16"
// //                 viewBox="0 0 24 24"
// //                 fill="none"
// //                 stroke="currentColor"
// //                 strokeWidth="2"
// //               >
// //                 <polyline points="15 3 21 3 21 9" />
// //                 <polyline points="9 21 3 21 3 15" />
// //                 <line x1="21" y1="3" x2="14" y2="10" />
// //                 <line x1="3" y1="21" x2="10" y2="14" />
// //               </svg>
// //             </button>
// //           </div>
// //         </div>

// //         {renderContent(250)}
// //       </div>

// //       {isExpanded && (
// //         <div
// //           style={overlayStyle}
// //           onClick={() => setIsExpanded(false)}
// //         >
// //           <div
// //             style={modalStyle}
// //             role="dialog"
// //             aria-modal="true"
// //             aria-label="Energy Consumption Trend"
// //             onClick={(event) => event.stopPropagation()}
// //           >
// //             <div className="chart-header">
// //               <h3>▥ Energy Consumption Trend</h3>

// //               {/* <button
// //                 type="button"
// //                 style={iconButtonStyle}
// //                 onClick={() => setIsExpanded(false)}
// //                 aria-label="Close chart"
// //               >
// //                 ×
// //               </button> */}

// //               <button
// //                 type="button"
// //                 className="chart-expand-btn"
// //                 onClick={() => setIsExpanded(false)}
// //                 title={expanded ? "Restore Window" : "Expand Window"}
// //                 aria-label={expanded ? "Restore Window" : "Expand Window"}
// //               >
// //                 {expanded ? <X size={18} /> : <Maximize2 size={18} />}
// //               </button>

// //             </div>

    
// //             <div style={{ flex: 1, minHeight: 0 }}>
// //               {renderContent("100%")}
// //             </div>
// //           </div>
// //         </div>
// //       )}
// //     </>
// //   );
// // }

// // export default EnergyConsumptionChart;



// import { Maximize2, X } from "lucide-react";
// import React, { useEffect, useMemo, useState } from "react";

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

// import { HISTORY_URL, getJSON, scopeToParams } from "../shared/api";

// // History comes from the backend's own database (telemetry_aggregate), never from ThingsBoard.
// const REFRESH_MS = 2_000; // live: re-read the DB every 2 s
// const BUCKET_SECONDS = 1800; // 30 min buckets, aligned with local hours/days (incl. IST)

// const MONTH_NAMES = [
//   "Jan", "Feb", "Mar", "Apr", "May", "Jun",
//   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
// ];

// const GRANULARITY_OPTIONS = [
//   { value: "daily", label: "Daily" },
//   { value: "weekly", label: "Weekly" },
//   { value: "monthly", label: "Monthly" },
// ];

// const pad2 = (n) => String(n).padStart(2, "0");

// /* =========================================================
//    DATA HELPERS
// ========================================================= */

// // Bucket start time: ISO string from the backend (or epoch seconds / milliseconds).
// function parseDate(item) {
//   const raw =
//     item?.bucket ??
//     item?.ts ??
//     item?.timestamp ??
//     item?.date ??
//     item?.created_at ??
//     item?.bucket_start;

//   if (raw === undefined || raw === null || raw === "") {
//     return null;
//   }

//   const numeric = Number(raw);
//   const isNumeric = String(raw).trim() !== "" && Number.isFinite(numeric);

//   const date = isNumeric
//     ? new Date(numeric < 1e12 ? numeric * 1000 : numeric)
//     : new Date(raw);

//   return Number.isNaN(date.getTime()) ? null : date;
// }

// // Energy consumed inside one stored bucket (kWh), as summed by the backend.
// function getEnergy(item) {
//   const value = item?.avg ?? item?.energy_delta;
//   if (value === undefined || value === null || value === "") return null;
//   const number = Number(value);
//   return Number.isFinite(number) ? number : null;
// }

// function normalizeRows(payload) {
//   if (Array.isArray(payload)) return payload;

//   if (!payload || typeof payload !== "object") {
//     return [];
//   }

//   for (const key of ["data", "results", "records", "items"]) {
//     if (Array.isArray(payload[key])) {
//       return payload[key];
//     }
//   }

//   if (
//     payload.data &&
//     typeof payload.data === "object" &&
//     !Array.isArray(payload.data)
//   ) {
//     return [payload.data];
//   }

//   return [];
// }

// /* =========================================================
//    CHART BUCKETS
// ========================================================= */

// // The X-axis label is time-of-day only for the *daily* view, and a calendar
// // date for the *weekly* / *monthly* views.
// //
// //   daily   → hour bucket  → "14:00"   (time)
// //   weekly  → day  bucket  → "15 Jan"  (date)
// //   monthly → day  bucket  → "15 Jan"  (date)
// function getBucket(date, granularity) {
//   if (granularity === "daily") {
//     const start = new Date(date);
//     start.setMinutes(0, 0, 0);

//     return {
//       key: String(start.getTime()),
//       label: `${pad2(start.getHours())}:00`,
//       sort: start.getTime(),
//     };
//   }

//   // weekly / monthly → group per calendar day
//   const start = new Date(
//     date.getFullYear(),
//     date.getMonth(),
//     date.getDate()
//   );

//   return {
//     key: `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(
//       start.getDate()
//     )}`,
//     label: `${start.getDate()} ${MONTH_NAMES[start.getMonth()]}`,
//     sort: start.getTime(),
//   };
// }

// function getDisplayRange(granularity, now = new Date()) {
//   const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

//   if (granularity === "daily") {
//     return {
//       from: today,
//       to: new Date(today.getTime() + 24 * 60 * 60 * 1000),
//     };
//   }

//   if (granularity === "weekly") {
//     const from = new Date(today);
//     from.setDate(from.getDate() - 6);

//     return {
//       from,
//       to: new Date(today.getTime() + 24 * 60 * 60 * 1000),
//     };
//   }

//   return {
//     from: new Date(today.getFullYear(), today.getMonth(), 1),
//     to: new Date(today.getTime() + 24 * 60 * 60 * 1000),
//   };
// }

// // Keep only buckets inside the displayed period and add up the energy used in
// // each chart bucket (hour for "daily", calendar day for "weekly"/"monthly").
// function buildChartData(rows, granularity, now = new Date()) {
//   const { from, to } = getDisplayRange(granularity, now);
//   const buckets = new Map();

//   rows.forEach((item) => {
//     const date = parseDate(item);
//     if (!date || date < from || date >= to) return;

//     const energy = getEnergy(item);
//     if (energy === null) return;

//     const bucket = getBucket(date, granularity);
//     const entry = buckets.get(bucket.key);
//     if (entry) entry.total += energy;
//     else buckets.set(bucket.key, { name: bucket.label, sort: bucket.sort, total: energy });
//   });

//   return [...buckets.values()]
//     .sort((a, b) => a.sort - b.sort)
//     .map(({ name, total }) => ({
//       name,
//       currentMonth: Number(Math.max(0, total).toFixed(2)),
//     }));
// }

// /* =========================================================
//    NETWORK HELPERS
// ========================================================= */

// async function fetchEnergyHistory({ deviceId, scope, from, to, signal }) {
//   const params = new URLSearchParams({
//     key: "energy",
//     period: "today",
//     interval_seconds: String(BUCKET_SECONDS),
//     from: String(from.getTime()),
//     to: String(to.getTime()),
//   });

//   if (deviceId) params.set("device_id", String(deviceId));
//   else scopeToParams(scope, params);

//   return normalizeRows(await getJSON(`${HISTORY_URL}?${params}`, signal));
// }

// /* =========================================================
//    STYLES
// ========================================================= */

// const iconButtonStyle = {
//   display: "inline-flex",
//   alignItems: "center",
//   justifyContent: "center",
//   width: 30,
//   height: 30,
//   padding: 0,
//   border: "1px solid #e5e7eb",
//   borderRadius: 8,
//   background: "#fff",
//   color: "#475569",
//   cursor: "pointer",
//   flexShrink: 0,
// };

// const overlayStyle = {
//   position: "fixed",
//   inset: 0,
//   zIndex: 1000,
//   display: "flex",
//   padding: 24,
//   boxSizing: "border-box",
//   background: "rgba(15, 23, 42, 0.55)",
// };

// const modalStyle = {
//   margin: "auto",
//   display: "flex",
//   flexDirection: "column",
//   gap: 12,
//   width: "min(1200px, 100%)",
//   height: "min(760px, 100%)",
//   padding: "20px 24px 16px",
//   boxSizing: "border-box",
//   background: "#fff",
//   borderRadius: 14,
//   boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
//   overflow: "hidden",
// };

// /* =========================================================
//    ENERGY CONSUMPTION TREND
// ========================================================= */

// function EnergyConsumptionChart({ deviceId = "", scope = {} }) {
//   const [isExpanded, setIsExpanded] = useState(false);
//   const [granularity, setGranularity] = useState("daily");
//   const [historyRows, setHistoryRows] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");

//   const scopeJson = JSON.stringify(scope || {});

//   // One effect + one timer; changing device/scope aborts the previous request.
//   useEffect(() => {
//     let controller = null;
//     let disposed = false;

//     setHistoryRows([]);
//     setError("");
//     setLoading(true);

//     const load = async () => {
//       controller?.abort();
//       controller = new AbortController();
//       const { signal } = controller;

//       try {
//         // Longest period the chart can show: this month, or the last 7 days if longer.
//         const now = new Date();
//         const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
//         const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
//         const from = monthStart < weekStart ? monthStart : weekStart;

//         const rows = await fetchEnergyHistory({
//           deviceId,
//           scope: JSON.parse(scopeJson),
//           from,
//           to: now,
//           signal,
//         });
//         if (disposed || signal.aborted) return;
//         setHistoryRows(rows);
//         setError("");
//       } catch (err) {
//         if (err?.name === "AbortError" || disposed) return;
//         setError(err?.message || "Unable to load historical energy data.");
//       } finally {
//         if (!disposed && !signal.aborted) setLoading(false);
//       }
//     };

//     load();
//     const timer = window.setInterval(() => {
//       if (!document.hidden) load();
//     }, REFRESH_MS);

//     return () => {
//       disposed = true;
//       controller?.abort();
//       window.clearInterval(timer);
//     };
//   }, [deviceId, scopeJson]);

//   // Close the expanded chart with Escape and prevent background scrolling.
//   useEffect(() => {
//     if (!isExpanded) return;

//     const onKeyDown = (event) => {
//       if (event.key === "Escape") {
//         setIsExpanded(false);
//       }
//     };

//     const oldOverflow = document.body.style.overflow;
//     document.body.style.overflow = "hidden";
//     document.addEventListener("keydown", onKeyDown);

//     return () => {
//       document.body.style.overflow = oldOverflow;
//       document.removeEventListener("keydown", onKeyDown);
//     };
//   }, [isExpanded]);

//   const chartData = useMemo(
//     () => buildChartData(historyRows, granularity),
//     [historyRows, granularity]
//   );

//   const renderChart = (height) => (
//     <ResponsiveContainer width="100%" height={height}>
//       <LineChart
//         data={chartData}
//         margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
//       >
//         <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

//         <XAxis
//           dataKey="name"
//           tick={{ fontSize: 11 }}
//           minTickGap={12}
//         />

//         <YAxis
//           tick={{ fontSize: 11 }}
//           width={65}
//           label={{
//             value: "Energy (kWh)",
//             angle: -90,
//             position: "insideLeft",
//             fontSize: 11,
//           }}
//         />

//         <Tooltip
//           formatter={(value) => [
//             `${Number(value).toFixed(2)} kWh`,
//             "Energy consumed",
//           ]}
//           labelFormatter={(label) => `Time: ${label}`}
//         />

//         <Legend />

//         <Line
//           type="monotone"
//           dataKey="currentMonth"
//           name="Energy Consumption"
//           stroke="#3182BD"
//           strokeWidth={3}
//           dot={{ r: 3 }}
//           activeDot={{ r: 5 }}
//           connectNulls={false}
//         />
//       </LineChart>
//     </ResponsiveContainer>
//   );

//   const renderContent = (height) => {
//     if (loading) {
//       return <p>Loading historical energy data...</p>;
//     }

//     if (error && chartData.length === 0) {
//       return <p role="alert">{error}</p>;
//     }

//     if (chartData.length === 0) {
//       return (
//         <p>
//           No energy readings are stored for the selected period.
//         </p>
//       );
//     }

//     return renderChart(height);
//   };

//   return (
//     <>
//       <div className="chart-box">
//         <div className="chart-header">
//           <h3>▥ Energy Consumption Trend</h3>

//           <div style={{ display: "flex", gap: 8 }}>
//             <select
//               className="chart-select"
//               value={granularity}
//               onChange={(event) =>
//                 setGranularity(event.target.value)
//               }
//               aria-label="Trend time period"
//             >
//               {GRANULARITY_OPTIONS.map((option) => (
//                 <option key={option.value} value={option.value}>
//                   {option.label}
//                 </option>
//               ))}
//             </select>

//             <button
//               type="button"
//               style={iconButtonStyle}
//               onClick={() => setIsExpanded(true)}
//               title="Expand chart"
//               aria-label="Expand chart"
//             >
//               <svg
//                 width="16"
//                 height="16"
//                 viewBox="0 0 24 24"
//                 fill="none"
//                 stroke="currentColor"
//                 strokeWidth="2"
//               >
//                 <polyline points="15 3 21 3 21 9" />
//                 <polyline points="9 21 3 21 3 15" />
//                 <line x1="21" y1="3" x2="14" y2="10" />
//                 <line x1="3" y1="21" x2="10" y2="14" />
//               </svg>
//             </button>
//           </div>
//         </div>

//         {renderContent(250)}
//       </div>

//       {isExpanded && (
//         <div
//           style={overlayStyle}
//           onClick={() => setIsExpanded(false)}
//         >
//           <div
//             style={modalStyle}
//             role="dialog"
//             aria-modal="true"
//             aria-label="Energy Consumption Trend"
//             onClick={(event) => event.stopPropagation()}
//           >
//             <div className="chart-header">
//               <h3>▥ Energy Consumption Trend</h3>

//               <button
//                 type="button"
//                 className="chart-expand-btn"
//                 onClick={() => setIsExpanded(false)}
//                 title={isExpanded ? "Restore Window" : "Expand Window"}
//                 aria-label={isExpanded ? "Restore Window" : "Expand Window"}
//               >
//                 {isExpanded ? <X size={18} /> : <Maximize2 size={18} />}
//               </button>
//             </div>

//             <div style={{ flex: 1, minHeight: 0 }}>
//               {renderContent("100%")}
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }

// export default EnergyConsumptionChart;


import { Maximize2, X } from "lucide-react";
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
  ReferenceArea,
} from "recharts";

import { HISTORY_URL, getJSON, scopeToParams } from "../shared/api";
import { IndexZoomFrame } from "../shared/chartZoom";

// History comes from the backend's own database (telemetry_aggregate), never from ThingsBoard.
const REFRESH_MS = 2_000;
const BUCKET_SECONDS = 1800;

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

/* =========================================================
   DATA HELPERS (unchanged)
========================================================= */
function parseDate(item) {
  const raw =
    item?.bucket ??
    item?.ts ??
    item?.timestamp ??
    item?.date ??
    item?.created_at ??
    item?.bucket_start;

  if (raw === undefined || raw === null || raw === "") return null;

  const numeric = Number(raw);
  const isNumeric = String(raw).trim() !== "" && Number.isFinite(numeric);

  const date = isNumeric
    ? new Date(numeric < 1e12 ? numeric * 1000 : numeric)
    : new Date(raw);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getEnergy(item) {
  const value = item?.avg ?? item?.energy_delta;
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  for (const key of ["data", "results", "records", "items"]) {
    if (Array.isArray(payload[key])) return payload[key];
  }

  if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
    return [payload.data];
  }

  return [];
}

/* =========================================================
   CHART BUCKETS (unchanged)
========================================================= */
function getBucket(date, granularity) {
  if (granularity === "daily") {
    const start = new Date(date);
    start.setMinutes(0, 0, 0);
    return {
      key: String(start.getTime()),
      label: `${pad2(start.getHours())}:00`,
      sort: start.getTime(),
    };
  }

  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return {
    key: `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`,
    label: `${start.getDate()} ${MONTH_NAMES[start.getMonth()]}`,
    sort: start.getTime(),
  };
}

function getDisplayRange(granularity, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (granularity === "daily") {
    return { from: today, to: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
  }

  if (granularity === "weekly") {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from, to: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
  }

  return {
    from: new Date(today.getFullYear(), today.getMonth(), 1),
    to: new Date(today.getTime() + 24 * 60 * 60 * 1000),
  };
}

function buildChartData(rows, granularity, now = new Date()) {
  const { from, to } = getDisplayRange(granularity, now);
  const buckets = new Map();

  rows.forEach((item) => {
    const date = parseDate(item);
    if (!date || date < from || date >= to) return;

    const energy = getEnergy(item);
    if (energy === null) return;

    const bucket = getBucket(date, granularity);
    const entry = buckets.get(bucket.key);
    if (entry) entry.total += energy;
    else buckets.set(bucket.key, { name: bucket.label, sort: bucket.sort, total: energy });
  });

  return [...buckets.values()]
    .sort((a, b) => a.sort - b.sort)
    .map(({ name, total }) => ({
      name,
      currentMonth: Number(Math.max(0, total).toFixed(2)),
    }));
}

/* =========================================================
   NETWORK HELPERS (unchanged)
========================================================= */
async function fetchEnergyHistory({ deviceId, scope, from, to, signal }) {
  const params = new URLSearchParams({
    key: "energy",
    period: "today",
    interval_seconds: String(BUCKET_SECONDS),
    from: String(from.getTime()),
    to: String(to.getTime()),
  });

  if (deviceId) params.set("device_id", String(deviceId));
  else scopeToParams(scope, params);

  return normalizeRows(await getJSON(`${HISTORY_URL}?${params}`, signal));
}

/* =========================================================
   COMPONENT
========================================================= */
function EnergyConsumptionChart({ deviceId = "", scope = {} }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [granularity, setGranularity] = useState("daily");
  const [historyRows, setHistoryRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const scopeJson = JSON.stringify(scope || {});

  // One effect + one timer; changing device/scope aborts the previous request.
  useEffect(() => {
    let controller = null;
    let disposed = false;

    setHistoryRows([]);
    setError("");
    setLoading(true);

    const load = async () => {
      controller?.abort();
      controller = new AbortController();
      const { signal } = controller;

      try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        const from = monthStart < weekStart ? monthStart : weekStart;

        const rows = await fetchEnergyHistory({
          deviceId,
          scope: JSON.parse(scopeJson),
          from,
          to: now,
          signal,
        });
        if (disposed || signal.aborted) return;
        setHistoryRows(rows);
        setError("");
      } catch (err) {
        if (err?.name === "AbortError" || disposed) return;
        setError(err?.message || "Unable to load historical energy data.");
      } finally {
        if (!disposed && !signal.aborted) setLoading(false);
      }
    };

    load();
    const timer = window.setInterval(() => {
      if (!document.hidden) load();
    }, REFRESH_MS);

    return () => {
      disposed = true;
      controller?.abort();
      window.clearInterval(timer);
    };
  }, [deviceId, scopeJson]);

  // Close the expanded chart with Escape and prevent background scrolling.
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
    () => buildChartData(historyRows, granularity),
    [historyRows, granularity]
  );

  const chartHeight = isExpanded ? 520 : 250;

  const renderChart = (rows, chartProps, selection) => (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <LineChart
        data={rows}
        margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
        {...chartProps}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

        <XAxis dataKey="name" tick={{ fontSize: 11 }} minTickGap={12} />

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
          formatter={(value) => [`${Number(value).toFixed(2)} kWh`, "Energy consumed"]}
          labelFormatter={(label) => `Time: ${label}`}
        />

        <Legend />

        {selection && (
          <ReferenceArea
            x1={selection.x1}
            x2={selection.x2}
            fill="#2563eb"
            fillOpacity={0.12}
            stroke="#2563eb"
            strokeOpacity={0.35}
          />
        )}

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

  const renderContent = () => {
    if (loading) {
      return <div className="chart-empty">Loading historical energy data...</div>;
    }

    if (error && chartData.length === 0) {
      return <div className="chart-empty">{error}</div>;
    }

    if (chartData.length === 0) {
      return (
        <div className="chart-empty">
          No energy readings are stored for the selected period.
        </div>
      );
    }

    // Zoom: Ctrl+scroll / pinch / drag / toolbar zoom the graph (a window of buckets), not the page.
    return (
      <IndexZoomFrame data={chartData} resetKey={`${granularity}|${deviceId}|${scopeJson}`}>
        {(visible, { chartProps, selection }) => renderChart(visible, chartProps, selection)}
      </IndexZoomFrame>
    );
  };

  return (
    <div
      className={`chart-box current-history-card${isExpanded ? " current-history-expanded" : ""}`}
    >
      <div className="chart-header">
        <div>
          <h3>▥ Energy Consumption Trend</h3>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <select
            className="chart-select"
            value={granularity}
            onChange={(event) => setGranularity(event.target.value)}
            aria-label="Trend time period"
          >
            {GRANULARITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="chart-expand-btn"
            onClick={() => setIsExpanded((prev) => !prev)}
            title={isExpanded ? "Restore Window" : "Expand Window"}
            aria-label={isExpanded ? "Restore Window" : "Expand Window"}
          >
            {isExpanded ? <X size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      {renderContent()}
    </div>
  );
}

export default EnergyConsumptionChart;