from calendar import monthrange
from datetime import datetime, timedelta
from collections import defaultdict

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import ACDevice, TelemetryAggregate
from .access_scope import accessible_devices
from .views import filter_by_location

PARAMETERS = {
    "energy": {"unit": "kWh", "kind": "sum", "field": "energy_delta", "scale": 0.001},
    "power": {"unit": "kW", "kind": "average", "field": "avg_power", "count": "power_sample_count"},
    "voltage": {"unit": "V", "kind": "average", "field": "avg_voltage", "count": "voltage_sample_count"},
    "current": {"unit": "A", "kind": "average", "field": "avg_current", "count": "current_sample_count"},
    "temperature": {"unit": "°C", "kind": "average", "field": "avg_temperature", "count": "temperature_sample_count"},
    "humidity": {"unit": "%", "kind": "average", "field": "avg_humidity", "count": "humidity_sample_count"},
    "frequency": {"unit": "Hz", "kind": "latest_average", "field": "latest_frequency"},
    "power_factor": {"unit": "", "kind": "latest_average", "field": "latest_power_factor"},
}


def _period_bounds(granularity, year, month, tz):
    if granularity == "MONTHLY":
        start = timezone.make_aware(datetime(year, month, 1), tz)
        if month == 12:
            end = timezone.make_aware(datetime(year + 1, 1, 1), tz)
        else:
            end = timezone.make_aware(datetime(year, month + 1, 1), tz)
        previous_year, previous_month = (year - 1, 12) if month == 1 else (year, month - 1)
        previous_start = timezone.make_aware(datetime(previous_year, previous_month, 1), tz)
        previous_end = start
        return start, end, previous_start, previous_end

    start = timezone.make_aware(datetime(year, 1, 1), tz)
    end = timezone.make_aware(datetime(year + 1, 1, 1), tz)
    previous_start = timezone.make_aware(datetime(year - 1, 1, 1), tz)
    return start, end, previous_start, start


def _device_location(device):
    branch = device.branch or (device.site.branch if device.site_id and device.site else None)
    site = device.site if device.site_id else None
    result = {
        "device_name": device.device_name or device.ac_id,
        "ac_id": device.ac_id,
        "floor_name": site.floor.name if site and site.floor_id else "",
        "branch_name": branch.name if branch else "",
        "state_name": "", "district_name": "", "taluka_name": "", "city_name": "",
        "zone_name": "", "circle_name": "", "region_name": "", "division_name": "",
    }
    if not branch:
        return result
    if branch.city_id or branch.taluka_id:
        taluka = branch.city.taluka if branch.city_id else branch.taluka
        district = taluka.district if taluka_id_exists(taluka) else None
        state = district.state if district else None
        result.update({
            "city_name": branch.city.name if branch.city_id else "",
            "taluka_name": taluka.name if taluka else "",
            "district_name": district.name if district else "",
            "state_name": state.name if state else "",
        })
    elif branch.division_id:
        division = branch.division
        region = division.region if division else None
        circle = region.circle if region else None
        zone = circle.zone if circle else None
        result.update({
            "division_name": division.name if division else "",
            "region_name": region.name if region else "",
            "circle_name": circle.name if circle else "",
            "zone_name": zone.name if zone else "",
        })
    return result


def taluka_id_exists(taluka):
    return bool(taluka and taluka.district_id)


def _location_label(location, filters):
    hierarchy = str(filters.get("hierarchy", "GEOGRAPHICAL")).upper()
    if hierarchy == "ZONAL":
        chain = [
            ("zone", "circle_name", "Zone"),
            ("circle", "region_name", "Circle"),
            ("region", "division_name", "Region"),
            ("division", "branch_name", "Division"),
            ("branch", "floor_name", "Branch"),
            ("floor", "device_name", "Floor"),
        ]
        default_key = "zone_name"
    else:
        chain = [
            ("state", "district_name", "State"),
            ("district", "taluka_name", "District"),
            ("taluka", "branch_name", "Taluka"),
            ("branch", "floor_name", "Branch"),
            ("floor", "device_name", "Floor"),
        ]
        default_key = "state_name"

    selected_level = None
    for filter_key, _, _ in chain:
        if filters.get(filter_key):
            selected_level = filter_key
    if selected_level:
        next_key = next((field for key, field, _ in chain if key == selected_level), "device_name")
        label = location.get(next_key)
        if label:
            return str(label)
        if selected_level in ("branch", "floor"):
            return str(location.get("device_name") or location.get("ac_id") or "Unassigned")
    return str(location.get(default_key) or location.get("branch_name") or location.get("device_name") or "Unassigned")


def _row_value(row, parameter, tariff):
    config = PARAMETERS[parameter]
    if parameter == "energy_cost":
        return float(row.get("energy_delta") or 0) * 0.001 * tariff, 1.0
    if config["kind"] == "sum":
        return float(row.get(config["field"]) or 0) * config.get("scale", 1), 1.0
    value = row.get(config["field"])
    if value is None:
        return None, 0.0
    if parameter in ("power", "current") and not row.get("latest_relay"):
        value = 0.0
    count_field = config.get("count")
    if count_field:
        weight = float(row.get(count_field) or row.get("sample_count") or 1)
    else:
        weight = 1.0
    return float(value), weight


def _new_accumulator():
    return {"sum": 0.0, "weight": 0.0, "has": False}


def _add(acc, value, weight, kind):
    if value is None:
        return
    acc["has"] = True
    if kind == "sum":
        acc["sum"] += value
    else:
        acc["sum"] += value * weight
        acc["weight"] += weight


def _finish(acc, kind):
    if not acc["has"]:
        return None
    if kind == "sum":
        return acc["sum"]
    return acc["sum"] / acc["weight"] if acc["weight"] else None


def _bucket_label(local_dt, granularity):
    if granularity == "MONTHLY":
        return local_dt.day, f"{local_dt.day:02d}"
    return local_dt.month, local_dt.strftime("%b")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def comparison_analytics(request):
    """Read-only analytics built from existing 60-second TelemetryAggregate rows."""
    params = request.query_params
    parameter = str(params.get("parameter", "energy")).strip().lower()
    granularity = str(params.get("granularity", "MONTHLY")).strip().upper()
    if parameter not in (*PARAMETERS.keys(), "energy_cost"):
        return Response({"status": "error", "message": "Unsupported parameter."}, status=400)
    if granularity not in ("MONTHLY", "YEARLY"):
        return Response({"status": "error", "message": "granularity must be MONTHLY or YEARLY."}, status=400)

    try:
        year = int(params.get("year"))
        month = int(params.get("month", timezone.localdate().month))
        if year < 2000 or year > timezone.localdate().year + 1:
            raise ValueError
        if granularity == "MONTHLY" and not 1 <= month <= 12:
            raise ValueError
        tariff = float(params.get("tariff_per_kwh", 0) or 0)
        if parameter == "energy_cost" and tariff <= 0:
            return Response({"status": "error", "message": "tariff_per_kwh must be greater than zero for energy cost."}, status=400)
    except (TypeError, ValueError):
        return Response({"status": "error", "message": "Invalid year, month, or tariff."}, status=400)

    compare_previous = str(params.get("compare_previous", "true")).lower() in ("1", "true", "yes", "on")
    tz = timezone.get_current_timezone()
    current_start, current_end, previous_start, previous_end = _period_bounds(granularity, year, month, tz)

    # Start with role-scoped registered devices. Never trust browser-provided
    # device/customer identifiers as an authorization boundary.
    allowed_ids = list(accessible_devices(request.user).values_list("ac_id", flat=True).distinct())
    if not allowed_ids:
        return Response({"status": "success", "meta": {"has_data": False}, "summary": {}, "period_comparison": [], "trend": [], "location_comparison": []})

    # Apply the exact same location-filter semantics as the existing /api/ac-data/ endpoint.
    filtered_records = filter_by_location([{"ac_id": ac_id} for ac_id in allowed_ids], request)
    device_ids = [record["ac_id"] for record in filtered_records]
    if not device_ids:
        return Response({"status": "success", "meta": {"has_data": False}, "summary": {}, "period_comparison": [], "trend": [], "location_comparison": []})

    start = previous_start if compare_previous else current_start
    rows = list(TelemetryAggregate.objects.filter(
        interval_seconds=60,
        device_id__in=device_ids,
        bucket_start__gte=start,
        bucket_start__lt=current_end,
    ).values(
        "device_id", "bucket_start", "sample_count", "energy_delta", "latest_relay",
        "avg_power", "power_sample_count", "avg_voltage", "voltage_sample_count",
        "avg_current", "current_sample_count", "avg_temperature", "temperature_sample_count",
        "avg_humidity", "humidity_sample_count", "latest_frequency", "latest_power_factor",
    ).order_by("bucket_start"))

    devices = ACDevice.objects.filter(ac_id__in=device_ids).select_related(
        "branch__customer", "branch__city__taluka__district__state",
        "branch__taluka__district__state", "branch__division__region__circle__zone",
        "site__branch__city__taluka__district__state", "site__branch__taluka__district__state",
        "site__branch__division__region__circle__zone", "site__floor",
    )
    device_locations = {device.ac_id: _device_location(device) for device in devices}

    kind = "sum" if parameter in ("energy", "energy_cost") else "average"
    current_total = _new_accumulator()
    previous_total = _new_accumulator()
    trend_current = defaultdict(_new_accumulator)
    trend_previous = defaultdict(_new_accumulator)
    current_by_location = defaultdict(_new_accumulator)
    previous_by_location = defaultdict(_new_accumulator)

    for row in rows:
        local_dt = timezone.localtime(row["bucket_start"], tz)
        in_current = current_start <= row["bucket_start"] < current_end
        in_previous = previous_start <= row["bucket_start"] < previous_end
        if not in_current and not (compare_previous and in_previous):
            continue
        value, weight = _row_value(row, parameter, tariff)
        if value is None:
            continue
        index, label = _bucket_label(local_dt, granularity)
        location = device_locations.get(row["device_id"], {"device_name": row["device_id"], "ac_id": row["device_id"]})
        location_label = _location_label(location, params)
        if in_current:
            _add(current_total, value, weight, kind)
            _add(trend_current[index], value, weight, kind)
            _add(current_by_location[location_label], value, weight, kind)
        elif in_previous:
            _add(previous_total, value, weight, kind)
            _add(trend_previous[index], value, weight, kind)
            _add(previous_by_location[location_label], value, weight, kind)

    current_value = _finish(current_total, kind)
    previous_value = _finish(previous_total, kind) if compare_previous else None
    difference = (current_value - previous_value) if current_value is not None and previous_value is not None else None
    percentage = (difference / previous_value * 100) if difference is not None and previous_value not in (0, None) else None

    max_index = monthrange(year, month)[1] if granularity == "MONTHLY" else 12
    trend = []
    for index in range(1, max_index + 1):
        current = _finish(trend_current[index], kind)
        previous = _finish(trend_previous[index], kind) if compare_previous else None
        label = f"{index:02d}" if granularity == "MONTHLY" else datetime(year, index, 1).strftime("%b")
        trend.append({"label": label, "current": round(current, 4) if current is not None else None,
                      "previous": round(previous, 4) if previous is not None else None})

    location_labels = sorted(set(current_by_location) | (set(previous_by_location) if compare_previous else set()))
    period_comparison = []
    location_comparison = []
    for label in location_labels:
        current = _finish(current_by_location[label], kind)
        previous = _finish(previous_by_location[label], kind) if compare_previous else None
        if current is not None or previous is not None:
            period_comparison.append({"label": label, "current": round(current, 4) if current is not None else 0,
                                      "previous": round(previous, 4) if previous is not None else 0})
        if current is not None:
            location_comparison.append({"label": label, "value": round(current, 4)})

    # Current month/year may be incomplete. Do not fabricate future zero readings;
    # the note tells the UI that the selected period is still in progress.
    now_local = timezone.localtime(timezone.now(), tz)
    is_incomplete = current_start <= now_local < current_end
    note = "Selected period is still in progress; future dates have no readings yet." if is_incomplete else ""
    unit = "₹" if parameter == "energy_cost" else PARAMETERS[parameter]["unit"]

    return Response({
        "status": "success",
        "meta": {
            "parameter": parameter,
            "unit": unit,
            "granularity": granularity,
            "selected_period": f"{year}-{month:02d}" if granularity == "MONTHLY" else str(year),
            "previous_period": (f"{(year - 1 if month == 1 else year):04d}-{(12 if month == 1 else month - 1):02d}" if granularity == "MONTHLY" else str(year - 1)) if compare_previous else None,
            "has_data": current_value is not None,
            "note": note,
        },
        "summary": {
            "current_value": round(current_value, 4) if current_value is not None else None,
            "previous_value": round(previous_value, 4) if previous_value is not None else None,
            "difference": round(difference, 4) if difference is not None else None,
            "percentage_change": round(percentage, 2) if percentage is not None else None,
        },
        "period_comparison": period_comparison,
        "trend": trend,
        "location_comparison": location_comparison,
    })
