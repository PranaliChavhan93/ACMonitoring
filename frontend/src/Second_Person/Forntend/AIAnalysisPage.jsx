import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./aiAnalysis.css";

function AIAnalysisPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const payload = location.state?.payload || null;

    const [analysis, setAnalysis] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!payload) return;

        let cancelled = false;

        const run = async () => {
            setLoading(true);
            setError("");
            try {
                const response = await fetch(
                    "http://localhost:9000/api/analyze-dashboard",
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    }
                );

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.detail || "AI analysis failed");
                }
                if (!cancelled) setAnalysis(result.analysis || "");
            } catch (err) {
                if (!cancelled) setError(err.message || "AI analysis failed");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [payload]);

    const handleBack = () => {
        if (window.history.length > 1) navigate(-1);
        else navigate("/org/dashboard");
    };

    if (!payload) {
        return (
            <div className="ai-analysis-page">
                <div className="ai-analysis-page-header">
                    <button type="button" className="back-button" onClick={handleBack}>
                        ← Back
                    </button>
                    <div>
                        <h1>AI Dashboard Analysis</h1>
                        <p>No payload available</p>
                    </div>
                </div>

                <div className="ai-analysis-empty">
                    <p>
                        This page needs to be opened from the dashboard so it can
                        receive the current filter and KPI data.
                    </p>
                    <button
                        type="button"
                        className="trends-button"
                        onClick={() => navigate("/org/dashboard")}
                    >
                        Go to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const filterSummary =
        payload.filters && Object.keys(payload.filters).length
            ? Object.entries(payload.filters)
                  .filter(([, v]) => v)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join("  •  ")
            : "All Locations";

    return (
        <div className="ai-analysis-page">
            <div className="ai-analysis-page-header">
                <div>
                    <h1>AI Dashboard Analysis</h1>
                    <p>{filterSummary}</p>
                </div>
                <button type="button" className="back-button" onClick={handleBack}>
                    ← Back
                </button>
            </div>

            {loading && (
                <div className="ai-analysis-loading">
                    <span className="ai-spinner" />
                    <p>Analyzing dashboard data…</p>
                </div>
            )}

            {error && !loading && (
                <div className="ai-analysis-error">
                    <strong>Analysis failed:</strong> {error}
                </div>
            )}

            {analysis && !loading && (
                <div className="ai-analysis-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {analysis}
                    </ReactMarkdown>
                </div>
            )}
        </div>
    );
}

export default AIAnalysisPage;
