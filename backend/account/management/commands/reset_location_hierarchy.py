from uuid import UUID

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from account.models import (
    Country, Customer,
    State, District, Taluka, City,
    Zone, Circle, Region, Division,
    Branch, Site,
)


def _resolve_customer(value):
    try:
        UUID(str(value))
        return Customer.objects.filter(pk=value).first()
    except (ValueError, TypeError):
        return Customer.objects.filter(code__iexact=value).first()


class Command(BaseCommand):
    help = (
        "Delete the entire location hierarchy (States, Districts, Talukas, "
        "Cities and any Zones/Circles/Regions/Divisions) so it can be re-seeded "
        "fresh from a JSON file. Sites are detached, not deleted, by default."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--customer", required=True,
            help="Customer code or UUID whose tree will be wiped.",
        )
        parser.add_argument(
            "--delete-sites", action="store_true",
            help="Also delete Sites attached to branches (default: detach only).",
        )
        parser.add_argument(
            "--include-zonal", action="store_true",
            help="Also wipe Zone/Circle/Region/Division for this customer.",
        )
        parser.add_argument(
            "--dry-run", action="store_true",
            help="Show what would be deleted without touching the DB.",
        )
        parser.add_argument(
            "--i-know-what-im-doing", action="store_true",
            help="Required to actually perform the delete.",
        )

    def handle(self, *args, **opts):
        customer = _resolve_customer(opts["customer"])
        if not customer:
            raise CommandError(f"Customer '{opts['customer']}' not found.")

        cust_id = customer.pk

        # ---- Build querysets ----
        states     = State.objects.filter(customer_id=cust_id)
        districts  = District.objects.filter(state__customer_id=cust_id)
        talukas    = Taluka.objects.filter(district__state__customer_id=cust_id)
        cities     = City.objects.filter(taluka__district__state__customer_id=cust_id)

        # Branches attached under the geographical tree of this customer
        geo_branches = Branch.objects.filter(
            customer_id=cust_id, city__in=cities
        )

        # Zonal tree
        zones     = Zone.objects.filter(customer_id=cust_id)
        circles   = Circle.objects.filter(zone__customer_id=cust_id)
        regions   = Region.objects.filter(circle__zone__customer_id=cust_id)
        divisions = Division.objects.filter(region__circle__zone__customer_id=cust_id)
        zon_branches = Branch.objects.filter(
            customer_id=cust_id, division__in=divisions
        )

        # Sites attached to any of those branches
        sites_under_geo = Site.objects.filter(branch__in=geo_branches)
        sites_under_zon = Site.objects.filter(branch__in=zon_branches)
        all_attached_sites = (sites_under_geo | sites_under_zon).distinct()

        # ---- Report ----
        self.stdout.write(self.style.MIGRATE_HEADING(
            f"Reset plan for {customer.company} ({customer.code}) pk={cust_id}"
        ))
        self.stdout.write(f"  States                    : {states.count()}")
        self.stdout.write(f"  Districts                 : {districts.count()}")
        self.stdout.write(f"  Talukas                   : {talukas.count()}")
        self.stdout.write(f"  Cities                    : {cities.count()}")
        self.stdout.write(f"  Geographic branches       : {geo_branches.count()}")

        if opts["include_zonal"]:
            self.stdout.write(f"  Zones                     : {zones.count()}")
            self.stdout.write(f"  Circles                   : {circles.count()}")
            self.stdout.write(f"  Regions                   : {regions.count()}")
            self.stdout.write(f"  Divisions                 : {divisions.count()}")
            self.stdout.write(f"  Zonal branches            : {zon_branches.count()}")

        self.stdout.write(f"  Sites attached to branches: {all_attached_sites.count()}")
        self.stdout.write("")

        if opts["delete_sites"]:
            self.stdout.write(self.style.WARNING(
                "  --delete-sites is ON → attached Sites will be DELETED."
            ))
        else:
            self.stdout.write(self.style.NOTICE(
                "  Attached Sites will be DETACHED (branch=NULL), not deleted."
            ))

        if opts["dry_run"]:
            self.stdout.write(self.style.WARNING("\n[dry-run] Nothing was changed."))
            return

        if not opts["i_know_what_im_doing"]:
            raise CommandError(
                "Refusing to delete without --i-know-what-im-doing "
                "(use --dry-run first to preview)."
            )

        # ---- Execute ----
        with transaction.atomic():
            # 1. Handle attached sites
            n_sites = all_attached_sites.count()
            if opts["delete_sites"]:
                all_attached_sites.delete()
                self.stdout.write(self.style.WARNING(
                    f"  Deleted {n_sites} attached site(s)."
                ))
            else:
                n_detached = all_attached_sites.update(branch=None, floor=None)
                self.stdout.write(self.style.NOTICE(
                    f"  Detached {n_detached} site(s) (branch=NULL, floor=NULL)."
                ))

            # 2. Delete branches under this customer's geo tree
            n_geo = geo_branches.count()
            geo_branches.delete()
            self.stdout.write(f"  Deleted {n_geo} geographic branch(es).")

            if opts["include_zonal"]:
                n_zon = zon_branches.count()
                zon_branches.delete()
                self.stdout.write(f"  Deleted {n_zon} zonal branch(es).")

            # 3. Delete cities (safe now that branches are gone)
            n_cities = cities.count()
            cities.delete()
            self.stdout.write(f"  Deleted {n_cities} city(ies).")

            # 4. Delete talukas
            n_tal = talukas.count()
            talukas.delete()
            self.stdout.write(f"  Deleted {n_tal} taluka(s).")

            # 5. Delete districts
            n_dist = districts.count()
            districts.delete()
            self.stdout.write(f"  Deleted {n_dist} district(s).")

            # 6. Delete states
            n_states = states.count()
            states.delete()
            self.stdout.write(f"  Deleted {n_states} state(s).")

            if opts["include_zonal"]:
                for label, qs in (
                    ("division", divisions),
                    ("region", regions),
                    ("circle", circles),
                    ("zone", zones),
                ):
                    n = qs.count()
                    qs.delete()
                    self.stdout.write(f"  Deleted {n} {label}(s).")

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Reset complete."))
        self.stdout.write("Next: re-seed with")
        self.stdout.write(
            f"  python manage.py seed_location_hierarchy "
            f"--customer {customer.code} --json /path/to/states_districts.json"
        )