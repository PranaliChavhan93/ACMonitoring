
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiTrash2,
  FiPlus,
  FiArrowLeft,
  FiCheckCircle,
  FiUserPlus,
  FiEdit3,
  FiEdit2,
  FiMapPin,
} from "react-icons/fi";

import "./CustomerCreation.css";

const API_BASE = "http://localhost:8000/api";
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


const HIERARCHY_OPTIONS = [
  {
    value: "GEOGRAPHICAL",
    label: "Geographical",
    description: "India → State → District → Taluka → City → Branch",
  },
  {
    value: "ZONAL",
    label: "Zonal",
    description: "India → Zone → Circle → Region → Division → Branch",
  },
];

const HIERARCHY_LABEL = {
  GEOGRAPHICAL: "Geographical",
  ZONAL: "Zonal",
};

const CUSTOMER_TYPES = [
  "Public Sector Bank",
  "Private Sector Bank",
];

const emptyForm = {
  id: null,
  company: "",
  code: "",
  company_email: "",
  contact_person: "",
  contact_person_email: "",
  phone: "",
  password: "",
  confirm_password: "",
  hierarchy_type: "",
  is_active: true,

  bank_short_name: "",
  bank_type: "",
  website: "",

  address_line_1: "",
  state: "",
  district: "",
  city: "",
  pincode: "",

  designation: "",
  admin_mobile: "",
};

/* =========================================================
   HELPERS
========================================================= */

function normalizeList(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.data)) return result.data;
  if (result && Array.isArray(result.results)) return result.results;
  return [];
}

const customerNameOf = (customer) =>
  customer?.company ?? customer?.bank_name ?? customer?.name ?? "";

const customerEmailOf = (customer) =>
  customer?.company_email ?? customer?.email ?? "";

/* =========================================================
   COMPONENT
========================================================= */

function CustomerCreation() {
  const [view, setView] = useState("list");
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedHierarchy, setSelectedHierarchy] = useState("");
  const [hierarchyError, setHierarchyError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState(null);
  
  const isEditing = Boolean(form.id);

  /* =========================================================
     FETCH CUSTOMERS
  ========================================================= */

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(CUSTOMERS_URL, {
        method: "GET",
        cache: "no-store",
        headers: authHeaders(),
      });

      if (res.status === 401) {
        throw new Error("401 Unauthorized. Please login again.");
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const result = await res.json();
      setCustomers(normalizeList(result));
    } catch (err) {
      setError(err.message || "Unable to load customers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  /* =========================================================
     SEARCH
  ========================================================= */

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;

    return customers.filter((customer) => {
      const fields = [
        customerNameOf(customer),
        customer.code,
        customerEmailOf(customer),
        customer.contact_person,
        customer.phone,
        customer.hierarchy_type,
        customer.bank_short_name,
        customer.bank_type,
      ];

      return fields
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q));
    });
  }, [customers, search]);

  /* =========================================================
     CREATE
  ========================================================= */

  const goToCreate = () => {
    setForm({ ...emptyForm });
    setSelectedHierarchy("");
    setFormError("");
    setHierarchyError("");
    setView("form");
  };

  /* =========================================================
     EDIT
  ========================================================= */

  const openEditPanel = (customer) => {
    const hierarchy = customer.hierarchy_type || "";

    setForm({
      ...emptyForm,
      id: customer.id,
      company: customer.company ?? customer.bank_name ?? customer.name ?? "",
      code: customer.code || "",
      company_email: customer.company_email ?? customer.email ?? "",
      contact_person: customer.contact_person || "",
      contact_person_email: customer.contact_person_email || "",
      phone: customer.phone || "",
      hierarchy_type: hierarchy,
      is_active: customer.is_active ?? true,
      bank_short_name: customer.bank_short_name || "",
      bank_type: customer.bank_type || "",
      website: customer.website || "",
      address_line_1: customer.address_line_1 || "",
      state: customer.state || "",
      district: customer.district || "",
      city: customer.city || "",
      pincode: customer.pincode || "",
      designation: customer.designation || "",
      admin_mobile: customer.admin_mobile || customer.phone || "",
      password: "",
      confirm_password: "",
    });

    setSelectedHierarchy(hierarchy);
    setFormError("");
    setHierarchyError("");
    setView("form");
  };

  /* =========================================================
     BACK
  ========================================================= */

  const backToList = () => {
    setView("list");
    setForm({ ...emptyForm });
    setSelectedHierarchy("");
    setFormError("");
    setHierarchyError("");
  };

  /* =========================================================
     FIELD CHANGE
  ========================================================= */

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  /* =========================================================
     HIERARCHY CHANGE
  ========================================================= */

  const handleHierarchyChange = (value) => {
    setSelectedHierarchy(value);
    setForm((prev) => ({ ...prev, hierarchy_type: value }));
    setHierarchyError("");
  };

  /* =========================================================
     VALIDATION
  ========================================================= */

  const validateForm = () => {
    if (!form.company.trim()) return "Customer name is required.";
    if (!form.code.trim()) return "Customer code is required.";
    if (!form.bank_short_name.trim()) return "Short name is required.";
    if (!form.bank_type) return "Customer type is required.";
    if (!form.company_email.trim()) return "Customer email is required.";
    if (!form.phone.trim()) return "Customer phone number is required.";
    if (!form.contact_person.trim()) return "Contact person name is required.";
    if (!form.contact_person_email.trim())
      return "Contact person email is required.";
    // if (!form.designation.trim()) return "Designation is required.";
    if (!form.admin_mobile.trim()) return "Contact person mobile is required.";

    if (!isEditing) {
      if (!form.password.trim()) return "Password is required.";
      if (!form.confirm_password.trim()) return "Confirm password is required.";
      if (form.password !== form.confirm_password) {
        return "Password and confirm password do not match.";
      }
    }

    if (form.password.trim() && form.password !== form.confirm_password) {
      return "Password and confirm password do not match.";
    }

    if (!selectedHierarchy) return "Please select a location hierarchy.";

    if (form.pincode && !/^\d{6}$/.test(form.pincode.trim())) {
      return "PIN code must contain exactly 6 digits.";
    }

    if (
      form.company_email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.company_email.trim())
    ) {
      return "Please enter a valid customer email.";
    }

    if (
      form.contact_person_email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_person_email.trim())
    ) {
      return "Please enter a valid contact person email.";
    }

    return "";
  };

  /* =========================================================
     CREATE / UPDATE
  ========================================================= */

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const payload = {
      company: form.company.trim(),
      code: form.code.trim(),
      company_email: form.company_email.trim(),
      contact_person: form.contact_person.trim(),
      contact_person_email: form.contact_person_email.trim(),
      phone: form.admin_mobile.trim() || form.phone.trim(),
      hierarchy_type: selectedHierarchy || form.hierarchy_type,
      is_active: form.is_active,
    };

    if (form.password.trim()) {
      payload.password = form.password.trim();
    }

    setSaving(true);

    try {
      const url = isEditing ? `${CUSTOMERS_URL}${form.id}/` : CUSTOMERS_URL;
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));

        const message =
          typeof errBody === "object" && errBody !== null
            ? Object.entries(errBody)
                .map(
                  ([key, value]) =>
                    `${key}: ${Array.isArray(value) ? value.join(", ") : value}`
                )
                .join(" | ")
            : `HTTP ${res.status}`;

        throw new Error(message || `HTTP ${res.status}`);
      }

      const saved = await res.json();

            await fetchCustomers();

      if (isEditing) {
        backToList();
        showToast("success", "Customer updated successfully.");
        return;
      }

      setForm((prev) => ({ ...prev, id: saved.id }));
      setFormError("");
      setView("hierarchy");
      showToast("success", "Customer created successfully.");
    } catch (err) {
      const msg = err.message || "Could not save customer.";
      setFormError(msg);
      showToast("error", msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete || deleting) return;

    const name =
      customerNameOf(confirmDelete) || confirmDelete.code || "Customer";

    setDeleting(true);

    try {
      const res = await fetch(`${CUSTOMERS_URL}${confirmDelete.id}/`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (!res.ok && res.status !== 204) {
        throw new Error(`HTTP ${res.status}`);
      }

      setCustomers((prev) =>
        prev.filter((customer) => customer.id !== confirmDelete.id)
      );
      setConfirmDelete(null);
      showToast("success", `${name} deleted successfully.`);
    } catch (err) {
      const msg = err.message || "Could not delete customer.";
      setError(msg);
      setConfirmDelete(null);
      showToast("error", msg);
    } finally {
      setDeleting(false);
    }
  };

  const hierarchyName = HIERARCHY_LABEL[selectedHierarchy] || "-";

  const showToast = useCallback((type, message) => {
    setToast({ type, message, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div className="admins-page">
      {/* STEPPER */}
      <ol className="admins-stepper">
        <li className={view === "list" ? "active" : "done"}>
          <button type="button" className="step-btn" onClick={backToList}>
            <span className="step-num">1</span>
            Customers
          </button>
        </li>

        <li
          className={
            view === "form" ? "active" : view === "hierarchy" ? "done" : ""
          }
        >
          <button type="button" className="step-btn" onClick={goToCreate}>
            <span className="step-num">2</span>
            {isEditing ? "Edit" : "Create"}
          </button>
        </li>

        <li className={view === "hierarchy" ? "active" : ""}>
          <button
            type="button"
            className="step-btn"
            disabled={!selectedHierarchy}
            onClick={() => {
              if (selectedHierarchy) {
                setView("hierarchy");
              }
            }}
          >
            <span className="step-num">3</span>
            Hierarchy
          </button>
        </li>
      </ol>

      {view === "list" && (
        <>
          <div className="admins-header">
            <div>
              <h1>Customers</h1>
              <p>Register and manage customers under your organization.</p>
            </div>

            {/* <button className="btn-primary" onClick={goToCreate}>
              <FiPlus />
              Create Customer
            </button> */}
          </div>

          <div className="admins-toolbar">
            <input
              type="text"
              className="admins-search"
              placeholder="Search by customer name, code, email, phone or hierarchy..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <span className="admins-count">
              {filteredCustomers.length} of {customers.length} customers
            </span>
          </div>

          {error && <div className="admins-error">{error}</div>}

          <div className="admins-table-card">
            {loading ? (
              <div className="admins-loading">Loading Customers...</div>
            ) : filteredCustomers.length === 0 ? (
              <div className="admins-empty">
                {customers.length === 0
                  ? "No customers registered yet. Click “Create Customer” to create one."
                  : "No customers match your search."}
              </div>
            ) : (
              <table className="admins-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Code</th>
                    <th>Type</th>
                    <th>Email</th>
                    <th>Contact</th>
                    <th>Phone</th>
                    <th>Hierarchy</th>
                    <th>Status</th>
                    <th className="actions-col">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <strong>{customerNameOf(customer)}</strong>
                        {customer.bank_short_name && (
                          <small
                            style={{
                              display: "block",
                              color: "#6b7280",
                              marginTop: "3px",
                            }}
                          >
                            {customer.bank_short_name}
                          </small>
                        )}
                      </td>

                      <td>{customer.code || "-"}</td>
                      <td>{customer.bank_type || "-"}</td>
                      <td>{customerEmailOf(customer) || "-"}</td>
                      <td>{customer.contact_person || "-"}</td>
                      <td>{customer.phone || "-"}</td>

                      <td>
                        {customer.hierarchy_type
                          ? HIERARCHY_LABEL[customer.hierarchy_type]
                          : "-"}
                      </td>

                      <td>
                        <span
                          className={
                            customer.is_active
                              ? "status-active"
                              : "status-inactive"
                          }
                        >
                          ● {customer.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td className="actions-col">
                        <button
                          className="btn-icon"
                          onClick={() => openEditPanel(customer)}
                          title="Edit"
                          aria-label="Edit"
                        >
                          <FiEdit2 size={16} />
                        </button>

                        <button
                          className="btn-icon btn-icon-danger"
                          onClick={() => setConfirmDelete(customer)}
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
              <h2>{isEditing ? "Edit Customer" : "Register New Customer"}</h2>

              <p>
                {isEditing
                  ? `Update details for ${form.company || form.code}.`
                  : "Register a new customer and configure their portal access and location hierarchy."}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="admins-form">
            <div className="assign-card">
              <div className="assign-row">
                <span className="assign-label">Customer Information</span>
              </div>

              <div className="form-grid" style={{ marginTop: "16px" }}>
                <label>
                  Name *
                  <input
                    type="text"
                    value={form.company}
                    onChange={(e) => handleFieldChange("company", e.target.value)}
                    placeholder="HDFC Bank"
                    required
                  />
                </label>

                <label>
                  Code *
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) =>
                      handleFieldChange("code", e.target.value.toUpperCase())
                    }
                    placeholder="HDFC001"
                    required
                  />
                </label>

                <label>
                  Short Name *
                  <input
                    type="text"
                    value={form.bank_short_name}
                    onChange={(e) =>
                      handleFieldChange(
                        "bank_short_name",
                        e.target.value.toUpperCase()
                      )
                    }
                    placeholder="HDFC"
                    required
                  />
                </label>

                <label>
                  Type *
                  <select
                    value={form.bank_type}
                    onChange={(e) =>
                      handleFieldChange("bank_type", e.target.value)
                    }
                    required
                  >
                    <option value="">Select Customer Type</option>

                    {CUSTOMER_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Email *
                  <input
                    type="email"
                    value={form.company_email}
                    onChange={(e) =>
                      handleFieldChange("company_email", e.target.value)
                    }
                    placeholder="admin@bank.com"
                    required
                  />
                </label>

                <label>
                  Phone *
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => handleFieldChange("phone", e.target.value)}
                    placeholder="+91 22 XXXXXXXX"
                    required
                  />
                </label>

                <label>
                  Website
                  <input
                    type="url"
                    value={form.website}
                    onChange={(e) => handleFieldChange("website", e.target.value)}
                    placeholder="https://www.bank.com"
                  />
                </label>
              </div>
            </div>

            <div className="assign-card" style={{ marginTop: "20px" }}>
              <div className="assign-row">
                <span className="assign-label">Head Office Details</span>
              </div>

              <div className="form-grid" style={{ marginTop: "16px" }}>
                <label style={{ gridColumn: "1 / -1" }}>
                  Address Line 1 *
                  <input
                    type="text"
                    value={form.address_line_1}
                    onChange={(e) =>
                      handleFieldChange("address_line_1", e.target.value)
                    }
                    placeholder="Building / Street / Area"
                  />
                </label>

                <label>
                  State
                  <input
                    type="text"
                    value={form.state}
                    onChange={(e) => handleFieldChange("state", e.target.value)}
                    placeholder="Maharashtra"
                  />
                </label>

                <label>
                  District
                  <input
                    type="text"
                    value={form.district}
                    onChange={(e) => handleFieldChange("district", e.target.value)}
                    placeholder="Pune"
                  />
                </label>

                <label>
                  City
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => handleFieldChange("city", e.target.value)}
                    placeholder="Pune"
                  />
                </label>

                <label>
                  PIN Code
                  <input
                    type="text"
                    maxLength={6}
                    value={form.pincode}
                    onChange={(e) =>
                      handleFieldChange(
                        "pincode",
                        e.target.value.replace(/\D/g, "")
                      )
                    }
                    placeholder="411001"
                  />
                </label>
              </div>
            </div>

            <div className="assign-card" style={{ marginTop: "20px" }}>
              <div className="assign-row">
                <span className="assign-label">Contact Person Details</span>
              </div>

              <div className="form-grid" style={{ marginTop: "16px" }}>
                <label>
                  Name *
                  <input
                    type="text"
                    value={form.contact_person}
                    onChange={(e) =>
                      handleFieldChange("contact_person", e.target.value)
                    }
                    placeholder="Rahul Sharma"
                    required
                  />
                </label>

                {/* <label>
                  Designation *
                  <input
                    type="text"
                    value={form.designation}
                    onChange={(e) =>
                      handleFieldChange("designation", e.target.value)
                    }
                    placeholder="IT Manager"
                    required
                  />
                </label> */}

                <label>
                  Email *
                  <input
                    type="email"
                    value={form.contact_person_email}
                    onChange={(e) =>
                      handleFieldChange("contact_person_email", e.target.value)
                    }
                    placeholder="admin@bank.com"
                    required
                  />
                  <small className="field-hint">
                    This email will be used for portal login.
                  </small>
                </label>

                <label>
                  Mobile *
                  <input
                    type="tel"
                    value={form.admin_mobile}
                    onChange={(e) =>
                      handleFieldChange("admin_mobile", e.target.value)
                    }
                    placeholder="+91 98765 43210"
                    required
                  />
                </label>

                <label>
                  {isEditing
                    ? "Login Password (leave blank to keep current)"
                    : "Login Password *"}
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) =>
                      handleFieldChange("password", e.target.value)
                    }
                    placeholder={isEditing ? "••••••••" : "Set a password"}
                    required={!isEditing}
                    autoComplete="new-password"
                  />
                </label>

                <label>
                  {isEditing ? "Confirm New Password" : "Confirm Password *"}
                  <input
                    type="password"
                    value={form.confirm_password}
                    onChange={(e) =>
                      handleFieldChange("confirm_password", e.target.value)
                    }
                    placeholder="Confirm password"
                    required={!isEditing || Boolean(form.password)}
                    autoComplete="new-password"
                  />
                </label>
              </div>
            </div>

            <div className="assign-card" style={{ marginTop: "20px" }}>
              <div className="assign-row">
                <span className="assign-label">Location Hierarchy *</span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "16px",
                  marginTop: "16px",
                }}
              >
                {HIERARCHY_OPTIONS.map((option) => {
                  const selected = selectedHierarchy === option.value;

                  return (
                    <label
                      key={option.value}
                      style={{
                        border: selected
                          ? "2px solid #2563eb"
                          : "1px solid #d1d5db",
                        borderRadius: "10px",
                        padding: "18px",
                        cursor: isEditing ? "default" : "pointer",
                        background: selected ? "#eff6ff" : "#ffffff",
                        display: "block",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: "12px",
                          alignItems: "flex-start",
                        }}
                      >
                        <input
                          type="radio"
                          name="hierarchy_type"
                          value={option.value}
                          checked={selected}
                          disabled={isEditing}
                          onChange={(e) => handleHierarchyChange(e.target.value)}
                        />

                        <div>
                          <div
                            style={{
                              fontWeight: "600",
                              fontSize: "16px",
                              marginBottom: "6px",
                            }}
                          >
                            {option.label}
                          </div>

                          <div
                            style={{
                              fontSize: "13px",
                              color: "#6b7280",
                              lineHeight: "1.5",
                            }}
                          >
                            {option.description}
                          </div>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              {isEditing && form.hierarchy_type && (
                <p
                  style={{
                    marginTop: "12px",
                    fontSize: "13px",
                    color: "#6b7280",
                  }}
                >
                  Hierarchy cannot be changed from the edit screen.
                </p>
              )}
            </div>

            <div style={{ marginTop: "20px" }}>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    handleFieldChange("is_active", e.target.checked)
                  }
                />
                Active
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
                disabled={saving || !selectedHierarchy}
              >
                {saving
                  ? "Saving..."
                  : isEditing
                  ? "Save Changes"
                  : "Register & Continue"}
              </button>
            </div>
          </form>
        </div>
      )}

      {view === "hierarchy" && (
        <div className="admins-panel">
          <button className="btn-back" onClick={() => setView("form")}>
            <FiArrowLeft />
            Back to customer
          </button>

          <div className="admins-panel-header" style={{ marginTop: "20px" }}>
            <FiMapPin size={22} />

            <div>
              <h2>Configure Hierarchy</h2>

              <p>
                Configure the location structure for{" "}
                <strong>{form.company}</strong>
              </p>
            </div>
          </div>

          <div className="assign-card">
            <div className="assign-row">
              <span className="assign-label">Customer</span>
              <span className="assign-value">{form.company || "-"}</span>
            </div>

            <div className="assign-row">
              <span className="assign-label">Code</span>
              <span className="assign-value">{form.code || "-"}</span>
            </div>

            <div className="assign-row">
              <span className="assign-label">Type</span>
              <span className="assign-value">{form.bank_type || "-"}</span>
            </div>

            <div className="assign-row">
              <span className="assign-label">Hierarchy</span>
              <span className="assign-value">{hierarchyName}</span>
            </div>
          </div>

          {selectedHierarchy === "GEOGRAPHICAL" && (
            <div className="assign-card" style={{ marginTop: "20px" }}>
              <h3 style={{ marginTop: 0 }}>Geographical Hierarchy</h3>

              <div
                style={{
                  marginTop: "20px",
                  padding: "20px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "10px",
                  background: "#f9fafb",
                }}
              >
                <div style={{ fontWeight: "600", marginBottom: "12px" }}>
                  India
                </div>

                <div style={{ color: "#6b7280", lineHeight: "2" }}>
                  India → State → District → Taluka → City → Branch
                </div>

                <div
                  style={{
                    marginTop: "16px",
                    paddingTop: "16px",
                    borderTop: "1px solid #e5e7eb",
                  }}
                >
                  <strong>Branch can contain:</strong>

                  <ul style={{ marginTop: "8px", color: "#6b7280" }}>
                    <li>Multiple Floors</li>
                    <li>Direct AC units</li>
                    <li>Both Floors and Direct AC units</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {selectedHierarchy === "ZONAL" && (
            <div className="assign-card" style={{ marginTop: "20px" }}>
              <h3 style={{ marginTop: 0 }}>Zonal Hierarchy</h3>

              <div
                style={{
                  marginTop: "20px",
                  padding: "20px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "10px",
                  background: "#f9fafb",
                }}
              >
                <div style={{ fontWeight: "600", marginBottom: "12px" }}>
                  India
                </div>

                <div style={{ color: "#6b7280", lineHeight: "2" }}>
                  India → Zone → Circle → Region → Division → Branch
                </div>

                <div
                  style={{
                    marginTop: "16px",
                    paddingTop: "16px",
                    borderTop: "1px solid #e5e7eb",
                  }}
                >
                  <strong>Branch can contain:</strong>

                  <ul style={{ marginTop: "8px", color: "#6b7280" }}>
                    <li>Multiple Floors</li>
                    <li>Direct AC units</li>
                    <li>Both Floors and Direct AC units</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {hierarchyError && <div className="form-error">{hierarchyError}</div>}

          <div className="panel-actions">
            <button type="button" className="btn-secondary" onClick={backToList}>
              Return to Customers
            </button>

            <button type="button" className="btn-primary" onClick={backToList}>
              <FiCheckCircle />
              Finish
            </button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          className="admins-modal-overlay"
          onClick={() => !deleting && setConfirmDelete(null)}
        >
          <div
            className="admins-modal admins-modal-small"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Delete Customer</h2>

            <p>
              Are you sure you want to delete{" "}
              <strong>{customerNameOf(confirmDelete)}</strong>?
              <br />
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
}

export default CustomerCreation;