"""
Resolve / attach the Organization of a local user from their 3TP tenant.

3TP (ThingsBoard-style) returns the user's tenant at GET /api/auth/user:
    {"tenantId": {"id": "<uuid>", "entityType": "TENANT"}, ...}

We map that tenant id -> Organization.tpt_tenant_id, creating the local
Organization row on first sight. This removes the need to set
user.organization by hand.
"""
import logging

import requests
from django.conf import settings
from django.db import IntegrityError

from .models import Organization

log = logging.getLogger(__name__)

FALLBACK_ORG_CODE = "DEFAULT-ORG"


def _base_url():
    return (getattr(settings, "TPT_BASE_URL", "") or "https://3tp.tapasyatech.in").rstrip("/")


def _fetch_tenant(token):
    """Return (tenant_id, tenant_name) from 3TP, or (None, None) on failure."""
    try:
        r = requests.get(
            f"{_base_url()}/api/auth/user",
            headers={"X-Authorization": f"Bearer {token}",
                     "Authorization": f"Bearer {token}",
                     "Accept": "application/json"},
            timeout=float(getattr(settings, "TPT_TIMEOUT", 10)),
        )
        if r.status_code != 200:
            return None, None
        data = r.json() or {}
        tenant = data.get("tenantId") or {}
        tenant_id = tenant.get("id") if isinstance(tenant, dict) else tenant
        name = data.get("tenantName") or data.get("name") or ""
        return (str(tenant_id) if tenant_id else None), name
    except (requests.RequestException, ValueError) as exc:
        log.warning("Could not fetch 3TP tenant: %s", exc)
        return None, None


def _org_for_tenant(tenant_id, hint_name=""):
    org = Organization.objects.filter(tpt_tenant_id=tenant_id).first()
    if org:
        return org
    code = f"TPT-{tenant_id[:8].upper()}"
    name = (hint_name or f"Organization {tenant_id[:8]}").strip()
    try:
        org, _ = Organization.objects.get_or_create(
            tpt_tenant_id=tenant_id,
            defaults={"name": name, "code": code, "is_active": True},
        )
    except IntegrityError:
        # name/code clash -> make them unique
        org, _ = Organization.objects.get_or_create(
            tpt_tenant_id=tenant_id,
            defaults={"name": f"{name} ({tenant_id[:8]})", "code": code, "is_active": True},
        )
    return org


def _fallback_org():
    org, _ = Organization.objects.get_or_create(
        code=FALLBACK_ORG_CODE,
        defaults={"name": "Default Organization", "is_active": True},
    )
    return org


def ensure_user_organization(user, token=None):
    """Make sure `user.organization` is set. Safe to call on every request."""
    if user.organization_id:
        return user.organization

    org = None
    if token:
        tenant_id, name = _fetch_tenant(token)
        if tenant_id:
            org = _org_for_tenant(tenant_id, name)
    if org is None:
        org = _fallback_org()

    user.organization = org
    user.save(update_fields=["organization"])
    return org