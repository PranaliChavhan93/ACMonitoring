"""
account/cloud_views.py  -  read-only endpoints that list customers / users straight from the cloud.

    GET /api/cloud/customers/                 (Super Admin)
    GET /api/cloud/users/                     (Super Admin: all, or ?customer=<local customer id>)
                                              (Customer: only their own customer's users)
"""
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .cloud_sync import (
    CloudError,
    annotate_users_with_local,
    extract_id,
    fetch_cloud_customers,
    fetch_cloud_users,
)
from .models import Customer, Role


def _fail(exc):
    return Response({"detail": str(exc)}, status=502)


class CloudCustomerListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != Role.ORG_SUPER_ADMIN:
            return Response({"detail": "Only a Super Admin can list cloud customers."}, status=403)
        try:
            rows = fetch_cloud_customers(request.auth)
        except CloudError as exc:
            return _fail(exc)

        local = {
            c.tpt_customer_id: c
            for c in Customer.objects.exclude(tpt_customer_id__isnull=True)
        }
        results = []
        for r in rows:
            cloud_id = extract_id(r)
            match = local.get(cloud_id)
            results.append({
                "cloud_id": cloud_id,
                "title": r.get("title") or r.get("name"),
                "email": r.get("email"),
                "phone": r.get("phone"),
                "address": r.get("address"),
                "city": r.get("city"),
                "created_time": r.get("createdTime"),
                "in_local": match is not None,
                "local_id": match.pk if match else None,
            })
        return Response({"count": len(results), "results": results})


class CloudUserListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role == Role.CUSTOMER:
            customer = user.customer
        elif user.role == Role.ORG_SUPER_ADMIN:
            customer = None
            local_id = request.query_params.get("customer")
            if local_id:
                customer = Customer.objects.filter(
                    pk=local_id, organization_id=user.organization_id).first()
                if customer is None:
                    return Response({"detail": "Customer not found."}, status=404)
        else:
            return Response({"detail": "You are not allowed to list cloud users."}, status=403)

        cloud_customer_id = getattr(customer, "tpt_customer_id", None) if customer else None
        if user.role == Role.CUSTOMER and not cloud_customer_id:
            return Response({"count": 0, "results": [],
                             "detail": "Your customer has not been created in the cloud yet."})
        if customer is not None and not cloud_customer_id:
            return Response({"count": 0, "results": [],
                             "detail": "This customer has not been created in the cloud yet."})

        try:
            rows = fetch_cloud_users(request.auth, cloud_customer_id)
        except CloudError as exc:
            return _fail(exc)

        results = annotate_users_with_local(rows)
        return Response({"count": len(results), "results": results})