# account/signals.py
from django.db import connection
from django.db.models.signals import post_save, pre_save, post_migrate
from django.dispatch import receiver
from django.core.exceptions import ValidationError

from .models import (
    User, Role, Organization, Customer, HierarchyType,
    Zone, Circle, Region, Division, Branch, Floor, Site, LoginAudit,
)

from rest_framework.exceptions import ValidationError as DRFValidationError

DEMO_PASSWORD = "Admin@123"

ROLE_SCOPE_FIELD = {
    Role.ORG_SUPER_ADMIN:"organization",
    Role.CUSTOMER: "customer",
    Role.BR_ADMIN: "branch",
    Role.ENGINEER: "site",
}

ROLE_KEEP_FIELDS = {
    Role.ORG_SUPER_ADMIN: set(),
    Role.CUSTOMER:        {"customer"},
    Role.BR_ADMIN:        {"customer", "zone", "circle", "branch"},
    Role.ENGINEER:        {"customer", "zone", "circle", "branch", "site"},
}

ROLE_REQUIRED_FIELD = {
    Role.ORG_SUPER_ADMIN: None,
    Role.CUSTOMER:        "customer",
    Role.BR_ADMIN:        "customer",
    Role.ENGINEER:        "customer",
}

ALL_SCOPE_FIELDS = ["customer", "zone", "circle", "branch", "site"]


@receiver(pre_save, sender=User)
def validate_user_scope(sender, instance, **kwargs):
    if not instance.role:
        raise DRFValidationError("User must have a role.")

    if instance.role not in ROLE_KEEP_FIELDS:
        raise DRFValidationError(f"Unknown role: {instance.role}")

    keep = ROLE_KEEP_FIELDS[instance.role]

    # --- Derive the upper chain from the most specific scope that is set ---
    if "site" in keep and instance.site_id:
        site = Site.objects.select_related("branch").get(pk=instance.site_id)
        site_customer_id = site.branch.customer_id
        if instance.customer_id and site_customer_id and instance.customer_id != site_customer_id:
            raise DRFValidationError("Selected site does not belong to this customer.")
        instance.branch_id = site.branch_id
        instance.customer_id = site_customer_id or instance.customer_id

    if "branch" in keep and instance.branch_id and not instance.site_id:
        branch_customer_id = (
            Branch.objects.filter(pk=instance.branch_id)
            .values_list("customer_id", flat=True)
            .first()
        )
        if instance.customer_id and branch_customer_id and instance.customer_id != branch_customer_id:
            raise DRFValidationError("Selected branch does not belong to this customer.")
        instance.customer_id = branch_customer_id or instance.customer_id

    if "zone" in keep and instance.zone_id:
        zone_customer_id = (
            Zone.objects.filter(pk=instance.zone_id)
            .values_list("customer_id", flat=True)
            .first()
        )
        if instance.customer_id and zone_customer_id and instance.customer_id != zone_customer_id:
            raise DRFValidationError("Selected zone does not belong to this customer.")
        instance.customer_id = zone_customer_id or instance.customer_id

    # --- Required scope (skipped for the "created, not yet assigned" step) ---
    required_field = ROLE_REQUIRED_FIELD.get(instance.role)
    if required_field and not getattr(instance, "_skip_scope_check", False):
        if not getattr(instance, f"{required_field}_id"):
            raise DRFValidationError(
                f"Role '{instance.role}' requires '{required_field}' to be set."
            )

    # --- Clear scopes this role must not carry — never organization ---
    for f in ALL_SCOPE_FIELDS:
        if f not in keep:
            setattr(instance, f"{f}_id", None)


@receiver(post_save, sender=User)
def set_staff_flag(sender, instance, created, **kwargs):
    if instance.role in [Role.ORG_SUPER_ADMIN, Role.CUSTOMER]:
        if not instance.is_staff:
            User.objects.filter(pk=instance.pk).update(is_staff=True)


def _table_ready(model) -> bool:
    return model._meta.db_table in connection.introspection.table_names()


# @receiver(post_migrate)
# def seed_demo_data(sender, **kwargs):
#     if sender.name != "account":
#         return
#     if not all(
#         _table_ready(m)
#         for m in (Organization, Customer, User, Zone, Circle, Region, Division, Branch, Site)
#     ):
#         return

#     try:
#         org, _ = Organization.objects.get_or_create(
#             code="DEMO-ORG",
#             defaults={"name": "Demo Organization", "is_active": True},
#         )

#         customer, _ = Customer.objects.get_or_create(
#             organization=org,
#             code="CUST-01",
#             defaults={
#                 "company": "TowerLink Infra",
#                 "company_email": "contact@towerlink.com",
#                 "contact_person": "Demo Contact",
#                 "contact_person_email": "contact@towerlink.com",
#                 "phone": "+91-9123456789",
#                 "hierarchy_type": HierarchyType.ZONAL,
#                 "is_active": True,
#             },
#         )

#         zone, _ = Zone.objects.get_or_create(
#             code="ZONE-NORTH",
#             defaults={"customer": customer, "name": "North Zone"},
#         )

#         circle, _ = Circle.objects.get_or_create(
#             code="CIR-DELHI",
#             defaults={"zone": zone, "name": "Delhi Circle"},
#         )

#         region, _ = Region.objects.get_or_create(
#             code="REG-DELHI-C",
#             defaults={"circle": circle, "name": "Delhi Central Region"},
#         )

#         division, _ = Division.objects.get_or_create(
#             code="DIV-KB",
#             defaults={"region": region, "name": "Karol Bagh Division"},
#         )

#         branch, _ = Branch.objects.get_or_create(
#             code="BR-101",
#             defaults={"customer": customer, "division": division, "name": "Karol Bagh Branch"},
#         )

#         floor, _ = Floor.objects.get_or_create(
#             code="BR-101-F1",
#             defaults={"branch": branch, "name": "Floor 1"},
#         )

#         # Direct-under-branch AC (no floor)
#         site, _ = Site.objects.get_or_create(
#             code="SITE-9001",
#             defaults={
#                 "branch": branch,
#                 "floor": None,
#                 "name": "SITE-9001",
#                 "address": "Rooftop, Karol Bagh, New Delhi",
#                 "latitude": 28.6519,
#                 "longitude": 77.1909,
#             },
#         )

#         # AC under a specific floor
#         Site.objects.get_or_create(
#             code="SITE-9002",
#             defaults={
#                 "branch": branch,
#                 "floor": floor,
#                 "name": "SITE-9002",
#                 "address": "Floor 1, Karol Bagh, New Delhi",
#                 "latitude": 28.6519,
#                 "longitude": 77.1909,
#             },
#         )

#         users = [
#             dict(
#                 email="superadmin@org.com",
#                 name="Ravi Menon",
#                 role=Role.ORG_SUPER_ADMIN,
#                 organization=org,
#                 is_staff=True,
#                 is_superuser=True,
#             ),
#             dict(
#                 email="custadmin@customer.com",
#                 name="Priya Sharma",
#                 role=Role.CUSTOMER,
#                 customer=customer,
#             ),
#             dict(
#                 email="branch@customer.com",
#                 name="Mohit Raj",
#                 role=Role.BR_ADMIN,
#                 branch=branch,
#             ),
#             dict(
#                 email="engineer@customer.com",
#                 name="Kiran Das",
#                 role=Role.ENGINEER,
#                 site=site,
#             ),
#         ]

#         for data in users:
#             email = data.pop("email")
#             user, created = User.objects.get_or_create(email=email, defaults=data)

#             # Always (re)apply scope + password
#             for k, v in data.items():
#                 setattr(user, k, v)
#             user.set_password(DEMO_PASSWORD)
#             user.save()


#     except Exception as exc:
#         import logging
#         logging.getLogger(__name__).warning("seed_demo_data skipped: %s", exc)


import json
import logging
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from account.models import Customer, Country, State, District, Taluka, City

logger = logging.getLogger(__name__)


def get_geographical_json_path():
    return (
        Path(settings.BASE_DIR)
        / "data"
        / "locationData_geographical.json"
    )


@transaction.atomic
def sync_geographical_hierarchy(customer):
    """
    Sync geographical hierarchy from JSON into the database
    for the specified customer.
    """

    json_path = get_geographical_json_path()

    if not json_path.exists():
        logger.error("Geographical JSON file not found: %s", json_path)
        return

    with open(json_path, "r", encoding="utf-8") as file:
        tree = json.load(file)

    for country_data in tree:
        country_code = country_data.get("country_id")
        country_name = country_data.get("country_name")

        if not country_code or not country_name:
            continue

        # Reuse an existing country where possible.
        country, _ = Country.objects.get_or_create(
            code=country_code,
            defaults={"name": country_name},
        )

        for state_data in country_data.get("states", []):
            state_code = state_data.get("state_id")
            state_name = state_data.get("state_name")

            if not state_code or not state_name:
                continue

            state, _ = State.objects.update_or_create(
                customer=customer,
                code=state_code,
                defaults={
                    "country": country,
                    "name": state_name,
                    "is_active": True,
                },
            )

            for district_data in state_data.get("districts", []):
                district_code = district_data.get("district_id")
                district_name = district_data.get("district_name")

                if not district_code or not district_name:
                    continue

                district, _ = District.objects.update_or_create(
                    state=state,
                    code=district_code,
                    defaults={
                        "name": district_name,
                        "is_active": True,
                    },
                )

                for taluka_data in district_data.get("talukas", []):
                    taluka_code = taluka_data.get("taluka_id")
                    taluka_name = taluka_data.get("taluka_name")

                    if not taluka_code or not taluka_name:
                        continue

                    taluka, _ = Taluka.objects.update_or_create(
                        district=district,
                        code=taluka_code,
                        defaults={
                            "name": taluka_name,
                            "is_active": True,
                        },
                    )

                    for city_data in taluka_data.get("cities", []):
                        city_code = city_data.get("city_id")
                        city_name = city_data.get("city_name")

                        if not city_code or not city_name:
                            continue

                        City.objects.update_or_create(
                            taluka=taluka,
                            code=city_code,
                            defaults={
                                "name": city_name,
                                "is_active": True,
                            },
                        )

    logger.info(
        "Geographical hierarchy synced for customer %s",
        customer.pk,
    )


@receiver(post_save, sender=Customer)
def customer_geographical_hierarchy_signal(
    sender, instance, created, **kwargs
):
    """
    Automatically sync the geographical hierarchy when a
    geographical customer is created or saved.
    """

    if getattr(instance, "hierarchy", None) != "GEOGRAPHICAL":
        return

    # Prevent a signal from breaking customer creation if the
    # JSON file or hierarchy models are not configured correctly.
    try:
        sync_geographical_hierarchy(instance)
    except Exception:
        logger.exception(
            "Failed to sync hierarchy for customer %s",
            instance.pk,
        )
