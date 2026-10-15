
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
    CustomerSiteMapping,
)
from .hierarchy_tree_sync import sync_branch_to_tree


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


def _is_uuid(value):
    try:
        uuid.UUID(str(value))
        return True
    except (ValueError, TypeError, AttributeError):
        return False


def _resolve_location(model, value, **extra_filters):
    """
    Resolve a location node by its UUID primary key OR by its `code` field.

    The frontend may send either form depending on which API populated the
    dropdown (e.g. the filter API returns seed codes like 'MH-D01-T01-C01'
    instead of real UUIDs).
    """
    if value in (None, "", "null", "undefined", "None"):
        return None

    value_str = str(value).strip()

    # Fast path: real UUID primary key
    if _is_uuid(value_str):
        obj = model.objects.filter(pk=value_str, **extra_filters).first()
        if obj:
            return obj

    # Fallback: lookup by code (case-insensitive)
    return model.objects.filter(code__iexact=value_str, **extra_filters).first()

def _validate_location(customer, data):
    """Validate the complete location chain for the selected customer.

    Accepts either UUIDs or human-readable codes for every level, because
    the frontend's filter API currently returns codes (e.g. 'MH-D01-T01-C01').
    """
    hierarchy = customer.hierarchy_type

    # ------------------------------------------------------------------
    # GEOGRAPHICAL: State -> District -> Taluka -> City
    # ------------------------------------------------------------------
    if hierarchy == "GEOGRAPHICAL":
        if not data.get("city_id"):
            raise ValueError("Please select a city.")

        city = _resolve_location(
            City,
            data.get("city_id"),
            is_active=True,
            taluka__is_active=True,
            taluka__district__is_active=True,
            taluka__district__state__is_active=True,
        )

        if not city:
            raise ValueError(
                "The selected city was not found or is inactive."
            )

        # Resolve the ancestors and make sure they line up with the city.
        state = _resolve_location(
            State,
            data.get("state_id"),
            is_active=True,
        )

        if not state or state.pk != city.taluka.district.state_id:
            raise ValueError("The selected state does not match the city.")
        district = _resolve_location(
            District,
            data.get("district_id"),
            state=state,
            is_active=True,
        )
        if not district or district.pk != city.taluka.district_id:
            raise ValueError("The selected district does not match the city.")

        taluka = _resolve_location(
            Taluka,
            data.get("taluka_id"),
            district=district,
            is_active=True,
        )
        if not taluka or taluka.pk != city.taluka_id:
            raise ValueError("The selected taluka does not match the city.")

        return {"city": city, "division": None}

    # ------------------------------------------------------------------
    # ZONAL: Zone -> Circle -> Region -> Division
    # ------------------------------------------------------------------
    if hierarchy == "ZONAL":
        if not data.get("division_id"):
            raise ValueError("Please select a division.")

        division = _resolve_location(
            Division,
            data.get("division_id"),
            is_active=True,
            region__is_active=True,
            region__circle__is_active=True,
            region__circle__zone__is_active=True,
        )

        if not division:
            raise ValueError(
                "The selected division was not found or is inactive."
            )
        
        zone = _resolve_location(
            Zone,
            data.get("zone_id"),
            is_active=True,
        )

        if not zone or zone.pk != division.region.circle.zone_id:
            raise ValueError("The selected zone does not match the division.")
        
        circle = _resolve_location(
            Circle,
            data.get("circle_id"),
            zone=zone,
            is_active=True,
        )
        if not circle or circle.pk != division.region.circle_id:
            raise ValueError(
                "The selected circle does not match the division."
            )

        region = _resolve_location(
            Region,
            data.get("region_id"),
            circle=circle,
            is_active=True,
        )
        if not region or region.pk != division.region_id:
            raise ValueError(
                "The selected region does not match the division."
            )

        return {"city": None, "division": division}

    raise ValueError(
        "The selected customer has no valid hierarchy configured."
    )

def _hierarchy_path(site):
    from .views import resolve_site_hierarchy
    try:
        return resolve_site_hierarchy(site)
    except Exception:
        return {}


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
    except (ValueError, DjangoValidationError) as exc:   # ← add DjangoValidationError
        return _error(str(exc))

    branch_id = data.get("branch_id")
    create_branch = bool(data.get("create_branch", False))

    branch_name = str(data.get("branch_name") or "").strip()
    branch_code = str(data.get("branch_code") or "").strip().upper()

    
    site_name = str( data.get("site_name") or data.get("name") or "" ).strip()
    site_code = str( data.get("site_code") or data.get("code") or "" ).strip().upper()

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

    try:
        with transaction.atomic():

            # STEP 1: Create a new branch OR select an existing branch
            if create_branch:
                if Branch.objects.filter(code=branch_code).exists():
                    return _error("This branch code already exists.")

                duplicate = Branch.objects.filter(
                    customer=customer,
                    name__iexact=branch_name,
                )

                if location["city"]:
                    duplicate = duplicate.filter(city=location["city"])
                elif location["division"]:
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
                    .filter(customer=customer)
                )

                if _is_uuid(branch_id):
                    branch = branch.filter(pk=branch_id).first()
                else:
                    branch = branch.filter(code__iexact=branch_id).first()

                if branch is None:
                    return _error(
                        "The selected branch does not belong to this customer."
                    )
    
            # STEP 2: Create requested floors
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

            # STEP 3: Select an existing floor, if provided
            floor = None

            if selected_floor_id:
                floor = Floor.objects.filter(
                    pk=selected_floor_id,
                    branch=branch,
                ).first()

                if floor is None:
                    raise ValueError(
                        "The selected floor does not belong to this branch."
                    )

            # STEP 4: Validate site uniqueness
            if Site.objects.filter(code=site_code).exists():
                raise ValueError("This site code already exists.")

            if Site.objects.filter(
                branch=branch,
                name__iexact=site_name,
            ).exists():
                raise ValueError(
                    "A site with this name already exists in this branch."
                )

            # STEP 5: Create the site locally
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

    except (ValueError, DjangoValidationError) as exc:   # ← add DjangoValidationError
        return _error(str(exc))

    except IntegrityError:
        return _error(
            "A duplicate branch, floor, or site was detected. "
            "Refresh the page and try again.",
            status.HTTP_409_CONFLICT,
        )

    # Customer -> Site assignment is saved locally as well.
    CustomerSiteMapping.objects.update_or_create(
        customer=customer,
        site=site,
        defaults={"is_active": True},
    )

    # Put the branch (+ floors) into the location tree so the hierarchy
    # filter and the branch picker show it right away.
    sync_branch_to_tree(branch)

    sync_message = ""
    try:
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
                "hierarchy_path": _hierarchy_path(site),
            },
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_hierarchy_branch(request):
    """Create a branch directly under a selected Taluka (geographical) or
    Division (zonal), without creating a Site or requiring a City node."""
    data = request.data
    # console.log(data);

    try:
        customer = _customer_for_request(request, data.get("customer_id"))
        hierarchy = str(customer.hierarchy_type or "").upper()
        name = str(data.get("name") or data.get("branch_name") or "").strip()
        code = str(data.get("code") or data.get("branch_code") or "").strip().upper()
        address = str(data.get("address") or "").strip()
        pincode = str(data.get("pincode") or "").strip()

        if not name or not code:
            return _error("Branch name and branch code are required.")
        if len(pincode) not in (0, 6) or (pincode and not pincode.isdigit()):
            return _error("Pincode must be empty or contain exactly 6 digits.")
        if Branch.objects.filter(code__iexact=code).exists():
            return _error("This branch code already exists.")

        if hierarchy == "GEOGRAPHICAL":
            state = _resolve_location(State, data.get("state_id"), is_active=True)
            if not state:
                return _error("Select a valid state.")
            district = _resolve_location(District, data.get("district_id"), state=state, is_active=True)
            if not district:
                return _error("The selected district does not belong to the selected state.")
            taluka = _resolve_location(Taluka, data.get("taluka_id"), district=district, is_active=True)
            if not taluka:
                return _error("The selected taluka does not belong to the selected district.")
            if Branch.objects.filter(customer=customer, taluka=taluka, name__iexact=name).exists():
                return _error("A branch with this name already exists under this taluka.")
            branch = Branch.objects.create(
                customer=customer, taluka=taluka, city=None, division=None,
                name=name, code=code, pincode=pincode, address=address,
            )
        elif hierarchy == "ZONAL":
            zone = _resolve_location(Zone, data.get("zone_id"), is_active=True)
            if not zone:
                return _error("Select a valid zone.")
            circle = _resolve_location(Circle, data.get("circle_id"), zone=zone, is_active=True)
            if not circle:
                return _error("The selected circle does not belong to the selected zone.")
            region = _resolve_location(Region, data.get("region_id"), circle=circle, is_active=True)
            if not region:
                return _error("The selected region does not belong to the selected circle.")
            division = _resolve_location(Division, data.get("division_id"), region=region, is_active=True)
            if not division:
                return _error("The selected division does not belong to the selected region.")
            if Branch.objects.filter(customer=customer, division=division, name__iexact=name).exists():
                return _error("A branch with this name already exists under this division.")
            branch = Branch.objects.create(
                customer=customer, city=None, taluka=None, division=division,
                name=name, code=code, pincode=pincode, address=address,
            )
        else:
            return _error("The selected customer has no valid hierarchy configured.")

        # The local Branch is also represented as an ASSET in 3TP.
        # Import at runtime to avoid a module import cycle (views imports shared models).
        cloud_error = ""
        try:
            from .views import _tpt_enabled, _tpt_request, _tpt_extract_id, sync_customer

            if _tpt_enabled():
                if not getattr(customer, "tpt_customer_id", ""):
                    sync_customer(customer)
                    customer.refresh_from_db()
                if not getattr(customer, "tpt_customer_id", ""):
                    raise RuntimeError("Customer has no 3TP customer ID; could not link branch asset.")

                # Existing Site creation used /api/asset. Reuse the same 3TP asset API,
                # but name the asset for this Branch and do not create a Site record.
                _, asset_data = _tpt_request(
                    "POST", "site", payload={"name": branch.name, "type": "default"}
                )
                asset_id = _tpt_extract_id(asset_data)
                if not asset_id:
                    raise RuntimeError("3TP did not return an asset ID for the branch.")

                # Persist the returned ID immediately so a customer-link failure can
                # be retried without creating a duplicate ASSET.
                branch.tpt_asset_id = asset_id
                branch.tpt_sync_status = "PENDING"
                branch.tpt_sync_error = ""
                branch.save(update_fields=["tpt_asset_id", "tpt_sync_status", "tpt_sync_error"])

                # Link the branch asset to the 3TP customer using the same endpoint
                # previously used by Site creation.
                _tpt_request(
                    "POST",
                    f"/api/customer/{customer.tpt_customer_id}/asset/{asset_id}",
                )
                branch.tpt_sync_status = "SYNCED"
                branch.tpt_sync_error = ""
                branch.save(update_fields=["tpt_sync_status", "tpt_sync_error"])
        except Exception as exc:
            cloud_error = str(exc)[:1000]
            branch.tpt_sync_status = "FAILED"
            branch.tpt_sync_error = cloud_error
            branch.save(update_fields=["tpt_sync_status", "tpt_sync_error"])

        sync_branch_to_tree(branch)
        is_cloud_synced = bool(branch.tpt_asset_id and branch.tpt_sync_status == "SYNCED")
        return Response({
            "status": "success" if is_cloud_synced else "partial_success",
            "message": (
                "Branch created locally and synchronized to 3TP as an ASSET."
                if is_cloud_synced else
                ("Branch created locally, but 3TP ASSET synchronization failed. Retry synchronization before assigning devices."
                 if cloud_error else "Branch created locally. 3TP integration is disabled or synchronization is pending.")
            ),
            "data": {
                "id": str(branch.pk), "name": branch.name, "code": branch.code,
                "address": branch.address, "pincode": branch.pincode,
                "customer_id": str(branch.customer_id),
                "hierarchy_type": hierarchy,
                "taluka_id": str(branch.taluka_id) if branch.taluka_id else None,
                "division_id": str(branch.division_id) if branch.division_id else None,
                "tpt_asset_id": branch.tpt_asset_id or "",
                "tpt_sync_status": branch.tpt_sync_status,
                "tpt_sync_error": branch.tpt_sync_error or "",
            },
        }, status=status.HTTP_201_CREATED)
    except PermissionError as exc:
        return _error(str(exc), status.HTTP_403_FORBIDDEN)
    except (ValueError, DjangoValidationError, IntegrityError) as exc:
        return _error(str(exc))
