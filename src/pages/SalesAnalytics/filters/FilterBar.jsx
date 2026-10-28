import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiFilter, FiRotateCcw, FiX } from "react-icons/fi";
import ActionHoverLabel from "../../FinancialReports/ActionHoverLabel";
import { COMPARE_BASES, PERIOD_PRESETS } from "../calc/periods";
import { DEFAULT_FILTERS, FILTER_FIELDS, FILTER_GROUPS, isActive } from "./filterSchema";
import { useSalesFilters } from "./SalesFiltersContext";

const selectClass = "border border-sky-200 rounded-md bg-white px-2 py-1.5 text-sm text-sky-900";
const toolBtn = "relative group flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition";

function MultiSelect({ field, options, value, onChange }) {
  const [q, setQ] = useState("");
  const list = (options || []).filter((o) => !q || o.name.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <fieldset className="min-w-0">
      <legend className="text-xs font-semibold text-sky-800 mb-1">{field.label}</legend>
      {(options || []).length > 8 ? (
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="mb-1 w-full border border-sky-200 rounded px-2 py-1 text-xs" />
      ) : null}
      <div className="max-h-40 overflow-auto rounded border border-sky-100 bg-white p-1 report-table-scroll">
        {list.map((o) => (
          <label key={o.id} className="flex items-center gap-2 px-1.5 py-1 text-xs text-sky-900 rounded hover:bg-sky-50 cursor-pointer">
            <input type="checkbox" checked={value.includes(o.id)} onChange={() => toggle(o.id)} className="accent-sky-700" />
            <span className="truncate">{o.name}</span>
          </label>
        ))}
        {!list.length ? <p className="text-xs text-sky-500 px-1.5 py-1">No matches</p> : null}
      </div>
    </fieldset>
  );
}

function SingleSelect({ field, options, value, onChange }) {
  return (
    <label className="block text-xs font-semibold text-sky-800">
      {field.label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`mt-1 w-full ${selectClass}`}>
        {field.key === "expectedStart" ? <option value="">Any month</option> : null}
        {(options || []).map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </label>
  );
}

/** Label for an active filter chip. */
function chipLabel(field, value, options) {
  const name = (id) => (options?.[field.options] || []).find((o) => o.id === id)?.name || id;
  if (field.type === "multi") {
    return `${field.label}: ${value.length > 2 ? `${name(value[0])} +${value.length - 1}` : value.map(name).join(", ")}`;
  }
  return `${field.label}: ${name(value)}`;
}

export default function FilterBar() {
  const { filters, setFilters, options } = useSalesFilters();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const [group, setGroup] = useState(FILTER_GROUPS[0].id);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) setDraft(filters);
  }, [filters, open]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const activeFields = FILTER_FIELDS.filter((f) => f.group !== "period" && isActive(filters, f.key));
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(filters), [draft, filters]);
  const groupFields = FILTER_FIELDS.filter((f) => f.group === group);
  const months = options?.periodMonths || [];

  const apply = () => {
    setFilters(draft);
    setOpen(false);
  };

  return (
    <div className="bg-white border-x border-b border-sky-200 rounded-b-xl px-3 py-2 space-y-2 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-sm text-sky-800">
          <span className="font-medium">Period</span>
          <select value={filters.period} onChange={(e) => setFilters({ ...filters, period: e.target.value })} className={selectClass}>
            {PERIOD_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
        {filters.period === "CUSTOM" ? (
          <>
            <select aria-label="From month" value={filters.from || ""} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className={selectClass}>
              <option value="">From…</option>
              {months.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <select aria-label="To month" value={filters.to || ""} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className={selectClass}>
              <option value="">To…</option>
              {months.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </>
        ) : null}
        <label className="flex items-center gap-1.5 text-sm text-sky-800">
          <span className="font-medium">Compare against</span>
          <select value={filters.compare} onChange={(e) => setFilters({ ...filters, compare: e.target.value })} className={selectClass}>
            {COMPARE_BASES.map((b) => (
              <option key={b.id} value={b.id}>{b.label}{b.id === "forecast" ? " (read-only)" : ""}</option>
            ))}
          </select>
        </label>

        <div className="relative ml-auto" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="dialog"
            aria-expanded={open}
            className={`${toolBtn} ${open && dirty ? "bg-amber-50 border-amber-300 text-amber-800" : "bg-sky-100 border-sky-200 text-sky-800 hover:bg-sky-200"}`}
          >
            <FiFilter size={14} /> More filters
            {activeFields.length ? <span className="ml-1 rounded-full bg-sky-800 text-white text-[10px] px-1.5">{activeFields.length}</span> : null}
          </button>
          <AnimatePresence>
            {open ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                role="dialog"
                aria-label="Filters"
                className="absolute right-0 mt-2 w-[min(760px,92vw)] bg-sky-50 border border-sky-200 rounded-xl shadow-lg z-50"
              >
                <div className="flex min-h-[260px]">
                  <nav className="w-36 shrink-0 border-r border-sky-200 p-2 space-y-0.5" aria-label="Filter groups">
                    {FILTER_GROUPS.map((g) => {
                      const n = FILTER_FIELDS.filter((f) => f.group === g.id && isActive(draft, f.key)).length;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setGroup(g.id)}
                          className={`w-full text-left px-2 py-1.5 rounded-md text-sm ${group === g.id ? "bg-white text-sky-900 font-semibold shadow-sm" : "text-sky-700 hover:bg-white/70"}`}
                        >
                          {g.label}
                          {n ? <span className="ml-1 text-[10px] text-sky-500">({n})</span> : null}
                        </button>
                      );
                    })}
                  </nav>
                  <div className="flex-1 p-3 grid gap-3 sm:grid-cols-2 content-start">
                    {groupFields.map((f) =>
                      f.type === "multi" ? (
                        <MultiSelect key={f.key} field={f} options={options?.[f.options]} value={draft[f.key]} onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} />
                      ) : (
                        <SingleSelect key={f.key} field={f} options={options?.[f.options]} value={draft[f.key]} onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} />
                      )
                    )}
                    {group === "scenario" ? (
                      <p className="text-xs text-sky-600 sm:col-span-2">
                        These dashboards always show actual results. Saved What-If scenarios and submitted sales forecasts live on the What-If & Forecast and Team Forecast tabs, so they are never mixed with actuals or with the official Finance forecast.
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="p-3 border-t border-sky-200 flex gap-2">
                  <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2 text-sm bg-white border border-sky-200 text-sky-900 rounded-lg hover:bg-sky-100">Cancel</button>
                  <button type="button" onClick={() => setDraft({ ...DEFAULT_FILTERS, period: draft.period, from: draft.from, to: draft.to, compare: draft.compare })} className="flex-1 py-2 text-sm bg-sky-200 text-sky-900 rounded-lg hover:bg-sky-300">Clear all</button>
                  <button type="button" onClick={apply} disabled={!dirty} className={`flex-1 py-2 text-sm rounded-lg font-semibold ${dirty ? "bg-sky-900 text-white hover:bg-sky-800" : "bg-slate-200 text-slate-500 cursor-not-allowed"}`}>Apply</button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
        <button
          type="button"
          onClick={() => setFilters(DEFAULT_FILTERS)}
          aria-label="Reset all filters"
          className={`${toolBtn} bg-white border-sky-200 text-sky-800 hover:bg-sky-100`}
        >
          <FiRotateCcw size={14} />
          <ActionHoverLabel>Reset filters</ActionHoverLabel>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {activeFields.length ? (
          activeFields.map((f) => (
            <span key={f.key} className="inline-flex items-center gap-1 rounded-full bg-sky-800 text-white text-xs px-2.5 py-1">
              {chipLabel(f, filters[f.key], options)}
              <button
                type="button"
                aria-label={`Remove ${f.label} filter`}
                onClick={() => setFilters({ ...filters, [f.key]: f.type === "multi" ? [] : f.default })}
                className="hover:text-sky-200"
              >
                <FiX size={12} />
              </button>
            </span>
          ))
        ) : (
          <span className="text-xs italic text-sky-600">No filters applied</span>
        )}
      </div>
    </div>
  );
}
