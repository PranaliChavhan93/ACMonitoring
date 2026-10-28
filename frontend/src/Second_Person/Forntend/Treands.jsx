import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import { ArrowLeft, BrainCircuit, RefreshCw, ChartNoAxesCombined, AlertCircle } from "lucide-react";
import "./Trends.css";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://192.168.1.4:8000/api").replace(/\/$/, "");
const GENAI_BASE = (import.meta.env.VITE_GENAI_API_BASE_URL || "http://127.0.0.1:8001").replace(/\/$/, "");
const FILTER_STORAGE_KEY = "acMonitoringTrendsFilters";
const FILTER_KEYS = [
  "hierarchy", "country", "state", "district", "taluka", "city",
  "zone", "circle", "region", "division", "branch", "floor",
  "device", "device_id", "selectedDeviceId", "ac_id",
];
const TIME_FIELDS = ["timestamp", "ts", "time", "datetime", "date", "created_at", "last_updated"];

function getToken() {
  for (const key of ["token", "authToken", "access_token", "accessToken", "jwt"]) {
    const value = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (value) return value;
  }
  return "";
}

function getAuthHeaders() {
  const token = getToken();
  return {
    Accept: "application/json",
    ...(token ? { Authorization: token.startsWith("Token ") || token.startsWith("Bearer ") ? token : `Token ${token}` } : {}),
  };
}

function readSavedFilters() {
  try {
    const value = localStorage.getItem(FILTER_STORAGE_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload.filter((row) => row && typeof row === "object");
  if (Array.isArray(payload?.data)) return payload.data.filter((row) => row && typeof row === "object");
  if (Array.isArray(payload?.results)) return payload.results.filter((row) => row && typeof row === "object");
  if (Array.isArray(payload?.records)) return payload.records.filter((row) => row && typeof row === "object");
  return [];
}

function timestampOf(row) {
  const key = Object.keys(row || {}).find((name) => TIME_FIELDS.includes(name.toLowerCase()));
  if (!key) return null;
  const raw = row[key];
  if (raw === null || raw === undefined || raw === "") return null;
  let parsed;
  if (typeof raw === "number" || /^\d+$/.test(String(raw))) {
    let n = Number(raw);
    if (String(raw).length <= 10) n *= 1000;
    else if (String(raw).length >= 16) n /= 1000;
    parsed = new Date(n).getTime();
  } else {
    parsed = new Date(raw).getTime();
  }
  return Number.isFinite(parsed) ? parsed : null;
}

function isNumericMetric(key, rows) {
  if (TIME_FIELDS.includes(key.toLowerCase())) return false;
  if (/^(id|ac_id|device_id|customer_id|branch_id|floor_id|site_id|uuid|status|relay|alarm_status)$/i.test(key)) return false;
  const values = rows.map((row) => row[key]).filter((value) => value !== null && value !== undefined && value !== "");
  if (!values.length) return false;
  return values.filter((value) => Number.isFinite(Number(value))).length / values.length >= 0.7;
}

function metricLabel(value) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value ?? "") : date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function summarizeMetric(rows, key) {
  const values = rows.map((row) => Number(row[key])).filter(Number.isFinite);
  if (!values.length) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  return {
    count: values.length,
    latest: values[values.length - 1],
    min: Math.min(...values),
    max: Math.max(...values),
    average: sum / values.length,
  };
}

export default function Trends() {
  const location = useLocation();
  const navigate = useNavigate();
  const [filters, setFilters] = useState(() => location.state?.filters || readSavedFilters());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("24h");
  const [aggregation, setAggregation] = useState("raw");
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  const [analysis, setAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  useEffect(() => {
    const nextFilters = location.state?.filters || readSavedFilters();
    if (nextFilters) setFilters(nextFilters);
  }, [location.state]);

  const branchSelected = Boolean(String(filters?.branch || "").trim());

  const fetchRows = useCallback(async () => {
    if (!branchSelected) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      FILTER_KEYS.forEach((key) => {
        const value = filters?.[key];
        if (value !== undefined && value !== null && String(value).trim()) {
          params.set(key, String(value));
        }
      });
      params.set("t", String(Date.now()));
      const response = await fetch(`${API_BASE}/ac-data/?${params.toString()}`, {
        method: "GET",
        headers: getAuthHeaders(),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(response.status === 401 ? "Your session is not authorized. Please sign in again." : `Telemetry API returned HTTP ${response.status}.`);
      const payload = await response.json();
      const nextRows = normalizeRows(payload);
      setRows(nextRows);
      setSelectedMetrics((previous) => {
        const available = nextRows.length ? Object.keys(nextRows[0]).filter((key) => isNumericMetric(key, nextRows)) : [];
        const valid = previous.filter((key) => available.includes(key));
        return valid.length ? valid : available.slice(0, 4);
      });
      if (!nextRows.length) setError("No telemetry rows were returned for this branch. The API may return only the latest readings; historical trends require a history endpoint.");
    } catch (fetchError) {
      setError(fetchError?.message || "Unable to load telemetry for this branch.");
    } finally {
      setLoading(false);
    }
  }, [branchSelected, filters]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const allMetrics = useMemo(() => {
    if (!rows.length) return [];
    const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    return keys.filter((key) => isNumericMetric(key, rows));
  }, [rows]);

  const timeFilteredRows = useMemo(() => {
    const now = Date.now();
    const windowMs = period === "24h" ? 24 * 60 * 60 * 1000 : period === "7d" ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    const dated = rows.map((row) => ({ ...row, __ts: timestampOf(row) })).filter((row) => row.__ts !== null);
    if (!dated.length) return rows;
    return dated.filter((row) => row.__ts >= now - windowMs).map((row) => ({
      ...row,
      __chartTime: shortTime(row.__ts),
      __chartTs: row.__ts,
    }));
  }, [rows, period]);

  const chartRows = useMemo(() => {
    const sorted = [...timeFilteredRows].sort((a, b) => (timestampOf(a) ?? 0) - (timestampOf(b) ?? 0));
    return sorted.map((row) => ({
      ...row,
      __chartTime: row.__chartTime || shortTime(timestampOf(row) ?? row.timestamp ?? row.ts ?? row.time ?? ""),
    }));
  }, [timeFilteredRows]);

  const stats = useMemo(() => selectedMetrics.map((metric) => ({
    key: metric,
    ...summarizeMetric(chartRows, metric),
  })).filter((item) => item.count), [chartRows, selectedMetrics]);

  const runAnalysis = async () => {
    if (!chartRows.length || !selectedMetrics.length) return;
    setAnalyzing(true);
    setAnalysisError("");
    setAnalysis("");
    try {
      const summary = Object.fromEntries(stats.map((item) => [item.key, item]));
      const response = await fetch(`${GENAI_BASE}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          metrics: selectedMetrics,
          aggregation,
          rows: chartRows.slice(-500).map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !key.startsWith("__")))),
          summary: { ...summary, branch: filters.branch, hierarchy: filters.hierarchy, period },
        }),
      });
      if (!response.ok) throw new Error(`GenAI service returned HTTP ${response.status}. Check that the FastAPI service is running on port 8001.`);
      const result = await response.json();
      setAnalysis(result.analysis || result.explanation || result.summary || JSON.stringify(result, null, 2));
    } catch (analysisFetchError) {
      setAnalysisError(analysisFetchError?.message || "Could not generate AI insights.");
    } finally {
      setAnalyzing(false);
    }
  };

  if (!branchSelected) {
    return (
      <main className="trends-page">
        <section className="trends-empty">
          <AlertCircle size={42} />
          <h1>Choose a branch first</h1>
          <p>Trends are available only after selecting a branch in the dashboard hierarchy.</p>
          <button className="trends-primary" onClick={() => navigate("/org/dashboard")}>Back to Dashboard</button>
        </section>
      </main>
    );
  }

  return (
    <main className="trends-page">
      <header className="trends-header">
        <div>
          <button className="trends-back" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back</button>
          <p className="trends-eyebrow"><ChartNoAxesCombined size={16} /> GENAI TREND EXPLORER</p>
          <h1>Branch Trends</h1>
          <p className="trends-subtitle">
            {filters.hierarchy || "Hierarchy"} · {filters.state || filters.zone || "All areas"} · {filters.branch}
            {filters.device ? ` · ${filters.device}` : ""}
          </p>
        </div>
        <button className="trends-secondary" onClick={fetchRows} disabled={loading}><RefreshCw size={16} /> {loading ? "Refreshing…" : "Refresh data"}</button>
      </header>

      <section className="trends-toolbar">
        <div className="trends-control">
          <label>Time range</label>
          <div className="trends-segmented">
            {[["24h", "24 hours"], ["7d", "7 days"], ["30d", "30 days"]].map(([value, label]) => (
              <button key={value} className={period === value ? "active" : ""} onClick={() => setPeriod(value)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="trends-control">
          <label>Aggregation</label>
          <select value={aggregation} onChange={(event) => setAggregation(event.target.value)}>
            <option value="raw">Raw readings</option>
            <option value="minute">Minute average</option>
            <option value="hour">Hourly average</option>
            <option value="day">Daily average</option>
          </select>
        </div>
      </section>

      {error && <div className="trends-notice"><AlertCircle size={18} /><span>{error}</span></div>}

      <section className="trends-panel">
        <div className="trends-panel-heading">
          <div><h2>Available numeric metrics</h2><p>Choose which telemetry fields to plot. Metrics are detected from the selected branch's returned data.</p></div>
          <span className="trends-count">{allMetrics.length} detected</span>
        </div>
        {allMetrics.length ? (
          <div className="trends-metric-list">
            {allMetrics.map((metric) => (
              <label key={metric} className="trends-metric-option">
                <input type="checkbox" checked={selectedMetrics.includes(metric)} onChange={(event) => setSelectedMetrics((previous) => event.target.checked ? [...previous, metric] : previous.filter((key) => key !== metric))} />
                <span>{metricLabel(metric)}</span>
              </label>
            ))}
          </div>
        ) : <p className="trends-muted">{loading ? "Detecting metrics…" : "No numeric metrics were detected in the returned rows."}</p>}
      </section>

      {stats.length > 0 && (
        <section className="trends-stats-grid">
          {stats.map((item) => (
            <article className="trends-stat-card" key={item.key}>
              <span>{metricLabel(item.key)}</span>
              <strong>{Number(item.latest).toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
              <small>Avg {Number(item.average).toLocaleString(undefined, { maximumFractionDigits: 2 })} · Min {Number(item.min).toLocaleString(undefined, { maximumFractionDigits: 2 })} · Max {Number(item.max).toLocaleString(undefined, { maximumFractionDigits: 2 })}</small>
            </article>
          ))}
        </section>
      )}

      <section className="trends-chart-grid">
        {selectedMetrics.map((metric) => (
          <article className="trends-panel trends-chart-card" key={metric}>
            <div className="trends-panel-heading"><div><h2>{metricLabel(metric)}</h2><p>{chartRows.length} rows in selected time window</p></div></div>
            <div className="trends-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRows} margin={{ top: 8, right: 18, left: 4, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="__chartTime" minTickGap={32} tick={{ fontSize: 11 }} />
                  <YAxis width={65} tick={{ fontSize: 11 }} />
                  <Tooltip labelFormatter={(label) => label} formatter={(value) => [Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 }), metricLabel(metric)]} />
                  <Legend />
                  <Line type="monotone" dataKey={metric} name={metricLabel(metric)} stroke="#0f766e" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>
        ))}
      </section>

      <section className="trends-panel trends-ai-panel">
        <div className="trends-panel-heading">
          <div><h2><BrainCircuit size={20} /> GenAI explanation</h2><p>Ask the GenAI service to summarize changes, peaks, and possible anomalies in these branch metrics.</p></div>
          <button className="trends-primary" onClick={runAnalysis} disabled={analyzing || !chartRows.length || !selectedMetrics.length}><BrainCircuit size={16} /> {analyzing ? "Analyzing…" : "Explain trends"}</button>
        </div>
        {analysisError && <div className="trends-notice"><AlertCircle size={18} /><span>{analysisError}</span></div>}
        {analysis ? <div className="trends-analysis-text">{analysis}</div> : <p className="trends-muted">AI insights will appear here after you select metrics and click “Explain trends”.</p>}
      </section>
    </main>
  );
}
