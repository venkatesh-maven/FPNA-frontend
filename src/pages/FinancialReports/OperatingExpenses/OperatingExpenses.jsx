import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { AuthContext } from "../../../context/AuthContext";
import { API_BASE_URL } from "../../../config/config";
import { cachedFetch } from "../../../utils/reportCache";
import ReportsLayout from "../ReportsLayout";
import AIActionsMenu from "../AIActionsMenu";
import ActionHoverLabel from "../ActionHoverLabel";
import ReportCommentary from "../ReportCommentary";
import useReportCommentary from "../../../hooks/useReportCommentary";
import { buildReportAIContext, rankForAI, toNumberForAI } from "../reportAIContext";
import AddAutomation from "../AddAutomation";
import TableSkeleton from "../../Skeleton/TableSkeleton";
import PnLOperatingExpenseDrilldown from "../pnl/PnLOperatingExpenseDrilldown";

import {
  FiFilter,
  FiTrendingUp,
  FiTrendingDown,
  FiPrinter,
} from "react-icons/fi";

import ExportMenu from "../ExportMenu";
import { collectCommentary, commentaryCount, csvWithCommentary, downloadCsv } from "../reportExport";
import { motion, AnimatePresence } from "framer-motion";
import { FaArrowRightToBracket } from "react-icons/fa6";
import { Link } from "react-router-dom";
import { getDecimalPrecision } from '../../../utils/formatters';

/* ================== CONSTANTS ================== */
const TIME_FILTERS = [
  { id: "all_periods", name: "All Periods" },
  { id: "current_month", name: "Current Month" },
  { id: "last_month", name: "Last Month" },
  { id: "quarter_to_date", name: "Quarter to Date" },
  { id: "year_to_date", name: "Year to Date" },
];

const TABLE_COLUMNS = [
  "account_name",
  "actual_operating_expense",
  "budget_operating_expense",
  "variance",
];

const PERIOD_MEASURES = [
  { key: "actual_operating_expense", label: "Actual" },
  { key: "budget_operating_expense", label: "Budget" },
  { key: "variance", label: "Variance" },
];

const SORT_BY_OPTIONS = [
  { id: "account_name", label: "Account Name" },
  { id: "actual_operating_expense", label: "Actual" },
  { id: "budget_operating_expense", label: "Budget" },
  { id: "variance", label: "Variance" },
];

const SORT_ORDER_OPTIONS = [
  { id: "asc", label: "Ascending ↑" },
  { id: "desc", label: "Descending ↓" },
];

/* ── Analytical narrative builder ──
   Deep, data-driven analysis per expense line (budget performance + month-
   to-month consistency) and a portfolio-level overrun read for the
   executive summary. Everything is computed from the real numbers. */
const _oeNum = (v) => {
  if (typeof v === "string") {
    const n = Number(v.replace(/[$,%\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return Number(v) || 0;
};

const _oeFmt = (v) => {
  const dp = getDecimalPrecision();
  return `$${_oeNum(v).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
};

const _oeStats = (arr) => {
  const n = arr.length;
  const mean = n ? arr.reduce((a, b) => a + b, 0) / n : 0;
  const variance = n ? arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n : 0;
  return { cv: mean !== 0 ? (Math.sqrt(variance) / Math.abs(mean)) * 100 : 0 };
};

const buildOpexAccountInsight = (row, periods) => {
  const months = row?.months || {};
  const vals = (periods || []).map((p) => _oeNum(months[p]?.actual_operating_expense));
  const nonZero = vals.filter((v) => v !== 0).length;
  const totalActual = _oeNum(row?.total?.actual_operating_expense);
  const totalBudget = _oeNum(row?.total?.budget_operating_expense);
  if (!totalActual && !totalBudget) return "—";

  const budgetClause = totalBudget
    ? (() => {
        const variancePct = ((totalActual - totalBudget) / totalBudget) * 100;
        if (Math.abs(variancePct) < 5) return `tracking close to its budget`;
        return variancePct > 0
          ? `running ${variancePct.toFixed(0)}% over its budget`
          : `running ${Math.abs(variancePct).toFixed(0)}% under its budget`;
      })()
    : `showing no budget set for comparison, so it can't be judged over or under plan`;

  let trendClause = "";
  if (nonZero >= 3) {
    const stats = _oeStats(vals);
    if (stats.cv >= 30) trendClause = " Spending was uneven month to month rather than a steady run rate.";
  }

  return `${row.account_name} is ${budgetClause}.${trendClause}`;
};

const OE_NOT_ENOUGH_DATA = ["Not enough expense lines in this selection to analyze overrun patterns - widen the filters for a deeper read."];

const buildOpexExecutive = (allRows) => {
  const real = (allRows || []).filter((r) => r?.account_name);
  if (!real.length) return OE_NOT_ENOUGH_DATA;

  const totalActual = real.reduce((s, r) => s + _oeNum(r?.total?.actual_operating_expense), 0);
  const totalBudget = real.reduce((s, r) => s + _oeNum(r?.total?.budget_operating_expense), 0);
  if (!totalActual && !totalBudget) return OE_NOT_ENOUGH_DATA;

  const overBudget = real.filter((r) => {
    const a = _oeNum(r?.total?.actual_operating_expense);
    const b = _oeNum(r?.total?.budget_operating_expense);
    return b > 0 && a > b;
  });
  const sortedByOverrun = [...overBudget].sort((a, b) =>
    (_oeNum(b?.total?.actual_operating_expense) - _oeNum(b?.total?.budget_operating_expense)) -
    (_oeNum(a?.total?.actual_operating_expense) - _oeNum(a?.total?.budget_operating_expense))
  );
  const biggest = sortedByOverrun[0];
  const overallVariancePct = totalBudget ? ((totalActual - totalBudget) / totalBudget) * 100 : null;

  const overrunSum = overBudget.reduce((s, r) => s + (_oeNum(r.total.actual_operating_expense) - _oeNum(r.total.budget_operating_expense)), 0);
  const biggestDelta = biggest ? _oeNum(biggest.total.actual_operating_expense) - _oeNum(biggest.total.budget_operating_expense) : 0;
  const biggestSharePct = overrunSum ? (biggestDelta / overrunSum) * 100 : 0;
  const biggestBudget = biggest ? _oeNum(biggest.total.budget_operating_expense) : 0;
  const biggestVariancePct = biggest && biggestBudget ? (biggestDelta / biggestBudget) * 100 : null;

  const para1 = `Operating expense came in ${overallVariancePct !== null ? `${overallVariancePct >= 0 ? "+" : ""}${overallVariancePct.toFixed(1)}% versus budget overall` : "with no aggregate budget set for comparison"}, with ${overBudget.length} of ${real.length} expense lines running over their individual budgets.`;
  const para2 = biggest
    ? `The largest single overrun is ${biggest.account_name}${biggestVariancePct !== null ? `, running ${biggestVariancePct.toFixed(0)}% over its own budget` : ""} - it alone accounts for ${biggestSharePct.toFixed(0)}% of the total dollar overrun across all over-budget lines, making it the first place to look for savings or a budget reset.`
    : `No individual expense line shows a material overrun - spending discipline looks consistent across categories.`;

  return [para1, para2];
};

/* ================== COMPONENT ================== */
export default function OperatingExpensesPage() {
  const { token, selectedYear: year, selectedCurrency } =
    useContext(AuthContext);

  const [rows, setRows] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [grandTotal, setGrandTotal] = useState(null);
  const opexExecutive = useMemo(() => buildOpexExecutive(rows), [rows]);
  const [metrics, setMetrics] = useState(null);

  const [entities, setEntities] = useState([{ id: null, name: "All" }]);
  const [departments, setDepartments] = useState([{ id: null, name: "All" }]);
  const [costCenters, setCostCenters] = useState([{ id: null, name: "All" }]);
  const [vendors, setVendors] = useState([{ id: null, name: "All" }]);


  const [filters, setFilters] = useState({
  time_filter: "all_periods",
  entity: null,
  department: null,
  cost_center: null,
  vendor: null,
  show_period: true,
  show_entity: false,
  show_department: false,
  show_cost_center: false,
  show_vendor: false,
});

const [draftFilters, setDraftFilters] = useState(filters);

  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({ sort_by: "account_name", sort_order: "asc" });
  const ref = useRef(null);
  const sortRef = useRef(null);

  /* ================== DRILLDOWN ================== */
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillPeriod, setDrillPeriod] = useState(null);
  const [drillAccount, setDrillAccount] = useState(null);

  const openDrill = (period, accountName) => {
    setDrillPeriod(period);
    setDrillAccount(accountName || null);
    setDrillOpen(true);
  };

  /* ================== CLOSE DROPDOWN ================== */
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

  /* ================== FETCH ================== */
  useEffect(() => {
    if (!token || !year || !selectedCurrency) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.append("currency_filter", "actualvalue");

        if (filters.time_filter !== "all_periods")
          params.append("time_filter", filters.time_filter);
        if (filters.entity) params.append("entity", filters.entity);
        if (filters.department) params.append("department", filters.department);
        if (filters.cost_center)
          params.append("cost_center", filters.cost_center);
        if (filters.vendor) params.append("vendor", filters.vendor);
        params.append("show_period", String(Boolean(filters.show_period)));
        params.append("show_entity", String(Boolean(filters.show_entity)));
        params.append("show_department", String(Boolean(filters.show_department)));
        params.append("show_cost_center", String(Boolean(filters.show_cost_center)));
        params.append("show_vendor", String(Boolean(filters.show_vendor)));

        const api = await cachedFetch(
          `${API_BASE_URL}/api/v1/company/financial/operating_enpense_report/${year}/${selectedCurrency}?${params}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        processResponse(api);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, year, selectedCurrency, filters]);

  /* ================== PROCESS RESPONSE ================== */
  const processResponse = (api) => {
    if (typeof api === "string" || api?.message) {
      setRows([]);
      setPeriods([]);
      setGrandTotal(null);
      setMetrics(null);
      return;
    }

    if (Array.isArray(api)) {
      setRows(api.filter((i) => i.period));
      setPeriods([...new Set(api.map((i) => i.period).filter(Boolean))]);
      setGrandTotal(null);
      setMetrics(api.find((i) => i.keymetrics)?.keymetrics || null);

      setEntities([
        { id: null, name: "All" },
        ...(api.find((i) => i.entities)?.entities || []).map((e) => ({
          id: e.entity_id,
          name: e.entity_name,
        })),
      ]);

      setDepartments([
        { id: null, name: "All" },
        ...(api.find((i) => i.departments)?.departments || []).map((d) => ({
          id: d.department_id,
          name: d.department_name,
        })),
      ]);

      setCostCenters([
        { id: null, name: "All" },
        ...(api.find((i) => i.costcenters)?.costcenters || []).map((c) => ({
          id: c.cost_center_id,
          name: c.name,
        })),
      ]);

      setVendors([
        { id: null, name: "All" },
        ...(api.find((i) => i.vendors)?.vendors || []).map((v) => ({
          id: v.vendor_id,
          name: v.vendor_name,
        })),
      ]);
      return;
    }

    const expenses = Array.isArray(api?.expenses) ? api.expenses : [];
    const normalizedRows = expenses.map((item) => ({
      ...item,
      actual_operating_expense: item.total?.actual_operating_expense ?? 0,
      budget_operating_expense: item.total?.budget_operating_expense ?? 0,
      variance: item.total?.variance ?? 0,
    }));

    setRows(normalizedRows);
    setPeriods(Array.isArray(api?.periods) ? api.periods : []);
    setGrandTotal(api?.grand_total || null);
    setMetrics(api?.keymetrics || null);

    setEntities([
      { id: null, name: "All" },
      ...(api?.entities || []).map((e) => ({
        id: e.entity_id,
        name: e.entity_name,
      })),
    ]);

    setDepartments([
      { id: null, name: "All" },
      ...(api?.departments || []).map((d) => ({
        id: d.department_id,
        name: d.department_name,
      })),
    ]);

    setCostCenters([
      { id: null, name: "All" },
      ...(api?.costcenters || []).map((c) => ({
        id: c.cost_center_id,
        name: c.name,
      })),
    ]);

    setVendors([
      { id: null, name: "All" },
      ...(api?.vendors || []).map((v) => ({
        id: v.vendor_id,
        name: v.vendor_name,
      })),
    ]);
  };

  /* ================== HELPERS ================== */
  const money = (v) => {
    if (v === null || v === undefined || v === "") return "--";
    if (typeof v === "string" && /[KMB$]/i.test(v)) return v;
    const cleaned = typeof v === "string" ? v.replace(/,/g, "") : v;
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return "--";
    return `$${n.toLocaleString(undefined, {
      minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision(),
    })}`;
  };

  const getNameById = (list, id) =>
    list.find((i) => i.id === id)?.name;

  /* ================== ACTIVE FILTER TAGS ================== */
  const activeTags = [
    filters.time_filter !== "all_periods" &&
      TIME_FILTERS.find((t) => t.id === filters.time_filter)?.name,
    filters.entity && getNameById(entities, filters.entity),
    filters.department && getNameById(departments, filters.department),
    filters.cost_center && getNameById(costCenters, filters.cost_center),
    filters.vendor && getNameById(vendors, filters.vendor),
  ].filter(Boolean);

  const removeFilter = (tag) => {
    setFilters((f) => ({
      time_filter:
        TIME_FILTERS.find((t) => t.name === tag)?.id || f.time_filter,
      entity: getNameById(entities, f.entity) === tag ? null : f.entity,
      department:
        getNameById(departments, f.department) === tag ? null : f.department,
      cost_center:
        getNameById(costCenters, f.cost_center) === tag
          ? null
          : f.cost_center,
      vendor: getNameById(vendors, f.vendor) === tag ? null : f.vendor,
      show_period: f.show_period,
      show_entity: f.show_entity,
      show_department: f.show_department,
      show_cost_center: f.show_cost_center,
      show_vendor: f.show_vendor,
    }));
  };

  const periodRows = useMemo(
    () => rows.filter((r) => r?.months && Object.keys(r.months).length > 0),
    [rows]
  );

  const dynamicTableColumns = useMemo(() => {
    const dimCols = [
      filters.show_entity && "entity_name",
      filters.show_department && "department_name",
      filters.show_cost_center && "cost_center_name",
      filters.show_vendor && "vendor_name",
    ].filter(Boolean);
    return ["account_name", ...dimCols, "actual_operating_expense", "budget_operating_expense", "variance"];
  }, [filters.show_entity, filters.show_department, filters.show_cost_center, filters.show_vendor]);

  const sortedRows = useMemo(() => {
    if (!rows.length) return rows;
    const { sort_by, sort_order } = sortConfig;
    return [...rows].sort((a, b) => {
      const av = sort_by === "account_name" ? (a[sort_by] || "") : (Number(a[sort_by]) || 0);
      const bv = sort_by === "account_name" ? (b[sort_by] || "") : (Number(b[sort_by]) || 0);
      if (av < bv) return sort_order === "asc" ? -1 : 1;
      if (av > bv) return sort_order === "asc" ? 1 : -1;
      return 0;
    });
  }, [rows, sortConfig]);

  const sortedPeriodRows = useMemo(() => {
    if (!periodRows.length) return periodRows;
    const { sort_by, sort_order } = sortConfig;
    return [...periodRows].sort((a, b) => {
      let av, bv;
      if (sort_by === "account_name") {
        av = a[sort_by] || "";
        bv = b[sort_by] || "";
      } else {
        av = Number(a.total?.[sort_by] ?? a[sort_by]) || 0;
        bv = Number(b.total?.[sort_by] ?? b[sort_by]) || 0;
      }
      if (av < bv) return sort_order === "asc" ? -1 : 1;
      if (av > bv) return sort_order === "asc" ? 1 : -1;
      return 0;
    });
  }, [periodRows, sortConfig]);

  /* ================== CSV (mirrors whichever table is currently
     rendered — the dimension-breakdown table when "Show Period Columns"
     is off, the period-breakdown table (incl. Grand Total row) when it's
     on) ================== */
  const csvData = useMemo(() => {
    if (periodRows.length === 0) {
      const header = dynamicTableColumns;
      const body = sortedRows.map((r) => header.map((c) => r[c] ?? ""));
      return [header, ...body];
    }

    const header = [
      "account_name",
      ...periods.flatMap((p) => PERIOD_MEASURES.map((m) => `${p} ${m.label}`)),
      ...PERIOD_MEASURES.map((m) => `Total ${m.label}`),
    ];
    const body = sortedPeriodRows.map((r) => [
      r.account_name,
      ...periods.flatMap((p) => PERIOD_MEASURES.map((m) => r.months?.[p]?.[m.key] ?? "")),
      ...PERIOD_MEASURES.map((m) => r.total?.[m.key] ?? r[m.key] ?? ""),
    ]);
    if (grandTotal?.total) {
      body.push([
        "Grand Total",
        ...periods.flatMap((p) => PERIOD_MEASURES.map((m) => grandTotal.months?.[p]?.[m.key] ?? "")),
        ...PERIOD_MEASURES.map((m) => grandTotal.total?.[m.key] ?? ""),
      ]);
    }
    return [header, ...body];
  }, [periodRows, dynamicTableColumns, sortedRows, sortedPeriodRows, periods, grandTotal]);

  // Same param names the fetch above sends, so a scheduled send reproduces
  // this exact filtered view.
  const scheduleFilters = useMemo(() => ({
    currency_filter: "actualvalue",
    ...(filters.time_filter !== "all_periods" && { time_filter: filters.time_filter }),
    ...(filters.entity && { entity: filters.entity }),
    ...(filters.department && { department: filters.department }),
    ...(filters.cost_center && { cost_center: filters.cost_center }),
    ...(filters.vendor && { vendor: filters.vendor }),
    show_period: String(Boolean(filters.show_period)),
    show_entity: String(Boolean(filters.show_entity)),
    show_department: String(Boolean(filters.show_department)),
    show_cost_center: String(Boolean(filters.show_cost_center)),
    show_vendor: String(Boolean(filters.show_vendor)),
  }), [filters]);

  /* ================== AI INSIGHTS / COMMENTARY ================== */
  // The filters that select the data; the show_* toggles only change how the
  // same data is broken down (they're part of viewKey below).
  const commentaryFilters = {
    time_filter: filters.time_filter,
    entity: filters.entity,
    department: filters.department,
    cost_center: filters.cost_center,
    vendor: filters.vendor,
  };

  const commentary = useReportCommentary({
    token,
    reportId: "operating_expenses",
    year,
    currency: selectedCurrency,
    filters: commentaryFilters,
  });

  const insightFilterLabels = useMemo(() => {
    const nameOf = (list, id) => list.find((i) => String(i.id) === String(id))?.name || id;
    const splitBy = [
      filters.show_entity && "Entity",
      filters.show_department && "Department",
      filters.show_cost_center && "Cost Center",
      filters.show_vendor && "Vendor",
    ].filter(Boolean);
    return [
      filters.time_filter !== "all_periods" &&
        `Period: ${TIME_FILTERS.find((t) => t.id === filters.time_filter)?.name || filters.time_filter}`,
      filters.entity && `Entity: ${nameOf(entities, filters.entity)}`,
      filters.department && `Department: ${nameOf(departments, filters.department)}`,
      filters.cost_center && `Cost Center: ${nameOf(costCenters, filters.cost_center)}`,
      filters.vendor && `Vendor: ${nameOf(vendors, filters.vendor)}`,
      splitBy.length > 0 && `Split by: ${splitBy.join(", ")}`,
    ].filter(Boolean);
  }, [filters, entities, departments, costCenters, vendors]);

  const viewKey = `${year}|${selectedCurrency}|${JSON.stringify(filters)}`;

  const buildInsightsContext = () => {
    if (!rows.length) return "";

    // "2025-03" -> "Mar 2025"
    const monthLabel = (p) => {
      const m = /^(\d{4})-(\d{1,2})/.exec(String(p || ""));
      return m
        ? new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleString("en-US", { month: "short", year: "numeric" })
        : p;
    };
    const lineLabel = (r) => {
      const dims = [
        r.entity_name && `Entity: ${r.entity_name}`,
        r.department_name && `Department: ${r.department_name}`,
        r.cost_center_name && `Cost Center: ${r.cost_center_name}`,
        r.vendor_name && `Vendor: ${r.vendor_name}`,
      ].filter(Boolean);
      return `${r.account_name || "--"}${dims.length ? ` (${dims.join("; ")})` : ""}`;
    };

    // Largest spend first, so a long list is trimmed from the smallest lines.
    const lines = rows
      .map((r) => {
        const t = r.total || r;
        const monthlyActual = {};
        periods.forEach((p) => {
          const v = r.months?.[p]?.actual_operating_expense;
          if (v !== undefined && v !== null) monthlyActual[monthLabel(p)] = v;
        });
        return {
          line: lineLabel(r),
          actual: t.actual_operating_expense,
          budget: t.budget_operating_expense,
          variance: t.variance,
          monthly_actual: monthlyActual,
        };
      })
      .sort((a, b) => (toNumberForAI(b.actual) ?? 0) - (toNumberForAI(a.actual) ?? 0));

    const gtMonths = periods.filter((p) => grandTotal?.months?.[p]);
    const grandRow = grandTotal?.total && {
      line: "Grand Total (all lines shown)",
      actual: grandTotal.total.actual_operating_expense,
      budget: grandTotal.total.budget_operating_expense,
      variance: grandTotal.total.variance,
      monthly: Object.fromEntries(
        gtMonths.map((p) => {
          const m = grandTotal.months[p];
          return [
            monthLabel(p),
            { actual: m.actual_operating_expense, budget: m.budget_operating_expense, variance: m.variance },
          ];
        }),
      ),
    };

    const varianceOf = (l) => toNumberForAI(l.variance) ?? 0;
    const facts = {
      top_lines_by_actual: rankForAI(lines, (l) => l.actual, (l) => l.line, 5)?.highest,
      most_over_budget: rankForAI(lines.filter((l) => varianceOf(l) > 0), (l) => l.variance, (l) => l.line)?.highest,
      most_under_budget: rankForAI(lines.filter((l) => varianceOf(l) < 0), (l) => l.variance, (l) => l.line)?.lowest,
      total_actual_by_month:
        gtMonths.length > 1
          ? rankForAI(gtMonths, (p) => grandTotal.months[p].actual_operating_expense, monthLabel)
          : undefined,
    };

    return buildReportAIContext({
      valueScale: "Actual",
      notes: [
        "All lines are operating expenses (costs); actual is the net amount posted to the expense account.",
        "Variance = actual - budget, so a positive variance means spending above budget (unfavorable) and a negative variance means under budget (favorable).",
        filters.show_vendor &&
          "Budgets are not tracked per vendor, so vendor rows show actual spend only; the Grand Total row compares all spend with budget.",
        filters.vendor &&
          "Because budgets are not tracked per vendor, with the vendor filter applied the budget is the whole account budget, so variance compares this vendor's spend with the full account budget.",
      ]
        .filter(Boolean)
        .join(" "),
      keyMetrics: metrics && {
        total_budget: metrics.total_budget,
        total_actual: metrics.total_actual,
        total_variance: metrics.total_variance,
        // Counted per account per month, not per account.
        account_months_under_budget: metrics.favorable_categories,
        account_months_over_budget: metrics.unfavorable_categories,
      },
      facts,
      rows: grandRow ? [grandRow, ...lines] : lines,
    });
  };

  // The commentary shown under the report, offered with the CSV download.
  const exportCommentary = collectCommentary({ reportItems: commentary.items });

  /* ================== UI ================== */
  return (
   <ReportsLayout>
      <main className="flex-1 min-w-0 bg-white p-3 rounded-xl shadow-md">
        {/* HEADER */}
       





        <div className="flex justify-between items-center gap-3 mb-2">
          <div>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h2 className="text-lg font-semibold text-sky-900">
                Operating Expenses
              </h2>
              <p className="text-s text-sky-600">
                Actual vs budget expense analysis
              </p>
            </div>
            {periodRows.length > 0 && (
              <p className="text-s bg-yellow-100 text-sky-900 px-2 py-0.5 rounded-md mt-1 inline-block">
                <strong>Note :</strong> Click on any <strong>ACTUAL VALUE</strong> to view detailed drilldown insights
              </p>
            )}
          </div>
          <Link
            to="/operating-expenses-report-dashboard"
            className="flex shrink-0 items-center whitespace-nowrap py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg hover:bg-white hover:text-sky-900 transition border border-sky-900"
          >
            View More <FaArrowRightToBracket className="ml-1" />
          </Link>
        </div>






        










        {/* FILTER BAR (P&L STYLE) */}
       {/* ================= FILTER BAR ================= */}

<div className="mb-3 flex items-start justify-between gap-3 flex-wrap" ref={ref}>

  {/* ACTIVE FILTER TAGS */}

  <div className="flex flex-wrap gap-2 min-h-[34px]">

    {activeTags.map((tag) => (
      <span
        key={tag}
        className="flex items-center gap-2 px-3 py-1 text-x rounded-full bg-sky-800 text-white"
      >
        {tag}

        <button
          onClick={() => removeFilter(tag)}
          className="text-white/70 hover:text-white"
        >
          ✕
        </button>
      </span>
    ))}

  </div>


  {/* RIGHT ACTIONS */}

  <div className="flex items-center gap-2">

    {/* FILTER BUTTON */}

    <div className="relative">

      <button
        onClick={() => {
  setDraftFilters(filters);
  setOpen(!open);
}}
        aria-label="Filters"
        className="relative group flex items-center px-3 py-2.5 text-x font-medium rounded-lg border transition bg-sky-100 border-sky-200 text-sky-800 hover:bg-sky-200"
      >
        <FiFilter size={14}/>
        <ActionHoverLabel>Filters</ActionHoverLabel>
      </button>

      <AnimatePresence>

        {open && (

          <motion.div
            initial={{opacity:0,y:8}}
            animate={{opacity:1,y:0}}
            exit={{opacity:0,y:-6}}
            transition={{duration:0.15}}
            className="absolute right-0 mt-2 w-72 z-50 bg-sky-50 border border-sky-200 rounded-xl shadow-xl"
          >

            <div className="p-4 space-y-3 text-x">

              {/* PERIOD */}

              <Select
  label="Period"
  value={draftFilters.time_filter}
  options={TIME_FILTERS.map(t => ({
    id: t.id,
    name: t.name
  }))}
  onChange={(v) =>
    setDraftFilters(f => ({ ...f, time_filter: v }))
  }
/>

              {/* ENTITY */}

              <Select
  label="Entity"
  value={draftFilters.entity}
  options={entities}
  onChange={(v) =>
    setDraftFilters(f => ({ ...f, entity: v }))
  }
/>

<Select
  label="Department"
  value={draftFilters.department}
  options={departments}
  onChange={(v) =>
    setDraftFilters(f => ({ ...f, department: v }))
  }
/>

<Select
  label="Cost Center"
  value={draftFilters.cost_center}
  options={costCenters}
  onChange={(v) =>
    setDraftFilters(f => ({ ...f, cost_center: v }))
  }
/>

<Select
  label="Vendor"
  value={draftFilters.vendor}
  options={vendors}
  onChange={(v) =>
    setDraftFilters(f => ({ ...f, vendor: v }))
  }
/>

            </div>

            {/* ACTION BUTTONS */}

            <div className="flex gap-2 px-4 pb-4">

              {/* CANCEL */}

              <button
                 onClick={() => {
    setDraftFilters(filters);
    setOpen(false);
  }}
                className="flex-1 py-2 text-x bg-white border border-sky-200 text-sky-900 rounded-lg hover:bg-sky-100"
              >
                Cancel
              </button>

              {/* RESET */}

              <button
                onClick={() =>
    setDraftFilters({
      time_filter: "all_periods",
      entity: null,
      department: null,
      cost_center: null,
      vendor: null,
      show_period: true,
      show_entity: false,
      show_department: false,
      show_cost_center: false,
      show_vendor: false
    })
  }
                className="flex-1 py-2 text-x bg-sky-200 text-sky-900 rounded-lg hover:bg-sky-300"
              >
                Reset
              </button>

              {/* APPLY */}

              <button
                 onClick={() => {
    setFilters(draftFilters);
    setOpen(false);
  }}
                className="flex-1 py-2 text-x rounded-lg bg-sky-900 text-white hover:bg-sky-800"
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
        downloadCsv(csvWithCommentary(csvData, exportCommentary, include), `Operating_Expenses_${year}.csv`)
      }
      className="relative group flex items-center px-3 py-2.5 text-x bg-sky-100 text-sky-800 rounded-lg border border-sky-200 hover:bg-sky-200"
    />

    <AddAutomation
      reportType="operating_expense"
      reportLabel="Operating Expense Report"
      year={year}
      currency={selectedCurrency}
      filters={scheduleFilters}
      iconOnly
    />

    {/* PRINT */}

    <button
      onClick={()=>window.print()}
      aria-label="Print"
      className="relative group flex items-center px-3 py-2.5 text-x bg-sky-100 text-sky-800 rounded-lg border border-sky-200 hover:bg-sky-200"
    >
      <FiPrinter/>
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
        {sortConfig.sort_by !== "account_name" || sortConfig.sort_order !== "asc" ? (
          <span className="ml-1 text-xs font-bold">
            {sortConfig.sort_order === "asc" ? "↑" : "↓"}
          </span>
        ) : null}
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
                onClick={() => setSortConfig({ sort_by: "account_name", sort_order: "asc" })}
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


    {/* REPORT AI */}

    <span className="h-6 w-px bg-sky-200" aria-hidden="true" />

    <AIActionsMenu
      reportId="operating_expenses"
      insights={{
        commentary,
        reportLabel: "Operating Expenses",
        filterLabels: insightFilterLabels,
        viewKey,
        buildContext: buildInsightsContext,
        disabled: loading || !rows.length,
      }}
    />

  </div>

</div>

        {/* COLUMN TOGGLE CHECKBOXES */}
        <div className="mb-2 flex flex-wrap items-center gap-4 border-y border-sky-200 bg-sky-50 px-3 py-1 shadow-sm">
          {[
            { key: "show_entity", label: "Entity" },
            { key: "show_department", label: "Department" },
            { key: "show_cost_center", label: "Cost Center" },
            { key: "show_vendor", label: "Vendor" },
          ].map((item) => (
            <label key={item.key} className="inline-flex items-center gap-2 text-s font-medium text-sky-800">
              <input
                type="checkbox"
                checked={Boolean(filters[item.key])}
                onChange={(e) => {
                  const next = { ...filters, [item.key]: e.target.checked };
                  setFilters(next);
                  setDraftFilters(next);
                }}
                className="h-3.5 w-3.5 rounded border-sky-300 text-sky-800 focus:ring-sky-500"
              />
              {item.label}
            </label>
          ))}
          <span className="h-6 border-l border-sky-300" />
          <label className="inline-flex items-center gap-2 text-s font-medium text-sky-800">
            <input
              type="checkbox"
              checked={Boolean(filters.show_period)}
              onChange={(e) => {
                const next = { ...filters, show_period: e.target.checked };
                setFilters(next);
                setDraftFilters(next);
              }}
              className="h-3.5 w-3.5 rounded border-sky-300 text-sky-800 focus:ring-sky-500"
            />
            Show Period Columns
          </label>
        </div>
        {/* TABLE */}
        {loading && <TableSkeleton />}
        {!loading && rows.length === 0 && (
  <div className="h-[420px] flex items-center justify-center border rounded-xl bg-sky-50 text-sky-600">
    No operating expense data available for the selected period & currency.
  </div>
)}

        {!loading && rows.length > 0 && periodRows.length === 0 && (
  <div className="report-table-scroll overflow-auto mt-2 max-h-[440px] border border-sky-200 rounded-lg bg-white">
            <table className="min-w-[1100px] w-full text-x text-sky-900">
              <thead className="sticky top-0 bg-sky-900 text-white z-10">
                <tr>
                  {dynamicTableColumns.map((c) => (
                    <th key={c} className="px-3 py-1.5 text-left font-semibold whitespace-nowrap">
                      {c.replace(/_/g, " ").toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r, i) => (
                  <tr key={i} className="border-b border-sky-50 hover:bg-sky-50 transition-colors">
                    {dynamicTableColumns.map((c) => (
                      <td key={c} className="px-3 py-2.5">
                        {typeof r[c] === "number" ? money(r[c]) : r[c] || "--"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && sortedPeriodRows.length > 0 && (
  <div className="report-table-scroll overflow-auto mt-2 max-h-[440px] border border-sky-200 rounded-lg bg-white">
            <table
              className="w-full text-x text-sky-900"
              style={{ minWidth: `${260 + periods.length * 300 + 260}px` }}
            >
              <thead className="sticky top-0 bg-sky-900 text-white z-10">
                <tr>
                  <th rowSpan={2} className="px-3 py-1.5 text-left font-semibold whitespace-nowrap border-r border-white/20">
                    ACCOUNT NAME
                  </th>
                  {filters.show_entity && (
                    <th rowSpan={2} className="px-3 py-1.5 text-left font-semibold whitespace-nowrap border-r border-white/20">
                      ENTITY
                    </th>
                  )}
                  {filters.show_department && (
                    <th rowSpan={2} className="px-3 py-1.5 text-left font-semibold whitespace-nowrap border-r border-white/20">
                      DEPARTMENT
                    </th>
                  )}
                  {filters.show_cost_center && (
                    <th rowSpan={2} className="px-3 py-1.5 text-left font-semibold whitespace-nowrap border-r border-white/20">
                      COST CENTER
                    </th>
                  )}
                  {filters.show_vendor && (
                    <th rowSpan={2} className="px-3 py-1.5 text-left font-semibold whitespace-nowrap border-r border-white/20">
                      VENDOR
                    </th>
                  )}
                  {periods.map((period) => (
                    <th key={period} colSpan={3} className="px-3 py-1.5 text-center font-semibold whitespace-nowrap border-l border-white/20">
                      {period}
                    </th>
                  ))}
                  <th colSpan={3} className="px-3 py-1.5 text-center font-semibold whitespace-nowrap border-l border-white/20 bg-sky-950">
                    TOTAL
                  </th>
                  <th rowSpan={2} className="px-3 py-1.5 text-left font-semibold whitespace-nowrap border-l border-white/20">
                    Insights
                  </th>
                </tr>
                <tr className="bg-sky-800 text-white">
                  {[...periods, "total"].map((period) =>
                    PERIOD_MEASURES.map((measure) => (
                      <th
                        key={`${period}-${measure.key}`}
                        className={`px-3 py-1 text-right font-semibold whitespace-nowrap border-l border-white/20 ${period === "total" ? "bg-sky-950" : ""}`}
                      >
                        {measure.label.toUpperCase()}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {sortedPeriodRows.map((r, i) => (
                  <tr key={i} className="border-b border-sky-50 hover:bg-sky-50 transition-colors">
                    <td className="px-3 py-2.5 font-medium whitespace-nowrap border-r border-sky-100">
                      {r.account_name || "--"}
                    </td>
                    {filters.show_entity && (
                      <td className="px-3 py-2.5 whitespace-nowrap border-r border-sky-100">
                        {r.entity_name || "--"}
                      </td>
                    )}
                    {filters.show_department && (
                      <td className="px-3 py-2.5 whitespace-nowrap border-r border-sky-100">
                        {r.department_name || "--"}
                      </td>
                    )}
                    {filters.show_cost_center && (
                      <td className="px-3 py-2.5 whitespace-nowrap border-r border-sky-100">
                        {r.cost_center_name || "--"}
                      </td>
                    )}
                    {filters.show_vendor && (
                      <td className="px-3 py-2.5 whitespace-nowrap border-r border-sky-100">
                        {r.vendor_name || "--"}
                      </td>
                    )}
                    {periods.map((period) =>
                      PERIOD_MEASURES.map((measure) => (
                        <td key={`${period}-${measure.key}`} className="px-3 py-2.5 text-right whitespace-nowrap border-l border-sky-100">
                          {measure.key === "actual_operating_expense" ? (
                            <button
                              onClick={() => openDrill(period, r.account_name)}
                              className="text-sky-900 border-white border-b hover:border-b hover:text-blue-500"
                              title="Open drilldown"
                            >
                              {money(r.months?.[period]?.[measure.key])}
                            </button>
                          ) : (
                            money(r.months?.[period]?.[measure.key])
                          )}
                        </td>
                      ))
                    )}
                    {PERIOD_MEASURES.map((measure) => (
                      <td key={`total-${measure.key}`} className="px-3 py-2.5 text-right whitespace-nowrap border-l border-sky-100 font-medium">
                        {money(r.total?.[measure.key] ?? r[measure.key])}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 whitespace-nowrap min-w-[420px] border-l border-sky-100 text-sky-700">
                      {buildOpexAccountInsight(r, periods)}
                    </td>
                  </tr>
                ))}
                {grandTotal?.total && (
                  <tr className="sticky bottom-0 bg-sky-50 border-t-2 border-sky-200 font-semibold text-sky-900">
                    <td className="px-3 py-2.5 whitespace-nowrap border-r border-sky-200">
                      Grand Total
                    </td>
                    {filters.show_entity && <td className="px-3 py-2.5 border-r border-sky-100" />}
                    {filters.show_department && <td className="px-3 py-2.5 border-r border-sky-100" />}
                    {filters.show_cost_center && <td className="px-3 py-2.5 border-r border-sky-100" />}
                    {filters.show_vendor && <td className="px-3 py-2.5 border-r border-sky-100" />}
                    {periods.map((period) =>
                      PERIOD_MEASURES.map((measure) => (
                        <td key={`grand-${period}-${measure.key}`} className="px-3 py-2.5 text-right whitespace-nowrap border-l border-sky-100">
                          {money(grandTotal.months?.[period]?.[measure.key])}
                        </td>
                      ))
                    )}
                    {PERIOD_MEASURES.map((measure) => (
                      <td key={`grand-total-${measure.key}`} className="px-3 py-2.5 text-right whitespace-nowrap border-l border-sky-100">
                        {money(grandTotal.total?.[measure.key])}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
{/* ================= KEY METRICS + AI INSIGHTS ================= */}
{metrics && (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className="mt-6 bg-white border border-sky-200 rounded-xl p-4 shadow-sm"
  >
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

      {/* LEFT : OPERATING EXPENSE METRICS */}
      <div className="md:col-span-2 space-y-3">
        <h3 className="text-s font-semibold text-sky-900">
          Key Operating Expense Metrics
        </h3>

        <MetricRow label="Total Budget" value={metrics.total_budget} />
        <MetricRow label="Total Actual" value={metrics.total_actual} />
        <MetricRow label="Total Variance" value={metrics.total_variance} />
      </div>

      {/* RIGHT : EXECUTIVE INSIGHT */}
      <div className="bg-sky-50 md:col-span-2 border border-sky-200 rounded-lg p-3 flex flex-col justify-center gap-2">
        <h4 className="text-x font-semibold text-sky-900 mb-1">
          Executive Financial Insight
        </h4>
        {opexExecutive.map((para, i) => (
          <p key={i} className="text-s text-sky-800 leading-relaxed">{para}</p>
        ))}
      </div>

    </div>
  </motion.div>
)}

        {!loading && <ReportCommentary commentary={commentary} />}

      </main>

      {/* ================= DRILL DRAWER ================= */}
      <PnLOperatingExpenseDrilldown
        open={drillOpen}
        onClose={() => setDrillOpen(false)}
        token={token}
        currency={selectedCurrency}
        currencySymbol="$"
        period={drillPeriod}
        accountName={drillAccount}
      />

    </ReportsLayout>
  );
}

/* ================== SMALL COMPONENTS ================== */
const Select = ({ label, value, options, onChange }) => (
  <div>
    <label className="block mb-1 text-sky-700">{label}</label>
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full border rounded p-2"
    >
      {options.map((o) => (
        <option key={o.id ?? "all"} value={o.id ?? ""}>
          {o.name}
        </option>
      ))}
    </select>
  </div>
);

const Metric = ({ label, value }) => {
  const num = Number(
    typeof value === "string" ? value.replace(/[$,]/g, "") : value
  );

  const valueColor =
    !isNaN(num) && num > 0
      ? "text-green-300"
      : !isNaN(num) && num < 0
      ? "text-red-300"
      : "text-sky-100";

  return (
    <div className="p-4 rounded-xl shadow-md bg-gradient-to-br from-sky-500 via-sky-600 to-blue-700">
      <p className="text-x font-semibold uppercase tracking-wide text-sky-100">
        {label}
      </p>
      <p className={`mt-2 text-xl font-bold ${valueColor}`}>
        ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
      </p>
    </div>
  );
};


const AIDriverText = ({ messages }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!messages || messages.length === 0) return;

    const t = setInterval(
      () => setIndex((i) => (i + 1) % messages.length),
      3000
    );

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
const MetricRow = ({ label, value }) => {
  const clean = typeof value === "string" ? value.replace(/[$,]/g, "") : value;
  const num = Number(clean);

  const color =
    !isNaN(num) && num > 0
      ? "text-green-600"
      : !isNaN(num) && num < 0
      ? "text-red-600"
      : "text-sky-900";

  return (
    <div className="flex justify-between text-s">
      <span className="text-sky-700">{label}</span>
      <span className={`font-medium ${color}`}>
        ${Number.isFinite(num) ? num.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }) : "0"}
      </span>
    </div>
  );
};
