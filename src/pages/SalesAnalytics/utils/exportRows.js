import { collectCommentary, csvWithCommentary, downloadCsv } from "../../FinancialReports/reportExport";
import { toCsvRows } from "../calc/table";

const round = (v) => (typeof v === "number" ? Math.round(v * 100) / 100 : v);

/** KPI tiles as CSV rows: section, metric, value and each comparison. */
export function kpiCsvRows(sections) {
  const rows = [["Section", "Metric", "Value", "Comparison", "Comparison value", "Variance", "Variance %", "Variance (pp)"]];
  for (const s of sections || []) {
    for (const t of s.tiles) {
      if (t.masked) {
        rows.push([s.title, t.label, "Restricted", "", "", "", "", ""]);
        continue;
      }
      if (!t.comparisons?.length) rows.push([s.title, t.label, round(t.value), "", "", "", "", ""]);
      for (const c of t.comparisons || []) {
        rows.push([s.title, t.label, round(t.value), c.label, round(c.value), round(c.abs ?? ""), round(c.pct ?? ""), round(c.pp ?? "")]);
      }
    }
  }
  return rows;
}

/** One CSV of several blocks (KPI rows, table rows…) with optional commentary below. */
export function exportPage({ filename, blocks, commentaryItems, includeCommentary, meta }) {
  const out = [];
  if (meta) {
    out.push([`Period: ${meta.period.label}`, `Compared with: ${meta.compareBasis}`, `Data as of: ${meta.asOf}`, `Scope: ${meta.scope.label}`, "Sample data (USD)"]);
    out.push([]);
  }
  blocks.forEach((b, i) => {
    if (i) out.push([]);
    if (b.title) out.push([b.title]);
    out.push(...(b.rows || toCsvRows(b.columns, b.data)));
  });
  const commentary = collectCommentary({
    reportItems: (commentaryItems || []).map((c) => ({ title: c.title, text: c.text, category: c.category, source: "analyst" })),
  });
  downloadCsv(csvWithCommentary(out, commentary, includeCommentary), filename);
}
