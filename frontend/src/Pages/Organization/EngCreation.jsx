// // import React, { useCallback, useEffect, useMemo, useState } from "react";
// // import {
// //   FiTrash2, 
// //   FiPlus, 
// //   FiArrowLeft, 
// //   FiMapPin, 
// //   FiCheckCircle,
// //   FiUserPlus, 
// //   FiEdit2, 
// //   FiEdit3,
// // } from "react-icons/fi";
// // import "./AdminCreation.css";

// // const API_BASE   = "http://localhost:8000/api";
// // const USERS_URL  = `${API_BASE}/admins/`;
// // const SITES_URL  = `${API_BASE}/sites/`;

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
// //     ...(token ? { Authorization: `Token ${token}` } : {}),
// //   };
// // };

// // const EMPTY_FORM = {
// //   id:       null,
// //   name:     "",
// //   email:    "",
// //   phone:    "",
// //   role:     "ENGINEER",
// //   password: "",
// //   is_active: true,
// // };

// // function normalizeList(result) {
// //   if (Array.isArray(result))                   return result;
// //   if (result && Array.isArray(result.data))    return result.data;
// //   if (result && Array.isArray(result.results)) return result.results;
// //   return [];
// // }

// // function EngCreation() {
// //   const [view, setView] = useState("list");

// //   const [users, setUsers]     = useState([]);
// //   const [sites, setSites]     = useState([]);
// //   const [loading, setLoading] = useState(true);
// //   const [error, setError]     = useState("");
// //   const [search, setSearch]   = useState("");

// //   const [form, setForm]           = useState(EMPTY_FORM);
// //   const [formError, setFormError] = useState("");
// //   const [saving, setSaving]       = useState(false);
// //   const isEditing = Boolean(form.id);

// //   const [pendingEng, setPendingEng]     = useState(null);
// //   const [selectedSite, setSelectedSite] = useState("");
// //   const [assignError, setAssignError]   = useState("");
// //   const [assigning, setAssigning]       = useState(false);
// //   const [sitesLoading, setSitesLoading] = useState(false);

// //   const [confirmDelete, setConfirmDelete] = useState(null);
// //   const [deleting, setDeleting]           = useState(false);

// //   // --------------------------------------------------------
// //   // FETCH USERS
// //   // --------------------------------------------------------
// //   const fetchUsers = useCallback(async () => {
// //     try {
// //       setError("");
// //       const res = await fetch(USERS_URL, {
// //         method: "GET", cache: "no-store", headers: authHeaders(),
// //       });
// //       if (res.status === 401) throw new Error("401 Unauthorized. Please login again.");
// //       if (!res.ok)            throw new Error(`HTTP ${res.status}`);
// //       const result = await res.json();
// //       setUsers(normalizeList(result));
// //     } catch (err) {
// //       setError(err.message || "Unable to load engineers.");
// //     } finally {
// //       setLoading(false);
// //     }
// //   }, []);

// //   useEffect(() => { fetchUsers(); }, [fetchUsers]);

// //   // --------------------------------------------------------
// //   // FETCH SITES
// //   // --------------------------------------------------------
// //   const fetchSites = useCallback(async () => {
// //     setSitesLoading(true);
// //     try {
// //       const res = await fetch(SITES_URL, {
// //         method: "GET", cache: "no-store", headers: authHeaders(),
// //       });
// //       if (!res.ok) throw new Error(`HTTP ${res.status}`);
// //       const result = await res.json();
// //       setSites(normalizeList(result));
// //     } catch (err) {
// //       setAssignError(err.message || "Unable to load sites.");
// //     } finally {
// //       setSitesLoading(false);
// //     }
// //   }, []);

// //   // --------------------------------------------------------
// //   // DERIVED — engineers only
// //   // --------------------------------------------------------
// //   const engineers = useMemo(
// //     () => users.filter((u) => u.role === "ENGINEER"),
// //     [users]
// //   );

// //   const filtered = useMemo(() => {
// //     const q = search.trim().toLowerCase();
// //     if (!q) return engineers;
// //     return engineers.filter((u) =>
// //       [u.name, u.email, u.phone, u.scope_name]
// //         .filter(Boolean)
// //         .some((f) => String(f).toLowerCase().includes(q))
// //     );
// //   }, [engineers, search]);

// //   // --------------------------------------------------------
// //   // NAVIGATION
// //   // --------------------------------------------------------
// //   const goToCreate = () => {
// //     setForm(EMPTY_FORM);
// //     setFormError("");
// //     setView("form");
// //   };

// //   const openEditPanel = (eng) => {
// //     setForm({
// //       id:       eng.id,
// //       name:     eng.name || "",
// //       email:    eng.email || "",
// //       phone:    eng.phone || "",
// //       role:     "ENGINEER",
// //       password: "",
// //       is_active: eng.is_active ?? true,
// //     });
// //     setFormError("");
// //     setView("form");
// //   };

// //   const backToList = () => {
// //     setView("list");
// //     setForm(EMPTY_FORM);
// //     setFormError("");
// //     setPendingEng(null);
// //     setSelectedSite("");
// //     setAssignError("");
// //   };

// //   // --------------------------------------------------------
// //   // CREATE / UPDATE
// //   // --------------------------------------------------------
// //   const handleFieldChange = (field, value) =>
// //     setForm((prev) => ({ ...prev, [field]: value }));

// //   const handleSubmit = async (e) => {
// //     e.preventDefault();
// //     setFormError("");

// //     if (!form.name.trim())  return setFormError("Name is required.");
// //     if (!form.email.trim()) return setFormError("Email is required.");
// //     if (!isEditing && !form.password.trim()) return setFormError("Password is required.");

// //     const payload = {
// //       name:      form.name.trim(),
// //       email:     form.email.trim().toLowerCase(),
// //       phone:     form.phone.trim(),
// //       role:      "ENGINEER",
// //       // Only active immediately if editing; on create we activate after site assignment
// //       is_active: isEditing ? form.is_active : false,
// //     };
// //     if (form.password.trim()) payload.password = form.password;

// //     setSaving(true);
// //     try {
// //       const url    = isEditing ? `${USERS_URL}${form.id}/` : USERS_URL;
// //       const method = isEditing ? "PATCH" : "POST";

// //       const res = await fetch(url, {
// //         method, headers: authHeaders(), body: JSON.stringify(payload),
// //       });

// //       if (!res.ok) {
// //         const errBody = await res.json().catch(() => ({}));
// //         const message =
// //           typeof errBody === "object" && errBody !== null
// //             ? Object.entries(errBody)
// //                 .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
// //                 .join(" | ")
// //             : `HTTP ${res.status}`;
// //         throw new Error(message || `HTTP ${res.status}`);
// //       }

// //       const saved = await res.json();

// //       if (isEditing) {
// //         await fetchUsers();
// //         backToList();
// //       } else {
// //         fetchUsers();
// //         setPendingEng(saved);
// //         setSelectedSite(saved.site ?? "");
// //         setAssignError("");
// //         setView("assign");
// //         fetchSites();
// //       }
// //     } catch (err) {
// //       setFormError(err.message || "Could not save engineer.");
// //     } finally {
// //       setSaving(false);
// //     }
// //   };

// //   // --------------------------------------------------------
// //   // ASSIGN SITE
// //   // --------------------------------------------------------
// //   const openAssignFor = (eng) => {
// //     setPendingEng(eng);
// //     setSelectedSite(eng.site ?? "");
// //     setAssignError("");
// //     setView("assign");
// //     fetchSites();
// //   };

// //   const handleAssignSave = async () => {
// //     if (!pendingEng) return;
// //     if (!selectedSite) return setAssignError("Please pick a site.");

// //     setAssigning(true);
// //     setAssignError("");
// //     try {
// //       const res = await fetch(`${USERS_URL}${pendingEng.id}/`, {
// //         method: "PATCH",
// //         headers: authHeaders(),
// //         body: JSON.stringify({ site: selectedSite }),
// //       });

// //       if (!res.ok) {
// //         const errBody = await res.json().catch(() => ({}));
// //         const message =
// //           typeof errBody === "object" && errBody !== null
// //             ? Object.entries(errBody)
// //                 .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
// //                 .join(" | ")
// //             : `HTTP ${res.status}`;
// //         throw new Error(message || `HTTP ${res.status}`);
// //       }

// //       await fetchUsers();
// //       backToList();
// //     } catch (err) {
// //       setAssignError(err.message || "Could not assign site.");
// //     } finally {
// //       setAssigning(false);
// //     }
// //   };

// //   // --------------------------------------------------------
// //   // DELETE
// //   // --------------------------------------------------------
// //   const handleDelete = async () => {
// //     if (!confirmDelete || deleting) return;
// //     setDeleting(true);
// //     try {
// //       const res = await fetch(`${USERS_URL}${confirmDelete.id}/`, {
// //         method: "DELETE", headers: authHeaders(),
// //       });
// //       if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
// //       setUsers((prev) => prev.filter((u) => u.id !== confirmDelete.id));
// //       setConfirmDelete(null);
// //     } catch (err) {
// //       setError(err.message || "Could not delete engineer.");
// //       setConfirmDelete(null);
// //     } finally {
// //       setDeleting(false);
// //     }
// //   };

// //   // --------------------------------------------------------
// //   // RENDER
// //   // --------------------------------------------------------
// //   return (
// //     <div className="admins-page">

// //       <ol className="admins-stepper">
// //         <li className={view === "list" ? "active" : "done"}>
// //           <span className="step-num">1</span> Engineers
// //         </li>
// //         <li className={view === "form" ? "active" : view === "assign" ? "done" : ""}>
// //           <span className="step-num">2</span> {isEditing ? "Edit" : "Create"}
// //         </li>
// //         <li className={view === "assign" ? "active" : ""}>
// //           <span className="step-num">3</span> Assign Site
// //         </li>
// //       </ol>

// //       {/* ================= STEP 1 — LIST ================= */}
// //       {view === "list" && (
// //         <>
// //           <div className="admins-header">
// //             <div>
// //               <h1>Engineers</h1>
// //               <p>Manage engineers under your branches</p>
// //             </div>
// //             <button className="btn-primary" onClick={goToCreate}>
// //               <FiPlus /> Add Engineer
// //             </button>
// //           </div>

// //           <div className="admins-toolbar">
// //             <input
// //               type="text"
// //               className="admins-search"
// //               placeholder="Search by name, email, phone or site..."
// //               value={search}
// //               onChange={(e) => setSearch(e.target.value)}
// //             />
// //             <span className="admins-count">
// //               {filtered.length} of {engineers.length} engineers
// //             </span>
// //           </div>

// //           {error && <div className="admins-error">{error}</div>}

// //           <div className="admins-table-card">
// //             {loading ? (
// //               <div className="admins-loading">Loading engineers...</div>
// //             ) : filtered.length === 0 ? (
// //               <div className="admins-empty">
// //                 {engineers.length === 0
// //                   ? "No engineers yet. Click “Add Engineer” to create one."
// //                   : "No engineers match your search."}
// //               </div>
// //             ) : (
// //               <table className="admins-table">
// //                 <thead>
// //                   <tr>
// //                     <th>Name</th>
// //                     <th>Email</th>
// //                     <th>Phone</th>
// //                     <th>Site</th>
// //                     <th>Status</th>
// //                     <th className="actions-col">Actions</th>
// //                   </tr>
// //                 </thead>
// //                 <tbody>
// //                   {filtered.map((u) => (
// //                     <tr key={u.id}>
// //                       <td><strong>{u.name || "-"}</strong></td>
// //                       <td>{u.email}</td>
// //                       <td>{u.phone || "-"}</td>
// //                       <td>{u.scope_name || "-"}</td>
// //                       <td>
// //                         <span className={u.is_active ? "status-active" : "status-inactive"}>
// //                           ● {u.is_active ? "Active" : "Inactive"}
// //                         </span>
// //                       </td>
// //                       <td className="actions-col">
// //                         <button
// //                           className="btn-icon"
// //                           onClick={() => openEditPanel(u)}
// //                           title="Edit"
// //                           aria-label="Edit"
// //                         >
// //                           <FiEdit2 size={16} />
// //                         </button>
// //                         <button
// //                           className="btn-icon"
// //                           onClick={() => openAssignFor(u)}
// //                           title="Assign site"
// //                           aria-label="Assign site"
// //                         >
// //                           <FiMapPin size={16} />
// //                         </button>
// //                         <button
// //                           className="btn-icon btn-icon-danger"
// //                           onClick={() => setConfirmDelete(u)}
// //                           title="Delete"
// //                           aria-label="Delete"
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
// //       )}

// //       {/* ================= STEP 2 — CREATE / EDIT ================= */}
// //       {view === "form" && (
// //         <div className="admins-panel">
// //           <button className="btn-back" onClick={backToList}>
// //             <FiArrowLeft /> Back to list
// //           </button>

// //           <div className="admins-panel-header">
// //             {isEditing ? <FiEdit3 size={22} /> : <FiUserPlus size={22} />}
// //             <div>
// //               <h2>{isEditing ? "Edit Engineer" : "Create Engineer"}</h2>
// //               <p>
// //                 {isEditing
// //                   ? `Update details for ${form.name || form.email}.`
// //                   : "Add a new engineer. You'll assign a site in the next step."}
// //               </p>
// //             </div>
// //           </div>

// //           <form onSubmit={handleSubmit} className="admins-form">
// //             <div className="form-grid">
// //               <label>
// //                 Name *
// //                 <input
// //                   type="text"
// //                   value={form.name}
// //                   onChange={(e) => handleFieldChange("name", e.target.value)}
// //                   placeholder="Kiran Das"
// //                   required
// //                 />
// //               </label>

// //               <label>
// //                 Email *
// //                 <input
// //                   type="email"
// //                   value={form.email}
// //                   onChange={(e) => handleFieldChange("email", e.target.value)}
// //                   placeholder="kiran@acme.com"
// //                   required
// //                 />
// //               </label>

// //               <label>
// //                 Phone
// //                 <input
// //                   type="text"
// //                   value={form.phone}
// //                   onChange={(e) => handleFieldChange("phone", e.target.value)}
// //                   placeholder="+91 98765 43210"
// //                 />
// //               </label>

// //               <label>
// //                 {isEditing ? "Password (leave blank to keep current)" : "Password *"}
// //                 <input
// //                   type="password"
// //                   value={form.password}
// //                   onChange={(e) => handleFieldChange("password", e.target.value)}
// //                   placeholder={isEditing ? "••••••••" : "Set a password"}
// //                   required={!isEditing}
// //                 />
// //               </label>

// //               {isEditing && (
// //                 <label className="checkbox-row">
// //                   <input
// //                     type="checkbox"
// //                     checked={form.is_active}
// //                     onChange={(e) => handleFieldChange("is_active", e.target.checked)}
// //                   />
// //                   Active
// //                 </label>
// //               )}
// //             </div>

// //             {formError && <div className="form-error">{formError}</div>}

// //             <div className="panel-actions">
// //               <button
// //                 type="button"
// //                 className="btn-secondary"
// //                 onClick={backToList}
// //                 disabled={saving}
// //               >
// //                 Cancel
// //               </button>
// //               <button type="submit" className="btn-primary" disabled={saving}>
// //                 {saving
// //                   ? "Saving..."
// //                   : isEditing
// //                     ? "Save Changes"
// //                     : "Create & Continue"}
// //               </button>
// //             </div>
// //           </form>
// //         </div>
// //       )}

// //       {/* ================= STEP 3 — ASSIGN SITE ================= */}
// //       {view === "assign" && pendingEng && (
// //         <div className="admins-panel">
// //           <button className="btn-back" onClick={backToList}>
// //             <FiArrowLeft /> Back to list
// //           </button>

// //           <div className="admins-panel-header">
// //             <FiMapPin size={22} />
// //             <div>
// //               <h2>Assign Site</h2>
// //               <p>
// //                 Assign a site to{" "}
// //                 <strong>{pendingEng.name || pendingEng.email}</strong>
// //               </p>
// //             </div>
// //           </div>

// //           <div className="assign-card">
// //             <div className="assign-row">
// //               <span className="assign-label">Engineer</span>
// //               <span className="assign-value">{pendingEng.name}</span>
// //             </div>
// //             <div className="assign-row">
// //               <span className="assign-label">Email</span>
// //               <span className="assign-value">{pendingEng.email}</span>
// //             </div>
// //             <div className="assign-row">
// //               <span className="assign-label">Role</span>
// //               <span className="assign-value">Engineer</span>
// //             </div>

// //             <label className="assign-select">
// //               Site *
// //               {sitesLoading ? (
// //                 <span className="assign-loading">Loading sites...</span>
// //               ) : sites.length === 0 ? (
// //                 <span className="assign-loading">No sites available.</span>
// //               ) : (
// //                 <select
// //                   value={selectedSite}
// //                   onChange={(e) => setSelectedSite(e.target.value)}
// //                 >
// //                   <option value="">— Select a site —</option>
// //                   {sites.map((s) => (
// //                     <option key={s.id} value={s.id}>
// //                       {s.name || s.code}{s.branch_name ? ` — ${s.branch_name}` : ""}
// //                     </option>
// //                   ))}
// //                 </select>
// //               )}
// //             </label>
// //           </div>

// //           {assignError && <div className="form-error">{assignError}</div>}

// //           <div className="panel-actions">
// //             <button
// //               type="button"
// //               className="btn-secondary"
// //               onClick={backToList}
// //               disabled={assigning}
// //             >
// //               Skip & Return to List
// //             </button>
// //             <button
// //               type="button"
// //               className="btn-primary"
// //               onClick={handleAssignSave}
// //               disabled={assigning || !selectedSite}
// //             >
// //               <FiCheckCircle /> {assigning ? "Saving..." : "Save & Return to List"}
// //             </button>
// //           </div>
// //         </div>
// //       )}

// //       {/* ================= DELETE CONFIRMATION ================= */}
// //       {confirmDelete && (
// //         <div
// //           className="admins-modal-overlay"
// //           onClick={() => !deleting && setConfirmDelete(null)}
// //         >
// //           <div
// //             className="admins-modal admins-modal-small"
// //             onClick={(e) => e.stopPropagation()}
// //           >
// //             <h2>Delete Engineer</h2>
// //             <p>
// //               Are you sure you want to delete{" "}
// //               <strong>{confirmDelete.name || confirmDelete.email}</strong>?
// //               This cannot be undone.
// //             </p>
// //             <div className="panel-actions">
// //               <button
// //                 className="btn-secondary"
// //                 onClick={() => setConfirmDelete(null)}
// //                 disabled={deleting}
// //               >
// //                 Cancel
// //               </button>
// //               <button
// //                 className="btn-danger-solid"
// //                 onClick={handleDelete}
// //                 disabled={deleting}
// //               >
// //                 {deleting ? "Deleting..." : "Delete"}
// //               </button>
// //             </div>
// //           </div>
// //         </div>
// //       )}
// //     </div>
// //   );
// // }

// // export default EngCreation;



// import React, { useCallback, useEffect, useMemo, useState } from "react";
// import {
//   FiTrash2, FiPlus, FiArrowLeft, FiMapPin, FiCheckCircle,
//   FiUserPlus, FiEdit2, FiEdit3,
// } from "react-icons/fi";
// import "./AdminCreation.css";   // same stylesheet as Admin_Creation

// const API_BASE  = "http://localhost:8000/api";
// const USERS_URL = `${API_BASE}/admins/`;   // reuse admin endpoints; filter by role on client
// const SITES_URL = `${API_BASE}/sites/`;

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
//     ...(token ? { Authorization: `Token ${token}` } : {}),
//   };
// };

// const EMPTY_FORM = {
//   id:       null,
//   name:     "",
//   email:    "",
//   phone:    "",
//   role:     "ENGINEER",
//   password: "",
//   is_active: true,
// };

// function normalizeList(result) {
//   if (Array.isArray(result))                   return result;
//   if (result && Array.isArray(result.data))    return result.data;
//   if (result && Array.isArray(result.results)) return result.results;
//   return [];
// }

// // Probe common field names for the present customer.
// const getCustomerName = (eng) => {
//   if (!eng) return "-";
//   return (
//     eng.customer_name ||
//     eng.customer?.name ||
//     eng.customer ||
//     eng.org_name ||
//     eng.organization_name ||
//     "-"
//   );
// };

// // Probe common field names for the present branch.
// const getBranchName = (eng) => {
//   if (!eng) return "-";
//   return (
//     eng.branch_name ||
//     eng.branch?.name ||
//     eng.branch ||
//     "-"
//   );
// };

// function EngCreation() {
//   const [view, setView] = useState("list");     // "list" | "form" | "assign"

//   const [users, setUsers]     = useState([]);
//   const [sites, setSites]     = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError]     = useState("");
//   const [search, setSearch]   = useState("");

//   const [form, setForm]           = useState(EMPTY_FORM);
//   const [formError, setFormError] = useState("");
//   const [saving, setSaving]       = useState(false);
//   const isEditing = Boolean(form.id);

//   const [pendingEng, setPendingEng]     = useState(null);
//   const [selectedSite, setSelectedSite] = useState("");
//   const [assignError, setAssignError]   = useState("");
//   const [assigning, setAssigning]       = useState(false);
//   const [sitesLoading, setSitesLoading] = useState(false);

//   const [confirmDelete, setConfirmDelete] = useState(null);
//   const [deleting, setDeleting]           = useState(false);

//   // --------------------------------------------------------
//   // FETCH USERS
//   // --------------------------------------------------------
//   const fetchUsers = useCallback(async () => {
//     try {
//       setError("");
//       const res = await fetch(USERS_URL, {
//         method: "GET", cache: "no-store", headers: authHeaders(),
//       });
//       if (res.status === 401) throw new Error("401 Unauthorized. Please login again.");
//       if (!res.ok)            throw new Error(`HTTP ${res.status}`);
//       const result = await res.json();
//       setUsers(normalizeList(result));
//     } catch (err) {
//       setError(err.message || "Unable to load engineers.");
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => { fetchUsers(); }, [fetchUsers]);

//   // --------------------------------------------------------
//   // FETCH SITES
//   // --------------------------------------------------------
//   const fetchSites = useCallback(async () => {
//     setSitesLoading(true);
//     try {
//       const res = await fetch(SITES_URL, {
//         method: "GET", cache: "no-store", headers: authHeaders(),
//       });
//       if (!res.ok) throw new Error(`HTTP ${res.status}`);
//       const result = await res.json();
//       setSites(normalizeList(result));
//     } catch (err) {
//       setAssignError(err.message || "Unable to load sites.");
//     } finally {
//       setSitesLoading(false);
//     }
//   }, []);

//   // --------------------------------------------------------
//   // DERIVED — engineers only
//   // --------------------------------------------------------
//   const engineers = useMemo(
//     () => users.filter((u) => u.role === "ENGINEER"),
//     [users]
//   );

//   const filtered = useMemo(() => {
//     const q = search.trim().toLowerCase();
//     if (!q) return engineers;
//     return engineers.filter((u) =>
//       [u.name, u.email, u.phone, u.scope_name]
//         .filter(Boolean)
//         .some((f) => String(f).toLowerCase().includes(q))
//     );
//   }, [engineers, search]);

//   // --------------------------------------------------------
//   // NAVIGATION
//   // --------------------------------------------------------
//   const goToCreate = () => {
//     setForm(EMPTY_FORM);
//     setFormError("");
//     setView("form");
//   };

//   const openEditPanel = (eng) => {
//     setForm({
//       id:       eng.id,
//       name:     eng.name || "",
//       email:    eng.email || "",
//       phone:    eng.phone || "",
//       role:     "ENGINEER",
//       password: "",
//       is_active: eng.is_active ?? true,
//     });
//     setFormError("");
//     setView("form");
//   };

//   const backToList = () => {
//     setView("list");
//     setForm(EMPTY_FORM);
//     setFormError("");
//     setPendingEng(null);
//     setSelectedSite("");
//     setAssignError("");
//   };

//   const goToAssign = () => {
//     // Use the already selected engineer, else fall back to the first
//     // engineer in the list so the "Assign Site" step is always usable.
//     const target = pendingEng || engineers[0] || null;

//     if (!target) {
//       setError("No engineer available to assign a site. Create one first.");
//       return;
//     }

//     setPendingEng(target);
//     setSelectedSite(target.site ?? "");
//     setAssignError("");
//     setView("assign");

//     if (sites.length === 0) fetchSites();
//   };

//   // --------------------------------------------------------
//   // CREATE / UPDATE
//   // --------------------------------------------------------
//   const handleFieldChange = (field, value) =>
//     setForm((prev) => ({ ...prev, [field]: value }));

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setFormError("");

//     if (!form.name.trim())  return setFormError("Name is required.");
//     if (!form.email.trim()) return setFormError("Email is required.");
//     if (!isEditing && !form.password.trim()) return setFormError("Password is required.");

//     const payload = {
//       name:      form.name.trim(),
//       email:     form.email.trim().toLowerCase(),
//       phone:     form.phone.trim(),
//       role:      "ENGINEER",
//       // Only active immediately if editing; on create we activate after site assignment
//       is_active: isEditing ? form.is_active : false,
//     };
//     if (form.password.trim()) payload.password = form.password;

//     setSaving(true);
//     try {
//       const url    = isEditing ? `${USERS_URL}${form.id}/` : USERS_URL;
//       const method = isEditing ? "PATCH" : "POST";

//       const res = await fetch(url, {
//         method, headers: authHeaders(), body: JSON.stringify(payload),
//       });

//       if (!res.ok) {
//         const errBody = await res.json().catch(() => ({}));
//         const message =
//           typeof errBody === "object" && errBody !== null
//             ? Object.entries(errBody)
//                 .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
//                 .join(" | ")
//             : `HTTP ${res.status}`;
//         throw new Error(message || `HTTP ${res.status}`);
//       }

//       const saved = await res.json();

//       if (isEditing) {
//         await fetchUsers();
//         backToList();
//       } else {
//         fetchUsers();
//         setPendingEng(saved);
//         setSelectedSite(saved.site ?? "");
//         setAssignError("");
//         setView("assign");
//         fetchSites();
//       }
//     } catch (err) {
//       setFormError(err.message || "Could not save engineer.");
//     } finally {
//       setSaving(false);
//     }
//   };

//   // --------------------------------------------------------
//   // ASSIGN SITE
//   // --------------------------------------------------------
//   const openAssignFor = (eng) => {
//     setPendingEng(eng);
//     setSelectedSite(eng.site ?? "");
//     setAssignError("");
//     setView("assign");
//     fetchSites();
//   };

//   const handleAssignSave = async () => {
//     if (!pendingEng) return;
//     if (!selectedSite) return setAssignError("Please pick a site.");

//     setAssigning(true);
//     setAssignError("");
//     try {
//       const res = await fetch(`${USERS_URL}${pendingEng.id}/`, {
//         method: "PATCH",
//         headers: authHeaders(),
//         body: JSON.stringify({ site: selectedSite }),
//       });

//       if (!res.ok) {
//         const errBody = await res.json().catch(() => ({}));
//         const message =
//           typeof errBody === "object" && errBody !== null
//             ? Object.entries(errBody)
//                 .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
//                 .join(" | ")
//             : `HTTP ${res.status}`;
//         throw new Error(message || `HTTP ${res.status}`);
//       }

//       await fetchUsers();
//       backToList();
//     } catch (err) {
//       setAssignError(err.message || "Could not assign site.");
//     } finally {
//       setAssigning(false);
//     }
//   };

//   // --------------------------------------------------------
//   // DELETE
//   // --------------------------------------------------------
//   const handleDelete = async () => {
//     if (!confirmDelete || deleting) return;
//     setDeleting(true);
//     try {
//       const res = await fetch(`${USERS_URL}${confirmDelete.id}/`, {
//         method: "DELETE", headers: authHeaders(),
//       });
//       if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
//       setUsers((prev) => prev.filter((u) => u.id !== confirmDelete.id));
//       setConfirmDelete(null);
//     } catch (err) {
//       setError(err.message || "Could not delete engineer.");
//       setConfirmDelete(null);
//     } finally {
//       setDeleting(false);
//     }
//   };

//   // --------------------------------------------------------
//   // RENDER
//   // --------------------------------------------------------
//   return (
//     <div className="admins-page">

//       {/* STEPPER — clickable buttons */}
//       <ol className="admins-stepper">
//         <li className={view === "list" ? "active" : "done"}>
//           <button
//             type="button"
//             className="step-btn"
//             onClick={backToList}
//           >
//             <span className="step-num">1</span> Engineers
//           </button>
//         </li>

//         <li className={view === "form" ? "active" : view === "assign" ? "done" : ""}>
//           <button
//             type="button"
//             className="step-btn"
//             onClick={goToCreate}
//           >
//             <span className="step-num">2</span> {isEditing ? "Edit" : "Create"}
//           </button>
//         </li>

//         <li className={view === "assign" ? "active" : ""}>
//           <button
//             type="button"
//             className="step-btn"
//             onClick={goToAssign}
//             disabled={engineers.length === 0 && !pendingEng}
//           >
//             <span className="step-num">3</span> Assign Site
//           </button>
//         </li>
//       </ol>

//       {/* ================= STEP 1 — LIST ================= */}
//       {view === "list" && (
//         <>
//           <div className="admins-header">
//             <div>
//               <h1>Engineers</h1>
//               <p>Manage engineers under your branches</p>
//             </div>
//             <button className="btn-primary" onClick={goToCreate}>
//               <FiPlus /> Add Engineer
//             </button>
//           </div>

//           <div className="admins-toolbar">
//             <input
//               type="text"
//               className="admins-search"
//               placeholder="Search by name, email, phone or site..."
//               value={search}
//               onChange={(e) => setSearch(e.target.value)}
//             />
//             <span className="admins-count">
//               {filtered.length} of {engineers.length} engineers
//             </span>
//           </div>

//           {error && <div className="admins-error">{error}</div>}

//           <div className="admins-table-card">
//             {loading ? (
//               <div className="admins-loading">Loading engineers...</div>
//             ) : filtered.length === 0 ? (
//               <div className="admins-empty">
//                 {engineers.length === 0
//                   ? "No engineers yet. Click “Add Engineer” to create one."
//                   : "No engineers match your search."}
//               </div>
//             ) : (
//               <table className="admins-table">
//                 <thead>
//                   <tr>
//                     <th>Name</th>
//                     <th>Email</th>
//                     <th>Phone</th>
//                     <th>Site</th>
//                     <th>Status</th>
//                     <th className="actions-col">Actions</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {filtered.map((u) => (
//                     <tr key={u.id}>
//                       <td><strong>{u.name || "-"}</strong></td>
//                       <td>{u.email}</td>
//                       <td>{u.phone || "-"}</td>
//                       <td>{u.scope_name || "-"}</td>
//                       <td>
//                         <span className={u.is_active ? "status-active" : "status-inactive"}>
//                           ● {u.is_active ? "Active" : "Inactive"}
//                         </span>
//                       </td>
//                       <td className="actions-col">
//                         <button
//                           className="btn-icon"
//                           onClick={() => openEditPanel(u)}
//                           title="Edit"
//                           aria-label="Edit"
//                         >
//                           <FiEdit2 size={16} />
//                         </button>
//                         <button
//                           className="btn-icon"
//                           onClick={() => openAssignFor(u)}
//                           title="Assign site"
//                           aria-label="Assign site"
//                         >
//                           <FiMapPin size={16} />
//                         </button>
//                         <button
//                           className="btn-icon btn-icon-danger"
//                           onClick={() => setConfirmDelete(u)}
//                           title="Delete"
//                           aria-label="Delete"
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
//       )}

//       {/* ================= STEP 2 — CREATE / EDIT ================= */}
//       {view === "form" && (
//         <div className="admins-panel">

//           <div className="admins-panel-header">
//             {isEditing ? <FiEdit3 size={22} /> : <FiUserPlus size={22} />}
//             <div>
//               <h2>{isEditing ? "Edit Engineer" : "Create Engineer"}</h2>
//               <p>
//                 {isEditing
//                   ? `Update details for ${form.name || form.email}.`
//                   : "Add a new engineer. You'll assign a site in the next step."}
//               </p>
//             </div>
//           </div>

//           <form onSubmit={handleSubmit} className="admins-form">
//             <div className="form-grid">
//               <label>
//                 Name *
//                 <input
//                   type="text"
//                   value={form.name}
//                   onChange={(e) => handleFieldChange("name", e.target.value)}
//                   placeholder="Kiran Das"
//                   required
//                 />
//               </label>

//               <label>
//                 Email *
//                 <input
//                   type="email"
//                   value={form.email}
//                   onChange={(e) => handleFieldChange("email", e.target.value)}
//                   placeholder="kiran@acme.com"
//                   required
//                 />
//               </label>

//               <label>
//                 Phone
//                 <input
//                   type="text"
//                   value={form.phone}
//                   onChange={(e) => handleFieldChange("phone", e.target.value)}
//                   placeholder="+91 98765 43210"
//                 />
//               </label>

//               <label>
//                 {isEditing ? "Password (leave blank to keep current)" : "Password *"}
//                 <input
//                   type="password"
//                   value={form.password}
//                   onChange={(e) => handleFieldChange("password", e.target.value)}
//                   placeholder={isEditing ? "••••••••" : "Set a password"}
//                   required={!isEditing}
//                 />
//               </label>

//               {isEditing && (
//                 <label className="checkbox-row">
//                   <input
//                     type="checkbox"
//                     checked={form.is_active}
//                     onChange={(e) => handleFieldChange("is_active", e.target.checked)}
//                   />
//                   Active
//                 </label>
//               )}
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
//               <button type="submit" className="btn-primary" disabled={saving}>
//                 {saving
//                   ? "Saving..."
//                   : isEditing
//                     ? "Save Changes"
//                     : "Create & Continue"}
//               </button>
//             </div>
//           </form>
//         </div>
//       )}

//       {/* ================= STEP 3 — ASSIGN SITE ================= */}
//       {view === "assign" && pendingEng && (
//         <div className="admins-panel">
//           <button className="btn-back" onClick={backToList}>
//             <FiArrowLeft /> Back to list
//           </button>

//           <div className="admins-panel-header">
//             <FiMapPin size={22} />
//             <div>
//               <h2>Assign Site</h2>
//               <p>
//                 Assign a site to{" "}
//                 <strong>{pendingEng.name || pendingEng.email}</strong>
//               </p>
//             </div>
//           </div>

//           <div className="assign-card">
//             <div className="assign-row">
//               <span className="assign-label">Engineer</span>
//               <span className="assign-value">{pendingEng.name || "-"}</span>
//             </div>

//             {/* Present customer for whom we are assigning */}
//             <div className="assign-row">
//               <span className="assign-label">Customer</span>
//               <span className="assign-value">
//                 {getCustomerName(pendingEng)}
//               </span>
//             </div>

//             {/* Branch the engineer belongs to */}
//             <div className="assign-row">
//               <span className="assign-label">Branch</span>
//               <span className="assign-value">
//                 {getBranchName(pendingEng)}
//               </span>
//             </div>

//             <div className="assign-row">
//               <span className="assign-label">Email</span>
//               <span className="assign-value">{pendingEng.email}</span>
//             </div>

//             <div className="assign-row">
//               <span className="assign-label">Role</span>
//               <span className="assign-value">Engineer</span>
//             </div>

//             <label className="assign-select">
//               Site *
//               {sitesLoading ? (
//                 <span className="assign-loading">Loading sites...</span>
//               ) : sites.length === 0 ? (
//                 <span className="assign-loading">No sites available.</span>
//               ) : (
//                 <select
//                   value={selectedSite}
//                   onChange={(e) => setSelectedSite(e.target.value)}
//                 >
//                   <option value="">— Select a site —</option>
//                   {sites.map((s) => (
//                     <option key={s.id} value={s.id}>
//                       {s.name || s.code}{s.branch_name ? ` — ${s.branch_name}` : ""}
//                     </option>
//                   ))}
//                 </select>
//               )}
//             </label>
//           </div>

//           {assignError && <div className="form-error">{assignError}</div>}

//           <div className="panel-actions">
//             <button
//               type="button"
//               className="btn-secondary"
//               onClick={backToList}
//               disabled={assigning}
//             >
//               Skip & Return to List
//             </button>
//             <button
//               type="button"
//               className="btn-primary"
//               onClick={handleAssignSave}
//               disabled={assigning || !selectedSite}
//             >
//               <FiCheckCircle /> {assigning ? "Saving..." : "Save & Return to List"}
//             </button>
//           </div>
//         </div>
//       )}

//       {/* ================= DELETE CONFIRMATION ================= */}
//       {confirmDelete && (
//         <div
//           className="admins-modal-overlay"
//           onClick={() => !deleting && setConfirmDelete(null)}
//         >
//           <div
//             className="admins-modal admins-modal-small"
//             onClick={(e) => e.stopPropagation()}
//           >
//             <h2>Delete Engineer</h2>
//             <p>
//               Are you sure you want to delete{" "}
//               <strong>{confirmDelete.name || confirmDelete.email}</strong>?
//               This cannot be undone.
//             </p>
//             <div className="panel-actions">
//               <button
//                 className="btn-secondary"
//                 onClick={() => setConfirmDelete(null)}
//                 disabled={deleting}
//               >
//                 Cancel
//               </button>
//               <button
//                 className="btn-danger-solid"
//                 onClick={handleDelete}
//                 disabled={deleting}
//               >
//                 {deleting ? "Deleting..." : "Delete"}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// export default EngCreation;




import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiTrash2, FiPlus, FiArrowLeft, FiMapPin, FiCheckCircle,
  FiUserPlus, FiEdit2, FiEdit3,
} from "react-icons/fi";
import "./AdminCreation.css";
import { useAuth } from "../Layout/AuthContext";

const API_BASE  = "http://localhost:8000/api";
const USERS_URL = `${API_BASE}/admins/`;
const SITES_URL = `${API_BASE}/sites/`;
const CUSTOMERS_URL = `${API_BASE}/customers/`;

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

const EMPTY_FORM = {
  id:        null,
  customer:  "",          // super admin only: picked before the admin
  parent:    "",          // selected admin id
  name:      "",
  email:     "",
  phone:     "",
  role:      "ENGINEER",
  password:  "",
  is_active: true,
};

// Engineers are created under a Branch Admin of a customer.
// (There is no "customer admin" — the customer is the main user.)
const ADMIN_ROLES = ["BR_ADMIN"];

const ROLE_LABEL = {
  ORG_SUPER_ADMIN: "Org Super Admin",
  CUSTOMER:      "Customer",
  BR_ADMIN:        "Branch Admin",
  ENGINEER:        "Engineer",
};

function normalizeList(result) {
  if (Array.isArray(result))                   return result;
  if (result && Array.isArray(result.data))    return result.data;
  if (result && Array.isArray(result.results)) return result.results;
  return [];
}

const getCustomerName = (eng) => {
  if (!eng) return "-";
  return (
    eng.customer_name ||
    eng.customer?.name ||
    eng.customer ||
    eng.org_name ||
    eng.organization_name ||
    "-"
  );
};

const idOf = (v) => {
  if (v === null || v === undefined || v === "") return "";
  return String(typeof v === "object" ? v.id ?? "" : v);
};

const getBranchName = (eng) => {
  if (!eng) return "-";
  return eng.branch_name || eng.branch?.name || eng.branch || "-";
};

// Try to read the parent admin id off an engineer (for edit mode).
const getParentId = (eng) => {
  if (!eng) return "";
  const raw =
    eng.parent ??
    eng.parent_id ??
    eng.admin ??
    eng.admin_id ??
    eng.created_by ??
    eng.created_by_id;
  if (raw == null) return "";
  if (typeof raw === "object") return raw.id ?? "";
  return String(raw);
};

function EngCreation() {
  // Logged-in user comes from the auth context. For a CUSTOMER login,
  // `scopeId` is the customer id and `scopeName` the company name.
  const { user: currentUser } = useAuth();
  const isCustomerUser      = currentUser?.role === "CUSTOMER";
  const currentCustomerId   = isCustomerUser ? String(currentUser.scopeId ?? "") : "";
  const currentCustomerName = isCustomerUser
    ? currentUser.scopeName || `Customer #${currentCustomerId}`
    : "";

  const [view, setView] = useState("list");     // "list" | "form" | "assign"

  const [users, setUsers]         = useState([]);
  const [customers, setCustomers] = useState([]);   // super admin only
  const [sites, setSites]         = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [search, setSearch]   = useState("");

  const [form, setForm]           = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving]       = useState(false);
  const isEditing = Boolean(form.id);

  const [pendingEng, setPendingEng]     = useState(null);
  const [selectedSite, setSelectedSite] = useState("");
  const [assignError, setAssignError]   = useState("");
  const [assigning, setAssigning]       = useState(false);
  const [sitesLoading, setSitesLoading] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting]           = useState(false);

  // --------------------------------------------------------
  // FETCH USERS
  // --------------------------------------------------------
  const fetchUsers = useCallback(async () => {
    try {
      setError("");
      const res = await fetch(USERS_URL, {
        method: "GET", cache: "no-store", headers: authHeaders(),
      });
      if (res.status === 401) throw new Error("401 Unauthorized. Please login again.");
      if (!res.ok)            throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      setUsers(normalizeList(result));
    } catch (err) {
      setError(err.message || "Unable to load engineers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // --------------------------------------------------------
  // FETCH CUSTOMERS (super admin only — a customer login only
  // ever works inside its own customer)
  // --------------------------------------------------------
  useEffect(() => {
    if (isCustomerUser) return;
    (async () => {
      try {
        const res = await fetch(CUSTOMERS_URL, {
          method: "GET", cache: "no-store", headers: authHeaders(),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setCustomers(normalizeList(await res.json()));
      } catch (err) {
        setError(err.message || "Unable to load customers.");
      }
    })();
  }, [isCustomerUser]);

  // --------------------------------------------------------
  // FETCH SITES — only the sites of the engineer's customer,
  // narrowed to the admin's branch when the admin has one.
  // --------------------------------------------------------
  const fetchSites = useCallback(async (eng) => {
    setSitesLoading(true);
    try {
      const qs = new URLSearchParams();
      const custId   = isCustomerUser ? currentCustomerId : idOf(eng?.customer);
      const branchId = idOf(eng?.branch);
      if (custId)   qs.set("customer", custId);
      if (branchId) qs.set("branch", branchId);

      const url = qs.toString() ? `${SITES_URL}?${qs}` : SITES_URL;
      const res = await fetch(url, {
        method: "GET", cache: "no-store", headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      setSites(normalizeList(result));
    } catch (err) {
      setAssignError(err.message || "Unable to load sites.");
    } finally {
      setSitesLoading(false);
    }
  }, [isCustomerUser, currentCustomerId]);

  // --------------------------------------------------------
  // DERIVED
  // --------------------------------------------------------
  const engineers = useMemo(
    () => users.filter((u) => u.role === "ENGINEER"),
    [users]
  );

  // Admins the engineer can be placed under.
  //  - customer login : the Branch Admins of that customer
  //  - super admin    : the Branch Admins of the customer picked in the form
  const admins = useMemo(() => {
    const all = users.filter((u) => ADMIN_ROLES.includes(u.role));
    const custId = isCustomerUser ? currentCustomerId : form.customer;
    if (!custId) return isCustomerUser ? all : [];
    return all.filter((u) => idOf(u.customer) === String(custId));
  }, [users, isCustomerUser, currentCustomerId, form.customer]);

  const customerLabel = (eng) => {
    const id = idOf(eng?.customer);
    if (isCustomerUser && (!id || id === currentCustomerId)) return currentCustomerName;
    const found = customers.find((c) => String(c.id) === id);
    return found ? found.company || found.name || id : id || "-";
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return engineers;
    return engineers.filter((u) =>
      [u.name, u.email, u.phone, u.scope_name]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q))
    );
  }, [engineers, search]);

  // --------------------------------------------------------
  // NAVIGATION
  // --------------------------------------------------------
  const goToCreate = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setView("form");
  };

  const openEditPanel = (eng) => {
    setForm({
      id:        eng.id,
      customer:  idOf(eng.customer),
      parent:    getParentId(eng),
      name:      eng.name || "",
      email:     eng.email || "",
      phone:     eng.phone || "",
      role:      "ENGINEER",
      password:  "",
      is_active: eng.is_active ?? true,
    });
    setFormError("");
    setView("form");
  };

  const backToList = () => {
    setView("list");
    setForm(EMPTY_FORM);
    setFormError("");
    setPendingEng(null);
    setSelectedSite("");
    setAssignError("");
  };

  const goToAssign = () => {
    const target = pendingEng || engineers[0] || null;

    if (!target) {
      setError("No engineer available to assign a site. Create one first.");
      return;
    }

    setPendingEng(target);
    setSelectedSite(target.site ?? "");
    setAssignError("");
    setView("assign");
    fetchSites(target);
  };

  // --------------------------------------------------------
  // CREATE / UPDATE
  // --------------------------------------------------------
  const handleFieldChange = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    // Super admin picks the customer first; a customer login never does.
    if (!isEditing && !isCustomerUser && !form.customer) {
      return setFormError("Please select a customer first.");
    }
    if (!isEditing && !form.parent) {
      return setFormError("Please select the admin this engineer belongs to.");
    }
    if (!form.name.trim())  return setFormError("Name is required.");
    if (!form.email.trim()) return setFormError("Email is required.");
    if (!isEditing && !form.password.trim()) return setFormError("Password is required.");

    const payload = {
      name:      form.name.trim(),
      email:     form.email.trim().toLowerCase(),
      phone:     form.phone.trim(),
      role:      "ENGINEER",
      // Only active immediately if editing; on create we activate after site assignment
      is_active: isEditing ? form.is_active : false,
    };
    if (form.password.trim()) payload.password = form.password;

    // On create, send the admin the engineer belongs to.
    //  - customer login : the backend attaches the customer itself
    //  - super admin    : the customer chosen in the form is sent as well
    if (!isEditing) {
      payload.parent = form.parent;
      if (!isCustomerUser) payload.customer = form.customer;
    }

    setSaving(true);
    try {
      const url    = isEditing ? `${USERS_URL}${form.id}/` : USERS_URL;
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method, headers: authHeaders(), body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const message =
          typeof errBody === "object" && errBody !== null
            ? Object.entries(errBody)
                .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
                .join(" | ")
            : `HTTP ${res.status}`;
        throw new Error(message || `HTTP ${res.status}`);
      }

      const saved = await res.json();

      if (isEditing) {
        await fetchUsers();
        backToList();
      } else {
        fetchUsers();
        setPendingEng(saved);
        setSelectedSite(saved.site ?? "");
        setAssignError("");
        setView("assign");
        fetchSites(saved);
      }
    } catch (err) {
      setFormError(err.message || "Could not save engineer.");
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------------
  // ASSIGN SITE
  // --------------------------------------------------------
  const openAssignFor = (eng) => {
    setPendingEng(eng);
    setSelectedSite(eng.site ?? "");
    setAssignError("");
    setView("assign");
    fetchSites(eng);
  };

  const handleAssignSave = async () => {
    if (!pendingEng) return;
    if (!selectedSite) return setAssignError("Please pick a site.");

    setAssigning(true);
    setAssignError("");
    try {
      const res = await fetch(`${USERS_URL}${pendingEng.id}/`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ site: selectedSite }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const message =
          typeof errBody === "object" && errBody !== null
            ? Object.entries(errBody)
                .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
                .join(" | ")
            : `HTTP ${res.status}`;
        throw new Error(message || `HTTP ${res.status}`);
      }

      await fetchUsers();
      backToList();
    } catch (err) {
      setAssignError(err.message || "Could not assign site.");
    } finally {
      setAssigning(false);
    }
  };

  // --------------------------------------------------------
  // DELETE
  // --------------------------------------------------------
  const handleDelete = async () => {
    if (!confirmDelete || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`${USERS_URL}${confirmDelete.id}/`, {
        method: "DELETE", headers: authHeaders(),
      });
      if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
      setUsers((prev) => prev.filter((u) => u.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch (err) {
      setError(err.message || "Could not delete engineer.");
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  // --------------------------------------------------------
  // RENDER
  // --------------------------------------------------------
  return (
    <div className="admins-page">

      {/* STEPPER — clickable buttons */}
      <ol className="admins-stepper">
        <li className={view === "list" ? "active" : "done"}>
          <button type="button" className="step-btn" onClick={backToList}>
            <span className="step-num">1</span> Engineers
          </button>
        </li>

        <li className={view === "form" ? "active" : view === "assign" ? "done" : ""}>
          <button type="button" className="step-btn" onClick={goToCreate}>
            <span className="step-num">2</span> {isEditing ? "Edit" : "Create"}
          </button>
        </li>

        <li className={view === "assign" ? "active" : ""}>
          <button
            type="button"
            className="step-btn"
            onClick={goToAssign}
            disabled={engineers.length === 0 && !pendingEng}
          >
            <span className="step-num">3</span> Assign Site
          </button>
        </li>
      </ol>

      {/* ================= STEP 1 — LIST ================= */}
      {view === "list" && (
        <>
          <div className="admins-header">
            <div>
              <h1>Engineers</h1>
              <p>Manage engineers under your branches</p>
            </div>
          </div>

          <div className="admins-toolbar">
            <input
              type="text"
              className="admins-search"
              placeholder="Search by name, email, phone or site..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="admins-count">
              {filtered.length} of {engineers.length} engineers
            </span>
          </div>

          {error && <div className="admins-error">{error}</div>}

          <div className="admins-table-card">
            {loading ? (
              <div className="admins-loading">Loading engineers...</div>
            ) : filtered.length === 0 ? (
              <div className="admins-empty">
                {engineers.length === 0
                  ? "No engineers yet. Click “Add Engineer” to create one."
                  : "No engineers match your search."}
              </div>
            ) : (
              <table className="admins-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    {!isCustomerUser && <th>Customer</th>}
                    <th>Site</th>
                    <th>Status</th>
                    <th className="actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id}>
                      <td><strong>{u.name || "-"}</strong></td>
                      <td>{u.email}</td>
                      <td>{u.phone || "-"}</td>
                      {!isCustomerUser && <td>{customerLabel(u)}</td>}
                      <td>{u.scope_name || "-"}</td>
                      <td>
                        <span className={u.is_active ? "status-active" : "status-inactive"}>
                          ● {u.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="actions-col">
                        <button
                          className="btn-icon"
                          onClick={() => openEditPanel(u)}
                          title="Edit"
                          aria-label="Edit"
                        >
                          <FiEdit2 size={16} />
                        </button>
                        {/* <button
                          className="btn-icon"
                          onClick={() => openAssignFor(u)}
                          title="Assign site"
                          aria-label="Assign site"
                        >
                          <FiMapPin size={16} />
                        </button> */}
                        <button
                          className="btn-icon btn-icon-danger"
                          onClick={() => setConfirmDelete(u)}
                          title="Delete"
                          aria-label="Delete"
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
      )}

      {view === "form" && (
        <div className="admins-panel">

          <div className="admins-panel-header">
            {isEditing ? <FiEdit3 size={22} /> : <FiUserPlus size={22} />}
            <div>
              <h2>{isEditing ? "Edit Engineer" : "Create Engineer"}</h2>
              <p>
                {isEditing
                  ? `Update details for ${form.name || form.email}.`
                  : "Add a new engineer under an admin. You'll assign a site in the next step."}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="admins-form">
            <div className="form-grid">

              {/* Super admin: pick the customer first, then the admin under it.
                  Customer login: no customer picker — it is their own. */}
              {!isEditing && !isCustomerUser && (
                <label className="full-width">
                  Customer *
                  <select
                    value={form.customer}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        customer: e.target.value,
                        parent: "",           // admin list depends on customer
                      }))
                    }
                    required
                  >
                    <option value="">— Select a customer —</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company || c.name}
                        {c.code ? ` (${c.code})` : ""}
                      </option>
                    ))}
                  </select>
                  {customers.length === 0 && (
                    <small className="field-hint">
                      No customers available. Create a customer first.
                    </small>
                  )}
                </label>
              )}

              {!isEditing && (
                <label className="full-width">
                  Admin *
                  <select
                    value={form.parent}
                    onChange={(e) => handleFieldChange("parent", e.target.value)}
                    required
                    disabled={!isCustomerUser && !form.customer}
                  >
                    <option value="">
                      {!isCustomerUser && !form.customer
                        ? "— Select a customer first —"
                        : "— Select an admin —"}
                    </option>
                    {admins.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                        {a.email ? ` — ${a.email}` : ""}
                      </option>
                    ))}
                  </select>
                  {(isCustomerUser || form.customer) && admins.length === 0 && (
                    <small className="field-hint">
                      No admins available
                      {isCustomerUser ? "" : " for this customer"}. Create an admin first.
                    </small>
                  )}
                  {isCustomerUser && (
                    <small className="field-hint">
                      Engineer will be created under {currentCustomerName}.
                    </small>
                  )}
                </label>
              )}

              <label>
                Name *
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  placeholder="Kiran Das"
                  required
                />
              </label>

              <label>
                Email *
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleFieldChange("email", e.target.value)}
                  placeholder="kiran@acme.com"
                  required
                />
              </label>

              <label>
                Phone
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => handleFieldChange("phone", e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </label>

              <label>
                {isEditing ? "Password (leave blank to keep current)" : "Password *"}
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => handleFieldChange("password", e.target.value)}
                  placeholder={isEditing ? "••••••••" : "Set a password"}
                  required={!isEditing}
                />
              </label>

              {isEditing && (
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => handleFieldChange("is_active", e.target.checked)}
                  />
                  Active
                </label>
              )}
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
                disabled={saving || (!isEditing && admins.length === 0)}
              >
                {saving
                  ? "Saving..."
                  : isEditing
                    ? "Save Changes"
                    : "Create & Continue"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= STEP 3 — ASSIGN SITE ================= */}
      {view === "assign" && pendingEng && (
        <div className="admins-panel">
          <button className="btn-back" onClick={backToList}>
            <FiArrowLeft /> Back to list
          </button>

          <div className="admins-panel-header">
            <FiMapPin size={22} />
            <div>
              <h2>Assign Site</h2>
              <p>
                Assign a site to{" "}
                <strong>{pendingEng.name || pendingEng.email}</strong>
              </p>
            </div>
          </div>

          <div className="assign-card">
            <div className="assign-row">
              <span className="assign-label">Engineer</span>
              <span className="assign-value">{pendingEng.name || "-"}</span>
            </div>

            <div className="assign-row">
              <span className="assign-label">Customer</span>
              <span className="assign-value">
                {customerLabel(pendingEng)}
              </span>
            </div>

            <div className="assign-row">
              <span className="assign-label">Branch</span>
              <span className="assign-value">
                {getBranchName(pendingEng)}
              </span>
            </div>

            <div className="assign-row">
              <span className="assign-label">Email</span>
              <span className="assign-value">{pendingEng.email}</span>
            </div>

            <div className="assign-row">
              <span className="assign-label">Role</span>
              <span className="assign-value">Engineer</span>
            </div>

            <label className="assign-select">
              Site *
              {sitesLoading ? (
                <span className="assign-loading">Loading sites...</span>
              ) : sites.length === 0 ? (
                <span className="assign-loading">
                  No sites available for this customer{idOf(pendingEng.branch) ? " / branch" : ""}.
                </span>
              ) : (
                <select
                  value={selectedSite}
                  onChange={(e) => setSelectedSite(e.target.value)}
                >
                  <option value="">— Select a site —</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name || s.code}{s.branch_name ? ` — ${s.branch_name}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </label>
          </div>

          {assignError && <div className="form-error">{assignError}</div>}

          <div className="panel-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={backToList}
              disabled={assigning}
            >
              Skip & Return to List
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleAssignSave}
              disabled={assigning || !selectedSite}
            >
              <FiCheckCircle /> {assigning ? "Saving..." : "Save & Return to List"}
            </button>
          </div>
        </div>
      )}

      {/* ================= DELETE CONFIRMATION ================= */}
      {confirmDelete && (
        <div
          className="admins-modal-overlay"
          onClick={() => !deleting && setConfirmDelete(null)}
        >
          <div
            className="admins-modal admins-modal-small"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Delete Engineer</h2>
            <p>
              Are you sure you want to delete{" "}
              <strong>{confirmDelete.name || confirmDelete.email}</strong>?
              This cannot be undone.
            </p>
            <div className="panel-actions">
              <button
                className="btn-secondary"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn-danger-solid"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EngCreation;