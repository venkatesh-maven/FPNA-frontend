import React from "react";

const PILL = "text-[11px] bg-white/10 px-2.5 py-0.5 rounded-full border border-white/15";

// Shared look for the report "View More" pages, matching the P&L detail view:
// one compact header row, a slim filter bar, and selects that carry their
// label in the option text ("Entity: All") instead of a label row above.
export const VIEW_MORE_FILTER_BAR =
  "bg-white rounded-xl px-3 py-2 border border-sky-100 shadow-sm flex flex-wrap items-center justify-between gap-2";
export const VIEW_MORE_SELECT =
  "px-2 py-1.5 text-x border border-sky-200 text-sky-900 rounded-lg font-semibold focus:outline-none";
// Icon-only action button on the dark header (pair with ActionHoverLabel).
export const VIEW_MORE_HEADER_BUTTON =
  "relative group flex items-center bg-white text-sky-900 px-3 py-2.5 rounded-lg text-x hover:bg-sky-100 transition";

/** Title + Year / Currency pills, with the page's action buttons (children) on the right. */
export default function ViewMoreHeader({ title, year, currency, children }) {
  return (
    <div className="bg-gradient-to-r from-sky-900 to-sky-700 text-white px-4 py-2.5 rounded-xl shadow flex justify-between items-center flex-wrap gap-3">
      <div className="flex items-center flex-wrap gap-3">
        <h1 className="text-lg font-bold">{title}</h1>
        {year != null && year !== "" && <span className={PILL}>Year: {year}</span>}
        {currency && <span className={PILL}>Currency: {currency}</span>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

/** A filter select whose label is part of each option ("Period: All Periods"). */
export function ViewMoreSelect({ label, value, onChange, options, className = "" }) {
  const current = value ?? "";
  // Options load after the page (e.g. entities): show the current value
  // rather than a blank box with no label.
  const matched = options.some((o) => String(o.value) === String(current));
  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      title={label}
      className={`${VIEW_MORE_SELECT} ${className}`}
    >
      {!matched && (
        <option value={current}>
          {label}: {current === "" || current === "All" ? "All" : String(current)}
        </option>
      )}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {label}: {o.label}
        </option>
      ))}
    </select>
  );
}
