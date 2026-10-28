import React, { useEffect, useState } from "react";
import { FiCheck, FiChevronDown, FiChevronUp, FiPlus, FiRefreshCw, FiX } from "react-icons/fi";
import { BsSignpostSplit } from "react-icons/bs";

const SYMBOLS = { USD: "$", INR: "Rs.", EUR: "€", GBP: "£" };

const METRIC_OPTIONS = [
  ["ebitda", "EBITDA"],
  ["operating_profit", "Operating profit"],
  ["gross_profit", "Gross profit"],
  ["ebitda_margin_pct", "EBITDA margin %"],
  ["operating_margin_pct", "Operating margin %"],
  ["gross_margin_pct", "Gross margin %"],
];

const SHOCK_OPTIONS = [
  ["revenue", "Revenue"],
  ["cogs", "Cost of goods sold"],
  ["opex", "All operating expense"],
  ["payroll", "Payroll"],
  ["marketing", "Marketing"],
  ["travel", "Travel"],
  ["rent", "Rent"],
  ["utilities", "Utilities"],
  ["insurance", "Insurance"],
  ["benefits", "Employee benefits"],
  ["headcount", "Salaries & payroll taxes"],
  ["other_opex", "Other operating expense"],
];
const SHOCK_LABEL = Object.fromEntries(SHOCK_OPTIONS);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthName = (p) => {
  const [y, m] = (p || "").split("-");
  return m ? `${MONTHS[Number(m) - 1]} ${y}` : p;
};

const makeMoney = (currency) => (v) => {
  if (v === null || v === undefined) return "—";
  const sym = SYMBOLS[currency] || `${currency} `;
  const a = Math.abs(v);
  const s =
    a >= 1e9 ? `${(a / 1e9).toFixed(2)}B` : a >= 1e6 ? `${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `${(a / 1e3).toFixed(1)}K` : a.toFixed(0);
  return `${v < 0 ? "-" : ""}${sym}${s}`;
};

const signedPct = (v) => `${v > 0 ? "+" : ""}${Number(v).toFixed(1)}%`;

/**
 * Result of a "Find a Way" request in Ask AI: the gap the assumptions create,
 * alternative paths through the controllable drivers (computed exactly on the
 * server), the AI's recommendation, and an editor to change the target,
 * assumptions and driver limits and recalculate. Also used for Find a Way on
 * a Scenario Modeling scenario, whose payload carries its own metric/shock
 * options and a baseline label.
 */
export default function FindAWayCard({ payload, onRecalculate, onSelectPath, busy }) {
  const { result, narrative, baseline, currency, warnings = [], options } = payload;
  const metricOptions = options?.metrics || METRIC_OPTIONS;
  const shockOptions = options?.shocks || SHOCK_OPTIONS;
  const shockLabel = options?.shocks ? Object.fromEntries(options.shocks) : SHOCK_LABEL;
  const money = makeMoney(currency);
  const fmtMetric = (v) => (result.metric_is_pct ? `${Number(v).toFixed(1)}%` : money(v));

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(payload.spec);
  const [showAssumptions, setShowAssumptions] = useState(false);

  useEffect(() => setDraft(payload.spec), [payload.spec]);

  const spec = payload.spec;
  const recommended = narrative?.recommended_path;
  const selected = payload.selected_path;
  const metricLabel = result.metric_label;

  const goalChips = [
    `${metricLabel} ${spec.target.mode === "maintain" ? "held at" : "of at least"} ${fmtMetric(result.target_value)}`,
    ...spec.shocks.map((s) => `${shockLabel[s.driver] || s.driver} ${signedPct(s.change_pct)}`),
    ...result.locked_levers.map((l) => `No change: ${l.label}`),
    ...Object.entries(spec.lever_limits || {}).map(([k, v]) => {
      const lv = result.levers.find((l) => l.key === k);
      return `${lv?.label || k} max ${v}%`;
    }),
  ];

  // Callers mutate a deep copy and return it.
  const updateDraft = (fn) => setDraft((d) => fn(JSON.parse(JSON.stringify(d))));
  const updateShock = (i, changes) =>
    updateDraft((d) => {
      d.shocks[i] = { ...d.shocks[i], ...changes };
      return d;
    });
  const removeShock = (i) =>
    updateDraft((d) => {
      d.shocks.splice(i, 1);
      return d;
    });
  const addShock = () =>
    updateDraft((d) => {
      d.shocks.push({ driver: "revenue", change_pct: -5 });
      return d;
    });

  const toggleLock = (key) =>
    updateDraft((d) => {
      d.locked_levers = d.locked_levers.includes(key)
        ? d.locked_levers.filter((k) => k !== key)
        : [...d.locked_levers, key];
      return d;
    });

  const setLimit = (key, value, defaultMax) =>
    updateDraft((d) => {
      const n = Number(value);
      if (value === "" || Number.isNaN(n) || n === defaultMax) delete d.lever_limits[key];
      else d.lever_limits[key] = Math.max(0, Math.min(100, n));
      return d;
    });

  const recalc = async () => {
    await onRecalculate(draft);
    setEditing(false);
  };

  return (
    <div className="@container w-full text-s text-gray-800 space-y-3">
      {/* Goal */}
      <div className="flex items-center gap-2 text-sky-900 font-semibold">
        <BsSignpostSplit /> Find a Way
      </div>
      <div className="flex flex-wrap gap-1.5">
        {goalChips.map((c) => (
          <span key={c} className="px-2 py-0.5 rounded-full text-x bg-white border border-sky-200 text-sky-800">
            {c}
          </span>
        ))}
      </div>
      <p className="text-x text-gray-500">
        Baseline:{" "}
        {baseline.label ||
          `FY${baseline.year} actuals ${monthName(baseline.first_period)}–${monthName(baseline.last_period)}${
            baseline.annualized ? `, annualized from ${baseline.months_of_actuals} months` : ""
          }`}
        {baseline.headcount ? ` · ${baseline.headcount} employees` : ""}
      </p>

      {/* Gap */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          ["Current", result.baseline_pnl[result.metric]],
          ["After assumptions", result.shocked_pnl[result.metric]],
          ["Target", result.target_value],
          ["Gap to close", result.already_met ? 0 : result.gap],
        ].map(([label, v]) => (
          <div key={label} className="bg-white border border-gray-200 rounded-lg px-3 py-2">
            <div className="text-x text-gray-500">{label}</div>
            <div className={`font-semibold ${label === "Gap to close" && v > 0 ? "text-red-700" : "text-sky-900"}`}>
              {fmtMetric(v)}
            </div>
          </div>
        ))}
      </div>

      {result.already_met && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-3 py-2">
          The target is met under these assumptions without any action.
        </div>
      )}

      {warnings.map((w) => (
        <div key={w} className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-1.5 text-x">
          {w}
        </div>
      ))}

      {narrative && (
        <div className="bg-white border border-sky-200 rounded-lg px-3 py-2 space-y-1.5">
          <p className="leading-relaxed">{narrative.summary}</p>
          {narrative.recommendation && (
            <p className="leading-relaxed">
              <span className="font-semibold text-sky-900">Recommendation: </span>
              {narrative.recommendation}
            </p>
          )}
        </div>
      )}

      {/* Paths: columns follow the card's own width (it sits in a capped chat
          bubble or modal), so all three paths sit side by side when they fit. */}
      {result.paths.length > 0 && (
        <div
          className={`grid gap-2 ${
            result.paths.length > 2 ? "@xl:grid-cols-2 @4xl:grid-cols-3" : result.paths.length > 1 ? "@xl:grid-cols-2" : ""
          }`}
        >
          {result.paths.map((p) => {
            const isSelected = selected === p.id;
            return (
              <div
                key={p.id}
                className={`bg-white rounded-lg border p-3 flex flex-col text-sm ${
                  isSelected ? "border-emerald-500 ring-1 ring-emerald-500" : recommended === p.id ? "border-sky-500" : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sky-900 flex items-center gap-1.5 flex-wrap">
                      {p.name}
                      {recommended === p.id && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-sky-600 text-white">Recommended</span>
                      )}
                    </div>
                    <div className="text-x text-gray-500">{p.description}</div>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      p.feasible ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}
                  >
                    {p.feasible ? "Reaches target" : `Short by ${fmtMetric(p.shortfall)}`}
                  </span>
                </div>

                <table className="w-full text-x mt-2">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-100">
                      <th className="text-left font-medium py-1">Driver</th>
                      <th className="text-right font-medium py-1 pl-2 whitespace-nowrap">Change</th>
                      <th className="text-right font-medium py-1 pl-2 whitespace-nowrap">Profit impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.moves.map((m) => (
                      <tr key={m.key} className="border-b border-gray-50 last:border-0" title={m.note || ""}>
                        <td className="py-1 pr-2">
                          {m.label}
                          {m.roles_equivalent ? <span className="text-gray-500"> (~{m.roles_equivalent} roles)</span> : null}
                          {m.at_limit && <span className="ml-1 text-[10px] text-amber-700">at limit</span>}
                        </td>
                        <td className="py-1 text-right whitespace-nowrap">{signedPct(m.change_pct)}</td>
                        <td className="py-1 text-right whitespace-nowrap text-green-700">+{money(m.profit_impact)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mt-2 text-x text-gray-600">
                  {metricLabel}: <span className="font-semibold text-sky-900">{fmtMetric(p.metric_value)}</span>
                  {" · "}Revenue {money(p.pnl.revenue)}
                  {p.reduces_headcount && <span className="text-red-700"> · reduces headcount</span>}
                </div>
                {narrative?.path_notes?.[p.id] && (
                  <p className="mt-1 text-x text-gray-600 italic leading-relaxed">{narrative.path_notes[p.id]}</p>
                )}

                <div className="mt-auto pt-2">
                  <button
                    onClick={() => onSelectPath(isSelected ? null : p.id)}
                    disabled={busy}
                    className={`w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-x font-medium disabled:opacity-50 ${
                      isSelected
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100"
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <FiCheck /> Selected path
                      </>
                    ) : (
                      "Select this path"
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Adjust */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setEditing((v) => !v)}
          className="flex items-center gap-1 text-x font-medium text-sky-700 hover:text-sky-900"
        >
          {editing ? <FiChevronUp /> : <FiChevronDown />} Adjust target, assumptions &amp; constraints
        </button>
        <button
          onClick={() => setShowAssumptions((v) => !v)}
          className="flex items-center gap-1 text-x text-gray-500 hover:text-gray-800"
        >
          {showAssumptions ? <FiChevronUp /> : <FiChevronDown />} How this is calculated
        </button>
      </div>

      {showAssumptions && (
        <ul className="list-disc pl-5 text-x text-gray-600 space-y-0.5">
          {result.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}

      {editing && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3 text-x">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-gray-500">Target</span>
              <select
                value={draft.target.metric}
                onChange={(e) => updateDraft((d) => ({ ...d, target: { ...d.target, metric: e.target.value } }))}
                className="border border-gray-200 rounded px-2 py-1"
              >
                {metricOptions.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-gray-500">Goal</span>
              <select
                value={draft.target.mode}
                onChange={(e) =>
                  updateDraft((d) => ({
                    ...d,
                    target: { ...d.target, mode: e.target.value, value: e.target.value === "maintain" ? null : d.target.value },
                  }))
                }
                className="border border-gray-200 rounded px-2 py-1"
              >
                <option value="maintain">Maintain current</option>
                <option value="absolute">Reach a value</option>
                <option value="change_pct">Change by %</option>
              </select>
            </label>
            {draft.target.mode !== "maintain" && (
              <label className="flex flex-col gap-0.5">
                <span className="text-gray-500">{draft.target.mode === "absolute" ? "Value" : "Change %"}</span>
                <input
                  type="number"
                  value={draft.target.value ?? ""}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      target: { ...d.target, value: e.target.value === "" ? null : Number(e.target.value) },
                    }))
                  }
                  className="w-36 border border-gray-200 rounded px-2 py-1"
                />
              </label>
            )}
          </div>

          <div>
            <div className="text-gray-500 mb-1">Assumptions (what happens to the business)</div>
            <div className="space-y-1">
              {draft.shocks.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={s.driver}
                    onChange={(e) => updateShock(i, { driver: e.target.value })}
                    className="border border-gray-200 rounded px-2 py-1"
                  >
                    {shockOptions.map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={s.change_pct}
                    onChange={(e) => updateShock(i, { change_pct: Number(e.target.value) })}
                    className="w-20 border border-gray-200 rounded px-2 py-1"
                  />
                  <span className="text-gray-500">%</span>
                  <button
                    onClick={() => removeShock(i)}
                    className="text-red-500 hover:text-red-700"
                    aria-label="Remove assumption"
                  >
                    <FiX />
                  </button>
                </div>
              ))}
              <button
                onClick={addShock}
                className="flex items-center gap-1 text-sky-700 hover:text-sky-900"
              >
                <FiPlus /> Add assumption
              </button>
            </div>
          </div>

          <div>
            <div className="text-gray-500 mb-1">Drivers the plan may use, and the most each can move</div>
            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
              {result.levers
                .filter((lv) => lv.available)
                .map((lv) => {
                  const allowed = !draft.locked_levers.includes(lv.key);
                  const max = draft.lever_limits?.[lv.key] ?? lv.default_max_pct;
                  return (
                    <div key={lv.key} className="flex items-center gap-2">
                      <input type="checkbox" checked={allowed} onChange={() => toggleLock(lv.key)} className="accent-sky-600" />
                      <span className={`flex-1 ${allowed ? "" : "text-gray-400 line-through"}`}>{lv.label}</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={max}
                        disabled={!allowed}
                        onChange={(e) => setLimit(lv.key, e.target.value, lv.default_max_pct)}
                        className="w-16 border border-gray-200 rounded px-1.5 py-0.5 text-right disabled:bg-gray-50"
                      />
                      <span className="text-gray-500">%</span>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={recalc}
              disabled={busy}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
            >
              <FiRefreshCw className={busy ? "animate-spin" : ""} /> Recalculate
            </button>
            <button
              onClick={() => {
                setDraft(payload.spec);
                setEditing(false);
              }}
              className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
