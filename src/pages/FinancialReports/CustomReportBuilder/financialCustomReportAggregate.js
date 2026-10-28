import { formatCurrencyValue, formatNumber } from "../../../utils/formatters";
import { FINANCIAL_CUSTOM_REPORT_FIELD_DEFS } from "./financialCustomReportFields";

const FIELD_DEF = Object.fromEntries(FINANCIAL_CUSTOM_REPORT_FIELD_DEFS.map((f) => [f.field, f]));

export function formatPercent(value) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return `${Number(value).toFixed(1)}%`;
}

// `metricFormats` maps field -> "currency" (default) | "count" | "percent".
export function formatMetricValue(value, format) {
  if (value == null) return "—";
  if (format === "count") return formatNumber(value, 0);
  if (format === "percent") return formatPercent(value);
  return formatCurrencyValue(value);
}

function reduceGroup(sums, mins, maxs, count, metrics, aggFunc) {
  const out = {};
  metrics.forEach((m) => {
    if (aggFunc === "avg") out[m] = count ? sums[m] / count : 0;
    else if (aggFunc === "count") out[m] = count;
    else if (aggFunc === "min") out[m] = count ? mins[m] : 0;
    else if (aggFunc === "max") out[m] = count ? maxs[m] : 0;
    else out[m] = sums[m];
  });
  return out;
}

// Expands the user-requested metric list into the full set of additive
// components that must actually be summed — a "ratio" metric (e.g.
// Rate/Price = Revenue ÷ Volume) isn't itself a column in the raw rows, so
// its numerator/denominator are pulled in here even if the user didn't
// separately check them as visible columns. "share" metrics (e.g. Mix) are
// precomputed per-row by attachShareMetrics before aggregation, so by the
// time this runs they're plain additive fields like any other.
function additiveComponentsFor(metrics) {
  const set = new Set();
  metrics.forEach((m) => {
    const def = FIELD_DEF[m];
    if (def?.aggregation === "ratio") {
      set.add(def.numerator);
      set.add(def.denominator);
    } else {
      set.add(m);
    }
  });
  return [...set];
}

// Fills in "ratio" metrics on an already-summed group output — always
// derived from the SUM of their components regardless of the report's
// chosen agg_func (an "average of a ratio" isn't a meaningful financial
// figure; a blended rate is always sum ÷ sum, same convention PnL/Revenue
// reports already use for things like average price).
function deriveRatioMetrics(out, metrics, componentSums) {
  metrics.forEach((m) => {
    const def = FIELD_DEF[m];
    if (def?.aggregation !== "ratio") return;
    const num = Number(componentSums[def.numerator]) || 0;
    const den = Number(componentSums[def.denominator]) || 0;
    const raw = den !== 0 ? num / den : 0;
    out[m] = def.percentRatio ? raw * 100 : raw;
  });
}

// Precomputes "share" metrics (e.g. Mix: this row's Revenue as % of total
// Revenue) over the full filtered row set, before any grouping — the
// "total" a share is relative to is the entire currently filtered dataset,
// which only the caller (CustomReportBuilder.jsx) knows. Each row gets its
// own share, which is what lets it aggregate correctly under any grouping:
// SUM(each row's share) over a group == that group's true share of the
// total, the same trick the original Rate field used for Volume.
export function attachShareMetrics(rows, metrics) {
  const shareMetrics = metrics.filter((m) => FIELD_DEF[m]?.aggregation === "share");
  if (shareMetrics.length === 0) return rows;
  const totals = {};
  shareMetrics.forEach((m) => {
    const base = FIELD_DEF[m].shareOf;
    totals[m] = rows.reduce((sum, r) => sum + (Number(r[base]) || 0), 0);
  });
  return rows.map((row) => {
    const extra = {};
    shareMetrics.forEach((m) => {
      const base = FIELD_DEF[m].shareOf;
      extra[m] = totals[m] > 0 ? ((Number(row[base]) || 0) / totals[m]) * 100 : 0;
    });
    return { ...row, ...extra };
  });
}

// Flat, fully-aggregated rows — one row per unique combination of
// `dimensions`, mirroring the backend's pandas groupby (see
// financial/controller.py's _aggregate_custom_report_rows, used by the
// saved-view CSV/Excel export / scheduled email) so what's shown on screen
// matches what gets exported.
//
// A real company's raw row set can run into the tens of thousands, so this
// keeps a running sum/min/max/count per group in a single pass instead of
// buffering every row into its group and re-scanning per metric afterward
// (that buffer-then-map approach was the main cause of the UI hanging
// while switching dimensions/metrics on a real dataset).
export function aggregateRows(rows, dimensions, metrics, aggFunc) {
  const components = additiveComponentsFor(metrics);
  const groups = new Map();
  const order = [];

  for (const row of rows) {
    const dims = dimensions.map((d) => row[d]);
    const key = dims.join("␟");
    let group = groups.get(key);
    if (!group) {
      const sums = {};
      const mins = {};
      const maxs = {};
      components.forEach((m) => {
        sums[m] = 0;
        mins[m] = Infinity;
        maxs[m] = -Infinity;
      });
      group = { dims, sums, mins, maxs, count: 0 };
      groups.set(key, group);
      order.push(key);
    }
    group.count++;
    for (const m of components) {
      const v = Number(row[m]) || 0;
      group.sums[m] += v;
      if (v < group.mins[m]) group.mins[m] = v;
      if (v > group.maxs[m]) group.maxs[m] = v;
    }
  }

  return order.map((key) => {
    const group = groups.get(key);
    const out = reduceGroup(group.sums, group.mins, group.maxs, group.count, components, aggFunc);
    deriveRatioMetrics(out, metrics, out);
    dimensions.forEach((d, i) => {
      out[d] = group.dims[i];
    });
    return out;
  });
}

// A single-group total (e.g. the Grand Total row, or one hierarchy node's
// subtotal) over a potentially large raw row set — a plain accumulator pass
// instead of routing through aggregateRows' Map-based groupBy, which would
// buffer every row plus one extra array per metric just to collapse them
// all into one group. Same agg_func semantics.
export function computeTotals(rows, metrics, aggFunc) {
  const components = additiveComponentsFor(metrics);
  const sums = {};
  const mins = {};
  const maxs = {};
  components.forEach((m) => {
    sums[m] = 0;
    mins[m] = Infinity;
    maxs[m] = -Infinity;
  });

  let count = 0;
  for (const row of rows) {
    count++;
    for (const m of components) {
      const v = Number(row[m]) || 0;
      sums[m] += v;
      if (v < mins[m]) mins[m] = v;
      if (v > maxs[m]) maxs[m] = v;
    }
  }

  const out = reduceGroup(sums, mins, maxs, count, components, aggFunc);
  deriveRatioMetrics(out, metrics, out);
  out.__rowCount = count;
  return out;
}

function partitionByField(rows, field) {
  const map = new Map();
  const order = [];
  for (const row of rows) {
    const key = row[field];
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key).push(row);
  }
  return order.map((key) => ({ key, rows: map.get(key) }));
}

// Builds a hierarchical grouping tree, one level per entry in `groupByFields`
// (capped at 3 by the Group By step UI), each node carrying its own
// subtotal (via computeTotals) and its `path` (the raw dimension values from
// the root down to this node) — `path` is what lets
// financialCustomReportCompare.js join a comparison dataset onto the same
// tree shape. Partitions the raw rows level-by-level (Map-based, one pass
// per level) rather than pre-aggregating and losing the member rows a
// deeper level would need, so a 3-level report costs O(3n), not O(n^2).
export function buildHierarchy(rows, groupByFields, metrics, aggFunc, level = 0, parentPath = []) {
  if (level >= groupByFields.length) return [];
  const field = groupByFields[level];
  const buckets = partitionByField(rows, field);

  return buckets.map(({ key, rows: memberRows }) => {
    const path = [...parentPath, key];
    const isLeaf = level === groupByFields.length - 1;
    return {
      key: String(key ?? "—"),
      label: String(key ?? "—"),
      field,
      level,
      path,
      metrics: computeTotals(memberRows, metrics, aggFunc),
      children: isLeaf ? [] : buildHierarchy(memberRows, groupByFields, metrics, aggFunc, level + 1, path),
      isLeaf,
      rowCount: memberRows.length,
      // Kept (as a reference, not a copy) so the table can derive a
      // per-month breakdown for the single-metric "pivot columns by month"
      // display mode without a second full aggregation pass. Harmless
      // memory-wise — these are the same row objects already held by the
      // page's `rows` state, just referenced again here.
      rows: memberRows,
    };
  });
}

// Sorts every level of a buildHierarchy() tree by a metric column, applied
// recursively so sibling order stays consistent no matter which levels are
// expanded — clicking a metric header sorts "each group's children by that
// metric", the same mental model the flat table's column-click sort used.
// Returns a new array (does not mutate `nodes`).
export function sortHierarchyNodes(nodes, metricKey, direction) {
  const sign = direction === "asc" ? 1 : -1;
  const sorted = [...nodes].sort((a, b) => (Number(a.metrics[metricKey]) - Number(b.metrics[metricKey])) * sign);
  return sorted.map((node) =>
    node.children && node.children.length
      ? { ...node, children: sortHierarchyNodes(node.children, metricKey, direction) }
      : node
  );
}
