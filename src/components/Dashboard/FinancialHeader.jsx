import React, { useContext } from "react";
import { FiFilter, FiDownload } from "react-icons/fi";
import { AuthContext } from "../../context/AuthContext";
import AppButton from "../ui/AppButton";
import AppChip from "../ui/AppChip";

const FinancialHeader = ({
  showFilters,
  setShowFilters,
  onManageWidgets,

  currency,
  setCurrency,
  currencyFilter,
  setCurrencyFilter,
  timeFilter,
  setTimeFilter,
  entity,
  setEntity,
  entities = [],
  onApply,

  comparison,
  setComparison,

  // PDF export of the dashboard; without it Export falls back to the print dialog.
  onExport,
  exporting = false,
}) => {
  const { selectedYear } = useContext(AuthContext);

  const entityLabel =
    entity ? (entities.find((x) => String(x.entity_id) === String(entity))?.entity_name || "Entity") : "";

  const currencyScaleLabel =
    currencyFilter === "actualvalue"
      ? "Actual"
      : currencyFilter === "thousands"
      ? "Thousands"
      : currencyFilter === "millions"
      ? "Millions"
      : "";

  const timeLabel =
    timeFilter === "monthly" ? "Monthly" : timeFilter === "quarterly" ? "Quarterly" : "Year to Date";

  const modeLabel =
    comparison === "ActualVsBudget"
      ? "Actual vs Budget"
      : comparison === "ActualVsForecast"
      ? "Actual vs Forecast"
      : "Actual Only";

  const chips = [
    { key: "time", label: `Time: ${timeLabel}`, onRemove: () => setTimeFilter("monthly") },
    { key: "scale", label: `Scale: ${currencyScaleLabel || "Actual"}`, onRemove: () => setCurrencyFilter("actualvalue") },
    entity ? { key: "entity", label: `Entity: ${entityLabel}`, onRemove: () => setEntity("") } : null,
    { key: "mode", label: `Mode: ${modeLabel}`, onRemove: () => setComparison("None") },
  ].filter(Boolean);

  const removeChip = (chip) => {
    chip.onRemove?.();
    onApply?.();
  };

  return (
    <div className="rounded-xl bg-gradient-to-r from-sky-950 via-sky-900 to-sky-700 p-4 shadow-md" data-pdf-keep>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-lg font-bold text-white">
            Financial Dashboard{selectedYear ? ` – FY ${selectedYear}` : ""}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {chips.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {chips.map((c) => (
                <AppChip key={c.key} label={c.label} onRemove={() => removeChip(c)} />
              ))}
            </div>
          )}
          <div className="flex space-x-2" data-pdf-hide>
            <AppButton type="button" variant="primary" onClick={() => setShowFilters(!showFilters)}>
              <FiFilter className="mr-1" />
              Filters
            </AppButton>

            <AppButton onClick={onManageWidgets} variant="primary">
              + Manage Widgets
            </AppButton>

            <AppButton
              onClick={() => (onExport ? onExport({ subtitle: chips.map((c) => c.label).join("  ·  ") }) : window.print())}
              variant="primary"
              disabled={exporting}
              title="Download the dashboard as a PDF"
            >
              <FiDownload className="mr-1" />
              <span>{exporting ? "Exporting…" : "Export"}</span>
            </AppButton>

            <AppButton onClick={onApply} variant="secondary" title="Refresh">
              Refresh
            </AppButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialHeader;
