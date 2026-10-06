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

const emptyForm = {
  id: null,
  company: "",
  code: "",
  company_email: "",
  contact_person: "",
  contact_person_email: "",
  phone: "",
  hierarchy_type: "",
  password: "",          // login password for the customer (main user)
  is_active: true,
};

function normalizeList(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.data)) return result.data;
  if (result && Array.isArray(result.results)) return result.results;
  return [];
}

const companyOf = (customer) => customer?.company ?? customer?.name ?? "";

const emailOf = (customer) => customer?.company_email ?? customer?.email ?? "";

const CUSTOMER_ROLE_VALUES = new Set(["CUSTOMER", "customer", "Customer"]);

const isCustomerRole = (row) => {
  if (!row) return false;

  if (typeof row.role === "string" && row.role.trim() !== "") {
    return CUSTOMER_ROLE_VALUES.has(row.role.trim());
  }

  return Boolean(row.login_email);
};

function Customer_Creation() {
  const [view, setView] = useState("list");
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const isEditing = Boolean(form.id);

  const [selectedHierarchy, setSelectedHierarchy] = useState("");
  const [hierarchyError, setHierarchyError] = useState("");

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCustomers = useCallback(async () => {
    try {
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
    const customerRows = customers.filter(isCustomerRole);

    const q = search.trim().toLowerCase();
    if (!q) return customerRows;

    return customerRows.filter((customer) =>
      [
        companyOf(customer),
        customer.code,
        emailOf(customer),
        customer.contact_person,
        customer.phone,
        customer.hierarchy_type,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [customers, search]);

  /* =========================================================
     CREATE
  ========================================================= */

  const goToCreate = () => {
    setForm(emptyForm);
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
      id: customer.id,
      company: companyOf(customer),
      code: customer.code || "",
      company_email: emailOf(customer),
      contact_person: customer.contact_person || "",
      contact_person_email: customer.contact_person_email || "",
      phone: customer.phone || "",
      hierarchy_type: hierarchy,
      password: "",
      is_active: customer.is_active ?? true,
    });

    setSelectedHierarchy(hierarchy);
    setFormError("");
    setHierarchyError("");
    setView("form");
  };

  /* =========================================================
     BACK TO LIST
  ========================================================= */

  const backToList = () => {
    setView("list");
    setForm(emptyForm);
    setSelectedHierarchy("");
    setFormError("");
    setHierarchyError("");
  };

  /* =========================================================
     FIELD CHANGE
  ========================================================= */

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  /* =========================================================
     HIERARCHY CHANGE
  ========================================================= */

  const handleHierarchyChange = (value) => {
    setSelectedHierarchy(value);

    setForm((prev) => ({
      ...prev,
      hierarchy_type: value,
    }));

    setHierarchyError("");
  };

  /* =========================================================
     CREATE / UPDATE CUSTOMER
  ========================================================= */

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    /* ---------------- Validation ---------------- */

    if (!form.company.trim()) {
      setFormError("Company name is required.");
      return;
    }

    if (!form.code.trim()) {
      setFormError("Customer code is required.");
      return;
    }

    if (!isEditing && !selectedHierarchy) {
      setFormError(
        "Please select a hierarchy: Geographical or Zonal."
      );
      return;
    }

    // The customer is the main user of the product, so the login is created
    // together with the customer (contact person email, else company email).
    if (
      !isEditing &&
      !form.contact_person_email.trim() &&
      !form.company_email.trim()
    ) {
      setFormError(
        "Enter a Contact Person Email (or Company Email) — it is the customer's login."
      );
      return;
    }

    if (!isEditing && !form.password.trim()) {
      setFormError("Password is required for the customer's login.");
      return;
    }

    /* ---------------- Payload ---------------- */

    const payload = {
      company: form.company.trim(),
      code: form.code.trim(),
      company_email: form.company_email.trim(),
      contact_person: form.contact_person.trim(),
      contact_person_email: form.contact_person_email.trim(),
      phone: form.phone.trim(),
      hierarchy_type: selectedHierarchy || form.hierarchy_type,
      is_active: form.is_active,
    };

    if (form.password.trim()) payload.password = form.password;

    setSaving(true);

    try {
      const url = isEditing
        ? `${CUSTOMERS_URL}${form.id}/`
        : CUSTOMERS_URL;

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
                    `${key}: ${
                      Array.isArray(value) ? value.join(", ") : value
                    }`
                )
                .join(" | ")
            : `HTTP ${res.status}`;

        throw new Error(message || `HTTP ${res.status}`);
      }

      const saved = await res.json();

      await fetchCustomers();

      /* Editing does not need to go through hierarchy creation again. */
      if (isEditing) {
        backToList();
        return;
      }

      /* Customer created — move to hierarchy step. */
      setForm((prev) => ({
        ...prev,
        id: saved.id,
      }));

      setFormError("");
      setView("hierarchy");
    } catch (err) {
      setFormError(err.message || "Could not save customer.");
    } finally {
      setSaving(false);
    }
  };

  /* =========================================================
     CONTINUE TO HIERARCHY
  ========================================================= */

  const continueHierarchy = () => {
    if (!selectedHierarchy) {
      setHierarchyError("Please select a hierarchy.");
      return;
    }

    setHierarchyError("");
    setView("hierarchy");
  };

  /* =========================================================
     DELETE
  ========================================================= */

  const handleDelete = async () => {
    if (!confirmDelete || deleting) return;

    setDeleting(true);

    try {
      const res = await fetch(
        `${CUSTOMERS_URL}${confirmDelete.id}/`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      if (!res.ok && res.status !== 204) {
        throw new Error(`HTTP ${res.status}`);
      }

      setCustomers((prev) =>
        prev.filter(
          (customer) => customer.id !== confirmDelete.id
        )
      );

      setConfirmDelete(null);
    } catch (err) {
      setError(err.message || "Could not delete customer.");
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  /* =========================================================
     HIERARCHY NAME
  ========================================================= */

  const hierarchyName =
    HIERARCHY_LABEL[selectedHierarchy] || "-";

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="admins-page">
      <ol className="admins-stepper">
        <li className={view === "list" ? "active" : "done"}>
          <button
            type="button"
            className="step-btn"
            onClick={backToList}
          >
            <span className="step-num">1</span>
            Customers
          </button>
        </li>
        <li
          className={
            view === "form"
              ? "active"
              : view === "hierarchy"
              ? "done"
              : ""
          }
        >
          <button
            type="button"
            className="step-btn"
            onClick={goToCreate}
          >
            <span className="step-num">2</span>
            {isEditing ? "Edit" : "Create"}
          </button>
        </li>
        {/* <li className={view === "hierarchy" ? "active" : ""}>
          <button
            type="button"
            className="step-btn"
            onClick={() => {
              if (selectedHierarchy) {
                setView("hierarchy");
              }
            }}
            disabled={!selectedHierarchy}
          >
            <span className="step-num">3</span>
            Hierarchy
          </button>
        </li> */}
      </ol>

      {view === "list" && (
        <>
          <div className="admins-header">
            <div>
              <h1>Customers</h1>
              <p>Manage the customers under your organization</p>
            </div>

            {/* <button
              className="btn-primary"
              onClick={goToCreate}
            >
              <FiPlus />
              Add Customer
            </button> */}
          </div>

          {/* SEARCH */}

          <div className="admins-toolbar">
            <input
              type="text"
              className="admins-search"
              placeholder="Search by company, code, email, phone or hierarchy..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <span className="admins-count">
              {filteredCustomers.length} of{" "}
              {customers.filter(isCustomerRole).length} customers
            </span>
          </div>

          {/* ERROR */}

          {error && (
            <div className="admins-error">
              {error}
            </div>
          )}

          {/* TABLE */}

          <div className="admins-table-card">
            {loading ? (
              <div className="admins-loading">
                Loading customers...
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="admins-empty">
                {customers.length === 0
                  ? "No customers yet. Click “Add Customer” to create one."
                  : "No customers match your search."}
              </div>
            ) : (
              <table className="admins-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Code</th>
                    <th>Email</th>
                    <th>Contact Person</th>
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
                        <strong>{companyOf(customer)}</strong>
                      </td>
                      <td>{customer.code}</td>
                      <td>{emailOf(customer) || "-"}</td>
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
            {isEditing ? (
              <FiEdit3 size={22} />
            ) : (
              <FiUserPlus size={22} />
            )}

            <div>
              <h2>
                {isEditing ? "Edit Customer" : "Create Customer"}
              </h2>

              <p>
                {isEditing
                  ? `Update details for ${
                      form.company || form.code
                    }.`
                  : "Add a new customer and select the hierarchy it will follow."}
              </p>
            </div>
          </div>

          {/* FORM */}

          <form
            onSubmit={handleSubmit}
            className="admins-form"
          >
            <div className="form-grid">

              {/* COMPANY */}

              <label>
                Company *

                <input
                  type="text"
                  value={form.company}
                  onChange={(e) =>
                    handleFieldChange(
                      "company",
                      e.target.value
                    )
                  }
                  placeholder="Acme Corporation"
                  required
                />
              </label>

              {/* CODE */}

              <label>
                Code *

                <input
                  type="text"
                  value={form.code}
                  onChange={(e) =>
                    handleFieldChange(
                      "code",
                      e.target.value
                    )
                  }
                  placeholder="ACME01"
                  required
                />
              </label>

              {/* COMPANY EMAIL */}

              <label>
                Company Email

                <input
                  type="email"
                  value={form.company_email}
                  onChange={(e) =>
                    handleFieldChange(
                      "company_email",
                      e.target.value
                    )
                  }
                  placeholder="contact@acme.com"
                />
              </label>

              {/* CONTACT PERSON */}

              <label>
                Contact Person

                <input
                  type="text"
                  value={form.contact_person}
                  onChange={(e) =>
                    handleFieldChange(
                      "contact_person",
                      e.target.value
                    )
                  }
                  placeholder="John Doe"
                />
              </label>

              {/* CONTACT EMAIL */}

              <label>
                Contact Person Email

                <input
                  type="email"
                  value={form.contact_person_email}
                  onChange={(e) =>
                    handleFieldChange(
                      "contact_person_email",
                      e.target.value
                    )
                  }
                  placeholder="john@acme.com"
                />
              </label>

              {/* PHONE */}

              <label>
                Phone

                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) =>
                    handleFieldChange(
                      "phone",
                      e.target.value
                    )
                  }
                  placeholder="+91 98765 43210"
                />
              </label>

              {/* LOGIN PASSWORD — the customer is the main user */}

              <label>
                {isEditing
                  ? "Login Password (leave blank to keep current)"
                  : "Login Password *"}

                <input
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    handleFieldChange(
                      "password",
                      e.target.value
                    )
                  }
                  placeholder={isEditing ? "••••••••" : "Set a password"}
                  required={!isEditing}
                  autoComplete="new-password"
                />

                <small className="field-hint">
                  The customer logs in with the Contact Person Email
                  (or Company Email if that is empty).
                </small>
              </label>

            </div>

            {/* =================================================
                HIERARCHY SELECTION
            ================================================= */}

            <div
              className="assign-card"
              style={{ marginTop: "24px" }}
            >
              <div className="assign-row">
                <span className="assign-label">
                  Location Hierarchy *
                </span>
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
                  const selected =
                    selectedHierarchy === option.value;

                  return (
                    <label
                      key={option.value}
                      style={{
                        border: selected
                          ? "2px solid #2563eb"
                          : "1px solid #d1d5db",
                        borderRadius: "10px",
                        padding: "18px",
                        cursor: isEditing
                          ? "default"
                          : "pointer",
                        background: selected
                          ? "#eff6ff"
                          : "#ffffff",
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
                          onChange={(e) =>
                            handleHierarchyChange(
                              e.target.value
                            )
                          }
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

              {!isEditing && (
                <p
                  style={{
                    marginTop: "12px",
                    fontSize: "13px",
                    color: "#6b7280",
                  }}
                >
                  Select the hierarchy that this customer will
                  use for its locations.
                </p>
              )}

              {isEditing && form.hierarchy_type && (
                <p
                  style={{
                    marginTop: "12px",
                    fontSize: "13px",
                    color: "#6b7280",
                  }}
                >
                  Hierarchy Cannot Change !!
                  {/* :{" "}
                  <strong>
                    {HIERARCHY_LABEL[form.hierarchy_type]}
                  </strong>{" "}
                  cannot be changed from this screen. */}
                </p>
              )}
            </div>

            {/* ACTIVE */}

            <div style={{ marginTop: "20px" }}>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    handleFieldChange(
                      "is_active",
                      e.target.checked
                    )
                  }
                />
                Active
              </label>
            </div>

            {/* ERROR */}

            {formError && (
              <div className="form-error">
                {formError}
              </div>
            )}

            {/* ACTIONS */}

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
                  (!isEditing && !selectedHierarchy)
                }
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


      {view === "hierarchy" && (
        <div className="admins-panel">

          {/* BACK */}

          <button
            className="btn-back"
            onClick={() => setView("form")}
          >
            <FiArrowLeft />
            Back to customer
          </button>

          {/* HEADER */}

          <div className="admins-panel-header">
            <FiMapPin size={22} />

            <div>
              <h2>Configure Hierarchy</h2>

              <p>
                Configure the location structure for{" "}
                <strong>{form.company}</strong>
              </p>
            </div>
          </div>

          {/* CUSTOMER SUMMARY */}

          <div className="assign-card">
            <div className="assign-row">
              <span className="assign-label">
                Customer
              </span>

              <span className="assign-value">
                {form.company || "-"}
              </span>
            </div>

            <div className="assign-row">
              <span className="assign-label">
                Code
              </span>

              <span className="assign-value">
                {form.code || "-"}
              </span>
            </div>

            <div className="assign-row">
              <span className="assign-label">
                Hierarchy
              </span>

              <span className="assign-value">
                {hierarchyName}
              </span>
            </div>
          </div>

          {/* =================================================
              GEOGRAPHICAL
          ================================================= */}

          {selectedHierarchy === "GEOGRAPHICAL" && (
            <div
              className="assign-card"
              style={{ marginTop: "20px" }}
            >
              <h3 style={{ marginTop: 0 }}>
                Geographical Hierarchy
              </h3>

              <div
                style={{
                  marginTop: "20px",
                  padding: "20px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "10px",
                  background: "#f9fafb",
                }}
              >
                <div
                  style={{
                    fontWeight: "600",
                    marginBottom: "12px",
                  }}
                >
                  India
                </div>

                <div
                  style={{
                    color: "#6b7280",
                    lineHeight: "2",
                  }}
                >
                  India → State → District → Taluka → City → Branch
                </div>

                <div
                  style={{
                    marginTop: "16px",
                    paddingTop: "16px",
                    borderTop: "1px solid #e5e7eb",
                  }}
                >
                  <strong>
                    Branch can contain:
                  </strong>

                  <ul
                    style={{
                      marginTop: "8px",
                      color: "#6b7280",
                    }}
                  >
                    <li>Multiple Floors</li>
                    <li>Direct AC units</li>
                    <li>Both Floors and Direct AC units</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* =================================================
              ZONAL
          ================================================= */}

          {selectedHierarchy === "ZONAL" && (
            <div
              className="assign-card"
              style={{ marginTop: "20px" }}
            >
              <h3 style={{ marginTop: 0 }}>
                Zonal Hierarchy
              </h3>

              <div
                style={{
                  marginTop: "20px",
                  padding: "20px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "10px",
                  background: "#f9fafb",
                }}
              >
                <div
                  style={{
                    fontWeight: "600",
                    marginBottom: "12px",
                  }}
                >
                  India
                </div>

                <div
                  style={{
                    color: "#6b7280",
                    lineHeight: "2",
                  }}
                >
                  India → Zone → Circle → Region → Division → Branch
                </div>

                <div
                  style={{
                    marginTop: "16px",
                    paddingTop: "16px",
                    borderTop: "1px solid #e5e7eb",
                  }}
                >
                  <strong>
                    Branch can contain:
                  </strong>

                  <ul
                    style={{
                      marginTop: "8px",
                      color: "#6b7280",
                    }}
                  >
                    <li>Multiple Floors</li>
                    <li>Direct AC units</li>
                    <li>Both Floors and Direct AC units</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ERROR */}

          {hierarchyError && (
            <div className="form-error">
              {hierarchyError}
            </div>
          )}

          {/* ACTIONS */}

          <div className="panel-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={backToList}
            >
              Return to Customers
            </button>

            <button
              type="button"
              className="btn-primary"
              onClick={backToList}
            >
              <FiCheckCircle />
              Finish
            </button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          className="admins-modal-overlay"
          onClick={() =>
            !deleting && setConfirmDelete(null)
          }
        >
          <div
            className="admins-modal admins-modal-small"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Delete Customer</h2>

            <p>
              Are you sure you want to delete{" "}
              <strong>
                {companyOf(confirmDelete)}
              </strong>
              ? This cannot be undone.
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

export default Customer_Creation;