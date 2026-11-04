import { useState, useEffect } from "react";
import { buildHierarchy } from "./buildHierarchy";

const API_BASE = (
    import.meta.env.VITE_API_BASE ||
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:8000/api"
).replace(/\/$/, "");

function authHeaders() {
    const token = ["token", "authToken", "access_token", "accessToken", "jwt"]
        .map((key) => localStorage.getItem(key) || sessionStorage.getItem(key))
        .find(Boolean);
    return {
        Accept: "application/json",
        ...(token ? {
            Authorization: token.startsWith("Bearer ") || token.startsWith("Token ")
                ? token
                : `Bearer ${token}`,
        } : {}),
    };
}

function useProfileData(currentUser) {
    const [user, setUser] = useState(currentUser || {});
    const [tree, setTree] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [source, setSource] = useState("api");

    useEffect(() => {
        const controller = new AbortController();

        const loadData = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`${API_BASE}/profile/`, {
                    method: "GET",
                    headers: authHeaders(),
                    cache: "no-store",
                    signal: controller.signal,
                });

                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(
                        payload?.detail || payload?.message ||
                        `Profile API returned HTTP ${response.status}.`
                    );
                }

                const profileUser = payload?.user || currentUser || {};
                const hierarchy = buildHierarchy(payload);

                setUser(profileUser);
                setTree(hierarchy);
                setSource("api");
            } catch (err) {
                if (err.name !== "AbortError") {
                    console.error("[useProfileData] Error:", err);
                    setError(err.message || "Unable to load profile information.");
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        loadData();
        return () => controller.abort();
    }, [currentUser]);

    return { user, tree, loading, error, source };
}

export default useProfileData;
