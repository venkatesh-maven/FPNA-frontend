// src/components/Reports/Payroll/PayrollReconciliationViewmore.jsx
// API: GET /api/v1/company/financial/financials/Payroll_Reconciliation_Viewmore/{year}/{currency}
// Params: currency_filter, period, comparison (month_on_month | year_on_year)

import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config/config";
import TableSkeleton from "../Skeleton/TableSkeleton";
import { CSVLink } from "react-csv";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiFilter, FiDownload, FiPrinter, FiRefreshCw,
  FiTrendingUp, FiTrendingDown, FiZap,
} from "react-icons/fi";
import { getDecimalPrecision } from '../../utils/formatters';

/* ══════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════ */
const PERIODS = [
  { id: "all",             label: "All Periods"     },
  { id: "current_month",   label: "Current Month"   },
  { id: "last_month",      label: "Last Month"      },
  { id: "quarter_to_date", label: "Quarter to Date" },
  { id: "year_to_date",    label: "Year to Date"    },
];
const CURRENCY_FILTERS = [
  { id: "actualvalue", label: "Actual"        },
  { id: "thousands",   label: "Thousands (K)" },
  { id: "millions",    label: "Millions (M)"  },
];
const COMPARISON_FILTERS = [
  { id: "none",           label: "No Comparison"  },
  { id: "month_on_month", label: "Month on Month" },
  { id: "year_on_year",   label: "Year on Year"   },
];
const DEFAULT_FILTERS = {
  period:          "all",
  currency_filter: "actualvalue",
  comparison:      "none",
};

// Type display config
const TYPE_META = {
  payroll:  { label: "Payroll",  bg: "bg-sky-900",    text: "text-white" },
  benefits: { label: "Benefits", bg: "bg-violet-800", text: "text-white" },
  taxes:    { label: "Taxes",    bg: "bg-slate-700",  text: "text-white" },
};

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */

/**
 * Smart formatter — shows value exactly as API returns it.
 * API sends:
 *   actualvalue  → numbers like 17803.9
 *   thousands    → strings like "2506.52 K"
 *   millions     → strings like "2.51 M"
 * We display the raw string/number directly.
 */
const fmt = (v) => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") {
    const t = v.trim();
    if (!t || t === "--") return "—";
    return t; // show exactly what API sends e.g. "2506.52 K"
  }
  if (typeof v === "number") {
    if (v === 0) return "0";
    return v.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() });
  }
  return String(v);
};

const VariancePill = ({ value }) => {
  const n = typeof value === "number" ? value : parseFloat(value);
  if (isNaN(n) || n === 0)
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500">• 0</span>;
  if (n > 0)
    return <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-600 whitespace-nowrap"><FiTrendingUp size={9}/>+{fmt(Math.abs(n))}</span>;
  return <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-500 whitespace-nowrap"><FiTrendingDown size={9}/>-{fmt(Math.abs(n))}</span>;
};

/* ══════════════════════════════════════════
   SUB-COMPONENTS
══════════════════════════════════════════ */
const SelectField = ({ label, value, options, onChange }) => (
  <div className="mb-3">
    <label className="block mb-1 text-sky-700 text-x font-medium">{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full border border-sky-200 rounded-lg p-2 text-x bg-white focus:outline-none focus:ring-2 focus:ring-sky-300">
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  </div>
);

const MetricCard = ({ label, value }) => (
  <div className="bg-white border border-sky-100 rounded-xl p-4 shadow-sm">
    <p className=" text-[11p] text-sky-500 font-medium uppercase tracking-wide">{label}</p>
    <p className="mt-1 text-lg font-bold text-sky-900">{fmt(value)}</p>
  </div>
);

// Per-row rotating AI insight
const RowAITicker = ({ type, department }) => {
  const pool = useMemo(() => {
    if (department === "total") return [
      "Summary row — aggregated across all departments",
      "Review total vs individual department breakdowns",
      "AI insights coming soon for totals",
    ];
    const map = {
      payroll:  ["AI-powered payroll insights coming soon", "Payroll analysis in progress", "AI detects payroll trend patterns"],
      benefits: ["Benefits analysis coming soon", "AI reviewing benefits allocation", "Benefits optimization insights loading"],
      taxes:    ["Tax analysis coming soon", "AI reviewing tax compliance", "Tax variance insights loading"],
    };
    return map[type] || ["AI insights coming soon", "Analysis in progress"];
  }, [type, department]);

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % pool.length), 3200);
    return () => clearInterval(t);
  }, [pool]);

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={idx}
        initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.25 }}
        className=" text-[11p] italic text-purple-600 whitespace-nowrap leading-snug"
      >
        ✦ {pool[idx]}
      </motion.span>
    </AnimatePresence>
  );
};

const AIDriverText = ({ messages }) => {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!messages?.length) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % messages.length), 3500);
    return () => clearInterval(t);
  }, [messages]);
  return (
    <AnimatePresence mode="wait">
      <motion.div key={index}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.4 }}
        className="text-s font-medium bg-gradient-to-r from-sky-500 to-purple-500 bg-clip-text text-transparent leading-relaxed">
        {messages[index]}
      </motion.div>
    </AnimatePresence>
  );
};

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
export default function PayrollReconciliationDashboard() {
  const { token, selectedYear: year, selectedCurrency } = useContext(AuthContext);
  const currency = selectedCurrency || "USD";

  const [data,      setData]      = useState([]);
  const [keyMetrics, setKeyMetrics] = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  const [draftFilters,   setDraftFilters]   = useState({ ...DEFAULT_FILTERS });
  const [appliedFilters, setAppliedFilters] = useState({ ...DEFAULT_FILTERS });
  const [hasPending,     setHasPending]     = useState(false);
  const [open,           setOpen]           = useState(false);
  const ref = useRef(null);

  /* ── derive month columns from data ── */
  const monthCols = useMemo(() => {
    const first = data.find((r) => r.type && r.department !== "total");
    if (!first) return [];
    return Object.keys(first).filter((k) => /^\d{4}-\d{2}$/.test(k)).sort();
  }, [data]);

  /* ── comparison active = first non-total row has months[] in comparisons ── */
  const comparisonActive = useMemo(() => {
    const first = data.find((r) => r.department !== "total");
    return !!(first?.comparisons?.months?.length);
  }, [data]);

  /* ── period labels from first row's first comparison entry ── */
  const { allBasePeriods, allComparePeriods } = useMemo(() => {
    const first = data.find((r) => r.department !== "total" && r.comparisons?.months?.length);
    if (!first) return { allBasePeriods: {}, allComparePeriods: {} };
    const base = {}, compare = {};
    (first.comparisons.months || []).forEach((m) => {
      base[m.base_period]    = m.base_period;
      compare[m.base_period] = m.compare_period;
    });
    return { allBasePeriods: base, allComparePeriods: compare };
  }, [data]);

  /* ── group data by type ── */
  const grouped = useMemo(() => {
    const g = {};
    data.forEach((row) => {
      if (!g[row.type]) g[row.type] = [];
      g[row.type].push(row);
    });
    return g; // { payroll: [...], benefits: [...], taxes: [...] }
  }, [data]);

  const typeOrder = ["payroll", "benefits", "taxes"];

  /* ── outside click ── */
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  /* ── fetch ── */
  const fetchData = async (filters) => {
    if (!token || !year) return;
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      params.append("currency_filter", filters.currency_filter);
      params.append("period", filters.period);
      if (filters.comparison !== "none") params.append("comparison", filters.comparison);

      const res = await fetch(
        `${API_BASE_URL}/api/v1/company/financial/financials/Payroll_Reconciliation_Viewmore/${year}/${currency}?${params}`,
        { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } }
      );
      if (!res.ok) throw new Error("API error");
      const json = await res.json();
      setData(json.data || []);
      setKeyMetrics(json.keymetrics || json.key_metrics || null);
    } catch (e) {
      console.error(e);
      setError("Failed to load data.");
      setData([]); setKeyMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(appliedFilters); }, [token, year, currency, appliedFilters]); // eslint-disable-line

  /* ── filter actions ── */
  const updateDraft = (key, value) => {
    const next = { ...draftFilters, [key]: value };
    setDraftFilters(next);
    setHasPending(JSON.stringify(next) !== JSON.stringify(appliedFilters));
  };
  const applyFilters = () => { setAppliedFilters({ ...draftFilters }); setHasPending(false); setOpen(false); };
  const resetAll     = () => { setDraftFilters({ ...DEFAULT_FILTERS }); setAppliedFilters({ ...DEFAULT_FILTERS }); setHasPending(false); setOpen(false); };
  const removeFilter = (key, def) => { const n = { ...appliedFilters, [key]: def }; setAppliedFilters(n); setDraftFilters(n); setHasPending(false); };

  /* ── active chips ── */
  const activeChips = [];
  if (appliedFilters.period !== "all")
    activeChips.push({ label: PERIODS.find(p => p.id === appliedFilters.period)?.label, onRemove: () => removeFilter("period", "all") });
  if (appliedFilters.currency_filter !== "actualvalue")
    activeChips.push({ label: CURRENCY_FILTERS.find(c => c.id === appliedFilters.currency_filter)?.label, onRemove: () => removeFilter("currency_filter", "actualvalue") });
  if (appliedFilters.comparison !== "none")
    activeChips.push({ label: COMPARISON_FILTERS.find(c => c.id === appliedFilters.comparison)?.label, onRemove: () => removeFilter("comparison", "none") });

  /* ── ai messages ── */
  const aiMessages = useMemo(() => {
    const msgs = keyMetrics?.ai_insights?.length ? keyMetrics.ai_insights : [];
    return msgs.length ? msgs : [
      "Payroll reconciliation data loaded — review monthly cost trends.",
      "Filter by period or currency to analyse specific windows.",
      comparisonActive ? "Comparison mode active — variance columns highlight month-over-month shifts." : "Enable Month-on-Month comparison to benchmark payroll changes.",
      "Benefits and taxes together represent a significant portion of total cost.",
    ];
  }, [keyMetrics, comparisonActive]);

  /* ── helper: get comparison entry for a row + month ── */
  const getComp = (row, month) => {
    if (!row.comparisons?.months) return null;
    return row.comparisons.months.find((m) => m.base_period === month) || null;
  };

  /* ══════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════ */
  return (
    <main className="bg-slate-50 min-h-screen space-y-5 ">

      {/* ── HEADER ── */}
      <div className="bg-gradient-to-r from-sky-900 via-sky-800 to-sky-700 text-white px-6 py-5 rounded-xl shadow-md">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Payroll Reconciliation</h1>
            <p className="text-s text-sky-200 mt-0.5">Department-level monthly breakdown — Payroll · Benefits · Taxes</p>
          </div>
          <div className="flex gap-5 text-s text-sky-200 items-center">
            <span>Year: <b className="text-white">{year}</b></span>
            <span>Currency: <b className="text-white">{currency}</b></span>
            {comparisonActive && (
              <span className="px-2 py-0.5 bg-sky-600 rounded-full text-x text-white font-medium">Comparison Active</span>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      {keyMetrics && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <MetricCard label="Total Payroll"   value={keyMetrics.total_payroll} />
          <MetricCard label="Total Benefits"  value={keyMetrics.total_benefits} />
          <MetricCard label="Total Taxes"     value={keyMetrics.total_taxes} />
          <MetricCard label="Grand Total"     value={keyMetrics.grand_total} />
          <MetricCard label="Avg / Month"     value={keyMetrics.average_per_month} />
        </motion.div>
      )}

      {/* ── FILTER BAR ── */}
      <div className="bg-white rounded-xl px-4 py-3 flex justify-between items-center gap-3 border border-sky-100 shadow-sm sticky -top-6 z-20 flex-wrap"
        ref={ref}>
        {/* Active chips */}
        <div className="flex items-center flex-wrap gap-2">
          {activeChips.map((chip, i) => (
            <span key={i} className="flex items-center gap-1 px-3 py-1 text-x bg-sky-100 text-sky-800 rounded-full">
              {chip.label}
              <button onClick={chip.onRemove} className="text-sky-600 hover:text-sky-900 font-bold ml-0.5">✕</button>
            </span>
          ))}
          {activeChips.length > 0 && (
            <button onClick={resetAll} className="flex items-center gap-1 px-2 py-1 text-x text-red-500 hover:text-red-700 rounded-full border border-red-200">
              <FiRefreshCw size={10} /> Reset All
            </button>
          )}
          {activeChips.length === 0 && <span className="text-x text-sky-400">No filters applied</span>}
        </div>

        {/* Controls */}
        <div className="relative flex items-center gap-2">
          <button onClick={() => setOpen(!open)}
            className={`flex items-center gap-2 px-3 py-2 text-x rounded-lg transition ${
              hasPending ? "bg-amber-100 text-amber-700 border border-amber-300" : "bg-sky-100 text-sky-800"
            }`}>
            <FiFilter size={13} /> Filters
            {hasPending && <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-amber-400 text-white rounded-full">Pending</span>}
          </button>

          <AnimatePresence>
            {open && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="absolute right-28 top-10 mt-1 w-72 bg-sky-50 border border-sky-200 rounded-xl shadow-xl z-50 p-4">
                <SelectField label="Period"     value={draftFilters.period}          options={PERIODS}           onChange={(v) => updateDraft("period", v)} />
                <SelectField label="Currency"   value={draftFilters.currency_filter} options={CURRENCY_FILTERS}  onChange={(v) => updateDraft("currency_filter", v)} />
                <SelectField label="Comparison" value={draftFilters.comparison}      options={COMPARISON_FILTERS} onChange={(v) => updateDraft("comparison", v)} />
                <div className="flex gap-2 mt-3">
                  <button onClick={applyFilters} className="flex-1 py-2 text-x font-semibold bg-sky-700 text-white rounded-lg hover:bg-sky-800 transition">Apply</button>
                  <button onClick={resetAll}     className="flex-1 py-2 text-x font-semibold bg-white text-sky-700 border border-sky-200 rounded-lg hover:bg-sky-50 transition">Reset</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-2 text-x bg-sky-100 text-sky-800 rounded-lg">
            <FiPrinter size={13} /> Print
          </button>
        </div>
      </div>

      {/* ── TABLE ── */}
      {loading && <TableSkeleton />}
      {error   && <p className="text-red-500 text-s px-1">{error}</p>}

      {!loading && data.length > 0 && (
        <div className="space-y-6">
          {typeOrder.map((type) => {
            const rows = grouped[type];
            if (!rows?.length) return null;
            const meta = TYPE_META[type] || { label: type, bg: "bg-sky-900", text: "text-white" };

            // separate department rows from total row
            const deptRows  = rows.filter((r) => r.department !== "total");
            const totalRow  = rows.find((r) => r.department === "total");

            return (
              <div key={type} className="border border-sky-200 rounded-xl overflow-hidden shadow-sm bg-white">

                {/* Section label */}
                <div className={`${meta.bg} ${meta.text} px-4 py-2 flex items-center gap-2`}>
                  <span className="text-s font-bold uppercase tracking-wider">{meta.label}</span>
                  <span className="ml-auto text-x opacity-70">{deptRows.length} departments</span>
                </div>

                <div className="overflow-auto">
                  <table className="w-full text-x text-sky-900 border-collapse">

                    {/* ══ COMPARISON HEADER ══ */}
                    {comparisonActive ? (
                      <thead className="sticky top-0 z-10">
                        {/* Row 1: group labels — one per month spanning 3 sub-cols */}
                        <tr className="bg-sky-50 border-b border-sky-100">
                          <th className="sticky left-0 z-20 bg-sky-50 px-3 py-1.5 min-w-[140px]" />
                          <th className="px-3 py-1.5 min-w-[160px]" /> {/* AI col */}
                          {monthCols.map((m) => (
                            <th key={m} colSpan={3}
                              className="px-2 py-1.5 text-center text-[10px] font-bold text-sky-700 uppercase tracking-widest border-l border-sky-200 whitespace-nowrap">
                              {m}
                            </th>
                          ))}
                          <th className="px-3 py-1.5 border-l border-sky-200 whitespace-nowrap" />
                        </tr>

                        {/* Row 2: sub-column headers with period labels */}
                        <tr className="bg-sky-100 border-b border-sky-200">
                          <th className="sticky left-0 z-20 bg-sky-100 px-3 py-2 text-left text-x font-semibold text-sky-800 whitespace-nowrap min-w-[140px]">
                            Department
                          </th>
                         
                          {monthCols.map((m) => (
                            <React.Fragment key={m}>
                              <th className="px-2 py-2 text-left border-l border-sky-200 whitespace-nowrap">
                                <span className="block text-[10px] font-semibold text-sky-800">Current</span>
                                <span className="block text-[9px] text-sky-400 mt-0.5">{allBasePeriods[m] ?? m}</span>
                              </th>
                              <th className="px-2 py-2 text-left whitespace-nowrap">
                                <span className="block text-[10px] font-semibold text-sky-800">Previous</span>
                                <span className="block text-[9px] text-sky-400 mt-0.5">{allComparePeriods[m] ?? "—"}</span>
                              </th>
                              <th className="px-2 py-2 text-left whitespace-nowrap">
                                <span className="block text-[10px] font-semibold text-sky-800">Variance</span>
                                <span className="block text-[9px] text-sky-400 mt-0.5">&nbsp;</span>
                              </th>
                            </React.Fragment>
                          ))}
                          <th className="px-3 py-2 text-left text-x font-semibold text-sky-800 border-l border-sky-200 whitespace-nowrap">Total</th>
                           <th className="px-3 py-2 text-left text-x font-semibold text-sky-800 whitespace-nowrap min-w-[160px]">
                            AI Insight
                          </th>
                        </tr>
                      </thead>
                    ) : (
                      /* ══ NORMAL HEADER ══ */
                      <thead className="sticky top-0 z-10 bg-sky-100 border-b border-sky-200">
                        <tr>
                          <th className="sticky left-0 z-20 bg-sky-100 px-3 py-2 text-left text-x font-semibold text-sky-800 whitespace-nowrap min-w-[140px]">Department</th>
                          {monthCols.map((m) => (
                            <th key={m} className="px-3 py-2 text-right text-x font-semibold text-sky-800 whitespace-nowrap">{m}</th>
                          ))}
                          <th className="px-3 py-2 text-right text-x font-semibold text-sky-800 border-l border-sky-200 whitespace-nowrap">Total</th>
                          <th className="px-3 py-2 text-left text-x font-semibold text-sky-800 whitespace-nowrap min-w-[160px]">AI Insight</th>
                        </tr>
                      </thead>
                    )}

                    {/* ══ BODY ══ */}
                    <tbody>
                      {/* Department rows */}
                      {deptRows.map((row, idx) => (
                        <motion.tr key={`${type}-${row.department}`}
                          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: idx * 0.03 }}
                          className="border-b border-sky-50 hover:bg-sky-50 transition align-middle">

                          {/* Department (sticky) */}
                          <td className="sticky left-0 bg-white px-3 py-2 font-medium whitespace-nowrap border-r border-sky-100">
                            {row.department}
                          </td>

                          {comparisonActive ? (
                            <>
                              

                              {/* Per-month: current | previous | variance */}
                              {monthCols.map((m) => {
                                const comp = getComp(row, m);
                                return (
                                  <React.Fragment key={m}>
                                    {/* Current = value from the row's month key — shown directly as API returns */}
                                    <td className="px-2 py-2 text-right font-semibold text-sky-900 border-l border-sky-100 whitespace-nowrap">
                                      {fmt(row[m])}
                                    </td>
                                    {/* Previous = comp.compare_value */}
                                    <td className="px-2 py-2 text-right text-sky-500 whitespace-nowrap">
                                      {comp ? fmt(comp.compare_value) : "—"}
                                    </td>
                                    {/* Variance = comp.variance */}
                                    <td className="px-2 py-2 text-right whitespace-nowrap">
                                      {comp ? <VariancePill value={comp.variance} /> : "—"}
                                    </td>
                                  </React.Fragment>
                                );
                              })}

                              {/* Total */}
                              <td className="px-3 py-2 text-right font-bold text-sky-900 border-l border-sky-200 whitespace-nowrap">
                                {fmt(row.total)}
                              </td>
                              {/* AI insight col */}
                              <td className="px-3 py-2 bg-white border-r border-purple-100 min-w-[160px]">
                                <RowAITicker type={type} department={row.department} />
                              </td>
                            </>
                          ) : (
                            <>
                              {/* Normal mode: one value per month */}
                              {monthCols.map((m) => (
                                <td key={m} className="px-3 py-2 text-right text-sky-800 whitespace-nowrap">
                                  {fmt(row[m])}
                                </td>
                              ))}
                              <td className="px-3 py-2 text-right font-bold text-sky-900 border-l border-sky-200 whitespace-nowrap">
                                {fmt(row.total)}
                              </td>
                              {/* AI insight — last column */}
                              <td className="px-3 py-2 bg-white border-l border-purple-100 min-w-[160px]">
                                <RowAITicker type={type} department={row.department} />
                              </td>
                            </>
                          )}
                        </motion.tr>
                      ))}

                      {/* ── TOTAL ROW ── */}
                      {totalRow && (
                        <tr className={`border-t-2 ${meta.bg} ${meta.text} font-bold`}>
                          <td className={`sticky left-0 ${meta.bg} px-3 py-2.5 whitespace-nowrap uppercase text-x tracking-wide border-r border-white/20`}>
                            Total {meta.label}
                          </td>

                          {comparisonActive ? (
                            <>
                              <td className={`px-3 py-2.5 ${meta.bg}`} /> {/* AI col spacer */}
                              {monthCols.map((m) => (
                                <React.Fragment key={m}>
                                  <td className="px-2 py-2.5 text-right border-l border-white/20 whitespace-nowrap">{fmt(totalRow[m])}</td>
                                  <td className="px-2 py-2.5 text-right opacity-60 whitespace-nowrap">—</td>
                                  <td className="px-2 py-2.5 text-right whitespace-nowrap">—</td>
                                </React.Fragment>
                              ))}
                              <td className="px-3 py-2.5 text-right border-l border-white/20 whitespace-nowrap">{fmt(totalRow.total)}</td>
                            </>
                          ) : (
                            <>
                              {monthCols.map((m) => (
                                <td key={m} className="px-3 py-2.5 text-right whitespace-nowrap">{fmt(totalRow[m])}</td>
                              ))}
                              <td className="px-3 py-2.5 text-right border-l border-white/20 whitespace-nowrap">{fmt(totalRow.total)}</td>
                              <td className={`px-3 py-2.5 ${meta.bg} text-x opacity-70 italic`}>Summary row</td>
                            </>
                          )}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && data.length === 0 && !error && (
        <div className="flex items-center justify-center h-32 text-sky-400 text-s bg-white rounded-xl border border-sky-100">
          No data available for the selected filters.
        </div>
      )}

      {/* ── AI INSIGHTS PANEL ── */}
      {keyMetrics && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-white border border-sky-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-sky-100 bg-gradient-to-r from-sky-50 to-purple-50">
            <FiZap className="text-purple-500" size={14} />
            <h3 className="text-s font-semibold text-sky-900">AI Performance Insights</h3>
            <span className="ml-auto text-[10px] text-sky-400 italic">Auto-generated · Updates every 3.5s</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
            {/* Left — key metrics */}
            <div className="space-y-1">
              {[
                { label: "Total Payroll",  value: keyMetrics.total_payroll  },
                { label: "Total Benefits", value: keyMetrics.total_benefits },
                { label: "Total Taxes",    value: keyMetrics.total_taxes    },
                { label: "Grand Total",    value: keyMetrics.grand_total    },
                { label: "Avg / Month",    value: keyMetrics.average_per_month },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center py-1.5 border-b border-sky-100 last:border-0 text-s">
                  <span className="text-sky-600">{item.label}</span>
                  <span className="font-semibold text-sky-900">{fmt(item.value)}</span>
                </div>
              ))}
            </div>

            {/* Right — rotating AI insight */}
            <div className="bg-gradient-to-br from-sky-50 to-purple-50 border border-sky-200 rounded-lg p-4 flex flex-col justify-between min-h-[120px]">
              <div className="flex items-center gap-2 mb-3">
                <FiZap size={12} className="text-purple-500" />
                <span className="text-x font-semibold text-sky-800">AI Insight</span>
                <span className="ml-auto text-[10px] text-purple-400 animate-pulse">● Live</span>
              </div>
              <AIDriverText messages={aiMessages} />
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-sky-100 text-sky-700 font-medium">Payroll: {fmt(keyMetrics.total_payroll)}</span>
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-violet-100 text-violet-700 font-medium">Benefits: {fmt(keyMetrics.total_benefits)}</span>
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-slate-100 text-slate-700 font-medium">Taxes: {fmt(keyMetrics.total_taxes)}</span>
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-100 text-emerald-700 font-medium">Total: {fmt(keyMetrics.grand_total)}</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

    </main>
  );
}