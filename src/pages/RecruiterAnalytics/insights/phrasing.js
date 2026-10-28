// Shared wording for rule-based insights. Insight text explains what a
// number means and what to do about it; the figures themselves are on screen
// and in each insight's evidence table, so text avoids repeating them.

export const INSIGHT_CATEGORIES = {
  performance: { label: "Performance drivers", tone: "sky" },
  cost: { label: "Cost intelligence", tone: "amber" },
  effectiveness: { label: "Recruiting effectiveness", tone: "violet" },
  forecast: { label: "Forecast confidence", tone: "emerald" },
  staffing: { label: "Staffing & rates", tone: "sky" },
  pipeline: { label: "Pipeline & fills", tone: "violet" },
  people: { label: "People", tone: "emerald" },
};

/** "well ahead of" / "slightly behind" … for a percentage gap. */
export const gapWords = (pct) => {
  if (pct == null) return "in line with";
  const a = Math.abs(pct);
  const dir = pct >= 0 ? "ahead of" : "behind";
  if (a < 1) return "in line with";
  if (a < 3) return `slightly ${dir}`;
  if (a < 8) return dir;
  return `well ${dir}`;
};

export const growthWords = (pct) => {
  if (pct == null) return "unchanged";
  const a = Math.abs(pct);
  if (a < 2) return "broadly flat";
  if (pct > 0) return a > 15 ? "growing sharply" : "growing";
  return a > 15 ? "falling sharply" : "falling";
};

export const pctChange = (cur, base) => (base ? ((cur - base) / Math.abs(base)) * 100 : null);

export const listNames = (names, max = 3) => {
  const n = names.filter(Boolean).slice(0, max);
  if (n.length <= 1) return n[0] || "";
  return `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`;
};

/** One insight. `section` is the KPI section it is shown inside. */
export const insight = ({ id, section, category, severity = "neutral", title, meaning, actions = [], evidence = null, whatIf = null }) => ({
  id, section, category, severity, title, meaning, actions, evidence, whatIf,
});
