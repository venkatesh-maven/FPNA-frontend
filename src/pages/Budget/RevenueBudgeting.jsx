// RevenueBudgeting.jsx — Existing Customers (Summary ⇄ Drivers bidirectional
// sync) / Pipeline / Strategic Revenue. Backed by real endpoints under
// /api/v1/budget/revenue/{year}/... — AI Suggested values come from the
// Forecasting module's precomputed forecast + GL actuals (PRD §23 Forecast
// Exit); user edits persist to fpna_config.budget_* tables.
import React, { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  FiBarChart2, FiTrendingUp, FiFlag, FiSearch, FiX, FiMessageSquare,
  FiCpu, FiDownload, FiUpload, FiAlertTriangle, FiLayers, FiList, FiPlus,
  FiDollarSign, FiTrash2,
} from "react-icons/fi";
import { AuthContext } from "../../context/AuthContext";
import { BudgetYearContext } from "../../context/BudgetYearContext";
import { BudgetMethodologyContext } from "../../context/BudgetMethodologyContext";
import { BudgetGuidelinesContext } from "../../context/BudgetGuidelinesContext";
import { API_BASE_URL } from "../../config/config";
import TableSkeleton from "../Skeleton/TableSkeleton";
import { SaveBar, ImportModal } from "../ForecastingOverview/RevenueForecastHelpers";
import {
  KpiRow, WorkflowModal, WorkflowProgress, UnsavedChangesModal, ApplyAllMonthsModal,
  ExplainPopover, OverrideReasonModal, AIAdjustedCell, PaginationBar,
  useToast, ToastContainer, EmptyState, fmt, fmtPct, getInitials, avatarClass,
  STAGE_LABELS, toBackendNumber, parseMoney, CURRENCY_FILTER_OPTIONS,
  TopDownTargetCard, ReconciliationBanner, TopDownAllocationTable, computeTopDownTarget,
} from "./budgetHelpers";
import { ExceptionBadge, ExceptionDrawer, ExceptionSummaryStrip, useExceptions } from "./exceptionHelpers";

// Normalizes the money fields on freshly-fetched API payloads back to real
// numbers — everything downstream (bidirectional sync math, KPI totals,
// row-status comparisons) keeps working exactly as it did before the backend
// started applying currency_filter formatting.
const normalizeCustomers = (list) => (list || []).map((c) => ({
  ...c,
  // Backend returns the saved override as `override: {reason, note}`; the
  // rest of this file reads it as `c.reason` — without this mapping the
  // saved reason never survived a refetch (page refresh, re-login, tab
  // revisit), even though it was persisted correctly in the database.
  reason: c.override || null,
  prior_year_actual: parseMoney(c.prior_year_actual),
  current_forecast: parseMoney(c.current_forecast),
  forecast_exit: parseMoney(c.forecast_exit),
  months: (c.months || []).map((m) => ({
    ...m,
    ai_revenue: parseMoney(m.ai_revenue),
    adjusted_revenue: parseMoney(m.adjusted_revenue),
    // Backend returns the saved per-month override as `override_reason`/
    // `override_note`; row components read it as `m.override` (same shape
    // as the yearly `c.reason`) so both the yearly and per-month reason
    // buttons/modal can share identical rendering logic.
    override: m.override_reason ? { reason: m.override_reason, note: m.override_note || "" } : null,
  })),
}));
const normalizeRevenueRows = (list) => (list || []).map((r) => ({
  ...r, ai_revenue: parseMoney(r.ai_revenue), adjusted_revenue: parseMoney(r.adjusted_revenue),
}));
const normalizeCompareRows = (list) => (list || []).map((r) => ({
  ...r,
  prior_year_actual: parseMoney(r.prior_year_actual),
  current_forecast: parseMoney(r.current_forecast),
  ai_budget: parseMoney(r.ai_budget),
  user_budget: parseMoney(r.user_budget),
  variance_vs_forecast: parseMoney(r.variance_vs_forecast),
}));

// Pure — safe to hoist out of the component so it isn't redefined every render.
const rowStatus = (c) => {
  const changed = c.months.some((m) => Number(m.adjusted_revenue) !== Number(m.ai_revenue));
  if (!changed) return { label: "AI Baseline", cls: "bg-slate-100 text-slate-600" };
  if (c.reason) return { label: "Modified", cls: "bg-sky-50 text-sky-700" };
  return { label: "Needs Reason", cls: "bg-amber-50 text-amber-700" };
};

// Explicit pixel widths shared between the (non-virtualized) <thead> and the
// virtualized row body — react-window renders each row as its own
// `display:table; table-layout:fixed` context, so columns only stay aligned
// with the header if every cell pins the same width both places.
const PIPELINE_COL_WIDTHS = [190, 160, 150, 110, 140, 150, 150, 170, 190];
const PIPELINE_TABLE_WIDTH = PIPELINE_COL_WIDTHS.reduce((a, b) => a + b, 0);

const PipelineRow = memo(function PipelineRow({ p, idx, rowIdx, onVolume, onRate, onProbability, onRevenue, onDelete, editable }) {
  const rowBg = rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/60";
  return (
    <tr className={`rf-row border-b border-slate-200 transition-colors hover:bg-sky-50/50 ${rowBg}`}>
      <td style={{ width: PIPELINE_COL_WIDTHS[0] }} className="px-3 py-1 font-semibold text-slate-900 text-xs leading-tight border-r border-slate-100">
        <div className="flex items-center gap-1.5">
          <span className="truncate" title={p.customer_name}>{p.customer_name}</span>
          {p.is_manual && (
            <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-600 text-xs font-semibold border border-sky-200" title="Manually added — not from CRM">Manual</span>
          )}
          {p.is_manual && editable && (
            <button onClick={() => onDelete(p.opportunity_id)} title="Remove this manually-added customer"
              className="shrink-0 text-slate-300 hover:text-red-500 transition-colors ml-auto">
              <FiTrash2 size={11} />
            </button>
          )}
        </div>
      </td>
      <td style={{ width: PIPELINE_COL_WIDTHS[1] }} className="px-3 py-1 text-xs text-slate-600 truncate border-r border-slate-100">{p.region}{p.region && p.segment ? " · " : ""}{p.segment}</td>
      <td style={{ width: PIPELINE_COL_WIDTHS[2] }} className="px-3 py-1 text-xs text-slate-500 truncate border-r border-slate-100">{p.product || <span className="text-slate-300 italic">Not yet booked</span>}</td>
      <td style={{ width: PIPELINE_COL_WIDTHS[3] }} className="px-3 py-1 text-xs text-slate-600 truncate border-r border-slate-100">{p.stage}</td>
      <td style={{ width: PIPELINE_COL_WIDTHS[4] }} className="px-3 py-1 text-xs text-slate-600 border-r border-slate-300">
        {p.estimated_close_date?.slice(0, 10)}
        {p.close_date_is_estimated && <span className="ml-1 text-xs text-amber-600 font-semibold" title="Estimated from stage + creation date — CRM has not confirmed a close date yet">(est.)</span>}
      </td>
      <td style={{ width: PIPELINE_COL_WIDTHS[5] }} className="px-3 py-1 border-r border-slate-100">
        <div className="flex items-center justify-end gap-1.5">
          <span className="text-xs text-slate-400 tabular-nums w-9 text-right shrink-0">{p.ai_probability}%</span>
          <input type="number" value={p.adjusted_probability} onChange={(e) => onProbability(idx, e.target.value)}
            className="w-14 px-1.5 py-0.5 rounded-md border border-slate-200 text-right tabular-nums text-xs outline-none transition-all focus:border-sky-500 focus:ring-2 ring-sky-100" />
        </div>
      </td>
      <td style={{ width: PIPELINE_COL_WIDTHS[6] }} className="px-3 py-1 border-r border-slate-100">
        <div className="flex items-center justify-end gap-1.5">
          <span className="text-xs text-slate-400 tabular-nums w-9 text-right shrink-0">{p.ai_volume}</span>
          <input type="number" value={p.adjusted_volume} onChange={(e) => onVolume(idx, e.target.value)}
            className="w-14 px-1.5 py-0.5 rounded-md border border-slate-200 text-right tabular-nums text-xs outline-none transition-all focus:border-sky-500 focus:ring-2 ring-sky-100" />
        </div>
      </td>
      <td style={{ width: PIPELINE_COL_WIDTHS[7] }} className="px-3 py-1 border-r border-slate-100">
        <div className="flex items-center justify-end gap-1.5">
          <span className="text-xs text-slate-400 tabular-nums w-14 text-right shrink-0">{fmt(p.ai_rate)}</span>
          <input type="number" value={p.adjusted_rate} onChange={(e) => onRate(idx, e.target.value)}
            className="w-16 px-1.5 py-0.5 rounded-md border border-slate-200 text-right tabular-nums text-xs outline-none transition-all focus:border-sky-500 focus:ring-2 ring-sky-100" />
        </div>
      </td>
      <td style={{ width: PIPELINE_COL_WIDTHS[8] }} className="px-3 py-1">
        <AIAdjustedCell ai={p.ai_revenue} adjusted={p.adjusted_revenue} editable onChange={(v) => onRevenue(idx, v)} width="w-24" />
      </td>
    </tr>
  );
});

// Memoized so editing one customer's cell doesn't force React to re-diff all
// 492 rows — `customers` state updates keep unrelated rows' object identity
// stable, so React.memo's default shallow prop comparison skips them.
const ExistingCustomerSummaryRow = memo(function ExistingCustomerSummaryRow({ c, origIdx, rowIdx, editable, onRevenue, onOpenReason, onOpenException, visibleCols }) {
  const avCls = avatarClass(c.customer_name);
  const totalAi = c.months.reduce((a, m) => a + m.ai_revenue, 0);
  const totalAdj = c.months.reduce((a, m) => a + (Number(m.adjusted_revenue) || 0), 0);
  const varAmt = totalAdj - totalAi;
  const status = rowStatus(c);
  const rowBg = rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/60";
  return (
    <tr className={`rf-row border-b border-slate-200 transition-colors hover:bg-sky-50/50 ${rowBg}`}>
      <td className={`px-3 py-1 sticky left-0 border-r border-slate-200 z-[5] ${rowBg}`}>
        <div className="flex items-center gap-1.5">
          <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${avCls}`}>{getInitials(c.customer_name)}</div>
          <span className="font-semibold text-slate-900 text-xs leading-tight truncate" title={c.customer_name}>{c.customer_name}</span>
        </div>
      </td>
      {visibleCols.department && <td className="px-3 py-1 text-xs text-slate-600 truncate border-r border-slate-100">{c.department || "—"}</td>}
      {visibleCols.segment && <td className="px-3 py-1 text-xs text-slate-600 truncate border-r border-slate-100">{c.segment || "—"}</td>}
      {visibleCols.region && <td className="px-3 py-1 text-xs text-slate-600 truncate border-r border-slate-100">{c.region || "—"}</td>}
      <td className="px-3 py-1 text-right tabular-nums text-xs text-slate-500 border-r border-slate-100">{fmt(c.prior_year_actual)}</td>
      <td className="px-3 py-1 text-right tabular-nums text-xs text-slate-500 border-r border-slate-100">{fmt(c.current_forecast)}</td>
      <td className="px-3 py-1 text-right tabular-nums text-xs text-slate-500 border-r border-slate-300">{fmt(c.forecast_exit)}</td>
      <td className="px-2 py-1 text-right text-xs text-slate-500 tabular-nums border-r border-slate-100 bg-slate-50/60">{fmt(totalAi)}</td>
      <td className={`px-2 py-1 text-right text-xs font-bold tabular-nums border-r border-slate-300 ${totalAdj > totalAi ? "text-emerald-600" : totalAdj < totalAi ? "text-red-500" : "text-sky-700"}`}>{fmt(totalAdj)}</td>
      {c.months.map((m, mi) => (
        <React.Fragment key={m.period}>
          <td className="px-2 py-1 text-right text-xs text-slate-500 tabular-nums border-r border-slate-100">{fmt(m.ai_revenue)}</td>
          <td className="px-1.5 py-1 border-r border-slate-100">
            <input type="number" value={m.adjusted_revenue ?? ""} disabled={!editable}
              onChange={(e) => onRevenue(origIdx, mi, e.target.value)}
              className={`w-full px-1.5 py-0.5 rounded-md border text-right text-xs tabular-nums outline-none transition-all
                ${!editable ? "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200" :
                  Number(m.adjusted_revenue) !== m.ai_revenue ? "border-sky-400 bg-sky-50 text-sky-900 focus:ring-2 ring-sky-100" :
                  "border-slate-300 bg-white hover:border-slate-400 focus:border-sky-500 focus:ring-2 ring-sky-100"}`} />
          </td>
          <td className="px-0.5 py-1 text-center border-r border-slate-300">
            <button onClick={() => onOpenReason(c, m.period)}
              className={`w-6 h-6 rounded-md flex items-center justify-center transition-all mx-auto ${m.override ? "bg-sky-100 text-sky-600 border border-sky-200 hover:bg-sky-200" : "text-slate-300 hover:text-sky-500 hover:bg-sky-50"}`}
              title={m.override ? `${m.override.reason}${m.override.note ? ": " + m.override.note : ""}` : `Add reason for ${m.period}`}>
              <FiMessageSquare size={11} />
            </button>
          </td>
        </React.Fragment>
      ))}
      <td className={`px-2 py-1 text-right text-xs font-semibold tabular-nums border-r border-slate-100 ${varAmt > 0 ? "text-emerald-600" : varAmt < 0 ? "text-red-500" : "text-slate-400"}`}>{varAmt === 0 ? "—" : `${varAmt > 0 ? "+" : ""}${fmt(varAmt)}`}</td>
      {visibleCols.confidence && (
        <td className="px-2 py-1 text-center border-r border-slate-100">
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.confidence === "High" ? "bg-emerald-50 text-emerald-700" : c.confidence === "Medium" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"}`}>{c.confidence}</span>
        </td>
      )}
      {visibleCols.status && (
        <td className="px-2 py-1 text-center border-r border-slate-100">
          <div className="flex flex-col items-center gap-1">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${status.cls}`}>{status.label}</span>
            <ExceptionBadge exception={c.exception} onClick={() => onOpenException(c)} />
          </div>
        </td>
      )}
      {visibleCols.reason && (
        <td className="px-1.5 py-1 text-center border-l border-slate-100">
          <button onClick={() => onOpenReason(c)}
            className={`flex items-center gap-1 px-1.5 py-1 rounded-md transition-all max-w-[115px] mx-auto ${c.reason ? "bg-sky-100 text-sky-700 border border-sky-200 hover:bg-sky-200" : "text-slate-300 hover:text-sky-500 hover:bg-sky-50"}`}
            title={c.reason ? `${c.reason.reason}${c.reason.note ? ": " + c.reason.note : ""}` : "Add override reason"}>
            <FiMessageSquare size={11} className="shrink-0" />
            {c.reason && <span className="text-xs font-semibold truncate">{c.reason.reason}</span>}
          </button>
        </td>
      )}
      <td className="px-2 py-1 border-l border-slate-300">
        <ExplainPopover reasons={c.reasons} confidence={c.confidence} label={`${c.customer_name} — AI Reasoning`}
          value={fmt(c.months[0]?.ai_revenue)} valueLabel={`AI Suggested Revenue (${c.months[0]?.period || ""})`} variant="cell" />
      </td>
    </tr>
  );
});

// One row per customer, with each period's Volume/Rate/Revenue as repeating
// column groups — same horizontal layout convention as the Summary table,
// instead of one row per customer-month.
const ExistingCustomerDriverRow = memo(function ExistingCustomerDriverRow({ c, origIdx, rowIdx, onVolume, onRate, onRevenue, onRevenueFocus, onRevenueBlur, onOpenReason }) {
  const totalAi = c.months.reduce((a, m) => a + m.ai_revenue, 0);
  const totalAdj = c.months.reduce((a, m) => a + (Number(m.adjusted_revenue) || 0), 0);
  const varAmt = totalAdj - totalAi;
  const rowBg = rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/60";
  return (
    <tr className={`rf-row border-b border-slate-200 transition-colors hover:bg-sky-50/50 ${rowBg}`}>
      <td className={`px-3 py-1 sticky left-0 border-r border-slate-200 z-[5] ${rowBg}`}>
        <div className="flex items-center gap-1.5">
          <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${avatarClass(c.customer_name)}`}>{getInitials(c.customer_name)}</div>
          <span className="font-semibold text-slate-900 text-xs leading-tight truncate" title={c.customer_name}>{c.customer_name}</span>
        </div>
      </td>
      <td className="px-2 py-1 text-right text-xs text-slate-500 tabular-nums border-r border-slate-100 bg-slate-50/60">{fmt(totalAi)}</td>
      <td className={`px-2 py-1 text-right text-xs font-bold tabular-nums border-r border-slate-300 ${totalAdj > totalAi ? "text-emerald-600" : totalAdj < totalAi ? "text-red-500" : "text-sky-700"}`}>{fmt(totalAdj)}</td>
      {c.months.map((m, mi) => (
        <React.Fragment key={m.period}>
          <td className="px-1.5 py-1 border-r border-slate-100">
            <div className="flex items-center justify-end gap-1">
              <span className="text-xs text-slate-400 tabular-nums w-9 text-right shrink-0">{m.ai_volume}</span>
              <input type="number" value={m.adjusted_volume} onChange={(e) => onVolume(origIdx, mi, e.target.value)}
                className="w-14 px-1.5 py-0.5 rounded-md border border-slate-200 text-right tabular-nums text-xs outline-none transition-all focus:border-sky-500 focus:ring-2 ring-sky-100" />
            </div>
          </td>
          <td className="px-1.5 py-1 border-r border-slate-100">
            <div className="flex items-center justify-end gap-1">
              <span className="text-xs text-slate-400 tabular-nums w-9 text-right shrink-0">{fmt(m.ai_rate)}</span>
              <input type="number" value={m.adjusted_rate} onChange={(e) => onRate(origIdx, mi, e.target.value)}
                className="w-14 px-1.5 py-0.5 rounded-md border border-slate-200 text-right tabular-nums text-xs outline-none transition-all focus:border-sky-500 focus:ring-2 ring-sky-100" />
            </div>
          </td>
          <td className="px-1.5 py-1 border-r border-slate-100">
            <AIAdjustedCell ai={m.ai_revenue} adjusted={m.adjusted_revenue} editable onChange={(v) => onRevenue(origIdx, mi, v)}
              onFocus={() => onRevenueFocus?.(c.customer_name, m.period, m.adjusted_revenue)}
              onBlur={() => onRevenueBlur?.(c.customer_name, m.period)}
              width="w-16" />
          </td>
          <td className="px-0.5 py-1 text-center border-r border-slate-300">
            <button onClick={() => onOpenReason(c, m.period)}
              className={`w-6 h-6 rounded-md flex items-center justify-center transition-all mx-auto ${m.override ? "bg-sky-100 text-sky-600 border border-sky-200 hover:bg-sky-200" : "text-slate-300 hover:text-sky-500 hover:bg-sky-50"}`}
              title={m.override ? `${m.override.reason}${m.override.note ? ": " + m.override.note : ""}` : `Add reason for ${m.period}`}>
              <FiMessageSquare size={11} />
            </button>
          </td>
        </React.Fragment>
      ))}
      <td className={`px-2 py-1 text-right tabular-nums text-xs font-semibold border-r border-slate-100 ${varAmt > 0 ? "text-emerald-600" : varAmt < 0 ? "text-red-500" : "text-slate-400"}`}>{varAmt === 0 ? "—" : `${varAmt > 0 ? "+" : ""}${fmt(varAmt)}`}</td>
      <td className="px-1.5 py-1 text-center border-l border-slate-100">
        <button onClick={() => onOpenReason(c)}
          className={`flex items-center gap-1 px-1.5 py-1 rounded-md transition-all max-w-[115px] mx-auto ${c.reason ? "bg-sky-100 text-sky-700 border border-sky-200 hover:bg-sky-200" : "text-slate-300 hover:text-sky-500 hover:bg-sky-50"}`}
          title={c.reason ? `${c.reason.reason}${c.reason.note ? ": " + c.reason.note : ""}` : "Add override reason"}>
          <FiMessageSquare size={11} className="shrink-0" />
          {c.reason && <span className="text-xs font-semibold truncate">{c.reason.reason}</span>}
        </button>
      </td>
    </tr>
  );
});

const API_BASE = `${API_BASE_URL}/api/v1/budget/revenue`;
const round2 = (n) => Math.round(n * 100) / 100;

const TABS = [
  { id: "existing", label: "Existing Customers", icon: <FiBarChart2 size={13} /> },
  { id: "pipeline", label: "New Customers (Pipeline)", icon: <FiTrendingUp size={13} /> },
  { id: "strategic", label: "Strategic Initiative", icon: <FiFlag size={13} /> },
];

async function parseErr(res) {
  try {
    const d = await res.json();
    return d?.detail ? (typeof d.detail === "string" ? d.detail : JSON.stringify(d.detail)) : `HTTP ${res.status}`;
  } catch { return `HTTP ${res.status}`; }
}

const RevenueBudgeting = () => {
  const { token } = useContext(AuthContext);
  const { toasts, add } = useToast();
  const [activeTab, setActiveTab] = useState("existing");
  const [existingView, setExistingView] = useState("summary");
  const [stage, setStage] = useState("draft");
  const [modal, setModal] = useState({ open: false, target: null });
  const [revenueMode] = useState("weighted"); // Pipeline revenue is always probability-weighted (Volume x Rate x Probability%)

  const { budgetYear, fiscalYearStartMonth } = useContext(BudgetYearContext);
  const { methodology } = useContext(BudgetMethodologyContext);
  const { guidelines, frequency } = useContext(BudgetGuidelinesContext);
  const revenueExceptions = useExceptions(budgetYear, "revenue");
  const [exceptionDrawerCust, setExceptionDrawerCust] = useState(null);
  // Top-Down allocation edits are local-only in this static-data-first pass
  // (see Budget Setup & Guidelines) — keyed by customer_name.
  const [revenueAllocAdj, setRevenueAllocAdj] = useState({});
  // Same formula the backend uses (current_fiscal_year = budget_year - 1,
  // prior_fiscal_year = budget_year - 2 — verified against
  // _compute_existing_customers in src/budget/controller.py) so column
  // headers can show the real year (e.g. "Prior Year (FY2025)") without an
  // extra round trip through API response state.
  const currentFiscalYear = budgetYear - 1;
  const priorFiscalYear = budgetYear - 2;
  const [departmentId, setDepartmentId] = useState(""); // "" = all departments
  const [currencyFilter, setCurrencyFilter] = useState("actualvalue"); // actualvalue | thousands | millions — same convention as Revenue Forecast's "Actual" filter
  // Planning Frequency (Monthly/Quarterly/Annual) is a global, CFO-set value
  // from Budget Setup & Guidelines (BudgetGuidelinesContext) — no page-local
  // toggle here anymore, so every Budgeting module reads the same setting.

  const [filterText, setFilterText] = useState("");
  const [fSegment, setFSegment] = useState("All");
  const [fRegion, setFRegion] = useState("All");
  const [fConfidence, setFConfidence] = useState("All");
  // Which ExceptionSummaryStrip tile is active — "all" | "within" |
  // "exception" | "pending" | "approved" | "rejected". Drives filteredCustomers
  // below so every tile (not just "Exceptions") narrows the table when clicked.
  const [fStatus, setFStatus] = useState("all");

  // Pagination — Summary/Drivers (492 customers × up to 12 monthly periods)
  // and Pipeline (4,500+ opportunities) rendered every row into one flat
  // <tbody> with no windowing, so switching tabs/navigating away meant
  // mounting/unmounting tens of thousands of DOM nodes synchronously,
  // which is what made the page feel like it hung. Slicing to a page keeps
  // the mounted DOM small; footer/KPI totals still sum the full filtered
  // dataset (see summaryTotals/pipelineTotal etc.), independent of the page.
  const CUSTOMER_PAGE_SIZE = 100;
  const PIPELINE_PAGE_SIZE = 150;
  const [customerPage, setCustomerPage] = useState(1);
  const [pipelinePage, setPipelinePage] = useState(1);
  useEffect(() => { setCustomerPage(1); }, [filterText, fSegment, fRegion, fConfidence, fStatus]);
  useEffect(() => { setPipelinePage(1); }, [budgetYear]);

  // Column-visibility toggles for the Summary table — Department defaults
  // off since it's a derived ("primary department by revenue") value, not a
  // core field; the rest default on to match the table's existing look.
  const [visibleCols, setVisibleCols] = useState({
    department: false, segment: true, region: true, confidence: true, status: true, reason: true,
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const toggleCol = (key) => setVisibleCols((prev) => ({ ...prev, [key]: !prev[key] }));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [editable, setEditable] = useState(true);
  const [notes, setNotes] = useState([]);
  const [meta, setMeta] = useState({ budget_years: [2026, 2027, 2028], currencies: ["USD"], departments: [] });
  const [pipeline, setPipeline] = useState([]);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineLoaded, setPipelineLoaded] = useState(false);
  const [strategic, setStrategic] = useState([]);
  const [strategicLoading, setStrategicLoading] = useState(false);
  const [strategicLoaded, setStrategicLoaded] = useState(false);
  const [showNewInitiative, setShowNewInitiative] = useState(false);
  const [showNewPipelineCustomer, setShowNewPipelineCustomer] = useState(false);

  // Remembers each Revenue "Adjusted" cell's value at focus time (keyed by
  // `${customer_name}|${period}`), so onBlur can tell whether the user
  // actually changed it before offering "apply to all 12 months".
  const focusValuesRef = useRef({});
  const [applyAllMonthsModal, setApplyAllMonthsModal] = useState({ open: false, customerName: null, value: null });
  const [applyingAllMonths, setApplyingAllMonths] = useState(false);

  // Lightweight aggregate-only totals for the KPI strip — fetched on every
  // load so Pipeline Revenue / Strategic Revenue show real numbers
  // immediately, without waiting for the user to open those (lazily-loaded,
  // up to ~4,500-row) tabs first.
  const [kpiPipeline, setKpiPipeline] = useState({ revenue: 0, count: 0, customerCount: 0, newCustomerTarget: null });
  const [kpiStrategic, setKpiStrategic] = useState({ revenue: 0, count: 0 });

  // `period: null` = the yearly bulk-set button (unchanged legacy behavior);
  // `period` set = the new per-month reason button, scoped to one customer+month.
  const [reasonModal, setReasonModal] = useState({ open: false, customer: null, period: null });
  const [savingReason, setSavingReason] = useState(false);

  // ── Unsaved-changes guard — mirrors RevenueForecasting.jsx's hasChanges /
  // guardedAction / beforeunload pattern so in-progress edits never get
  // silently discarded by a tab switch, filter change, or page reload.
  const [hasChanges, setHasChanges] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [guardSaving, setGuardSaving] = useState(false);

  // Dirty-key tracking — Save used to always resend every row of every
  // dataset (up to ~6,000 existing-customer rows + thousands of pipeline
  // rows) regardless of what was actually touched, which is what made the
  // save slow/prone to timing out. Only the keys added here get sent.
  const dirtyExistingRef = useRef(new Set());   // `${customer_name}::${period}`
  const dirtyPipelineRef = useRef(new Set());   // opportunity_id
  const dirtyStrategicRef = useRef(new Set());  // id

  // Guards against stale fetchExisting responses when filters (department,
  // currency, year) change quickly — same fix RevenueForecasting.jsx uses.
  // Without this, a fast filter toggle can leave an older, slower response
  // overwriting the table with stale data after the newer one already landed.
  const existingFetchSeqRef       = useRef(0);
  const existingFetchAbortCtrlRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (!hasChanges) return; e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [hasChanges]);

  const guardedAction = useCallback((action) => {
    if (hasChanges) { setPendingAction(() => action); setShowUnsavedModal(true); }
    else action();
  }, [hasChanges]);

  const authHeaders = useCallback((json) => ({
    Authorization: `Bearer ${token}`,
    accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
  }), [token]);

  // Existing Customers + workflow load eagerly (default tab, always-visible
  // workflow bar). Pipeline and Strategic are large/secondary and load lazily
  // — only when their tab is actually opened — so switching to "Existing
  // Customers" never pays for fetching 4,500+ pipeline rows it doesn't need.
  // Planning Frequency is no longer sent as a `view` param — the backend
  // derives it itself from Budget Setup & Guidelines (single source of
  // truth), so a bookmarked URL or stale local state can't drift from what
  // the CFO actually configured. A `frequency` change still needs to
  // trigger a refetch, though, hence it staying in this callback's deps.
  const fetchExisting = useCallback(async () => {
    /* Cancel any in-flight request and bump the sequence so only the latest
       response can write state — protects against races when department/
       currency/year filters change rapidly. */
    if (existingFetchAbortCtrlRef.current) existingFetchAbortCtrlRef.current.abort();
    const controller = new AbortController();
    existingFetchAbortCtrlRef.current = controller;
    const seq = ++existingFetchSeqRef.current;

    setLoading(true);
    setError(null);
    try {
      const existingQuery = new URLSearchParams({ months: "12", currency: "USD", currency_filter: currencyFilter });
      if (departmentId) existingQuery.set("department_id", departmentId);
      const [existingRes, workflowRes] = await Promise.all([
        fetch(`${API_BASE}/${budgetYear}/existing-customers?${existingQuery}`, { headers: authHeaders(), signal: controller.signal }),
        fetch(`${API_BASE}/${budgetYear}/workflow`, { headers: authHeaders(), signal: controller.signal }),
      ]);
      for (const res of [existingRes, workflowRes]) {
        if (!res.ok) throw new Error(await parseErr(res));
      }
      const existingData = await existingRes.json();
      const workflowData = await workflowRes.json();

      /* Drop the response if a newer fetch has started in the meantime. */
      if (seq !== existingFetchSeqRef.current) return;

      setPeriods(existingData.periods || []);
      setCustomers(normalizeCustomers(existingData.customers));
      setEditable(existingData.editable !== false);
      setNotes(existingData.notes || []);
      if (existingData.meta) setMeta(existingData.meta);
      setStage(workflowData.stage || "draft");
    } catch (e) {
      if (e?.name === "AbortError") return;            // newer request aborted us
      if (seq !== existingFetchSeqRef.current) return;  // result is stale
      setError(e.message || "Failed to load Revenue Budgeting data.");
    } finally {
      if (seq === existingFetchSeqRef.current) setLoading(false);
    }
  }, [budgetYear, departmentId, currencyFilter, frequency, authHeaders, fiscalYearStartMonth]);

  const fetchPipeline = useCallback(async () => {
    setPipelineLoading(true);
    try {
      const res = await fetch(`${API_BASE}/${budgetYear}/pipeline?currency_filter=${currencyFilter}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(await parseErr(res));
      const data = await res.json();
      setPipeline(normalizeRevenueRows(data.opportunities));
      setPipelineLoaded(true);
    } catch (e) {
      add(`Failed to load pipeline: ${e.message}`, "error");
    } finally {
      setPipelineLoading(false);
    }
  }, [budgetYear, currencyFilter, authHeaders, add]);

  const fetchStrategic = useCallback(async () => {
    setStrategicLoading(true);
    try {
      const res = await fetch(`${API_BASE}/${budgetYear}/strategic?currency_filter=${currencyFilter}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(await parseErr(res));
      const data = await res.json();
      setStrategic(normalizeRevenueRows(data.initiatives));
      setStrategicLoaded(true);
    } catch (e) {
      add(`Failed to load strategic initiatives: ${e.message}`, "error");
    } finally {
      setStrategicLoading(false);
    }
  }, [budgetYear, currencyFilter, authHeaders, add]);

  const fetchKpis = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/${budgetYear}/kpis?currency_filter=${currencyFilter}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(await parseErr(res));
      const data = await res.json();
      setKpiPipeline({
        revenue: parseMoney(data.pipeline_revenue) || 0, count: data.pipeline_count || 0,
        customerCount: data.pipeline_customer_count || 0, newCustomerTarget: data.new_customer_target ?? null,
      });
      setKpiStrategic({ revenue: parseMoney(data.strategic_revenue) || 0, count: data.strategic_count || 0 });
    } catch (e) {
      // Non-fatal — the KPI strip just falls back to 0 until the Pipeline/
      // Strategic tabs are opened, same as before this endpoint existed.
      add(`Failed to load KPI totals: ${e.message}`, "error");
    }
  }, [budgetYear, currencyFilter, authHeaders, add]);

  useEffect(() => { fetchExisting(); }, [fetchExisting]);
  useEffect(() => { fetchKpis(); }, [fetchKpis]);
  // Invalidate the lazily-loaded tabs whenever the budget year changes (their
  // data — adjustments, CRM opportunities — is scoped per year).
  useEffect(() => { setPipelineLoaded(false); setStrategicLoaded(false); }, [budgetYear]);
  useEffect(() => {
    if (activeTab === "pipeline" && !pipelineLoaded && !pipelineLoading) fetchPipeline();
  }, [activeTab, pipelineLoaded, pipelineLoading, fetchPipeline]);
  useEffect(() => {
    if (activeTab === "strategic" && !strategicLoaded && !strategicLoading) fetchStrategic();
  }, [activeTab, strategicLoaded, strategicLoading, fetchStrategic]);

  const refetchLoaded = useCallback(() => {
    fetchExisting();
    fetchKpis();
    if (pipelineLoaded) fetchPipeline();
    if (strategicLoaded) fetchStrategic();
  }, [fetchExisting, fetchKpis, fetchPipeline, fetchStrategic, pipelineLoaded, strategicLoaded]);

  // Department name for the selected department_id — the dropdown carries
  // ids (a real GL column), but each customer's `department` field is the
  // derived primary-department *name* (see _customer_primary_department on
  // the backend), so the row filter below has to compare against the name.
  const selectedDepartmentName = useMemo(
    () => meta.departments.find((d) => d.id === departmentId)?.name,
    [meta.departments, departmentId]
  );

  const filteredCustomers = useMemo(
    () => customers.filter((c) =>
      c.customer_name.toLowerCase().includes(filterText.toLowerCase()) &&
      (!departmentId || c.department === selectedDepartmentName) &&
      (fSegment === "All" || c.segment === fSegment) &&
      (fRegion === "All" || c.region === fRegion) &&
      (fConfidence === "All" || c.confidence === fConfidence) &&
      (fStatus === "all" ||
        (fStatus === "within" && !c.exception) ||
        (fStatus === "exception" && !!c.exception) ||
        (fStatus === "pending" && c.exception?.approval_status === "pending") ||
        (fStatus === "approved" && c.exception?.approval_status === "approved") ||
        (fStatus === "rejected" && c.exception?.approval_status === "rejected"))
    ),
    [customers, filterText, departmentId, selectedDepartmentName, fSegment, fRegion, fConfidence, fStatus]
  );

  const customerPageCount = Math.max(1, Math.ceil(filteredCustomers.length / CUSTOMER_PAGE_SIZE));
  const safeCustomerPage = Math.min(Math.max(1, customerPage), customerPageCount);
  const pagedCustomers = useMemo(() => {
    const start = (safeCustomerPage - 1) * CUSTOMER_PAGE_SIZE;
    return filteredCustomers.slice(start, start + CUSTOMER_PAGE_SIZE);
  }, [filteredCustomers, safeCustomerPage]);

  // Column totals for the Summary table footer — per-period AI/Adjusted
  // sums across all filtered customers, plus a grand Total AI/Adj pair.
  const summaryTotals = useMemo(() => {
    const perPeriod = periods.map((p) => {
      let ai = 0, adj = 0;
      filteredCustomers.forEach((c) => {
        const m = c.months.find((mm) => mm.period === p);
        if (m) { ai += m.ai_revenue || 0; adj += Number(m.adjusted_revenue) || 0; }
      });
      return { period: p, ai, adj };
    });
    const priorYear = filteredCustomers.reduce((a, c) => a + (c.prior_year_actual || 0), 0);
    const currForecast = filteredCustomers.reduce((a, c) => a + (c.current_forecast || 0), 0);
    const forecastExit = filteredCustomers.reduce((a, c) => a + (c.forecast_exit || 0), 0);
    const totalAi = perPeriod.reduce((a, p) => a + p.ai, 0);
    const totalAdj = perPeriod.reduce((a, p) => a + p.adj, 0);
    return { perPeriod, priorYear, currForecast, forecastExit, totalAi, totalAdj, variance: totalAdj - totalAi };
  }, [filteredCustomers, periods]);

  // Per-period adjusted-Volume sums for the Drivers table footer — the
  // Revenue side reuses summaryTotals.perPeriod (same underlying month
  // data) so it isn't recomputed twice.
  const driverVolumeTotals = useMemo(
    () => periods.map((p) => filteredCustomers.reduce((a, c) => {
      const m = c.months.find((mm) => mm.period === p);
      return a + (m ? Number(m.adjusted_volume) || 0 : 0);
    }, 0)),
    [filteredCustomers, periods]
  );

  // O(1) name→index lookup instead of `customers.findIndex(...)` per row
  // (was O(n) per row, O(n²) total across 492 rows).
  const customerIndexByName = useMemo(() => {
    const map = new Map();
    customers.forEach((c, i) => map.set(c.customer_name, i));
    return map;
  }, [customers]);

  const openReasonModal = useCallback((customer, period = null) => setReasonModal({ open: true, customer, period }), []);

  // KPI-strip totals — driven by filteredCustomers (Department is already
  // baked into `customers` via the server-side refetch; Segment/Region/
  // Confidence are applied here) so the KPI cards always match what the
  // Summary table's own Grand Total row is showing, instead of silently
  // staying pinned to the full unfiltered company-wide numbers.
  const totals = useMemo(() => {
    const ai = filteredCustomers.reduce((s, c) => s + c.months.reduce((a, m) => a + m.ai_revenue, 0), 0);
    const adj = filteredCustomers.reduce((s, c) => s + c.months.reduce((a, m) => a + (Number(m.adjusted_revenue) || 0), 0), 0);
    const priorYear = filteredCustomers.reduce((s, c) => s + c.prior_year_actual, 0);
    const currentForecast = filteredCustomers.reduce((s, c) => s + c.current_forecast, 0);
    const forecastExit = filteredCustomers.reduce((s, c) => s + c.forecast_exit, 0);
    return { ai, adj, priorYear, currentForecast, forecastExit, variance: adj - ai, variancePct: ai ? ((adj - ai) / ai) * 100 : 0 };
  }, [filteredCustomers]);

  const pipelineTotal = useMemo(() => pipeline.reduce((s, p) => s + (Number(p.adjusted_revenue) || 0), 0), [pipeline]);

  const pipelinePageCount = Math.max(1, Math.ceil(pipeline.length / PIPELINE_PAGE_SIZE));
  const safePipelinePage = Math.min(Math.max(1, pipelinePage), pipelinePageCount);
  const pagedPipeline = useMemo(() => {
    const start = (safePipelinePage - 1) * PIPELINE_PAGE_SIZE;
    return pipeline.slice(start, start + PIPELINE_PAGE_SIZE);
  }, [pipeline, safePipelinePage]);
  const strategicTotal = useMemo(() => strategic.reduce((s, x) => s + (Number(x.adjusted_revenue) || 0), 0), [strategic]);

  // Grand-total footer figures for the Pipeline table — Volume is summed
  // like Revenue; Probability is averaged (it's a %, not additive); Rate
  // is derived as Revenue ÷ Volume so Revenue = Volume × Rate still holds
  // at the total-row level, same as every individual row.
  const pipelineTotals = useMemo(() => {
    const volume = pipeline.reduce((s, p) => s + (Number(p.adjusted_volume) || 0), 0);
    const avgProbability = pipeline.length ? pipeline.reduce((s, p) => s + (Number(p.adjusted_probability) || 0), 0) / pipeline.length : 0;
    return { volume, avgProbability, avgRate: volume ? pipelineTotal / volume : 0 };
  }, [pipeline, pipelineTotal]);

  const strategicTotals = useMemo(() => {
    const volume = strategic.reduce((s, x) => s + (Number(x.adjusted_volume) || 0), 0);
    return { volume, avgRate: volume ? strategicTotal / volume : 0 };
  }, [strategic, strategicTotal]);
  const highRiskCount = useMemo(() => filteredCustomers.filter((c) => {
    const varAmt = c.months.reduce((a, m) => a + (Number(m.adjusted_revenue) || 0), 0) - c.months.reduce((a, m) => a + m.ai_revenue, 0);
    return c.confidence === "Low" || varAmt < 0;
  }).length, [filteredCustomers]);
  const revenueGrowthPct = totals.priorYear ? ((totals.currentForecast - totals.priorYear) / totals.priorYear) * 100 : 0;

  // ── Bidirectional Revenue ⇄ Volume/Rate sync (local, instant; persisted on Save) ──
  const withCustomerMonth = (idx, mi, mutate) => { setHasChanges(true); setCustomers((prev) => {
    const next = [...prev];
    const c = { ...next[idx], months: next[idx].months.map((m) => ({ ...m })) };
    mutate(c.months[mi]);
    dirtyExistingRef.current.add(`${c.customer_name}::${c.months[mi].period}`);
    next[idx] = c;
    return next;
  }); };

  // Wrapped in useCallback so their identity is stable across renders —
  // required for the memoized row components below to actually skip
  // re-rendering unrelated rows on every keystroke.
  const updateRevenue = useCallback((idx, mi, value) => withCustomerMonth(idx, mi, (m) => {
    const rev = value === "" ? "" : Number(value);
    m.adjusted_revenue = rev;
    const rate = Number(m.adjusted_rate) || 0;
    if (rev !== "" && rate) m.adjusted_volume = round2(rev / rate);
  }), []);
  const updateVolume = useCallback((idx, mi, value) => withCustomerMonth(idx, mi, (m) => {
    const vol = value === "" ? "" : Number(value);
    m.adjusted_volume = vol;
    const rate = Number(m.adjusted_rate) || 0;
    if (vol !== "") m.adjusted_revenue = round2(vol * rate);
  }), []);
  const updateRate = useCallback((idx, mi, value) => withCustomerMonth(idx, mi, (m) => {
    const rate = value === "" ? "" : Number(value);
    m.adjusted_rate = rate;
    const vol = Number(m.adjusted_volume) || 0;
    if (rate !== "") m.adjusted_revenue = round2(vol * rate);
  }), []);

  // Track each Revenue cell's value at focus time so onBlur can tell whether
  // the user actually changed it before offering "apply to all 12 months".
  const handleRevenueFocus = useCallback((customerName, period, value) => {
    focusValuesRef.current[`${customerName}|${period}`] = value;
  }, []);
  const handleRevenueBlur = useCallback((customerName, period) => {
    const key = `${customerName}|${period}`;
    const startVal = focusValuesRef.current[key];
    delete focusValuesRef.current[key];
    if (!editable) return;
    const cust = customers.find((c) => c.customer_name === customerName);
    const m = cust?.months.find((mm) => mm.period === period);
    if (!m) return;
    const curNum = toBackendNumber(m.adjusted_revenue);
    if (curNum == null || toBackendNumber(startVal) === curNum) return;
    setApplyAllMonthsModal({ open: true, customerName, value: curNum });
  }, [editable, customers]);
  const closeApplyAllMonthsModal = () => setApplyAllMonthsModal({ open: false, customerName: null, value: null });

  // "Yes, apply to all 12 months" — write the value into every visible month
  // column locally (instant feedback) and persist it across all 12 periods
  // on the backend in one shot (budget_revenue_adjustments is one row per
  // month, and the budget has a single workflow stage for the whole year —
  // no per-quarter juggling needed here, unlike Forecasting).
  const applyRevenueToAllMonths = async () => {
    const { customerName, value } = applyAllMonthsModal;
    if (!customerName) { closeApplyAllMonthsModal(); return; }
    setApplyingAllMonths(true);
    try {
      const idx = customers.findIndex((c) => c.customer_name === customerName);
      if (idx !== -1) {
        customers[idx].months.forEach((m, mi) => updateRevenue(idx, mi, value));
      }
      const res = await fetch(`${API_BASE}/${budgetYear}/existing-customers/apply-all-months`, {
        method: "PATCH", headers: authHeaders(true),
        body: JSON.stringify({ customer_name: customerName, value }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "Failed to apply to all 12 months");
      add(`Applied to all 12 months for ${customerName} ✓`, "success");
    } catch (e) {
      add(`Failed to apply to all 12 months: ${e.message}`, "error");
    } finally {
      setApplyingAllMonths(false);
      closeApplyAllMonthsModal();
    }
  };

  // ── Pipeline sync ──
  const withPipeline = (idx, mutate) => {
    setHasChanges(true);
    setPipeline((prev) => prev.map((p, i) => {
      if (i !== idx) return p;
      const next = mutate({ ...p });
      dirtyPipelineRef.current.add(next.opportunity_id);
      return next;
    }));
  };
  const pipelineFactor = (p) => (revenueMode === "weighted" ? (Number(p.adjusted_probability) || 0) / 100 : 1);
  const updatePipelineVolume = useCallback((idx, value) => withPipeline(idx, (p) => {
    const vol = value === "" ? "" : Number(value);
    p.adjusted_volume = vol;
    if (vol !== "") p.adjusted_revenue = round2(vol * (Number(p.adjusted_rate) || 0) * pipelineFactor(p));
    return p;
  }), [revenueMode]);
  const updatePipelineRate = useCallback((idx, value) => withPipeline(idx, (p) => {
    const rate = value === "" ? "" : Number(value);
    p.adjusted_rate = rate;
    if (rate !== "") p.adjusted_revenue = round2((Number(p.adjusted_volume) || 0) * rate * pipelineFactor(p));
    return p;
  }), [revenueMode]);
  const updatePipelineProbability = useCallback((idx, value) => withPipeline(idx, (p) => {
    const prob = value === "" ? "" : Number(value);
    p.adjusted_probability = prob;
    const factor = revenueMode === "weighted" ? (prob === "" ? 0 : prob / 100) : 1;
    if (prob !== "") p.adjusted_revenue = round2((Number(p.adjusted_volume) || 0) * (Number(p.adjusted_rate) || 0) * factor);
    return p;
  }), [revenueMode]);
  const updatePipelineRevenue = useCallback((idx, value) => withPipeline(idx, (p) => {
    const rev = value === "" ? "" : Number(value);
    p.adjusted_revenue = rev;
    const denom = (Number(p.adjusted_rate) || 0) * pipelineFactor(p);
    if (rev !== "" && denom) p.adjusted_volume = round2(rev / denom);
    return p;
  }), [revenueMode]);
  const deletePipelineRow = useCallback(async (opportunityId) => {
    try {
      const res = await fetch(`${API_BASE}/${budgetYear}/pipeline/${encodeURIComponent(opportunityId)}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error(await parseErr(res));
      dirtyPipelineRef.current.delete(opportunityId);
      setPipeline((prev) => prev.filter((p) => p.opportunity_id !== opportunityId));
      add("Pipeline customer removed.", "success");
    } catch (e) {
      add(`Failed to remove customer: ${e.message}`, "error");
    }
  }, [budgetYear, authHeaders, add]);

  // ── Strategic sync ──
  const withStrategic = (idx, mutate) => {
    setHasChanges(true);
    setStrategic((prev) => prev.map((s, i) => {
      if (i !== idx) return s;
      const next = mutate({ ...s });
      dirtyStrategicRef.current.add(next.id);
      return next;
    }));
  };
  const updateStrategicVolume = useCallback((idx, value) => withStrategic(idx, (s) => {
    const vol = value === "" ? "" : Number(value);
    s.adjusted_volume = vol;
    if (vol !== "") s.adjusted_revenue = round2(vol * (Number(s.adjusted_rate) || 0));
    return s;
  }), []);
  const updateStrategicRate = useCallback((idx, value) => withStrategic(idx, (s) => {
    const rate = value === "" ? "" : Number(value);
    s.adjusted_rate = rate;
    if (rate !== "") s.adjusted_revenue = round2((Number(s.adjusted_volume) || 0) * rate);
    return s;
  }), []);
  const updateStrategicRevenue = useCallback((idx, value) => withStrategic(idx, (s) => {
    const rev = value === "" ? "" : Number(value);
    s.adjusted_revenue = rev;
    const rate = Number(s.adjusted_rate) || 0;
    if (rev !== "" && rate) s.adjusted_volume = round2(rev / rate);
    return s;
  }), []);

  const handleWorkflowAction = (target) => setModal({ open: true, target });
  const confirmWorkflow = async (target, comment) => {
    try {
      const res = await fetch(`${API_BASE}/${budgetYear}/workflow`, {
        method: "PATCH", headers: authHeaders(true), body: JSON.stringify({ target_stage: target, comment }),
      });
      if (!res.ok) throw new Error(await parseErr(res));
      setStage(target);
      add(`Stage moved to ${target}.`, "success");
    } catch (e) {
      add(`Failed to update workflow: ${e.message}`, "error");
    } finally {
      setModal({ open: false, target: null });
    }
  };

  const [compareModal, setCompareModal] = useState({ open: false, loading: false, data: null });
  const [exporting, setExporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [templateUploadOpen, setTemplateUploadOpen] = useState(false);
  const [templateUploading, setTemplateUploading] = useState(false);
  const [templateUploadError, setTemplateUploadError] = useState(null);
  const [downloadingPipelineTemplate, setDownloadingPipelineTemplate] = useState(false);
  const [pipelineTemplateUploadOpen, setPipelineTemplateUploadOpen] = useState(false);
  const [pipelineTemplateUploading, setPipelineTemplateUploading] = useState(false);
  const [pipelineTemplateUploadError, setPipelineTemplateUploadError] = useState(null);

  const openCompareForecast = async () => {
    setCompareModal({ open: true, loading: true, data: null });
    try {
      const res = await fetch(`${API_BASE}/${budgetYear}/compare-forecast?currency_filter=${currencyFilter}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(await parseErr(res));
      const data = await res.json();
      data.customers = normalizeCompareRows(data.customers);
      if (data.totals) data.totals = normalizeCompareRows([data.totals])[0];
      setCompareModal({ open: true, loading: false, data });
    } catch (e) {
      add(`Failed to load comparison: ${e.message}`, "error");
      setCompareModal({ open: false, loading: false, data: null });
    }
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const res = await fetch(`${API_BASE}/${budgetYear}/export`, { headers: authHeaders() });
      if (!res.ok) throw new Error(await parseErr(res));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `revenue-budget-FY${budgetYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      add("Excel export downloaded.", "success");
    } catch (e) {
      add(`Export failed: ${e.message}`, "error");
    } finally {
      setExporting(false);
    }
  };

  // Existing Customers has two views (Summary ⇄ Drivers, `existingView`) that
  // share one underlying DB row — the template/upload endpoints are split the
  // same way as Forecasting's Summary/Drivers tabs (revenue-adjustments vs.
  // driver-adjustments), so whichever view is active when the button is
  // clicked determines which template gets downloaded/uploaded.
  const templateEndpointSegment = existingView === "drivers" ? "driver-adjustments" : "revenue-adjustments";

  const downloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const res = await fetch(`${API_BASE}/${budgetYear}/excel-template/${templateEndpointSegment}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(await parseErr(res));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `revenue-budget-${existingView}-template-FY${budgetYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      add("Template downloaded ✓", "success");
    } catch (e) {
      add(`Download failed: ${e.message}`, "error");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleTemplateUpload = async (file) => {
    setTemplateUploading(true);
    setTemplateUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/${budgetYear}/excel-upload/${templateEndpointSegment}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
      });
      if (!res.ok) throw new Error(await parseErr(res));
      add(`${existingView === "drivers" ? "Driver" : "Revenue"} adjustments uploaded ✓`, "success");
      setTemplateUploadOpen(false);
      refetchLoaded();
    } catch (e) {
      setTemplateUploadError(e.message);
      add(`Upload failed: ${e.message}`, "error");
    } finally {
      setTemplateUploading(false);
    }
  };

  const downloadPipelineTemplate = async () => {
    setDownloadingPipelineTemplate(true);
    try {
      const res = await fetch(`${API_BASE}/${budgetYear}/excel-template/pipeline`, { headers: authHeaders() });
      if (!res.ok) throw new Error(await parseErr(res));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `revenue-budget-pipeline-template-FY${budgetYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      add("Template downloaded ✓", "success");
    } catch (e) {
      add(`Download failed: ${e.message}`, "error");
    } finally {
      setDownloadingPipelineTemplate(false);
    }
  };

  const handlePipelineTemplateUpload = async (file) => {
    setPipelineTemplateUploading(true);
    setPipelineTemplateUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/${budgetYear}/excel-upload/pipeline?mode=${revenueMode}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
      });
      if (!res.ok) throw new Error(await parseErr(res));
      add("Pipeline adjustments uploaded ✓", "success");
      setPipelineTemplateUploadOpen(false);
      refetchLoaded();
    } catch (e) {
      setPipelineTemplateUploadError(e.message);
      add(`Upload failed: ${e.message}`, "error");
    } finally {
      setPipelineTemplateUploading(false);
    }
  };

  const toolbarAction = (label) => {
    if (label === "Compare Forecast") { openCompareForecast(); return; }
    if (label === "Export Excel") { exportExcel(); return; }
    if (label === "Download Template") { downloadTemplate(); return; }
    if (label === "Upload Excel") { setTemplateUploadOpen(true); return; }
    if (label === "Download Pipeline Template") { downloadPipelineTemplate(); return; }
    if (label === "Upload Pipeline Excel") { setPipelineTemplateUploadOpen(true); return; }
    add(`${label} — not implemented yet.`, "info");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only resend rows that were actually touched — sending all ~6,000
      // existing-customer rows / thousands of pipeline rows on every save
      // regardless of what changed was what made saves slow and prone to
      // timing out (or failing without persisting anything).
      const existingItems = !editable ? [] : customers.flatMap((c) =>
        c.months
          .filter((m) => dirtyExistingRef.current.has(`${c.customer_name}::${m.period}`))
          .map((m) => ({
            customer_name: c.customer_name, period: m.period,
            volume_adjusted: m.adjusted_volume === "" ? null : m.adjusted_volume,
            rate_adjusted: m.adjusted_rate === "" ? null : m.adjusted_rate,
            revenue_adjusted: m.adjusted_revenue === "" ? null : m.adjusted_revenue,
            override_reason: c.reason?.reason ?? null,
            override_note: c.reason?.note ?? null,
          }))
      );
      const pipelineItems = pipeline
        .filter((p) => dirtyPipelineRef.current.has(p.opportunity_id))
        .map((p) => ({
          opportunity_id: p.opportunity_id,
          volume_adjusted: p.adjusted_volume === "" ? null : p.adjusted_volume,
          rate_adjusted: p.adjusted_rate === "" ? null : p.adjusted_rate,
          probability_adjusted: p.adjusted_probability === "" ? null : p.adjusted_probability,
          revenue_adjusted: p.adjusted_revenue === "" ? null : p.adjusted_revenue,
          override_reason: p.override?.reason ?? null,
          override_note: p.override?.note ?? null,
        }));
      const dirtyStrategicRows = strategic.filter((s) => dirtyStrategicRef.current.has(s.id));

      // Each group is reported independently — a failure in one (e.g.
      // pipeline) doesn't hide whether the others actually persisted, and
      // only the groups that failed stay marked dirty for retry.
      const groups = [];
      if (existingItems.length) {
        groups.push({
          label: "Existing Customers",
          clear: () => dirtyExistingRef.current.clear(),
          run: () => fetch(`${API_BASE}/${budgetYear}/existing-customers`, { method: "PATCH", headers: authHeaders(true), body: JSON.stringify({ items: existingItems }) }),
        });
      }
      if (pipelineItems.length) {
        groups.push({
          label: "Pipeline",
          clear: () => dirtyPipelineRef.current.clear(),
          run: () => fetch(`${API_BASE}/${budgetYear}/pipeline`, { method: "PATCH", headers: authHeaders(true), body: JSON.stringify({ items: pipelineItems }) }),
        });
      }
      if (dirtyStrategicRows.length) {
        groups.push({
          label: "Strategic Initiatives",
          clear: () => dirtyStrategicRows.forEach((s) => dirtyStrategicRef.current.delete(s.id)),
          run: async () => {
            const rs = await Promise.all(dirtyStrategicRows.map((s) => fetch(`${API_BASE}/${budgetYear}/strategic/${s.id}`, {
              method: "PATCH", headers: authHeaders(true),
              body: JSON.stringify({
                adjusted_volume: s.adjusted_volume, adjusted_rate: s.adjusted_rate, adjusted_revenue: s.adjusted_revenue,
                override_reason: s.override?.reason ?? null, override_note: s.override?.note ?? null,
              }),
            })));
            const bad = rs.find((r) => !r.ok);
            return bad || rs[0];
          },
        });
      }

      if (!groups.length) { add("Nothing to save.", "info"); return; }

      const outcomes = await Promise.allSettled(groups.map((g) => g.run()));
      const failed = [];
      for (let i = 0; i < outcomes.length; i++) {
        const outcome = outcomes[i];
        const ok = outcome.status === "fulfilled" && outcome.value.ok;
        if (ok) { groups[i].clear(); }
        else {
          const detail = outcome.status === "fulfilled" ? await parseErr(outcome.value) : outcome.reason?.message || "Network error";
          failed.push(`${groups[i].label}: ${detail}`);
        }
      }

      if (failed.length) {
        add(`Save failed — ${failed.join("; ")}. Unsaved items were kept so you can retry.`, "error");
      } else {
        add("All modifications are successfully saved.", "success");
        setHasChanges(false);
        refetchLoaded();
      }
    } catch (e) {
      add(`Save failed: ${e.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleGuardSave = async () => {
    setGuardSaving(true);
    try {
      await handleSave();
    } finally {
      setGuardSaving(false);
      setShowUnsavedModal(false);
      const a = pendingAction; setPendingAction(null); a?.();
    }
  };
  const handleGuardDiscard = () => {
    setHasChanges(false);
    setShowUnsavedModal(false);
    const a = pendingAction; setPendingAction(null); a?.();
  };

  const segments = useMemo(() => [...new Set(customers.map((c) => c.segment).filter(Boolean))], [customers]);
  const regions = useMemo(() => [...new Set(customers.map((c) => c.region).filter(Boolean))], [customers]);


  // Existing Customers (User Budget) + Pipeline + Strategic — same
  // loaded-vs-snapshot fallback the individual Pipeline/Strategic cards
  // below use, so this always matches their totals.
  const totalRevenue = totals.adj
    + (pipelineLoaded ? pipelineTotal : kpiPipeline.revenue)
    + (strategicLoaded ? strategicTotal : kpiStrategic.revenue);

  const kpis = [
    { label: "Total Revenue", value: fmt(totalRevenue), sub: "Existing + Pipeline + Strategic", icon: <FiDollarSign size={16} /> },
    { label: "Existing Customer Revenue", value: fmt(totals.ai), sub: `${periods[0] || ""}–${periods[periods.length - 1] || ""}`, icon: <FiCpu size={16} /> },
    { label: "Existing Customer User Revenue", value: fmt(totals.adj), sub: "After department adjustments", icon: <FiTrendingUp size={16} /> },
    { label: "Variance", value: fmt(totals.variance), sub: fmtPct(totals.variancePct, { sign: true }) + " vs AI baseline", icon: <FiFlag size={16} /> },
    { label: "Forecast Exit", value: fmt(totals.forecastExit), sub: "Current fiscal year run-rate", icon: <FiBarChart2 size={16} /> },
    { label: "Revenue Growth %", value: fmtPct(revenueGrowthPct, { sign: true }), sub: "Current Forecast vs Prior Year", icon: <FiTrendingUp size={16} /> },
    // Once a tab has actually been opened, its live (possibly locally-edited)
    // total takes over from the lightweight KPI-endpoint snapshot fetched on load.
    { label: "Pipeline Revenue", value: fmt(pipelineLoaded ? pipelineTotal : kpiPipeline.revenue), sub: `${pipelineLoaded ? pipeline.length : kpiPipeline.count} CRM opportunities`, icon: <FiTrendingUp size={16} /> },
    { label: "New Customers (Pipeline)", value: `${kpiPipeline.customerCount} / ${kpiPipeline.newCustomerTarget ?? "—"}`, sub: "Accounts in pipeline vs. CFO target", icon: <FiFlag size={16} /> },
    { label: "Strategic Revenue", value: fmt(strategicLoaded ? strategicTotal : kpiStrategic.revenue), sub: `${strategicLoaded ? strategic.length : kpiStrategic.count} initiatives budgeted`, icon: <FiFlag size={16} /> },
    { label: "High-Risk Customers", value: `${highRiskCount}`, sub: "Low confidence or negative variance", icon: <FiAlertTriangle size={16} /> },
  ];

  return (
    <div className="planning-compact forecasting-pnl-theme revenue-forecast-page space-y-2 min-h-screen bg-sky-50 font-sans text-sky-900 pb-12">
      <ToastContainer toasts={toasts} />
      <WorkflowModal open={modal.open} target={modal.target} onClose={() => setModal({ open: false, target: null })} onConfirm={confirmWorkflow} />
      <UnsavedChangesModal open={showUnsavedModal} saving={guardSaving}
        onSave={handleGuardSave} onDiscard={handleGuardDiscard} onCancel={() => { setShowUnsavedModal(false); setPendingAction(null); }} />
      <ApplyAllMonthsModal open={applyAllMonthsModal.open} label={applyAllMonthsModal.customerName}
        value={applyAllMonthsModal.value} applying={applyingAllMonths}
        onYes={applyRevenueToAllMonths} onNo={closeApplyAllMonthsModal} />
      <ImportModal open={templateUploadOpen} onClose={() => setTemplateUploadOpen(false)}
        title={existingView === "drivers" ? "Upload Driver Adjustments" : "Upload Revenue Adjustments"}
        description={existingView === "drivers"
          ? "Upload your filled Drivers template. Only Volume/Rate are updated for matching Customer + Period rows; Revenue is recalculated automatically."
          : "Upload your filled Summary template. Only Revenue is updated for matching Customer + Period rows; Volume/Rate are left as-is."}
        uploading={templateUploading} error={templateUploadError} onUpload={handleTemplateUpload} />
      <ImportModal open={pipelineTemplateUploadOpen} onClose={() => setPipelineTemplateUploadOpen(false)}
        title="Upload Pipeline Adjustments"
        description="Upload your filled Pipeline template. Fields you leave blank (Probability/Volume/Rate/Revenue) keep their current value; Revenue is recalculated automatically when not supplied directly."
        uploading={pipelineTemplateUploading} error={pipelineTemplateUploadError} onUpload={handlePipelineTemplateUpload} />
      <ExceptionDrawer
        open={Boolean(exceptionDrawerCust)}
        exception={exceptionDrawerCust?.exception}
        entityLabel={exceptionDrawerCust?.customer_name || ""}
        systemValue={exceptionDrawerCust?.total_ai}
        userValue={exceptionDrawerCust?.total_adjusted}
        guidelineLabel="Revenue Growth Target"
        guidelineValue={exceptionDrawerCust ? `${exceptionDrawerCust.guideline_pct}%` : ""}
        onClose={() => setExceptionDrawerCust(null)}
        onChanged={async () => { await Promise.all([fetchExisting(), revenueExceptions.refetch()]); }}
      />
      <OverrideReasonModal
        open={reasonModal.open}
        context={reasonModal.customer ? (reasonModal.period ? `${reasonModal.customer.customer_name} — ${reasonModal.period}` : reasonModal.customer.customer_name) : ""}
        current={reasonModal.period
          ? reasonModal.customer?.months.find((m) => m.period === reasonModal.period)?.override
          : reasonModal.customer?.reason}
        readOnly={!editable}
        stage={stage}
        saving={savingReason}
        onClose={() => setReasonModal({ open: false, customer: null, period: null })}
        onSave={async ({ reason, note }) => {
          // Reason edits persist immediately (their own small PATCH) instead
          // of waiting for the main Save Changes button — otherwise closing
          // the tab/navigating away right after setting a reason silently
          // loses it, which would violate "remains visible after refresh."
          const name = reasonModal.customer.customer_name;
          const period = reasonModal.period;
          const idx = customerIndexByName.get(name);
          const c = customers[idx];
          if (!c) return;
          setSavingReason(true);
          try {
            if (period) {
              // Per-month reason — scoped to a single customer+period row so
              // sibling months (and their own reasons) are left untouched.
              // Volume/rate/revenue are re-sent at their current values (not
              // blanked) since the backend's upsert overwrites those columns
              // unconditionally on conflict, unlike override_reason/_note.
              const mi = c.months.findIndex((m) => m.period === period);
              if (mi === -1) return;
              const m = c.months[mi];
              const item = {
                customer_name: name, period,
                volume_adjusted: m.adjusted_volume === "" ? null : m.adjusted_volume,
                rate_adjusted: m.adjusted_rate === "" ? null : m.adjusted_rate,
                revenue_adjusted: m.adjusted_revenue === "" ? null : m.adjusted_revenue,
                override_reason: reason, override_note: note,
              };
              const res = await fetch(`${API_BASE}/${budgetYear}/existing-customers`, {
                method: "PATCH", headers: authHeaders(true), body: JSON.stringify({ items: [item] }),
              });
              if (!res.ok) throw new Error(await parseErr(res));
              dirtyExistingRef.current.delete(`${name}::${period}`);
              setCustomers((prev) => prev.map((row, i) => (i !== idx ? row : {
                ...row,
                months: row.months.map((mm) => (mm.period === period ? { ...mm, override: { reason, note } } : mm)),
              })));
              add(`Reason saved for ${period}.`, "success");
            } else {
              // Yearly bulk-set — unchanged: stamps the same reason across
              // every month's row as a quick shortcut; per-month edits made
              // afterward via the button above still override it individually.
              const items = c.months.map((m) => ({
                customer_name: name, period: m.period,
                volume_adjusted: m.adjusted_volume === "" ? null : m.adjusted_volume,
                rate_adjusted: m.adjusted_rate === "" ? null : m.adjusted_rate,
                revenue_adjusted: m.adjusted_revenue === "" ? null : m.adjusted_revenue,
                override_reason: reason, override_note: note,
              }));
              const res = await fetch(`${API_BASE}/${budgetYear}/existing-customers`, {
                method: "PATCH", headers: authHeaders(true), body: JSON.stringify({ items }),
              });
              if (!res.ok) throw new Error(await parseErr(res));
              c.months.forEach((m) => dirtyExistingRef.current.delete(`${name}::${m.period}`));
              setCustomers((prev) => prev.map((row) => (row.customer_name === name ? {
                ...row,
                reason: { reason, note },
                months: row.months.map((mm) => ({ ...mm, override: { reason, note } })),
              } : row)));
              add("Override reason saved.", "success");
            }
            setReasonModal({ open: false, customer: null, period: null });
          } catch (e) {
            add(`Failed to save override reason: ${e.message}`, "error");
          } finally {
            setSavingReason(false);
          }
        }}
      />
      {showNewInitiative && (
        <NewInitiativeModal
          onClose={() => setShowNewInitiative(false)}
          onCreate={async (form) => {
            try {
              const res = await fetch(`${API_BASE}/${budgetYear}/strategic`, { method: "POST", headers: authHeaders(true), body: JSON.stringify(form) });
              if (!res.ok) throw new Error(await parseErr(res));
              setShowNewInitiative(false);
              add("Strategic initiative created.", "success");
              await fetchStrategic();
            } catch (e) { add(`Failed to create initiative: ${e.message}`, "error"); }
          }}
        />
      )}
      {showNewPipelineCustomer && (
        <NewPipelineCustomerModal
          onClose={() => setShowNewPipelineCustomer(false)}
          onCreate={async (form) => {
            try {
              const res = await fetch(`${API_BASE}/${budgetYear}/pipeline`, { method: "POST", headers: authHeaders(true), body: JSON.stringify(form) });
              if (!res.ok) throw new Error(await parseErr(res));
              setShowNewPipelineCustomer(false);
              add("Pipeline customer added.", "success");
              await fetchPipeline();
            } catch (e) { add(`Failed to add customer: ${e.message}`, "error"); }
          }}
        />
      )}
      {compareModal.open && (
        <CompareForecastModal
          loading={compareModal.loading}
          data={compareModal.data}
          budgetYear={budgetYear}
          onClose={() => setCompareModal({ open: false, loading: false, data: null })}
        />
      )}

      <header className="forecasting-page-header bg-gradient-to-r from-sky-950 via-sky-900 to-sky-700 rounded-xl px-4 py-2.5 md:px-6 sticky -top-5 z-40 shadow-sm">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-bold text-white">Revenue Budgeting</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select value={currencyFilter} onChange={(e) => guardedAction(() => setCurrencyFilter(e.target.value))}
              className="px-3 py-1 rounded-lg bg-white border border-sky-200 text-sky-900 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200">
              {CURRENCY_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value} className="bg-white text-sky-900">{o.label}</option>)}
            </select>
            <button onClick={() => toolbarAction("Compare Forecast")}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 border border-white/20 text-white text-x font-semibold hover:bg-white/20 transition-colors">
              <FiBarChart2 size={12} /> Compare Forecast
            </button>
            <button onClick={() => toolbarAction("Export Excel")} disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 border border-white/20 text-white text-x font-semibold hover:bg-white/20 transition-colors disabled:opacity-50">
              <FiDownload size={12} /> {exporting ? "Exporting…" : "Export Excel"}
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <main className="max-w-screen-2xl mx-auto px-0 py-2">
          <TableSkeleton columns={8} rows={8} />
        </main>
      ) : error ? (
        <div className="bg-white border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 font-semibold mb-1">Could not load Revenue Budgeting data.</p>
          <p className="text-slate-500 text-s mb-4">{error}</p>
          <p className="text-slate-400 text-x mb-4">Check that the backend is running and reachable at {API_BASE}.</p>
          <button onClick={fetchExisting} className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-s font-semibold">Retry</button>
        </div>
      ) : (
        <main className="max-w-screen-2xl mx-auto px-0 py-2 space-y-2">
          {/* ── Header context strip — every option here is queried from real data;
               Version is a read-only reflection of the actual workflow stage,
               not a free-standing dropdown. ── */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Budget Year</span>
              <span className="px-2.5 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-x font-semibold text-slate-700" title="Set in Settings & Customization → FY Management.">
                FY{budgetYear}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Version</span>
              <span className="px-2.5 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-x font-semibold text-slate-700" title="Reflects the actual approval workflow stage below — change it via Submit/Approve/Lock, not here.">
                {STAGE_LABELS[stage] || stage}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Planning Frequency</span>
              <span className="px-2.5 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-x font-semibold text-slate-700" title="Set on Budget Setup & Guidelines — applies to every Budgeting module.">
                {frequency}
              </span>
            </div>
          </div>
          {notes.length > 0 && (
            <div className="flex flex-col gap-1">
              {notes.map((n, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-x">{n}</div>
              ))}
            </div>
          )}

          <KpiRow cards={kpis} />
          <WorkflowProgress stage={stage} onAction={handleWorkflowAction} />

          {/* Budget Methodology (PRD §6) — Bottom-Up is the detailed grids
              below, unchanged. Top-Down replaces them with a target +
              allocation view; Hybrid keeps the grids but adds a
              reconciliation banner against the same target. Static-data-
              first pass: target comes from Budget Setup & Guidelines,
              allocation edits are local-only. */}
          {methodology === "Top-Down" ? (
            <>
              <TopDownTargetCard title="Revenue" baseline={totals.forecastExit} baselineLabel="Forecast Exit"
                growthPct={guidelines.revGrowthTarget} growthLabel="Revenue Growth Target" icon={<FiTrendingUp className="text-sky-600" size={16} />} />
              <TopDownAllocationTable dimensionLabel="Customer" target={computeTopDownTarget(totals.forecastExit, guidelines.revGrowthTarget)}
                rows={filteredCustomers.map((c) => ({ key: c.customer_name, name: c.customer_name, priorShare: c.forecast_exit || c.prior_year_actual || 0 }))}
                adjustedByKey={revenueAllocAdj}
                onAdjust={(key, value) => setRevenueAllocAdj((prev) => ({ ...prev, [key]: value === "" ? "" : Number(value) }))} />
            </>
          ) : (
          <>
          {methodology === "Hybrid" && (
            <ReconciliationBanner target={computeTopDownTarget(totals.forecastExit, guidelines.revGrowthTarget)} actual={totals.adj} label="Bottom-Up Total (User Budget)" />
          )}

          {/* Tabs */}
          <div className="flex items-center justify-between border-b-2 border-slate-200 mb-2 gap-2 flex-wrap">
            <div className="flex items-end gap-0.5">
              {TABS.map((t) => (
                <button key={t.id} onClick={() => guardedAction(() => setActiveTab(t.id))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-s font-semibold whitespace-nowrap transition-all
                    ${activeTab === t.id
                      ? "bg-white text-sky-600 rounded-t-xl -mb-0.5 border-l border-t border-r border-slate-200 border-b-2 border-b-white shadow-sm"
                      : "text-slate-500 hover:text-sky-700 hover:bg-white/60 rounded-t-xl"}`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            {activeTab === "existing" && (
              <ExceptionSummaryStrip totalEvaluated={customers.length} summary={revenueExceptions.summary}
                activeFilter={fStatus} onFilterChange={setFStatus} />
            )}
            {activeTab === "existing" && (
              <div className="flex items-center gap-2 pb-1.5">
                {!editable && (
                  <span className="text-xs text-amber-600 font-semibold">
                    {stage === "draft" ? "Read-only — your department can't edit this budget" : "Read-only — budget is past Draft stage"}
                  </span>
                )}
                <button onClick={() => toolbarAction("Download Template")} disabled={downloadingTemplate}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-sky-700 text-x font-semibold transition-all disabled:opacity-60">
                  {downloadingTemplate ? <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" /> : <FiDownload size={12} />}
                  Download Template
                </button>
                {stage === "draft" && (
                  <button onClick={() => toolbarAction("Upload Excel")}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-x font-semibold transition-all shadow-sm">
                    <FiUpload size={12} /> Upload Excel
                  </button>
                )}
                <span className="text-x text-slate-500">View</span>
                <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-0.5">
                  <button onClick={() => guardedAction(() => setExistingView("summary"))}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-x font-semibold transition-all ${existingView === "summary" ? "bg-sky-700 text-white shadow-sm" : "text-slate-500 hover:text-sky-700 hover:bg-white/60"}`}>
                    <FiList size={11} /> Summary
                  </button>
                  {editable && (
                    <button onClick={() => guardedAction(() => setExistingView("drivers"))}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-x font-semibold transition-all ${existingView === "drivers" ? "bg-sky-700 text-white shadow-sm" : "text-slate-500 hover:text-sky-700 hover:bg-white/60"}`}>
                      <FiLayers size={11} /> Drivers
                    </button>
                  )}
                </div>
              </div>
            )}
            {activeTab === "pipeline" && (
              <div className="flex items-center gap-2 pb-1.5">
                {editable && (
                  <button onClick={() => setShowNewPipelineCustomer(true)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-x font-semibold transition-all shadow-sm">
                    <FiPlus size={12} /> Add Row
                  </button>
                )}
                <button onClick={() => toolbarAction("Download Pipeline Template")} disabled={downloadingPipelineTemplate}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-sky-700 text-x font-semibold transition-all disabled:opacity-60">
                  {downloadingPipelineTemplate ? <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" /> : <FiDownload size={12} />}
                  Download Template
                </button>
                {stage === "draft" && (
                  <button onClick={() => toolbarAction("Upload Pipeline Excel")}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-x font-semibold transition-all shadow-sm">
                    <FiUpload size={12} /> Upload Excel
                  </button>
                )}
              </div>
            )}
            {activeTab === "strategic" && (
              <button onClick={() => setShowNewInitiative(true)} className="flex items-center gap-1.5 mb-1.5 h-7 px-3 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-x font-semibold"><FiPlus size={12} /> Add Initiative</button>
            )}
          </div>

          {/* ── Filters — matches ExpenseForecastingDashboard's ExpenseFilterBar
               exactly (bare inline row, no card wrapper), sits below the tabs
               so it stays visible while each table scrolls within its own
               bounded max-h-[72vh] box. ── */}
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-sky-400" size={12} />
                <input value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="Search customer…"
                  className="pl-7 pr-3 py-1 rounded-lg border border-sky-300 bg-white text-xs text-sky-900 outline-none focus:border-sky-500 focus:ring-2 ring-sky-100 transition-all w-48 shadow-sm" />
              </div>
              {filterText && (
                <button onClick={() => setFilterText("")}
                  className="flex items-center gap-1 text-xs text-sky-500 hover:text-sky-700 px-1.5 py-1 rounded-md hover:bg-sky-100 transition-colors">
                  <FiX size={11} /> Clear
                </button>
              )}
              <select value={departmentId} onChange={(e) => guardedAction(() => setDepartmentId(e.target.value))}
                className="px-2 py-1 rounded-lg border border-sky-300 bg-white text-xs text-sky-700 outline-none focus:border-sky-500 cursor-pointer"
                title="Shows only customers whose revenue is primarily booked to this department, and scopes Prior Year Actual to it. AI/forecast values remain company-wide.">
                <option value="">All Departments</option>
                {meta.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {[
                ["Segment", fSegment, setFSegment, segments, "All Segments"],
                ["Region", fRegion, setFRegion, regions, "All Regions"],
                ["Confidence", fConfidence, setFConfidence, ["High", "Medium", "Low"], "All Confidence"],
              ].map(([label, value, setter, options, allLabel]) => (
                <select key={label} value={value} onChange={(e) => setter(e.target.value)}
                  className="px-2 py-1 rounded-lg border border-sky-300 bg-white text-xs text-sky-700 outline-none focus:border-sky-500 cursor-pointer">
                  <option value="All">{allLabel}</option>
                  {options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ))}
              {(filterText || departmentId || fSegment !== "All" || fRegion !== "All" || fConfidence !== "All" || fStatus !== "all") && (
                <button onClick={() => { setFilterText(""); setDepartmentId(""); setFSegment("All"); setFRegion("All"); setFConfidence("All"); setFStatus("all"); }}
                  className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-800 px-1.5 py-1 rounded-md hover:bg-sky-50 border border-sky-200 transition-colors">
                  <FiX size={10} /> Clear filters
                </button>
              )}
              {activeTab === "existing" && existingView === "summary" && (
                <div className="relative">
                  <button onClick={() => setShowColumnMenu((p) => !p)}
                    className="flex items-center gap-1 text-xs text-sky-700 hover:text-sky-900 px-2 py-1 rounded-md bg-white hover:bg-sky-50 border border-sky-300 transition-colors">
                    <FiList size={10} /> Columns
                  </button>
                  {showColumnMenu && (
                    <>
                      <div className="fixed inset-0 z-[400]" onClick={() => setShowColumnMenu(false)} />
                      <div className="absolute z-[401] top-8 left-0 w-44 bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden">
                        <div className="px-3 py-2 bg-sky-800 text-white text-xs font-semibold uppercase tracking-wide">Show Columns</div>
                        <div className="p-2 flex flex-col gap-0.5">
                          {[
                            ["department", "Department"], ["segment", "Segment"], ["region", "Region"],
                            ["confidence", "Confidence"], ["status", "Status"], ["reason", "Reason"],
                          ].map(([key, label]) => (
                            <label key={key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-sky-50 text-xs text-slate-700 cursor-pointer">
                              <input type="checkbox" checked={visibleCols[key]} onChange={() => toggleCol(key)}
                                className="w-3.5 h-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-200" />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
              <span className="text-xs text-sky-500 bg-white px-2 py-1 rounded-md tabular-nums border border-sky-200">
                {filteredCustomers.length}/{customers.length}
              </span>
            </div>
            {!editable && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                <FiAlertTriangle size={11} /> Editing disabled — {stage === "draft" ? "wrong department" : STAGE_LABELS[stage] || stage}
              </div>
            )}
          </div>

          {/* ── Existing Customers — Summary ── */}
          {activeTab === "existing" && existingView === "summary" && (
            filteredCustomers.length === 0 ? <EmptyState label="No customers match the current filters." /> : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
                <div className="analytics-table-scroll relative overflow-x-auto max-h-[72vh] overflow-y-auto">
                <table className="relative w-full border-collapse text-sm" style={{ minWidth: `${900 + periods.length * 192}px` }}>
                  <thead className="sticky top-0 z-20">
                    <tr className="bg-sky-800 border-b border-sky-700">
                      <th rowSpan={2} className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700 sticky left-0 bg-sky-800 z-30 min-w-[170px]">Customer</th>
                      {visibleCols.department && <th rowSpan={2} className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide min-w-[110px] border-r border-sky-700/50">Department</th>}
                      {visibleCols.segment && <th rowSpan={2} className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide min-w-[100px] border-r border-sky-700/50">Segment</th>}
                      {visibleCols.region && <th rowSpan={2} className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide min-w-[90px] border-r border-sky-700/50">Region</th>}
                      <th rowSpan={2} className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide min-w-[95px] border-r border-sky-700/50">
                        Prior Year<br /><span className="text-xs font-normal normal-case text-sky-200">FY{priorFiscalYear}</span>
                      </th>
                      <th rowSpan={2} className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide min-w-[95px] border-r border-sky-700/50">
                        Curr. Forecast<br /><span className="text-xs font-normal normal-case text-sky-200">FY{currentFiscalYear}</span>
                      </th>
                      <th rowSpan={2} className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide min-w-[95px] border-r border-sky-700">
                        Forecast Exit<br /><span className="text-xs font-normal normal-case text-sky-200">FY{currentFiscalYear}</span>
                      </th>
                      <th colSpan={2} className="px-3 py-1.5 text-center text-xs font-semibold text-slate-50 border-l border-r border-sky-700 bg-sky-900">Total</th>
                      {periods.map((p) => <th key={p} colSpan={3} className="px-3 py-1.5 text-center text-xs font-semibold border-l border-r text-white border-sky-700 bg-sky-800">{p}</th>)}
                      <th rowSpan={2} className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide border-l border-sky-700 min-w-[85px]">Variance</th>
                      {visibleCols.confidence && <th rowSpan={2} className="px-3 py-1.5 text-center text-xs font-semibold text-white uppercase tracking-wide min-w-[95px] border-l border-sky-700/50">Confidence</th>}
                      {visibleCols.status && <th rowSpan={2} className="px-3 py-1.5 text-center text-xs font-semibold text-white uppercase tracking-wide min-w-[95px] border-l border-sky-700/50">Status</th>}
                      {visibleCols.reason && <th rowSpan={2} className="px-3 py-1.5 text-center text-xs font-semibold text-slate-50 border-l border-sky-700 bg-sky-800 min-w-[130px]">Reason</th>}
                      <th rowSpan={2} className="px-3 py-1.5 text-center text-xs font-semibold text-white uppercase tracking-wide border-l border-sky-700 min-w-[220px]">Insight</th>
                    </tr>
                    <tr className="bg-sky-700 border-b border-slate-600 sticky top-[28px] z-10">
                      <th className="px-2 py-1 text-right text-xs font-medium text-white uppercase border-l border-r border-l-slate-600 border-r-slate-600/60 min-w-[75px]">AI</th>
                      <th className="px-2 py-1 text-right text-xs font-semibold text-white uppercase min-w-[75px]">Adj</th>
                      {periods.map((p) => (
                        <React.Fragment key={p}>
                          <th className="px-2 py-1 text-right text-xs font-medium text-slate-100 uppercase border-l border-r border-l-slate-600 border-r-slate-600/60 min-w-[75px]">AI</th>
                          <th className="px-2 py-1 text-right text-xs font-semibold text-white uppercase min-w-[85px] border-r border-slate-600/60">Adjusted</th>
                          <th className="px-1 py-1 text-center text-xs font-semibold text-white uppercase min-w-[32px] border-r border-slate-600" title="Monthly reason">
                            <FiMessageSquare size={11} className="mx-auto opacity-70" />
                          </th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {pagedCustomers.map((c, rowIdx) => (
                      <ExistingCustomerSummaryRow key={c.customer_name} c={c} origIdx={customerIndexByName.get(c.customer_name)} rowIdx={rowIdx}
                        editable={editable} onRevenue={updateRevenue} onOpenReason={openReasonModal} onOpenException={setExceptionDrawerCust} visibleCols={visibleCols} />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-sky-900 text-white sticky bottom-0 z-10 font-semibold">
                      <td className="px-3 py-1.5 text-xs sticky left-0 bg-sky-900 border-r border-sky-700 z-[9]">GRAND TOTAL</td>
                      {visibleCols.department && <td className="border-r border-sky-700/50"></td>}
                      {visibleCols.segment && <td className="border-r border-sky-700/50"></td>}
                      {visibleCols.region && <td className="border-r border-sky-700/50"></td>}
                      <td className="px-3 py-1.5 text-right tabular-nums text-xs text-white border-r border-sky-700/50">{fmt(summaryTotals.priorYear)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-xs text-white border-r border-sky-700/50">{fmt(summaryTotals.currForecast)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-xs text-white border-r border-sky-700">{fmt(summaryTotals.forecastExit)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-xs text-white border-l border-r border-sky-700/50">{fmt(summaryTotals.totalAi)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-xs font-bold border-r border-sky-700">{fmt(summaryTotals.totalAdj)}</td>
                      {summaryTotals.perPeriod.map((p) => (
                        <React.Fragment key={p.period}>
                          <td className="px-2 py-1.5 text-right tabular-nums text-xs text-white border-l border-r border-sky-700/50 bg-sky-800">{fmt(p.ai)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-xs font-bold border-r border-sky-700/50 bg-sky-800">{fmt(p.adj)}</td>
                          <td className="border-r border-sky-700 bg-sky-800"></td>
                        </React.Fragment>
                      ))}
                      <td className="px-2 py-1.5 border-l border-sky-700">
                        <span className={`text-xs font-bold tabular-nums ${summaryTotals.variance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {summaryTotals.variance >= 0 ? "+" : ""}{fmt(summaryTotals.variance)}
                        </span>
                      </td>
                      {(visibleCols.confidence || visibleCols.status || visibleCols.reason) && (
                        <td colSpan={[visibleCols.confidence, visibleCols.status, visibleCols.reason].filter(Boolean).length}></td>
                      )}
                      <td className="border-l border-sky-700"></td>
                    </tr>
                  </tfoot>
                </table>
                </div>
                <PaginationBar page={safeCustomerPage} pageCount={customerPageCount} total={filteredCustomers.length}
                  pageSize={CUSTOMER_PAGE_SIZE} onPrev={() => setCustomerPage((p) => Math.max(1, p - 1))}
                  onNext={() => setCustomerPage((p) => Math.min(customerPageCount, p + 1))} itemLabel="customers" />
              </div>
            )
          )}

          {/* ── Existing Customers — Drivers ── */}
          {activeTab === "existing" && existingView === "drivers" && editable && (
            <div>
              <div className="flex items-center gap-1.5 px-3 py-2 mb-3 rounded-lg bg-sky-50 border border-sky-100 text-sky-700 text-x">
                <FiLayers size={13} /> Editing Volume, Rate, or Revenue here recalculates the other two instantly and stays in sync with the Summary view — Revenue = Volume × Rate.
              </div>
              {filteredCustomers.length === 0 ? <EmptyState label="No customers match the current filters." /> : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
                  <div className="analytics-table-scroll relative overflow-x-auto max-h-[72vh] overflow-y-auto">
                  <table className="relative w-full border-collapse text-sm" style={{ minWidth: `${190 + periods.length * 252 + 150 + 85 + 130}px` }}>
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-sky-800 border-b border-sky-700">
                        <th rowSpan={2} className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700 sticky left-0 bg-sky-800 z-30 min-w-[190px]">Customer</th>
                        <th colSpan={2} className="px-3 py-1.5 text-center text-xs font-semibold text-slate-50 border-l border-r border-sky-700 bg-sky-900 min-w-[150px]">Total Revenue</th>
                        {periods.map((p) => <th key={p} colSpan={4} className="px-3 py-1.5 text-center text-xs font-semibold text-white uppercase border-l border-r border-sky-700 min-w-[252px]">{p}</th>)}
                        <th rowSpan={2} className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide border-l border-sky-700 min-w-[85px]">Variance</th>
                        <th rowSpan={2} className="px-3 py-1.5 text-center text-xs font-semibold text-white uppercase tracking-wide border-l border-sky-700 min-w-[130px]">Reason</th>
                      </tr>
                      <tr className="bg-sky-700 border-b border-slate-600 sticky top-[28px] z-10">
                        <th className="px-2 py-1 text-right text-xs font-medium text-white uppercase border-l border-r border-l-slate-600 border-r-slate-600/60 min-w-[75px]">AI</th>
                        <th className="px-2 py-1 text-right text-xs font-semibold text-white uppercase min-w-[75px]">Adj</th>
                        {periods.map((p) => (
                          <React.Fragment key={p}>
                            <th className="px-2 py-1 text-right text-xs font-medium text-slate-100 uppercase border-l border-r border-l-slate-600 border-r-slate-600/60 min-w-[70px]">Volume</th>
                            <th className="px-2 py-1 text-right text-xs font-medium text-slate-100 uppercase border-r border-slate-600/60 min-w-[70px]">Rate</th>
                            <th className="px-2 py-1 text-right text-xs font-semibold text-white uppercase border-r border-slate-600/60 min-w-[80px]">Revenue</th>
                            <th className="px-1 py-1 text-center text-xs font-semibold text-white uppercase border-r border-slate-600 min-w-[32px]" title="Monthly reason">
                              <FiMessageSquare size={11} className="mx-auto opacity-70" />
                            </th>
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {pagedCustomers.map((c, rowIdx) => (
                        <ExistingCustomerDriverRow key={c.customer_name} c={c} origIdx={customerIndexByName.get(c.customer_name)} rowIdx={rowIdx}
                          onVolume={updateVolume} onRate={updateRate} onRevenue={updateRevenue}
                          onRevenueFocus={handleRevenueFocus} onRevenueBlur={handleRevenueBlur}
                          onOpenReason={openReasonModal} />
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-sky-900 text-white sticky bottom-0 z-10 font-semibold">
                        <td className="px-3 py-1.5 text-xs sticky left-0 bg-sky-900 border-r border-sky-700 z-[9]">GRAND TOTAL</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-xs text-white border-l border-r border-sky-700/50">{fmt(summaryTotals.totalAi)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-xs font-bold border-r border-sky-700">{fmt(summaryTotals.totalAdj)}</td>
                        {summaryTotals.perPeriod.map((p, i) => (
                          <React.Fragment key={p.period}>
                            <td className="px-2 py-1.5 text-right tabular-nums text-xs text-white border-l border-r border-sky-700/50">{fmt(driverVolumeTotals[i])}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-xs text-sky-300 border-r border-sky-700/50">—</td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-xs font-bold border-r border-sky-700/50 bg-sky-800">{fmt(p.adj)}</td>
                            <td className="border-r border-sky-700 bg-sky-800"></td>
                          </React.Fragment>
                        ))}
                        <td className="px-2 py-1.5 border-l border-sky-700">
                          <span className={`text-xs font-bold tabular-nums ${summaryTotals.variance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {summaryTotals.variance >= 0 ? "+" : ""}{fmt(summaryTotals.variance)}
                          </span>
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                  </div>
                  <PaginationBar page={safeCustomerPage} pageCount={customerPageCount} total={filteredCustomers.length}
                    pageSize={CUSTOMER_PAGE_SIZE} onPrev={() => setCustomerPage((p) => Math.max(1, p - 1))}
                    onNext={() => setCustomerPage((p) => Math.min(customerPageCount, p + 1))} itemLabel="customers" />
                </div>
              )}
            </div>
          )}

          {/* ── Pipeline ── */}
          {activeTab === "pipeline" && (
            pipelineLoading ? (
              <TableSkeleton columns={9} rows={8} />
            ) : pipeline.length === 0 ? (
              <div>
                <EmptyState label="No CRM pipeline opportunities found." />
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
                <div className="flex items-center gap-1.5 px-4 pt-3 text-sky-700 text-x">
                  <FiLayers size={13} /> Volume, Rate, Probability, and Revenue are synced — editing any one recalculates the others.
                </div>
                <div className="text-xs text-slate-400 px-4 pb-1">{pipeline.length.toLocaleString()} open opportunities</div>
                <div className="analytics-table-scroll relative overflow-x-auto max-h-[72vh] overflow-y-auto">
                <table className="border-collapse text-sm" style={{ width: PIPELINE_TABLE_WIDTH, minWidth: PIPELINE_TABLE_WIDTH, tableLayout: "fixed" }}>
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-sky-800">
                      {["Customer", "Region / Segment", "Product", "Stage", "Est. Close Date", "Probability (AI/User)", "Volume (AI/User)", "Rate (AI/User)", "Revenue (AI/User)"].map((h, i) => (
                        <th key={h} style={{ width: PIPELINE_COL_WIDTHS[i] }} className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase border-r border-sky-700 last:border-r-0 truncate">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedPipeline.map((p, i) => {
                      const idx = (safePipelinePage - 1) * PIPELINE_PAGE_SIZE + i;
                      return (
                        <PipelineRow key={p.opportunity_id} p={p} idx={idx} rowIdx={i}
                          onVolume={updatePipelineVolume} onRate={updatePipelineRate}
                          onProbability={updatePipelineProbability} onRevenue={updatePipelineRevenue}
                          onDelete={deletePipelineRow} editable={editable} />
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-sky-900 text-white font-semibold sticky bottom-0 z-10">
                      <td colSpan={5} className="px-3 py-1.5 text-xs border-r border-sky-700">PIPELINE TOTAL ({pipeline.length.toLocaleString()} opportunities)</td>
                      <td style={{ width: PIPELINE_COL_WIDTHS[5] }} className="px-3 py-1.5 text-right tabular-nums text-xs border-r border-sky-700/50">{pipelineTotals.avgProbability.toFixed(1)}%</td>
                      <td style={{ width: PIPELINE_COL_WIDTHS[6] }} className="px-3 py-1.5 text-right tabular-nums text-xs border-r border-sky-700/50">{fmt(pipelineTotals.volume)}</td>
                      <td style={{ width: PIPELINE_COL_WIDTHS[7] }} className="px-3 py-1.5 text-right tabular-nums text-xs border-r border-sky-700/50">{fmt(pipelineTotals.avgRate)}</td>
                      <td style={{ width: PIPELINE_COL_WIDTHS[8] }} className="px-3 py-1.5 text-right tabular-nums text-xs">{fmt(pipelineTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
                </div>
                <PaginationBar page={safePipelinePage} pageCount={pipelinePageCount} total={pipeline.length}
                  pageSize={PIPELINE_PAGE_SIZE} onPrev={() => setPipelinePage((p) => Math.max(1, p - 1))}
                  onNext={() => setPipelinePage((p) => Math.min(pipelinePageCount, p + 1))} itemLabel="opportunities" />
              </div>
            )
          )}

          {/* ── Strategic Revenue ── */}
          {activeTab === "strategic" && (
            strategicLoading ? <TableSkeleton columns={5} rows={5} /> :
            strategic.length === 0 ? <EmptyState label="No strategic initiatives yet — click Add Initiative to create one." /> : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
                <div className="flex items-center gap-1.5 px-4 pt-3 text-sky-700 text-x">
                  <FiLayers size={13} /> Volume, Rate, and Revenue are synced — editing any one recalculates the others (Revenue = Volume × Rate).
                </div>
                <div className="analytics-table-scroll relative overflow-x-auto max-h-[72vh] overflow-y-auto">
                <table className="w-full min-w-[820px] border-collapse text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-sky-800">
                      {["Initiative", "Period", "Volume (AI/User)", "Rate (AI/User)", "Revenue (AI/User)"].map((h) => (
                        <th key={h} className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase border-r border-sky-700 last:border-r-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {strategic.map((s, idx) => {
                      const rowBg = idx % 2 === 0 ? "bg-white" : "bg-slate-50/60";
                      return (
                      <tr key={s.id} className={`rf-row border-b border-slate-200 transition-colors hover:bg-sky-50/50 ${rowBg}`}>
                        <td className="px-3 py-1 font-semibold text-slate-900 text-xs leading-tight border-r border-slate-100">{s.initiative}</td>
                        <td className="px-3 py-1 text-xs text-slate-600 border-r border-slate-100">{s.period}</td>
                        <td className="px-3 py-1 border-r border-slate-100">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-xs text-slate-400 tabular-nums w-9 text-right shrink-0">{s.ai_volume}</span>
                            <input type="number" value={s.adjusted_volume} onChange={(e) => updateStrategicVolume(idx, e.target.value)}
                              className="w-14 px-1.5 py-0.5 rounded-md border border-slate-200 text-right tabular-nums text-xs outline-none transition-all focus:border-sky-500 focus:ring-2 ring-sky-100" />
                          </div>
                        </td>
                        <td className="px-3 py-1 border-r border-slate-100">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-xs text-slate-400 tabular-nums w-9 text-right shrink-0">{fmt(s.ai_rate)}</span>
                            <input type="number" value={s.adjusted_rate} onChange={(e) => updateStrategicRate(idx, e.target.value)}
                              className="w-14 px-1.5 py-0.5 rounded-md border border-slate-200 text-right tabular-nums text-xs outline-none transition-all focus:border-sky-500 focus:ring-2 ring-sky-100" />
                          </div>
                        </td>
                        <td className="px-3 py-1">
                          <AIAdjustedCell ai={s.ai_revenue} adjusted={s.adjusted_revenue} editable onChange={(v) => updateStrategicRevenue(idx, v)} width="w-16" />
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-sky-900 text-white font-semibold sticky bottom-0 z-10">
                      <td colSpan={2} className="px-3 py-1.5 text-xs border-r border-sky-700">STRATEGIC TOTAL</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-xs border-r border-sky-700/50">{fmt(strategicTotals.volume)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-xs border-r border-sky-700/50">{fmt(strategicTotals.avgRate)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-xs">{fmt(strategicTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
                </div>
              </div>
            )
          )}

          <SaveBar hasChanges={hasChanges} saving={saving} onSave={handleSave} label="Save Adjustments" />
          </>
          )}
        </main>
      )}
    </div>
  );
};

function CompareForecastModal({ loading, data, budgetYear, onClose }) {
  const priorFY = budgetYear - 2;
  const currentFY = budgetYear - 1;
  const headers = [
    { label: "Customer" },
    { label: "Prior Year Actual", year: priorFY },
    { label: "Current Forecast", year: currentFY },
    { label: "AI Budget", year: budgetYear },
    { label: "User Budget", year: budgetYear },
    { label: "Variance vs. Forecast" },
  ];
  return (
    <div className="fixed inset-0 z-[1000] bg-sky-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl border border-slate-200 overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200 shrink-0">
          <div>
            <h3 className="font-bold text-slate-900 text-s">Budget vs. Forecast — FY{budgetYear}</h3>
            <p className="text-x text-slate-500 mt-0.5">Full-year totals, per customer</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"><FiX size={13} /></button>
        </div>
        <div className="overflow-y-auto p-5">
          {loading ? (
            <TableSkeleton columns={6} rows={6} />
          ) : !data || data.customers.length === 0 ? (
            <EmptyState label="No customers to compare." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-sm">
                <thead>
                  <tr className="bg-sky-800">
                    {headers.map((h) => (
                      <th key={h.label} className="px-3 py-2 text-right first:text-left text-xs font-semibold text-white uppercase border-r border-sky-700 last:border-r-0">
                        {h.label}
                        {h.year != null && <><br /><span className="text-xs font-normal normal-case text-sky-200">FY{h.year}</span></>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.customers.map((c) => (
                    <tr key={c.customer_name} className="rf-row border-b border-slate-200 hover:bg-sky-50/50">
                      <td className="px-3 py-1 font-semibold text-slate-900 text-xs leading-tight border-r border-slate-100">{c.customer_name}</td>
                      <td className="px-3 py-1 text-right tabular-nums text-xs text-slate-500 border-r border-slate-100">{fmt(c.prior_year_actual)}</td>
                      <td className="px-3 py-1 text-right tabular-nums text-xs text-slate-500 border-r border-slate-100">{fmt(c.current_forecast)}</td>
                      <td className="px-3 py-1 text-right tabular-nums text-xs text-slate-500 border-r border-slate-100">{fmt(c.ai_budget)}</td>
                      <td className="px-3 py-1 text-right tabular-nums text-xs font-semibold text-sky-800 border-r border-slate-100">{fmt(c.user_budget)}</td>
                      <td className={`px-3 py-1 text-right tabular-nums text-xs font-semibold ${c.variance_vs_forecast > 0 ? "text-emerald-600" : c.variance_vs_forecast < 0 ? "text-red-500" : "text-slate-400"}`}>{c.variance_vs_forecast === 0 ? "—" : `${c.variance_vs_forecast > 0 ? "+" : ""}${fmt(c.variance_vs_forecast)}`}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-sky-900 text-white font-semibold">
                    <td className="px-3 py-1.5 text-xs border-r border-sky-700">TOTAL</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-xs border-r border-sky-700/50">{fmt(data.totals.prior_year_actual)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-xs border-r border-sky-700/50">{fmt(data.totals.current_forecast)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-xs border-r border-sky-700/50">{fmt(data.totals.ai_budget)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-xs border-r border-sky-700/50">{fmt(data.totals.user_budget)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-xs">{data.totals.variance_vs_forecast > 0 ? "+" : ""}{fmt(data.totals.variance_vs_forecast)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NewInitiativeModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ initiative: "", period: "", ai_volume: 1, ai_rate: 0 });
  return (
    <div className="fixed inset-0 z-[1000] bg-sky-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-[440px] shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200">
          <h3 className="font-bold text-slate-900 text-s">New Strategic Initiative</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"><FiX size={13} /></button>
        </div>
        <div className="p-5 flex flex-col gap-3">
          <label className="text-x font-semibold text-slate-600">Initiative
            <input value={form.initiative} onChange={(e) => setForm((p) => ({ ...p, initiative: e.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-s outline-none focus:border-sky-500 focus:ring-2 ring-sky-100" />
          </label>
          <label className="text-x font-semibold text-slate-600">Period (e.g. Q3 FY27)
            <input value={form.period} onChange={(e) => setForm((p) => ({ ...p, period: e.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-s outline-none focus:border-sky-500 focus:ring-2 ring-sky-100" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-x font-semibold text-slate-600">Volume
              <input type="number" value={form.ai_volume} onChange={(e) => setForm((p) => ({ ...p, ai_volume: Number(e.target.value) || 0 }))}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-s outline-none focus:border-sky-500 focus:ring-2 ring-sky-100" />
            </label>
            <label className="text-x font-semibold text-slate-600">Rate ($)
              <input type="number" value={form.ai_rate} onChange={(e) => setForm((p) => ({ ...p, ai_rate: Number(e.target.value) || 0 }))}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-s outline-none focus:border-sky-500 focus:ring-2 ring-sky-100" />
            </label>
          </div>
        </div>
        <div className="flex gap-3 justify-end px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-s font-semibold">Cancel</button>
          <button onClick={() => form.initiative.trim() && form.period.trim() && onCreate(form)}
            disabled={!form.initiative.trim() || !form.period.trim()}
            className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-s font-semibold">Create</button>
        </div>
      </div>
    </div>
  );
}

// Same fields as the Pipeline table's own columns (Customer, Region/Segment,
// Product, Stage, Est. Close Date, Probability/Volume/Rate) so a manually
// added row shows up looking exactly like a CRM-sourced one — the backend
// stores it in its own table (budget_pipeline_manual_entries) and unions it
// into the same list _compute_pipeline returns.
function NewPipelineCustomerModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    customer_name: "", region: "", segment: "", product: "", stage: "",
    estimated_close_date: "", probability: 50, volume: 1, rate: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));
  const setNum = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value === "" ? "" : Number(e.target.value) }));
  const canCreate = form.customer_name.trim().length > 0 && !submitting;
  const handleCreate = async () => {
    if (!canCreate) return;
    setSubmitting(true);
    try {
      await onCreate({ ...form, customer_name: form.customer_name.trim(), estimated_close_date: form.estimated_close_date || null });
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[1000] bg-sky-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-[480px] shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200">
          <h3 className="font-bold text-slate-900 text-s">Add Pipeline Customer</h3>
          <button onClick={onClose} disabled={submitting} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-50"><FiX size={13} /></button>
        </div>
        <fieldset disabled={submitting} className="contents">
        <div className="p-5 flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
          <label className="text-x font-semibold text-slate-600">Customer Name *
            <input value={form.customer_name} onChange={set("customer_name")} autoFocus
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-s outline-none focus:border-sky-500 focus:ring-2 ring-sky-100" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-x font-semibold text-slate-600">Region
              <input value={form.region} onChange={set("region")} placeholder="e.g. APAC"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-s outline-none focus:border-sky-500 focus:ring-2 ring-sky-100" />
            </label>
            <label className="text-x font-semibold text-slate-600">Segment
              <input value={form.segment} onChange={set("segment")} placeholder="e.g. Enterprise"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-s outline-none focus:border-sky-500 focus:ring-2 ring-sky-100" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-x font-semibold text-slate-600">Product
              <input value={form.product} onChange={set("product")}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-s outline-none focus:border-sky-500 focus:ring-2 ring-sky-100" />
            </label>
            <label className="text-x font-semibold text-slate-600">Stage
              <select value={form.stage} onChange={set("stage")}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-s outline-none focus:border-sky-500 focus:ring-2 ring-sky-100 bg-white">
                <option value="">Select stage…</option>
                <option value="Prospecting">Prospecting</option>
                <option value="Qualification">Qualification</option>
                <option value="Proposal">Proposal</option>
                <option value="Negotiation">Negotiation</option>
              </select>
            </label>
          </div>
          <label className="text-x font-semibold text-slate-600">Est. Close Date
            <input type="date" value={form.estimated_close_date} onChange={set("estimated_close_date")}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-s outline-none focus:border-sky-500 focus:ring-2 ring-sky-100" />
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="text-x font-semibold text-slate-600">Probability %
              <input type="number" min="0" max="100" value={form.probability} onChange={setNum("probability")}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-s outline-none focus:border-sky-500 focus:ring-2 ring-sky-100" />
            </label>
            <label className="text-x font-semibold text-slate-600">Volume
              <input type="number" value={form.volume} onChange={setNum("volume")}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-s outline-none focus:border-sky-500 focus:ring-2 ring-sky-100" />
            </label>
            <label className="text-x font-semibold text-slate-600">Rate ($)
              <input type="number" value={form.rate} onChange={setNum("rate")}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-s outline-none focus:border-sky-500 focus:ring-2 ring-sky-100" />
            </label>
          </div>
        </div>
        </fieldset>
        <div className="flex gap-3 justify-end px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} disabled={submitting} className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-s font-semibold disabled:opacity-50">Cancel</button>
          <button onClick={handleCreate} disabled={!canCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-s font-semibold min-w-[130px] justify-center">
            {submitting && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {submitting ? "Adding…" : "Add Customer"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RevenueBudgeting;
