import json
import os
from groq import Groq


MODEL_DEFAULT = "openai/gpt-oss-120b"


SYSTEM_PROMPT = """
You are a senior analyst for an enterprise AC energy monitoring dashboard.

Analyze only the dashboard data supplied in the request.

RULES:
1. Never invent sensor values, locations, dates, trends, percentages, causes, faults, or savings.
2. Use actual supplied values and units whenever available.
3. Distinguish measured facts from possible explanations.
4. Do not claim a trend from a single data point.
5. Do not compare periods unless both periods are supplied.
6. Missing data is not the same as zero.
7. Do not claim an AC is faulty unless the supplied data supports it.
8. Give useful findings and practical next steps.
9. If data is missing, state what information is missing.
10. Keep the response clear and professional.
"""


# ============================================================
# SAFE DATA HELPERS
# ============================================================

def number(value):
    """Convert a value to a finite float, or return None."""
    if value is None or value == "":
        return None

    try:
        result = float(value)

        if result != result or abs(result) == float("inf"):
            return None

        return result

    except (TypeError, ValueError):
        return None


def get_value(item, *keys):
    """Return the first available value from possible key names."""
    if not isinstance(item, dict):
        return None

    for key in keys:
        value = item.get(key)

        if value is not None and value != "":
            return value

    return None


def get_power(item):
    """
    Read active power directly when available.

    If only voltage, current, and power factor are available,
    calculate an approximate power value from those readings.
    """
    direct_power = get_value(
        item,
        "active_power",
        "Active_Power",
        "activePower",
        "power",
        "Power",
    )

    if direct_power is not None:
        return number(direct_power)

    voltage = number(get_value(item, "voltage", "Voltage"))
    current = number(get_value(item, "current", "Current"))
    power_factor = number(
        get_value(item, "power_factor", "powerFactor", "Power_Factor")
    )

    if voltage is not None and current is not None:
        if power_factor is not None:
            return voltage * current * power_factor

    # Do not mislabel voltage × current as active power.
    return None


def get_energy(item):
    return number(
        get_value(
            item,
            "energy_consumption",
            "Energy_Consumption",
            "energyConsumption",
            "energy",
            "kwh",
            "kWh",
        )
    )


def get_temperature(item):
    return number(
        get_value(
            item,
            "indoor_temperature",
            "indoor_temp",
            "temperature",
            "temp",
        )
    )


def get_humidity(item):
    return number(
        get_value(
            item,
            "indoor_humidity",
            "humidity",
        )
    )


def get_status(item):
    value = get_value(item, "status", "ac_status", "state")

    if value is None:
        return "unknown"

    return str(value).strip().lower()


def get_location(item, *keys):
    value = get_value(item, *keys)

    if value is None:
        return None

    return str(value).strip()


# ============================================================
# AGGREGATE LOCATION DATA
# ============================================================

def aggregate_locations(records, location_keys, value_keys):
    totals = {}

    for record in records:
        if not isinstance(record, dict):
            continue

        location = get_location(record, *location_keys)
        value = number(get_value(record, *value_keys))

        if location and value is not None:
            totals[location] = totals.get(location, 0.0) + value

    results = [
        {
            "name": name,
            "value": round(value, 3),
        }
        for name, value in totals.items()
    ]

    return sorted(
        results,
        key=lambda item: item["value"],
        reverse=True,
    )[:10]


# ============================================================
# SUMMARIZE RAW AC TELEMETRY
# ============================================================

def summarize_ac_data(ac_data):
    """
    Calculate reliable summary values from a list of AC records.

    Expected example:
    [
        {
            "ac_id": "AC-102",
            "status": "ON",
            "active_power": 1.25,
            "energy_consumption": 24.8,
            "indoor_temperature": 25.5,
            "zone": "West",
            "state": "Maharashtra",
            "city": "Pune",
            "branch": "Branch A",
            "floor": "Floor 2"
        }
    ]
    """
    if not isinstance(ac_data, list):
        return {
            "record_count": 0,
            "note": "Raw ac_data was not supplied as a list.",
        }

    records = [
        record
        for record in ac_data
        if isinstance(record, dict)
    ]

    active_statuses = {
        "active", "running", "on", "1", "true"
    }

    inactive_statuses = {
        "inactive", "stopped", "off", "0", "false"
    }

    active_count = 0
    inactive_count = 0

    power_values = []
    energy_values = []
    temperatures = []
    humidities = []
    health_distribution = {}

    energy_keys = (
        "energy_consumption",
        "Energy_Consumption",
        "energyConsumption",
        "energy",
        "kwh",
        "kWh",
    )

    for record in records:
        status = get_status(record)

        if status in active_statuses:
            active_count += 1
        elif status in inactive_statuses:
            inactive_count += 1

        power = get_power(record)
        energy = get_energy(record)
        temperature = get_temperature(record)
        humidity = get_humidity(record)

        if power is not None:
            power_values.append(power)

        if energy is not None:
            energy_values.append(energy)

        if temperature is not None:
            temperatures.append(temperature)

        if humidity is not None:
            humidities.append(humidity)

        health = get_value(
            record,
            "health_status",
            "health",
            "alert_status",
        )

        if health is not None:
            health = str(health).strip()
            health_distribution[health] = (
                health_distribution.get(health, 0) + 1
            )

    def average(values):
        if not values:
            return None

        return round(sum(values) / len(values), 2)

    return {
        "record_count": len(records),
        "active_ac_count": active_count,
        "inactive_ac_count": inactive_count,
        "unknown_status_count": (
            len(records) - active_count - inactive_count
        ),
        "total_active_power": (
            round(sum(power_values), 3)
            if power_values else None
        ),
        "power_record_count": len(power_values),
        "total_energy": (
            round(sum(energy_values), 3)
            if energy_values else None
        ),
        "energy_record_count": len(energy_values),
        "average_indoor_temperature": average(temperatures),
        "temperature_record_count": len(temperatures),
        "average_indoor_humidity": average(humidities),
        "humidity_record_count": len(humidities),
        "health_distribution": health_distribution,
        "top_energy_by_zone": aggregate_locations(
            records,
            ("zone", "zone_name"),
            energy_keys,
        ),
        "top_energy_by_state": aggregate_locations(
            records,
            ("state", "state_name"),
            energy_keys,
        ),
        "top_energy_by_city": aggregate_locations(
            records,
            ("city", "city_name"),
            energy_keys,
        ),
        "top_energy_by_branch": aggregate_locations(
            records,
            ("branch", "branch_name"),
            energy_keys,
        ),
        "top_energy_by_floor": aggregate_locations(
            records,
            ("floor", "floor_name"),
            energy_keys,
        ),
    }


# ============================================================
# PREPARE DASHBOARD CONTEXT
# ============================================================

def prepare_dashboard_context(dashboard):
    if not isinstance(dashboard, dict):
        dashboard = {}

    trends = dashboard.get("trends")

    if not isinstance(trends, list):
        trends = dashboard.get("energy_trend", [])

    if isinstance(trends, list):
        trends = trends[-120:]

    ac_data = dashboard.get("ac_data", [])

    return {
        "dashboard_name": dashboard.get(
            "dashboard_name",
            "AC Energy Dashboard",
        ),
        "generated_at": dashboard.get("generated_at"),
        "filters": dashboard.get("filters", {}),
        "kpis": dashboard.get("kpis", {}),
        "trends": trends,
        "zones": dashboard.get("zones", []),
        "states": dashboard.get("states", []),
        "cities": dashboard.get("cities", []),
        "branches": dashboard.get("branches", []),
        "floors": dashboard.get("floors", []),
        "ac_health": dashboard.get("ac_health", []),
        "alerts": dashboard.get("alerts", []),
        "tables": dashboard.get("tables", []),
        "additional_data": dashboard.get(
            "additional_data",
            {},
        ),
        "calculated_summary_from_ac_data": summarize_ac_data(
            ac_data
        ),
    }


# ============================================================
# GROQ CLIENT
# ============================================================

def get_groq_client():
    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        raise RuntimeError(
            "GROQ_API_KEY is not configured. "
            "Add it to backend/.env."
        )

    return Groq(api_key=api_key)


def get_model_name():
    return os.getenv("GROQ_MODEL", MODEL_DEFAULT)


def serialize_data(data):
    return json.dumps(
        data,
        ensure_ascii=False,
        separators=(",", ":"),
        default=str,
    )


# ============================================================
# DETAILED DASHBOARD ANALYSIS
# ============================================================

def analyze_dashboard(dashboard):
    """
    Analyze the current dashboard and return the eleven sections
    used by the existing frontend.
    """
    client = get_groq_client()
    model = get_model_name()

    context = prepare_dashboard_context(dashboard)
    dashboard_json = serialize_data(context)

    prompt = f"""
Analyze the current AC dashboard data below.

The frontend displays each heading as a separate insight card.

For each heading:
- Write 2-4 short, useful sentences when the data supports it.
- Mention actual values and units whenever available.
- Explain comparisons only when historical data supports them.
- Give a practical next check when appropriate.
- State what data is missing when a section cannot be analyzed.
- Do not repeat the same generic sentence for every section.

Required headings in exactly this order:

KPI:
Energy:
Power:
Trend:
Zone:
State:
City:
Branch:
Floor:
AC Health:
Alerts:

Do not add extra headings.
Do not return JSON or a table.
Do not claim that everything is normal without supporting evidence.

DASHBOARD DATA:
{dashboard_json}
"""

    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        temperature=0.2,
        max_tokens=1800,
    )

    raw = (
        response.choices[0].message.content or ""
    ).strip()

    if not raw:
        raise RuntimeError(
            "The AI model returned an empty dashboard analysis."
        )

    labels = [
        "KPI",
        "Energy",
        "Power",
        "Trend",
        "Zone",
        "State",
        "City",
        "Branch",
        "Floor",
        "AC Health",
        "Alerts",
    ]

    found = {}
    current_label = None

    for line in raw.replace("**", "").splitlines():
        line = line.strip()

        if not line:
            continue

        cleaned = line.lstrip("-• ").strip()
        matched_label = None

        for label in labels:
            prefix = label + ":"

            if cleaned.lower().startswith(prefix.lower()):
                matched_label = label
                current_label = label

                value = cleaned[len(prefix):].strip()
                found.setdefault(label, [])

                if value:
                    found[label].append(value)

                break

        # Preserve wrapped text belonging to the current section.
        if matched_label is None and current_label:
            found.setdefault(current_label, []).append(cleaned)

    sections = []

    for label in labels:
        content = " ".join(found.get(label, [])).strip()

        if not content:
            content = (
                "Insufficient data was supplied for this section. "
                "Provide the relevant KPI, trend, or location readings."
            )

        sections.append(f"{label}: {content}")

    return "\n\n".join(sections)


# ============================================================
# ASK AI ABOUT DASHBOARD AND MAINTENANCE
# ============================================================

def answer_dashboard_question(
    question,
    dashboard,
    maintenance_records=None,
):
    """
    Answer one question using supplied dashboard data and, when
    supplied, maintenance records for the requested AC.
    """
    question = str(question or "").strip()

    if not question:
        raise ValueError("Please enter a question.")

    if len(question) > 2000:
        raise ValueError(
            "Question cannot exceed 2000 characters."
        )

    context = prepare_dashboard_context(dashboard)

    records = (
        maintenance_records
        if isinstance(maintenance_records, list)
        else []
    )

    supplied_data = {
        "dashboard_context": context,
        "maintenance_records_for_requested_ac": records,
    }

    client = get_groq_client()
    model = get_model_name()

    prompt = f"""
Answer the user's question using only the data supplied below.

Instructions:
1. Give the direct answer first.
2. Include relevant values, dates, or locations if available.
3. Explain what the evidence indicates.
4. Offer a practical next step when useful.
5. Do not invent readings, maintenance records, dates, causes, or conclusions.
6. Maintenance questions must be answered only from the maintenance records supplied.
7. If the answer is unavailable, clearly state what information is missing.
8. Do not assume that a maintenance record exists if none is supplied.

USER QUESTION:
{question}

SUPPLIED DATA:
{serialize_data(supplied_data)}
"""

    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        temperature=0.2,
        max_tokens=700,
    )

    answer = (
        response.choices[0].message.content or ""
    ).strip()

    if not answer:
        raise RuntimeError(
            "The AI model returned an empty answer."
        )

    return answer