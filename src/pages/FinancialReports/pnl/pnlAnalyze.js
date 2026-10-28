import { API_BASE_URL } from "../../../config/config";
import { cachedFetch } from "../../../utils/reportCache";

/*
 * Builds the "Analyze with AI" context for a P&L value: the clicked value and
 * its surroundings from the table, exact bridges computed here, and the
 * drill-down detail (customers / products / accounts / entities / regions)
 * fetched with the user's own token — the same data the drill-down drawers
 * show, so nothing outside the user's access is sent to the AI.
 */

const DRILLS = {
  revenue: {
    endpoint: "pnl-revenue-drilldown",
    label: "Revenue",
    filters: ["entity_name", "product_name", "region"],
  },
  cogs: {
    endpoint: "pnl-cost-of-good-sold-drilldown",
    label: "Cost of goods sold",
    filters: ["entity_name", "product_name", "region"],
  },
  opex: {
    endpoint: "pnl-operating-expense-drilldown",
    label: "Operating expense",
    filters: ["entity_name", "region"],
  },
};

const ALL_DRILLS = ["revenue", "cogs", "opex"];
const METRIC_DRILLS = {
  revenue: ["revenue"],
  cost_of_goods_sold: ["cogs"],
  opex: ["opex"],
  gross_profit: ["revenue", "cogs"],
  actual_profit: ALL_DRILLS,
  variance: ALL_DRILLS,
  variance_percentage: ALL_DRILLS,
  budget_profit: [],
};

const LINES = [
  ["revenue", "revenue"],
  ["cost_of_goods_sold", "cost_of_goods_sold"],
  ["gross_profit", "gross_profit"],
  ["operating_expense", "opex"],
  ["actual_profit", "actual_profit"],
  ["budget_profit", "budget_profit"],
  ["variance_vs_budget", "variance"],
];

const round2 = (n) => Math.round(n * 100) / 100;

const toNum = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[$,%\s]/g, "").replace(/[KMB]$/i, ""));
  return Number.isFinite(n) ? round2(n) : null;
};

const isPeriod = (p) => /^\d{4}-\d{2}$/.test(p || "");

export const previousPeriod = (period) => {
  const [y, m] = period.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};

const absChange = (x) => Math.abs(x.change ?? x.impact ?? 0);
const topBy = (list, n) => [...(list || [])].sort((a, b) => absChange(b) - absChange(a)).slice(0, n);
const scalars = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([k, v]) => v !== null && typeof v !== "object" && k !== "trend"));

const moversOf = (json) => {
  const t = json?.top_impact;
  const list = Array.isArray(t) ? t : [...(t?.increases || []), ...(t?.decreases || [])];
  return topBy(list, 8).map((m) => ({
    name: m.customer_name || m.account || m.name || "Unknown",
    entity: m.entity || null,
    region: m.region || null,
    current: m.current,
    previous: m.previous,
    change: m.change ?? m.impact,
    change_pct: m.change_pct,
  }));
};

// Keeps the biggest movers at the first two breakdown levels only.
const compactBreakdowns = (list, depth = 0) =>
  topBy(list, depth === 0 ? 6 : 3).map((node) => {
    const out = scalars(node);
    const childKey = Object.keys(node).find((k) => Array.isArray(node[k]));
    if (depth === 0 && childKey) out[childKey] = compactBreakdowns(node[childKey], 1);
    return out;
  });

const compactDrill = (json) => ({
  summary: json.summary,
  bridge: (json.waterfall || []).map(({ label, value, type }) => ({ label, value, type })),
  breakdowns: compactBreakdowns(json.breakdowns),
  top_movers: moversOf(json),
});

const fetchDrill = async (kind, period, { token, currency, drillFilters }) => {
  const cfg = DRILLS[kind];
  const params = new URLSearchParams({ currency_filter: "actualvalue", period });
  cfg.filters.forEach((f) => drillFilters[f] && params.append(f, drillFilters[f]));
  try {
    const json = await cachedFetch(
      `${API_BASE_URL}/api/v1/company/financial/${cfg.endpoint}/${currency}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
    );
    return json && typeof json === "object" ? json : null;
  } catch (err) {
    console.error(`Analyze with AI: ${kind} drill-down failed`, err);
    return null;
  }
};

const drillTables = (kind, json) => {
  const { label } = DRILLS[kind];
  const s = json.summary || {};
  const tables = [];
  if (json.waterfall?.length) {
    tables.push({
      title: `${label} bridge — ${s.previous_period} → ${s.current_period}`,
      columns: [
        { key: "label", label: "Step" },
        { key: "value", label: "Amount", type: "money" },
      ],
      rows: json.waterfall,
    });
  }
  const movers = moversOf(json);
  if (movers.length) {
    tables.push({
      title: `${label} — biggest movers vs ${s.previous_period}`,
      columns: [
        { key: "name", label: kind === "revenue" ? "Customer" : "Account" },
        ...(movers.some((m) => m.entity) ? [{ key: "entity", label: "Entity" }] : []),
        { key: "current", label: s.current_period, type: "money" },
        { key: "previous", label: s.previous_period, type: "money" },
        { key: "change", label: "Change", type: "money", signed: true },
        { key: "change_pct", label: "%", type: "pct", signed: true },
      ],
      rows: movers,
    });
  }
  return tables;
};

const lineValues = (row, getValue) =>
  Object.fromEntries(LINES.map(([name, key]) => [name, row ? toNum(getValue(row, key)) : null]));

const diff = (a, b) => (a === null || b === null ? null : round2(a - b));

// Month-over-month profit bridge: change in profit = revenue change − COGS
// change − opex change (+ anything the lines don't reconcile).
const profitBridge = (cur, prev) => {
  const d = {
    revenue: diff(cur.revenue, prev.revenue),
    cost_of_goods_sold: diff(cur.cost_of_goods_sold, prev.cost_of_goods_sold),
    operating_expense: diff(cur.operating_expense, prev.operating_expense),
    actual_profit: diff(cur.actual_profit, prev.actual_profit),
  };
  if (Object.values(d).some((v) => v === null)) return null;
  const explained = round2(d.revenue - d.cost_of_goods_sold - d.operating_expense);
  return {
    change_in_actual_profit: d.actual_profit,
    from_revenue_change: d.revenue,
    from_cogs_change: round2(-d.cost_of_goods_sold),
    from_operating_expense_change: round2(-d.operating_expense),
    ...(Math.abs(d.actual_profit - explained) > 0.5 && { not_reconciled: round2(d.actual_profit - explained) }),
  };
};

const budgetLines = (row) => {
  const b = row?.budget_data;
  if (!b || !Object.keys(b).length) return null;
  return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, toNum(v)]));
};

const bridgeTable = (bridge, cur, prev, monthLabel) =>
  bridge && {
    title: `Profit bridge — ${monthLabel(prev)} → ${monthLabel(cur)}`,
    columns: [
      { key: "label", label: "Driver" },
      { key: "value", label: "Profit impact", type: "money", signed: true },
    ],
    rows: [
      { label: "Revenue change", value: bridge.from_revenue_change },
      { label: "COGS change", value: bridge.from_cogs_change },
      { label: "Operating expense change", value: bridge.from_operating_expense_change },
      ...(bridge.not_reconciled ? [{ label: "Not reconciled", value: bridge.not_reconciled }] : []),
      { label: "Change in actual profit", value: bridge.change_in_actual_profit },
    ],
  };

/**
 * target: { kind: "cell", metric, period, mode } for a table value, or
 *         { kind: "kpi", metric } for a Key P&L Metric.
 */
export async function buildPnlAnalysisContext({
  target,
  rows,
  metrics,
  token,
  currency,
  tableScale,
  drillFilters,
  drillFiltersNotApplied,
  getValue,
  monthLabel,
}) {
  const periodRows = rows.filter((r) => isPeriod(r.period));
  const byPeriod = Object.fromEntries(periodRows.map((r) => [r.period, r]));

  // Which month the drill-down explains: the clicked month, or for a KPI the
  // month that moved it most (largest budget miss, else largest beat).
  let focus = target.period;
  let kpiFacts = null;
  if (target.kind === "kpi") {
    const months = periodRows
      .map((r) => ({
        period: r.period,
        month: monthLabel(r.period),
        ...lineValues(r, getValue),
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
    const withVar = months.filter((m) => m.variance_vs_budget !== null);
    const sorted = [...withVar].sort((a, b) => a.variance_vs_budget - b.variance_vs_budget);
    const worst = sorted[0];
    const best = sorted[sorted.length - 1];
    focus = (worst && worst.variance_vs_budget < 0 ? worst : best)?.period;
    const total = (key) => round2(months.reduce((acc, m) => acc + (m[key] ?? 0), 0));
    kpiFacts = {
      kpi_value_on_screen: metrics?.[target.metric] ?? null,
      year_totals: {
        revenue: total("revenue"),
        cost_of_goods_sold: total("cost_of_goods_sold"),
        operating_expense: total("operating_expense"),
        actual_profit: total("actual_profit"),
        budget_profit: total("budget_profit"),
        variance_vs_budget: total("variance_vs_budget"),
      },
      months_ranked_by_variance_vs_budget: sorted.map((m) => ({ month: m.month, variance: m.variance_vs_budget })),
      months_below_budget: sorted.filter((m) => m.variance_vs_budget < 0).length,
      months_above_budget: sorted.filter((m) => m.variance_vs_budget > 0).length,
      drill_down_month: focus ? monthLabel(focus) : null,
    };
  }

  const kinds = target.kind === "kpi" ? ALL_DRILLS : METRIC_DRILLS[target.metric] || [];
  const drills = focus
    ? await Promise.all(kinds.map((k) => fetchDrill(k, focus, { token, currency, drillFilters })))
    : [];

  const cur = focus ? lineValues(byPeriod[focus], getValue) : null;
  const prevPeriod = focus ? previousPeriod(focus) : null;
  const prevRow = prevPeriod ? byPeriod[prevPeriod] : null;
  const prev = prevRow ? lineValues(prevRow, getValue) : null;
  const bridge = cur && prev ? profitBridge(cur, prev) : null;

  const computedFacts = {
    ...(kpiFacts || {}),
    ...(focus && {
      month: monthLabel(focus),
      pnl_lines_this_month: cur,
      ...(prev && { previous_month: monthLabel(prevPeriod), pnl_lines_previous_month: prev }),
      ...(bridge && { profit_bridge_vs_previous_month: bridge }),
      ...(budgetLines(byPeriod[focus]) && { budget_this_month: budgetLines(byPeriod[focus]) }),
      ...(byPeriod[focus]?.comparision &&
        Object.keys(byPeriod[focus].comparision).length && { comparison_on_screen: byPeriod[focus].comparision }),
    }),
  };

  const drillDown = {};
  kinds.forEach((k, i) => {
    if (drills[i]) drillDown[k] = compactDrill(drills[i]);
  });

  const context = JSON.stringify({
    table_view: target.mode || "monthly",
    table_value_scale: tableScale,
    drill_down_value_scale: "Actual (full amounts), month vs previous month",
    drill_down_filters_applied: drillFilters,
    ...(drillFiltersNotApplied.length && {
      drill_down_filters_not_applied: drillFiltersNotApplied,
      note: "Drill-down detail covers all values of these dimensions, so its totals can differ from the table.",
    }),
    computed_facts: computedFacts,
    drill_down: drillDown,
    ...(!kinds.length && { note_no_drill: "No driver-level detail exists for this line; use the P&L lines." }),
  });

  const supporting = [];
  if (kpiFacts) {
    supporting.push({
      title: "Monthly profit vs budget",
      columns: [
        { key: "month", label: "Month" },
        { key: "actual_profit", label: "Actual", type: "money" },
        { key: "budget_profit", label: "Budget", type: "money" },
        { key: "variance_vs_budget", label: "Variance", type: "money", signed: true },
      ],
      rows: periodRows
        .map((r) => ({ period: r.period, month: monthLabel(r.period), ...lineValues(r, getValue) }))
        .sort((a, b) => a.period.localeCompare(b.period)),
      note: tableScale !== "Actual" ? `Values in ${tableScale.toLowerCase()}` : undefined,
    });
  }
  const bt = bridgeTable(bridge, focus, prevPeriod, monthLabel);
  if (bt && kinds.length > 1) supporting.push({ ...bt, note: tableScale !== "Actual" ? `Values in ${tableScale.toLowerCase()}` : undefined });
  kinds.forEach((k, i) => drills[i] && supporting.push(...drillTables(k, drills[i])));

  return { context, supporting };
}
