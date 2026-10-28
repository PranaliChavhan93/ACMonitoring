# My current view

import json
import os
import time
import threading
import traceback
import hashlib
import uuid

from django.core import serializers
from django.db.models import Q

from django.views.decorators.csrf import csrf_exempt

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


from .access_scope import (
    accessible_branches,
    accessible_devices,
    accessible_sites,
    device_customer,
)

from .hierarchy_persistence import persist_customer_branch_floor
from .services.customer_hierarchy import initialize_customer_hierarchy

from django.core.exceptions import ValidationError as DjangoValidationError

from .models import (
    Country,
    CustomerDeviceMapping,
    CustomerSiteMapping,
    LocationCircle,
    LocationState,
    LocationZone,
    SiteDeviceMapping,
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
    ACDeviceSerializer,
    AdminSerializer,
    CitySerializer,
    CountrySerializer,
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
from .telemetry_aggregate import get_telemetry_records
# from backend.account import serializers

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

def _scalar_id(value):
    """Coerce a scalar, {'id': n}, {'pk': n} or {'uuid': '…'} into a flat value."""
    if isinstance(value, dict):
        for key in ("id", "pk", "uuid"):
            if value.get(key) is not None:
                return value[key]
        return None
    return value


def _safe_first(qs, ref):
    """Return qs.filter(pk=ref).first(), or None if ref isn't a valid pk."""
    try:
        return qs.filter(pk=ref).first()
    except (ValueError, TypeError, django.core.exceptions.ValidationError):
        return None

def _one_line(exc, n=300):
    return " ".join(str(exc).split())[:n]


def ensure_tpt_customer_id(request, customer):
    """Customer's id; if missing (legacy row) find it in 3TP by email and save it."""
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

def _resolve_location(model, value, **extra_filters):
    """
    Resolve a location node by its UUID primary key OR by its code.
    The frontend may send either, depending on which API populated the dropdown.
    """
    if value in (None, "", "null", "undefined"):
        return None

    value_str = str(value).strip()

    # 1) Try UUID lookup (fast path, no exception on non-UUID strings)
    try:
        uuid.UUID(value_str)
        is_uuid = True
    except (ValueError, TypeError, AttributeError):
        is_uuid = False

    if is_uuid:
        obj = model.objects.filter(pk=value_str, **extra_filters).first()
        if obj:
            return obj

    # 2) Fallback: lookup by code (case-insensitive)
    return model.objects.filter(code__iexact=value_str, **extra_filters).first()

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
            raise ThreeTPAPIError(f"Cloud Error: {_one_line(exc)}")

        try:           
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
                        "tpt_sync_status": "PENDING",
                        "tpt_sync_error": "",
                    },
                )

                # Site-device assignment is saved locally.
                SiteDeviceMapping.objects.update_or_create(
                    site=site_obj,
                    device=db_device,
                    defaults={"is_active": True},
                )

                # Customer-device assignment is saved locally too.
                customer = site_obj.branch.customer

                CustomerDeviceMapping.objects.update_or_create(
                    customer=customer,
                    device=db_device,
                    defaults={"is_active": True},
                )

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


def fetch_3tp_sites(request=None):
    sites = []
    page = 0
    total_pages = 1

    while page < total_pages:
        response, data = _tpt_request(
            "GET",
            "site",
            params={
                "pageSize": 1000,
                "page": page,
                "sortProperty": "createdTime",
                "sortOrder": "DESC",
            },
        )

        if not isinstance(data, dict):
            raise ThreeTPError(
                "Invalid sites response from 3TP.",
                payload=data,
            )

        rows = data.get(
            "data",
            []
        )

        if isinstance(rows, list):
            sites.extend(rows)

        total_pages = data.get(
            "totalPages",
            1
        )

        page += 1

    return sites

# CREATE BRANCH / FLOOR FROM FULL HIERARCHY
@api_view(["POST"])
def create_branch_or_floor(request):
    user = request.user

    # PERMISSION
    if user.role not in (Role.ORG_SUPER_ADMIN, Role.CUSTOMER):
        return JsonResponse(
            {
                "success": False,
                "message": "You are not allowed to create locations."
            },
            status=403,
        )

    try:
        body = request.data
    except Exception:
        body = {}

    hierarchy = str(
        body.get("hierarchy_type", "")
    ).strip().upper()

    location_type = str(
        body.get("location_type", "")
    ).strip().upper()

    if hierarchy not in ("GEOGRAPHICAL", "ZONAL"):
        return JsonResponse(
            {
                "success": False,
                "message": "hierarchy_type must be GEOGRAPHICAL or ZONAL."
            },
            status=400,
        )

    if location_type not in ("BRANCH", "FLOOR"):
        return JsonResponse(
            {
                "success": False,
                "message": "location_type must be BRANCH or FLOOR."
            },
            status=400,
        )

    if user.role == Role.CUSTOMER:
        customer = Customer.objects.filter(
            pk=user.customer_id,
            is_active=True,
        ).first()
    else:
        customer_id = body.get("customer_id")

        customer = Customer.objects.filter(
            pk=customer_id,
            organization_id=user.organization_id,
            is_active=True,
        ).first()

    if not customer:
        return JsonResponse(
            {
                "success": False,
                "message": "Select a valid customer in your permitted scope.",
            },
            status=400,
        )

    try:
        branch, floor, path = persist_customer_branch_floor(
            customer=customer,
            body=body,
            hierarchy=hierarchy,
            location_type=location_type,
        )
    except DjangoValidationError as exc:
        return JsonResponse(
            {
                "success": False,
                "message": "; ".join(exc.messages),
            },
            status=400,
        )

    # CUSTOMER HIERARCHY VALIDATION
    if user.role == Role.CUSTOMER:

        if not user.customer_id:
            return JsonResponse(
                {
                    "success": False,
                    "message": "Your account has no customer."
                },
                status=403,
            )

        customer_hierarchy = getattr(
            user.customer,
            "hierarchy_type",
            None
        )

        if (
            customer_hierarchy
            and customer_hierarchy != hierarchy
        ):
            return JsonResponse(
                {
                    "success": False,
                    "message": (
                        f"Your account uses the "
                        f"{customer_hierarchy.title()} hierarchy."
                    ),
                },
                status=403,
            )
        return JsonResponse(
        {
            "success": True,
            "message": (
                "Branch created successfully."
                if location_type == "BRANCH"
                else "Floor created successfully."
            ),
            "hierarchy_type": hierarchy,
            "location_type": location_type,
            "data": {
                "customer_id": str(customer.pk),
                "customer_name": customer.company,
                **path,
            },
        },
        status=201,
    )

    # LOAD TREE

    location_file = (
        ZONAL_LOCATION_FILE
        if hierarchy == "ZONAL"
        else GEOGRAPHICAL_LOCATION_FILE
    )

    try:
        tree = load_location_tree(location_file)
    except Exception as exc:
        return JsonResponse(
            {
                "success": False,
                "message": f"Unable to load location tree: {exc}"
            },
            status=500,
        )

    # ===============================================================
    # ZONAL
    # ===============================================================

    if hierarchy == "ZONAL":

        zone_name = str(
            body.get("zone_name", "")
        ).strip()

        circle_name = str(
            body.get("circle_name", "")
        ).strip()

        region_name = str(
            body.get("region_name", "")
        ).strip()

        division_name = str(
            body.get("division_name", "")
        ).strip()

        branch_name = str(
            body.get("branch_name", "")
        ).strip()

        floor_name = str(
            body.get("floor_name", "")
        ).strip()

        # -----------------------------------------------------------
        # VALIDATE PARENT HIERARCHY
        # -----------------------------------------------------------

        required = {
            "zone_name": zone_name,
            "circle_name": circle_name,
            "region_name": region_name,
            "division_name": division_name,
        }

        missing = [
            key
            for key, value in required.items()
            if not value
        ]

        if location_type in ("BRANCH", "FLOOR"):

            if not branch_name:
                missing.append("branch_name")

        if location_type == "FLOOR" and not floor_name:
            missing.append("floor_name")

        if missing:
            return JsonResponse(
                {
                    "success": False,
                    "message": (
                        "Missing required field(s): "
                        + ", ".join(missing)
                    ),
                },
                status=400,
            )

        # -----------------------------------------------------------
        # ZONE
        # -----------------------------------------------------------

        zone = next(
            (
                z for z in tree
                if z.get("zone_name", "").strip().lower()
                == zone_name.lower()
            ),
            None,
        )

        if zone is None:

            zone_ids = {
                z.get("zone_id", "")
                for z in tree
            }

            zone = {
                "zone_id": make_code_id(
                    zone_ids,
                    zone_name,
                    prefix="ZN-",
                ),
                "zone_name": zone_name,
                "circles": [],
            }

            tree.append(zone)

        # -----------------------------------------------------------
        # CIRCLE
        # -----------------------------------------------------------

        circle = next(
            (
                c
                for c in zone.get("circles", [])
                if c.get("circle_name", "").strip().lower()
                == circle_name.lower()
            ),
            None,
        )

        if circle is None:

            circle_ids = {
                c.get("circle_id", "")
                for z in tree
                for c in z.get("circles", [])
            }

            circle = {
                "circle_id": make_code_id(
                    circle_ids,
                    circle_name,
                    prefix=f"{zone['zone_id']}-C",
                ),
                "circle_name": circle_name,
                "regions": [],
            }

            zone.setdefault(
                "circles",
                []
            ).append(circle)

        # -----------------------------------------------------------
        # REGION
        # -----------------------------------------------------------

        region = next(
            (
                r
                for r in circle.get("regions", [])
                if r.get("region_name", "").strip().lower()
                == region_name.lower()
            ),
            None,
        )

        if region is None:

            region_ids = {
                r.get("region_id", "")
                for z in tree
                for c in z.get("circles", [])
                for r in c.get("regions", [])
            }

            region = {
                "region_id": make_code_id(
                    region_ids,
                    region_name,
                    prefix=f"{circle['circle_id']}-R",
                ),
                "region_name": region_name,
                "divisions": [],
            }

            circle.setdefault(
                "regions",
                []
            ).append(region)

        # -----------------------------------------------------------
        # DIVISION
        # -----------------------------------------------------------

        division = next(
            (
                d
                for d in region.get("divisions", [])
                if d.get("division_name", "").strip().lower()
                == division_name.lower()
            ),
            None,
        )

        if division is None:

            division_ids = {
                d.get("division_id", "")
                for z in tree
                for c in z.get("circles", [])
                for r in c.get("regions", [])
                for d in r.get("divisions", [])
            }

            division = {
                "division_id": make_code_id(
                    division_ids,
                    division_name,
                    prefix=f"{region['region_id']}-D",
                ),
                "division_name": division_name,
                "branches": [],
            }

            region.setdefault(
                "divisions",
                []
            ).append(division)

        # -----------------------------------------------------------
        # BRANCH
        # -----------------------------------------------------------

        branch = next(
            (
                b
                for b in division.get("branches", [])
                if b.get("branch_name", "").strip().lower()
                == branch_name.lower()
            ),
            None,
        )

        if location_type == "BRANCH":

            if branch is not None:
                return JsonResponse(
                    {
                        "success": False,
                        "message": (
                            f"Branch '{branch_name}' "
                            "already exists in this hierarchy."
                        ),
                    },
                    status=409,
                )

            branch_index = len(
                division.get("branches", [])
            ) + 1

            branch = {
                "branch_id": (
                    f"{division['division_id']}"
                    f"-B{branch_index:02d}"
                ),
                "branch_name": branch_name,
                "floors": [],
                "sites": [],
            }

            division.setdefault(
                "branches",
                []
            ).append(branch)

            save_location_tree(
                tree,
                location_file
            )

            return JsonResponse(
                {
                    "success": True,
                    "message": "Branch created successfully.",
                    "hierarchy_type": hierarchy,
                    "location_type": "BRANCH",
                    "data": {
                        "zone_id": zone["zone_id"],
                        "zone_name": zone["zone_name"],
                        "circle_id": circle["circle_id"],
                        "circle_name": circle["circle_name"],
                        "region_id": region["region_id"],
                        "region_name": region["region_name"],
                        "division_id": division["division_id"],
                        "division_name": division["division_name"],
                        "branch_id": branch["branch_id"],
                        "branch_name": branch["branch_name"],
                    },
                },
                status=201,
            )

        # -----------------------------------------------------------
        # FLOOR
        # -----------------------------------------------------------

        if branch is None:
            return JsonResponse(
                {
                    "success": False,
                    "message": (
                        f"Branch '{branch_name}' "
                        "does not exist."
                    ),
                },
                status=404,
            )

        existing_floor = next(
            (
                f
                for f in branch.get("floors", [])
                if f.get("floor_name", "").strip().lower()
                == floor_name.lower()
            ),
            None,
        )

        if existing_floor is not None:
            return JsonResponse(
                {
                    "success": False,
                    "message": (
                        f"Floor '{floor_name}' "
                        "already exists in this branch."
                    ),
                },
                status=409,
            )

        floor_index = len(
            branch.get("floors", [])
        ) + 1

        floor = {
            "floor_id": (
                f"{branch['branch_id']}"
                f"-F{floor_index:02d}"
            ),
            "floor_name": floor_name,
            "sites": [],
        }

        branch.setdefault(
            "floors",
            []
        ).append(floor)

        save_location_tree(
            tree,
            location_file
        )

        return JsonResponse(
            {
                "success": True,
                "message": "Floor created successfully.",
                "hierarchy_type": hierarchy,
                "location_type": "FLOOR",
                "data": {
                    "zone_id": zone["zone_id"],
                    "zone_name": zone["zone_name"],
                    "circle_id": circle["circle_id"],
                    "circle_name": circle["circle_name"],
                    "region_id": region["region_id"],
                    "region_name": region["region_name"],
                    "division_id": division["division_id"],
                    "division_name": division["division_name"],
                    "branch_id": branch["branch_id"],
                    "branch_name": branch["branch_name"],
                    "floor_id": floor["floor_id"],
                    "floor_name": floor["floor_name"],
                },
            },
            status=201,
        )

    # ===============================================================
    # GEOGRAPHICAL
    # ===============================================================

    state_name = str(
        body.get("state_name", "")
    ).strip()

    district_name = str(
        body.get("district_name", "")
    ).strip()

    taluka_name = str(
        body.get("taluka_name", "")
    ).strip()

    city_name = str(
        body.get("city_name", "")
    ).strip()

    branch_name = str(
        body.get("branch_name", "")
    ).strip()

    floor_name = str(
        body.get("floor_name", "")
    ).strip()

    required = {
        "state_name": state_name,
        "district_name": district_name,
        "taluka_name": taluka_name,
        "city_name": city_name,
        "branch_name": branch_name,
    }

    missing = [
        key
        for key, value in required.items()
        if not value
    ]

    if location_type == "FLOOR" and not floor_name:
        missing.append("floor_name")

    if missing:
        return JsonResponse(
            {
                "success": False,
                "message": (
                    "Missing required field(s): "
                    + ", ".join(missing)
                ),
            },
            status=400,
        )

    # ---------------------------------------------------------------
    # STATE
    # ---------------------------------------------------------------

    state = next(
        (
            s
            for s in tree
            if s.get("state_name", "").strip().lower()
            == state_name.lower()
        ),
        None,
    )

    if state is None:

        state_ids = {
            s.get("state_id", "")
            for s in tree
        }

        state = {
            "state_id": make_code_id(
                state_ids,
                state_name,
            ),
            "state_name": state_name,
            "districts": [],
        }

        tree.append(state)

    # ---------------------------------------------------------------
    # DISTRICT
    # ---------------------------------------------------------------

    district = next(
        (
            d
            for d in state.get("districts", [])
            if d.get("district_name", "").strip().lower()
            == district_name.lower()
        ),
        None,
    )

    if district is None:

        district_index = len(
            state.get("districts", [])
        ) + 1

        district = {
            "district_id": (
                f"{state['state_id']}"
                f"-D{district_index:02d}"
            ),
            "district_name": district_name,
            "talukas": [],
        }

        state.setdefault(
            "districts",
            []
        ).append(district)

    # ---------------------------------------------------------------
    # TALUKA
    # ---------------------------------------------------------------

    taluka = next(
        (
            t
            for t in district.get("talukas", [])
            if t.get("taluka_name", "").strip().lower()
            == taluka_name.lower()
        ),
        None,
    )

    if taluka is None:

        taluka_index = len(
            district.get("talukas", [])
        ) + 1

        taluka = {
            "taluka_id": (
                f"{district['district_id']}"
                f"-T{taluka_index:02d}"
            ),
            "taluka_name": taluka_name,
            "cities": [],
        }

        district.setdefault(
            "talukas",
            []
        ).append(taluka)

    # ---------------------------------------------------------------
    # CITY
    # ---------------------------------------------------------------

    city = next(
        (
            c
            for c in taluka.get("cities", [])
            if c.get("city_name", "").strip().lower()
            == city_name.lower()
        ),
        None,
    )

    if city is None:

        city_index = len(
            taluka.get("cities", [])
        ) + 1

        city = {
            "city_id": (
                f"{taluka['taluka_id']}"
                f"-C{city_index:02d}"
            ),
            "city_name": city_name,
            "branches": [],
        }

        taluka.setdefault(
            "cities",
            []
        ).append(city)

    # ---------------------------------------------------------------
    # BRANCH
    # ---------------------------------------------------------------

    branch = next(
        (
            b
            for b in city.get("branches", [])
            if b.get("branch_name", "").strip().lower()
            == branch_name.lower()
        ),
        None,
    )

    if location_type == "BRANCH":

        if branch is not None:
            return JsonResponse(
                {
                    "success": False,
                    "message": (
                        f"Branch '{branch_name}' "
                        "already exists in this hierarchy."
                    ),
                },
                status=409,
            )

        branch_index = len(
            city.get("branches", [])
        ) + 1

        branch = {
            "branch_id": (
                f"{city['city_id']}"
                f"-B{branch_index:02d}"
            ),
            "branch_name": branch_name,
            "floors": [],
            "sites": [],
        }

        city.setdefault(
            "branches",
            []
        ).append(branch)

        save_location_tree(
            tree,
            location_file
        )

        return JsonResponse(
            {
                "success": True,
                "message": "Branch created successfully.",
                "hierarchy_type": hierarchy,
                "location_type": "BRANCH",
                "data": {
                    "state_id": state["state_id"],
                    "state_name": state["state_name"],
                    "district_id": district["district_id"],
                    "district_name": district["district_name"],
                    "taluka_id": taluka["taluka_id"],
                    "taluka_name": taluka["taluka_name"],
                    "city_id": city["city_id"],
                    "city_name": city["city_name"],
                    "branch_id": branch["branch_id"],
                    "branch_name": branch["branch_name"],
                },
            },
            status=201,
        )

    # ---------------------------------------------------------------
    # FLOOR
    # ---------------------------------------------------------------

    if branch is None:
        return JsonResponse(
            {
                "success": False,
                "message": (
                    f"Branch '{branch_name}' "
                    "does not exist."
                ),
            },
            status=404,
        )

    existing_floor = next(
        (
            f
            for f in branch.get("floors", [])
            if f.get("floor_name", "").strip().lower()
            == floor_name.lower()
        ),
        None,
    )

    if existing_floor is not None:
        return JsonResponse(
            {
                "success": False,
                "message": (
                    f"Floor '{floor_name}' "
                    "already exists in this branch."
                ),
            },
            status=409,
        )

    floor_index = len(
        branch.get("floors", [])
    ) + 1

    floor = {
        "floor_id": (
            f"{branch['branch_id']}"
            f"-F{floor_index:02d}"
        ),
        "floor_name": floor_name,
        "sites": [],
    }

    branch.setdefault(
        "floors",
        []
    ).append(floor)

    save_location_tree(
        tree,
        location_file
    )

    return JsonResponse(
        {
            "success": True,
            "message": "Floor created successfully.",
            "hierarchy_type": hierarchy,
            "location_type": "FLOOR",
            "data": {
                "state_id": state["state_id"],
                "state_name": state["state_name"],
                "district_id": district["district_id"],
                "district_name": district["district_name"],
                "taluka_id": taluka["taluka_id"],
                "taluka_name": taluka["taluka_name"],
                "city_id": city["city_id"],
                "city_name": city["city_name"],
                "branch_id": branch["branch_id"],
                "branch_name": branch["branch_name"],
                "floor_id": floor["floor_id"],
                "floor_name": floor["floor_name"],
            },
        },
        status=201,
    )

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def three_tp_sites(request):
    """
    Fetch Sites directly from 3TP.

    Local Django Site table is NOT used.
    """

    try:
        page_size = int(
            request.query_params.get(
                "pageSize",
                1000
            )
        )

        page = int(
            request.query_params.get(
                "page",
                0
            )
        )

        response = requests.get(
            f"{CLOUD_URL}/api/tenant/assets",
            params={
                "pageSize": page_size,
                "page": page,
                "sortProperty": "createdTime",
                "sortOrder": "DESC",
            },
            headers=_tpt_user_headers(request),
            timeout=20,
        )

        if response.status_code != 200:
            return Response(
                {
                    "status": "error",
                    "message": "Unable to fetch Sites from 3TP.",
                    "details": response.text,
                },
                status=response.status_code,
            )

        data = response.json()

        assets = data.get(
            "data",
            []
        )

        sites = []

        for asset in assets:

            asset_id = (
                asset.get("id", {}).get("id")
                if isinstance(
                    asset.get("id"),
                    dict
                )
                else asset.get("id")
            )

            asset_name = (
                asset.get("name")
                or asset.get("title")
                or ""
            )

            asset_type = (
                asset.get("assetType")
                or asset.get("type")
                or ""
            )

            # -------------------------------------------------
            # ONLY SITE ASSETS
            # -------------------------------------------------

            if str(asset_type).upper() not in {
                "SITE",
                "SITE_ASSET",
                "DEFAULT",
            }:
                continue

            sites.append(
                {
                    "id": asset_id,

                    "tpt_site_id": asset_id,

                    "name": asset_name,

                    "code": (
                        asset.get("code")
                        or asset.get("label")
                        or ""
                    ),

                    "asset_type": asset_type,

                    "address": (
                        asset.get("address")
                        or ""
                    ),

                    "created_time": (
                        asset.get("createdTime")
                    ),

                    "updated_time": (
                        asset.get("updatedTime")
                    ),

                    # These may be populated later
                    # from 3TP attributes.
                    "state_name": "",
                    "district_name": "",
                    "taluka_name": "",
                    "city_name": "",

                    "zone_name": "",
                    "circle_name": "",
                    "region_name": "",
                    "division_name": "",

                    "branch_name": "",
                    "floor_name": "",

                    "acs": [],
                }
            )

        return Response(
            {
                "status": "success",

                "count": len(sites),

                "total_pages": data.get(
                    "totalPages",
                    1
                ),

                "total_elements": data.get(
                    "totalElements",
                    len(sites)
                ),

                "sites": sites,
            },
            status=status.HTTP_200_OK,
        )

    except requests.RequestException as exc:

        return Response(
            {
                "status": "error",
                "message": "3TP server connection failed.",
                "details": str(exc),
            },
            status=status.HTTP_502_BAD_GATEWAY,
        )

    except Exception as exc:

        return Response(
            {
                "status": "error",
                "message": "Unable to fetch Sites from 3TP.",
                "details": str(exc),
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

def map_3tp_customer_to_device(request, tpt_customer_id, tpt_device_id):
    r = requests.post(
        f"{CLOUD_URL}/api/customer/{tpt_customer_id}/device/{tpt_device_id}",
        headers=_tpt_user_headers(request),
        timeout=15,
    )

    if r.status_code not in (200, 201, 204):
        raise ThreeTPError(
            f"Mapping customer to device failed: {r.text}",
            status=r.status_code,
            payload=r.text,
        )

    return True

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


def _tpt_service_headers():
    """Authenticate 3TP API calls with the configured 3TP service account."""
    token = _tpt_service_login()

    return {
        "Authorization": f"Bearer {token}",
        "X-Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


# def _tpt_request(method, endpoint_key, payload=None,
#                  extra_headers=None, raise_on_error=True):
#     if not _tpt_enabled():
#         return None, None

#     base_url = _tpt_base_url()
#     if not base_url:
#         if raise_on_error:
#             raise ThreeTPError("TPT_BASE_URL is not configured.")
#         return None, None

#     token = _tpt_service_login()
#     url   = f"{base_url}{TPT_ENDPOINTS.get(endpoint_key, endpoint_key)}"

#     headers = {
#         "Content-Type":  "application/json",
#         "Accept":        "application/json",
#         "Authorization": f"Bearer {token}",
#     }
#     if extra_headers:
#         headers.update(extra_headers)

#     try:
#         response = requests.request(
#             method.upper(), url,
#             json=payload, headers=headers, timeout=_tpt_timeout(),
#         )
#     except requests.RequestException as exc:
#         if raise_on_error:
#             raise ThreeTPError(f"3TP network error ({endpoint_key}): {exc}")
#         return None, None

#     try:
#         data = response.json()
#     except ValueError:
#         data = None

#     if raise_on_error and response.status_code not in (200, 201, 202, 204):
#         detail = ""
#         if isinstance(data, dict):
#             detail = data.get("message") or data.get("detail") or ""
#         raise ThreeTPError(
#             f"3TP {endpoint_key} failed ({response.status_code}) {detail}".strip(),
#             status=response.status_code,
#             payload=data,
#         )

#     return response.status_code, data


def _tpt_request(
    method,
    endpoint_key,
    payload=None,
    params=None,
    extra_headers=None,
    raise_on_error=True,
):
    if not _tpt_enabled():
        return None, None

    base_url = _tpt_base_url()

    if not base_url:
        if raise_on_error:
            raise ThreeTPError(
                "TPT_BASE_URL is not configured."
            )

        return None, None

    token = _tpt_service_login()

    url = (
        f"{base_url}"
        f"{TPT_ENDPOINTS.get(endpoint_key, endpoint_key)}"
    )

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": f"Bearer {token}",
    }

    if extra_headers:
        headers.update(extra_headers)

    try:

        response = requests.request(
            method.upper(),
            url,
            json=payload,
            params=params,
            headers=headers,
            timeout=_tpt_timeout(),
        )

    except requests.RequestException as exc:

        if raise_on_error:
            raise ThreeTPError(
                f"3TP network error ({endpoint_key}): {exc}"
            )

        return None, None

    try:
        data = response.json()
    except ValueError:
        data = None

    if raise_on_error and response.status_code not in (
        200,
        201,
        202,
        204,
    ):

        detail = ""

        if isinstance(data, dict):
            detail = (
                data.get("message")
                or data.get("detail")
                or ""
            )

        raise ThreeTPError(
            (
                f"3TP {endpoint_key} failed "
                f"({response.status_code}) "
                f"{detail}"
            ).strip(),

            status=response.status_code,
            payload=data,
        )

    return response, data

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


def _has_field(model, name):
    return any(f.name == name for f in model._meta.get_fields())


def get_3tp_device_profile_id(request):
    res = requests.get(f"{CLOUD_URL}/api/deviceProfiles",
                       params={"pageSize": 10, "page": 0},
                       headers=_tpt_user_headers(request), timeout=15)
    if res.status_code != 200:
        raise ThreeTPError("Failed to fetch device profiles.", status=res.status_code,
                           payload=res.text)
    profiles = res.json().get("data", [])
    if not profiles:
        raise ThreeTPError("No device profile found in 3TP.")
    default = next((p for p in profiles if p.get("default")), profiles[0])
    return default["id"]["id"]


def find_3tp_device_by_name(request, name):
    res = requests.get(f"{CLOUD_URL}/api/tenant/devices", params={"deviceName": name},
                       headers=_tpt_user_headers(request), timeout=15)
    return res.json() if res.status_code == 200 else None


def delete_3tp_device(request, tpt_device_id):
    try:
        r = requests.delete(f"{CLOUD_URL}/api/device/{tpt_device_id}",
                            headers=_tpt_user_headers(request), timeout=15)
        return r.status_code in (200, 204, 404)
    except requests.RequestException:
        return False


def create_3tp_device(request, *, name, label, tpt_customer_id,
                      client_id, username, password, latitude=None, longitude=None):
    """Create device (MQTT_BASIC) -> assign to customer -> save attributes.
    Returns (tpt_device_id, created_new)."""
    headers = _tpt_user_headers(request)
    created_new = True

    res = requests.post(
        f"{CLOUD_URL}/api/device-with-credentials", headers=headers, timeout=15,
        json={
            "device": {
                "name": name, "label": label or name,
                "deviceProfileId": {"id": get_3tp_device_profile_id(request),
                                    "entityType": "DEVICE_PROFILE"},
            },
            "credentials": {
                "credentialsType": "MQTT_BASIC",
                "credentialsValue": json.dumps({"clientId": client_id,
                                                "userName": username,
                                                "password": password}),
            },
        },
    )

    if res.status_code == 400 and "already exists" in res.text:
        # orphan from an earlier failed attempt: reuse it if it has no local record
        existing = find_3tp_device_by_name(request, name)
        existing_id = _id_of(existing) if existing else ""
        if (not existing_id
                or (_has_field(ACDevice, "tpt_device_id")
                    and ACDevice.objects.filter(tpt_device_id=existing_id).exists())):
            raise ThreeTPError(f"A device named '{name}' already exists in 3TP.")
        tpt_device_id, created_new = existing_id, False
    elif res.status_code not in (200, 201):
        raise ThreeTPError(f"3TP device creation failed: {res.text}", status=res.status_code)
    else:
        tpt_device_id = _id_of(res.json())

    if not tpt_device_id:
        raise ThreeTPError("3TP did not return a device id.")

    try:
        r = requests.post(f"{CLOUD_URL}/api/customer/{tpt_customer_id}/device/{tpt_device_id}",
                          headers=headers, timeout=15)
        if r.status_code not in (200, 201):
            raise ThreeTPError(f"Assigning device to customer failed: {r.text}",
                               status=r.status_code)

        attrs = {k: v for k, v in {"latitude": latitude, "longitude": longitude}.items()
                 if v not in (None, "")}
        if attrs:
            requests.post(
                f"{CLOUD_URL}/api/plugins/telemetry/DEVICE/{tpt_device_id}/SERVER_SCOPE",
                json=attrs, headers=headers, timeout=15)
    except Exception:
        if created_new:
            delete_3tp_device(request, tpt_device_id)
        raise

    return tpt_device_id, created_new


def link_3tp_device_to_site(request, tpt_asset_id, tpt_device_id):
    """ASSET --Contains--> DEVICE, same as the old assign_device_to_site."""
    r = requests.post(
        f"{CLOUD_URL}/api/relation", headers=_tpt_user_headers(request), timeout=15,
        json={"from": {"entityType": "ASSET", "id": tpt_asset_id},
              "to": {"entityType": "DEVICE", "id": tpt_device_id},
              "type": "Contains", "typeGroup": "COMMON"},
    )
    if r.status_code not in (200, 201):
        raise ThreeTPError(f"Linking device to site failed: {r.text}", status=r.status_code)


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
        states = tree
        if isinstance(tree, list):
            country = next((n for n in tree if isinstance(n, dict) and isinstance(n.get("states"), list)), None)
            if country:
                states = country["states"]
        for state in states:
            for district in state.get("districts", []):
                for taluka in district.get("talukas", []):
                    # New form: branch is a direct child of Taluka.
                    for branch in taluka.get("branches", []):
                        context = {
                            "hierarchy_type": "GEOGRAPHICAL",
                            "state_id": state.get("state_id", ""),
                            "state_name": state.get("state_name", ""),
                            "district_id": district.get("district_id", ""),
                            "district_name": district.get("district_name", ""),
                            "taluka_id": taluka.get("taluka_id", ""),
                            "taluka_name": taluka.get("taluka_name", ""),
                            "city_id": "", "city_name": "",
                            "branch_id": branch.get("branch_id", ""),
                            "branch_name": branch.get("branch_name", ""),
                        }
                        yield branch, context
                    # Backward compatibility: old branches under City remain supported.
                    for city in taluka.get("cities", []):
                        for branch in city.get("branches", []):
                            context = {
                                "hierarchy_type": "GEOGRAPHICAL",
                                "state_id": state.get("state_id", ""),
                                "state_name": state.get("state_name", ""),
                                "district_id": district.get("district_id", ""),
                                "district_name": district.get("district_name", ""),
                                "taluka_id": taluka.get("taluka_id", ""),
                                "taluka_name": taluka.get("taluka_name", ""),
                                "city_id": city.get("city_id", ""),
                                "city_name": city.get("city_name", ""),
                                "branch_id": branch.get("branch_id", ""),
                                "branch_name": branch.get("branch_name", ""),
                            }
                            yield branch, context

    elif hierarchy_type == "ZONAL":
        zones = tree
        if isinstance(tree, list):
            country = next((n for n in tree if isinstance(n, dict) and isinstance(n.get("zones"), list)), None)
            if country:
                zones = country["zones"]
        for zone in zones:
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
    """
    Remove an AC/device placement by any known identifier.

    Older tree entries used `site_id` for the AC ID, while newer entries may
    carry the local site ID, 3TP device UUID, `device_id`, `ac_id`, or `id`.
    Match all aliases so legacy placements do not survive reassignment.
    """
    removed = False
    target_ids = {str(value).strip() for value in (site_id if isinstance(site_id, (list, tuple, set)) else [site_id])
                  if value not in (None, "")}
    keys = ("site_id", "ac_id", "tpt_device_id", "device_id", "id", "uuid")

    for hierarchy_type in ("GEOGRAPHICAL", "ZONAL"):
        for branch, _ in iter_branches(tree, hierarchy_type):
            for holder in [branch, *branch.get("floors", [])]:
                for collection_key in ("sites", "devices"):
                    rows = holder.get(collection_key, [])
                    if not isinstance(rows, list):
                        continue
                    kept = []
                    for row in rows:
                        if not isinstance(row, dict):
                            kept.append(row)
                            continue
                        row_ids = {str(row.get(key)).strip() for key in keys
                                   if row.get(key) not in (None, "")}
                        if row_ids.intersection(target_ids):
                            removed = True
                        else:
                            kept.append(row)
                    holder[collection_key] = kept
    return removed


def remove_device_from_location_trees(ac_id, tpt_device_id="", site_id=""):
    """Clean stale placements from BOTH hierarchy JSON files before moving an AC."""
    identifiers = [ac_id, tpt_device_id, site_id]
    for location_file in (GEOGRAPHICAL_LOCATION_FILE, ZONAL_LOCATION_FILE):
        if not os.path.exists(location_file):
            continue
        tree = load_location_tree(location_file)
        if remove_site_from_tree(tree, identifiers):
            save_location_tree(tree, location_file)


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
    visible = [r for r in records if user_can_see_ac(user, r.get("ac_id", ""), device_map, idx)]
    if user.role == Role.BR_ADMIN:
        # Allocated devices belong only to the selected admin; unallocated devices
        # continue to follow the existing branch/state/zone hierarchy rules.
        allocated = set(ACDevice.objects.filter(assigned_admin__isnull=False).exclude(assigned_admin=user).values_list("ac_id", flat=True))
        visible = [r for r in visible if str(r.get("ac_id", "")) not in allocated]
    return visible


@api_view(["GET", "POST"])
def devices(request):
    try:
        if request.method == "GET":
            return get_3tp_devices(request)
        return _devices_impl(request)
    except ThreeTPError as exc:
        return JsonResponse(
            {
                "status": "error",
                "message": str(exc),
                "details": getattr(
                    exc,
                    "payload",
                    None
                ),
            },
            status=getattr(
                exc,
                "status",
                None
            ) or 502,
        )
    except Exception as exc:
        return JsonResponse(
            {
                "status": "error",
                "message": (
                    f"{type(exc).__name__}: {exc}"
                ),
                "traceback":
                    traceback.format_exc().splitlines(),
            },
            status=500,
        )

def fetch_3tp_devices(request):
    devices = []
    page = 0
    total_pages = 1

    while page < total_pages:

        response = requests.get(
            f"{CLOUD_URL}/api/tenant/devices",
            params={
                "pageSize": 1000,
                "page": page,
                "sortProperty": "createdTime",
                "sortOrder": "DESC",
            },
            headers=_tpt_user_headers(request),
            timeout=15,
        )

        if response.status_code != 200:
            raise ThreeTPError(
                "Failed to fetch devices from 3TP.",
                status=response.status_code,
                payload=response.text,
            )

        data = response.json()

        devices.extend(
            data.get("data", [])
        )

        total_pages = data.get(
            "totalPages",
            1
        )

        page += 1

    return devices

    
def get_3tp_devices(request):
    cloud_devices = fetch_3tp_devices(request)
    result = []
    for item in cloud_devices:
        device_id = _id_of(item)
        if not device_id:
            continue
        name = (
            item.get("name")
            or item.get("label")
            or ""
        )
        label = item.get("label") or ""
        device_profile = item.get("deviceProfileId") or {}

        local_device = (
            ACDevice.objects
            .select_related(
                "site",
                "site__branch",
                "site__branch__customer",
                "site__floor",
            )
            .filter(tpt_device_id=device_id)
            .first()
        )

        row = {
            "id": device_id,
            "tpt_device_id": device_id,

            "ac_id": name,
            "device_name": name,
            "label": label,

            "device_profile_id": (
                device_profile.get("id")
                if isinstance(device_profile, dict)
                    else ""
                ),

            "site_id": "",
            "site_name": "",
            "site_code": "",

            "branch_id": "",
            "branch_name": "",

            "customer_id": "",
            "customer_name": "",

            "floor_id": "",
            "floor_name": "",

            "status": "UNASSIGNED",
        }

        if local_device and local_device.site_id:
            site = local_device.site
            branch = site.branch

            row["site_id"] = str(site.id)
            row["site_name"] = site.name
            row["site_code"] = getattr(site, "code", "") or ""

            if branch:
                row["branch_id"] = str(branch.id)
                row["branch_name"] = branch.name

                if branch.customer_id:
                    customer = branch.customer

                    row["customer_id"] = str(branch.customer_id)
                    row["customer_name"] = (
                        customer.company
                        if customer
                        else ""
                    )

            if site.floor_id:
                row["floor_id"] = str(site.floor_id)
                row["floor_name"] = (
                    site.floor.name
                    if site.floor
                    else ""
                )

            row["status"] = "ASSIGNED"

        result.append(row)

    return JsonResponse(
        {
            "status": "success",
            "count": len(result),
            "data": result,
        },
        status=200,
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

    def fetch_3tp_devices(request):
        """
        Fetch devices directly from 3TP.

        IMPORTANT:
        This does NOT read:
            data/ac_data.json
            DeviceLocationMap.json
            telemetry cache

        3TP is the source of truth for device inventory.
        """

        devices = []
        page = 0
        total_pages = 1

        while page < total_pages:
            response = requests.get(
                f"{CLOUD_URL}/api/tenant/devices",
                params={
                    "pageSize": 1000,
                    "page": page,
                    "sortProperty": "createdTime",
                    "sortOrder": "DESC",
                },
                headers=_tpt_user_headers(request),
                timeout=15,
            )

            if response.status_code != 200:
                raise ThreeTPError(
                    "Failed to fetch devices from 3TP.",
                    status=response.status_code,
                    payload=response.text,
                )

            data = response.json()

            devices.extend(data.get("data", []))

            total_pages = data.get("totalPages", 1)
            page += 1

        return devices


# LOCATIONS  (tree)

def _scoped_tree(location_file, user):
    """
    Load the shared hierarchy.

    Organization Super Admins can view the complete hierarchy
    when creating or assigning locations.

    Other users retain their existing ownership-based restrictions.
    """
    tree = load_location_tree(location_file)

    if getattr(user, "role", None) == Role.ORG_SUPER_ADMIN:
        return ownership.attach_owner_details(tree)

    tree = ownership.filter_tree_for_user(tree, user)
    return ownership.attach_owner_details(tree)


from django.db.models import Field

def find_invalid_fields(value, path="data"):
    problems = []

    if isinstance(value, dict):
        for key, item in value.items():
            problems.extend(
                find_invalid_fields(item, f"{path}.{key}")
            )

    elif isinstance(value, (list, tuple)):
        for index, item in enumerate(value):
            problems.extend(
                find_invalid_fields(item, f"{path}[{index}]")
            )

    elif isinstance(value, Field):
        problems.append(
            f"{path} contains a Django {type(value).__name__}"
        )

    problems = find_invalid_fields(data)
    print("INVALID LOCATION FIELDS:", problems)

    return problems

def find_non_json_values(value, path="data"):
    """Find Django field objects or other unexpected values in a response."""
    from django.db.models import Field

    problems = []

    if isinstance(value, dict):
        for key, item in value.items():
            problems.extend(
                find_non_json_values(item, f"{path}.{key}")
            )

    elif isinstance(value, (list, tuple)):
        for index, item in enumerate(value):
            problems.extend(
                find_non_json_values(item, f"{path}[{index}]")
            )

    elif isinstance(value, Field):
        problems.append(
            f"{path}: Django field object {type(value).__name__}"
        )

    return problems

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
        tree = ownership.filter_tree_for_user(tree, user)
        tree = ownership.attach_owner_details(tree)
        return tree
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

# FILTERING AND ENRICHMENT HELPERS
def matches(value, selected):
    if not selected:
        return True
    return str(value).strip().lower() == str(selected).strip().lower()


GEOGRAPHICAL_FIELDS = [
    "state_id", "state_name",
    "district_id", "district_name",
    "taluka_id", "taluka_name",
    "city_id", "city_name",
    "branch_id", "branch_name",
    "floor_id", "floor_name",
    "site_id",
]

ZONAL_FIELDS = [
    "zone_id", "zone_name",
    "circle_id", "circle_name",
    "region_id", "region_name",
    "division_id", "division_name",
    "branch_id", "branch_name",
    "floor_id", "floor_name",
    "site_id",
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
    selected_device_id = (
        request.GET.get("device_id") or request.GET.get("selectedDeviceId")
        or request.GET.get("device") or ""
    ).strip()
    selected_ac_id = (request.GET.get("ac_id") or "").strip()

    if not any([hierarchy, zone, state, district, taluka, circle,
                region, division, city, branch, floor, selected_device_id, selected_ac_id]):
        return data

    device_map = build_device_location_map()

    def keep(record):
        ac_id = str(record.get("ac_id", "") or "").strip()
        loc   = resolve_ac_location(ac_id, device_map)

        # Once a specific AC is selected, return only that AC's telemetry row.
        # Charts that need the ThingsBoard UUID can continue using `device_id`;
        # table/KPI data is matched using the local `ac_id`.
        if selected_ac_id and ac_id.casefold() != selected_ac_id.casefold():
            return False
        if selected_device_id:
            mapped = device_map.get(ac_id, {}) or {}
            known_ids = {
                str(ac_id).strip(),
                str(mapped.get("tpt_device_id", "") or "").strip(),
                str(mapped.get("device_id", "") or "").strip(),
                str(mapped.get("thingsboard_device_id", "") or "").strip(),
            }
            known_ids.discard("")
            if selected_device_id not in known_ids:
                return False
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

# DATA VIEWS
@api_view(["GET"])
def ac_data_with_location(request):
    try:
        data = get_telemetry_records()
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
        traceback.print_exc()
        return JsonResponse(
            { "success": False, "message": str(e), },
            status=500,
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ac_data(request):
    try:
        data = get_telemetry_records()
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
        data = scope_ac_records(get_telemetry_records(), request.user)
        if not data:
            return JsonResponse({"status": "success", "data": None})
        return JsonResponse({"status": "success", "data": data[-1]})
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)


# AUTH VIEWS
def get_client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _dashboard_path(role):
    return {
        Role.ORG_SUPER_ADMIN: "/org/dashboard",
        Role.CUSTOMER:        "/dashboard",
        Role.BR_ADMIN:        "/admin/dashboard",
        Role.ENGINEER:        "/engineer/dashboard",
    }.get(role, "/login")


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    email          = (request.data.get("email") or "").strip().lower()
    password       = request.data.get("password") or ""
    # requested_role = (request.data.get("role") or "").strip()

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

        # if requested_role and user.role != requested_role:
        #     return Response(
        #         {"status": "error",
        #          "message": f"This account belongs to '{user.get_role_display()}'."},
        #         status=403,
        #     )

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

# ORGANIZATION
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

        # 3TP is only a synchronization check.
        # Never remove locally saved customers because of cloud results.
        try:
            fetch_3tp_customers(request)
        except Exception as exc:
            warning = " ".join(str(exc).split())[:200]

        sites_by_customer = defaultdict(list)

        # Sites linked through the branch hierarchy.
        for site in Site.objects.filter(
            branch__customer__in=qs
        ).select_related("branch"):
            sites_by_customer[str(site.branch.customer_id)].append({
                "id": str(site.id),
                "name": site.name,
                "code": site.code,
                "branch_id": str(site.branch_id),
                "branch_name": site.branch.name,
            })

        # Also include explicit customer-site mappings.
        for mapping in CustomerSiteMapping.objects.filter(
            customer__in=qs,
            is_active=True,
        ).select_related("customer", "site", "site__branch"):
            cid = str(mapping.customer_id)
            row = {
                "id": str(mapping.site_id),
                "name": mapping.site.name,
                "code": mapping.site.code,
                "branch_id": str(mapping.site.branch_id or ""),
                "branch_name": (
                    mapping.site.branch.name
                    if mapping.site.branch_id else ""
                ),
            }

            existing = sites_by_customer.setdefault(cid, [])
            if not any(item["id"] == row["id"] for item in existing):
                existing.append(row)

        page = self.paginate_queryset(qs)
        serialized = self.get_serializer(
            page if page is not None else qs,
            many=True,
        ).data

        rows = [
            {
                **row,
                "assigned_sites": sites_by_customer.get(
                    str(row["id"]), []
                ),
            }
            for row in serialized
        ]

        response = (
            self.get_paginated_response(rows)
            if page is not None
            else Response(rows)
        )

        if warning:
            response["X-3TP-Warning"] = warning

        return response

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
            return Response(
                {"status": "error", "message": "Auth token required."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        user = request.user
        if user.role != Role.ORG_SUPER_ADMIN:
            return Response(
                {
                    "status": "error",
                    "message": "Only organization super admin can create customers.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        company = (data.get("company") or "").strip()
        email = (data.get("company_email") or "").strip().lower()
        contact = (data.get("contact_person") or "").strip() or company
        phone = (data.get("phone") or "").strip()

        if not email:
            return Response(
                {"status": "error", "message": "company_email is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if Customer.objects.filter(
            organization=user.organization,
            company_email__iexact=email,
        ).exists():
            return Response(
                {"status": "error", "message": "A customer with this email already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(email__iexact=email).exists():
            return Response(
                {"status": "error", "message": "A user with this email already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        password = request.data.get("password") or generate_password()

        # STEP 1: Commit local records first.
        with transaction.atomic():
            customer = serializer.save(
                organization=user.organization,
                tpt_sync_status="PENDING",
                tpt_sync_error="",
            )

            admin = User(
                name=contact,
                email=email,
                phone=phone,
                role=Role.CUSTOMER,
                organization=user.organization,
                customer=customer,
                is_active=True,
                tpt_sync_status="PENDING",
                tpt_sync_error="",
            )
            admin.set_password(password)
            admin.save()

        # STEP 2: Attempt cloud sync after local persistence.
        tpt_customer_id = ""
        tpt_user_id = ""
        sync_error = ""

        try:
            headers = _tpt_user_headers(
                request.headers.get("Authorization", "")
            )

            customer_payload = {
                "title": company,
                "email": email,
                "phone": phone,
                "address": data.get("address_line_1") or "",
                "city": data.get("city") or "",
                "state": data.get("state") or "",
                "country": "India",
                "zip": data.get("pincode") or "",
            }

            response = requests.post(
                f"{CLOUD_URL}/api/customer",
                json=customer_payload,
                headers=headers,
                timeout=15,
            )

            if response.status_code in (200, 201):
                tpt_customer_id = _id_of(response.json())

            elif response.status_code == 400 and "already exists" in response.text:
                # Reuse a cloud customer only if it is not already linked
                # to a different local customer.
                existing = find_3tp_customer_by_title(request, company)
                existing_id = _id_of(existing) if existing else ""

                if (
                    not existing_id
                    or Customer.objects.filter(
                        tpt_customer_id=existing_id
                    ).exclude(pk=customer.pk).exists()
                ):
                    raise ThreeTPError(
                        "A matching customer already exists in 3TP "
                        "and could not be safely linked."
                    )

                tpt_customer_id = existing_id

            else:
                raise ThreeTPError(
                    f"3TP customer creation failed ({response.status_code}): "
                    f"{response.text[:500]}"
                )

            if not tpt_customer_id:
                raise ThreeTPError("3TP did not return a customer ID.")

            customer.tpt_customer_id = tpt_customer_id
            customer.save(update_fields=["tpt_customer_id"])

            user_response = requests.post(
                f"{CLOUD_URL}/api/user",
                params={"sendActivationMail": "false"},
                headers=headers,
                timeout=15,
                json={
                    "email": email,
                    "authority": "CUSTOMER_USER",
                    "firstName": contact,
                    "lastName": "",
                    "phone": phone,
                    "customerId": {
                        "id": tpt_customer_id,
                        "entityType": "CUSTOMER",
                    },
                },
            )

            if user_response.status_code not in (200, 201):
                raise ThreeTPError(
                    f"3TP customer admin creation failed "
                    f"({user_response.status_code}): {user_response.text[:500]}"
                )

            tpt_user_id = _id_of(user_response.json())
            if not tpt_user_id:
                raise ThreeTPError("3TP did not return a customer admin ID.")

            _activate_3tp_user(
                request.headers.get("Authorization", ""),
                tpt_user_id,
                password,
            )

            admin.tpt_user_id = tpt_user_id
            admin.tpt_sync_status = "SYNCED"
            admin.tpt_sync_error = ""
            admin.save(update_fields=[
                "tpt_user_id", "tpt_sync_status", "tpt_sync_error"
            ])

            customer.tpt_sync_status = "SYNCED"
            customer.tpt_sync_error = ""
            customer.save(update_fields=[
                "tpt_sync_status", "tpt_sync_error"
            ])

        except Exception as exc:
            sync_error = _one_line(exc, 2000)

            # Do not delete the local customer or local admin.
            customer.tpt_sync_status = "ERROR"
            customer.tpt_sync_error = sync_error
            customer.save(update_fields=[
                "tpt_sync_status", "tpt_sync_error"
            ])

            admin.tpt_sync_status = "ERROR"
            admin.tpt_sync_error = sync_error
            admin.save(update_fields=[
                "tpt_sync_status", "tpt_sync_error"
            ])

        return Response(
            {
                "status": "success",
                "message": (
                    "Customer and admin saved locally. "
                    + (
                        "3TP synchronization completed."
                        if not sync_error
                        else "3TP synchronization is pending and can be retried."
                    )
                ),
                "data": {
                    "id": str(customer.id),
                    "company": customer.company,
                    "code": customer.code,
                    "company_email": customer.company_email,
                    "tpt_customer_id": customer.tpt_customer_id or "",
                    "tpt_user_id": tpt_user_id,
                    "tpt_sync_status": customer.tpt_sync_status,
                    "tpt_sync_error": sync_error,
                    "customer_admin": {
                        "id": str(admin.id),
                        "name": admin.name,
                        "email": admin.email,
                        "role": admin.role,
                        "tpt_sync_status": admin.tpt_sync_status,
                    },
                },
            },
            status=status.HTTP_201_CREATED,
        )

    
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

        if not user.is_authenticated:
            return qs.none()

        if user.role == Role.ORG_SUPER_ADMIN:
            qs = qs.filter(
                customer__organization_id=user.organization_id
            )
        elif user.role in (
            Role.CUSTOMER,
            Role.BR_ADMIN,
            Role.ENGINEER,
        ):
            qs = qs.filter(customer_id=user.customer_id)
        else:
            return qs.none()

        customer_id = self.request.query_params.get("customer")

        if customer_id:
            # Prevent selecting a customer outside the user's scope.
            qs = qs.filter(customer_id=customer_id)

        return qs.order_by("name")

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


# class BranchListView(generics.ListAPIView):
#     serializer_class = BranchSerializer
#     permission_classes = [permissions.IsAuthenticated]

#     def get_queryset(self):
#         user = self.request.user

#         qs = Branch.objects.select_related(
#             "customer",

#             # Geographical
#             "city",
#             "city__taluka",
#             "city__taluka__district",
#             "city__taluka__district__state",

#             # Zonal
#             "division",
#             "division__region",
#             "division__region__circle",
#             "division__region__circle__zone",
#         )

#         # =====================================================
#         # USER ACCESS
#         # =====================================================

#         if user.role == Role.ORG_SUPER_ADMIN:

#             qs = qs.filter(
#                 customer__organization_id=user.organization_id
#             )

#         elif user.role == Role.CUSTOMER:

#             qs = qs.filter(
#                 customer_id=user.customer_id
#             )

#         elif user.role == Role.BR_ADMIN:
#             assigned_branch_ids = list(
#                 Branch.objects.filter(assigned_admin=user).values_list("pk", flat=True)
#             )
#             if assigned_branch_ids:
#                 qs = qs.filter(pk__in=assigned_branch_ids)
#             else:
#                 hierarchy = (
#                     getattr(user.customer, "hierarchy_type", None)
#                     if user.customer_id else None
#                 )
#                 if hierarchy == "GEOGRAPHICAL" and user.state_id:
#                     qs = qs.filter(
#                         customer_id=user.customer_id,
#                         city__taluka__district__state_id=user.state_id,
#                     )
#                 elif hierarchy == "ZONAL" and user.zone_id:
#                     qs = qs.filter(
#                         customer_id=user.customer_id,
#                         division__region__circle__zone_id=user.zone_id,
#                     )
#                 elif user.branch_id:
#                     qs = qs.filter(pk=user.branch_id)
#                 else:
#                     return Branch.objects.none()
# 
#         elif user.role == Role.ENGINEER:
# 
#             if user.branch_id:
#                 qs = qs.filter(
#                     pk=user.branch_id
#                 )
#             else:
#                 return Branch.objects.none()

#         else:

#             return Branch.objects.none()

#         # =====================================================
#         # HIERARCHY FILTER
#         # =====================================================

#         hierarchy = (
#             self.request.query_params
#             .get("hierarchy", "")
#             .strip()
#             .upper()
#         )

#         if hierarchy == "GEOGRAPHICAL":

#             qs = qs.filter(
#                 city__isnull=False,
#                 division__isnull=True,
#             )

#         elif hierarchy == "ZONAL":

#             qs = qs.filter(
#                 division__isnull=False,
#                 city__isnull=True,
#             )

#         # =====================================================
#         # SEARCH
#         # =====================================================

#         search = (
#             self.request.query_params
#             .get("search", "")
#             .strip()
#         )

#         if search:

#             qs = qs.filter(
#                 Q(name__icontains=search)
#                 |
#                 Q(code__icontains=search)
#             )

#         return qs.order_by("name")


# class BranchListView(generics.ListAPIView):
#     serializer_class = BranchSerializer
#     permission_classes = [permissions.IsAuthenticated]

#     def get_queryset(self):
#         user = self.request.user

#         qs = Branch.objects.select_related(
#             "customer",
#             "city",
#             "city__taluka",
#             "city__taluka__district",
#             "city__taluka__district__state",
#             "division",
#             "division__region",
#             "division__region__circle",
#             "division__region__circle__zone",
#         )

#         # --------------------------------------------------
#         # EXISTING ROLE-BASED ACCESS
#         # --------------------------------------------------

#         if user.role == Role.ORG_SUPER_ADMIN:
#             qs = qs.filter(
#                 customer__organization_id=user.organization_id
#             )

#         elif user.role == Role.CUSTOMER:
#             qs = qs.filter(
#                 customer_id=user.customer_id
#             )

#         elif user.role == Role.BR_ADMIN:

#             hierarchy = (
#                 getattr(user.customer, "hierarchy_type", None)
#                 if user.customer_id
#                 else None
#             )

#             if hierarchy == "GEOGRAPHICAL" and user.state_id:
#                 qs = qs.filter(
#                     customer_id=user.customer_id,
#                     city__taluka__district__state_id=user.state_id,
#                 )

#             elif hierarchy == "ZONAL" and user.zone_id:
#                 qs = qs.filter(
#                     customer_id=user.customer_id,
#                     division__region__circle__zone_id=user.zone_id,
#                 )

#             elif user.branch_id:
#                 qs = qs.filter(
#                     pk=user.branch_id
#                 )

#             else:
#                 return Branch.objects.none()

#         elif user.role == Role.ENGINEER:

#             if user.branch_id:
#                 qs = qs.filter(
#                     pk=user.branch_id
#                 )
#             else:
#                 return Branch.objects.none()

#         else:
#             return Branch.objects.none()

#         # --------------------------------------------------
#         # OPTIONAL CUSTOMER FILTER
#         # --------------------------------------------------

#         customer_id = self.request.query_params.get("customer")

#         if customer_id:
#             qs = qs.filter(
#                 customer_id=customer_id
#             )

#         # --------------------------------------------------
#         # SEARCH BRANCH
#         # --------------------------------------------------

#         search = (
#             self.request.query_params
#             .get("search", "")
#             .strip()
#         )

#         if search:
#             qs = qs.filter(
#                 Q(name__icontains=search) |
#                 Q(code__icontains=search)
#             )

#         return qs.order_by("name")


class BranchListView(generics.ListCreateAPIView):
    serializer_class = BranchSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        qs = Branch.objects.select_related(
            "customer",

            # Geographical
            "city",
            "city__taluka",
            "city__taluka__district",
            "city__taluka__district__state",

            # Zonal
            "division",
            "division__region",
            "division__region__circle",
            "division__region__circle__zone",
        )

        if user.role == Role.ORG_SUPER_ADMIN:
            qs = qs.filter(
                customer__organization_id=user.organization_id
            )

        elif user.role == Role.CUSTOMER:
            qs = qs.filter(
                customer_id=user.customer_id
            )

        elif user.role == Role.BR_ADMIN:
            assigned_branch_ids = list(
                Branch.objects.filter(assigned_admin=user).values_list("pk", flat=True)
            )
            if assigned_branch_ids:
                qs = qs.filter(pk__in=assigned_branch_ids)
            else:
                hierarchy = (
                    getattr(user.customer, "hierarchy_type", None)
                    if user.customer_id else None
                )
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

            if user.branch_id:
                qs = qs.filter(
                    pk=user.branch_id
                )
            else:
                return Branch.objects.none()

        else:
            return Branch.objects.none()

        customer_id = self.request.query_params.get("customer")

        if customer_id:
            qs = qs.filter(
                customer_id=customer_id
            )

        return qs.order_by("name")

    def perform_create(self, serializer):
        user = self.request.user

        # --------------------------------------------------
        # CUSTOMER
        # --------------------------------------------------

        if user.role == Role.CUSTOMER:

            if not user.customer_id:
                raise serializers.ValidationError({
                    "customer": "Logged-in user is not linked to a customer."
                })

            branch = serializer.save(customer_id=user.customer_id)
            if not branch.assigned_admin_id:
                primary_admin = User.objects.filter(
                    customer_id=user.customer_id, role=Role.BR_ADMIN, is_active=True
                ).order_by("date_joined").first() or User.objects.filter(
                    customer_id=user.customer_id, role=Role.CUSTOMER, is_active=True
                ).order_by("date_joined").first()
                if primary_admin:
                    branch.assigned_admin = primary_admin
                    branch.save(update_fields=["assigned_admin"])
            return

        # --------------------------------------------------
        # ORGANIZATION SUPER ADMIN
        # --------------------------------------------------

        if user.role == Role.ORG_SUPER_ADMIN:

            customer_id = self.request.data.get("customer")

            if not customer_id:
                raise serializers.ValidationError({
                    "customer": "Customer is required."
                })

            try:
                customer = Customer.objects.get(
                    pk=customer_id,
                    organization_id=user.organization_id,
                )
            except Customer.DoesNotExist:
                raise serializers.ValidationError({
                    "customer": "Invalid customer."
                })

            branch = serializer.save(customer=customer)
            if not branch.assigned_admin_id:
                primary_admin = User.objects.filter(
                    customer=customer, role=Role.BR_ADMIN, is_active=True
                ).order_by("date_joined").first() or User.objects.filter(
                    customer=customer, role=Role.CUSTOMER, is_active=True
                ).order_by("date_joined").first()
                if primary_admin:
                    branch.assigned_admin = primary_admin
                    branch.save(update_fields=["assigned_admin"])
            return

        # --------------------------------------------------
        # BRANCH ADMIN
        # --------------------------------------------------

        if user.role == Role.BR_ADMIN:

            if not user.customer_id:
                raise serializers.ValidationError({
                    "customer": "Branch Admin is not linked to a customer."
                })

            serializer.save(
                customer_id=user.customer_id
            )

            return

        raise permissions.PermissionDenied(
            "You do not have permission to create a branch."
        )

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

        if user.role == Role.CUSTOMER:
            if branch.customer_id != user.customer_id:
                raise DRFValidationError({
                    "branch": "You can only create a site under your customer."
                })

        elif user.role == Role.BR_ADMIN:
            if branch.id != user.branch_id:
                raise DRFValidationError({
                    "branch": "You can only create a site under your branch."
                })

        elif user.role == Role.ENGINEER:
            raise DRFValidationError(
                "Engineers cannot create sites."
            )

        elif user.role == Role.ORG_SUPER_ADMIN:
            if branch.customer.organization_id != user.organization_id:
                raise DRFValidationError({
                    "branch": "This branch is outside your organization."
                })

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
            raise ThreeTPAPIError(
                f"Site created locally but 3TP site creation failed: {_one_line(exc)}"
            )

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def search_site_branches(request):
    """
    Search branches for Site creation.

    Query:
        ?hierarchy=GEOGRAPHICAL&q=pune
        ?hierarchy=ZONAL&q=mumbai
    """

    hierarchy = (
        request.query_params.get("hierarchy", "")
        .strip()
        .upper()
    )

    query = request.query_params.get("q", "").strip()

    if hierarchy not in ["GEOGRAPHICAL", "ZONAL"]:
        return Response(
            {
                "status": "error",
                "message": "hierarchy must be GEOGRAPHICAL or ZONAL."
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    branches = Branch.objects.all()

    # ---------------------------------------------------------
    # USER SCOPE
    # ---------------------------------------------------------

    user = request.user

    if user.role == Role.CUSTOMER:
        branches = branches.filter(
            customer_id=user.customer_id
        )

    elif user.role == Role.BR_ADMIN:
        branches = branches.filter(
            id=user.branch_id
        )

    elif user.role == Role.ENGINEER:
        return Response({
            "status": "success",
            "count": 0,
            "data": []
        })

    elif user.role == Role.ORG_SUPER_ADMIN:
        # Only apply this when organization exists.
        if getattr(user, "organization_id", None):
            branches = branches.filter(
                customer__organization_id=user.organization_id
            )

    # ---------------------------------------------------------
    # HIERARCHY FILTER
    # ---------------------------------------------------------

    if hierarchy == "GEOGRAPHICAL":
        branches = branches.filter(
            city__isnull=False
        ).select_related(
            "customer",
            "city",
            "city__taluka",
            "city__taluka__district",
            "city__taluka__district__state",
        )

    else:
        branches = branches.filter(
            division__isnull=False
        ).select_related(
            "customer",
            "division",
            "division__region",
            "division__region__circle",
            "division__region__circle__zone",
        )

    # ---------------------------------------------------------
    # SEARCH
    # ---------------------------------------------------------

    if query:
        branches = branches.filter(
            Q(name__icontains=query) |
            Q(code__icontains=query)
        )

    branches = branches.order_by("name")[:50]

    # ---------------------------------------------------------
    # RESPONSE
    # ---------------------------------------------------------

    result = []

    for branch in branches:

        row = {
            "id": str(branch.id),
            "name": branch.name,
            "code": branch.code or "",
            "hierarchy_type": hierarchy,
            "latitude": (
                str(branch.latitude)
                if branch.latitude is not None
                else ""
            ),
            "longitude": (
                str(branch.longitude)
                if branch.longitude is not None
                else ""
            ),

            "state_id": "",
            "state_name": "",
            "district_id": "",
            "district_name": "",
            "taluka_id": "",
            "taluka_name": "",
            "city_id": "",
            "city_name": "",

            "zone_id": "",
            "zone_name": "",
            "circle_id": "",
            "circle_name": "",
            "region_id": "",
            "region_name": "",
            "division_id": "",
            "division_name": "",
        }

        # -----------------------------------------------------
        # GEOGRAPHICAL
        # -----------------------------------------------------

        if hierarchy == "GEOGRAPHICAL":

            city = branch.city

            if city:
                row["city_id"] = str(city.id)
                row["city_name"] = city.name

                taluka = getattr(city, "taluka", None)

                if taluka:
                    row["taluka_id"] = str(taluka.id)
                    row["taluka_name"] = taluka.name

                    district = getattr(taluka, "district", None)

                    if district:
                        row["district_id"] = str(district.id)
                        row["district_name"] = district.name

                        state_obj = getattr(district, "state", None)

                        if state_obj:
                            row["state_id"] = str(state_obj.id)
                            row["state_name"] = state_obj.name

        # -----------------------------------------------------
        # ZONAL
        # -----------------------------------------------------

        else:

            division = branch.division

            if division:
                row["division_id"] = str(division.id)
                row["division_name"] = division.name

                region = getattr(division, "region", None)

                if region:
                    row["region_id"] = str(region.id)
                    row["region_name"] = region.name

                    circle = getattr(region, "circle", None)

                    if circle:
                        row["circle_id"] = str(circle.id)
                        row["circle_name"] = circle.name

                        zone = getattr(circle, "zone", None)

                        if zone:
                            row["zone_id"] = str(zone.id)
                            row["zone_name"] = zone.name

        result.append(row)

    return Response({
        "status": "success",
        "count": len(result),
        "data": result,
    })

import requests

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def pincode_lookup(request, pincode):

    pincode = str(pincode).strip()

    # Validate pincode
    if not pincode.isdigit() or len(pincode) != 6:
        return Response(
            {
                "status": "error",
                "message": "Enter a valid 6-digit pincode."
            },
            status=400
        )

    try:
        url = f"https://api.postalpincode.in/pincode/{pincode}"

        response = requests.get(
            url,
            timeout=10
        )

        response.raise_for_status()

        result = response.json()

        if not result:
            return Response(
                {
                    "status": "error",
                    "message": "No pincode information found."
                },
                status=404
            )

        api_result = result[0]

        if api_result.get("Status") != "Success":
            return Response(
                {
                    "status": "error",
                    "message": api_result.get(
                        "Message",
                        "Pincode not found."
                    )
                },
                status=404
            )

        post_offices = api_result.get("PostOffice") or []

        if not post_offices:
            return Response(
                {
                    "status": "error",
                    "message": "No post office found for this pincode."
                },
                status=404
            )

        # Convert API response into frontend-friendly format
        locations = []

        for office in post_offices:
            locations.append({
                "name": office.get("Name"),
                "branch_type": office.get("BranchType"),
                "delivery_status": office.get("DeliveryStatus"),
                "circle": office.get("Circle"),
                "district": office.get("District"),
                "division": office.get("Division"),
                "region": office.get("Region"),
                "block": office.get("Block"),
                "state": office.get("State"),
                "country": office.get("Country"),
                "pincode": office.get("Pincode"),
            })

        return Response({
            "status": "success",
            "pincode": pincode,
            "count": len(locations),
            "data": locations
        })

    except requests.RequestException as e:

        return Response(
            {
                "status": "error",
                "message": "Unable to fetch pincode information.",
                "details": str(e)
            },
            status=502
        )

    except Exception as e:

        return Response(
            {
                "status": "error",
                "message": "Unexpected error.",
                "details": str(e)
            },
            status=500
        )
    
@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def create_site(request):
    try:
        user = request.user

        name = request.data.get("name")
        code = request.data.get("code")
        branch_id = request.data.get("branch_id")
        floor_id = request.data.get("floor_id")

        address = request.data.get("address", "")
        pincode = request.data.get("pincode", "")

        city_name = request.data.get("city", "")
        district_name = request.data.get("district", "")
        state_name = request.data.get("state", "")

        latitude = request.data.get("latitude")
        longitude = request.data.get("longitude")

        hierarchy_type = request.data.get("hierarchy_type", "")

        if not name:
            return Response(
                {"status": "error", "message": "Site name is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not code:
            return Response(
                {"status": "error", "message": "Site code is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not branch_id:
            return Response(
                {"status": "error", "message": "branch_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            branch = Branch.objects.select_related("customer").get(
                id=branch_id
            )
        except Branch.DoesNotExist:
            return Response(
                {"status": "error", "message": "Branch not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        hierarchy_type = hierarchy_type.strip().upper()

        if hierarchy_type not in ["GEOGRAPHICAL", "ZONAL"]:
            return Response(
                {
                    "status": "error",
                    "message": "Invalid hierarchy_type."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        if hierarchy_type == "GEOGRAPHICAL":
            if not getattr(branch, "city_id", None):
                return Response(
                    {
                        "status": "error",
                        "message": "Selected branch is not geographical."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
        elif hierarchy_type == "ZONAL":
            if not getattr(branch, "division_id", None):
                return Response(
                    {
                        "status": "error",
                        "message": "Selected branch is not zonal."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # -------------------------
        # Check user access
        # -------------------------
        if user.role == Role.CUSTOMER:
            if branch.customer_id != user.customer_id:
                return Response(
                    {
                        "status": "error",
                        "message": "You can only create a site under your customer."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        elif user.role == Role.BR_ADMIN:
            if branch.id != user.branch_id:
                return Response(
                    {
                        "status": "error",
                        "message": "You can only create a site under your branch."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        elif user.role == Role.ENGINEER:
            return Response(
                {
                    "status": "error",
                    "message": "Engineers cannot create sites."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        elif user.role == Role.ORG_SUPER_ADMIN:
            if branch.customer.organization_id != user.organization_id:
                return Response(
                    {
                        "status": "error",
                        "message": "This branch is outside your organization."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        # -------------------------
        # Optional Floor
        # -------------------------
        floor = None

        if floor_id:
            try:
                floor = Floor.objects.get(
                    id=floor_id,
                    branch_id=branch.id
                )
            except Floor.DoesNotExist:
                return Response(
                    {
                        "status": "error",
                        "message": "Floor does not belong to this branch."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # -------------------------
        # Check duplicate site
        # -------------------------
        if Site.objects.filter(code=code).exists():
            return Response(
                {
                    "status": "error",
                    "message": "Site code already exists."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if Site.objects.filter(
            branch=branch,
            name=name
        ).exists():
            return Response(
                {
                    "status": "error",
                    "message": "A site with this name already exists in this branch."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # =====================================================
        # CREATE SITE IN 3TP
        # =====================================================

        payload = {
            "name": name,
            "type": "default",
        }

        try:
            _, data = _tpt_request(
                "POST",
                "site",
                payload=payload
            )

            tpt_site_id = _tpt_extract_id(data)

            if not tpt_site_id:
                raise ThreeTPError(
                    "3TP created the site but did not return a site ID."
                )

        except ThreeTPError as exc:
            return Response(
                {
                    "status": "error",
                    "message": f"3TP site creation failed: {_one_line(exc)}"
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # =====================================================
        # CREATE LOCAL SITE
        # =====================================================

        try:
            site = Site.objects.create(
                name=name,
                code=code,
                branch=branch,
                floor=floor,
                address=address,
                latitude=latitude or None,
                longitude=longitude or None,
                pincode=pincode,

                # keep your existing 3TP fields
                tpt_site_id=tpt_site_id,
                tpt_sync_status="SYNCED",
                tpt_sync_error="",
            )

        except Exception as exc:
            return Response(
                {
                    "status": "error",
                    "message": "3TP site was created but local site creation failed.",
                    "details": str(exc),
                    "tpt_site_id": tpt_site_id,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "status": "success",
                "message": "Site created successfully.",
                "data": {
                    "site_id": str(site.id),
                    "tpt_site_id": site.tpt_site_id,
                    "name": site.name,
                    "code": site.code,
                    "branch_id": str(site.branch_id),
                    "floor_id": str(site.floor_id) if site.floor_id else None,
                },
            },
            status=status.HTTP_201_CREATED,
        )

    except Exception as exc:
        traceback.print_exc()

        return Response(
            {
                "status": "error",
                "message": str(exc),
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
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


# LOCATIONS API  (create + read, with ownership stamping)
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


# SAVED DASHBOARD PREFERENCES
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

class DeviceCreateView(generics.CreateAPIView):
    serializer_class = ACDeviceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):

        user = self.request.user

        # Engineers cannot create devices
        if user.role == Role.ENGINEER:
            raise DRFValidationError(
                "Engineers cannot create devices."
            )

        # -----------------------------------------
        # CREATE LOCAL DEVICE FIRST
        # -----------------------------------------

        branch_id = self.request.data.get("branch_id") or self.request.data.get("branch")
        site_id = self.request.data.get("site_id") or self.request.data.get("site")
        branch = None
        site = None
        # Infer a safe hierarchy location only when it is unambiguous. This
        # keeps newly created devices filterable without guessing between branches.
        if not branch_id and not site_id:
            if user.role == Role.BR_ADMIN and user.branch_id:
                branch_id = str(user.branch_id)
            elif user.role == Role.CUSTOMER and user.customer_id:
                only_branch = Branch.objects.filter(customer_id=user.customer_id, is_active=True).first()
                if only_branch and not Branch.objects.filter(customer_id=user.customer_id, is_active=True).exclude(pk=only_branch.pk).exists():
                    branch_id = str(only_branch.pk)
            elif user.role == Role.ORG_SUPER_ADMIN and user.organization_id:
                org_branches = Branch.objects.filter(customer__organization_id=user.organization_id, is_active=True)
                only_branch = org_branches.first()
                if only_branch and not org_branches.exclude(pk=only_branch.pk).exists():
                    branch_id = str(only_branch.pk)
        if site_id:
            try:
                site = Site.objects.select_related("branch").get(pk=site_id)
                branch = site.branch
            except (Site.DoesNotExist, ValueError, TypeError):
                raise DRFValidationError({"site_id": "Selected site does not exist."})
        elif branch_id:
            try:
                branch = Branch.objects.select_related("customer").get(pk=branch_id)
            except (Branch.DoesNotExist, ValueError, TypeError):
                raise DRFValidationError({"branch_id": "Selected branch does not exist."})
        if branch and user.role == Role.CUSTOMER and branch.customer_id != user.customer_id:
            raise DRFValidationError({"branch_id": "Branch is outside your customer hierarchy."})
        if branch and user.role == Role.ORG_SUPER_ADMIN and branch.customer.organization_id != user.organization_id:
            raise DRFValidationError({"branch_id": "Branch is outside your organization."})
        serializer.save(
            assigned_by=user, branch=branch, site=site,
            tpt_sync_status="PENDING", tpt_sync_error=""
        )

        device = serializer.instance
        if site:
            SiteDeviceMapping.objects.update_or_create(site=site, device=device, defaults={"is_active": True})
            owner_customer_id = branch.customer_id if branch else None
            if owner_customer_id:
                CustomerDeviceMapping.objects.update_or_create(
                    customer_id=owner_customer_id, device=device, defaults={"is_active": True}
                )

        # -----------------------------------------
        # CREATE DEVICE IN 3TP
        # -----------------------------------------

        try:

            tpt_device_id, created_new = create_3tp_device_independent(
                request=self.request,
                name=device.device_name or device.ac_id,
                label=device.device_name or device.ac_id,
                client_id=device.ac_id,
                username=device.ac_id,
                password=""
            )

            # -----------------------------------------
            # UPDATE LOCAL DEVICE
            # -----------------------------------------

            device.tpt_device_id = tpt_device_id
            device.tpt_sync_status = "SYNCED"
            device.tpt_sync_error = ""

            device.save(
                update_fields=[
                    "tpt_device_id",
                    "tpt_sync_status",
                    "tpt_sync_error",
                    "updated_at",
                ]
            )

        except ThreeTPError as exc:

            device.tpt_sync_status = "FAILED"
            device.tpt_sync_error = str(exc)

            device.save(
                update_fields=[
                    "tpt_sync_status",
                    "tpt_sync_error",
                    "updated_at",
                ]
            )

            raise ThreeTPAPIError(
                "Device created locally but 3TP "
                f"synchronization failed: {_one_line(exc)}"
            )

def create_3tp_device_independent(
    request,
    *,
    name,
    label,
    client_id,
    username,
    password
):
    """
    Create a device in 3TP only.

    No customer assignment.
    No site assignment.

    Returns:
        (tpt_device_id, created_new)
    """

    headers = _tpt_user_headers(request)

    created_new = True

    # -----------------------------------------
    # CREATE DEVICE + MQTT CREDENTIALS
    # -----------------------------------------

    payload = {
        "device": {
            "name": name,
            "label": label or name,

            "deviceProfileId": {
                "id": get_3tp_device_profile_id(request),
                "entityType": "DEVICE_PROFILE"
            },
        },

        "credentials": {
            "credentialsType": "MQTT_BASIC",

            "credentialsValue": json.dumps({
                "clientId": client_id,
                "userName": username,
                "password": password
            }),
        },
    }

    response = requests.post(
        f"{CLOUD_URL}/api/device-with-credentials",

        headers=headers,

        timeout=15,

        json=payload
    )

    # -----------------------------------------
    # HANDLE RESPONSE
    # -----------------------------------------

    if response.status_code == 400:

        if "already exists" in response.text.lower():

            existing = find_3tp_device_by_name(
                request,
                name
            )

            existing_id = (
                _id_of(existing)
                if existing
                else ""
            )

            if not existing_id:
                raise ThreeTPError(
                    f"A device named '{name}' "
                    "already exists in 3TP."
                )

            # Make sure this device isn't already
            # connected to another local device.

            if ACDevice.objects.filter(
                tpt_device_id=existing_id
            ).exists():

                raise ThreeTPError(
                    f"Device '{name}' already exists "
                    "locally."
                )

            tpt_device_id = existing_id
            created_new = False

        else:

            raise ThreeTPError(
                f"3TP device creation failed: "
                f"{response.text}",
                status=response.status_code
            )

    elif response.status_code not in (200, 201):

        raise ThreeTPError(
            f"3TP device creation failed: "
            f"{response.text}",
            status=response.status_code
        )

    else:

        try:
            data = response.json()

        except ValueError:
            raise ThreeTPError(
                "3TP returned an invalid response."
            )

        tpt_device_id = _id_of(data)

    # -----------------------------------------
    # VALIDATE 3TP DEVICE ID
    # -----------------------------------------

    if not tpt_device_id:

        raise ThreeTPError(
            "3TP did not return a device id."
        )

    # -----------------------------------------
    # IMPORTANT:
    # NO CUSTOMER MAPPING HERE
    # NO SITE MAPPING HERE
    # -----------------------------------------

    return tpt_device_id, created_new

@csrf_exempt
@api_view(["POST"])
def create_site(request):

    try:
        auth_header = request.headers.get("Authorization")

        if not auth_header or not auth_header.startswith("Bearer "):
            return JsonResponse(
                {"error": "Valid Bearer token required"},
                status=401
            )

        token = auth_header.split(" ")[1]

        body = json.loads(request.body)

        name = body.get("name")
        customer_id = body.get("customer_id")
        latitude = body.get("latitude")
        longitude = body.get("longitude")
        address = body.get("address")

        if not name:
            return JsonResponse(
                {"error": "name is required"},
                status=400
            )

        # ---------------- 3TP CREATE SITE ----------------

        response = requests.post(
            f"{CLOUD_URL}/api/asset",
            json={
                "name": name,
                "type": "default"
            },
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "X-Authorization": f"Bearer {token}"
            }
        )

        data = response.json()

        if response.status_code not in [200, 201]:
            return JsonResponse(data, status=response.status_code)

        asset_id = data["id"]["id"]

        # ---------------- CUSTOMER -> SITE ----------------

        if customer_id:

            response = requests.post(
                f"{CLOUD_URL}/api/customer/{customer_id}/asset/{asset_id}",
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "X-Authorization": f"Bearer {token}"
                }
            )

            if response.status_code not in [200, 201]:
                return JsonResponse(
                    {"error": "Failed to map site to customer",
                     "details": response.json()},
                    status=response.status_code
                )

        # ---------------- SAVE LOCAL ----------------

        site = Site.objects.create(
            name=name,
            asset_id=asset_id,
            customer_id=customer_id,
            latitude=latitude,
            longitude=longitude,
            address=address
        )

        return JsonResponse({
            "message": "Site created successfully",
            "site_id": str(site.id),
            "asset_id": asset_id,
            "customer_id": customer_id
        }, status=201)

    except Exception as e:

        return JsonResponse(
            {"error": str(e)},
            status=500
        )

@csrf_exempt
@api_view(["POST"])
def create_device(request):

    try:
        auth_header = request.headers.get("Authorization")

        if not auth_header or not auth_header.startswith("Bearer "):
            return JsonResponse(
                {"error": "Valid Bearer token required"},
                status=401
            )

        token = auth_header.split(" ")[1]

        body = json.loads(request.body)

        ac_id = body.get("ac_id")
        device_name = body.get("device_name")

        if not ac_id:
            return JsonResponse(
                {"error": "ac_id is required"},
                status=400
            )

        # ---------------- CREATE DEVICE IN 3TP ----------------

        payload = {
            "device": {
                "name": device_name or ac_id,
                "label": device_name or ac_id,
                "deviceProfileId": {
                    "id": body.get("device_profile_id"),
                    "entityType": "DEVICE_PROFILE"
                }
            },
            "credentials": {
                "credentialsType": "MQTT_BASIC",
                "credentialsValue": json.dumps({
                    "clientId": ac_id,
                    "userName": body.get("username", ac_id),
                    "password": body.get("password", "")
                })
            }
        }

        response = requests.post(
            f"{CLOUD_URL}/api/device-with-credentials",
            json=payload,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "X-Authorization": f"Bearer {token}"
            }
        )

        data = response.json()

        if response.status_code not in [200, 201]:
            return JsonResponse(
                data,
                status=response.status_code
            )

        device_id = data["device"]["id"]["id"]

        # ---------------- SAVE LOCAL ----------------

        device = ACDevice.objects.create(
            ac_id=ac_id,
            device_name=device_name or ac_id,
            tpt_device_id=device_id
        )

        return JsonResponse({
            "message": "Device created successfully",
            "device_id": str(device.id),
            "tpt_device_id": device_id
        }, status=201)

    except Exception as e:

        return JsonResponse(
            {"error": str(e)},
            status=500
        )

@csrf_exempt
@api_view(["POST"])
def assign_device_to_customer(request):

    try:
        auth_header = request.headers.get("Authorization")

        if not auth_header or not auth_header.startswith("Bearer "):
            return JsonResponse(
                {"error": "Valid Bearer token required"},
                status=401
            )

        token = auth_header.split(" ")[1]

        body = json.loads(request.body)

        customer_id = body.get("customer_id")
        device_id = body.get("device_id")

        if not customer_id or not device_id:
            return JsonResponse(
                {"error": "customer_id and device_id are required"},
                status=400
            )

        # ---------------- 3TP MAPPING ----------------

        response = requests.post(
            f"{CLOUD_URL}/api/customer/{customer_id}/device/{device_id}",
            headers={
                "Accept": "application/json",
                "X-Authorization": f"Bearer {token}"
            }
        )

        if response.status_code not in [200, 201]:
            return JsonResponse(
                {
                    "error": "Failed to map device to customer",
                    "details": response.json()
                },
                status=response.status_code
            )

        return JsonResponse({
            "message": "Device mapped to customer successfully",
            "customer_id": customer_id,
            "device_id": device_id
        })

    except Exception as e:

        return JsonResponse(
            {"error": str(e)},
            status=500
        )


@csrf_exempt
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def assign_device_to_admin(request):
    """Allocate a customer-owned device to a BR_ADMIN within the caller's scope."""
    user = request.user
    if user.role not in (Role.ORG_SUPER_ADMIN, Role.CUSTOMER):
        return JsonResponse({"error": "Only Super Admin or Customer can allocate devices to admins."}, status=403)
    device_ref = str(request.data.get("device_id") or "").strip()
    admin_ref = str(request.data.get("admin_id") or "").strip()
    if not device_ref or not admin_ref:
        return JsonResponse({"error": "device_id and admin_id are required."}, status=400)
    device = ACDevice.objects.filter(ac_id=device_ref).first() or ACDevice.objects.filter(tpt_device_id=device_ref).first()
    if device is None:
        try: device = ACDevice.objects.filter(pk=device_ref).first()
        except (ValueError, TypeError): pass
    admin = User.objects.filter(pk=admin_ref, role=Role.BR_ADMIN, is_active=True).first()
    if not device or not admin:
        return JsonResponse({"error": "Device or active Branch Admin was not found."}, status=404)
    if user.role == Role.CUSTOMER:
        if admin.customer_id != user.customer_id:
            return JsonResponse({"error": "Admin does not belong to your customer."}, status=403)
        customer_id = user.customer_id
    else:
        if admin.organization_id != user.organization_id:
            return JsonResponse({"error": "Admin is outside your organization."}, status=403)
        customer_id = admin.customer_id
    from .access_scope import device_customer
    owner = device_customer(device)
    if owner and owner.pk != customer_id:
        return JsonResponse({"error": "Device belongs to a different customer."}, status=403)
    if not owner and customer_id:
        CustomerDeviceMapping.objects.update_or_create(customer_id=customer_id, device=device, defaults={"is_active": True})
    device.assigned_admin = admin
    device.save(update_fields=["assigned_admin", "updated_at"])
    return JsonResponse({"status": "success", "message": "Device allocated to admin.", "device_id": str(device.pk), "admin_id": str(admin.pk)})


@csrf_exempt
@api_view(["POST"])
def assign_device_to_site(request):

    try:
        auth_header = request.headers.get("Authorization")

        if not auth_header or not auth_header.startswith("Bearer "):
            return JsonResponse(
                {"error": "Valid Bearer token required"},
                status=401
            )

        token = auth_header.split(" ")[1]

        body = json.loads(request.body)

        asset_id = body.get("asset_id")
        device_id = body.get("device_id")

        if not asset_id or not device_id:
            return JsonResponse(
                {"error": "asset_id and device_id are required"},
                status=400
            )

        # ---------------- SITE -> DEVICE ----------------

        payload = {
            "from": {
                "entityType": "ASSET",
                "id": asset_id
            },
            "to": {
                "entityType": "DEVICE",
                "id": device_id
            },
            "type": "Contains",
            "typeGroup": "COMMON"
        }

        response = requests.post(
            f"{CLOUD_URL}/api/relation",
            json=payload,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "X-Authorization": f"Bearer {token}"
            }
        )

        if response.status_code not in [200, 201]:
            return JsonResponse(
                {
                    "error": "Failed to map device to site",
                    "details": response.json()
                },
                status=response.status_code
            )

        # ---------------- LOCAL UPDATE ----------------

        site = Site.objects.filter(
            asset_id=asset_id,
            is_deleted=False
        ).first()

        device = ACDevice.objects.filter(
            tpt_device_id=device_id
        ).first()

        if site and device:
            device.site = site
            device.save(update_fields=["site"])

        return JsonResponse({
            "message": "Device mapped to site successfully",
            "asset_id": asset_id,
            "device_id": device_id
        })

    except Exception as e:

        return JsonResponse(
            {"error": str(e)},
            status=500
        )


def get_or_create_local_site_from_3tp(request, tpt_site_id, customer, branch_id=None):
    """Return the local Site for a 3TP asset, creating it if it doesn't exist."""
    site = Site.objects.filter(tpt_site_id=tpt_site_id).first()
    if site:
        return site, False

    # Read the asset from 3TP so the local row matches it
    res = requests.get(
        f"{CLOUD_URL}/api/asset/{tpt_site_id}",
        headers=_tpt_user_headers(request),
        timeout=15,
    )
    if res.status_code != 200:
        raise ThreeTPError(
            f"Site not found in 3TP: {res.text}", status=res.status_code
        )
    asset = res.json()
    name = asset.get("name") or asset.get("label") or f"Site {tpt_site_id[:8]}"

    # Branch: explicit one from the request, else the customer's first branch
    branch = None
    if branch_id:
        branch = Branch.objects.filter(pk=branch_id, customer=customer).first()
    if branch is None:
        branch = Branch.objects.filter(customer=customer).order_by("name").first()

    # Unique code
    code = f"3TP-{tpt_site_id[:8].upper()}"

    site = Site.objects.create(
        name=name,
        code=code,
        branch=branch,                 # must be nullable if customer has no branch yet
        tpt_site_id=tpt_site_id,
        tpt_sync_status="SYNCED",
        tpt_sync_error="",
    )
    return site, True

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def assign_customer_to_site(request):
    try:
        # Read the fields sent by CustomerCreation.jsx
        customer_id = request.data.get("customer_id")
        tpt_site_id = str(
            request.data.get("tpt_site_id") or ""
        ).strip()

        if not customer_id or not tpt_site_id:
            return Response(
                {
                    "status": "error",
                    "message": "customer_id and tpt_site_id are required.",
                    "received_fields": list(request.data.keys()),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 2. FIND LOCAL CUSTOMER
        try:
            customer = Customer.objects.get(pk=customer_id)
        except (Customer.DoesNotExist, ValueError, TypeError):
            return Response(
                {
                    "status": "error",
                    "message": "Customer not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # 3. FIND OR CREATE LOCAL SITE FROM THE 3TP ASSET
        try:
            site, site_created = get_or_create_local_site_from_3tp(
                request,
                tpt_site_id,
                customer,
                branch_id=request.data.get("branch_id"),
            )
        except ThreeTPError as exc:
            return Response(
                {"status": "error", "message": str(exc), "tpt_site_id": tpt_site_id},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except Site.MultipleObjectsReturned:
            return Response(
                {"status": "error",
                 "message": "Multiple local sites have the same 3TP site ID."},
                status=status.HTTP_409_CONFLICT,
            )
                
        # 4. GET 3TP IDS
        tpt_customer_id = ensure_tpt_customer_id(request, customer)

        tpt_site_id = (
            getattr(site, "tpt_site_id", None) or ""
        ).strip()

        if not tpt_customer_id:
            return Response(
                {
                    "status": "error",
                    "message": "This customer has no 3TP customer ID."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not tpt_site_id:
            return Response(
                {
                    "status": "error",
                    "message": "This site has no 3TP site ID."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 5. CHECK EXISTING LOCAL MAPPING
        existing_mapping = CustomerSiteMapping.objects.filter(
            customer=customer,
            site=site,
        ).first()

        if existing_mapping and existing_mapping.is_active:
            return Response(
                {
                    "status": "success",
                    "message": "Customer is already mapped to this site.",
                    "data": {
                        "customer_id": str(customer.id),
                        "site_id": str(site.id),
                        "tpt_customer_id": tpt_customer_id,
                        "tpt_site_id": tpt_site_id,
                    },
                },
                status=status.HTTP_200_OK,
            )

        # 6. MAP CUSTOMER TO SITE IN 3TP
        if not _raw_token(request):
            return Response(
                {"status": "error", "message": "Authorization token is required."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        
            try:
                headers = _tpt_service_headers()
                response = requests.post(
                    f"{CLOUD_URL}/api/customer/{tpt_customer_id}/asset/{tpt_site_id}",
                    headers=headers,
                    timeout=15,
                )
            except ThreeTPError as exc:
                return Response(
                    {
                        "status": "error",
                        "message": "3TP service-account authentication failed.",
                        "details": str(exc),
                    },
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            except requests.RequestException as exc:
                return Response(
                    {
                        "status": "error",
                        "message": "Unable to connect to 3TP.",
                        "details": str(exc),
                    },
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            
        # --------------------------------------------------
        # 7. SAVE LOCAL MAPPING AFTER 3TP SUCCESS
        # --------------------------------------------------
        mapping, created = CustomerSiteMapping.objects.update_or_create(
            customer=customer,
            site=site,
            defaults={"is_active": True},
        )

        return Response(
            {
                "status": "success",
                "message": "Customer mapped to site successfully.",
                "data": {
                    "mapping_id": str(mapping.id),
                    "customer_id": str(customer.id),
                    "customer_name": customer.company,
                    "site_id": str(site.id),
                    "site_name": site.name,
                    "tpt_customer_id": tpt_customer_id,
                    "tpt_site_id": tpt_site_id,
                },
            },
            status=status.HTTP_200_OK if not created
            else status.HTTP_201_CREATED,
        )

    except Exception as exc:
        import logging
        logging.getLogger(__name__).exception(
            "Customer-to-site mapping failed"
        )

        return Response(
            {
                "status": "error",
                "message": "Customer-to-site mapping failed.",
                "details": str(exc),
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ai_dashboard_analysis(request):
    return Response("Ai Dashboard")


# @api_view(["POST"])
# @permission_classes([IsAuthenticated])
# def ai_dashboard_analysis(request):
#     """
#     Generate one combined AI analysis for the AC dashboard.

#     Request:
#     {
#         "dashboard_data": {
#             "totalACs": 1,
#             "activeACs": 1,
#             "totalEnergy": 2652.0,
#             "activeEnergy": 2652.0,
#             "activePower": 1.5,
#             "averageTemperature": 32.1,
#             "averageHumidity": 43.4,
#             "alerts": 0,
#             "records": 1,
#             "historyPoints": 3
#         }
#     }
#     """

#     dashboard_data = request.data.get("dashboard_data")

#     if not isinstance(dashboard_data, dict) or not dashboard_data:
#         return Response(
#             {
#                 "status": "error",
#                 "message": "dashboard_data must be a non-empty JSON object."
#             },
#             status=status.HTTP_400_BAD_REQUEST
#         )

#     # Configure these environment variables for your installation.
#     ollama_url = os.getenv(
#         "OLLAMA_API_URL",
#         "http://localhost:11434/api/generate"
#     )
#     # ollama_model = os.getenv("OLLAMA_MODEL", "llama3.2")
#     ollama_model = os.getenv("OLLAMA_MODEL", "llama3.1:8b")

#     required_keys = [
#         "totalACs",
#         "activeACs",
#         "totalEnergy",
#         "activeEnergy",
#         "activePower",
#         "averageTemperature",
#         "averageHumidity",
#         "alerts",
#         "records",
#         "historyPoints",
#     ]

#     # Keep only the dashboard fields expected by this endpoint.
#     data = {
#         key: dashboard_data[key]
#         for key in required_keys
#         if key in dashboard_data
#     }

#     prompt = f"""
# You are an AC energy monitoring analyst.

# Analyze the dashboard data below:
# {json.dumps(data, ensure_ascii=False)}

# Return ONLY a valid JSON object with these exact keys:
# totalEnergy, activeEnergy, totalACs, activeACs, activePower,
# temperature, humidity, alerts, energyChart, healthChart,
# humidityChart, powerChart, zoneChart, temperatureChart.

# Requirements:
# 1. Each value must be a concise explanation, maximum two sentences.
# 2. Explain actual values and meaningful changes using supplied data.
# 3. Do not invent historical trends, causes, rankings, or thresholds.
# 4. If historical or zone-level data is missing, say that a comparison
#    cannot be determined from the supplied data.
# 5. Do not claim an AC is healthy unless its health status is provided.
# 6. Distinguish missing readings from actual zero readings.
# 7. Keep the language simple and suitable for a dashboard summary.
# 8. Return JSON only, without Markdown or additional commentary.
# """

#     try:
#         ollama_response = requests.post(
#             ollama_url,
#             json={
#                 "model": ollama_model,
#                 "prompt": prompt,
#                 "stream": False,
#                 "format": "json",
#                 "options": {
#                     "temperature": 0.2
#                 }
#             },
#             timeout=60
#         )

#         ollama_response.raise_for_status()
#         result = ollama_response.json()

#         generated_text = result.get("response", "").strip()

#         if not generated_text:
#             return Response(
#                 {
#                     "status": "error",
#                     "message": "The AI model returned an empty response."
#                 },
#                 status=status.HTTP_502_BAD_GATEWAY
#             )

#         insights = json.loads(generated_text)

#         if not isinstance(insights, dict):
#             raise ValueError("AI response must be a JSON object.")

#         expected_keys = [
#             "totalEnergy",
#             "activeEnergy",
#             "totalACs",
#             "activeACs",
#             "activePower",
#             "temperature",
#             "humidity",
#             "alerts",
#             "energyChart",
#             "healthChart",
#             "humidityChart",
#             "powerChart",
#             "zoneChart",
#             "temperatureChart",
#         ]

#         # Validate and normalize the model output.
#         clean_insights = {}

#         for key in expected_keys:
#             value = insights.get(key, "")

#             clean_insights[key] = (
#                 value.strip()
#                 if isinstance(value, str)
#                 else ""
#             )

#         return Response(
#             {
#                 "status": "success",
#                 "insights": clean_insights
#             },
#             status=status.HTTP_200_OK
#         )

#     except requests.exceptions.Timeout:
#         return Response(
#             {
#                 "status": "error",
#                 "message": "The AI model timed out. Please try again."
#             },
#             status=status.HTTP_504_GATEWAY_TIMEOUT
#         )

#     except requests.exceptions.RequestException:
#         return Response(
#             {
#                 "status": "error",
#                 "message": (
#                     "Unable to connect to Ollama. "
#                     "Check that Ollama is running and the model is available."
#                 )
#             },
#             status=status.HTTP_503_SERVICE_UNAVAILABLE
#         )

#     except (json.JSONDecodeError, ValueError):
#         return Response(
#             {
#                 "status": "error",
#                 "message": "The AI model returned an invalid JSON response."
#             },
#             status=status.HTTP_502_BAD_GATEWAY
#         )




# My current view

import json
import os
import time
import threading
import traceback
import hashlib

from django.core import serializers
from django.db.models import Q

from django.views.decorators.csrf import csrf_exempt

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

# from .cloud_sync import provision_customer, provision_user

from .cloud_sync import (
    provision_customer,
    provision_user,
    # sync_customer,
    # sync_site,
    # sync_device,
    # link_3tp_device_to_site,
    # create_3tp_device,
    # ThreeTPError,
    # ThreeTPAPIError,
)


from .access_scope import device_customer, site_customer
from .hierarchy_tree_sync import sync_branch_to_tree
from .models import (
    CustomerDeviceMapping,
    SiteDeviceMapping,
    CustomerSiteMapping,
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
    ACDeviceSerializer,
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
# from backend.account import serializers

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
    """Customer's id; if missing (legacy row) find it in 3TP by email and save it."""
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
            raise ThreeTPAPIError(f"Cloud Error: {_one_line(exc)}")

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

# def fetch_3tp_sites(request=None):
#     """
#     Fetch sites/assets directly from 3TP.

#     3TP is the source of truth for site inventory.
#     """

#     sites = []

#     page = 0
#     total_pages = 1

#     while page < total_pages:

#         response, data = _tpt_request(
#             "GET",
#             "site",
#             payload=None,
#         )

#         if response is None:
#             raise ThreeTPError(
#                 "Unable to fetch sites from 3TP."
#             )

#         if not isinstance(data, dict):
#             raise ThreeTPError(
#                 "Invalid site response received from 3TP.",
#                 payload=data,
#             )

#         rows = data.get("data", [])

#         if isinstance(rows, list):
#             sites.extend(rows)

#         total_pages = data.get(
#             "totalPages",
#             1
#         )

#         page += 1

#     return sites


def fetch_3tp_sites(request=None):

    sites = []

    page = 0
    total_pages = 1

    while page < total_pages:

        response, data = _tpt_request(
            "GET",
            "site",
            params={
                "pageSize": 1000,
                "page": page,
                "sortProperty": "createdTime",
                "sortOrder": "DESC",
            },
        )

        if not isinstance(data, dict):

            raise ThreeTPError(
                "Invalid sites response from 3TP.",
                payload=data,
            )

        rows = data.get(
            "data",
            []
        )

        if isinstance(rows, list):
            sites.extend(rows)

        total_pages = data.get(
            "totalPages",
            1
        )

        page += 1

    return sites

# =====================================================================
# CREATE BRANCH / FLOOR FROM FULL HIERARCHY
# =====================================================================

@api_view(["POST"])
def create_branch_or_floor(request):
    user = request.user

    # ---------------------------------------------------------------
    # PERMISSION
    # ---------------------------------------------------------------
    if user.role not in (Role.ORG_SUPER_ADMIN, Role.CUSTOMER):
        return JsonResponse(
            {
                "success": False,
                "message": "You are not allowed to create locations."
            },
            status=403,
        )

    try:
        body = request.data
    except Exception:
        body = {}

    hierarchy = str(
        body.get("hierarchy_type", "")
    ).strip().upper()

    location_type = str(
        body.get("location_type", "")
    ).strip().upper()

    if hierarchy not in ("GEOGRAPHICAL", "ZONAL"):
        return JsonResponse(
            {
                "success": False,
                "message": "hierarchy_type must be GEOGRAPHICAL or ZONAL."
            },
            status=400,
        )

    if location_type not in ("BRANCH", "FLOOR"):
        return JsonResponse(
            {
                "success": False,
                "message": "location_type must be BRANCH or FLOOR."
            },
            status=400,
        )

    # ---------------------------------------------------------------
    # CUSTOMER HIERARCHY VALIDATION
    # ---------------------------------------------------------------

    if user.role == Role.CUSTOMER:

        if not user.customer_id:
            return JsonResponse(
                {
                    "success": False,
                    "message": "Your account has no customer."
                },
                status=403,
            )

        customer_hierarchy = getattr(
            user.customer,
            "hierarchy_type",
            None
        )

        if (
            customer_hierarchy
            and customer_hierarchy != hierarchy
        ):
            return JsonResponse(
                {
                    "success": False,
                    "message": (
                        f"Your account uses the "
                        f"{customer_hierarchy.title()} hierarchy."
                    ),
                },
                status=403,
            )

    # ---------------------------------------------------------------
    # LOAD TREE
    # ---------------------------------------------------------------

    location_file = (
        ZONAL_LOCATION_FILE
        if hierarchy == "ZONAL"
        else GEOGRAPHICAL_LOCATION_FILE
    )

    try:
        tree = load_location_tree(location_file)
    except Exception as exc:
        return JsonResponse(
            {
                "success": False,
                "message": f"Unable to load location tree: {exc}"
            },
            status=500,
        )

    # ===============================================================
    # ZONAL
    # ===============================================================

    if hierarchy == "ZONAL":

        zone_name = str(
            body.get("zone_name", "")
        ).strip()

        circle_name = str(
            body.get("circle_name", "")
        ).strip()

        region_name = str(
            body.get("region_name", "")
        ).strip()

        division_name = str(
            body.get("division_name", "")
        ).strip()

        branch_name = str(
            body.get("branch_name", "")
        ).strip()

        floor_name = str(
            body.get("floor_name", "")
        ).strip()

        # -----------------------------------------------------------
        # VALIDATE PARENT HIERARCHY
        # -----------------------------------------------------------

        required = {
            "zone_name": zone_name,
            "circle_name": circle_name,
            "region_name": region_name,
            "division_name": division_name,
        }

        missing = [
            key
            for key, value in required.items()
            if not value
        ]

        if location_type in ("BRANCH", "FLOOR"):

            if not branch_name:
                missing.append("branch_name")

        if location_type == "FLOOR" and not floor_name:
            missing.append("floor_name")

        if missing:
            return JsonResponse(
                {
                    "success": False,
                    "message": (
                        "Missing required field(s): "
                        + ", ".join(missing)
                    ),
                },
                status=400,
            )

        # -----------------------------------------------------------
        # ZONE
        # -----------------------------------------------------------

        zone = next(
            (
                z for z in tree
                if z.get("zone_name", "").strip().lower()
                == zone_name.lower()
            ),
            None,
        )

        if zone is None:

            zone_ids = {
                z.get("zone_id", "")
                for z in tree
            }

            zone = {
                "zone_id": make_code_id(
                    zone_ids,
                    zone_name,
                    prefix="ZN-",
                ),
                "zone_name": zone_name,
                "circles": [],
            }

            tree.append(zone)

        # -----------------------------------------------------------
        # CIRCLE
        # -----------------------------------------------------------

        circle = next(
            (
                c
                for c in zone.get("circles", [])
                if c.get("circle_name", "").strip().lower()
                == circle_name.lower()
            ),
            None,
        )

        if circle is None:

            circle_ids = {
                c.get("circle_id", "")
                for z in tree
                for c in z.get("circles", [])
            }

            circle = {
                "circle_id": make_code_id(
                    circle_ids,
                    circle_name,
                    prefix=f"{zone['zone_id']}-C",
                ),
                "circle_name": circle_name,
                "regions": [],
            }

            zone.setdefault(
                "circles",
                []
            ).append(circle)

        # -----------------------------------------------------------
        # REGION
        # -----------------------------------------------------------

        region = next(
            (
                r
                for r in circle.get("regions", [])
                if r.get("region_name", "").strip().lower()
                == region_name.lower()
            ),
            None,
        )

        if region is None:

            region_ids = {
                r.get("region_id", "")
                for z in tree
                for c in z.get("circles", [])
                for r in c.get("regions", [])
            }

            region = {
                "region_id": make_code_id(
                    region_ids,
                    region_name,
                    prefix=f"{circle['circle_id']}-R",
                ),
                "region_name": region_name,
                "divisions": [],
            }

            circle.setdefault(
                "regions",
                []
            ).append(region)

        # -----------------------------------------------------------
        # DIVISION
        # -----------------------------------------------------------

        division = next(
            (
                d
                for d in region.get("divisions", [])
                if d.get("division_name", "").strip().lower()
                == division_name.lower()
            ),
            None,
        )

        if division is None:

            division_ids = {
                d.get("division_id", "")
                for z in tree
                for c in z.get("circles", [])
                for r in c.get("regions", [])
                for d in r.get("divisions", [])
            }

            division = {
                "division_id": make_code_id(
                    division_ids,
                    division_name,
                    prefix=f"{region['region_id']}-D",
                ),
                "division_name": division_name,
                "branches": [],
            }

            region.setdefault(
                "divisions",
                []
            ).append(division)

        # -----------------------------------------------------------
        # BRANCH
        # -----------------------------------------------------------

        branch = next(
            (
                b
                for b in division.get("branches", [])
                if b.get("branch_name", "").strip().lower()
                == branch_name.lower()
            ),
            None,
        )

        if location_type == "BRANCH":

            if branch is not None:
                return JsonResponse(
                    {
                        "success": False,
                        "message": (
                            f"Branch '{branch_name}' "
                            "already exists in this hierarchy."
                        ),
                    },
                    status=409,
                )

            branch_index = len(
                division.get("branches", [])
            ) + 1

            branch = {
                "branch_id": (
                    f"{division['division_id']}"
                    f"-B{branch_index:02d}"
                ),
                "branch_name": branch_name,
                "floors": [],
                "sites": [],
            }

            division.setdefault(
                "branches",
                []
            ).append(branch)

            save_location_tree(
                tree,
                location_file
            )

            return JsonResponse(
                {
                    "success": True,
                    "message": "Branch created successfully.",
                    "hierarchy_type": hierarchy,
                    "location_type": "BRANCH",
                    "data": {
                        "zone_id": zone["zone_id"],
                        "zone_name": zone["zone_name"],
                        "circle_id": circle["circle_id"],
                        "circle_name": circle["circle_name"],
                        "region_id": region["region_id"],
                        "region_name": region["region_name"],
                        "division_id": division["division_id"],
                        "division_name": division["division_name"],
                        "branch_id": branch["branch_id"],
                        "branch_name": branch["branch_name"],
                    },
                },
                status=201,
            )

        # -----------------------------------------------------------
        # FLOOR
        # -----------------------------------------------------------

        if branch is None:
            return JsonResponse(
                {
                    "success": False,
                    "message": (
                        f"Branch '{branch_name}' "
                        "does not exist."
                    ),
                },
                status=404,
            )

        existing_floor = next(
            (
                f
                for f in branch.get("floors", [])
                if f.get("floor_name", "").strip().lower()
                == floor_name.lower()
            ),
            None,
        )

        if existing_floor is not None:
            return JsonResponse(
                {
                    "success": False,
                    "message": (
                        f"Floor '{floor_name}' "
                        "already exists in this branch."
                    ),
                },
                status=409,
            )

        floor_index = len(
            branch.get("floors", [])
        ) + 1

        floor = {
            "floor_id": (
                f"{branch['branch_id']}"
                f"-F{floor_index:02d}"
            ),
            "floor_name": floor_name,
            "sites": [],
        }

        branch.setdefault(
            "floors",
            []
        ).append(floor)

        save_location_tree(
            tree,
            location_file
        )

        return JsonResponse(
            {
                "success": True,
                "message": "Floor created successfully.",
                "hierarchy_type": hierarchy,
                "location_type": "FLOOR",
                "data": {
                    "zone_id": zone["zone_id"],
                    "zone_name": zone["zone_name"],
                    "circle_id": circle["circle_id"],
                    "circle_name": circle["circle_name"],
                    "region_id": region["region_id"],
                    "region_name": region["region_name"],
                    "division_id": division["division_id"],
                    "division_name": division["division_name"],
                    "branch_id": branch["branch_id"],
                    "branch_name": branch["branch_name"],
                    "floor_id": floor["floor_id"],
                    "floor_name": floor["floor_name"],
                },
            },
            status=201,
        )

    # ===============================================================
    # GEOGRAPHICAL
    # ===============================================================

    state_name = str(
        body.get("state_name", "")
    ).strip()

    district_name = str(
        body.get("district_name", "")
    ).strip()

    taluka_name = str(
        body.get("taluka_name", "")
    ).strip()

    city_name = str(
        body.get("city_name", "")
    ).strip()

    branch_name = str(
        body.get("branch_name", "")
    ).strip()

    floor_name = str(
        body.get("floor_name", "")
    ).strip()

    required = {
        "state_name": state_name,
        "district_name": district_name,
        "taluka_name": taluka_name,
        "city_name": city_name,
        "branch_name": branch_name,
    }

    missing = [
        key
        for key, value in required.items()
        if not value
    ]

    if location_type == "FLOOR" and not floor_name:
        missing.append("floor_name")

    if missing:
        return JsonResponse(
            {
                "success": False,
                "message": (
                    "Missing required field(s): "
                    + ", ".join(missing)
                ),
            },
            status=400,
        )

    # ---------------------------------------------------------------
    # STATE
    # ---------------------------------------------------------------

    state = next(
        (
            s
            for s in tree
            if s.get("state_name", "").strip().lower()
            == state_name.lower()
        ),
        None,
    )

    if state is None:

        state_ids = {
            s.get("state_id", "")
            for s in tree
        }

        state = {
            "state_id": make_code_id(
                state_ids,
                state_name,
            ),
            "state_name": state_name,
            "districts": [],
        }

        tree.append(state)

    # ---------------------------------------------------------------
    # DISTRICT
    # ---------------------------------------------------------------

    district = next(
        (
            d
            for d in state.get("districts", [])
            if d.get("district_name", "").strip().lower()
            == district_name.lower()
        ),
        None,
    )

    if district is None:

        district_index = len(
            state.get("districts", [])
        ) + 1

        district = {
            "district_id": (
                f"{state['state_id']}"
                f"-D{district_index:02d}"
            ),
            "district_name": district_name,
            "talukas": [],
        }

        state.setdefault(
            "districts",
            []
        ).append(district)

    # ---------------------------------------------------------------
    # TALUKA
    # ---------------------------------------------------------------

    taluka = next(
        (
            t
            for t in district.get("talukas", [])
            if t.get("taluka_name", "").strip().lower()
            == taluka_name.lower()
        ),
        None,
    )

    if taluka is None:

        taluka_index = len(
            district.get("talukas", [])
        ) + 1

        taluka = {
            "taluka_id": (
                f"{district['district_id']}"
                f"-T{taluka_index:02d}"
            ),
            "taluka_name": taluka_name,
            "cities": [],
        }

        district.setdefault(
            "talukas",
            []
        ).append(taluka)

    # ---------------------------------------------------------------
    # CITY
    # ---------------------------------------------------------------

    city = next(
        (
            c
            for c in taluka.get("cities", [])
            if c.get("city_name", "").strip().lower()
            == city_name.lower()
        ),
        None,
    )

    if city is None:

        city_index = len(
            taluka.get("cities", [])
        ) + 1

        city = {
            "city_id": (
                f"{taluka['taluka_id']}"
                f"-C{city_index:02d}"
            ),
            "city_name": city_name,
            "branches": [],
        }

        taluka.setdefault(
            "cities",
            []
        ).append(city)

    # ---------------------------------------------------------------
    # BRANCH
    # ---------------------------------------------------------------

    branch = next(
        (
            b
            for b in city.get("branches", [])
            if b.get("branch_name", "").strip().lower()
            == branch_name.lower()
        ),
        None,
    )

    if location_type == "BRANCH":

        if branch is not None:
            return JsonResponse(
                {
                    "success": False,
                    "message": (
                        f"Branch '{branch_name}' "
                        "already exists in this hierarchy."
                    ),
                },
                status=409,
            )

        branch_index = len(
            city.get("branches", [])
        ) + 1

        branch = {
            "branch_id": (
                f"{city['city_id']}"
                f"-B{branch_index:02d}"
            ),
            "branch_name": branch_name,
            "floors": [],
            "sites": [],
        }

        city.setdefault(
            "branches",
            []
        ).append(branch)

        save_location_tree(
            tree,
            location_file
        )

        return JsonResponse(
            {
                "success": True,
                "message": "Branch created successfully.",
                "hierarchy_type": hierarchy,
                "location_type": "BRANCH",
                "data": {
                    "state_id": state["state_id"],
                    "state_name": state["state_name"],
                    "district_id": district["district_id"],
                    "district_name": district["district_name"],
                    "taluka_id": taluka["taluka_id"],
                    "taluka_name": taluka["taluka_name"],
                    "city_id": city["city_id"],
                    "city_name": city["city_name"],
                    "branch_id": branch["branch_id"],
                    "branch_name": branch["branch_name"],
                },
            },
            status=201,
        )

    # ---------------------------------------------------------------
    # FLOOR
    # ---------------------------------------------------------------

    if branch is None:
        return JsonResponse(
            {
                "success": False,
                "message": (
                    f"Branch '{branch_name}' "
                    "does not exist."
                ),
            },
            status=404,
        )

    existing_floor = next(
        (
            f
            for f in branch.get("floors", [])
            if f.get("floor_name", "").strip().lower()
            == floor_name.lower()
        ),
        None,
    )

    if existing_floor is not None:
        return JsonResponse(
            {
                "success": False,
                "message": (
                    f"Floor '{floor_name}' "
                    "already exists in this branch."
                ),
            },
            status=409,
        )

    floor_index = len(
        branch.get("floors", [])
    ) + 1

    floor = {
        "floor_id": (
            f"{branch['branch_id']}"
            f"-F{floor_index:02d}"
        ),
        "floor_name": floor_name,
        "sites": [],
    }

    branch.setdefault(
        "floors",
        []
    ).append(floor)

    save_location_tree(
        tree,
        location_file
    )

    return JsonResponse(
        {
            "success": True,
            "message": "Floor created successfully.",
            "hierarchy_type": hierarchy,
            "location_type": "FLOOR",
            "data": {
                "state_id": state["state_id"],
                "state_name": state["state_name"],
                "district_id": district["district_id"],
                "district_name": district["district_name"],
                "taluka_id": taluka["taluka_id"],
                "taluka_name": taluka["taluka_name"],
                "city_id": city["city_id"],
                "city_name": city["city_name"],
                "branch_id": branch["branch_id"],
                "branch_name": branch["branch_name"],
                "floor_id": floor["floor_id"],
                "floor_name": floor["floor_name"],
            },
        },
        status=201,
    )

def _site_row(site):
    """One site as the Sites / assignment pages expect it, with its full hierarchy path."""
    ctx = resolve_site_hierarchy(site)
    owner = site_customer(site)
    branch = site.branch if site.branch_id else None
    return {
        "id": str(site.pk),
        "local_site_id": str(site.pk),
        "tpt_site_id": site.tpt_site_id or "",
        # the assign call accepts either the 3TP id or the local id
        "asset_id": site.tpt_site_id or str(site.pk),
        "name": site.name,
        "code": site.code,
        "asset_type": "SITE",
        "address": site.address or "",
        "customer_id": str(owner.pk) if owner else "",
        "customer_name": owner.company if owner else "",
        "hierarchy_type": ctx.get("hierarchy_type", ""),
        "state_name": ctx.get("state_name", ""),
        "district_name": ctx.get("district_name", ""),
        "taluka_name": ctx.get("taluka_name", ""),
        "city_name": ctx.get("city_name", ""),
        "zone_name": ctx.get("zone_name", ""),
        "circle_name": ctx.get("circle_name", ""),
        "region_name": ctx.get("region_name", ""),
        "division_name": ctx.get("division_name", ""),
        "branch_id": str(branch.pk) if branch else "",
        "branch_code": branch.code if branch else "",
        "branch_name": ctx.get("branch_name", ""),
        "floor_id": str(site.floor_id) if site.floor_id else "",
        "floor_name": ctx.get("floor_name", ""),
        "sync_status": site.tpt_sync_status,
        "acs": [
            {
                "ac_id": d.ac_id,
                "device_name": d.device_name or d.ac_id,
                "status": d.status,
            }
            for d in site.ac_devices.all()
        ],
    }


def _local_site_list(request, customer_param=None):
    """Sites the user may see (optionally narrowed to one customer), with hierarchy."""
    user = request.user
    qs = accessible_sites(user)

    if customer_param:
        try:
            customer_pk = int(customer_param)
        except (TypeError, ValueError):
            customer_pk = None
        if customer_pk is None:
            return Response(
                {"status": "error", "message": "Invalid customer."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        qs = qs.filter(
            Q(branch__customer_id=customer_pk)
            | Q(customer_mappings__customer_id=customer_pk,
                customer_mappings__is_active=True)
        )

    sites = [_site_row(site) for site in qs.distinct().order_by("name")]

    return Response(
        {
            "status": "success",
            "count": len(sites),
            "total_pages": 1,
            "total_elements": len(sites),
            "sites": sites,
        },
        status=status.HTTP_200_OK,
    )


def _merge_local_site_details(user, cloud_sites, include_unsynced):
    """
    The 3TP asset list knows nothing about our hierarchy. Fill in every
    site that exists locally (State..Branch/Floor, customer, ACs) and, on the
    first page, append locally created sites that 3TP does not have yet.
    """
    local = {
        s.tpt_site_id: s
        for s in accessible_sites(user).filter(tpt_site_id__isnull=False).exclude(tpt_site_id="")
    }

    for row in cloud_sites:
        site = local.get(row.get("tpt_site_id"))
        if site is None:
            continue
        details = _site_row(site)
        for key in ("id", "tpt_site_id", "asset_id", "name", "asset_type"):
            details.pop(key, None)
        # keep whatever 3TP already supplied for these when it is non-empty
        for key in ("code", "address"):
            if row.get(key):
                details.pop(key, None)
        row.update(details)

    if include_unsynced:
        for site in (
            accessible_sites(user)
            .filter(Q(tpt_site_id__isnull=True) | Q(tpt_site_id=""))
            .distinct()
            .order_by("name")
        ):
            cloud_sites.append(_site_row(site))

    return cloud_sites


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def three_tp_sites(request):
    """
    Fetch Sites directly from 3TP.

    Local Django Site table is NOT used for the Super Admin's full list.

    Customers / admins - and the Super Admin when ?customer=<local id> is
    given (e.g. assigning a device that already has a customer) - get the
    sites of the allowed customer(s) only, straight from the local database.
    """

    customer_param = request.query_params.get("customer")
    if request.user.role != Role.ORG_SUPER_ADMIN or customer_param:
        return _local_site_list(request, customer_param)

    try:
        page_size = int(
            request.query_params.get(
                "pageSize",
                1000
            )
        )

        page = int(
            request.query_params.get(
                "page",
                0
            )
        )

        response = requests.get(
            f"{CLOUD_URL}/api/tenant/assets",
            params={
                "pageSize": page_size,
                "page": page,
                "sortProperty": "createdTime",
                "sortOrder": "DESC",
            },
            headers=_tpt_user_headers(request),
            timeout=20,
        )

        if response.status_code != 200:
            return Response(
                {
                    "status": "error",
                    "message": "Unable to fetch Sites from 3TP.",
                    "details": response.text,
                },
                status=response.status_code,
            )

        data = response.json()

        assets = data.get(
            "data",
            []
        )

        sites = []

        for asset in assets:

            asset_id = (
                asset.get("id", {}).get("id")
                if isinstance(
                    asset.get("id"),
                    dict
                )
                else asset.get("id")
            )

            asset_name = (
                asset.get("name")
                or asset.get("title")
                or ""
            )

            asset_type = (
                asset.get("assetType")
                or asset.get("type")
                or ""
            )

            # -------------------------------------------------
            # ONLY SITE ASSETS
            # -------------------------------------------------

            if str(asset_type).upper() not in {
                "SITE",
                "SITE_ASSET",
                "DEFAULT",
            }:
                continue

            sites.append(
                {
                    "id": asset_id,

                    "tpt_site_id": asset_id,

                    "name": asset_name,

                    "code": (
                        asset.get("code")
                        or asset.get("label")
                        or ""
                    ),

                    "asset_type": asset_type,

                    "address": (
                        asset.get("address")
                        or ""
                    ),

                    "created_time": (
                        asset.get("createdTime")
                    ),

                    "updated_time": (
                        asset.get("updatedTime")
                    ),

                    # These may be populated later
                    # from 3TP attributes.
                    "state_name": "",
                    "district_name": "",
                    "taluka_name": "",
                    "city_name": "",

                    "zone_name": "",
                    "circle_name": "",
                    "region_name": "",
                    "division_name": "",

                    "branch_name": "",
                    "floor_name": "",

                    "acs": [],
                }
            )

        sites = _merge_local_site_details(
            request.user, sites, include_unsynced=(page == 0)
        )

        return Response(
            {
                "status": "success",

                "count": len(sites),

                "total_pages": data.get(
                    "totalPages",
                    1
                ),

                "total_elements": data.get(
                    "totalElements",
                    len(sites)
                ),

                "sites": sites,
            },
            status=status.HTTP_200_OK,
        )

    except requests.RequestException as exc:

        return Response(
            {
                "status": "error",
                "message": "3TP server connection failed.",
                "details": str(exc),
            },
            status=status.HTTP_502_BAD_GATEWAY,
        )

    except Exception as exc:

        return Response(
            {
                "status": "error",
                "message": "Unable to fetch Sites from 3TP.",
                "details": str(exc),
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

def map_3tp_customer_to_device(request, tpt_customer_id, tpt_device_id):
    r = requests.post(
        f"{CLOUD_URL}/api/customer/{tpt_customer_id}/device/{tpt_device_id}",
        headers=_tpt_user_headers(request),
        timeout=15,
    )

    if r.status_code not in (200, 201, 204):
        raise ThreeTPError(
            f"Mapping customer to device failed: {r.text}",
            status=r.status_code,
            payload=r.text,
        )

    return True

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
            # "authority": getattr(settings, "TPT_ADMIN_AUTHORITY", "TENANT_ADMIN"),
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


def _tpt_service_headers():
    """Authenticate 3TP API calls with the configured 3TP service account."""
    token = _tpt_service_login()

    return {
        "Authorization": f"Bearer {token}",
        "X-Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


# def _tpt_request(method, endpoint_key, payload=None,
#                  extra_headers=None, raise_on_error=True):
#     if not _tpt_enabled():
#         return None, None

#     base_url = _tpt_base_url()
#     if not base_url:
#         if raise_on_error:
#             raise ThreeTPError("TPT_BASE_URL is not configured.")
#         return None, None

#     token = _tpt_service_login()
#     url   = f"{base_url}{TPT_ENDPOINTS.get(endpoint_key, endpoint_key)}"

#     headers = {
#         "Content-Type":  "application/json",
#         "Accept":        "application/json",
#         "Authorization": f"Bearer {token}",
#     }
#     if extra_headers:
#         headers.update(extra_headers)

#     try:
#         response = requests.request(
#             method.upper(), url,
#             json=payload, headers=headers, timeout=_tpt_timeout(),
#         )
#     except requests.RequestException as exc:
#         if raise_on_error:
#             raise ThreeTPError(f"3TP network error ({endpoint_key}): {exc}")
#         return None, None

#     try:
#         data = response.json()
#     except ValueError:
#         data = None

#     if raise_on_error and response.status_code not in (200, 201, 202, 204):
#         detail = ""
#         if isinstance(data, dict):
#             detail = data.get("message") or data.get("detail") or ""
#         raise ThreeTPError(
#             f"3TP {endpoint_key} failed ({response.status_code}) {detail}".strip(),
#             status=response.status_code,
#             payload=data,
#         )

#     return response.status_code, data


def _tpt_request(
    method,
    endpoint_key,
    payload=None,
    params=None,
    extra_headers=None,
    raise_on_error=True,
):
    if not _tpt_enabled():
        return None, None

    base_url = _tpt_base_url()

    if not base_url:
        if raise_on_error:
            raise ThreeTPError(
                "TPT_BASE_URL is not configured."
            )

        return None, None

    token = _tpt_service_login()

    url = (
        f"{base_url}"
        f"{TPT_ENDPOINTS.get(endpoint_key, endpoint_key)}"
    )

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": f"Bearer {token}",
    }

    if extra_headers:
        headers.update(extra_headers)

    try:

        response = requests.request(
            method.upper(),
            url,
            json=payload,
            params=params,
            headers=headers,
            timeout=_tpt_timeout(),
        )

    except requests.RequestException as exc:

        if raise_on_error:
            raise ThreeTPError(
                f"3TP network error ({endpoint_key}): {exc}"
            )

        return None, None

    try:
        data = response.json()
    except ValueError:
        data = None

    if raise_on_error and response.status_code not in (
        200,
        201,
        202,
        204,
    ):

        detail = ""

        if isinstance(data, dict):
            detail = (
                data.get("message")
                or data.get("detail")
                or ""
            )

        raise ThreeTPError(
            (
                f"3TP {endpoint_key} failed "
                f"({response.status_code}) "
                f"{detail}"
            ).strip(),

            status=response.status_code,
            payload=data,
        )

    return response, data

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


def _has_field(model, name):
    return any(f.name == name for f in model._meta.get_fields())


def get_3tp_device_profile_id(request):
    res = requests.get(f"{CLOUD_URL}/api/deviceProfiles",
                       params={"pageSize": 10, "page": 0},
                       headers=_tpt_user_headers(request), timeout=15)
    if res.status_code != 200:
        raise ThreeTPError("Failed to fetch device profiles.", status=res.status_code,
                           payload=res.text)
    profiles = res.json().get("data", [])
    if not profiles:
        raise ThreeTPError("No device profile found in 3TP.")
    default = next((p for p in profiles if p.get("default")), profiles[0])
    return default["id"]["id"]


def find_3tp_device_by_name(request, name):
    res = requests.get(f"{CLOUD_URL}/api/tenant/devices", params={"deviceName": name},
                       headers=_tpt_user_headers(request), timeout=15)
    return res.json() if res.status_code == 200 else None


def delete_3tp_device(request, tpt_device_id):
    try:
        r = requests.delete(f"{CLOUD_URL}/api/device/{tpt_device_id}",
                            headers=_tpt_user_headers(request), timeout=15)
        return r.status_code in (200, 204, 404)
    except requests.RequestException:
        return False


def create_3tp_device(request, *, name, label, tpt_customer_id,
                      client_id, username, password, latitude=None, longitude=None):
    """Create device (MQTT_BASIC) -> assign to customer -> save attributes.
    Returns (tpt_device_id, created_new)."""
    headers = _tpt_user_headers(request)
    created_new = True

    res = requests.post(
        f"{CLOUD_URL}/api/device-with-credentials", headers=headers, timeout=15,
        json={
            "device": {
                "name": name, "label": label or name,
                "deviceProfileId": {"id": get_3tp_device_profile_id(request),
                                    "entityType": "DEVICE_PROFILE"},
            },
            "credentials": {
                "credentialsType": "MQTT_BASIC",
                "credentialsValue": json.dumps({"clientId": client_id,
                                                "userName": username,
                                                "password": password}),
            },
        },
    )

    if res.status_code == 400 and "already exists" in res.text:
        # orphan from an earlier failed attempt: reuse it if it has no local record
        existing = find_3tp_device_by_name(request, name)
        existing_id = _id_of(existing) if existing else ""
        if (not existing_id
                or (_has_field(ACDevice, "tpt_device_id")
                    and ACDevice.objects.filter(tpt_device_id=existing_id).exists())):
            raise ThreeTPError(f"A device named '{name}' already exists in 3TP.")
        tpt_device_id, created_new = existing_id, False
    elif res.status_code not in (200, 201):
        raise ThreeTPError(f"3TP device creation failed: {res.text}", status=res.status_code)
    else:
        tpt_device_id = _id_of(res.json())

    if not tpt_device_id:
        raise ThreeTPError("3TP did not return a device id.")

    try:
        r = requests.post(f"{CLOUD_URL}/api/customer/{tpt_customer_id}/device/{tpt_device_id}",
                          headers=headers, timeout=15)
        if r.status_code not in (200, 201):
            raise ThreeTPError(f"Assigning device to customer failed: {r.text}",
                               status=r.status_code)

        attrs = {k: v for k, v in {"latitude": latitude, "longitude": longitude}.items()
                 if v not in (None, "")}
        if attrs:
            requests.post(
                f"{CLOUD_URL}/api/plugins/telemetry/DEVICE/{tpt_device_id}/SERVER_SCOPE",
                json=attrs, headers=headers, timeout=15)
    except Exception:
        if created_new:
            delete_3tp_device(request, tpt_device_id)
        raise

    return tpt_device_id, created_new


def link_3tp_device_to_site(request, tpt_asset_id, tpt_device_id):
    """ASSET --Contains--> DEVICE, same as the old assign_device_to_site."""
    r = requests.post(
        f"{CLOUD_URL}/api/relation", headers=_tpt_user_headers(request), timeout=15,
        json={"from": {"entityType": "ASSET", "id": tpt_asset_id},
              "to": {"entityType": "DEVICE", "id": tpt_device_id},
              "type": "Contains", "typeGroup": "COMMON"},
    )
    if r.status_code not in (200, 201):
        raise ThreeTPError(f"Linking device to site failed: {r.text}", status=r.status_code)


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
        states = tree
        if isinstance(tree, list):
            country = next((n for n in tree if isinstance(n, dict) and isinstance(n.get("states"), list)), None)
            if country:
                states = country["states"]
        for state in states:
            for district in state.get("districts", []):
                for taluka in district.get("talukas", []):
                    # New form: branch is a direct child of Taluka.
                    for branch in taluka.get("branches", []):
                        context = {
                            "hierarchy_type": "GEOGRAPHICAL",
                            "state_id": state.get("state_id", ""),
                            "state_name": state.get("state_name", ""),
                            "district_id": district.get("district_id", ""),
                            "district_name": district.get("district_name", ""),
                            "taluka_id": taluka.get("taluka_id", ""),
                            "taluka_name": taluka.get("taluka_name", ""),
                            "city_id": "", "city_name": "",
                            "branch_id": branch.get("branch_id", ""),
                            "branch_name": branch.get("branch_name", ""),
                        }
                        yield branch, context
                    # Backward compatibility: old branches under City remain supported.
                    for city in taluka.get("cities", []):
                        for branch in city.get("branches", []):
                            context = {
                                "hierarchy_type": "GEOGRAPHICAL",
                                "state_id": state.get("state_id", ""),
                                "state_name": state.get("state_name", ""),
                                "district_id": district.get("district_id", ""),
                                "district_name": district.get("district_name", ""),
                                "taluka_id": taluka.get("taluka_id", ""),
                                "taluka_name": taluka.get("taluka_name", ""),
                                "city_id": city.get("city_id", ""),
                                "city_name": city.get("city_name", ""),
                                "branch_id": branch.get("branch_id", ""),
                                "branch_name": branch.get("branch_name", ""),
                            }
                            yield branch, context

    elif hierarchy_type == "ZONAL":
        zones = tree
        if isinstance(tree, list):
            country = next((n for n in tree if isinstance(n, dict) and isinstance(n.get("zones"), list)), None)
            if country:
                zones = country["zones"]
        for zone in zones:
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
# AUTOMATIC HIERARCHY RESOLUTION FOR A SITE
# =====================================================================
def resolve_site_hierarchy(site):
    """
    Derive the full hierarchy chain of a Site from the database, so a device
    assigned to the site automatically lands in that hierarchy (no manual /
    hardcoded values).

        GEOGRAPHICAL: State -> District -> Taluka -> City -> Branch (-> Floor)
        ZONAL:        Zone  -> Circle   -> Region -> Division -> Branch (-> Floor)

    Returns the flat context dict the device-location map and the hierarchy
    filters expect (state_name, district_name, ... branch_id, floor_name).
    `branch_id` is the id of the matching branch node in the location tree
    (found by walking the tree by name) so tree lookups keep working; the
    database id is kept in `db_branch_id`. Returns {} if the site has no branch
    or the branch has no hierarchy parent.
    """
    branch = getattr(site, "branch", None)
    if branch is None:
        return {}

    ctx = {}
    body = {}

    if branch.city_id:
        city     = branch.city
        taluka   = city.taluka
        district = taluka.district
        state    = district.state
        hierarchy = "GEOGRAPHICAL"
        ctx.update({
            "state_id": str(state.id),       "state_name": state.name,
            "district_id": str(district.id), "district_name": district.name,
            "taluka_id": str(taluka.id),     "taluka_name": taluka.name,
            "city_id": str(city.id),         "city_name": city.name,
        })
        body = {
            "state_name": state.name, "district_name": district.name,
            "taluka_name": taluka.name, "city_name": city.name,
            "branch_name": branch.name,
        }
    elif branch.division_id:
        division = branch.division
        region   = division.region
        circle   = region.circle
        zone     = circle.zone
        hierarchy = "ZONAL"
        ctx.update({
            "zone_id": str(zone.id),         "zone_name": zone.name,
            "circle_id": str(circle.id),     "circle_name": circle.name,
            "region_id": str(region.id),     "region_name": region.name,
            "division_id": str(division.id), "division_name": division.name,
        })
        body = {
            "zone_name": zone.name, "circle_name": circle.name,
            "region_name": region.name, "division_name": division.name,
            "branch_name": branch.name,
        }
    else:
        return {}

    ctx["hierarchy_type"] = hierarchy
    ctx["branch_name"]    = branch.name
    ctx["db_branch_id"]   = str(branch.id)

    # Prefer the location-tree branch id so nodes_for_mapping() can find it.
    tree_branch_id = str(branch.id)
    try:
        tree = load_location_tree(ownership.tree_file(hierarchy))
        # Prefer the node written for this exact branch (id == branch code);
        # fall back to matching by name for older, hand-made trees.
        node = next(
            (n for n, _ in iter_branches(tree, hierarchy)
             if str(n.get("branch_id", "")) == str(branch.code)),
            None,
        ) or ownership.find_branch_by_path(tree, hierarchy, body)
        if node and node.get("branch_id"):
            tree_branch_id = node["branch_id"]
    except Exception:
        pass
    ctx["branch_id"] = tree_branch_id

    if site.floor_id:
        ctx["floor_id"]   = str(site.floor_id)
        ctx["floor_name"] = site.floor.name
    else:
        ctx["floor_id"]   = ""
        ctx["floor_name"] = ""

    return ctx


def place_device_in_tree(ac_id, site, ctx, device_fields):
    """
    Put the device under the site's branch/floor node of the location tree
    (same shape the legacy flow writes), removing any previous placement.
    Failures here never block the assignment; the DB + device map are the
    authoritative record.
    """
    hierarchy = ctx.get("hierarchy_type")
    if hierarchy not in ("GEOGRAPHICAL", "ZONAL"):
        return
    location_file = (
        GEOGRAPHICAL_LOCATION_FILE if hierarchy == "GEOGRAPHICAL" else ZONAL_LOCATION_FILE
    )
    # Clean all prior placements in BOTH hierarchy files first. An AC moved
    # between branches or hierarchy types must not remain in its old branch.
    remove_device_from_location_trees(
        ac_id,
        tpt_device_id=device_fields.get("tpt_device_id", ""),
        site_id=getattr(site, "id", ""),
    )

    tree = load_location_tree(location_file)
    target = find_location_target(tree, hierarchy, branch_id=ctx.get("branch_id", ""))
    if not target:
        return

    branch = target["branch"]
    floor_node = None
    if ctx.get("floor_name"):
        floor_node = next(
            (f for f in branch.get("floors", [])
             if str(f.get("floor_name", "")).strip().lower()
             == ctx["floor_name"].strip().lower()),
            None,
        )

    # Keep the AC identifier and 3TP UUID in the tree. FilterDashboard
    # needs the 3TP UUID for selection, while ac_id supports legacy records.
    entry = {
        "ac_id": ac_id,
        "tpt_device_id": device_fields.get("tpt_device_id", ""),
        "device_id": device_fields.get("tpt_device_id", ""),
        "id": device_fields.get("tpt_device_id", "") or ac_id,
        "site_id": ac_id,  # legacy key retained for existing consumers
        **device_fields,
    }
    holder = floor_node if floor_node is not None else branch
    if not isinstance(holder.get("sites"), list):
        holder["sites"] = []
    holder["sites"].append(entry)
    save_location_tree(tree, location_file)


def apply_site_hierarchy_to_device(device):
    """
    Re-derive a device's hierarchy placement from the site it is assigned to
    and persist it (device map + location tree). Call after setting
    `device.site`. Returns the hierarchy context ({} if none).
    """
    site = device.site
    if site is None:
        return {}
    ctx = resolve_site_hierarchy(site)
    if not ctx:
        return {}

    customer = site.branch.customer if site.branch_id else None
    device_map = build_device_location_map()
    mapping = dict(device_map.get(device.ac_id, {}))
    mapping.update({
        "ac_id": device.ac_id,
        "site_id": str(site.id),
        "site_name": site.name,
        "site_code": site.code,
        "device_name": device.device_name or device.ac_id,
        "status": device.status,
        "capacity_ton": device.capacity_ton,
        "installation_date": device.installation_date.isoformat() if device.installation_date else "",
        "last_maintenance_date": (
            device.last_maintenance_date.isoformat() if device.last_maintenance_date else ""
        ),
        "customer_id": str(customer.id) if customer else "",
        "customer_name": customer.company if customer else "",
        "location_type": "FLOOR" if ctx.get("floor_id") else "DIRECT_BRANCH",
    })
    mapping.update(ctx)
    device_map[device.ac_id] = mapping
    save_device_location_map(device_map)

    try:
        place_device_in_tree(
            device.ac_id, site, ctx,
            {
                "device_name": mapping["device_name"],
                "ac_id": device.ac_id,
                "tpt_device_id": device.tpt_device_id or "",
                "device_id": device.tpt_device_id or "",
                "status": device.status,
                "capacity_ton": device.capacity_ton,
                "installation_date": mapping["installation_date"],
                "last_maintenance_date": mapping["last_maintenance_date"],
            },
        )
    except Exception:
        pass
    return ctx


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

    # Explicit admin assignment is authoritative and lets a contact-person
    # admin see their allocated devices even when legacy tree ownership metadata
    # has not yet been refreshed.
    if db_device and user.role == Role.BR_ADMIN:
        if db_device.assigned_admin_id:
            return db_device.assigned_admin_id == user.pk
        branch_admin_id = (
            db_device.branch.assigned_admin_id
            if db_device.branch_id and db_device.branch else None
        )
        if branch_admin_id:
            return branch_admin_id == user.pk

    # A device explicitly assigned to a customer belongs to that customer
    # only, whether or not it has been placed on a site yet.
    if db_device and user.role == Role.CUSTOMER:
        owners = set(
            CustomerDeviceMapping.objects
            .filter(device=db_device, is_active=True)
            .values_list("customer_id", flat=True)
        )
        if owners:
            return user.customer_id in owners

    if db_device and db_device.site_id:
        site = db_device.site

        if not site.branch_id:
            return False

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
    visible = [r for r in records if user_can_see_ac(user, r.get("ac_id", ""), device_map, idx)]
    if user.role == Role.BR_ADMIN:
        allocated_to_other_admins = set(
            ACDevice.objects.filter(assigned_admin__isnull=False)
            .exclude(assigned_admin=user).values_list("ac_id", flat=True)
        )
        visible = [r for r in visible if str(r.get("ac_id", "")) not in allocated_to_other_admins]
    return visible


@api_view(["GET", "POST"])
def devices(request):
    try:
        if request.method == "GET":
            return get_3tp_devices(request)
        return _devices_impl(request)
    except ThreeTPError as exc:
        return JsonResponse(
            {
                "status": "error",
                "message": str(exc),
                "details": getattr(
                    exc,
                    "payload",
                    None
                ),
            },
            status=getattr(
                exc,
                "status",
                None
            ) or 502,
        )
    except Exception as exc:
        return JsonResponse(
            {
                "status": "error",
                "message": (
                    f"{type(exc).__name__}: {exc}"
                ),
                "traceback":
                    traceback.format_exc().splitlines(),
            },
            status=500,
        )

def fetch_3tp_devices(request):
    devices = []
    page = 0
    total_pages = 1

    while page < total_pages:

        response = requests.get(
            f"{CLOUD_URL}/api/tenant/devices",
            params={
                "pageSize": 1000,
                "page": page,
                "sortProperty": "createdTime",
                "sortOrder": "DESC",
            },
            headers=_tpt_user_headers(request),
            timeout=15,
        )

        if response.status_code != 200:
            raise ThreeTPError(
                "Failed to fetch devices from 3TP.",
                status=response.status_code,
                payload=response.text,
            )

        data = response.json()

        devices.extend(
            data.get("data", [])
        )

        total_pages = data.get(
            "totalPages",
            1
        )

        page += 1

    return devices

    
_DEVICE_SELECT = (
    "site",
    "site__branch",
    "site__branch__customer",
    "site__floor",
)


def _local_device_row(device, cloud_item=None):
    """One /devices/ row for a local ACDevice (customer comes from the mapping)."""
    cloud_item = cloud_item or {}
    site = device.site if device.site_id else None  # legacy fallback only
    branch = device.branch if device.branch_id else (site.branch if site and site.branch_id else None)
    customer = branch.customer if branch and branch.customer_id else device_customer(device)
    profile = cloud_item.get("deviceProfileId") or {}

    return {
        "id": str(device.tpt_device_id or device.pk),
        "local_device_id": str(device.pk),
        "tpt_device_id": device.tpt_device_id or "",
        "ac_id": device.ac_id,
        "device_name": device.device_name,
        "label": cloud_item.get("label") or device.device_name,
        "device_profile_id": profile.get("id") if isinstance(profile, dict) else "",
        "site_id": str(site.pk) if site else "",
        "site_name": site.name if site else "",
        "site_code": site.code if site else "",
        "branch_id": str(branch.pk) if branch else "",
        "branch_name": branch.name if branch else "",
        "customer_id": str(customer.pk) if customer else "",
        "customer_name": customer.company if customer else "",
        "tpt_customer_id": (customer.tpt_customer_id or "") if customer else "",
        "assigned_admin": str(device.assigned_admin_id or ""),
        "assigned_admin_name": device.assigned_admin.name if device.assigned_admin_id else "",
        "assigned_admin_email": device.assigned_admin.email if device.assigned_admin_id else "",
        "floor_id": str(site.floor_id) if site and site.floor_id else "",
        "floor_name": site.floor.name if site and site.floor_id else "",
        "status": "ASSIGNED" if branch else "UNASSIGNED",
        "local_sync_status": device.tpt_sync_status,
        "local_sync_error": device.tpt_sync_error,
    }


def get_3tp_devices(request):
    """
    Devices visible to the logged-in user.

    Super Admin  -> every 3TP device (+ local-only devices).
    Everyone else-> only devices in their own scope: a customer sees the
                    devices assigned to that customer (directly, or through
                    its sites); admins/engineers see devices on their sites.
    """
    user = request.user
    is_org = user.role == Role.ORG_SUPER_ADMIN

    try:
        cloud_devices = fetch_3tp_devices(request)
    except Exception:
        # The local database remains usable when 3TP is unavailable.
        cloud_devices = []

    visible_ids = None
    if not is_org:
        visible_ids = set(accessible_devices(user).values_list("pk", flat=True))

    result = []
    seen_local_ids = set()

    for item in cloud_devices:
        device_id = _id_of(item)
        if not device_id:
            continue

        local_device = (
            ACDevice.objects
            .select_related(*_DEVICE_SELECT)
            .filter(tpt_device_id=device_id)
            .first()
        )

        if local_device is not None:
            if visible_ids is not None and local_device.pk not in visible_ids:
                continue
            seen_local_ids.add(local_device.pk)
            result.append(_local_device_row(local_device, item))
            continue

        # Exists only in 3TP (no local record yet): only the Super Admin
        # may see it, so it can be assigned to a customer.
        if not is_org:
            continue

        name = item.get("name") or item.get("label") or ""
        profile = item.get("deviceProfileId") or {}
        result.append({
            "id": device_id,
            "tpt_device_id": device_id,
            "ac_id": name,
            "device_name": name,
            "label": item.get("label") or "",
            "device_profile_id": profile.get("id") if isinstance(profile, dict) else "",
            "site_id": "", "site_name": "", "site_code": "",
            "branch_id": "", "branch_name": "",
            "customer_id": "", "customer_name": "",
            "floor_id": "", "floor_name": "",
            "status": "UNASSIGNED",
        })

    for device in accessible_devices(user).select_related(*_DEVICE_SELECT):
        if device.pk in seen_local_ids:
            continue
        result.append(_local_device_row(device))

    return JsonResponse(
        {
            "status": "success",
            "count": len(result),
            "data": result,
        },
        status=200,
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

        # Automatically place the device in the site's hierarchy
        # (State/District/Taluka/City or Zone/Circle/Region/Division + Branch/Floor).
        hierarchy_ctx = resolve_site_hierarchy(site_obj)
        if hierarchy_ctx:
            mapping.update(hierarchy_ctx)
            hierarchy_type = hierarchy_ctx["hierarchy_type"]
            mapping["hierarchy_type"] = hierarchy_type
            mapping["location_type"] = "FLOOR" if hierarchy_ctx.get("floor_id") else "DIRECT_BRANCH"

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
                    removed = remove_site_from_tree(old_tree, old_site_id)
                    if old_site_id != ac_id:
                        removed = remove_site_from_tree(old_tree, ac_id) or removed
                    if removed:
                        save_location_tree(old_tree, old_file)
                except Exception:
                    pass

        device_map[ac_id] = mapping
        save_device_location_map(device_map)

        if hierarchy_ctx:
            try:
                place_device_in_tree(
                    ac_id, site_obj, hierarchy_ctx,
                    {
                        "device_name": device_name,
                        "status": status_val,
                        "capacity_ton": capacity_ton,
                        "installation_date": installation_date,
                        "last_maintenance_date": last_maintenance_date,
                    },
                )
            except Exception:
                pass  # tree placement is best-effort; DB + device map are authoritative

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

    def fetch_3tp_devices(request):
        """
        Fetch devices directly from 3TP.

        IMPORTANT:
        This does NOT read:
            data/ac_data.json
            DeviceLocationMap.json
            telemetry cache

        3TP is the source of truth for device inventory.
        """

        devices = []
        page = 0
        total_pages = 1

        while page < total_pages:
            response = requests.get(
                f"{CLOUD_URL}/api/tenant/devices",
                params={
                    "pageSize": 1000,
                    "page": page,
                    "sortProperty": "createdTime",
                    "sortOrder": "DESC",
                },
                headers=_tpt_user_headers(request),
                timeout=15,
            )

            if response.status_code != 200:
                raise ThreeTPError(
                    "Failed to fetch devices from 3TP.",
                    status=response.status_code,
                    payload=response.text,
                )

            data = response.json()

            devices.extend(data.get("data", []))

            total_pages = data.get("totalPages", 1)
            page += 1

        return devices


# =====================================================================
# LOCATIONS  (tree)
# =====================================================================
def _scoped_tree(location_file, user, customer_id=None, hierarchy=None):
    """
    Location tree for the logged-in user.

    * With ?customer_id= (the hierarchy PICKER used to create a branch or
      assign a site): the full hierarchy catalogue is returned - never pruned -
      with only that customer's branches (plus unowned ones) kept.  A customer
      login always gets its own customer, whatever id is sent.  If the JSON
      catalogue is empty, the customer's hierarchy is built from the database.
    * Without it (dashboard filter): the user's ownership-scoped tree, as before.
    """
    tree = load_location_tree(location_file)

    picker_customer = None
    if customer_id not in (None, ""):
        if user.role == Role.CUSTOMER:
            picker_customer = Customer.objects.filter(pk=user.customer_id).first()
        elif user.role == Role.ORG_SUPER_ADMIN:
            try:
                picker_customer = Customer.objects.filter(
                    pk=int(customer_id), organization_id=user.organization_id
                ).first()
            except (TypeError, ValueError):
                picker_customer = None

    if picker_customer is not None:
        wanted = picker_customer.pk
        tree = ownership.filter_branches_only(
            tree, lambda n: n.get("customer_id") in (None, "", wanted)
        )
        if hierarchy and ownership.tree_has_no_locations(tree):
            from .hierarchy_tree_sync import db_location_tree
            tree = db_location_tree(hierarchy, picker_customer)
        return ownership.attach_owner_details(tree)

    tree = ownership.filter_tree_for_user(tree, user)
    return ownership.attach_owner_details(tree)


def _empty_picker_message(request, data):
    """Explain an empty picker instead of leaving the page to guess."""
    if data or not request.GET.get("customer_id"):
        return ""
    return (
        "This customer has no hierarchy locations yet. Load them with: "
        "python manage.py seed_location_hierarchy --customer <customer code> "
        "--json <hierarchy file>"
    )


def _locations_impl(request):
    if request.method == "GET":
        hierarchy = request.GET.get("hierarchy", "").strip().upper()

        try:
            if hierarchy == "GEOGRAPHICAL":
                data = _scoped_tree(GEOGRAPHICAL_LOCATION_FILE, request.user,
                                    request.GET.get("customer_id"), "GEOGRAPHICAL")
                return JsonResponse(
                    {"success": True, "hierarchy_type": "GEOGRAPHICAL", "data": data, "count": len(data), "message": _empty_picker_message(request, data)},
                    safe=True,
                )

            if hierarchy == "ZONAL":
                data = _scoped_tree(ZONAL_LOCATION_FILE, request.user,
                                    request.GET.get("customer_id"), "ZONAL")
                return JsonResponse(
                    {"success": True, "hierarchy_type": "ZONAL", "data": data, "count": len(data), "message": _empty_picker_message(request, data)},
                    safe=True,
                )

            geographical_data = _scoped_tree(GEOGRAPHICAL_LOCATION_FILE, request.user,
                                             request.GET.get("customer_id"))
            zonal_data        = _scoped_tree(ZONAL_LOCATION_FILE, request.user,
                                             request.GET.get("customer_id"))

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

# FILTERING AND ENRICHMENT HELPERS
def matches(value, selected):
    if not selected:
        return True
    return str(value).strip().lower() == str(selected).strip().lower()


GEOGRAPHICAL_FIELDS = [
    "state_id", "state_name",
    "district_id", "district_name",
    "taluka_id", "taluka_name",
    "city_id", "city_name",
    "branch_id", "branch_name",
    "floor_id", "floor_name",
    "site_id",
]

ZONAL_FIELDS = [
    "zone_id", "zone_name",
    "circle_id", "circle_name",
    "region_id", "region_name",
    "division_id", "division_name",
    "branch_id", "branch_name",
    "floor_id", "floor_name",
    "site_id",
]


# def resolve_ac_location(ac_id, device_map):
#     mapping = device_map.get(ac_id, {})

#     if not mapping:
#         return {
#             "geographical": {}, "zonal": {}, "site_id": "",
#             "device_name": "", "location_type": "", "hierarchy_type": "",
#         }

#     if "geographical" in mapping or "zonal" in mapping:
#         geo = mapping.get("geographical") or {}
#         zon = mapping.get("zonal") or {}
#         hierarchy_type = str(mapping.get("hierarchy_type", "")).upper()
#         return {
#             "geographical": geo, "zonal": zon,
#             "site_id": mapping.get("site_id", ""),
#             "device_name": mapping.get("device_name", ""),
#             "location_type": mapping.get("location_type", ""),
#             "hierarchy_type": hierarchy_type,
#         }

#     hierarchy_type = str(mapping.get("hierarchy_type", "")).upper()
#     geo, zon = {}, {}
#     if hierarchy_type == "GEOGRAPHICAL":
#         geo = {f: mapping.get(f, "") for f in GEOGRAPHICAL_FIELDS}
#     elif hierarchy_type == "ZONAL":
#         zon = {f: mapping.get(f, "") for f in ZONAL_FIELDS}

#     return {
#         "geographical": geo, "zonal": zon,
#         "site_id": mapping.get("site_id", ""),
#         "device_name": mapping.get("device_name", ""),
#         "location_type": mapping.get("location_type", ""),
#         "hierarchy_type": hierarchy_type,
#     }



def resolve_ac_location(ac_id, device_map):
    # Prefer the actual database relationships over a stale JSON map.
    try:
        device = (
            ACDevice.objects
            .select_related(
                "branch__taluka__district__state",
                "branch__city__taluka__district__state",
                "branch__division__region__circle__zone",
                "site__branch__taluka__district__state",
                "site__branch__city__taluka__district__state",
                "site__branch__division__region__circle__zone",
                "site__floor",
            )
            .filter(ac_id=ac_id)
            .first()
        )

        if device:
            branch = device.branch
            site = device.site

            if branch is None and site is not None:
                branch = site.branch

            if branch is not None:
                geo, zon = {}, {}
                hierarchy_type = ""

                if branch.city_id or branch.taluka_id:
                    if branch.city_id:
                        city = branch.city
                        taluka = city.taluka
                        city_id = str(city.id)
                        city_name = city.name
                    else:
                        taluka = branch.taluka
                        city_id = ""
                        city_name = ""

                    district = taluka.district
                    state = district.state

                    geo = {
                        "state_id": str(state.id),
                        "state_name": state.name,
                        "district_id": str(district.id),
                        "district_name": district.name,
                        "taluka_id": str(taluka.id),
                        "taluka_name": taluka.name,
                        "city_id": city_id,
                        "city_name": city_name,
                        "branch_id": str(branch.id),
                        "branch_name": branch.name,
                        "floor_id": (
                            str(site.floor_id)
                            if site and site.floor_id else ""
                        ),
                        "floor_name": (
                            site.floor.name
                            if site and site.floor_id else ""
                        ),
                    }
                    hierarchy_type = "GEOGRAPHICAL"

                elif branch.division_id:
                    division = branch.division
                    region = division.region
                    circle = region.circle
                    zone = circle.zone

                    zon = {
                        "zone_id": str(zone.id),
                        "zone_name": zone.name,
                        "circle_id": str(circle.id),
                        "circle_name": circle.name,
                        "region_id": str(region.id),
                        "region_name": region.name,
                        "division_id": str(division.id),
                        "division_name": division.name,
                        "branch_id": str(branch.id),
                        "branch_name": branch.name,
                        "floor_id": (
                            str(site.floor_id)
                            if site and site.floor_id else ""
                        ),
                        "floor_name": (
                            site.floor.name
                            if site and site.floor_id else ""
                        ),
                    }
                    hierarchy_type = "ZONAL"

                if hierarchy_type:
                    return {
                        "geographical": geo,
                        "zonal": zon,
                        "site_id": str(site.id) if site else "",
                        "device_name": device.device_name or device.ac_id,
                        "location_type": (
                            "FLOOR"
                            if site and site.floor_id
                            else "BRANCH"
                        ),
                        "hierarchy_type": hierarchy_type,
                    }

    except Exception:
        # Preserve legacy JSON fallback if DB resolution fails.
        import logging
        logging.getLogger(__name__).exception(
            "Database location resolution failed for AC %s", ac_id
        )

    # Legacy mapping fallback.
    mapping = device_map.get(ac_id, {})

    if not mapping:
        return {
            "geographical": {},
            "zonal": {},
            "site_id": "",
            "device_name": "",
            "location_type": "",
            "hierarchy_type": "",
        }

    if "geographical" in mapping or "zonal" in mapping:
        geo = mapping.get("geographical") or {}
        zon = mapping.get("zonal") or {}
    else:
        hierarchy_type = str(
            mapping.get("hierarchy_type", "")
        ).upper()

        geo = (
            {f: mapping.get(f, "") for f in GEOGRAPHICAL_FIELDS}
            if hierarchy_type == "GEOGRAPHICAL" else {}
        )
        zon = (
            {f: mapping.get(f, "") for f in ZONAL_FIELDS}
            if hierarchy_type == "ZONAL" else {}
        )

    return {
        "geographical": geo,
        "zonal": zon,
        "site_id": mapping.get("site_id", ""),
        "device_name": mapping.get("device_name", ""),
        "location_type": mapping.get("location_type", ""),
        "hierarchy_type": str(
            mapping.get("hierarchy_type", "")
        ).upper(),
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
    selected_device_id = (
        request.GET.get("device_id") or request.GET.get("selectedDeviceId")
        or request.GET.get("device") or ""
    ).strip()
    selected_ac_id = (request.GET.get("ac_id") or "").strip()

    if not any([hierarchy, zone, state, district, taluka, circle,
                region, division, city, branch, floor, selected_device_id, selected_ac_id]):
        return data

    device_map = build_device_location_map()

    def keep(record):
        ac_id = str(record.get("ac_id", "") or "").strip()
        loc   = resolve_ac_location(ac_id, device_map)

        # A specific AC selection narrows the returned telemetry rows to that AC.
        if selected_ac_id and ac_id.casefold() != selected_ac_id.casefold():
            return False
        if selected_device_id:
            mapped = device_map.get(ac_id, {}) or {}
            known_ids = {
                str(ac_id).strip(),
                str(mapped.get("tpt_device_id", "") or "").strip(),
                str(mapped.get("device_id", "") or "").strip(),
                str(mapped.get("thingsboard_device_id", "") or "").strip(),
            }
            known_ids.discard("")
            if selected_device_id not in known_ids:
                return False
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
    ac_id = record.get("ac_id", "")
    device_info = device_map.get(ac_id, {}) or {}
    loc = resolve_ac_location(ac_id, device_map) or {}
    geographical = loc.get("geographical") or {}
    zonal = loc.get("zonal") or {}

    enriched.update(geographical)
    enriched.update(zonal)

    if loc.get("site_id"):
        enriched["site_id"] = loc["site_id"]
    if loc.get("device_name"):
        enriched["device_name"] = loc["device_name"]

    enriched["location_type"] = loc.get("location_type", "")
    enriched["hierarchy_type"] = loc.get("hierarchy_type", "")

    branch_ref = (
        device_info.get("branch_id")
        or geographical.get("branch_id")
        or zonal.get("branch_id")
    )
    branch_obj = None
    if branch_ref:
        try:
            branch_obj = Branch.objects.filter(pk=branch_ref).first()
        except (ValueError, TypeError, DjangoValidationError):
            branch_obj = None
        if branch_obj is None:
            branch_obj = Branch.objects.filter(code__iexact=str(branch_ref)).first()

    if branch_obj is None:
        branch_name = (
            geographical.get("branch_name")
            or zonal.get("branch_name")
            or device_info.get("branch_name")
        )
        if branch_name:
            customer_ref = device_info.get("customer_id")
            branch_query = Branch.objects.filter(name__iexact=str(branch_name))
            if customer_ref:
                branch_query = branch_query.filter(customer_id=customer_ref)
            branch_obj = branch_query.first()

    latitude = branch_obj.latitude if branch_obj and branch_obj.latitude is not None else device_info.get("latitude")
    longitude = branch_obj.longitude if branch_obj and branch_obj.longitude is not None else device_info.get("longitude")
    enriched["latitude"] = float(latitude) if latitude not in (None, "") else None
    enriched["longitude"] = float(longitude) if longitude not in (None, "") else None

    return enriched

# DATA VIEWS
@api_view(["GET"])
def ac_data_with_location(request):
    try:
        data = get_telemetry_records()
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
        data = get_telemetry_records()
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
        data = scope_ac_records(get_telemetry_records(), request.user)
        if not data:
            return JsonResponse({"status": "success", "data": None})
        return JsonResponse({"status": "success", "data": data[-1]})
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)


# AUTH VIEWS
def get_client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _dashboard_path(role):
    return {
        Role.ORG_SUPER_ADMIN: "/org/dashboard",
        Role.CUSTOMER:        "/dashboard",
        Role.BR_ADMIN:        "/admin/dashboard",
        Role.ENGINEER:        "/engineer/dashboard",
    }.get(role, "/login")


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    email          = (request.data.get("email") or "").strip().lower()
    password       = request.data.get("password") or ""
    # requested_role = (request.data.get("role") or "").strip()

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

        # ---- NEW: enforce login page restriction ----
        login_type = (request.data.get("login_type") or "").strip().lower()
        SUPER_ADMIN_ROLE = "ORG_SUPER_ADMIN"   # adjust if your role value differs

        if login_type == "superadmin" and user.role != SUPER_ADMIN_ROLE:
            return Response(
                {"status": "error",
                "message": "Invalid Credentials"
                },
                status=403,
            )

        if login_type == "user" and user.role == SUPER_ADMIN_ROLE:
            return Response(
                {"status": "error",
                "message": "Invalid Credentials"
                # "message": "Super admins must use the super admin login page."
                },
                status=403,
            )
        # ---- END NEW ----

        # ---- 3. Save login info ----
        user.last_login    = timezone.now()
        user.last_login_ip = get_client_ip(request)
        user.save(update_fields=["last_login", "last_login_ip"])

        django_login(request, user)
        # ... rest of the view unchanged ...

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

# ORGANIZATION
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
                # Every customer receives its own hierarchy nodes based on the
                # selected type. This runs inside the local transaction so a
                # failed hierarchy initialization cannot leave a partial customer.
                initialize_customer_hierarchy(customer)

                # Customer account remains available at company_email. If a
                # distinct contact-person email is supplied, create a dedicated
                # BR_ADMIN login for that person and assign new branches/devices
                # to this account by default.
                admin = User(name=contact_person or company, email=company_email, phone=phone,
                             role=Role.CUSTOMER, organization=user.organization,
                             customer=customer, is_active=True)
                admin.set_password(raw_password)
                admin.save()

                contact_email = (d.get("contact_person_email") or "").strip().lower()
                customer_admin = admin
                if contact_email and contact_email != company_email:
                    if User.objects.filter(email__iexact=contact_email).exists():
                        raise ValueError("Contact person email is already used by another user.")
                    customer_admin = User(
                        name=contact_person or company,
                        email=contact_email,
                        phone=phone,
                        role=Role.BR_ADMIN,
                        organization=user.organization,
                        customer=customer,
                        is_active=True,
                    )
                    customer_admin.set_password(request.data.get("admin_password") or raw_password)
                    customer_admin.save()

                # The hierarchy initializer creates the customer's branch
                # records before either login exists. Attach those initial
                # branches now that the contact-person admin is available.
                Branch.objects.filter(
                    customer=customer, assigned_admin__isnull=True
                ).update(assigned_admin=customer_admin)
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
                "customer_admin": {
                    "name": customer_admin.name,
                    "email": customer_admin.email,
                    "role": customer_admin.role,
                    "initial_password": request.data.get("admin_password") or raw_password,
                },
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
    
# GEOGRAPHICAL / ZONAL LIST VIEWS

class CountryListAPIView(generics.ListAPIView):
    serializer_class = CountrySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Country.objects.filter(
            is_active=True
        ).order_by("name")


class ZoneListView(generics.ListAPIView):
    serializer_class = ZoneSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Zone.objects.select_related("customer")

        if not user.is_authenticated:
            return qs.none()

        if user.role == Role.ORG_SUPER_ADMIN:
            qs = qs.filter(
                customer__organization_id=user.organization_id
            )

        elif user.role in (
            Role.CUSTOMER,
            Role.BR_ADMIN,
            Role.ENGINEER,
        ):
            qs = qs.filter(customer_id=user.customer_id)

        else:
            return qs.none()

        # Optional customer filter, used by AdminCreation.jsx.
        customer_id = self.request.query_params.get("customer")
        if customer_id:
            qs = qs.filter(customer_id=customer_id)

        return qs.order_by("name")

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


# class BranchListView(generics.ListAPIView):
#     serializer_class = BranchSerializer
#     permission_classes = [permissions.IsAuthenticated]

#     def get_queryset(self):
#         user = self.request.user

#         qs = Branch.objects.select_related(
#             "customer",

#             # Geographical
#             "city",
#             "city__taluka",
#             "city__taluka__district",
#             "city__taluka__district__state",

#             # Zonal
#             "division",
#             "division__region",
#             "division__region__circle",
#             "division__region__circle__zone",
#         )

#         # =====================================================
#         # USER ACCESS
#         # =====================================================

#         if user.role == Role.ORG_SUPER_ADMIN:

#             qs = qs.filter(
#                 customer__organization_id=user.organization_id
#             )

#         elif user.role == Role.CUSTOMER:

#             qs = qs.filter(
#                 customer_id=user.customer_id
#             )

#         elif user.role == Role.BR_ADMIN:

#             hierarchy = (
#                 getattr(user.customer, "hierarchy_type", None)
#                 if user.customer_id
#                 else None
#             )

#             if hierarchy == "GEOGRAPHICAL" and user.state_id:

#                 qs = qs.filter(
#                     customer_id=user.customer_id,
#                     city__taluka__district__state_id=user.state_id,
#                 )

#             elif hierarchy == "ZONAL" and user.zone_id:

#                 qs = qs.filter(
#                     customer_id=user.customer_id,
#                     division__region__circle__zone_id=user.zone_id,
#                 )

#             elif user.branch_id:

#                 qs = qs.filter(
#                     pk=user.branch_id
#                 )

#             else:

#                 return Branch.objects.none()

#         elif user.role == Role.ENGINEER:

#             if user.branch_id:
#                 qs = qs.filter(
#                     pk=user.branch_id
#                 )
#             else:
#                 return Branch.objects.none()

#         else:

#             return Branch.objects.none()

#         # =====================================================
#         # HIERARCHY FILTER
#         # =====================================================

#         hierarchy = (
#             self.request.query_params
#             .get("hierarchy", "")
#             .strip()
#             .upper()
#         )

#         if hierarchy == "GEOGRAPHICAL":

#             qs = qs.filter(
#                 city__isnull=False,
#                 division__isnull=True,
#             )

#         elif hierarchy == "ZONAL":

#             qs = qs.filter(
#                 division__isnull=False,
#                 city__isnull=True,
#             )

#         # =====================================================
#         # SEARCH
#         # =====================================================

#         search = (
#             self.request.query_params
#             .get("search", "")
#             .strip()
#         )

#         if search:

#             qs = qs.filter(
#                 Q(name__icontains=search)
#                 |
#                 Q(code__icontains=search)
#             )

#         return qs.order_by("name")


# class BranchListView(generics.ListAPIView):
#     serializer_class = BranchSerializer
#     permission_classes = [permissions.IsAuthenticated]

#     def get_queryset(self):
#         user = self.request.user

#         qs = Branch.objects.select_related(
#             "customer",
#             "city",
#             "city__taluka",
#             "city__taluka__district",
#             "city__taluka__district__state",
#             "division",
#             "division__region",
#             "division__region__circle",
#             "division__region__circle__zone",
#         )

#         # --------------------------------------------------
#         # EXISTING ROLE-BASED ACCESS
#         # --------------------------------------------------

#         if user.role == Role.ORG_SUPER_ADMIN:
#             qs = qs.filter(
#                 customer__organization_id=user.organization_id
#             )

#         elif user.role == Role.CUSTOMER:
#             qs = qs.filter(
#                 customer_id=user.customer_id
#             )

#         elif user.role == Role.BR_ADMIN:

#             hierarchy = (
#                 getattr(user.customer, "hierarchy_type", None)
#                 if user.customer_id
#                 else None
#             )

#             if hierarchy == "GEOGRAPHICAL" and user.state_id:
#                 qs = qs.filter(
#                     customer_id=user.customer_id,
#                     city__taluka__district__state_id=user.state_id,
#                 )

#             elif hierarchy == "ZONAL" and user.zone_id:
#                 qs = qs.filter(
#                     customer_id=user.customer_id,
#                     division__region__circle__zone_id=user.zone_id,
#                 )

#             elif user.branch_id:
#                 qs = qs.filter(
#                     pk=user.branch_id
#                 )

#             else:
#                 return Branch.objects.none()

#         elif user.role == Role.ENGINEER:

#             if user.branch_id:
#                 qs = qs.filter(
#                     pk=user.branch_id
#                 )
#             else:
#                 return Branch.objects.none()

#         else:
#             return Branch.objects.none()

#         # --------------------------------------------------
#         # OPTIONAL CUSTOMER FILTER
#         # --------------------------------------------------

#         customer_id = self.request.query_params.get("customer")

#         if customer_id:
#             qs = qs.filter(
#                 customer_id=customer_id
#             )

#         # --------------------------------------------------
#         # SEARCH BRANCH
#         # --------------------------------------------------

#         search = (
#             self.request.query_params
#             .get("search", "")
#             .strip()
#         )

#         if search:
#             qs = qs.filter(
#                 Q(name__icontains=search) |
#                 Q(code__icontains=search)
#             )

#         return qs.order_by("name")


class BranchListView(generics.ListCreateAPIView):
    serializer_class = BranchSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        qs = Branch.objects.select_related(
            "customer",

            # Geographical
            "city",
            "city__taluka",
            "city__taluka__district",
            "city__taluka__district__state",

            # Zonal
            "division",
            "division__region",
            "division__region__circle",
            "division__region__circle__zone",
        )

        if user.role == Role.ORG_SUPER_ADMIN:
            qs = qs.filter(
                customer__organization_id=user.organization_id
            )

        elif user.role == Role.CUSTOMER:
            qs = qs.filter(
                customer_id=user.customer_id
            )

        elif user.role == Role.BR_ADMIN:
            assigned_branch_ids = list(
                Branch.objects.filter(assigned_admin=user).values_list("pk", flat=True)
            )
            if assigned_branch_ids:
                qs = qs.filter(pk__in=assigned_branch_ids)
            else:
                hierarchy = (
                    getattr(user.customer, "hierarchy_type", None)
                    if user.customer_id else None
                )
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

            if user.branch_id:
                qs = qs.filter(
                    pk=user.branch_id
                )
            else:
                return Branch.objects.none()

        else:
            return Branch.objects.none()

        customer_id = self.request.query_params.get("customer")

        if customer_id:
            qs = qs.filter(
                customer_id=customer_id
            )

        return qs.order_by("name")

    def perform_create(self, serializer):
        user = self.request.user

        # --------------------------------------------------
        # CUSTOMER
        # --------------------------------------------------

        if user.role == Role.CUSTOMER:

            if not user.customer_id:
                raise serializers.ValidationError({
                    "customer": "Logged-in user is not linked to a customer."
                })

            branch = serializer.save(customer_id=user.customer_id)
            if not branch.assigned_admin_id:
                primary_admin = User.objects.filter(
                    customer_id=user.customer_id, role=Role.BR_ADMIN, is_active=True
                ).order_by("date_joined").first() or User.objects.filter(
                    customer_id=user.customer_id, role=Role.CUSTOMER, is_active=True
                ).order_by("date_joined").first()
                if primary_admin:
                    branch.assigned_admin = primary_admin
                    branch.save(update_fields=["assigned_admin"])
            return

        # --------------------------------------------------
        # ORGANIZATION SUPER ADMIN
        # --------------------------------------------------

        if user.role == Role.ORG_SUPER_ADMIN:

            customer_id = self.request.data.get("customer")

            if not customer_id:
                raise serializers.ValidationError({
                    "customer": "Customer is required."
                })

            try:
                customer = Customer.objects.get(
                    pk=customer_id,
                    organization_id=user.organization_id,
                )
            except Customer.DoesNotExist:
                raise serializers.ValidationError({
                    "customer": "Invalid customer."
                })

            branch = serializer.save(customer=customer)
            if not branch.assigned_admin_id:
                primary_admin = User.objects.filter(
                    customer=customer, role=Role.BR_ADMIN, is_active=True
                ).order_by("date_joined").first() or User.objects.filter(
                    customer=customer, role=Role.CUSTOMER, is_active=True
                ).order_by("date_joined").first()
                if primary_admin:
                    branch.assigned_admin = primary_admin
                    branch.save(update_fields=["assigned_admin"])
            return

        # --------------------------------------------------
        # BRANCH ADMIN
        # --------------------------------------------------

        if user.role == Role.BR_ADMIN:

            if not user.customer_id:
                raise serializers.ValidationError({
                    "customer": "Branch Admin is not linked to a customer."
                })

            serializer.save(
                customer_id=user.customer_id
            )

            return

        raise permissions.PermissionDenied(
            "You do not have permission to create a branch."
        )

class SiteListView(generics.ListCreateAPIView):
    serializer_class = SiteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = accessible_sites(self.request.user)

        params = self.request.query_params
        branch_id = params.get("branch")
        customer_id = params.get("customer")
        is_active = params.get("is_active")

        if branch_id:
            qs = qs.filter(branch_id=branch_id)

        if customer_id:
            qs = qs.filter(
                Q(branch__customer_id=customer_id)
                | Q(
                    customer_mappings__customer_id=customer_id,
                    customer_mappings__is_active=True,
                )
            )

        if is_active is not None:
            qs = qs.filter(
                is_active=str(is_active).lower() in ("1", "true", "yes")
            )

        return qs.distinct().order_by("name")
        
    def perform_create(self, serializer):
        user = self.request.user
        branch = serializer.validated_data["branch"]

        # Only allow branches inside the current user's permitted scope.
        if not accessible_branches(user).filter(pk=branch.pk).exists():
            raise DRFValidationError({
                "branch": "You cannot create a site under this branch."
            })

        if not branch.customer_id:
            raise DRFValidationError({
                "branch": "The branch must be assigned to a customer."
            })

        floor = serializer.validated_data.get("floor")
        if floor and floor.branch_id != branch.pk:
            raise DRFValidationError({
                "floor": "The selected floor does not belong to this branch."
            })

        # Save the site and customer-site mapping locally first.
        with transaction.atomic():
            site = serializer.save()

            CustomerSiteMapping.objects.update_or_create(
                customer_id=branch.customer_id,
                site=site,
                defaults={"is_active": True},
            )

        # Show the branch (+ floors) in the hierarchy filter straight away.
        sync_branch_to_tree(branch)

        # Cloud sync is separate. Do not undo the local save if it fails.
        try:
            customer = branch.customer

            # Use your existing cloud_sync functions here.
            from .cloud_sync import sync_customer, sync_site

            if not customer.tpt_customer_id:
                sync_customer(customer)

            sync_site(site)

        except Exception as exc:
            Site.objects.filter(pk=site.pk).update(
                tpt_sync_status="FAILED",
                tpt_sync_error=_one_line(exc, 2000),
            )



@api_view(["GET"])
@permission_classes([IsAuthenticated])
def search_site_branches(request):
    """
    Search branches for Site creation.

    Query:
        ?hierarchy=GEOGRAPHICAL&q=pune
        ?hierarchy=ZONAL&q=mumbai
    """

    hierarchy = (
        request.query_params.get("hierarchy", "")
        .strip()
        .upper()
    )

    query = request.query_params.get("q", "").strip()

    if hierarchy not in ["GEOGRAPHICAL", "ZONAL"]:
        return Response(
            {
                "status": "error",
                "message": "hierarchy must be GEOGRAPHICAL or ZONAL."
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    branches = Branch.objects.all()

    # ---------------------------------------------------------
    # USER SCOPE
    # ---------------------------------------------------------

    user = request.user

    if user.role == Role.CUSTOMER:
        branches = branches.filter(
            customer_id=user.customer_id
        )

    elif user.role == Role.BR_ADMIN:
        branches = branches.filter(
            id=user.branch_id
        )

    elif user.role == Role.ENGINEER:
        return Response({
            "status": "success",
            "count": 0,
            "data": []
        })

    elif user.role == Role.ORG_SUPER_ADMIN:
        # Only apply this when organization exists.
        if getattr(user, "organization_id", None):
            branches = branches.filter(
                customer__organization_id=user.organization_id
            )

    # ---------------------------------------------------------
    # HIERARCHY FILTER
    # ---------------------------------------------------------

    if hierarchy == "GEOGRAPHICAL":
        branches = branches.filter(
            city__isnull=False
        ).select_related(
            "customer",
            "city",
            "city__taluka",
            "city__taluka__district",
            "city__taluka__district__state",
        )

    else:
        branches = branches.filter(
            division__isnull=False
        ).select_related(
            "customer",
            "division",
            "division__region",
            "division__region__circle",
            "division__region__circle__zone",
        )

    # ---------------------------------------------------------
    # SEARCH
    # ---------------------------------------------------------

    if query:
        branches = branches.filter(
            Q(name__icontains=query) |
            Q(code__icontains=query)
        )

    branches = branches.order_by("name")[:50]

    # ---------------------------------------------------------
    # RESPONSE
    # ---------------------------------------------------------

    result = []

    for branch in branches:

        row = {
            "id": str(branch.id),
            "name": branch.name,
            "code": branch.code or "",
            "hierarchy_type": hierarchy,
            "latitude": (
                str(branch.latitude)
                if branch.latitude is not None
                else ""
            ),
            "longitude": (
                str(branch.longitude)
                if branch.longitude is not None
                else ""
            ),

            "state_id": "",
            "state_name": "",
            "district_id": "",
            "district_name": "",
            "taluka_id": "",
            "taluka_name": "",
            "city_id": "",
            "city_name": "",

            "zone_id": "",
            "zone_name": "",
            "circle_id": "",
            "circle_name": "",
            "region_id": "",
            "region_name": "",
            "division_id": "",
            "division_name": "",
        }

        # -----------------------------------------------------
        # GEOGRAPHICAL
        # -----------------------------------------------------

        if hierarchy == "GEOGRAPHICAL":

            city = branch.city

            if city:
                row["city_id"] = str(city.id)
                row["city_name"] = city.name

                taluka = getattr(city, "taluka", None)

                if taluka:
                    row["taluka_id"] = str(taluka.id)
                    row["taluka_name"] = taluka.name

                    district = getattr(taluka, "district", None)

                    if district:
                        row["district_id"] = str(district.id)
                        row["district_name"] = district.name

                        state_obj = getattr(district, "state", None)

                        if state_obj:
                            row["state_id"] = str(state_obj.id)
                            row["state_name"] = state_obj.name

        # -----------------------------------------------------
        # ZONAL
        # -----------------------------------------------------

        else:

            division = branch.division

            if division:
                row["division_id"] = str(division.id)
                row["division_name"] = division.name

                region = getattr(division, "region", None)

                if region:
                    row["region_id"] = str(region.id)
                    row["region_name"] = region.name

                    circle = getattr(region, "circle", None)

                    if circle:
                        row["circle_id"] = str(circle.id)
                        row["circle_name"] = circle.name

                        zone = getattr(circle, "zone", None)

                        if zone:
                            row["zone_id"] = str(zone.id)
                            row["zone_name"] = zone.name

        result.append(row)

    return Response({
        "status": "success",
        "count": len(result),
        "data": result,
    })

def user_can_manage_customer(user, customer):
    if not user or not user.is_authenticated:
        return False

    if user.role == Role.ORG_SUPER_ADMIN:
        return (
            user.organization_id is not None
            and customer.organization_id == user.organization_id
        )

    if user.role == Role.CUSTOMER:
        return user.customer_id == customer.id

    # Branch admins and engineers cannot assign a site
    # to an arbitrary customer through this endpoint.
    return False


import requests

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def pincode_lookup(request, pincode):

    pincode = str(pincode).strip()

    # Validate pincode
    if not pincode.isdigit() or len(pincode) != 6:
        return Response(
            {
                "status": "error",
                "message": "Enter a valid 6-digit pincode."
            },
            status=400
        )

    try:
        url = f"https://api.postalpincode.in/pincode/{pincode}"

        response = requests.get(
            url,
            timeout=10
        )

        response.raise_for_status()

        result = response.json()

        if not result:
            return Response(
                {
                    "status": "error",
                    "message": "No pincode information found."
                },
                status=404
            )

        api_result = result[0]

        if api_result.get("Status") != "Success":
            return Response(
                {
                    "status": "error",
                    "message": api_result.get(
                        "Message",
                        "Pincode not found."
                    )
                },
                status=404
            )

        post_offices = api_result.get("PostOffice") or []

        if not post_offices:
            return Response(
                {
                    "status": "error",
                    "message": "No post office found for this pincode."
                },
                status=404
            )

        # Convert API response into frontend-friendly format
        locations = []

        for office in post_offices:
            locations.append({
                "name": office.get("Name"),
                "branch_type": office.get("BranchType"),
                "delivery_status": office.get("DeliveryStatus"),
                "circle": office.get("Circle"),
                "district": office.get("District"),
                "division": office.get("Division"),
                "region": office.get("Region"),
                "block": office.get("Block"),
                "state": office.get("State"),
                "country": office.get("Country"),
                "pincode": office.get("Pincode"),
            })

        return Response({
            "status": "success",
            "pincode": pincode,
            "count": len(locations),
            "data": locations
        })

    except requests.RequestException as e:

        return Response(
            {
                "status": "error",
                "message": "Unable to fetch pincode information.",
                "details": str(e)
            },
            status=502
        )

    except Exception as e:

        return Response(
            {
                "status": "error",
                "message": "Unexpected error.",
                "details": str(e)
            },
            status=500
        )
    
@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def create_site(request):
    try:
        user = request.user

        name = request.data.get("name")
        code = request.data.get("code")
        branch_id = request.data.get("branch_id")
        floor_id = request.data.get("floor_id")

        address = request.data.get("address", "")
        pincode = request.data.get("pincode", "")

        city_name = request.data.get("city", "")
        district_name = request.data.get("district", "")
        state_name = request.data.get("state", "")

        latitude = request.data.get("latitude")
        longitude = request.data.get("longitude")

        hierarchy_type = request.data.get("hierarchy_type", "")

        if not name:
            return Response(
                {"status": "error", "message": "Site name is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not code:
            return Response(
                {"status": "error", "message": "Site code is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not branch_id:
            return Response(
                {"status": "error", "message": "branch_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            branch = Branch.objects.select_related("customer").get(
                id=branch_id
            )
        except Branch.DoesNotExist:
            return Response(
                {"status": "error", "message": "Branch not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        hierarchy_type = hierarchy_type.strip().upper()

        if hierarchy_type not in ["GEOGRAPHICAL", "ZONAL"]:
            return Response(
                {
                    "status": "error",
                    "message": "Invalid hierarchy_type."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        if hierarchy_type == "GEOGRAPHICAL":
            if not getattr(branch, "city_id", None):
                return Response(
                    {
                        "status": "error",
                        "message": "Selected branch is not geographical."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
        elif hierarchy_type == "ZONAL":
            if not getattr(branch, "division_id", None):
                return Response(
                    {
                        "status": "error",
                        "message": "Selected branch is not zonal."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # -------------------------
        # Check user access
        # -------------------------
        if user.role == Role.CUSTOMER:
            if branch.customer_id != user.customer_id:
                return Response(
                    {
                        "status": "error",
                        "message": "You can only create a site under your customer."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        elif user.role == Role.BR_ADMIN:
            if branch.id != user.branch_id:
                return Response(
                    {
                        "status": "error",
                        "message": "You can only create a site under your branch."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        elif user.role == Role.ENGINEER:
            return Response(
                {
                    "status": "error",
                    "message": "Engineers cannot create sites."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        elif user.role == Role.ORG_SUPER_ADMIN:
            if branch.customer.organization_id != user.organization_id:
                return Response(
                    {
                        "status": "error",
                        "message": "This branch is outside your organization."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        # -------------------------
        # Optional Floor
        # -------------------------
        floor = None

        if floor_id:
            try:
                floor = Floor.objects.get(
                    id=floor_id,
                    branch_id=branch.id
                )
            except Floor.DoesNotExist:
                return Response(
                    {
                        "status": "error",
                        "message": "Floor does not belong to this branch."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # -------------------------
        # Check duplicate site
        # -------------------------
        if Site.objects.filter(code=code).exists():
            return Response(
                {
                    "status": "error",
                    "message": "Site code already exists."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if Site.objects.filter(
            branch=branch,
            name=name
        ).exists():
            return Response(
                {
                    "status": "error",
                    "message": "A site with this name already exists in this branch."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # =====================================================
        # CREATE SITE IN 3TP
        # =====================================================

        payload = {
            "name": name,
            "type": "default",
        }

        try:
            _, data = _tpt_request(
                "POST",
                "site",
                payload=payload
            )

            tpt_site_id = _tpt_extract_id(data)

            if not tpt_site_id:
                raise ThreeTPError(
                    "3TP created the site but did not return a site ID."
                )

        except ThreeTPError as exc:
            return Response(
                {
                    "status": "error",
                    "message": f"3TP site creation failed: {_one_line(exc)}"
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # =====================================================
        # CREATE LOCAL SITE
        # =====================================================

        try:
            site = Site.objects.create(
                name=name,
                code=code,
                branch=branch,
                floor=floor,
                address=address,
                latitude=latitude or None,
                longitude=longitude or None,
                pincode=pincode,

                # keep your existing 3TP fields
                tpt_site_id=tpt_site_id,
                tpt_sync_status="SYNCED",
                tpt_sync_error="",
            )

        except Exception as exc:
            return Response(
                {
                    "status": "error",
                    "message": "3TP site was created but local site creation failed.",
                    "details": str(exc),
                    "tpt_site_id": tpt_site_id,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "status": "success",
                "message": "Site created successfully.",
                "data": {
                    "site_id": str(site.id),
                    "tpt_site_id": site.tpt_site_id,
                    "name": site.name,
                    "code": site.code,
                    "branch_id": str(site.branch_id),
                    "floor_id": str(site.floor_id) if site.floor_id else None,
                },
            },
            status=status.HTTP_201_CREATED,
        )

    except Exception as exc:
        traceback.print_exc()

        return Response(
            {
                "status": "error",
                "message": str(exc),
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
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


# LOCATIONS API  (create + read, with ownership stamping)
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


# SAVED DASHBOARD PREFERENCES
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

class DeviceCreateView(generics.CreateAPIView):
    serializer_class = ACDeviceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):

        user = self.request.user

        # Engineers cannot create devices
        if user.role == Role.ENGINEER:
            raise DRFValidationError(
                "Engineers cannot create devices."
            )

        # -----------------------------------------
        # CREATE LOCAL DEVICE FIRST
        # -----------------------------------------

        serializer.save(
            assigned_by=user,
            site=None,
            tpt_sync_status="PENDING",
            tpt_sync_error=""
        )

        device = serializer.instance

        # A device created by a customer / branch admin belongs to that
        # customer from the start (saved locally, before touching 3TP).
        if user.role != Role.ORG_SUPER_ADMIN and user.customer_id:
            CustomerDeviceMapping.objects.update_or_create(
                customer_id=user.customer_id,
                device=device,
                defaults={"is_active": True},
            )

        # -----------------------------------------
        # CREATE DEVICE IN 3TP
        # -----------------------------------------

        try:

            tpt_device_id, created_new = create_3tp_device_independent(
                request=self.request,
                name=device.device_name or device.ac_id,
                label=device.device_name or device.ac_id,
                client_id=device.ac_id,
                username=device.ac_id,
                password=""
            )

            # -----------------------------------------
            # UPDATE LOCAL DEVICE
            # -----------------------------------------

            device.tpt_device_id = tpt_device_id
            device.tpt_sync_status = "SYNCED"
            device.tpt_sync_error = ""

            device.save(
                update_fields=[
                    "tpt_device_id",
                    "tpt_sync_status",
                    "tpt_sync_error",
                    "updated_at",
                ]
            )

        except ThreeTPError as exc:

            device.tpt_sync_status = "FAILED"
            device.tpt_sync_error = str(exc)

            device.save(
                update_fields=[
                    "tpt_sync_status",
                    "tpt_sync_error",
                    "updated_at",
                ]
            )

            raise ThreeTPAPIError(
                "Device created locally but 3TP "
                f"synchronization failed: {_one_line(exc)}"
            )

def create_3tp_device_independent(
    request,
    *,
    name,
    label,
    client_id,
    username,
    password
):
    """
    Create a device in 3TP only.

    No customer assignment.
    No site assignment.

    Returns:
        (tpt_device_id, created_new)
    """

    headers = _tpt_user_headers(request)

    created_new = True

    # -----------------------------------------
    # CREATE DEVICE + MQTT CREDENTIALS
    # -----------------------------------------

    payload = {
        "device": {
            "name": name,
            "label": label or name,

            "deviceProfileId": {
                "id": get_3tp_device_profile_id(request),
                "entityType": "DEVICE_PROFILE"
            },
        },

        "credentials": {
            "credentialsType": "MQTT_BASIC",

            "credentialsValue": json.dumps({
                "clientId": client_id,
                "userName": username,
                "password": password
            }),
        },
    }

    response = requests.post(
        f"{CLOUD_URL}/api/device-with-credentials",

        headers=headers,

        timeout=15,

        json=payload
    )

    # -----------------------------------------
    # HANDLE RESPONSE
    # -----------------------------------------

    if response.status_code == 400:

        if "already exists" in response.text.lower():

            existing = find_3tp_device_by_name(
                request,
                name
            )

            existing_id = (
                _id_of(existing)
                if existing
                else ""
            )

            if not existing_id:
                raise ThreeTPError(
                    f"A device named '{name}' "
                    "already exists in 3TP."
                )

            # Make sure this device isn't already
            # connected to another local device.

            if ACDevice.objects.filter(
                tpt_device_id=existing_id
            ).exists():

                raise ThreeTPError(
                    f"Device '{name}' already exists "
                    "locally."
                )

            tpt_device_id = existing_id
            created_new = False

        else:

            raise ThreeTPError(
                f"3TP device creation failed: "
                f"{response.text}",
                status=response.status_code
            )

    elif response.status_code not in (200, 201):

        raise ThreeTPError(
            f"3TP device creation failed: "
            f"{response.text}",
            status=response.status_code
        )

    else:

        try:
            data = response.json()

        except ValueError:
            raise ThreeTPError(
                "3TP returned an invalid response."
            )

        tpt_device_id = _id_of(data)

    # -----------------------------------------
    # VALIDATE 3TP DEVICE ID
    # -----------------------------------------

    if not tpt_device_id:

        raise ThreeTPError(
            "3TP did not return a device id."
        )

    # -----------------------------------------
    # IMPORTANT:
    # NO CUSTOMER MAPPING HERE
    # NO SITE MAPPING HERE
    # -----------------------------------------

    return tpt_device_id, created_new

@csrf_exempt
@api_view(["POST"])
def create_site(request):

    try:
        auth_header = request.headers.get("Authorization")

        if not auth_header or not auth_header.startswith("Bearer "):
            return JsonResponse(
                {"error": "Valid Bearer token required"},
                status=401
            )

        token = auth_header.split(" ")[1]

        body = json.loads(request.body)

        name = body.get("name")
        customer_id = body.get("customer_id")
        latitude = body.get("latitude")
        longitude = body.get("longitude")
        address = body.get("address")

        if not name:
            return JsonResponse(
                {"error": "name is required"},
                status=400
            )

        # ---------------- 3TP CREATE SITE ----------------

        response = requests.post(
            f"{CLOUD_URL}/api/asset",
            json={
                "name": name,
                "type": "default"
            },
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "X-Authorization": f"Bearer {token}"
            }
        )

        data = response.json()

        if response.status_code not in [200, 201]:
            return JsonResponse(data, status=response.status_code)

        asset_id = data["id"]["id"]

        # ---------------- CUSTOMER -> SITE ----------------

        if customer_id:

            response = requests.post(
                f"{CLOUD_URL}/api/customer/{customer_id}/asset/{asset_id}",
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "X-Authorization": f"Bearer {token}"
                }
            )

            if response.status_code not in [200, 201]:
                return JsonResponse(
                    {"error": "Failed to map site to customer",
                     "details": response.json()},
                    status=response.status_code
                )

        # ---------------- SAVE LOCAL ----------------

        site = Site.objects.create(
            name=name,
            asset_id=asset_id,
            customer_id=customer_id,
            latitude=latitude,
            longitude=longitude,
            address=address
        )

        return JsonResponse({
            "message": "Site created successfully",
            "site_id": str(site.id),
            "asset_id": asset_id,
            "customer_id": customer_id
        }, status=201)

    except Exception as e:

        return JsonResponse(
            {"error": str(e)},
            status=500
        )

@csrf_exempt
@api_view(["POST"])
def create_device(request):

    try:
        auth_header = request.headers.get("Authorization")

        if not auth_header or not auth_header.startswith("Bearer "):
            return JsonResponse(
                {"error": "Valid Bearer token required"},
                status=401
            )

        token = auth_header.split(" ")[1]

        body = json.loads(request.body)

        ac_id = body.get("ac_id")
        device_name = body.get("device_name")

        if not ac_id:
            return JsonResponse(
                {"error": "ac_id is required"},
                status=400
            )

        # Optional branch placement makes a newly created AC immediately
        # available in the customer's hierarchy/filter tree.
        branch_ref = str(body.get("branch_id") or "").strip()
        target_branch = None
        if branch_ref:
            try:
                target_branch = Branch.objects.select_related("customer").filter(pk=uuid.UUID(branch_ref)).first()
            except (ValueError, TypeError):
                target_branch = Branch.objects.select_related("customer").filter(code__iexact=branch_ref).first()
            if target_branch is None:
                return JsonResponse({"error": "Selected branch was not found."}, status=400)

        # ---------------- CREATE DEVICE IN 3TP ----------------

        payload = {
            "device": {
                "name": device_name or ac_id,
                "label": device_name or ac_id,
                "deviceProfileId": {
                    "id": body.get("device_profile_id"),
                    "entityType": "DEVICE_PROFILE"
                }
            },
            "credentials": {
                "credentialsType": "MQTT_BASIC",
                "credentialsValue": json.dumps({
                    "clientId": ac_id,
                    "userName": body.get("username", ac_id),
                    "password": body.get("password", "")
                })
            }
        }

        response = requests.post(
            f"{CLOUD_URL}/api/device-with-credentials",
            json=payload,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "X-Authorization": f"Bearer {token}"
            }
        )

        data = response.json()

        if response.status_code not in [200, 201]:
            return JsonResponse(
                data,
                status=response.status_code
            )

        device_id = data["device"]["id"]["id"]

        # ---------------- SAVE LOCAL ----------------

        device = ACDevice.objects.create(
            ac_id=ac_id,
            device_name=device_name or ac_id,
            tpt_device_id=device_id,
            branch=target_branch,
            assigned_admin=(
                target_branch.assigned_admin
                or User.objects.filter(customer_id=target_branch.customer_id, role=Role.CUSTOMER, is_active=True).order_by("date_joined").first()
                if target_branch else None
            ),
        )

        if target_branch:
            CustomerDeviceMapping.objects.update_or_create(
                customer=target_branch.customer, device=device, defaults={"is_active": True}
            )
            try:
                _place_direct_branch_device_in_tree(device, target_branch)
            except Exception:
                traceback.print_exc()

        return JsonResponse({
            "message": "Device created successfully",
            "device_id": str(device.id),
            "tpt_device_id": device_id
        }, status=201)

    except Exception as e:

        return JsonResponse(
            {"error": str(e)},
            status=500
        )

def _resolve_customer_ref(ref, user):
    """Accept the local customer id or the 3TP customer id."""
    ref = str(ref or "").strip()
    if not ref:
        return None
    qs = Customer.objects.all()
    if user.role == Role.ORG_SUPER_ADMIN:
        qs = qs.filter(organization_id=user.organization_id)
    customer = qs.filter(tpt_customer_id=ref).first()
    if customer is None and ref.isdigit():
        customer = qs.filter(pk=int(ref)).first()
    return customer


def _ensure_local_device(request, ref):
    """
    Return the local ACDevice for a 3TP device id / local id / ac_id.
    A device that only exists in 3TP gets a local record, so every
    assignment is always saved locally.
    """
    ref = str(ref or "").strip()
    if not ref:
        return None

    device = ACDevice.objects.filter(tpt_device_id=ref).first()
    if device is None:
        try:
            device = ACDevice.objects.filter(pk=uuid.UUID(ref)).first()
        except ValueError:
            device = None
    if device is None:
        device = ACDevice.objects.filter(ac_id=ref).first()
    if device is not None:
        return device

    try:
        res = requests.get(
            f"{CLOUD_URL}/api/device/{ref}",
            headers=_tpt_user_headers(request),
            timeout=15,
        )
        if res.status_code != 200:
            return None
        data = res.json()
    except (requests.RequestException, ValueError):
        return None

    name = data.get("name") or data.get("label") or ""
    if not name:
        return None

    device, _ = ACDevice.objects.get_or_create(
        ac_id=name,
        defaults={
            "device_name": data.get("label") or name,
            "tpt_device_id": ref,
            "tpt_sync_status": "SYNCED",
        },
    )
    if not device.tpt_device_id:
        device.tpt_device_id = ref
        device.tpt_sync_status = "SYNCED"
        device.save(update_fields=["tpt_device_id", "tpt_sync_status", "updated_at"])
    return device


def _remove_device_from_location_files(ac_id):
    """Drop a device from DeviceLocationMap.json and both location trees."""
    try:
        device_map = build_device_location_map()
        if ac_id in device_map:
            device_map.pop(ac_id)
            save_device_location_map(device_map)
        for hierarchy, location_file in (
            ("GEOGRAPHICAL", GEOGRAPHICAL_LOCATION_FILE),
            ("ZONAL", ZONAL_LOCATION_FILE),
        ):
            tree = load_location_tree(location_file)
            if remove_site_from_tree(tree, ac_id):
                save_location_tree(tree, location_file)
    except Exception:
        pass


def _stamp_customer_on_device_map(device, customer):
    """Keep DeviceLocationMap.json's customer fields in step with the DB."""
    try:
        device_map = build_device_location_map()
        mapping = device_map.get(device.ac_id)
        if mapping is None:
            return
        mapping["customer_id"] = str(customer.pk)
        mapping["customer_name"] = customer.company
        save_device_location_map(device_map)
    except Exception:
        pass


@csrf_exempt
@api_view(["POST"])
def assign_device_to_customer(request):
    """Assign or reassign an existing 3TP device to a customer.

    The device itself is never recreated. The local mapping is updated only
    after 3TP confirms the assignment.
    """
    try:
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JsonResponse({"error": "Valid Bearer token required"}, status=401)

        token = auth_header.split(" ", 1)[1].strip()
        body = request.data if hasattr(request, "data") else json.loads(request.body or "{}")
        customer_id = str(body.get("customer_id") or "").strip()
        device_id = str(body.get("device_id") or "").strip()
        if not customer_id or not device_id:
            return JsonResponse({"error": "customer_id and device_id are required"}, status=400)

        response = requests.post(
            f"{CLOUD_URL}/api/customer/{customer_id}/device/{device_id}",
            headers={"Accept": "application/json", "X-Authorization": f"Bearer {token}"},
            timeout=20,
        )
        if response.status_code not in (200, 201):
            try:
                details = response.json()
            except Exception:
                details = response.text
            return JsonResponse({"error": "Failed to map device to customer", "details": details}, status=response.status_code)

        # Keep local customer-device mapping in sync; support UUID or 3TP ID.
        device = ACDevice.objects.filter(tpt_device_id=device_id).first()
        if device is None:
            device = ACDevice.objects.filter(ac_id=device_id).first()

        customer = Customer.objects.filter(tpt_customer_id=customer_id).first()
        if customer is None:
            try:
                customer = Customer.objects.filter(pk=customer_id).first()
            except (ValueError, TypeError):
                customer = None

        local_sync_error = ""
        if device and customer:
            try:
                # Deactivate mappings to other customers, then activate/create
                # the selected mapping. This makes reassignment deterministic.
                CustomerDeviceMapping.objects.filter(device=device).exclude(
                    customer=customer
                ).update(is_active=False)
                mapping, _ = CustomerDeviceMapping.objects.get_or_create(
                    customer=customer, device=device,
                    defaults={"is_active": True},
                )
                if not mapping.is_active:
                    mapping.is_active = True
                    mapping.save(update_fields=["is_active", "updated_at"])
            except Exception as exc:
                local_sync_error = str(exc)
        elif not device or not customer:
            local_sync_error = "3TP assignment succeeded, but the matching local device/customer was not found."

        return JsonResponse({
            "message": "Device reassigned to customer successfully" if local_sync_error == "" else "Device assigned in 3TP; local mapping needs attention",
            "customer_id": customer_id,
            "device_id": device_id,
            "data": {"sync_error": local_sync_error} if local_sync_error else {},
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def assign_device_to_site(request):
    """Assign a device to a local Site and sync the 3TP relation when possible.

    Accepts local IDs as well as 3TP IDs. The local DB remains the source of
    truth for dashboard hierarchy filters, so a cloud sync issue must not
    leave the device detached from the selected site's hierarchy.
    """
    body = request.data if hasattr(request, "data") else {}

    site_ref = str(
        _scalar_id(body.get("site_id"))
        or _scalar_id(body.get("asset_id"))
        or _scalar_id(body.get("tpt_site_id"))
        or ""
    ).strip()

    device_ref = str(
        _scalar_id(body.get("local_device_id"))
        or _scalar_id(body.get("device_id"))
        or _scalar_id(body.get("tpt_device_id"))
        or _scalar_id(body.get("ac_id"))
        or ""
    ).strip()
    if not site_ref or not device_ref:
        return JsonResponse({"error": "site_id/asset_id and device_id are required."}, status=400)

    site_qs = Site.objects.select_related(
        "branch__customer", "floor__branch__customer"
    )
    site = _safe_first(site_qs, site_ref)
    if site is None:
        site = site_qs.filter(tpt_site_id=site_ref).first()
    if site is None:
        site = site_qs.filter(code__iexact=site_ref).first()

    device_qs = ACDevice.objects.all()
    device = _safe_first(device_qs, device_ref)
    if device is None:
        device = device_qs.filter(tpt_device_id=device_ref).first()
    if device is None:
        device = device_qs.filter(ac_id=device_ref).first()
    if site is None:
        return JsonResponse({"error": "Local site was not found. Select a site from the local Sites list."}, status=404)
    if device is None:
        return JsonResponse({"error": "Local device was not found."}, status=404)

    user = request.user
    resolved_branch = site.branch or (site.floor.branch if site.floor_id else None)
    customer = resolved_branch.customer if resolved_branch and resolved_branch.customer_id else None
    if user.role == Role.CUSTOMER and (not customer or customer.pk != user.customer_id):
        return JsonResponse({"error": "This site is outside your customer scope."}, status=403)
    if user.role == Role.BR_ADMIN and (not customer or customer.pk != user.customer_id):
        return JsonResponse({"error": "This site is outside your admin scope."}, status=403)
    if user.role == Role.ORG_SUPER_ADMIN and customer and customer.organization_id != user.organization_id:
        return JsonResponse({"error": "This site is outside your organization."}, status=403)
    if user.role not in (Role.ORG_SUPER_ADMIN, Role.CUSTOMER, Role.BR_ADMIN):
        return JsonResponse({"error": "You are not allowed to assign devices to sites."}, status=403)
    current_owner = device_customer(device)
    if user.role in (Role.CUSTOMER, Role.BR_ADMIN) and current_owner and current_owner.pk != user.customer_id:
        return JsonResponse({"error": "This device belongs to a different customer."}, status=403)
    if user.role == Role.ORG_SUPER_ADMIN and current_owner and current_owner.organization_id != user.organization_id:
        return JsonResponse({"error": "This device is outside your organization."}, status=403)

    # Persist the local relationship first so the hierarchy filters update even
    # if the external cloud API is temporarily unavailable.
    with transaction.atomic():
        if resolved_branch and site.branch_id is None:
            site.branch = resolved_branch
            site.save(update_fields=["branch"])
        device.site = site
        device.branch = resolved_branch
        device.assigned_by = user
        if resolved_branch and not device.assigned_admin_id:
            default_admin = resolved_branch.assigned_admin or User.objects.filter(
                customer_id=resolved_branch.customer_id, role=Role.BR_ADMIN, is_active=True
            ).order_by("date_joined").first() or User.objects.filter(
                customer_id=resolved_branch.customer_id, role=Role.CUSTOMER, is_active=True
            ).order_by("date_joined").first()
            if default_admin:
                device.assigned_admin = default_admin
        device.save(update_fields=["site", "branch", "assigned_by", "assigned_admin", "updated_at"])
        SiteDeviceMapping.objects.filter(device=device).exclude(site=site).update(is_active=False)
        SiteDeviceMapping.objects.update_or_create(site=site, device=device, defaults={"is_active": True})
        if customer:
            CustomerDeviceMapping.objects.filter(device=device).exclude(customer=customer).update(is_active=False)
            CustomerDeviceMapping.objects.update_or_create(customer=customer, device=device, defaults={"is_active": True})

    hierarchy_error = ""
    try:
        apply_site_hierarchy_to_device(device)
    except Exception as exc:
        hierarchy_error = _one_line(exc, 1000)

    # The external relation needs 3TP IDs and a bearer token. If the local site
    # has not synced yet, keep the local assignment and return a clear warning.
    cloud_error = ""
    cloud_site_id = str(site.tpt_site_id or body.get("tpt_site_id") or "").strip()
    cloud_device_id = str(device.tpt_device_id or body.get("tpt_device_id") or "").strip()
    auth_header = request.headers.get("Authorization", "")
    if cloud_site_id and cloud_device_id and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        payload = {
            "from": {"entityType": "ASSET", "id": cloud_site_id},
            "to": {"entityType": "DEVICE", "id": cloud_device_id},
            "type": "Contains", "typeGroup": "COMMON",
        }
        try:
            response = requests.post(
                f"{CLOUD_URL}/api/relation", json=payload,
                headers={"Content-Type": "application/json", "Accept": "application/json", "X-Authorization": f"Bearer {token}"},
                timeout=20,
            )
            if response.status_code not in (200, 201):
                cloud_error = f"Local hierarchy assigned, but 3TP relation sync failed (HTTP {response.status_code})."
        except Exception as exc:
            cloud_error = f"Local hierarchy assigned, but 3TP relation sync failed: {_one_line(exc, 300)}"
    elif not cloud_site_id or not cloud_device_id:
        cloud_error = "Local hierarchy assigned. 3TP relation sync is pending until both site and device have 3TP IDs."
    else:
        cloud_error = "Local hierarchy assigned, but the 3TP relation was not attempted because a Bearer token was missing."

    warnings = "; ".join(value for value in (hierarchy_error, cloud_error) if value)
    return JsonResponse({
        "status": "success",
        "message": "Device assigned to site and hierarchy updated." if not warnings else "Device assigned locally; sync warning available.",
        "site_id": str(site.pk), "device_id": str(device.pk),
        "branch_id": str(resolved_branch.pk) if resolved_branch else "",
        "customer_id": str(customer.pk) if customer else "",
        "data": {"sync_error": warnings} if warnings else {},
    }, status=200)


def get_or_create_local_site_from_3tp(request, tpt_site_id, customer, branch_id=None):
    """Return the local Site for a 3TP asset, creating it if it doesn't exist."""
    site = Site.objects.filter(tpt_site_id=tpt_site_id).first()
    if site:
        return site, False

    # Read the asset from 3TP so the local row matches it
    res = requests.get(
        f"{CLOUD_URL}/api/asset/{tpt_site_id}",
        headers=_tpt_user_headers(request),
        timeout=15,
    )
    if res.status_code != 200:
        raise ThreeTPError(
            f"Site not found in 3TP: {res.text}", status=res.status_code
        )
    asset = res.json()
    name = asset.get("name") or asset.get("label") or f"Site {tpt_site_id[:8]}"

    # Branch: explicit one from the request, else the customer's first branch
    branch = None
    if branch_id:
        branch = Branch.objects.filter(pk=branch_id, customer=customer).first()
    if branch is None:
        branch = Branch.objects.filter(customer=customer).order_by("name").first()

    # Unique code
    code = f"3TP-{tpt_site_id[:8].upper()}"

    site = Site.objects.create(
        name=name,
        code=code,
        branch=branch,                 # must be nullable if customer has no branch yet
        tpt_site_id=tpt_site_id,
        tpt_sync_status="SYNCED",
        tpt_sync_error="",
    )
    return site, True


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def assign_customer_to_site(request):
    customer_id = request.data.get("customer_id")
    site_id = request.data.get("site_id")
    tpt_site_id = str(request.data.get("tpt_site_id") or "").strip()

    if not customer_id or not (site_id or tpt_site_id):
        return Response(
            {
                "status": "error",
                "message": "customer_id and site_id or tpt_site_id are required.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        customer = Customer.objects.get(pk=customer_id)
    except (Customer.DoesNotExist, ValueError, TypeError):
        return Response(
            {"status": "error", "message": "Customer not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    user = request.user

    # Validate the acting user's scope.
    if user.role == Role.ORG_SUPER_ADMIN:
        if customer.organization_id != user.organization_id:
            return Response(
                {"status": "error", "message": "Customer is outside your organization."},
                status=status.HTTP_403_FORBIDDEN,
            )
    elif user.role == Role.CUSTOMER:
        if customer.pk != user.customer_id:
            return Response(
                {"status": "error", "message": "You cannot assign another customer's site."},
                status=status.HTTP_403_FORBIDDEN,
            )
    else:
        return Response(
            {"status": "error", "message": "You cannot assign customers to sites."},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Prefer the local site ID.
    site = None

    if site_id:
        try:
            site = Site.objects.get(pk=site_id)
        except (Site.DoesNotExist, ValueError, TypeError):
            return Response(
                {"status": "error", "message": "Local site not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

    elif tpt_site_id:
        # Legacy path: resolve an existing local site or import its
        # details from 3TP using your existing helper.
        site = Site.objects.filter(tpt_site_id=tpt_site_id).first()

        if site is None:
            try:
                site, _ = get_or_create_local_site_from_3tp(
                    request,
                    tpt_site_id,
                    customer,
                    branch_id=request.data.get("branch_id"),
                )
            except Exception as exc:
                return Response(
                    {
                        "status": "error",
                        "message": "Could not resolve the site.",
                        "details": _one_line(exc, 1000),
                    },
                    status=status.HTTP_502_BAD_GATEWAY,
                )

    # A site already attached to a different customer hierarchy
    # cannot be silently reassigned.
    if site.branch_id and site.branch.customer_id != customer.pk:
        return Response(
            {
                "status": "error",
                "message": "The site's branch belongs to a different customer.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Save the assignment locally before contacting 3TP.
    with transaction.atomic():
        mapping, created = CustomerSiteMapping.objects.update_or_create(
            customer=customer,
            site=site,
            defaults={"is_active": True},
        )

    sync_error = ""

    try:
        # Existing cloud synchronization helper.
        from .cloud_sync import sync_customer, sync_site

        if not customer.tpt_customer_id:
            sync_customer(customer)

        if not site.tpt_site_id:
            sync_site(site)

        if not customer.tpt_customer_id or not site.tpt_site_id:
            raise ThreeTPError("Missing 3TP customer or site ID after synchronization.")

        headers = _tpt_service_headers()
        response = requests.post(
            f"{CLOUD_URL}/api/customer/{customer.tpt_customer_id}"
            f"/asset/{site.tpt_site_id}",
            headers=headers,
            timeout=15,
        )

        if response.status_code not in (200, 201, 202, 204):
            raise ThreeTPError(
                f"3TP customer-site assignment failed ({response.status_code}): "
                f"{response.text[:500]}"
            )

    except Exception as exc:
        sync_error = _one_line(exc, 2000)

    return Response(
        {
            "status": "success",
            "message": (
                "Customer-site assignment saved locally."
                if sync_error
                else "Customer-site assignment saved locally and synchronized."
            ),
            "data": {
                "mapping_id": str(mapping.id),
                "customer_id": str(customer.id),
                "customer_name": customer.company,
                "site_id": str(site.id),
                "site_name": site.name,
                "tpt_customer_id": customer.tpt_customer_id or "",
                "tpt_site_id": site.tpt_site_id or "",
                "sync_status": "ERROR" if sync_error else "SYNCED",
                "sync_error": sync_error,
            },
        },
        status=status.HTTP_200_OK if not created else status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ai_dashboard_analysis(request):
    """
    Generate AI insights for the AC Monitoring Dashboard using Ollama.
    Returns the response format expected by ACDashboard.jsx.
    """

    dashboard_data = request.data.get("dashboard_data")

    if not isinstance(dashboard_data, dict) or not dashboard_data:
        return Response(
            {
                "status": "error",
                "message": "dashboard_data must be a non-empty JSON object.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # The current React component sends KPIs inside dashboard_data.kpis.
    # Also support a flat dashboard_data object for compatibility.
    kpis = dashboard_data.get("kpis", dashboard_data)

    if not isinstance(kpis, dict):
        return Response(
            {
                "status": "error",
                "message": "Dashboard KPI data must be a JSON object.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    ollama_url = os.getenv(
        "OLLAMA_API_URL",
        "http://localhost:11434/api/generate",
    )
    ollama_model = os.getenv("OLLAMA_MODEL", "llama3.1:8b")

    # Keep the prompt compact. Send only the relevant summary and trends.
    analysis_data = {
        "dashboard_name": dashboard_data.get(
            "dashboard_name", "AC Energy Monitoring"
        ),
        "filters": dashboard_data.get("filters", {}),
        "kpis": {
            key: kpis.get(key)
            for key in [
                "totalACs",
                "activeACs",
                "totalEnergy",
                "activeEnergy",
                "activePower",
                "averageTemperature",
                "averageHumidity",
                "alerts",
                "records",
                "historyPoints",
            ]
            if key in kpis
        },
        "trends": dashboard_data.get("trends", [])[-10:]
        if isinstance(dashboard_data.get("trends"), list)
        else [],
    }

    expected_keys = [
        "totalEnergy",
        "activeEnergy",
        "totalACs",
        "activeACs",
        "activePower",
        "temperature",
        "humidity",
        "alerts",
        "energyChart",
        "healthChart",
        "humidityChart",
        "powerChart",
        "zoneChart",
        "temperatureChart",
    ]

    prompt = f"""
You are an AI analyst for an AC energy monitoring dashboard.

Analyze the following dashboard information:
{json.dumps(analysis_data, ensure_ascii=False, default=str)}

Return ONLY a valid JSON object with these exact keys:
{json.dumps(expected_keys)}

Requirements:
- Every value must be a short, useful string for a dashboard.
- Explain energy, active AC units, power, temperature, humidity and alerts.
- Use only facts supported by the supplied data.
- Do not invent causes, thresholds, historical trends or zone rankings.
- If historical data is insufficient, clearly state that.
- Distinguish missing readings from zero readings.
- Recommend investigation when reported values or alerts warrant it.
- Keep language simple and concise.
- Return JSON only, without Markdown.
"""

    try:
        response = requests.post(
            ollama_url,
            json={
                "model": ollama_model,
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {
                    "temperature": 0.2,
                },
            },
            timeout=90,
        )

        response.raise_for_status()
        result = response.json()
        generated_text = result.get("response", "").strip()

        if not generated_text:
            return Response(
                {
                    "status": "error",
                    "message": "Ollama returned an empty AI response.",
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        insights = json.loads(generated_text)

        if not isinstance(insights, dict):
            raise ValueError("AI output must be a JSON object.")

        # Normalize the output so React always receives the expected keys.
        clean_insights = {}

        for key in expected_keys:
            value = insights.get(key, "")
            clean_insights[key] = (
                value.strip() if isinstance(value, str) else ""
            )

        return Response(
            {
                "status": "success",
                "insights": clean_insights,
            },
            status=status.HTTP_200_OK,
        )

    except requests.exceptions.Timeout:
        return Response(
            {
                "status": "error",
                "message": "Ollama timed out. Please try again.",
            },
            status=status.HTTP_504_GATEWAY_TIMEOUT,
        )

    except requests.exceptions.RequestException:
        return Response(
            {
                "status": "error",
                "message": (
                    "Unable to connect to Ollama. "
                    "Check that Ollama is running and the model is installed."
                ),
            },
            status=status.HTTP_502_BAD_GATEWAY,
        )

    except (ValueError, json.JSONDecodeError):
        return Response(
            {
                "status": "error",
                "message": "Ollama returned an invalid JSON response.",
            },
            status=status.HTTP_502_BAD_GATEWAY,
        )


@api_view(["POST"])
def control_device_relay(request):
    device_id = request.data.get("device_id")
    params = request.data.get("params")
    method = request.data.get("method", "Relay")

    token = _raw_token(request)

    if not token:
        return Response(
            {"status": "error", "message": "Bearer token required."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not device_id:
        return Response(
            {"status": "error", "message": "3TP device_id is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if method != "Relay" or type(params) is not int or params not in (0, 1):
        return Response(
            {
                "status": "error",
                "message": "Use method='Relay' and params=1 for ON or 0 for OFF.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        response = requests.post(
            f"{CLOUD_URL}/api/rpc/oneway/{device_id}",
            json={
                "method": "Relay",
                "params": params,
            },
            headers=_tpt_user_headers(request),
            timeout=15,
        )

        if not response.ok:
            return Response(
                {
                    "status": "error",
                    "message": "Cloud rejected the relay command.",
                    "details": response.text[:500],
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({
            "status": "success",
            "message": f"Relay {'ON' if params == 1 else 'OFF'} command sent.",
            "device_id": device_id,
            "params": params,
        })

    except requests.RequestException as exc:
        return Response(
            {
                "status": "error",
                "message": "Could not connect to 3TP.",
                "details": str(exc),
            },
            status=status.HTTP_502_BAD_GATEWAY,
        )

def _place_direct_branch_device_in_tree(device, branch):
    """Persist a directly assigned AC under its real branch in the hierarchy tree.

    FilterDashboard consumes `branch.devices`; older site-based records may be
    stored under `branch.sites`. Keep those legacy records intact while moving
    this device to the canonical `devices` collection.
    """
    hierarchy = str(getattr(branch.customer, "hierarchy_type", "") or "").upper()
    if hierarchy not in ("GEOGRAPHICAL", "ZONAL"):
        return {}

    location_file = (
        GEOGRAPHICAL_LOCATION_FILE if hierarchy == "GEOGRAPHICAL"
        else ZONAL_LOCATION_FILE
    )

    # Remove any previous branch/floor placement in either hierarchy first.
    remove_device_from_location_trees(
        device.ac_id,
        tpt_device_id=device.tpt_device_id or "",
        site_id=str(device.site_id or ""),
    )

    tree = load_location_tree(location_file)
    expected = {"branch_name": str(branch.name or "").strip().casefold()}

    if hierarchy == "GEOGRAPHICAL":
        parent = branch.taluka or (branch.city.taluka if branch.city_id and branch.city else None)
        if not parent:
            return {}
        expected.update({
            "state_name": str(parent.district.state.name or "").strip().casefold(),
            "district_name": str(parent.district.name or "").strip().casefold(),
            "taluka_name": str(parent.name or "").strip().casefold(),
            "city_name": str(branch.city.name or "").strip().casefold() if branch.city_id else "",
        })
    else:
        if not branch.division_id or not branch.division:
            return {}
        division = branch.division
        region = division.region
        circle = region.circle
        zone = circle.zone
        expected.update({
            "zone_name": str(zone.name or "").strip().casefold(),
            "circle_name": str(circle.name or "").strip().casefold(),
            "region_name": str(region.name or "").strip().casefold(),
            "division_name": str(division.name or "").strip().casefold(),
        })

    target = None
    target_context = {}
    for node, context in iter_branches(tree, hierarchy):
        if str(context.get("branch_name", "")).strip().casefold() != expected["branch_name"]:
            continue
        # Match the complete ancestry so duplicate branch names cannot cross-link.
        if hierarchy == "GEOGRAPHICAL":
            keys = ("state_name", "district_name", "taluka_name")
            if any(str(context.get(k, "")).strip().casefold() != expected[k] for k in keys):
                continue
            if expected["city_name"] and str(context.get("city_name", "")).strip().casefold() != expected["city_name"]:
                continue
        else:
            keys = ("zone_name", "circle_name", "region_name", "division_name")
            if any(str(context.get(k, "")).strip().casefold() != expected[k] for k in keys):
                continue
        target, target_context = node, context
        break

    if target is None:
        return {}

    entry = {
        "ac_id": device.ac_id,
        "device_name": device.device_name or device.ac_id,
        "name": device.device_name or device.ac_id,
        "label": device.device_name or device.ac_id,
        "tpt_device_id": device.tpt_device_id or "",
        "thingsboard_device_id": device.tpt_device_id or "",
        "device_id": device.tpt_device_id or "",
        "id": device.tpt_device_id or device.ac_id,
        "local_device_id": str(device.pk),
        "branch_id": str(target_context.get("branch_id", "")),
        "db_branch_id": str(branch.pk),
        "customer_id": str(branch.customer_id),
        "customer_name": branch.customer.company,
        "status": device.status,
    }
    devices = target.get("devices")
    if not isinstance(devices, list):
        devices = []
        target["devices"] = devices
    devices.append(entry)
    save_location_tree(tree, location_file)
    return target_context


# DIRECT DEVICE -> BRANCH ASSIGNMENT (SITE-FREE WORKFLOW)
@csrf_exempt
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def assign_device_to_branch(request):
    """
    Assign a local/3TP device directly to a Branch.
    Payload: {"device_id": "<local UUID or 3TP device UUID or ac_id>",
              "branch_id": "<local branch UUID or branch code>"}
    This does not create or require a Site/Asset in 3TP.
    """
    user = request.user
    if user.role not in (Role.ORG_SUPER_ADMIN, Role.CUSTOMER, Role.BR_ADMIN):
        return JsonResponse({"error": "You are not allowed to assign devices to branches."}, status=403)

    device_ref = str(request.data.get("device_id") or "").strip()
    branch_ref = str(request.data.get("branch_id") or "").strip()
    if not device_ref or not branch_ref:
        return JsonResponse({"error": "device_id and branch_id are required."}, status=400)

    try:
        device = _ensure_local_device(request, device_ref)
        if device is None:
            return JsonResponse({"error": "Device not found."}, status=404)

        branch_qs = Branch.objects.select_related(
            "customer", "city", "taluka", "division",
            "city__taluka__district__state",
            "taluka__district__state",
            "division__region__circle__zone",
        )
        branch = None
        try:
            branch = branch_qs.filter(pk=uuid.UUID(branch_ref)).first()
        except (ValueError, TypeError):
            branch = branch_qs.filter(code__iexact=branch_ref).first()
        if branch is None:
            return JsonResponse({"error": "Branch not found."}, status=404)

        if user.role == Role.CUSTOMER:
            if not user.customer_id or branch.customer_id != user.customer_id:
                return JsonResponse({"error": "This branch is outside your customer scope."}, status=403)
            if not device_customer(device) or device_customer(device).pk != user.customer_id:
                return JsonResponse({"error": "This device is not assigned to your customer."}, status=403)
        elif user.role == Role.BR_ADMIN:
            if not user.customer_id or branch.customer_id != user.customer_id:
                return JsonResponse({"error": "This branch is outside your customer scope."}, status=403)
            if not device_customer(device) or device_customer(device).pk != user.customer_id:
                return JsonResponse({"error": "This device is not assigned to your customer."}, status=403)
        elif user.role == Role.ORG_SUPER_ADMIN:
            if not user.organization_id or branch.customer.organization_id != user.organization_id:
                return JsonResponse({"error": "This branch is outside your organization."}, status=403)

        with transaction.atomic():
            device.branch = branch
            device.assigned_by = user
            if not device.assigned_admin_id:
                default_admin = branch.assigned_admin_id or User.objects.filter(
                    customer_id=branch.customer_id,
                    role=Role.BR_ADMIN,
                    is_active=True,
                ).order_by("date_joined").values_list("pk", flat=True).first() or User.objects.filter(
                    customer_id=branch.customer_id,
                    role=Role.CUSTOMER,
                    is_active=True,
                ).order_by("date_joined").values_list("pk", flat=True).first()
                if default_admin:
                    device.assigned_admin_id = default_admin
            device.save(update_fields=["branch", "assigned_by", "assigned_admin", "updated_at"])

            # Keep one active customer mapping for the device.
            CustomerDeviceMapping.objects.filter(device=device, is_active=True).exclude(
                customer=branch.customer
            ).update(is_active=False)
            CustomerDeviceMapping.objects.update_or_create(
                customer=branch.customer,
                device=device,
                defaults={"is_active": True},
            )

        # Update the location map used by telemetry/dashboard filters.
        # Never fail the assignment just because a JSON cache cannot be written.
        try:
            mapping = build_device_location_map()
            item = mapping.get(device.ac_id, {})
            item.update({
                "ac_id": device.ac_id,
                "device_name": device.device_name or device.ac_id,
                "tpt_device_id": device.tpt_device_id or "",
                "device_id": device.tpt_device_id or "",
                "local_device_id": str(device.pk),
                "customer_id": str(branch.customer_id),
                "customer_name": branch.customer.company,
                "branch_id": str(branch.pk),
                "branch_name": branch.name,
                "hierarchy_type": branch.customer.hierarchy_type or "",
                "location_type": "DIRECT_BRANCH",
            })
            if branch.customer.hierarchy_type == "GEOGRAPHICAL":
                parent = branch.taluka or (branch.city.taluka if branch.city_id else None)
                if parent:
                    district = parent.district
                    state = district.state
                    item.update({
                        "state_id": str(state.pk), "state_name": state.name,
                        "district_id": str(district.pk), "district_name": district.name,
                        "taluka_id": str(parent.pk), "taluka_name": parent.name,
                    })
                if branch.city_id:
                    item.update({"city_id": str(branch.city_id), "city_name": branch.city.name})
            elif branch.customer.hierarchy_type == "ZONAL" and branch.division_id:
                division = branch.division
                region, circle, zone = division.region, division.region.circle, division.region.circle.zone
                item.update({
                    "zone_id": str(zone.pk), "zone_name": zone.name,
                    "circle_id": str(circle.pk), "circle_name": circle.name,
                    "region_id": str(region.pk), "region_name": region.name,
                    "division_id": str(division.pk), "division_name": division.name,
                })
            mapping[device.ac_id] = item
            save_device_location_map(mapping)
        except Exception:
            traceback.print_exc()

        # Canonical hierarchy placement for the dashboard's branch -> AC filter.
        # A JSON/tree-cache failure must not roll back the database assignment.
        try:
            _place_direct_branch_device_in_tree(device, branch)
        except Exception:
            traceback.print_exc()

        # Best-effort 3TP mappings: customer -> device and branch ASSET -> device.
        # Local assignment remains saved if either cloud relation fails.
        cloud_sync_errors = []
        try:
            if not branch.customer.tpt_customer_id or not device.tpt_device_id:
                raise ThreeTPError("Customer or device is missing its 3TP ID.")
            map_3tp_customer_to_device(
                request, branch.customer.tpt_customer_id, device.tpt_device_id
            )
        except Exception as exc:
            cloud_sync_errors.append("Customer-device mapping: " + _one_line(exc, 500))
        try:
            if not branch.tpt_asset_id:
                raise ThreeTPError("Branch has no 3TP ASSET ID. Synchronize the branch before assigning devices.")
            if not device.tpt_device_id:
                raise ThreeTPError("Device has no 3TP DEVICE ID.")
            _tpt_request(
                "POST", "/api/relation",
                payload={
                    "from": {"entityType": "ASSET", "id": branch.tpt_asset_id},
                    "to": {"entityType": "DEVICE", "id": device.tpt_device_id},
                    "type": "Contains", "typeGroup": "COMMON",
                },
            )
        except Exception as exc:
            cloud_sync_errors.append("Branch-asset/device relation: " + _one_line(exc, 500))
        cloud_sync_error = "; ".join(cloud_sync_errors)

        return JsonResponse({
            "status": "success",
            "message": (
                "Device assigned to branch locally, but one or more 3TP mappings need retry."
                if cloud_sync_error else "Device assigned to branch and linked to its 3TP ASSET successfully."
            ),
            "data": {
                "device_id": str(device.pk),
                "tpt_device_id": device.tpt_device_id or "",
                "ac_id": device.ac_id,
                "branch_id": str(branch.pk),
                "branch_name": branch.name,
                "customer_id": branch.customer_id,
                "customer_name": branch.customer.company,
                "assignment_status": "ASSIGNED",
                "tpt_mapping_status": "FAILED" if cloud_sync_error else "SYNCED",
                "tpt_mapping_error": cloud_sync_error,
            },
        }, status=200)
    except Exception as exc:
        return JsonResponse({"status": "error", "message": str(exc)}, status=500)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ac_faults_from_3tp(request):
    """Return already-processed fault telemetry from 3TP for an authorized AC."""
    from urllib.parse import urlencode
    from .models import ACDevice

    device_id = str(request.query_params.get("device_id", "")).strip()
    if not device_id:
        return Response({"status": "error", "message": "device_id is required."}, status=400)

    # Only allow querying a device mapped in this application and visible to this user.
    device = ACDevice.objects.filter(tpt_device_id=device_id).first()
    if not device:
        return Response({"status": "error", "message": "No local AC is mapped to this 3TP device ID."}, status=404)
    visible = scope_ac_records([{"ac_id": device.ac_id}], request.user)
    if not visible:
        return Response({"status": "error", "message": "You do not have access to this AC."}, status=403)

    now_ms = int(time.time() * 1000)
    try:
        start_ms = int(request.query_params.get("startTs", now_ms - 7 * 24 * 60 * 60 * 1000))
        end_ms = int(request.query_params.get("endTs", now_ms))
    except (TypeError, ValueError):
        return Response({"status": "error", "message": "startTs and endTs must be Unix milliseconds."}, status=400)
    if start_ms > end_ms:
        return Response({"status": "error", "message": "startTs must be <= endTs."}, status=400)

    keys = ["fault", "fault_type", "reason", "recommendation", "severity"]
    cfg = telemetry._config()
    base_url = cfg["base_url"]
    url = (f"{base_url}/api/plugins/telemetry/DEVICE/{device_id}/values/timeseries?"
           + urlencode({"keys": ",".join(keys), "startTs": start_ms, "endTs": end_ms,
                        "limit": 1000, "agg": "NONE", "orderBy": "DESC"}))
    try:
        if not telemetry._token.get("value"):
            telemetry._login(cfg)
        try:
            raw = telemetry._request(url, headers={"X-Authorization": f"Bearer {telemetry._token['value']}"})
        except Exception as exc:
            import urllib.error
            if isinstance(exc, urllib.error.HTTPError) and exc.code == 401:
                telemetry._login(cfg)
                raw = telemetry._request(url, headers={"X-Authorization": f"Bearer {telemetry._token['value']}"})
            else:
                raise
    except Exception as exc:
        log = __import__("logging").getLogger("telemetry")
        log.exception("Failed to fetch processed AC faults from 3TP")
        return Response({"status": "error", "message": "Could not fetch fault telemetry from 3TP.", "details": str(exc)}, status=502)

    # ThingsBoard returns one timestamped array per telemetry key. Merge values by timestamp.
    by_ts = {}
    if isinstance(raw, dict):
        for key in keys:
            values = raw.get(key, [])
            if not isinstance(values, list):
                continue
            for item in values:
                if not isinstance(item, dict) or item.get("ts") is None:
                    continue
                try:
                    ts = int(item["ts"])
                except (TypeError, ValueError):
                    continue
                row = by_ts.setdefault(ts, {"timestamp": ts})
                value = item.get("value")
                if isinstance(value, str):
                    stripped = value.strip()
                    if stripped[:1] in ("{", "["):
                        try:
                            value = json.loads(stripped)
                        except ValueError:
                            pass
                row[key] = value
    # Sort newest first and return only the latest processed record.
    results = sorted(
        by_ts.values(),
        key=lambda row: row["timestamp"],
        reverse=True,
    )

    results = results[:1]
    
    return Response({"status": "success", "device_id": device_id, "ac_id": device.ac_id,
                     "count": len(results), "data": results})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def profile(request):
    return Response("Profile Page")
