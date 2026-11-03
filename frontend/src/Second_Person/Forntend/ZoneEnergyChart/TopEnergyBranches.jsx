import React, { useMemo } from "react";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
} from "recharts";

const normalize = (value) =>
    String(value ?? "").trim().toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ");

const getField = (item, keys) => {
    for (const key of keys) {
        const value = item?.[key];
        if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return "";
};

const getFilterValue = (filters, key) => {
    const aliases = key === "device"
        ? ["selectedDeviceId", "device_id", "device", "ac_id", "selectedAcId"]
        : [key];
    for (const alias of aliases) {
        const value = filters?.[alias];
        if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return "";
};

const matchesSelectedFilters = (item, filters = {}) => {
    const hierarchy = String(filters?.hierarchy || "GEOGRAPHICAL").toUpperCase();
    const keys = hierarchy === "ZONAL"
        ? ["zone", "circle", "region", "division", "branch", "floor", "device"]
        : ["state", "district", "taluka", "city", "branch", "floor", "device"];

    const aliases = {
        zone: ["zone_name", "zone", "Zone", "Zone_Name"],
        state: ["state_name", "state", "State", "State_Name"],
        district: ["district_name", "district", "District"],
        taluka: ["taluka_name", "taluka", "Taluka"],
        city: ["city_name", "city", "City"],
        circle: ["circle_name", "circle", "Circle"],
        region: ["region_name", "region", "Region"],
        division: ["division_name", "division", "Division"],
        branch: ["branch_name", "branch", "Branch"],
        floor: ["floor_name", "floor", "Floor"],
        device: ["ac_id", "device_name", "device_id", "device"],
    };

    return keys.every((key) => {
        const selected = getFilterValue(filters, key);
        if (!selected) return true;
        const rowValue = getField(item, aliases[key] || []);
        // Rows without hierarchy fields are retained because the dashboard
        // may already have scoped the telemetry response upstream.
        return !rowValue || normalize(rowValue) === normalize(selected);
    });
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

const getBranchName = (item) =>
    getField(item, ["branch_name", "branch", "Branch", "Branch_Name"]);

export default function TopEnergyBranches({ data = [], filters = {} }) {
    const chartData = useMemo(() => {
        const totals = new Map();
        const rows = (Array.isArray(data) ? data : []).filter((row) =>
            matchesSelectedFilters(row, filters)
        );

        rows.forEach((row) => {
            const branch = String(getBranchName(row) || "").trim();
            if (!branch) return;
            totals.set(branch, (totals.get(branch) || 0) + getEnergyKwh(row));
        });

        return [...totals.entries()]
            .map(([name, energy]) => ({ name, energy: Number(energy.toFixed(3)) }))
            .sort((a, b) => b.energy - a.energy)
            .slice(0, 5);
    }, [data, filters]);

    const hierarchyLabel =
        String(filters?.hierarchy || "GEOGRAPHICAL").toUpperCase() === "ZONAL"
            ? "within the selected zonal scope"
            : "within the selected geographical scope";

    return (
        <div className="chart-box top-energy-branches">
            <div className="chart-header">
                <div>
                    <h3>📊Top 5 Energy-Consuming Branches</h3>
                    <span>Ranked by total energy consumption {hierarchyLabel}</span>
                </div>
            </div>
            {!chartData.length ? (
                <div className="chart-empty">No branch energy data available for the selected filters</div>
            ) : (
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 8, right: 10, left: 0, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                            type="number" 
                            tick={{ fontSize: 10 }} 
                        />
                        <YAxis 
                            type="category" 
                            dataKey="name" 
                            width={80} 
                            tick={{ fontSize: 10 }} 
                        />
                        <Tooltip formatter={(value) => [`${Number(value).toFixed(3)} kWh`, "Energy"]} />
                        <Bar dataKey="energy" name="Energy" fill="#3182BD" radius={[0, 5, 5, 0]} barSize={28} />
                    </BarChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}
