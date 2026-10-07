import re

from rest_framework import serializers
from django.contrib.auth import authenticate
from django.db import transaction
from .models import (
    ACData,
    DashboardPreference,
    User,
    Organization,
    Customer,
    HierarchyType,
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
    CustomerSiteMapping,
    SiteDeviceMapping,
    CustomerDeviceMapping,
    Role,
)

class ACDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = ACData
        fields = [
            "id",
            "timestamp",
            "ac_id",
            "indoor_temperature",
            "outdoor_temperature",
            "indoor_humidity",
            "outdoor_humidity",
            "voltage",
            "current",
        ]

class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = "__all__"


class CustomerSerializer(serializers.ModelSerializer):

    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        min_length=6,
    )

    login_email = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = "__all__"

        read_only_fields = [
            "organization",
            "tpt_customer_id",
            "created_at",
            "updated_at",
        ]

        validators = []

    # ============================================================
    # LOGIN EMAIL
    # ============================================================

    def get_login_email(self, obj):
        return (
            User.objects
            .filter(
                customer=obj,
                role=Role.CUSTOMER,
            )
            .values_list(
                "email",
                flat=True,
            )
            .first()
        )

    @staticmethod
    def _login_email_for(customer):

        return (
            customer.contact_person_email
            or customer.company_email
            or ""
        ).strip().lower()

    # ============================================================
    # CREATE CUSTOMER LOGIN
    # ============================================================

    def _ensure_login(
        self,
        customer,
        password,
    ):
        """
        Create or update the Bank Customer login.
        """

        login = (
            User.objects
            .filter(
                customer=customer,
                role=Role.CUSTOMER,
            )
            .first()
        )

        # Existing login
        if login:

            if password:
                login.set_password(
                    password
                )

            login.email = (
                self._login_email_for(
                    customer
                )
            )

            login.name = (
                customer.contact_person
                or customer.company
            )

            login.phone = (
                customer.admin_mobile
                or customer.phone
            )

            login.is_active = (
                customer.is_active
            )

            login.save()

            return login

        # New login
        email = self._login_email_for(
            customer
        )

        if not email:
            raise serializers.ValidationError(
                {
                    "contact_person_email": (
                        "An email is required "
                        "to create the bank login."
                    )
                }
            )

        if User.objects.filter(
            email__iexact=email
        ).exists():

            raise serializers.ValidationError(
                {
                    "contact_person_email": (
                        "A user with this "
                        "email already exists."
                    )
                }
            )

        login = User(
            email=email,

            name=(
                customer.contact_person
                or customer.company
            ),

            phone=(
                customer.admin_mobile
                or customer.phone
            ),

            role=Role.CUSTOMER,

            organization=(
                customer.organization
            ),

            customer=customer,

            is_active=(
                customer.is_active
            ),
        )

        login.set_password(
            password
        )

        login.save()

        return login

    # ============================================================
    # VALIDATION
    # ============================================================

    def validate_company(
        self,
        value,
    ):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Bank name is required."
            )

        return value

    def validate_code(
        self,
        value,
    ):
        value = value.strip().upper()

        if not value:
            raise serializers.ValidationError(
                "Bank code is required."
            )

        return value

    def validate_bank_short_name(
        self,
        value,
    ):
        return value.strip().upper()

    def validate_company_email(
        self,
        value,
    ):
        return value.strip().lower()

    def validate_contact_person_email(
        self,
        value,
    ):
        return value.strip().lower()

    def validate_pan(
        self,
        value,
    ):
        value = value.strip().upper()

        if value and not re.match(
            r"^[A-Z]{5}[0-9]{4}[A-Z]$",
            value,
        ):
            raise serializers.ValidationError(
                "Enter a valid PAN number."
            )

        return value

    def validate_gstin(
        self,
        value,
    ):
        value = value.strip().upper()

        if value and len(value) != 15:
            raise serializers.ValidationError(
                "GSTIN must contain 15 characters."
            )

        return value

    def validate_pincode(
        self,
        value,
    ):
        value = value.strip()

        if value and not re.match(
            r"^\d{6}$",
            value,
        ):
            raise serializers.ValidationError(
                "PIN code must contain exactly 6 digits."
            )

        return value

    # ============================================================
    # OBJECT VALIDATION
    # ============================================================

    def validate(
        self,
        attrs,
    ):

        request = self.context.get(
            "request"
        )

        user = getattr(
            request,
            "user",
            None,
        )

        # Organization
        if self.instance:

            organization = (
                self.instance.organization
            )

        else:

            organization = getattr(
                user,
                "organization",
                None,
            )

        if not organization:

            raise serializers.ValidationError(
                {
                    "organization": (
                        "Could not determine "
                        "organization."
                    )
                }
            )

        # --------------------------------------------------------
        # BANK CODE UNIQUE
        # --------------------------------------------------------

        code = (
            attrs.get("code")
            or getattr(
                self.instance,
                "code",
                None,
            )
        )

        if code:

            duplicates = (
                Customer.objects
                .filter(
                    organization=organization,
                    code=code,
                )
            )

            if self.instance:

                duplicates = (
                    duplicates.exclude(
                        pk=self.instance.pk
                    )
                )

            if duplicates.exists():

                raise serializers.ValidationError(
                    {
                        "code": (
                            "A bank with this "
                            "code already exists "
                            "in your organization."
                        )
                    }
                )

        # --------------------------------------------------------
        # HIERARCHY
        # --------------------------------------------------------

        if self.instance is None:

            if not attrs.get(
                "hierarchy_type"
            ):

                raise serializers.ValidationError(
                    {
                        "hierarchy_type": (
                            "Select Geographical "
                            "or Zonal."
                        )
                    }
                )

        else:

            new_hierarchy = (
                attrs.get(
                    "hierarchy_type"
                )
            )

            if (
                new_hierarchy
                and
                new_hierarchy
                != self.instance.hierarchy_type
                and
                self.instance.branches.exists()
            ):

                raise serializers.ValidationError(
                    {
                        "hierarchy_type": (
                            "This bank already "
                            "has branches. "
                            "Hierarchy type "
                            "cannot be changed."
                        )
                    }
                )

        return attrs

    # ============================================================
    # CREATE
    # ============================================================

    def create(
        self,
        validated_data,
    ):

        password = validated_data.pop(
            "password",
            "",
        )

        with transaction.atomic():

            customer = super().create(
                validated_data
            )

            if password:
                self._ensure_login(
                    customer,
                    password,
                )

        return customer

    # ============================================================
    # UPDATE
    # ============================================================

    def update(
        self,
        instance,
        validated_data,
    ):

        password = validated_data.pop(
            "password",
            "",
        )

        with transaction.atomic():

            customer = super().update(
                instance,
                validated_data,
            )

            login = (
                User.objects
                .filter(
                    customer=customer,
                    role=Role.CUSTOMER,
                )
                .first()
            )

            if login:

                login.email = (
                    customer.contact_person_email
                    or customer.company_email
                ).strip().lower()

                login.name = (
                    customer.contact_person
                    or customer.company
                )

                login.phone = (
                    customer.admin_mobile
                    or customer.phone
                )

                login.is_active = (
                    customer.is_active
                )

                if password:
                    login.set_password(
                        password
                    )

                login.save()

            elif password:

                self._ensure_login(
                    customer,
                    password,
                )

        return customer


class ZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Zone
        fields = "__all__"

class CircleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Circle
        fields = "__all__"

class RegionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Region
        fields = "__all__"

class DivisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Division
        fields = "__all__"

class StateSerializer(serializers.ModelSerializer):
    class Meta:
        model = State
        fields = "__all__"


class DistrictSerializer(serializers.ModelSerializer):
    class Meta:
        model = District
        fields = "__all__"

class TalukaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Taluka
        fields = "__all__"

class CitySerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = "__all__"


class BranchSerializer(serializers.ModelSerializer):
    # ----- Geographical ancestors -----
    city_name     = serializers.CharField(source="city.name",                         read_only=True, default=None)
    taluka_name   = serializers.CharField(source="city.taluka.name",                  read_only=True, default=None)
    district_name = serializers.CharField(source="city.taluka.district.name",         read_only=True, default=None)
    state_name    = serializers.CharField(source="city.taluka.district.state.name",   read_only=True, default=None)

    # ----- Zonal ancestors -----
    division_name = serializers.CharField(source="division.name",                          read_only=True, default=None)
    region_name   = serializers.CharField(source="division.region.name",                   read_only=True, default=None)
    circle_name   = serializers.CharField(source="division.region.circle.name",            read_only=True, default=None)
    zone_name     = serializers.CharField(source="division.region.circle.zone.name",       read_only=True, default=None)

    customer_name = serializers.CharField(source="customer.company", read_only=True, default=None)

    class Meta:
        model  = Branch
        fields = "__all__"

class FloorSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(
        source="branch.name",
        read_only=True
    )

    customer_id = serializers.IntegerField(
        source="branch.customer_id",
        read_only=True
    )

    class Meta:
        model = Floor
        fields = [
            "id",
            "name",
            "code",
            "branch",
            "branch_name",
            "customer_id",
            "is_active",
            "created_at",
        ]

class SiteSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    floor_name = serializers.CharField(source="floor.name", read_only=True, default=None)

    customer_id = serializers.IntegerField(
        source="branch.customer_id", read_only=True, allow_null=True
    )
    customer_name = serializers.CharField(
        source="branch.customer.company", read_only=True, allow_null=True
    )
    organization_id = serializers.UUIDField(
        source="branch.customer.organization_id", read_only=True, allow_null=True
    )

    admins = serializers.SerializerMethodField()
    engineers = serializers.SerializerMethodField()

    class Meta:
        model = Site
        fields = [
            "id",
            "name",
            "code",
            "address",
            "latitude",
            "longitude",
            "branch",
            "branch_name",
            "floor",
            "floor_name",
            "customer_id",
            "customer_name",
            "organization_id",
            "admins",
            "engineers",
            "is_active",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "branch_name",
            "floor_name",
            "customer_id",
            "customer_name",
            "organization_id",
            "admins",
            "engineers",
            "created_at",
        ]

    def get_admins(self, obj):
        return list(
            obj.users.filter(
                role=Role.BR_ADMIN,
                is_active=True,
            ).values(
                "id", "name", "email", "phone", "role", "branch_id", "site_id"
            )
        )

    def get_engineers(self, obj):
        return list(
            obj.users.filter(
                role=Role.ENGINEER,
                is_active=True,
            ).values(
                "id", "name", "email", "phone", "role", "branch_id", "site_id"
            )
        )

    def validate(self, attrs):
        branch = attrs.get("branch") or getattr(self.instance, "branch", None)
        floor = attrs.get("floor", getattr(self.instance, "floor", None))

        if not branch:
            raise serializers.ValidationError(
                {"branch": "A site must belong to a branch."}
            )

        if not branch.customer_id:
            raise serializers.ValidationError(
                {"branch": "The selected branch is not assigned to a customer."}
            )

        if floor and floor.branch_id != branch.id:
            raise serializers.ValidationError({
                "floor": "Selected floor does not belong to the selected branch."
            })

        request = self.context.get("request")
        user = getattr(request, "user", None)

        if user and user.is_authenticated:
            if user.role == Role.CUSTOMER:
                if branch.customer_id != user.customer_id:
                    raise serializers.ValidationError({
                        "branch": "You can only use sites belonging to your customer."
                    })
            elif user.role == Role.BR_ADMIN:
                if branch.id != user.branch_id:
                    raise serializers.ValidationError({
                        "branch": "You can only use sites belonging to your branch."
                    })
            elif user.role == Role.ENGINEER:
                if self.instance is None or self.instance.id != user.site_id:
                    raise serializers.ValidationError({
                        "branch": "You can only use your assigned site."
                    })
            elif user.role == Role.ORG_SUPER_ADMIN:
                if branch.customer.organization_id != user.organization_id:
                    raise serializers.ValidationError({
                        "branch": "This site is outside your organization."
                    })

        return attrs

class ACDeviceSerializer(serializers.ModelSerializer):

    site_name = serializers.CharField(
        source="site.name",
        read_only=True,
        allow_null=True
    )

    branch_id = serializers.UUIDField(
        source="site.branch_id",
        read_only=True,
        allow_null=True
    )

    branch_name = serializers.CharField(
        source="site.branch.name",
        read_only=True,
        allow_null=True
    )

    customer_id = serializers.UUIDField(
        source="site.branch.customer_id",
        read_only=True,
        allow_null=True
    )

    customer_name = serializers.CharField(
        source="site.branch.customer.company",
        read_only=True,
        allow_null=True
    )

    class Meta:
        model = ACDevice

        fields = [
            "id",
            "ac_id",
            "device_name",
            "site",
            "site_name",
            "branch_id",
            "branch_name",
            "customer_id",
            "customer_name",
            "status",
            "capacity_ton",
            "installation_date",
            "last_maintenance_date",
            "assigned_by",
            "tpt_device_id",
            "tpt_sync_status",
            "tpt_sync_error",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "site_name",
            "branch_id",
            "branch_name",
            "customer_id",
            "customer_name",
            "tpt_device_id",
            "tpt_sync_status",
            "tpt_sync_error",
            "created_at",
            "updated_at",
        ]

    def validate_ac_id(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "AC ID is required."
            )

        return value

    def validate(self, attrs):

        site = attrs.get(
            "site",
            getattr(self.instance, "site", None)
        )

        if site:

            if not site.branch_id:
                raise serializers.ValidationError({
                    "site": "Selected site is not assigned to a branch."
                })

            if not site.branch.customer_id:
                raise serializers.ValidationError({
                    "site": "Selected site is not assigned to a customer."
                })

        request = self.context.get("request")
        user = getattr(request, "user", None)

        if user and user.is_authenticated:

            if user.role == Role.CUSTOMER:

                if (
                    site
                    and site.branch.customer_id
                    != user.customer_id
                ):
                    raise serializers.ValidationError({
                        "site":
                        "You can only assign devices to your customer sites."
                    })

            elif user.role == Role.BR_ADMIN:

                if (
                    site
                    and site.branch_id
                    != user.branch_id
                ):
                    raise serializers.ValidationError({
                        "site":
                        "You can only assign devices to your branch sites."
                    })

            elif user.role == Role.ENGINEER:

                if (
                    site
                    and site.id != user.site_id
                ):
                    raise serializers.ValidationError({
                        "site":
                        "You can only assign devices to your assigned site."
                    })

        return attrs

# ============================================================
# CUSTOMER → SITE
# ============================================================

class CustomerSiteMappingSerializer(
    serializers.ModelSerializer
):

    customer_name = serializers.CharField(
        source="customer.company",
        read_only=True
    )

    site_name = serializers.CharField(
        source="site.name",
        read_only=True
    )

    class Meta:
        model = CustomerSiteMapping

        fields = [
            "id",
            "customer",
            "customer_name",
            "site",
            "site_name",
            "is_active",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "customer_name",
            "site_name",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):

        customer = attrs["customer"]
        site = attrs["site"]

        # Site must belong to the same customer
        if (
            site.branch_id
            and site.branch.customer_id
            and site.branch.customer_id != customer.id
        ):
            raise serializers.ValidationError({
                "site":
                "This site belongs to another customer."
            })

        if not site.branch_id:
            raise serializers.ValidationError({
                "site":
                "Site is not assigned to a branch."
            })

        return attrs


# ============================================================
# SITE → DEVICE
# ============================================================

class SiteDeviceMappingSerializer(
    serializers.ModelSerializer
):

    site_name = serializers.CharField(
        source="site.name",
        read_only=True
    )

    device_name = serializers.CharField(
        source="device.device_name",
        read_only=True
    )

    ac_id = serializers.CharField(
        source="device.ac_id",
        read_only=True
    )

    class Meta:
        model = SiteDeviceMapping

        fields = [
            "id",
            "site",
            "site_name",
            "device",
            "device_name",
            "ac_id",
            "is_active",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "site_name",
            "device_name",
            "ac_id",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):

        site = attrs["site"]
        device = attrs["device"]

        if not site.branch_id:
            raise serializers.ValidationError({
                "site":
                "Site is not assigned to a branch."
            })

        if not site.branch.customer_id:
            raise serializers.ValidationError({
                "site":
                "Site is not assigned to a customer."
            })

        return attrs


# ============================================================
# CUSTOMER → DEVICE
# ============================================================

class CustomerDeviceMappingSerializer( serializers.ModelSerializer ):
    customer_name = serializers.CharField( source="customer.company", read_only=True )
    device_name = serializers.CharField( source="device.device_name", read_only=True )
    ac_id = serializers.CharField( source="device.ac_id", read_only=True )

    class Meta:
        model = CustomerDeviceMapping

        fields = [
            "id",
            "customer",
            "customer_name",
            "device",
            "device_name",
            "ac_id",
            "is_active",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "customer_name",
            "device_name",
            "ac_id",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):

        customer = attrs["customer"]
        device = attrs["device"]

        if device.site_id:

            site_customer_id = (
                device.site.branch.customer_id
            )

            if site_customer_id != customer.id:
                raise serializers.ValidationError({
                    "device":
                    "This device belongs to a site of another customer."
                })

        return attrs


class UserSerializer(serializers.ModelSerializer):
    scope_name = serializers.CharField(read_only=True)
    scope_id = serializers.SerializerMethodField()
    customer_hierarchy_type = serializers.SerializerMethodField()
    zone_name = serializers.CharField(source="zone.name", read_only=True, default=None)
    circle_name = serializers.CharField(source="circle.name", read_only=True, default=None)
    state_name = serializers.CharField(source="state.name", read_only=True, default=None)
    district_name = serializers.CharField(source="district.name", read_only=True, default=None)

    class Meta:
        model = User
        fields = [
            "id", "email", "name", "phone", "role",
            "organization", "customer", "zone", "circle", "state", "district", "branch", "site",
            "scope_name", "scope_id", "customer_hierarchy_type",
            "zone_name", "circle_name", "state_name", "district_name",
            "is_active", "date_joined", "last_login",
        ]
        read_only_fields = ["id", "date_joined", "last_login"]

    def get_scope_id(self, obj):
        _, scope_id = obj.get_scope()
        return str(scope_id) if scope_id else None

    def get_customer_hierarchy_type(self, obj):
        return obj.customer.hierarchy_type if obj.customer_id and obj.customer else None


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    role = serializers.ChoiceField(choices=Role.choices)

    def validate(self, data):
        user = authenticate(
            request=self.context.get("request"),
            username=data["email"],
            password=data["password"],
        )
        if not user:
            raise serializers.ValidationError("Invalid email or password.")
        if not user.is_active:
            raise serializers.ValidationError("This account is disabled.")
        if user.role != data["role"]:
            raise serializers.ValidationError(
                f"This account belongs to '{user.get_role_display()}'. "
                f"Please select the correct role."
            )
        data["user"] = user
        return data

class AdminSerializer(serializers.ModelSerializer):
    password   = serializers.CharField(write_only=True, required=False, allow_blank=True)
    scope_name = serializers.CharField(read_only=True)
    scope_id   = serializers.SerializerMethodField()
    customer_hierarchy_type = serializers.SerializerMethodField()
    zone_name = serializers.CharField(source="zone.name", read_only=True, default=None)
    circle_name = serializers.CharField(source="circle.name", read_only=True, default=None)
    state_name = serializers.CharField(source="state.name", read_only=True, default=None)
    district_name = serializers.CharField(source="district.name", read_only=True, default=None)

    class Meta:
        model = User
        fields = [
            "id", "email", "name", "phone", "role",
            "organization", "customer", "zone", "circle", "state", "district", "branch", "site",
            "scope_name", "scope_id", "customer_hierarchy_type",
            "zone_name", "circle_name", "state_name", "district_name",
            "password",
            "is_active", "date_joined", "last_login",
        ]
        read_only_fields = ["id", "date_joined", "last_login", "scope_name", "scope_id"]
        extra_kwargs = {
            "organization": {"required": False},
            "customer":     {"required": False},
            "zone":         {"required": False},
            "circle":       {"required": False},
            "region":       {"required": False},
            "division":     {"required": False},
            "state":        {"required": False},
            "district":     {"required": False},
            "taluka":       {"required": False},
            "city":         {"required": False},
            "branch":       {"required": False},
            "site":         {"required": False},
        }

    def get_scope_id(self, obj):
        _, scope_id = obj.get_scope()
        return str(scope_id) if scope_id else None

    def get_customer_hierarchy_type(self, obj):
        return obj.customer.hierarchy_type if obj.customer_id and obj.customer else None

    CREATABLE_ROLES = (Role.BR_ADMIN, Role.ENGINEER)

    def validate_role(self, value):
        if self.instance is not None and self.instance.role == value:
            return value
        if value not in self.CREATABLE_ROLES:
            raise serializers.ValidationError(
                "Only Branch Admin and Engineer accounts can be created here. "
                "Customers are created from the Customers page."
            )
        return value

    def validate_customer(self, value):
        request = self.context.get("request")
        acting = getattr(request, "user", None)
        if value is None or acting is None:
            return value
        if acting.role == Role.ORG_SUPER_ADMIN and value.organization_id != acting.organization_id:
            raise serializers.ValidationError("Customer does not belong to your organization.")
        if acting.role == Role.CUSTOMER and value.pk != acting.customer_id:
            raise serializers.ValidationError("You can only assign users to your own customer.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        customer = attrs.get("customer") or getattr(self.instance, "customer", None)
        zone = attrs.get("zone") if "zone" in attrs else getattr(self.instance, "zone", None)
        circle = attrs.get("circle") if "circle" in attrs else getattr(self.instance, "circle", None)
        state = attrs.get("state") if "state" in attrs else getattr(self.instance, "state", None)
        district = attrs.get("district") if "district" in attrs else getattr(self.instance, "district", None)

        if not customer:
            return attrs

        if zone and zone.customer_id != customer.pk:
            raise serializers.ValidationError({"zone": "Selected zone does not belong to the selected customer."})
        if circle and (not zone or circle.zone_id != zone.pk):
            raise serializers.ValidationError({"circle": "Selected circle must belong to the selected zone."})
        if state and state.customer_id != customer.pk:
            raise serializers.ValidationError({"state": "Selected state does not belong to the selected customer."})
        if district and (not state or district.state_id != state.pk):
            raise serializers.ValidationError({"district": "Selected district must belong to the selected state."})

        site = attrs.get("site") if "site" in attrs else getattr(self.instance, "site", None)
        branch = attrs.get("branch") if "branch" in attrs else getattr(self.instance, "branch", None)

        if site:
            if not site.branch_id:
                raise serializers.ValidationError({"site": "Selected site has no branch."})

            if branch and site.branch_id != branch.pk:
                raise serializers.ValidationError({
                    "site": "Selected site does not belong to the selected branch."
                })

            if customer and site.branch.customer_id != customer.pk:
                raise serializers.ValidationError({
                    "site": "Selected site does not belong to the selected customer."
                })

            # A site is the most specific scope. Keep branch/customer in sync.
            attrs["branch"] = site.branch
            attrs["customer"] = site.branch.customer

        if customer.hierarchy_type == HierarchyType.GEOGRAPHICAL and (zone or circle):
            raise serializers.ValidationError({"zone": "This customer uses the Geographical hierarchy; assign State/District instead."})
        if customer.hierarchy_type == HierarchyType.ZONAL and (state or district):
            raise serializers.ValidationError({"state": "This customer uses the Zonal hierarchy; assign Zone/Circle instead."})

        return attrs

        geo_chain = ["state", "district", "taluka", "city"]
        zon_chain = ["zone", "circle", "region", "division"]

        def _chain_ok(chain, attrs_or_instance, expected_hierarchy):
            filled = [
                (name, attrs_or_instance.get(name)
                    if isinstance(attrs_or_instance, dict)
                    else getattr(attrs_or_instance, name, None))
                for name in chain
            ]
            # Drop nulls, keep order
            filled = [(n, v) for n, v in filled if v is not None]
            # The chain must be contiguous from the top (no gaps)
            if not filled:
                return
            # Verify each step links to the previous
            for i in range(1, len(filled)):
                prev_name, prev_obj = filled[i - 1]
                name, obj = filled[i]
                parent_attr = {
                    "district": "state",
                    "taluka":   "district",
                    "city":     "taluka",
                    "circle":   "zone",
                    "region":   "circle",
                    "division": "region",
                }[name]
                if getattr(obj, f"{parent_attr}_id") != prev_obj.pk:
                    raise serializers.ValidationError(
                        {name: f"Selected {name} does not belong to the selected {parent_attr}."}
                    )
            # Verify the top of the chain belongs to the customer
            top_name, top_obj = filled[0]
            if top_obj.customer_id != customer.pk:
                raise serializers.ValidationError({top_name: "Does not belong to the selected customer."})

        # Get values for whichever fields the request actually sends
        payload = {}
        for name in geo_chain + zon_chain:
            if name in attrs:
                payload[name] = attrs[name]
            elif self.instance is not None:
                payload[name] = getattr(self.instance, name, None)

        # Hierarchy must match the customer
        if customer.hierarchy_type == HierarchyType.GEOGRAPHICAL:
            if any(payload.get(n) for n in zon_chain):
                raise serializers.ValidationError(
                    {"zone": "This customer uses the Geographical hierarchy; assign State/District/Taluka/City instead."}
                )
            _chain_ok(geo_chain, payload, "GEOGRAPHICAL")
        elif customer.hierarchy_type == HierarchyType.ZONAL:
            if any(payload.get(n) for n in geo_chain):
                raise serializers.ValidationError(
                    {"state": "This customer uses the Zonal hierarchy; assign Zone/Circle/Region/Division instead."}
                )
            _chain_ok(zon_chain, payload, "ZONAL")

    def create(self, validated_data):
        password = validated_data.pop("password", "") or "changeme123"
        user = User(**validated_data)
        user.set_password(password)
        user._skip_scope_check = True       # ← bypass scope check on this save
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        instance = super().update(instance, validated_data)
        if password:
            instance.set_password(password)

        # Activate the user once the required scope is present.
        scope_field = {
            "ORG_SUPER_ADMIN": "organization",
            "CUSTOMER":      "customer",
            "BR_ADMIN":        "branch",
            "ENGINEER":        "site",
            # "ZONAL_ADMIN":     "zone",
            # "CIRCLE_ADMIN":    "circle",
        }.get(instance.role)

        if instance.role == "ORG_SUPER_ADMIN" or (
            scope_field and getattr(instance, f"{scope_field}_id")
        ):
            instance.is_active = True

        instance.save()
        return instance

class DashboardPreferenceSerializer(serializers.ModelSerializer):

    class Meta:
        model = DashboardPreference
        fields = [
            "id",
            "name",
            "customer",
            "main_filters",
            "card_filters",
            "visible_widgets",
            "is_default",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "customer",
            "created_at",
            "updated_at",
        ]

