
import { useState } from "react";
import "./AIAssistantPanel.css";

const AI_BASE =
    import.meta.env.VITE_AI_API_BASE || "http://127.0.0.1:9000";

const ANALYSIS_SECTIONS = [
    "KPI",
    "Energy",
    "Power",
    "Trend",
    "Zone",
    "State",
    "City",
    "Branch",
    "Floor",
    "AC Health",
    "Alerts",
];

async function apiRequest(path, options = {}) {
    const response = await fetch(`${AI_BASE}${path}`, {
        ...options,
        headers: {
        "Content-Type": "application/json",
        ...options.headers,
        },
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
        result.detail || result.message || `Request failed (${response.status})`
        );
    }

    return result;
}

function parseAnalysis(text = "") {
    const sections = {};
    let current = "";

    for (const line of text.split("\n")) {
        const trimmed = line.trim();

        const match = ANALYSIS_SECTIONS.find((section) =>
        trimmed.startsWith(`${section}:`)
        );

        if (match) {
        current = match;
        sections[current] = trimmed.slice(match.length + 1).trim();
        } else if (current && trimmed) {
        sections[current] += ` ${trimmed}`;
        }
    }

    return sections;
}

function AIAssistantPanel({
    dashboardData = {},
}) {
    const [activeTab, setActiveTab] = useState("analysis");
    const [analysis, setAnalysis] = useState("");
    const [model, setModel] = useState("");
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);
    const [error, setError] = useState("");

    const [question, setQuestion] = useState("");
    const [answer, setAnswer] = useState("");
    const [asking, setAsking] = useState(false);

    const [maintenanceForm, setMaintenanceForm] = useState({
        ac_id: "",
        maintenance_type: "Preventive",
        maintenance_date: new Date().toISOString().slice(0, 10),
        problem: "",
        duration_minutes: 0,
        notes: "",
    });

    const [maintenanceAcId, setMaintenanceAcId] = useState("");
    const [maintenanceRecords, setMaintenanceRecords] = useState([]);
    const [maintenanceSummary, setMaintenanceSummary] = useState(null);
    const [maintenanceMessage, setMaintenanceMessage] = useState("");
    const [maintenanceLoading, setMaintenanceLoading] = useState(false);

    const generateAnalysis = async () => {
        setLoadingAnalysis(true);
        setError("");
        setAnalysis("");

        try {
            const result = await apiRequest("/api/analyze-dashboard", {
                method: "POST",
                body: JSON.stringify({
                dashboard_name: "AC Energy Monitoring",
                generated_at: new Date().toISOString(),
                ...dashboardData,
                }),
            });

            setAnalysis(result.analysis || "");
            setModel(result.model || "");
            } catch (err) {
                setError(err.message || "Could not analyze the dashboard.");
            } finally {
                setLoadingAnalysis(false);
        }
    };

    const askQuestion = async (event) => {
        event.preventDefault();

        if (!question.trim()) return;

        setAsking(true);
        setError("");
        setAnswer("");

        try {
            const result = await apiRequest("/api/ask-dashboard", {
                method: "POST",
                body: JSON.stringify({
                question: question.trim(),
                dashboard: dashboardData,
                }),
            });

                setAnswer(result.answer || "No answer returned.");
                setModel(result.model || "");
            } catch (err) {
                setError(err.message || "Could not answer the question.");
            } finally {
                setAsking(false);
        }
    };

    const loadMaintenance = async () => {
        if (!maintenanceAcId.trim()) {
            setMaintenanceMessage("Enter an AC ID first.");
            return;
        }

        setMaintenanceLoading(true);
        setMaintenanceMessage("");

        try {
        const id = encodeURIComponent(maintenanceAcId.trim());

        const [history, summary] = await Promise.all([
            apiRequest(`/api/maintenance?ac_id=${id}&limit=100`),
            apiRequest(`/api/maintenance/summary?ac_id=${id}`),
        ]);

        setMaintenanceRecords(history.records || []);
        setMaintenanceSummary(summary.summary ?? summary);
        setMaintenanceMessage("");
        } catch (err) {
            setMaintenanceMessage(err.message);
            setMaintenanceRecords([]);
            setMaintenanceSummary(null);
        } finally {
            setMaintenanceLoading(false);
        }
    };

    const saveMaintenance = async (event) => {
        event.preventDefault();
        setMaintenanceMessage("");

        try {
            const result = await apiRequest("/api/maintenance", {
                method: "POST",
                body: JSON.stringify({
                ...maintenanceForm,
                duration_minutes: Number(
                    maintenanceForm.duration_minutes
                ),
            }),
        });

        setMaintenanceMessage(
            result.message || "Maintenance record saved."
        );

        setMaintenanceAcId(maintenanceForm.ac_id);
        await loadMaintenance();
        } catch (err) {
            setMaintenanceMessage(err.message);
        }
    };

    const sections = parseAnalysis(analysis);

    return (
        <section className="ai-panel">
        <div className="ai-panel-header">
            <div>
                <h2>AI & Maintenance Intelligence</h2>
                <p>
                    Dashboard analysis, operational insights, and service history
                </p>
            </div>

            <button
                className="ai-primary-button"
                onClick={generateAnalysis}
                disabled={loadingAnalysis}
            >
                {loadingAnalysis ? "Analyzing..." : "Analyze Dashboard"}
            </button>
        </div>

        <div className="ai-tabs">
            {[
                ["analysis", "AI Analysis"],
                ["questions", "Ask AI"],
                ["maintenance", "Maintenance"],
                ].map(([value, label]) => (
                <button
                    key={value}
                    className={activeTab === value ? "active" : ""}
                    onClick={() => setActiveTab(value)}
                >
                    {label}
                </button>
            ))}
        </div>

        {error && <div className="ai-error">{error}</div>}

        {activeTab === "analysis" && (
            <div className="ai-content">
            {!analysis && !loadingAnalysis && (
                <p className="ai-empty">
                    Select Analyze Dashboard to generate insights from the
                    current dashboard data.
                </p>
            )}

            {loadingAnalysis && (
                <p className="ai-empty">
                    Analyzing energy, power, trends, locations, and AC health...
                </p>
            )}

            {analysis && (
                <>
                <div className="ai-result-meta">
                    <span>Generated analysis</span>
                    {model && <span>Model: {model}</span>}
                </div>

                <div className="ai-analysis-grid">
                    {ANALYSIS_SECTIONS.map((section) => (
                    <article className="ai-insight-card" key={section}>
                        <h3>{section}</h3>
                        <p>
                        {sections[section] ||
                            "No information returned for this section."}
                        </p>
                    </article>
                    ))}
                </div>

                <details className="ai-raw-result">
                    <summary>View complete AI response</summary>
                    <pre>{analysis}</pre>
                </details>
                </>
            )}
            </div>
        )}

        {activeTab === "questions" && (
            <div className="ai-content">
            <h3>Ask about the current dashboard</h3>

            <form onSubmit={askQuestion} className="ai-question-form">
                <textarea
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="e.g. Which branch has the highest energy consumption?"
                    rows={3}
                    maxLength={2000}
                    required
                />

                <button
                    className="ai-primary-button"
                    disabled={asking || !question.trim()}
                >
                    {asking ? "Thinking..." : "Ask AI"}
                </button>
            </form>

            {answer && (
                <article className="ai-answer">
                    <h3>AI Answer</h3>
                    <p>{answer}</p>
                </article>
            )}
            </div>
        )}

        {activeTab === "maintenance" && (
            <div className="ai-content">
                <div className="ai-maintenance-grid">
                    <form
                            className="ai-maintenance-form"
                            onSubmit={saveMaintenance}
                        >
                        <h3>Record Maintenance</h3>

                        <label> AC ID
                            <input
                                required
                                maxLength={100}
                                value={maintenanceForm.ac_id}
                                onChange={(e) =>
                                    setMaintenanceForm({
                                    ...maintenanceForm,
                                    ac_id: e.target.value,
                                    })
                                }
                            />
                        </label>

                        <label> Maintenance Type
                            <select
                                value={maintenanceForm.maintenance_type}
                                onChange={(e) =>
                                    setMaintenanceForm({
                                    ...maintenanceForm,
                                    maintenance_type: e.target.value,
                                    })
                                }
                            >
                            <option>Preventive</option>
                            <option>Corrective</option>
                            <option>Inspection</option>
                            <option>Repair</option>
                            <option>Other</option>
                            </select>
                        </label>

                        <label> Maintenance Date
                            <input
                                type="date"
                                required
                                value={maintenanceForm.maintenance_date}
                                onChange={(e) =>
                                    setMaintenanceForm({
                                    ...maintenanceForm,
                                    maintenance_date: e.target.value,
                                    })
                                }
                            />
                        </label>

                        <label> Problem / Service Performed
                            <textarea
                                required
                                maxLength={2000}
                                rows={3}
                                value={maintenanceForm.problem}
                                onChange={(e) =>
                                    setMaintenanceForm({
                                    ...maintenanceForm,
                                    problem: e.target.value,
                                    })
                                }
                            />
                        </label>

                        <label> Duration (minutes)
                            <input
                                type="number"
                                min="0"
                                value={maintenanceForm.duration_minutes}
                                onChange={(e) =>
                                    setMaintenanceForm({
                                    ...maintenanceForm,
                                    duration_minutes: e.target.value,
                                    })
                                }
                            />
                        </label>

                        <label> Notes
                            <textarea
                                rows={2}
                                maxLength={2000}
                                value={maintenanceForm.notes}
                                onChange={(e) =>
                                    setMaintenanceForm({
                                    ...maintenanceForm,
                                    notes: e.target.value,
                                    })
                                }
                            />
                        </label>

                        <button className="ai-primary-button">
                            Save Maintenance
                        </button>
                    </form>

                    <div className="ai-maintenance-history">
                        <h3>Maintenance History</h3>

                        <form
                            className="ai-history-search"
                            onSubmit={(e) => {
                            e.preventDefault();
                            loadMaintenance();
                            }}
                        >
                            <input
                                placeholder="Enter AC ID"
                                value={maintenanceAcId}
                                onChange={(e) => setMaintenanceAcId(e.target.value)}
                                required
                            />
                            <button
                                className="ai-primary-button"
                                disabled={maintenanceLoading}
                            >
                                {maintenanceLoading ? "Loading..." : "Load History"}
                            </button>
                        </form>

                        {maintenanceMessage && (
                            <p className="ai-message">{maintenanceMessage}</p>
                        )}

                        {maintenanceSummary && (
                            <article className="ai-summary-card">
                                <h4>Maintenance Summary</h4>
                                <pre>
                                    {JSON.stringify(maintenanceSummary, null, 2)}
                                </pre>
                            </article>
                        )}

                        {maintenanceRecords.length > 0 ? (
                            <div className="ai-record-list">
                                {maintenanceRecords.map((record, index) => (
                                    <article
                                        className="ai-record"
                                        key={record.id ?? `${record.ac_id}-${index}`}
                                    >
                                    <strong>
                                        {record.maintenance_type || "Maintenance"}
                                    </strong>
                                    <p>{record.problem}</p>
                                    <small>
                                        {record.maintenance_date} ·{" "}
                                        {record.duration_minutes ?? 0} minutes
                                    </small>
                                        {record.notes && <p>{record.notes}</p>}
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <p className="ai-empty">
                                Load a specific AC's maintenance history.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        )}
        </section>
    );
}

export default AIAssistantPanel;
