// One place for the look of every chart -- these are the values CurrentTemp.jsx uses.
// Change a value here and every chart that imports it follows.
export const CHART_THEME = {
  height: 320,
  expandedHeight: 600,
  margin: { top: 10, right: 20, left: 10, bottom: 5 },
  gridDash: "3 3",
  xTick: { fontSize: 10 },
  yTick: { fontSize: 11 },
  line: { type: "linear", strokeWidth: 2, dot: false, isAnimationActive: false },
  primary: "#2563eb",   // blue, same as the Current line
  secondary: "#f97316", // orange, same as the Temperature line
};

// Y axis whose ticks, axis line and label take the colour of the series it belongs to.
export const yAxisStyle = (color = CHART_THEME.primary) => ({
  tick: { fontSize: CHART_THEME.yTick.fontSize, fill: color },
  axisLine: { stroke: color },
  tickLine: { stroke: color },
});

export const yAxisLabel = (value, color = CHART_THEME.primary, angle = -90, position = "insideLeft") => ({
  value,
  angle,
  position,
  style: { textAnchor: "middle", fontSize: 11, fill: color },
});
