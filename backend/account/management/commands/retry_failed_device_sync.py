"""Retry 3TP synchronisation for devices whose last sync FAILED.

    python manage.py retry_failed_device_sync            # all failed devices
    python manage.py retry_failed_device_sync --ac AC-001
"""
from django.core.management.base import BaseCommand

from account.models import ACDevice
from account.views import (
    _one_line,
    _tpt_service_headers,
    push_device_update_to_3tp,
)


class Command(BaseCommand):
    help = "Re-push devices with tpt_sync_status=FAILED to 3TP using the service account."

    def add_arguments(self, parser):
        parser.add_argument("--ac", help="Only retry this ac_id.")

    def handle(self, *args, **opts):
        qs = ACDevice.objects.exclude(tpt_device_id__isnull=True).exclude(tpt_device_id="")
        qs = qs.filter(ac_id=opts["ac"]) if opts.get("ac") else qs.filter(tpt_sync_status="FAILED")
        headers = _tpt_service_headers()
        ok = bad = 0
        for device in qs:
            try:
                push_device_update_to_3tp(device, headers)
                ok += 1
                self.stdout.write(self.style.SUCCESS(f"{device.ac_id}: SYNCED"))
            except Exception as exc:
                bad += 1
                msg = _one_line(exc, 2000)
                ACDevice.objects.filter(pk=device.pk).update(tpt_sync_status="FAILED", tpt_sync_error=msg)
                self.stderr.write(f"{device.ac_id}: FAILED - {msg}")
        self.stdout.write(f"done: {ok} synced, {bad} failed")
