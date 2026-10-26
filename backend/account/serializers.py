import re

from rest_framework import serializers
from django.contrib.auth import authenticate
from django.db import transaction
from .models import (
    ACData, Country, DashboardPreference, User, Organization, Customer,
    HierarchyType, Zone, Circle, Region, Division, State, District, Taluka,
    City, Branch, Floor, Site, ACDevice, CustomerSiteMapping, SiteDeviceMapping,
    CustomerDeviceMapping, Role,
)


class ACDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = ACData
        fields = [
            "id", "timestamp", "ac_id", "indoor_temperature", "outdoor_temperature",
            "indoor_humidity", "outdoor_humidity", "voltage", "current",
        ]


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = "__all__"


# class CustomerSerializer(serializers.ModelSerializer):
#     password = serializers.CharField(write_only=True, required=False, allow_blank=True, min_length=6)
#     login_email = serializers.SerializerMethodField()
#     head_office_hierarchy = serializers.SerializerMethodField()

#     class Meta:
#         model = Customer
#         fields = "__all__"
#         read_only_fields = ["organization", "tpt_customer_id", "created_at", "updated_at"]
#         validators = []

#     # LOGIN EMAIL
#     def get_login_email(self, obj):
#         return (
#             User.objects
#             .filter(customer=obj, role=Role.CUSTOMER)
#             .values_list("email", flat=True)
#             .first()
#         )

#     @staticmethod
#     def _login_email_for(customer):
#         return (customer.contact_person_email or customer.company_email or "").strip().lower()

#     # CREATE CUSTOMER LOGIN
#     def _ensure_login(self, customer, password):
#         """Create or update the Bank Customer login."""
#         login = User.objects.filter(customer=customer, role=Role.CUSTOMER).first()

#         # Existing login
#         if login:
#             if password:
#                 login.set_password(password)
            
#             login.email = self._login_email_for(customer)
#             login.name = customer.contact_person or customer.company
#             # login.phone = customer.admin_mobile or customer.phone
#             login.phone = customer.phone or ""
#             login.is_active = customer.is_active
#             login.save()
#             return login

#         # New login
#         email = self._login_email_for(customer)
#         if not email:
#             raise serializers.ValidationError({
#                 "contact_person_email": "An email is required to create the bank login."
#             })
#         if User.objects.filter(email__iexact=email).exists():
#             raise serializers.ValidationError({
#                 "contact_person_email": "A user with this email already exists."
#             })

#         login = User(
#             email=email,
#             name=customer.contact_person or customer.company,
#             # phone=customer.admin_mobile or customer.phone,
#             phone=customer.phone or "",
#             role=Role.CUSTOMER,
#             organization=customer.organization,
#             customer=customer,
#             is_active=customer.is_active,
#         )
#         login.set_password(password)
#         login.save()
#         return login

#     # ============================================================
#     # VALIDATION
#     # ============================================================

#     def validate_company(self, value):
#         value = value.strip()
#         if not value:
#             raise serializers.ValidationError("Bank name is required.")
#         return value

#     def validate_code(self, value):
#         value = value.strip().upper()
#         if not value:
#             raise serializers.ValidationError("Bank code is required.")
#         return value

#     def validate_bank_short_name(self, value):
#         return value.strip().upper()

#     def validate_company_email(self, value):
#         return value.strip().lower()

#     def validate_contact_person_email(self, value):
#         return value.strip().lower()

#     # def validate_pan(self, value):
#     #     value = value.strip().upper()
#     #     if value and not re.match(r"^[A-Z]{5}[0-9]{4}[A-Z]$", value):
#     #         raise serializers.ValidationError("Enter a valid PAN number.")
#     #     return value

#     # def validate_gstin(self, value):
#     #     value = value.strip().upper()
#     #     if value and len(value) != 15:
#     #         raise serializers.ValidationError("GSTIN must contain 15 characters.")
#     #     return value

#     def get_head_office_hierarchy(self, obj):
#         if obj.hierarchy_type == "GEOGRAPHICAL":
#             city = obj.head_office_city

#             if not city:
#                 return ""

#             taluka = city.taluka
#             district = taluka.district if taluka else None
#             state = district.state if district else None
#             country = state.country if state else None

#             parts = [
#                 country.name if country else None,
#                 state.name if state else None,
#                 district.name if district else None,
#                 taluka.name if taluka else None,
#                 city.name,
#             ]

#             return " → ".join(part for part in parts if part)

#         if obj.hierarchy_type == "ZONAL":
#             division = obj.head_office_division

#             if not division:
#                 return ""

#             region = division.region
#             circle = region.circle if region else None
#             zone = circle.zone if circle else None
#             country = zone.country if zone else None

#             parts = [
#                 country.name if country else None,
#                 zone.name if zone else None,
#                 circle.name if circle else None,
#                 region.name if region else None,
#                 division.name,
#             ]

#             return " → ".join(part for part in parts if part)

#         return ""

        
#     def validate(self, attrs):
#         attrs = super().validate(attrs)

#         request = self.context.get("request")
#         user = getattr(request, "user", None)

#         # Resolve organization.
#         organization = (
#             self.instance.organization
#             if self.instance
#             else getattr(user, "organization", None)
#         )

#         if not organization:
#             raise serializers.ValidationError({
#                 "organization": "Could not determine organization."
#             })

#         # Ensure bank code is unique within the organization.
#         code = attrs.get("code") or getattr(self.instance, "code", None)

#         if code:
#             duplicates = Customer.objects.filter(
#                 organization=organization,
#                 code=code,
#             )

#             if self.instance:
#                 duplicates = duplicates.exclude(pk=self.instance.pk)

#             if duplicates.exists():
#                 raise serializers.ValidationError({
#                     "code": "A bank with this code already exists in your organization."
#                 })

#         # Validate hierarchy selection and changes.
#         hierarchy_type = attrs.get(
#             "hierarchy_type",
#             getattr(self.instance, "hierarchy_type", None),
#         )

#         if self.instance is None:
#             if not hierarchy_type:
#                 raise serializers.ValidationError({
#                     "hierarchy_type": "Select Geographical or Zonal."
#                 })
#         elif (
#             hierarchy_type
#             and hierarchy_type != self.instance.hierarchy_type
#             and self.instance.branches.exists()
#         ):
#             raise serializers.ValidationError({
#                 "hierarchy_type": (
#                     "This bank already has branches. "
#                     "Hierarchy type cannot be changed."
#                 )
#             })

#         # Validate head-office location against the selected hierarchy.
#         city = attrs.get(
#             "head_office_city",
#             getattr(self.instance, "head_office_city", None),
#         )

#         division = attrs.get(
#             "head_office_division",
#             getattr(self.instance, "head_office_division", None),
#         )

#         if hierarchy_type == "GEOGRAPHICAL" and division:
#             raise serializers.ValidationError({
#                 "head_office_division": (
#                     "Select a City for a Geographical customer."
#                 )
#             })

#         if hierarchy_type == "ZONAL" and city:
#             raise serializers.ValidationError({
#                 "head_office_city": (
#                     "Select a Division for a Zonal customer."
#                 )
#             })

#         return attrs

#     def validate_pincode(self, value):
#         value = value.strip()
#         if value and not re.match(r"^\d{6}$", value):
#             raise serializers.ValidationError("PIN code must contain exactly 6 digits.")
#         return value


#     # CREATE
#     # def create(self, validated_data):
#     #     password = validated_data.pop("password", "")
#     #     with transaction.atomic():
#     #         customer = super().create(validated_data)
#     #         if password:
#     #             self._ensure_login(customer, password)
#     #     return customer

#     def create(self, validated_data):
#         validated_data.pop("password", None)
#         return super().create(validated_data)

#     # UPDATE
#     def update(self, instance, validated_data):
#         password = validated_data.pop("password", "")
#         with transaction.atomic():
#             customer = super().update(instance, validated_data)
#             login = User.objects.filter(customer=customer, role=Role.CUSTOMER).first()
#             if login:
#                 login.email = (customer.contact_person_email or customer.company_email).strip().lower()
#                 login.name = customer.contact_person or customer.company
#                 # login.phone = customer.admin_mobile or customer.phone
#                 login.phone = customer.phone or ""
#                 login.is_active = customer.is_active
#                 if password:
#                     login.set_password(password)
#                 login.save()
#             elif password:
#                 self._ensure_login(customer, password)
#         return customer

# class CustomerSerializer(serializers.ModelSerializer):
#     password = serializers.CharField(
#         write_only=True,
#         required=False,
#         allow_blank=True,
#         min_length=6,
#     )
#     login_email = serializers.SerializerMethodField()
#     head_office_hierarchy = serializers.SerializerMethodField()
#     filter_defaults = serializers.SerializerMethodField()
    
#     state = serializers.CharField(required=False, allow_blank=True)
#     district = serializers.CharField(required=False, allow_blank=True)
#     taluka = serializers.CharField(required=False, allow_blank=True)

#     class Meta:
#         model = Customer
#         fields = "__all__"
#         read_only_fields = [
#             "organization",
#             "tpt_customer_id",
#             "created_at",
#             "updated_at",
#         ]
#         validators = []

#     def get_head_office_hierarchy(self, obj):
#         if obj.hierarchy_type == "GEOGRAPHICAL":
#             city = obj.head_office_city

#             if not city:
#                 return ""

#             taluka = city.taluka
#             district = taluka.district if taluka else None
#             state = district.state if district else None
#             country = state.country if state else None

#             parts = [
#                 country.name if country else None,
#                 state.name if state else None,
#                 district.name if district else None,
#                 taluka.name if taluka else None,
#                 city.name,
#             ]

#             return " → ".join(part for part in parts if part)

#         elif obj.hierarchy_type == "ZONAL":
#             division = obj.head_office_division

#             if not division:
#                 return ""

#             region = division.region
#             circle = region.circle if region else None
#             zone = circle.zone if circle else None
#             country = zone.country if zone else None

#             parts = [
#                 country.name if country else None,
#                 zone.name if zone else None,
#                 circle.name if circle else None,
#                 region.name if region else None,
#                 division.name,
#             ]

#             return " → ".join(part for part in parts if part)

#         return ""

#     def get_login_email(self, obj):
#         return (
#             User.objects
#             .filter(customer=obj, role=Role.CUSTOMER)
#             .values_list("email", flat=True)
#             .first()
#         )

#     def create(self, validated_data):
#         password = validated_data.pop("password", "")

#         # These are UI location names, not Customer model fields.
#         state_name = validated_data.pop("state", "")
#         district_name = validated_data.pop("district", "")
#         taluka_name = validated_data.pop("taluka", "")

#         with transaction.atomic():
#             customer = super().create(validated_data)

#             if password:
#                 self._ensure_login(customer, password)

#         return customer


#     def update(self, instance, validated_data):
#         password = validated_data.pop("password", "")

#         # Prevent non-model fields from reaching Customer.objects.update().
#         validated_data.pop("state", None)
#         validated_data.pop("district", None)
#         validated_data.pop("taluka", None)

#         with transaction.atomic():
#             customer = super().update(instance, validated_data)

#             login = User.objects.filter(
#                 customer=customer,
#                 role=Role.CUSTOMER,
#             ).first()

#             if login:
#                 login.email = (
#                     customer.contact_person_email or customer.company_email
#                 ).strip().lower()
#                 login.name = customer.contact_person or customer.company
#                 login.phone = customer.admin_mobile or customer.phone
#                 login.is_active = customer.is_active

#                 if password:
#                     login.set_password(password)

#                 login.save()

#             elif password:
#                 self._ensure_login(customer, password)

#         return customer

#     def get_filter_defaults(self, obj):
#         """
#         Return the default dashboard filters for this customer.
#         Values must match the names used in the filter location tree.
#         """
#         defaults = {
#             "hierarchy": obj.hierarchy_type,
#             "country": "India",
#             "state": "",
#             "district": "",
#             "taluka": "",
#             "branch": "",
#             "floor": "",
#         }

#         if obj.hierarchy_type == "GEOGRAPHICAL":
#             city = obj.head_office_city

#             if city:
#                 taluka = city.taluka
#                 district = taluka.district if taluka else None
#                 state = district.state if district else None
#                 country = state.country if state else None

#                 defaults.update({
#                     "country": country.name if country else "India",
#                     "state": state.name if state else "",
#                     "district": district.name if district else "",
#                     "taluka": taluka.name if taluka else "",
#                 })

#         elif obj.hierarchy_type == "ZONAL":
#             division = obj.head_office_division

#             if division:
#                 region = division.region
#                 circle = region.circle if region else None
#                 zone = circle.zone if circle else None
#                 country = zone.country if zone else None

#                 defaults.update({
#                     "country": country.name if country else "India",
#                     "zone": zone.name if zone else "",
#                     "circle": circle.name if circle else "",
#                     "region": region.name if region else "",
#                     "division": division.name,
#                 })

#         return defaults

# imports your file already has (User, Role, Customer, serializers, …)
# add if missing:
#   from django.db import transaction
#   from .models import City          # adjust to your actual import


class CustomerSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        min_length=6,
    )
    login_email = serializers.SerializerMethodField()
    head_office_hierarchy = serializers.SerializerMethodField()
    filter_defaults = serializers.SerializerMethodField()

    # Name-strings the React form sends (used to populate flat fields
    # and/or resolve the head_office_city FK).
    state = serializers.CharField(required=False, allow_blank=True)
    district = serializers.CharField(required=False, allow_blank=True)
    taluka = serializers.CharField(required=False, allow_blank=True)
    city = serializers.CharField(required=False, allow_blank=True)

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

    # ------------------------------------------------------------------
    # READ-ONLY OUTPUT
    # ------------------------------------------------------------------
    def get_head_office_hierarchy(self, obj):
        if obj.hierarchy_type == "GEOGRAPHICAL":
            city = getattr(obj, "head_office_city", None)
            if not city:
                return ""
            taluka = city.taluka
            district = taluka.district if taluka else None
            state = district.state if district else None
            country = state.country if state else None
            parts = [
                country.name if country else None,
                state.name if state else None,
                district.name if district else None,
                taluka.name if taluka else None,
                city.name,
            ]
            return " → ".join(p for p in parts if p)

        if obj.hierarchy_type == "ZONAL":
            division = getattr(obj, "head_office_division", None)
            if not division:
                return ""
            region = division.region
            circle = region.circle if region else None
            zone = circle.zone if circle else None
            country = zone.country if zone else None
            parts = [
                country.name if country else None,
                zone.name if zone else None,
                circle.name if circle else None,
                region.name if region else None,
                division.name,
            ]
            return " → ".join(p for p in parts if p)

        return ""

    def get_login_email(self, obj):
        return (
            User.objects
            .filter(customer=obj, role=Role.CUSTOMER)
            .values_list("email", flat=True)
            .first()
        )

    def get_filter_defaults(self, obj):
        defaults = {
            "hierarchy": obj.hierarchy_type,
            "country": "India",
            "state": "",
            "district": "",
            "taluka": "",
            "branch": "",
            "floor": "",
        }

        if obj.hierarchy_type == "GEOGRAPHICAL":
            city = getattr(obj, "head_office_city", None)
            if city:
                taluka = city.taluka
                district = taluka.district if taluka else None
                state = district.state if district else None
                country = state.country if state else None
                defaults.update({
                    "country": country.name if country else "India",
                    "state": state.name if state else "",
                    "district": district.name if district else "",
                    "taluka": taluka.name if taluka else "",
                })

        elif obj.hierarchy_type == "ZONAL":
            division = getattr(obj, "head_office_division", None)
            if division:
                region = division.region
                circle = region.circle if region else None
                zone = circle.zone if circle else None
                country = zone.country if zone else None
                defaults.update({
                    "country": country.name if country else "India",
                    "zone": zone.name if zone else "",
                    "circle": circle.name if circle else "",
                    "region": region.name if region else "",
                    "division": division.name,
                })

        return defaults

    # ------------------------------------------------------------------
    # LOGIN USER (kept for any endpoint that calls it)
    # ------------------------------------------------------------------
    def _ensure_login(self, customer):
        email = (
            customer.contact_person_email
            or customer.company_email
            or self.initial_data.get("contact_person_email")
            or self.initial_data.get("company_email")
        )
        password = self.initial_data.get("password") or None
        if not email:
            return None

        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            user = User(
                email=email,
                customer=customer,
                role=Role.CUSTOMER,
                is_active=True,
            )
            if hasattr(user, "username"):
                user.username = email
            if password:
                user.set_password(password)
            else:
                user.set_unusable_password()
            user.save()
        else:
            user.customer = customer
            user.role = Role.CUSTOMER
            if password:
                user.set_password(password)
            user.save()
        return user

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _model_field_names(self):
        return {f.name for f in Customer._meta.get_fields()}

    def _resolve_city(self, state_name, district_name, taluka_name, city_name):
        if not all([state_name, district_name, taluka_name, city_name]):
            return None
        city = City.objects.filter(
            name__iexact=city_name,
            taluka__name__iexact=taluka_name,
            taluka__district__name__iexact=district_name,
            taluka__district__state__name__iexact=state_name,
        ).first()
        if city is None:
            raise serializers.ValidationError(
                {"city": "Could not resolve the selected location."}
            )
        return city

    def _apply_location_fields(self, validated_data, instance=None):
        """
        Pop the name strings, then restore only those flat fields the
        Customer model actually declares, and resolve head_office_city
        if the model uses it. Works for both create and update.
        """
        state_name    = validated_data.pop("state", "") or ""
        district_name = validated_data.pop("district", "") or ""
        taluka_name   = validated_data.pop("taluka", "") or ""
        city_name     = validated_data.pop("city", "") or ""

        model_fields = self._model_field_names()
        target = validated_data if instance is None else {}
        target_data = validated_data  # alias for clarity

        # Only assign a flat field if the model declares it. This is the
        # exact spot where "taluka" used to blow up.
        for name, value in (
            ("state", state_name),
            ("district", district_name),
            ("taluka", taluka_name),
            ("city", city_name),
        ):
            if name in model_fields:
                if instance is None:
                    target_data[name] = value
                else:
                    setattr(instance, name, value)

        # If the model stores the location as a City FK, resolve it.
        if "head_office_city" in model_fields:
            resolved = self._resolve_city(
                state_name, district_name, taluka_name, city_name
            )
            if resolved is not None:
                if instance is None:
                    target_data["head_office_city"] = resolved
                else:
                    instance.head_office_city = resolved

    # CREATE / UPDATE
    @transaction.atomic
    def create(self, validated_data):
        validated_data.pop("password", None)
        self._apply_location_fields(validated_data, instance=None)
        return Customer.objects.create(**validated_data)

    @transaction.atomic
    def update(self, instance, validated_data):
        validated_data.pop("password", None)

        # Apply location values directly to the instance (create-safe path)
        self._apply_location_fields(validated_data, instance=instance)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance


class CountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = ["id", "name", "code", "is_active"]
        read_only_fields = ["id"]

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
    city_name = serializers.CharField(source="city.name", read_only=True, default=None)
    taluka_name = serializers.CharField(source="city.taluka.name", read_only=True, default=None)
    district_name = serializers.CharField(source="city.taluka.district.name", read_only=True, default=None)
    state_name = serializers.CharField(source="city.taluka.district.state.name", read_only=True, default=None)
    division_name = serializers.CharField(source="division.name", read_only=True, default=None)
    region_name = serializers.CharField(source="division.region.name", read_only=True, default=None)
    circle_name = serializers.CharField(source="division.region.circle.name", read_only=True, default=None)
    zone_name = serializers.CharField(source="division.region.circle.zone.name", read_only=True, default=None)
    customer_name = serializers.CharField(source="customer.company", read_only=True, default=None)

    ifsc_code = serializers.CharField(max_length=11, required=False, allow_blank=True, trim_whitespace=True)

    class Meta:
        model = Branch
        fields = "__all__"
        read_only_fields = [
            "city_name", "taluka_name", "district_name", "state_name",
            "division_name", "region_name", "circle_name", "zone_name", "customer_name",
        ]

    def validate(self, attrs):
        customer = attrs.get("customer") or getattr(self.instance, "customer", None)
        city = attrs.get("city") or getattr(self.instance, "city", None)
        taluka = attrs.get("taluka") or getattr(self.instance, "taluka", None)
        division = attrs.get("division") or getattr(self.instance, "division", None)

        if not customer:
            raise serializers.ValidationError({"customer": "Customer is required."})

        # Exactly one parent: old City, new direct Taluka, or Zonal Division.
        if sum((bool(city), bool(taluka), bool(division))) != 1:
            raise serializers.ValidationError(
                "A branch must belong to exactly one parent: City, Taluka, or Division."
            )

        hierarchy = customer.hierarchy_type

        # GEOGRAPHICAL
        if hierarchy == "GEOGRAPHICAL":
            if not (city or taluka):
                raise serializers.ValidationError({
                    "taluka": "This customer uses GEOGRAPHICAL hierarchy. Select a Taluka or City."
                })
            if division:
                raise serializers.ValidationError({"division": "Geographical branch cannot have Division."})
            # The hierarchy type selects the location pattern; shared location
            # catalogue records do not have to be owned by the customer.
        # ZONAL
        elif hierarchy == "ZONAL":
            if not division:
                raise serializers.ValidationError({
                    "division": "This customer uses ZONAL hierarchy. Select Division."
                })
            if city or taluka:
                raise serializers.ValidationError({"city": "Zonal branch cannot have City or Taluka."})
            # Customer hierarchy type selects the pattern; the shared location
            # catalogue is not owned by an individual customer.
        else:
            raise serializers.ValidationError({"customer": "Customer hierarchy is not configured."})

        return attrs


class FloorSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    customer_id = serializers.IntegerField(source="branch.customer_id", read_only=True)

    class Meta:
        model = Floor
        fields = ["id", "name", "code", "branch", "branch_name", "customer_id", "is_active", "created_at"]


class SiteSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    floor_name = serializers.CharField(source="floor.name", read_only=True, default=None)

    customer_id = serializers.IntegerField(source="branch.customer_id", read_only=True, allow_null=True)
    customer_name = serializers.CharField(source="branch.customer.company", read_only=True, allow_null=True)
    organization_id = serializers.UUIDField(source="branch.customer.organization_id", read_only=True, allow_null=True)

    admins = serializers.SerializerMethodField()
    engineers = serializers.SerializerMethodField()

    class Meta:
        model = Site
        fields = [
            "id", "name", "code", "address", "latitude", "longitude",
            "branch", "branch_name", "floor", "floor_name",
            "customer_id", "customer_name", "organization_id",
            "admins", "engineers", "is_active", "created_at",
        ]
        read_only_fields = [
            "id", "branch_name", "floor_name", "customer_id", "customer_name",
            "organization_id", "admins", "engineers", "created_at",
        ]

    def get_admins(self, obj):
        return list(
            obj.users.filter(role=Role.BR_ADMIN, is_active=True)
            .values("id", "name", "email", "phone", "role", "branch_id", "site_id")
        )

    def get_engineers(self, obj):
        return list(
            obj.users.filter(role=Role.ENGINEER, is_active=True)
            .values("id", "name", "email", "phone", "role", "branch_id", "site_id")
        )

    def validate(self, attrs):
        branch = attrs.get("branch") or getattr(self.instance, "branch", None)
        floor = attrs.get("floor", getattr(self.instance, "floor", None))

        if not branch:
            raise serializers.ValidationError({"branch": "A site must belong to a branch."})
        if not branch.customer_id:
            raise serializers.ValidationError({"branch": "The selected branch is not assigned to a customer."})
        if floor and floor.branch_id != branch.id:
            raise serializers.ValidationError({"floor": "Selected floor does not belong to the selected branch."})

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
                    raise serializers.ValidationError({"branch": "You can only use your assigned site."})
            elif user.role == Role.ORG_SUPER_ADMIN:
                if branch.customer.organization_id != user.organization_id:
                    raise serializers.ValidationError({"branch": "This site is outside your organization."})

        return attrs


class ACDeviceSerializer(serializers.ModelSerializer):
    branch_id = serializers.UUIDField(source="branch.id", read_only=True, allow_null=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True, allow_null=True)
    customer_id = serializers.IntegerField(source="branch.customer_id", read_only=True, allow_null=True)
    customer_name = serializers.CharField(source="branch.customer.company", read_only=True, allow_null=True)
    assignment_status = serializers.SerializerMethodField()

    class Meta:
        model = ACDevice
        fields = [
            "id", "ac_id", "device_name", "branch", "branch_id", "branch_name",
            "customer_id", "customer_name", "assignment_status",
            "status", "capacity_ton", "installation_date", "last_maintenance_date", "assigned_by", "assigned_admin",
            "tpt_device_id", "tpt_sync_status", "tpt_sync_error", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "branch_id", "branch_name", "customer_id", "customer_name",
            "assignment_status", "assigned_by", "assigned_admin", "tpt_device_id",
            "tpt_sync_status", "tpt_sync_error", "created_at", "updated_at",
        ]

    def get_assignment_status(self, obj):
        return "ASSIGNED" if obj.branch_id else "UNASSIGNED"

    def validate(self, attrs):
        branch = attrs.get("branch", getattr(self.instance, "branch", None))
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if branch and user and getattr(user, "is_authenticated", False):
            if getattr(user, "role", None) == Role.CUSTOMER:
                if branch.customer_id != user.customer_id:
                    raise serializers.ValidationError({
                        "branch": "You can only assign a device to a branch belonging to your customer."
                    })
            elif getattr(user, "role", None) == Role.ORG_SUPER_ADMIN:
                if branch.customer.organization_id != user.organization_id:
                    raise serializers.ValidationError({"branch": "This branch is outside your organization."})
        return attrs


class CustomerSiteMappingSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.company", read_only=True)
    site_name = serializers.CharField(source="site.name", read_only=True)

    class Meta:
        model = CustomerSiteMapping
        fields = ["id", "customer", "customer_name", "site", "site_name", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "customer_name", "site_name", "created_at", "updated_at"]

    def validate(self, attrs):
        customer = attrs["customer"]
        site = attrs["site"]

        # Site must belong to the same customer
        if site.branch_id and site.branch.customer_id and site.branch.customer_id != customer.id:
            raise serializers.ValidationError({"site": "This site belongs to another customer."})

        if not site.branch_id:
            raise serializers.ValidationError({"site": "Site is not assigned to a branch."})

        return attrs


# ============================================================
# SITE → DEVICE
# ============================================================

class SiteDeviceMappingSerializer(serializers.ModelSerializer):
    site_name = serializers.CharField(source="site.name", read_only=True)
    device_name = serializers.CharField(source="device.device_name", read_only=True)
    ac_id = serializers.CharField(source="device.ac_id", read_only=True)

    class Meta:
        model = SiteDeviceMapping
        fields = [
            "id", "site", "site_name", "device", "device_name", "ac_id",
            "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "site_name", "device_name", "ac_id", "created_at", "updated_at"]

    def validate(self, attrs):
        site = attrs["site"]
        device = attrs["device"]

        if not site.branch_id:
            raise serializers.ValidationError({"site": "Site is not assigned to a branch."})
        if not site.branch.customer_id:
            raise serializers.ValidationError({"site": "Site is not assigned to a customer."})

        return attrs


# ============================================================
# CUSTOMER → DEVICE
# ============================================================

class CustomerDeviceMappingSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.company", read_only=True)
    device_name = serializers.CharField(source="device.device_name", read_only=True)
    ac_id = serializers.CharField(source="device.ac_id", read_only=True)

    class Meta:
        model = CustomerDeviceMapping
        fields = [
            "id", "customer", "customer_name", "device", "device_name", "ac_id",
            "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "customer_name", "device_name", "ac_id", "created_at", "updated_at"]

    def validate(self, attrs):
        customer = attrs["customer"]
        device = attrs["device"]

        if device.site_id:
            site_customer_id = device.site.branch.customer_id
            if site_customer_id != customer.id:
                raise serializers.ValidationError({
                    "device": "This device belongs to a site of another customer."
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
    
    head_office_state = serializers.SerializerMethodField()
    head_office_district = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "name", "phone", "role",
            "organization", "customer", "zone", "circle", "state", "district", "branch", "site",
            "scope_name", "scope_id", "customer_hierarchy_type",
            "zone_name", "circle_name", "state_name", "district_name",
            "is_active", "date_joined", "last_login",
            "head_office_state",
            "head_office_district",
        ]
        read_only_fields = ["id", "date_joined", "last_login"]

    def get_scope_id(self, obj):
        _, scope_id = obj.get_scope()
        return str(scope_id) if scope_id else None

    def get_customer_hierarchy_type(self, obj):
        return obj.customer.hierarchy_type if obj.customer_id and obj.customer else None

    def get_head_office_state(self, obj):
        customer = obj.customer

        if not customer:
            return ""

        city = customer.head_office_city
        if city:
            taluka = city.taluka
            district = taluka.district if taluka else None
            state = district.state if district else None

            if state:
                return state.name

        return customer.state or ""


    def get_head_office_district(self, obj):
        customer = obj.customer

        if not customer:
            return ""

        city = customer.head_office_city
        if city:
            taluka = city.taluka
            district = taluka.district if taluka else None

            if district:
                return district.name

        return customer.district or ""

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
                f"This account belongs to '{user.get_role_display()}'. Please select the correct role."
            )
        data["user"] = user
        return data


class AdminSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
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
            "password", "is_active", "date_joined", "last_login",
        ]
        read_only_fields = ["id", "date_joined", "last_login", "scope_name", "scope_id"]
        extra_kwargs = {
            "organization": {"required": False},
            "customer": {"required": False},
            "zone": {"required": False},
            "circle": {"required": False},
            "region": {"required": False},
            "division": {"required": False},
            "state": {"required": False},
            "district": {"required": False},
            "taluka": {"required": False},
            "city": {"required": False},
            "branch": {"required": False},
            "site": {"required": False},
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
                raise serializers.ValidationError({"site": "Selected site does not belong to the selected branch."})
            if customer and site.branch.customer_id != customer.pk:
                raise serializers.ValidationError({"site": "Selected site does not belong to the selected customer."})
            # A site is the most specific scope. Keep branch/customer in sync.
            attrs["branch"] = site.branch
            attrs["customer"] = site.branch.customer

        if customer.hierarchy_type == HierarchyType.GEOGRAPHICAL and (zone or circle):
            raise serializers.ValidationError({
                "zone": "This customer uses the Geographical hierarchy; assign State/District instead."
            })
        if customer.hierarchy_type == HierarchyType.ZONAL and (state or district):
            raise serializers.ValidationError({
                "state": "This customer uses the Zonal hierarchy; assign Zone/Circle instead."
            })

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
                    "taluka": "district",
                    "city": "taluka",
                    "circle": "zone",
                    "region": "circle",
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
                raise serializers.ValidationError({
                    "zone": "This customer uses the Geographical hierarchy; assign State/District/Taluka/City instead."
                })
            _chain_ok(geo_chain, payload, "GEOGRAPHICAL")
        elif customer.hierarchy_type == HierarchyType.ZONAL:
            if any(payload.get(n) for n in geo_chain):
                raise serializers.ValidationError({
                    "state": "This customer uses the Zonal hierarchy; assign Zone/Circle/Region/Division instead."
                })
            _chain_ok(zon_chain, payload, "ZONAL")

    def create(self, validated_data):
        password = validated_data.pop("password", "") or "Admin@123"
        user = User(**validated_data)
        user.set_password(password)
        user._skip_scope_check = True  # ← bypass scope check on this save
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
            "CUSTOMER": "customer",
            "BR_ADMIN": "branch",
            "ENGINEER": "site",
            # "ZONAL_ADMIN": "zone",
            # "CIRCLE_ADMIN": "circle",
        }.get(instance.role)

        if instance.role == "ORG_SUPER_ADMIN" or (scope_field and getattr(instance, f"{scope_field}_id")):
            instance.is_active = True

        instance.save()
        return instance


class DashboardPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = DashboardPreference
        fields = [
            "id", "name", "customer", "main_filters", "card_filters",
            "visible_widgets", "is_default", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "customer", "created_at", "updated_at"]