/**
 * React integration helper.
 *
 * The dashboard should send the same values it already uses for:
 * KPI cards, charts, maps, tables, filters and alerts.
 */

export async function analyzeDashboard({
  analyzerUrl,
  dashboardName = "AC Energy Dashboard",
  filters = {},
  kpis = {},
  trends = [],
  zones = [],
  states = [],
  cities = [],
  branches = [],
  floors = [],
  acHealth = [],
  alerts = [],
  tables = [],
  additionalData = {}
}) {
  const response = await fetch(`${analyzerUrl}/api/analyze-dashboard`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      dashboard_name: dashboardName,
      generated_at: new Date().toISOString(),
      filters,
      kpis,
      trends,
      zones,
      states,
      cities,
      branches,
      floors,
      ac_health: acHealth,
      alerts,
      tables,
      additional_data: additionalData
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Dashboard AI error ${response.status}: ${errorText}`);
  }

  return response.json();
}

/*
Example:

const result = await analyzeDashboard({
  analyzerUrl: "http://192.168.1.8:9000",
  filters: {
    state: selectedState,
    city: selectedCity,
    branch: selectedBranch,
    floor: selectedFloor
  },
  kpis: {
    total_ac: totalACs,
    active_ac: activeACs,
    total_energy_kwh: totalEnergy,
    active_energy_kwh: activeEnergy
  },
  trends: energyTrendData,
  zones: zoneData,
  branches: branchData,
  alerts: alerts,
  acHealth: acHealth
});

setAiAnalysis(result.analysis);
*/
