// import React, { useCallback, useEffect, useMemo, useState } from "react";
// import {
//   FiCheckCircle,
//   FiCpu,
//   FiRefreshCw,
//   FiSearch,
//   FiUserPlus,
//   FiMapPin,
//   FiX,
//   FiEdit2,
//   FiTrash2,
// } from "react-icons/fi";
// import { useAuth } from "../Layout/AuthContext";
// import "./AdminCreation.css";

// /* =====================================================
//    API ENDPOINTS
// ===================================================== */

// const API_BASE = "http://localhost:8000/api";

// const DEVICES_URL          = `${API_BASE}/devices/`;
// const CREATE_DEVICE_URL    = `${API_BASE}/devices/create/`;
// const ASSIGN_CUSTOMER_URL  = `${API_BASE}/devices/assign/customer/`;
// const ASSIGN_SITE_URL      = `${API_BASE}/devices/assign/site/`;
// const RELAY_CONTROL_URL    = `${API_BASE}/devices/relay/`;
// const CUSTOMERS_URL        = `${API_BASE}/customers/`;
// const CLOUD_CUSTOMERS_URL  = `${API_BASE}/cloud/customers/`;
// const SITES_URL            = `${API_BASE}/cloud/sites/?pageSize=1000&page=0`;

// // Standard REST detail URL — used for edit (PATCH) and delete (DELETE).
// const deviceDetailUrl = (deviceId) =>
//   `${API_BASE}/devices/${encodeURIComponent(deviceId)}/`;

// // When a device belongs to a customer, only that customer's sites are offered.
// const sitesUrlFor = (customerId) =>
//   customerId
//     ? `${SITES_URL}&customer=${encodeURIComponent(customerId)}`
//     : SITES_URL;

// /* =====================================================
//    HELPERS
// ===================================================== */

// const getToken = () =>
//   localStorage.getItem("token") ||
//   localStorage.getItem("authToken") ||
//   localStorage.getItem("access_token") ||
//   localStorage.getItem("accessToken") ||
//   "";

// const authHeaders = () => {
//   const token = getToken();
//   return {
//     "Content-Type": "application/json",
//     ...(token ? { Authorization: `Bearer ${token}` } : {}),
//   };
// };

// const normalizeList = (response) =>
//   Array.isArray(response)
//     ? response
//     : Array.isArray(response?.data)
//     ? response.data
//     : Array.isArray(response?.results)
//     ? response.results
//     : [];

// const customerLabel = (customer) =>
//   customer
//     ? customer.company ||
//       customer.title ||
//       customer.name ||
//       customer.code ||
//       `Customer #${customer.id}`
//     : "—";

// const emptyForm = {
//   ac_id: "",
//   device_name: "",
//   status: "OFF",
//   capacity_ton: "",
//   installation_date: "",
//   last_maintenance_date: "",
//   clientid: "",
//   username: "",
//   password: "",
// };

// /* =====================================================
//    COMPONENT
// ===================================================== */

// function ACCreation() {
//   const { user } = useAuth();
//   const canAssignCustomer = user?.role === "ORG_SUPER_ADMIN";

//   /* ---------- state ---------- */
//   const [view, setView] = useState("list");
//   const [devices, setDevices] = useState([]);
//   const [customers, setCustomers] = useState([]);
//   const [sites, setSites] = useState([]);

//   const [form, setForm] = useState(emptyForm);
//   const [editingDevice, setEditingDevice] = useState(null); // null = create mode
//   const [search, setSearch] = useState("");

//   const [loading, setLoading] = useState(true);
//   const [customersLoading, setCustomersLoading] = useState(false);
//   const [sitesLoading, setSitesLoading] = useState(false);
//   const [saving, setSaving] = useState(false);
//   const [deletingKey, setDeletingKey] = useState(null); // row key while deleting

//   const [error, setError] = useState("");
//   const [formError, setFormError] = useState("");

//   const [showCustomerModal, setShowCustomerModal] = useState(false);
//   const [showSiteModal, setShowSiteModal] = useState(false);
//   const [selectedDevice, setSelectedDevice] = useState(null);
//   const [customerSearch, setCustomerSearch] = useState("");
//   const [siteSearch, setSiteSearch] = useState("");
//   const [assigning, setAssigning] = useState(false);
//   const [assignmentError, setAssignmentError] = useState("");

//   const [relayLoading, setRelayLoading] = useState({});
//   const [relayErrors, setRelayErrors] = useState({});

//   /* =====================================================
//      FETCHERS
//   ===================================================== */

//   const fetchDevices = useCallback(async () => {
//     try {
//       setLoading(true);
//       setError("");

//       const response = await fetch(DEVICES_URL, {
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

//       setDevices(normalizeList(result));
//     } catch (err) {
//       setError(err.message || "Unable to load AC devices.");
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   const fetchCustomers = useCallback(async () => {
//     try {
//       setCustomersLoading(true);

//       const response = await fetch(CUSTOMERS_URL, {
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

//       setCustomers(normalizeList(result));
//     } catch (err) {
//       console.error("Customer fetch error:", err);
//     } finally {
//       setCustomersLoading(false);
//     }
//   }, []);

//   const fetchSites = useCallback(async (customerId) => {
//     try {
//       setSitesLoading(true);
//       setAssignmentError("");

//       const response = await fetch(sitesUrlFor(customerId), {
//         method: "GET",
//         headers: authHeaders(),
//         cache: "no-store",
//       });

//       const result = await response.json().catch(() => ({}));

//       if (!response.ok) {
//         throw new Error(
//           result?.message ||
//             result?.detail ||
//             result?.error ||
//             `HTTP ${response.status}`
//         );
//       }

//       const rawSites = Array.isArray(result?.sites)
//         ? result.sites
//         : normalizeList(result);

//       const normalizedSites = rawSites
//         .map((site) => ({
//           ...site,
//           asset_id:
//             site?.asset_id || site?.tpt_site_id || site?.id?.id || site?.id,
//           name: site?.name || site?.title || site?.label || "Unnamed Site",
//           code: site?.code || site?.label || "",
//           hierarchy_type: site?.hierarchy_type || site?.hierarchyType || "",
//           state_name: site?.state_name || "",
//           district_name: site?.district_name || "",
//           taluka_name: site?.taluka_name || "",
//           city_name: site?.city_name || "",
//           zone_name: site?.zone_name || "",
//           circle_name: site?.circle_name || "",
//           region_name: site?.region_name || "",
//           division_name: site?.division_name || "",
//           branch_name: site?.branch_name || "",
//           floor_name: site?.floor_name || "",
//         }))
//         .filter((site) => site.asset_id);

//       setSites(normalizedSites);
//     } catch (err) {
//       console.error("SITE FETCH ERROR:", err);
//       setAssignmentError(err.message || "Unable to load sites from cloud.");
//       setSites([]);
//     } finally {
//       setSitesLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     fetchDevices();
//     fetchCustomers();
//   }, [fetchDevices, fetchCustomers]);

//   /* =====================================================
//      CREATE / EDIT DEVICE
//   ===================================================== */

//   const openCreate = () => {
//     setEditingDevice(null);
//     setForm(emptyForm);
//     setFormError("");
//     setView("form");
//   };

//   const openEdit = (device) => {
//     setEditingDevice(device);
//     setForm({
//       ac_id: device.ac_id || "",
//       device_name: device.device_name || "",
//       status: device.status || "OFF",
//       capacity_ton:
//         device.capacity_ton === null || device.capacity_ton === undefined
//           ? ""
//           : String(device.capacity_ton),
//       installation_date: device.installation_date || "",
//       last_maintenance_date: device.last_maintenance_date || "",
//       clientid: device.clientid || "",
//       username: device.username || "",
//       password: "", // never prefill passwords
//     });
//     setFormError("");
//     setView("form");
//   };

//   const backToList = () => {
//     setView("list");
//     setForm(emptyForm);
//     setEditingDevice(null);
//     setFormError("");
//   };

//   const handleSubmit = async (event) => {
//     event.preventDefault();
//     setFormError("");

//     if (!form.ac_id.trim()) return setFormError("AC ID is required.");
//     if (!form.device_name.trim())
//       return setFormError("Device name is required.");

//     const capacity = Number(form.capacity_ton);
//     if (
//       form.capacity_ton !== "" &&
//       (!Number.isFinite(capacity) || capacity <= 0)
//     ) {
//       return setFormError("Capacity must be greater than 0 Ton.");
//     }

//     if (
//       form.last_maintenance_date &&
//       form.installation_date &&
//       form.last_maintenance_date < form.installation_date
//     ) {
//       return setFormError(
//         "Last maintenance date cannot be before the installation date."
//       );
//     }

//     // MQTT credentials required only on create.
//     if (!editingDevice) {
//       if (!form.clientid.trim())
//         return setFormError("MQTT Client ID is required.");
//       if (!form.username.trim())
//         return setFormError("MQTT Username is required.");
//       if (!form.password)
//         return setFormError("MQTT Password is required.");
//     }

//     setSaving(true);

//     try {
//       const payload = {
//         ac_id: form.ac_id.trim(),
//         device_name: form.device_name.trim(),
//         status: form.status,
//       };

//       if (form.capacity_ton !== "") payload.capacity_ton = capacity;
//       if (form.installation_date)
//         payload.installation_date = form.installation_date;
//       if (form.last_maintenance_date)
//         payload.last_maintenance_date = form.last_maintenance_date;

//       if (form.clientid.trim()) payload.clientid = form.clientid.trim();
//       if (form.username.trim()) payload.username = form.username.trim();
//       // Only send password if the user entered a new one.
//       if (form.password) payload.password = form.password;

//       const isEdit = Boolean(editingDevice);
//       const deviceId = editingDevice?.tpt_device_id || editingDevice?.id;

//       if (isEdit && !deviceId) {
//         throw new Error("Device ID is missing — cannot update.");
//       }

//       const url = isEdit ? deviceDetailUrl(deviceId) : CREATE_DEVICE_URL;
//       const method = isEdit ? "PATCH" : "POST";

//       const response = await fetch(url, {
//         method,
//         headers: authHeaders(),
//         body: JSON.stringify(payload),
//       });

//       const result = await response.json().catch(() => ({}));

//       if (!response.ok) {
//         let message =
//           result?.message || result?.detail || `HTTP ${response.status}`;

//         if (
//           typeof result === "object" &&
//           result !== null &&
//           !result.message &&
//           !result.detail
//         ) {
//           const errors = Object.entries(result)
//             .map(
//               ([key, value]) =>
//                 `${key}: ${Array.isArray(value) ? value.join(", ") : value}`
//             )
//             .join(" | ");

//           if (errors) message = errors;
//         }

//         throw new Error(message);
//       }

//       await fetchDevices();
//       setView("list");
//       setForm(emptyForm);
//       setEditingDevice(null);

//       alert(
//         isEdit
//           ? "Device updated successfully."
//           : "Device created successfully. You can now assign a customer and site."
//       );
//     } catch (err) {
//       setFormError(err.message || "Unable to save device.");
//     } finally {
//       setSaving(false);
//     }
//   };

//   /* =====================================================
//      DELETE DEVICE
//   ===================================================== */

//   const handleDelete = async (device) => {
//     const deviceId = device.tpt_device_id || device.id;

//     if (!deviceId) {
//       alert("Device ID is missing — cannot delete.");
//       return;
//     }

//     const confirmed = window.confirm(
//       `Delete device "${device.ac_id}"${
//         device.device_name ? ` (${device.device_name})` : ""
//       }?\n\nThis action cannot be undone.`
//     );
//     if (!confirmed) return;

//     const key = device.id || device.ac_id;
//     setDeletingKey(key);

//     try {
//       const response = await fetch(deviceDetailUrl(deviceId), {
//         method: "DELETE",
//         headers: authHeaders(),
//       });

//       // 204 No Content is the norm; anything 2xx is fine.
//       if (!response.ok) {
//         const result = await response.json().catch(() => ({}));
//         throw new Error(
//           result?.message ||
//             result?.detail ||
//             result?.error ||
//             `HTTP ${response.status}`
//         );
//       }

//       await fetchDevices();
//       alert("Device deleted successfully.");
//     } catch (err) {
//       alert(err.message || "Unable to delete device.");
//     } finally {
//       setDeletingKey(null);
//     }
//   };

//   /* =====================================================
//      ASSIGNMENT
//   ===================================================== */

//   const fetchCustomersForAssignment = useCallback(async () => {
//     try {
//       setCustomersLoading(true);

//       const response = await fetch(CLOUD_CUSTOMERS_URL, {
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

//       setCustomers(normalizeList(result));
//     } catch (err) {
//       setAssignmentError(err.message || "Unable to load customers.");
//     } finally {
//       setCustomersLoading(false);
//     }
//   }, []);

//   const assignCustomer = async (customer) => {
//     if (!selectedDevice) return;

//     const customerId =
//       customer?.tpt_customer_id ||
//       customer?.cloud_customer_id ||
//       customer?.cloud_id ||
//       customer?.id?.id ||
//       customer?.id;

//     const deviceId = selectedDevice?.tpt_device_id || selectedDevice?.id;

//     if (!customerId) return setAssignmentError("Customer ID is missing.");
//     if (!deviceId) return setAssignmentError("Device ID is missing.");

//     setAssigning(true);
//     setAssignmentError("");

//     try {
//       const response = await fetch(ASSIGN_CUSTOMER_URL, {
//         method: "POST",
//         headers: authHeaders(),
//         body: JSON.stringify({
//           customer_id: customerId,
//           device_id: deviceId,
//         }),
//       });

//       const result = await response.json().catch(() => ({}));

//       if (!response.ok) {
//         throw new Error(
//           result?.message ||
//             result?.error ||
//             result?.detail ||
//             `HTTP ${response.status}`
//         );
//       }

//       const wasReassign = Boolean(selectedDevice?.customer_id);

//       setShowCustomerModal(false);
//       setSelectedDevice(null);
//       setCustomerSearch("");

//       await fetchDevices();
//       alert(
//         result?.data?.sync_error
//           ? `Device ${wasReassign ? "reassigned" : "assigned"} to customer and saved locally. Cloud sync is pending.`
//           : `Device ${wasReassign ? "reassigned" : "assigned"} to customer successfully.`
//       );
//     } catch (err) {
//       setAssignmentError(
//         err.message || "Unable to assign device to customer."
//       );
//     } finally {
//       setAssigning(false);
//     }
//   };

//   const assignSite = async (site) => {
//     if (!selectedDevice) return;

//     const assetId = site?.asset_id || site?.tpt_site_id;
//     const deviceId = selectedDevice?.tpt_device_id || selectedDevice?.id;

//     if (!assetId) return setAssignmentError("Site asset ID is missing.");
//     if (!deviceId) return setAssignmentError("Device ID is missing.");

//     setAssigning(true);
//     setAssignmentError("");

//     try {
//       const response = await fetch(ASSIGN_SITE_URL, {
//         method: "POST",
//         headers: authHeaders(),
//         body: JSON.stringify({
//           asset_id: assetId,
//           device_id: deviceId,
//         }),
//       });

//       const result = await response.json().catch(() => ({}));

//       if (!response.ok) {
//         throw new Error(
//           result?.message ||
//             result?.error ||
//             result?.detail ||
//             `HTTP ${response.status}`
//         );
//       }

//       const wasReassign = Boolean(selectedDevice?.site_id);

//       setShowSiteModal(false);
//       setSelectedDevice(null);
//       setSiteSearch("");

//       await fetchDevices();
//       alert(
//         result?.data?.sync_error
//           ? `Device ${wasReassign ? "reassigned" : "assigned"} to site and saved locally. Cloud sync is pending.`
//           : `Device ${wasReassign ? "reassigned" : "assigned"} to site successfully.`
//       );
//     } catch (err) {
//       setAssignmentError(err.message || "Unable to assign device to site.");
//     } finally {
//       setAssigning(false);
//     }
//   };

//   const openCustomerAssignment = async (device) => {
//     setSelectedDevice(device);
//     setAssignmentError("");
//     setCustomerSearch("");
//     setShowCustomerModal(true);

//     if (!customers.length) await fetchCustomersForAssignment();
//   };

//   const openSiteAssignment = async (device) => {
//     setSelectedDevice(device);
//     setAssignmentError("");
//     setSiteSearch("");
//     setShowSiteModal(true);

//     await fetchSites(device.customer_id);
//   };

//   const closeCustomerModal = () => {
//     setShowCustomerModal(false);
//     setSelectedDevice(null);
//     setCustomerSearch("");
//     setAssignmentError("");
//   };

//   const closeSiteModal = () => {
//     setShowSiteModal(false);
//     setSelectedDevice(null);
//     setSiteSearch("");
//     setAssignmentError("");
//   };

//   /* =====================================================
//      RELAY CONTROL
//   ===================================================== */

//   const handleRelayControl = async (device, turnOn) => {
//     const key = device.id || device.ac_id;
//     const deviceId = device.tpt_device_id;

//     if (!deviceId) {
//       setRelayErrors((prev) => ({
//         ...prev,
//         [key]: "3TP device ID is missing.",
//       }));
//       return;
//     }

//     setRelayLoading((prev) => ({ ...prev, [key]: true }));
//     setRelayErrors((prev) => ({ ...prev, [key]: "" }));

//     try {
//       const response = await fetch(RELAY_CONTROL_URL, {
//         method: "POST",
//         headers: authHeaders(),
//         body: JSON.stringify({
//           device_id: deviceId,
//           method: "Relay",
//           params: turnOn ? 1 : 0,
//         }),
//       });

//       const result = await response.json().catch(() => ({}));

//       if (!response.ok) {
//         throw new Error(
//           result.message || result.detail || `HTTP ${response.status}`
//         );
//       }

//       await fetchDevices();
//     } catch (err) {
//       setRelayErrors((prev) => ({
//         ...prev,
//         [key]: err.message || "Relay command failed.",
//       }));
//     } finally {
//       setRelayLoading((prev) => ({ ...prev, [key]: false }));
//     }
//   };

//   /* =====================================================
//      FILTERS
//   ===================================================== */

//   const filteredDevices = useMemo(() => {
//     const query = search.trim().toLowerCase();
//     if (!query) return devices;

//     return devices.filter((device) =>
//       [
//         device.ac_id,
//         device.device_name,
//         device.label,
//         device.status,
//         device.customer_name,
//         device.site_name,
//         device.site_code,
//         device.branch_name,
//         device.floor_name,
//         device.state_name,
//         device.district_name,
//         device.zone_name,
//         device.circle_name,
//         device.tpt_device_id,
//       ]
//         .filter(Boolean)
//         .some((value) => String(value).toLowerCase().includes(query))
//     );
//   }, [devices, search]);

//   const filteredCustomers = useMemo(() => {
//     const query = customerSearch.trim().toLowerCase();
//     if (!query) return customers;

//     return customers.filter((customer) =>
//       [customer.company, customer.name, customer.code, customer.id]
//         .filter(Boolean)
//         .some((value) => String(value).toLowerCase().includes(query))
//     );
//   }, [customers, customerSearch]);

//   const filteredSites = useMemo(() => {
//     const query = siteSearch.trim().toLowerCase();
//     if (!query) return sites;

//     return sites.filter((site) =>
//       [
//         site.name,
//         site.code,
//         site.asset_id,
//         site.tpt_site_id,
//         site.id,
//         site.state_name,
//         site.district_name,
//         site.taluka_name,
//         site.city_name,
//         site.zone_name,
//         site.circle_name,
//         site.region_name,
//         site.division_name,
//         site.branch_name,
//         site.floor_name,
//       ]
//         .filter(Boolean)
//         .some((value) => String(value).toLowerCase().includes(query))
//     );
//   }, [sites, siteSearch]);

//   /* =====================================================
//      INLINE ACTION BUTTON STYLES
//   ===================================================== */

//   const iconBtnStyle = {
//     display: "inline-flex",
//     alignItems: "center",
//     justifyContent: "center",
//     width: 30,
//     height: 30,
//     padding: 0,
//     borderRadius: 6,
//     border: "1px solid #e5e7eb",
//     background: "#fff",
//     cursor: "pointer",
//     marginLeft: 6,
//     transition: "background .15s, border-color .15s",
//   };

//   const editBtnStyle = { ...iconBtnStyle, color: "#2563eb" };
//   const deleteBtnStyle = { ...iconBtnStyle, color: "#dc2626" };
//   const smallEditBtnStyle = {
//     ...iconBtnStyle,
//     width: 24,
//     height: 24,
//     marginLeft: 8,
//     borderColor: "transparent",
//     background: "transparent",
//   };

//   /* =====================================================
//      RENDER
//   ===================================================== */

//   return (
//     <div className="admins-page">
//       <ol className="admins-stepper">
//         <li className={view === "list" ? "active" : "done"}>
//           <button type="button" className="step-btn" onClick={backToList}>
//             <span className="step-num">1</span>
//             Devices
//           </button>
//         </li>

//         <li className={view === "form" ? "active" : ""}>
//           <button
//             type="button"
//             className="step-btn"
//             onClick={() => (editingDevice ? null : openCreate())}
//           >
//             <span className="step-num">2</span>
//             {editingDevice ? "Edit Device" : "Add Device"}
//           </button>
//         </li>
//       </ol>

//       {/* =================================================
//           DEVICE LIST VIEW
//       ================================================= */}

//       {view === "list" ? (
//         <>
//           <div className="admins-header">
//             <div>
//               <h1>AC Devices</h1>
//               <p>
//                 Create devices independently and assign customer or site
//                 separately.
//               </p>
//             </div>
//           </div>

//           <div className="admins-toolbar">
//             <div style={{ position: "relative", flex: 1 }}>
//               <FiSearch
//                 style={{
//                   position: "absolute",
//                   left: 12,
//                   top: 12,
//                   color: "#9ca3af",
//                 }}
//               />

//               <input
//                 className="admins-search"
//                 style={{ paddingLeft: 36, width: "100%" }}
//                 placeholder="Search by AC ID, device, customer or site..."
//                 value={search}
//                 onChange={(event) => setSearch(event.target.value)}
//               />
//             </div>

//             <span className="admins-count">
//               {filteredDevices.length} of {devices.length} devices
//             </span>

//             <button
//               type="button"
//               className="btn-secondary"
//               onClick={() => {
//                 fetchDevices();
//                 fetchCustomers();
//               }}
//             >
//               <FiRefreshCw />
//               Refresh
//             </button>
//           </div>

//           {error && <div className="admins-error">{error}</div>}

//           <div className="admins-table-card">
//             {loading ? (
//               <div className="admins-loading">Loading devices...</div>
//             ) : filteredDevices.length === 0 ? (
//               <div className="admins-empty">No AC devices found.</div>
//             ) : (
//               <table
//                 className="admins-table"
//                 style={{ tableLayout: "fixed", width: "100%" }}
//               >
//                 <thead>
//                   <tr>
//                     <th>AC ID</th>
//                     <th>Device</th>
//                     <th>Customer</th>
//                     <th>Branch</th>
//                     <th>Status</th>
//                     <th>Actions</th>
//                     <th>Relay Control</th>
//                   </tr>
//                 </thead>

//                 <tbody>
//                   {filteredDevices.map((device) => {
//                     const key = device.id || device.ac_id;

//                     const customer =
//                       device.customer_name ||
//                       (device.customer_id
//                         ? `Customer #${device.customer_id}`
//                         : null);

//                     const site =
//                       device.site_name ||
//                       (device.site_id ? `Site #${device.site_id}` : null);

//                     const hasCustomer = Boolean(customer);
//                     const hasSite = Boolean(site);
//                     const isDeleting = deletingKey === key;

//                     return (
//                       <tr key={key}>
//                         <td>
//                           <strong>{device.ac_id}</strong>
//                         </td>

//                         <td>{device.device_name || "—"}</td>

//                         {/* ---------- CUSTOMER ---------- */}
//                         <td>
//                           {hasCustomer ? (
//                             <strong>{customer}</strong>
//                           ) : (
//                             <span className="assignment-unassigned">Unassigned</span>
//                           )}
//                         </td>

//                         {/* ---------- SITE ---------- */}
//                         <td>
//                           {hasSite ? (
//                             <strong>{site}</strong>
//                           ) : (
//                             <span className="assignment-unassigned">Unassigned</span>
//                           )}
//                         </td>

//                         {/* ---------- STATUS ---------- */}
//                         <td>
//                           <span
//                             className={
//                               device.status === "ON"
//                                 ? "status-active"
//                                 : "status-inactive"
//                             }
//                           >
//                             ● {device.status || "OFF"}
//                           </span>
//                         </td>

//                         {/* ---------- RELAY + EDIT + DELETE ---------- */}
//                         <td>
//                           <div
//                             className="relay-control"
//                             style={{
//                               display: "flex",
//                               alignItems: "center",
//                               flexWrap: "wrap",
//                               gap: 6,
//                             }}
//                           >
//                             {canAssignCustomer && (
//                               <button
//                                 type="button"
//                                 title={hasCustomer ? "Change customer" : "Assign customer"}
//                                 aria-label={hasCustomer ? "Change customer" : "Assign customer"}
//                                 style={editBtnStyle}
//                                 onClick={() => openCustomerAssignment(device)}
//                                 disabled={isDeleting}
//                               >
//                                 <FiUserPlus size={16} />
//                               </button>
//                             )}

//                             {/* Assign or change branch */}
//                             <button
//                               type="button"
//                               title={hasSite ? "Change branch" : "Assign branch"}
//                               aria-label={hasSite ? "Change branch" : "Assign branch"}
//                               style={{ ...editBtnStyle, color: "#16a34a" }}
//                               onClick={() => openSiteAssignment(device)}
//                               disabled={isDeleting}
//                             >
//                               <FiMapPin size={16} />
//                             </button>

//                             {/* EDIT */}
//                             <button
//                               type="button"
//                               title="Edit device"
//                               aria-label="Edit device"
//                               style={editBtnStyle}
//                               onClick={() => openEdit(device)}
//                               disabled={isDeleting}
//                             >
//                               <FiEdit2 size={15} />
//                             </button>

//                             {/* DELETE */}
//                             <button
//                               type="button"
//                               title="Delete device"
//                               aria-label="Delete device"
//                               style={{
//                                 ...deleteBtnStyle,
//                                 opacity: isDeleting ? 0.5 : 1,
//                               }}
//                               onClick={() => handleDelete(device)}
//                               disabled={isDeleting}
//                             >
//                               <FiTrash2 size={15} />
//                             </button>
//                           </div>
//                         </td>

//                         <td>                                                            {/* Relay button */}
//                           <label className="relay-switch">
//                             <input
//                               type="checkbox"
//                               checked={device.status === "ON"}
//                               disabled={!!relayLoading[key]}
//                               onChange={(event) =>
//                                 handleRelayControl(
//                                   device,
//                                   event.target.checked
//                                 )
//                               }
//                             />
//                             <span className="relay-slider" />
//                           </label>

//                           {relayErrors[key] && (
//                             <div className="relay-error">
//                               {relayErrors[key]}
//                             </div>
//                           )}
//                         </td>
//                       </tr>
//                     );
//                   })}
//                 </tbody>
//               </table>
//             )}
//           </div>
//         </>
//       ) : (
//         //  CREATE / EDIT DEVICE VIEW
        
//         <div className="admins-panel">
//           <div className="admins-panel-header">
//             <FiCpu size={22} />
//             <div>
//               <h2>{editingDevice ? "Edit AC Device" : "Add AC Device"}</h2>
//               <p>
//                 {editingDevice
//                   ? `Updating ${editingDevice.ac_id}. Leave MQTT password blank to keep the current one.`
//                   : "Create the device independently. Customer and Site can be assigned later."}
//               </p>
//             </div>
//           </div>

//           <form className="admins-form" onSubmit={handleSubmit}>
//             <div className="form-grid">
//               <label>
//                 AC ID *
//                 <input
//                   value={form.ac_id}
//                   onChange={(event) =>
//                     setForm((previous) => ({
//                       ...previous,
//                       ac_id: event.target.value,
//                     }))
//                   }
//                   placeholder="AC-MH-PUN-001"
//                   required
//                 />
//               </label>

//               <label>
//                 Device Name *
//                 <input
//                   value={form.device_name}
//                   onChange={(event) =>
//                     setForm((previous) => ({
//                       ...previous,
//                       device_name: event.target.value,
//                     }))
//                   }
//                   placeholder="Pune Office AC 01"
//                   required
//                 />
//               </label>

//               <label>
//                 Status *
//                 <select
//                   value={form.status}
//                   onChange={(event) =>
//                     setForm((previous) => ({
//                       ...previous,
//                       status: event.target.value,
//                     }))
//                   }
//                 >
//                   <option value="OFF">OFF</option>
//                   <option value="ON">ON</option>
//                 </select>
//               </label>

//               <label>
//                 Capacity (Ton) *
//                 <input
//                   type="number"
//                   min="0.1"
//                   step="0.1"
//                   value={form.capacity_ton}
//                   onChange={(event) =>
//                     setForm((previous) => ({
//                       ...previous,
//                       capacity_ton: event.target.value,
//                     }))
//                   }
//                   placeholder="1.5"
//                   required
//                 />
//               </label>

//               <label>
//                 Installation Date *
//                 <input
//                   type="date"
//                   value={form.installation_date}
//                   onChange={(event) =>
//                     setForm((previous) => ({
//                       ...previous,
//                       installation_date: event.target.value,
//                     }))
//                   }
//                   required
//                 />
//               </label>

//               <label>
//                 Last Maintenance Date
//                 <input
//                   type="date"
//                   value={form.last_maintenance_date}
//                   min={form.installation_date || undefined}
//                   onChange={(event) =>
//                     setForm((previous) => ({
//                       ...previous,
//                       last_maintenance_date: event.target.value,
//                     }))
//                   }
//                 />
//               </label>
//             </div>

//             <div className="assign-card" style={{ marginTop: 20 }}>
//               <div className="admins-panel-header">
//                 <FiCheckCircle />
//                 <div>
//                   <p>
//                     {editingDevice
//                       ? "Customer and Site assignments are edited from the device list."
//                       : "This operation only creates the device. Customer and Site are assigned separately from the device list."}
//                   </p>
//                 </div>
//               </div>
//             </div>

//             {/* ---- MQTT Credentials ---- */}
//             <div className="admins-panel-header" style={{ marginTop: 20 }}>
//               <div>
//                 <p>MQTT Credentials</p>
//               </div>
//             </div>

//             <div className="form-grid">
//               <label>
//                 MQTT Client ID {editingDevice ? "" : "*"}
//                 <input
//                   type="text"
//                   value={form.clientid}
//                   onChange={(event) =>
//                     setForm((previous) => ({
//                       ...previous,
//                       clientid: event.target.value,
//                     }))
//                   }
//                   placeholder="AC-MH-PUN-001"
//                   autoComplete="off"
//                   required={!editingDevice}
//                 />
//               </label>

//               <label>
//                 MQTT Username {editingDevice ? "" : "*"}
//                 <input
//                   type="text"
//                   value={form.username}
//                   onChange={(event) =>
//                     setForm((previous) => ({
//                       ...previous,
//                       username: event.target.value,
//                     }))
//                   }
//                   placeholder="Enter MQTT username"
//                   autoComplete="off"
//                   required={!editingDevice}
//                 />
//               </label>

//               <label>
//                 MQTT Password{" "}
//                 {editingDevice ? "(leave blank to keep)" : "*"}
//                 <input
//                   type="password"
//                   value={form.password}
//                   onChange={(event) =>
//                     setForm((previous) => ({
//                       ...previous,
//                       password: event.target.value,
//                     }))
//                   }
//                   placeholder={
//                     editingDevice
//                       ? "Leave blank to keep current password"
//                       : "Enter MQTT password"
//                   }
//                   autoComplete="new-password"
//                   required={!editingDevice}
//                 />
//               </label>
//             </div>

//             {formError && <div className="form-error">{formError}</div>}

//             <div className="panel-actions">
//               <button
//                 type="button"
//                 className="btn-secondary"
//                 onClick={backToList}
//                 disabled={saving}
//               >
//                 Cancel
//               </button>

//               <button
//                 type="submit"
//                 className="btn-primary"
//                 disabled={saving}
//               >
//                 {saving
//                   ? editingDevice
//                     ? "Updating..."
//                     : "Creating..."
//                   : editingDevice
//                   ? "Update Device"
//                   : "Create Device"}
//               </button>
//             </div>
//           </form>
//         </div>
//       )}

      
//       {/* CUSTOMER ASSIGNMENT MODAL */}
//       {showCustomerModal && selectedDevice && (
//         <div className="assignment-modal-overlay" onClick={closeCustomerModal}>
//           <div
//             className="assignment-modal"
//             onClick={(event) => event.stopPropagation()}
//           >
//             <div
//               className="admins-panel-header"
//               style={{ justifyContent: "space-between" }}
//             >
//               <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
//                 <FiUserPlus />
//                 <div>
//                   <h2>
//                     {selectedDevice.customer_id
//                       ? "Change Customer"
//                       : "Assign Customer"}
//                   </h2>
//                   <p>
//                     Device: <strong>{selectedDevice.ac_id}</strong>
//                   </p>
//                 </div>
//               </div>

//               <button
//                 type="button"
//                 className="btn-secondary"
//                 onClick={closeCustomerModal}
//               >
//                 <FiX />
//               </button>
//             </div>

//             <div className="assign-card" style={{ marginTop: 18 }}>
//               <div className="assign-row">
//                 <span className="assign-label">AC ID</span>
//                 <span className="assign-value">{selectedDevice.ac_id}</span>
//               </div>

//               <div className="assign-row">
//                 <span className="assign-label">Device</span>
//                 <span className="assign-value">
//                   {selectedDevice.device_name || "—"}
//                 </span>
//               </div>

//               <div className="assign-row">
//                 <span className="assign-label">Customer</span>
//                 <span className="assign-value">
//                   {selectedDevice.customer_name || "Not assigned"}
//                 </span>
//               </div>

//               <div className="assign-row">
//                 <span className="assign-label">Site</span>
//                 <span className="assign-value">
//                   {selectedDevice.site_name || "Not assigned"}
//                 </span>
//               </div>
//             </div>

//             <div style={{ marginTop: 20 }}>
//               <label>
//                 Search Customer
//                 <input
//                   value={customerSearch}
//                   onChange={(event) => setCustomerSearch(event.target.value)}
//                   placeholder="Search customer..."
//                 />
//               </label>

//               <div
//                 style={{ marginTop: 12, maxHeight: 260, overflowY: "auto" }}
//               >
//                 {customersLoading ? (
//                   <div className="admins-loading">Loading customers...</div>
//                 ) : filteredCustomers.length === 0 ? (
//                   <div className="admins-empty">No customers found.</div>
//                 ) : (
//                   filteredCustomers.map((customer) => (
//                     <button
//                       key={
//                         customer.tpt_customer_id ||
//                         customer.cloud_customer_id ||
//                         customer.id?.id ||
//                         customerLabel(customer)
//                       }
//                       type="button"
//                       className="btn-secondary"
//                       style={{
//                         width: "100%",
//                         justifyContent: "space-between",
//                         marginBottom: 8,
//                       }}
//                       onClick={() => assignCustomer(customer)}
//                       disabled={assigning}
//                     >
//                       <span>{customerLabel(customer)}</span>
//                       <FiUserPlus />
//                     </button>
//                   ))
//                 )}
//               </div>
//             </div>

//             {assignmentError && (
//               <div className="form-error" style={{ marginTop: 15 }}>
//                 {assignmentError}
//               </div>
//             )}

//             <div className="panel-actions">
//               <button
//                 type="button"
//                 className="btn-secondary"
//                 onClick={closeCustomerModal}
//                 disabled={assigning}
//               >
//                 Cancel
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* =====================================================
//           SITE ASSIGNMENT MODAL
//       ===================================================== */}

//       {showSiteModal && selectedDevice && (
//         <div className="assignment-modal-overlay" onClick={closeSiteModal}>
//           <div
//             className="assignment-modal"
//             onClick={(event) => event.stopPropagation()}
//           >
//             <div
//               className="admins-panel-header"
//               style={{ justifyContent: "space-between" }}
//             >
//               <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
//                 <FiMapPin />
//                 <div>
//                   <h2>
//                     {selectedDevice.site_id ? "Change Site" : "Assign Site"}
//                   </h2>
//                   <p>
//                     Device: <strong>{selectedDevice.ac_id}</strong>
//                   </p>
//                 </div>
//               </div>

//               <button
//                 type="button"
//                 className="btn-secondary"
//                 onClick={closeSiteModal}
//               >
//                 <FiX />
//               </button>
//             </div>

//             <div className="assign-card" style={{ marginTop: 18 }}>
//               <div className="assign-row">
//                 <span className="assign-label">AC ID</span>
//                 <span className="assign-value">{selectedDevice.ac_id}</span>
//               </div>

//               <div className="assign-row">
//                 <span className="assign-label">Device</span>
//                 <span className="assign-value">
//                   {selectedDevice.device_name || "—"}
//                 </span>
//               </div>

//               <div className="assign-row">
//                 <span className="assign-label">Customer</span>
//                 <span className="assign-value">
//                   {selectedDevice.customer_name || "Not assigned"}
//                 </span>
//               </div>

//               <div className="assign-row">
//                 <span className="assign-label">Site</span>
//                 <span className="assign-value">
//                   {selectedDevice.site_name || "Not assigned"}
//                 </span>
//               </div>
//             </div>

//             <div style={{ marginTop: 20 }}>
//               <label>
//                 Search Branch
//                 <input
//                   value={siteSearch}
//                   onChange={(event) => setSiteSearch(event.target.value)}
//                   placeholder="Search site..."
//                 />
//               </label>

//               <div className="site-assignment-list">
//                 {sitesLoading ? (
//                   <div className="admins-loading">Loading branch...</div>
//                 ) : filteredSites.length === 0 ? (
//                   <div className="admins-empty">No branch found.</div>
//                 ) : (
//                   filteredSites.map((site) => {
//                     const siteId =
//                       site.asset_id ||
//                       site.tpt_site_id ||
//                       site.id?.id ||
//                       site.id;

//                     const location = [
//                       site.state_name,
//                       site.district_name,
//                       site.taluka_name,
//                       site.city_name,
//                       site.branch_name,
//                       site.floor_name,
//                     ]
//                       .filter(Boolean)
//                       .join(" › ");

//                     return (
//                       <button
//                         key={siteId}
//                         type="button"
//                         className="site-assignment-item"
//                         onClick={() => assignSite(site)}
//                         disabled={assigning}
//                       >
//                         <div className="site-assignment-info">
//                           <strong>{site.name || "Unnamed Site"}</strong>
//                           <span>{site.code || "No code"}</span>
//                           {location && <small>{location}</small>}
//                           <small>ID: {siteId}</small>
//                         </div>

//                         <div className="site-assignment-action">
//                           <FiMapPin />
//                           Assign
//                         </div>
//                       </button>
//                     );
//                   })
//                 )}
//               </div>
//             </div>

//             {assignmentError && (
//               <div className="form-error" style={{ marginTop: 15 }}>
//                 {assignmentError}
//               </div>
//             )}

//             <div className="panel-actions">
//               <button
//                 type="button"
//                 className="btn-secondary"
//                 onClick={closeSiteModal}
//                 disabled={assigning}
//               >
//                 Cancel
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// export default ACCreation;


import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCheckCircle,
  FiCpu,
  FiRefreshCw,
  FiSearch,
  FiUserPlus,
  FiMapPin,
  FiX,
  FiEdit2,
  FiTrash2,
} from "react-icons/fi";
import { useAuth } from "../Layout/AuthContext";
import "./AdminCreation.css";

/* =====================================================
   API ENDPOINTS
===================================================== */

const API_BASE = "http://localhost:8000/api";

const DEVICES_URL          = `${API_BASE}/devices/`;
const CREATE_DEVICE_URL    = `${API_BASE}/devices/create/`;
const ASSIGN_CUSTOMER_URL  = `${API_BASE}/devices/assign/customer/`;
const ASSIGN_SITE_URL      = `${API_BASE}/devices/assign/site/`;
const RELAY_CONTROL_URL    = `${API_BASE}/devices/relay/`;
const CUSTOMERS_URL        = `${API_BASE}/customers/`;
const CLOUD_CUSTOMERS_URL  = `${API_BASE}/cloud/customers/`;
const SITES_URL            = `${API_BASE}/cloud/sites/?pageSize=1000&page=0`;

// Standard REST detail URL — used for edit (PATCH) and delete (DELETE).
const deviceDetailUrl = (deviceId) =>
  `${API_BASE}/devices/${encodeURIComponent(deviceId)}/`;

// When a device belongs to a customer, only that customer's sites are offered.
const sitesUrlFor = (customerId) =>
  customerId
    ? `${SITES_URL}&customer=${encodeURIComponent(customerId)}`
    : SITES_URL;

/* =====================================================
   HELPERS
===================================================== */

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
      customer.title ||
      customer.name ||
      customer.code ||
      `Customer #${customer.id}`
    : "—";

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

/* =====================================================
   COMPONENT
===================================================== */

function ACCreation() {
  const { user } = useAuth();
  const canAssignCustomer = user?.role === "ORG_SUPER_ADMIN";

  /* ---------- state ---------- */
  const [view, setView] = useState("list");
  const [devices, setDevices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sites, setSites] = useState([]);

  const [form, setForm] = useState(emptyForm);
  const [editingDevice, setEditingDevice] = useState(null); // null = create mode
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingKey, setDeletingKey] = useState(null); // row key while deleting
  const [deleteCandidate, setDeleteCandidate] = useState(null);

  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [siteSearch, setSiteSearch] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");

  const [relayLoading, setRelayLoading] = useState({});
  const [relayErrors, setRelayErrors] = useState({});
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(null), 3500);
  }, []);

  /* =====================================================
     FETCHERS
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

  const fetchSites = useCallback(async (customerId) => {
    try {
      setSitesLoading(true);
      setAssignmentError("");

      const response = await fetch(sitesUrlFor(customerId), {
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
          asset_id:
            site?.asset_id || site?.tpt_site_id || site?.id?.id || site?.id,
          name: site?.name || site?.title || site?.label || "Unnamed Site",
          code: site?.code || site?.label || "",
          hierarchy_type: site?.hierarchy_type || site?.hierarchyType || "",
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

      setSites(normalizedSites);
    } catch (err) {
      console.error("SITE FETCH ERROR:", err);
      setAssignmentError(err.message || "Unable to load sites from cloud.");
      setSites([]);
    } finally {
      setSitesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    fetchCustomers();
  }, [fetchDevices, fetchCustomers]);

  /* =====================================================
     CREATE / EDIT DEVICE
  ===================================================== */

  const openCreate = () => {
    setEditingDevice(null);
    setForm(emptyForm);
    setFormError("");
    setView("form");
  };

  const openEdit = (device) => {
    setEditingDevice(device);
    setForm({
      ac_id: device.ac_id || "",
      device_name: device.device_name || "",
      status: device.status || "OFF",
      capacity_ton:
        device.capacity_ton === null || device.capacity_ton === undefined
          ? ""
          : String(device.capacity_ton),
      installation_date: device.installation_date || "",
      last_maintenance_date: device.last_maintenance_date || "",
      clientid: device.clientid || "",
      username: device.username || "",
      password: "", // never prefill passwords
    });
    setFormError("");
    setView("form");
  };

  const backToList = () => {
    setView("list");
    setForm(emptyForm);
    setEditingDevice(null);
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

    // MQTT credentials required only on create.
    if (!editingDevice) {
      if (!form.clientid.trim())
        return setFormError("MQTT Client ID is required.");
      if (!form.username.trim())
        return setFormError("MQTT Username is required.");
      if (!form.password)
        return setFormError("MQTT Password is required.");
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

      if (form.clientid.trim()) payload.clientid = form.clientid.trim();
      if (form.username.trim()) payload.username = form.username.trim();
      // Only send password if the user entered a new one.
      if (form.password) payload.password = form.password;

      const isEdit = Boolean(editingDevice);
      const deviceId = editingDevice?.tpt_device_id || editingDevice?.id;

      if (isEdit && !deviceId) {
        throw new Error("Device ID is missing — cannot update.");
      }

      const url = isEdit ? deviceDetailUrl(deviceId) : CREATE_DEVICE_URL;
      const method = isEdit ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
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
      setEditingDevice(null);

      showToast(
        isEdit
          ? "Device updated successfully."
          : "Device created successfully. You can now assign a customer and site.",
        "success"
      );
    } catch (err) {
      setFormError(err.message || "Unable to save device.");
    } finally {
      setSaving(false);
    }
  };

  /* =====================================================
     DELETE DEVICE
  ===================================================== */

  const handleDelete = async (device) => {
    const deviceId = device.tpt_device_id || device.id;

    if (!deviceId) {
      showToast("Device ID is missing — cannot delete.", "error");
      return;
    }

    const key = device.id || device.ac_id;
    setDeletingKey(key);

    try {
      const response = await fetch(deviceDetailUrl(deviceId), {
        method: "DELETE",
        headers: authHeaders(),
      });

      // 204 No Content is the norm; anything 2xx is fine.
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(
          result?.message ||
            result?.detail ||
            result?.error ||
            `HTTP ${response.status}`
        );
      }

      await fetchDevices();
      showToast("Device deleted successfully.", "success");
    } catch (err) {
      showToast(err.message || "Unable to delete device.", "error");
    } finally {
      setDeletingKey(null);
    }
  };

  /* =====================================================
     ASSIGNMENT
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
      customer?.cloud_id ||
      customer?.id?.id ||
      customer?.id;

    const deviceId = selectedDevice?.tpt_device_id || selectedDevice?.id;

    if (!customerId) return setAssignmentError("Customer ID is missing.");
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

      const wasReassign = Boolean(selectedDevice?.customer_id);

      setShowCustomerModal(false);
      setSelectedDevice(null);
      setCustomerSearch("");

      await fetchDevices();
      showToast(
        result?.data?.sync_error
          ? `Device ${wasReassign ? "reassigned" : "assigned"} to customer and saved locally. Cloud sync is pending.`
          : `Device ${wasReassign ? "reassigned" : "assigned"} to customer successfully.`,
        result?.data?.sync_error ? "warning" : "success"
      );
    } catch (err) {
      setAssignmentError(err.message || "Unable to assign device to customer.");
      showToast(err.message || "Unable to assign device to customer.", "error");
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

      const wasReassign = Boolean(selectedDevice?.site_id);

      setShowSiteModal(false);
      setSelectedDevice(null);
      setSiteSearch("");

      await fetchDevices();
      showToast(
        result?.data?.sync_error
          ? `Device ${wasReassign ? "reassigned" : "assigned"} to branch and saved locally. Cloud sync is pending.`
          : `Device ${wasReassign ? "reassigned" : "assigned"} to branch successfully.`,
        result?.data?.sync_error ? "warning" : "success"
      );
    } catch (err) {
      setAssignmentError(err.message || "Unable to assign device to branch.");
      showToast(err.message || "Unable to assign device to branch.", "error");
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

    await fetchSites(device.customer_id);
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
     RELAY CONTROL
  ===================================================== */

  const handleRelayControl = async (device, turnOn) => {
    const key = device.id || device.ac_id;
    const deviceId = device.tpt_device_id;

    if (!deviceId) {
      setRelayErrors((prev) => ({
        ...prev,
        [key]: "3TP device ID is missing.",
      }));
      return;
    }

    setRelayLoading((prev) => ({ ...prev, [key]: true }));
    setRelayErrors((prev) => ({ ...prev, [key]: "" }));

    try {
      const response = await fetch(RELAY_CONTROL_URL, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          device_id: deviceId,
          method: "Relay",
          params: turnOn ? 1 : 0,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.message || result.detail || `HTTP ${response.status}`
        );
      }

      await fetchDevices();
      showToast(`Relay ${turnOn ? "ON" : "OFF"} command sent for ${device.ac_id}.`, "success");
    } catch (err) {
      setRelayErrors((prev) => ({
        ...prev,
        [key]: err.message || "Relay command failed.",
      }));
      showToast(err.message || "Relay command failed.", "error");
    } finally {
      setRelayLoading((prev) => ({ ...prev, [key]: false }));
    }
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

  const filteredSites = useMemo(() => {
    const query = siteSearch.trim().toLowerCase();
    if (!query) return sites;

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
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [sites, siteSearch]);

  /* =====================================================
     INLINE ACTION BUTTON STYLES
  ===================================================== */

  const iconBtnStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 30,
    height: 30,
    padding: 0,
    borderRadius: 6,
    border: "1px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
    marginLeft: 6,
    transition: "background .15s, border-color .15s",
  };

  const editBtnStyle = { ...iconBtnStyle, color: "#2563eb" };
  const deleteBtnStyle = { ...iconBtnStyle, color: "#dc2626" };
  const smallEditBtnStyle = {
    ...iconBtnStyle,
    width: 24,
    height: 24,
    marginLeft: 8,
    borderColor: "transparent",
    background: "transparent",
  };

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <div className="admins-page">
      {toast && (
        <div
          className={`admins-toast ${toast.type === "success" ? "admins-toast-success" : "admins-toast-error"}`}
          role={toast.type === "error" ? "alert" : "status"}
          aria-live={toast.type === "error" ? "assertive" : "polite"}
        >
          <span className="admins-toast-icon" aria-hidden="true">
            {toast.type === "error" ? "✕" : toast.type === "warning" ? "⚠" : "✓"}
          </span>
          <span>{toast.message}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
            style={{
              marginLeft: 6,
              padding: 0,
              border: 0,
              background: "transparent",
              color: "inherit",
              fontSize: 20,
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
      )}
      <ol className="admins-stepper">
        <li className={view === "list" ? "active" : "done"}>
          <button type="button" className="step-btn" onClick={backToList}>
            <span className="step-num">1</span>
            Devices
          </button>
        </li>

        <li className={view === "form" ? "active" : ""}>
          <button
            type="button"
            className="step-btn"
            onClick={() => (editingDevice ? null : openCreate())}
          >
            <span className="step-num">2</span>
            {editingDevice ? "Edit Device" : "Add Device"}
          </button>
        </li>
      </ol>

      {/* =================================================
          DEVICE LIST VIEW
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
                    <th>Branch</th>
                    <th>Status</th>
                    <th>Actions</th>
                    <th>Relay Control</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredDevices.map((device) => {
                    const key = device.id || device.ac_id;

                    const customer =
                      device.customer_name ||
                      (device.customer_id
                        ? `Customer #${device.customer_id}`
                        : null);

                    const site =
                      device.site_name ||
                      (device.site_id ? `Site #${device.site_id}` : null);

                    const hasCustomer = Boolean(customer);
                    const hasSite = Boolean(site);
                    const isDeleting = deletingKey === key;

                    return (
                      <tr key={key}>
                        <td>
                          <strong>{device.ac_id}</strong>
                        </td>

                        <td>{device.device_name || "—"}</td>

                        {/* ---------- CUSTOMER ---------- */}
                        <td>
                          {hasCustomer ? (
                            <strong>{customer}</strong>
                          ) : (
                            <span className="assignment-unassigned">Unassigned</span>
                          )}
                        </td>

                        {/* ---------- SITE ---------- */}
                        <td>
                          {hasSite ? (
                            <strong>{site}</strong>
                          ) : (
                            <span className="assignment-unassigned">Unassigned</span>
                          )}
                        </td>

                        {/* ---------- STATUS ---------- */}
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

                        {/* ---------- RELAY + EDIT + DELETE ---------- */}
                        <td>
                          <div
                            className="relay-control"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              flexWrap: "wrap",
                              gap: 6,
                            }}
                          >
                            {canAssignCustomer && (
                              <button
                                type="button"
                                title={hasCustomer ? "Change customer" : "Assign customer"}
                                aria-label={hasCustomer ? "Change customer" : "Assign customer"}
                                style={editBtnStyle}
                                onClick={() => openCustomerAssignment(device)}
                                disabled={isDeleting}
                              >
                                <FiUserPlus size={16} />
                              </button>
                            )}

                            {/* Assign or change branch */}
                            <button
                              type="button"
                              title={hasSite ? "Change branch" : "Assign branch"}
                              aria-label={hasSite ? "Change branch" : "Assign branch"}
                              style={{ ...editBtnStyle, color: "#16a34a" }}
                              onClick={() => openSiteAssignment(device)}
                              disabled={isDeleting}
                            >
                              <FiMapPin size={16} />
                            </button>

                            {/* EDIT */}
                            <button
                              type="button"
                              title="Edit device"
                              aria-label="Edit device"
                              style={editBtnStyle}
                              onClick={() => openEdit(device)}
                              disabled={isDeleting}
                            >
                              <FiEdit2 size={15} />
                            </button>

                            {/* DELETE */}
                            <button
                              type="button"
                              title="Delete device"
                              aria-label="Delete device"
                              style={{
                                ...deleteBtnStyle,
                                opacity: isDeleting ? 0.5 : 1,
                              }}
                              onClick={() => setDeleteCandidate(device)}
                              disabled={isDeleting}
                            >
                              <FiTrash2 size={15} />
                            </button>
                          </div>
                        </td>

                        <td>                                                            {/* Relay button */}
                          <label className="relay-switch">
                            <input
                              type="checkbox"
                              checked={device.status === "ON"}
                              disabled={!!relayLoading[key]}
                              onChange={(event) =>
                                handleRelayControl(
                                  device,
                                  event.target.checked
                                )
                              }
                            />
                            <span className="relay-slider" />
                          </label>

                          {relayErrors[key] && (
                            <div className="relay-error">
                              {relayErrors[key]}
                            </div>
                          )}
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
        //  CREATE / EDIT DEVICE VIEW
        
        <div className="admins-panel">
          <div className="admins-panel-header">
            <FiCpu size={22} />
            <div>
              <h2>{editingDevice ? "Edit AC Device" : "Add AC Device"}</h2>
              <p>
                {editingDevice
                  ? `Updating ${editingDevice.ac_id}. Leave MQTT password blank to keep the current one.`
                  : "Create the device independently. Customer and Site can be assigned later."}
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
                  <p>
                    {editingDevice
                      ? "Customer and Site assignments are edited from the device list."
                      : "This operation only creates the device. Customer and Site are assigned separately from the device list."}
                  </p>
                </div>
              </div>
            </div>

            {/* ---- MQTT Credentials ---- */}
            <div className="admins-panel-header" style={{ marginTop: 20 }}>
              <div>
                <p>MQTT Credentials</p>
              </div>
            </div>

            <div className="form-grid">
              <label>
                MQTT Client ID {editingDevice ? "" : "*"}
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
                  required={!editingDevice}
                />
              </label>

              <label>
                MQTT Username {editingDevice ? "" : "*"}
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
                  required={!editingDevice}
                />
              </label>

              <label>
                MQTT Password{" "}
                {editingDevice ? "(leave blank to keep)" : "*"}
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      password: event.target.value,
                    }))
                  }
                  placeholder={
                    editingDevice
                      ? "Leave blank to keep current password"
                      : "Enter MQTT password"
                  }
                  autoComplete="new-password"
                  required={!editingDevice}
                />
              </label>
            </div>

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

              <button
                type="submit"
                className="btn-primary"
                disabled={saving}
              >
                {saving
                  ? editingDevice
                    ? "Updating..."
                    : "Creating..."
                  : editingDevice
                  ? "Update Device"
                  : "Create Device"}
              </button>
            </div>
          </form>
        </div>
      )}

      
      {/* DELETE CONFIRMATION MODAL */}
      {deleteCandidate && (
        <div
          className="admins-modal-overlay"
          onClick={() => {
            if (!deletingKey) setDeleteCandidate(null);
          }}
        >
          <div
            className="admins-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-device-title"
            aria-describedby="delete-device-description"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admins-modal-header">
              <FiTrash2 size={20} color="#dc2626" />
              <h3 id="delete-device-title">Delete AC device?</h3>
            </div>

            <div className="admins-modal-body">
              <p>
                Are you sure you want to delete{" "}
                <strong>{deleteCandidate.ac_id}</strong>
                {deleteCandidate.device_name
                  ? ` (${deleteCandidate.device_name})`
                  : ""}
                ?
              </p>
              <p className="admins-modal-warning">
                This action cannot be undone.
              </p>
            </div>

            <div className="admins-modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeleteCandidate(null)}
                disabled={Boolean(deletingKey)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={async () => {
                  const device = deleteCandidate;
                  if (!device) return;
                  await handleDelete(device);
                  setDeleteCandidate(null);
                }}
                disabled={Boolean(deletingKey)}
              >
                {deletingKey ? "Deleting..." : "Delete device"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER ASSIGNMENT MODAL */}
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
                  <h2>
                    {selectedDevice.customer_id
                      ? "Change Customer"
                      : "Assign Customer"}
                  </h2>
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

              <div
                style={{ marginTop: 12, maxHeight: 260, overflowY: "auto" }}
              >
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
                  <h2>
                    {selectedDevice.site_id ? "Change Site" : "Assign Site"}
                  </h2>
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
                Search Branch
                <input
                  value={siteSearch}
                  onChange={(event) => setSiteSearch(event.target.value)}
                  placeholder="Search site..."
                />
              </label>

              <div className="site-assignment-list">
                {sitesLoading ? (
                  <div className="admins-loading">Loading branch...</div>
                ) : filteredSites.length === 0 ? (
                  <div className="admins-empty">No branch found.</div>
                ) : (
                  filteredSites.map((site) => {
                    const siteId =
                      site.asset_id ||
                      site.tpt_site_id ||
                      site.id?.id ||
                      site.id;

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
                          <strong>{site.name || "Unnamed Site"}</strong>
                          <span>{site.code || "No code"}</span>
                          {location && <small>{location}</small>}
                          <small>ID: {siteId}</small>
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
