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
  FiUsers,
  FiDollarSign,
  FiActivity,
  FiPackage,
  FiAlertCircle,
  FiChevronDown,
  FiChevronUp,
  FiMinus,
} from "react-icons/fi";

import { AuthContext } from "../../context/AuthContext";
import { BudgetYearContext } from "../../context/BudgetYearContext";
import { useCurrentQuarter } from "../../hooks/useCurrentQuarter";
import { API_BASE_URL } from "../../config/config";
import TableSkeleton from "../Skeleton/TableSkeleton";
import { getDecimalPrecision } from '../../utils/formatters';

// ─── API ──────────────────────────────────────────────────────────────────────
const API = `${API_BASE_URL}/api/v1/forecasting/managemet/summary-forecast`;

// ─── Options ──────────────────────────────────────────────────────────────────
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
];

// ─── Section config ───────────────────────────────────────────────────────────
const SECTION_CONFIG = [
  {
    key: "revenue_forecasting",
    label: "Revenue Forecasting",
    shortLabel: "Revenue",
    summaryKey: "forecast_revenue",
    icon: FiTrendingUp,
    accent: "#38bdf8",
    accentDark: "#0ea5e9",
    accentLight: "#e0f2fe",
    accentText: "#0369a1",
  },
  {
    key: "expense_forecasting",
    label: "Expense Forecasting",
    shortLabel: "Expenses",
    summaryKey: "forecast_expenses",
    icon: FiBarChart2,
    accent: "#fb7185",
    accentDark: "#f43f5e",
    accentLight: "#ffe4e6",
    accentText: "#be123c",
  },
  {
    key: "capex_forecast",
    label: "CapEx Forecast",
    shortLabel: "CapEx",
    summaryKey: "forecast_capex",
    icon: FiPackage,
    accent: "#a78bfa",
    accentDark: "#8b5cf6",
    accentLight: "#ede9fe",
    accentText: "#6d28d9",
  },
  {
    key: "cash_flow_projections",
    label: "Cash Flow",
    shortLabel: "Cash Flow",
    summaryKey: "forecast_cashflow",
    icon: FiActivity,
    accent: "#34d399",
    accentDark: "#10b981",
    accentLight: "#d1fae5",
    accentText: "#065f46",
  },
  {
    key: "headcount_forecast",
    label: "Headcount",
    shortLabel: "Headcount",
    summaryKey: "forecast_headcount",
    icon: FiUsers,
    accent: "#818cf8",
    accentDark: "#6366f1",
    accentLight: "#e0e7ff",
    accentText: "#3730a3",
  },
  {
    key: "payroll_forecast",
    label: "Payroll Forecast",
    shortLabel: "Payroll",
    summaryKey: "forecast_payroll",
    icon: FiDollarSign,
    accent: "#fbbf24",
    accentDark: "#f59e0b",
    accentLight: "#fef3c7",
    accentText: "#92400e",
  },
];


// ─── Helpers ──────────────────────────────────────────────────────────────────
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

function variancePct(curr, prev) {
  const c = Number(curr), p = Number(prev);
  if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0) return null;
  return ((c - p) / Math.abs(p)) * 100;
}

function parseApiNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.trim().toLowerCase().replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const match = cleaned.match(/^([-+]?\d+(?:\.\d+)?)\s*([kmb])?$/i);
  if (match) {
    const base = Number(match[1]);
    if (!Number.isFinite(base)) return null;
    const suffix = (match[2] || "").toLowerCase();
    const multiplier = suffix === "k" ? 1_000 : suffix === "m" ? 1_000_000 : suffix === "b" ? 1_000_000_000 : 1;
    return base * multiplier;
  }
  const plain = Number(cleaned);
  return Number.isFinite(plain) ? plain : null;
}

function numericTotal(rows, isHC) {
  const vals = rows.map(r => parseApiNumber(r.forecast_value)).filter(Number.isFinite);
  return isHC ? (vals[vals.length - 1] ?? 0) : vals.reduce((a, b) => a + b, 0);
}

function unitSuffix(cf) {
  if (cf === "thousands") return " K";
  if (cf === "millions") return " M";
  return "";
}

function scaleForDisplay(n, cf, isCount) {
  if (isCount) return n;
  if (cf === "thousands") return n / 1_000;
  if (cf === "millions")  return n / 1_000_000;
  return n;
}

function fmtValue(val, cf, opts = {}) {
  if (val == null) return "—";
  const raw = typeof val === "string" ? parseApiNumber(val) : Number(val);
  if (raw == null || !Number.isFinite(raw)) return "—";
  const scaled = scaleForDisplay(raw, cf, opts.isCount);
  const suffix = opts.isCount ? "" : unitSuffix(cf);
  return `${legacyFmtValue(scaled)}${suffix}`;
}

function normalizePnlResponse(data) {
  const source = data?.data && typeof data.data === "object" ? data.data : data;
  const normalized = {
    ...(source || {}),
    summary_metrics: { ...(source?.summary_metrics || {}) },
  };

  SECTION_CONFIG.forEach((sec) => {
    const rows = Array.isArray(source?.[sec.key]) ? source[sec.key] : [];
    normalized[sec.key] = rows
      .filter(Boolean)
      .map((row, index) => ({
        period:         row.period ?? row.month ?? row.quarter ?? row.year ?? `Period ${index + 1}`,
        forecast_value: row.forecast_value ?? row.value ?? row.amount ?? null,
        compare_value:  row.compare_value ?? row.previous_value ?? undefined,
        compare_period: row.compare_month ?? row.compare_quarter ?? row.compare_period ?? undefined,
        variance:       row.variance ?? undefined,
      }));

    if (normalized.summary_metrics[sec.summaryKey] == null && normalized[sec.key].length) {
      normalized.summary_metrics[sec.summaryKey] = numericTotal(
        normalized[sec.key],
        sec.key === "headcount_forecast"
      );
    }
  });

  return normalized;
}

// ─── VarChip ──────────────────────────────────────────────────────────────────
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

// ─── KPI Cards ────────────────────────────────────────────────────────────────
function KpiCards({ summary, cf }) {
  if (!summary) return null;
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2 mb-2">
      {SECTION_CONFIG.map((sec) => {
        const Icon = sec.icon;
        const val  = summary[sec.summaryKey];
        const isHC = sec.key === "headcount_forecast";
        return (
          <div key={sec.key} className="min-w-0 rounded-xl border border-sky-100 bg-white px-3 py-2 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className="truncate text-xs font-semibold uppercase tracking-wider text-sky-500">{sec.shortLabel}</span>
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-sky-100 bg-sky-50 text-sky-700">
                <Icon size={12} />
              </div>
            </div>
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="whitespace-nowrap text-base font-bold text-sky-900 leading-tight">
                {fmtValue(val, cf, { isCount: isHC })}
              </span>
              <span className="truncate text-[11px] text-sky-400">Forecast total</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}


// ─── Consolidated Table ───────────────────────────────────────────────────────
function ConsolidatedTable({ apiData, cf }) {
  if (!apiData) return null;
  const sections = SECTION_CONFIG.filter(s => apiData[s.key]?.length > 0);
  if (!sections.length) return (
    <div className="py-16 text-center text-sky-400">
      <div className="mb-3 text-4xl opacity-25">📊</div>
      <p className="text-s font-medium">No data available.</p>
    </div>
  );

  const firstRows  = apiData[sections[0].key] || [];
  const hasCompare = firstRows[0]?.compare_value != null;
  const HDR  = "#0c3557";
  const HDR2 = "#0f4a7a";

  // Build period list preserving order
  const periods = firstRows.map(r => r.period);

  // Map period → compare_period label (e.g. "2025-01" → "2024-12")
  const cmpPeriodMap = {};
  firstRows.forEach(r => {
    if (r.compare_period) cmpPeriodMap[r.period] = r.compare_period;
  });

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

            {/* ── Row 1: group headers ── */}
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
                const cp = cmpPeriodMap[p];
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

            {/* ── Row 2: sub-column labels per period group ── */}
            {hasCompare && (
              <tr style={{ background: HDR2 }}>
                {periods.map(p => {
                  const cp = cmpPeriodMap[p];
                  return (
                    <React.Fragment key={p}>
                      <th style={thStyle({ minWidth: 110 })}>
                        <div>{p}</div>
                        <div style={{ opacity: .65, fontWeight: 400, fontSize: 12, marginTop: 1 }}>Current</div>
                      </th>
                      <th style={thStyle({ minWidth: 110, background: "rgba(255,255,255,.07)" })}>
                        <div>{cp || "Prev"}</div>
                        <div style={{ opacity: .65, fontWeight: 400, fontSize: 12, marginTop: 1 }}>Previous</div>
                      </th>
                      <th style={thStyle({ minWidth: 130, borderRight: "2px solid rgba(255,255,255,.22)" })}>
                        <div>{cp ? `${p} vs ${cp}` : "Variance"}</div>
                        <div style={{ opacity: .65, fontWeight: 400, fontSize: 12, marginTop: 1 }}>Variance</div>
                      </th>
                    </React.Fragment>
                  );
                })}
              </tr>
            )}
          </thead>

          <tbody>
            {sections.map((sec, si) => {
              const rows   = apiData[sec.key] || [];
              const isHC   = sec.key === "headcount_forecast";
              const rowMap = Object.fromEntries(rows.map(r => [r.period, r]));
              const total  = numericTotal(rows, isHC);
              const bg     = si % 2 === 0 ? "#ffffff" : "#f8fafc";

              return (
                <tr key={sec.key} style={{ background: bg, borderBottom: "1px solid #e2e8f0" }}>
                  {/* Metric label */}
                  <td style={{
                    padding: "11px 16px", fontWeight: 700, fontSize: 12,
                    color: HDR, textTransform: "uppercase", letterSpacing: ".04em",
                    position: "sticky", left: 0, zIndex: 5, background: bg,
                    borderRight: "1px solid #e2e8f0",
                  }}>
                    {sec.shortLabel}
                  </td>

                  {/* Period data */}
                  {hasCompare ? periods.map(p => {
                    const row    = rowMap[p];
                    const fcast  = row?.forecast_value ?? null;
                    const cmp    = row?.compare_value  ?? null;
                    const rawVar = row?.variance != null
                      ? Number(row.variance)
                      : (fcast != null && cmp != null ? Number(fcast) - Number(cmp) : null);
                    const varPos = rawVar != null && rawVar >= 0;

                    return (
                      <React.Fragment key={p}>
                        {/* Current */}
                        <td style={{
                          padding: "11px 13px", textAlign: "right",
                          fontSize: 12, fontWeight: 700, color: HDR,
                          borderRight: "1px solid #f1f5f9",
                        }}>
                          {fmtValue(fcast, cf, { isCount: isHC })}
                        </td>
                        {/* Previous */}
                        <td style={{
                          padding: "11px 13px", textAlign: "right",
                          fontSize: 12, fontWeight: 500, color: "#64748b",
                          background: "rgba(241,245,249,.55)",
                          borderRight: "1px solid #f1f5f9",
                        }}>
                          {fmtValue(cmp, cf, { isCount: isHC })}
                        </td>
                        {/* Variance */}
                        <td style={{
                          padding: "11px 13px", textAlign: "right",
                          fontSize: 12, fontWeight: 700,
                          color: rawVar == null ? "#94a3b8" : varPos ? "#059669" : "#dc2626",
                          borderRight: "2px solid #e2e8f0",
                        }}>
                          {rawVar == null ? "—" : (
                            <span>
                              {varPos ? "+" : ""}{fmtValue(rawVar, cf, { isCount: isHC })}
                              {variancePct(fcast, cmp) != null && (
                                <span style={{
                                  marginLeft: 5, fontSize: 12, fontWeight: 600,
                                  opacity: .75,
                                }}>
                                  ({variancePct(fcast, cmp) > 0 ? "+" : ""}{variancePct(fcast, cmp).toFixed(getDecimalPrecision())}%)
                                </span>
                              )}
                            </span>
                          )}
                        </td>
                      </React.Fragment>
                    );
                  }) : periods.map(p => {
                    const row = rowMap[p];
                    return (
                      <td key={p} style={{
                        padding: "11px 14px", textAlign: "right",
                        fontSize: 13, fontWeight: 600, color: "#1e3a5f",
                        borderRight: "1px solid #f1f5f9",
                      }}>
                        {fmtValue(row?.forecast_value, cf, { isCount: isHC })}
                      </td>
                    );
                  })}

                  {/* Total */}
                  <td style={{
                    padding: "11px 14px", textAlign: "right",
                    fontSize: 13, fontWeight: 800, color: HDR,
                    background: si % 2 === 0 ? "#f0f4f8" : "#e8edf3",
                    borderLeft: "2px solid #cbd5e1",
                  }}>
                    {fmtValue(total, cf, { isCount: isHC })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PnlForecast() {
  const { token, selectedCurrency } = useContext(AuthContext);
  const { budgetYear, fiscalYearStartMonth } = useContext(BudgetYearContext);
  const year     = budgetYear - 1;
  const currency = selectedCurrency || "USD";

  const [cf,                setCf]                = useState("actualvalue");
  const [pf,                setPf]                = useState("monthly");
  const [quarter,           setQuarter]           = useCurrentQuarter(fiscalYearStartMonth);
  const [selectedScenario,  setSelectedScenario]  = useState("Baseline");
  const [comparison,        setComparison]        = useState("");
  const [apiData,           setApiData]           = useState(null);
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

  const comparisonOptions = useMemo(() => {
    if (pf === "monthly")   return COMPARISON_OPTIONS.filter(o => o.value !== "previous_quarter");
    if (pf === "quarterly") return COMPARISON_OPTIONS.filter(o => o.value !== "previous_month");
    return COMPARISON_OPTIONS;
  }, [pf]);

  useEffect(() => {
    if (!comparisonOptions.some(o => o.value === comparison)) setComparison("");
  }, [comparisonOptions, comparison]);

  // Use ref for abort to prevent stale fetch overwrites
  const abortRef = useRef(null);

  const fetchData = useCallback(async () => {
    if (!year || !currency) return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setApiData(null);

    const { scenario, custom_scenario_name } = getScenarioApiParams(selectedScenario);
    const params = new URLSearchParams({ currency_filter: cf, period_filter: pf, scenario });
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
      setApiData(normalizePnlResponse(data));
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
  // toast intentionally excluded — it's stable and shouldn't trigger refetch
  }, [year, currency, cf, pf, selectedScenario, comparison, token, fiscalYearStartMonth]); // eslint-disable-line

  useEffect(() => { if (!initializing) fetchData(); }, [fetchData, initializing]);
  useEffect(() => () => { if (abortRef.current) abortRef.current.abort(); }, []);

  useEffect(() => {
    if (!year || !token) return;
    let cancelled = false;
    const fetchScenarios = (isInitial) => {
      fetch(`${API_BASE_URL}/api/v1/forecasting/managemet/scenario-modeling/${year}/available-scenarios?quarter=${quarter}`, {
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
  }, [year, quarter, token]); // eslint-disable-line

  useEffect(() => {
    if (!availableScenarios.length) return;
    const finalOpt = availableScenarios.find(o => o.is_final);
    if (!availableScenarios.some(o => o.value === selectedScenario)) {
      // Selected scenario was deleted — reset to final or baseline
      setSelectedScenario(finalOpt?.value || "Baseline");
    } else if (selectedScenario === "Baseline" && finalOpt) {
      // Auto-select the final scenario on first load
      setSelectedScenario(finalOpt.value);
    }
  }, [availableScenarios]); // eslint-disable-line

  const summary           = apiData?.summary_metrics;
  const compLabel         = COMPARISON_OPTIONS.find(o => o.value === comparison)?.label;
  const _scenarioKey      = getScenarioApiParams(selectedScenario).scenario;
  const scenarioBadge = {
    baseline:  { bg: "bg-sky-500/20",     text: "text-sky-200",     dot: "bg-sky-400"     },
    bestcase:  { bg: "bg-emerald-500/20", text: "text-emerald-200", dot: "bg-emerald-400" },
    worstcase: { bg: "bg-red-500/20",     text: "text-red-200",     dot: "bg-red-400"     },
  }[_scenarioKey] || { bg: "bg-indigo-500/20", text: "text-indigo-200", dot: "bg-indigo-400" };

  return (
    <div className="planning-compact min-h-screen bg-sky-50 text-sky-900">

      {/* ── HEADER ── */}
      <header className="bg-gradient-to-r from-sky-950 via-sky-900 to-sky-700 rounded-xl px-4 py-2.5 md:px-6 sticky top-0 z-40 shadow-sm mb-2">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/25 bg-white/10">
              <FiTrendingUp color="#7dd3fc" size={18} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">Forecast Summary</h1>
              <p className="text-xs text-sky-300 tabular-nums">{year} · {currency}</p>
            </div>
            {/* Scenario badge */}
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
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-0">

        {/* ── FILTER BAR ── */}
        <div className="bg-white rounded-xl border border-sky-100 shadow-sm px-4 py-2 mb-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-s">
          {/* Currency Scale */}
          <div className="flex items-center gap-2">
            <label className="font-semibold text-sky-700 whitespace-nowrap">Display</label>
            <select
              value={cf}
              onChange={e => setCf(e.target.value)}
              className="px-3 py-1 rounded-lg bg-white border border-sky-200 text-sky-900 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200"
            >
              {CURRENCY_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Period */}
          <div className="flex items-center gap-2">
            <label className="font-semibold text-sky-700 whitespace-nowrap">Period</label>
            <select
              value={pf}
              onChange={e => setPf(e.target.value)}
              className="px-3 py-1 rounded-lg bg-white border border-sky-200 text-sky-900 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200"
            >
              {PERIOD_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Quarter */}
          <div className="flex items-center gap-2">
            <label className="font-semibold text-sky-700 whitespace-nowrap">Quarter</label>
            <select
              value={quarter}
              onChange={e => setQuarter(e.target.value)}
              className="px-3 py-1 rounded-lg bg-white border border-sky-200 text-sky-900 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200"
            >
              {["Q1", "Q2", "Q3", "Q4"].map(q => <option key={q} value={q}>{q}</option>)}
            </select>
          </div>

          {/* Scenario */}
          <div className="flex items-center gap-2">
            <label className="font-semibold text-sky-700 whitespace-nowrap">Scenario</label>
            <select
              value={selectedScenario}
              onChange={e => setSelectedScenario(e.target.value)}
              className="px-3 py-1 rounded-lg bg-white border border-sky-200 text-sky-900 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200"
            >
              {scenarioOptions.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}{o.is_final ? " ★ Final" : o.type === "custom" ? " ✦" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Comparison */}
          <div className="flex items-center gap-2">
            <label className="font-semibold text-sky-700 whitespace-nowrap">Compare</label>
            <select
              value={comparison}
              onChange={e => setComparison(e.target.value)}
              className="px-3 py-1 rounded-lg bg-white border border-sky-200 text-sky-900 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200"
            >
              {comparisonOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Active comparison indicator */}
          {comparison && (
            <div className="ml-auto flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
              <FiAlertCircle size={11} /> {compLabel} active
            </div>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-x font-medium text-red-700">
            <FiAlertCircle size={14} className="shrink-0" />
            API error: {error}. Check your connection or token.
          </div>
        )}

        {/* KPI Cards */}
        <KpiCards summary={summary} cf={cf} />

        {/* Consolidated view */}
        {loading ? (
          <TableSkeleton columns={5} rows={8} />
        ) : !apiData ? (
          <div className="py-16 text-center text-sky-400">
            <div className="mb-3 text-4xl opacity-25">📊</div>
            <p className="text-s font-medium">No data. Adjust filters and click Refresh.</p>
          </div>
        ) : (
          <ConsolidatedTable apiData={apiData} cf={cf} />
        )}

        {/* Footer */}
        {apiData && !loading && (
          <div className="mt-5 flex flex-wrap gap-2 items-center px-4 py-2.5 bg-white rounded-xl border border-sky-100 shadow-sm text-xs text-sky-400 tabular-nums">
            <span className="flex items-center gap-1.5 text-sky-600 font-semibold font-sans">
              <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
              Forecast Summary
            </span>
            {[
              ["Year",     year],
              ["Currency", currency],
              ["Display",  CURRENCY_FILTER_OPTIONS.find(o => o.value === cf)?.label],
              ["Period",   PERIOD_FILTER_OPTIONS.find(o => o.value === pf)?.label],
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
