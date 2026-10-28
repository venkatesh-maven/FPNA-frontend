import React, { useState, useCallback, useEffect, useMemo, useContext, useRef } from "react";
import { AuthContext } from "../../context/AuthContext";
import { BudgetYearContext } from "../../context/BudgetYearContext";
import { API_BASE_URL } from "../../config/config";
import {
  FiAlertTriangle, FiCheckCircle, FiMinus,
  FiRefreshCw, FiSliders, FiBarChart2, FiList, FiDownload,
} from "react-icons/fi";
import TableSkeleton from "../Skeleton/TableSkeleton";

const API = `${API_BASE_URL}/api/v1/forecasting/managemet/scenario-modeling`;

const CURRENCY_FILTER_OPTIONS = [
  { value: "actualvalue", label: "Actual" },
  { value: "thousands",   label: "Thousands (K)" },
  { value: "millions",    label: "Millions (M)" },
];

const TABS = [
  { id: "monthly",     label: "Monthly Trend",        icon: FiList },
  { id: "scenarios",   label: "Scenario Comparison",  icon: FiBarChart2 },
  { id: "sensitivity", label: "Sensitivity Analysis", icon: FiSliders },
];

const STATUS_CONFIG = {
  above_break_even: { label: "Above Break-Even", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500", icon: FiCheckCircle },
  at_break_even:    { label: "At Break-Even",    color: "text-amber-700",   bg: "bg-amber-50 border-amber-200",   dot: "bg-amber-500",   icon: FiMinus },
  below_break_even: { label: "Below Break-Even", color: "text-red-700",     bg: "bg-red-50 border-red-200",       dot: "bg-red-500",     icon: FiAlertTriangle },
};

function parseNum(v) {
  if (v == null) return NaN;
  const n = typeof v === "string" ? parseFloat(v.replace(/,/g, "")) : Number(v);
  return n;
}

// Resolves the "Avail. Hrs / Month" input to a positive number, falling
// back to the 160 default when the field is empty/invalid (e.g. while the
// user is mid-edit) instead of sending an empty/NaN value to the backend.
export function resolveAvailHours(value) {
  const n = parseNum(value);
  return Number.isFinite(n) && n > 0 ? n : 160;
}

function fmt(v, cf = "actualvalue") {
  if (v == null) return "—";
  const n = parseNum(v);
  if (isNaN(n)) return "—";
  if (cf === "millions")  return (n / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "M";
  if (cf === "thousands") return (n / 1_000).toLocaleString(undefined,     { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "K";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(v) {
  if (v == null) return "—";
  const n = parseNum(v);
  if (isNaN(n)) return "—";
  return (n * 100).toFixed(1) + "%";
}

function KpiSkeleton() {
  return <div className="mb-4"><TableSkeleton columns={6} rows={2} /></div>;
}

function MonthStripSkeleton() {
  return <div className="mb-4"><TableSkeleton columns={12} rows={1} /></div>;
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.at_break_even;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
}

export default function BreakEvenAnalysis() {
  const { token, selectedCurrency } = useContext(AuthContext);
  const { budgetYear, fiscalYearStartMonth } = useContext(BudgetYearContext);
  const year     = budgetYear - 1;
  const currency = selectedCurrency;

  // ── Controls ────────────────────────────────────────────────────────────────
  const [cf,               setCf]               = useState("actualvalue");
  const [selectedScenario, setSelectedScenario] = useState("");
  const [fixedCostPct,     setFixedCostPct]     = useState(60);   // 0–100
  const [availHours,       setAvailHours]       = useState(160);

  // Driver inputs — draft (what user types) vs applied (what hits the API)
  const [draftBillingRate,    setDraftBillingRate]    = useState("");
  const [draftPricePerUnit,   setDraftPricePerUnit]   = useState("");
  const [draftVarCostPerUnit, setDraftVarCostPerUnit] = useState("");
  const [draftRevPerCustomer, setDraftRevPerCustomer] = useState("");
  const [draftRevPerProject,  setDraftRevPerProject]  = useState("");

  const [billingRate,      setBillingRate]      = useState("");
  const [pricePerUnit,     setPricePerUnit]     = useState("");
  const [varCostPerUnit,   setVarCostPerUnit]   = useState("");
  const [revPerCustomer,   setRevPerCustomer]   = useState("");
  const [revPerProject,    setRevPerProject]    = useState("");

  const driverInputsDirty =
    draftBillingRate    !== billingRate    ||
    draftPricePerUnit   !== pricePerUnit   ||
    draftVarCostPerUnit !== varCostPerUnit ||
    draftRevPerCustomer !== revPerCustomer ||
    draftRevPerProject  !== revPerProject;

  const applyDriverInputs = () => {
    setBillingRate(draftBillingRate);
    setPricePerUnit(draftPricePerUnit);
    setVarCostPerUnit(draftVarCostPerUnit);
    setRevPerCustomer(draftRevPerCustomer);
    setRevPerProject(draftRevPerProject);
  };

  const clearDriverInputs = () => {
    setDraftBillingRate(""); setDraftPricePerUnit(""); setDraftVarCostPerUnit(""); setDraftRevPerCustomer(""); setDraftRevPerProject("");
    setBillingRate("");      setPricePerUnit("");      setVarCostPerUnit("");      setRevPerCustomer("");      setRevPerProject("");
  };
  const [activeTab,        setActiveTab]        = useState("monthly");

  // Sensitivity (local only — no extra API call)
  const [revAdj,  setRevAdj]  = useState(0);   // %
  const [costAdj, setCostAdj] = useState(0);   // %
  const [priceAdj,setPriceAdj]= useState(0);   // %

  // ── Data ────────────────────────────────────────────────────────────────────
  const [apiData,  setApiData]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const abortRef = useRef(null);

  const fetchData = useCallback(async () => {
    if (!year || !token || !currency) { setLoading(false); return; }
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setApiData(null);
    setError(null);
    try {
      const params = new URLSearchParams({
        currency,
        currency_filter: cf,
        fixed_cost_pct: (fixedCostPct / 100).toFixed(2),
        available_hours_per_month: resolveAvailHours(availHours),
      });
      if (selectedScenario) params.set("scenario_name", selectedScenario);
      if (billingRate)      params.set("avg_billing_rate", billingRate);
      if (pricePerUnit)     params.set("avg_price_per_unit", pricePerUnit);
      if (varCostPerUnit)   params.set("variable_cost_per_unit", varCostPerUnit);
      if (revPerCustomer)   params.set("avg_revenue_per_customer", revPerCustomer);
      if (revPerProject)    params.set("avg_revenue_per_project", revPerProject);

      const res = await fetch(`${API}/${year}/break-even-analysis?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setApiData(data);
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [year, currency, cf, selectedScenario, fixedCostPct, billingRate, pricePerUnit, varCostPerUnit, availHours, revPerCustomer, revPerProject, token, fiscalYearStartMonth]); // eslint-disable-line

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // ── Sensitivity-adjusted data (pure client-side, instant) ──────────────────
  const adjData = useMemo(() => {
    if (!apiData) return null;
    if (revAdj === 0 && costAdj === 0 && priceAdj === 0) return apiData;

    const fcp    = apiData.fixed_cost_pct ?? 0.6;
    const rMul   = 1 + revAdj   / 100;
    const cMul   = 1 + costAdj  / 100;
    const pMul   = 1 + priceAdj / 100;

    const adjTrend = apiData.monthly_trend.map(row => {
      const rev   = (parseNum(row.forecast_revenue) || 0) * rMul * pMul;
      const costs = (parseNum(row.total_costs)       || 0) * cMul;
      const fixed = isNaN(parseNum(row.fixed_costs))    ? costs * fcp         : parseNum(row.fixed_costs) * cMul;
      const varC  = isNaN(parseNum(row.variable_costs)) ? costs * (1 - fcp)   : parseNum(row.variable_costs) * cMul;
      const cmr   = rev > 0 ? Math.max(0, 1 - varC / rev) : 0;
      const bep   = cmr > 0 ? fixed / cmr : costs;
      const variance = rev - bep;
      const pl       = rev - costs;
      const st = rev >= bep * 1.001 ? "above_break_even"
               : rev >= bep * 0.999 ? "at_break_even"
               : "below_break_even";
      return { ...row, forecast_revenue: rev, total_costs: costs, fixed_costs: fixed,
               variable_costs: varC, break_even_revenue: bep, revenue_variance: variance,
               profit_loss: pl, contribution_margin_ratio: cmr, status: st };
    });

    const tRev  = adjTrend.reduce((s, r) => s + r.forecast_revenue,   0);
    const tCost = adjTrend.reduce((s, r) => s + r.total_costs,         0);
    const tBep  = adjTrend.reduce((s, r) => s + r.break_even_revenue,  0);
    const tPl   = tRev - tCost;
    const tVar  = tRev - tBep;
    const st    = tRev >= tBep * 1.001 ? "above_break_even"
                : tRev >= tBep * 0.999 ? "at_break_even"
                : "below_break_even";
    return {
      ...apiData,
      monthly_trend: adjTrend,
      summary: {
        ...apiData.summary,
        total_forecast_revenue:  tRev,
        total_forecast_costs:    tCost,
        total_break_even_revenue: tBep,
        total_revenue_variance:  tVar,
        total_profit_loss:       tPl,
        break_even_status:       st,
        months_above_break_even: adjTrend.filter(r => r.status === "above_break_even").length,
        months_below_break_even: adjTrend.filter(r => r.status === "below_break_even").length,
      },
    };
  }, [apiData, revAdj, costAdj, priceAdj]);

  // Recompute original summary from monthly_trend rows so it always has valid numbers
  // (backend may return formatted strings or null in summary for some currency modes)
  const originalSummary = useMemo(() => {
    if (!apiData?.monthly_trend?.length) return apiData?.summary ?? null;
    const trend = apiData.monthly_trend;
    const fcp   = apiData.fixed_cost_pct ?? 0.6;
    const tRev  = trend.reduce((s, r) => s + (parseNum(r.forecast_revenue) || 0), 0);
    const tCost = trend.reduce((s, r) => s + (parseNum(r.total_costs)       || 0), 0);
    const tBep  = trend.reduce((s, r) => s + (parseNum(r.break_even_revenue)|| 0), 0);
    const tFixed= trend.reduce((s, r) => s + (parseNum(r.fixed_costs)       || tCost * fcp / trend.length), 0);
    const tVar  = trend.reduce((s, r) => s + (parseNum(r.variable_costs)    || 0), 0);
    const tPl   = tRev - tCost;
    const tVarR = tRev - tBep;
    const st    = tRev >= tBep * 1.001 ? "above_break_even"
                : tRev >= tBep * 0.999 ? "at_break_even"
                : "below_break_even";
    return {
      ...(apiData.summary ?? {}),
      total_forecast_revenue:   tRev,
      total_forecast_costs:     tCost,
      total_fixed_costs:        tFixed,
      total_variable_costs:     tVar,
      total_break_even_revenue: tBep,
      total_revenue_variance:   tVarR,
      total_profit_loss:        tPl,
      break_even_status:        st,
      months_above_break_even:  trend.filter(r => r.status === "above_break_even").length,
      months_below_break_even:  trend.filter(r => r.status === "below_break_even").length,
      avg_contribution_margin_ratio: parseNum(apiData.summary?.avg_contribution_margin_ratio),
    };
  }, [apiData]);

  const d = adjData;
  const s = d?.summary;

  const scenarioOpts = useMemo(() => {
    if (!apiData?.available_scenarios) return [];
    return [
      { value: "", label: "Auto (Final / Baseline)" },
      ...apiData.available_scenarios
        .filter(sc => sc.scenario_name?.toLowerCase().replace(/ /g, "_") !== "base_case")
        .map(sc => ({
          value: sc.scenario_name,
          label: `${sc.scenario_name}${sc.is_final ? " ★ Final" : sc.scenario_type === "custom" ? " ✦" : ""}`,
        })),
    ];
  }, [apiData]);

  const monthLabel = p => {
    try { return new Date(p + "-01").toLocaleString("default", { month: "short", year: "2-digit" }); }
    catch { return p; }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="planning-compact min-h-screen bg-sky-50 text-sky-900">

      <header className="bg-gradient-to-r from-sky-950 via-sky-900 to-sky-700 rounded-xl px-4 py-2.5 md:px-6 sticky top-0 z-40 shadow-sm mb-2">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/25 bg-white/10">
              <FiBarChart2 color="#7dd3fc" size={18} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">Break-Even Analysis</h1>
              <p className="text-xs text-sky-300 tabular-nums">
                {year} · {currency}
                {d?.scenario_name && ` · ${d.scenario_name}`}
                {d?.is_final_scenario && " ★ Final"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {s && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-bold ${STATUS_CONFIG[s.break_even_status]?.bg} ${STATUS_CONFIG[s.break_even_status]?.color}`}>
                <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[s.break_even_status]?.dot}`} />
                {STATUS_CONFIG[s.break_even_status]?.label}
              </span>
            )}
            <button onClick={fetchData} disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-1 rounded-lg border border-white/25 bg-white/10 text-x font-semibold text-white hover:bg-white/20 transition-colors disabled:opacity-50">
              <FiRefreshCw size={12} className={loading ? "animate-spin" : ""} />
              {loading ? "Loading…" : "Refresh"}
            </button>
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-1 rounded-lg border border-white/25 bg-white/10 text-x font-semibold text-white hover:bg-white/20 transition-colors">
              <FiDownload size={12} /> Export
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-4">

        {/* Filter bar */}
        <div className="bg-white rounded-xl border border-sky-100 shadow-sm px-4 py-2 mb-2 text-s">
          {/* Primary filters row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <div className="flex items-center gap-2">
              <label className="font-semibold text-sky-700 whitespace-nowrap">Display</label>
              <select value={cf} onChange={e => setCf(e.target.value)}
                className="px-3 py-1 rounded-lg bg-white border border-sky-200 text-sky-900 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200">
                {CURRENCY_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="font-semibold text-sky-700 whitespace-nowrap">Scenario</label>
              <select value={selectedScenario} onChange={e => setSelectedScenario(e.target.value)}
                className="px-3 py-1 rounded-lg bg-white border border-sky-200 text-sky-900 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200">
                {scenarioOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="font-semibold text-sky-700 whitespace-nowrap">Fixed Cost %</label>
              <input type="range" min={0} max={100} step={5} value={fixedCostPct}
                onChange={e => setFixedCostPct(Number(e.target.value))}
                className="w-24 accent-sky-600" />
              <span className="text-sky-700 font-bold text-x w-9">{fixedCostPct}%</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <label className="font-semibold text-sky-700 whitespace-nowrap">Avail. Hrs / Month</label>
              <input type="number" value={availHours}
                onFocus={e => e.target.select()}
                onChange={e => setAvailHours(e.target.value)}
                min={1} step={8} placeholder="160"
                className="w-20 px-2 py-1 rounded-lg border border-sky-200 text-sky-900 text-x font-semibold outline-none focus:ring-2 focus:ring-sky-200" />
            </div>
          </div>
          {/* Advanced driver filters row */}
          <div className="mt-1.5 pt-1.5 border-t border-sky-50 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">Driver Inputs</span>
            {[
              { label: "Billing Rate / hr",   val: draftBillingRate,    set: setDraftBillingRate,    placeholder: "e.g. 100" },
              { label: "Price / Unit",         val: draftPricePerUnit,   set: setDraftPricePerUnit,   placeholder: "e.g. 500" },
              { label: "Var Cost / Unit",      val: draftVarCostPerUnit, set: setDraftVarCostPerUnit, placeholder: "e.g. 200" },
              { label: "Rev / Customer / Mo",  val: draftRevPerCustomer, set: setDraftRevPerCustomer, placeholder: "e.g. 5000" },
              { label: "Rev / Project",        val: draftRevPerProject,  set: setDraftRevPerProject,  placeholder: "e.g. 20000" },
            ].map(inp => (
              <div key={inp.label} className="flex items-center gap-1.5">
                <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">{inp.label}</label>
                <input type="number" value={inp.val}
                  onFocus={e => e.target.select()}
                  onChange={e => inp.set(e.target.value)}
                  placeholder={inp.placeholder}
                  className="w-24 px-2 py-1 rounded-lg border border-slate-200 text-x text-slate-800 bg-white outline-none focus:ring-2 focus:ring-sky-200" />
              </div>
            ))}
            {driverInputsDirty && (
              <button onClick={applyDriverInputs}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 transition-colors shadow-sm">
                Calculate
              </button>
            )}
            {(billingRate || pricePerUnit || varCostPerUnit || revPerCustomer || revPerProject ||
              draftBillingRate || draftPricePerUnit || draftVarCostPerUnit || draftRevPerCustomer || draftRevPerProject) && (
              <button onClick={clearDriverInputs}
                className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200">
                Clear
              </button>
            )}
          </div>
        </div>

        {/* No currency selected */}
        {!currency && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 text-x rounded-xl px-4 py-2 mb-2">
            Please select a currency from the top navigation to load Break-Even Analysis.
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-x rounded-xl px-4 py-2 mb-2">
            Error: {error}
          </div>
        )}

        {/* KPI cards */}
        {(loading || !s) && !error && currency ? <KpiSkeleton /> : s && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2 mb-2">
            {[
              { label: "Break-Even Revenue",   val: s.total_break_even_revenue, sub: "Annual threshold",     color: "border-sky-300",     bg: "bg-sky-50",     vcolor: "text-sky-800" },
              { label: "Forecast Revenue",      val: s.total_forecast_revenue,   sub: "Annual forecast",      color: "border-emerald-300", bg: "bg-emerald-50", vcolor: "text-emerald-800" },
              { label: "Revenue Variance",      val: s.total_revenue_variance,   sub: "Forecast vs BEP",      color: (parseNum(s.total_revenue_variance) || 0) >= 0 ? "border-emerald-300" : "border-red-300", bg: (parseNum(s.total_revenue_variance) || 0) >= 0 ? "bg-emerald-50" : "bg-red-50", vcolor: (parseNum(s.total_revenue_variance) || 0) >= 0 ? "text-emerald-800" : "text-red-700" },
              { label: "Total Costs",           val: s.total_forecast_costs,     sub: "Fixed + Variable",     color: "border-slate-300",   bg: "bg-slate-50",   vcolor: "text-slate-800" },
              { label: "Net Profit / Loss",     val: s.total_profit_loss,        sub: "Revenue minus costs",  color: (parseNum(s.total_profit_loss) || 0) >= 0 ? "border-emerald-300" : "border-red-300", bg: (parseNum(s.total_profit_loss) || 0) >= 0 ? "bg-emerald-50" : "bg-red-50", vcolor: (parseNum(s.total_profit_loss) || 0) >= 0 ? "text-emerald-800" : "text-red-700" },
              { label: "Contribution Margin",   val: null, raw: pct(s.avg_contribution_margin_ratio), sub: "Avg annual CMR",   color: "border-indigo-300", bg: "bg-indigo-50",  vcolor: "text-indigo-800" },
            ].map((c, i) => (
              <div key={i} className={`${c.bg} border ${c.color} rounded-xl px-3 py-2 min-w-0`}>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5 truncate">{c.label}</p>
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className={`text-base font-bold ${c.vcolor} leading-tight whitespace-nowrap`}>
                    {c.raw ?? fmt(c.val, cf)}
                  </span>
                  <span className="text-[11px] text-slate-400 truncate" title={c.sub}>{c.sub}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Month status strip */}
        {(loading || !d?.monthly_trend) && !error && currency ? <MonthStripSkeleton /> : d?.monthly_trend && (
          <div className="bg-white rounded-xl border border-sky-100 shadow-sm px-4 py-2 mb-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Monthly Break-Even Status</p>
            <div className="flex gap-1.5 flex-wrap">
              {d.monthly_trend.map(r => {
                const cfg = STATUS_CONFIG[r.status];
                return (
                  <div key={r.period} title={`${monthLabel(r.period)}: ${r.status.replace(/_/g," ")}`}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border ${cfg.bg} cursor-default`}>
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    <span className={`text-xs font-bold ${cfg.color}`}>{monthLabel(r.period)}</span>
                  </div>
                );
              })}
              <div className="ml-auto flex items-center gap-3 text-xs">
                {[["above_break_even","Months Above"], ["below_break_even","Months Below"]].map(([k,lbl]) => (
                  <span key={k} className={`flex items-center gap-1 font-semibold ${STATUS_CONFIG[k].color}`}>
                    <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[k].dot}`} />
                    {lbl}: {k === "above_break_even" ? s?.months_above_break_even : s?.months_below_break_even}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-sky-100 shadow-sm overflow-hidden mb-6">
          <div className="flex border-b border-sky-100 overflow-x-auto">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-x font-semibold whitespace-nowrap transition-colors ${
                    activeTab === t.id
                      ? "text-sky-700 border-b-2 border-sky-600 bg-sky-50"
                      : "text-slate-500 hover:text-sky-700 hover:bg-sky-50"
                  }`}>
                  <Icon size={13} /> {t.label}
                </button>
              );
            })}
          </div>

          <div className="p-4">

            {/* ── Monthly Trend ── */}
            {activeTab === "monthly" && (
              (loading || !d?.monthly_trend) && !error && currency ? <TableSkeleton columns={10} rows={12} /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-x">
                  <thead>
                    <tr className="bg-sky-50 text-sky-700">
                      {["Month","Forecast Revenue","BEP Revenue","Revenue Variance","Total Costs","Fixed Costs","Variable Costs","Profit / Loss","CMR","Status"].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-xs uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(d?.monthly_trend || []).map((r, i) => {
                      const cfg = STATUS_CONFIG[r.status];
                      return (
                        <tr key={r.period} className={`border-t border-slate-100 ${i % 2 === 0 ? "" : "bg-slate-50"}`}>
                          <td className="px-3 py-2 font-semibold text-slate-700">{monthLabel(r.period)}</td>
                          <td className="px-3 py-2 text-emerald-700 font-semibold">{fmt(r.forecast_revenue, cf)}</td>
                          <td className="px-3 py-2 text-sky-700 font-semibold">{fmt(r.break_even_revenue, cf)}</td>
                          <td className={`px-3 py-2 font-semibold ${(parseNum(r.revenue_variance) || 0) >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmt(r.revenue_variance, cf)}</td>
                          <td className="px-3 py-2 text-slate-600">{fmt(r.total_costs, cf)}</td>
                          <td className="px-3 py-2 text-slate-500">{fmt(r.fixed_costs, cf)}</td>
                          <td className="px-3 py-2 text-slate-500">{fmt(r.variable_costs, cf)}</td>
                          <td className={`px-3 py-2 font-semibold ${(parseNum(r.profit_loss) || 0) >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmt(r.profit_loss, cf)}</td>
                          <td className="px-3 py-2 text-indigo-700">{pct(r.contribution_margin_ratio)}</td>
                          <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {s && (
                    <tfoot>
                      <tr className="bg-sky-50 border-t-2 border-sky-200 font-bold">
                        <td className="px-3 py-2 text-sky-800">Annual Total</td>
                        <td className="px-3 py-2 text-emerald-800">{fmt(s.total_forecast_revenue, cf)}</td>
                        <td className="px-3 py-2 text-sky-800">{fmt(s.total_break_even_revenue, cf)}</td>
                        <td className={`px-3 py-2 ${s.total_revenue_variance >= 0 ? "text-emerald-800" : "text-red-700"}`}>{fmt(s.total_revenue_variance, cf)}</td>
                        <td className="px-3 py-2 text-slate-700">{fmt(s.total_forecast_costs, cf)}</td>
                        <td className="px-3 py-2 text-slate-600">{fmt(s.total_fixed_costs, cf)}</td>
                        <td className="px-3 py-2 text-slate-600">{fmt(s.total_variable_costs, cf)}</td>
                        <td className={`px-3 py-2 ${s.total_profit_loss >= 0 ? "text-emerald-800" : "text-red-700"}`}>{fmt(s.total_profit_loss, cf)}</td>
                        <td className="px-3 py-2 text-indigo-700">{pct(s.avg_contribution_margin_ratio)}</td>
                        <td className="px-3 py-2"><StatusBadge status={s.break_even_status} /></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              )
            )}

            {/* ── Scenario Comparison ── */}
            {activeTab === "scenarios" && (
              (loading || !d?.scenario_comparison) && !error && currency ? <TableSkeleton columns={7} rows={8} /> :
              <div className="overflow-x-auto">
                {(!d?.scenario_comparison?.length) ? (
                  <div className="text-center py-12 text-slate-400">
                    <div className="text-2xl mb-2">📊</div>
                    <div className="text-x">No scenarios available for comparison.</div>
                  </div>
                ) : (
                  <table className="w-full text-x">
                    <thead>
                      <tr className="bg-sky-50 text-sky-700">
                        {["Scenario","Forecast Revenue","BEP Revenue","Revenue Variance","Total Costs","Profit / Loss","Status"].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-xs uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {d.scenario_comparison.map((sc, i) => (
                        <tr key={sc.scenario_name}
                          className={`border-t border-slate-100 ${sc.is_active ? "bg-sky-50 ring-1 ring-inset ring-sky-300" : i % 2 === 0 ? "" : "bg-slate-50"}`}>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-800">{sc.scenario_name}</span>
                              {sc.is_final  && <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200">★ Final</span>}
                              {sc.is_active && <span className="px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 text-xs font-bold border border-sky-200">Active</span>}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-emerald-700 font-semibold">{fmt(sc.forecast_revenue, cf)}</td>
                          <td className="px-3 py-2 text-sky-700 font-semibold">{fmt(sc.break_even_revenue, cf)}</td>
                          <td className={`px-3 py-2 font-semibold ${Number(sc.revenue_variance) >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmt(sc.revenue_variance, cf)}</td>
                          <td className="px-3 py-2 text-slate-600">{fmt(sc.total_costs, cf)}</td>
                          <td className={`px-3 py-2 font-semibold ${Number(sc.profit_loss) >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmt(sc.profit_loss, cf)}</td>
                          <td className="px-3 py-2"><StatusBadge status={sc.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── Sensitivity Analysis ── */}
            {activeTab === "sensitivity" && (
              (loading || !apiData) && !error && currency ? (
                <TableSkeleton columns={3} rows={6} />
              ) :
              <div className="space-y-6">
                <p className="text-x text-slate-500">Adjust assumptions below to instantly see the impact on break-even without changing the saved forecast.</p>

                {/* Sliders */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { label: "Revenue Adjustment", val: revAdj,  set: setRevAdj,  color: "accent-emerald-600" },
                    { label: "Cost Adjustment",     val: costAdj, set: setCostAdj, color: "accent-red-500" },
                    { label: "Price Adjustment",    val: priceAdj,set: setPriceAdj,color: "accent-sky-600" },
                  ].map(sl => (
                    <div key={sl.label} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-x font-semibold text-slate-700">{sl.label}</span>
                        <span className={`text-sm font-bold ${sl.val > 0 ? "text-emerald-600" : sl.val < 0 ? "text-red-600" : "text-slate-500"}`}>
                          {sl.val > 0 ? "+" : ""}{sl.val}%
                        </span>
                      </div>
                      <input type="range" min={-50} max={50} step={1} value={sl.val}
                        onChange={e => sl.set(Number(e.target.value))}
                        className={`w-full ${sl.color}`} />
                      <div className="flex justify-between text-xs text-slate-400 mt-1">
                        <span>-50%</span><span>0%</span><span>+50%</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Reset */}
                {(revAdj !== 0 || costAdj !== 0 || priceAdj !== 0) && (
                  <button onClick={() => { setRevAdj(0); setCostAdj(0); setPriceAdj(0); }}
                    className="px-4 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-x font-semibold hover:bg-slate-300">
                    Reset to Baseline
                  </button>
                )}

                {/* Before / After comparison */}
                {apiData && adjData && (
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Original",  src: originalSummary,  tag: "bg-slate-100 text-slate-600" },
                      { label: "Adjusted",  src: adjData.summary,  tag: "bg-sky-100 text-sky-700" },
                    ].map(col => (
                      <div key={col.label} className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className={`px-4 py-2 font-bold text-x ${col.tag}`}>{col.label}</div>
                        {[
                          ["Forecast Revenue",    col.src?.total_forecast_revenue],
                          ["BEP Revenue",         col.src?.total_break_even_revenue],
                          ["Revenue Variance",    col.src?.total_revenue_variance],
                          ["Net Profit / Loss",   col.src?.total_profit_loss],
                        ].map(([lbl, val]) => (
                          <div key={lbl} className="flex justify-between items-center px-4 py-2 border-t border-slate-100 text-x">
                            <span className="text-slate-500">{lbl}</span>
                            <span className={`font-semibold ${(parseNum(val) || 0) >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmt(val, cf)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between items-center px-4 py-2 border-t border-slate-100 text-x">
                          <span className="text-slate-500">Status</span>
                          <StatusBadge status={col.src?.break_even_status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Sensitivity monthly comparison */}
                {apiData && (revAdj !== 0 || costAdj !== 0 || priceAdj !== 0) && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-x">
                      <thead>
                        <tr className="bg-sky-50 text-sky-700">
                          {["Month","Orig Revenue","Adj Revenue","Orig BEP","Adj BEP","Orig P&L","Adj P&L","Status"].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold text-xs uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {apiData.monthly_trend.map((orig, i) => {
                          const adj = adjData.monthly_trend[i];
                          return (
                            <tr key={orig.period} className={`border-t border-slate-100 ${i % 2 === 0 ? "" : "bg-slate-50"}`}>
                              <td className="px-3 py-2 font-semibold text-slate-700">{monthLabel(orig.period)}</td>
                              <td className="px-3 py-2 text-slate-500">{fmt(orig.forecast_revenue, cf)}</td>
                              <td className="px-3 py-2 text-emerald-700 font-semibold">{fmt(adj.forecast_revenue, cf)}</td>
                              <td className="px-3 py-2 text-slate-500">{fmt(orig.break_even_revenue, cf)}</td>
                              <td className="px-3 py-2 text-sky-700 font-semibold">{fmt(adj.break_even_revenue, cf)}</td>
                              <td className={`px-3 py-2 ${(parseNum(orig.profit_loss) || 0) >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmt(orig.profit_loss, cf)}</td>
                              <td className={`px-3 py-2 font-semibold ${(parseNum(adj.profit_loss) || 0) >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmt(adj.profit_loss, cf)}</td>
                              <td className="px-3 py-2"><StatusBadge status={adj.status} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              )}

          </div>
        </div>
      </div>
    </div>
  );
}
