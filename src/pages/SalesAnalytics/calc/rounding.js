/**
 * Rounds each value to `decimals` while keeping the rounded parts adding up to
 * the rounded total (largest-remainder method) — so a bridge's displayed steps
 * always sum to the displayed variance.
 */
export function roundPreservingSum(values, decimals = 0) {
  const f = 10 ** decimals;
  const scaled = values.map((v) => v * f);
  const target = Math.round(scaled.reduce((s, v) => s + v, 0));
  const floors = scaled.map(Math.floor);
  let short = target - floors.reduce((s, v) => s + v, 0);
  const order = scaled
    .map((v, i) => ({ i, rem: v - Math.floor(v) }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  const out = [...floors];
  for (let k = 0; short > 0 && k < order.length; k++, short--) out[order[k].i] += 1;
  for (let k = order.length - 1; short < 0 && k >= 0; k--, short++) out[order[k].i] -= 1;
  return out.map((v) => v / f);
}
