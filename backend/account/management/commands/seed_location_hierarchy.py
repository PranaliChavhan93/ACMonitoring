import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from account.models import (
    Country, Customer,
    State, District, Taluka, City,
)


class Command(BaseCommand):
    help = "Seed Country -> State -> District -> Taluka -> City from a JSON file."

    def add_arguments(self, parser):
        parser.add_argument(
            "--customer", required=True,
            help="Customer code or UUID that will own the tree.",
        )
        parser.add_argument(
            "--json", required=True,
            help="Path to the JSON file.",
        )
        parser.add_argument(
            "--dry-run", action="store_true",
            help="Parse and report what would be created, without saving.",
        )

    def handle(self, *args, **opts):
        json_path = Path(opts["json"]).expanduser()
        if not json_path.exists():
            raise CommandError(f"JSON file not found: {json_path}")

        with json_path.open("r", encoding="utf-8") as fh:
            payload = json.load(fh)

        # Accept either a top-level list or a single country object.
        if isinstance(payload, dict):
            countries = [payload]
        elif isinstance(payload, list):
            countries = [c for c in payload if isinstance(c, dict)]
        else:
            raise CommandError("Unexpected JSON shape; expected list or dict.")

        # Resolve customer by UUID or code
        from uuid import UUID
        cust_field = str(opts["customer"]).strip()
        try:
            UUID(cust_field)
            customer = Customer.objects.filter(pk=cust_field).first()
        except (ValueError, TypeError):
            customer = Customer.objects.filter(code__iexact=cust_field).first()

        if not customer:
            raise CommandError(f"Customer '{cust_field}' not found.")

        self.stdout.write(self.style.MIGRATE_HEADING(
            f"Seeding hierarchy for {customer.company} ({customer.code}) "
            f"pk={customer.pk}"
        ))

        counts = {
            "countries": 0, "states": 0, "districts": 0,
            "talukas": 0, "cities": 0,
        }
        skipped = {k: 0 for k in counts}
        dry = opts["dry_run"]

        with transaction.atomic():
            for country_blob in countries:
                c_code = (country_blob.get("country_id") or "").strip().upper()
                c_name = (country_blob.get("country_name") or "").strip()

                country = None
                if c_code and c_name:
                    country = Country.objects.filter(code=c_code).first()
                    if not country:
                        if dry:
                            self.stdout.write(f"[dry] Country {c_code} {c_name}")
                        else:
                            country = Country.objects.create(
                                code=c_code, name=c_name,
                            )
                        counts["countries"] += 1
                    else:
                        skipped["countries"] += 1

                for state_blob in country_blob.get("states") or []:
                    s_code = (state_blob.get("state_id") or "").strip().upper()
                    s_name = (state_blob.get("state_name") or "").strip()
                    if not s_code or not s_name:
                        continue

                    state = State.objects.filter(code=s_code).first()
                    if state:
                        skipped["states"] += 1
                        self.stdout.write(f"  (skip) State {s_code} already exists")
                    else:
                        if dry:
                            self.stdout.write(f"[dry] State {s_code} {s_name}")
                            state = None
                        else:
                            state = State.objects.create(
                                customer=customer,
                                country=country,
                                code=s_code,
                                name=s_name,
                            )
                        counts["states"] += 1

                    for dist_blob in state_blob.get("districts") or []:
                        d_code = (dist_blob.get("district_id") or "").strip().upper()
                        d_name = (dist_blob.get("district_name") or "").strip()
                        if not d_code or not d_name:
                            continue

                        district = District.objects.filter(code=d_code).first()
                        if district:
                            skipped["districts"] += 1
                        elif state is None:
                            counts["districts"] += 1
                        else:
                            if dry:
                                self.stdout.write(f"[dry]   District {d_code} {d_name}")
                                district = None
                            else:
                                district = District.objects.create(
                                    state=state, code=d_code, name=d_name,
                                )
                            counts["districts"] += 1

                        for tal_blob in dist_blob.get("talukas") or []:
                            t_code = (tal_blob.get("taluka_id") or "").strip().upper()
                            t_name = (tal_blob.get("taluka_name") or "").strip()
                            if not t_code or not t_name:
                                continue

                            taluka = Taluka.objects.filter(code=t_code).first()
                            if taluka:
                                skipped["talukas"] += 1
                            elif district is None:
                                counts["talukas"] += 1
                            else:
                                if dry:
                                    self.stdout.write(
                                        f"[dry]     Taluka {t_code} {t_name}"
                                    )
                                    taluka = None
                                else:
                                    taluka = Taluka.objects.create(
                                        district=district,
                                        code=t_code,
                                        name=t_name,
                                    )
                                counts["talukas"] += 1

                            for city_blob in tal_blob.get("cities") or []:
                                ci_code = (city_blob.get("city_id") or "").strip().upper()
                                ci_name = (city_blob.get("city_name") or "").strip()
                                if not ci_code or not ci_name:
                                    continue

                                if taluka is None:
                                    counts["cities"] += 1
                                    continue

                                existing = City.objects.filter(code=ci_code).first()
                                if existing:
                                    skipped["cities"] += 1
                                else:
                                    if dry:
                                        self.stdout.write(
                                            f"[dry]       City {ci_code} {ci_name}"
                                        )
                                    else:
                                        City.objects.create(
                                            taluka=taluka,
                                            code=ci_code,
                                            name=ci_name,
                                        )
                                    counts["cities"] += 1

            if dry:
                transaction.set_rollback(True)

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("=== Summary ==="))
        for key in counts:
            self.stdout.write(
                f"  {key:<10} created={counts[key]:<6} skipped={skipped[key]}"
            )

        if dry:
            self.stdout.write(self.style.WARNING(
                "\n[dry-run] Transaction rolled back. Nothing was saved."
            ))
        else:
            self.stdout.write(self.style.SUCCESS("\nSeeding complete."))