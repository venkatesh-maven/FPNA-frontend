import { compactForAI, toNumberForAI } from "../reportAIContext";

/*
 * AI context for the Revenue (by customer) report: row commentary ("Refine
 * with AI") and ✦ "Explain this number". Everything is computed here from the
 * rows already on screen — no fetch — so rankings, shares, period moves and
 * each customer's contribution are exact and the AI doesn't do arithmetic.
 *
 * `view` (built by the page on click):
 *   rows, periodKeys, isComparison, grandTotalData, metrics,
 *   rowLabel(row), tableView, valueScale, splitBy (["product", …])
 */

const round2 = (n) => Math.round(n * 100) / 100;
const num = (v) => toNumberForAI(v); // null when the cell is empty
const pctOf = (part, whole) =>
  part === null || part === undefined || !whole ? null : round2((part / whole) * 100);
const sumOf = (list, get) => round2(list.reduce((acc, x) => acc + (get(x) ?? 0), 0));
const byAbsChange = (a, b) => Math.abs(b.change) - Math.abs(a.change);

/* ══════════ Row identity ══════════ */

// Backend column (line_item) is String(100).
const MAX_KEY_CHARS = 100;

// FNV-1a — short deterministic suffix for over-long keys.
const shortHash = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
};

const dimValue = (v) => (v === null || v === undefined || v === "" ? "—" : String(v));

/** Stable row key: customer + the toggled dimension values ("Acme Corp | North | Widgets"). */
export const revenueRowKey = (r, dimKeys) => {
  const full = [r?.customer_name || "Unknown", ...dimKeys.map((k) => r?.[k])].map(dimValue).join(" | ");
  const chars = Array.from(full);
  return chars.length <= MAX_KEY_CHARS ? full : `${chars.slice(0, 88).join("")}~${shortHash(full)}`;
};

/** Row label as people read it: "Acme Corp (North / Widgets)". */
export const revenueRowLabel = (r, dimKeys) => {
  const name = r?.customer_name || "Unknown";
  const dims = dimKeys.map((k) => r?.[k]).filter((v) => v !== null && v !== undefined && v !== "");
  return dims.length ? `${name} (${dims.join(" / ")})` : name;
};

/* ══════════ Values as shown ══════════ */

const rowTotal = (r) => num(r?.revenue) ?? 0;

// The period's revenue as shown: current revenue in comparison mode.
const valueAt = (view, r, p) =>
  view.isComparison ? num(r?.comparisons?.[p]?.current_revenue) : num(r?.period_revenues?.[p]);

const grandTotalOf = (view) =>
  num(view.grandTotalData?.revenue ?? view.grandTotalData?.total) ?? sumOf(view.rows, rowTotal);

const periodTotal = (view, p) => {
  const gt = view.grandTotalData;
  const fromGt = view.isComparison ? num(gt?.comparisons?.[p]?.current_revenue) : num(gt?.period_revenues?.[p]);
  return fromGt ?? sumOf(view.rows, (r) => valueAt(view, r, p));
};

const previousKey = (view, p) => {
  const i = view.periodKeys.indexOf(p);
  return i > 0 ? view.periodKeys[i - 1] : null;
};

// current / previous / change for one row in period p: vs the compare period
// in comparison mode, else vs the previous period column. null when there is
// nothing to compare with.
const changeGetter = (view, p) => {
  if (view.isComparison) {
    return (r) => {
      const c = r?.comparisons?.[p];
      if (!c) return null;
      const current = num(c.current_revenue) ?? 0;
      const previous = num(c.compare_revenue) ?? 0;
      return { current, previous, change: num(c.variance) ?? round2(current - previous) };
    };
  }
  const prev = previousKey(view, p);
  if (!prev) return null;
  return (r) => {
    const current = valueAt(view, r, p) ?? 0;
    const previous = valueAt(view, r, prev) ?? 0;
    return { current, previous, change: round2(current - previous) };
  };
};

const periodTotalsPair = (view, p) => {
  if (view.isComparison) {
    const g = view.grandTotalData?.comparisons?.[p];
    const current = num(g?.current_revenue) ?? sumOf(view.rows, (r) => num(r?.comparisons?.[p]?.current_revenue));
    const previous = num(g?.compare_revenue) ?? sumOf(view.rows, (r) => num(r?.comparisons?.[p]?.compare_revenue));
    return {
      compare_period: g?.compare_period ?? view.rows.find((r) => r?.comparisons?.[p])?.comparisons?.[p]?.compare_period ?? null,
      current,
      previous,
      change: num(g?.variance) ?? round2(current - previous),
    };
  }
  const prev = previousKey(view, p);
  const current = periodTotal(view, p);
  if (!prev) return { current };
  const previous = periodTotal(view, prev);
  return { previous_period: prev, current, previous, change: round2(current - previous) };
};

// Rows that moved most in period p (largest absolute change first).
const moversIn = (view, p, limit, exclude = null) => {
  const get = changeGetter(view, p);
  if (!get) return [];
  return view.rows
    .filter((r) => r !== exclude)
    .map((r) => {
      const c = get(r);
      return c && c.change ? { customer: view.rowLabel(r), ...c } : null;
    })
    .filter(Boolean)
    .sort(byAbsChange)
    .slice(0, limit);
};

const rankRows = (rows) => [...rows].sort((a, b) => rowTotal(b) - rowTotal(a));

/* ══════════ Series facts ══════════ */

const extremes = (list, key, hiName, loName) => {
  const valid = list.filter((x) => x[key] !== null && x[key] !== undefined);
  if (!valid.length) return {};
  const sorted = [...valid].sort((a, b) => b[key] - a[key]);
  const pick = (x) => ({ period: x.period, [key]: x[key] });
  return { [hiName]: pick(sorted[0]), [loName]: pick(sorted[sorted.length - 1]) };
};

// Largest positive and largest negative entry (a "rise" is never a fall).
const riseAndDrop = (list, key, riseName, dropName) => {
  const up = list.filter((x) => x[key] > 0).sort((a, b) => b[key] - a[key])[0];
  const down = list.filter((x) => x[key] < 0).sort((a, b) => a[key] - b[key])[0];
  return {
    ...(up && { [riseName]: { period: up.period, [key]: up[key] } }),
    ...(down && { [dropName]: { period: down.period, [key]: down[key] } }),
  };
};

// One row's values per period, in order.
const seriesOf = (view, r) =>
  view.periodKeys.map((p) => {
    if (!view.isComparison) return { period: p, revenue: valueAt(view, r, p) };
    const c = r?.comparisons?.[p];
    const current = num(c?.current_revenue);
    const compare = num(c?.compare_revenue);
    return {
      period: p,
      compare_period: c?.compare_period ?? null,
      current,
      compare,
      variance: num(c?.variance) ?? (current !== null && compare !== null ? round2(current - compare) : null),
      pct_change: num(c?.pct_change_revenue),
    };
  });

const withMoves = (series) => {
  const valid = series.filter((x) => x.revenue !== null);
  return valid.map((x, i) => ({
    ...x,
    change_vs_previous_period: i ? round2(x.revenue - valid[i - 1].revenue) : null,
  }));
};

const monthlyTrendFacts = (series) => {
  const valid = withMoves(series);
  if (!valid.length) return undefined;
  const first = valid[0];
  const last = valid[valid.length - 1];
  const zero = valid.filter((x) => x.revenue === 0).map((x) => x.period);
  return {
    average_per_period: round2(sumOf(valid, (x) => x.revenue) / valid.length),
    ...extremes(valid, "revenue", "highest_period", "lowest_period"),
    ...riseAndDrop(valid, "change_vs_previous_period", "largest_rise_vs_previous_period", "largest_drop_vs_previous_period"),
    ...(valid.length > 1 && {
      first_to_last_period: `${first.period} → ${last.period}`,
      first_to_last_period_change: round2(last.revenue - first.revenue),
    }),
    ...(zero.length && { periods_with_zero_revenue: zero }),
  };
};

const comparisonTrendFacts = (series) => {
  const totalCompare = sumOf(series, (x) => x.compare);
  const totalVariance = sumOf(series, (x) => x.variance);
  return {
    total_current: sumOf(series, (x) => x.current),
    total_compare: totalCompare,
    total_variance: totalVariance,
    total_pct_change: pctOf(totalVariance, Math.abs(totalCompare)),
    periods_up: series.filter((x) => x.variance > 0).map((x) => x.period),
    periods_down: series.filter((x) => x.variance < 0).map((x) => x.period),
    ...riseAndDrop(series, "variance", "largest_increase", "largest_decrease"),
  };
};

const trendFactsOf = (view, series) =>
  view.isComparison ? comparisonTrendFacts(series) : monthlyTrendFacts(series);

/* ══════════ Shared context pieces ══════════ */

const notesFor = (view, lead) =>
  [
    lead,
    view.splitBy.length
      ? `Rows are customers split by ${view.splitBy.join(", ")}, so one customer can appear in several rows; rank and share are per row.`
      : "Rows are customers.",
    view.isComparison &&
      "Comparison view: current = the period's revenue, compare = the compare period's revenue, variance = current − compare, pct_change = variance ÷ compare × 100.",
  ]
    .filter(Boolean)
    .join(" ");

const ANALYSIS_NOTES_LEAD =
  "Figures are revenue in USD; higher revenue is favorable. Share percentages are of total revenue in the view. " +
  "contribution_to_total_change_pct = the row's change ÷ the total's change × 100 (negative means it moved against the total).";

const periodTotalsOf = (view) =>
  view.periodKeys.map((p) => {
    if (!view.isComparison) return { period: p, revenue: periodTotal(view, p) };
    const t = periodTotalsPair(view, p);
    return { period: p, compare_period: t.compare_period, current: t.current, compare: t.previous, variance: t.change };
  });

const rankEntry = (view, total) => (r, i) => ({
  rank: i + 1,
  customer: view.rowLabel(r),
  revenue: rowTotal(r),
  share_of_total_pct: pctOf(rowTotal(r), total),
});

// Ranked rows from index `from` to `to` (exclusive) as rank entries.
const rankSlice = (ranked, toEntry, from, to) => {
  const start = Math.max(0, from);
  return ranked.slice(start, to).map((r, j) => toEntry(r, start + j));
};

const scaleNote = (view) => (view.valueScale !== "Actual" ? `Values in ${view.valueScale.toLowerCase()}` : undefined);

// Supporting table: one row's revenue by period.
const seriesTable = (view, r, series) =>
  series.length
    ? {
        title: `${view.rowLabel(r)} — revenue by period`,
        columns: view.isComparison
          ? [
              { key: "period", label: "Period" },
              { key: "compare_period", label: "Compared with" },
              { key: "current", label: "Current", type: "money" },
              { key: "compare", label: "Compare", type: "money" },
              { key: "variance", label: "Variance", type: "money", signed: true },
              { key: "pct_change", label: "%", type: "pct", signed: true },
            ]
          : [
              { key: "period", label: "Period" },
              { key: "revenue", label: "Revenue", type: "money" },
              { key: "change_vs_previous_period", label: "Change", type: "money", signed: true },
            ],
        rows: view.isComparison ? series : withMoves(series),
        note: scaleNote(view),
      }
    : null;

// Supporting table: the rows that moved most in period p.
const moversTable = (view, p, movers) => {
  if (!movers.length) return null;
  const t = periodTotalsPair(view, p);
  const against = view.isComparison ? t.compare_period || "compare period" : t.previous_period;
  return {
    title: `Top movers — ${p} vs ${against}`,
    columns: [
      { key: "customer", label: "Customer" },
      { key: "current", label: p, type: "money" },
      { key: "previous", label: against, type: "money" },
      { key: "change", label: "Change", type: "money", signed: true },
    ],
    rows: movers,
    note: scaleNote(view),
  };
};

/* ══════════ Row commentary ("Refine with AI") ══════════ */

/** JSON context for one customer row's explanation + recommendation. */
export const buildRevenueLineItemContext = (view, row) => {
  if (!row) return "";
  const total = grandTotalOf(view);
  const ranked = rankRows(view.rows);
  const idx = ranked.indexOf(row);
  const series = seriesOf(view, row);
  const toEntry = rankEntry(view, total);
  const customers = new Set(view.rows.map((r) => r?.customer_name || "Unknown"));

  return JSON.stringify(
    compactForAI({
      report: "Revenue Report",
      view: view.tableView,
      value_scale: view.valueScale,
      notes: notesFor(
        view,
        "Figures are revenue in USD for this customer; higher revenue is favorable. Share is of total revenue in the view.",
      ),
      line_item: view.rowLabel(row),
      ...(view.isComparison ? { period_comparisons: series } : { period_revenues: series }),
      line_facts: {
        total: rowTotal(row),
        share_of_total_pct: pctOf(rowTotal(row), total),
        rank: idx + 1,
        ranked_out_of: ranked.length,
        ...trendFactsOf(view, series),
      },
      portfolio: {
        total_revenue: total,
        customer_count: customers.size,
        ...(customers.size !== view.rows.length && { row_count: view.rows.length }),
        period_totals: periodTotalsOf(view),
        top_5_customers: ranked.slice(0, 5).map(toEntry),
        neighbours_in_ranking: rankSlice(ranked, toEntry, idx - 2, idx + 3).filter((e) => e.rank !== idx + 1),
      },
    }),
  );
};

/* ══════════ ✦ Explain this number ══════════ */

const analysisJSON = (view, computedFacts) =>
  JSON.stringify(
    compactForAI({
      table_view: view.tableView,
      table_value_scale: view.valueScale,
      notes: notesFor(view, ANALYSIS_NOTES_LEAD),
      computed_facts: computedFacts,
    }),
  );

// A period cell (normal table): vs previous period, share and rank in the
// period, and the customer's part in the whole period's move.
const periodCellContext = (view, row, p) => {
  const series = seriesOf(view, row);
  const value = valueAt(view, row, p);
  const own = changeGetter(view, p)?.(row) ?? null;
  const totals = periodTotalsPair(view, p);
  const inPeriod = [...view.rows].sort((a, b) => (valueAt(view, b, p) ?? 0) - (valueAt(view, a, p) ?? 0));
  const movers = moversIn(view, p, 8);

  const facts = {
    customer: view.rowLabel(row),
    period: p,
    value,
    share_of_period_total_pct: pctOf(value, totals.current),
    rank_in_period: inPeriod.indexOf(row) + 1,
    ranked_out_of: inPeriod.length,
    period_total: totals.current,
    ...(own
      ? {
          previous_period: totals.previous_period,
          previous_period_value: own.previous,
          change_vs_previous_period: own.change,
          change_vs_previous_period_pct: pctOf(own.change, Math.abs(own.previous)),
          previous_period_total: totals.previous,
          period_total_change: totals.change,
          period_total_change_pct: pctOf(totals.change, Math.abs(totals.previous)),
          contribution_to_total_change_pct: pctOf(own.change, totals.change),
          top_movers_in_period: movers.slice(0, 5),
        }
      : { note: "This is the first period in the view, so there is no previous period to compare with." }),
    customer_trend: { period_revenues: series, ...monthlyTrendFacts(series) },
  };

  return {
    context: analysisJSON(view, facts),
    supporting: [seriesTable(view, row, series), moversTable(view, p, movers)].filter(Boolean),
  };
};

// The Revenue (total) cell: trend, best/worst period, share, rank and the gap
// to the neighbours in the ranking.
const totalCellContext = (view, row) => {
  const total = grandTotalOf(view);
  const ranked = rankRows(view.rows);
  const idx = ranked.indexOf(row);
  const value = rowTotal(row);
  const series = seriesOf(view, row);
  const toEntry = rankEntry(view, total);
  const above = idx > 0 ? ranked[idx - 1] : null;
  const below = idx < ranked.length - 1 ? ranked[idx + 1] : null;

  const facts = {
    customer: view.rowLabel(row),
    total_revenue: value,
    share_of_total_pct: pctOf(value, total),
    rank: idx + 1,
    ranked_out_of: ranked.length,
    total_revenue_all_customers: total,
    ...(above && {
      next_above: { customer: view.rowLabel(above), revenue: rowTotal(above), gap: round2(rowTotal(above) - value) },
    }),
    ...(below && {
      next_below: { customer: view.rowLabel(below), revenue: rowTotal(below), gap: round2(value - rowTotal(below)) },
    }),
    ...(idx > 0 && { top_customer: toEntry(ranked[0], 0) }),
    ...(series.length && { trend: { periods: series, ...trendFactsOf(view, series) } }),
  };

  const neighbours = rankSlice(ranked, toEntry, idx - 3, idx + 4);
  return {
    context: analysisJSON(view, facts),
    supporting: [
      seriesTable(view, row, series),
      {
        title: "Ranking around this customer",
        columns: [
          { key: "rank", label: "Rank" },
          { key: "customer", label: "Customer" },
          { key: "revenue", label: "Revenue", type: "money" },
          { key: "share_of_total_pct", label: "Share", type: "pct" },
        ],
        rows: neighbours,
        note: scaleNote(view),
      },
    ].filter(Boolean),
  };
};

// A comparison variance cell: current vs compare, contribution to the
// period's total change, and the other customers that moved most.
const varianceCellContext = (view, row, p) => {
  const series = seriesOf(view, row);
  const point = series.find((x) => x.period === p) || {};
  const totals = periodTotalsPair(view, p);
  const byChange = moversIn(view, p, view.rows.length);
  const movers = byChange.slice(0, 8);
  const label = view.rowLabel(row);

  const facts = {
    customer: label,
    period: p,
    compare_period: point.compare_period ?? totals.compare_period,
    current: point.current,
    compare: point.compare,
    variance: point.variance,
    pct_change: point.pct_change ?? pctOf(point.variance, Math.abs(point.compare)),
    share_of_period_total_pct: pctOf(point.current, totals.current),
    period_total_current: totals.current,
    period_total_compare: totals.previous,
    period_total_change: totals.change,
    period_total_change_pct: pctOf(totals.change, Math.abs(totals.previous)),
    contribution_to_total_change_pct: pctOf(point.variance, totals.change),
    ...(point.variance && {
      rank_by_size_of_change_in_period: byChange.findIndex((m) => m.customer === label) + 1,
      rows_that_changed_in_period: byChange.length,
    }),
    other_customers_that_moved_most: moversIn(view, p, 5, row).map((m) => ({
      ...m,
      contribution_to_total_change_pct: pctOf(m.change, totals.change),
    })),
    customer_trend: { period_comparisons: series, ...comparisonTrendFacts(series) },
  };

  return {
    context: analysisJSON(view, facts),
    supporting: [seriesTable(view, row, series), moversTable(view, p, movers)].filter(Boolean),
  };
};

const KPI_DEFINITIONS = {
  total_revenue: "Sum of revenue across all rows in the view.",
  highest_revenue: "The largest single row's total revenue.",
  lowest_revenue: "The smallest single row's total revenue.",
  average_revenue: "Total revenue ÷ number of rows.",
};

// A Key Revenue Metric: top customers & concentration, per-period totals,
// the latest period's movers, and which rows the KPI points at.
const kpiContext = (view, target) => {
  const total = grandTotalOf(view);
  const ranked = rankRows(view.rows);
  const toEntry = rankEntry(view, total);

  // Concentration is per customer (split rows rolled up).
  const byCustomer = new Map();
  view.rows.forEach((r) => {
    const name = r?.customer_name || "Unknown";
    byCustomer.set(name, (byCustomer.get(name) || 0) + rowTotal(r));
  });
  const customers = [...byCustomer]
    .map(([customer, revenue]) => ({ customer, revenue: round2(revenue), share_of_total_pct: pctOf(revenue, total) }))
    .sort((a, b) => b.revenue - a.revenue);
  const top10 = customers.slice(0, 10);

  const periodTotals = periodTotalsOf(view);
  const latest = [...periodTotals]
    .reverse()
    .find((x) => (view.isComparison ? x.current || x.compare : x.revenue) && changeGetter(view, x.period));
  const movers = latest ? moversIn(view, latest.period, 8) : [];
  const latestPair = latest ? periodTotalsPair(view, latest.period) : null;

  const kpiFacts = {};
  if (target.metric === "highest_revenue") {
    kpiFacts.highest_rows = ranked.slice(0, 3).map(toEntry);
    if (ranked.length > 1) kpiFacts.gap_first_to_second = round2(rowTotal(ranked[0]) - rowTotal(ranked[1]));
  } else if (target.metric === "lowest_revenue") {
    kpiFacts.lowest_rows = rankSlice(ranked, toEntry, ranked.length - 3, ranked.length).reverse();
    kpiFacts.rows_with_zero_or_negative_revenue = view.rows.filter((r) => rowTotal(r) <= 0).length;
  } else if (target.metric === "average_revenue") {
    const avg = view.rows.length ? round2(total / view.rows.length) : null;
    const mid = Math.floor(ranked.length / 2);
    kpiFacts.average_per_row = avg;
    kpiFacts.median_row_revenue = ranked.length
      ? ranked.length % 2
        ? rowTotal(ranked[mid])
        : round2((rowTotal(ranked[mid - 1]) + rowTotal(ranked[mid])) / 2)
      : null;
    kpiFacts.rows_above_average = view.rows.filter((r) => rowTotal(r) > avg).length;
    kpiFacts.rows_closest_to_average = ranked
      .map(toEntry)
      .sort((a, b) => Math.abs(a.revenue - avg) - Math.abs(b.revenue - avg))
      .slice(0, 3);
  }

  const facts = {
    kpi: target.title,
    kpi_value_on_screen: target.value,
    kpi_definition: KPI_DEFINITIONS[target.metric],
    ...kpiFacts,
    total_revenue: total,
    customer_count: customers.length,
    ...(customers.length !== view.rows.length && { row_count: view.rows.length }),
    top_10_customers_share_pct: pctOf(sumOf(top10, (c) => c.revenue), total),
    top_5_customers: customers.slice(0, 5),
    period_totals: periodTotals,
    ...(latestPair && {
      latest_period: latest.period,
      latest_period_compared_with: view.isComparison ? latestPair.compare_period : latestPair.previous_period,
      latest_period_total_change: latestPair.change,
      latest_period_total_change_pct: pctOf(latestPair.change, Math.abs(latestPair.previous)),
      largest_movers_latest_period: movers.slice(0, 5).map((m) => ({
        ...m,
        contribution_to_total_change_pct: pctOf(m.change, latestPair.change),
      })),
    }),
  };

  const note = scaleNote(view);
  const supporting = [
    {
      title: "Top customers by revenue",
      columns: [
        { key: "customer", label: "Customer" },
        { key: "revenue", label: "Revenue", type: "money" },
        { key: "share_of_total_pct", label: "Share", type: "pct" },
      ],
      rows: top10,
      note,
    },
    periodTotals.length && {
      title: "Revenue by period",
      columns: view.isComparison
        ? [
            { key: "period", label: "Period" },
            { key: "compare_period", label: "Compared with" },
            { key: "current", label: "Current", type: "money" },
            { key: "compare", label: "Compare", type: "money" },
            { key: "variance", label: "Variance", type: "money", signed: true },
          ]
        : [
            { key: "period", label: "Period" },
            { key: "revenue", label: "Revenue", type: "money" },
          ],
      rows: periodTotals,
      note,
    },
    latest ? moversTable(view, latest.period, movers) : null,
  ].filter(Boolean);

  return { context: analysisJSON(view, facts), supporting };
};

/**
 * ✦ context for a table value or a Key Revenue Metric.
 *   target: { kind: "cell", rowKey, period (null = the Revenue total), mode }
 *           or { kind: "kpi", metric, title, value }
 *   row:    the table row for target.rowKey (cells only)
 */
export const buildRevenueAnalysisContext = (view, target, row) => {
  if (target.kind === "kpi") return kpiContext(view, target);
  if (!row) throw new Error("This row is no longer in the report view. Close this panel and try again.");
  if (target.mode === "comparison") return varianceCellContext(view, row, target.period);
  if (target.period) return periodCellContext(view, row, target.period);
  return totalCellContext(view, row);
};
