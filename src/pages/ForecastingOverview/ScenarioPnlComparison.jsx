import React, { useEffect, useState } from "react";
import { FiArrowLeft, FiDownload } from "react-icons/fi";
import { compareScenarioPnl } from "../../utils/fpnaAssistant";

const SYMBOLS = { USD: "$", INR: "Rs.", EUR: "€", GBP: "£" };

// [key, label, kind]: "income" lines are better higher, "cost" lines lower.
const LINES = [
  ["revenue", "Revenue", "income"],
  ["payroll", "Payroll", "cost"],
  ["non_people_costs", "Non-people costs", "cost"],
  ["capex", "CAPEX", "cost"],
  ["interest", "Interest", "cost"],
  ["other_costs", "Other costs", "cost"],
  ["cost", "Total cost", "cost"],
  ["net_profit", "Net profit", "income"],
  ["profit_margin_pct", "Profit margin", "pct"],
];
const TOTALS = new Set(["cost", "net_profit"]);

const shiftQuarter = (year, quarter, back) => {
  const idx = Number(quarter[1]) - 1 - back;
  return `Q${(((idx % 4) + 4) % 4) + 1} ${year + Math.floor(idx / 4)}`;
};

/**
 * Profit & loss statement for a Find a Way path next to a comparison basis —
 * the previous quarter's actuals by default, or the same scenario's previous
 * quarter, the same quarter last year, or this scenario before the path.
 */
export default function ScenarioPnlComparison({ payload, pathId, onPathChange, scenario, scenarioRef, year, quarter, token, onBack }) {
  const { result, currency } = payload;
  const [basis, setBasis] = useState("prev_quarter_actuals");
  // basis -> { data } | { error }; a late response just fills its own entry.
  const [results, setResults] = useState({});

  const path = result.paths.find((p) => p.id === pathId) || result.paths[0];
  const prevQuarter = shiftQuarter(year, quarter, 1);
  const bases = [
    ["prev_quarter_actuals", `Previous quarter (${prevQuarter}) · actuals`],
    ["prev_quarter_scenario", `Previous quarter (${prevQuarter}) · ${scenario.scenario_name}`],
    ["last_year_actuals", `Same quarter last year (${shiftQuarter(year, quarter, 4)}) · actuals`],
    ["scenario_current", `This quarter (${quarter} ${year}) · ${scenario.scenario_name} before Find a Way`],
  ];

  const local = basis === "scenario_current";
  const entry = results[basis];
  const loading = !local && !entry;
  const error = entry?.error;
  const comparison = local
    ? { label: `${scenario.scenario_name} before Find a Way`, period: `${quarter} ${year}`, available: true, pnl: result.baseline_pnl, notes: [] }
    : entry?.data;

  useEffect(() => {
    if (local || results[basis]) return;
    compareScenarioPnl(scenarioRef, basis, token)
      .then((data) => setResults((p) => ({ ...p, [basis]: { data } })))
      .catch((e) => setResults((p) => ({ ...p, [basis]: { error: e.message || "Could not load the comparison." } })));
    // Only a change of basis should trigger a load; the rest is read as-is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basis]);

  const sym = SYMBOLS[currency] || `${currency} `;
  const money = (v) => (v == null ? "—" : `${v < 0 ? "-" : ""}${sym}${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`);
  const fmt = (kind, v) => (kind === "pct" ? (v == null ? "—" : `${Number(v).toFixed(2)}%`) : money(v));

  const base = comparison?.available ? comparison.pnl : null;
  const rows = LINES.filter(([key]) => key !== "other_costs" || path.pnl.other_costs || base?.other_costs).map(([key, label, kind]) => {
    const value = path.pnl[key];
    const prior = base ? base[key] : null;
    const change = prior == null ? null : value - prior;
    const changePct = kind === "pct" || prior == null || !prior ? null : (change / Math.abs(prior)) * 100;
    const better = change == null || Math.abs(change) < 0.005 ? null : kind === "cost" ? change < 0 : change > 0;
    return { key, label, kind, value, prior, change, changePct, better };
  });

  const exportCsv = () => {
    const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const header = ["Line", `${path.name} path (${quarter} ${year})`, `${comparison.label} (${comparison.period})`, "Change", "Change %"];
    const lines = rows.map((r) =>
      [
        r.label,
        r.value?.toFixed(2),
        r.prior == null ? "" : r.prior.toFixed(2),
        r.change == null ? "" : r.change.toFixed(2),
        r.changePct == null ? "" : r.changePct.toFixed(2),
      ].map(esc).join(",")
    );
    const blob = new Blob([[header.map(esc).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pnl-${scenario.scenario_name}-${path.name}-vs-${basis}.csv`.replace(/[^\w.-]+/g, "-");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1 text-x font-semibold text-sky-700 hover:text-sky-900">
          <FiArrowLeft /> Back to paths
        </button>
        <button
          onClick={exportCsv}
          disabled={!base}
          className="flex items-center gap-1 px-3 py-1 rounded-lg border border-slate-300 text-x font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <FiDownload /> Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
        <label className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Path</span>
          <select value={path.id} onChange={(e) => onPathChange(e.target.value)} className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-x">
            {result.paths.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.feasible ? "" : " (short of target)"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Compare against</span>
          <select value={basis} onChange={(e) => setBasis(e.target.value)} className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-x">
            {bases.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="text-s font-bold text-slate-900">
        Profit &amp; Loss · {scenario.scenario_name} with the {path.name} path ({quarter} {year})
        {comparison && <span className="font-normal text-slate-500"> vs {comparison.label} ({comparison.period})</span>}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-x text-slate-500 py-2">
          <div className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-sky-700 animate-spin" />
          Loading comparison…
        </div>
      )}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-x px-3 py-2">{error}</div>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full border-collapse text-x">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2 text-left font-semibold">Line</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                  {path.name} path
                  <div className="font-normal">{quarter} {year}</div>
                </th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                  {comparison?.label || "—"}
                  <div className="font-normal">{comparison?.period}</div>
                </th>
                <th className="px-3 py-2 text-right font-semibold">Change</th>
                <th className="px-3 py-2 text-right font-semibold">Change %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                // Colour on a span: the page theme forces table cell colours.
                const tone = r.better == null ? "" : r.better ? "text-emerald-700" : "text-red-700";
                return (
                  <tr key={r.key} className={`border-b border-slate-100 ${TOTALS.has(r.key) ? "font-bold bg-slate-50" : ""}`}>
                    <td className="px-3 py-2">{r.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(r.kind, r.value)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(r.kind, r.prior)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span className={tone}>
                        {r.change == null ? "—" : r.kind === "pct" ? `${r.change > 0 ? "+" : ""}${r.change.toFixed(2)} pts` : `${r.change > 0 ? "+" : ""}${money(r.change)}`}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span className={tone}>{r.changePct == null ? "—" : `${r.changePct > 0 ? "+" : ""}${r.changePct.toFixed(1)}%`}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {comparison?.notes?.map((n) => (
        <p key={n} className="text-x text-slate-500 leading-relaxed">
          {n}
        </p>
      ))}
    </div>
  );
}
