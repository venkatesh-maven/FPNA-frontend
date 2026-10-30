import React, { useMemo } from "react";
import { motion } from "framer-motion";

// Bottom-of-dashboard summary in the style of the P&L report's "Key P&L
// Metrics / Executive Financial Insight" card. The left side shows the
// headline numbers; the insight on the right explains what they mean and what
// the business should do about it — it never restates those numbers, only the
// direction, the drivers and the derived percentages behind them. Rule-based
// (no AI call), so it is instant and always matches the figures on screen.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Handles "2025-01" (monthly), "2025-01-01T00:00:00" (YTD) and "Q1" (quarterly).
const periodLabel = (p) => {
  const m = /^(\d{4})-(\d{2})/.exec(String(p || ""));
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : String(p ?? "");
};
const isQuarterLabel = (p) => /^Q[1-4]$/i.test(String(p || "").trim());

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
// Momentum: average of the later half of the periods vs the earlier half, as a %.
// More robust than first-vs-last point, which a single unusual month can swing.
const growth = (arr) => {
  if (arr.length < 2) return null;
  const h = Math.floor(arr.length / 2);
  const early = mean(arr.slice(0, h));
  const late = mean(arr.slice(arr.length - h));
  return early ? ((late - early) / Math.abs(early)) * 100 : null;
};
// Change vs the same months of the prior year, as a %, or null without a usable base.
const yoy = (cur, prev) => (prev == null || !prev || !Number.isFinite(cur) ? null : ((cur - prev) / Math.abs(prev)) * 100);
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
// Full-year sum of one actual-vs-forecast chart: [actual, forecast (rolling — closed months = actuals)].
const forecastTotals = (forecast, key) => {
  const ds = forecast?.[key]?.data?.datasets || [];
  if (ds.length < 2) return null;
  const actual = sum(ds[0].data.map((x) => Number(x) || 0));
  const outlook = sum(ds[1].data.map((x) => Number(x) || 0));
  return outlook ? { actual, outlook } : null;
};

export function buildExecutiveInsight({
  km,
  charts,
  budget,
  prevKm = null,
  prevLabel = "",
  monthsWithData = 0,
  comparison = "None",
  forecast = null,
  forecastCompanyWideOnly = false,
  money = (v) => String(Math.round(v)),
}) {
  const rawRevenue = seriesOf(charts, "revenue_trend");
  const rawCashflow = seriesOf(charts, "cashflow_trend");
  // Expense and net-profit trends only come back when those widgets are on the
  // dashboard; otherwise rebuild them from the monthly actuals in the budget
  // data (expense = COGS + opex, net profit = revenue − expense — the same
  // basis as the headline totals).
  const rawExpense =
    seriesOf(charts, "expense_trend") ||
    combine(budgetActuals(budget, "AVB_COGS"), budgetActuals(budget, "AVB_OPEX"), (c, o) => c + o);
  const rawNetProfit = seriesOf(charts, "net_profit_trend") || combine(rawRevenue, rawExpense, (r, e) => r - e);

  // "quarter" when the dashboard is on the Quarterly time filter, else "month".
  const unit = (rawRevenue || rawNetProfit)?.labels?.some(isQuarterLabel) ? "quarter" : "month";

  // A partial last quarter (e.g. only October of Q4) would read as a collapse
  // in trend and best/worst — leave it out of the period-by-period analysis.
  // Headline totals (km) still include it.
  const partialQuarter = unit === "quarter" && monthsWithData > 0 && monthsWithData % 3 !== 0;
  const trim = (s) => (partialQuarter && s && s.values.length > 1 ? { labels: s.labels.slice(0, -1), values: s.values.slice(0, -1) } : s);
  const revenue = trim(rawRevenue);
  const cashflow = trim(rawCashflow);
  const expense = trim(rawExpense);
  const netProfit = trim(rawNetProfit);

  if (!km.revenue && !km.expense && !km.netProfit) {
    return { insights: ["There is no financial activity in this view yet."], actions: [], bestMonth: null, worstMonth: null, unit };
  }

  // Year over year, against the same months of the prior fiscal year.
  const revYoY = prevKm ? yoy(km.revenue, prevKm.revenue) : null;
  const expYoY = prevKm ? yoy(km.expense, prevKm.expense) : null;
  const npYoY = prevKm ? yoy(km.netProfit, prevKm.netProfit) : null;

  const hasTrend = !!revenue && revenue.values.length >= 3;
  const revGrowth = hasTrend ? growth(revenue.values) : null;
  const revVolatility = hasTrend ? variability(revenue.values) : 0;
  const expGrowth = hasTrend && expense && expense.values.length === revenue.values.length ? growth(expense.values) : null;
  const costRatio = pct(km.expense, km.revenue);
  const loss = km.netProfit < 0;
  const cashConversion = km.netProfit > 0 ? pct(km.cashFlow, km.netProfit) : null;
  const cashNegativeDespiteProfit = km.netProfit > 0 && km.cashFlow < 0;
  const negativeCashPeriods = cashflow ? cashflow.values.filter((x) => x < 0).length : 0;
  // In forecast mode the read-out is about the forecast, not the budget.
  const useBudget = comparison !== "ActualVsForecast";
  const revGap = useBudget ? budgetGapPct(budget, "AVB_Revenue") : null;
  const opexGap = useBudget ? budgetGapPct(budget, "AVB_OPEX") : null;
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

  // Comparison-filter specific read-out, placed right after the margin headline.
  let npBudgetGap = null;
  let forecastStepUp = null;
  let remainingMonths = 0;
  let requiredAvg = null;
  if (comparison === "ActualVsBudget") {
    const ds = (k, i) => (budget?.[k]?.data?.datasets?.[i]?.data || []).map((x) => Number(x) || 0);
    const bRev = sum(ds("AVB_Revenue", 1));
    const bCost = sum(ds("AVB_COGS", 1)) + sum(ds("AVB_OPEX", 1));
    const bNp = bRev - bCost;
    const costGap = bCost ? pct(km.expense - bCost, Math.abs(bCost)) : null;
    npBudgetGap = bNp ? pct(km.netProfit - bNp, Math.abs(bNp)) : null;
    if (npBudgetGap != null) {
      const npWord = Math.abs(npBudgetGap) < 1 ? "on budget" : `${fmtPct(Math.abs(npBudgetGap))} ${npBudgetGap > 0 ? "above" : "below"} budget`;
      const costWord =
        costGap == null ? "" : Math.abs(costGap) < 1 ? ", with costs on budget" : `, with costs ${fmtPct(Math.abs(costGap))} ${costGap > 0 ? "over" : "under"} budget`;
      insights.push(`Against budget for the same period, net profit is ${npWord}${costWord}.`);
    }
  } else if (comparison === "ActualVsForecast" && forecastCompanyWideOnly) {
    insights.push("The forecast is only available for the whole company, so this entity isn't compared against it — clear the Entity filter to see progress against forecast.");
  } else if (comparison === "ActualVsForecast") {
    const rev = forecastTotals(forecast, "AVF_Revenue");
    const np = forecastTotals(forecast, "AVF_NetProfit");
    remainingMonths = monthsWithData ? 12 - monthsWithData : 0;
    if (rev) {
      insights.push(
        `On the current forecast, the full year lands at about ${money(rev.outlook)} of revenue${np ? ` and ${money(np.outlook)} of net profit` : ""}.`
      );
      if (remainingMonths > 0 && monthsWithData > 0) {
        const runRate = rev.actual / monthsWithData;
        requiredAvg = (rev.outlook - rev.actual) / remainingMonths;
        forecastStepUp = runRate ? pct(requiredAvg - runRate, Math.abs(runRate)) : null;
        if (forecastStepUp != null && Math.abs(forecastStepUp) >= 3) {
          insights.push(
            forecastStepUp > 0
              ? `Getting there needs the remaining ${remainingMonths} month${remainingMonths === 1 ? "" : "s"} to average ${money(requiredAvg)} of revenue — ${whole(forecastStepUp)}% above the run rate so far.`
              : `The forecast assumes the remaining ${remainingMonths} month${remainingMonths === 1 ? "" : "s"} average ${money(requiredAvg)} of revenue — ${whole(forecastStepUp)}% below the run rate so far, so it looks conservative.`
          );
        } else if (forecastStepUp != null) {
          insights.push("The forecast for the rest of the year is in line with the run rate so far.");
        }
      }
    }
  }

  // Year over year: revenue and net profit vs the same months last year.
  if (revYoY != null) {
    const revWord = Math.abs(revYoY) < 1 ? "flat" : revYoY > 0 ? `up ${fmtPct(Math.abs(revYoY))}` : `down ${fmtPct(Math.abs(revYoY))}`;
    const npPart =
      npYoY == null || (km.netProfit < 0) !== (prevKm.netProfit < 0)
        ? ""
        : Math.abs(npYoY) < 1
        ? ", with net profit flat"
        : `, while net profit is ${npYoY > 0 ? "up" : "down"} ${fmtPct(Math.abs(npYoY))}`;
    insights.push(`Compared with the same period of ${prevLabel || "last year"}, revenue is ${revWord}${npPart}.`);
  }

  // Momentum within the year: recent periods vs earlier ones.
  const direction = revGrowth == null ? null : revGrowth <= -2 ? "slipping" : revGrowth >= 2 ? "growing" : "flat";
  const momentum = `in recent ${unit}s compared with earlier in the year`;
  if (revShort) {
    insights.push(
      direction === "growing"
        ? `Revenue is picking up, but not fast enough to meet plan — it is about ${whole(revGap)}% short of budget.`
        : direction === "slipping"
        ? `Revenue has softened about ${whole(revGrowth)}% ${momentum} and is about ${whole(revGap)}% short of budget — the plan assumed growth that isn't materialising.`
        : `Revenue is holding steady while the budget assumed growth, leaving it about ${whole(revGap)}% short of plan.`
    );
  } else if (revGap != null && revGap >= 2) {
    insights.push(
      `Revenue is ahead of budget by about ${whole(revGap)}%${direction === "slipping" ? `, though it has softened ${momentum}` : ""}.`
    );
  } else if (revGap != null && Math.abs(revGap) < 2 && direction !== "slipping") {
    insights.push("Revenue is tracking in line with budget.");
  } else if (direction === "slipping") {
    insights.push(`Revenue has softened about ${whole(revGrowth)}% ${momentum}.`);
  } else if (direction === "growing") {
    insights.push(
      `Revenue has risen about ${whole(revGrowth)}% ${momentum}${revVolatility < 6 ? " on steady demand" : `, with sizeable ${unit}-to-${unit} swings`}.`
    );
  } else if (direction === "flat") {
    insights.push(`Revenue is steady${revVolatility < 6 ? ` and predictable ${unit} to ${unit}` : ` overall but swings noticeably ${unit} to ${unit}`}.`);
  }

  if (costsOutpacing) {
    insights.push(revGrowth < 0 ? "Costs have not come down with revenue, which is eroding margin." : "Costs are rising faster than revenue, which is squeezing margin.");
  } else if (revYoY != null && expYoY != null && expYoY > revYoY + 2) {
    insights.push(`Costs are up ${fmtPct(expYoY - revYoY)} more than revenue versus last year, which is squeezing margin.`);
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
        ? `The weakest ${unit}, ${worstMonth}, came from a dip in sales rather than overspending.`
        : `The weakest ${unit}, ${worstMonth}, came from a spending spike rather than weaker sales.`
    );
  }

  // ── What the business should do, most important first ──
  const actions = [];
  const add = (when, lead, detail) => {
    if (when && actions.length < 3) actions.push({ lead, detail });
  };
  const worstMonthName = worstMonth ? worstMonth.split(" ")[0] : "";
  const costsOutpacingYoY = !costsOutpacing && revYoY != null && expYoY != null && expYoY > revYoY + 2;
  add(loss, "Return to profit", "reprice or exit the lowest-margin products and customers, and pause discretionary spend until monthly results turn positive.");
  add(
    forecastStepUp != null && forecastStepUp >= 5,
    "Validate the forecast step-up",
    `confirm the pipeline supports ${money(requiredAvg)} of monthly revenue for the rest of the year, or re-forecast to the current run rate.`
  );
  add(
    npBudgetGap != null && npBudgetGap <= -5,
    "Close the profit gap to budget",
    "review the largest revenue and cost variances by month and assign owners to recover them."
  );
  add(revShort, "Recover the revenue shortfall", "focus account teams on renewals, upsell and pipeline conversion with the largest customers for the rest of the year.");
  add(revShort && opexGap != null && opexGap <= -2, "Reinvest the budget underspend", "redirect part of the unspent operating budget into targeted sales and marketing campaigns.");
  add(costsOutpacing || costsOutpacingYoY, "Hold cost growth below revenue growth", "freeze new discretionary commitments and renegotiate the largest supplier contracts.");
  add(!revShort && ((revGap == null && direction === "slipping") || (revYoY != null && revYoY <= -5)), "Reverse the revenue slide", "launch retention offers and price reviews for the top accounts.");
  add(!loss && costRatio != null && costRatio >= 80, "Widen margins", "raise prices selectively where demand is steady and take a few points out of the largest cost categories.");
  add(cashNegativeDespiteProfit, "Release cash from operations", "speed up collections and bring inventory down so profit turns into cash.");
  add(cashConversion != null && cashConversion < 70, "Improve cash conversion", "tighten payment terms and collections.");
  add(cashConversion != null && cashConversion >= 150, "Put surplus cash to work", "pay down debt or fund growth projects instead of holding idle balances.");
  add(revVolatility >= 6, "Smooth revenue", `grow recurring and contracted revenue to reduce ${unit}-to-${unit} swings.`);
  add(weakDriver === "demand", "Get ahead of the seasonal dip", `plan promotions and pipeline pushes before ${unit === "quarter" ? worstMonth : worstMonthName}.`);
  add(weakDriver === "spend", "Control one-off spend", `add approval limits on large purchases to prevent spikes like ${worstMonth}.`);
  if (!actions.length) {
    add(true, `Build on the strongest ${unit}`, `repeat the sales and pricing conditions behind ${bestMonth || `the best-performing ${unit}s`}.`);
  }

  return { insights: insights.slice(0, 6), actions, bestMonth, worstMonth, unit };
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
export default function ExecutiveInsight({ comparison = "None", forecast = null, forecastCompanyWideOnly = false, keymetrics, prevKeymetrics, prevLabel, monthsWithData = 0, charts, budget, parseMetric, renderValue, currency, currencyFilter }) {
  const toKm = (m) => ({
    revenue: parseMetric(m?.Revenue),
    grossProfit: parseMetric(m?.Grossprofit),
    netProfit: parseMetric(m?.NetProfit),
    expense: parseMetric(m?.Expense),
    cashFlow: parseMetric(m?.cashflow),
    headcount: Number(m?.headcount ?? 0) || 0,
  });
  const km = useMemo(() => toKm(keymetrics), [keymetrics, parseMetric]); // eslint-disable-line react-hooks/exhaustive-deps
  // Prior year (same months) — only usable when it actually had activity.
  const prevKm = useMemo(() => {
    if (!prevKeymetrics) return null;
    const p = toKm(prevKeymetrics);
    return p.revenue || p.expense || p.netProfit ? p : null;
  }, [prevKeymetrics, parseMetric]); // eslint-disable-line react-hooks/exhaustive-deps
  const money = (v) => renderValue(v, currency, currencyFilter);
  const insight = useMemo(
    () => buildExecutiveInsight({ km, charts, budget, prevKm, prevLabel, monthsWithData, comparison, forecast, forecastCompanyWideOnly, money }),
    [km, charts, budget, prevKm, prevLabel, monthsWithData, comparison, forecast, forecastCompanyWideOnly, currency, currencyFilter] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const unitName = insight.unit === "quarter" ? "Quarter" : "Month";
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
          <MetricRow label={`Best ${unitName}`} isText display={insight.bestMonth || "--"} />
          <MetricRow label={`Worst ${unitName}`} isText display={insight.worstMonth || "--"} />
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
