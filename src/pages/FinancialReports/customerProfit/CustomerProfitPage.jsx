import React, { useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AuthContext } from "../../../context/AuthContext";
import { API_BASE_URL } from "../../../config/config";
import { cachedFetch } from "../../../utils/reportCache";
import ReportsLayout from "../ReportsLayout";
import TableSkeleton from "../../Skeleton/TableSkeleton";

import { FiFilter, FiPrinter } from "react-icons/fi";
import { FaArrowRightToBracket } from "react-icons/fa6";
import { BsStars, BsChatLeftText, BsChatLeftTextFill } from "react-icons/bs";
import { CSVLink } from "react-csv";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import AIActionsMenu from "../AIActionsMenu";
import ExportMenu from "../ExportMenu";
import { collectCommentary, commentaryCount, xlsxWithCommentary } from "../reportExport";
import ActionHoverLabel from "../ActionHoverLabel";
import ReportCommentary from "../ReportCommentary";
import { buildReportAIContext, compactForAI, rankForAI } from "../reportAIContext";
import useReportCommentary from "../../../hooks/useReportCommentary";
import LineItemRefineWithAI, { LineItemAIButton } from "../LineItemRefineWithAI";
import LineItemCommentary from "../LineItemCommentary";
import useLineItemCommentary from "../../../hooks/useLineItemCommentary";
import AnalyzeWithAI, { AnalyzeButton } from "../AnalyzeWithAI";
import AIHelpTooltip from "../AIHelpTooltip";
import AddAutomation from "../AddAutomation";
import CustomerProfitDrilldownDrawer from "./CustomerProfitDrilldownDrawer";
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
  { id: "actualvalue", label: "Actual"    },
  { id: "thousands",   label: "Thousands" },
  { id: "millions",    label: "Millions"  },
];

const COMPARISONS = [
  { id: "",               label: "No Comparison"  },
  { id: "month_on_month", label: "Month vs Month" },
  { id: "year_on_year",   label: "Year vs Year"   },
];

const SORT_BY_OPTIONS = [
  { id: "customer_name", label: "Customer Name" },
  { id: "industry",      label: "Industry"      },
  { id: "region",        label: "Region"        },
  { id: "revenue",       label: "Revenue"       },
  { id: "total_cost",    label: "Total Cost"    },
  { id: "profit",        label: "Profit"        },
  { id: "margin",        label: "Margin %"      },
];

const SORT_ORDER_OPTIONS = [
  { id: "asc",  label: "Ascending ↑"  },
  { id: "desc", label: "Descending ↓" },
];

/* column → API sort_by key */
const SORTABLE_COLS = {
  customer_name: "customer_name",
  industry:      "industry",
  region:        "region",
  revenue:       "revenue",
  total_cost:    "total_cost",
  profit:        "profit",
  pct_margin:    "margin",
};

const DEFAULT_FILTERS = {
  period:          "all",
  currency_filter: "actualvalue",
  comparison:      "",
  customer_name:   "",
  industry:        "",
  department_name: "",
  region:          "",
  entity_name:     "",
  sales_person_id: "",
  sort_by:         "profit",
  sort_order:      "desc",
  date_from:       "",
  date_to:         "",
};

/* ── Column toggle config (from HTML reference) ── */
const COLUMN_TOGGLES = [
  { flag: "show_industry",        key: "industry",        label: "Industry",   apiParam: "show_industry"        },
  { flag: "show_region",          key: "region",          label: "Region",     apiParam: "show_region"          },
  { flag: "show_entity_name",     key: "entity_name",     label: "Entity",     apiParam: "show_entity_name"     },
  { flag: "show_department_name", key: "department_name", label: "Department", apiParam: "show_department_name" },
];

const DEFAULT_COLUMN_TOGGLES = {
  show_industry:        false,
  show_region:          false,
  show_entity_name:     false,
  show_department_name: false,
};

/* Fixed left columns for comparison table */
const AFTER_LEFT_COLUMNS = [
  "customer_name",
  "industry",
  "region",
  "entity_name",
  "department_name",
];

const DUMMY_AI_MESSAGES = [
  "AI-powered insights coming soon",
  "AI enhances efficiency through automated financial analysis",
];

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */

const parseCompactNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;
    const cleaned = s.replace(/,/g, "");
    const m = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*([KMB])?$/i);
    if (!m) {
      const n = Number(cleaned.replace(/[^0-9.-]/g, ""));
      return Number.isFinite(n) ? n : null;
    }
    const num = Number(m[1]);
    if (!Number.isFinite(num)) return null;
    const suffix = (m[2] || "").toUpperCase();
    if (suffix === "K") return num * 1000;
    if (suffix === "M") return num * 1000000;
    if (suffix === "B") return num * 1000000000;
    return num;
  }
  return null;
};

const formatMoneySmart = (value) => {
  if (value === null || value === undefined || value === "") return "--";
  if (typeof value === "string" && /[KMB]\s*$/i.test(value.trim())) return value;
  const n = parseCompactNumber(value);
  if (n === null) return typeof value === "string" ? value : "--";
  const dp = getDecimalPrecision();
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
};

/* ── Analytical narrative builder ──
   Deep, data-driven analysis per customer (margin vs portfolio average,
   profit rank) and a portfolio-level margin/concentration read for the
   executive summary. Everything is computed from the real numbers. */
const _cpNum = (v) => parseCompactNumber(v) ?? 0;

const buildCustomerProfitInsights = (allRows) => {
  const map = new Map();
  const real = (allRows || []).filter((r) => r?.customer_name && r.customer_name !== "Grand Total");
  if (!real.length) return map;

  const totalRevenue = real.reduce((s, r) => s + _cpNum(r.revenue), 0);
  const totalProfit = real.reduce((s, r) => s + _cpNum(r.profit), 0);
  const avgMargin = totalRevenue ? (totalProfit / totalRevenue) * 100 : 0;
  const sortedByProfit = [...real].sort((a, b) => _cpNum(b.profit) - _cpNum(a.profit));
  const rankMap = new Map(sortedByProfit.map((r, i) => [r.customer_name, i + 1]));
  const n = real.length;

  for (const r of real) {
    const revenue = _cpNum(r.revenue);
    const profit = _cpNum(r.profit);
    const margin = _cpNum(r.pct_margin);
    if (!revenue && !profit) { map.set(r.customer_name, "—"); continue; }

    const rank = rankMap.get(r.customer_name);
    const marginGap = margin - avgMargin;
    const marginClause = Math.abs(marginGap) < 2
      ? `runs in line with the portfolio average margin`
      : marginGap > 0
      ? `runs ${marginGap.toFixed(1)} points above the portfolio average margin - a more profitable relationship than most`
      : `runs ${Math.abs(marginGap).toFixed(1)} points below the portfolio average margin - worth reviewing pricing or service cost for this account`;
    const rankClause = rank <= Math.max(1, Math.ceil(n * 0.1))
      ? `a top-10% profit contributor (rank ${rank} of ${n})`
      : rank >= Math.floor(n * 0.75)
      ? `one of the lower profit contributors (rank ${rank} of ${n})`
      : `a mid-tier profit contributor (rank ${rank} of ${n})`;

    map.set(r.customer_name, `${r.customer_name} ${marginClause}. It's ${rankClause}.`);
  }
  return map;
};

const CP_NOT_ENOUGH_DATA = ["Not enough customers in this selection to analyze the profit portfolio - widen the filters for a deeper read."];

const buildCustomerProfitExecutive = (allRows) => {
  const real = (allRows || []).filter((r) => r?.customer_name && r.customer_name !== "Grand Total");
  if (!real.length) return CP_NOT_ENOUGH_DATA;

  const totalRevenue = real.reduce((s, r) => s + _cpNum(r.revenue), 0);
  const totalProfit = real.reduce((s, r) => s + _cpNum(r.profit), 0);
  if (!totalRevenue) return CP_NOT_ENOUGH_DATA;
  const avgMargin = (totalProfit / totalRevenue) * 100;
  const negativeMarginCount = real.filter((r) => _cpNum(r.pct_margin) < 0).length;

  const sortedByProfit = [...real].sort((a, b) => _cpNum(b.profit) - _cpNum(a.profit));
  const n = sortedByProfit.length;
  const top10Count = Math.max(1, Math.round(n * 0.1));
  const top10ProfitSum = sortedByProfit.slice(0, top10Count).reduce((s, r) => s + _cpNum(r.profit), 0);
  const top10Pct = totalProfit ? (top10ProfitSum / totalProfit) * 100 : 0;

  const posRevenue = real.filter((r) => _cpNum(r.pct_margin) >= 0).reduce((s, r) => s + _cpNum(r.revenue), 0);
  const posProfit = real.filter((r) => _cpNum(r.pct_margin) >= 0).reduce((s, r) => s + _cpNum(r.profit), 0);
  const marginExLosses = posRevenue ? (posProfit / posRevenue) * 100 : avgMargin;
  const marginDragPts = marginExLosses - avgMargin;

  const margins = real.map((r) => _cpNum(r.pct_margin));
  const marginMean = margins.reduce((a, b) => a + b, 0) / (margins.length || 1);
  const marginSd = Math.sqrt(margins.reduce((a, b) => a + (b - marginMean) ** 2, 0) / (margins.length || 1));

  const para1 = negativeMarginCount > 0
    ? `${negativeMarginCount} of ${n} customer${negativeMarginCount !== 1 ? "s are" : " is"} running at a negative margin, losing money on every dollar of revenue from ${negativeMarginCount !== 1 ? "those accounts" : "that account"}. Excluding ${negativeMarginCount !== 1 ? "them" : "it"}, the portfolio's margin would run about ${marginDragPts.toFixed(1)} points higher - that's the direct drag from carrying loss-making relationships rather than a pricing problem across the whole base.`
    : marginSd < 0.05
    ? `Every customer in this selection runs at virtually the same margin - profitability here is a function of account size, not deal-by-deal pricing or cost differences.`
    : marginSd < 1
    ? `Every customer in this selection runs within about ${marginSd.toFixed(1)} points of the same margin - profitability here is a function of account size, not deal-by-deal pricing or cost differences.`
    : `Every customer contributes positive margin, but profitability still varies meaningfully across the base (~${marginSd.toFixed(1)} points of spread) - some relationships are structurally more profitable than others.`;
  const para2 = `The top ${top10Count} customer${top10Count !== 1 ? "s" : ""} by profit account for ${top10Pct.toFixed(0)}% of total profit${top10Pct >= 50 ? " - a concentration worth protecting through strong account management, since losing one of these relationships would disproportionately hurt profitability" : " - a reasonably even profit distribution across the customer base"}.${negativeMarginCount > 0 ? " The immediate opportunity is investigating why the loss-making accounts are unprofitable - pricing, service cost, or scope creep are the usual culprits." : ""}`;

  return [para1, para2];
};

const formatPct = (v) => {
  if (v === null || v === undefined || v === "") return "--";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return `${n.toFixed(getDecimalPrecision())}%`;
};

/** Compact currency for KPI cards — $1.23M, $456.7k, $123 */
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

const diffStyle = (diffVal) => {
  const n = Number(diffVal);
  if (!Number.isFinite(n) || n === 0) return { cellBg: "bg-slate-50", pill: "bg-slate-200 text-slate-800", arrow: "•" };
  if (n > 0) return { cellBg: "bg-green-50", pill: "bg-green-600 text-white", arrow: "▲" };
  return { cellBg: "bg-red-50", pill: "bg-red-600 text-white", arrow: "▼" };
};

const normalizeCustomers = (customers = [], comparison = "") =>
  customers.map((c) => {
    if (!comparison) return c;

    // The API nests each period's comparison under c.months[period].comparisons
    // - there's no top-level c.comparisons - so the single Current/Previous/
    // Variance summary shown when "Show Period Columns" is off is built here
    // by summing every visible period's current/compare figures, the same way
    // the backend's own Grand Total comparison row is built from per-period sums.
    const compMonths = Object.entries(c?.months || {})
      .map(([period, m]) => ({ period, comp: m?.comparisons }))
      .filter((x) => x.comp && x.comp.current_period);

    if (compMonths.length === 0) {
      return {
        ...c,
        period:                 null,
        prev_period:            null,
        prev_revenue:           null,
        prev_total_cost:        null,
        prev_profit:            null,
        pct_change_revenue:     null,
        pct_change_total_cost:  null,
        pct_change_profit:      null,
      };
    }

    const sum = (key) => compMonths.reduce((acc, x) => acc + (parseCompactNumber(x.comp[key]) || 0), 0);
    const curRevenue  = sum("current_revenue");
    const curCost     = sum("current_total_cost");
    const curProfit   = sum("current_profit");
    const prevRevenue = sum("compare_revenue");
    const prevCost    = sum("compare_total_cost");
    const prevProfit  = sum("compare_profit");
    const pctChange = (cur, prev) => (prev ? ((cur - prev) / prev) * 100 : null);

    const periods     = compMonths.map((x) => x.period).sort();
    const prevPeriods = [...new Set(compMonths.map((x) => x.comp.compare_period))].sort();

    return {
      ...c,
      period:                 periods.length === 1 ? periods[0] : `${periods[0]}..${periods[periods.length - 1]}`,
      prev_period:            prevPeriods.length === 1 ? prevPeriods[0] : `${prevPeriods[0]}..${prevPeriods[prevPeriods.length - 1]}`,
      prev_revenue:           prevRevenue,
      prev_total_cost:        prevCost,
      prev_profit:            prevProfit,
      pct_change_revenue:     pctChange(curRevenue, prevRevenue),
      pct_change_total_cost:  pctChange(curCost, prevCost),
      pct_change_profit:      pctChange(curProfit, prevProfit),
    };
  });

const sumMetricFromMonths = (months, metric) => {
  if (!months || typeof months !== "object") return null;
  let total = 0;
  let hasValue = false;

  Object.values(months).forEach((month) => {
    const n = parseCompactNumber(month?.[metric]);
    if (n !== null) {
      total += n;
      hasValue = true;
    }
  });

  return hasValue ? total : null;
};

const resolveCustomerMetric = (customer, metric) => {
  const direct = customer?.total?.[metric] ?? customer?.[metric] ?? null;
  const directNumber = parseCompactNumber(direct);
  const monthTotal = sumMetricFromMonths(customer?.months, metric);

  if ((directNumber === null || directNumber === 0) && monthTotal !== null && monthTotal !== 0) {
    return monthTotal;
  }

  return direct;
};

const resolveCustomerMargin = (customer, revenue, profit) => {
  const direct = customer?.total?.pct_margin ?? customer?.pct_margin ?? null;
  if (direct !== null && direct !== undefined && direct !== "") return direct;

  const rev = parseCompactNumber(revenue);
  const prof = parseCompactNumber(profit);
  return rev ? (prof / rev) * 100 : null;
};

const normalizeCustomerTotals = (customer) => {
  if (!customer) return null;

  const revenue = resolveCustomerMetric(customer, "revenue");
  const totalCost = resolveCustomerMetric(customer, "total_cost");
  const profit = resolveCustomerMetric(customer, "profit");
  const pctMargin = resolveCustomerMargin(customer, revenue, profit);

  return {
    ...customer,
    revenue,
    total_cost: totalCost,
    profit,
    pct_margin: pctMargin,
    total: {
      ...(customer.total || {}),
      revenue,
      total_cost: totalCost,
      profit,
      pct_margin: pctMargin,
    },
  };
};

/* ══════════════════════════════════════════
   AI CONTEXT HELPERS (row commentary + ✦ Explain with AI)
   Drivers are computed here from the rows already on screen — no extra
   fetch — so the AI gets exact figures instead of ranking / subtracting.
══════════════════════════════════════════ */

const CP_AI_NOTES =
  "Profit = revenue − total cost; pct_margin = profit ÷ revenue × 100. Higher revenue, profit and margin are favorable; higher cost is unfavorable. A negative profit means the customer is loss-making.";

const CP_COMPARISON_NOTE =
  "previous / prev_* values are the same customer's figures for the compared period; change = current − previous.";

const CP_VIEW_LABELS = {
  normal: "Customer totals (normal table)",
  period: "Customer × period pivot",
  comparison: "Current vs previous period comparison (summed over the periods shown)",
  period_comparison: "Customer × period pivot, current vs previous per period",
};

const CP_METRIC_LABELS = {
  revenue: "Revenue",
  total_cost: "Total Cost",
  profit: "Profit",
  pct_margin: "Margin %",
};

const CP_CUSTOMER_COLUMNS = [
  { key: "customer", label: "Customer" },
  { key: "revenue", label: "Revenue", type: "money" },
  { key: "total_cost", label: "Cost", type: "money" },
  { key: "profit", label: "Profit", type: "money", signed: true },
  { key: "pct_margin", label: "Margin", type: "pct", signed: true },
];
const CP_PERIOD_COLUMNS = [{ key: "period", label: "Period" }, ...CP_CUSTOMER_COLUMNS.slice(1)];
const cpMoverColumns = (currentLabel, previousLabel) => [
  { key: "customer", label: "Customer" },
  { key: "current", label: currentLabel, type: "money" },
  { key: "previous", label: previousLabel, type: "money" },
  { key: "change", label: "Change", type: "money", signed: true },
  { key: "change_pct", label: "%", type: "pct", signed: true },
];

const _aiR2 = (n) => (typeof n === "number" && Number.isFinite(n) ? Math.round(n * 100) / 100 : null);
const _aiNum = (v) => _aiR2(parseCompactNumber(v));
const _aiSum = (list, key) => _aiR2(list.reduce((s, x) => s + (x[key] ?? 0), 0));
const _aiDiff = (a, b) => (a === null || a === undefined || b === null || b === undefined ? null : _aiR2(a - b));
const _aiPct = (part, whole) => (part === null || part === undefined || !whole ? null : _aiR2((part / whole) * 100));
const _aiGrowth = (cur, prev) =>
  cur === null || cur === undefined || !prev ? null : _aiR2(((cur - prev) / Math.abs(prev)) * 100);

// FNV-1a: a short deterministic suffix for keys cut to fit the 100-char column.
const _cpHash = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
};

/* Saved-commentary key for a table row: customer + the toggled dimension
   values ("Acme Corp | Retail | North"). Max 100 chars (backend String(100)) —
   longer keys are cut and suffixed with a hash so they stay unique and stable. */
const customerRowKey = (r, dimKeys) => {
  const key = [
    r?.customer_name || "Unknown",
    ...dimKeys.map((k) => (r?.[k] === null || r?.[k] === undefined || r?.[k] === "" ? "-" : String(r[k]))),
  ].join(" | ");
  return key.length <= 100 ? key : `${key.slice(0, 88)}~${_cpHash(key)}`;
};

const customerRowLabel = (r, dimKeys) => {
  const name = r?.customer_name || "Unknown";
  const dims = dimKeys.map((k) => r?.[k]).filter((v) => v !== null && v !== undefined && v !== "");
  return dims.length ? `${name} (${dims.join(" / ")})` : name;
};

const _cpPeriodList = (rows, periods) =>
  periods?.length ? periods : [...new Set(rows.flatMap((r) => Object.keys(r?.months || {})))].sort();

/* Totals of a row / month entry as numbers. */
const _cpFigures = (r) => {
  const revenue = _aiNum(r?.revenue);
  const total_cost = _aiNum(r?.total_cost);
  const profit = _aiNum(r?.profit) ?? _aiDiff(revenue, total_cost);
  return { revenue, total_cost, profit, pct_margin: _aiNum(r?.pct_margin) ?? _aiPct(profit, revenue) };
};

const _cpPeriodBrief = ({ period, revenue, total_cost, profit, pct_margin }) => ({
  period,
  revenue,
  total_cost,
  profit,
  pct_margin,
});

/* A row's figures per period in the table's period order (periods with no
   activity are skipped); comparison fields come from months[p].comparisons. */
const _cpPeriodSeries = (r, periods) =>
  periods
    .filter((p) => r?.months?.[p])
    .map((p) => {
      const m = r.months[p];
      const c = m.comparisons && (m.comparisons.current_period || m.comparisons.compare_period) ? m.comparisons : null;
      const revenue = _aiNum(m.revenue ?? c?.current_revenue);
      const total_cost = _aiNum(m.total_cost ?? c?.current_total_cost);
      const profit = _aiNum(m.profit ?? c?.current_profit) ?? _aiDiff(revenue, total_cost);
      const out = { period: p, revenue, total_cost, profit, pct_margin: _aiNum(m.pct_margin) ?? _aiPct(profit, revenue) };
      if (c) {
        const prevRevenue = _aiNum(c.compare_revenue);
        const prevCost = _aiNum(c.compare_total_cost);
        const prevProfit = _aiNum(c.compare_profit);
        Object.assign(out, {
          compared_with: c.compare_period,
          prev_revenue: prevRevenue,
          prev_total_cost: prevCost,
          prev_profit: prevProfit,
          change_revenue: _aiDiff(revenue, prevRevenue) ?? _aiNum(c.variance),
          change_total_cost: _aiDiff(total_cost, prevCost) ?? _aiNum(c.variance_total_cost),
          change_profit: _aiDiff(profit, prevProfit) ?? _aiNum(c.variance_profit),
        });
      }
      return out;
    });

/* The portfolio (all rows on screen) per period. */
const _cpPortfolioSeries = (rows, periods) =>
  periods.map((p) => {
    let revenue = 0;
    let total_cost = 0;
    let profit = 0;
    rows.forEach((r) => {
      const m = r?.months?.[p];
      if (!m) return;
      const f = _cpFigures(m);
      revenue += f.revenue ?? 0;
      total_cost += f.total_cost ?? 0;
      profit += f.profit ?? 0;
    });
    return { period: p, revenue: _aiR2(revenue), total_cost: _aiR2(total_cost), profit: _aiR2(profit), pct_margin: _aiPct(profit, revenue) };
  });

/* A profit change split into its revenue and cost parts (profit = revenue − cost). */
const _cpProfitDriver = (dRevenue, dCost) => {
  if (dRevenue === null || dCost === null) return {};
  const fromCost = -dCost;
  const net = dRevenue + fromCost;
  const main = [
    ["revenue", dRevenue],
    ["cost", fromCost],
  ]
    .filter(([, v]) => v !== 0 && Math.sign(v) === Math.sign(net))
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0]?.[0];
  return {
    profit_impact_of_revenue_change: _aiR2(dRevenue),
    profit_impact_of_cost_change: _aiR2(fromCost),
    driven_by:
      main === "revenue"
        ? dRevenue > 0 ? "higher revenue" : "lower revenue"
        : main === "cost"
          ? dCost > 0 ? "higher cost" : "lower cost"
          : dRevenue || dCost ? "revenue and cost changes offset" : "no change",
  };
};

/* current vs previous { revenue, total_cost, profit, pct_margin } with the profit driver. */
const _cpCompare = (current, prev) => {
  const previous = { ...prev, pct_margin: _aiPct(prev.profit, prev.revenue) };
  const dRevenue = _aiDiff(current.revenue, previous.revenue);
  const dCost = _aiDiff(current.total_cost, previous.total_cost);
  return {
    current,
    previous,
    change_revenue: dRevenue,
    change_total_cost: dCost,
    change_profit: _aiDiff(current.profit, previous.profit),
    change_revenue_pct: _aiGrowth(current.revenue, previous.revenue),
    change_total_cost_pct: _aiGrowth(current.total_cost, previous.total_cost),
    change_profit_pct: _aiGrowth(current.profit, previous.profit),
    margin_change_pts: _aiDiff(current.pct_margin, previous.pct_margin),
    ..._cpProfitDriver(dRevenue, dCost),
  };
};

/* Comparison totals of a row (prev_* are summed per row in normalizeCustomers). */
const _cpComparisonTotals = (r) =>
  _cpCompare(_cpFigures(r), {
    revenue: _aiNum(r?.prev_revenue),
    total_cost: _aiNum(r?.prev_total_cost),
    profit: _aiNum(r?.prev_profit),
  });

/* Change vs the previous period in the table, for consecutive periods with
   activity in both. */
const _cpMoves = (series, periods) => {
  const byPeriod = new Map(series.map((s) => [s.period, s]));
  const moves = [];
  for (let i = 1; i < periods.length; i += 1) {
    const cur = byPeriod.get(periods[i]);
    const prev = byPeriod.get(periods[i - 1]);
    if (!cur || !prev) continue;
    const dRevenue = _aiDiff(cur.revenue, prev.revenue);
    const dCost = _aiDiff(cur.total_cost, prev.total_cost);
    moves.push({
      period: cur.period,
      previous_period: prev.period,
      profit_change: _aiDiff(cur.profit, prev.profit),
      revenue_change: dRevenue,
      cost_change: dCost,
      revenue_growth_pct: _aiGrowth(cur.revenue, prev.revenue),
      cost_growth_pct: _aiGrowth(cur.total_cost, prev.total_cost),
      margin_change_pts: _aiDiff(cur.pct_margin, prev.pct_margin),
      ..._cpProfitDriver(dRevenue, dCost),
    });
  }
  return moves;
};

/* Highest / lowest entry by `key` (needs 2+ values). */
const _cpExtremes = (list, key, hiName, loName, pick = (x) => x) => {
  const valid = list.filter((x) => x[key] !== null && x[key] !== undefined);
  if (valid.length < 2) return {};
  const sorted = [...valid].sort((a, b) => b[key] - a[key]);
  return { [hiName]: pick(sorted[0]), [loName]: pick(sorted[sorted.length - 1]) };
};

/* Largest rise / drop of `key` among the period moves. */
const _cpLargestMoves = (moves, key, riseName, dropName) => {
  const valid = moves.filter((m) => m[key] !== null && m[key] !== undefined);
  const rise = valid.reduce((best, m) => (m[key] > 0 && (!best || m[key] > best[key]) ? m : best), null);
  const drop = valid.reduce((worst, m) => (m[key] < 0 && (!worst || m[key] < worst[key]) ? m : worst), null);
  return { ...(rise && { [riseName]: rise }), ...(drop && { [dropName]: drop }) };
};

/* Periods where cost grew faster than revenue (margin squeeze). */
const _cpCostOutpacedRevenue = (moves) =>
  moves
    .filter((m) => m.cost_growth_pct !== null && m.revenue_growth_pct !== null && m.cost_growth_pct > m.revenue_growth_pct)
    .map(({ period, previous_period, revenue_growth_pct, cost_growth_pct, profit_change }) => ({
      period,
      previous_period,
      revenue_growth_pct,
      cost_growth_pct,
      profit_change,
    }));

/* Every row on screen with its totals, ranked by profit in code. */
const _cpPortfolio = (rows, labelOf) => {
  const list = rows.map((row) => ({ row, customer: labelOf(row), ..._cpFigures(row) }));
  const totalRevenue = _aiSum(list, "revenue");
  const totalCost = _aiSum(list, "total_cost");
  const totalProfit = _aiSum(list, "profit");
  const byProfit = [...list].sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0));
  return {
    list,
    byProfit,
    profitRank: new Map(byProfit.map((x, i) => [x.row, i + 1])),
    lossMakers: byProfit.filter((x) => x.profit < 0).reverse(), // worst first
    totalRevenue,
    totalCost,
    totalProfit,
    margin: _aiPct(totalProfit, totalRevenue),
    costToRevenue: _aiPct(totalCost, totalRevenue),
    customerCount: new Set(rows.map((r) => r?.customer_name)).size,
  };
};

const _cpBrief = ({ customer, revenue, total_cost, profit, pct_margin }) => ({
  customer,
  revenue,
  total_cost,
  profit,
  pct_margin,
});
const _cpTopBy = (list, key, n = list.length, ascending = false) =>
  list
    .filter((x) => x[key] !== null && x[key] !== undefined)
    .sort((a, b) => (ascending ? a[key] - b[key] : b[key] - a[key]))
    .slice(0, n);

const _cpPortfolioFacts = (pf) => ({
  total_revenue: pf.totalRevenue,
  total_cost: pf.totalCost,
  total_profit: pf.totalProfit,
  portfolio_margin_pct: pf.margin,
  portfolio_cost_to_revenue_pct: pf.costToRevenue,
  customer_count: pf.customerCount,
  ...(pf.list.length !== pf.customerCount && { row_count: pf.list.length }),
  loss_making_rows: pf.lossMakers.length,
  top_5_by_profit: pf.byProfit.slice(0, 5).map(_cpBrief),
});

/* One row's standing in the portfolio: rank, shares, margin vs portfolio. */
const _cpRowStanding = (fig, row, pf) => {
  const atPortfolioMargin =
    fig.revenue !== null && pf.margin !== null ? _aiR2((fig.revenue * pf.margin) / 100) : null;
  return {
    profit_rank: pf.profitRank.get(row) ?? null,
    ranked_rows: pf.list.length,
    share_of_total_revenue_pct: _aiPct(fig.revenue, pf.totalRevenue),
    share_of_total_profit_pct: pf.totalProfit > 0 ? _aiPct(fig.profit, pf.totalProfit) : null,
    margin_pct: fig.pct_margin,
    portfolio_margin_pct: pf.margin,
    margin_vs_portfolio_pts: _aiDiff(fig.pct_margin, pf.margin),
    cost_to_revenue_pct: _aiPct(fig.total_cost, fig.revenue),
    portfolio_cost_to_revenue_pct: pf.costToRevenue,
    profit_at_portfolio_margin: atPortfolioMargin,
    profit_gap_vs_portfolio_margin: _aiDiff(fig.profit, atPortfolioMargin),
    is_loss_making: fig.profit !== null && fig.profit < 0,
  };
};

/* Every row's current / previous value (`pick(row)` → [current, previous]),
   the change, and the portfolio's total change. */
const _cpMovers = (pf, pick) => {
  const all = pf.list
    .map((x) => {
      const [current, previous] = pick(x.row);
      return {
        row: x.row,
        customer: x.customer,
        current,
        previous,
        change: _aiDiff(current ?? 0, previous ?? 0),
        change_pct: _aiGrowth(current, previous),
      };
    })
    .filter((m) => m.current !== null || m.previous !== null);
  return {
    all,
    totalChange: _aiSum(all, "change"),
    rises: all.filter((m) => m.change > 0).sort((a, b) => b.change - a.change),
    drops: all.filter((m) => m.change < 0).sort((a, b) => a.change - b.change),
  };
};
const _cpMoverRow = ({ customer, current, previous, change, change_pct }) => ({
  customer,
  current,
  previous,
  change,
  change_pct,
});
const _cpTopMovers = (mv, n = 5, exclude = null) =>
  [...mv.rises.slice(0, n + 1), ...mv.drops.slice(0, n + 1)]
    .filter((m) => m.row !== exclude)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, n * 2)
    .map(_cpMoverRow);

const CP_MARGIN_BANDS = [
  ["Below 0% (loss-making)", (m) => m < 0],
  ["0% to 10%", (m) => m >= 0 && m < 10],
  ["10% to 20%", (m) => m >= 10 && m < 20],
  ["20% and above", (m) => m >= 20],
];
const _cpMarginBands = (list) =>
  CP_MARGIN_BANDS.map(([band, test]) => {
    const members = list.filter((x) => x.pct_margin !== null && test(x.pct_margin));
    return { band, customers: members.length, revenue: _aiSum(members, "revenue"), profit: _aiSum(members, "profit") };
  });

/**
 * "Refine with AI" context for one customer row: its figures as displayed,
 * code-computed line_facts and compact portfolio context. Stays under the
 * backend's 12,000-char limit by dropping the oldest periods first.
 */
const buildCustomerLineContext = ({
  row,
  rows,
  labelOf,
  periods,
  mode,
  tableScale,
  isComparisonOn,
  currentPeriodLabel,
  prevPeriodLabel,
}) => {
  const pf = _cpPortfolio(rows, labelOf);
  const periodList = _cpPeriodList(rows, periods);
  const fig = _cpFigures(row);
  const fullSeries = _cpPeriodSeries(row, periodList);
  const moves = _cpMoves(fullSeries, periodList);
  const pickPeriod = ({ period, revenue, total_cost, profit }) => ({ period, revenue, total_cost, profit });
  const lineFacts = {
    ..._cpRowStanding(fig, row, pf),
    ..._cpExtremes(fullSeries, "profit", "best_period_by_profit", "worst_period_by_profit", pickPeriod),
    ..._cpLargestMoves(moves, "profit_change", "largest_profit_rise_vs_previous_period", "largest_profit_drop_vs_previous_period"),
    periods_cost_grew_faster_than_revenue: _cpCostOutpacedRevenue(moves),
    ...(isComparisonOn && {
      comparison: {
        current_period: currentPeriodLabel,
        previous_period: prevPeriodLabel,
        ..._cpComparisonTotals(row),
      },
    }),
  };

  let series = fullSeries;
  const build = () =>
    JSON.stringify(
      compactForAI({
        report: "Customer Profitability",
        view: CP_VIEW_LABELS[mode] || mode,
        value_scale: tableScale,
        notes: isComparisonOn ? `${CP_AI_NOTES} ${CP_COMPARISON_NOTE}` : CP_AI_NOTES,
        line_item: labelOf(row),
        line_totals: fig,
        line_periods: series,
        ...(series.length < fullSeries.length && {
          line_periods_note: `Only the latest ${series.length} of ${fullSeries.length} periods are listed; line_facts cover all periods.`,
        }),
        line_facts: lineFacts,
        portfolio: _cpPortfolioFacts(pf),
      }),
    );
  let json = build();
  while (json.length > 11500 && series.length > 1) {
    series = series.slice(Math.ceil(series.length / 4));
    json = build();
  }
  return json;
};

/**
 * "Explain with AI" context for a Customer Profitability value.
 * target: { kind: "cell", rowKey, metric, period, mode } for a table value, or
 *         { kind: "kpi", metric, mode } for a Key Customer Metric.
 * Returns { context, supporting } (see AnalyzeWithAI).
 */
const buildCustomerProfitAnalysis = ({
  target,
  rows,
  rowByKey,
  labelOf,
  periods,
  metrics,
  tableScale,
  currentPeriodLabel,
  prevPeriodLabel,
}) => {
  const pf = _cpPortfolio(rows, labelOf);
  const periodList = _cpPeriodList(rows, periods);
  const isChange = target.mode === "comparison" || target.mode === "period_comparison";
  const note = tableScale !== "Actual" ? `Values in ${tableScale.toLowerCase()}` : undefined;
  const facts = {};
  const supporting = [];
  const addTable = (title, columns, tableRows) => {
    if (tableRows.length) supporting.push({ title, columns, rows: tableRows, note });
  };
  const withShare = (x, key, total) => ({ ..._cpBrief(x), [`share_of_total_${key}_pct`]: _aiPct(x[key], total) });

  if (target.kind === "kpi") {
    const series = _cpPortfolioSeries(rows, periodList);
    const moves = _cpMoves(series, periodList);
    const positive = pf.list.filter((x) => (x.profit ?? 0) >= 0);
    const withRevenue = pf.list.filter((x) => x.revenue !== null);
    const byRevenue = _cpTopBy(withRevenue, "revenue");

    Object.assign(facts, {
      kpi_value_on_screen: metrics?.[target.metric] ?? null,
      loss_makers: {
        count: pf.lossMakers.length,
        total_loss: _aiSum(pf.lossMakers, "profit"),
        worst_5: pf.lossMakers.slice(0, 5).map(_cpBrief),
      },
      top_profit_contributors: pf.byProfit
        .slice(0, 5)
        .filter((x) => x.profit > 0)
        .map((x) => withShare(x, "profit", pf.totalProfit > 0 ? pf.totalProfit : null)),
      margin_distribution: _cpMarginBands(pf.list),
      margin_excluding_loss_makers_pct: _aiPct(_aiSum(positive, "profit"), _aiSum(positive, "revenue")),
      ...(series.length > 1 && {
        portfolio_by_period: series,
        ..._cpExtremes(series, "profit", "best_period_by_profit", "worst_period_by_profit", _cpPeriodBrief),
        ..._cpLargestMoves(moves, "profit_change", "largest_profit_rise_vs_previous_period", "largest_profit_drop_vs_previous_period"),
      }),
    });

    if (target.metric === "total_revenue" || target.metric === "highest_revenue") {
      facts.top_5_by_revenue = byRevenue.slice(0, 5).map((x) => ({
        ...withShare(x, "revenue", pf.totalRevenue),
        profit_rank: pf.profitRank.get(x.row),
      }));
      facts.top_10_revenue_share_pct = _aiPct(_aiSum(byRevenue.slice(0, 10), "revenue"), pf.totalRevenue);
      if (target.metric === "highest_revenue" && byRevenue[0]) {
        facts.highest_revenue_customer = { ..._cpBrief(byRevenue[0]), ..._cpRowStanding(byRevenue[0], byRevenue[0].row, pf) };
      }
      addTable("Top customers by revenue", CP_CUSTOMER_COLUMNS, byRevenue.slice(0, 10).map(_cpBrief));
    } else if (target.metric === "lowest_revenue") {
      const lowest = [...byRevenue].reverse().slice(0, 10);
      facts.lowest_revenue_customers = lowest.slice(0, 5).map((x) => ({
        ..._cpBrief(x),
        profit_rank: pf.profitRank.get(x.row),
      }));
      addTable("Lowest-revenue customers", CP_CUSTOMER_COLUMNS, lowest.map(_cpBrief));
    } else if (target.metric === "average_revenue") {
      const avg = withRevenue.length ? _aiSum(withRevenue, "revenue") / withRevenue.length : null;
      const asc = [...byRevenue].reverse();
      const mid = Math.floor(asc.length / 2);
      const median = asc.length ? (asc.length % 2 ? asc[mid].revenue : (asc[mid - 1].revenue + asc[mid].revenue) / 2) : null;
      const above = withRevenue.filter((x) => x.revenue > avg);
      const closest = [...withRevenue].sort((a, b) => Math.abs(a.revenue - avg) - Math.abs(b.revenue - avg)).slice(0, 5);
      facts.average_revenue = {
        average: _aiR2(avg),
        median: _aiR2(median),
        rows_above_average: above.length,
        rows_below_average: withRevenue.length - above.length,
        revenue_share_of_rows_above_average_pct: _aiPct(_aiSum(above, "revenue"), pf.totalRevenue),
        closest_to_average: closest.slice(0, 3).map(_cpBrief),
        top_3_by_revenue: byRevenue.slice(0, 3).map(_cpBrief),
      };
      addTable("Customers closest to the average revenue", CP_CUSTOMER_COLUMNS, closest.map(_cpBrief));
      addTable("Top customers by revenue", CP_CUSTOMER_COLUMNS, byRevenue.slice(0, 5).map(_cpBrief));
    } else if (target.metric === "total_cost") {
      const byCost = _cpTopBy(pf.list, "total_cost", 10);
      facts.top_5_by_cost = byCost.slice(0, 5).map((x) => ({
        ...withShare(x, "total_cost", pf.totalCost),
        cost_to_revenue_pct: _aiPct(x.total_cost, x.revenue),
      }));
      facts.highest_cost_to_revenue = _cpTopBy(
        withRevenue.filter((x) => x.revenue > 0).map((x) => ({ ...x, cost_to_revenue_pct: _aiPct(x.total_cost, x.revenue) })),
        "cost_to_revenue_pct",
        5,
      ).map((x) => ({ ..._cpBrief(x), cost_to_revenue_pct: x.cost_to_revenue_pct }));
      addTable("Top customers by cost", CP_CUSTOMER_COLUMNS, byCost.map(_cpBrief));
    }

    if (["total_profit", "margin", "total_cost"].includes(target.metric)) {
      addTable("Loss-making customers", CP_CUSTOMER_COLUMNS, pf.lossMakers.slice(0, 10).map(_cpBrief));
    }
    if (["total_profit", "margin"].includes(target.metric)) {
      addTable("Top profit contributors", CP_CUSTOMER_COLUMNS, pf.byProfit.slice(0, 10).map(_cpBrief));
      addTable(
        "Margin distribution",
        [
          { key: "band", label: "Margin band" },
          { key: "customers", label: "Rows", type: "count" },
          { key: "revenue", label: "Revenue", type: "money" },
          { key: "profit", label: "Profit", type: "money", signed: true },
        ],
        facts.margin_distribution,
      );
    }
    if (series.length > 1) addTable("Portfolio by period", CP_PERIOD_COLUMNS, series);
  } else {
    const r = rowByKey.get(target.rowKey);
    if (!r) throw new Error("This customer is no longer in the table — refresh the report and try again.");
    const label = labelOf(r);
    const fig = _cpFigures(r);
    const series = _cpPeriodSeries(r, periodList);
    const moves = _cpMoves(series, periodList);
    const standing = _cpRowStanding(fig, r, pf);
    const metric = target.metric;
    const p = target.period;
    const markSelf = (x) => (x.row === r ? { ..._cpBrief(x), customer: `${x.customer} (this customer)` } : _cpBrief(x));
    const addSeriesTable = () => addTable(`${label} by period`, CP_PERIOD_COLUMNS, series.map(_cpPeriodBrief));

    facts.customer = { customer: label, ...fig, ...standing };

    if (isChange) {
      // Variance cell: current vs previous for this row, then the rest of the portfolio.
      let comparison;
      let pick;
      let curLabel;
      let prevLabel;
      if (p) {
        const s = series.find((x) => x.period === p) || {};
        comparison = {
          period: p,
          compared_with: s.compared_with ?? null,
          ..._cpCompare(
            { revenue: s.revenue ?? null, total_cost: s.total_cost ?? null, profit: s.profit ?? null, pct_margin: s.pct_margin ?? null },
            { revenue: s.prev_revenue ?? null, total_cost: s.prev_total_cost ?? null, profit: s.prev_profit ?? null },
          ),
        };
        pick = (row) => {
          const c = row?.months?.[p]?.comparisons;
          return c ? [_aiNum(c[`current_${metric}`] ?? row.months[p][metric]), _aiNum(c[`compare_${metric}`])] : [null, null];
        };
        curLabel = p;
        prevLabel = s.compared_with || "Previous";
      } else {
        comparison = { current_period: currentPeriodLabel, previous_period: prevPeriodLabel, ..._cpComparisonTotals(r) };
        pick = (row) => [_aiNum(row?.[metric]), _aiNum(row?.[`prev_${metric}`])];
        curLabel = currentPeriodLabel;
        prevLabel = prevPeriodLabel;
      }
      const mv = _cpMovers(pf, pick);
      const own = mv.all.find((m) => m.row === r);
      const others = (list) => list.filter((m) => m.row !== r).slice(0, 5).map(_cpMoverRow);
      const metricName = CP_METRIC_LABELS[metric] || metric;

      facts.comparison = comparison;
      facts.portfolio_change = {
        metric,
        total_change: mv.totalChange,
        this_customer_change: own?.change ?? null,
        this_customer_share_of_total_change_pct: mv.totalChange ? _aiPct(own?.change ?? null, mv.totalChange) : null,
        rows_increased: mv.rises.length,
        rows_decreased: mv.drops.length,
        other_customers_biggest_increases: others(mv.rises),
        other_customers_biggest_decreases: others(mv.drops),
      };
      if (!p && series.length > 1) facts.customer_by_period = series;

      addTable(
        `${label} — ${curLabel} vs ${prevLabel}`,
        [
          { key: "line", label: "Line" },
          { key: "current", label: "Current", type: "money" },
          { key: "previous", label: "Previous", type: "money" },
          { key: "change", label: "Change", type: "money", signed: true },
          { key: "change_pct", label: "%", type: "pct", signed: true },
        ],
        [
          ["Revenue", "revenue"],
          ["Total cost", "total_cost"],
          ["Profit", "profit"],
        ].map(([line, k]) => ({
          line,
          current: comparison.current[k],
          previous: comparison.previous[k],
          change: comparison[`change_${k}`],
          change_pct: comparison[`change_${k}_pct`],
        })),
      );
      addTable(`Other customers — biggest ${metricName.toLowerCase()} movers`, cpMoverColumns(curLabel, prevLabel), _cpTopMovers(mv, 5, r));
      if (!p) addSeriesTable();
    } else if (p) {
      // Period cell: this period vs the previous one, and the share of the portfolio's change.
      const idx = periodList.indexOf(p);
      const prevP = idx > 0 ? periodList[idx - 1] : null;
      const empty = { revenue: 0, total_cost: 0, profit: 0, pct_margin: null };
      const cur = series.find((s) => s.period === p);
      const prev = prevP ? series.find((s) => s.period === prevP) : null;
      const [portCur, portPrev] = _cpPortfolioSeries(rows, prevP ? [p, prevP] : [p]);

      facts.this_period = cur ? _cpPeriodBrief(cur) : { period: p, note: "No activity in this period." };
      facts.portfolio_this_period = portCur;
      facts.margin_vs_portfolio_this_period_pts = _aiDiff(cur?.pct_margin ?? null, portCur.pct_margin);
      facts.share_of_portfolio_profit_this_period_pct = portCur.profit > 0 ? _aiPct(cur?.profit ?? 0, portCur.profit) : null;
      if (prevP) {
        const vs = _cpCompare(cur ? _cpPeriodBrief(cur) : empty, prev ? _cpPeriodBrief(prev) : empty);
        const portChange = _aiDiff(portCur.profit, portPrev.profit);
        const mv = _cpMovers(pf, (row) => [_aiNum(row?.months?.[p]?.profit), _aiNum(row?.months?.[prevP]?.profit)]);
        facts.vs_previous_period = {
          previous_period: prevP,
          ...(!prev && { note: "No activity for this customer in the previous period." }),
          ...vs,
        };
        facts.portfolio_vs_previous_period = {
          profit_change: portChange,
          ..._cpProfitDriver(_aiDiff(portCur.revenue, portPrev.revenue), _aiDiff(portCur.total_cost, portPrev.total_cost)),
          this_customer_contribution_to_profit_change_pct: portChange ? _aiPct(vs.change_profit, portChange) : null,
          other_customers_biggest_profit_rises: mv.rises.filter((m) => m.row !== r).slice(0, 5).map(_cpMoverRow),
          other_customers_biggest_profit_drops: mv.drops.filter((m) => m.row !== r).slice(0, 5).map(_cpMoverRow),
        };
        addSeriesTable();
        addTable(`Biggest profit movers — ${prevP} → ${p}`, cpMoverColumns(p, prevP), _cpTopMovers(mv, 5));
      } else {
        facts.vs_previous_period = "This is the first period in the table — there is no previous period to compare with.";
        addSeriesTable();
      }
    } else if (metric === "profit") {
      facts.profit_decomposition = {
        formula: "profit = revenue − total cost",
        revenue: fig.revenue,
        total_cost: fig.total_cost,
        profit: fig.profit,
        cost_to_revenue_pct: standing.cost_to_revenue_pct,
        portfolio_cost_to_revenue_pct: pf.costToRevenue,
        profit_at_portfolio_margin: standing.profit_at_portfolio_margin,
        profit_gap_vs_portfolio_margin: standing.profit_gap_vs_portfolio_margin,
      };
      const last = moves[moves.length - 1];
      if (last && last.period === periodList[periodList.length - 1]) facts.latest_period_vs_previous = last;
      Object.assign(
        facts,
        _cpExtremes(series, "profit", "best_period_by_profit", "worst_period_by_profit", _cpPeriodBrief),
        _cpLargestMoves(moves, "profit_change", "largest_profit_rise_vs_previous_period", "largest_profit_drop_vs_previous_period"),
      );
      facts.periods_cost_grew_faster_than_revenue = _cpCostOutpacedRevenue(moves);
      if (series.length > 1) facts.customer_by_period = series.map(_cpPeriodBrief);
      addSeriesTable();
      if (standing.is_loss_making) {
        addTable("Loss-making customers", CP_CUSTOMER_COLUMNS, pf.lossMakers.slice(0, 10).map(markSelf));
      } else {
        addTable("Top profit contributors", CP_CUSTOMER_COLUMNS, pf.byProfit.slice(0, 10).map(markSelf));
      }
    } else if (metric === "pct_margin") {
      const byRevenue = _cpTopBy(pf.list, "revenue");
      const i = byRevenue.findIndex((x) => x.row === r);
      const neighbours = i < 0 ? [] : byRevenue.slice(Math.max(0, i - 5), i + 6);
      const peers = neighbours.filter((x) => x.row !== r);
      facts.margin_breakdown = {
        revenue: fig.revenue,
        total_cost: fig.total_cost,
        profit: fig.profit,
        pct_margin: fig.pct_margin,
        cost_to_revenue_pct: standing.cost_to_revenue_pct,
        portfolio_margin_pct: pf.margin,
        margin_vs_portfolio_pts: standing.margin_vs_portfolio_pts,
        margin_excluding_this_customer_pct: _aiPct(
          _aiDiff(pf.totalProfit, fig.profit ?? 0),
          _aiDiff(pf.totalRevenue, fig.revenue ?? 0),
        ),
      };
      facts.similar_revenue_customers = {
        count: peers.length,
        combined_margin_pct: _aiPct(_aiSum(peers, "profit"), _aiSum(peers, "revenue")),
        this_customer_margin_rank_among_them:
          1 + peers.filter((x) => x.pct_margin !== null && fig.pct_margin !== null && x.pct_margin > fig.pct_margin).length,
        customers: peers.map(_cpBrief),
      };
      Object.assign(
        facts,
        _cpExtremes(series, "pct_margin", "highest_margin_period", "lowest_margin_period", _cpPeriodBrief),
        _cpLargestMoves(moves, "margin_change_pts", "largest_margin_rise_vs_previous_period", "largest_margin_drop_vs_previous_period"),
      );
      facts.periods_cost_grew_faster_than_revenue = _cpCostOutpacedRevenue(moves);
      if (series.length > 1) facts.customer_by_period = series.map(_cpPeriodBrief);
      addSeriesTable();
      addTable("Customers with similar revenue", CP_CUSTOMER_COLUMNS, neighbours.map(markSelf));
    } else {
      // revenue / total_cost: trend, share and rank.
      const isRevenue = metric === "revenue";
      const ranked = _cpTopBy(pf.list, metric);
      const rank = ranked.findIndex((x) => x.row === r) + 1;
      const first = series[0];
      const last = series[series.length - 1];
      facts[`${metric}_facts`] = {
        rank_highest_first: rank || null,
        ranked_rows: ranked.length,
        share_of_total_pct: _aiPct(fig[metric], isRevenue ? pf.totalRevenue : pf.totalCost),
        average_per_active_period: series.length ? _aiR2(_aiSum(series, metric) / series.length) : null,
        ...(series.length > 1 && {
          trend: {
            first_period: first.period,
            first_value: first[metric],
            last_period: last.period,
            last_value: last[metric],
            change: _aiDiff(last[metric], first[metric]),
            change_pct: _aiGrowth(last[metric], first[metric]),
          },
        }),
      };
      Object.assign(
        facts,
        _cpExtremes(series, metric, `highest_${metric}_period`, `lowest_${metric}_period`, _cpPeriodBrief),
        _cpLargestMoves(moves, isRevenue ? "revenue_change" : "cost_change", "largest_rise_vs_previous_period", "largest_drop_vs_previous_period"),
      );
      if (!isRevenue) facts.periods_cost_grew_faster_than_revenue = _cpCostOutpacedRevenue(moves);
      if (series.length > 1) facts.customer_by_period = series.map(_cpPeriodBrief);
      addSeriesTable();
      addTable(
        isRevenue ? "Top customers by revenue" : "Top customers by cost",
        CP_CUSTOMER_COLUMNS,
        [...ranked.slice(0, 10), ...(rank > 10 ? [ranked[rank - 1]] : [])].map(markSelf),
      );
    }
  }

  const payload = {
    table_view: CP_VIEW_LABELS[target.mode] || target.mode,
    table_value_scale: tableScale,
    notes: [
      CP_AI_NOTES,
      isChange && CP_COMPARISON_NOTE,
      "Rows are customers (split by industry / region / entity / department when those columns are shown). computed_facts are exact — use them instead of recomputing.",
    ]
      .filter(Boolean)
      .join(" "),
    clicked: { metric: target.metric, period: target.period || undefined, value_on_screen: target.value },
    portfolio: _cpPortfolioFacts(pf),
    computed_facts: facts,
  };
  let context = JSON.stringify(compactForAI(payload));
  if (context.length > 17500) {
    delete facts.customer_by_period;
    delete facts.portfolio_by_period;
    context = JSON.stringify(compactForAI(payload));
  }
  return { context, supporting };
};

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
export default function CustomerProfitPage() {
  const { token, selectedYear: year, selectedCurrency } = useContext(AuthContext);

  const [rows,         setRows]         = useState([]);
  const [grandTotal,   setGrandTotal]   = useState(null);
  const [apiPeriods,   setApiPeriods]   = useState([]);
  const [metrics,      setMetrics]      = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [drillOpen,    setDrillOpen]    = useState(false);
  const [drillCustomer,setDrillCustomer]= useState("");

  const [filters,        setFilters]        = useState(DEFAULT_FILTERS);
  const [draftFilters,   setDraftFilters]   = useState(DEFAULT_FILTERS);
  const [open,           setOpen]           = useState(false);
  const [showPeriodCols, setShowPeriodCols] = useState(false);
  const ref = useRef(null);

  const customerProfitInsightMap = useMemo(() => buildCustomerProfitInsights(rows), [rows]);
  const customerProfitExecutive = useMemo(() => buildCustomerProfitExecutive(rows), [rows]);

  /* Column toggles — kept separate so they hit the API independently */
  const [colToggles, setColToggles] = useState(DEFAULT_COLUMN_TOGGLES);

  const [filterOptions, setFilterOptions] = useState({
    customers:   [],
    industries:  [],
    departments: [],
    regions:     [],
    entities:    [],
    sales_persons: [],
  });

  /* Customer names per salesperson id, fetched when a salesperson is picked so
     the Customer dropdown narrows before Apply. */
  const [salesPersonCustomers, setSalesPersonCustomers] = useState({});

  useEffect(() => {
    const id = draftFilters.sales_person_id;
    if (!id || !token || salesPersonCustomers[id]) return;
    let cancelled = false;
    fetch(
      `${API_BASE_URL}/api/v1/company/financial/customer-profitability-sales-person-customers?sales_person_id=${encodeURIComponent(id)}`,
      { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } }
    )
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        if (!cancelled) setSalesPersonCustomers((m) => ({ ...m, [id]: Array.isArray(data?.customers) ? data.customers : [] }));
      })
      .catch((err) => console.error(err));
    return () => { cancelled = true; };
  }, [draftFilters.sales_person_id, token]); // eslint-disable-line

  const draftCustomerOptions = draftFilters.sales_person_id
    ? salesPersonCustomers[draftFilters.sales_person_id] || []
    : filterOptions.customers;

  /* Drop a picked customer the newly picked salesperson doesn't handle */
  useEffect(() => {
    const list = salesPersonCustomers[draftFilters.sales_person_id];
    if (list && draftFilters.customer_name && !list.includes(draftFilters.customer_name)) {
      setDraftFilters((f) => ({ ...f, customer_name: "" }));
    }
  }, [draftFilters.sales_person_id, draftFilters.customer_name, salesPersonCustomers]);

  const pctInline = (val) => {
    const n = Number(val);
    if (!Number.isFinite(n)) return null;
    const cls  = n > 0 ? "text-green-700" : n < 0 ? "text-red-700" : "text-slate-700";
    const sign = n > 0 ? "+" : "";
    return { text: `${sign}${n.toFixed(getDecimalPrecision())}%`, cls };
  };

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const isComparisonOn = filters.comparison === "month_on_month" || filters.comparison === "year_on_year";

  const isDirty = useMemo(
    () => JSON.stringify(draftFilters) !== JSON.stringify(filters),
    [draftFilters, filters]
  );

  /* ── Build visible columns list (order matters for normal table) ── */
  const visibleNormalCols = useMemo(() => {
    const cols = ["customer_name"];
    COLUMN_TOGGLES.forEach(({ flag, key }) => { if (colToggles[flag]) cols.push(key); });
    cols.push("revenue", "total_cost", "profit", "pct_margin", "ai_insights", "ai_recommendation");
    return cols;
  }, [colToggles]);

  /* Visible left dim cols for comparison table */
  const visibleLeftCols = useMemo(() => {
    return AFTER_LEFT_COLUMNS.filter((c) => {
      if (c === "customer_name") return true;
      const toggle = COLUMN_TOGGLES.find((t) => t.key === c);
      return toggle ? colToggles[toggle.flag] : false;
    });
  }, [colToggles]);

  /* Period pivot — API returns customer.months dict, just map it */
  const periodPivot = useMemo(() => {
    if (!showPeriodCols || !rows.length || !apiPeriods.length) return { periods: [], pivot: [] };
    return {
      periods: apiPeriods,
      pivot: rows.map((r) => ({
        customer_name:   r.customer_name,
        industry:        r.industry,
        region:          r.region,
        entity_name:     r.entity_name,
        department_name: r.department_name,
        months:          r.months || {},
        total:           r.total  || {},
      })),
    };
  }, [rows, showPeriodCols, apiPeriods]);

  /* Grand total months come directly from the API grand total record */
  const periodGrandTotals = useMemo(() => {
    if (!showPeriodCols) return {};
    return grandTotal?.months || {};
  }, [grandTotal, showPeriodCols]);

  /* ════════════════════════════
     FETCH
  ════════════════════════════ */
  // Only the latest request may update the page — otherwise a slower, older
  // response can land last and show data for filters that are no longer applied.
  const fetchSeqRef = useRef(0);

  const fetchReport = useCallback(async (applied, toggles = colToggles) => {
    if (!token || !year || !selectedCurrency) return;
    const seq = ++fetchSeqRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("currency_filter", applied.currency_filter);
      params.set("period",          applied.period);
      params.set("sort_by",         applied.sort_by    || "profit");
      params.set("sort_order",      applied.sort_order || "desc");
      params.set("page",            1);
      params.set("page_size",       2000);
      params.set("excel_download",  "false");

      COLUMN_TOGGLES.forEach(({ flag, apiParam }) => {
        params.set(apiParam, String(Boolean(toggles[flag])));
      });

      if (applied.comparison)      params.set("comparison",     applied.comparison);
      if (applied.customer_name)   params.set("customer_name",  applied.customer_name);
      if (applied.industry)        params.set("industry",       applied.industry);
      if (applied.department_name) params.set("department",     applied.department_name);
      if (applied.region)          params.set("region",         applied.region);
      if (applied.entity_name)     params.set("entity_name",    applied.entity_name);
      if (applied.sales_person_id) params.set("sales_person_id", applied.sales_person_id);
      if (applied.date_from)       params.set("date_from",      applied.date_from);
      if (applied.date_to)         params.set("date_to",        applied.date_to);

      const res = await fetch(
        `${API_BASE_URL}/api/v1/company/financial/customer-profitability/${year}/${selectedCurrency}?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (seq !== fetchSeqRef.current) return;

      if (typeof data === "string") {
        setRows([]); setMetrics(null); setGrandTotal(null); setApiPeriods([]);
        setFilterOptions((o) => ({ customers: [], industries: [], departments: [], regions: [], entities: [], sales_persons: o.sales_persons }));
        return;
      }

      setMetrics(data?.keymetrics || null);
      setApiPeriods(Array.isArray(data?.periods) ? data.periods : []);

      const allCustomers = Array.isArray(data?.customers) ? data.customers : [];
      const gtRow    = allCustomers.find((c) => c.customer_name === "Grand Total");
      const dataRows = allCustomers.filter((c) => c.customer_name !== "Grand Total");
      setGrandTotal(normalizeCustomerTotals(gtRow));

      /* Flatten customer.total into top-level fields so existing normal/comparison
         table renderers keep working without changes */
      const flatRows = dataRows.map(normalizeCustomerTotals);
      setRows(normalizeCustomers(flatRows, applied.comparison));

      setFilterOptions({
        customers:   data?.customers_list?.length    ? data.customers_list    : [...new Set(dataRows.map((x) => x.customer_name).filter(Boolean))],
        industries:  data?.industries?.length        ? data.industries        : [...new Set(dataRows.map((x) => x.industry).filter(Boolean))],
        regions:     data?.regions?.length           ? data.regions           : [...new Set(dataRows.map((x) => x.region).filter(Boolean))],
        entities:    data?.entities?.length          ? data.entities          : [...new Set(dataRows.map((x) => x.entity_name).filter(Boolean))],
        departments: data?.departments?.length       ? data.departments       : [...new Set(dataRows.map((x) => x.department_name).filter(Boolean))],
        sales_persons: Array.isArray(data?.sales_persons) ? data.sales_persons : [],
      });
    } catch (err) {
      if (seq !== fetchSeqRef.current) return;
      setRows([]); setMetrics(null); setGrandTotal(null); setApiPeriods([]);
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }, [token, year, selectedCurrency, colToggles]); // eslint-disable-line

  /* ── Column toggle change → re-fetch ── */
  const onToggleColumn = (flag) => {
    const next = { ...colToggles, [flag]: !colToggles[flag] };
    setColToggles(next);
    fetchReport(filters, next);
  };

  /* ════════════════════════════
     EXCEL DOWNLOAD
  ════════════════════════════ */
  // `withCommentary` = the commentary to add as a sheet (collectCommentary), or null.
  const downloadExcel = useCallback(async (withCommentary = null) => {
    if (!token || !year || !selectedCurrency) return;
    setExcelLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("currency_filter", filters.currency_filter);
      params.set("period",          filters.period);
      params.set("sort_by",         filters.sort_by    || "profit");
      params.set("sort_order",      filters.sort_order || "desc");
      params.set("page",            1);
      params.set("page_size",       2000);
      params.set("excel_download",  "true");

      COLUMN_TOGGLES.forEach(({ flag, apiParam }) => {
        params.set(apiParam, String(Boolean(colToggles[flag])));
      });

      if (filters.comparison)      params.set("comparison",     filters.comparison);
      if (filters.customer_name)   params.set("customer_name",  filters.customer_name);
      if (filters.industry)        params.set("industry",       filters.industry);
      if (filters.department_name) params.set("department",     filters.department_name);
      if (filters.region)          params.set("region",         filters.region);
      if (filters.entity_name)     params.set("entity_name",    filters.entity_name);
      if (filters.sales_person_id) params.set("sales_person_id", filters.sales_person_id);
      if (filters.date_from)       params.set("date_from",      filters.date_from);
      if (filters.date_to)         params.set("date_to",        filters.date_to);

      const res = await fetch(
        `${API_BASE_URL}/api/v1/company/financial/customer-profitability/${year}/${selectedCurrency}?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}`, accept: "*/*" } }
      );
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const file = withCommentary ? await xlsxWithCommentary(blob, withCommentary) : blob;
      const link = document.createElement("a");
      link.href     = URL.createObjectURL(file);
      link.download = `CustomerProfitability_${year}_${selectedCurrency}.xlsx`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e) {
      console.error(e);
    } finally {
      setExcelLoading(false);
    }
  }, [token, year, selectedCurrency, filters, colToggles]);

  // Same param names downloadExcel sends (minus excel_download/page/
  // page_size, which the schedule path adds itself), so a scheduled send
  // reproduces this exact filtered view.
  const scheduleFilters = useMemo(() => {
    const out = {
      currency_filter: filters.currency_filter,
      period: filters.period,
      sort_by: filters.sort_by || "profit",
      sort_order: filters.sort_order || "desc",
    };
    COLUMN_TOGGLES.forEach(({ flag, apiParam }) => {
      out[apiParam] = String(Boolean(colToggles[flag]));
    });
    if (filters.comparison) out.comparison = filters.comparison;
    if (filters.customer_name) out.customer_name = filters.customer_name;
    if (filters.industry) out.industry = filters.industry;
    if (filters.department_name) out.department = filters.department_name;
    if (filters.region) out.region = filters.region;
    if (filters.entity_name) out.entity_name = filters.entity_name;
    if (filters.sales_person_id) out.sales_person_id = filters.sales_person_id;
    if (filters.date_from) out.date_from = filters.date_from;
    if (filters.date_to) out.date_to = filters.date_to;
    return out;
  }, [filters, colToggles]);

  /* Loads with the defaults, so reset the filter/toggle state to match —
     otherwise a year/currency change leaves the old filters showing over
     default data. The fetch is imperative, so this doesn't refetch twice. */
  useEffect(() => {
    if (!token || !year || !selectedCurrency) return;
    setFilters(DEFAULT_FILTERS);
    setDraftFilters(DEFAULT_FILTERS);
    setColToggles(DEFAULT_COLUMN_TOGGLES);
    fetchReport(DEFAULT_FILTERS, DEFAULT_COLUMN_TOGGLES);
  }, [token, year, selectedCurrency]); // eslint-disable-line

  /* ════════════════════════════
     COMPARISON HEADER LABELS
  ════════════════════════════ */
  const { currentPeriodLabel, prevPeriodLabel, varianceLabel } = useMemo(() => {
    if (!isComparisonOn) return { currentPeriodLabel: "Current", prevPeriodLabel: "Previous", varianceLabel: "Variance" };
    const row = rows.find((r) => r.period && r.prev_period);
    if (!row) return { currentPeriodLabel: "Current", prevPeriodLabel: "Previous", varianceLabel: "Variance" };
    return {
      currentPeriodLabel: row.period,
      prevPeriodLabel:    row.prev_period,
      varianceLabel:      `${row.period} vs ${row.prev_period}`,
    };
  }, [rows, isComparisonOn]);

  /* ════════════════════════════
     CSV
  ════════════════════════════ */
  const csvData = useMemo(() => {
    if (!isComparisonOn) {
      // The AI Insights / Recommendation columns are screen-only (not row fields).
      const csvCols = visibleNormalCols.filter((c) => !c.startsWith("ai_"));
      return [csvCols, ...rows.map((r) => csvCols.map((c) => r?.[c] ?? ""))];
    }
    const header = [
      ...visibleLeftCols,
      "revenue_current", "revenue_previous", "revenue_variance",
      "cost_current", "cost_previous", "cost_variance",
      "profit_current", "profit_previous", "profit_variance",
      "pct_change_revenue", "pct_change_total_cost", "pct_change_profit",
    ];
    return [
      header,
      ...rows.map((r) => {
        const curRev    = parseCompactNumber(r?.revenue);
        const prevRev   = parseCompactNumber(r?.prev_revenue);
        const curCost   = parseCompactNumber(r?.total_cost);
        const prevCost  = parseCompactNumber(r?.prev_total_cost);
        const curProfit = parseCompactNumber(r?.profit);
        const prevProfit= parseCompactNumber(r?.prev_profit);
        return [
          ...visibleLeftCols.map((c) => r?.[c] ?? ""),
          r?.revenue ?? "", r?.prev_revenue ?? "",
          Number.isFinite(curRev) && Number.isFinite(prevRev) ? curRev - prevRev : "",
          r?.total_cost ?? "", r?.prev_total_cost ?? "",
          Number.isFinite(curCost) && Number.isFinite(prevCost) ? curCost - prevCost : "",
          r?.profit ?? "", r?.prev_profit ?? "",
          Number.isFinite(curProfit) && Number.isFinite(prevProfit) ? curProfit - prevProfit : "",
          r?.pct_change_revenue ?? "", r?.pct_change_total_cost ?? "", r?.pct_change_profit ?? "",
        ];
      }),
    ];
  }, [rows, isComparisonOn, visibleNormalCols, visibleLeftCols]);

  /* ════════════════════════════
     ACTIVE FILTER TAGS
  ════════════════════════════ */
  const activeTags = useMemo(() => {
    const tags = [];
    if (filters.comparison) tags.push(filters.comparison === "month_on_month" ? "Comparison: Month vs Month" : "Comparison: Year vs Year");
    if (filters.period !== "all") tags.push(`Period: ${PERIODS.find((x) => x.id === filters.period)?.label || filters.period}`);
    if (filters.date_from)       tags.push(`From: ${filters.date_from}`);
    if (filters.date_to)         tags.push(`To: ${filters.date_to}`);
    if (filters.currency_filter !== "actualvalue") tags.push(`Unit: ${CURRENCY_FILTERS.find((x) => x.id === filters.currency_filter)?.label || filters.currency_filter}`);
    if (filters.customer_name)   tags.push(`Customer: ${filters.customer_name}`);
    if (filters.industry)        tags.push(`Industry: ${filters.industry}`);
    if (filters.department_name) tags.push(`Department: ${filters.department_name}`);
    if (filters.region)          tags.push(`Region: ${filters.region}`);
    if (filters.entity_name)     tags.push(`Entity: ${filters.entity_name}`);
    if (filters.sales_person_id) {
      const sp = filterOptions.sales_persons.find((s) => s.id === filters.sales_person_id);
      tags.push(`Sales Person: ${sp?.name || filters.sales_person_id}`);
    }
    if (filters.sort_by !== "profit" || filters.sort_order !== "desc") {
      tags.push(`Sort: ${SORT_BY_OPTIONS.find((s) => s.id === filters.sort_by)?.label || filters.sort_by} (${filters.sort_order})`);
    }
    return tags;
  }, [filters, filterOptions.sales_persons]);

  /* ════════════════════════════
     REPORT AI (insights + saved commentary)
  ════════════════════════════ */
  // Sorting only reorders the rows, so it doesn't define a separate view.
  // Column toggles / "Show Period Columns" change the layout, not the
  // filtered data — they're part of viewKey instead.
  const { sort_by: _sortBy, sort_order: _sortOrder, ...commentaryFilters } = filters;

  const commentary = useReportCommentary({
    token,
    reportId: "customer_profit",
    year,
    currency: selectedCurrency,
    filters: commentaryFilters,
  });

  const insightFilterLabels = useMemo(
    () => activeTags.filter((t) => !t.startsWith("Sort:")),
    [activeTags],
  );

  const viewKey = `${year}|${selectedCurrency}|${JSON.stringify(filters)}|${JSON.stringify(colToggles)}|${showPeriodCols}`;

  /* ── Row commentary ("Refine with AI") + ✦ Explain with AI ── */
  const lineCommentary = useLineItemCommentary({
    token,
    reportId: "customer_profit",
    year,
    currency: selectedCurrency,
    filters: commentaryFilters,
  });

  const [refineLine, setRefineLine] = useState(null);
  const [analyzeTarget, setAnalyzeTarget] = useState(null);
  useEffect(() => {
    setRefineLine(null);
    setAnalyzeTarget(null);
  }, [viewKey]);

  const dimKeys = useMemo(
    () => COLUMN_TOGGLES.filter(({ flag }) => colToggles[flag]).map(({ key }) => key),
    [colToggles],
  );
  const rowLabel = useCallback((r) => customerRowLabel(r, dimKeys), [dimKeys]);

  // Commentary key + label per row, in `rows` order (the period pivot keeps
  // that order too), and a key → row map for the AI context builders.
  const rowIndex = useMemo(() => {
    const keys = [];
    const labels = [];
    const byKey = new Map();
    const lines = [];
    rows.forEach((r) => {
      const key = customerRowKey(r, dimKeys);
      const label = customerRowLabel(r, dimKeys);
      keys.push(key);
      labels.push(label);
      if (!byKey.has(key)) {
        byKey.set(key, r);
        lines.push({ key, label });
      }
    });
    return { keys, labels, byKey, lines };
  }, [rows, dimKeys]);

  const tableMode = showPeriodCols
    ? isComparisonOn ? "period_comparison" : "period"
    : isComparisonOn ? "comparison" : "normal";
  const valueScaleLabel = CURRENCY_FILTERS.find((c) => c.id === filters.currency_filter)?.label || "Actual";

  const openRefine = (i) => setRefineLine({ key: rowIndex.keys[i], label: rowIndex.labels[i] });

  // Built on click only (the drawer calls it with the row key).
  const buildLineItemContext = (key) => {
    const row = rowIndex.byKey.get(key);
    if (!row) return "";
    return buildCustomerLineContext({
      row,
      rows,
      labelOf: rowLabel,
      periods: apiPeriods,
      mode: tableMode,
      tableScale: valueScaleLabel,
      isComparisonOn,
      currentPeriodLabel,
      prevPeriodLabel,
    });
  };

  const loadAnalysisContext = async (target) =>
    buildCustomerProfitAnalysis({
      target,
      rows,
      rowByKey: rowIndex.byKey,
      labelOf: rowLabel,
      periods: apiPeriods,
      metrics,
      tableScale: valueScaleLabel,
      currentPeriodLabel,
      prevPeriodLabel,
    });

  // ✦ pinned to the value cell's top-right corner (the <td> is `relative`).
  const analyzeCellButton = (i, metric, value, period = null) => {
    const label = rowIndex.labels[i];
    const isChange = tableMode === "comparison" || tableMode === "period_comparison";
    const metricLabel = `${CP_METRIC_LABELS[metric]}${isChange ? " change" : ""}`;
    const title = `${metricLabel} — ${label}${period ? ` · ${period}` : ""}`;
    const body = isChange
      ? `AI explains what drove the change versus ${period ? "the compared period" : prevPeriodLabel} — revenue vs cost — and which other customers moved most, with supporting data, and answers follow-up questions.`
      : period
        ? "AI compares this period with the previous one for this customer (revenue, cost, profit) and its share of the portfolio's change, with supporting data, and answers follow-up questions."
        : "AI breaks down what drives this figure — revenue vs cost, margin vs the portfolio, rank and trend — with supporting data, and answers follow-up questions.";
    return (
      <AnalyzeButton
        onClick={() =>
          setAnalyzeTarget({ kind: "cell", component: "table", rowKey: rowIndex.keys[i], metric, period, mode: tableMode, title, value })
        }
        title={`Explain ${title} with AI`}
        tooltip={{ heading: "Explain with AI", context: [label, metricLabel, period, value].filter(Boolean).join(" · "), body }}
        className="absolute top-0 right-0 opacity-70 hover:opacity-100 focus:opacity-100"
      />
    );
  };

  const analyzeKpi = (metric, label, value) =>
    setAnalyzeTarget({ kind: "kpi", component: "kpi", metric, mode: tableMode, title: label, value });

  // Customer name + commentary button (the button stops its click from
  // reaching the cell's drilldown handler; the empty title keeps the cell's
  // "Click to view drilldown" tooltip off the button).
  const renderCustomerName = (r, i) => (
    <span className="inline-flex items-center gap-1">
      <strong>{r?.customer_name || "--"}</strong>
      <span title="" className="inline-flex">
        <LineItemAIButton
          label={rowIndex.labels[i]}
          noun="commentary"
          hasCommentary={!!lineCommentary.byLine[rowIndex.keys[i]]}
          onClick={() => openRefine(i)}
        />
      </span>
    </span>
  );

  const buildInsightsContext = () => {
    if (!rows.length) return "";
    const num = (v) => parseCompactNumber(v) ?? 0;
    const pctOf = (part, whole) => (whole ? (part / whole) * 100 : null);

    // Ranked by profit in code (not the on-screen sort) so the most important rows come first.
    const byProfit = [...rows].sort((a, b) => num(b.profit) - num(a.profit));
    const toAIRow = (r) => ({
      customer: rowLabel(r),
      profit_rank: byProfit.indexOf(r) + 1,
      revenue: r.revenue,
      total_cost: r.total_cost,
      profit: r.profit,
      pct_margin: r.pct_margin,
      ...(isComparisonOn && {
        prev_revenue: r.prev_revenue,
        prev_total_cost: r.prev_total_cost,
        prev_profit: r.prev_profit,
        pct_change_revenue: r.pct_change_revenue,
        pct_change_total_cost: r.pct_change_total_cost,
        pct_change_profit: r.pct_change_profit,
      }),
    });
    const top = byProfit.slice(0, 15);
    const lossMakingRows = byProfit
      .slice(top.length)
      .filter((r) => num(r.profit) < 0)
      .reverse()
      .slice(0, 10);

    // Customer-level facts — split rows are rolled up per customer.
    const byCustomer = new Map();
    rows.forEach((r) => {
      const name = r?.customer_name || "Unknown";
      const c = byCustomer.get(name) || { name, revenue: 0, profit: 0, prev_profit: 0 };
      c.revenue += num(r.revenue);
      c.profit += num(r.profit);
      c.prev_profit += num(r.prev_profit);
      byCustomer.set(name, c);
    });
    const customers = [...byCustomer.values()].sort((a, b) => b.profit - a.profit);
    const totalRevenue = customers.reduce((s, c) => s + c.revenue, 0);
    const totalProfit = customers.reduce((s, c) => s + c.profit, 0);
    const lossMakers = customers.filter((c) => c.profit < 0);
    const withRevenue = customers.filter((c) => c.revenue > 0);
    const top10Profit = customers.slice(0, 10).reduce((s, c) => s + c.profit, 0);
    const rankN = (list) => Math.min(5, Math.floor(list.length / 2));

    const facts = {
      customer_count: customers.length,
      row_count: rows.length !== customers.length ? rows.length : undefined,
      portfolio_margin_pct: pctOf(totalProfit, totalRevenue),
      loss_making_customers: {
        count: lossMakers.length,
        total_loss: lossMakers.reduce((s, c) => s + c.profit, 0),
      },
      top_10_customers_profit_share_pct: totalProfit > 0 ? pctOf(top10Profit, totalProfit) : undefined,
      customers_by_profit: customers.length > 1 ? rankForAI(customers, (c) => c.profit, (c) => c.name, rankN(customers)) : undefined,
      customers_by_margin_pct:
        withRevenue.length > 1
          ? rankForAI(withRevenue, (c) => pctOf(c.profit, c.revenue), (c) => c.name, rankN(withRevenue))
          : undefined,
      comparison: isComparisonOn
        ? {
            type: COMPARISONS.find((c) => c.id === filters.comparison)?.label || filters.comparison,
            current_period: currentPeriodLabel,
            previous_period: prevPeriodLabel,
            customers_by_profit_change:
              customers.length > 1
                ? rankForAI(customers, (c) => c.profit - c.prev_profit, (c) => c.name, rankN(customers))
                : undefined,
          }
        : undefined,
    };

    const { ai_insights: _aiInsights, ...keyMetrics } = metrics || {};
    const gt = grandTotal?.total || {};
    const gtMonths = grandTotal?.months || {};
    const sumRows = (key) => rows.reduce((s, r) => s + num(r[key]), 0);
    const grandRow = {
      customer: "Grand Total",
      revenue: gt.revenue ?? sumRows("revenue"),
      total_cost: gt.total_cost ?? sumRows("total_cost"),
      profit: gt.profit ?? totalProfit,
      pct_margin: gt.pct_margin ?? pctOf(totalProfit, totalRevenue),
      ...(isComparisonOn && {
        prev_revenue: sumRows("prev_revenue"),
        prev_total_cost: sumRows("prev_total_cost"),
        prev_profit: sumRows("prev_profit"),
      }),
      by_period: Object.fromEntries(
        Object.keys(gtMonths)
          .sort()
          .map((p) => {
            const m = gtMonths[p] || {};
            const c = m.comparisons;
            return [
              p,
              {
                revenue: m.revenue,
                total_cost: m.total_cost,
                profit: m.profit,
                pct_margin: m.pct_margin,
                ...(isComparisonOn && c && {
                  compare_period: c.compare_period,
                  compare_revenue: c.compare_revenue,
                  compare_profit: c.compare_profit,
                }),
              },
            ];
          }),
      ),
    };

    return buildReportAIContext({
      valueScale: CURRENCY_FILTERS.find((c) => c.id === filters.currency_filter)?.label || "Actual",
      notes: [
        "Profit = revenue − total cost; pct_margin = profit ÷ revenue × 100. Rows are customers (split by industry, region, entity or department when those columns are shown). A negative profit means the customer is loss-making.",
        isComparisonOn &&
          "prev_* values are the same customer's figures for the compared period (see comparison.previous_period) and pct_change_* = (current − previous) ÷ previous × 100.",
      ]
        .filter(Boolean)
        .join(" "),
      keyMetrics: metrics ? keyMetrics : undefined,
      facts,
      // Grand total first, then the top rows by profit and the loss-making rows (trimmed from the end if too long).
      rows: [grandRow, ...top.map(toAIRow), ...lossMakingRows.map(toAIRow)],
    });
  };

  const removeFilter = (tag) => {
    const updater = (prev) => {
      const next = { ...prev };
      if (tag.startsWith("Comparison:"))  next.comparison      = "";
      else if (tag.startsWith("Period:")) { next.period = "all"; next.date_from = ""; next.date_to = ""; }
      else if (tag.startsWith("From:"))   next.date_from       = "";
      else if (tag.startsWith("To:"))     next.date_to         = "";
      else if (tag.startsWith("Unit:"))   next.currency_filter = "actualvalue";
      else if (tag.startsWith("Customer:"))   next.customer_name   = "";
      else if (tag.startsWith("Industry:"))   next.industry        = "";
      else if (tag.startsWith("Department:")) next.department_name = "";
      else if (tag.startsWith("Region:"))     next.region          = "";
      else if (tag.startsWith("Entity:"))     next.entity_name     = "";
      else if (tag.startsWith("Sales Person:")) next.sales_person_id = "";
      else if (tag.startsWith("Sort:"))   { next.sort_by = "profit"; next.sort_order = "desc"; }
      return next;
    };
    const next = updater(filters);
    setFilters(next); setDraftFilters(next); fetchReport(next, colToggles);
  };

  const onCancelDraft = () => { setDraftFilters(filters); setOpen(false); };

  const onResetAll = () => {
    setFilters(DEFAULT_FILTERS); setDraftFilters(DEFAULT_FILTERS);
    setOpen(false); fetchReport(DEFAULT_FILTERS, colToggles);
  };

  const onApply = () => {
    const applied = { ...draftFilters };
    setFilters(applied); setOpen(false); fetchReport(applied, colToggles);
  };

  /* ════════════════════════════
     COLUMN SORT
  ════════════════════════════ */
  const onColumnSort = (col) => {
    const nextOrder = filters.sort_by === col && filters.sort_order === "asc" ? "desc" : "asc";
    const next      = { ...filters, sort_by: col, sort_order: nextOrder };
    setFilters(next); setDraftFilters(next); fetchReport(next, colToggles);
  };

  const SortArrow = ({ col }) => {
    if (filters.sort_by !== col) return <span className="text-white/40 ml-1 text-[10px]">⇅</span>;
    return <span className="text-white ml-1 text-[10px]">{filters.sort_order === "asc" ? "↑" : "↓"}</span>;
  };

  /* ── Normal table cell renderer ── */
  const renderNormalCell = (r, c, i) => {
    if (c === "ai_insights") {
      // Saved row commentary (one per row for this view) wins over the rule-based text.
      const saved = lineCommentary.byLine[rowIndex.keys[i]];
      const text = saved?.explanation || customerProfitInsightMap.get(r?.customer_name) || "—";
      return (
        <p className="line-clamp-2 leading-snug" title={text}>
          {saved?.explanation && (
            <BsChatLeftTextFill size={11} className="inline mr-1 align-[-1px] text-emerald-600" aria-label="Saved AI commentary" />
          )}
          {text}
        </p>
      );
    }
    if (c === "ai_recommendation") {
      const saved = lineCommentary.byLine[rowIndex.keys[i]];
      return saved?.recommendation ? (
        <p className="line-clamp-2 leading-snug" title={saved.recommendation}>
          {saved.recommendation}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => openRefine(i)}
          className="inline-flex items-center gap-1 text-sky-500 hover:text-sky-800 whitespace-nowrap"
        >
          <BsChatLeftText size={12} /> Get AI recommendation
        </button>
      );
    }
    if (c === "pct_margin") {
      const n = Number(r[c]);
      const cls = n >= 0 ? "text-emerald-600" : "text-red-600";
      return <span className={`font-medium ${cls}`}>{formatPct(r[c])}</span>;
    }
    if (c === "profit") {
      const n = parseCompactNumber(r[c]);
      const cls = n !== null && n >= 0 ? "text-emerald-600 font-medium" : "text-red-600 font-medium";
      return <span className={cls}>{formatMoneySmart(r[c])}</span>;
    }
    if (["revenue", "total_cost"].includes(c)) return formatMoneySmart(r[c]);
    if (c === "customer_name") return renderCustomerName(r, i);
    return r?.[c] || "--";
  };

  /* ── Grand Total row renderer for normal table ── */
  const renderGrandTotalCell = (c, idx) => {
    if (idx === 0) return <strong>📊 Grand Total</strong>;
    const val = grandTotal?.total?.[c] ?? grandTotal?.[c];
    if (c === "pct_margin") {
      const n = Number(val);
      const cls = n >= 0 ? "text-emerald-600" : "text-red-600";
      return <span className={`font-semibold ${cls}`}>{formatPct(val)}</span>;
    }
    if (c === "profit") {
      const n = parseCompactNumber(val);
      const cls = n !== null && n >= 0 ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold";
      return <span className={cls}>{formatMoneySmart(val)}</span>;
    }
    if (["revenue", "total_cost"].includes(c)) return <strong>{formatMoneySmart(val)}</strong>;
    return "";
  };

  /* ── KPI variant ── */
  const kpiVariant = (v) => {
    const n = Number(v);
    if (isNaN(n) || n === 0) return "default";
    return n > 0 ? "positive" : "negative";
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
              <h2 className="text-lg font-semibold text-sky-900">Customer Profitability</h2>
              <p className="text-s text-sky-600">Revenue · Cost · Profit · Margin by Customer | MoM / YoY Comparison</p>
            </div>
            <p className="text-s bg-yellow-100 text-sky-900 px-2 py-0.5 rounded-md mt-1 inline-block">
              <strong>Note:</strong> Click any <strong>CUSTOMER NAME</strong> for drilldown insights · click{" "}
              <BsStars className="inline text-sky-600 align-[-2px]" /> on a value for an AI explanation · click{" "}
              <BsChatLeftText className="inline text-sky-600 align-[-2px]" /> for AI commentary
            </p>
          </div>
          <Link
            to="/customer-profit-dashboard"
            className="flex shrink-0 items-center whitespace-nowrap py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg hover:bg-white hover:text-sky-900 transition border border-sky-900"
          >
            View More <FaArrowRightToBracket className="ml-1" />
          </Link>
        </div>

        {/* ══════════════════════════════════════════
            KPI CARDS  ← from HTML reference
        ══════════════════════════════════════════ */}
        {/* {metrics && (
          <div className="flex flex-wrap gap-3 mb-4">
            <KpiCard icon="💰" label="Total Revenue" value={fmtKpi(metrics.total_revenue)} sub="Total revenue" />
            <KpiCard icon="📦" label="Total Cost"    value={fmtKpi(metrics.total_cost)}    sub="Allocated cost" />
            <KpiCard
              icon="💵"
              label="Total Profit"
              value={fmtKpi(metrics.total_profit)}
              sub="Revenue − Cost"
              variant={kpiVariant(metrics.total_profit)}
            />
            <KpiCard
              icon="📈"
              label="Margin %"
              value={formatPct(metrics.margin)}
              sub="Profit / Revenue"
              variant={kpiVariant(metrics.margin)}
            />
            <KpiCard
              icon="🏆"
              label="Top Customer"
              value={fmtKpi(metrics.highest_revenue)}
              sub="Highest revenue"
              variant="positive"
            />
          </div>
        )} */}

        {/* ── FILTER BAR ── */}
        <div className="mb-3 flex items-start justify-between gap-3 flex-wrap" ref={ref}>

          {/* Active tags */}
          <div className="flex flex-wrap gap-2 mr-auto min-h-[34px]">
            {activeTags.length === 0 ? (
              <span className="text-x text-sky-400 italic">No filters applied</span>
            ) : (
              activeTags.map((t) => (
                <span key={t} className="flex items-center gap-2 px-3 py-1 text-x rounded-full bg-sky-800 text-white">
                  {t}
                  <button onClick={() => removeFilter(t)} className="text-sky-200 hover:text-white font-bold" title="Remove">×</button>
                </span>
              ))
            )}
          </div>

          <div className="flex items-center gap-2 relative">

            {/* Filter dropdown */}
            <div className="relative">
              <button
                onClick={() => { if (!open) setDraftFilters(filters); setOpen(!open); }}
                aria-label="Filters"
                className={`relative group flex items-center px-3 py-2.5 text-x font-medium rounded-lg border transition
                  ${isDirty && open ? "bg-amber-50 border-amber-300 text-amber-800" : "bg-sky-100 border-sky-200 text-sky-800 hover:bg-sky-200"}`}
              >
                <FiFilter size={14} />
                <ActionHoverLabel>Filters</ActionHoverLabel>
              </button>

              <AnimatePresence>
                {open && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute right-0 mt-2 w-[560px] bg-sky-50 border border-sky-200 rounded-xl shadow-lg z-50"
                  >
                    <div className="p-4 grid grid-cols-2 gap-3 text-x">
                      <Select
                        label="Period"
                        value={draftFilters.period}
                        options={PERIODS.map((p) => ({ value: p.id, label: p.label }))}
                        onChange={(v) => setDraftFilters((f) => ({ ...f, period: v }))}
                      />
                      <Select
                        label="Currency Unit"
                        value={draftFilters.currency_filter}
                        options={CURRENCY_FILTERS.map((c) => ({ value: c.id, label: c.label }))}
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
                        options={COMPARISONS.map((c) => ({ value: c.id, label: c.label }))}
                        onChange={(v) => setDraftFilters((f) => ({ ...f, comparison: v }))}
                      />
                      <Select
                        label="Sales Person"
                        value={draftFilters.sales_person_id || "All"}
                        options={[{ value: "All", label: "All" }, ...filterOptions.sales_persons.map((s) => ({ value: s.id, label: s.name }))]}
                        onChange={(v) => setDraftFilters((f) => ({ ...f, sales_person_id: v === "All" ? "" : v }))}
                      />
                      <Select
                        label="Customer"
                        value={draftFilters.customer_name || "All"}
                        options={[{ value: "All", label: "All" }, ...draftCustomerOptions.map((x) => ({ value: x, label: x }))]}
                        onChange={(v) => setDraftFilters((f) => ({ ...f, customer_name: v === "All" ? "" : v }))}
                      />
                      <Select
                        label="Industry"
                        value={draftFilters.industry || "All"}
                        options={[{ value: "All", label: "All" }, ...filterOptions.industries.map((x) => ({ value: x, label: x }))]}
                        onChange={(v) => setDraftFilters((f) => ({ ...f, industry: v === "All" ? "" : v }))}
                      />
                      <Select
                        label="Department"
                        value={draftFilters.department_name || "All"}
                        options={[{ value: "All", label: "All" }, ...filterOptions.departments.map((x) => ({ value: x, label: x }))]}
                        onChange={(v) => setDraftFilters((f) => ({ ...f, department_name: v === "All" ? "" : v }))}
                      />
                      <Select
                        label="Region"
                        value={draftFilters.region || "All"}
                        options={[{ value: "All", label: "All" }, ...filterOptions.regions.map((x) => ({ value: x, label: x }))]}
                        onChange={(v) => setDraftFilters((f) => ({ ...f, region: v === "All" ? "" : v }))}
                      />
                      <Select
                        label="Entity"
                        value={draftFilters.entity_name || "All"}
                        options={[{ value: "All", label: "All" }, ...filterOptions.entities.map((x) => ({ value: x, label: x }))]}
                        onChange={(v) => setDraftFilters((f) => ({ ...f, entity_name: v === "All" ? "" : v }))}
                      />
                      <Select
                        label="Sort By"
                        value={draftFilters.sort_by}
                        options={SORT_BY_OPTIONS.map((s) => ({ value: s.id, label: s.label }))}
                        onChange={(v) => setDraftFilters((f) => ({ ...f, sort_by: v }))}
                      />
                      <Select
                        label="Sort Order"
                        value={draftFilters.sort_order}
                        options={SORT_ORDER_OPTIONS.map((s) => ({ value: s.id, label: s.label }))}
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
              filename={`Customer_Profitability_${year}_${selectedCurrency}.csv`}
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
              reportType="customer_profitability"
              reportLabel="Customer Profitability Report"
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
              reportId="customer_profit"
              showTableHelp
              insights={{
                commentary,
                reportLabel: "Customer Profitability",
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

            {/* Period columns toggle — frontend only, pivots rows by period */}
            <label className="inline-flex items-center gap-1.5 text-x font-medium text-sky-800 cursor-pointer select-none border-l border-sky-200 pl-4 ml-1">
              <input
                type="checkbox"
                checked={showPeriodCols}
                onChange={() => setShowPeriodCols((v) => !v)}
                className="h-3.5 w-3.5 rounded border-sky-300 text-sky-800 focus:ring-sky-500"
              />
              Show Period Columns
            </label>
          </div>
          <span className="text-[11px] font-semibold text-sky-600">Click column headers to sort ↕️</span>
        </div>

        {loading && <TableSkeleton />}

        {/* ══════════════════════════════════════════
            NORMAL TABLE (no comparison)
        ══════════════════════════════════════════ */}
        {!loading && rows.length > 0 && !isComparisonOn && !showPeriodCols && (
          <div className="report-table-scroll overflow-auto mt-2 max-h-[420px] border border-sky-200 rounded-lg bg-white">
            <table className="min-w-[900px] w-full text-x">
              <thead className="sticky top-0 bg-sky-900 text-white z-10">
                <tr>
                  {visibleNormalCols.map((c) => {
                    const sortKey = SORTABLE_COLS[c];
                    const isInsight = c === "ai_insights";
                    return (
                      <th
                        key={c}
                        className={[
                          "px-3 py-1.5 text-left font-semibold whitespace-nowrap",
                          ["revenue", "total_cost", "profit", "pct_margin"].includes(c) ? "text-right" : "",
                          sortKey ? "cursor-pointer select-none hover:bg-sky-800" : "",
                        ].join(" ")}
                        onClick={sortKey ? () => onColumnSort(sortKey) : undefined}
                      >
                        {isInsight ? "Insights" : c === "ai_recommendation" ? "Recommendation" : c.replace(/_/g, " ").toUpperCase()}
                        {sortKey && <SortArrow col={sortKey} />}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {rows.map((r, i) => (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.012, 0.3) }}
                    className="border-b border-sky-50 hover:bg-sky-50 transition-colors text-sky-900"
                  >
                    {visibleNormalCols.map((c) => {
                      const isCustomer = c === "customer_name";
                      const isNum = ["revenue", "total_cost", "profit", "pct_margin"].includes(c);
                      const isInsight = c === "ai_insights";
                      const isRecommendation = c === "ai_recommendation";
                      return (
                        <td
                          key={c}
                          className={[
                            "px-3 py-2",
                            isInsight
                              ? "w-[380px] min-w-[380px] text-sky-700"
                              : isRecommendation
                                ? "w-[340px] min-w-[340px] text-sky-700"
                                : "whitespace-nowrap",
                            isNum ? "relative text-right" : "",
                            isCustomer ? "hover:text-blue-600 cursor-pointer font-medium" : "",
                          ].join(" ")}
                          onClick={isCustomer ? () => { const name = r?.customer_name || ""; if (!name) return; setDrillCustomer(name); setDrillOpen(true); } : undefined}
                          role={isCustomer ? "button" : undefined}
                          tabIndex={isCustomer ? 0 : undefined}
                          onKeyDown={isCustomer ? (e) => { if (e.target !== e.currentTarget) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); const name = r?.customer_name || ""; if (!name) return; setDrillCustomer(name); setDrillOpen(true); } } : undefined}
                          title={isCustomer ? "Click to view drilldown" : undefined}
                        >
                          {isNum && analyzeCellButton(i, c, c === "pct_margin" ? formatPct(r[c]) : formatMoneySmart(r[c]))}
                          {renderNormalCell(r, c, i)}
                        </td>
                      );
                    })}
                  </motion.tr>
                ))}

                {/* Grand Total sticky row */}
                {grandTotal && (
                  <tr className="sticky bottom-0 bg-sky-50 border-t-2 border-sky-200 font-semibold text-sky-900">
                    {visibleNormalCols.map((c, idx) => (
                      <td
                        key={c}
                        className={[
                          "px-3 py-3 whitespace-nowrap",
                          ["revenue", "total_cost", "profit", "pct_margin"].includes(c) ? "text-right" : "",
                        ].join(" ")}
                      >
                        {renderGrandTotalCell(c, idx)}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ══════════════════════════════════════════
            PERIOD PIVOT TABLE
        ══════════════════════════════════════════ */}
        {!loading && showPeriodCols && (
          periodPivot.periods.length > 0 ? (() => {
            const headerRows  = isComparisonOn ? 3 : 2;
            const periodCols  = isComparisonOn ? 10 : 4; // 3×3 metrics + Margin% = 10
            const totalCols   = 4;
            const dimCount    = COLUMN_TOGGLES.filter(({ flag }) => colToggles[flag]).length;
            const minW        = 200 + dimCount * 120 + periodPivot.periods.length * (isComparisonOn ? 520 : 260) + 220;

            const thSub = "px-2 py-2 text-right whitespace-nowrap border-l border-white/20 font-medium text-[11px]";
            const tdBase = "px-2 py-2.5 text-right whitespace-nowrap border-l border-sky-100 text-[11px]";

            const renderVarPill = (val) => {
              const n = parseCompactNumber(val);
              const s = diffStyle(n);
              return (
                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${s.pill}`}>
                  {s.arrow} {n === null ? "—" : formatMoneySmart(n)}
                </span>
              );
            };

            // `i` = the row's index (for its ✦ buttons); omitted for the Grand Total row.
            const renderPeriodCells = (pd, p, i) => {
              const canAnalyze = i !== undefined && Object.keys(pd).length > 0;
              if (!isComparisonOn) {
                const pNum = parseCompactNumber(pd.profit);
                const mNum = Number(pd.pct_margin);
                return (
                  <>
                    <td className={tdBase}>{formatMoneySmart(pd.revenue)}</td>
                    <td className={tdBase}>{formatMoneySmart(pd.total_cost)}</td>
                    <td className={`${tdBase} relative`}>
                      {canAnalyze && analyzeCellButton(i, "profit", formatMoneySmart(pd.profit), p)}
                      <span className={pNum !== null && pNum >= 0 ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>
                        {formatMoneySmart(pd.profit)}
                      </span>
                    </td>
                    <td className={`${tdBase} relative`}>
                      {canAnalyze && analyzeCellButton(i, "pct_margin", formatPct(pd.pct_margin), p)}
                      <span className={!isNaN(mNum) && mNum >= 0 ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>
                        {formatPct(pd.pct_margin)}
                      </span>
                    </td>
                  </>
                );
              }
              const c = pd.comparisons || {};
              const mNum = Number(pd.pct_margin);
              return (
                <>
                  {/* Revenue */}
                  <td className={tdBase}>{formatMoneySmart(c.current_revenue ?? pd.revenue)}</td>
                  <td className={`${tdBase} text-sky-500`}>{formatMoneySmart(c.compare_revenue)}</td>
                  <td className={tdBase}>{renderVarPill(c.variance)}</td>
                  {/* Cost */}
                  <td className={tdBase}>{formatMoneySmart(c.current_total_cost ?? pd.total_cost)}</td>
                  <td className={`${tdBase} text-sky-500`}>{formatMoneySmart(c.compare_total_cost)}</td>
                  <td className={tdBase}>{renderVarPill(c.variance_total_cost)}</td>
                  {/* Profit */}
                  <td className={tdBase}>{formatMoneySmart(c.current_profit ?? pd.profit)}</td>
                  <td className={`${tdBase} text-sky-500`}>{formatMoneySmart(c.compare_profit)}</td>
                  <td className={`${tdBase} relative`}>
                    {canAnalyze && pd.comparisons && analyzeCellButton(i, "profit", formatMoneySmart(c.variance_profit), p)}
                    {renderVarPill(c.variance_profit)}
                  </td>
                  {/* Margin% */}
                  <td className={tdBase}>
                    <span className={!isNaN(mNum) && mNum >= 0 ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>
                      {formatPct(pd.pct_margin)}
                    </span>
                  </td>
                </>
              );
            };

            const renderTotalCells = (tot, isBold) => {
              const pNum = parseCompactNumber(tot?.profit);
              const mNum = Number(tot?.pct_margin);
              const W = isBold ? "font-semibold" : "";
              return (
                <>
                  <td className={`${tdBase} ${W}`}>{formatMoneySmart(tot?.revenue)}</td>
                  <td className={`${tdBase} ${W}`}>{formatMoneySmart(tot?.total_cost)}</td>
                  <td className={`${tdBase} ${W}`}>
                    <span className={pNum !== null && pNum >= 0 ? "text-emerald-600" : "text-red-600"}>
                      {formatMoneySmart(tot?.profit)}
                    </span>
                  </td>
                  <td className={`${tdBase} ${W}`}>
                    <span className={!isNaN(mNum) && mNum >= 0 ? "text-emerald-600" : "text-red-600"}>
                      {formatPct(tot?.pct_margin)}
                    </span>
                  </td>
                </>
              );
            };

            return (
              <div className="report-table-scroll overflow-auto mt-2 max-h-[420px] border border-sky-200 rounded-lg bg-white">
                <table className="w-full text-x" style={{ minWidth: `${minW}px` }}>
                  <thead className="sticky top-0 z-10">

                    {/* ── Row 1: Customer | dims | period groups | Total ── */}
                    <tr className="bg-sky-900 text-white">
                      <th rowSpan={headerRows} className="px-3 py-1.5 text-left whitespace-nowrap border-r border-white/20 cursor-pointer hover:bg-sky-800 select-none" onClick={() => onColumnSort("customer_name")}>
                        CUSTOMER NAME <SortArrow col="customer_name" />
                      </th>
                      {COLUMN_TOGGLES.map(({ flag, key, label }) =>
                        colToggles[flag] ? (
                          <th key={key} rowSpan={headerRows} className="px-3 py-1.5 text-left whitespace-nowrap border-l border-white/20">
                            {label.toUpperCase()}
                          </th>
                        ) : null
                      )}
                      {periodPivot.periods.map((p) => (
                        <th key={p} colSpan={periodCols} className="px-3 py-1 text-center border-l border-white/20 font-semibold tracking-wide">
                          {p}
                        </th>
                      ))}
                      <th colSpan={totalCols} className="px-3 py-1 text-center border-l border-white/30 font-semibold tracking-wide bg-sky-950">
                        TOTAL
                      </th>
                    </tr>

                    {/* ── Row 2: metric group headers per period (always) ── */}
                    <tr className="bg-sky-800 text-white text-[11px]">
                      {periodPivot.periods.map((p) =>
                        isComparisonOn ? (
                          <React.Fragment key={p}>
                            <th colSpan={3} className={`${thSub} text-center`}>REVENUE</th>
                            <th colSpan={3} className={`${thSub} text-center`}>COST</th>
                            <th colSpan={3} className={`${thSub} text-center`}>PROFIT</th>
                            <th rowSpan={2} className={`${thSub} align-middle`}>MARGIN%</th>
                          </React.Fragment>
                        ) : (
                          <React.Fragment key={p}>
                            <th className={thSub}>Revenue</th>
                            <th className={thSub}>Cost</th>
                            <th className={thSub}>Profit</th>
                            <th className={thSub}>Margin%</th>
                          </React.Fragment>
                        )
                      )}
                      {/* Total sub-headers row 2 */}
                      {isComparisonOn ? (
                        <>
                          <th rowSpan={2} className={`${thSub} bg-sky-950 align-middle`}>Revenue</th>
                          <th rowSpan={2} className={`${thSub} bg-sky-950 align-middle`}>Cost</th>
                          <th rowSpan={2} className={`${thSub} bg-sky-950 align-middle`}>Profit</th>
                          <th rowSpan={2} className={`${thSub} bg-sky-950 align-middle`}>Margin%</th>
                        </>
                      ) : (
                        <>
                          <th className={`${thSub} bg-sky-950`}>Revenue</th>
                          <th className={`${thSub} bg-sky-950`}>Cost</th>
                          <th className={`${thSub} bg-sky-950`}>Profit</th>
                          <th className={`${thSub} bg-sky-950`}>Margin%</th>
                        </>
                      )}
                    </tr>

                    {/* ── Row 3: Curr / Prev / Var per metric (comparison only) ── */}
                    {isComparisonOn && (
                      <tr className="bg-sky-700 text-white text-[10px]">
                        {periodPivot.periods.map((p) => (
                          <React.Fragment key={p}>
                            {["REV", "COST", "PROFIT"].map((m) => (
                              <React.Fragment key={m}>
                                <th className={thSub}>Curr</th>
                                <th className={thSub}>Prev</th>
                                <th className={thSub}>Var</th>
                              </React.Fragment>
                            ))}
                          </React.Fragment>
                        ))}
                        {/* Total spans rows 2-3 via rowSpan above, nothing here */}
                      </tr>
                    )}
                  </thead>

                  <tbody>
                    {periodPivot.pivot.map((r, i) => (
                      <motion.tr
                        key={i}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.012, 0.3) }}
                        className="border-b border-sky-50 hover:bg-sky-50 transition-colors text-sky-900"
                      >
                        <td
                          className="px-3 py-2.5 whitespace-nowrap font-medium hover:text-blue-600 cursor-pointer border-r border-sky-100 text-[11px]"
                          onClick={() => { const n = r?.customer_name || ""; if (n) { setDrillCustomer(n); setDrillOpen(true); } }}
                          role="button" tabIndex={0}
                          onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); const n = r?.customer_name || ""; if (n) { setDrillCustomer(n); setDrillOpen(true); } } }}
                          title="Click to view drilldown"
                        >
                          {renderCustomerName(r, i)}
                        </td>
                        {COLUMN_TOGGLES.map(({ flag, key }) =>
                          colToggles[flag] ? (
                            <td key={key} className="px-2 py-2.5 whitespace-nowrap border-l border-sky-100 text-[11px]">{r[key] || "--"}</td>
                          ) : null
                        )}
                        {periodPivot.periods.map((p) => (
                          <React.Fragment key={p}>
                            {renderPeriodCells(r.months[p] || {}, p, i)}
                          </React.Fragment>
                        ))}
                        {renderTotalCells(r.total, false)}
                      </motion.tr>
                    ))}

                    {/* ── Grand Total sticky row ── */}
                    {periodPivot.pivot.length > 0 && (
                      <tr className="sticky bottom-0 bg-sky-50 border-t-2 border-sky-200 font-semibold text-sky-900">
                        <td className="px-3 py-2.5 whitespace-nowrap border-r border-sky-200 text-[11px]">
                          <strong>📊 Grand Total</strong>
                        </td>
                        {COLUMN_TOGGLES.map(({ flag, key }) =>
                          colToggles[flag] ? <td key={key} className="px-2 py-2.5 border-l border-sky-100"></td> : null
                        )}
                        {periodPivot.periods.map((p) => (
                          <React.Fragment key={p}>
                            {renderPeriodCells(periodGrandTotals[p] || {}, p)}
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
            COMPARISON TABLE (MoM / YoY)
        ══════════════════════════════════════════ */}
        {!loading && rows.length > 0 && isComparisonOn && !showPeriodCols && (
          <div className="report-table-scroll overflow-auto mt-2 max-h-[420px] border border-sky-200 rounded-lg bg-white">
            <table className="min-w-[1650px] w-full text-x">
              <thead className="sticky top-0 z-20">
                <tr className="bg-sky-900 text-white">
                  {visibleLeftCols.map((c) => {
                    const sortKey = SORTABLE_COLS[c];
                    return (
                      <th
                        key={c}
                        rowSpan={2}
                        className={[
                          "px-3 py-1.5 text-left whitespace-nowrap border-l border-white/15 align-middle",
                          sortKey ? "cursor-pointer select-none hover:bg-sky-800" : "",
                        ].join(" ")}
                        onClick={sortKey ? () => onColumnSort(sortKey) : undefined}
                      >
                        {c.replace(/_/g, " ").toUpperCase()}
                        {sortKey && <SortArrow col={sortKey} />}
                      </th>
                    );
                  })}
                  <th colSpan={3} className="px-4 py-1.5 text-left border-l border-white/20 cursor-pointer select-none hover:bg-sky-800" onClick={() => onColumnSort("revenue")}>
                    REVENUE<SortArrow col="revenue" />
                  </th>
                  <th colSpan={3} className="px-4 py-1.5 text-left border-l border-white/20 cursor-pointer select-none hover:bg-sky-800" onClick={() => onColumnSort("total_cost")}>
                    TOTAL COST<SortArrow col="total_cost" />
                  </th>
                  <th colSpan={3} className="px-4 py-1.5 text-left border-l border-white/20 cursor-pointer select-none hover:bg-sky-800" onClick={() => onColumnSort("profit")}>
                    PROFIT<SortArrow col="profit" />
                  </th>
                </tr>

                <tr className="bg-sky-800 text-white">
                  {["REVENUE", "TOTAL COST", "PROFIT"].map((grp) => [
                    <th key={`${grp}-cur`}  className="px-4 py-1.5 text-left border-l border-white/15"><HeaderDates top={currentPeriodLabel} bottom="Current"  /></th>,
                    <th key={`${grp}-prev`} className="px-4 py-1.5 text-left border-l border-white/15"><HeaderDates top={prevPeriodLabel}    bottom="Previous" /></th>,
                    <th key={`${grp}-diff`} className="px-4 py-1.5 text-left border-l border-white/15"><HeaderDates top={varianceLabel}       bottom="Variance" /></th>,
                  ])}
                </tr>
              </thead>

              <tbody>
                {rows.map((r, i) => {
                  const curRev    = parseCompactNumber(r?.revenue);
                  const prevRev   = parseCompactNumber(r?.prev_revenue);
                  const revDiff   = curRev !== null && prevRev !== null ? curRev - prevRev : null;

                  const curCost   = parseCompactNumber(r?.total_cost);
                  const prevCost  = parseCompactNumber(r?.prev_total_cost);
                  const costDiff  = Number.isFinite(curCost) && Number.isFinite(prevCost) ? curCost - prevCost : null;

                  const curProfit = parseCompactNumber(r?.profit);
                  const prevProfit= parseCompactNumber(r?.prev_profit);
                  const profitDiff= Number.isFinite(curProfit) && Number.isFinite(prevProfit) ? curProfit - prevProfit : null;

                  const rs = diffStyle(revDiff);
                  const cs = diffStyle(costDiff);
                  const ps = diffStyle(profitDiff);

                  const revPct  = pctInline(r?.pct_change_revenue);
                  const costPct = pctInline(r?.pct_change_total_cost);
                  const profPct = pctInline(r?.pct_change_profit);

                  return (
                    <motion.tr
                      key={i}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.012, 0.3) }}
                      className="border-b text-sky-900 hover:bg-sky-50 transition-colors"
                    >
                      {visibleLeftCols.map((c) => (
                        <td
                          key={`${i}-${c}`}
                          className={[
                            "px-3 py-3 whitespace-nowrap border-r border-sky-100",
                            c === "customer_name" ? "hover:text-blue-600 cursor-pointer font-medium" : "",
                          ].join(" ")}
                          onClick={c === "customer_name" ? () => { const name = r?.customer_name || ""; if (!name) return; setDrillCustomer(name); setDrillOpen(true); } : undefined}
                          role={c === "customer_name" ? "button" : undefined}
                          tabIndex={c === "customer_name" ? 0 : undefined}
                          title={c === "customer_name" ? "Click to view drilldown" : undefined}
                        >
                          {c === "customer_name" ? renderCustomerName(r, i) : (r?.[c] || "--")}
                        </td>
                      ))}

                      {/* REVENUE */}
                      <td className="px-4 py-3 whitespace-nowrap border-l border-sky-100 text-right">{formatMoneySmart(r?.revenue)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sky-500">{formatMoneySmart(r?.prev_revenue)}</td>
                      <td className={`relative pl-4 pr-6 py-3 whitespace-nowrap ${rs.cellBg}`}>
                        {revDiff !== null && analyzeCellButton(i, "revenue", formatMoneySmart(revDiff))}
                        <div className="flex items-center gap-2 justify-end">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold ${rs.pill}`}>
                            <span className="text-[10px]">{rs.arrow}</span>
                            {revDiff === null ? "—" : formatMoneySmart(revDiff)}
                          </span>
                          {revPct && <span className={["inline-flex items-center px-2 py-[2px] rounded-full text-[11px] font-semibold bg-white/70 border border-sky-100", revPct.cls].join(" ")}>{revPct.text}</span>}
                        </div>
                      </td>

                      {/* TOTAL COST */}
                      <td className="px-4 py-3 whitespace-nowrap border-l border-sky-100 text-right">{formatMoneySmart(r?.total_cost)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sky-500">{formatMoneySmart(r?.prev_total_cost)}</td>
                      <td className={`relative pl-4 pr-6 py-3 whitespace-nowrap ${cs.cellBg}`}>
                        {costDiff !== null && analyzeCellButton(i, "total_cost", formatMoneySmart(costDiff))}
                        <div className="flex items-center gap-2 justify-end">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold ${cs.pill}`}>
                            <span className="text-[10px]">{cs.arrow}</span>
                            {costDiff === null ? "—" : formatMoneySmart(costDiff)}
                          </span>
                          {costPct && <span className={["inline-flex items-center px-2 py-[2px] rounded-full text-[11px] font-semibold bg-white/70 border border-sky-100", costPct.cls].join(" ")}>{costPct.text}</span>}
                        </div>
                      </td>

                      {/* PROFIT */}
                      <td className="px-4 py-3 whitespace-nowrap border-l border-sky-100 text-right">{formatMoneySmart(r?.profit)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sky-500">{formatMoneySmart(r?.prev_profit)}</td>
                      <td className={`relative pl-4 pr-6 py-3 whitespace-nowrap ${ps.cellBg}`}>
                        {profitDiff !== null && analyzeCellButton(i, "profit", formatMoneySmart(profitDiff))}
                        <div className="flex items-center gap-2 justify-end">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold ${ps.pill}`}>
                            <span className="text-[10px]">{ps.arrow}</span>
                            {profitDiff === null ? "—" : formatMoneySmart(profitDiff)}
                          </span>
                          {profPct && <span className={["inline-flex items-center px-2 py-[2px] rounded-full text-[11px] font-semibold bg-white/70 border border-sky-100", profPct.cls].join(" ")}>{profPct.text}</span>}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── EMPTY STATE ── */}
        {!loading && rows.length === 0 && !showPeriodCols && (
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
                <h3 className="text-s font-semibold text-sky-900">Key Customer Metrics</h3>
                {[
                  ["total_revenue", "Total Revenue"],
                  ["total_cost", "Total Cost"],
                  ["total_profit", "Total Profit"],
                  ["margin", "Margin %", true],
                  ["highest_revenue", "Highest Revenue"],
                  ["lowest_revenue", "Lowest Revenue"],
                  ["average_revenue", "Average Revenue"],
                ].map(([key, label, isPercent]) => (
                  <MetricRow
                    key={key}
                    label={label}
                    value={metrics[key]}
                    isPercent={!!isPercent}
                    onAnalyze={
                      rows.length
                        ? () => analyzeKpi(key, label, isPercent ? formatPct(metrics[key]) : formatMoneySmart(metrics[key]))
                        : undefined
                    }
                  />
                ))}
              </div>
              <div className="bg-sky-50 md:col-span-2 border border-sky-200 rounded-lg p-3 flex flex-col justify-center gap-2">
                <h4 className="text-x font-semibold text-sky-900 mb-1">Executive Financial Insight</h4>
                {customerProfitExecutive.map((para, i) => (
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
            onRefine={(line) => setRefineLine({ key: line.key, label: line.label })}
            title="Customer Commentary"
          />
        )}

        <LineItemRefineWithAI
          line={refineLine}
          onClose={() => setRefineLine(null)}
          lineCommentary={lineCommentary}
          reportLabel="Customer Profitability"
          filterLabels={insightFilterLabels}
          buildContext={buildLineItemContext}
          subtitle="profitability explanation & recommendation"
        />

        {!loading && <ReportCommentary commentary={commentary} />}

        <AnalyzeWithAI
          target={analyzeTarget}
          onClose={() => setAnalyzeTarget(null)}
          token={token}
          reportId="customer_profit"
          reportLabel="Customer Profitability"
          year={year}
          currency={selectedCurrency}
          filterLabels={insightFilterLabels}
          loadContext={loadAnalysisContext}
          onAddToReport={({ title, text }) =>
            commentary.addItems([{ title, text, category: "variance", source: "ai" }])
          }
        />

        {/* Hover help for the ✦ and commentary buttons in the tables & key metrics */}
        <AIHelpTooltip />

      </main>

      <CustomerProfitDrilldownDrawer
        open={drillOpen}
        onClose={() => setDrillOpen(false)}
        token={token}
        year={year}
        currency={selectedCurrency}
        API_BASE_URL={API_BASE_URL}
        currency_filter={filters.currency_filter}
        customerName={drillCustomer}
      />
    </ReportsLayout>
  );
}

/* ══════════════════════════════════════════
   SMALL COMPONENTS
══════════════════════════════════════════ */

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
      <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-500 mb-1">
        {icon} {label}
      </p>
      <p className={`text-2xl font-extrabold leading-none ${valueColor}`}>{value}</p>
      {sub && <p className="text-[11px] text-sky-400 mt-1">{sub}</p>}
    </div>
  );
};

const Select = ({ label, value, options, onChange }) => (
  <div>
    <label className="block text-x text-sky-700 mb-1">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full p-2 border border-sky-200 rounded text-x bg-white"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
);

const HeaderDates = ({ top, bottom }) => (
  <div className="flex flex-col leading-tight">
    <span className="text-[11px] text-white/80">{top}</span>
    <span className="text-[12px] font-semibold">{bottom}</span>
  </div>
);

const AIDriverText = ({ messages }) => {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!messages?.length) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % messages.length), 3000);
    return () => clearInterval(timer);
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

const MetricRow = ({ label, value, isPercent = false, onAnalyze }) => {
  const display = isPercent ? formatPct(value) : formatMoneySmart(value);
  const n       = isPercent ? Number(value) : parseCompactNumber(value);
  const isNum   = Number.isFinite(n);
  const color   = isNum && n > 0 ? "text-green-600" : isNum && n < 0 ? "text-red-600" : "text-sky-900";
  return (
    <div className="flex justify-between text-s">
      <span className="text-sky-700">
        {label}
        {onAnalyze && (
          <AnalyzeButton
            onClick={onAnalyze}
            title={`Explain ${label} with AI`}
            tooltip={{
              heading: "Explain with AI",
              context: `${label} · ${display}`,
              body: "AI explains what's behind this figure — which customers drive it, loss-makers and the margin spread — with supporting data, and answers follow-up questions.",
            }}
            className="ml-1 opacity-70 hover:opacity-100 focus:opacity-100"
          />
        )}
      </span>
      <span className={`font-medium ${color}`}>{display}</span>
    </div>
  );
};
