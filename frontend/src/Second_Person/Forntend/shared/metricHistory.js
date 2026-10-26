// Pure helpers for the history charts (no React, easy to unit-test).
//
// The backend returns rows like { bucket, avg, min, max, count } read from its
// own database.  Everything here turns a "view mode" (last hour, 12 h, 24 h,
// today, week, month ...) into a time range, bucket size, axis ticks and a
// gap-aware chart series.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const VIEW_MODES = [
  { value: "today", label: "Today" },
  { value: "last-hour", label: "Last Hour" },
  { value: "last-12-hours", label: "Last 12 Hours" },
  { value: "last-24-hours", label: "Last 24 Hours" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "selected-hour", label: "Select hour" },
  { value: "custom", label: "Custom date range" },
];

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad2 = (n) => String(n).padStart(2, "0");

/* ---------- range ---------- */
// -> { from, to } in epoch ms.  Always local-time based, never empty/inverted.
export function getViewRange(viewMode, selectedHour, now = new Date(), customFrom = "", customTo = "") {
  const to = now.getTime();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (viewMode) {
    case "last-hour":
      return { from: to - HOUR, to };
    case "last-12-hours":
      return { from: to - 12 * HOUR, to };
    case "last-24-hours":
      return { from: to - 24 * HOUR, to };
    case "selected-hour": {
      const hour = Math.min(Math.max(Number(selectedHour) || 0, 0), now.getHours());
      const from = new Date(midnight);
      from.setHours(hour, 0, 0, 0);
      return { from: from.getTime(), to: Math.min(from.getTime() + HOUR, to) };
    }
    case "week": {
      const from = new Date(midnight);
      from.setDate(from.getDate() - 6);
      return { from: from.getTime(), to };
    }
    case "month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), to };
    default: // today
      return { from: midnight.getTime(), to };
  }
}

// What to ask the backend for.  30-minute buckets line up with local days/hours
// in half-hour time zones such as IST, so week/month re-bucketing is exact.
export function requestFor(viewMode) {
  if (viewMode === "week") return { period: "week", intervalSeconds: 1800 };
  if (viewMode === "month") return { period: "month", intervalSeconds: 1800 };
  return { period: "today", intervalSeconds: 60 };
}

// Client-side bucket size for the chart (null = plot every stored minute).
const isDayView = (viewMode) => viewMode === "month";
const isHourView = (viewMode) => viewMode === "week";

export function bucketStart(ts, viewMode) {
  if (isHourView(viewMode)) {
    const d = new Date(ts);
    d.setMinutes(0, 0, 0);
    return d.getTime();
  }
  if (isDayView(viewMode)) {
    const d = new Date(ts);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }
  return ts;
}

/* ---------- parsing ---------- */
const toNumber = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function rowsToPoints(payload) {
  const rows = Array.isArray(payload) ? payload : payload?.data;
  if (!Array.isArray(rows)) return [];
  const points = [];
  for (const row of rows) {
    const ts = Date.parse(row?.bucket ?? row?.bucket_start ?? "");
    const avg = toNumber(row?.avg);
    if (!Number.isFinite(ts) || avg === null) continue;
    points.push({
      ts,
      avg,
      min: toNumber(row.min) ?? avg,
      max: toNumber(row.max) ?? avg,
      count: Math.max(toNumber(row.count) ?? 1, 1),
    });
  }
  return points;
}

/* ---------- series ---------- */
export function buildSeries(points, viewMode, range) {
  const buckets = new Map();
  for (const pt of points) {
    if (pt.ts < range.from || pt.ts > range.to) continue;
    const key = bucketStart(pt.ts, viewMode);
    const b = buckets.get(key);
    if (!b) {
      buckets.set(key, { t: key, sum: pt.avg * pt.count, count: pt.count, min: pt.min, max: pt.max });
    } else {
      b.sum += pt.avg * pt.count;
      b.count += pt.count;
      b.min = Math.min(b.min, pt.min);
      b.max = Math.max(b.max, pt.max);
    }
  }

  const round = (n) => Number(n.toFixed(3));
  const real = new Map(
    [...buckets.values()].map((b) => [
      b.t,
      { t: b.t, avg: round(b.sum / b.count), min: round(b.min), max: round(b.max), count: b.count },
    ])
  );

  // A device that is off sends nothing, so show those periods as 0 on one
  // continuous line.  The bucket still in progress (the last one) is not
  // zero-filled: it simply fills in as readings arrive.
  const series = [];
  const seen = new Set();
  for (const t of bucketKeys(viewMode, range)) {
    seen.add(t);
    series.push(real.get(t) ?? { t, avg: 0, min: 0, max: 0, count: 0 });
  }
  // Keep any real bucket that fell outside the generated keys (e.g. the live one).
  real.forEach((pt, t) => {
    if (!seen.has(t)) series.push(pt);
  });
  return series.sort((a, b) => a.t - b.t);
}

// Every chart bucket start between range.from and range.to, in order.
function bucketKeys(viewMode, range) {
  const keys = [];
  if (isDayView(viewMode)) {
    const d = new Date(range.from);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() < range.from) d.setDate(d.getDate() + 1);
    for (; d.getTime() + DAY <= range.to; d.setDate(d.getDate() + 1)) keys.push(d.getTime());
  } else {
    const step = isHourView(viewMode) ? HOUR : MINUTE;
    const first = isHourView(viewMode) ? bucketStart(range.from, viewMode) : Math.ceil(range.from / step) * step;
    for (let t = first < range.from ? first + step : first; t + step <= range.to; t += step) keys.push(t);
  }
  return keys;
}

/* ---------- axis ---------- */
// Ticks aligned to LOCAL clock boundaries (epoch multiples would land on :30 in IST).
function alignedTicks(from, to, step) {
  const offset = new Date(from).getTimezoneOffset() * MINUTE;
  const ticks = [];
  for (let t = Math.ceil((from - offset) / step) * step + offset; t <= to; t += step) ticks.push(t);
  return ticks;
}

export function makeTicks(viewMode, range) {
  const { from, to } = range;
  switch (viewMode) {
    case "last-hour":
    case "selected-hour":
      return alignedTicks(from, to, 10 * MINUTE);
    case "last-12-hours":
      return alignedTicks(from, to, HOUR);
    case "last-24-hours":
      return alignedTicks(from, to, 2 * HOUR);
    case "week":
    case "month": {
      const step = viewMode === "week" ? 1 : 3;
      const ticks = [];
      const d = new Date(from);
      d.setHours(0, 0, 0, 0);
      for (; d.getTime() <= to; d.setDate(d.getDate() + step)) {
        if (d.getTime() >= from) ticks.push(d.getTime());
      }
      return ticks;
    }
    default: {
      const d = new Date(from);
      d.setHours(0, 0, 0, 0);
      const ticks = [];
      for (let h = 0; h < 24; h += 3) {
        d.setHours(h);
        if (d.getTime() <= to) ticks.push(d.getTime());
      }
      return ticks;
    }
  }
}

export function formatTick(ts, viewMode) {
  const d = new Date(ts);
  if (viewMode === "week" || viewMode === "month") return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
  if ((viewMode === "last-12-hours" || viewMode === "last-24-hours") && d.getHours() === 0 && d.getMinutes() === 0) {
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
  }
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function formatLabel(ts, viewMode) {
  const d = new Date(ts);
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  if (viewMode === "month") return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
  if (viewMode === "today" || viewMode === "last-hour" || viewMode === "selected-hour") return time;
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}, ${time}`;
}

// How often to re-read the database: every 10 s so the dashboard stays live.
export const LIVE_REFRESH_MS = 2_000;
export const refreshMsFor = () => LIVE_REFRESH_MS;
