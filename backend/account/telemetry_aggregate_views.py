import hmac
from datetime import datetime, timezone as dt_timezone
from django.conf import settings
from django.http import JsonResponse
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .telemetry_aggregate import ingest_payload, query_aggregates, _record_from_row
from .views import scope_ac_records, filter_by_location
from .models import TelemetryAggregate
from django.db.models import OuterRef, Subquery
from .models import ACDevice

def _authorized(request):
    expected = str(getattr(settings, "TELEMETRY_INGEST_TOKEN", "") or "")
    supplied = request.headers.get("X-Telemetry-Token", "")
    return bool(expected and supplied and hmac.compare_digest(expected, supplied))


@api_view(["POST"])
@permission_classes([AllowAny])
def save_production_type(request):
    if not _authorized(request):
        return Response({"status": "error", "message": "Valid telemetry token required."}, status=status.HTTP_401_UNAUTHORIZED)
    try:
        result = ingest_payload(request.data)
    except ValueError as exc:
        return Response({"status": "error", "message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"status": "success", **result}, status=status.HTTP_200_OK)


def _parse_datetime(value, fallback):
    if not value:
        return fallback
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, dt_timezone.utc)
    return parsed


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def telemetry_aggregates(request):
    """Historical local minute summaries. Detailed raw history remains in ThingsBoard."""
    now = timezone.now()
    try:
        start = _parse_datetime(request.query_params.get("from"), now.replace(hour=0, minute=0, second=0, microsecond=0))
        end = _parse_datetime(request.query_params.get("to"), now)
        interval = int(request.query_params.get("interval_seconds", "60"))
        if interval != 60:
            return Response({"status": "error", "message": "Only 60-second local buckets are currently stored."}, status=400)
        if end <= start:
            return Response({"status": "error", "message": "'to' must be later than 'from'."}, status=400)
        if (end - start).total_seconds() > 60 * 60 * 24 * 31:
            return Response({"status": "error", "message": "Local aggregate queries are limited to 31 days. Use ThingsBoard for longer raw-history queries."}, status=400)
    except (ValueError, TypeError):
        return Response({"status": "error", "message": "Invalid datetime or interval."}, status=400)
    rows = query_aggregates(start, end, interval_seconds=interval)
  
    # Apply the same role/device scope and location filters as the dashboard.

    newest_bucket = (TelemetryAggregate.objects
                     .filter(device_id=OuterRef("device_id"), interval_seconds=60)
                     .order_by("-bucket_start").values("bucket_start")[:1])
    latest_rows = TelemetryAggregate.objects.filter(interval_seconds=60, bucket_start=Subquery(newest_bucket))
    latest_rows = list(latest_rows)

    names = dict(ACDevice.objects.filter(ac_id__in=[r.device_id for r in latest_rows]).values_list("ac_id", "device_name"))
    scope_records = scope_ac_records([_record_from_row(r, names.get(r.device_id)) for r in latest_rows], request.user)
    scope_records = filter_by_location(scope_records, request)
    allowed_ids = {str(item.get("ac_id")) for item in scope_records}
    rows = [r for r in rows if str(r.device_id) in allowed_ids]
    data = [{
        "device_id": r.device_id,
        "bucket_start": r.bucket_start.isoformat(),
        "interval_seconds": r.interval_seconds, 
        "sample_count": r.sample_count,
        "avg_voltage": r.avg_voltage, 
        "min_voltage": r.min_voltage, 
        "max_voltage": r.max_voltage,
        "avg_current": r.avg_current, 
        "avg_power": r.avg_power, 
        "min_power": r.min_power, 
        "max_power": r.max_power,
        "avg_temperature": r.avg_temperature, 
        "min_temperature": r.min_temperature, 
        "max_temperature": r.max_temperature,
        "avg_humidity": r.avg_humidity, 
        "min_humidity": r.min_humidity, 
        "max_humidity": r.max_humidity,
        "energy_delta": r.energy_delta,
    } for r in rows[:50000]]
    return JsonResponse({"status": "success", "count": len(data), "data": data})
