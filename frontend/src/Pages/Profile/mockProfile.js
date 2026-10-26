import React, { useMemo, useState, useEffect } from "react";
import useProfileData from "./useProfileData";
import { NODE, CHILD_LABEL, totals, indexTree } from "./buildHierarchy";
import "./Profile.css";

const ROLE_LABEL = {
    ORG_SUPER_ADMIN: "Organization Super Admin",
    CUSTOMER: "Customer Admin",
    BR_ADMIN: "Branch Admin",
    ENGINEER: "Engineer",
};
const TYPE_LABEL = { customer: "Customer", branch: "Branch", floor: "Floor", ac: "AC unit" };
const TYPE_ICON = { customer: "🏢", branch: "📍", floor: "▤", ac: "❄️" };
const kwh = (n) => Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 1 });
const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "U";

/* ───────────── identity card ───────────── */
function IdentityCard({ user }) {
    const role = user.role;
    const rows = [
        ["Email", user.email],
        ["Phone", user.phone],
        ["Hierarchy", user.customer_hierarchy_type === "ZONAL" ? "Zonal" : user.customer_hierarchy_type === "GEOGRAPHICAL" ? "Geographical" : user.customer_hierarchy_type],
        ["Region", user.zone_name || user.state_name],
        ["Head office", user.head_office_city_name || user.head_office_branch],
        ["Member since", user.member_since],
        ["Last login", user.last_login],
    ].filter(([, v]) => v);

    return (
        <aside className="pf-card pf-identity">
            <div className="pf-avatar" aria-hidden="true">{initials(user.name)}</div>
            <h2>{user.name || "—"}</h2>
            <span className="pf-role">{ROLE_LABEL[role] || role || "User"}</span>
            {user.status && <span className={`pf-status pf-status--${user.status}`}>{user.status}</span>}

            <dl className="pf-dl">
                {rows.map(([k, v]) => (<React.Fragment key={k}><dt>{k}</dt><dd>{String(v)}</dd></React.Fragment>))}
            </dl>

            {Array.isArray(user.permissions) && user.permissions.length > 0 && (
                <>
                    <h4 className="pf-subhead">Access</h4>
                    <div className="pf-chips">{user.permissions.map((p) => <span key={p} className="pf-chip">{p}</span>)}</div>
                </>
            )}
        </aside>
    );
}

/* ───────────── portfolio numbers ───────────── */
function Tiles({ t, showCustomers }) {
    const tiles = [
        showCustomers && { label: "Customers", value: t.customers, icon: "🏢" },
        { label: "Branches", value: t.branches, icon: "📍" },
        { label: "Floors", value: t.floors, icon: "▤" },
        { label: "AC units", value: t.acs, icon: "❄️" },
        { label: "Online", value: `${t.online}/${t.acs}`, icon: "🟢" },
        { label: "Alerts", value: t.alerts, icon: "⚠️", warn: t.alerts > 0 },
        { label: "Energy (kWh)", value: kwh(t.energy), icon: "⚡" },
    ].filter(Boolean);
    return (
        <div className="pf-tiles">
            {tiles.map((x) => (
                <div key={x.label} className={`pf-tile${x.warn ? " is-warn" : ""}`}>
                    <span className="pf-tile-icon" aria-hidden="true">{x.icon}</span>
                    <strong>{x.value}</strong><span>{x.label}</span>
                </div>
            ))}
        </div>
    );
}

/* ───────────── tree ───────────── */
function matches(node, q) {
    if (!q) return true;
    if (node.name.toLowerCase().includes(q)) return true;
    return node.children.some((c) => matches(c, q));
}

function TreeNode({ node, depth, q, expanded, toggle, selectedId, select }) {
    if (!matches(node, q)) return null;
    const hasKids = node.children.length > 0;
    const open = q ? true : expanded.has(node.id);
    const isAc = node.type === NODE.AC;

    return (
        <li role="treeitem" aria-expanded={hasKids ? open : undefined} aria-selected={selectedId === node.id}>
            <div className={`pf-row${selectedId === node.id ? " is-selected" : ""}`} style={{ paddingLeft: 8 + depth * 16 }}>
                {hasKids
                    ? <button type="button" className="pf-caret" onClick={() => toggle(node.id)} aria-label={open ? "Collapse" : "Expand"}>{open ? "▾" : "▸"}</button>
                    : <span className="pf-caret pf-caret--empty" />}
                <button type="button" className="pf-label" onClick={() => { select(node.id); if (hasKids && !open) toggle(node.id); }}>
                    {isAc
                        ? <span className={`pf-dot ${node.alert ? "is-alert" : node.online ? "is-on" : "is-off"}`} />
                        : <span aria-hidden="true">{TYPE_ICON[node.type]}</span>}
                    <span className="pf-name">{node.name}</span>
                    {!isAc && <span className="pf-count">{node.stats.acs}</span>}
                    {!isAc && node.stats.alerts > 0 && <span className="pf-badge-alert">{node.stats.alerts}</span>}
                </button>
            </div>
            {hasKids && open && (
                <ul role="group">
                    {node.children.map((c) => <TreeNode key={c.id} node={c} depth={depth + 1} q={q} expanded={expanded} toggle={toggle} selectedId={selectedId} select={select} />)}
                </ul>
            )}
        </li>
    );
}

/* ───────────── detail pane ───────────── */
function Field({ label, value, unit = "" }) {
    const empty = value === null || value === undefined || value === "";
    return <div className="pf-field"><span>{label}</span><strong>{empty ? "—" : `${value}${unit}`}</strong></div>;
}

function Detail({ entry, select, onOpenDashboard }) {
    if (!entry) return <div className="pf-empty">Select a customer, branch, floor or AC to see its details.</div>;
    const { node, path } = entry;

    return (
        <div className="pf-detail">
            <nav className="pf-crumbs" aria-label="Location">
                {path.map((p, i) => (
                    <React.Fragment key={p.id}>
                        {i > 0 && <span>›</span>}
                        {i < path.length - 1 ? <button type="button" onClick={() => select(p.id)}>{p.name}</button> : <b>{p.name}</b>}
                    </React.Fragment>
                ))}
            </nav>

            <div className="pf-detail-head">
                <div><span className="pf-kicker">{TYPE_LABEL[node.type]}</span><h3>{node.name}</h3></div>
                {onOpenDashboard && <button type="button" className="pf-btn" onClick={() => onOpenDashboard(path)}>Open on dashboard →</button>}
            </div>

            {node.type === NODE.AC ? (
                <>
                    <div className="pf-fields">
                        <Field label="Status" value={node.online ? "ON" : "OFF"} />
                        <Field label="Health" value={node.alert ? "Needs attention" : node.health} />
                        <Field label="Active power" value={node.power} unit=" W" />
                        <Field label="Energy" value={node.energy} unit=" kWh" />
                        <Field label="Voltage" value={node.voltage} unit=" V" />
                        <Field label="Current" value={node.current} unit=" A" />
                        <Field label="Indoor temp" value={node.temperature} unit=" °C" />
                        <Field label="Indoor humidity" value={node.humidity} unit=" %" />
                        <Field label="Model" value={node.model} />
                        <Field label="Capacity" value={node.capacity} />
                        <Field label="Device ID" value={node.id} />
                        <Field label="Last reading" value={node.lastSeen} />
                    </div>
                </>
            ) : (
                <>
                    <div className="pf-fields">
                        <Field label="AC units" value={node.stats.acs} />
                        <Field label="Online" value={`${node.stats.online}/${node.stats.acs}`} />
                        <Field label="Alerts" value={node.stats.alerts} />
                        <Field label="Energy" value={kwh(node.stats.energy)} unit=" kWh" />
                        {node.meta?.city && <Field label="City" value={node.meta.city} />}
                        {node.meta?.state && <Field label="State" value={node.meta.state} />}
                        {node.meta?.admin && <Field label="Branch admin" value={node.meta.admin} />}
                        {node.meta?.email && <Field label="Email" value={node.meta.email} />}
                        {node.meta?.phone && <Field label="Phone" value={node.meta.phone} />}
                    </div>

                    <h4 className="pf-subhead">{CHILD_LABEL[node.type]} ({node.children.length})</h4>
                    <div className="pf-table-wrap">
                        <table className="pf-table">
                            <thead><tr><th>Name</th><th>{node.type === NODE.FLOOR ? "Status" : "ACs"}</th><th>{node.type === NODE.FLOOR ? "Power" : "Online"}</th><th>Alerts</th><th>Energy (kWh)</th></tr></thead>
                            <tbody>
                                {node.children.map((c) => {
                                    const ac = c.type === NODE.AC;
                                    return (
                                        <tr key={c.id} onClick={() => select(c.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && select(c.id)}>
                                            <td><span aria-hidden="true">{TYPE_ICON[c.type]}</span> {c.name}</td>
                                            <td>{ac ? <span className={`pf-pill ${c.alert ? "is-alert" : c.online ? "is-on" : "is-off"}`}>{c.alert ? "Alert" : c.online ? "ON" : "OFF"}</span> : c.stats.acs}</td>
                                            <td>{ac ? `${c.power} W` : `${c.stats.online}/${c.stats.acs}`}</td>
                                            <td>{c.stats.alerts}</td>
                                            <td>{kwh(c.stats.energy)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}

/* ───────────── page ───────────── */
export default function ProfilePage({ currentUser, onOpenDashboard }) {
    const { user, tree, loading, error, source } = useProfileData(currentUser);
    const index = useMemo(() => indexTree(tree), [tree]);
    const t = useMemo(() => totals(tree), [tree]);

    const [q, setQ] = useState("");
    const [selectedId, setSelectedId] = useState(null);
    const [expanded, setExpanded] = useState(new Set());

    // open the first customer + select it once data arrives
    useEffect(() => {
        if (tree.length && !selectedId) {
            setSelectedId(tree[0].id);
            setExpanded(new Set([tree[0].id]));
        }
    }, [tree, selectedId]);

    const toggle = (id) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const select = (id) => {
        setSelectedId(id);
        // make sure ancestors are open so the row is visible in the tree
        const entry = index.get(id);
        if (entry) setExpanded((s) => new Set([...s, ...entry.path.slice(0, -1).map((p) => p.id)]));
    };
    const expandAll = () => setExpanded(new Set([...index.keys()]));
    const collapseAll = () => setExpanded(new Set());

    if (loading) return <div className="pf-page"><div className="pf-card pf-note">Loading profile…</div></div>;
    if (error) return <div className="pf-page"><div className="pf-card pf-note pf-note--error"><strong>Couldn't load profile.</strong> {error}</div></div>;

    return (
        <div className="pf-page">
            <header className="pf-pagehead">
                <div><h1>My Profile</h1><p>Your account and everything that sits under it.</p></div>
                {source === "mock" && <span className="pf-mock">Sample data</span>}
            </header>

            <div className="pf-layout">
                <IdentityCard user={user || {}} />

                <div className="pf-main">
                    <Tiles t={t} showCustomers={user?.role === "ORG_SUPER_ADMIN"} />

                    <section className="pf-card pf-explorer">
                        <div className="pf-explorer-head">
                            <h3>Assigned hierarchy</h3>
                            <div className="pf-tools">
                                <input type="search" value={q} onChange={(e) => setQ(e.target.value.trim().toLowerCase())} placeholder="Search customer, branch, floor, AC…" aria-label="Search hierarchy" />
                                <button type="button" className="pf-btn pf-btn--ghost" onClick={expandAll}>Expand all</button>
                                <button type="button" className="pf-btn pf-btn--ghost" onClick={collapseAll}>Collapse</button>
                            </div>
                        </div>

                        {tree.length === 0 ? (
                            <div className="pf-empty">Nothing is assigned to this account yet.</div>
                        ) : (
                            <div className="pf-split">
                                <ul className="pf-tree" role="tree">
                                    {tree.map((n) => <TreeNode key={n.id} node={n} depth={0} q={q} expanded={expanded} toggle={toggle} selectedId={selectedId} select={select} />)}
                                </ul>
                                <Detail entry={index.get(selectedId)} select={select} onOpenDashboard={onOpenDashboard} />
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
