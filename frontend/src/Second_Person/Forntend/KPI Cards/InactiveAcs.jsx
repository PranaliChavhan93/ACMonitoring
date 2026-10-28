// import React from "react";

// function Inactive_Acs({ value = 0 }) {
//   return (
//     <div className="kpi-card">
//       <div className="kpi-icon">🔴</div>

//       <div className="kpi-content">
//         <p>Active ACs</p>

//         <h2>{value}</h2>

//         <span>Currently Off</span>
//       </div>
//     </div>
//   );
// }

// export default Inactive_Acs;

import React from "react";

function Inactive_Acs({ value = 0 }) {
  const count = Math.max(0, Number(value) || 0);

  return (
    <div className="kpi-card">
      <div className="kpi-icon">🔴</div>

      <div className="kpi-content">
        <p>Inactive ACs</p>
        <h2>{count}</h2>
        <span>Currently Off</span>
      </div>
    </div>
  );
}

export default Inactive_Acs;
