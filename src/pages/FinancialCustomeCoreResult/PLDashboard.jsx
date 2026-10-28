import React, { useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { FiFilter, FiTrendingUp, FiTrendingDown, FiMinus } from "react-icons/fi";
import { AuthContext } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config/config";
import TableSkeleton from "../Skeleton/TableSkeleton";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { FiDownload, FiSettings } from "react-icons/fi";
import AddAutomation from "../FinancialReports/AddAutomation";
import ActionHoverLabel from "../FinancialReports/ActionHoverLabel";
import ViewMoreHeader, { VIEW_MORE_HEADER_BUTTON } from "./ViewMoreHeader";
import { FiMoreVertical, FiPlus } from "react-icons/fi";
import AddMetricButton from "./PLDashboardAddMetric";
import { getDecimalPrecision } from '../../utils/formatters';
import { FiRefreshCw } from "react-icons/fi";
import useTableInsights from "../../hooks/useTableInsights";
import useLineItemCommentary from "../../hooks/useLineItemCommentary";
import LineItemRefineWithAI, { LineItemAIButton } from "../FinancialReports/LineItemRefineWithAI";
import AnalyzeWithAI, { AnalyzeButton } from "../FinancialReports/AnalyzeWithAI";
import AIHelpTooltip from "../FinancialReports/AIHelpTooltip";
import { BsChatLeftTextFill } from "react-icons/bs";


/* ═══════════  UTILS  ═══════════ */
const localeForCurrency = (currency) => (currency === "INR" ? "en-IN" : "en-US");

const getFractionDigits = (value) => {
  const match = String(value).match(/\.(\d+)/);
  return match ? Math.min(match[1].length, 2) : 0;
};

const formatGroupedMoney = (value, currency) => {
  const withoutSuffix = String(value).replace(/\s*[KML]\s*$/i, "").trim();
  const numeric = Number(withoutSuffix.replace(/,/g, ""));
  if (!Number.isFinite(numeric)) return withoutSuffix;
  const dp = getDecimalPrecision();
  return new Intl.NumberFormat(localeForCurrency(currency), {
    useGrouping: true,
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(numeric);
};

/**
 * Smart display:
 *  - null/undefined/"" → "—"
 *  - string            → show as-is (already formatted by API)
 *  - number            → divide by divisor, format with Intl currency
 */
const fmtCurrency = (value, currency) => {
  if (value == null || value === "") return "—";
  if (typeof value === "string") return formatGroupedMoney(value, currency);
  if (typeof value === "number") {
    return new Intl.NumberFormat(localeForCurrency(currency), {
      useGrouping: true,
      minimumFractionDigits: getDecimalPrecision(),
      maximumFractionDigits: getDecimalPrecision(),
    }).format(value);
  }
  return String(value);
};

/* ═══════════  VARIANCE PILL  ═══════════ */
const VarPill = ({ value, currency }) => {
  if (value == null) return <span className="text-slate-400 text-x">—</span>;

  // Already a formatted string — show in a neutral pill
  if (typeof value === "string") {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
        {formatGroupedMoney(value, currency)}
      </span>
    );
  }

  const n = Number(value);

  if (isNaN(n)) return <span className="text-slate-400 text-x">—</span>;

  if (n === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
        <FiMinus size={8} /> 0
      </span>
    );
  }

  const pos = n > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold
        ${pos ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}
    >
      {pos ? <FiTrendingUp size={8} /> : <FiTrendingDown size={8} />}
      {pos ? "+" : ""}
      {new Intl.NumberFormat(localeForCurrency(currency), { useGrouping: true, minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }).format(n)}
    </span>
  );
};

/* ═══════════  AI INSIGHTS (generated per table — hooks/useTableInsights)  ═══════════ */
const AI_REPORT = { report_id: "pnl_viewmore", report_label: "Profit & Loss Statement" };

// A value for the AI's copy of a table: API strings keep their K/M/L scale
// suffix (the on-screen formatter drops it), numbers go in unformatted.
const aiValue = (v) =>
  v == null || v === "" ? "—" : typeof v === "number" ? String(Math.round(v * 100) / 100) : String(v);

const buildAIRequest = (ai, { tableId, tableLabel, lines, items, maxWords }) =>
  ai && items.length
    ? {
        ...AI_REPORT,
        table_id: tableId,
        table_label: tableLabel,
        year: ai.year,
        currency: ai.currency,
        filters: ai.filters,
        filter_labels: ai.filterLabels,
        context: lines.join("\n"),
        items,
        max_words: maxWords,
      }
    : null;

// Right-pinned Total + AI Insights columns, so the month columns scroll
// between them and the sticky name column. The name and month columns hug
// their content and AI Insights takes whatever width is left, so a short
// table has no gap between the names and the numbers. When the table is too
// wide and scrolls, every column is at its minimum, so Insights is exactly
// 220px — the Total offset must equal that minimum.
const PIN_INSIGHTS = "sticky right-0 z-20 min-w-[220px]";
const PIN_TOTAL =
  "sticky right-[220px] z-20 w-[130px] min-w-[130px] max-w-[130px] shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.25)]";

/* ═══════════  REFINE / ANALYZE WITH AI  ═══════════
   The page provides { onRefine, onAnalyze, byLine } to every table through
   this context, so the tables don't need extra props threaded through. */
const AIActionsContext = React.createContext(null);

// One table as plain text for the AI, plus the row/value being asked about.
const aiTableContext = (tableLabel, tableLines, focus) =>
  [`Report: Profit & Loss Statement (detail view)`, `Table: ${tableLabel}`, `Focus: ${focus}`, ...tableLines].join("\n");

// Chat-icon "Refine with AI" button next to a row's name.
const RefineRowButton = ({ lineKey, label, tableLabel, tableLines }) => {
  const actions = React.useContext(AIActionsContext);
  if (!actions) return null;
  return (
    <LineItemAIButton
      label={label}
      noun="commentary"
      hasCommentary={!!actions.byLine[lineKey]}
      onClick={() =>
        actions.onRefine({ key: lineKey, label, context: aiTableContext(tableLabel, tableLines, `the ${label} row`) })
      }
    />
  );
};

// ✦ "Analyze with AI" button pinned to a value cell's top-right corner (the
// cell must be `relative`).
const AnalyzeCellButton = ({ label, colLabel, value, metric, period, tableLabel, tableLines, series }) => {
  const actions = React.useContext(AIActionsContext);
  if (!actions || value == null || value === "" || value === "—") return null;
  return (
    <AnalyzeButton
      onClick={() =>
        actions.onAnalyze({
          kind: "cell",
          component: "table",
          metric,
          period,
          title: `${label} — ${colLabel}`,
          value,
          context: aiTableContext(tableLabel, tableLines, `${label} for ${colLabel} = ${value}`),
          supporting: [
            {
              title: `${label} by period`,
              columns: [
                { key: "period", label: "Period", type: "text" },
                { key: "value", label: "Value", type: "text" },
              ],
              rows: series,
            },
          ],
        })
      }
      title={`Explain ${label} for ${colLabel} with AI`}
      tooltip={{
        heading: "Explain with AI",
        context: `${label} · ${colLabel} · ${value}`,
        body: "AI breaks down what drove this number, with supporting data, and answers follow-up questions.",
      }}
      className="absolute top-0 right-0 opacity-70 hover:opacity-100 focus:opacity-100"
    />
  );
};

// A row's saved "Refine with AI" commentary wins over the generated insight.
const RowInsight = ({ state, id, lineKey }) => {
  const actions = React.useContext(AIActionsContext);
  const saved = actions?.byLine[lineKey];
  if (saved?.explanation) {
    return (
      <p className="text-[11px] leading-snug text-sky-800 line-clamp-2 whitespace-normal" title={saved.explanation}>
        <BsChatLeftTextFill size={10} className="inline mr-1 align-[-1px] text-emerald-600" aria-label="Saved commentary" />
        {saved.explanation}
      </p>
    );
  }
  return <AIInsightCell state={state} id={id} />;
};

const AIInsightCell = ({ state, id }) => {
  if (state.loading) {
    return (
      <div className="space-y-1.5 py-0.5" aria-label="Generating AI insight">
        <div className="h-2 w-11/12 rounded bg-sky-200/80 animate-pulse" />
        <div className="h-2 w-2/3 rounded bg-sky-200/80 animate-pulse" />
      </div>
    );
  }
  const text = state.insights[id];
  if (!text) {
    return (
      <span className="text-[11px] text-slate-400" title={state.error || "No AI insight for this row"}>
        —
      </span>
    );
  }
  return (
    <p className="text-[11px] leading-snug text-sky-800 line-clamp-2 whitespace-normal" title={text}>
      {text}
    </p>
  );
};

const AIRegenerateButton = ({ state, className = "" }) => (
  <button
    type="button"
    onClick={state.regenerate}
    disabled={state.loading}
    title={state.error ? `${state.error} Click to try again.` : "Regenerate AI insights"}
    aria-label="Regenerate AI insights"
    className={`p-1 rounded-md disabled:opacity-60 disabled:cursor-wait ${className}`}
  >
    <FiRefreshCw size={12} className={state.loading ? "animate-spin" : ""} />
  </button>
);

const AIInsightsHeading = ({ state }) => (
  <span className="flex items-center justify-between gap-2">
    AI Insights
    <AIRegenerateButton
      state={state}
      className={`hover:bg-white/15 ${state.error ? "text-amber-300" : "text-white/80"}`}
    />
  </span>
);

/* ═══════════  KEY METRICS  ═══════════ */
const KeyMetricsCards = ({ metrics, currency }) => {
  if (!metrics) return null;
  const cards = [
    { label: "Total Revenue", value: metrics.TotalRevenue, color: "from-sky-800 to-sky-600" },
    { label: "Gross Profit", value: metrics.GrossProfit, color: "from-emerald-800 to-emerald-600" },
    { label: "Net Profit", value: metrics.NetProfit, color: "from-violet-800 to-violet-600" },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`bg-gradient-to-l from-sky-900 to-sky-700 text-white rounded-xl p-3 shadow`}
        >
          <p className="text-x uppercase tracking-widest text-white font-semibold">{c.label}</p>
          {/* Key metrics: no divisor applied here — API already sends formatted value */}
          <p className="text-2xl font-bold mt-2">{fmtCurrency(c.value, currency)}</p>
        </div>
      ))}
    </div>
  );
};

const SectionTitle = ({ title }) => (
  <div className="flex items-center gap-3 my-4">
    <h2 className="text-x font-extrabold tracking-widest text-slate-600 uppercase whitespace-nowrap">
      {title}
    </h2>
    <div className="h-px flex-1 bg-slate-200" />
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════
   SUMMARY PIVOT TABLE
═══════════════════════════════════════════════════════════════════════ */
const PAIR_INDICES = [0, 2, 4, 6, 8, 10];

const isGrandTotal = (cat) => cat.toLowerCase().startsWith("grand_total");

const buildSummaryModel = (sectionData, v1Key) => {
  const entries = sectionData && typeof sectionData === "object" ? Object.entries(sectionData) : [];

  const firstRows =
    entries[0]?.[1]?.filter?.((r) => r[v1Key] !== undefined) ?? [];

  const pairs = PAIR_INDICES.map((i) => {
    const row = firstRows[i];
    return row ? { m1: row.month1, m2: row.month2, idx: i } : null;
  }).filter(Boolean);

  const buildLookup = (rows) => {
    const dataRows = rows.filter((r) => r[v1Key] !== undefined);
    const lookup = {};
    PAIR_INDICES.forEach((i) => {
      if (dataRows[i]) lookup[i] = dataRows[i];
    });
    return lookup;
  };

  const lookups = Object.fromEntries(
    entries.map(([cat, rows]) => [cat, buildLookup(Array.isArray(rows) ? rows : [])])
  );

  const totals = Object.fromEntries(
    entries.map(([cat, rows]) => {
      const t = Array.isArray(rows) ? rows.find((r) => r.total !== undefined) : null;
      return [cat, t?.total ?? null];
    })
  );

  return { entries, pairs, lookups, totals };
};

const SummaryPivotTable = ({
  title,
  sectionData,
  v1Key = "value1",
  v2Key = "value2",
  varKey = "variance",
  currency,
  ai,
}) => {
  const model = useMemo(() => buildSummaryModel(sectionData, v1Key), [sectionData, v1Key]);
  const { entries, pairs, lookups, totals } = model;

  // One insight per row per month pair shown (e.g. "Product Revenue, Jan → Feb").
  const aiRequest = useMemo(() => {
    const label = (cat) => cat.replace(/_/g, " ");
    const lines = entries.map(([cat]) => {
      const lookup = lookups[cat] || {};
      const cells = pairs.map(({ m1, m2, idx }) => {
        const r = lookup[idx];
        return `${m1} ${aiValue(r?.[v1Key])} → ${m2} ${aiValue(r?.[v2Key])} (change ${aiValue(r?.[varKey])})`;
      });
      return `${label(cat)}: ${cells.join("; ")}; year total ${aiValue(totals[cat])}`;
    });
    const items = entries
      .filter(([cat]) => !isGrandTotal(cat))
      .flatMap(([cat]) =>
        pairs.map(({ m1, m2, idx }) => ({
          id: `${cat}::${idx}`,
          focus: `${label(cat)}, change from ${m1} to ${m2}`,
        }))
      );
    return buildAIRequest(ai, {
      tableId: `summary:${title}`,
      tableLabel: `${title} — month-to-month comparison`,
      lines,
      items,
      maxWords: 16,
    });
  }, [ai, entries, pairs, lookups, totals, title, v1Key, v2Key, varKey]);
  const aiState = useTableInsights({ token: ai?.token, request: aiRequest });

  if (!entries.length) return null;

  return (
    <div className="bg-white rounded-xl border border-sky-100 shadow-sm overflow-hidden">
      {title && (
        <div className="px-4 py-3 bg-slate-50 border-b border-sky-100 flex items-center justify-between">
          <h3 className="text-x font-extrabold tracking-widest text-slate-700 uppercase">{title}</h3>
          <span className="flex items-center gap-1 text-[11px] text-sky-700">
            {aiState.loading ? "Generating AI insights…" : aiState.error ? "AI insights unavailable" : null}
            <AIRegenerateButton
              state={aiState}
              className={`hover:bg-sky-100 ${aiState.error ? "text-amber-600" : "text-sky-700"}`}
            />
          </span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-x border-collapse">
          <thead>
            <tr className="bg-sky-900 text-white">
              <th
                rowSpan={2}
                className="w-px px-4 py-3 text-left font-bold uppercase tracking-wide whitespace-nowrap
                           border-r border-white/20 align-middle sticky left-0 bg-sky-900 z-10"
              >
                Category
              </th>
              {pairs.map(({ m1, m2 }) => (
                <th
                  key={`${m1}-${m2}-grp`}
                  colSpan={4}
                  className="px-2 py-2 text-center font-bold border-l border-white/20 tracking-widest uppercase  text-[11p]"
                >
                  {m1} → {m2}
                </th>
              ))}
              <th
                rowSpan={2}
                className="px-3 py-3 text-right font-bold uppercase tracking-wide min-w-[110px]
                           border-l border-white/20 align-middle"
              >
                Total
              </th>
            </tr>
            <tr className="bg-sky-800 text-white">
              {pairs.map(({ m1, m2 }) => (
                <React.Fragment key={`${m1}-${m2}-sub`}>
                  <th className="px-3 py-2 text-right font-semibold border-l border-white/20 min-w-[100px] whitespace-nowrap">{m1}</th>
                  <th className="px-3 py-2 text-right font-semibold border-l border-white/10 min-w-[100px] whitespace-nowrap">{m2}</th>
                  <th className="px-3 py-2 text-center font-semibold border-l border-white/10 min-w-[90px] whitespace-nowrap">Variance</th>
                  <th className="px-3 py-2 text-left font-semibold border-l border-white/10 w-[200px] min-w-[200px] bg-sky-700 whitespace-nowrap">AI Insights</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map(([cat, rows], ri) => {
              const isGT = isGrandTotal(cat);
              const lookup = lookups[cat] || {};
              const total = totals[cat];
              const rowBg = isGT
                ? "bg-sky-900 text-white font-bold"
                : ri % 2 === 0
                  ? "bg-white hover:bg-sky-50"
                  : "bg-slate-50/60 hover:bg-sky-50";

              return (
                <tr key={cat} className={`${rowBg} transition-colors border-b border-sky-50`}>
                  <td
                    className={`w-px px-4 py-3 font-semibold whitespace-nowrap border-r sticky left-0 z-10
                      ${isGT
                        ? "bg-sky-900 text-white border-white/20 uppercase  text-[11p] tracking-widest"
                        : "bg-white text-sky-900 border-sky-100"
                      }`}
                  >
                    {cat.replace(/_/g, " ")}
                  </td>
                  {pairs.map(({ idx }) => {
                    const row = lookup[idx];
                    const v1 = row?.[v1Key];
                    const v2 = row?.[v2Key];
                    const vrn = row?.[varKey];
                    const vrnN = vrn != null && typeof vrn === "number" ? vrn : null;

                    return (
                      <React.Fragment key={idx}>
                        <td className={`px-3 py-3 text-right tabular-nums border-l ${isGT ? "border-white/20" : "border-sky-100"}`}>
                          {fmtCurrency(v1, currency)}
                        </td>
                        <td className={`px-3 py-3 text-right tabular-nums border-l ${isGT ? "border-white/20" : "border-sky-50"}`}>
                          {fmtCurrency(v2, currency)}
                        </td>
                        <td
                          className={`px-2 py-3 text-center border-l
                            ${isGT
                              ? "border-white/20"
                              : vrnN != null && vrnN > 0
                                ? "bg-emerald-50 border-sky-50"
                                : vrnN != null && vrnN < 0
                                  ? "bg-red-50 border-sky-50"
                                  : "border-sky-50"
                            }`}
                        >
                          {vrn != null
                            ? <VarPill value={vrn} currency={currency} />
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className={`px-3 py-3 border-l ${isGT ? "bg-sky-800 border-white/20" : "bg-sky-50 border-sky-100"}`}>
                          {isGT ? <span className="text-sky-300 text-[10px]">—</span> : <AIInsightCell state={aiState} id={`${cat}::${idx}`} />}
                        </td>
                      </React.Fragment>
                    );
                  })}
                  <td className={`px-3 py-3 text-right tabular-nums font-bold border-l ${isGT ? "border-white/20" : "border-sky-100"}`}>
                    {fmtCurrency(total, currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ═══════════  PROFIT SUMMARY PIVOT  ═══════════ */
// kind: "gross" | "net" — rendered separately so Gross Profit can sit after
// COGS and Net Profit after Operating Expenses.
const ProfitPivotSection = ({ profitSummary, kind, currency, ai }) => {
  const rows = profitSummary?.[`${kind}_profit_summary`];
  if (!rows?.length) return null;
  const title = kind === "gross" ? "Gross Profit" : "Net Profit";
  return (
    <SummaryPivotTable
      title={title}
      sectionData={{ [title]: rows }}
      v1Key={`${kind}_value1`} v2Key={`${kind}_value2`} varKey={`${kind}_variance`}
      currency={currency}
      ai={ai}
    />
  );
};

/* ═══════════  EXCEL PIVOT TABLE (monthly/quarterly tabs)  ═══════════ */
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

const normalizeMonthKey = (raw) => {
  if (raw == null) return null;
  const s = String(raw).trim();
  const m1 = s.match(/^(\d{4})-(\d{2})-\d{2}$/); if (m1) return `${m1[1]}-${m1[2]}`;
  const m2 = s.match(/^(\d{4})-(\d{1,2})$/); if (m2) return `${m2[1]}-${String(Number(m2[2])).padStart(2, "0")}`;
  const m3 = s.match(/^(\d{4})\/(\d{1,2})$/); if (m3) return `${m3[1]}-${String(Number(m3[2])).padStart(2, "0")}`;
  const m4 = s.match(/(\d{4})-(\d{2})/); if (m4) return `${m4[1]}-${m4[2]}`;
  return null;
};

const monthSortKey = (ym) => {
  const n = normalizeMonthKey(ym);
  if (!n) return Infinity;
  const [y, m] = n.split("-").map(Number);
  return y * 100 + m;
};

const fmtMonthHeader = (raw) => {
  const n = normalizeMonthKey(raw);
  if (!n) return String(raw ?? "").trim() || "—";
  const [yy, mm] = n.split("-");
  const d = new Date(`${yy}-${mm}-01T00:00:00`);
  if (isNaN(d)) return n;
  return `${d.toLocaleString("en", { month: "short" })} ${yy.slice(-2)}`;
};

// Value of one account row (or the grand-total map) for a month/quarter column.
const excelCellValue = (rowObj, k, mode, isGT) => {
  if (isObj(rowObj) && Array.isArray(rowObj?.data)) {
    const match = rowObj.data.find((r) =>
      String(mode === "quarterly" ? r.quarter ?? "" : r.period ?? "").trim() === k
    );
    return match
      ? Object.entries(match).find(([key]) => key !== "period" && key !== "quarter")?.[1] ?? null
      : null;
  }
  if (isObj(rowObj) && isGT) return rowObj[k] ?? null;
  return null;
};

const ExcelPLTable = ({ title, sectionKey, sectionData, currency, currencyFilter, mode, ai }) => {
  const gtKeyMap = {
    Total_Revenue: "grand_total_revenue", Total_Expenses: "grand_total_expenses",
    Total_cogs: "grand_total_cogs", Total_revenue: "grand_total_revenue",
    total_expenses: "grand_total_expenses", total_cogs: "grand_total_cogs",
  };

  const colKeys = useMemo(() => {
    if (!isObj(sectionData)) return [];
    const fromData = Object.values(sectionData)
      .flatMap((c) => c?.data ?? [])
      .map((r) => String(mode === "quarterly" ? r.quarter ?? "" : r.period ?? "").trim())
      .filter(Boolean);
    const gtKey = gtKeyMap[sectionKey];
    const fromGT = gtKey && isObj(sectionData?.[gtKey]) ? Object.keys(sectionData[gtKey]) : [];
    return Array.from(new Set([...fromData, ...fromGT]))
      .filter(k => k !== "total")
      .sort(mode === "quarterly"
        ? (a, b) => a.localeCompare(b)
        : (a, b) => monthSortKey(a) - monthSortKey(b));
  }, [sectionData, mode, sectionKey]); // eslint-disable-line

  const colLabel = (k) => (mode === "quarterly" ? k : fmtMonthHeader(k));
  const tableLabel = `${mode === "quarterly" ? "Quarterly" : "Monthly"} ${title}`;

  // The whole table as text — the AI insights request and the Refine /
  // Analyze drawers all read the same copy.
  const tableLines = useMemo(() => [
    `Columns: ${colKeys.map(colLabel).join(", ")}, Total`,
    ...Object.entries(sectionData || {}).map(([rowName, rowObj]) => {
      const isGT = rowName.startsWith("grand_total");
      const cells = colKeys.map((k) => `${colLabel(k)} ${aiValue(excelCellValue(rowObj, k, mode, isGT))}`);
      return `${rowName.replace(/_/g, " ")}: ${cells.join(", ")}; Total ${aiValue(rowObj?.total)}`;
    }),
  ], [sectionData, colKeys, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // One insight per account row, about its pattern across the columns shown.
  const aiRequest = useMemo(() => {
    const rows = Object.entries(sectionData || {});
    const lines = tableLines;
    const items = rows
      .filter(([rowName, rowObj]) => !rowName.startsWith("grand_total") && Array.isArray(rowObj?.data))
      .map(([rowName]) => ({
        id: rowName,
        focus: `${rowName.replace(/_/g, " ")} across the ${mode === "quarterly" ? "quarters" : "months"} shown`,
      }));
    return buildAIRequest(ai, {
      tableId: `${mode}:${sectionKey}`,
      tableLabel,
      lines,
      items,
      maxWords: 22,
    });
  }, [ai, sectionData, tableLines, mode, sectionKey, tableLabel]);
  const aiState = useTableInsights({ token: ai?.token, request: aiRequest });

  if (!colKeys.length) return null;

  return (
    <div className="bg-white rounded-xl border border-sky-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-x">
          <thead className="bg-sky-900 text-white">
            <tr>
              <th className="w-px px-3 py-3 text-left font-semibold uppercase tracking-wide whitespace-nowrap sticky left-0 z-30 bg-sky-900">
                {title}
              </th>
              {colKeys.map((k) => (
                <th key={k} className="w-px px-2 py-3 text-right font-semibold min-w-[80px] whitespace-nowrap">
                  {mode === "quarterly" ? k : fmtMonthHeader(k)}
                </th>
              ))}
              <th className={`px-3 py-3 text-right bg-sky-900 ${PIN_TOTAL}`}>Total</th>
              <th className={`px-3 py-3 text-left bg-sky-800 ${PIN_INSIGHTS}`}>
                <AIInsightsHeading state={aiState} />
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(sectionData || {}).map(([rowName, rowObj], idx) => {
              const isGT = rowName.startsWith("grand_total");
              const rowCls = isGT ? "bg-sky-900 text-white" : idx % 2 ? "bg-slate-50" : "bg-white";

              return (
                <tr key={rowName} className={rowCls}>
                  <td className={`w-px px-3 py-2.5 font-semibold whitespace-nowrap sticky left-0 z-30 ${isGT ? "bg-sky-900" : "bg-inherit"}`}>
                    <div className="flex items-center justify-between gap-1 z-30">
                      <span>{rowName.replace(/_/g, " ")}</span>
                      <span className="flex items-center gap-0.5">
                      {!isGT && (
                        <RefineRowButton
                          lineKey={`${mode}:${sectionKey}:${rowName}`}
                          label={rowName.replace(/_/g, " ")}
                          tableLabel={tableLabel}
                          tableLines={tableLines}
                        />
                      )}
                      {mode === "monthly" && !isGT && (
                        <AddMetricButton
                          accountName={rowName}
                          currencyFilter={currencyFilter}
                          onSuccess={(data) => console.log("Added:", data)}
                        />
                      )}
                      </span>
                    </div>
                  </td>

                  {colKeys.map((k) => {
                    const shown = fmtCurrency(excelCellValue(rowObj, k, mode, isGT), currency);
                    return (
                      <td key={k} className="relative w-px px-2 py-2.5 text-right tabular-nums whitespace-nowrap">
                        {!isGT && (
                          <AnalyzeCellButton
                            label={rowName.replace(/_/g, " ")}
                            colLabel={colLabel(k)}
                            value={shown}
                            metric={rowName}
                            period={k}
                            tableLabel={tableLabel}
                            tableLines={tableLines}
                            series={colKeys.map((c) => ({
                              period: colLabel(c),
                              value: fmtCurrency(excelCellValue(rowObj, c, mode, false), currency),
                            }))}
                          />
                        )}
                        {shown}
                      </td>
                    );
                  })}

                  {/* Total column */}
                  <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${PIN_TOTAL} ${isGT ? "bg-sky-900" : "bg-inherit"}`}>
                    {fmtCurrency(rowObj?.total, currency)}
                  </td>

                  {/* AI Insights column */}
                  <td className={`${isGT ? "bg-sky-800" : "bg-sky-50"} px-3 py-2.5 border-l border-sky-100 ${PIN_INSIGHTS}`}>
                    {isGT
                      ? <span className="opacity-40 text-[10px]">—</span>
                      : <RowInsight state={aiState} id={rowName} lineKey={`${mode}:${sectionKey}:${rowName}`} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ═══════════  PROFIT ROWS (monthly/quarterly)  ═══════════ */
const PROFIT_LINES = [
  { id: "Gross_Profit", label: "Gross Profit", totalKey: "total_Gross_Profit", bg: "bg-white" },
  { id: "Net_Profit", label: "Net Profit", totalKey: "total_Net_Profit", bg: "bg-slate-50" },
];

// One profit line (lineId) per table, so Gross Profit can sit after COGS and
// Net Profit after Operating Expenses.
const ProfitRows = ({ lineId, periods, profitArr, profitTotal, periodKey, currency, ai }) => {
  const map = useMemo(
    () => new Map((profitArr || []).map((p) => [String(p[periodKey]).trim(), p])),
    [profitArr, periodKey]
  );
  const line = PROFIT_LINES.find((l) => l.id === lineId);

  const quarterly = periodKey === "quarter";
  const tableLabel = `${quarterly ? "Quarterly" : "Monthly"} ${line.label}`;
  const tableLines = useMemo(() => [
    `Columns: ${(periods || []).join(", ")}, Total`,
    `${line.label}: ${(periods || []).map((p) => `${p} ${aiValue(map.get(p)?.[line.id])}`).join(", ")}; Total ${aiValue(profitTotal?.[line.totalKey])}`,
  ], [periods, map, profitTotal, line]);

  const aiRequest = useMemo(() => {
    if (!periods?.length || !map.size) return null;
    return buildAIRequest(ai, {
      tableId: `${quarterly ? "quarterly" : "monthly"}:profit:${line.id}`,
      tableLabel,
      lines: tableLines,
      items: [{ id: line.id, focus: `${line.label} across the ${quarterly ? "quarters" : "months"} shown` }],
      maxWords: 22,
    });
  }, [ai, periods, map, tableLines, tableLabel, quarterly, line]);
  const aiState = useTableInsights({ token: ai?.token, request: aiRequest });

  if (!periods?.length || !profitArr?.length) return null;

  // Name cell, value cells and insight cell for one profit line.
  const lineCells = ({ id, label }, bg) => {
    const lineKey = `${periodKey}:profit:${id}`;
    return (
      <>
        <td className={`w-px px-3 py-3 font-semibold text-sky-900 sticky left-0 z-20 whitespace-nowrap ${bg}`}>
          <span className="flex items-center justify-between gap-1">
            {label}
            <RefineRowButton lineKey={lineKey} label={label} tableLabel={tableLabel} tableLines={tableLines} />
          </span>
        </td>
        {periods.map((p) => {
          const shown = fmtCurrency(map.get(p)?.[id], currency);
          return (
            <td key={p} className="relative w-px px-2 py-3 text-right tabular-nums whitespace-nowrap">
              <AnalyzeCellButton
                label={label}
                colLabel={p}
                value={shown}
                metric={id}
                period={p}
                tableLabel={tableLabel}
                tableLines={tableLines}
                series={periods.map((q) => ({ period: q, value: fmtCurrency(map.get(q)?.[id], currency) }))}
              />
              {shown}
            </td>
          );
        })}
      </>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-sky-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-x">
          <thead className="bg-sky-900 text-white ">
            <tr>
              <th className="w-px px-3 py-3 text-left font-semibold whitespace-nowrap sticky left-0 z-30 bg-sky-900">Category</th>
              {periods.map((p) => (
                <th key={p} className="w-px px-2 py-3 text-right font-semibold min-w-[80px] whitespace-nowrap">{quarterly ? p : fmtMonthHeader(p)}</th>
              ))}
              <th className={`px-3 py-3 text-right font-semibold bg-sky-900 ${PIN_TOTAL}`}>Total</th>
              <th className={`px-3 py-3 text-left font-semibold bg-sky-800 ${PIN_INSIGHTS}`}>
                <AIInsightsHeading state={aiState} />
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className={`${line.bg} border-b`}>
              {lineCells(line, line.bg)}
              <td className={`px-3 py-3 text-right font-bold tabular-nums ${line.bg} ${PIN_TOTAL}`}>
                {fmtCurrency(profitTotal?.[line.totalKey], currency)}
              </td>
              <td className={`px-3 py-3 bg-sky-50 border-l border-sky-100 ${PIN_INSIGHTS}`}>
                <RowInsight state={aiState} id={line.id} lineKey={`${periodKey}:profit:${line.id}`} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ═══════════  ACTUAL VS BUDGET  ═══════════ */
const BudgetVsActualTable = ({ data, currency }) => {
  const sections = [
    {
      title: "Revenue", data: data?.Revenue,
      keys: {
        actual: "actual_revenue", budget: "budget_revenue", pct: "revenue_achieved_pct",
        totalKey: "Total_revenues", ta: "actual_revenue_total", tb: "budget_revenue_total", tp: "achieved_totals"
      }
    },
    {
      title: "COGS", data: data?.cogs,
      keys: {
        actual: "actual_costs", budget: "budget_cogs", pct: "cogs_achieved_pct",
        totalKey: "Total_cogs", ta: "actual_cogs_total", tb: "budget_cogs_total", tp: "achieved_totals"
      }
    },
    {
      title: "Operating Expenses", data: data?.expense,
      keys: {
        actual: "actual_opex", budget: "budget_opex", pct: "expense_achieved_pct",
        totalKey: "Total_expense", ta: "actual_expense_total", tb: "budget_expense_total", tp: "achieved_totals"
      }
    },
  ];

  if (!sections.some((s) => Array.isArray(s.data) && s.data.length))
    return <div className="p-8 text-center text-slate-400">No budget data available</div>;

  return (
    <div className="space-y-5">
      {sections.map((sec) => {
        if (!Array.isArray(sec.data) || !sec.data.length) return null;
        const rows = sec.data.filter((r) => r.account_name);
        const totCon = sec.data.find((r) => r[sec.keys.totalKey]);
        const tot = totCon ? totCon[sec.keys.totalKey] : null;

        return (
          <div key={sec.title} className="bg-white rounded-xl border border-sky-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b">
              <h3 className="text-x font-extrabold uppercase tracking-widest text-slate-700">{sec.title}</h3>
            </div>
            <table className="w-full text-x">
              <thead className="bg-sky-900 text-white">
                <tr>
                  <th className="w-px px-4 py-3 text-left font-semibold uppercase tracking-wide whitespace-nowrap">Account</th>
                  <th className="px-3 py-3 text-right font-semibold uppercase tracking-wide">Actual</th>
                  <th className="px-3 py-3 text-right font-semibold uppercase tracking-wide">Budget</th>
                  <th className="px-3 py-3 text-right font-semibold uppercase tracking-wide">Achieved %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={`border-b border-sky-50 hover:bg-sky-50 ${i % 2 ? "bg-slate-50" : "bg-white"}`}>
                    <td className="w-px px-4 py-3 font-medium whitespace-nowrap">{row.account_name}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {fmtCurrency(row[sec.keys.actual], currency)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-500">
                      {fmtCurrency(row[sec.keys.budget], currency)}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-sky-700">
                      {row[sec.keys.pct] != null ? `${Number(row[sec.keys.pct]).toFixed(getDecimalPrecision())}%` : "—"}
                    </td>
                  </tr>
                ))}
                {tot && (
                  <tr className="bg-sky-900 text-white font-bold">
                    <td className="px-4 py-3 uppercase  text-[11p] tracking-wide">Total {sec.title}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {fmtCurrency(tot[sec.keys.ta], currency)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {fmtCurrency(tot[sec.keys.tb], currency)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {tot[sec.keys.tp] != null ? `${Number(tot[sec.keys.tp]).toFixed(getDecimalPrecision())}%` : "—"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
};

/* ═══════════  FILTERS FROM THE P&L STATEMENT  ═══════════ */
// The P&L page's View More link carries its applied filters in the URL
// (labels in router state — see PnLPage viewMoreLink). Value scale and
// entity prefill the dropdowns here; the rest show as removable chips.
const CARRIED_FILTERS = [
  ["time_filter", "Period"],
  ["date_from", "From"],
  ["date_to", "To"],
  ["cost_center", "Cost center"],
  ["profit_center", "Profit center"],
  ["customer", "Customer"],
  ["region", "Region"],
  ["product_name", "Product"],
];
const TIME_FILTER_LABELS = {
  current_month: "Current Month",
  last_month: "Last Month",
  quarter_to_date: "Quarter to Date",
  year_to_date: "Year to Date",
};
const VALUE_SCALES = ["actualvalue", "thousands", "millions"];

/* ═══════════════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════════════ */
export default function PLDashboardViewMore() {
  const { token, selectedYear, selectedCurrency } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const carriedLabels = location.state?.filterLabels || {};

  const [activeTab, setActiveTab] = useState("monthly");
  const [currencyFilter, setCurrencyFilter] = useState(() =>
    VALUE_SCALES.includes(searchParams.get("currency_filter")) ? searchParams.get("currency_filter") : "actualvalue"
  );
  const [entity, setEntity] = useState(() => searchParams.get("entity") || "All");
  const [department, setDepartment] = useState("All");
  const [carried, setCarried] = useState(() =>
    Object.fromEntries(CARRIED_FILTERS.map(([key]) => [key, searchParams.get(key)]).filter(([, value]) => value))
  );
  const carriedChips = CARRIED_FILTERS.filter(([key]) => carried[key]).map(([key, name]) => {
    const value = carried[key];
    const shown = key === "time_filter" ? TIME_FILTER_LABELS[value] || value
      : key === "date_from" || key === "date_to" ? value
      : carriedLabels[key] || value;
    return { key, label: `${name}: ${shown}` };
  });
  // Also drop it from the URL, so a refresh doesn't bring it back.
  const removeCarried = (key) => {
    setCarried((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(key);
      return next;
    }, { replace: true, state: location.state });
  };
  const [data, setData] = useState(null);
  const [entities, setEntities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);

  const buildUrl = useCallback(() => {
    const p = new URLSearchParams();
    p.append("currency_filter", currencyFilter);
    if (entity !== "All") p.append("entity", entity);
    if (department !== "All") p.append("department", department);
    Object.entries(carried).forEach(([key, value]) => p.append(key, value));
    return `${API_BASE_URL}/api/v1/company/financial/profitandloss_statement_viewmore/${selectedYear}/${selectedCurrency}?${p}`;
  }, [currencyFilter, entity, department, carried, selectedYear, selectedCurrency]);

  const downloadExcel = () => {
    if (!data) return;
    let exportData = [];

    if (activeTab === "summary" && data.summary) {
      exportData = Object.entries(data.summary.revenue_summary || {}).flatMap(
        ([category, rows]) =>
          rows.filter((r) => r.value1 !== undefined).map((r) => ({
            Category: category, Month1: r.month1, Value1: r.value1,
            Month2: r.month2, Value2: r.value2, Variance: r.variance, AI: r["AI Driven"]
          }))
      );
    }
    if (activeTab === "monthly" && data.monthly_view) {
      exportData = Object.entries(data.monthly_view.Total_Revenue || {}).flatMap(
        ([name, obj]) => obj?.data?.map((r) => ({ Account: name, Period: r.period, Revenue: r.total_revenue })) || []
      );
    }
    if (activeTab === "quarterly" && data.quarterly_view) {
      exportData = Object.entries(data.quarterly_view.Total_revenue || {}).flatMap(
        ([name, obj]) => obj?.data?.map((r) => ({ Account: name, Quarter: r.quarter, Revenue: r.total_revenue })) || []
      );
    }
    if (activeTab === "budget" && data.actual_vs_budget) {
      exportData = (data.actual_vs_budget.Revenue || []).map((r) => ({
        Account: r.account_name, Actual: r.actual_revenue,
        Budget: r.budget_revenue, Achieved: r.revenue_achieved_pct
      }));
    }

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, activeTab);
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    saveAs(blob, `P&L_${activeTab}_${selectedYear}.xlsx`);
  };

  const addMetric = async (metricName, accountName) => {
    try {
      const params = new URLSearchParams({
        metric_name: metricName,
        account_name: accountName,
        currency_filter: currencyFilter
      });
      const url = `${API_BASE_URL}/api/v1/company/financial/metric/add/${selectedYear}/${selectedCurrency}?${params}`;
      const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (res.ok) {
        console.log("Metric added to dashboard");
      } else {
        console.error(json.message || "Failed to add metric");
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!token) return;
    const doFetch = async () => {
      setLoading(true);
      try {
        const res = await fetch(buildUrl(), { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        setData(json);
        setEntities([{ entity_id: "All", entity_name: "All" }, ...(json.entities || [])]);
        setDepartments([{ department_id: "All", department_name: "All" }, ...(json.departments || [])]);
      } catch (e) {
        console.error(e);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    doFetch();
  }, [token, selectedYear, selectedCurrency, currencyFilter, entity, department, buildUrl]);

  const mv = data?.monthly_view;
  const qv = data?.quarterly_view;
  const bv = data?.actual_vs_budget;
  const sum = data?.summary;

  const monthlyPeriods = useMemo(() => {
    if (!mv) return [];
    return Object.keys(mv.Total_Revenue?.grand_total_revenue || {})
      .filter(k => k !== "total")
      .sort((a, b) => monthSortKey(a) - monthSortKey(b));
  }, [mv]);

  const quarterlyPeriods = useMemo(() => {
    if (!qv) return [];
    return Object.keys(qv.Total_revenue?.grand_total_revenue || {})
      .filter(k => k !== "total")
      .sort((a, b) => a.localeCompare(b));
  }, [qv]);

  const TABS = [
    { id: "monthly", label: "Monthly P&L" },
    { id: "summary", label: "P&L Comparisons" },
    { id: "quarterly", label: "Quarterly P&L" },
    { id: "budget", label: "Actual vs Budget" },
  ];

  const currLabel = currencyFilter === "actualvalue" ? "Actual"
    : currencyFilter === "thousands" ? "Thousands" : "Millions";

  // What every table's AI insights request needs to describe the view on screen.
  const aiContext = useMemo(() => ({
    token,
    year: selectedYear,
    currency: selectedCurrency,
    filters: {
      entity: entity !== "All" ? entity : undefined,
      department: department !== "All" ? department : undefined,
      currency_filter: currencyFilter,
      ...carried,
    },
    filterLabels: [
      `Entity: ${entities.find(e => String(e.entity_id) === String(entity))?.entity_name || entity}`,
      `Department: ${departments.find(d => String(d.department_id) === String(department))?.department_name || department}`,
      `Values in: ${currLabel === "Actual" ? "actual amounts" : currLabel.toLowerCase()}`,
      ...carriedChips.map((c) => c.label),
    ],
  // carriedChips is derived from carried (+ the fixed router-state labels).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [token, selectedYear, selectedCurrency, entity, department, currencyFilter, entities, departments, currLabel, carried]);

  // Refine with AI (row commentary) and Analyze with AI (one value). The
  // drawers read the context each table attached when the button was clicked.
  const lineCommentary = useLineItemCommentary({
    token,
    reportId: AI_REPORT.report_id,
    year: selectedYear,
    currency: selectedCurrency,
    filters: aiContext.filters,
  });
  const [refineLine, setRefineLine] = useState(null);
  const [analyzeTarget, setAnalyzeTarget] = useState(null);
  const aiActions = useMemo(
    () => ({ onRefine: setRefineLine, onAnalyze: setAnalyzeTarget, byLine: lineCommentary.byLine }),
    [lineCommentary.byLine]
  );

  return (
    <AIActionsContext.Provider value={aiActions}>
    <main className="bg-slate-50 min-h-screen space-y-3">

      {/* HEADER — one compact row. View / Entity / Dept / Value aren't repeated
          here: the tabs and dropdowns right below already show them. */}
      <ViewMoreHeader title="Profit & Loss Statement" year={selectedYear} currency={selectedCurrency}>
        <button onClick={downloadExcel} aria-label="Download Excel" className={VIEW_MORE_HEADER_BUTTON}>
          <FiDownload />
          <ActionHoverLabel>Download Excel</ActionHoverLabel>
        </button>
        <AddAutomation reportType="pl_summary" reportLabel="Profit & Loss Statement" iconOnly />
        <button
          onClick={() => navigate("/settings-customization/report-workflow")}
          aria-label="Report & Workflow"
          className={VIEW_MORE_HEADER_BUTTON}
        >
          <FiSettings />
          <ActionHoverLabel>Report &amp; Workflow</ActionHoverLabel>
        </button>
      </ViewMoreHeader>

      {/* METRICS */}
      {!loading && <KeyMetricsCards metrics={data?.keymetrics} currency={selectedCurrency} />}

      {/* FILTER BAR */}
      <div className="bg-white rounded-xl px-3 py-2 border border-sky-100 shadow-sm flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 flex-wrap">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-2.5 py-1.5 text-x font-bold rounded-lg transition
                ${activeTab === t.id ? "bg-sky-900 text-white shadow" : "bg-sky-100 text-sky-800 hover:bg-sky-200"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <select value={entity} onChange={e => setEntity(e.target.value)}
            className="px-2 py-1.5 text-x border border-sky-200 text-sky-900 rounded-lg font-semibold focus:outline-none">
            {entities.map(e => (
              <option key={e.entity_id} value={e.entity_id}>Entity: {e.entity_name}</option>
            ))}
          </select>
          <select value={department} onChange={e => setDepartment(e.target.value)}
            className="px-2 py-1.5 text-x border border-sky-200 text-sky-900 rounded-lg font-semibold focus:outline-none">
            {departments.map(d => (
              <option key={d.department_id} value={d.department_id}>Dept: {d.department_name}</option>
            ))}
          </select>
          <select value={currencyFilter} onChange={e => setCurrencyFilter(e.target.value)}
            className="px-2 py-1.5 text-x border border-sky-200 text-sky-900 rounded-lg font-semibold focus:outline-none">
            <option value="actualvalue">Value: Actual</option>
            <option value="thousands">Value: Thousands</option>
            <option value="millions">Value: Millions</option>
          </select>
        </div>
      </div>

      {carriedChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="text-x font-semibold text-slate-500">Filters from P&amp;L:</span>
          {carriedChips.map((c) => (
            <span key={c.key} className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-sky-100 text-sky-900 text-x font-semibold">
              {c.label}
              <button
                onClick={() => removeCarried(c.key)}
                aria-label={`Remove ${c.label}`}
                className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-sky-200"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {loading && <TableSkeleton />}

      {!loading && data?.message && (
        <div className="bg-white rounded-xl border border-sky-100 p-8 text-center text-slate-500 text-s">{data.message}</div>
      )}

      {/* SUMMARY TAB */}
      {!loading && activeTab === "summary" && sum && (
        <div className="space-y-6">
          {/* P&L order: Revenue → COGS → Gross Profit → Operating Expenses → Net Profit */}
          <SectionTitle title="Revenue Summary" />
          <SummaryPivotTable title="Revenue" sectionData={sum.revenue_summary}
            v1Key="value1" v2Key="value2" varKey="variance"
            currency={selectedCurrency} currencyFilter={currencyFilter} ai={aiContext} />

          <SectionTitle title="COGS Summary" />
          <SummaryPivotTable title="Cost of Goods Sold" sectionData={sum.cogs_summary}
            v1Key="value1" v2Key="value2" varKey="variance"
            currency={selectedCurrency} currencyFilter={currencyFilter} ai={aiContext} />

          <SectionTitle title="Gross Profit Summary" />
          <ProfitPivotSection profitSummary={sum.profit_summary} kind="gross"
            currency={selectedCurrency} currencyFilter={currencyFilter} ai={aiContext} />

          <SectionTitle title="Operating Expenses Summary" />
          <SummaryPivotTable title="Expenses" sectionData={sum.expense_summary}
            v1Key="value1" v2Key="value2" varKey="variance"
            currency={selectedCurrency} currencyFilter={currencyFilter} ai={aiContext} />

          <SectionTitle title="Net Profit Summary" />
          <ProfitPivotSection profitSummary={sum.profit_summary} kind="net"
            currency={selectedCurrency} currencyFilter={currencyFilter} ai={aiContext} />
        </div>
      )}

      {/* MONTHLY TAB */}
      {!loading && activeTab === "monthly" && mv && (
        <div className="space-y-5">
          <SectionTitle title="Monthly Revenue" />
          <ExcelPLTable title="Total Revenue" sectionKey="Total_Revenue" sectionData={mv.Total_Revenue}
            onAddMetric={addMetric} currency={selectedCurrency} currencyFilter={currencyFilter} mode="monthly" ai={aiContext} />

          <SectionTitle title="Monthly COGS" />
          <ExcelPLTable title="Total COGS" sectionKey="Total_cogs" sectionData={mv.Total_cogs}
            currency={selectedCurrency} currencyFilter={currencyFilter} mode="monthly" ai={aiContext} />

          <SectionTitle title="Monthly Gross Profit" />
          <ProfitRows lineId="Gross_Profit" periods={monthlyPeriods} profitArr={mv.profit} profitTotal={mv.profit_total}
            periodKey="period" currency={selectedCurrency} currencyFilter={currencyFilter} ai={aiContext} />

          <SectionTitle title="Monthly Operating Expenses" />
          <ExcelPLTable title="Total Operating Expenses" sectionKey="Total_Expenses" sectionData={mv.Total_Expenses}
            currency={selectedCurrency} currencyFilter={currencyFilter} mode="monthly" ai={aiContext} />

          <SectionTitle title="Monthly Net Profit" />
          <ProfitRows lineId="Net_Profit" periods={monthlyPeriods} profitArr={mv.profit} profitTotal={mv.profit_total}
            periodKey="period" currency={selectedCurrency} currencyFilter={currencyFilter} ai={aiContext} />
        </div>
      )}

      {/* QUARTERLY TAB */}
      {!loading && activeTab === "quarterly" && qv && (
        <div className="space-y-5">
          <SectionTitle title="Quarterly Revenue" />
          <ExcelPLTable title="Total Revenue" sectionKey="Total_revenue" sectionData={qv.Total_revenue}
            currency={selectedCurrency} currencyFilter={currencyFilter} mode="quarterly" ai={aiContext} />

          <SectionTitle title="Quarterly COGS" />
          <ExcelPLTable title="Total COGS" sectionKey="total_cogs" sectionData={qv.total_cogs}
            currency={selectedCurrency} currencyFilter={currencyFilter} mode="quarterly" ai={aiContext} />

          <SectionTitle title="Quarterly Gross Profit" />
          <ProfitRows lineId="Gross_Profit" periods={quarterlyPeriods} profitArr={qv.profit_q} profitTotal={qv.profit_q_total}
            periodKey="quarter" currency={selectedCurrency} currencyFilter={currencyFilter} ai={aiContext} />

          <SectionTitle title="Quarterly Operating Expenses" />
          <ExcelPLTable title="Total Operating Expenses" sectionKey="total_expenses" sectionData={qv.total_expenses}
            currency={selectedCurrency} currencyFilter={currencyFilter} mode="quarterly" ai={aiContext} />

          <SectionTitle title="Quarterly Net Profit" />
          <ProfitRows lineId="Net_Profit" periods={quarterlyPeriods} profitArr={qv.profit_q} profitTotal={qv.profit_q_total}
            periodKey="quarter" currency={selectedCurrency} currencyFilter={currencyFilter} ai={aiContext} />
        </div>
      )}

      {/* BUDGET TAB */}
      {!loading && activeTab === "budget" && (
        <div className="space-y-5">
          <SectionTitle title="Actual vs Budget" />
          <BudgetVsActualTable data={bv} currency={selectedCurrency} currencyFilter={currencyFilter} />
        </div>
      )}

      <LineItemRefineWithAI
        line={refineLine}
        onClose={() => setRefineLine(null)}
        lineCommentary={lineCommentary}
        reportLabel={AI_REPORT.report_label}
        filterLabels={aiContext.filterLabels}
        buildContext={() => refineLine?.context || ""}
        subtitle="explanation & recommendation"
      />

      <AnalyzeWithAI
        target={analyzeTarget}
        onClose={() => setAnalyzeTarget(null)}
        token={token}
        reportId={AI_REPORT.report_id}
        reportLabel={AI_REPORT.report_label}
        year={selectedYear}
        currency={selectedCurrency}
        filterLabels={aiContext.filterLabels}
        loadContext={async (t) => ({ context: t.context, supporting: t.supporting || [] })}
      />

      {/* Hover help for the ✦ and commentary buttons in the tables */}
      <AIHelpTooltip />
    </main>
    </AIActionsContext.Provider>
  );
}
