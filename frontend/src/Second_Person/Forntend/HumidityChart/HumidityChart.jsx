// import React, { useMemo } from "react";
// import {
//     ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
// } from "recharts";

// const CHART_INTERVAL_MS = 10 * 1000;

// const timestampOf = (item) => {
//     const raw = item?.timestamp ?? item?.ts ?? item?.time ?? item?.created_at ?? item?.datetime;
//     if (raw == null || raw === "") return NaN;
//     if (typeof raw === "number") return raw > 1e12 ? raw : raw * 1000;
//     const parsed = Date.parse(raw);
//     return Number.isFinite(parsed) ? parsed : NaN;
// };

// const indoorValue = (item) => {
//     const value = item?.indoor_humidity ?? item?.humidity;
//     return value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
// };

// const outdoorValue = (item) => {
//     const value = item?.relative_humidity_2m ?? item?.outdoor_humidity ?? item?.humidity;
//     return value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
// };

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

// function HumidityChart({ data = [], indoorData = [], locationName = "selected branch", status = "idle", error = "" }) {
//     const chartData = useMemo(() => {
//         const weather = data.map((item) => ({ timestampMs: timestampOf(item), value: outdoorValue(item) }))
//             .filter((p) => Number.isFinite(p.timestampMs) && p.value != null)
//             .sort((a, b) => a.timestampMs - b.timestampMs);
//         const indoor = indoorData.map((item) => ({ timestampMs: timestampOf(item), value: indoorValue(item) }))
//             .filter((p) => Number.isFinite(p.timestampMs))
//             .sort((a, b) => a.timestampMs - b.timestampMs);

//         if (indoor.length) {
//             // Sort and keep one indoor reading per 10-second interval.
//             const sampledIndoor = [];
//             let lastBucket = null;

//             for (const point of indoor) {
//                 const bucket = Math.floor(
//                     point.timestampMs / CHART_INTERVAL_MS
//                 );

//                 if (bucket !== lastBucket) {
//                     sampledIndoor.push(point);
//                     lastBucket = bucket;
//                 }
//             }

//             return sampledIndoor.map((point) => ({
//                 timestampMs: point.timestampMs,
//                 name: new Date(point.timestampMs).toLocaleTimeString([], {
//                     hour: "2-digit",
//                     minute: "2-digit",
//                     second: "2-digit",
//                 }),
//                 indoorHumidity: point.value,
//                 outdoorHumidity: outdoorAt(point.timestampMs, weather),
//             }));
//         }
//         return weather.map((point) => ({
//             timestampMs: point.timestampMs,
//             name: new Date(point.timestampMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
//             indoorHumidity: null,
//             outdoorHumidity: point.value,
//         }));
//     }, [data, indoorData]);

//     const hasOutdoor = data.some((item) => outdoorValue(item) != null);
//     const hasIndoor = indoorData.some((item) => indoorValue(item) != null);

//     return (
//         <div className="chart-box">
//             <div className="chart-header"><div>
//                 <h3>💧 Humidity Monitoring</h3>
//                 <span>{locationName ? `Device humidity and outdoor weather near ${locationName}` : "Device humidity and outdoor weather"}</span>
//             </div></div>
//             {chartData.length ? <ResponsiveContainer width="100%" height={280}>
//                 <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
//                     <CartesianGrid strokeDasharray="3 3" />
//                     <XAxis dataKey="name" tick={{ fontSize: 10 }} minTickGap={24} />
//                     <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11 }} />
//                     <Tooltip formatter={(value, name) => [value == null ? "No reading" : `${Number(value).toFixed(1)}%`, name]} />
//                     <Legend />
//                     <Line type="monotone" dataKey="indoorHumidity" name="Indoor" stroke="#3182bd" strokeWidth={2.5} dot={false} connectNulls />
//                     <Line type="monotone" dataKey="outdoorHumidity" name="Outdoor" stroke="#f28e2b" strokeWidth={2.5} dot={false} connectNulls />
//                 </LineChart>
//             </ResponsiveContainer> : <div style={{ minHeight: 120, display: "grid", placeItems: "center", padding: 16, textAlign: "center" }}>{status === "loading" ? "Loading outdoor weather…" : error || "Humidity data will appear when device readings and branch coordinates are available."}</div>}
//             {!hasIndoor && <small style={{ display: "block", padding: "0 12px 8px", color: "#64748b" }}>Waiting for indoor humidity telemetry from the device.</small>}
//             {!hasOutdoor && status !== "loading" && <small style={{ display: "block", padding: "0 12px 8px", color: "#64748b" }}>Outdoor humidity is unavailable until valid branch coordinates are saved.</small>}
//         </div>
//     );
// }

// export default HumidityChart;


import React, { useMemo } from "react";
import {
    ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from "recharts";

const CHART_INTERVAL_MS = 5 * 60 * 1000; // downsample dense telemetry for a 24-hour view

const WINDOW_MS = 24 * 60 * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

const makeTimeTicks = (now = Date.now()) => {
    const start = now - WINDOW_MS;
    const first = Math.ceil(start / TWO_HOURS_MS) * TWO_HOURS_MS;
    const ticks = [];
    for (let t = first; t <= now; t += TWO_HOURS_MS) ticks.push(t);
    return ticks;
};

const timestampOf = (item) => {
    const raw = item?.timestamp ?? item?.ts ?? item?.time ?? item?.created_at ?? item?.datetime;
    if (raw == null || raw === "") return NaN;
    if (typeof raw === "number") return raw > 1e12 ? raw : raw * 1000;
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : NaN;
};

const indoorValue = (item) => {
    const value = item?.indoor_humidity ?? item?.humidity;
    return value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
};

const outdoorValue = (item) => {
    const value = item?.relative_humidity_2m ?? item?.outdoor_humidity ?? item?.humidity;
    return value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
};

function outdoorAt(timestamp, weather) {
    if (!weather.length) return null;
    let before = null;
    let after = null;
    for (const point of weather) {
        if (point.timestampMs <= timestamp) before = point;
        if (point.timestampMs >= timestamp) { after = point; break; }
    }
    if (!before) return after?.value ?? null;
    if (!after) return before.value ?? null;
    if (before.value == null && after.value == null) return null;
    if (before.value == null) return after.value;
    if (after.value == null) return before.value;
    if (before.timestampMs === after.timestampMs) return before.value;
    const ratio = (timestamp - before.timestampMs) / (after.timestampMs - before.timestampMs);
    return before.value + (after.value - before.value) * ratio;
}

function HumidityChart({ data = [], indoorData = [], locationName = "selected branch", status = "idle", error = "" }) {
    const chartData = useMemo(() => {
        const cutoff = Date.now() - WINDOW_MS;
        const weather = data.map((item) => ({ timestampMs: timestampOf(item), value: outdoorValue(item) }))
            .filter((p) => Number.isFinite(p.timestampMs) && p.value != null && p.timestampMs >= cutoff)
            .sort((a, b) => a.timestampMs - b.timestampMs);
        const indoor = indoorData.map((item) => ({ timestampMs: timestampOf(item), value: indoorValue(item) }))
            .filter((p) => Number.isFinite(p.timestampMs) && p.timestampMs >= cutoff)
            .sort((a, b) => a.timestampMs - b.timestampMs);

        if (indoor.length) {
            // Sort and keep one indoor reading per 10-second interval.
            const sampledIndoor = [];
            let lastBucket = null;

            for (const point of indoor) {
                const bucket = Math.floor(
                    point.timestampMs / CHART_INTERVAL_MS
                );

                if (bucket !== lastBucket) {
                    sampledIndoor.push(point);
                    lastBucket = bucket;
                }
            }

            return sampledIndoor.map((point) => ({
                timestampMs: point.timestampMs,
                name: new Date(point.timestampMs).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                }),
                indoorHumidity: point.value,
                outdoorHumidity: outdoorAt(point.timestampMs, weather),
            }));
        }
        return weather.map((point) => ({
            timestampMs: point.timestampMs,
            name: new Date(point.timestampMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            indoorHumidity: null,
            outdoorHumidity: point.value,
        }));
    }, [data, indoorData]);

    const hasOutdoor = data.some((item) => outdoorValue(item) != null);
    const hasIndoor = indoorData.some((item) => indoorValue(item) != null);

    return (
        <div className="chart-box">
            <div className="chart-header"><div>
                <h3>💧 Humidity Monitoring</h3>
                <span>{locationName ? `Device humidity and outdoor weather near ${locationName}` : "Device humidity and outdoor weather"}</span>
            </div></div>
            {chartData.length ? <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        dataKey="timestampMs"
                        type="number"
                        scale="time"
                        domain={[Date.now() - WINDOW_MS, "dataMax"]}
                        ticks={makeTimeTicks()}
                        tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        tick={{ fontSize: 10 }}
                        minTickGap={20}
                        allowDataOverflow={false}
                    />
                    <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11 }} />
                    <Tooltip
                        formatter={(value, name) => [ value == null ? "No reading" : `${Number(value).toFixed(1)}%`, name,
                        ]}
                        labelFormatter={(ms) =>
                            new Date(ms).toLocaleString([], {
                                // month: "short",
                                // day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                            })
                        }
                    />
                    
                    <Legend />
                    <Line type="monotone" dataKey="indoorHumidity" name="Indoor" stroke="#3182bd" strokeWidth={2.5} dot={false} connectNulls />
                    <Line type="monotone" dataKey="outdoorHumidity" name="Outdoor" stroke="#f28e2b" strokeWidth={2.5} dot={false} connectNulls />
                </LineChart>
            </ResponsiveContainer> : <div style={{ minHeight: 120, display: "grid", placeItems: "center", padding: 16, textAlign: "center" }}>{status === "loading" ? "Loading outdoor weather…" : error || "Humidity data will appear when device readings and branch coordinates are available."}</div>}
            {!hasIndoor && <small style={{ display: "block", padding: "0 12px 8px", color: "#64748b" }}>Waiting for indoor humidity telemetry from the device.</small>}
            {!hasOutdoor && status !== "loading" && <small style={{ display: "block", padding: "0 12px 8px", color: "#64748b" }}>Outdoor humidity is unavailable until valid branch coordinates are saved.</small>}
        </div>
    );
}

export default HumidityChart;
