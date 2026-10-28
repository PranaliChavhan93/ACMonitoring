// // // // // // import React, { useMemo } from "react";
// // // // // // import {
// // // // // //     ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
// // // // // // } from "recharts";

// // // // // // const CHART_INTERVAL_MS = 10 * 1000;

// // // // // // const timestampOf = (item) => {
// // // // // //     const raw = item?.timestamp ?? item?.ts ?? item?.time ?? item?.created_at ?? item?.datetime;
// // // // // //     if (raw == null || raw === "") return NaN;
// // // // // //     if (typeof raw === "number") return raw > 1e12 ? raw : raw * 1000;
// // // // // //     const parsed = Date.parse(raw);
// // // // // //     return Number.isFinite(parsed) ? parsed : NaN;
// // // // // // };

// // // // // // const indoorValue = (item) => {
// // // // // //     const value = item?.indoor_temperature ?? item?.indoor_temp ?? item?.temperature ?? item?.temp;
// // // // // //     return value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
// // // // // // };

// // // // // // const outdoorValue = (item) => {
// // // // // //     const value = item?.temperature_2m ?? item?.outdoor_temperature ?? item?.temperature;
// // // // // //     return value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
// // // // // // };

// // // // // // // Keep every indoor telemetry timestamp (the dashboard's existing cadence) as an X-axis point.
// // // // // // // The hourly outdoor series is interpolated at those exact timestamps for a fair comparison.
// // // // // // function outdoorAt(timestamp, weather) {
// // // // // //     if (!weather.length) return null;
// // // // // //     let before = null;
// // // // // //     let after = null;
// // // // // //     for (const point of weather) {
// // // // // //         if (point.timestampMs <= timestamp) before = point;
// // // // // //         if (point.timestampMs >= timestamp) { after = point; break; }
// // // // // //     }
// // // // // //     if (!before) return after?.value ?? null;
// // // // // //     if (!after) return before.value ?? null;
// // // // // //     if (before.value == null && after.value == null) return null;
// // // // // //     if (before.value == null) return after.value;
// // // // // //     if (after.value == null) return before.value;
// // // // // //     if (before.timestampMs === after.timestampMs) return before.value;
// // // // // //     const ratio = (timestamp - before.timestampMs) / (after.timestampMs - before.timestampMs);
// // // // // //     return before.value + (after.value - before.value) * ratio;
// // // // // // }

// // // // // // function TemperatureChart({ data = [], indoorData = [], locationName = "selected branch", status = "idle", error = "" }) {
// // // // // //     const chartData = useMemo(() => {
// // // // // //         const weather = data.map((item) => ({ timestampMs: timestampOf(item), value: outdoorValue(item) }))
// // // // // //             .filter((p) => Number.isFinite(p.timestampMs) && p.value != null)
// // // // // //             .sort((a, b) => a.timestampMs - b.timestampMs);
// // // // // //         const indoor = indoorData.map((item) => ({ timestampMs: timestampOf(item), value: indoorValue(item) }))
// // // // // //             .filter((p) => Number.isFinite(p.timestampMs))
// // // // // //             .sort((a, b) => a.timestampMs - b.timestampMs);

// // // // // //             if (indoor.length) {
// // // // // //                 // Sort and keep one indoor reading per 10-second interval.
// // // // // //                 const sampledIndoor = [];
// // // // // //                 let lastBucket = null;

// // // // // //                 for (const point of indoor) {
// // // // // //                     const bucket = Math.floor(
// // // // // //                         point.timestampMs / CHART_INTERVAL_MS
// // // // // //                     );

// // // // // //                     if (bucket !== lastBucket) {
// // // // // //                         sampledIndoor.push(point);
// // // // // //                         lastBucket = bucket;
// // // // // //                     }
// // // // // //                 }

// // // // // //                 return sampledIndoor.map((point) => ({
// // // // // //                     timestampMs: point.timestampMs,
// // // // // //                     name: new Date(point.timestampMs).toLocaleTimeString([], {
// // // // // //                         hour: "2-digit",
// // // // // //                         minute: "2-digit",
// // // // // //                         second: "2-digit",
// // // // // //                     }),
// // // // // //                     indoorTemperature: point.value,
// // // // // //                     outdoorTemperature: outdoorAt(point.timestampMs, weather),
// // // // // //                 }));
// // // // // //             }        return weather.map((point) => ({
// // // // // //             timestampMs: point.timestampMs,
// // // // // //             name: new Date(point.timestampMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
// // // // // //             indoorTemperature: null,
// // // // // //             outdoorTemperature: point.value,
// // // // // //         }));
// // // // // //     }, [data, indoorData]);

// // // // // //     const hasOutdoor = data.some((item) => outdoorValue(item) != null);
// // // // // //     const hasIndoor = indoorData.some((item) => indoorValue(item) != null);

// // // // // //     return (
// // // // // //         <div className="chart-box">
// // // // // //             <div className="chart-header"><div>
// // // // // //                 <h3>🌡 Temperature Monitoring</h3>
// // // // // //                 <span>{locationName ? `Device temperature and outdoor weather near ${locationName}` : "Device temperature and outdoor weather"}</span>
// // // // // //             </div></div>
// // // // // //             {chartData.length ? <ResponsiveContainer width="100%" height={280}>
// // // // // //                 <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
// // // // // //                     <CartesianGrid strokeDasharray="3 3" />
// // // // // //                     <XAxis dataKey="name" tick={{ fontSize: 10 }} minTickGap={24} />
// // // // // //                     <YAxis tick={{ fontSize: 11 }} unit="°C" />
// // // // // //                     <Tooltip formatter={(value, name) => [value == null ? "No reading" : `${Number(value).toFixed(1)} °C`, name]} />
// // // // // //                     <Legend />
// // // // // //                     <Line type="monotone" dataKey="indoorTemperature" name="Indoor" stroke="#3182bd" strokeWidth={2.5} dot={false} connectNulls />
// // // // // //                     <Line type="monotone" dataKey="outdoorTemperature" name="Outdoor" stroke="#f28e2b" strokeWidth={2.5} dot={false} connectNulls />
// // // // // //                 </LineChart>
// // // // // //             </ResponsiveContainer> : <div style={{ minHeight: 120, display: "grid", placeItems: "center", padding: 16, textAlign: "center" }}>{status === "loading" ? "Loading outdoor weather…" : error || "Temperature data will appear when device readings and branch coordinates are available."}</div>}
// // // // // //             {!hasIndoor && <small style={{ display: "block", padding: "0 12px 8px", color: "#64748b" }}>Waiting for indoor temperature telemetry from the device.</small>}
// // // // // //             {!hasOutdoor && status !== "loading" && <small style={{ display: "block", padding: "0 12px 8px", color: "#64748b" }}>Outdoor temperature is unavailable until valid branch coordinates are saved.</small>}
// // // // // //         </div>
// // // // // //     );
// // // // // // }

// // // // // // export default TemperatureChart;


// // // // // // import React, { useMemo } from "react";
// // // // // // import {
// // // // // //     ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
// // // // // // } from "recharts";

// // // // // // const CHART_INTERVAL_MS = 10 * 1000;

// // // // // // const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

// // // // // // const makeTimeTicks = (now = Date.now()) => {
// // // // // //     const start = now - WINDOW_MS;
// // // // // //     const first = Math.ceil(start / TWO_HOURS_MS) * TWO_HOURS_MS;
// // // // // //     const ticks = [];
// // // // // //     for (let t = first; t <= now; t += TWO_HOURS_MS) ticks.push(t);
// // // // // //     return ticks;
// // // // // // };

// // // // // // const timestampOf = (item) => {
// // // // // //     const raw = item?.timestamp ?? item?.ts ?? item?.time ?? item?.created_at ?? item?.datetime;
// // // // // //     if (raw == null || raw === "") return NaN;
// // // // // //     if (typeof raw === "number") return raw > 1e12 ? raw : raw * 1000;
// // // // // //     const parsed = Date.parse(raw);
// // // // // //     return Number.isFinite(parsed) ? parsed : NaN;
// // // // // // };

// // // // // // const indoorValue = (item) => {
// // // // // //     const value = item?.indoor_temperature ?? item?.indoor_temp ?? item?.temperature ?? item?.temp;
// // // // // //     return value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
// // // // // // };

// // // // // // const outdoorValue = (item) => {
// // // // // //     const value = item?.temperature_2m ?? item?.outdoor_temperature ?? item?.temperature;
// // // // // //     return value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
// // // // // // };

// // // // // // // Keep every indoor telemetry timestamp (the dashboard's existing cadence) as an X-axis point.
// // // // // // // The hourly outdoor series is interpolated at those exact timestamps for a fair comparison.
// // // // // // function outdoorAt(timestamp, weather) {
// // // // // //     if (!weather.length) return null;
// // // // // //     let before = null;
// // // // // //     let after = null;
// // // // // //     for (const point of weather) {
// // // // // //         if (point.timestampMs <= timestamp) before = point;
// // // // // //         if (point.timestampMs >= timestamp) { after = point; break; }
// // // // // //     }
// // // // // //     if (!before) return after?.value ?? null;
// // // // // //     if (!after) return before.value ?? null;
// // // // // //     if (before.value == null && after.value == null) return null;
// // // // // //     if (before.value == null) return after.value;
// // // // // //     if (after.value == null) return before.value;
// // // // // //     if (before.timestampMs === after.timestampMs) return before.value;
// // // // // //     const ratio = (timestamp - before.timestampMs) / (after.timestampMs - before.timestampMs);
// // // // // //     return before.value + (after.value - before.value) * ratio;
// // // // // // }

// // // // // // function TemperatureChart({ data = [], indoorData = [], locationName = "selected branch", status = "idle", error = "" }) {
// // // // // //     const chartData = useMemo(() => {
// // // // // //         const weather = data.map((item) => ({ timestampMs: timestampOf(item), value: outdoorValue(item) }))
// // // // // //             .filter((p) => Number.isFinite(p.timestampMs) && p.value != null)
// // // // // //             .sort((a, b) => a.timestampMs - b.timestampMs);
// // // // // //         const indoor = indoorData.map((item) => ({ timestampMs: timestampOf(item), value: indoorValue(item) }))
// // // // // //             .filter((p) => Number.isFinite(p.timestampMs))
// // // // // //             .sort((a, b) => a.timestampMs - b.timestampMs);

// // // // // //             if (indoor.length) {
// // // // // //                 // Sort and keep one indoor reading per 10-second interval.
// // // // // //                 const sampledIndoor = [];
// // // // // //                 let lastBucket = null;

// // // // // //                 for (const point of indoor) {
// // // // // //                     const bucket = Math.floor(
// // // // // //                         point.timestampMs / CHART_INTERVAL_MS
// // // // // //                     );

// // // // // //                     if (bucket !== lastBucket) {
// // // // // //                         sampledIndoor.push(point);
// // // // // //                         lastBucket = bucket;
// // // // // //                     }
// // // // // //                 }

// // // // // //                 return sampledIndoor.map((point) => ({
// // // // // //                     timestampMs: point.timestampMs,
// // // // // //                     name: new Date(point.timestampMs).toLocaleTimeString([], {
// // // // // //                         hour: "2-digit",
// // // // // //                         minute: "2-digit",
// // // // // //                         second: "2-digit",
// // // // // //                     }),
// // // // // //                     indoorTemperature: point.value,
// // // // // //                     outdoorTemperature: outdoorAt(point.timestampMs, weather),
// // // // // //                 }));
// // // // // //             }        return weather.map((point) => ({
// // // // // //             timestampMs: point.timestampMs,
// // // // // //             name: new Date(point.timestampMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
// // // // // //             indoorTemperature: null,
// // // // // //             outdoorTemperature: point.value,
// // // // // //         }));
// // // // // //     }, [data, indoorData]);

// // // // // //     const hasOutdoor = data.some((item) => outdoorValue(item) != null);
// // // // // //     const hasIndoor = indoorData.some((item) => indoorValue(item) != null);

// // // // // //     return (
// // // // // //         <div className="chart-box">
// // // // // //             <div className="chart-header"><div>
// // // // // //                 <h3>🌡 Temperature Monitoring</h3>
// // // // // //                 <span>{locationName ? `Device temperature and outdoor weather near ${locationName}` : "Device temperature and outdoor weather"}</span>
// // // // // //             </div></div>
// // // // // //             {chartData.length ? <ResponsiveContainer width="100%" height={280}>
// // // // // //                 <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
// // // // // //                     <CartesianGrid strokeDasharray="3 3" />
// // // // // //                     <XAxis
// // // // //                     //     dataKey="timestampMs"
// // // // //                     //     type="number"
// // // // //                     //     scale="time"
// // // // //                     //     domain={[Date.now() - WINDOW_MS, "dataMax"]}
// // // // //                     //     ticks={makeTimeTicks()}
// // // // //                     //     tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
// // // // //                     //     tick={{ fontSize: 10 }}
// // // // //                     //     minTickGap={20}
// // // // //                     //     allowDataOverflow={false}
// // // // //                     // />
// // // // // //                     <YAxis tick={{ fontSize: 11 }} unit="°C" />
// // // // // //                     <Tooltip formatter={(value, name) => [value == null ? "No reading" : `${Number(value).toFixed(1)} °C`, name]} />
// // // // // //                     <Legend />
// // // // // //                     <Line type="monotone" dataKey="indoorTemperature" name="Indoor" stroke="#3182bd" strokeWidth={2.5} dot={false} connectNulls />
// // // // // //                     <Line type="monotone" dataKey="outdoorTemperature" name="Outdoor" stroke="#f28e2b" strokeWidth={2.5} dot={false} connectNulls />
// // // // // //                 </LineChart>
// // // // // //             </ResponsiveContainer> : <div style={{ minHeight: 120, display: "grid", placeItems: "center", padding: 16, textAlign: "center" }}>{status === "loading" ? "Loading outdoor weather…" : error || "Temperature data will appear when device readings and branch coordinates are available."}</div>}
// // // // // //             {!hasIndoor && <small style={{ display: "block", padding: "0 12px 8px", color: "#64748b" }}>Waiting for indoor temperature telemetry from the device.</small>}
// // // // // //             {!hasOutdoor && status !== "loading" && <small style={{ display: "block", padding: "0 12px 8px", color: "#64748b" }}>Outdoor temperature is unavailable until valid branch coordinates are saved.</small>}
// // // // // //         </div>
// // // // // //     );
// // // // // // }

// // // // // // export default TemperatureChart;



// // // // // import React, { useMemo } from "react";
// // // // // import {
// // // // //     ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
// // // // // } from "recharts";

// // // // // // Show the past 24 hours, and cap the number of rendered points
// // // // // // so the chart stays smooth even with 10-second telemetry.
// // // // // const WINDOW_MS = 24 * 60 * 60 * 1000;          // 24 hours
// // // // // const MAX_POINTS = 300;                          // target point budget
// // // // // const MIN_SAMPLE_MS = 10 * 1000;                 // never sample finer than 10s
// // // // // const SAMPLE_INTERVAL_MS = Math.max(
// // // // //     MIN_SAMPLE_MS,
// // // // //     Math.floor(WINDOW_MS / MAX_POINTS)           // ~4.8 min buckets for 24h
// // // // // );

// // // // // const timestampOf = (item) => {
// // // // //     const raw = item?.timestamp ?? item?.ts ?? item?.time ?? item?.created_at ?? item?.datetime;
// // // // //     if (raw == null || raw === "") return NaN;
// // // // //     if (typeof raw === "number") return raw > 1e12 ? raw : raw * 1000;
// // // // //     const parsed = Date.parse(raw);
// // // // //     return Number.isFinite(parsed) ? parsed : NaN;
// // // // // };

// // // // // const indoorValue = (item) => {
// // // // //     const value = item?.indoor_temperature ?? item?.indoor_temp ?? item?.temperature ?? item?.temp;
// // // // //     return value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
// // // // // };

// // // // // const outdoorValue = (item) => {
// // // // //     const value = item?.temperature_2m ?? item?.outdoor_temperature ?? item?.temperature;
// // // // //     return value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
// // // // // };

// // // // // // Interpolate the hourly outdoor series at an arbitrary indoor timestamp.
// // // // // function outdoorAt(timestamp, weather) {
// // // // //     if (!weather.length) return null;
// // // // //     let before = null;
// // // // //     let after = null;
// // // // //     for (const point of weather) {
// // // // //         if (point.timestampMs <= timestamp) before = point;
// // // // //         if (point.timestampMs >= timestamp) { after = point; break; }
// // // // //     }
// // // // //     if (!before) return after?.value ?? null;
// // // // //     if (!after) return before.value ?? null;
// // // // //     if (before.value == null && after.value == null) return null;
// // // // //     if (before.value == null) return after.value;
// // // // //     if (after.value == null) return before.value;
// // // // //     if (before.timestampMs === after.timestampMs) return before.value;
// // // // //     const ratio = (timestamp - before.timestampMs) / (after.timestampMs - before.timestampMs);
// // // // //     return before.value + (after.value - before.value) * ratio;
// // // // // }

// // // // // function TemperatureChart({
// // // // //     data = [],
// // // // //     indoorData = [],
// // // // //     locationName = "selected branch",
// // // // //     status = "idle",
// // // // //     error = "",
// // // // // }) {
// // // // //     const { chartData, hasIndoor, hasOutdoor } = useMemo(() => {
// // // // //         const cutoff = Date.now() - WINDOW_MS;

// // // // //         const weather = data
// // // // //             .map((item) => ({ timestampMs: timestampOf(item), value: outdoorValue(item) }))
// // // // //             .filter((p) => Number.isFinite(p.timestampMs) && p.value != null && p.timestampMs >= cutoff)
// // // // //             .sort((a, b) => a.timestampMs - b.timestampMs);

// // // // //         const indoor = indoorData
// // // // //             .map((item) => ({ timestampMs: timestampOf(item), value: indoorValue(item) }))
// // // // //             .filter((p) => Number.isFinite(p.timestampMs) && p.timestampMs >= cutoff)
// // // // //             .sort((a, b) => a.timestampMs - b.timestampMs);

// // // // //         const hasIndoor = indoor.some((p) => p.value != null);
// // // // //         const hasOutdoor = weather.length > 0;

// // // // //         const labelFor = (ms) =>
// // // // //             new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// // // // //         let chartData;
// // // // //         if (indoor.length) {
// // // // //             // Downsample: keep one indoor reading per SAMPLE_INTERVAL_MS bucket.
// // // // //             const sampled = [];
// // // // //             let lastBucket = null;
// // // // //             for (const point of indoor) {
// // // // //                 const bucket = Math.floor(point.timestampMs / SAMPLE_INTERVAL_MS);
// // // // //                 if (bucket !== lastBucket) {
// // // // //                     sampled.push(point);
// // // // //                     lastBucket = bucket;
// // // // //                 }
// // // // //             }

// // // // //             chartData = sampled.map((point) => ({
// // // // //                 timestampMs: point.timestampMs,
// // // // //                 name: labelFor(point.timestampMs),
// // // // //                 indoorTemperature: point.value,
// // // // //                 outdoorTemperature: outdoorAt(point.timestampMs, weather),
// // // // //             }));
// // // // //         } else {
// // // // //             chartData = weather.map((point) => ({
// // // // //                 timestampMs: point.timestampMs,
// // // // //                 name: labelFor(point.timestampMs),
// // // // //                 indoorTemperature: null,
// // // // //                 outdoorTemperature: point.value,
// // // // //             }));
// // // // //         }

// // // // //         return { chartData, hasIndoor, hasOutdoor };
// // // // //     }, [data, indoorData]);

// // // // //     return (
// // // // //         <div className="chart-box">
// // // // //             <div className="chart-header">
// // // // //                 <div>
// // // // //                     <h3>🌡 Temperature Monitoring</h3>
// // // // //                     <span>
// // // // //                         {locationName
// // // // //                             ? `Device temperature and outdoor weather over the past 24 hours near ${locationName}`
// // // // //                             : "Device temperature and outdoor weather over the past 24 hours"}
// // // // //                     </span>
// // // // //                 </div>
// // // // //             </div>

// // // // //             {chartData.length ? (
// // // // //                 <ResponsiveContainer width="100%" height={280}>
// // // // //                     <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
// // // // //                         <CartesianGrid strokeDasharray="3 3" />
// // // // //                         <XAxis
// // // // //                             dataKey="timestampMs"
// // // // //                             type="number"
// // // // //                             scale="time"
// // // // //                             domain={[Date.now() - WINDOW_MS, "dataMax"]}
// // // // //                             ticks={makeTimeTicks()}
// // // // //                             tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
// // // // //                             tick={{ fontSize: 10 }}
// // // // //                             minTickGap={20}
// // // // //                             allowDataOverflow={false}
// // // // //                         />
// // // // //                         <YAxis tick={{ fontSize: 11 }} unit="°C" />
// // // // //                         <Tooltip
// // // // //                             formatter={(value, name) => [
// // // // //                                 value == null ? "No reading" : `${Number(value).toFixed(1)} °C`,
// // // // //                                 name,
// // // // //                             ]}
// // // // //                         />
// // // // //                         <Legend />
// // // // //                         <Line
// // // // //                             type="monotone"
// // // // //                             dataKey="indoorTemperature"
// // // // //                             name="Indoor"
// // // // //                             stroke="#3182bd"
// // // // //                             strokeWidth={2.5}
// // // // //                             dot={false}
// // // // //                             connectNulls
// // // // //                         />
// // // // //                         <Line
// // // // //                             type="monotone"
// // // // //                             dataKey="outdoorTemperature"
// // // // //                             name="Outdoor"
// // // // //                             stroke="#f28e2b"
// // // // //                             strokeWidth={2.5}
// // // // //                             dot={false}
// // // // //                             connectNulls
// // // // //                         />
// // // // //                     </LineChart>
// // // // //                 </ResponsiveContainer>
// // // // //             ) : (
// // // // //                 <div
// // // // //                     style={{
// // // // //                         minHeight: 120,
// // // // //                         display: "grid",
// // // // //                         placeItems: "center",
// // // // //                         padding: 16,
// // // // //                         textAlign: "center",
// // // // //                     }}
// // // // //                 >
// // // // //                     {status === "loading"
// // // // //                         ? "Loading outdoor weather…"
// // // // //                         : error ||
// // // // //                           "Temperature data will appear when device readings and branch coordinates are available."}
// // // // //                 </div>
// // // // //             )}

// // // // //             {!hasIndoor && (
// // // // //                 <small style={{ display: "block", padding: "0 12px 8px", color: "#64748b" }}>
// // // // //                     Waiting for indoor temperature telemetry from the device.
// // // // //                 </small>
// // // // //             )}
// // // // //             {!hasOutdoor && status !== "loading" && (
// // // // //                 <small style={{ display: "block", padding: "0 12px 8px", color: "#64748b" }}>
// // // // //                     Outdoor temperature is unavailable until valid branch coordinates are saved.
// // // // //                 </small>
// // // // //             )}
// // // // //         </div>
// // // // //     );
// // // // // }

// // // // // export default TemperatureChart;


// // // import React, { useMemo } from "react";
// // // import {
// // //     ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
// // // } from "recharts";

// // // // Show the past 24 hours, and cap the number of rendered points
// // // // so the chart stays smooth even with 10-second telemetry.
// // // const WINDOW_MS = 24 * 60 * 60 * 1000;          // 24 hours
// // // const MAX_POINTS = 300;                          // target point budget
// // // const MIN_SAMPLE_MS = 10 * 1000;                 // never sample finer than 10s
// // // const SAMPLE_INTERVAL_MS = Math.max(
// // //     MIN_SAMPLE_MS,
// // //     Math.floor(WINDOW_MS / MAX_POINTS)           // ~4.8 min buckets for 24h
// // // );

// // // // One tick every 2 hours across the 24h window → 13 ticks.
// // // const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
// // // const makeTimeTicks = (startMs, endMs) => {
// // //     const first = Math.ceil(startMs / TWO_HOURS_MS) * TWO_HOURS_MS;
// // //     const ticks = [];
// // //     for (let t = first; t <= endMs; t += TWO_HOURS_MS) ticks.push(t);
// // //     return ticks;
// // // };

// // // const timestampOf = (item) => {
// // //     const raw = item?.timestamp ?? item?.ts ?? item?.time ?? item?.created_at ?? item?.datetime;
// // //     if (raw == null || raw === "") return NaN;
// // //     if (typeof raw === "number") return raw > 1e12 ? raw : raw * 1000;
// // //     const parsed = Date.parse(raw);
// // //     return Number.isFinite(parsed) ? parsed : NaN;
// // // };

// // // const indoorValue = (item) => {
// // //     const value = item?.indoor_temperature ?? item?.indoor_temp ?? item?.temperature ?? item?.temp;
// // //     return value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
// // // };

// // // const outdoorValue = (item) => {
// // //     const value = item?.temperature_2m ?? item?.outdoor_temperature ?? item?.temperature;
// // //     return value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
// // // };

// // // // Interpolate the hourly outdoor series at an arbitrary indoor timestamp.
// // // function outdoorAt(timestamp, weather) {
// // //     if (!weather.length) return null;
// // //     let before = null;
// // //     let after = null;
// // //     for (const point of weather) {
// // //         if (point.timestampMs <= timestamp) before = point;
// // //         if (point.timestampMs >= timestamp) { after = point; break; }
// // //     }
// // //     if (!before) return after?.value ?? null;
// // //     if (!after) return before.value ?? null;
// // //     if (before.value == null && after.value == null) return null;
// // //     if (before.value == null) return after.value;
// // //     if (after.value == null) return before.value;
// // //     if (before.timestampMs === after.timestampMs) return before.value;
// // //     const ratio = (timestamp - before.timestampMs) / (after.timestampMs - before.timestampMs);
// // //     return before.value + (after.value - before.value) * ratio;
// // // }

// // // function TemperatureChart({
// // //     data = [],
// // //     indoorData = [],
// // //     locationName = "selected branch",
// // //     status = "idle",
// // //     error = "",
// // // }) {
// // //     const { chartData, hasIndoor, hasOutdoor, windowStart, windowEnd, timeTicks } = useMemo(() => {
// // //         // Compute the window once per memo so domain + ticks stay consistent.
// // //         const windowEnd = Date.now();
// // //         const windowStart = windowEnd - WINDOW_MS;

// // //         const weather = data
// // //             .map((item) => ({ timestampMs: timestampOf(item), value: outdoorValue(item) }))
// // //             .filter((p) => Number.isFinite(p.timestampMs) && p.value != null && p.timestampMs >= windowStart)
// // //             .sort((a, b) => a.timestampMs - b.timestampMs);

// // //         const indoor = indoorData
// // //             .map((item) => ({ timestampMs: timestampOf(item), value: indoorValue(item) }))
// // //             .filter((p) => Number.isFinite(p.timestampMs) && p.timestampMs >= windowStart)
// // //             .sort((a, b) => a.timestampMs - b.timestampMs);

// // //         const hasIndoor = indoor.some((p) => p.value != null);
// // //         const hasOutdoor = weather.length > 0;

// // //         const labelFor = (ms) =>
// // //             new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// // //         let chartData;
// // //         if (indoor.length) {
// // //             // Downsample: keep one indoor reading per SAMPLE_INTERVAL_MS bucket.
// // //             const sampled = [];
// // //             let lastBucket = null;
// // //             for (const point of indoor) {
// // //                 const bucket = Math.floor(point.timestampMs / SAMPLE_INTERVAL_MS);
// // //                 if (bucket !== lastBucket) {
// // //                     sampled.push(point);
// // //                     lastBucket = bucket;
// // //                 }
// // //             }

// // //             chartData = sampled.map((point) => ({
// // //                 timestampMs: point.timestampMs,
// // //                 name: labelFor(point.timestampMs),
// // //                 indoorTemperature: point.value,
// // //                 outdoorTemperature: outdoorAt(point.timestampMs, weather),
// // //             }));
// // //         } else {
// // //             chartData = weather.map((point) => ({
// // //                 timestampMs: point.timestampMs,
// // //                 name: labelFor(point.timestampMs),
// // //                 indoorTemperature: null,
// // //                 outdoorTemperature: point.value,
// // //             }));
// // //         }

// // //         return {
// // //             chartData,
// // //             hasIndoor,
// // //             hasOutdoor,
// // //             windowStart,
// // //             windowEnd,
// // //             timeTicks: makeTimeTicks(windowStart, windowEnd),
// // //         };
// // //     }, [data, indoorData]);

// // //     return (
// // //         <div className="chart-box">
// // //             <div className="chart-header">
// // //                 <div>
// // //                     <h3>🌡 Temperature Monitoring</h3>
// // //                     <span>
// // //                         {locationName
// // //                             ? `Device temperature and outdoor weather over the past 24 hours near ${locationName}`
// // //                             : "Device temperature and outdoor weather over the past 24 hours"}
// // //                     </span>
// // //                 </div>
// // //             </div>

// // //             {chartData.length ? (
// // //                 <ResponsiveContainer width="100%" height={280}>
// // //                     <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
// // //                         <CartesianGrid strokeDasharray="3 3" />
// // //                         <XAxis
// // //                             dataKey="timestampMs"
// // //                             type="number"
// // //                             scale="time"
// // //                             domain={[windowStart, "dataMax"]}
// // //                             ticks={timeTicks}
// // //                             tickFormatter={(value) =>
// // //                                 new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
// // //                             }
// // //                             tick={{ fontSize: 10 }}
// // //                             minTickGap={20}
// // //                             allowDataOverflow={false}
// // //                         />
// // //                         <YAxis tick={{ fontSize: 11 }} unit="°C" />
// // //                         <Tooltip
// // //                             formatter={(value, name) => [ value == null ? "No reading" : `${Number(value).toFixed(1)} °C`, name,
// // //                             ]}
// // //                             labelFormatter={(ms) =>
// // //                                 new Date(ms).toLocaleString([], {
// // //                                     // month: "short",
// // //                                     // day: "numeric",
// // //                                     hour: "2-digit",
// // //                                     minute: "2-digit",
// // //                                 })
// // //                             }
// // //                         />
// // //                         {/* <Tooltip formatter={(value, name) => [value == null ? "No reading" : `${Number(value).toFixed(1)}%`, name]} /> */}
                        
// // //                         <Legend />
// // //                         <Line
// // //                             type="monotone"
// // //                             dataKey="indoorTemperature"
// // //                             name="Indoor"
// // //                             stroke="#3182bd"
// // //                             strokeWidth={2.5}
// // //                             dot={false}
// // //                             connectNulls
// // //                         />
// // //                         <Line
// // //                             type="monotone"
// // //                             dataKey="outdoorTemperature"
// // //                             name="Outdoor"
// // //                             stroke="#f28e2b"
// // //                             strokeWidth={2.5}
// // //                             dot={false}
// // //                             connectNulls
// // //                         />
// // //                     </LineChart>
// // //                 </ResponsiveContainer>
// // //             ) : (
// // //                 <div
// // //                     style={{
// // //                         minHeight: 120,
// // //                         display: "grid",
// // //                         placeItems: "center",
// // //                         padding: 16,
// // //                         textAlign: "center",
// // //                     }}
// // //                 >
// // //                     {status === "loading"
// // //                         ? "Loading outdoor weather…"
// // //                         : error ||
// // //                           "Temperature data will appear when device readings and branch coordinates are available."}
// // //                 </div>
// // //             )}

// // //             {!hasIndoor && (
// // //                 <small style={{ display: "block", padding: "0 12px 8px", color: "#64748b" }}>
// // //                     Waiting for indoor temperature telemetry from the device.
// // //                 </small>
// // //             )}
// // //             {!hasOutdoor && status !== "loading" && (
// // //                 <small style={{ display: "block", padding: "0 12px 8px", color: "#64748b" }}>
// // //                     Outdoor temperature is unavailable until valid branch coordinates are saved.
// // //                 </small>
// // //             )}
// // //         </div>
// // //     );
// // // }

// // // export default TemperatureChart;


// // // import React from "react";
// // // import MetricHistoryChart from "../shared/MetricHistoryChart";

// // // function TemperatureChart({
// // //     deviceId = "",
// // //     scope = {},
// // // }) {
// // //     return (
// // //         <MetricHistoryChart
// // //             config={{
// // //                 metric: "temperature",
// // //                 title: "Temperature History",
// // //                 seriesName: "Indoor Temperature",
// // //                 subtitleDevice: "Selected AC · Historical temperature",
// // //                 subtitleScope: "Branch · Historical temperature",
// // //                 unit: "°C",
// // //                 yLabel: "Temperature (°C)",
// // //                 decimals: 1,
// // //                 color: "#3182bd",
// // //                 yDomain: ["auto", "auto"],
// // //             }}
// // //             deviceId={deviceId}
// // //             scope={scope}
// // //             height={280}
// // //         />
// // //     );
// // // }

// // // export default TemperatureChart;

// // import React from "react";
// // import MetricHistoryChart from "../shared/MetricHistoryChart";

// // function TemperatureChart({
// //     deviceId = "",
// //     scope = {},
// // }) {
// //     return (
// //         <MetricHistoryChart
// //             config={{
// //                 metric: "temperature",
// //                 title: "Temperature History",
// //                 seriesName: "Indoor Temperature",
// //                 subtitleDevice: "Selected AC · Historical temperature",
// //                 subtitleScope: "Branch · Historical temperature",
// //                 unit: "°C",
// //                 yLabel: "Temperature (°C)",
// //                 decimals: 1,
// //                 color: "#3182bd",
// //                 yDomain: ["auto", "auto"],
// //             }}
// //             deviceId={deviceId}
// //             scope={scope}
// //             height={280}
// //         />
// //     );
// // }

// // export default TemperatureChart;


// // // import React, { useMemo } from "react";
// // // import {
// // //     ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
// // // } from "recharts";

// // // const CHART_INTERVAL_MS = 10 * 1000;

// // // const timestampOf = (item) => {
// // //     const raw = item?.timestamp ?? item?.ts ?? item?.time ?? item?.created_at ?? item?.datetime;
// // //     if (raw == null || raw === "") return NaN;
// // //     if (typeof raw === "number") return raw > 1e12 ? raw : raw * 1000;
// // //     const parsed = Date.parse(raw);
// // //     return Number.isFinite(parsed) ? parsed : NaN;
// // // };

// // // const indoorValue = (item) => {
// // //     const value = item?.indoor_temperature ?? item?.indoor_temp ?? item?.temperature ?? item?.temp;
// // //     return value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
// // // };

// // // const outdoorValue = (item) => {
// // //     const value = item?.temperature_2m ?? item?.outdoor_temperature ?? item?.temperature;
// // //     return value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
// // // };

// // // // Keep every indoor telemetry timestamp (the dashboard's existing cadence) as an X-axis point.
// // // // The hourly outdoor series is interpolated at those exact timestamps for a fair comparison.
// // // function outdoorAt(timestamp, weather) {
// // //     if (!weather.length) return null;
// // //     let before = null;
// // //     let after = null;
// // //     for (const point of weather) {
// // //         if (point.timestampMs <= timestamp) before = point;
// // //         if (point.timestampMs >= timestamp) { after = point; break; }
// // //     }
// // //     if (!before) return after?.value ?? null;
// // //     if (!after) return before.value ?? null;
// // //     if (before.value == null && after.value == null) return null;
// // //     if (before.value == null) return after.value;
// // //     if (after.value == null) return before.value;
// // //     if (before.timestampMs === after.timestampMs) return before.value;
// // //     const ratio = (timestamp - before.timestampMs) / (after.timestampMs - before.timestampMs);
// // //     return before.value + (after.value - before.value) * ratio;
// // // }

// // // function TemperatureChart({ data = [], indoorData = [], locationName = "selected branch", status = "idle", error = "" }) {
// // //     const chartData = useMemo(() => {
// // //         const weather = data.map((item) => ({ timestampMs: timestampOf(item), value: outdoorValue(item) }))
// // //             .filter((p) => Number.isFinite(p.timestampMs) && p.value != null)
// // //             .sort((a, b) => a.timestampMs - b.timestampMs);
// // //         const indoor = indoorData.map((item) => ({ timestampMs: timestampOf(item), value: indoorValue(item) }))
// // //             .filter((p) => Number.isFinite(p.timestampMs))
// // //             .sort((a, b) => a.timestampMs - b.timestampMs);

// // //             if (indoor.length) {
// // //                 // Sort and keep one indoor reading per 10-second interval.
// // //                 const sampledIndoor = [];
// // //                 let lastBucket = null;

// // //                 for (const point of indoor) {
// // //                     const bucket = Math.floor(
// // //                         point.timestampMs / CHART_INTERVAL_MS
// // //                     );

// // //                     if (bucket !== lastBucket) {
// // //                         sampledIndoor.push(point);
// // //                         lastBucket = bucket;
// // //                     }
// // //                 }

// // //                 return sampledIndoor.map((point) => ({
// // //                     timestampMs: point.timestampMs,
// // //                     name: new Date(point.timestampMs).toLocaleTimeString([], {
// // //                         hour: "2-digit",
// // //                         minute: "2-digit",
// // //                         second: "2-digit",
// // //                     }),
// // //                     indoorTemperature: point.value,
// // //                     outdoorTemperature: outdoorAt(point.timestampMs, weather),
// // //                 }));
// // //             }        return weather.map((point) => ({
// // //             timestampMs: point.timestampMs,
// // //             name: new Date(point.timestampMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
// // //             indoorTemperature: null,
// // //             outdoorTemperature: point.value,
// // //         }));
// // //     }, [data, indoorData]);

// // //     const hasOutdoor = data.some((item) => outdoorValue(item) != null);
// // //     const hasIndoor = indoorData.some((item) => indoorValue(item) != null);

// // //     return (
// // //         <div className="chart-box">
// // //             <div className="chart-header"><div>
// // //                 <h3>🌡 Temperature Monitoring</h3>
// // //                 <span>{locationName ? `Device temperature and outdoor weather near ${locationName}` : "Device temperature and outdoor weather"}</span>
// // //             </div></div>
// // //             {chartData.length ? <ResponsiveContainer width="100%" height={280}>
// // //                 <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
// // //                     <CartesianGrid strokeDasharray="3 3" />
// // //                     <XAxis dataKey="name" tick={{ fontSize: 10 }} minTickGap={24} />
// // //                     <YAxis tick={{ fontSize: 11 }} unit="°C" />
// // //                     <Tooltip formatter={(value, name) => [value == null ? "No reading" : `${Number(value).toFixed(1)} °C`, name]} />
// // //                     <Legend />
// // //                     <Line type="monotone" dataKey="indoorTemperature" name="Indoor" stroke="#3182bd" strokeWidth={2.5} dot={false} connectNulls />
// // //                     <Line type="monotone" dataKey="outdoorTemperature" name="Outdoor" stroke="#f28e2b" strokeWidth={2.5} dot={false} connectNulls />
// // //                 </LineChart>
// // //             </ResponsiveContainer> : <div style={{ minHeight: 120, display: "grid", placeItems: "center", padding: 16, textAlign: "center" }}>{status === "loading" ? "Loading outdoor weather…" : error || "Temperature data will appear when device readings and branch coordinates are available."}</div>}
// // //             {!hasIndoor && <small style={{ display: "block", padding: "0 12px 8px", color: "#64748b" }}>Waiting for indoor temperature telemetry from the device.</small>}
// // //             {!hasOutdoor && status !== "loading" && <small style={{ display: "block", padding: "0 12px 8px", color: "#64748b" }}>Outdoor temperature is unavailable until valid branch coordinates are saved.</small>}
// // //         </div>
// // //     );
// // // }

// // // export default TemperatureChart;


// // // import React, { useMemo } from "react";
// // // import {
// // //     ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
// // // } from "recharts";

// // // const CHART_INTERVAL_MS = 10 * 1000;

// // // const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

// // // const makeTimeTicks = (now = Date.now()) => {
// // //     const start = now - WINDOW_MS;
// // //     const first = Math.ceil(start / TWO_HOURS_MS) * TWO_HOURS_MS;
// // //     const ticks = [];
// // //     for (let t = first; t <= now; t += TWO_HOURS_MS) ticks.push(t);
// // //     return ticks;
// // // };

// // // const timestampOf = (item) => {
// // //     const raw = item?.timestamp ?? item?.ts ?? item?.time ?? item?.created_at ?? item?.datetime;
// // //     if (raw == null || raw === "") return NaN;
// // //     if (typeof raw === "number") return raw > 1e12 ? raw : raw * 1000;
// // //     const parsed = Date.parse(raw);
// // //     return Number.isFinite(parsed) ? parsed : NaN;
// // // };

// // // const indoorValue = (item) => {
// // //     const value = item?.indoor_temperature ?? item?.indoor_temp ?? item?.temperature ?? item?.temp;
// // //     return value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
// // // };

// // // const outdoorValue = (item) => {
// // //     const value = item?.temperature_2m ?? item?.outdoor_temperature ?? item?.temperature;
// // //     return value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
// // // };

// // // // Keep every indoor telemetry timestamp (the dashboard's existing cadence) as an X-axis point.
// // // // The hourly outdoor series is interpolated at those exact timestamps for a fair comparison.
// // // function outdoorAt(timestamp, weather) {
// // //     if (!weather.length) return null;
// // //     let before = null;
// // //     let after = null;
// // //     for (const point of weather) {
// // //         if (point.timestampMs <= timestamp) before = point;
// // //         if (point.timestampMs >= timestamp) { after = point; break; }
// // //     }
// // //     if (!before) return after?.value ?? null;
// // //     if (!after) return before.value ?? null;
// // //     if (before.value == null && after.value == null) return null;
// // //     if (before.value == null) return after.value;
// // //     if (after.value == null) return before.value;
// // //     if (before.timestampMs === after.timestampMs) return before.value;
// // //     const ratio = (timestamp - before.timestampMs) / (after.timestampMs - before.timestampMs);
// // //     return before.value + (after.value - before.value) * ratio;
// // // }

// // // function TemperatureChart({ data = [], indoorData = [], locationName = "selected branch", status = "idle", error = "" }) {
// // //     const chartData = useMemo(() => {
// // //         const weather = data.map((item) => ({ timestampMs: timestampOf(item), value: outdoorValue(item) }))
// // //             .filter((p) => Number.isFinite(p.timestampMs) && p.value != null)
// // //             .sort((a, b) => a.timestampMs - b.timestampMs);
// // //         const indoor = indoorData.map((item) => ({ timestampMs: timestampOf(item), value: indoorValue(item) }))
// // //             .filter((p) => Number.isFinite(p.timestampMs))
// // //             .sort((a, b) => a.timestampMs - b.timestampMs);

// // //             if (indoor.length) {
// // //                 // Sort and keep one indoor reading per 10-second interval.
// // //                 const sampledIndoor = [];
// // //                 let lastBucket = null;

// // //                 for (const point of indoor) {
// // //                     const bucket = Math.floor(
// // //                         point.timestampMs / CHART_INTERVAL_MS
// // //                     );

// // //                     if (bucket !== lastBucket) {
// // //                         sampledIndoor.push(point);
// // //                         lastBucket = bucket;
// // //                     }
// // //                 }

// // //                 return sampledIndoor.map((point) => ({
// // //                     timestampMs: point.timestampMs,
// // //                     name: new Date(point.timestampMs).toLocaleTimeString([], {
// // //                         hour: "2-digit",
// // //                         minute: "2-digit",
// // //                         second: "2-digit",
// // //                     }),
// // //                     indoorTemperature: point.value,
// // //                     outdoorTemperature: outdoorAt(point.timestampMs, weather),
// // //                 }));
// // //             }        return weather.map((point) => ({
// // //             timestampMs: point.timestampMs,
// // //             name: new Date(point.timestampMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
// // //             indoorTemperature: null,
// // //             outdoorTemperature: point.value,
// // //         }));
// // //     }, [data, indoorData]);

// // //     const hasOutdoor = data.some((item) => outdoorValue(item) != null);
// // //     const hasIndoor = indoorData.some((item) => indoorValue(item) != null);

// // //     return (
// // //         <div className="chart-box">
// // //             <div className="chart-header"><div>
// // //                 <h3>🌡 Temperature Monitoring</h3>
// // //                 <span>{locationName ? `Device temperature and outdoor weather near ${locationName}` : "Device temperature and outdoor weather"}</span>
// // //             </div></div>
// // //             {chartData.length ? <ResponsiveContainer width="100%" height={280}>
// // //                 <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
// // //                     <CartesianGrid strokeDasharray="3 3" />
// // //                     <XAxis
// //                     //     dataKey="timestampMs"
// //                     //     type="number"
// //                     //     scale="time"
// //                     //     domain={[Date.now() - WINDOW_MS, "dataMax"]}
// //                     //     ticks={makeTimeTicks()}
// //                     //     tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
// //                     //     tick={{ fontSize: 10 }}
// //                     //     minTickGap={20}
// //                     //     allowDataOverflow={false}
// //                     // />
// // //                     <YAxis tick={{ fontSize: 11 }} unit="°C" />
// // //                     <Tooltip formatter={(value, name) => [value == null ? "No reading" : `${Number(value).toFixed(1)} °C`, name]} />
// // //                     <Legend />
// // //                     <Line type="monotone" dataKey="indoorTemperature" name="Indoor" stroke="#3182bd" strokeWidth={2.5} dot={false} connectNulls />
// // //                     <Line type="monotone" dataKey="outdoorTemperature" name="Outdoor" stroke="#f28e2b" strokeWidth={2.5} dot={false} connectNulls />
// // //                 </LineChart>
// // //             </ResponsiveContainer> : <div style={{ minHeight: 120, display: "grid", placeItems: "center", padding: 16, textAlign: "center" }}>{status === "loading" ? "Loading outdoor weather…" : error || "Temperature data will appear when device readings and branch coordinates are available."}</div>}
// // //             {!hasIndoor && <small style={{ display: "block", padding: "0 12px 8px", color: "#64748b" }}>Waiting for indoor temperature telemetry from the device.</small>}
// // //             {!hasOutdoor && status !== "loading" && <small style={{ display: "block", padding: "0 12px 8px", color: "#64748b" }}>Outdoor temperature is unavailable until valid branch coordinates are saved.</small>}
// // //         </div>
// // //     );
// // // }

// // // export default TemperatureChart;



// // import React, { useMemo } from "react";
// // import {
// //     ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
// // } from "recharts";

// // // Show the past 24 hours, and cap the number of rendered points
// // // so the chart stays smooth even with 10-second telemetry.
// // const WINDOW_MS = 24 * 60 * 60 * 1000;          // 24 hours
// // const MAX_POINTS = 300;                          // target point budget
// // const MIN_SAMPLE_MS = 10 * 1000;                 // never sample finer than 10s
// // const SAMPLE_INTERVAL_MS = Math.max(
// //     MIN_SAMPLE_MS,
// //     Math.floor(WINDOW_MS / MAX_POINTS)           // ~4.8 min buckets for 24h
// // );

// // const timestampOf = (item) => {
// //     const raw = item?.timestamp ?? item?.ts ?? item?.time ?? item?.created_at ?? item?.datetime;
// //     if (raw == null || raw === "") return NaN;
// //     if (typeof raw === "number") return raw > 1e12 ? raw : raw * 1000;
// //     const parsed = Date.parse(raw);
// //     return Number.isFinite(parsed) ? parsed : NaN;
// // };

// // const indoorValue = (item) => {
// //     const value = item?.indoor_temperature ?? item?.indoor_temp ?? item?.temperature ?? item?.temp;
// //     return value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
// // };

// // const outdoorValue = (item) => {
// //     const value = item?.temperature_2m ?? item?.outdoor_temperature ?? item?.temperature;
// //     return value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
// // };

// // // Interpolate the hourly outdoor series at an arbitrary indoor timestamp.
// // function outdoorAt(timestamp, weather) {
// //     if (!weather.length) return null;
// //     let before = null;
// //     let after = null;
// //     for (const point of weather) {
// //         if (point.timestampMs <= timestamp) before = point;
// //         if (point.timestampMs >= timestamp) { after = point; break; }
// //     }
// //     if (!before) return after?.value ?? null;
// //     if (!after) return before.value ?? null;
// //     if (before.value == null && after.value == null) return null;
// //     if (before.value == null) return after.value;
// //     if (after.value == null) return before.value;
// //     if (before.timestampMs === after.timestampMs) return before.value;
// //     const ratio = (timestamp - before.timestampMs) / (after.timestampMs - before.timestampMs);
// //     return before.value + (after.value - before.value) * ratio;
// // }

// // function TemperatureChart({
// //     data = [],
// //     indoorData = [],
// //     locationName = "selected branch",
// //     status = "idle",
// //     error = "",
// // }) {
// //     const { chartData, hasIndoor, hasOutdoor } = useMemo(() => {
// //         const cutoff = Date.now() - WINDOW_MS;

// //         const weather = data
// //             .map((item) => ({ timestampMs: timestampOf(item), value: outdoorValue(item) }))
// //             .filter((p) => Number.isFinite(p.timestampMs) && p.value != null && p.timestampMs >= cutoff)
// //             .sort((a, b) => a.timestampMs - b.timestampMs);

// //         const indoor = indoorData
// //             .map((item) => ({ timestampMs: timestampOf(item), value: indoorValue(item) }))
// //             .filter((p) => Number.isFinite(p.timestampMs) && p.timestampMs >= cutoff)
// //             .sort((a, b) => a.timestampMs - b.timestampMs);

// //         const hasIndoor = indoor.some((p) => p.value != null);
// //         const hasOutdoor = weather.length > 0;

// //         const labelFor = (ms) =>
// //             new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// //         let chartData;
// //         if (indoor.length) {
// //             // Downsample: keep one indoor reading per SAMPLE_INTERVAL_MS bucket.
// //             const sampled = [];
// //             let lastBucket = null;
// //             for (const point of indoor) {
// //                 const bucket = Math.floor(point.timestampMs / SAMPLE_INTERVAL_MS);
// //                 if (bucket !== lastBucket) {
// //                     sampled.push(point);
// //                     lastBucket = bucket;
// //                 }
// //             }

// //             chartData = sampled.map((point) => ({
// //                 timestampMs: point.timestampMs,
// //                 name: labelFor(point.timestampMs),
// //                 indoorTemperature: point.value,
// //                 outdoorTemperature: outdoorAt(point.timestampMs, weather),
// //             }));
// //         } else {
// //             chartData = weather.map((point) => ({
// //                 timestampMs: point.timestampMs,
// //                 name: labelFor(point.timestampMs),
// //                 indoorTemperature: null,
// //                 outdoorTemperature: point.value,
// //             }));
// //         }

// //         return { chartData, hasIndoor, hasOutdoor };
// //     }, [data, indoorData]);

// //     return (
// //         <div className="chart-box">
// //             <div className="chart-header">
// //                 <div>
// //                     <h3>🌡 Temperature Monitoring</h3>
// //                     <span>
// //                         {locationName
// //                             ? `Device temperature and outdoor weather over the past 24 hours near ${locationName}`
// //                             : "Device temperature and outdoor weather over the past 24 hours"}
// //                     </span>
// //                 </div>
// //             </div>

// //             {chartData.length ? (
// //                 <ResponsiveContainer width="100%" height={280}>
// //                     <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
// //                         <CartesianGrid strokeDasharray="3 3" />
// //                         <XAxis
// //                             dataKey="timestampMs"
// //                             type="number"
// //                             scale="time"
// //                             domain={[Date.now() - WINDOW_MS, "dataMax"]}
// //                             ticks={makeTimeTicks()}
// //                             tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
// //                             tick={{ fontSize: 10 }}
// //                             minTickGap={20}
// //                             allowDataOverflow={false}
// //                         />
// //                         <YAxis tick={{ fontSize: 11 }} unit="°C" />
// //                         <Tooltip
// //                             formatter={(value, name) => [
// //                                 value == null ? "No reading" : `${Number(value).toFixed(1)} °C`,
// //                                 name,
// //                             ]}
// //                         />
// //                         <Legend />
// //                         <Line
// //                             type="monotone"
// //                             dataKey="indoorTemperature"
// //                             name="Indoor"
// //                             stroke="#3182bd"
// //                             strokeWidth={2.5}
// //                             dot={false}
// //                             connectNulls
// //                         />
// //                         <Line
// //                             type="monotone"
// //                             dataKey="outdoorTemperature"
// //                             name="Outdoor"
// //                             stroke="#f28e2b"
// //                             strokeWidth={2.5}
// //                             dot={false}
// //                             connectNulls
// //                         />
// //                     </LineChart>
// //                 </ResponsiveContainer>
// //             ) : (
// //                 <div
// //                     style={{
// //                         minHeight: 120,
// //                         display: "grid",
// //                         placeItems: "center",
// //                         padding: 16,
// //                         textAlign: "center",
// //                     }}
// //                 >
// //                     {status === "loading"
// //                         ? "Loading outdoor weather…"
// //                         : error ||
// //                           "Temperature data will appear when device readings and branch coordinates are available."}
// //                 </div>
// //             )}

// //             {!hasIndoor && (
// //                 <small style={{ display: "block", padding: "0 12px 8px", color: "#64748b" }}>
// //                     Waiting for indoor temperature telemetry from the device.
// //                 </small>
// //             )}
// //             {!hasOutdoor && status !== "loading" && (
// //                 <small style={{ display: "block", padding: "0 12px 8px", color: "#64748b" }}>
// //                     Outdoor temperature is unavailable until valid branch coordinates are saved.
// //                 </small>
// //             )}
// //         </div>
// //     );
// // }

// // export default TemperatureChart;


// import React, { useMemo } from "react";
// import {
//     ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
// } from "recharts";

// // Show the past 24 hours, and cap the number of rendered points
// // so the chart stays smooth even with 10-second telemetry.
// const WINDOW_MS = 24 * 60 * 60 * 1000;          // 24 hours
// const MAX_POINTS = 300;                          // target point budget
// const MIN_SAMPLE_MS = 10 * 1000;                 // never sample finer than 10s
// const SAMPLE_INTERVAL_MS = Math.max(
//     MIN_SAMPLE_MS,
//     Math.floor(WINDOW_MS / MAX_POINTS)           // ~4.8 min buckets for 24h
// );

// // One tick every 2 hours across the 24h window → 13 ticks.
// const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
// const makeTimeTicks = (startMs, endMs) => {
//     const first = Math.ceil(startMs / TWO_HOURS_MS) * TWO_HOURS_MS;
//     const ticks = [];
//     for (let t = first; t <= endMs; t += TWO_HOURS_MS) ticks.push(t);
//     return ticks;
// };

// const timestampOf = (item) => {
//     const raw = item?.timestampMs ?? item?.timestamp ?? item?.bucket_start ??
//         item?.ts ?? item?.time ?? item?.created_at ?? item?.datetime;
//     if (raw == null || raw === "") return NaN;
//     if (typeof raw === "number" || (typeof raw === "string" && /^\\d+(\\.\\d+)?$/.test(raw.trim()))) {
//         const numeric = Number(raw);
//         return numeric > 1e12 ? numeric : numeric * 1000;
//     }
//     const parsed = Date.parse(raw);
//     return Number.isFinite(parsed) ? parsed : NaN;
// };

// const indoorValue = (item) => {
//     const value = item?.indoor_temperature ?? item?.indoor_temp ??
//         item?.avg_temperature ?? item?.avg_temp ?? item?.temperature ?? item?.temp;
//     return value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
// };

// // ACDashboard maps Open-Meteo hourly temperature_2m to `temperature`.
// // Keep the original API field names supported too.
// const outdoorValue = (item) => {
//     const value = item?.temperature_2m ?? item?.outdoor_temperature ??
//         item?.temperature ?? item?.temp;
//     return value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
// };

// // Interpolate the hourly outdoor series at an arbitrary indoor timestamp.
// function outdoorAt(timestamp, weather) {
//     if (!weather.length) return null;
//     let before = null;
//     let after = null;
//     for (const point of weather) {
//         if (point.timestampMs <= timestamp) before = point;
//         if (point.timestampMs >= timestamp) { after = point; break; }
//     }
//     if (!before) return after?.value ?? null;
//     if (!after) return before.value ?? null;
//     if (before.value == null && after.value == null) return null;
//     if (before.value == null) return after.value;
//     if (after.value == null) return before.value;
//     if (before.timestampMs === after.timestampMs) return before.value;
//     const ratio = (timestamp - before.timestampMs) / (after.timestampMs - before.timestampMs);
//     return before.value + (after.value - before.value) * ratio;
// }

// function TemperatureChart({
//     data = [],
//     indoorData = [],
//     locationName = "selected branch",
//     status = "idle",
//     error = "",
// }) {
//     const { chartData, hasIndoor, hasOutdoor, windowStart, windowEnd, timeTicks } = useMemo(() => {
//         // Compute the window once per memo so domain + ticks stay consistent.
//         const windowEnd = Date.now();
//         const windowStart = windowEnd - WINDOW_MS;

//         const weather = data
//             .map((item) => ({ timestampMs: timestampOf(item), value: outdoorValue(item) }))
//             .filter((p) => Number.isFinite(p.timestampMs) && p.value != null && p.timestampMs >= windowStart)
//             .sort((a, b) => a.timestampMs - b.timestampMs);

//         const indoor = indoorData
//             .map((item) => ({ timestampMs: timestampOf(item), value: indoorValue(item) }))
//             .filter((p) => Number.isFinite(p.timestampMs) && p.timestampMs >= windowStart)
//             .sort((a, b) => a.timestampMs - b.timestampMs);

//         const hasIndoor = indoor.some((p) => p.value != null);
//         const hasOutdoor = weather.length > 0;

//         const labelFor = (ms) =>
//             new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

//         let chartData;
//         if (indoor.length) {
//             // Downsample: keep one indoor reading per SAMPLE_INTERVAL_MS bucket.
//             const sampled = [];
//             let lastBucket = null;
//             for (const point of indoor) {
//                 const bucket = Math.floor(point.timestampMs / SAMPLE_INTERVAL_MS);
//                 if (bucket !== lastBucket) {
//                     sampled.push(point);
//                     lastBucket = bucket;
//                 }
//             }

//             chartData = sampled.map((point) => ({
//                 timestampMs: point.timestampMs,
//                 name: labelFor(point.timestampMs),
//                 indoorTemperature: point.value,
//                 outdoorTemperature: outdoorAt(point.timestampMs, weather),
//             }));
//         } else {
//             chartData = weather.map((point) => ({
//                 timestampMs: point.timestampMs,
//                 name: labelFor(point.timestampMs),
//                 indoorTemperature: null,
//                 outdoorTemperature: point.value,
//             }));
//         }

//         return {
//             chartData,
//             hasIndoor,
//             hasOutdoor,
//             windowStart,
//             windowEnd,
//             timeTicks: makeTimeTicks(windowStart, windowEnd),
//         };
//     }, [data, indoorData]);

//     return (
//         <div className="chart-box">
//             <div className="chart-header">
//                 <div>
//                     <h3>🌡 Temperature Monitoring</h3>
//                     <span>
//                         {locationName
//                             ? `Device temperature and outdoor weather over the past 24 hours near ${locationName}`
//                             : "Device temperature and outdoor weather over the past 24 hours"}
//                     </span>
//                 </div>
//             </div>

//             {chartData.length ? (
//                 <ResponsiveContainer width="100%" height={280}>
//                     <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
//                         <CartesianGrid strokeDasharray="3 3" />
//                         <XAxis
//                             dataKey="timestampMs"
//                             type="number"
//                             scale="time"
//                             domain={[windowStart, "dataMax"]}
//                             ticks={timeTicks}
//                             tickFormatter={(value) =>
//                                 new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
//                             }
//                             tick={{ fontSize: 10 }}
//                             minTickGap={20}
//                             allowDataOverflow={false}
//                         />
//                         <YAxis tick={{ fontSize: 11 }} unit="°C" />
//                         <Tooltip
//                             formatter={(value, name) => [ value == null ? "No reading" : `${Number(value).toFixed(1)} °C`, name,
//                             ]}
//                             labelFormatter={(ms) =>
//                                 new Date(ms).toLocaleString([], {
//                                     // month: "short",
//                                     // day: "numeric",
//                                     hour: "2-digit",
//                                     minute: "2-digit",
//                                 })
//                             }
//                         />
//                         {/* <Tooltip formatter={(value, name) => [value == null ? "No reading" : `${Number(value).toFixed(1)}%`, name]} /> */}
                        
//                         <Legend />
//                         <Line
//                             type="monotone"
//                             dataKey="indoorTemperature"
//                             name="Indoor"
//                             stroke="#3182bd"
//                             strokeWidth={2.5}
//                             dot={false}
//                             connectNulls
//                         />
//                         <Line
//                             type="monotone"
//                             dataKey="outdoorTemperature"
//                             name="Outdoor"
//                             stroke="#f28e2b"
//                             strokeWidth={2.5}
//                             dot={false}
//                             connectNulls
//                         />
//                     </LineChart>
//                 </ResponsiveContainer>
//             ) : (
//                 <div
//                     style={{
//                         minHeight: 120,
//                         display: "grid",
//                         placeItems: "center",
//                         padding: 16,
//                         textAlign: "center",
//                     }}
//                 >
//                     {status === "loading"
//                         ? "Loading outdoor weather…"
//                         : error ||
//                           "Temperature data will appear when device readings and branch coordinates are available."}
//                 </div>
//             )}

//             {!hasIndoor && (
//                 <small style={{ display: "block", padding: "0 12px 8px", color: "#64748b" }}>
//                     Waiting for indoor temperature telemetry from the device.
//                 </small>
//             )}
//             {!hasOutdoor && status !== "loading" && (
//                 <small style={{ display: "block", padding: "0 12px 8px", color: "#64748b" }}>
//                     Outdoor temperature is unavailable until valid branch coordinates are saved.
//                 </small>
//             )}
//         </div>
//     );
// }

// export default TemperatureChart;

import React from "react";
import MetricHistoryChart from "../shared/MetricHistoryChart";

function TemperatureChart({
  deviceId = "",
  scope = {},
  data = [],
  locationName = "",
  status = "idle",
  error = "",
}) {
  return (
    <MetricHistoryChart
      config={{
        metric: "temperature",
        title: "Temperature Monitoring",
        seriesName: "Indoor Temperature",
        subtitleDevice: "Selected AC · Historical temperature",
        subtitleScope: "Branch · Historical temperature",
        unit: "°C",
        yLabel: "Temperature (°C)",
        decimals: 1,
        color: "#3182bd",
        yDomain: ["auto", "auto"],
      }}
      deviceId={deviceId}
      scope={scope}
      height={280}
      outdoorData={data}
      outdoorKey="temperature"
      outdoorSeriesName="Outdoor Temperature"
      locationName={locationName}
      outdoorStatus={status}
      outdoorError={error}
    />
  );
}

export default TemperatureChart;
