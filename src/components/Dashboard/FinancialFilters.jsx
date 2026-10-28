import React, { useEffect, useRef, useState } from "react";
import AppCard from "../ui/AppCard";
import AppSelect from "../ui/AppSelect";
import AppButton from "../ui/AppButton";

const COMPARISON_LABELS = {
  None: "None",
  ActualVsBudget: "Actual vs Budget",
  ActualVsForecast: "Actual vs Forecast",
};

const FinancialFilters = ({
  showFilters,

  currency,
  setCurrency,
  currencyFilter,
  setCurrencyFilter,
  timeFilter,
  setTimeFilter,

  comparison,
  setComparison,
  comparisonOptions = ["None", "ActualVsBudget", "ActualVsForecast"],

  entities = [],
  entity,
  setEntity,

  // ✅ IMPORTANT: onApply can accept overrides (draft)
  onApply,
}) => {
  const filtersRef = useRef(null);

  const [draft, setDraft] = useState({
    timeFilter: timeFilter || "monthly",
    currency: currency || "USD",
    currencyFilter: currencyFilter || "actualvalue",
    entity: entity || "",
    comparison: comparison || "None",
  });

  useEffect(() => {
    if (!showFilters) return;
    setDraft({
      timeFilter: timeFilter || "monthly",
      currency: currency || "USD",
      currencyFilter: currencyFilter || "actualvalue",
      entity: entity || "",
      comparison: comparison || "None",
    });
  }, [showFilters, timeFilter, currency, currencyFilter, entity, comparison]);

  if (!showFilters) return null;

  const applyNow = () => {
    // ✅ normalize values (never null)
    const next = {
      ...draft,
      comparison: draft.comparison || "None",
      entity: draft.entity || "",
      timeFilter: draft.timeFilter || "monthly",
      currency: draft.currency || "USD",
      currencyFilter: draft.currencyFilter || "actualvalue",
    };

    // 1) update state (UI chips etc.)
    setTimeFilter(next.timeFilter);
    setCurrency(next.currency);
    setCurrencyFilter(next.currencyFilter);
    setEntity(next.entity);
    setComparison(next.comparison);

    // 2) ✅ fetch immediately using fresh draft values
    onApply?.(next);
  };

  const resetNow = () => {
    const next = {
      timeFilter: "monthly",
      currency: "USD",
      currencyFilter: "actualvalue",
      entity: "",
      comparison: "None",
    };

    setDraft(next);

    setTimeFilter(next.timeFilter);
    setCurrency(next.currency);
    setCurrencyFilter(next.currencyFilter);
    setEntity(next.entity);
    setComparison(next.comparison);

    // ✅ fetch immediately with reset values
    onApply?.(next);
  };

  return (
    <AppCard ref={filtersRef} className="rounded-xl" hover={false} data-pdf-hide>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* time_filter */}
        <AppSelect
          label="Time Filter"
          value={draft.timeFilter}
          onChange={(e) => setDraft((p) => ({ ...p, timeFilter: e.target.value }))}
          options={[
            { value: "monthly", label: "Monthly" },
            { value: "quarterly", label: "Quarterly" },
            { value: "year_to_date", label: "Year to Date" },
          ]}
        />

        {/* currency_filter */}
        <AppSelect
          label="Currency Scale"
          value={draft.currencyFilter}
          onChange={(e) => setDraft((p) => ({ ...p, currencyFilter: e.target.value }))}
          options={[
            { value: "actualvalue", label: "Actual" },
            { value: "thousands", label: "Thousands" },
            { value: "millions", label: "Millions" },
          ]}
        />

        {/* comparison */}
        <AppSelect
          label="Comparison"
          value={draft.comparison}
          onChange={(e) =>
            setDraft((p) => ({
              ...p,
              comparison: e.target.value || "None",
            }))
          }
          options={comparisonOptions.map((value) => ({
            value,
            label: COMPARISON_LABELS[value] || value,
          }))}
        />

        {/* entity */}
        <AppSelect
          label="Entity"
          value={draft.entity}
          onChange={(e) => setDraft((p) => ({ ...p, entity: e.target.value }))}
          options={[
            { value: "", label: "All" },
            ...entities.map((x) => ({ value: x.entity_id, label: x.entity_name })),
          ]}
        />
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <AppButton type="button" onClick={resetNow} variant="outline">
          Reset
        </AppButton>

        <AppButton type="button" onClick={applyNow} variant="primary">
          Apply Filters
        </AppButton>
      </div>
    </AppCard>
  );
};

export default FinancialFilters;
