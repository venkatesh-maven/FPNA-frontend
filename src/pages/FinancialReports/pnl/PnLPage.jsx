import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { AuthContext } from "../../../context/AuthContext";
import { API_BASE_URL } from "../../../config/config";
import { cachedFetch } from "../../../utils/reportCache";
import PnLOperatingExpenseDrilldown from "./PnLOperatingExpenseDrilldown";
import ReportsLayout from "../ReportsLayout";
import TableSkeleton from "../../Skeleton/TableSkeleton";
import PnLCostofGoodsdrilldown from "./PnLCostofGoodsdrilldown";

import {
  FiFilter,
  FiPrinter,
  FiTrendingUp,
  FiTrendingDown,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { FaArrowRightToBracket } from "react-icons/fa6";
import { BsStars, BsChatLeftText, BsChatLeftTextFill } from "react-icons/bs";
import ExportMenu from "../ExportMenu";
import { collectCommentary, commentaryCount, csvWithCommentary, downloadCsv } from "../reportExport";
import AIActionsMenu from "../AIActionsMenu";
import ReportCommentary from "../ReportCommentary";
import { compactForAI } from "../reportAIContext";
import useReportCommentary from "../../../hooks/useReportCommentary";
import LineItemRefineWithAI, { LineItemAIButton } from "../LineItemRefineWithAI";
import LineItemCommentary from "../LineItemCommentary";
import useLineItemCommentary from "../../../hooks/useLineItemCommentary";
import AnalyzeWithAI, { AnalyzeButton } from "../AnalyzeWithAI";
import AIHelpTooltip from "../AIHelpTooltip";
import { buildPnlAnalysisContext } from "./pnlAnalyze";
import AddAutomation from "../AddAutomation";
import ActionHoverLabel from "../ActionHoverLabel";
import PnLDrilldownDrawer from "./PnLDrilldownDrawer";
import { getDecimalPrecision } from '../../../utils/formatters';
import { ComparisonBasisProvider, useComparisonBasis } from "../../../context/ComparisonBasisContext";
import BasisSelector from "../../../components/ComparisonBasis/BasisSelector";
import PlanUnavailableNote from "../../../components/ComparisonBasis/PlanUnavailableNote";
import {
  basisLabels, basisQueryParams, decodeBasis, encodeBasis, isPlanAvailableForFilters, periodSourceBadge,
} from "../../../utils/comparisonBasis";

/* ================== CONSTANTS ================== */
// Filters carried into the View More page (PLDashboard).
const VIEW_MORE_FILTER_KEYS = [
  "time_filter", "currency_filter", "date_from", "date_to", "entity",
  "cost_center", "profit_center", "customer", "region", "product_name",
];

const TIME_FILTERS = [
  { id: "all_periods", label: "All Periods" },
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

const comparity_filterS = [
  { id: "", label: "No Comparison" },
  { id: "month_on_month", label: "Month vs Month" },
  { id: "year_on_year", label: "Year vs Year" },
];

// const MOM_BUDGET_FILTERS = [
//   { id: "", label: "No Budget Compare" },
//   { id: "budget_revenue", label: "MoM vs Budget Revenue" },
//   { id: "budget_opex", label: "MoM vs Budget Opex" },
//   { id: "budget_cogs", label: "MoM vs Budget COGS" },
// ];

const MOM_BUDGET_FILTERS = [
  { id: "", label: "No Budget Compare" },
  { id: "budget_data", label: "MoM vs Budget" }, // ✅ backend expects only this
];

const BUDGET_METRIC_OPTIONS = [
  { id: "revenue", label: "Budget Revenue" },
  { id: "opex", label: "Budget Opex" },
  { id: "cost_of_goods_sold", label: "Budget COGS" },
];

const SORT_BY_OPTIONS = [
  { id: "period",               label: "Period" },
  { id: "revenue",              label: "Revenue" },
  { id: "cost_of_goods_sold",   label: "Cost of Goods Sold" },
  { id: "gross_profit",         label: "Gross Profit" },
  { id: "operating_expense",    label: "Operating Expense" },
  { id: "actual_profit",        label: "Actual Profit" },
  { id: "budget_profit",        label: "Budget Profit" },
  { id: "variance",             label: "Variance" },
  { id: "variance_percentage",  label: "Variance %" },
];

const COMPARE_METRICS = [
  { label: "REVENUE", key: "revenue" },
  { label: "COST OF GOODS SOLD", key: "cost_of_goods_sold" },
    { label: "GROSS PROFIT", key: "gross_profit" },
  { label: "OPERATING EXPENSE", key: "opex" },
  { label: "ACTUAL PROFIT", key: "actual_profit" },
  { label: "BUDGET PROFIT", key: "budget_profit" },
  { label: "VARIANCE", key: "variance" },
  { label: "VARIANCE %", key: "variance_percentage", isPct: true },
];

// Right-pinned Insights / Recommendation columns. Widths are fixed (cell =
// content + px-3 padding) so long text can't stretch them over the month
// columns, and the Insights offset must equal the full Recommendation cell
// width: 190px content + 24px padding = 214px.
const STICKY_RECOMMENDATION = "sticky right-0 z-10 w-[214px] min-w-[214px] max-w-[214px]";
const STICKY_INSIGHTS =
  "sticky right-[214px] z-10 w-[244px] min-w-[244px] max-w-[244px] shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.25)]";

// Opens on the current month's actual vs budget and variance.
const DEFAULT_FILTER_STATE = {
  time_filter: "current_month",
  currency_filter: "actualvalue",
  comparity_filter: "",
  mom_vs_budget: "budget_data",
  budget_metric: "revenue", // ✅ UI only
  date_from: "",
  date_to: "",
  entity: null,
  cost_center: null,
  profit_center: null,
  customer: null,
  region: null,
  product_name: null,
  version: null,
};

/**
 * Your swagger shows only:
 * /pnl-drilldown/revenue/{currency}
 * So for now we map everything to "revenue"
 * If backend supports more later, change mapping like:
 * { revenue:"revenue", cost_of_goods_sold:"cogs", opex:"opex" ... }
 */
const METRIC_TO_DRILL_ENDPOINT = {
  revenue: "revenue",
  cost_of_goods_sold: "cost_of_goods_sold",
  opex: "operating_expense",
  gross_profit: "gross_profit",
  actual_profit: "actual_profit",
  budget_profit: "budget_profit",
};

/* ================== HELPERS ================== */
const safeId = (v) => (v === null || v === undefined ? "" : String(v));
const isKMBString = (v) => typeof v === "string" && /[KMB]\b/i.test(v.trim());

const getComparePrevPeriod = (comparisionObj) =>
  pickFirst(comparisionObj, ["prev_period", "previous_period", "prior_period"]);

const formatMoney = (v, currencySymbol = "$") => {
  if (v === null || v === undefined || v === "" || v === "null") return "-";

  if (isKMBString(v)) return `${currencySymbol}${v}`;

  const cleaned = typeof v === "string" ? v.replace(/,/g, "") : v;
  const n = Number(cleaned);

  if (Number.isNaN(n)) return "-";

  const dp = getDecimalPrecision();
  return `${currencySymbol}${n.toLocaleString(undefined, {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  })}`;
};

const formatPct = (v) => {
  if (v === null || v === undefined || v === "" || v === "null") return "-";

  const n = Number(v);

  if (Number.isNaN(n)) return "-";

  return `${n.toFixed(getDecimalPrecision())}%`;
};

// A value as the API sends it ("-96,112.69", "$1,234", "1.2M", 12.5) -> number,
// NaN when it isn't one.
const _parseSigned = (v) => {
  if (v === null || v === undefined || v === "") return NaN;
  if (typeof v === "number") return v;
  return Number(String(v).replace(/[$,%\s]/g, "").replace(/[KMLB]$/i, ""));
};

// Colours a change by whether it is good news: an increase is favorable for
// revenue/profit, but for cost lines (`lowerIsBetter`) a decrease is. The arrow
// always shows the direction of the number itself.
const getVarianceUI = (value, { lowerIsBetter = false } = {}) => {
  const num = _parseSigned(value);

  if (Number.isNaN(num) || num === 0) {
    return {
      icon: null,
      color: "text-sky-700",
      bg: "bg-sky-50",
      pill: "bg-slate-200 text-slate-800",
      arrow: "•",
    };
  }

  const up = num > 0;
  const good = lowerIsBetter ? !up : up;
  const Icon = up ? FiTrendingUp : FiTrendingDown;
  return {
    icon: <Icon className={good ? "text-green-600" : "text-red-600"} />,
    color: good ? "text-green-700" : "text-red-700",
    bg: good ? "bg-green-50" : "bg-red-50",
    pill: good ? "bg-green-600 text-white" : "bg-red-600 text-white",
    arrow: up ? "▲" : "▼",
  };
};

const getComparePrev = (comparisionObj, metricKey) => {
  const aliases = COMPARE_KEY_ALIASES?.[metricKey]?.prev || [
    `prev_${metricKey}`,
  ];
  return pickFirst(comparisionObj, aliases);
};

const getCompareDiff = (comparisionObj, metricKey) => {
  const aliases = COMPARE_KEY_ALIASES?.[metricKey]?.diff || [
    `${metricKey}_diff`,
  ];
  return pickFirst(comparisionObj, aliases);
};

const KEY_ALIASES = {
  opex: ["opex", "operating_expense", "operating_expense_amount"],
};
// For comparison object keys: prev_* and *_diff
const COMPARE_KEY_ALIASES = {
  // UI key: "opex" but backend uses "operating_expense"
  opex: {
    prev: [
      "prev_opex",
      "prev_operating_expense",
      "prev_operating_expense_amount",
    ],
    diff: [
      "opex_diff",
      "operating_expense_diff",
      "operating_expense_amount_diff",
    ],
  },
  cost_of_goods_sold: {
    prev: ["prev_cost_of_goods_sold", "prev_cogs"],
    diff: ["cost_of_goods_sold_diff", "cogs_diff"],
  },
  revenue: {
    prev: ["prev_revenue"],
    diff: ["revenue_diff"],
  },
  gross_profit: {
    prev: ["prev_gross_profit"],
    diff: ["gross_profit_diff"],
  },
  actual_profit: {
    prev: ["prev_actual_profit"],
    diff: ["actual_profit_diff"],
  },
  budget_profit: {
    prev: ["prev_budget_profit"],
    diff: ["budget_profit_diff"],
  },
};

const pickFirst = (obj, keys = []) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
};

const getRowValue = (row, key) => {
  const aliases = KEY_ALIASES[key];

  let value;

  if (aliases?.length) {
    value = pickFirst(row, aliases);
  } else {
    value = row?.[key];
  }

  if (value === undefined || value === null || value === "") return null;

  return value;
};

// Every P&L line against its budget (the MoM vs Budget table). Revenue / COGS /
// Opex budgets and variances come from the row's budget_data; gross profit's
// are derived from them (budget revenue − budget COGS); actual profit uses the
// row's budget_profit / variance. Variance = actual − budget, so for cost lines
// (`lowerIsBetter`) a negative variance is favorable.
const _signedDiff = (a, b) => {
  const x = _parseSigned(a);
  const y = _parseSigned(b);
  return Number.isFinite(x) && Number.isFinite(y) ? Math.round((x - y) * 100) / 100 : null;
};
const _budgetOf = (r, key) => r?.budget_data?.[key] ?? null;
const _cogsVariance = (r) => pickFirst(r?.budget_data, ["cogs_variance", "cost_of_goods_sold_variance"]) ?? null;

// Gross margin % = (revenue − COGS) / revenue, or null without revenue.
const _marginPct = (revenue, cogs) => {
  const rev = _parseSigned(revenue);
  const c = _parseSigned(cogs);
  return Number.isFinite(rev) && Number.isFinite(c) && rev !== 0 ? Math.round(((rev - c) / rev) * 10000) / 100 : null;
};
const _actualMargin = (r) => _marginPct(getRowValue(r, "revenue"), getRowValue(r, "cost_of_goods_sold"));
const _budgetMargin = (r) => _marginPct(_budgetOf(r, "budget_revenue"), _budgetOf(r, "budget_cogs"));

// EBITDA is the backend's actual_profit (revenue − COGS − opex; the app has no
// separate D&A line), so it keeps that key. Gross margin has no row field, so
// it supplies `actual`; `isPct` rows show percentages and their variance in
// percentage points.
const BUDGET_ROWS = [
  {
    label: "REVENUE",
    key: "revenue",
    budget: (r) => _budgetOf(r, "budget_revenue"),
    variance: (r) => _budgetOf(r, "revenue_variance"),
  },
  {
    label: "OPERATING EXPENSE",
    key: "opex", // reads operating_expense via KEY_ALIASES
    lowerIsBetter: true,
    budget: (r) => _budgetOf(r, "budget_opex"),
    variance: (r) => pickFirst(r?.budget_data, ["opex_variance", "operating_expense_variance"]) ?? null,
  },
  {
    label: "COST OF GOODS SOLD",
    key: "cost_of_goods_sold",
    lowerIsBetter: true,
    budget: (r) => _budgetOf(r, "budget_cogs"),
    variance: _cogsVariance,
  },
  {
    label: "EBITDA",
    key: "actual_profit",
    budget: (r) => getRowValue(r, "budget_profit"),
    variance: (r) => getRowValue(r, "variance"),
  },
  {
    label: "GROSS MARGIN %",
    key: "gross_margin",
    isPct: true,
    actual: _actualMargin,
    budget: _budgetMargin,
    variance: (r) => _signedDiff(_actualMargin(r), _budgetMargin(r)),
  },
];

// A budget row's actual value for one month.
const budgetActual = (m, r) => (m.actual ? m.actual(r) : getRowValue(r, m.key));

// Variance as a % of the (absolute) budget, or null when there's no budget.
// Not shown for percentage rows, whose variance is already in points.
const budgetVariancePct = (m, r) => {
  if (m.isPct) return null;
  const v = _parseSigned(m.variance(r));
  const b = _parseSigned(m.budget(r));
  return Number.isFinite(v) && Number.isFinite(b) && b !== 0 ? (v / Math.abs(b)) * 100 : null;
};

// Budget-table value formatting: money, or % / signed points for isPct rows.
const formatBudgetValue = (m, v) => (m.isPct ? formatPct(v) : formatMoney(v));
const formatBudgetVariance = (m, v) => {
  if (!m.isPct) return formatMoney(v);
  const n = _parseSigned(v);
  return Number.isFinite(n) ? `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)} pts` : "—";
};

/* ── Analytical narrative builder ──
   Deep, data-driven analysis per metric (volatility, cost-flexibility,
   operating-leverage, forecast-accuracy signals), plus an executive summary
   that connects them. Everything below is computed from the real numbers -
   nothing here is a fixed template string. */
const _pnlNum = (row, key) => {
  const raw = getRowValue(row, key);
  if (typeof raw === "string") {
    const n = Number(raw.replace(/[$,%\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return Number(raw) || 0;
};

const _stats = (arr) => {
  const n = arr.length;
  const mean = n ? arr.reduce((a, b) => a + b, 0) / n : 0;
  const variance = n ? arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n : 0;
  const sd = Math.sqrt(variance);
  const cv = mean !== 0 ? (sd / Math.abs(mean)) * 100 : 0;
  return { mean, sd, cv };
};

const NOT_ENOUGH_DATA = "Not enough periods in this view to analyze a pattern - widen the date range for a deeper read.";

const buildPnlNarrative = (allRows, bestMonth, worstMonth) => {
  const periodRows = allRows.filter((r) => r.period !== "total");
  const N = periodRows.length;
  const empty = {
    revenue: NOT_ENOUGH_DATA, cost_of_goods_sold: NOT_ENOUGH_DATA, gross_profit: NOT_ENOUGH_DATA,
    opex: NOT_ENOUGH_DATA, actual_profit: NOT_ENOUGH_DATA, budget_profit: NOT_ENOUGH_DATA,
    variance: NOT_ENOUGH_DATA, variance_percentage: NOT_ENOUGH_DATA, executive: [NOT_ENOUGH_DATA],
  };
  if (!N) return empty;
  if (N < 3) return buildShortRangeNarrative(periodRows);

  const periodsLabels = periodRows.map((r) => r.period);
  const revenue = periodRows.map((r) => _pnlNum(r, "revenue"));
  const cogs = periodRows.map((r) => _pnlNum(r, "cost_of_goods_sold"));
  const opex = periodRows.map((r) => _pnlNum(r, "opex"));
  const grossProfit = periodRows.map((r) => _pnlNum(r, "gross_profit"));
  const actualProfit = periodRows.map((r) => _pnlNum(r, "actual_profit"));
  const budgetProfit = periodRows.map((r) => _pnlNum(r, "budget_profit"));
  const variance = periodRows.map((r) => _pnlNum(r, "variance"));
  const variancePct = periodRows.map((r) => _pnlNum(r, "variance_percentage"));

  const revStats = _stats(revenue);
  const opexStats = _stats(opex);
  const profitStats = _stats(actualProfit);

  const idxMax = (arr) => arr.indexOf(Math.max(...arr));
  const idxMin = (arr) => arr.indexOf(Math.min(...arr));

  // ── Revenue: what's actually driving the swings - volume, or price/mix? ──
  // P&L data alone has nothing upstream of revenue to blame, so the honest
  // "why" available here is whether gross margin moved with revenue or held
  // steady: steady margin through a revenue swing points to volume being the
  // driver (same price, more/fewer units); margin moving too points to
  // pricing or product mix changing alongside volume.
  const marginPctForRevenue = periodRows.map((r, i) => (revenue[i] ? (grossProfit[i] / revenue[i]) * 100 : 0));
  const marginStatsForRevenue = _stats(marginPctForRevenue);
  const revenueVolatile = revStats.cv >= 6;
  const revenueText = !revenueVolatile
    ? `Revenue grew with only modest month-to-month movement (~${revStats.cv.toFixed(0)}% variability) and gross margin held equally steady (~${marginStatsForRevenue.mean.toFixed(1)}%), consistent with durable, repeatable demand rather than a few standout periods.`
    : marginStatsForRevenue.cv < revStats.cv * 0.5
    ? `Revenue swung ~${revStats.cv.toFixed(0)}% across the period while gross margin stayed comparatively steady (~${marginStatsForRevenue.mean.toFixed(1)}%, only ~${marginStatsForRevenue.cv.toFixed(0)}% variability) - margin holding through the swing points to sales volume as the driver, not a pricing or product-mix change.`
    : `Revenue swung ~${revStats.cv.toFixed(0)}% across the period alongside a comparable swing in gross margin (~${marginStatsForRevenue.cv.toFixed(0)}% variability) - the two moving together points to pricing or product mix shifting along with volume, not volume acting alone.`;

  // ── COGS: cost efficiency & margin pressure (does cost flex with revenue?) ──
  const cogsRatios = periodRows.map((r, i) => (revenue[i] ? cogs[i] / revenue[i] : 0));
  const cogsRatioStats = _stats(cogsRatios);
  let stickyCogsCount = 0;
  for (let i = 0; i < N; i++) {
    if (revenue[i] < revStats.mean && cogsRatios[i] > cogsRatioStats.mean) stickyCogsCount++;
  }
  const cogsText = stickyCogsCount > 0
    ? `Cost of goods sold consumed a larger share of revenue specifically in ${stickyCogsCount} weaker-revenue month${stickyCogsCount !== 1 ? "s" : ""}, rather than easing in step with lower sales. That points to limited cost flexibility - pricing, supplier costs, or product mix pressure that persists even when volume drops.`
    : `Cost of goods sold moved roughly in proportion with revenue across the year, suggesting the cost structure scales appropriately with sales volume.`;

  // ── Gross Profit: does revenue reliably convert into margin? ──
  const marginPct = periodRows.map((r, i) => (revenue[i] ? (grossProfit[i] / revenue[i]) * 100 : 0));
  const bestRevIdx = idxMax(revenue);
  const worstRevIdx = idxMin(revenue);
  const marginGap = marginPct[bestRevIdx] - marginPct[worstRevIdx];
  const grossProfitText = Math.abs(marginGap) >= 3
    ? `Strong revenue months didn't consistently produce proportionally higher gross profit - margin was ${marginPct[bestRevIdx].toFixed(1)}% in ${periodsLabels[bestRevIdx]} (the strongest revenue month) versus ${marginPct[worstRevIdx].toFixed(1)}% in ${periodsLabels[worstRevIdx]} (the weakest). That gap can point to deteriorating unit economics - growing sales while earning less profit per dollar.`
    : `Gross margin held steady across both strong and weak revenue months (around ${((marginPct[bestRevIdx] + marginPct[worstRevIdx]) / 2).toFixed(1)}%), indicating revenue is converting into profit at a consistent rate regardless of volume.`;

  // ── Operating Expense: operating leverage (fixed cost vs revenue swings) ──
  const leverageRisk = opexStats.cv < revStats.cv * 0.6 && revStats.cv > 3;
  const opexText = leverageRisk
    ? `Operating expenses stayed relatively fixed (~${opexStats.cv.toFixed(0)}% variability) while revenue swung ~${revStats.cv.toFixed(0)}%, so the business absorbs the full impact of revenue downturns without a matching pullback in costs. That limits operating leverage - revenue has to clear a certain bar before extra sales meaningfully improve profit.`
    : `Operating expenses moved roughly in step with revenue (~${opexStats.cv.toFixed(0)}% vs ~${revStats.cv.toFixed(0)}% variability), suggesting the cost base already flexes with the top line instead of creating fixed downside exposure.`;

  // ── Actual Profit: don't stop at "which line item moved" - explain the
  // mechanism. When gross profit is the culprit, that itself has two
  // possible causes with opposite implications: revenue simply came in low
  // that month (a volume problem, cost structure is fine), or the cost-of-
  // goods ratio spiked while revenue was normal (a cost/pricing problem).
  // Decomposing which one actually happened is the difference between a
  // real diagnosis and just re-reporting a smaller number.
  const bestProfitIdx = idxMax(actualProfit);
  const worstProfitIdx = idxMin(actualProfit);
  const avgGP = _stats(grossProfit).mean;
  const avgOpexForProfit = _stats(opex).mean;
  const gpShortfallAtWorstProfit = avgGP ? (avgGP - grossProfit[worstProfitIdx]) / avgGP : 0;
  const opexOverrunAtWorstProfit = avgOpexForProfit ? (opex[worstProfitIdx] - avgOpexForProfit) / avgOpexForProfit : 0;
  const worstProfitGpDriven = Math.abs(gpShortfallAtWorstProfit) >= Math.abs(opexOverrunAtWorstProfit);

  const diagnoseGpShortfall = (idx) => {
    const avgRevenueLocal = revStats.mean;
    const avgCogsRatioLocal = cogsRatioStats.mean;
    const actualRevenueAtIdx = revenue[idx];
    const actualCogsRatioAtIdx = actualRevenueAtIdx ? cogs[idx] / actualRevenueAtIdx : 0;
    // Rough variance decomposition: how much of the gap from average gross
    // profit is explained by revenue being off-average (at the average cost
    // ratio) versus the cost ratio being off-average (at the actual revenue)?
    const revenueEffect = (actualRevenueAtIdx - avgRevenueLocal) * (1 - avgCogsRatioLocal);
    const costRatioEffect = actualRevenueAtIdx * (avgCogsRatioLocal - actualCogsRatioAtIdx);
    const revenueShortfallPct = avgRevenueLocal ? ((avgRevenueLocal - actualRevenueAtIdx) / avgRevenueLocal) * 100 : 0;
    // Percentages here are derived ratios never shown on the table itself
    // (the table has dollar amounts, not month-to-typical-month deltas or
    // cost-as-%-of-revenue), so they add information rather than repeating
    // a cell the reader can already see.
    return Math.abs(revenueEffect) >= Math.abs(costRatioEffect)
      ? `fewer sales that month - revenue ran roughly ${Math.abs(revenueShortfallPct).toFixed(0)}% below its typical level while the cost-of-goods ratio held close to normal. That's a demand problem, not a cost problem`
      : `the cost-of-goods ratio jumping to ${(actualCogsRatioAtIdx * 100).toFixed(1)}% of revenue against a ${(avgCogsRatioLocal * 100).toFixed(1)}% typical level, even though sales volume was close to normal. That's a cost or pricing problem, not a demand problem`;
  };

  const worstProfitRootCause = worstProfitGpDriven
    ? diagnoseGpShortfall(worstProfitIdx)
    : `operating expenses running well above their typical level that month while revenue and cost-of-goods stayed close to normal - a spending problem isolated to that month, not a sales or cost-of-sales issue`;
  const actualProfitText = `Profit was weakest in ${periodsLabels[worstProfitIdx]} and strongest in ${periodsLabels[bestProfitIdx]}. The weak month comes down to ${worstProfitRootCause}.`;

  // Best/Worst Month elsewhere on this page are ranked by variance % (how far
  // each month beat or missed ITS OWN budget), not raw profit dollars - the
  // two can point to different months. The executive summary below reuses
  // that same variance-% definition so it never contradicts those labels.
  const bestMonthIdx = periodRows.findIndex((r) => r.period === bestMonth);
  const worstMonthIdx = periodRows.findIndex((r) => r.period === worstMonth);
  const execBestIdx = bestMonthIdx >= 0 ? bestMonthIdx : bestProfitIdx;
  const execWorstIdx = worstMonthIdx >= 0 ? worstMonthIdx : worstProfitIdx;

  // ── Budget Profit: planning vs operational accuracy ──
  const misses = periodRows.filter((r, i) => actualProfit[i] < budgetProfit[i]).length;
  const annualActual = actualProfit.reduce((a, b) => a + b, 0);
  const annualBudget = budgetProfit.reduce((a, b) => a + b, 0);
  const annualFav = annualActual >= annualBudget;
  const budgetProfitText = misses === 0
    ? `Actual profit met or exceeded budget in every single month, indicating the budget was a reliable, achievable operating target rather than just an annual aspiration.`
    : annualFav
    ? `The annual total beat budget overall, but actual profit fell short of budget in ${misses} of ${N} individual months. Relying on the annual figure alone risks masking those recurring monthly shortfalls - the budget looks better calibrated for annual planning than for tracking operating performance month to month.`
    : `Both the annual total and ${misses} individual months missed budget, suggesting the budget itself may be set too aggressively relative to the business's actual run rate rather than the business underperforming a reasonable target.`;

  // ── Variance: same root-cause diagnosis as Actual Profit, applied to the
  // worst budget miss specifically (not necessarily the same month, since
  // budget itself can move - see the bestMonth/worstMonth note above). ──
  const negMonths = variance.filter((v) => v < 0).length;
  const totalVar = variance.reduce((a, b) => a + b, 0);
  const bestVarIdx = idxMax(variance);
  const worstVarIdx = idxMin(variance);
  const gpShortfallAtWorstVar = avgGP ? (avgGP - grossProfit[worstVarIdx]) / avgGP : 0;
  const opexOverrunAtWorstVar = avgOpexForProfit ? (opex[worstVarIdx] - avgOpexForProfit) / avgOpexForProfit : 0;
  const worstVarGpDriven = Math.abs(gpShortfallAtWorstVar) >= Math.abs(opexOverrunAtWorstVar);
  const worstVarRootCause = worstVarGpDriven
    ? diagnoseGpShortfall(worstVarIdx)
    : `operating expenses running well above their typical level that month while revenue and cost-of-goods stayed close to normal - a spending problem isolated to that month, not a sales or cost-of-sales issue`;
  const varianceText = negMonths === 0
    ? `Variance was favorable in every month - budget was never missed, so there's no shortfall month to explain.`
    : `The worst budget miss was in ${periodsLabels[worstVarIdx]}: ${worstVarRootCause}. ${totalVar >= 0 ? `The year still finished ahead of budget overall, but with ${negMonths} of ${N} months running negative, that favorable annual number depends on strong months covering for shortfalls like this one rather than every month pulling its own weight.` : `${negMonths} of ${N} months missed budget in total, so this wasn't an isolated event.`}`;

  const worstVarPctIdx = idxMin(variancePct);
  let variancePercentageText;
  if (negMonths === 0) {
    variancePercentageText = `Every month beat budget, so there's no recurring gap between best and worst months to explain.`;
  } else if (worstVarPctIdx === worstVarIdx) {
    variancePercentageText = `The same month is the worst miss whether measured in dollars or as a percentage of its own budget, which reinforces the diagnosis: ${worstVarRootCause}.`;
  } else {
    // Different month than the dollar-worst one - budget size itself
    // differs enough between months that the two views disagree, which is
    // itself the finding worth surfacing rather than just picking one.
    const gpShortfallAtWorstVarPct = avgGP ? (avgGP - grossProfit[worstVarPctIdx]) / avgGP : 0;
    const opexOverrunAtWorstVarPct = avgOpexForProfit ? (opex[worstVarPctIdx] - avgOpexForProfit) / avgOpexForProfit : 0;
    const worstVarPctRootCause = Math.abs(gpShortfallAtWorstVarPct) >= Math.abs(opexOverrunAtWorstVarPct)
      ? diagnoseGpShortfall(worstVarPctIdx)
      : `operating expenses running well above their typical level that month while revenue and cost-of-goods stayed close to normal`;
    variancePercentageText = `${periodsLabels[worstVarPctIdx]} misses budget by the widest percentage even though ${periodsLabels[worstVarIdx]} misses it by the widest dollar amount - that gap between the two views means ${periodsLabels[worstVarPctIdx]} had a smaller budget to begin with, so ${worstVarPctRootCause} hit it disproportionately hard relative to what was expected that month.`;
  }

  // ── Executive summary: connect every row into one financial story, and
  // state the weak month's actual root cause instead of telling the reader
  // to go dig into it - the diagnosis is already computed above. ──
  const gpShortfallAtExecWorst = avgGP ? (avgGP - grossProfit[execWorstIdx]) / avgGP : 0;
  const opexOverrunAtExecWorst = avgOpexForProfit ? (opex[execWorstIdx] - avgOpexForProfit) / avgOpexForProfit : 0;
  const execWorstGpDriven = Math.abs(gpShortfallAtExecWorst) >= Math.abs(opexOverrunAtExecWorst);
  const execWorstRootCause = execWorstGpDriven
    ? diagnoseGpShortfall(execWorstIdx)
    : `operating expenses running well above their typical level that month while revenue and cost-of-goods stayed close to normal - a spending problem isolated to that month`;

  const executive = [
    `The business delivered ${annualFav ? "a favorable" : "an unfavorable"} annual profit outcome overall, but that annual number hides real unevenness underneath: the budget was beaten by the widest margin in ${periodsLabels[execBestIdx]} and missed by the widest margin in ${periodsLabels[execWorstIdx]}, and the weak month comes down to ${execWorstRootCause}.`,
    `The most useful next step is to identify what made ${periodsLabels[execBestIdx]} work and assess whether those conditions can be repeated deliberately, rather than treating it as luck. ${misses > 0 ? `Budget was also missed in multiple other months even though the annual number came in ${annualFav ? "ahead" : "behind"}, so ` : ""}improving the consistency and predictability of month-to-month profitability - not just the annual total - should be the primary focus going forward.`,
  ];

  return {
    revenue: revenueText,
    cost_of_goods_sold: cogsText,
    gross_profit: grossProfitText,
    opex: opexText,
    actual_profit: actualProfitText,
    budget_profit: budgetProfitText,
    variance: varianceText,
    variance_percentage: variancePercentageText,
    executive,
  };
};

const _pctOf = (part, whole) => (whole ? `${((part / whole) * 100).toFixed(1)}%` : "—");

// One or two months in view: too few for trend analysis, so describe the
// month itself (cost ratios, margins, profit vs budget) and, with two months,
// what changed between them.
const buildShortRangeNarrative = (periodRows) => {
  const last = periodRows[periodRows.length - 1];
  const prev = periodRows.length > 1 ? periodRows[0] : null;
  const month = monthLabel(last.period);
  const val = (k) => _pnlNum(last, k);
  const revenue = val("revenue");
  const actualProfit = val("actual_profit");
  const budgetProfit = val("budget_profit");
  const variance = actualProfit - budgetProfit;

  const change = (k) => {
    if (!prev) return "";
    const before = _pnlNum(prev, k);
    const diff = val(k) - before;
    const pct = before ? ` (${Math.abs((diff / Math.abs(before)) * 100).toFixed(1)}%)` : "";
    return ` That is ${diff >= 0 ? "up" : "down"} ${formatMoney(Math.abs(diff))}${pct} from ${monthLabel(prev.period)}.`;
  };
  const vsBudget = budgetProfit
    ? `${variance >= 0 ? "beat" : "missed"} its ${formatMoney(budgetProfit)} budget by ${formatMoney(Math.abs(variance))} (${Math.abs((variance / Math.abs(budgetProfit)) * 100).toFixed(1)}%)`
    : null;

  return {
    revenue: `Revenue was ${formatMoney(revenue)} in ${month}.${change("revenue")}`,
    cost_of_goods_sold: `Cost of goods sold was ${formatMoney(val("cost_of_goods_sold"))} in ${month}, ${_pctOf(val("cost_of_goods_sold"), revenue)} of revenue.${change("cost_of_goods_sold")}`,
    gross_profit: `Gross profit was ${formatMoney(val("gross_profit"))} in ${month}, a ${_pctOf(val("gross_profit"), revenue)} gross margin.${change("gross_profit")}`,
    opex: `Operating expense was ${formatMoney(val("opex"))} in ${month}, ${_pctOf(val("opex"), revenue)} of revenue.${change("opex")}`,
    actual_profit: `Profit was ${formatMoney(actualProfit)} in ${month}, a ${_pctOf(actualProfit, revenue)} net margin.${change("actual_profit")}`,
    budget_profit: vsBudget
      ? `Budgeted profit for ${month} was ${formatMoney(budgetProfit)}; actual profit ${variance >= 0 ? "beat" : "missed"} it by ${formatMoney(Math.abs(variance))}.`
      : `No profit budget is set for ${month}.`,
    variance: vsBudget
      ? `Profit ${variance >= 0 ? "beat" : "missed"} budget by ${formatMoney(Math.abs(variance))} in ${month} — ${variance >= 0 ? "favorable" : "unfavorable"}.`
      : `No profit budget is set for ${month}, so there is no variance to explain.`,
    variance_percentage: vsBudget
      ? `Profit landed ${Math.abs((variance / Math.abs(budgetProfit)) * 100).toFixed(1)}% ${variance >= 0 ? "above" : "below"} its ${month} budget.`
      : `No profit budget is set for ${month}.`,
    executive: [
      `In ${month}, revenue was ${formatMoney(revenue)} and profit ${formatMoney(actualProfit)} (a ${_pctOf(actualProfit, revenue)} net margin)${vsBudget ? `; profit ${vsBudget}` : ""}.${prev ? ` Compared with ${monthLabel(prev.period)}, profit is ${actualProfit >= _pnlNum(prev, "actual_profit") ? "up" : "down"} ${formatMoney(Math.abs(actualProfit - _pnlNum(prev, "actual_profit")))}.` : ""}`,
      "Widen the date range to three or more months to see trends and recurring patterns.",
    ],
  };
};

// Actual vs budget for every line in the MoM vs Budget table, over the months
// in view (works from a single month up). Favorability follows the line:
// below budget is good for costs. `noun` is what the plan column holds
// ("budget", "forecast", "the Best Case scenario"); Budget keeps its wording.
const _planWords = (noun) =>
  noun === "budget"
    ? {
        against: (amt) => `against a ${amt} budget`,
        side: "budget",
        none: (what) => `No budget is set for ${what}`,
        planned: "budgeted",
        missing: "no revenue/COGS budget is set to compare it against",
      }
    : {
        against: (amt) => `against ${noun} of ${amt}`,
        side: noun,
        none: (what) => `${noun.charAt(0).toUpperCase()}${noun.slice(1)} has no figure for ${what}`,
        planned: `in ${noun}`,
        missing: `${noun} has no revenue/COGS figure to compare it against`,
      };

const buildBudgetNarrative = (periodRows, noun = "budget") => {
  const N = periodRows.length;
  if (!N) return {};
  const words = _planWords(noun);
  const scope = N === 1 ? `in ${monthLabel(periodRows[0].period)}` : `across the ${N} months in view`;
  const sum = (fn) =>
    periodRows.reduce((acc, r) => {
      const n = _parseSigned(fn(r));
      return Number.isFinite(n) ? acc + n : acc;
    }, 0);
  const has = (fn) => periodRows.some((r) => Number.isFinite(_parseSigned(fn(r))));

  // Money lines only — percentage rows (gross margin) are derived from the
  // revenue and COGS totals below, since percentages don't sum across months.
  const lines = Object.fromEntries(
    BUDGET_ROWS.filter((m) => !m.isPct).map((m) => {
      const actual = sum((r) => budgetActual(m, r));
      const budget = sum(m.budget);
      return [m.key, { m, actual, budget, variance: has(m.variance) ? sum(m.variance) : actual - budget, hasBudget: has(m.budget) }];
    }),
  );
  const isGood = (m, v) => (m.lowerIsBetter ? v <= 0 : v >= 0);
  const vsBudget = (l) =>
    `${formatMoney(Math.abs(l.variance))}${l.budget ? ` (${Math.abs((l.variance / Math.abs(l.budget)) * 100).toFixed(1)}%)` : ""} ${l.variance >= 0 ? "above" : "below"} ${words.side}, ${isGood(l.m, l.variance) ? "favorable" : "unfavorable"}`;
  const signed = (n) => `${n >= 0 ? "+" : "−"}${formatMoney(Math.abs(n))}`;

  // Months on the right side of budget, and the worst month (2+ months only).
  const monthsSummary = (l) => {
    if (N < 2) return "";
    const monthly = periodRows
      .map((r) => ({ month: monthLabel(r.period), v: _parseSigned(l.m.variance(r)) }))
      .filter((x) => Number.isFinite(x.v));
    if (!monthly.length) return "";
    const bad = monthly.filter((x) => !isGood(l.m, x.v));
    const worst = [...bad].sort((a, b) => Math.abs(b.v) - Math.abs(a.v))[0];
    return ` It was on the right side of ${words.side} in ${monthly.length - bad.length} of ${monthly.length} months${
      worst ? `; the widest ${l.m.lowerIsBetter ? "overrun" : "shortfall"} was ${worst.month} (${formatMoney(Math.abs(worst.v))})` : ""
    }.`;
  };

  const { revenue: rev, cost_of_goods_sold: cogs, opex, actual_profit: profit } = lines;
  const marginActual = _marginPct(rev.actual, cogs.actual);
  const marginBudget = rev.hasBudget && cogs.hasBudget ? _marginPct(rev.budget, cogs.budget) : null;
  const marginPts = marginActual !== null && marginBudget !== null ? marginActual - marginBudget : null;
  const text = (l, name, extra = "") =>
    l.hasBudget
      ? `${name} was ${formatMoney(l.actual)} ${words.against(formatMoney(l.budget))} ${scope} — ${vsBudget(l)}.${extra}${monthsSummary(l)}`
      : `${words.none(name.toLowerCase())} ${scope}.`;

  // Profit variance = revenue variance − COGS variance − opex variance.
  const drivers = [
    ["revenue", rev.variance],
    ["cost of goods sold", -cogs.variance],
    ["operating expense", -opex.variance],
  ];
  const mainDriver = [...drivers].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];

  return {
    revenue: text(
      rev,
      "Revenue",
      rev.variance < 0 && marginPts !== null
        ? ` ${marginPts >= 0 ? "Gross margin still held at or above plan, so the miss was volume rather than pricing or cost." : "Gross margin also slipped below plan, so the shortfall hit profitability as well as volume."}`
        : "",
    ),
    cost_of_goods_sold: text(cogs, "Cost of goods sold", ` It ran at ${_pctOf(cogs.actual, rev.actual)} of revenue against ${_pctOf(cogs.budget, rev.budget)} planned.`),
    opex: text(opex, "Operating expense", ` It ran at ${_pctOf(opex.actual, rev.actual)} of revenue against ${_pctOf(opex.budget, rev.budget)} planned.`),
    actual_profit: text(
      profit,
      "EBITDA",
      ` By line, revenue contributed ${signed(rev.variance)}, cost of goods sold ${signed(-cogs.variance)} and operating expense ${signed(-opex.variance)} to the EBITDA variance.`,
    ),
    gross_margin:
      marginActual === null
        ? `Gross margin can't be calculated ${scope} because there is no revenue.`
        : marginPts === null
          ? `Gross margin was ${marginActual.toFixed(1)}% ${scope}; ${words.missing}.`
          : `Gross margin was ${marginActual.toFixed(1)}% against ${marginBudget.toFixed(1)}% ${words.planned} ${scope} — ${Math.abs(marginPts).toFixed(1)} pts ${marginPts >= 0 ? "above plan, favorable" : "below plan, unfavorable"}.`,
    executive: profit.hasBudget
      ? [
          `${scope.charAt(0).toUpperCase()}${scope.slice(1)}, EBITDA was ${formatMoney(profit.actual)} ${words.against(formatMoney(profit.budget))} — ${vsBudget(profit)}.`,
          `The biggest driver was ${mainDriver[0]} (${signed(mainDriver[1])} to EBITDA): revenue came in ${formatMoney(Math.abs(rev.variance))} ${rev.variance >= 0 ? "above" : "below"} plan, cost of goods sold ${formatMoney(Math.abs(cogs.variance))} ${cogs.variance >= 0 ? "above" : "below"} and operating expense ${formatMoney(Math.abs(opex.variance))} ${opex.variance >= 0 ? "above" : "below"}.`,
        ]
      : [`${words.none("the period in view")}, so there is nothing to compare actuals against.`],
  };
};

// Each line against the period it is compared with (the Month vs Month /
// Year vs Year table), over the months in view (works from a single month up).
// Favorability follows the line: a fall is good for costs.
const buildComparisonNarrative = (periodRows) => {
  const compared = periodRows.filter((r) => getComparePrevPeriod(r?.comparision));
  const N = compared.length;
  if (!N) return {};

  // Change = current − previous; the API's own diff is the fallback when
  // either side isn't a plain number.
  const pairs = (key) =>
    compared
      .map((r) => {
        const cur = _parseSigned(getRowValue(r, key));
        const prev = _parseSigned(getComparePrev(r.comparision, key));
        const diff =
          Number.isFinite(cur) && Number.isFinite(prev) ? cur - prev : _parseSigned(getCompareDiff(r.comparision, key));
        return { month: monthLabel(r.period), prevMonth: monthLabel(getComparePrevPeriod(r.comparision)), cur, prev, diff };
      })
      .filter((p) => Number.isFinite(p.diff));
  const total = (list, field) => list.reduce((acc, p) => (Number.isFinite(p[field]) ? acc + p[field] : acc), 0);
  const pctOfPrev = (diff, prev) => (prev ? ` (${Math.abs((diff / Math.abs(prev)) * 100).toFixed(1)}%)` : "");
  const moved = (diff) => (diff > 0 ? "up" : "down");
  const verdict = (key, diff, sep = " — ") =>
    diff === 0 ? "" : `${sep}${(COST_LINE_KEYS.has(key) ? diff < 0 : diff > 0) ? "favorable" : "unfavorable"}`;
  const scope = N === 1 ? "" : ` across the ${N} months in view`;

  const line = (key, name, extra = "") => {
    const list = pairs(key);
    if (!list.length) return `No comparison figures are available for ${name.toLowerCase()} in this view.`;
    if (N === 1) {
      const p = list[0];
      const change =
        p.diff === 0
          ? `unchanged from ${p.prevMonth}`
          : `${moved(p.diff)} ${formatMoney(Math.abs(p.diff))}${pctOfPrev(p.diff, p.prev)} from ${p.prevMonth} (${formatMoney(p.prev)})`;
      return `${name} was ${formatMoney(p.cur)} in ${p.month}, ${change}${verdict(key, p.diff)}.${extra}`;
    }
    const cur = total(list, "cur");
    const prev = total(list, "prev");
    const diff = cur - prev;
    const ups = list.filter((p) => p.diff > 0).length;
    const biggest = [...list].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0];
    return `${name} totalled ${formatMoney(cur)}${scope} against ${formatMoney(prev)} in the comparison periods — ${
      diff === 0 ? "unchanged" : `${moved(diff)} ${formatMoney(Math.abs(diff))}${pctOfPrev(diff, prev)}`
    }${verdict(key, diff, ", ")}. It rose in ${ups} of ${list.length} months; the largest move was ${biggest.month} (${
      biggest.diff >= 0 ? "+" : "−"
    }${formatMoney(Math.abs(biggest.diff))} vs ${biggest.prevMonth}).${extra}`;
  };

  const sums = (key) => {
    const list = pairs(key);
    return { cur: total(list, "cur"), prev: total(list, "prev"), has: list.length > 0 };
  };
  const rev = sums("revenue");
  const cogs = sums("cost_of_goods_sold");
  const opex = sums("opex");
  const gross = sums("gross_profit");
  const profit = sums("actual_profit");
  const was = N === 1 ? `in ${monthLabel(getComparePrevPeriod(compared[0].comparision))}` : "in the comparison periods";

  // Share of revenue now vs then — says whether a cost moved faster than sales.
  const ratio = (part, name) =>
    part.has && rev.cur && rev.prev
      ? ` ${name} was ${_pctOf(part.cur, rev.cur)} of revenue, versus ${_pctOf(part.prev, rev.prev)} ${was}.`
      : "";
  const margin = (part, name) =>
    part.has && rev.cur && rev.prev
      ? ` ${name} was ${_pctOf(part.cur, rev.cur)}, versus ${_pctOf(part.prev, rev.prev)} ${was}.`
      : "";

  // Profit change = revenue change − COGS change − opex change.
  const signed = (n) => `${n >= 0 ? "+" : "−"}${formatMoney(Math.abs(n))}`;
  const drivers = [
    ["revenue", rev.cur - rev.prev],
    ["cost of goods sold", -(cogs.cur - cogs.prev)],
    ["operating expense", -(opex.cur - opex.prev)],
  ];
  const mainDriver = [...drivers].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
  const profitDiff = profit.cur - profit.prev;
  const driverText = ` By line, revenue contributed ${signed(drivers[0][1])}, cost of goods sold ${signed(drivers[1][1])} and operating expense ${signed(drivers[2][1])} to the change.`;

  return {
    revenue: line("revenue", "Revenue"),
    cost_of_goods_sold: line("cost_of_goods_sold", "Cost of goods sold", ratio(cogs, "It")),
    gross_profit: line("gross_profit", "Gross profit", margin(gross, "Gross margin")),
    opex: line("opex", "Operating expense", ratio(opex, "It")),
    actual_profit: line("actual_profit", "Profit", `${margin(profit, "Net margin")}${profit.has ? driverText : ""}`),
    budget_profit: line("budget_profit", "Budgeted profit"),
    executive: profit.has
      ? [
          `${N === 1 ? `In ${monthLabel(compared[0].period)}` : `Across the ${N} months in view`}, profit was ${formatMoney(profit.cur)} against ${formatMoney(profit.prev)} ${was} — ${
            profitDiff === 0 ? "unchanged" : `${moved(profitDiff)} ${formatMoney(Math.abs(profitDiff))}${pctOfPrev(profitDiff, profit.prev)}`
          }${verdict("actual_profit", profitDiff, ", ")}.`,
          `The biggest driver was ${mainDriver[0]} (${signed(mainDriver[1])} to profit): revenue moved ${signed(rev.cur - rev.prev)}, cost of goods sold ${signed(cogs.cur - cogs.prev)} and operating expense ${signed(opex.cur - opex.prev)}.`,
        ]
      : [`No comparison figures are available for the period in view.`],
  };
};

// ✅ Normalize response: rows + metrics + filter options
const normalizePnLResponse = (data) => {
  if (!Array.isArray(data)) return { rows: [], metrics: null, filters: null };

  const metrics = data.find((x) => x?.keymetrics)?.keymetrics || null;
  const basisMeta = data.find((x) => x?.basis_meta)?.basis_meta || null;

  const rows = data
    .filter((x) => x && typeof x === "object" && x.period)
    .map((r) => ({
      ...r,
      comparision: r?.comparision || {},
      budget_data: r?.budget_data || {},
    }));

  // ✅ correct keys from backend
  const entities = data.find((x) => Array.isArray(x.entities))?.entities || [];

    const findArray = (keys = []) => {
    for (const key of keys) {
      const item = data.find((x) => Array.isArray(x?.[key]));
      if (item?.[key]) return item[key];
    }
    return [];
  };

  // const entities = findArray(["entities", "entity", "entities_list"]);
  const costCenters = findArray([
    "costcenters",
    "cost_centers",
    "cost_center",
    "cost_centers_list",
  ]);
  const profitCenters = findArray([
    "profitcenters",
    "profit_centers",
    "profit_center",
    "profit_centers_list",
  ]);
  const customers = findArray(["customers", "customer", "customers_list"]);
  const regions = findArray(["regions", "region", "regions_list"]);
  const products = findArray(["products", "product", "products_list"]);

  return {
    rows,
    metrics,
    basisMeta,
    filters: {
      entities,
      regions,
      products,
      costCenters,
      profitCenters,
      customers,
    },
  };
};

/* ================== AI INSIGHTS HELPERS ================== */
const TAG_PREFIX = {
  entity: "Entity",
  cost_center: "Cost Center",
  profit_center: "Profit Center",
  customer: "Customer",
  region: "Region",
  product_name: "Product",
  time_filter: "Period",
  currency_filter: "Values in",
  comparity_filter: "Comparison",
  mom_vs_budget: "Budget",
};

const monthLabel = (period) => {
  const m = /^(\d{4})-(\d{2})$/.exec(period || "");
  if (!m) return period;
  return new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
};

// Facts computed in code so the AI doesn't have to rank/compare months itself
// (it gets those wrong — e.g. calling the best month the weakest).
const buildPnlFactsForAI = (allRows) => {
  const periodRows = allRows.filter((r) => /^\d{4}-\d{2}$/.test(r.period || ""));
  if (!periodRows.length) return null;

  const months = periodRows.map((r) => ({
    month: monthLabel(r.period),
    revenue: _pnlNum(r, "revenue"),
    actual_profit: _pnlNum(r, "actual_profit"),
    budget_profit: _pnlNum(r, "budget_profit"),
    variance: _pnlNum(r, "variance"),
    operating_expense: _pnlNum(r, "operating_expense") || _pnlNum(r, "opex"),
  }));
  const by = (key, dir) =>
    [...months].sort((a, b) => (dir === "max" ? b[key] - a[key] : a[key] - b[key]))[0];
  const pick = (m, key) => ({ month: m.month, [key]: m[key] });
  const hasBudget = months.some((m) => m.budget_profit);

  return {
    months_in_view: months.length,
    highest_revenue_month: pick(by("revenue", "max"), "revenue"),
    lowest_revenue_month: pick(by("revenue", "min"), "revenue"),
    highest_profit_month: pick(by("actual_profit", "max"), "actual_profit"),
    lowest_profit_month: pick(by("actual_profit", "min"), "actual_profit"),
    highest_operating_expense_month: pick(by("operating_expense", "max"), "operating_expense"),
    lowest_operating_expense_month: pick(by("operating_expense", "min"), "operating_expense"),
    ...(hasBudget && {
      months_profit_above_budget: months.filter((m) => m.variance > 0).map((m) => m.month),
      months_profit_below_budget: months.filter((m) => m.variance < 0).map((m) => m.month),
      largest_favorable_variance_month: pick(by("variance", "max"), "variance"),
      largest_unfavorable_variance_month: pick(by("variance", "min"), "variance"),
    }),
  };
};

/* ================== REFINE WITH AI (LINE-ITEM COMMENTARY) HELPERS ================== */
// For these lines, actual above budget / prior period is unfavorable.
const COST_LINE_KEYS = new Set(["cost_of_goods_sold", "opex"]);

const _round2 = (n) => Math.round(n * 100) / 100;

// A cell value as shown ("1,234.50", "1.2M", "-3.4") -> number in the
// on-screen scale, or null when the cell is empty.
const _aiNum = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[$,%\s]/g, "").replace(/[KMB]$/i, ""));
  return Number.isFinite(n) ? _round2(n) : null;
};

const _sumOf = (list, key) => _round2(list.reduce((acc, x) => acc + (x[key] ?? 0), 0));

// Highest / lowest entry of `list` by `key`, named hiName / loName.
const _extremes = (list, key, hiName, loName) => {
  const valid = list.filter((x) => x[key] !== null && x[key] !== undefined);
  if (!valid.length) return {};
  const sorted = [...valid].sort((a, b) => b[key] - a[key]);
  const pick = (x) => ({ month: x.month, [key]: x[key] });
  return { [hiName]: pick(sorted[0]), [loName]: pick(sorted[sorted.length - 1]) };
};

const mapify = (arr) =>
  arr.reduce((acc, x) => {
    if (x.id == null) return acc;
    acc[String(x.id)] = x.label;
    return acc;
  }, {});

/* ================== COMPONENT ================== */
// The comparison basis (Budget / Official Forecast / scenario) is remembered
// per user; the provider sits here until other reports adopt it.
export default function PnLReportPage() {
  return (
    <ComparisonBasisProvider>
      <PnLReportPageInner />
    </ComparisonBasisProvider>
  );
}

function PnLReportPageInner() {
  const {
    token,
    selectedYear: year,
    selectedCurrency,
  } = useContext(AuthContext);

  const [rows, setRows] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [basisMeta, setBasisMeta] = useState(null);
  const [loading, setLoading] = useState(false);

  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTER_STATE);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTER_STATE);

  // What the plan columns compare with. The applied choice lives in the
  // shared context (remembered per user); the filter panel edits a draft
  // until Apply.
  const comparisonBasis = useComparisonBasis();
  const basisState = comparisonBasis.state;
  const appliedBasis = encodeBasis(basisState);
  const [draftBasis, setDraftBasis] = useState(appliedBasis);
  useEffect(() => { setDraftBasis(appliedBasis); }, [appliedBasis]);

  // dropdown options
  const [entities, setEntities] = useState([{ id: null, label: "All" }]);
  const [costCenters, setCostCenters] = useState([{ id: null, label: "All" }]);
  const [profitCenters, setProfitCenters] = useState([
    { id: null, label: "All" },
  ]);
  const [customers, setCustomers] = useState([{ id: null, label: "All" }]);
  const [regions, setRegions] = useState([{ id: null, label: "All" }]);
  const [products, setProducts] = useState([{ id: null, label: "All" }]);

  // ✅ id -> name maps for drilldown endpoint
  const [idToName, setIdToName] = useState({
    entity: {},
    region: {},
    product_name: {},
    cost_center: {},
    profit_center: {},
    customer: {},
  });

  // drilldown state
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillMetric, setDrillMetric] = useState("revenue");
  const [drillPeriod, setDrillPeriod] = useState(null);

  const openDrill = (metricKey, period) => {
    const endpointMetric = METRIC_TO_DRILL_ENDPOINT[metricKey]
    setDrillMetric(endpointMetric);
    setDrillPeriod(period);
    setDrillOpen(true);
  };

  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const [sortConfig, setSortConfig] = useState({ sort_by: "period", sort_order: "asc" });
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef(null);

  const hasComparisonSelected = !!appliedFilters.comparity_filter;
  const hasBudgetSelected = appliedFilters.mom_vs_budget === "budget_data";
  // Forecast / scenario basis in use (Budget behaves exactly as before).
  const usesPlanBasis = hasBudgetSelected && basisState.basis !== "budget";
  const basis = basisLabels(usesPlanBasis ? basisState : null, usesPlanBasis ? basisMeta : null);
  const PLAN_DRILL_NOTE = "Drill-down vs forecast comes in a later phase";

  // Drilldowns explain the comparison the clicked table shows (vs previous
  // month, same month last year, or budget) within the report's filters.
  // The comparison table wins over budget, as in the tables below.
  const drillQuery = useMemo(() => {
    const p = new URLSearchParams();
    p.set(
      "compare_to",
      hasComparisonSelected
        ? appliedFilters.comparity_filter === "year_on_year" ? "previous_year" : "previous_month"
        : hasBudgetSelected && !usesPlanBasis ? "budget" : "previous_month",
    );
    ["entity", "cost_center", "profit_center", "customer"].forEach((key) => {
      const v = appliedFilters[key];
      if (v !== null && v !== undefined && v !== "") p.set(key, v);
    });
    return p.toString();
  }, [appliedFilters, hasComparisonSelected, hasBudgetSelected, usesPlanBasis]);

  /* ================= CLOSE FILTER / SORT ================= */
  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
      if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const hasPendingChanges = useMemo(
    () =>
      JSON.stringify(draftFilters) !== JSON.stringify(appliedFilters) ||
      (!!draftFilters.mom_vs_budget && draftBasis !== appliedBasis),
    [draftFilters, appliedFilters, draftBasis, appliedBasis],
  );

  /* ================= FETCH ================= */
  useEffect(() => {
    if (!token || !year || !selectedCurrency) return;
    // A forecast/scenario request waits for the year's final-version
    // fingerprint (it's part of the URL), so it isn't sent twice.
    if (usesPlanBasis && !comparisonBasis.optionsReady) return;

    const fetchPnL = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();

        Object.entries(appliedFilters).forEach(([key, value]) => {
          if (value === null || value === "") return;

          if (key === "time_filter" && value === "all_periods") return;
          if (key === "currency_filter" && value === "actualvalue") return;

          if (key === "comparity_filter") {
            params.append("comparision", value);
            return;
          }

          // ✅ DO NOT send budget_metric to backend (UI-only)
          if (key === "budget_metric") return;

          params.append(key, value);
        });

        params.append("sort_by", sortConfig.sort_by);
        params.append("sort_order", sortConfig.sort_order);
        if (usesPlanBasis) {
          Object.entries(basisQueryParams(basisState, comparisonBasis.fingerprint)).forEach(([k, v]) => {
            if (v !== null && v !== undefined && v !== "") params.append(k, v);
          });
        }

        const url = `${API_BASE_URL}/api/v1/company/financial/profitandloss_statement/${year}/${selectedCurrency}?${params.toString()}`;

        const data = await cachedFetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            accept: "application/json",
          },
        });
        const normalized = normalizePnLResponse(data);

        // ✅ Build dropdown options INSIDE fetch (this fixes your "normalized not defined" issue)
        if (normalized.filters) {
  const f = normalized.filters;

  const ent = [
    { id: null, label: "All" },
    ...(f.entities || [])
      .filter((e) => e.entity_id && e.entity_name)
      .map((e) => ({
        id: e.entity_id,
        label: e.entity_name,
      })),
  ];

  const reg = [
    { id: null, label: "All" },
    ...(f.regions || [])
      .filter((r) => (r.region_id || r.id) && (r.region_name || r.name))
      .map((r) => ({
        id: r.region_id ?? r.id,
        label: r.region_name ?? r.name,
      })),
  ];

  const prod = [
    { id: null, label: "All" },
    ...(f.products || [])
      .filter((p) => (p.product_id || p.id) && (p.product_name || p.name))
      .map((p) => ({
        id: p.product_id ?? p.id,
        label: p.product_name ?? p.name,
      })),
  ];

  const cc = [
    { id: null, label: "All" },
    ...(f.costCenters || [])
      .filter((c) => c.cost_center_id && c.name)
      .map((c) => ({
        id: c.cost_center_id,
        label: c.name,
      })),
  ];

  const pc = [
    { id: null, label: "All" },
    ...(f.profitCenters || [])
      .filter((p) => p.profit_center_id && p.name)
      .map((p) => ({
        id: p.profit_center_id,
        label: p.name,
      })),
  ];

  const cust = [
    { id: null, label: "All" },
    ...(f.customers || [])
      .filter((c) => (c.customer_id || c.id) && (c.customer_name || c.name))
      .map((c) => ({
        id: c.customer_id ?? c.id,
        label: c.customer_name ?? c.name,
      })),
  ];

  setEntities(ent);
  setRegions(reg);
  setProducts(prod);
  setCostCenters(cc);
  setProfitCenters(pc);
  setCustomers(cust);
}

        setRows(normalized.rows || []);
        setMetrics(normalized.metrics || null);
        setBasisMeta(normalized.basisMeta || null);
      } catch (e) {
        console.error(e);
        setRows([]);
        setMetrics(null);
        setBasisMeta(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPnL();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, year, selectedCurrency, JSON.stringify(appliedFilters), JSON.stringify(sortConfig),
    usesPlanBasis, appliedBasis, comparisonBasis.optionsReady, comparisonBasis.fingerprint]);

  /* ================= APPLY / RESET ================= */
  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    if (draftFilters.mom_vs_budget && draftBasis !== appliedBasis) {
      comparisonBasis.setBasis(decodeBasis(draftBasis, comparisonBasis.options));
    }
    setOpen(false);
  };

  const resetAll = () => {
    setDraftFilters(DEFAULT_FILTER_STATE);
    setAppliedFilters(DEFAULT_FILTER_STATE);
    setDraftBasis(appliedBasis);
    setOpen(false);
  };

  /* ================= PERIODS ================= */
  const periods = useMemo(() => rows.map((r) => r.period), [rows]);

  // Columns shown in the tables. With a single month in view (e.g. the
  // default Current Month) the backend's "total" column just repeats it.
  const tableRows = useMemo(() => {
    const months = rows.filter((r) => r.period !== "total");
    return months.length <= 1 ? months : rows;
  }, [rows]);
  const pnlNarrative = useMemo(
    () => buildPnlNarrative(rows, metrics?.best_month, metrics?.worst_month),
    [rows, metrics]
  );
  // In the MoM vs Budget table the insights compare each line with its budget.
  const budgetNarrative = useMemo(
    () =>
      hasBudgetSelected
        ? buildBudgetNarrative(
            rows.filter((r) => r.period !== "total" && (!usesPlanBasis || r.budget_data?.budget_revenue != null)),
            basis.noun,
          )
        : {},
    [rows, hasBudgetSelected, usesPlanBasis, basis.noun]
  );
  // In the comparison table they compare each line with its comparison period.
  const comparisonNarrative = useMemo(
    () => (hasComparisonSelected ? buildComparisonNarrative(rows.filter((r) => r.period !== "total")) : {}),
    [rows, hasComparisonSelected]
  );
  const activeNarrative = hasComparisonSelected
    ? (Object.keys(comparisonNarrative).length ? comparisonNarrative : pnlNarrative)
    : hasBudgetSelected ? budgetNarrative : pnlNarrative;

  /* ================= Comparison metrics (hide variance rows) ================= */
  const comparisonMetrics = useMemo(
    () =>
      COMPARE_METRICS.filter(
        (m) => m.key !== "variance" && m.key !== "variance_percentage",
      ).map((m) => (usesPlanBasis && m.key === "budget_profit" ? { ...m, label: `${basis.shortLabel.toUpperCase()} PROFIT` } : m)),
    [usesPlanBasis, basis.shortLabel],
  );

  /* ================= LABELS FOR COMPARISON HEADER ================= */
  const firstCompareRow = useMemo(() => {
    if (!hasComparisonSelected) return null;
    return rows.find((r) => r?.period && getComparePrevPeriod(r?.comparision));
  }, [rows, hasComparisonSelected]);

  const currentPeriodLabel = firstCompareRow?.period || "Current";
  const prevPeriodLabel =
    getComparePrevPeriod(firstCompareRow?.comparision) || "Previous";
  const varianceLabel = `${currentPeriodLabel} vs ${prevPeriodLabel}`;

  /* ================= ACTIVE TAGS ================= */
  const getLabel = (list, id) =>
    list.find((i) => safeId(i.id) === safeId(id))?.label;

  const activeTags = useMemo(() => {
    const tags = [];

    if (appliedFilters.entity)
      tags.push({
        key: "entity",
        label: getLabel(entities, appliedFilters.entity),
      });
    if (appliedFilters.cost_center)
      tags.push({
        key: "cost_center",
        label: getLabel(costCenters, appliedFilters.cost_center),
      });
    if (appliedFilters.profit_center)
      tags.push({
        key: "profit_center",
        label: getLabel(profitCenters, appliedFilters.profit_center),
      });
    if (appliedFilters.customer)
      tags.push({
        key: "customer",
        label: getLabel(customers, appliedFilters.customer),
      });
    if (appliedFilters.region)
      tags.push({
        key: "region",
        label: getLabel(regions, appliedFilters.region),
      });
    if (appliedFilters.product_name)
      tags.push({
        key: "product_name",
        label: getLabel(products, appliedFilters.product_name),
      });

    if (appliedFilters.time_filter !== "all_periods") {
      tags.push({
        key: "time_filter",
        label: TIME_FILTERS.find((t) => t.id === appliedFilters.time_filter)
          ?.label,
      });
    }

    if (appliedFilters.date_from) {
      tags.push({
        key: "date_from",
        label: `From: ${appliedFilters.date_from}`,
      });
    }

    if (appliedFilters.date_to) {
      tags.push({
        key: "date_to",
        label: `To: ${appliedFilters.date_to}`,
      });
    }

    if (appliedFilters.currency_filter !== "actualvalue") {
      tags.push({
        key: "currency_filter",
        label: CURRENCY_FILTERS.find(
          (c) => c.id === appliedFilters.currency_filter,
        )?.label,
      });
    }

    if (appliedFilters.comparity_filter) {
      tags.push({
        key: "comparity_filter",
        label: comparity_filterS.find(
          (c) => c.id === appliedFilters.comparity_filter,
        )?.label,
      });
    }

    if (appliedFilters.mom_vs_budget) {
      tags.push({
        key: "mom_vs_budget",
        label: usesPlanBasis
          ? `MoM vs ${basis.label}`
          : MOM_BUDGET_FILTERS.find(
              (b) => b.id === appliedFilters.mom_vs_budget,
            )?.label,
      });
    }

    return tags.filter((t) => t.label);
  }, [
    appliedFilters,
    entities,
    costCenters,
    profitCenters,
    customers,
    regions,
    products,
    usesPlanBasis,
    basis.label,
  ]);

  // View More opens with these filters applied: values in the URL (so a
  // refresh keeps them), chip labels in router state. Comparison and budget
  // view modes stay here — View More has its own tabs for those.
  const viewMoreLink = useMemo(() => {
    const p = new URLSearchParams();
    VIEW_MORE_FILTER_KEYS.forEach((key) => {
      const value = appliedFilters[key];
      if (value === null || value === undefined || value === "") return;
      if (key === "time_filter" && value === "all_periods") return;
      if (key === "currency_filter" && value === "actualvalue") return;
      p.append(key, value);
    });
    const query = p.toString();
    return {
      to: { pathname: "/p&l-Dashboard", search: query ? `?${query}` : "" },
      state: { filterLabels: Object.fromEntries(activeTags.map((t) => [t.key, t.label])) },
    };
  }, [appliedFilters, activeTags]);

  /* ================= AI INSIGHTS / COMMENTARY ================= */
  // budget_metric only switches which budget column is shown; the data is the same.
  // A forecast/scenario comparison keeps its own saved commentary, so
  // explanations written against the budget don't show up under it.
  const { budget_metric: _budgetMetric, ...filtersForCommentary } = appliedFilters; // eslint-disable-line no-unused-vars
  const commentaryFilters = usesPlanBasis ? { ...filtersForCommentary, compare_with: appliedBasis } : filtersForCommentary;

  const commentary = useReportCommentary({
    token,
    reportId: "pnl",
    year,
    currency: selectedCurrency,
    filters: commentaryFilters,
  });

  const insightFilterLabels = useMemo(
    () => activeTags.map((t) => (TAG_PREFIX[t.key] ? `${TAG_PREFIX[t.key]}: ${t.label}` : t.label)),
    [activeTags],
  );

  const buildInsightsContext = () => {
    if (!rows.length) return "";
    const data = {
      value_scale: CURRENCY_FILTERS.find((c) => c.id === appliedFilters.currency_filter)?.label || "Actual",
      ...(usesPlanBasis && { comparison_basis: `${basis.label}; budget_* fields hold ${basis.noun} values` }),
      key_metrics: compactForAI(metrics),
      verified_facts: buildPnlFactsForAI(rows),
      rows: rows.map((r) => compactForAI({ ...r, period: monthLabel(r.period) })),
    };
    return JSON.stringify(data);
  };

  const removeFilter = (tag) => {
    const next = { ...appliedFilters };

    if (tag.key === "time_filter") next.time_filter = "all_periods";
    else if (tag.key === "date_from") next.date_from = "";
    else if (tag.key === "date_to") next.date_to = "";
    else if (tag.key === "currency_filter")
      next.currency_filter = "actualvalue";
    else if (tag.key === "comparity_filter") next.comparity_filter = "";
    else if (tag.key === "mom_vs_budget") next.mom_vs_budget = "";
    else next[tag.key] = null;

    setAppliedFilters(next);
    setDraftFilters(next);
  };

  /* ================= Budget helpers ================= */

  const BUDGET_METRIC_OPTIONS = [
    { id: "revenue", label: "Revenue" },
    { id: "opex", label: "Opex" },
    { id: "cogs", label: "COGS" },
  ];
  // The budget table's lines (every P&L line vs budget) are BUDGET_ROWS above.

  // ✅ map UI metric -> API budget_data key
  const getBudgetKey = () => {
    const k = appliedFilters.budget_metric;
    if (k === "revenue") return "budget_revenue";
    if (k === "opex") return "budget_opex";
    return "budget_cogs";
  };

  // ✅ budget value comes from budget_data.budget_revenue / budget_opex / budget_cogs
  // const getBudgetValueForRow = (r) => {
  //   if (!hasBudgetSelected) return null;
  //   const key = getBudgetKey();
  //   return r?.budget_data?.[key] ?? null;
  // };

  // ✅ variance keys in API: revenue_variance / opex_variance / cogs_variance
  // const getBudgetVarianceForRow = (r) => {
  //   if (!hasBudgetSelected) return null;

  //   const k = appliedFilters.budget_metric;
  //   const candidates =
  //     k === "revenue"
  //       ? ["revenue_variance"]
  //       : k === "opex"
  //       ? ["opex_variance", "operating_expense_variance"]
  //       : ["cogs_variance", "cost_of_goods_sold_variance"];

  //   const v = pickFirst(r?.budget_data, candidates);
  //   return v ?? null;
  // };

  /* ================= REFINE WITH AI (LINE-ITEM COMMENTARY) ================= */
  const lineCommentary = useLineItemCommentary({
    token,
    reportId: "pnl",
    year,
    currency: selectedCurrency,
    filters: commentaryFilters,
  });

  const [refineLine, setRefineLine] = useState(null);
  const [analyzeTarget, setAnalyzeTarget] = useState(null);
  const viewKey = `${year}|${selectedCurrency}|${JSON.stringify(appliedFilters)}`;
  useEffect(() => {
    setRefineLine(null);
    setAnalyzeTarget(null);
  }, [viewKey]);

  /* ================= ANALYZE WITH AI ================= */
  // Drill-down endpoints filter by name and only on some dimensions; the
  // rest are reported to the AI as not applied to the driver detail.
  const drillFilters = {
    ...(appliedFilters.entity && { entity_name: getLabel(entities, appliedFilters.entity) }),
    ...(appliedFilters.product_name && { product_name: getLabel(products, appliedFilters.product_name) }),
    ...(appliedFilters.region && { region: getLabel(regions, appliedFilters.region) }),
  };
  const drillFiltersNotApplied = [
    appliedFilters.customer && `Customer: ${getLabel(customers, appliedFilters.customer)}`,
    appliedFilters.cost_center && `Cost Center: ${getLabel(costCenters, appliedFilters.cost_center)}`,
    appliedFilters.profit_center && `Profit Center: ${getLabel(profitCenters, appliedFilters.profit_center)}`,
  ].filter(Boolean);

  const loadAnalysisContext = (target) =>
    buildPnlAnalysisContext({
      target,
      rows,
      metrics,
      token,
      currency: selectedCurrency,
      tableScale: CURRENCY_FILTERS.find((c) => c.id === appliedFilters.currency_filter)?.label || "Actual",
      drillFilters,
      drillFiltersNotApplied,
      getValue: getRowValue,
      monthLabel,
    });

  const analyzeCellButton = (m, r, mode, value) => {
    if (!/^\d{4}-\d{2}$/.test(r.period || "")) return null;
    const month = monthLabel(r.period);
    const prevPeriod = getComparePrevPeriod(r?.comparision);
    const title =
      mode === "budget"
        ? `${m.label} vs ${basis.noun} — ${month}`
        : mode === "comparison"
          ? `${m.label} — ${month} vs ${prevPeriod || "prior period"}`
          : `${m.label} — ${month}`;
    const tooltipBody =
      mode === "budget"
        ? "AI explains why actuals differ from budget, with supporting data, and answers follow-up questions."
        : mode === "comparison"
          ? `AI explains what drove the change versus ${prevPeriod || "the previous period"}, with supporting data, and answers follow-up questions.`
          : "AI breaks down what drove this number, with supporting data, and answers follow-up questions.";
    // Pinned to the cell's top-right corner (the cell is `relative`), next to
    // the end of the right-aligned number, so it doesn't widen every column.
    return (
      <AnalyzeButton
        onClick={() =>
          setAnalyzeTarget({ kind: "cell", component: "table", metric: m.key, period: r.period, mode, title, value })
        }
        title={`Explain ${m.label} for ${month} with AI`}
        tooltip={{ heading: "Explain with AI", context: `${m.label} · ${month} · ${value}`, body: tooltipBody }}
        className="absolute top-0 right-0 opacity-70 hover:opacity-100 focus:opacity-100"
      />
    );
  };

  const analyzeKpi = (metric, label, value) =>
    setAnalyzeTarget({ kind: "kpi", component: "kpi", metric, mode: tableMode, title: label, value });

  // Best / Worst Month: analyze that month's profit vs budget.
  const analyzeMonthKpi = (label, period) =>
    /^\d{4}-\d{2}$/.test(period || "")
      ? () =>
          setAnalyzeTarget({
            kind: "cell",
            component: "kpi",
            metric: "variance",
            period,
            mode: tableMode,
            title: `${label}: ${monthLabel(period)} — profit vs ${basis.noun}`,
            value: monthLabel(period),
          })
      : undefined;

  // The rows of whichever table is on screen.
  const tableMode = hasComparisonSelected ? "comparison" : hasBudgetSelected ? "budget" : "monthly";
  const lineItems =
    tableMode === "comparison" ? comparisonMetrics : tableMode === "budget" ? BUDGET_ROWS : COMPARE_METRICS;

  // A month value that opens the drilldown drawer (budget and comparison
  // tables). Lines without a drilldown endpoint (e.g. gross margin %) stay text.
  const drillValue = (metricKey, period, text) =>
    METRIC_TO_DRILL_ENDPOINT[metricKey] ? (
      <button
        onClick={() => openDrill(metricKey, period)}
        className="text-sky-900 border-white border-b hover:border-b hover:text-blue-500"
        title="Open drilldown"
      >
        {text}
      </button>
    ) : (
      text
    );

  const renderLineLabel = (m) => (
    <span className="flex items-center justify-between gap-2">
      {m.label}
      <LineItemAIButton
        label={m.label}
        hasCommentary={!!lineCommentary.byLine[m.key]}
        onClick={() => setRefineLine({ key: m.key, label: m.label })}
      />
    </span>
  );

  // Insights + Recommendation cells for a line (monthly, comparison and budget tables).
  // Saved "Refine with AI" commentary (one per line for this view, so always
  // the latest) wins over the rule-based narrative.
  // Both columns are pinned to the right edge (Insights sits the width of
  // Recommendation in from it) so the month columns scroll between them and
  // the sticky METRIC column.
  const renderCommentaryCells = (m) => {
    const saved = lineCommentary.byLine[m.key];
    const insightText = saved?.explanation || activeNarrative[m.key] || "—";
    return (
      <>
        <td className={`px-3 py-2 text-sky-700 ${STICKY_INSIGHTS} bg-white`}>
          <p className="w-[220px] line-clamp-2 leading-snug whitespace-normal" title={insightText}>
            {saved?.explanation && (
              <BsChatLeftTextFill
                size={11}
                className="inline mr-1 align-[-1px] text-emerald-600"
                aria-label="Saved AI commentary"
              />
            )}
            {insightText}
          </p>
        </td>
        <td className={`px-3 py-2 text-sky-700 ${STICKY_RECOMMENDATION} bg-white`}>
          {saved?.recommendation ? (
            <p className="w-[190px] line-clamp-2 leading-snug whitespace-normal" title={saved.recommendation}>
              {saved.recommendation}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setRefineLine({ key: m.key, label: m.label })}
              className="inline-flex items-center gap-1 text-left text-sky-500 hover:text-sky-800"
            >
              <BsChatLeftText size={12} /> Get AI recommendation
            </button>
          )}
        </td>
      </>
    );
  };

  // Data for one line item exactly as the current table shows it, plus
  // code-computed facts (totals, best/worst months, favorable/unfavorable
  // months) and the full P&L for driver context.
  const buildLineItemContext = (lineKey) => {
    const line = lineItems.find((l) => l.key === lineKey);
    const periodRows = rows.filter((r) => /^\d{4}-\d{2}$/.test(r.period || ""));
    if (!line || !periodRows.length) return "";
    const isCost = COST_LINE_KEYS.has(lineKey);
    let view;
    let months;
    let lineFacts;

    if (tableMode === "budget") {
      view = `Actual vs ${basis.label} by month`;
      months = periodRows.map((r) => {
        const actual = _aiNum(budgetActual(line, r));
        const budget = _aiNum(line.budget(r));
        const diff = actual !== null && budget !== null ? _round2(actual - budget) : null;
        return {
          month: monthLabel(r.period),
          actual,
          budget,
          variance_as_displayed: _aiNum(line.variance(r)),
          actual_minus_budget: diff,
          favorable: diff === null ? null : isCost ? diff <= 0 : diff >= 0,
        };
      });
      const totalActual = _sumOf(months, "actual");
      const totalBudget = _sumOf(months, "budget");
      lineFacts = {
        // Percentages (gross margin) don't add up across months.
        ...(line.isPct
          ? { unit: "percent; actual_minus_budget is in percentage points" }
          : {
              total_actual: totalActual,
              total_budget: totalBudget,
              total_actual_minus_budget: _round2(totalActual - totalBudget),
              total_actual_minus_budget_pct: totalBudget
                ? _round2(((totalActual - totalBudget) / Math.abs(totalBudget)) * 100)
                : null,
            }),
        months_favorable: months.filter((m) => m.favorable === true).map((m) => m.month),
        months_unfavorable: months.filter((m) => m.favorable === false).map((m) => m.month),
        ..._extremes(months, "actual_minus_budget", "largest_actual_above_budget", "largest_actual_below_budget"),
      };
    } else if (tableMode === "comparison") {
      view = "Current vs prior period by month";
      months = periodRows.map((r) => {
        const c = r?.comparision || {};
        return {
          month: monthLabel(r.period),
          compared_with: getComparePrevPeriod(c) ?? null,
          current: _aiNum(getRowValue(r, line.key)),
          previous: _aiNum(getComparePrev(c, line.key)),
          change: _aiNum(getCompareDiff(c, line.key)),
        };
      });
      lineFacts = {
        total_current: _sumOf(months, "current"),
        total_previous: _sumOf(months, "previous"),
        total_change: _sumOf(months, "change"),
        months_increased: months.filter((m) => m.change > 0).map((m) => m.month),
        months_decreased: months.filter((m) => m.change < 0).map((m) => m.month),
        ..._extremes(months, "change", "largest_increase", "largest_decrease"),
      };
    } else {
      view = "Monthly P&L";
      months = periodRows.map((r) => ({ month: monthLabel(r.period), value: _aiNum(getRowValue(r, line.key)) }));
      const valid = months.filter((m) => m.value !== null);
      const moves = valid
        .slice(1)
        .map((m, i) => ({ month: m.month, change_vs_prior_month: _round2(m.value - valid[i].value) }));
      lineFacts = {
        ...(!line.isPct && { total: _sumOf(months, "value") }),
        average: valid.length ? _round2(valid.reduce((acc, m) => acc + m.value, 0) / valid.length) : null,
        ..._extremes(months, "value", "highest_month", "lowest_month"),
        ..._extremes(moves, "change_vs_prior_month", "largest_rise_vs_prior_month", "largest_drop_vs_prior_month"),
        ...((lineKey === "variance" || lineKey === "variance_percentage") && {
          definition: "Variance = actual profit minus budget profit; positive means actual beat budget.",
        }),
      };
    }
    lineFacts.is_cost_line = isCost;

    // Cost lines: cost as % of revenue per month, and what the worst month
    // would have saved at the average ratio — concrete targets for the
    // recommendation.
    if (isCost) {
      const valueKey = tableMode === "budget" ? "actual" : tableMode === "comparison" ? "current" : "value";
      months = months.map((m, i) => {
        const revenue = _aiNum(getRowValue(periodRows[i], "revenue"));
        return {
          ...m,
          revenue,
          pct_of_revenue: revenue && m[valueKey] !== null ? _round2((m[valueKey] / revenue) * 100) : null,
        };
      });
      const withRatio = months.filter((m) => m.pct_of_revenue !== null);
      if (withRatio.length) {
        const totalCost = _sumOf(withRatio, valueKey);
        const totalRevenue = _sumOf(withRatio, "revenue");
        const avgPct = totalRevenue ? _round2((totalCost / totalRevenue) * 100) : null;
        const ratioExtremes = _extremes(withRatio, "pct_of_revenue", "highest_pct_of_revenue_month", "lowest_pct_of_revenue_month");
        const worst = withRatio.find((m) => m.month === ratioExtremes.highest_pct_of_revenue_month?.month);
        Object.assign(lineFacts, {
          pct_of_revenue_overall: avgPct,
          ...ratioExtremes,
          ...(worst && avgPct !== null && {
            saving_if_highest_month_at_overall_pct: _round2(worst[valueKey] - (worst.revenue * avgPct) / 100),
          }),
          saving_if_every_month_at_lowest_pct: _round2(
            withRatio.reduce(
              (acc, m) => acc + Math.max(0, m[valueKey] - (m.revenue * ratioExtremes.lowest_pct_of_revenue_month.pct_of_revenue) / 100),
              0,
            ),
          ),
        });
      }
    }

    return JSON.stringify({
      view,
      value_scale: CURRENCY_FILTERS.find((c) => c.id === appliedFilters.currency_filter)?.label || "Actual",
      line_item: line.label,
      line_months: months,
      line_facts: lineFacts,
      full_report_rows: rows.map((r) => compactForAI({ ...r, period: monthLabel(r.period) })),
    });
  };

  /* ================= CSV ================= */
  const csvData = useMemo(() => {
    if (!rows.length) return [];

    if (hasBudgetSelected && !hasComparisonSelected) {
      const header = [
        "metric",
        ...rows.flatMap((r) => [
          `${r.period} actual`,
          `${r.period} ${basis.shortLabel.toLowerCase()}`,
          `${r.period} variance`,
        ]),
      ];
      const body = BUDGET_ROWS.map((m) => [
        m.label,
        ...rows.flatMap((r) => [budgetActual(m, r) ?? "", m.budget(r) ?? "", m.variance(r) ?? ""]),
      ]);
      return [header, ...body];
    }

    if (!hasComparisonSelected) {
      const header = ["metric", ...periods];
      const body = COMPARE_METRICS.map((m) => [
        m.label,
        ...rows.map((r) => {
          const raw = getRowValue(r, m.key);
          return raw ?? "";
        }),
      ]);
      return [header, ...body];
    }

    const header = [
      "metric",
      ...rows.flatMap((r) => [
        `${r.period} current`,
        `${r.period} previous`,
        `${r.period} variance`,
      ]),
    ];

    const body = comparisonMetrics.map((m) => [
      m.label,
      ...rows.flatMap((r) => {
        const c = r?.comparision || {};
        const cur = getRowValue(r, m.key) ?? "";
        const prev = getComparePrev(c, m.key) ?? "";
        const diff = getCompareDiff(c, m.key) ?? "";
        return [cur, prev, diff];
      }),
    ]);

    return [header, ...body];
  }, [
    rows,
    periods,
    hasComparisonSelected,
    hasBudgetSelected,
    comparisonMetrics,
    basis.shortLabel,
  ]);

  // Same param names the fetch above sends, so a scheduled send reproduces
  // this exact filtered view.
  const scheduleFilters = useMemo(() => {
    const out = {};
    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (value === null || value === "") return;
      if (key === "time_filter" && value === "all_periods") return;
      if (key === "currency_filter" && value === "actualvalue") return;
      if (key === "comparity_filter") {
        out.comparision = value;
        return;
      }
      if (key === "budget_metric") return;
      out[key] = value;
    });
    if (usesPlanBasis) Object.assign(out, basisQueryParams(basisState));
    out.sort_by = sortConfig.sort_by;
    out.sort_order = sortConfig.sort_order;
    return out;
  }, [appliedFilters, sortConfig, usesPlanBasis, basisState]);

  // The commentary shown under the report, offered with the CSV download.
  const exportCommentary = collectCommentary({
    lines: lineItems,
    byLine: lineCommentary.byLine,
    reportItems: commentary.items,
  });

  /* ================= UI ================= */
  return (
    <ReportsLayout>
      <main className="flex-1 min-w-0 bg-white p-3 rounded-xl shadow-md">
        {/* HEADER */}
        <div className="flex justify-between items-center gap-3 mb-2">
          <div>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h2 className="text-lg font-semibold text-sky-900">
                Profit &amp; Loss Statement
              </h2>
              <p className="text-s text-sky-600">
                Revenue, cost &amp; profitability analysis
              </p>
            </div>
            <p className="text-s bg-yellow-100 text-sky-900 px-2 py-0.5 rounded-md mt-1 inline-block"><strong>Note :</strong>  Click on any <strong> MONTH VALUE	</strong>  to view detailed drilldown insights · click <BsStars className="inline text-sky-600 align-[-2px]" /> next to a value for an AI explanation</p>
          </div>

          <div className="flex gap-2">
            <Link
              to={viewMoreLink.to}
              state={viewMoreLink.state}
              className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg"
            >
              View More <FaArrowRightToBracket className="ml-1" />
            </Link>
          </div>
        </div>

        {/* TAGS + ACTIONS */}
        <div className="flex items-start justify-between gap-3 mb-3" ref={ref}>
          {/* LEFT: ACTIVE TAGS */}
          <div className="flex flex-wrap gap-2 min-h-[34px]">
            {activeTags.length === 0 ? (
              <span className="text-x text-sky-600">No filters applied</span>
            ) : (
              activeTags.map((t) => (
                <span
                  key={`${t.key}-${t.label}`}
                  className="flex items-center gap-2 px-3 py-1 text-x rounded-full bg-sky-800 text-white"
                >
                  {t.label}
                  <button
                    onClick={() => removeFilter(t)}
                    className="text-sky-200 hover:text-white font-bold"
                    title="Remove"
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>

          {/* RIGHT: ACTIONS */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setOpen(!open)}
                aria-label="Filters"
                className="relative group flex items-center gap-1 px-3 py-2.5 text-x font-medium bg-sky-100 text-sky-800 rounded-lg border border-sky-200 hover:bg-sky-200"
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
                    className="absolute right-0 mt-2 w-[520px] bg-sky-50 border border-sky-200 rounded-xl shadow-lg z-50"
                  >
                    <div className="p-4 grid grid-cols-2 gap-3 text-x">
                      <SelectId
                        label="Period"
                        value={draftFilters.time_filter}
                        options={TIME_FILTERS}
                        onChange={(v) =>
                          setDraftFilters((f) => ({ ...f, time_filter: v }))
                        }
                      />

                      <SelectId
                        label="Product"
                        value={draftFilters.product_name}
                        options={products}
                        onChange={(v) =>
                          setDraftFilters((f) => ({ ...f, product_name: v }))
                        }
                      />

                      <div>
                        <label className="block mb-1 text-sky-700">
                          Date From (YYYY-MM)
                        </label>
                        <input
                          type="month"
                          value={draftFilters.date_from}
                          onChange={(e) =>
                            setDraftFilters((f) => ({
                              ...f,
                              date_from: e.target.value,
                            }))
                          }
                          className="w-full border border-sky-200 rounded p-2 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block mb-1 text-sky-700">
                          Date To (YYYY-MM)
                        </label>
                        <input
                          type="month"
                          value={draftFilters.date_to}
                          onChange={(e) =>
                            setDraftFilters((f) => ({
                              ...f,
                              date_to: e.target.value,
                            }))
                          }
                          className="w-full border border-sky-200 rounded p-2 bg-white"
                        />
                      </div>

                      

                      <SelectId
                        label="Currency Unit"
                        value={draftFilters.currency_filter}
                        options={CURRENCY_FILTERS}
                        onChange={(v) =>
                          setDraftFilters((f) => ({ ...f, currency_filter: v }))
                        }
                      />

                      <SelectId
                        label="Comparison"
                        value={draftFilters.comparity_filter}
                        options={comparity_filterS}
                        onChange={(v) =>
                          setDraftFilters((f) => ({
                            ...f,
                            comparity_filter: v,
                          }))
                        }
                      />

                      <BasisSelector
                        label="Compare with"
                        value={draftFilters.mom_vs_budget ? draftBasis : ""}
                        options={comparisonBasis.options}
                        onChange={(v) => {
                          if (v) setDraftBasis(v);
                          setDraftFilters((f) => ({
                            ...f,
                            mom_vs_budget: v ? "budget_data" : "",
                            budget_metric: v ? f.budget_metric : "revenue",
                          }));
                        }}
                      />

                      <SelectId
                        label="Entity"
                        value={draftFilters.entity}
                        options={entities}
                        onChange={(v) =>
                          setDraftFilters((f) => ({ ...f, entity: v }))
                        }
                      />
                      <SelectId
                        label="Cost Center"
                        value={draftFilters.cost_center}
                        options={costCenters}
                        onChange={(v) =>
                          setDraftFilters((f) => ({ ...f, cost_center: v }))
                        }
                      />
                      <SelectId
                        label="Profit Center"
                        value={draftFilters.profit_center}
                        options={profitCenters}
                        onChange={(v) =>
                          setDraftFilters((f) => ({ ...f, profit_center: v }))
                        }
                      />
                      <SelectId
                        label="Customer"
                        value={draftFilters.customer}
                        options={customers}
                        onChange={(v) =>
                          setDraftFilters((f) => ({ ...f, customer: v }))
                        }
                      />
                      {/* <SelectId
                        label="Region"
                        value={draftFilters.region}
                        options={regions}
                        onChange={(v) =>
                          setDraftFilters((f) => ({ ...f, region: v }))
                        }
                      /> */}
                    </div>

                    <div className="p-3 border-t border-sky-200 flex gap-2">
                      <button
                        onClick={resetAll}
                        className="w-1/2 py-2 text-x bg-slate-900 text-white rounded-lg hover:bg-slate-800"
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

            <ExportMenu
              label="CSV"
              commentaryCount={commentaryCount(exportCommentary)}
              onExport={(include) =>
                downloadCsv(csvWithCommentary(csvData, exportCommentary, include), `PnL_${year}_${selectedCurrency}.csv`)
              }
              className="relative group flex items-center px-3 py-2.5 text-x bg-sky-100 text-sky-800 rounded-lg border border-sky-200 hover:bg-sky-200"
            />

            <AddAutomation
              reportType="pl_summary"
              reportLabel="Profit & Loss Statement"
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

            <div className="relative" ref={sortRef}>
              <button
                type="button"
                onClick={() => setSortOpen((v) => !v)}
                aria-label="Sort"
                className={`relative group flex items-center gap-1 px-3 py-2.5 text-x font-medium rounded-lg border transition ${
                  sortConfig.sort_by !== "period" || sortConfig.sort_order !== "asc"
                    ? "bg-sky-900 text-white border-sky-900"
                    : "bg-sky-100 text-sky-800 border-sky-200 hover:bg-sky-200"
                }`}
              >
                <FiFilter size={13} />
                <ActionHoverLabel>Sort</ActionHoverLabel>
                {(sortConfig.sort_by !== "period" || sortConfig.sort_order !== "asc") && (
                  <span className="ml-1 px-1.5 py-[1px] rounded-full bg-white text-sky-900 text-[10px] font-bold">
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
                    className="absolute right-0 mt-2 w-64 z-50 bg-sky-50 border border-sky-200 rounded-xl shadow-xl p-4 space-y-3"
                  >
                    <div>
                      <label className="block text-xs font-medium text-sky-700 mb-1">Sort By</label>
                      <select
                        value={sortConfig.sort_by}
                        onChange={(e) => setSortConfig((s) => ({ ...s, sort_by: e.target.value }))}
                        className="w-full border border-sky-200 rounded-lg p-2 text-x bg-white text-sky-900"
                      >
                        {SORT_BY_OPTIONS.map((o) => (
                          <option key={o.id} value={o.id}>{o.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-sky-700 mb-1">Order</label>
                      <div className="flex gap-2">
                        {["asc", "desc"].map((order) => (
                          <button
                            key={order}
                            onClick={() => setSortConfig((s) => ({ ...s, sort_order: order }))}
                            className={`flex-1 py-2 text-x rounded-lg font-medium border transition ${
                              sortConfig.sort_order === order
                                ? "bg-sky-900 text-white border-sky-900"
                                : "bg-white text-sky-800 border-sky-200 hover:bg-sky-100"
                            }`}
                          >
                            {order === "asc" ? "↑ Ascending" : "↓ Descending"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSortConfig({ sort_by: "period", sort_order: "asc" });
                        setSortOpen(false);
                      }}
                      className="w-full py-2 text-x bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                    >
                      Reset Sort
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <span className="h-6 w-px bg-sky-200" aria-hidden="true" />

            <AIActionsMenu
              reportId="pnl"
              showTableHelp
              insights={{
                commentary,
                reportLabel: "Profit & Loss Statement",
                filterLabels: insightFilterLabels,
                viewKey,
                buildContext: buildInsightsContext,
                disabled: loading || !rows.length,
              }}
            />
          </div>
        </div>

        {loading && <TableSkeleton />}

        {/* NORMAL TABLE (NO COMPARISON + NO BUDGET) */}
        {!loading &&
          rows.length > 0 &&
          !hasComparisonSelected &&
          !hasBudgetSelected && (
            <div className="report-table-scroll overflow-auto mt-2 border border-sky-200 rounded-lg bg-white">
              <table className="w-full text-x">
                <thead className="bg-sky-900 text-white sticky top-0 z-20">
                  <tr>
                    <th className="w-px px-3 py-1.5 text-left whitespace-nowrap sticky left-0 z-30 bg-sky-900">
                      METRIC
                    </th>
                    {tableRows.map(({ period: p }) => (
                      <th
                        key={p}
                        className="px-2 py-1.5 text-right whitespace-nowrap"
                      >
                        {p}
                      </th>
                    ))}
                    <th className={`px-3 py-1.5 text-left whitespace-nowrap ${STICKY_INSIGHTS} z-30 bg-sky-900`}>
                      Insights
                    </th>
                    <th className={`px-3 py-1.5 text-left whitespace-nowrap ${STICKY_RECOMMENDATION} z-30 bg-sky-900`}>
                      Recommendation
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {COMPARE_METRICS.map((m) => {
                    return (
                    <tr key={m.key} className="border-b hover:bg-slate-50">
                      <td className="w-px px-3 py-3 font-semibold text-sky-900 whitespace-nowrap bg-sky-50 sticky left-0 z-10">
                        {renderLineLabel(m)}
                      </td>

                      {tableRows.map((r) => {
                        const raw = getRowValue(r, m.key);
                        const isVar =
                          m.key === "variance" ||
                          m.key === "variance_percentage";
                        const ui = isVar ? getVarianceUI(raw) : null;

                        return (
                          <td
                            key={`${r.period}-${m.key}`}
                            className="relative px-2 py-3 whitespace-nowrap text-right"
                          >
                            {analyzeCellButton(m, r, "monthly", m.isPct ? formatPct(raw) : formatMoney(raw))}
                            {isVar ? (
                              <span
                                className={`inline-flex items-center justify-end gap-1 px-2 py-1 rounded-md ${ui.bg} ${ui.color}`}
                              >
                                {ui.icon}
                                {m.isPct ? formatPct(raw) : formatMoney(raw)}
                              </span>
                            ) : (
                              <button
                                onClick={() => openDrill(m.key, r.period)}
                                className=" text-sky-900 border-white border-b  hover:border-b hover:text-blue-500"
                                title="Open drilldown"
                              >
                                {m.isPct ? formatPct(raw) : formatMoney(raw)}
                              </button>
                            )}
                          </td>
                        );
                      })}
                      {renderCommentaryCells(m)}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        {/* COMPARISON TABLE */}
        {!loading && rows.length > 0 && hasComparisonSelected && (
          <div className="report-table-scroll overflow-auto mt-2 border border-sky-200 rounded-lg bg-white">
            <table className="w-full text-x">
              <thead className="z-20">
                <tr className="bg-sky-900 text-white">
                  <th
                    rowSpan={2}
                    className="w-px px-3 py-1.5 text-left whitespace-nowrap sticky left-0 z-30 bg-sky-900"
                  >
                    METRIC
                  </th>

                  {tableRows.map((r) => (
                    <th
                      key={r.period}
                      colSpan={3}
                      className="px-2 py-1.5 text-right border-l border-white/20 whitespace-nowrap"
                    >
                      {r.period} VS{" "}
                      {getComparePrevPeriod(r?.comparision) || "—"}
                    </th>
                  ))}
                  <th rowSpan={2} className={`px-3 py-1.5 text-left whitespace-nowrap ${STICKY_INSIGHTS} z-30 bg-sky-900`}>
                    Insights
                  </th>
                  <th rowSpan={2} className={`px-3 py-1.5 text-left whitespace-nowrap ${STICKY_RECOMMENDATION} z-30 bg-sky-900`}>
                    Recommendation
                  </th>
                </tr>

                <tr className="bg-sky-800 text-white">
                  {tableRows.map((r, idx) => {
                    const curLbl  = r.period || "Current";
                    const prevLbl = getComparePrevPeriod(r?.comparision) || "Previous";
                    const varLbl  = `${curLbl} vs ${prevLbl}`;
                    return (
                      <React.Fragment key={`${r.period}-${idx}-sub`}>
                        <th className="px-2 py-1 text-right border-l border-white/20 whitespace-nowrap">
                          <HeaderDates top={curLbl}  bottom="Current"  />
                        </th>
                        <th className="px-2 py-1 text-right whitespace-nowrap">
                          <HeaderDates top={prevLbl} bottom="Previous" />
                        </th>
                        <th className="px-2 py-1 text-right whitespace-nowrap">
                          <HeaderDates top={varLbl}  bottom="Variance" />
                        </th>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {comparisonMetrics.map((m) => (
                  <tr key={m.key} className="border-b">
                    <td className="w-px px-3 py-3 font-semibold text-sky-900 whitespace-nowrap bg-sky-50 sticky left-0 z-10">
                      {renderLineLabel(m)}
                    </td>

                    {tableRows.map((r, i) => {
                      const c = r?.comparision || {};
                      const cur = getRowValue(r, m.key);
                      const prev = getComparePrev(c, m.key);
                      const diff = getCompareDiff(c, m.key);
                      const ui = getVarianceUI(diff, { lowerIsBetter: COST_LINE_KEYS.has(m.key) });

                      return (
                        <React.Fragment key={`${r.period}-${m.key}-${i}`}>
                          <td className="px-2 py-3 whitespace-nowrap border-l border-sky-100 text-right text-sky-900">
                            {drillValue(m.key, r.period, m.isPct ? formatPct(cur) : formatMoney(cur))}
                          </td>

                          <td className="px-2 py-3 whitespace-nowrap text-right text-sky-900">
                            {m.isPct ? formatPct(prev) : formatMoney(prev)}
                          </td>

                          <td
                            className={`relative px-2 py-3 whitespace-nowrap text-right ${ui.bg}`}
                          >
                            {analyzeCellButton(m, r, "comparison", m.isPct ? formatPct(diff) : formatMoney(diff))}
                            <span
                              className={`inline-flex items-center justify-end gap-1 py-1 rounded-md font-semibold ${ui.color}`}
                            >
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full  text-[11p] font-semibold ${ui.pill}`}
                              >
                                <span className="text-[10px]">{ui.arrow}</span>
                                {m.isPct ? formatPct(diff) : formatMoney(diff)}
                              </span>
                            </span>
                          </td>
                        </React.Fragment>
                      );
                    })}
                    {renderCommentaryCells(m)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ================== BUDGET TABLE (when mom_vs_budget=budget_data and NO comparison) ================== */}
        {/* ================== BUDGET TABLE (mom_vs_budget=budget_data, NO comparison) ================== */}
        {!loading && rows.length > 0 && usesPlanBasis && basisMeta && (
          basisMeta.available === false || !isPlanAvailableForFilters(appliedFilters) ? (
            <PlanUnavailableNote label={basis.label} reason={basisMeta.unavailable_reason} />
          ) : basisMeta.warnings?.length ? (
            <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-x text-sky-800">
              {basisMeta.warnings.join(" ")}
            </div>
          ) : null
        )}
        {!loading &&
          rows.length > 0 &&
          hasBudgetSelected &&
          !hasComparisonSelected && (
            <div className="report-table-scroll overflow-auto mt-2 border border-sky-200 rounded-lg bg-white">
              <table className="w-full text-x">
                <thead className="z-20">
                  <tr className="bg-sky-900 text-white">
                    <th
                      rowSpan={2}
                      className="w-px px-3 py-1.5 text-left whitespace-nowrap sticky left-0 z-30 bg-sky-900"
                    >
                      METRIC
                    </th>

                    {tableRows.map((r) => {
                      const chip = usesPlanBasis && basisMeta && r.period !== "total"
                        ? periodSourceBadge(basisMeta.periods?.[r.period], r.period)
                        : null;
                      return (
                        <th
                          key={r.period}
                          colSpan={3}
                          className="px-2 py-1.5 text-right border-l border-white/20 whitespace-nowrap"
                        >
                          {r.period}
                          {chip && (
                            <span
                              title={chip.title}
                              className={`ml-1.5 align-middle text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                chip.tone === "final" ? "bg-emerald-500 text-white"
                                  : chip.tone === "warn" ? "bg-amber-400 text-sky-950"
                                    : chip.tone === "live" ? "bg-sky-500 text-white"
                                      : "bg-white/20 text-white"
                              }`}
                            >
                              {chip.text}
                            </span>
                          )}
                        </th>
                      );
                    })}
                    <th rowSpan={2} className={`px-3 py-1.5 text-left whitespace-nowrap ${STICKY_INSIGHTS} z-30 bg-sky-900`}>
                      Insights
                    </th>
                    <th rowSpan={2} className={`px-3 py-1.5 text-left whitespace-nowrap ${STICKY_RECOMMENDATION} z-30 bg-sky-900`}>
                      Recommendation
                    </th>
                  </tr>

                  <tr className="bg-sky-800 text-white">
                    {tableRows.map((r, idx) => (
                      <React.Fragment key={`${r.period}-${idx}-bud-sub`}>
                        <th className="px-2 py-1 text-right border-l border-white/20 whitespace-nowrap">
                          <HeaderDates top="Current" bottom="Actual" />
                        </th>
                        <th className="px-2 py-1 text-right whitespace-nowrap">
                          <HeaderDates top={basis.columnTop} bottom={basis.columnBottom} />
                        </th>
                        <th className="px-2 py-1 text-right whitespace-nowrap">
                          <HeaderDates top="Variance" bottom="Diff" />
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {BUDGET_ROWS.map((m) => (
                    <tr key={m.key} className="border-b">
                      <td className="w-px px-3 py-3 font-semibold text-sky-900 whitespace-nowrap bg-sky-50 sticky left-0 z-10">
                        {renderLineLabel(m)}
                      </td>

                      {tableRows.map((r, i) => {
                        const cur = budgetActual(m, r);
                        const bud = m.budget(r);
                        const vari = m.variance(r);
                        const variPct = budgetVariancePct(m, r);
                        const ui = getVarianceUI(vari, { lowerIsBetter: m.lowerIsBetter });

                        return (
                          <React.Fragment key={`${r.period}-${m.key}-${i}`}>
                            <td className="px-2 py-3 whitespace-nowrap border-l border-sky-100 text-right text-sky-900">
                              {drillValue(m.key, r.period, formatBudgetValue(m, cur))}
                            </td>

                            <td className="px-2 py-3 whitespace-nowrap text-right text-sky-900">
                              {formatBudgetValue(m, bud)}
                            </td>

                            <td
                              className={`relative px-2 py-3 whitespace-nowrap text-right ${ui.bg}`}
                              title={usesPlanBasis ? PLAN_DRILL_NOTE : undefined}
                            >
                              {!usesPlanBasis && analyzeCellButton(m, r, "budget", formatBudgetVariance(m, vari))}
                              <span
                                className={`inline-flex items-center justify-end gap-1 py-1 rounded-md font-semibold ${ui.color}`}
                              >
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full  text-[11p] font-semibold ${ui.pill}`}
                                >
                                  <span className="text-[10px]">
                                    {ui.arrow}
                                  </span>
                                  {formatBudgetVariance(m, vari)}
                                  {variPct !== null && (
                                    <span className="font-normal opacity-90">
                                      ({variPct >= 0 ? "+" : ""}{variPct.toFixed(1)}%)
                                    </span>
                                  )}
                                </span>
                              </span>
                            </td>
                          </React.Fragment>
                        );
                      })}
                      {renderCommentaryCells(m)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        {/* NO DATA */}
        {!loading && rows.length === 0 && (
          <div className="h-[420px] flex items-center justify-center border rounded-xl">
            <p className="text-s text-sky-700">
              No data available for selected filters
            </p>
          </div>
        )}

        {/* KEY METRICS */}
        {metrics && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-6 bg-white border border-sky-200 rounded-xl p-4 shadow-sm"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 space-y-3">
                <h3 className="text-s font-semibold text-sky-900">
                  Key P&amp;L Metrics
                </h3>

                <MetricRow
                  label="Total Actual Profit"
                  value={metrics.total_actual_profit}
                  onAnalyze={() => analyzeKpi("total_actual_profit", "Total Actual Profit", formatMoney(metrics.total_actual_profit))}
                />
                <MetricRow
                  label={`Total ${basis.shortLabel} Profit`}
                  value={metrics.total_budget_profit}
                  onAnalyze={usesPlanBasis ? undefined : () => analyzeKpi("total_budget_profit", "Total Budget Profit", formatMoney(metrics.total_budget_profit))}
                />
                <MetricRow
                  label={usesPlanBasis ? `Variance vs ${basis.shortLabel}` : "Overall Variance"}
                  value={metrics.overall_variance}
                  onAnalyze={usesPlanBasis ? undefined : () => analyzeKpi("overall_variance", "Overall Variance", formatMoney(metrics.overall_variance))}
                />
                <MetricRow
                  label={usesPlanBasis ? `Variance vs ${basis.shortLabel} %` : "Overall Variance %"}
                  value={metrics.overall_variance_percentage}
                  isPercent
                  onAnalyze={usesPlanBasis ? undefined : () =>
                    analyzeKpi("overall_variance_percentage", "Overall Variance %", formatPct(metrics.overall_variance_percentage))
                  }
                />
                <MetricRow
                  label="Best Month"
                  value={metrics.best_month}
                  isText
                  onAnalyze={analyzeMonthKpi("Best Month", metrics.best_month)}
                />
                <MetricRow
                  label="Worst Month"
                  value={metrics.worst_month}
                  isText
                  onAnalyze={analyzeMonthKpi("Worst Month", metrics.worst_month)}
                />
              </div>

              <div className="bg-sky-50 md:col-span-2 border border-sky-200 rounded-lg p-3 flex flex-col justify-center gap-2">
                <h4 className="text-x font-semibold text-sky-900 mb-1">
                  Executive Financial Insight
                </h4>
                {(activeNarrative.executive || []).map((para, i) => (
                  <p key={i} className="text-s text-sky-800 leading-relaxed">
                    {para}
                  </p>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {!loading && rows.length > 0 && (
          <LineItemCommentary
            lineCommentary={lineCommentary}
            lines={lineItems}
            onRefine={(m) => setRefineLine({ key: m.key, label: m.label })}
          />
        )}

        {!loading && <ReportCommentary commentary={commentary} />}

        <LineItemRefineWithAI
          line={refineLine}
          onClose={() => setRefineLine(null)}
          lineCommentary={lineCommentary}
          reportLabel="Profit & Loss Statement"
          filterLabels={insightFilterLabels}
          buildContext={buildLineItemContext}
        />

        <AnalyzeWithAI
          target={analyzeTarget}
          onClose={() => setAnalyzeTarget(null)}
          token={token}
          reportId="pnl"
          reportLabel="Profit & Loss Statement"
          year={year}
          currency={selectedCurrency}
          filterLabels={insightFilterLabels}
          loadContext={loadAnalysisContext}
          onAddToReport={({ title, text }) =>
            commentary.addItems([{ title, text, category: "variance", source: "ai" }])
          }
        />

        {/* Hover help for the ✦ and commentary buttons in the tables & KPIs */}
        <AIHelpTooltip />

        {/* ✅ IMPORTANT: Drawer must be INSIDE component return */}
        {/* ================= DRILL DRAWERS ================= */}

        {/* ================= DRILL DRAWERS ================= */}

        {drillMetric === "cost_of_goods_sold" ? (
          <PnLCostofGoodsdrilldown
            open={drillOpen}
            onClose={() => setDrillOpen(false)}
            token={token}
            currency={selectedCurrency}
            currencySymbol="$"
            period={drillPeriod}
            query={drillQuery}
          />
        ) : drillMetric === "operating_expense" ? (
          <PnLOperatingExpenseDrilldown
            open={drillOpen}
            onClose={() => setDrillOpen(false)}
            token={token}
            currency={selectedCurrency}
            currencySymbol="$"
            period={drillPeriod}
            query={drillQuery}
          />
        ) : (
          <PnLDrilldownDrawer
            open={drillOpen}
            onClose={() => setDrillOpen(false)}
            token={token}
            currency={selectedCurrency}
            currencySymbol="$"
            metric={drillMetric}
            period={drillPeriod}
            query={drillQuery}
            appliedFilters={appliedFilters}
            idToName={idToName}
          />
        )}
      </main>
    </ReportsLayout>
  );
}

/* ================== SMALL COMPONENTS ================== */
const SelectId = ({ label, value, options, onChange }) => (
  <div>
    <label className="block mb-1 text-sky-700">{label}</label>
    <select
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "") return onChange(null);
        const num = Number(v);
        onChange(Number.isNaN(num) ? v : num);
      }}
      className="w-full border border-sky-200 rounded p-2 bg-white"
    >
      {options.map((o) => (
        <option key={o.id ?? "all"} value={o.id ?? ""}>
          {o.label}
        </option>
      ))}
    </select>
  </div>
);

const HeaderDates = ({ top, bottom }) => (
  <div className="flex flex-col leading-tight items-end">
    <span className=" text-[11p] text-white/80">{top}</span>
    <span className="text-[12px] font-semibold">{bottom}</span>
  </div>
);

const AIDriverText = ({ messages }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % messages.length),
      3000,
    );
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

const MetricRow = ({ label, value, isPercent = false, isText = false, onAnalyze }) => {
  const display = isText
    ? (value ?? "--")
    : isPercent
      ? formatPct(value)
      : formatMoney(value);

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
              body: "AI explains what's behind this figure, with supporting data, and answers follow-up questions.",
            }}
            className="ml-1 opacity-70 hover:opacity-100 focus:opacity-100"
          />
        )}
      </span>
      <span className={`font-medium ${color}`}>{display}</span>
    </div>
  );
};
