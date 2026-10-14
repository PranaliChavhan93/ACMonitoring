
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
        if user.branch_id:
            return qs.filter(pk=user.branch_id)

        return qs.none()

    if user.role == Role.ENGINEER:
        if user.branch_id:
            return qs.filter(pk=user.branch_id)

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
        return qs.filter(
            branch__in=accessible_branches(user)
        )

    if user.role == Role.ENGINEER:
        return qs.filter(
            pk=user.site_id
        ) if user.site_id else qs.none()

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
        return qs.filter(
            site__branch__in=accessible_branches(user)
        )

    if user.role == Role.ENGINEER:
        return qs.filter(
            site_id=user.site_id
        ) if user.site_id else qs.none()

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
