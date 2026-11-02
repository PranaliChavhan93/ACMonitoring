"""Create the missing 3TP ASSET for branches whose sync FAILED, then re-link their devices.

    python manage.py retry_failed_branch_sync              # all branches without a synced asset
    python manage.py retry_failed_branch_sync --code TL-01 # one branch (by code)

For every repaired branch it also (re)creates, for each device already assigned to it:
  * the 3TP customer -> device mapping, and
  * the 3TP  ASSET --Contains--> DEVICE  relation.
Both calls are idempotent, so the command is safe to run repeatedly.
"""
from django.core.management.base import BaseCommand
from django.db.models import Q

from account.models import ACDevice, Branch
from account.views import _one_line, _tpt_request, ensure_branch_asset


class Command(BaseCommand):
    help = "Create missing 3TP assets for branches and link their devices."

    def add_arguments(self, parser):
        parser.add_argument("--code", help="Only this branch code.")

    def handle(self, *args, **opts):
        qs = Branch.objects.select_related("customer")
        if opts.get("code"):
            qs = qs.filter(code__iexact=opts["code"])
        else:
            qs = qs.filter(
                Q(tpt_asset_id__isnull=True) | Q(tpt_asset_id="") | ~Q(tpt_sync_status="SYNCED")
            )

        ok = bad = 0
        for branch in qs:
            label = f"{branch.customer.company} / {branch.name} ({branch.code})"
            try:
                asset_id = ensure_branch_asset(branch)
            except Exception as exc:
                bad += 1
                self.stderr.write(f"{label}: ASSET FAILED - {_one_line(exc, 500)}")
                continue
            self.stdout.write(self.style.SUCCESS(f"{label}: asset {asset_id} SYNCED"))
            ok += 1

            devices = ACDevice.objects.filter(branch=branch).exclude(
                Q(tpt_device_id__isnull=True) | Q(tpt_device_id="")
            )
            for device in devices:
                try:
                    if branch.customer.tpt_customer_id:
                        _tpt_request(
                            "POST",
                            f"/api/customer/{branch.customer.tpt_customer_id}/device/{device.tpt_device_id}",
                        )
                    _tpt_request(
                        "POST", "/api/relation",
                        payload={
                            "from": {"entityType": "ASSET", "id": asset_id},
                            "to": {"entityType": "DEVICE", "id": device.tpt_device_id},
                            "type": "Contains", "typeGroup": "COMMON",
                        },
                    )
                    self.stdout.write(f"    {device.ac_id}: linked")
                except Exception as exc:
                    bad += 1
                    self.stderr.write(f"    {device.ac_id}: LINK FAILED - {_one_line(exc, 500)}")
        self.stdout.write(f"done: {ok} branches synced, {bad} problems")
