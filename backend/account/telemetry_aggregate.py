"""Single-table telemetry aggregation. Raw history stays in ThingsBoard."""
import math
from datetime import datetime, timezone as dt_timezone
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import TelemetryAggregate, ACDevice

METRICS = {
    "voltage": ("voltage", "latest_voltage", "sum_voltage", "avg_voltage", "min_voltage", "max_voltage"),
    "current": ("current", "latest_current", "sum_current", "avg_current", None, None),
    "power": ("power", "latest_power", "sum_power", "avg_power", "min_power", "max_power"),
    "temperature": ("indoor_temperature", "latest_temperature", "sum_temperature", "avg_temperature", "min_temperature", "max_temperature"),
    "humidity": ("indoor_humidity", "latest_humidity", "sum_humidity", "avg_humidity", "min_humidity", "max_humidity"),
}

def _number(value):
    if value in (None, ""):
        return None
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None

def _timestamp(value):
    if value is None:
        return timezone.now()
    if isinstance(value, (int, float)):
        seconds = value / 1000 if value > 10_000_000_000 else value
        return datetime.fromtimestamp(seconds, tz=dt_timezone.utc)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if timezone.is_naive(parsed):
                parsed = timezone.make_aware(parsed, dt_timezone.utc)
            return parsed
        except ValueError as exc:
            raise ValueError("timestamp must be epoch milliseconds or ISO-8601") from exc
    raise ValueError("unsupported timestamp format")

def _flatten(item):
    """Accept raw payload, {ts, value}, {data:[...]}, or a list of readings."""
    if isinstance(item, dict) and isinstance(item.get("data"), list) and not item.get("ac_id"):
        return [entry for entry in item["data"] if isinstance(entry, dict)]
    if isinstance(item, dict) and isinstance(item.get("readings"), list):
        return [entry for entry in item["readings"] if isinstance(entry, dict)]
    if isinstance(item, dict) and isinstance(item.get("msg"), dict):
        merged = dict(item["msg"])
        if item.get("ts") is not None and "ts" not in merged:
            merged["ts"] = item["ts"]
        return [merged]
    if isinstance(item, list):
        return [entry for entry in item if isinstance(entry, dict)]
    return [item] if isinstance(item, dict) else []

def normalize_payload(payload):
    if not isinstance(payload, dict):
        raise ValueError("each telemetry item must be a JSON object")
    nested = payload.get("value")
    if isinstance(nested, str):
        import json
        try:
            nested = json.loads(nested)
        except ValueError as exc:
            raise ValueError("value contains invalid JSON") from exc
    values = dict(nested) if isinstance(nested, dict) else {}
    values.update({k: v for k, v in payload.items() if k not in ("value", "data")})
    device_id = str(values.get("ac_id") or values.get("device_id") or values.get("deviceName") or "").strip()
    if not device_id:
        raise ValueError("ac_id or device_id is required")
    ts = _timestamp(values.get("ts") or values.get("timestamp"))
    return device_id, ts, values

def _bucket(ts, seconds):
    epoch = int(ts.timestamp())
    start = epoch - (epoch % seconds)
    return datetime.fromtimestamp(start, tz=dt_timezone.utc)

def _apply_reading(device_id, ts, values, interval_seconds=60):
    bucket = _bucket(ts, interval_seconds)
    with transaction.atomic():
        row, created = TelemetryAggregate.objects.select_for_update().get_or_create(
            device_id=device_id, bucket_start=bucket, interval_seconds=interval_seconds,
            defaults={"last_timestamp": ts, "first_timestamp": ts},
        )
        if not created and row.last_timestamp and ts <= row.last_timestamp:
            return False

        previous_energy = row.latest_energy_counter
        if created:
            previous_bucket = (TelemetryAggregate.objects
                               .filter(device_id=device_id, interval_seconds=interval_seconds, bucket_start__lt=bucket)
                               .order_by("-bucket_start").first())
            if previous_bucket is not None:
                previous_energy = previous_bucket.latest_energy_counter
        count = row.sample_count
        for key, (source, latest_field, sum_field, avg_field, min_field, max_field) in METRICS.items():
            val = _number(values.get(source))
            if val is None:
                continue
            setattr(row, latest_field, val)
            setattr(row, sum_field, getattr(row, sum_field) + val)
            next_count = count + 1
            setattr(row, avg_field, getattr(row, sum_field) / next_count)
            if min_field:
                old = getattr(row, min_field)
                setattr(row, min_field, val if old is None else min(old, val))
            if max_field:
                old = getattr(row, max_field)
                setattr(row, max_field, val if old is None else max(old, val))
        row.sample_count = count + 1
        energy = _number(values.get("energy"))
        if energy is not None:
            if previous_energy is None:
                row.energy_delta = row.energy_delta or 0
            elif energy >= previous_energy:
                row.energy_delta = (row.energy_delta or 0) + (energy - previous_energy)
            else:
                # Counter reset/rollover: don't record a negative consumption spike.
                row.energy_delta = row.energy_delta or 0
            row.latest_energy_counter = energy
        frequency = _number(values.get("frequency"))
        pf = _number(values.get("power_factor"))
        alarm = _number(values.get("alarm_status"))
        relay = _number(values.get("relay"))
        if frequency is not None: row.latest_frequency = frequency
        if pf is not None: row.latest_power_factor = pf
        if alarm is not None: row.latest_alarm_status = int(alarm)
        if relay is not None: row.latest_relay = int(relay)
        if row.first_timestamp is None: row.first_timestamp = ts
        row.last_timestamp = ts
        row.save()
    return True

def ingest_payload(payload):
    items = _flatten(payload)
    if not items:
        raise ValueError("send a telemetry object or a non-empty readings/data array")
    max_batch = int(getattr(settings, "TELEMETRY_INGEST_MAX_BATCH", 500))
    if len(items) > max_batch:
        raise ValueError(f"batch exceeds limit of {max_batch} readings")
    accepted = 0
    rejected = []
    for index, item in enumerate(items):
        try:
            device_id, ts, values = normalize_payload(item)
            if _apply_reading(device_id, ts, values, interval_seconds=60):
                accepted += 1
        except (ValueError, TypeError) as exc:
            rejected.append({"index": index, "error": str(exc)})
    return {"received": len(items), "accepted": accepted, "ignored_or_rejected": len(items)-accepted,
            "errors": rejected[:20]}


def _record_from_row(row, device_name=None):
    age = (timezone.now() - row.last_timestamp).total_seconds() if row.last_timestamp else 10**9
    relay = int(row.latest_relay or 0)
    status = "OFFLINE" if age > int(getattr(settings, "TELEMETRY_STALE_SECONDS", 120)) else ("ON" if relay else "OFF")
    device_name = device_name or row.device_id
    
    return {
        "ac_id": row.device_id, 
        "site_id": row.device_id, 
        "device_name": device_name,
        "voltage": row.latest_voltage or 0, 
        "current": row.latest_current or 0,
        "active_power": row.latest_power or 0, 
        "energy_consumption": row.latest_energy_counter or 0,
        "frequency": row.latest_frequency or 0, 
        "power_factor": row.latest_power_factor or 0,
        "ac_on_time": None, 
        "ac_off_time": None, 
        "temperature": row.latest_temperature or 0,
        "humidity": row.latest_humidity or 0, 
        "alarm_status": row.latest_alarm_status or 0,
        "relay": relay, 
        "status": status, 
        "timestamp": row.last_timestamp.isoformat(timespec="seconds") if row.last_timestamp else None,
        "source": "local_aggregate", 
        "sample_count": row.sample_count,
        "bucket_start": row.bucket_start.isoformat(), "interval_seconds": row.interval_seconds,

        "energy_delta": float(row.energy_delta or 0),
        "latest_energy_counter": (
            float(row.latest_energy_counter)
            if row.latest_energy_counter is not None
            else None
        ),
    }


def get_latest_records():
    """Return one newest aggregate bucket per device in the legacy dashboard shape."""
    from django.db.models import OuterRef, Subquery
    newest_bucket = (TelemetryAggregate.objects
        .filter(device_id=OuterRef("device_id"), interval_seconds=60)
        .order_by("-bucket_start")
        .values("bucket_start")[:1])
    rows = list(TelemetryAggregate.objects
        .filter(interval_seconds=60, bucket_start=Subquery(newest_bucket))
        .order_by("device_id"))
    names = dict(ACDevice.objects.filter(ac_id__in=[r.device_id for r in rows])
         .values_list("ac_id", "device_name"))
    return [_record_from_row(row, names.get(row.device_id)) for row in rows]


def query_aggregates(start, end, device_ids=None, interval_seconds=60):
    qs = TelemetryAggregate.objects.filter(interval_seconds=interval_seconds, bucket_start__gte=start, bucket_start__lt=end)
    if device_ids is not None:
        qs = qs.filter(device_id__in=device_ids)
    return qs.order_by("bucket_start", "device_id")

def get_telemetry_records():
    if getattr(
        settings, "TELEMETRY_STORAGE_MODE", "polling"
    ).lower() == "aggregate":
        return get_latest_records()

    from . import telemetry

    return telemetry.get_records()