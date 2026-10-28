
import React, { useMemo } from "react";

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
import { IndexZoomFrame } from "../shared/chartZoom";


function PowerConsumptionChart({ data = [] }) {

    const chartData = useMemo(() => {

        return data.map((item, index) => {

            const voltage = Number(
                item.voltage ??
                item.Voltage ??
                0
            );

            const current = Number(
                item.current ??
                item.Current ??
                0
            );


            const directPower =
                item.active_power ??
                item.Active_Power ??
                item.power ??
                item.Power;


            const power =
                directPower !== undefined &&
                directPower !== null
                    ? Number(directPower)
                    : voltage * current;


            return {

                name:
                    item.ac_id ??
                    item.unit_name ??
                    `AC ${index + 1}`,

                power:
                    Number(power.toFixed(2)),

            };

        });

    }, [data]);


    return (

        <div className="chart-box">

            <div className="chart-header">

                <div>

                    <h3>
                        ⚡ AC Power Consumption
                    </h3>

                    <span>
                        Current active power
                    </span>

                </div>

            </div>


            <IndexZoomFrame data={chartData}>
            {(visible, { chartProps, selection }) => (
            <ResponsiveContainer
                width="100%"
                height={280}
            >

                <BarChart
                    data={visible}
                    {...chartProps}
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
                    />

                    <Tooltip
                        formatter={(value) => [
                            `${Number(value).toFixed(2)} W`,
                            "Active Power",
                        ]}
                    />


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

                    <Bar
                        dataKey="power"
                        name="Active Power"
                        fill="#3182BD"
                        radius={[5, 5, 0, 0]}
                    />

                </BarChart>

            </ResponsiveContainer>
            )}
            </IndexZoomFrame>

        </div>

    );
}


export default PowerConsumptionChart;