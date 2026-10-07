
import logging
from urllib.parse import parse_qs, urlparse

import requests
from django.conf import settings
from rest_framework.exceptions import APIException

log = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://3tp.tapasyatech.in"
PAGE_SIZE = 100


# ───────────────────────── errors ─────────────────────────
class CloudError(Exception):
    def __init__(self, message, status=None, payload=None):
        super().__init__(message)
        self.status = status
        self.payload = payload


# Backwards-compat alias for anything (e.g. my earlier suggestion) importing
# CloudSyncError from this module.
CloudSyncError = CloudError


class CloudSyncFailed(APIException):
    status_code = 502
    default_detail = "Cloud synchronisation failed."
    default_code = "cloud_sync_failed"


# ───────────────────────── low level ─────────────────────────
def _base_url():
    return (getattr(settings, "TPT_BASE_URL", "") or DEFAULT_BASE_URL).rstrip("/")


def _timeout():
    return float(getattr(settings, "TPT_TIMEOUT", 15))


def cloud_enabled():
    return bool(getattr(settings, "TPT_SYNC_ENABLED", True))


def cloud_strict():
    return bool(getattr(settings, "TPT_CLOUD_STRICT", True))


def _handle_failure(exc, user=None):
    if cloud_strict():
        raise CloudSyncFailed(str(exc))
    log.warning("Cloud sync failed (kept local record): %s", exc)
    if user is not None:
        type(user).objects.filter(pk=user.pk).update(
            tpt_sync_status="FAILED", tpt_sync_error=str(exc)[:500])
    return ""


def _service_token():
    """Service-account token (reuses views._tpt_service_login). Lazy import."""
    try:
        from . import views
        return views._tpt_service_login()
    except Exception as exc:
        raise CloudError(
            f"Could not log in to the cloud with the service account: {exc}"
        )


def _message(data, response):
    if isinstance(data, dict):
        return (
            data.get("message")
            or data.get("detail")
            or data.get("error")
            or response.text[:200]
        )
    return (response.text or "")[:200]


def cloud_request(method, path, token, *, json=None, params=None, auth=True,
                  ok=(200, 201, 202, 204), retry_with_service=True):
    """Call the cloud. Returns (status_code, parsed_json_or_text)."""
    url = f"{_base_url()}{path}"

    def _send(tok):
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if auth:
            headers["X-Authorization"] = f"Bearer {tok}"
        try:
            return requests.request(
                method.upper(), url, json=json, params=params,
                headers=headers, timeout=_timeout(),
            )
        except requests.RequestException as exc:
            raise CloudError(f"Cloud network error ({method} {path}): {exc}")

    response = _send(token)

    if auth and retry_with_service and response.status_code in (401, 403):
        response = _send(_service_token())

    try:
        data = response.json()
    except ValueError:
        data = response.text or None

    if response.status_code not in ok:
        raise CloudError(
            f"Cloud {method.upper()} {path} failed ({response.status_code}): "
            f"{_message(data, response)}",
            status=response.status_code, payload=data,
        )
    return response.status_code, data


def extract_id(data):
    """3TP returns ids either flat or as {"id": {"id": "<uuid>", ...}}."""
    if not isinstance(data, dict):
        return ""
    for source in (
        data,
        data.get("data") if isinstance(data.get("data"), dict) else {},
    ):
        for key in ("id", "uuid", "pk"):
            value = source.get(key)
            if isinstance(value, dict):
                value = value.get("id") or value.get("uuid") or value.get("pk")
            if value:
                return str(value)
    return ""


def _set_fields(obj, **fields):
    """Persist only the columns that exist on the model."""
    names = {f.name for f in obj._meta.get_fields()}
    values = {k: v for k, v in fields.items() if k in names}
    if values:
        type(obj).objects.filter(pk=obj.pk).update(**values)
        for k, v in values.items():
            setattr(obj, k, v)


# ───────────────────────── customers ─────────────────────────
def customer_payload(customer):
    g = lambda name: (getattr(customer, name, "") or "")
    return {
        "title": g("company"),
        "email": g("company_email") or g("contact_person_email"),
        "phone": g("phone"),
        "address": g("address_line_1"),
        "address2": g("address_line_2"),
        "city": g("city"),
        "state": g("state"),
        "zip": g("pincode"),
        "country": "India",
        "additionalInfo": {
            "code": g("code"),
            "hierarchy_type": g("hierarchy_type"),
            "contact_person": g("contact_person"),
            "gstin": g("gstin"),
        },
    }


def find_cloud_customer_by_title(token, title):
    try:
        _, data = cloud_request("GET", "/api/tenant/customers", token,
                                params={"customerTitle": title})
        return extract_id(data)
    except CloudError:
        return ""


def ensure_cloud_customer(token, customer):
    """Returns (cloud_customer_id, created_now)."""
    existing = getattr(customer, "tpt_customer_id", "") or ""
    if existing:
        return existing, False

    created = True
    try:
        _, data = cloud_request(
            "POST", "/api/customer", token, json=customer_payload(customer),
        )
        cloud_id = extract_id(data)
    except CloudError as exc:
        if exc.status == 400 and "already exists" in str(exc).lower():
            cloud_id = find_cloud_customer_by_title(token, customer.company)
            created = False
            if not cloud_id:
                raise
        else:
            raise

    if not cloud_id:
        raise CloudError("Cloud created the customer but returned no id.")

    _set_fields(customer, tpt_customer_id=cloud_id)
    return cloud_id, created


def delete_cloud_customer(token, cloud_id):
    try:
        cloud_request("DELETE", f"/api/customer/{cloud_id}", token)
    except CloudError as exc:
        log.warning("Rollback: could not delete cloud customer %s: %s", cloud_id, exc)


# ───────────────────────── users ─────────────────────────
def _split_name(name, email):
    name = (name or "").strip() or email.split("@")[0]
    first, _, last = name.partition(" ")
    return first, last


def delete_cloud_user(token, cloud_id):
    try:
        cloud_request("DELETE", f"/api/user/{cloud_id}", token)
    except CloudError as exc:
        log.warning("Rollback: could not delete cloud user %s: %s", cloud_id, exc)


def create_cloud_user(token, *, email, name, phone, password,
                      customer_tpt_id=None, authority="CUSTOMER_USER"):
    """Create + activate a cloud user (POST /api/user, GET activationLinkInfo,
    POST /api/noauth/activate). Returns the cloud user id."""
    first, last = _split_name(name, email)
    payload = {
        "email": email,
        "authority": authority,
        "firstName": first,
        "lastName": last,
        "phone": phone or "",
    }
    if customer_tpt_id:
        payload["customerId"] = {"id": customer_tpt_id, "entityType": "CUSTOMER"}

    _, data = cloud_request(
        "POST", "/api/user", token, json=payload,
        params={"sendActivationMail": "false"},
    )
    cloud_id = extract_id(data)
    if not cloud_id:
        raise CloudError("Cloud created the user but returned no id.")

    try:
        _, link = cloud_request(
            "GET", f"/api/user/{cloud_id}/activationLinkInfo", token,
        )
        link = link.get("value") if isinstance(link, dict) else link
        activate_token = parse_qs(urlparse(link or "").query).get(
            "activateToken", [None]
        )[0]
        if not activate_token:
            raise CloudError("Cloud returned no activation token for the new user.")

        cloud_request(
            "POST", "/api/noauth/activate", None, auth=False,
            json={"activateToken": activate_token, "password": password},
            params={"sendActivationMail": "false"},
        )
    except CloudError:
        delete_cloud_user(token, cloud_id)
        raise

    return cloud_id


# ───────────────────────── provisioning (used by views) ─────────────────────────
def _provision_one_user(token, user, password):
    """
    Internal: create a 3TP user for a local User and store the cloud id.
    Used by both provision_customer (when handed a User) and provision_user.
    """
    from .models import Role

    if not cloud_enabled():
        return ""
    if user.role not in (Role.CUSTOMER, Role.BR_ADMIN, Role.ENGINEER):
        return ""   # Super admins are tenant admins — not managed from here

    try:
        if not user.customer_id:
            raise CloudError(
                "This user has no customer, so it cannot be created in the cloud."
            )

        cloud_customer_id, _ = ensure_cloud_customer(token, user.customer)
        uid = create_cloud_user(
            token,
            email=user.email,
            name=user.name,
            phone=user.phone,
            password=password,
            customer_tpt_id=cloud_customer_id,
        )
        type(user).objects.filter(pk=user.pk).update(
            tpt_user_id=uid, tpt_sync_status="SYNCED", tpt_sync_error="",
        )
        user.tpt_user_id = uid
        return uid
    except CloudError as exc:
        return _handle_failure(exc, user)


def provision_customer(token, obj, password=""):
    """
    Called by AdminListView.perform_create.

    Accepts EITHER a User (the admin just created) or a Customer (legacy call).

    - If passed a User: creates the matching 3TP user and stores its id.
      Returns the 3TP user id.
    - If passed a Customer: creates the Customer in 3TP (if missing) and also
      creates the primary login user for that customer if one exists locally.
      Returns the 3TP customer id.
    """
    from .models import Role, User

    if not cloud_enabled():
        return ""

    # ---- Case A: a User was passed (what views.py does now) ----
    if isinstance(obj, User):
        return _provision_one_user(token, obj, password)

    # ---- Case B: a Customer was passed (legacy behaviour) ----
    customer = obj
    try:
        cloud_id, created_now = ensure_cloud_customer(token, customer)

        login = User.objects.filter(customer=customer, role=Role.CUSTOMER).first()
        if login and password and not login.tpt_user_id:
            try:
                uid = create_cloud_user(
                    token, email=login.email, name=login.name, phone=login.phone,
                    password=password, customer_tpt_id=cloud_id,
                )
            except CloudError:
                if created_now:
                    delete_cloud_customer(token, cloud_id)
                raise
            User.objects.filter(pk=login.pk).update(
                tpt_user_id=uid, tpt_sync_status="SYNCED", tpt_sync_error="",
            )
        return cloud_id
    except CloudError as exc:
        return _handle_failure(exc)


def provision_user(token, user, password):
    """Cloud user for a local Customer / Branch-Admin / Engineer."""
    return _provision_one_user(token, user, password)


# ───────────────────────── reading from the cloud ─────────────────────────
def _paged(token, path, extra_params=None):
    rows, page = [], 0
    while True:
        params = {"pageSize": PAGE_SIZE, "page": page, **(extra_params or {})}
        _, data = cloud_request("GET", path, token, params=params)
        data = data if isinstance(data, dict) else {}
        rows.extend(data.get("data", []))
        if not data.get("hasNext"):
            return rows
        page += 1


def fetch_cloud_customers(token):
    return _paged(token, "/api/customers")


def fetch_cloud_users(token, customer_tpt_id=None):
    if customer_tpt_id:
        return _paged(token, f"/api/customer/{customer_tpt_id}/users")
    try:
        return _paged(token, "/api/users")
    except CloudError as exc:
        if exc.status != 404:
            raise

    rows = []
    for customer in fetch_cloud_customers(token):
        rows.extend(_paged(token, f"/api/customer/{extract_id(customer)}/users"))
    return rows


def _nested(row, key):
    value = row.get(key)
    return value.get("id") if isinstance(value, dict) else value


def annotate_users_with_local(rows):
    """Flatten cloud users and mark which exist in the local DB (by email)."""
    from django.db.models.functions import Lower
    from .models import User

    emails = [(r.get("email") or "").lower() for r in rows]
    local = {u.e: u for u in User.objects.annotate(e=Lower("email")).filter(e__in=emails)}

    out = []
    for r in rows:
        email = (r.get("email") or "").lower()
        match = local.get(email)
        out.append({
            "cloud_id": _nested(r, "id"),
            "email": r.get("email"),
            "first_name": r.get("firstName") or "",
            "last_name": r.get("lastName") or "",
            "phone": r.get("phone") or "",
            "authority": r.get("authority"),
            "cloud_customer_id": _nested(r, "customerId"),
            "created_time": r.get("createdTime"),
            "in_local": match is not None,
            "local_id": str(match.pk) if match else None,
            "local_role": match.role if match else None,
        })
    return out

