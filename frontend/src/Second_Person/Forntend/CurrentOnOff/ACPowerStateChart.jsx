// import React, { useEffect, useMemo, useState } from "react";
// import "./ACPowerStateChart.css";

// // ON / OFF detection based strictly on Active Energy
// const rowIsOn = (row) => {
//     const energy = Number(
//         row?.active_energy ??
//         row?.energy_consumption ??
//         row?.Energy_Consumption ??
//         row?.energyConsumption ??
//         row?.energy ??
//         row?.kwh ??
//         row?.kWh ?? 0
//     );
//     return energy > 0;
// };

// const getToken = () =>
//     ["token", "authToken", "access_token", "accessToken"]
//         .map((k) => localStorage.getItem(k))
//         .find(Boolean);

// const pickRows = (payload) => {
//     if (Array.isArray(payload)) return payload;
//     if (Array.isArray(payload?.data)) return payload.data;
//     if (Array.isArray(payload?.results)) return payload.results;
//     return [];
// };

// // Format duration nicely (e.g., "12h 30m" or "45m")
// const formatDuration = (ms) => {
//     const totalMinutes = Math.floor(ms / (1000 * 60));
//     if (totalMinutes < 60) return `${totalMinutes}m`;
//     const h = Math.floor(totalMinutes / 60);
//     const m = totalMinutes % 60;
//     return m === 0 ? `${h}h` : `${h}h ${m}m`;
// };

// const ACPowerStateChart = ({
//     data = [],
//     deviceId = "",
//     scope = {},
//     endpoint = "http://localhost:8000/api/telemetry/",
// }) => {
//     const [history, setHistory] = useState([]);
//     const [status, setStatus] = useState("idle");

//     // Fetch past 24 hours data
//     useEffect(() => {
//         if (!deviceId && !scope?.branch) {
//             setHistory([]);
//             setStatus("idle");
//             return undefined;
//         }

//         const controller = new AbortController();
//         const load = async () => {
//             setStatus("loading");
//             try {
//                 const end = new Date();
//                 const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
                
//                 const params = new URLSearchParams();
//                 params.set("from", start.toISOString());
//                 params.set("to", end.toISOString());

//                 ["state", "district", "taluka", "city", "zone", "circle", "region", "division", "branch", "floor"].forEach((key) => {
//                     if (scope?.[key] != null && String(scope[key]).trim()) {
//                         params.set(key, String(scope[key]));
//                     }
//                 });

//                 if (deviceId) params.set("device_id", String(deviceId));

//                 const token = getToken();
//                 const res = await fetch(`${endpoint}?${params.toString()}`, {
//                     signal: controller.signal,
//                     headers: token ? { Authorization: `Bearer ${token}` } : {},
//                 });
//                 if (!res.ok) throw new Error(`HTTP ${res.status}`);
//                 const payload = await res.json();
//                 setHistory(pickRows(payload));
//                 setStatus("loaded");
//             } catch (e) {
//                 if (e.name === "AbortError") return;
//                 console.error("[ACPowerStateChart] load failed:", e);
//                 setHistory([]);
//                 setStatus("error");
//             }
//         };

//         load();
//         const id = window.setInterval(load, 5 * 60 * 1000); // refresh every 5 mins
//         return () => {
//             controller.abort();
//             window.clearInterval(id);
//         };
//     }, [deviceId, scope, endpoint]);

//     // Calculate Timeline Segments & KPIs for the past 24 hours
//     const { segments, totalOnMs, totalOffMs, onEvents, axisLabels } = useMemo(() => {
//         const now = Date.now();
//         const windowMs = 24 * 60 * 60 * 1000;
//         const windowStart = now - windowMs;
        
//         // 96 bins = 15-minute intervals
//         const BINS = 96;
//         const binMs = windowMs / BINS;
//         const binStates = Array(BINS).fill("OFF");

//         // Combine API history + fallback data
//         const source = [...history, ...data];
        
//         // Filter by device if needed
//         const filteredSource = deviceId 
//             ? source.filter(r => String(r.device_id ?? r.ac_id ?? r.id) === String(deviceId))
//             : source;

//         filteredSource.forEach((row) => {
//             const time = new Date(row.timestamp ?? row.ts ?? row.created_at).getTime();
//             if (isNaN(time)) return;
//             if (time < windowStart || time > now) return;
            
//             const diff = time - windowStart;
//             const binIndex = Math.floor(diff / binMs);
            
//             if (binIndex >= 0 && binIndex < BINS) {
//                 if (rowIsOn(row)) {
//                     binStates[binIndex] = "ON";
//                 }
//             }
//         });

//         // Calculate KPIs
//         let onCount = 0;
//         let offCount = 0;
//         let events = 0;

//         for (let i = 0; i < BINS; i++) {
//             if (binStates[i] === "ON") onCount++;
//             else offCount++;

//             if (i > 0 && binStates[i] === "ON" && binStates[i - 1] === "OFF") {
//                 events++;
//             }
//         }

//         // Group adjacent bins of the same state to create a smooth bar
//         const builtSegments = [];
//         let currentState = binStates[0];
//         let count = 1;
        
//         for (let i = 1; i < BINS; i++) {
//             if (binStates[i] === currentState) {
//                 count++;
//             } else {
//                 builtSegments.push({ state: currentState, flex: count });
//                 currentState = binStates[i];
//                 count = 1;
//             }
//         }
//         builtSegments.push({ state: currentState, flex: count });

//         // Generate 7 axis labels (every 4 hours from start to now)
//         const labels = [];
//         for (let i = 0; i <= 6; i++) {
//             const t = new Date(windowStart + i * 4 * 60 * 60 * 1000);
//             // If it's the last label, show "Now" or the actual current time
//             if (i === 6) {
//                 labels.push(t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
//             } else {
//                 labels.push(t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
//             }
//         }

//         return {
//             segments: builtSegments,
//             totalOnMs: onCount * binMs,
//             totalOffMs: offCount * binMs,
//             onEvents: events,
//             axisLabels: labels,
//         };
//     }, [history, data, deviceId]);

//     return (
//         <div className="ac-power-state-card">
//             {/* Header */}
//             <div className="ac-power-state-header">
//                 <div className="ac-power-state-title">
//                     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//                         <circle cx="12" cy="12" r="10"></circle>
//                         <polyline points="12 6 12 12 16 14"></polyline>
//                     </svg>
//                     AC Runtime ({deviceId ? "Selected AC" : "All Zones"})
//                 </div>
//                 <div className="ac-power-state-legend">
//                     <span className="legend-item"><span className="dot on" /> ON</span>
//                     <span className="legend-item"><span className="dot off" /> OFF</span>
//                 </div>
//             </div>

//             {/* Timeline Bar */}
//             <div className="ac-power-state-timeline">
//                 <div className="ac-power-state-bar">
//                     {status === "loading" && <div className="segment loading" style={{ flex: 96 }} />}
//                     {status !== "loading" && segments.map((seg, i) => (
//                         <div key={i} className={`segment ${seg.state.toLowerCase()}`} style={{ flex: seg.flex }} />
//                     ))}
//                 </div>
//                 <div className="ac-power-state-axis">
//                     {axisLabels.map((label, i) => (
//                         <span key={i}>{label}</span>
//                     ))}
//                 </div>
//             </div>

//             {/* KPIs */}
//             <div className="ac-power-state-kpis">
//                 <div className="kpi-box">
//                     <div className="kpi-label">Total ON Time</div>
//                     <div className="kpi-value">{formatDuration(totalOnMs)}</div>
//                 </div>
//                 <div className="kpi-box">
//                     <div className="kpi-label">Total OFF Time</div>
//                     <div className="kpi-value">{formatDuration(totalOffMs)}</div>
//                 </div>
//                 <div className="kpi-box">
//                     <div className="kpi-label">ON Events</div>
//                     <div className="kpi-value">{new Intl.NumberFormat('en-IN').format(onEvents)}</div>
//                 </div>
//             </div>
//         </div>
//     );
// };

// export default ACPowerStateChart;

import React, { useEffect, useMemo, useState } from "react";
import { ZoomToolbar, useTimeZoom } from "../shared/chartZoom";
import "./ACPowerStateChart.css";

// Same endpoint CurrentHistoryChart already uses.
const CURRENT_HISTORY_URL = "http://localhost:8000/api/current-history/";

const getToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("authToken") ||
  localStorage.getItem("access_token") ||
  localStorage.getItem("accessToken") ||
  "";

const formatDuration = (ms) => {
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

const ACPowerStateChart = ({
  deviceId = "",
  scope = {},
  endpoint = CURRENT_HISTORY_URL,
}) => {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | loaded | empty | error
  const [error, setError] = useState("");

  // Stable dependency — plain object `scope` would re-fire on every render.
  const scopeKey = useMemo(() => JSON.stringify(scope || {}), [scope]);

  // Graph zoom over the 24 h timeline (Ctrl+scroll / pinch / drag on the bar / toolbar).
  // The 24 h of 1-minute buckets is already loaded, so zooming needs no new request.
  const nowMs = Date.now();
  const zoomState = useTimeZoom({
    baseFrom: nowMs - 24 * 60 * 60 * 1000,
    baseTo: nowMs,
    resetKey: `${deviceId}|${scopeKey}`,
  });
  const zoom = zoomState.zoom;

  /* ---------------- Fetch last 24 h from /api/current-history/ ---------------- */
  useEffect(() => {
    if (!deviceId && !scope?.branch) {
      setRows([]);
      setStatus("idle");
      setError("");
      return undefined;
    }

    const controller = new AbortController();
    let cancelled = false;

    const load = async () => {
      // Only show "loading" the first time; 10 s refreshes update in place.
      setStatus((prev) => (prev === "loaded" || prev === "empty" ? prev : "loading"));
      setError("");
      try {
        const end = new Date();
        const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

        // Mirror CurrentHistoryChart's params exactly.
        const params = new URLSearchParams({
          key: "current",                // required: the endpoint serves several metrics
          period: "today",               // 1-minute buckets
          from: String(start.getTime()), // millis, same as CurrentHistoryChart
          to: String(end.getTime()),
        });

        if (deviceId) {
          // Send both — some viewsets key on `device_id`, others on `ac_id`.
          params.set("device_id", deviceId);
          params.set("ac_id", deviceId);
        } else {
          Object.entries(scope || {}).forEach(([k, v]) => {
            if (typeof v === "string" && v) params.set(k, v);
          });
        }

        const token = getToken();
        const res = await fetch(`${endpoint}?${params.toString()}`, {
          signal: controller.signal,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: "no-store",
        });

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status} — ${body.slice(0, 200)}`);
        }

        const payload = await res.json().catch(() => ({}));
        const data = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.results)
          ? payload.results
          : Array.isArray(payload)
          ? payload
          : [];

        if (cancelled) return;

        // TEMP diagnostic — remove once the chart is populated.
        console.log(
          "[ACPowerStateChart] buckets:",
          data.length,
          "first:",
          data[0]
        );

        setRows(data);
        setStatus(data.length ? "loaded" : "empty");
        if (!data.length) {
          setError("No current samples for the last 24 hours.");
        }
      } catch (e) {
        if (e.name === "AbortError" || cancelled) return;
        console.error("[ACPowerStateChart] load failed:", e);
        setRows([]);
        setStatus("error");
        setError(e.message || "Failed to load runtime data.");
      }
    };

    load();
    const id = window.setInterval(load, 10_000); // live: re-read the DB every 10 s
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(id);
    };
  }, [deviceId, scopeKey, endpoint]);

  /* ---------------- Build the timeline bar + KPIs ---------------- */
  const { segments, totalOnMs, totalOffMs, onEvents, axisLabels, view } = useMemo(() => {
    const now = Date.now();
    const windowMs = 24 * 60 * 60 * 1000;
    const windowStart = now - windowMs;

    // Any current above this counts as "running". Backend already pre-aggregates
    // per minute, so a bucket is ON iff its average current > 0.
    const THRESHOLD = 0.0001;

    const onTimes = [];
    for (const row of rows) {
      const bucketRaw = row?.bucket ?? row?.bucket_start;
      if (!bucketRaw) continue;
      const ts = new Date(bucketRaw).getTime();
      if (!Number.isFinite(ts)) continue;
      const avg = Number(row?.avg ?? 0);
      if (!Number.isFinite(avg) || avg <= THRESHOLD) continue;
      onTimes.push(ts);
    }

    // ON/OFF state per bin for a window.  Bins are never shorter than the 1-minute
    // buckets, otherwise a zoomed-in bin could miss its bucket and look OFF.
    const binsFor = (from, to) => {
      const span = to - from;
      const binMs = Math.max(span / 96, 60_000);
      const BINS = Math.max(1, Math.ceil(span / binMs));
      const states = Array(BINS).fill("OFF");
      for (const ts of onTimes) {
        if (ts < from || ts > to) continue;
        const i = Math.min(Math.floor((ts - from) / binMs), BINS - 1);
        if (i >= 0) states[i] = "ON";
      }
      return { states, binMs, BINS };
    };

    // KPIs always describe the whole 24 h (unchanged by zoom).
    const full = binsFor(windowStart, now);
    let onBins = 0;
    let offBins = 0;
    let events = 0;
    for (let i = 0; i < full.BINS; i++) {
      if (full.states[i] === "ON") onBins++;
      else offBins++;
      if (i > 0 && full.states[i] === "ON" && full.states[i - 1] === "OFF") events++;
    }

    // The timeline bar shows the zoomed window (or the whole 24 h).
    const view = zoom ? { from: zoom.from, to: zoom.to } : { from: windowStart, to: now };
    const win = zoom ? binsFor(view.from, view.to) : full;

    // Collapse adjacent same-state bins into one flex segment.
    const builtSegments = [];
    let curState = win.states[0];
    let run = 1;
    for (let i = 1; i < win.BINS; i++) {
      if (win.states[i] === curState) {
        run++;
      } else {
        builtSegments.push({ state: curState, flex: run });
        curState = win.states[i];
        run = 1;
      }
    }
    builtSegments.push({ state: curState, flex: run });

    // 7 axis labels evenly across the visible window.
    const labels = [];
    for (let i = 0; i <= 6; i++) {
      const t = new Date(view.from + (i * (view.to - view.from)) / 6);
      labels.push(
        t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
      );
    }

    return {
      segments: builtSegments,
      totalOnMs: onBins * full.binMs,
      totalOffMs: offBins * full.binMs,
      onEvents: events,
      axisLabels: labels,
      view,
    };
  }, [rows, zoom]);

  // Pointer position on the bar -> time, for drag-to-zoom and wheel-zoom anchoring.
  const timeAt = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(Math.max((e.clientX - rect.left) / Math.max(rect.width, 1), 0), 1);
    return view.from + frac * (view.to - view.from);
  };
  const sel = zoomState.sel;

  return (
    <div className="ac-power-state-card">
      {/* Header */}
      <div className="ac-power-state-header">
        <div className="ac-power-state-title">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          AC Runtime
        </div>
        <ZoomToolbar z={zoomState} />
        <div className="ac-power-state-legend">
          <span className="legend-item">
            <span className="dot on" /> ON
          </span>
          <span className="legend-item">
            <span className="dot off" /> OFF
          </span>
        </div>
      </div>

      {/* Timeline Bar */}
      <div
        ref={zoomState.areaProps.ref}
        className="ac-power-state-timeline chart-zoom-area"
        onDoubleClick={zoomState.reset}
        title={zoomState.areaProps.title}
      >
        <div
          style={{ position: "relative" }}
          onMouseDown={(e) => zoomState.pointer.down(timeAt(e))}
          onMouseMove={(e) => zoomState.pointer.move(timeAt(e))}
          onMouseUp={zoomState.pointer.up}
          onMouseLeave={zoomState.pointer.leave}
        >
          {sel && sel.a !== sel.b && (
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${((Math.min(sel.a, sel.b) - view.from) / (view.to - view.from)) * 100}%`,
                width: `${(Math.abs(sel.b - sel.a) / (view.to - view.from)) * 100}%`,
                background: "rgba(37, 99, 235, 0.18)",
                border: "1px solid rgba(37, 99, 235, 0.45)",
                zIndex: 2,
                pointerEvents: "none",
              }}
            />
          )}
        <div className="ac-power-state-bar">
          {status === "loading" && (
            <div className="segment loading" style={{ flex: 96 }} />
          )}
          {status !== "loading" &&
            segments.map((seg, i) => (
              <div
                key={i}
                className={`segment ${seg.state.toLowerCase()}`}
                style={{ flex: seg.flex }}
              />
            ))}
        </div>
        </div>
        <div className="ac-power-state-axis">
          {axisLabels.map((label, i) => (
            <span key={i}>{label}</span>
          ))}
        </div>
      </div>

      {/* Error / empty notice */}
      {(status === "error" || status === "empty") && error && (
        <div
          style={{
            margin: "8px 0",
            padding: "8px 12px",
            borderRadius: 6,
            background: status === "error" ? "#fdecea" : "#fff8e1",
            color: status === "error" ? "#b71c1c" : "#8a6d3b",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="ac-power-state-kpis">
        <div className="kpi-box">
          <div className="kpi-label">Total ON Time</div>
          <div className="kpi-value">{formatDuration(totalOnMs)}</div>
        </div>
        <div className="kpi-box">
          <div className="kpi-label">Total OFF Time</div>
          <div className="kpi-value">{formatDuration(totalOffMs)}</div>
        </div>
        <div className="kpi-box">
          <div className="kpi-label">ON Events</div>
          <div className="kpi-value">
            {new Intl.NumberFormat("en-IN").format(onEvents)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ACPowerStateChart;