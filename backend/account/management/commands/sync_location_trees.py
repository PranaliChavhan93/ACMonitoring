from django.core.management.base import BaseCommand

from account.hierarchy_tree_sync import sync_all_branches_to_trees


class Command(BaseCommand):
    help = (
        "Add every branch/floor that exists in the database to the location "
        "trees (locationData_*.json) so the hierarchy filter shows them. "
        "Safe to run repeatedly; nothing is renamed or removed."
    )

    def handle(self, *args, **opts):
        checked, changed = sync_all_branches_to_trees()
        self.stdout.write(self.style.SUCCESS(
            f"Checked {checked} branch(es); updated the trees for {changed}."
        ))
