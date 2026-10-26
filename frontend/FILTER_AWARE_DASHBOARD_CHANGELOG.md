# Filter-aware AC dashboard update

## What changed

Updated `src/Second_Person/Forntend/ACDashboard.jsx` and `src/Second_Person/Forntend/dashboard.css` so dashboard components change based on the active location/device filters.

- **Organization / regional filters:** group KPIs, regional energy comparisons, energy map, and group power comparison.
- **Branch filter:** branch KPIs, AC health, per-AC power comparison, branch temperature/humidity, and AC table.
- **Single AC/device filter:** individual energy history, current history, voltage history, temperature/humidity history, and selected-device telemetry details.
- Active power, average temperature, and average humidity KPIs are limited to branch and individual-device scopes.
- State-level energy cost appears only when a state is selected and an individual AC is not selected.
- Added a clear scope header and an AI Analysis toggle for branch/device scopes.
- Kept existing filter component, API/data flow, charts, and widget preference flags in place.

## Validation

All 65 JavaScript/JSX source files parsed successfully with the JSX parser. A full Vite production build was not run as part of this change.

## Install

Extract this source archive over your existing `frontend` source folder (or copy the changed files into the same paths). The archive excludes `node_modules`; keep your existing dependencies and `.env`/local configuration.
