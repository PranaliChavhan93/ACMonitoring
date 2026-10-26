// import React, {
//     useCallback,
//     useEffect,
//     useMemo,
//     useState,
// } from "react";

// import "./Org_Dashboard.css";

// import FilterDashboard from "./FilterDashboard";
// import ACDashboard from "../../Second_Person/Forntend/ACDashboard";
// import { useAuth } from "../Layout/AuthContext";

// const API_BASE = "http://192.168.1.4:8000/api";
// // const API_BASE = "http://192.168.1.4:8000/api/v1/filters/locations/";
// const API_URL = `${API_BASE}/ac-data/`;
// const DASHBOARD_URL = `${API_BASE}/dashboard/preferences/`;

// // const FILTER_KEYS = [
// //     "zone",
// //     "state",
// //     "district",
// //     "taluka",
// //     "circle",
// //     "region",
// //     "division",
// //     "city",
// //     "branch",
// //     "floor",
// // ];

// const FILTER_LABELS = {
//     zone: "Zone",
//     state: "State",
//     district: "District",
//     taluka: "Taluka",
//     circle: "Circle",
//     region: "Region",
//     division: "Division",
//     city: "City",
//     branch: "Branch",
//     floor: "Floor",
//     device: "Device",
// };

// const FILTER_KEYS = [
//     "zone",
//     "state",
//     "district",
//     "taluka",
//     "circle",
//     "region",
//     "division",
//     "city",
//     "branch",
//     "floor",
//     "device", // Preserve the selected ThingsBoard device UUID
//     "ac_id",  // Exact local AC code for record-level filtering
// ];


// const EMPTY_FILTERS = {
//     hierarchy: "GEOGRAPHICAL",
//     ...Object.fromEntries(FILTER_KEYS.map((key) => [key, ""])),
// };

// const DEFAULT_WIDGETS = {
//     total_acs: true,
//     active_acs: true,
//     total_energy: true,
//     active_energy: true,
//     active_power: true,
//     temperature: true,
//     humidity: true,
//     alerts: true,
//     cost_card: true,
//     energy_chart: true,
//     power_chart: true,
//     temperature_chart: true,
//     humidity_chart: true,
//     health_chart: true,
//     zone_chart: true,
//     energy_map: true,
//     ac_table: true,
// };

// const getToken = () =>
//     localStorage.getItem("token") ||
//     localStorage.getItem("authToken") ||
//     localStorage.getItem("access_token") ||
//     localStorage.getItem("accessToken") ||
//     "";

// const authHeaders = () => {
//     const token = getToken();

//     return {
//         "Content-Type": "application/json",
//         Accept: "application/json",
//         ...(token
//             ? {
//                   Authorization: token.startsWith("Token ")
//                       ? token
//                       : `Token ${token}`,
//               }
//             : {}),
//     };
// };

// const normalizeResponse = (result) => {
//     if (Array.isArray(result)) return result;
//     if (result && Array.isArray(result.data)) return result.data;
//     if (result && Array.isArray(result.results)) return result.results;
//     return [];
// };

// const normalizeFilters = (input = {}) => {
//     const normalized = {
//         hierarchy: input.hierarchy || "GEOGRAPHICAL",
//     };

//     FILTER_KEYS.forEach((key) => {
//         normalized[key] = input[key] || "";
//     });

//     const device =
//         typeof input.device === "string"
//             ? input.device
//             : input.device?.value ||
//             input.device?.uuid ||
//             input.device?.id ||
//             input.device?.tpt_device_id ||
//             input.device?.thingsboard_device_id ||
//             input.device?.thingsboard_id ||
//             input.device?.device_uuid ||
//             input.device?.device_id ||
//             "";

//     normalized.device = device;

//     normalized.selectedDeviceId =
//         input.selectedDeviceId ||
//         input.device_id ||
//         device;

//     normalized.device_id = normalized.selectedDeviceId;
//     normalized.ac_id = input.ac_id || input.selectedAcId || normalized.ac_id || "";
//     normalized.selectedAcId = input.selectedAcId || normalized.ac_id;

//     return normalized;
// };

// const getHeadOfficeDefaults = (user) => {
//     const defaults = user?.filter_defaults || {};

//     const hierarchy =
//         defaults.hierarchy ||
//         user?.customer_hierarchy_type ||
//         "GEOGRAPHICAL";

//     return normalizeFilters({
//         ...EMPTY_FILTERS,
//         ...defaults,
//         hierarchy,

//         // Geographical hierarchy
//         state:
//             defaults.state ||
//             user?.head_office_state ||
//             user?.state_name ||
//             "",

//         district:
//             defaults.district ||
//             user?.head_office_district ||
//             user?.district_name ||
//             "",

//         taluka:
//             defaults.taluka ||
//             user?.head_office_taluka ||
//             "",

//         city:
//             defaults.city ||
//             user?.head_office_city_name ||
//             "",

//         // Zonal hierarchy
//         zone:
//             defaults.zone ||
//             user?.head_office_zone ||
//             user?.zone_name ||
//             "",

//         circle: defaults.circle || "",
//         region: defaults.region || "",
//         division: defaults.division || "",

//         branch:
//             defaults.branch ||
//             user?.head_office_branch ||
//             "",

//         floor:
//             defaults.floor ||
//             user?.head_office_floor ||
//             "",
//     });
// };

// function Org_Dashboard() {
//     const { user: currentUser } = useAuth();

//     const filterAccess = useMemo(() => {
//         const role = currentUser?.role;
//         const hierarchy = currentUser?.customer_hierarchy_type;

//         if (role === "CUSTOMER" || role === "BR_ADMIN" || role === "ENGINEER") {
//             const allowed = hierarchy === "ZONAL"
//                 ? ["ZONAL"]
//                 : hierarchy === "GEOGRAPHICAL"
//                     ? ["GEOGRAPHICAL"]
//                     : [];

//             const lockedValues = {};

//             if (role === "BR_ADMIN" || role === "ENGINEER") {
//                 if (hierarchy === "ZONAL" && currentUser?.zone_name) {
//                     lockedValues.zone = currentUser.zone_name;
//                 }
//                 if (hierarchy === "GEOGRAPHICAL" && currentUser?.state_name) {
//                     lockedValues.state = currentUser.state_name;
//                 }
//             }

//             return { allowed, lockedValues };
//         }

//         return {
//             allowed: ["GEOGRAPHICAL", "ZONAL"],
//             lockedValues: {},
//         };
//     }, [currentUser]);

//     const [apiData, setApiData] = useState([]);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState("");
//     const [lastUpdated, setLastUpdated] = useState(null);

//     const [filters, setFilters] = useState(EMPTY_FILTERS);
//     const [cardFilters, setCardFilters] = useState({});
//     const [visibleWidgets, setVisibleWidgets] = useState(() => getRoleWidgets(currentUser?.role));

//     const [savedDashboards, setSavedDashboards] = useState([]);
//     const [activeDashboardId, setActiveDashboardId] = useState(null);
//     const [dashboardName, setDashboardName] = useState("My Dashboard");
//     const [dashboardLoading, setDashboardLoading] = useState(false);
//     const [dashboardMessage, setDashboardMessage] = useState("");
//     const [restoreVersion, setRestoreVersion] = useState(0);

//     const [filtersReady, setFiltersReady] = useState(false);
    
//     const [dashboardFilters, setDashboardFilters] = useState({});

//     // const loadSavedDashboards = useCallback(async () => {
//     //     try {
//     //         const response = await fetch(DASHBOARD_URL, {
//     //             method: "GET",
//     //             headers: authHeaders(),
//     //             cache: "no-store",
//     //         });

//     //         if (response.status === 401) {
//     //             throw new Error("Session expired. Please login again.");
//     //         }

//     //         if (!response.ok) {
//     //             throw new Error(`Dashboard API HTTP ${response.status}`);
//     //         }

//     //         const result = await response.json();
//     //         const dashboards = normalizeResponse(result);

//     //         setSavedDashboards(dashboards);

//     //         const defaultDashboard =
//     //             dashboards.find((item) => item.is_default) || dashboards[0];

//     //         if (defaultDashboard) {
//     //             setActiveDashboardId(defaultDashboard.id);
//     //             setDashboardName(defaultDashboard.name || "My Dashboard");
//     //             setFilters(normalizeFilters(defaultDashboard.main_filters));
//     //             setCardFilters(defaultDashboard.card_filters || {});
//     //             setVisibleWidgets({
//     //                 ...DEFAULT_WIDGETS,
//     //                 ...(defaultDashboard.visible_widgets || {}),
//     //             });
//     //             setRestoreVersion((value) => value + 1);
//     //         }
//     //     } catch (err) {
//     //         console.error("DASHBOARD PREFERENCE LOAD ERROR:", err);
//     //     }
//     // }, []);

    
//     // const loadSavedDashboards = useCallback(async () => {
//     //     setDashboardLoading(true);

//     //     try {
//     //         const response = await fetch(DASHBOARD_URL, {
//     //             method: "GET",
//     //             headers: authHeaders(),
//     //             cache: "no-store",
//     //         });

//     //         if (response.status === 401) {
//     //             throw new Error("Session expired. Please login again.");
//     //         }

//     //         if (!response.ok) {
//     //             throw new Error(`Dashboard API HTTP ${response.status}`);
//     //         }

//     //         const result = await response.json();
//     //         const dashboards = normalizeResponse(result);

//     //         setSavedDashboards(dashboards);

//     //         const defaultDashboard =
//     //             dashboards.find((item) => item.is_default) ||
//     //             dashboards[0];

//     //         if (defaultDashboard) {
//     //             // Restore the saved dashboard.
//     //             setActiveDashboardId(defaultDashboard.id);
//     //             setDashboardName(defaultDashboard.name || "My Dashboard");

//     //             setFilters(
//     //                 normalizeFilters(defaultDashboard.main_filters)
//     //             );

//     //             setCardFilters(defaultDashboard.card_filters || {});

//     //             setVisibleWidgets({
//     //                 ...DEFAULT_WIDGETS,
//     //                 ...(defaultDashboard.visible_widgets || {}),
//     //             });
//     //         } else {
//     //             // No saved dashboard exists: use the customer's Head Office.
//     //             const defaultFilters = getHeadOfficeDefaults(currentUser);

//     //             setActiveDashboardId(null);
//     //             setDashboardName("My Dashboard");
//     //             setFilters(defaultFilters);
//     //             setCardFilters({});
//     //             setVisibleWidgets(getRoleWidgets(currentUser?.role));
//     //             setRestoreVersion((value) => value + 1);
//     //         }
//     //         setRestoreVersion((value) => value + 1);
//     //     } catch (err) {

            
//     //         console.error("DASHBOARD PREFERENCE LOAD ERROR:", err);

//     //         // Fallback if the preference API fails.
//     //         setActiveDashboardId(null);
//     //         setDashboardName("My Dashboard");
//     //         setFilters(getHeadOfficeDefaults(currentUser));
//     //         setCardFilters({});
//     //         setVisibleWidgets(DEFAULT_WIDGETS);
//     //         setRestoreVersion((value) => value + 1);
//     //     } finally {
//     //         setFiltersReady(true);
//     //         setDashboardLoading(false);
//     //     }
//     // }, [currentUser]);

//     const loadSavedDashboards = useCallback(async () => {
//         setDashboardLoading(true);

//         try {
//             const response = await fetch(DASHBOARD_URL, {
//                 method: "GET",
//                 headers: authHeaders(),
//                 cache: "no-store",
//             });

//             if (response.status === 401) {
//                 throw new Error("Session expired. Please login again.");
//             }

//             if (!response.ok) {
//                 throw new Error(`Dashboard API HTTP ${response.status}`);
//             }

//             const result = await response.json();
//             const dashboards = normalizeResponse(result);

//             setSavedDashboards(dashboards);

//             const defaultDashboard =
//                 dashboards.find((item) => item.is_default) ||
//                 dashboards[0];

//             let nextFilters;

//             if (defaultDashboard) {
//                 // Restore saved dashboard preferences.
//                 setActiveDashboardId(defaultDashboard.id);
//                 setDashboardName(
//                     defaultDashboard.name || "My Dashboard"
//                 );

//                 nextFilters = normalizeFilters(
//                     defaultDashboard.main_filters
//                 );

//                 setCardFilters(defaultDashboard.card_filters || {});

//                 setVisibleWidgets({
//                     ...DEFAULT_WIDGETS,
//                     ...(defaultDashboard.visible_widgets || {}),
//                 });
//             } else {
//                 // No saved dashboard: select Head Office defaults.
//                 setActiveDashboardId(null);
//                 setDashboardName("My Dashboard");

//                 nextFilters = getHeadOfficeDefaults(currentUser);

//                 setCardFilters({});
//                 setVisibleWidgets(getRoleWidgets(currentUser?.role));
//             }

//             // Enforce access restrictions and apply the selected hierarchy.
//             nextFilters = normalizeFilters({
//                 ...nextFilters,
//                 ...filterAccess.lockedValues,
//                 hierarchy:
//                     filterAccess.allowed.length === 1
//                         ? filterAccess.allowed[0]
//                         : nextFilters.hierarchy,
//             });

//             setFilters(nextFilters);

//             // Trigger FilterDashboard restoration once.
//             setRestoreVersion((version) => version + 1);
//         } catch (err) {
//             console.error("DASHBOARD PREFERENCE LOAD ERROR:", err);

//             const defaults = getHeadOfficeDefaults(currentUser);

//             setActiveDashboardId(null);
//             setDashboardName("My Dashboard");
//             setFilters(
//                 normalizeFilters({
//                     ...defaults,
//                     ...filterAccess.lockedValues,
//                     hierarchy:
//                         filterAccess.allowed.length === 1
//                             ? filterAccess.allowed[0]
//                             : defaults.hierarchy,
//                 })
//             );

//             setCardFilters({});
//             setVisibleWidgets(getRoleWidgets(currentUser?.role));
//             setRestoreVersion((version) => version + 1);
//         } finally {
//             setFiltersReady(true);
//             setDashboardLoading(false);
//         }
//     }, [currentUser, filterAccess]);

//     useEffect(() => {
//         if (!currentUser) {
//             setFiltersReady(false);
//             return;
//         }

//         setFiltersReady(false);
//         loadSavedDashboards();
//     }, [currentUser, loadSavedDashboards]);

//     const fetchACData = useCallback(async () => {
//         try {
//             setLoading(true);

//             const params = new URLSearchParams();

//             if (filters.hierarchy) {
//                 params.append("hierarchy", filters.hierarchy);
//             }

//             FILTER_KEYS.forEach((key) => {
//                 const value = filters[key];
//                 if (value) params.append(key, value);
//             });

//             params.append("t", Date.now());

//             const url = `${API_URL}?${params.toString()}`;
//             console.log("FILTERED API URL:", url);

//             const response = await fetch(url, {
//                 method: "GET",
//                 cache: "no-store",
//                 headers: authHeaders(),
//             });

//             if (response.status === 401) {
//                 throw new Error("401 Unauthorized. Please login again.");
//             }

//             if (!response.ok) {
//                 throw new Error("Cloud Error");
//             }

//             const result = await response.json();
//             const records = normalizeResponse(result);

//             setApiData(records);
//             setLastUpdated(new Date());
//             setError("");
//         } catch (err) {
//             console.error("AC API ERROR:", err);
//             setError(err.message || "Unable to fetch AC data.");
//         } finally {
//             setLoading(false);
//         }
//     }, [filters]);

//     useEffect(() => {
//         if (!filtersReady) return;

//         fetchACData();

//         const interval = setInterval(fetchACData, 2000);

//         return () => clearInterval(interval);
//     }, [fetchACData, filtersReady]);

//     const handleFilterChange = useCallback((newFilters) => {
//         console.log("[Org Dashboard] Received filters:", newFilters);

//         setFilters({
//             ...newFilters,
//             device: newFilters.device || "",
//             device_id: newFilters.device_id || "",
//             selectedDeviceId: newFilters.selectedDeviceId || "",
//             ac_id: newFilters.ac_id || newFilters.selectedAcId || "",
//             selectedAcId: newFilters.selectedAcId || newFilters.ac_id || "",
//         });
//         }, []);

//     // const handleResetFilters = useCallback(() => {
//     //     const defaults = getHeadOfficeDefaults(currentUser);

//     //     const scoped = {
//     //         ...defaults,
//     //         ...filterAccess.lockedValues,
//     //         hierarchy:
//     //             filterAccess.allowed[0] || defaults.hierarchy,
//     //     };

//     //     setFilters(normalizeFilters(scoped));
//     //     setCardFilters({});
//     //     setRestoreVersion((value) => value + 1);
//     // }, [currentUser, filterAccess]);

//     const handleResetFilters = useCallback(() => {
//         setFilters(getHeadOfficeDefaults(currentUser));
//         setCardFilters({});
//         setRestoreVersion((value) => value + 1);
//     }, [currentUser]);

//     const handleCardFilterChange = useCallback((nextCardFilters) => {
//         setCardFilters((previous) => ({
//             ...previous,
//             ...nextCardFilters,
//         }));
//     }, []);

//     const saveDashboard = useCallback(async () => {
//         const name = dashboardName.trim() || "My Dashboard";

//         try {
//             setDashboardLoading(true);
//             setDashboardMessage("");

//             const payload = {
//                 name,
//                 main_filters: filters,
//                 card_filters: cardFilters,
//                 visible_widgets: visibleWidgets,
//                 is_default: true,
//             };

//             const isUpdate = Boolean(activeDashboardId);
//             const url = isUpdate
//                 ? `${DASHBOARD_URL}${activeDashboardId}/`
//                 : DASHBOARD_URL;

//             const response = await fetch(url, {
//                 method: isUpdate ? "PATCH" : "POST",
//                 headers: authHeaders(),
//                 body: JSON.stringify(payload),
//             });

//             if (response.status === 401) {
//                 throw new Error("Session expired. Please login again.");
//             }

//             if (!response.ok) {
//                 const text = await response.text();
//                 throw new Error(text || `HTTP ${response.status}`);
//             }

//             const saved = await response.json();

//             setActiveDashboardId(saved.id);
//             setDashboardName(saved.name || name);
//             setDashboardMessage("Dashboard saved");

//             await loadSavedDashboards();
//         } catch (err) {
//             console.error("DASHBOARD SAVE ERROR:", err);
//             setDashboardMessage(err.message || "Unable to save dashboard");
//         } finally {
//             setDashboardLoading(false);
//             window.setTimeout(() => setDashboardMessage(""), 2500);
//         }
//     }, [
//         activeDashboardId,
//         cardFilters,
//         dashboardName,
//         filters,
//         loadSavedDashboards,
//         visibleWidgets,
//     ]);

//     const createNewDashboard = useCallback(() => {
//         const defaults = getHeadOfficeDefaults(currentUser);

//         setActiveDashboardId(null);
//         setDashboardName("My Dashboard");
//         setFilters({
//             ...defaults,
//             ...filterAccess.lockedValues,
//             hierarchy:
//                 filterAccess.allowed[0] || defaults.hierarchy,
//         });
//         setCardFilters({});
//         setVisibleWidgets(DEFAULT_WIDGETS);
//         setRestoreVersion((value) => value + 1);
//         setDashboardMessage("New dashboard");
//     }, [currentUser, filterAccess]);

//     const loadDashboard = useCallback((dashboard) => {
//         setActiveDashboardId(dashboard.id);
//         setDashboardName(dashboard.name || "My Dashboard");
//         setFilters(normalizeFilters(dashboard.main_filters));
//         setCardFilters(dashboard.card_filters || {});
//         setVisibleWidgets({
//             ...DEFAULT_WIDGETS,
//             ...(dashboard.visible_widgets || {}),
//         });
//         setRestoreVersion((value) => value + 1);
//         setDashboardMessage(`Loaded ${dashboard.name}`);
//         window.setTimeout(() => setDashboardMessage(""), 2000);
//     }, []);

//     const filterSummary = useMemo(() => {
//         const parts = FILTER_KEYS
//             .filter((key) => filters[key])
//             .map((key) => `${FILTER_LABELS[key]}: ${filters[key]}`);

//         return parts.length ? parts.join("  •  ") : "All Locations";
//     }, [filters]);

//     const lastUpdatedText = lastUpdated
//         ? lastUpdated.toLocaleTimeString()
//         : "--";

//     return (
//         <div className="organization-dashboard">
//             <div className="organization-filter-card">
//                 <div
//                     style={{
//                         display: "flex",
//                         alignItems: "center",
//                         gap: "10px",
//                         flexWrap: "wrap",
//                         marginBottom: "12px",
//                     }}
//                 >
//                     <button
//                         type="button"
//                         onClick={saveDashboard}
//                         disabled={dashboardLoading}
//                         style={{
//                             height: "36px",
//                             border: "none",
//                             borderRadius: "6px",
//                             padding: "0 15px",
//                             background: "#2563eb",
//                             color: "white",
//                             cursor: dashboardLoading ? "wait" : "pointer",
//                             fontWeight: 600,
//                         }}
//                     >
//                         {dashboardLoading ? "Saving..." : "Save Your Preferance"}
//                     </button>

//                     {/* <button
//                         type="button"
//                         onClick={createNewDashboard}
//                         style={{
//                             height: "36px",
//                             border: "1px solid #d1d5db",
//                             borderRadius: "6px",
//                             padding: "0 15px",
//                             background: "white",
//                             cursor: "pointer",
//                         }}
//                     >
//                         New
//                     </button> */}

//                     {dashboardMessage && (
//                         <span style={{ fontSize: "12px", color: "#2563eb" }}>
//                             {dashboardMessage}
//                         </span>
//                     )}
//                 </div>

//                 <FilterDashboard
//                     initialValue={filters}
//                     restoreVersion={restoreVersion}
//                     allowedHierarchies={filterAccess.allowed}
//                     lockedValues={filterAccess.lockedValues}
//                     onFilterChange={handleFilterChange}
//                     onReset={handleResetFilters}
//                 />

//                 <div className="filter-summary-bar">
//                     <span className="filter-summary-text">{filterSummary}</span>

//                     <span className="filter-last-updated">
//                         <span className="last-updated-dot" />
//                         LIVE
//                         {/* <strong>{lastUpdatedText}</strong> */}
//                     </span>
//                 </div>
//             </div>

//             {error && (
//                 <div className="organization-error">
//                     <strong>Data API Error:</strong>
//                     <span>{error}</span>
//                 </div>
//             )}

//             {loading && apiData.length === 0 ? (
//                 <div className="organization-loading">
//                     <div className="loading-spinner"></div>
//                     <span>Loading AC Energy Data...</span>
//                 </div>
//             ) : (
//                 <ACDashboard
//                     data={apiData}
//                     filters={filters}
//                     cardFilters={cardFilters}
//                     visibleWidgets={visibleWidgets}
//                     onCardFilterChange={handleCardFilterChange}
//                     onWidgetVisibilityChange={(next) => setVisibleWidgets(applyRoleWidgetPermissions(currentUser?.role, next))}
//                 />
//             )}
//         </div>
//     );
// }

// export default Org_Dashboard;


import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import "./Org_Dashboard.css";

import FilterDashboard from "./FilterDashboard";
import ACDashboard from "../../Second_Person/Forntend/ACDashboard";
import { useAuth } from "../Layout/AuthContext";

const API_BASE = "http://192.168.1.4:8000/api";
const API_URL = `${API_BASE}/ac-data/`;
const DASHBOARD_URL = `${API_BASE}/dashboard/preferences/`;

const FILTER_LABELS = {
    zone: "Zone",
    state: "State",
    district: "District",
    taluka: "Taluka",
    circle: "Circle",
    region: "Region",
    division: "Division",
    city: "City",
    branch: "Branch",
    floor: "Floor",
    device: "Device",
};

const FILTER_KEYS = [
    "zone",
    "state",
    "district",
    "taluka",
    "circle",
    "region",
    "division",
    "city",
    "branch",
    "floor",
    "device",
    "ac_id",
];

const EMPTY_FILTERS = {
    hierarchy: "GEOGRAPHICAL",
    ...Object.fromEntries(FILTER_KEYS.map((key) => [key, ""])),
};

const DEFAULT_WIDGETS = {
    total_acs: true, active_acs: true, total_energy: true, active_energy: true,
    active_power: true, temperature: true, humidity: true, alerts: true,
    cost_card: true, energy_chart: true, power_chart: true, temperature_chart: true,
    humidity_chart: true, health_chart: true, zone_chart: true, energy_map: true, ac_table: true,
};

// Existing widgets are reused; role defaults only control visibility. Backend
// APIs remain responsible for enforcing which records a user may access.
const ROLE_WIDGETS = {
    ORG_SUPER_ADMIN: { ...DEFAULT_WIDGETS },
    CUSTOMER: { ...DEFAULT_WIDGETS },
    BR_ADMIN: { ...DEFAULT_WIDGETS, zone_chart: false, energy_map: false },
    ENGINEER: {
        ...DEFAULT_WIDGETS, total_energy: false, active_energy: false, cost_card: false,
        zone_chart: false, energy_map: false,
    },
};

const getRoleWidgets = (role) => ROLE_WIDGETS[role] || ROLE_WIDGETS.ENGINEER;
const applyRoleWidgetPermissions = (role, requested = {}) => {
    const allowed = getRoleWidgets(role);
    return Object.fromEntries(Object.keys(DEFAULT_WIDGETS).map((key) => [
        key, allowed[key] === false ? false : (requested[key] ?? allowed[key]),
    ]));
};

const getToken = () =>
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("accessToken") ||
    "";

const authHeaders = () => {
    const token = getToken();
    return {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: token.startsWith("Token ") ? token : `Token ${token}` } : {}),
    };
};

const normalizeResponse = (result) => {
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.data)) return result.data;
    if (result && Array.isArray(result.results)) return result.results;
    return [];
};

const normalizeFilters = (input = {}) => {
    const normalized = {
        hierarchy: input.hierarchy || "GEOGRAPHICAL",
    };

    FILTER_KEYS.forEach((key) => {
        normalized[key] = input[key] || "";
    });

    const device =
        typeof input.device === "string"
            ? input.device
            : input.device?.value ||
            input.device?.uuid ||
            input.device?.id ||
            input.device?.tpt_device_id ||
            input.device?.thingsboard_device_id ||
            input.device?.thingsboard_id ||
            input.device?.device_uuid ||
            input.device?.device_id ||
            "";

    normalized.device = device;
    normalized.selectedDeviceId = input.selectedDeviceId || input.device_id || device;
    normalized.device_id = normalized.selectedDeviceId;
    normalized.ac_id = input.ac_id || input.selectedAcId || normalized.ac_id || "";
    normalized.selectedAcId = input.selectedAcId || normalized.ac_id;

    return normalized;
};

const getHeadOfficeDefaults = (user) => {
    const defaults = user?.filter_defaults || {};
    const hierarchy = defaults.hierarchy || user?.customer_hierarchy_type || "GEOGRAPHICAL";

    return normalizeFilters({
        ...EMPTY_FILTERS,
        ...defaults,
        hierarchy,
        state: defaults.state || user?.head_office_state || user?.state_name || "",
        district: defaults.district || user?.head_office_district || user?.district_name || "",
        taluka: defaults.taluka || user?.head_office_taluka || "",
        city: defaults.city || user?.head_office_city_name || "",
        zone: defaults.zone || user?.head_office_zone || user?.zone_name || "",
        circle: defaults.circle || "",
        region: defaults.region || "",
        division: defaults.division || "",
        branch: defaults.branch || user?.head_office_branch || "",
        floor: defaults.floor || user?.head_office_floor || "",
    });
};

function Org_Dashboard() {
    const { user: currentUser } = useAuth();

    const filterAccess = useMemo(() => {
        const role = currentUser?.role;
        const hierarchy = currentUser?.customer_hierarchy_type;

        if (role === "CUSTOMER" || role === "BR_ADMIN" || role === "ENGINEER") {
            const allowed = hierarchy === "ZONAL" ? ["ZONAL"] : hierarchy === "GEOGRAPHICAL" ? ["GEOGRAPHICAL"] : [];
            const lockedValues = {};

            // Customer can browse its authorized hierarchy. Admin's assigned
            // state/zone is locked so filters below it cannot escape scope.
            if (role === "BR_ADMIN") {
                if (hierarchy === "ZONAL" && (currentUser?.zone_name || currentUser?.zone?.name)) {
                    lockedValues.zone = currentUser.zone_name || currentUser.zone.name;
                }
                if (hierarchy === "GEOGRAPHICAL" && (currentUser?.state_name || currentUser?.state?.name)) {
                    lockedValues.state = currentUser.state_name || currentUser.state.name;
                }
            }
            if (role === "ENGINEER") {
                if (currentUser?.site_name) lockedValues.site = currentUser.site_name;
                if (currentUser?.branch_name) lockedValues.branch = currentUser.branch_name;
                if (hierarchy === "ZONAL" && currentUser?.zone_name) lockedValues.zone = currentUser.zone_name;
                if (hierarchy === "GEOGRAPHICAL" && currentUser?.state_name) lockedValues.state = currentUser.state_name;
            }
            return { allowed, lockedValues };
        }
        return { allowed: ["GEOGRAPHICAL", "ZONAL"], lockedValues: {} };
    }, [currentUser]);

    const [apiData, setApiData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [lastUpdated, setLastUpdated] = useState(null);

    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [cardFilters, setCardFilters] = useState({});
    const [visibleWidgets, setVisibleWidgets] = useState(() => getRoleWidgets(currentUser?.role));

    const [savedDashboards, setSavedDashboards] = useState([]);
    const [activeDashboardId, setActiveDashboardId] = useState(null);
    const [dashboardName, setDashboardName] = useState("My Dashboard");
    const [dashboardLoading, setDashboardLoading] = useState(false);
    const [dashboardMessage, setDashboardMessage] = useState("");
    const [restoreVersion, setRestoreVersion] = useState(0);
    const [filtersReady, setFiltersReady] = useState(false);
    const [dashboardFilters, setDashboardFilters] = useState({});

    const loadSavedDashboards = useCallback(async () => {
        setDashboardLoading(true);
        try {
            const response = await fetch(DASHBOARD_URL, {
                method: "GET",
                headers: authHeaders(),
                cache: "no-store",
            });

            if (response.status === 401) throw new Error("Session expired. Please login again.");
            if (!response.ok) throw new Error(`Dashboard API HTTP ${response.status}`);

            const result = await response.json();
            const dashboards = normalizeResponse(result);
            setSavedDashboards(dashboards);

            const defaultDashboard = dashboards.find((item) => item.is_default) || dashboards[0];
            let nextFilters;

            if (defaultDashboard) {
                setActiveDashboardId(defaultDashboard.id);
                setDashboardName(defaultDashboard.name || "My Dashboard");
                nextFilters = normalizeFilters(defaultDashboard.main_filters);
                setCardFilters(defaultDashboard.card_filters || {});
                setVisibleWidgets(applyRoleWidgetPermissions(currentUser?.role, defaultDashboard.visible_widgets || {}));
            } else {
                setActiveDashboardId(null);
                setDashboardName("My Dashboard");
                nextFilters = getHeadOfficeDefaults(currentUser);
                setCardFilters({});
                setVisibleWidgets(getRoleWidgets(currentUser?.role));
            }

            nextFilters = normalizeFilters({
                ...nextFilters,
                ...filterAccess.lockedValues,
                hierarchy: filterAccess.allowed.length === 1 ? filterAccess.allowed[0] : nextFilters.hierarchy,
            });

            setFilters(nextFilters);
            setRestoreVersion((version) => version + 1);
        } catch (err) {
            console.error("DASHBOARD PREFERENCE LOAD ERROR:", err);
            const defaults = getHeadOfficeDefaults(currentUser);
            setActiveDashboardId(null);
            setDashboardName("My Dashboard");
            setFilters(normalizeFilters({
                ...defaults,
                ...filterAccess.lockedValues,
                hierarchy: filterAccess.allowed.length === 1 ? filterAccess.allowed[0] : defaults.hierarchy,
            }));
            setCardFilters({});
            setVisibleWidgets(getRoleWidgets(currentUser?.role));
            setRestoreVersion((version) => version + 1);
        } finally {
            setFiltersReady(true);
            setDashboardLoading(false);
        }
    }, [currentUser, filterAccess]);

    useEffect(() => {
        if (!currentUser) {
            setFiltersReady(false);
            return;
        }
        setFiltersReady(false);
        loadSavedDashboards();
    }, [currentUser, loadSavedDashboards]);

    const fetchACData = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();

            if (filters.hierarchy) params.append("hierarchy", filters.hierarchy);

            FILTER_KEYS.forEach((key) => {
                const value = filters[key];
                if (value) params.append(key, value);
            });

            params.append("t", Date.now());
            const url = `${API_URL}?${params.toString()}`;

            const response = await fetch(url, {
                method: "GET",
                cache: "no-store",
                headers: authHeaders(),
            });

            if (response.status === 401) throw new Error("401 Unauthorized. Please login again.");
            if (!response.ok) throw new Error("Cloud Error");

            const result = await response.json();
            const records = normalizeResponse(result);

            setApiData(records);
            setLastUpdated(new Date());
            setError("");
        } catch (err) {
            console.error("AC API ERROR:", err);
            setError(err.message || "Unable to fetch AC data.");
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        if (!filtersReady) return;
        fetchACData();
        const interval = setInterval(fetchACData, 2000);
        return () => clearInterval(interval);
    }, [fetchACData, filtersReady]);

    const handleFilterChange = useCallback((newFilters) => {
        setFilters({
            ...newFilters,
            device: newFilters.device || "",
            device_id: newFilters.device_id || "",
            selectedDeviceId: newFilters.selectedDeviceId || "",
            ac_id: newFilters.ac_id || newFilters.selectedAcId || "",
            selectedAcId: newFilters.selectedAcId || newFilters.ac_id || "",
        });
    }, []);

    const handleResetFilters = useCallback(() => {
        setFilters(getHeadOfficeDefaults(currentUser));
        setCardFilters({});
        setRestoreVersion((value) => value + 1);
    }, [currentUser]);

    const handleCardFilterChange = useCallback((nextCardFilters) => {
        setCardFilters((previous) => ({
            ...previous,
            ...nextCardFilters,
        }));
    }, []);

    const saveDashboard = useCallback(async () => {
        const name = dashboardName.trim() || "My Dashboard";
        try {
            setDashboardLoading(true);
            setDashboardMessage("");
            const payload = {
                name,
                main_filters: filters,
                card_filters: cardFilters,
                visible_widgets: visibleWidgets,
                is_default: true,
            };

            const isUpdate = Boolean(activeDashboardId);
            const url = isUpdate ? `${DASHBOARD_URL}${activeDashboardId}/` : DASHBOARD_URL;

            const response = await fetch(url, {
                method: isUpdate ? "PATCH" : "POST",
                headers: authHeaders(),
                body: JSON.stringify(payload),
            });

            if (response.status === 401) throw new Error("Session expired. Please login again.");
            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || `HTTP ${response.status}`);
            }

            const saved = await response.json();
            setActiveDashboardId(saved.id);
            setDashboardName(saved.name || name);
            setDashboardMessage("Dashboard saved");
            await loadSavedDashboards();
        } catch (err) {
            console.error("DASHBOARD SAVE ERROR:", err);
            setDashboardMessage(err.message || "Unable to save dashboard");
        } finally {
            setDashboardLoading(false);
            window.setTimeout(() => setDashboardMessage(""), 2500);
        }
    }, [activeDashboardId, cardFilters, dashboardName, filters, loadSavedDashboards, visibleWidgets]);

    const filterSummary = useMemo(() => {
        const parts = FILTER_KEYS
            .filter((key) => filters[key])
            .map((key) => `${FILTER_LABELS[key]}: ${filters[key]}`);
        return parts.length ? parts.join("  •  ") : "All Locations";
    }, [filters]);

    // ─── TELEMETRY TIME LOGIC ───
    const { lastTelemetryTime, isLive } = useMemo(() => {
        if (!apiData || apiData.length === 0) {
            return { lastTelemetryTime: null, isLive: false };
        }

        let maxTime = 0;
        apiData.forEach((row) => {
            const ts = row.timestamp || row.ts || row.last_updated || row.time || row.created_at;
            if (ts) {
                const parsed = new Date(ts).getTime();
                if (!isNaN(parsed) && parsed > maxTime) {
                    maxTime = parsed;
                }
            }
        });

        if (maxTime === 0) {
            return { lastTelemetryTime: null, isLive: false };
        }

        // Live if within the last 60 seconds
        const isDataLive = Math.abs(Date.now() - maxTime) < 60000;
        return { lastTelemetryTime: maxTime, isLive: isDataLive };
    }, [apiData]);

    const lastTelemetryText = lastTelemetryTime
        ? new Date(lastTelemetryTime).toLocaleTimeString()
        : "--";

    return (
        <div className="organization-dashboard">
            <div className="organization-filter-card">
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "12px" }}>
                    <button
                        type="button"
                        onClick={saveDashboard}
                        disabled={dashboardLoading}
                        style={{
                            height: "36px",
                            border: "none",
                            borderRadius: "6px",
                            padding: "0 15px",
                            background: "#2563eb",
                            color: "white",
                            cursor: dashboardLoading ? "wait" : "pointer",
                            fontWeight: 600,
                        }}
                    >
                        {dashboardLoading ? "Saving..." : "Save Your Preferance"}
                    </button>

                    {dashboardMessage && (
                        <span style={{ fontSize: "12px", color: "#2563eb" }}>
                            {dashboardMessage}
                        </span>
                    )}
                </div>

                <FilterDashboard
                    initialValue={filters}
                    restoreVersion={restoreVersion}
                    allowedHierarchies={filterAccess.allowed}
                    lockedValues={filterAccess.lockedValues}
                    onFilterChange={handleFilterChange}
                    onReset={handleResetFilters}
                />

                <div className="filter-summary-bar">
                    <span className="filter-summary-text">{filterSummary}</span>

                    <span className="filter-last-updated">
                        <span 
                            className="last-updated-dot" 
                            style={{ backgroundColor: isLive ? "#22c55e" : "#9ca3af" }} 
                        />
                        {/* Show "LIVE" if live, otherwise just show the time */}
                        {isLive ? (
                            "LIVE"
                        ) : (
                            <strong style={{ marginLeft: "6px" }}>{lastTelemetryText}</strong>
                        )}
                    </span>
                </div>
            </div>

            {error && (
                <div className="organization-error">
                    <strong>Data API Error:</strong>
                    <span>{error}</span>
                </div>
            )}

            {loading && apiData.length === 0 ? (
                <div className="organization-loading">
                    <div className="loading-spinner"></div>
                    <span>Loading AC Energy Data...</span>
                </div>
            ) : (
                <ACDashboard
                    data={apiData}
                    filters={filters}
                    cardFilters={cardFilters}
                    visibleWidgets={visibleWidgets}
                    onCardFilterChange={handleCardFilterChange}
                    onWidgetVisibilityChange={(next) => setVisibleWidgets(applyRoleWidgetPermissions(currentUser?.role, next))}
                />
            )}
        </div>
    );
}

export default Org_Dashboard;