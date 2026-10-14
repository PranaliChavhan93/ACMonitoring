// import React, { useMemo } from "react";

// function ACTable({ data = [] }) {
//     const rows = useMemo(() => {
//         const branches = {};
//         data.forEach((item) => {
//             const branch = item.branch ?? item.branch_name ?? "Unknown";
//             const zone = item.zone ?? item.zone_name ?? "-";
//             const state = item.state ?? item.state_name ?? "-";
//             const energy = Number(
//                 item.energy_consumption ??
//                 item.energy ??
//                 item.kwh ??
//                 item.kWh ??
//                 0
//             );

//             if (!branches[branch]) {
//                 branches[branch] = {
//                     branch,
//                     zone,
//                     state,
//                     energy: 0,
//                 };
//             }
//             branches[branch].energy += energy;
//         });

//         return Object.values(branches)
//             .sort(
//                 (a, b) =>
//                     b.energy - a.energy
//             )
//             .slice(0, 5);
//     }, [data]);

//     const totalEnergy = rows.reduce(
//         (sum, row) =>
//             sum + row.energy,
//         0
//     );

//     return (
//         <div className="chart-box table-chart-box">
//             <div className="chart-header">
//                 <div>
//                     <h3> 📊 Top Energy Consuming Branches </h3>
//                     <span> Top 5 branches </span>
//                 </div>
//             </div>

//             {rows.length === 0 ? (
//                 <div className="chart-empty">
//                     No branch data available
//                 </div>
//             ) : (
//                 <div className="table-wrapper">
//                     <table className="ac-table">
//                         <thead>
//                             <tr>
//                                 <th> Rank </th>
//                                 <th> Zone </th>
//                                 <th> State </th>
//                                 <th> Circle </th>
//                                 <th> City </th>
//                                 <th> Branch </th>
//                                 {/* <th> Zone </th> */}
//                                 {/* <th> State </th> */}
//                                 <th> Energy (kWh)  </th>
//                                 <th> % of Total </th>
//                             </tr>
//                         </thead>

//                         <tbody>
//                             {rows.map((row, index) => {
//                                     const percentage = totalEnergy > 0
//                                         ? ( row.energy /  totalEnergy * 100 )
//                                         : 0 ;
//                                     return (
//                                         <tr key={`${row.branch}-${index}`} >
//                                             <td>{index + 1} </td>
//                                             <td> {row.zone} </td>
//                                             <td className="branch-name"> {row.state} </td>
//                                             <td> {row.circle} </td>
//                                             <td> {row.branch} </td>
//                                             {/* <td> {row.zone} </td> */}
//                                             <td> {row.floor} </td>
//                                             <td> {row.energy.toLocaleString( 
//                                                     undefined,
//                                                     { maximumFractionDigits: 2, }
//                                                 )}
//                                             </td>
//                                             <td>
//                                                 <div className="percentage-cell">
//                                                     <div className="percentage-bar">
//                                                         <span style={{
//                                                                 width: `${percentage}%`,
//                                                             }}
//                                                         />
//                                                     </div>
//                                                     <small> {percentage.toFixed( 1 )} % </small>
//                                                 </div>
//                                             </td>
//                                         </tr>
//                                     );
//                                 }
//                             )}
//                         </tbody>
//                     </table>
//                 </div>
//             )}
//         </div>
//     );
// }

// export default ACTable;



import React, { useMemo } from "react";

function ACTable({ data = [] }) {
    const rows = useMemo(() => {
        const branches = {};
        data.forEach((item) => {
            const zone =  item.zone_name 
                ?? item.zone 
                ?? "-" ;
            const state = item.state_name 
                ?? item.state 
                ?? "-" ;

            const circle = item.circle_name 
                ?? item.circle 
                ?? "-" ;

            const city = item.city_name 
                ?? item.city 
                ?? "-" ;

            const branch = item.branch_name 
                ?? item.branch 
                ?? "-" ;

            const floor = item.floor_name 
                ?? item.floor 
                ?? "-" ;

            const energy = Number( item.energy_consumption 
                ?? item.energy 
                ?? item.kwh 
                ?? item.kWh 
                ?? 0
            );

            if (!branches[branch]) {
                branches[branch] = {
                    branch,
                    zone,
                    state,
                    circle,
                    city,
                    floor,
                    energy: 0,
                };

            }

            branches[branch].energy += energy;
        });

        return Object.values(branches)
            .sort((a, b) => b.energy - a.energy)
            .slice(0, 5);

    }, [data]);

    const totalEnergy = rows.reduce(
        (sum, row) => sum + row.energy,
        0
    );


    return (
        <div className="chart-box table-chart-box">
            <div className="chart-header">
                <div>
                    <h3>📊 Top 5 Energy Consuming Branches </h3>
                    {/* <span> Top 5 branches </span> */}
                </div>
            </div>

            {rows.length === 0 ? (
                <div className="chart-empty">
                    No branch data available
                </div>
            ) : (
                <div className="table-wrapper">
                    <table className="ac-table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Zone</th>
                                <th>State</th>
                                <th>Circle</th>
                                <th>City</th>
                                <th>Branch</th>
                                <th>Floor</th>
                                <th>Energy (kWh)</th>
                                <th>% of Total</th>
                            </tr>
                        </thead>

                        <tbody>
                            {rows.map((row, index) => {
                                const percentage =
                                    totalEnergy > 0
                                        ? (row.energy / totalEnergy) * 100
                                        : 0;

                                return (
                                    <tr key={`${row.branch}-${index}`} >
                                        <td> {index + 1} </td>
                                        <td> {row.zone} </td>
                                        <td className="branch-name"> {row.state} </td>
                                        <td> {row.circle} </td>
                                        <td> {row.city}</td>
                                        <td> {row.branch} </td>
                                        <td> {row.floor} </td>
                                        <td> {row.energy.toLocaleString(
                                                undefined,
                                                { maximumFractionDigits: 2 }
                                            )}
                                        </td>
                                        <td>
                                            <div className="percentage-cell">
                                                <div className="percentage-bar">
                                                    <span style={{
                                                            width: `${Math.min( percentage, 100 )}%`
                                                        }}
                                                    />
                                                </div>
                                                <small> {percentage.toFixed(1)}% </small>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default ACTable;