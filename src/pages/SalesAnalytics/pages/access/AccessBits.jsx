import React, { useEffect, useState } from "react";
import { groupCapabilities } from "./accessHelpers";

const CHIP_TONES = {
  grant: "border-emerald-600 bg-emerald-600 text-white",
  deny: "border-red-600 bg-red-600 text-white",
  sky: "border-sky-800 bg-sky-800 text-white",
};

/** Toggle chip. */
export function Chip({ active, onClick, disabled, title, tone = "sky", children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={!!active}
      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
        active ? CHIP_TONES[tone] : "border-sky-200 bg-white text-sky-800 hover:bg-sky-50"
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

/** Capabilities as grouped toggle chips. `disabled(id)` returns a reason string to block a chip. */
export function CapabilityPicker({ label, hint, capabilities, value, onChange, tone, disabled }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <fieldset className="min-w-0">
      <legend className="text-xs font-semibold text-sky-900">{label}</legend>
      {hint ? <p className="text-[11px] text-sky-600">{hint}</p> : null}
      <div className="mt-1.5 space-y-1.5">
        {groupCapabilities(capabilities).map(({ group, items }) => (
          <div key={group} className="flex flex-wrap items-center gap-1.5">
            <span className="w-28 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-sky-500">{group}</span>
            {items.map((c) => {
              const reason = disabled?.(c.id);
              return (
                <Chip key={c.id} tone={tone} active={value.includes(c.id)} disabled={!!reason && !value.includes(c.id)} title={reason || c.id} onClick={() => toggle(c.id)}>
                  {c.label}
                </Chip>
              );
            })}
          </div>
        ))}
      </div>
    </fieldset>
  );
}

/** Two-step button for destructive actions: first click arms it, second confirms. */
export function ConfirmButton({ onConfirm, children, confirmLabel = "Confirm", className, disabled, title }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      className={armed ? "inline-flex items-center gap-1.5 rounded-md border border-red-600 bg-red-600 px-2.5 py-1 text-xs font-semibold text-white" : className}
      onClick={(e) => {
        e.stopPropagation();
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}

const STATUS = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  scheduled: "bg-amber-50 text-amber-700 border-amber-200",
  expired: "bg-slate-100 text-slate-500 border-slate-200",
};

export function StatusBadge({ status }) {
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS[status] || STATUS.expired}`}>{status}</span>;
}

export function Badge({ children, tone = "sky", title }) {
  const tones = {
    sky: "bg-sky-50 text-sky-700 border-sky-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-red-50 text-red-700 border-red-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    slate: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span title={title} className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Field({ label, children, className = "" }) {
  return (
    <label className={`flex flex-col gap-1 text-[11px] font-semibold text-sky-800 ${className}`}>
      {label}
      {children}
    </label>
  );
}
