import { useState, useEffect } from "react";
import { buildHierarchy } from "./buildHierarchy";

function useProfileData(currentUser) {
    const [user, setUser] = useState(currentUser || {});
    const [tree, setTree] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [source, setSource] = useState("api");

    useEffect(() => {
        let isMounted = true;

        const loadData = async () => {
            setLoading(true);
            setError(null);

            try {
                const token = localStorage.getItem("token") || localStorage.getItem("authToken");
                
                // --- FETCH YOUR API DATA HERE ---
                // Example: Fetch the flat ac-data rows
                const response = await fetch("http://localhost:8000/api/ac-data/", {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });

                if (!response.ok) {
                    throw new Error(`Failed to load data: HTTP ${response.status}`);
                }

                const payload = await response.json();
                
                // Pass the data to the tree builder (accepts flat array or nested object)
                const builtTree = buildHierarchy(payload);

                if (isMounted) {
                    setTree(builtTree);
                    setSource("api");
                }
            } catch (err) {
                if (isMounted) {
                    console.error("[useProfileData] Error:", err);
                    setError(err.message || "An error occurred while loading profile data.");
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        loadData();

        return () => {
            isMounted = false;
        };
    }, [currentUser]);

    return { user, tree, loading, error, source };
}

export default useProfileData;