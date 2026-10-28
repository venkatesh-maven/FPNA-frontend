import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AuthContext } from "../../../context/AuthContext";
import { API_BASE_URL } from "../../../config/config";
import { cachedFetch } from "../../../utils/reportCache";
import ReportsLayout from "../ReportsLayout";
import AddAutomation from "../AddAutomation";
import AIActionsMenu from "../AIActionsMenu";
import ExportMenu from "../ExportMenu";
import { collectCommentary, commentaryCount, xlsxWithCommentary } from "../reportExport";
import ActionHoverLabel from "../ActionHoverLabel";
import ReportCommentary from "../ReportCommentary";
import { buildReportAIContext, rankForAI, toNumberForAI } from "../reportAIContext";
import useReportCommentary from "../../../hooks/useReportCommentary";
import TableSkeleton from "../../Skeleton/TableSkeleton";

import { FiFilter, FiTrendingUp, FiTrendingDown, FiPrinter } from "react-icons/fi";
import { CSVLink } from "react-csv";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { FaArrowRightToBracket } from "react-icons/fa6";
import { getDecimalPrecision } from '../../../utils/formatters';

/* ══════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════ */

const PERIODS = [
  { id: "all",             label: "All Periods"     },
  { id: "current_month",   label: "Current Month"   },
  { id: "last_month",      label: "Last Month"      },
  { id: "quarter_to_date", label: "Quarter to Date" },
  { id: "year_to_date",    label: "Year to Date"    },
  { id: "custom_range",    label: "Custom Range"    },
];

const CURRENCY_FILTERS = [
  { id: "actualvalue", label: "Actual Value" },
  { id: "thousands",   label: "Thousands"    },
  { id: "millions",    label: "Millions"     },
];

const COMPARISON_FILTERS = [
  { id: "none",           label: "No Comparison"  },
  { id: "month_on_month", label: "Month on Month" },
  { id: "year_on_year",   label: "Year on Year"   },
];

/* Updated: objects with id+label (was plain strings) */
const STATUS_FILTERS = [
  { id: "all",    label: "All Projects" },
  { id: "active", label: "Active"       },
  { id: "closed", label: "Closed"       },
];

const SORT_BY_OPTIONS = [
  { id: "period",                label: "Period"        },
  { id: "entity_name",           label: "Entity"        },
  { id: "region",                label: "Region"        },
  { id: "department_name",       label: "Department"    },
  { id: "cost_center_id",        label: "Cost Center"   },
  { id: "project_name",          label: "Project Name"  },
  { id: "product_name",          label: "Product Name"  },
  { id: "actual",                label: "Actual"        },
  { id: "budget",                label: "Budget"        },
  { id: "variance",              label: "Variance"      },
  { id: "completion_percentage", label: "Completion %"  },
];

const SORT_ORDER_OPTIONS = [
  { id: "asc",  label: "Ascending ↑"  },
  { id: "desc", label: "Descending ↓" },
];

const DEFAULT_FILTERS = {
  period:               "all",
  entity_name:          "All",
  department_name:      "All",
  product_name:         "All",
  project_name:         "All",
  status:               "all",
  region:               "All",
  currency_filter:      "actualvalue",
  comparison:           "none",
  sort_by:              "actual",
  sort_order:           "desc",
  page:                 1,
  page_size:            1000,
  date_from:            "",
  date_to:              "",
  show_entity_name:     false,
  show_region:          false,
  show_department_name: false,
  show_cost_center_id:  false,
  show_product_name:    false,
  show_customer_name:   false,
};

const OPTIONAL_COLUMNS = [
  { flag: "show_entity_name",     key: "entity_name",     label: "Entity",      csv: "Entity"      },
  { flag: "show_region",          key: "region",          label: "Region",      csv: "Region"      },
  { flag: "show_department_name", key: "department_name", label: "Dept",        csv: "Department"  },
  { flag: "show_cost_center_id",  key: "cost_center_id",  label: "Cost Center", csv: "Cost Center" },
  { flag: "show_product_name",    key: "product_name",    label: "Product",     csv: "Product"     },
  { flag: "show_customer_name",   key: "customer_name",   label: "Customer",    csv: "Customer"    },
];

const BASE_MEASURE_COLUMNS = [
  { key: "actual",                label: "Actual",     csv: "Actual"       },
  { key: "budget",                label: "Budget",     csv: "Budget"       },
  { key: "variance",              label: "Variance",   csv: "Variance"     },
  { key: "completion_percentage", label: "Completion", csv: "Completion %" },
];

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */

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
    const dp = getDecimalPrecision();
    return v.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }
  return String(v);
};

/** Compact currency for KPI cards — matches HTML reference formatting */
/* ── Analytical narrative builder ──
   Deep, data-driven analysis per project: compares % of budget spent
   against % complete to flag pacing mismatches - a project can look
   "under budget" in raw dollars while actually burning cash faster than
   it's delivering work, and vice versa. Everything is computed from the
   real numbers, nothing here is a fixed template string. */
const _pcNum = (v) => {
  if (typeof v === "string") {
    const n = Number(v.replace(/[$,%\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return Number(v) || 0;
};

const buildProjectPacingInsight = (row) => {
  const actual = _pcNum(row?.actual);
  const budget = _pcNum(row?.budget);
  const completion = row?.completion_percentage === null || row?.completion_percentage === undefined
    ? null : _pcNum(row.completion_percentage);

  if (!actual && !budget) return "—";
  if (!budget || completion === null) {
    return budget
      ? `${row.project_name} has no completion percentage on file, so its spending pace can't be judged against delivered progress.`
      : `${row.project_name} has no budget on file to measure spending pace against.`;
  }

  const spentPct = (actual / budget) * 100;
  const gap = spentPct - completion;

  if (Math.abs(gap) <= 10) {
    return Math.abs(gap) < 0.5
      ? `${row.project_name} is pacing almost exactly on target - spend and delivered progress are moving in lockstep.`
      : `${row.project_name} is pacing well - spend and delivered progress are tracking within ${Math.abs(gap).toFixed(0)} points of each other, so cost isn't running meaningfully ahead of or behind the work.`;
  }
  if (gap > 10) {
    return `${row.project_name} has consumed ${gap.toFixed(0)} points more of its budget than the delivered work would justify - cost is outpacing progress. If the remaining scope costs proportionally the same, this project is on track to overrun budget.`;
  }
  return `${row.project_name} has consumed ${Math.abs(gap).toFixed(0)} points less of its budget than the delivered work would suggest - cost is lagging behind progress. That could mean efficient execution, or that costs haven't yet caught up with delivered work and an increase is still coming.`;
};

const PC_NOT_ENOUGH_DATA = ["Not enough projects in this selection to analyze portfolio pacing - widen the filters for a deeper read."];

const buildProjectPortfolioExecutive = (allRows) => {
  const real = (allRows || []).filter((r) => r?.project_name && _pcNum(r.budget) > 0 && r.completion_percentage !== null && r.completion_percentage !== undefined);
  if (!real.length) return PC_NOT_ENOUGH_DATA;

  let overBudgetPaceCount = 0, overBudgetAtRisk = 0;
  let underPaceCount = 0;
  const n = real.length;

  for (const r of real) {
    const actual = _pcNum(r.actual);
    const budget = _pcNum(r.budget);
    const completion = _pcNum(r.completion_percentage);
    const spentPct = (actual / budget) * 100;
    const gap = spentPct - completion;
    if (gap > 10) { overBudgetPaceCount++; overBudgetAtRisk += budget; }
    else if (gap < -10) underPaceCount++;
  }

  const para1 = overBudgetPaceCount > 0
    ? `Across ${n} projects with active budgets, ${overBudgetPaceCount} ${overBudgetPaceCount === 1 ? "is" : "are"} pacing ahead of their completion - spending faster than they're delivering work - representing ${fmtKpi(overBudgetAtRisk)} in combined budget at risk of overrun if that pace continues.`
    : `Across ${n} projects with active budgets, none are spending faster than they're delivering work - so there's no near-term overrun risk from pacing alone.`;
  const para2 = overBudgetPaceCount > 0
    ? `The priority is reviewing those ${overBudgetPaceCount === 1 ? "project's" : "projects'"} remaining scope against remaining budget before committing further spend${underPaceCount > 0 ? `; separately, ${underPaceCount} project${underPaceCount !== 1 ? "s are" : " is"} underspending relative to progress, which is usually healthy but worth a quick check that work isn't being under-invoiced or under-tracked.` : "."}`
    : underPaceCount > 0
    ? `${underPaceCount} project${underPaceCount !== 1 ? "s are" : " is"} underspending relative to delivered progress - usually a healthy sign, but worth a quick check that work isn't being under-invoiced or under-tracked rather than genuinely running efficient.`
    : `Budget consumption is tracking closely with delivered progress across the whole portfolio - no project shows a meaningful pacing gap right now.`;

  return [para1, para2];
};

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

const appendProjectCostingParams = (params, filters) => {
  params.append("currency_filter", filters.currency_filter);
  params.append("period",          filters.period);
  params.append("status",          filters.status);
  params.append("sort_by",         filters.sort_by    || "period");
  params.append("sort_order",      filters.sort_order || "asc");
  params.append("page",            filters.page       || 1);
  params.append("page_size",       filters.page_size  || 1000);

  params.append("show_period", "true"); // always fetch months data for period pivot
  OPTIONAL_COLUMNS.forEach(({ flag }) => {
    params.append(flag, String(Boolean(filters[flag])));
  });

  if (filters.comparison      !== "none") params.append("comparison",      filters.comparison);
  if (filters.entity_name     !== "All")  params.append("entity_name",     filters.entity_name);
  if (filters.department_name !== "All")  params.append("department_name", filters.department_name);
  if (filters.product_name    !== "All")  params.append("product_name",    filters.product_name);
  if (filters.project_name    !== "All")  params.append("project_name",    filters.project_name);
  if (filters.region          !== "All")  params.append("region",          filters.region);
  if (filters.date_from) params.append("date_from", filters.date_from);
  if (filters.date_to)   params.append("date_to",   filters.date_to);
};

/* ══════════════════════════════════════════
   SUB-COMPONENTS
══════════════════════════════════════════ */

const VariancePill = ({ value }) => {
  const n = typeof value === "number" ? value : parseFloat(value);
  if (isNaN(n) || n === 0)
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-x font-semibold bg-slate-100 text-slate-500 whitespace-nowrap">
        • 0
      </span>
    );
  if (n > 0)
    return (
      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-x font-semibold bg-emerald-50 text-emerald-600 whitespace-nowrap">
        <FiTrendingUp size={11} />+{fmt(n)}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-x font-semibold bg-red-50 text-red-500 whitespace-nowrap">
      <FiTrendingDown size={11} />{fmt(n)}
    </span>
  );
};

const CompletionBar = ({ value }) => {
  const pct   = Math.min(100, Math.max(0, Number(value) || 0));
  /* Color logic from HTML reference: >100% red, ≥90% amber, else green */
  const raw   = Number(value) || 0;
  const color = raw > 100 ? "bg-red-400" : raw >= 90 ? "bg-amber-400" : pct >= 50 ? "bg-emerald-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 bg-sky-100 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-medium text-sky-700 w-10 text-right whitespace-nowrap">
        {raw.toFixed(getDecimalPrecision())}%
      </span>
    </div>
  );
};

/* Updated labels — match HTML reference "✓ On Budget" / "⚠ Over Budget" */
const StatusBadge = ({ variance }) => {
  const overBudget = Number(variance) < 0;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
      overBudget ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"
    }`}>
      {overBudget ? "⚠ Over Budget" : "✓ On Budget"}
    </span>
  );
};

/**
 * KPI Card — new addition from HTML reference.
 * Renders compact metric tiles above the filter bar.
 */
const KpiCard = ({ icon, label, value, sub, variant = "default" }) => {
  const valueColor = {
    default:  "text-sky-900",
    positive: "text-emerald-600",
    negative: "text-red-600",
    warning:  "text-amber-500",
  }[variant] ?? "text-sky-900";

  return (
    <div className="bg-white rounded-xl border border-sky-100 shadow-sm px-4 py-3 flex-1 min-w-[140px]">
      <p className="text-[10px] font-bold  uppercase tracking-wide text-sky-500 mb-1">
        {icon} {label}
      </p>
      <p className={`text-2xl  leading-none ${valueColor}`}>{value}</p>
      {sub && <p className="text-[11px] text-sky-400 mt-1">{sub}</p>}
    </div>
  );
};

const SelectField = ({ label, value, options, onChange }) => (
  <div>
    <label className="block mb-1 text-sky-700 font-medium text-x">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-sky-200 rounded-lg p-2 bg-white text-sky-900 text-x focus:outline-none focus:ring-2 focus:ring-sky-400"
    >
      {options.map((o) => (
        <option key={typeof o === "object" ? o.id : o} value={typeof o === "object" ? o.id : o}>
          {typeof o === "object" ? o.label : o}
        </option>
      ))}
    </select>
  </div>
);

const AIDriverText = ({ messages }) => {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!messages?.length) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % messages.length), 3000);
    return () => clearInterval(t);
  }, [messages]);
  if (!messages?.length) return null;
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

const MetricRow = ({ label, value }) => {
  const n = typeof value === "number" ? value : parseFloat(value);
  const color = isNaN(n) ? "text-sky-900" : n > 0 ? "text-green-600" : n < 0 ? "text-red-600" : "text-sky-900";
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-sky-100 last:border-0 text-s">
      <span className="text-sky-600">{label}</span>
      <span className={`font-semibold ${color}`}>{fmt(value)}</span>
    </div>
  );
};

const generateInsights = (rows, metrics) => {
  const msgs = [];
  if (!rows?.length || !metrics) return msgs;
  const tv = Number(metrics.total_variance);
  if (!isNaN(tv)) {
    msgs.push(
      tv >= 0
        ? `✅ Projects are within budget — positive variance of ${fmt(tv)}.`
        : `⚠️ Budget overrun detected — costs exceeded by ${fmt(Math.abs(tv))}.`
    );
  }
  const low = rows.filter((r) => Number(r.completion_percentage) < 60).length;
  if (low > 0) msgs.push(`⚠️ ${low} project(s) have completion below 60% — review progress.`);
  const top = [...rows].sort((a, b) => Number(b.actual || 0) - Number(a.actual || 0))[0];
  if (top) msgs.push(`📊 Highest cost: "${top.project_name}" at ${fmt(top.actual)}.`);
  msgs.push("💡 Filter by Department or Entity to isolate cost drivers.");
  return msgs;
};

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */

export default function ProjectCostingReport() {
  const { token, selectedYear: year, selectedCurrency } = useContext(AuthContext);

  const [rows,           setRows]           = useState([]);
  const [metrics,        setMetrics]        = useState(null);
  const [grandTotal,     setGrandTotal]     = useState(null);
  const [apiPeriods,     setApiPeriods]     = useState([]);
  const [showPeriodCols, setShowPeriodCols] = useState(false);
  const [loading,        setLoading]        = useState(false);
  const projectPortfolioExecutive = useMemo(() => buildProjectPortfolioExecutive(rows), [rows]);
  const [excelLoading,   setExcelLoading]   = useState(false);
  const [error,          setError]          = useState(null);
  const [filtersData,  setFiltersData]  = useState({
    entities:    ["All"],
    departments: ["All"],
    products:    ["All"],
    regions:     ["All"],
    projects:    ["All"],   // NEW — project_name dropdown
  });

  const [draft,   setDraft]   = useState({ ...DEFAULT_FILTERS });
  const [applied, setApplied] = useState({ ...DEFAULT_FILTERS });

  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  /* ── fetch ── */
  const fetchReport = useCallback(async (filters) => {
    if (!token || !year) return;
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      appendProjectCostingParams(params, filters);
      params.append("excel_download", "false");

      const json = await cachedFetch(
        `${API_BASE_URL}/api/v1/company/financial/Project_Costing_Report/${year}/${selectedCurrency}?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const projects = json.projects || [];
      /* Flatten project.total into top-level fields for normal/comparison table */
      setRows(projects.map((p) => ({
        ...p,
        region:                p.region ?? p.regions ?? "-",
        actual:                p.total?.actual                ?? null,
        budget:                p.total?.budget                ?? null,
        variance:              p.total?.variance              ?? null,
        completion_percentage: p.total?.completion_percentage ?? null,
      })));
      setApiPeriods(Array.isArray(json.periods) ? json.periods : []);
      setMetrics(json.keymetrics    || null);
      setGrandTotal(json.grand_total || null);

      setFiltersData({
        entities:    ["All", ...(json.entities    || json.filters?.entities    || []).map((e) => e.entity_name     || e).filter(Boolean)],
        departments: ["All", ...(json.departments || json.filters?.departments || []).map((d) => d.department_name || d).filter(Boolean)],
        products:    ["All", ...(json.products    || json.filters?.products    || []).map((p) => p.product_name    || p).filter(Boolean)],
        regions:     ["All", ...(json.regions     || json.filters?.regions     || []).map((r) => typeof r === "string" ? r : r.region || "").filter(Boolean)],
        projects:    ["All", ...(json.projects_list || json.project_names || json.filters?.projects || []).map((p) => typeof p === "string" ? p : p.project_name || "").filter(Boolean)],
      });
    } catch (err) {
      console.error(err);
      setError("Failed to load Project Costing Report");
    } finally {
      setLoading(false);
    }
  }, [token, year, selectedCurrency]);

  /* ── Excel download ── */
  // `withCommentary` = the commentary to add as a sheet (collectCommentary), or null.
  const downloadExcel = useCallback(async (withCommentary = null) => {
    if (!token || !year) return;
    setExcelLoading(true);
    try {
      const params = new URLSearchParams();
      appendProjectCostingParams(params, { ...applied, page: 1, page_size: 2000 });
      params.append("excel_download", "true");

      const res = await fetch(
        `${API_BASE_URL}/api/v1/company/financial/Project_Costing_Report/${year}/${selectedCurrency}?${params}`,
        { headers: { Authorization: `Bearer ${token}`, accept: "*/*" } }
      );
      if (!res.ok) throw new Error("Download failed");

      const blob = await res.blob();
      const file = withCommentary ? await xlsxWithCommentary(blob, withCommentary) : blob;
      const link = document.createElement("a");
      link.href     = URL.createObjectURL(file);
      link.download = `Project_Costing_${year}_${selectedCurrency}.xlsx`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error(err);
    } finally {
      setExcelLoading(false);
    }
  }, [token, year, selectedCurrency, applied]);

  // Reuses the exact same param-building helper downloadExcel uses, so a
  // scheduled send reproduces this exact filtered view.
  const scheduleFilters = useMemo(() => {
    const params = new URLSearchParams();
    appendProjectCostingParams(params, { ...applied, page: 1, page_size: 2000 });
    return Object.fromEntries(params);
  }, [applied]);

  useEffect(() => { fetchReport(applied); }, [token, year, selectedCurrency]); // eslint-disable-line

  const hasPending = useMemo(() => JSON.stringify(draft) !== JSON.stringify(applied), [draft, applied]);

  const applyFilters = () => {
    const next = { ...draft, page: 1 };
    setApplied(next); setDraft(next); fetchReport(next); setOpen(false);
  };

  const resetAll = () => {
    setDraft({ ...DEFAULT_FILTERS });
    setApplied({ ...DEFAULT_FILTERS });
    fetchReport({ ...DEFAULT_FILTERS });
    setOpen(false);
  };

  /* ── column sort (click header) ── */
  const onColumnSort = (col) => {
    const nextOrder = applied.sort_by === col && applied.sort_order === "asc" ? "desc" : "asc";
    const next      = { ...applied, sort_by: col, sort_order: nextOrder, page: 1 };
    setApplied(next); setDraft(next); fetchReport(next);
  };

  const comparisonActive = useMemo(() => {
    if (!rows.length) return false;
    /* Check top-level comparison dict first */
    if (rows.some((r) => r.comparison && Object.keys(r.comparison).length > 0)) return true;
    /* Fall back to months[p].comparison (backend populates these per period) */
    return rows.some((r) => {
      const months = r.months;
      if (!months || typeof months !== "object") return false;
      return Object.values(months).some(
        (m) => m?.comparison && Object.keys(m.comparison).length > 0
      );
    });
  }, [rows]);

  /* Period pivot — reads months dict already in each row from the API */
  const periodPivot = useMemo(() => {
    if (!showPeriodCols || !rows.length || !apiPeriods.length) return { periods: [], pivot: [] };
    return {
      periods: apiPeriods,
      pivot: rows.map((r) => ({
        project_name:    r.project_name,
        entity_name:     r.entity_name,
        region:          r.region,
        department_name: r.department_name,
        cost_center_id:  r.cost_center_id,
        product_name:    r.product_name,
        customer_name:   r.customer_name,
        months:          r.months || {},
        total:           r.total  || {},
      })),
    };
  }, [rows, showPeriodCols, apiPeriods]);

  /* Grand total months come from the API grand_total record */
  const periodGrandTotals = useMemo(() => {
    if (!showPeriodCols) return {};
    return grandTotal?.months || {};
  }, [grandTotal, showPeriodCols]);

  /* Backend puts current_period / compare_period inside months[p].comparison,
     not in the top-level comparison dict — extract from there.
     Fall back to computing from apiPeriods + applied.comparison when per-period
     comparison data is absent (e.g. no matching rows in comparison period). */
  const { currentPeriod, previousPeriod } = useMemo(() => {
    for (const r of rows) {
      const months = r.months;
      if (months && typeof months === "object") {
        for (const p of Object.keys(months).sort()) {
          const mc = months[p]?.comparison;
          if (mc?.current_period) {
            return {
              currentPeriod:  mc.current_period,
              previousPeriod: mc.compare_period || "—",
            };
          }
        }
      }
    }
    // Compute from apiPeriods when per-period comparison data is absent
    if (apiPeriods.length > 0 && applied.comparison && applied.comparison !== "none") {
      const latestPeriod = apiPeriods[apiPeriods.length - 1];
      let prevPeriod = "—";
      if (applied.comparison === "month_on_month") {
        const [y, m] = latestPeriod.split("-").map(Number);
        const pm = m === 1 ? 12 : m - 1;
        const py = m === 1 ? y - 1 : y;
        prevPeriod = `${py}-${String(pm).padStart(2, "0")}`;
      } else if (applied.comparison === "year_on_year") {
        const [y, m] = latestPeriod.split("-").map(Number);
        prevPeriod = `${y - 1}-${String(m).padStart(2, "0")}`;
      }
      return { currentPeriod: latestPeriod, previousPeriod: prevPeriod };
    }
    return { currentPeriod: "Current", previousPeriod: "Previous" };
  }, [rows, apiPeriods, applied.comparison]);

  /* ── active filter tags ── */
  const activeTags = useMemo(() => {
    const tags = [];
    if (applied.period          !== "all")         tags.push({ key: "period",          label: `Period: ${PERIODS.find((p) => p.id === applied.period)?.label || applied.period}` });
    if (applied.date_from)                         tags.push({ key: "date_from",        label: `From: ${applied.date_from}` });
    if (applied.date_to)                           tags.push({ key: "date_to",          label: `To: ${applied.date_to}` });
    if (applied.entity_name     !== "All")         tags.push({ key: "entity_name",     label: `Entity: ${applied.entity_name}` });
    if (applied.department_name !== "All")         tags.push({ key: "department_name", label: `Dept: ${applied.department_name}` });
    if (applied.product_name    !== "All")         tags.push({ key: "product_name",    label: `Product: ${applied.product_name}` });
    if (applied.project_name    !== "All")         tags.push({ key: "project_name",    label: `Project: ${applied.project_name}` });
    if (applied.status          !== "all")         tags.push({ key: "status",          label: `Status: ${STATUS_FILTERS.find((s) => s.id === applied.status)?.label || applied.status}` });
    if (applied.region          !== "All")         tags.push({ key: "region",          label: `Region: ${applied.region}` });
    if (applied.currency_filter !== "actualvalue") tags.push({ key: "currency_filter", label: `Unit: ${CURRENCY_FILTERS.find((c) => c.id === applied.currency_filter)?.label}` });
    if (applied.comparison      !== "none")        tags.push({ key: "comparison",      label: `Compare: ${COMPARISON_FILTERS.find((c) => c.id === applied.comparison)?.label}` });
    if (applied.sort_by !== "period" || applied.sort_order !== "asc") {
      tags.push({ key: "sort", label: `Sort: ${SORT_BY_OPTIONS.find((s) => s.id === applied.sort_by)?.label || applied.sort_by} (${applied.sort_order})` });
    }
    return tags.filter(Boolean);
  }, [applied]);

  const removeTag = (tag) => {
    if (tag.key === "sort") {
      const next = { ...applied, sort_by: "period", sort_order: "asc", page: 1 };
      setApplied(next); setDraft(next); fetchReport(next);
      return;
    }
    const def = {
      period: "all", date_from: "", date_to: "",
      entity_name: "All", department_name: "All", product_name: "All",
      project_name: "All", status: "all", region: "All",
      currency_filter: "actualvalue", comparison: "none",
      sort_by: "period", sort_order: "asc",
    };
    const next = { ...applied, [tag.key]: def[tag.key], page: 1 };
    setApplied(next); setDraft(next); fetchReport(next);
  };

  const updateColumnToggle = (flag) => {
    const next = { ...applied, [flag]: !applied[flag], page: 1 };
    setApplied(next); setDraft(next); fetchReport(next);
  };

  const visibleOptionalColumns = useMemo(
    () => OPTIONAL_COLUMNS.filter(({ flag }) => applied[flag]),
    [applied]
  );

  const normalColumns = useMemo(
    () => [
      { key: "project_name", label: "Project", csv: "Project" },
      ...visibleOptionalColumns,
      ...BASE_MEASURE_COLUMNS,
      { key: "status", label: "Status", csv: "Status", sortable: false },
    ],
    [visibleOptionalColumns]
  );

  const comparisonDimensionColumns = useMemo(
    () => [{ key: "project_name", label: "Project" }, ...visibleOptionalColumns],
    [visibleOptionalColumns]
  );

  /* ── CSV ── */
  const csvData = useMemo(() => {
    const baseColumns = [
      { key: "project_name", csv: "Project" },
      ...visibleOptionalColumns,
      ...BASE_MEASURE_COLUMNS,
      { key: "status", csv: "Status" },
    ];
    const base = baseColumns.map((c) => c.csv);
    const rowValues = (r) =>
      baseColumns.map(({ key }) => {
        if (key === "completion_percentage") return `${Number(r.completion_percentage || 0).toFixed(getDecimalPrecision())}%`;
        if (key === "status")               return Number(r.variance) < 0 ? "Over Budget" : "On Budget";
        return ["actual", "budget", "variance"].includes(key) ? fmt(r[key]) : (r[key] ?? "");
      });

    if (comparisonActive) {
      return [
        [...base, "Current Period", "Prev Period", "Prev Actual", "Prev Budget", "Prev Variance"],
        ...rows.map((r) => [
          ...rowValues(r),
          r.comparison?.current_period  ?? r.period ?? "",
          r.comparison?.previous_period ?? "",
          fmt(r.comparison?.previous_actual),
          fmt(r.comparison?.previous_budget),
          fmt(r.comparison?.previous_variance),
        ]),
      ];
    }
    return [base, ...rows.map(rowValues)];
  }, [rows, comparisonActive, visibleOptionalColumns]);

  const aiMessages = useMemo(() => generateInsights(rows, metrics), [rows, metrics]);

  /* ── sort arrow ── */
  const SortArrow = ({ col }) => {
    if (applied.sort_by !== col) return <span className="text-white/40 ml-1 text-[10px]">⇅</span>;
    return <span className="text-white ml-1 text-[10px]">{applied.sort_order === "asc" ? "↑" : "↓"}</span>;
  };

  /* KPI variant helper */
  const kpiVariant = (v) => {
    const n = Number(v);
    if (isNaN(n) || n === 0) return "default";
    return n > 0 ? "positive" : "negative";
  };

  /* ── AI insights / commentary ── */
  // Sorting, paging and the dimension-column toggles don't change which
  // projects are in scope, so they aren't part of the commentary's view.
  const commentaryFilters = useMemo(
    () => Object.fromEntries(
      Object.entries(applied).filter(
        ([k]) => !["sort_by", "sort_order", "page", "page_size"].includes(k) && !k.startsWith("show_")
      )
    ),
    [applied]
  );

  const commentary = useReportCommentary({
    token,
    reportId: "project_costing",
    year,
    currency: selectedCurrency,
    filters: commentaryFilters,
  });

  const insightFilterLabels = useMemo(
    () => activeTags.filter((t) => t.key !== "sort").map((t) => t.label),
    [activeTags]
  );

  const viewKey = `${year}|${selectedCurrency}|${JSON.stringify(commentaryFilters)}|${visibleOptionalColumns.map((c) => c.flag).join(",")}|${showPeriodCols}`;

  const buildInsightsContext = () => {
    if (!rows.length) return "";
    const num  = toNumberForAI;
    const diff = (a, b) => (num(a) !== null && num(b) !== null ? num(a) - num(b) : null);
    const label = (r) =>
      [r.project_name, ...visibleOptionalColumns.map(({ key }) => r[key])]
        .filter((v) => v !== null && v !== undefined && v !== "" && v !== "-")
        .join(" / ");

    // Mirrors the table on screen: current / previous / change columns in the
    // comparison table, per-period columns when "Show Period Columns" is on.
    const showPrev = comparisonActive && !showPeriodCols;
    const periodValues = (pd) => {
      const c = (comparisonActive && pd.comparison) || {};
      return {
        actual:              c.current_actual ?? pd.actual,
        previous_actual:     c.previous_actual,
        budget:              c.current_budget ?? pd.budget,
        previous_budget:     c.previous_budget,
        variance:            c.current_variance ?? pd.variance,
        spend_pct_of_budget: pd.completion_percentage,
      };
    };
    const toRow = (name, r, months) => {
      const c        = (showPrev && r.comparison) || {};
      const actual   = c.current_actual   ?? r.actual;
      const budget   = c.current_budget   ?? r.budget;
      const variance = c.current_variance ?? r.variance;
      return {
        label: name,
        actual,
        ...(showPrev && { previous_actual: c.previous_actual, actual_change: diff(actual, c.previous_actual) }),
        budget,
        ...(showPrev && { previous_budget: c.previous_budget, budget_change: diff(budget, c.previous_budget) }),
        variance,
        ...(showPrev && { previous_variance: c.previous_variance, variance_change: diff(variance, c.previous_variance) }),
        spend_pct_of_budget: r.completion_percentage,
        status: num(variance) === null ? undefined : num(variance) < 0 ? "Over Budget" : "On Budget",
        months: showPeriodCols
          ? Object.fromEntries(apiPeriods.filter((p) => months?.[p]).map((p) => [p, periodValues(months[p])]))
          : undefined,
      };
    };

    // Biggest spenders first — rows are trimmed from the end if the context is too long.
    const projectRows = [...rows]
      .sort((a, b) => (num(b.actual) ?? 0) - (num(a.actual) ?? 0))
      .map((r) => toRow(label(r), r, r.months));
    const totalRow = grandTotal && toRow("Grand Total", grandTotal.total || grandTotal, grandTotal.months);

    const byVariance = rankForAI(rows, (r) => r.variance, label);
    const withPrev   = rows.filter((r) => r.comparison?.previous_actual != null);
    const facts = {
      months_with_data: apiPeriods.length > 1 ? `${apiPeriods[0]} to ${apiPeriods[apiPeriods.length - 1]}` : apiPeriods[0],
      largest_by_actual_spend: rankForAI(rows, (r) => r.actual, label)?.highest,
      most_over_budget:  byVariance?.lowest.filter((x) => x.value < 0),
      most_under_budget: byVariance?.highest.filter((x) => x.value > 0),
      rows_over_budget: `${rows.filter((r) => num(r.variance) < 0).length} of ${rows.length}`,
      ...(comparisonActive && withPrev.length > 1 && {
        actual_change_vs_previous: rankForAI(
          withPrev,
          (r) => diff(r.comparison.current_actual ?? r.actual, r.comparison.previous_actual),
          label,
          Math.min(3, Math.floor(withPrev.length / 2))
        ),
      }),
    };

    const comparisonLabel = COMPARISON_FILTERS.find((c) => c.id === applied.comparison)?.label;
    const notes = [
      "Variance = budget − actual: a negative variance means the project is OVER budget (unfavorable) and a positive variance means it is under budget.",
      "spend_pct_of_budget (the Completion column) is actual spend as a % of budget (actual ÷ budget × 100), not physical progress; it is 0 when there is no budget.",
      comparisonActive &&
        `Comparison${comparisonLabel ? ` (${comparisonLabel})` : ""}: previous_* are the same figures for the comparison period(s) — the prior month for Month on Month, the same month a year earlier for Year on Year — and *_change = current − previous.`,
    ].filter(Boolean).join(" ");

    return buildReportAIContext({
      valueScale: CURRENCY_FILTERS.find((c) => c.id === applied.currency_filter)?.label || "Actual Value",
      notes,
      keyMetrics: metrics,
      facts,
      rows: [totalRow, ...projectRows].filter(Boolean),
    });
  };

  // The commentary shown under the report, offered with the Excel download.
  const exportCommentary = collectCommentary({ reportItems: commentary.items });

  /* ══════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════ */
  return (
    <ReportsLayout>
      <main className="flex-1 min-w-0 bg-white p-3 rounded-xl shadow-md">

        {/* ── HEADER ── */}
        <div className="flex justify-between items-center gap-3 mb-2">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-lg font-semibold text-sky-900">Project Costing Report</h2>
            <p className="text-s text-sky-600">Budget vs Actual | YoY / MoM Comparison | Variance Analysis</p>
          </div>
          <Link
            to="/project-costing-report-dashboard"
            className="flex shrink-0 items-center whitespace-nowrap py-2 px-3 text-x text-white bg-sky-900 rounded-lg hover:bg-white hover:text-sky-900 transition border border-sky-900"
          >
            View More <FaArrowRightToBracket className="ml-1" />
          </Link>
        </div>

        {/* ══════════════════════════════════════════
            KPI CARDS  ← from HTML reference
        ══════════════════════════════════════════ */}
        {/* {metrics && (
          <div className="flex flex-wrap gap-3 mb-4">
            <KpiCard
              icon="💰"
              label="Total Budget"
              value={fmtKpi(metrics.total_budget)}
              sub="Planned spend"
            />
            <KpiCard
              icon="📊"
              label="Total Actual"
              value={fmtKpi(metrics.total_actual)}
              sub="Actual spend"
            />
            <KpiCard
              icon="📉"
              label="Total Variance"
              value={fmtKpi(metrics.total_variance)}
              sub="Budget − Actual"
              variant={kpiVariant(metrics.total_variance)}
            />
            <KpiCard
              icon="✅"
              label="On Budget"
              value={metrics.on_budget_projects ?? "—"}
              sub="Projects within budget"
              variant="positive"
            />
            <KpiCard
              icon="⚠️"
              label="Over Budget"
              value={metrics.over_budget_projects ?? "—"}
              sub="Projects exceeding budget"
              variant={Number(metrics.over_budget_projects) > 0 ? "negative" : "default"}
            />
          </div>
        )} */}

        {/* ── FILTER BAR ── */}
        <div className="mb-3 flex items-start justify-between gap-3 flex-wrap" ref={ref}>

          {/* Active filter chips */}
          <div className="flex flex-wrap gap-2 items-center min-h-[34px]">
            {activeTags.length === 0 ? (
              <span className="text-x text-sky-400 italic">No filters applied</span>
            ) : (
              activeTags.map((t) => (
                <motion.span
                  key={`${t.key}-${t.label}`}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1 px-3 py-1 text-x rounded-full bg-sky-800 text-white"
                >
                  {t.label}
                  <button
                    onClick={() => removeTag(t)}
                    className="ml-1 text-sky-200 hover:text-white font-bold leading-none"
                  >
                    ×
                  </button>
                </motion.span>
              ))
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">

            {/* Filter dropdown */}
            <div className="relative">
              <button
                onClick={() => setOpen((o) => !o)}
                aria-label="Filters"
                className={`relative group flex items-center gap-1 px-3 py-2.5 text-x font-medium rounded-lg border transition
                  ${hasPending
                    ? "bg-amber-50 border-amber-300 text-amber-800"
                    : "bg-sky-100 border-sky-200 text-sky-800 hover:bg-sky-200"}`}
              >
                <FiFilter size={14} />
                <ActionHoverLabel>Filters</ActionHoverLabel>
                {hasPending && (
                  <span className="ml-1 px-2 py-[2px] rounded-full bg-amber-400 text-white text-[10px] font-bold">
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
                    className="absolute right-0 mt-2 w-[600px] bg-sky-50 border border-sky-200 rounded-xl shadow-xl z-50"
                  >
                    <div className="p-4 grid grid-cols-3 gap-3">

                      <SelectField
                        label="Period"
                        value={draft.period}
                        options={PERIODS}
                        onChange={(v) => setDraft((f) => ({ ...f, period: v }))}
                      />
                      <SelectField
                        label="Currency"
                        value={draft.currency_filter}
                        options={CURRENCY_FILTERS}
                        onChange={(v) => setDraft((f) => ({ ...f, currency_filter: v }))}
                      />
                      <SelectField
                        label="Comparison"
                        value={draft.comparison}
                        options={COMPARISON_FILTERS}
                        onChange={(v) => setDraft((f) => ({ ...f, comparison: v }))}
                      />
                      {/* Custom date range inputs */}
                      <div>
                        <label className="block mb-1 text-sky-700 font-medium text-x">Date From (YYYY-MM)</label>
                        <input
                          type="month"
                          value={draft.date_from}
                          onChange={(e) =>
                            setDraft((f) => ({
                              ...f,
                              date_from: e.target.value,
                              period: e.target.value ? "custom_range" : f.period,
                            }))
                          }
                          className="w-full border border-sky-200 rounded-lg p-2 bg-white text-sky-900 text-x"
                        />
                      </div>
                      <div>
                        <label className="block mb-1 text-sky-700 font-medium text-x">Date To (YYYY-MM)</label>
                        <input
                          type="month"
                          value={draft.date_to}
                          onChange={(e) =>
                            setDraft((f) => ({
                              ...f,
                              date_to: e.target.value,
                              period: e.target.value ? "custom_range" : f.period,
                            }))
                          }
                          className="w-full border border-sky-200 rounded-lg p-2 bg-white text-sky-900 text-x"
                        />
                      </div>

                      {/* Status — added from HTML reference */}
                      <SelectField
                        label="Status"
                        value={draft.status}
                        options={STATUS_FILTERS}
                        onChange={(v) => setDraft((f) => ({ ...f, status: v }))}
                      />

                      <SelectField
                        label="Entity"
                        value={draft.entity_name}
                        options={filtersData.entities}
                        onChange={(v) => setDraft((f) => ({ ...f, entity_name: v }))}
                      />
                      <SelectField
                        label="Region"
                        value={draft.region}
                        options={filtersData.regions}
                        onChange={(v) => setDraft((f) => ({ ...f, region: v }))}
                      />
                      <SelectField
                        label="Department"
                        value={draft.department_name}
                        options={filtersData.departments}
                        onChange={(v) => setDraft((f) => ({ ...f, department_name: v }))}
                      />
                      <SelectField
                        label="Product"
                        value={draft.product_name}
                        options={filtersData.products}
                        onChange={(v) => setDraft((f) => ({ ...f, product_name: v }))}
                      />

                      {/* Project filter — new from HTML reference / API */}
                      <SelectField
                        label="Project"
                        value={draft.project_name}
                        options={filtersData.projects}
                        onChange={(v) => setDraft((f) => ({ ...f, project_name: v }))}
                      />

                      <SelectField
                        label="Sort By"
                        value={draft.sort_by}
                        options={SORT_BY_OPTIONS}
                        onChange={(v) => setDraft((f) => ({ ...f, sort_by: v }))}
                      />
                      <SelectField
                        label="Sort Order"
                        value={draft.sort_order}
                        options={SORT_ORDER_OPTIONS}
                        onChange={(v) => setDraft((f) => ({ ...f, sort_order: v }))}
                      />
                    </div>

                    <div className="p-3 border-t border-sky-200 flex gap-2">
                      <button
                        onClick={resetAll}
                        className="w-1/2 py-2 text-x bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition font-medium"
                      >
                        Reset All
                      </button>
                      <button
                        onClick={applyFilters}
                        disabled={!hasPending}
                        className={[
                          "w-1/2 py-2 text-x rounded-lg font-semibold transition",
                          hasPending
                            ? "bg-sky-900 text-white hover:bg-sky-800"
                            : "bg-sky-200 text-sky-400 cursor-not-allowed",
                        ].join(" ")}
                      >
                        Apply
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* <CSVLink
              data={csvData}
              filename={`Project_Costing_${year}_${selectedCurrency}.csv`}
              className="flex items-center gap-2 px-3 py-2 text-x bg-white text-sky-800 border border-sky-300 rounded-lg hover:bg-sky-100"
            >
              <FiDownload size={13} /> CSV
            </CSVLink> */}

            <ExportMenu
              label="Excel"
              format="excel"
              busy={excelLoading}
              commentaryCount={commentaryCount(exportCommentary)}
              onExport={(include) => downloadExcel(include ? exportCommentary : null)}
              className="relative group flex items-center px-3 py-2.5 text-x bg-green-50 text-green-800 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50"
            />

            <AddAutomation
              reportType="project_costing"
              reportLabel="Project Costing Report"
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

            <span className="h-6 w-px bg-sky-200" aria-hidden="true" />

            <AIActionsMenu
              reportId="project_costing"
              insights={{
                commentary,
                reportLabel: "Project Costing Report",
                filterLabels: insightFilterLabels,
                viewKey,
                buildContext: buildInsightsContext,
                // After a failed fetch the table still shows the previous data.
                disabled: loading || !!error || !rows.length,
              }}
            />
          </div>
        </div>

        {/* ── COLUMN TOGGLES ── */}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-100 bg-sky-50 px-3 py-1">
          <div className="flex flex-wrap items-center gap-3">
            {OPTIONAL_COLUMNS.map(({ flag, label }) => (
              <label key={flag} className="inline-flex items-center gap-1.5 text-x font-medium text-sky-800">
                <input
                  type="checkbox"
                  checked={Boolean(applied[flag])}
                  onChange={() => updateColumnToggle(flag)}
                  className="h-3.5 w-3.5 rounded border-sky-300 text-sky-800 focus:ring-sky-500"
                />
                {label}
              </label>
            ))}
            <label className="inline-flex items-center gap-1.5 text-x font-medium text-sky-800 border-l border-sky-200 pl-3 ml-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showPeriodCols}
                onChange={() => setShowPeriodCols((v) => !v)}
                className="h-3.5 w-3.5 rounded border-sky-300 text-sky-800 focus:ring-sky-500"
              />
              Show Period Columns
            </label>
          </div>
          <span className="text-[11px] font-semibold text-sky-600">Click column headers to sort</span>
        </div>

        {/* ── LOADING / ERROR ── */}
        {loading && <TableSkeleton />}
        {error   && <p className="text-red-600 text-s">{error}</p>}

        {/* ══════════════════════════════════════════
            NORMAL TABLE (no comparison)
        ══════════════════════════════════════════ */}
        {!loading && rows.length > 0 && !comparisonActive && !showPeriodCols && (
          <div className="report-table-scroll overflow-auto mt-2 max-h-[440px] border border-sky-200 rounded-lg bg-white">
            <table className="min-w-[1000px] w-full text-x text-sky-900">
              <thead className="sticky top-0 bg-sky-900 text-white z-10">
                <tr>
                  {normalColumns.map(({ key, label, sortable = true }) => (
                    <th
                      key={key}
                      className="px-3 py-3 text-left font-semibold whitespace-nowrap cursor-pointer hover:bg-sky-800"
                      onClick={() => sortable && onColumnSort(key)}
                    >
                      {label}{sortable && <SortArrow col={key} />}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">
                    Insights
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.015, 0.3) }}
                    className="border-b border-sky-50 hover:bg-sky-50 transition-colors"
                  >
                    {normalColumns.map(({ key }) => (
                      <td
                        key={key}
                        className={[
                          "px-3 py-2.5 whitespace-nowrap",
                          key === "project_name"               ? "font-medium"  : "",
                          ["actual", "budget"].includes(key)   ? "text-right"   : "",
                        ].join(" ")}
                      >
                        {key === "variance"
                          ? <VariancePill   value={r.variance}              />
                          : key === "completion_percentage"
                          ? <CompletionBar  value={r.completion_percentage} />
                          : key === "status"
                          ? <StatusBadge    variance={r.variance}           />
                          : fmt(r[key])}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 whitespace-nowrap min-w-[420px] text-sky-700">
                      {buildProjectPacingInsight(r)}
                    </td>
                  </motion.tr>
                ))}

                {/* Grand Total sticky row */}
                {grandTotal && (
                  <tr className="sticky bottom-0 bg-sky-50 font-semibold border-t-2 border-sky-200">
                    {normalColumns.map(({ key }, idx) => {
                      const gt = grandTotal.total || grandTotal;
                      return (
                        <td
                          key={key}
                          className={[
                            "px-3 py-2.5 whitespace-nowrap",
                            ["actual", "budget"].includes(key) ? "text-right" : "",
                          ].join(" ")}
                        >
                          {idx === 0
                            ? "Grand Total"
                            : key === "variance"
                            ? <VariancePill   value={gt.variance}              />
                            : key === "completion_percentage"
                            ? <CompletionBar  value={gt.completion_percentage} />
                            : key === "status"
                            ? <StatusBadge    variance={gt.variance}           />
                            : ["actual", "budget"].includes(key)
                            ? fmt(gt[key])
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
            COMPARISON TABLE (YoY / MoM)
        ══════════════════════════════════════════ */}
        {!loading && rows.length > 0 && comparisonActive && !showPeriodCols && (
          <div className="report-table-scroll overflow-auto h-[330px] mt-2 border border-sky-200 rounded-lg bg-white">
            <table className="min-w-[1300px] w-full text-x text-sky-900 border-collapse">
              <thead className="z-20">
                <tr className="bg-sky-900 text-white">
                  {comparisonDimensionColumns.map(({ key, label }) => (
                    <th
                      key={key}
                      rowSpan={2}
                      className="px-3 py-3 text-left font-semibold whitespace-nowrap align-middle border-r border-white/20 cursor-pointer hover:bg-sky-800"
                      onClick={() => onColumnSort(key)}
                    >
                      {label}<SortArrow col={key} />
                    </th>
                  ))}
                  <th colSpan={3} className="px-3 py-2 text-center font-bold border-l border-white/20 whitespace-nowrap">ACTUAL</th>
                  <th colSpan={3} className="px-3 py-2 text-center font-bold border-l border-white/20 whitespace-nowrap">BUDGET</th>
                  <th colSpan={3} className="px-3 py-2 text-center font-bold border-l border-white/20 whitespace-nowrap">VARIANCE</th>
                  <th rowSpan={2} className="px-3 py-3 text-left font-semibold whitespace-nowrap align-middle border-l border-white/20 min-w-[110px]">COMPLETION</th>
                  <th rowSpan={2} className="px-3 py-3 text-left font-semibold whitespace-nowrap align-middle border-l border-white/20">STATUS</th>
                </tr>
                <tr className="bg-sky-800 text-white">
                  {["ACTUAL", "BUDGET", "VARIANCE"].map((grp) => [
                    <th key={`${grp}-cur`} className="px-3 py-2 text-right border-l border-white/20 whitespace-nowrap">
                      <div className="text-[10px] text-white/60">Current</div>
                      <div className="text-[11px] font-semibold">{currentPeriod}</div>
                    </th>,
                    <th key={`${grp}-prev`} className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="text-[10px] text-white/60">Previous</div>
                      <div className="text-[11px] font-semibold">{previousPeriod}</div>
                    </th>,
                    <th key={`${grp}-diff`} className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="text-[10px] text-white/60">Change</div>
                      <div className="text-[11px] font-semibold">Variance</div>
                    </th>,
                  ])}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const c           = r.comparison || {};
                  const actualDiff   = c.current_actual   != null && c.previous_actual   != null ? Number(c.current_actual)   - Number(c.previous_actual)   : null;
                  const budgetDiff   = c.current_budget   != null && c.previous_budget   != null ? Number(c.current_budget)   - Number(c.previous_budget)   : null;
                  const varianceDiff = c.current_variance != null && c.previous_variance != null ? Number(c.current_variance) - Number(c.previous_variance) : null;
                  return (
                    <motion.tr
                      key={i}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.015, 0.3) }}
                      className="border-b border-sky-50 hover:bg-sky-50 transition-colors"
                    >
                      {comparisonDimensionColumns.map(({ key }) => (
                        <td
                          key={key}
                          className={`px-3 py-2.5 whitespace-nowrap border-r border-sky-100 ${key === "project_name" ? "font-medium" : ""}`}
                        >
                          {fmt(r[key])}
                        </td>
                      ))}
                      {/* ACTUAL */}
                      <td className="px-3 py-2.5 text-right font-semibold text-sky-900 border-l border-sky-100 whitespace-nowrap">{fmt(c.current_actual  ?? r.actual)}</td>
                      <td className="px-3 py-2.5 text-right text-sky-500 whitespace-nowrap">{c.previous_actual  != null ? fmt(c.previous_actual)  : "—"}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">{actualDiff   !== null ? <VariancePill value={actualDiff}   /> : "—"}</td>
                      {/* BUDGET */}
                      <td className="px-3 py-2.5 text-right font-semibold text-sky-900 border-l border-sky-100 whitespace-nowrap">{fmt(c.current_budget  ?? r.budget)}</td>
                      <td className="px-3 py-2.5 text-right text-sky-500 whitespace-nowrap">{c.previous_budget  != null ? fmt(c.previous_budget)  : "—"}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">{budgetDiff   !== null ? <VariancePill value={budgetDiff}   /> : "—"}</td>
                      {/* VARIANCE */}
                      <td className="px-3 py-2.5 text-right border-l border-sky-100 whitespace-nowrap"><VariancePill value={c.current_variance  ?? r.variance} /></td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">{c.previous_variance != null ? <VariancePill value={c.previous_variance} /> : "—"}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">{varianceDiff !== null ? <VariancePill value={varianceDiff} /> : "—"}</td>
                      {/* COMPLETION + STATUS */}
                      <td className="px-3 py-2.5 whitespace-nowrap border-l border-sky-100"><CompletionBar value={r.completion_percentage} /></td>
                      <td className="px-3 py-2.5 whitespace-nowrap border-l border-sky-100"><StatusBadge variance={r.variance} /></td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── EMPTY STATE ── */}
        {!loading && rows.length === 0 && !error && !showPeriodCols && (
          <div className="h-[300px] flex flex-col items-center justify-center border border-sky-100 rounded-xl bg-sky-50">
            <p className="text-sky-700 text-s font-medium">No data for selected filters</p>
            <p className="text-sky-400 text-x mt-1">Try adjusting your filters</p>
          </div>
        )}

        {/* ══════════════════════════════════════════
            PERIOD PIVOT TABLE
        ══════════════════════════════════════════ */}
        {!loading && showPeriodCols && (
          periodPivot.periods.length > 0 ? (() => {
            const headerRows = comparisonActive ? 3 : 2;
            const periodCols = comparisonActive ? 8 : 4;
            const totalCols  = 4;
            const visibleDims = OPTIONAL_COLUMNS.filter(({ flag }) => applied[flag]);
            const minW = 200 + visibleDims.length * 110 + periodPivot.periods.length * (comparisonActive ? 480 : 240) + 220;

            const thSub  = "px-2 py-2 text-right whitespace-nowrap border-l border-white/20 font-medium text-[11px]";
            const tdBase = "px-2 py-2.5 text-right whitespace-nowrap border-l border-sky-100 text-[11px]";

            const renderPeriodCells = (pd) => {
              if (!comparisonActive) {
                return (
                  <>
                    <td className={tdBase}>{fmt(pd.actual)}</td>
                    <td className={tdBase}>{fmt(pd.budget)}</td>
                    <td className={`${tdBase} text-left`}><VariancePill value={pd.variance} /></td>
                    <td className={`${tdBase} min-w-[110px]`}><CompletionBar value={pd.completion_percentage} /></td>
                  </>
                );
              }
              const c = pd.comparison || {};
              const actualDiff  = c.current_actual  != null && c.previous_actual  != null ? Number(c.current_actual)  - Number(c.previous_actual)  : null;
              const budgetDiff  = c.current_budget  != null && c.previous_budget  != null ? Number(c.current_budget)  - Number(c.previous_budget)  : null;
              return (
                <>
                  <td className={tdBase}>{fmt(c.current_actual  ?? pd.actual)}</td>
                  <td className={`${tdBase} text-sky-500`}>{fmt(c.previous_actual)}</td>
                  <td className={`${tdBase} text-left`}>{actualDiff !== null ? <VariancePill value={actualDiff} /> : "—"}</td>
                  <td className={tdBase}>{fmt(c.current_budget  ?? pd.budget)}</td>
                  <td className={`${tdBase} text-sky-500`}>{fmt(c.previous_budget)}</td>
                  <td className={`${tdBase} text-left`}>{budgetDiff !== null ? <VariancePill value={budgetDiff} /> : "—"}</td>
                  <td className={`${tdBase} text-left`}><VariancePill value={c.current_variance ?? pd.variance} /></td>
                  <td className={`${tdBase} min-w-[100px]`}><CompletionBar value={pd.completion_percentage} /></td>
                </>
              );
            };

            const renderTotalCells = (tot, bold) => {
              const W = bold ? "font-semibold" : "";
              return (
                <>
                  <td className={`${tdBase} ${W}`}>{fmt(tot?.actual)}</td>
                  <td className={`${tdBase} ${W}`}>{fmt(tot?.budget)}</td>
                  <td className={`${tdBase} text-left ${W}`}><VariancePill value={tot?.variance} /></td>
                  <td className={`${tdBase} min-w-[100px]`}><CompletionBar value={tot?.completion_percentage} /></td>
                </>
              );
            };

            return (
              <div className="report-table-scroll overflow-auto mt-2 max-h-[440px] border border-sky-200 rounded-lg bg-white">
                <table className="w-full text-x text-sky-900" style={{ minWidth: `${minW}px` }}>
                  <thead className="sticky top-0 z-10">

                    {/* Row 1 */}
                    <tr className="bg-sky-900 text-white">
                      <th rowSpan={headerRows} className="px-3 py-3 text-left whitespace-nowrap border-r border-white/20 cursor-pointer hover:bg-sky-800 select-none" onClick={() => onColumnSort("project_name")}>
                        PROJECT <SortArrow col="project_name" />
                      </th>
                      {visibleDims.map(({ flag, key, label }) => (
                        <th key={key} rowSpan={headerRows} className="px-3 py-3 text-left whitespace-nowrap border-l border-white/20">
                          {label.toUpperCase()}
                        </th>
                      ))}
                      {periodPivot.periods.map((p) => (
                        <th key={p} colSpan={periodCols} className="px-3 py-2 text-center border-l border-white/20 font-semibold tracking-wide">
                          {p}
                        </th>
                      ))}
                      <th colSpan={totalCols} className="px-3 py-2 text-center border-l border-white/30 font-semibold tracking-wide bg-sky-950">
                        TOTAL
                      </th>
                    </tr>

                    {/* Row 2 */}
                    <tr className="bg-sky-800 text-white text-[11px]">
                      {periodPivot.periods.map((p) =>
                        comparisonActive ? (
                          <React.Fragment key={p}>
                            <th colSpan={3} className={`${thSub} text-center`}>ACTUAL</th>
                            <th colSpan={3} className={`${thSub} text-center`}>BUDGET</th>
                            <th rowSpan={2} className={`${thSub} align-middle`}>VARIANCE</th>
                            <th rowSpan={2} className={`${thSub} align-middle min-w-[100px]`}>COMPLETION</th>
                          </React.Fragment>
                        ) : (
                          <React.Fragment key={p}>
                            <th className={thSub}>Actual</th>
                            <th className={thSub}>Budget</th>
                            <th className={thSub}>Variance</th>
                            <th className={`${thSub} min-w-[100px]`}>Completion%</th>
                          </React.Fragment>
                        )
                      )}
                      {comparisonActive ? (
                        <>
                          <th rowSpan={2} className={`${thSub} bg-sky-950 align-middle`}>Actual</th>
                          <th rowSpan={2} className={`${thSub} bg-sky-950 align-middle`}>Budget</th>
                          <th rowSpan={2} className={`${thSub} bg-sky-950 align-middle`}>Variance</th>
                          <th rowSpan={2} className={`${thSub} bg-sky-950 align-middle min-w-[100px]`}>Completion%</th>
                        </>
                      ) : (
                        <>
                          <th className={`${thSub} bg-sky-950`}>Actual</th>
                          <th className={`${thSub} bg-sky-950`}>Budget</th>
                          <th className={`${thSub} bg-sky-950`}>Variance</th>
                          <th className={`${thSub} bg-sky-950 min-w-[100px]`}>Completion%</th>
                        </>
                      )}
                    </tr>

                    {/* Row 3 — comparison sub-labels only */}
                    {comparisonActive && (
                      <tr className="bg-sky-700 text-white text-[10px]">
                        {periodPivot.periods.map((p) => (
                          <React.Fragment key={p}>
                            <th className={thSub}>Curr</th><th className={thSub}>Prev</th><th className={thSub}>Δ</th>
                            <th className={thSub}>Curr</th><th className={thSub}>Prev</th><th className={thSub}>Δ</th>
                          </React.Fragment>
                        ))}
                      </tr>
                    )}
                  </thead>

                  <tbody>
                    {periodPivot.pivot.map((r, i) => (
                      <motion.tr
                        key={i}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.015, 0.3) }}
                        className="border-b border-sky-50 hover:bg-sky-50 transition-colors"
                      >
                        <td className="px-3 py-2.5 whitespace-nowrap font-medium border-r border-sky-100 text-[11px]">
                          {r.project_name || "—"}
                        </td>
                        {visibleDims.map(({ key }) => (
                          <td key={key} className="px-2 py-2.5 whitespace-nowrap border-l border-sky-100 text-[11px]">{r[key] || "—"}</td>
                        ))}
                        {periodPivot.periods.map((p) => (
                          <React.Fragment key={p}>
                            {renderPeriodCells(r.months[p] || {})}
                          </React.Fragment>
                        ))}
                        {renderTotalCells(r.total, false)}
                      </motion.tr>
                    ))}

                    {/* Grand Total */}
                    {periodPivot.pivot.length > 0 && (
                      <tr className="sticky bottom-0 bg-sky-50 border-t-2 border-sky-200 font-semibold text-sky-900">
                        <td className="px-3 py-2.5 whitespace-nowrap border-r border-sky-200 text-[11px]">
                          Grand Total
                        </td>
                        {visibleDims.map(({ key }) => (
                          <td key={key} className="px-2 py-2.5 border-l border-sky-100"></td>
                        ))}
                        {periodPivot.periods.map((p) => (
                          <React.Fragment key={p}>
                            {renderPeriodCells(periodGrandTotals[p] || {})}
                          </React.Fragment>
                        ))}
                        {renderTotalCells(grandTotal?.total, true)}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })() : (
            <div className="h-[200px] flex items-center justify-center border rounded-xl">
              <p className="text-s text-sky-500 italic">No period data available — try selecting "All Periods" in filters</p>
            </div>
          )
        )}

        {/* ══════════════════════════════════════════
            KEY METRICS + AI INSIGHTS
        ══════════════════════════════════════════ */}
        {metrics && rows.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-6 bg-white border border-sky-200 rounded-xl p-4 shadow-sm"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 space-y-0">
                <h3 className="text-s font-semibold text-sky-900 mb-2">Key Project Metrics</h3>
                <MetricRow label="Total Budget"         value={metrics.total_budget}         />
                <MetricRow label="Total Actual"         value={metrics.total_actual}         />
                <MetricRow label="Total Variance"       value={metrics.total_variance}       />
                <MetricRow label="On Budget Projects"   value={metrics.on_budget_projects}   />
                <MetricRow label="Over Budget Projects" value={metrics.over_budget_projects} />
              </div>
              <div className="bg-sky-50 md:col-span-2 border border-sky-200 rounded-lg p-3 flex flex-col justify-between gap-3">
                <h4 className="text-x font-semibold text-sky-900">Executive Financial Insight</h4>
                <div className="flex-1 flex flex-col justify-center gap-2">
                  {projectPortfolioExecutive.map((para, i) => (
                    <p key={i} className="text-s text-sky-800 leading-relaxed">{para}</p>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-2 border-t border-sky-200">
                  {[
                    { label: "Budget",      value: metrics.total_budget,         cls: "bg-sky-100 text-sky-800"       },
                    { label: "Actual",      value: metrics.total_actual,         cls: "bg-violet-100 text-violet-800" },
                    { label: "Variance",    value: metrics.total_variance,       cls: Number(metrics.total_variance) >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700" },
                    { label: "On Budget",   value: metrics.on_budget_projects,   cls: "bg-emerald-100 text-emerald-800" },
                    { label: "Over Budget", value: metrics.over_budget_projects, cls: "bg-red-100 text-red-700" },
                  ].map((item) => (
                    <span key={item.label} className={`px-2 py-1 rounded-full text-[11px] font-semibold ${item.cls}`}>
                      {item.label}: {fmt(item.value)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {!loading && <ReportCommentary commentary={commentary} />}

      </main>
    </ReportsLayout>
  );
}
