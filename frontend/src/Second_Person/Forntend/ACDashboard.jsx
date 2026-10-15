
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRollingAverage } from "./hooks/useRollingAverage";

import Total_Acs from "./KPI Cards/Total_Acs";
import Active_Acs from "./KPI Cards/Active Acs";
import Total_Energy from "./KPI Cards/Total_Energy";
import Active_Energy from "./KPI Cards/Active_Energy";
import Active_Power from "./KPI Cards/Active_Power";
import Average_Temperature from "./KPI Cards/Average_Temperature";
import Average_Humidity from "./KPI Cards/Average_Humidity";
import Alerts from "./KPI Cards/Alerts";

import TemperatureChart from "./TemperatureChart/TemperatureChart";
import HumidityChart from "./HumidityChart/HumidityChart";
import PowerConsumptionChart from "./PowerConsumptionChart/PowerConsumptionChart";
import EnergyConsumptionChart from "./EnergyConsumptionChart/EnergyConsumptionChart";
import ZoneEnergyChart from "./ZoneEnergyChart/ZoneEnergyChart";
import ACHealthChart from "./ACHealthChart/ACHealthChart";
import CurrentFluctuationChart from "./CurrentFluctuationChart";
import ACTable from "./ACTable/ACTable";
import ACDeviceTable from "./ACDeviceTable";
import EnergyMap from "./EnergyMap/EnergyMap";
import EnergyCostCard from "./EnergyCostCard";

import AIAssistantPanel from "./AIAssistantPanel";

import "./dashboard.css";
import "./dashboard-insight.css";

const numberValue = (value) => {
    if (value === null || value === undefined || value === "") {
        return 0;
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
};

const getVoltage = (item) => numberValue(item?.voltage ?? item?.Voltage);

const getCurrent = (item) => numberValue(item?.current ?? item?.Current);

const getPower = (item) => {
    const value =
        item?.active_power ??
        item?.Active_Power ??
        item?.activePower ??
        item?.power ??
        item?.Power;

    if (value !== undefined && value !== null && value !== "") {
        return numberValue(value);
    }

    return getVoltage(item) * getCurrent(item);
};

const getEnergy = (item) =>
    numberValue(
        item?.energy_consumption ??
        item?.Energy_Consumption ??
        item?.energyConsumption ??
        item?.energy ??
        item?.kwh ??
        item?.kWh
    );

const getTemperature = (item) =>
    numberValue(
        item?.indoor_temperature ??
        item?.indoor_temp ??
        item?.temperature ??
        item?.temp
    );

const getHumidity = (item) => numberValue(item?.indoor_humidity ?? item?.humidity);

const getStatus = (item) =>
    String(item?.status ?? item?.ac_status ?? item?.state ?? "")
        .trim()
        .toLowerCase();

const isActive = (item) => ["active", "running", "on", "1"].includes(getStatus(item));

const getHealthStatus = (item) =>
    String(
        item?.health_status ??
        item?.health ??
        item?.alert_status ??
        ""
    )
        .trim()
        .toLowerCase();

const isAlert = (item) =>
    Number(item?.alarm_status) === 1 ||
    ["attention", "critical", "alert", "warning"].includes(
        getHealthStatus(item)
    );

function ACDashboard({
    data = [],
    filters = {},
    cardFilters = {},
    visibleWidgets = {},
    onCardFilterChange,
}) {
    const navigate = useNavigate();
    const [showAIModule, setShowAIModule] = useState(false);
    const [branchWeather, setBranchWeather] = useState([]);
    const [weatherStatus, setWeatherStatus] = useState("idle");
    const [weatherError, setWeatherError] = useState("");
    const safeData = useMemo(() => {
        if (Array.isArray(data)) return data;
        if (Array.isArray(data?.data)) return data.data;
        return [];
    }, [data]);

    // Apply card-level filters without mutating the source data.
    const filteredData = useMemo(() => {
        let result = safeData;

        if (cardFilters?.alerts?.active === true) {
            result = result.filter(isAlert);
        }

        if (cardFilters?.status?.value) {
            const wanted = String(cardFilters.status.value)
                .trim()
                .toLowerCase();

            result = result.filter(
                (item) => getStatus(item) === wanted
            );
        }
        return result;
    }, [safeData, cardFilters]);

    // Preserve the existing rolling-average behavior.
    const { deviceData, trendHistory } = useRollingAverage(
        filteredData,
        {
            windowMs: 60000,
            recalcMs: 30000,
            historyLimit: 60,
        }
    );

    const metrics = useMemo(() => {
        const totalACs = filteredData.length;
        const activeRecords = filteredData.filter(isActive);

        const totalEnergy = filteredData.reduce( (sum, item) => sum + getEnergy(item), 0 );

        const activeEnergy = activeRecords.reduce( (sum, item) => sum + getEnergy(item), 0 );

        const totalPower = filteredData.reduce( (sum, item) => sum + getPower(item), 0 );

        const temperatures = filteredData
            .map(getTemperature)
            .filter((value) => value !== 0);

        const humidities = filteredData
            .map(getHumidity)
            .filter((value) => value !== 0);

        const averageTemperature = temperatures.length
            ? temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length
            : 0 ;

        const averageHumidity = humidities.length
            ? humidities.reduce((sum, value) => sum + value, 0) / humidities.length
            : 0 ;

        const alertCount = filteredData.filter(isAlert).length;

        return {
            totalACs,
            activeACs: activeRecords.length,
            totalEnergy,
            activeEnergy,
            totalPower,
            averageTemperature,
            averageHumidity,
            alertCount,
        };
    }, [filteredData]);

    const insightData = useMemo(
            () => ({
            totalACs: metrics.totalACs,
            activeACs: metrics.activeACs,
            totalEnergy: Number(metrics.totalEnergy.toFixed(2)),
            activeEnergy: Number(metrics.activeEnergy.toFixed(2)),
            activePower: Number(metrics.totalPower.toFixed(2)),
            averageTemperature: Number(
                metrics.averageTemperature.toFixed(1)
            ),
            averageHumidity: Number(
                metrics.averageHumidity.toFixed(1)
            ),
            alerts: metrics.alertCount,
            records: filteredData.length,
            historyPoints: Array.isArray(trendHistory)
                ? trendHistory.length
                : 0,
            }),
            [metrics, filteredData.length, trendHistory]
    );

    const dashboardPayload = useMemo(() => {
        const acHealth = filteredData.map((item) => ({
            ac_id:
                item?.ac_id ??
                item?.device_name ??
                item?.device_id ??
                item?.id ??
                "Unknown",
            status:
                item?.status ??
                item?.ac_status ??
                item?.state ??
                "unknown",
            health_status:
                item?.health_status ??
                item?.health ??
                item?.alert_status ??
                "unknown",
            alarm_status: item?.alarm_status ?? null,
        }));

        return {
            dashboard_name: "AC Energy Monitoring",
            generated_at: new Date().toISOString(),
            filters,
            kpis: insightData,
            trends: Array.isArray(trendHistory)
                ? trendHistory
                : [],
            ac_data: filteredData,
            ac_health: acHealth,
            alerts: filteredData.filter(isAlert),
            additional_data: {
                device_data: Array.isArray(deviceData)
                ? deviceData
                : [],
            },
        };
    }, [
        filters,
        insightData,
        trendHistory,
        filteredData,
        deviceData,
    ]);

    const handleTrendsClick = () => {
        navigate("/org/dashboard/trends");
    };

    // Presentation adapts to the selected hierarchy without changing API polling.
    const hierarchyLevels = filters?.hierarchy === "ZONAL"
        ? ["zone", "circle", "region", "division", "branch", "floor"]
        : ["state", "district", "taluka", "city", "branch", "floor"];
    const selectedLevel = [...hierarchyLevels].reverse().find((key) => Boolean(filters?.[key])) || "country";
    const isBranchScope = ["branch", "floor"].includes(selectedLevel);
    const isFloorScope = selectedLevel === "floor";
    const isSingleDeviceScope = Boolean(filters?.ac_id || filters?.device_id || filters?.device);
    const selectedState = filters?.state || "";
    const showWidget = (key) => visibleWidgets?.[key] !== false;

    // Local outdoor weather is fetched from Open-Meteo using the coordinates
    // stored on the selected branch. AC telemetry and rolling averages remain unchanged.
    const branchCoordinates = useMemo(() => {
        const candidates = [...safeData, ...filteredData];
        const record = candidates.find((item) => {
            const lat = Number(item?.latitude ?? item?.lat);
            const lon = Number(item?.longitude ?? item?.lon);
            return item?.latitude != null && item?.longitude != null &&
                item?.latitude !== "" && item?.longitude !== "" &&
                Number.isFinite(lat) && Number.isFinite(lon) &&
                lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
        });
        if (!record) return null;
        return {
            latitude: Number(record.latitude ?? record.lat),
            longitude: Number(record.longitude ?? record.lon),
        };
    }, [safeData, filteredData]);

    useEffect(() => {
        const shouldFetchWeather = selectedLevel === "branch" && Boolean(filters?.branch);
        if (!shouldFetchWeather) {
            setBranchWeather([]);
            setWeatherStatus("idle");
            setWeatherError("");
            return undefined;
        }

        if (!branchCoordinates) {
            setBranchWeather([]);
            setWeatherStatus("missing-coordinates");
            setWeatherError("This branch has no saved latitude/longitude. Add coordinates to the branch record first.");
            return undefined;
        }

        const controller = new AbortController();
        const loadWeather = async () => {
            setWeatherStatus("loading");
            setWeatherError("");
            try {
                const params = new URLSearchParams({
                    latitude: String(branchCoordinates.latitude),
                    longitude: String(branchCoordinates.longitude),
                    hourly: "temperature_2m,relative_humidity_2m",
                    past_days: "1",
                    forecast_days: "1",
                    timezone: "auto",
                });
                const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
                    signal: controller.signal,
                });
                if (!response.ok) throw new Error(`Weather service returned HTTP ${response.status}.`);
                const payload = await response.json();
                const times = payload?.hourly?.time || [];
                const temperatures = payload?.hourly?.temperature_2m || [];
                const humidities = payload?.hourly?.relative_humidity_2m || [];
                const points = times.map((timestamp, index) => ({
                    timestamp,
                    temperature: temperatures[index] == null ? null : Number(temperatures[index]),
                    humidity: humidities[index] == null ? null : Number(humidities[index]),
                })).filter((point) => point.temperature !== null || point.humidity !== null);
                setBranchWeather(points);
                setWeatherStatus(points.length ? "loaded" : "empty");
                if (!points.length) setWeatherError("The weather service returned no hourly readings for these coordinates.");
            } catch (error) {
                if (error.name === "AbortError") return;
                setBranchWeather([]);
                setWeatherStatus("error");
                setWeatherError(error.message || "Unable to load local weather data.");
            }
        };
        loadWeather();
        return () => controller.abort();
    }, [
        selectedLevel,
        filters?.branch,
        branchCoordinates?.latitude,
        branchCoordinates?.longitude,
    ]);

    return (
        <div className="ac-dashboard">
            {/* <div className="ac-dashboard-header">
                <div>
                    <h1>AC Energy Monitoring</h1>
                    <p>
                        Real-time AC performance, energy and health monitoring
                    </p>
                </div>

                <div className="dashboard-header-actions">
                    <button
                        type="button"
                        className="trends-button"
                        onClick={handleTrendsClick}
                    >
                        Trends
                    </button>

                    <div className="dashboard-live-status">
                        <span className="live-dot" />
                        <span>LIVE</span>
                    </div>
                </div>
            </div> */}

            {/* <div className="dashboard-filter-info">
                <span className="filter-label">Current View:</span>

                <span className="filter-value">
                {Object.entries(filters || {})
                    .filter(
                    ([key, value]) =>
                        key !== "hierarchy" &&
                        value !== null &&
                        value !== undefined &&
                        value !== ""
                    )
                    .map(([, value]) => value)
                    .join(" > ") || "All Locations"}
                </span>

                <span className="record-count">
                    {filteredData.length} AC
                    {filteredData.length !== 1 ? "s" : ""}
                </span>
            </div> */}

            <br />

            {filteredData.length === 0 ? (
                <div className="dashboard-no-data">
                    <div className="no-data-icon">📊</div>
                    <h2>No AC data available</h2>
                    <p>There is no data for the selected filters.</p>
                </div>
            ) : (
                <>
                <section className="ai-module-toggle-section">
                    <button
                        type="button"
                        className="trends-button ai-module-toggle-button"
                        onClick={() => setShowAIModule((previous) => !previous)}
                        aria-expanded={showAIModule}
                        aria-controls="ai-module-panel"
                    >
                        {showAIModule ? "Hide AI Module ▲" : "Show AI Module"}
                    </button>

                    {showAIModule && (
                        <div id="ai-module-panel" className="ai-module-panel">
                        <AIAssistantPanel dashboardData={dashboardPayload} />
                        </div>
                    )}
                </section>
                
                <br />

                <section className="dashboard-section">
                    <div className="section-title dashboard-scope-heading">
                        <div>
                            <h2>{isSingleDeviceScope ? "AC Performance" : isFloorScope ? "Floor Overview" : isBranchScope ? "Branch Overview" : selectedLevel === "city" ? "City Overview" : selectedLevel === "country" ? "Organization Overview" : "Regional Overview"}</h2>
                            <p>{Object.entries(filters || {}).filter(([key, value]) => key !== "hierarchy" && value).map(([, value]) => value).join(" · ") || "All Locations"}</p>
                        </div>
                        <button type="button" className="trends-button" onClick={handleTrendsClick}>View Trends</button>
                    </div>
                    <div className="kpi-grid">
                        {showWidget("total_acs") && <Total_Acs value={metrics.totalACs} />}
                        {showWidget("active_acs") && <Active_Acs value={metrics.activeACs} />}
                        {showWidget("total_energy") && <Total_Energy value={metrics.totalEnergy} />}
                        {showWidget("active_energy") && <Active_Energy value={metrics.activeEnergy} />}
                        {selectedLevel === "branch" && showWidget("active_power") && (
                            <Active_Power value={metrics.totalPower} />
                        )}

                        {selectedLevel === "branch" && showWidget("temperature") && (
                            <Average_Temperature value={metrics.averageTemperature} />
                        )}

                        {selectedLevel === "branch" && showWidget("humidity") && (
                            <Average_Humidity value={metrics.averageHumidity} />
                        )}
                        
                        {showWidget("alerts") && <Alerts data={safeData} active={cardFilters?.alerts?.active === true} onClick={() => onCardFilterChange?.({ alerts: { active: !cardFilters?.alerts?.active } })} />}
                        {selectedState && showWidget("cost_card") && <EnergyCostCard stateName={selectedState} energyKwh={metrics.totalEnergy} />}
                    </div>
                </section>

                <section className="dashboard-grid dashboard-grid--primary">
                    {showWidget("energy_chart") && <EnergyConsumptionChart data={trendHistory} />}
                    {showWidget("power_chart") && <CurrentFluctuationChart value={metrics.totalPower} />}
                    {showWidget("health_chart") && <ACHealthChart data={deviceData} />}
                </section>

                <section className="dashboard-grid dashboard-grid--secondary">
                    {selectedLevel === "branch" && showWidget("temperature") && (
                        <TemperatureChart data={branchWeather} indoorData={trendHistory} locationName={filters?.branch} status={weatherStatus} error={weatherError} />
                    )}

                    {showWidget("zone_chart") && <ZoneEnergyChart data={deviceData} filters={filters} />}

                    {selectedLevel === "branch" && showWidget("humidity") && (
                        <HumidityChart data={branchWeather} indoorData={trendHistory} locationName={filters?.branch} status={weatherStatus} error={weatherError} />
                    )}
                    
                </section>

                {!isBranchScope && !isSingleDeviceScope && (
                    <section className="dashboard-grid dashboard-grid--regional">
                        {/* {showWidget("zone_chart") && <ZoneEnergyChart data={deviceData} filters={filters} />} */}
                        {showWidget("energy_map") && <EnergyMap data={deviceData} filters={filters} />}
                        <div className="chart-box dashboard-context-card">
                            <div className="chart-header"><div><h3>Regional Energy Snapshot</h3><span>Aggregated for the current filter</span></div></div>
                            <div className="dashboard-context-stats">
                                <div><span>AC units</span><strong>{metrics.totalACs}</strong></div>
                                <div><span>Running</span><strong>{metrics.activeACs}</strong></div>
                                <div><span>Active power</span><strong>{metrics.totalPower.toFixed(2)} W</strong></div>
                                <div><span>Alerts</span><strong>{metrics.alertCount}</strong></div>
                            </div>
                        </div>
                    </section>
                )}

                {(isBranchScope || isSingleDeviceScope) && (
                    <section className="dashboard-grid dashboard-grid--devices">
                        <PowerConsumptionChart data={deviceData} />
                        {showWidget("ac_table") && <ACDeviceTable data={filteredData} />}
                        <div className="chart-box dashboard-context-card">
                            <div className="chart-header"><div><h3>{isSingleDeviceScope ? "Selected AC Details" : "Branch Device Summary"}</h3><span>Current filter scope</span></div></div>
                            <div className="dashboard-context-stats">
                                <div><span>Installed ACs</span><strong>{metrics.totalACs}</strong></div>
                                <div><span>Running</span><strong>{metrics.activeACs}</strong></div>
                                <div><span>Avg. temperature</span><strong>{metrics.averageTemperature.toFixed(1)}°C</strong></div>
                                <div><span>Avg. humidity</span><strong>{metrics.averageHumidity.toFixed(1)}%</strong></div>
                            </div>
                            {isSingleDeviceScope && <p className="dashboard-context-note">One telemetry record is currently in scope. Confirm its device ID and timestamp before treating it as a live individual-device view.</p>}
                        </div>
                    </section>
                )}
                </>
            )}
        </div>
    );
}

export default ACDashboard;
