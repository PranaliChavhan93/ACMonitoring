import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, MapPin, Building2, Snowflake } from "lucide-react";
import "./Locations.css";

const API_BASE = "http://192.168.1.14:8000/api";

/* =========================================================
   AUTH
========================================================= */

const getToken = () =>
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("accessToken");

const authHeaders = () => {
    const token = getToken();
    return {
        "Content-Type": "application/json",
        ...(token
            ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` }
            : {}),
    };
};

/* =========================================================
   FETCH HELPER
========================================================= */

const fetchJSON = async (url, options = {}) => {
    const response = await fetch(url, {
        ...options,
        headers: { ...authHeaders(), ...(options.headers || {}) },
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            result?.message || result?.detail || result?.error || `HTTP ${response.status}`
        );
    }

    return result;
};

/* =========================================================
   HELPERS
========================================================= */

const normalize = (value) =>
    String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const displayValue = (value) => {
    if (
        value === null ||
        value === undefined ||
        value === "" ||
        value === "null" ||
        value === "undefined"
    ) {
        return "—";
    }
    return String(value);
};

/* =========================================================
   NORMALIZE 3TP SITE
========================================================= */

const normalizeSite = (site) => {
    const id =
        site?.tpt_site_id ?? site?.asset_id ?? site?.id?.id ?? site?.id ?? site?.uuid;
    const name = site?.name ?? site?.title ?? site?.label ?? "Unnamed Site";

    return {
        ...site,
        id,
        tptSiteId: id,
        name,

        code: site?.code ?? site?.site_code ?? site?.label ?? "",
        address: site?.address ?? "",

        hierarchyType: site?.hierarchy_type ?? site?.hierarchyType ?? "",

        stateName: site?.state_name ?? site?.state ?? "",
        districtName: site?.district_name ?? site?.district ?? "",
        talukaName: site?.taluka_name ?? site?.taluka ?? "",
        cityName: site?.city_name ?? site?.city ?? "",
        zoneName: site?.zone_name ?? site?.zone ?? "",
        circleName: site?.circle_name ?? site?.circle ?? "",
        regionName: site?.region_name ?? site?.region ?? "",
        divisionName: site?.division_name ?? site?.division ?? "",
        branchName: site?.branch_name ?? site?.branch ?? "",
        floorName: site?.floor_name ?? site?.floor ?? "",

        acs: Array.isArray(site?.acs)
            ? site.acs
            : Array.isArray(site?.devices)
            ? site.devices
            : [],

        source: "3TP",
    };
};

/* =========================================================
   COMPONENT
========================================================= */

const Locations = () => {
    const [sites, setSites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [showAddSite, setShowAddSite] = useState(false);

    const [search, setSearch] = useState("");
    const [hierarchyFilter, setHierarchyFilter] = useState("ALL");

    /* ---------------------------------------------------------
       LOAD SITES FROM 3TP
    --------------------------------------------------------- */

    const loadSites = async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);

            setError("");

            const data = await fetchJSON(
                `${API_BASE}/cloud/sites/?pageSize=1000&page=0`
            );

            const rawSites = Array.isArray(data?.sites)
                ? data.sites
                : Array.isArray(data?.data)
                ? data.data
                : Array.isArray(data?.results)
                ? data.results
                : [];

            const normalizedSites = rawSites
                .map(normalizeSite)
                .filter((site) => site.id != null);

            console.log("3TP SITES:", normalizedSites);
            setSites(normalizedSites);
        } catch (err) {
            console.error("3TP SITE API ERROR:", err);
            setError(err?.message || "Unable to load Sites from 3TP.");
            setSites([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadSites();
    }, []);

    /* ---------------------------------------------------------
       FILTERS
    --------------------------------------------------------- */

    const hierarchyOptions = useMemo(() => {
        const values = new Set();

        sites.forEach((site) => {
            const hierarchy = normalize(site.hierarchyType);
            if (hierarchy) values.add(hierarchy);
        });

        return Array.from(values);
    }, [sites]);

    const filteredSites = useMemo(() => {
        const query = normalize(search);

        return sites.filter((site) => {
            const matchesHierarchy =
                hierarchyFilter === "ALL" ||
                normalize(site.hierarchyType) === normalize(hierarchyFilter);

            if (!matchesHierarchy) return false;
            if (!query) return true;

            const searchableText = [
                site.name,
                site.code,
                site.address,
                site.stateName,
                site.districtName,
                site.talukaName,
                site.cityName,
                site.zoneName,
                site.circleName,
                site.regionName,
                site.divisionName,
                site.branchName,
                site.floorName,
                site.tptSiteId,
            ]
                .map(normalize)
                .join(" ");

            return searchableText.includes(query);
        });
    }, [sites, search, hierarchyFilter]);

    // SUMMARY

    const totalACs = useMemo(
        () =>
            sites.reduce(
                (total, site) =>
                    total + (Array.isArray(site.acs) ? site.acs.length : 0),
                0
            ),
        [sites]
    );

    const totalBranches = useMemo(
        () =>
            new Set(
                sites.map((site) => normalize(site.branchName)).filter(Boolean)
            ).size,
        [sites]
    );

    const totalStates = useMemo(
        () =>
            new Set(
                sites.map((site) => normalize(site.stateName)).filter(Boolean)
            ).size,
        [sites]
    );

    // CREATE SITE (modal submit)

    const handleCreateSite = async (event) => {
        event.preventDefault();

        const form = new FormData(event.currentTarget);

        const payload = {
            hierarchy_type: form.get("hierarchy_type"),
            branch_id: form.get("branch_id"),
            name: form.get("name"),
            code: form.get("code"),
            address: form.get("address"),
            pincode: form.get("pincode"),
            city: form.get("city"),
            district: form.get("district"),
            state: form.get("state"),
            latitude: form.get("latitude") ? Number(form.get("latitude")) : null,
            longitude: form.get("longitude") ? Number(form.get("longitude")) : null,
        };

        try {
            console.log("CREATE SITE PAYLOAD:", payload);

            await fetchJSON(`${API_BASE}/sites/create/`, {
                method: "POST",
                body: JSON.stringify(payload),
            });

            setShowAddSite(false);
            await loadSites(true);
        } catch (err) {
            console.error("CREATE SITE ERROR:", err);
            alert(err?.message || "Unable to create site.");
        }
    };


    if (loading) {
        return (
            <div className="locations-page">
                <div className="locations-loading">
                    <div className="locations-spinner" />
                    <span>Loading Sites from 3TP...</span>
                </div>
            </div>
        );
    }


    return (
        <div className="locations-page">
            {/* =================================================
                HEADER
            ================================================= */}
            <div className="locations-header">
                <div className="locations-title">
                    <h1>Sites</h1>
                    <p>Sites available in the cloud platform</p>
                </div>

                <div className="locations-header-actions">
                    <button
                        type="button"
                        className="refresh-btn"
                        onClick={() => loadSites(true)}
                        disabled={refreshing}
                    >
                        <RefreshCw
                            size={17}
                            className={refreshing ? "refresh-spinning" : ""}
                        />
                        {refreshing ? "Refreshing..." : "Refresh"}
                    </button>

                    <button
                        type="button"
                        className="add-site-btn"
                        onClick={() => setShowAddSite(true)}
                    >
                        + Add Site
                    </button>
                </div>
            </div>

            <div className="location-summary">
                <div className="summary-card">
                    <div className="summary-icon site-icon">
                        <MapPin size={21} />
                    </div>
                    <div className="summary-content">
                        <span>Total Sites</span>
                        <strong>{sites.length}</strong>
                    </div>
                </div>

                <div className="summary-card">
                    <div className="summary-icon branch-icon">
                        <Building2 size={21} />
                    </div>
                    <div className="summary-content">
                        <span>Branches</span>
                        <strong>{totalBranches}</strong>
                    </div>
                </div>

                <div className="summary-card">
                    <div className="summary-icon state-icon">
                        <MapPin size={21} />
                    </div>
                    <div className="summary-content">
                        <span>States</span>
                        <strong>{totalStates}</strong>
                    </div>
                </div>

                <div className="summary-card">
                    <div className="summary-icon ac-icon">
                        <Snowflake size={21} />
                    </div>
                    <div className="summary-content">
                        <span>AC Units</span>
                        <strong>{totalACs}</strong>
                    </div>
                </div>
            </div>

            {error && (
                <div className="location-error">
                    <strong>Unable to load 3TP sites</strong>
                    <span>{error}</span>
                </div>
            )}

            <div className="sites-card">
                {/* <div className="sites-card-header">
                    <div>
                        <h2>3TP Sites</h2>
                        <p>Showing sites received directly from the 3TP API</p>
                    </div>

                    <div className="sites-count">
                        {filteredSites.length}{" "}
                        {filteredSites.length === 1 ? "Site" : "Sites"}
                    </div>
                </div> */}

                <div className="sites-filter-bar">
                    <div className="search-box">
                        <Search size={18} />

                        <input
                            type="text"
                            placeholder="Search site, code, address, branch..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />

                        {search && (
                            <button
                                type="button"
                                className="clear-search"
                                onClick={() => setSearch("")}
                            >
                                ×
                            </button>
                        )}
                    </div>

                    <select
                        value={hierarchyFilter}
                        onChange={(event) => setHierarchyFilter(event.target.value)}
                        className="hierarchy-filter"
                    >
                        <option value="ALL">All Hierarchies</option>

                        {hierarchyOptions.map((hierarchy) => (
                            <option key={hierarchy} value={hierarchy}>
                                {hierarchy.replace(/\b\w/g, (char) =>
                                    char.toUpperCase()
                                )}
                            </option>
                        ))}
                    </select>
                </div>

                {/* =================================================
                    TABLE
                ================================================= */}
                <div className="sites-table-wrapper">
                    <table className="sites-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Site</th>
                                <th>Code</th>
                                <th>Hierarchy</th>
                                <th>Location</th>
                                <th>Branch</th>
                                <th>Floor</th>
                                <th>ACs</th>
                            </tr>
                        </thead>

                        <tbody>
                            {filteredSites.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="empty-sites">
                                        <div className="empty-sites-content">
                                            <MapPin size={35} />
                                            <strong>No sites found</strong>
                                            <span>
                                                {sites.length === 0
                                                    ? "No sites are currently available from 3TP."
                                                    : "Try changing your search or filter."}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredSites.map((site, index) => (
                                    <tr
                                        key={
                                            site.tptSiteId || site.id || index
                                        }
                                    >
                                        {/* NUMBER */}
                                        <td className="row-number">
                                            {index + 1}
                                        </td>

                                        {/* SITE */}
                                        <td>
                                            <div className="site-name-cell">
                                                <div className="site-avatar">
                                                    <MapPin size={16} />
                                                </div>
                                                <div>
                                                    <strong>
                                                        {displayValue(site.name)}
                                                    </strong>
                                                    <small>
                                                        ID:{" "}
                                                        {displayValue(
                                                            site.tptSiteId
                                                        )}
                                                    </small>
                                                </div>
                                            </div>
                                        </td>

                                        {/* CODE */}
                                        <td>
                                            <span className="code-badge">
                                                {displayValue(site.code)}
                                            </span>
                                        </td>

                                        {/* HIERARCHY */}
                                        <td>
                                            <span
                                                className={`hierarchy-badge ${
                                                    normalize(
                                                        site.hierarchyType
                                                    ) === "zonal"
                                                        ? "zonal"
                                                        : "geographical"
                                                }`}
                                            >
                                                {displayValue(
                                                    site.hierarchyType
                                                )}
                                            </span>
                                        </td>

                                        {/* LOCATION */}
                                        <td>
                                            <div className="location-cell">
                                                {site.cityName ||
                                                site.districtName ||
                                                site.stateName ? (
                                                    <>
                                                        <strong>
                                                            {displayValue(
                                                                site.cityName ||
                                                                    site.districtName
                                                            )}
                                                        </strong>
                                                        <small>
                                                            {[
                                                                site.districtName,
                                                                site.stateName,
                                                            ]
                                                                .filter(Boolean)
                                                                .join(", ")}
                                                        </small>
                                                    </>
                                                ) : (
                                                    <>
                                                        <strong>—</strong>
                                                        <small>
                                                            No hierarchy location
                                                        </small>
                                                    </>
                                                )}
                                            </div>
                                        </td>

                                        {/* BRANCH */}
                                        <td>{displayValue(site.branchName)}</td>

                                        {/* FLOOR */}
                                        <td>{displayValue(site.floorName)}</td>

                                        {/* ACS */}
                                        <td>
                                            <span className="ac-count">
                                                {Array.isArray(site.acs)
                                                    ? site.acs.length
                                                    : 0}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* =================================================
                    FOOTER
                ================================================= */}
                <div className="sites-card-footer">
                    <span>
                        Showing <strong>{filteredSites.length}</strong> of{" "}
                        <strong>{sites.length}</strong> sites
                    </span>

                    <span className="api-source">
                        Source: <strong>3TP</strong>
                    </span>
                </div>
            </div>

            {/* =================================================
                ADD SITE MODAL
            ================================================= */}
            {showAddSite && (
                <div className="site-modal-overlay">
                    <div className="site-modal">
                        <div className="site-modal-header">
                            <div>
                                <h2>Add Site</h2>
                                <p>Create a new site in 3TP</p>
                            </div>

                            <button
                                type="button"
                                className="modal-close-btn"
                                onClick={() => setShowAddSite(false)}
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleCreateSite}>
                            <div className="site-form-grid">
                                <div className="form-group">
                                    <label>Site Name *</label>
                                    <input
                                        name="name"
                                        type="text"
                                        placeholder="Enter site name"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Site Code *</label>
                                    <input
                                        name="code"
                                        type="text"
                                        placeholder="Enter site code"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Hierarchy Type *</label>
                                    <select
                                        name="hierarchy_type"
                                        defaultValue="GEOGRAPHICAL"
                                        required
                                    >
                                        <option value="GEOGRAPHICAL">
                                            Geographical
                                        </option>
                                        <option value="ZONAL">Zonal</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Branch ID *</label>
                                    <input
                                        name="branch_id"
                                        type="text"
                                        placeholder="Enter 3TP branch ID"
                                        required
                                    />
                                </div>

                                <div className="form-group full-width">
                                    <label>Address</label>
                                    <textarea
                                        name="address"
                                        placeholder="Enter site address"
                                        rows="3"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>State</label>
                                    <input
                                        name="state"
                                        type="text"
                                        placeholder="State"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>District</label>
                                    <input
                                        name="district"
                                        type="text"
                                        placeholder="District"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>City</label>
                                    <input
                                        name="city"
                                        type="text"
                                        placeholder="City"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Pincode</label>
                                    <input
                                        name="pincode"
                                        type="text"
                                        placeholder="Pincode"
                                        maxLength="6"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Latitude</label>
                                    <input
                                        name="latitude"
                                        type="number"
                                        step="any"
                                        placeholder="Latitude"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Longitude</label>
                                    <input
                                        name="longitude"
                                        type="number"
                                        step="any"
                                        placeholder="Longitude"
                                    />
                                </div>
                            </div>

                            <div className="site-modal-footer">
                                <button
                                    type="button"
                                    className="cancel-btn"
                                    onClick={() => setShowAddSite(false)}
                                >
                                    Cancel
                                </button>

                                <button type="submit" className="save-site-btn">
                                    Create Site
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Locations;