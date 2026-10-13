import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, MapPin, Building2, Snowflake } from "lucide-react";
import "./Locations.css";

const API_BASE = "http://192.168.1.8:8000/api";
const FILTER_LOCATIONS_URL = `${API_BASE}/v1/filters/locations/`;

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

const fetchJSON = async (url, options = {}) => {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...authHeaders(),
            ...(options.headers || {}),
        },
    });

    const rawResponse = await response.text();

    let result = {};
    try {
        result = rawResponse ? JSON.parse(rawResponse) : {};
    } catch {
        result = { raw_response: rawResponse };
    }

    if (!response.ok) {
        console.error("API REQUEST FAILED:", {
            url,
            status: response.status,
            requestBody: options.body
                ? JSON.parse(options.body)
                : null,
            response: result,
        });

        throw new Error(
            result?.message ||
            result?.detail ||
            result?.error ||
            result?.raw_response ||
            `HTTP ${response.status}`
        );
    }

    return result;
};

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

const SITE_HIERARCHY_CONFIG = {
    GEOGRAPHICAL: [
        { name: "state", id: "state_id", field: "state_name", children: "districts" },
        { name: "district", id: "district_id", field: "district_name", children: "talukas" },
        { name: "taluka", id: "taluka_id", field: "taluka_name", children: "cities" },
        { name: "city", id: "city_id", field: "city_name", children: "branches" },
        { name: "branch", id: "branch_id", field: "branch_name", children: "floors" },
        { name: "floor", id: "floor_id", field: "floor_name", children: "sites" },
    ],

    ZONAL: [
        { name: "zone", id: "zone_id", field: "zone_name", children: "circles" },
        { name: "circle", id: "circle_id", field: "circle_name", children: "regions" },
        { name: "region", id: "region_id", field: "region_name", children: "divisions" },
        { name: "division", id: "division_id", field: "division_name", children: "branches" },
        { name: "branch", id: "branch_id", field: "branch_name", children: "floors" },
        { name: "floor", id: "floor_id", field: "floor_name", children: "sites" },
    ],
};

const getNodeId = (node, level) =>
    String(
        node?.[`${level}_id`] ??
        node?.id?.id ??
        node?.id ??
        node?.uuid ??
        ""
    );

const getNodeName = (node, field) =>
    String(
        node?.[field] ??
        node?.name ??
        node?.title ??
        ""
    );


const Locations = () => {
    const [sites, setSites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [showAddSite, setShowAddSite] = useState(false);

    const [search, setSearch] = useState("");
    const [hierarchyFilter, setHierarchyFilter] = useState("ALL");
    
    const [currentUser, setCurrentUser] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState("");
    const [customerHierarchy, setCustomerHierarchy] = useState("");
    const [customerLocationTree, setCustomerLocationTree] = useState([]);
    const EMPTY_HIERARCHY_SELECTION = {
        state: "",
        district: "",
        taluka: "",
        city: "",
        zone: "",
        circle: "",
        region: "",
        division: "",
    };

    const [hierarchySelection, setHierarchySelection] = useState({
        ...EMPTY_HIERARCHY_SELECTION,
    });

    const [hierarchyOptions, setHierarchyOptions] = useState({
        states: [],
        districts: [],
        talukas: [],
        cities: [],
        zones: [],
        circles: [],
        regions: [],
        divisions: [],
        branches: [],
        floors: [],
    });



    const [branchMode, setBranchMode] = useState("existing");
    const [selectedBranch, setSelectedBranch] = useState("");
    const [newBranchName, setNewBranchName] = useState("");
    const [newBranchCode, setNewBranchCode] = useState("");

    const [siteForm, setSiteForm] = useState({
        name: "",
        code: "",
        address: "",
        pincode: "",
        latitude: "",
        longitude: "",
    });

    const [createFloors, setCreateFloors] = useState(false);
    const [floorCount, setFloorCount] = useState(1);
    const [floorNames, setFloorNames] = useState(["Floor 1"]);

    const [siteSaving, setSiteSaving] = useState(false);
    const [siteError, setSiteError] = useState("");
    const [siteSuccess, setSiteSuccess] = useState("");
    const [customerLoading, setCustomerLoading] = useState(false);


    // LOAD SITES FROM 3TP
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
    
    const getList = (response) => {
        if (Array.isArray(response)) return response;
        if (Array.isArray(response?.results)) return response.results;
        if (Array.isArray(response?.data)) return response.data;
        if (Array.isArray(response?.customers)) return response.customers;
        if (Array.isArray(response?.branches)) return response.branches;
        return [];
    };

    const getItemId = (item) =>
        String(item?.id ?? item?.uuid ?? item?.pk ?? "");

    const getItemLabel = (item) =>
        item?.name ??
        item?.title ??
        item?.city_name ??
        item?.state_name ??
        item?.company_name ??
        item?.company ??
        item?.customer_name ??
        item?.code ??
        getItemId(item);

    const EMPTY_HIERARCHY_OPTIONS = {
        states: [],
        districts: [],
        talukas: [],
        cities: [],
        zones: [],
        circles: [],
        regions: [],
        divisions: [],
        branches: [],
        floors: [],
    };


    useEffect(() => {
        loadSites();
    }, []);

    
    useEffect(() => {
        let cancelled = false;

        const loadCustomerContext = async () => {
            setCustomerLoading(true);
            setSiteError("");

            try {
                const userResponse = await fetchJSON(`${API_BASE}/auth/me/`);
                const user = userResponse?.user ??
                    userResponse?.data ??
                    userResponse;

                if (cancelled) return;

                setCurrentUser(user);

                const role = String(user?.role ?? user?.user_role ?? "")
                    .toUpperCase();

                if (role === "CUSTOMER") {
                    const customerId =
                        user?.customer_id ??
                        user?.customer?.id ??
                        user?.customer;

                    if (!customerId) {
                        throw new Error(
                            "Your login is not linked to a customer. Please contact the administrator."
                        );
                    }

                    setSelectedCustomer(String(customerId));
                    return;
                }

                if (role === "ORG_SUPER_ADMIN") {
                    const customerResponse = await fetchJSON(
                        `${API_BASE}/customers/`
                    );

                    if (cancelled) return;

                    const list = getList(customerResponse);
                    setCustomers(list);
                } else {
                    throw new Error(
                        "Your account does not have permission to create a site here."
                    );
                }
            } catch (error) {
                if (!cancelled) {
                    setSiteError(
                        error?.message ||
                        "Unable to load your customer information."
                    );
                }
            } finally {
                if (!cancelled) setCustomerLoading(false);
            }
        };

        loadCustomerContext();

        return () => {
            cancelled = true;
        };
    }, []);
    
    useEffect(() => {
        if (!selectedCustomer) {
            setCustomerHierarchy("");
            setHierarchyOptions(EMPTY_HIERARCHY_OPTIONS);
            setHierarchySelection(EMPTY_HIERARCHY_SELECTION);
            return;
        }

        let cancelled = false;

        const loadCustomerHierarchy = async () => {
            setSiteError("");

            try {
                const response = await fetchJSON(
                    `${API_BASE}/customers/${encodeURIComponent(selectedCustomer)}/`
                );

                const customer = response?.customer ??
                    response?.data ??
                    response;

                const type = String(customer?.hierarchy_type ?? "")
                    .toUpperCase();

                if (type !== "GEOGRAPHICAL" && type !== "ZONAL") {
                    throw new Error(
                        "The selected customer has no valid hierarchy type configured."
                    );
                }

                if (cancelled) return;

                setCustomerHierarchy(type);
                setHierarchySelection(EMPTY_HIERARCHY_SELECTION);
                setHierarchyOptions(EMPTY_HIERARCHY_OPTIONS);
                setSelectedBranch("");
            } catch (error) {
                if (!cancelled) {
                    setCustomerHierarchy("");
                    setSiteError(
                        error?.message ||
                        "Unable to load the customer's hierarchy."
                    );
                }
            }
        };

        loadCustomerHierarchy();

        return () => {
            cancelled = true;
        };
    }, [selectedCustomer]);

    // FILTERS

    const hierarchyFilterOptions = useMemo(() => {
        const values = new Set();

        sites.forEach((site) => {
            const hierarchy = normalize(site.hierarchyType);
            if (hierarchy) {
                values.add(hierarchy);
            }
        });

        return Array.from(values);
    }, [sites]);

    // const loadHierarchyList = async (key, endpoint) => {
    //     try {
    //         const response = await fetchJSON(`${API_BASE}/${endpoint}`);
    //         setHierarchyOptions((previous) => ({
    //             ...previous,
    //             [key]: getList(response),
    //         }));
    //     } catch (error) {
    //         setSiteError(
    //             error?.message || `Unable to load ${key}.`
    //         );
    //     }
    // };

    const handleHierarchyChange = (level, value) => {
        const config = SITE_HIERARCHY_CONFIG[customerHierarchy] || [];
        const selectedIndex = config.findIndex(
            (item) => item.name === level
        );

        if (selectedIndex === -1) return;

        setHierarchySelection((previous) => {
            const next = {
                ...previous,
                [level]: value,
            };

            // Clear all descendants when a parent changes.
            for (let i = selectedIndex + 1; i < config.length; i++) {
                next[config[i].name] = "";
            }

            return next;
        });

        setSelectedBranch("");
    };
    
    useEffect(() => {
        if (!selectedCustomer || !customerHierarchy) {
            setCustomerLocationTree([]);
            setHierarchyOptions(EMPTY_HIERARCHY_OPTIONS);
            return;
        }

        let cancelled = false;

        const loadCustomerLocationTree = async () => {
            setSiteError("");

            try {
                const token = getToken();

                const headers = {
                    Accept: "application/json",
                    ...(token
                        ? {
                            Authorization: token.startsWith("Token ")
                                ? token
                                : `Token ${token}`,
                        }
                        : {}),
                };

                const params = new URLSearchParams({
                    hierarchy: customerHierarchy,
                    customer_id: selectedCustomer,
                    t: String(Date.now()),
                });

                const response = await fetch(
                    `${FILTER_LOCATIONS_URL}?${params.toString()}`,
                    {
                        method: "GET",
                        headers,
                        cache: "no-store",
                    }
                );

                const result = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(
                        result?.message ||
                        result?.detail ||
                        `HTTP ${response.status}`
                    );
                }

                if (cancelled) return;

                const locations = Array.isArray(result?.data)
                    ? result.data
                    : [];

                setCustomerLocationTree(locations);

                setHierarchySelection(EMPTY_HIERARCHY_SELECTION);
                setSelectedBranch("");

                setHierarchyOptions(EMPTY_HIERARCHY_OPTIONS);

                if (!locations.length) {
                    setSiteError(
                        "No hierarchy locations were returned for this customer."
                    );
                }
            } catch (error) {
                if (!cancelled) {
                    console.error("CUSTOMER HIERARCHY API ERROR:", error);
                    setCustomerLocationTree([]);
                    setSiteError(
                        error?.message || "Unable to load customer hierarchy."
                    );
                }
            }
        };

        loadCustomerLocationTree();

        return () => {
            cancelled = true;
        };
    }, [selectedCustomer, customerHierarchy]);
    
    // useEffect(() => {
    //     if (!selectedCustomer || !customerHierarchy) return;

    //     const parentId =
    //         customerHierarchy === "GEOGRAPHICAL"
    //             ? hierarchySelection.city
    //             : hierarchySelection.division;

    //     if (!parentId) {
    //         setHierarchyOptions((previous) => ({
    //             ...previous,
    //             branches: [],
    //         }));
    //         setSelectedBranch("");
    //         return;
    //     }

    //     let cancelled = false;

    //     const loadBranches = async () => {
    //         try {
    //             const response = await fetchJSON(
    //                 `${API_BASE}/branches/?customer=${encodeURIComponent(selectedCustomer)}`
    //             );

    //             const allBranches = getList(response);

    //             const filtered = allBranches.filter((branch) => {
    //                 const relationId =
    //                     customerHierarchy === "GEOGRAPHICAL"
    //                         ? branch?.city_id ?? branch?.city?.id ?? branch?.city
    //                         : branch?.division_id ??
    //                         branch?.division?.id ??
    //                         branch?.division;

    //                 return String(relationId ?? "") === String(parentId);
    //             });

    //             if (cancelled) return;

    //             setHierarchyOptions((previous) => ({
    //                 ...previous,
    //                 branches: filtered,
    //             }));
    //         } catch (error) {
    //             if (!cancelled) {
    //                 setSiteError(
    //                     error?.message || "Unable to load branches."
    //                 );
    //             }
    //         }
    //     };

    //     loadBranches();

    //     return () => {
    //         cancelled = true;
    //     };
    // }, [
    //     selectedCustomer,
    //     customerHierarchy,
    //     hierarchySelection.city,
    //     hierarchySelection.division,
    // ]);

    const handleFloorCountChange = (value) => {
        const count = Math.min(10, Math.max(1, Number(value) || 1));

        setFloorCount(count);
        setFloorNames((previous) =>
            Array.from(
                { length: count },
                (_, index) => previous[index] || `Floor ${index + 1}`
            )
        );
    };

    const resetSiteCreationForm = () => {
        setHierarchySelection(EMPTY_HIERARCHY_SELECTION);
        setSelectedBranch("");
        setBranchMode("existing");
        setNewBranchName("");
        setNewBranchCode("");

        setSiteForm({
            name: "",
            code: "",
            address: "",
            pincode: "",
            latitude: "",
            longitude: "",
        });

        setCreateFloors(false);
        setFloorCount(1);
        setFloorNames(["Floor 1"]);
        setSiteError("");
        setSiteSuccess("");
    };

    const handleCreateSite = async (event) => {
        event.preventDefault();
        setSiteError("");
        setSiteSuccess("");

        if (!selectedCustomer || !customerHierarchy) {
            setSiteError("Select a valid customer before creating the site.");
            return;
        }

        const parentId =
            customerHierarchy === "GEOGRAPHICAL"
                ? hierarchySelection.city
                : hierarchySelection.division;

        if (!parentId) {
            setSiteError(
                customerHierarchy === "GEOGRAPHICAL"
                    ? "Select State, District, Taluka, and City."
                    : "Select Zone, Circle, Region, and Division."
            );
            return;
        }

        if (branchMode === "existing" && !selectedBranch) {
            setSiteError("Select a branch.");
            return;
        }

        if (branchMode === "new" && !newBranchName.trim()) {
            setSiteError("Enter a branch name.");
            return;
        }

        if (!siteForm.name.trim() || !siteForm.code.trim()) {
            setSiteError("Site name and site code are required.");
            return;
        }

        if (siteForm.pincode && !/^\d{6}$/.test(siteForm.pincode)) {
            setSiteError("Enter a valid 6-digit pincode.");
            return;
        }

        const payload = {
            customer_id: selectedCustomer,
            hierarchy_type: customerHierarchy,

            create_branch: branchMode === "new",
            branch_id: branchMode === "existing" ? selectedBranch : null,
            branch_name: branchMode === "new" ? newBranchName.trim() : "",
            branch_code: branchMode === "new" ? newBranchCode.trim() : "",

            state_id: hierarchySelection.state || null,
            district_id: hierarchySelection.district || null,
            taluka_id: hierarchySelection.taluka || null,
            city_id: hierarchySelection.city || null,

            zone_id: hierarchySelection.zone || null,
            circle_id: hierarchySelection.circle || null,
            region_id: hierarchySelection.region || null,
            division_id: hierarchySelection.division || null,

            name: siteForm.name.trim(),
            code: siteForm.code.trim(),
            address: siteForm.address.trim(),
            pincode: siteForm.pincode.trim(),
            latitude: siteForm.latitude
                ? Number(siteForm.latitude)
                : null,
            longitude: siteForm.longitude
                ? Number(siteForm.longitude)
                : null,

            create_floors: createFloors,
            floor_names: createFloors
                ? floorNames.map((name) => name.trim())
                : [],
        };

        if (createFloors && floorNames.some((name) => !name.trim())) {
            setSiteError("Every floor must have a name.");
            return;
        }

        try {
            setSiteSaving(true);

            await fetchJSON(`${API_BASE}/hierarchy-site/create/`, {
                method: "POST",
                body: JSON.stringify(payload),
            });

            setSiteSuccess("Site created successfully.");
            resetSiteCreationForm();
            setShowAddSite(false);

            // Keep your existing site list refresh logic.
            await loadSites(true);
        } catch (error) {
            setSiteError(
                error?.message || "Unable to create the site."
            );
        } finally {
            setSiteSaving(false);
        }
    };

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

    if (loading) {
        return (
            <div className="locations-page">
                <div className="locations-loading">
                    <div className="locations-spinner" />
                    <span>Loading Sites...</span>
                </div>
            </div>
        );
    }

    const getHierarchyOptions = (targetLevel) => {
        const config = SITE_HIERARCHY_CONFIG[customerHierarchy];

        if (!config || !customerLocationTree.length) {
            return [];
        }

        const firstChildrenKey =
            customerHierarchy === "GEOGRAPHICAL" ? "states" : "zones";

        let nodes = customerLocationTree;

        // Support both a country-wrapped response and a response
        // that starts directly with states or zones.
        const countryNode = nodes.find(
            (node) =>
                String(node?.country_name ?? "")
                    .trim()
                    .toLowerCase() === "india"
        );

        if (countryNode?.[firstChildrenKey]) {
            nodes = countryNode[firstChildrenKey];
        } else if (nodes.some((node) => Array.isArray(node?.[firstChildrenKey]))) {
            nodes =
                nodes.find((node) => Array.isArray(node?.[firstChildrenKey]))
                    ?.[firstChildrenKey] || [];
        }

        for (const level of config) {
            if (level.name === targetLevel) {
                return Array.isArray(nodes) ? nodes : [];
            }

            const selectedId = hierarchySelection[level.name];

            if (!selectedId) {
                return [];
            }

            const selectedNode = nodes.find(
                (node) => getNodeId(node, level.name) === String(selectedId)
            );

            if (!selectedNode) {
                return [];
            }

            nodes = selectedNode[level.children] || [];
        }

        return [];
    };

    return (
        <div className="locations-page">
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
                        onClick={() => {
                            resetSiteCreationForm();
                            setShowAddSite(true);
                        }}
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

                    {/* <select
                        value={hierarchyFilter}
                        onChange={(event) => setHierarchyFilter(event.target.value)}
                        className="hierarchy-filter"
                    >
                        <option value="ALL">All Hierarchies</option>                        
                        {hierarchyFilterOptions.map((hierarchy) => (
                            <option key={hierarchy} value={hierarchy}>
                                {hierarchy.replace(/\b\w/g, (char) =>
                                    char.toUpperCase()
                                )}
                            </option>
                        ))}

                    </select> */}
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

            {/* ADD SITE MODAL */}
            {showAddSite && (
                <div className="site-modal-overlay">
                    <div className="site-modal hierarchy-site-modal">
                        <div className="site-modal-header">
                            <div>
                                <h2>Create Site & Hierarchy</h2>
                                <p>
                                    Select the customer hierarchy, branch, site, and optional floors.
                                </p>
                            </div>

                            <button
                                type="button"
                                className="modal-close-btn"
                                disabled={siteSaving}
                                onClick={() => setShowAddSite(false)}
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleCreateSite}>
                            <div className="site-form-grid">
                                {/* CUSTOMER */}
                                {String(
                                    currentUser?.role ?? currentUser?.user_role ?? ""
                                ).toUpperCase() === "ORG_SUPER_ADMIN" && (
                                    <div className="form-group full-width">
                                        <label>Customer *</label>
                                        <select
                                            value={selectedCustomer}
                                            onChange={(event) => {
                                                const customerId = event.target.value;

                                                resetSiteCreationForm();
                                                setCustomerLocationTree([]);
                                                setCustomerHierarchy("");
                                                setSelectedCustomer(customerId);
                                            }}
                                            required
                                        >
                                            <option value="">Select customer</option>
                                            {customers.map((customer) => (
                                                <option
                                                    key={getItemId(customer)}
                                                    value={getItemId(customer)}
                                                >
                                                    {getItemLabel(customer)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {customerLoading && (
                                    <div className="form-group full-width">
                                        <span>Loading customer information...</span>
                                    </div>
                                )}

                                {/* CONFIGURED HIERARCHY TYPE */}
                                {selectedCustomer && customerHierarchy && (
                                    <div className="form-group full-width">
                                        <label>Configured Hierarchy</label>
                                        <input
                                            value={
                                                customerHierarchy === "GEOGRAPHICAL"
                                                    ? "Geographical: State → District → Taluka → City"
                                                    : "Zonal: Zone → Circle → Region → Division"
                                            }
                                            readOnly
                                        />
                                    </div>
                                )}

                                {/* GEOGRAPHICAL PATH */}
                                {customerHierarchy === "GEOGRAPHICAL" && (
                                    <>
                                        <div className="form-group">
                                            <label>State *</label>

                                            <select
                                                value={hierarchySelection.state}
                                                onChange={(e) =>
                                                    handleHierarchyChange("state", e.target.value)
                                                }
                                                required
                                            >
                                                <option value="">Select state</option>

                                                {getHierarchyOptions("state").map((item) => (
                                                    <option
                                                        key={getNodeId(item, "state")}
                                                        value={getNodeId(item, "state")}
                                                    >
                                                        {getNodeName(item, "state_name")}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="form-group">
                                            <label>District *</label>

                                            <select
                                                value={hierarchySelection.district}
                                                onChange={(e) =>
                                                    handleHierarchyChange("district", e.target.value)
                                                }
                                                required
                                            >
                                                <option value="">Select District</option>

                                                {getHierarchyOptions("district").map((item) => (
                                                    <option
                                                        key={getNodeId(item, "district")}
                                                        value={getNodeId(item, "district")}
                                                    >
                                                        {getNodeName(item, "district_name")}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="form-group">
                                            <label>Taluka *</label>
                                            <select
                                                value={hierarchySelection.taluka}
                                                onChange={(e) =>
                                                    handleHierarchyChange("taluka", e.target.value)
                                                }
                                                required
                                            >
                                                <option value="">Select Taluka</option>

                                                {getHierarchyOptions("taluka").map((item) => (
                                                    <option
                                                        key={getNodeId(item, "taluka")}
                                                        value={getNodeId(item, "taluka")}
                                                    >
                                                        {getNodeName(item, "taluka_name")}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="form-group">
                                            <label>City *</label>
                                            <select
                                                value={hierarchySelection.city}
                                                onChange={(e) =>
                                                    handleHierarchyChange("city", e.target.value)
                                                }
                                                required
                                            >
                                                <option value="">Select City</option>

                                                {getHierarchyOptions("city").map((item) => (
                                                    <option
                                                        key={getNodeId(item, "city")}
                                                        value={getNodeId(item, "city")}
                                                    >
                                                        {getNodeName(item, "city_name")}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </>
                                )}

                                {/* ZONAL PATH */}
                                {customerHierarchy === "ZONAL" && (
                                    <>
                                        <div className="form-group">
                                            <label>Zone *</label>
                                            <select
                                                value={hierarchySelection.zone}
                                                onChange={(e) =>
                                                    handleHierarchyChange("zone", e.target.value)
                                                }
                                                required
                                            >
                                                <option value="">Select Zone</option>

                                                {getHierarchyOptions("zone").map((item) => (
                                                    <option
                                                        key={getNodeId(item, "zone")}
                                                        value={getNodeId(item, "zone")}
                                                    >
                                                        {getNodeName(item, "zone_name")}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="form-group">
                                            <label>Circle *</label>
                                            <select
                                                value={hierarchySelection.circle}
                                                onChange={(e) =>
                                                    handleHierarchyChange("circle", e.target.value)
                                                }
                                                required
                                            >
                                                <option value="">Select Circle</option>

                                                {getHierarchyOptions("circle").map((item) => (
                                                    <option
                                                        key={getNodeId(item, "circle")}
                                                        value={getNodeId(item, "circle")}
                                                    >
                                                        {getNodeName(item, "circle_name")}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="form-group">
                                            <label>Region *</label>
                                            <select
                                                value={hierarchySelection.region}
                                                onChange={(e) =>
                                                    handleHierarchyChange("region", e.target.value)
                                                }
                                                required
                                            >
                                                <option value="">Select Region</option>

                                                {getHierarchyOptions("region").map((item) => (
                                                    <option
                                                        key={getNodeId(item, "region")}
                                                        value={getNodeId(item, "region")}
                                                    >
                                                        {getNodeName(item, "region_name")}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="form-group">
                                            <label>Division *</label>
                                            <select
                                                value={hierarchySelection.division}
                                                onChange={(e) =>
                                                    handleHierarchyChange("division", e.target.value)
                                                }
                                                required
                                            >
                                                <option value="">Select Division</option>

                                                {getHierarchyOptions("division").map((item) => (
                                                    <option
                                                        key={getNodeId(item, "division")}
                                                        value={getNodeId(item, "division")}
                                                    >
                                                        {getNodeName(item, "division_name")}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </>
                                )}

                                {/* BRANCH */}
                                {customerHierarchy && (
                                    <div className="form-group full-width">
                                        <label>Branch option *</label>
                                        <select
                                            value={branchMode}
                                            onChange={(e) => {
                                                setBranchMode(e.target.value);
                                                setSelectedBranch("");
                                                setNewBranchName("");
                                                setNewBranchCode("");
                                            }}
                                        >
                                            <option value="existing">Select existing branch</option>
                                            <option value="new">Create new branch</option>
                                        </select>
                                    </div>
                                )}

                                {branchMode === "existing" && customerHierarchy && (
                                    <div className="form-group full-width">
                                        <label>Branch *</label>

                                        <select
                                            value={selectedBranch}
                                            onChange={(e) => setSelectedBranch(e.target.value)}
                                            disabled={
                                                customerHierarchy === "GEOGRAPHICAL"
                                                    ? !hierarchySelection.city
                                                    : !hierarchySelection.division
                                            }
                                            required
                                        >
                                            <option value="">Select branch</option>

                                            {getHierarchyOptions("branch").map((branch) => (
                                                <option
                                                    key={getNodeId(branch, "branch")}
                                                    value={getNodeId(branch, "branch")}
                                                >
                                                    {getNodeName(branch, "branch_name")}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {branchMode === "new" && customerHierarchy && (
                                    <>
                                        <div className="form-group">
                                            <label>New Branch Name *</label>
                                            <input
                                                value={newBranchName}
                                                onChange={(e) => setNewBranchName(e.target.value)}
                                                placeholder="Enter branch name"
                                                required
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label>Branch Code</label>
                                            <input
                                                value={newBranchCode}
                                                onChange={(e) => setNewBranchCode(e.target.value)}
                                                placeholder="Enter branch code"
                                            />
                                        </div>
                                    </>
                                )}

                                {/* SITE DETAILS */}
                                <div className="form-group">
                                    <label>Site Name *</label>
                                    <input
                                        value={siteForm.name}
                                        onChange={(e) =>
                                            setSiteForm({ ...siteForm, name: e.target.value })
                                        }
                                        placeholder="Enter site name"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Site Code *</label>
                                    <input
                                        value={siteForm.code}
                                        onChange={(e) =>
                                            setSiteForm({ ...siteForm, code: e.target.value })
                                        }
                                        placeholder="Enter site code"
                                        required
                                    />
                                </div>

                                <div className="form-group full-width">
                                    <label>Address</label>
                                    <textarea
                                        value={siteForm.address}
                                        onChange={(e) =>
                                            setSiteForm({ ...siteForm, address: e.target.value })
                                        }
                                        placeholder="Enter site address"
                                        rows={3}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Pincode</label>
                                    <input
                                        value={siteForm.pincode}
                                        onChange={(e) =>
                                            setSiteForm({
                                                ...siteForm,
                                                pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                                            })
                                        }
                                        placeholder="6-digit pincode"
                                        inputMode="numeric"
                                        maxLength={6}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Latitude</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={siteForm.latitude}
                                        onChange={(e) =>
                                            setSiteForm({ ...siteForm, latitude: e.target.value })
                                        }
                                        placeholder="Latitude"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Longitude</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={siteForm.longitude}
                                        onChange={(e) =>
                                            setSiteForm({ ...siteForm, longitude: e.target.value })
                                        }
                                        placeholder="Longitude"
                                    />
                                </div>

                                {/* OPTIONAL FLOORS */}
                                <div className="form-group full-width floor-choice">
                                    <label>Do you want to add floors?</label>
                                    <select
                                        value={createFloors ? "yes" : "no"}
                                        onChange={(e) => {
                                            const enabled = e.target.value === "yes";
                                            setCreateFloors(enabled);

                                            if (enabled && floorNames.length === 0) {
                                                setFloorNames(["Floor 1"]);
                                                setFloorCount(1);
                                            }
                                        }}
                                    >
                                        <option value="no">No floors</option>
                                        <option value="yes">Yes, add floors</option>
                                    </select>
                                </div>

                                {createFloors && (
                                    <>
                                        <div className="form-group full-width">
                                            <label>Number of floors (1–10)</label>
                                            <select
                                                value={floorCount}
                                                onChange={(e) =>
                                                    handleFloorCountChange(e.target.value)
                                                }
                                            >
                                                {Array.from({ length: 10 }, (_, index) => (
                                                    <option key={index + 1} value={index + 1}>
                                                        {index + 1}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {floorNames.map((floorName, index) => (
                                            <div className="form-group" key={index}>
                                                <label>Floor {index + 1} name *</label>
                                                <input
                                                    value={floorName}
                                                    onChange={(e) =>
                                                        setFloorNames((previous) =>
                                                            previous.map((name, i) =>
                                                                i === index ? e.target.value : name
                                                            )
                                                        )
                                                    }
                                                    required
                                                />
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>

                            {siteError && (
                                <div className="location-error">
                                    <span>{siteError}</span>
                                </div>
                            )}

                            {siteSuccess && (
                                <div className="location-success">
                                    <span>{siteSuccess}</span>
                                </div>
                            )}

                            <div className="site-modal-footer">
                                <button
                                    type="button"
                                    className="cancel-btn"
                                    disabled={siteSaving}
                                    onClick={() => setShowAddSite(false)}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="save-site-btn"
                                    disabled={
                                        siteSaving ||
                                        customerLoading ||
                                        !selectedCustomer ||
                                        !customerHierarchy
                                    }
                                >
                                    {siteSaving ? "Creating..." : "Create Site"}
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