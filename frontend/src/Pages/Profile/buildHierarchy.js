// Turns data into one tree:  Customer -> Branch -> Floor -> AC
// and rolls AC counts / online / alerts / energy up to every parent.
//
// Accepts either
//   A) a nested payload from GET /api/profile/   ({ customers: [{ branches: [{ floors: [{ acs: [] }] }] }] })
//   B) the flat rows already returned by GET /api/ac-data/  (one row per AC)

export const NODE = Object.freeze({ CUSTOMER: "customer", BRANCH: "branch", FLOOR: "floor", AC: "ac" });
export const CHILD_LABEL = { customer: "Branches", branch: "Floors", floor: "AC units" };

const first = (obj, ...keys) => {
    for (const k of keys) if (obj?.[k] !== undefined && obj?.[k] !== null && obj?.[k] !== "") return obj[k];
    return null;
};
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

const ON = ["active", "running", "on", "1", "true"];
export const isOn = (v) => ON.includes(String(v ?? "").trim().toLowerCase());
const BAD = ["attention", "critical", "alert", "warning"];

export function normalizeAc(row = {}) {
    const health = String(first(row, "health_status", "health", "alert_status") || "").toLowerCase();
    return {
        type: NODE.AC,
        id: String(first(row, "tpt_device_id", "device_id", "device_uuid", "id", "ac_id") ?? Math.random()),
        name: String(first(row, "ac_id", "device_name", "name", "device_id") ?? "AC"),
        online: isOn(first(row, "relay", "status", "ac_status", "state")),
        alert: Number(row.alarm_status) === 1 || BAD.includes(health),
        health: health || "unknown",
        energy: num(first(row, "energy_consumption", "energy", "kwh", "kWh")),
        power: num(first(row, "active_power", "power", "Power")),
        voltage: first(row, "voltage", "Voltage"),
        current: first(row, "current", "Current"),
        temperature: first(row, "indoor_temperature", "indoor_temp", "temperature"),
        humidity: first(row, "indoor_humidity", "humidity"),
        lastSeen: first(row, "timestamp", "ts", "last_updated", "time"),
        model: first(row, "model", "ac_model"),
        capacity: first(row, "capacity", "tonnage"),
        children: [],
    };
}

function rollUp(node) {
    if (node.type === NODE.AC) {
        node.stats = { acs: 1, online: node.online ? 1 : 0, alerts: node.alert ? 1 : 0, energy: node.energy };
        return node.stats;
    }
    const s = { acs: 0, online: 0, alerts: 0, energy: 0 };
    node.children.forEach((c) => {
        const cs = rollUp(c);
        s.acs += cs.acs; s.online += cs.online; s.alerts += cs.alerts; s.energy += cs.energy;
    });
    node.stats = s;
    return s;
}

const sortByName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });

/* ---------- A) nested payload ---------- */
function fromNested(customers = []) {
    return customers.map((c) => ({
        type: NODE.CUSTOMER,
        id: String(first(c, "id", "customer_id", "name")),
        name: String(first(c, "name", "customer_name") ?? "Customer"),
        meta: { email: first(c, "email"), phone: first(c, "phone"), city: first(c, "city") },
        children: (c.branches || []).map((b) => ({
            type: NODE.BRANCH,
            id: String(first(b, "id", "branch_id", "name")),
            name: String(first(b, "name", "branch_name") ?? "Branch"),
            meta: { city: first(b, "city", "city_name"), state: first(b, "state", "state_name"), admin: first(b, "admin_name") },
            children: (b.floors || []).map((f) => ({
                type: NODE.FLOOR,
                id: String(first(f, "id", "floor_id", "name")),
                name: String(first(f, "name", "floor_name") ?? "Floor"),
                meta: {},
                children: (f.acs || []).map(normalizeAc),
            })),
        })),
    }));
}

/* ---------- B) flat ac-data rows ---------- */
function fromFlat(rows = []) {
    const customers = new Map();
    const get = (map, key, make) => { if (!map.has(key)) map.set(key, make()); return map.get(key); };

    rows.forEach((row) => {
        const cName = String(first(row, "customer_name", "customer", "organization") ?? "My Organization");
        const bName = String(first(row, "branch_name", "branch") ?? "Unassigned branch");
        const fName = String(first(row, "floor_name", "floor") ?? "Unassigned floor");

        const c = get(customers, cName, () => ({ type: NODE.CUSTOMER, id: `c:${cName}`, name: cName, meta: {}, children: [], _m: new Map() }));
        const b = get(c._m, bName, () => ({
            type: NODE.BRANCH, id: `${c.id}|b:${bName}`, name: bName, children: [], _m: new Map(),
            meta: { city: first(row, "city_name", "city"), state: first(row, "state_name", "state") },
        }));
        const f = get(b._m, fName, () => ({ type: NODE.FLOOR, id: `${b.id}|f:${fName}`, name: fName, meta: {}, children: [] }));
        f.children.push(normalizeAc(row));
    });

    return [...customers.values()].map((c) => {
        c.children = [...c._m.values()].map((b) => { b.children = [...b._m.values()]; delete b._m; return b; });
        delete c._m;
        return c;
    });
}

export function buildHierarchy(source) {
    const tree = Array.isArray(source) ? fromFlat(source) : fromNested(source?.customers);
    const sortDeep = (n) => { n.children.sort(sortByName); n.children.forEach(sortDeep); };
    tree.sort(sortByName).forEach((c) => { sortDeep(c); rollUp(c); });
    return tree;
}

export const totals = (tree) => {
    const t = { customers: tree.length, branches: 0, floors: 0, acs: 0, online: 0, alerts: 0, energy: 0 };
    tree.forEach((c) => {
        t.branches += c.children.length;
        c.children.forEach((b) => { t.floors += b.children.length; });
        t.acs += c.stats.acs; t.online += c.stats.online; t.alerts += c.stats.alerts; t.energy += c.stats.energy;
    });
    return t;
};

// id -> { node, path[] } for breadcrumbs & selection
export function indexTree(tree) {
    const map = new Map();
    const walk = (n, path) => { const p = [...path, n]; map.set(n.id, { node: n, path: p }); n.children.forEach((c) => walk(c, p)); };
    tree.forEach((c) => walk(c, []));
    return map;
}
