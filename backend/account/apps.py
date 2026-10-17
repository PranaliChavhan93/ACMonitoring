import os
import sys

from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "account"
    label = "account"

    def ready(self):
        import account.signals  # noqa: F401
        self._start_telemetry()

    @staticmethod
    def _start_telemetry():
        argv = sys.argv
        is_manage = len(argv) > 0 and os.path.basename(argv[0]) == "manage.py"

        if is_manage:
            # Only the dev server should poll 3TP, not makemigrations/migrate/shell...
            if len(argv) < 2 or argv[1] != "runserver":
                return
            # runserver's autoreloader starts two processes; poll in the serving one only
            if "--noreload" not in argv and os.environ.get("RUN_MAIN") != "true":
                return

        from django.conf import settings
        if getattr(settings, "TELEMETRY_STORAGE_MODE", "polling").lower() == "aggregate":
            print("[Telemetry] database aggregate mode enabled; old cloud polling worker is disabled")
            return

        try:
            from . import telemetry
            telemetry.start()
        except ImportError as e:
            print(f"[3TP] telemetry.py not found in account/ - live polling disabled ({e})")