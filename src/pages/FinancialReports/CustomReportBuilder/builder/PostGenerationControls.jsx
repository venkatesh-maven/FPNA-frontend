import React from "react";

export const TOP_BOTTOM_OPTIONS = [
  { value: "none", label: "Top/Bottom: Off" },
  { value: "top5", label: "Top 5" },
  { value: "top10", label: "Top 10" },
  { value: "bottom5", label: "Bottom 5" },
  { value: "bottom10", label: "Bottom 10" },
];

const SELECT_CLASS =
  "rounded-lg border border-sky-200 bg-white px-2 py-1 text-x text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100";
const NUMBER_CLASS =
  "w-16 rounded-lg border border-sky-200 bg-white px-2 py-1 text-x text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100";

// Post-generation report controls (redesign spec section 7): Top/Bottom,
// % of Total, Exceptions, Sort (already on the table's column headers),
// Subtotals (already free from the hierarchy), Conditional Formatting.
// Filters are the existing Filters popover elsewhere on the page.
export default function PostGenerationControls({
  topBottom,
  onTopBottomChange,
  showPercentOfTotal,
  onTogglePercentOfTotal,
  exceptionsEnabled,
  onToggleExceptions,
  exceptionsThreshold,
  onExceptionsThresholdChange,
  hasCompare,
  conditionalFormattingEnabled,
  onToggleConditionalFormatting,
  cfDirection,
  onCfDirectionChange,
  cfThreshold,
  onCfThresholdChange,
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-1 text-x">
      <select value={topBottom} onChange={(e) => onTopBottomChange(e.target.value)} className={SELECT_CLASS}>
        {TOP_BOTTOM_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-1.5 text-slate-700">
        <input type="checkbox" checked={showPercentOfTotal} onChange={(e) => onTogglePercentOfTotal(e.target.checked)} />
        % of Total
      </label>

      <label
        className={`flex items-center gap-1.5 ${hasCompare ? "text-slate-700" : "text-slate-300"}`}
        title={hasCompare ? undefined : "Exceptions need a Compare With selection"}
      >
        <input
          type="checkbox"
          checked={exceptionsEnabled}
          disabled={!hasCompare}
          onChange={(e) => onToggleExceptions(e.target.checked)}
        />
        Exceptions: variance over
        <input
          type="number"
          min={0}
          disabled={!hasCompare}
          value={exceptionsThreshold}
          onChange={(e) => onExceptionsThresholdChange(Number(e.target.value))}
          className={NUMBER_CLASS}
        />
        %
      </label>

      <label className="flex items-center gap-1.5 text-slate-700">
        <input type="checkbox" checked={conditionalFormattingEnabled} onChange={(e) => onToggleConditionalFormatting(e.target.checked)} />
        Highlight values
        <select value={cfDirection} onChange={(e) => onCfDirectionChange(e.target.value)} className={SELECT_CLASS} disabled={!conditionalFormattingEnabled}>
          <option value="above">above</option>
          <option value="below">below</option>
        </select>
        <input
          type="number"
          disabled={!conditionalFormattingEnabled}
          value={cfThreshold}
          onChange={(e) => onCfThresholdChange(Number(e.target.value))}
          className={NUMBER_CLASS}
        />
      </label>
    </div>
  );
}
