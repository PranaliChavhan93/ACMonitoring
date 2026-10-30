// Single place for the backend address and auth token.
// Set VITE_API_BASE in .env (e.g. VITE_API_BASE=http://192.168.1.6:8000/api) to override.
export const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  "http://localhost:8000/api";

// Chart history is served by the backend from its own database (telemetry_aggregate).
export const HISTORY_URL = `${API_BASE}/current-history/`;
export const AGGREGATES_URL = `${API_BASE}/telemetry-aggregates/`;

export const getToken = () =>
  ["token", "authToken", "access_token", "accessToken"]
    .map((k) => {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    })
    .find(Boolean) || "";

// Only plain, non-empty string filters are forwarded as query parameters.
export function scopeToParams(scope, params = new URLSearchParams()) {
  Object.entries(scope || {}).forEach(([key, value]) => {
    if (typeof value === "string" && value.trim()) params.set(key, value);
  });
  return params;
}

export async function getJSON(url, signal) {
  const token = getToken();
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
    signal,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.message || result?.detail || `HTTP ${response.status}`);
  }
  return result;
}
