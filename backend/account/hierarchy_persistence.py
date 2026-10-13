
# account/hierarchy_persistence.py

from uuid import uuid4

from django.core.exceptions import ValidationError
from django.db import transaction

from .models import (
    Customer,
    State, District, Taluka, City,
    Zone, Circle, Region, Division,
    Branch, Floor, HierarchyType,
)


def _code(prefix):
    return f"{prefix}-{uuid4().hex[:12].upper()}"


@transaction.atomic
def persist_customer_branch_floor(customer, body, hierarchy, location_type):
    """
    Persist one customer's hierarchy path, branch and optional floor.

    Returns:
        branch, floor_or_none, path
    """
    hierarchy = hierarchy.strip().upper()
    location_type = location_type.strip().upper()

    if not customer or not customer.is_active:
        raise ValidationError("An active customer is required.")

    if customer.hierarchy_type != hierarchy:
        raise ValidationError(
            "The requested hierarchy does not match this customer."
        )

    if hierarchy == HierarchyType.GEOGRAPHICAL:
        state_name = str(body.get("state_name") or "").strip()
        district_name = str(body.get("district_name") or "").strip()
        taluka_name = str(body.get("taluka_name") or "").strip()
        city_name = str(body.get("city_name") or "").strip()

        if not all([state_name, district_name, taluka_name, city_name]):
            raise ValidationError(
                "State, district, taluka and city are required."
            )

        state, _ = State.objects.get_or_create(
            customer=customer,
            name=state_name,
            defaults={"code": _code("ST")},
        )
        district, _ = District.objects.get_or_create(
            state=state,
            name=district_name,
            defaults={"code": _code("DT")},
        )
        taluka, _ = Taluka.objects.get_or_create(
            district=district,
            name=taluka_name,
            defaults={"code": _code("TL")},
        )
        city, _ = City.objects.get_or_create(
            taluka=taluka,
            name=city_name,
            defaults={"code": _code("CT")},
        )

        branch_name = str(body.get("branch_name") or "").strip()
        if not branch_name:
            raise ValidationError("branch_name is required.")

        branch, _ = Branch.objects.get_or_create(
            city=city,
            name=branch_name,
            defaults={
                "customer": customer,
                "code": _code("BR"),
                "pincode": str(body.get("pincode") or "").strip(),
            },
        )

        path = {
            "state_id": str(state.pk),
            "state_name": state.name,
            "district_id": str(district.pk),
            "district_name": district.name,
            "taluka_id": str(taluka.pk),
            "taluka_name": taluka.name,
            "city_id": str(city.pk),
            "city_name": city.name,
        }

    elif hierarchy == HierarchyType.ZONAL:
        zone_name = str(body.get("zone_name") or "").strip()
        circle_name = str(body.get("circle_name") or "").strip()
        region_name = str(body.get("region_name") or "").strip()
        division_name = str(body.get("division_name") or "").strip()

        if not all([zone_name, circle_name, region_name, division_name]):
            raise ValidationError(
                "Zone, circle, region and division are required."
            )

        zone, _ = Zone.objects.get_or_create(
            customer=customer,
            name=zone_name,
            defaults={"code": _code("ZN")},
        )
        circle, _ = Circle.objects.get_or_create(
            zone=zone,
            name=circle_name,
            defaults={"code": _code("CR")},
        )
        region, _ = Region.objects.get_or_create(
            circle=circle,
            name=region_name,
            defaults={"code": _code("RG")},
        )
        division, _ = Division.objects.get_or_create(
            region=region,
            name=division_name,
            defaults={"code": _code("DV")},
        )

        branch_name = str(body.get("branch_name") or "").strip()
        if not branch_name:
            raise ValidationError("branch_name is required.")

        branch, _ = Branch.objects.get_or_create(
            division=division,
            name=branch_name,
            defaults={
                "customer": customer,
                "code": _code("BR"),
                "pincode": str(body.get("pincode") or "").strip(),
            },
        )

        path = {
            "zone_id": str(zone.pk),
            "zone_name": zone.name,
            "circle_id": str(circle.pk),
            "circle_name": circle.name,
            "region_id": str(region.pk),
            "region_name": region.name,
            "division_id": str(division.pk),
            "division_name": division.name,
        }

    else:
        raise ValidationError(
            "hierarchy must be GEOGRAPHICAL or ZONAL."
        )

    # Validate existing branch ownership and hierarchy consistency.
    if branch.customer_id != customer.pk:
        raise ValidationError(
            "This branch is already associated with a different customer."
        )

    if location_type == "BRANCH":
        floor = None

    elif location_type == "FLOOR":
        floor_name = str(body.get("floor_name") or "").strip()
        if not floor_name:
            raise ValidationError("floor_name is required.")

        floor, _ = Floor.objects.get_or_create(
            branch=branch,
            name=floor_name,
            defaults={"code": _code("FL")},
        )

    else:
        raise ValidationError("location_type must be BRANCH or FLOOR.")

    path.update({
        "branch_id": str(branch.pk),
        "branch_name": branch.name,
    })

    if floor:
        path.update({
            "floor_id": str(floor.pk),
            "floor_name": floor.name,
        })

    return branch, floor, path
