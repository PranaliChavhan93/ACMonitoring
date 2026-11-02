// import React, { useMemo } from "react";
// import { IndexZoomFrame } from "../shared/chartZoom";
// import {
//     ResponsiveContainer,
//     BarChart,
//     Bar,
//     CartesianGrid,
//     XAxis,
//     YAxis,
//     Tooltip,
// } from "recharts";
// import { ZONE_STATES } from "../EnergyMap/mapConfig";

// const FIELD_ALIASES = {
//     zone: ["zone_name", "zone", "Zone", "Zone_Name"],
//     state: ["state_name", "state", "State", "State_Name"],
//     district: ["district_name", "district", "District", "District_Name"],
//     taluka: ["taluka_name", "taluka", "Taluka", "Taluka_Name"],
//     city: ["city_name", "city", "City", "City_Name"],
//     zone_circle: ["circle_name", "circle", "Circle", "Circle_Name"],
//     region: ["region_name", "region", "Region", "Region_Name"],
//     division: ["division_name", "division", "Division", "Division_Name"],
//     branch: ["branch_name", "branch", "Branch", "Branch_Name"],
//     floor: ["floor_name", "floor", "Floor", "Floor_Name"],
//     device: ["ac_id", "device_name", "device_id", "device", "selectedDeviceId"],
// };

// const normalize = (value) =>
//     String(value ?? "")
//         .trim()
//         .toLowerCase()
//         .replace(/&/g, "and")
//         .replace(/[.,]/g, "")
//         .replace(/\s+/g, " ");

// const getField = (item, keys) => {
//     for (const key of keys) {
//         const value = item?.[key];
//         if (value !== undefined && value !== null && String(value).trim() !== "") {
//             return value;
//         }
//     }
//     return "";
// };

// const getFilterValue = (filters, key) => {
//     const aliases = key === "device"
//         ? ["selectedDeviceId", "device_id", "device", "ac_id", "selectedAcId"]
//         : [key];
//     for (const alias of aliases) {
//         const value = filters?.[alias];
//         if (value !== undefined && value !== null && String(value).trim() !== "") {
//             return value;
//         }
//     }
//     return "";
// };

// const matchesSelectedFilters = (item, filters = {}) => {
//     const hierarchy = String(filters?.hierarchy || "GEOGRAPHICAL").toUpperCase();
//     const keys = hierarchy === "ZONAL"
//         ? ["zone", "circle", "region", "division", "branch", "floor", "device"]
//         : ["state", "district", "taluka", "city", "branch", "floor", "device"];

//     return keys.every((key) => {
//         const selectedValue = getFilterValue(filters, key);
//         if (!selectedValue) return true;

//         const aliases = key === "circle"
//             ? FIELD_ALIASES.zone_circle
//             : FIELD_ALIASES[key] || [];
//         const rowValue = getField(item, aliases);

//         // If the telemetry row does not carry hierarchy metadata, rely on
//         // the parent dashboard's already-filtered data rather than dropping it.
//         if (!rowValue) return true;
//         return normalize(rowValue) === normalize(selectedValue);
//     });
// };

// const getZone = (item) => {
//     const explicit = getField(item, FIELD_ALIASES.zone);
//     if (explicit) return explicit;

//     const state = normalize(getField(item, FIELD_ALIASES.state));
//     for (const [zone, states] of Object.entries(ZONE_STATES || {})) {
//         if ((states || []).some((name) => normalize(name) === state)) return zone;
//     }
//     return "";
// };

// const getEnergyKwh = (item) => {
//     const raw = getField(item, [
//         "energy_consumption",
//         "Energy_Consumption",
//         "energy",
//         "Energy",
//         "kwh",
//         "kWh",
//     ]);
//     const value = Number(raw);
//     return Number.isFinite(value) ? value / 1000 : 0;
// };

// const getDrillLevel = (filters = {}) => {
//     const zonal = String(filters?.hierarchy || "GEOGRAPHICAL").toUpperCase() === "ZONAL";

//     if (zonal) {
//         if (!filters.zone) return { key: "zone", getter: getZone, title: "Zone-wise Energy", subtitle: "Energy consumption across zones" };
//         if (!filters.circle) return { key: "circle", getter: (row) => getField(row, FIELD_ALIASES.zone_circle), title: "Circle-wise Energy", subtitle: `Within ${filters.zone}` };
//         if (!filters.region) return { key: "region", getter: (row) => getField(row, FIELD_ALIASES.region), title: "Region-wise Energy", subtitle: `Within ${filters.circle}` };
//         if (!filters.division) return { key: "division", getter: (row) => getField(row, FIELD_ALIASES.division), title: "Division-wise Energy", subtitle: `Within ${filters.region}` };
//         if (!filters.branch) return { key: "branch", getter: (row) => getField(row, FIELD_ALIASES.branch), title: "Branch-wise Energy", subtitle: `Within ${filters.division}` };
//         return {
//             key: "device",
//             getter: (row) => getField(row, FIELD_ALIASES.floor) || getField(row, FIELD_ALIASES.device) || "Unassigned",
//             title: "Floor / Device Energy",
//             subtitle: `Within ${filters.branch}`,
//         };
//     }

//     if (!filters.state) return { key: "zone", getter: getZone, title: "Zone-wise Energy", subtitle: "Energy consumption across zones" };
//     if (!filters.district) return { key: "district", getter: (row) => getField(row, FIELD_ALIASES.district), title: "District-wise Energy", subtitle: `Within ${filters.state}` };
//     if (!filters.taluka) return { key: "taluka", getter: (row) => getField(row, FIELD_ALIASES.taluka), title: "Taluka-wise Energy", subtitle: `Within ${filters.district}` };
//     if (!filters.city) {
//         return {
//             key: "city_or_branch",
//             getter: (row) => getField(row, FIELD_ALIASES.city) || getField(row, FIELD_ALIASES.branch),
//             title: "City / Branch-wise Energy",
//             subtitle: `Within ${filters.taluka}`,
//         };
//     }
//     if (!filters.branch) return { key: "branch", getter: (row) => getField(row, FIELD_ALIASES.branch), title: "Branch-wise Energy", subtitle: `Within ${filters.city}` };
//     return {
//         key: "device",
//         getter: (row) => getField(row, FIELD_ALIASES.floor) || getField(row, FIELD_ALIASES.device) || "Unassigned",
//         title: "Floor / Device Energy",
//         subtitle: `Within ${filters.branch}`,
//     };
// };

// function ZoneEnergyChart({ data = [], filters = {} }) {
//     const level = useMemo(() => getDrillLevel(filters), [filters]);

//     const chartData = useMemo(() => {
//         const groups = new Map();
//         const rows = (Array.isArray(data) ? data : []).filter((row) =>
//             matchesSelectedFilters(row, filters)
//         );

//         rows.forEach((row) => {
//             const rawName = level.getter(row);
//             const name = String(rawName || "Unassigned").trim();
//             groups.set(name, (groups.get(name) || 0) + getEnergyKwh(row));
//         });

//         return [...groups.entries()]
//             .map(([name, energy]) => ({ name, energy: Number(energy.toFixed(3)) }))
//             .sort((a, b) => b.energy - a.energy);
//     }, [data, filters, level]);

//     return (
//         <div className="chart-box">
//             <div className="chart-header">
//                 <div>
//                     <h3>{level.title}</h3>
//                     <span>{level.subtitle}</span>
//                 </div>
//             </div>
//             {chartData.length === 0 ? (
//                 <div className="chart-empty">No location or energy data available for the selected filters</div>
//             ) : (
//                 <IndexZoomFrame data={chartData} resetKey={`${level.title}-${JSON.stringify(filters)}`}>
//                     {(visible, { chartProps }) => (
//                         <ResponsiveContainer width="100%" height={280}>
//                             <BarChart
//                                 data={visible}
//                                 layout="vertical"
//                                 margin={{ top: 8, right: 18, left: 8, bottom: 8 }}
//                                 onMouseMove={chartProps.onMouseMove}
//                                 onMouseLeave={chartProps.onMouseLeave}
//                             >
//                                 <CartesianGrid strokeDasharray="3 3" />
//                                 <XAxis type="number" tick={{ fontSize: 10 }} />
//                                 <YAxis type="category" dataKey="name" width={105} tick={{ fontSize: 10 }} />
//                                 <Tooltip formatter={(value) => [`${Number(value).toFixed(3)} kWh`, "Energy"]} />
//                                 <Bar dataKey="energy" name="Energy" fill="#3182BD" radius={[0, 5, 5, 0]} barSize={30} />
//                             </BarChart>
//                         </ResponsiveContainer>
//                     )}
//                 </IndexZoomFrame>
//             )}
//         </div>
//     );
// }

// export default ZoneEnergyChart;


import React, { useMemo } from "react";
import { IndexZoomFrame } from "../shared/chartZoom";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    ReferenceArea,
} from "recharts";
import { ZONE_STATES } from "../EnergyMap/mapConfig";

const FIELD_ALIASES = {
    zone: ["zone_name", "zone", "Zone", "Zone_Name"],
    state: ["state_name", "state", "State", "State_Name"],
    district: ["district_name", "district", "District", "District_Name"],
    taluka: ["taluka_name", "taluka", "Taluka", "Taluka_Name"],
    city: ["city_name", "city", "City", "City_Name"],
    zone_circle: ["circle_name", "circle", "Circle", "Circle_Name"],
    region: ["region_name", "region", "Region", "Region_Name"],
    division: ["division_name", "division", "Division", "Division_Name"],
    branch: ["branch_name", "branch", "Branch", "Branch_Name"],
    floor: ["floor_name", "floor", "Floor", "Floor_Name"],
    device: ["ac_id", "device_name", "device_id", "device", "selectedDeviceId"],
};

const normalize = (value) =>
    String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[.,]/g, "")
        .replace(/\s+/g, " ");

const getField = (item, keys) => {
    for (const key of keys) {
        const value = item?.[key];
        if (value !== undefined && value !== null && String(value).trim() !== "") {
            return value;
        }
    }
    return "";
};

const getFilterValue = (filters, key) => {
    const aliases = key === "device"
        ? ["selectedDeviceId", "device_id", "device", "ac_id", "selectedAcId"]
        : [key];
    for (const alias of aliases) {
        const value = filters?.[alias];
        if (value !== undefined && value !== null && String(value).trim() !== "") {
            return value;
        }
    }
    return "";
};

const matchesSelectedFilters = (item, filters = {}) => {
    const hierarchy = String(filters?.hierarchy || "GEOGRAPHICAL").toUpperCase();
    const keys = hierarchy === "ZONAL"
        ? ["zone", "circle", "region", "division", "branch", "floor", "device"]
        : ["state", "district", "taluka", "city", "branch", "floor", "device"];

    return keys.every((key) => {
        const selectedValue = getFilterValue(filters, key);
        if (!selectedValue) return true;

        const aliases = key === "circle"
            ? FIELD_ALIASES.zone_circle
            : FIELD_ALIASES[key] || [];
        const rowValue = getField(item, aliases);

        if (!rowValue) return true;
        return normalize(rowValue) === normalize(selectedValue);
    });
};

const getZone = (item) => {
    const explicit = getField(item, FIELD_ALIASES.zone);
    if (explicit) return explicit;

    const state = normalize(getField(item, FIELD_ALIASES.state));
    for (const [zone, states] of Object.entries(ZONE_STATES || {})) {
        if ((states || []).some((name) => normalize(name) === state)) return zone;
    }
    return "";
};

const getEnergyKwh = (item) => {
    const raw = getField(item, [
        "energy_consumption",
        "Energy_Consumption",
        "energy",
        "Energy",
        "kwh",
        "kWh",
    ]);
    const value = Number(raw);
    return Number.isFinite(value) ? value / 1000 : 0;
};

const getDrillLevel = (filters = {}) => {
    const zonal = String(filters?.hierarchy || "GEOGRAPHICAL").toUpperCase() === "ZONAL";

    if (zonal) {
        if (!filters.zone) return { key: "zone", getter: getZone, title: "Zone-wise Energy", subtitle: "Energy consumption across zones" };
        if (!filters.circle) return { key: "circle", getter: (row) => getField(row, FIELD_ALIASES.zone_circle), title: "Circle-wise Energy", subtitle: `Within ${filters.zone}` };
        if (!filters.region) return { key: "region", getter: (row) => getField(row, FIELD_ALIASES.region), title: "Region-wise Energy", subtitle: `Within ${filters.circle}` };
        if (!filters.division) return { key: "division", getter: (row) => getField(row, FIELD_ALIASES.division), title: "Division-wise Energy", subtitle: `Within ${filters.region}` };
        if (!filters.branch) return { key: "branch", getter: (row) => getField(row, FIELD_ALIASES.branch), title: "Branch-wise Energy", subtitle: `Within ${filters.division}` };
        return {
            key: "device",
            getter: (row) => getField(row, FIELD_ALIASES.floor) || getField(row, FIELD_ALIASES.device) || "Unassigned",
            title: "Floor / Device Energy",
            subtitle: `Within ${filters.branch}`,
        };
    }

    if (!filters.state) return { key: "zone", getter: getZone, title: "Zone-wise Energy", subtitle: "Energy consumption across zones" };
    if (!filters.district) return { key: "district", getter: (row) => getField(row, FIELD_ALIASES.district), title: "District-wise Energy", subtitle: `Within ${filters.state}` };
    if (!filters.taluka) return { key: "taluka", getter: (row) => getField(row, FIELD_ALIASES.taluka), title: "Taluka-wise Energy", subtitle: `Within ${filters.district}` };
    if (!filters.city) {
        return {
            key: "city_or_branch",
            getter: (row) => getField(row, FIELD_ALIASES.city) || getField(row, FIELD_ALIASES.branch),
            title: "City / Branch-wise Energy",
            subtitle: `Within ${filters.taluka}`,
        };
    }
    if (!filters.branch) return { key: "branch", getter: (row) => getField(row, FIELD_ALIASES.branch), title: "Branch-wise Energy", subtitle: `Within ${filters.city}` };
    return {
        key: "device",
        getter: (row) => getField(row, FIELD_ALIASES.floor) || getField(row, FIELD_ALIASES.device) || "Unassigned",
        title: "Floor / Device Energy",
        subtitle: `Within ${filters.branch}`,
    };
};

function ZoneEnergyChart({ data = [], filters = {} }) {
    const level = useMemo(() => getDrillLevel(filters), [filters]);

    const chartData = useMemo(() => {
        const groups = new Map();
        const rows = (Array.isArray(data) ? data : []).filter((row) =>
            matchesSelectedFilters(row, filters)
        );

        rows.forEach((row) => {
            const rawName = level.getter(row);
            const name = String(rawName || "Unassigned").trim();
            groups.set(name, (groups.get(name) || 0) + getEnergyKwh(row));
        });

        return [...groups.entries()]
            .map(([name, energy]) => ({ name, energy: Number(energy.toFixed(3)) }))
            .sort((a, b) => b.energy - a.energy);
    }, [data, filters, level]);

    return (
        <div className="chart-box">
            <div className="chart-header">
                <div>
                    <h3>🌆{level.title}</h3>
                    <span>{level.subtitle}</span>
                </div>
            </div>
            {chartData.length === 0 ? (
                <div className="chart-empty">No location or energy data available for the selected filters</div>
            ) : (
                <IndexZoomFrame data={chartData} resetKey={`${level.title}-${JSON.stringify(filters)}`}>
                    {(visible, { chartProps, selection }) => (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart
                                data={visible}
                                layout="vertical"
                                margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                                {...chartProps}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" tick={{ fontSize: 10 }} />
                                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10 }} />
                                <Tooltip formatter={(value) => [`${Number(value).toFixed(3)} kWh`, "Energy"]} />
                                {selection && (
                                    <ReferenceArea
                                        x1={selection.x1}
                                        x2={selection.x2}
                                        fill="#2563eb"
                                        fillOpacity={0.12}
                                        stroke="#2563eb"
                                        strokeOpacity={0.35}
                                    />
                                )}
                                <Bar dataKey="energy" name="Energy" fill="#3182BD" radius={[0, 5, 5, 0]} barSize={30} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </IndexZoomFrame>
            )}
        </div>
    );
}

export default ZoneEnergyChart;