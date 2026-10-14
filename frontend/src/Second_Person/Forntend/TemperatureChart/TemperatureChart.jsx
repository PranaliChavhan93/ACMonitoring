import React, { useMemo } from "react";

import {
    ResponsiveContainer,
    LineChart,
    Line,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
} from "recharts";

function TemperatureChart({ data = [] }) {
    const chartData = useMemo(() => {
        return data.map((item, index) => {
            const timestamp =
                item.timestamp ??
                item.time ??
                item.created_at ??
                "";

            return {
                name:
                    timestamp
                        ? String(timestamp).slice(11, 16)
                        : item.ac_id ??
                          item.unit_name ??
                          `AC ${index + 1}`,

                indoor: Number(
                    item.indoor_temperature ??
                    item.indoor_temp ??
                    item.temperature ??
                    0
                ),

                outdoor: Number(
                    item.outdoor_temperature ??
                    item.outdoor_temp ??
                    0
                ),
            };
        });
    }, [data]);

    return (
        <div className="chart-box">
            <div className="chart-header">
                <div>
                    <h3>🌡 Temperature Monitoring </h3>
                    <span> Indoor vs Outdoor </span>
                </div>
            </div>

            <ResponsiveContainer
                width="100%"
                height={280}
            >
                <LineChart
                    data={chartData}
                    margin={{
                        top: 10,
                        right: 20,
                        left: 0,
                        bottom: 5,
                    }}
                >
                    <CartesianGrid
                        strokeDasharray="3 3"
                    />
                    <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                    />
                    <YAxis
                        tick={{ fontSize: 11 }}
                        ticks={[0, 25, 50, 75]}
                        domain={[0, 75]}
                    />
                    <Tooltip />
                    <Legend />
                    <Line
                        type="monotone"
                        dataKey="indoor"
                        stroke="#3182BD"
                        name="Indoor °C"
                        strokeWidth={3}
                        dot={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="outdoor"
                        name="Outdoor °C"
                        stroke="#94a3b8"
                        strokeWidth={2}
                        dot={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

export default TemperatureChart;
