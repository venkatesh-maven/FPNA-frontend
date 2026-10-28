import React from "react";

const changed = "border-amber-300 bg-amber-50 text-amber-950";
const plain = "border-sky-200 bg-white text-sky-900";

/**
 * Number field where empty means "use the baseline" (shown as the
 * placeholder). Changed values are highlighted so a scenario's edits stand out;
 * `neutral` is a stored value that still means "no change" (0 for a % change).
 */
export function NumInput({ value, onChange, placeholder, step = "any", min, max, width = "w-20", suffix, prefix, label, disabled, neutral }) {
  const isSet = value !== "" && value != null;
  const isChanged = isSet && value !== neutral;
  return (
    <span className="inline-flex items-center gap-1">
      {prefix ? <span className="text-[11px] text-slate-500">{prefix}</span> : null}
      <input
        type="number"
        inputMode="decimal"
        aria-label={label}
        disabled={disabled}
        value={isSet ? value : ""}
        placeholder={placeholder == null ? "" : String(placeholder)}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className={`${width} rounded border px-1.5 py-0.5 text-right text-xs tabular-nums disabled:opacity-50 ${isChanged ? changed : plain}`}
      />
      {suffix ? <span className="text-[11px] text-slate-500">{suffix}</span> : null}
    </span>
  );
}

export function DateInput({ value, onChange, min, max, label }) {
  return (
    <input
      type="date"
      aria-label={label}
      value={value || ""}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value || null)}
      className={`w-[118px] rounded border px-1 py-0.5 text-xs ${value ? changed : plain}`}
    />
  );
}

export function Check({ checked, onChange, label, children }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-sky-900">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} className="accent-sky-700" />
      {children}
    </label>
  );
}

/** A labelled control in a row of global assumptions. */
export function Field({ label, hint, children }) {
  return (
    <label className="flex min-w-[150px] flex-1 flex-col gap-1 rounded-md border border-sky-100 bg-sky-50/40 px-2.5 py-1.5">
      <span className="text-[11px] font-semibold text-sky-800">{label}</span>
      <span>{children}</span>
      {hint ? <span className="text-[10px] leading-snug text-slate-500">{hint}</span> : null}
    </label>
  );
}

/** Compact tab strip; `tabs` = [{ id, label, badge? }]. */
export function PanelTabs({ tabs, active, onChange, label }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-sky-100 pb-2" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium ${active === t.id ? "bg-sky-900 text-white" : "text-sky-800 hover:bg-sky-100"}`}
        >
          {t.label}
          {t.badge ? <span className={`ml-1.5 rounded-full px-1.5 text-[10px] ${active === t.id ? "bg-white/20" : "bg-amber-100 text-amber-800"}`}>{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Small scrollable table shell used by the assumption and impact panels. */
export function Grid({ head, children, maxHeight = "420px" }) {
  return (
    <div className="overflow-auto rounded-lg border border-sky-100 report-table-scroll" style={{ maxHeight }}>
      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10 bg-sky-900 text-white">
          <tr>
            {head.map((h, i) => (
              <th key={`${h}-${i}`} className={`whitespace-nowrap px-2 py-1.5 font-semibold ${i === 0 ? "text-left" : "text-right"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-sky-50">{children}</tbody>
      </table>
    </div>
  );
}

export const td = "whitespace-nowrap px-2 py-1 text-right tabular-nums text-sky-900";
export const tdLeft = "whitespace-nowrap px-2 py-1 text-left text-sky-900";
