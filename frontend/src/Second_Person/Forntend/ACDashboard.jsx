
// import React, { useMemo, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { useRollingAverage } from "./hooks/useRollingAverage";

// import Total_Acs from "./KPI Cards/Total_Acs";
// import Active_Acs from "./KPI Cards/Active Acs";
// import Total_Energy from "./KPI Cards/Total_Energy";
// import Active_Energy from "./KPI Cards/Active_Energy";
// import Active_Power from "./KPI Cards/Active_Power";
// // import Active_Po from "./KPI Cards/Active_Power";
// import Average_Temperature from "./KPI Cards/Average_Temperature";
// import Average_Humidity from "./KPI Cards/Average_Humidity";
// import Alerts from "./KPI Cards/Alerts";

// import TemperatureChart from "./TemperatureChart/TemperatureChart";
// import HumidityChart from "./HumidityChart/HumidityChart";
// import PowerConsumptionChart from "./PowerConsumptionChart/PowerConsumptionChart";
// import EnergyConsumptionChart from "./EnergyConsumptionChart/EnergyConsumptionChart";
// import ZoneEnergyChart from "./ZoneEnergyChart/ZoneEnergyChart";
// import ACHealthChart from "./ACHealthChart/ACHealthChart";
// import CurrentFluctuationChart from "./CurrentFluctuationChart";

// import ACTable from "./ACTable/ACTable";

// import "./dashboard.css";
// import EnergyMap from "./EnergyMap/EnergyMap";

// import { HIERARCHY_CONFIG } from "../../Pages/Organization/FilterDashboard";

// const numberValue = (value) => {
//     const number = Number(value);
//     return Number.isFinite(number) ? number : 0;
// };

// const getVoltage = (item) => numberValue(item.voltage ?? item.Voltage);

// const getCurrent = (item) => numberValue(item.current ?? item.Current);

// const getPower = (item) => {
//     const directPower =
//         item.active_power ??
//         item.Active_Power ??
//         item.power ??
//         item.Power;

//     if (directPower !== undefined && directPower !== null && directPower !== "") {
//         return numberValue(directPower);
//     }

//     // Fallback: P = V × I
//     return getVoltage(item) * getCurrent(item);
// };

// const getEnergy = (item) =>
//     numberValue(
//         item.energy_consumption ??
//         item.Energy_Consumption ??
//         item.energy ??
//         item.kwh ??
//         item.kWh
//     );

// const getTemperature = (item) =>
//     numberValue(
//         item.indoor_temperature ??
//         item.indoor_temp ??
//         item.temperature ??
//         item.temp
//     );

// const getHumidity = (item) => numberValue(item.indoor_humidity ?? item.humidity);

// function ACDashboard({
//     data = [],
//     filters = {},
//     cardFilters = {},
//     visibleWidgets = {},
//     onCardFilterChange,
// }) {
//     // const [data, setData] = useState([]);

//     const navigate = useNavigate();

//     const safeData = useMemo(() => {
//         if (Array.isArray(data)) return data;
//         if (Array.isArray(data?.data)) return data.data;
//         return [];
//     }, [data]);

//     const filteredData = useMemo(() => {
//         let result = safeData;

//         if (cardFilters?.alerts?.active === true) {
//             result = result.filter((item) => Number(item.alarm_status) === 1);
//         }

//         if (cardFilters?.status?.value) {
//             const wanted = String(cardFilters.status.value).toLowerCase();
//             result = result.filter((item) => {
//                 const status = String(
//                     item.status ?? item.ac_status ?? item.state ?? ""
//                 ).toLowerCase();
//                 return status === wanted;
//             });
//         }

//         return result;
//     }, [safeData, cardFilters]);

//     const { deviceData, trendHistory } = useRollingAverage(filteredData, {
//         windowMs: 60000,
//         recalcMs: 30000,
//         historyLimit: 60,
//     });

//     const metrics = useMemo(() => {
//         const totalACs = filteredData.length;

//         const activeACs = filteredData.filter((item) => {
//             const status = String(
//                 item.status ?? item.ac_status ?? item.state ?? ""
//             ).toLowerCase();

//             return (
//                 status === "active" ||
//                 status === "running" ||
//                 status === "on" ||
//                 status === "1"
//             );
//         }).length;

//         const totalEnergy = filteredData.reduce((sum, item) => sum + getEnergy(item), 0);

//         const activeEnergy = filteredData
//             .filter((item) => {
//                 const status = String(
//                     item.status ?? item.ac_status ?? item.state ?? ""
//                 ).toLowerCase();

//                 return (
//                     status === "active" ||
//                     status === "running" ||
//                     status === "on" ||
//                     status === "1"
//                 );
//             })
//             .reduce((sum, item) => sum + getEnergy(item), 0);

//         const totalPower = filteredData.reduce((sum, item) => sum + getPower(item), 0);

//         const temperatureValues = filteredData.map(getTemperature).filter((value) => value !== 0);
//         const humidityValues = filteredData.map(getHumidity).filter((value) => value !== 0);

//         const averageTemperature =
//             temperatureValues.length > 0
//                 ? temperatureValues.reduce((sum, value) => sum + value, 0) /
//                   temperatureValues.length
//                 : 0;

//         const averageHumidity =
//             humidityValues.length > 0
//                 ? humidityValues.reduce((sum, value) => sum + value, 0) /
//                   humidityValues.length
//                 : 0;

//         const alertCount = filteredData.filter((item) => {
//             const status = String(
//                 item.health_status ?? item.health ?? item.alert_status ?? ""
//             ).toLowerCase();

//             return (
//                 status === "attention" ||
//                 status === "critical" ||
//                 status === "alert" ||
//                 status === "warning"
//             );
//         }).length;

//         return {
//             totalACs,
//             activeACs,
//             totalEnergy,
//             activeEnergy,
//             totalPower,
//             averageTemperature,
//             averageHumidity,
//             alertCount,
//         };
//     }, [filteredData]);

//     const filterText = useMemo(() => {
//         const config = HIERARCHY_CONFIG[filters.hierarchy];

//         const order = config?.levels?.map((l) => l.name) ?? [
//             "state",
//             "district",
//             "taluka",
//             "city",
//             "zone",
//             "circle",
//             "region",
//             "division",
//             "branch",
//             "floor",
//         ];

//         const selected = order.map((name) => filters[name]).filter(Boolean);

//         return selected.length ? selected.join("  >  ") : "All Locations";
//     }, [filters]);

//     const handleTrendsClick = () => {
//         navigate("/org/dashboard/trends");
//     };

//     const analyzeDashboard = () => {
//         const payload = {
//             dashboard_name: "AC Energy Monitoring",
//             generated_at: new Date().toISOString(),
//             filters,
//             kpis: {
//                 total_ac: metrics.totalACs,
//                 active_ac: metrics.activeACs,
//                 total_energy_kwh: metrics.totalEnergy,
//                 active_energy_kwh: metrics.activeEnergy,
//                 total_power_w: metrics.totalPower,
//                 average_temperature_c: metrics.averageTemperature,
//                 average_humidity_percent: metrics.averageHumidity,
//                 alert_count: metrics.alertCount,
//             },
//             trends: trendHistory,
//             ac_data: filteredData,
//             additional_data: {
//                 device_data: deviceData,
//             },
//         };

//         navigate("/org/dashboard/ai-analysis", { state: { payload } });
//     };

//     return (
//         <div className="ac-dashboard">
//             <div className="ac-dashboard-header">
//                 <div>
//                     <h1>AC Energy Monitoring</h1>
//                     <p>Real-time AC performance, energy and health monitoring</p>
//                 </div>

//                 <div className="dashboard-header-actions">
//                     <button
//                         type="button"
//                         className="trends-button"
//                         onClick={analyzeDashboard}
//                     >
//                         Analyze Dashboard
//                     </button>
                    
//                     <button
//                         type="button"
//                         className="trends-button"
//                         onClick={handleTrendsClick}
//                     >
//                         Trends
//                     </button>

//                     <div className="dashboard-live-status">
//                         <span className="live-dot"></span>
//                         <span>LIVE</span>
//                     </div>
//                 </div>
//             </div>

//             <div className="dashboard-filter-info">
//                 <span className="filter-label">Current View:</span>

//                 <span className="filter-value">{filterText}</span>

//                 <span className="record-count">
//                     {filteredData.length} AC{filteredData.length !== 1 ? "s" : ""}
//                 </span>
//             </div>

//             {filteredData.length === 0 ? (
//                 <div className="dashboard-no-data">
//                     <div className="no-data-icon">📊</div>
//                     <h2>No AC data available</h2>
//                     <p>There is no data for the selected filters.</p>
//                 </div>
//             ) : (
//                 <>
//                     <section className="dashboard-section">
//                         <div className="section-title">
//                             <h2>Overview</h2>
//                         </div>

//                         <div className="kpi-grid">
//                             <Total_Acs value={metrics.totalACs} />
//                             <Active_Acs value={metrics.activeACs} />
//                             <Total_Energy value={metrics.totalEnergy} />
//                             <Active_Energy value={metrics.activeEnergy} />
//                             <Active_Power value={metrics.totalPower} />
//                             <Average_Temperature value={metrics.averageTemperature} />
//                             <Average_Humidity value={metrics.averageHumidity} />
//                             <Alerts
//                                 data={safeData}
//                                 active={cardFilters?.alerts?.active === true}
//                                 onClick={() =>
//                                     onCardFilterChange?.({
//                                         alerts: {
//                                             active: !cardFilters?.alerts?.active,
//                                         },
//                                     })
//                                 }
//                             />
//                         </div>
//                     </section>

//                     <section className="dashboard-grid">
//                         <EnergyConsumptionChart data={trendHistory} />
//                         <CurrentFluctuationChart value={metrics.totalPower} />
//                         <ACHealthChart data={deviceData} />
//                     </section>

//                     <section className="dashboard-grid">
//                         <HumidityChart data={trendHistory} />
//                         <PowerConsumptionChart data={deviceData} />
//                         <ZoneEnergyChart data={deviceData} filters={filters} />
//                     </section>

//                     <section className="dashboard-grid">
//                         <EnergyMap data={deviceData} filters={filters} />
//                         <ACTable data={filteredData} />
//                         <TemperatureChart data={trendHistory} />
//                     </section>

//                     {/* <section className="dashboard-full-width">
//                         <ACTable data={filteredData} />
//                     </section> */}
//                 </>
//             )}
//         </div>
//     );
// }

// export default ACDashboard;




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

import "./dashboard.css";
import "./dashboard-insight.css";
import EnergyMap from "./EnergyMap/EnergyMap";

import { HIERARCHY_CONFIG } from "../../Pages/Organization/FilterDashboard";

const numberValue = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
};

const getVoltage = (item) => numberValue(item.voltage ?? item.Voltage);

const getCurrent = (item) => numberValue(item.current ?? item.Current);

const getPower = (item) => {
    const directPower =
        item.active_power ??
        item.Active_Power ??
        item.power ??
        item.Power;

    if (directPower !== undefined && directPower !== null && directPower !== "") {
        return numberValue(directPower);
    }

    // Fallback: P = V × I
    return getVoltage(item) * getCurrent(item);
};

const getEnergy = (item) =>
    numberValue(
        item.energy_consumption ??
        item.Energy_Consumption ??
        item.energy ??
        item.kwh ??
        item.kWh
    );

const getTemperature = (item) =>
    numberValue(
        item.indoor_temperature ??
        item.indoor_temp ??
        item.temperature ??
        item.temp
    );

const getHumidity = (item) => numberValue(item.indoor_humidity ?? item.humidity);

function ACDashboard({
    data = [],
    filters = {},
    cardFilters = {},
    visibleWidgets = {},
    onCardFilterChange,
}) {
    // const [data, setData] = useState([]);

    const navigate = useNavigate();

    const safeData = useMemo(() => {
        if (Array.isArray(data)) return data;
        if (Array.isArray(data?.data)) return data.data;
        return [];
    }, [data]);

    const filteredData = useMemo(() => {
        let result = safeData;

        if (cardFilters?.alerts?.active === true) {
            result = result.filter((item) => Number(item.alarm_status) === 1);
        }

        if (cardFilters?.status?.value) {
            const wanted = String(cardFilters.status.value).toLowerCase();
            result = result.filter((item) => {
                const status = String(
                    item.status ?? item.ac_status ?? item.state ?? ""
                ).toLowerCase();
                return status === wanted;
            });
        }

        return result;
    }, [safeData, cardFilters]);

    const { deviceData, trendHistory } = useRollingAverage(filteredData, {
        windowMs: 60000,
        recalcMs: 30000,
        historyLimit: 60,
    });

    const metrics = useMemo(() => {
        const totalACs = filteredData.length;

        const activeACs = filteredData.filter((item) => {
            const status = String(
                item.status ?? item.ac_status ?? item.state ?? ""
            ).toLowerCase();

            return (
                status === "active" ||
                status === "running" ||
                status === "on" ||
                status === "1"
            );
        }).length;

        const totalEnergy = filteredData.reduce((sum, item) => sum + getEnergy(item), 0);

        const activeEnergy = filteredData
            .filter((item) => {
                const status = String(
                    item.status ?? item.ac_status ?? item.state ?? ""
                ).toLowerCase();

                return (
                    status === "active" ||
                    status === "running" ||
                    status === "on" ||
                    status === "1"
                );
            })
            .reduce((sum, item) => sum + getEnergy(item), 0);

        const totalPower = filteredData.reduce((sum, item) => sum + getPower(item), 0);

        const temperatureValues = filteredData.map(getTemperature).filter((value) => value !== 0);
        const humidityValues = filteredData.map(getHumidity).filter((value) => value !== 0);

        const averageTemperature =
            temperatureValues.length > 0
                ? temperatureValues.reduce((sum, value) => sum + value, 0) /
                  temperatureValues.length
                : 0;

        const averageHumidity =
            humidityValues.length > 0
                ? humidityValues.reduce((sum, value) => sum + value, 0) /
                  humidityValues.length
                : 0;

        const alertCount = filteredData.filter((item) => {
            const status = String(
                item.health_status ?? item.health ?? item.alert_status ?? ""
            ).toLowerCase();

            return (
                status === "attention" ||
                status === "critical" ||
                status === "alert" ||
                status === "warning"
            );
        }).length;

        return {
            totalACs,
            activeACs,
            totalEnergy,
            activeEnergy,
            totalPower,
            averageTemperature,
            averageHumidity,
            alertCount,
        };
    }, [filteredData]);

    const insightData = useMemo(() => ({
        totalACs: metrics.totalACs,
        activeACs: metrics.activeACs,
        totalEnergy: Number(metrics.totalEnergy.toFixed(2)),
        activeEnergy: Number(metrics.activeEnergy.toFixed(2)),
        activePower: Number(metrics.totalPower.toFixed(2)),
        averageTemperature: Number(metrics.averageTemperature.toFixed(1)),
        averageHumidity: Number(metrics.averageHumidity.toFixed(1)),
        alerts: metrics.alertCount,
        records: filteredData.length,
        historyPoints: Array.isArray(trendHistory) ? trendHistory.length : 0,
    }), [metrics, filteredData.length, trendHistory]);

    const shortInsight = useMemo(() => ({
        totalACs: `${metrics.totalACs} AC unit${metrics.totalACs === 1 ? " is" : "s are"} included in the current view.`,
        activeACs: `${metrics.activeACs} of ${metrics.totalACs} AC units are currently running.`,
        totalEnergy: `Recorded energy consumption is ${metrics.totalEnergy.toFixed(2)} kWh; compare it with an earlier period to assess whether usage has changed.`,
        activeEnergy: `Running AC units account for ${metrics.activeEnergy.toFixed(2)} kWh in the current readings.`,
        activePower: `Current combined active power is ${metrics.totalPower.toFixed(2)} W. Use the recent power trend to spot sustained changes.`,
        temperature: metrics.averageTemperature > 0
            ? `Average indoor temperature is ${metrics.averageTemperature.toFixed(1)}°C; compare it with your configured comfort target.`
            : "Indoor temperature readings are not available for the current selection.",
        humidity: metrics.averageHumidity > 0
            ? `Average indoor humidity is ${metrics.averageHumidity.toFixed(1)}%; compare it with your configured operating range.`
            : "Indoor humidity readings are not available for the current selection.",
        alerts: metrics.alertCount === 0
            ? "No attention or critical health states were detected in the available records."
            : `${metrics.alertCount} AC record${metrics.alertCount === 1 ? " needs" : "s need"} attention based on the reported health or alert status.`,
        energyChart: trendHistory?.length > 1
            ? `The chart contains ${trendHistory.length} historical points. Compare the latest values with earlier readings to identify consumption changes.`
            : "Not enough historical points are available to determine an energy trend yet.",
        healthChart: `The current selection contains ${metrics.totalACs} AC unit${metrics.totalACs === 1 ? "" : "s"}; health categories depend on the reported device status.`,
        humidityChart: "Use the indoor and outdoor series to compare humidity changes; missing readings should not be treated as zero.",
        powerChart: "The chart shows recent device power readings; investigate sustained peaks rather than isolated fluctuations.",
        zoneChart: "Compare the displayed zones to identify the highest energy consumer; a ranking requires zone-level readings.",
        temperatureChart: "Compare recent indoor temperature readings with the target temperature to assess cooling performance.",
    }), [metrics, trendHistory]);

    const [aiInsights, setAiInsights] = useState({});
    const [isSummaryOpen, setIsSummaryOpen] = useState(false);

    // One GenAI request for the entire dashboard, rather than one request per widget.
    // Implement /api/ai-dashboard-analysis/ in the backend to enable model-generated text.
    useEffect(() => {
        let cancelled = false;
        const token = localStorage.getItem("token");
        // fetch("/api/ai-dashboard-analysis/", {
        fetch("http://localhost:8000/api/ai-dashboard-analysis/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ dashboard_data: insightData }),
        })
            .then((response) => {
                if (!response.ok) throw new Error("AI analysis endpoint unavailable");
                return response.json();
            })
            .then((payload) => {
                if (!cancelled && payload?.insights && typeof payload.insights === "object") {
                    setAiInsights(payload.insights);
                }
            })
            .catch(() => { if (!cancelled) setAiInsights({}); });
        return () => { cancelled = true; };
    }, [insightData]);

    const filterText = useMemo(() => {
        const config = HIERARCHY_CONFIG[filters.hierarchy];

        const order = config?.levels?.map((l) => l.name) ?? [
            "state",
            "district",
            "taluka",
            "city",
            "zone",
            "circle",
            "region",
            "division",
            "branch",
            "floor",
        ];

        const selected = order.map((name) => filters[name]).filter(Boolean);

        return selected.length ? selected.join("  >  ") : "All Locations";
    }, [filters]);

    const handleTrendsClick = () => {
        navigate("/org/dashboard/trends");
    };

    return (
        <div className="ac-dashboard">
            <div className="ac-dashboard-header">
                <div>
                    <h1>AC Energy Monitoring</h1>
                    <p>Real-time AC performance, energy and health monitoring</p>
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
                        <span className="live-dot"></span>
                        <span>LIVE</span>
                    </div>
                </div>
            </div>

            <div className="dashboard-filter-info">
                <span className="filter-label">Current View:</span>

                <span className="filter-value">{filterText}</span>

                <span className="record-count">
                    {filteredData.length} AC{filteredData.length !== 1 ? "s" : ""}
                </span>
            </div>

            {filteredData.length > 0 && (
                <section className={`ai-dashboard-summary ${isSummaryOpen ? "is-open" : ""}`} aria-label="AI dashboard summary">
                    <div className="ai-dashboard-summary-header">
                        <div className="ai-dashboard-summary-heading">
                            <span className="ai-dashboard-summary-icon" aria-hidden="true">✦</span>
                            <div>
                                <h2>AI Dashboard Summary</h2>
                                <p>Key findings from the current dashboard data</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="ai-dashboard-summary-toggle"
                            onClick={() => setIsSummaryOpen((open) => !open)}
                            aria-expanded={isSummaryOpen}
                        >
                            {isSummaryOpen ? "Hide analysis" : "View analysis"}
                            <span aria-hidden="true">{isSummaryOpen ? "−" : "+"}</span>
                        </button>
                    </div>
                    {isSummaryOpen && (
                        <div className="ai-dashboard-summary-content">
                            <p><strong>Energy:</strong> {aiInsights.totalEnergy || shortInsight.totalEnergy} {aiInsights.activeEnergy || shortInsight.activeEnergy}</p>
                            <p><strong>AC operation:</strong> {aiInsights.totalACs || shortInsight.totalACs} {aiInsights.activeACs || shortInsight.activeACs}</p>
                            <p><strong>Power:</strong> {aiInsights.activePower || shortInsight.activePower} {aiInsights.powerChart || shortInsight.powerChart}</p>
                            <p><strong>Environment:</strong> {aiInsights.temperature || shortInsight.temperature} {aiInsights.humidity || shortInsight.humidity}</p>
                            <p><strong>Health & alerts:</strong> {aiInsights.healthChart || shortInsight.healthChart} {aiInsights.alerts || shortInsight.alerts}</p>
                            <p><strong>Charts & zones:</strong> {aiInsights.energyChart || shortInsight.energyChart} {aiInsights.zoneChart || shortInsight.zoneChart}</p>
                        </div>
                    )}
                </section>
            )}

            {filteredData.length === 0 ? (
                <div className="dashboard-no-data">
                    <div className="no-data-icon">📊</div>
                    <h2>No AC data available</h2>
                    <p>There is no data for the selected filters.</p>
                </div>
            ) : (
                <>
                    <section className="dashboard-section">
                        <div className="section-title">
                            <h2>Overview</h2>
                        </div>

                        <div className="kpi-grid">
                            <Total_Acs value={metrics.totalACs} />
                            <Active_Acs value={metrics.activeACs} />
                            <Total_Energy value={metrics.totalEnergy} />
                            <Active_Energy value={metrics.activeEnergy} />
                            <Active_Power value={metrics.totalPower} />
                            <Average_Temperature value={metrics.averageTemperature} />
                            <Average_Humidity value={metrics.averageHumidity} />
                            <Alerts data={safeData} active={cardFilters?.alerts?.active === true} onClick={() => onCardFilterChange?.({ alerts: { active: !cardFilters?.alerts?.active } })} />
                        </div>
                    </section>

                    <section className="dashboard-grid">
                        <EnergyConsumptionChart data={trendHistory} />
                        {/* <Active_Power value={metrics.totalPower} /> */}
                        <CurrentFluctuationChart value={metrics.totalPower} />
                        
                        <ACHealthChart data={deviceData} />
                    </section>

                    <section className="dashboard-grid">
                        <HumidityChart data={trendHistory} />
                        <PowerConsumptionChart data={deviceData} />
                        <ZoneEnergyChart data={deviceData} filters={filters} />
                    </section>

                    <section className="dashboard-grid">
                        <EnergyMap data={deviceData} filters={filters} />
                        <ACTable data={filteredData} />
                        <TemperatureChart data={trendHistory} />
                    </section>

                    {/* <section className="dashboard-full-width">
                        <ACTable data={filteredData} />
                    </section> */}
                </>
            )}
        </div>
    );
}

export default ACDashboard;