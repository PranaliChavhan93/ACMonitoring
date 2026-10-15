"""
account/hierarchy_tree_sync.py

Keeps the location trees (data/locationData_geographical.json and
data/locationData_zonal.json) in step with the database.

The hierarchy filter, the "existing branch" picker on the Sites page and the
ownership / visibility rules all read those JSON trees, while sites, branches
and floors are saved in the database.  Whenever a branch or site is created we
call `sync_branch_to_tree()` so the new branch (and its floors) appear under
the right State/District/Taluka/City (or Zone/Circle/Region/Division) node
straight away.

Node ids use the database `code` of each object, which is what the
site-creation API already accepts (it resolves a UUID *or* a code).  Existing
tree nodes are matched by name (case-insensitive) and never renamed or
removed, so nothing that already works is changed.
"""
import threading

from .models import HierarchyType

_lock = threading.RLock()

GEO_CHAIN = (
    ("state", "districts"),
    ("district", "talukas"),
    ("taluka", "cities"),
    ("city", "branches"),
)
ZONAL_CHAIN = (
    ("zone", "circles"),
    ("circle", "regions"),
    ("region", "divisions"),
    ("division", "branches"),
)


def _norm(value):
    return " ".join(str(value or "").split()).casefold()


def _views():
    from . import views          # late import: views imports this module
    return views


def _path_objects(branch):
    """Return hierarchy, parent-chain keys, and ordered path to a branch parent."""
    if getattr(branch, "taluka_id", None):
        taluka = branch.taluka
        district = taluka.district
        state = district.state
        chain = (
            ("state", "districts"),
            ("district", "talukas"),
            ("taluka", "branches"),
        )
        return HierarchyType.GEOGRAPHICAL, chain, [
            ("state", state), ("district", district), ("taluka", taluka),
        ]
    if branch.city_id:
        city = branch.city
        taluka = city.taluka
        district = taluka.district
        state = district.state
        return HierarchyType.GEOGRAPHICAL, GEO_CHAIN, [
            ("state", state), ("district", district),
            ("taluka", taluka), ("city", city),
        ]
    if branch.division_id:
        division = branch.division
        region = division.region
        circle = region.circle
        zone = circle.zone
        return HierarchyType.ZONAL, ZONAL_CHAIN, [
            ("zone", zone), ("circle", circle),
            ("region", region), ("division", division),
        ]
    return None, None, None


def _root_list(tree, hierarchy):
    """
    The list that holds the top-level State / Zone nodes.  Supports a tree that
    starts directly with states/zones (what the Sites page writes) and one that
    is wrapped in a country node.
    """
    key = "states" if hierarchy == HierarchyType.GEOGRAPHICAL else "zones"
    holders = [n for n in tree if isinstance(n, dict) and isinstance(n.get(key), list)]
    if holders:
        india = next(
            (n for n in holders if _norm(n.get("country_name")) == "india"),
            holders[0],
        )
        return india[key]
    return tree


def _find_or_create(nodes, level, name, code, child_key):
    for node in nodes:
        if _norm(node.get(f"{level}_name")) == _norm(name):
            node.setdefault(child_key, [])
            return node
    node = {f"{level}_id": code, f"{level}_name": name, child_key: []}
    nodes.append(node)
    return node


def _ensure_branch_node(parent_list, branch):
    customer_id = branch.customer_id

    # 1) exact: this very branch (id == DB code)
    for node in parent_list:
        if str(node.get("branch_id", "")) == str(branch.code):
            return node, False

    # 2) same name, not owned by a different customer
    for node in parent_list:
        if _norm(node.get("branch_name")) == _norm(branch.name) and \
                node.get("customer_id") in (None, "", customer_id):
            return node, False

    node = {
        "branch_id": branch.code,
        "branch_name": branch.name,
        "address": getattr(branch, "address", ""),
        "pincode": getattr(branch, "pincode", ""),
        "floors": [],
        "sites": [],
    }
    parent_list.append(node)
    return node, True


def sync_branch_to_tree(branch):
    """
    Make sure `branch` (and all its floors) exist in the right location tree.
    Returns True if the tree file was changed.  Never raises: a problem here
    must not undo a branch / site that was already saved in the database.
    """
    try:
        return _sync_branch_to_tree(branch)
    except Exception:
        import logging
        logging.getLogger(__name__).exception(
            "Could not sync branch %s into the location tree", getattr(branch, "pk", None)
        )
        return False


def _sync_branch_to_tree(branch):
    hierarchy, chain, path = _path_objects(branch)
    if hierarchy is None:
        return False

    v = _views()
    location_file = v.GEOGRAPHICAL_LOCATION_FILE if hierarchy == HierarchyType.GEOGRAPHICAL \
        else v.ZONAL_LOCATION_FILE

    with _lock:
        tree = v.load_location_tree(location_file)
        changed = False

        nodes = _root_list(tree, hierarchy)
        node = None
        for (level, child_key), (_, obj) in zip(chain, path):
            before = len(nodes)
            node = _find_or_create(nodes, level, obj.name, obj.code, child_key)
            changed = changed or len(nodes) != before
            nodes = node[child_key]

        # `nodes` is now the list of branches under the last path node
        branch_node, created = _ensure_branch_node(nodes, branch)
        changed = changed or created

        # Visibility rules read the State/Zone (etc.) straight off the branch
        # node, so stamp the full path on it (only filling what is missing).
        path_fields = {"hierarchy_type": hierarchy, "branch_id": branch.code, "branch_name": branch.name}
        for level, obj in path:
            path_fields[f"{level}_id"] = obj.code
            path_fields[f"{level}_name"] = obj.name
        for key, value in path_fields.items():
            if branch_node.get(key) in (None, ""):
                branch_node[key] = value
                changed = True
        for key, value in (("address", getattr(branch, "address", "")), ("pincode", getattr(branch, "pincode", ""))):
            if value and branch_node.get(key) != value:
                branch_node[key] = value
                changed = True

        if branch.customer_id and branch_node.get("customer_id") in (None, ""):
            branch_node["customer_id"] = branch.customer_id
            changed = True
        for key in ("admin_ids", "engineer_ids"):
            if key not in branch_node:
                branch_node[key] = []
                changed = True
        if not isinstance(branch_node.get("floors"), list):
            branch_node["floors"] = []
            changed = True
        if not isinstance(branch_node.get("sites"), list):
            branch_node["sites"] = []
            changed = True

        for floor in branch.floors.all().order_by("created_at", "name"):
            existing = next(
                (f for f in branch_node["floors"]
                 if str(f.get("floor_id", "")) == str(floor.code)
                 or _norm(f.get("floor_name")) == _norm(floor.name)),
                None,
            )
            if existing is None:
                branch_node["floors"].append({
                    "floor_id": floor.code,
                    "floor_name": floor.name,
                    "sites": [],
                })
                changed = True

        if changed:
            v.save_location_tree(tree, location_file)
        return changed


def sync_all_branches_to_trees():
    """Back-fill every branch in the database. Returns (checked, changed)."""
    from .models import Branch

    checked = changed = 0
    qs = Branch.objects.select_related(
        "customer", "city__taluka__district__state", "taluka__district__state",
        "division__region__circle__zone",
    )
    for branch in qs:
        checked += 1
        if sync_branch_to_tree(branch):
            changed += 1
    return checked, changed


# ----------------------------------------------------------------------
# Picker tree built from the database
# ----------------------------------------------------------------------
def _branch_node(branch):
    return {
        "branch_id": branch.code,
        "branch_name": branch.name,
        "customer_id": branch.customer_id,
        "address": getattr(branch, "address", "") or "",
        "pincode": getattr(branch, "pincode", "") or "",
        "floors": [
            {"floor_id": f.code, "floor_name": f.name, "sites": []}
            for f in branch.floors.all().order_by("name")
        ],
        "sites": [],
    }


def tree_is_empty(tree):
    """True when a location tree holds no hierarchy node at all."""
    return not any(isinstance(n, dict) for n in (tree or []))


def db_location_tree(hierarchy, customer):
    """
    The customer's hierarchy straight from the database, in the same shape as
    the location JSON (ids are the DB `code`s the create APIs accept).  Used by
    the picker whenever the JSON catalogue is missing or empty, so the
    picker can never come back empty just because a file is.
    """
    from .models import State, Zone

    out = []
    if hierarchy == HierarchyType.GEOGRAPHICAL:
        states = State.objects.filter(customer=customer, is_active=True).order_by("name")
        for st in states:
            st_node = {"state_id": st.code, "state_name": st.name, "districts": []}
            for d in st.districts.filter(is_active=True).order_by("name"):
                d_node = {"district_id": d.code, "district_name": d.name, "talukas": []}
                for t in d.talukas.filter(is_active=True).order_by("name"):
                    t_node = {
                        "taluka_id": t.code, "taluka_name": t.name,
                        "cities": [],
                        "branches": [
                            _branch_node(b) for b in t.branches.filter(customer=customer)
                        ],
                    }
                    for c in t.cities.filter(is_active=True).order_by("name"):
                        t_node["cities"].append({
                            "city_id": c.code, "city_name": c.name,
                            "branches": [
                                _branch_node(b) for b in c.branches.filter(customer=customer)
                            ],
                        })
                    d_node["talukas"].append(t_node)
                st_node["districts"].append(d_node)
            out.append(st_node)
    elif hierarchy == HierarchyType.ZONAL:
        for z in Zone.objects.filter(customer=customer, is_active=True).order_by("name"):
            z_node = {"zone_id": z.code, "zone_name": z.name, "circles": []}
            for c in z.circles.filter(is_active=True).order_by("name"):
                c_node = {"circle_id": c.code, "circle_name": c.name, "regions": []}
                for r in c.regions.filter(is_active=True).order_by("name"):
                    r_node = {"region_id": r.code, "region_name": r.name, "divisions": []}
                    for dv in r.divisions.filter(is_active=True).order_by("name"):
                        r_node["divisions"].append({
                            "division_id": dv.code, "division_name": dv.name,
                            "branches": [
                                _branch_node(b) for b in dv.branches.filter(customer=customer)
                            ],
                        })
                    c_node["regions"].append(r_node)
                z_node["circles"].append(c_node)
            out.append(z_node)
    return out
