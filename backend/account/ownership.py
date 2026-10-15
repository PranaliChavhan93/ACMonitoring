"""
Site (branch) ownership + per-user visibility.
The location trees (locationData_geographical.json / locationData_zonal.json)
are the source of truth for the hierarchy. Each BRANCH node now also carries:

    "customer_id":  <int | null>          -> account_customer.id
    "admin_ids":    [<user uuid>, ...]     -> BR_ADMIN users
    "engineer_ids": [<user uuid>, ...]     -> ENGINEER users

An AC is assigned to a branch/floor, so it inherits the customer + admins of
that branch dynamically (nothing is copied onto the AC). Change the branch's
owners once and every AC under it follows.

Visibility rules
    ORG_SUPER_ADMIN -> everything
    CUSTOMER        -> branches whose customer_id == user.customer_id
    BR_ADMIN        -> branches that list the user in admin_ids
    ENGINEER        -> branches that list the user in engineer_ids
    (legacy) a BR_ADMIN / ENGINEER whose DB `branch.code` equals the tree
    branch_id is also treated as assigned, as long as the customer matches.
"""
import copy

from .models import Customer, Role, User, State, Zone

CHILD_KEYS = (
    "states", "districts", "talukas", "cities",      # geographical
    "zones", "circles", "regions", "divisions",      # zonal
    "branches",
)


# ───────────────────────── tree helpers ─────────────────────────
def _views():
    # late import: views.py imports this module
    from . import views
    return views


def tree_file(hierarchy):
    v = _views()
    return v.GEOGRAPHICAL_LOCATION_FILE if hierarchy == "GEOGRAPHICAL" else v.ZONAL_LOCATION_FILE


def all_branch_nodes():
    """Yield (hierarchy, branch_node, context) for both trees."""
    v = _views()
    for hierarchy in ("GEOGRAPHICAL", "ZONAL"):
        tree = v.load_location_tree(tree_file(hierarchy))
        for node, ctx in v.iter_branches(tree, hierarchy):
            yield hierarchy, node, ctx


def build_branch_index():
    """{(hierarchy, branch_id): branch_node}"""
    return {(h, n.get("branch_id")): n for h, n, _ in all_branch_nodes()}


def find_branch_by_path(tree, hierarchy, body):
    """Walk the tree by the *_name fields the Locations POST receives."""
    if hierarchy == "GEOGRAPHICAL":
        levels = [("state_name", None), ("district_name", "districts"),
                  ("taluka_name", "talukas"), ("city_name", "cities"),
                  ("branch_name", "branches")]
        name_fields = ["state_name", "district_name", "taluka_name", "city_name", "branch_name"]
    else:
        levels = [("zone_name", None), ("circle_name", "circles"),
                  ("region_name", "regions"), ("division_name", "divisions"),
                  ("branch_name", "branches")]
        name_fields = ["zone_name", "circle_name", "region_name", "division_name", "branch_name"]

    nodes = tree
    node = None
    for field, child_key in levels:
        wanted = str(body.get(field, "")).strip().lower()
        if not wanted:
            return None
        if child_key is not None:
            nodes = (node or {}).get(child_key, [])
        node = next((n for n in nodes if str(n.get(field, "")).strip().lower() == wanted), None)
        if node is None:
            return None
    return node


# ───────────────────────── ownership on a node ─────────────────────────
def node_owner(node):
    return {
        "customer_id": node.get("customer_id"),
        "admin_ids": [str(x) for x in (node.get("admin_ids") or [])],
        "engineer_ids": [str(x) for x in (node.get("engineer_ids") or [])],
    }


def set_node_owner(node, customer_id, admin_ids, engineer_ids):
    node["customer_id"] = customer_id
    node["admin_ids"] = [str(x) for x in admin_ids]
    node["engineer_ids"] = [str(x) for x in engineer_ids]


def _legacy_branch_match(user, node):
    """User.branch (DB Branch) <-> tree branch, matched on Branch.code == branch_id."""
    b = getattr(user, "branch", None)
    return bool(b and b.code == node.get("branch_id"))


def can_see_branch(user, node):
    """
    Visibility is based on the customer's hierarchy and the user's scope.

    Customer:
        sees all branches belonging to that customer's hierarchy.

    Branch Admin:
        geographical -> sees every branch below assigned State
        zonal       -> sees every branch below assigned Zone

    The location JSON is treated as a display tree; ownership is resolved
    from the Django location tables so selecting a hierarchy on Customer
    actually controls the user's scope.
    """
    if not user or not user.is_authenticated:
        return False

    role = user.role
    hierarchy = "GEOGRAPHICAL" if node.get("state_name") else "ZONAL" if node.get("zone_name") else ""

    if role == Role.ORG_SUPER_ADMIN:
        return True

    if role not in (Role.CUSTOMER, Role.BR_ADMIN, Role.ENGINEER):
        return False

    customer = getattr(user, "customer", None)
    if not customer:
        return False

    # Each customer has its own hierarchy: a branch stamped with another
    # customer is never visible, even if the State/Zone name is the same.
    node_customer = node.get("customer_id")
    if node_customer not in (None, "") and str(node_customer) != str(user.customer_id):
        return False

    # A branch stamped with this customer is theirs, whatever the tree shape.
    if role == Role.CUSTOMER and node_customer not in (None, ""):
        return True

    customer_hierarchy = customer.hierarchy_type
    if customer_hierarchy != hierarchy:
        return False

    if role == Role.CUSTOMER:
        if hierarchy == "GEOGRAPHICAL":
            return State.objects.filter(
                customer_id=user.customer_id,
                name=node.get("state_name"),
            ).exists()
        return Zone.objects.filter(
            customer_id=user.customer_id,
            name=node.get("zone_name"),
        ).exists()

    if role == Role.BR_ADMIN:
        if hierarchy == "GEOGRAPHICAL" and user.state_id:
            return (
                State.objects.filter(
                    pk=user.state_id,
                    customer_id=user.customer_id,
                    name=node.get("state_name"),
                ).exists()
            )
        if hierarchy == "ZONAL" and user.zone_id:
            return (
                Zone.objects.filter(
                    pk=user.zone_id,
                    customer_id=user.customer_id,
                    name=node.get("zone_name"),
                ).exists()
            )
        # Legacy branch-scoped admins remain supported.
        return _legacy_branch_match(user, node)

    if role == Role.ENGINEER:
        return _legacy_branch_match(user, node)

    return False


def can_manage_branch(user, node):
    """Who may assign ACs / change owners of a branch."""
    if not user or not user.is_authenticated:
        return False
    if user.role == Role.ORG_SUPER_ADMIN:
        return True
    if user.role == Role.CUSTOMER:
        return can_see_branch(user, node)
    if user.role == Role.BR_ADMIN:
        return can_see_branch(user, node)   # may place ACs in own branch, not re-assign owners
    return False


# ───────────────────────── tree filtering ─────────────────────────
def _prune_list(nodes, visible):
    out = []
    for n in nodes:
        if "branch_id" in n:
            if visible(n):
                out.append(n)
            continue
        kept = False
        for key in CHILD_KEYS:
            if isinstance(n.get(key), list):
                n[key] = _prune_list(n[key], visible)
                kept = kept or bool(n[key])
        if kept:
            out.append(n)
    return out


def filter_tree_for_user(tree, user):
    if user.role == Role.ORG_SUPER_ADMIN:
        return tree
    return _prune_list(copy.deepcopy(tree), lambda n: can_see_branch(user, n))


def tree_has_no_locations(tree):
    """True when the tree contains no location node at all (empty / missing file)."""
    return not any(isinstance(n, dict) for n in (tree or []))


def filter_branches_only(tree, visible):
    """
    For the hierarchy PICKER (create a branch / assign a site).

    Keeps the whole location catalogue - every State/District/Taluka/City or
    Zone/Circle/Region/Division - and removes only the branches `visible()`
    rejects.  `filter_tree_for_user` drops every level that has no visible
    branch under it, which is right for a dashboard filter but leaves a
    customer with no branches yet an empty picker, so it must not be used
    for the picker.
    """
    tree = copy.deepcopy(tree)

    def walk(nodes):
        for node in nodes:
            if not isinstance(node, dict):
                continue
            for key in CHILD_KEYS:
                children = node.get(key)
                if not isinstance(children, list):
                    continue
                if key == "branches":
                    node[key] = [b for b in children if visible(b)]
                else:
                    walk(children)

    walk(tree if isinstance(tree, list) else [])
    return tree


def _iter_branches_in(nodes):
    for n in nodes:
        if "branch_id" in n:
            yield n
        for key in CHILD_KEYS:
            if isinstance(n.get(key), list):
                yield from _iter_branches_in(n[key])


def attach_owner_details(tree):
    """Add `customer` / `admins` / `engineers` display blocks to every branch node."""
    branches = list(_iter_branches_in(tree))
    lookup = OwnerLookup.for_nodes(branches)
    for b in branches:
        b.update(lookup.describe(b))
    return tree


# ───────────────────────── display lookups ─────────────────────────
class OwnerLookup:
    def __init__(self, customers, users):
        self.customers = customers
        self.users = users

    @classmethod
    def for_nodes(cls, nodes):
        cust_ids, user_ids = set(), set()
        for n in nodes:
            o = node_owner(n)
            if o["customer_id"]:
                cust_ids.add(o["customer_id"])
            user_ids.update(o["admin_ids"])
            user_ids.update(o["engineer_ids"])
        customers = {c.pk: c for c in Customer.objects.filter(pk__in=cust_ids)}
        users = {str(u.pk): u for u in User.objects.filter(pk__in=list(user_ids))} if user_ids else {}
        return cls(customers, users)

    def _user(self, uid):
        u = self.users.get(uid)
        if not u:
            return None
        return {"id": str(u.pk), "name": u.name or u.email, "email": u.email,
                "phone": u.phone or "", "role": u.role}

    def describe(self, node):
        o = node_owner(node)
        c = self.customers.get(o["customer_id"])
        return {
            "customer": ({"id": c.pk, "company": c.company, "code": c.code,
                          "hierarchy_type": c.hierarchy_type} if c else None),
            "admins": [x for x in (self._user(i) for i in o["admin_ids"]) if x],
            "engineers": [x for x in (self._user(i) for i in o["engineer_ids"]) if x],
        }


# ───────────────────────── validation for assigning owners ─────────────────────────
class OwnershipError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def validate_ownership(acting, hierarchy, node, customer_id, admin_ids, engineer_ids):
    """Returns (customer, admin_ids, engineer_ids) or raises OwnershipError."""
    if acting.role not in (Role.ORG_SUPER_ADMIN, Role.CUSTOMER):
        raise OwnershipError("Only Super Admin or Customer can assign a site.", 403)

    if acting.role == Role.CUSTOMER:
        existing = node_owner(node)["customer_id"]
        if existing not in (None, acting.customer_id):
            raise OwnershipError("This site belongs to another customer.", 403)
        customer_id = acting.customer_id

    if not customer_id:
        raise OwnershipError("customer_id is required.")

    customer = Customer.objects.filter(pk=customer_id).first()
    if customer is None:
        raise OwnershipError("Customer not found.", 404)
    if acting.role == Role.ORG_SUPER_ADMIN and customer.organization_id != acting.organization_id:
        raise OwnershipError("Customer does not belong to your organization.", 403)
    if customer.hierarchy_type and customer.hierarchy_type != hierarchy:
        raise OwnershipError(
            f"{customer.company} uses the {customer.hierarchy_type.title()} hierarchy; "
            f"this site is in the {hierarchy.title()} hierarchy.")

    admin_ids = [str(x) for x in (admin_ids or [])]
    engineer_ids = [str(x) for x in (engineer_ids or [])]

    def check(ids, role, label):
        if not ids:
            return
        found = set(str(pk) for pk in User.objects.filter(
            pk__in=ids, role=role, customer_id=customer.pk, is_active=True
        ).values_list("pk", flat=True))
        missing = [i for i in ids if i not in found]
        if missing:
            raise OwnershipError(f"{label} not found under {customer.company}: {', '.join(missing)}")

    check(admin_ids, Role.BR_ADMIN, "Branch admin(s)")
    check(engineer_ids, Role.ENGINEER, "Engineer(s)")
    return customer, admin_ids, engineer_ids
