
from django.db.models import Exists, OuterRef, Q

from .models import (
    Role,
    User,
    Customer,
    Branch,
    Site,
    ACDevice,
    CustomerDeviceMapping,
    CustomerSiteMapping,
)


def device_customer(device):
    """
    The customer a device belongs to.

    1. An explicit Customer -> Device assignment (CustomerDeviceMapping) wins.
    2. Otherwise fall back to the customer that owns the site's branch.
    """
    mapping = (
        CustomerDeviceMapping.objects
        .select_related("customer")
        .filter(device=device, is_active=True)
        .order_by("-updated_at")
        .first()
    )
    if mapping:
        return mapping.customer

    site = device.site if device.site_id else None
    if site and site.branch_id and site.branch.customer_id:
        return site.branch.customer
    return None


def site_customer(site):
    """The customer whose hierarchy a site sits in (branch owner, else mapping)."""
    if site.branch_id and site.branch.customer_id:
        return site.branch.customer
    mapping = (
        CustomerSiteMapping.objects
        .select_related("customer")
        .filter(site=site, is_active=True)
        .order_by("-updated_at")
        .first()
    )
    return mapping.customer if mapping else None


def accessible_branches(user):
    qs = Branch.objects.select_related(
        "customer",
        "city",
        "division",
    )

    if user.role == Role.ORG_SUPER_ADMIN:
        return qs.filter(
            customer__organization_id=user.organization_id
        )

    if user.role == Role.CUSTOMER:
        return qs.filter(
            customer_id=user.customer_id
        )

    if user.role == Role.BR_ADMIN:
        # Admin scope is assigned by the customer at state or zone level.
        # Restrict all descendant branches to that scope; retain legacy branch
        # assignment as a fallback for older accounts.
        hierarchy = getattr(user.customer, "hierarchy_type", None) if user.customer_id else None
        if hierarchy == "GEOGRAPHICAL" and user.state_id:
            return qs.filter(
                customer_id=user.customer_id,
                **{
                    "city__taluka__district__state_id": user.state_id,
                },
            ) | qs.filter(
                customer_id=user.customer_id,
                taluka__district__state_id=user.state_id,
            )
        if hierarchy == "ZONAL" and user.zone_id:
            return qs.filter(
                customer_id=user.customer_id,
                division__region__circle__zone_id=user.zone_id,
            )
        if user.branch_id:
            return qs.filter(pk=user.branch_id, customer_id=user.customer_id)
        return qs.none()

    if user.role == Role.ENGINEER:
        # Legacy fallback: engineer's branch is the maximum allowed scope.
        # Individual AC/task assignments should be enforced by the task/device
        # assignment layer when that model is enabled.
        if user.branch_id:
            return qs.filter(pk=user.branch_id, customer_id=user.customer_id)
        return qs.none()

    return qs.none()


def accessible_sites(user):
    qs = Site.objects.select_related(
        "branch",
        "branch__customer",
        "floor",
    ).distinct()

    if user.role == Role.ORG_SUPER_ADMIN:
        return qs.filter(
            Q(
                branch__customer__organization_id=
                user.organization_id
            )
            | Q(
                customer_mappings__customer__organization_id=
                user.organization_id,
                customer_mappings__is_active=True,
            )
        )

    if user.role == Role.CUSTOMER:
        return qs.filter(
            Q(branch__customer_id=user.customer_id)
            | Q(
                customer_mappings__customer_id=user.customer_id,
                customer_mappings__is_active=True,
            )
        )

    if user.role == Role.BR_ADMIN:
        return qs.filter(branch__in=accessible_branches(user))

    if user.role == Role.ENGINEER:
        # Do not grant all sites in the admin's scope to an engineer.
        # Existing site assignment is retained for compatibility.
        return qs.filter(pk=user.site_id, branch__in=accessible_branches(user)) if user.site_id else qs.none()

    return qs.none()


def accessible_devices(user):
    qs = ACDevice.objects.select_related(
        "site",
        "site__branch",
        "site__branch__customer",
    ).distinct()

    if user.role == Role.ORG_SUPER_ADMIN:
        return qs.filter(
            Q(
                site__branch__customer__organization_id=
                user.organization_id
            )
            | Q(
                customer_mappings__customer__organization_id=
                user.organization_id,
                customer_mappings__is_active=True,
            )
        )

    if user.role == Role.CUSTOMER:
        # A device explicitly assigned to another customer is never visible
        # here, even if it happens to sit on a site in this customer's tree.
        owned_by_someone_else = CustomerDeviceMapping.objects.filter(
            device=OuterRef("pk"),
            is_active=True,
        ).exclude(customer_id=user.customer_id)

        return qs.filter(
            Q(site__branch__customer_id=user.customer_id)
            | Q(
                customer_mappings__customer_id=user.customer_id,
                customer_mappings__is_active=True,
            )
        ).filter(~Exists(owned_by_someone_else))

    if user.role == Role.BR_ADMIN:
        legacy_scope = Q(branch__in=accessible_branches(user)) | Q(site__branch__in=accessible_branches(user))
        # Once a device is allocated to a specific admin, hide it from other admins.
        return qs.filter(Q(assigned_admin=user) | (Q(assigned_admin__isnull=True) & legacy_scope))

    if user.role == Role.ENGINEER:
        # Restrict to the engineer's directly assigned site and branch. This is
        # deliberately narrower than the admin's state/zone scope.
        if not user.site_id:
            return qs.none()
        return qs.filter(site_id=user.site_id, site__branch__in=accessible_branches(user))

    return qs.none()


def accessible_users(user):
    qs = User.objects.all()

    if user.role == Role.ORG_SUPER_ADMIN:
        return qs.filter(
            organization_id=user.organization_id
        )

    if user.role == Role.CUSTOMER:
        return qs.filter(
            customer_id=user.customer_id
        )

    if user.role == Role.BR_ADMIN:
        return qs.filter(
            role=Role.ENGINEER,
            branch_id=user.branch_id,
        )

    if user.role == Role.ENGINEER:
        return qs.filter(pk=user.pk)

    return qs.none()
