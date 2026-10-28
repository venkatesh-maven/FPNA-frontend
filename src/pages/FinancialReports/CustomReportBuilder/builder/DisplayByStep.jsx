import React from "react";
import AppCard from "../../../../components/ui/AppCard";

export const DISPLAY_BY_OPTIONS = [
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "fiscal_year", label: "Fiscal Year" },
  { value: "calendar_year", label: "Calendar Year" },
  { value: "ytd", label: "Year to Date" },
  { value: "rolling_12", label: "Rolling 12 Months" },
];

// "How should time be presented?" — governs both the report's time window
// (financialCustomReportCompare.js's resolveComparisonWindows) and, when
// only the primary metric is selected (no drivers), whether the table
// pivots into one column per month (see CustomReportBuilder.jsx).
export default function DisplayByStep({ displayBy, onChange }) {
  return (
    <AppCard>
      <h3 className="text-md font-semibold text-sky-800 mb-1">3. Display By</h3>
      <p className="text-x text-slate-500 mb-3">How should time be presented?</p>
      <div className="flex flex-wrap gap-2">
        {DISPLAY_BY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              "px-3 py-1.5 rounded-full text-x font-medium border transition-colors",
              displayBy === opt.value
                ? "bg-sky-900 text-white border-sky-900"
                : "bg-white text-sky-800 border-sky-200 hover:bg-sky-50",
            ].join(" ")}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </AppCard>
  );
}
