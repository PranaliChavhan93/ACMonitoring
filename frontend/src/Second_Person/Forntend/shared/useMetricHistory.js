import { useEffect, useState } from "react";

import { HISTORY_URL, getJSON, scopeToParams } from "./api";
import { getViewRange, refreshMsFor, requestFor, rowsToPoints } from "./metricHistory";

/**
 * Reads one metric's history from the backend database and keeps it fresh.
 *
 *   const { points, range, loading, error, updatedAt } =
 *     useMetricHistory({ metric: "voltage", viewMode, selectedHour, deviceId, scope });
 *
 * - one effect, one timer: changing any input aborts the old request first
 * - on a failed refresh the previous points stay on screen (error is reported)
 * - never calls ThingsBoard/3TP; the backend answers from telemetry_aggregate
 */
export function useMetricHistory({
  metric,
  viewMode = "today",
  selectedHour = 0,
  customFrom = "",
  customTo = "",
  deviceId = "",
  scope = {},
  agg = "avg",
  windowMs = 0,   // > 0: rolling "last N ms" window (live graphs) instead of viewMode
  refreshMs = 0,  // override the polling interval
}) {
  const [points, setPoints] = useState([]);
  const [range, setRange] = useState(() => getViewRange(viewMode, selectedHour, new Date(), customFrom, customTo));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);

  const scopeJson = JSON.stringify(scope || {});

  useEffect(() => {
    let controller = null;
    let disposed = false;

    setPoints([]);
    setError("");
    setLoading(true);

    const run = async () => {
      controller?.abort();
      controller = new AbortController();
      const { signal } = controller;

      const now = new Date();
      const nextRange = windowMs
        ? { from: now.getTime() - windowMs, to: now.getTime() }
        : getViewRange(viewMode, selectedHour, now, customFrom, customTo);
      const { period, intervalSeconds } = requestFor(windowMs ? "today" : viewMode);
      const params = new URLSearchParams({
        key: metric,
        agg,
        period,
        interval_seconds: String(intervalSeconds),
        from: String(nextRange.from),
        to: String(nextRange.to),
      });
      if (deviceId) params.set("device_id", String(deviceId));
      else scopeToParams(JSON.parse(scopeJson), params);

      try {
        const result = await getJSON(`${HISTORY_URL}?${params}`, signal);
        if (disposed || signal.aborted) return;
        setPoints(rowsToPoints(result));
        setRange(nextRange);
        setError("");
        setUpdatedAt(Date.now());
      } catch (err) {
        if (err?.name === "AbortError" || disposed) return;
        setRange(nextRange);
        setError(err?.message || `Unable to load ${metric} history.`);
      } finally {
        if (!disposed && !signal.aborted) setLoading(false);
      }
    };

    run();
    const timer = window.setInterval(() => {
      if (!document.hidden) run();
    }, refreshMs || refreshMsFor(viewMode));
    const onVisible = () => {
      if (!document.hidden) run();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [metric, viewMode, selectedHour, customFrom, customTo, deviceId, scopeJson, agg, windowMs, refreshMs]);

  return { points, range, loading, error, updatedAt };
}
