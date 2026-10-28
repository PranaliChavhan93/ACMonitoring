import React, { useCallback, useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import "./chart-zoom.css";

/**
 * Horizontal-only chart zoom for Recharts charts.
 * The chart's rendered width grows while its height stays unchanged, so the
 * X-axis gets more horizontal space and the Y-axis scale/range stays the same.
 * This wrapper does not change telemetry, APIs, filters, or source data.
 */
export default function ChartZoomWrapper({ children, label = "Chart" }) {
  const [scale, setScale] = useState(1);
  const viewportRef = useRef(null);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const updateScale = useCallback((factor) => {
    setScale((current) => {
      const next = Math.max(1, Math.min(4, Number((current * factor).toFixed(2))));
      return next;
    });
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1);
    if (viewportRef.current) viewportRef.current.scrollLeft = 0;
  }, []);

  const onWheel = useCallback((event) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    updateScale(event.deltaY < 0 ? 1.15 : 1 / 1.15);
  }, [updateScale]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const preventPageZoom = (event) => {
      if (event.ctrlKey || event.metaKey) event.preventDefault();
    };
    viewport.addEventListener("wheel", preventPageZoom, { passive: false });
    return () => viewport.removeEventListener("wheel", preventPageZoom);
  }, []);

  return (
    <div className="chart-zoom-shell" aria-label={`${label} chart zoom`}>
      <div className="chart-zoom-toolbar" role="group" aria-label={`${label} zoom controls`}>
        <button
          type="button"
          onClick={() => updateScale(1.25)}
          disabled={scale >= 4}
          title="Zoom in horizontally"
          aria-label={`Zoom in ${label} horizontally`}
        >
          <ZoomIn size={16} />
        </button>
        <button
          type="button"
          onClick={() => updateScale(1 / 1.25)}
          disabled={scale <= 1}
          title="Zoom out horizontally"
          aria-label={`Zoom out ${label} horizontally`}
        >
          <ZoomOut size={16} />
        </button>
        <button
          type="button"
          onClick={resetZoom}
          disabled={scale === 1}
          title="Reset zoom"
          aria-label={`Reset ${label} zoom`}
        >
          <RotateCcw size={15} />
        </button>
        <span>{Math.round(scale * 100)}%</span>
      </div>
      <div
        className="chart-zoom-viewport"
        ref={viewportRef}
        onWheel={onWheel}
        onDoubleClick={(event) => {
          if (event.target.closest?.("button")) return;
          resetZoom();
        }}
        title="Ctrl + mouse wheel to zoom horizontally; scroll horizontally to view more data; double-click to reset"
        data-chart-zoom-viewport
      >
        <div className="chart-zoom-content" style={{ width: `${scale * 100}%` }}>
          {children}
        </div>
      </div>
    </div>
  );
}
