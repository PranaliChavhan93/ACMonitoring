
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

def start():
    global _worker_started

    with _worker_lock:
        if _worker_started:
            return

        _worker_started = True

        thread = threading.Thread(
            target=_background_loop,
            daemon=True,
            name="3TP-Telemetry-Worker",
        )

        thread.start()

        log.info("3TP telemetry worker started")

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


def _get_history(cfg, device_id, start_ms, end_ms):
    url = (f"{cfg['base_url']}/api/plugins/telemetry/DEVICE/{device_id}"
           f"/values/timeseries/history?keys=data&startTs={start_ms}&endTs={end_ms}"
           f"&limit=1&orderBy=DESC")
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
def _latest_reading(resp):
    """(ts_ms, payload_dict) of the newest sample in a 3TP response, or (None, None)."""
    samples = []
    if isinstance(resp, dict) and isinstance(resp.get("data"), list):
        samples = resp["data"]
    elif isinstance(resp, list):
        samples = resp
    elif isinstance(resp, dict) and "values" in resp:
        samples = [resp]
    if not samples:
        return None, None
    best = max(samples, key=lambda s: s.get("ts", 0))
    payload = best.get("value")
    if payload is None:
        payload = (best.get("values") or {}).get("data")
    if isinstance(payload, str):
        payload = json.loads(payload)
    return best.get("ts"), (payload if isinstance(payload, dict) else None)


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

