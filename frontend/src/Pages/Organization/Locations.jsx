import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, MapPin, Building2 } from "lucide-react";
import "./Locations.css";

const API_BASE = "http://192.168.1.6:8000/api";
const FILTER_LOCATIONS_URL = `${API_BASE}/v1/filters/locations/`;
const BRANCHES_URL = `${API_BASE}/branches/`;

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
        ...(token
        ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` }
        : {}),
    };
};

const fetchJSON = async (url, options = {}) => {
    const response = await fetch(url, {
        ...options,
        headers: { ...authHeaders(), ...(options.headers || {}) },
        cache: "no-store",
    });
    const raw = await response.text();
    let result = {};
    try {
        result = raw ? JSON.parse(raw) : {};
    } catch {
        result = { raw_response: raw };
    }
    if (!response.ok) {
        throw new Error(
            result?.message || result?.detail || result?.error ||
            result?.raw_response || `HTTP ${response.status}`
        );
    }
    return result;
};

const getList = (response) => {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.results)) return response.results;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.branches)) return response.branches;
    return [];
};

const getItemId = (item) => 
    String(item?.id ?? item?.uuid ?? item?.pk ?? "");
const getItemLabel = (item) =>
    item?.name ?? item?.title ?? item?.city_name ?? item?.state_name ??
    item?.company_name ?? item?.company ?? item?.customer_name ?? item?.code ??
    getItemId(item);

const normalize = (value) =>
    String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const EMPTY_SELECTION = {
    state: "", 
    district: "", 
    taluka: "", 
    zone: "", 
    circle: "", 
    region: "", 
    division: "",
};

const EMPTY_OPTIONS = {
    states: [], 
    districts: [], 
    talukas: [], 
    zones: [], 
    circles: [], 
    regions: [], 
    divisions: [],
};

const HIERARCHY_CONFIG = {
    GEOGRAPHICAL: [
        { name: "state", id: "state_id", children: "districts" },
        { name: "district", id: "district_id", children: "talukas" },
        { name: "taluka", id: "taluka_id", children: "cities" },
    ],
    ZONAL: [
        { name: "zone", id: "zone_id", children: "circles" },
        { name: "circle", id: "circle_id", children: "regions" },
        { name: "region", id: "region_id", children: "divisions" },
        { name: "division", id: "division_id", children: "branches" },
    ],
};

const nodeId = (node, level) =>
    String(node?.[`${level}_id`] ?? node?.id?.id ?? node?.id ?? node?.uuid ?? "");
const nodeName = (node, level) =>
    String(node?.[`${level}_name`] ?? node?.name ?? node?.title ?? node?.code ?? "");

function Locations () {
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [currentUser, setCurrentUser] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState("");
    const [customerHierarchy, setCustomerHierarchy] = useState("");
    const [customerLocationTree, setCustomerLocationTree] = useState([]);
    const [hierarchySelection, setHierarchySelection] = useState(EMPTY_SELECTION);
    const [showCreate, setShowCreate] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");
    const [success, setSuccess] = useState("");
    const [branchForm, setBranchForm] = useState({
        name: "",
        code: "",
        address: "",
        ifsc:"",
        pincode: "",
        latitude: "",
        longitude: "",
    });

    const MAX_FLOORS = 10;

    const [hasFloor, setHasFloor] = useState("no");      // "" | "yes" | "no"
    const [floorCount, setFloorCount] = useState("");  // string from the input
    const [floors, setFloors] = useState([]);          // ["Floor 1", "Floor 2", ...]

    const loadBranches = useCallback(async (customerId = selectedCustomer, isRefresh = false) => {
        try {
            if (isRefresh) 
                setRefreshing(true);
            else 
                setLoading(true);
            setError("");
            const suffix = customerId ? `?customer=${encodeURIComponent(customerId)}` : "";
            const result = await fetchJSON(`${BRANCHES_URL}${suffix}`);
            setBranches(getList(result));
        } catch (err) {
            setError(err.message || "Unable to load branches.");
            setBranches([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedCustomer]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
        try {
            const response = await fetchJSON(`${API_BASE}/auth/me/`);
            const user = response?.user ?? response?.data ?? response;
            if (cancelled) 
                return;
            setCurrentUser(user);
            const role = String(user?.role ?? user?.user_role ?? "").toUpperCase();
            if (role === "CUSTOMER") {
                const customerId = user?.customer_id ?? user?.customer?.id ?? user?.customer;
                if (!customerId) 
                    throw new Error("Your login is not linked to a customer.");
                setSelectedCustomer(String(customerId));
            } else if (role === "ORG_SUPER_ADMIN") {
            const customerResponse = await fetchJSON(`${API_BASE}/customers/`);
            if (!cancelled) 
                setCustomers(getList(customerResponse));
            } else {
                throw new Error("Your account does not have permission to manage branches.");
            }
        } catch (err) {
            if (!cancelled) setError(err.message || "Unable to load user/customer context.");
        }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!selectedCustomer) {
            setCustomerHierarchy("");
            setCustomerLocationTree([]);

            const role = String(
                currentUser?.role ?? currentUser?.user_role ?? ""
            ).toUpperCase();

            if (role === "ORG_SUPER_ADMIN") {
                // "All" selected → load every branch across customers
                loadBranches("", false);
            } else {
                setBranches([]);
                setLoading(false);
            }
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                setError("");
                const customerResponse = await fetchJSON(
                    `${API_BASE}/customers/${encodeURIComponent(selectedCustomer)}/`
                );
                const customer = customerResponse?.customer
                    ?? customerResponse?.data
                    ?? customerResponse;
                const type = String(customer?.hierarchy_type ?? "").toUpperCase();
                if (type !== "GEOGRAPHICAL" && type !== "ZONAL") {
                    throw new Error("The selected customer has no valid hierarchy configured.");
                }
                if (cancelled) return;
                setCustomerHierarchy(type);

                const params = new URLSearchParams({
                    hierarchy: type,
                    customer_id: selectedCustomer,
                    t: String(Date.now()),
                });
                const tree = await fetchJSON(`${FILTER_LOCATIONS_URL}?${params.toString()}`);
                if (cancelled) return;
                setCustomerLocationTree(Array.isArray(tree?.data) ? tree.data : []);
                await loadBranches(selectedCustomer);
            } catch (err) {
                if (!cancelled) setError(err.message || "Unable to load customer hierarchy.");
            }
        })();

        return () => { cancelled = true; };
    }, [selectedCustomer, loadBranches, currentUser]);

    const getHierarchyOptions = useCallback((targetLevel) => {
        const config = HIERARCHY_CONFIG[customerHierarchy];
        if (!config || !customerLocationTree.length) return [];
        const firstKey = customerHierarchy === "GEOGRAPHICAL" ? "states" : "zones";
        let nodes = customerLocationTree;
        const country = nodes.find((n) => normalize(n?.country_name) === "india");
        if (country?.[firstKey]) nodes = country[firstKey];
        else {
        const wrapper = nodes.find((n) => Array.isArray(n?.[firstKey]));
        if (wrapper) nodes = wrapper[firstKey];
        }
        for (const level of config) {
        if (level.name === targetLevel) return Array.isArray(nodes) ? nodes : [];
        const selectedId = hierarchySelection[level.name];
        if (!selectedId) return [];
        const selected = nodes.find((n) => nodeId(n, level.name) === String(selectedId));
        if (!selected) return [];
        nodes = selected[level.children] || [];
        }
        return [];
    }, [customerHierarchy, customerLocationTree, hierarchySelection]);

    const handleHierarchyChange = (level, value) => {
        const config = HIERARCHY_CONFIG[customerHierarchy] || [];
        const index = config.findIndex((item) => item.name === level);
        setHierarchySelection((previous) => {
        const next = { ...previous, [level]: value };
        for (let i = index + 1; i < config.length; i++) next[config[i].name] = "";
        return next;
        });
    };

    const handleHasFloorChange = (value) => {
        setHasFloor(value);
        if (value !== "yes") {
            setFloorCount("");
            setFloors([]);
        }
    };

    const handleFloorCountChange = (value) => {
        const digits = String(value).replace(/\D/g, "").slice(0, 3);
        setFloorCount(digits);
        const count = digits === "" ? 0 : Math.min(Number(digits), MAX_FLOORS);
        setFloors((previous) => {
            const next = [];
            for (let i = 0; i < count; i++) {
                next.push(previous[i] ?? `Floor ${i + 1}`);
            }
            return next;
        });
    };

    const handleFloorNameChange = (index, value) => {
        setFloors((previous) =>
            previous.map((name, i) => (i === index ? value : name))
        );
    };

    const resetForm = () => {
        setHierarchySelection(EMPTY_SELECTION);
        setBranchForm({
            name: "",
            code: "",
            address: "",
            ifsc: "",
            pincode: "",
            latitude: "",
            longitude: "",
        });
        setHasFloor("");
        setFloorCount("");
        setFloors([]);
        setFormError("");
        setSuccess("");
    };

    const createBranch = async (event) => {
        event.preventDefault();
        setFormError("");
        setSuccess("");
        if (!selectedCustomer || !customerHierarchy) {
            setFormError("Select a valid customer first.");
            return;
        }
        if (!branchForm.name.trim() || !branchForm.code.trim()) {
            setFormError("Branch name and branch code are required.");
            return;
        }
        if (branchForm.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(branchForm.ifsc)) {
            setFormError("IFSC code must be 11 characters (e.g. HDFC0001234).");
            return;
        }
        if (branchForm.pincode && !/^\d{6}$/.test(branchForm.pincode)) {
            setFormError("Pincode must contain exactly 6 digits.");
            return;
        }
        if (!hasFloor) {
            setFormError("Please select whether the branch has floors.");
            return;
        }
        if (hasFloor === "yes" && (!floorCount || Number(floorCount) < 1)) {
            setFormError("Enter the number of floors (at least 1).");
            return;
        }

        const floorPayload = hasFloor === "yes"
            ? floors.map((name, index) => ({
                floor_number: index + 1,
                name: (name || `Floor ${index + 1}`).trim(),
            }))
            : [];

        const payload = {
            customer_id: selectedCustomer,
            hierarchy_type: customerHierarchy,
            name: branchForm.name.trim(),
            code: branchForm.code.trim().toUpperCase(),
            ifsc: branchForm.ifsc.trim().toUpperCase(),   // <-- added
            address: branchForm.address.trim(),
            pincode: branchForm.pincode.trim(),
            latitude: branchForm.latitude === "" ? null : Number(branchForm.latitude),
            longitude: branchForm.longitude === "" ? null : Number(branchForm.longitude),
            has_floor: hasFloor === "yes",
            floor_count: floorPayload.length,
            floors: floorPayload,
        };
        if (customerHierarchy === "GEOGRAPHICAL") {
            if (!hierarchySelection.state || !hierarchySelection.district || !hierarchySelection.taluka) {
                setFormError("Select State, District, and Taluka before creating the branch.");
                return;
            }
            payload.state_id = hierarchySelection.state;
            payload.district_id = hierarchySelection.district;
            payload.taluka_id = hierarchySelection.taluka;
        } else {
            if (!hierarchySelection.zone || !hierarchySelection.circle ||
                !hierarchySelection.region || !hierarchySelection.division) {
                setFormError("Select Zone, Circle, Region, and Division before creating the branch.");
                return;
            }
            payload.zone_id = hierarchySelection.zone;
            payload.circle_id = hierarchySelection.circle;
            payload.region_id = hierarchySelection.region;
            payload.division_id = hierarchySelection.division;
        }

        try {
            setSaving(true);
            const response = await fetchJSON(`${API_BASE}/hierarchy-branch/create/`, {
                method: "POST",
                body: JSON.stringify(payload),
        });
        setSuccess(response?.message || "Branch created.");
        resetForm();
        setShowCreate(false);
        await loadBranches(selectedCustomer, true);
        // Refresh hierarchy so the new branch appears in the hierarchy selectors.
        const params = new URLSearchParams({
            hierarchy: customerHierarchy, customer_id: selectedCustomer, t: String(Date.now()),
        });
        const tree = await fetchJSON(`${FILTER_LOCATIONS_URL}?${params.toString()}`);
        setCustomerLocationTree(Array.isArray(tree?.data) ? tree.data : []);
        } catch (err) {
        setFormError(err.message || "Unable to create branch.");
        } finally {
        setSaving(false);
        }
    };

    const filteredBranches = useMemo(() => {
        const q = normalize(search);
        return branches.filter((branch) => {
        if (!q) return true;
        return [
            branch.name, branch.code, branch.address, branch.pincode,
            branch.state_name, branch.district_name, branch.taluka_name,
            branch.city_name, branch.zone_name, branch.circle_name,
            branch.region_name, branch.division_name, branch.customer_name,
            branch.tpt_branch_id,
        ].some((value) => normalize(value).includes(q));
        });
    }, [branches, search]);

    const totalStates = useMemo(
        () => new Set(branches.map((b) => normalize(b.state_name)).filter(Boolean)).size,
        [branches]
    );

    const hierarchyFields = customerHierarchy === "GEOGRAPHICAL"
        ? [
            ["state", "State"], ["district", "District"], ["taluka", "Taluka"],
        ]
        : [
            ["zone", "Zone"], ["circle", "Circle"], ["region", "Region"], ["division", "Division"],
        ];

    return (
        <div className="locations-page">
            <div className="locations-header">
                <div className="locations-title">
                <h1>Branches</h1>
                <p>Branches synchronized with the customer's hierarchy</p>
                </div>
                <div className="locations-header-actions">
                <button type="button" className="refresh-btn" onClick={() => loadBranches(selectedCustomer, true)} disabled={refreshing}>
                    <RefreshCw size={17} className={refreshing ? "refresh-spinning" : ""} />
                    {refreshing ? "Refreshing..." : "Refresh"}
                </button>
                <button type="button" className="add-site-btn" onClick={() => { resetForm(); setShowCreate(true); }}>
                    + Add Branch
                </button>
                </div>
            </div>

            {String(currentUser?.role ?? currentUser?.user_role ?? "").toUpperCase() === "ORG_SUPER_ADMIN" && (
                <div className="form-group" style={{ maxWidth: 420, marginBottom: 18 }}>
                    <label>Customer *</label>
                    <select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)}>
                        <option value="">All</option>
                        {customers.map((customer) => (
                            <option key={getItemId(customer)} value={getItemId(customer)}>
                                {getItemLabel(customer)}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            <div className="location-summary">
                <div className="summary-card">
                    <div className="summary-icon branch-icon"><Building2 size={21} /></div>
                    <div className="summary-content"><span>Total Branches</span><strong>{branches.length}</strong></div>
                </div>
                {/* <div className="summary-card">
                    <div className="summary-icon state-icon"><MapPin size={21} /></div>
                    <div className="summary-content"><span>States</span><strong>{totalStates}</strong></div>
                </div> */}
            </div>

            {error && <div className="location-error"><strong>Unable to load branches</strong><span>{error}</span></div>}

            <div className="sites-card">
                <div className="sites-card-header">
                <div><h2>Branch List</h2><p>Branches associated with the selected customer</p></div>
                <div style={{ position: "relative", minWidth: 240 }}>
                    <Search size={17} style={{ position: "absolute", left: 10, top: 12 }} />
                    <input className="admins-search" style={{ paddingLeft: 34, width: "100%" }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search branches..." />
                </div>
                </div>
                {loading ? (
                <div className="locations-loading"><div className="locations-spinner" /><span>Loading branches...</span></div>
                ) : filteredBranches.length === 0 ? (
                <div className="locations-loading">No branches found for this customer.</div>
                ) : (
                <div className="sites-table-wrap">
                    <table className="sites-table">
                        <thead>
                            <tr>
                                <th>Branch</th>
                                <th>Code</th>
                                <th>Hierarchy</th>
                                {/* <th>Parent</th> */}
                                <th>Address</th>
                            </tr>
                        </thead>

                        <tbody>
                            {filteredBranches.map((branch) => {
                                const parent = branch.taluka_name || branch.city_name || branch.division_name || "—";
                                const hierarchy = branch.hierarchy_type || customerHierarchy || "—";
                                const sync = branch.tpt_sync_status || (branch.tpt_branch_id ? "SYNCED" : "UNKNOWN");
                                return (
                                    <tr key={branch.id || branch.pk || branch.code}>
                                    <td><strong>{branch.name || "—"}</strong></td>
                                    <td>{branch.code || "—"}</td>
                                    <td>{hierarchy}</td>
                                    {/* <td>{parent}</td> */}
                                    <td>{branch.address || "—"}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                )}
                <div className="sites-card-footer">
                    Showing <strong>{filteredBranches.length}</strong> of <strong>{branches.length}</strong> branches
                </div>
            </div>

            {showCreate && (
                <div className="site-modal-overlay">
                <div className="site-modal hierarchy-site-modal">
                    <div className="site-modal-header">
                    <div><h2>Create Branch</h2><p>Select the customer's hierarchy parent, then enter branch details.</p></div>
                    <button type="button" className="modal-close-btn" disabled={saving} onClick={() => setShowCreate(false)}>×</button>
                    </div>
                    <form onSubmit={createBranch}>
                    <div className="site-form-grid">
                        {String(currentUser?.role ?? currentUser?.user_role ?? "").toUpperCase() === "ORG_SUPER_ADMIN" && (
                        <div className="form-group full-width">
                            <label>Customer *</label>
                            <select value={selectedCustomer} onChange={(e) => { setHierarchySelection(EMPTY_SELECTION); setCustomerHierarchy(""); setCustomerLocationTree([]); setSelectedCustomer(e.target.value); }} required>
                            <option value="">Select customer</option>
                            {customers.map((customer) => <option key={getItemId(customer)} value={getItemId(customer)}>{getItemLabel(customer)}</option>)}
                            </select>
                        </div>
                        )}
                        <div className="form-group full-width">
                        <label>Hierarchy Type</label>
                        <input value={customerHierarchy || "Select a customer"} readOnly />
                        </div>
                        {hierarchyFields.map(([key, label]) => (
                        <div className="form-group" key={key}>
                            <label>{label} *</label>
                            <select value={hierarchySelection[key]} onChange={(e) => handleHierarchyChange(key, e.target.value)} required>
                            <option value="">Select {label.toLowerCase()}</option>
                            {getHierarchyOptions(key).map((item) => (
                                <option key={nodeId(item, key)} value={nodeId(item, key)}>{nodeName(item, key)}</option>
                            ))}
                            </select>
                        </div>
                        ))}
                        <div className="form-group"><label>Branch Name *</label><input value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} required placeholder="Enter branch name" /></div>
                        <div className="form-group"><label>Branch Code *</label><input value={branchForm.code} onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })} required placeholder="Unique branch code" /></div>
                        <div className="form-group">
                            <label>IFSC Code *</label>
                            <input
                                value={branchForm.ifsc}
                                onChange={(e) =>
                                    setBranchForm({
                                        ...branchForm,
                                        ifsc: e.target.value
                                            .toUpperCase()
                                            .replace(/[^A-Z0-9]/g, "")
                                            .slice(0, 11),
                                    })
                                }
                                maxLength={11}
                                placeholder="e.g. HDFC0001234"
                            />
                        </div>
                        <div className="form-group"><label>Pincode</label><input value={branchForm.pincode} onChange={(e) => setBranchForm({ ...branchForm, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" maxLength={6} placeholder="6-digit pincode" /></div>
                        <div className="form-group full-width"><label>Address</label><textarea value={branchForm.address} onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })} rows={3} placeholder="Enter branch address" /></div>
                        <div className="form-group"><label>Latitude</label><input type="number" step="any" min="-90" max="90" value={branchForm.latitude} onChange={(e) => setBranchForm({ ...branchForm, latitude: e.target.value })} /></div>
                        <div className="form-group"><label>Longitude</label><input type="number" step="any" min="-180" max="180" value={branchForm.longitude} onChange={(e) => setBranchForm({ ...branchForm, longitude: e.target.value })} /></div>
                        <div className="form-group full-width">
                            <label>Do you have branch building floor layout ? *</label>
                            <select
                                value={hasFloor}
                                onChange={(e) => handleHasFloorChange(e.target.value)}
                            >
                                <option value="">Select</option>
                                <option value="yes">Yes</option>
                                <option value="no">No</option>
                            </select>
                        </div>

                        {hasFloor === "yes" && (
                            <>
                                <div className="form-group">
                                    <label>Number of Floors *</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max={MAX_FLOORS}
                                        value={floorCount}
                                        onChange={(e) => handleFloorCountChange(e.target.value)}
                                        placeholder="e.g. 3"
                                    />
                                </div>

                                {floors.length > 0 && (
                                    <div className="form-group full-width">
                                        <label>Floor Details</label>
                                        <div className="floor-list">
                                            {floors.map((floor, index) => (
                                                <div className="floor-row" key={index}>
                                                    <span className="floor-index">{index + 1}</span>
                                                    <input
                                                        value={floor}
                                                        onChange={(e) => handleFloorNameChange(index, e.target.value)}
                                                        placeholder={`Floor ${index + 1}`}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    {formError && <div className="location-error"><span>{formError}</span></div>}
                    {success && <div className="location-success"><span>{success}</span></div>}
                    <div className="site-modal-footer">
                        <button type="button" className="cancel-btn" disabled={saving} onClick={() => setShowCreate(false)}>Cancel</button>
                        <button type="submit" className="save-site-btn" disabled={saving || !selectedCustomer || !customerHierarchy}>
                        {saving ? "Creating..." : "Create Branch"}
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
