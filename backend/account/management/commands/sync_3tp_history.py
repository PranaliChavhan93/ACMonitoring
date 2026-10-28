"""Backfill 3TP telemetry history into the local TelemetryAggregate table.

Usage: python manage.py sync_3tp_history --days 93
Run once after deploying the history fix. The regular telemetry worker then
continues incrementally from the latest stored timestamp.
"""
from datetime import datetime, timedelta, timezone
import time

from django.core.management.base import BaseCommand, CommandError
from django.db import close_old_connections

from account import telemetry


class Command(BaseCommand):
    help = "Backfill historical 3TP telemetry into the local database."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=93,
                            help="Number of days of history to backfill (default: 93).")

    def handle(self, *args, **options):
        days = options["days"]
        if days < 1 or days > 3650:
            raise CommandError("--days must be between 1 and 3650.")
        cfg = telemetry._config()
        devices = telemetry._devices()
        end_ms = int(time.time() * 1000)
        start_ms = end_ms - days * 24 * 60 * 60 * 1000
        total_received = total_accepted = 0
        self.stdout.write(f"Backfilling {days} days for {len(devices)} 3TP devices...")

        for index, device in enumerate(devices, start=1):
            close_old_connections()
            ac_id = device.get("ac_id") or device.get("device_id")
            try:
                result = telemetry.sync_device_history(cfg, device, start_ms, end_ms)
            except Exception as exc:
                self.stderr.write(self.style.ERROR(f"[{index}/{len(devices)}] {ac_id}: {exc}"))
                continue
            total_received += result["received"]
            total_accepted += result["accepted"]
            self.stdout.write(
                f"[{index}/{len(devices)}] {ac_id}: "
                f"received={result['received']} accepted={result['accepted']}"
            )
        self.stdout.write(self.style.SUCCESS(
            f"Backfill finished. received={total_received}, accepted={total_accepted}. "
            "The background worker will now continue incremental sync."
        ))
