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
    "Preventive",
    "Corrective",
    "Inspection",
    "Repair",
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

Use only the supplied dashboard data, telemetry, calculations,
and maintenance records.

RULES:
1. Never invent readings, dates, trends, faults, causes, or records.
2. Distinguish measured facts from possible explanations.
3. Missing data is not the same as zero.
4. Never claim a component has failed without evidence.
5. Use supplied mathematical calculations when available.
6. Give practical recommendations based on the evidence.
7. Do not claim that a difference in consumption proves a fault.
8. Use concise, professional language.
"""


# ============================================================
# GROQ CLIENT
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
    Call Groq and return visible answer text.
    Log response metadata if the model returns empty content.
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
        answer = (choice.message.content or "").strip()
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
                f"Finish reason: {choice.finish_reason}."
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
# BASIC DATA HELPERS
# ============================================================

def number(value):
    if value is None or value == "" or isinstance(value, bool):
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


def first_number(item, *keys):
    return number(get_value(item, *keys))


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
        get_value(item, "indoor_humidity", "humidity")
    )


# ============================================================
# AGGREGATE LOCATION VALUES
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

    return sorted(
        [
            {
                "name": name,
                "value": round(value, 3),
            }
            for name, value in totals.items()
        ],
        key=lambda item: item["value"],
        reverse=True,
    )[:10]


# ============================================================
# CALCULATE SUMMARY FROM AC TELEMETRY
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
# MATHEMATICAL INSIGHTS
# ============================================================

def calculate_math_insights(dashboard):
    """
    Calculate comparisons only when compatible values exist.

    Branch energy comparisons use the supplied branch records.
    AC energy is not added across locations unless the data
    clearly represents compatible measurements.
    """
    if not isinstance(dashboard, dict):
        dashboard = {}

    kpis = dashboard.get("kpis", {})
    if not isinstance(kpis, dict):
        kpis = {}

    ac_data = dashboard.get("ac_data", [])
    if not isinstance(ac_data, list):
        ac_data = []

    insights = {}

    total_energy = first_number(
        kpis,
        "total_energy",
        "totalEnergy",
        "total_energy_consumption",
        "totalEnergyConsumption",
    )

    active_energy = first_number(
        kpis,
        "active_energy",
        "activeEnergy",
        "active_energy_consumption",
        "activeEnergyConsumption",
    )

    total_acs = first_number(
        kpis,
        "total_acs",
        "totalACs",
        "total_ac_count",
        "totalACCount",
    )

    active_acs = first_number(
        kpis,
        "active_acs",
        "activeACs",
        "active_ac_count",
        "activeACCount",
    )

    if total_energy is not None and active_energy is not None:
        insights["energy_difference_kwh"] = round(
            total_energy - active_energy, 3
        )

        if total_energy > 0:
            insights["active_energy_percentage"] = round(
                active_energy / total_energy * 100, 2
            )

    if (
        total_acs is not None
        and active_acs is not None
        and total_acs > 0
        and 0 <= active_acs <= total_acs
    ):
        insights["active_ac_percentage"] = round(
            active_acs / total_acs * 100, 2
        )

        insights["inactive_ac_count"] = int(
            total_acs - active_acs
        )

    # If KPI counts are missing, derive counts from individual ACs.
    if ac_data and (
        total_acs is None or active_acs is None
    ):
        active_statuses = {
            "active", "running", "on", "1", "true"
        }

        inactive_statuses = {
            "inactive", "stopped", "off", "0", "false"
        }

        statuses = [
            str(
                get_value(item, "status", "ac_status", "state")
                or "unknown"
            ).strip().lower()
            for item in ac_data
            if isinstance(item, dict)
        ]

        known_active = sum(
            status in active_statuses for status in statuses
        )

        known_inactive = sum(
            status in inactive_statuses for status in statuses
        )

        if total_acs is None:
            total_acs = len(statuses)

        if active_acs is None:
            active_acs = known_active

        if total_acs > 0:
            insights["active_ac_count_from_records"] = known_active
            insights["inactive_ac_count_from_records"] = known_inactive
            insights["unknown_status_count_from_records"] = (
                len(statuses) - known_active - known_inactive
            )

            insights["active_ac_percentage_from_records"] = round(
                known_active / len(statuses) * 100, 2
            ) if statuses else None

    # Branch data may be represented as a list of objects.
    branch_records = dashboard.get("branches", [])
    branch_totals = {}

    if isinstance(branch_records, list):
        for branch in branch_records:
            if not isinstance(branch, dict):
                continue

            name = get_value(
                branch,
                "name",
                "branch",
                "branch_name",
                "label",
            )

            energy = get_energy(branch)

            if energy is None:
                energy = first_number(
                    branch,
                    "value",
                    "totalEnergy",
                )

            if name and energy is not None:
                name = str(name).strip()
                branch_totals[name] = (
                    branch_totals.get(name, 0.0) + energy
                )

    # Fall back to AC records if branch-level records are absent.
    if not branch_totals:
        for record in ac_data:
            if not isinstance(record, dict):
                continue

            branch = get_value(
                record,
                "branch",
                "branch_name",
            )

            energy = get_energy(record)

            if branch and energy is not None:
                name = str(branch).strip()
                branch_totals[name] = (
                    branch_totals.get(name, 0.0) + energy
                )

    ranked_branches = sorted(
        [
            {
                "name": name,
                "energy_kwh": round(value, 3),
            }
            for name, value in branch_totals.items()
        ],
        key=lambda item: item["energy_kwh"],
        reverse=True,
    )

    if ranked_branches:
        insights["branch_energy_ranking"] = ranked_branches[:10]
        insights["highest_energy_branch"] = ranked_branches[0]

    if len(ranked_branches) >= 2:
        highest = ranked_branches[0]
        lowest = ranked_branches[-1]

        insights["branch_energy_difference_kwh"] = round(
            highest["energy_kwh"] - lowest["energy_kwh"],
            3,
        )

        if lowest["energy_kwh"] > 0:
            insights["branch_energy_ratio"] = round(
                highest["energy_kwh"] / lowest["energy_kwh"],
                2,
            )

        insights["lowest_energy_branch"] = lowest

    # Temperature and humidity averages from actual telemetry.
    temperatures = [
        get_temperature(item)
        for item in ac_data
        if isinstance(item, dict)
    ]

    temperatures = [
        value for value in temperatures
        if value is not None
    ]

    if temperatures:
        insights["average_temperature"] = round(
            sum(temperatures) / len(temperatures), 2
        )

        insights["temperature_range"] = round(
            max(temperatures) - min(temperatures), 2
        )

    humidities = [
        get_humidity(item)
        for item in ac_data
        if isinstance(item, dict)
    ]

    humidities = [
        value for value in humidities
        if value is not None
    ]

    if humidities:
        insights["average_humidity"] = round(
            sum(humidities) / len(humidities), 2
        )

    return insights


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
        "mathematical_insights": calculate_math_insights(dashboard),
    }


# ============================================================
# PARSE MODEL OUTPUT
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
# ============================================================

def analyze_dashboard(dashboard):
    context = prepare_dashboard_context(dashboard)
    dashboard_json = serialize_data(context)

    headings = "\n".join(
        f"{section}:" for section in DASHBOARD_SECTIONS
    )

    short_prompt = f"""
Analyze the supplied AC monitoring dashboard using actual data
and the precomputed mathematical_insights.

Return exactly these headings:
{headings}

SHORT ANSWER RULES:
- Maximum 3 sentences and 30 words per section.
- Prefer 1 or 2 sentences.
- State important numerical findings.
- Use calculated differences, percentages, and ratios when relevant.
- Give one useful action where appropriate.
- Explain what the result means without claiming unsupported faults.
- Do not invent values or trends.
- Do not compare periods without matching historical data.
- If data is missing, state that briefly.
- Do not add an introduction, conclusion, or table.

MATHEMATICAL REASONING:
- Use the supplied mathematical_insights.
- Show a brief calculation when it helps explain a finding.
- Do not add incompatible energy values.
- Do not treat cumulative meter readings as interval consumption.
- Do not calculate savings without sufficient evidence.

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

        short_result[section] = limit_words(
            limit_sentences(content, 3),
            30,
        )

    descriptive_prompt = f"""
Provide a detailed mathematical analysis of the AC dashboard.

Return exactly these headings:
{headings}

Use actual readings and the supplied mathematical_insights.
Explain relevant calculations, percentages, ratios, and comparisons.
Describe what the evidence means and suggest practical next steps.
Distinguish mathematical findings from possible causes.

Do not invent values, dates, trends, faults, or savings.
Do not combine incompatible measurements.
Mention missing data where relevant.
Return readable paragraphs, not JSON or a table.

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
        raise ValueError(
            "Question cannot exceed 2000 characters."
        )

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

SHORT ANSWER RULES:
- Maximum 3 sentences and 30 words total.
- Answer directly.
- Calculate differences, ratios, percentages, or averages when possible.
- Show the key numerical result.
- Briefly explain its practical meaning.
- Never invent missing values.
- If information is unavailable, say so briefly.

MATHEMATICAL REASONING:
- Use mathematical_insights when relevant.
- Show calculations using the supplied values.
- Do not infer faults from consumption differences alone.
- Do not combine incompatible measurements.

QUESTION:
{question}

DATA:
{data_json}
"""

    short_answer = ask_model(
        short_prompt,
        max_tokens=500,
    )

    short_answer = limit_words(
        limit_sentences(short_answer, 3),
        30,
    )

    descriptive_prompt = f"""
Answer the user's question using only the supplied data.

Give the direct answer first. Explain the relevant numerical evidence,
show calculations where useful, and describe the practical meaning.
Recommend a reasonable next step when appropriate.

Never invent readings, dates, causes, faults, or maintenance records.
Use only supplied maintenance history for maintenance questions.
Do not combine incompatible energy measurements.
If the data is insufficient, state what is missing.

QUESTION:
{question}

DATA:
{data_json}
"""

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
        raise ValueError(
            "Select a valid maintenance type."
        )

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

RULES:
- Keep LIKELY_ISSUE within 30 words.
- Keep RECOMMENDED_MAINTENANCE within 30 words.
- Keep REASON within 30 words.
- Keep PREVIOUS_MAINTENANCE_REVIEW within 30 words.
- PRIORITY must be Low, Medium, High, or Urgent.
- Explain that priority is provisional when evidence is incomplete.
- Use previous maintenance dates and history when supplied.
- Do not invent maintenance records or dates.
- Do not treat the selected maintenance type as proof of a fault.
- Never claim a component has failed without evidence.
- Recommend practical checks.
- If telemetry is missing, state that the assessment uses the
  reported problem and supplied maintenance history only.
- For electrical safety symptoms, advise isolating the unit and
  involving a qualified technician.

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