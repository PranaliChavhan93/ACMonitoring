
import json
import logging
import os
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from .telemetry_aggregate import ingest_payload

from django.conf import settings

log = logging.getLogger("telemetry")


DATA_DIR = os.path.join(settings.BASE_DIR, "data")
DEVICES_FILE = os.path.join(DATA_DIR, "3tp_devices.json")
CONFIG_FILE = os.path.join(DATA_DIR, "3tp_config.json")

CACHE_SEC = float(os.environ.get("TPT_CACHE_SEC", "2"))
# LOOKBACK_SEC = int(os.environ.get("TPT_LOOKBACK_SEC", "86400"))

LOOKBACK_SEC = int( os.environ.get("TPT_LOOKBACK_SEC", str(7 * 24 * 60 * 60)) )
OFFLINE_ERROR_AFTER = 7 * 24 * 60 * 60
STALE_SEC = int(os.environ.get("TPT_STALE_SEC", "120"))
TIMEOUT = float(os.environ.get("TPT_TIMEOUT", "8"))

IST = timezone(timedelta(hours=5, minutes=30))

STALE_SEC = 60

# --- history back-fill -------------------------------------------------------
# While the Django process is stopped nobody polls 3TP, so the minutes in
# between never reach telemetry_aggregate.  The back-fill pulls every sample
# 3TP stored for the gap and feeds it through the normal ingest path.
BACKFILL_ENABLED = os.environ.get("TPT_BACKFILL_ENABLED", "1") != "0"
BACKFILL_DAYS = int(os.environ.get("TPT_BACKFILL_DAYS", "7"))      # first run / empty DB
BACKFILL_PAGE = int(os.environ.get("TPT_BACKFILL_PAGE", "1000"))   # samples per 3TP request
BACKFILL_GAP_SEC = int(os.environ.get("TPT_BACKFILL_GAP_SEC", "180"))
BACKFILL_RETRY_SEC = int(os.environ.get("TPT_BACKFILL_RETRY_SEC", "60"))
BACKFILL_MAX_PAGES = 500

class TelemetryError(Exception):
    pass


_lock = threading.Lock()
_live = {}
_token = {"value": None}
_state = {"last_fetch": 0.0, "last_ok": None, "last_error": None}

_worker_started = False
_worker_lock = threading.Lock()

def _config():
    cfg = {}
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r", encoding="utf-8-sig") as f:
            cfg = json.load(f)
    return {
        "base_url": (os.environ.get("TPT_BASE_URL") or cfg.get("base_url")
                     or "https://3tp.tapasyatech.in").rstrip("/"),
        "username": os.environ.get("TPT_USERNAME") or cfg.get("username", ""),
        "password": os.environ.get("TPT_PASSWORD") or cfg.get("password", ""),
    }


def _devices():
    """
    Devices to poll.

    The database (ACDevice rows that have a 3TP device id) is the source of
    truth, so a device created/assigned in the UI is polled automatically.
    data/3tp_devices.json is still honoured as a fallback / seed list; its
    entries win when the same ac_id appears in both.
    """
    devs = {}

    if os.path.exists(DEVICES_FILE):
        try:
            with open(DEVICES_FILE, "r", encoding="utf-8-sig") as f:
                for d in json.load(f) or []:
                    if isinstance(d, dict) and d.get("ac_id") and d.get("device_id"):
                        devs[d["ac_id"]] = d
        except (OSError, ValueError) as exc:
            log.warning("Could not read %s: %s", DEVICES_FILE, exc)

    try:
        from .models import ACDevice
        rows = (
            ACDevice.objects
            .exclude(tpt_device_id__isnull=True)
            .exclude(tpt_device_id="")
            .values("ac_id", "device_name", "tpt_device_id")
        )
        for row in rows:
            devs.setdefault(row["ac_id"], {
                "ac_id": row["ac_id"],
                "device_id": row["tpt_device_id"],
                "device_name": row["device_name"] or row["ac_id"],
            })
    except Exception as exc:  # DB not ready (migrations etc.) - JSON still works
        log.debug("Device table not available for telemetry: %s", exc)

    if not devs:
        raise TelemetryError(
            "No devices to poll (no ACDevice with a 3TP id and no 3tp_devices.json)"
        )
    return list(devs.values())

def _background_loop():
    while True:
        try:
            from django.db import close_old_connections
            close_old_connections()
            with _lock:
                _refresh()
        except Exception as e:
            log.exception("Background Refresh Failed")
            _state["last_error"] = str(e)

        time.sleep(CACHE_SEC)


def _backfill_loop():
    """Own thread: a long back-fill must never hold up live polling."""
    from django.db import close_old_connections
    first = True
    while True:
        try:
            close_old_connections()
            backfill_all(force=first)
            first = False
        except Exception:
            log.exception("Back-fill loop failed")
        time.sleep(BACKFILL_RETRY_SEC)


def start(live=True):
    """live=False: history back-fill only (used when devices push telemetry)."""
    global _worker_started

    with _worker_lock:
        if _worker_started:
            return
        _worker_started = True

        if live:
            threading.Thread(target=_background_loop, daemon=True,
                             name="3TP-Telemetry-Worker").start()
            log.info("3TP telemetry worker started")
        if BACKFILL_ENABLED:
            threading.Thread(target=_backfill_loop, daemon=True,
                             name="3TP-Backfill-Worker").start()
            log.warning("3TP history back-fill worker started (last %s days)", BACKFILL_DAYS)

def _request(url, payload=None, headers=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json", **(headers or {})},
        method="POST" if data is not None else "GET")
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _login(cfg):
    if not (cfg["username"] and cfg["password"]):
        raise TelemetryError(
            "3TP credentials missing: set TPT_USERNAME / TPT_PASSWORD "
            "or create data/3tp_config.json")
    res = _request(f"{cfg['base_url']}/api/auth/login",
                   {"username": cfg["username"], "password": cfg["password"]})
    _token["value"] = res["token"]


def _get_history(cfg, device_id, start_ms, end_ms, limit=1, order="DESC"):
    url = (f"{cfg['base_url']}/api/plugins/telemetry/DEVICE/{device_id}"
           f"/values/timeseries/history?keys=data&startTs={start_ms}&endTs={end_ms}"
           f"&limit={limit}&orderBy={order}")
    if not _token["value"]:
        _login(cfg)
    try:
        return _request(url, headers={"X-Authorization": f"Bearer {_token['value']}"})
    except urllib.error.HTTPError as e:
        if e.code == 401:
            _login(cfg)
            return _request(url, headers={"X-Authorization": f"Bearer {_token['value']}"})
        raise


# ───────────────────────── parsing ─────────────────────────
def _samples(resp):
    """Every sample in a 3TP response (any of the response shapes it uses)."""
    if isinstance(resp, dict) and isinstance(resp.get("data"), list):
        return resp["data"]
    if isinstance(resp, list):
        return resp
    if isinstance(resp, dict) and "values" in resp:
        return [resp]
    return []


def _payload_of(sample):
    payload = sample.get("value")
    if payload is None:
        payload = (sample.get("values") or {}).get("data")
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except ValueError:
            return None
    return payload if isinstance(payload, dict) else None


def _latest_reading(resp):
    """(ts_ms, payload_dict) of the newest sample in a 3TP response, or (None, None)."""
    samples = _samples(resp)
    if not samples:
        return None, None
    best = max(samples, key=lambda s: s.get("ts", 0))
    return best.get("ts"), _payload_of(best)


def _num(v, default=0.0):
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _status(record_ts, relay):
    if time.time() - record_ts > STALE_SEC:
        return "OFFLINE"
    return "ON" if relay else "OFF"


def to_record(device, ts_ms, p):
    """Convert 3TP telemetry and force relay OFF when telemetry is stale."""
    ts = datetime.fromtimestamp(ts_ms / 1000, IST)
    ac_id = device["ac_id"]

    # The timestamp is the time of the latest reading reported by 3TP.
    age_seconds = time.time() - ts.timestamp()
    is_stale = age_seconds >= STALE_SEC

    # Preserve the actual relay value while telemetry is fresh.
    actual_relay = int(_num(p.get("relay"), 0))

    # Treat a device as OFF after 60 seconds without fresh telemetry.
    relay = 0 if is_stale else actual_relay
    status = "OFFLINE" if is_stale else ("ON" if relay == 1 else "OFF")

    return {
        "ac_id": ac_id,
        "site_id": ac_id,
        "device_name": device.get("device_name") or ac_id,
        "voltage": _num(p.get("voltage")),
        "current": _num(p.get("current")),
        "active_power": _num(p.get("power")),
        "energy_consumption": _num(p.get("energy")),
        "frequency": _num(p.get("frequency")),
        "power_factor": _num(p.get("power_factor")),
        "ac_on_time": None,
        "ac_off_time": None,
        "temperature": _num(p.get("indoor_temperature")),
        "humidity": _num(p.get("indoor_humidity")),
        "alarm_status": int(_num(p.get("alarm_status"), 0)),
        "relay": relay,
        "status": status,
        "timestamp": ts.isoformat(timespec="seconds"),
        "source": "3tp",
    }


def _fetch_device(cfg, dev, start_ms, end_ms):
    resp = _get_history(
        cfg,
        dev["device_id"],
        start_ms,
        end_ms
    )
    ts, payload = _latest_reading(resp)
    if payload is None:
        return None

    record = to_record(dev, ts, payload)
    return record

def _get_saved_record(device):
    """
    Recover the latest saved telemetry after a device stops reporting
    or the application restarts.
    """
    try:
        from .telemetry_aggregate import _record_from_row
        from .models import TelemetryAggregate, ACDevice

        row = (
            TelemetryAggregate.objects
            .filter(
                device_id=device["ac_id"],
                interval_seconds=60,
            )
            .order_by("-bucket_start")
            .first()
        )

        if row is None or row.last_timestamp is None:
            return None

        name = (
            ACDevice.objects
            .filter(ac_id=device["ac_id"])
            .values_list("device_name", flat=True)
            .first()
        )

        record = _record_from_row(row, name)

        age_seconds = max(
            0,
            (datetime.now(timezone.utc) - row.last_timestamp).total_seconds(),
        )

        record["last_seen"] = record["timestamp"]

        if age_seconds > OFFLINE_ERROR_AFTER:
            record["status"] = "ERROR"
            record["message"] = (
                "Device has been offline for more than 7 days."
            )
        else:
            record["status"] = "OFFLINE"

        record["offline_duration_seconds"] = int(age_seconds)

        return record

    except Exception:
        log.exception(
            "Failed to recover saved telemetry for %s",
            device.get("ac_id"),
        )
        return None


# ───────────────────────── history back-fill ─────────────────────────
_backfill_tried = {}   # ac_id -> time.time() of the last attempt


def _missing_ranges(ac_id, floor_ms, end_ms):
    """[(start_ms, end_ms)] holes in the stored 1-minute data, anywhere in the window.

    Looking only after the newest stored reading is not enough: the live poller
    saves the newest reading as soon as the server starts, so the hole is
    *before* it (e.g. last night) and would never be refilled.
    """
    from .models import TelemetryAggregate
    from datetime import datetime, timezone as tz
    rows = (TelemetryAggregate.objects
            .filter(device_id=ac_id, interval_seconds=60,
                    last_timestamp__gte=datetime.fromtimestamp(floor_ms / 1000, tz.utc))
            .order_by("bucket_start").values_list("first_timestamp", "last_timestamp"))
    gap_ms = BACKFILL_GAP_SEC * 1000
    ranges, cursor = [], floor_ms
    for first, last in rows.iterator():
        first_ms = int((first or last).timestamp() * 1000)
        last_ms = int(last.timestamp() * 1000)
        if first_ms - cursor > gap_ms:
            ranges.append((cursor + 1 if cursor > floor_ms else cursor, first_ms - 1))
        cursor = max(cursor, last_ms)
    if end_ms - cursor > gap_ms:
        ranges.append((cursor + 1 if cursor > floor_ms else cursor, end_ms))
    return ranges


def _store_samples(ac_id, samples):
    """Write already-sorted (ts_ms, payload) pairs straight into 1-minute rows.

    Same maths as telemetry_aggregate._apply_reading (sums / avg / min / max /
    latest / energy counter delta) but done in memory and written with one
    bulk insert per page -- 100x faster than ingesting reading by reading.
    Minutes that already exist are left untouched.
    Returns (rows_created, counter_before_first_row, last_counter, last_bucket).
    """
    from datetime import datetime, timezone as tz
    from .models import TelemetryAggregate as T
    from .telemetry_aggregate import METRICS, _number

    if not samples:
        return 0, None, None, None
    utc = tz.utc
    first_bucket = datetime.fromtimestamp(samples[0][0] // 60_000 * 60, utc)
    last_bucket = datetime.fromtimestamp(samples[-1][0] // 60_000 * 60, utc)
    base = T.objects.filter(device_id=ac_id, interval_seconds=60)
    existing = dict(base.filter(bucket_start__gte=first_bucket, bucket_start__lte=last_bucket)
                    .values_list("bucket_start", "latest_energy_counter"))
    anchor = prev = base.filter(bucket_start__lt=first_bucket).order_by("-bucket_start") \
        .values_list("latest_energy_counter", flat=True).first()

    groups = {}
    for ts_ms, payload in samples:
        groups.setdefault(ts_ms // 60_000, []).append((ts_ms, payload))

    rows, last_counter = [], None
    for minute in sorted(groups):
        bucket = datetime.fromtimestamp(minute * 60, utc)
        if bucket in existing:
            if existing[bucket] is not None:
                prev = existing[bucket]
            continue
        row = T(device_id=ac_id, bucket_start=bucket, interval_seconds=60,
                first_timestamp=datetime.fromtimestamp(groups[minute][0][0] / 1000, utc),
                last_timestamp=datetime.fromtimestamp(groups[minute][-1][0] / 1000, utc))
        n, delta = 0, 0.0
        for _ts, values in groups[minute]:
            for _key, (src, latest_f, sum_f, avg_f, min_f, max_f) in METRICS.items():
                val = _number(values.get(src))
                if val is None:
                    continue
                setattr(row, latest_f, val)
                setattr(row, sum_f, getattr(row, sum_f) + val)
                setattr(row, avg_f, getattr(row, sum_f) / (n + 1))
                if min_f:
                    old = getattr(row, min_f)
                    setattr(row, min_f, val if old is None else min(old, val))
                if max_f:
                    old = getattr(row, max_f)
                    setattr(row, max_f, val if old is None else max(old, val))
            n += 1
            energy = _number(values.get("energy"))
            if energy is not None:
                if prev is not None and energy >= prev:
                    delta += energy - prev
                prev = last_counter = energy
                row.latest_energy_counter = energy
            for src, attr in (("frequency", "latest_frequency"), ("power_factor", "latest_power_factor")):
                v = _number(values.get(src))
                if v is not None:
                    setattr(row, attr, v)
            for src, attr in (("alarm_status", "latest_alarm_status"), ("relay", "latest_relay")):
                v = _number(values.get(src))
                if v is not None:
                    setattr(row, attr, int(v))
        row.sample_count, row.energy_delta = n, delta
        rows.append(row)
    T.objects.bulk_create(rows, batch_size=500, ignore_conflicts=True)
    return len(rows), anchor, last_counter, last_bucket


def _pull_range(cfg, dev, start_ms, end_ms):
    from .models import TelemetryAggregate as T
    ac_id, created = dev["ac_id"], 0
    anchor, last_counter, last_bucket, first_page = None, None, None, True
    for _ in range(BACKFILL_MAX_PAGES):
        resp = _get_history(cfg, dev["device_id"], start_ms, end_ms,
                            limit=BACKFILL_PAGE, order="ASC")
        samples = sorted((s for s in _samples(resp) if s.get("ts")), key=lambda s: s["ts"])
        if not samples:
            break
        pairs = [(int(s["ts"]), p) for s in samples if (p := _payload_of(s))]
        n, a, lc, lb = _store_samples(ac_id, pairs)
        created += n
        if first_page:
            anchor, first_page = a, False
        last_counter = lc if lc is not None else last_counter
        last_bucket = lb or last_bucket
        newest = samples[-1]["ts"]
        if len(samples) < BACKFILL_PAGE or newest < start_ms:
            break
        start_ms = newest + 1
    # The bucket right after the hole already holds the whole hole's energy
    # (counter jump) -- take back what the new rows now account for.
    if created and anchor is not None and last_counter is not None and last_counter >= anchor:
        nxt = (T.objects.filter(device_id=ac_id, interval_seconds=60, bucket_start__gt=last_bucket)
               .order_by("bucket_start").first())
        if nxt is not None:
            nxt.energy_delta = max(0.0, (nxt.energy_delta or 0) - (last_counter - anchor))
            nxt.save(update_fields=["energy_delta"])
    return created


def backfill_device(cfg, dev, force=False):
    """Fill every hole in this device's stored history from 3TP.

    Holes are found by scanning the stored minutes (not just "after the newest
    one"), each is pulled oldest -> newest, and the device is always stored
    under its registered ac_id so two devices can never share a series.
    """
    ac_id = dev["ac_id"]
    now = time.time()
    if not force and now - _backfill_tried.get(ac_id, 0) < BACKFILL_RETRY_SEC:
        return 0
    _backfill_tried[ac_id] = now

    end_ms = int(now * 1000)
    floor_ms = end_ms - BACKFILL_DAYS * 86_400_000
    accepted = 0
    for start_ms, stop_ms in _missing_ranges(ac_id, floor_ms, end_ms):
        accepted += _pull_range(cfg, dev, start_ms, stop_ms)
    log.warning("Back-fill %s: %s minute rows added", ac_id, accepted)
    return accepted


def backfill_all(force=False):
    """Back-fill every known device; one failing device never blocks the rest."""
    if not BACKFILL_ENABLED:
        return
    now = time.time()
    if not force and now - _backfill_tried.get("__all__", 0) < 30:
        return
    _backfill_tried["__all__"] = now
    try:
        cfg, devices = _config(), _devices()
    except Exception as exc:
        log.warning("Back-fill skipped: %s", exc)
        return
    for dev in devices:
        try:
            backfill_device(cfg, dev, force=force)
        except Exception:
            log.exception("Back-fill failed for %s", dev.get("ac_id"))


def _refresh():
    """Fetch telemetry for every device, update cache, and store aggregates."""
    cfg = _config()
    devices = _devices()

    end_ms = int(time.time() * 1000)
    start_ms = end_ms - LOOKBACK_SEC * 1000

    errors = []

    if not devices:
        _state["last_fetch"] = time.time()
        _state["last_error"] = "No devices configured."
        log.warning("No devices configured for telemetry fetching.")
        return

    with ThreadPoolExecutor(max_workers=min(8, len(devices))) as pool:
        futures = [
            (dev, pool.submit(_fetch_device, cfg, dev, start_ms, end_ms))
            for dev in devices
        ]

        for dev, fut in futures:
            device_id = dev.get("ac_id") or dev.get("device_id")

            try:
                # Fetch the latest telemetry from 3TP.
                rec = fut.result()

                # If 3TP returns no new record, recover the last saved reading.
                if rec is None:
                    rec = _get_saved_record(dev)

                # No live or saved reading is available for this device.
                if not rec:
                    log.warning(
                        "No telemetry available for device %s",
                        device_id,
                    )
                    continue

                # Update the in-memory cache, preserving the last known values.
                _live[rec["ac_id"]] = rec

                # Store the reading in the local 60-second aggregate table.
                # Duplicate timestamps are expected to be ignored by ingest_payload.
                try:
                    ingest_payload({
                        "ac_id": rec["ac_id"],
                        "ts": rec["timestamp"],
                        "voltage": rec.get("voltage"),
                        "current": rec.get("current"),
                        "power": rec.get("active_power"),
                        "energy": rec.get("energy_consumption"),
                        "frequency": rec.get("frequency"),
                        "power_factor": rec.get("power_factor"),
                        "indoor_temperature": rec.get("temperature"),
                        "indoor_humidity": rec.get("humidity"),
                        "alarm_status": rec.get("alarm_status"),
                        "relay": rec.get("relay"),
                    })
                except Exception:
                    log.exception(
                        "Failed to aggregate telemetry for device %s",
                        device_id,
                    )

            except Exception as e:
                errors.append(f"{device_id}: {e}")
                log.exception(
                    "Failed to fetch telemetry for device %s",
                    device_id,
                )

    _state["last_fetch"] = time.time()

    if errors:
        _state["last_error"] = "; ".join(errors)
        log.warning("3TP fetch errors: %s", errors)
    else:
        _state["last_ok"] = time.time()
        _state["last_error"] = None

def get_records():
    with _lock:
        out = []
        now = time.time()

        # Recover persisted records if the process restarted and
        # the in-memory cache is empty.
        if not _live:
            try:
                from .telemetry_aggregate import get_latest_records

                for record in get_latest_records():
                    _live[record["ac_id"]] = record

            except Exception:
                log.exception("Failed to recover telemetry cache")

        for rec in _live.values():
            r = dict(rec)

            try:
                last_timestamp = datetime.fromisoformat(
                    r["timestamp"]
                ).timestamp()

                age_seconds = max(0, now - last_timestamp)

            except (KeyError, TypeError, ValueError):
                age_seconds = None

            if age_seconds is None:
                r["status"] = "UNKNOWN"
                r["message"] = "Last telemetry timestamp is unavailable."

            elif age_seconds > OFFLINE_ERROR_AFTER:
                r["status"] = "ERROR"
                r["message"] = (
                    "Device has been offline for more than 7 days."
                )
                r["last_seen"] = r.get("timestamp")
                r["offline_duration_seconds"] = int(age_seconds)

            elif age_seconds >= STALE_SEC:
                # Preserve the last telemetry values.
                # Do not overwrite voltage, current, energy, etc.
                r["status"] = "OFFLINE"
                r["last_seen"] = r.get("timestamp")
                r["offline_duration_seconds"] = int(age_seconds)

            out.append(r)

        if not out:
            raise TelemetryError(
                _state["last_error"]
                or "No telemetry data available yet"
            )

        return out

    
def get_status():
    with _lock:
        return {
            "devices_live": len(_live),
            "last_ok": _state["last_ok"],
            "last_error": _state["last_error"],
            "cache_sec": CACHE_SEC,
        }

