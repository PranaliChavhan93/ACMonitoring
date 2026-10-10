import hashlib

from django.core.cache import cache
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .models import User


class ThreeTPAuthentication(BaseAuthentication):

    CACHE_PREFIX = "3tp_auth:"
    CACHE_TIMEOUT = None

    def authenticate(self, request):

        authorization = request.headers.get("Authorization", "")

        if not authorization:
            return None

        parts = authorization.split(" ", 1)

        if len(parts) != 2:
            raise AuthenticationFailed(
                "Invalid Authorization header."
            )

        scheme, token = parts

        scheme = scheme.lower()
        token = token.strip()

        if scheme not in ("bearer", "token"):
            raise AuthenticationFailed(
                "Use Bearer <3TP token>."
            )

        if not token:
            raise AuthenticationFailed(
                "Token is missing."
            )

        token_hash = hashlib.sha256(
            token.encode("utf-8")
        ).hexdigest()

        cache_key = f"{self.CACHE_PREFIX}{token_hash}"

        user_id = cache.get(cache_key)

        if not user_id:
            raise AuthenticationFailed(
                "Session expired or is invalid. Please login again."
            )

        try:
            user = User.objects.get(
                pk=user_id,
                is_active=True,
            )
        except User.DoesNotExist:
            raise AuthenticationFailed(
                "Local user account was not found."
            )

        # print("===== 3TP AUTH DEBUG =====")
        # print("USER ID:", user.id)
        # print("USER EMAIL:", user.email)
        # print("USER ROLE:", user.role)
        # print("USER ORGANIZATION:", user.organization_id)
        # print("USER ORGANIZATION OBJECT:", user.organization)
        # print("==========================")

        return user, token

    def authenticate_header(self, request):
        return "Bearer"