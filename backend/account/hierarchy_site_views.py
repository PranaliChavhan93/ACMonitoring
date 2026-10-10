
import uuid

from django.db import transaction, IntegrityError
from django.core.exceptions import ValidationError as DjangoValidationError

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    Role,
    Customer,
    State,
    District,
    Taluka,
    City,
    Zone,
    Circle,
    Region,
    Division,
    Branch,
    Floor,
    Site,
)


def _error(message, http_status=status.HTTP_400_BAD_REQUEST):
    return Response(
        {"status": "error", "message": message},
        status=http_status,
    )


def _customer_for_request(request, customer_id):
    user = request.user

    if user.role == Role.CUSTOMER:
        if not user.customer_id:
            raise ValueError("Your user account is not linked to a customer.")

        customer = Customer.objects.filter(
            pk=user.customer_id,
            is_active=True,
        ).first()

        if not customer:
            raise ValueError("Your customer account was not found.")

        # Ignore any customer ID supplied by the browser.
        return customer

    if user.role == Role.ORG_SUPER_ADMIN:
        if not user.organization_id:
            raise ValueError("Your account has no organization assigned.")

        if not customer_id:
            raise ValueError("Please select a customer.")

        customer = Customer.objects.filter(
            pk=customer_id,
            organization_id=user.organization_id,
            is_active=True,
        ).first()

        if not customer:
            raise ValueError(
                "The selected customer does not belong to your organization."
            )

        return customer

    raise PermissionError(
        "You do not have permission to use this creation workflow."
    )


def _validate_location(customer, data):
    """Validate the complete location chain for the selected customer."""
    hierarchy = customer.hierarchy_type

    if hierarchy == "GEOGRAPHICAL":
        city_id = data.get("city_id")

        if not city_id:
            raise ValueError("Please select a city.")

        city = (
            City.objects
            .select_related("taluka__district__state")
            .filter(
                pk=city_id,
                taluka__district__state__customer_id=customer.pk,
                is_active=True,
                taluka__is_active=True,
                taluka__district__is_active=True,
                taluka__district__state__is_active=True,
            )
            .first()
        )

        if not city:
            raise ValueError(
                "The selected city does not belong to this customer."
            )

        # Verify all submitted ancestor IDs too. This prevents a forged
        # state/district/taluka selection from disagreeing with the city.
        if str(data.get("state_id")) != str(city.taluka.district.state_id):
            raise ValueError("The selected state does not match the city.")

        if str(data.get("district_id")) != str(city.taluka.district_id):
            raise ValueError("The selected district does not match the city.")

        if str(data.get("taluka_id")) != str(city.taluka_id):
            raise ValueError("The selected taluka does not match the city.")

        return {"city": city, "division": None}

    if hierarchy == "ZONAL":
        division_id = data.get("division_id")

        if not division_id:
            raise ValueError("Please select a division.")

        division = (
            Division.objects
            .select_related("region__circle__zone")
            .filter(
                pk=division_id,
                region__circle__zone__customer_id=customer.pk,
                is_active=True,
                region__is_active=True,
                region__circle__is_active=True,
                region__circle__zone__is_active=True,
            )
            .first()
        )

        if not division:
            raise ValueError(
                "The selected division does not belong to this customer."
            )

        if str(data.get("zone_id")) != str(
            division.region.circle.zone_id
        ):
            raise ValueError("The selected zone does not match the division.")

        if str(data.get("circle_id")) != str(
            division.region.circle_id
        ):
            raise ValueError("The selected circle does not match the division.")

        if str(data.get("region_id")) != str(division.region_id):
            raise ValueError("The selected region does not match the division.")

        return {"city": None, "division": division}

    raise ValueError(
        "The selected customer has no valid hierarchy configured."
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_hierarchy_site(request):
    data = request.data

    try:
        customer = _customer_for_request(
            request,
            data.get("customer_id"),
        )
        location = _validate_location(customer, data)

    except PermissionError as exc:
        return _error(str(exc), status.HTTP_403_FORBIDDEN)
    except ValueError as exc:
        return _error(str(exc))

    branch_id = data.get("branch_id")
    create_branch = bool(data.get("create_branch", False))

    branch_name = str(data.get("branch_name") or "").strip()
    branch_code = str(data.get("branch_code") or "").strip().upper()

    site_name = str(data.get("site_name") or "").strip()
    site_code = str(data.get("site_code") or "").strip().upper()
    address = str(data.get("address") or "").strip()
    pincode = str(data.get("pincode") or "").strip()

    if not site_name or not site_code:
        return _error("Site name and site code are required.")

    if len(pincode) not in (0, 6) or (
        pincode and not pincode.isdigit()
    ):
        return _error("Pincode must be empty or contain exactly 6 digits.")

    floor_names = data.get("floor_names") or []
    if not isinstance(floor_names, list):
        return _error("floor_names must be a list.")

    floor_names = [str(name).strip() for name in floor_names]

    if len(floor_names) > 10:
        return _error("You can create a maximum of 10 floors at once.")

    if any(not name for name in floor_names):
        return _error("Every floor must have a name.")

    if len({name.casefold() for name in floor_names}) != len(floor_names):
        return _error("Floor names must be unique within this submission.")

    selected_floor_id = data.get("floor_id")

    if not create_branch and not branch_id:
        return _error("Select an existing branch or create a new branch.")

    if create_branch and (not branch_name or not branch_code):
        return _error("Branch name and branch code are required.")

    # Only local database work is wrapped in the transaction.
    # 3TP is called afterwards because external API requests cannot be
    # rolled back by a Django database transaction.
    try:
        with transaction.atomic():
            if create_branch:
                if Branch.objects.filter(code=branch_code).exists():
                    return _error("This branch code already exists.")

                duplicate = Branch.objects.filter(
                    customer=customer,
                    name__iexact=branch_name,
                )

                if location["city"]:
                    duplicate = duplicate.filter(city=location["city"])
                else:
                    duplicate = duplicate.filter(
                        division=location["division"]
                    )

                if duplicate.exists():
                    return _error(
                        "A branch with this name already exists at this location."
                    )

                branch = Branch.objects.create(
                    customer=customer,
                    city=location["city"],
                    division=location["division"],
                    name=branch_name,
                    code=branch_code,
                )
            else:
                branch = (
                    Branch.objects
                    .select_related("customer", "city", "division")
                    .filter(
                        pk=branch_id,
                        customer=customer,
                    )
                    .first()
                )

                if not branch:
                    return _error(
                        "The selected branch does not belong to this customer."
                    )

                # The branch must match the hierarchy path selected in the UI.
                if (
                    location["city"]
                    and branch.city_id != location["city"].pk
                ):
                    return _error(
                        "The selected branch does not belong to the selected city."
                    )

                if (
                    location["division"]
                    and branch.division_id != location["division"].pk
                ):
                    return _error(
                        "The selected branch does not belong to the selected division."
                    )

            floors = []
            for floor_name in floor_names:
                if Floor.objects.filter(
                    branch=branch,
                    name__iexact=floor_name,
                ).exists():
                    raise ValueError(
                        f"The floor '{floor_name}' already exists in this branch."
                    )

                floor = Floor.objects.create(
                    branch=branch,
                    name=floor_name,
                    code=f"FL-{uuid.uuid4().hex[:12].upper()}",
                )
                floors.append(floor)

            floor = None
            if selected_floor_id:
                floor = Floor.objects.filter(
                    pk=selected_floor_id,
                    branch=branch,
                ).first()

                if not floor:
                    raise ValueError(
                        "The selected floor does not belong to this branch."
                    )

            if Site.objects.filter(code=site_code).exists():
                raise ValueError("This site code already exists.")

            if Site.objects.filter(
                branch=branch,
                name__iexact=site_name,
            ).exists():
                raise ValueError(
                    "A site with this name already exists in this branch."
                )

            site = Site.objects.create(
                branch=branch,
                floor=floor,
                name=site_name,
                code=site_code,
                address=address,
                pincode=pincode,
                latitude=data.get("latitude") or None,
                longitude=data.get("longitude") or None,
                tpt_sync_status="PENDING",
                tpt_sync_error="",
            )

    except (ValueError, DjangoValidationError) as exc:
        return _error(str(exc))
    except IntegrityError:
        return _error(
            "A duplicate branch, floor, or site was detected. "
            "Refresh the page and try again.",
            status.HTTP_409_CONFLICT,
        )

    # Preserve the project's existing 3TP sync service.
    # The local records remain available if 3TP is temporarily unavailable.
    sync_message = ""
    try:
        # Imported lazily to avoid changing the existing views module.
        from .views import sync_site

        sync_site(site)
        site.refresh_from_db()

        if not site.tpt_site_id:
            site.tpt_sync_status = "PENDING"
            site.tpt_sync_error = (
                "Local site created; 3TP synchronization is not confirmed."
            )
            site.save(
                update_fields=["tpt_sync_status", "tpt_sync_error"]
            )
            sync_message = site.tpt_sync_error

    except Exception as exc:
        site.tpt_sync_status = "FAILED"
        site.tpt_sync_error = str(exc)[:2000]
        site.save(
            update_fields=["tpt_sync_status", "tpt_sync_error"]
        )
        sync_message = (
            "Local site created, but 3TP synchronization failed. "
            "Check the saved sync error before retrying."
        )

    return Response(
        {
            "status": "success",
            "message": "Branch/site workflow saved locally.",
            "data": {
                "customer_id": customer.pk,
                "hierarchy_type": customer.hierarchy_type,
                "branch_id": str(branch.pk),
                "branch_name": branch.name,
                "site_id": str(site.pk),
                "site_name": site.name,
                "floor_id": str(floor.pk) if floor else None,
                "created_floor_ids": [str(item.pk) for item in floors],
                "tpt_site_id": site.tpt_site_id,
                "tpt_sync_status": site.tpt_sync_status,
                "sync_message": sync_message,
            },
        },
        status=status.HTTP_201_CREATED,
    )
