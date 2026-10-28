
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
} from "recharts";

const numberValue = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
};

// Pull the first present field out of a list of possible key names.
const getField = (item, keys) => {
    for (const key of keys) {
        const value = item?.[key];
        if (value !== undefined && value !== null && value !== "") {
            return value;
        }
    }
    return "";
};

const getZone = (item) => getField(item, ["zone_name", "zone", "Zone", "Zone_Name", "region"]);
const getState = (item) => getField(item, ["state_name", "state", "State", "State_Name"]);
const getCircle = (item) => getField(item, ["circle_name", "circle", "Circle", "Circle_Name"]);
const getCity = (item) => getField(item, ["city_name", "city", "City", "City_Name"]);
const getBranch = (item) => getField(item, ["branch_name", "branch", "Branch", "Branch_Name"]);
const getFloor = (item) => getField(item, ["floor_name", "floor", "Floor", "Floor_Name"]);

const getUnitName = (item, index) =>
    getField(item, ["ac_id", "AC_ID", "device_name", "device_id", "unit_name", "name"]) || `AC ${index + 1}`;

const getEnergy = (item) =>
    numberValue(
        item?.energy_consumption ??
        item?.Energy_Consumption ??
        item?.energy ??
        item?.Energy ??
        item?.kwh ??
        item?.kWh ??
        0
    );

    
const getDrillLevel = (filters = {}) => {
    if (!filters?.zone) {
        return { getter: getZone, title: "Zone-wise Energy", subtitle: "Energy consumption by zone" };
    }
    if (!filters?.state) {
        return {
            getter: getState,
            title: "State-wise Energy",
            subtitle: `Within ${filters.zone}`,
        };
    }
    if (!filters?.circle) {
        return {
            getter: getCircle,
            title: "Circle-wise Energy",
            subtitle: `Within ${filters.state}`,
        };
    }
    if (!filters?.city) {
        return {
            getter: getCity,
            title: "City-wise Energy",
            subtitle: `Within ${filters.circle}`,
        };
    }
    if (!filters?.branch) {
        return {
            getter: getBranch,
            title: "Branch-wise Energy",
            subtitle: `Within ${filters.city}`,
        };
    }
    // Branch is the last level we track explicitly - fall back to floor,
    // and if that's not available either, compare individual units.
    return {
        getter: getFloor,
        title: "Floor-wise Energy",
        subtitle: `Within ${filters.branch}`,
        fallbackToUnit: true,
    };
};

function ZoneEnergyChart({ data = [], filters = {} }) {
    const level = useMemo(() => getDrillLevel(filters), [filters]);

    const chartData = useMemo(() => {
        const groups = {};

        data.forEach((item, index) => {
            let name = level.getter(item);

            if (!name && level.fallbackToUnit) {
                name = getUnitName(item, index);
            }

            if (!name) name = "Unknown";

            groups[name] = (groups[name] || 0) + getEnergy(item);
        });

        return Object.entries(groups)
            .map(([name, energy]) => ({
                name,
                energy: Number(energy.toFixed(2)),
            }))
            .sort((a, b) => b.energy - a.energy);
    }, [data, level]);

    return (
        <div className="chart-box">
            <div className="chart-header">
                <div>
                    <h3>📊 {level.title}</h3>
                    <span>{level.subtitle}</span>
                </div>
            </div>

            {chartData.length === 0 ? (
                <div className="chart-empty">
                    No zone data available
                </div>
            ) : (
                <IndexZoomFrame data={chartData} resetKey={level.title}>
                {(visible, { chartProps }) => (
                <ResponsiveContainer
                    width="100%"
                    height={280}
                >
                    <BarChart
                        data={visible}
                        onMouseMove={chartProps.onMouseMove}
                        onMouseLeave={chartProps.onMouseLeave}
                        layout="vertical"
                        margin={{
                            top: 10,
                            right: 15,
                            left: 0,
                            bottom: 10,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                            type="number"
                            tick={{fontSize: 10}}
                            tickLine={false}
                            label={{
                                // value: "Energy (kWh)",
                                angle: -90,
                                position: "insideLeft",
                                fontSize: 11,
                            }}
                        />
                        


                        <YAxis
                            type="category"
                            dataKey="name"
                            width={75}
                            tick={{
                                fontSize: 10
                            }}
                            tickLine={false}
                        />


                        <Tooltip
                            formatter={(value) => [

                                `${Number(value).toFixed(2)} kWh`,

                                "Energy"

                            ]}
                        />


                        <Bar
                            dataKey="energy"
                            name="Energy"
                            fill="#3182BD"
                            radius={[ 0, 5, 5, 0 ]}
                            barSize={32}

                        />

                    </BarChart>

                </ResponsiveContainer>
                )}
                </IndexZoomFrame>

            )}

        </div>

    );

}


export default ZoneEnergyChart;