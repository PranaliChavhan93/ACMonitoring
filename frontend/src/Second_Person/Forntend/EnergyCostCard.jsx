import React, { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import "./EnergyCostCard.css";

// Illustrative variable tariff for MSEDCL LT-II commercial consumers (FY 2026-27).
// Configure other states only after confirming the applicable DISCOM and category.
const STATE_TARIFFS = {
  maharashtra: {
    state: "Maharashtra",
    utility: "MSEDCL",
    category: "LT-II commercial · 0–20 kW",
    energyCharge: 8.51,
    wheelingCharge: 1.60,
    effectiveFrom: "1 Apr 2026",
    sourceLabel: "MSEDCL tariff",
    sourceUrl: "https://www.mahadiscom.in/en/consumer/tariff-details/",
  },
};

const numberValue = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
};

export default function EnergyCostCard({ stateName, energyKwh = 0 }) {
  const tariff = useMemo(() => {
    const key = String(stateName || "").trim().toLowerCase();
    return STATE_TARIFFS[key] || null;
  }, [stateName]);

  const energy = numberValue(energyKwh);
  const unitRate = tariff ? tariff.energyCharge + tariff.wheelingCharge : null;
  const estimatedCost = unitRate === null ? null : energy * unitRate;
  const money = (value) => value.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });

  return (
    <div
      className="kpi-card energy-cost-kpi"
      title={tariff
        ? `${tariff.utility} · ${tariff.category}. Includes energy and wheeling charges only. Excludes fixed/demand charges, duties, taxes and other adjustments.`
        : "A verified tariff is not configured for this state and consumer category."}
    >
      <div className="kpi-icon energy-cost-kpi__icon" aria-hidden="true">₹</div>
      <div className="kpi-content energy-cost-kpi__content">
        <p>Estimated Cost</p>
        <h2>{tariff ? `₹${money(estimatedCost)}` : "Rate unavailable"}</h2>
        <span>{tariff ? `₹${unitRate.toFixed(2)} / kWh` : (stateName ? "Tariff not configured" : "Select a state")}</span>
        {tariff && (
          <a
            className="energy-cost-kpi__source"
            href={tariff.sourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open official MSEDCL tariff details"
            onClick={(event) => event.stopPropagation()}
          >
            {tariff.state} tariff <ExternalLink size={10} />
          </a>
        )}
      </div>
    </div>
  );
}
