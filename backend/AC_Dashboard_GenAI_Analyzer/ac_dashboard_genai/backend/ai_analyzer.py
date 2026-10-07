# import json
# import os
# from groq import Groq

# SYSTEM_PROMPT = """
# You are an expert AI analyst for an enterprise AC Energy Monitoring Dashboard.

# Your task is to analyze the CURRENT DASHBOARD STATE provided as JSON.
# This is dashboard-level analysis, not screenshot analysis.

# Analyze only information present in the input. Never invent readings, causes,
# trends, percentages, locations, or device conditions that are not supported by
# the data.

# Important rules:
# - Treat null, empty, or missing fields as unavailable.
# - Distinguish measured facts from interpretations.
# - If a conclusion is uncertain, say that it is an indication, not a confirmed fault.
# - Compare current values with previous values when the input provides them.
# - Identify unusually high/low energy, power, temperature, current, or other metrics.
# - Look for concentration of consumption by zone, state, city, branch, floor, or AC.
# - Use percentages supplied by the dashboard when available; otherwise calculate
#   simple percentages from supplied numeric values.
# - Do not repeatedly restate every KPI. Focus on useful findings.
# - Give practical recommendations.
# - Do not claim to have visually seen a dashboard or screenshot.

# Return a professional dashboard analysis with these sections:

# ## Executive Summary
# 2-5 concise sentences.

# ## Energy & Power Analysis
# Important consumption and power findings.

# ## AC Health & Operations
# Active/inactive/health/operational findings.

# ## Trend & Comparison Analysis
# Relevant increases, decreases, peaks, and comparisons.

# ## Anomalies / Risk Areas
# List only meaningful anomalies supported by the data.
# If none are present, say so.

# ## Location / Branch Analysis
# Identify important high/low consuming areas and concentration.

# ## Recommendations
# Prioritized actions.

# ## Priority
# Use:
# - CRITICAL
# - HIGH
# - MEDIUM
# - LOW
# when appropriate.

# Keep the response concise but analytical. Use actual values and units from the
# input.
# """


# def analyze_dashboard(dashboard: dict) -> str:
#     api_key = os.getenv("GROQ_API_KEY")
#     if not api_key or api_key == "YOUR_GROQ_API_KEY":
#         raise RuntimeError(
#             "GROQ_API_KEY is not configured. Add your Groq API key to backend/.env"
#         )

#     model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
#     client = Groq(api_key=api_key)

#     # Compact JSON keeps the model focused on the actual dashboard state.
#     dashboard_json = json.dumps(dashboard, ensure_ascii=False, separators=(",", ":"))

#     user_prompt = f"""
# Analyze this current AC dashboard state.

# DASHBOARD DATA:
# {dashboard_json}

# Produce the requested dashboard-level analysis.
# """

#     response = client.chat.completions.create(
#         model=model,
#         messages=[
#             {"role": "system", "content": SYSTEM_PROMPT},
#             {"role": "user", "content": user_prompt}
#         ],
#         temperature=0.15,
#         max_tokens=5000,
#         reasoning_effort="high"
#     )

#     return response.choices[0].message.content



import json
import os
from typing import Any

from groq import Groq


# ============================================================
# SYSTEM PROMPT
# ============================================================

SYSTEM_PROMPT = """

You are an expert AI analyst for an enterprise
AC Energy Monitoring Dashboard.

You are NOT analyzing a screenshot.

You are analyzing the LIVE DATA currently displayed
by a dashboard.

Your job is to understand the complete dashboard state
and provide useful operational insights.

============================================================
IMPORTANT RULES
============================================================

1. Use ONLY the information provided.

2. NEVER invent:
   - sensor values
   - AC conditions
   - locations
   - percentages
   - faults
   - trends
   - causes

3. Clearly distinguish:
   - measured facts
   - calculated values
   - possible explanations

4. If data is unavailable, say:
   "Insufficient data to determine this."

5. Focus on dashboard-level analysis.

6. Do not analyze every AC individually unless the data
   clearly indicates an important problem.

7. Identify:
   - high energy consumption
   - high power consumption
   - sudden increases
   - sudden decreases
   - abnormal temperature
   - abnormal humidity
   - AC health issues
   - alerts
   - high consuming branches
   - high consuming zones
   - unusual trends
   - important changes

8. Compare current values with trend/history values
   whenever available.

9. Prioritize important problems instead of repeating
   every dashboard value.

10. Give practical recommendations.

============================================================
OUTPUT FORMAT
============================================================

Return the following structure.

## Executive Summary

Give a concise overall description of the current
dashboard condition.

## KPI Analysis

Analyze:

- Total ACs
- Active ACs
- Energy
- Power
- Temperature
- Humidity
- Alerts

Mention important changes or abnormal values.

## Energy Analysis

Identify:

- high consumption
- low consumption
- increasing consumption
- decreasing consumption
- important energy trends

## Power Analysis

Analyze:

- current power
- average power
- sudden power increases
- unusual power consumption

## AC Health

Analyze:

- healthy ACs
- warning ACs
- critical ACs
- active/inactive conditions
- important health problems

## Location Analysis

Identify important locations:

- state
- city
- zone
- branch
- floor

Mention the highest consuming areas when the data
supports it.

## Trend Analysis

Analyze the supplied historical/rolling trend.

Identify:

- increasing trends
- decreasing trends
- peaks
- drops
- unusual changes

## Anomalies / Risk Areas

Only mention meaningful anomalies supported by data.

For each important anomaly include:

- Issue
- Evidence
- Severity

Severity:

CRITICAL
HIGH
MEDIUM
LOW

## Recommendations

Give practical actions.

Prioritize the most important actions first.

## Final Dashboard Status

Give one of:

NORMAL
ATTENTION REQUIRED
HIGH ENERGY RISK
CRITICAL

Then explain why in one or two sentences.

"""


# ============================================================
# SAFE NUMBER
# ============================================================

def number(value):

    try:

        if value is None:
            return None

        if value == "":
            return None

        value = float(value)

        return value

    except Exception:

        return None


# ============================================================
# GET VALUE
# ============================================================

def get_value(item, *keys):

    if not isinstance(item, dict):
        return None

    for key in keys:

        if key in item:

            value = item[key]

            if value not in (None, ""):
                return value

    return None


# ============================================================
# AC POWER
# ============================================================

def get_power(item):

    direct_power = get_value(
        item,
        "active_power",
        "Active_Power",
        "power",
        "Power",
    )

    if direct_power is not None:

        return number(direct_power) or 0

    voltage = number(
        get_value(
            item,
            "voltage",
            "Voltage",
        )
    ) or 0

    current = number(
        get_value(
            item,
            "current",
            "Current",
        )
    ) or 0

    return voltage * current


# ============================================================
# AC ENERGY
# ============================================================

def get_energy(item):

    return number(
        get_value(
            item,
            "energy_consumption",
            "Energy_Consumption",
            "energy",
            "kwh",
            "kWh",
        )
    ) or 0


# ============================================================
# TEMPERATURE
# ============================================================

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


# ============================================================
# HUMIDITY
# ============================================================

def get_humidity(item):

    return number(
        get_value(
            item,
            "indoor_humidity",
            "humidity",
        )
    )


# ============================================================
# STATUS
# ============================================================

def get_status(item):

    value = get_value(
        item,
        "status",
        "ac_status",
        "state",
    )

    if value is None:
        return "unknown"

    return str(value).lower()


# ============================================================
# LOCATION
# ============================================================

def get_location(item, *keys):

    value = get_value(item, *keys)

    if value is None:
        return "Unknown"

    return str(value)


# ============================================================
# SUMMARIZE RAW AC DATA
# ============================================================

def summarize_ac_data(ac_data):

    if not isinstance(ac_data, list):

        return {
            "record_count": 0
        }

    total = len(ac_data)

    active = 0

    total_power = 0

    total_energy = 0

    temperatures = []

    humidities = []

    health_counts = {}

    branch_energy = {}

    zone_energy = {}

    state_energy = {}

    city_energy = {}

    high_power = []

    high_energy = []

    for item in ac_data:

        if not isinstance(item, dict):
            continue

        # ------------------------------------
        # STATUS
        # ------------------------------------

        status = get_status(item)

        if status in (
            "active",
            "running",
            "on",
            "1",
        ):
            active += 1

        # ------------------------------------
        # POWER
        # ------------------------------------

        power = get_power(item)

        total_power += power

        # ------------------------------------
        # ENERGY
        # ------------------------------------

        energy = get_energy(item)

        total_energy += energy

        # ------------------------------------
        # TEMPERATURE
        # ------------------------------------

        temperature = get_temperature(item)

        if temperature is not None:
            temperatures.append(temperature)

        # ------------------------------------
        # HUMIDITY
        # ------------------------------------

        humidity = get_humidity(item)

        if humidity is not None:
            humidities.append(humidity)

        # ------------------------------------
        # HEALTH
        # ------------------------------------

        health = get_location(
            item,
            "health_status",
            "health",
            "alert_status",
        ).lower()

        health_counts[health] = (
            health_counts.get(health, 0) + 1
        )

        # ------------------------------------
        # LOCATION
        # ------------------------------------

        branch = get_location(
            item,
            "branch",
            "branch_name",
        )

        zone = get_location(
            item,
            "zone",
            "zone_name",
        )

        state = get_location(
            item,
            "state",
            "state_name",
        )

        city = get_location(
            item,
            "city",
            "city_name",
        )

        branch_energy[branch] = (
            branch_energy.get(branch, 0) + energy
        )

        zone_energy[zone] = (
            zone_energy.get(zone, 0) + energy
        )

        state_energy[state] = (
            state_energy.get(state, 0) + energy
        )

        city_energy[city] = (
            city_energy.get(city, 0) + energy
        )

        # ------------------------------------
        # HIGH POWER CANDIDATES
        # ------------------------------------

        ac_id = get_location(
            item,
            "ac_id",
            "device_name",
            "device_id",
            "id",
        )

        high_power.append({
            "ac_id": ac_id,
            "power": power,
            "branch": branch,
            "zone": zone,
        })

        high_energy.append({
            "ac_id": ac_id,
            "energy": energy,
            "branch": branch,
            "zone": zone,
        })

    # ========================================================
    # SORT TOP CONSUMERS
    # ========================================================

    high_power.sort(
        key=lambda x: x["power"],
        reverse=True
    )

    high_energy.sort(
        key=lambda x: x["energy"],
        reverse=True
    )

    top_branches = sorted(
        [
            {
                "branch": key,
                "energy": value
            }
            for key, value in branch_energy.items()
        ],
        key=lambda x: x["energy"],
        reverse=True
    )[:10]

    top_zones = sorted(
        [
            {
                "zone": key,
                "energy": value
            }
            for key, value in zone_energy.items()
        ],
        key=lambda x: x["energy"],
        reverse=True
    )[:10]

    top_states = sorted(
        [
            {
                "state": key,
                "energy": value
            }
            for key, value in state_energy.items()
        ],
        key=lambda x: x["energy"],
        reverse=True
    )[:10]

    top_cities = sorted(
        [
            {
                "city": key,
                "energy": value
            }
            for key, value in city_energy.items()
        ],
        key=lambda x: x["energy"],
        reverse=True
    )[:10]

    average_temperature = (
        sum(temperatures) / len(temperatures)
        if temperatures
        else None
    )

    average_humidity = (
        sum(humidities) / len(humidities)
        if humidities
        else None
    )

    return {

        "record_count": total,

        "active_ac": active,

        "inactive_ac": total - active,

        "total_power": round(
            total_power,
            2
        ),

        "total_energy": round(
            total_energy,
            2
        ),

        "average_temperature": (
            round(
                average_temperature,
                2
            )
            if average_temperature is not None
            else None
        ),

        "average_humidity": (
            round(
                average_humidity,
                2
            )
            if average_humidity is not None
            else None
        ),

        "health_distribution": health_counts,

        "top_power_consumers": high_power[:10],

        "top_energy_consumers": high_energy[:10],

        "top_branches": top_branches,

        "top_zones": top_zones,

        "top_states": top_states,

        "top_cities": top_cities,
    }


# ============================================================
# PREPARE DASHBOARD CONTEXT
# ============================================================

def prepare_dashboard_context(dashboard):

    ac_data = dashboard.get(
        "ac_data",
        []
    )

    raw_summary = summarize_ac_data(
        ac_data
    )

    context = {

        "dashboard_name":
            dashboard.get(
                "dashboard_name"
            ),

        "generated_at":
            dashboard.get(
                "generated_at"
            ),

        "filters":
            dashboard.get(
                "filters",
                {}
            ),

        "dashboard_kpis":
            dashboard.get(
                "kpis",
                {}
            ),

        "dashboard_trends":
            dashboard.get(
                "trends",
                []
            )[-60:],

        "dashboard_zones":
            dashboard.get(
                "zones",
                []
            ),

        "dashboard_states":
            dashboard.get(
                "states",
                []
            ),

        "dashboard_cities":
            dashboard.get(
                "cities",
                []
            ),

        "dashboard_branches":
            dashboard.get(
                "branches",
                []
            ),

        "dashboard_floors":
            dashboard.get(
                "floors",
                []
            ),

        "dashboard_health":
            dashboard.get(
                "ac_health",
                {}
            ),

        "dashboard_alerts":
            dashboard.get(
                "alerts",
                []
            ),

        "calculated_from_live_ac_data":
            raw_summary,

        "additional_data":
            dashboard.get(
                "additional_data",
                {}
            ),
    }

    return context


# ============================================================
# GROQ ANALYSIS
# ============================================================

def analyze_dashboard(dashboard):

    api_key = os.getenv(
        "GROQ_API_KEY"
    )

    if not api_key:

        raise RuntimeError(
            "GROQ_API_KEY is not configured. "
            "Add it to backend/.env"
        )

    model = os.getenv(
        "GROQ_MODEL",
        "openai/gpt-oss-120b"
    )

    client = Groq(
        api_key=api_key
    )

    context = prepare_dashboard_context(
        dashboard
    )

    dashboard_json = json.dumps(
        context,
        ensure_ascii=False,
        separators=(",", ":")
    )

    user_prompt = f"""

Analyze the following CURRENT LIVE AC DASHBOARD DATA.

This data comes directly from the dashboard's runtime
state. Do NOT assume this is a screenshot.

============================================================
CURRENT DASHBOARD DATA
============================================================

{dashboard_json}

============================================================

Provide the complete dashboard analysis according to
the required output format.

Focus on the most important findings.

Use actual numbers and units wherever available.

Do not invent missing information.
"""

    response = client.chat.completions.create(

        model=model,

        messages=[
            {
                "role": "system",
                "content": SYSTEM_PROMPT
            },
            {
                "role": "user",
                "content": user_prompt
            }
        ],

        temperature=0.15,

        max_tokens=5000,

        reasoning_effort="high",
    )

    return response.choices[0].message.content