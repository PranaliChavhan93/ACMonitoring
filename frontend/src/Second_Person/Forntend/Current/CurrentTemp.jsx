
// // Current & Temperature chart -- one AC at a time, straight from the database.
// //
// // Filter UI now mirrors MetricHistoryChart / CurrentHistoryChart 1:1:
// //   - viewMode dropdown (VIEW_MODES)
// //   - custom date-range pair (shown for "custom")
// //   - hour dropdown (shown for "selected-hour", future hours disabled)
// //   - lucide Maximize2 / X expand button
// // The per-AC series fetching, /current-history/ query and 10 s refresh loop are
// // untouched -- resolveRange() only translates filter state into the
// // {from, to, period, interval_seconds} quadruple that /current-history/ already
// // consumed before.
// //
// // Zoom (graph only, never the page):
// //   - Ctrl/Cmd + mouse wheel, or a trackpad pinch, zooms the TIME axis around the
// //     cursor.  preventDefault() on that wheel event stops the browser from
// //     zooming the whole page while the pointer is over the chart.
// //   - Drag a rectangle on the chart to zoom into that time span.
// //   - Toolbar: zoom in / out, pan left / right, reset (or double-click the chart).
// //   - X ticks, the Y ranges and the data resolution all follow the zoomed span
// //     (zooming in re-requests finer buckets from the backend).
// import React, { useEffect, useMemo, useRef, useState } from "react";
// import {
//   ResponsiveContainer,
//   LineChart,
//   Line,
//   CartesianGrid,
//   XAxis,
//   YAxis,
//   Tooltip,
//   Legend,
//   ReferenceArea,
// } from "recharts";
// import { Maximize2, X, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
// import { API_BASE, getJSON, scopeToParams } from "../shared/api";

// // Same list MetricHistoryChart imports as VIEW_MODES.  If your
// // metricHistory.js already exports it, drop the local copy and import from
// // there instead -- keeping them identical is what matters.
// const VIEW_MODES = [
//   { value: "today", label: "Today" },
//   { value: "last-24-hours", label: "Last 24 hours" },
//   { value: "week", label: "This week" },
//   { value: "month", label: "This month" },
//   { value: "selected-hour", label: "Selected hour" },
//   { value: "custom", label: "Custom range" },
// ];

// const MINUTE = 60 * 1000;
// const HOUR = 60 * MINUTE;

// const MONTH_NAMES = [
//   "Jan", "Feb", "Mar", "Apr", "May", "Jun",
//   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
// ];

// const pad2 = (n) => String(n).padStart(2, "0");

// // "YYYY-MM-DD" -> Date; `endOfDay` clamps to 23:59:59.999 of that day.
// function parseDateInput(value, endOfDay = false) {
//   if (!value) return null;
//   const [y, m, d] = value.split("-").map(Number);
//   if (!y || !m || !d) return null;
//   return endOfDay
//     ? new Date(y, m - 1, d, 23, 59, 59, 999)
//     : new Date(y, m - 1, d, 0, 0, 0, 0);
// }

// /* ------------------------------------------------------------------ *
//  *  Filters -> [from, to, apiPeriod, intervalSeconds]
//  *  This is the only place that knows about the VIEW_MODES values.
//  * ------------------------------------------------------------------ */
// function resolveRange(viewMode, selectedHour, customFrom, customTo, now = new Date()) {
//   const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

//   switch (viewMode) {
//     case "today":
//       return { from: midnight, to: now, apiPeriod: "today", intervalSeconds: 60 };

//     case "last-24-hours":
//       return {
//         from: new Date(now.getTime() - 24 * HOUR),
//         to: now,
//         apiPeriod: "24h",
//         intervalSeconds: 60,
//       };

//     case "week": {
//       const from = new Date(midnight);
//       from.setDate(from.getDate() - 6);
//       return { from, to: now, apiPeriod: "week", intervalSeconds: 900 };
//     }

//     case "month":
//       return {
//         from: new Date(now.getFullYear(), now.getMonth(), 1),
//         to: now,
//         apiPeriod: "month",
//         intervalSeconds: 3600,
//       };

//     case "selected-hour": {
//       const hour = Math.min(selectedHour, now.getHours());
//       const from = new Date(midnight);
//       from.setHours(hour, 0, 0, 0);
//       const end = new Date(from.getTime() + HOUR - 1);
//       const to = end > now ? now : end;
//       return { from, to, apiPeriod: "today", intervalSeconds: 60 };
//     }

//     case "custom": {
//       const from = parseDateInput(customFrom, false);
//       const rawTo = parseDateInput(customTo, true);
//       const to = rawTo && rawTo > now ? now : rawTo;
//       if (!from || !to || from >= to) {
//         // Fallback: treat invalid/empty custom ranges as "today".
//         return { from: midnight, to: now, apiPeriod: "today", intervalSeconds: 60 };
//       }
//       const spanH = (to - from) / HOUR;
//       const intervalSeconds = spanH > 48 ? 3600 : spanH > 12 ? 900 : 60;
//       return { from, to, apiPeriod: "today", intervalSeconds };
//     }

//     default:
//       return { from: midnight, to: now, apiPeriod: "today", intervalSeconds: 60 };
//   }
// }

// /* ------------------------------------------------------------------ *
//  *  X-axis helpers -- span-driven so every mode gets sensible ticks
//  * ------------------------------------------------------------------ */
// const DAY = 24 * HOUR;
// const TICK_STEPS = [
//   MINUTE, 2 * MINUTE, 5 * MINUTE, 10 * MINUTE, 15 * MINUTE, 30 * MINUTE,
//   HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR, DAY, 2 * DAY, 3 * DAY, 7 * DAY,
// ];
// const MIN_ZOOM_SPAN = 5 * MINUTE;

// // Smallest "nice" step that gives <= ~9 ticks for this span.
// function tickStepFor(spanMs) {
//   return TICK_STEPS.find((st) => spanMs / st <= 9) || TICK_STEPS[TICK_STEPS.length - 1];
// }

// // Ticks on LOCAL clock boundaries; the step follows the visible span, so zooming
// // changes the axis (e.g. 3 h ticks -> 5 min ticks).
// function makeTicksFromRange(from, to) {
//   const fromMs = from.getTime();
//   const toMs = to.getTime();
//   const step = tickStepFor(toMs - fromMs);
//   const ticks = [];
//   if (step >= DAY) {
//     const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
//     if (d.getTime() < fromMs) d.setDate(d.getDate() + 1);
//     for (; d.getTime() <= toMs; d.setDate(d.getDate() + step / DAY)) ticks.push(d.getTime());
//     return ticks;
//   }
//   const offset = new Date(fromMs).getTimezoneOffset() * MINUTE;
//   for (let t = Math.ceil((fromMs - offset) / step) * step + offset; t <= toMs; t += step) ticks.push(t);
//   return ticks;
// }

// function formatTick(ts, from, to) {
//   const spanMs = to.getTime() - from.getTime();
//   const d = new Date(ts);
//   if (tickStepFor(spanMs) >= DAY) return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
//   const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
//   return spanMs > 26 * HOUR ? `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${time}` : time;
// }

// function formatLabel(ts, from, to) {
//   const spanH = (to.getTime() - from.getTime()) / HOUR;
//   const d = new Date(ts);
//   const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
//   if (spanH <= 26) return time;
//   return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}, ${time}`;
// }

// // Bucket size for a zoomed window (finer when zoomed in).
// function zoomInterval(spanMs) {
//   const h = spanMs / HOUR;
//   return h > 48 ? 3600 : h > 12 ? 900 : 60;
// }

// /* ------------------------------------------------------------------ *
//  *  Data loading
//  * ------------------------------------------------------------------ */
// const REFRESH_MS = 10_000;

// const toNum = (v) => {
//   const n = Number(v);
//   return v === null || v === undefined || v === "" || !Number.isFinite(n) ? null : n;
// };

// function useDeviceSeries({ viewMode, selectedHour, customFrom, customTo, deviceId, scope, zoom }) {
//   const [state, setState] = useState({ current: [], temperature: [], loading: true, error: "" });
//   const scopeJson = JSON.stringify(scope || {});

//   // Changing the filters clears the chart; zooming keeps the old points on
//   // screen until the finer data arrives.
//   useEffect(() => {
//     setState({ current: [], temperature: [], loading: true, error: "" });
//   }, [viewMode, selectedHour, customFrom, customTo, deviceId, scopeJson]);

//   const zoomFrom = zoom?.from ?? 0;
//   const zoomTo = zoom?.to ?? 0;

//   useEffect(() => {
//     let disposed = false;
//     let controller = null;

//     const run = async () => {
//       controller?.abort();
//       controller = new AbortController();
//       const { signal } = controller;
//       const base = resolveRange(viewMode, selectedHour, customFrom, customTo, new Date());
//       const { from, to, apiPeriod, intervalSeconds } = zoomFrom
//         ? {
//             from: new Date(zoomFrom),
//             to: new Date(zoomTo),
//             apiPeriod: "today",
//             intervalSeconds: zoomInterval(zoomTo - zoomFrom),
//           }
//         : base;

//       const build = (key) => {
//         const params = new URLSearchParams({
//           key,
//           by_device: "1",
//           period: apiPeriod,
//           interval_seconds: String(intervalSeconds),
//           from: String(from.getTime()),
//           to: String(to.getTime()),
//         });
//         if (deviceId) params.set("device_id", String(deviceId));
//         else scopeToParams(JSON.parse(scopeJson), params);
//         return `${API_BASE}/current-history/?${params}`;
//       };

//       try {
//         const [cur, temp] = await Promise.all([
//           getJSON(build("current"), signal),
//           getJSON(build("temperature"), signal),
//         ]);
//         if (disposed || signal.aborted) return;
//         setState({
//           current: cur?.series || [],
//           temperature: temp?.series || [],
//           loading: false,
//           error: "",
//         });
//       } catch (err) {
//         if (err?.name === "AbortError" || disposed) return;
//         setState((prev) => ({
//           ...prev,
//           loading: false,
//           error: err?.message || "Unable to load history.",
//         }));
//       }
//     };

//     run();
//     const timer = window.setInterval(() => {
//       if (!document.hidden) run();
//     }, REFRESH_MS);

//     return () => {
//       disposed = true;
//       controller?.abort();
//       window.clearInterval(timer);
//     };
//   }, [viewMode, selectedHour, customFrom, customTo, deviceId, scopeJson, zoomFrom, zoomTo]);

//   return state;
// }

// const toMap = (rows) => {
//   const m = new Map();
//   for (const r of rows || []) {
//     const ts = Date.parse(r.bucket);
//     const v = toNum(r.avg);
//     if (Number.isFinite(ts) && v !== null) m.set(ts, v);
//   }
//   return m;
// };

// function buildChartData(currentRows, temperatureRows, stepMs) {
//   const cur = toMap(currentRows);
//   const tmp = toMap(temperatureRows);
//   const times = [...new Set([...cur.keys(), ...tmp.keys()])].sort((a, b) => a - b);
//   const maxGap = stepMs * 3;
//   const out = [];
//   let prev = null;
//   for (const t of times) {
//     if (prev !== null && t - prev > maxGap) {
//       out.push({ t: prev + stepMs, current: null, temperature: null });
//     }
//     out.push({ t, current: cur.get(t) ?? null, temperature: tmp.get(t) ?? null });
//     prev = t;
//   }
//   return out;
// }

// /* ------------------------------------------------------------------ *
//  *  Component
//  * ------------------------------------------------------------------ */
// function CurrentTemperatureChart({ deviceId = "", scope = {}, height = 320 }) {
//   const [viewMode, setViewMode] = useState("last-24-hours");
//   const [selectedHour, setSelectedHour] = useState(() => new Date().getHours());
//   const [customFrom, setCustomFrom] = useState(() => {
//     const d = new Date();
//     d.setDate(d.getDate() - 1);
//     return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
//   });
//   const [customTo, setCustomTo] = useState(() => {
//     const d = new Date();
//     return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
//   });
//   const [expanded, setExpanded] = useState(false);
//   const [picked, setPicked] = useState("");
//   const [zoom, setZoom] = useState(null);          // null = full range, else { from, to } in ms
//   const [sel, setSel] = useState(null);            // drag-selection { a, b }
//   const wrapRef = useRef(null);
//   const hoverRef = useRef(null);                   // time (ms) under the cursor

//   const { current, temperature, loading, error } = useDeviceSeries({
//     viewMode,
//     selectedHour,
//     customFrom,
//     customTo,
//     deviceId,
//     scope,
//     zoom,
//   });

//   // Every AC that has current or temperature rows.
//   const devices = useMemo(() => {
//     const byId = new Map();
//     [...current, ...temperature].forEach((s) => {
//       if (!byId.has(s.device_id)) byId.set(s.device_id, s.device_name || s.device_id);
//     });
//     return [...byId]
//       .map(([id, name]) => ({ id, name }))
//       .sort((a, b) => a.name.localeCompare(b.name));
//   }, [current, temperature]);

//   const activeId = devices.some((d) => d.id === picked) ? picked : devices[0]?.id || "";

//   // Range for the chart render itself.  Recomputes when filters change (and on
//   // every state update in the parent, so it stays aligned with the fetch loop).
//   const baseRange = useMemo(
//     () => resolveRange(viewMode, selectedHour, customFrom, customTo, new Date()),
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//     [viewMode, selectedHour, customFrom, customTo]
//   );

//   // Visible window: the zoom if set, otherwise the whole selected period.
//   const range = useMemo(
//     () =>
//       zoom
//         ? {
//             from: new Date(zoom.from),
//             to: new Date(zoom.to),
//             intervalSeconds: zoomInterval(zoom.to - zoom.from),
//           }
//         : baseRange,
//     [zoom, baseRange]
//   );

//   const { chartData, ticks, hasCurrent, hasTemperature } = useMemo(() => {
//     const rows = (list) => list.find((s) => s.device_id === activeId)?.data || [];
//     const stepMs = range.intervalSeconds * 1000;
//     const all = buildChartData(rows(current), rows(temperature), stepMs);
//     // Only what is on screen (+1 bucket each side): the Y axes auto-scale to the
//     // visible readings, so zooming into a quiet stretch re-scales the axis.
//     const lo = range.from.getTime() - stepMs;
//     const hi = range.to.getTime() + stepMs;
//     const chartData = zoom ? all.filter((p) => p.t >= lo && p.t <= hi) : all;
//     return {
//       chartData,
//       ticks: makeTicksFromRange(range.from, range.to),
//       hasCurrent: chartData.some((p) => p.current != null),
//       hasTemperature: chartData.some((p) => p.temperature != null),
//     };
//   }, [activeId, current, temperature, range, zoom]);

//   /* ---------------- zoom controls ---------------- */
//   const baseFrom = baseRange.from.getTime();
//   const baseTo = baseRange.to.getTime();

//   // New window from a centre point and span, kept inside the selected period.
//   const setWindow = (center, span, frac = 0.5) => {
//     const total = baseTo - baseFrom;
//     const size = Math.min(Math.max(span, MIN_ZOOM_SPAN), total);
//     if (size >= total - 1) return setZoom(null);
//     let from = center - size * frac;
//     from = Math.min(Math.max(from, baseFrom), baseTo - size);
//     setZoom({ from, to: from + size });
//   };

//   const view = () => (zoom ? { from: zoom.from, to: zoom.to } : { from: baseFrom, to: baseTo });

//   const zoomBy = (factor, center) => {
//     const { from, to } = view();
//     const span = to - from;
//     const c = center != null && center >= from && center <= to ? center : from + span / 2;
//     setWindow(c, span * factor, (c - from) / span);
//   };

//   const panBy = (dir) => {
//     if (!zoom) return;
//     const span = zoom.to - zoom.from;
//     const from = Math.min(Math.max(zoom.from + dir * span * 0.5, baseFrom), baseTo - span);
//     setZoom({ from, to: from + span });
//   };

//   // Filters / device changed -> back to the full range.
//   useEffect(() => {
//     setZoom(null);
//     setSel(null);
//   }, [viewMode, selectedHour, customFrom, customTo, activeId]);

//   // Ctrl/Cmd + wheel (and trackpad pinch, which arrives as ctrl + wheel) zooms the
//   // CHART.  The listener is non-passive so preventDefault() really stops the
//   // browser from zooming the whole page.  A plain wheel still scrolls the page.
//   const latest = useRef({});
//   latest.current = { zoomBy };
//   useEffect(() => {
//     const el = wrapRef.current;
//     if (!el) return undefined;
//     const onWheel = (e) => {
//       if (!e.ctrlKey && !e.metaKey) return;
//       e.preventDefault();
//       latest.current.zoomBy(e.deltaY < 0 ? 0.7 : 1 / 0.7, hoverRef.current);
//     };
//     el.addEventListener("wheel", onWheel, { passive: false });
//     return () => el.removeEventListener("wheel", onWheel);
//   }, [chartData.length > 0]);

//   // Drag-to-zoom.
//   const onDown = (e) => {
//     if (e && e.activeLabel != null) setSel({ a: e.activeLabel, b: e.activeLabel });
//   };
//   const onMove = (e) => {
//     if (e && e.activeLabel != null) {
//       hoverRef.current = e.activeLabel;
//       if (sel) setSel((prev) => (prev ? { ...prev, b: e.activeLabel } : prev));
//     }
//   };
//   const onUp = () => {
//     if (sel) {
//       const from = Math.min(sel.a, sel.b);
//       const to = Math.max(sel.a, sel.b);
//       if (to - from >= MIN_ZOOM_SPAN / 2) setWindow((from + to) / 2, to - from);
//     }
//     setSel(null);
//   };

//   const subtitle = {
//     today: "Current and indoor temperature for today (1-minute averages)",
//     "last-24-hours": "Current and indoor temperature over the last 24 hours",
//     week: "Current and indoor temperature this week (15-minute averages)",
//     month: "Current and indoor temperature this month (hourly averages)",
//     "selected-hour": "Current and indoor temperature for the selected hour",
//     custom: "Current and indoor temperature for the selected date range",
//   }[viewMode] || "";
//   const zoomNote = zoom
//     ? ` · zoomed ${formatLabel(zoom.from, range.from, range.to)} – ${formatLabel(zoom.to, range.from, range.to)}`
//     : "";

//   const chartHeight = expanded ? 600 : height;

//   // "Selected hour" picker: future hours are disabled, matching MetricHistoryChart.
//   const currentHour = new Date().getHours();
//   const hourOptions = Array.from({ length: 24 }, (_, hour) => ({
//     value: hour,
//     label: `${pad2(hour)}:00 – ${pad2((hour + 1) % 24)}:00`,
//     disabled: hour > currentHour,
//   }));

//   return (
//     <div
//       className={`chart-box current-temp-chart current-history-card${
//         expanded ? " current-history-expanded" : ""
//       }`}
//     >
//       <div className="chart-header">
//         <div>
//           <h3>⚡ Current &amp; Temperature</h3>
//           <span>{subtitle}{zoomNote}</span>
//         </div>

//         <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
//           {/* AC selector -- only when the scope resolves to more than one device. */}
//           {devices.length > 1 && (
//             <select
//               className="chart-select"
//               value={activeId}
//               onChange={(e) => setPicked(e.target.value)}
//               aria-label="Select AC"
//             >
//               {devices.map((d) => (
//                 <option key={d.id} value={d.id}>
//                   {d.name}
//                 </option>
//               ))}
//             </select>
//           )}

//           {/* 1. viewMode dropdown -- same set as MetricHistoryChart */}
//           <select
//             className="chart-select"
//             value={viewMode}
//             onChange={(e) => setViewMode(e.target.value)}
//             aria-label="Graph time range"
//           >
//             {VIEW_MODES.map((m) => (
//               <option key={m.value} value={m.value}>
//                 {m.label}
//               </option>
//             ))}
//           </select>

//           {/* 2. custom date range -- only for viewMode === "custom" */}
//           {viewMode === "custom" && (
//             <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
//               <input
//                 className="chart-select"
//                 type="date"
//                 aria-label="History start date"
//                 value={customFrom}
//                 max={customTo || undefined}
//                 onChange={(e) => setCustomFrom(e.target.value)}
//               />
//               <span style={{ color: "#64748b", fontSize: 12 }}>to</span>
//               <input
//                 className="chart-select"
//                 type="date"
//                 aria-label="History end date"
//                 value={customTo}
//                 min={customFrom || undefined}
//                 max={new Date().toISOString().slice(0, 10)}
//                 onChange={(e) => setCustomTo(e.target.value)}
//               />
//             </div>
//           )}

//           {/* 3. hour picker -- only for viewMode === "selected-hour" */}
//           {viewMode === "selected-hour" && (
//             <select
//               className="chart-select"
//               value={Math.min(selectedHour, currentHour)}
//               onChange={(e) => setSelectedHour(Number(e.target.value))}
//               aria-label="Select hour"
//             >
//               {hourOptions.map((h) => (
//                 <option key={h.value} value={h.value} disabled={h.disabled}>
//                   {h.label}
//                 </option>
//               ))}
//             </select>
//           )}

//           {/* zoom toolbar */}
//           <div className="chart-zoom-toolbar" role="group" aria-label="Zoom graph">
//             <button type="button" className="chart-zoom-btn" onClick={() => zoomBy(0.5)} title="Zoom in" aria-label="Zoom in">
//               <ZoomIn size={16} />
//             </button>
//             <button type="button" className="chart-zoom-btn" onClick={() => zoomBy(2)} disabled={!zoom} title="Zoom out" aria-label="Zoom out">
//               <ZoomOut size={16} />
//             </button>
//             <button type="button" className="chart-zoom-btn" onClick={() => panBy(-1)} disabled={!zoom} title="Earlier" aria-label="Pan earlier">
//               <ChevronLeft size={16} />
//             </button>
//             <button type="button" className="chart-zoom-btn" onClick={() => panBy(1)} disabled={!zoom} title="Later" aria-label="Pan later">
//               <ChevronRight size={16} />
//             </button>
//             <button type="button" className="chart-zoom-btn" onClick={() => setZoom(null)} disabled={!zoom} title="Reset zoom" aria-label="Reset zoom">
//               <RotateCcw size={16} />
//             </button>
//           </div>

//           {/* 4. expand button -- identical icon + tooltip to MetricHistoryChart */}
//           <button
//             type="button"
//             className="chart-expand-btn"
//             onClick={() => setExpanded((prev) => !prev)}
//             title={expanded ? "Restore Window" : "Expand Window"}
//             aria-label={expanded ? "Restore Window" : "Expand Window"}
//           >
//             {expanded ? <X size={18} /> : <Maximize2 size={18} />}
//           </button>
//         </div>
//       </div>

//       {loading && !chartData.length ? (
//         <div className="chart-empty">Loading chart data...</div>
//       ) : error && !chartData.length ? (
//         <div className="chart-empty">{error}</div>
//       ) : chartData.length ? (
//         <div
//           ref={wrapRef}
//           className="chart-zoom-area"
//           onDoubleClick={() => setZoom(null)}
//           title="Ctrl + scroll (or pinch) to zoom, drag to select a range, double-click to reset"
//         >
//         <ResponsiveContainer width="100%" height={chartHeight}>
//           <LineChart
//             data={chartData}
//             margin={{ top: 10, right: 70, left: 10, bottom: 5 }}
//             onMouseDown={onDown}
//             onMouseMove={onMove}
//             onMouseUp={onUp}
//             onMouseLeave={() => {
//               hoverRef.current = null;
//               setSel(null);
//             }}
//           >
//             <CartesianGrid strokeDasharray="3 3" />

//             <XAxis
//               dataKey="t"
//               type="number"
//               scale="time"
//               domain={[range.from.getTime(), range.to.getTime()]}
//               allowDataOverflow
//               ticks={ticks}
//               tickFormatter={(v) => formatTick(v, range.from, range.to)}
//               tick={{ fontSize: 10 }}
//               minTickGap={20}
//             />

//             <YAxis
//               yAxisId="left"
//               tick={{ fontSize: 11, fill: "#2563eb" }}
//               axisLine={{ stroke: "#2563eb" }}
//               tickLine={{ stroke: "#2563eb" }}
//               domain={[0, "auto"]}
//               label={{
//                 value: "Current (A)",
//                 angle: -90,
//                 position: "insideLeft",
//                 style: { textAnchor: "middle", fontSize: 11, fill: "#2563eb" },
//               }}
//             />

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
//               labelFormatter={(v) => formatLabel(v, range.from, range.to)}
//               formatter={(value, name) =>
//                 value == null
//                   ? ["No reading", name]
//                   : [`${Number(value).toFixed(2)} ${name === "Current" ? "A" : "°C"}`, name]
//               }
//             />

//             <Legend />

//             {sel && sel.a !== sel.b && (
//               <ReferenceArea
//                 yAxisId="left"
//                 x1={Math.min(sel.a, sel.b)}
//                 x2={Math.max(sel.a, sel.b)}
//                 fill="#2563eb"
//                 fillOpacity={0.12}
//                 stroke="#2563eb"
//                 strokeOpacity={0.35}
//               />
//             )}

//             <Line
//               yAxisId="left"
//               type="linear"
//               dataKey="current"
//               name="Current"
//               stroke="#2563eb"
//               strokeWidth={2}
//               dot={false}
//               connectNulls={false}
//               isAnimationActive={false}
//             />

//             <Line
//               yAxisId="right"
//               type="linear"
//               dataKey="temperature"
//               name="Temperature"
//               stroke="#f97316"
//               strokeWidth={2}
//               dot={false}
//               connectNulls={false}
//               isAnimationActive={false}
//             />
//           </LineChart>
//         </ResponsiveContainer>
//         </div>
//       ) : (
//         <div className="chart-empty">
//           No current or temperature history available for this period.
//         </div>
//       )}

//       {(!hasCurrent || !hasTemperature) && !loading && chartData.length > 0 && (
//         <small className="chart-note">
//           {!hasCurrent && "No current readings for this AC in this period. "}
//           {!hasTemperature && "No indoor temperature readings for this AC in this period."}
//         </small>
//       )}
//     </div>
//   );
// }

// export default CurrentTemperatureChart;



// Current & Temperature chart -- one AC at a time, straight from the database.
//
// Filter UI now mirrors MetricHistoryChart / CurrentHistoryChart 1:1:
//   - viewMode dropdown (VIEW_MODES)
//   - custom date-range pair (shown for "custom")
//   - hour dropdown (shown for "selected-hour", future hours disabled)
//   - lucide Maximize2 / X expand button
// The per-AC series fetching, /current-history/ query and 10 s refresh loop are
// untouched -- resolveRange() only translates filter state into the
// {from, to, period, interval_seconds} quadruple that /current-history/ already
// consumed before.
//
// Zoom (graph only, never the page):
//   - Ctrl/Cmd + mouse wheel, or a trackpad pinch, zooms the TIME axis around the
//     cursor.  preventDefault() on that wheel event stops the browser from
//     zooming the whole page while the pointer is over the chart.
//   - Drag a rectangle on the chart to zoom into that time span.
//   - Toolbar: zoom in / out, pan left / right, reset (or double-click the chart).
//   - X ticks, the Y ranges and the data resolution all follow the zoomed span
//     (zooming in re-requests finer buckets from the backend).
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { Maximize2, X, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { API_BASE, getJSON, scopeToParams } from "../shared/api";
import { VIEW_MODES, getViewRange } from "../shared/metricHistory";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const pad2 = (n) => String(n).padStart(2, "0");

/* ------------------------------------------------------------------ *
 * Use the SAME range calculation as MetricHistoryChart.
 * The history endpoint still receives its existing period/interval parameters.
 * ------------------------------------------------------------------ */
function resolveRange(viewMode, selectedHour, customFrom, customTo, now = new Date()) {
  const sharedRange = getViewRange(
    viewMode,
    selectedHour,
    now,
    viewMode === "custom" ? customFrom : "",
    viewMode === "custom" ? customTo : ""
  );

  // getViewRange is shared with MetricHistoryChart and returns millisecond bounds.
  // Accept Date values too, so this wrapper remains safe if that helper changes.
  const asMillis = (value) => value instanceof Date ? value.getTime() : Number(value);
  const from = new Date(asMillis(sharedRange.from));
  const to = new Date(asMillis(sharedRange.to));

  const spanHours = Math.max(0, (to.getTime() - from.getTime()) / HOUR);
  let apiPeriod = "today";
  let intervalSeconds = 60;

  if (viewMode === "last-24-hours") {
    apiPeriod = "24h";
    intervalSeconds = 60;
  } else if (viewMode === "week") {
    apiPeriod = "week";
    intervalSeconds = 900;
  } else if (viewMode === "month") {
    apiPeriod = "month";
    intervalSeconds = 3600;
  } else if (viewMode === "custom") {
    // Match the chart's existing history API resolution policy for custom ranges.
    intervalSeconds = spanHours > 48 ? 3600 : spanHours > 12 ? 900 : 60;
  }

  return { from, to, apiPeriod, intervalSeconds };
}

/* ------------------------------------------------------------------ *
 *  X-axis helpers -- span-driven so every mode gets sensible ticks
 * ------------------------------------------------------------------ */
const DAY = 24 * HOUR;
const TICK_STEPS = [
  MINUTE, 2 * MINUTE, 5 * MINUTE, 10 * MINUTE, 15 * MINUTE, 30 * MINUTE,
  HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR, DAY, 2 * DAY, 3 * DAY, 7 * DAY,
];
const MIN_ZOOM_SPAN = 5 * MINUTE;

// Smallest "nice" step that gives <= ~9 ticks for this span.
function tickStepFor(spanMs) {
  return TICK_STEPS.find((st) => spanMs / st <= 9) || TICK_STEPS[TICK_STEPS.length - 1];
}

// Ticks on LOCAL clock boundaries; the step follows the visible span, so zooming
// changes the axis (e.g. 3 h ticks -> 5 min ticks).
function makeTicksFromRange(from, to) {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const step = tickStepFor(toMs - fromMs);
  const ticks = [];
  if (step >= DAY) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    if (d.getTime() < fromMs) d.setDate(d.getDate() + 1);
    for (; d.getTime() <= toMs; d.setDate(d.getDate() + step / DAY)) ticks.push(d.getTime());
    return ticks;
  }
  const offset = new Date(fromMs).getTimezoneOffset() * MINUTE;
  for (let t = Math.ceil((fromMs - offset) / step) * step + offset; t <= toMs; t += step) ticks.push(t);
  return ticks;
}

function formatTick(ts, from, to) {
  const spanMs = to.getTime() - from.getTime();
  const d = new Date(ts);
  if (tickStepFor(spanMs) >= DAY) return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return spanMs > 26 * HOUR ? `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${time}` : time;
}

function formatLabel(ts, from, to) {
  const spanH = (to.getTime() - from.getTime()) / HOUR;
  const d = new Date(ts);
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  if (spanH <= 26) return time;
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}, ${time}`;
}

// Bucket size for a zoomed window (finer when zoomed in).
function zoomInterval(spanMs) {
  const h = spanMs / HOUR;
  return h > 48 ? 3600 : h > 12 ? 900 : 60;
}

/* ------------------------------------------------------------------ *
 *  Data loading
 * ------------------------------------------------------------------ */
const REFRESH_MS = 10_000;

const toNum = (v) => {
  const n = Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(n) ? null : n;
};

function useDeviceSeries({ viewMode, selectedHour, customFrom, customTo, deviceId, scope, zoom }) {
  const [state, setState] = useState({ current: [], temperature: [], loading: true, error: "" });
  const scopeJson = JSON.stringify(scope || {});

  // Changing the filters clears the chart; zooming keeps the old points on
  // screen until the finer data arrives.
  useEffect(() => {
    setState({ current: [], temperature: [], loading: true, error: "" });
  }, [viewMode, selectedHour, customFrom, customTo, deviceId, scopeJson]);

  const zoomFrom = zoom?.from ?? 0;
  const zoomTo = zoom?.to ?? 0;

  useEffect(() => {
    let disposed = false;
    let controller = null;

    const run = async () => {
      controller?.abort();
      controller = new AbortController();
      const { signal } = controller;
      const base = resolveRange(viewMode, selectedHour, customFrom, customTo, new Date());
      const { from, to, apiPeriod, intervalSeconds } = zoomFrom
        ? {
            from: new Date(zoomFrom),
            to: new Date(zoomTo),
            apiPeriod: "today",
            intervalSeconds: zoomInterval(zoomTo - zoomFrom),
          }
        : base;

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
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err?.message || "Unable to load history.",
        }));
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
  }, [viewMode, selectedHour, customFrom, customTo, deviceId, scopeJson, zoomFrom, zoomTo]);

  return state;
}

const toMap = (rows) => {
  const m = new Map();
  for (const r of rows || []) {
    const ts = Date.parse(r.bucket);
    const v = toNum(r.avg);
    if (Number.isFinite(ts) && v !== null) m.set(ts, v);
  }
  return m;
};

function buildChartData(currentRows, temperatureRows, stepMs) {
  const cur = toMap(currentRows);
  const tmp = toMap(temperatureRows);
  const times = [...new Set([...cur.keys(), ...tmp.keys()])].sort((a, b) => a - b);
  const maxGap = stepMs * 3;
  const out = [];
  let prev = null;
  for (const t of times) {
    if (prev !== null && t - prev > maxGap) {
      out.push({ t: prev + stepMs, current: null, temperature: null });
    }
    out.push({ t, current: cur.get(t) ?? null, temperature: tmp.get(t) ?? null });
    prev = t;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 *  Component
 * ------------------------------------------------------------------ */
function CurrentTemperatureChart({ deviceId = "", scope = {}, height = 320 }) {
  const [viewMode, setViewMode] = useState("last-24-hours");
  const [selectedHour, setSelectedHour] = useState(() => new Date().getHours());
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  });
  const [customTo, setCustomTo] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  });
  const [expanded, setExpanded] = useState(false);
  const [picked, setPicked] = useState("");
  const [zoom, setZoom] = useState(null);          // null = full range, else { from, to } in ms
  const [sel, setSel] = useState(null);            // drag-selection { a, b }
  const wrapRef = useRef(null);
  const hoverRef = useRef(null);                   // time (ms) under the cursor

  const { current, temperature, loading, error } = useDeviceSeries({
    viewMode,
    selectedHour,
    customFrom,
    customTo,
    deviceId,
    scope,
    zoom,
  });

  // Every AC that has current or temperature rows.
  const devices = useMemo(() => {
    const byId = new Map();
    [...current, ...temperature].forEach((s) => {
      if (!byId.has(s.device_id)) byId.set(s.device_id, s.device_name || s.device_id);
    });
    return [...byId]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [current, temperature]);

  const activeId = devices.some((d) => d.id === picked) ? picked : devices[0]?.id || "";

  // Range for the chart render itself.  Recomputes when filters change (and on
  // every state update in the parent, so it stays aligned with the fetch loop).
  const baseRange = useMemo(
    () => resolveRange(viewMode, selectedHour, customFrom, customTo, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewMode, selectedHour, customFrom, customTo]
  );

  // Visible window: the zoom if set, otherwise the whole selected period.
  const range = useMemo(
    () =>
      zoom
        ? {
            from: new Date(zoom.from),
            to: new Date(zoom.to),
            intervalSeconds: zoomInterval(zoom.to - zoom.from),
          }
        : baseRange,
    [zoom, baseRange]
  );

  const { chartData, ticks, hasCurrent, hasTemperature } = useMemo(() => {
    const rows = (list) => list.find((s) => s.device_id === activeId)?.data || [];
    const stepMs = range.intervalSeconds * 1000;
    const all = buildChartData(rows(current), rows(temperature), stepMs);
    // Only what is on screen (+1 bucket each side): the Y axes auto-scale to the
    // visible readings, so zooming into a quiet stretch re-scales the axis.
    const lo = range.from.getTime() - stepMs;
    const hi = range.to.getTime() + stepMs;
    const chartData = zoom ? all.filter((p) => p.t >= lo && p.t <= hi) : all;
    return {
      chartData,
      ticks: makeTicksFromRange(range.from, range.to),
      hasCurrent: chartData.some((p) => p.current != null),
      hasTemperature: chartData.some((p) => p.temperature != null),
    };
  }, [activeId, current, temperature, range, zoom]);

  /* ---------------- zoom controls ---------------- */
  const baseFrom = baseRange.from.getTime();
  const baseTo = baseRange.to.getTime();

  // New window from a centre point and span, kept inside the selected period.
  const setWindow = (center, span, frac = 0.5) => {
    const total = baseTo - baseFrom;
    const size = Math.min(Math.max(span, MIN_ZOOM_SPAN), total);
    if (size >= total - 1) return setZoom(null);
    let from = center - size * frac;
    from = Math.min(Math.max(from, baseFrom), baseTo - size);
    setZoom({ from, to: from + size });
  };

  const view = () => (zoom ? { from: zoom.from, to: zoom.to } : { from: baseFrom, to: baseTo });

  const zoomBy = (factor, center) => {
    const { from, to } = view();
    const span = to - from;
    const c = center != null && center >= from && center <= to ? center : from + span / 2;
    setWindow(c, span * factor, (c - from) / span);
  };

  const panBy = (dir) => {
    if (!zoom) return;
    const span = zoom.to - zoom.from;
    const from = Math.min(Math.max(zoom.from + dir * span * 0.5, baseFrom), baseTo - span);
    setZoom({ from, to: from + span });
  };

  // Filters / device changed -> back to the full range.
  useEffect(() => {
    setZoom(null);
    setSel(null);
  }, [viewMode, selectedHour, customFrom, customTo, activeId]);

  // Ctrl/Cmd + wheel (and trackpad pinch, which arrives as ctrl + wheel) zooms the
  // CHART.  The listener is non-passive so preventDefault() really stops the
  // browser from zooming the whole page.  A plain wheel still scrolls the page.
  const latest = useRef({});
  latest.current = { zoomBy };
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      latest.current.zoomBy(e.deltaY < 0 ? 0.7 : 1 / 0.7, hoverRef.current);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [chartData.length > 0]);

  // Drag-to-zoom.
  const onDown = (e) => {
    if (e && e.activeLabel != null) setSel({ a: e.activeLabel, b: e.activeLabel });
  };
  const onMove = (e) => {
    if (e && e.activeLabel != null) {
      hoverRef.current = e.activeLabel;
      if (sel) setSel((prev) => (prev ? { ...prev, b: e.activeLabel } : prev));
    }
  };
  const onUp = () => {
    if (sel) {
      const from = Math.min(sel.a, sel.b);
      const to = Math.max(sel.a, sel.b);
      if (to - from >= MIN_ZOOM_SPAN / 2) setWindow((from + to) / 2, to - from);
    }
    setSel(null);
  };

  const subtitle = {
    today: "Current and indoor temperature for today (1-minute averages)",
    "last-24-hours": "Current and indoor temperature over the last 24 hours",
    week: "Current and indoor temperature this week (15-minute averages)",
    month: "Current and indoor temperature this month (hourly averages)",
    "selected-hour": "Current and indoor temperature for the selected hour",
    custom: "Current and indoor temperature for the selected date range",
  }[viewMode] || "";
  const zoomNote = zoom
    ? ` · zoomed ${formatLabel(zoom.from, range.from, range.to)} – ${formatLabel(zoom.to, range.from, range.to)}`
    : "";

  const chartHeight = expanded ? 600 : height;

  // "Selected hour" picker: future hours are disabled, matching MetricHistoryChart.
  const currentHour = new Date().getHours();
  const hourOptions = Array.from({ length: 24 }, (_, hour) => ({
    value: hour,
    label: `${pad2(hour)}:00 – ${pad2((hour + 1) % 24)}:00`,
    disabled: hour > currentHour,
  }));

  return (
    <div
      className={`chart-box current-temp-chart current-history-card${
        expanded ? " current-history-expanded" : ""
      }`}
    >
      <div className="chart-header">
        <div>
          <h3>⚡ Current &amp; Temperature</h3>
          <span>{subtitle}{zoomNote}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {/* AC selector -- only when the scope resolves to more than one device. */}
          {devices.length > 1 && (
            <select
              className="chart-select"
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

          {/* 1. viewMode dropdown -- same set as MetricHistoryChart */}
          <select
            className="chart-select"
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            aria-label="Graph time range"
          >
            {VIEW_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          {/* 2. custom date range -- only for viewMode === "custom" */}
          {viewMode === "custom" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <input
                className="chart-select"
                type="date"
                aria-label="History start date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <span style={{ color: "#64748b", fontSize: 12 }}>to</span>
              <input
                className="chart-select"
                type="date"
                aria-label="History end date"
                value={customTo}
                min={customFrom || undefined}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          )}

          {/* 3. hour picker -- only for viewMode === "selected-hour" */}
          {viewMode === "selected-hour" && (
            <select
              className="chart-select"
              value={Math.min(selectedHour, currentHour)}
              onChange={(e) => setSelectedHour(Number(e.target.value))}
              aria-label="Select hour"
            >
              {hourOptions.map((h) => (
                <option key={h.value} value={h.value} disabled={h.disabled}>
                  {h.label}
                </option>
              ))}
            </select>
          )}

          {/* zoom toolbar */}
          <div className="chart-zoom-toolbar" role="group" aria-label="Zoom graph">
            <button type="button" className="chart-zoom-btn" onClick={() => zoomBy(0.5)} title="Zoom in" aria-label="Zoom in">
              <ZoomIn size={16} />
            </button>
            <button type="button" className="chart-zoom-btn" onClick={() => zoomBy(2)} disabled={!zoom} title="Zoom out" aria-label="Zoom out">
              <ZoomOut size={16} />
            </button>
            <button type="button" className="chart-zoom-btn" onClick={() => panBy(-1)} disabled={!zoom} title="Earlier" aria-label="Pan earlier">
              <ChevronLeft size={16} />
            </button>
            <button type="button" className="chart-zoom-btn" onClick={() => panBy(1)} disabled={!zoom} title="Later" aria-label="Pan later">
              <ChevronRight size={16} />
            </button>
            <button type="button" className="chart-zoom-btn" onClick={() => setZoom(null)} disabled={!zoom} title="Reset zoom" aria-label="Reset zoom">
              <RotateCcw size={16} />
            </button>
          </div>

          {/* 4. expand button -- identical icon + tooltip to MetricHistoryChart */}
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

      {loading && !chartData.length ? (
        <div className="chart-empty">Loading chart data...</div>
      ) : error && !chartData.length ? (
        <div className="chart-empty">{error}</div>
      ) : chartData.length ? (
        <div
          ref={wrapRef}
          className="chart-zoom-area"
          onDoubleClick={() => setZoom(null)}
          title="Ctrl + scroll (or pinch) to zoom, drag to select a range, double-click to reset"
        >
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 70, left: 10, bottom: 5 }}
            onMouseDown={onDown}
            onMouseMove={onMove}
            onMouseUp={onUp}
            onMouseLeave={() => {
              hoverRef.current = null;
              setSel(null);
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={[range.from.getTime(), range.to.getTime()]}
              allowDataOverflow
              ticks={ticks}
              tickFormatter={(v) => formatTick(v, range.from, range.to)}
              tick={{ fontSize: 10 }}
              minTickGap={20}
            />

            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: "#3182BD" }}
              axisLine={{ stroke: "#3182BD" }}
              tickLine={{ stroke: "#3182BD" }}
              domain={[0, "auto"]}
              label={{
                value: "Current (A)",
                angle: -90,
                position: "insideLeft",
                style: { textAnchor: "middle", fontSize: 11, fill: "#3182BD" },
              }}
            />

            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: "#F44336 " }}
              axisLine={{ stroke: "#F44336 " }}
              tickLine={{ stroke: "#F44336 " }}
              domain={["auto", "auto"]}
              label={{
                value: "Temperature (°C)",
                angle: 90,
                position: "insideRight",
                style: { textAnchor: "middle", fontSize: 11, fill: "#F44336 " },
              }}
            />

            <Tooltip
              labelFormatter={(v) => formatLabel(v, range.from, range.to)}
              formatter={(value, name) =>
                value == null
                  ? ["No reading", name]
                  : [`${Number(value).toFixed(2)} ${name === "Current" ? "A" : "°C"}`, name]
              }
            />

            <Legend />

            {sel && sel.a !== sel.b && (
              <ReferenceArea
                yAxisId="left"
                x1={Math.min(sel.a, sel.b)}
                x2={Math.max(sel.a, sel.b)}
                fill="#3182BD"
                fillOpacity={0.12}
                stroke="#3182BD"
                strokeOpacity={0.35}
              />
            )}

            <Line
              yAxisId="left"
              type="linear"
              dataKey="current"
              name="Current"
              stroke="#3182BD"
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
              stroke="#F44336 "
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
        </div>
      ) : (
        <div className="chart-empty">
          No current or temperature history available for this period.
        </div>
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