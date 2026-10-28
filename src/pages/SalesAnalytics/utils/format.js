// Display formatting for Sales Performance Analytics (sample data is USD).

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

export const money = (v, { compact: c = false, symbol = "$", decimals = 0 } = {}) => {
  if (!isNum(v)) return "—";
  if (c) return `${v < 0 ? "-" : ""}${symbol}${compactNumber(Math.abs(v))}`;
  return `${v < 0 ? "-" : ""}${symbol}${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
};

export const compactNumber = (v) => {
  if (!isNum(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(a >= 1e8 ? 0 : 2)}M`;
  if (a >= 1e4) return `${(v / 1e3).toFixed(0)}K`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return `${Math.round(v)}`;
};

export const compactMoney = (v) => money(v, { compact: true });

export const pct = (v, decimals = 1) => (isNum(v) ? `${v.toFixed(decimals)}%` : "—");
export const pp = (v, decimals = 1) => (isNum(v) ? `${v > 0 ? "+" : ""}${v.toFixed(decimals)} pp` : "—");
export const rate = (v) => (isNum(v) ? `$${v.toFixed(2)}/hr` : "—");
export const hours = (v) => (isNum(v) ? `${Math.round(v).toLocaleString("en-US")} hrs` : "—");
export const count = (v, decimals = 0) => (isNum(v) ? v.toLocaleString("en-US", { maximumFractionDigits: decimals }) : "—");
export const ratio = (v, decimals = 2) => (isNum(v) ? `${v.toFixed(decimals)}×` : "—");
export const days = (v) => (isNum(v) ? `${Math.round(v)} days` : "—");

export const signed = (v, fmt) => (isNum(v) ? `${v > 0 ? "+" : v < 0 ? "-" : ""}${fmt(Math.abs(v))}` : "—");
export const signedMoney = (v, opts) => signed(v, (x) => money(x, opts));
export const signedPct = (v, decimals = 1) => (isNum(v) ? `${v > 0 ? "+" : ""}${v.toFixed(decimals)}%` : "—");

/** Formats a value by unit: money | pct | count | hours | rate | ratio | days. */
export const byUnit = (v, unit, { compact: c = false } = {}) => {
  switch (unit) {
    case "pct": return pct(v);
    case "pp": return pp(v);
    case "count": return count(v);
    case "hours": return c ? `${compactNumber(v)} hrs` : hours(v);
    case "rate": return rate(v);
    case "ratio": return ratio(v);
    case "days": return days(v);
    case "text": return v ?? "—";
    case "date": return v || "—";
    default: return money(v, { compact: c });
  }
};

/** Signed difference in the same unit (pp for percentages). */
export const deltaByUnit = (v, unit) => {
  switch (unit) {
    case "pct": return pp(v);
    case "count": return signed(v, (x) => count(x, 1));
    case "hours": return signed(v, (x) => hours(x));
    case "rate": return signed(v, (x) => rate(x));
    case "ratio": return signed(v, (x) => ratio(x));
    default: return signedMoney(v, { compact: true });
  }
};
