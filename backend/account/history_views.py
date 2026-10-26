"""Chart history served ONLY from the local ``telemetry_aggregate`` table.

Nothing in this module talks to ThingsBoard / 3TP.  The ingest path
(``telemetry_aggregate.ingest_payload``) already stores one row per device per
minute (UTC bucket), so every chart range -- last hour, 12 h, 24 h, today,
week, month -- is answered by reading those rows and rolling them up.

Endpoints (both require login and apply the same role / hierarchy scoping as
``/api/ac-data/``):

GET /api/current-history/        one metric as a single series
GET /api/telemetry-aggregates/   per-device rows with every metric

Common query parameters
    from, to          ISO-8601 or Unix seconds / milliseconds (UTC if no zone)
    device_id/ac_id   one AC (accepts the local ac_id or the 3TP device id)
    state, district, taluka, city, zone, circle, region, division, branch,
    floor, hierarchy  same filters as /api/ac-data/
    interval_seconds  optional bucket size, a multiple of 60 (60 .. 86400)
"""
import math
import re
from datetime import datetime, timedelta, timezone as dt_tz

from django.utils.dateparse import parse_datetime
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import ACDevice, TelemetryAggregate

BASE_INTERVAL = 60                    # stored bucket size (seconds)
MAX_INTERVAL = 86_400
MAX_RANGE = timedelta(days=93)
MAX_POINTS_PER_DEVICE = 2_000         # coarsen the bucket rather than truncate
DEFAULT_INTERVAL = {"today": 60, "24h": 60, "day": 60, "week": 3_600, "month": 3_600}

# metric -> (avg column, min column, max column)
METRIC_COLUMNS = {
    "voltage": ("avg_voltage", "min_voltage", "max_voltage"),
    "current": ("avg_current", None, None),          # model keeps no min/max current
    "power": ("avg_power", "min_power", "max_power"),
    "temperature": ("avg_temperature", "min_temperature", "max_temperature"),
    "humidity": ("avg_humidity", "min_humidity", "max_humidity"),
}
# Accept the names the frontend / payload use for the same quantity.
METRIC_ALIASES = {
    "energy_delta": "energy", "kwh": "energy",
    "active_power": "power", "indoor_temperature": "temperature",
    "indoor_humidity": "humidity", "amps": "current",
}


# Current and power are reported as 0 for buckets where the AC's relay was OFF
# (the device keeps sending a small standby reading).
RELAY_GATED = {"current", "power"}


class RangeError(ValueError):
    pass


# ----------------------------------------------------------------- parsing
def parse_time(raw, default):
    """ISO-8601 string, or Unix seconds / milliseconds -> aware UTC datetime."""
    if raw in (None, ""):
        return default
    text = str(raw).strip()
    try:
        number = float(text)
    except ValueError:
        number = None
    if number is not None:
        if not math.isfinite(number):
            raise RangeError("invalid time")
        seconds = number / 1000 if abs(number) > 1e11 else number
        try:
            return datetime.fromtimestamp(seconds, tz=dt_tz.utc)
        except (OverflowError, OSError, ValueError):
            raise RangeError("invalid time")
    # A '+' in a query string decodes to a space ("...T10:00:00 05:30").
    text = re.sub(r"(T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?) (\d{2}:?\d{2})$", r"\1+\2", text)
    parsed = parse_datetime(text.replace("Z", "+00:00"))
    if parsed is None:
        raise RangeError("invalid time")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt_tz.utc)
    return parsed.astimezone(dt_tz.utc)


def parse_window(params, now=None):
    now = now or datetime.now(dt_tz.utc)
    start = parse_time(params.get("from") or params.get("startTs"), now - timedelta(hours=24))
    end = parse_time(params.get("to") or params.get("endTs"), now)
    if start > end:
        raise RangeError("'from' must be earlier than 'to'.")
    if end - start > MAX_RANGE:
        raise RangeError("Local history queries are limited to 93 days.")
    return start, end


def pick_interval(params, start, end, period="today"):
    """Requested (or default) bucket size, coarsened so a query never blows up."""
    raw = params.get("interval_seconds") or params.get("interval")
    if raw not in (None, ""):
        try:
            interval = int(float(raw))
        except ValueError:
            raise RangeError("interval_seconds must be a number.")
        if interval < BASE_INTERVAL or interval > MAX_INTERVAL or interval % BASE_INTERVAL:
            raise RangeError("interval_seconds must be a multiple of 60 between 60 and 86400.")
    else:
        interval = DEFAULT_INTERVAL.get(period, 60)
    span = max((end - start).total_seconds(), 1)
    while span / interval > MAX_POINTS_PER_DEVICE and interval < MAX_INTERVAL:
        interval = min(interval * 2 if interval < 3_600 else interval + 3_600, MAX_INTERVAL)
    return interval


# ------------------------------------------------------------------- scope
def scoped_device_ids(request):
    """ac_ids the caller may see, after hierarchy filters / device selection.

    Built from the database only (ACDevice + devices present in the aggregate
    table), so it works even when no live 3TP cache exists.
    """
    from .views import filter_by_location, scope_ac_records  # lazy: views imports lots

    params = request.query_params
    selected = (params.get("device_id") or params.get("ac_id")
                or params.get("selectedDeviceId") or "").strip()

    if selected:
        device = (ACDevice.objects.filter(ac_id__iexact=selected).first()
                  or ACDevice.objects.filter(tpt_device_id=selected).first())
        ac_id = device.ac_id if device else selected
        if not scope_ac_records([{"ac_id": ac_id}], request.user):
            return None, "You do not have access to this AC."
        if not device and not TelemetryAggregate.objects.filter(device_id=ac_id).exists():
            return None, "Unknown AC."
        return {ac_id}, None

    ids = set(ACDevice.objects.values_list("ac_id", flat=True))
    ids |= set(TelemetryAggregate.objects.order_by().values_list("device_id", flat=True).distinct())
    records = [{"ac_id": i} for i in sorted(ids)]
    records = filter_by_location(scope_ac_records(records, request.user), request)
    return {str(r["ac_id"]) for r in records}, None


# --------------------------------------------------------------- roll-ups
def _floor(ts, interval):
    epoch = int(ts.timestamp())
    return epoch - epoch % interval


def rollup(rows, interval):
    """Group stored 60-s rows into ``interval`` buckets, per device.

    rows: iterable of TelemetryAggregate-like dicts.  Averages are weighted by
    sample_count so a busy minute counts for more than a single reading.
    """
    out = {}
    for r in rows:
        key = (r["device_id"], _floor(r["bucket_start"], interval))
        b = out.get(key)
        if b is None:
            b = out[key] = {"device_id": r["device_id"], "t": key[1], "n": 0, "sums": {}, "ns": {},
                            "min": {}, "max": {}, "energy": 0.0, "latest": r}
        n = int(r["sample_count"] or 0) or 1
        b["n"] += n
        b["energy"] += float(r.get("energy_delta") or 0)
        if r["last_timestamp"] >= b["latest"]["last_timestamp"]:
            b["latest"] = r
        for name in METRIC_COLUMNS:
            avg_col, min_col, max_col = METRIC_COLUMNS[name]
            avg = r.get(avg_col)
            if avg is None:
                continue
            b["sums"][name] = b["sums"].get(name, 0.0) + avg * n
            b["ns"][name] = b["ns"].get(name, 0) + n
            lo = r.get(min_col) if min_col else avg
            hi = r.get(max_col) if max_col else avg
            lo = avg if lo is None else lo
            hi = avg if hi is None else hi
            b["min"][name] = lo if name not in b["min"] else min(b["min"][name], lo)
            b["max"][name] = hi if name not in b["max"] else max(b["max"][name], hi)
    return out


def _fetch(ids, start, end):
    fields = ["device_id", "bucket_start", "last_timestamp", "sample_count", "energy_delta",
              "latest_energy_counter", "latest_relay"]
    for avg_col, min_col, max_col in METRIC_COLUMNS.values():
        fields += [c for c in (avg_col, min_col, max_col) if c]
    return (TelemetryAggregate.objects
            .filter(interval_seconds=BASE_INTERVAL, device_id__in=ids,
                    bucket_start__gte=start, bucket_start__lte=end)
            .order_by("bucket_start").values(*fields).iterator(chunk_size=5_000))


def _iso(epoch):
    return datetime.fromtimestamp(epoch, dt_tz.utc).isoformat()


def _bad(message, status=400):
    return Response({"status": "error", "message": message}, status=status)


# ------------------------------------------------------------- endpoints
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def current_history(request):
    """One metric over time (default ``key=current``), straight from the DB.

    GET /api/current-history/?key=voltage&period=today|week|month&from=..&to=..
    key: current | voltage | power | temperature | humidity | energy
    ``agg=avg`` (default) averages across the ACs in scope; ``agg=sum`` adds
    them (use it for total power).  ``key=energy`` is the energy consumed per
    bucket, always summed over the ACs in scope.

    Response data rows: {"bucket", "avg", "min", "max", "count"} where
    ``bucket`` is the UTC start of the bucket.
    """
    params = request.query_params
    metric = str(params.get("key", "current")).strip().lower()
    metric = METRIC_ALIASES.get(metric, metric)
    if metric not in METRIC_COLUMNS and metric != "energy":
        return _bad(f"key must be one of: {', '.join(sorted([*METRIC_COLUMNS, 'energy']))}.")
    period = params.get("period", "today")
    if period not in DEFAULT_INTERVAL:
        return _bad("period must be today, week or month.")
    agg = str(params.get("agg", "avg")).lower()
    if agg not in ("avg", "sum"):
        return _bad("agg must be avg or sum.")
    if metric == "energy":
        agg = "sum"          # energy consumed is always the total across the ACs in scope

    try:
        start, end = parse_window(params)
        interval = pick_interval(params, start, end, period)
    except RangeError as exc:
        return _bad(str(exc))

    ids, problem = scoped_device_ids(request)
    if problem:
        return _bad(problem, 403 if "access" in problem else 404)

    per_device = rollup(_fetch(ids, start, end), interval) if ids else {}

    merged, with_data = {}, set()
    for (device_id, t), b in per_device.items():
        if metric == "energy":
            # kWh used in the bucket = sum of the stored per-minute energy deltas.
            dev_avg = lo = hi = b["energy"]
            n = b["n"]
        elif metric in b["ns"]:
            dev_avg = b["sums"][metric] / b["ns"][metric]
            lo, hi, n = b["min"][metric], b["max"][metric], b["ns"][metric]
            if metric in RELAY_GATED and not b["latest"].get("latest_relay"):
                dev_avg = lo = hi = 0.0      # relay OFF: the AC draws no current / power
        else:
            continue
        with_data.add(device_id)
        m = merged.setdefault(t, {"vals": [], "lo": [], "hi": [], "count": 0})
        m["vals"].append(dev_avg)
        m["lo"].append(lo)
        m["hi"].append(hi)
        m["count"] += n

    def combine(values):
        return sum(values) if agg == "sum" else sum(values) / len(values)

    data = [{
        "bucket": _iso(t),
        "avg": round(combine(m["vals"]), 4),
        "min": round(sum(m["lo"]) if agg == "sum" else min(m["lo"]), 4),
        "max": round(sum(m["hi"]) if agg == "sum" else max(m["hi"]), 4),
        "count": m["count"],
    } for t, m in sorted(merged.items())]

    return Response({
        "status": "success", "source": "local_aggregate",
        "period": period, "key": metric, "agg": agg, "interval_seconds": interval,
        "from": start.isoformat(), "to": end.isoformat(),
        "devices_queried": len(ids), "devices_with_data": len(with_data),
        "data": data,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def telemetry_aggregates(request):
    """Per-device rows with every metric (temperature, humidity, energy ...).

    Same scoping as the dashboard.  ``interval_seconds`` rolls the stored
    1-minute rows up (e.g. 3600 for hourly) so long ranges stay complete
    instead of being cut off.
    """
    params = request.query_params
    now = datetime.now(dt_tz.utc)
    try:
        start, end = parse_window(params, now)
        if params.get("from") in (None, ""):          # legacy default: since midnight UTC
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        interval = pick_interval(params, start, end, "today")
    except RangeError as exc:
        return _bad(str(exc))

    ids, problem = scoped_device_ids(request)
    if problem:
        return _bad(problem, 403 if "access" in problem else 404)

    rolled = rollup(_fetch(ids, start, end), interval) if ids else {}
    data = []
    for (device_id, t), b in sorted(rolled.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        def avg(name):
            return b["sums"][name] / b["ns"][name] if name in b["ns"] else None
        last = b["latest"]
        data.append({
            "device_id": device_id,
            "bucket_start": _iso(t),
            "interval_seconds": interval,
            "sample_count": b["n"],
            "avg_voltage": avg("voltage"), "min_voltage": b["min"].get("voltage"), "max_voltage": b["max"].get("voltage"),
            "avg_current": avg("current"),
            "avg_power": avg("power"), "min_power": b["min"].get("power"), "max_power": b["max"].get("power"),
            "avg_temperature": avg("temperature"), "min_temperature": b["min"].get("temperature"),
            "max_temperature": b["max"].get("temperature"),
            "avg_humidity": avg("humidity"), "min_humidity": b["min"].get("humidity"),
            "max_humidity": b["max"].get("humidity"),
            "energy_delta": b["energy"],
            "latest_energy_counter": last.get("latest_energy_counter"),
        })
    return Response({"status": "success", "source": "local_aggregate", "interval_seconds": interval,
                     "count": len(data), "data": data})
