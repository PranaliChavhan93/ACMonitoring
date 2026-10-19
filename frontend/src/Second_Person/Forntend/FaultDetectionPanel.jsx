import React, { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE = "http://192.168.1.5:8000/api";

const DEFAULT_3TP_DEVICE_ID = "fdf8b310-c3d9-11f1-9fbd-e7ab598bb869";
const KEYS = ["fault", "fault_type", "reason", "recommendation", "severity"];

function tokenFromStorage() {
    return localStorage.getItem("token") || localStorage.getItem("authToken") ||
        localStorage.getItem("access_token") || localStorage.getItem("accessToken") || "";
}

function displayValue(value) {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

function isFaultActive(row) {
    const value = String(row.fault ?? "").trim().toLowerCase();
    if (!value) return false;
    return !["0", "false", "none", "no fault", "normal", "null", "n/a"].includes(value);
}

function severityClass(value) {
    const severity = String(value ?? "unknown").toLowerCase();
    if (severity.includes("critical") || severity.includes("high") || severity.includes("severe")) return "fault-severity fault-severity--critical";
    if (severity.includes("medium") || severity.includes("warning") || severity.includes("moderate")) return "fault-severity fault-severity--warning";
    if (severity.includes("low") || severity.includes("info") || severity.includes("minor")) return "fault-severity fault-severity--low";
    return "fault-severity";
}

function FaultDetectionPanel({ data = [], refreshMs = 2000 }) {
    const [payload, setPayload] = useState({ data: [], count: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const deviceId = useMemo(() => {
        const item = (Array.isArray(data) ? data : []).find((row) =>
            row?.tpt_device_id || row?.device_id || row?.device_uuid
        );
        return item?.tpt_device_id || item?.device_id || item?.device_uuid || DEFAULT_3TP_DEVICE_ID;
    }, [data]);

    const fetchFaults = useCallback(async (signal) => {
        try {
            const token = tokenFromStorage();
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const url = new URL(`${API_BASE}/ac-faults/`);
            url.searchParams.set("device_id", deviceId);
            const response = await fetch(url.toString(), { headers, signal });
            const result = await response.json();
            if (!response.ok || result?.status === "error") {
                throw new Error(result?.message || `Request failed (${response.status})`);
            }
            setPayload({ data: Array.isArray(result.data) ? result.data : [], count: result.count ?? 0 });
            setError("");
        } catch (err) {
            if (err.name !== "AbortError") setError(err.message || "Unable to load fault data.");
        } finally {
            setLoading(false);
        }
    }, [deviceId]);

    useEffect(() => {
        const controller = new AbortController();
        fetchFaults(controller.signal);
        const timer = window.setInterval(() => fetchFaults(controller.signal), refreshMs);
        return () => {
            controller.abort();
            window.clearInterval(timer);
        };
    }, [fetchFaults, refreshMs]);

    const latestRecord = useMemo(
        () => payload.data.length ? payload.data[0] : null,
        [payload.data]
    );

    const faults = useMemo(
        () => latestRecord && isFaultActive(latestRecord)
            ? [latestRecord]
            : [],
        [latestRecord]
    );
    return (
        <section className="fault-panel chart-box">
            <div className="fault-panel__header">
                <div>
                    <h3>⚠️ Processed Fault Detection</h3>
                    <p>Fault analysis and recommendations received</p>
                </div>
                <span className="fault-panel__count">{faults.length} active fault{faults.length === 1 ? "" : "s"}</span>
            </div>

            {loading && !payload.data.length ? <p className="fault-panel__message">Loading processed fault data…</p> : null}
            {error ? <p className="fault-panel__error">{error}</p> : null}
            {!loading && !error && faults.length === 0 ? (
                <p className="fault-panel__message">No active faults were reported for this device.</p>
            ) : null}

            {faults.length > 0 ? (
                <div className="fault-panel__list">
                    {faults.map((row, index) => (
                        <article className="fault-card" key={`${row.timestamp ?? "fault"}-${index}`}>
                            <div className="fault-card__top">
                                <strong>{displayValue(row.fault_type || row.fault || "Detected fault")}</strong>
                                <span className={severityClass(row.severity)}>{displayValue(row.severity)}</span>
                            </div>
                            <p><b>Fault:</b> {displayValue(row.fault)}</p>
                            <p><b>Reason:</b> {displayValue(row.reason)}</p>
                            <p><b>Recommendation:</b> {displayValue(row.recommendation)}</p>
                            {row.timestamp ? <small>{new Date(Number(row.timestamp)).toLocaleString()}</small> : null}
                        </article>
                    ))}
                </div>
            ) : null}
            <small className="fault-panel__footer">· Refreshes every {Math.round(refreshMs / 1000)} seconds · {KEYS.join(", ")}</small>
        </section>
    );
}

export default FaultDetectionPanel;