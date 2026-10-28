import React, { useMemo } from "react";
import { motion } from "framer-motion";

// Bottom-of-dashboard summary in the style of the P&L report's "Key P&L
// Metrics / Executive Financial Insight" card. The left side shows the
// headline numbers; the insight on the right explains what they mean and what
// the business should do about it — it never restates those numbers, only the
// direction, the drivers and the derived percentages behind them. Rule-based
// (no AI call), so it is instant and always matches the figures on screen.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const periodLabel = (p) => {
  const m = /^(\d{4})-(\d{2})$/.exec(String(p || ""));
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : String(p ?? "");
};

const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const mean = (arr) => (arr.length ? sum(arr) / arr.length : 0);
// Month-to-month variability as a % of the average (coefficient of variation).
const variability = (arr) => {
  const m = mean(arr);
  if (!arr.length || !m) return 0;
  const sd = Math.sqrt(mean(arr.map((v) => (v - m) ** 2)));
  return (sd / Math.abs(m)) * 100;
};
const pct = (part, whole) => (whole ? (part / whole) * 100 : null);
const fmtPct = (v, dp = 1) => (v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(dp)}%`);
const growth = (arr) => (arr.length > 1 && arr[0] ? ((arr[arr.length - 1] - arr[0]) / Math.abs(arr[0])) * 100 : null);
const whole = (v) => Math.abs(v).toFixed(0);

// { labels, values } for one dashboard chart, or null when it has no data.
const seriesOf = (charts, key) => {
  const data = charts?.[key]?.data;
  const values = data?.datasets?.[0]?.data || [];
  if (!values.length) return null;
  return { labels: data.labels || [], values: values.map((v) => Number(v) || 0) };
};

// The actual-values line of one actual-vs-budget chart, as a series.
const budgetActuals = (budget, key) => {
  const data = budget?.[key]?.data;
  const values = data?.datasets?.[0]?.data || [];
  return values.length ? { labels: data.labels || [], values: values.map((v) => Number(v) || 0) } : null;
};

// Period-by-period combination of two series covering the same periods.
const combine = (a, b, fn) =>
  a && b && a.values.length === b.values.length
    ? { labels: a.labels, values: a.values.map((v, i) => fn(v, b.values[i])) }
    : null;

// Actual vs plan for one budget chart, as a % (negative = below plan), or null.
const budgetGapPct = (budget, key) => {
  const ds = budget?.[key]?.data?.datasets || [];
  if (ds.length < 2) return null;
  const actual = sum(ds[0].data.map((x) => Number(x) || 0));
  const plan = sum(ds[1].data.map((x) => Number(x) || 0));
  return plan ? pct(actual - plan, Math.abs(plan)) : null;
};

/**
 * Executive read-out for the dashboard. `km` = headline totals (numbers),
 * `charts` = the dashboard's chart data, `budget` = actual-vs-budget chart
 * data (may be empty). Returns { insights, actions, bestMonth, worstMonth }:
 * insights = what is happening and why; actions = [{ lead, detail }] steps
 * for the business, most important first.
 */
export function buildExecutiveInsight({ km, charts, budget }) {
  const revenue = seriesOf(charts, "revenue_trend");
  const cashflow = seriesOf(charts, "cashflow_trend");
  // Expense and net-profit trends only come back when those widgets are on the
  // dashboard; otherwise rebuild them from the monthly actuals in the budget
  // data (expense = COGS + opex, net profit = revenue − expense — the same
  // basis as the headline totals).
  const expense =
    seriesOf(charts, "expense_trend") ||
    combine(budgetActuals(budget, "AVB_COGS"), budgetActuals(budget, "AVB_OPEX"), (c, o) => c + o);
  const netProfit = seriesOf(charts, "net_profit_trend") || combine(revenue, expense, (r, e) => r - e);

  if (!km.revenue && !km.expense && !km.netProfit) {
    return { insights: ["There is no financial activity in this view yet."], actions: [], bestMonth: null, worstMonth: null };
  }

  const hasTrend = !!revenue && revenue.values.length >= 3;
  const revGrowth = hasTrend ? growth(revenue.values) : null;
  const revVolatility = hasTrend ? variability(revenue.values) : 0;
  const expGrowth = hasTrend && expense && expense.values.length === revenue.values.length ? growth(expense.values) : null;
  const costRatio = pct(km.expense, km.revenue);
  const loss = km.netProfit < 0;
  const cashConversion = km.netProfit > 0 ? pct(km.cashFlow, km.netProfit) : null;
  const cashNegativeDespiteProfit = km.netProfit > 0 && km.cashFlow < 0;
  const negativeCashPeriods = cashflow ? cashflow.values.filter((x) => x < 0).length : 0;
  const revGap = budgetGapPct(budget, "AVB_Revenue");
  const opexGap = budgetGapPct(budget, "AVB_OPEX");
  const revShort = revGap != null && revGap <= -2;
  const costsOutpacing = expGrowth != null && revGrowth != null && expGrowth > revGrowth + 2;

  // Best / worst month, and whether the worst came from weaker sales or a spending spike.
  let bestMonth = null;
  let worstMonth = null;
  let weakDriver = null;
  if (netProfit && netProfit.values.length >= 2) {
    const v = netProfit.values;
    const wi = v.indexOf(Math.min(...v));
    bestMonth = periodLabel(netProfit.labels[v.indexOf(Math.max(...v))]);
    worstMonth = periodLabel(netProfit.labels[wi]);
    if (revenue && expense && revenue.values.length === v.length && expense.values.length === v.length) {
      const salesDip = mean(revenue.values) - revenue.values[wi];
      const spendSpike = expense.values[wi] - mean(expense.values);
      weakDriver = salesDip > 0 && salesDip >= spendSpike ? "demand" : spendSpike > 0 ? "spend" : null;
    }
  }

  // ── What is happening, and why ──
  const insights = [];
  if (loss) {
    insights.push("The business is running at a loss — costs are higher than current revenue can carry.");
  } else if (costRatio != null && costRatio >= 80) {
    insights.push(
      `Margins are thin: costs absorb about ${whole(costRatio)}% of every revenue dollar, so even a small dip in sales hits profit hard.`
    );
  } else {
    insights.push("Profitability is healthy, with costs comfortably covered by revenue.");
  }

  const direction = revGrowth == null ? null : revGrowth <= -2 ? "slipping" : revGrowth >= 2 ? "growing" : "flat";
  if (revShort) {
    insights.push(
      direction === "growing"
        ? `Revenue is growing, but not fast enough to meet plan — it is about ${whole(revGap)}% short of budget.`
        : direction === "slipping"
        ? `Revenue has slipped about ${whole(revGrowth)}% since the start of the period and is about ${whole(revGap)}% short of budget — the plan assumed growth that isn't materialising.`
        : `Revenue is holding flat while the budget assumed growth, leaving it about ${whole(revGap)}% short of plan.`
    );
  } else if (revGap != null && revGap >= 2) {
    insights.push(
      `Revenue is ahead of budget by about ${whole(revGap)}%${direction === "slipping" ? ", though momentum has faded since the start of the period" : ""}.`
    );
  } else if (direction === "slipping") {
    insights.push(`Revenue has slipped about ${whole(revGrowth)}% since the start of the period.`);
  } else if (direction === "growing") {
    insights.push(
      `Revenue has grown about ${whole(revGrowth)}% since the start of the period${revVolatility < 6 ? " on steady demand" : ", with sizeable month-to-month swings"}.`
    );
  } else if (direction === "flat") {
    insights.push(`Revenue is steady${revVolatility < 6 ? " and predictable month to month" : " overall but swings noticeably month to month"}.`);
  }

  if (costsOutpacing) {
    insights.push(revGrowth < 0 ? "Costs have not come down with revenue, which is eroding margin." : "Costs are rising faster than revenue, which is squeezing margin.");
  } else if (revShort && opexGap != null && opexGap <= -2) {
    insights.push("Operating spend is under budget, which is cushioning profit — but it masks the revenue shortfall rather than fixing it.");
  }

  if (cashNegativeDespiteProfit) {
    insights.push("Profit is not turning into cash: cash flow is negative even though the business is profitable.");
  } else if (cashConversion != null && cashConversion >= 150) {
    insights.push("Cash generation is running well ahead of profit, so the business is building a cash cushion.");
  } else if (cashConversion != null && cashConversion < 70) {
    insights.push("Only part of the profit is converting into cash; the rest is tied up in working capital or investment.");
  } else if (negativeCashPeriods > 0) {
    insights.push(`Cash timing is uneven — ${negativeCashPeriods} period${negativeCashPeriods === 1 ? " was" : "s were"} cash-negative.`);
  }

  if (worstMonth && weakDriver) {
    insights.push(
      weakDriver === "demand"
        ? `The weakest month, ${worstMonth}, came from a dip in sales rather than overspending.`
        : `The weakest month, ${worstMonth}, came from a spending spike rather than weaker sales.`
    );
  }

  // ── What the business should do, most important first ──
  const actions = [];
  const add = (when, lead, detail) => {
    if (when && actions.length < 3) actions.push({ lead, detail });
  };
  const worstMonthName = worstMonth ? worstMonth.split(" ")[0] : "";
  add(loss, "Return to profit", "reprice or exit the lowest-margin products and customers, and pause discretionary spend until monthly results turn positive.");
  add(revShort, "Recover the revenue shortfall", "focus account teams on renewals, upsell and pipeline conversion with the largest customers for the rest of the year.");
  add(revShort && opexGap != null && opexGap <= -2, "Reinvest the budget underspend", "redirect part of the unspent operating budget into targeted sales and marketing campaigns.");
  add(costsOutpacing, "Hold cost growth below revenue growth", "freeze new discretionary commitments and renegotiate the largest supplier contracts.");
  add(revGap == null && direction === "slipping", "Reverse the revenue slide", "launch retention offers and price reviews for the top accounts.");
  add(!loss && costRatio != null && costRatio >= 80, "Widen margins", "raise prices selectively where demand is steady and take a few points out of the largest cost categories.");
  add(cashNegativeDespiteProfit, "Release cash from operations", "speed up collections and bring inventory down so profit turns into cash.");
  add(cashConversion != null && cashConversion < 70, "Improve cash conversion", "tighten payment terms and collections.");
  add(cashConversion != null && cashConversion >= 150, "Put surplus cash to work", "pay down debt or fund growth projects instead of holding idle balances.");
  add(revVolatility >= 6, "Smooth revenue", "grow recurring and contracted revenue to reduce month-to-month swings.");
  add(weakDriver === "demand", "Get ahead of the seasonal dip", `plan promotions and pipeline pushes before ${worstMonthName}.`);
  add(weakDriver === "spend", "Control one-off spend", `add approval limits on large purchases to prevent spikes like ${worstMonth}.`);
  if (!actions.length) {
    add(true, "Build on the strongest month", `repeat the sales and pricing conditions behind ${bestMonth || "the best-performing months"}.`);
  }

  return { insights: insights.slice(0, 4), actions, bestMonth, worstMonth };
}

const MetricRow = ({ label, display, value, isText = false }) => {
  const n = isText ? null : Number(value);
  const color = isText
    ? "text-sky-900"
    : Number.isFinite(n) && n > 0
    ? "text-green-600"
    : Number.isFinite(n) && n < 0
    ? "text-red-600"
    : "text-sky-900";
  return (
    <div className="flex justify-between text-s">
      <span className="text-sky-700">{label}</span>
      <span className={`font-medium ${color}`}>{display}</span>
    </div>
  );
};

/** Key metrics + executive insight card for the bottom of the dashboard. */
export default function ExecutiveInsight({ keymetrics, charts, budget, parseMetric, renderValue, currency, currencyFilter }) {
  const km = useMemo(
    () => ({
      revenue: parseMetric(keymetrics?.Revenue),
      grossProfit: parseMetric(keymetrics?.Grossprofit),
      netProfit: parseMetric(keymetrics?.NetProfit),
      expense: parseMetric(keymetrics?.Expense),
      cashFlow: parseMetric(keymetrics?.cashflow),
      headcount: Number(keymetrics?.headcount ?? 0) || 0,
    }),
    [keymetrics, parseMetric]
  );
  const money = (v) => renderValue(v, currency, currencyFilter);
  const insight = useMemo(() => buildExecutiveInsight({ km, charts, budget }), [km, charts, budget]);
  const netMargin = pct(km.netProfit, km.revenue);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white border border-sky-200 rounded-xl p-4 shadow-sm"
      data-pdf-keep
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 space-y-3">
          <h3 className="text-s font-semibold text-sky-900">Key Financial Metrics</h3>
          <MetricRow label="Revenue" value={km.revenue} display={money(km.revenue)} />
          <MetricRow label="Gross Profit" value={km.grossProfit} display={money(km.grossProfit)} />
          <MetricRow label="Total Expenses" value={null} display={money(km.expense)} />
          <MetricRow label="Net Profit" value={km.netProfit} display={money(km.netProfit)} />
          <MetricRow label="Net Margin %" value={netMargin} display={fmtPct(netMargin)} />
          <MetricRow label="Cash Flow" value={km.cashFlow} display={money(km.cashFlow)} />
          <MetricRow label="Best Month" isText display={insight.bestMonth || "--"} />
          <MetricRow label="Worst Month" isText display={insight.worstMonth || "--"} />
        </div>

        <div className="bg-sky-50 md:col-span-2 border border-sky-200 rounded-lg p-3 flex flex-col justify-center gap-2">
          <h4 className="text-x font-semibold text-sky-900">Executive Financial Insight</h4>
          <p className="text-s text-sky-800 leading-relaxed">{insight.insights.join(" ")}</p>
          {insight.actions.length > 0 && (
            <>
              <h5 className="text-x font-semibold text-sky-900 mt-1">Recommended actions</h5>
              <ol className="list-decimal pl-5 space-y-1 text-s text-sky-800 leading-relaxed">
                {insight.actions.map((a) => (
                  <li key={a.lead}>
                    <span className="font-semibold text-sky-900">{a.lead}:</span> {a.detail}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
