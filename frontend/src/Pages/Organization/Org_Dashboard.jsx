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

const API_BASE = "http://192.168.1.14:8000/api";
const API_URL = `${API_BASE}/ac-data/`;
const DASHBOARD_URL = `${API_BASE}/dashboard/preferences/`;

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
];

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
};

const EMPTY_FILTERS = {
    hierarchy: "GEOGRAPHICAL",
    ...Object.fromEntries(FILTER_KEYS.map((key) => [key, ""])),
};

const DEFAULT_WIDGETS = {
    total_acs: true,
    active_acs: true,
    total_energy: true,
    active_energy: true,
    active_power: true,
    temperature: true,
    humidity: true,
    alerts: true,
    energy_chart: true,
    power_chart: true,
    temperature_chart: true,
    humidity_chart: true,
    health_chart: true,
    zone_chart: true,
    energy_map: true,
    ac_table: true,
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
        ...(token
            ? {
                  Authorization: token.startsWith("Token ")
                      ? token
                      : `Token ${token}`,
              }
            : {}),
    };
};

const normalizeResponse = (result) => {
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.data)) return result.data;
    if (result && Array.isArray(result.results)) return result.results;
    return [];
};

const normalizeFilters = (input = {}) => ({
    hierarchy: input?.hierarchy || "GEOGRAPHICAL",
    ...Object.fromEntries(
        FILTER_KEYS.map((key) => [key, input?.[key] || ""])
    ),
});

function Org_Dashboard() {
    // IMPORTANT: hooks must run inside the component body.
    const { user: currentUser } = useAuth();

    // Restrict hierarchy/filter scope based on the logged-in user.
    const filterAccess = useMemo(() => {
        const role = currentUser?.role;
        const hierarchy = currentUser?.customer_hierarchy_type;

        if (role === "CUSTOMER" || role === "BR_ADMIN" || role === "ENGINEER") {
            const allowed = hierarchy === "ZONAL"
                ? ["ZONAL"]
                : hierarchy === "GEOGRAPHICAL"
                    ? ["GEOGRAPHICAL"]
                    : [];

            const lockedValues = {};

            // Admin/engineer can only work inside their assigned top-level scope.
            if (role === "BR_ADMIN" || role === "ENGINEER") {
                if (hierarchy === "ZONAL" && currentUser?.zone_name) {
                    lockedValues.zone = currentUser.zone_name;
                }
                if (hierarchy === "GEOGRAPHICAL" && currentUser?.state_name) {
                    lockedValues.state = currentUser.state_name;
                }
            }

            return { allowed, lockedValues };
        }

        return {
            allowed: ["GEOGRAPHICAL", "ZONAL"],
            lockedValues: {},
        };
    }, [currentUser]);

    const [apiData, setApiData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [lastUpdated, setLastUpdated] = useState(null);

    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [cardFilters, setCardFilters] = useState({});
    const [visibleWidgets, setVisibleWidgets] = useState(DEFAULT_WIDGETS);

    const [savedDashboards, setSavedDashboards] = useState([]);
    const [activeDashboardId, setActiveDashboardId] = useState(null);
    const [dashboardName, setDashboardName] = useState("My Dashboard");
    const [dashboardLoading, setDashboardLoading] = useState(false);
    const [dashboardMessage, setDashboardMessage] = useState("");
    const [restoreVersion, setRestoreVersion] = useState(0);

    const loadSavedDashboards = useCallback(async () => {
        try {
            const response = await fetch(DASHBOARD_URL, {
                method: "GET",
                headers: authHeaders(),
                cache: "no-store",
            });

            if (response.status === 401) {
                throw new Error("Session expired. Please login again.");
            }

            if (!response.ok) {
                throw new Error(`Dashboard API HTTP ${response.status}`);
            }

            const result = await response.json();
            const dashboards = normalizeResponse(result);

            setSavedDashboards(dashboards);

            const defaultDashboard =
                dashboards.find((item) => item.is_default) || dashboards[0];

            if (defaultDashboard) {
                setActiveDashboardId(defaultDashboard.id);
                setDashboardName(defaultDashboard.name || "My Dashboard");
                setFilters(normalizeFilters(defaultDashboard.main_filters));
                setCardFilters(defaultDashboard.card_filters || {});
                setVisibleWidgets({
                    ...DEFAULT_WIDGETS,
                    ...(defaultDashboard.visible_widgets || {}),
                });
                setRestoreVersion((value) => value + 1);
            }
        } catch (err) {
            console.error("DASHBOARD PREFERENCE LOAD ERROR:", err);
        }
    }, []);

    useEffect(() => {
        loadSavedDashboards();
    }, [loadSavedDashboards]);

    const fetchACData = useCallback(async () => {
        try {
            setLoading(true);

            const params = new URLSearchParams();

            if (filters.hierarchy) {
                params.append("hierarchy", filters.hierarchy);
            }

            FILTER_KEYS.forEach((key) => {
                const value = filters[key];
                if (value) params.append(key, value);
            });

            params.append("t", Date.now());

            const url = `${API_URL}?${params.toString()}`;
            console.log("FILTERED API URL:", url);

            const response = await fetch(url, {
                method: "GET",
                cache: "no-store",
                headers: authHeaders(),
            });

            if (response.status === 401) {
                throw new Error("401 Unauthorized. Please login again.");
            }

            if (!response.ok) {
                throw new Error("3TP Error");
            }

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
        fetchACData();
        const interval = setInterval(fetchACData, 2000);
        return () => clearInterval(interval);
    }, [fetchACData]);

    const handleFilterChange = useCallback((newFilters) => {
        const nextFilters = normalizeFilters(newFilters);
        console.log("SELECTED FILTERS:", nextFilters);
        setFilters(nextFilters);
    }, []);

    const handleResetFilters = useCallback(() => {
        const hierarchy = filterAccess.allowed[0] || EMPTY_FILTERS.hierarchy;
        const scoped = {
            hierarchy,
            ...Object.fromEntries(FILTER_KEYS.map((key) => [
                key, filterAccess.lockedValues?.[key] || "",
            ])),
        };
        setFilters(scoped);
        setCardFilters({});
        setRestoreVersion((value) => value + 1);
    }, [filterAccess]);

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
            const url = isUpdate
                ? `${DASHBOARD_URL}${activeDashboardId}/`
                : DASHBOARD_URL;

            const response = await fetch(url, {
                method: isUpdate ? "PATCH" : "POST",
                headers: authHeaders(),
                body: JSON.stringify(payload),
            });

            if (response.status === 401) {
                throw new Error("Session expired. Please login again.");
            }

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
    }, [
        activeDashboardId,
        cardFilters,
        dashboardName,
        filters,
        loadSavedDashboards,
        visibleWidgets,
    ]);

    const createNewDashboard = useCallback(() => {
        setActiveDashboardId(null);
        setDashboardName("My Dashboard");
        setFilters(EMPTY_FILTERS);
        setCardFilters({});
        setVisibleWidgets(DEFAULT_WIDGETS);
        setRestoreVersion((value) => value + 1);
        setDashboardMessage("New dashboard");
    }, []);

    const loadDashboard = useCallback((dashboard) => {
        setActiveDashboardId(dashboard.id);
        setDashboardName(dashboard.name || "My Dashboard");
        setFilters(normalizeFilters(dashboard.main_filters));
        setCardFilters(dashboard.card_filters || {});
        setVisibleWidgets({
            ...DEFAULT_WIDGETS,
            ...(dashboard.visible_widgets || {}),
        });
        setRestoreVersion((value) => value + 1);
        setDashboardMessage(`Loaded ${dashboard.name}`);
        window.setTimeout(() => setDashboardMessage(""), 2000);
    }, []);

    const filterSummary = useMemo(() => {
        const parts = FILTER_KEYS
            .filter((key) => filters[key])
            .map((key) => `${FILTER_LABELS[key]}: ${filters[key]}`);

        return parts.length ? parts.join("  •  ") : "All Locations";
    }, [filters]);

    const lastUpdatedText = lastUpdated
        ? lastUpdated.toLocaleTimeString()
        : "--";

    return (
        <div className="organization-dashboard">
            <div className="organization-filter-card">
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        flexWrap: "wrap",
                        marginBottom: "12px",
                    }}
                >
                    {/* <select
                        value={activeDashboardId || ""}
                        onChange={(event) => {
                            const id = event.target.value;
                            const selectedDashboard = savedDashboards.find(
                                (item) => String(item.id) === String(id)
                            );
                            if (selectedDashboard) loadDashboard(selectedDashboard);
                        }}
                        style={{
                            height: "36px",
                            border: "1px solid #d1d5db",
                            borderRadius: "6px",
                            padding: "0 10px",
                            minWidth: "190px",
                        }}
                    >
                        <option value="">Select saved dashboard</option>
                        {savedDashboards.map((dashboard) => (
                            <option key={dashboard.id} value={dashboard.id}>
                                {dashboard.name}
                            </option>
                        ))}
                    </select> */}

                    {/* <input
                        value={dashboardName}
                        onChange={(event) => setDashboardName(event.target.value)}
                        placeholder="Dashboard name"
                        style={{
                            height: "36px",
                            border: "1px solid #d1d5db",
                            borderRadius: "6px",
                            padding: "0 10px",
                            minWidth: "180px",
                        }}
                    /> */}

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
                        {dashboardLoading ? "Saving..." : "Save Dashboard"}
                    </button>

                    {/* <button
                        type="button"
                        onClick={createNewDashboard}
                        style={{
                            height: "36px",
                            border: "1px solid #d1d5db",
                            borderRadius: "6px",
                            padding: "0 15px",
                            background: "white",
                            cursor: "pointer",
                        }}
                    >
                        New
                    </button> */}

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
                        <span className="last-updated-dot" />
                        Last updated: <strong>{lastUpdatedText}</strong>
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
                    onWidgetVisibilityChange={setVisibleWidgets}
                />
            )}
        </div>
    );
}

export default Org_Dashboard;
