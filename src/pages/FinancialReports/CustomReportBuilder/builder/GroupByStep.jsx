import React from "react";
import AppCard from "../../../../components/ui/AppCard";
import { FINANCIAL_CUSTOM_REPORT_FIELD_DEFS } from "../financialCustomReportFields";

// Month is offered as the Display By time axis (DisplayByStep.jsx), not as
// a Group By dimension — the redesigned builder keeps "how to slice the
// data" and "how to present time" as two separate questions instead of
// letting Month compete with Customer/Department/etc. as just another
// checkbox.
const GROUP_BY_FIELDS = FINANCIAL_CUSTOM_REPORT_FIELD_DEFS.filter(
  (f) => f.type === "dimension" && f.field !== "Month"
);

const MAX_LEVELS = 3;

// "How do I want to analyze the data?" — up to 3 dimensions, in the order
// they're picked, driving the report's row hierarchy (financialCustomReportAggregate.js's
// buildHierarchy). Click to add (numbered 1/2/3 = outermost to innermost
// grouping level), click again to remove.
export default function GroupByStep({ selectedDimensions, onToggle }) {
  const atMax = selectedDimensions.length >= MAX_LEVELS;

  return (
    <AppCard>
      <h3 className="text-md font-semibold text-sky-800 mb-1">1. Group By</h3>
      <p className="text-x text-slate-500 mb-3">How do you want to analyze the data?</p>
      <div className="flex flex-wrap gap-2">
        {GROUP_BY_FIELDS.map((f) => {
          const idx = selectedDimensions.indexOf(f.field);
          const selected = idx !== -1;
          const disabled = !selected && atMax;
          return (
            <button
              key={f.field}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(f.field)}
              className={[
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-x font-medium border transition-colors",
                selected
                  ? "bg-sky-900 text-white border-sky-900"
                  : disabled
                  ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed"
                  : "bg-white text-sky-800 border-sky-200 hover:bg-sky-50",
              ].join(" ")}
            >
              {selected ? <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center">{idx + 1}</span> : null}
              {f.label}
            </button>
          );
        })}
      </div>
      {selectedDimensions.length > 0 ? (
        <p className="text-x text-sky-600 mt-3">
          Grouping: {selectedDimensions.map((d) => GROUP_BY_FIELDS.find((f) => f.field === d)?.label || d).join(" → ")}
          {atMax ? ` (max ${MAX_LEVELS} levels)` : ""}
        </p>
      ) : (
        <p className="text-x text-slate-400 mt-3">Pick at least one field to group by.</p>
      )}
    </AppCard>
  );
}

export { GROUP_BY_FIELDS, MAX_LEVELS };
