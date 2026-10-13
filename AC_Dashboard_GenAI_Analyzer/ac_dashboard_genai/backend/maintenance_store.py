
import sqlite3
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "maintenance.db"


def get_connection():
    connection = sqlite3.connect(
        DB_PATH,
        timeout=10,
    )
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database():
    with get_connection() as connection:
        connection.execute("""
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
        """)

        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_maintenance_ac_date
            ON maintenance_records (ac_id, maintenance_date)
        """)


def create_maintenance_record(data):
    required_fields = [
        "ac_id",
        "maintenance_type",
        "maintenance_date",
        "problem",
    ]

    for field in required_fields:
        if not str(data.get(field, "")).strip():
            raise ValueError(f"{field} is required.")

    ac_id = str(data["ac_id"]).strip()
    maintenance_type = str(data["maintenance_type"]).strip()
    maintenance_date = str(data["maintenance_date"]).strip()
    problem = str(data["problem"]).strip()
    notes = str(data.get("notes", "")).strip()

    try:
        parsed_date = datetime.fromisoformat(
            maintenance_date.replace("Z", "+00:00")
        )
    except ValueError:
        raise ValueError(
            "maintenance_date must be an ISO date or date-time."
        )

    # Store dates in a consistent ISO format.
    maintenance_date = parsed_date.isoformat()

    try:
        duration = int(data.get("duration_minutes", 0))
    except (TypeError, ValueError):
        raise ValueError(
            "duration_minutes must be an integer."
        )

    if duration < 0:
        raise ValueError(
            "duration_minutes cannot be negative."
        )

    if len(ac_id) > 100:
        raise ValueError("ac_id cannot exceed 100 characters.")

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


def list_maintenance_records(ac_id=None, limit=500):
    limit = max(1, min(int(limit), 5000))

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
                (ac_id, limit),
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

    return [dict(row) for row in rows]


def get_maintenance_summary(ac_id):
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

    # ISO dates sort chronologically when their timezone formats
    # are normalized consistently. Parse to ensure correct ordering.
    records.sort(
        key=lambda record: datetime.fromisoformat(
            record["maintenance_date"].replace("Z", "+00:00")
        ),
        reverse=True,
    )

    latest = records[0]
    previous = records[1] if len(records) > 1 else None

    latest_date = datetime.fromisoformat(
        latest["maintenance_date"].replace("Z", "+00:00")
    )

    now = datetime.now().astimezone()

    if latest_date.tzinfo is None:
        latest_date = latest_date.astimezone()

    days_since = max(
        0,
        (now - latest_date).days,
    )

    interval_days = None

    if previous:
        previous_date = datetime.fromisoformat(
            previous["maintenance_date"].replace("Z", "+00:00")
        )

        if previous_date.tzinfo is None:
            previous_date = previous_date.astimezone()

        interval_days = abs(
            (latest_date - previous_date).days
        )

    return {
        "ac_id": ac_id,
        "maintenance_count": len(records),
        "latest_maintenance": latest,
        "previous_maintenance": previous,
        "days_since_latest_maintenance": days_since,
        "days_between_last_two_maintenances": interval_days,
    }


# Create the database and table when this module is imported.
initialize_database()
