import React, { useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AuthContext } from "../../../context/AuthContext";
import { API_BASE_URL } from "../../../config/config";
import { cachedFetch } from "../../../utils/reportCache";

import RevenueProductDrilldownDrawer from "./RevenueProductDrilldownDrawer";

import ReportsLayout from "../ReportsLayout";
import TableSkeleton from "../../Skeleton/TableSkeleton";
import AIActionsMenu from "../AIActionsMenu";
import ExportMenu from "../ExportMenu";
import { collectCommentary, commentaryCount, xlsxWithCommentary } from "../reportExport";
import ActionHoverLabel from "../ActionHoverLabel";
import ReportCommentary from "../ReportCommentary";
import { buildReportAIContext, rankForAI, toNumberForAI } from "../reportAIContext";
import useReportCommentary from "../../../hooks/useReportCommentary";
import LineItemRefineWithAI, { LineItemAIButton } from "../LineItemRefineWithAI";
import LineItemCommentary from "../LineItemCommentary";
import useLineItemCommentary from "../../../hooks/useLineItemCommentary";
import AnalyzeWithAI, { AnalyzeButton } from "../AnalyzeWithAI";
import AIHelpTooltip from "../AIHelpTooltip";
import {
  buildRevenueAnalysisContext,
  buildRevenueLineItemContext,
  revenueRowKey,
  revenueRowLabel,
} from "./revenueAI";
import AddAutomation from "../AddAutomation";

import { FiFilter, FiPrinter } from "react-icons/fi";
import { BsStars, BsChatLeftText, BsChatLeftTextFill } from "react-icons/bs";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { CSVLink } from "react-csv";
import { FaArrowRightToBracket } from "react-icons/fa6";
import { getDecimalPrecision } from '../../../utils/formatters';

/* ══════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════ */

const TIME_FILTERS = [
  { id: "all",             label: "All Periods"     },
  { id: "current_month",   label: "Current Month"   },
  { id: "last_month",      label: "Last Month"      },
  { id: "quarter_to_date", label: "Quarter to Date" },
  { id: "year_to_date",    label: "Year to Date"    },
  { id: "custom_range",    label: "Custom Range"    },
];

const CURRENCY_FILTERS = [
  { id: "actualvalue", label: "Actual"    },
  { id: "thousands",   label: "Thousands" },
  { id: "millions",    label: "Millions"  },
];

const COMPARISONS = [
  { id: "",               label: "No Comparison"  },
  { id: "month_on_month", label: "Month on Month" },
  { id: "year_on_year",   label: "Year on Year"   },
];

/* View mode — from HTML reference */
const VIEW_MODES = [
  { id: "monthly",   label: "Monthly"   },
  { id: "quarterly", label: "Quarterly" },
];

/* Quarter options — from HTML reference */
const QUARTER_OPTIONS = [
  { id: "none", label: "All Quarters"    },
  { id: "q1",   label: "Q1 (Jan–Mar)"   },
  { id: "q2",   label: "Q2 (Apr–Jun)"   },
  { id: "q3",   label: "Q3 (Jul–Sep)"   },
  { id: "q4",   label: "Q4 (Oct–Dec)"   },
];

const SORT_BY_OPTIONS = [
  { id: "customer_name", label: "Customer Name" },
  { id: "product_name",  label: "Product Name"  },
  { id: "entity_name",   label: "Entity Name"   },
  { id: "region",        label: "Region"        },
  { id: "category",      label: "Category"      },
  { id: "total_amount",  label: "Total"         },
  { id: "q1",            label: "Q1"            },
  { id: "q2",            label: "Q2"            },
  { id: "q3",            label: "Q3"            },
  { id: "q4",            label: "Q4"            },
];

const SORT_ORDER_OPTIONS = [
  { id: "asc",  label: "Ascending ↑"  },
  { id: "desc", label: "Descending ↓" },
];

const BASE_COLS = ["customer_name", "product_name", "entity_name", "region", "category"];
const Q_KEYS   = ["q1", "q2", "q3", "q4"];

/* Column toggles — from HTML reference (show_product, show_entity, show_region, show_category, show_period) */
const COLUMN_TOGGLES = [
  { flag: "show_period",   key: "period",        label: "Period",   apiParam: "show_period"   },
  { flag: "show_product",  key: "product_name",  label: "Product",  apiParam: "show_product"  },
  { flag: "show_entity",   key: "entity_name",   label: "Entity",   apiParam: "show_entity"   },
  { flag: "show_region",   key: "region",        label: "Region",   apiParam: "show_region"   },
  { flag: "show_category", key: "category",      label: "Category", apiParam: "show_department"},
];

const DEFAULT_COLUMN_TOGGLES = {
  show_period:   true,
  show_product:  false,
  show_entity:   false,
  show_region:   false,
  show_category: false,
};

const DUMMY_AI_MESSAGES = [
  "AI-powered insights coming soon",
  "AI enhances efficiency through automated financial analysis",
];

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */

const displayValue = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string") {
    const cleaned = v.trim().replace(/[$,\s]/g, "");
    if (!cleaned || cleaned === "—" || cleaned === "-") return "—";
    if (/[a-zA-Z%]/.test(cleaned)) return v;
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed)) return v;
    v = parsed;
  }
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  const dp = getDecimalPrecision();
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
};

const toNum   = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const money   = (v) => { const dp = getDecimalPrecision(); return `$${toNum(v).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`; };
const safeText = (v) => (v === null || v === undefined || v === "" ? "—" : String(v));

/* ── Analytical narrative builder ──
   Deep, data-driven analysis per customer (concentration/rank + their own
   revenue trend) and a portfolio-level concentration read for the executive
   summary. Everything is computed from the real numbers, not templated. */
const _revNum = (v) => {
  if (typeof v === "string") {
    const n = Number(v.replace(/[$,%\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return Number(v) || 0;
};

const _revStats = (arr) => {
  const n = arr.length;
  const mean = n ? arr.reduce((a, b) => a + b, 0) / n : 0;
  const variance = n ? arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n : 0;
  const sd = Math.sqrt(variance);
  return { mean, cv: mean !== 0 ? (sd / Math.abs(mean)) * 100 : 0 };
};

const buildRevenueCustomerInsights = (allRows, periodKeys) => {
  const map = new Map();
  const realRows = (allRows || []).filter((r) => r?.customer_name && r.customer_name !== "Grand Total");
  const totalRevenue = realRows.reduce((s, r) => s + _revNum(r.revenue), 0);
  const n = realRows.length;
  if (!n || !totalRevenue) return map;

  const sorted = [...realRows].sort((a, b) => _revNum(b.revenue) - _revNum(a.revenue));
  const rankMap = new Map(sorted.map((r, i) => [r.customer_name, i + 1]));

  for (const r of realRows) {
    const rev = _revNum(r.revenue);
    if (!rev) { map.set(r.customer_name, "—"); continue; }
    const pct = (rev / totalRevenue) * 100;
    const rank = rankMap.get(r.customer_name);
    const rankClause = rank <= Math.max(1, Math.ceil(n * 0.05))
      ? `one of the top accounts (rank ${rank} of ${n})`
      : rank >= Math.floor(n * 0.75)
      ? `one of the smaller accounts (rank ${rank} of ${n})`
      : `a mid-tier account (rank ${rank} of ${n})`;

    const equalSharePct = 100 / n;
    const concentrationMultiple = equalSharePct ? pct / equalSharePct : null;
    const concentrationClause = concentrationMultiple !== null && concentrationMultiple >= 2
      ? ` It carries ${concentrationMultiple.toFixed(1)}x the revenue share an evenly split customer base would imply - a dependency worth watching if this relationship weakens.`
      : concentrationMultiple !== null && concentrationMultiple <= 0.3
      ? ` It contributes well below an even per-customer share, consistent with a long-tail account rather than a core relationship.`
      : "";

    let trendClause = "";
    if (periodKeys?.length >= 3 && r.period_revenues) {
      const vals = periodKeys.map((p) => _revNum(r.period_revenues[p]));
      const nonZero = vals.filter((v) => v !== 0).length;
      if (nonZero >= 3) {
        const first = vals[0];
        const last = vals[vals.length - 1];
        const stats = _revStats(vals);
        if (stats.cv >= 40) trendClause = " Its revenue swung significantly month to month rather than moving steadily, so any single month is a poor guide to what it will contribute next.";
        else if (first > 0 && last > first * 1.15) trendClause = " Its revenue trended up over the period, growing into a larger share of the book rather than staying flat.";
        else if (first > 0 && last < first * 0.85) trendClause = " Its revenue trended down over the period, shrinking as a share of the book even if the rank looks unchanged today.";
      }
    }

    map.set(r.customer_name, `${r.customer_name} holds ${pct.toFixed(1)}% of total revenue, ${rankClause}.${concentrationClause}${trendClause}`);
  }
  return map;
};

const REV_NOT_ENOUGH_DATA = ["Not enough customers in this selection to analyze concentration - widen the filters for a deeper read."];

const buildRevenueExecutive = (allRows) => {
  const realRows = (allRows || []).filter((r) => r?.customer_name && r.customer_name !== "Grand Total");
  const totalRevenue = realRows.reduce((s, r) => s + _revNum(r.revenue), 0);
  if (!realRows.length || !totalRevenue) return REV_NOT_ENOUGH_DATA;

  const sorted = [...realRows].sort((a, b) => _revNum(b.revenue) - _revNum(a.revenue));
  const n = sorted.length;
  const top10Count = Math.max(1, Math.round(n * 0.1));
  const top10Sum = sorted.slice(0, top10Count).reduce((s, r) => s + _revNum(r.revenue), 0);
  const top10Pct = (top10Sum / totalRevenue) * 100;
  const concentrationLevel = top10Pct >= 50 ? "highly concentrated" : top10Pct >= 30 ? "moderately concentrated" : "well diversified";

  const bottomHalfCount = Math.max(1, Math.floor(n / 2));
  const bottomHalfSum = sorted.slice(n - bottomHalfCount).reduce((s, r) => s + _revNum(r.revenue), 0);
  const bottomHalfPct = totalRevenue ? (bottomHalfSum / totalRevenue) * 100 : 0;

  const para1 = `Revenue is ${concentrationLevel} among customers: the top ${top10Count} account${top10Count !== 1 ? "s" : ""} (${((top10Count / n) * 100).toFixed(0)}% of the customer base) generate${top10Count === 1 ? "s" : ""} ${top10Pct.toFixed(0)}% of total revenue, while the bottom half of accounts by revenue - ${bottomHalfCount} customer${bottomHalfCount !== 1 ? "s" : ""} - together contribute only ${bottomHalfPct.toFixed(0)}%.`;
  const para2 = top10Pct >= 50
    ? `That concentration means losing even one or two top accounts would materially impact revenue - retention and relationship depth with this group should be a priority, alongside diversifying the smaller-account base.`
    : `That's a reasonably diversified base - revenue doesn't depend heavily on any small handful of customers, which reduces the risk from losing any single account.`;

  return [para1, para2];
};

/** Compact KPI formatter — $1.23M, $456.7k, $123 */
const fmtKpi = (v) => {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (!isFinite(n)) return "—";
  const abs  = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(getDecimalPrecision())}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(getDecimalPrecision())}k`;
  return `${sign}$${abs.toFixed(getDecimalPrecision())}`;
};

const pctInline = (val) => {
  const n = Number(val);
  if (!Number.isFinite(n)) return null;
  const cls  = n > 0 ? "text-green-700" : n < 0 ? "text-red-700" : "text-slate-700";
  const sign = n > 0 ? "+" : "";
  return { text: `${sign}${n.toFixed(getDecimalPrecision())}%`, cls };
};

const diffStyle = (diffVal) => {
  const n = Number(diffVal);
  if (!Number.isFinite(n) || n === 0) return { cellBg: "bg-slate-50", pill: "bg-slate-200 text-slate-800", arrow: "•" };
  if (n > 0)  return { cellBg: "bg-green-50", pill: "bg-green-600 text-white", arrow: "▲" };
  return           { cellBg: "bg-red-50",   pill: "bg-red-600 text-white",   arrow: "▼" };
};

const quarterLabel   = (key) => String(key || "").toUpperCase();
const keyToNice      = (k)   => String(k).replace(/_/g, " ").toUpperCase();

const buildQuarterCompareMap = (row) => {
  const arr = row?.comparisons?.quarters;
  if (!Array.isArray(arr)) return {};
  const map = {};
  for (let i = 0; i < Math.min(arr.length, 4); i++) map[`q${i + 1}`] = arr[i] || null;
  return map;
};

/* ── Small shared components ── */
const Select = ({ label, value, options, labels = {}, onChange }) => (
  <div>
    <label className="block text-x text-sky-700 mb-1">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-sky-200 rounded p-2 text-x bg-white"
    >
      {options.map((o) => (
        <option key={o} value={o}>{labels[o] || o}</option>
      ))}
    </select>
  </div>
);

const MetricRow = ({ label, value, onAnalyze }) => (
  <div className="flex justify-between items-center text-s">
    <span className="text-sky-700">
      {label}
      {onAnalyze && (
        <AnalyzeButton
          onClick={onAnalyze}
          title={`Explain ${label} with AI`}
          tooltip={{
            heading: "Explain with AI",
            context: `${label} · ${value}`,
            body: "AI explains what's behind this figure, with supporting data, and answers follow-up questions.",
          }}
          className="ml-1 opacity-70 hover:opacity-100 focus:opacity-100"
        />
      )}
    </span>
    <span className="font-medium text-sky-900">{value}</span>
  </div>
);

const AIDriverText = ({ messages }) => {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!messages?.length) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % messages.length), 3000);
    return () => clearInterval(t);
  }, [messages]);
  return (
    <motion.div
      key={index}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="text-s font-medium bg-gradient-to-r from-sky-500 to-purple-500 bg-clip-text text-transparent"
    >
      {messages[index]}
    </motion.div>
  );
};

/** KPI Card — from HTML reference */
const KpiCard = ({ icon, label, value, sub, variant = "default" }) => {
  const valueColor = {
    default:  "text-sky-900",
    positive: "text-emerald-600",
    negative: "text-red-600",
    warning:  "text-amber-500",
  }[variant] ?? "text-sky-900";
  return (
    <div className="bg-white rounded-xl border border-sky-100 shadow-sm px-4 py-3 flex-1 min-w-[140px]">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-500 mb-1">{icon} {label}</p>
      <p className={`text-2xl font-extrabold leading-none ${valueColor}`}>{value}</p>
      {sub && <p className="text-[11px] text-sky-400 mt-1">{sub}</p>}
    </div>
  );
};

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
export default function RevenueReport() {
  const { token, selectedYear: year } = useContext(AuthContext);
  const [drillOpen,      setDrillOpen]      = useState(false);
  const [drillCustomer,  setDrillCustomer]  = useState("");
  const [grandTotalData, setGrandTotalData] = useState(null);
  const currency = "USD";

  const DEFAULT_FILTERS = useMemo(() => ({
    period:          "all",
    entity_name:     "All",
    product_name:    "All",
    region:          "All",
    category:        "All",
    customer_name:   "All",
    currency_filter: "actualvalue",
    comparison:      "",
    sort_by:         "customer_name",
    sort_order:      "asc",
    date_from:       "",
    date_to:         "",
    /* view_mode + quarter — new from HTML reference */
    view_mode:       "monthly",
    quarter:         "none",
  }), []);

  const [rows,        setRows]        = useState([]);
  const [filtersData, setFiltersData] = useState({ entities: [], products: [], regions: [], categories: [], customers: [] });

  const [filters,      setFilters]      = useState(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);

  /* Column toggles — separate state, re-fetch immediately on change */
  const [colToggles, setColToggles] = useState(DEFAULT_COLUMN_TOGGLES);

  const [metrics,      setMetrics]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [excelLoading, setExcelLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  /* Guards against stale fetches when toggles change quickly */
  const fetchSeqRef       = useRef(0);
  const toggleDebounceRef = useRef(null);

  const isComparisonOn   = Boolean(filters.comparison);
  const isMonthlyView    = filters.view_mode !== "quarterly";
  const isQuarterlyView  = filters.view_mode === "quarterly";

  const isDirty = useMemo(
    () => JSON.stringify(draftFilters) !== JSON.stringify(filters),
    [draftFilters, filters]
  );

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  /* ── Unique, sorted period keys — from period_revenues AND comparisons ── */
  const periodKeys = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      const pr = r?.period_revenues;
      if (pr && typeof pr === "object") Object.keys(pr).forEach((k) => set.add(k));
      /* Also grab keys from comparisons dict so columns appear even when show_period=false */
      const comp = r?.comparisons;
      if (comp && typeof comp === "object" && !Array.isArray(comp)) {
        Object.keys(comp).forEach((k) => { if (k) set.add(k); });
      }
    });
    return Array.from(set).sort();
  }, [rows]);

  const isPeriodKey = useCallback((c) => periodKeys.includes(c), [periodKeys]);

  const customerInsightMap = useMemo(() => buildRevenueCustomerInsights(rows, periodKeys), [rows, periodKeys]);
  const revenueExecutive = useMemo(() => buildRevenueExecutive(rows), [rows]);

  /* ── Build visible cols for normal table (respects toggles) ── */
  const visibleCols = useMemo(() => {
    const cols = ["customer_name"];
    COLUMN_TOGGLES.forEach(({ flag, key }) => {
      if (key === "period") return;
      if (colToggles[flag]) cols.push(key);
    });
    if (colToggles.show_period && periodKeys.length) cols.push(...periodKeys);
    cols.push("revenue", "ai_insights", "ai_recommendation");
    return cols;
  }, [colToggles, periodKeys]);

  /* ── Build visible base cols for comparison table (respects toggles) ── */
  const visibleBaseCols = useMemo(() => {
    const cols = ["customer_name"];
    if (colToggles.show_product)  cols.push("product_name");
    if (colToggles.show_entity)   cols.push("entity_name");
    if (colToggles.show_region)   cols.push("region");
    if (colToggles.show_category) cols.push("category");
    return cols;
  }, [colToggles]);

  /* ════════════════════════════
     FETCH
  ════════════════════════════ */
  const fetchRevenue = useCallback(async (applied, toggles = colToggles) => {
    if (!token || !year) return;

    /* Bump the sequence so only the latest response is allowed to write
       state. (No AbortController here: cachedFetch dedupes concurrent
       requests to the same URL across callers, so aborting one caller's
       controller would cancel the shared in-flight promise for everyone
       — including a still-valid newer call that dedupes onto it. The
       seq check below is sufficient to discard stale responses.) */
    const seq = ++fetchSeqRef.current;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("currency_filter", applied.currency_filter);
      params.set("period",          applied.period);
      params.set("sort_by",         applied.sort_by    || "customer_name");
      params.set("sort_order",      applied.sort_order || "asc");
      params.set("page",            1);
      params.set("page_size",       2000);
      params.set("excel_download",  "false");
      params.set("view_mode",       applied.view_mode  || "monthly");
      if (applied.quarter && applied.quarter !== "none") params.set("quarter", applied.quarter);

      /* column toggle API params */
      COLUMN_TOGGLES.forEach(({ flag, apiParam }) => {
        params.set(apiParam, String(Boolean(toggles[flag])));
      });

      if (applied.comparison)                params.set("comparison",   applied.comparison);
      if (applied.entity_name   !== "All")   params.set("entity_name",  applied.entity_name);
      if (applied.product_name  !== "All")   params.set("product_name", applied.product_name);
      if (applied.region        !== "All")   params.set("region",       applied.region);
      if (applied.category      !== "All")   params.set("category",     applied.category);
      if (applied.customer_name !== "All")   params.set("customer_name",applied.customer_name);
      if (applied.date_from)                 params.set("date_from",    applied.date_from);
      if (applied.date_to)                   params.set("date_to",      applied.date_to);

      const url = `${API_BASE_URL}/api/v1/company/financial/Revenue_Report/${year}/${currency}?${params.toString()}`;
      const api = await cachedFetch(url, {
        headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
      });

      /* Drop the response if a newer fetch has started in the meantime. */
      if (seq !== fetchSeqRef.current) return;

      const allProducts = Array.isArray(api?.products) ? api.products : [];
      /* Separate Grand Total row */
      const gtRow   = allProducts.find((p) => p.customer_name === "Grand Total");
      const dataRows = allProducts.filter((p) => p.customer_name !== "Grand Total");
      setRows(dataRows);
      setGrandTotalData(gtRow || api?.grand_total || null);

      setFiltersData({
        entities:   api?.filters?.entities   || api?.entities   || [],
        products:   api?.filters?.products   || api?.products_list || [],
        regions:    api?.filters?.regions    || api?.regions    || [],
        categories: api?.filters?.categories || api?.categories || [],
        customers:  api?.filters?.customers  || api?.customers  || [],
      });

      setMetrics(api?.key_metrics || null);
    } catch (e) {
      if (e?.name === "AbortError") return;
      console.error(e);
      if (seq !== fetchSeqRef.current) return;
      setRows([]); setGrandTotalData(null); setMetrics(null);
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }, [token, year, colToggles]);

  /* ── Column toggle → debounced re-fetch ──
     Update the checkbox UI instantly, but coalesce the network call so
     rapidly checking several boxes (e.g. all 5) fires one request with the
     final combination instead of one heavy request per click. */
  const onToggleColumn = (flag) => {
    setColToggles((prev) => {
      const next = { ...prev, [flag]: !prev[flag] };
      if (toggleDebounceRef.current) clearTimeout(toggleDebounceRef.current);
      toggleDebounceRef.current = setTimeout(() => {
        fetchRevenue(filters, next);
      }, 250);
      return next;
    });
  };

  useEffect(() => () => {
    if (toggleDebounceRef.current) clearTimeout(toggleDebounceRef.current);
  }, []);

  /* ════════════════════════════
     EXCEL DOWNLOAD
  ════════════════════════════ */
  // `withCommentary` = the commentary to add as a sheet (collectCommentary), or null.
  const downloadExcel = useCallback(async (withCommentary = null) => {
    if (!token || !year) return;
    setExcelLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("currency_filter", filters.currency_filter);
      params.set("period",          filters.period);
      params.set("sort_by",         filters.sort_by    || "customer_name");
      params.set("sort_order",      filters.sort_order || "asc");
      params.set("page",            1);
      params.set("page_size",       2000);
      params.set("excel_download",  "true");
      params.set("view_mode",       filters.view_mode  || "monthly");
      if (filters.quarter && filters.quarter !== "none") params.set("quarter", filters.quarter);

      COLUMN_TOGGLES.forEach(({ flag, apiParam }) => {
        params.set(apiParam, String(Boolean(colToggles[flag])));
      });

      if (filters.comparison)                params.set("comparison",   filters.comparison);
      if (filters.entity_name   !== "All")   params.set("entity_name",  filters.entity_name);
      if (filters.product_name  !== "All")   params.set("product_name", filters.product_name);
      if (filters.region        !== "All")   params.set("region",       filters.region);
      if (filters.category      !== "All")   params.set("category",     filters.category);
      if (filters.customer_name !== "All")   params.set("customer_name",filters.customer_name);
      if (filters.date_from)                 params.set("date_from",    filters.date_from);
      if (filters.date_to)                   params.set("date_to",      filters.date_to);

      const url = `${API_BASE_URL}/api/v1/company/financial/Revenue_Report/${year}/${currency}?${params.toString()}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, accept: "*/*" } });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const file = withCommentary ? await xlsxWithCommentary(blob, withCommentary) : blob;
      const link = document.createElement("a");
      link.href     = URL.createObjectURL(file);
      link.download = `Revenue_${year}_${currency}.xlsx`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e) {
      console.error(e);
    } finally {
      setExcelLoading(false);
    }
  }, [token, year, filters, colToggles]);

  // Same param names downloadExcel sends (minus excel_download/page/
  // page_size, which the schedule path adds itself), so a scheduled send
  // reproduces this exact filtered view.
  const scheduleFilters = useMemo(() => {
    const out = {
      currency_filter: filters.currency_filter,
      period: filters.period,
      sort_by: filters.sort_by || "customer_name",
      sort_order: filters.sort_order || "asc",
      view_mode: filters.view_mode || "monthly",
    };
    if (filters.quarter && filters.quarter !== "none") out.quarter = filters.quarter;
    COLUMN_TOGGLES.forEach(({ flag, apiParam }) => {
      out[apiParam] = String(Boolean(colToggles[flag]));
    });
    if (filters.comparison) out.comparison = filters.comparison;
    if (filters.entity_name !== "All") out.entity_name = filters.entity_name;
    if (filters.product_name !== "All") out.product_name = filters.product_name;
    if (filters.region !== "All") out.region = filters.region;
    if (filters.category !== "All") out.category = filters.category;
    if (filters.customer_name !== "All") out.customer_name = filters.customer_name;
    if (filters.date_from) out.date_from = filters.date_from;
    if (filters.date_to) out.date_to = filters.date_to;
    return out;
  }, [filters, colToggles]);

  /* Initial load only — must NOT depend on `fetchRevenue` (which changes
     with colToggles) or it will re-fire on every toggle and overwrite
     the user's selection with DEFAULT_COLUMN_TOGGLES.
     It fetches with the defaults, so reset the filter/toggle state to match
     (otherwise a year change leaves the old filters showing over default
     data), and drop any pending toggle refetch for the previous year. The
     fetch is imperative, so these resets don't trigger a second fetch. */
  useEffect(() => {
    if (!token || !year) return;
    if (toggleDebounceRef.current) clearTimeout(toggleDebounceRef.current);
    setFilters(DEFAULT_FILTERS);
    setDraftFilters(DEFAULT_FILTERS);
    setColToggles(DEFAULT_COLUMN_TOGGLES);
    fetchRevenue(DEFAULT_FILTERS, DEFAULT_COLUMN_TOGGLES);
  }, [token, year]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Quarterly comparison header ── */
  const comparisonHeader = useMemo(() => {
    if (!rows?.length) return {};
    const first = rows.find((r) => Array.isArray(r?.comparisons?.quarters) && r.comparisons.quarters.length);
    if (!first) return {};
    const map = buildQuarterCompareMap(first);
    const out = {};
    Q_KEYS.forEach((q) => {
      const item = map[q];
      out[q] = {
        baseQ: item?.base_quarter    ? quarterLabel(item.base_quarter)    : "—",
        compQ: item?.compare_quarter ? quarterLabel(item.compare_quarter) : "—",
      };
    });
    return out;
  }, [rows]);

  /* ── Comparison helpers (same structure for monthly AND quarterly) ──
     Backend returns row.comparisons as a period-keyed dict:
     { "2025-03": { current_period, compare_period, current_revenue,
                    compare_revenue, variance, pct_change_revenue }, ... }   */
  const getCompareItem = useCallback((row, period) => {
    return row?.comparisons?.[period] || null;
  }, []);

  const compareHeader = useMemo(() => {
    if (!rows.length) return {};
    const first = rows.find((r) => r?.comparisons && Object.keys(r.comparisons).length > 0);
    if (!first) return {};
    const out = {};
    periodKeys.forEach((p) => {
      const item = first.comparisons?.[p];
      out[p] = {
        basePeriod:    item?.current_period || p,
        comparePeriod: item?.compare_period || "—",
      };
    });
    return out;
  }, [rows, periodKeys]);

  /* ════════════════════════════
     ACTIVE TAGS
  ════════════════════════════ */
  const activeTags = useMemo(() => {
    const tags = [];
    if (filters.comparison)               tags.push(`Comparison: ${COMPARISONS.find((c) => c.id === filters.comparison)?.label || filters.comparison}`);
    if (filters.period !== "all")         tags.push(`Period: ${TIME_FILTERS.find((t) => t.id === filters.period)?.label || filters.period}`);
    if (filters.date_from)               tags.push(`From: ${filters.date_from}`);
    if (filters.date_to)                 tags.push(`To: ${filters.date_to}`);
    if (filters.view_mode !== "monthly") tags.push(`View: ${VIEW_MODES.find((v) => v.id === filters.view_mode)?.label}`);
    if (filters.quarter   !== "none")    tags.push(`Quarter: ${QUARTER_OPTIONS.find((q) => q.id === filters.quarter)?.label || filters.quarter}`);
    if (filters.currency_filter !== "actualvalue") tags.push(`Unit: ${CURRENCY_FILTERS.find((c) => c.id === filters.currency_filter)?.label}`);
    if (filters.entity_name   !== "All") tags.push(`Entity: ${filters.entity_name}`);
    if (filters.product_name  !== "All") tags.push(`Product: ${filters.product_name}`);
    if (filters.region        !== "All") tags.push(`Region: ${filters.region}`);
    if (filters.category      !== "All") tags.push(`Category: ${filters.category}`);
    if (filters.customer_name !== "All") tags.push(`Customer: ${filters.customer_name}`);
    if (filters.sort_by !== "customer_name" || filters.sort_order !== "asc") {
      tags.push(`Sort: ${SORT_BY_OPTIONS.find((s) => s.id === filters.sort_by)?.label || filters.sort_by} (${filters.sort_order})`);
    }
    return tags;
  }, [filters]);

  /* ════════════════════════════
     REPORT AI (insights + saved commentary)
  ════════════════════════════ */
  // Sorting only reorders the rows, so it doesn't define a separate view.
  // Column toggles change row granularity, not the filtered data — they're
  // part of viewKey instead.
  const { sort_by: _sortBy, sort_order: _sortOrder, ...commentaryFilters } = filters;

  const commentary = useReportCommentary({
    token,
    reportId: "revenue",
    year,
    currency,
    filters: commentaryFilters,
  });

  const insightFilterLabels = useMemo(
    () => activeTags.filter((t) => !t.startsWith("Sort:")),
    [activeTags],
  );

  const viewKey = `${year}|${currency}|${JSON.stringify(filters)}|${JSON.stringify(colToggles)}`;

  /* ── Row commentary (Refine with AI) + ✦ Explain this number ──
     Rows are customers, split by the toggled dimensions; a row's key is the
     customer + those dimension values, its label the readable form. */
  const lineCommentary = useLineItemCommentary({
    token,
    reportId: "revenue",
    year,
    currency,
    filters: commentaryFilters,
  });

  const [refineLine, setRefineLine] = useState(null);
  const [analyzeTarget, setAnalyzeTarget] = useState(null);
  useEffect(() => {
    setRefineLine(null);
    setAnalyzeTarget(null);
  }, [viewKey]);

  const rowDimKeys = useMemo(() => visibleBaseCols.filter((c) => c !== "customer_name"), [visibleBaseCols]);
  const rowLabelOf = useCallback((r) => revenueRowLabel(r, rowDimKeys), [rowDimKeys]);

  // Per-row key/label (aligned with `rows`) and key → row, built once per data change.
  const rowIndex = useMemo(() => {
    const keys = rows.map((r) => revenueRowKey(r, rowDimKeys));
    const labels = rows.map(rowLabelOf);
    const byKey = new Map();
    const lines = [];
    keys.forEach((key, i) => {
      if (byKey.has(key)) return;
      byKey.set(key, rows[i]);
      lines.push({ key, label: labels[i] });
    });
    return { keys, labels, byKey, lines };
  }, [rows, rowDimKeys, rowLabelOf]);

  const tableMode = isComparisonOn ? "comparison" : isQuarterlyView ? "quarterly" : "monthly";

  // Snapshot of the table on screen for the AI — built on click only.
  const aiView = () => {
    const comparisonLabel = COMPARISONS.find((c) => c.id === filters.comparison)?.label || filters.comparison;
    const granularity = isQuarterlyView ? "quarterly" : "monthly";
    return {
      rows,
      periodKeys,
      isComparison: isComparisonOn,
      grandTotalData,
      metrics,
      rowLabel: rowLabelOf,
      tableView: isComparisonOn
        ? `Revenue by customer — ${comparisonLabel} comparison, ${granularity} (current vs compare period)`
        : `Revenue by customer — ${granularity}`,
      valueScale: CURRENCY_FILTERS.find((c) => c.id === filters.currency_filter)?.label || "Actual",
      splitBy: rowDimKeys.map((k) => COLUMN_TOGGLES.find((t) => t.key === k)?.label.toLowerCase() || k),
    };
  };

  const buildLineItemContext = (key) => buildRevenueLineItemContext(aiView(), rowIndex.byKey.get(key));

  const loadAnalysisContext = async (target) =>
    buildRevenueAnalysisContext(aiView(), target, target.rowKey ? rowIndex.byKey.get(target.rowKey) : null);

  const openRefine = (key, label) => setRefineLine({ key, label });

  // ✦ pinned to the value cell's top-right corner (the cell is `relative`),
  // so it doesn't widen the column. `period` null = the Revenue total.
  const analyzeCellButton = ({ rowKey, label, period, raw, comparePeriod, suffix = "" }) => {
    if (toNumberForAI(raw) === null) return null;
    const value = `${displayValue(raw)}${suffix}`;
    const against = comparePeriod || "the compare period";
    const where = tableMode === "comparison" ? `${period} vs ${against}` : period || "Total revenue";
    const title =
      tableMode === "comparison"
        ? `${label} — revenue change ${period} vs ${against}`
        : period
          ? `${label} — revenue ${period}`
          : `${label} — total revenue`;
    const body =
      tableMode === "comparison"
        ? `AI explains what drove the change versus ${against}, with supporting data, and answers follow-up questions.`
        : period
          ? "AI breaks down what drove this number — the move vs the previous period, share and rank — with supporting data, and answers follow-up questions."
          : "AI explains this customer's total — trend, share and rank — with supporting data, and answers follow-up questions.";
    return (
      <AnalyzeButton
        onClick={() =>
          setAnalyzeTarget({ kind: "cell", component: "table", rowKey, metric: "revenue", period, mode: tableMode, title, value })
        }
        title={`Explain ${label} · ${where} with AI`}
        tooltip={{ heading: "Explain with AI", context: `${label} · ${where} · ${value}`, body }}
        className="absolute top-0 right-0 opacity-70 hover:opacity-100 focus:opacity-100"
      />
    );
  };

  const analyzeKpi = (metric, label, value) =>
    setAnalyzeTarget({ kind: "kpi", component: "kpi", metric, mode: tableMode, title: label, value });

  const buildInsightsContext = () => {
    if (!rows.length) return "";
    const num = (v) => toNumberForAI(v) ?? 0;
    const rowLabel = rowLabelOf;
    const totalRevenue = rows.reduce((s, r) => s + num(r.revenue), 0);
    const sharePct = (v) => (totalRevenue ? (num(v) / totalRevenue) * 100 : null);

    // Per-period values as shown: current revenue in comparison mode, else the period columns.
    const periodsOf = (r) =>
      Object.fromEntries(
        periodKeys
          .map((p) => {
            if (!isComparisonOn) return [p, r?.period_revenues?.[p]];
            const c = r?.comparisons?.[p];
            if (!c || (!num(c.current_revenue) && !num(c.compare_revenue))) return [p, undefined];
            return [p, { current: c.current_revenue, compare: c.compare_revenue, variance: c.variance, pct_change: c.pct_change_revenue }];
          })
          .filter(([, v]) => v !== undefined),
      );

    // Ranked by revenue in code (not the on-screen sort) so the most important rows come first.
    const byRevenue = [...rows].sort((a, b) => num(b.revenue) - num(a.revenue));
    const toAIRow = (r, rank) => ({
      customer: rowLabel(r),
      rank,
      revenue: r.revenue,
      share_of_total_pct: sharePct(r.revenue),
      periods: periodsOf(r),
    });
    const top = byRevenue.slice(0, 15);
    const bottomStart = Math.max(top.length, byRevenue.length - 5);

    // Customer-level facts — split rows are rolled up per customer.
    const byCustomer = new Map();
    rows.forEach((r) => {
      const name = r?.customer_name || "Unknown";
      byCustomer.set(name, (byCustomer.get(name) || 0) + num(r.revenue));
    });
    const customers = [...byCustomer].map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue);
    const top10Revenue = customers.slice(0, 10).reduce((s, c) => s + c.revenue, 0);

    const periodTotals = periodKeys.map((p) => ({
      period: p,
      revenue: grandTotalData
        ? (isComparisonOn ? grandTotalData?.comparisons?.[p]?.current_revenue : grandTotalData?.period_revenues?.[p])
        : rows.reduce((s, r) => s + num(isComparisonOn ? r?.comparisons?.[p]?.current_revenue : r?.period_revenues?.[p]), 0),
    }));

    // Comparison: biggest movers in the latest period that has revenue.
    const latestPeriod = isComparisonOn
      ? [...periodTotals].reverse().find((x) => num(x.revenue))?.period
      : null;

    const facts = {
      customer_count: customers.length,
      row_count: rows.length !== customers.length ? rows.length : undefined,
      total_revenue: totalRevenue,
      top_10_customers_share_pct: totalRevenue ? (top10Revenue / totalRevenue) * 100 : undefined,
      customers_by_revenue:
        customers.length > 1
          ? rankForAI(customers, (c) => c.revenue, (c) => c.name, Math.min(5, Math.floor(customers.length / 2)))
          : undefined,
      periods_by_total_revenue:
        periodTotals.length > 1
          ? rankForAI(periodTotals, (x) => x.revenue, (x) => x.period, Math.min(3, Math.floor(periodTotals.length / 2)))
          : undefined,
      comparison: isComparisonOn
        ? {
            type: COMPARISONS.find((c) => c.id === filters.comparison)?.label || filters.comparison,
            compared_periods: Object.fromEntries(periodKeys.map((p) => [p, compareHeader?.[p]?.comparePeriod])),
            latest_period: latestPeriod,
            largest_changes_in_latest_period: latestPeriod
              ? rankForAI(rows, (r) => r?.comparisons?.[latestPeriod]?.variance, rowLabel, 3)
              : undefined,
          }
        : undefined,
    };

    const { ai_insights: _aiInsights, ...keyMetrics } = metrics || {};
    const grandRow = {
      customer: "Grand Total",
      revenue: grandTotalData?.revenue ?? grandTotalData?.total ?? totalRevenue,
      share_of_total_pct: 100,
      periods: grandTotalData ? periodsOf(grandTotalData) : Object.fromEntries(periodTotals.map((x) => [x.period, x.revenue])),
    };

    return buildReportAIContext({
      valueScale: CURRENCY_FILTERS.find((c) => c.id === filters.currency_filter)?.label || "Actual",
      notes: [
        "Figures are revenue in USD. Rows are customers (split by product, entity, region or category when those columns are shown). Share percentages are of total revenue in the view.",
        isComparisonOn &&
          "Each period shows current revenue, the compare period's revenue (see compared_periods), variance = current − compare and pct_change = variance ÷ compare × 100.",
      ]
        .filter(Boolean)
        .join(" "),
      keyMetrics: metrics ? keyMetrics : undefined,
      facts,
      // Grand total first, then the largest and smallest rows (trimmed from the end if too long).
      rows: [
        grandRow,
        ...top.map((r, i) => toAIRow(r, i + 1)),
        ...byRevenue.slice(bottomStart).map((r, i) => toAIRow(r, bottomStart + i + 1)),
      ],
    });
  };

  const removeFilter = (tag) => {
    const updater = (prev) => {
      const next = { ...prev };
      if (tag.startsWith("Comparison:"))  next.comparison      = "";
      else if (tag.startsWith("Period:")) next.period          = "all";
      else if (tag.startsWith("From:"))   next.date_from       = "";
      else if (tag.startsWith("To:"))     next.date_to         = "";
      else if (tag.startsWith("View:"))   next.view_mode       = "monthly";
      else if (tag.startsWith("Quarter:"))next.quarter         = "none";
      else if (tag.startsWith("Unit:"))   next.currency_filter = "actualvalue";
      else if (tag.startsWith("Entity:")) next.entity_name     = "All";
      else if (tag.startsWith("Product:"))next.product_name    = "All";
      else if (tag.startsWith("Region:")) next.region          = "All";
      else if (tag.startsWith("Category:")) next.category      = "All";
      else if (tag.startsWith("Customer:")) next.customer_name = "All";
      else if (tag.startsWith("Sort:")) { next.sort_by = "customer_name"; next.sort_order = "asc"; }
      return { ...next };
    };
    const next = updater(filters);
    setFilters(next); setDraftFilters(next); fetchRevenue(next, colToggles);
  };

  const onCancelDraft = () => { setDraftFilters(filters); setOpen(false); };

  const onResetAll = () => {
    setFilters(DEFAULT_FILTERS); setDraftFilters(DEFAULT_FILTERS);
    setColToggles(DEFAULT_COLUMN_TOGGLES);
    setOpen(false); fetchRevenue(DEFAULT_FILTERS, DEFAULT_COLUMN_TOGGLES);
  };

  const onApply = () => {
    const applied = { ...draftFilters };
    setFilters(applied); setOpen(false); fetchRevenue(applied, colToggles);
  };

  /* ── Column sort ── */
  const onColumnSort = (col) => {
    const nextOrder = filters.sort_by === col && filters.sort_order === "asc" ? "desc" : "asc";
    const next = { ...filters, sort_by: col, sort_order: nextOrder };
    setFilters(next); setDraftFilters(next); fetchRevenue(next, colToggles);
  };

  /* ── CSV ── */
  const csvData = useMemo(() => {
    if (!rows.length) return [];
    if (!isComparisonOn) {
      const header = [...visibleCols.filter((c) => c !== "ai_recommendation"), ...Q_KEYS, "total"];
      return [header, ...rows.map((r) => header.map((c) => r?.[c] ?? ""))];
    }
    const header = [
      ...visibleBaseCols, "comparison_type",
      ...Q_KEYS.flatMap((q) => [`${q}_base_quarter`, `${q}_compare_quarter`, `${q}_base_value`, `${q}_compare_value`, `${q}_variance`, `${q}_pct_change`]),
    ];
    return [
      header,
      ...rows.map((r) => {
        const map = buildQuarterCompareMap(r);
        return [
          ...visibleBaseCols.map((c) => r?.[c] ?? ""),
          r?.comparisons?.comparison_type ?? "",
          ...Q_KEYS.flatMap((q) => {
            const item = map[q] || {};
            return [item.base_quarter ?? "", item.compare_quarter ?? "", item.base_value ?? "", item.compare_value ?? "", item.variance ?? "", item.pct_change ?? ""];
          }),
        ];
      }),
    ];
  }, [rows, isComparisonOn, visibleCols, visibleBaseCols]);

  /* ── AI messages ── */
  const aiMessages = useMemo(() => {
    const first = rows?.find((r) => Array.isArray(r?.aiDriver) && r.aiDriver.length)
               ?? rows?.find((r) => Array.isArray(r?.ai_insights) && r.ai_insights.length);
    if (first?.aiDriver?.length) return first.aiDriver;
    if (first?.ai_insights?.length) return first.ai_insights;
    if (Array.isArray(metrics?.ai_insights) && metrics.ai_insights.length) return metrics.ai_insights;
    if (metrics) {
      const m = [];
      if (metrics.total_revenue   !== undefined) m.push(`Total revenue is ${money(metrics.total_revenue)}.`);
      if (metrics.highest_product)               m.push(`${metrics.highest_product} is the top performing product.`);
      if (metrics.growth_rate     != null)       m.push(`Growth rate is ${Number(metrics.growth_rate).toFixed(2)}%.`);
      return m.length ? m : DUMMY_AI_MESSAGES;
    }
    return DUMMY_AI_MESSAGES;
  }, [rows, metrics]);

  /* ── Sort arrow ── */
  const SortArrow = ({ col }) => {
    if (filters.sort_by !== col) return <span className="text-white/40 ml-1 text-[10px]">⇅</span>;
    return <span className="text-white ml-1 text-[10px]">{filters.sort_order === "asc" ? "↑" : "↓"}</span>;
  };

  // The commentary shown under the report, offered with the Excel download.
  const exportCommentary = collectCommentary({
    lineTitle: "Customer Commentary",
    lines: rowIndex.lines,
    byLine: lineCommentary.byLine,
    reportItems: commentary.items,
  });

  /* ══════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════ */
  return (
    <ReportsLayout>
      <main className="flex-1 min-w-0 bg-white p-3 rounded-xl shadow-md">

        {/* ── HEADER ── */}
        <div className="flex justify-between items-center gap-3 mb-2">
          <div>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h2 className="text-lg font-semibold text-sky-900">Revenue Report</h2>
              <p className="text-s text-sky-600">Customer Revenue Analysis | MoM / YoY Comparison | Quarterly View</p>
            </div>
            <p className="text-s bg-yellow-100 text-sky-900 px-2 py-0.5 rounded-md mt-1 inline-block">
              <strong>Note:</strong> Click any <strong>CUSTOMER NAME</strong> for drilldown insights
              {" "}· click <BsStars className="inline text-sky-600 align-[-2px]" /> on a value for an AI explanation
              {" "}· click <BsChatLeftText className="inline text-sky-600 align-[-2px]" /> for AI commentary
            </p>
          </div>
          {/* <Link
            to="/revenue-dashboard"
            className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg hover:bg-white hover:text-sky-900 transition border border-sky-900"
          >
            View More <FaArrowRightToBracket className="ml-1" />
          </Link> */}
        </div>

        {/* ══════════════════════════════════════════
            KPI CARDS  ← from HTML reference
        ══════════════════════════════════════════ */}
        {/* {metrics && (
          <div className="flex flex-wrap gap-3 mb-4">
            <KpiCard icon="💰" label="Total Revenue"   value={fmtKpi(metrics.total_revenue)}   sub="Total revenue"      />
            <KpiCard icon="📊" label="Avg Revenue"     value={fmtKpi(metrics.average_revenue)} sub="Per customer avg"   />
            <KpiCard icon="📈" label="Highest Revenue" value={fmtKpi(metrics.highest_revenue)} sub="Top customer"    variant="positive" />
            <KpiCard icon="📉" label="Lowest Revenue"  value={fmtKpi(metrics.lowest_revenue)}  sub="Bottom customer"   />
          </div>
        )} */}

        {/* ── FILTER BAR ── */}
        <div className="mb-3 flex items-start justify-between gap-3 flex-wrap" ref={ref}>
          {/* Active tags */}
          <div className="flex flex-wrap gap-2 mr-auto min-h-[34px]">
            {activeTags.length === 0 ? (
              <span className="text-x text-sky-400 italic">No filters applied</span>
            ) : (
              activeTags.map((tag) => (
                <span key={tag} className="flex items-center gap-2 px-3 py-1 text-x rounded-full bg-sky-800 text-white">
                  {tag}
                  <button onClick={() => removeFilter(tag)} className="text-sky-200 hover:text-white font-bold" title="Remove">×</button>
                </span>
              ))
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">

            {/* Filter dropdown */}
            <div className="relative">
              <button
                onClick={() => { if (!open) setDraftFilters(filters); setOpen(!open); }}
                aria-label="Filters"
                className="relative group flex items-center px-3 py-2.5 text-x font-medium rounded-lg border transition bg-sky-100 border-sky-200 text-sky-800 hover:bg-sky-200"
              >
                <FiFilter size={14} />
                <ActionHoverLabel>Filters</ActionHoverLabel>
              </button>

              <AnimatePresence>
                {open && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute right-0 mt-2 w-[620px] bg-sky-50 border border-sky-200 rounded-xl shadow-lg z-50"
                  >
                    <div className="p-4 grid grid-cols-2 gap-3 text-x">

                      {/* View Mode — NEW from HTML reference */}
                      <Select
                        label="View Mode"
                        value={draftFilters.view_mode}
                        options={VIEW_MODES.map((v) => v.id)}
                        labels={Object.fromEntries(VIEW_MODES.map((v) => [v.id, v.label]))}
                        onChange={(v) => setDraftFilters((f) => ({ ...f, view_mode: v, quarter: v === "monthly" ? "none" : f.quarter }))}
                      />

                      {/* Quarter — shown always, useful only in quarterly mode */}
                      <Select
                        label="Quarter"
                        value={draftFilters.quarter}
                        options={QUARTER_OPTIONS.map((q) => q.id)}
                        labels={Object.fromEntries(QUARTER_OPTIONS.map((q) => [q.id, q.label]))}
                        onChange={(v) => setDraftFilters((f) => ({ ...f, quarter: v }))}
                      />

                      <Select
                        label="Period"
                        value={draftFilters.period}
                        options={TIME_FILTERS.map((t) => t.id)}
                        labels={Object.fromEntries(TIME_FILTERS.map((t) => [t.id, t.label]))}
                        onChange={(v) => setDraftFilters((f) => ({ ...f, period: v }))}
                      />

                      <Select
                        label="Currency Unit"
                        value={draftFilters.currency_filter}
                        options={CURRENCY_FILTERS.map((c) => c.id)}
                        labels={Object.fromEntries(CURRENCY_FILTERS.map((c) => [c.id, c.label]))}
                        onChange={(v) => setDraftFilters((f) => ({ ...f, currency_filter: v }))}
                      />

                      <div>
                        <label className="block text-x text-sky-700 mb-1">Date From (YYYY-MM)</label>
                        <input
                          type="month"
                          value={draftFilters.date_from}
                          onChange={(e) => setDraftFilters((f) => ({ ...f, date_from: e.target.value }))}
                          className="w-full border border-sky-200 rounded p-2 text-x bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-x text-sky-700 mb-1">Date To (YYYY-MM)</label>
                        <input
                          type="month"
                          value={draftFilters.date_to}
                          onChange={(e) => setDraftFilters((f) => ({ ...f, date_to: e.target.value }))}
                          className="w-full border border-sky-200 rounded p-2 text-x bg-white"
                        />
                      </div>

                      <Select
                        label="Comparison"
                        value={draftFilters.comparison}
                        options={COMPARISONS.map((c) => c.id)}
                        labels={Object.fromEntries(COMPARISONS.map((c) => [c.id, c.label]))}
                        onChange={(v) => setDraftFilters((f) => ({ ...f, comparison: v }))}
                      />

                      <Select
                        label="Customer"
                        value={draftFilters.customer_name}
                        options={["All", ...filtersData.customers]}
                        onChange={(v) => setDraftFilters((f) => ({ ...f, customer_name: v }))}
                      />

                      <Select
                        label="Entity"
                        value={draftFilters.entity_name}
                        options={["All", ...filtersData.entities]}
                        onChange={(v) => setDraftFilters((f) => ({ ...f, entity_name: v }))}
                      />

                      <Select
                        label="Product"
                        value={draftFilters.product_name}
                        options={["All", ...filtersData.products]}
                        onChange={(v) => setDraftFilters((f) => ({ ...f, product_name: v }))}
                      />

                      <Select
                        label="Region"
                        value={draftFilters.region}
                        options={["All", ...filtersData.regions]}
                        onChange={(v) => setDraftFilters((f) => ({ ...f, region: v }))}
                      />

                      <Select
                        label="Category"
                        value={draftFilters.category}
                        options={["All", ...filtersData.categories]}
                        onChange={(v) => setDraftFilters((f) => ({ ...f, category: v }))}
                      />

                      <Select
                        label="Sort By"
                        value={draftFilters.sort_by}
                        options={SORT_BY_OPTIONS.map((s) => s.id)}
                        labels={Object.fromEntries(SORT_BY_OPTIONS.map((s) => [s.id, s.label]))}
                        onChange={(v) => setDraftFilters((f) => ({ ...f, sort_by: v }))}
                      />

                      <Select
                        label="Sort Order"
                        value={draftFilters.sort_order}
                        options={SORT_ORDER_OPTIONS.map((s) => s.id)}
                        labels={Object.fromEntries(SORT_ORDER_OPTIONS.map((s) => [s.id, s.label]))}
                        onChange={(v) => setDraftFilters((f) => ({ ...f, sort_order: v }))}
                      />
                    </div>

                    <div className="p-3 border-t border-sky-200 flex gap-2">
                      <button onClick={onCancelDraft} className="w-full py-2 text-x bg-white border border-sky-200 text-sky-900 rounded-lg hover:bg-sky-100">
                        Cancel
                      </button>
                      <button onClick={onResetAll} className="w-full py-2 text-x bg-sky-200 text-sky-900 rounded-lg hover:bg-sky-300">
                        Reset All
                      </button>
                      <button
                        onClick={onApply}
                        disabled={!isDirty}
                        className={["w-full py-2 text-x rounded-lg font-semibold", isDirty ? "bg-sky-900 text-white hover:bg-sky-800" : "bg-slate-200 text-slate-500 cursor-not-allowed"].join(" ")}
                      >
                        Apply Filters
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* <CSVLink
              data={csvData}
              filename={`Revenue_${year}_${currency}.csv`}
              className="flex items-center gap-2 px-3 py-2 text-x bg-white text-sky-800 border border-sky-300 rounded-lg hover:bg-sky-100"
            >
              <FiDownload /> CSV
            </CSVLink> */}

            <ExportMenu
              label="Excel"
              format="excel"
              busy={excelLoading}
              commentaryCount={commentaryCount(exportCommentary)}
              onExport={(include) => downloadExcel(include ? exportCommentary : null)}
              className="relative group flex items-center px-3 py-2.5 text-x bg-green-50 text-green-800 rounded-lg border border-green-200 hover:bg-green-100 disabled:opacity-50"
            />

            <AddAutomation
              reportType="revenue_report"
              reportLabel="Revenue Report"
              year={year}
              currency={currency}
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

            <span className="h-6 w-px bg-sky-200" aria-hidden="true" />

            <AIActionsMenu
              reportId="revenue"
              showTableHelp
              insights={{
                commentary,
                reportLabel: "Revenue Report",
                filterLabels: insightFilterLabels,
                viewKey,
                buildContext: buildInsightsContext,
                disabled: loading || !rows.length,
              }}
            />
          </div>
        </div>

        {/* ══════════════════════════════════════════
            COLUMN TOGGLES  ← from HTML reference
        ══════════════════════════════════════════ */}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-100 bg-sky-50 px-3 py-1">
          <div className="flex flex-wrap items-center gap-4">
            {COLUMN_TOGGLES.map(({ flag, label }) => (
              <label key={flag} className="inline-flex items-center gap-1.5 text-x font-medium text-sky-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(colToggles[flag])}
                  onChange={() => onToggleColumn(flag)}
                  className="h-3.5 w-3.5 rounded border-sky-300 text-sky-800 focus:ring-sky-500"
                />
                {label}
              </label>
            ))}
          </div>
          <span className="text-[11px] font-semibold text-sky-600">Click column headers to sort ↕️</span>
        </div>

        {loading && <TableSkeleton />}

        {/* ══════════════════════════════════════════
            NORMAL TABLE (no comparison)
        ══════════════════════════════════════════ */}
        {!loading && rows.length > 0 && !isComparisonOn && (
          <div className="report-table-scroll overflow-auto mt-2 max-h-[440px] border border-sky-200 rounded-lg bg-white">
            <table className="min-w-[900px] w-full text-x">
              <thead className="sticky top-0 bg-sky-900 text-white z-10">
                <tr>
                  {visibleCols.map((c) => {
                    const isPeriod  = isPeriodKey(c);
                    const isNum     = c === "revenue" || isPeriod;
                    const isInsight = c === "ai_insights";
                    const isReco    = c === "ai_recommendation";
                    const isAI      = isInsight || isReco;
                    return (
                      <th
                        key={c}
                        className={[
                          "px-3 py-1.5 font-semibold whitespace-nowrap",
                          isNum ? "text-right" : "text-left",
                          isPeriod || isAI ? "" : "cursor-pointer hover:bg-sky-800",
                        ].join(" ")}
                        onClick={isPeriod || isAI ? undefined : () => onColumnSort(c === "revenue" ? "total_amount" : c)}
                      >
                        {isPeriod ? c : isInsight ? "Insights" : isReco ? "Recommendation" : keyToNice(c)}
                        {!isPeriod && !isAI && <SortArrow col={c === "revenue" ? "total_amount" : c} />}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {rows.map((r, i) => {
                  const rowKey   = rowIndex.keys[i];
                  const rowLabel = rowIndex.labels[i];
                  // Saved row commentary wins over the rule-based insight.
                  const saved       = lineCommentary.byLine[rowKey];
                  const insightText = saved?.explanation || customerInsightMap.get(r?.customer_name) || "—";
                  return (
                  <tr
                    key={i}
                    className="border-b border-sky-50 hover:bg-sky-50 transition-colors text-sky-900"
                  >
                    {visibleCols.map((c) => {
                      const isCustomer = c === "customer_name";
                      const isPeriod   = isPeriodKey(c);
                      const isNum      = c === "revenue" || isPeriod;
                      const isInsight  = c === "ai_insights";
                      const isReco     = c === "ai_recommendation";
                      const cellValue  = isPeriod ? r?.period_revenues?.[c] : r?.[c];
                      return (
                        <td
                          key={c}
                          className={[
                            "px-3 py-2",
                            isInsight ? "w-[380px] min-w-[380px] text-sky-700"
                              : isReco ? "w-[340px] min-w-[340px] text-sky-700"
                              : "whitespace-nowrap",
                            isNum      ? "relative text-right font-medium"                : "text-left",
                            isCustomer ? "hover:text-blue-600 cursor-pointer font-medium" : "",
                          ].join(" ")}
                          onClick={isCustomer ? () => { const n = r?.customer_name || ""; if (!n) return; setDrillCustomer(n); setDrillOpen(true); } : undefined}
                          role={isCustomer ? "button" : undefined}
                          tabIndex={isCustomer ? 0 : undefined}
                          onKeyDown={isCustomer ? (e) => { if (e.target !== e.currentTarget) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); const n = r?.customer_name || ""; if (!n) return; setDrillCustomer(n); setDrillOpen(true); } } : undefined}
                        >
                          {isCustomer ? (
                            <span className="flex items-center justify-between gap-2">
                              <span title="Click to view drilldown">{safeText(cellValue)}</span>
                              <LineItemAIButton
                                noun="commentary"
                                label={rowLabel}
                                hasCommentary={!!saved}
                                onClick={() => openRefine(rowKey, rowLabel)}
                              />
                            </span>
                          ) : isInsight ? (
                            <p className="line-clamp-2 leading-snug" title={insightText}>
                              {saved?.explanation && (
                                <BsChatLeftTextFill
                                  size={11}
                                  className="inline mr-1 align-[-1px] text-emerald-600"
                                  aria-label="Saved AI commentary"
                                />
                              )}
                              {insightText}
                            </p>
                          ) : isReco ? (
                            saved?.recommendation ? (
                              <p className="line-clamp-2 leading-snug" title={saved.recommendation}>
                                {saved.recommendation}
                              </p>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openRefine(rowKey, rowLabel)}
                                className="inline-flex items-center gap-1 text-sky-500 hover:text-sky-800 whitespace-nowrap"
                              >
                                <BsChatLeftText size={12} /> Get AI recommendation
                              </button>
                            )
                          ) : isNum ? (
                            <>
                              {analyzeCellButton({ rowKey, label: rowLabel, period: isPeriod ? c : null, raw: cellValue })}
                              {displayValue(cellValue)}
                            </>
                          ) : safeText(cellValue)}
                        </td>
                      );
                    })}
                  </tr>
                  );
                })}

                {/* Grand Total sticky row */}
                {grandTotalData && (
                  <tr className="sticky bottom-0 bg-sky-50 font-semibold border-t-2 border-sky-200 text-sky-900">
                    {visibleCols.map((c, idx) => {
                      const isPeriod  = isPeriodKey(c);
                      const isNum     = c === "revenue" || isPeriod;
                      const isInsight = c === "ai_insights";
                      const isReco    = c === "ai_recommendation";
                      const gtInsight = isInsight && Array.isArray(grandTotalData?.ai_insights) && grandTotalData.ai_insights.length
                        ? grandTotalData.ai_insights.join(" ")
                        : "";
                      return (
                        <td
                          key={c}
                          className={[
                            "px-3 py-2.5",
                            isInsight ? "w-[380px] min-w-[380px]"
                              : isReco ? "w-[340px] min-w-[340px]"
                              : "whitespace-nowrap",
                            isNum ? "text-right" : "text-left",
                          ].join(" ")}
                        >
                          {idx === 0
                            ? <strong>📊 Grand Total</strong>
                            : isPeriod
                            ? <strong>{displayValue(grandTotalData?.period_revenues?.[c])}</strong>
                            : c === "revenue"
                            ? <strong>{displayValue(grandTotalData?.revenue ?? grandTotalData?.total)}</strong>
                            : gtInsight
                            ? <p className="line-clamp-2 leading-snug" title={gtInsight}>{gtInsight}</p>
                            : ""}
                        </td>
                      );
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ══════════════════════════════════════════
            COMPARISON TABLE  (monthly OR quarterly — unified)
            Backend: row.comparisons = { "2025-03": { current_period, compare_period,
              current_revenue, compare_revenue, variance, pct_change_revenue }, ... }
        ══════════════════════════════════════════ */}
        {!loading && rows.length > 0 && isComparisonOn && periodKeys.length > 0 && (
          <div className="report-table-scroll overflow-auto mt-3 max-h-[520px] border border-sky-200 rounded-lg bg-white">
            <table className="min-w-max w-full text-x">
              <thead className="sticky top-0 z-20">
                {/* ROW 1 — dimension cols (rowSpan=2) + period group headers */}
                <tr className="bg-[#04577c] text-white">
                  {visibleBaseCols.map((c, idx) => (
                    <th
                      key={c}
                      rowSpan={2}
                      className={[
                        "px-3 py-1.5 text-left whitespace-nowrap cursor-pointer hover:bg-sky-800 bg-[#04577c] z-30",
                        idx === 0 ? "sticky left-0" : "border-l border-white/15",
                      ].join(" ")}
                      onClick={() => onColumnSort(c)}
                    >
                      {keyToNice(c)}<SortArrow col={c} />
                    </th>
                  ))}
                  {periodKeys.map((p, idx) => {
                    const cp = compareHeader?.[p]?.comparePeriod || "";
                    return (
                      <th key={`grp-${p}`} colSpan={3}
                        className={["px-4 py-1.5 text-center whitespace-nowrap font-bold",
                          idx > 0 ? "border-l-2 border-white/20" : "border-l border-white/20"].join(" ")}>
                        {p}{cp ? ` vs ${cp}` : ""}
                      </th>
                    );
                  })}
                </tr>

                {/* ROW 2 — Base[period] / Compare[prev-period] / Variance Δ/% */}
                <tr className="bg-[#0b6a92] text-white">
                  {periodKeys.flatMap((p, idx) => {
                    const basePeriod    = compareHeader?.[p]?.basePeriod    || p;
                    const comparePeriod = compareHeader?.[p]?.comparePeriod || "—";
                    return [
                      <th key={`${p}-base`}
                        className={["px-3 py-1 text-center whitespace-nowrap",
                          idx > 0 ? "border-l-2 border-white/20" : "border-l border-white/20"].join(" ")}>
                        <div className="text-white/60 text-[10px] leading-tight">{basePeriod}</div>
                        <div className="font-semibold text-xs">Base</div>
                      </th>,
                      <th key={`${p}-comp`} className="px-3 py-1 text-center whitespace-nowrap border-l border-white/15">
                        <div className="text-white/60 text-[10px] leading-tight">{comparePeriod}</div>
                        <div className="font-semibold text-xs">Compare</div>
                      </th>,
                      <th key={`${p}-var`} className="px-3 py-1 text-center whitespace-nowrap border-l border-white/15">
                        <div className="text-white/60 text-[10px] leading-tight">&nbsp;</div>
                        <div className="font-semibold text-xs">Variance Δ/%</div>
                      </th>,
                    ];
                  })}
                </tr>
              </thead>

              <tbody>
                {rows.map((r, i) => {
                  const rowKey   = rowIndex.keys[i];
                  const rowLabel = rowIndex.labels[i];
                  return (
                  <tr
                    key={i}
                    className="border-b border-sky-50 text-sky-900 hover:bg-sky-50 transition-colors"
                  >
                    {visibleBaseCols.map((c, idx) => (
                      <td
                        key={`${i}-${c}`}
                        className={[
                          "px-3 py-2.5 whitespace-nowrap text-left",
                          idx === 0 ? "sticky left-0 bg-white z-10 border-r border-sky-100" : "",
                          c === "customer_name" ? "hover:text-blue-600 cursor-pointer font-medium" : "",
                        ].join(" ")}
                        onClick={c === "customer_name" ? () => { const n = r?.customer_name || ""; if (!n) return; setDrillCustomer(n); setDrillOpen(true); } : undefined}
                        role={c === "customer_name" ? "button" : undefined}
                        tabIndex={c === "customer_name" ? 0 : undefined}
                      >
                        {c === "customer_name" ? (
                          <span className="flex items-center justify-between gap-2">
                            <span title="Click to view drilldown">{safeText(r?.[c])}</span>
                            <LineItemAIButton
                              noun="commentary"
                              label={rowLabel}
                              hasCommentary={!!lineCommentary.byLine[rowKey]}
                              onClick={() => openRefine(rowKey, rowLabel)}
                            />
                          </span>
                        ) : safeText(r?.[c])}
                      </td>
                    ))}

                    {periodKeys.map((p, idx) => {
                      const item     = getCompareItem(r, p);
                      /* Exact field names from backend */
                      const baseV    = item?.current_revenue ?? null;
                      const compV    = item?.compare_revenue ?? null;
                      const variance = item?.variance        ?? null;
                      const pct      = item ? pctInline(item.pct_change_revenue) : null;
                      const st       = diffStyle(variance);
                      return (
                        <React.Fragment key={`${i}-${p}`}>
                          <td className={["px-3 py-2.5 whitespace-nowrap text-right font-medium",
                            idx > 0 ? "border-l-2 border-sky-100" : "border-l border-sky-100"].join(" ")}>
                            {baseV !== null ? displayValue(baseV) : "—"}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-right border-l border-sky-100 text-sky-500 font-medium">
                            {compV !== null ? displayValue(compV) : "—"}
                          </td>
                          <td className={`relative px-3 py-2.5 whitespace-nowrap border-l border-sky-100 ${st.cellBg}`}>
                            {variance !== null && analyzeCellButton({
                              rowKey,
                              label: rowLabel,
                              period: p,
                              raw: variance,
                              comparePeriod: item?.compare_period || compareHeader?.[p]?.comparePeriod,
                              suffix: pct ? ` (${pct.text})` : "",
                            })}
                            <div className="flex items-center justify-end gap-1">
                              {variance !== null ? (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${st.pill}`}>
                                  <span className="text-[10px]">{st.arrow}</span>
                                  {displayValue(variance)}
                                </span>
                              ) : <span className="text-sky-300 text-xs">—</span>}
                              {pct && (
                                <span className={["inline-flex items-center px-1.5 py-[2px] rounded-full text-[10px] font-semibold bg-white/70 border border-sky-100", pct.cls].join(" ")}>
                                  {pct.text}
                                </span>
                              )}
                            </div>
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* placeholder to keep the pattern intact — old quarterly table removed */}
        {!loading && rows.length > 0 && isComparisonOn && periodKeys.length === 0 && (
          <div className="h-[120px] flex items-center justify-center border rounded-xl mt-3">
            <p className="text-s text-sky-500">Enable "Period" toggle to view comparison columns</p>
          </div>
        )}

        {/* legacy guard — keeps old variables referenced so no lint errors */}
        {false && isQuarterlyView && isMonthlyView && (
          <React.Fragment>
            {/* Q_KEYS still used in CSV export */}
            {Q_KEYS.map(() => null)}
            {/* comparisonHeader / buildQuarterCompareMap still used in CSV export */}
            {buildQuarterCompareMap && comparisonHeader && null}
          </React.Fragment>
        )}

        {/* ── EMPTY STATE ── */}
        {!loading && rows.length === 0 && (
          <div className="h-[420px] flex items-center justify-center border rounded-xl">
            <p className="text-s text-sky-700">No data available for selected filters</p>
          </div>
        )}

        {/* ══════════════════════════════════════════
            KEY METRICS + AI INSIGHTS
        ══════════════════════════════════════════ */}
        {metrics && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-6 bg-white border border-sky-200 rounded-xl p-4 shadow-sm"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 space-y-3">
                <h3 className="text-s font-semibold text-sky-900">Key Revenue Metrics</h3>
                {[
                  ["total_revenue",   "Total Revenue"],
                  ["highest_revenue", "Highest Revenue"],
                  ["lowest_revenue",  "Lowest Revenue"],
                  ["average_revenue", "Average Revenue"],
                ].map(([key, label]) => (
                  <MetricRow
                    key={key}
                    label={label}
                    value={displayValue(metrics[key])}
                    onAnalyze={rows.length ? () => analyzeKpi(key, label, displayValue(metrics[key])) : undefined}
                  />
                ))}
              </div>
              <div className="bg-sky-50 md:col-span-2 border border-sky-200 rounded-lg p-3 flex flex-col justify-center gap-2">
                <h4 className="text-x font-semibold text-sky-900 mb-1">Executive Financial Insight</h4>
                {revenueExecutive.map((para, i) => (
                  <p key={i} className="text-s text-sky-800 leading-relaxed">{para}</p>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {!loading && rows.length > 0 && (
          <LineItemCommentary
            lineCommentary={lineCommentary}
            lines={rowIndex.lines}
            onRefine={(l) => openRefine(l.key, l.label)}
            title="Customer Commentary"
          />
        )}

        {!loading && <ReportCommentary commentary={commentary} />}

        <LineItemRefineWithAI
          line={refineLine}
          onClose={() => setRefineLine(null)}
          lineCommentary={lineCommentary}
          reportLabel="Revenue Report"
          filterLabels={insightFilterLabels}
          buildContext={buildLineItemContext}
          subtitle="explanation & recommendation"
        />

        <AnalyzeWithAI
          target={analyzeTarget}
          onClose={() => setAnalyzeTarget(null)}
          token={token}
          reportId="revenue"
          reportLabel="Revenue Report"
          year={year}
          currency={currency}
          filterLabels={insightFilterLabels}
          loadContext={loadAnalysisContext}
          onAddToReport={({ title, text }) =>
            commentary.addItems([{ title, text, category: "variance", source: "ai" }])
          }
        />

        {/* Hover help for the ✦ and commentary buttons in the tables & KPIs */}
        <AIHelpTooltip />

      </main>

      <RevenueProductDrilldownDrawer
        open={drillOpen}
        onClose={() => setDrillOpen(false)}
        token={token}
        year={year}
        currency={currency}
        API_BASE_URL={API_BASE_URL}
        filters={filters}
        customerName={drillCustomer}
      />
    </ReportsLayout>
  );
}
