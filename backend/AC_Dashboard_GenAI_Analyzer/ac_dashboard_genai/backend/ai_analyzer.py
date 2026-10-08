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

You are analyzing LIVE DATA currently displayed
by the dashboard.

Your job is to provide ONE SHORT and MEANINGFUL
insight for EACH important dashboard graph or section.

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

3. Use actual values from the dashboard whenever available.

4. Do NOT repeat every dashboard value.

5. Focus on the most important information.

6. Each section must contain ONLY ONE short sentence.

7. Keep every sentence meaningful and useful.

8. Identify:
   - high energy consumption
   - low energy consumption
   - energy increase
   - energy decrease
   - high power consumption
   - power increase/decrease
   - important trends
   - highest-consuming zones
   - highest-consuming states
   - highest-consuming cities
   - highest-consuming branches
   - highest-consuming floors
   - AC health problems
   - important alerts

9. Compare current values with historical/trend values
   ONLY when the data is actually available.

10. If useful information is not available for a section,
    say:
    "No significant change detected."

11. Do NOT explain your reasoning.

12. Do NOT provide long explanations.

13. Do NOT provide detailed recommendations.

14. Do NOT create information that does not exist
    in the provided dashboard data.

============================================================
REQUIRED OUTPUT
============================================================

Return EXACTLY these sections:

KPI:
One short sentence about the most important KPI condition.

Energy:
One short sentence about the important energy condition
or change.

Power:
One short sentence about the important power condition
or change.

Trend:
One short sentence about the most important trend.

Zone:
One short sentence about the important zone comparison
or highest-consuming zone.

State:
One short sentence about the important state comparison
or highest-consuming state.

City:
One short sentence about the important city comparison
or highest-consuming city.

Branch:
One short sentence about the important branch comparison
or highest-consuming branch.

Floor:
One short sentence about the important floor comparison
when data is available.

AC Health:
One short sentence about the overall AC health condition.

Alerts:
One short sentence about the important alerts.

============================================================
OUTPUT STYLE
============================================================

Keep every section SHORT.

Prefer 8-15 words per sentence.

Do not use bullet points.

Do not use markdown tables.

Do not create additional sections.

Do not write long paragraphs.

Do not repeat the complete dashboard data.

Do not provide detailed recommendations.

Example:

KPI: Energy consumption is currently above the previous period.

Energy: West zone records the highest energy consumption.

Power: Power usage increased during the latest period.

Trend: Energy consumption shows an increasing trend.

Zone: West zone is currently the highest-consuming zone.

State: Maharashtra has the highest energy consumption.

City: Pune records the highest city-level consumption.

Branch: Branch A is the highest-consuming branch.

Floor: Floor 3 has the highest recorded consumption.

AC Health: Most ACs are healthy with few units requiring attention.

Alerts: No critical alerts are currently detected.

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

    # --------------------------------------------------------
    # Prepare dashboard context
    # --------------------------------------------------------

    context = prepare_dashboard_context(
        dashboard
    )

    dashboard_json = json.dumps(
        context,
        ensure_ascii=False,
        separators=(",", ":")
    )

    # --------------------------------------------------------
    # USER PROMPT
    # --------------------------------------------------------

    user_prompt = f"""

Analyze the following CURRENT LIVE AC DASHBOARD DATA.

The dashboard contains multiple graphs, charts and sections.

Give ONE SHORT insight for EACH section.

============================================================
CURRENT DASHBOARD DATA
============================================================

{dashboard_json}

============================================================
SECTIONS TO ANALYZE
============================================================

1. KPI
2. Energy
3. Power
4. Trend
5. Zone
6. State
7. City
8. Branch
9. Floor
10. AC Health
11. Alerts

============================================================
ANALYSIS RULES
============================================================

For each section:

- Give exactly ONE sentence.
- Use actual dashboard values when available.
- Identify the highest value when meaningful.
- Identify the lowest value when meaningful.
- Identify increases or decreases when available.
- Identify abnormal conditions when supported.
- Do not repeat unnecessary values.
- Do not invent missing information.

If there is no useful information for a section,
write:

No significant change detected.

============================================================
REQUIRED OUTPUT
============================================================

KPI: <one short sentence>

Energy: <one short sentence>

Power: <one short sentence>

Trend: <one short sentence>

Zone: <one short sentence>

State: <one short sentence>

City: <one short sentence>

Branch: <one short sentence>

Floor: <one short sentence>

AC Health: <one short sentence>

Alerts: <one short sentence>

============================================================
IMPORTANT
============================================================

Keep the complete response concise.

Maximum approximately 150 words.

Do not provide:
- detailed explanations
- recommendations
- tables
- bullet points
- additional sections
- reasoning

"""

    # --------------------------------------------------------
    # GROQ REQUEST
    # --------------------------------------------------------

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

        # Previously 5000.
        # Reduced because we want short graph insights.
        max_tokens=300,

        reasoning_effort="high",
    )

    # --------------------------------------------------------
    # GET RESPONSE
    # --------------------------------------------------------

    analysis = response.choices[0].message.content.strip()

    # --------------------------------------------------------
    # CLEAN RESPONSE
    # --------------------------------------------------------

    analysis = analysis.replace(
        "**",
        ""
    )

    analysis = analysis.replace(
        "###",
        ""
    )

    # Remove possible markdown bullets
    cleaned_lines = []

    for line in analysis.splitlines():

        line = line.strip()

        if not line:
            continue

        line = line.lstrip("-• ")

        cleaned_lines.append(
            line
        )

    analysis = "\n\n".join(
        cleaned_lines
    ).strip()

    # --------------------------------------------------------
    # EXPECTED SECTION LABELS
    # --------------------------------------------------------

    section_labels = [
        "KPI:",
        "Energy:",
        "Power:",
        "Trend:",
        "Zone:",
        "State:",
        "City:",
        "Branch:",
        "Floor:",
        "AC Health:",
        "Alerts:",
    ]

    # --------------------------------------------------------
    # KEEP ONLY EXPECTED SECTIONS
    # --------------------------------------------------------

    section_lines = []

    for line in analysis.splitlines():

        line = line.strip()

        if not line:
            continue

        if any(
            line.startswith(label)
            for label in section_labels
        ):
            section_lines.append(
                line
            )

    # --------------------------------------------------------
    # If Groq returned properly formatted sections,
    # use them.
    # Otherwise keep the AI response.
    # --------------------------------------------------------

    if section_lines:

        analysis = "\n\n".join(
            section_lines
        )

    # --------------------------------------------------------
    # FALLBACK
    # --------------------------------------------------------

    if not analysis:

        analysis = (
            "KPI: No significant change detected."
        )

    return analysis