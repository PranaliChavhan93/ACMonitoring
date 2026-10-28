import io
import json
import os
from datetime import datetime, timezone
from typing import Any

import pandas as pd
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from zoneinfo import ZoneInfo

load_dotenv()

APP_TIMEZONE = os.getenv("APP_TIMEZONE", "Asia/Kolkata")
THINGSBOARD_BASE_URL = os.getenv("THINGSBOARD_BASE_URL", "https://3tp.tapasyatech.in").rstrip("/")
THINGSBOARD_DEVICE_ID = os.getenv("THINGSBOARD_DEVICE_ID", "")
THINGSBOARD_TOKEN = os.getenv("THINGSBOARD_TOKEN", "")
THINGSBOARD_TELEMETRY_KEY = os.getenv("THINGSBOARD_TELEMETRY_KEY", "data")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

app = FastAPI(title="GenAI Graph Analysis API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ThingsBoardRequest(BaseModel):
    device_id: str = ""
    token: str = ""
    start: str
    end: str
    telemetry_key: str = THINGSBOARD_TELEMETRY_KEY


class FilterRequest(BaseModel):
    start: str | None = None
    end: str | None = None
    metrics: list[str] = Field(default_factory=list)
    aggregation: str = "raw"


class AnalysisRequest(BaseModel):
    metrics: list[str]
    aggregation: str = "raw"
    rows: list[dict[str, Any]]
    summary: dict[str, Any] = Field(default_factory=dict)


def _to_utc_timestamp(value: Any) -> pd.Timestamp | None:
    """Normalize ISO or Unix second/ms/us/ns timestamps to UTC."""
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)) or (isinstance(value, str) and value.strip().isdigit()):
        try:
            n = float(value)
            magnitude = abs(n)
            if magnitude >= 1e17:
                unit = "ns"
            elif magnitude >= 1e14:
                unit = "us"
            elif magnitude >= 1e11:
                unit = "ms"
            else:
                unit = "s"
            ts = pd.to_datetime(n, unit=unit, utc=True, errors="coerce")
        except (ValueError, OverflowError):
            return None
    else:
        ts = pd.to_datetime(value, utc=True, errors="coerce")
    if pd.isna(ts):
        return None
    if ts.year < 2000 or ts.year > 2100:
        return None
    return ts


def _flatten_record(record: dict[str, Any]) -> dict[str, Any]:
    """Unwrap ThingsBoard value JSON strings and flatten one telemetry record."""
    result: dict[str, Any] = {}
    ts_value = record.get("timestamp", record.get("ts", record.get("time")))
    if ts_value is not None:
        result["timestamp"] = ts_value

    for key, value in record.items():
        if key in {"timestamp", "ts", "time"}:
            continue
        if key == "data" and isinstance(value, list):
            for point in value:
                if not isinstance(point, dict):
                    continue
                point_ts = point.get("ts", point.get("timestamp"))
                if point_ts is not None:
                    result.setdefault("timestamp", point_ts)
                point_value = point.get("value")
                if isinstance(point_value, str):
                    try:
                        point_value = json.loads(point_value)
                    except json.JSONDecodeError:
                        pass
                if isinstance(point_value, dict):
                    result.update(point_value)
                elif point_value is not None:
                    result[str(point.get("key", key))] = point_value
            continue

        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("{") or stripped.startswith("["):
                try:
                    value = json.loads(stripped)
                except json.JSONDecodeError:
                    pass

        if isinstance(value, dict):
            for nested_key, nested_value in value.items():
                result[str(nested_key)] = nested_value
        else:
            result[key] = value
    return result


def normalize_payload(payload: Any) -> pd.DataFrame:
    """Accept lists, row objects, nested data objects, and ThingsBoard timeseries."""
    records: list[dict[str, Any]] = []

    if isinstance(payload, list):
        for item in payload:
            if isinstance(item, dict):
                records.append(_flatten_record(item))

    elif isinstance(payload, dict):
        if isinstance(payload.get("data"), list):
            # ThingsBoard commonly returns {"data":[{"ts":...,"value":"{...}"}]}
            for item in payload["data"]:
                if isinstance(item, dict):
                    records.append(_flatten_record(item))
        elif isinstance(payload.get("data"), dict):
            nested = payload["data"]
            if isinstance(nested.get("data"), list):
                records.extend(_flatten_record(x) for x in nested["data"] if isinstance(x, dict))
            else:
                records.append(_flatten_record(nested))
        elif isinstance(payload.get("values"), list):
            records.extend(_flatten_record(x) for x in payload["values"] if isinstance(x, dict))
        elif isinstance(payload.get("records"), list):
            records.extend(_flatten_record(x) for x in payload["records"] if isinstance(x, dict))
        else:
            records.append(_flatten_record(payload))
    else:
        raise ValueError("Unsupported JSON structure. Upload an object or a list of records.")

    if not records:
        return pd.DataFrame()

    df = pd.DataFrame(records)
    timestamp_col = next((c for c in df.columns if str(c).lower() in {"timestamp", "time", "datetime", "date", "ts"}), None)
    if timestamp_col is None:
        raise ValueError("No timestamp field found. Expected timestamp, ts, time, datetime, or date.")
    if timestamp_col != "timestamp":
        df = df.rename(columns={timestamp_col: "timestamp"})

    df["timestamp"] = df["timestamp"].map(_to_utc_timestamp)
    df = df.dropna(subset=["timestamp"])
    if df.empty:
        raise ValueError("No valid timestamps. Check timestamp units or ISO date strings.")

    for col in df.columns:
        if col == "timestamp":
            continue
        df[col] = df[col].map(_coerce_json_value)
        numeric = pd.to_numeric(df[col], errors="coerce")
        non_null = df[col].notna().sum()
        if non_null and numeric.notna().sum() / non_null >= 0.75:
            df[col] = numeric
    df = df.sort_values("timestamp").drop_duplicates(subset=["timestamp"], keep="last")
    return df.reset_index(drop=True)


def _coerce_json_value(value: Any) -> Any:
    if isinstance(value, str):
        stripped = value.strip()
        if stripped.startswith("{") or stripped.startswith("["):
            try:
                parsed = json.loads(stripped)
                if isinstance(parsed, dict):
                    return json.dumps(parsed, ensure_ascii=False)
                return parsed
            except json.JSONDecodeError:
                return value
    return value


def detect_metrics(df: pd.DataFrame) -> dict[str, list[str]]:
    numeric: list[str] = []
    categorical: list[str] = []
    identifiers: list[str] = []
    for col in df.columns:
        if col == "timestamp":
            continue
        series = df[col]
        name = str(col).lower()
        if any(token in name for token in ("id", "uuid", "serial", "device", "mac", "name")):
            identifiers.append(str(col))
            continue
        converted = pd.to_numeric(series, errors="coerce")
        non_null = series.notna().sum()
        ratio = converted.notna().sum() / non_null if non_null else 0
        if ratio >= 0.70 and converted.nunique(dropna=True) > 1:
            numeric.append(str(col))
        else:
            categorical.append(str(col))
    return {"numeric": numeric, "categorical": categorical, "identifiers": identifiers}


def _parse_range(value: str) -> pd.Timestamp:
    ts = pd.Timestamp(value)
    if ts.tzinfo is None:
        ts = ts.tz_localize(ZoneInfo(APP_TIMEZONE))
    return ts.tz_convert("UTC")


def filter_range(df: pd.DataFrame, start: str | None, end: str | None) -> pd.DataFrame:
    result = df.copy()
    if start:
        result = result[result["timestamp"] >= _parse_range(start)]
    if end:
        result = result[result["timestamp"] <= _parse_range(end)]
    return result.reset_index(drop=True)


def aggregate_frame(df: pd.DataFrame, metrics: list[str], aggregation: str) -> pd.DataFrame:
    if df.empty:
        return df
    valid_metrics = [m for m in metrics if m in df.columns]
    frame = df[["timestamp"] + valid_metrics].copy()
    for metric in valid_metrics:
        frame[metric] = pd.to_numeric(frame[metric], errors="coerce")
    if aggregation == "raw" or not valid_metrics:
        return frame
    freq = {"hourly": "h", "daily": "D", "weekly": "W", "monthly": "MS"}.get(aggregation)
    if not freq:
        return frame
    frame = frame.set_index("timestamp")
    return frame[valid_metrics].resample(freq).mean(numeric_only=True).dropna(how="all").reset_index()


def _records_json(df: pd.DataFrame) -> list[dict[str, Any]]:
    out = df.copy()
    out["timestamp"] = out["timestamp"].map(lambda x: x.isoformat() if pd.notna(x) else None)
    out = out.astype(object).where(pd.notna(out), None)
    return out.to_dict(orient="records")


@app.get("/api/health")
def health():
    return {"status": "ok", "timezone": APP_TIMEZONE}


@app.post("/api/upload")
async def upload_json(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".json"):
        raise HTTPException(400, "Please upload a .json file.")
    try:
        payload = json.loads((await file.read()).decode("utf-8-sig"))
        df = normalize_payload(payload)
    except Exception as exc:
        raise HTTPException(400, f"Could not parse JSON: {exc}") from exc
    return {"source": file.filename, "count": len(df), "metrics": detect_metrics(df), "rows": _records_json(df)}


@app.post("/api/thingsboard")
def thingsboard_fetch(request: ThingsBoardRequest):
    device_id = request.device_id or THINGSBOARD_DEVICE_ID
    token = request.token or THINGSBOARD_TOKEN
    if not device_id:
        raise HTTPException(400, "Set THINGSBOARD_DEVICE_ID or provide a device ID.")
    if not token:
        raise HTTPException(401, "Provide a bearer token or set THINGSBOARD_TOKEN in backend/.env.")
    start_ts = int(_parse_range(request.start).timestamp() * 1000)
    end_ts = int(_parse_range(request.end).timestamp() * 1000)
    if start_ts > end_ts:
        raise HTTPException(400, "Start time must be before end time.")
    url = f"{THINGSBOARD_BASE_URL}/api/plugins/telemetry/DEVICE/{device_id}/values/timeseries"
    params = {"keys": request.telemetry_key, "startTs": start_ts, "endTs": end_ts, "limit": 10000}
    try:
        response = requests.get(
            url,
            params=params,
            headers={"X-Authorization": f"Bearer {token}"},
            timeout=30,
        )
        if response.status_code in (401, 403):
            raise HTTPException(response.status_code, "ThingsBoard rejected the token or permissions.")
        response.raise_for_status()
        payload = response.json()
        df = normalize_payload(payload)
        df = filter_range(df, request.start, request.end)
    except HTTPException:
        raise
    except requests.RequestException as exc:
        raise HTTPException(502, f"ThingsBoard request failed: {exc}") from exc
    except Exception as exc:
        raise HTTPException(502, f"Could not normalize ThingsBoard response: {exc}") from exc
    if df.empty:
        return {"source": "ThingsBoard API", "count": 0, "metrics": detect_metrics(df), "rows": []}
    return {"source": "ThingsBoard API", "count": len(df), "metrics": detect_metrics(df), "rows": _records_json(df)}


@app.post("/api/filter")
def filter_data(request: FilterRequest):
    # This endpoint supports frontend-provided data only when rows are posted.
    raise HTTPException(400, "Use client-side filtering on returned rows or call /api/upload and /api/thingsboard again with a narrower range.")


@app.post("/api/analyze")
def analyze(request: AnalysisRequest):
    if not GROQ_API_KEY:
        raise HTTPException(503, "GROQ_API_KEY is not configured in backend/.env.")
    safe_rows = request.rows[:500]
    system_prompt = (
        "You are a data analyst for telemetry dashboards. Explain only trends supported "
        "by the supplied summary. Do not invent causes. Recommend chart types and highlight "
        "missing data or suspicious values. Respond as concise JSON with keys dashboard_title, "
        "insights (array), recommended_charts (array of {metric, chart_type, reason}), limitations (array)."
    )
    user_prompt = json.dumps({
        "metrics": request.metrics,
        "aggregation": request.aggregation,
        "summary": request.summary,
        "sample_rows": safe_rows,
    }, ensure_ascii=False, default=str)
    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={
                "model": GROQ_MODEL,
                "temperature": 0.2,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "response_format": {"type": "json_object"},
            },
            timeout=45,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        return json.loads(content)
    except requests.RequestException as exc:
        raise HTTPException(502, f"Groq API request failed: {exc}") from exc
    except (KeyError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(502, f"Could not parse Groq response: {exc}") from exc


@app.post("/api/export-csv")
def export_csv(rows: list[dict[str, Any]]):
    if not rows:
        raise HTTPException(400, "No rows to export.")
    df = pd.DataFrame(rows)
    content = df.to_csv(index=False).encode("utf-8-sig")
    return StreamingResponse(
        io.BytesIO(content),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="filtered_telemetry.csv"'},
    )
