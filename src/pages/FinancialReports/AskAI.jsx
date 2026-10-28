import React, { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { BsStars } from 'react-icons/bs';
import { FiX } from 'react-icons/fi';
import { fevicon } from '../../assets/Assets';
import { API_BASE_URL } from '../../config/config';
import { AuthContext } from '../../context/AuthContext';

const nowTime = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// Keys that are always dropdown/UI metadata, never the report's actual data,
// regardless of report shape.
const ALWAYS_NOISE_KEYS = new Set(['filters', 'widgets', 'aiDriver']);

// A "filter list" looks like [{ entity_id, entity_name }, ...] — small objects
// whose only fields are id/name/label style keys. Real data rows (e.g. revenue
// rows with customer_name, q1..q4, total_amount) have more/different fields and
// must NOT be stripped just because the array happens to be named "products"
// or "customers" — those names are also used for actual report data.
const isIdNameKey = (k) => /(^id$|^name$|^label$|_id$|_name$|_label$)/i.test(k);

const isFilterListArray = (arr) => {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  return arr.every((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const keys = Object.keys(item);
    return keys.length > 0 && keys.length <= 3 && keys.every(isIdNameKey);
  });
};

const stripNoise = (obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const out = {};
  for (const k of Object.keys(obj)) {
    if (ALWAYS_NOISE_KEYS.has(k)) continue;
    if (isFilterListArray(obj[k])) continue;
    out[k] = obj[k];
  }
  return out;
};

const cleanForContext = (data) => {
  if (Array.isArray(data)) {
    return data
      .filter((item) => {
        if (!item || typeof item !== 'object') return false;
        const keys = Object.keys(item);
        return !(keys.length === 1 && ALWAYS_NOISE_KEYS.has(keys[0]));
      })
      .map(stripNoise);
  }
  return stripNoise(data);
};

const toNum = (v) => {
  if (v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/[,$\s]/g, ''));
  return Number.isNaN(n) ? 0 : n;
};

const fmt = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });

// Revenue_Report rows are per customer+product, with a `revenue` total and a
// `period_revenues` breakdown. Raw JSON is too large/unsorted to reliably
// truncate, so pre-aggregate by customer and by period to give the AI
// deterministic, ranked answers instead of a partial JSON dump.
const buildRevenueContext = (data, year, currency) => {
  const allRows = Array.isArray(data?.products) ? data.products : [];
  const grandTotal = allRows.find((r) => r?.customer_name === 'Grand Total');
  const rows = allRows.filter((r) => r?.customer_name !== 'Grand Total');

  const byCustomer = {};
  const overallPeriods = {};
  rows.forEach((r) => {
    const name = r?.customer_name || 'Unknown';
    const amount = toNum(r?.revenue ?? r?.total_amount);
    if (!byCustomer[name]) byCustomer[name] = { total: 0, periods: {} };
    byCustomer[name].total += amount;

    const pr = r?.period_revenues;
    if (pr && typeof pr === 'object') {
      Object.entries(pr).forEach(([period, val]) => {
        const v = toNum(val);
        byCustomer[name].periods[period] = (byCustomer[name].periods[period] || 0) + v;
        overallPeriods[period] = (overallPeriods[period] || 0) + v;
      });
    }
  });

  // H1 vs H2 of the year gives a usable growth signal per customer without
  // dumping a full monthly series for every customer (which would blow past
  // the context size cap once there are more than a handful of customers).
  const halfOf = (period) => {
    const m = parseInt(String(period).split('-')[1], 10);
    return m <= 6 ? 'h1' : 'h2';
  };

  const customerList = Object.entries(byCustomer)
    .map(([name, v]) => {
      let h1 = 0, h2 = 0;
      Object.entries(v.periods).forEach(([period, amount]) => {
        if (halfOf(period) === 'h1') h1 += amount; else h2 += amount;
      });
      const growth = h2 - h1;
      const growthPct = h1 !== 0 ? (growth / h1) * 100 : (h2 > 0 ? 100 : 0);
      return { name, ...v, h1, h2, growth, growthPct };
    })
    .sort((a, b) => b.total - a.total);

  const totalRevenue = customerList.reduce((s, c) => s + c.total, 0);
  const top = customerList.slice(0, 10);
  const bottom = customerList.slice(-5).reverse();
  const top10Pct = totalRevenue > 0 ? (top.reduce((s, c) => s + c.total, 0) / totalRevenue) * 100 : 0;

  const periodTrend = (c) => {
    const keys = Object.keys(c.periods).sort();
    if (!keys.length) return '';
    return ' (' + keys.map((k) => `${k}=${fmt(c.periods[k])}`).join(', ') + ')';
  };

  const haveHalves = customerList.some((c) => c.h1 !== 0 || c.h2 !== 0);
  const byGrowth = haveHalves ? [...customerList].sort((a, b) => b.growthPct - a.growthPct) : [];
  const topGrowers = byGrowth.filter((c) => c.h1 > 0).slice(0, 5);
  const decliners = byGrowth.filter((c) => c.h1 > 0 && c.growth < 0).sort((a, b) => a.growthPct - b.growthPct).slice(0, 5);

  const lines = [
    `Revenue By Customer report for fiscal year ${year} (currency ${currency}).`,
    `Total customers: ${customerList.length}. Total revenue across all customers: ${fmt(totalRevenue)}.`,
  ];

  if (grandTotal) {
    lines.push(`Report grand total row: revenue=${fmt(toNum(grandTotal.revenue ?? grandTotal.total))}.`);
  }

  lines.push(`Top ${top.length} customers represent ${fmt(top10Pct)}% of total revenue.`);
  lines.push('Top revenue customers, ranked highest to lowest (with period breakdown):');
  top.forEach((c, i) => lines.push(`${i + 1}. ${c.name}: total=${fmt(c.total)}${periodTrend(c)}`));

  if (bottom.length) {
    lines.push('Lowest revenue customers:');
    bottom.forEach((c) => lines.push(`- ${c.name}: total=${fmt(c.total)}`));
  }

  if (haveHalves) {
    lines.push(
      'Revenue growth per customer, comparing first half of the year (H1: Jan-Jun) ' +
      'to second half (H2: Jul-Dec). Only customers with revenue in H1 are ranked by % growth:'
    );
    if (topGrowers.length) {
      lines.push('Customers with the highest revenue growth (H2 vs H1):');
      topGrowers.forEach((c, i) => lines.push(
        `${i + 1}. ${c.name}: H1=${fmt(c.h1)}, H2=${fmt(c.h2)}, growth=${fmt(c.growth)} (${fmt(c.growthPct)}%)`
      ));
    }
    if (decliners.length) {
      lines.push('Customers with declining revenue (H2 vs H1):');
      decliners.forEach((c) => lines.push(
        `- ${c.name}: H1=${fmt(c.h1)}, H2=${fmt(c.h2)}, decline=${fmt(c.growth)} (${fmt(c.growthPct)}%)`
      ));
    } else {
      lines.push('No customers showed a revenue decline from H1 to H2.');
    }
  }

  const periodKeys = Object.keys(overallPeriods).sort();
  if (periodKeys.length) {
    lines.push('Total revenue by period (all customers combined):');
    periodKeys.forEach((p) => lines.push(`${p}: ${fmt(overallPeriods[p])}`));
    const best = periodKeys.reduce((a, b) => (overallPeriods[a] >= overallPeriods[b] ? a : b));
    const worst = periodKeys.reduce((a, b) => (overallPeriods[a] <= overallPeriods[b] ? a : b));
    lines.push(
      `Highest revenue period: ${best} (${fmt(overallPeriods[best])}). ` +
      `Lowest revenue period: ${worst} (${fmt(overallPeriods[worst])}).`
    );
  }

  let ctx = `Use ONLY this as the source of truth:\n${lines.join('\n')}`;
  if (ctx.length > 8000) ctx = ctx.slice(0, 8000) + ' ...[truncated]';
  return ctx;
};

// customer-profitability rows carry a per-customer `total` (already aggregated
// for the year) plus a `months` breakdown. Raw JSON of all customers x months
// is too large to safely truncate, so rank by `total` directly and use the
// Grand Total record's `months` for the company-wide monthly trend.
const buildCustomerProfitContext = (data, year, currency) => {
  const allCustomers = Array.isArray(data?.customers) ? data.customers : [];
  const grandTotal = allCustomers.find((c) => c?.customer_name === 'Grand Total');
  const rows = allCustomers.filter((c) => c?.customer_name !== 'Grand Total');

  const list = rows.map((c) => ({
    name: c?.customer_name || 'Unknown',
    revenue: toNum(c?.total?.revenue),
    cost: toNum(c?.total?.total_cost),
    profit: toNum(c?.total?.profit),
    margin: toNum(c?.total?.pct_margin),
  }));

  const byProfit = [...list].sort((a, b) => b.profit - a.profit);
  const byMargin = [...list].sort((a, b) => b.margin - a.margin);
  const lossMaking = list.filter((c) => c.profit < 0).sort((a, b) => a.profit - b.profit);
  const avgMargin = list.length ? list.reduce((s, c) => s + c.margin, 0) / list.length : 0;

  const km = data?.keymetrics || {};
  const totalRevenue = toNum(km.total_revenue) || list.reduce((s, c) => s + c.revenue, 0);
  const totalProfit = toNum(km.total_profit) || list.reduce((s, c) => s + c.profit, 0);

  const lines = [
    `Customer Profitability report for fiscal year ${year} (currency ${currency}).`,
    `Total customers: ${list.length}.`,
    `Company-wide totals: revenue=${fmt(totalRevenue)}, cost=${fmt(toNum(km.total_cost))}, ` +
      `profit=${fmt(totalProfit)}, blended margin=${fmt(toNum(km.margin))}%.`,
    `Average per-customer profit margin: ${fmt(avgMargin)}%.`,
    'Most profitable customers, ranked highest to lowest:',
  ];
  byProfit.slice(0, 10).forEach((c, i) => lines.push(
    `${i + 1}. ${c.name}: revenue=${fmt(c.revenue)}, cost=${fmt(c.cost)}, profit=${fmt(c.profit)}, margin=${fmt(c.margin)}%`
  ));

  lines.push('Customers with the highest profit margin:');
  byMargin.slice(0, 5).forEach((c) => lines.push(`- ${c.name}: margin=${fmt(c.margin)}%, profit=${fmt(c.profit)}`));

  if (lossMaking.length) {
    lines.push('Customers operating at a loss (negative profit):');
    lossMaking.forEach((c) => lines.push(`- ${c.name}: profit=${fmt(c.profit)}, revenue=${fmt(c.revenue)}`));
  } else {
    lines.push('No customers are operating at a loss.');
  }

  lines.push('Least profitable customers, ranked lowest to highest:');
  byProfit.slice(-5).reverse().forEach((c) => lines.push(`- ${c.name}: profit=${fmt(c.profit)}`));

  const gtMonths = grandTotal?.months || {};
  const periodKeys = Object.keys(gtMonths).sort();
  if (periodKeys.length) {
    lines.push('Company-wide profitability by period (all customers combined):');
    periodKeys.forEach((p) => {
      const m = gtMonths[p] || {};
      lines.push(`${p}: revenue=${fmt(toNum(m.revenue))}, profit=${fmt(toNum(m.profit))}, margin=${fmt(toNum(m.pct_margin))}%`);
    });
    const best = periodKeys.reduce((a, b) => (toNum(gtMonths[a].profit) >= toNum(gtMonths[b].profit) ? a : b));
    const worst = periodKeys.reduce((a, b) => (toNum(gtMonths[a].profit) <= toNum(gtMonths[b].profit) ? a : b));
    lines.push(
      `Best month for profitability: ${best} (profit=${fmt(toNum(gtMonths[best].profit))}). ` +
      `Worst month: ${worst} (profit=${fmt(toNum(gtMonths[worst].profit))}).`
    );
  }

  let ctx = `Use ONLY this as the source of truth:\n${lines.join('\n')}`;
  if (ctx.length > 8000) ctx = ctx.slice(0, 8000) + ' ...[truncated]';
  return ctx;
};

// Project_Costing_Report rows carry a per-project `total` (actual, budget,
// variance, completion_percentage). variance = budget - actual, so negative
// means over budget. Same truncation risk as the other reports, so rank
// directly from `total` instead of dumping raw JSON.
const buildProjectCostingContext = (data, year, currency) => {
  const projects = Array.isArray(data?.projects) ? data.projects : [];
  const km = data?.keymetrics || {};

  const list = projects.map((p) => ({
    name: p?.project_name || 'Unknown',
    customer: p?.customer_name || 'Unknown',
    actual: toNum(p?.total?.actual),
    budget: toNum(p?.total?.budget),
    variance: toNum(p?.total?.variance),
    completion: toNum(p?.total?.completion_percentage),
  }));

  const totalActual = toNum(km.total_actual) || list.reduce((s, p) => s + p.actual, 0);
  const totalBudget = toNum(km.total_budget) || list.reduce((s, p) => s + p.budget, 0);
  const overallUtilization = totalBudget ? (totalActual / totalBudget) * 100 : 0;

  const byOverBudget = [...list].sort((a, b) => a.variance - b.variance);
  const overBudget = byOverBudget.filter((p) => p.variance < 0);
  const withinBudget = list.filter((p) => p.variance >= 0).sort((a, b) => b.variance - a.variance);
  const byActualCost = [...list].sort((a, b) => b.actual - a.actual);
  const avgVariance = list.length ? list.reduce((s, p) => s + p.variance, 0) / list.length : 0;

  const byCustomer = {};
  list.forEach((p) => { byCustomer[p.customer] = (byCustomer[p.customer] || 0) + p.actual; });
  const customerRanking = Object.entries(byCustomer)
    .map(([name, actual]) => ({ name, actual }))
    .sort((a, b) => b.actual - a.actual);

  const lines = [
    `Project Costing report for fiscal year ${year} (currency ${currency}).`,
    `Total projects: ${list.length}.`,
    `Company-wide totals: actual cost=${fmt(totalActual)}, budget=${fmt(totalBudget)}, ` +
      `variance=${fmt(toNum(km.total_variance))}.`,
    `Projects on/under budget: ${toNum(km.on_budget_projects) || withinBudget.length}. ` +
      `Projects over budget: ${toNum(km.over_budget_projects) || overBudget.length}.`,
    `Average cost variance across projects: ${fmt(avgVariance)} (positive = under budget, negative = over budget).`,
    `Overall budget utilization rate: ${fmt(overallUtilization)}% (total actual / total budget).`,
    'Projects with the highest cost overrun (most over budget), ranked worst first:',
  ];
  if (overBudget.length) {
    overBudget.slice(0, 10).forEach((p, i) => lines.push(
      `${i + 1}. ${p.name} (customer: ${p.customer}): actual=${fmt(p.actual)}, budget=${fmt(p.budget)}, ` +
      `variance=${fmt(p.variance)}, completion=${fmt(p.completion)}%`
    ));
  } else {
    lines.push('No projects are currently over budget.');
  }

  lines.push('Projects within budget, ranked by largest surplus:');
  withinBudget.slice(0, 10).forEach((p) => lines.push(
    `- ${p.name}: actual=${fmt(p.actual)}, budget=${fmt(p.budget)}, variance=${fmt(p.variance)}`
  ));

  lines.push('Projects with the highest total actual cost, ranked highest to lowest:');
  byActualCost.slice(0, 10).forEach((p, i) => lines.push(
    `${i + 1}. ${p.name}: actual=${fmt(p.actual)}, budget=${fmt(p.budget)}`
  ));

  lines.push('Customers with the highest total project cost:');
  customerRanking.slice(0, 5).forEach((c, i) => lines.push(`${i + 1}. ${c.name}: total actual cost=${fmt(c.actual)}`));

  let ctx = `Use ONLY this as the source of truth:\n${lines.join('\n')}`;
  if (ctx.length > 8000) ctx = ctx.slice(0, 8000) + ' ...[truncated]';
  return ctx;
};

const REPORT_CONFIG = {
  pnl: {
    label: 'Profit & Loss Statement',
    endpoint: (y, c) => `/api/v1/company/financial/profitandloss_statement/${y}/${c}`,
    questions: [
      'What is the total revenue for the year?',
      'Which month had the highest revenue?',
      'What were the total operating expenses for the year?',
      'How did the cost of goods sold trend over the year?',
      'Which month was the most profitable?',
      'What is the actual profit vs budget profit comparison?',
      'What is the overall variance and variance percentage?',
      'Which month had the worst performance?',
      'What is the gross profit trend across months?',
      'How does revenue compare across all months?',
    ],
  },
  cash_flow: {
    label: 'Cash Flow Statement',
    endpoint: (y, c) => `/api/v1/company/financial/cashflow_statement/${y}/${c}`,
    questions: [
      'What is the total operating cash flow for the year?',
      'Which month had the highest net cash change?',
      'How did investing cash flow trend over the year?',
      'What is the total financing cash flow?',
      'Which month had the worst net cash change?',
      'How does operating cash flow compare to investing activities?',
      'What is the overall net cash change for the year?',
      'Which month showed the strongest cash position?',
      'What drove the biggest swings in cash flow?',
      'How does this year\'s cash flow compare overall?',
    ],
  },
  revenue: {
    label: 'Revenue By Customer',
    // Backend has no pagination — it always returns the full result set.
    // sort_by must be one of the backend's RevenueSortByOption values
    // (customer_name, product_name, entity_name, region, category, period,
    // revenue) — "revenue" sorts by total_revenue descending server-side.
    // show_period=true is required or the backend returns an empty
    // period_revenues {} for every row, with no monthly breakdown at all.
    endpoint: (y, c) =>
      `/api/v1/company/financial/Revenue_Report/${y}/${c}` +
      `?currency_filter=actualvalue&period=all&sort_by=revenue&sort_order=desc&view_mode=monthly&show_period=true`,
    buildContext: buildRevenueContext,
    questions: [
      'Who are the top revenue-generating customers?',
      'What is the total revenue for the year?',
      'Which customer had the highest revenue growth?',
      'How did revenue trend month over month?',
      'Which month had the highest total revenue?',
      'What is the revenue distribution across customers?',
      'Which customers had declining revenue?',
      'What percentage of revenue comes from the top customers?',
      'Which customer contributed the least revenue?',
      'How has revenue concentration changed over the year?',
    ],
  },
  customer_profit: {
    label: 'Customer Profitability Report',
    endpoint: (y, c) => `/api/v1/company/financial/customer-profitability/${y}/${c}`,
    buildContext: buildCustomerProfitContext,
    questions: [
      'Which customers are most profitable?',
      'What is the total profit across all customers?',
      'Which customer has the highest profit margin?',
      'Which customers are operating at a loss?',
      'What is the overall profitability trend across customers this year?',
      'What is the average profit margin across customers?',
      'Which month showed the best customer profitability?',
      'How has profitability changed over the year?',
      'What is the revenue vs profit breakdown per customer?',
      'Which customers should be prioritized for growth?',
    ],
  },
  balance_sheet: {
    label: 'Balance Sheet',
    endpoint: (y, c) => `/api/v1/company/financial/balance_sheet_statement/${y}/${c}`,
    questions: [
      'What are the total assets?',
      'What are the total liabilities?',
      'What is the total equity?',
      'How does total assets compare to total liabilities?',
      'What are the major components of current assets?',
      'How has equity changed over the year?',
      'What is the working capital position?',
      'What is the debt-to-equity ratio?',
      'Which asset category has the highest value?',
      'How has the balance sheet changed from prior periods?',
    ],
  },
  project_costing: {
    label: 'Project Costing Report',
    endpoint: (y, c) => `/api/v1/company/financial/Project_Costing_Report/${y}/${c}`,
    buildContext: buildProjectCostingContext,
    questions: [
      'Which projects had the highest cost overrun?',
      'What is the total project cost for the year?',
      'Which projects are within budget?',
      'What is the average cost variance across projects?',
      'Which project has the highest total cost?',
      'How does actual cost compare to budgeted cost?',
      'Which projects are most over budget?',
      'Which customer has the highest total project cost?',
      'How many projects are over budget vs on budget?',
      'What is the budget utilization rate across all projects?',
    ],
  },
  operating_expenses: {
    label: 'Operating Expenses',
    endpoint: (y, c) => `/api/v1/company/financial/operating_enpense_report/${y}/${c}`,
    questions: [
      'What are the total operating expenses for the year?',
      'Which expense category is the highest?',
      'How did operating expenses trend month over month?',
      'Which month had the highest operating expenses?',
      'What is the breakdown of expenses by category?',
      'How do actual expenses compare to budget?',
      'Which expense categories are over budget?',
      'What is the year-to-date operating expense total?',
      'Which expense area has grown the most?',
      'What percentage of revenue do operating expenses represent?',
    ],
  },
  fixed_asset: {
    label: 'Fixed Asset Report',
    endpoint: (y, c) => `/api/v1/company/financial/fixed_asset/${y}/${c}`,
    questions: [
      'What is the total value of fixed assets?',
      'What is the total accumulated depreciation?',
      'Which asset category has the highest net book value?',
      'What assets were acquired this year?',
      'What is the net book value of all assets?',
      'Which assets have the highest depreciation charge?',
      'What is the total depreciation for the year?',
      'How has the fixed asset base changed over the year?',
      'What is the average asset age?',
      'Which assets are fully depreciated?',
    ],
  },
  sales_funnel: {
    label: 'Sales Funnel Report',
    endpoint: (y, c) => `/api/v1/company/financial/Sales_Funnel_Metrics/${y}/${c}`,
    questions: [
      'What is the overall sales conversion rate?',
      'Which stage of the funnel has the highest drop-off?',
      'What is the total pipeline value?',
      'How many leads converted to customers?',
      'Which month had the highest sales activity?',
      'What is the average deal size?',
      'How does the current pipeline compare to last period?',
      'Which sales stage needs the most attention?',
      'What is the win rate this year?',
      'How has the funnel velocity changed over time?',
    ],
  },
  payroll: {
    label: 'Payroll Reconciliation',
    endpoint: (y, c) => `/api/v1/company/financial/financials/Payroll_Reconciliation/${y}/${c}`,
    questions: [
      'What is the total payroll cost for the year?',
      'Which month had the highest payroll expense?',
      'How does actual payroll compare to budgeted payroll?',
      'What is the payroll variance for the year?',
      'How has headcount changed over the year?',
      'What is the average payroll cost per employee?',
      'Which department has the highest payroll cost?',
      'What is the year-to-date payroll reconciliation status?',
      'What drove payroll increases this year?',
      'How does payroll as a percentage of revenue look?',
    ],
  },
};

// Renders its own "Ask AI" toolbar button by default. Pass `open` /
// `onOpenChange` / `hideTrigger` to open the drawer from elsewhere (the P&L
// "Report AI" menu). A report with no fixed endpoint (the Custom Report
// Builder) passes its own `config`: { label, questions, getContext } where
// getContext() returns the data on screen.
const AskAI = ({ reportId = 'pnl', config: configProp, open: openProp, onOpenChange, hideTrigger = false }) => {
  const { token, selectedYear, selectedCurrency } = useContext(AuthContext);
  const config = configProp || REPORT_CONFIG[reportId] || REPORT_CONFIG.pnl;

  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = openProp ?? internalOpen;
  const setIsOpen = (next) => {
    if (openProp === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: `Hi! Choose a question below — I'll answer using the current ${config.label} data.`,
      sender: 'ai',
      time: nowTime(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [reportContext, setReportContext] = useState(null);
  const messagesEndRef = useRef(null);

  // Reset context and welcome message when report or period changes
  useEffect(() => {
    setReportContext(null);
    setMessages([
      {
        id: 1,
        text: `Hi! Choose a question below — I'll answer using the current ${config.label} data.`,
        sender: 'ai',
        time: nowTime(),
      },
    ]);
  }, [reportId, selectedYear, selectedCurrency]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const fetchContext = async () => {
    // On-screen data changes with the view, so it's rebuilt for every question.
    if (config.getContext) {
      let ctx = config.getContext() || '';
      if (ctx) ctx = `${config.label} data (fiscal year ${selectedYear}, currency ${selectedCurrency}). Use ONLY this as the source of truth:\n${ctx}`;
      return ctx.length > 8000 ? ctx.slice(0, 8000) + ' ...[truncated]' : ctx;
    }
    if (reportContext) return reportContext;
    if (!token || !selectedYear || !selectedCurrency) return '';
    try {
      const url = `${API_BASE_URL}${config.endpoint(selectedYear, selectedCurrency)}`;
      const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
      });

      let ctx;
      if (config.buildContext) {
        ctx = config.buildContext(data, selectedYear, selectedCurrency);
      } else {
        const cleaned = cleanForContext(data);
        ctx =
          `${config.label} data (fiscal year ${selectedYear}, currency ${selectedCurrency}). ` +
          `Use ONLY this as the source of truth:\n${JSON.stringify(cleaned)}`;
        if (ctx.length > 8000) ctx = ctx.slice(0, 8000) + ' ...[truncated]';
      }
      setReportContext(ctx);
      return ctx;
    } catch (err) {
      console.error(`Failed to load context for "${config.label}":`, err);
      return '';
    }
  };

  const askQuestion = async (question) => {
    if (isLoading) return;
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), text: question, sender: 'user', time: nowTime() },
    ]);
    setIsLoading(true);
    try {
      const ctx = await fetchContext();
      const { data } = await axios.post(`${API_BASE_URL}/api/v1/ai`, {
        message: question,
        context: ctx || undefined,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: data?.reply || 'Sorry, I could not generate a response.',
          sender: 'ai',
          time: nowTime(),
        },
      ]);
    } catch (error) {
      const detail = error?.response?.data?.detail;
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text:
            (typeof detail === 'string' && detail) ||
            'Sorry, something went wrong. Please try again.',
          sender: 'ai',
          time: nowTime(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {!hideTrigger && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center px-3 py-2 text-sky-800 rounded-lg bg-sky-100 hover:bg-sky-200 text-x"
        >
          <BsStars className="mr-1" /> Ask AI
        </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40 bg-black/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />

            {/* Sidebar Drawer */}
            <motion.div
              className="fixed top-0 right-0 z-50 h-full w-[380px] bg-white shadow-2xl flex flex-col border-l border-sky-200"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              {/* Header */}
              <div className="p-4 bg-sky-50 border-b border-sky-200 flex items-start justify-between">
                <div className="flex gap-3 items-center">
                  <img src={fevicon} width="40px" alt="logo" />
                  <div>
                    <h2 className="text-s font-semibold text-sky-900">FPnAInSightAI</h2>
                    <p className="text-x text-sky-600">
                      Choose a question — answers come from this report&apos;s data
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg hover:bg-sky-100 text-sky-600"
                >
                  <FiX size={18} />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 bg-sky-50 space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-x ${
                        msg.sender === 'user'
                          ? 'bg-sky-600 text-white rounded-br-none'
                          : 'bg-white border border-sky-200 text-sky-900 rounded-bl-none shadow-sm'
                      }`}
                    >
                      <div className="whitespace-pre-line">{msg.text}</div>
                      <div
                        className={`text-x mt-1 ${
                          msg.sender === 'user' ? 'text-sky-200' : 'text-sky-400'
                        }`}
                      >
                        {msg.time}
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-sky-200 rounded-lg rounded-bl-none px-3 py-2 shadow-sm">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Questions Panel */}
              <div className="p-4 border-t border-sky-200 bg-white">
                <p className="text-x font-semibold text-sky-900 mb-2 flex items-center gap-1">
                  <BsStars className="text-sky-600" />
                  {config.label}
                </p>
                <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                  {config.questions.map((q) => (
                    <button
                      key={q}
                      onClick={() => askQuestion(q)}
                      disabled={isLoading}
                      className="text-left px-3 py-2 text-x text-sky-900 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 disabled:opacity-50 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <p className="text-x text-sky-400 mt-3">
                  FPnAInsights may produce inaccurate information. Always verify critical insights.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default AskAI;
