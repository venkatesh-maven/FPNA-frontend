import React, { useState, useCallback, useEffect, useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import { BudgetYearContext } from "../../context/BudgetYearContext";
import { useCurrentQuarter } from "../../hooks/useCurrentQuarter";
import { API_BASE_URL } from "../../config/config";
import TableSkeleton from "../Skeleton/TableSkeleton";
import { getMonthKey } from "./RevenueForecastHelpers";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { BsSignpostSplit } from "react-icons/bs";
import { getDecimalPrecision } from '../../utils/formatters';
import ScenarioWorkspace from "./ScenarioWorkspace";
import ScenarioFindAWay from "./ScenarioFindAWay";
import { getMarkFinalState, finalVersionLabel, needsOpexReview, versionStatusLabel } from "./scenarioFinalState";

const API = `${API_BASE_URL}/api/v1/forecasting/managemet/scenario-modeling`;

const parseN = (n) => {
  if (n == null) return null;
  const num = Number(typeof n === "string" ? n.replace(/,/g, "") : n);
  return isFinite(num) ? num : null;
};
// Used for driver_value inputs in ScenarioFormModal: unlike parseN, "" maps
// to 0 (not 0 via Number("") coincidentally) so an emptied/invalid input
// always contributes 0 to calculations and save filtering, never NaN.
export function toCalcNumber(value) {
  if (value === "" || value == null) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}
const fmt = (n) => {
  const num = parseN(n);
  return num == null ? "-" : num.toLocaleString("en-US", { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() });
};
const fmtK = (n) => {
  const num = parseN(n);
  if (num == null) return "-";
  return `${num < 0 ? "-" : ""}$${Math.abs(num).toLocaleString("en-US", { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`;
};
const fmtPct = (n) => {
  const num = parseN(n);
  return num == null ? "-" : `${num.toFixed(getDecimalPrecision())}%`;
};
const driverLabel = (s) => (s === "cogs" ? "COGS" : s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()));

const STAGES = ["draft", "submitted", "reviewed", "approved", "locked"];
const STAGE_LABEL = {
  draft: "Draft",
  submitted: "Submitted",
  reviewed: "Reviewed",
  approved: "Approved",
  locked: "Locked",
};

const MONTH_LABELS = {
  "01": "Jan",
  "02": "Feb",
  "03": "Mar",
  "04": "Apr",
  "05": "May",
  "06": "Jun",
  "07": "Jul",
  "08": "Aug",
  "09": "Sep",
  "10": "Oct",
  "11": "Nov",
  "12": "Dec",
};

const REV_DRIVERS = ["volume", "selling_price", "growth_rate", "acquisition_rate"];
// cogs: the scenario's COGS reference (left at 0 it isn't saved, and the
// statement uses the Base Case's COGS for the month).
const COST_DRIVERS = ["headcount_cost", "cogs", "non_people_costs", "capex", "interest"];

const AVATAR_CLASSES = [
  "bg-sky-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-indigo-600",
  "bg-cyan-600",
  "bg-rose-600",
];

const SCENARIO_THEME = {
  "Base Case": {
    top: "bg-sky-600",
    soft: "bg-sky-50",
    text: "text-sky-700",
    badge: "bg-sky-50 text-sky-700 border-sky-200",
    icon: "◎",
  },
  "Best Case": {
    top: "bg-emerald-500",
    soft: "bg-emerald-50",
    text: "text-emerald-700",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: "↑",
  },
  "Worst Case": {
    top: "bg-red-500",
    soft: "bg-red-50",
    text: "text-red-700",
    badge: "bg-red-50 text-red-700 border-red-200",
    icon: "↓",
  },
  "Original Budget": {
    top: "bg-violet-500",
    soft: "bg-violet-50",
    text: "text-violet-700",
    badge: "bg-violet-50 text-violet-700 border-violet-200",
    icon: "▤",
  },
  "Actuals Annualized": {
    top: "bg-zinc-500",
    soft: "bg-zinc-50",
    text: "text-zinc-700",
    badge: "bg-zinc-100 text-zinc-700 border-zinc-200",
    icon: "◷",
  },
};

const CUSTOM_THEME = [
  { top: "bg-indigo-500", soft: "bg-indigo-50", text: "text-indigo-700", badge: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: "◈" },
  { top: "bg-cyan-600", soft: "bg-cyan-50", text: "text-cyan-700", badge: "bg-cyan-50 text-cyan-700 border-cyan-200", icon: "◈" },
  { top: "bg-rose-500", soft: "bg-rose-50", text: "text-rose-700", badge: "bg-rose-50 text-rose-700 border-rose-200", icon: "◈" },
  { top: "bg-amber-500", soft: "bg-amber-50", text: "text-amber-700", badge: "bg-amber-50 text-amber-700 border-amber-200", icon: "◈" },
];

function initials(name = "") {
  return (
    name
      .split(/[\s,]+/)
      .map((w) => w[0] || "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "??"
  );
}

// Exports every scenario currently in the comparison table (not just the
// visible top-4/scrollable cards) — spec requires the export to contain
// all selected scenarios even when the UI is horizontally scrolling them.
function exportComparisonCSV(compData, year, quarter) {
  const table = compData?.comparison_table || [];
  if (!table.length) return;
  const cols = Object.keys(table[0]).filter((k) => k !== "metric");
  const header = ["Metric", ...cols.map((k) => k.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()))];
  const csvEscape = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = table.map((row) => [row.metric, ...cols.map((k) => row[k])].map(csvEscape).join(","));
  const csv = [header.map(csvEscape).join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `scenario-comparison-${year}-${quarter}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Base Case is the natural reference point for "how far off is this
// scenario" — fall back to the first column so Variance modes still work
// when Base Case isn't part of the current comparison selection.
function pickReferenceColumn(cols) {
  return cols.includes("base_case") ? "base_case" : cols[0];
}

// Rows = every driver name appearing across the compared scenarios' own
// revenue/cost drivers (quarter-summed); columns = scenario. Reuses the
// same revenue_drivers/cost_drivers arrays the Drivers tab already renders,
// just pivoted scenario-major instead of month-major.
function buildDriverComparisonRows(scenarios) {
  const driverNames = [];
  scenarios.forEach((sc) => {
    [...(sc.revenue_drivers || []), ...(sc.cost_drivers || [])].forEach((d) => {
      if (!driverNames.includes(d.driver_name)) driverNames.push(d.driver_name);
    });
  });
  return driverNames.map((name) => {
    const row = { metric: driverLabel(name) };
    scenarios.forEach((sc) => {
      const rows = [...(sc.revenue_drivers || []), ...(sc.cost_drivers || [])].filter((d) => d.driver_name === name);
      const key = sc.scenario_name.toLowerCase().replace(/ /g, "_");
      row[key] = rows.length ? rows.reduce((sum, d) => sum + (parseN(d.driver_value) ?? 0), 0) : null;
    });
    return row;
  });
}

// Same shape as compData.comparison_table (rows=metric, cols=scenario) but
// one row per metric-per-month instead of one quarter-total row — reuses
// _build_scenario_financials' month1/month2/month3 sub-fields, which are
// already in compData.scenarios[]. Keeping the exact same {metric, ...cols}
// shape means the Quarterly Comparison table's rendering (including the
// Absolute/Variance $/Variance % mode logic) works on this unchanged.
function buildMonthlyComparisonRows(compData) {
  const months = compData?.months || [];
  const rows = [];
  months.forEach((m, mi) => {
    const mk = `month${mi + 1}`;
    ["Revenue", "Cost", "Net Profit", "Profit Margin %"].forEach((metricLabel) => {
      const row = { metric: `${metricLabel} — ${monthLabel(m)}` };
      (compData.scenarios || []).forEach((sc) => {
        const key = sc.scenario_name.toLowerCase().replace(/ /g, "_");
        if (metricLabel === "Revenue") row[key] = parseN(sc.revenue?.[mk]);
        else if (metricLabel === "Cost") row[key] = parseN(sc.cost?.[mk]);
        else if (metricLabel === "Net Profit") row[key] = parseN(sc.net_profit?.[mk]);
        else {
          const rev = parseN(sc.revenue?.[mk]);
          const net = parseN(sc.net_profit?.[mk]);
          row[key] = rev ? (net / rev) * 100 : 0;
        }
      });
      rows.push(row);
    });
  });
  return rows;
}

function monthLabel(m) {
  const parts = m.split("-");
  return `${MONTH_LABELS[parts[1]]} ${parts[0]}`;
}

// "Actual: Oct 2025 · Forecast: Nov–Dec 2025" from a system scenario's
// month_sources ({ "2025-10": "actual", ... }).
function monthSourcesLabel(monthSources) {
  const range = (ms) => (ms.length > 1 ? `${monthLabel(ms[0])}–${monthLabel(ms[ms.length - 1])}` : monthLabel(ms[0]));
  const months = Object.keys(monthSources || {}).sort();
  return ["actual", "forecast"]
    .map((src) => [src, months.filter((m) => monthSources[m] === src)])
    .filter(([, ms]) => ms.length)
    .map(([src, ms]) => `${src === "actual" ? "Actual" : "Forecast"}: ${range(ms)}`)
    .join(" · ");
}

function getTheme(sc, customIndex) {
  if (SCENARIO_THEME[sc.scenario_name]) return SCENARIO_THEME[sc.scenario_name];
  return CUSTOM_THEME[(customIndex || 0) % CUSTOM_THEME.length];
}

function buildInitialDrivers(months) {
  const rev = [];
  const cost = [];
  months.forEach((m) => {
    REV_DRIVERS.forEach((d) => rev.push({ driver_name: d, month: m, driver_value: 0 }));
    COST_DRIVERS.forEach((d) => cost.push({ driver_name: d, month: m, driver_value: 0 }));
  });
  return { rev, cost };
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3400);
  }, []);
  return { toasts, add };
}

function ToastBox({ toasts }) {
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-lg px-4 py-2 text-x font-semibold text-white shadow-lg ${
            t.type === "success" ? "bg-emerald-900" : t.type === "error" ? "bg-red-900" : "bg-sky-900"
          }`}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}

function Spin({ label = "Loading..." }) {
  return (
    <div className="flex flex-col items-center gap-3 py-14">
      <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-sky-700 animate-spin" />
      <span className="text-x text-slate-500">{label}</span>
    </div>
  );
}

function WfModal({ open, target, onClose, onConfirm, loading }) {
  const [comment, setComment] = useState("");
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (open) {
      setComment("");
      setErr(false);
    }
  }, [open]);

  if (!open) return null;

  const isReject = target === "draft";
  const cfg = {
    submitted: { title: "Submit for Review", icon: "↑", iconBg: "bg-sky-50", btn: "bg-sky-600 hover:bg-sky-700" },
    reviewed: { title: "Mark as Reviewed", icon: "✓", iconBg: "bg-emerald-50", btn: "bg-emerald-600 hover:bg-emerald-700" },
    approved: { title: "Approve Scenarios", icon: "✓", iconBg: "bg-emerald-50", btn: "bg-emerald-600 hover:bg-emerald-700" },
    locked: { title: "Lock Scenario Modeling", icon: "🔒", iconBg: "bg-amber-50", btn: "bg-amber-600 hover:bg-amber-700" },
    draft: { title: "Reject - Send to Draft", icon: "↩", iconBg: "bg-red-50", btn: "bg-red-600 hover:bg-red-700" },
  }[target];

  return (
    <div className="fixed inset-0 z-[1000] bg-sky-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 p-6">
        <div className={`w-10 h-10 rounded-xl ${cfg.iconBg} flex items-center justify-center text-xl mb-3`}>{cfg.icon}</div>
        <h3 className="text-base font-bold text-slate-900 mb-2">{cfg.title}</h3>
        <textarea
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
            setErr(false);
          }}
          rows={3}
          placeholder={isReject ? "Comment required when rejecting..." : "Optional comment..."}
          className={`w-full rounded-xl border px-3 py-2 text-s outline-none resize-y ${err ? "border-red-400" : "border-slate-300"}`}
        />
        {err && <p className="text-x text-red-600 mt-1">Comment is required.</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 bg-slate-50 text-s font-semibold text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={() => {
              if (isReject && !comment.trim()) {
                setErr(true);
                return;
              }
              onConfirm(target, comment.trim());
            }}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-s font-semibold text-white disabled:opacity-60 ${cfg.btn}`}
          >
            {loading ? "..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// The numbers "Mark as final" will freeze: the scenario's monthly statement
// on the P&L Statement's lines (from the /pnl endpoint's `monthly` block),
// with which months are actuals and which are forecast.
function ConfirmFinalModal({ open, scenario, year, quarter, currency, token, onClose, onConfirm, loading }) {
  const [preview, setPreview] = useState({ loading: false, rows: [], error: null });

  useEffect(() => {
    if (!open || !scenario) return undefined;
    let cancelled = false;
    setPreview({ loading: true, rows: [], error: null });
    const url = scenario.is_system
      ? `${API}/${year}/scenarios/system/pnl?quarter=${quarter}&scenario_name=${encodeURIComponent(scenario.scenario_name)}&currency=${currency}`
      : `${API}/${year}/scenarios/${scenario.id}/pnl?quarter=${quarter}&currency=${currency}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => { if (!cancelled) setPreview({ loading: false, rows: data.monthly || [], error: null }); })
      .catch((e) => { if (!cancelled) setPreview({ loading: false, rows: [], error: e.message }); });
    return () => { cancelled = true; };
  }, [open, scenario, year, quarter, currency, token]);

  if (!open) return null;
  const sum = (key) => preview.rows.reduce((t, r) => t + (parseN(r[key]) ?? 0), 0);
  const sourceChip = (src) => (
    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full border ${src === "actual" ? "bg-zinc-100 text-zinc-600 border-zinc-200" : "bg-sky-50 text-sky-700 border-sky-200"}`}>
      {src === "actual" ? "Actual" : "Forecast"}
    </span>
  );

  return (
    <div className="fixed inset-0 z-[1000] bg-sky-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-auto shadow-2xl border border-slate-200 p-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-xl mb-3">★</div>
        <h3 className="text-base font-bold text-slate-900 mb-2">Mark as final</h3>
        <p className="text-s text-slate-600 mb-3">
          These numbers for <span className="font-semibold text-slate-900">"{scenario?.scenario_name}"</span> are frozen as the
          Official Forecast for <span className="font-semibold text-slate-900">{quarter} FY{year}</span> and tracked against actuals on the P&L Statement.
        </p>

        {needsOpexReview(scenario) && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-x text-amber-800">
            This scenario was created before COGS had its own driver, so its Other OpEx may still include COGS. Review Other OpEx before marking it final.
          </div>
        )}

        <div className="rounded-xl border border-slate-200 overflow-x-auto mb-3">
          {preview.loading ? (
            <Spin label="Calculating the numbers to freeze..." />
          ) : preview.error ? (
            <div className="px-3 py-4 text-x text-red-600">Couldn't load the preview ({preview.error}). Marking final still freezes the figures as calculated now.</div>
          ) : (
            <table className="w-full text-x tabular-nums">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Month</th>
                  <th className="px-3 py-2 text-right font-semibold">Revenue</th>
                  <th className="px-3 py-2 text-right font-semibold">COGS</th>
                  <th className="px-3 py-2 text-right font-semibold">OpEx</th>
                  <th className="px-3 py-2 text-right font-semibold">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.rows.map((r) => (
                  <tr key={r.month}>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <span className="font-semibold text-slate-800 mr-1.5">{monthLabel(r.month)}</span>
                      {sourceChip(r.source)}
                    </td>
                    <td className="px-3 py-1.5 text-right">{fmtK(r.revenue)}</td>
                    <td className="px-3 py-1.5 text-right">{fmtK(r.cost_of_goods_sold)}</td>
                    <td className="px-3 py-1.5 text-right">{fmtK(r.operating_expense)}</td>
                    <td className={`px-3 py-1.5 text-right font-semibold ${(parseN(r.net_profit) ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmtK(r.net_profit)}</td>
                  </tr>
                ))}
                {preview.rows.length > 0 && (
                  <tr className="bg-slate-50 font-bold">
                    <td className="px-3 py-1.5">{quarter} total</td>
                    <td className="px-3 py-1.5 text-right">{fmtK(sum("revenue"))}</td>
                    <td className="px-3 py-1.5 text-right">{fmtK(sum("cost_of_goods_sold"))}</td>
                    <td className="px-3 py-1.5 text-right">{fmtK(sum("operating_expense"))}</td>
                    <td className="px-3 py-1.5 text-right">{fmtK(sum("net_profit"))}</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-x text-slate-500 mb-4">
          Actual months stay at actuals; forecast months keep these values even if the forecast changes later. The previous final version is kept as Superseded in Version History.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-slate-50 text-s font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-s font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? "Marking..." : "Mark as final"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CompareSelectorDrawer({ open, onClose, onCompare, scenarios, finalScenario, compData }) {
  const [selected, setSelected] = useState([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (open) {
      const initial = [];
      if (finalScenario) initial.push(finalScenario);
      const base = scenarios.find((s) => s.scenario_name === "Base Case");
      if (base) initial.push("Base Case");
      setSelected([...new Set(initial)]);
      setFilter("");
    }
  }, [open, finalScenario, scenarios]);

  if (!open) return null;

  const toggle = (name) => setSelected((p) => (p.includes(name) ? p.filter((n) => n !== name) : [...p, name]));
  const preview = (name) => compData?.scenarios?.find((s) => s.scenario_name === name);

  // "Current Forecast" just points at whichever scenario is currently
  // final — it isn't a separate backend entity. "Original Budget" and
  // "Actuals Annualized" ARE separate literal names the backend recognizes
  // and computes on demand (see get_scenario_modeling_comparison /
  // _get_original_budget_financials / _get_actuals_annualized_financials
  // in forecasting/controller.py) — they only appear in the comparison
  // once selected here and Compare is clicked.
  const official = [
    ...(finalScenario ? [{ scenario_name: finalScenario, label: "Current Forecast" }] : []),
    { scenario_name: "Original Budget", label: "Original Budget" },
    { scenario_name: "Actuals Annualized", label: "Actuals Annualized" },
  ];
  const matchesFilter = (s) => !filter.trim() || s.scenario_name.toLowerCase().includes(filter.trim().toLowerCase());
  const systemScenarios = scenarios.filter((s) => s.is_system && matchesFilter(s));
  const customScenarios = scenarios.filter((s) => !s.is_system && matchesFilter(s));

  const Group = ({ title, rows }) => {
    const names = rows.map((r) => r.scenario_name);
    const allSelected = names.length > 0 && names.every((n) => selected.includes(n));
    return (
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
          {names.length > 1 && (
            <button
              onClick={() => setSelected((p) => (allSelected ? p.filter((n) => !names.includes(n)) : [...new Set([...p, ...names])]))}
              className="text-xs font-semibold text-sky-600 hover:text-sky-800 underline"
            >
              {allSelected ? "Clear" : "Select all"}
            </button>
          )}
        </div>
        {rows.length === 0 ? (
          <div className="text-x text-slate-400 italic">None</div>
        ) : rows.map((r) => {
          const p = preview(r.scenario_name);
          return (
            <label key={r.scenario_name} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-zinc-50 cursor-pointer text-s">
              <input type="checkbox" checked={selected.includes(r.scenario_name)} onChange={() => toggle(r.scenario_name)} className="accent-sky-600 shrink-0" />
              <span className="text-slate-800 truncate flex-1">{r.label || r.scenario_name}</span>
              {p && (
                <span className="text-xs tabular-nums text-slate-400 shrink-0">
                  {fmtK(p.revenue?.quarter_total)} · {fmtPct(p.profit_margin_percent)}
                </span>
              )}
            </label>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-sky-900/60 backdrop-blur-sm flex items-center justify-end p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] overflow-auto shadow-2xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-slate-900">Compare Scenarios</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-lg text-slate-400 hover:bg-zinc-100">x</button>
          </div>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter scenarios..."
            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-x outline-none focus:border-sky-500"
          />
        </div>
        <div className="px-6 py-4">
          <Group title="Official Versions" rows={official} />
          <Group title="System Scenarios" rows={systemScenarios} />
          <Group title="Custom Scenarios" rows={customScenarios} />
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-2">
          <span className="text-xs text-slate-400">{selected.length} selected</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border border-zinc-300 bg-zinc-50 text-s font-semibold text-zinc-600 hover:bg-zinc-100">Cancel</button>
            <button
              onClick={() => selected.length && onCompare(selected)}
              disabled={selected.length === 0}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-s font-semibold disabled:opacity-60"
            >
              Compare ({selected.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FinalVersionHistoryModal({ open, onClose, versions, loading, onCreateNewVersion }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] bg-sky-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-auto shadow-2xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Final Forecast Version History</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg text-slate-400 hover:bg-zinc-100">x</button>
        </div>
        <div className="px-6 py-4">
          {loading ? (
            <Spin label="Loading version history..." />
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-s">No Final Forecast has been set yet for this year.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {versions.map((v) => (
                <div key={v.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-s font-bold text-slate-900">{v.quarter} {v.year} Forecast — v{v.version_number}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${v.status === "final" ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                        {versionStatusLabel(v)}
                      </span>
                      {v.snapshot_status === "backfilled" && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200" title="Frozen later from the figures at backfill time, not the day it was marked final">
                          Backfilled
                        </span>
                      )}
                    </div>
                    <div className="text-x text-slate-500 mt-0.5">
                      "{v.scenario_name}"{v.scenario_type ? ` (${v.scenario_type === "system" ? "System" : "Custom"})` : ""} · set by {v.set_final_by_name || "—"} · {v.set_final_at ? new Date(v.set_final_at).toLocaleString() : "—"}
                    </div>
                    {v.totals && (
                      <div className="flex gap-3 flex-wrap mt-1 text-x tabular-nums text-slate-600">
                        <span>Revenue <span className="font-semibold text-slate-800">{fmtK(v.totals.revenue)}</span></span>
                        <span>COGS <span className="font-semibold text-slate-800">{fmtK(v.totals.cost_of_goods_sold)}</span></span>
                        <span>OpEx <span className="font-semibold text-slate-800">{fmtK(v.totals.operating_expense)}</span></span>
                        <span>Net <span className={`font-semibold ${(parseN(v.totals.net_profit) ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmtK(v.totals.net_profit)}</span></span>
                      </div>
                    )}
                  </div>
                  {v.status === "final" && onCreateNewVersion && (
                    <button onClick={() => onCreateNewVersion(v)} className="px-3 py-1.5 rounded-lg bg-sky-50 border border-sky-100 text-sky-700 text-x font-semibold hover:bg-sky-100 shrink-0">
                      Create New Version
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScenarioFormModal({ open, onClose, onSave, months, loading, initial }) {
  const isEdit = !!initial;
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [revDrivers, setRevDrivers] = useState([]);
  const [costDrivers, setCostDrivers] = useState([]);

  useEffect(() => {
    if (!open) return;

    if (isEdit) {
      setName(initial.scenario_name || "");
      setDesc(initial.description || "");

      const fillDrivers = (driverNames, existing) =>
        months.flatMap((m) =>
          driverNames.map((d) => {
            const found = (existing || []).find((e) => e.driver_name === d && e.month === m);
            return { driver_name: d, month: m, driver_value: found ? found.driver_value : 0 };
          })
        );

      setRevDrivers(fillDrivers(REV_DRIVERS, initial.revenue_drivers));
      setCostDrivers(fillDrivers(COST_DRIVERS, initial.cost_drivers));
    } else {
      setName("");
      setDesc("");
      const init = buildInitialDrivers(months);
      setRevDrivers(init.rev);
      setCostDrivers(init.cost);
    }
  }, [open, isEdit, initial, months]);

  if (!open) return null;

  // Keep the raw typed value ("", "13", "13.5") instead of immediately
  // running it through `parseFloat(val) || 0`, which collapsed an emptied
  // field straight back to 0 on every keystroke (including Backspace),
  // making it impossible to clear. toCalcNumber resolves it to a real
  // number wherever one's actually needed — see handleSave below.
  const updateRev = (i, val) =>
    setRevDrivers((p) => {
      const n = [...p];
      n[i] = { ...n[i], driver_value: val };
      return n;
    });

  const updateCost = (i, val) =>
    setCostDrivers((p) => {
      const n = [...p];
      n[i] = { ...n[i], driver_value: val };
      return n;
    });

  const handleSave = () => {
    if (!name.trim()) return;
    const resolve = (drivers) => drivers
      .map((d) => ({ ...d, driver_value: toCalcNumber(d.driver_value) }))
      .filter((d) => d.driver_value !== 0);
    onSave({
      scenario_name: name.trim(),
      description: desc.trim(),
      revenue_drivers: resolve(revDrivers),
      cost_drivers: resolve(costDrivers),
    });
  };

  const InputGrid = ({ drivers, updater }) => {
    const names = [...new Set(drivers.map((d) => d.driver_name))];

    return (
      <div className="analytics-table-scroll overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full border-collapse text-x">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Driver</th>
              {months.map((m) => (
                <th key={m} className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {monthLabel(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {names.map((dn) => (
              <tr key={dn} className="border-b border-slate-100">
                <td className="px-3 py-2 font-semibold text-slate-900">{driverLabel(dn)}</td>
                {months.map((m) => {
                  const idx = drivers.findIndex((d) => d.driver_name === dn && d.month === m);
                  const value = idx >= 0 ? drivers[idx].driver_value : 0;
                  return (
                    <td key={m} className="px-2 py-1.5 text-right">
                      <input
                        type="number"
                        step="any"
                        value={value ?? ""}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => idx >= 0 && updater(idx, e.target.value)}
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-right tabular-nums outline-none focus:border-sky-500"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-sky-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-auto shadow-2xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">{isEdit ? "Edit Scenario" : "New Custom Scenario"}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg text-slate-400 hover:bg-zinc-100">x</button>
        </div>

        <div className="px-6 py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Scenario Name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Conservative Plan"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-s outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Description</label>
              <input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Brief description..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-s outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="mb-4">
            <div className=" text-xs font-bold uppercase tracking-wide text-sky-700 mb-2">Revenue Drivers</div>
            <InputGrid drivers={revDrivers} updater={updateRev} />
          </div>

          <div>
            <div className=" text-xs font-bold uppercase tracking-wide text-red-700 mb-2">Cost Drivers</div>
            <InputGrid drivers={costDrivers} updater={updateCost} />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 bg-slate-50 text-s font-semibold text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !name.trim()}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-s font-semibold disabled:opacity-60"
          >
            {loading ? "Saving..." : isEdit ? "Save Changes" : "Create Scenario"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ScenarioModeling() {
  const { token, currentUser, selectedCurrency } = useContext(AuthContext);
  const { budgetYear, fiscalYearStartMonth } = useContext(BudgetYearContext);
  const year = budgetYear - 1;
  const currency = selectedCurrency || "USD";

  const userDept = String(currentUser?.user_department || "").toLowerCase();
  const isAdmin = userDept === "administration";
  const isFinanceUser = userDept === "finance";

  const [quarter, setQuarter] = useCurrentQuarter(fiscalYearStartMonth);
  const [activeTab, setActiveTab] = useState("scenarios");

  const [scenariosData, setScenariosData] = useState(null);
  const [compData, setCompData] = useState(null);
  const [comments, setComments] = useState([]);
  const [stage, setStage] = useState("draft");
  const [finalScenario, setFinalScenario] = useState(null);

  const [loadingSc, setLoadingSc] = useState(false);
  const [loadingCmp, setLoadingCmp] = useState(false);
  const [loadingCmt, setLoadingCmt] = useState(false);
  const [savingForm, setSavingForm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [settingFinalId, setSettingFinalId] = useState(null);
  const [wfLoading, setWfLoading] = useState(false);

  const [wfModal, setWfModal] = useState({ open: false, target: null });
  const [scForm, setScForm] = useState({ open: false, editing: null });
  const [confirmFinal, setConfirmFinal] = useState({ open: false, scenario: null });

  const [newComment, setNewComment] = useState("");
  const [postingCmt, setPostingCmt] = useState(false);
  const [cmtTypeFilter, setCmtTypeFilter] = useState("");

  const [currencyFilter, setCurrencyFilter] = useState("actualvalue");

  const [compView, setCompView] = useState("quarterly");
  const [compMonthIdx, setCompMonthIdx] = useState(0);
  const [compareMode, setCompareMode] = useState("absolute");
  const [drvScenario, setDrvScenario] = useState("all");
  const [drvType, setDrvType] = useState("all");
  const [drvMonth, setDrvMonth] = useState("all");
  const [scSearch, setScSearch] = useState("");

  const [workspace, setWorkspace] = useState({ open: false, scenarioId: null, isSystem: false, systemName: null, displayName: "" });
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareNames, setCompareNames] = useState(null);
  const [versionHistory, setVersionHistory] = useState({ open: false, loading: false, versions: [] });
  // Find a Way per scenario; results are kept per scenario + period so
  // reopening shows the last answer instead of starting over.
  const [findAWay, setFindAWay] = useState({ open: false, scenario: null, figures: null });
  const [findAWayResults, setFindAWayResults] = useState({});
  const [creatingFromPath, setCreatingFromPath] = useState(false);

  const canSetFinal = isAdmin || userDept === "ceo" || (isFinanceUser && (stage === "approved" || stage === "locked"));
  const finalVersion = scenariosData?.final_version || null;
  const markFinalStateOf = (sc) => getMarkFinalState(sc, {
    finalScenarioName: finalScenario, finalVersion, department: userDept, stage, quarter,
  });

  const months = [0, 1, 2].map((i) => getMonthKey(year, i, quarter, fiscalYearStartMonth));
  const { toasts, add: addToast } = useToast();

  const fetchScenarios = useCallback(async () => {
    setLoadingSc(true);
    try {
      const res = await fetch(`${API}/${year}/scenarios?currency=${currency}&quarter=${quarter}&currency_filter=${currencyFilter}`, {
        headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setScenariosData(data);
      setStage(data.workflow_stage || "draft");
      setFinalScenario(data.final_scenario);
    } catch (e) {
      addToast(`Failed to load scenarios: ${e.message}`, "error");
    } finally {
      setLoadingSc(false);
    }
  }, [year, quarter, currency, currencyFilter, token, addToast, fiscalYearStartMonth]);

  const fetchComparison = useCallback(async (namesOverride) => {
    setLoadingCmp(true);
    try {
      const names = namesOverride !== undefined ? namesOverride : compareNames;
      const namesParam = names && names.length ? `&scenario_names=${encodeURIComponent(names.join(","))}` : "";
      const res = await fetch(`${API}/${year}/comparison?currency=${currency}&quarter=${quarter}&currency_filter=${currencyFilter}${namesParam}`, {
        headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCompData(data);
    } catch (e) {
      addToast(`Failed to load comparison: ${e.message}`, "error");
    } finally {
      setLoadingCmp(false);
    }
  }, [year, quarter, currency, currencyFilter, token, addToast, fiscalYearStartMonth, compareNames]);

  const fetchVersionHistory = useCallback(async () => {
    setVersionHistory((p) => ({ ...p, loading: true }));
    try {
      const res = await fetch(`${API}/${year}/final-versions`, {
        headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setVersionHistory((p) => ({ ...p, versions: data.versions || [] }));
    } catch (e) {
      addToast(`Failed to load version history: ${e.message}`, "error");
    } finally {
      setVersionHistory((p) => ({ ...p, loading: false }));
    }
  }, [year, token, addToast]);

  const fetchComments = useCallback(async () => {
    setLoadingCmt(true);
    try {
      const url = cmtTypeFilter
        ? `${API}/${year}/comments?quarter=${quarter}&comment_type=${cmtTypeFilter}`
        : `${API}/${year}/comments?quarter=${quarter}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setComments(Array.isArray(data) ? data : data.comments || []);
    } catch (e) {
      addToast(`Failed to load comments: ${e.message}`, "error");
    } finally {
      setLoadingCmt(false);
    }
  }, [year, quarter, token, cmtTypeFilter, addToast]);

  useEffect(() => {
    fetchScenarios();
    fetchComparison();
  }, [fetchScenarios, fetchComparison]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleCreateScenario = async (payload) => {
    setSavingForm(true);
    try {
      const res = await fetch(`${API}/${year}/scenarios?quarter=${quarter}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      addToast("Scenario created successfully", "success");
      setScForm({ open: false, editing: null });
      fetchScenarios();
      fetchComparison();
    } catch (e) {
      addToast(`Create failed: ${e.message}`, "error");
    } finally {
      setSavingForm(false);
    }
  };

  const handleUpdateScenario = async (id, payload) => {
    setSavingForm(true);
    try {
      const res = await fetch(`${API}/${year}/scenarios/${id}?quarter=${quarter}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      addToast("Scenario updated", "success");
      setScForm({ open: false, editing: null });
      fetchScenarios();
      fetchComparison();
    } catch (e) {
      addToast(`Update failed: ${e.message}`, "error");
    } finally {
      setSavingForm(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this scenario?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API}/${year}/scenarios/${id}?quarter=${quarter}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
      });
      if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
      addToast(res.status === 404 ? "Scenario was already deleted" : "Scenario deleted", "success");
      fetchScenarios();
      fetchComparison();
    } catch (e) {
      addToast(`Delete failed: ${e.message}`, "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetFinal = (sc) => {
    setConfirmFinal({ open: true, scenario: sc });
  };

  const handleConfirmSetFinal = async () => {
    const sc = confirmFinal.scenario;
    if (!sc) return;
    setSettingFinalId(sc.id || sc.scenario_name);
    try {
      const url = sc.is_system
        ? `${API}/${year}/scenarios/system/promote-final?quarter=${quarter}&scenario_name=${encodeURIComponent(sc.scenario_name)}`
        : `${API}/${year}/scenarios/${sc.id}/promote-final?quarter=${quarter}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const done = await res.json().catch(() => ({}));
      addToast(`"${sc.scenario_name}" is now the Official Forecast for ${quarter}${done.version_number ? ` (v${done.version_number})` : ""}`, "success");
      fetchScenarios();
      fetchComparison();
      setWorkspace({ open: false, scenarioId: null, isSystem: false, systemName: null, displayName: "" });
    } catch (e) {
      addToast(`Failed: ${e.message}`, "error");
    } finally {
      setSettingFinalId(null);
      setConfirmFinal({ open: false, scenario: null });
    }
  };

  const handleCreateNewVersion = async (versionRow) => {
    if (!versionRow?.scenario_id) {
      addToast("This final version has no source scenario to branch from.", "error");
      return;
    }
    try {
      const res = await fetch(`${API}/${year}/scenarios/${versionRow.scenario_id}/duplicate?quarter=${quarter}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      addToast(`Created "${data.scenario.scenario_name}" — Draft`, "success");
      setVersionHistory((p) => ({ ...p, open: false }));
      fetchScenarios();
      setWorkspace({ open: true, scenarioId: data.scenario.id, isSystem: false, systemName: null, displayName: data.scenario.scenario_name });
    } catch (e) {
      addToast(`Create New Version failed: ${e.message}`, "error");
    }
  };

  const findAWayKey = (sc) => `${year}|${quarter}|${sc.id ?? sc.scenario_name}`;

  const handleCreateFromPath = async (payload) => {
    setCreatingFromPath(true);
    try {
      const res = await fetch(`${API}/${year}/scenarios?quarter=${quarter}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.detail === "string" ? err.detail : `HTTP ${res.status}`);
      }
      addToast(`Created "${payload.scenario_name}" from Find a Way`, "success");
      setFindAWay({ open: false, scenario: null, figures: null });
      fetchScenarios();
      fetchComparison();
    } catch (e) {
      addToast(`Create failed: ${e.message}`, "error");
    } finally {
      setCreatingFromPath(false);
    }
  };

  const handleWorkflow = async (target, comment) => {
    setWfLoading(true);
    try {
      const params = new URLSearchParams({ quarter, target_stage: target });
      if (comment) params.set("comment", comment);
      const res = await fetch(`${API}/${year}/workflow?${params}`, {
        method: "PATCH",
        headers: { accept: "application/json", Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStage(target);
      setWfModal({ open: false, target: null });
      addToast(`Stage -> ${STAGE_LABEL[target]}`, "success");
      fetchScenarios();
    } catch (e) {
      addToast(`Workflow error: ${e.message}`, "error");
    } finally {
      setWfLoading(false);
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim()) {
      addToast("Comment cannot be empty", "error");
      return;
    }
    setPostingCmt(true);
    try {
      const res = await fetch(`${API}/${year}/comments?quarter=${quarter}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ comment: newComment.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNewComment("");
      addToast("Comment posted", "success");
      fetchComments();
    } catch (e) {
      addToast(`Post failed: ${e.message}`, "error");
    } finally {
      setPostingCmt(false);
    }
  };

  const scenarios = scenariosData?.scenarios || [];
  const customIndex = (sc) => scenarios.filter((s) => !s.is_system).findIndex((s) => (s.id || s.scenario_name) === (sc.id || sc.scenario_name));
  const filtered = scenarios.filter((s) => s.scenario_name.toLowerCase().includes(scSearch.toLowerCase()));

  const baseComp = compData?.scenarios?.find((s) => s.scenario_name === "Base Case");
  const bestComp = compData?.scenarios?.find((s) => s.scenario_name === "Best Case");
  const worstComp = compData?.scenarios?.find((s) => s.scenario_name === "Worst Case");

  const stageIdx = STAGES.indexOf(stage);
  const canSubmit = stage === "draft";
  const canReview = stage === "submitted";
  const canApprove = stage === "reviewed";
  const canLock = stage === "approved";
  const canReject = stage !== "draft";

  return (
    <div className="planning-compact forecasting-pnl-theme scenario-modeling-page min-h-screen bg-sky-50 font-sans text-sky-900">
      <ToastBox toasts={toasts} />
      <WfModal open={wfModal.open} target={wfModal.target} onClose={() => setWfModal({ open: false, target: null })} onConfirm={handleWorkflow} loading={wfLoading} />
      <ConfirmFinalModal
        open={confirmFinal.open}
        scenario={confirmFinal.scenario}
        year={year}
        quarter={quarter}
        currency={currency}
        token={token}
        onClose={() => setConfirmFinal({ open: false, scenario: null })}
        onConfirm={handleConfirmSetFinal}
        loading={!!settingFinalId}
      />
      <ScenarioFormModal
        open={scForm.open}
        months={months}
        loading={savingForm}
        initial={scForm.editing}
        onClose={() => setScForm({ open: false, editing: null })}
        onSave={(payload) => {
          if (scForm.editing) handleUpdateScenario(scForm.editing.id, payload);
          else handleCreateScenario(payload);
        }}
      />
      <CompareSelectorDrawer
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        scenarios={scenarios}
        finalScenario={finalScenario}
        compData={compData}
        onCompare={(selected) => {
          setCompareNames(selected);
          setCompareOpen(false);
          setActiveTab("comparison");
          fetchComparison(selected);
        }}
      />
      <FinalVersionHistoryModal
        open={versionHistory.open}
        loading={versionHistory.loading}
        versions={versionHistory.versions}
        onClose={() => setVersionHistory((p) => ({ ...p, open: false }))}
        onCreateNewVersion={canSetFinal ? handleCreateNewVersion : null}
      />
      {workspace.open && (
        <ScenarioWorkspace
          year={year}
          quarter={quarter}
          months={months}
          currency={currency}
          scenarioId={workspace.scenarioId}
          isSystemScenario={workspace.isSystem}
          systemScenarioName={workspace.systemName}
          scenarioDisplayName={workspace.displayName}
          onClose={() => setWorkspace({ open: false, scenarioId: null, isSystem: false, systemName: null, displayName: "" })}
          addToast={addToast}
          markFinal={(() => {
            const sc = scenarios.find((s) => (workspace.isSystem ? s.is_system && s.scenario_name === workspace.systemName : s.id === workspace.scenarioId));
            const state = markFinalStateOf(sc || { scenario_name: workspace.displayName, is_system: workspace.isSystem });
            return state.kind === "button" ? state : { allowed: false, reason: "Already the final forecast." };
          })()}
          onRequestSetFinal={(sc) => {
            const full = scenarios.find((s) => (sc.is_system ? s.is_system && s.scenario_name === sc.scenario_name : s.id === sc.id));
            setConfirmFinal({ open: true, scenario: full || sc });
          }}
          onSaved={() => { fetchScenarios(); fetchComparison(); }}
        />
      )}
      {findAWay.open && (
        <ScenarioFindAWay
          key={findAWayKey(findAWay.scenario)}
          scenario={findAWay.scenario}
          figures={findAWay.figures}
          year={year}
          quarter={quarter}
          currency={currency}
          token={token}
          saved={findAWayResults[findAWayKey(findAWay.scenario)]}
          onResult={(data) => setFindAWayResults((p) => ({ ...p, [findAWayKey(findAWay.scenario)]: data }))}
          onClose={() => setFindAWay({ open: false, scenario: null, figures: null })}
          onCreateScenario={handleCreateFromPath}
          creating={creatingFromPath}
        />
      )}

      <header className="forecasting-page-header bg-gradient-to-r from-sky-950 via-sky-900 to-sky-700 rounded-xl px-4 md:px-6 sticky -top-5 z-40 shadow-sm">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 text-white">
            <h1 className="text-lg font-bold text-white">Scenario Modeling</h1>
            <span className="px-2 py-0.5 rounded-md bg-white/15 border border-white/20 text-sm font-semibold">
              {scenariosData?.total_scenarios || 0} scenarios
            </span>
            {finalScenario && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-xs font-semibold">{finalVersionLabel(finalVersion)}: {finalScenario}</span>
            )}
          </div>

          <div className="flex items-center gap-2 text-white flex-wrap justify-end">
            <p className="text-sm">{year} · {quarter} · {currency}</p>
            <span className="px-2.5 py-1 rounded-full  text-xs font-semibold bg-white/10 border border-white/20">{STAGE_LABEL[stage]}</span>
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              className="px-3 py-1 rounded-lg bg-white border border-sky-200 text-sky-900 text-x font-semibold outline-none focus:ring-2 focus:ring-sky-200"
            >
              <option value="actualvalue">Actual</option>
              <option value="thousands">Thousands</option>
              <option value="millions">Millions</option>
            </select>
            <select
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              className="px-3 py-1 rounded-lg bg-white border border-sky-200 text-sky-900 text-x font-semibold outline-none focus:ring-2 focus:ring-sky-200"
            >
              {["Q1", "Q2", "Q3", "Q4"].map((q) => (
                <option key={q} value={q} className="bg-white text-sky-900">{q}</option>
              ))}
            </select>
            <button
              onClick={() => { setVersionHistory((p) => ({ ...p, open: true })); fetchVersionHistory(); }}
              className="px-3 py-1 rounded-lg bg-white/10 border border-white/20 text-x font-semibold hover:bg-white/20"
            >
              Version History
            </button>
            <button
              onClick={() => {
                fetchScenarios();
                fetchComparison();
                fetchComments();
              }}
              className="px-3 py-1 rounded-lg bg-white/10 border border-white/20 text-x font-semibold hover:bg-white/20"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto py-2">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2 mb-2">
          {[
            { label: "Base Case Revenue", val: fmtK(baseComp?.revenue?.quarter_total), sub: `Margin ${fmtPct(baseComp?.profit_margin_percent)}`, text: "text-sky-700", iconBg: "bg-sky-50", icon: "◎" },
            { label: "Best Case Revenue", val: fmtK(bestComp?.revenue?.quarter_total), sub: `Margin ${fmtPct(bestComp?.profit_margin_percent)}`, text: "text-emerald-700", iconBg: "bg-emerald-50", icon: "↑" },
            { label: "Worst Case Revenue", val: fmtK(worstComp?.revenue?.quarter_total), sub: `Margin ${fmtPct(worstComp?.profit_margin_percent)}`, text: "text-red-700", iconBg: "bg-red-50", icon: "↓" },
            { label: "Total Scenarios", val: scenariosData?.total_scenarios || "-", sub: `${scenariosData?.system_scenarios_count || 0} system · ${scenariosData?.custom_scenarios_count || 0} custom`, text: "text-indigo-700", iconBg: "bg-indigo-50", icon: "◈" },
            { label: "Final Scenario", val: finalScenario || "None", sub: finalScenario ? `${finalVersionLabel(finalVersion)} · ${STAGE_LABEL[stage]}` : `Stage: ${STAGE_LABEL[stage]}`, text: finalScenario ? "text-emerald-700" : "text-slate-500", iconBg: "bg-slate-100", icon: "★" },
          ].map((k) => (
            <div key={k.label} className="min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm px-3 py-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center justify-between gap-2 mb-0.5">
                <span className="truncate">{k.label}</span>
                <div className={`w-6 h-6 shrink-0 rounded-full ${k.iconBg} flex items-center justify-center text-xs`}>{k.icon}</div>
              </div>
              <div className="flex items-baseline gap-2 min-w-0">
                <span className={`text-base font-bold truncate ${k.text}`} title={typeof k.val === "string" ? k.val : undefined}>{k.val}</span>
                <span className="text-[11px] text-slate-500 truncate" title={k.sub}>{k.sub}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-2 mb-2 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {STAGES.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center ${
                    i < stageIdx ? "bg-emerald-500 text-white" : i === stageIdx ? "bg-sky-600 text-white" : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {i < stageIdx ? "✓" : i + 1}
                </div>
                <span className={` text-xs ${i === stageIdx ? "text-sky-700 font-semibold" : "text-slate-500"}`}>{STAGE_LABEL[s]}</span>
                {i < STAGES.length - 1 && <div className={`w-6 h-[2px] ${i < stageIdx ? "bg-emerald-500" : "bg-slate-200"}`} />}
              </div>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap">
            {canReject && <button onClick={() => setWfModal({ open: true, target: "draft" })} className="px-3 py-1 rounded-lg border border-red-200 text-red-600 bg-red-50 text-x font-semibold">Reject</button>}
            {canSubmit && <button onClick={() => setWfModal({ open: true, target: "submitted" })} className="px-3 py-1 rounded-lg bg-sky-600 text-white text-x font-semibold">Submit</button>}
            {canReview && <button onClick={() => setWfModal({ open: true, target: "reviewed" })} className="px-3 py-1 rounded-lg bg-sky-600 text-white text-x font-semibold">Mark Reviewed</button>}
            {canApprove && <button onClick={() => setWfModal({ open: true, target: "approved" })} className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-x font-semibold">Approve</button>}
            {canLock && <button onClick={() => setWfModal({ open: true, target: "locked" })} className="px-3 py-1 rounded-lg bg-amber-600 text-white text-x font-semibold">Lock</button>}
          </div>
        </div>

        <div className="flex items-center justify-between border-b-2 border-slate-200 mb-2 gap-2 flex-wrap">
          <div className="flex items-end gap-0.5">
            {[
              { id: "scenarios", label: "Scenarios", count: filtered.length },
              { id: "comparison", label: "Comparison", count: null },
              { id: "drivers", label: "Drivers", count: null },
              { id: "comments", label: "Comments", count: comments.length },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-1.5 text-s font-semibold rounded-t-xl ${
                  activeTab === t.id
                    ? "bg-white text-sky-600 border-l border-t border-r border-slate-200 border-b-2 border-b-white -mb-0.5"
                    : "text-slate-500 hover:text-sky-700 hover:bg-white/60"
                }`}
              >
                {t.label}
                {t.count != null && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-sky-50 border border-sky-100 text-sky-700 text-xs font-semibold">{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {activeTab === "scenarios" && (
            <div className="flex gap-2 items-center">
              <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-1">
                <span className="text-slate-400">🔍</span>
                <input
                  value={scSearch}
                  onChange={(e) => setScSearch(e.target.value)}
                  placeholder="Search scenarios..."
                  className="border-none outline-none text-x text-slate-900 w-40 bg-transparent"
                />
              </div>
              <button onClick={() => setScForm({ open: true, editing: null })} className="bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-1 rounded-xl text-x font-semibold">
                + New Scenario
              </button>
            </div>
          )}
        </div>

        {activeTab === "scenarios" && (
          loadingSc ? <TableSkeleton columns={4} rows={6} /> : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
              <div className="text-3xl mb-2">📭</div>
              <div className="text-s">No scenarios found</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((sc) => {
                const t = getTheme(sc, customIndex(sc));
                const isFinal = sc.is_final || sc.scenario_name === finalScenario;
                const finalState = markFinalStateOf(sc);
                const cmp = compData?.scenarios?.find((s) => (s.scenario_id != null ? s.scenario_id === sc.id : s.scenario_name === sc.scenario_name));

                const rev = cmp?.revenue?.quarter_total;
                const cost = cmp?.cost?.quarter_total;
                const net = cmp?.net_profit?.quarter_total;
                const margin = cmp?.profit_margin_percent;

                return (
                  <div key={sc.id || sc.scenario_name} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isFinal ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-200"}`}>
                    <div className={`h-1 ${t.top}`} />
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-s">{t.icon}</span>
                          <span className="text-s font-bold text-slate-900">{sc.scenario_name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-md border font-semibold ${t.badge}`}>{sc.is_system ? "System" : "Custom"}</span>
                          {isFinal && (
                            <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full" title={finalState.byline || undefined}>
                              {finalState.label || "Final"}
                            </span>
                          )}
                        </div>

                        {!sc.is_system && !isFinal && !finalScenario && (
                          <div className="flex gap-1.5">
                            <button onClick={() => setScForm({ open: true, editing: sc })} className="px-2 py-1 rounded-lg  text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100">
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(sc.id)}
                              disabled={deletingId === sc.id}
                              className="px-2 py-1 rounded-lg  text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-60"
                            >
                              {deletingId === sc.id ? "..." : "Del"}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className=" text-xs text-slate-500 mb-3 min-h-[18px]">{sc.description}</div>
                      {isFinal && finalState.byline && (
                        <div className="-mt-2 mb-2 text-xs text-emerald-700">Marked final {finalState.byline}</div>
                      )}
                      {needsOpexReview(sc) && !isFinal && (
                        <div className="-mt-1 mb-2 text-xs text-amber-700" title="Created before COGS had its own driver">
                          Review Other OpEx before marking final: it may still include COGS.
                        </div>
                      )}
                      {sc.month_sources && (
                        <div className="-mt-2 mb-3">
                          <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full border border-sky-200 bg-sky-50 text-sky-800">
                            {monthSourcesLabel(sc.month_sources)}
                          </span>
                        </div>
                      )}

                      {cmp && (
                        <div className="grid grid-cols-3 gap-2 mb-2.5">
                          {[
                            { lbl: "Revenue", val: fmtK(rev), color: "text-sky-700" },
                            { lbl: "Cost", val: fmtK(cost), color: "text-red-700" },
                            { lbl: "Net", val: fmtK(net), color: parseN(net) >= 0 ? "text-emerald-700" : "text-red-700" },
                          ].map((m) => (
                            <div key={m.lbl} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2">
                              <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-0.5">{m.lbl}</div>
                              <div className={`text-x font-bold ${m.color}`}>{m.val}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {cmp && (
                        <div className={`rounded-lg border px-3 py-2 mb-2.5 ${t.soft} border-slate-200`}>
                          <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Profit Margin</div>
                          <div className={`text-s font-bold ${parseN(margin) >= 0 ? t.text : "text-red-700"}`}>{fmtPct(margin)}</div>
                        </div>
                      )}

                      <div className="flex gap-2 mt-3 flex-wrap">
                        <button
                          onClick={() => setWorkspace({
                            open: true,
                            scenarioId: sc.is_system ? null : sc.id,
                            isSystem: !!sc.is_system,
                            systemName: sc.is_system ? sc.scenario_name : null,
                            displayName: sc.scenario_name,
                          })}
                          className="flex-1 px-3 py-2 rounded-lg text-x font-semibold bg-sky-600 hover:bg-sky-700 text-white"
                        >
                          Open
                        </button>
                        {finalState.kind === "final" ? (
                          <button
                            disabled
                            title={finalState.byline || undefined}
                            className="flex-1 px-3 py-2 rounded-lg text-x font-semibold bg-emerald-100 text-emerald-700 disabled:opacity-80"
                          >
                            {finalState.label}
                          </button>
                        ) : (
                          // Disabled buttons don't fire mouse events, so the
                          // reason sits on a wrapper.
                          <span className="flex-1 flex" title={finalState.reason || undefined}>
                            <button
                              onClick={() => handleSetFinal(sc)}
                              disabled={!finalState.allowed || !!settingFinalId}
                              className="flex-1 px-3 py-2 rounded-lg text-x font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
                            >
                              {settingFinalId === (sc.id || sc.scenario_name) ? "Marking..." : "Mark as final"}
                            </button>
                          </span>
                        )}
                        <button
                          onClick={() => {
                            setActiveTab("drivers");
                            setDrvScenario(sc.scenario_name);
                          }}
                          className={`flex-1 px-3 py-2 rounded-lg text-x font-semibold border ${t.badge}`}
                        >
                          Drivers
                        </button>
                      </div>
                      <button
                        onClick={() => setFindAWay({
                          open: true,
                          scenario: sc,
                          figures: {
                            net: parseN(net) ?? 0,
                            margin: parseN(margin) ?? 0,
                            display: { revenue: fmtK(rev), cost: fmtK(cost), net: fmtK(net), margin: fmtPct(margin) },
                          },
                        })}
                        disabled={!cmp}
                        title="Describe a goal for this scenario and get alternative paths through its drivers"
                        className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-x font-semibold border border-sky-200 bg-gradient-to-r from-sky-50 to-indigo-50 text-sky-800 hover:from-sky-100 hover:to-indigo-100 disabled:opacity-50"
                      >
                        <BsSignpostSplit /> Find a Way
                        {findAWayResults[findAWayKey(sc)] && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Has a result" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {activeTab === "comparison" && (
          loadingCmp ? <TableSkeleton columns={5} rows={6} /> : !compData ? (
            <div className="text-center p-10 text-slate-400 bg-white rounded-xl border border-slate-200">No comparison data</div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex gap-2">
                    {["quarterly", "monthly"].map((v) => (
                      <button
                        key={v}
                        onClick={() => setCompView(v)}
                        className={`px-3 py-1.5 rounded-lg border text-x font-semibold ${compView === v ? "bg-sky-600 text-white border-sky-600" : "bg-white text-slate-600 border-slate-300"}`}
                      >
                        {v === "quarterly" ? "Quarterly" : "Monthly"}
                      </button>
                    ))}
                  </div>
                  {compView === "monthly" && compData.months && (
                    <div className="flex items-center gap-1.5">
                      <label className="text-x font-semibold text-slate-500">Month:</label>
                      <div className="flex gap-1">
                        {compData.months.map((m, mi) => (
                          <button
                            key={m}
                            onClick={() => setCompMonthIdx(mi)}
                            className={`px-2.5 py-1 rounded-lg border text-x font-semibold ${compMonthIdx === mi ? "bg-sky-600 text-white border-sky-600" : "bg-white text-slate-600 border-slate-300"}`}
                          >
                            {monthLabel(m)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <label className="text-x font-semibold text-slate-500">View:</label>
                    <select
                      value={compareMode}
                      onChange={(e) => setCompareMode(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-x font-semibold outline-none focus:border-sky-500"
                    >
                      <option value="absolute">Absolute Values</option>
                      <option value="variance_dollar">Variance $</option>
                      <option value="variance_pct">Variance %</option>
                      <option value="drivers">Drivers / Assumptions</option>
                    </select>
                  </div>
                  <button
                    onClick={() => setCompareOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-x font-semibold"
                  >
                    Compare
                  </button>
                </div>
                {compareNames && (
                  <div className="flex items-center gap-1.5 text-x text-slate-500">
                    Comparing: {compareNames.map((n) => (
                      <span key={n} className="px-2 py-0.5 rounded-full bg-sky-50 border border-sky-100 text-sky-700 font-semibold">{n}</span>
                    ))}
                    <button onClick={() => { setCompareNames(null); fetchComparison(null); }} className="text-slate-400 hover:text-slate-600 underline ml-1">Clear</button>
                  </div>
                )}
              </div>

              {/* Always show every scenario here, not just the first 4 — a
                  hard slice(0,4) meant any custom scenario created after the
                  4th (3 system + 1 custom) silently never appeared in this
                  row at all, with no indication anything was hidden. */}
              <div className="analytics-table-scroll overflow-x-auto mb-4">
              <div className="flex gap-3">
                {compData.scenarios.map((sc, i) => {
                  const t = getTheme(sc, i);
                  const isFinal = sc.is_final || sc.scenario_name === finalScenario;
                  // In Monthly mode these cards track the selected month
                  // (via the Month picker above) instead of the quarter
                  // total — previously they never changed at all when
                  // toggling Quarterly/Monthly, which looked like the
                  // toggle wasn't doing anything.
                  const mk = `month${compMonthIdx + 1}`;
                  const revVal = compView === "monthly" ? sc.revenue?.[mk] : sc.revenue?.quarter_total;
                  const costVal = compView === "monthly" ? sc.cost?.[mk] : sc.cost?.quarter_total;
                  const netVal = compView === "monthly" ? sc.net_profit?.[mk] : sc.net_profit?.quarter_total;
                  const marginVal = compView === "monthly"
                    ? (parseN(revVal) ? (parseN(netVal) / parseN(revVal)) * 100 : 0)
                    : sc.profit_margin_percent;
                  return (
                    <div key={sc.scenario_name} className={`bg-white rounded-xl border shadow-sm overflow-hidden w-64 shrink-0 ${isFinal ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-200"}`}>
                      <div className={`h-1 ${t.top}`} />
                      <div className="p-3.5">
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="text-s">{t.icon}</span>
                          <span className="text-x font-bold text-slate-900">{sc.scenario_name}</span>
                          {isFinal && <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">Final</span>}
                          {compView === "monthly" && (
                            <span className="text-xs font-semibold text-slate-400">{monthLabel(compData.months[compMonthIdx])}</span>
                          )}
                        </div>

                        {[
                          ["Revenue", revVal, "text-sky-700"],
                          ["Cost", costVal, "text-red-700"],
                          ["Net Profit", netVal, parseN(netVal) >= 0 ? "text-emerald-700" : "text-red-700"],
                          ["Margin %", fmtPct(marginVal), parseN(marginVal) >= 0 ? "text-indigo-700" : "text-red-700"],
                        ].map(([lbl, val, color]) => (
                          <div key={lbl} className="flex justify-between items-center py-1 border-b border-slate-100">
                            <span className=" text-xs text-slate-500">{lbl}</span>
                            <span className={`text-x font-semibold tabular-nums ${color}`}>{typeof val === "string" ? val : fmtK(val)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>

              {compData.comparison_table && (() => {
                const isDrivers = compareMode === "drivers";
                const isMonthly = compView === "monthly";
                // Quarterly and Monthly render through the exact same table
                // below — Monthly just swaps in month-split rows instead of
                // quarter-total rows — so toggling it visibly changes what's
                // on screen instead of silently adding a second table further
                // down the page that's easy to miss.
                const table = isDrivers ? buildDriverComparisonRows(compData.scenarios)
                  : isMonthly ? buildMonthlyComparisonRows(compData)
                  : compData.comparison_table;
                if (!table.length) return null;
                const cols = Object.keys(table[0]).filter((k) => k !== "metric");
                const refCol = pickReferenceColumn(cols);
                const isVariance = compareMode === "variance_dollar" || compareMode === "variance_pct";

                const cellDisplay = (row, k) => {
                  const raw = row[k];
                  if (raw == null) return { text: "—", color: "text-slate-300" };
                  const isPctRow = row.metric.startsWith("Profit Margin %");
                  const num = parseN(raw);

                  if (isDrivers) {
                    return { text: fmt(num), color: "text-slate-700" };
                  }
                  if (compareMode === "absolute" || k === refCol) {
                    const color = row.metric.startsWith("Revenue") ? "text-sky-700" : row.metric.startsWith("Cost") ? "text-red-700"
                      : row.metric.startsWith("Net Profit") ? (num >= 0 ? "text-emerald-700" : "text-red-700")
                      : isPctRow ? (num >= 0 ? "text-indigo-700" : "text-red-700") : "text-slate-700";
                    return { text: isPctRow ? fmtPct(num) : fmtK(num), color, suffix: isVariance && k === refCol ? " (ref)" : "" };
                  }
                  const refNum = parseN(row[refCol]);
                  const delta = num - refNum;
                  const color = delta === 0 ? "text-slate-400" : delta > 0 ? "text-emerald-700" : "text-red-700";
                  const sign = delta > 0 ? "+" : "";
                  if (compareMode === "variance_dollar") {
                    return { text: `${sign}${isPctRow ? `${delta.toFixed(2)}pp` : fmtK(delta)}`, color };
                  }
                  // variance_pct: a percentage row already IS a percentage, so
                  // showing "% change of a %" is confusing — show the
                  // percentage-point difference instead, same as $ mode.
                  if (isPctRow) return { text: `${sign}${delta.toFixed(2)}pp`, color };
                  const pct = refNum ? (delta / Math.abs(refNum)) * 100 : 0;
                  return { text: `${sign}${pct.toFixed(2)}%`, color };
                };

                return (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-4">
                    <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-s font-bold text-slate-900">
                        {isDrivers ? "Drivers / Assumptions Comparison" : isMonthly ? "Monthly Comparison" : "Quarterly Comparison"}
                      </span>
                      <button
                        onClick={() => exportComparisonCSV({ comparison_table: table }, year, quarter)}
                        className="px-3 py-1.5 rounded-lg bg-sky-50 border border-sky-100 text-sky-700 text-x font-semibold hover:bg-sky-100"
                      >
                        Export CSV
                      </button>
                    </div>
                    <div className="analytics-table-scroll overflow-x-auto">
                      <table className="w-full border-collapse text-s">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-4 py-3 text-left  text-xs font-semibold uppercase tracking-wide text-slate-500">Metric</th>
                            {cols.map((k) => (
                              <th key={k} className="px-4 py-3 text-right  text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {k.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {table.map((row, ri) => (
                            <tr key={row.metric} className={ri % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
                              <td className="px-4 py-3 font-semibold text-slate-900">{row.metric}</td>
                              {cols.map((k) => {
                                const { text, color, suffix } = cellDisplay(row, k);
                                return (
                                  <td key={k} className={`px-4 py-3 text-right tabular-nums text-s font-semibold ${color}`}>
                                    {text}{suffix}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          )
        )}

        {activeTab === "drivers" && (
          loadingSc ? <TableSkeleton columns={4} rows={6} /> : (
            <div>
              <div className="flex gap-2 mb-4 flex-wrap items-center">
                <select value={drvScenario} onChange={(e) => setDrvScenario(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-x text-slate-900 bg-white outline-none">
                  <option value="all">All Scenarios</option>
                  {scenarios.map((s) => (
                    <option key={s.scenario_name} value={s.scenario_name}>{s.scenario_name}</option>
                  ))}
                </select>

                <select value={drvType} onChange={(e) => setDrvType(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-x text-slate-900 bg-white outline-none">
                  <option value="all">Revenue + Cost</option>
                  <option value="revenue">Revenue Drivers</option>
                  <option value="cost">Cost Drivers</option>
                </select>

                <select value={drvMonth} onChange={(e) => setDrvMonth(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-x text-slate-900 bg-white outline-none">
                  <option value="all">All Months</option>
                  {months.map((m) => (
                    <option key={m} value={m}>{monthLabel(m)}</option>
                  ))}
                </select>
              </div>

              {scenarios
                .filter((s) => drvScenario === "all" || s.scenario_name === drvScenario)
                .map((sc) => {
                  const t = getTheme(sc, customIndex(sc));
                  const revRows = (drvMonth === "all" ? sc.revenue_drivers : sc.revenue_drivers?.filter((d) => d.month === drvMonth)) || [];
                  const costRows = (drvMonth === "all" ? sc.cost_drivers : sc.cost_drivers?.filter((d) => d.month === drvMonth)) || [];
                  const showRev = drvType !== "cost" && revRows.length > 0;
                  const showCost = drvType !== "revenue" && costRows.length > 0;
                  if (!showRev && !showCost) return null;

                  const pivotDrivers = (rows) => {
                    const names = [...new Set(rows.map((d) => d.driver_name))];
                    return names.map((dn) => ({
                      name: dn,
                      vals: Object.fromEntries(rows.filter((d) => d.driver_name === dn).map((d) => [d.month, d.driver_value])),
                    }));
                  };

                  const revPivot = pivotDrivers(sc.revenue_drivers || []);
                  const costPivot = pivotDrivers(sc.cost_drivers || []);
                  const monthsToShow = drvMonth === "all" ? months : [drvMonth];

                  // Build bar chart data: one entry per month, keys = driver names
                  const revChartData = monthsToShow.map((m) => ({
                    month: monthLabel(m),
                    ...Object.fromEntries(revPivot.map(({ name, vals }) => [driverLabel(name), vals[m] ?? 0])),
                  }));
                  const costChartData = monthsToShow.map((m) => ({
                    month: monthLabel(m),
                    ...Object.fromEntries(costPivot.map(({ name, vals }) => [driverLabel(name), vals[m] ?? 0])),
                  }));

                  const REV_COLORS = ["#0ea5e9", "#38bdf8", "#7dd3fc", "#bae6fd"];
                  const COST_COLORS = ["#ef4444", "#f87171", "#fca5a5", "#fecaca"];

                  return (
                    <div key={sc.scenario_name} className="bg-white rounded-xl border border-slate-200 mb-3 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="text-s">{t.icon}</span>
                          <span className="text-s font-bold text-slate-900">{sc.scenario_name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-md border font-semibold ${t.badge}`}>{sc.is_system ? "System" : "Custom"}</span>
                        </div>
                      </div>

                      {showRev && (
                        <div className="flex gap-4 px-4 pb-3 pt-3">
                          {/* Table */}
                          <div className="analytics-table-scroll w-[60%] min-w-0 overflow-x-auto">
                            <div className="text-xs font-semibold uppercase tracking-wide text-sky-700 pb-1">Revenue Drivers</div>
                            <table className="w-full border-collapse text-s">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Driver</th>
                                  {monthsToShow.map((m) => (
                                    <th key={m} className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">{monthLabel(m)}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {revPivot.map(({ name, vals }) => (
                                  <tr key={name} className="border-b border-slate-100">
                                    <td className="px-3 py-2 font-semibold text-slate-900">{driverLabel(name)}</td>
                                    {monthsToShow.map((m) => (
                                      <td key={m} className="px-3 py-2 text-right tabular-nums text-sky-700 font-semibold">{vals[m] != null ? fmt(vals[m]) : "-"}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {/* Bar Chart */}
                          <div className="w-[40%] flex-shrink-0">
                            <div className="text-xs font-semibold uppercase tracking-wide text-sky-700 pb-1">Chart</div>
                            <ResponsiveContainer width="100%" height={160}>
                              <BarChart data={revChartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={36} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(getDecimalPrecision())}k` : v} />
                                <Tooltip formatter={(v, n) => [fmt(v), n]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                {revPivot.map(({ name }, i) => (
                                  <Bar key={name} dataKey={driverLabel(name)} fill={REV_COLORS[i % REV_COLORS.length]} radius={[2, 2, 0, 0]} maxBarSize={18} />
                                ))}
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      {showCost && (
                        <div className="flex gap-4 px-4 pb-3 pt-2">
                          {/* Table */}
                          <div className="analytics-table-scroll w-[60%] min-w-0 overflow-x-auto">
                            <div className="text-xs font-semibold uppercase tracking-wide text-red-700 pb-1">Cost Drivers</div>
                            <table className="w-full border-collapse text-s">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Driver</th>
                                  {monthsToShow.map((m) => (
                                    <th key={m} className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">{monthLabel(m)}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {costPivot.map(({ name, vals }) => (
                                  <tr key={name} className="border-b border-slate-100">
                                    <td className="px-3 py-2 font-semibold text-slate-900">{driverLabel(name)}</td>
                                    {monthsToShow.map((m) => (
                                      <td key={m} className="px-3 py-2 text-right tabular-nums text-red-700 font-semibold">{vals[m] != null ? fmtK(vals[m]) : "-"}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {/* Bar Chart */}
                          <div className="w-[40%] flex-shrink-0">
                            <div className="text-xs font-semibold uppercase tracking-wide text-red-700 pb-1">Chart</div>
                            <ResponsiveContainer width="100%" height={160}>
                              <BarChart data={costChartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={36} tickFormatter={(v) => { const a = Math.abs(v); return a >= 1e6 ? `${(v/1e6).toFixed(getDecimalPrecision())}M` : a >= 1000 ? `${(v/1000).toFixed(getDecimalPrecision())}k` : v; }} />
                                <Tooltip formatter={(v, n) => [fmtK(v), n]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                {costPivot.map(({ name }, i) => (
                                  <Bar key={name} dataKey={driverLabel(name)} fill={COST_COLORS[i % COST_COLORS.length]} radius={[2, 2, 0, 0]} maxBarSize={18} />
                                ))}
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )
        )}


        {activeTab === "comments" && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                <div className="text-s font-bold text-slate-900">
                  Comments <span className="ml-1.5 bg-sky-50 border border-sky-100 text-sky-700 text-xs font-semibold px-2 py-0.5 rounded-full">{comments.length}</span>
                </div>
                <div className="flex gap-2">
                  <select value={cmtTypeFilter} onChange={(e) => setCmtTypeFilter(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-x text-slate-900 bg-white outline-none">
                    <option value="">All Types</option>
                    <option value="general">General</option>
                    <option value="transition">Transition</option>
                    <option value="rejection">Rejection</option>
                  </select>
                  <button onClick={fetchComments} className="bg-sky-50 border border-sky-100 text-sky-700 px-3 py-1.5 rounded-lg text-x font-semibold">Refresh</button>
                </div>
              </div>

              <div className="p-4 max-h-[60vh] overflow-y-auto">
                {loadingCmt ? (
                  <Spin label="Loading comments..." />
                ) : comments.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    <div className="text-2xl mb-2">💬</div>
                    <div>No comments yet</div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {comments.map((c, i) => {
                      const avatarClass = AVATAR_CLASSES[i % AVATAR_CLASSES.length];
                      const typeClass =
                        c.comment_type === "transition"
                          ? "bg-emerald-50 text-emerald-700"
                          : c.comment_type === "rejection"
                          ? "bg-red-50 text-red-700"
                          : "bg-sky-50 text-sky-700";

                      return (
                        <div key={`${c.created_at || i}-${i}`} className="flex gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${avatarClass}`}>
                            {initials(c.created_by || c.user || "U")}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-semibold text-slate-900 text-s">{c.created_by || "User"}</span>
                              {c.comment_type && (
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeClass}`}>
                                  {(c.comment_type || "").charAt(0).toUpperCase() + (c.comment_type || "").slice(1)}
                                </span>
                              )}
                              {c.created_at && <span className=" text-xs text-slate-400">{new Date(c.created_at).toLocaleString()}</span>}
                            </div>
                            <div className="text-s text-slate-700 leading-relaxed">{c.comment}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden self-start">
              <div className="px-4 py-3 border-b border-slate-200 text-s font-bold text-slate-900">Post Comment</div>
              <div className="p-4 flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Comment</label>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={5}
                    placeholder="Add your comment, observation, or flag about the scenario modeling..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-s resize-y outline-none focus:border-sky-500"
                  />
                </div>
                <button
                  onClick={handlePostComment}
                  disabled={postingCmt}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-s font-semibold disabled:opacity-60"
                >
                  {postingCmt ? "Posting..." : "Post Comment"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer summary bar hidden on request
        {scenariosData && (
          <div className="mt-4 px-4 py-2.5 bg-white rounded-xl border border-slate-200  text-xs text-slate-500 tabular-nums flex gap-4 flex-wrap">
            <span>Year: <strong className="text-slate-700">{year}</strong></span>
            <span>Quarter: <strong className="text-slate-700">{quarter}</strong></span>
            <span>Stage: <strong className="text-sky-700">{STAGE_LABEL[stage]}</strong></span>
            <span>Total: <strong className="text-slate-700">{scenariosData.total_scenarios}</strong></span>
            <span>System: <strong className="text-emerald-700">{scenariosData.system_scenarios_count}</strong></span>
            <span>Custom: <strong className="text-indigo-700">{scenariosData.custom_scenarios_count}</strong></span>
            {finalScenario && <span>Final: <strong className="text-emerald-700">{finalScenario}</strong></span>}
          </div>
        )}
        */}
      </main>
    </div>
  );
}

