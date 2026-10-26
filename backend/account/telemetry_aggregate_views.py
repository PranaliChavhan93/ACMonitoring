import hmac
from django.conf import settings
from rest_framework.permissions import AllowAny
from .telemetry_aggregate import ingest_payload
from .history_views import telemetry_aggregates  # noqa: F401  (kept importable from here)
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status

def _authorized(request):
    expected = str(getattr(settings, "TELEMETRY_INGEST_TOKEN", "") or "")
    supplied = request.headers.get("X-Telemetry-Token", "")
    return bool(expected and supplied and hmac.compare_digest(expected, supplied))


@api_view(["POST"])
@permission_classes([AllowAny])
def save_production_type(request):
    if not _authorized(request):
        return Response({"status": "error", "message": "Valid telemetry token required."}, status=status.HTTP_401_UNAUTHORIZED)
    try:
        result = ingest_payload(request.data)
    except ValueError as exc:
        return Response({"status": "error", "message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"status": "success", **result}, status=status.HTTP_200_OK)
