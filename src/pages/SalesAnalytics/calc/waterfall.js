/**
 * Floating-waterfall rows for a stacked bar chart: an invisible `base` bar
 * under a visible `value` bar. Totals stand on zero; effects float from the
 * running total. `display` is the label printed on the bar.
 */
export function toWaterfallRows(steps, formatAmount = String) {
  let running = 0;
  return (steps || []).map((s) => {
    const amount = Number(s.amount) || 0;
    if (s.type === "total") {
      running = amount;
      return { key: s.key, label: s.label, base: Math.min(0, amount), value: Math.abs(amount), amount, kind: "total", display: formatAmount(amount) };
    }
    const base = amount >= 0 ? running : running + amount;
    running += amount;
    return {
      key: s.key,
      label: s.label,
      base,
      value: Math.abs(amount),
      amount,
      kind: amount >= 0 ? "up" : "down",
      display: `${amount > 0 ? "+" : ""}${formatAmount(amount)}`,
    };
  });
}
