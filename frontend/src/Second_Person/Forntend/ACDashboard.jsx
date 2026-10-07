
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRollingAverage } from "./hooks/useRollingAverage";

import Total_Acs from "./KPI Cards/Total_Acs";
import Active_Acs from "./KPI Cards/Active Acs";
import Total_Energy from "./KPI Cards/Total_Energy";
import Active_Energy from "./KPI Cards/Active_Energy";
import Active_Power from "./KPI Cards/Active_Power";
// import Active_Po from "./KPI Cards/Active_Power";
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

    const analyzeDashboard = () => {
        const payload = {
            dashboard_name: "AC Energy Monitoring",
            generated_at: new Date().toISOString(),
            filters,
            kpis: {
                total_ac: metrics.totalACs,
                active_ac: metrics.activeACs,
                total_energy_kwh: metrics.totalEnergy,
                active_energy_kwh: metrics.activeEnergy,
                total_power_w: metrics.totalPower,
                average_temperature_c: metrics.averageTemperature,
                average_humidity_percent: metrics.averageHumidity,
                alert_count: metrics.alertCount,
            },
            trends: trendHistory,
            ac_data: filteredData,
            additional_data: {
                device_data: deviceData,
            },
        };

        navigate("/org/dashboard/ai-analysis", { state: { payload } });
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
                        onClick={analyzeDashboard}
                    >
                        Analyze Dashboard
                    </button>
                    
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
                            <Alerts
                                data={safeData}
                                active={cardFilters?.alerts?.active === true}
                                onClick={() =>
                                    onCardFilterChange?.({
                                        alerts: {
                                            active: !cardFilters?.alerts?.active,
                                        },
                                    })
                                }
                            />
                        </div>
                    </section>

                    <section className="dashboard-grid">
                        <EnergyConsumptionChart data={trendHistory} />
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