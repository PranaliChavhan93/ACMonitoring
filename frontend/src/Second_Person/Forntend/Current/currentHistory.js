// Pure helpers for the Current History chart (no React, so they are easy to test).
//
// Every reading is normalised to { ts, avg, min, max, count }.
//   - a raw telemetry row  -> avg = min = max = current, count = 1
//   - a pre-aggregated row from the backend -> its own avg/min/max/count
// Both kinds are merged into time buckets the same way.

export const PERIODS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
];

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const pad2 = (n) => String(n).padStart(2, "0");

/* ---------------------------------------------------------
   Range + bucket size for each period (local time)
   today : 00:00 today  -> now, 5-minute buckets
   week  : 6 days ago   -> now, hourly buckets
   month : 1st of month -> now, daily buckets
--------------------------------------------------------- */
export function getRange(period, now = new Date()) {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === "today") return { from: midnight, to: now };

  if (period === "week") {
    const from = new Date(midnight);
    from.setDate(from.getDate() - 6);
    return { from, to: now };
  }

  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
}


export function bucketStart(ts, period) {
  const d = new Date(ts);

  // Today: preserve every reading as a separate point.
  if (period === "today") return ts;

  // Week: group readings by hour.
  if (period === "week") {
    d.setMinutes(0, 0, 0);
    return d.getTime();
  }

  // Month: group readings by calendar day.
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate()
  ).getTime();
}

/* ---------------------------------------------------------
   Parsing
--------------------------------------------------------- */
const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

// ThingsBoard rows carry the telemetry as a JSON string inside `value`.
function unwrap(row) {
  let payload = row?.value ?? row?.data ?? row?.values ?? row;

  for (let i = 0; i < 2 && typeof payload === "string"; i++) {
    try {
      payload = JSON.parse(payload);
    } catch {
      return null;
    }
  }

  if (payload && typeof payload === "object") {
    return { ...(row && typeof row === "object" ? row : {}), ...payload };
  }
  return row && typeof row === "object" ? row : null;
}

export function parseTimestamp(row) {
  const raw =
    row?.bucket ??
    row?.bucket_start ??
    row?.ts ??
    row?.timestamp ??
    row?.created_at ??
    row?.time;

  if (raw === undefined || raw === null || raw === "") return null;

  const numeric = Number(raw);
  const isNumeric = String(raw).trim() !== "" && Number.isFinite(numeric);
  const ms = isNumeric
    ? numeric < 1e12 ? numeric * 1000 : numeric
    : Date.parse(raw);

  return Number.isFinite(ms) ? ms : null;
}

export function rowToPoint(row) {
  const ts = parseTimestamp(row);
  if (ts === null) return null;

  const p = unwrap(row);
  if (!p) return null;

  // Pre-aggregated bucket from the backend.
  const avg = toNumber(p.avg ?? p.current_avg ?? p.avg_current);
  if (avg !== null) {
    return {
      ts,
      avg,
      min: toNumber(p.min ?? p.current_min ?? p.min_current) ?? avg,
      max: toNumber(p.max ?? p.current_max ?? p.max_current) ?? avg,
      count: toNumber(p.count ?? p.samples) ?? 1,
    };
  }

  // Raw telemetry reading.
  const current = toNumber(p.current ?? p.Current ?? p.values?.current);
  if (current === null) return null;
  return { ts, avg: current, min: current, max: current, count: 1 };
}

export function rowsToPoints(rows) {
  return (Array.isArray(rows) ? rows : []).map(rowToPoint).filter(Boolean);
}

export function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  for (const key of ["data", "results", "records", "items"]) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  // ThingsBoard style: { current: [{ ts, value }] }
  if (Array.isArray(payload.current)) {
    return payload.current.map((x) => ({ ts: x.ts, current: x.value }));
  }
  return [];
}

/* ---------------------------------------------------------
   Live sample: called once per dashboard API refresh.
   Mean current across the devices in scope (for one device
   this is simply its current).
--------------------------------------------------------- */

export function liveSample(rows, now = Date.now()) {
  const list = Array.isArray(rows) ? rows : [];

  const readings = list
    .map((row) => {
      const value = toNumber(
        row?.current ??
        row?.Current ??
        row?.values?.current
      );

      if (value === null) return null;

      return {
        value,
        ts: parseTimestamp(row),
      };
    })
    .filter(Boolean);

  if (!readings.length) return null;

  const values = readings.map((r) => r.value);

  const timestamps = readings
    .map((r) => r.ts)
    .filter(Number.isFinite);

  return {
    ts: timestamps.length ? Math.max(...timestamps) : now,
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    count: 1,
  };
}


/* ---------------------------------------------------------
   Group points into buckets -> chart series
--------------------------------------------------------- */
export function buildSeries(points, period, now = new Date()) {
  const { from, to } = getRange(period, now);
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const buckets = new Map();

  for (const pt of points) {
    if (pt.ts < fromMs || pt.ts > toMs) continue;

    const key = bucketStart(pt.ts, period);
    const b = buckets.get(key);

    if (!b) {
      buckets.set(key, {
        t: key,
        sum: pt.avg * pt.count,
        count: pt.count,
        min: pt.min,
        max: pt.max,
      });
    } else {
      b.sum += pt.avg * pt.count;
      b.count += pt.count;
      b.min = Math.min(b.min, pt.min);
      b.max = Math.max(b.max, pt.max);
    }
  }

  const round = (n) => Number(n.toFixed(3));

  return [...buckets.values()]
    .sort((a, b) => a.t - b.t)
    .map((b) => ({
      t: b.t,
      avg: round(b.sum / b.count),
      min: round(b.min),
      max: round(b.max),
      count: b.count,
    }));
}

export function summarize(series) {
  if (!series.length) return null;

  let sum = 0;
  let count = 0;
  let min = Infinity;
  let max = -Infinity;

  for (const s of series) {
    sum += s.avg * s.count;
    count += s.count;
    min = Math.min(min, s.min);
    max = Math.max(max, s.max);
  }

  return { avg: sum / count, min, max };
}

/* ---------------------------------------------------------
   Axis helpers
--------------------------------------------------------- */
export function makeTicks(period, from, to) {
  const ticks = [];
  const fromMs = from.getTime();
  const toMs = to.getTime();

  if (period === "today") {
    for (let h = 0; h < 24; h += 3) {
      const t = new Date(from.getFullYear(), from.getMonth(), from.getDate(), h).getTime();
      if (t <= toMs) ticks.push(t);
    }
    return ticks;
  }

  const step = period === "week" ? 1 : 3; // days between ticks
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  while (d.getTime() <= toMs) {
    if (d.getTime() >= fromMs) ticks.push(d.getTime());
    d.setDate(d.getDate() + step);
  }
  return ticks;
}

export function formatTick(ts, period) {
  const d = new Date(ts);
  if (period === "today") return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}


export function formatLabel(ts, period) {
  const d = new Date(ts);

  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(
    d.getSeconds()
  )}`;

  if (period === "today") return time;

  if (period === "week") {
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}, ${time}`;
  }

  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}, ${time}`;
}
