
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
    // { value: "power", label: "Active Power", unit: "kW" },
    // { value: "voltage", label: "Voltage", unit: "V" },
    // { value: "current", label: "Current", unit: "A" },
    // { value: "temperature", label: "Temperature", unit: "°C" },
    // { value: "humidity", label: "Humidity", unit: "%" },
    // { value: "frequency", label: "Frequency", unit: "Hz" },
    { value: "power_factor", label: "Power Factor", unit: "" },
];

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

const MULTI_PARAMETER = false;

const PERIOD_OPTIONS = [
    { value: "MONTHLY", label: "Monthly" },
    { value: "YEARLY", label: "Yearly" },
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
    
    const [granularity, setGranularity] = useState("MONTHLY");
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [comparePrevious, setComparePrevious] = useState(true);
    const [tariff, setTariff] = useState(" ");
    const [analyticsData, setAnalyticsData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [hasGenerated, setHasGenerated] = useState(false);

    const [parameters, setParameters] = useState(["energy"]);

    const selectedParameter =
        PARAMETER_OPTIONS.find((item) => item.value === parameters[0]) || PARAMETER_OPTIONS[0];
    const parameter = selectedParameter.value;
    
    const yearOptions = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: Math.max(5, currentYear - 2020 + 1) }, (_, index) => currentYear - index);
    }, []);

    // const parameter = parameters[0]; // primary one – rest of your code keeps using this

    const toggleParameter = useCallback((value) => {
        setParameters((prev) => {
            if (!MULTI_PARAMETER) return [value];
            if (!prev.includes(value)) return [...prev, value];
            return prev.length > 1 ? prev.filter((v) => v !== value) : prev; // keep at least one
        });
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
        // params.set("parameter", parameter);
        if (MULTI_PARAMETER) params.set("parameters", parameters.join(","));
        if (parameters.includes("energy_cost")) params.set("tariff_per_kwh", String(Number(tariff)));

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
    
    }, [globalFilters, parameters, parameter, granularity, year, month, comparePrevious, tariff]);
    // }, [globalFilters, parameter, granularity, year, month, comparePrevious, tariff]);

    useEffect(() => {
        if (!hasGenerated) return;
        generateComparison();
    }, [parameter]);

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
                        <div className="analytics-field analytics-field-wide">
                            <span>Parameter{MULTI_PARAMETER ? "s" : ""}</span>
                            <div className="analytics-chips" role="group" aria-label="Parameters to compare">
                                {PARAMETER_OPTIONS.map((item) => {
                                    const on = parameters.includes(item.value);
                                    return (
                                        <button
                                            key={item.value}
                                            type="button"
                                            className={`analytics-chip${on ? " active" : ""}`}
                                            aria-pressed={on}
                                            onClick={() => toggleParameter(item.value)}
                                        >
                                            {item.label}
                                            {item.unit && <small>{item.unit}</small>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="analytics-field analytics-field-wide">
                            <span>Time period</span>

                            <div className="analytics-period-row">
                                {/* Monthly / Yearly */}
                                <div className="analytics-chips" role="group" aria-label="Period type">
                                    {PERIOD_OPTIONS.map((item) => (
                                        <button
                                            key={item.value}
                                            type="button"
                                            className={`analytics-chip${granularity === item.value ? " active" : ""}`}
                                            aria-pressed={granularity === item.value}
                                            onClick={() => setGranularity(item.value)}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Year */}
                                {/* <select
                                    className="analytics-year-select"
                                    value={year}
                                    onChange={(event) => setYear(Number(event.target.value))}
                                    aria-label="Year"
                                >
                                    {yearOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                                </select> */}
                            </div>

                            {/* Month chips – only for Monthly */}
                            {/* {granularity === "MONTHLY" && (
                                <div className="analytics-month-grid" role="group" aria-label="Month">
                                    {MONTHS.map((name, index) => {
                                        const value = index + 1;
                                        const now = new Date();
                                        const isFuture = year === now.getFullYear() && value > now.getMonth() + 1;
                                        return (
                                            <button
                                                key={name}
                                                type="button"
                                                title={name}
                                                disabled={isFuture}
                                                className={`analytics-chip${month === value ? " active" : ""}`}
                                                aria-pressed={month === value}
                                                onClick={() => setMonth(value)}
                                            >
                                                {name.slice(0, 3)}
                                            </button>
                                        );
                                    })}
                                </div>
                            )} */}
                        </div>

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