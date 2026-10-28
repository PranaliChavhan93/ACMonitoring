// // // import React, { useCallback, useEffect, useMemo, useState } from "react";
// // // import { FiEdit3, FiTrash2, FiRefreshCw, FiSearch, FiUserPlus } from "react-icons/fi";
// // // import "./AdminCreation.css";
// // // import { useAuth } from "../Layout/AuthContext";

// // // const API_BASE = "http://localhost:8000/api";
// // // const USERS_URL = `${API_BASE}/admins/`;
// // // const CUSTOMERS_URL = `${API_BASE}/customers/`;
// // // const STATES_URL = `${API_BASE}/states/`;
// // // const ZONES_URL = `${API_BASE}/zones/`;

// // // const getToken = () =>
// // //   localStorage.getItem("token") ||
// // //   localStorage.getItem("authToken") ||
// // //   localStorage.getItem("access_token") ||
// // //   localStorage.getItem("accessToken") ||
// // //   "";

// // // const authHeaders = () => {
// // //   const token = getToken();
// // //   return {
// // //     "Content-Type": "application/json",
// // //     Accept: "application/json",
// // //     ...(token
// // //       ? { Authorization: token.startsWith("Token ") ? token : `Token ${token}` }
// // //       : {}),
// // //   };
// // // };

// // // const normalizeList = (result) =>
// // //   Array.isArray(result)
// // //     ? result
// // //     : Array.isArray(result?.data)
// // //       ? result.data
// // //       : Array.isArray(result?.results)
// // //         ? result.results
// // //         : Array.isArray(result?.data?.results)
// // //           ? result.data.results
// // //           : [];

// // // const emptyForm = {
// // //   id: null,
// // //   name: "",
// // //   email: "",
// // //   phone: "",
// // //   password: "",
// // //   is_active: true,
// // //   customer: "",
// // //   hierarchy_type: "",
// // //   state: "",
// // //   zone: "",
// // // };

// // // const hierarchyLabel = {
// // //   GEOGRAPHICAL: "Geographical — State → District → Taluka → Branch",
// // //   ZONAL: "Zonal — Zone → Circle → Region → Division → Branch",
// // // };

// // // const Admin_Creation = () => {
// // //   const [toast, setToast] = useState(null);
// // //   const { user: currentUser } = useAuth();
// // //   const isCustomerUser = currentUser?.role === "CUSTOMER";
// // //   const isSuperAdmin = currentUser?.role === "ORG_SUPER_ADMIN";

// // //   const [view, setView] = useState("list");
// // //   const [admins, setAdmins] = useState([]);
// // //   const [customers, setCustomers] = useState([]);
// // //   const [states, setStates] = useState([]);
// // //   const [zones, setZones] = useState([]);

// // //   const [form, setForm] = useState(emptyForm);
// // //   const [search, setSearch] = useState("");
// // //   const [loading, setLoading] = useState(true);
// // //   const [saving, setSaving] = useState(false);
// // //   const [locationsLoading, setLocationsLoading] = useState(false);
// // //   const [error, setError] = useState("");
// // //   const [formError, setFormError] = useState("");

// // //   const [deleteTarget, setDeleteTarget] = useState(null);
// // //   const [deleting, setDeleting] = useState(false);
  
// // //   const showToast = useCallback((type, message) => {
// // //     setToast({ type, message, id: Date.now() });
// // //   }, []);

// // //   useEffect(() => {
// // //     if (!toast) return;
// // //     const timer = setTimeout(() => setToast(null), 3000);
// // //     return () => clearTimeout(timer);
// // //   }, [toast]);

  
// // // const getCustomerId = (user) => {
// // //   const customer = user?.customer;

// // //   return (
// // //     customer?.id ??
// // //     customer?.pk ??
// // //     (typeof customer === "string" || typeof customer === "number"
// // //       ? customer
// // //       : null) ??
// // //     user?.customer_id ??
// // //     user?.scopeId ??
// // //     ""
// // //   );
// // // };

// // //   const currentCustomerId = useMemo(() => {
// // //     if (!isCustomerUser) return "";
// // //     return String(getCustomerId(currentUser) || "");
// // //   }, [currentUser, isCustomerUser]);

// // //   const selectedCustomer = useMemo(() => {
// // //     const id = String(form.customer || currentCustomerId || "");

// // //     return (
// // //       customers.find((customer) => String(customer.id) === id) ||
// // //       null
// // //     );
// // //   }, [customers, form.customer, currentCustomerId]);

// // //   const hierarchy = (
// // //     isCustomerUser
// // //       ? currentUser?.customer_hierarchy_type ??
// // //         currentUser?.customer?.hierarchy_type
// // //       : selectedCustomer?.hierarchy_type || form.hierarchy_type
// // //   ) || "";


// // //   const currentCustomerName = useMemo(
// // //     () => currentUser?.scope_name || currentUser?.customer_name || "Your Customer",
// // //     [currentUser]
// // //   );

// // //   const fetchAdmins = useCallback(async () => {
// // //     setLoading(true);
// // //     setError("");
// // //     try {
// // //       const response = await fetch(USERS_URL, {
// // //         headers: authHeaders(),
// // //         cache: "no-store",
// // //       });
// // //       const result = await response.json().catch(() => ({}));
// // //       if (!response.ok) {
// // //         throw new Error(result?.detail || result?.message || `HTTP ${response.status}`);
// // //       }
// // //       setAdmins(normalizeList(result));
// // //     } catch (err) {
// // //       setError(err.message || "Unable to load admins.");
// // //     } finally {
// // //       setLoading(false);
// // //     }
// // //   }, []);

// // //   const fetchCustomers = useCallback(async () => {
// // //     if (!isSuperAdmin) return;
// // //     try {
// // //       const response = await fetch(CUSTOMERS_URL, {
// // //         headers: authHeaders(),
// // //         cache: "no-store",
// // //       });
// // //       const result = await response.json().catch(() => ({}));
// // //       if (!response.ok) throw new Error(result?.detail || `HTTP ${response.status}`);
// // //       setCustomers(normalizeList(result));
// // //     } catch (err) {
// // //       setFormError(err.message || "Unable to load customers.");
// // //     }
// // //   }, [isSuperAdmin]);

  
// // //   const fetchLocations = useCallback(async (customerId, hierarchyType) => {
// // //     setStates([]);
// // //     setZones([]);
// // //     setFormError("");

// // //     if (!customerId || !hierarchyType) return;

// // //     setLocationsLoading(true);

// // //     try {
// // //       const endpoint =
// // //         hierarchyType === "GEOGRAPHICAL"
// // //           ? STATES_URL
// // //           : hierarchyType === "ZONAL"
// // //             ? ZONES_URL
// // //             : null;

// // //       if (!endpoint) {
// // //         throw new Error(`Unsupported hierarchy: ${hierarchyType}`);
// // //       }

// // //       const url = new URL(endpoint);
// // //       url.searchParams.set("customer", String(customerId));

// // //       const response = await fetch(url.toString(), {
// // //         headers: authHeaders(),
// // //         cache: "no-store",
// // //       });

// // //       const result = await response.json().catch(() => ({}));

// // //       if (!response.ok) {
// // //         throw new Error(
// // //           result?.detail ||
// // //           result?.message ||
// // //           `Unable to load locations (HTTP ${response.status})`
// // //         );
// // //       }

// // //       const locations = normalizeList(result);

// // //       if (hierarchyType === "GEOGRAPHICAL") {
// // //         setStates(locations);
// // //         setZones([]);
// // //       } else {
// // //         setZones(locations);
// // //         setStates([]);
// // //       }

// // //       if (locations.length === 0) {
// // //         setFormError(
// // //           `No ${
// // //             hierarchyType === "GEOGRAPHICAL" ? "states" : "zones"
// // //           } found for this customer. Check the backend customer filter.`
// // //         );
// // //       }
// // //     } catch (err) {
// // //       setStates([]);
// // //       setZones([]);
// // //       setFormError(err.message || "Unable to load hierarchy locations.");
// // //     } finally {
// // //       setLocationsLoading(false);
// // //     }
// // //   }, []);


// // //   useEffect(() => {
// // //     fetchAdmins();
// // //     fetchCustomers();
// // //   }, [fetchAdmins, fetchCustomers]);

// // //   useEffect(() => {
// // //     if (isCustomerUser && currentCustomerId) {
// // //       setForm((previous) => ({
// // //         ...previous,
// // //         customer: currentCustomerId,
// // //         hierarchy_type: currentUser?.customer_hierarchy_type || "",
// // //       }));
// // //     }
// // //   }, [isCustomerUser, currentCustomerId, currentUser]);

// // //   useEffect(() => {
// // //     const customerId = isCustomerUser ? currentCustomerId : form.customer;
// // //     const hierarchyType = isCustomerUser
// // //       ? currentUser?.customer_hierarchy_type
// // //       : form.hierarchy_type || selectedCustomer?.hierarchy_type;

// // //     if (!customerId || !hierarchyType) {
// // //       setStates([]);
// // //       setZones([]);
// // //       return;
// // //     }

// // //     fetchLocations(customerId, hierarchyType);
// // //   }, [
// // //     isCustomerUser,
// // //     currentCustomerId,
// // //     currentUser?.customer_hierarchy_type,
// // //     form.customer,
// // //     form.hierarchy_type,
// // //     selectedCustomer?.hierarchy_type,
// // //     fetchLocations,
// // //   ]);

// // //   const resetForm = () => {
// // //     setForm({
// // //       ...emptyForm,
// // //       customer: isCustomerUser ? currentCustomerId : "",
// // //       hierarchy_type: isCustomerUser ? currentUser?.customer_hierarchy_type || "" : "",
// // //     });
// // //     setStates([]);
// // //     setZones([]);
// // //     setFormError("");
// // //   };

// // //   const openCreate = () => {
// // //     resetForm();
// // //     setView("form");
// // //   };

// // //   const openEdit = (admin) => {
// // //     setForm({
// // //       ...emptyForm,
// // //       id: admin.id,
// // //       name: admin.name || "",
// // //       email: admin.email || "",
// // //       phone: admin.phone || "",
// // //       is_active: admin.is_active !== false,
// // //       customer: String(admin.customer || ""),
// // //       hierarchy_type: admin.customer_hierarchy_type || "",
// // //       state: String(admin.state || ""),
// // //       zone: String(admin.zone || ""),
// // //     });
// // //     setFormError("");
// // //     setView("form");
// // //   };

// // //   const openDeleteConfirm = (admin) => {
// // //     setDeleteTarget(admin);
// // //   };

// // //   const closeDeleteConfirm = () => {
// // //     if (deleting) return; // don't close mid-request
// // //     setDeleteTarget(null);
// // //   };

// // //   const confirmDelete = async () => {
// // //     if (!deleteTarget) return;

// // //     const name = deleteTarget.name || deleteTarget.email || "Admin";

// // //     setDeleting(true);
// // //     setError("");
// // //     try {
// // //       const response = await fetch(`${USERS_URL}${deleteTarget.id}/`, {
// // //         method: "DELETE",
// // //         headers: authHeaders(),
// // //       });

// // //       if (!response.ok && response.status !== 204) {
// // //         const result = await response.json().catch(() => ({}));
// // //         throw new Error(
// // //           result?.detail || result?.message || `HTTP ${response.status}`
// // //         );
// // //       }

// // //       setAdmins((previous) =>
// // //         previous.filter((item) => item.id !== deleteTarget.id)
// // //       );
// // //       setDeleteTarget(null);
// // //       showToast("success", `${name} deleted successfully.`);
// // //     } catch (err) {
// // //       setError(err.message || "Could not delete admin.");
// // //       setDeleteTarget(null);
// // //       showToast("error", err.message || "Could not delete admin.");
// // //     } finally {
// // //       setDeleting(false);
// // //     }
// // //   };

// // //   const handleCustomerChange = (customerId) => {
// // //     const customer = customers.find(
// // //       (item) => String(item.id) === String(customerId)
// // //     );

// // //     setForm((previous) => ({
// // //       ...previous,
// // //       customer: customerId,
// // //       hierarchy_type: customer?.hierarchy_type || "",
// // //       state: "",
// // //       zone: "",
// // //     }));

// // //     setStates([]);
// // //     setZones([]);
// // //     setFormError("");
// // //   };

// // //   const handleSubmit = async (event) => {
// // //     event.preventDefault();
// // //     setFormError("");

// // //     if (!form.name.trim()) return setFormError("Name is required.");
// // //     if (!form.email.trim()) return setFormError("Email is required.");
// // //     if (!form.id && !form.password.trim()) {
// // //       return setFormError("Password is required.");
// // //     }

// // //     const customerId = isCustomerUser ? currentCustomerId : form.customer;
// // //     const hierarchyType = isCustomerUser
// // //       ? currentUser?.customer_hierarchy_type
// // //       : form.hierarchy_type || selectedCustomer?.hierarchy_type;

// // //     if (!customerId) return setFormError("Select a customer.");
// // //     if (!hierarchyType) return setFormError("Customer hierarchy is not configured.");

// // //     if (hierarchyType === "GEOGRAPHICAL" && !form.state) {
// // //       return setFormError("Select the State where the admin belongs.");
// // //     }

// // //     if (hierarchyType === "ZONAL" && !form.zone) {
// // //       return setFormError("Select the Zone where the admin belongs.");
// // //     }

// // //     const wasEditing = Boolean(form.id);

// // //     const payload = {
// // //       name: form.name.trim(),
// // //       email: form.email.trim().toLowerCase(),
// // //       phone: form.phone.trim(),
// // //       role: "BR_ADMIN",
// // //       is_active: form.is_active,
// // //       customer: customerId,
// // //     };

// // //     if (hierarchyType === "GEOGRAPHICAL") payload.state = form.state;
// // //     if (hierarchyType === "ZONAL") payload.zone = form.zone;
// // //     if (form.password.trim()) payload.password = form.password;

// // //     setSaving(true);

// // //     try {
// // //       const response = await fetch(
// // //         form.id ? `${USERS_URL}${form.id}/` : USERS_URL,
// // //         {
// // //           method: form.id ? "PATCH" : "POST",
// // //           headers: authHeaders(),
// // //           body: JSON.stringify(payload),
// // //         }
// // //       );

// // //       const result = await response.json().catch(() => ({}));

// // //       if (!response.ok) {
// // //         const message =
// // //           result?.detail ||
// // //           result?.message ||
// // //           Object.entries(result || {})
// // //             .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
// // //             .join(" | ") ||
// // //           `HTTP ${response.status}`;
// // //         throw new Error(message);
// // //       }

// // //       await fetchAdmins();
// // //       setView("list");
// // //       resetForm();
// // //       showToast(
// // //         "success",
// // //         wasEditing ? "Admin updated successfully." : "Admin created successfully."
// // //       );
// // //     } catch (err) {
// // //       setFormError(err.message || "Could not save admin.");
// // //       showToast("error", err.message || "Could not save admin.");
// // //     } finally {
// // //       setSaving(false);
// // //     }
// // //   };

// // //   const filteredAdmins = useMemo(() => {
// // //     const query = search.trim().toLowerCase();
// // //     if (!query) return admins;

// // //     return admins.filter((admin) =>
// // //       [
// // //         admin.name,
// // //         admin.email,
// // //         admin.phone,
// // //         admin.customer_name,
// // //         admin.state_name,
// // //         admin.zone_name,
// // //         admin.scope_name,
// // //       ]
// // //         .filter(Boolean)
// // //         .some((value) => String(value).toLowerCase().includes(query))
// // //     );
// // //   }, [admins, search]);

// // //   return (
// // //     <div className="admins-page">
// // //       <ol className="admins-stepper">
// // //         <li className={view === "list" ? "active" : "done"}>
// // //           <button type="button" className="step-btn" onClick={() => setView("list")}>
// // //             <span className="step-num">1</span> Admins
// // //           </button>
// // //         </li>
// // //         <li className={view === "form" ? "active" : ""}>
// // //           <button type="button" className="step-btn" onClick={openCreate}>
// // //             <span className="step-num">2</span> Add Admin
// // //           </button>
// // //         </li>
// // //       </ol>

// // //       {view === "list" ? (
// // //         <>
// // //           <div className="admins-header">
// // //             <div>
// // //               <h1>Admins</h1>
// // //               <p>
// // //                 Each admin belongs to one customer State or Zone and can see
// // //                 everything below that hierarchy node.
// // //               </p>
// // //             </div>
// // //             {/* <button type="button" className="btn-primary" onClick={openCreate}>
// // //               <FiUserPlus /> Add Admin
// // //             </button> */}
// // //           </div>

// // //           <div className="admins-toolbar">
// // //             <div style={{ position: "relative", flex: 1 }}>
// // //               <FiSearch style={{ position: "absolute", left: 12, top: 12, color: "#9ca3af" }} />
// // //               <input
// // //                 className="admins-search"
// // //                 style={{ paddingLeft: 36, width: "100%" }}
// // //                 placeholder={
// // //                   isCustomerUser
// // //                     ? "Search by name, email, state or zone..."
// // //                     : "Search by name, email, customer, state or zone..."
// // //                 }
// // //                 value={search}
// // //                 onChange={(event) => setSearch(event.target.value)}
// // //               />
// // //             </div>
// // //             <span className="admins-count">{filteredAdmins.length} admins</span>
// // //             {/* <button type="button" className="btn-secondary" onClick={fetchAdmins}>
// // //               <FiRefreshCw /> Refresh
// // //             </button> */}
// // //           </div>

// // //           {error && <div className="admins-error">{error}</div>}

// // //           <div className="admins-table-card">
// // //             {loading ? (
// // //               <div className="admins-loading">Loading admins...</div>
// // //             ) : filteredAdmins.length === 0 ? (
// // //               <div className="admins-empty">No admins found.</div>
// // //             ) : (
// // //               <table className="admins-table">
// // //                 <thead>
// // //                   <tr>
// // //                     <th>Name</th>
// // //                     <th>Email</th>
// // //                     {/* <th>Customer</th>  */}
// // //                     {!isCustomerUser && <th>Customer</th>}
// // //                     <th>Hierarchy</th>
// // //                     <th>Assigned Scope</th>
// // //                     <th>Status</th>
// // //                     <th>Action</th>
// // //                   </tr>
// // //                 </thead>
// // //                 <tbody>
// // //                   {filteredAdmins.map((admin) => (
// // //                     <tr key={admin.id}>
// // //                       <td>{admin.name || "—"}</td>
// // //                       <td>{admin.email || "—"}</td>
// // //                       {/* <td>{admin.customer_name || admin.customer?.company || "—"}</td> */}
// // //                       {!isCustomerUser && (
// // //                         <td>
// // //                           {admin.customer_name || admin.customer?.company || "—"}
// // //                         </td>
// // //                       )}
// // //                       <td>{hierarchyLabel[admin.customer_hierarchy_type] || "—"}</td>
// // //                       <td>
// // //                         {admin.customer_hierarchy_type === "ZONAL"
// // //                           ? admin.zone_name || "—"
// // //                           : admin.state_name || "—"}
// // //                       </td>
// // //                       <td>{admin.is_active ? "Active" : "Inactive"}</td>
// // //                       <td>
// // //                         <button
// // //                           type="button"
// // //                           className="btn-icon"
// // //                           onClick={() => openEdit(admin)}
// // //                           title="Edit"
// // //                         >
// // //                           <FiEdit3 size={16} />
// // //                         </button>
// // //                         <button
// // //                           type="button"
// // //                           className="btn-icon"
// // //                           onClick={() => openDeleteConfirm(admin)}
// // //                           title="Delete"
// // //                           style={{ color: "#dc2626" }}
// // //                         >
// // //                           <FiTrash2 size={16} />
// // //                         </button>
// // //                       </td>
// // //                     </tr>
// // //                   ))}
// // //                 </tbody>
// // //               </table>
// // //             )}
// // //           </div>
// // //         </>
// // //       ) : (
// // //         <div className="admins-panel">
// // //           <div className="admins-panel-header">
// // //             <FiUserPlus size={22} />
// // //             <div>
// // //               <h2>{form.id ? "Edit Admin" : "Create Branch Admin"}</h2>
// // //               <p>
// // //                 Assign the admin to the customer's top-level State or Zone.
// // //                 Lower locations are inherited automatically.
// // //               </p>
// // //             </div>
// // //           </div>

// // //           {formError && <div className="admins-error">{formError}</div>}

// // //           <form className="admins-form" onSubmit={handleSubmit}>
// // //             <div className="form-grid">
// // //               <label>
// // //                 Name *
// // //                 <input
// // //                   value={form.name}
// // //                   onChange={(e) => setForm({ ...form, name: e.target.value })}
// // //                 />
// // //               </label>

// // //               <label>
// // //                 Email *
// // //                 <input
// // //                   type="email"
// // //                   value={form.email}
// // //                   onChange={(e) => setForm({ ...form, email: e.target.value })}
// // //                 />
// // //               </label>

// // //               <label>
// // //                 Phone
// // //                 <input
// // //                   value={form.phone}
// // //                   onChange={(e) => setForm({ ...form, phone: e.target.value })}
// // //                 />
// // //               </label>

// // //               <label>
// // //                 {form.id ? "Password (optional)" : "Password *"}
// // //                 <input
// // //                   type="password"
// // //                   value={form.password}
// // //                   onChange={(e) => setForm({ ...form, password: e.target.value })}
// // //                   // required={!form.id}
// // //                 />
// // //               </label>

// // //               {isSuperAdmin ? (
// // //                 <label>
// // //                   Customer *
// // //                   <select
// // //                     value={form.customer}
// // //                     onChange={(e) => handleCustomerChange(e.target.value)}
// // //                   >
// // //                     <option value="">Select Customer</option>
// // //                     {customers.map((customer) => (
// // //                       <option key={customer.id} value={customer.id}>
// // //                         {customer.company}
// // //                       </option>
// // //                     ))}
// // //                   </select>
// // //                 </label>
// // //               ) : (
// // //                 <label>
// // //                   Customer
// // //                   <input value={currentCustomerName} disabled />
// // //                 </label>
// // //               )}

// // //               <label>
// // //                 Hierarchy
// // //                 <input
// // //                   value={
// // //                     hierarchyLabel[hierarchy] ||
// // //                     hierarchy ||
// // //                     "Select customer first"
// // //                   }
// // //                   disabled
// // //                 />
// // //               </label>

// // //               {hierarchy === "GEOGRAPHICAL" && (
// // //                 <label>
// // //                   State *
// // //                   <select
// // //                     value={form.state}
// // //                     onChange={(e) =>
// // //                       setForm({ ...form, state: e.target.value })
// // //                     }
// // //                     disabled={locationsLoading}
// // //                   >
// // //                     <option value="">
// // //                       {locationsLoading ? "Loading states..." : "Select State"}
// // //                     </option>
// // //                     {states.map((state) => (
// // //                       <option key={state.id} value={state.id}>
// // //                         {state.name}
// // //                       </option>
// // //                     ))}
// // //                   </select>
// // //                 </label>
// // //               )}

// // //               {hierarchy === "ZONAL" && (
// // //                 <label>
// // //                   Zone *
// // //                   <select
// // //                     value={form.zone}
// // //                     onChange={(e) =>
// // //                       setForm({ ...form, zone: e.target.value })
// // //                     }
// // //                     disabled={locationsLoading}
// // //                   >
// // //                     <option value="">
// // //                       {locationsLoading ? "Loading zones..." : "Select Zone"}
// // //                     </option>
// // //                     {zones.map((zone) => (
// // //                       <option key={zone.id} value={zone.id}>
// // //                         {zone.name}
// // //                       </option>
// // //                     ))}
// // //                   </select>
// // //                 </label>
// // //               )}

// // //               <label className="checkbox-row">
// // //                 <input
// // //                   type="checkbox"
// // //                   checked={form.is_active}
// // //                   onChange={(e) =>
// // //                     setForm({ ...form, is_active: e.target.checked })
// // //                   }
// // //                 />
// // //                 Active
// // //               </label>
// // //             </div>

// // //             <div className="form-actions">
// // //               <button type="button" className="btn-secondary" onClick={() => setView("list")}>
// // //                 Cancel
// // //               </button>
// // //               <button type="submit" className="btn-primary" disabled={saving}>
// // //                 {saving ? "Saving..." : form.id ? "Update Admin" : "Create Admin"}
// // //               </button>
// // //             </div>
// // //           </form>
// // //         </div>
// // //       )}

// // //       {deleteTarget && (
// // //         <div className="admins-modal-overlay" onClick={closeDeleteConfirm}>
// // //           <div
// // //             className="admins-modal"
// // //             onClick={(event) => event.stopPropagation()}
// // //           >
// // //             <div className="admins-modal-header">
// // //               <FiTrash2 size={20} style={{ color: "#dc2626" }} />
// // //               <h3>Delete Admin</h3>
// // //             </div>

// // //             <div className="admins-modal-body">
// // //               <p>
// // //                 Are you sure you want to delete{" "}
// // //                 <strong>{deleteTarget.name || deleteTarget.email}</strong>?
// // //               </p>
// // //               <p className="admins-modal-warning">
// // //                 This removes the admin from both the AC Monitoring system and 3TP.
// // //                 This action cannot be undone.
// // //               </p>
// // //             </div>

// // //             <div className="admins-modal-actions">
// // //               <button
// // //                 type="button"
// // //                 className="btn-secondary"
// // //                 onClick={closeDeleteConfirm}
// // //                 disabled={deleting}
// // //               >
// // //                 Cancel
// // //               </button>
// // //               <button
// // //                 type="button"
// // //                 className="btn-danger"
// // //                 onClick={confirmDelete}
// // //                 disabled={deleting}
// // //               >
// // //                 {deleting ? "Deleting..." : "Delete"}
// // //               </button>
// // //             </div>
// // //           </div>
// // //         </div>
// // //       )}

// // //       {toast && (
// // //         <div
// // //           key={toast.id}
// // //           className={`admins-toast admins-toast-${toast.type}`}
// // //           role="status"
// // //         >
// // //           <span className="admins-toast-icon">
// // //             {toast.type === "success" ? "✓" : "!"}
// // //           </span>
// // //           <span>{toast.message}</span>
// // //         </div>
// // //       )}
// // //     </div>
// // //   );
// // // };

// // // export default Admin_Creation;

// // import React, { useCallback, useEffect, useMemo, useState } from "react";
// // import { FiEdit3, FiTrash2, FiRefreshCw, FiSearch, FiUserPlus } from "react-icons/fi";
// // import "./AdminCreation.css";
// // import { useAuth } from "../Layout/AuthContext";

// // const API_BASE = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000/api`;
// // const USERS_URL = `${API_BASE}/admins/`;
// // const CUSTOMERS_URL = `${API_BASE}/customers/`;
// // const STATES_URL = `${API_BASE}/states/`;
// // const ZONES_URL = `${API_BASE}/zones/`;

// // const getToken = () =>
// //   localStorage.getItem("token") ||
// //   localStorage.getItem("authToken") ||
// //   localStorage.getItem("access_token") ||
// //   localStorage.getItem("accessToken") ||
// //   "";

// // const authHeaders = () => {
// //   const token = getToken();
// //   return {
// //     "Content-Type": "application/json",
// //     Accept: "application/json",
// //     ...(token
// //       ? { Authorization: token.startsWith("Token ") ? token : `Token ${token}` }
// //       : {}),
// //   };
// // };

// // const normalizeList = (result) =>
// //   Array.isArray(result)
// //     ? result
// //     : Array.isArray(result?.data)
// //       ? result.data
// //       : Array.isArray(result?.results)
// //         ? result.results
// //         : Array.isArray(result?.data?.results)
// //           ? result.data.results
// //           : [];

// // const emptyForm = {
// //   id: null,
// //   name: "",
// //   email: "",
// //   phone: "",
// //   password: "",
// //   is_active: true,
// //   customer: "",
// //   hierarchy_type: "",
// //   state: "",
// //   zone: "",
// // };

// // const hierarchyLabel = {
// //   GEOGRAPHICAL: "Geographical — State → District → Taluka → Branch",
// //   ZONAL: "Zonal — Zone → Circle → Region → Division → Branch",
// // };

// // const Admin_Creation = () => {
// //   const [toast, setToast] = useState(null);
// //   const { user: currentUser } = useAuth();
// //   const isCustomerUser = currentUser?.role === "CUSTOMER";
// //   const isSuperAdmin = currentUser?.role === "ORG_SUPER_ADMIN";

// //   const [view, setView] = useState("list");
// //   const [admins, setAdmins] = useState([]);
// //   const [customers, setCustomers] = useState([]);
// //   const [states, setStates] = useState([]);
// //   const [zones, setZones] = useState([]);

// //   const [form, setForm] = useState(emptyForm);
// //   const [search, setSearch] = useState("");
// //   const [loading, setLoading] = useState(true);
// //   const [saving, setSaving] = useState(false);
// //   const [locationsLoading, setLocationsLoading] = useState(false);
// //   const [error, setError] = useState("");
// //   const [formError, setFormError] = useState("");

// //   const [deleteTarget, setDeleteTarget] = useState(null);
// //   const [deleting, setDeleting] = useState(false);
  
// //   const showToast = useCallback((type, message) => {
// //     setToast({ type, message, id: Date.now() });
// //   }, []);

// //   useEffect(() => {
// //     if (!toast) return;
// //     const timer = setTimeout(() => setToast(null), 3000);
// //     return () => clearTimeout(timer);
// //   }, [toast]);

  
// // const getCustomerId = (user) => {
// //   const customer = user?.customer;

// //   return (
// //     customer?.id ??
// //     customer?.pk ??
// //     (typeof customer === "string" || typeof customer === "number"
// //       ? customer
// //       : null) ??
// //     user?.customer_id ??
// //     user?.scopeId ??
// //     ""
// //   );
// // };

// //   const currentCustomerId = useMemo(() => {
// //     if (!isCustomerUser) return "";
// //     return String(getCustomerId(currentUser) || "");
// //   }, [currentUser, isCustomerUser]);

// //   const selectedCustomer = useMemo(() => {
// //     const id = String(form.customer || currentCustomerId || "");

// //     return (
// //       customers.find((customer) => String(customer.id) === id) ||
// //       null
// //     );
// //   }, [customers, form.customer, currentCustomerId]);

// //   const hierarchy = (
// //     isCustomerUser
// //       ? currentUser?.customer_hierarchy_type ??
// //         currentUser?.customer?.hierarchy_type
// //       : selectedCustomer?.hierarchy_type || form.hierarchy_type
// //   ) || "";


// //   const currentCustomerName = useMemo(
// //     () => currentUser?.scope_name || currentUser?.customer_name || "Your Customer",
// //     [currentUser]
// //   );

// //   const fetchAdmins = useCallback(async () => {
// //     setLoading(true);
// //     setError("");
// //     try {
// //       const response = await fetch(USERS_URL, {
// //         headers: authHeaders(),
// //         cache: "no-store",
// //       });
// //       const result = await response.json().catch(() => ({}));
// //       if (!response.ok) {
// //         throw new Error(result?.detail || result?.message || `HTTP ${response.status}`);
// //       }
// //       setAdmins(normalizeList(result));
// //     } catch (err) {
// //       setError(err.message || "Unable to load admins.");
// //     } finally {
// //       setLoading(false);
// //     }
// //   }, []);

// //   const fetchCustomers = useCallback(async () => {
// //     if (!isSuperAdmin) return;
// //     try {
// //       const response = await fetch(CUSTOMERS_URL, {
// //         headers: authHeaders(),
// //         cache: "no-store",
// //       });
// //       const result = await response.json().catch(() => ({}));
// //       if (!response.ok) throw new Error(result?.detail || `HTTP ${response.status}`);
// //       setCustomers(normalizeList(result));
// //     } catch (err) {
// //       setFormError(err.message || "Unable to load customers.");
// //     }
// //   }, [isSuperAdmin]);

  
// //   const fetchLocations = useCallback(async (customerId, hierarchyType) => {
// //     setStates([]);
// //     setZones([]);
// //     setFormError("");

// //     if (!customerId || !hierarchyType) return;

// //     setLocationsLoading(true);

// //     try {
// //       const endpoint =
// //         hierarchyType === "GEOGRAPHICAL"
// //           ? STATES_URL
// //           : hierarchyType === "ZONAL"
// //             ? ZONES_URL
// //             : null;

// //       if (!endpoint) {
// //         throw new Error(`Unsupported hierarchy: ${hierarchyType}`);
// //       }

// //       const url = new URL(endpoint);
// //       url.searchParams.set("customer", String(customerId));

// //       const response = await fetch(url.toString(), {
// //         headers: authHeaders(),
// //         cache: "no-store",
// //       });

// //       const result = await response.json().catch(() => ({}));

// //       if (!response.ok) {
// //         throw new Error(
// //           result?.detail ||
// //           result?.message ||
// //           `Unable to load locations (HTTP ${response.status})`
// //         );
// //       }

// //       const locations = normalizeList(result);

// //       if (hierarchyType === "GEOGRAPHICAL") {
// //         setStates(locations);
// //         setZones([]);
// //       } else {
// //         setZones(locations);
// //         setStates([]);
// //       }

// //       if (locations.length === 0) {
// //         setFormError(
// //           `No ${
// //             hierarchyType === "GEOGRAPHICAL" ? "states" : "zones"
// //           } found in this customer’s generated hierarchy. Verify that customer creation initialized its hierarchy.`
// //         );
// //       }
// //     } catch (err) {
// //       setStates([]);
// //       setZones([]);
// //       setFormError(err.message || "Unable to load hierarchy locations.");
// //     } finally {
// //       setLocationsLoading(false);
// //     }
// //   }, []);


// //   useEffect(() => {
// //     fetchAdmins();
// //     fetchCustomers();
// //   }, [fetchAdmins, fetchCustomers]);

// //   useEffect(() => {
// //     if (isCustomerUser && currentCustomerId) {
// //       setForm((previous) => ({
// //         ...previous,
// //         customer: currentCustomerId,
// //         hierarchy_type: currentUser?.customer_hierarchy_type || "",
// //       }));
// //     }
// //   }, [isCustomerUser, currentCustomerId, currentUser]);

// //   useEffect(() => {
// //     const customerId = isCustomerUser ? currentCustomerId : form.customer;
// //     const hierarchyType = isCustomerUser
// //       ? currentUser?.customer_hierarchy_type
// //       : form.hierarchy_type || selectedCustomer?.hierarchy_type;

// //     if (!customerId || !hierarchyType) {
// //       setStates([]);
// //       setZones([]);
// //       return;
// //     }

// //     fetchLocations(customerId, hierarchyType);
// //   }, [
// //     isCustomerUser,
// //     currentCustomerId,
// //     currentUser?.customer_hierarchy_type,
// //     form.customer,
// //     form.hierarchy_type,
// //     selectedCustomer?.hierarchy_type,
// //     fetchLocations,
// //   ]);

// //   const resetForm = () => {
// //     setForm({
// //       ...emptyForm,
// //       customer: isCustomerUser ? currentCustomerId : "",
// //       hierarchy_type: isCustomerUser ? currentUser?.customer_hierarchy_type || "" : "",
// //     });
// //     setStates([]);
// //     setZones([]);
// //     setFormError("");
// //   };

// //   const openCreate = () => {
// //     resetForm();
// //     setView("form");
// //   };

// //   const openEdit = (admin) => {
// //     setForm({
// //       ...emptyForm,
// //       id: admin.id,
// //       name: admin.name || "",
// //       email: admin.email || "",
// //       phone: admin.phone || "",
// //       is_active: admin.is_active !== false,
// //       customer: String(admin.customer || ""),
// //       hierarchy_type: admin.customer_hierarchy_type || "",
// //       state: String(admin.state || ""),
// //       zone: String(admin.zone || ""),
// //     });
// //     setFormError("");
// //     setView("form");
// //   };

// //   const openDeleteConfirm = (admin) => {
// //     setDeleteTarget(admin);
// //   };

// //   const closeDeleteConfirm = () => {
// //     if (deleting) return; // don't close mid-request
// //     setDeleteTarget(null);
// //   };

// //   const confirmDelete = async () => {
// //     if (!deleteTarget) return;

// //     const name = deleteTarget.name || deleteTarget.email || "Admin";

// //     setDeleting(true);
// //     setError("");
// //     try {
// //       const response = await fetch(`${USERS_URL}${deleteTarget.id}/`, {
// //         method: "DELETE",
// //         headers: authHeaders(),
// //       });

// //       if (!response.ok && response.status !== 204) {
// //         const result = await response.json().catch(() => ({}));
// //         throw new Error(
// //           result?.detail || result?.message || `HTTP ${response.status}`
// //         );
// //       }

// //       setAdmins((previous) =>
// //         previous.filter((item) => item.id !== deleteTarget.id)
// //       );
// //       setDeleteTarget(null);
// //       showToast("success", `${name} deleted successfully.`);
// //     } catch (err) {
// //       setError(err.message || "Could not delete admin.");
// //       setDeleteTarget(null);
// //       showToast("error", err.message || "Could not delete admin.");
// //     } finally {
// //       setDeleting(false);
// //     }
// //   };

// //   const handleCustomerChange = (customerId) => {
// //     const customer = customers.find(
// //       (item) => String(item.id) === String(customerId)
// //     );

// //     setForm((previous) => ({
// //       ...previous,
// //       customer: customerId,
// //       hierarchy_type: customer?.hierarchy_type || "",
// //       state: "",
// //       zone: "",
// //     }));

// //     setStates([]);
// //     setZones([]);
// //     setFormError("");
// //   };

// //   const handleSubmit = async (event) => {
// //     event.preventDefault();
// //     setFormError("");

// //     if (!form.name.trim()) return setFormError("Name is required.");
// //     if (!form.email.trim()) return setFormError("Email is required.");
// //     if (!form.id && !form.password.trim()) {
// //       return setFormError("Password is required.");
// //     }

// //     const customerId = isCustomerUser ? currentCustomerId : form.customer;
// //     const hierarchyType = isCustomerUser
// //       ? currentUser?.customer_hierarchy_type
// //       : form.hierarchy_type || selectedCustomer?.hierarchy_type;

// //     if (!customerId) return setFormError("Select a customer.");
// //     if (!hierarchyType) return setFormError("Customer hierarchy is not configured.");

// //     if (hierarchyType === "GEOGRAPHICAL" && !form.state) {
// //       return setFormError("Select the State where the admin belongs.");
// //     }

// //     if (hierarchyType === "ZONAL" && !form.zone) {
// //       return setFormError("Select the Zone where the admin belongs.");
// //     }

// //     const wasEditing = Boolean(form.id);

// //     const payload = {
// //       name: form.name.trim(),
// //       email: form.email.trim().toLowerCase(),
// //       phone: form.phone.trim(),
// //       role: "BR_ADMIN",
// //       is_active: form.is_active,
// //       customer: customerId,
// //     };

// //     if (hierarchyType === "GEOGRAPHICAL") payload.state = form.state;
// //     if (hierarchyType === "ZONAL") payload.zone = form.zone;
// //     if (form.password.trim()) payload.password = form.password;

// //     setSaving(true);

// //     try {
// //       const response = await fetch(
// //         form.id ? `${USERS_URL}${form.id}/` : USERS_URL,
// //         {
// //           method: form.id ? "PATCH" : "POST",
// //           headers: authHeaders(),
// //           body: JSON.stringify(payload),
// //         }
// //       );

// //       const result = await response.json().catch(() => ({}));

// //       if (!response.ok) {
// //         const message =
// //           result?.detail ||
// //           result?.message ||
// //           Object.entries(result || {})
// //             .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
// //             .join(" | ") ||
// //           `HTTP ${response.status}`;
// //         throw new Error(message);
// //       }

// //       await fetchAdmins();
// //       setView("list");
// //       resetForm();
// //       showToast(
// //         "success",
// //         wasEditing ? "Admin updated successfully." : "Admin created successfully."
// //       );
// //     } catch (err) {
// //       setFormError(err.message || "Could not save admin.");
// //       showToast("error", err.message || "Could not save admin.");
// //     } finally {
// //       setSaving(false);
// //     }
// //   };

// //   const filteredAdmins = useMemo(() => {
// //     const query = search.trim().toLowerCase();
// //     if (!query) return admins;

// //     return admins.filter((admin) =>
// //       [
// //         admin.name,
// //         admin.email,
// //         admin.phone,
// //         admin.customer_name,
// //         admin.state_name,
// //         admin.zone_name,
// //         admin.scope_name,
// //       ]
// //         .filter(Boolean)
// //         .some((value) => String(value).toLowerCase().includes(query))
// //     );
// //   }, [admins, search]);

// //   return (
// //     <div className="admins-page">
// //       <ol className="admins-stepper">
// //         <li className={view === "list" ? "active" : "done"}>
// //           <button type="button" className="step-btn" onClick={() => setView("list")}>
// //             <span className="step-num">1</span> Admins
// //           </button>
// //         </li>
// //         <li className={view === "form" ? "active" : ""}>
// //           <button type="button" className="step-btn" onClick={openCreate}>
// //             <span className="step-num">2</span> Add Admin
// //           </button>
// //         </li>
// //       </ol>

// //       {view === "list" ? (
// //         <>
// //           <div className="admins-header">
// //             <div>
// //               <h1>Admins</h1>
// //               <p>
// //                 Each admin belongs to one customer State or Zone and can see
// //                 everything below that hierarchy node.
// //               </p>
// //             </div>
// //             {/* <button type="button" className="btn-primary" onClick={openCreate}>
// //               <FiUserPlus /> Add Admin
// //             </button> */}
// //           </div>

// //           <div className="admins-toolbar">
// //             <div style={{ position: "relative", flex: 1 }}>
// //               <FiSearch style={{ position: "absolute", left: 12, top: 12, color: "#9ca3af" }} />
// //               <input
// //                 className="admins-search"
// //                 style={{ paddingLeft: 36, width: "100%" }}
// //                 placeholder={
// //                   isCustomerUser
// //                     ? "Search by name, email, state or zone..."
// //                     : "Search by name, email, customer, state or zone..."
// //                 }
// //                 value={search}
// //                 onChange={(event) => setSearch(event.target.value)}
// //               />
// //             </div>
// //             <span className="admins-count">{filteredAdmins.length} admins</span>
// //             {/* <button type="button" className="btn-secondary" onClick={fetchAdmins}>
// //               <FiRefreshCw /> Refresh
// //             </button> */}
// //           </div>

// //           {error && <div className="admins-error">{error}</div>}

// //           <div className="admins-table-card">
// //             {loading ? (
// //               <div className="admins-loading">Loading admins...</div>
// //             ) : filteredAdmins.length === 0 ? (
// //               <div className="admins-empty">No admins found.</div>
// //             ) : (
// //               <table className="admins-table">
// //                 <thead>
// //                   <tr>
// //                     <th>Name</th>
// //                     <th>Email</th>
// //                     {/* <th>Customer</th>  */}
// //                     {!isCustomerUser && <th>Customer</th>}
// //                     <th>Hierarchy</th>
// //                     <th>Assigned Scope</th>
// //                     <th>Status</th>
// //                     <th>Action</th>
// //                   </tr>
// //                 </thead>
// //                 <tbody>
// //                   {filteredAdmins.map((admin) => (
// //                     <tr key={admin.id}>
// //                       <td>{admin.name || "—"}</td>
// //                       <td>{admin.email || "—"}</td>
// //                       {/* <td>{admin.customer_name || admin.customer?.company || "—"}</td> */}
// //                       {!isCustomerUser && (
// //                         <td>
// //                           {admin.customer_name || admin.customer?.company || "—"}
// //                         </td>
// //                       )}
// //                       <td>{hierarchyLabel[admin.customer_hierarchy_type] || "—"}</td>
// //                       <td>
// //                         {admin.customer_hierarchy_type === "ZONAL"
// //                           ? admin.zone_name || "—"
// //                           : admin.state_name || "—"}
// //                       </td>
// //                       <td>{admin.is_active ? "Active" : "Inactive"}</td>
// //                       <td>
// //                         <button
// //                           type="button"
// //                           className="btn-icon"
// //                           onClick={() => openEdit(admin)}
// //                           title="Edit"
// //                         >
// //                           <FiEdit3 size={16} />
// //                         </button>
// //                         <button
// //                           type="button"
// //                           className="btn-icon"
// //                           onClick={() => openDeleteConfirm(admin)}
// //                           title="Delete"
// //                           style={{ color: "#dc2626" }}
// //                         >
// //                           <FiTrash2 size={16} />
// //                         </button>
// //                       </td>
// //                     </tr>
// //                   ))}
// //                 </tbody>
// //               </table>
// //             )}
// //           </div>
// //         </>
// //       ) : (
// //         <div className="admins-panel">
// //           <div className="admins-panel-header">
// //             <FiUserPlus size={22} />
// //             <div>
// //               <h2>{form.id ? "Edit Admin" : "Create Branch Admin"}</h2>
// //               <p>
// //                 Assign the admin to the customer's top-level State or Zone.
// //                 Lower locations are inherited automatically.
// //               </p>
// //             </div>
// //           </div>

// //           {formError && <div className="admins-error">{formError}</div>}

// //           <form className="admins-form" onSubmit={handleSubmit}>
// //             <div className="form-grid">
// //               <label>
// //                 Name *
// //                 <input
// //                   value={form.name}
// //                   onChange={(e) => setForm({ ...form, name: e.target.value })}
// //                 />
// //               </label>

// //               <label>
// //                 Email *
// //                 <input
// //                   type="email"
// //                   value={form.email}
// //                   onChange={(e) => setForm({ ...form, email: e.target.value })}
// //                 />
// //               </label>

// //               <label>
// //                 Phone
// //                 <input
// //                   value={form.phone}
// //                   onChange={(e) => setForm({ ...form, phone: e.target.value })}
// //                 />
// //               </label>

// //               <label>
// //                 {form.id ? "Password (optional)" : "Password *"}
// //                 <input
// //                   type="password"
// //                   value={form.password}
// //                   onChange={(e) => setForm({ ...form, password: e.target.value })}
// //                   // required={!form.id}
// //                 />
// //               </label>

// //               {isSuperAdmin ? (
// //                 <label>
// //                   Customer *
// //                   <select
// //                     value={form.customer}
// //                     onChange={(e) => handleCustomerChange(e.target.value)}
// //                   >
// //                     <option value="">Select Customer</option>
// //                     {customers.map((customer) => (
// //                       <option key={customer.id} value={customer.id}>
// //                         {customer.company}
// //                       </option>
// //                     ))}
// //                   </select>
// //                 </label>
// //               ) : (
// //                 <label>
// //                   Customer
// //                   <input value={currentCustomerName} disabled />
// //                 </label>
// //               )}

// //               <label>
// //                 Hierarchy
// //                 <input
// //                   value={
// //                     hierarchyLabel[hierarchy] ||
// //                     hierarchy ||
// //                     "Select customer first"
// //                   }
// //                   disabled
// //                 />
// //               </label>

// //               {hierarchy === "GEOGRAPHICAL" && (
// //                 <label>
// //                   State *
// //                   <select
// //                     value={form.state}
// //                     onChange={(e) =>
// //                       setForm({ ...form, state: e.target.value })
// //                     }
// //                     disabled={locationsLoading}
// //                   >
// //                     <option value="">
// //                       {locationsLoading ? "Loading states..." : "Select State"}
// //                     </option>
// //                     {states.map((state) => (
// //                       <option key={state.id} value={state.id}>
// //                         {state.name}
// //                       </option>
// //                     ))}
// //                   </select>
// //                 </label>
// //               )}

// //               {hierarchy === "ZONAL" && (
// //                 <label>
// //                   Zone *
// //                   <select
// //                     value={form.zone}
// //                     onChange={(e) =>
// //                       setForm({ ...form, zone: e.target.value })
// //                     }
// //                     disabled={locationsLoading}
// //                   >
// //                     <option value="">
// //                       {locationsLoading ? "Loading zones..." : "Select Zone"}
// //                     </option>
// //                     {zones.map((zone) => (
// //                       <option key={zone.id} value={zone.id}>
// //                         {zone.name}
// //                       </option>
// //                     ))}
// //                   </select>
// //                 </label>
// //               )}

// //               <label className="checkbox-row">
// //                 <input
// //                   type="checkbox"
// //                   checked={form.is_active}
// //                   onChange={(e) =>
// //                     setForm({ ...form, is_active: e.target.checked })
// //                   }
// //                 />
// //                 Active
// //               </label>
// //             </div>

// //             <div className="form-actions">
// //               <button type="button" className="btn-secondary" onClick={() => setView("list")}>
// //                 Cancel
// //               </button>
// //               <button type="submit" className="btn-primary" disabled={saving}>
// //                 {saving ? "Saving..." : form.id ? "Update Admin" : "Create Admin"}
// //               </button>
// //             </div>
// //           </form>
// //         </div>
// //       )}

// //       {deleteTarget && (
// //         <div className="admins-modal-overlay" onClick={closeDeleteConfirm}>
// //           <div
// //             className="admins-modal"
// //             onClick={(event) => event.stopPropagation()}
// //           >
// //             <div className="admins-modal-header">
// //               <FiTrash2 size={20} style={{ color: "#dc2626" }} />
// //               <h3>Delete Admin</h3>
// //             </div>

// //             <div className="admins-modal-body">
// //               <p>
// //                 Are you sure you want to delete{" "}
// //                 <strong>{deleteTarget.name || deleteTarget.email}</strong>?
// //               </p>
// //               <p className="admins-modal-warning">
// //                 This removes the admin from both the AC Monitoring system and 3TP.
// //                 This action cannot be undone.
// //               </p>
// //             </div>

// //             <div className="admins-modal-actions">
// //               <button
// //                 type="button"
// //                 className="btn-secondary"
// //                 onClick={closeDeleteConfirm}
// //                 disabled={deleting}
// //               >
// //                 Cancel
// //               </button>
// //               <button
// //                 type="button"
// //                 className="btn-danger"
// //                 onClick={confirmDelete}
// //                 disabled={deleting}
// //               >
// //                 {deleting ? "Deleting..." : "Delete"}
// //               </button>
// //             </div>
// //           </div>
// //         </div>
// //       )}

// //       {toast && (
// //         <div
// //           key={toast.id}
// //           className={`admins-toast admins-toast-${toast.type}`}
// //           role="status"
// //         >
// //           <span className="admins-toast-icon">
// //             {toast.type === "success" ? "✓" : "!"}
// //           </span>
// //           <span>{toast.message}</span>
// //         </div>
// //       )}
// //     </div>
// //   );
// // };

// // export default Admin_Creation;



// import React, { useCallback, useEffect, useMemo, useState } from "react";
// import { FiEdit3, FiTrash2, FiRefreshCw, FiSearch, FiUserPlus, FiCpu } from "react-icons/fi";
// import "./AdminCreation.css";
// import { useAuth } from "../Layout/AuthContext";

// const API_BASE = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000/api`;
// const USERS_URL = `${API_BASE}/admins/`;
// const CUSTOMERS_URL = `${API_BASE}/customers/`;
// const STATES_URL = `${API_BASE}/states/`;
// const ZONES_URL = `${API_BASE}/zones/`;
// const DEVICES_URL = `${API_BASE}/devices/`;
// const ASSIGN_DEVICE_ADMIN_URL = `${API_BASE}/devices/assign/admin/`;

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
//     Accept: "application/json",
//     ...(token
//       ? { Authorization: token.startsWith("Token ") ? token : `Token ${token}` }
//       : {}),
//   };
// };

// const normalizeList = (result) =>
//   Array.isArray(result)
//     ? result
//     : Array.isArray(result?.data)
//       ? result.data
//       : Array.isArray(result?.results)
//         ? result.results
//         : Array.isArray(result?.data?.results)
//           ? result.data.results
//           : [];

// const emptyForm = {
//   id: null,
//   name: "",
//   email: "",
//   phone: "",
//   password: "",
//   is_active: true,
//   customer: "",
//   hierarchy_type: "",
//   state: "",
//   zone: "",
// };

// const hierarchyLabel = {
//   GEOGRAPHICAL: "Geographical — State → District → Taluka → Branch",
//   ZONAL: "Zonal — Zone → Circle → Region → Division → Branch",
// };

// const Admin_Creation = () => {
//   const [toast, setToast] = useState(null);
//   const { user: currentUser } = useAuth();
//   const isCustomerUser = currentUser?.role === "CUSTOMER";
//   const isSuperAdmin = currentUser?.role === "ORG_SUPER_ADMIN";

//   const [view, setView] = useState("list");
//   const [admins, setAdmins] = useState([]);
//   const [allocationDevices, setAllocationDevices] = useState([]);
//   const [allocationDeviceId, setAllocationDeviceId] = useState("");
//   const [allocationAdminId, setAllocationAdminId] = useState("");
//   const [allocationLoading, setAllocationLoading] = useState(false);
//   const [allocationSaving, setAllocationSaving] = useState(false);
//   const [allocationError, setAllocationError] = useState("");
//   const [customers, setCustomers] = useState([]);
//   const [states, setStates] = useState([]);
//   const [zones, setZones] = useState([]);

//   const [form, setForm] = useState(emptyForm);
//   const [search, setSearch] = useState("");
//   const [loading, setLoading] = useState(true);
//   const [saving, setSaving] = useState(false);
//   const [locationsLoading, setLocationsLoading] = useState(false);
//   const [error, setError] = useState("");
//   const [formError, setFormError] = useState("");

//   const [deleteTarget, setDeleteTarget] = useState(null);
//   const [deleting, setDeleting] = useState(false);
  
//   const showToast = useCallback((type, message) => {
//     setToast({ type, message, id: Date.now() });
//   }, []);

//   useEffect(() => {
//     if (!toast) return;
//     const timer = setTimeout(() => setToast(null), 3000);
//     return () => clearTimeout(timer);
//   }, [toast]);

  
// const getCustomerId = (user) => {
//   const customer = user?.customer;

//   return (
//     customer?.id ??
//     customer?.pk ??
//     (typeof customer === "string" || typeof customer === "number"
//       ? customer
//       : null) ??
//     user?.customer_id ??
//     user?.scopeId ??
//     ""
//   );
// };

//   const currentCustomerId = useMemo(() => {
//     if (!isCustomerUser) return "";
//     return String(getCustomerId(currentUser) || "");
//   }, [currentUser, isCustomerUser]);

//   const selectedCustomer = useMemo(() => {
//     const id = String(form.customer || currentCustomerId || "");

//     return (
//       customers.find((customer) => String(customer.id) === id) ||
//       null
//     );
//   }, [customers, form.customer, currentCustomerId]);

//   const hierarchy = (
//     isCustomerUser
//       ? currentUser?.customer_hierarchy_type ??
//         currentUser?.customer?.hierarchy_type
//       : selectedCustomer?.hierarchy_type || form.hierarchy_type
//   ) || "";


//   const currentCustomerName = useMemo(
//     () => currentUser?.scope_name || currentUser?.customer_name || "Your Customer",
//     [currentUser]
//   );

//   const fetchAdmins = useCallback(async () => {
//     setLoading(true);
//     setError("");
//     try {
//       const response = await fetch(USERS_URL, {
//         headers: authHeaders(),
//         cache: "no-store",
//       });
//       const result = await response.json().catch(() => ({}));
//       if (!response.ok) {
//         throw new Error(result?.detail || result?.message || `HTTP ${response.status}`);
//       }
//       setAdmins(normalizeList(result));
//     } catch (err) {
//       setError(err.message || "Unable to load admins.");
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   // Load devices and admins for the device-allocation panel.
//   const fetchAllocationData = useCallback(async () => {
//     setAllocationLoading(true);
//     setAllocationError("");
//     try {
//       const [deviceResponse, adminResponse] = await Promise.all([
//         fetch(DEVICES_URL, { headers: authHeaders(), cache: "no-store" }),
//         fetch(USERS_URL, { headers: authHeaders(), cache: "no-store" }),
//       ]);
//       const [devicePayload, adminPayload] = await Promise.all([
//         deviceResponse.json().catch(() => ({})),
//         adminResponse.json().catch(() => ({})),
//       ]);
//       if (!deviceResponse.ok) {
//         throw new Error(devicePayload?.detail || devicePayload?.message || devicePayload?.error || `Devices HTTP ${deviceResponse.status}`);
//       }
//       if (!adminResponse.ok) {
//         throw new Error(adminPayload?.detail || adminPayload?.message || adminPayload?.error || `Admins HTTP ${adminResponse.status}`);
//       }
//       setAllocationDevices(normalizeList(devicePayload));
//       setAdmins(normalizeList(adminPayload));
//     } catch (err) {
//       setAllocationError(err.message || "Unable to load devices and admins.");
//     } finally {
//       setAllocationLoading(false);
//     }
//   }, []);

//   const submitDeviceAllocation = async () => {
//     if (!allocationDeviceId || !allocationAdminId) {
//       setAllocationError("Select both a device and an admin.");
//       return;
//     }
//     setAllocationSaving(true);
//     setAllocationError("");
//     try {
//       const response = await fetch(ASSIGN_DEVICE_ADMIN_URL, {
//         method: "POST",
//         headers: authHeaders(),
//         body: JSON.stringify({ device_id: allocationDeviceId, admin_id: allocationAdminId }),
//       });
//       const result = await response.json().catch(() => ({}));
//       if (!response.ok) {
//         throw new Error(result?.detail || result?.message || result?.error || `HTTP ${response.status}`);
//       }
//       showToast("success", result?.message || "Device allocated to admin successfully.");
//       setAllocationDeviceId("");
//       setAllocationAdminId("");
//       await fetchAllocationData();
//     } catch (err) {
//       setAllocationError(err.message || "Unable to allocate device.");
//     } finally {
//       setAllocationSaving(false);
//     }
//   };

//   const fetchCustomers = useCallback(async () => {
//     if (!isSuperAdmin) return;
//     try {
//       const response = await fetch(CUSTOMERS_URL, {
//         headers: authHeaders(),
//         cache: "no-store",
//       });
//       const result = await response.json().catch(() => ({}));
//       if (!response.ok) throw new Error(result?.detail || `HTTP ${response.status}`);
//       setCustomers(normalizeList(result));
//     } catch (err) {
//       setFormError(err.message || "Unable to load customers.");
//     }
//   }, [isSuperAdmin]);

  
//   const fetchLocations = useCallback(async (customerId, hierarchyType) => {
//     setStates([]);
//     setZones([]);
//     setFormError("");

//     if (!customerId || !hierarchyType) return;

//     setLocationsLoading(true);

//     try {
//       const endpoint =
//         hierarchyType === "GEOGRAPHICAL"
//           ? STATES_URL
//           : hierarchyType === "ZONAL"
//             ? ZONES_URL
//             : null;

//       if (!endpoint) {
//         throw new Error(`Unsupported hierarchy: ${hierarchyType}`);
//       }

//       const url = new URL(endpoint);
//       url.searchParams.set("customer", String(customerId));

//       const response = await fetch(url.toString(), {
//         headers: authHeaders(),
//         cache: "no-store",
//       });

//       const result = await response.json().catch(() => ({}));

//       if (!response.ok) {
//         throw new Error(
//           result?.detail ||
//           result?.message ||
//           `Unable to load locations (HTTP ${response.status})`
//         );
//       }

//       const locations = normalizeList(result);

//       if (hierarchyType === "GEOGRAPHICAL") {
//         setStates(locations);
//         setZones([]);
//       } else {
//         setZones(locations);
//         setStates([]);
//       }

//       if (locations.length === 0) {
//         setFormError(
//           `No ${
//             hierarchyType === "GEOGRAPHICAL" ? "states" : "zones"
//           } found in this customer’s generated hierarchy. Verify that customer creation initialized its hierarchy.`
//         );
//       }
//     } catch (err) {
//       setStates([]);
//       setZones([]);
//       setFormError(err.message || "Unable to load hierarchy locations.");
//     } finally {
//       setLocationsLoading(false);
//     }
//   }, []);


//   useEffect(() => {
//     fetchAdmins();
//     fetchCustomers();
//   }, [fetchAdmins, fetchCustomers]);

//   useEffect(() => {
//     if (isCustomerUser && currentCustomerId) {
//       setForm((previous) => ({
//         ...previous,
//         customer: currentCustomerId,
//         hierarchy_type: currentUser?.customer_hierarchy_type || "",
//       }));
//     }
//   }, [isCustomerUser, currentCustomerId, currentUser]);

//   useEffect(() => {
//     const customerId = isCustomerUser ? currentCustomerId : form.customer;
//     const hierarchyType = isCustomerUser
//       ? currentUser?.customer_hierarchy_type
//       : form.hierarchy_type || selectedCustomer?.hierarchy_type;

//     if (!customerId || !hierarchyType) {
//       setStates([]);
//       setZones([]);
//       return;
//     }

//     fetchLocations(customerId, hierarchyType);
//   }, [
//     isCustomerUser,
//     currentCustomerId,
//     currentUser?.customer_hierarchy_type,
//     form.customer,
//     form.hierarchy_type,
//     selectedCustomer?.hierarchy_type,
//     fetchLocations,
//   ]);

//   const resetForm = () => {
//     setForm({
//       ...emptyForm,
//       customer: isCustomerUser ? currentCustomerId : "",
//       hierarchy_type: isCustomerUser ? currentUser?.customer_hierarchy_type || "" : "",
//     });
//     setStates([]);
//     setZones([]);
//     setFormError("");
//   };

//   const openCreate = () => {
//     resetForm();
//     setView("form");
//   };

//   const openEdit = (admin) => {
//     setForm({
//       ...emptyForm,
//       id: admin.id,
//       name: admin.name || "",
//       email: admin.email || "",
//       phone: admin.phone || "",
//       is_active: admin.is_active !== false,
//       customer: String(admin.customer || ""),
//       hierarchy_type: admin.customer_hierarchy_type || "",
//       state: String(admin.state || ""),
//       zone: String(admin.zone || ""),
//     });
//     setFormError("");
//     setView("form");
//   };

//   const openDeleteConfirm = (admin) => {
//     setDeleteTarget(admin);
//   };

//   const closeDeleteConfirm = () => {
//     if (deleting) return; // don't close mid-request
//     setDeleteTarget(null);
//   };

//   const confirmDelete = async () => {
//     if (!deleteTarget) return;

//     const name = deleteTarget.name || deleteTarget.email || "Admin";

//     setDeleting(true);
//     setError("");
//     try {
//       const response = await fetch(`${USERS_URL}${deleteTarget.id}/`, {
//         method: "DELETE",
//         headers: authHeaders(),
//       });

//       if (!response.ok && response.status !== 204) {
//         const result = await response.json().catch(() => ({}));
//         throw new Error(
//           result?.detail || result?.message || `HTTP ${response.status}`
//         );
//       }

//       setAdmins((previous) =>
//         previous.filter((item) => item.id !== deleteTarget.id)
//       );
//       setDeleteTarget(null);
//       showToast("success", `${name} deleted successfully.`);
//     } catch (err) {
//       setError(err.message || "Could not delete admin.");
//       setDeleteTarget(null);
//       showToast("error", err.message || "Could not delete admin.");
//     } finally {
//       setDeleting(false);
//     }
//   };

//   const handleCustomerChange = (customerId) => {
//     const customer = customers.find(
//       (item) => String(item.id) === String(customerId)
//     );

//     setForm((previous) => ({
//       ...previous,
//       customer: customerId,
//       hierarchy_type: customer?.hierarchy_type || "",
//       state: "",
//       zone: "",
//     }));

//     setStates([]);
//     setZones([]);
//     setFormError("");
//   };

//   const handleSubmit = async (event) => {
//     event.preventDefault();
//     setFormError("");

//     if (!form.name.trim()) return setFormError("Name is required.");
//     if (!form.email.trim()) return setFormError("Email is required.");
//     if (!form.id && !form.password.trim()) {
//       return setFormError("Password is required.");
//     }

//     const customerId = isCustomerUser ? currentCustomerId : form.customer;
//     const hierarchyType = isCustomerUser
//       ? currentUser?.customer_hierarchy_type
//       : form.hierarchy_type || selectedCustomer?.hierarchy_type;

//     if (!customerId) return setFormError("Select a customer.");
//     if (!hierarchyType) return setFormError("Customer hierarchy is not configured.");

//     if (hierarchyType === "GEOGRAPHICAL" && !form.state) {
//       return setFormError("Select the State where the admin belongs.");
//     }

//     if (hierarchyType === "ZONAL" && !form.zone) {
//       return setFormError("Select the Zone where the admin belongs.");
//     }

//     const wasEditing = Boolean(form.id);

//     const payload = {
//       name: form.name.trim(),
//       email: form.email.trim().toLowerCase(),
//       phone: form.phone.trim(),
//       role: "BR_ADMIN",
//       is_active: form.is_active,
//       customer: customerId,
//     };

//     if (hierarchyType === "GEOGRAPHICAL") payload.state = form.state;
//     if (hierarchyType === "ZONAL") payload.zone = form.zone;
//     if (form.password.trim()) payload.password = form.password;

//     setSaving(true);

//     try {
//       const response = await fetch(
//         form.id ? `${USERS_URL}${form.id}/` : USERS_URL,
//         {
//           method: form.id ? "PATCH" : "POST",
//           headers: authHeaders(),
//           body: JSON.stringify(payload),
//         }
//       );

//       const result = await response.json().catch(() => ({}));

//       if (!response.ok) {
//         const message =
//           result?.detail ||
//           result?.message ||
//           Object.entries(result || {})
//             .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
//             .join(" | ") ||
//           `HTTP ${response.status}`;
//         throw new Error(message);
//       }

//       await fetchAdmins();
//       setView("list");
//       resetForm();
//       showToast(
//         "success",
//         wasEditing ? "Admin updated successfully." : "Admin created successfully."
//       );
//     } catch (err) {
//       setFormError(err.message || "Could not save admin.");
//       showToast("error", err.message || "Could not save admin.");
//     } finally {
//       setSaving(false);
//     }
//   };

//   const filteredAdmins = useMemo(() => {
//     const query = search.trim().toLowerCase();
//     if (!query) return admins;

//     return admins.filter((admin) =>
//       [
//         admin.name,
//         admin.email,
//         admin.phone,
//         admin.customer_name,
//         admin.state_name,
//         admin.zone_name,
//         admin.scope_name,
//       ]
//         .filter(Boolean)
//         .some((value) => String(value).toLowerCase().includes(query))
//     );
//   }, [admins, search]);

//   return (
//     <div className="admins-page">
//       <ol className="admins-stepper">
//         <li className={view === "list" ? "active" : "done"}>
//           <button type="button" className="step-btn" onClick={() => setView("list")}>
//             <span className="step-num">1</span> Admins
//           </button>
//         </li>
//         <li className={view === "form" ? "active" : ""}>
//           <button type="button" className="step-btn" onClick={openCreate}>
//             <span className="step-num">2</span> Add Admin
//           </button>
//         </li>
//       </ol>

//       {view === "list" ? (
//         <>
//           <div className="admins-header">
//             <div>
//               <h1>Admins</h1>
//               <p>
//                 Each admin belongs to one customer State or Zone and can see
//                 everything below that hierarchy node.
//               </p>
//             </div>
//             <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
//               {(isSuperAdmin || isCustomerUser) && (
//                 <button type="button" className="btn-secondary" onClick={() => { setView("allocate"); fetchAllocationData(); }}>
//                   <FiCpu /> Allocate Devices
//                 </button>
//               )}
//               <button type="button" className="btn-primary" onClick={openCreate}>
//                 <FiUserPlus /> Add Admin
//               </button>
//             </div>
//           </div>

//           <div className="admins-toolbar">
//             <div style={{ position: "relative", flex: 1 }}>
//               <FiSearch style={{ position: "absolute", left: 12, top: 12, color: "#9ca3af" }} />
//               <input
//                 className="admins-search"
//                 style={{ paddingLeft: 36, width: "100%" }}
//                 placeholder={
//                   isCustomerUser
//                     ? "Search by name, email, state or zone..."
//                     : "Search by name, email, customer, state or zone..."
//                 }
//                 value={search}
//                 onChange={(event) => setSearch(event.target.value)}
//               />
//             </div>
//             <span className="admins-count">{filteredAdmins.length} admins</span>
//             {/* <button type="button" className="btn-secondary" onClick={fetchAdmins}>
//               <FiRefreshCw /> Refresh
//             </button> */}
//           </div>

//           {error && <div className="admins-error">{error}</div>}

//           <div className="admins-table-card">
//             {loading ? (
//               <div className="admins-loading">Loading admins...</div>
//             ) : filteredAdmins.length === 0 ? (
//               <div className="admins-empty">No admins found.</div>
//             ) : (
//               <table className="admins-table">
//                 <thead>
//                   <tr>
//                     <th>Name</th>
//                     <th>Email</th>
//                     {/* <th>Customer</th>  */}
//                     {!isCustomerUser && <th>Customer</th>}
//                     <th>Hierarchy</th>
//                     <th>Assigned Scope</th>
//                     <th>Status</th>
//                     <th>Action</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {filteredAdmins.map((admin) => (
//                     <tr key={admin.id}>
//                       <td>{admin.name || "—"}</td>
//                       <td>{admin.email || "—"}</td>
//                       {/* <td>{admin.customer_name || admin.customer?.company || "—"}</td> */}
//                       {!isCustomerUser && (
//                         <td>
//                           {admin.customer_name || admin.customer?.company || "—"}
//                         </td>
//                       )}
//                       <td>{hierarchyLabel[admin.customer_hierarchy_type] || "—"}</td>
//                       <td>
//                         {admin.customer_hierarchy_type === "ZONAL"
//                           ? admin.zone_name || "—"
//                           : admin.state_name || "—"}
//                       </td>
//                       <td>{admin.is_active ? "Active" : "Inactive"}</td>
//                       <td>
//                         <button
//                           type="button"
//                           className="btn-icon"
//                           onClick={() => openEdit(admin)}
//                           title="Edit"
//                         >
//                           <FiEdit3 size={16} />
//                         </button>
//                         <button
//                           type="button"
//                           className="btn-icon"
//                           onClick={() => openDeleteConfirm(admin)}
//                           title="Delete"
//                           style={{ color: "#dc2626" }}
//                         >
//                           <FiTrash2 size={16} />
//                         </button>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             )}
//           </div>
//         </>
//       ) : view === "allocate" ? (
//         <div className="admins-panel">
//           <div className="admins-panel-header">
//             <FiUserPlus size={22} />
//             <div>
//               <h2>Allocate Devices to Admins</h2>
//               <p>Super Admins and Customers can allocate a customer-owned AC device to a Branch Admin. Admins then manage devices within their scope.</p>
//             </div>
//           </div>
//           {allocationError && <div className="form-error">{allocationError}</div>}
//           {allocationLoading ? <p>Loading devices and admins...</p> : (
//             <div className="form-grid">
//               <label>
//                 Device / AC *
//                 <select value={allocationDeviceId} onChange={(e) => setAllocationDeviceId(e.target.value)}>
//                   <option value="">Select device</option>
//                   {allocationDevices.map((device) => (
//                     <option key={device.local_device_id || device.id || device.ac_id} value={device.local_device_id || device.id || device.ac_id}>
//                       {[device.ac_id, device.device_name, device.customer_name ? `Customer: ${device.customer_name}` : "Unassigned customer"].filter(Boolean).join(" — ")}
//                     </option>
//                   ))}
//                 </select>
//               </label>
//               <label>
//                 Assign to Admin *
//                 <select value={allocationAdminId} onChange={(e) => setAllocationAdminId(e.target.value)}>
//                   <option value="">Select admin</option>
//                   {admins.filter((admin) => (admin.role || "BR_ADMIN") === "BR_ADMIN").map((admin) => (
//                     <option key={admin.id} value={admin.id}>{admin.name || admin.email}{admin.customer_name ? ` — ${admin.customer_name}` : ""}</option>
//                   ))}
//                 </select>
//               </label>
//             </div>
//           )}
//           <div className="form-actions">
//             <button type="button" className="btn-secondary" onClick={() => { setView("list"); setAllocationError(""); }}>Back to Admins</button>
//             <button type="button" className="btn-primary" onClick={submitDeviceAllocation} disabled={allocationSaving || allocationLoading}>
//               {allocationSaving ? "Allocating..." : "Allocate Device"}
//             </button>
//           </div>
//           <div style={{ marginTop: 18 }}>
//             <h3>Current Allocations</h3>
//             <div className="admins-table-wrap">
//               <table className="admins-table">
//                 <thead><tr><th>Device</th><th>Customer</th><th>Assigned Admin</th><th>Site / Branch</th></tr></thead>
//                 <tbody>
//                   {allocationDevices.filter((device) => device.assigned_admin || device.assigned_admin_name).map((device) => (
//                     <tr key={device.local_device_id || device.id || device.ac_id}>
//                       <td>{device.ac_id || device.device_name || device.id}</td>
//                       <td>{device.customer_name || "—"}</td>
//                       <td>{device.assigned_admin_name || device.assigned_admin_email || device.assigned_admin || "—"}</td>
//                       <td>{device.site_name || device.branch_name || "—"}</td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           </div>
//         </div>
//       ) : (
//         <div className="admins-panel">
//           <div className="admins-panel-header">
//             <FiUserPlus size={22} />
//             <div>
//               <h2>{form.id ? "Edit Admin" : "Create Branch Admin"}</h2>
//               <p>
//                 Assign the admin to the customer's top-level State or Zone.
//                 Lower locations are inherited automatically.
//               </p>
//             </div>
//           </div>

//           {formError && <div className="admins-error">{formError}</div>}

//           <form className="admins-form" onSubmit={handleSubmit}>
//             <div className="form-grid">
//               <label>
//                 Name *
//                 <input
//                   value={form.name}
//                   onChange={(e) => setForm({ ...form, name: e.target.value })}
//                 />
//               </label>

//               <label>
//                 Email *
//                 <input
//                   type="email"
//                   value={form.email}
//                   onChange={(e) => setForm({ ...form, email: e.target.value })}
//                 />
//               </label>

//               <label>
//                 Phone
//                 <input
//                   value={form.phone}
//                   onChange={(e) => setForm({ ...form, phone: e.target.value })}
//                 />
//               </label>

//               <label>
//                 {form.id ? "Password (optional)" : "Password *"}
//                 <input
//                   type="password"
//                   value={form.password}
//                   onChange={(e) => setForm({ ...form, password: e.target.value })}
//                   // required={!form.id}
//                 />
//               </label>

//               {isSuperAdmin ? (
//                 <label>
//                   Customer *
//                   <select
//                     value={form.customer}
//                     onChange={(e) => handleCustomerChange(e.target.value)}
//                   >
//                     <option value="">Select Customer</option>
//                     {customers.map((customer) => (
//                       <option key={customer.id} value={customer.id}>
//                         {customer.company}
//                       </option>
//                     ))}
//                   </select>
//                 </label>
//               ) : (
//                 <label>
//                   Customer
//                   <input value={currentCustomerName} disabled />
//                 </label>
//               )}

//               <label>
//                 Hierarchy
//                 <input
//                   value={
//                     hierarchyLabel[hierarchy] ||
//                     hierarchy ||
//                     "Select customer first"
//                   }
//                   disabled
//                 />
//               </label>

//               {hierarchy === "GEOGRAPHICAL" && (
//                 <label>
//                   State *
//                   <select
//                     value={form.state}
//                     onChange={(e) =>
//                       setForm({ ...form, state: e.target.value })
//                     }
//                     disabled={locationsLoading}
//                   >
//                     <option value="">
//                       {locationsLoading ? "Loading states..." : "Select State"}
//                     </option>
//                     {states.map((state) => (
//                       <option key={state.id} value={state.id}>
//                         {state.name}
//                       </option>
//                     ))}
//                   </select>
//                 </label>
//               )}

//               {hierarchy === "ZONAL" && (
//                 <label>
//                   Zone *
//                   <select
//                     value={form.zone}
//                     onChange={(e) =>
//                       setForm({ ...form, zone: e.target.value })
//                     }
//                     disabled={locationsLoading}
//                   >
//                     <option value="">
//                       {locationsLoading ? "Loading zones..." : "Select Zone"}
//                     </option>
//                     {zones.map((zone) => (
//                       <option key={zone.id} value={zone.id}>
//                         {zone.name}
//                       </option>
//                     ))}
//                   </select>
//                 </label>
//               )}

//               <label className="checkbox-row">
//                 <input
//                   type="checkbox"
//                   checked={form.is_active}
//                   onChange={(e) =>
//                     setForm({ ...form, is_active: e.target.checked })
//                   }
//                 />
//                 Active
//               </label>
//             </div>

//             <div className="form-actions">
//               <button type="button" className="btn-secondary" onClick={() => setView("list")}>
//                 Cancel
//               </button>
//               <button type="submit" className="btn-primary" disabled={saving}>
//                 {saving ? "Saving..." : form.id ? "Update Admin" : "Create Admin"}
//               </button>
//             </div>
//           </form>
//         </div>
//       )}

//       {deleteTarget && (
//         <div className="admins-modal-overlay" onClick={closeDeleteConfirm}>
//           <div
//             className="admins-modal"
//             onClick={(event) => event.stopPropagation()}
//           >
//             <div className="admins-modal-header">
//               <FiTrash2 size={20} style={{ color: "#dc2626" }} />
//               <h3>Delete Admin</h3>
//             </div>

//             <div className="admins-modal-body">
//               <p>
//                 Are you sure you want to delete{" "}
//                 <strong>{deleteTarget.name || deleteTarget.email}</strong>?
//               </p>
//               <p className="admins-modal-warning">
//                 This removes the admin from both the AC Monitoring system and 3TP.
//                 This action cannot be undone.
//               </p>
//             </div>

//             <div className="admins-modal-actions">
//               <button
//                 type="button"
//                 className="btn-secondary"
//                 onClick={closeDeleteConfirm}
//                 disabled={deleting}
//               >
//                 Cancel
//               </button>
//               <button
//                 type="button"
//                 className="btn-danger"
//                 onClick={confirmDelete}
//                 disabled={deleting}
//               >
//                 {deleting ? "Deleting..." : "Delete"}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {toast && (
//         <div
//           key={toast.id}
//           className={`admins-toast admins-toast-${toast.type}`}
//           role="status"
//         >
//           <span className="admins-toast-icon">
//             {toast.type === "success" ? "✓" : "!"}
//           </span>
//           <span>{toast.message}</span>
//         </div>
//       )}
//     </div>
//   );
// };

// export default Admin_Creation;



import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiEdit3, FiTrash2, FiRefreshCw, FiSearch, FiUserPlus, FiCpu } from "react-icons/fi";
import "./AdminCreation.css";
import { useAuth } from "../Layout/AuthContext";

const API_BASE = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000/api`;
const USERS_URL = `${API_BASE}/admins/`;
const CUSTOMERS_URL = `${API_BASE}/customers/`;
const STATES_URL = `${API_BASE}/states/`;
const ZONES_URL = `${API_BASE}/zones/`;
const DEVICES_URL = `${API_BASE}/devices/`;
const ASSIGN_DEVICE_ADMIN_URL = `${API_BASE}/devices/assign/admin/`;

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
      ? { Authorization: token.startsWith("Token ") ? token : `Token ${token}` }
      : {}),
  };
};

const normalizeList = (result) =>
  Array.isArray(result)
    ? result
    : Array.isArray(result?.data)
      ? result.data
      : Array.isArray(result?.results)
        ? result.results
        : Array.isArray(result?.data?.results)
          ? result.data.results
          : [];

const emptyForm = {
  id: null,
  name: "",
  email: "",
  phone: "",
  password: "",
  is_active: true,
  customer: "",
  hierarchy_type: "",
  state: "",
  zone: "",
};

const hierarchyLabel = {
  GEOGRAPHICAL: "Geographical — State → District → Taluka → Branch",
  ZONAL: "Zonal — Zone → Circle → Region → Division → Branch",
};

const Admin_Creation = () => {
  const [toast, setToast] = useState(null);
  const { user: currentUser } = useAuth();
  const isCustomerUser = currentUser?.role === "CUSTOMER";
  const isSuperAdmin = currentUser?.role === "ORG_SUPER_ADMIN";

  const [view, setView] = useState("list");
  const [admins, setAdmins] = useState([]);
  const [allocationDevices, setAllocationDevices] = useState([]);
  const [allocationDeviceId, setAllocationDeviceId] = useState("");
  const [allocationAdminId, setAllocationAdminId] = useState("");
  const [allocationLoading, setAllocationLoading] = useState(false);
  const [allocationSaving, setAllocationSaving] = useState(false);
  const [allocationError, setAllocationError] = useState("");
  const [customers, setCustomers] = useState([]);
  const [states, setStates] = useState([]);
  const [zones, setZones] = useState([]);

  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  const showToast = useCallback((type, message) => {
    setToast({ type, message, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  
const getCustomerId = (user) => {
  const customer = user?.customer;

  return (
    customer?.id ??
    customer?.pk ??
    (typeof customer === "string" || typeof customer === "number"
      ? customer
      : null) ??
    user?.customer_id ??
    user?.scopeId ??
    ""
  );
};

  const currentCustomerId = useMemo(() => {
    if (!isCustomerUser) return "";
    return String(getCustomerId(currentUser) || "");
  }, [currentUser, isCustomerUser]);

  const selectedCustomer = useMemo(() => {
    const id = String(form.customer || currentCustomerId || "");

    return (
      customers.find((customer) => String(customer.id) === id) ||
      null
    );
  }, [customers, form.customer, currentCustomerId]);

  const hierarchy = (
    isCustomerUser
      ? currentUser?.customer_hierarchy_type ??
        currentUser?.customer?.hierarchy_type
      : selectedCustomer?.hierarchy_type || form.hierarchy_type
  ) || "";


  const currentCustomerName = useMemo(
    () => currentUser?.scope_name || currentUser?.customer_name || "Your Customer",
    [currentUser]
  );

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(USERS_URL, {
        headers: authHeaders(),
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.detail || result?.message || `HTTP ${response.status}`);
      }
      setAdmins(normalizeList(result));
    } catch (err) {
      setError(err.message || "Unable to load admins.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load devices and admins for the device-allocation panel.
  const fetchAllocationData = useCallback(async () => {
    setAllocationLoading(true);
    setAllocationError("");
    try {
      const [deviceResponse, adminResponse] = await Promise.all([
        fetch(DEVICES_URL, { headers: authHeaders(), cache: "no-store" }),
        fetch(USERS_URL, { headers: authHeaders(), cache: "no-store" }),
      ]);
      const [devicePayload, adminPayload] = await Promise.all([
        deviceResponse.json().catch(() => ({})),
        adminResponse.json().catch(() => ({})),
      ]);
      if (!deviceResponse.ok) {
        throw new Error(devicePayload?.detail || devicePayload?.message || devicePayload?.error || `Devices HTTP ${deviceResponse.status}`);
      }
      if (!adminResponse.ok) {
        throw new Error(adminPayload?.detail || adminPayload?.message || adminPayload?.error || `Admins HTTP ${adminResponse.status}`);
      }
      setAllocationDevices(normalizeList(devicePayload));
      setAdmins(normalizeList(adminPayload));
    } catch (err) {
      setAllocationError(err.message || "Unable to load devices and admins.");
    } finally {
      setAllocationLoading(false);
    }
  }, []);

  const submitDeviceAllocation = async () => {
    if (!allocationDeviceId || !allocationAdminId) {
      setAllocationError("Select both a device and an admin.");
      return;
    }
    setAllocationSaving(true);
    setAllocationError("");
    try {
      const response = await fetch(ASSIGN_DEVICE_ADMIN_URL, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ device_id: allocationDeviceId, admin_id: allocationAdminId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.detail || result?.message || result?.error || `HTTP ${response.status}`);
      }
      showToast("success", result?.message || "Device allocated to admin successfully.");
      setAllocationDeviceId("");
      setAllocationAdminId("");
      await fetchAllocationData();
    } catch (err) {
      setAllocationError(err.message || "Unable to allocate device.");
    } finally {
      setAllocationSaving(false);
    }
  };

  const fetchCustomers = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const response = await fetch(CUSTOMERS_URL, {
        headers: authHeaders(),
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.detail || `HTTP ${response.status}`);
      setCustomers(normalizeList(result));
    } catch (err) {
      setFormError(err.message || "Unable to load customers.");
    }
  }, [isSuperAdmin]);

  
  const fetchLocations = useCallback(async (customerId, hierarchyType) => {
    setStates([]);
    setZones([]);
    setFormError("");

    if (!customerId || !hierarchyType) return;

    setLocationsLoading(true);

    try {
      const endpoint =
        hierarchyType === "GEOGRAPHICAL"
          ? STATES_URL
          : hierarchyType === "ZONAL"
            ? ZONES_URL
            : null;

      if (!endpoint) {
        throw new Error(`Unsupported hierarchy: ${hierarchyType}`);
      }

      const url = new URL(endpoint);
      url.searchParams.set("customer", String(customerId));

      const response = await fetch(url.toString(), {
        headers: authHeaders(),
        cache: "no-store",
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result?.detail ||
          result?.message ||
          `Unable to load locations (HTTP ${response.status})`
        );
      }

      const locations = normalizeList(result);

      if (hierarchyType === "GEOGRAPHICAL") {
        setStates(locations);
        setZones([]);
      } else {
        setZones(locations);
        setStates([]);
      }

      if (locations.length === 0) {
        setFormError(
          `No ${
            hierarchyType === "GEOGRAPHICAL" ? "states" : "zones"
          } found in this customer’s generated hierarchy. Verify that customer creation initialized its hierarchy.`
        );
      }
    } catch (err) {
      setStates([]);
      setZones([]);
      setFormError(err.message || "Unable to load hierarchy locations.");
    } finally {
      setLocationsLoading(false);
    }
  }, []);


  useEffect(() => {
    fetchAdmins();
    fetchCustomers();
  }, [fetchAdmins, fetchCustomers]);

  useEffect(() => {
    if (isCustomerUser && currentCustomerId) {
      setForm((previous) => ({
        ...previous,
        customer: currentCustomerId,
        hierarchy_type: currentUser?.customer_hierarchy_type || "",
      }));
    }
  }, [isCustomerUser, currentCustomerId, currentUser]);

  useEffect(() => {
    const customerId = isCustomerUser ? currentCustomerId : form.customer;
    const hierarchyType = isCustomerUser
      ? currentUser?.customer_hierarchy_type
      : form.hierarchy_type || selectedCustomer?.hierarchy_type;

    if (!customerId || !hierarchyType) {
      setStates([]);
      setZones([]);
      return;
    }

    fetchLocations(customerId, hierarchyType);
  }, [
    isCustomerUser,
    currentCustomerId,
    currentUser?.customer_hierarchy_type,
    form.customer,
    form.hierarchy_type,
    selectedCustomer?.hierarchy_type,
    fetchLocations,
  ]);

  const resetForm = () => {
    setForm({
      ...emptyForm,
      customer: isCustomerUser ? currentCustomerId : "",
      hierarchy_type: isCustomerUser ? currentUser?.customer_hierarchy_type || "" : "",
    });
    setStates([]);
    setZones([]);
    setFormError("");
  };

  const openCreate = () => {
    resetForm();
    setView("form");
  };

  const openEdit = (admin) => {
    setForm({
      ...emptyForm,
      id: admin.id,
      name: admin.name || "",
      email: admin.email || "",
      phone: admin.phone || "",
      is_active: admin.is_active !== false,
      customer: String(admin.customer || ""),
      hierarchy_type: admin.customer_hierarchy_type || "",
      state: String(admin.state || ""),
      zone: String(admin.zone || ""),
    });
    setFormError("");
    setView("form");
  };

  const openDeleteConfirm = (admin) => {
    setDeleteTarget(admin);
  };

  const closeDeleteConfirm = () => {
    if (deleting) return; // don't close mid-request
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    const name = deleteTarget.name || deleteTarget.email || "Admin";

    setDeleting(true);
    setError("");
    try {
      const response = await fetch(`${USERS_URL}${deleteTarget.id}/`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (!response.ok && response.status !== 204) {
        const result = await response.json().catch(() => ({}));
        throw new Error(
          result?.detail || result?.message || `HTTP ${response.status}`
        );
      }

      setAdmins((previous) =>
        previous.filter((item) => item.id !== deleteTarget.id)
      );
      setDeleteTarget(null);
      showToast("success", `${name} deleted successfully.`);
    } catch (err) {
      setError(err.message || "Could not delete admin.");
      setDeleteTarget(null);
      showToast("error", err.message || "Could not delete admin.");
    } finally {
      setDeleting(false);
    }
  };

  const handleCustomerChange = (customerId) => {
    const customer = customers.find(
      (item) => String(item.id) === String(customerId)
    );

    setForm((previous) => ({
      ...previous,
      customer: customerId,
      hierarchy_type: customer?.hierarchy_type || "",
      state: "",
      zone: "",
    }));

    setStates([]);
    setZones([]);
    setFormError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!form.name.trim()) return setFormError("Name is required.");
    if (!form.email.trim()) return setFormError("Email is required.");
    if (!form.id && !form.password.trim()) {
      return setFormError("Password is required.");
    }

    const customerId = isCustomerUser ? currentCustomerId : form.customer;
    const hierarchyType = isCustomerUser
      ? currentUser?.customer_hierarchy_type
      : form.hierarchy_type || selectedCustomer?.hierarchy_type;

    if (!customerId) return setFormError("Select a customer.");
    if (!hierarchyType) return setFormError("Customer hierarchy is not configured.");

    if (hierarchyType === "GEOGRAPHICAL" && !form.state) {
      return setFormError("Select the State where the admin belongs.");
    }

    if (hierarchyType === "ZONAL" && !form.zone) {
      return setFormError("Select the Zone where the admin belongs.");
    }

    const wasEditing = Boolean(form.id);

    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      role: "BR_ADMIN",
      is_active: form.is_active,
      customer: customerId,
    };

    if (hierarchyType === "GEOGRAPHICAL") payload.state = form.state;
    if (hierarchyType === "ZONAL") payload.zone = form.zone;
    if (form.password.trim()) payload.password = form.password;

    setSaving(true);

    try {
      const response = await fetch(
        form.id ? `${USERS_URL}${form.id}/` : USERS_URL,
        {
          method: form.id ? "PATCH" : "POST",
          headers: authHeaders(),
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          result?.detail ||
          result?.message ||
          Object.entries(result || {})
            .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
            .join(" | ") ||
          `HTTP ${response.status}`;
        throw new Error(message);
      }

      await fetchAdmins();
      setView("list");
      resetForm();
      showToast(
        "success",
        wasEditing ? "Admin updated successfully." : "Admin created successfully."
      );
    } catch (err) {
      setFormError(err.message || "Could not save admin.");
      showToast("error", err.message || "Could not save admin.");
    } finally {
      setSaving(false);
    }
  };

  const filteredAdmins = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return admins;

    return admins.filter((admin) =>
      [
        admin.name,
        admin.email,
        admin.phone,
        admin.customer_name,
        admin.state_name,
        admin.zone_name,
        admin.scope_name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [admins, search]);

  return (
    <div className="admins-page">
      <ol className="admins-stepper">
        <li className={view === "list" ? "active" : "done"}>
          <button type="button" className="step-btn" onClick={() => setView("list")}>
            <span className="step-num">1</span> Admins
          </button>
        </li>
        <li className={view === "form" ? "active" : ""}>
          <button type="button" className="step-btn" onClick={openCreate}>
            <span className="step-num">2</span> Add Admin
          </button>
        </li>
      </ol>

      {view === "list" ? (
        <>
          <div className="admins-header">
            <div>
              <h1>Admins</h1>
              <p>
                Each admin belongs to one customer State or Zone and can see
                everything below that hierarchy node.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(isSuperAdmin || isCustomerUser) && (
                <button type="button" className="btn-secondary" onClick={() => { setView("allocate"); fetchAllocationData(); }}>
                  <FiCpu /> Allocate Devices
                </button>
              )}
              <button type="button" className="btn-primary" onClick={openCreate}>
                <FiUserPlus /> Add Admin
              </button>
            </div>
          </div>

          <div className="admins-toolbar">
            <div style={{ position: "relative", flex: 1 }}>
              <FiSearch style={{ position: "absolute", left: 12, top: 12, color: "#9ca3af" }} />
              <input
                className="admins-search"
                style={{ paddingLeft: 36, width: "100%" }}
                placeholder={
                  isCustomerUser
                    ? "Search by name, email, state or zone..."
                    : "Search by name, email, customer, state or zone..."
                }
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <span className="admins-count">{filteredAdmins.length} admins</span>
            {/* <button type="button" className="btn-secondary" onClick={fetchAdmins}>
              <FiRefreshCw /> Refresh
            </button> */}
          </div>

          {error && <div className="admins-error">{error}</div>}

          <div className="admins-table-card">
            {loading ? (
              <div className="admins-loading">Loading admins...</div>
            ) : filteredAdmins.length === 0 ? (
              <div className="admins-empty">No admins found.</div>
            ) : (
              <table className="admins-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    {/* <th>Customer</th>  */}
                    {!isCustomerUser && <th>Customer</th>}
                    <th>Hierarchy</th>
                    <th>Assigned Scope</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdmins.map((admin) => (
                    <tr key={admin.id}>
                      <td>{admin.name || "—"}</td>
                      <td>{admin.email || "—"}</td>
                      {/* <td>{admin.customer_name || admin.customer?.company || "—"}</td> */}
                      {!isCustomerUser && (
                        <td>
                          {admin.customer_name || admin.customer?.company || "—"}
                        </td>
                      )}
                      <td>{hierarchyLabel[admin.customer_hierarchy_type] || "—"}</td>
                      <td>
                        {admin.customer_hierarchy_type === "ZONAL"
                          ? admin.zone_name || "—"
                          : admin.state_name || "—"}
                      </td>
                      <td>{admin.is_active ? "Active" : "Inactive"}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => openEdit(admin)}
                          title="Edit"
                        >
                          <FiEdit3 size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => openDeleteConfirm(admin)}
                          title="Delete"
                          style={{ color: "#dc2626" }}
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : view === "allocate" ? (
        <div className="admins-panel">
          <div className="admins-panel-header">
            <FiUserPlus size={22} />
            <div>
              <h2>Allocate Devices to Admins</h2>
              <p>Super Admins and Customers can allocate a customer-owned AC device to a Branch Admin. Admins then manage devices within their scope.</p>
            </div>
          </div>
          {allocationError && <div className="form-error">{allocationError}</div>}
          {allocationLoading ? <p>Loading devices and admins...</p> : (
            <div className="form-grid">
              <label>
                Device / AC *
                <select value={allocationDeviceId} onChange={(e) => setAllocationDeviceId(e.target.value)}>
                  <option value="">Select device</option>
                  {allocationDevices.map((device) => (
                    <option key={device.local_device_id || device.id || device.ac_id} value={device.local_device_id || device.id || device.ac_id}>
                      {[device.ac_id, device.device_name, device.customer_name ? `Customer: ${device.customer_name}` : "Unassigned customer"].filter(Boolean).join(" — ")}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Assign to Admin *
                <select value={allocationAdminId} onChange={(e) => setAllocationAdminId(e.target.value)}>
                  <option value="">Select admin</option>
                  {admins.filter((admin) => (admin.role || "BR_ADMIN") === "BR_ADMIN").map((admin) => (
                    <option key={admin.id} value={admin.id}>{admin.name || admin.email}{admin.customer_name ? ` — ${admin.customer_name}` : ""}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => { setView("list"); setAllocationError(""); }}>Back to Admins</button>
            <button type="button" className="btn-primary" onClick={submitDeviceAllocation} disabled={allocationSaving || allocationLoading}>
              {allocationSaving ? "Allocating..." : "Allocate Device"}
            </button>
          </div>
          <div style={{ marginTop: 18 }}>
            <h3>Current Allocations</h3>
            <div className="admins-table-wrap">
              <table className="admins-table">
                <thead><tr><th>Device</th><th>Customer</th><th>Assigned Admin</th><th>Site / Branch</th></tr></thead>
                <tbody>
                  {allocationDevices.filter((device) => device.assigned_admin || device.assigned_admin_name).map((device) => (
                    <tr key={device.local_device_id || device.id || device.ac_id}>
                      <td>{device.ac_id || device.device_name || device.id}</td>
                      <td>{device.customer_name || "—"}</td>
                      <td>{device.assigned_admin_name || device.assigned_admin_email || device.assigned_admin || "—"}</td>
                      <td>{device.site_name || device.branch_name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="admins-panel">
          <div className="admins-panel-header">
            <FiUserPlus size={22} />
            <div>
              <h2>{form.id ? "Edit Admin" : "Create Branch Admin"}</h2>
              <p>
                Assign the admin to the customer's top-level State or Zone.
                Lower locations are inherited automatically.
              </p>
            </div>
          </div>

          {formError && <div className="admins-error">{formError}</div>}

          <form className="admins-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <label>
                Name *
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>

              <label>
                Email *
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>

              <label>
                Phone
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>

              <label>
                {form.id ? "Password (optional)" : "Password *"}
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  // required={!form.id}
                />
              </label>

              {isSuperAdmin ? (
                <label>
                  Customer *
                  <select
                    value={form.customer}
                    onChange={(e) => handleCustomerChange(e.target.value)}
                  >
                    <option value="">Select Customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.company}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label>
                  Customer
                  <input value={currentCustomerName} disabled />
                </label>
              )}

              <label>
                Hierarchy
                <input
                  value={
                    hierarchyLabel[hierarchy] ||
                    hierarchy ||
                    "Select customer first"
                  }
                  disabled
                />
              </label>

              {hierarchy === "GEOGRAPHICAL" && (
                <label>
                  State *
                  <select
                    value={form.state}
                    onChange={(e) =>
                      setForm({ ...form, state: e.target.value })
                    }
                    disabled={locationsLoading}
                  >
                    <option value="">
                      {locationsLoading ? "Loading states..." : "Select State"}
                    </option>
                    {states.map((state) => (
                      <option key={state.id} value={state.id}>
                        {state.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {hierarchy === "ZONAL" && (
                <label>
                  Zone *
                  <select
                    value={form.zone}
                    onChange={(e) =>
                      setForm({ ...form, zone: e.target.value })
                    }
                    disabled={locationsLoading}
                  >
                    <option value="">
                      {locationsLoading ? "Loading zones..." : "Select Zone"}
                    </option>
                    {zones.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm({ ...form, is_active: e.target.checked })
                  }
                />
                Active
              </label>
            </div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setView("list")}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Saving..." : form.id ? "Update Admin" : "Create Admin"}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="admins-modal-overlay" onClick={closeDeleteConfirm}>
          <div
            className="admins-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admins-modal-header">
              <FiTrash2 size={20} style={{ color: "#dc2626" }} />
              <h3>Delete Admin</h3>
            </div>

            <div className="admins-modal-body">
              <p>
                Are you sure you want to delete{" "}
                <strong>{deleteTarget.name || deleteTarget.email}</strong>?
              </p>
              <p className="admins-modal-warning">
                This removes the admin from both the AC Monitoring system and 3TP.
                This action cannot be undone.
              </p>
            </div>

            <div className="admins-modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={closeDeleteConfirm}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          key={toast.id}
          className={`admins-toast admins-toast-${toast.type}`}
          role="status"
        >
          <span className="admins-toast-icon">
            {toast.type === "success" ? "✓" : "!"}
          </span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default Admin_Creation;
