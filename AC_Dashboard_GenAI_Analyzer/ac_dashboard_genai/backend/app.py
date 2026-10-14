import os
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ai_analyzer import (
    analyze_dashboard,
    answer_dashboard_question,
)

from maintenance_store import (
    create_maintenance_record,
    list_maintenance_records,
    get_maintenance_summary,
)


# ============================================================
# ENVIRONMENT CONFIGURATION
# ============================================================

load_dotenv()

MODEL_NAME = os.getenv(
    "GROQ_MODEL",
    "openai/gpt-oss-120b",
)


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="AC Dashboard GenAI Analyzer",
    version="1.2.0",
    description=(
        "AC dashboard analysis, AI questions, "
        "and maintenance history."
    ),
)


# ============================================================
# CORS CONFIGURATION
# ============================================================

origins_raw = os.getenv("CORS_ORIGINS", "*")

if origins_raw.strip() == "*":
    origins = ["*"]
else:
    origins = [
        item.strip()
        for item in origins_raw.split(",")
        if item.strip()
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False if origins == ["*"] else True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# REQUEST MODELS
# ============================================================

class DashboardPayload(BaseModel):
    dashboard_name: str = "AC Energy Dashboard"

    generated_at: Optional[str] = None

    filters: Dict[str, Any] = Field(
        default_factory=dict
    )

    kpis: Dict[str, Any] = Field(
        default_factory=dict
    )

    trends: Any = Field(default_factory=list)
    zones: Any = Field(default_factory=list)
    states: Any = Field(default_factory=list)
    cities: Any = Field(default_factory=list)
    branches: Any = Field(default_factory=list)
    floors: Any = Field(default_factory=list)
    ac_health: Any = Field(default_factory=list)
    alerts: Any = Field(default_factory=list)
    tables: Any = Field(default_factory=list)

    additional_data: Dict[str, Any] = Field(
        default_factory=dict
    )

    # Optional raw telemetry records.
    # Send these if you want the backend to calculate
    # summary values directly from individual AC readings.
    ac_data: Any = Field(default_factory=list)


class MaintenanceRequest(BaseModel):
    ac_id: str = Field(
        min_length=1,
        max_length=100,
    )

    maintenance_type: str = Field(
        min_length=1,
        max_length=100,
    )

    maintenance_date: str = Field(
        min_length=1,
        max_length=40,
    )

    problem: str = Field(
        min_length=1,
        max_length=2000,
    )

    duration_minutes: int = Field(
        default=0,
        ge=0,
    )

    notes: str = Field(
        default="",
        max_length=2000,
    )


class DashboardQuestionRequest(BaseModel):
    question: str = Field(
        min_length=1,
        max_length=2000,
    )

    dashboard: Dict[str, Any] = Field(
        default_factory=dict
    )

    ac_id: Optional[str] = Field(
        default=None,
        max_length=100,
    )


# ============================================================
# GENERAL ENDPOINTS
# ============================================================

@app.get("/")
def root():
    return {
        "service": "AC Dashboard GenAI Analyzer",
        "status": "running",
        "model": MODEL_NAME,
        "endpoints": {
            "dashboard_analysis": (
                "/api/analyze-dashboard"
            ),
            "ask_dashboard": (
                "/api/ask-dashboard"
            ),
            "create_maintenance": (
                "/api/maintenance"
            ),
            "maintenance_history": (
                "/api/maintenance?ac_id=AC-102"
            ),
            "maintenance_summary": (
                "/api/maintenance/summary?ac_id=AC-102"
            ),
            "documentation": "/docs",
        },
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


# ============================================================
# DASHBOARD ANALYSIS
# ============================================================

@app.post("/api/analyze-dashboard")
def dashboard_analysis(
    payload: DashboardPayload,
):
    try:
        result = analyze_dashboard(
            payload.model_dump()
        )

        return {
            "success": True,
            "analysis": result,
            "model": MODEL_NAME,
        }

    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        )

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Dashboard analysis failed: {exc}",
        )


# ============================================================
# CREATE MAINTENANCE RECORD
# ============================================================

@app.post(
    "/api/maintenance",
    status_code=201,
)
def add_maintenance(
    request: MaintenanceRequest,
):
    try:
        record = create_maintenance_record(
            request.model_dump()
        )

        return {
            "success": True,
            "message": (
                "Maintenance record saved successfully."
            ),
            "record": record,
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Could not save maintenance record: {exc}",
        )


# ============================================================
# GET MAINTENANCE HISTORY
# ============================================================

@app.get("/api/maintenance")
def maintenance_history(
    ac_id: Optional[str] = Query(
        default=None,
        max_length=100,
    ),
    limit: int = Query(
        default=100,
        ge=1,
        le=5000,
    ),
):
    try:
        records = list_maintenance_records(
            ac_id=ac_id.strip() if ac_id else None,
            limit=limit,
        )

        return {
            "success": True,
            "count": len(records),
            "records": records,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Could not retrieve maintenance history: {exc}",
        )


# ============================================================
# MAINTENANCE SUMMARY
# ============================================================

@app.get("/api/maintenance/summary")
def maintenance_summary(
    ac_id: str = Query(
        min_length=1,
        max_length=100,
    ),
):
    try:
        summary = get_maintenance_summary(
            ac_id.strip()
        )

        return {
            "success": True,
            "summary": summary,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Could not calculate maintenance summary: {exc}",
        )


# ============================================================
# ASK AI ABOUT DASHBOARD OR MAINTENANCE
# ============================================================

@app.post("/api/ask-dashboard")
def ask_dashboard(
    request: DashboardQuestionRequest,
):
    question = request.question.strip()

    if not question:
        raise HTTPException(
            status_code=400,
            detail="Please enter a question.",
        )

    try:
        maintenance_records = []

        # Only retrieve maintenance records for the requested AC.
        if request.ac_id and request.ac_id.strip():
            maintenance_records = list_maintenance_records(
                ac_id=request.ac_id.strip(),
                limit=100,
            )

        answer = answer_dashboard_question(
            question=question,
            dashboard=request.dashboard,
            maintenance_records=maintenance_records,
        )

        return {
            "success": True,
            "answer": answer,
            "model": MODEL_NAME,
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        )

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"AI could not generate an answer: {exc}",
        )
    