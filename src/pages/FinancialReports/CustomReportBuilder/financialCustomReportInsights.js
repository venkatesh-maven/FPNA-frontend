import { buildReportAIContext, compactForAI, rankForAI } from "../reportAIContext";
import { computeTotals, formatMetricValue, formatPercent } from "./financialCustomReportAggregate";
import { FINANCIAL_CUSTOM_REPORT_FIELD_DEFS } from "./financialCustomReportFields";

// Insights / Recommendation support for the Custom Report Builder's
// hierarchy table: a rule-based insight per row (computed from the numbers on
// screen), stable row keys for saved AI commentary, and the "data as
// displayed" context the AI endpoints read.

const FIELD_DEF = Object.fromEntries(FINANCIAL_CUSTOM_REPORT_FIELD_DEFS.map((f) => [f.field, f]));
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DIMENSION_PLURALS = {
  Entity: "entities",
  Department: "departments",
  CostCenter: "cost centers",
  Category: "categories",
  Customer: "customers",
  Product: "products",
};

// report_line_item_commentary.line_item is VARCHAR(100).
const MAX_KEY_LENGTH = 100;
const MAX_LINE_CONTEXT_CHARS = 12000;

const monthName = (period) => MONTH_NAMES[Number(String(period).split("-")[1]) - 1] || period;

const hashString = (s) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

// "R&D › Acme Corp" — the row's full path, which is what the row means.
export const nodeLabel = (node) => node.path.map((v) => String(v ?? "—")).join(" › ");

// Commentary key for a row: its path, shortened with a hash when it would
// overflow the column (deep paths of long customer/product names).
export const nodeKey = (node) => {
  const key = nodeLabel(node);
  return key.length <= MAX_KEY_LENGTH ? key : `${key.slice(0, MAX_KEY_LENGTH - 10)}~${hashString(key)}`;
};

// "Rate / Price (Revenue ÷ Volume)" -> "Rate / Price", for use mid-sentence.
const shortMetricLabel = (label) => String(label || "").replace(/\s*\(.*\)\s*$/, "");

// Shares only add up for plain summed metrics (not ratios, %-shares or avg/min/max/count).
const isSummable = (field, aggFunc) => aggFunc === "sum" && !FIELD_DEF[field]?.aggregation;

// Per-month value of `field` for one node, the same way the table's month
// columns compute it.
export const monthValues = (node, field) => {
  const byMonth = new Map();
  (node.rows || []).forEach((r) => {
    if (!r.Month) return;
    if (!byMonth.has(r.Month)) byMonth.set(r.Month, []);
    byMonth.get(r.Month).push(r);
  });
  return Object.fromEntries(
    [...byMonth.keys()].sort().map((m) => [m, computeTotals(byMonth.get(m), [field], "sum")[field]])
  );
};

// Walks the tree once, calling visit(node, parent, siblings).
const walk = (nodes, visit, parent = null) => {
  nodes.forEach((node) => {
    visit(node, parent, nodes);
    if (node.children?.length) walk(node.children, visit, node);
  });
};

// key -> { node, parent, siblings } over the full (unsorted, untrimmed) tree.
export const indexHierarchy = (hierarchy) => {
  const byKey = new Map();
  walk(hierarchy, (node, parent, siblings) => byKey.set(nodeKey(node), { node, parent, siblings }));
  return byKey;
};

// rankOf(node, siblings): 1 = highest `field` among its siblings. Each
// sibling list is sorted once, so ranking every row of a wide level stays cheap.
const makeRanker = (field) => {
  const cache = new WeakMap();
  return (node, siblings) => {
    let ranks = cache.get(siblings);
    if (!ranks) {
      const sorted = [...siblings].sort((a, b) => Number(b.metrics[field]) - Number(a.metrics[field]));
      ranks = new Map(sorted.map((n, i) => [n, i + 1]));
      cache.set(siblings, ranks);
    }
    return ranks.get(node);
  };
};

/**
 * Rule-based insight per row (key -> text): its share of its parent group,
 * rank among its siblings, change vs the comparison and (in the month view)
 * its best and worst months — all from the primary metric.
 */
export function buildNodeInsights({ hierarchy, metric, aggFunc, grandTotal, compareLabel, isMonthPivot }) {
  const out = new Map();
  if (!metric || !hierarchy?.length) return out;
  const { field, format } = metric;
  const label = shortMetricLabel(metric.label);
  const summable = isSummable(field, aggFunc);
  const overallVariancePct = grandTotal?.variancePercent?.[field];
  const rankOf = makeRanker(field);

  walk(hierarchy, (node, parent, siblings) => {
    const value = Number(node.metrics[field]);
    const parentValue = Number(parent ? parent.metrics[field] : grandTotal?.metrics?.[field]);
    const plural = DIMENSION_PLURALS[node.field] || "rows";
    const sentences = [];

    const facts = [];
    if (Number.isFinite(value) && value < 0 && format !== "percent") {
      facts.push(`Negative ${label} (${formatMetricValue(value, format)})`);
    } else if (summable && parentValue > 0 && Number.isFinite(value)) {
      const share = formatPercent((value / parentValue) * 100);
      facts.push(parent ? `${share} of ${label} in ${parent.label}` : `${share} of total ${label}`);
    }
    if (siblings.length > 1) {
      const rank = rankOf(node, siblings);
      const n = siblings.length;
      facts.push(
        rank === 1
          ? `the highest of ${n} ${plural}`
          : rank === n
          ? `the lowest of ${n} ${plural}`
          : `ranks ${rank} of ${n} ${plural}`
      );
    } else if (parent) {
      facts.push(`the only one under ${parent.label}`);
    }
    if (facts.length) {
      const text = facts.join(", ");
      sentences.push(`${text.charAt(0).toUpperCase()}${text.slice(1)}.`);
    }

    if (compareLabel) {
      const compare = node.compare?.[field];
      const variance = node.variance?.[field];
      const variancePct = node.variancePercent?.[field];
      if (compare == null) {
        sentences.push(`No ${compareLabel} figure to compare.`);
      } else if (variancePct != null && Number.isFinite(variancePct)) {
        const sign = variance >= 0 ? "+" : "";
        let s = `${variancePct >= 0 ? "Up" : "Down"} ${formatPercent(Math.abs(variancePct))} vs ${compareLabel} (${sign}${formatMetricValue(variance, format)})`;
        if (overallVariancePct != null && Number.isFinite(overallVariancePct) && (parent || siblings.length > 1)) {
          s += `, against ${overallVariancePct >= 0 ? "+" : ""}${formatPercent(overallVariancePct)} overall`;
        }
        sentences.push(`${s}.`);
      }
    }

    if (isMonthPivot) {
      const months = Object.entries(monthValues(node, field)).filter(([, v]) => Number.isFinite(Number(v)));
      if (months.length > 1) {
        const sorted = [...months].sort((a, b) => b[1] - a[1]);
        const [bestMonth, bestValue] = sorted[0];
        const [worstMonth, worstValue] = sorted[sorted.length - 1];
        if (bestValue !== worstValue) {
          sentences.push(
            `Peak in ${monthName(bestMonth)} (${formatMetricValue(bestValue, format)}), low in ${monthName(worstMonth)} (${formatMetricValue(worstValue, format)}).`
          );
        }
      }
    }

    out.set(nodeKey(node), sentences.join(" ") || "—");
  });
  return out;
}

// The figures of one node (or the grand total) keyed by on-screen column name.
const valuesOf = (source, { metricColumns, compareLabel }) => {
  if (!source) return {};
  const primary = metricColumns[0]?.field;
  const values = Object.fromEntries(metricColumns.map((m) => [m.label, source.metrics?.[m.field]]));
  if (compareLabel) {
    values[`${compareLabel} (${metricColumns[0]?.label})`] = source.compare?.[primary];
    values.variance = source.variance?.[primary];
    values.variance_pct = source.variancePercent?.[primary];
  }
  return values;
};

const reportNotes = ({ dimensionLabels, metricColumns, aggFunc, displayByLabel, compareLabel, isMonthPivot }) =>
  [
    `Custom report built from General Ledger data. Rows are grouped by ${dimensionLabels.join(" → ")}; a row's name is its full path (e.g. "A › B" is B within group A) and a group's figures include everything nested under it.`,
    `Columns: ${metricColumns.map((m) => m.label).join(", ")}. Aggregation: ${aggFunc}. Time window: ${displayByLabel}.`,
    metricColumns.some((m) => m.format === "count") && "Volume is a count of GL transaction lines, not money.",
    metricColumns.some((m) => m.format === "percent") && "Columns marked % are percentages, not money.",
    compareLabel &&
      `"${compareLabel} (…)" is the comparison figure for the first column; variance = current − ${compareLabel}; variance_pct = variance ÷ |${compareLabel}| × 100.`,
    isMonthPivot && "by_month gives the first column's value per month (YYYY-MM).",
  ]
    .filter(Boolean)
    .join(" ");

/**
 * Context for the Report AI Insights drawer and Ask AI: grand total, ranked
 * facts, then rows by importance (top-level groups first, largest first;
 * deeper levels after) so trimming drops the least important rows.
 */
export function buildCustomReportContext(opts) {
  const { hierarchy, grandTotal, metricColumns, compareLabel, isMonthPivot } = opts;
  if (!hierarchy?.length || !metricColumns.length) return "";
  const primary = metricColumns[0].field;
  const byPrimary = (a, b) => Math.abs(Number(b.metrics[primary])) - Math.abs(Number(a.metrics[primary]));

  const ordered = [];
  let level = [...hierarchy].sort(byPrimary);
  while (level.length) {
    ordered.push(...level);
    level = level.flatMap((n) => n.children || []).sort(byPrimary);
  }

  const toRow = (node) => ({
    row: nodeLabel(node),
    level: node.level,
    ...valuesOf(node, opts),
    ...(isMonthPivot && node.level === 0 && { by_month: monthValues(node, primary) }),
  });

  const top = hierarchy;
  const n = Math.min(5, Math.floor(top.length / 2));
  const total = Number(grandTotal?.metrics?.[primary]);
  const largest3 = [...top].sort((a, b) => Number(b.metrics[primary]) - Number(a.metrics[primary])).slice(0, 3);
  const facts = {
    top_level_group_count: top.length,
    [`top_level_by_${metricColumns[0].label}`]:
      top.length > 1 ? rankForAI(top, (x) => x.metrics[primary], (x) => x.label, n) : undefined,
    top_3_share_of_total_pct:
      isSummable(primary, opts.aggFunc) && total > 0 && top.length > 3
        ? (largest3.reduce((s, x) => s + Number(x.metrics[primary]), 0) / total) * 100
        : undefined,
    [`top_level_by_variance_vs_${compareLabel}`]:
      compareLabel && top.length > 1 ? rankForAI(top, (x) => x.variance?.[primary], (x) => x.label, n) : undefined,
  };

  return buildReportAIContext({
    valueScale: "Actual",
    notes: reportNotes(opts),
    keyMetrics: valuesOf(grandTotal, opts),
    facts,
    rows: [{ row: "Grand Total", ...valuesOf(grandTotal, opts) }, ...ordered.map(toRow)],
  });
}

/** Context for one row's "Refine with AI" commentary drawer. */
export function buildCustomRowContext(entry, opts) {
  if (!entry) return "";
  const { node, parent, siblings } = entry;
  const { metricColumns, grandTotal, aggFunc } = opts;
  const primary = metricColumns[0]?.field;
  if (!primary) return "";
  const parentValue = Number(parent ? parent.metrics[primary] : grandTotal?.metrics?.[primary]);
  const value = Number(node.metrics[primary]);
  const childRows = [...(node.children || [])]
    .sort((a, b) => Math.abs(Number(b.metrics[primary])) - Math.abs(Number(a.metrics[primary])))
    .map((c) => ({ row: c.label, ...valuesOf(c, opts) }));

  const payload = {
    notes: reportNotes(opts),
    row: nodeLabel(node),
    values: valuesOf(node, opts),
    share_of_parent_pct:
      isSummable(primary, aggFunc) && parentValue > 0 ? (value / parentValue) * 100 : undefined,
    rank_among_siblings: siblings.length > 1 ? `${makeRanker(primary)(node, siblings)} of ${siblings.length}` : undefined,
    parent: parent
      ? { row: nodeLabel(parent), ...valuesOf(parent, opts) }
      : { row: "Grand Total", ...valuesOf(grandTotal, opts) },
    siblings_ranked:
      siblings.length > 1 ? rankForAI(siblings, (x) => x.metrics[primary], (x) => x.label, 5) : undefined,
    by_month: monthValues(node, primary),
    children: childRows.length ? childRows : undefined,
  };

  let json = JSON.stringify(compactForAI(payload));
  while (json.length > MAX_LINE_CONTEXT_CHARS && payload.children?.length > 1) {
    payload.children = payload.children.slice(0, Math.floor(payload.children.length * 0.75));
    json = JSON.stringify(compactForAI(payload));
  }
  return json;
}

/** Ask AI question list for the report on screen. */
export function customReportQuestions({ dimensionLabels, metricColumns, compareLabel, isMonthPivot }) {
  const metric = shortMetricLabel(metricColumns[0]?.label) || "value";
  const dim = (dimensionLabels[0] || "group").toLowerCase();
  return [
    `Which ${dim} has the highest ${metric}?`,
    `Which ${dim} has the lowest ${metric}?`,
    `What is the total ${metric}?`,
    `How concentrated is ${metric} across the top groups?`,
    compareLabel && `Which rows changed the most versus ${compareLabel}?`,
    compareLabel && `What drove the overall variance versus ${compareLabel}?`,
    isMonthPivot && `How did ${metric} trend month over month?`,
    isMonthPivot && `Which month had the highest ${metric}?`,
    "What are the main risks or concerns in this report?",
    "What actions would you recommend based on this report?",
  ].filter(Boolean);
}
