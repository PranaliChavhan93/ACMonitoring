# AC Monitoring dashboard update

## What changed
- Added the project identity **AC Energy Monitoring** to the existing fixed top bar without changing the sidebar or profile area.
- Made the organization dashboard adapt its layout to the active geographical/zonal filter depth:
  - Country / all locations: organization KPIs, broad energy charts, regional energy map, top-consuming branches and snapshot.
  - Zone/state/district/taluka/circle/region/division: regional overview and regional comparison components.
  - City/branch/floor: branch overview, per-AC comparison and a device telemetry table.
- Added an estimated energy-cost card. The initial verified tariff configuration is for MSEDCL LT-II commercial (0–20 kW) for FY 2026–27, using ₹8.51/kWh energy charge + ₹1.60/kWh wheeling charge = ₹10.11/kWh variable charge. It deliberately excludes fixed/demand charges, duty, taxes, time-of-day adjustments and other bill items.
- Other states show “Rate not configured” instead of an invented rate. State tariffs depend on the actual distribution utility, consumer category, sanctioned load and applicable tariff order. Configure the matching official rate before using the estimate.
- Added a `cost_card` preference default so the cost card participates in existing dashboard preference saves.
- Preserved the existing Django endpoints, authentication headers, filter component, 2-second telemetry polling, AI module, trends navigation, and dashboard preference API.

## Files changed
- `src/Pages/Layout/Layout.jsx`
- `src/Pages/Layout/Layout.css`
- `src/Pages/Organization/Org_Dashboard.jsx`
- `src/Second_Person/Forntend/ACDashboard.jsx`
- `src/Second_Person/Forntend/dashboard.css`
- `src/Second_Person/Forntend/EnergyCostCard.jsx` (new)
- `src/Second_Person/Forntend/EnergyCostCard.css` (new)
- `src/Second_Person/Forntend/ACDeviceTable.jsx` (new)

## Validation
- JSX syntax parsed successfully for all modified/new React files.
- A full Vite production build could not be run in the supplied extracted environment because its existing `node_modules` is missing the Rolldown native binding. This is an environment/dependency issue, not a reported JSX syntax error. Run `npm install` in the frontend folder on your development machine, then `npm run build`.

## Important metric note
The cost card currently multiplies the dashboard's existing energy metric by the configured variable rate. If the `energy` telemetry field is a cumulative meter reading, the backend/dashboard should calculate a selected-period delta per device before this card is used for reporting. The existing energy metric was intentionally not rewritten in this UI-only update to avoid changing current calculations unexpectedly.
