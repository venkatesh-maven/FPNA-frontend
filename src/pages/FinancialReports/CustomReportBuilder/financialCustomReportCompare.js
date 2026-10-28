import { aggregateRows } from "./financialCustomReportAggregate";

// Dimensions Compare With -> Budget can actually join against — budget data
// (fpna_landing.finance_budget_data) has no customer/product breakdown, only
// Entity/Department/CostCenter (see custom_report_budget_data in the
// backend). Offering Budget outside this set would silently show wrong
// (all-zero or mismatched) numbers, so the UI disables it instead.
export const BUDGET_COMPATIBLE_DIMENSIONS = new Set(["Entity", "Department", "CostCenter"]);
// Budget data is only bucketed into these three GL buckets — Compare With
// Budget only makes sense when the report's primary metric is one of them.
export const BUDGET_COMPATIBLE_METRICS = new Set(["Revenue", "CostOfGoodsSold", "OperatingExpense"]);

export function isBudgetComparisonAvailable(groupByFields, primaryMetric) {
  if (!primaryMetric || !BUDGET_COMPATIBLE_METRICS.has(primaryMetric)) return false;
  return groupByFields.every((f) => BUDGET_COMPATIBLE_DIMENSIONS.has(f));
}

// Forecast/Scenario compare (backend: custom_report_forecast_data) has NO
// dimensional breakdown at all (the forecast engine is company-wide only —
// see the endpoint's docstring) and only independently models Revenue
// (COGS/OpEx are a fixed 40/60 split of one combined "expenses" figure, not
// separately forecasted — presenting that split as real would be
// misleading). So unlike Budget, this isn't gated on Group By at all: any
// grouping is allowed, but the comparison only ever shows at the report's
// Grand Total (every per-group row naturally has no match to join against,
// same mechanism as an empty compareRows set elsewhere in this file).
export function isForecastComparisonAvailable(primaryMetric) {
  return primaryMetric === "Revenue";
}

// Forecast rows come back as [{Month, Revenue}, ...] with no other
// dimension fields — already the right shape for getComparisonRows-style
// consumers, so no separate mapper is needed the way Budget has one.

// Reshapes the /custom_report/budget/{year}/{currency} response (Entity/
// Department/CostCenter/Month + BudgetRevenue/BudgetCostOfGoodsSold/
// BudgetOperatingExpense) into the same field names the GL-based custom
// report rows use, so the rest of this module can treat a "budget compare"
// exactly like a "prior period compare" — one join path, not two.
export function mapBudgetRowsToMetricShape(budgetRows) {
  return budgetRows.map((r) => ({
    Entity: r.Entity,
    Department: r.Department,
    CostCenter: r.CostCenter,
    Month: r.Month,
    Revenue: r.BudgetRevenue,
    CostOfGoodsSold: r.BudgetCostOfGoodsSold,
    OperatingExpense: r.BudgetOperatingExpense,
  }));
}

// GL periods are "YYYY-MM" strings (matches gl.period from the backend), so
// lexicographic comparison also sorts them chronologically — no Date
// parsing needed anywhere below.
function shiftYYYYMM(period, monthsDelta) {
  const [y, m] = String(period).split("-").map(Number);
  const total = y * 12 + (m - 1) + monthsDelta;
  const newY = Math.floor(total / 12);
  const newM = (total % 12) + 1;
  return `${newY}-${String(newM).padStart(2, "0")}`;
}

function monthsBetween(startPeriod, endPeriod) {
  const [sy, sm] = startPeriod.split("-").map(Number);
  const [ey, em] = endPeriod.split("-").map(Number);
  return (ey * 12 + (em - 1)) - (sy * 12 + (sm - 1)) + 1;
}

// How many trailing months of a fiscal year one Display By "bucket" covers.
// fiscal_year/calendar_year/ytd/rolling_12 are handled by their own branches
// below (not this table) since each needs different row selection, not just
// a different trailing-month count.
const DISPLAY_BY_WINDOW_MONTHS = {
  month: 1,
  quarter: 3,
};

// Scopes `currentYearRows` down to the window Display By implies (e.g.
// "quarter" = the latest 3 fetched months), independent of any comparison —
// Display By governs what's shown even with Compare With set to "No
// Comparison". `priorYearRows` is only needed for "rolling_12" (the only
// option whose trailing window can reach back past the fetched fiscal
// year); pass [] when it isn't available or applicable. Returns the window
// bounds too, so callers (Prior Period/Year, or a Budget-row filter) can
// derive their own comparison window from the same anchor without
// recomputing it.
export function getCurrentWindow(displayBy, currentYearRows, priorYearRows = []) {
  const periodsPresent = currentYearRows.map((r) => r.Month).filter(Boolean).sort();
  if (periodsPresent.length === 0) {
    return { rows: currentYearRows, windowStart: null, windowEnd: null };
  }
  const windowEnd = periodsPresent[periodsPresent.length - 1];

  // Fiscal Year and Year to Date both mean "every actual GL period on
  // record for this fiscal year" — for actuals-only data there's no
  // "future" period to exclude from YTD, so the two always land on the same
  // figure here. That's not a bug: it's what "year to date" means once
  // there's nothing dated ahead of today left to add.
  if (displayBy === "fiscal_year" || displayBy === "ytd") {
    return { rows: currentYearRows, windowStart: periodsPresent[0], windowEnd };
  }

  // Rolling 12 Months: the trailing 12 months ending at the latest period
  // with data — unlike every other option, this can span the fiscal-year
  // boundary (e.g. latest data October 2025 -> window runs back to
  // November 2024), so it draws on `priorYearRows` too.
  if (displayBy === "rolling_12") {
    const windowStart = shiftYYYYMM(windowEnd, -11);
    const rows = [...currentYearRows, ...priorYearRows].filter((r) => r.Month >= windowStart && r.Month <= windowEnd);
    return { rows, windowStart, windowEnd };
  }

  // Calendar Year: Jan-Dec of the calendar year the latest period falls in.
  // For a fiscal year that starts in January this is identical to Fiscal
  // Year; for a non-January fiscal start it's the slice of THIS fetched
  // fiscal year that falls in the more recent calendar year (the rest of
  // that calendar year lives in the adjacent fiscal year fetch, which only
  // Rolling 12 Months reaches into here).
  if (displayBy === "calendar_year") {
    const calYear = windowEnd.slice(0, 4);
    const rows = currentYearRows.filter((r) => r.Month.startsWith(calYear));
    const calPeriods = rows.map((r) => r.Month).sort();
    return { rows, windowStart: calPeriods[0] || windowEnd, windowEnd };
  }

  const windowMonths = DISPLAY_BY_WINDOW_MONTHS[displayBy] || 1;
  const windowStart = shiftYYYYMM(windowEnd, -(windowMonths - 1));
  const rows = currentYearRows.filter((r) => r.Month >= windowStart && r.Month <= windowEnd);
  return { rows, windowStart, windowEnd };
}

// Given the current window's bounds, resolves the row set to compare
// against for Prior Period (the immediately preceding window of the same
// length, which may spill into `priorYearRows`) or Prior Year (the same
// window exactly one calendar year earlier).
export function getComparisonRows(compareWith, windowStart, windowEnd, currentYearRows, priorYearRows) {
  if (!windowStart || !windowEnd || compareWith === "none" || compareWith === "budget") return [];
  const pool = [...currentYearRows, ...priorYearRows];

  if (compareWith === "prior_year") {
    const priorStart = shiftYYYYMM(windowStart, -12);
    const priorEnd = shiftYYYYMM(windowEnd, -12);
    return pool.filter((r) => r.Month >= priorStart && r.Month <= priorEnd);
  }

  // prior_period
  const length = monthsBetween(windowStart, windowEnd);
  const priorEnd = shiftYYYYMM(windowStart, -1);
  const priorStart = shiftYYYYMM(priorEnd, -(length - 1));
  return pool.filter((r) => r.Month >= priorStart && r.Month <= priorEnd);
}

// Filters already-Budget-shaped rows (mapBudgetRowsToMetricShape output) to
// the current Display By window, so "Actual" and "Budget" are compared over
// the same period range.
export function filterBudgetRowsToWindow(budgetRows, windowStart, windowEnd) {
  if (!windowStart || !windowEnd) return budgetRows;
  return budgetRows.filter((r) => r.Month >= windowStart && r.Month <= windowEnd);
}

const PATH_SEP = "␟";
function pathKey(path) {
  return path.map((v) => String(v ?? "—")).join(PATH_SEP);
}

function buildComparisonLookup(compareRows, groupByFields, metrics, aggFunc) {
  const flat = aggregateRows(compareRows, groupByFields, metrics, aggFunc);
  const map = new Map();
  flat.forEach((row) => {
    const path = groupByFields.map((f) => row[f]);
    map.set(pathKey(path), row);
  });
  return map;
}

function attachRecursive(nodes, lookup, metrics) {
  nodes.forEach((node) => {
    if (node.isLeaf) {
      // No match (e.g. Forecast/Scenario compare, which has no per-group
      // breakdown at all — see isForecastComparisonAvailable) means "no
      // data for this row", not "compared against zero". Left as null so
      // variance/variancePercent below propagate the same "—" the Grand
      // Total already shows for an empty comparison set, instead of a
      // misleading variance-vs-zero.
      node.compare = lookup.get(pathKey(node.path)) || null;
    } else {
      attachRecursive(node.children, lookup, metrics);
      const anyChildHasData = node.children.some((c) => c.compare != null);
      node.compare = anyChildHasData
        ? metrics.reduce((acc, m) => {
            acc[m] = node.children.reduce((s, c) => s + (Number(c.compare?.[m]) || 0), 0);
            return acc;
          }, {})
        : null;
    }
    node.variance = {};
    node.variancePercent = {};
    metrics.forEach((m) => {
      const actual = Number(node.metrics[m]) || 0;
      if (node.compare == null) {
        node.variance[m] = null;
        node.variancePercent[m] = null;
        return;
      }
      const cmp = Number(node.compare[m]) || 0;
      node.variance[m] = actual - cmp;
      node.variancePercent[m] = cmp !== 0 ? ((actual - cmp) / Math.abs(cmp)) * 100 : null;
    });
  });
}

// Walks a buildHierarchy() tree, attaching `compare`/`variance`/
// `variancePercent` to every node (leaf nodes joined directly on their
// dimension path against `compareRows`; parent/subtotal nodes summed
// bottom-up from their children, since comparison values are additive).
// Mutates and returns `hierarchyRoot`.
export function attachComparison(hierarchyRoot, compareRows, groupByFields, metrics, aggFunc) {
  const lookup = buildComparisonLookup(compareRows, groupByFields, metrics, aggFunc);
  attachRecursive(hierarchyRoot, lookup, metrics);
  return hierarchyRoot;
}
