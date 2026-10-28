/**
 * Actual against a comparison: absolute and percentage difference, and
 * whether the gap is good news (lower is better for costs).
 */
export function variance(actual, compare, { lowerIsBetter = false } = {}) {
  if (actual == null || compare == null || !Number.isFinite(actual) || !Number.isFinite(compare)) return null;
  const abs = actual - compare;
  const pct = compare !== 0 ? (abs / Math.abs(compare)) * 100 : null;
  return { abs, pct, favorable: abs === 0 ? null : (abs > 0) !== lowerIsBetter };
}

/** Margin change in percentage points. */
export function ppDelta(actualPct, comparePct) {
  if (actualPct == null || comparePct == null) return null;
  const pp = actualPct - comparePct;
  return { pp, favorable: pp === 0 ? null : pp > 0 };
}

export const safeDiv = (a, b) => (b ? a / b : null);
