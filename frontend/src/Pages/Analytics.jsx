// import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
// import {
//     Bar,
//     BarChart,
//     CartesianGrid,
//     Legend,
//     ResponsiveContainer,
//     Tooltip,
//     XAxis,
//     YAxis,
// } from "recharts";
// import { Plus, RotateCcw, X } from "lucide-react";

// import "./Organization/Org_Dashboard.css";
// import "./Analytics.css";

// import FilterDashboard from "./Organization/FilterDashboard";
// import { useAuth } from "./Layout/AuthContext";

// /* ───────────────────────── config ───────────────────────── */

// const API_BASE = "http://192.168.1.9:8000/api";
// const HISTORY_URL = `${API_BASE}/current-history/`;

// // Same hierarchy keys the dashboard understands.
// const FILTER_KEYS = [
//     "zone", "state", "district", "taluka", "circle", "region",
//     "division", "city", "branch", "floor", "device", "ac_id",
// ];

// const EMPTY_FILTERS = {
//     hierarchy: "GEOGRAPHICAL",
//     ...Object.fromEntries(FILTER_KEYS.map((k) => [k, ""])),
// };

// // key = `key` accepted by /api/current-history/. agg: how ACs in scope combine.
// export const PARAMETERS = [
//     { key: "energy",      label: "Energy",       unit: "kWh", agg: "sum", color: "#2563eb" },
//     { key: "power",       label: "Active Power", unit: "W",   agg: "sum", color: "#f97316" },
//     { key: "voltage",     label: "Voltage",      unit: "V",   agg: "avg", color: "#16a34a" },
//     { key: "current",     label: "Current",      unit: "A",   agg: "avg", color: "#7c3aed" },
//     { key: "temperature", label: "Temperature",  unit: "°C",  agg: "avg", color: "#0891b2" },
//     { key: "humidity",    label: "Humidity",     unit: "%",   agg: "avg", color: "#e11d48" },
// ];

// const MONTHS = [
//     "January", "February", "March", "April", "May", "June",
//     "July", "August", "September", "October", "November", "December",
// ];

// /* ───────────────────────── helpers ───────────────────────── */

// const normalizeRole = (role) => String(role || "").trim().toUpperCase();

// const getToken = () =>
//     localStorage.getItem("token") ||
//     localStorage.getItem("authToken") ||
//     localStorage.getItem("access_token") ||
//     localStorage.getItem("accessToken") ||
//     "";

// const authHeaders = () => {
//     const token = getToken();
//     return {
//         Accept: "application/json",
//         ...(token ? { Authorization: token.startsWith("Token ") ? token : `Token ${token}` } : {}),
//     };
// };

// const normalizeFilters = (input = {}) => {
//     const out = { hierarchy: input.hierarchy || "GEOGRAPHICAL" };
//     FILTER_KEYS.forEach((k) => { out[k] = input[k] || ""; });
//     const device =
//         typeof input.device === "string"
//             ? input.device
//             : input.device?.value || input.device?.device_id || input.device?.id || "";
//     out.device = device;
//     out.selectedDeviceId = input.selectedDeviceId || input.device_id || device;
//     out.device_id = out.selectedDeviceId;
//     out.ac_id = input.ac_id || input.selectedAcId || "";
//     out.selectedAcId = input.selectedAcId || out.ac_id;
//     return out;
// };

// const getHeadOfficeDefaults = (user) => {
//     const d = user?.filter_defaults || {};
//     return normalizeFilters({
//         ...EMPTY_FILTERS,
//         ...d,
//         hierarchy: d.hierarchy || user?.customer_hierarchy_type || "GEOGRAPHICAL",
//         state: d.state || user?.head_office_state || user?.state_name || "",
//         district: d.district || user?.head_office_district || user?.district_name || "",
//         taluka: d.taluka || user?.head_office_taluka || "",
//         city: d.city || user?.head_office_city_name || "",
//         zone: d.zone || user?.head_office_zone || user?.zone_name || "",
//         circle: d.circle || "",
//         region: d.region || "",
//         division: d.division || "",
//         branch: d.branch || user?.head_office_branch || "",
//         floor: d.floor || user?.head_office_floor || "",
//     });
// };

// const getFilterAccess = (user) => {
//     const role = normalizeRole(user?.role);
//     const hierarchy = String(
//         user?.customer_hierarchy_type || user?.customer?.hierarchy_type || "GEOGRAPHICAL"
//     ).toUpperCase();

//     const isSuperAdmin = ["ORG_SUPER_ADMIN", "SUPER_ADMIN"].includes(role);
//     const isAdmin = ["BR_ADMIN", "ADMIN"].includes(role);
//     const isEngineer = role === "ENGINEER";

//     const allowed = isSuperAdmin
//         ? ["GEOGRAPHICAL", "ZONAL"]
//         : ["GEOGRAPHICAL", "ZONAL"].includes(hierarchy) ? [hierarchy] : [];

//     const lockedValues = {};
//     if (isAdmin || isEngineer) {
//         if (isEngineer) {
//             const site = user?.site_name || user?.site?.name;
//             const branch = user?.branch_name || user?.branch?.name;
//             if (site) lockedValues.site = site;
//             if (branch) lockedValues.branch = branch;
//         }
//         if (hierarchy === "ZONAL") {
//             const zone = user?.zone_name || user?.zone?.name;
//             if (zone) lockedValues.zone = zone;
//         } else if (hierarchy === "GEOGRAPHICAL") {
//             const state = user?.state_name || user?.state?.name;
//             if (state) lockedValues.state = state;
//         }
//     }
//     return { allowed, lockedValues };
// };

// const periodId = (p) => `${p.year}-${String(p.month + 1).padStart(2, "0")}`;
// const periodLabel = (p) => `${MONTHS[p.month].slice(0, 3)} ${p.year}`;
// const daysInMonth = (p) => new Date(Date.UTC(p.year, p.month + 1, 0)).getUTCDate();

// const scopeQuery = (filters) => {
//     const params = new URLSearchParams();
//     const deviceId = filters.device_id || filters.selectedDeviceId || filters.ac_id || filters.device;
//     if (deviceId) {
//         params.set("device_id", String(deviceId));
//         return params;
//     }
//     Object.entries(filters || {}).forEach(([k, v]) => {
//         if (typeof v === "string" && v.trim()) params.set(k, v);
//     });
//     return params;
// };

// // One parameter, one month -> { [dayOfMonth]: value }. Daily buckets (UTC day).
// async function fetchMonth(filters, param, period, signal) {
//     const from = Date.UTC(period.year, period.month, 1);
//     const to = Date.UTC(period.year, period.month + 1, 1) - 1;
//     const params = scopeQuery(filters);
//     params.set("key", param.key);
//     params.set("agg", param.agg);
//     params.set("period", "month");
//     params.set("interval_seconds", "86400");
//     params.set("from", String(from));
//     params.set("to", String(to));

//     const response = await fetch(`${HISTORY_URL}?${params}`, {
//         headers: authHeaders(),
//         cache: "no-store",
//         signal,
//     });
//     const result = await response.json().catch(() => ({}));
//     if (response.status === 401) throw new Error("Session expired. Please login again.");
//     if (!response.ok) throw new Error(result?.message || result?.detail || `HTTP ${response.status}`);

//     const byDay = {};
//     (result.data || []).forEach((row) => {
//         const day = new Date(row.bucket).getUTCDate();
//         if (Number.isFinite(row.avg)) byDay[day] = row.avg;
//     });
//     return byDay;
// }

// // Lighter tint of a hex colour (the comparison month), solid so legend swatches match the bars.
// const tint = (hex, amount = 0.5) => {
//     const n = parseInt(hex.slice(1), 16);
//     const mix = (c) => Math.round(c + (255 - c) * amount);
//     const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix);
//     return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
// };

// const fmt = (n) =>
//     n == null || !Number.isFinite(n)
//         ? "–"
//         : Math.abs(n) >= 100 ? Math.round(n).toLocaleString() : Number(n.toFixed(2)).toLocaleString();

// /* ───────────────────────── page ───────────────────────── */

// function PeriodPicker({ value, onChange, years }) {
//     return (
//         <div className="analytics-period">
//             <select
//                 value={value.month}
//                 onChange={(e) => onChange({ ...value, month: Number(e.target.value) })}
//                 aria-label="Month"
//             >
//                 {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
//             </select>
//             <select
//                 value={value.year}
//                 onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
//                 aria-label="Year"
//             >
//                 {years.map((y) => <option key={y} value={y}>{y}</option>)}
//             </select>
//         </div>
//     );
// }


// function Analytics() {
//     const { user: currentUser } = useAuth();
//     const filterAccess = useMemo(() => getFilterAccess(currentUser), [currentUser]);

//     const now = new Date();
//     const thisPeriod = { year: now.getFullYear(), month: now.getMonth() };

//     const [filters, setFilters] = useState(() => getHeadOfficeDefaults(currentUser));
//     const [restoreVersion, setRestoreVersion] = useState(0);

//     const [selectedKeys, setSelectedKeys] = useState(["energy"]);
//     const [periodA, setPeriodA] = useState(thisPeriod);
//     const [periodB, setPeriodB] = useState(null);      // optional "compare with"
//     const [scaleMode, setScaleMode] = useState("normalized"); // used only for mixed units

//     const [seriesData, setSeriesData] = useState({});  // `${key}|${periodId}` -> {day: value}
//     const [loading, setLoading] = useState(false);
//     const [error, setError] = useState("");

//     const cacheRef = useRef({});
//     const filtersKey = JSON.stringify(filters);

//     const handleFilterChange = useCallback((next) => setFilters(normalizeFilters(next)), []);
//     const handleReset = useCallback(() => {
//         setFilters(getHeadOfficeDefaults(currentUser));
//         setRestoreVersion((v) => v + 1);
//     }, [currentUser]);

//     const periods = useMemo(() => [periodA, periodB].filter(Boolean), [periodA, periodB]);
//     const params = useMemo(
//         () => PARAMETERS.filter((p) => selectedKeys.includes(p.key)),
//         [selectedKeys]
//     );

//     // Fetch whatever isn't cached yet; filters changing invalidates the cache.
//     useEffect(() => {
//         if (!params.length) { setSeriesData({}); return undefined; }

//         if (cacheRef.current.filtersKey !== filtersKey) cacheRef.current = { filtersKey, rows: {} };
//         const cache = cacheRef.current.rows;

//         const wanted = params.flatMap((p) => periods.map((per) => ({ p, per, id: `${p.key}|${periodId(per)}` })));
//         const missing = wanted.filter((w) => !(w.id in cache));

//         const publish = () =>
//             setSeriesData(Object.fromEntries(wanted.filter((w) => w.id in cache).map((w) => [w.id, cache[w.id]])));

//         if (!missing.length) { publish(); setLoading(false); setError(""); return undefined; }

//         const controller = new AbortController();
//         setLoading(true);
//         setError("");
//         const timer = setTimeout(async () => {   // small debounce while filters are being picked
//             try {
//                 const results = await Promise.all(
//                     missing.map((w) => fetchMonth(filters, w.p, w.per, controller.signal))
//                 );
//                 missing.forEach((w, i) => { cache[w.id] = results[i]; });
//                 publish();
//             } catch (err) {
//                 if (err?.name === "AbortError") return;
//                 setError(err?.message || "Unable to load analytics data.");
//             } finally {
//                 if (!controller.signal.aborted) setLoading(false);
//             }
//         }, 250);

//         return () => { clearTimeout(timer); controller.abort(); };
//         // eslint-disable-next-line react-hooks/exhaustive-deps
//     }, [filtersKey, params, periods]);

//     /* ── derive chart series ── */
//     const compare = Boolean(periodB);
//     const mixedUnits = new Set(params.map((p) => p.unit)).size > 1;
//     const normalized = mixedUnits && scaleMode === "normalized";

//     const series = useMemo(() => {
//         const list = [];
//         params.forEach((p) => {
//             periods.forEach((per, idx) => {
//                 const id = `${p.key}|${periodId(per)}`;
//                 const byDay = seriesData[id];
//                 if (!byDay) return;
//                 const values = Object.values(byDay);
//                 const peak = values.length ? Math.max(...values) : 0;
//                 const entries = Object.entries(byDay);
//                 const peakDay = entries.length
//                     ? entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0]
//                     : null;
//                 const total = values.reduce((s, v) => s + v, 0);
//                 list.push({
//                     id: `${p.key}__${idx}`,
//                     param: p,
//                     period: per,
//                     byDay,
//                     peak,
//                     peakDay,
//                     // Energy is a total over the month; the rest are better read as a daily average.
//                     summary: p.key === "energy" ? total : values.length ? total / values.length : null,
//                     summaryLabel: p.key === "energy" ? "Total" : "Daily avg",
//                     name: compare ? `${p.label} · ${periodLabel(per)}` : p.label,
//                     color: idx === 0 ? p.color : tint(p.color, 0.55),
//                 });
//             });
//         });
//         return list;
//     }, [params, periods, seriesData, compare]);

//     const chartData = useMemo(() => {
//         const days = Math.max(...periods.map(daysInMonth));
//         return Array.from({ length: days }, (_, i) => {
//             const day = i + 1;
//             const row = { day };
//             series.forEach((s) => {
//                 const v = s.byDay[day];
//                 if (v == null) return;
//                 row[s.id] = normalized ? (s.peak ? (v / s.peak) * 100 : 0) : v;
//                 row[`${s.id}__raw`] = v;
//             });
//             return row;
//         });
//     }, [series, periods, normalized]);

//     const hasData = series.some((s) => Object.keys(s.byDay).length > 0);
//     const singleUnit = !mixedUnits && params[0] ? params[0].unit : "";

//     const toggleParam = (key) =>
//         setSelectedKeys((prev) =>
//             prev.includes(key) ? (prev.length > 1 ? prev.filter((k) => k !== key) : prev) : [...prev, key]
//         );

//     const years = useMemo(() => {
//         const y = new Date().getFullYear();
//         return [y, y - 1, y - 2, y - 3];
//     }, []);

//     const filterSummary = FILTER_KEYS
//         .filter((k) => filters[k])
//         .map((k) => `${k[0].toUpperCase()}${k.slice(1)}: ${filters[k]}`)
//         .join("  •  ") || "All Locations";

//     return (
//         <div className="organization-dashboard analytics-page">
//             {/* 1 ── same filter as the dashboard, on top */}
//             <div className="organization-filter-card">
//                 <FilterDashboard
//                     initialValue={filters}
//                     restoreVersion={restoreVersion}
//                     allowedHierarchies={filterAccess.allowed}
//                     lockedValues={filterAccess.lockedValues}
//                     onFilterChange={handleFilterChange}
//                     onReset={handleReset}
//                 />
//             </div>

//             {/* 2 ── comparison / analytics module */}
//             <section className="analytics-card">
//                 <header className="analytics-card-head">
//                     <div>
//                         <h2>Comparison Analytics</h2>
//                         <p>{filterSummary}</p>
//                     </div>
//                 </header>

//                 <div className="analytics-controls">
//                     {/* 3 ── parameters */}
//                     <div className="analytics-control analytics-control-wide">
//                         <span className="analytics-label">Parameters</span>
//                         <div className="analytics-chips" role="group" aria-label="Parameters to compare">
//                             {PARAMETERS.map((p) => {
//                                 const on = selectedKeys.includes(p.key);
//                                 return (
//                                     <button
//                                         key={p.key}
//                                         type="button"
//                                         className={`analytics-chip${on ? " is-on" : ""}`}
//                                         style={on ? { "--chip": p.color } : undefined}
//                                         aria-pressed={on}
//                                         onClick={() => toggleParam(p.key)}
//                                     >
//                                         <i style={{ background: p.color }} />
//                                         {p.label} <small>{p.unit}</small>
//                                     </button>
//                                 );
//                             })}
//                         </div>
//                     </div>

//                     {/* 4 ── month / year */}
//                     <div className="analytics-control">
//                         <span className="analytics-label">Month / Year</span>
//                         <div className="analytics-periods">
//                             <PeriodPicker value={periodA} onChange={setPeriodA} years={years} />
//                             {periodB ? (
//                                 <>
//                                     <span className="analytics-vs">vs</span>
//                                     <PeriodPicker value={periodB} onChange={setPeriodB} years={years} />
//                                     <button
//                                         type="button"
//                                         className="analytics-icon-btn"
//                                         title="Remove comparison month"
//                                         onClick={() => setPeriodB(null)}
//                                     >
//                                         <X size={14} />
//                                     </button>
//                                 </>
//                             ) : (
//                                 <button
//                                     type="button"
//                                     className="analytics-ghost-btn"
//                                     onClick={() =>
//                                         setPeriodB(
//                                             periodA.month === 0
//                                                 ? { year: periodA.year - 1, month: 11 }
//                                                 : { year: periodA.year, month: periodA.month - 1 }
//                                         )
//                                     }
//                                 >
//                                     <Plus size={14} /> Compare month
//                                 </button>
//                             )}
//                         </div>
//                     </div>

//                     {mixedUnits && (
//                         <div className="analytics-control">
//                             <span className="analytics-label">Scale</span>
//                             <div className="analytics-seg" role="group" aria-label="Chart scale">
//                                 <button
//                                     type="button"
//                                     className={normalized ? "is-on" : ""}
//                                     onClick={() => setScaleMode("normalized")}
//                                     title="Each parameter as % of its own monthly peak, so different units sit on one axis"
//                                 >
//                                     % of peak
//                                 </button>
//                                 <button
//                                     type="button"
//                                     className={!normalized ? "is-on" : ""}
//                                     onClick={() => setScaleMode("actual")}
//                                     title="Raw values on one shared axis (small units may look flat)"
//                                 >
//                                     Actual
//                                 </button>
//                             </div>
//                         </div>
//                     )}
//                 </div>

//                 {/* 5 ── single bar chart */}
//                 {error && <div className="analytics-error">{error}</div>}

//                 <div className="analytics-chart-wrap">
//                     {loading && <div className="analytics-chart-state">Loading…</div>}
//                     {!loading && !error && !hasData && (
//                         <div className="analytics-chart-state">
//                             No data for the selected filters and month{compare ? "s" : ""}.
//                         </div>
//                     )}
//                     {hasData && (
//                         <ResponsiveContainer width="100%" height={380}>
//                             <BarChart data={chartData} margin={{ top: 4, right: 20, left: 4, bottom: 22 }} barGap={1}>
//                                 <CartesianGrid strokeDasharray="3 3" vertical={false} />
//                                 <XAxis
//                                     dataKey="day"
//                                     tick={{ fontSize: 11 }}
//                                     label={{ value: "Day of month (UTC)", position: "insideBottom", offset: -10, style: { fontSize: 11, fill: "#64748b" } }}
//                                 />
//                                 <YAxis
//                                     tick={{ fontSize: 11 }}
//                                     domain={normalized ? [0, 100] : [0, "auto"]}
//                                     tickFormatter={normalized ? (v) => `${v}%` : fmt}
//                                     label={{
//                                         value: normalized ? "% of monthly peak" : singleUnit,
//                                         angle: -90, position: "insideLeft",
//                                         style: { textAnchor: "middle", fontSize: 11, fill: "#64748b" },
//                                     }}
//                                 />
//                                 <Tooltip
//                                     labelFormatter={(d) => `Day ${d}`}
//                                     formatter={(value, name, item) => {
//                                         const s = series.find((x) => x.id === item.dataKey);
//                                         const raw = item.payload?.[`${item.dataKey}__raw`];
//                                         return [`${fmt(raw)} ${s?.param.unit || ""}${normalized ? `  (${Math.round(value)}%)` : ""}`, name];
//                                     }}
//                                 />
//                                 <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: 12 }} />
//                                 {series.map((s) => (
//                                     <Bar
//                                         key={s.id}
//                                         dataKey={s.id}
//                                         name={s.name}
//                                         fill={s.color}
//                                         radius={[2, 2, 0, 0]}
//                                         isAnimationActive={false}
//                                     />
//                                 ))}
//                             </BarChart>
//                         </ResponsiveContainer>
//                     )}
//                 </div>

//                 {hasData && (
//                     <div className="analytics-summary">
//                         {series.map((s) => (
//                             <div key={s.id} className="analytics-stat" style={{ borderLeftColor: s.color }}>
//                                 <span className="analytics-stat-name">{s.name}</span>
//                                 <strong>{fmt(s.summary)} <small>{s.param.unit}</small></strong>
//                                 <span className="analytics-stat-sub">
//                                     {s.summaryLabel}
//                                     {s.peakDay ? ` · peak day ${s.peakDay} (${fmt(s.peak)})` : ""}
//                                 </span>
//                             </div>
//                         ))}
//                     </div>
//                 )}

//                 <footer className="analytics-foot">
//                     <button type="button" className="analytics-ghost-btn" onClick={() => {
//                         setSelectedKeys(["energy"]); setPeriodA(thisPeriod); setPeriodB(null);
//                     }}>
//                         <RotateCcw size={13} /> Reset comparison
//                     </button>
//                 </footer>
//             </section>
//         </div>
//     );
// }

// export default Analytics;

import React, { useCallback, useMemo, useState } from "react";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    LineChart,
    Line,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
} from "recharts";
import { RefreshCw, BarChart3, TrendingUp, MapPin, ChartNoAxesCombined, AlertCircle, Zap } from "lucide-react";

import FilterDashboard from "./Organization/FilterDashboard";
import { useAuth } from "./Layout/AuthContext";
import "../Second_Person/Forntend/Trends.css";
import "./Analytics.css";

const API_ROOT = (import.meta.env.VITE_API_BASE_URL ||
    `http://${window.location.hostname}:8000/api`).replace(/\/$/, "");

const PARAMETER_OPTIONS = [
    { value: "energy", label: "Energy Consumption", unit: "kWh" },
    { value: "energy_cost", label: "Energy Cost", unit: "₹" },
    { value: "power", label: "Active Power", unit: "kW" },
    { value: "voltage", label: "Voltage", unit: "V" },
    { value: "current", label: "Current", unit: "A" },
    { value: "temperature", label: "Temperature", unit: "°C" },
    { value: "humidity", label: "Humidity", unit: "%" },
    { value: "frequency", label: "Frequency", unit: "Hz" },
    { value: "power_factor", label: "Power Factor", unit: "" },
];

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

const tokenFromStorage = () => {
    const keys = ["access_token", "accessToken", "token", "authToken", "jwt", "id_token"];
    for (const storage of [window.localStorage, window.sessionStorage]) {
        for (const key of keys) {
        const value = storage.getItem(key);
        if (value) return value;
        }
    }
    return null;
};

const normalizeFilters = (filters = {}) => {
    const normalized = { ...filters };
    // FilterDashboard emits both device and device_id aliases. The backend
    // accepts them, but empty values are omitted to keep requests predictable.
    Object.keys(normalized).forEach((key) => {
        if (normalized[key] === "" || normalized[key] == null) delete normalized[key];
    });
    return normalized;
};

function getFilterAccess(user) {
  const role = String(user?.role || "").toUpperCase();
  const hierarchy = String(
    user?.customer_hierarchy_type || user?.customer?.hierarchy_type || "GEOGRAPHICAL"
  ).toUpperCase();
  const isOrgAdmin = ["ORG_SUPER_ADMIN", "SUPER_ADMIN"].includes(role);
  const allowedHierarchies = isOrgAdmin
    ? ["GEOGRAPHICAL", "ZONAL"]
    : (["GEOGRAPHICAL", "ZONAL"].includes(hierarchy) ? [hierarchy] : ["GEOGRAPHICAL"]);
  const lockedValues = {};

  if (["BR_ADMIN", "ADMIN", "ENGINEER"].includes(role)) {
    if (hierarchy === "GEOGRAPHICAL") {
      const state = user?.state_name || user?.state?.name;
      if (state) lockedValues.state = state;
    } else {
      const zone = user?.zone_name || user?.zone?.name;
      if (zone) lockedValues.zone = zone;
    }
  }
  if (role === "ENGINEER") {
    const branch = user?.branch_name || user?.branch?.name;
    if (branch) lockedValues.branch = branch;
  }
  return { allowedHierarchies, lockedValues };
}

function MetricCard({ label, value, unit, detail, tone }) {
  return (
    <div className={`analytics-metric-card ${tone || ""}`}>
      <span className="analytics-muted">{label}</span>
      <strong>{value == null ? "—" : Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>
      <span className="analytics-card-unit">{unit || ""}</span>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function ChartCard({ title, subtitle, icon: Icon, children }) {
    return (
        <section className="analytics-chart-card">
        <div className="analytics-chart-heading">
            <div className="analytics-chart-title">
            {Icon && <Icon size={18} />}
            <div>
                <h3>{title}</h3>
                {subtitle && <p>{subtitle}</p>}
            </div>
            </div>
        </div>
        {children}
        </section>
    );
}

const getYAxisDomain = (dataMax, baseline = 100) => {
    if (!Number.isFinite(dataMax)) return baseline;

    return Math.max(
        baseline,
        Math.ceil((dataMax * 1.1) / baseline) * baseline
    );
};

function Analytics() {
    const { user } = useAuth();
    const { allowedHierarchies, lockedValues } = useMemo(() => getFilterAccess(user), [user]);
    const defaultHierarchy = allowedHierarchies[0] || "GEOGRAPHICAL";

    const [globalFilters, setGlobalFilters] = useState({ hierarchy: defaultHierarchy });
    const [activeModule, setActiveModule] = useState("comparison");
    const [parameter, setParameter] = useState("energy");
    const [granularity, setGranularity] = useState("MONTHLY");
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [comparePrevious, setComparePrevious] = useState(true);
    const [tariff, setTariff] = useState(" ");
    const [analyticsData, setAnalyticsData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [hasGenerated, setHasGenerated] = useState(false);

    const selectedParameter = PARAMETER_OPTIONS.find((item) => item.value === parameter) || PARAMETER_OPTIONS[0];
    const yearOptions = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: Math.max(5, currentYear - 2020 + 1) }, (_, index) => currentYear - index);
    }, []);

    const handleFilterChange = useCallback((nextFilters) => {
        setGlobalFilters((previous) => ({ ...previous, ...nextFilters }));
    }, []);

    const generateComparison = useCallback(async () => {
        if (parameter === "energy_cost" && !(Number(tariff) > 0)) {
        setError("Enter a valid electricity tariff (₹ per kWh) to calculate energy cost.");
        return;
        }

        const controller = new AbortController();
        setLoading(true);
        setError("");
        setHasGenerated(true);

        const params = new URLSearchParams();
        Object.entries(normalizeFilters(globalFilters)).forEach(([key, value]) => {
            params.set(key, String(value));
        });
        params.set("parameter", parameter);
        params.set("granularity", granularity);
        params.set("year", String(year));
        if (granularity === "MONTHLY") params.set("month", String(month));
        params.set("compare_previous", comparePrevious ? "true" : "false");
        if (parameter === "energy_cost") params.set("tariff_per_kwh", String(Number(tariff)));

        try {
        const token = tokenFromStorage();
        const response = await fetch(`${API_ROOT}/analytics/comparison/?${params.toString()}`, {
            method: "GET",
            headers: {
            Accept: "application/json",
            ...(token ? { Authorization: token.startsWith("Token ") || token.startsWith("Bearer ") ? token : `Token ${token}` } : {}),
            },
            signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result?.message || "Unable to load analytics.");
        setAnalyticsData(result);
        } catch (requestError) {
        if (requestError.name !== "AbortError") {
            setError(requestError.message || "Unable to load analytics.");
            setAnalyticsData(null);
        }
        } finally {
        setLoading(false);
        }
    }, [globalFilters, parameter, granularity, year, month, comparePrevious, tariff]);

    const periodLabel = granularity === "MONTHLY"
        ? `${MONTHS[month - 1]} ${year}`
        : String(year);

    const comparisonLabel = granularity === "MONTHLY"
        ? `${MONTHS[(month + 10) % 12]} ${month === 1 ? year - 1 : year}`
        : String(year - 1);

    const periodComparison = analyticsData?.period_comparison || [];
    const trend = analyticsData?.trend || [];
    const locationComparison = analyticsData?.location_comparison || [];
    const summary = analyticsData?.summary || {};

    return (
        <main className="analytics-page">
            <header className="analytics-page-header">
                <nav className="analytics-module-tabs" aria-label="Analytics modules">
                    <button className={activeModule === "comparison" ? "active" : ""} onClick={() => setActiveModule("comparison")}>
                        <BarChart3 size={17} /> Comparison
                    </button>
                    <button className={activeModule === "alerts" ? "active" : ""} onClick={() => setActiveModule("alerts")}>
                        <TrendingUp size={17} /> Alerts
                    </button>
                </nav>
                <button className="analytics-refresh-button" onClick={generateComparison} disabled={loading || !hasGenerated}>
                    <RefreshCw size={16} /> {loading ? "Refreshing…" : "Refresh data"}
                </button>
            </header>

            <FilterDashboard
                initialValue={globalFilters}
                allowedHierarchies={allowedHierarchies}
                lockedValues={lockedValues}
                onFilterChange={handleFilterChange}
            />

            {activeModule === "comparison" && (
                <>
                <section className="analytics-builder">
                    <div className="analytics-section-heading">
                        <h2><BarChart3 size={18} /> Comparison configuration</h2>
                        <span>Select one metric and a period. The charts below update using this configuration.</span>
                    </div>
                    <div className="analytics-builder-grid">
                        <label className="analytics-field">
                            <span>Parameter</span>
                            <select value={parameter} onChange={(event) => setParameter(event.target.value)}>
                                {PARAMETER_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label} {item.unit ? `(${item.unit})` : ""}</option>)}
                            </select>
                        </label>
                        <label className="analytics-field">
                            <span>Time period</span>
                            <select value={granularity} onChange={(event) => setGranularity(event.target.value)}>
                                <option value="MONTHLY">Monthly</option>
                                <option value="YEARLY">Yearly</option>
                            </select>
                        </label>
                        <label className="analytics-field">
                            <span>Year</span>
                            <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
                                {yearOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                            </select>
                        </label>
                        {granularity === "MONTHLY" && (
                            <label className="analytics-field">
                                <span>Month</span>
                                <select value={month} onChange={(event) => setMonth(Number(event.target.value))}>
                                    {MONTHS.map((item, index) => <option key={item} value={index + 1}>{item}</option>)}
                                </select>
                            </label>
                        )}
                        {parameter === "energy_cost" && (
                            <label className="analytics-field">
                                <span>Tariff (₹ / kWh)</span>
                                <input type="number" min="0.01" step="0.01" value={tariff.trim()} onChange={(event) => setTariff(event.target.value)} placeholder="e.g. 7.50" />
                            </label>
                        )}
                        <label className="analytics-compare-toggle">
                            <input type="checkbox" checked={comparePrevious} onChange={(event) => setComparePrevious(event.target.checked)} />
                            <span>Compare with previous {granularity === "MONTHLY" ? "month" : "year"}</span>
                        </label>
                        <button className="analytics-generate-button" onClick={generateComparison} disabled={loading}>
                            {loading ? "Generating..." : "Generate Comparison"}
                        </button>
                    </div>
                    <div className="analytics-period-caption">
                        Selected: <strong>{periodLabel}</strong>
                        {comparePrevious && <> <span>vs</span> Previous: <strong>{comparisonLabel}</strong></>}
                    </div>
                </section>

                {error && <div className="analytics-error" role="alert">{error}</div>}
                {loading && <div className="analytics-loading">Loading comparison data...</div>}

                {!loading && analyticsData && (
                    <>
                    <section className="analytics-kpi-grid">
                        <MetricCard label="Selected period" 
                            value={summary.current_value} 
                            unit={selectedParameter.unit} 
                            detail={periodLabel} 
                        />
                        <MetricCard label="Previous period" 
                            value={comparePrevious ? summary.previous_value : null} 
                            unit={selectedParameter.unit} 
                            detail={comparePrevious ? comparisonLabel : "Comparison disabled"} 
                        />
                        <MetricCard 
                            label="Difference" 
                            value={comparePrevious ? summary.difference : null} 
                            unit={selectedParameter.unit} 
                            detail="Selected minus previous" 
                        />
                        <MetricCard 
                            label="Percentage change" 
                            value={comparePrevious ? summary.percentage_change : null} 
                            unit="%" detail="Compared with previous period" 
                            tone={Number(summary.percentage_change) > 0 ? "warning" : "positive"} 
                        />
                    </section>

                    <div className="analytics-chart-grid">
                        <ChartCard title="Period Comparison" subtitle="Selected period vs previous period by location" icon={BarChart3}>
                            {periodComparison.length ? (
                                <ResponsiveContainer width="100%" height={310}>
                                    <BarChart data={periodComparison} margin={{ top: 12, right: 12, left: 4, bottom: 10 }}>
                                        <CartesianGrid 
                                            strokeDasharray="3 3" 
                                            vertical={false} 
                                        />
                                        <XAxis 
                                            dataKey="label" 
                                            angle={-25} 
                                            textAnchor="end" 
                                            interval={0} 
                                            height={45} 
                                        />
                                        <YAxis />
                                        {/* <YAxis
                                            domain={[0, (dataMax) => getYAxisDomain(dataMax, 100)]}
                                            allowDataOverflow={false}
                                        /> */}
                                        <Tooltip
                                            shared={true}
                                            formatter={(value, name) => [
                                                `${Number(value).toLocaleString("en-IN")} ${selectedParameter.unit}`,
                                                name
                                            ]}
                                        />
                                        <Legend />
                                        <Bar
                                            dataKey="current"
                                            name={periodLabel}
                                            fill="#3182BD"
                                            barSize={comparePrevious ? 30 : 48}
                                            radius={[5, 5, 0, 0]}
                                        />

                                        {comparePrevious && (
                                            <Bar
                                                dataKey="previous"
                                                name={comparisonLabel}
                                                fill="#94a3b8"
                                                barSize={30}
                                                radius={[5, 5, 0, 0]}
                                            />
                                        )}
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <p className="analytics-empty">No location comparison data for this selection.</p>}
                        </ChartCard>

                        <ChartCard title="Period Trend" subtitle={granularity === "MONTHLY" ? "Daily values across both months" : "Monthly values across both years"} icon={TrendingUp}>
                            {trend.length ? (
                                <ResponsiveContainer width="100%" height={310}>
                                    <LineChart data={trend} margin={{ top: 12, right: 12, left: 4, bottom: 10 }}>
                                        <CartesianGrid 
                                            strokeDasharray="3 3" 
                                            vertical={false} 
                                        />
                                        <XAxis dataKey="label" />
                                        <YAxis />
                                        {/* <YAxis
                                            domain={[0, (dataMax) => getYAxisDomain(dataMax, 100)]}
                                            allowDataOverflow={false}
                                        /> */}
                                        <Tooltip />
                                        <Legend />
                                        <Line 
                                            type="monotone" 
                                            dataKey="current" 
                                            name={periodLabel} 
                                            stroke="#3182BD" 
                                            strokeWidth={2.5} 
                                            dot={false} 
                                            connectNulls={false} 
                                        />
                                        {comparePrevious && 
                                            <Line 
                                                type="monotone" 
                                                dataKey="previous" 
                                                name={comparisonLabel} 
                                                stroke="#94a3b8" 
                                                strokeWidth={2.5} 
                                                dot={false} 
                                                connectNulls={false} 
                                            />
                                        }
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : <p className="analytics-empty">No trend data for this selection.</p>}
                        </ChartCard>

                        <ChartCard title="Location-wise Comparison" subtitle="Breakdown for the selected period" icon={MapPin}>
                            {locationComparison.length ? (
                                <ResponsiveContainer width="100%" height={310}>
                                    <BarChart data={locationComparison} margin={{ top: 12, right: 12, left: 4, bottom: 10 }}>
                                        <CartesianGrid 
                                            strokeDasharray="3 3" 
                                            vertical={false} 
                                        />
                                        <XAxis 
                                            dataKey="label" 
                                            angle={-25} 
                                            textAnchor="end" 
                                            interval={0} 
                                            height={45} 
                                        />
                                        <YAxis />
                                        <Tooltip 
                                            formatter={(value) => [`${Number(value).toLocaleString("en-IN")} ${selectedParameter.unit}`, 
                                            selectedParameter.label]} 
                                        />
                                        <Bar
                                            dataKey="value"
                                            name={selectedParameter.label}
                                            fill="#0f989f"
                                            barSize={48}
                                            radius={[5, 5, 0, 0]}
                                        />
                                        <Legend />

                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <p className="analytics-empty">No location breakdown available.</p>}
                        </ChartCard>
                    </div>
                    {analyticsData.meta?.note && <p className="analytics-data-note">{analyticsData.meta.note}</p>}
                    </>
                )}

                {!hasGenerated && !loading && (
                    <div className="analytics-empty-state">
                        <BarChart3 size={34} />
                        <h3>Build your comparison</h3>
                        <p>Choose a parameter and month or year, then generate charts using the filters above.</p>
                    </div>
                )}
                {hasGenerated && !loading && !error && analyticsData && analyticsData.meta?.has_data === false && (
                    <div className="analytics-empty-state compact">
                        <h3>No telemetry data found</h3>
                        <p>Try another date range or broaden the selected location filters.</p>
                    </div>
                )}
                </>
            )}

            {activeModule === "alerts" && (
                <section className="analytics-placeholder trends-panel">
                    <div className="analytics-placeholder-icon"><AlertCircle size={28} /></div>
                    <h2>Alerts analytics</h2>
                    <p>This module will use the selected dashboard filters to show energy spikes, abnormal readings, and device communication alerts.</p>
                    <span className="analytics-coming-soon">Module coming next</span>
                </section>
            )}
            {activeModule === "utilization" && (
                <section className="analytics-placeholder trends-panel">
                    <div className="analytics-placeholder-icon"><Zap size={28} /></div>
                    <h2>On/Off utilization</h2>
                    <p>This module will use the selected dashboard filters to show AC operating hours, idle hours, and utilization percentages.</p>
                    <span className="analytics-coming-soon">Module coming next</span>
                </section>
            )}
        </main>
    );
}

export default Analytics;