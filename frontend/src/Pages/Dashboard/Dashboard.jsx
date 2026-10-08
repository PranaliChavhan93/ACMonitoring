import { useEffect, useState } from "react";

import Header from "../../Second_Person/src/compenents/header";
import SummaryCards from "../../Second_Person/src/compenents/summarycards";
import ACCharts from "../../Second_Person/src/compenents/ACCharts";
import ACTable from "../../Second_Person/src/compenents/ACTable";

const API_URL = "http://192.168.1.14:8000/api/ac-data/";

function Dashboard() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchACData = async () => {
        try {
            const response = await fetch(`${API_URL}?t=${Date.now()}`, {
                cache: "no-store",
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            console.log("AC API RESPONSE:", result);

            // Django returns:
            // { status: "success", count: 4, data: [...] }
            // We need only the data array.
            const acData = Array.isArray(result)
                ? result
                : Array.isArray(result.data)
                    ? result.data
                    : [];

            console.log("AC DATA ARRAY:", acData);

            setData(acData);
            setError("");
        } catch (err) {
            console.error("AC API ERROR:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchACData();

        // Fetch new data every 2 seconds
        const interval = setInterval(fetchACData, 2000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div>
            <h1>Welcome To Dashboard</h1>

            {loading && (
                <p>Loading AC data...</p>
            )}

            {error && (
                <p style={{ color: "red" }}>
                    AC API Error: {error}
                </p>
            )}

            {!loading && !error && (
                <>
                    <Header />

                    <SummaryCards data={data} />

                    <ACCharts data={data} />

                    <ACTable data={data} />
                </>
            )}
        </div>
    );
}

export default Dashboard;