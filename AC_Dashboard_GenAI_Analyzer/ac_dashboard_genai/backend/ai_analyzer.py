import json
import os
import re

from groq import Groq


MODEL_DEFAULT = "openai/gpt-oss-120b"

DASHBOARD_SECTIONS = [
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

MAINTENANCE_TYPES = [
    "Routine Service",
    "Filter Cleaning",
    "Coil Cleaning",
    "Gas Refilling",
    "Electrical Repair",
    "Compressor Inspection",
    "Fan Motor Repair",
    "Sensor Repair",
    "Water Leakage Repair",
    "PCB Repair",
    "Performance Inspection",
    "Other",
]

SYSTEM_PROMPT = """
You are a professional AI analyst for an AC energy monitoring system.

Use only the supplied dashboard, telemetry, and maintenance data.

Rules:
1. Never invent readings, dates, trends, faults, causes, or maintenance records.
2. Distinguish observed facts from possible explanations.
3. Missing data is not the same as zero.
4. Do not claim a component has failed without supporting evidence.
5. Give practical recommendations based on available evidence.
6. Use concise, professional language.
"""


# ============================================================
# GROQ CLIENT AND RESPONSE HANDLING
# ============================================================

def get_groq_client():
    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        raise RuntimeError(
            "GROQ_API_KEY is missing. Configure it in backend/.env."
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


def ask_model(prompt, max_tokens=2500):
    """
    Call Groq and return its visible answer.

    Logs response metadata to help diagnose empty responses.
    Does not print the API key or the submitted prompt.
    """
    client = get_groq_client()
    model = get_model_name()

    try:
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
            max_tokens=max(2500, max_tokens),
            reasoning_effort="low",
            include_reasoning=False,
        )

        if not response.choices:
            raise RuntimeError(
                "Groq returned no response choices."
            )

        choice = response.choices[0]
        message = choice.message
        answer = (message.content or "").strip()

        usage = getattr(response, "usage", None)

        print(
            "Groq response diagnostics:",
            {
                "model": model,
                "finish_reason": choice.finish_reason,
                "content_empty": not bool(answer),
                "completion_tokens": (
                    getattr(usage, "completion_tokens", None)
                    if usage else None
                ),
            },
        )

        if not answer:
            raise RuntimeError(
                "Groq returned empty text. "
                f"Finish reason: {choice.finish_reason}. "
                "Check the backend terminal for diagnostics."
            )

        return answer

    except RuntimeError:
        raise

    except Exception as exc:
        print(
            f"Groq API error: {type(exc).__name__}: {exc}"
        )

        raise RuntimeError(
            f"Groq request failed: {type(exc).__name__}: {exc}"
        ) from exc


# ============================================================
# DATA HELPERS
# ============================================================

def number(value):
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
    if not isinstance(item, dict):
        return None

    for key in keys:
        value = item.get(key)

        if value is not None and value != "":
            return value

    return None


def get_power(item):
    power = get_value(
        item,
        "active_power",
        "Active_Power",
        "activePower",
        "power",
        "Power",
    )

    if power is not None:
        return number(power)

    voltage = number(get_value(item, "voltage", "Voltage"))
    current = number(get_value(item, "current", "Current"))
    factor = number(
        get_value(
            item,
            "power_factor",
            "powerFactor",
            "Power_Factor",
        )
    )

    if (
        voltage is not None
        and current is not None
        and factor is not None
    ):
        return voltage * current * factor

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


# ============================================================
# LOCATION AGGREGATION
# ============================================================

def aggregate_locations(records, location_keys, value_keys):
    totals = {}

    for record in records:
        if not isinstance(record, dict):
            continue

        location = get_value(record, *location_keys)
        value = number(get_value(record, *value_keys))

        if location and value is not None:
            name = str(location).strip()
            totals[name] = totals.get(name, 0.0) + value

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
# CALCULATE SUMMARY FROM AC DATA
# ============================================================

def summarize_ac_data(ac_data):
    if not isinstance(ac_data, list):
        ac_data = []

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

    active = 0
    inactive = 0

    powers = []
    energies = []
    temperatures = []
    humidities = []
    health_counts = {}

    energy_keys = (
        "energy_consumption",
        "Energy_Consumption",
        "energyConsumption",
        "energy",
        "kwh",
        "kWh",
    )

    for record in records:
        status = str(
            get_value(
                record,
                "status",
                "ac_status",
                "state",
            ) or "unknown"
        ).strip().lower()

        if status in active_statuses:
            active += 1
        elif status in inactive_statuses:
            inactive += 1

        power = get_power(record)
        energy = get_energy(record)
        temperature = get_temperature(record)
        humidity = get_humidity(record)

        if power is not None:
            powers.append(power)

        if energy is not None:
            energies.append(energy)

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
            health = str(health)
            health_counts[health] = health_counts.get(health, 0) + 1

    def average(values):
        if not values:
            return None

        return round(sum(values) / len(values), 2)

    return {
        "record_count": len(records),
        "active_ac_count": active,
        "inactive_ac_count": inactive,
        "unknown_status_count": len(records) - active - inactive,
        "total_active_power": (
            round(sum(powers), 3) if powers else None
        ),
        "power_record_count": len(powers),
        "total_energy": (
            round(sum(energies), 3) if energies else None
        ),
        "energy_record_count": len(energies),
        "average_indoor_temperature": average(temperatures),
        "temperature_record_count": len(temperatures),
        "average_indoor_humidity": average(humidities),
        "humidity_record_count": len(humidities),
        "health_distribution": health_counts,
        "top_energy_by_zone": aggregate_locations(
            records, ("zone", "zone_name"), energy_keys
        ),
        "top_energy_by_state": aggregate_locations(
            records, ("state", "state_name"), energy_keys
        ),
        "top_energy_by_city": aggregate_locations(
            records, ("city", "city_name"), energy_keys
        ),
        "top_energy_by_branch": aggregate_locations(
            records, ("branch", "branch_name"), energy_keys
        ),
        "top_energy_by_floor": aggregate_locations(
            records, ("floor", "floor_name"), energy_keys
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

    if not isinstance(trends, list):
        trends = []

    return {
        "dashboard_name": dashboard.get(
            "dashboard_name",
            "AC Energy Dashboard",
        ),
        "generated_at": dashboard.get("generated_at"),
        "filters": dashboard.get("filters", {}),
        "kpis": dashboard.get("kpis", {}),
        "trends": trends[-120:],
        "zones": dashboard.get("zones", []),
        "states": dashboard.get("states", []),
        "cities": dashboard.get("cities", []),
        "branches": dashboard.get("branches", []),
        "floors": dashboard.get("floors", []),
        "ac_health": dashboard.get("ac_health", []),
        "alerts": dashboard.get("alerts", []),
        "tables": dashboard.get("tables", []),
        "additional_data": dashboard.get("additional_data", {}),
        "calculated_summary_from_ac_data": summarize_ac_data(
            dashboard.get("ac_data", [])
        ),
    }


# ============================================================
# OUTPUT HELPERS
# ============================================================

def extract_sections(raw, labels):
    result = {}
    current_label = None

    for line in raw.replace("**", "").splitlines():
        line = line.strip()

        if not line:
            continue

        cleaned = line.lstrip("-• ").strip()
        matched = False

        for label in labels:
            prefix = label + ":"

            if cleaned.lower().startswith(prefix.lower()):
                current_label = label
                result.setdefault(label, [])

                value = cleaned[len(prefix):].strip()

                if value:
                    result[label].append(value)

                matched = True
                break

        if not matched and current_label:
            result.setdefault(current_label, []).append(cleaned)

    return {
        label: " ".join(result.get(label, [])).strip()
        for label in labels
    }


def limit_sentences(text, max_sentences=3):
    text = str(text or "").strip()

    if not text:
        return ""

    sentences = re.split(
        r'(?<=[.!?])\s+(?=[A-Z0-9])',
        text,
    )

    return " ".join(sentences[:max_sentences]).strip()


def limit_words(text, max_words=30):
    words = str(text or "").split()

    if len(words) <= max_words:
        return " ".join(words)

    return " ".join(words[:max_words]).rstrip(" ,;:") + "..."


# ============================================================
# DASHBOARD ANALYSIS
# Returns short and descriptive versions
# ============================================================

def analyze_dashboard(dashboard):
    context = prepare_dashboard_context(dashboard)
    dashboard_json = serialize_data(context)

    headings = "\n".join(
        f"{section}:" for section in DASHBOARD_SECTIONS
    )

    # SHORT VERSION: maximum 3 sentences and 30 words per section.
    short_prompt = f"""
Analyze the AC monitoring dashboard.

Return exactly these headings:
{headings}

STRICT RULES:
- Maximum 3 sentences per section.
- Maximum 30 words per section.
- Prefer 1 or 2 sentences.
- State the key finding and one useful action.
- Use actual values and units.
- Do not repeat information between sections.
- Do not invent values, trends, locations, or faults.
- If data is missing, state that briefly.
- No introduction, conclusion, or table.

DASHBOARD DATA:
{dashboard_json}
"""

    short_raw = ask_model(short_prompt, max_tokens=1000)

    short_sections = extract_sections(
        short_raw,
        DASHBOARD_SECTIONS,
    )

    short_result = {}

    for section in DASHBOARD_SECTIONS:
        content = short_sections.get(section, "")

        if not content:
            content = "Insufficient data is available."

        content = limit_sentences(content, 3)
        content = limit_words(content, 30)

        short_result[section] = content

    # DESCRIPTIVE VERSION: shown only when requested by the frontend.
    descriptive_prompt = f"""
Provide a detailed analysis of the AC monitoring dashboard.

Return exactly these headings:
{headings}

Explain the finding, relevant evidence, and practical implications.
Use only actual supplied data. Mention missing data where relevant.
Give useful recommendations without inventing faults, causes,
values, trends, dates, or savings.

Use readable paragraphs. Do not return JSON or a table.

DASHBOARD DATA:
{dashboard_json}
"""

    descriptive_raw = ask_model(
        descriptive_prompt,
        max_tokens=2500,
    )

    descriptive_sections = extract_sections(
        descriptive_raw,
        DASHBOARD_SECTIONS,
    )

    descriptive_result = {}

    for section in DASHBOARD_SECTIONS:
        descriptive_result[section] = (
            descriptive_sections.get(section)
            or "Insufficient data is available for detailed analysis."
        )

    return {
        "short": short_result,
        "descriptive": descriptive_result,
    }


# ============================================================
# ASK AI
# Returns short and descriptive answers
# ============================================================

def answer_dashboard_question(
    question,
    dashboard,
    maintenance_records=None,
):
    question = str(question or "").strip()

    if not question:
        raise ValueError("Please enter a question.")

    if len(question) > 2000:
        raise ValueError("Question cannot exceed 2000 characters.")

    context = prepare_dashboard_context(dashboard)

    supplied_data = {
        "dashboard_context": context,
        "maintenance_records_for_requested_ac": (
            maintenance_records
            if isinstance(maintenance_records, list)
            else []
        ),
    }

    data_json = serialize_data(supplied_data)

    short_prompt = f"""
Answer the user's question using only the supplied data.

Rules:
- Maximum 3 sentences and 30 words in total.
- Answer directly.
- Mention the most relevant values.
- Give one practical action if useful.
- Never invent information.
- If information is missing, say so briefly.

QUESTION:
{question}

DATA:
{data_json}
"""

    descriptive_prompt = f"""
Answer the user's question using only the supplied data.

Start with the direct answer. Explain the supporting evidence,
what it means, and practical next steps where useful.

Never invent readings, dates, causes, faults, or maintenance records.
For maintenance questions, use only supplied maintenance history.
If information is unavailable, state what is missing.

QUESTION:
{question}

DATA:
{data_json}
"""

    short_answer = ask_model(
        short_prompt,
        max_tokens=500,
    )

    short_answer = limit_sentences(short_answer, 3)
    short_answer = limit_words(short_answer, 30)

    descriptive_answer = ask_model(
        descriptive_prompt,
        max_tokens=1500,
    )

    return {
        "short": short_answer,
        "descriptive": descriptive_answer,
    }


# ============================================================
# MAINTENANCE RECOMMENDATION
# ============================================================

def recommend_maintenance(
    ac_id,
    problem,
    previous_maintenance_date=None,
    previous_maintenance_type=None,
    maintenance_history=None,
    maintenance_type="Other",
    other_maintenance_type=None,
    current_telemetry=None,
):
    ac_id = str(ac_id or "").strip()
    problem = str(problem or "").strip()

    if not ac_id:
        raise ValueError("AC ID is required.")

    if not problem:
        raise ValueError("Please describe the AC problem.")

    if len(problem) > 2000:
        raise ValueError(
            "Problem description cannot exceed 2000 characters."
        )

    maintenance_type = str(
        maintenance_type or "Other"
    ).strip()

    if maintenance_type not in MAINTENANCE_TYPES:
        raise ValueError("Select a valid maintenance type.")

    if maintenance_type == "Other":
        other_maintenance_type = str(
            other_maintenance_type or ""
        ).strip()

        if not other_maintenance_type:
            raise ValueError(
                "Enter the maintenance type when Other is selected."
            )

    selected_type = (
        other_maintenance_type
        if maintenance_type == "Other"
        else maintenance_type
    )

    history = (
        maintenance_history
        if isinstance(maintenance_history, list)
        else []
    )

    context = {
        "ac_id": ac_id,
        "reported_problem": problem,
        "selected_maintenance_type": selected_type,
        "previous_maintenance_date": previous_maintenance_date,
        "previous_maintenance_type": previous_maintenance_type,
        "maintenance_history": history[-30:],
        "current_telemetry": (
            current_telemetry
            if isinstance(current_telemetry, dict)
            else {}
        ),
    }

    prompt = f"""
Analyze this AC maintenance case using only the supplied information.

Return these headings:
LIKELY_ISSUE:
RECOMMENDED_MAINTENANCE:
REASON:
PRIORITY:
SUGGESTED_CHECKS:
PREVIOUS_MAINTENANCE_REVIEW:
TECHNICIAN_NOTE:

Rules:
- LIKELY_ISSUE: maximum 30 words.
- RECOMMENDED_MAINTENANCE: maximum 30 words.
- REASON: maximum 30 words.
- PREVIOUS_MAINTENANCE_REVIEW: maximum 30 words.
- PRIORITY must be Low, Medium, High, or Urgent.
- State that priority is provisional when evidence is incomplete.
- Recommend maintenance based on the reported problem and evidence.
- Do not treat the selected maintenance type as proof of a fault.
- Do not invent dates or previous maintenance records.
- If telemetry is missing, say the assessment is based on the
  reported problem and supplied history only.
- Do not claim a component has failed without evidence.
- Include relevant practical inspection steps.
- For electrical safety symptoms, recommend isolating the unit
  and involving a qualified technician.

MAINTENANCE DATA:
{serialize_data(context)}
"""

    recommendation = ask_model(
        prompt,
        max_tokens=1200,
    )

    return {
        "ac_id": ac_id,
        "selected_maintenance_type": selected_type,
        "recommendation": recommendation,
        "input_context": context,
    }