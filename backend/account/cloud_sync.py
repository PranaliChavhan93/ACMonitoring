# # """
# # account/cloud_sync.py

# # Create / read Customers and Users on the 3TP cloud (ThingsBoard) with the SAME
# # token the user logged in with (the one ThreeTPAuthentication puts in
# # `request.auth`), and keep the local database in step.

# # Public API
# # ----------
# # provision_customer(token, customer, password)  -> cloud customer id
# # provision_user(token, user, password)          -> cloud user id
# # fetch_cloud_customers(token)                   -> list[dict]   (raw cloud rows)
# # fetch_cloud_users(token, customer_tpt_id=None) -> list[dict]   (raw cloud rows)
# # annotate_users_with_local(rows)                -> list[dict]   (flattened + local match)

# # Everything raises CloudSyncFailed (HTTP 502) when called through provision_*,
# # so a failed cloud call aborts the request and the surrounding
# # transaction.atomic() rolls the local rows back.

# # If the user's token is rejected (401/403 - e.g. a CUSTOMER login cannot create
# # users in ThingsBoard) the call is retried once with the service account
# # (TPT_USERNAME / TPT_PASSWORD) already used by sync_customer().
# # """
# # import logging
# # from urllib.parse import parse_qs, urlparse

# # import requests
# # from django.conf import settings
# # from rest_framework.exceptions import APIException

# # log = logging.getLogger(__name__)

# # DEFAULT_BASE_URL = "https://3tp.tapasyatech.in"
# # PAGE_SIZE = 100


# # # ───────────────────────── errors ─────────────────────────
# # class CloudError(Exception):
# #     def __init__(self, message, status=None, payload=None):
# #         super().__init__(message)
# #         self.status = status
# #         self.payload = payload


# # class CloudSyncFailed(APIException):
# #     status_code = 502
# #     default_detail = "Cloud synchronisation failed."
# #     default_code = "cloud_sync_failed"


# # # ───────────────────────── low level ─────────────────────────
# # def _base_url():
# #     return (getattr(settings, "TPT_BASE_URL", "") or DEFAULT_BASE_URL).rstrip("/")


# # def _timeout():
# #     return float(getattr(settings, "TPT_TIMEOUT", 15))


# # def cloud_enabled():
# #     return bool(getattr(settings, "TPT_SYNC_ENABLED", True))


# # def cloud_strict():
# #     """
# #     True  (default): a failed cloud call aborts the request and rolls the local save back.
# #     False          : the local record is kept, the failure is logged, and the request still succeeds.
# #     Set TPT_CLOUD_STRICT = False in settings.py to keep the old "local first, cloud best-effort" behaviour.
# #     """
# #     return bool(getattr(settings, "TPT_CLOUD_STRICT", True))


# # def _handle_failure(exc, user=None):
# #     if cloud_strict():
# #         raise CloudSyncFailed(str(exc))
# #     log.warning("Cloud sync failed (kept local record): %s", exc)
# #     if user is not None:
# #         type(user).objects.filter(pk=user.pk).update(
# #             tpt_sync_status="FAILED", tpt_sync_error=str(exc)[:500])
# #     return ""


# # def _service_token():
# #     """Service-account token (reuses views._tpt_service_login). Lazy import: views imports us."""
# #     try:
# #         from . import views
# #         return views._tpt_service_login()
# #     except Exception as exc:  # ThreeTPError, import error, ...
# #         raise CloudError(f"Could not log in to the cloud with the service account: {exc}")


# # def _message(data, response):
# #     if isinstance(data, dict):
# #         return data.get("message") or data.get("detail") or data.get("error") or response.text[:200]
# #     return (response.text or "")[:200]


# # def cloud_request(method, path, token, *, json=None, params=None, auth=True,
# #                   ok=(200, 201, 202, 204), retry_with_service=True):
# #     """
# #     Call the cloud. Returns (status_code, parsed_json_or_text).
# #     Raises CloudError on network error or non-ok status.
# #     """
# #     url = f"{_base_url()}{path}"

# #     def _send(tok):
# #         headers = {"Accept": "application/json", "Content-Type": "application/json"}
# #         if auth:
# #             headers["X-Authorization"] = f"Bearer {tok}"
# #         try:
# #             return requests.request(method.upper(), url, json=json, params=params,
# #                                     headers=headers, timeout=_timeout())
# #         except requests.RequestException as exc:
# #             raise CloudError(f"Cloud network error ({method} {path}): {exc}")

# #     response = _send(token)

# #     if auth and retry_with_service and response.status_code in (401, 403):
# #         response = _send(_service_token())

# #     try:
# #         data = response.json()
# #     except ValueError:
# #         data = response.text or None

# #     if response.status_code not in ok:
# #         raise CloudError(
# #             f"Cloud {method.upper()} {path} failed ({response.status_code}): {_message(data, response)}",
# #             status=response.status_code, payload=data,
# #         )
# #     return response.status_code, data


# # def extract_id(data):
# #     """3TP returns ids either flat or as {"id": {"id": "<uuid>", "entityType": "..."}}."""
# #     if not isinstance(data, dict):
# #         return ""
# #     for source in (data, data.get("data") if isinstance(data.get("data"), dict) else {}):
# #         for key in ("id", "uuid", "pk"):
# #             value = source.get(key)
# #             if isinstance(value, dict):
# #                 value = value.get("id") or value.get("uuid") or value.get("pk")
# #             if value:
# #                 return str(value)
# #     return ""


# # def _set_fields(obj, **fields):
# #     """Persist only the columns that exist on the model (Customer lost its tpt_* columns once)."""
# #     names = {f.name for f in obj._meta.get_fields()}
# #     values = {k: v for k, v in fields.items() if k in names}
# #     if values:
# #         type(obj).objects.filter(pk=obj.pk).update(**values)
# #         for k, v in values.items():
# #             setattr(obj, k, v)


# # # ───────────────────────── customers ─────────────────────────
# # def customer_payload(customer):
# #     g = lambda name: (getattr(customer, name, "") or "")
# #     return {
# #         "title": g("company"),
# #         "email": g("company_email") or g("contact_person_email"),
# #         "phone": g("phone"),
# #         "address": g("address_line_1"),
# #         "address2": g("address_line_2"),
# #         "city": g("city"),
# #         "state": g("state"),
# #         "zip": g("pincode"),
# #         "country": "India",
# #         "additionalInfo": {
# #             "code": g("code"),
# #             "hierarchy_type": g("hierarchy_type"),
# #             "contact_person": g("contact_person"),
# #             "gstin": g("gstin"),
# #         },
# #     }


# # def find_cloud_customer_by_title(token, title):
# #     try:
# #         _, data = cloud_request("GET", "/api/tenant/customers", token,
# #                                 params={"customerTitle": title})
# #         return extract_id(data)
# #     except CloudError:
# #         return ""


# # def ensure_cloud_customer(token, customer):
# #     """Returns (cloud_customer_id, created_now)."""
# #     existing = getattr(customer, "tpt_customer_id", "") or ""
# #     if existing:
# #         return existing, False

# #     created = True
# #     try:
# #         _, data = cloud_request("POST", "/api/customer", token, json=customer_payload(customer))
# #         cloud_id = extract_id(data)
# #     except CloudError as exc:
# #         # ThingsBoard customer titles are unique per tenant -> reuse the existing one.
# #         if exc.status == 400 and "already exists" in str(exc).lower():
# #             cloud_id = find_cloud_customer_by_title(token, customer.company)
# #             created = False
# #             if not cloud_id:
# #                 raise
# #         else:
# #             raise

# #     if not cloud_id:
# #         raise CloudError("Cloud created the customer but returned no id.")

# #     _set_fields(customer, tpt_customer_id=cloud_id)
# #     return cloud_id, created


# # def delete_cloud_customer(token, cloud_id):
# #     try:
# #         cloud_request("DELETE", f"/api/customer/{cloud_id}", token)
# #     except CloudError as exc:
# #         log.warning("Rollback: could not delete cloud customer %s: %s", cloud_id, exc)


# # # ───────────────────────── users ─────────────────────────
# # def _split_name(name, email):
# #     name = (name or "").strip() or email.split("@")[0]
# #     first, _, last = name.partition(" ")
# #     return first, last


# # def delete_cloud_user(token, cloud_id):
# #     try:
# #         cloud_request("DELETE", f"/api/user/{cloud_id}", token)
# #     except CloudError as exc:
# #         log.warning("Rollback: could not delete cloud user %s: %s", cloud_id, exc)


# # def create_cloud_user(token, *, email, name, phone, password,
# #                       customer_tpt_id=None, authority="CUSTOMER_USER"):
# #     """
# #     Create + activate a cloud user (same 3-step flow as your other project):
# #         POST /api/user?sendActivationMail=false
# #         GET  /api/user/{id}/activationLinkInfo
# #         POST /api/noauth/activate   {activateToken, password}
# #     Returns the cloud user id.
# #     """
# #     first, last = _split_name(name, email)
# #     payload = {
# #         "email": email,
# #         "authority": authority,
# #         "firstName": first,
# #         "lastName": last,
# #         "phone": phone or "",
# #     }
# #     if customer_tpt_id:
# #         payload["customerId"] = {"id": customer_tpt_id, "entityType": "CUSTOMER"}

# #     _, data = cloud_request("POST", "/api/user", token, json=payload,
# #                             params={"sendActivationMail": "false"})
# #     cloud_id = extract_id(data)
# #     if not cloud_id:
# #         raise CloudError("Cloud created the user but returned no id.")

# #     try:
# #         _, link = cloud_request("GET", f"/api/user/{cloud_id}/activationLinkInfo", token)
# #         link = link.get("value") if isinstance(link, dict) else link
# #         activate_token = parse_qs(urlparse(link or "").query).get("activateToken", [None])[0]
# #         if not activate_token:
# #             raise CloudError("Cloud returned no activation token for the new user.")

# #         cloud_request("POST", "/api/noauth/activate", None, auth=False,
# #                       json={"activateToken": activate_token, "password": password},
# #                       params={"sendActivationMail": "false"})
# #     except CloudError:
# #         delete_cloud_user(token, cloud_id)      # never leave a half-activated user behind
# #         raise

# #     return cloud_id


# # # ───────────────────────── provisioning (used by the views) ─────────────────────────
# # def provision_customer(token, customer, password=""):
# #     """
# #     Cloud customer + (if the serializer created one) the customer's login user.
# #     Call inside transaction.atomic(), AFTER serializer.save().
# #     """
# #     from .models import Role, User

# #     if not cloud_enabled():
# #         return ""
# #     try:
# #         cloud_id, created_now = ensure_cloud_customer(token, customer)

# #         login = User.objects.filter(customer=customer, role=Role.CUSTOMER).first()
# #         if login and password and not login.tpt_user_id:
# #             try:
# #                 uid = create_cloud_user(
# #                     token, email=login.email, name=login.name, phone=login.phone,
# #                     password=password, customer_tpt_id=cloud_id,
# #                 )
# #             except CloudError:
# #                 if created_now:
# #                     delete_cloud_customer(token, cloud_id)
# #                 raise
# #             User.objects.filter(pk=login.pk).update(
# #                 tpt_user_id=uid, tpt_sync_status="SYNCED", tpt_sync_error="")
# #         return cloud_id
# #     except CloudError as exc:
# #         return _handle_failure(exc)


# # def provision_user(token, user, password):
# #     """Cloud user for a local Customer / Branch-Admin / Engineer. Call after the local save."""
# #     from .models import Role

# #     if not cloud_enabled():
# #         return ""
# #     if user.role not in (Role.CUSTOMER, Role.BR_ADMIN, Role.ENGINEER):
# #         return ""      # Super admins are tenant admins in the cloud - managed there, not from here
# #     try:
# #         if not user.customer_id:
# #             raise CloudError("This user has no customer, so it cannot be created in the cloud.")
# #         cloud_customer_id, _ = ensure_cloud_customer(token, user.customer)
# #         uid = create_cloud_user(
# #             token, email=user.email, name=user.name, phone=user.phone,
# #             password=password, customer_tpt_id=cloud_customer_id,
# #         )
# #         type(user).objects.filter(pk=user.pk).update(
# #             tpt_user_id=uid, tpt_sync_status="SYNCED", tpt_sync_error="")
# #         user.tpt_user_id = uid
# #         return uid
# #     except CloudError as exc:
# #         return _handle_failure(exc, user)


# # # ───────────────────────── reading from the cloud ─────────────────────────
# # def _paged(token, path, extra_params=None):
# #     rows, page = [], 0
# #     while True:
# #         params = {"pageSize": PAGE_SIZE, "page": page, **(extra_params or {})}
# #         _, data = cloud_request("GET", path, token, params=params)
# #         data = data if isinstance(data, dict) else {}
# #         rows.extend(data.get("data", []))
# #         if not data.get("hasNext"):
# #             return rows
# #         page += 1


# # def fetch_cloud_customers(token):
# #     return _paged(token, "/api/customers")


# # def fetch_cloud_users(token, customer_tpt_id=None):
# #     """Users of one customer, or (no id) every user visible to the token."""
# #     if customer_tpt_id:
# #         return _paged(token, f"/api/customer/{customer_tpt_id}/users")
# #     try:
# #         return _paged(token, "/api/users")
# #     except CloudError as exc:
# #         if exc.status != 404:
# #             raise
# #     # older ThingsBoard: no /api/users -> walk customer by customer
# #     rows = []
# #     for customer in fetch_cloud_customers(token):
# #         rows.extend(_paged(token, f"/api/customer/{extract_id(customer)}/users"))
# #     return rows


# # def _nested(row, key):
# #     value = row.get(key)
# #     return value.get("id") if isinstance(value, dict) else value


# # def annotate_users_with_local(rows):
# #     """Flatten cloud users and mark which of them also exist in the local DB (matched by email)."""
# #     from django.db.models.functions import Lower
# #     from .models import User

# #     emails = [(r.get("email") or "").lower() for r in rows]
# #     local = {
# #         u.e: u for u in User.objects.annotate(e=Lower("email")).filter(e__in=emails)
# #     }
# #     out = []
# #     for r in rows:
# #         email = (r.get("email") or "").lower()
# #         match = local.get(email)
# #         out.append({
# #             "cloud_id": _nested(r, "id"),
# #             "email": r.get("email"),
# #             "first_name": r.get("firstName") or "",
# #             "last_name": r.get("lastName") or "",
# #             "phone": r.get("phone") or "",
# #             "authority": r.get("authority"),
# #             "cloud_customer_id": _nested(r, "customerId"),
# #             "created_time": r.get("createdTime"),
# #             "in_local": match is not None,
# #             "local_id": str(match.pk) if match else None,
# #             "local_role": match.role if match else None,
# #         })
# #     return out


# # account/cloud_sync.py
# """
# 3TP cloud-sync helpers — mirrors the old backend's "3TP user first, then local"
# pattern for Admin and Engineer creation.

# Used by:
#     - AdminListView.perform_create  -> provision_customer(...)
#     - EngListView.perform_create    -> provision_user(...)

# Customer creation is handled directly inside CustomerListView.create().
# """

# from urllib.parse import urlparse, parse_qs

# import requests
# from django.conf import settings

# from .models import User



# class CloudSyncError(Exception):
#     def __init__(self, message, status=None, payload=None):
#         super().__init__(message)
#         self.status  = status
#         self.payload = payload


# # ---------------------------------------------------------------------
# # helpers
# # ---------------------------------------------------------------------
# def _base_url():
#     return (getattr(settings, "TPT_BASE_URL", "") or "").rstrip("/")


# def _timeout():
#     return float(getattr(settings, "TPT_TIMEOUT", 10))


# def _extract_id(data):
#     if not isinstance(data, dict):
#         return ""
#     for key in ("id", "uuid", "pk"):
#         v = data.get(key)
#         if isinstance(v, dict):
#             inner = v.get("id") or v.get("uuid") or v.get("pk")
#             if inner:
#                 return str(inner)
#         elif v:
#             return str(v)
#     return ""


# def _split_name(full_name):
#     full_name = (full_name or "").strip()
#     if not full_name:
#         return "", ""
#     if " " not in full_name:
#         return full_name, ""
#     first, last = full_name.split(" ", 1)
#     return first, last


# # ---------------------------------------------------------------------
# # low-level: create + activate ONE CUSTOMER_USER in 3TP
# # ---------------------------------------------------------------------
# def create_3tp_customer_user(
#     *,
#     auth_header,
#     customer_id,
#     email,
#     first_name="",
#     last_name="",
#     phone="",
#     password=None,
# ):
#     """
#     Returns {"user_id": <tpt uuid>, "password": <raw password used>}.
#     Raises CloudSyncError on any failure.
#     """
#     if not customer_id:
#         raise CloudSyncError("Cannot create 3TP user without a customer ID.")
#     if not email:
#         raise CloudSyncError("Cannot create 3TP user without an email.")

#     headers = {
#         "Authorization": auth_header,
#         "Content-Type":  "application/json",
#         "Accept":        "application/json",
#     }

#     # ---- 1. duplicate check (same as old backend) ----
#     try:
#         check = requests.get(
#             f"{_base_url()}/api/tenant/users",
#             params={"pageSize": 100000, "page": 0, "textSearch": email},
#             headers=headers,
#             timeout=_timeout(),
#         )
#     except requests.RequestException as exc:
#         raise CloudSyncError(f"3TP user lookup failed: {exc}")

#     try:
#         check_data = check.json()
#     except ValueError:
#         check_data = {}

#     if check.status_code == 200:
#         for u in check_data.get("data", []):
#             if (u.get("email") or "").lower() == email.lower():
#                 raise CloudSyncError(
#                     "A user with this email already exists in 3TP.",
#                     status=400,
#                     payload=u,
#                 )

#     # ---- 2. create user ----
#     payload = {
#         "email":     email,
#         "authority": "CUSTOMER_USER",   # matches old backend everywhere
#         "firstName": first_name or "",
#         "lastName":  last_name  or "",
#         "phone":     phone      or "",
#         "customerId": {
#             "id":         str(customer_id),
#             "entityType": "CUSTOMER",
#         },
#     }

#     try:
#         resp = requests.post(
#             f"{_base_url()}/api/user",
#             params={"sendActivationMail": "false"},
#             json=payload,
#             headers=headers,
#             timeout=_timeout(),
#         )
#     except requests.RequestException as exc:
#         raise CloudSyncError(f"3TP user creation failed: {exc}")

#     try:
#         data = resp.json()
#     except ValueError:
#         data = {}

#     if resp.status_code not in (200, 201):
#         raise CloudSyncError(
#             "Failed to create user in 3TP.",
#             status=resp.status_code,
#             payload=data,
#         )

#     tpt_user_id = _extract_id(data)
#     if not tpt_user_id:
#         raise CloudSyncError(
#             "3TP user was created but no user id was returned.",
#             payload=data,
#         )

#     # ---- 3. password used for activation ----
#     # raw_password = password

#     # ---- 4. activation link ----
#     try:
#         act_resp = requests.get(
#             f"{_base_url()}/api/user/{tpt_user_id}/activationLinkInfo",
#             headers=headers,
#             timeout=_timeout(),
#         )
#     except requests.RequestException as exc:
#         raise CloudSyncError(f"Unable to fetch 3TP activation link: {exc}")

#     try:
#         act_data = act_resp.json()
#     except ValueError:
#         act_data = {}

#     # ---- 5. activate ----
#     if act_resp.status_code == 200:
#         link = act_data.get("value")
#         if link:
#             parsed = urlparse(link)
#             token  = parse_qs(parsed.query).get("activateToken", [None])[0]
#             if token:
#                 try:
#                     act = requests.post(
#                         f"{_base_url()}/api/noauth/activate",
#                         params={"sendActivationMail": "false"},
#                         json={"activateToken": token},
#                         headers={
#                             "Content-Type": "application/json",
#                             "Accept":       "application/json",
#                         },
#                         timeout=_timeout(),
#                     )
#                 except requests.RequestException as exc:
#                     raise CloudSyncError(f"3TP activation failed: {exc}")

#                 if act.status_code not in (200, 201):
#                     raise CloudSyncError(
#                         "3TP user was created but activation failed.",
#                         status=502,
#                         payload=act.text,
#                     )

#     return {"user_id": tpt_user_id, }


# # ---------------------------------------------------------------------
# # internal: persist 3TP user id + status back onto the local User row
# # ---------------------------------------------------------------------
# def _persist_tpt_result(user, *, tpt_user_id=None, error=None):
#     update = {}

#     model_fields = {f.name for f in user._meta.get_fields()}

#     if tpt_user_id and "tpt_user_id" in model_fields:
#         update["tpt_user_id"] = tpt_user_id

#     if "tpt_sync_status" in model_fields:
#         update["tpt_sync_status"] = "FAILED" if error else "SYNCED"

#     if "tpt_sync_error" in model_fields:
#         update["tpt_sync_error"] = (str(error) if error else "")

#     if update:
#         User.objects.filter(pk=user.pk).update(**update)


# # ---------------------------------------------------------------------
# # high-level: called by AdminListView.perform_create
# # ---------------------------------------------------------------------
# def provision_customer(auth_header, user, password=None):
#     """
#     Create a matching CUSTOMER_USER in 3TP under the admin's customer org,
#     and store the returned 3TP user id on the local User row.

#     On failure, marks the local User tpt_sync_status='FAILED' and re-raises.
#     The caller's transaction.atomic() will roll back the local user row.
#     """
#     customer = getattr(user, "customer", None)
#     if customer is None:
#         _persist_tpt_result(user, error="Admin has no linked customer.")
#         raise CloudSyncError("Admin must be linked to a customer before 3TP sync.")

#     tpt_customer_id = getattr(customer, "tpt_customer_id", "") or ""
#     if not tpt_customer_id:
#         _persist_tpt_result(
#             user,
#             error="Linked customer has no 3TP customer id.",
#         )
#         raise CloudSyncError(
#             "The linked customer does not have a 3TP customer id. "
#             "Create the customer through CustomerListView first."
#         )

#     first, last = _split_name(getattr(user, "name", "") or "")

#     try:
#         result = create_3tp_customer_user(
#             auth_header=auth_header,
#             customer_id=tpt_customer_id,
#             email=getattr(user, "email", "") or "",
#             first_name=first,
#             last_name=last,
#             phone=getattr(user, "phone", "") or "",
#             password=password,
#         )
#     except CloudSyncError as exc:
#         _persist_tpt_result(user, error=exc)
#         raise

#     _persist_tpt_result(user, tpt_user_id=result["user_id"])
#     return result


# # ---------------------------------------------------------------------
# # high-level: called by EngListView.perform_create
# # ---------------------------------------------------------------------
# def provision_user(auth_header, user, password=None):
#     """Same as provision_customer, but for engineers."""
#     customer = getattr(user, "customer", None)
#     if customer is None:
#         _persist_tpt_result(user, error="Engineer has no linked customer.")
#         raise CloudSyncError("Engineer must be linked to a customer before 3TP sync.")

#     tpt_customer_id = getattr(customer, "tpt_customer_id", "") or ""
#     if not tpt_customer_id:
#         _persist_tpt_result(
#             user,
#             error="Linked customer has no 3TP customer id.",
#         )
#         raise CloudSyncError(
#             "The linked customer does not have a 3TP customer id. "
#             "Create the customer through CustomerListView first."
#         )

#     first, last = _split_name(getattr(user, "name", "") or "")

#     try:
#         result = create_3tp_customer_user(
#             auth_header=auth_header,
#             customer_id=tpt_customer_id,
#             email=getattr(user, "email", "") or "",
#             first_name=first,
#             last_name=last,
#             phone=getattr(user, "phone", "") or "",
#             password=password,
#         )
#     except CloudSyncError as exc:
#         _persist_tpt_result(user, error=exc)
#         raise

#     _persist_tpt_result(user, tpt_user_id=result["user_id"])
#     return result

# CloudError = CloudSyncError       # cloud_views.py imports `CloudError`

# _tpt_base_url = _base_url
# _tpt_timeout  = _timeout



"""
account/cloud_sync.py

Create / read Customers and Users on the 3TP cloud (ThingsBoard) with the SAME
token the user logged in with (the one ThreeTPAuthentication puts in
`request.auth`), and keep the local database in step.

Public API
----------
provision_customer(token, user_or_customer, password)  -> cloud customer id
provision_user(token, user, password)                  -> cloud user id
fetch_cloud_customers(token)                           -> list[dict]
fetch_cloud_users(token, customer_tpt_id=None)         -> list[dict]
annotate_users_with_local(rows)                        -> list[dict]

Everything raises CloudSyncFailed (HTTP 502) when called through provision_*,
so a failed cloud call aborts the request and the surrounding
transaction.atomic() rolls the local rows back.
"""

import logging
from urllib.parse import parse_qs, urlparse

import requests
from django.conf import settings
from rest_framework.exceptions import APIException

log = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://3tp.tapasyatech.in"
PAGE_SIZE = 100


# ───────────────────────── errors ─────────────────────────
class CloudError(Exception):
    def __init__(self, message, status=None, payload=None):
        super().__init__(message)
        self.status = status
        self.payload = payload


# Backwards-compat alias for anything (e.g. my earlier suggestion) importing
# CloudSyncError from this module.
CloudSyncError = CloudError


class CloudSyncFailed(APIException):
    status_code = 502
    default_detail = "Cloud synchronisation failed."
    default_code = "cloud_sync_failed"


# ───────────────────────── low level ─────────────────────────
def _base_url():
    return (getattr(settings, "TPT_BASE_URL", "") or DEFAULT_BASE_URL).rstrip("/")


def _timeout():
    return float(getattr(settings, "TPT_TIMEOUT", 15))


def cloud_enabled():
    return bool(getattr(settings, "TPT_SYNC_ENABLED", True))


def cloud_strict():
    return bool(getattr(settings, "TPT_CLOUD_STRICT", True))


def _handle_failure(exc, user=None):
    if cloud_strict():
        raise CloudSyncFailed(str(exc))
    log.warning("Cloud sync failed (kept local record): %s", exc)
    if user is not None:
        type(user).objects.filter(pk=user.pk).update(
            tpt_sync_status="FAILED", tpt_sync_error=str(exc)[:500])
    return ""


def _service_token():
    """Service-account token (reuses views._tpt_service_login). Lazy import."""
    try:
        from . import views
        return views._tpt_service_login()
    except Exception as exc:
        raise CloudError(
            f"Could not log in to the cloud with the service account: {exc}"
        )


def _message(data, response):
    if isinstance(data, dict):
        return (
            data.get("message")
            or data.get("detail")
            or data.get("error")
            or response.text[:200]
        )
    return (response.text or "")[:200]


def cloud_request(method, path, token, *, json=None, params=None, auth=True,
                  ok=(200, 201, 202, 204), retry_with_service=True):
    """Call the cloud. Returns (status_code, parsed_json_or_text)."""
    url = f"{_base_url()}{path}"

    def _send(tok):
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if auth:
            headers["X-Authorization"] = f"Bearer {tok}"
        try:
            return requests.request(
                method.upper(), url, json=json, params=params,
                headers=headers, timeout=_timeout(),
            )
        except requests.RequestException as exc:
            raise CloudError(f"Cloud network error ({method} {path}): {exc}")

    response = _send(token)

    if auth and retry_with_service and response.status_code in (401, 403):
        response = _send(_service_token())

    try:
        data = response.json()
    except ValueError:
        data = response.text or None

    if response.status_code not in ok:
        raise CloudError(
            f"Cloud {method.upper()} {path} failed ({response.status_code}): "
            f"{_message(data, response)}",
            status=response.status_code, payload=data,
        )
    return response.status_code, data


def extract_id(data):
    """3TP returns ids either flat or as {"id": {"id": "<uuid>", ...}}."""
    if not isinstance(data, dict):
        return ""
    for source in (
        data,
        data.get("data") if isinstance(data.get("data"), dict) else {},
    ):
        for key in ("id", "uuid", "pk"):
            value = source.get(key)
            if isinstance(value, dict):
                value = value.get("id") or value.get("uuid") or value.get("pk")
            if value:
                return str(value)
    return ""


def _set_fields(obj, **fields):
    """Persist only the columns that exist on the model."""
    names = {f.name for f in obj._meta.get_fields()}
    values = {k: v for k, v in fields.items() if k in names}
    if values:
        type(obj).objects.filter(pk=obj.pk).update(**values)
        for k, v in values.items():
            setattr(obj, k, v)


# ───────────────────────── customers ─────────────────────────
def customer_payload(customer):
    g = lambda name: (getattr(customer, name, "") or "")
    return {
        "title": g("company"),
        "email": g("company_email") or g("contact_person_email"),
        "phone": g("phone"),
        "address": g("address_line_1"),
        "address2": g("address_line_2"),
        "city": g("city"),
        "state": g("state"),
        "zip": g("pincode"),
        "country": "India",
        "additionalInfo": {
            "code": g("code"),
            "hierarchy_type": g("hierarchy_type"),
            "contact_person": g("contact_person"),
            "gstin": g("gstin"),
        },
    }


def find_cloud_customer_by_title(token, title):
    try:
        _, data = cloud_request("GET", "/api/tenant/customers", token,
                                params={"customerTitle": title})
        return extract_id(data)
    except CloudError:
        return ""


def ensure_cloud_customer(token, customer):
    """Returns (cloud_customer_id, created_now)."""
    existing = getattr(customer, "tpt_customer_id", "") or ""
    if existing:
        return existing, False

    created = True
    try:
        _, data = cloud_request(
            "POST", "/api/customer", token, json=customer_payload(customer),
        )
        cloud_id = extract_id(data)
    except CloudError as exc:
        if exc.status == 400 and "already exists" in str(exc).lower():
            cloud_id = find_cloud_customer_by_title(token, customer.company)
            created = False
            if not cloud_id:
                raise
        else:
            raise

    if not cloud_id:
        raise CloudError("Cloud created the customer but returned no id.")

    _set_fields(customer, tpt_customer_id=cloud_id)
    return cloud_id, created


def delete_cloud_customer(token, cloud_id):
    try:
        cloud_request("DELETE", f"/api/customer/{cloud_id}", token)
    except CloudError as exc:
        log.warning("Rollback: could not delete cloud customer %s: %s", cloud_id, exc)


# ───────────────────────── users ─────────────────────────
def _split_name(name, email):
    name = (name or "").strip() or email.split("@")[0]
    first, _, last = name.partition(" ")
    return first, last


def delete_cloud_user(token, cloud_id):
    try:
        cloud_request("DELETE", f"/api/user/{cloud_id}", token)
    except CloudError as exc:
        log.warning("Rollback: could not delete cloud user %s: %s", cloud_id, exc)


def create_cloud_user(token, *, email, name, phone, password,
                      customer_tpt_id=None, authority="CUSTOMER_USER"):
    """Create + activate a cloud user (POST /api/user, GET activationLinkInfo,
    POST /api/noauth/activate). Returns the cloud user id."""
    first, last = _split_name(name, email)
    payload = {
        "email": email,
        "authority": authority,
        "firstName": first,
        "lastName": last,
        "phone": phone or "",
    }
    if customer_tpt_id:
        payload["customerId"] = {"id": customer_tpt_id, "entityType": "CUSTOMER"}

    _, data = cloud_request(
        "POST", "/api/user", token, json=payload,
        params={"sendActivationMail": "false"},
    )
    cloud_id = extract_id(data)
    if not cloud_id:
        raise CloudError("Cloud created the user but returned no id.")

    try:
        _, link = cloud_request(
            "GET", f"/api/user/{cloud_id}/activationLinkInfo", token,
        )
        link = link.get("value") if isinstance(link, dict) else link
        activate_token = parse_qs(urlparse(link or "").query).get(
            "activateToken", [None]
        )[0]
        if not activate_token:
            raise CloudError("Cloud returned no activation token for the new user.")

        cloud_request(
            "POST", "/api/noauth/activate", None, auth=False,
            json={"activateToken": activate_token, "password": password},
            params={"sendActivationMail": "false"},
        )
    except CloudError:
        delete_cloud_user(token, cloud_id)
        raise

    return cloud_id


# ───────────────────────── provisioning (used by views) ─────────────────────────
def _provision_one_user(token, user, password):
    """
    Internal: create a 3TP user for a local User and store the cloud id.
    Used by both provision_customer (when handed a User) and provision_user.
    """
    from .models import Role

    if not cloud_enabled():
        return ""
    if user.role not in (Role.CUSTOMER, Role.BR_ADMIN, Role.ENGINEER):
        return ""   # Super admins are tenant admins — not managed from here

    try:
        if not user.customer_id:
            raise CloudError(
                "This user has no customer, so it cannot be created in the cloud."
            )

        cloud_customer_id, _ = ensure_cloud_customer(token, user.customer)
        uid = create_cloud_user(
            token,
            email=user.email,
            name=user.name,
            phone=user.phone,
            password=password,
            customer_tpt_id=cloud_customer_id,
        )
        type(user).objects.filter(pk=user.pk).update(
            tpt_user_id=uid, tpt_sync_status="SYNCED", tpt_sync_error="",
        )
        user.tpt_user_id = uid
        return uid
    except CloudError as exc:
        return _handle_failure(exc, user)


def provision_customer(token, obj, password=""):
    """
    Called by AdminListView.perform_create.

    Accepts EITHER a User (the admin just created) or a Customer (legacy call).

    - If passed a User: creates the matching 3TP user and stores its id.
      Returns the 3TP user id.
    - If passed a Customer: creates the Customer in 3TP (if missing) and also
      creates the primary login user for that customer if one exists locally.
      Returns the 3TP customer id.
    """
    from .models import Role, User

    if not cloud_enabled():
        return ""

    # ---- Case A: a User was passed (what views.py does now) ----
    if isinstance(obj, User):
        return _provision_one_user(token, obj, password)

    # ---- Case B: a Customer was passed (legacy behaviour) ----
    customer = obj
    try:
        cloud_id, created_now = ensure_cloud_customer(token, customer)

        login = User.objects.filter(customer=customer, role=Role.CUSTOMER).first()
        if login and password and not login.tpt_user_id:
            try:
                uid = create_cloud_user(
                    token, email=login.email, name=login.name, phone=login.phone,
                    password=password, customer_tpt_id=cloud_id,
                )
            except CloudError:
                if created_now:
                    delete_cloud_customer(token, cloud_id)
                raise
            User.objects.filter(pk=login.pk).update(
                tpt_user_id=uid, tpt_sync_status="SYNCED", tpt_sync_error="",
            )
        return cloud_id
    except CloudError as exc:
        return _handle_failure(exc)


def provision_user(token, user, password):
    """Cloud user for a local Customer / Branch-Admin / Engineer."""
    return _provision_one_user(token, user, password)


# ───────────────────────── reading from the cloud ─────────────────────────
def _paged(token, path, extra_params=None):
    rows, page = [], 0
    while True:
        params = {"pageSize": PAGE_SIZE, "page": page, **(extra_params or {})}
        _, data = cloud_request("GET", path, token, params=params)
        data = data if isinstance(data, dict) else {}
        rows.extend(data.get("data", []))
        if not data.get("hasNext"):
            return rows
        page += 1


def fetch_cloud_customers(token):
    return _paged(token, "/api/customers")


def fetch_cloud_users(token, customer_tpt_id=None):
    if customer_tpt_id:
        return _paged(token, f"/api/customer/{customer_tpt_id}/users")
    try:
        return _paged(token, "/api/users")
    except CloudError as exc:
        if exc.status != 404:
            raise

    rows = []
    for customer in fetch_cloud_customers(token):
        rows.extend(_paged(token, f"/api/customer/{extract_id(customer)}/users"))
    return rows


def _nested(row, key):
    value = row.get(key)
    return value.get("id") if isinstance(value, dict) else value


def annotate_users_with_local(rows):
    """Flatten cloud users and mark which exist in the local DB (by email)."""
    from django.db.models.functions import Lower
    from .models import User

    emails = [(r.get("email") or "").lower() for r in rows]
    local = {u.e: u for u in User.objects.annotate(e=Lower("email")).filter(e__in=emails)}

    out = []
    for r in rows:
        email = (r.get("email") or "").lower()
        match = local.get(email)
        out.append({
            "cloud_id": _nested(r, "id"),
            "email": r.get("email"),
            "first_name": r.get("firstName") or "",
            "last_name": r.get("lastName") or "",
            "phone": r.get("phone") or "",
            "authority": r.get("authority"),
            "cloud_customer_id": _nested(r, "customerId"),
            "created_time": r.get("createdTime"),
            "in_local": match is not None,
            "local_id": str(match.pk) if match else None,
            "local_role": match.role if match else None,
        })
    return out