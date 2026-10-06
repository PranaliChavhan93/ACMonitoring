import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";

export const API_BASE = "http://localhost:8000/api";

export const authHeaders = () => {
    const token = localStorage.getItem("token") || "";
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Token ${token}` } : {}),
    };
};

const asList = (r) =>
    Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : Array.isArray(r?.results) ? r.results : [];

export const SiteActionsContext = createContext({ canAssign: false, openAssign: () => {} });

const box = {
    overlay: {
        position: "fixed", inset: 0, background: "rgba(15,23,42,.45)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    },
    card: {
        background: "#fff", borderRadius: 12, width: "min(560px, 94vw)", maxHeight: "88vh",
        overflowY: "auto", padding: 24, boxShadow: "0 20px 50px rgba(0,0,0,.25)",
    },
    label: { display: "block", fontSize: 13, fontWeight: 600, margin: "14px 0 6px", color: "#374151" },
    select: { width: "100%", padding: "9px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14 },
    hint: { fontSize: 12, color: "#6b7280", marginTop: 4 },
    check: { display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 14 },
    err: { background: "#fef2f2", color: "#b91c1c", padding: "8px 10px", borderRadius: 8, fontSize: 13, marginTop: 12 },
    row: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 },
    btn: { padding: "9px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" },
    primary: { padding: "9px 16px", borderRadius: 8, border: 0, background: "#2563eb", color: "#fff", cursor: "pointer" },
};

export default function SiteOwnerModal({ branch, hierarchyType, role, onClose, onSaved }) {
    const isSuper = role === "ORG_SUPER_ADMIN";

    const [customers, setCustomers] = useState([]);
    const [users, setUsers] = useState({ admins: [], engineers: [] });
    const [customerId, setCustomerId] = useState(branch.customer?.id ?? "");
    const [adminIds, setAdminIds] = useState((branch.admins || []).map((a) => a.id));
    const [engineerIds, setEngineerIds] = useState((branch.engineers || []).map((a) => a.id));
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const get = useCallback(async (path) => {
        const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders(), cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status} (${path})`);
        return asList(await res.json());
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const [c, a, e] = await Promise.all([get("/customers/"), get("/admins/"), get("/engineers/")]);
                setCustomers(c.filter((x) => x.is_active !== false && (!x.hierarchy_type || x.hierarchy_type === hierarchyType)));
                setUsers({
                    admins: a.filter((u) => u.role === "BR_ADMIN" && u.is_active !== false),
                    engineers: e.filter((u) => u.role === "ENGINEER" && u.is_active !== false),
                });
            } catch (err) {
                setError(err.message || "Unable to load customers / users.");
            } finally {
                setLoading(false);
            }
        })();
    }, [get, hierarchyType]);

    // a customer-role user is locked to their own customer
    useEffect(() => {
        if (!isSuper && customers.length === 1) setCustomerId(customers[0].id);
    }, [isSuper, customers]);

    const adminsOfCustomer = useMemo(
        () => users.admins.filter((u) => String(u.customer) === String(customerId)), [users, customerId]);
    const engineersOfCustomer = useMemo(
        () => users.engineers.filter((u) => String(u.customer) === String(customerId)), [users, customerId]);

    const toggle = (list, setList, id) =>
        setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

    const onCustomerChange = (value) => {
        setCustomerId(value);
        setAdminIds([]);
        setEngineerIds([]);
    };

    const save = async () => {
        if (!customerId) return setError("Please select a customer.");
        setSaving(true);
        setError("");
        try {
            const res = await fetch(`${API_BASE}/branches/ownership/`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({
                    hierarchy_type: hierarchyType,
                    branch_id: branch.branch_id,
                    customer_id: Number(customerId),
                    admin_ids: adminIds,
                    engineer_ids: engineerIds,
                }),
            });
            const result = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(result?.message || `HTTP ${res.status}`);
            onSaved?.();
            onClose();
        } catch (err) {
            setError(err.message || "Could not save.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={box.overlay} onClick={saving ? undefined : onClose}>
            <div style={box.card} onClick={(e) => e.stopPropagation()}>
                <h2 style={{ margin: 0 }}>Assign site</h2>
                <p style={{ ...box.hint, marginTop: 4 }}>
                    {branch.branch_name} · {branch.branch_id}. ACs added to this site are assigned to the same
                    customer and admins automatically.
                </p>

                {loading ? <p>Loading…</p> : (
                    <>
                        <label style={box.label}>Customer *</label>
                        <select
                            style={box.select}
                            value={customerId}
                            onChange={(e) => onCustomerChange(e.target.value)}
                            disabled={!isSuper}
                        >
                            <option value="">— Select customer —</option>
                            {customers.map((c) => (
                                <option key={c.id} value={c.id}>{c.company} ({c.code})</option>
                            ))}
                        </select>
                        <div style={box.hint}>
                            Only customers on the {hierarchyType === "ZONAL" ? "Zonal" : "Geographical"} hierarchy are listed.
                        </div>

                        <label style={box.label}>Branch admins</label>
                        {!customerId ? <div style={box.hint}>Select a customer first.</div>
                            : adminsOfCustomer.length === 0 ? <div style={box.hint}>No branch admins for this customer yet.</div>
                            : adminsOfCustomer.map((u) => (
                                <label key={u.id} style={box.check}>
                                    <input type="checkbox" checked={adminIds.includes(u.id)}
                                        onChange={() => toggle(adminIds, setAdminIds, u.id)} />
                                    {u.name} <span style={{ color: "#6b7280" }}>{u.email}</span>
                                </label>
                            ))}

                        <label style={box.label}>Engineers</label>
                        {!customerId ? <div style={box.hint}>Select a customer first.</div>
                            : engineersOfCustomer.length === 0 ? <div style={box.hint}>No engineers for this customer yet.</div>
                            : engineersOfCustomer.map((u) => (
                                <label key={u.id} style={box.check}>
                                    <input type="checkbox" checked={engineerIds.includes(u.id)}
                                        onChange={() => toggle(engineerIds, setEngineerIds, u.id)} />
                                    {u.name} <span style={{ color: "#6b7280" }}>{u.email}</span>
                                </label>
                            ))}
                    </>
                )}

                {error && <div style={box.err}>{error}</div>}

                <div style={box.row}>
                    <button type="button" style={box.btn} onClick={onClose} disabled={saving}>Cancel</button>
                    <button type="button" style={box.primary} onClick={save} disabled={saving || loading}>
                        {saving ? "Saving…" : "Save assignment"}
                    </button>
                </div>
            </div>
        </div>
    );
}
