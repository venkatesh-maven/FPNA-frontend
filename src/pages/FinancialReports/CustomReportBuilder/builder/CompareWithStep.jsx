import React from "react";
import AppCard from "../../../../components/ui/AppCard";
import { isBudgetComparisonAvailable, isForecastComparisonAvailable } from "../financialCustomReportCompare";

export const COMPARE_WITH_OPTIONS = [
  { value: "none", label: "No Comparison" },
  { value: "prior_period", label: "Prior Period" },
  { value: "prior_year", label: "Prior Year" },
  { value: "budget", label: "Budget" },
  { value: "forecast", label: "Forecast / Scenario" },
];

export const SCENARIO_OPTIONS = [
  { value: "baseline", label: "Baseline" },
  { value: "bestcase", label: "Best Case" },
  { value: "worstcase", label: "Worst Case" },
];

// "What should this be compared against?" — Budget is disabled (with an
// explanation) unless the Group By selection and primary metric fit what
// finance_budget_data actually supports (Entity/Department/CostCenter,
// Revenue/COGS/Operating Expense only). Forecast/Scenario is disabled
// unless the primary metric is Revenue (the only figure the forecast
// engine independently models) — see financialCustomReportCompare.js.
export default function CompareWithStep({
  compareWith,
  onChange,
  selectedDimensions,
  primaryMetric,
  scenario,
  onScenarioChange,
  availableScenarios,
}) {
  const budgetAvailable = isBudgetComparisonAvailable(selectedDimensions, primaryMetric);
  const forecastAvailable = isForecastComparisonAvailable(primaryMetric);
  const scenarioChoices = availableScenarios && availableScenarios.length > 0 ? availableScenarios : SCENARIO_OPTIONS;

  return (
    <AppCard>
      <h3 className="text-md font-semibold text-sky-800 mb-1">4. Compare With</h3>
      <p className="text-x text-slate-500 mb-3">What should this be compared against?</p>
      <div className="flex flex-wrap gap-2">
        {COMPARE_WITH_OPTIONS.map((opt) => {
          const disabled = (opt.value === "budget" && !budgetAvailable) || (opt.value === "forecast" && !forecastAvailable);
          const selected = compareWith === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              title={
                opt.value === "budget" && disabled
                  ? "Budget is only available when grouping by Entity, Department, and/or Cost Center, for Revenue, Cost of Goods Sold, or Operating Expense."
                  : opt.value === "forecast" && disabled
                  ? "Forecast/Scenario comparison is only available when the primary metric is Revenue — it's the only figure the forecast engine independently models."
                  : undefined
              }
              onClick={() => onChange(opt.value)}
              className={[
                "px-3 py-1.5 rounded-full text-x font-medium border transition-colors",
                selected
                  ? "bg-sky-900 text-white border-sky-900"
                  : disabled
                  ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed"
                  : "bg-white text-sky-800 border-sky-200 hover:bg-sky-50",
              ].join(" ")}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {!budgetAvailable ? (
        <p className="text-x text-slate-400 mt-3">
          Budget comparison needs a Group By of Entity/Department/Cost Center and a primary metric of Revenue, Cost of Goods Sold, or Operating Expense.
        </p>
      ) : null}
      {!forecastAvailable ? (
        <p className="text-x text-slate-400 mt-1">Forecast/Scenario comparison needs a primary metric of Revenue.</p>
      ) : null}

      {compareWith === "forecast" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-sky-50 border border-sky-100 p-3">
          <span className="text-x font-medium text-sky-700">Scenario:</span>
          {scenarioChoices.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => onScenarioChange(s.value)}
              className={[
                "px-3 py-1 rounded-full text-x font-medium border transition-colors",
                scenario === s.value ? "bg-sky-900 text-white border-sky-900" : "bg-white text-sky-800 border-sky-200 hover:bg-sky-50",
              ].join(" ")}
            >
              {s.label}
            </button>
          ))}
          <span className="text-x text-slate-400 ml-2">
            No Entity/Department breakdown — only shows at the report's Grand Total.
          </span>
        </div>
      ) : null}
    </AppCard>
  );
}
