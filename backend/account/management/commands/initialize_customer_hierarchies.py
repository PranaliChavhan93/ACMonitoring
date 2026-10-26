from django.core.management.base import BaseCommand, CommandError

from account.models import Customer
from account.services.customer_hierarchy import initialize_customer_hierarchy


class Command(BaseCommand):
    help = (
        "Create customer-specific hierarchy nodes for existing customers whose "
        "selected hierarchy has not been initialized."
    )

    def add_arguments(self, parser):
        parser.add_argument("--customer-id", type=int, help="Initialize only this local customer ID")
        parser.add_argument("--dry-run", action="store_true", help="Show what would be initialized without writing")

    def handle(self, *args, **options):
        qs = Customer.objects.all().order_by("pk")
        if options.get("customer_id"):
            qs = qs.filter(pk=options["customer_id"])
        dry_run = options["dry_run"]
        initialized = 0
        skipped = 0

        for customer in qs.iterator():
            hierarchy = (customer.hierarchy_type or "").upper()
            if hierarchy not in {"GEOGRAPHICAL", "ZONAL"}:
                self.stdout.write(self.style.WARNING(
                    f"SKIP customer {customer.pk} ({customer.company}): invalid hierarchy_type={hierarchy!r}"
                ))
                skipped += 1
                continue

            from account.models import State, Zone
            model = State if hierarchy == "GEOGRAPHICAL" else Zone
            if model.objects.filter(customer=customer).exists():
                self.stdout.write(f"SKIP customer {customer.pk} ({customer.company}): hierarchy already exists")
                skipped += 1
                continue

            if dry_run:
                self.stdout.write(self.style.WARNING(
                    f"WOULD INITIALIZE customer {customer.pk} ({customer.company}) as {hierarchy}"
                ))
                initialized += 1
                continue

            result = initialize_customer_hierarchy(customer)
            if result.get("created"):
                initialized += 1
                details = ", ".join(f"{key}={value}" for key, value in result.items()
                                     if key not in {"created", "hierarchy_type"})
                self.stdout.write(self.style.SUCCESS(
                    f"INITIALIZED customer {customer.pk} ({customer.company}) {hierarchy}: {details}"
                ))
            else:
                skipped += 1

        self.stdout.write(self.style.SUCCESS(
            f"Finished. {'Would initialize' if dry_run else 'Initialized'}: {initialized}; skipped: {skipped}."
        ))
