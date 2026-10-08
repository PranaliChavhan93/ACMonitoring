
import json
import logging
import os
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from django.conf import settings

log = logging.getLogger("telemetry")

DATA_DIR = os.path.join(settings.BASE_DIR, "data")
DEVICES_FILE = os.path.join(DATA_DIR, "3tp_devices.json")
CONFIG_FILE = os.path.join(DATA_DIR, "3tp_config.json")

CACHE_SEC = float(os.environ.get("TPT_CACHE_SEC", "2"))
LOOKBACK_SEC = int(os.environ.get("TPT_LOOKBACK_SEC", "86400"))
STALE_SEC = int(os.environ.get("TPT_STALE_SEC", "120"))
TIMEOUT = float(os.environ.get("TPT_TIMEOUT", "8"))

IST = timezone(timedelta(hours=5, minutes=30))

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
    if not os.path.exists(DEVICES_FILE):
        raise TelemetryError(f"{DEVICES_FILE} not found")
    with open(DEVICES_FILE, "r", encoding="utf-8-sig") as f:
        devs = json.load(f)
    if not devs:
        raise TelemetryError("3tp_devices.json has no devices")
    return devs

def _background_loop():
    while True:
        try:
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
    """3TP payload -> the record shape the dashboards already consume."""
    ts = datetime.fromtimestamp(ts_ms / 1000, IST)
    ac_id = device["ac_id"]
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
        "relay": int(_num(p.get("relay"), 0)),
        "status": _status(ts.timestamp(), int(_num(p.get("relay"), 0)) == 1),
        "timestamp": ts.isoformat(timespec="seconds"),
        "source": "3tp",
    }


# ───────────────────────── fetching ─────────────────────────
# def _fetch_device(cfg, dev, start_ms, end_ms):
#     resp = _get_history(cfg, dev["device_id"], start_ms, end_ms)
#     ts, payload = _latest_reading(resp)
#     if payload is None:
#         return None
#     return to_record(dev, ts, payload)


def _fetch_device(cfg, dev, start_ms, end_ms):
    print("\n========== 3TP DEVICE DEBUG ==========")
    print("AC ID:", dev.get("ac_id"))
    print("DEVICE ID:", dev.get("device_id"))

    resp = _get_history(
        cfg,
        dev["device_id"],
        start_ms,
        end_ms
    )

    print("3TP RESPONSE TYPE:", type(resp))
    print("3TP RESPONSE KEYS:",
          resp.keys() if isinstance(resp, dict) else None)

    ts, payload = _latest_reading(resp)

    print("LATEST TS:", ts)
    print("LATEST PAYLOAD:", payload)

    if payload is None:
        print("❌ PAYLOAD IS NONE")
        return None

    record = to_record(dev, ts, payload)

    print("✅ FINAL RECORD:")
    print(record)
    print("======================================\n")

    return record

def _refresh():
    """Call 3TP for every device and update the cache. Caller holds _lock."""
    cfg = _config()
    devices = _devices()
    end_ms = int(time.time() * 1000)
    start_ms = end_ms - LOOKBACK_SEC * 1000

    errors = []
    with ThreadPoolExecutor(max_workers=min(8, len(devices))) as pool:
        futures = [(d, pool.submit(_fetch_device, cfg, d, start_ms, end_ms)) for d in devices]
        for dev, fut in futures:
            try:
                rec = fut.result()
                if rec:
                    _live[rec["ac_id"]] = rec
            except Exception as e:
                errors.append(f"{dev.get('ac_id') or dev.get('device_id')}: {e}")

    _state["last_fetch"] = time.time()
    if errors:
        _state["last_error"] = "; ".join(errors)
        log.warning("3TP fetch errors: %s", errors)
    else:
        _state["last_ok"] = time.time()
        _state["last_error"] = None


def get_records():
    with _lock:

        if not _live:
            raise TelemetryError(
                _state["last_error"] or
                "No telemetry data available yet"
            )

        out = []

        for rec in _live.values():
            r = dict(rec)

            if r["status"] != "OFFLINE":
                age = (
                    time.time()
                    - datetime.fromisoformat(
                        r["timestamp"]
                    ).timestamp()
                )

                if age > STALE_SEC:
                    r["status"] = "OFFLINE"

            out.append(r)

        return out

def get_status():
    with _lock:
        return {
            "devices_live": len(_live),
            "last_ok": _state["last_ok"],
            "last_error": _state["last_error"],
            "cache_sec": CACHE_SEC,
        }

