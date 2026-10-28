// Shared graph zoom -- the same behaviour CurrentTemp.jsx has, reusable by every chart.
//
//   Ctrl/Cmd + wheel (or a trackpad pinch)  zoom the CHART around the cursor.  The wheel
//                                           listener is non-passive and calls
//                                           preventDefault(), so the browser never zooms
//                                           the page while the pointer is over a chart.
//   drag a rectangle                        zoom into that span
//   toolbar / double-click                  zoom in, zoom out, pan, reset
//
// Two flavours:
//   useTimeZoom   charts with a real time axis (numeric ms on X).  The visible span
//                 drives the ticks, and charts re-request finer data for it.
//   IndexZoomFrame  charts with a category X axis (bars per AC / zone, hourly or daily
//                 energy buckets): zooms to a window of categories.
//
// Styling: the .chart-zoom-area / .chart-zoom-toolbar / .chart-zoom-btn rules that
// CurrentTemp already uses (dashboard.css).  Do NOT import chart-zoom.css next to them:
// it defines a different .chart-zoom-toolbar that would override these.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { ReferenceArea } from "recharts";

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const MIN_ZOOM_SPAN = 5 * MINUTE;
export const ZOOM_HINT = "Ctrl + scroll (or pinch) to zoom, drag to select a range, double-click to reset";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad2 = (n) => String(n).padStart(2, "0");

/* ------------------------------------------------------------------ *
 *  Time-axis helpers (ticks follow the visible span)
 * ------------------------------------------------------------------ */
const TICK_STEPS = [
  MINUTE, 2 * MINUTE, 5 * MINUTE, 10 * MINUTE, 15 * MINUTE, 30 * MINUTE,
  HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR, DAY, 2 * DAY, 3 * DAY, 7 * DAY,
];
const tickStepFor = (spanMs) => TICK_STEPS.find((s) => spanMs / s <= 9) || TICK_STEPS[TICK_STEPS.length - 1];

// from / to: ms numbers or Dates
export function makeZoomTicks(from, to) {
  const fromMs = +from;
  const toMs = +to;
  const step = tickStepFor(toMs - fromMs);
  const ticks = [];
  if (step >= DAY) {
    const f = new Date(fromMs);
    const d = new Date(f.getFullYear(), f.getMonth(), f.getDate());
    if (d.getTime() < fromMs) d.setDate(d.getDate() + 1);
    for (; d.getTime() <= toMs; d.setDate(d.getDate() + step / DAY)) ticks.push(d.getTime());
    return ticks;
  }
  const offset = new Date(fromMs).getTimezoneOffset() * MINUTE;
  for (let t = Math.ceil((fromMs - offset) / step) * step + offset; t <= toMs; t += step) ticks.push(t);
  return ticks;
}

export function formatZoomTick(ts, from, to) {
  const span = +to - +from;
  const d = new Date(ts);
  if (tickStepFor(span) >= DAY) return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return span > 26 * HOUR ? `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${time}` : time;
}

export function formatZoomLabel(ts, from, to) {
  const d = new Date(ts);
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return +to - +from <= 26 * HOUR ? time : `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}, ${time}`;
}

// Bucket plan for a zoomed window: client bucket mode + backend bucket size.
// (Sizes are chosen so the backend never has to coarsen them, which would leave holes.)
export function zoomPlan(spanMs) {
  if (spanMs <= 33 * HOUR) return { mode: "today", intervalSeconds: 60 };
  if (spanMs <= 10 * DAY) return { mode: "week", intervalSeconds: 1800 };
  return { mode: "month", intervalSeconds: 1800 };
}

/* ------------------------------------------------------------------ *
 *  Toolbar
 * ------------------------------------------------------------------ */
export function ZoomToolbar({ z }) {
  return (
    <div className="chart-zoom-toolbar" role="group" aria-label="Zoom graph">
      <button type="button" className="chart-zoom-btn" onClick={() => z.zoomBy(0.5)} disabled={!z.canZoomIn} title="Zoom in" aria-label="Zoom in">
        <ZoomIn size={16} />
      </button>
      <button type="button" className="chart-zoom-btn" onClick={() => z.zoomBy(2)} disabled={!z.zoomed} title="Zoom out" aria-label="Zoom out">
        <ZoomOut size={16} />
      </button>
      <button type="button" className="chart-zoom-btn" onClick={() => z.panBy(-1)} disabled={!z.zoomed} title="Earlier" aria-label="Pan earlier">
        <ChevronLeft size={16} />
      </button>
      <button type="button" className="chart-zoom-btn" onClick={() => z.panBy(1)} disabled={!z.zoomed} title="Later" aria-label="Pan later">
        <ChevronRight size={16} />
      </button>
      <button type="button" className="chart-zoom-btn" onClick={z.reset} disabled={!z.zoomed} title="Reset zoom" aria-label="Reset zoom">
        <RotateCcw size={16} />
      </button>
    </div>
  );
}

// ref callback that attaches a NON-passive wheel listener (React's onWheel is passive,
// so it could not stop the browser from zooming the page).
function useWheelRef(onZoomWheel) {
  const latest = useRef(onZoomWheel);
  latest.current = onZoomWheel;
  const cleanup = useRef(null);
  return useCallback((node) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!node) return;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;      // plain wheel keeps scrolling the page
      e.preventDefault();
      latest.current(e.deltaY < 0 ? 0.7 : 1 / 0.7, e);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    cleanup.current = () => node.removeEventListener("wheel", onWheel);
  }, []);
}

/* ------------------------------------------------------------------ *
 *  Time zoom
 * ------------------------------------------------------------------ */
/**
 * @param baseFrom/baseTo  ms range of the selected period (the zoom-out limit)
 * @param resetKey         any string; zoom resets when it changes (filters, device ...)
 *
 * returns {
 *   zoom, zoomed, view:{from,to}, zoomBy, panBy, reset, canZoomIn,
 *   areaProps  -> spread on the div wrapping <ResponsiveContainer>
 *   chartProps -> spread on <LineChart>/<BarChart> (drag-to-zoom + hover tracking)
 *   sel        -> {a,b} drag selection in ms (draw with <ZoomSelection/>)
 *   pointer    -> {down(t), move(t), up(), hover(t)} for non-recharts surfaces
 * }
 */
export function useTimeZoom({ baseFrom, baseTo, resetKey = "", minSpan = MIN_ZOOM_SPAN }) {
  const [zoom, setZoom] = useState(null);
  const [sel, setSel] = useState(null);
  const hoverRef = useRef(null);

  const view = zoom || { from: baseFrom, to: baseTo };
  const total = baseTo - baseFrom;

  const setWindow = (center, span, frac = 0.5) => {
    const size = Math.min(Math.max(span, minSpan), total);
    if (size >= total - 1) return setZoom(null);
    let from = center - size * frac;
    from = Math.min(Math.max(from, baseFrom), baseTo - size);
    setZoom({ from, to: from + size });
  };

  const zoomBy = (factor, center) => {
    const span = view.to - view.from;
    const c = center != null && center >= view.from && center <= view.to ? center : view.from + span / 2;
    setWindow(c, span * factor, (c - view.from) / span);
  };

  const panBy = (dir) => {
    if (!zoom) return;
    const span = zoom.to - zoom.from;
    const from = Math.min(Math.max(zoom.from + dir * span * 0.5, baseFrom), baseTo - span);
    setZoom({ from, to: from + span });
  };

  const reset = () => {
    setZoom(null);
    setSel(null);
  };

  useEffect(() => {
    setZoom(null);
    setSel(null);
  }, [resetKey]);

  const pointer = {
    hover: (t) => { hoverRef.current = t; },
    down: (t) => { if (t != null) setSel({ a: t, b: t }); },
    move: (t) => {
      if (t == null) return;
      hoverRef.current = t;
      setSel((prev) => (prev ? { ...prev, b: t } : prev));
    },
    up: () => {
      if (sel) {
        const from = Math.min(sel.a, sel.b);
        const to = Math.max(sel.a, sel.b);
        if (to - from >= minSpan / 2) setWindow((from + to) / 2, to - from);
      }
      setSel(null);
    },
    leave: () => {
      hoverRef.current = null;
      setSel(null);
    },
  };

  const wheelRef = useWheelRef((factor) => zoomBy(factor, hoverRef.current));

  return {
    zoom,
    zoomed: !!zoom,
    view,
    zoomBy,
    panBy,
    reset,
    canZoomIn: view.to - view.from > minSpan + 1,
    sel,
    pointer,
    areaProps: { ref: wheelRef, className: "chart-zoom-area", onDoubleClick: reset, title: ZOOM_HINT },
    chartProps: {
      onMouseDown: (e) => pointer.down(e?.activeLabel),
      onMouseMove: (e) => pointer.move(e?.activeLabel),
      onMouseUp: pointer.up,
      onMouseLeave: pointer.leave,
    },
  };
}

// Drag rectangle for a numeric time axis.
export function ZoomSelection({ sel, yAxisId }) {
  if (!sel || sel.a === sel.b) return null;
  return (
    <ReferenceArea
      {...(yAxisId ? { yAxisId } : {})}
      x1={Math.min(sel.a, sel.b)}
      x2={Math.max(sel.a, sel.b)}
      fill="#2563eb"
      fillOpacity={0.12}
      stroke="#2563eb"
      strokeOpacity={0.35}
    />
  );
}

/* ------------------------------------------------------------------ *
 *  Category-axis zoom (bars per AC / zone, hourly or daily energy buckets)
 * ------------------------------------------------------------------ */
/**
 * <IndexZoomFrame data={rows} resetKey="...">
 *   {(visible, { chartProps, selection }) => <ResponsiveContainer>...</ResponsiveContainer>}
 * </IndexZoomFrame>
 *
 * `visible` is the slice of `data` inside the zoom window.  `selection` is
 * { x1, x2 } (the category values -- `nameKey`) of the drag in progress, or null.
 */
export function IndexZoomFrame({
  data,
  resetKey = "",
  nameKey = "name",
  minCount = 2,
  toolbar = true,
  children,
}) {
  const count = data.length;
  const [win, setWin] = useState(null);       // { start, end }  end exclusive
  const [sel, setSel] = useState(null);       // absolute indices
  const hoverRef = useRef(null);

  // keep the window valid when the data refreshes (or shrinks)
  const start = win ? Math.min(win.start, Math.max(count - 1, 0)) : 0;
  const end = win ? Math.min(Math.max(win.end, start + 1), count) : count;
  const zoomed = !!win && end - start < count;
  const visible = zoomed ? data.slice(start, end) : data;

  const setWindow = (s, e) => {
    const size = Math.max(e - s, Math.min(minCount, count));
    if (size >= count) return setWin(null);
    const from = Math.min(Math.max(Math.round(s), 0), count - size);
    setWin({ start: from, end: from + size });
  };

  const zoomBy = (factor, centerIdx) => {
    const size = end - start;
    const c = centerIdx != null && centerIdx >= start && centerIdx < end ? centerIdx : start + size / 2;
    const next = Math.max(size * factor, minCount);
    const frac = (c - start) / size;
    setWindow(c - next * frac, c - next * frac + next);
  };

  const panBy = (dir) => {
    if (!zoomed) return;
    const size = end - start;
    setWindow(start + dir * Math.max(1, Math.round(size / 2)), end + dir * Math.max(1, Math.round(size / 2)));
  };

  const reset = () => {
    setWin(null);
    setSel(null);
  };

  useEffect(reset, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const idxOf = (e) => (e && Number.isInteger(e.activeTooltipIndex) ? start + e.activeTooltipIndex : null);
  const wheelRef = useWheelRef((factor) => zoomBy(factor, hoverRef.current));

  const z = {
    zoomed,
    canZoomIn: end - start > minCount,
    zoomBy,
    panBy,
    reset,
  };

  const nameAt = (i) => data[i]?.[nameKey];
  const selection = sel && sel.a !== sel.b
    ? { x1: nameAt(Math.min(sel.a, sel.b)), x2: nameAt(Math.max(sel.a, sel.b)) }
    : null;

  const chartProps = {
    onMouseDown: (e) => {
      const i = idxOf(e);
      if (i != null) setSel({ a: i, b: i });
    },
    onMouseMove: (e) => {
      const i = idxOf(e);
      if (i == null) return;
      hoverRef.current = i;
      setSel((prev) => (prev ? { ...prev, b: i } : prev));
    },
    onMouseUp: () => {
      if (sel && Math.abs(sel.a - sel.b) >= 1) setWindow(Math.min(sel.a, sel.b), Math.max(sel.a, sel.b) + 1);
      setSel(null);
    },
    onMouseLeave: () => {
      hoverRef.current = null;
      setSel(null);
    },
  };

  return (
    <div>
      {toolbar && count > minCount && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
          <ZoomToolbar z={z} />
        </div>
      )}
      <div ref={wheelRef} className="chart-zoom-area" onDoubleClick={reset} title={ZOOM_HINT}>
        {children(visible, { chartProps, selection, zoomed })}
      </div>
    </div>
  );
}
