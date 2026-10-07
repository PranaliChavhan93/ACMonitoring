# import os
# from typing import Any, Dict
# from dotenv import load_dotenv
# from fastapi import FastAPI, HTTPException
# from fastapi.middleware.cors import CORSMiddleware
# from pydantic import BaseModel, Field
# from ai_analyzer import analyze_dashboard

# load_dotenv()

# app = FastAPI(
#     title="AC Dashboard GenAI Analyzer",
#     version="1.0.0",
#     description="Analyzes live AC dashboard state using Groq-hosted GenAI."
# )

# origins_raw = os.getenv("CORS_ORIGINS", "*")
# origins = ["*"] if origins_raw.strip() == "*" else [
#     x.strip() for x in origins_raw.split(",") if x.strip()
# ]

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=origins,
#     allow_credentials=False if origins == ["*"] else True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )


# class DashboardPayload(BaseModel):
#     dashboard_name: str = "AC Energy Dashboard"
#     generated_at: str | None = None
#     filters: Dict[str, Any] = Field(default_factory=dict)
#     kpis: Dict[str, Any] = Field(default_factory=dict)
#     trends: Any = Field(default_factory=list)
#     zones: Any = Field(default_factory=list)
#     states: Any = Field(default_factory=list)
#     cities: Any = Field(default_factory=list)
#     branches: Any = Field(default_factory=list)
#     floors: Any = Field(default_factory=list)
#     ac_health: Any = Field(default_factory=list)
#     alerts: Any = Field(default_factory=list)
#     tables: Any = Field(default_factory=list)
#     additional_data: Dict[str, Any] = Field(default_factory=dict)


# @app.get("/")
# def root():
#     return {
#         "service": "AC Dashboard GenAI Analyzer",
#         "status": "running",
#         "model": os.getenv("GROQ_MODEL", "openai/gpt-oss-120b"),
#         "endpoint": "/api/analyze-dashboard"
#     }


# @app.get("/health")
# def health():
#     return {"status": "healthy"}


# @app.post("/api/analyze-dashboard")
# def dashboard_analysis(payload: DashboardPayload):
#     try:
#         result = analyze_dashboard(payload.model_dump())
#         return {
#             "success": True,
#             "analysis": result,
#             "model": os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
#         }
#     except Exception as exc:
#         raise HTTPException(status_code=500, detail=str(exc))



import os
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ai_analyzer import analyze_dashboard


load_dotenv()


app = FastAPI(
    title="AC Dashboard GenAI Analyzer",
    description="Live AC dashboard analysis using Groq GenAI",
    version="2.0.0",
)


# ============================================================
# CORS
# ============================================================

cors_origins = os.getenv("CORS_ORIGINS", "*")

if cors_origins.strip() == "*":
    allowed_origins = ["*"]
else:
    allowed_origins = [
        origin.strip()
        for origin in cors_origins.split(",")
        if origin.strip()
    ]


app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# DASHBOARD REQUEST MODEL
# ============================================================

class DashboardAnalysisRequest(BaseModel):

    dashboard_name: str = "AC Energy Monitoring"

    generated_at: Optional[str] = None

    # Current dashboard filters
    filters: Dict[str, Any] = Field(default_factory=dict)

    # KPI cards
    kpis: Dict[str, Any] = Field(default_factory=dict)

    # Rolling / historical trend data
    trends: List[Any] = Field(default_factory=list)

    # Location information
    zones: List[Any] = Field(default_factory=list)
    states: List[Any] = Field(default_factory=list)
    cities: List[Any] = Field(default_factory=list)
    branches: List[Any] = Field(default_factory=list)
    floors: List[Any] = Field(default_factory=list)

    # AC health
    ac_health: Any = Field(default_factory=list)

    # Alerts
    alerts: List[Any] = Field(default_factory=list)

    # Raw AC data if required
    ac_data: List[Any] = Field(default_factory=list)

    # Other dashboard information
    tables: List[Any] = Field(default_factory=list)

    additional_data: Dict[str, Any] = Field(default_factory=dict)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "service": "AC Dashboard GenAI Analyzer",
        "status": "running",
        "model": os.getenv(
            "GROQ_MODEL",
            "openai/gpt-oss-120b"
        ),
        "endpoint": "/api/analyze-dashboard",
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
def health():

    return {
        "status": "healthy",
        "groq_configured": bool(
            os.getenv("GROQ_API_KEY")
        ),
        "model": os.getenv(
            "GROQ_MODEL",
            "openai/gpt-oss-120b"
        ),
    }


# ============================================================
# DASHBOARD ANALYSIS
# ============================================================

@app.post("/api/analyze-dashboard")
async def analyze_live_dashboard(
    payload: DashboardAnalysisRequest
):

    try:

        dashboard_data = payload.model_dump()

        analysis = analyze_dashboard(
            dashboard_data
        )

        return {
            "success": True,
            "dashboard_name": payload.dashboard_name,
            "generated_at": payload.generated_at,
            "model": os.getenv(
                "GROQ_MODEL",
                "openai/gpt-oss-120b"
            ),
            "analysis": analysis,
        }

    except Exception as exc:

        print("AI ANALYSIS ERROR:")
        print(str(exc))

        raise HTTPException(
            status_code=500,
            detail=str(exc)
        )