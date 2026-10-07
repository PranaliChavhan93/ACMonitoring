# My current view

import json
import os
import time
import threading
import traceback
import hashlib

import requests

from django.conf import settings
from django.contrib.auth import (
    login as django_login,
    logout as django_logout,
)
from django.core.cache import cache
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone

from rest_framework import status, generics, permissions, filters
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import AllowAny, BasePermission, SAFE_METHODS, IsAuthenticated
from rest_framework.response import Response

# from backend.account.cloud_sync import provision_customer, provision_user, create_3tp_customer_user
from .cloud_sync import provision_customer, provision_user

from .models import (
    LocationCircle,
    LocationState,
    LocationZone,
    User,
    Organization,
    Customer,
    Zone,
    Circle,
    Region,
    Division,
    State,
    District,
    Taluka,
    City,
    Branch,
    Floor,
    Site,
    ACDevice,
    Role,
    DashboardPreference,
)

from .serializers import (
    AdminSerializer,
    CitySerializer,
    DivisionSerializer,
    FloorSerializer,
    RegionSerializer,
    TalukaSerializer,
    UserSerializer,
    OrganizationSerializer,
    CustomerSerializer,
    DashboardPreferenceSerializer,
    ZoneSerializer,
    CircleSerializer,
    StateSerializer,
    DistrictSerializer,
    BranchSerializer,
    SiteSerializer,
)

from .permissions import (
    CustomerScopeMixin,
    IsOrgSuperAdmin,
    IsOrgAdminOrCustomerAdmin,
)

from collections import defaultdict
from django.db.models import Q

from . import ownership
from . import telemetry

class ReadOnlyOrAuthenticated(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated)


BASE_DATA_DIR = os.path.join(settings.BASE_DIR, "data")

DATA_FILE                  = os.path.join(BASE_DATA_DIR, "ac_data.json")
GEOGRAPHICAL_LOCATION_FILE = os.path.join(BASE_DATA_DIR, "locationData_geographical.json")
ZONAL_LOCATION_FILE        = os.path.join(BASE_DATA_DIR, "locationData_zonal.json")
DEVICE_LOCATION_MAP_FILE   = os.path.join(BASE_DATA_DIR, "DeviceLocationMap.json")

CLOUD_URL = (getattr(settings, "TPT_BASE_URL", "") or "https://3tp.tapasyatech.in").rstrip("/")


TPT_ENDPOINTS = {
    "login":    "/api/auth/login",
    "customer": "/api/customer",
    "site":     "/api/asset",
    "device":   "/api/device",
}

from rest_framework.exceptions import APIException


class ThreeTPAPIError(APIException):
    status_code = 502
    default_detail = "3TP request failed."


def _one_line(exc, n=300):
    return " ".join(str(exc).split())[:n]


def ensure_tpt_customer_id(request, customer):
    """Customer's 3TP id; if missing (legacy row) find it in 3TP by email and save it."""
    tid = getattr(customer, "tpt_customer_id", "") or ""
    if tid:
        return tid
    email = (customer.company_email or "").lower()
    for c in fetch_3tp_customers(request):
        if (c.get("email") or "").lower() == email:
            tid = c["id"]["id"]
            if _customer_has_field("tpt_customer_id"):
                customer.tpt_customer_id = tid
                customer.save(update_fields=["tpt_customer_id"])
            return tid
    raise ThreeTPError(f"Customer '{customer.company}' does not exist in 3TP.")


def fetch_3tp_customer_users(request, tpt_customer_id):
    out, page, total = [], 0, 1
    while page < total:
        res = requests.get(
            f"{CLOUD_URL}/api/customer/{tpt_customer_id}/users",
            params={"pageSize": 1000, "page": page,
                    "sortProperty": "createdTime", "sortOrder": "DESC"},
            headers=_tpt_user_headers(request), timeout=15,
        )
        if res.status_code != 200:
            raise ThreeTPError("Failed to fetch users from 3TP.",
                               status=res.status_code, payload=res.text)
        data = res.json()
        out.extend(data.get("data", []))
        total = data.get("totalPages", 1)
        page += 1
    return out

def find_3tp_customer_by_title(request, title):
    title = (title or "").strip().lower()
    for c in fetch_3tp_customers(request):
        if (c.get("title") or c.get("name") or "").strip().lower() == title:
            return c
    return None

def find_3tp_user_id(request, tpt_customer_id, email):
    email = (email or "").lower()
    for u in fetch_3tp_customer_users(request, tpt_customer_id):
        if (u.get("email") or "").lower() == email:
            return _id_of(u)
    return ""

class ThreeTPUserMixin:
    """List (3TP ∩ local), create (3TP then local), update/delete (kept in sync)."""

    def build_extra(self, serializer):
        """Return kwargs for serializer.save(); must include 'customer'."""
        raise NotImplementedError

    # ------------------------------------------------------------- LIST
    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        warning = None
        try:
            qs = keep_users_present_in_3tp(request, qs)
        except (ThreeTPError, requests.RequestException, KeyError, ValueError) as exc:
            warning = _one_line(exc, 200)          # fall back to local data

        page = self.paginate_queryset(qs)
        data = self.get_serializer(page if page is not None else qs, many=True).data
        resp = self.get_paginated_response(data) if page is not None else Response(data)
        if warning:
            resp["X-3TP-Warning"] = warning
        return resp

    # ----------------------------------------------------------- CREATE
    def perform_create(self, serializer):
        request = self.request
        if not _raw_token(request):
            raise DRFValidationError({"detail": "Auth token required."})

        vd = serializer.validated_data
        extra = self.build_extra(serializer)
        customer = extra.get("customer")
        if customer is None:
            raise DRFValidationError({"customer": "Customer is required."})

        email = (vd.get("email") or "").strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise DRFValidationError({"email": "A user with this email already exists."})

        raw_password = vd.get("password") or generate_password()

        try:
            tpt_cid = ensure_tpt_customer_id(request, customer)
            tpt_uid = create_3tp_user(
                request, email=email, name=vd.get("name"), phone=vd.get("phone"),
                tpt_customer_id=tpt_cid, raw_password=raw_password,
            )
        except (ThreeTPError, requests.RequestException) as exc:
            raise ThreeTPAPIError(f"3TP error: {_one_line(exc)}")

        try:
            with transaction.atomic():
                serializer.save(**extra)
                inst = serializer.instance
                inst.set_password(raw_password)     # same password as in 3TP
                inst.save(update_fields=["password"])
        except Exception:
            delete_3tp_user(request, tpt_uid)       # don't leave an orphan in 3TP
            raise

    # ----------------------------------------------------------- UPDATE
    def perform_update(self, serializer):
        inst = serializer.instance
        old_email = inst.email
        serializer.save(**self.update_extra(serializer))
        inst.refresh_from_db()

        # best-effort sync of name / phone / email to 3TP
        try:
            cid = getattr(inst.customer, "tpt_customer_id", "") if inst.customer_id else ""
            if cid:
                uid = find_3tp_user_id(self.request, cid, old_email)
                if uid:
                    h = _tpt_user_headers(self.request)
                    cur = requests.get(f"{CLOUD_URL}/api/user/{uid}", headers=h, timeout=15).json()
                    cur.update({"firstName": inst.name or cur.get("firstName"),
                                "phone": inst.phone or cur.get("phone"),
                                "email": inst.email})
                    requests.post(f"{CLOUD_URL}/api/user",
                                  params={"sendActivationMail": "false"},
                                  json=cur, headers=h, timeout=15)
        except Exception:
            traceback.print_exc()

    def update_extra(self, serializer):
        return {}

    # ---------------------------------------------------------- DELETE
    def perform_destroy(self, instance):
        cid = getattr(instance.customer, "tpt_customer_id", "") if instance.customer_id else ""
        if cid:
            try:
                uid = find_3tp_user_id(self.request, cid, instance.email)
                if uid and not delete_3tp_user(self.request, uid):
                    raise ThreeTPError("3TP delete failed.")
            except (ThreeTPError, requests.RequestException) as exc:
                raise ThreeTPAPIError(f"3TP error: {_one_line(exc)}")
        instance.delete()

def create_3tp_user(request, *, email, name, phone, tpt_customer_id, raw_password):
    """CUSTOMER_USER in 3TP + activation. Returns the 3TP user id."""
    res = requests.post(
        f"{CLOUD_URL}/api/user", params={"sendActivationMail": "false"},
        headers=_tpt_user_headers(request), timeout=15,
        json={"email": email, "authority": "CUSTOMER_USER",
              "firstName": name or email, "lastName": "", "phone": phone or "",
              "customerId": {"id": tpt_customer_id, "entityType": "CUSTOMER"}},
    )
    if res.status_code not in (200, 201):
        raise ThreeTPError(f"3TP user creation failed: {res.text}", status=res.status_code)
    tpt_user_id = _id_of(res.json())
    if not tpt_user_id:
        raise ThreeTPError("3TP did not return a user id.")
    try:
        _activate_3tp_user(request.headers.get("Authorization", ""), tpt_user_id, raw_password)
    except Exception:
        delete_3tp_user(request, tpt_user_id)
        raise
    return tpt_user_id


def delete_3tp_user(request, tpt_user_id):
    """Best-effort delete (used for rollback). Returns True if gone."""
    try:
        r = requests.delete(f"{CLOUD_URL}/api/user/{tpt_user_id}",
                            headers=_tpt_user_headers(request), timeout=15)
        return r.status_code in (200, 204, 404)
    except requests.RequestException:
        return False


def keep_users_present_in_3tp(request, qs):
    """Old behaviour: only local users that also exist in 3TP.
    Users without a customer (org super admin) or whose customer isn't linked yet are kept."""
    users = list(qs.select_related("customer"))
    emails_by_cid = {}
    for u in users:
        cid = getattr(u.customer, "tpt_customer_id", "") if u.customer_id else ""
        if cid and cid not in emails_by_cid:
            emails_by_cid[cid] = {
                (x.get("email") or "").lower()
                for x in fetch_3tp_customer_users(request, cid)
            }
    keep = []
    for u in users:
        cid = getattr(u.customer, "tpt_customer_id", "") if u.customer_id else ""
        if not cid or u.email.lower() in emails_by_cid[cid]:
            keep.append(u.pk)
    return qs.filter(pk__in=keep)

def _raw_token(request):
    """Accept both 'Bearer <jwt>' and 'Token <jwt>' from the frontend."""
    h = request.headers.get("Authorization", "").strip()
    return h.split(" ", 1)[1].strip() if " " in h else h


def _tpt_user_headers(request_or_header):
    # accepts either a DRF request or a raw header string
    if hasattr(request_or_header, "headers"):
        token = _raw_token(request_or_header)
    else:
        h = (request_or_header or "").strip()
        token = h.split(" ", 1)[1].strip() if " " in h else h
    bearer = f"Bearer {token}"
    return {
        "Authorization": bearer,
        "X-Authorization": bearer,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _customer_has_field(name):
    return any(f.name == name for f in Customer._meta.get_fields())


def fetch_3tp_customers(request):
    out, page, total_pages = [], 0, 1
    while page < total_pages:
        res = requests.get(
            f"{CLOUD_URL}/api/customers",
            params={"pageSize": 1000, "page": page,
                    "sortProperty": "createdTime", "sortOrder": "DESC"},
            headers=_tpt_user_headers(request), timeout=15,
        )
        if res.status_code != 200:
            raise ThreeTPError("Failed to fetch customers from 3TP.",
                               status=res.status_code, payload=res.text)
        data = res.json()
        out.extend(data.get("data", []))
        total_pages = data.get("totalPages", 1)
        page += 1
    return out

class ThreeTPError(Exception):
    """Raised whenever a 3TP call fails or returns a non-2xx response."""
    def __init__(self, message, status=None, payload=None):
        super().__init__(message)
        self.status  = status
        self.payload = payload


_tpt_lock  = threading.Lock()
_tpt_token = {"value": None, "expires_at": 0}


def _tpt_base_url():
    return (getattr(settings, "TPT_BASE_URL", "") or "").rstrip("/")


def _tpt_timeout():
    return float(getattr(settings, "TPT_TIMEOUT", 10))


def _tpt_enabled():
    return bool(getattr(settings, "TPT_SYNC_ENABLED", True))


def _tpt_service_login():
    """Log in to 3TP with the service account and cache the token."""
    with _tpt_lock:
        now = time.time()
        if _tpt_token["value"] and _tpt_token["expires_at"] > now:
            return _tpt_token["value"]

        base_url = _tpt_base_url()
        if not base_url:
            raise ThreeTPError("TPT_BASE_URL is not configured.")

        url = f"{base_url}{TPT_ENDPOINTS['login']}"
        payload = {
            "username":  getattr(settings, "TPT_USERNAME", ""),
            "password":  getattr(settings, "TPT_PASSWORD", ""),
            "authority": getattr(settings, "TPT_ADMIN_AUTHORITY", "TENANT_ADMIN"),
        }

        try:
            response = requests.post(
                url,
                json=payload,
                timeout=_tpt_timeout(),
                headers={"Content-Type": "application/json", "Accept": "application/json"},
            )
        except requests.RequestException as exc:
            raise ThreeTPError(f"3TP network error during login: {exc}")

        try:
            data = response.json()
        except ValueError:
            data = None

        if response.status_code not in (200, 201):
            detail = ""
            if isinstance(data, dict):
                detail = data.get("message") or data.get("detail") or ""
            raise ThreeTPError(
                f"3TP login failed ({response.status_code}) {detail}".strip(),
                status=response.status_code,
                payload=data,
            )

        token = None
        if isinstance(data, dict):
            token = (
                data.get("token")
                or data.get("access_token")
                or data.get("access")
                or (data.get("data") or {}).get("token")
                or (data.get("data") or {}).get("access_token")
            )

        if not token:
            raise ThreeTPError("3TP login response did not include a token.", payload=data)

        _tpt_token["value"]      = token
        _tpt_token["expires_at"] = now + 300
        return token


def _tpt_request(method, endpoint_key, payload=None,
                 extra_headers=None, raise_on_error=True):
    if not _tpt_enabled():
        return None, None

    base_url = _tpt_base_url()
    if not base_url:
        if raise_on_error:
            raise ThreeTPError("TPT_BASE_URL is not configured.")
        return None, None

    token = _tpt_service_login()
    url   = f"{base_url}{TPT_ENDPOINTS.get(endpoint_key, endpoint_key)}"

    headers = {
        "Content-Type":  "application/json",
        "Accept":        "application/json",
        "Authorization": f"Bearer {token}",
    }
    if extra_headers:
        headers.update(extra_headers)

    try:
        response = requests.request(
            method.upper(), url,
            json=payload, headers=headers, timeout=_tpt_timeout(),
        )
    except requests.RequestException as exc:
        if raise_on_error:
            raise ThreeTPError(f"3TP network error ({endpoint_key}): {exc}")
        return None, None

    try:
        data = response.json()
    except ValueError:
        data = None

    if raise_on_error and response.status_code not in (200, 201, 202, 204):
        detail = ""
        if isinstance(data, dict):
            detail = data.get("message") or data.get("detail") or ""
        raise ThreeTPError(
            f"3TP {endpoint_key} failed ({response.status_code}) {detail}".strip(),
            status=response.status_code,
            payload=data,
        )

    return response.status_code, data


def _tpt_extract_id(data):
    """Extract a 3TP record id, handling both flat and nested shapes."""
    if not isinstance(data, dict):
        return ""

    # Nested: {"id": {"id": "uuid", "entityType": "CUSTOMER"}}
    for key in ("id", "uuid", "pk"):
        value = data.get(key)
        if isinstance(value, dict):
            inner = value.get("id") or value.get("uuid") or value.get("pk")
            if inner:
                return str(inner)
        elif value:
            return str(value)

    inner = data.get("data")
    if isinstance(inner, dict):
        for key in ("id", "uuid", "pk"):
            value = inner.get(key)
            if isinstance(value, dict):
                inner_id = value.get("id") or value.get("uuid") or value.get("pk")
                if inner_id:
                    return str(inner_id)
            elif value:
                return str(value)

    return ""


def sync_customer(customer):
    """Push a local Customer to 3TP.

    Customer no longer stores 3TP columns (removed in migration 0007),
    so we only persist fields that still exist on the model.
    """
    if not _tpt_enabled():
        return ""

    payload = {
        "title":          getattr(customer, "company", "") or getattr(customer, "name", ""),
        "name":           getattr(customer, "company", "") or getattr(customer, "name", ""),
        "code":           getattr(customer, "code", "") or "",
        "email": (
            getattr(customer, "company_email", "")
            or getattr(customer, "contact_person_email", "")
            or ""
        ),
        "phone":          getattr(customer, "phone", "") or "",
        "contact_person": getattr(customer, "contact_person", "") or "",
        "address":        getattr(customer, "address", "") or "",
        "hierarchy_type": getattr(customer, "hierarchy_type", "") or "",
    }

    _, data = _tpt_request("POST", "customer", payload=payload)
    tpt_id  = _tpt_extract_id(data)

    customer.tpt_customer_id = tpt_id
    customer.tpt_sync_status = "SYNCED"
    customer.tpt_sync_error  = ""

    existing = {f.name for f in customer._meta.get_fields()}
    to_save = [
        f for f in ("tpt_customer_id", "tpt_sync_status", "tpt_sync_error")
        if f in existing
    ]
    if to_save:
        customer.save(update_fields=to_save)

    return tpt_id


def sync_site(site):
    """Push a local Site to 3TP, linked to its customer's 3TP id."""
    if not _tpt_enabled():
        return ""

    customer = site.branch.customer
    if not getattr(customer, "tpt_customer_id", ""):
        sync_customer(customer)

    payload = {
        "name":        getattr(site, "name", "") or "",
        "code":        getattr(site, "code", "") or "",
        "customer_id": customer.tpt_customer_id,
        "asset_type":  getattr(settings, "TPT_SITE_ASSET_TYPE", "SITE"),
        "branch_name": site.branch.name if site.branch_id else "",
        "floor_name":  site.floor.name if site.floor_id else "",
        "address":     getattr(site, "address", "") or "",
    }

    _, data = _tpt_request("POST", "site", payload=payload)
    tpt_id  = _tpt_extract_id(data)

    site.tpt_site_id     = tpt_id
    site.tpt_sync_status = "SYNCED"
    site.tpt_sync_error  = ""
    site.save(update_fields=["tpt_site_id", "tpt_sync_status", "tpt_sync_error"])
    return tpt_id


def sync_device(device):
    """Push a local ACDevice to 3TP, linked to its site's 3TP id."""
    if not _tpt_enabled():
        return ""

    site = device.site
    if site is None:
        raise ThreeTPError("Cannot sync device: no site assigned.")
    if not getattr(site, "tpt_site_id", ""):
        sync_site(site)

    payload = {
        "ac_id":        device.ac_id,
        "device_name":  device.device_name or device.ac_id,
        "site_id":      site.tpt_site_id,
        "device_type":  getattr(settings, "TPT_DEVICE_TYPE", "AC"),
        "status":       device.status,
        "capacity_ton": str(device.capacity_ton or ""),
        "installation_date": (
            device.installation_date.isoformat()
            if getattr(device, "installation_date", None) else ""
        ),
        "last_maintenance_date": (
            device.last_maintenance_date.isoformat()
            if getattr(device, "last_maintenance_date", None) else ""
        ),
    }

    _, data = _tpt_request("POST", "device", payload=payload)
    tpt_id  = _tpt_extract_id(data)

    device.tpt_device_id   = tpt_id
    device.tpt_sync_status = "SYNCED"
    device.tpt_sync_error  = ""
    device.save(update_fields=[
        "tpt_device_id", "tpt_sync_status", "tpt_sync_error",
    ])
    return tpt_id


# =====================================================================
# LOCATION TREE HELPERS
# =====================================================================
def load_location_tree(location_file):
    if not os.path.exists(location_file):
        return []
    with open(location_file, "r", encoding="utf-8-sig") as file:
        return json.load(file)


def save_location_tree(tree, location_file):
    with open(location_file, "w", encoding="utf-8") as file:
        json.dump(tree, file, indent=4)


def iter_branches(tree, hierarchy_type):
    hierarchy_type = hierarchy_type.upper()

    if hierarchy_type == "GEOGRAPHICAL":
        for state in tree:
            for district in state.get("districts", []):
                for taluka in district.get("talukas", []):
                    for city in taluka.get("cities", []):
                        for branch in city.get("branches", []):
                            context = {
                                "hierarchy_type": "GEOGRAPHICAL",
                                "state_id":       state.get("state_id", ""),
                                "state_name":     state.get("state_name", ""),
                                "district_id":    district.get("district_id", ""),
                                "district_name":  district.get("district_name", ""),
                                "taluka_id":      taluka.get("taluka_id", ""),
                                "taluka_name":    taluka.get("taluka_name", ""),
                                "city_id":        city.get("city_id", ""),
                                "city_name":      city.get("city_name", ""),
                                "branch_id":      branch.get("branch_id", ""),
                                "branch_name":    branch.get("branch_name", ""),
                            }
                            yield branch, context

    elif hierarchy_type == "ZONAL":
        for zone in tree:
            for circle in zone.get("circles", []):
                for region in circle.get("regions", []):
                    for division in region.get("divisions", []):
                        for branch in division.get("branches", []):
                            context = {
                                "hierarchy_type": "ZONAL",
                                "zone_id":        zone.get("zone_id", ""),
                                "zone_name":      zone.get("zone_name", ""),
                                "circle_id":      circle.get("circle_id", ""),
                                "circle_name":    circle.get("circle_name", ""),
                                "region_id":      region.get("region_id", ""),
                                "region_name":    region.get("region_name", ""),
                                "division_id":    division.get("division_id", ""),
                                "division_name":  division.get("division_name", ""),
                                "branch_id":      branch.get("branch_id", ""),
                                "branch_name":    branch.get("branch_name", ""),
                            }
                            yield branch, context


def find_location_target(tree, hierarchy_type, branch_id="", floor_id=""):
    for branch, context in iter_branches(tree, hierarchy_type):
        if floor_id:
            for floor in branch.get("floors", []):
                if str(floor.get("floor_id", "")) == str(floor_id):
                    return {"branch": branch, "floor": floor, "context": context}

        if branch_id:
            if str(branch.get("branch_id", "")) == str(branch_id):
                return {"branch": branch, "floor": None, "context": context}
    return None


def remove_site_from_tree(tree, site_id):
    removed = False
    for hierarchy_type in ["GEOGRAPHICAL", "ZONAL"]:
        for branch, _ in iter_branches(tree, hierarchy_type):
            branch_sites = branch.get("sites", [])
            new_branch_sites = [
                s for s in branch_sites
                if str(s.get("site_id", "")) != str(site_id)
            ]
            if len(new_branch_sites) != len(branch_sites):
                removed = True
            branch["sites"] = new_branch_sites

            for floor in branch.get("floors", []):
                floor_sites = floor.get("sites", [])
                new_floor_sites = [
                    s for s in floor_sites
                    if str(s.get("site_id", "")) != str(site_id)
                ]
                if len(new_floor_sites) != len(floor_sites):
                    removed = True
                floor["sites"] = new_floor_sites
    return removed


def build_location_index():
    index = {}

    geo_tree = load_location_tree(GEOGRAPHICAL_LOCATION_FILE)
    for branch, context in iter_branches(geo_tree, "GEOGRAPHICAL"):
        branch_id = branch.get("branch_id")
        if branch_id:
            index[branch_id] = {**context, "location_type": "BRANCH"}

        for floor in branch.get("floors", []):
            floor_id = floor.get("floor_id")
            if not floor_id:
                continue
            index[floor_id] = {
                **context,
                "floor_id":   floor_id,
                "floor_name": floor.get("floor_name", ""),
                "location_type": "FLOOR",
            }
            for s in floor.get("sites", []):
                sid = s.get("site_id")
                if sid:
                    index[sid] = {
                        **context,
                        "floor_id":   floor_id,
                        "floor_name": floor.get("floor_name", ""),
                        "site_id":    sid,
                        "device_name": s.get("device_name", ""),
                        "capacity_ton": s.get("capacity_ton", ""),
                        "installation_date": s.get("installation_date", ""),
                        "last_maintenance_date": s.get("last_maintenance_date", ""),
                        "location_type": "FLOOR",
                    }

        for s in branch.get("sites", []):
            sid = s.get("site_id")
            if sid:
                index[sid] = {
                    **context,
                    "site_id":     sid,
                    "device_name": s.get("device_name", ""),
                    "capacity_ton": s.get("capacity_ton", ""),
                    "installation_date": s.get("installation_date", ""),
                    "last_maintenance_date": s.get("last_maintenance_date", ""),
                    "location_type": "DIRECT_BRANCH",
                }

    zonal_tree = load_location_tree(ZONAL_LOCATION_FILE)
    for branch, context in iter_branches(zonal_tree, "ZONAL"):
        branch_id = branch.get("branch_id")
        if branch_id:
            index[branch_id] = {**context, "location_type": "BRANCH"}

        for floor in branch.get("floors", []):
            floor_id = floor.get("floor_id")
            if not floor_id:
                continue
            index[floor_id] = {
                **context,
                "floor_id":   floor_id,
                "floor_name": floor.get("floor_name", ""),
                "location_type": "FLOOR",
            }
            for s in floor.get("sites", []):
                sid = s.get("site_id")
                if sid:
                    index[sid] = {
                        **context,
                        "floor_id":   floor_id,
                        "floor_name": floor.get("floor_name", ""),
                        "site_id":    sid,
                        "device_name": s.get("device_name", ""),
                        "capacity_ton": s.get("capacity_ton", ""),
                        "installation_date": s.get("installation_date", ""),
                        "last_maintenance_date": s.get("last_maintenance_date", ""),
                        "location_type": "FLOOR",
                    }

        for s in branch.get("sites", []):
            sid = s.get("site_id")
            if sid:
                index[sid] = {
                    **context,
                    "site_id":     sid,
                    "device_name": s.get("device_name", ""),
                    "capacity_ton": s.get("capacity_ton", ""),
                    "installation_date": s.get("installation_date", ""),
                    "last_maintenance_date": s.get("last_maintenance_date", ""),
                    "location_type": "DIRECT_BRANCH",
                }

    return index


def build_device_location_map():
    if not os.path.exists(DEVICE_LOCATION_MAP_FILE):
        return {}

    try:
        with open(DEVICE_LOCATION_MAP_FILE, "r", encoding="utf-8-sig") as file:
            mappings = json.load(file)

        if isinstance(mappings, list):
            return {
                item.get("ac_id"): item
                for item in mappings
                if isinstance(item, dict) and item.get("ac_id")
            }

        if isinstance(mappings, dict):
            result = {}
            for ac_id, value in mappings.items():
                if isinstance(value, dict):
                    item = dict(value)
                    item.setdefault("ac_id", ac_id)
                    result[ac_id] = item
                else:
                    result[ac_id] = {"ac_id": ac_id, "floor_id": value}
            return result

        return {}

    except (json.JSONDecodeError, TypeError):
        return {}


def save_device_location_map(device_map):
    mappings = list(device_map.values())
    with open(DEVICE_LOCATION_MAP_FILE, "w", encoding="utf-8") as file:
        json.dump(mappings, file, indent=4)


def get_ac_device_name(ac_id):
    if not os.path.exists(DATA_FILE):
        return ac_id
    try:
        with open(DATA_FILE, "r", encoding="utf-8-sig") as file:
            data = json.load(file)
        for record in reversed(data):
            if str(record.get("ac_id", "")) == str(ac_id):
                return record.get("device_name") or ac_id
    except Exception:
        pass
    return ac_id


def make_code_id(existing_ids, name, prefix=""):
    words = [w for w in name.strip().split() if w]
    base = (words[0][0] + words[1][0]).upper() if len(words) >= 2 else name.strip()[:2].upper()
    base = f"{prefix}{base}" if prefix else base

    candidate = base
    suffix = 1
    while candidate in existing_ids:
        suffix += 1
        candidate = f"{base}{suffix}"
    return candidate


# =====================================================================
# DEVICE FLATTEN HELPER
# =====================================================================
def _flatten_device(mapping):
    flat = {
        "ac_id":          mapping.get("ac_id", ""),
        "site_id":        mapping.get("site_id", ""),
        "device_name":    mapping.get("device_name", ""),
        "status":         mapping.get("status", "OFF"),
        "location_type":  mapping.get("location_type", ""),
        "hierarchy_type": (mapping.get("hierarchy_type") or "").upper(),
        "capacity_ton":            mapping.get("capacity_ton", ""),
        "installation_date":       mapping.get("installation_date", ""),
        "last_maintenance_date":   mapping.get("last_maintenance_date", ""),
        "customer_id":      mapping.get("customer_id", ""),
        "created_by_id":    mapping.get("created_by_id", ""),
        "created_by_name":  mapping.get("created_by_name", ""),
        "created_by_email": mapping.get("created_by_email", ""),
        "created_by_role":  mapping.get("created_by_role", ""),
    }

    geo = mapping.get("geographical") or {}
    zon = mapping.get("zonal")        or {}

    if zon and not geo:
        block = zon
        flat["hierarchy_type"] = flat["hierarchy_type"] or "ZONAL"
    elif geo:
        block = geo
        flat["hierarchy_type"] = flat["hierarchy_type"] or "GEOGRAPHICAL"
    else:
        block = mapping

    for field in (
        "state_id", "state_name", "district_id", "district_name",
        "taluka_id", "taluka_name", "city_id", "city_name",
        "zone_id", "zone_name", "circle_id", "circle_name",
        "region_id", "region_name", "division_id", "division_name",
        "branch_id", "branch_name", "floor_id", "floor_name",
    ):
        if block.get(field):
            flat[field] = block[field]

    return flat


# =====================================================================
# DEVICES  (canonical Site-based flow + legacy branch/floor flow)
# =====================================================================
def nodes_for_mapping(mapping, branch_index):
    """Tree branch node(s) an AC mapping points at."""
    hier = (mapping.get("hierarchy_type") or "").upper()
    blocks = []
    if mapping.get("geographical"):
        blocks.append(("GEOGRAPHICAL", mapping["geographical"]))
    if mapping.get("zonal"):
        blocks.append(("ZONAL", mapping["zonal"]))
    if not blocks and hier:
        blocks.append((hier, mapping))
    nodes = []
    for h, block in blocks:
        if hier and h != hier:
            continue
        node = branch_index.get((h, block.get("branch_id")))
        if node is not None:
            nodes.append(node)
    return nodes


def user_can_see_ac(user, ac_id, device_map, branch_index):
    if user.role == Role.ORG_SUPER_ADMIN:
        return True

    db_device = (
        ACDevice.objects
        .select_related("site", "site__branch", "site__branch__customer")
        .filter(ac_id=ac_id)
        .first()
    )

    if db_device and db_device.site_id:
        site = db_device.site

        if user.role == Role.CUSTOMER:
            return site.branch.customer_id == user.customer_id

        if user.role == Role.BR_ADMIN:
            hierarchy = getattr(user.customer, "hierarchy_type", None) if user.customer_id else None
            if hierarchy == "GEOGRAPHICAL" and user.state_id:
                return (
                    site.branch.customer_id == user.customer_id
                    and site.branch.city
                    and site.branch.city.taluka
                    and site.branch.city.taluka.district
                    and site.branch.city.taluka.district.state_id == user.state_id
                )
            if hierarchy == "ZONAL" and user.zone_id:
                return (
                    site.branch.customer_id == user.customer_id
                    and site.branch.division
                    and site.branch.division.region
                    and site.branch.division.region.circle
                    and site.branch.division.region.circle.zone_id == user.zone_id
                )
            return site.branch_id == user.branch_id

        if user.role == Role.ENGINEER:
            return site.id == user.site_id

        return False

    mapping = device_map.get(ac_id)
    if not mapping:
        return False

    return any(
        ownership.can_see_branch(user, n)
        for n in nodes_for_mapping(mapping, branch_index)
    )


def scope_ac_records(records, user):
    if user.role == Role.ORG_SUPER_ADMIN:
        return records
    device_map = build_device_location_map()
    idx = ownership.build_branch_index()
    return [r for r in records if user_can_see_ac(user, r.get("ac_id", ""), device_map, idx)]


@api_view(["GET", "POST"])
def devices(request):
    try:
        return _devices_impl(request)
    except Exception as exc:
        return JsonResponse(
            {
                "status":    "error",
                "message":   f"{type(exc).__name__}: {exc}",
                "traceback": traceback.format_exc().splitlines(),
            },
            status=500,
        )


def _devices_impl(request):
    device_map = build_device_location_map()
    if request.method == "GET":
        user = request.user
        idx = ownership.build_branch_index()

        visible = []
        for ac_id, mapping in device_map.items():
            if not isinstance(mapping, dict):
                continue
            if user_can_see_ac(user, ac_id, device_map, idx):
                visible.append((ac_id, mapping, nodes_for_mapping(mapping, idx)))

        all_nodes = [n for _, _, ns in visible for n in ns]
        lookup = ownership.OwnerLookup.for_nodes(all_nodes)

        result = []
        for ac_id, mapping, nodes in visible:
            flat = _flatten_device(mapping)
            flat["ac_id"] = ac_id

            db_device = (
                ACDevice.objects
                .select_related(
                    "site",
                    "site__branch",
                    "site__branch__customer",
                    "site__floor",
                )
                .filter(ac_id=ac_id)
                .first()
            )

            if db_device and db_device.site_id:
                site_obj = db_device.site
                branch_obj = site_obj.branch
                flat["site_id"]       = str(site_obj.id)
                flat["site_name"]     = site_obj.name
                flat["site_code"]     = site_obj.code
                flat["branch_id"]     = str(branch_obj.id)
                flat["branch_name"]   = branch_obj.name
                flat["customer_id"]   = str(branch_obj.customer_id or "")
                flat["customer_name"] = (
                    branch_obj.customer.company if branch_obj.customer_id else ""
                )
                flat["floor_id"]   = str(site_obj.floor_id or "")
                flat["floor_name"] = site_obj.floor.name if site_obj.floor_id else ""

                customer_obj = branch_obj.customer
                if customer_obj and customer_obj.hierarchy_type == "GEOGRAPHICAL":
                    state_id = (
                        branch_obj.city.taluka.district.state_id
                        if branch_obj.city_id and branch_obj.city.taluka_id
                        and branch_obj.city.taluka.district_id
                        else None
                    )
                    site_admins = list(
                        User.objects.filter(
                            role=Role.BR_ADMIN,
                            is_active=True,
                            customer_id=customer_obj.id,
                            state_id=state_id,
                        ).values(
                            "id", "name", "email", "phone", "role",
                            "state_id", "zone_id", "branch_id", "site_id"
                        )
                    ) if state_id else []
                elif customer_obj and customer_obj.hierarchy_type == "ZONAL":
                    zone_id = (
                        branch_obj.division.region.circle.zone_id
                        if branch_obj.division_id and branch_obj.division.region_id
                        and branch_obj.division.region.circle_id
                        else None
                    )
                    site_admins = list(
                        User.objects.filter(
                            role=Role.BR_ADMIN,
                            is_active=True,
                            customer_id=customer_obj.id,
                            zone_id=zone_id,
                        ).values(
                            "id", "name", "email", "phone", "role",
                            "state_id", "zone_id", "branch_id", "site_id"
                        )
                    ) if zone_id else []
                else:
                    site_admins = []

                site_engineers = list(
                    site_obj.users.filter(
                        role=Role.ENGINEER, is_active=True
                    ).values("id", "name", "email", "phone", "role", "branch_id", "site_id")
                )
                flat["admins"]    = site_admins
                flat["engineers"] = site_engineers

            owner_node = next((n for n in nodes if n.get("customer_id")), nodes[0] if nodes else None)
            if owner_node is not None:
                info = lookup.describe(owner_node)
                flat["customer_id"]   = owner_node.get("customer_id") or flat.get("customer_id") or ""
                flat["customer_name"] = info["customer"]["company"] if info["customer"] else ""
                flat["admins"]        = info["admins"]
                flat["engineers"]     = info["engineers"]
            result.append(flat)

        return JsonResponse({
            "status": "success",
            "count":  len(result),
            "data":   result,
        })

    try:
        body = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse(
            {"status": "error", "message": "Invalid JSON body"}, status=400,
        )

    # --- canonical site-based flow ---
    site_id = str(body.get("site_id", "")).strip()

    if site_id:
        try:
            site_obj = (
                Site.objects
                .select_related(
                    "branch",
                    "branch__customer",
                    "branch__customer__organization",
                    "floor",
                )
                .prefetch_related("users")
                .get(pk=site_id)
            )
        except (Site.DoesNotExist, ValueError):
            return JsonResponse(
                {"status": "error", "message": "Selected site was not found."},
                status=404,
            )

        acting = request.user

        if acting.role == Role.ORG_SUPER_ADMIN:
            allowed = (site_obj.branch.customer.organization_id == acting.organization_id)
        elif acting.role == Role.CUSTOMER:
            allowed = (site_obj.branch.customer_id == acting.customer_id)
        elif acting.role == Role.BR_ADMIN:
            hierarchy = getattr(acting.customer, "hierarchy_type", None) if acting.customer_id else None
            if hierarchy == "GEOGRAPHICAL" and acting.state_id:
                allowed = (
                    site_obj.branch.customer_id == acting.customer_id
                    and site_obj.branch.city
                    and site_obj.branch.city.taluka
                    and site_obj.branch.city.taluka.district
                    and site_obj.branch.city.taluka.district.state_id == acting.state_id
                )
            elif hierarchy == "ZONAL" and acting.zone_id:
                allowed = (
                    site_obj.branch.customer_id == acting.customer_id
                    and site_obj.branch.division
                    and site_obj.branch.division.region
                    and site_obj.branch.division.region.circle
                    and site_obj.branch.division.region.circle.zone_id == acting.zone_id
                )
            else:
                allowed = site_obj.branch_id == acting.branch_id
        elif acting.role == Role.ENGINEER:
            allowed = site_obj.id == acting.site_id
        else:
            allowed = False

        if not allowed:
            return JsonResponse(
                {"status": "error", "message": "You do not have access to the selected site."},
                status=403,
            )

        if not site_obj.branch.customer_id:
            return JsonResponse(
                {"status": "error", "message": "The selected site is not assigned to a customer."},
                status=400,
            )

        ac_id       = str(body.get("ac_id", "")).strip()
        device_name = str(body.get("device_name", "")).strip()
        status_val  = str(body.get("status", "OFF")).strip().upper()
        capacity_raw          = body.get("capacity_ton", "")
        installation_date     = str(body.get("installation_date", "")).strip()
        last_maintenance_date = str(body.get("last_maintenance_date", "")).strip()

        if not ac_id:
            return JsonResponse({"status": "error", "message": "ac_id is required"}, status=400)

        if not device_name:
            device_name = get_ac_device_name(ac_id)

        if status_val not in {"ON", "OFF"}:
            status_val = "OFF"

        try:
            capacity_ton = float(capacity_raw)
        except (TypeError, ValueError):
            capacity_ton = 0

        if capacity_ton <= 0:
            return JsonResponse(
                {"status": "error", "message": "capacity_ton must be greater than 0"}, status=400,
            )

        if not installation_date:
            return JsonResponse(
                {"status": "error", "message": "installation_date is required"}, status=400,
            )

        if last_maintenance_date and last_maintenance_date < installation_date:
            return JsonResponse(
                {"status": "error",
                 "message": "last_maintenance_date cannot be before installation_date"},
                status=400,
            )

        with transaction.atomic():
            db_device, created = ACDevice.objects.update_or_create(
                ac_id=ac_id,
                defaults={
                    "device_name": device_name,
                    "site": site_obj,
                    "status": status_val,
                    "capacity_ton": capacity_ton,
                    "installation_date": installation_date,
                    "last_maintenance_date": last_maintenance_date or None,
                    "assigned_by": acting,
                },
            )

        try:
            customer = site_obj.branch.customer
            if not getattr(customer, "tpt_customer_id", ""):
                sync_customer(customer)
            if not site_obj.tpt_site_id:
                sync_site(site_obj)
            sync_device(db_device)
        except ThreeTPError as exc:
            ACDevice.objects.filter(pk=db_device.pk).update(
                tpt_sync_status="FAILED",
                tpt_sync_error=str(exc),
            )

        customer = site_obj.branch.customer

        admins = list(
            site_obj.users.filter(role=Role.BR_ADMIN, is_active=True)
            .values("id", "name", "email", "phone", "role", "branch_id", "site_id")
        )
        engineers = list(
            site_obj.users.filter(role=Role.ENGINEER, is_active=True)
            .values("id", "name", "email", "phone", "role", "branch_id", "site_id")
        )

        hierarchy_type = getattr(customer, "hierarchy_type", "") or ""

        device_map  = build_device_location_map()
        old_mapping = device_map.get(ac_id, {})

        mapping = {
            "ac_id": ac_id,
            "site_id": str(site_obj.id),
            "site_name": site_obj.name,
            "site_code": site_obj.code,
            "device_name": device_name,
            "status": status_val,
            "location_type": "SITE",
            "hierarchy_type": hierarchy_type,
            "customer_id": str(customer.id),
            "customer_name": customer.company,
            "branch_id": str(site_obj.branch_id),
            "branch_name": site_obj.branch.name,
            "floor_id": str(site_obj.floor_id or ""),
            "floor_name": site_obj.floor.name if site_obj.floor_id else "",
            "capacity_ton": capacity_ton,
            "installation_date": installation_date,
            "last_maintenance_date": last_maintenance_date,
            "created_by_id": str(getattr(acting, "id", "") or ""),
            "created_by_name": getattr(acting, "name", "") or getattr(acting, "email", ""),
            "created_by_email": getattr(acting, "email", ""),
            "created_by_role": getattr(acting, "role", ""),
        }

        if old_mapping:
            old_hierarchy = (old_mapping.get("hierarchy_type") or "").upper()
            old_file = (
                GEOGRAPHICAL_LOCATION_FILE if old_hierarchy == "GEOGRAPHICAL"
                else ZONAL_LOCATION_FILE if old_hierarchy == "ZONAL"
                else None
            )
            if old_file:
                try:
                    old_tree = load_location_tree(old_file)
                    old_site_id = old_mapping.get("site_id") or ac_id
                    if remove_site_from_tree(old_tree, old_site_id):
                        save_location_tree(old_tree, old_file)
                except Exception:
                    pass

        device_map[ac_id] = mapping
        save_device_location_map(device_map)

        response_data = dict(mapping)
        response_data["customer"] = {
            "id": customer.id, "company": customer.company, "code": customer.code,
        }
        response_data["admins"]    = admins
        response_data["engineers"] = engineers
        response_data["site"]      = {
            "id": str(site_obj.id), "name": site_obj.name, "code": site_obj.code,
        }

        return JsonResponse(
            {
                "status": "success",
                "message": (
                    f"{ac_id} created and assigned to {site_obj.name}."
                    if created
                    else f"{ac_id} reassigned to {site_obj.name}."
                ),
                "data": response_data,
            },
            status=201 if created else 200,
        )

    # --- legacy branch / floor flow ---
    ac_id       = str(body.get("ac_id", "")).strip()
    hierarchy   = str(body.get("hierarchy_type", "")).strip().upper()
    branch_id   = str(body.get("branch_id", "")).strip()
    floor_id    = str(body.get("floor_id", "")).strip()
    device_name = str(body.get("device_name", "")).strip()
    status_val  = str(body.get("status", "OFF")).strip().upper()
    capacity_raw          = body.get("capacity_ton", "")
    installation_date     = str(body.get("installation_date", "")).strip()
    last_maintenance_date = str(body.get("last_maintenance_date", "")).strip()

    try:
        capacity_ton = float(capacity_raw)
    except (TypeError, ValueError):
        capacity_ton = 0

    acting           = getattr(request, "user", None)
    created_by_id    = str(getattr(acting, "id", "") or "")
    created_by_name  = getattr(acting, "name", "") or getattr(acting, "email", "")
    created_by_email = getattr(acting, "email", "")
    created_by_role  = getattr(acting, "role", "")

    if not ac_id:
        return JsonResponse({"status": "error", "message": "ac_id is required"}, status=400)
    if hierarchy not in {"GEOGRAPHICAL", "ZONAL"}:
        return JsonResponse(
            {"status": "error", "message": "hierarchy_type must be 'GEOGRAPHICAL' or 'ZONAL'"},
            status=400,
        )
    if not branch_id:
        return JsonResponse({"status": "error", "message": "branch_id is required"}, status=400)

    if not device_name:
        device_name = get_ac_device_name(ac_id)

    if status_val not in {"ON", "OFF"}:
        status_val = "OFF"

    if capacity_ton <= 0:
        return JsonResponse(
            {"status": "error", "message": "capacity_ton must be greater than 0"}, status=400,
        )
    if not installation_date:
        return JsonResponse(
            {"status": "error", "message": "installation_date is required"}, status=400,
        )
    if last_maintenance_date and last_maintenance_date < installation_date:
        return JsonResponse(
            {"status": "error",
             "message": "last_maintenance_date cannot be before installation_date"},
            status=400,
        )

    location_file = (
        GEOGRAPHICAL_LOCATION_FILE if hierarchy == "GEOGRAPHICAL"
        else ZONAL_LOCATION_FILE
    )

    try:
        tree = load_location_tree(location_file)
    except json.JSONDecodeError:
        return JsonResponse(
            {"status": "error", "message": "Location tree file is malformed"}, status=500,
        )

    target = find_location_target(tree, hierarchy, branch_id=branch_id, floor_id=floor_id)
    if not target:
        return JsonResponse(
            {"status": "error",
             "message": "Selected floor/branch was not found in the selected hierarchy"},
            status=404,
        )

    branch  = target["branch"]
    floor   = target["floor"]
    context = target["context"]

    if not ownership.can_manage_branch(request.user, branch):
        return JsonResponse(
            {"status": "error", "message": "You do not have access to this site."},
            status=403,
        )
    customer_id = branch.get("customer_id")
    if not customer_id:
        return JsonResponse(
            {"status": "error",
             "message": "This site is not assigned to a customer yet. "
                        "Assign a customer and admin to the site first (Sites page)."},
            status=400,
        )

    old_mapping = device_map.get(ac_id, {})
    if old_mapping and request.user.role != Role.ORG_SUPER_ADMIN:
        old_nodes = nodes_for_mapping(old_mapping, ownership.build_branch_index())
        if old_nodes and not any(ownership.can_manage_branch(request.user, n) for n in old_nodes):
            return JsonResponse(
                {"status": "error", "message": "This AC is assigned to a site you cannot manage."},
                status=403,
            )
    old_site_id = old_mapping.get("site_id") or ac_id
    remove_site_from_tree(tree, old_site_id)
    if old_site_id != ac_id:
        remove_site_from_tree(tree, ac_id)

    site = {
        "site_id": ac_id,
        "device_name": device_name,
        "status": status_val,
        "capacity_ton": capacity_ton,
        "installation_date": installation_date,
        "last_maintenance_date": last_maintenance_date,
    }

    if floor is not None:
        if not isinstance(floor.get("sites"), list):
            floor["sites"] = []
        floor["sites"].append(site)

        location_type       = "FLOOR"
        assigned_floor_id   = floor.get("floor_id", "")
        assigned_floor_name = floor.get("floor_name", "")
    else:
        if not isinstance(branch.get("sites"), list):
            branch["sites"] = []
        branch["sites"].append(site)

        location_type       = "DIRECT_BRANCH"
        assigned_floor_id   = ""
        assigned_floor_name = ""

    save_location_tree(tree, location_file)

    mapping = {
        "ac_id": ac_id,
        "site_id": ac_id,
        "device_name": device_name,
        "status": status_val,
        "location_type": location_type,
        "hierarchy_type": hierarchy,
        "customer_id": customer_id,
        "created_by_id": created_by_id,
        "created_by_name": created_by_name,
        "created_by_email": created_by_email,
        "created_by_role": created_by_role,
        "branch_id": branch.get("branch_id", ""),
        "branch_name": branch.get("branch_name", ""),
        "floor_id": assigned_floor_id,
        "floor_name": assigned_floor_name,
        "capacity_ton": capacity_ton,
        "installation_date": installation_date,
        "last_maintenance_date": last_maintenance_date,
    }
    mapping.update(context)

    device_map[ac_id] = mapping
    save_device_location_map(device_map)

    info = ownership.OwnerLookup.for_nodes([branch]).describe(branch)
    response_data = dict(mapping)
    response_data["customer_name"] = info["customer"]["company"] if info["customer"] else ""
    response_data["admins"]    = info["admins"]
    response_data["engineers"] = info["engineers"]

    return JsonResponse(
        {"status": "success", "message": f"{ac_id} assigned successfully", "data": response_data},
        status=201,
    )


# =====================================================================
# LOCATIONS  (tree)
# =====================================================================
def _scoped_tree(location_file, user):
    tree = load_location_tree(location_file)
    tree = ownership.filter_tree_for_user(tree, user)
    return ownership.attach_owner_details(tree)


def _locations_impl(request):
    if request.method == "GET":
        hierarchy = request.GET.get("hierarchy", "").strip().upper()

        try:
            if hierarchy == "GEOGRAPHICAL":
                data = _scoped_tree(GEOGRAPHICAL_LOCATION_FILE, request.user)
                return JsonResponse(
                    {"success": True, "hierarchy_type": "GEOGRAPHICAL", "data": data},
                    safe=True,
                )

            if hierarchy == "ZONAL":
                data = _scoped_tree(ZONAL_LOCATION_FILE, request.user)
                return JsonResponse(
                    {"success": True, "hierarchy_type": "ZONAL", "data": data},
                    safe=True,
                )

            geographical_data = _scoped_tree(GEOGRAPHICAL_LOCATION_FILE, request.user)
            zonal_data        = _scoped_tree(ZONAL_LOCATION_FILE, request.user)

            return JsonResponse(
                {
                    "success": True,
                    "geographical": {"hierarchy_type": "GEOGRAPHICAL", "data": geographical_data},
                    "zonal":        {"hierarchy_type": "ZONAL",        "data": zonal_data},
                },
                safe=True,
            )

        except json.JSONDecodeError:
            return JsonResponse({"success": False, "message": "Invalid JSON format"}, status=500)
        except Exception as e:
            return JsonResponse({"success": False, "message": str(e)}, status=500)

    # ---- POST ----
    try:
        body = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "message": "Invalid JSON body"}, status=400)

    hierarchy = str(body.get("hierarchy_type", "")).strip().upper()

    if hierarchy not in {"ZONAL", "GEOGRAPHICAL"}:
        return JsonResponse(
            {"success": False, "message": "hierarchy_type must be 'ZONAL' or 'GEOGRAPHICAL'"},
            status=400,
        )

    location_file = ZONAL_LOCATION_FILE if hierarchy == "ZONAL" else GEOGRAPHICAL_LOCATION_FILE

    try:
        tree = load_location_tree(location_file)
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "message": "Invalid JSON format"}, status=500)

    # -------- ZONAL --------
    if hierarchy == "ZONAL":
        zone_name     = str(body.get("zone_name", "")).strip()
        circle_name   = str(body.get("circle_name", "")).strip()
        region_name   = str(body.get("region_name", "")).strip()
        division_name = str(body.get("division_name", "")).strip()
        branch_name   = str(body.get("branch_name", "")).strip()
        floor_name    = str(body.get("floor_name", "")).strip()

        missing = [
            field for field, value in [
                ("zone_name",     zone_name),
                ("circle_name",   circle_name),
                ("region_name",   region_name),
                ("division_name", division_name),
                ("branch_name",   branch_name),
                ("floor_name",    floor_name),
            ] if not value
        ]
        if missing:
            return JsonResponse(
                {"success": False,
                 "message": "Missing required field(s): " + ", ".join(missing)},
                status=400,
            )

        zone = next((z for z in tree if z.get("zone_name", "").strip().lower() == zone_name.lower()), None)
        if zone is None:
            zone_ids = {z.get("zone_id", "") for z in tree}
            zone = {
                "zone_id": make_code_id(zone_ids, zone_name, prefix="ZN-"),
                "zone_name": zone_name,
                "circles": [],
            }
            tree.append(zone)

        circle = next((c for c in zone.get("circles", [])
                       if c.get("circle_name", "").strip().lower() == circle_name.lower()), None)
        if circle is None:
            circle_ids = {c.get("circle_id", "") for z in tree for c in z.get("circles", [])}
            circle = {
                "circle_id": make_code_id(circle_ids, circle_name, prefix=f"{zone['zone_id']}-C"),
                "circle_name": circle_name,
                "regions": [],
            }
            zone.setdefault("circles", []).append(circle)

        region = next((r for r in circle.get("regions", [])
                       if r.get("region_name", "").strip().lower() == region_name.lower()), None)
        if region is None:
            region_ids = {r.get("region_id", "")
                          for z in tree for c in z.get("circles", [])
                          for r in c.get("regions", [])}
            region = {
                "region_id": make_code_id(region_ids, region_name, prefix=f"{circle['circle_id']}-R"),
                "region_name": region_name,
                "divisions": [],
            }
            circle.setdefault("regions", []).append(region)

        division = next((d for d in region.get("divisions", [])
                         if d.get("division_name", "").strip().lower() == division_name.lower()), None)
        if division is None:
            division_ids = {d.get("division_id", "")
                            for z in tree for c in z.get("circles", [])
                            for r in c.get("regions", [])
                            for d in r.get("divisions", [])}
            division = {
                "division_id": make_code_id(division_ids, division_name, prefix=f"{region['region_id']}-D"),
                "division_name": division_name,
                "branches": [],
            }
            region.setdefault("divisions", []).append(division)

        branch = next((b for b in division.get("branches", [])
                       if b.get("branch_name", "").strip().lower() == branch_name.lower()), None)
        if branch is None:
            branch_index = len(division.get("branches", [])) + 1
            branch = {
                "branch_id": f"{division['division_id']}-B{branch_index:02d}",
                "branch_name": branch_name,
                "floors": [],
                "sites": [],
            }
            division.setdefault("branches", []).append(branch)

        if any(f.get("floor_name", "").strip().lower() == floor_name.lower()
               for f in branch.get("floors", [])):
            return JsonResponse(
                {"success": False,
                 "message": f"Floor '{floor_name}' already exists in this branch"},
                status=409,
            )

        floor_index = len(branch.get("floors", [])) + 1
        floor = {
            "floor_id": f"{branch['branch_id']}-F{floor_index:02d}",
            "floor_name": floor_name,
            "sites": [],
        }
        branch.setdefault("floors", []).append(floor)

        save_location_tree(tree, location_file)

        return JsonResponse(
            {
                "success": True,
                "hierarchy_type": "ZONAL",
                "data": {
                    "zone_id": zone["zone_id"],             "zone_name": zone["zone_name"],
                    "circle_id": circle["circle_id"],       "circle_name": circle["circle_name"],
                    "region_id": region["region_id"],       "region_name": region["region_name"],
                    "division_id": division["division_id"], "division_name": division["division_name"],
                    "branch_id": branch["branch_id"],       "branch_name": branch["branch_name"],
                    "floor_id": floor["floor_id"],          "floor_name": floor["floor_name"],
                },
            },
            status=201,
        )

    # -------- GEOGRAPHICAL --------
    state_name    = str(body.get("state_name", "")).strip()
    district_name = str(body.get("district_name", "")).strip()
    taluka_name   = str(body.get("taluka_name", "")).strip()
    city_name     = str(body.get("city_name", "")).strip()
    branch_name   = str(body.get("branch_name", "")).strip()
    floor_name    = str(body.get("floor_name", "")).strip()

    missing = [
        field for field, value in [
            ("state_name", state_name), ("district_name", district_name),
            ("taluka_name", taluka_name), ("city_name", city_name),
            ("branch_name", branch_name), ("floor_name", floor_name),
        ] if not value
    ]
    if missing:
        return JsonResponse(
            {"success": False, "message": "Missing required field(s): " + ", ".join(missing)},
            status=400,
        )

    state = next((s for s in tree if s.get("state_name", "").strip().lower() == state_name.lower()), None)
    if state is None:
        state_ids = {s.get("state_id", "") for s in tree}
        state = {
            "state_id": make_code_id(state_ids, state_name),
            "state_name": state_name,
            "districts": [],
        }
        tree.append(state)

    district = next((d for d in state.get("districts", [])
                     if d.get("district_name", "").strip().lower() == district_name.lower()), None)
    if district is None:
        district_index = len(state.get("districts", [])) + 1
        district = {
            "district_id": f"{state['state_id']}-D{district_index:02d}",
            "district_name": district_name,
            "talukas": [],
        }
        state.setdefault("districts", []).append(district)

    taluka = next((t for t in district.get("talukas", [])
                   if t.get("taluka_name", "").strip().lower() == taluka_name.lower()), None)
    if taluka is None:
        taluka_index = len(district.get("talukas", [])) + 1
        taluka = {
            "taluka_id": f"{district['district_id']}-T{taluka_index:02d}",
            "taluka_name": taluka_name,
            "cities": [],
        }
        district.setdefault("talukas", []).append(taluka)

    city = next((c for c in taluka.get("cities", [])
                 if c.get("city_name", "").strip().lower() == city_name.lower()), None)
    if city is None:
        city_index = len(taluka.get("cities", [])) + 1
        city = {
            "city_id": f"{taluka['taluka_id']}-C{city_index:02d}",
            "city_name": city_name,
            "branches": [],
        }
        taluka.setdefault("cities", []).append(city)

    branch = next((b for b in city.get("branches", [])
                   if b.get("branch_name", "").strip().lower() == branch_name.lower()), None)
    if branch is None:
        branch_index = len(city.get("branches", [])) + 1
        branch = {
            "branch_id": f"{city['city_id']}-B{branch_index:02d}",
            "branch_name": branch_name,
            "floors": [],
            "sites": [],
        }
        city.setdefault("branches", []).append(branch)

    if any(f.get("floor_name", "").strip().lower() == floor_name.lower()
           for f in branch.get("floors", [])):
        return JsonResponse(
            {"success": False,
             "message": f"Floor '{floor_name}' already exists in this branch"},
            status=409,
        )

    floor_index = len(branch.get("floors", [])) + 1
    floor = {
        "floor_id": f"{branch['branch_id']}-F{floor_index:02d}",
        "floor_name": floor_name,
        "sites": [],
    }
    branch.setdefault("floors", []).append(floor)

    save_location_tree(tree, location_file)

    return JsonResponse(
        {
            "success": True,
            "hierarchy_type": "GEOGRAPHICAL",
            "data": {
                "state_id": state["state_id"],          "state_name": state["state_name"],
                "district_id": district["district_id"], "district_name": district["district_name"],
                "taluka_id": taluka["taluka_id"],       "taluka_name": taluka["taluka_name"],
                "city_id": city["city_id"],             "city_name": city["city_name"],
                "branch_id": branch["branch_id"],       "branch_name": branch["branch_name"],
                "floor_id": floor["floor_id"],          "floor_name": floor["floor_name"],
            },
        },
        status=201,
    )


# =====================================================================
# FILTERING AND ENRICHMENT HELPERS
# =====================================================================
def matches(value, selected):
    if not selected:
        return True
    return str(value).strip().lower() == str(selected).strip().lower()


GEOGRAPHICAL_FIELDS = [
    "state_id", "state_name", "district_id", "district_name",
    "taluka_id", "taluka_name", "city_id", "city_name",
    "branch_id", "branch_name", "floor_id", "floor_name", "site_id",
]

ZONAL_FIELDS = [
    "zone_id", "zone_name", "circle_id", "circle_name",
    "region_id", "region_name", "division_id", "division_name",
    "branch_id", "branch_name", "floor_id", "floor_name", "site_id",
]


def resolve_ac_location(ac_id, device_map):
    mapping = device_map.get(ac_id, {})

    if not mapping:
        return {
            "geographical": {}, "zonal": {}, "site_id": "",
            "device_name": "", "location_type": "", "hierarchy_type": "",
        }

    if "geographical" in mapping or "zonal" in mapping:
        geo = mapping.get("geographical") or {}
        zon = mapping.get("zonal") or {}
        hierarchy_type = str(mapping.get("hierarchy_type", "")).upper()
        return {
            "geographical": geo, "zonal": zon,
            "site_id": mapping.get("site_id", ""),
            "device_name": mapping.get("device_name", ""),
            "location_type": mapping.get("location_type", ""),
            "hierarchy_type": hierarchy_type,
        }

    hierarchy_type = str(mapping.get("hierarchy_type", "")).upper()
    geo, zon = {}, {}
    if hierarchy_type == "GEOGRAPHICAL":
        geo = {f: mapping.get(f, "") for f in GEOGRAPHICAL_FIELDS}
    elif hierarchy_type == "ZONAL":
        zon = {f: mapping.get(f, "") for f in ZONAL_FIELDS}

    return {
        "geographical": geo, "zonal": zon,
        "site_id": mapping.get("site_id", ""),
        "device_name": mapping.get("device_name", ""),
        "location_type": mapping.get("location_type", ""),
        "hierarchy_type": hierarchy_type,
    }


def filter_by_location(data, request):
    hierarchy = request.GET.get("hierarchy", "").strip().upper()

    zone     = request.GET.get("zone", "").strip()
    state    = request.GET.get("state", "").strip()
    district = request.GET.get("district", "").strip()
    taluka   = request.GET.get("taluka", "").strip()
    circle   = request.GET.get("circle", "").strip()
    region   = request.GET.get("region", "").strip()
    division = request.GET.get("division", "").strip()
    city     = request.GET.get("city", "").strip()
    branch   = request.GET.get("branch", "").strip()
    floor    = request.GET.get("floor", "").strip()

    if not any([hierarchy, zone, state, district, taluka, circle,
                region, division, city, branch, floor]):
        return data

    device_map = build_device_location_map()

    def keep(record):
        ac_id = record.get("ac_id", "")
        loc   = resolve_ac_location(ac_id, device_map)
        geo   = loc["geographical"]
        zon   = loc["zonal"]

        if hierarchy == "GEOGRAPHICAL":
            if not geo:
                return False
            return (
                matches(geo.get("state_name", ""),    state)
                and matches(geo.get("district_name", ""), district)
                and matches(geo.get("taluka_name", ""),   taluka)
                and matches(geo.get("city_name", ""),     city)
                and matches(geo.get("branch_name", ""),   branch)
                and matches(geo.get("floor_name", ""),    floor)
            )

        if hierarchy == "ZONAL":
            if not zon:
                return False
            return (
                matches(zon.get("zone_name", ""),     zone)
                and matches(zon.get("circle_name", ""),   circle)
                and matches(zon.get("region_name", ""),   region)
                and matches(zon.get("division_name", ""), division)
                and matches(zon.get("branch_name", ""),   branch)
                and matches(zon.get("floor_name", ""),    floor)
            )

        branch_name = geo.get("branch_name") or zon.get("branch_name") or ""
        floor_name  = geo.get("floor_name") or zon.get("floor_name") or ""

        return (
            matches(geo.get("state_name", ""),    state)
            and matches(geo.get("district_name", ""), district)
            and matches(geo.get("taluka_name", ""),   taluka)
            and matches(geo.get("city_name", ""),     city)
            and matches(zon.get("zone_name", ""),     zone)
            and matches(zon.get("circle_name", ""),   circle)
            and matches(zon.get("region_name", ""),   region)
            and matches(zon.get("division_name", ""), division)
            and matches(branch_name, branch)
            and matches(floor_name, floor)
        )

    return [record for record in data if keep(record)]


def attach_location(record, device_map):
    enriched = dict(record)
    ac_id    = record.get("ac_id", "")
    loc      = resolve_ac_location(ac_id, device_map)

    enriched.update(loc["geographical"])
    enriched.update(loc["zonal"])

    if loc["site_id"]:
        enriched["site_id"] = loc["site_id"]
    if loc["device_name"]:
        enriched["device_name"] = loc["device_name"]

    enriched["location_type"]  = loc["location_type"]
    enriched["hierarchy_type"] = loc["hierarchy_type"]

    return enriched


# =====================================================================
# DATA VIEWS
# =====================================================================
@api_view(["GET"])
def ac_data_with_location(request):
    try:
        data = telemetry.get_records()
        data = scope_ac_records(data, request.user)
        data = filter_by_location(data, request)

        device_map = build_device_location_map()
        data = [attach_location(rec, device_map) for rec in data]

        return JsonResponse(
            {"status": "success", "count": len(data), "data": data},
            safe=True,
        )
    except json.JSONDecodeError:
        return JsonResponse({"status": "error", "message": "Invalid JSON format"}, status=500)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ac_data(request):
    try:
        data = telemetry.get_records()
        data = scope_ac_records(data, request.user)
        data = filter_by_location(data, request)

        device_map = build_device_location_map()
        data = [attach_location(rec, device_map) for rec in data]

        return JsonResponse(
            {"status": "success", "count": len(data), "data": data},
            safe=True,
        )
    except json.JSONDecodeError:
        return JsonResponse({"status": "error", "message": "Invalid JSON format"}, status=500)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def telemetry_status(request):
    return JsonResponse(telemetry.get_status())


@api_view(["GET"])
def latest_ac_data(request):
    try:
        data = scope_ac_records(telemetry.get_records(), request.user)
        if not data:
            return JsonResponse({"status": "success", "data": None})
        return JsonResponse({"status": "success", "data": data[-1]})
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)


# =====================================================================
# AUTH VIEWS
# =====================================================================
def get_client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _dashboard_path(role):
    return {
        Role.ORG_SUPER_ADMIN: "/org/dashboard",
        Role.CUSTOMER:        "/customer/dashboard",
        Role.BR_ADMIN:        "/admin/dashboard",
        Role.ENGINEER:        "/engineer/dashboard",
    }.get(role, "/login")


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    email          = (request.data.get("email") or "").strip().lower()
    password       = request.data.get("password") or ""
    requested_role = (request.data.get("role") or "").strip()

    if not email or not password:
        return Response(
            {"status": "error", "message": "Email and password are required."},
            status=400,
        )

    try:
        # ---- 1. Direct 3TP login ----
        tb_response = requests.post(
            f"{CLOUD_URL}/api/auth/login",
            json={"username": email, "password": password},
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            timeout=15,
        )

        try:
            data = tb_response.json()
        except ValueError:
            data = {}

        if tb_response.status_code != 200:
            return Response(
                {"status": "error", "message": data.get("message", "Server Authentication failed.")},
                status=tb_response.status_code,
            )

        three_tp_token = data.get("token")
        refresh_token  = data.get("refreshToken")

        if not three_tp_token:
            return Response(
                {"status": "error",
                 "message": "Server succeeded but no token was returned."},
                status=502,
            )

        # ---- 2. Find local user ----
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            return Response(
                {"status": "error",
                 "message": ("Server Login Succeeded, but this user "
                             "does not exist in the AC Monitoring system.")},
                status=403,
            )

        if not user.is_active:
            return Response(
                {"status": "error", "message": "User account is inactive."},
                status=403,
            )

        if requested_role and user.role != requested_role:
            return Response(
                {"status": "error",
                 "message": f"This account belongs to '{user.get_role_display()}'."},
                status=403,
            )

        # ---- 3. Save login info ----
        user.last_login    = timezone.now()
        user.last_login_ip = get_client_ip(request)
        user.save(update_fields=["last_login", "last_login_ip"])

        django_login(request, user)

        # ---- 4. Cache 3TP token -> local user ----
        token_hash = hashlib.sha256(three_tp_token.encode("utf-8")).hexdigest()
        cache.set(f"3tp_auth:{token_hash}", user.id, timeout=None)
        Token.objects.filter(user=user).delete()
        Token.objects.create(user=user)

        return Response(
            {
                "status":       "success",
                "message":      "Login successful",
                "token":        three_tp_token,
                "refreshToken": refresh_token,
                "user":         UserSerializer(user).data,
                "redirect":     _dashboard_path(user.role),
            },
            status=200,
        )

    except requests.exceptions.RequestException as exc:
        return Response(
            {"status": "error", "message": f"Server connection error: {str(exc)}"},
            status=502,
        )
    except Exception as exc:
        traceback.print_exc()
        return Response({"status": "error", "message": str(exc)}, status=500)


@api_view(["POST"])
def logout_view(request):
    if request.user.is_authenticated:
        raw_token = getattr(request, "auth", None)
        if isinstance(raw_token, str) and raw_token:
            cache.delete(
                "3tp_auth:" + hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
            )
        Token.objects.filter(user=request.user).delete()
        django_logout(request)
    return Response({"detail": "Logged out."}, status=status.HTTP_200_OK)


@api_view(["GET"])
def me_view(request):
    return Response(UserSerializer(request.user).data)


# =====================================================================
# ORGANIZATION
# =====================================================================
class OrganizationListView(generics.ListAPIView):
    serializer_class = OrganizationSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == Role.ORG_SUPER_ADMIN:
            return Organization.objects.filter(pk=user.organization_id)
        return Organization.objects.none()


import secrets
import string
from collections import defaultdict
from urllib.parse import urlparse, parse_qs

from django.db.models import Q
from rest_framework.exceptions import APIException


# ---------------------------------------------------------------- basics
def generate_password(length=12):
    specials = "@$!%*?&"
    pool = string.ascii_letters + string.digits + specials
    while True:
        pwd = "".join(secrets.choice(pool) for _ in range(length))
        if (any(c.islower() for c in pwd) and any(c.isupper() for c in pwd)
                and any(c.isdigit() for c in pwd) and any(c in specials for c in pwd)):
            return pwd


def _one_line(exc, n=300):
    return " ".join(str(exc).split())[:n]


def _id_of(data):
    raw = (data or {}).get("id")
    return str(raw.get("id") if isinstance(raw, dict) else raw or "")


def _raw_token(request):
    """Accepts 'Bearer <jwt>' or 'Token <jwt>'."""
    h = request.headers.get("Authorization", "").strip()
    return h.split(" ", 1)[1].strip() if " " in h else h


def _tpt_user_headers(request_or_header):
    if hasattr(request_or_header, "headers"):
        token = _raw_token(request_or_header)
    else:
        h = (request_or_header or "").strip()
        token = h.split(" ", 1)[1].strip() if " " in h else h
    bearer = f"Bearer {token}"
    return {
        "Authorization": bearer,
        "X-Authorization": bearer,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _customer_has_field(name):
    return any(f.name == name for f in Customer._meta.get_fields())


class ThreeTPAPIError(APIException):
    status_code = 502
    default_detail = "3TP request failed."


# ------------------------------------------------------------ 3TP calls
def _activate_3tp_user(auth_header, tpt_user_id, raw_password):
    link_res = requests.get(
        f"{CLOUD_URL}/api/user/{tpt_user_id}/activationLinkInfo",
        headers=_tpt_user_headers(auth_header), timeout=15,
    )
    if link_res.status_code != 200:
        raise ThreeTPError("Could not fetch activation link.",
                           status=link_res.status_code, payload=link_res.text)
    link = (link_res.json() or {}).get("value")
    token = parse_qs(urlparse(link or "").query).get("activateToken", [None])[0]
    if not token:
        raise ThreeTPError("Activation token missing in activation link.")

    act = requests.post(
        f"{CLOUD_URL}/api/noauth/activate",
        params={"sendActivationMail": "false"},
        json={"activateToken": token, "password": raw_password},
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        timeout=15,
    )
    if act.status_code not in (200, 201):
        raise ThreeTPError("3TP user activation failed.",
                           status=act.status_code, payload=act.text)


def _rollback_3tp_customer(auth_header, tpt_customer_id):
    try:
        requests.delete(f"{CLOUD_URL}/api/customer/{tpt_customer_id}",
                        headers=_tpt_user_headers(auth_header), timeout=15)
    except requests.RequestException:
        pass


def fetch_3tp_customers(request):
    out, page, total_pages = [], 0, 1
    while page < total_pages:
        res = requests.get(
            f"{CLOUD_URL}/api/customers",
            params={"pageSize": 1000, "page": page,
                    "sortProperty": "createdTime", "sortOrder": "DESC"},
            headers=_tpt_user_headers(request), timeout=15,
        )
        if res.status_code != 200:
            raise ThreeTPError("Failed to fetch customers from 3TP.",
                               status=res.status_code, payload=res.text)
        data = res.json()
        out.extend(data.get("data", []))
        total_pages = data.get("totalPages", 1)
        page += 1
    return out


class CustomerListView(CustomerScopeMixin, generics.ListCreateAPIView):
    serializer_class = CustomerSerializer
    permission_classes = [IsOrgSuperAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["company", "code", "company_email",
                     "contact_person", "contact_person_email", "phone"]
    ordering_fields = ["company", "code", "created_at"]
    ordering = ["company"]

    # ------------------------------------------------------------------ GET
    def get_queryset(self):
        qs = super().get_queryset()
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ("1", "true", "yes"))
        return qs

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        warning = None

        try:
            cloud = fetch_3tp_customers(request)
            cloud_ids = {c["id"]["id"] for c in cloud if c.get("id")}
            cloud_emails = {(c.get("email") or "").lower() for c in cloud}

            if _customer_has_field("tpt_customer_id"):
                qs = qs.filter(
                    Q(tpt_customer_id__in=cloud_ids)
                    | Q(tpt_customer_id="", company_email__in=cloud_emails)
                )
            else:
                qs = qs.filter(company_email__in=cloud_emails)
        except (ThreeTPError, requests.RequestException, KeyError, ValueError) as exc:
            # never let 3TP problems break the list; show local data
            warning = " ".join(str(exc).split())[:200]

        sites_by_customer = defaultdict(list)
        try:
            for s in Site.objects.filter(branch__customer__in=qs).select_related("branch"):
                sites_by_customer[str(s.branch.customer_id)].append({
                    "id": str(s.id), "name": s.name, "code": s.code,
                    "branch_id": str(s.branch_id), "branch_name": s.branch.name,
                })
        except Exception:
            pass  # sites are optional in the list

        page = self.paginate_queryset(qs)
        rows = self.get_serializer(page if page is not None else qs, many=True).data
        rows = [{**r, "assigned_sites": sites_by_customer.get(str(r["id"]), [])}
                for r in rows]

        resp = self.get_paginated_response(rows) if page is not None else Response(rows)
        if warning:
            resp["X-3TP-Warning"] = warning  # single line, safe for headers
        return resp

    # ----------------------------------------------------------------- POST
    # def create(self, request, *args, **kwargs):
    #     auth_header = request.headers.get("Authorization", "")
    #     if not _raw_token(request):
    #         return Response({"status": "error", "message": "Auth token required."},
    #                         status=status.HTTP_401_UNAUTHORIZED)
    #     auth_header = request.headers.get("Authorization", "")

    #     user = request.user
    #     if user.role != Role.ORG_SUPER_ADMIN:
    #         return Response({"status": "error",
    #                          "message": "Only organization super admin can create customers."},
    #                         status=status.HTTP_403_FORBIDDEN)

    #     serializer = self.get_serializer(data=request.data)
    #     serializer.is_valid(raise_exception=True)
    #     d = serializer.validated_data

    #     company        = (d.get("company") or "").strip()
    #     company_email  = (d.get("company_email") or "").strip().lower()
    #     contact_person = (d.get("contact_person") or "").strip()
    #     phone          = (d.get("phone") or "").strip()

    #     if not company_email:
    #         return Response({"status": "error", "message": "company_email is required."},
    #                         status=status.HTTP_400_BAD_REQUEST)

    #     # ---- local duplicate checks
    #     if Customer.objects.filter(organization=user.organization,
    #                                company_email__iexact=company_email, is_active=True).exists():
    #         return Response({"status": "error",
    #                          "message": "A customer with this email already exists."}, status=400)
    #     if User.objects.filter(email__iexact=company_email).exists():
    #         return Response({"status": "error",
    #                          "message": "A user with this email already exists."}, status=400)

    #     headers = _tpt_user_headers(auth_header)
    #     raw_password = request.data.get("password") or generate_password()

    #     tpt_customer_id = None
    #     try:
    #         # ---- A. customer in 3TP
    #         res = requests.post(f"{CLOUD_URL}/api/customer", headers=headers, timeout=15, json={
    #             "title": company,
    #             "email": company_email,
    #             "phone": phone,
    #             "address": d.get("address") or d.get("address_line_1") or "",
    #             "city": d.get("city") or "",
    #             "state": d.get("state") or "",
    #             "country": "India",
    #             "zip": d.get("pincode") or "",
    #         })
    #         created_new_in_3tp = True
    #         res = requests.post(f"{CLOUD_URL}/api/customer", headers=headers, timeout=15, json={...})

    #         if res.status_code == 400 and "already exists" in res.text:
    #             existing = find_3tp_customer_by_title(request, company)
    #             existing_id = _id_of(existing) if existing else ""
    #             already_local = (
    #                 _customer_has_field("tpt_customer_id")
    #                 and Customer.objects.filter(tpt_customer_id=existing_id).exists()
    #             )
    #             if not existing_id or already_local:
    #                 return Response(
    #                     {"status": "error",
    #                      "message": f"A customer named '{company}' already exists. Use a different name."},
    #                     status=400)
    #             # orphan from an earlier failed attempt: reuse it
    #             tpt_customer_id = existing_id
                
    #             created_new_in_3tp = False
    #         elif res.status_code not in (200, 201):
    #             return Response({"status": "error", "message": "Failed to create customer in 3TP.",
    #                              "details": res.text}, status=res.status_code)
    #         else:
    #             tpt_customer_id = _id_of(res.json())

    #         if not tpt_customer_id:
    #             return Response({"status": "error",
    #                              "message": "3TP did not return a customer id."}, status=502)
            
    #         return Response({"status": "error",
    #                              "message": "3TP did not return a customer id."}, status=502)

    #         # ---- B. CUSTOMER_USER in 3TP
    #         res = requests.post(
    #             f"{CLOUD_URL}/api/user", params={"sendActivationMail": "false"},
    #             headers=headers, timeout=15,
    #             json={"email": company_email, "authority": "CUSTOMER_USER",
    #                   "firstName": contact_person or company, "lastName": "", "phone": phone,
    #                   "customerId": {"id": tpt_customer_id, "entityType": "CUSTOMER"}},
    #         )
    #         if res.status_code not in (200, 201):
    #             _rollback_3tp_customer(auth_header, tpt_customer_id)
    #             return Response({"status": "error",
    #                              "message": "Failed to create CUSTOMER_USER in 3TP.",
    #                              "details": res.text}, status=res.status_code)
    #         tpt_user_id = _id_of(res.json())

    #         # ---- C. activate user with the password
    #         _activate_3tp_user(auth_header, tpt_user_id, raw_password)

    #     except (requests.RequestException, ThreeTPError) as exc:
    #         if tpt_customer_id:
    #             _rollback_3tp_customer(auth_header, tpt_customer_id)
    #         return Response({"status": "error", "message": f"3TP error: {exc}"},
    #                         status=status.HTTP_502_BAD_GATEWAY)

    #     # ---- D. local customer + local customer user (atomic)
    #     try:
    #         with transaction.atomic():
    #             extra = {"organization": user.organization}
    #             if hasattr(Customer, "tpt_customer_id"):
    #                 extra["tpt_customer_id"] = tpt_customer_id
    #             customer = serializer.save(**extra)

    #             admin = User(
    #                 name=contact_person or company,
    #                 email=company_email,
    #                 phone=phone,
    #                 role=Role.CUSTOMER,
    #                 organization=user.organization,
    #                 customer=customer,
    #                 is_active=True,
    #             )
    #             admin.set_password(raw_password)
    #             admin.save()
    #     except Exception as exc:
    #         _rollback_3tp_customer(auth_header, tpt_customer_id)  # also removes its users
    #         return Response({"status": "error",
    #                          "message": "Local creation failed; 3TP changes were rolled back.",
    #                          "details": str(exc)}, status=500)

    #     # send_login_credentials(company_email, raw_password, user_type="customer_admin")  # if you port the mailer

    #     return Response({
    #         "status": "success",
    #         "message": "Customer created successfully.",
    #         "data": {
    #             "id": customer.id,
    #             "company": customer.company,
    #             "code": customer.code,
    #             "company_email": customer.company_email,
    #             "tpt_customer_id": tpt_customer_id,
    #             "tpt_user_id": tpt_user_id,
    #             "customer_admin": {"name": admin.name, "email": admin.email, "role": admin.role},
    #             # only returned when it was auto-generated, so the admin can hand it over
    #             "generated_password": None if request.data.get("password") else raw_password,
    #         },
    #     }, status=status.HTTP_201_CREATED)

    def create(self, request, *args, **kwargs):
        try:
            return self._create_impl(request)
        except (DRFValidationError, APIException):
            raise
        except Exception as exc:
            traceback.print_exc()
            return Response({"status": "error",
                             "message": f"{type(exc).__name__}: {_one_line(exc)}"}, status=500)

    def _create_impl(self, request):
        if not _raw_token(request):
            return Response({"status": "error", "message": "Auth token required."},
                            status=status.HTTP_401_UNAUTHORIZED)
        auth_header = request.headers.get("Authorization", "")

        user = request.user
        if user.role != Role.ORG_SUPER_ADMIN:
            return Response({"status": "error",
                             "message": "Only organization super admin can create customers."},
                            status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        company        = (d.get("company") or "").strip()
        company_email  = (d.get("company_email") or "").strip().lower()
        contact_person = (d.get("contact_person") or "").strip()
        phone          = (d.get("phone") or "").strip()

        if not company_email:
            return Response({"status": "error", "message": "company_email is required."}, status=400)
        if Customer.objects.filter(organization=user.organization,
                                   company_email__iexact=company_email, is_active=True).exists():
            return Response({"status": "error",
                             "message": "A customer with this email already exists."}, status=400)
        if User.objects.filter(email__iexact=company_email).exists():
            return Response({"status": "error",
                             "message": "A user with this email already exists."}, status=400)

        headers = _tpt_user_headers(auth_header)
        raw_password = request.data.get("password") or generate_password()

        tpt_customer_id = ""
        tpt_user_id = ""
        created_new_in_3tp = True

        try:
            # ---- A. POST customer to 3TP (once)
            payload = {
                "title": company,
                "email": company_email,
                "phone": phone,
                "address": d.get("address_line_1") or d.get("address") or "",
                "city": d.get("city") or "",
                "state": d.get("state") or "",
                "country": "India",
                "zip": d.get("pincode") or "",
            }
            res = requests.post(f"{CLOUD_URL}/api/customer",
                                json=payload, headers=headers, timeout=15)

            if res.status_code == 400 and "already exists" in res.text:
                existing = find_3tp_customer_by_title(request, company)
                existing_id = _id_of(existing) if existing else ""
                already_local = bool(
                    existing_id
                    and _customer_has_field("tpt_customer_id")
                    and Customer.objects.filter(tpt_customer_id=existing_id).exists()
                )
                if not existing_id or already_local:
                    return Response({"status": "error",
                                     "message": f"A customer named '{company}' already exists. Use a different name."},
                                    status=400)
                # orphan from an earlier failed attempt: reuse it and clear its stale user
                tpt_customer_id = existing_id
                created_new_in_3tp = False
                stale = find_3tp_user_id(request, tpt_customer_id, company_email)
                if stale:
                    delete_3tp_user(request, stale)
            elif res.status_code not in (200, 201):
                return Response({"status": "error", "message": "Failed to create customer in 3TP.",
                                 "details": res.text}, status=res.status_code)
            else:
                tpt_customer_id = _id_of(res.json())

            if not tpt_customer_id:
                return Response({"status": "error",
                                 "message": "3TP did not return a customer id."}, status=502)

            # ---- B. POST CUSTOMER_USER to 3TP
            res = requests.post(
                f"{CLOUD_URL}/api/user", params={"sendActivationMail": "false"},
                headers=headers, timeout=15,
                json={"email": company_email, "authority": "CUSTOMER_USER",
                      "firstName": contact_person or company, "lastName": "", "phone": phone,
                      "customerId": {"id": tpt_customer_id, "entityType": "CUSTOMER"}},
            )
            if res.status_code not in (200, 201):
                if created_new_in_3tp:
                    _rollback_3tp_customer(auth_header, tpt_customer_id)
                return Response({"status": "error",
                                 "message": "Failed to create CUSTOMER_USER in 3TP.",
                                 "details": res.text}, status=res.status_code)
            tpt_user_id = _id_of(res.json())

            # ---- C. activate with the password
            _activate_3tp_user(auth_header, tpt_user_id, raw_password)

        except (requests.RequestException, ThreeTPError) as exc:
            if tpt_customer_id and created_new_in_3tp:
                _rollback_3tp_customer(auth_header, tpt_customer_id)
            return Response({"status": "error", "message": f"3TP error: {_one_line(exc)}"},
                            status=status.HTTP_502_BAD_GATEWAY)

        # ---- D. local customer + local customer user
        try:
            with transaction.atomic():
                extra = {"organization": user.organization}
                if _customer_has_field("tpt_customer_id"):
                    extra["tpt_customer_id"] = tpt_customer_id
                customer = serializer.save(**extra)

                admin = User(name=contact_person or company, email=company_email, phone=phone,
                             role=Role.CUSTOMER, organization=user.organization,
                             customer=customer, is_active=True)
                admin.set_password(raw_password)
                admin.save()
        except Exception as exc:
            traceback.print_exc()
            _rollback_3tp_customer(auth_header, tpt_customer_id)
            return Response({"status": "error",
                             "message": "Local creation failed; 3TP changes were rolled back.",
                             "details": _one_line(exc)}, status=500)

        return Response({
            "status": "success",
            "message": "Customer created successfully.",
            "data": {
                "id": customer.id,
                "company": customer.company,
                "code": customer.code,
                "company_email": customer.company_email,
                "tpt_customer_id": tpt_customer_id,
                "tpt_user_id": tpt_user_id,
                "customer_admin": {"name": admin.name, "email": admin.email, "role": admin.role},
            },
        }, status=status.HTTP_201_CREATED)
    
class CustomerDetailView(CustomerScopeMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CustomerSerializer
    permission_classes = [IsOrgSuperAdmin]
    lookup_field = "pk"

    def perform_destroy(self, instance):
        instance.delete()

ADMIN_ROLES = [
    Role.ORG_SUPER_ADMIN,
    Role.CUSTOMER,
    Role.BR_ADMIN,
    Role.ENGINEER,
]

class AdminListView(ThreeTPUserMixin, generics.ListCreateAPIView):
    serializer_class = AdminSerializer
    permission_classes = [IsOrgAdminOrCustomerAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "email", "phone", "role"]
    ordering_fields = ["name", "email", "date_joined"]
    ordering = ["name"]

    def get_queryset(self):
        user = self.request.user
        base = User.objects.select_related(
            "organization", "customer", "zone", "circle", "state", "district", "branch", "site"
        )

        if user.role == Role.ORG_SUPER_ADMIN:
            qs = base.filter(organization_id=user.organization_id)
        elif user.role == Role.CUSTOMER:
            qs = base.filter(customer_id=user.customer_id)
        elif user.role == Role.BR_ADMIN:
            hierarchy = getattr(user.customer, "hierarchy_type", None) if user.customer_id else None
            if hierarchy == "GEOGRAPHICAL" and user.state_id:
                qs = base.filter(customer_id=user.customer_id, state_id=user.state_id)
            elif hierarchy == "ZONAL" and user.zone_id:
                qs = base.filter(customer_id=user.customer_id, zone_id=user.zone_id)
            elif user.branch_id:
                qs = base.filter(branch_id=user.branch_id)
            else:
                return base.none()
        else:
            return base.none()

        qs = qs.filter(role__in=ADMIN_ROLES)

        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ("1", "true", "yes"))
        return qs

    def build_extra(self, serializer):
        user = self.request.user
        vd = serializer.validated_data
        role = vd.get("role")
        extra = {"organization": user.organization}

        customer = user.customer if user.role == Role.CUSTOMER else vd.get("customer")
        if customer is not None:
            extra["customer"] = customer

        if role == Role.BR_ADMIN:
            if not customer:
                raise DRFValidationError({"customer": "Customer is required for a Branch Admin."})
            blank = dict(zone=None, circle=None, region=None, division=None, district=None,
                         taluka=None, city=None, branch=None, site=None, state=None)
            if customer.hierarchy_type == "GEOGRAPHICAL":
                state = vd.get("state")
                if not state or state.customer_id != customer.pk:
                    raise DRFValidationError({"state": "Select a state belonging to this customer."})
                extra.update({**blank, "state": state})
            elif customer.hierarchy_type == "ZONAL":
                zone = vd.get("zone")
                if not zone or zone.customer_id != customer.pk:
                    raise DRFValidationError({"zone": "Select a zone belonging to this customer."})
                extra.update({**blank, "zone": zone})
            else:
                raise DRFValidationError({"customer": "Customer hierarchy is not configured."})
        elif role == Role.ENGINEER and not customer:
            raise DRFValidationError({"customer": "Customer is required for an engineer."})
        return extra

class AdminDetailView(ThreeTPUserMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AdminSerializer
    permission_classes = [IsOrgAdminOrCustomerAdmin]
    lookup_field = "pk"

    def get_queryset(self):
        user = self.request.user
        base = User.objects.all()
        if user.role == Role.ORG_SUPER_ADMIN:
            return base.filter(organization_id=user.organization_id)
        if user.role == Role.CUSTOMER:
            return base.filter(customer_id=user.customer_id,
                               role__in=[Role.BR_ADMIN, Role.ENGINEER])
        if user.role == Role.BR_ADMIN:
            return base.filter(branch_id=user.branch_id)
        return base.none()
    
    def update_extra(self, serializer):
        if self.request.user.role == Role.CUSTOMER:
            return {"customer": self.request.user.customer}
        return {}


class EngDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AdminSerializer
    permission_classes = [IsOrgSuperAdmin]
    lookup_field = "pk"

    def get_queryset(self):
        user = self.request.user
        base = User.objects.filter(role=Role.ENGINEER)

        if user.role == Role.ORG_SUPER_ADMIN:
            return base.filter(organization_id=user.organization_id)
        if user.role == Role.CUSTOMER:
            return base.filter(customer_id=user.customer_id)
        if user.role == Role.BR_ADMIN:
            return base.filter(branch_id=user.branch_id)
        return base.none()


class EngListView(ThreeTPUserMixin, generics.ListCreateAPIView):
    serializer_class = AdminSerializer
    permission_classes = [IsOrgSuperAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "email", "phone"]
    ordering_fields = ["name", "email", "date_joined"]
    ordering = ["name"]

    def get_queryset(self):
        user = self.request.user
        base = User.objects.select_related(
            "organization", "customer", "zone", "circle", "state", "district", "branch", "site"
        ).filter(role=Role.ENGINEER)

        if user.role == Role.ORG_SUPER_ADMIN:
            qs = base.filter(organization_id=user.organization_id)
        elif user.role == Role.CUSTOMER:
            qs = base.filter(customer_id=user.customer_id)
        elif user.role == Role.BR_ADMIN:
            qs = base.filter(branch_id=user.branch_id)
        else:
            return base.none()

        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ("1", "true", "yes"))
        return qs

    def build_extra(self, serializer):
        user = self.request.user
        customer = user.customer if user.customer_id else serializer.validated_data.get("customer")
        if not customer:
            raise DRFValidationError({"customer": "Customer is required for an engineer."})
        return {"organization": user.organization, "customer": customer, "role": Role.ENGINEER}

    def update_extra(self, serializer):
        u = self.request.user
        return {"customer": u.customer} if u.customer_id else {}


class EngDetailView(ThreeTPUserMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AdminSerializer
    permission_classes = [IsOrgSuperAdmin]
    lookup_field = "pk"

    def get_queryset(self):
        user = self.request.user
        base = User.objects.filter(role=Role.ENGINEER)
        if user.role == Role.ORG_SUPER_ADMIN:
            return base.filter(organization_id=user.organization_id)
        if user.role == Role.CUSTOMER:
            return base.filter(customer_id=user.customer_id)
        if user.role == Role.BR_ADMIN:
            return base.filter(branch_id=user.branch_id)
        return base.none()
    
# =====================================================================
# GEOGRAPHICAL / ZONAL LIST VIEWS
# =====================================================================
class ZoneListView(generics.ListAPIView):
    serializer_class = ZoneSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == Role.ORG_SUPER_ADMIN:
            return Zone.objects.filter(customer__organization_id=user.organization_id)
        if user.role == Role.CUSTOMER:
            return Zone.objects.filter(customer_id=user.customer_id)
        if user.role in [Role.BR_ADMIN, Role.ENGINEER]:
            return Zone.objects.filter(pk=user.zone_id)
        return Zone.objects.none()


class CircleListView(generics.ListAPIView):
    serializer_class = CircleSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == Role.ORG_SUPER_ADMIN:
            qs = Circle.objects.filter(zone__customer__organization_id=user.organization_id)
        elif user.role == Role.CUSTOMER:
            qs = Circle.objects.filter(zone__customer_id=user.customer_id)
        elif user.role in [Role.BR_ADMIN, Role.ENGINEER]:
            qs = Circle.objects.filter(pk=user.circle_id)
        else:
            return Circle.objects.none()

        zone_id = self.request.query_params.get("zone")
        if zone_id:
            qs = qs.filter(zone_id=zone_id)
        return qs


class StateListView(generics.ListAPIView):
    serializer_class = StateSerializer

    def get_queryset(self):
        user = self.request.user
        qs = State.objects.select_related("customer")

        if user.role == Role.ORG_SUPER_ADMIN:
            qs = qs.filter(customer__organization_id=user.organization_id)
        elif user.role in [Role.CUSTOMER, Role.BR_ADMIN, Role.ENGINEER]:
            qs = qs.filter(customer_id=user.customer_id)
        else:
            return qs.none()

        customer_id = self.request.query_params.get("customer")
        if customer_id:
            qs = qs.filter(customer_id=customer_id)
        return qs


class TalukaListView(generics.ListAPIView):
    serializer_class = TalukaSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Taluka.objects.select_related("district", "district__state")

        if user.role == Role.ORG_SUPER_ADMIN:
            qs = qs.filter(district__state__customer__organization_id=user.organization_id)
        elif user.role in [Role.CUSTOMER, Role.BR_ADMIN, Role.ENGINEER]:
            qs = qs.filter(district__state__customer_id=user.customer_id)
        else:
            return qs.none()

        district_id = self.request.query_params.get("district")
        if district_id:
            qs = qs.filter(district_id=district_id)
        return qs.order_by("name")


class CityListView(generics.ListAPIView):
    serializer_class = CitySerializer

    def get_queryset(self):
        user = self.request.user
        qs = City.objects.select_related("taluka", "taluka__district", "taluka__district__state")

        if user.role == Role.ORG_SUPER_ADMIN:
            qs = qs.filter(taluka__district__state__customer__organization_id=user.organization_id)
        elif user.role in [Role.CUSTOMER, Role.BR_ADMIN, Role.ENGINEER]:
            qs = qs.filter(taluka__district__state__customer_id=user.customer_id)
        else:
            return qs.none()

        taluka_id = self.request.query_params.get("taluka")
        if taluka_id:
            qs = qs.filter(taluka_id=taluka_id)
        return qs.order_by("name")


class RegionListView(generics.ListAPIView):
    serializer_class = RegionSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Region.objects.select_related("circle", "circle__zone")

        if user.role == Role.ORG_SUPER_ADMIN:
            qs = qs.filter(circle__zone__customer__organization_id=user.organization_id)
        elif user.role in [Role.CUSTOMER, Role.BR_ADMIN, Role.ENGINEER]:
            qs = qs.filter(circle__zone__customer_id=user.customer_id)
        else:
            return qs.none()

        circle_id = self.request.query_params.get("circle")
        if circle_id:
            qs = qs.filter(circle_id=circle_id)
        return qs.order_by("name")


class DivisionListView(generics.ListAPIView):
    serializer_class = DivisionSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Division.objects.select_related("region", "region__circle", "region__circle__zone")

        if user.role == Role.ORG_SUPER_ADMIN:
            qs = qs.filter(region__circle__zone__customer__organization_id=user.organization_id)
        elif user.role in [Role.CUSTOMER, Role.BR_ADMIN, Role.ENGINEER]:
            qs = qs.filter(region__circle__zone__customer_id=user.customer_id)
        else:
            return qs.none()

        region_id = self.request.query_params.get("region")
        if region_id:
            qs = qs.filter(region_id=region_id)
        return qs.order_by("name")


class DistrictListView(generics.ListAPIView):
    serializer_class = DistrictSerializer

    def get_queryset(self):
        user = self.request.user
        qs = District.objects.select_related("state", "state__customer")

        if user.role == Role.ORG_SUPER_ADMIN:
            qs = qs.filter(state__customer__organization_id=user.organization_id)
        elif user.role in [Role.CUSTOMER, Role.BR_ADMIN, Role.ENGINEER]:
            qs = qs.filter(state__customer_id=user.customer_id)
        else:
            return qs.none()

        state_id = self.request.query_params.get("state")
        if state_id:
            qs = qs.filter(state_id=state_id)
        return qs


class BranchListView(generics.ListAPIView):
    serializer_class = BranchSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Branch.objects.select_related(
            "customer",
            "city", "city__taluka", "city__taluka__district",
            "city__taluka__district__state",
            "division", "division__region",
            "division__region__circle", "division__region__circle__zone",
        )

        if user.role == Role.ORG_SUPER_ADMIN:
            qs = qs.filter(customer__organization_id=user.organization_id)
        elif user.role == Role.CUSTOMER:
            qs = qs.filter(customer_id=user.customer_id)
        elif user.role == Role.BR_ADMIN:
            hierarchy = getattr(user.customer, "hierarchy_type", None) if user.customer_id else None
            if hierarchy == "GEOGRAPHICAL" and user.state_id:
                qs = qs.filter(
                    customer_id=user.customer_id,
                    city__taluka__district__state_id=user.state_id,
                )
            elif hierarchy == "ZONAL" and user.zone_id:
                qs = qs.filter(
                    customer_id=user.customer_id,
                    division__region__circle__zone_id=user.zone_id,
                )
            elif user.branch_id:
                qs = qs.filter(pk=user.branch_id)
            else:
                return Branch.objects.none()
        elif user.role == Role.ENGINEER:
            qs = qs.filter(pk=user.branch_id)
        else:
            return Branch.objects.none()

        customer_id = self.request.query_params.get("customer")
        if customer_id:
            qs = qs.filter(customer_id=customer_id)
        return qs.order_by("name")


class SiteListView(generics.ListCreateAPIView):
    serializer_class = SiteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        qs = Site.objects.select_related(
            "branch", "branch__customer", "floor",
        ).prefetch_related("users")

        if user.role == Role.ORG_SUPER_ADMIN:
            qs = qs.filter(branch__customer__organization_id=user.organization_id)
        elif user.role == Role.CUSTOMER:
            qs = qs.filter(branch__customer_id=user.customer_id)
        elif user.role == Role.BR_ADMIN:
            hierarchy = getattr(user.customer, "hierarchy_type", None) if user.customer_id else None
            if hierarchy == "GEOGRAPHICAL" and user.state_id:
                qs = qs.filter(
                    branch__customer_id=user.customer_id,
                    branch__city__taluka__district__state_id=user.state_id,
                )
            elif hierarchy == "ZONAL" and user.zone_id:
                qs = qs.filter(
                    branch__customer_id=user.customer_id,
                    branch__division__region__circle__zone_id=user.zone_id,
                )
            elif user.branch_id:
                qs = qs.filter(branch_id=user.branch_id)
            else:
                return Site.objects.none()
        elif user.role == Role.ENGINEER:
            qs = qs.filter(pk=user.site_id)
        else:
            return Site.objects.none()

        params = self.request.query_params
        customer_id = params.get("customer")
        branch_id   = params.get("branch")
        is_active   = params.get("is_active")

        if customer_id:
            try:
                qs = qs.filter(branch__customer_id=int(customer_id))
            except (ValueError, TypeError):
                return Site.objects.none()

        if branch_id:
            qs = qs.filter(branch_id=branch_id)

        if is_active is not None:
            qs = qs.filter(is_active=str(is_active).lower() in ("1", "true", "yes"))

        return qs.order_by("name")

    def perform_create(self, serializer):
        user = self.request.user
        branch = serializer.validated_data["branch"]

        if user.role == Role.CUSTOMER and branch.customer_id != user.customer_id:
            raise DRFValidationError({"branch": "You can only create a site under your customer."})
        if user.role == Role.BR_ADMIN and branch.id != user.branch_id:
            raise DRFValidationError({"branch": "You can only create a site under your branch."})
        if user.role == Role.ENGINEER:
            raise DRFValidationError("Engineers cannot create sites.")
        if user.role == Role.ORG_SUPER_ADMIN:
            if branch.customer.organization_id != user.organization_id:
                raise DRFValidationError({"branch": "This branch is outside your organization."})

        serializer.save()
        site = serializer.instance
        try:
            customer = branch.customer
            if not getattr(customer, "tpt_customer_id", ""):
                sync_customer(customer)
            sync_site(site)
        except ThreeTPError as exc:
            Site.objects.filter(pk=site.pk).update(
                tpt_sync_status="FAILED",
                tpt_sync_error=str(exc),
            )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def site_assignment(request, pk):
    try:
        site = (
            Site.objects
            .select_related(
                "branch", "branch__customer",
                "branch__customer__organization", "floor",
            )
            .prefetch_related("users")
            .get(pk=pk)
        )
    except Site.DoesNotExist:
        return Response(
            {"status": "error", "message": "Site not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    user = request.user
    allowed = False
    if user.role == Role.ORG_SUPER_ADMIN:
        allowed = site.branch.customer.organization_id == user.organization_id
    elif user.role == Role.CUSTOMER:
        allowed = site.branch.customer_id == user.customer_id
    elif user.role == Role.BR_ADMIN:
        hierarchy = getattr(user.customer, "hierarchy_type", None) if user.customer_id else None
        if hierarchy == "GEOGRAPHICAL" and user.state_id:
            allowed = (
                site.branch.customer_id == user.customer_id
                and site.branch.city and site.branch.city.taluka
                and site.branch.city.taluka.district
                and site.branch.city.taluka.district.state_id == user.state_id
            )
        elif hierarchy == "ZONAL" and user.zone_id:
            allowed = (
                site.branch.customer_id == user.customer_id
                and site.branch.division
                and site.branch.division.region
                and site.branch.division.region.circle
                and site.branch.division.region.circle.zone_id == user.zone_id
            )
        else:
            allowed = site.branch_id == user.branch_id
    elif user.role == Role.ENGINEER:
        allowed = site.id == user.site_id

    if not allowed:
        return Response(
            {"status": "error", "message": "You do not have access to this site."},
            status=status.HTTP_403_FORBIDDEN,
        )

    data = SiteSerializer(site, context={"request": request}).data
    return Response({"status": "success", "data": data}, status=status.HTTP_200_OK)


class UserListView(generics.ListCreateAPIView):
    serializer_class = UserSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == Role.ORG_SUPER_ADMIN:
            return User.objects.filter(organization_id=user.organization_id)
        if user.role == Role.CUSTOMER:
            return User.objects.filter(customer_id=user.customer_id)
        if user.role == Role.BR_ADMIN:
            return User.objects.filter(branch_id=user.branch_id)
        return User.objects.none()


class FloorListView(generics.ListAPIView):
    serializer_class = FloorSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Floor.objects.select_related("branch", "branch__customer")

        if user.role == Role.ORG_SUPER_ADMIN:
            qs = qs.filter(branch__customer__organization_id=user.organization_id)
        elif user.role == Role.CUSTOMER:
            qs = qs.filter(branch__customer_id=user.customer_id)
        elif user.role == Role.BR_ADMIN:
            qs = qs.filter(branch_id=user.branch_id)
        elif user.role == Role.ENGINEER:
            qs = qs.filter(branch_id=user.branch_id)
        else:
            return qs.none()

        customer_id = self.request.query_params.get("customer")
        if customer_id:
            qs = qs.filter(branch__customer_id=customer_id)

        branch_id = self.request.query_params.get("branch")
        if branch_id:
            qs = qs.filter(branch_id=branch_id)

        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ("1", "true", "yes"))

        return qs.order_by("name")


# =====================================================================
# DASHBOARD SUMMARY
# =====================================================================
@api_view(["GET"])
def dashboard_summary_view(request):
    user = request.user
    data = {"role": user.role, "scope_name": user.scope_name}

    if user.role == Role.ORG_SUPER_ADMIN:
        data.update({
            "customers": Customer.objects.filter(organization_id=user.organization_id).count(),
            "zones":     Zone.objects.filter(customer__organization_id=user.organization_id).count(),
            "circles":   Circle.objects.filter(zone__customer__organization_id=user.organization_id).count(),
            "branches":  Branch.objects.filter(customer__organization_id=user.organization_id).count(),
            "sites":     Site.objects.filter(branch__customer__organization_id=user.organization_id).count(),
            "engineers": User.objects.filter(role=Role.ENGINEER, organization_id=user.organization_id).count(),
        })

    elif user.role == Role.CUSTOMER:
        data.update({
            "zones":     Zone.objects.filter(customer_id=user.customer_id).count(),
            "circles":   Circle.objects.filter(zone__customer_id=user.customer_id).count(),
            "branches":  Branch.objects.filter(customer_id=user.customer_id).count(),
            "sites":     Site.objects.filter(branch__customer_id=user.customer_id).count(),
            "engineers": User.objects.filter(role=Role.ENGINEER, customer_id=user.customer_id).count(),
        })

    elif user.role == Role.BR_ADMIN:
        data.update({
            "sites":     Site.objects.filter(branch_id=user.branch_id).count(),
            "engineers": User.objects.filter(role=Role.ENGINEER, branch_id=user.branch_id).count(),
        })

    elif user.role == Role.ENGINEER:
        data.update({"my_sites": Site.objects.filter(pk=user.site_id).count()})

    return Response(data)


# =====================================================================
# LOCATION LIST / DETAIL
# =====================================================================
@api_view(["GET"])
def LocationListView(request):
    return Response("Location Page")


@api_view(["GET", "POST", "PUT", "PATCH", "DELETE"])
def location_detail(request, location_type, location_id):
    if request.method in ("PUT", "PATCH", "DELETE") and request.user.role not in (
        Role.ORG_SUPER_ADMIN, Role.CUSTOMER,
    ):
        return JsonResponse(
            {"success": False, "message": "You are not allowed to modify locations."},
            status=403,
        )

    if request.method == "DELETE":
        try:
            if location_type == "zone":
                obj = LocationZone.objects.get(id=location_id)
            elif location_type == "state":
                obj = LocationState.objects.get(id=location_id)
            elif location_type == "circle":
                obj = LocationCircle.objects.get(id=location_id)
            else:
                return JsonResponse(
                    {"success": False, "message": "Invalid location type"}, status=400,
                )
            obj.delete()
            return JsonResponse(
                {"success": True,
                 "message": f"{location_type.title()} deleted successfully"},
                status=200,
            )
        except (LocationZone.DoesNotExist, LocationState.DoesNotExist, LocationCircle.DoesNotExist):
            return JsonResponse({"success": False, "message": "Location not found"}, status=404)

    if request.method == "PUT":
        try:
            body = json.loads(request.body.decode("utf-8"))

            if location_type == "zone":
                obj = LocationZone.objects.get(id=location_id)
                obj.zone_name = body.get("zone_name", obj.zone_name)
                obj.zone_code = body.get("zone_code", obj.zone_code)
            elif location_type == "state":
                obj = LocationState.objects.get(id=location_id)
                obj.state_name = body.get("state_name", obj.state_name)
                obj.state_code = body.get("state_code", obj.state_code)
            elif location_type == "circle":
                obj = LocationCircle.objects.get(id=location_id)
                obj.circle_name = body.get("circle_name", obj.circle_name)
                obj.circle_code = body.get("circle_code", obj.circle_code)
            else:
                return JsonResponse(
                    {"success": False, "message": "Invalid location type"}, status=400,
                )

            obj.save()
            return JsonResponse(
                {"success": True,
                 "message": f"{location_type.title()} updated successfully"},
                status=200,
            )
        except (LocationZone.DoesNotExist, LocationState.DoesNotExist, LocationCircle.DoesNotExist):
            return JsonResponse({"success": False, "message": "Location not found"}, status=404)
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "message": "Invalid JSON"}, status=400)

    return JsonResponse({"success": False, "message": "Method not allowed"}, status=405)


@api_view(["GET"])
def device(request):
    return Response("ACCreation page")


# =====================================================================
# BRANCH ASSIGNMENTS / OWNERSHIP
# =====================================================================
@api_view(["GET"])
def branch_assignments(request):
    branch_id = (request.GET.get("branch_id") or "").strip()
    hierarchy = (request.GET.get("hierarchy_type") or "").strip().upper()

    if not branch_id:
        return JsonResponse({"status": "error", "message": "branch_id is required"}, status=400)

    idx = ownership.build_branch_index()
    candidates = [
        (h, n) for (h, bid), n in idx.items()
        if bid == branch_id and (not hierarchy or h == hierarchy)
    ]
    if not candidates:
        return JsonResponse({
            "status": "success",
            "message": "Site not found in the location tree.",
            "data": {"customer": None, "admins": [], "engineers": [], "assigned": False},
        })

    h, node = candidates[0]
    if not ownership.can_see_branch(request.user, node):
        return JsonResponse(
            {"status": "error", "message": "You do not have access to this site."},
            status=403,
        )

    info = ownership.OwnerLookup.for_nodes([node]).describe(node)
    return JsonResponse({
        "status": "success",
        "data": {
            "branch": {"id": node.get("branch_id"),
                       "name": node.get("branch_name", ""),
                       "hierarchy_type": h},
            "customer": info["customer"],
            "admins": info["admins"],
            "engineers": info["engineers"],
            "assigned": bool(info["customer"]),
        },
    })


@api_view(["POST"])
def branch_ownership(request):
    body = request.data
    hierarchy = str(body.get("hierarchy_type", "")).strip().upper()
    branch_id = str(body.get("branch_id", "")).strip()
    if hierarchy not in ("GEOGRAPHICAL", "ZONAL") or not branch_id:
        return JsonResponse(
            {"status": "error", "message": "hierarchy_type and branch_id are required"}, status=400,
        )

    location_file = ownership.tree_file(hierarchy)
    tree = load_location_tree(location_file)
    node = next((n for n, _ in iter_branches(tree, hierarchy)
                 if n.get("branch_id") == branch_id), None)
    if node is None:
        return JsonResponse({"status": "error", "message": "Site not found."}, status=404)

    try:
        customer, admin_ids, engineer_ids = ownership.validate_ownership(
            request.user, hierarchy, node,
            body.get("customer_id"), body.get("admin_ids"), body.get("engineer_ids"),
        )
    except ownership.OwnershipError as exc:
        return JsonResponse({"status": "error", "message": str(exc)}, status=exc.status)

    ownership.set_node_owner(node, customer.pk, admin_ids, engineer_ids)
    save_location_tree(tree, location_file)

    info = ownership.OwnerLookup.for_nodes([node]).describe(node)
    return JsonResponse({"status": "success", "data": {"branch_id": branch_id, **info}})


@api_view(["GET"])
def unassigned_devices(request):
    if request.user.role not in (Role.ORG_SUPER_ADMIN, Role.CUSTOMER, Role.BR_ADMIN):
        return JsonResponse({"status": "success", "count": 0, "data": []})
    try:
        known = telemetry._devices()
    except Exception:
        known = []
    assigned = set(build_device_location_map().keys())
    data = [
        {"ac_id": d.get("ac_id"), "device_name": d.get("device_name") or d.get("ac_id")}
        for d in known if d.get("ac_id") and d.get("ac_id") not in assigned
    ]
    return JsonResponse({"status": "success", "count": len(data), "data": data})


@api_view(["GET"])
def treands(request):
    return Response("Treands page")


# =====================================================================
# LOCATIONS API  (create + read, with ownership stamping)
# =====================================================================
@api_view(["GET", "POST"])
def locations(request):
    user = request.user

    if request.method == "POST":
        if user.role not in (Role.ORG_SUPER_ADMIN, Role.CUSTOMER):
            return JsonResponse(
                {"success": False, "message": "You are not allowed to create locations."},
                status=403,
            )

        try:
            body = json.loads(request.body or "{}")
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "message": "Invalid JSON body"}, status=400)
        hierarchy = str(body.get("hierarchy_type", "")).strip().upper()

        if user.role == Role.CUSTOMER:
            if not user.customer_id:
                return JsonResponse({"success": False, "message": "Your account has no customer."},
                                    status=403)
            ctype = getattr(user.customer, "hierarchy_type", None)
            if ctype and hierarchy and ctype != hierarchy:
                return JsonResponse(
                    {"success": False,
                     "message": f"Your account uses the {ctype.title()} hierarchy."},
                    status=403,
                )
            if hierarchy in ("GEOGRAPHICAL", "ZONAL"):
                existing = ownership.find_branch_by_path(
                    load_location_tree(ownership.tree_file(hierarchy)), hierarchy, body)
                if existing is not None and not ownership.can_see_branch(user, existing) \
                        and existing.get("customer_id") not in (None, user.customer_id):
                    return JsonResponse(
                        {"success": False, "message": "This site belongs to another customer."},
                        status=403,
                    )

    response = _locations_impl(request)

    if request.method == "POST" and response.status_code == 201:
        try:
            _stamp_new_branch(user, body, response)
        except Exception:
            pass
    return response


def _stamp_new_branch(user, body, response):
    hierarchy = str(body.get("hierarchy_type", "")).strip().upper()
    branch_id = (json.loads(response.content).get("data") or {}).get("branch_id")
    if not branch_id:
        return

    location_file = ownership.tree_file(hierarchy)
    tree = load_location_tree(location_file)
    node = next((n for n, _ in iter_branches(tree, hierarchy)
                 if n.get("branch_id") == branch_id), None)
    if node is None:
        return

    if user.role == Role.CUSTOMER:
        if node.get("customer_id") in (None, user.customer_id):
            ownership.set_node_owner(
                node, user.customer_id,
                ownership.node_owner(node)["admin_ids"],
                ownership.node_owner(node)["engineer_ids"],
            )
    elif body.get("customer_id"):
        try:
            customer, admin_ids, engineer_ids = ownership.validate_ownership(
                user, hierarchy, node, body.get("customer_id"),
                body.get("admin_ids"), body.get("engineer_ids"))
        except ownership.OwnershipError:
            return
        ownership.set_node_owner(node, customer.pk, admin_ids, engineer_ids)
    else:
        return
    save_location_tree(tree, location_file)


# =====================================================================
# SAVED DASHBOARD PREFERENCES
# =====================================================================
@api_view(["GET", "POST"])
@permission_classes([permissions.IsAuthenticated])
def dashboard_preferences(request):
    user = request.user

    if request.method == "GET":
        queryset = DashboardPreference.objects.filter(user=user)
        return Response(
            DashboardPreferenceSerializer(queryset, many=True).data,
            status=status.HTTP_200_OK,
        )

    serializer = DashboardPreferenceSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    name = serializer.validated_data.get("name") or "My Dashboard"
    customer = user.customer if user.customer_id else None

    if serializer.validated_data.get("is_default"):
        DashboardPreference.objects.filter(user=user, is_default=True).update(is_default=False)

    dashboard = DashboardPreference.objects.create(
        user=user,
        customer=customer,
        name=name,
        main_filters=serializer.validated_data.get("main_filters", {}),
        card_filters=serializer.validated_data.get("card_filters", {}),
        visible_widgets=serializer.validated_data.get("visible_widgets", {}),
        is_default=serializer.validated_data.get("is_default", False),
    )

    return Response(
        DashboardPreferenceSerializer(dashboard).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([permissions.IsAuthenticated])
def dashboard_preference_detail(request, pk):
    try:
        dashboard = DashboardPreference.objects.get(pk=pk, user=request.user)
    except DashboardPreference.DoesNotExist:
        return Response(
            {"detail": "Dashboard not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if request.method == "GET":
        return Response(
            DashboardPreferenceSerializer(dashboard).data,
            status=status.HTTP_200_OK,
        )

    if request.method == "DELETE":
        dashboard.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = DashboardPreferenceSerializer(
        dashboard, data=request.data, partial=True
    )
    serializer.is_valid(raise_exception=True)

    if serializer.validated_data.get("is_default") is True:
        DashboardPreference.objects.filter(
            user=request.user
        ).exclude(pk=dashboard.pk).update(is_default=False)

    serializer.save(customer=request.user.customer if request.user.customer_id else None)

    return Response(
        DashboardPreferenceSerializer(dashboard).data,
        status=status.HTTP_200_OK,
    )

