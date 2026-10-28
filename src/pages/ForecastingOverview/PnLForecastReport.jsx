import React, {
  useState,
  useCallback,
  useEffect,
  useContext,
  useRef,
  useMemo,
} from "react";
import {
  FiRefreshCw,
  FiDownload,
  FiTrendingUp,
  FiTrendingDown,
  FiBarChart2,
  FiDollarSign,
  FiActivity,
  FiAlertCircle,
  FiMinus,
  FiTarget,
} from "react-icons/fi";

import { AuthContext } from "../../context/AuthContext";
import { BudgetYearContext } from "../../context/BudgetYearContext";
import { API_BASE_URL } from "../../config/config";
import TableSkeleton from "../Skeleton/TableSkeleton";
import { getDecimalPrecision } from '../../utils/formatters';
import AIActionsMenu from "../FinancialReports/AIActionsMenu";
import AIHelpTooltip from "../FinancialReports/AIHelpTooltip";
import LineItemCommentary from "../FinancialReports/LineItemCommentary";
import LineItemRefineWithAI, { LineItemAIButton } from "../FinancialReports/LineItemRefineWithAI";
import ReportCommentary from "../FinancialReports/ReportCommentary";
import { buildReportAIContext, compactForAI, rankForAI } from "../FinancialReports/reportAIContext";
import useReportCommentary from "../../hooks/useReportCommentary";
import useLineItemCommentary from "../../hooks/useLineItemCommentary";

const API = `${API_BASE_URL}/api/v1/forecasting/managemet/pnl-forecast`;

const CURRENCY_FILTER_OPTIONS = [
  { value: "actualvalue", label: "Actual" },
  { value: "thousands",   label: "Thousands (K)" },
  { value: "millions",    label: "Millions (M)" },
];
const PERIOD_FILTER_OPTIONS = [
  { value: "monthly",   label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "ytd",       label: "Year to Date" },
];
// Maps a display scenario name → { scenario enum, custom_scenario_name? }
const SCENARIO_ENUM_MAP = {
  "Baseline":   { scenario: "baseline" },
  "Base Case":  { scenario: "baseline" },
  "Best Case":  { scenario: "bestcase" },
  "Worst Case": { scenario: "worstcase" },
};
function getScenarioApiParams(name) {
  return SCENARIO_ENUM_MAP[name] || { scenario: "baseline", custom_scenario_name: name };
}
const DEFAULT_SCENARIO_OPTIONS = [
  { value: "Baseline",   label: "Baseline",   type: "system" },
  { value: "Best Case",  label: "Best Case",  type: "system" },
  { value: "Worst Case", label: "Worst Case", type: "system" },
];
const COMPARISON_OPTIONS = [
  { value: "",                 label: "No Comparison" },
  { value: "previous_month",   label: "vs Previous Month" },
  { value: "previous_quarter", label: "vs Previous Quarter" },
  { value: "previous_year",    label: "vs Previous Year" },
  { value: "budget",           label: "Forecast vs Budget" },
];

// Picking a quarter shows just that quarter (quarterly figures).
const QUARTER_OPTIONS = [
  { value: "",   label: "All quarters" },
  { value: "Q1", label: "Q1" },
  { value: "Q2", label: "Q2" },
  { value: "Q3", label: "Q3" },
  { value: "Q4", label: "Q4" },
];
const PREVIOUS_QUARTER = { Q1: "Q4 last year", Q2: "Q1", Q3: "Q2", Q4: "Q3" };

// Comparison names spelled out for the quarter in view ("Q4 vs Q3").
function comparisonLabel(value, quarter) {
  if (quarter) {
    if (value === "previous_quarter") return `${quarter} vs ${PREVIOUS_QUARTER[quarter]}`;
    if (value === "previous_year")    return `${quarter} vs ${quarter} last year`;
    if (value === "budget")           return `${quarter} Forecast vs ${quarter} Budget`;
  }
  return COMPARISON_OPTIONS.find(o => o.value === value)?.label;
}

// Rows to display in the P&L table, in order
const PNL_ROWS = [
  { key: "revenue",           label: "Revenue",            shortLabel: "Revenue",       icon: FiTrendingUp,  accent: "#38bdf8", accentLight: "#e0f2fe", accentText: "#0369a1" },
  { key: "cogs",              label: "Cost of Goods Sold", shortLabel: "COGS",          icon: FiBarChart2,   accent: "#fb7185", accentLight: "#ffe4e6", accentText: "#be123c", lowerIsBetter: true },
  { key: "gross_profit",      label: "Gross Profit",       shortLabel: "Gross Profit",  icon: FiActivity,    accent: "#34d399", accentLight: "#d1fae5", accentText: "#065f46", dividerAbove: true },
  { key: "operating_expense", label: "Operating Expense",  shortLabel: "OpEx",          icon: FiBarChart2,   accent: "#a78bfa", accentLight: "#ede9fe", accentText: "#6d28d9", lowerIsBetter: true },
  { key: "actual_profit",     label: "Actual Profit",      shortLabel: "Actual Profit", icon: FiDollarSign,  accent: "#fbbf24", accentLight: "#fef3c7", accentText: "#92400e", dividerAbove: true },
  { key: "variance",          label: "Variance",           shortLabel: "Variance",      icon: FiActivity,    accent: "#6ee7b7", accentLight: "#d1fae5", accentText: "#047857", dividerAbove: true, isVariance: true },
];

// KPI cards — subset of rows that matter most at a glance
const KPI_KEYS = ["revenue", "gross_profit", "operating_expense", "actual_profit", "budget_profit", "variance"];

async function parseApiError(res) {
  const t = await res.text().catch(() => "");
  try { const j = JSON.parse(t); return j.detail || j.message || t || `HTTP ${res.status}`; }
  catch { return t || `HTTP ${res.status}`; }
}

function legacyFmtValue(val) {
  if (val == null) return "—";
  if (typeof val === "string") {
    const cleaned = val.trim().replace(/[$,\s]/g, "");
    if (!cleaned || cleaned === "—" || cleaned === "-") return "—";
    if (/[a-zA-Z%]/.test(cleaned)) return val;
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed)) return val;
    val = parsed;
  }
  const n = Number(val);
  if (!Number.isFinite(n)) return "—";
  const dp = getDecimalPrecision();
  return n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function unitSuffix(cf) {
  if (cf === "thousands") return " K";
  if (cf === "millions")  return " M";
  return "";
}

function scaleForDisplay(n, cf) {
  if (cf === "thousands") return n / 1_000;
  if (cf === "millions")  return n / 1_000_000;
  return n;
}

function fmtValue(val, cf) {
  if (val == null) return "—";
  const raw = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(raw)) return "—";
  const scaled = scaleForDisplay(raw, cf);
  return `${legacyFmtValue(scaled)}${unitSuffix(cf)}`;
}

function variancePct(curr, prev) {
  const c = Number(curr), p = Number(prev);
  if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0) return null;
  return ((c - p) / Math.abs(p)) * 100;
}

function VarChip({ curr, prev }) {
  const v = variancePct(curr, prev);
  if (v == null) return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500"><FiMinus size={8} />—</span>;
  const Icon = v > 0.01 ? FiTrendingUp : v < -0.01 ? FiTrendingDown : FiMinus;
  const cls  = v > 0.01 ? "bg-emerald-100 text-emerald-700" : v < -0.01 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500";
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      <Icon size={8} />{Math.abs(v).toFixed(getDecimalPrecision())}%
    </span>
  );
}

function sumField(rows, key) {
  return rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
}

function KpiCards({ rows, cf, scopeLabel = "Year total" }) {
  if (!rows?.length) return null;
  const totals = {};
  KPI_KEYS.forEach(k => { totals[k] = sumField(rows, k); });

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2 mb-2">
      {KPI_KEYS.map(k => {
        const cfg  = PNL_ROWS.find(r => r.key === k);
        if (!cfg) return null;
        const Icon = cfg.icon;
        const val  = totals[k];
        const isNeg = val < 0;
        return (
          <div key={k} className="min-w-0 rounded-xl border border-sky-100 bg-white px-3 py-2 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className="truncate text-xs font-semibold uppercase tracking-wider text-sky-500">{cfg.shortLabel}</span>
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-sky-100 bg-sky-50 text-sky-700">
                <Icon size={12} />
              </div>
            </div>
            <div className="flex items-baseline gap-2 min-w-0">
              <span className={`whitespace-nowrap text-base font-bold leading-tight ${isNeg ? "text-red-600" : "text-sky-900"}`}>
                {fmtValue(val, cf)}
              </span>
              <span className="truncate text-[11px] text-sky-400">{scopeLabel}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// `renderLineAction(cfg)` adds a control after each line's name (commentary).
function PnLTable({ rows, cf, comparison, renderLineAction }) {
  const isBudgetCompare = comparison === "budget";
  if (!rows?.length) return (
    <div className="py-16 text-center text-sky-400">
      <div className="mb-3 text-4xl opacity-25">📊</div>
      <p className="text-sm font-medium">No data available.</p>
    </div>
  );

  const HDR  = "#0c3557";
  const HDR2 = "#0f4a7a";

  const periods = rows.map(r => r.period);
  const hasCompare = rows.some(r => r.comparison && Object.keys(r.comparison).length > 0);

  const thStyle = (extra = {}) => ({
    padding: "9px 13px", color: "white", fontWeight: 600,
    fontSize: 12, letterSpacing: ".06em", textTransform: "uppercase",
    whiteSpace: "nowrap", textAlign: "right",
    borderRight: "1px solid rgba(255,255,255,.1)",
    ...extra,
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="overflow-auto max-h-[620px]">
        <table className="w-full border-collapse" style={{
          minWidth: Math.max(700, periods.length * (hasCompare ? 330 : 120) + 220),
        }}>
          <thead className="sticky top-0 z-20">
            <tr style={{ background: HDR }}>
              <th rowSpan={hasCompare ? 2 : 1} style={{
                padding: "12px 16px", textAlign: "left", color: "white",
                fontWeight: 700, fontSize: 12, letterSpacing: ".07em", textTransform: "uppercase",
                position: "sticky", left: 0, zIndex: 25, background: HDR,
                minWidth: 180, borderRight: "1px solid rgba(255,255,255,.15)",
                verticalAlign: "middle",
              }}>
                Metric
              </th>

              {hasCompare ? periods.map(p => {
                const cp = rows.find(r => r.period === p)?.comparison?.compare_period;
                return (
                  <th key={p} colSpan={3} style={{
                    padding: "10px 12px", textAlign: "center", color: "white",
                    fontWeight: 700, fontSize: 12, letterSpacing: ".04em",
                    borderRight: "2px solid rgba(255,255,255,.22)",
                    borderBottom: "1px solid rgba(255,255,255,.15)",
                  }}>
                    {cp ? `${p} VS ${cp}` : p}
                  </th>
                );
              }) : periods.map(p => (
                <th key={p} style={{
                  padding: "12px 14px", textAlign: "right", color: "white",
                  fontWeight: 700, fontSize: 12, minWidth: 120,
                  borderRight: "1px solid rgba(255,255,255,.08)",
                }}>
                  {p}
                </th>
              ))}

              <th rowSpan={hasCompare ? 2 : 1} style={{
                padding: "12px 14px", textAlign: "right", color: "white",
                fontWeight: 700, fontSize: 12, minWidth: 130,
                background: "rgba(0,0,0,.22)",
                borderLeft: "2px solid rgba(255,255,255,.15)",
                verticalAlign: "middle",
              }}>
                Total
              </th>
            </tr>

            {hasCompare && (
              <tr style={{ background: HDR2 }}>
                {periods.map(p => {
                  const cp = rows.find(r => r.period === p)?.comparison?.compare_period;
                  return (
                    <React.Fragment key={p}>
                      <th style={thStyle({ minWidth: 110 })}>
                        <div>{p}</div>
                        <div style={{ opacity: .65, fontWeight: 400, fontSize: 12, marginTop: 1 }}>{isBudgetCompare ? "Forecast" : "Current"}</div>
                      </th>
                      <th style={thStyle({ minWidth: 110, background: "rgba(255,255,255,.07)" })}>
                        <div>{isBudgetCompare ? p : cp || "Prev"}</div>
                        <div style={{ opacity: .65, fontWeight: 400, fontSize: 12, marginTop: 1 }}>{isBudgetCompare ? "Budget" : "Previous"}</div>
                      </th>
                      <th style={thStyle({ minWidth: 130, borderRight: "2px solid rgba(255,255,255,.22)" })}>
                        <div>Variance</div>
                        <div style={{ opacity: .65, fontWeight: 400, fontSize: 12, marginTop: 1 }}>Δ</div>
                      </th>
                    </React.Fragment>
                  );
                })}
              </tr>
            )}
          </thead>

          <tbody>
            {PNL_ROWS.map((cfg, si) => {
              const total   = sumField(rows, cfg.key);
              const isNeg   = total < 0;
              const bg      = si % 2 === 0 ? "#ffffff" : "#f8fafc";
              const isBold  = cfg.dividerAbove;

              return (
                <React.Fragment key={cfg.key}>
                  {cfg.dividerAbove && (
                    <tr>
                      <td colSpan={periods.length * (hasCompare ? 3 : 1) + 2}
                        style={{ height: 2, background: "#cbd5e1", padding: 0 }} />
                    </tr>
                  )}
                  <tr style={{ background: bg, borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{
                      padding: "11px 16px",
                      fontWeight: isBold ? 800 : 700,
                      fontSize: 12,
                      color: isBold ? "#0c3557" : "#334155",
                      textTransform: "uppercase",
                      letterSpacing: ".04em",
                      position: "sticky", left: 0, zIndex: 5, background: bg,
                      borderRight: "1px solid #e2e8f0",
                    }}>
                      <span className="flex items-center justify-between gap-2">
                        {cfg.shortLabel}
                        {renderLineAction?.(cfg)}
                      </span>
                    </td>

                    {hasCompare ? rows.map(r => {
                      const curr    = r[cfg.key] ?? null;
                      const cmpKey  = `compare_${cfg.key}`;
                      const prev    = r.comparison?.[cmpKey] ?? null;
                      const chgKey  = `${cfg.key}_change`;
                      const rawVar  = r.comparison?.[chgKey] ?? (curr != null && prev != null ? Number(curr) - Number(prev) : null);
                      const varPos  = rawVar != null && rawVar >= 0;
                      // Costs: coming in lower is the favourable direction.
                      const varGood = rawVar != null && (cfg.lowerIsBetter ? rawVar <= 0 : rawVar >= 0);

                      return (
                        <React.Fragment key={r.period}>
                          <td style={{
                            padding: "11px 13px", textAlign: "right",
                            fontSize: 12, fontWeight: isBold ? 800 : 700,
                            color: Number(curr) < 0 ? "#dc2626" : HDR,
                            borderRight: "1px solid #f1f5f9",
                          }}>
                            {fmtValue(curr, cf)}
                          </td>
                          <td style={{
                            padding: "11px 13px", textAlign: "right",
                            fontSize: 12, fontWeight: 500, color: "#64748b",
                            background: "rgba(241,245,249,.55)",
                            borderRight: "1px solid #f1f5f9",
                          }}>
                            {fmtValue(prev, cf)}
                          </td>
                          <td style={{
                            padding: "11px 13px", textAlign: "right",
                            fontSize: 12, fontWeight: 700,
                            color: rawVar == null ? "#94a3b8" : varGood ? "#059669" : "#dc2626",
                            borderRight: "2px solid #e2e8f0",
                          }}>
                            {rawVar == null ? "—" : (
                              <span>
                                {varPos ? "+" : ""}{fmtValue(rawVar, cf)}
                                {variancePct(curr, prev) != null && (
                                  <span style={{ marginLeft: 5, fontSize: 12, fontWeight: 600, opacity: .75 }}>
                                    ({variancePct(curr, prev) > 0 ? "+" : ""}{variancePct(curr, prev).toFixed(getDecimalPrecision())}%)
                                  </span>
                                )}
                              </span>
                            )}
                          </td>
                        </React.Fragment>
                      );
                    }) : rows.map(r => {
                      const val = r[cfg.key] ?? null;
                      const isNegCell = Number(val) < 0;
                      return (
                        <td key={r.period} style={{
                          padding: "11px 14px", textAlign: "right",
                          fontSize: 13, fontWeight: isBold ? 800 : 600,
                          color: isNegCell ? "#dc2626" : "#1e3a5f",
                          borderRight: "1px solid #f1f5f9",
                        }}>
                          {fmtValue(val, cf)}
                        </td>
                      );
                    })}

                    <td style={{
                      padding: "11px 14px", textAlign: "right",
                      fontSize: 13, fontWeight: 800,
                      color: isNeg ? "#dc2626" : HDR,
                      background: si % 2 === 0 ? "#f0f4f8" : "#e8edf3",
                      borderLeft: "2px solid #cbd5e1",
                    }}>
                      {fmtValue(total, cf)}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PnLForecastReport() {
  const { token, selectedCurrency } = useContext(AuthContext);
  const { budgetYear, fiscalYearStartMonth } = useContext(BudgetYearContext);
  const year     = budgetYear - 1;
  const currency = selectedCurrency || "USD";

  const [cf,                setCf]                = useState("actualvalue");
  const [pf,                setPf]                = useState("monthly");
  const [selectedScenario,  setSelectedScenario]  = useState("Baseline");
  const [comparison,        setComparison]        = useState("");
  const [quarter,           setQuarter]           = useState(""); // "" = all quarters
  const [rows,              setRows]              = useState(null);
  const [loading,           setLoading]           = useState(false);
  const [error,             setError]             = useState(null);
  const [availableScenarios, setAvailableScenarios] = useState(DEFAULT_SCENARIO_OPTIONS);
  // Blocks the first fetchData() call until the initial available-scenarios
  // lookup (below) has resolved and selectedScenario has been corrected to
  // whichever one is marked final — otherwise fetchData fires once for the
  // hardcoded "Baseline" default, then fires again a moment later once the
  // final scenario is known, hitting the (expensive) pnl-forecast endpoint
  // twice on every page load.
  const [initializing, setInitializing] = useState(true);

  const scenarioOptions = availableScenarios;

  // A single quarter is shown from the quarterly figures.
  const effectivePf = quarter ? "quarterly" : pf;

  const comparisonOptions = useMemo(() => {
    const base =
      effectivePf === "monthly"   ? COMPARISON_OPTIONS.filter(o => o.value !== "previous_quarter")
      : effectivePf === "quarterly" ? COMPARISON_OPTIONS.filter(o => o.value !== "previous_month")
      : COMPARISON_OPTIONS;
    return base.map(o => ({ ...o, label: comparisonLabel(o.value, quarter) }));
  }, [effectivePf, quarter]);

  useEffect(() => {
    if (!comparisonOptions.some(o => o.value === comparison)) setComparison("");
  }, [comparisonOptions, comparison]);

  const abortRef = useRef(null);

  const fetchData = useCallback(async () => {
    if (!year || !currency) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setRows(null);

    const { scenario, custom_scenario_name } = getScenarioApiParams(selectedScenario);
    const params = new URLSearchParams({ currency_filter: cf, period_filter: effectivePf, scenario });
    if (custom_scenario_name) params.set("custom_scenario_name", custom_scenario_name);
    if (comparison) params.set("comparison", comparison);

    try {
      const res = await fetch(`${API}/${year}/${currency}?${params}`, {
        headers: {
          Authorization:  token ? `Bearer ${token}` : "",
          Accept:         "application/json",
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
      if (res.status === 401) { setError("Unauthorized (401)"); return; }
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = await res.json();
      const rawRows = Array.isArray(data) ? data : (data?.pnl_forecast ?? data?.data ?? data?.rows ?? []);
      setRows(rawRows);
      // Populate scenario dropdown from the API response
      if (Array.isArray(data.available_scenarios) && data.available_scenarios.length > 0) {
        const opts = [
          { value: "Baseline", label: "Baseline", type: "system" },
          ...data.available_scenarios
            .filter(s => s.scenario_name?.toLowerCase().replace(/ /g, "_") !== "base_case")
            .map(s => ({ value: s.scenario_name, label: s.scenario_name, type: s.scenario_type })),
        ];
        setAvailableScenarios(opts);
      }
    } catch (e) {
      if (e.name === "AbortError") return;
      setError(e.message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [year, currency, cf, effectivePf, selectedScenario, comparison, token, fiscalYearStartMonth]); // eslint-disable-line

  useEffect(() => { if (!initializing) fetchData(); }, [fetchData, initializing]);
  useEffect(() => () => { if (abortRef.current) abortRef.current.abort(); }, []);

  useEffect(() => {
    if (!year || !token) return;
    let cancelled = false;
    const fetchScenarios = (isInitial) => {
      fetch(`${API_BASE_URL}/api/v1/forecasting/managemet/scenario-modeling/${year}/available-scenarios`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (cancelled) return;
          if (data?.scenarios?.length) {
            const opts = [
              { value: "Baseline", label: "Baseline", type: "system", is_final: false },
              ...data.scenarios
                .filter(s => s.scenario_name?.toLowerCase().replace(/ /g, "_") !== "base_case")
                .map(s => ({ value: s.scenario_name, label: s.scenario_name, type: s.scenario_type, is_final: !!s.is_final })),
            ];
            setAvailableScenarios(opts);
            // Resolve the correct initial scenario here, synchronously with
            // this same state update, instead of leaving it to the separate
            // reactive effect below — that's what previously let fetchData
            // fire once for "Baseline" and again once the final scenario
            // was discovered.
            if (isInitial) {
              const finalOpt = opts.find(o => o.is_final);
              if (finalOpt) setSelectedScenario(finalOpt.value);
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isInitial && !cancelled) setInitializing(false);
        });
    };
    fetchScenarios(true);
    const onVisibility = () => { if (document.visibilityState === "visible") fetchScenarios(false); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVisibility); };
  }, [year, token]); // eslint-disable-line

  useEffect(() => {
    if (!availableScenarios.length) return;
    const finalOpt = availableScenarios.find(o => o.is_final);
    if (!availableScenarios.some(o => o.value === selectedScenario)) {
      setSelectedScenario(finalOpt?.value || "Baseline");
    } else if (selectedScenario === "Baseline" && finalOpt) {
      setSelectedScenario(finalOpt.value);
    }
  }, [availableScenarios]); // eslint-disable-line

  const compLabel    = comparisonLabel(comparison, quarter);
  const periodLabel  = quarter || PERIOD_FILTER_OPTIONS.find(o => o.value === effectivePf)?.label;
  const viewRows = useMemo(
    () => (rows && quarter ? rows.filter(r => r.period === quarter) : rows),
    [rows, quarter]
  );

  /* ── Commentary & Report AI (saved per scenario / period / quarter / comparison) ── */
  const commentaryFilters = { scenario: selectedScenario, period: effectivePf, quarter, comparison };
  const commentary = useReportCommentary({ token, reportId: "pnl_forecast", year, currency, filters: commentaryFilters });
  const lineCommentary = useLineItemCommentary({ token, reportId: "pnl_forecast", year, currency, filters: commentaryFilters });
  const viewKey = `${year}|${currency}|${cf}|${JSON.stringify(commentaryFilters)}`;
  const [refineLine, setRefineLine] = useState(null);
  useEffect(() => { setRefineLine(null); }, [viewKey]);

  const filterLabels = [
    `Scenario: ${selectedScenario}`,
    `Period: ${periodLabel}`,
    comparison ? `Compare: ${compLabel}` : null,
  ].filter(Boolean);
  const aiNotes = [
    "Figures are the P&L forecast for each period, in actual currency units.",
    "actual_profit = gross profit − operating expense (the forecast profit); budget_profit is the budgeted profit; variance = actual_profit − budget_profit.",
    comparison === "budget" && "compare_* values are the budget for the same period; *_change = forecast − budget.",
    comparison && comparison !== "budget" && `compare_* values are the comparison period (${compLabel}); *_change = current − comparison.`,
  ].filter(Boolean).join(" ");

  const comparisonFor = (r, key) =>
    r.comparison && Object.keys(r.comparison).length
      ? {
          compare_period: r.comparison.compare_period,
          compare: r.comparison[`compare_${key}`],
          change: r.comparison[`${key}_change`],
          change_pct: r.comparison[`${key}_change_pct`],
        }
      : undefined;

  // Whole report, for the Report insights drawer and Ask AI.
  const buildInsightsContext = () => {
    if (!viewRows?.length) return "";
    const keys = [...PNL_ROWS.map(c => c.key), "budget_profit"];
    const totals = Object.fromEntries(keys.map(k => [k, sumField(viewRows, k)]));
    return buildReportAIContext({
      valueScale: "Actual",
      notes: aiNotes,
      keyMetrics: totals,
      facts: {
        periods_by_profit: viewRows.length > 1 ? rankForAI(viewRows, r => r.actual_profit, r => r.period, Math.min(3, Math.floor(viewRows.length / 2))) : undefined,
        periods_by_variance: viewRows.length > 1 ? rankForAI(viewRows, r => r.variance, r => r.period, Math.min(3, Math.floor(viewRows.length / 2))) : undefined,
      },
      rows: viewRows.map(r => ({
        period: r.period,
        ...Object.fromEntries(keys.map(k => [k, r[k]])),
        ...(r.comparison && Object.keys(r.comparison).length ? { comparison: r.comparison } : {}),
      })),
    });
  };

  // One P&L line across the periods in view, for its commentary drawer.
  const buildLineItemContext = (key) => {
    const cfg = PNL_ROWS.find(c => c.key === key);
    if (!cfg || !viewRows?.length) return "";
    return JSON.stringify(compactForAI({
      report: "P&L Forecast",
      notes: aiNotes,
      line: cfg.label,
      total: sumField(viewRows, key),
      by_period: viewRows.map(r => ({
        period: r.period,
        value: r[key],
        revenue: r.revenue,
        forecast_profit: r.actual_profit,
        budget_profit: r.budget_profit,
        comparison: comparisonFor(r, key),
      })),
    }));
  };

  const askConfig = {
    label: "P&L Forecast",
    questions: [
      "Which period has the weakest forecast profit, and why?",
      "How does the forecast compare with budget?",
      "What is driving the variance to budget?",
      "How do operating expenses trend across the forecast?",
      "What are the main risks in this forecast?",
      "What actions would improve the forecast profit?",
    ],
    getContext: buildInsightsContext,
  };

  const _scenarioKey = getScenarioApiParams(selectedScenario).scenario;
  const scenarioBadge = {
    baseline:  { bg: "bg-sky-500/20",     text: "text-sky-200",     dot: "bg-sky-400"     },
    bestcase:  { bg: "bg-emerald-500/20", text: "text-emerald-200", dot: "bg-emerald-400" },
    worstcase: { bg: "bg-red-500/20",     text: "text-red-200",     dot: "bg-red-400"     },
  }[_scenarioKey] || { bg: "bg-indigo-500/20", text: "text-indigo-200", dot: "bg-indigo-400" };

  return (
    <div className="planning-compact min-h-screen bg-sky-50 text-sky-900">

      {/* HEADER */}
      <header className="bg-gradient-to-r from-sky-950 via-sky-900 to-sky-700 rounded-xl px-4 py-2.5 md:px-6 sticky top-0 z-40 shadow-sm mb-2">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/25 bg-white/10">
              <FiBarChart2 color="#7dd3fc" size={18} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">P&amp;L Forecast</h1>
              <p className="text-xs text-sky-300 tabular-nums">{year} · {currency}</p>
            </div>
            <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border border-white/10 ${scenarioBadge.bg} ${scenarioBadge.text}`}>
              <span className={`h-[7px] w-[7px] rounded-full ${scenarioBadge.dot}`} />
              {selectedScenario}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-1 rounded-lg border border-white/25 bg-white/10 text-x font-semibold text-white hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiRefreshCw size={12} className={loading ? "animate-spin" : ""} />
              {loading ? "Loading…" : "Refresh"}
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-1 rounded-lg border border-white/25 bg-white/10 text-x font-semibold text-white hover:bg-white/20 transition-colors"
            >
              <FiDownload size={12} /> Export
            </button>
            <AIActionsMenu
              reportId="pnl_forecast"
              ask={askConfig}
              insights={{
                commentary,
                reportLabel: "P&L Forecast",
                filterLabels,
                viewKey,
                buildContext: buildInsightsContext,
                disabled: loading || !viewRows?.length,
              }}
            />
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-0">

        {/* FILTER BAR */}
        <div className="bg-white rounded-xl border border-sky-100 shadow-sm px-4 py-2 mb-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-s">
          <div className="flex items-center gap-2">
            <label className="font-semibold text-sky-700 whitespace-nowrap">Display</label>
            <select value={cf} onChange={e => setCf(e.target.value)}
              className="px-3 py-1 rounded-lg bg-white border border-sky-200 text-sky-900 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200">
              {CURRENCY_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="font-semibold text-sky-700 whitespace-nowrap">Period</label>
            <select value={effectivePf} onChange={e => { setPf(e.target.value); if (e.target.value !== "quarterly") setQuarter(""); }}
              className="px-3 py-1 rounded-lg bg-white border border-sky-200 text-sky-900 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200">
              {PERIOD_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="font-semibold text-sky-700 whitespace-nowrap">Quarter</label>
            <select value={quarter} onChange={e => { setQuarter(e.target.value); if (e.target.value) setPf("quarterly"); }}
              className="px-3 py-1 rounded-lg bg-white border border-sky-200 text-sky-900 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200">
              {QUARTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="font-semibold text-sky-700 whitespace-nowrap">Scenario</label>
            <select value={selectedScenario} onChange={e => setSelectedScenario(e.target.value)}
              className="px-3 py-1 rounded-lg bg-white border border-sky-200 text-sky-900 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200">
              {scenarioOptions.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}{o.is_final ? " ★ Final" : o.type === "custom" ? " ✦" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="font-semibold text-sky-700 whitespace-nowrap">Compare</label>
            <select value={comparison} onChange={e => setComparison(e.target.value)}
              className="px-3 py-1 rounded-lg bg-white border border-sky-200 text-sky-900 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200">
              {comparisonOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {comparison && (
            <div className="ml-auto flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
              <FiAlertCircle size={11} /> {compLabel} active
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-x font-medium text-red-700">
            <FiAlertCircle size={14} className="shrink-0" />
            API error: {error}. Check your connection or token.
          </div>
        )}

        {/* KPI Cards */}
        <KpiCards rows={viewRows} cf={cf} scopeLabel={quarter ? `${quarter} total` : "Year total"} />

        {/* Table */}
        {loading ? (
          <TableSkeleton columns={5} rows={8} />
        ) : !viewRows ? (
          <div className="py-16 text-center text-sky-400">
            <div className="mb-3 text-4xl opacity-25">📊</div>
            <p className="text-sm font-medium">No data. Adjust filters and click Refresh.</p>
          </div>
        ) : (
          <PnLTable
            rows={viewRows}
            cf={cf}
            comparison={comparison}
            renderLineAction={(cfg) => (
              <LineItemAIButton
                label={cfg.label}
                noun="commentary"
                hasCommentary={!!lineCommentary.byLine[cfg.key]}
                onClick={() => setRefineLine({ key: cfg.key, label: cfg.label })}
              />
            )}
          />
        )}

        {/* Saved commentary for this view (prints with the report) */}
        {!loading && viewRows?.length > 0 && (
          <LineItemCommentary
            lineCommentary={lineCommentary}
            lines={PNL_ROWS.map(c => ({ key: c.key, label: c.label }))}
            onRefine={(line) => setRefineLine({ key: line.key, label: line.label })}
            title="Line-item Commentary"
          />
        )}
        {!loading && <ReportCommentary commentary={commentary} />}

        <LineItemRefineWithAI
          line={refineLine}
          onClose={() => setRefineLine(null)}
          lineCommentary={lineCommentary}
          reportLabel="P&L Forecast"
          filterLabels={filterLabels}
          buildContext={buildLineItemContext}
          subtitle="forecast explanation & recommendation"
        />
        <AIHelpTooltip />

        {/* Footer */}
        {rows && !loading && (
          <div className="mt-5 flex flex-wrap gap-2 items-center px-4 py-2.5 bg-white rounded-xl border border-sky-100 shadow-sm text-xs text-sky-400 tabular-nums">
            <span className="flex items-center gap-1.5 text-sky-600 font-semibold font-sans">
              <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
              P&amp;L Forecast
            </span>
            {[
              ["Year",     year],
              ["Currency", currency],
              ["Display",  CURRENCY_FILTER_OPTIONS.find(o => o.value === cf)?.label],
              ["Period",   periodLabel],
              ["Scenario", selectedScenario],
              ...(comparison ? [["vs", compLabel]] : []),
            ].map(([k, v]) => (
              <React.Fragment key={k}>
                <span className="text-sky-200">·</span>
                <span>{k}: <strong className="text-sky-600">{v}</strong></span>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
