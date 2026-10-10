
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCheckCircle,
  FiCpu,
  FiRefreshCw,
  FiSearch,
  FiUserPlus,
  FiMapPin,
  FiX,
} from "react-icons/fi";
import "./AdminCreation.css";

const API_BASE = "http://localhost:8000/api";
const DEVICES_URL = `${API_BASE}/devices/`;
const CREATE_DEVICE_URL = `${API_BASE}/devices/create/`;
const ASSIGN_CUSTOMER_URL = `${API_BASE}/devices/assign/customer/`;
const ASSIGN_SITE_URL = `${API_BASE}/devices/assign/site/`;
const CUSTOMERS_URL = `${API_BASE}/customers/`;
const CLOUD_CUSTOMERS_URL = `${API_BASE}/cloud/customers/`;
// const SITES_URL = `${API_BASE}/sites/`;
const SITES_URL = `${API_BASE}/cloud/sites/?pageSize=1000&page=0`;

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
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

const customerLabel = (customer) =>
  customer
    ? customer.company ||
      customer.name ||
      customer.code ||
      `Customer #${customer.id}`
    : "—";

const siteLabel = (site) =>
  site ? site.name || site.code || `Site #${site.id}` : "—";

const emptyForm = {
  ac_id: "",
  device_name: "",
  status: "OFF",
  capacity_ton: "",
  installation_date: "",
  last_maintenance_date: "",
  clientid: "",
  username: "",
  password: "",
};

function ACCreation() {
  const [view, setView] = useState("list");
  const [devices, setDevices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sites, setSites] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [siteSearch, setSiteSearch] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");

  /* =====================================================
     FETCH DEVICES
  ===================================================== */

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
          result?.message || result?.detail || `HTTP ${response.status}`
        );
      }

      setDevices(normalizeList(result));
    } catch (err) {
      setError(err.message || "Unable to load AC devices.");
    } finally {
      setLoading(false);
    }
  }, []);

  /* =====================================================
     FETCH CUSTOMERS
  ===================================================== */

  const fetchCustomers = useCallback(async () => {
    try {
      setCustomersLoading(true);

      const response = await fetch(CUSTOMERS_URL, {
        method: "GET",
        headers: authHeaders(),
        cache: "no-store",
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result?.message || result?.detail || `HTTP ${response.status}`
        );
      }

      setCustomers(normalizeList(result));
    } catch (err) {
      console.error("Customer fetch error:", err);
    } finally {
      setCustomersLoading(false);
    }
  }, []);


//   const fetchSites = useCallback(async () => {
//     try {
//       setSitesLoading(true);

//       const response = await fetch(SITES_URL, {
//         method: "GET",
//         headers: authHeaders(),
//         cache: "no-store",
//       });

//       const result = await response.json().catch(() => ({}));

//       if (!response.ok) {
//         throw new Error(
//           result?.message || result?.detail || `HTTP ${response.status}`
//         );
//       }

//       setSites(normalizeList(result));
//     } catch (err) {
//       console.error("Site fetch error:", err);
//     } finally {
//       setSitesLoading(false);
//     }
//   }, []);

    const fetchSites = useCallback(async () => {
        try {
            setSitesLoading(true);
            setAssignmentError("");

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
                    result?.error ||
                    `HTTP ${response.status}`
                );
            }

            const rawSites = Array.isArray(result?.sites)
                ? result.sites
                : normalizeList(result);

            const normalizedSites = rawSites
                .map((site) => ({
                    ...site,

                    // 3TP site ID
                    asset_id:
                        site?.asset_id ||
                        site?.tpt_site_id ||
                        site?.id?.id ||
                        site?.id,

                    // Site display name
                    name:
                        site?.name ||
                        site?.title ||
                        site?.label ||
                        "Unnamed Site",

                    code:
                        site?.code ||
                        site?.label ||
                        "",

                    hierarchy_type:
                        site?.hierarchy_type ||
                        site?.hierarchyType ||
                        "",

                    state_name: site?.state_name || "",
                    district_name: site?.district_name || "",
                    taluka_name: site?.taluka_name || "",
                    city_name: site?.city_name || "",
                    zone_name: site?.zone_name || "",
                    circle_name: site?.circle_name || "",
                    region_name: site?.region_name || "",
                    division_name: site?.division_name || "",
                    branch_name: site?.branch_name || "",
                    floor_name: site?.floor_name || "",
                }))
                .filter((site) => site.asset_id);

            console.log("SITES FOR ASSIGNMENT:", normalizedSites);

            setSites(normalizedSites);
        } catch (err) {
            console.error("SITE FETCH ERROR:", err);

            setAssignmentError(
                err.message || "Unable to load sites from cloud."
            );

            setSites([]);
        } finally {
            setSitesLoading(false);
        }
    }, []);


  useEffect(() => {
    fetchDevices();
    fetchCustomers();
    fetchSites();
  }, [fetchDevices, fetchCustomers, fetchSites]);

  /* =====================================================
     CREATE DEVICE
  ===================================================== */

  const openCreate = () => {
    setForm(emptyForm);
    setFormError("");
    setView("form");
  };

  const backToList = () => {
    setView("list");
    setForm(emptyForm);
    setFormError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!form.ac_id.trim()) return setFormError("AC ID is required.");
    if (!form.device_name.trim())
      return setFormError("Device name is required.");

    const capacity = Number(form.capacity_ton);

    if (
      form.capacity_ton !== "" &&
      (!Number.isFinite(capacity) || capacity <= 0)
    ) {
      return setFormError("Capacity must be greater than 0 Ton.");
    }

    if (
      form.last_maintenance_date &&
      form.installation_date &&
      form.last_maintenance_date < form.installation_date
    ) {
      return setFormError(
        "Last maintenance date cannot be before the installation date."
      );
    }

    setSaving(true);

    try {
      const payload = {
        ac_id: form.ac_id.trim(),
        device_name: form.device_name.trim(),
        status: form.status,
      };

      if (form.capacity_ton !== "") payload.capacity_ton = capacity;
      if (form.installation_date)
        payload.installation_date = form.installation_date;
      if (form.last_maintenance_date)
        payload.last_maintenance_date = form.last_maintenance_date;

      const response = await fetch(CREATE_DEVICE_URL, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        let message =
          result?.message || result?.detail || `HTTP ${response.status}`;

        if (
          typeof result === "object" &&
          result !== null &&
          !result.message &&
          !result.detail
        ) {
          const errors = Object.entries(result)
            .map(
              ([key, value]) =>
                `${key}: ${Array.isArray(value) ? value.join(", ") : value}`
            )
            .join(" | ");

          if (errors) message = errors;
        }

        throw new Error(message);
      }

      await fetchDevices();
      setView("list");
      setForm(emptyForm);

      alert(
        "Device created successfully. You can now assign a customer and site."
      );
    } catch (err) {
      setFormError(err.message || "Unable to create device.");
    } finally {
      setSaving(false);
    }
  };

  /* =====================================================
     ASSIGNMENT HELPERS
  ===================================================== */

  const fetchCustomersForAssignment = useCallback(async () => {
    try {
      setCustomersLoading(true);

      const response = await fetch(CLOUD_CUSTOMERS_URL, {
        method: "GET",
        headers: authHeaders(),
        cache: "no-store",
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result?.message || result?.detail || `HTTP ${response.status}`
        );
      }

      setCustomers(normalizeList(result));
    } catch (err) {
      setAssignmentError(err.message || "Unable to load customers.");
    } finally {
      setCustomersLoading(false);
    }
  }, []);

  const assignCustomer = async (customer) => {
    if (!selectedDevice) return;

    const customerId =
      customer?.tpt_customer_id ||
      customer?.cloud_customer_id ||
      customer?.id?.id ||
      customer?.id;

    const deviceId = selectedDevice?.tpt_device_id || selectedDevice?.id;

    if (!customerId)
      return setAssignmentError("Customer ID is missing.");
    if (!deviceId) return setAssignmentError("Device ID is missing.");

    setAssigning(true);
    setAssignmentError("");

    try {
      const response = await fetch(ASSIGN_CUSTOMER_URL, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          customer_id: customerId,
          device_id: deviceId,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.error ||
            result?.detail ||
            `HTTP ${response.status}`
        );
      }

      setShowCustomerModal(false);
      setSelectedDevice(null);
      setCustomerSearch("");

      await fetchDevices();
      alert("Device assigned to customer successfully.");
    } catch (err) {
      setAssignmentError(
        err.message || "Unable to assign device to customer."
      );
    } finally {
      setAssigning(false);
    }
  };

  const assignSite = async (site) => {
    if (!selectedDevice) return;

    const assetId = site?.asset_id || site?.tpt_site_id;
    const deviceId = selectedDevice?.tpt_device_id || selectedDevice?.id;

    if (!assetId) return setAssignmentError("Site asset ID is missing.");
    if (!deviceId) return setAssignmentError("Device ID is missing.");

    setAssigning(true);
    setAssignmentError("");

    try {
      const response = await fetch(ASSIGN_SITE_URL, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          asset_id: assetId,
          device_id: deviceId,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.error ||
            result?.detail ||
            `HTTP ${response.status}`
        );
      }

      setShowSiteModal(false);
      setSelectedDevice(null);
      setSiteSearch("");

      await fetchDevices();
      alert("Device assigned to site successfully.");
    } catch (err) {
      setAssignmentError(err.message || "Unable to assign device to site.");
    } finally {
      setAssigning(false);
    }
  };

  const openCustomerAssignment = async (device) => {
    setSelectedDevice(device);
    setAssignmentError("");
    setCustomerSearch("");
    setShowCustomerModal(true);

    if (!customers.length) await fetchCustomersForAssignment();
  };

  const openSiteAssignment = async (device) => {
    setSelectedDevice(device);
    setAssignmentError("");
    setSiteSearch("");
    setShowSiteModal(true);

    if (!sites.length) await fetchSites();
  };

  const closeCustomerModal = () => {
    setShowCustomerModal(false);
    setSelectedDevice(null);
    setCustomerSearch("");
    setAssignmentError("");
  };

  const closeSiteModal = () => {
    setShowSiteModal(false);
    setSelectedDevice(null);
    setSiteSearch("");
    setAssignmentError("");
  };

  /* =====================================================
     FILTERS
  ===================================================== */

  const filteredDevices = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return devices;

    return devices.filter((device) =>
      [
        device.ac_id,
        device.device_name,
        device.label,
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
        device.tpt_device_id,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [devices, search]);

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return customers;

    return customers.filter((customer) =>
      [customer.company, customer.name, customer.code, customer.id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [customers, customerSearch]);

//   const filteredSites = useMemo(() => {
//     const query = siteSearch.trim().toLowerCase();
//     if (!query) return sites;

//     return sites.filter((site) =>
//       [site.name, site.code, site.asset_id, site.tpt_site_id, site.id]
//         .filter(Boolean)
//         .some((value) => String(value).toLowerCase().includes(query))
//     );
//   }, [sites, siteSearch]);

    const filteredSites = useMemo(() => {
        const query = siteSearch.trim().toLowerCase();

        if (!query) {
            return sites;
        }

        return sites.filter((site) =>
            [
                site.name,
                site.code,
                site.asset_id,
                site.tpt_site_id,
                site.id,

                site.state_name,
                site.district_name,
                site.taluka_name,
                site.city_name,
                site.zone_name,
                site.circle_name,
                site.region_name,
                site.division_name,
                site.branch_name,
                site.floor_name,
            ]
                .filter(Boolean)
                .some((value) =>
                    String(value)
                        .toLowerCase()
                        .includes(query)
                )
        );
    }, [sites, siteSearch]);

  return (
    <div className="admins-page">
      <ol className="admins-stepper">
        <li className={view === "list" ? "active" : "done"}>
          <button type="button" className="step-btn" onClick={backToList}>
            <span className="step-num">1</span>
            Devices
          </button>
        </li>

        <li className={view === "form" ? "active" : ""}>
          <button type="button" className="step-btn" onClick={openCreate}>
            <span className="step-num">2</span>
            Add Device
          </button>
        </li>
      </ol>

      {/* =================================================
          DEVICE LIST
      ================================================= */}

      {view === "list" ? (
        <>
          <div className="admins-header">
            <div>
              <h1>AC Devices</h1>
              <p>
                Create devices independently and assign customer or site
                separately.
              </p>
            </div>
          </div>

          <div className="admins-toolbar">
            <div style={{ position: "relative", flex: 1 }}>
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
                style={{ paddingLeft: 36, width: "100%" }}
                placeholder="Search by AC ID, device, customer or site..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <span className="admins-count">
              {filteredDevices.length} of {devices.length} devices
            </span>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                fetchDevices();
                fetchCustomers();
                fetchSites();
              }}
            >
              <FiRefreshCw />
              Refresh
            </button>
          </div>

          {error && <div className="admins-error">{error}</div>}

          <div className="admins-table-card">
            {loading ? (
              <div className="admins-loading">Loading devices...</div>
            ) : filteredDevices.length === 0 ? (
              <div className="admins-empty">No AC devices found.</div>
            ) : (
              <table
                className="admins-table"
                style={{ tableLayout: "fixed", width: "100%" }}
              >
                <thead>
                  <tr>
                    <th>AC ID</th>
                    <th>Device</th>
                    <th>Customer</th>
                    <th>Site</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredDevices.map((device) => {
                    const customer =
                      device.customer_name ||
                      (device.customer_id
                        ? `Customer #${device.customer_id}`
                        : "Unassigned");

                    const site = device.site_name || "Unassigned";

                    return (
                      <tr key={device.id || device.ac_id}>
                        <td>
                          <strong>{device.ac_id}</strong>
                        </td>

                        <td>{device.device_name || "—"}</td>

                        <td>
                          <strong>{customer}</strong>
                          <div
                            style={{
                              fontSize: 11,
                              color: device.customer_id ? "#6b7280" : "#9ca3af",
                            }}
                          >
                            {device.customer_id ? "Assigned" : "Not assigned"}
                          </div>
                        </td>

                        <td>
                          <strong>{site}</strong>
                          <div
                            style={{
                              fontSize: 11,
                              color: device.site_id ? "#6b7280" : "#9ca3af",
                            }}
                          >
                            {device.site_id ? "Assigned" : "Not assigned"}
                          </div>
                        </td>

                        <td>
                          <span
                            className={
                              device.status === "ON"
                                ? "status-active"
                                : "status-inactive"
                            }
                          >
                            ● {device.status || "OFF"}
                          </span>
                        </td>

                        <td>
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => openCustomerAssignment(device)}
                            >
                              <FiUserPlus />
                              Customer
                            </button>

                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => openSiteAssignment(device)}
                            >
                              <FiMapPin />
                              Site
                            </button>
                          </div>
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
        /* =================================================
           CREATE DEVICE
        ================================================= */

        <div className="admins-panel">
          <div className="admins-panel-header">
            <FiCpu size={22} />
            <div>
              <h2>Add AC Device</h2>
              <p>
                Create the device independently. Customer and Site can be
                assigned later.
              </p>
            </div>
          </div>

          <form className="admins-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <label>
                AC ID *
                <input
                  value={form.ac_id}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      ac_id: event.target.value,
                    }))
                  }
                  placeholder="AC-MH-PUN-001"
                  required
                />
              </label>

              <label>
                Device Name *
                <input
                  value={form.device_name}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      device_name: event.target.value,
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
                      status: event.target.value,
                    }))
                  }
                >
                  <option value="OFF">OFF</option>
                  <option value="ON">ON</option>
                </select>
              </label>

              <label>
                Capacity (Ton) *
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={form.capacity_ton}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      capacity_ton: event.target.value,
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
                  value={form.installation_date}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      installation_date: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label>
                Last Maintenance Date
                <input
                  type="date"
                  value={form.last_maintenance_date}
                  min={form.installation_date || undefined}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      last_maintenance_date: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <div className="assign-card" style={{ marginTop: 20 }}>
              <div className="admins-panel-header">
                <FiCheckCircle />
                <div>
                  {/* <h3>Independent Device</h3> */}
                  <p> This operation only creates the device. Customer and Site are assigned separately from the device list. </p>
                </div>
              </div>
            </div>


            <form className="admins-form" onSubmit={handleSubmit}>
              <div className="admins-panel-header">
                <div>
                  <p>MQTT Credentials</p>
                </div>
              </div>

              <div className="form-grid">
            
                <label>
                  MQTT Client ID *
                  <input
                    type="text"
                    value={form.clientid}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        clientid: event.target.value,
                      }))
                    }
                    placeholder="AC-MH-PUN-001"
                    autoComplete="off"
                    required
                  />
                </label>

                <label>
                  MQTT Username *
                  <input
                    type="text"
                    value={form.username}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        username: event.target.value,
                      }))
                    }
                    placeholder="Enter MQTT username"
                    autoComplete="off"
                    required
                  />
                </label>

                <label>
                  MQTT Password *
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        password: event.target.value,
                      }))
                    }
                    placeholder="Enter MQTT password"
                    autoComplete="new-password"
                    required
                  />
                </label>
              </div>
            </form>

            {formError && <div className="form-error">{formError}</div>}

            <div className="panel-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={backToList}
                disabled={saving}
              >
                Cancel
              </button>

              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Creating..." : "Create Device"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =====================================================
          CUSTOMER ASSIGNMENT MODAL
      ===================================================== */}

      {showCustomerModal && selectedDevice && (
        <div className="assignment-modal-overlay" onClick={closeCustomerModal}>
          <div
            className="assignment-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="admins-panel-header"
              style={{ justifyContent: "space-between" }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <FiUserPlus />
                <div>
                  <h2>Assign Customer</h2>
                  <p>
                    Device: <strong>{selectedDevice.ac_id}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="btn-secondary"
                onClick={closeCustomerModal}
              >
                <FiX />
              </button>
            </div>

            <div className="assign-card" style={{ marginTop: 18 }}>
              <div className="assign-row">
                <span className="assign-label">AC ID</span>
                <span className="assign-value">{selectedDevice.ac_id}</span>
              </div>

              <div className="assign-row">
                <span className="assign-label">Device</span>
                <span className="assign-value">
                  {selectedDevice.device_name || "—"}
                </span>
              </div>

              <div className="assign-row">
                <span className="assign-label">Customer</span>
                <span className="assign-value">
                  {selectedDevice.customer_name || "Not assigned"}
                </span>
              </div>

              <div className="assign-row">
                <span className="assign-label">Site</span>
                <span className="assign-value">
                  {selectedDevice.site_name || "Not assigned"}
                </span>
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <label>
                Search Customer
                <input
                  value={customerSearch}
                  onChange={(event) => setCustomerSearch(event.target.value)}
                  placeholder="Search customer..."
                />
              </label>

              <div style={{ marginTop: 12, maxHeight: 260, overflowY: "auto" }}>
                {customersLoading ? (
                  <div className="admins-loading">Loading customers...</div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="admins-empty">No customers found.</div>
                ) : (
                  filteredCustomers.map((customer) => (
                    <button
                      key={
                        customer.tpt_customer_id ||
                        customer.cloud_customer_id ||
                        customer.id?.id ||
                        customerLabel(customer)
                      }
                      type="button"
                      className="btn-secondary"
                      style={{
                        width: "100%",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                      onClick={() => assignCustomer(customer)}
                      disabled={assigning}
                    >
                      <span>{customerLabel(customer)}</span>
                      <FiUserPlus />
                    </button>
                  ))
                )}
              </div>
            </div>

            {assignmentError && (
              <div className="form-error" style={{ marginTop: 15 }}>
                {assignmentError}
              </div>
            )}

            <div className="panel-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={closeCustomerModal}
                disabled={assigning}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          SITE ASSIGNMENT MODAL
      ===================================================== */}

      {showSiteModal && selectedDevice && (
        <div className="assignment-modal-overlay" onClick={closeSiteModal}>
          <div
            className="assignment-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="admins-panel-header"
              style={{ justifyContent: "space-between" }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <FiMapPin />
                <div>
                  <h2>Assign Site</h2>
                  <p>
                    Device: <strong>{selectedDevice.ac_id}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="btn-secondary"
                onClick={closeSiteModal}
              >
                <FiX />
              </button>
            </div>

            <div className="assign-card" style={{ marginTop: 18 }}>
              <div className="assign-row">
                <span className="assign-label">AC ID</span>
                <span className="assign-value">{selectedDevice.ac_id}</span>
              </div>

              <div className="assign-row">
                <span className="assign-label">Device</span>
                <span className="assign-value">
                  {selectedDevice.device_name || "—"}
                </span>
              </div>

              <div className="assign-row">
                <span className="assign-label">Customer</span>
                <span className="assign-value">
                  {selectedDevice.customer_name || "Not assigned"}
                </span>
              </div>

              <div className="assign-row">
                <span className="assign-label">Site</span>
                <span className="assign-value">
                  {selectedDevice.site_name || "Not assigned"}
                </span>
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <label>
                Search Site
                <input
                  value={siteSearch}
                  onChange={(event) => setSiteSearch(event.target.value)}
                  placeholder="Search site..."
                />
              </label>

                <div className="site-assignment-list">
                    {sitesLoading ? (
                        <div className="admins-loading">
                            Loading sites...
                        </div>
                    ) : filteredSites.length === 0 ? (
                        <div className="admins-empty">
                            No sites found.
                        </div>
                    ) : (
                        filteredSites.map((site) => {
                            const siteId =
                                site.asset_id ||
                                site.tpt_site_id ||
                                site.id?.id ||
                                site.id;

                            const hierarchy =
                                site.hierarchy_type || "—";

                            const location = [
                                site.state_name,
                                site.district_name,
                                site.taluka_name,
                                site.city_name,
                                site.branch_name,
                                site.floor_name,
                            ]
                                .filter(Boolean)
                                .join(" › ");

                            return (
                                <button
                                    key={siteId}
                                    type="button"
                                    className="site-assignment-item"
                                    onClick={() => assignSite(site)}
                                    disabled={assigning}
                                >
                                    <div className="site-assignment-info">
                                        <strong>
                                            {site.name || "Unnamed Site"}
                                        </strong>

                                        <span>
                                            {site.code || "No code"}
                                        </span>

                                        {location && (
                                            <small>
                                                {location}
                                            </small>
                                        )}

                                        <small>
                                            ID: {siteId}
                                        </small>
                                    </div>

                                    <div className="site-assignment-action">
                                        <FiMapPin />
                                        Assign
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {assignmentError && (
              <div className="form-error" style={{ marginTop: 15 }}>
                {assignmentError}
              </div>
            )}

            <div className="panel-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={closeSiteModal}
                disabled={assigning}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ACCreation;