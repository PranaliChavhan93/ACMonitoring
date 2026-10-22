"""
Backend changes for the "Current Fluctuation" chart  (Django + DRF assumed).

Three pieces, in the order you would add them:
  1. CurrentReading model      -> put in models.py, then makemigrations/migrate
  2. save a reading per poll   -> call save_current_reading() wherever you
                                  already receive the device JSON string
  3. CurrentHistoryView        -> put in views.py, add the URL at the bottom
"""
import json

from django.db import models
from django.db.models import Avg, Count, Max, Min
from django.db.models.functions import TruncHour, TruncMinute
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.response import Response
from rest_framework.views import APIView


# ---------------------------------------------------------------- 1. model
class CurrentReading(models.Model):
    ac_id = models.CharField(max_length=64)
    # The device JSON has NO timestamp, so the server stamps it on arrival.
    ts = models.DateTimeField(default=timezone.now)
    current = models.FloatField()

    class Meta:
        indexes = [models.Index(fields=["ac_id", "ts"]), models.Index(fields=["ts"])]


# ------------------------------------------------- 2. store one row per poll
MIN_GAP_SECONDS = 10  # keep at most one row / 10 s / device (stops table bloat)


def save_current_reading(payload):
    """payload = the dict/str you receive, e.g. {"ac_id": "AC002", "current": 0.051, ...}"""
    data = json.loads(payload) if isinstance(payload, (str, bytes)) else payload
    ac_id, current = data.get("ac_id"), data.get("current")
    if ac_id is None or current is None:
        return None

    now = timezone.now()
    last = CurrentReading.objects.filter(ac_id=ac_id).order_by("-ts").first()
    if last and (now - last.ts).total_seconds() < MIN_GAP_SECONDS:
        return None
    return CurrentReading.objects.create(ac_id=ac_id, ts=now, current=float(current))


# ------------------------------------------------------- 3. history endpoint
def devices_in_scope(params):
    """
    Return a list of ac_ids for the selected state/district/.../branch,
    or None for "everything". ADAPT THIS to your Device/Branch models, e.g.:
        if params.get("branch"):
            return list(Device.objects.filter(branch__name=params["branch"])
                        .values_list("ac_id", flat=True))
    """
    return None


class CurrentHistoryView(APIView):
    """
    GET /api/current-history/?period=today|week|month&from=<ISO>&to=<ISO>&branch=...

    Returns pre-aggregated buckets (never raw rows):
      {"period":"week","data":[{"bucket":"2026-10-21T10:00:00+00:00",
                                 "avg":0.05,"min":0.03,"max":0.09,"count":120}]}
    today -> 1-minute buckets, week/month -> 1-hour buckets. The React chart
    merges them into 5-min / hourly / daily buckets in the USER's time zone,
    so do not use TruncDay here (it would cut days at the server's midnight).
    """

    def get(self, request):
        p = request.query_params
        period = p.get("period", "today")
        if period not in ("today", "week", "month"):
            return Response({"detail": "period must be today, week or month"}, status=400)

        start, end = parse_datetime(p.get("from", "")), parse_datetime(p.get("to", ""))
        if not start or not end:
            return Response({"detail": "from and to (ISO 8601) are required"}, status=400)

        qs = CurrentReading.objects.filter(ts__gte=start, ts__lte=end)
        ac_ids = devices_in_scope(p)
        if ac_ids is not None:
            qs = qs.filter(ac_id__in=ac_ids)
        if p.get("ac_id"):
            qs = qs.filter(ac_id=p["ac_id"])

        trunc = TruncMinute("ts") if period == "today" else TruncHour("ts")
        rows = (
            qs.annotate(bucket=trunc)
            .values("bucket")
            .annotate(avg=Avg("current"), min=Min("current"), max=Max("current"), count=Count("id"))
            .order_by("bucket")
        )
        data = [{**r, "bucket": r["bucket"].isoformat()} for r in rows]
        return Response({"period": period, "data": data})


# urls.py:   path("api/current-history/", CurrentHistoryView.as_view()),
