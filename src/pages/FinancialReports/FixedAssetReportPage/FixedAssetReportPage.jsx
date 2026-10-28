// src/components/Reports/FixedAssets/FixedAssetReport.jsx

import React, { useContext, useEffect, useMemo, useState, useRef } from "react";
import { AuthContext } from "../../../context/AuthContext";
import { API_BASE_URL } from "../../../config/config";
import { cachedFetch } from "../../../utils/reportCache";

import ReportsLayout from "../ReportsLayout";
import TableSkeleton from "../../Skeleton/TableSkeleton";
import AddAutomation from "../AddAutomation";
import AIActionsMenu from "../AIActionsMenu";
import ActionHoverLabel from "../ActionHoverLabel";
import ReportCommentary from "../ReportCommentary";
import useReportCommentary from "../../../hooks/useReportCommentary";
import { buildReportAIContext, rankForAI, toNumberForAI } from "../reportAIContext";

import {
  FiFilter,
  FiPrinter,
  FiTrendingUp,
  FiTrendingDown,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import ExportMenu from "../ExportMenu";
import { collectCommentary, commentaryCount, csvWithCommentary, downloadCsv } from "../reportExport";
import { Link } from "react-router-dom";
import { FaArrowRightToBracket } from "react-icons/fa6";
import { getDecimalPrecision } from '../../../utils/formatters';

/* ================= FILTER CONSTANTS ================= */

const TIME_FILTERS = [
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

const COMPARISON_FILTERS = [
  { id: "", label: "No Comparison" },
  { id: "month_on_month", label: "Month vs Month" },
  { id: "year_on_year", label: "Year vs Year" },
];

const DEFAULT_FILTER_STATE = {
  period: "all",
  category: "",
  comparison: "",
  currency_filter: "actualvalue",
};

// Prefixes for the active filter tags when they're sent to Report AI.
const TAG_PREFIX = {
  period: "Period",
  category: "Category",
  comparison: "Comparison",
  currency_filter: "Values in",
};

const SORT_BY_OPTIONS = [
  { id: "category", label: "Category" },
  { id: "total_value", label: "Total Value" },
];

const SORT_ORDER_OPTIONS = [
  { id: "asc", label: "Ascending ↑" },
  { id: "desc", label: "Descending ↓" },
];

/* ================= HELPERS ================= */

const _faParseVal = (v) => {
  if (typeof v === "string") {
    const n = Number(v.replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return Number(v) || 0;
};

/* ── Report AI context helpers ── periods are "MM-YYYY" */
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const faMonthSortKey = (p) => {
  const [m, y] = String(p).split("-").map(Number);
  return (y || 0) * 100 + (m || 0);
};

// "01-2025" -> "Jan 2025"
const faMonthLabel = (p) => {
  const [m, y] = String(p).split("-").map(Number);
  return y && m >= 1 && m <= 12 ? `${MONTH_ABBR[m - 1]} ${y}` : String(p);
};

/* ── Analytical narrative builder ──
   Deep, data-driven analysis per category: total spend, share of overall
   capex, and whether purchases are concentrated in a few months (discrete
   buying decisions) or spread evenly (a routine capex cadence). */
const buildFixedAssetCategoryInsight = (cat, periods, grouped, rows, totalCapex) => {
  const catTotal = periods.reduce((sum, p) => sum + _faParseVal(grouped[cat]?.[p]?.value), 0);
  if (!catTotal) return "—";
  const catCount = rows.filter((r) => r.category === cat).length;
  const activeCount = periods.filter((p) => _faParseVal(grouped[cat]?.[p]?.value) !== 0).length;
  const pctOfTotal = totalCapex ? (catTotal / totalCapex) * 100 : 0;
  const concentrationClause = activeCount <= Math.ceil(periods.length * 0.4)
    ? `concentrated in just ${activeCount} of ${periods.length} months rather than spread evenly - discrete purchase decisions rather than a routine capex cadence`
    : `spread across ${activeCount} of ${periods.length} months - a fairly steady capex cadence rather than lumpy one-off buys`;

  return `${cat} spans ${catCount} asset${catCount !== 1 ? "s" : ""} and makes up ${pctOfTotal.toFixed(0)}% of total capex this period, ${concentrationClause}.`;
};

const FA_NOT_ENOUGH_DATA = ["Not enough asset activity in this selection to analyze capex timing - widen the filters for a deeper read."];

const buildFixedAssetExecutive = (categories, periods, grouped) => {
  if (!categories?.length || !periods?.length) return FA_NOT_ENOUGH_DATA;

  const catTotals = categories.map((cat) => ({
    cat,
    total: periods.reduce((sum, p) => sum + _faParseVal(grouped[cat]?.[p]?.value), 0),
    activeCount: periods.filter((p) => _faParseVal(grouped[cat]?.[p]?.value) !== 0).length,
  })).filter((c) => c.total > 0);
  if (!catTotals.length) return FA_NOT_ENOUGH_DATA;

  const totalCapex = catTotals.reduce((s, c) => s + c.total, 0);
  const sorted = [...catTotals].sort((a, b) => b.total - a.total);
  const top = sorted[0];
  const second = sorted[1];
  const lumpyCategories = catTotals.filter((c) => c.activeCount <= Math.ceil(periods.length * 0.4));

  const topSharePct = totalCapex ? (top.total / totalCapex) * 100 : 0;
  const dominanceClause = second && second.total
    ? ` - ${(top.total / second.total).toFixed(1)}x the next-largest category`
    : "";
  const para1 = catTotals.length > 1
    ? `${top.cat} leads capex spend this period at ${topSharePct.toFixed(0)}% of the total${dominanceClause}${topSharePct >= 50 ? `, outweighing the other ${catTotals.length - 1} categor${catTotals.length - 1 !== 1 ? "ies" : "y"} combined` : ""}.`
    : `${top.cat} is the only category with capex activity this period.`;
  const para2 = lumpyCategories.length
    ? `${lumpyCategories.length} of ${catTotals.length} categories show concentrated, lumpy buying (activity in ${periods.length <= 4 ? "just a couple" : "a handful"} of months) rather than steady spend - worth confirming those were planned purchases rather than deferred maintenance catching up all at once.`
    : `Spend is spread fairly evenly across months in every category - consistent with routine asset refresh rather than one-off buying sprees.`;

  return [para1, para2];
};

const formatMoney = (v) => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") {
    if (/[KMB]$/i.test(v.trim())) return `$${v}`;
    const cleaned = v.trim().replace(/[$,\s]/g, "");
    if (!cleaned || cleaned === "—" || cleaned === "-") return "—";
    if (/[a-zA-Z%]/.test(cleaned)) return v;
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed)) return v;
    v = parsed;
  }
  const num = Number(v);
  if (!Number.isFinite(num)) return "—";
  const dp = getDecimalPrecision();
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
};

const getVarianceUI = (value) => {
  const n = Number(value);
  if (Number.isNaN(n) || n === 0)
    return {
      icon: null,
      color: "text-sky-700",
      bg: "bg-sky-50",
      pill: "bg-slate-200 text-slate-800",
      arrow: "•",
    };
  if (n > 0)
    return {
      icon: <FiTrendingUp className="text-green-600" />,
      color: "text-green-700",
      bg: "bg-green-50",
      pill: "bg-green-600 text-white",
      arrow: "▲",
    };
  return {
    icon: <FiTrendingDown className="text-red-600" />,
    color: "text-red-700",
    bg: "bg-red-50",
    pill: "bg-red-600 text-white",
    arrow: "▼",
  };
};

/* ================= SUB-COMPONENTS ================= */

const SelectField = ({ label, value, options, onChange }) => (
  <div>
    <label className="block mb-1 text-sky-700 font-medium">{label}</label>
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-sky-200 rounded-lg p-2 bg-white text-sky-900 text-x focus:outline-none focus:ring-2 focus:ring-sky-400"
    >
      {options.map((o) => (
        <option key={o.id ?? o} value={o.id ?? o}>
          {o.label ?? o}
        </option>
      ))}
    </select>
  </div>
);

const HeaderDates = ({ top, bottom }) => (
  <div className="flex flex-col leading-tight items-end">
    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>{top}</span>
    <span style={{ fontSize: "12px", fontWeight: 600, color: "#ffffff" }}>{bottom}</span>
  </div>
);

const AIDriverText = ({ messages }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!messages?.length) return;
    const t = setInterval(
      () => setIndex((i) => (i + 1) % messages.length),
      3500
    );
    return () => clearInterval(t);
  }, [messages]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.4 }}
        className="text-s font-medium bg-gradient-to-r from-sky-500 to-purple-500 bg-clip-text text-transparent leading-relaxed"
      >
        {messages[index]}
      </motion.div>
    </AnimatePresence>
  );
};

const MetricRow = ({ label, value, isText = false }) => {
  const display = isText ? (value ?? "--") : formatMoney(value);
  const n = isText ? null : Number(value);
  const isNum = Number.isFinite(n);
  const color = isText
    ? "text-sky-900"
    : isNum && n > 0
      ? "text-green-600"
      : isNum && n < 0
        ? "text-red-600"
        : "text-sky-900";

  return (
    <div className="flex justify-between items-center text-s py-1 border-b border-sky-100 last:border-0">
      <span className="text-sky-600">{label}</span>
      <span className={`font-semibold ${color}`}>{display}</span>
    </div>
  );
};

/* ================= MAIN COMPONENT ================= */

export default function FixedAssetReport() {
  const { token, selectedYear: year, selectedCurrency } =
    useContext(AuthContext);

  const currency = selectedCurrency || "USD";

  /* ---- state ---- */
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [comparisonType, setComparisonType] = useState(null);
  const [keyMetrics, setKeyMetrics] = useState(null);
  const [loading, setLoading] = useState(false);

  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTER_STATE);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTER_STATE);

  const [open, setOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({ sort_by: "category", sort_order: "asc" });
  const ref = useRef(null);
  const sortRef = useRef(null);

  /* ================= FETCH ================= */

  const fetchData = async (applied) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (applied.period && applied.period !== "all")
        params.set("period", applied.period);
      if (applied.category) params.set("category", applied.category);
      if (applied.comparison) params.set("comparison", applied.comparison);
      if (applied.currency_filter && applied.currency_filter !== "actualvalue")
        params.set("currency_filter", applied.currency_filter);

      const url = `${API_BASE_URL}/api/v1/company/financial/fixed_asset/${year}/${currency}?${params}`;

      const json = await cachedFetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setRows(json.fixed_asset || []);
      setCategories(json.all_categories || []);
      setComparisonType(json.comparison_type || null);
      const metrics =
        json.key_metrics ||
        json.keymetrics ||
        json.keyMetrics ||
        null;

      setKeyMetrics(metrics);
    } catch (e) {
      console.error(e);
      setRows([]);
      setCategories([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!token || !year) return;
    fetchData(appliedFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, year, currency]);

  /* ================= CLOSE DROPDOWN ================= */

  useEffect(() => {
    const close = (e) =>
      ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    const close = (e) =>
      sortRef.current && !sortRef.current.contains(e.target) && setSortOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  /* ================= DERIVED ================= */

  const hasPendingChanges = useMemo(
    () => JSON.stringify(draftFilters) !== JSON.stringify(appliedFilters),
    [draftFilters, appliedFilters]
  );

  const hasComparison = !!comparisonType;

  const periods = useMemo(
    () => [...new Set(rows.map((r) => r.period))].sort(),
    [rows]
  );

  const realPeriods = useMemo(
    () => periods.filter((p) => String(p).toLowerCase() !== "total"),
    [periods]
  );

  const grouped = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      if (!map[r.category]) map[r.category] = {};
      map[r.category][r.period] = r;
    });
    return map;
  }, [rows]);

  const fixedAssetExecutive = useMemo(
    () => buildFixedAssetExecutive(categories, realPeriods, grouped),
    [categories, realPeriods, grouped]
  );

  const sortedCategories = useMemo(() => {
    if (!categories.length) return categories;
    const { sort_by, sort_order } = sortConfig;
    return [...categories].sort((a, b) => {
      let av, bv;
      if (sort_by === "category") {
        av = a || "";
        bv = b || "";
      } else {
        av = periods.reduce((sum, p) => sum + (Number(grouped[a]?.[p]?.value) || 0), 0);
        bv = periods.reduce((sum, p) => sum + (Number(grouped[b]?.[p]?.value) || 0), 0);
      }
      if (av < bv) return sort_order === "asc" ? -1 : 1;
      if (av > bv) return sort_order === "asc" ? 1 : -1;
      return 0;
    });
  }, [categories, sortConfig, periods, grouped]);

  /* ================= ACTIVE TAGS ================= */

  const activeTags = useMemo(() => {
    const tags = [];

    if (appliedFilters.period && appliedFilters.period !== "all")
      tags.push({
        key: "period",
        label: TIME_FILTERS.find((t) => t.id === appliedFilters.period)?.label,
      });

    if (appliedFilters.category)
      tags.push({ key: "category", label: appliedFilters.category });

    if (appliedFilters.comparison)
      tags.push({
        key: "comparison",
        label: COMPARISON_FILTERS.find(
          (c) => c.id === appliedFilters.comparison
        )?.label,
      });

    if (
      appliedFilters.currency_filter &&
      appliedFilters.currency_filter !== "actualvalue"
    )
      tags.push({
        key: "currency_filter",
        label: CURRENCY_FILTERS.find(
          (c) => c.id === appliedFilters.currency_filter
        )?.label,
      });

    return tags.filter((t) => t.label);
  }, [appliedFilters]);

  const removeTag = (tag) => {
    const next = { ...appliedFilters };
    if (tag.key === "period") next.period = "all";
    else if (tag.key === "currency_filter") next.currency_filter = "actualvalue";
    else if (tag.key === "comparison") next.comparison = "";
    else next[tag.key] = "";
    setAppliedFilters(next);
    setDraftFilters(next);
    fetchData(next);
  };

  /* ================= APPLY / RESET ================= */

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    fetchData(draftFilters);
    setOpen(false);
  };

  const resetAll = () => {
    setDraftFilters(DEFAULT_FILTER_STATE);
    setAppliedFilters(DEFAULT_FILTER_STATE);
    fetchData(DEFAULT_FILTER_STATE);
    setOpen(false);
  };

  /* ================= CSV ================= */

  const csvData = useMemo(() => {
    if (!rows.length) return [];

    if (!hasComparison) {
      const header = ["Category", ...periods];
      const body = sortedCategories.map((c) => [
        c,
        ...periods.map((p) => grouped[c]?.[p]?.value ?? ""),
      ]);
      return [header, ...body];
    }

    const header = [
      "Category",
      ...periods.flatMap((p) => [`${p} Current`, `${p} Previous`, `${p} Variance`]),
    ];
    const body = sortedCategories.map((c) => [
      c,
      ...periods.flatMap((p) => {
        const comp = grouped[c]?.[p]?.comparison;
        return [comp?.current_value ?? "", comp?.compare_value ?? "", comp?.change_value ?? ""];
      }),
    ]);
    return [header, ...body];
  }, [rows, periods, sortedCategories, grouped, hasComparison]);

  // Same param names fetchData sends, so a scheduled send reproduces this
  // exact filtered view.
  const scheduleFilters = useMemo(() => ({
    ...(appliedFilters.period && appliedFilters.period !== "all" && { period: appliedFilters.period }),
    ...(appliedFilters.category && { category: appliedFilters.category }),
    ...(appliedFilters.comparison && { comparison: appliedFilters.comparison }),
    ...(appliedFilters.currency_filter && appliedFilters.currency_filter !== "actualvalue" && { currency_filter: appliedFilters.currency_filter }),
  }), [appliedFilters]);

  /* ================= REPORT AI / COMMENTARY ================= */

  const commentary = useReportCommentary({
    token,
    reportId: "fixed_asset",
    year,
    currency,
    filters: appliedFilters,
  });

  const insightFilterLabels = useMemo(
    () => activeTags.map((t) => `${TAG_PREFIX[t.key]}: ${t.label}`),
    [activeTags]
  );

  const viewKey = `${year}|${currency}|${JSON.stringify(appliedFilters)}`;

  const buildInsightsContext = () => {
    if (!rows.length) return "";
    // The table sorts "MM-YYYY" periods as text; order them by date here.
    const months = [...realPeriods].sort((a, b) => faMonthSortKey(a) - faMonthSortKey(b));

    // `grouped` only has categories with data (`categories` ignores the category filter).
    const categoryRows = Object.entries(grouped)
      .map(([category, byPeriod]) => {
        const values = {};
        let sum = 0;
        months.forEach((p) => {
          const r = byPeriod[p];
          const v = toNumberForAI(r?.value);
          if (v === null) return;
          sum += v;
          values[faMonthLabel(p)] = hasComparison
            ? {
                current: v,
                previous: toNumberForAI(r.comparison?.compare_value),
                change: toNumberForAI(r.comparison?.change_value),
              }
            : v;
        });
        return { category, total: toNumberForAI(byPeriod.total?.value) ?? sum, months: values };
      })
      // Largest categories first — rows are trimmed from the end if the context is too long.
      .sort((a, b) => b.total - a.total);

    const monthRank = rankForAI(
      months.map((p) => ({
        month: faMonthLabel(p),
        value: Object.values(grouped).reduce((s, byPeriod) => s + (toNumberForAI(byPeriod[p]?.value) ?? 0), 0),
      })),
      (m) => m.value,
      (m) => m.month
    );
    const changes = hasComparison
      ? Object.entries(grouped).flatMap(([category, byPeriod]) =>
          months
            .map((p) => ({ name: `${category}, ${faMonthLabel(p)}`, change: toNumberForAI(byPeriod[p]?.comparison?.change_value) }))
            .filter((x) => x.change !== null)
        )
      : [];

    return buildReportAIContext({
      valueScale: CURRENCY_FILTERS.find((c) => c.id === appliedFilters.currency_filter)?.label || "Actual",
      notes: [
        "Values are fixed-asset additions (capital expenditure) by category and month; a category's 'total' is its sum for the period shown, and a month missing from a category had no additions.",
        "Total Asset Cost is gross cost; Current Asset Value is net book value after straight-line depreciation.",
        hasComparison &&
          `'previous' is the same category's additions ${
            comparisonType === "year_on_year" ? "in the same month one year earlier" : "in the month before"
          }, and is left out when that month has no data.`,
      ]
        .filter(Boolean)
        .join(" "),
      keyMetrics: keyMetrics && {
        "Total Asset Cost": toNumberForAI(keyMetrics.total_asset_cost ?? keyMetrics["Total Asset Cost"]),
        "Current Asset Value": toNumberForAI(keyMetrics.current_asset_value ?? keyMetrics["Current Asset Value"]),
      },
      facts: {
        months_covered:
          months.length > 1
            ? `${faMonthLabel(months[0])} to ${faMonthLabel(months[months.length - 1])}`
            : months[0] && faMonthLabel(months[0]),
        categories_ranked_by_total: rankForAI(categoryRows, (c) => c.total, (c) => c.category, categoryRows.length)?.highest,
        months_with_most_additions: monthRank?.highest,
        months_with_least_additions: monthRank?.lowest,
        biggest_increases_vs_comparison: rankForAI(changes.filter((x) => x.change > 0), (x) => x.change, (x) => x.name)?.highest,
        biggest_decreases_vs_comparison: rankForAI(changes.filter((x) => x.change < 0), (x) => x.change, (x) => x.name)?.lowest,
      },
      rows: categoryRows,
    });
  };

  /* ================= AI INSIGHTS ================= */

  const aiMessages = keyMetrics?.aiDriver?.length
    ? keyMetrics.aiDriver
    : [
      "📊 Fixed asset data loaded — review category trends below",
      "💡 Use comparison filters to identify period-over-period changes",
      "🔍 Filter by category to drill into specific asset classes",
    ];

  // The commentary shown under the report, offered with the CSV download.
  const exportCommentary = collectCommentary({ reportItems: commentary.items });

  /* ================= UI ================= */

  return (
    <ReportsLayout>
      <main className="flex-1 min-w-0 bg-white p-3 rounded-xl shadow-md">

        {/* ── HEADER ── */}



        <div className="flex justify-between items-center gap-3 mb-2">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-lg font-semibold text-sky-900">Fixed Asset Report</h2>
            <p className="text-s text-sky-500">Fixed asset analysis by category &amp; period</p>
          </div>
          <Link
            to="/fixed-assets-dashboard"
            className="flex shrink-0 items-center whitespace-nowrap py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg hover:bg-white hover:text-sky-900 transition border border-sky-900"
          >
            View More <FaArrowRightToBracket className="ml-1" />
          </Link>
        </div>

















        {/* ── TAGS + ACTIONS ── */}
        <div
          className="mb-3 flex items-start justify-between gap-3 flex-wrap"
          ref={ref}
        >
          {/* Active Filter Tags */}
          <div className="flex flex-wrap gap-2 min-h-[34px]">
            {activeTags.length === 0 ? (
              <span className="text-x text-sky-400 italic">No filters applied</span>
            ) : (
              activeTags.map((t) => (
                <span
                  key={`${t.key}-${t.label}`}
                  className="flex items-center gap-2 px-3 py-1 text-x rounded-full bg-sky-800 text-white"
                >
                  {t.label}
                  <button
                    onClick={() => removeTag(t)}
                    className="text-sky-200 hover:text-white font-bold"
                    title="Remove"
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">

            {/* FILTER BUTTON + DROPDOWN */}
            <div className="relative">
              <button
                onClick={() => setOpen(!open)}
                aria-label="Filters"
                className="relative group flex items-center gap-1 px-3 py-2.5 text-x font-medium rounded-lg border transition bg-sky-100 border-sky-200 text-sky-800 hover:bg-sky-200"
              >
                <FiFilter size={14} />
                <ActionHoverLabel>Filters</ActionHoverLabel>
                {hasPendingChanges && (
                  <span className="ml-1 px-2 py-[2px] rounded-full bg-amber-200 text-amber-900 text-[10px] font-bold">
                    Pending
                  </span>
                )}
              </button>

              <AnimatePresence>
                {open && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute right-0 mt-2 w-[380px] bg-sky-50 border border-sky-200 rounded-xl shadow-lg z-50"
                  >
                    <div className="p-4 grid grid-cols-2 gap-3 text-x">

                      {/* Period */}
                      <SelectField
                        label="Period"
                        value={draftFilters.period}
                        options={TIME_FILTERS}
                        onChange={(v) =>
                          setDraftFilters((f) => ({ ...f, period: v }))
                        }
                      />

                      {/* Currency Unit */}
                      <SelectField
                        label="Currency Unit"
                        value={draftFilters.currency_filter}
                        options={CURRENCY_FILTERS}
                        onChange={(v) =>
                          setDraftFilters((f) => ({
                            ...f,
                            currency_filter: v,
                          }))
                        }
                      />

                      {/* Comparison */}
                      <SelectField
                        label="Comparison"
                        value={draftFilters.comparison}
                        options={COMPARISON_FILTERS}
                        onChange={(v) =>
                          setDraftFilters((f) => ({ ...f, comparison: v }))
                        }
                      />

                      {/* Category */}
                      <SelectField
                        label="Category"
                        value={draftFilters.category}
                        options={[
                          { id: "", label: "All Categories" },
                          ...categories.map((c) => ({ id: c, label: c })),
                        ]}
                        onChange={(v) =>
                          setDraftFilters((f) => ({ ...f, category: v }))
                        }
                      />
                    </div>

                    <div className="p-3 border-t border-sky-200 flex gap-2">
                      <button
                        onClick={resetAll}
                        className="w-1/2 py-2 text-x bg-sky-200 text-sky-900 rounded-lg hover:bg-sky-300"
                      >
                        Reset All
                      </button>
                      <button
                        onClick={applyFilters}
                        disabled={!hasPendingChanges}
                        className={[
                          "w-1/2 py-2 text-x rounded-lg font-semibold",
                          hasPendingChanges
                            ? "bg-sky-900 text-white hover:bg-sky-800"
                            : "bg-sky-200 text-sky-600 cursor-not-allowed",
                        ].join(" ")}
                      >
                        Apply
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* CSV */}
            <ExportMenu
              label="CSV"
              commentaryCount={commentaryCount(exportCommentary)}
              onExport={(include) =>
                downloadCsv(csvWithCommentary(csvData, exportCommentary, include), `FixedAsset_${year}_${currency}.csv`)
              }
              className="relative group flex items-center px-3 py-2.5 text-x bg-sky-100 text-sky-800 rounded-lg border border-sky-200 hover:bg-sky-200"
            />

            <AddAutomation
              reportType="fixed_asset_report"
              reportLabel="Fixed Asset Report"
              year={year}
              currency={currency}
              filters={scheduleFilters}
              iconOnly
            />

            {/* PRINT */}
            <button
              onClick={() => window.print()}
              aria-label="Print"
              className="relative group flex items-center px-3 py-2.5 text-x bg-sky-100 text-sky-800 rounded-lg border border-sky-200 hover:bg-sky-200"
            >
              <FiPrinter />
              <ActionHoverLabel>Print</ActionHoverLabel>
            </button>

            <div className="relative" ref={sortRef}>
              <button
                onClick={() => setSortOpen((v) => !v)}
                aria-label="Sort"
                className={`relative group flex items-center gap-1 px-3 py-2.5 text-x rounded-lg border transition ${
                  sortOpen
                    ? "bg-sky-900 text-white border-sky-900"
                    : "bg-sky-100 text-sky-800 border-sky-200 hover:bg-sky-200"
                }`}
              >
                <FiFilter size={13} />
                <ActionHoverLabel>Sort</ActionHoverLabel>
                {(sortConfig.sort_by !== "category" || sortConfig.sort_order !== "asc") && (
                  <span className="ml-1 text-xs font-bold">
                    {sortConfig.sort_order === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {sortOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-64 z-50 bg-sky-50 border border-sky-200 rounded-xl shadow-xl"
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
                        onClick={() => setSortConfig({ sort_by: "category", sort_order: "asc" })}
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
              reportId="fixed_asset"
              insights={{
                commentary,
                reportLabel: "Fixed Asset Report",
                filterLabels: insightFilterLabels,
                viewKey,
                buildContext: buildInsightsContext,
                disabled: loading || !rows.length,
              }}
            />
          </div>
        </div>

        {/* ── LOADING ── */}
        {loading && <TableSkeleton />}

        {/* ── NORMAL TABLE (no comparison) ── */}
        {!loading && rows.length > 0 && !hasComparison && (
          <div className="report-table-scroll overflow-auto mt-2 max-h-[440px] border border-sky-200 rounded-lg bg-white">
            <table className="min-w-[1100px] w-full text-x">
              <thead className="bg-sky-900 text-white sticky top-0 z-20">
                <tr>
                  <th className="px-3 py-3 text-left whitespace-nowrap sticky left-0 z-30 bg-sky-900 font-semibold">
                    CATEGORY
                  </th>
                  {periods.map((p) => (
                    <th
                      key={p}
                      className="px-3 py-3 text-right whitespace-nowrap font-semibold"
                    >
                      {p}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-left whitespace-nowrap font-semibold">
                    Insights
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedCategories.map((cat) => {
                  const totalCapex = sortedCategories.reduce(
                    (s, c) => s + realPeriods.reduce((s2, p) => s2 + _faParseVal(grouped[c]?.[p]?.value), 0),
                    0
                  );
                  return (
                    <tr key={cat} className="border-b border-sky-50 hover:bg-sky-50 transition-colors">
                      <td className="px-3 py-3 font-semibold text-sky-900 whitespace-nowrap bg-sky-50 sticky left-0 z-10">
                        {cat}
                      </td>
                      {periods.map((p) => {
                        const row = grouped[cat]?.[p];
                        return (
                          <td
                            key={p}
                            className="px-3 py-3 whitespace-nowrap text-right text-sky-900"
                          >
                            {formatMoney(row?.value)}
                          </td>
                        );
                      })}
                      <td className="px-3 py-3 whitespace-nowrap min-w-[420px] text-sky-700">
                        {buildFixedAssetCategoryInsight(cat, realPeriods, grouped, rows, totalCapex)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── COMPARISON TABLE ── */}
        {!loading && rows.length > 0 && hasComparison && (
          <div className="report-table-scroll overflow-auto mt-2 h-[420px] border border-sky-200 rounded-lg bg-white">
            <table className="min-w-[1200px] w-full text-x">
              <thead className="z-20">
                <tr className="bg-sky-900 text-white">
                  <th
                    rowSpan={2}
                    className="px-3 py-3 text-left whitespace-nowrap sticky left-0 z-30 bg-sky-900"
                  >
                    CATEGORY
                  </th>
                  {periods.map((p) => {
                    const comp = rows.find((r) => r.period === p)?.comparison;
                    return (
                      <th
                        key={p}
                        colSpan={3}
                        className="px-3 py-3 text-center border-l border-white/20 whitespace-nowrap"
                      >
                        {comp?.current_period || p} VS{" "}
                        {comp?.compare_period || "—"}
                      </th>
                    );
                  })}
                </tr>

                <tr className="bg-sky-800 text-white">
                  {periods.map((p, idx) => {
                    const comp = rows.find((r) => r.period === p)?.comparison;
                    return (
                      <React.Fragment key={`${p}-${idx}-sub`}>
                        <th className="px-3 py-2 text-right border-l border-white/20 whitespace-nowrap">
                          <HeaderDates
                            top={comp?.current_period || "Current"}
                            bottom="Current"
                          />
                        </th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">
                          <HeaderDates
                            top={comp?.compare_period || "Previous"}
                            bottom="Previous"
                          />
                        </th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">
                          <HeaderDates top="Difference" bottom="Variance" />
                        </th>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {sortedCategories.map((cat) => (
                  <tr key={cat} className="border-b hover:bg-sky-50 transition-colors">
                    <td className="px-3 py-3 font-semibold text-sky-900 whitespace-nowrap bg-sky-50 sticky left-0 z-10">
                      {cat}
                    </td>
                    {periods.map((p, i) => {
                      const comp = grouped[cat]?.[p]?.comparison;
                      const ui = getVarianceUI(comp?.change_value);

                      return (
                        <React.Fragment key={`${p}-${cat}-${i}`}>
                          <td className="px-3 py-3 whitespace-nowrap border-l border-sky-100 text-right text-sky-900">
                            {formatMoney(comp?.current_value)}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-right text-sky-900">
                            {formatMoney(comp?.compare_value)}
                          </td>
                          <td className={`px-3 py-3 whitespace-nowrap text-right ${ui.bg}`}>
                            <span
                              className={`inline-flex items-center justify-end gap-1 px-3 py-1 rounded-md font-semibold ${ui.color}`}
                            >
                              <span
                                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full  text-[11p] font-semibold ${ui.pill}`}
                              >
                                <span className="text-[10px]">{ui.arrow}</span>
                                {formatMoney(comp?.change_value)}
                              </span>
                            </span>
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── NO DATA ── */}
        {!loading && rows.length === 0 && (
          <div className="h-[420px] flex items-center justify-center border rounded-xl bg-sky-50">
            <p className="text-s text-sky-700">
              No data available for selected filters
            </p>
          </div>
        )}

        {/* ── KEY METRICS + AI INSIGHTS ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-6 bg-white border border-sky-200 rounded-xl p-4 shadow-sm"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

            {/* Left: Key Metrics */}
            <div className="md:col-span-2 space-y-3">
              <h3 className="text-s font-semibold text-sky-900">
                Key Fixed Asset Metrics
              </h3>
              <MetricRow
                label="Total Asset Cost"
                value={
                  keyMetrics?.total_asset_cost ??
                  keyMetrics?.["Total Asset Cost"] ??
                  null
                }
              />

              <MetricRow
                label="Current Asset Value"
                value={
                  keyMetrics?.current_asset_value ??
                  keyMetrics?.["Current Asset Value"] ??
                  null
                }
              />

            </div>

            {/* Right: AI Insights */}
            <div className="bg-sky-50 md:col-span-2 border border-sky-200 rounded-lg p-3 flex flex-col justify-center gap-2">
              <h4 className="text-x font-semibold text-sky-900 mb-1">
                Executive Financial Insight
              </h4>
              {fixedAssetExecutive.map((para, i) => (
                <p key={i} className="text-s text-sky-800 leading-relaxed">{para}</p>
              ))}
            </div>
          </div>
        </motion.div>

        {!loading && <ReportCommentary commentary={commentary} />}

      </main>
    </ReportsLayout>
  );
}
