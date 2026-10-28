import React, { useContext, useEffect, useMemo, useState, useCallback } from "react";
import { FiTrendingUp, FiTrendingDown, FiMinus, FiDownload } from "react-icons/fi";
import AddAutomation from "../FinancialReports/AddAutomation";
import ActionHoverLabel from "../FinancialReports/ActionHoverLabel";
import ViewMoreHeader, { VIEW_MORE_FILTER_BAR, VIEW_MORE_HEADER_BUTTON, VIEW_MORE_SELECT } from "./ViewMoreHeader";
import { motion, AnimatePresence } from "framer-motion";
import { AuthContext } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config/config";
import TableSkeleton from "../Skeleton/TableSkeleton";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { getDecimalPrecision } from "../../utils/formatters";

/* ═══════════════════════════════════════════════════════════════════════════
   BalanceSheetViewMore.jsx
   ───────────────────────────────────────────────────────────────────────────
   CHANGES vs previous version:
     1. time_filter → moved to dropdown (same style as Entity / Compare dropdowns)
     2. AI Insights → last column on EVERY data row (animated ticker per row)
     3. All 7 metric cards → same sky-900→sky-700 gradient (uniform look)
═══════════════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════
   UTILS
════════════════════════════════════ */



const divisorFor = (cf) =>
  cf === "thousands" ? 1_000 : cf === "millions" ? 1_000_000 : 1;

const fmtCurrency = (value, currency, divisor = 1) => {
  if (value == null || value === "") return "—";
  if (typeof value === "string") {
    const cleaned = value.trim().replace(/[$,\s]/g, "");
    if (!cleaned || cleaned === "—" || cleaned === "-") return "—";
    if (/[a-zA-Z%]/.test(cleaned)) return value;
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed)) return value;
    value = parsed;
  }
  const n = Number(value) / divisor;
  if (!Number.isFinite(n)) return "—";
  const dp = getDecimalPrecision();
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(n);
};

/* "2024-01" → "Jan '24" */
const fmtPeriodHeader = (raw) => {
  if (!raw) return "—";
  const s = String(raw).trim();
  if (/^\d{4}Q\d$/.test(s)) return s;
  const m = s.match(/^(\d{4})-(\d{2})$/);
  if (!m) return s;
  const d = new Date(`${m[1]}-${m[2]}-01T00:00:00`);
  if (isNaN(d)) return s;
  return `${d.toLocaleString("en", { month: "short" })} '${m[1].slice(-2)}`;
};

const periodSortKey = (k) => {
  const m = String(k).match(/(\d{4})-(\d{2})/);
  if (m) return Number(m[1]) * 100 + Number(m[2]);
  return 0;
};

/* ════════════════════════════════════
   PctPill — green ▲ / red ▼
════════════════════════════════════ */
const PctPill = ({ pct }) => {
  if (pct == null) return <span className="text-slate-400 text-[10px]">—</span>;
  const n = Number(pct);
  if (isNaN(n)) return <span className="text-slate-400 text-[10px]">—</span>;
  if (n === 0)
    return (
      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
        <FiMinus size={8} /> 0%
      </span>
    );
  const pos = n > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold
      ${pos ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}>
      {pos ? <FiTrendingUp size={8} /> : <FiTrendingDown size={8} />}
      {pos ? "+" : ""}{n.toFixed(getDecimalPrecision())}%
    </span>
  );
};

/* ════════════════════════════════════
   AIRowTicker
   Per-row animated AI insight ticker.
   Each row gets its own independent ticker cycling through the
   global aiDriver messages from keymetrics.
   Messages are staggered by rowIndex so not all rows change at once.
════════════════════════════════════ */
const AIRowTicker = ({ messages, rowIndex = 0 }) => {
  const msgs = Array.isArray(messages) ? messages.filter(Boolean) : [];

  /* Stagger start index so each row shows a different message initially */
  const [idx, setIdx] = useState(rowIndex % Math.max(msgs.length, 1));

  useEffect(() => {
    if (msgs.length <= 1) return;
    /* Each row rotates at a slightly different speed so they don't sync */
    const delay = 3500 + rowIndex * 400;
    const t = setInterval(() => setIdx((x) => (x + 1) % msgs.length), delay);
    return () => clearInterval(t);
  }, [msgs.length, rowIndex]);

  if (!msgs.length)
    return (
      <span className="text-[10px] italic text-sky-400 whitespace-nowrap">
        Coming soon
      </span>
    );

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={idx}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.3 }}
        className="text-[10px] italic text-sky-700 leading-snug block max-w-[160px]"
        title={msgs[idx]}
      >
        {String(msgs[idx]).length > 38
          ? String(msgs[idx]).substring(0, 36) + "…"
          : msgs[idx]}
      </motion.span>
    </AnimatePresence>
  );
};

/* ════════════════════════════════════
   KEY METRICS CARDS
   All 7 cards use the SAME sky-900→sky-700 gradient (uniform look)
════════════════════════════════════ */
const KeyMetricsCards = ({ metrics, currency }) => {
  if (!metrics) return null;

  const cards = [
    { label: "Total Assets",      value: metrics["Total Assets"],      fmt: "currency" },
    { label: "Total Liabilities", value: metrics["Total Liabilities"],  fmt: "currency" },
    { label: "Net Equity",        value: metrics["Net Equity"],         fmt: "currency" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
      {cards.map((c) => {
        let display = "—";
        if (c.value != null) {
          display = c.fmt === "currency"
            ? fmtCurrency(c.value, currency)
            : Number(c.value).toFixed(getDecimalPrecision());
        }
        return (
          /* ↓ ALL cards: same from-sky-900 to-sky-700 — no per-card colour */
          <div key={c.label}
            className="bg-gradient-to-l from-sky-900 to-sky-700 text-white rounded-xl p-3 shadow">
            <p className="text-[10px] uppercase tracking-widest text-white/70 font-semibold leading-snug">
              {c.label}
            </p>
            <p className="text-lg font-bold mt-1.5 leading-none">{display}</p>
          </div>
        );
      })}
    </div>
  );
};

/* ════════════════════════════════════
   SECTION TITLE
════════════════════════════════════ */
const SectionTitle = ({ title }) => (
  <div className="flex items-center gap-3 my-4">
    <h2 className="text-x font-extrabold tracking-widest text-slate-600 uppercase whitespace-nowrap">
      {title}
    </h2>
    <div className="h-px flex-1 bg-slate-200" />
  </div>
);

/* ════════════════════════════════════════════════════════════════════════════
   BALANCE TABLE
   ────────────────────────────────────────────────────────────────────────────
   Last column on EVERY row (including Grand Total) = AI Insights (animated).

   No comparison mode:
     Account Name | period… | Total | AI Insights

   Comparison mode:
     Account Name | [period Value | MoM%]… | Total | Total MoM% | AI Insights
════════════════════════════════════════════════════════════════════════════ */
const BalanceTable = ({
  accountType,
  rows,
  grandTotal,
  periodKeys,
  comparison,
  currency,
  currencyFilter,
  aiMessages,        // keymetrics.aiDriver[] passed down
}) => {
  const divisor = divisorFor(currencyFilter);
  const hasComparison = !!comparison;

  const comparisonLookup = useMemo(() => {
    const result = {};
    rows.forEach((row) => {
      const map = {};
      (row.comparisons?.periods || []).forEach((p) => { map[p.base_period] = p; });
      result[row.account_name] = { ...map, __total: row.comparisons?.total?.[0] || null };
    });
    const gtMap = {};
    (grandTotal?.comparisons?.periods || []).forEach((p) => { gtMap[p.base_period] = p; });
    gtMap.__total = grandTotal?.comparisons?.total?.[0] || null;
    result.__grand_total = gtMap;
    return result;
  }, [rows, grandTotal]);

  const getPeriodComparison = (period) =>
    comparisonLookup.__grand_total?.[period] ||
    rows.map((row) => comparisonLookup[row.account_name]?.[period]).find(Boolean) ||
    null;

  if (!rows?.length && !grandTotal) return null;

  const isSubtotalOnly = !rows?.length && !!grandTotal;

  /* How many extra "AI Insights" colspan we need in the header */
  const aiColSpan = 1;

  return (
    <div className="bg-white rounded-xl border border-sky-100 shadow-sm overflow-hidden">

      {/* Sub-header — hidden for subtotal-only sections (Total Assets / Total Equity) */}
      {!isSubtotalOnly && (
        <div className="px-4 py-3 bg-slate-50 border-b border-sky-100 flex items-center justify-between">
          <h3 className="text-x font-extrabold tracking-widest text-slate-700 uppercase">{accountType}</h3>
          <span className="text-[10px] text-slate-400 font-semibold">
            {rows.length} account{rows.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-x border-collapse">

          {/* ── HEADER ── */}
          <thead>
            {hasComparison ? (
              <>
                {/* ROW 1 — group headers */}
                <tr className="bg-sky-900 text-white">
                  <th rowSpan={2}
                    className="px-4 py-3 text-left font-bold uppercase tracking-wide
                               min-w-[200px] sticky left-0 bg-sky-900 z-10 border-r border-white/20 align-middle">
                    Account Name
                  </th>
                  {periodKeys.map((k) => (
                    <th key={k} colSpan={3}
                      className="px-2 py-2 text-center font-bold border-l border-white/20
                                  text-[11p] uppercase tracking-widest min-w-[280px]">
                      {fmtPeriodHeader(k)}
                    </th>
                  ))}
                  <th colSpan={3}
                    className="px-3 py-2 text-center font-bold border-l border-white/20
                                text-[11p] uppercase tracking-widest min-w-[280px]">
                    Total
                  </th>
                  {/* AI Insights header — spans 2 rows */}
                  <th rowSpan={2}
                    className="px-3 py-3 text-left font-bold border-l border-white/20
                               min-w-[160px] bg-sky-700 align-middle">
                    AI Insights
                  </th>
                </tr>
                {/* ROW 2 — sub-cols */}
                <tr className="bg-sky-800 text-white">
                  {periodKeys.map((k) => {
                    const periodComparison = getPeriodComparison(k);
                    const currentLabel = periodComparison?.base_period || k;
                    const compareLabel = periodComparison?.compare_period || "";

                    return (
                    <React.Fragment key={k}>
                      <th className="px-3 py-2 text-right font-semibold border-l border-white/20 min-w-[100px] whitespace-nowrap">
                        Current({currentLabel})
                      </th>
                      <th className="px-3 py-2 text-right font-semibold border-l border-white/10 min-w-[100px] bg-sky-800 whitespace-nowrap">
                        Compare{compareLabel ? `(${compareLabel})` : ""}
                      </th>
                      <th className="px-3 py-2 text-center font-semibold border-l border-white/10 min-w-[80px] bg-sky-700 whitespace-nowrap">
                        {comparison === "month_on_month" ? "MoM %" : "YoY %"}
                      </th>
                    </React.Fragment>
                    );
                  })}
                  <th className="px-3 py-2 text-right font-semibold border-l border-white/20 min-w-[110px]">
                    Current({comparisonLookup.__grand_total?.__total?.base_period || "Total"})
                  </th>
                  <th className="px-3 py-2 text-right font-semibold border-l border-white/10 min-w-[110px] bg-sky-800">
                    Compare{comparisonLookup.__grand_total?.__total?.compare_period ? `(${comparisonLookup.__grand_total.__total.compare_period})` : ""}
                  </th>
                  <th className="px-3 py-2 text-center font-semibold border-l border-white/10 min-w-[80px] bg-sky-700">
                    {comparison === "month_on_month" ? "MoM %" : "YoY %"}
                  </th>
                </tr>
              </>
            ) : (
              /* SINGLE-ROW HEADER */
              <tr className="bg-sky-900 text-white">
                <th className="px-4 py-3 text-left font-bold uppercase tracking-wide
                               min-w-[200px] sticky left-0 bg-sky-900 z-10 border-r border-white/20">
                  Account Name
                </th>
                {periodKeys.map((k) => (
                  <th key={k}
                    className="px-3 py-3 text-right font-semibold min-w-[100px] whitespace-nowrap border-l border-white/20">
                    {fmtPeriodHeader(k)}
                  </th>
                ))}
                <th className="px-3 py-3 text-right font-bold min-w-[110px] border-l border-white/20">
                  Total
                </th>
                {/* AI Insights column header */}
                <th className="px-3 py-3 text-left font-semibold min-w-[160px] border-l border-white/20 bg-sky-700">
                  AI Insights
                </th>
              </tr>
            )}
          </thead>

          {/* ── BODY ── */}
          <tbody>
            {rows.map((row, ri) => {
              const comps = comparisonLookup[row.account_name] || {};
              const rowBg = ri % 2 === 0
                ? "bg-white hover:bg-sky-50"
                : "bg-slate-50/60 hover:bg-sky-50";

              return (
                <tr key={row.account_name}
                  className={`${rowBg} transition-colors border-b border-sky-50`}>

                  {/* Account name — sticky */}
                  <td className="px-4 py-3 font-semibold whitespace-nowrap sticky left-0 z-10
                                 bg-white text-sky-900 border-r border-sky-100">
                    {row.account_name}
                  </td>

                  {/* Period columns */}
                  {periodKeys.map((k) => {
                    const val = row[k];
                    const comp = comps[k];
                    return (
                      <React.Fragment key={k}>
                        <td className="px-3 py-3 text-right tabular-nums border-l border-sky-100">
                          {val != null ? fmtCurrency(val, currency, divisor) : "—"}
                        </td>
                        {hasComparison && (
                          <>
                            <td className="px-3 py-3 text-right tabular-nums border-l border-sky-50 bg-sky-50/50">
                              {fmtCurrency(comp?.compare_value, currency, divisor)}
                            </td>
                            <td className="px-2 py-3 text-center border-l border-sky-50 bg-sky-50/50">
                              <PctPill pct={comp?.pct_change} />
                            </td>
                          </>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* Total */}
                  <td className="px-3 py-3 text-right tabular-nums font-bold border-l border-sky-100">
                    {row.Total != null ? fmtCurrency(row.Total, currency, divisor) : "—"}
                  </td>
                  {hasComparison && (
                    <>
                      <td className="px-3 py-3 text-right tabular-nums font-bold border-l border-sky-50 bg-sky-50/50">
                        {fmtCurrency(comps.__total?.compare_value, currency, divisor)}
                      </td>
                      <td className="px-2 py-3 text-center border-l border-sky-50 bg-sky-50/50">
                        <PctPill pct={comps.__total?.pct_change} />
                      </td>
                    </>
                  )}

                  {/* ── AI INSIGHTS column — animated per-row ticker ── */}
                  <td className="px-3 py-3 border-l border-sky-100 bg-sky-50 min-w-[160px]">
                    <AIRowTicker messages={aiMessages} rowIndex={ri} />
                  </td>
                </tr>
              );
            })}

            {/* ── GRAND TOTAL ROW ── */}
            {grandTotal && (
              <tr className="bg-sky-900 text-white font-bold border-t-2 border-sky-700">
                <td className="px-4 py-3 uppercase text-[11p] tracking-widest sticky left-0 z-10
                               bg-sky-900 border-r border-white/20">
                  {isSubtotalOnly ? grandTotal.account_name : `Total ${accountType}`}
                </td>
                {periodKeys.map((k) => {
                  const val = grandTotal[k];
                  const comp = comparisonLookup.__grand_total?.[k];
                  return (
                    <React.Fragment key={k}>
                      <td className="px-3 py-3 text-right tabular-nums border-l border-white/20">
                        {val != null ? fmtCurrency(val, currency, divisor) : "—"}
                      </td>
                      {hasComparison && (
                        <>
                          <td className="px-3 py-3 text-right tabular-nums border-l border-white/10 bg-sky-800">
                            {fmtCurrency(comp?.compare_value, currency, divisor)}
                          </td>
                          <td className="px-2 py-3 text-center border-l border-white/10 bg-sky-800">
                            <PctPill pct={comp?.pct_change} />
                          </td>
                        </>
                      )}
                    </React.Fragment>
                  );
                })}
                <td className="px-3 py-3 text-right tabular-nums border-l border-white/20">
                  {grandTotal.Total != null ? fmtCurrency(grandTotal.Total, currency, divisor) : "—"}
                </td>
                {hasComparison && (
                  <>
                    <td className="px-3 py-3 text-right tabular-nums border-l border-white/10 bg-sky-800">
                      {fmtCurrency(comparisonLookup.__grand_total?.__total?.compare_value, currency, divisor)}
                    </td>
                    <td className="px-2 py-3 text-center border-l border-white/10 bg-sky-800">
                      <PctPill pct={comparisonLookup.__grand_total?.__total?.pct_change} />
                    </td>
                  </>
                )}
                {/* AI Insights cell on Grand Total row */}
                <td className="px-3 py-3 border-l border-white/20 bg-sky-800">
                  <AIRowTicker messages={aiMessages} rowIndex={99} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════════════════════ */
export default function BalanceSheetViewMore() {
  const { token, selectedYear, selectedCurrency } = useContext(AuthContext);

  /* ── Filter state ── */
  const [timeFilter,     setTimeFilter]     = useState("all_periods");
  const [currencyFilter, setCurrencyFilter] = useState("actualvalue");
  const [entity,         setEntity]         = useState("All");
  const [comparison,     setComparison]     = useState("");

  /* ── Data state ── */
  const [data,     setData]     = useState(null);
  const [entities, setEntities] = useState([]);
  const [loading,  setLoading]  = useState(false);

  /* ── Build API URL ── */
  const buildUrl = useCallback(() => {
    const p = new URLSearchParams();
    p.append("time_filter",     timeFilter);
    p.append("currency_filter", currencyFilter);
    if (entity !== "All") p.append("entity",     entity);
    if (comparison)       p.append("comparision", comparison); // API typo intentional
    return `${API_BASE_URL}/api/v1/company/financial/balance_sheet_statement_viewmore/${selectedYear}/${selectedCurrency}?${p}`;
  }, [timeFilter, currencyFilter, entity, comparison, selectedYear, selectedCurrency]);

  /* ── Fetch ── */
  useEffect(() => {
    if (!token) return;
    const doFetch = async () => {
      setLoading(true);
      try {
        const res  = await fetch(buildUrl(), { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        setData(json);
        setEntities([
          { entity_id: "All", entity_name: "All" },
          ...(json.entities || []),
        ]);
      } catch (e) {
        console.error("Balance sheet fetch error:", e);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    doFetch();
  }, [token, selectedYear, selectedCurrency, timeFilter, currencyFilter, entity, comparison, buildUrl]);

  /* ── Sorted period keys ── */
  const periodKeys = useMemo(() => {
    const firstRow = data?.data?.[0]?.rows?.[0];
    if (!firstRow) return [];
    return Object.keys(firstRow)
      .filter((k) => /^\d{4}-\d{2}$/.test(k))
      .sort((a, b) => periodSortKey(a) - periodSortKey(b));
  }, [data]);

  /* ── aiDriver messages to pass into every table ── */
  const aiMessages = data?.keymetrics?.aiDriver || [];

  /* ── Excel download ── */
  const downloadExcel = () => {
    if (!data?.data) return;
    const rows = [];
    data.data.forEach((section) => {
      section.rows.forEach((row) => {
        const r = { "Category": section.category, "Account Name": row.account_name };
        periodKeys.forEach((k) => { r[fmtPeriodHeader(k)] = row[k] ?? ""; });
        r["Total"] = row.Total ?? "";
        rows.push(r);
      });
      if (section.subtotal) {
        const gt = { "Category": section.category, "Account Name": section.subtotal.account_name };
        periodKeys.forEach((k) => { gt[fmtPeriodHeader(k)] = section.subtotal[k] ?? ""; });
        gt["Total"] = section.subtotal.Total ?? "";
        rows.push(gt);
      }
    });
    const ws  = XLSX.utils.json_to_sheet(rows);
    const wb  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Balance Sheet");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `BalanceSheet_${selectedYear}.xlsx`
    );
  };

  /* ── Label helpers ── */
  const TIME_OPTIONS = [
    { id: "all_periods",     label: "All Periods"      },
    { id: "current_month",   label: "Current Month"    },
    { id: "last_month",      label: "Last Month"       },
    { id: "quarter_to_date", label: "Quarter to Date"  },
    { id: "year_to_date",    label: "Year to Date"     },
  ];

  /* ════════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════════ */
  return (
    <main className="bg-slate-50 min-h-screen space-y-3">

      {/* Period / Entity / Value / Compare aren't repeated here: the dropdowns right below show them. */}
      <ViewMoreHeader title="Balance Sheet" year={selectedYear} currency={selectedCurrency}>
        <button onClick={downloadExcel} aria-label="Download Excel" className={VIEW_MORE_HEADER_BUTTON}>
          <FiDownload />
          <ActionHoverLabel>Download Excel</ActionHoverLabel>
        </button>
        <AddAutomation reportType="balance_sheet" reportLabel="Balance Sheet Statement" iconOnly />
      </ViewMoreHeader>

      {/* ── KEY METRICS ── */}
      {!loading && <KeyMetricsCards metrics={data?.keymetrics} currency={selectedCurrency} />}

      {/* ── FILTER BAR ──
          time_filter is now a DROPDOWN, same style as entity/currency/comparison
      ── */}
      <div className={VIEW_MORE_FILTER_BAR}>

        {/* All dropdowns in one row */}
        <div className="flex gap-2 items-center flex-wrap ml-auto">

          {/* ── Time Filter dropdown (previously tabs) ── */}
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className={VIEW_MORE_SELECT}
          >
            {TIME_OPTIONS.map((t) => (
              <option key={t.id} value={t.id}>Period: {t.label}</option>
            ))}
          </select>

          {/* Entity */}
          <select
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            className={VIEW_MORE_SELECT}
          >
            {entities.map((e) => (
              <option key={e.entity_id} value={e.entity_id}>
                Entity: {e.entity_name}
              </option>
            ))}
          </select>

          {/* Currency scale */}
          <select
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
            className={VIEW_MORE_SELECT}
          >
            <option value="actualvalue">Value: Actual</option>
            <option value="thousands">Value: Thousands</option>
            <option value="millions">Value: Millions</option>
          </select>

          {/* Comparison */}
          <select
            value={comparison}
            onChange={(e) => setComparison(e.target.value)}
            className={VIEW_MORE_SELECT}
          >
            <option value="">Compare: None</option>
            <option value="month_on_month">Compare: Month on Month</option>
            <option value="year_on_year">Compare: Year on Year</option>
          </select>
        </div>
      </div>

      {/* ── LOADING ── */}
      {loading && <TableSkeleton />}

      {/* ── BALANCE SHEET SECTIONS ── */}
      {!loading && (() => {
        if (!data?.data) return null;
        let lastGroup = null;
        return data.data.flatMap((sec, si) => {
          const group =
            sec.section === "Asset"     ? "ASSETS"      :
            sec.section === "Liability" ? "LIABILITIES" : "EQUITY";
          const els = [];
          if (group !== lastGroup) {
            lastGroup = group;
            els.push(<SectionTitle key={`grp-${group}`} title={group} />);
          }
          if (sec.rows?.length > 0) {
            els.push(
              <p key={`cat-${si}`}
                className="text-xs font-semibold text-sky-600 uppercase tracking-wider mb-1 mt-3 pl-3 border-l-4 border-sky-300">
                {sec.category}
              </p>
            );
          }
          els.push(
            <BalanceTable
              key={sec.category ?? si}
              accountType={sec.category}
              rows={sec.rows || []}
              grandTotal={sec.subtotal}
              periodKeys={periodKeys}
              comparison={comparison}
              currency={selectedCurrency}
              currencyFilter={currencyFilter}
              aiMessages={aiMessages}
            />
          );
          return els;
        });
      })()}

      {/* ── EMPTY STATE ── */}
      {!loading && (!data?.data || data.data.length === 0) && (
        <div className="bg-white rounded-xl border border-sky-100 p-12 text-center">
          <p className="text-slate-400 text-s font-medium">
            No balance sheet data available for the selected filters.
          </p>
        </div>
      )}

    </main>
  );
}
