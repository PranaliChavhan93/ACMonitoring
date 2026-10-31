// // import React, { useEffect, useMemo, useState } from "react";
// // import { useNavigate } from "react-router-dom";
// // import { useRollingAverage } from "./hooks/useRollingAverage";

// // import Total_Acs from "./KPI Cards/Total_Acs";
// // import Active_Acs from "./KPI Cards/Active Acs";
// // import Total_Energy from "./KPI Cards/Total_Energy";
// // import Active_Energy from "./KPI Cards/Active_Energy";
// // import Active_Power from "./KPI Cards/Active_Power";
// // import Average_Temperature from "./KPI Cards/Average_Temperature";
// // import Average_Humidity from "./KPI Cards/Average_Humidity";
// // import Alerts from "./KPI Cards/Alerts";

// // import TemperatureChart from "./TemperatureChart/TemperatureChart";
// // import HumidityChart from "./HumidityChart/HumidityChart";
// // import PowerConsumptionChart from "./PowerConsumptionChart/PowerConsumptionChart";
// // import EnergyConsumptionChart from "./EnergyConsumptionChart/EnergyConsumptionChart";
// // import ZoneEnergyChart from "./ZoneEnergyChart/ZoneEnergyChart";
// // import ACHealthChart from "./ACHealthChart/ACHealthChart";
// // import CurrentFluctuationChart from "./CurrentFluctuationChart";
// // import ACTable from "./ACTable/ACTable";
// // import ACDeviceTable from "./ACDeviceTable";
// // import EnergyMap from "./EnergyMap/EnergyMap";
// // import EnergyCostCard from "./KPI Cards/EnergyCostCard";

// // import AIAssistantPanel from "./AIAssistantPanel";
// // import FaultDetectionPanel from "./FaultDetectionPanel"

// // import "./dashboard.css";
// // import "./dashboard-insight.css";
// // import CurrentHistoryChart from "./Current/CurrentHistoryChart";
// // import VoltageHistoryChart from "./Voltage/VoltageHistoryChart";
// // import ACPowerStateChart from "./CurrentOnOff/ACPowerStateChart";
// // import CurrentTemperatureChart from "./Current/CurrentTemp";

// // const numberValue = (value) => {
// //     if (value === null || value === undefined || value === "") {
// //         return 0;
// //     }

// //     const number = Number(value);
// //     return Number.isFinite(number) ? number : 0;
// // };

// // const getVoltage = (item) => numberValue(item?.voltage ?? item?.Voltage);

// // // An AC that is OFF / OFFLINE draws nothing: the backend keeps its last known
// // // readings for display, so force current and power to 0 unless it is running.
// // const isRunning = (item) => ["active", "running", "on", "1"].includes(
// //     String(item?.status ?? item?.ac_status ?? item?.state ?? "").trim().toLowerCase()
// // );

// // const getCurrent = (item) => (isRunning(item) ? numberValue(item?.current ?? item?.Current) : 0);

// // const getPower = (item) => {
// //     if (!isRunning(item)) return 0;

// //     const value =
// //         item?.active_power ??
// //         item?.Active_Power ??
// //         item?.activePower ??
// //         item?.power ??
// //         item?.Power;

// //     if (value !== undefined && value !== null && value !== "") {
// //         return numberValue(value);
// //     }

// //     return getVoltage(item) * getCurrent(item);
// // };

// // const getEnergy = (item) =>
// //     numberValue(
// //         item?.energy_consumption ??
// //         item?.Energy_Consumption ??
// //         item?.energyConsumption ??
// //         item?.energy ??
// //         item?.kwh ??
// //         item?.kWh
// //     );

// // const getTemperature = (item) =>
// //     numberValue(
// //         item?.indoor_temperature ??
// //         item?.indoor_temp ??
// //         item?.temperature ??
// //         item?.temp
// //     );

// // const getHumidity = (item) => numberValue(item?.indoor_humidity ?? item?.humidity);

// // const getStatus = (item) =>
// //     String(item?.status ?? item?.ac_status ?? item?.state ?? "")
// //         .trim()
// //         .toLowerCase();

// // const isActive = (item) => ["active", "running", "on", "1"].includes(getStatus(item));

// // const getHealthStatus = (item) =>
// //     String(
// //         item?.health_status ??
// //         item?.health ??
// //         item?.alert_status ??
// //         ""
// //     )
// //         .trim()
// //         .toLowerCase();

// // const isAlert = (item) =>
// //     Number(item?.alarm_status) === 1 ||
// //     ["attention", "critical", "alert", "warning"].includes(
// //         getHealthStatus(item)
// //     );

// // function ACDashboard({
// //     data = [],
// //     filters = {},
// //     cardFilters = {},
// //     visibleWidgets = {},
// //     onCardFilterChange,
// // }) {
// //     const navigate = useNavigate();
// //     const [showAIModule, setShowAIModule] = useState(false);
// //     const [branchWeather, setBranchWeather] = useState([]);
// //     const [historicalClimate, setHistoricalClimate] = useState([]);
// //     const [climateHistoryStatus, setClimateHistoryStatus] = useState("idle");
// //     const [weatherStatus, setWeatherStatus] = useState("idle");
// //     const [weatherError, setWeatherError] = useState("");

// //     const [currentHistoryData, setCurrentHistoryData] = useState([]);
// //     const [currentHistoryStatus, setCurrentHistoryStatus] = useState("idle");

// //     // const isFloorScope = Boolean(selectedFloor);
// //     const isFloorScope = Boolean(filters?.floor);
// //     const safeData = useMemo(() => {
// //         if (Array.isArray(data)) return data;
// //         if (Array.isArray(data?.data)) return data.data;
// //         return [];
// //     }, [data]);

// //     // Apply card-level filters without mutating the source data.
// //     const filteredData = useMemo(() => {
// //         let result = safeData;

// //         if (cardFilters?.alerts?.active === true) {
// //             result = result.filter(isAlert);
// //         }

// //         if (cardFilters?.status?.value) {
// //             const wanted = String(cardFilters.status.value)
// //                 .trim()
// //                 .toLowerCase();

// //             result = result.filter(
// //                 (item) => getStatus(item) === wanted
// //             );
// //         }
// //         return result;
// //     }, [safeData, cardFilters]);

// //     // Preserve the existing rolling-average behavior.
// //     const { deviceData, trendHistory } = useRollingAverage(
// //         filteredData,
// //         {
// //             windowMs: 60000,
// //             recalcMs: 30000,
// //             historyLimit: 60,
// //         }
// //     );

// //     const metrics = useMemo(() => {
// //         const totalACs = filteredData.length;
// //         const activeRecords = filteredData.filter(isActive);
// //         const totalEnergy = filteredData.reduce( (sum, item) => sum + getEnergy(item) / 1000, 0 );
// //         const activeEnergy = activeRecords.reduce( (sum, item) => sum + getEnergy(item) / 1000, 0 );
// //         const totalPower = filteredData.reduce( (sum, item) => sum + getPower(item), 0 );
// //         const temperatures = filteredData
// //             .map(getTemperature)
// //             .filter((value) => value !== 0);

// //         const humidities = filteredData
// //             .map(getHumidity)
// //             .filter((value) => value !== 0);

// //         const averageTemperature = temperatures.length
// //             ? temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length
// //             : 0 ;

// //         const averageHumidity = humidities.length
// //             ? humidities.reduce((sum, value) => sum + value, 0) / humidities.length
// //             : 0 ;

// //         const alertCount = filteredData.filter(isAlert).length;

// //         return {
// //             totalACs,
// //             activeACs: activeRecords.length,
// //             totalEnergy,
// //             activeEnergy,
// //             totalPower,
// //             averageTemperature,
// //             averageHumidity,
// //             alertCount,
// //         };
// //     }, [filteredData]);

// //     const insightData = useMemo(
// //             () => ({
// //             totalACs: metrics.totalACs,
// //             activeACs: metrics.activeACs,
// //             totalEnergy: Number(metrics.totalEnergy.toFixed(2)),
// //             activeEnergy: Number(metrics.activeEnergy.toFixed(2)),
// //             activePower: Number(metrics.totalPower.toFixed(2)),
// //             averageTemperature: Number(
// //                 metrics.averageTemperature.toFixed(1)
// //             ),
// //             averageHumidity: Number(
// //                 metrics.averageHumidity.toFixed(1)
// //             ),
// //             alerts: metrics.alertCount,
// //             records: filteredData.length,
// //             historyPoints: Array.isArray(trendHistory)
// //                 ? trendHistory.length
// //                 : 0,
// //             }),
// //             [metrics, filteredData.length, trendHistory]
// //     );

// //     const dashboardPayload = useMemo(() => {
// //         const acHealth = filteredData.map((item) => ({
// //             ac_id:
// //                 item?.ac_id ??
// //                 item?.device_name ??
// //                 item?.device_id ??
// //                 item?.id ??
// //                 "Unknown",
// //             status:
// //                 item?.status ??
// //                 item?.ac_status ??
// //                 item?.state ??
// //                 "unknown",
// //             health_status:
// //                 item?.health_status ??
// //                 item?.health ??
// //                 item?.alert_status ??
// //                 "unknown",
// //             alarm_status: item?.alarm_status ?? null,
// //         }));

// //         return {
// //             dashboard_name: "AC Energy Monitoring",
// //             generated_at: new Date().toISOString(),
// //             filters,
// //             kpis: insightData,
// //             trends: Array.isArray(trendHistory)
// //                 ? trendHistory
// //                 : [],
// //             ac_data: filteredData,
// //             ac_health: acHealth,
// //             alerts: filteredData.filter(isAlert),
// //             additional_data: {
// //                 device_data: Array.isArray(deviceData)
// //                 ? deviceData
// //                 : [],
// //             },
// //         };
// //     }, [
// //         filters,
// //         insightData,
// //         trendHistory,
// //         filteredData,
// //         deviceData,
// //     ]);

// //     const handleTrendsClick = () => {
// //         navigate("/org/dashboard/trends");
// //     };

// //     const hierarchyLevels =
// //         filters?.hierarchy === "ZONAL"
// //             ? ["zone", "circle", "region", "division", "branch", "device"]
// //             : ["state", "district", "taluka", "city", "branch", "device"];

// //     const selectedLevel =
// //         [...hierarchyLevels]
// //             .reverse()
// //             .find((key) => Boolean(filters?.[key])) || "country";

// //     const isBranchScope = selectedLevel === "branch";
// //     const isDeviceScope = selectedLevel === "device";

// //     const selectedDeviceId = String(
// //         filters?.selectedDeviceId ||
// //         filters?.device_id ||
// //         (typeof filters?.device === "string"
// //             ? filters.device
// //             : filters?.device?.value || "")
// //     ).trim();

// //     const filtersKey = JSON.stringify(filters || {});

// //     const isSingleDeviceScope =
// //         isDeviceScope || Boolean(filters?.ac_id || selectedDeviceId);

// //     const selectedState = filters?.state || "";

// //     const showWidget = (key) => visibleWidgets?.[key] !== false;


// //     useEffect(() => {
// //         if (selectedLevel !== "branch" && selectedLevel !== "device") {
// //             setCurrentHistoryData([]);
// //             setCurrentHistoryStatus("idle");
// //         return undefined;
// //     }

// //     const controller = new AbortController();

// //     const loadCurrentHistory = async () => {
// //         try {
// //         const end = new Date();
// //         const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

// //         const params = new URLSearchParams({
// //             period: "today",
// //             from: start.toISOString(),
// //             to: end.toISOString(),
// //         });

// //         const deviceId = selectedDeviceId || filters?.ac_id || "";
// //         if (deviceId) params.set("ac_id", String(deviceId));

// //         const token = [
// //             "token",
// //             "authToken",
// //             "access_token",
// //             "accessToken",
// //         ]
// //             .map((key) => localStorage.getItem(key))
// //             .find(Boolean);

// //         const response = await fetch(
// //             `http://localhost:8000/api/current-history/?${params}`,
// //             {
// //             signal: controller.signal,
// //             headers: token
// //                 ? { Authorization: `Bearer ${token}` }
// //                 : {},
// //             }
// //         );

// //         if (!response.ok) {
// //             throw new Error(`Current history API: HTTP ${response.status}`);
// //         }

// //         const payload = await response.json();
// //         setCurrentHistoryData(
// //             Array.isArray(payload?.data) ? payload.data : []
// //         );
// //         setCurrentHistoryStatus("loaded");
// //         } catch (error) {
// //         if (error.name === "AbortError") return;

// //         console.error("Current history failed:", error);
// //         setCurrentHistoryStatus("error");
// //         }
// //     };

// //     loadCurrentHistory();

// //     const intervalId = window.setInterval(loadCurrentHistory, 10000);

// //     return () => {
// //         controller.abort();
// //         window.clearInterval(intervalId);
// //     };
// //     }, [selectedLevel, selectedDeviceId, filtersKey]);

// //     useEffect(() => {
// //         if (selectedLevel !== "branch" && selectedLevel !== "device") {
// //             setHistoricalClimate([]);
// //             setClimateHistoryStatus("idle");
// //             return undefined;
// //         }

// //         const controller = new AbortController();
// //         const loadClimateHistory = async () => {
// //         // Only show "loading" the first time; 10 s refreshes update in place.
// //         setClimateHistoryStatus((prev) => (prev === "loaded" || prev === "empty" ? prev : "loading"));
// //         try {
// //             const end = new Date();
// //             const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
// //             const params = new URLSearchParams({
// //                 from: start.toISOString(),
// //                 to: end.toISOString(),
// //                 interval_seconds: "300", // 5-minute buckets keep a 24 h, multi-AC response small
// //             });

// //             // Preserve the dashboard's active hierarchy scope.
// //             ["state", "district", "taluka", "city", "zone", "circle", "region", "division", "branch", "floor"].forEach((key) => {
// //                 if (filters?.[key] != null && String(filters[key]).trim()) {
// //                     params.set(key, String(filters[key]));
// //                 }
// //             });
// //             const deviceId = selectedDeviceId || filters?.ac_id || "";
// //             if (deviceId) params.set("device_id", String(deviceId));

// //             const token = ["token", "authToken", "access_token", "accessToken"]
// //                 .map((key) => localStorage.getItem(key))
// //                 .find(Boolean);
// //             const response = await fetch(
// //                 `http://localhost:8000/api/telemetry-aggregates/?${params.toString()}`,
// //                 {
// //                     signal: controller.signal,
// //                     headers: token ? { Authorization: `Bearer ${token}` } : {},
// //                 }
// //             );
// //             if (!response.ok) {
// //                 throw new Error(`Historical telemetry API returned HTTP ${response.status}`);
// //             }
// //             const payload = await response.json();
// //             const rows = Array.isArray(payload?.data) ? payload.data : [];
// //             setHistoricalClimate(rows.map((row) => ({
// //                 timestamp: row.bucket_start,
// //                 indoor_temperature: row.avg_temperature,
// //                 indoor_humidity: row.avg_humidity,
// //                 device_id: row.device_id,
// //             })));
// //             setClimateHistoryStatus(rows.length ? "loaded" : "empty");
// //         } catch (error) {
// //             if (error.name === "AbortError") return;
// //             console.error("[Climate history] Failed to load:", error);
// //             setHistoricalClimate([]);
// //             setClimateHistoryStatus("error");
// //         }
// //     };
// //     loadClimateHistory();
// //     const intervalId = window.setInterval(loadClimateHistory, 10 * 1000); // refresh historical telemetry every 10 seconds
// //     return () => {
// //         controller.abort();
// //         window.clearInterval(intervalId);
// //     };
// //     }, [selectedLevel, selectedDeviceId, filtersKey]);

// //     const branchCoordinates = useMemo(() => {
// //         const candidates = [...safeData, ...filteredData];
// //         const record = candidates.find((item) => {
// //             const lat = Number(item?.latitude ?? item?.lat);
// //             const lon = Number(item?.longitude ?? item?.lon);
// //             return item?.latitude != null && item?.longitude != null &&
// //                 item?.latitude !== "" && item?.longitude !== "" &&
// //                 Number.isFinite(lat) && Number.isFinite(lon) &&
// //                 lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
// //         });
// //         if (!record) return null;
// //         return {
// //             latitude: Number(record.latitude ?? record.lat),
// //             longitude: Number(record.longitude ?? record.lon),
// //         };
// //     }, [safeData, filteredData]);

// //     useEffect(() => {
// //         const shouldFetchWeather = selectedLevel === "branch" && Boolean(filters?.branch);
// //         if (!shouldFetchWeather) {
// //             setBranchWeather([]);
// //             setWeatherStatus("idle");
// //             setWeatherError("");
// //             return undefined;
// //         }

// //         if (!branchCoordinates) {
// //             setBranchWeather([]);
// //             setWeatherStatus("missing-coordinates");
// //             setWeatherError("This branch has no saved latitude/longitude. Add coordinates to the branch record first.");
// //             return undefined;
// //         }

// //         const controller = new AbortController();
// //         const loadWeather = async () => {
// //             setWeatherStatus("loading");
// //             setWeatherError("");
// //             try {
// //                 const params = new URLSearchParams({
// //                     latitude: String(branchCoordinates.latitude),
// //                     longitude: String(branchCoordinates.longitude),
// //                     hourly: "temperature_2m,relative_humidity_2m",
// //                     past_days: "1",
// //                     forecast_days: "1",
// //                     timezone: "auto",
// //                 });
// //                 const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
// //                     signal: controller.signal,
// //                 });
// //                 if (!response.ok) throw new Error(`Weather service returned HTTP ${response.status}.`);
// //                 const payload = await response.json();
// //                 const times = payload?.hourly?.time || [];
// //                 const temperatures = payload?.hourly?.temperature_2m || [];
// //                 const humidities = payload?.hourly?.relative_humidity_2m || [];
// //                 const points = times.map((timestamp, index) => ({
// //                     timestamp,
// //                     temperature: temperatures[index] == null ? null : Number(temperatures[index]),
// //                     humidity: humidities[index] == null ? null : Number(humidities[index]),
// //                 })).filter((point) => point.temperature !== null || point.humidity !== null);
// //                 setBranchWeather(points);
// //                 setWeatherStatus(points.length ? "loaded" : "empty");
// //                 if (!points.length) setWeatherError("The weather service returned no hourly readings for these coordinates.");
// //             } catch (error) {
// //                 if (error.name === "AbortError") return;
// //                 setBranchWeather([]);
// //                 setWeatherStatus("error");
// //                 setWeatherError(error.message || "Unable to load local weather data.");
// //             }
// //         };
// //         loadWeather();
// //         return () => controller.abort();
// //     }, [
// //         selectedLevel,
// //         filters?.branch,
// //         branchCoordinates?.latitude,
// //         branchCoordinates?.longitude,
// //     ]);

// //     return (
// //         <div className="ac-dashboard">
// //             <br />
// //             {filteredData.length === 0 ? (
// //                 <div className="dashboard-no-data">
// //                     <div className="no-data-icon">📊</div>
// //                     <h2>No AC data available</h2>
// //                     <p>There is no data for the selected filters.</p>
// //                 </div>
// //             ) : (
// //                 <>
// //                 <section className="ai-module-toggle-section">
// //                     <button
// //                         type="button"
// //                         className="trends-button ai-module-toggle-button"
// //                         onClick={() => setShowAIModule((previous) => !previous)}
// //                         aria-expanded={showAIModule}
// //                         aria-controls="ai-module-panel"
// //                     >
// //                         {showAIModule ? "Hide AI Module ▲" : "Show AI Module"}
// //                     </button>

// //                     {showAIModule && (
// //                         <div id="ai-module-panel" className="ai-module-panel">
// //                             <AIAssistantPanel dashboardData={dashboardPayload} />
// //                         </div>
// //                     )}
// //                 </section>

// //                 <br />

// //                 {/* {selectedLevel === "branch" && (
// //                     <section className="dashboard-section">
// //                         <FaultDetectionPanel
// //                             data={filteredData}
// //                             refreshMs={2000}
// //                         />
// //                     </section>
// //                 )} */}

// //                 <br />

// //                 <section className="dashboard-section">
// //                     <div className="section-title dashboard-scope-heading">
// //                         <div>
// //                             <h2>{isSingleDeviceScope ? "AC Performance" : isFloorScope ? "Floor Overview" : isBranchScope ? "Branch Overview" : selectedLevel === "city" ? "City Overview" : selectedLevel === "country" ? "Organization Overview" : "Regional Overview"}</h2>
// //                             <p>{Object.entries(filters || {}).filter(([key, value]) => key !== "hierarchy" && value).map(([, value]) => value).join(" · ") || "All Locations"}</p>
// //                         </div>
// //                         <button type="button" className="trends-button" onClick={handleTrendsClick}>View Trends</button>
// //                     </div>
// //                     <div className="kpi-grid">
// //                         {showWidget("total_acs") && <Total_Acs value={metrics.totalACs} />}
// //                         <Active_Acs value={metrics.activeACs} />
// //                         {showWidget("total_energy") && <Total_Energy value={metrics.totalEnergy} />}
// //                         {showWidget("active_energy") && <Active_Energy value={metrics.activeEnergy} />}
// //                         {selectedLevel === "branch" && showWidget("active_power") && (
// //                             <Active_Power value={metrics.totalPower} />
// //                         )}

// //                         {selectedLevel === "branch" && showWidget("temperature") && (
// //                             <Average_Temperature value={metrics.averageTemperature} />
// //                         )}

// //                         {selectedLevel === "branch" && showWidget("humidity") && (
// //                             <Average_Humidity value={metrics.averageHumidity} />
// //                         )}

// //                         {showWidget("alerts") && 
// //                             <Alerts data={safeData} active={cardFilters?.alerts?.active === true} onClick={() => onCardFilterChange?.({ alerts: { active: !cardFilters?.alerts?.active } })} />
// //                         }
// //                         {selectedState && showWidget("cost_card") && 
// //                             <EnergyCostCard stateName={selectedState} energyKwh={metrics.totalEnergy} />
// //                         }
// //                         </div>
// //                 </section>

// //                 <section className="dashboard-grid dashboard-grid--primary">
// //                     {isBranchScope ? (
// //                         showWidget("power_chart") && (
// //                             <EnergyConsumptionChart data={deviceData} />
// //                         )
// //                     ) : (
// //                         showWidget("power_chart") && (
// //                             // <CurrentFluctuationChart
// //                             //     value={metrics.totalPower}
// //                             //     deviceId={selectedDeviceId}
// //                             //     scope={filters}
// //                             // />
// //                             <PowerConsumptionChart data={deviceData} />

// //                         )
// //                     )}

// //                     <ACHealthChart data={deviceData} />
// //                     {/* <PowerConsumptionChart data={deviceData}/> */}                    
                    
// //                     {selectedLevel === "branch" && showWidget("health_chart") && (
// //                         <>
// //                             {/* <PowerConsumptionChart data={deviceData} /> */}
                            
// //                             <CurrentTemperatureChart
// //                                 currentData={currentHistoryData}
// //                                 indoorData={
// //                                     historicalClimate.length
// //                                     ? historicalClimate
// //                                     : trendHistory
// //                                 }
// //                                 loading={
// //                                     currentHistoryStatus === "idle" ||
// //                                     currentHistoryStatus === "loading"
// //                                 }
// //                             />
// //                             {/* <ACHealthChart data={deviceData} /> */}
// //                             <CurrentHistoryChart
// //                                 deviceId={selectedDeviceId}
// //                                 scope={filters}
// //                             />
// //                             <VoltageHistoryChart
// //                                 deviceId={selectedDeviceId}
// //                                 scope={filters}
// //                             />
// //                             {/* <TemperatureChart data={branchWeather} indoorData={historicalClimate.length ? historicalClimate : trendHistory} locationName={filters?.branch} status={climateHistoryStatus === "loading" ? "loading" : weatherStatus} error={climateHistoryStatus === "error" ? "Unable to load historical device telemetry. Check API URL/token." : weatherError} /> 
// //                             <HumidityChart data={branchWeather} indoorData={historicalClimate.length ? historicalClimate : trendHistory} locationName={filters?.branch} status={climateHistoryStatus === "loading" ? "loading" : weatherStatus} error={climateHistoryStatus === "error" ? "Unable to load historical device telemetry. Check API URL/token." : weatherError} /> */}
                            
// //                             <TemperatureChart
// //                                 deviceId={selectedDeviceId || filters?.ac_id || ""}
// //                                 scope={filters}
// //                             />

// //                             <HumidityChart
// //                                 deviceId={selectedDeviceId || filters?.ac_id || ""}
// //                                 scope={filters}
// //                             />
                            
// //                             <ACPowerStateChart 
// //                                 data={filteredData}
// //                                 deviceId={selectedDeviceId || filters?.ac_id || ""}
// //                                 scope={filters}
// //                             />
// //                         </>
// //                     )}
// //                     {showWidget("energy_chart") && 
// //                         <ZoneEnergyChart deviceId={selectedDeviceId} scope={filters} />
// //                     }
// //                     <ACDeviceTable data={filteredData} />
// //                         <div className="chart-box dashboard-context-card">
// //                             <div className="chart-header"><div><h3>{isSingleDeviceScope ? "Selected AC Details" : "Branch Device Summary"}</h3><span>Current filter scope</span></div></div>
// //                             <div className="dashboard-context-stats">
// //                                 <div><span>Installed ACs</span><strong>{metrics.totalACs}</strong></div>
// //                                 <div><span>Running</span><strong>{metrics.activeACs}</strong></div>
// //                                 <div><span>Avg. temperature</span><strong>{metrics.averageTemperature.toFixed(1)}°C</strong></div>
// //                                 <div><span>Avg. humidity</span><strong>{metrics.averageHumidity.toFixed(1)}%</strong></div>
// //                             </div>
// //                             {isSingleDeviceScope && <p className="dashboard-context-note">One telemetry record is currently in scope. Confirm its device ID and timestamp before treating it as a live individual-device view.</p>}
// //                         </div>
// //                 </section>
// //                 </>
// //             )}
// //         </div>
// //     );
// // }

// // export default ACDashboard;


// import React, { useEffect, useMemo, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { useRollingAverage } from "./hooks/useRollingAverage";

// import Total_Acs from "./KPI Cards/Total_Acs";
// import Active_Acs from "./KPI Cards/Active Acs";
// import Total_Energy from "./KPI Cards/Total_Energy";
// import Active_Energy from "./KPI Cards/Active_Energy";
// import Active_Power from "./KPI Cards/Active_Power";
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
// import ACDeviceTable from "./ACDeviceTable";
// import EnergyMap from "./EnergyMap/EnergyMap";
// import EnergyCostCard from "./KPI Cards/EnergyCostCard";

// import AIAssistantPanel from "./AIAssistantPanel";
// import FaultDetectionPanel from "./FaultDetectionPanel"

// import "./dashboard.css";
// import "./dashboard-insight.css";
// import CurrentHistoryChart from "./Current/CurrentHistoryChart";
// import VoltageHistoryChart from "./Voltage/VoltageHistoryChart";
// import Inactive_Acs from "./KPI Cards/InactiveAcs";

// const numberValue = (value) => {
//     if (value === null || value === undefined || value === "") {
//         return 0;
//     }

//     const number = Number(value);
//     return Number.isFinite(number) ? number : 0;
// };

// const getVoltage = (item) => numberValue(item?.voltage ?? item?.Voltage);

// // An AC that is OFF / OFFLINE draws nothing: the backend keeps its last known
// // readings for display, so force current and power to 0 unless it is running.
// const isRunning = (item) => ["active", "running", "on", "1"].includes(
//     String(item?.status ?? item?.ac_status ?? item?.state ?? "").trim().toLowerCase()
// );

// const getCurrent = (item) => (isRunning(item) ? numberValue(item?.current ?? item?.Current) : 0);

// const getPower = (item) => {
//     if (!isRunning(item)) return 0;

//     const value =
//         item?.active_power ??
//         item?.Active_Power ??
//         item?.activePower ??
//         item?.power ??
//         item?.Power;

//     if (value !== undefined && value !== null && value !== "") {
//         return numberValue(value);
//     }

//     return getVoltage(item) * getCurrent(item);
// };

// const getEnergy = (item) =>
//     numberValue(
//         item?.energy_consumption ??
//         item?.Energy_Consumption ??
//         item?.energyConsumption ??
//         item?.energy ??
//         item?.kwh ??
//         item?.kWh
//     );

// const getTemperature = (item) =>
//     numberValue(
//         item?.indoor_temperature ??
//         item?.indoor_temp ??
//         item?.temperature ??
//         item?.temp
//     );

// const getHumidity = (item) => numberValue(item?.indoor_humidity ?? item?.humidity);

// const getStatus = (item) =>
//     String(item?.status ?? item?.ac_status ?? item?.state ?? "")
//         .trim()
//         .toLowerCase();

// const isActive = (item) => ["active", "running", "on", "1"].includes(getStatus(item));

// const getHealthStatus = (item) =>
//     String(
//         item?.health_status ??
//         item?.health ??
//         item?.alert_status ??
//         ""
//     )
//         .trim()
//         .toLowerCase();

// const isAlert = (item) =>
//     Number(item?.alarm_status) === 1 ||
//     ["attention", "critical", "alert", "warning"].includes(
//         getHealthStatus(item)
//     );

// function ACDashboard({
//     data = [],
//     filters = {},
//     cardFilters = {},
//     visibleWidgets = {},
//     onCardFilterChange,
// }) {
//     const navigate = useNavigate();
//     const [showAIModule, setShowAIModule] = useState(false);
//     const [branchWeather, setBranchWeather] = useState([]);
//     const [historicalClimate, setHistoricalClimate] = useState([]);
//     const [climateHistoryStatus, setClimateHistoryStatus] = useState("idle");
//     const [weatherStatus, setWeatherStatus] = useState("idle");
//     const [weatherError, setWeatherError] = useState("");

//     const [currentHistoryData, setCurrentHistoryData] = useState([]);
//     const [currentHistoryStatus, setCurrentHistoryStatus] = useState("idle");

//     // const isFloorScope = Boolean(selectedFloor);
//     const isFloorScope = Boolean(filters?.floor);
//     const safeData = useMemo(() => {
//         if (Array.isArray(data)) return data;
//         if (Array.isArray(data?.data)) return data.data;
//         return [];
//     }, [data]);

//     // Apply card-level filters without mutating the source data.
//     const filteredData = useMemo(() => {
//         let result = safeData;

//         if (cardFilters?.alerts?.active === true) {
//             result = result.filter(isAlert);
//         }

//         if (cardFilters?.status?.value) {
//             const wanted = String(cardFilters.status.value)
//                 .trim()
//                 .toLowerCase();

//             result = result.filter(
//                 (item) => getStatus(item) === wanted
//             );
//         }
//         return result;
//     }, [safeData, cardFilters]);

//     // Preserve the existing rolling-average behavior.
//     const { deviceData, trendHistory } = useRollingAverage(
//         filteredData,
//         {
//             windowMs: 60000,
//             recalcMs: 30000,
//             historyLimit: 60,
//         }
//     );

//     const metrics = useMemo(() => {
//         const totalACs = filteredData.length;
//         const activeRecords = filteredData.filter(isActive);
//         const totalEnergy = filteredData.reduce( (sum, item) => sum + getEnergy(item) / 1000, 0 );
//         const activeEnergy = activeRecords.reduce( (sum, item) => sum + getEnergy(item) / 1000, 0 );
//         const totalPower = filteredData.reduce( (sum, item) => sum + getPower(item), 0 );
//         const temperatures = filteredData
//             .map(getTemperature)
//             .filter((value) => value !== 0);

//         const humidities = filteredData
//             .map(getHumidity)
//             .filter((value) => value !== 0);

//         const averageTemperature = temperatures.length
//             ? temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length
//             : 0 ;

//         const averageHumidity = humidities.length
//             ? humidities.reduce((sum, value) => sum + value, 0) / humidities.length
//             : 0 ;

//         const alertCount = filteredData.filter(isAlert).length;

//         return {
//             totalACs,
//             activeACs: activeRecords.length,
//             totalEnergy,
//             activeEnergy,
//             totalPower,
//             averageTemperature,
//             averageHumidity,
//             alertCount,
//         };
//     }, [filteredData]);

//     const insightData = useMemo(
//             () => ({
//             totalACs: metrics.totalACs,
//             activeACs: metrics.activeACs,
//             totalEnergy: Number(metrics.totalEnergy.toFixed(2)),
//             activeEnergy: Number(metrics.activeEnergy.toFixed(2)),
//             activePower: Number(metrics.totalPower.toFixed(2)),
//             averageTemperature: Number(
//                 metrics.averageTemperature.toFixed(1)
//             ),
//             averageHumidity: Number(
//                 metrics.averageHumidity.toFixed(1)
//             ),
//             alerts: metrics.alertCount,
//             records: filteredData.length,
//             historyPoints: Array.isArray(trendHistory)
//                 ? trendHistory.length
//                 : 0,
//             }),
//             [metrics, filteredData.length, trendHistory]
//     );

//     const dashboardPayload = useMemo(() => {
//         const acHealth = filteredData.map((item) => ({
//             ac_id:
//                 item?.ac_id ??
//                 item?.device_name ??
//                 item?.device_id ??
//                 item?.id ??
//                 "Unknown",
//             status:
//                 item?.status ??
//                 item?.ac_status ??
//                 item?.state ??
//                 "unknown",
//             health_status:
//                 item?.health_status ??
//                 item?.health ??
//                 item?.alert_status ??
//                 "unknown",
//             alarm_status: item?.alarm_status ?? null,
//         }));

//         return {
//             dashboard_name: "AC Energy Monitoring",
//             generated_at: new Date().toISOString(),
//             filters,
//             kpis: insightData,
//             trends: Array.isArray(trendHistory)
//                 ? trendHistory
//                 : [],
//             ac_data: filteredData,
//             ac_health: acHealth,
//             alerts: filteredData.filter(isAlert),
//             additional_data: {
//                 device_data: Array.isArray(deviceData)
//                 ? deviceData
//                 : [],
//             },
//         };
//     }, [
//         filters,
//         insightData,
//         trendHistory,
//         filteredData,
//         deviceData,
//     ]);

//     const handleTrendsClick = () => {
//         navigate("/org/dashboard/trends");
//     };

//     const hierarchyLevels =
//         filters?.hierarchy === "ZONAL"
//             ? ["zone", "circle", "region", "division", "branch", "device"]
//             : ["state", "district", "taluka", "city", "branch", "device"];

//     const selectedLevel =
//         [...hierarchyLevels]
//             .reverse()
//             .find((key) => Boolean(filters?.[key])) || "country";

//     const isBranchScope = selectedLevel === "branch";
//     const isDeviceScope = selectedLevel === "device";

//     const selectedDeviceId = String(
//         filters?.selectedDeviceId ||
//         filters?.device_id ||
//         (typeof filters?.device === "string"
//             ? filters.device
//             : filters?.device?.value || "")
//     ).trim();

//     const filtersKey = JSON.stringify(filters || {});

//     const isSingleDeviceScope =
//         isDeviceScope || Boolean(filters?.ac_id || selectedDeviceId);

//     const selectedState = filters?.state || "";

//     const showWidget = (key) => visibleWidgets?.[key] !== false;


//     useEffect(() => {
//         if (selectedLevel !== "branch" && selectedLevel !== "device") {
//             setCurrentHistoryData([]);
//             setCurrentHistoryStatus("idle");
//         return undefined;
//     }

//     const controller = new AbortController();

//     const loadCurrentHistory = async () => {
//         try {
//         const end = new Date();
//         const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

//         const params = new URLSearchParams({
//             period: "today",
//             from: start.toISOString(),
//             to: end.toISOString(),
//         });

//         const deviceId = selectedDeviceId || filters?.ac_id || "";
//         if (deviceId) params.set("ac_id", String(deviceId));

//         const token = [
//             "token",
//             "authToken",
//             "access_token",
//             "accessToken",
//         ]
//             .map((key) => localStorage.getItem(key))
//             .find(Boolean);

//         const response = await fetch(
//             `http://localhost:8000/api/current-history/?${params}`,
//             {
//             signal: controller.signal,
//             headers: token
//                 ? { Authorization: `Bearer ${token}` }
//                 : {},
//             }
//         );

//         if (!response.ok) {
//             throw new Error(`Current history API: HTTP ${response.status}`);
//         }

//         const payload = await response.json();
//         setCurrentHistoryData(
//             Array.isArray(payload?.data) ? payload.data : []
//         );
//         setCurrentHistoryStatus("loaded");
//         } catch (error) {
//         if (error.name === "AbortError") return;

//         console.error("Current history failed:", error);
//         setCurrentHistoryStatus("error");
//         }
//     };

//     loadCurrentHistory();

//     const intervalId = window.setInterval(loadCurrentHistory, 10000);

//     return () => {
//         controller.abort();
//         window.clearInterval(intervalId);
//     };
//     }, [selectedLevel, selectedDeviceId, filtersKey]);

//     useEffect(() => {
//         if (selectedLevel !== "branch" && selectedLevel !== "device") {
//             setHistoricalClimate([]);
//             setClimateHistoryStatus("idle");
//             return undefined;
//         }

//         const controller = new AbortController();
//         const loadClimateHistory = async () => {
//         // Only show "loading" the first time; 10 s refreshes update in place.
//         setClimateHistoryStatus((prev) => (prev === "loaded" || prev === "empty" ? prev : "loading"));
//         try {
//             const end = new Date();
//             const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
//             const params = new URLSearchParams({
//                 from: start.toISOString(),
//                 to: end.toISOString(),
//                 interval_seconds: "300", // 5-minute buckets keep a 24 h, multi-AC response small
//             });

//             // Preserve the dashboard's active hierarchy scope.
//             ["state", "district", "taluka", "city", "zone", "circle", "region", "division", "branch", "floor"].forEach((key) => {
//                 if (filters?.[key] != null && String(filters[key]).trim()) {
//                     params.set(key, String(filters[key]));
//                 }
//             });
//             const deviceId = selectedDeviceId || filters?.ac_id || "";
//             if (deviceId) params.set("device_id", String(deviceId));

//             const token = ["token", "authToken", "access_token", "accessToken"]
//                 .map((key) => localStorage.getItem(key))
//                 .find(Boolean);
//             const response = await fetch(
//                 `http://localhost:8000/api/telemetry-aggregates/?${params.toString()}`,
//                 {
//                     signal: controller.signal,
//                     headers: token ? { Authorization: `Bearer ${token}` } : {},
//                 }
//             );
//             if (!response.ok) {
//                 throw new Error(`Historical telemetry API returned HTTP ${response.status}`);
//             }
//             const payload = await response.json();
//             const rows = Array.isArray(payload?.data) ? payload.data : [];
//             setHistoricalClimate(rows.map((row) => ({
//                 timestamp: row.bucket_start,
//                 indoor_temperature: row.avg_temperature,
//                 indoor_humidity: row.avg_humidity,
//                 device_id: row.device_id,
//             })));
//             setClimateHistoryStatus(rows.length ? "loaded" : "empty");
//         } catch (error) {
//             if (error.name === "AbortError") return;
//             console.error("[Climate history] Failed to load:", error);
//             setHistoricalClimate([]);
//             setClimateHistoryStatus("error");
//         }
//     };
//     loadClimateHistory();
//     const intervalId = window.setInterval(loadClimateHistory, 10 * 1000); // refresh historical telemetry every 10 seconds
//     return () => {
//         controller.abort();
//         window.clearInterval(intervalId);
//     };
//     }, [selectedLevel, selectedDeviceId, filtersKey]);

//     const branchCoordinates = useMemo(() => {
//         const candidates = [...safeData, ...filteredData];
//         const record = candidates.find((item) => {
//             const lat = Number(item?.latitude ?? item?.lat);
//             const lon = Number(item?.longitude ?? item?.lon);
//             return item?.latitude != null && item?.longitude != null &&
//                 item?.latitude !== "" && item?.longitude !== "" &&
//                 Number.isFinite(lat) && Number.isFinite(lon) &&
//                 lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
//         });
//         if (!record) return null;
//         return {
//             latitude: Number(record.latitude ?? record.lat),
//             longitude: Number(record.longitude ?? record.lon),
//         };
//     }, [safeData, filteredData]);

//     useEffect(() => {
//         const shouldFetchWeather = selectedLevel === "branch" && Boolean(filters?.branch);
//         if (!shouldFetchWeather) {
//             setBranchWeather([]);
//             setWeatherStatus("idle");
//             setWeatherError("");
//             return undefined;
//         }

//         if (!branchCoordinates) {
//             setBranchWeather([]);
//             setWeatherStatus("missing-coordinates");
//             setWeatherError("This branch has no saved latitude/longitude. Add coordinates to the branch record first.");
//             return undefined;
//         }

//         const controller = new AbortController();
//         const loadWeather = async () => {
//             setWeatherStatus("loading");
//             setWeatherError("");
//             try {
//                 const params = new URLSearchParams({
//                     latitude: String(branchCoordinates.latitude),
//                     longitude: String(branchCoordinates.longitude),
//                     hourly: "temperature_2m,relative_humidity_2m",
//                     past_days: "1",
//                     forecast_days: "1",
//                     timezone: "auto",
//                 });
//                 const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
//                     signal: controller.signal,
//                 });
//                 if (!response.ok) throw new Error(`Weather service returned HTTP ${response.status}.`);
//                 const payload = await response.json();
//                 const times = payload?.hourly?.time || [];
//                 const temperatures = payload?.hourly?.temperature_2m || [];
//                 const humidities = payload?.hourly?.relative_humidity_2m || [];
//                 const points = times.map((timestamp, index) => ({
//                     timestamp,
//                     temperature: temperatures[index] == null ? null : Number(temperatures[index]),
//                     humidity: humidities[index] == null ? null : Number(humidities[index]),
//                 })).filter((point) => point.temperature !== null || point.humidity !== null);
//                 setBranchWeather(points);
//                 setWeatherStatus(points.length ? "loaded" : "empty");
//                 if (!points.length) setWeatherError("The weather service returned no hourly readings for these coordinates.");
//             } catch (error) {
//                 if (error.name === "AbortError") return;
//                 setBranchWeather([]);
//                 setWeatherStatus("error");
//                 setWeatherError(error.message || "Unable to load local weather data.");
//             }
//         };
//         loadWeather();
//         return () => controller.abort();
//     }, [
//         selectedLevel,
//         filters?.branch,
//         branchCoordinates?.latitude,
//         branchCoordinates?.longitude,
//     ]);

//     return (
//         <div className="ac-dashboard">
//             <br />
//             {filteredData.length === 0 ? (
//                 <div className="dashboard-no-data">
//                     <div className="no-data-icon">📊</div>
//                     <h2>No AC data available</h2>
//                     <p>There is no data for the selected filters.</p>
//                 </div>
//             ) : (
//                 <>
//                 <section className="ai-module-toggle-section">
//                     <button
//                         type="button"
//                         className="trends-button ai-module-toggle-button"
//                         onClick={() => setShowAIModule((previous) => !previous)}
//                         aria-expanded={showAIModule}
//                         aria-controls="ai-module-panel"
//                     >
//                         {showAIModule ? "Hide AI Module ▲" : "Show AI Module"}
//                     </button>

//                     {showAIModule && (
//                         <div id="ai-module-panel" className="ai-module-panel">
//                             <AIAssistantPanel dashboardData={dashboardPayload} />
//                         </div>
//                     )}
//                 </section>

//                 <br />

//                 {/* {selectedLevel === "branch" && (
//                     <section className="dashboard-section">
//                         <FaultDetectionPanel
//                             data={filteredData}
//                             refreshMs={2000}
//                         />
//                     </section>
//                 )} */}

//                 <br />

//                 <section className="dashboard-section">
//                     <div className="section-title dashboard-scope-heading">
//                         <div>
//                             <h2>{isSingleDeviceScope ? "AC Performance" : isFloorScope ? "Floor Overview" : isBranchScope ? "Branch Overview" : selectedLevel === "city" ? "City Overview" : selectedLevel === "country" ? "Organization Overview" : "Regional Overview"}</h2>
//                             <p>{Object.entries(filters || {}).filter(([key, value]) => key !== "hierarchy" && value).map(([, value]) => value).join(" · ") || "All Locations"}</p>
//                         </div>
//                         {/* <button type="button" className="trends-button" onClick={handleTrendsClick}>View Trends</button> */}
//                     </div>
//                     <div className="kpi-grid">
//                         {showWidget("total_acs") && <Total_Acs value={metrics.totalACs} />}
//                         <Active_Acs value={metrics.activeACs} />
//                         {/* <Inactive_Acs value={metrics.totalACs} /> */}
//                         {/* <Inactive_Acs devices={devices} /> */}
//                         <Inactive_Acs value={metrics.totalACs - metrics.activeACs} />
//                         {showWidget("total_energy") && <Total_Energy value={metrics.totalEnergy} />}
//                         {showWidget("active_energy") && <Active_Energy value={metrics.activeEnergy} />}
//                         {selectedLevel === "branch" && showWidget("active_power") && (
//                             <Active_Power value={metrics.totalPower} />
//                         )}

//                         {selectedLevel === "branch" && showWidget("temperature") && (
//                             <Average_Temperature value={metrics.averageTemperature} />
//                         )}

//                         {selectedLevel === "branch" && showWidget("humidity") && (
//                             <Average_Humidity value={metrics.averageHumidity} />
//                         )}

//                         {showWidget("alerts") && 
//                             <Alerts data={safeData} active={cardFilters?.alerts?.active === true} onClick={() => onCardFilterChange?.({ alerts: { active: !cardFilters?.alerts?.active } })} />
//                         }
//                         {selectedState && showWidget("cost_card") && 
//                             <EnergyCostCard stateName={selectedState} energyKwh={metrics.totalEnergy} />
//                         }
//                         </div>
//                 </section>

//                 <section className="dashboard-grid dashboard-grid--primary">
//                     {isBranchScope ? (
//                         showWidget("power_chart") && (
//                             <EnergyConsumptionChart data={deviceData} />
//                         )
//                     ) : (
//                         showWidget("power_chart") && (
//                             <PowerConsumptionChart data={deviceData} />
//                         )
//                     )}

//                     <ACHealthChart data={deviceData} />
//                     {/* <PowerConsumptionChart data={deviceData}/> */}                    
                    
//                     {selectedLevel === "branch" && showWidget("health_chart") && (
//                         <>
//                             {/* <PowerConsumptionChart data={deviceData} /> */}
//                             {/* <ACHealthChart data={deviceData} /> */}
//                             <CurrentHistoryChart
//                                 deviceId={selectedDeviceId}
//                                 scope={filters}
//                             />
//                             <VoltageHistoryChart
//                                 deviceId={selectedDeviceId}
//                                 scope={filters}
//                             />
//                             <TemperatureChart
//                                 deviceId={selectedDeviceId || filters?.ac_id || ""}
//                                 scope={filters}
//                                 data={branchWeather}
//                                 locationName={filters?.branch || ""}
//                                 status={weatherStatus}
//                                 error={weatherError}
//                             />

//                             <HumidityChart
//                                 deviceId={selectedDeviceId || filters?.ac_id || ""}
//                                 scope={filters}
//                                 data={branchWeather}
//                                 locationName={filters?.branch || ""}
//                                 status={weatherStatus}
//                                 error={weatherError}
//                             />
//                         </>
//                     )}
//                     {showWidget("energy_chart") && 
//                         <ZoneEnergyChart deviceId={selectedDeviceId} scope={filters} />
//                     }
//                     <ACDeviceTable data={filteredData} />
//                         <div className="chart-box dashboard-context-card">
//                             <div className="chart-header"><div><h3>{isSingleDeviceScope ? "Selected AC Details" : "Branch Device Summary"}</h3><span>Current filter scope</span></div></div>
//                             <div className="dashboard-context-stats">
//                                 <div><span>Installed ACs</span><strong>{metrics.totalACs}</strong></div>
//                                 <div><span>Running</span><strong>{metrics.activeACs}</strong></div>
//                                 <div><span>Avg. temperature</span><strong>{metrics.averageTemperature.toFixed(1)}°C</strong></div>
//                                 <div><span>Avg. humidity</span><strong>{metrics.averageHumidity.toFixed(1)}%</strong></div>
//                             </div>
//                             {isSingleDeviceScope && <p className="dashboard-context-note">One telemetry record is currently in scope. Confirm its device ID and timestamp before treating it as a live individual-device view.</p>}
//                         </div>
//                 </section>
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
import ACDeviceTable from "./ACDeviceTable";
import EnergyMap from "./EnergyMap/EnergyMap";
import EnergyCostCard from "./KPI Cards/EnergyCostCard";

import AIAssistantPanel from "./AIAssistantPanel";
import FaultDetectionPanel from "./FaultDetectionPanel"

import CurrentHistoryChart from "./Current/CurrentHistoryChart";
import VoltageHistoryChart from "./Voltage/VoltageHistoryChart";
import Inactive_Acs from "./KPI Cards/InactiveAcs";

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

// An AC that is OFF / OFFLINE draws nothing: the backend keeps its last known
// readings for display, so force current and power to 0 unless it is running.
const isRunning = (item) => ["active", "running", "on", "1"].includes(
    String(item?.status ?? item?.ac_status ?? item?.state ?? "").trim().toLowerCase()
);

const getCurrent = (item) => (isRunning(item) ? numberValue(item?.current ?? item?.Current) : 0);

const getPower = (item) => {
    if (!isRunning(item)) return 0;

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
    isLive,
    lastTelemetryText = "--",
}) {
    const navigate = useNavigate();
    const [showAIModule, setShowAIModule] = useState(false);

    useEffect(() => {
        const toggleAIModule = () => setShowAIModule((previous) => !previous);
        window.addEventListener("ac-toggle-ai-module", toggleAIModule);
        return () => window.removeEventListener("ac-toggle-ai-module", toggleAIModule);
    }, []);

    const [branchWeather, setBranchWeather] = useState([]);
    const [historicalClimate, setHistoricalClimate] = useState([]);
    const [climateHistoryStatus, setClimateHistoryStatus] = useState("idle");
    const [weatherStatus, setWeatherStatus] = useState("idle");
    const [weatherError, setWeatherError] = useState("");

    const [currentHistoryData, setCurrentHistoryData] = useState([]);
    const [currentHistoryStatus, setCurrentHistoryStatus] = useState("idle");

    // const isFloorScope = Boolean(selectedFloor);
    const isFloorScope = Boolean(filters?.floor);
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
        const totalEnergy = filteredData.reduce( (sum, item) => sum + getEnergy(item) / 1000, 0 );
        const activeEnergy = activeRecords.reduce( (sum, item) => sum + getEnergy(item) / 1000, 0 );
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

    const hierarchyLevels =
        filters?.hierarchy === "ZONAL"
            ? ["zone", "circle", "region", "division", "branch", "device"]
            : ["state", "district", "taluka", "city", "branch", "device"];

    const selectedLevel =
        [...hierarchyLevels]
            .reverse()
            .find((key) => Boolean(filters?.[key])) || "country";

    const isBranchScope = selectedLevel === "branch";
    const isDeviceScope = selectedLevel === "device";

    const selectedDeviceId = String(
        filters?.selectedDeviceId ||
        filters?.device_id ||
        (typeof filters?.device === "string"
            ? filters.device
            : filters?.device?.value || "")
    ).trim();

    const filtersKey = JSON.stringify(filters || {});

    const isSingleDeviceScope =
        isDeviceScope || Boolean(filters?.ac_id || selectedDeviceId);

    const selectedState = filters?.state || "";

    const showWidget = (key) => visibleWidgets?.[key] !== false;


    useEffect(() => {
        if (selectedLevel !== "branch" && selectedLevel !== "device") {
            setCurrentHistoryData([]);
            setCurrentHistoryStatus("idle");
        return undefined;
    }

    const controller = new AbortController();

    const loadCurrentHistory = async () => {
        try {
        const end = new Date();
        const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

        const params = new URLSearchParams({
            period: "today",
            from: start.toISOString(),
            to: end.toISOString(),
        });

        const deviceId = selectedDeviceId || filters?.ac_id || "";
        if (deviceId) params.set("ac_id", String(deviceId));

        const token = [
            "token",
            "authToken",
            "access_token",
            "accessToken",
        ]
            .map((key) => localStorage.getItem(key))
            .find(Boolean);

        const response = await fetch(
            `http://localhost:8000/api/current-history/?${params}`,
            {
            signal: controller.signal,
            headers: token
                ? { Authorization: `Bearer ${token}` }
                : {},
            }
        );

        if (!response.ok) {
            throw new Error(`Current history API: HTTP ${response.status}`);
        }

        const payload = await response.json();
        setCurrentHistoryData(
            Array.isArray(payload?.data) ? payload.data : []
        );
        setCurrentHistoryStatus("loaded");
        } catch (error) {
        if (error.name === "AbortError") return;

        console.error("Current history failed:", error);
        setCurrentHistoryStatus("error");
        }
    };

    loadCurrentHistory();

    const intervalId = window.setInterval(loadCurrentHistory, 10000);

    return () => {
        controller.abort();
        window.clearInterval(intervalId);
    };
    }, [selectedLevel, selectedDeviceId, filtersKey]);

    useEffect(() => {
        if (selectedLevel !== "branch" && selectedLevel !== "device") {
            setHistoricalClimate([]);
            setClimateHistoryStatus("idle");
            return undefined;
        }

        const controller = new AbortController();
        const loadClimateHistory = async () => {
        // Only show "loading" the first time; 10 s refreshes update in place.
        setClimateHistoryStatus((prev) => (prev === "loaded" || prev === "empty" ? prev : "loading"));
        try {
            const end = new Date();
            const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
            const params = new URLSearchParams({
                from: start.toISOString(),
                to: end.toISOString(),
                interval_seconds: "300", // 5-minute buckets keep a 24 h, multi-AC response small
            });

            // Preserve the dashboard's active hierarchy scope.
            ["state", "district", "taluka", "city", "zone", "circle", "region", "division", "branch", "floor"].forEach((key) => {
                if (filters?.[key] != null && String(filters[key]).trim()) {
                    params.set(key, String(filters[key]));
                }
            });
            const deviceId = selectedDeviceId || filters?.ac_id || "";
            if (deviceId) params.set("device_id", String(deviceId));

            const token = ["token", "authToken", "access_token", "accessToken"]
                .map((key) => localStorage.getItem(key))
                .find(Boolean);
            const response = await fetch(
                `http://localhost:8000/api/telemetry-aggregates/?${params.toString()}`,
                {
                    signal: controller.signal,
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                }
            );
            if (!response.ok) {
                throw new Error(`Historical telemetry API returned HTTP ${response.status}`);
            }
            const payload = await response.json();
            const rows = Array.isArray(payload?.data) ? payload.data : [];
            setHistoricalClimate(rows.map((row) => ({
                timestamp: row.bucket_start,
                indoor_temperature: row.avg_temperature,
                indoor_humidity: row.avg_humidity,
                device_id: row.device_id,
            })));
            setClimateHistoryStatus(rows.length ? "loaded" : "empty");
        } catch (error) {
            if (error.name === "AbortError") return;
            console.error("[Climate history] Failed to load:", error);
            setHistoricalClimate([]);
            setClimateHistoryStatus("error");
        }
    };
    loadClimateHistory();
    const intervalId = window.setInterval(loadClimateHistory, 10 * 1000); // refresh historical telemetry every 10 seconds
    return () => {
        controller.abort();
        window.clearInterval(intervalId);
    };
    }, [selectedLevel, selectedDeviceId, filtersKey]);

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
            {filteredData.length === 0 ? (
                <div className="dashboard-no-data">
                    <div className="no-data-icon">📊</div>
                    <h2>No AC data available</h2>
                    <p>There is no data for the selected filters.</p>
                </div>
            ) : (
                <>
                {showAIModule && (
                    <section id="ai-module-panel" className="ai-module-toggle-section ai-module-panel">
                        <AIAssistantPanel dashboardData={dashboardPayload} />
                    </section>
                )}

                {/* {selectedLevel === "branch" && (
                    <section className="dashboard-section">
                        <FaultDetectionPanel
                            data={filteredData}
                            refreshMs={2000}
                        />
                    </section>
                )} */}

                <section className="dashboard-section">
                    <div className="section-title dashboard-scope-heading">

    {/* OVERVIEW TITLE */}
    <div className="overview-heading-content">
        <h2>
            {isSingleDeviceScope
                ? "AC Performance"
                : isFloorScope
                    ? "Floor Overview"
                    : isBranchScope
                        ? "Branch Overview"
                        : selectedLevel === "city"
                            ? "City Overview"
                            : selectedLevel === "country"
                                ? "Organization Overview"
                                : "Regional Overview"}
        </h2>

        <p>
            {Object.entries(filters || {})
                .filter(([key, value]) => key !== "hierarchy" && value)
                .map(([, value]) => value)
                .join(" · ") || "All Locations"}
        </p>
    </div>
    {/* LIVE / LAST UPDATED */}
    <div className="overview-live-status">
        <span
            className={`last-updated-dot ${isLive ? "live" : "offline"}`}
        />

        {isLive ? (
            <span className="live-text">LIVE</span>
        ) : (
            <span className="last-updated-text">
                Last Updated: <strong>{lastTelemetryText}</strong>
            </span>
        )}
    </div>

</div>
                    <div className="kpi-grid">
                        {showWidget("total_acs") && <Total_Acs value={metrics.totalACs} />}
                        <Active_Acs value={metrics.activeACs} />
                        <Inactive_Acs value={metrics.totalACs - metrics.activeACs} />
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

                        {showWidget("alerts") && 
                            <Alerts data={safeData} active={cardFilters?.alerts?.active === true} onClick={() => onCardFilterChange?.({ alerts: { active: !cardFilters?.alerts?.active } })} />
                        }
                        {selectedState && showWidget("cost_card") && 
                            <EnergyCostCard stateName={selectedState} energyKwh={metrics.totalEnergy} />
                        }
                        </div>
                </section>

                <section className="dashboard-grid dashboard-grid--primary">
                    {isBranchScope ? (
                        showWidget("power_chart") && (
                            <EnergyConsumptionChart data={deviceData} />
                        )
                    ) : (
                        showWidget("power_chart") && (
                            <PowerConsumptionChart data={deviceData} />
                        )
                    )}

                    <ACHealthChart data={deviceData} />
                    
                    {selectedLevel === "branch" && showWidget("health_chart") && (
                        <>
                            <CurrentHistoryChart
                                deviceId={selectedDeviceId}
                                scope={filters}
                            />
                            <VoltageHistoryChart
                                deviceId={selectedDeviceId}
                                scope={filters}
                            />
                            <TemperatureChart
                                deviceId={selectedDeviceId || filters?.ac_id || ""}
                                scope={filters}
                                data={branchWeather}
                                locationName={filters?.branch || ""}
                                status={weatherStatus}
                                error={weatherError}
                            />
                            <HumidityChart
                                deviceId={selectedDeviceId || filters?.ac_id || ""}
                                scope={filters}
                                data={branchWeather}
                                locationName={filters?.branch || ""}
                                status={weatherStatus}
                                error={weatherError}
                            />
                        </>
                    )}
                    {showWidget("energy_chart") && 
                        <ZoneEnergyChart deviceId={selectedDeviceId} scope={filters} />
                    }
                    <ACDeviceTable data={filteredData} />
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
                </>
            )}
        </div>
    );
}

export default ACDashboard;