// Builds the "report data as displayed" context that a report's AI Insights
// drawer (ReportAIInsights → POST /ai/report-insights/generate) sends to the
// backend.

// The backend truncates context past 14,000 characters; stay under it so a
// large report is trimmed by whole rows (with a note) rather than mid-JSON.
const MAX_CONTEXT_CHARS = 12000;

// Shrinks report data for the AI prompt: turns "4,181,468.76" strings into real
// numbers, rounds them and drops empty values and empty nested objects.
export const compactForAI = (value) => {
  if (typeof value === "string" && /^-?[\d,]+(\.\d+)?$/.test(value.trim())) {
    return Math.round(Number(value.replace(/,/g, "")) * 100) / 100;
  }
  if (typeof value === "number") return Math.round(value * 100) / 100;
  if (Array.isArray(value)) return value.map(compactForAI);
  if (value && typeof value === "object") {
    const out = {};
    Object.entries(value).forEach(([k, v]) => {
      if (v === null || v === undefined || v === "") return;
      if (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length) return;
      out[k] = compactForAI(v);
    });
    return out;
  }
  return value;
};

// A value as shown ("1,234.50", "1.2M", "$-3.4", "12%") -> number in the
// on-screen scale, or null when it isn't a number.
export const toNumberForAI = (v) => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  const n = Number(String(v).replace(/[$,%\s]/g, "").replace(/[KMLB]$/i, ""));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

// Highest / lowest `n` entries by a value — computed in code so the AI doesn't
// have to rank rows itself (it gets rankings wrong).
export const rankForAI = (list, getValue, getLabel, n = 3) => {
  const valid = (list || [])
    .map((x) => ({ name: getLabel(x), value: toNumberForAI(getValue(x)) }))
    .filter((x) => x.value !== null);
  if (!valid.length) return null;
  const sorted = [...valid].sort((a, b) => b.value - a.value);
  return { highest: sorted.slice(0, n), lowest: sorted.slice(-n).reverse() };
};

/**
 * JSON context for a report's AI Insights drawer.
 *   valueScale  "Actual" / "Thousands" / "Millions" — the scale of the figures
 *   notes       what the figures mean: units (e.g. counts, not money), sign
 *               conventions, how a total is built — the AI follows these
 *   keyMetrics  the report's headline metrics
 *   facts       rankings/extremes computed in code (see rankForAI)
 *   rows        the table rows as displayed; trimmed from the end (with a
 *               note) if the context would be too long, so pass large reports
 *               pre-sorted by importance
 * Returns "" when there is nothing to analyze.
 */
export const buildReportAIContext = ({ valueScale, notes, keyMetrics, facts, rows = [] }) => {
  if (!rows.length && !keyMetrics) return "";
  const base = compactForAI({
    value_scale: valueScale,
    notes,
    key_metrics: keyMetrics,
    verified_facts: facts,
  });
  let shown = compactForAI(rows);
  let json = JSON.stringify({ ...base, rows: shown });
  while (json.length > MAX_CONTEXT_CHARS && shown.length > 1) {
    shown = shown.slice(0, Math.max(1, Math.floor(shown.length * 0.75)));
    json = JSON.stringify({
      ...base,
      rows: shown,
      rows_note: `Only the first ${shown.length} of ${rows.length} rows are included; key_metrics and verified_facts cover all rows.`,
    });
  }
  return json;
};
