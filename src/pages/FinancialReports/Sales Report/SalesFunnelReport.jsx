import React, { useCallback, useContext, useEffect, useRef, useState, useMemo } from "react";
import { AuthContext } from "../../../context/AuthContext";
import { API_BASE_URL } from "../../../config/config";
import { cachedFetch } from "../../../utils/reportCache";
import ReportsLayout from "../ReportsLayout";
import TableSkeleton from "../../Skeleton/TableSkeleton";
import AddAutomation from "../AddAutomation";
import AIActionsMenu from "../AIActionsMenu";
import ActionHoverLabel from "../ActionHoverLabel";
import ReportCommentary from "../ReportCommentary";
import { buildReportAIContext, rankForAI, toNumberForAI } from "../reportAIContext";
import useReportCommentary from "../../../hooks/useReportCommentary";
import ExportMenu from "../ExportMenu";
import { collectCommentary, commentaryCount, csvWithCommentary, downloadCsv } from "../reportExport";
import { motion, AnimatePresence } from "framer-motion";
import { FiFilter, FiTrendingUp, FiTrendingDown, FiPrinter } from "react-icons/fi";
import { FaArrowRightToBracket } from "react-icons/fa6";
import { Link } from "react-router-dom";
import { getDecimalPrecision } from '../../../utils/formatters';

/* ================== CONSTANTS ================== */
const PERIODS = [
  { id: "all", label: "All Periods" },
  { id: "current_month", label: "Current Month" },
  { id: "last_month", label: "Last Month" },
  { id: "quarter_to_date", label: "Quarter to Date" },
  { id: "year_to_date", label: "Year to Date" },
];

const CURRENCY_FILTERS = [
  { id: "actualvalue", label: "Actual" },
  { id: "thousands", label: "Thousands" },
  { id: "millions", label: "Millions" },
];

const COMPARISONS = [
  { id: "none", label: "No Comparison" },
  { id: "month_on_month", label: "Month on Month" },
  { id: "year_on_year", label: "Year on Year" },
];

const DEFAULT_FILTERS = {
  period: "all",
  region: "All",
  product: "All",
  currency_filter: "actualvalue",
  comparison: "none",
};

const SORT_BY_OPTIONS = [
  { id: "stage", label: "Stage" },
  { id: "count", label: "Count" },
  { id: "conversion_rate", label: "Conv. Rate" },
];

const SORT_ORDER_OPTIONS = [
  { id: "asc", label: "Ascending ↑" },
  { id: "desc", label: "Descending ↓" },
];

// Pipeline order of the CRM stages (the backend returns them unordered).
const FUNNEL_STAGE_ORDER = ["prospecting", "qualification", "proposal", "negotiation", "closed won", "closed lost"];
// Unrecognised stages sit between the open pipeline and the closed stages.
const funnelStageRank = (stage) => {
  const i = FUNNEL_STAGE_ORDER.indexOf(String(stage || "").trim().toLowerCase());
  return i === -1 ? 3.5 : i;
};

/* ================== HELPERS ================== */
const fmt = (v) => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") {
    const t = v.trim();
    if (!t || t === "--") return "—";
    const n = parseFloat(t.replace(/,/g, ""));
    if (!isNaN(n) && /[KMB]$/i.test(t)) return t;
    if (!isNaN(n)) return n.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() });
    return t;
  }
  if (typeof v === "number") return v.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() });
  return String(v);
};

const fmtPct = (v) => {
  const n = parseFloat(v);
  if (isNaN(n)) return "—";
  return `${n.toFixed(getDecimalPrecision())}%`;
};

/* ── Analytical narrative builder ──
   Deep, data-driven analysis per stage. Closed Won/Lost get a real win-rate
   read; open pipeline stages get compared against each other to flag where
   deals may be pooling rather than progressing. Everything is computed
   from the real counts, nothing here is a fixed template string. */
const _sfNum = (v) => {
  if (typeof v === "string") {
    const n = Number(v.replace(/[$,%\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return Number(v) || 0;
};

const buildSalesFunnelStageInsight = (row, allRows) => {
  const stage = row?.stage || "";
  const count = _sfNum(row?.count);
  if (!count) return "—";

  const won = allRows.find((r) => /won/i.test(r.stage || ""));
  const lost = allRows.find((r) => /lost/i.test(r.stage || ""));
  const wonCount = _sfNum(won?.count);
  const lostCount = _sfNum(lost?.count);
  const totalClosed = wonCount + lostCount;
  const winRate = totalClosed ? (wonCount / totalClosed) * 100 : null;

  if (/won/i.test(stage)) {
    return winRate !== null
      ? `This stage represents a ${winRate.toFixed(0)}% win rate across all closed opportunities${(100 - winRate) < 1 ? " - essentially every deal that closes here ends up won" : ` - the remaining ${(100 - winRate).toFixed(0)}% of closed deals ended up lost instead`}.`
      : `No closed-lost data is available in this selection to compute a win rate against.`;
  }
  if (/lost/i.test(stage)) {
    return winRate !== null
      ? `This stage accounts for ${(100 - winRate).toFixed(0)}% of closed opportunities - only ${winRate.toFixed(0)}% of deals that reach a close end up won, which is worth investigating for a common loss cause.`
      : `No closed-won data is available in this selection to compute a win rate against.`;
  }

  const openStages = allRows.filter((r) => !/won|lost/i.test(r.stage || ""));
  const openCounts = openStages.map((r) => _sfNum(r.count));
  const avgOpen = openCounts.length ? openCounts.reduce((a, b) => a + b, 0) / openCounts.length : 0;
  const share = avgOpen ? ((count - avgOpen) / avgOpen) * 100 : 0;

  if (Math.abs(share) < 15) {
    return `${stage} is in line with other active pipeline stages by volume - no unusual buildup here.`;
  }
  return share > 0
    ? `${stage} is running ${share.toFixed(0)}% above the average active stage by volume, suggesting deals may be pooling here rather than progressing smoothly toward close.`
    : `${stage} is running ${Math.abs(share).toFixed(0)}% below the average active stage by volume - either a fast pass-through stage or a thin part of the pipeline worth building up.`;
};

const SF_NOT_ENOUGH_DATA = ["Not enough funnel activity in this selection to analyze win rate and pipeline flow - widen the filters for a deeper read."];

const buildSalesFunnelExecutive = (allRows) => {
  const real = (allRows || []).filter((r) => r?.stage);
  if (!real.length) return SF_NOT_ENOUGH_DATA;

  const won = real.find((r) => /won/i.test(r.stage));
  const lost = real.find((r) => /lost/i.test(r.stage));
  const wonCount = _sfNum(won?.count);
  const lostCount = _sfNum(lost?.count);
  const totalClosed = wonCount + lostCount;

  const openStages = real.filter((r) => !/won|lost/i.test(r.stage));
  const openCounts = openStages.map((r) => ({ stage: r.stage, count: _sfNum(r.count) }));
  const totalOpen = openCounts.reduce((s, r) => s + r.count, 0);
  const busiest = openCounts.length ? openCounts.reduce((a, b) => (b.count > a.count ? b : a)) : null;

  if (!totalClosed && !totalOpen) return SF_NOT_ENOUGH_DATA;
  const winRate = totalClosed ? (wonCount / totalClosed) * 100 : null;

  const totalTracked = totalClosed + totalOpen;
  const openSharePct = totalTracked ? (totalOpen / totalTracked) * 100 : 0;
  const para1 = winRate !== null
    ? `${winRate.toFixed(0)}% of closed opportunities were won${totalOpen ? `, and ${openSharePct.toFixed(0)}% of all tracked opportunities are still active in the pipeline rather than resolved` : ""}.`
    : `No closed-deal data is available in this selection to compute a win rate.`;
  const busiestSharePct = busiest && totalOpen ? (busiest.count / totalOpen) * 100 : 0;
  const para2 = busiest
    ? `${busiest.stage} currently holds the most open opportunities - ${busiestSharePct.toFixed(0)}% of the entire open pipeline sits in this one stage, making it the stage most likely to benefit from focused attention to keep deals moving rather than stalling.`
    : `No open pipeline stages have meaningful volume right now - most activity has already resolved to closed won or lost.`;

  return [para1, para2];
};

const getVarianceUI = (variance) => {
  const n = parseFloat(variance);
  if (isNaN(n) || n === 0)
    return <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">• 0</span>;
  if (n > 0)
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600 whitespace-nowrap"><FiTrendingUp size={10} />+{Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-500 whitespace-nowrap"><FiTrendingDown size={10} />-{Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</span>;
};

/* ================== SUB-COMPONENTS ================== */
const SelectField = ({ label, value, options, onChange }) => (
  <div className="mb-3">
    <label className="block mb-1 text-sky-700 text-x font-medium">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-sky-200 rounded-lg p-2 text-x bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.label}</option>
      ))}
    </select>
  </div>
);

const MetricRow = ({ label, value }) => (
  <div className="flex justify-between items-center py-1.5 border-b border-sky-100 last:border-0 text-s">
    <span className="text-sky-700">{label}</span>
    <span className="font-semibold text-sky-900">{value ?? "—"}</span>
  </div>
);

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
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.4 }}
        className="text-s font-medium bg-gradient-to-r from-sky-500 to-purple-500 bg-clip-text text-transparent leading-relaxed"
      >
        {messages[index]}
      </motion.div>
    </AnimatePresence>
  );
};

/* ================== MAIN COMPONENT ================== */
export default function SalesFunnelReportData() {
  const { token, selectedYear: year, selectedCurrency } = useContext(AuthContext);

  const [rows, setRows] = useState([]);
  const salesFunnelExecutive = useMemo(() => buildSalesFunnelExecutive(rows), [rows]);
  const [metrics, setMetrics] = useState(null);
  const [apiPeriods, setApiPeriods] = useState([]);
  const [grandTotal, setGrandTotal] = useState(null);
  const [regions, setRegions] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPeriodCols, setShowPeriodCols] = useState(false);
  const [showProduct, setShowProduct] = useState(false);
  const [showRegion, setShowRegion] = useState(false);

  const [draftFilters, setDraftFilters] = useState({ ...DEFAULT_FILTERS });
  const [appliedFilters, setAppliedFilters] = useState({ ...DEFAULT_FILTERS });
  const [hasPending, setHasPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({ sort_by: "stage", sort_order: "asc" });
  const ref = useRef(null);
  const sortRef = useRef(null);

  const isComparisonOn = appliedFilters.comparison !== "none";

  /* ── outside click ── */
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    const close = (e) => sortRef.current && !sortRef.current.contains(e.target) && setSortOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  /* ── memos ── */
  const sortedRows = useMemo(() => {
    if (!rows.length) return rows;
    const { sort_by, sort_order } = sortConfig;
    return [...rows].sort((a, b) => {
      const av = sort_by === "stage" ? (a[sort_by] || "") : (Number(a[sort_by]) || 0);
      const bv = sort_by === "stage" ? (b[sort_by] || "") : (Number(b[sort_by]) || 0);
      if (av < bv) return sort_order === "asc" ? -1 : 1;
      if (av > bv) return sort_order === "asc" ? 1 : -1;
      return 0;
    });
  }, [rows, sortConfig]);

  const periodPivot = useMemo(() => {
    if (!showPeriodCols || !sortedRows.length || !apiPeriods.length)
      return { periods: [], pivot: [] };
    return {
      periods: apiPeriods,
      pivot: sortedRows.map((r) => ({
        stage: r.stage,
        product_name: r.product_name,
        region: r.region,
        months: r.months || {},
        total: r.total || {},
      })),
    };
  }, [sortedRows, showPeriodCols, apiPeriods]);

  const comparisonPivot = useMemo(() => {
    if (!isComparisonOn || !sortedRows.length || !apiPeriods.length)
      return { periods: [], pivot: [] };
    return {
      periods: apiPeriods,
      pivot: sortedRows.map((r) => ({
        stage: r.stage,
        product_name: r.product_name,
        region: r.region,
        months: r.months || {},
        total: r.total || {},
      })),
    };
  }, [sortedRows, isComparisonOn, apiPeriods]);

  const periodGrandTotals = useMemo(() => {
    if (!showPeriodCols) return {};
    return grandTotal?.months || {};
  }, [grandTotal, showPeriodCols]);

  const getComparePeriod = useCallback((period) => {
    for (const r of rows) {
      const cp = r.months?.[period]?.comparison?.compare_period;
      if (cp) return cp;
    }
    return "";
  }, [rows]);

  /* ── fetch ── */
  const fetchData = useCallback(async (filters) => {
    if (!token || !year || !selectedCurrency) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("show_period", "true");
      if (showProduct) params.append("show_product_name", "true");
      if (showRegion)  params.append("show_region", "true");
      params.append("currency_filter", filters.currency_filter);
      if (filters.period !== "all") params.append("period", filters.period);
      if (filters.region !== "All") params.append("region", filters.region);
      if (filters.product !== "All") params.append("product", filters.product);
      if (filters.comparison !== "none") params.append("comparison", filters.comparison);

      const api = await cachedFetch(
        `${API_BASE_URL}/api/v1/company/financial/Sales_Funnel_Metrics/${year}/${selectedCurrency}?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const records = Array.isArray(api?.records) ? api.records : [];
      const flatRows = records.map((r) => ({
        ...r,
        count: r.total?.count ?? null,
        conversion_rate: r.total?.conversion_rate ?? null,
      }));

      setRows(flatRows);
      setMetrics(api?.key_metrics || null);
      setApiPeriods(Array.isArray(api?.periods) ? api.periods : []);
      setGrandTotal(api?.grand_total || null);

      const rawRegions = Array.isArray(api?.regions) ? api.regions : [];
      const rawProducts = Array.isArray(api?.products) ? api.products : [];
      setRegions([{ id: "All", label: "All" }, ...rawRegions.filter(r => r !== "All").map(r => ({ id: r, label: r }))]);
      setProducts([{ id: "All", label: "All" }, ...rawProducts.filter(p => p !== "All").map(p => ({ id: p, label: p }))]);
    } catch (e) {
      console.error(e);
      setRows([]);
      setApiPeriods([]);
      setGrandTotal(null);
    } finally {
      setLoading(false);
    }
  }, [token, year, selectedCurrency, showProduct, showRegion]);

  useEffect(() => {
    fetchData(appliedFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, year, selectedCurrency, fetchData]);

  /* ── filter actions ── */
  const updateDraft = (key, value) => {
    const next = { ...draftFilters, [key]: value };
    setDraftFilters(next);
    setHasPending(JSON.stringify(next) !== JSON.stringify(appliedFilters));
  };

  const applyFilters = () => {
    setAppliedFilters({ ...draftFilters });
    setHasPending(false);
    setOpen(false);
    fetchData(draftFilters);
  };

  const resetAll = () => {
    setDraftFilters({ ...DEFAULT_FILTERS });
    setAppliedFilters({ ...DEFAULT_FILTERS });
    setHasPending(false);
    setOpen(false);
    fetchData(DEFAULT_FILTERS);
  };

  const removeFilter = (key, defaultVal) => {
    const next = { ...appliedFilters, [key]: defaultVal };
    setAppliedFilters(next);
    setDraftFilters(next);
    setHasPending(false);
    fetchData(next);
  };

  /* ── active chips ── */
  const activeChips = [];
  if (appliedFilters.period !== "all")
    activeChips.push({ label: `Period: ${PERIODS.find((p) => p.id === appliedFilters.period)?.label}`, onRemove: () => removeFilter("period", "all") });
  if (appliedFilters.region !== "All")
    activeChips.push({ label: `Region: ${appliedFilters.region}`, onRemove: () => removeFilter("region", "All") });
  if (appliedFilters.product !== "All")
    activeChips.push({ label: `Product: ${appliedFilters.product}`, onRemove: () => removeFilter("product", "All") });
  if (appliedFilters.currency_filter !== "actualvalue")
    activeChips.push({ label: CURRENCY_FILTERS.find((c) => c.id === appliedFilters.currency_filter)?.label, onRemove: () => removeFilter("currency_filter", "actualvalue") });
  if (appliedFilters.comparison !== "none")
    activeChips.push({ label: `Comparison: ${COMPARISONS.find((c) => c.id === appliedFilters.comparison)?.label}`, onRemove: () => removeFilter("comparison", "none") });

  /* ── csv (mirrors whichever of the three tables below is currently
     rendered, including its Grand Total row) ── */
  const dimCols = [
    "Stage",
    ...(showProduct ? ["Product"] : []),
    ...(showRegion ? ["Region"] : []),
  ];
  const dimValues = (r) => [
    r.stage,
    ...(showProduct ? [r.product_name || ""] : []),
    ...(showRegion ? [r.region || ""] : []),
  ];
  const grandTotalDimValues = () => ["Grand Total", ...dimCols.slice(1).map(() => "")];

  const csvData = useMemo(() => {
    if (showPeriodCols && !isComparisonOn && periodPivot.pivot.length > 0) {
      const header = [
        ...dimCols,
        ...periodPivot.periods.flatMap((p) => [`${p} Count`, `${p} Conv. Rate`]),
        "Total Count",
        "Total Conv. Rate",
      ];
      const body = periodPivot.pivot.map((r) => [
        ...dimValues(r),
        ...periodPivot.periods.flatMap((p) => [r.months?.[p]?.count ?? "", fmtPct(r.months?.[p]?.conversion_rate)]),
        r.total?.count ?? "",
        fmtPct(r.total?.conversion_rate),
      ]);
      if (grandTotal) {
        body.push([
          ...grandTotalDimValues(),
          ...periodPivot.periods.flatMap((p) => [periodGrandTotals[p]?.count ?? "", fmtPct(periodGrandTotals[p]?.conversion_rate)]),
          grandTotal.total?.count ?? "",
          fmtPct(grandTotal.total?.conversion_rate),
        ]);
      }
      return [header, ...body];
    }

    if (isComparisonOn && comparisonPivot.pivot.length > 0) {
      const header = [
        ...dimCols,
        ...comparisonPivot.periods.flatMap((p) => [`${p} Current`, `${p} Previous`, `${p} Variance`, `${p} Conv. Rate`]),
        "Total Count",
        "Total Conv. Rate",
      ];
      const body = comparisonPivot.pivot.map((r) => [
        ...dimValues(r),
        ...comparisonPivot.periods.flatMap((p) => {
          const m = r.months?.[p];
          const cmp = m?.comparison;
          return [m?.count ?? "", cmp?.compare_count ?? "", cmp?.varienc ?? "", fmtPct(m?.conversion_rate)];
        }),
        r.total?.count ?? "",
        fmtPct(r.total?.conversion_rate),
      ]);
      if (grandTotal) {
        body.push([
          ...grandTotalDimValues(),
          ...comparisonPivot.periods.flatMap((p) => {
            const m = grandTotal.months?.[p];
            const cmp = m?.comparison;
            return [m?.count ?? "", cmp?.compare_count ?? "", cmp?.varienc ?? "", fmtPct(m?.conversion_rate)];
          }),
          grandTotal.total?.count ?? "",
          fmtPct(grandTotal.total?.conversion_rate),
        ]);
      }
      return [header, ...body];
    }

    const header = [...dimCols, "Count", "Conv. Rate"];
    const body = sortedRows.map((r) => [...dimValues(r), r.count ?? "", fmtPct(r.conversion_rate)]);
    if (grandTotal) {
      body.push([...grandTotalDimValues(), grandTotal.total?.count ?? "", fmtPct(grandTotal.total?.conversion_rate)]);
    }
    return [header, ...body];
  }, [sortedRows, isComparisonOn, showPeriodCols, periodPivot, comparisonPivot, grandTotal, periodGrandTotals, showProduct, showRegion]);

  // Same param names fetchData sends, so a scheduled send reproduces this
  // exact filtered view.
  const scheduleFilters = useMemo(() => ({
    show_period: "true",
    ...(showProduct && { show_product_name: "true" }),
    ...(showRegion && { show_region: "true" }),
    currency_filter: appliedFilters.currency_filter,
    ...(appliedFilters.period !== "all" && { period: appliedFilters.period }),
    ...(appliedFilters.region !== "All" && { region: appliedFilters.region }),
    ...(appliedFilters.product !== "All" && { product: appliedFilters.product }),
    ...(appliedFilters.comparison !== "none" && { comparison: appliedFilters.comparison }),
  }), [appliedFilters, showProduct, showRegion]);

  /* ── ai messages ── */
  const aiMessages = useMemo(() => {
    if (!metrics) return ["Analyzing sales funnel data…"];
    return [
      `Overall conversion rate is ${fmtPct(metrics.overall_conversion)} — reflecting pipeline efficiency.`,
      `${fmt(metrics.total_leads)} total leads tracked, with ${fmt(metrics.total_won)} closed as won.`,
      `Average sales cycle is ${metrics.average_sales_cycle_days} days across all stages.`,
      isComparisonOn
        ? "Comparison mode active — review variance trends to identify stage bottlenecks."
        : "Enable Month-on-Month or Year-on-Year comparison to benchmark funnel performance.",
    ];
  }, [metrics, isComparisonOn]);

  /* ── AI insights / commentary ── */
  // appliedFilters is exactly what the data was fetched with; the Product /
  // Region / Period column toggles only change how it is broken down.
  const commentary = useReportCommentary({
    token,
    reportId: "sales_funnel",
    year,
    currency: selectedCurrency,
    filters: appliedFilters,
  });

  const insightFilterLabels = useMemo(() => [
    appliedFilters.period !== "all" && `Period: ${PERIODS.find((p) => p.id === appliedFilters.period)?.label}`,
    appliedFilters.region !== "All" && `Region: ${appliedFilters.region}`,
    appliedFilters.product !== "All" && `Product: ${appliedFilters.product}`,
    appliedFilters.currency_filter !== "actualvalue" && `Values in: ${CURRENCY_FILTERS.find((c) => c.id === appliedFilters.currency_filter)?.label}`,
    appliedFilters.comparison !== "none" && `Comparison: ${COMPARISONS.find((c) => c.id === appliedFilters.comparison)?.label}`,
  ].filter(Boolean), [appliedFilters]);

  const viewKey = `${year}|${selectedCurrency}|${JSON.stringify(appliedFilters)}|${showProduct}|${showRegion}|${showPeriodCols}`;

  const buildInsightsContext = () => {
    if (!rows.length) return "";
    const num = (v) => toNumberForAI(v) ?? 0;
    // Monthly columns are on screen in the period pivot and the comparison table.
    const showMonths = (showPeriodCols || isComparisonOn) && apiPeriods.length > 0;
    const rowLabel = (r) =>
      [r.stage, showProduct && r.product_name, showRegion && r.region].filter(Boolean).join(" / ");
    const monthValues = (m) => ({
      count: m.count,
      ...(isComparisonOn && { previous_count: m.comparison?.compare_count, change: m.comparison?.varienc }),
      conversion_rate: m.conversion_rate,
    });
    const toRow = (label, total, months) => ({
      label,
      count: total?.count,
      conversion_rate: total?.conversion_rate,
      months: showMonths
        ? Object.fromEntries(apiPeriods.filter((p) => months?.[p]).map((p) => [p, monthValues(months[p])]))
        : undefined,
    });

    // Funnel order, then the biggest product/region splits within a stage.
    const ordered = [...rows].sort(
      (a, b) =>
        funnelStageRank(a.stage) - funnelStageRank(b.stage) ||
        String(a.stage || "").localeCompare(String(b.stage || "")) ||
        num(b.count) - num(a.count)
    );

    const stageTotals = [];
    ordered.forEach((r) => {
      const s = stageTotals.find((x) => x.stage === r.stage);
      if (s) s.count += num(r.count);
      else stageTotals.push({ stage: r.stage, count: num(r.count) });
    });
    const sumStages = (test) => stageTotals.filter((s) => test(s.stage || "")).reduce((t, s) => t + s.count, 0);
    const won  = sumStages((s) => /won/i.test(s));
    const lost = sumStages((s) => /lost/i.test(s));
    const gtMonths = grandTotal?.months || {};
    const leadMonths = apiPeriods.filter((p) => gtMonths[p]);

    const facts = {
      stage_with_most_opportunities: rankForAI(stageTotals, (s) => s.count, (s) => s.stage, 1)?.highest[0],
      closed_won: won,
      closed_lost: lost,
      win_rate_of_closed_deals_pct: won + lost ? (won / (won + lost)) * 100 : undefined,
      open_pipeline: sumStages((s) => !/won|lost/i.test(s)),
      ...((showProduct || showRegion) && { stage_totals: stageTotals }),
      ...(leadMonths.length > 1 && {
        months_by_total_leads: rankForAI(
          leadMonths,
          (p) => gtMonths[p].count,
          (p) => p,
          Math.min(3, Math.floor(leadMonths.length / 2))
        ),
      }),
      ...(isComparisonOn && {
        comparison_periods: Object.fromEntries(
          apiPeriods.map((p) => [p, getComparePeriod(p)]).filter(([, cp]) => cp)
        ),
      }),
    };

    const unitLabel = CURRENCY_FILTERS.find((c) => c.id === appliedFilters.currency_filter)?.label;
    const notes = [
      "Figures are COUNTS of CRM opportunities, not money — never use a currency symbol. conversion_rate is a stage's count as a percentage of all leads in the period (its share of leads), not stage-to-stage conversion; overall_conversion is Closed Won as a % of all leads, and average_sales_cycle_days is in days.",
      isComparisonOn &&
        "In months, previous_count is the same row's count in the comparison month (see comparison_periods) and change = count − previous_count.",
      appliedFilters.currency_filter !== "actualvalue" && unitLabel &&
        `The "${unitLabel}" unit does not apply to row counts, but key_metrics lead/won counts of 1,000 or more may be shown in ${unitLabel.toLowerCase()}.`,
    ].filter(Boolean).join(" ");

    return buildReportAIContext({
      valueScale: "Counts (not currency)",
      notes,
      keyMetrics: metrics,
      facts,
      rows: [
        grandTotal && toRow("Grand Total", grandTotal.total, grandTotal.months),
        ...ordered.map((r) => toRow(rowLabel(r), r, r.months)),
      ].filter(Boolean),
    });
  };

  // The commentary shown under the report, offered with the CSV download.
  const exportCommentary = collectCommentary({ reportItems: commentary.items });

  /* ================== RENDER ================== */
  return (
    <ReportsLayout>
      <main className="flex-1 min-w-0 bg-white p-3 rounded-xl shadow-md">

        {/* ── HEADER ── */}
        <div className="flex justify-between items-center gap-3 mb-2">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-lg font-semibold text-sky-900">Sales Funnel Metrics</h2>
            <p className="text-s text-sky-500">Track leads, conversions, and funnel performance</p>
          </div>
          <Link
            to="/sales-funnel-dashboard"
            className="flex shrink-0 items-center whitespace-nowrap py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg hover:bg-white hover:text-sky-900 transition border border-sky-900"
          >
            View More <FaArrowRightToBracket className="ml-1" />
          </Link>
        </div>

        {/* ── FILTER BAR ── */}
        <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">

          {/* LEFT: compact checkboxes + active chips */}
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-1.5 text-x text-sky-700 cursor-pointer select-none hover:text-sky-900">
              <input type="checkbox" checked={showPeriodCols} onChange={(e) => setShowPeriodCols(e.target.checked)} className="accent-sky-700 h-3.5 w-3.5" />
              Period Cols
            </label>
            <label className="flex items-center gap-1.5 text-x text-sky-700 cursor-pointer select-none hover:text-sky-900">
              <input type="checkbox" checked={showProduct} onChange={(e) => setShowProduct(e.target.checked)} className="accent-sky-700 h-3.5 w-3.5" />
              Product Col
            </label>
            <label className="flex items-center gap-1.5 text-x text-sky-700 cursor-pointer select-none hover:text-sky-900">
              <input type="checkbox" checked={showRegion} onChange={(e) => setShowRegion(e.target.checked)} className="accent-sky-700 h-3.5 w-3.5" />
              Region Col
            </label>
            {activeChips.map((chip, i) => (
              <span key={i} className="flex items-center gap-1 px-2 py-0.5 text-x bg-sky-800 text-white rounded-full">
                {chip.label}
                <button onClick={chip.onRemove} className="text-sky-300 hover:text-white font-bold ml-0.5">✕</button>
              </span>
            ))}
          </div>

          {/* RIGHT: action buttons */}
          <div className="flex items-center gap-2">

              {/* FILTERS */}
              <div className="relative" ref={ref}>
                <button
                  onClick={() => { if (!open) setDraftFilters({ ...appliedFilters }); setOpen(!open); }}
                  aria-label="Filters"
                  className={`relative group flex items-center gap-1 px-3 py-2.5 text-x font-medium rounded-lg border transition ${
                    hasPending ? "bg-amber-50 text-amber-800 border-amber-300" : "bg-sky-100 text-sky-800 border-sky-200 hover:bg-sky-200"
                  }`}
                >
                  <FiFilter size={14} />
                  <ActionHoverLabel>Filters</ActionHoverLabel>
                  {hasPending && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-amber-400 text-white rounded-full">Pending</span>
                  )}
                </button>

                <AnimatePresence>
                  {open && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                      className="absolute right-0 top-full mt-1 w-72 bg-sky-50 border border-sky-200 rounded-xl shadow-xl z-50 p-4"
                    >
                      <SelectField label="Period" value={draftFilters.period} options={PERIODS} onChange={(v) => updateDraft("period", v)} />
                      <SelectField label="Region" value={draftFilters.region} options={regions.length ? regions : [{ id: "All", label: "All" }]} onChange={(v) => updateDraft("region", v)} />
                      <SelectField label="Product" value={draftFilters.product} options={products.length ? products : [{ id: "All", label: "All" }]} onChange={(v) => updateDraft("product", v)} />
                      <SelectField label="Currency" value={draftFilters.currency_filter} options={CURRENCY_FILTERS} onChange={(v) => updateDraft("currency_filter", v)} />
                      <SelectField label="Comparison" value={draftFilters.comparison} options={COMPARISONS} onChange={(v) => updateDraft("comparison", v)} />
                      <div className="flex gap-2 mt-3">
                        <button onClick={applyFilters} className="flex-1 py-2 text-x font-semibold bg-sky-900 text-white rounded-lg hover:bg-sky-800 transition">Apply</button>
                        <button onClick={resetAll} className="flex-1 py-2 text-x font-semibold bg-white text-sky-700 border border-sky-200 rounded-lg hover:bg-sky-50 transition">Reset</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <ExportMenu
                label="CSV"
                commentaryCount={commentaryCount(exportCommentary)}
                onExport={(include) =>
                  downloadCsv(csvWithCommentary(csvData, exportCommentary, include), `SalesFunnel_${year}.csv`)
                }
                className="relative group flex items-center px-3 py-2.5 text-x bg-sky-100 text-sky-800 rounded-lg border border-sky-200 hover:bg-sky-200"
              />

              <AddAutomation
                reportType="sales_funnel_metrics"
                reportLabel="Sales Funnel Metrics Report"
                year={year}
                currency={selectedCurrency}
                filters={scheduleFilters}
                iconOnly
              />

              <button
                onClick={() => window.print()}
                aria-label="Print"
                className="relative group flex items-center px-3 py-2.5 text-x bg-sky-100 text-sky-800 rounded-lg border border-sky-200 hover:bg-sky-200"
              >
                <FiPrinter />
                <ActionHoverLabel>Print</ActionHoverLabel>
              </button>

              {/* SORT */}
              <div className="relative" ref={sortRef}>
                <button
                  onClick={() => setSortOpen((v) => !v)}
                  aria-label="Sort"
                  className={`relative group flex items-center gap-1 px-3 py-2.5 text-x rounded-lg border transition ${
                    sortOpen ? "bg-sky-900 text-white border-sky-900" : "bg-sky-100 text-sky-800 border-sky-200 hover:bg-sky-200"
                  }`}
                >
                  <FiFilter size={13} />
                  <ActionHoverLabel>Sort</ActionHoverLabel>
                  {(sortConfig.sort_by !== "stage" || sortConfig.sort_order !== "asc") && (
                    <span className="ml-1 text-xs font-bold">{sortConfig.sort_order === "asc" ? "↑" : "↓"}</span>
                  )}
                </button>

                <AnimatePresence>
                  {sortOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-1 w-64 z-50 bg-sky-50 border border-sky-200 rounded-xl shadow-xl"
                    >
                      <div className="p-4 space-y-3 text-x">
                        <div>
                          <label className="block mb-1 text-sky-700 font-medium">Sort By</label>
                          <select
                            value={sortConfig.sort_by}
                            onChange={(e) => setSortConfig((s) => ({ ...s, sort_by: e.target.value }))}
                            className="w-full border border-sky-200 rounded-lg p-2 text-sky-900 bg-white"
                          >
                            {SORT_BY_OPTIONS.map((o) => (
                              <option key={o.id} value={o.id}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block mb-1 text-sky-700 font-medium">Order</label>
                          <div className="flex gap-2">
                            {SORT_ORDER_OPTIONS.map((o) => (
                              <button
                                key={o.id}
                                onClick={() => setSortConfig((s) => ({ ...s, sort_order: o.id }))}
                                className={`flex-1 py-2 rounded-lg text-x border transition ${
                                  sortConfig.sort_order === o.id
                                    ? "bg-sky-900 text-white border-sky-900"
                                    : "bg-white text-sky-800 border-sky-200 hover:bg-sky-100"
                                }`}
                              >
                                {o.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 px-4 pb-4">
                        <button
                          onClick={() => setSortConfig({ sort_by: "stage", sort_order: "asc" })}
                          className="flex-1 py-2 text-x bg-sky-200 text-sky-900 rounded-lg hover:bg-sky-300"
                        >
                          Reset Sort
                        </button>
                        <button
                          onClick={() => setSortOpen(false)}
                          className="flex-1 py-2 text-x bg-sky-900 text-white rounded-lg hover:bg-sky-800"
                        >
                          Apply
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <span className="h-6 w-px bg-sky-200" aria-hidden="true" />

              <AIActionsMenu
                reportId="sales_funnel"
                insights={{
                  commentary,
                  reportLabel: "Sales Funnel Metrics",
                  filterLabels: insightFilterLabels,
                  viewKey,
                  buildContext: buildInsightsContext,
                  disabled: loading || !rows.length,
                }}
              />
            </div>
        </div>

        {/* ── SKELETON ── */}
        {loading && <TableSkeleton />}

        {/* ════════════════════════════════════════════
            NORMAL TABLE (no comparison, no period pivot)
            ════════════════════════════════════════════ */}
        {!loading && sortedRows.length > 0 && !isComparisonOn && !showPeriodCols && (
          <div className="report-table-scroll overflow-auto max-h-[440px] border border-sky-200 rounded-lg bg-white">
            <table className="min-w-[800px] w-full text-x text-sky-900 border-collapse">
              <thead className="sticky top-0 z-10 bg-sky-900 text-white">
                <tr>
                  <th className="px-3 py-1.5 text-left font-semibold whitespace-nowrap">Stage</th>
                  {showProduct && <th className="px-3 py-1.5 text-left font-semibold whitespace-nowrap">Product</th>}
                  {showRegion  && <th className="px-3 py-1.5 text-left font-semibold whitespace-nowrap">Region</th>}
                  <th className="px-3 py-1.5 text-left font-semibold whitespace-nowrap">Count</th>
                  <th className="px-3 py-1.5 text-left font-semibold whitespace-nowrap">Conv. Rate</th>
                  <th className="px-3 py-1.5 text-left font-semibold whitespace-nowrap">Insights</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r, idx) => (
                  <motion.tr
                    key={idx}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: idx * 0.012 }}
                    className="border-b border-sky-50 hover:bg-sky-50 transition-colors"
                  >
                    <td className="px-3 py-2.5 font-medium whitespace-nowrap">{r.stage}</td>
                    {showProduct && <td className="px-3 py-2.5 text-sky-700">{r.product_name || "—"}</td>}
                    {showRegion  && <td className="px-3 py-2.5 text-sky-700">{r.region || "—"}</td>}
                    <td className="px-3 py-2.5 font-semibold">{fmt(r.count)}</td>
                    <td className="px-3 py-2.5">{fmtPct(r.conversion_rate)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap min-w-[420px] text-sky-700">
                      {buildSalesFunnelStageInsight(r, rows)}
                    </td>
                  </motion.tr>
                ))}
                {grandTotal && (
                  <tr className="bg-sky-900 text-white font-bold border-t-2 border-sky-300">
                    <td className="px-3 py-2.5 whitespace-nowrap" colSpan={1 + (showProduct ? 1 : 0) + (showRegion ? 1 : 0)}>Grand Total</td>
                    <td className="px-3 py-2.5">{fmt(grandTotal.total?.count)}</td>
                    <td className="px-3 py-2.5">{fmtPct(grandTotal.total?.conversion_rate)}</td>
                    <td className="px-3 py-2.5" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ════════════════════════════════════════════
            COMPARISON TABLE
            ════════════════════════════════════════════ */}
        {!loading && isComparisonOn && comparisonPivot.pivot.length > 0 && (
          <div className="report-table-scroll overflow-auto max-h-[520px] border border-sky-200 rounded-lg bg-white">
            <table className="min-w-max w-full text-x border-collapse">
              <thead className="sticky top-0 z-20">
                {/* Row 1 — period group labels */}
                <tr className="bg-[#04577c] text-white">
                  <th rowSpan={2} className="px-3 py-1.5 text-left whitespace-nowrap min-w-[140px] border-r border-white/15 font-semibold">STAGE</th>
                  {showProduct && <th rowSpan={2} className="px-3 py-1.5 text-left whitespace-nowrap min-w-[120px] border-r border-white/15 font-semibold">PRODUCT</th>}
                  {showRegion  && <th rowSpan={2} className="px-3 py-1.5 text-left whitespace-nowrap min-w-[110px] border-r border-white/15 font-semibold">REGION</th>}
                  {comparisonPivot.periods.map((p, idx) => {
                    const cp = getComparePeriod(p);
                    return (
                      <th key={p} colSpan={4} className={["px-3 py-1.5 text-center whitespace-nowrap font-bold", idx > 0 ? "border-l-2 border-white/20" : ""].join(" ")}>
                        {p}{cp ? ` vs ${cp}` : ""}
                      </th>
                    );
                  })}
                  <th colSpan={2} className="px-3 py-1.5 text-center whitespace-nowrap font-bold border-l-2 border-white/20 bg-sky-950">Total</th>
                </tr>
                {/* Row 2 — sub-column headers */}
                <tr className="bg-[#0b6a92] text-white">
                  {comparisonPivot.periods.flatMap((p, idx) => {
                    const cp = getComparePeriod(p);
                    return [
                      <th key={`${p}-cur`} className={["px-3 py-1 text-center whitespace-nowrap", idx > 0 ? "border-l-2 border-white/20" : ""].join(" ")}>
                        <div className="text-white/60 text-[10px] leading-tight">{p}</div>
                        <div className="font-semibold text-xs">Current</div>
                      </th>,
                      <th key={`${p}-prev`} className="px-3 py-1 text-center whitespace-nowrap border-l border-white/15">
                        <div className="text-white/60 text-[10px] leading-tight">{cp}</div>
                        <div className="font-semibold text-xs">Previous</div>
                      </th>,
                      <th key={`${p}-var`} className="px-3 py-1 text-center whitespace-nowrap border-l border-white/15">
                        <div className="text-white/60 text-[10px] leading-tight">&nbsp;</div>
                        <div className="font-semibold text-xs">Variance</div>
                      </th>,
                      <th key={`${p}-cr`} className="px-3 py-1 text-center whitespace-nowrap border-l border-white/15">
                        <div className="text-white/60 text-[10px] leading-tight">&nbsp;</div>
                        <div className="font-semibold text-xs">Conv. Rate</div>
                      </th>,
                    ];
                  })}
                  <th className="px-3 py-1 text-center whitespace-nowrap border-l-2 border-white/20 bg-sky-950">
                    <div className="text-white/60 text-[10px] leading-tight">&nbsp;</div>
                    <div className="font-semibold text-xs">Count</div>
                  </th>
                  <th className="px-3 py-1 text-center whitespace-nowrap border-l border-white/15 bg-sky-950">
                    <div className="text-white/60 text-[10px] leading-tight">&nbsp;</div>
                    <div className="font-semibold text-xs">Conv. Rate</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonPivot.pivot.map((r, i) => (
                  <tr key={i} className="border-b border-sky-100 hover:bg-sky-50">
                    <td className="px-3 py-2.5 whitespace-nowrap font-medium text-sky-900 border-r border-sky-100">{r.stage}</td>
                    {showProduct && <td className="px-3 py-2.5 whitespace-nowrap text-sky-700 border-r border-sky-100">{r.product_name || "—"}</td>}
                    {showRegion  && <td className="px-3 py-2.5 whitespace-nowrap text-sky-700 border-r border-sky-100">{r.region || "—"}</td>}
                    {comparisonPivot.periods.map((p, idx) => {
                      const m = r.months?.[p];
                      const cmp = m?.comparison;
                      return (
                        <React.Fragment key={p}>
                          <td className={["px-3 py-2.5 text-right whitespace-nowrap font-semibold text-sky-900", idx > 0 ? "border-l-2 border-sky-100" : ""].join(" ")}>{fmt(m?.count)}</td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap text-sky-500 border-l border-sky-100">{cmp?.compare_count != null ? fmt(cmp.compare_count) : "—"}</td>
                          <td className="px-3 py-2.5 text-center whitespace-nowrap border-l border-sky-100">{cmp?.varienc != null ? getVarianceUI(cmp.varienc) : "—"}</td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap text-sky-700 border-l border-sky-100">{fmtPct(m?.conversion_rate)}</td>
                        </React.Fragment>
                      );
                    })}
                    <td className="px-3 py-2.5 text-right whitespace-nowrap font-semibold text-sky-900 border-l-2 border-sky-200 bg-sky-50">{fmt(r.total?.count)}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap text-sky-700 border-l border-sky-100 bg-sky-50">{fmtPct(r.total?.conversion_rate)}</td>
                  </tr>
                ))}
                {grandTotal && (
                  <tr className="bg-sky-900 text-white font-bold border-t-2 border-sky-300">
                    <td className="px-3 py-2.5 whitespace-nowrap" colSpan={1 + (showProduct ? 1 : 0) + (showRegion ? 1 : 0)}>Grand Total</td>
                    {comparisonPivot.periods.map((p, idx) => {
                      const m = grandTotal.months?.[p];
                      const cmp = m?.comparison;
                      return (
                        <React.Fragment key={p}>
                          <td className={["px-3 py-2.5 text-right whitespace-nowrap", idx > 0 ? "border-l-2 border-white/20" : ""].join(" ")}>{fmt(m?.count)}</td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap border-l border-white/15">{cmp?.compare_count != null ? fmt(cmp.compare_count) : "—"}</td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap border-l border-white/15">{cmp?.varienc != null ? fmt(cmp.varienc) : "—"}</td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap border-l border-white/15">{fmtPct(m?.conversion_rate)}</td>
                        </React.Fragment>
                      );
                    })}
                    <td className="px-3 py-2.5 text-right whitespace-nowrap border-l-2 border-white/20 bg-sky-950">{fmt(grandTotal.total?.count)}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap border-l border-white/15 bg-sky-950">{fmtPct(grandTotal.total?.conversion_rate)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ════════════════════════════════════════════
            PERIOD PIVOT TABLE
            ════════════════════════════════════════════ */}
        {!loading && showPeriodCols && !isComparisonOn && periodPivot.pivot.length > 0 && (
          <div className="report-table-scroll overflow-auto max-h-[520px] border border-sky-200 rounded-lg bg-white">
            <table className="min-w-max w-full text-x border-collapse">
              <thead className="sticky top-0 z-20">
                <tr className="bg-sky-900 text-white">
                  <th rowSpan={2} className="px-3 py-1.5 text-left whitespace-nowrap min-w-[140px] border-r border-white/15 font-semibold">STAGE</th>
                  {showProduct && <th rowSpan={2} className="px-3 py-1.5 text-left whitespace-nowrap min-w-[120px] border-r border-white/15 font-semibold">PRODUCT</th>}
                  {showRegion  && <th rowSpan={2} className="px-3 py-1.5 text-left whitespace-nowrap min-w-[110px] border-r border-white/15 font-semibold">REGION</th>}
                  {periodPivot.periods.map((p, idx) => (
                    <th key={p} colSpan={2} className={["px-3 py-1.5 text-center whitespace-nowrap font-bold", idx > 0 ? "border-l-2 border-white/20" : ""].join(" ")}>{p}</th>
                  ))}
                  <th colSpan={2} className="px-3 py-1.5 text-center whitespace-nowrap font-bold border-l-2 border-white/20 bg-sky-950">Total</th>
                </tr>
                <tr className="bg-[#0b6a92] text-white">
                  {periodPivot.periods.flatMap((p, idx) => [
                    <th key={`${p}-c`} className={["px-3 py-1 text-center whitespace-nowrap text-xs font-semibold", idx > 0 ? "border-l-2 border-white/20" : ""].join(" ")}>Count</th>,
                    <th key={`${p}-cr`} className="px-3 py-1 text-center whitespace-nowrap text-xs font-semibold border-l border-white/15">Conv. Rate</th>,
                  ])}
                  <th className="px-3 py-1 text-center whitespace-nowrap text-xs font-semibold border-l-2 border-white/20 bg-sky-950">Count</th>
                  <th className="px-3 py-1 text-center whitespace-nowrap text-xs font-semibold border-l border-white/15 bg-sky-950">Conv. Rate</th>
                </tr>
              </thead>
              <tbody>
                {periodPivot.pivot.map((r, i) => (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: i * 0.012 }}
                    className="border-b border-sky-100 hover:bg-sky-50"
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap font-medium text-sky-900 border-r border-sky-100">{r.stage}</td>
                    {showProduct && <td className="px-3 py-2.5 whitespace-nowrap text-sky-700 border-r border-sky-100">{r.product_name || "—"}</td>}
                    {showRegion  && <td className="px-3 py-2.5 whitespace-nowrap text-sky-700 border-r border-sky-100">{r.region || "—"}</td>}
                    {periodPivot.periods.map((p, idx) => {
                      const m = r.months?.[p];
                      return (
                        <React.Fragment key={p}>
                          <td className={["px-3 py-2.5 text-right whitespace-nowrap font-semibold text-sky-900", idx > 0 ? "border-l-2 border-sky-100" : ""].join(" ")}>{fmt(m?.count)}</td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap text-sky-700 border-l border-sky-100">{fmtPct(m?.conversion_rate)}</td>
                        </React.Fragment>
                      );
                    })}
                    <td className="px-3 py-2.5 text-right whitespace-nowrap font-semibold text-sky-900 border-l-2 border-sky-200 bg-sky-50">{fmt(r.total?.count)}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap text-sky-700 border-l border-sky-100 bg-sky-50">{fmtPct(r.total?.conversion_rate)}</td>
                  </motion.tr>
                ))}
                {grandTotal && (
                  <tr className="bg-sky-900 text-white font-bold border-t-2 border-sky-300">
                    <td className="px-3 py-2.5 whitespace-nowrap" colSpan={1 + (showProduct ? 1 : 0) + (showRegion ? 1 : 0)}>Grand Total</td>
                    {periodPivot.periods.map((p, idx) => {
                      const m = periodGrandTotals[p];
                      return (
                        <React.Fragment key={p}>
                          <td className={["px-3 py-2.5 text-right whitespace-nowrap", idx > 0 ? "border-l-2 border-white/20" : ""].join(" ")}>{fmt(m?.count)}</td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap border-l border-white/15">{fmtPct(m?.conversion_rate)}</td>
                        </React.Fragment>
                      );
                    })}
                    <td className="px-3 py-2.5 text-right whitespace-nowrap border-l-2 border-white/20 bg-sky-950">{fmt(grandTotal.total?.count)}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap border-l border-white/15 bg-sky-950">{fmtPct(grandTotal.total?.conversion_rate)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── NO DATA ── */}
        {!loading && rows.length === 0 && (
          <div className="flex items-center justify-center h-40 text-sky-400 text-s border border-sky-100 rounded-xl">
            No data available for the selected filters.
          </div>
        )}

        {/* ── KEY METRICS + AI INSIGHTS ── */}
        {metrics && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-6 bg-white border border-sky-200 rounded-xl p-4 shadow-sm"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-s font-semibold text-sky-900 mb-3">Key Funnel Metrics</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="px-2 py-1 text-[11px] rounded-full bg-sky-100 text-sky-700 font-medium">Leads: {fmt(metrics.total_leads)}</span>
                  <span className="px-2 py-1 text-[11px] rounded-full bg-emerald-100 text-emerald-700 font-medium">Won: {fmt(metrics.total_won)}</span>
                  <span className="px-2 py-1 text-[11px] rounded-full bg-purple-100 text-purple-700 font-medium">Conv: {fmtPct(metrics.overall_conversion)}</span>
                  <span className="px-2 py-1 text-[11px] rounded-full bg-amber-100 text-amber-700 font-medium">Cycle: {metrics.average_sales_cycle_days}d</span>
                </div>
                <MetricRow label="Total Leads" value={fmt(metrics.total_leads)} />
                <MetricRow label="Total Won" value={fmt(metrics.total_won)} />
                <MetricRow label="Overall Conversion Rate" value={fmtPct(metrics.overall_conversion)} />
                <MetricRow label="Avg Sales Cycle (Days)" value={metrics.average_sales_cycle_days} />
              </div>
              <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 flex flex-col gap-2">
                <h4 className="text-x font-semibold text-sky-900 mb-1">Executive Financial Insight</h4>
                {salesFunnelExecutive.map((para, i) => (
                  <p key={i} className="text-s text-sky-800 leading-relaxed">{para}</p>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {!loading && <ReportCommentary commentary={commentary} />}

      </main>
    </ReportsLayout>
  );
}
