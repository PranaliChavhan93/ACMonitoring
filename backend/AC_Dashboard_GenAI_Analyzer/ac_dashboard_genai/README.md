# AC Dashboard GenAI Analyzer

Standalone GenAI service for analyzing a LIVE AC dashboard without screenshots.

## What it does

Your friend's React dashboard sends its current dashboard state as JSON to this service.

```text
React AC Dashboard
        |
        | dashboard JSON
        v
FastAPI GenAI Analyzer
        |
        v
Groq API
        |
        v
AI Dashboard Analysis
```

The AI analyzes:
- KPI cards
- energy and power trends
- AC health
- state/city/branch/floor consumption
- anomalies and alerts
- temperature/humidity
- comparisons
- top/bottom consuming areas
- recommendations

## Model

Default model:

`openai/gpt-oss-120b`

Groq currently lists GPT-OSS 120B as a production model with a 131,072-token context window and reasoning support. The model can be changed through `.env` without changing application code.

## 1. Install

Python 3.10+ recommended.

```bash
cd backend
python -m venv venv
```

Windows:

```bash
venv\Scripts\activate
```

Install:

```bash
pip install -r requirements.txt
```

## 2. Add Groq API key

Copy `.env.example` to `.env`.

```env
GROQ_API_KEY=YOUR_GROQ_API_KEY
GROQ_MODEL=openai/gpt-oss-120b
```

Do NOT put the API key in React.

## 3. Start the service

```bash
uvicorn app:app --reload --host 0.0.0.0 --port 9000
```

Open:

`http://localhost:9000/docs`

## 4. Test it

```bash
python test_api.py
```

Or:

```bash
curl -X POST http://localhost:9000/api/analyze-dashboard \
  -H "Content-Type: application/json" \
  -d @../sample/dashboard_payload.json
```

## 5. Connect your friend's React dashboard

The dashboard should send the data it is already displaying.

Example:

```javascript
const response = await fetch("http://YOUR-PC-IP:9000/api/analyze-dashboard", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    dashboard_name: "AC Energy Dashboard",
    generated_at: new Date().toISOString(),
    filters: {
      state: selectedState,
      city: selectedCity,
      branch: selectedBranch,
      floor: selectedFloor
    },
    kpis: {
      total_ac: totalACs,
      active_ac: activeACs,
      total_energy_kwh: totalEnergy,
      active_energy_kwh: activeEnergy
    },
    trends: energyTrendData,
    zones: zoneData,
    branches: branchData,
    alerts: alerts,
    ac_health: acHealth
  })
});

const result = await response.json();
console.log(result.analysis);
```

### Important

The AI does NOT need a screenshot.

The dashboard already has the values needed to render the screen. Send those values as JSON.

## Recommended architecture

Do not call the LLM every 2 seconds.

Use:

```text
Telemetry: every 2 sec
       |
Dashboard aggregation: 1 min
       |
User clicks "Analyze Dashboard"
       |
OR trigger analysis when a meaningful anomaly occurs
       |
GenAI
```

This reduces API cost and avoids unnecessary repeated analysis.

## Response

The API returns:

```json
{
  "success": true,
  "analysis": "...",
  "model": "openai/gpt-oss-120b"
}
```

The prompt instructs the model to provide:
1. Executive summary
2. Energy consumption analysis
3. Operational/AC health analysis
4. Trend analysis
5. Anomalies
6. Area/branch analysis
7. Recommendations
8. Priority actions

The model is instructed not to invent missing values and to explicitly say when information is unavailable.

## Network setup for your friend

If the FastAPI service is running on your PC and the React dashboard is on another PC, both PCs must be on the same network.

Find your PC IP:

```bash
ipconfig
```

Then your friend calls:

```text
http://YOUR_PC_IP:9000/api/analyze-dashboard
```

Example:

```text
http://192.168.1.8:9000/api/analyze-dashboard
```

Allow TCP port 9000 through Windows Firewall if required.

## CORS

CORS is enabled for development. For production, restrict `allow_origins` in `app.py` to your friend's dashboard URL.

## Files

- `backend/app.py` - FastAPI API
- `backend/ai_analyzer.py` - Groq/LLM logic and prompt
- `backend/requirements.txt` - dependencies
- `backend/.env.example` - configuration template
- `backend/test_api.py` - local test
- `sample/dashboard_payload.json` - sample dashboard data
- `frontend-example/dashboardAnalyzer.js` - React integration helper
