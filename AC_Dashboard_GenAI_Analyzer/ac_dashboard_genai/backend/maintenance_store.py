import sqlite3
from datetime import datetime
from pathlib import Path


# Database is created inside the backend folder.
DB_PATH = Path(__file__).resolve().parent / "maintenance.db"


# ============================================================
# DATABASE CONNECTION
# ============================================================

def get_connection():
    connection = sqlite3.connect(
        DB_PATH,
        timeout=10,
    )

    connection.row_factory = sqlite3.Row

    return connection


# ============================================================
# INITIALIZE DATABASE
# ============================================================

def initialize_database():
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS maintenance_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ac_id TEXT NOT NULL,
                maintenance_type TEXT NOT NULL,
                maintenance_date TEXT NOT NULL,
                problem TEXT NOT NULL,
                duration_minutes INTEGER NOT NULL DEFAULT 0,
                notes TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            )
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_maintenance_ac_date
            ON maintenance_records (
                ac_id,
                maintenance_date
            )
            """
        )


# ============================================================
# DATE HELPERS
# ============================================================

def parse_date(value):
    """Parse an ISO date or ISO date-time into a datetime."""
    value = str(value).strip()

    try:
        parsed = datetime.fromisoformat(
            value.replace("Z", "+00:00")
        )
    except ValueError as exc:
        raise ValueError(
            "Date must use ISO format, for example "
            "2026-10-10 or 2026-10-10T10:30:00."
        ) from exc

    # Normalize naive dates and timezone-aware dates to local
    # aware datetimes before comparing them.
    if parsed.tzinfo is None:
        parsed = parsed.astimezone()
    else:
        parsed = parsed.astimezone()

    return parsed


# ============================================================
# CREATE MAINTENANCE RECORD
# ============================================================

def create_maintenance_record(data):
    required_fields = [
        "ac_id",
        "maintenance_type",
        "maintenance_date",
        "problem",
    ]

    for field in required_fields:
        if not str(data.get(field, "")).strip():
            raise ValueError(
                f"{field} is required."
            )

    ac_id = str(data["ac_id"]).strip()

    maintenance_type = str(
        data["maintenance_type"]
    ).strip()

    problem = str(data["problem"]).strip()
    notes = str(data.get("notes", "")).strip()

    if len(ac_id) > 100:
        raise ValueError(
            "ac_id cannot exceed 100 characters."
        )

    if len(maintenance_type) > 100:
        raise ValueError(
            "maintenance_type cannot exceed 100 characters."
        )

    if len(problem) > 2000:
        raise ValueError(
            "problem cannot exceed 2000 characters."
        )

    if len(notes) > 2000:
        raise ValueError(
            "notes cannot exceed 2000 characters."
        )

    maintenance_date = parse_date(
        data["maintenance_date"]
    ).isoformat()

    try:
        duration = int(
            data.get("duration_minutes", 0)
        )
    except (TypeError, ValueError) as exc:
        raise ValueError(
            "duration_minutes must be an integer."
        ) from exc

    if duration < 0:
        raise ValueError(
            "duration_minutes cannot be negative."
        )

    created_at = datetime.now().astimezone().isoformat()

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO maintenance_records (
                ac_id,
                maintenance_type,
                maintenance_date,
                problem,
                duration_minutes,
                notes,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                ac_id,
                maintenance_type,
                maintenance_date,
                problem,
                duration,
                notes,
                created_at,
            ),
        )

        record_id = cursor.lastrowid

    return get_maintenance_record(record_id)


# ============================================================
# GET ONE MAINTENANCE RECORD
# ============================================================

def get_maintenance_record(record_id):
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT *
            FROM maintenance_records
            WHERE id = ?
            """,
            (record_id,),
        ).fetchone()

    return dict(row) if row else None


# ============================================================
# LIST MAINTENANCE RECORDS
# ============================================================

def list_maintenance_records(
    ac_id=None,
    limit=500,
):
    limit = max(
        1,
        min(int(limit), 5000),
    )

    with get_connection() as connection:
        if ac_id:
            rows = connection.execute(
                """
                SELECT *
                FROM maintenance_records
                WHERE ac_id = ?
                ORDER BY maintenance_date DESC, id DESC
                LIMIT ?
                """,
                (str(ac_id).strip(), limit),
            ).fetchall()
        else:
            rows = connection.execute(
                """
                SELECT *
                FROM maintenance_records
                ORDER BY maintenance_date DESC, id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()

    return [
        dict(row)
        for row in rows
    ]


# ============================================================
# MAINTENANCE SUMMARY
# ============================================================

def get_maintenance_summary(ac_id):
    ac_id = str(ac_id).strip()

    if not ac_id:
        raise ValueError("ac_id is required.")

    records = list_maintenance_records(
        ac_id=ac_id,
        limit=5000,
    )

    if not records:
        return {
            "ac_id": ac_id,
            "maintenance_count": 0,
            "latest_maintenance": None,
            "previous_maintenance": None,
            "days_since_latest_maintenance": None,
            "days_between_last_two_maintenances": None,
        }

    # Parse and sort dates consistently.
    records.sort(
        key=lambda record: parse_date(
            record["maintenance_date"]
        ),
        reverse=True,
    )

    latest = records[0]

    previous = (
        records[1]
        if len(records) > 1
        else None
    )

    latest_date = parse_date(
        latest["maintenance_date"]
    )

    now = datetime.now().astimezone()

    days_since_latest = max(
        0,
        (now - latest_date).days,
    )

    interval_days = None

    if previous:
        previous_date = parse_date(
            previous["maintenance_date"]
        )

        interval_days = abs(
            (latest_date - previous_date).days
        )

    return {
        "ac_id": ac_id,
        "maintenance_count": len(records),
        "latest_maintenance": latest,
        "previous_maintenance": previous,
        "days_since_latest_maintenance": days_since_latest,
        "days_between_last_two_maintenances": interval_days,
    }


# ============================================================
# INITIALIZE WHEN MODULE IS IMPORTED
# ============================================================

initialize_database()
