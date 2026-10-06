
// import React, { useEffect, useMemo, useRef, useState } from "react";
// import {
//   ResponsiveContainer,
//   LineChart,
//   Line,
//   CartesianGrid,
//   XAxis,
//   YAxis,
//   Tooltip,
// } from "recharts";

// const DEFAULT_MAX_POINTS = 60;
// const DEFAULT_INTERVAL   = 2000;

// const formatTime = (date = new Date()) =>
//   `${String(date.getHours()).padStart(2, "0")}:${String(
//     date.getMinutes()
//   ).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;

// /* -----------------------------------------------------------
//    Extract a numeric value from whatever shape the API returns.
//    Add any key your device payload uses.  Search order matters:
//    the first key that is present and numeric wins.
// ----------------------------------------------------------- */
// const VALUE_KEYS = [
//   "active_power",
//   "activePower",
//   "power",
//   "watts",
//   "watt",
//   "W",
//   "w",
//   "current",
//   "ampere",
//   "amp",
//   "amps",
//   "value",
//   "reading",
// ];

// const pickNumber = (item, overrideKey) => {
//   if (item === null || item === undefined) return 0;

//   // Primitive number -> use it
//   if (typeof item === "number") return Number.isFinite(item) ? item : 0;

//   // Primitive numeric string -> parse
//   if (typeof item === "string") {
//     const n = Number(item);
//     return Number.isFinite(n) ? n : 0;
//   }

//   if (typeof item !== "object") return 0;

//   // Caller-specified key wins
//   if (overrideKey) {
//     const v = item[overrideKey];
//     const n = Number(v);
//     if (Number.isFinite(n)) return n;
//   }

//   for (const key of VALUE_KEYS) {
//     if (key in item) {
//       const n = Number(item[key]);
//       if (Number.isFinite(n)) return n;
//     }
//   }

//   return 0;
// };

// function CurrentFluctuationChart({
//   /* Live value from your KPI card / API poll */
//   value = 0,
//   /* Optional: name of the field in `value` when you pass an object */
//   valueKey,
//   /* Optional: array of historical samples to seed the buffer once */
//   data = null,
//   /* Sampling */
//   interval = DEFAULT_INTERVAL,
//   maxPoints = DEFAULT_MAX_POINTS,
//   /* Presentation */
//   unit = "W",                 // W for active power, A for current
//   lineColor = "#3182BD",
//   title = "⚡ Active Power",
//   seriesLabel = "Power",
//   yAxisLabel,                 // if omitted, defaults to `${seriesLabel} (${unit})`
//   height = 250,
// }) {
//   const [buffer, setBuffer] = useState([]);

//   /* Keep the latest live value in a ref so the timer sees it */
//   const liveRef      = useRef(0);
//   const seededRef    = useRef(false);

//   useEffect(() => {
//     liveRef.current = pickNumber(value, valueKey);
//   }, [value, valueKey]);

//   /* ---------------- One-time seed from `data` ---------------- */
//   useEffect(() => {
//     if (seededRef.current) return;
//     if (!Array.isArray(data) || data.length === 0) return;

//     const seeded = data.slice(-maxPoints).map((item, index) => {
//       const raw = item?.timestamp ?? item?.time ?? item?.date ?? item?.ts;
//       const label = raw
//         ? formatTime(new Date(raw))
//         : `T-${data.length - index}`;

//       return { name: label, value: pickNumber(item, valueKey) };
//     });

//     setBuffer(seeded);
//     seededRef.current = true;
//   }, [data, maxPoints, valueKey]);

//   /* ---------------- Live sampling on a timer ---------------- */
//   useEffect(() => {
//     if (!interval || interval <= 0) return undefined;

//     const id = setInterval(() => {
//       const next = pickNumber(liveRef.current, valueKey);

//       setBuffer((prev) => {
//         const appended = [...prev, { name: formatTime(), value: next }];
//         return appended.length > maxPoints
//           ? appended.slice(appended.length - maxPoints)
//           : appended;
//       });
//     }, interval);

//     return () => clearInterval(id);
//   }, [interval, maxPoints, valueKey]);

//   /* ---------------- Immediate push when value changes ---------------- */
//   /* Only runs when interval polling is turned off (interval <= 0). */
//   useEffect(() => {
//     if (interval && interval > 0) return;

//     const next = pickNumber(value, valueKey);
//     setBuffer((prev) => {
//       const appended = [...prev, { name: formatTime(), value: next }];
//       return appended.length > maxPoints
//         ? appended.slice(appended.length - maxPoints)
//         : appended;
//     });
//   }, [value, valueKey, interval, maxPoints]);

//   const isEmpty = buffer.length === 0;
//   const lastReading = isEmpty ? pickNumber(value, valueKey) : buffer[buffer.length - 1].value;

//   const yLabel = useMemo(
//     () => yAxisLabel || `${seriesLabel} (${unit})`,
//     [yAxisLabel, seriesLabel, unit]
//   );

//   return (
//     <div className="chart-box">
//       <div className="chart-header">
//         <h3>{title}</h3>

//         <span
//           style={{
//             fontSize: 13,
//             fontWeight: 600,
//             color: lineColor,
//             fontVariantNumeric: "tabular-nums",
//           }}
//         >
//           {Number(lastReading).toFixed(2)} {unit}
//         </span>
//       </div>

//       <ResponsiveContainer width="100%" height={height}>
//         <LineChart
//           data={buffer}
//           margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
//         >
//           <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

//           <XAxis
//             dataKey="name"
//             tick={{ fontSize: 11 }}
//             interval="preserveStartEnd"
//             minTickGap={24}
//           />

//           <YAxis
//             tick={{ fontSize: 11 }}
//             label={{
//               value: yLabel,
//               angle: -90,
//               position: "insideLeft",
//               fontSize: 11,
//             }}
//             domain={["auto", "auto"]}
//             width={56}
//           />

//           <Tooltip
//             formatter={(v) => [
//               `${Number(v).toFixed(2)} ${unit}`,
//               seriesLabel,
//             ]}
//             labelFormatter={(label) => `Time: ${label}`}
//           />

//           <Line
//             type="monotone"
//             dataKey="value"
//             name={seriesLabel}
//             stroke={lineColor}
//             strokeWidth={2.5}
//             dot={false}
//             activeDot={{ r: 4 }}
//             isAnimationActive={false}
//           />
//         </LineChart>
//       </ResponsiveContainer>

//       {isEmpty && (
//         <div
//           style={{
//             textAlign: "center",
//             fontSize: 12,
//             color: "#94a3b8",
//             marginTop: 6,
//           }}
//         >
//           Waiting for live readings…
//         </div>
//       )}
//     </div>
//   );
// }

// export default CurrentFluctuationChart;


import React, { useEffect, useRef, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

const DEFAULT_MAX_POINTS = 60;
const DEFAULT_INTERVAL = 2000;

/* -----------------------------------------------------------
   Format timestamp
----------------------------------------------------------- */
const formatTime = (date = new Date()) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;


/* -----------------------------------------------------------
   Convert ONLY the active power value to number.
   
   Important:
   This component does NOT fetch data.
   It receives the exact active power value from parent.
----------------------------------------------------------- */
const getActivePowerValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
};


/* -----------------------------------------------------------
   Current Fluctuation Chart
----------------------------------------------------------- */
function CurrentFluctuationChart({
  /*
   * IMPORTANT:
   * This must be the SAME active_power value
   * that is passed to Active_Power.jsx
   */
  value = 0,

  /*
   * How frequently the graph stores the current
   * active power value.
   *
   * Default = 2 seconds
   */
  interval = DEFAULT_INTERVAL,

  /*
   * Maximum number of points visible in graph.
   */
  maxPoints = DEFAULT_MAX_POINTS,

  /*
   * Presentation
   */
  unit = "W",

  lineColor = "#3182BD",

  title = "⚡ Active Power",

  seriesLabel = "Power",

  yAxisLabel = "Active Power (W)",

  height = 250,
}) {
  const [buffer, setBuffer] = useState([]);

  /*
   * Always keep the latest API value here.
   *
   * The timer will read this value every 2 seconds.
   */
  const liveValueRef = useRef(0);


  /* ---------------------------------------------------------
     Update latest live value whenever parent receives
     new active_power data
  --------------------------------------------------------- */
  useEffect(() => {
    liveValueRef.current = getActivePowerValue(value);
  }, [value]);


  /* ---------------------------------------------------------
     Live sampling
     
     Every 2 seconds:
       API value
          ↓
       liveValueRef
          ↓
       graph buffer
          ↓
       LineChart
  --------------------------------------------------------- */
  useEffect(() => {
    if (!interval || interval <= 0) {
      return undefined;
    }

    const id = setInterval(() => {
      const nextValue = getActivePowerValue(
        liveValueRef.current
      );

      setBuffer((previous) => {
        const nextData = [
          ...previous,
          {
            name: formatTime(),
            value: nextValue,
          },
        ];

        if (nextData.length > maxPoints) {
          return nextData.slice(
            nextData.length - maxPoints
          );
        }

        return nextData;
      });
    }, interval);

    return () => {
      clearInterval(id);
    };
  }, [interval, maxPoints]);


  /* ---------------------------------------------------------
     Current active power value
     
     IMPORTANT:
     We display the DIRECT API value here instead of
     buffer[buffer.length - 1].
     
     This guarantees that the number shown in this graph
     header is exactly the same value shown in Active_Power.
  --------------------------------------------------------- */
  const currentActivePower = getActivePowerValue(value);


  return (
    <div className="chart-box">

      {/* ----------------------------------------------------
          Header
      ---------------------------------------------------- */}
      <div className="chart-header">

        <h3>{title}</h3>

        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: lineColor,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {currentActivePower.toFixed(2)} {unit}
        </span>

      </div>


      {/* ----------------------------------------------------
          Graph
      ---------------------------------------------------- */}
      <ResponsiveContainer
        width="100%"
        height={height}
      >
        <LineChart
          data={buffer}
          margin={{
            top: 8,
            right: 16,
            bottom: 0,
            left: 0,
          }}
        >

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e5e7eb"
          />


          <XAxis
            dataKey="name"
            tick={{
              fontSize: 11,
            }}
            interval="preserveStartEnd"
            minTickGap={24}
          />


          <YAxis
            tick={{
              fontSize: 11,
            }}
            label={{
              value: yAxisLabel,
              angle: -90,
              position: "insideLeft",
              fontSize: 11,
            }}
            domain={["auto", "auto"]}
            width={56}
          />


          <Tooltip
            formatter={(value) => [
              `${Number(value).toFixed(2)} ${unit}`,
              seriesLabel,
            ]}
            labelFormatter={(label) =>
              `Time: ${label}`
            }
          />


          <Line
            type="monotone"
            dataKey="value"
            name={seriesLabel}
            stroke={lineColor}
            strokeWidth={2.5}
            dot={false}
            activeDot={{
              r: 4,
            }}
            isAnimationActive={false}
          />

        </LineChart>
      </ResponsiveContainer>


      {/* ----------------------------------------------------
          Waiting message
      ---------------------------------------------------- */}
      {buffer.length === 0 && (
        <div
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "#94a3b8",
            marginTop: 6,
          }}
        >
          Waiting for live readings…
        </div>
      )}

    </div>
  );
}

export default CurrentFluctuationChart;