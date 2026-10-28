// src/components/Reports/FixedAsset/FixedAssetViewmore.jsx
// API: GET /api/v1/company/financial/fixed_asset_viewmore/{year}/{currency}
// Query params: period, category, comparison (month_on_month | year_on_year), currency_filter
//
// RESPONSE SHAPE:
//   json.all_categories[]     → string[]  (for filter dropdown)
//   json.data[]:              { account_name, category, "2024-01"…"2024-12", total, comparisons:{} }
//     category === "total"    → grand total summary row
//   json.keymetrics:          { total_asset_cost, current_asset_value }
//
// VALUES: raw numbers (2143206.28) OR pre-formatted strings ("2143.21 K")
//         → always display EXACTLY as received from API — never re-format

import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config/config";
import TableSkeleton from "../Skeleton/TableSkeleton";
import { motion, AnimatePresence } from "framer-motion";
import { CSVLink } from "react-csv";
import AddAutomation from "../FinancialReports/AddAutomation";
import ActionHoverLabel from "../FinancialReports/ActionHoverLabel";
import ViewMoreHeader, { VIEW_MORE_FILTER_BAR, VIEW_MORE_HEADER_BUTTON } from "./ViewMoreHeader";
import {
  FiFilter, FiDownload, FiPrinter, FiRefreshCw, FiZap, FiHardDrive,
  FiTrendingUp, FiTrendingDown,
} from "react-icons/fi";
import { getDecimalPrecision } from '../../utils/formatters';

/* ══════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════ */

const PERIODS = [
  { id: "all",             label: "All Periods"     },
  { id: "current_month",   label: "Current Month"   },
  { id: "last_month",      label: "Last Month"      },
  { id: "quarter_to_date", label: "Quarter to Date" },
  { id: "year_to_date",    label: "Year to Date"    },
];

const CURRENCY_OPTS = [
  { id: "actualvalue", label: "Actual"        },
  { id: "thousands",   label: "Thousands (K)" },
  { id: "millions",    label: "Millions (M)"  },
];

const COMPARISON_OPTS = [
  { id: "none",           label: "No Comparison"  },
  { id: "month_on_month", label: "Month on Month" },
  { id: "year_on_year",   label: "Year on Year"   },
];

const DEFAULT_FILTERS = {
  period:          "all",
  currency_filter: "actualvalue",
  comparison:      "none",
  category:        "",
};

// Category colour badges
const CATEGORY_COLORS = {
  "bldg & impr.":           "bg-amber-100  text-amber-800",
  "furniture / equipment":  "bg-sky-100    text-sky-800",
  "it hardware":            "bg-violet-100 text-violet-800",
  "land":                   "bg-emerald-100 text-emerald-800",
};
const getCategoryColor = (cat) =>
  CATEGORY_COLORS[(cat || "").toLowerCase().trim()] || "bg-slate-100 text-slate-700";

/* ══════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════ */

/**
 * Display value EXACTLY as API sends it.
 * number → localised string  (2143206.28 → "2,143,206.28")
 * string → trimmed as-is     ("2143.21 K" → "2143.21 K")
 * null   → "—"
 */
const fmt = (v) => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") {
    const cleaned = v.trim().replace(/[$,\s]/g, "");
    if (!cleaned || cleaned === "—" || cleaned === "-") return "—";
    if (/[a-zA-Z%]/.test(cleaned)) return v.trim() || "—";
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed)) return v.trim() || "—";
    v = parsed;
  }
  if (typeof v === "number") {
    if (!isFinite(v)) return "—";
    if (v === 0) return "0";
    const dp = getDecimalPrecision();
    return v.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }
  return String(v);
};

/* ══════════════════════════════════════════════════════
   SUB-COMPONENTS
══════════════════════════════════════════════════════ */

const SelectField = ({ label, value, options, onChange }) => (
  <div>
    <label className="block mb-1 text-sky-700 text-x font-semibold">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-sky-200 rounded-lg px-3 py-2 text-x bg-white text-sky-900
                 focus:outline-none focus:ring-2 focus:ring-sky-300"
    >
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  </div>
);

const MetricCard = ({ icon: Icon, label, value, colorClass = "sky" }) => {
  const palette = {
    sky:   "border-sky-200   bg-sky-50   text-sky-900   text-sky-600   text-sky-500",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900 text-emerald-600 text-emerald-500",
  };
  const [border, bg, valCol, labelCol, iconCol] = (palette[colorClass] || palette.sky).split(" ");
  return (
    <div className={`border ${border} ${bg} rounded-xl p-4 shadow-sm flex items-center gap-3`}>
      <div className={`p-2.5 rounded-lg ${bg} border ${border}`}>
        {Icon && <Icon size={16} className={iconCol} />}
      </div>
      <div>
        <p className={`text-[10px] font-bold uppercase tracking-widest ${labelCol}`}>{label}</p>
        <p className={`text-base font-bold mt-0.5 ${valCol}`}>{fmt(value)}</p>
      </div>
    </div>
  );
};

/** Rotating per-row AI insight ticker */
const RowAITicker = ({ category }) => {
  const messages = [
    "AI insights coming soon",
    "Asset analysis in progress",
    "Automated monitoring active",
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % messages.length), 3200);
    return () => clearInterval(t);
  }, []); // eslint-disable-line
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={idx}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.25 }}
        className=" text-[11p] italic text-purple-500 leading-snug block whitespace-nowrap"
      >
        ✦ {messages[idx]}
      </motion.span>
    </AnimatePresence>
  );
};

/** Rotating bottom AI panel text */
const AIDriverText = ({ messages }) => {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!messages?.length) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % messages.length), 3500);
    return () => clearInterval(t);
  }, [messages]);
  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={idx}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.4 }}
        className="text-s font-medium leading-relaxed
                   bg-gradient-to-r from-sky-500 to-purple-500 bg-clip-text text-transparent"
      >
        {messages[idx]}
      </motion.p>
    </AnimatePresence>
  );
};

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════ */

export default function FixedAssetRegister() {
  const { token, selectedYear: year, selectedCurrency } = useContext(AuthContext);
  const currency = selectedCurrency || "USD";

  /* ── state ── */
  const [rawData,       setRawData]       = useState([]);
  const [keyMetrics,    setKeyMetrics]    = useState(null);
  const [allCategories, setAllCategories] = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);

  const [draft,   setDraft]   = useState({ ...DEFAULT_FILTERS });
  const [applied, setApplied] = useState({ ...DEFAULT_FILTERS });
  const [open,    setOpen]    = useState(false);

  const panelRef = useRef(null);

  /* ── outside click ── */
  useEffect(() => {
    const h = (e) => panelRef.current && !panelRef.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  /* ── fetch ── */
  const fetchData = async (filters) => {
    if (!token || !year) return;
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      params.append("currency_filter", filters.currency_filter);
      params.append("period", filters.period === "all" ? "all" : filters.period);
      if (filters.category)             params.append("category",   filters.category);
      if (filters.comparison !== "none") params.append("comparison", filters.comparison);

      const res = await fetch(
        `${API_BASE_URL}/api/v1/company/financial/fixed_asset_viewmore/${year}/${currency}?${params}`,
        { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      setRawData(json.data            || []);
      setKeyMetrics(json.keymetrics   || null);
      setAllCategories(json.all_categories || []);
    } catch (e) {
      console.error("FixedAssetViewmore fetch error:", e);
      setError("Failed to load data. Please try again.");
      setRawData([]); setKeyMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(applied); }, [token, year, currency]); // eslint-disable-line

  /* ── filter helpers ── */
  const hasPending = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(applied),
    [draft, applied]
  );
  const updateDraft  = (key, val) => setDraft((f) => ({ ...f, [key]: val }));
  const applyFilters = () => { setApplied({ ...draft }); fetchData(draft); setOpen(false); };
  const resetAll     = () => {
    setDraft({ ...DEFAULT_FILTERS }); setApplied({ ...DEFAULT_FILTERS });
    fetchData({ ...DEFAULT_FILTERS }); setOpen(false);
  };
  const removeChip = (key, def) => {
    const next = { ...applied, [key]: def };
    setApplied(next); setDraft(next); fetchData(next);
  };

  /* ── active chips ── */
  const chips = [];
  if (applied.period !== "all")
    chips.push({ label: PERIODS.find((p) => p.id === applied.period)?.label, onRemove: () => removeChip("period", "all") });
  if (applied.currency_filter !== "actualvalue")
    chips.push({ label: CURRENCY_OPTS.find((c) => c.id === applied.currency_filter)?.label, onRemove: () => removeChip("currency_filter", "actualvalue") });
  if (applied.comparison !== "none")
    chips.push({ label: COMPARISON_OPTS.find((c) => c.id === applied.comparison)?.label, onRemove: () => removeChip("comparison", "none") });
  if (applied.category)
    chips.push({ label: `Category: ${applied.category}`, onRemove: () => removeChip("category", "") });

  /* ── month columns ── */
  const monthCols = useMemo(() => {
    const row = rawData.find((r) => r.category !== "total");
    if (!row) return [];
    return Object.keys(row).filter((k) => /^\d{4}-\d{2}$/.test(k)).sort();
  }, [rawData]);

  /* ── split data / total row ── */
  const categoryRows = useMemo(() => rawData.filter((r) => r.category !== "total"), [rawData]);
  const totalRow     = useMemo(() => rawData.find((r) => r.category === "total"),   [rawData]);

  /* ── category filter options for dropdown ── */
  const categoryOpts = useMemo(() => [
    { id: "", label: "All Categories" },
    ...allCategories.map((c) => ({ id: c, label: c.trim() })),
  ], [allCategories]);

  /* ── AI messages ── */
  const aiMessages = [
    "Fixed asset portfolio analysis loading — review monthly acquisition trends.",
    "Filter by category to drill into specific asset classes.",
    "Monitor large monthly spikes for capital expenditure planning.",
    "AI-powered asset lifecycle insights coming soon.",
    "Compare periods to identify seasonal investment patterns in your asset base.",
  ];

  /* ── CSV ── */
  const csvData = useMemo(() => {
    if (!rawData.length || !monthCols.length) return [];
    return [
      ["Category", ...monthCols, "Total", "AI Insight"],
      ...rawData.map((r) => [
        r.category, ...monthCols.map((m) => fmt(r[m])), fmt(r.total), "AI insights coming soon",
      ]),
    ];
  }, [rawData, monthCols]);

  /* ══════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════ */
  return (
    <main className="min-h-screen bg-slate-50 space-y-3">

      <ViewMoreHeader title="Fixed Asset Register" year={year} currency={currency}>
        <CSVLink
          data={csvData}
          filename={`Fixed_Asset_Viewmore_${year}_${currency}.csv`}
          aria-label="Download CSV"
          className={VIEW_MORE_HEADER_BUTTON}
        >
          <FiDownload />
          <ActionHoverLabel>Download CSV</ActionHoverLabel>
        </CSVLink>
        <AddAutomation reportType="fixed_asset_report" reportLabel="Fixed Asset Report" iconOnly />
        <button onClick={() => window.print()} aria-label="Print" className={VIEW_MORE_HEADER_BUTTON}>
          <FiPrinter />
          <ActionHoverLabel>Print</ActionHoverLabel>
        </button>
      </ViewMoreHeader>

      {/* ── KPI CARDS ── */}
      {keyMetrics && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          <MetricCard icon={FiHardDrive}   label="Total Asset Cost"     value={keyMetrics.total_asset_cost}     colorClass="sky"   />
          <MetricCard icon={FiTrendingUp}  label="Current Asset Value"  value={keyMetrics.current_asset_value}  colorClass="green" />
        </motion.div>
      )}

      {/* ── STICKY FILTER BAR ── */}
      <div ref={panelRef} className={`${VIEW_MORE_FILTER_BAR} sticky top-2 z-20`}>
        {/* Active chips */}
        <div className="flex items-center flex-wrap gap-2 flex-1">
          {chips.length === 0 ? (
            <span className="text-x text-sky-400 italic">No filters applied</span>
          ) : chips.map((c, i) => (
            <span key={i} className="flex items-center gap-1 px-3 py-1 text-x bg-sky-100 text-sky-800 rounded-full">
              {c.label}
              <button onClick={c.onRemove} className="ml-0.5 text-sky-500 hover:text-sky-900 font-bold leading-none">✕</button>
            </span>
          ))}
          {chips.length > 0 && (
            <button onClick={resetAll}
              className="flex items-center gap-1 px-2 py-1 text-x text-red-500 border border-red-200 rounded-full hover:bg-red-50 transition">
              <FiRefreshCw size={9} /> Reset All
            </button>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 relative flex-shrink-0">
          <button
            onClick={() => setOpen((o) => !o)}
            className={`flex items-center gap-2 px-2.5 py-1.5 text-x rounded-lg border font-semibold transition
              ${hasPending
                ? "bg-amber-50 border-amber-300 text-amber-800"
                : "bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100"}`}
          >
            <FiFilter size={13} /> Filters
            {hasPending && (
              <span className="px-1.5 py-0.5 text-[10px] bg-amber-400 text-white rounded-full font-bold">Pending</span>
            )}
          </button>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="absolute right-0 top-10 w-72 bg-sky-50 border border-sky-200 rounded-xl shadow-xl z-50 p-4 space-y-3"
              >
                <SelectField label="Period"     value={draft.period}          options={PERIODS}           onChange={(v) => updateDraft("period", v)} />
                <SelectField label="Currency"   value={draft.currency_filter} options={CURRENCY_OPTS}     onChange={(v) => updateDraft("currency_filter", v)} />
                <SelectField label="Comparison" value={draft.comparison}      options={COMPARISON_OPTS}   onChange={(v) => updateDraft("comparison", v)} />
                <SelectField label="Category"   value={draft.category}        options={categoryOpts}      onChange={(v) => updateDraft("category", v)} />
                <div className="flex gap-2 pt-1">
                  <button onClick={applyFilters}
                    className="flex-1 py-2 text-x font-semibold bg-sky-700 text-white rounded-lg hover:bg-sky-800 transition">
                    Apply
                  </button>
                  <button onClick={resetAll}
                    className="flex-1 py-2 text-x font-semibold bg-white text-sky-700 border border-sky-200 rounded-lg hover:bg-sky-50 transition">
                    Reset
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── LOADING / ERROR ── */}
      {loading && <TableSkeleton />}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-s text-red-600">{error}</div>
      )}

      {/* ══════════════════════════════════════════════════════
          PIVOT TABLE
      ══════════════════════════════════════════════════════ */}
      {!loading && !error && rawData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white"
        >
          {/* Table header strip */}
          <div className="bg-sky-900 px-4 py-2.5 flex items-center gap-3">
            <span className="text-s font-bold text-white uppercase tracking-wider">Fixed Assets</span>
            <span className="text-x text-sky-300 opacity-70">{categoryRows.length} categories</span>
            {applied.category && (
              <span className="ml-2 px-2 py-0.5 text-[10px] bg-sky-700 text-sky-200 rounded-full">
                Filtered: {applied.category.trim()}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-x text-sky-900 border-collapse">

              {/* ── HEADER ── */}
              <thead>
                <tr className="bg-sky-100 border-b border-sky-200">
                  {/* Sticky category col */}
                  <th className="sticky left-0 z-20 bg-sky-100 px-3 py-3 text-left font-semibold
                                 text-sky-800 whitespace-nowrap border-r border-sky-200 min-w-[180px]">
                    Category
                  </th>
                  {/* Month cols */}
                  {monthCols.map((m) => (
                    <th key={m} className="px-3 py-3 text-right font-semibold text-sky-800 whitespace-nowrap">
                      {m}
                    </th>
                  ))}
                  {/* Total */}
                  <th className="px-3 py-3 text-right font-semibold text-sky-800 border-l border-sky-200 whitespace-nowrap">
                    Total
                  </th>
                  {/* AI Insight */}
                  <th className="px-3 py-3 text-left font-semibold text-purple-600 border-l border-purple-100 whitespace-nowrap min-w-[160px]">
                    AI Insight
                  </th>
                </tr>
              </thead>

              {/* ── BODY ── */}
              <tbody>
                {categoryRows.map((row, idx) => (
                  <motion.tr
                    key={`${row.category}-${idx}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.04 }}
                    className="border-b border-sky-50 hover:bg-sky-50/70 transition-colors align-middle"
                  >
                    {/* Sticky category cell with colour badge */}
                    <td className="sticky left-0 z-10 bg-white px-3 py-3 font-medium border-r border-sky-100 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full  text-[11p] font-semibold ${getCategoryColor(row.category)}`}>
                        {row.category.trim()}
                      </span>
                    </td>

                    {/* Month values — raw from API */}
                    {monthCols.map((m) => (
                      <td key={m} className="px-3 py-3 text-right text-sky-800 whitespace-nowrap tabular-nums">
                        {fmt(row[m])}
                      </td>
                    ))}

                    {/* Total */}
                    <td className="px-3 py-3 text-right font-bold text-sky-900 border-l border-sky-200 whitespace-nowrap tabular-nums">
                      {fmt(row.total)}
                    </td>

                    {/* AI Insight — rotating ticker */}
                    <td className="px-3 py-3 bg-purple-50 border-l border-purple-100 min-w-[160px]">
                      <RowAITicker category={row.category} />
                    </td>
                  </motion.tr>
                ))}

                {/* ── GRAND TOTAL ROW ── */}
                {totalRow && (
                  <tr className="bg-sky-900 text-white font-bold border-t-2 border-sky-400">
                    <td className="sticky left-0 z-10 bg-sky-900 px-3 py-3 text-x uppercase
                                   tracking-wide whitespace-nowrap border-r border-white/20">
                      Grand Total
                    </td>
                    {monthCols.map((m) => (
                      <td key={m} className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                        {fmt(totalRow[m])}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-right border-l border-white/20 whitespace-nowrap tabular-nums">
                      {fmt(totalRow.total)}
                    </td>
                    {/* AI col spacer in total row */}
                    <td className="px-3 py-3 bg-sky-800 border-l border-white/10  text-[11p] italic opacity-60">
                      Summary row
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ── EMPTY STATE ── */}
      {!loading && !error && rawData.length === 0 && (
        <div className="flex items-center justify-center h-40 bg-white rounded-xl border border-sky-100 text-sky-400 text-s">
          No data available for the selected filters.
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          AI INSIGHTS PANEL
      ══════════════════════════════════════════════════════ */}
      {keyMetrics && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="bg-white border border-sky-200 rounded-xl shadow-sm overflow-hidden"
        >
          {/* Panel header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-sky-100
                           bg-gradient-to-r from-sky-50 to-purple-50">
            <FiZap className="text-purple-500" size={14} />
            <h3 className="text-s font-semibold text-sky-900">AI Performance Insights</h3>
            <span className="ml-auto text-[10px] text-purple-400 italic animate-pulse">● Live · refreshes every 3.5s</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            {/* Left — key metric rows */}
            <div className="p-4 border-r border-sky-100 space-y-0">
              {[
                { label: "Total Asset Cost",    value: keyMetrics.total_asset_cost    },
                { label: "Current Asset Value", value: keyMetrics.current_asset_value },
              ].map((item) => (
                <div key={item.label}
                  className="flex justify-between items-center py-2 border-b border-sky-50 last:border-0 text-s">
                  <span className="text-sky-600">{item.label}</span>
                  <span className="font-semibold text-sky-900">{fmt(item.value)}</span>
                </div>
              ))}

              {/* Category breakdown mini-list */}
              {categoryRows.length > 0 && (
                <div className="pt-3">
                  <p className="text-[10px] font-bold text-sky-500 uppercase tracking-widest mb-2">Category Breakdown</p>
                  {categoryRows.map((row) => (
                    <div key={row.category}
                      className="flex justify-between items-center py-1.5 border-b border-sky-50 last:border-0">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${getCategoryColor(row.category)}`}>
                        {row.category.trim()}
                      </span>
                      <span className="text-x font-semibold text-sky-900 tabular-nums">{fmt(row.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right — rotating AI text + summary pills */}
            <div className="p-4 bg-gradient-to-br from-sky-50 to-purple-50 flex flex-col justify-between gap-3 min-h-[160px]">
              <div className="flex items-center gap-2">
                <FiZap size={12} className="text-purple-500" />
                <span className="text-x font-semibold text-sky-800">AI Insight</span>
              </div>

              <div className="flex-1 flex items-center">
                <AIDriverText messages={aiMessages} />
              </div>

              {/* Summary pills */}
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-sky-200">
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-sky-100 text-sky-700 font-medium">
                  Total Cost: {fmt(keyMetrics.total_asset_cost)}
                </span>
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-100 text-emerald-700 font-medium">
                  Current Value: {fmt(keyMetrics.current_asset_value)}
                </span>
                {categoryRows.length > 0 && (
                  <span className="px-2 py-0.5 text-[10px] rounded-full bg-violet-100 text-violet-700 font-medium">
                    {categoryRows.length} Categories
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

    </main>
  );
}