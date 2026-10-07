from django.db import models

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone
import uuid


class ACData(models.Model):
    timestamp = models.DateTimeField()
    ac_id = models.CharField(max_length=50)
    indoor_temperature = models.FloatField()
    outdoor_temperature = models.FloatField()
    indoor_humidity = models.FloatField()
    outdoor_humidity = models.FloatField()
    voltage = models.FloatField()
    current = models.FloatField()

    def __str__(self):
        return f"{self.ac_id} - {self.timestamp}"


class Role(models.TextChoices):
    ORG_SUPER_ADMIN = "ORG_SUPER_ADMIN", "Organization (Super Admin)"
    CUSTOMER = "CUSTOMER", "Customer"
    BR_ADMIN = "BR_ADMIN", "Branch Admin"
    ENGINEER = "ENGINEER", "Engineer"


class HierarchyType(models.TextChoices):
    GEOGRAPHICAL = "GEOGRAPHICAL", "Geographical (State → District → Taluka → City → Branch)"
    ZONAL = "ZONAL", "Zonal (Zone → Circle → Region → Division → Branch)"


class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    code = models.CharField(max_length=50, unique=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)

    # 3TP tenant mapping
    tpt_tenant_id = models.CharField(max_length=100, unique=True, null=True, blank=True, db_index=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "organizations"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Customer(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="customers")

    # 3TP mapping
    tpt_customer_id = models.CharField(max_length=100, null=True, blank=True, unique=True)

    company = models.CharField(max_length=255, help_text="Bank name")
    code = models.CharField(max_length=50, help_text="Unique bank code within the organization")
    bank_short_name = models.CharField(max_length=50, blank=True, default="")

    BANK_TYPE_CHOICES = [
        ("PUBLIC_SECTOR", "Public Sector Bank"),
        ("PRIVATE_SECTOR", "Private Sector Bank"),
    ]
    bank_type = models.CharField(max_length=30, choices=BANK_TYPE_CHOICES, blank=True, default="")

    company_email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    website = models.CharField(max_length=255, blank=True, default="")
    gstin = models.CharField(max_length=15, blank=True, default="")
    pan = models.CharField(max_length=10, blank=True, default="")
    registration_number = models.CharField(max_length=100, blank=True, default="")

    # Head office
    address_line_1 = models.CharField(max_length=255, blank=True, default="")
    address_line_2 = models.CharField(max_length=255, blank=True, default="")
    state = models.CharField(max_length=100, blank=True, default="")
    district = models.CharField(max_length=100, blank=True, default="")
    city = models.CharField(max_length=100, blank=True, default="")
    pincode = models.CharField(max_length=6, blank=True, default="")

    # Primary bank admin
    contact_person = models.CharField(max_length=255, blank=True)
    contact_person_email = models.EmailField(blank=True)
    admin_designation = models.CharField(max_length=150, blank=True, default="")
    admin_mobile = models.CharField(max_length=30, blank=True, default="")

    hierarchy_type = models.CharField(
        max_length=20,
        choices=HierarchyType.choices,
        blank=True,
        null=True,
        help_text=(
            "Locked in at creation: Geographical or Zonal. "
            "Cannot be changed once branches exist."
        ),
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("organization", "code")
        ordering = ["company"]

    def __str__(self):
        return f"{self.company} ({self.code})"

    def clean(self):
        """Once branches exist, hierarchy type cannot be changed."""
        if self.pk and self.hierarchy_type:
            original = (
                Customer.objects
                .filter(pk=self.pk)
                .values_list("hierarchy_type", flat=True)
                .first()
            )
            if (
                original
                and original != self.hierarchy_type
                and Branch.objects.filter(customer_id=self.pk).exists()
            ):
                from django.core.exceptions import ValidationError
                raise ValidationError(
                    "hierarchy_type cannot be changed once branches have "
                    "been created for this bank."
                )


class Zone(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="zones")
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "zones"
        unique_together = ("customer", "name")
        ordering = ["name"]

    def __str__(self):
        return self.name


class Circle(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    zone = models.ForeignKey(Zone, on_delete=models.CASCADE, related_name="circles")
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "circles"
        unique_together = ("zone", "name")
        ordering = ["name"]

    def __str__(self):
        return self.name


class Region(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    circle = models.ForeignKey(Circle, on_delete=models.CASCADE, related_name="regions")
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "regions"
        unique_together = ("circle", "name")
        ordering = ["name"]

    def __str__(self):
        return self.name


class Division(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    region = models.ForeignKey(Region, on_delete=models.CASCADE, related_name="divisions")
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "divisions"
        unique_together = ("region", "name")
        ordering = ["name"]

    def __str__(self):
        return self.name


class State(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="states")
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "states"
        unique_together = ("customer", "name")
        ordering = ["name"]

    def __str__(self):
        return self.name


class District(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    state = models.ForeignKey(State, on_delete=models.CASCADE, related_name="districts")
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "districts"
        unique_together = ("state", "name")
        ordering = ["name"]

    def __str__(self):
        return self.name


class Taluka(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    district = models.ForeignKey(District, on_delete=models.CASCADE, related_name="talukas")
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "talukas"
        unique_together = ("district", "name")
        ordering = ["name"]

    def __str__(self):
        return self.name


class City(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    taluka = models.ForeignKey(Taluka, on_delete=models.CASCADE, related_name="cities")
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "cities"
        unique_together = ("taluka", "name")
        ordering = ["name"]

    def __str__(self):
        return self.name


class Branch(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="branches", null=True, blank=True)
    city = models.ForeignKey(City, on_delete=models.CASCADE, related_name="branches", null=True, blank=True)
    division = models.ForeignKey(Division, on_delete=models.CASCADE, related_name="branches", null=True, blank=True)

    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "branches"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["city", "name"], name="unique_branch_per_city"),
            models.UniqueConstraint(fields=["division", "name"], name="unique_branch_per_division"),
            models.CheckConstraint(
                condition=(
                    models.Q(city__isnull=False, division__isnull=True)
                    | models.Q(city__isnull=True, division__isnull=False)
                ),
                name="branch_has_exactly_one_parent",
            ),
        ]

    def __str__(self):
        return self.name

    def clean(self):
        from django.core.exceptions import ValidationError
        if not self.customer_id:
            raise ValidationError("A branch must belong to a customer.")

        ht = self.customer.hierarchy_type if self.customer_id else None
        if ht == HierarchyType.GEOGRAPHICAL and not self.city_id:
            raise ValidationError("This customer follows the Geographical hierarchy: select a City.")
        if ht == HierarchyType.ZONAL and not self.division_id:
            raise ValidationError("This customer follows the Zonal hierarchy: select a Division.")
        if self.city_id and self.division_id:
            raise ValidationError("A branch can belong to only one hierarchy: City OR Division, not both.")


class Floor(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name="floors")
    name = models.CharField(max_length=255)  # e.g. "Ground Floor", "Floor 2"
    code = models.CharField(max_length=50, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "floors"
        unique_together = ("branch", "name")
        ordering = ["name"]

    def __str__(self):
        return f"{self.branch.name} - {self.name}"


class Site(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name="sites")
    floor = models.ForeignKey(Floor, on_delete=models.CASCADE, related_name="sites", null=True, blank=True)

    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    address = models.TextField(blank=True)
    latitude = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # 3TP synchronization fields
    tpt_site_id = models.CharField(max_length=100, null=True, blank=True, unique=True)
    tpt_sync_status = models.CharField(max_length=20, default="PENDING")
    tpt_sync_error = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "sites"
        unique_together = ("branch", "name")
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.code})"

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.floor_id and self.floor.branch_id != self.branch_id:
            raise ValidationError("Selected floor does not belong to the selected branch.")


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", Role.ORG_SUPER_ADMIN)
        extra_fields.setdefault("is_active", True)

        if not extra_fields.get("is_staff"):
            raise ValueError("Superuser must have is_staff=True.")
        if not extra_fields.get("is_superuser"):
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, db_index=True)
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20, blank=True)
    role = models.CharField(max_length=30, choices=Role.choices, db_index=True)

    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.SET_NULL, related_name="users")
    customer = models.ForeignKey(Customer, null=True, blank=True, on_delete=models.SET_NULL, related_name="users")

    # Zonal hierarchy
    zone = models.ForeignKey(Zone, null=True, blank=True, on_delete=models.SET_NULL, related_name="users")
    circle = models.ForeignKey(Circle, null=True, blank=True, on_delete=models.SET_NULL, related_name="users")
    region = models.ForeignKey(Region, null=True, blank=True, on_delete=models.SET_NULL, related_name="users")
    division = models.ForeignKey(Division, null=True, blank=True, on_delete=models.SET_NULL, related_name="users")

    # Geographical hierarchy
    state = models.ForeignKey(State, null=True, blank=True, on_delete=models.SET_NULL, related_name="users")
    district = models.ForeignKey(District, null=True, blank=True, on_delete=models.SET_NULL, related_name="users")
    taluka = models.ForeignKey(Taluka, null=True, blank=True, on_delete=models.SET_NULL, related_name="users")
    city = models.ForeignKey(City, null=True, blank=True, on_delete=models.SET_NULL, related_name="users")

    branch = models.ForeignKey(Branch, null=True, blank=True, on_delete=models.SET_NULL, related_name="users")
    site = models.ForeignKey(Site, null=True, blank=True, on_delete=models.SET_NULL, related_name="users")

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)

    # 3TP synchronization fields
    tpt_user_id = models.CharField(max_length=100, null=True, blank=True, unique=True)
    tpt_sync_status = models.CharField(max_length=20, default="PENDING")
    tpt_sync_error = models.TextField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["name", "role"]

    class Meta:
        db_table = "users"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} <{self.email}> [{self.role}]"

    def get_scope(self):
        if self.role == Role.ORG_SUPER_ADMIN:
            return "ORGANIZATION", self.organization_id

        if self.role == Role.CUSTOMER:
            return "CUSTOMER", self.customer_id

        if self.role == Role.BR_ADMIN:
            hierarchy = getattr(self.customer, "hierarchy_type", None) if self.customer_id else None
            if hierarchy == HierarchyType.GEOGRAPHICAL and self.state_id:
                return "STATE", self.state_id
            if hierarchy == HierarchyType.ZONAL and self.zone_id:
                return "ZONE", self.zone_id
            if self.branch_id:
                return "BRANCH", self.branch_id
            return None, None

        if self.role == Role.ENGINEER:
            return "SITE", self.site_id

        return None, None

    @property
    def scope_name(self):
        if self.role == Role.ORG_SUPER_ADMIN:
            return self.organization.name if self.organization else ""

        if self.role == Role.CUSTOMER:
            return self.customer.company if self.customer else ""

        if self.role == Role.BR_ADMIN:
            hierarchy = getattr(self.customer, "hierarchy_type", None) if self.customer_id else None
            if hierarchy == HierarchyType.GEOGRAPHICAL and self.state_id:
                return self.state.name if self.state else ""
            if hierarchy == HierarchyType.ZONAL and self.zone_id:
                return self.zone.name if self.zone else ""
            return self.branch.name if self.branch else ""

        if self.role == Role.ENGINEER:
            return self.site.name if self.site else ""

        return ""


class LoginAudit(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="login_audits", null=True)
    email_attempted = models.EmailField(blank=True)
    role_attempted = models.CharField(max_length=30, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    success = models.BooleanField(default=False)
    reason = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "login_audits"
        ordering = ["-created_at"]


class LocationZone(models.Model):
    zone_code = models.CharField(max_length=20, unique=True)
    zone_name = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "location_zones"
        ordering = ["zone_name"]

    def __str__(self):
        return self.zone_name


class LocationState(models.Model):
    state_code = models.CharField(max_length=20)
    state_name = models.CharField(max_length=100)
    zone = models.ForeignKey(LocationZone, on_delete=models.CASCADE, related_name="states")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "location_states"
        ordering = ["state_name"]
        constraints = [
            models.UniqueConstraint(fields=["zone", "state_name"], name="unique_state_per_zone"),
            models.UniqueConstraint(fields=["zone", "state_code"], name="unique_state_code_per_zone"),
        ]

    def __str__(self):
        return self.state_name


class LocationCircle(models.Model):
    circle_code = models.CharField(max_length=30)
    circle_name = models.CharField(max_length=100)
    state = models.ForeignKey(LocationState, on_delete=models.CASCADE, related_name="circles")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "location_circles"
        ordering = ["circle_name"]
        constraints = [
            models.UniqueConstraint(fields=["state", "circle_name"], name="unique_circle_per_state"),
            models.UniqueConstraint(fields=["state", "circle_code"], name="unique_circle_code_per_state"),
        ]

    def __str__(self):
        return self.circle_name


class ACDevice(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ac_id = models.CharField(max_length=100, unique=True, db_index=True)
    device_name = models.CharField(max_length=255, blank=True)
    site = models.ForeignKey(Site, on_delete=models.SET_NULL, null=True, blank=True, related_name="ac_devices")
    status = models.CharField(max_length=20, default="OFF")
    capacity_ton = models.FloatField(null=True, blank=True)
    installation_date = models.DateField(null=True, blank=True)
    last_maintenance_date = models.DateField(null=True, blank=True)
    assigned_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_ac_devices"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # 3TP synchronization fields
    tpt_device_id = models.CharField(max_length=100, null=True, blank=True, unique=True)
    tpt_sync_status = models.CharField(max_length=20, default="PENDING")
    tpt_sync_error = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "ac_devices"
        ordering = ["ac_id"]

    def __str__(self):
        return f"{self.ac_id} - {self.device_name}"


# ============================================================
# CUSTOMER ↔ SITE MAPPING
# ============================================================
class CustomerSiteMapping(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="site_mappings")
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name="customer_mappings")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "customer_site_mappings"
        constraints = [
            models.UniqueConstraint(fields=["customer", "site"], name="unique_customer_site_mapping"),
        ]

    def __str__(self):
        return f"{self.customer.company} -> {self.site.name}"


# ============================================================
# SITE ↔ DEVICE MAPPING
# ============================================================
class SiteDeviceMapping(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name="device_mappings")
    device = models.ForeignKey(ACDevice, on_delete=models.CASCADE, related_name="site_mappings")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "site_device_mappings"
        constraints = [
            models.UniqueConstraint(fields=["site", "device"], name="unique_site_device_mapping"),
        ]

    def __str__(self):
        return f"{self.site.name} -> {self.device.ac_id}"


class CustomerDeviceMapping(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="device_mappings")
    device = models.ForeignKey(ACDevice, on_delete=models.CASCADE, related_name="customer_mappings")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "customer_device_mappings"
        constraints = [
            models.UniqueConstraint(fields=["customer", "device"], name="unique_customer_device_mapping"),
        ]

    def __str__(self):
        return f"{self.customer.company} -> {self.device.ac_id}"


class DashboardPreference(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="dashboard_preferences")
    customer = models.ForeignKey(
        Customer, on_delete=models.CASCADE, null=True, blank=True, related_name="dashboard_preferences"
    )
    name = models.CharField(max_length=255, default="My Dashboard")
    main_filters = models.JSONField(default=dict, blank=True)
    card_filters = models.JSONField(default=dict, blank=True)
    visible_widgets = models.JSONField(default=dict, blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "dashboard_preferences"
        ordering = ["-is_default", "-updated_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "name"], name="unique_dashboard_name_per_user"),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.name}"