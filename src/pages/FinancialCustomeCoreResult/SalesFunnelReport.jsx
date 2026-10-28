import React, { useContext, useEffect, useRef, useState, useMemo } from "react";
import { AuthContext } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config/config";
import TableSkeleton from "../Skeleton/TableSkeleton";
import AskAI from "../FinancialReports/AskAI";
import AddAutomation from "../FinancialReports/AddAutomation";
import ActionHoverLabel from "../FinancialReports/ActionHoverLabel";
import ViewMoreHeader, { VIEW_MORE_FILTER_BAR, VIEW_MORE_HEADER_BUTTON } from "./ViewMoreHeader";
import { CSVLink } from "react-csv";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiFilter, FiTrendingUp, FiTrendingDown,
  FiDownload, FiPrinter, FiRefreshCw, FiZap,
} from "react-icons/fi";
import { getDecimalPrecision } from '../../utils/formatters';

/* ══════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════ */
const PERIODS = [
  { id: "all",               label: "All Periods" },
  { id: "current_month",     label: "Current Month" },
  { id: "last_month",        label: "Last Month" },
  { id: "quarter_to_date",   label: "Quarter to Date" },
  { id: "year_to_date",      label: "Year to Date" },
];

const CURRENCY_FILTERS = [
  { id: "actualvalue", label: "Actual" },
  { id: "thousands",   label: "Thousands" },
  { id: "millions",    label: "Millions" },
];

const COMPARISON_FILTERS = [
  { id: "none",           label: "No Comparison" },
  { id: "month_on_month", label: "Month on Month" },
  { id: "year_on_year",   label: "Year on Year" },
];

const DEFAULT_FILTERS = {
  period:          "all",
  currency_filter: "actualvalue",
  comparison:      "none",
};

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
const fmt = (v) => {
  if (v === null || v === undefined) return "--";
  if (typeof v === "number") return v.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() });
  return String(v);
};

const fmtPct = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? "--" : `${n.toFixed(getDecimalPrecision())}%`;
};

const VariancePill = ({ value }) => {
  const n = parseFloat(value);
  if (isNaN(n) || n === 0)
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-400">• 0</span>;
  if (n > 0)
    return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-600"><FiTrendingUp size={9}/>+{Math.abs(n)}</span>;
  return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-500"><FiTrendingDown size={9}/>-{Math.abs(n)}</span>;
};

/* Stage badge colour */
const STAGE_COLORS = {
  "Prospecting":   "bg-violet-100 text-violet-700",
  "Qualification": "bg-blue-100   text-blue-700",
  "Proposal":      "bg-sky-100    text-sky-700",
  "Negotiation":   "bg-amber-100  text-amber-700",
  "Closed Won":    "bg-emerald-100 text-emerald-700",
  "Closed Lost":   "bg-red-100    text-red-600",
};

/* ══════════════════════════════════════════
   SUB-COMPONENTS
══════════════════════════════════════════ */
const SelectField = ({ label, value, options, onChange }) => (
  <div className="mb-3">
    <label className="block mb-1 text-sky-700 text-x font-medium">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-sky-200 rounded-lg p-2 text-x bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
    >
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  </div>
);

const MetricCard = ({ label, value, sub }) => (
  <div className="bg-gradient-to-r from-sky-700 to-sky-900 border border-sky-100 rounded-xl p-2 px-4 shadow-sm">
    <p className=" text-[11p] text-white font-medium uppercase tracking-wide">{label}</p>
    <p className="mt-1 text-xl font-bold text-white">{value}</p>
    {sub && <p className="mt-0.5 text-[10px] text-sky-400">{sub}</p>}
  </div>
);

/* Rotating AI insight per row */
const RowAITicker = ({ stage }) => {
  const pool = useMemo(() => {
    const map = {
      "Prospecting":   ["Top-of-funnel volume stable", "Monitor lead source quality", "AI suggests A/B testing outreach"],
      "Qualification": ["Qualification rate on track", "Review ICP alignment", "AI detects drop-off risk"],
      "Proposal":      ["Proposal win-rate improving", "Follow-up cadence matters here", "AI suggests pricing review"],
      "Negotiation":   ["Cycle length increasing at this stage", "AI flags discount overuse", "Escalation path may help"],
      "Closed Won":    ["Strong close rate detected", "AI suggests replicating top rep tactics", "Upsell potential flagged"],
      "Closed Lost":   ["Loss rate needs attention", "AI suggests competitive analysis", "Review lost-deal feedback"],
    };
    return map[stage] || ["AI insights loading…"];
  }, [stage]);

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % pool.length), 3200);
    return () => clearInterval(t);
  }, [pool]);

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={idx}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.25 }}
        className=" text-[11p] italic text-purple-600 whitespace-nowrap"
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
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.4 }}
        className="text-s font-medium bg-gradient-to-r from-sky-500 to-purple-500 bg-clip-text text-transparent leading-relaxed"
      >
        {messages[index]}
      </motion.div>
    </AnimatePresence>
  );
};

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
export default function SalesFunnelReport() {
  const { token, selectedYear: year, selectedCurrency } = useContext(AuthContext);

  const [data,    setData]    = useState([]);   // api.data[]
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const [draftFilters,   setDraftFilters]   = useState({ ...DEFAULT_FILTERS });
  const [appliedFilters, setAppliedFilters] = useState({ ...DEFAULT_FILTERS });
  const [hasPending,     setHasPending]     = useState(false);
  const [open,           setOpen]           = useState(false);
  const ref = useRef(null);

  /* ── derive month columns from first data row ── */
  const monthCols = useMemo(() => {
    if (!data.length) return [];
    return Object.keys(data[0]).filter((k) =>
      /^\d{4}-\d{2}$/.test(k)
    ).sort();
  }, [data]);

  /* ── comparison active = first row has non-empty comparisons[] ── */
  const comparisonActive = useMemo(
    () => data.length > 0 && Array.isArray(data[0].comparisons) && data[0].comparisons.length > 0,
    [data]
  );

  /* ── outside click ── */
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  /* ══ FETCH ══ */
  const fetchData = async (filters) => {
    if (!token || !year || !selectedCurrency) return;
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      params.append("currency_filter", filters.currency_filter);
      params.append("period", filters.period);
      if (filters.comparison !== "none") params.append("comparison", filters.comparison);

      const res = await fetch(
        `${API_BASE_URL}/api/v1/company/financial/Sales_Funnel_Metrics_Viewmore/${year}/${selectedCurrency}?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("API error");
      const api = await res.json();
      setData(api.data || []);
      setMetrics(api.key_metrics || null);
    } catch (e) {
      console.error(e);
      setError("Failed to load data.");
      setData([]); setMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(appliedFilters); }, [token, year, selectedCurrency, appliedFilters]); // eslint-disable-line

  /* ══ FILTER ACTIONS ══ */
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

  /* ── csv ── */
  const csvData = useMemo(() => {
    return data.map((row) => {
      const obj = { Stage: row.stage };
      monthCols.forEach((m) => { obj[m] = row[m] ?? "--"; });
      obj["Total"] = row.total ?? "--";
      return obj;
    });
  }, [data, monthCols]);

  /* ── ai messages ── */
  const aiMessages = useMemo(() => {
    if (!metrics) return ["Analyzing sales funnel data…"];
    return [
      `Overall conversion rate is ${fmtPct(metrics.overall_conversion)} across all funnel stages.`,
      `${fmt(metrics.total_leads)} total leads entered the funnel — ${fmt(metrics.total_won)} closed as won.`,
      `Average sales cycle is ${metrics.average_sales_cycle_days} days. Reducing this can significantly boost revenue.`,
      comparisonActive
        ? "Comparison mode active — variance columns highlight month-over-month trends per stage."
        : "Enable Month-on-Month comparison to reveal period-over-period trends for each stage.",
    ];
  }, [metrics, comparisonActive]);

  /* ══════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════ */
  return (
    <main className="bg-slate-50 min-h-screen space-y-3">

      {/* The comparison in use shows as a chip in the filter bar below. */}
      <ViewMoreHeader title="Sales Funnel Metrics" year={year} currency={selectedCurrency}>
        <CSVLink
          data={csvData}
          filename={`SalesFunnelViewmore_${year}.csv`}
          aria-label="Download CSV"
          className={VIEW_MORE_HEADER_BUTTON}
        >
          <FiDownload />
          <ActionHoverLabel>Download CSV</ActionHoverLabel>
        </CSVLink>
        <AddAutomation reportType="sales_funnel_metrics" reportLabel="Sales Funnel Metrics Report" iconOnly />
        <button onClick={() => window.print()} aria-label="Print" className={VIEW_MORE_HEADER_BUTTON}>
          <FiPrinter />
          <ActionHoverLabel>Print</ActionHoverLabel>
        </button>
        <AskAI reportId="sales_funnel" />
      </ViewMoreHeader>

      {/* ── KEY METRIC CARDS ── */}
      {metrics && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          <MetricCard label="Total Leads"          value={fmt(metrics.total_leads)} />
          <MetricCard label="Total Won"             value={fmt(metrics.total_won)} />
          <MetricCard label="Overall Conversion"    value={fmtPct(metrics.overall_conversion)} />
          <MetricCard label="Avg Sales Cycle"       value={`${metrics.average_sales_cycle_days}d`} sub="Average days to close" />
        </motion.div>
      )}

      {/* ── FILTER BAR ── */}
      <div className={`${VIEW_MORE_FILTER_BAR} sticky top-2 z-20`} ref={ref}>
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
          {activeChips.length === 0 && (
            <span className="text-x text-sky-400">No filters applied</span>
          )}
        </div>

        {/* Controls */}
        <div className="relative flex items-center gap-2">
          {/* Filter button */}
          <button
            onClick={() => setOpen(!open)}
            className={`flex items-center gap-2 px-2.5 py-1.5 text-x font-semibold rounded-lg transition ${
              hasPending ? "bg-amber-100 text-amber-700 border border-amber-300" : "bg-sky-100 text-sky-800"
            }`}
          >
            <FiFilter size={13} /> Filters
            {hasPending && <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-amber-400 text-white rounded-full">Pending</span>}
          </button>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="absolute right-0 top-10 mt-1 w-72 bg-sky-50 border border-sky-200 rounded-xl shadow-xl z-50 p-4"
              >
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
        </div>
      </div>

      {/* ── TABLE ── */}
      {loading && <TableSkeleton />}
      {error   && <p className="text-red-500 text-s px-1">{error}</p>}

      {!loading && data.length > 0 && (
        <div className="overflow-auto border border-sky-200 rounded-xl bg-white shadow-sm">
          <table className="w-full text-x text-sky-900 border-collapse">

            {/* ════════════════════════════════════
                COMPARISON TABLE HEADER
                Row 1: group labels (base_period | compare_period | variance) per month
                Row 2: actual sub-labels
            ════════════════════════════════════ */}
            {comparisonActive ? (() => {
              // build comparison map for first row: month → { base_period, compare_period }
              const compMap = {};
              (data[0]?.comparisons || []).forEach((c) => {
                compMap[c.base_period] = c;
              });

              return (
                <thead className="sticky top-0 z-10">
                  {/* ── Row 1: group labels ── */}
                  <tr className="bg-sky-50 border-b border-sky-100">
                    {/* Stage + AI driven — no group */}
                    <th className="sticky left-0 z-20 bg-sky-50 px-3 py-1.5 min-w-[130px]" />
                    <th className="px-3 py-1.5 min-w-[180px]" />

                    {/* Per month: group spanning 3 sub-cols */}
                    {monthCols.map((m) => (
                      <th
                        key={m}
                        colSpan={3}
                        className="px-2 py-1.5 text-center text-[10px] font-bold text-sky-700 uppercase tracking-widest border-l border-sky-200 whitespace-nowrap"
                      >
                        {m}
                      </th>
                    ))}

                    {/* Total — no group */}
                    <th className="px-3 py-1.5 border-l border-sky-200" />
                  </tr>

                  {/* ── Row 2: sub-column headers with period labels ── */}
                  <tr className="bg-sky-100 border-b border-sky-200">
                    <th className="sticky left-0 z-20 bg-sky-100 px-3 py-2 text-left text-x font-semibold text-sky-800 whitespace-nowrap min-w-[150px]">
                      Stage
                    </th>
                    

                    {monthCols.map((m) => {
                      const c = compMap[m];
                      return (
                        <React.Fragment key={m}>
                          <th className="px-2 py-2 text-left border-l border-sky-200 whitespace-nowrap">
                            <span className="block text-[10px] font-semibold text-sky-800">Current</span>
                            <span className="block text-[9px] font-normal text-sky-400 mt-0.5">{c?.base_period ?? m}</span>
                          </th>
                          <th className="px-2 py-2 text-left whitespace-nowrap">
                            <span className="block text-[10px] font-semibold text-sky-800">Previous</span>
                            <span className="block text-[9px] font-normal text-sky-400 mt-0.5">{c?.compare_period ?? "--"}</span>
                          </th>
                          <th className="px-2 py-2 text-left whitespace-nowrap">
                            <span className="block text-[10px] font-semibold text-sky-800">Variance</span>
                            <span className="block text-[9px] font-normal text-sky-400 mt-0.5">&nbsp;</span>
                          </th>
                        </React.Fragment>
                      );
                    })}

                    <th className="px-3 py-2 text-left text-x font-semibold text-sky-800 border-l border-sky-200 whitespace-nowrap">
                      Total
                    </th>
                    <th className="px-3 py-2 text-left text-x font-semibold text-sky-800 whitespace-nowrap min-w-[180px]">
                      AI Insight
                    </th>
                  </tr>
                </thead>
              );
            })() : (
              /* ════════════════════════════════════
                 NORMAL TABLE HEADER
              ════════════════════════════════════ */
              <thead className="sticky top-0 z-10 bg-sky-100 border-b border-sky-200">
                <tr>
                  <th className="sticky left-0 z-20 bg-sky-100 px-3 py-2 text-left text-x font-semibold text-sky-800 whitespace-nowrap min-w-[150px]">
                    Stage
                  </th>
                  {monthCols.map((m) => (
                    <th key={m} className="px-3 py-2 text-left text-x font-semibold text-sky-800 whitespace-nowrap">
                      {m}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-left text-x font-semibold text-sky-800 border-l border-sky-200 whitespace-nowrap">Total</th>
                  <th className="px-3 py-2 text-left text-x font-semibold text-sky-800 whitespace-nowrap min-w-[180px]">AI Insight</th>
                </tr>
              </thead>
            )}

            {/* ════════ BODY ════════ */}
            <tbody>
              {data.map((row, idx) => {
                // build comparison lookup: base_period → comparison object
                const compMap = {};
                (row.comparisons || []).forEach((c) => { compMap[c.base_period] = c; });

                const stageCls = STAGE_COLORS[row.stage] || "bg-sky-100 text-sky-700";

                return (
                  <motion.tr
                    key={row.stage}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: idx * 0.04 }}
                    className="border-b border-sky-50 hover:bg-sky-50 transition align-middle"
                  >
                    {/* ── Stage label (sticky) ── */}
                    <td className="sticky left-0 bg-white px-3 py-2 border-r border-sky-100 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full  text-[11p] font-semibold `}>
                        {row.stage}
                      </span>
                    </td>

                    {comparisonActive ? (
                      <>
                      

                        {/* Per-month: current | previous | variance */}
                        {monthCols.map((m) => {
                          const c = compMap[m];
                          return (
                            <React.Fragment key={m}>
                              <td className="px-2 py-2 font-semibold text-sky-900 border-l border-sky-100">
                                {fmt(row[m])}
                              </td>
                              <td className="px-2 py-2 text-sky-500">
                                {c ? fmt(c.compare_count) : "--"}
                              </td>
                              <td className="px-2 py-2">
                                {c ? <VariancePill value={c.varienc} /> : "--"}
                              </td>
                            </React.Fragment>
                          );
                        })}

                        {/* Total */}
                        <td className="px-3 py-2 font-bold text-sky-900 border-l border-sky-200">
                          {fmt(row.total)}
                        </td>
                          {/* AI insight column (comparison mode) */}
                        <td className="px-3 py-2 bg-white border-r border-purple-100 min-w-[180px]">
                          <RowAITicker stage={row.stage} />
                        </td>
                      </>
                    ) : (
                      <>
                        {/* Normal mode: one value per month */}
                        {monthCols.map((m) => (
                          <td key={m} className="px-3 py-2 text-sky-800">{fmt(row[m])}</td>
                        ))}
                        <td className="px-3 py-2 font-bold text-sky-900 border-l border-sky-200">{fmt(row.total)}</td>
                        {/* AI insight column (normal mode) */}
                        <td className="px-3 py-2 bg-white border-l border-purple-100 min-w-[180px]">
                          <RowAITicker stage={row.stage} />
                        </td>
                      </>
                    )}
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && data.length === 0 && !error && (
        <div className="flex items-center justify-center h-32 text-sky-400 text-s bg-white rounded-xl border border-sky-100">
          No data available for the selected filters.
        </div>
      )}

      {/* ── AI INSIGHTS PANEL ── */}
      {metrics && (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-white border border-sky-200 rounded-xl shadow-sm overflow-hidden"
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-sky-100 bg-gradient-to-r from-sky-50 to-purple-50">
            <FiZap className="text-purple-500" size={14} />
            <h3 className="text-s font-semibold text-sky-900">AI Performance Insights</h3>
            {/* <span className="ml-auto text-[10px] text-sky-400 italic">Auto-generated · Updates every 3.5s</span> */}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
            {/* Left — summary metrics */}
            <div className="space-y-2">
              <div className="flex justify-between items-center py-1.5 border-b border-sky-100 text-s">
                <span className="text-sky-600">Total Leads</span>
                <span className="font-semibold text-sky-900">{fmt(metrics.total_leads)}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-sky-100 text-s">
                <span className="text-sky-600">Total Won</span>
                <span className="font-semibold text-emerald-600">{fmt(metrics.total_won)}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-sky-100 text-s">
                <span className="text-sky-600">Overall Conversion</span>
                <span className="font-semibold text-sky-900">{fmtPct(metrics.overall_conversion)}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 text-s">
                <span className="text-sky-600">Avg Sales Cycle</span>
                <span className="font-semibold text-sky-900">{metrics.average_sales_cycle_days} days</span>
              </div>
            </div>

            {/* Right — rotating AI insight */}
            <div className="bg-gradient-to-br from-sky-50 to-purple-50 border border-sky-200 rounded-lg p-4 flex flex-col justify-between min-h-[100px]">
              <div className="flex items-center gap-2 mb-3">
                <FiZap size={12} className="text-purple-500" />
                <span className="text-x font-semibold text-sky-800">AI Insight</span>
                <span className="ml-auto text-[10px] text-purple-400 animate-pulse">● Live</span>
              </div>
              <AIDriverText messages={aiMessages} />
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-sky-100 text-sky-600 font-medium">Leads: {fmt(metrics.total_leads)}</span>
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-100 text-emerald-600 font-medium">Won: {fmt(metrics.total_won)}</span>
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-purple-100 text-purple-600 font-medium">Conv: {fmtPct(metrics.overall_conversion)}</span>
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-amber-100 text-amber-600 font-medium">Cycle: {metrics.average_sales_cycle_days}d</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

    </main>
  );
}