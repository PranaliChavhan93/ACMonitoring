"""Create a customer-owned copy of the selected master location hierarchy.

Top-level location IDs and all descendants are customer-specific database rows.
Branches and floors are deliberately not copied from the sample tree: they are
operational records and should be created/assigned by the customer afterwards.
"""
from __future__ import annotations

import json
from pathlib import Path

from django.conf import settings
from django.db import transaction

from account.models import (
    Country, Customer, State, District, Taluka, City, Branch, Floor,
    Zone, Circle, Region, Division,
)


def _tree_file(hierarchy_type: str) -> Path:
    filename = (
        "locationData_geographical.json"
        if hierarchy_type == "GEOGRAPHICAL"
        else "locationData_zonal.json"
    )
    return Path(settings.BASE_DIR) / "data" / filename


def _unique_code(source_code, customer_id, max_length=50):
    suffix = f"-C{customer_id}"
    source_code = str(source_code or "NODE")
    return f"{source_code[:max_length-len(suffix)]}{suffix}"


def initialize_customer_hierarchy(customer: Customer, *, force: bool = False) -> dict:
    """Copy the customer's selected hierarchy from the master JSON tree.

    Idempotent by default: if the customer's top-level nodes already exist,
    it leaves the existing hierarchy untouched. Use force only for an empty
    or deliberately reset hierarchy (force does not delete existing records).
    """
    hierarchy = (customer.hierarchy_type or "").upper()
    if hierarchy not in {"GEOGRAPHICAL", "ZONAL"}:
        raise ValueError("Customer hierarchy_type must be GEOGRAPHICAL or ZONAL")

    top_model = State if hierarchy == "GEOGRAPHICAL" else Zone
    if not force and top_model.objects.filter(customer=customer).exists():
        return {"created": False, "reason": "already_initialized", "hierarchy_type": hierarchy}

    path = _tree_file(hierarchy)
    if not path.exists():
        raise FileNotFoundError(f"Master hierarchy file not found: {path}")
    with path.open("r", encoding="utf-8") as source:
        roots = json.load(source)
    if not roots:
        raise ValueError(f"Master hierarchy file is empty: {path.name}")

    country_data = roots[0]
    country, _ = Country.objects.get_or_create(
        code=str(country_data.get("country_id") or "IND")[:3],
        defaults={"name": country_data.get("country_name") or "India"},
    )

    counts = {"states": 0, "districts": 0, "talukas": 0, "cities": 0,
              "zones": 0, "circles": 0, "regions": 0, "divisions": 0,
              "branches": 0, "floors": 0}

    with transaction.atomic():
        if hierarchy == "GEOGRAPHICAL":
            state_data = country_data.get("states") or []
            states = [State(customer=customer, country=country,
                            name=item["state_name"], code=str(item.get("state_id") or item["state_name"]))
                      for item in state_data]
            State.objects.bulk_create(states, batch_size=500)
            state_map = {id(item): obj for item, obj in zip(state_data, states)}
            counts["states"] = len(states)

            district_data = []
            for item in state_data:
                state_obj = state_map[id(item)]
                for child in item.get("districts") or []:
                    district_data.append((child, state_obj))
            districts = [District(state=parent, name=item["district_name"],
                                  code=_unique_code(f"{item.get('district_id') or 'D'}-{item['district_name']}", customer.pk))
                         for item, parent in district_data]
            District.objects.bulk_create(districts, batch_size=1000)
            district_map = {id(item): obj for (item, _), obj in zip(district_data, districts)}
            counts["districts"] = len(districts)

            taluka_data = []
            for item in state_data:
                for district in item.get("districts") or []:
                    district_obj = district_map[id(district)]
                    for child in district.get("talukas") or []:
                        taluka_data.append((child, district_obj))
            talukas = [Taluka(district=parent, name=item["taluka_name"],
                              code=_unique_code(item.get("taluka_id") or item["taluka_name"], customer.pk))
                       for item, parent in taluka_data]
            Taluka.objects.bulk_create(talukas, batch_size=1000)
            taluka_map = {id(item): obj for (item, _), obj in zip(taluka_data, talukas)}
            counts["talukas"] = len(talukas)

            city_data = []
            for item in state_data:
                for district in item.get("districts") or []:
                    for taluka in district.get("talukas") or []:
                        taluka_obj = taluka_map[id(taluka)]
                        for child in taluka.get("cities") or []:
                            city_data.append((child, taluka_obj))
            cities = [City(taluka=parent, name=item["city_name"],
                           code=_unique_code(item.get("city_id") or item["city_name"], customer.pk))
                      for item, parent in city_data]
            City.objects.bulk_create(cities, batch_size=1000)
            city_map = {id(item): obj for (item, _), obj in zip(city_data, cities)}
            counts["cities"] = len(cities)

            branch_data = []
            for item in state_data:
                for district in item.get("districts") or []:
                    for taluka in district.get("talukas") or []:
                        for city in taluka.get("cities") or []:
                            city_obj = city_map[id(city)]
                            for child in city.get("branches") or []:
                                branch_data.append((child, city_obj))
            branches = [Branch(customer=customer, city=parent, name=item["branch_name"],
                               code=_unique_code(item.get("branch_id") or item["branch_name"], customer.pk))
                        for item, parent in branch_data]
            Branch.objects.bulk_create(branches, batch_size=1000)
            branch_map = {id(item): obj for (item, _), obj in zip(branch_data, branches)}
            counts["branches"] = len(branches)

            floor_data = []
            for item, _city_obj in branch_data:
                branch_obj = branch_map[id(item)]
                for child in item.get("floors") or []:
                    floor_data.append((child, branch_obj))
            floors = [Floor(branch=parent, name=item["floor_name"],
                            code=_unique_code(item.get("floor_id") or item["floor_name"], customer.pk))
                      for item, parent in floor_data]
            Floor.objects.bulk_create(floors, batch_size=1000)
            counts["floors"] = len(floors)

        else:
            zone_data = country_data.get("zones") or []
            zones = [Zone(customer=customer, country=country, name=item["zone_name"],
                          code=_unique_code(item.get("zone_id") or item["zone_name"], customer.pk))
                     for item in zone_data]
            Zone.objects.bulk_create(zones, batch_size=500)
            zone_map = {id(item): obj for item, obj in zip(zone_data, zones)}
            counts["zones"] = len(zones)

            circle_data = []
            for item in zone_data:
                zone_obj = zone_map[id(item)]
                for child in item.get("circles") or []:
                    circle_data.append((child, zone_obj))
            circles = [Circle(zone=parent, name=item["circle_name"],
                              code=_unique_code(item.get("circle_id") or item["circle_name"], customer.pk))
                       for item, parent in circle_data]
            Circle.objects.bulk_create(circles, batch_size=1000)
            circle_map = {id(item): obj for (item, _), obj in zip(circle_data, circles)}
            counts["circles"] = len(circles)

            region_data = []
            for item in zone_data:
                for circle in item.get("circles") or []:
                    circle_obj = circle_map[id(circle)]
                    for child in circle.get("regions") or []:
                        region_data.append((child, circle_obj))
            regions = [Region(circle=parent, name=item["region_name"],
                              code=_unique_code(item.get("region_id") or item["region_name"], customer.pk))
                       for item, parent in region_data]
            Region.objects.bulk_create(regions, batch_size=1000)
            region_map = {id(item): obj for (item, _), obj in zip(region_data, regions)}
            counts["regions"] = len(regions)

            division_data = []
            for item in zone_data:
                for circle in item.get("circles") or []:
                    for region in circle.get("regions") or []:
                        region_obj = region_map[id(region)]
                        for child in region.get("divisions") or []:
                            division_data.append((child, region_obj))
            divisions = [Division(region=parent, name=item["division_name"],
                                  code=_unique_code(item.get("division_id") or item["division_name"], customer.pk))
                         for item, parent in division_data]
            Division.objects.bulk_create(divisions, batch_size=1000)
            division_map = {id(item): obj for (item, _), obj in zip(division_data, divisions)}
            counts["divisions"] = len(divisions)

            branch_data = []
            for item in zone_data:
                for circle in item.get("circles") or []:
                    for region in circle.get("regions") or []:
                        for division in region.get("divisions") or []:
                            division_obj = division_map[id(division)]
                            for child in division.get("branches") or []:
                                branch_data.append((child, division_obj))
            branches = [Branch(customer=customer, division=parent, name=item["branch_name"],
                               code=_unique_code(item.get("branch_id") or item["branch_name"], customer.pk))
                        for item, parent in branch_data]
            Branch.objects.bulk_create(branches, batch_size=1000)
            branch_map = {id(item): obj for (item, _), obj in zip(branch_data, branches)}
            counts["branches"] = len(branches)

            floor_data = []
            for item, _division_obj in branch_data:
                branch_obj = branch_map[id(item)]
                for child in item.get("floors") or []:
                    floor_data.append((child, branch_obj))
            floors = [Floor(branch=parent, name=item["floor_name"],
                            code=_unique_code(item.get("floor_id") or item["floor_name"], customer.pk))
                      for item, parent in floor_data]
            Floor.objects.bulk_create(floors, batch_size=1000)
            counts["floors"] = len(floors)

    return {"created": True, "hierarchy_type": hierarchy, **counts}
