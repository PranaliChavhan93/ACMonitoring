import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    FiCheckCircle,
    FiCpu,
    FiRefreshCw,
    FiSearch,
} from "react-icons/fi";
import "./AdminCreation.css";

const API_BASE = "http://localhost:8000/api";
const DEVICES_URL = `${API_BASE}/devices/`;
const SITES_URL = `${API_BASE}/sites/`;

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
        ...(token ? { Authorization: `Token ${token}` } : {}),
    };
};

const normalizeList = (response) =>
    Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response?.results)
                ? response.results
                : [];

const emptyForm = {
    ac_id: "",
    device_name: "",
    status: "OFF",
    site_id: "",
    capacity_ton: "",
    installation_date: "",
    last_maintenance_date: "",
};

const customerLabel = (customer) => {
    if (!customer) return "—";
    return customer.company || customer.name || customer.code || `Customer #${customer.id}`;
};

const siteLocation = (site) => {
    if (!site) return "—";

    const parts = [
        site.zone_name,
        site.circle_name,
        site.region_name,
        site.division_name,
        site.state_name,
        site.district_name,
        site.taluka_name,
        site.city_name,
        site.branch_name,
        site.floor_name,
    ].filter(Boolean);

    return parts.length ? parts.join(" / ") : site.name || site.code || "—";
};

function ACCreation() {
    const [view, setView] = useState("list");

    const [devices, setDevices] = useState([]);
    const [sites, setSites] = useState([]);

    const [form, setForm] = useState(emptyForm);

    const [selectedSite, setSelectedSite] = useState(null);

    const [unassigned, setUnassigned] = useState([]);

    const [search, setSearch] = useState("");

    const [loading, setLoading] = useState(true);
    const [sitesLoading, setSitesLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [assignmentLoading, setAssignmentLoading] = useState(false);

    const [error, setError] = useState("");
    const [formError, setFormError] = useState("");

    const fetchDevices = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const response = await fetch(DEVICES_URL, {
                method: "GET",
                headers: authHeaders(),
                cache: "no-store",
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    result?.message ||
                    result?.detail ||
                    `HTTP ${response.status}`
                );
            }

            setDevices(normalizeList(result));
        } catch (err) {
            setError(err.message || "Unable to load AC devices.");
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchSites = useCallback(async () => {
        try {
            setSitesLoading(true);

            const response = await fetch(SITES_URL, {
                method: "GET",
                headers: authHeaders(),
                cache: "no-store",
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    result?.message ||
                    result?.detail ||
                    `HTTP ${response.status}`
                );
            }

            setSites(normalizeList(result));
        } catch (err) {
            setFormError(err.message || "Unable to load sites.");
        } finally {
            setSitesLoading(false);
        }
    }, []);

    const fetchUnassigned = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/devices/unassigned/`, {
                method: "GET",
                headers: authHeaders(),
                cache: "no-store",
            });

            const result = await response.json().catch(() => ({}));

            if (response.ok) {
                setUnassigned(normalizeList(result));
            }
        } catch {
            // Optional suggestion list. Do not block device creation.
        }
    }, []);

    useEffect(() => {
        fetchDevices();
        fetchSites();
        fetchUnassigned();
    }, [fetchDevices, fetchSites, fetchUnassigned]);

    const resetForm = useCallback(() => {
        setForm(emptyForm);
        setSelectedSite(null);
        setFormError("");
        setAssignmentLoading(false);
    }, []);

    const openCreate = () => {
        resetForm();
        setView("form");
    };

    const backToList = () => {
        setView("list");
        resetForm();
    };

    const selectSite = async (siteId) => {
        setForm((previous) => ({
            ...previous,
            site_id: siteId,
        }));

        setSelectedSite(null);
        setFormError("");

        if (!siteId) {
            return;
        }

        const cachedSite = sites.find(
            (site) => String(site.id) === String(siteId)
        );

        if (cachedSite) {
            setSelectedSite(cachedSite);
        }

        /*
         * Fetch the assignment separately so that the Customer/Admin
         * information is always current.
         *
         * The frontend does NOT calculate ownership.
         * Backend resolves:
         *
         * Site -> Branch -> Customer
         * Site -> Users -> Site Admins
         */
        try {
            setAssignmentLoading(true);

            const response = await fetch(
                `${SITES_URL}${encodeURIComponent(siteId)}/assignment/`,
                {
                    method: "GET",
                    headers: authHeaders(),
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

            setSelectedSite(result?.data || cachedSite || null);
        } catch (err) {
            setSelectedSite(cachedSite || null);
            setFormError(
                err.message || "Unable to fetch site ownership."
            );
        } finally {
            setAssignmentLoading(false);
        }
    };

    const selectedCustomer = selectedSite?.customer_id
        ? {
            id: selectedSite.customer_id,
            company: selectedSite.customer_name,
        }
        : null;

    const selectedAdmins = selectedSite?.admins || [];
    const selectedEngineers = selectedSite?.engineers || [];

    const filteredDevices = useMemo(() => {
        const query = search.trim().toLowerCase();

        if (!query) {
            return devices;
        }

        return devices.filter((device) =>
            [
                device.ac_id,
                device.device_name,
                device.status,
                device.customer_name,
                device.site_name,
                device.site_code,
                device.branch_name,
                device.floor_name,
                device.state_name,
                device.district_name,
                device.zone_name,
                device.circle_name,
                ...(device.admins || []).map((admin) => admin.name),
            ]
                .filter(Boolean)
                .some((value) =>
                    String(value).toLowerCase().includes(query)
                )
        );
    }, [devices, search]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setFormError("");

        if (!form.ac_id.trim()) {
            return setFormError("AC ID is required.");
        }

        if (!form.device_name.trim()) {
            return setFormError("Device name is required.");
        }

        if (!form.site_id) {
            return setFormError("Please select a site.");
        }

        if (!selectedSite) {
            return setFormError(
                "Unable to resolve the selected site's customer. Please select the site again."
            );
        }

        if (!selectedSite.customer_id) {
            return setFormError(
                "The selected site is not assigned to a customer."
            );
        }

        const capacity = Number(form.capacity_ton);

        if (!Number.isFinite(capacity) || capacity <= 0) {
            return setFormError(
                "Capacity must be greater than 0 Ton."
            );
        }

        if (!form.installation_date) {
            return setFormError(
                "Installation date is required."
            );
        }

        if (
            form.last_maintenance_date &&
            form.last_maintenance_date < form.installation_date
        ) {
            return setFormError(
                "Last maintenance date cannot be before the installation date."
            );
        }

        setSaving(true);

        try {
            /*
             * IMPORTANT:
             *
             * Only site_id is sent for ownership.
             *
             * We intentionally DO NOT send:
             * customer_id
             * admin_ids
             * branch_id
             * floor_id
             *
             * The backend derives all of them from the selected Site.
             */
            const payload = {
                ac_id: form.ac_id.trim(),
                device_name: form.device_name.trim(),
                status: form.status,
                site_id: form.site_id,
                capacity_ton: capacity,
                installation_date: form.installation_date,
                last_maintenance_date:
                    form.last_maintenance_date || "",
            };

            const response = await fetch(DEVICES_URL, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify(payload),
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                let message =
                    result?.message ||
                    result?.detail ||
                    `HTTP ${response.status}`;

                if (
                    typeof result === "object" &&
                    result !== null &&
                    !result.message &&
                    !result.detail
                ) {
                    const errors = Object.entries(result)
                        .map(([key, value]) =>
                            `${key}: ${
                                Array.isArray(value)
                                    ? value.join(", ")
                                    : value
                            }`
                        )
                        .join(" | ");

                    if (errors) {
                        message = errors;
                    }
                }

                throw new Error(message);
            }

            await Promise.all([
                fetchDevices(),
                fetchUnassigned(),
            ]);

            setView("list");
            resetForm();
        } catch (err) {
            setFormError(
                err.message || "Could not create and assign device."
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="admins-page">

            <ol className="admins-stepper">
                <li
                    className={
                        view === "list" ? "active" : "done"
                    }
                >
                    <button
                        type="button"
                        className="step-btn"
                        onClick={backToList}
                    >
                        <span className="step-num">1</span>
                        Devices
                    </button>
                </li>

                <li
                    className={
                        view === "form" ? "active" : ""
                    }
                >
                    <button
                        type="button"
                        className="step-btn"
                        onClick={openCreate}
                    >
                        <span className="step-num">2</span>
                        Add Device
                    </button>
                </li>
            </ol>

            {view === "list" ? (
                <>
                    <div className="admins-header">
                        <div>
                            <h1>AC Devices</h1>
                            <p>
                                Manage AC devices and their site
                                assignments.
                            </p>
                        </div>
                    </div>

                    <div className="admins-toolbar">
                        <div
                            style={{
                                position: "relative",
                                flex: 1,
                            }}
                        >
                            <FiSearch
                                style={{
                                    position: "absolute",
                                    left: 12,
                                    top: 12,
                                    color: "#9ca3af",
                                }}
                            />

                            <input
                                className="admins-search"
                                style={{
                                    paddingLeft: 36,
                                    width: "100%",
                                }}
                                placeholder="Search by AC ID, device, customer, site or admin..."
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                            />
                        </div>

                        <span className="admins-count">
                            {filteredDevices.length} of{" "}
                            {devices.length} devices
                        </span>

                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                                fetchDevices();
                                fetchSites();
                            }}
                        >
                            <FiRefreshCw /> Refresh
                        </button>
                    </div>

                    {error && (
                        <div className="admins-error">
                            {error}
                        </div>
                    )}

                    <div className="admins-table-card">
                        {loading ? (
                            <div className="admins-loading">
                                Loading devices...
                            </div>
                        ) : filteredDevices.length === 0 ? (
                            <div className="admins-empty">
                                No AC devices found.
                            </div>
                        ) : (
                            <table
                                className="admins-table"
                                style={{
                                    tableLayout: "fixed",
                                    width: "100%",
                                }}
                            >
                                <thead>
                                    <tr>
                                        <th>AC ID</th>
                                        <th>Device</th>
                                        <th>Customer</th>
                                        <th>Site</th>
                                        <th>Admin</th>
                                        <th>Location</th>
                                        <th>Specifications</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {filteredDevices.map((device) => {
                                        const customer =
                                            device.customer_name ||
                                            (device.customer_id
                                                ? `Customer #${device.customer_id}`
                                                : "—");

                                        const admins =
                                            device.admins || [];

                                        const location =
                                            [
                                                device.state_name,
                                                device.district_name,
                                                device.city_name,
                                                device.branch_name,
                                                device.floor_name,
                                            ]
                                                .filter(Boolean)
                                                .join(" / ") ||
                                            "—";

                                        return (
                                            <tr
                                                key={device.ac_id}
                                            >
                                                <td>
                                                    <strong>
                                                        {device.ac_id}
                                                    </strong>
                                                </td>

                                                <td>
                                                    {device.device_name ||
                                                        "—"}
                                                </td>

                                                <td>
                                                    {customer}
                                                </td>

                                                <td>
                                                    <strong>
                                                        {device.site_name ||
                                                            "—"}
                                                    </strong>

                                                    {device.site_code && (
                                                        <div
                                                            style={{
                                                                fontSize: 11,
                                                                color: "#6b7280",
                                                            }}
                                                        >
                                                            {
                                                                device.site_code
                                                            }
                                                        </div>
                                                    )}
                                                </td>

                                                <td>
                                                    {admins.length
                                                        ? admins
                                                            .map(
                                                                (admin) =>
                                                                    admin.name ||
                                                                    admin.email
                                                            )
                                                            .join(", ")
                                                        : "—"}
                                                </td>

                                                <td
                                                    title={location}
                                                >
                                                    {location}
                                                </td>

                                                <td
                                                    style={{
                                                        fontSize: 12,
                                                        lineHeight: 1.5,
                                                    }}
                                                >
                                                    <div>
                                                        <strong>
                                                            {device.capacity_ton
                                                                ? `${device.capacity_ton} Ton`
                                                                : "—"}
                                                        </strong>
                                                    </div>

                                                    <div>
                                                        Install:{" "}
                                                        {device.installation_date ||
                                                            "—"}
                                                    </div>

                                                    <div>
                                                        Maintenance:{" "}
                                                        {device.last_maintenance_date ||
                                                            "—"}
                                                    </div>
                                                </td>

                                                <td
                                                    style={{
                                                        textAlign:
                                                            "center",
                                                    }}
                                                >
                                                    <span
                                                        className={
                                                            device.status ===
                                                            "ON"
                                                                ? "status-active"
                                                                : "status-inactive"
                                                        }
                                                    >
                                                        ●{" "}
                                                        {device.status ||
                                                            "OFF"}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </>
            ) : (
                <div className="admins-panel">

                    <div className="admins-panel-header">
                        <FiCpu size={22} />

                        <div>
                            <h2>Add AC Device</h2>

                            <p>
                                Add the device and select the site.
                                Customer and site admins are fetched
                                automatically from the selected site.
                            </p>
                        </div>
                    </div>

                    <form
                        className="admins-form"
                        onSubmit={handleSubmit}
                    >
                        <div className="form-grid">

                            <label>
                                AC ID *

                                <input
                                    value={form.ac_id}
                                    list="unassigned-acs"
                                    onChange={(event) => {
                                        const value =
                                            event.target.value;

                                        const match =
                                            unassigned.find(
                                                (device) =>
                                                    device.ac_id ===
                                                    value
                                            );

                                        setForm((previous) => ({
                                            ...previous,
                                            ac_id: value,
                                            device_name:
                                                match &&
                                                !previous.device_name
                                                    ? match.device_name ||
                                                      ""
                                                    : previous.device_name,
                                        }));
                                    }}
                                    placeholder="AC-MH-PUN-001"
                                    required
                                />

                                <datalist id="unassigned-acs">
                                    {unassigned.map((device) => (
                                        <option
                                            key={device.ac_id}
                                            value={device.ac_id}
                                        >
                                            {device.device_name}
                                        </option>
                                    ))}
                                </datalist>

                                <small className="field-hint">
                                    {unassigned.length} device(s)
                                    waiting for assignment.
                                </small>
                            </label>

                            <label>
                                Device Name *

                                <input
                                    value={form.device_name}
                                    onChange={(event) =>
                                        setForm((previous) => ({
                                            ...previous,
                                            device_name:
                                                event.target.value,
                                        }))
                                    }
                                    placeholder="Pune Office AC 01"
                                    required
                                />
                            </label>

                            <label>
                                Status *

                                <select
                                    value={form.status}
                                    onChange={(event) =>
                                        setForm((previous) => ({
                                            ...previous,
                                            status:
                                                event.target.value,
                                        }))
                                    }
                                >
                                    <option value="OFF">
                                        OFF
                                    </option>

                                    <option value="ON">
                                        ON
                                    </option>
                                </select>
                            </label>

                            <label>
                                Site *

                                <select
                                    value={form.site_id}
                                    onChange={(event) =>
                                        selectSite(
                                            event.target.value
                                        )
                                    }
                                    required
                                    disabled={sitesLoading}
                                >
                                    <option value="">
                                        {sitesLoading
                                            ? "Loading sites..."
                                            : "— Select site —"}
                                    </option>

                                    {sites.map((site) => (
                                        <option
                                            key={site.id}
                                            value={site.id}
                                        >
                                            {site.name} ({site.code})
                                        </option>
                                    ))}
                                </select>

                                <small className="field-hint">
                                    Select the site. Customer and
                                    admin are inherited automatically.
                                </small>
                            </label>
                        </div>

                        {form.site_id && (
                            <div
                                className="assign-card"
                                style={{
                                    marginTop: 22,
                                }}
                            >
                                <div
                                    className="admins-panel-header"
                                    style={{
                                        marginBottom: 14,
                                    }}
                                >
                                    <div>
                                        <h3
                                            style={{
                                                margin: 0,
                                            }}
                                        >
                                            Automatic Assignment
                                        </h3>

                                        <p>
                                            These values are resolved
                                            from the selected site by
                                            the backend.
                                        </p>
                                    </div>
                                </div>

                                {assignmentLoading ? (
                                    <div className="assign-loading">
                                        Fetching site customer and
                                        admin...
                                    </div>
                                ) : (
                                    <>
                                        <div className="assign-row">
                                            <span className="assign-label">
                                                Site
                                            </span>

                                            <span className="assign-value">
                                                {selectedSite?.name ||
                                                    "—"}
                                                {selectedSite?.code
                                                    ? ` (${selectedSite.code})`
                                                    : ""}
                                            </span>
                                        </div>

                                        <div className="assign-row">
                                            <span className="assign-label">
                                                Customer
                                            </span>

                                            <span className="assign-value">
                                                {customerLabel(
                                                    selectedCustomer
                                                )}
                                            </span>
                                        </div>

                                        <div className="assign-row">
                                            <span className="assign-label">
                                                Site Admin
                                            </span>

                                            <span className="assign-value">
                                                {selectedAdmins.length
                                                    ? selectedAdmins
                                                        .map(
                                                            (admin) =>
                                                                admin.name ||
                                                                admin.email
                                                        )
                                                        .join(", ")
                                                    : "— No site admin assigned —"}
                                            </span>
                                        </div>

                                        <div className="assign-row">
                                            <span className="assign-label">
                                                Engineers
                                            </span>

                                            <span className="assign-value">
                                                {selectedEngineers.length
                                                    ? selectedEngineers
                                                        .map(
                                                            (engineer) =>
                                                                engineer.name ||
                                                                engineer.email
                                                        )
                                                        .join(", ")
                                                    : "— None —"}
                                            </span>
                                        </div>

                                        <div className="assign-row">
                                            <span className="assign-label">
                                                Location
                                            </span>

                                            <span className="assign-value">
                                                {siteLocation(
                                                    selectedSite
                                                )}
                                            </span>
                                        </div>

                                        {!selectedSite?.customer_id && (
                                            <div
                                                className="form-error"
                                                style={{
                                                    marginTop: 10,
                                                }}
                                            >
                                                This site does not
                                                belong to a customer.
                                                Assign the site's branch
                                                to a customer first.
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        <div
                            className="form-grid"
                            style={{
                                marginTop: 18,
                            }}
                        >
                            <label>
                                Capacity (Ton) *

                                <input
                                    type="number"
                                    min="0.1"
                                    step="0.1"
                                    value={
                                        form.capacity_ton
                                    }
                                    onChange={(event) =>
                                        setForm((previous) => ({
                                            ...previous,
                                            capacity_ton:
                                                event.target.value,
                                        }))
                                    }
                                    placeholder="1.5"
                                    required
                                />
                            </label>

                            <label>
                                Installation Date *

                                <input
                                    type="date"
                                    value={
                                        form.installation_date
                                    }
                                    onChange={(event) =>
                                        setForm((previous) => ({
                                            ...previous,
                                            installation_date:
                                                event.target.value,
                                        }))
                                    }
                                    required
                                />
                            </label>

                            <label>
                                Last Maintenance Date

                                <input
                                    type="date"
                                    value={
                                        form.last_maintenance_date
                                    }
                                    min={
                                        form.installation_date ||
                                        undefined
                                    }
                                    onChange={(event) =>
                                        setForm((previous) => ({
                                            ...previous,
                                            last_maintenance_date:
                                                event.target.value,
                                        }))
                                    }
                                />
                            </label>
                        </div>

                        {formError && (
                            <div className="form-error">
                                {formError}
                            </div>
                        )}

                        <div className="panel-actions">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={backToList}
                                disabled={saving}
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={
                                    saving ||
                                    assignmentLoading ||
                                    !form.site_id ||
                                    !selectedSite?.customer_id
                                }
                            >
                                <FiCheckCircle />

                                {saving
                                    ? "Creating..."
                                    : "Create & Assign Device"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

export default ACCreation;
