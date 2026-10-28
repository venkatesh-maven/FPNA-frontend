// CashflowForecasting.jsx
import React, { useState, useRef, useEffect, useCallback, useContext, useMemo } from "react";
import {
  FiRefreshCw, FiDownload, FiUpload, FiSearch, FiX,
  FiTrendingUp, FiBarChart2, FiAlertCircle, FiPlus,
  FiEdit2, FiTrash2, FiMoreVertical, FiArrowUp, FiArrowDown,
  FiDroplet, FiMessageSquare, FiSend, FiSettings,
} from "react-icons/fi";

import { AuthContext } from "../../context/AuthContext";
import { BudgetYearContext } from "../../context/BudgetYearContext";
import { useCurrentQuarter } from "../../hooks/useCurrentQuarter";
import { API_BASE_URL } from "../../config/config";

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

import {
  getQuarterMonths, getMonthKey, STAGE_LABELS, STAGE_CONFIG,
  parseApiError, getInitials, avatarClass,
  useToast, ToastContainer, Spinner, EmptyState,
  CenterErrorModal, WorkflowModal, ImportModal,
  WorkflowProgress, SaveBar,
  InlineCommentIcon,
  ScenarioModal,
  OverallChat,
} from "./RevenueForecastHelpers";
import TableSkeleton from "../Skeleton/TableSkeleton";
import { getDecimalPrecision } from '../../utils/formatters';

// ─── API base ─────────────────────────────────────────────────────────────────
const API_BASE = `${API_BASE_URL}/api/v1/forecasting/managemet/cashflow-forecast`;

// ─── Currency filter options ──────────────────────────────────────────────────
const CURRENCY_FILTER_OPTIONS = [
  { value: "actualvalue", label: "Actual" },
  { value: "thousands",   label: "Thousands" },
  { value: "millions",    label: "Millions"  },
];

// ─── Global CSS ───────────────────────────────────────────────────────────────
// ─── Number formatter (currency-aware) ───────────────────────────────────────
function makeFmt(currencyFilter, currency = "USD") {
  const sym = currency === "INR" ? "₹" : currency === "EUR" ? "€" : "$";
  return (n) => {
    if (n == null || n === "") return "—";

    // Keep preformatted backend values (e.g. "112.91 K", "1.91 M") as-is.
    if (typeof n === "string") {
      const trimmed = n.trim();
      if (/^-?\d+(?:\.\d+)?\s*[kKmM]$/.test(trimmed)) return trimmed;
      const parsed = Number(trimmed.replace(/,/g, ""));
      if (!Number.isFinite(parsed)) return trimmed || "—";
      n = parsed;
    }

    if (typeof n !== "number" || Number.isNaN(n)) return "—";
    const sign = n < 0 ? "-" : "";
    const abs  = Math.abs(n);
    if (currencyFilter === "millions")  return `${sign}${sym}${(abs / 1_000_000).toFixed(getDecimalPrecision())}M`;
    if (currencyFilter === "thousands") return `${sign}${sym}${(abs / 1_000).toFixed(getDecimalPrecision())}k`;
    return `${sign}${sym}${abs.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`;
  };
}

export function toBackendNumber(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const t = value.trim();
  if (!t) return null;

  const shortMatch = t.match(/^(-?\d+(?:\.\d+)?)\s*([kKmM])$/);
  if (shortMatch) {
    const base = Number(shortMatch[1]);
    if (!Number.isFinite(base)) return null;
    return shortMatch[2].toLowerCase() === "m" ? base * 1_000_000 : base * 1_000;
  }

  const parsed = Number(t.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function toCalcNumber(value) {
  return toBackendNumber(value) ?? 0;
}

// Shared display logic for the editable "Adjusted" number inputs below.
// While focused we show the raw value as-is — including "" or a
// partially-typed "13." — so toFixed() rounding never overwrites what the
// user is mid-typing. `Number("").toFixed(n)` is "0.00" (not ""), so running
// every value through toFixed() unconditionally is what made an emptied
// field snap straight back to 0 before the user could finish clearing it.
export function displayEditableNumber(value, isFocused) {
  if (isFocused) return value ?? "";
  return value != null && value !== "" ? +Number(value).toFixed(getDecimalPrecision()) : "";
}

// Comma-grouped variant for the Cashflow Components "Adjusted" cells, which
// use a text input (so commas can render — native <input type="number">
// strips thousands separators) instead of the number inputs used elsewhere.
// Same focused/unfocused split as displayEditableNumber above.
function displayAdjustedCommaCF(value, isFocused) {
  if (isFocused) return value ?? "";
  if (value == null || value === "") return "";
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: getDecimalPrecision(),
    maximumFractionDigits: getDecimalPrecision(),
  });
}

// ─── Category colour accents ──────────────────────────────────────────────────
const CAT_COLORS = [
  { dot: "#15803d", light: "#f0fdf4", badge: "#dcfce7", badgeText: "#15803d" },
  { dot: "#1565c0", light: "#e3f2fd", badge: "#bbdefb", badgeText: "#0c3461" },
  { dot: "#b45309", light: "#fffbeb", badge: "#fde68a", badgeText: "#92400e" },
  { dot: "#6d28d9", light: "#f5f3ff", badge: "#ede9fe", badgeText: "#5b21b6" },
  { dot: "#0e7490", light: "#ecfeff", badge: "#cffafe", badgeText: "#0e7490" },
  { dot: "#be185d", light: "#fdf2f8", badge: "#fce7f3", badgeText: "#be185d" },
  { dot: "#dc2626", light: "#fff1f2", badge: "#fee2e2", badgeText: "#991b1b" },
  { dot: "#064e3b", light: "#ecfdf5", badge: "#a7f3d0", badgeText: "#065f46" },
];
const catColor = (name = "") => CAT_COLORS[Math.abs(name.charCodeAt(0)) % CAT_COLORS.length];

// ─── TABS ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "cashflow",  label: "Cashflow Components", icon: <FiBarChart2 size={13}/> },
  { id: "drivers",   label: "Driver Adjustments",  icon: <FiSettings size={13}/> },
  { id: "scenarios", label: "Cashflow Scenarios",  icon: <FiTrendingUp size={13}/> },
  { id: "comments",  label: "Comments",            icon: <FiMessageSquare size={13}/> },
];

// ─── KPI Cards ────────────────────────────────────────────────────────────────
function KpiRow({ summary, fmt }) {
  const cards = [
    { label: "Operating CF", value: summary?.operating_cf ?? summary?.total_inflows_ai, sub: "Net cash from operations" },
    { label: "Investing CF", value: summary?.investing_cf ?? summary?.total_outflows_ai, sub: "CAPEX & investments" },
    { label: "Financing CF", value: summary?.financing_cf, sub: "Debt & equity" },
    { label: "Net Cash Change", value: summary?.net_cashflow_adjusted ?? summary?.net_cashflow_ai, sub: "Quarter net increase" },
    { label: "Closing Balance", value: summary?.closing_balance, sub: "End of quarter forecast" },
  ];
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2 my-2">
      {cards.map((c) => (
        <div key={c.label} className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm hover:shadow-md transition-shadow">
          <div className="mb-0.5 flex items-center justify-between gap-2">
            <div className="truncate text-xs font-semibold uppercase tracking-wider text-sky-600">{c.label}</div>
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-sky-200 bg-sky-100 text-xs font-black text-sky-700">$</div>
          </div>
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="whitespace-nowrap tabular-nums text-base font-bold text-sky-900">
              {c.value != null ? fmt(c.value) : "—"}
            </span>
            <span className="truncate text-[11px] text-sky-600" title={c.sub}>{c.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Workflow bar ─────────────────────────────────────────────────────────────
const WF_STEPS = ["draft", "submitted", "reviewed", "approved", "locked"];
function WorkflowBar({ stage, workflowMeta, onAction }) {
  const stageCfg = STAGE_CONFIG?.[stage] || {};
  const curr = WF_STEPS.indexOf(stage);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-100 bg-white px-5 py-2.5">
      {/* Steps */}
      <div className="flex flex-wrap items-center gap-1">
        {WF_STEPS.map((s, i) => {
          const done = i < curr;
          const active = i === curr;
          return (
            <React.Fragment key={s}>
              <div
                className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-xs font-extrabold"
                style={{
                  background: done ? "#1565c0" : active ? "#1976d2" : "#e3f2fd",
                  color: done || active ? "#fff" : "#90caf9",
                  boxShadow: active ? "0 0 0 3px #bbdefb" : "none",
                  border: (!done && !active) ? "2px solid #bbdefb" : "none",
                }}
              >
                {done ? "✓" : i + 1}
              </div>
              <span className={`text-xs ${active ? "font-bold text-sky-700" : "font-normal text-slate-500"}`}>
                {STAGE_LABELS?.[s] || s}
              </span>
              {i < WF_STEPS.length - 1 && (
                <div className="mx-0.5 h-0.5 w-[22px]" style={{ background: done ? "#1565c0" : "#e3f2fd" }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
      {/* Meta + actions */}
      <div>
        {workflowMeta?.submitted_by && (
          <div className="mb-1.5 text-xs text-slate-400">
            📋 Submitted by <strong>{workflowMeta.submitted_by}</strong>
            {workflowMeta.submitted_at && <> · {workflowMeta.submitted_at}</>}
          </div>
        )}
        <div className="flex gap-2">
          {stage === "draft" && (
            <button onClick={() => onAction("submitted")} className="cursor-pointer rounded-md border border-sky-200 bg-white px-[15px] py-[5px]  font-bold text-sky-800">
              ✓ Submit
            </button>
          )}
          {stage === "submitted" && (
            <>
              <button onClick={() => onAction("draft")} className="cursor-pointer rounded-md border border-rose-300 bg-white px-3.5 py-[5px]  font-bold text-rose-600">
                ✕ Reject
              </button>
              <button onClick={() => onAction("reviewed")} className="cursor-pointer rounded-md border-0 bg-sky-700 px-[15px] py-[5px]  font-bold text-white">
                ✓ Mark Reviewed
              </button>
            </>
          )}
          {stage === "reviewed" && (
            <button onClick={() => onAction("approved")} className="cursor-pointer rounded-md border-0 bg-sky-700 px-[15px] py-[5px]  font-bold text-white">
              ✓ Approve
            </button>
          )}
          {stage === "approved" && (
            <button onClick={() => onAction("locked")} className="cursor-pointer rounded-md border-0 bg-rose-600 px-[15px] py-[5px]  font-bold text-white">
              🔒 Lock
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Unsaved Changes Modal ────────────────────────────────────────────────────
function UnsavedChangesModal({ open, saving, onSave, onDiscard, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-sky-800/60 p-4 backdrop-blur-sm">
      <div className="w-[380px] overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-2xl animate-[modalIn_0.2s_ease_forwards]">
        <div className="h-[3px] bg-amber-500" />
        <div className="px-6 py-5">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50">
              <FiAlertCircle color="#f59e0b" size={20}/>
            </div>
            <div>
              <div className="text-s font-extrabold text-sky-900">Unsaved Changes</div>
              <div className="mt-1 text-x leading-relaxed text-slate-500">You have unsaved changes. Save before continuing?</div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onCancel} className="cursor-pointer rounded-lg border border-sky-100 bg-white px-3.5 py-[7px] text-x font-bold text-sky-700">Stay</button>
            <button onClick={onDiscard} className="cursor-pointer rounded-lg border border-sky-100 bg-slate-100 px-3.5 py-[7px] text-x font-bold text-slate-500">Discard</button>
            <button onClick={onSave} disabled={saving} className={`rounded-lg border-0 bg-sky-700 px-4 py-[7px] text-x font-bold text-white ${saving ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
              {saving ? "Saving…" : "💾 Save & Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ApplyAllMonthsModal ──────────────────────────────────────────────────────
// Shown when the user edits a Summary "Adjusted" month cell and blurs it with
// the value actually changed — offers to propagate that value to all 12
// months for this cash-flow component instead of just the one month edited.
function ApplyAllMonthsModal({ open, componentLabel, value, applying, fmt, onYes, onNo }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-sky-800/60 p-4 backdrop-blur-sm">
      <div className="w-[420px] overflow-visible rounded-2xl border border-sky-100 bg-white shadow-2xl animate-[modalIn_0.2s_ease_forwards]">
        <div className="h-[3px] bg-sky-600" />
        <div className="px-6 py-5">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50">
              <FiTrendingUp color="#0369a1" size={20}/>
            </div>
            <div>
              <div className="text-s font-extrabold text-sky-900">Apply to all 12 months?</div>
              <div className="mt-1 text-x leading-relaxed text-slate-500">
                Would you like to apply this Adjusted value ({fmt ? fmt(value) : value}) to all 12 months
                for <span className="font-bold text-sky-800">{componentLabel}</span>?
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onNo} disabled={applying} className={`rounded-lg border border-sky-100 bg-white px-3.5 py-[7px] text-x font-bold text-sky-700 ${applying ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
              No, just this month
            </button>
            <button onClick={onYes} disabled={applying} className={`rounded-lg border-0 bg-sky-700 px-4 py-[7px] text-x font-bold text-white ${applying ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
              {applying ? "Applying…" : "Yes, apply to all 12 months"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteConfirmModal({ open, scenarioName, onClose, onConfirm, loading }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1001] flex items-center justify-center bg-sky-800/60 p-4 backdrop-blur-sm">
      <div className="w-[360px] rounded-2xl border border-sky-100 bg-white p-6 text-center shadow-2xl">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50">
          <FiTrash2 color="#dc2626" size={22}/>
        </div>
        <div className="mb-1 text-s font-extrabold text-sky-900">Delete Scenario</div>
        <div className="mb-1 text-x text-slate-500">Are you sure you want to delete</div>
        <div className="mb-4 text-x font-bold text-sky-700">"{scenarioName}"?</div>
        <div className="mb-5  text-slate-400">This cannot be undone.</div>
        <div className="flex justify-center gap-2">
          <button onClick={onClose} className="cursor-pointer rounded-lg border border-sky-100 bg-white px-4 py-[7px] text-x font-bold text-sky-700">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className={`rounded-lg border-0 bg-rose-600 px-4 py-[7px] text-x font-bold text-white ${loading ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Cashflow Components Table ────────────────────────────────────────────────
function CashflowTable({ rows, months, canEdit, cellComments, overallComments, onAdjChange, onAdjBlur, onCommentChange, onOverallChange, fmt, filterText, setFilterText }) {
  // Key of the "Adjusted" cell currently focused. While focused we show the
  // raw, unrounded value (see displayEditableNumber) instead of fighting the
  // user's keystrokes with toFixed() rounding.
  const [focusedCellKey, setFocusedCellKey] = useState(null);
  // Remembers each cell's value at focus time so onBlur can tell whether it
  // actually changed, for the parent's "apply to all 12 months" prompt.
  const focusValuesRef = useRef({});
  const filtered = rows.filter((r) =>
    r.component.toLowerCase().includes(filterText.toLowerCase()) ||
    (r.category || "").toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="relative">
            <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13}/>
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Search component or category…"
              className="w-[220px] rounded-lg border border-slate-300 bg-white py-1 pl-8 pr-2.5 text-x outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          {filterText && (
            <button onClick={() => setFilterText("")} className="flex cursor-pointer items-center gap-1 bg-transparent  text-slate-500">
              <FiX size={12}/> Clear
            </button>
          )}
          <span className="rounded-full bg-sky-100 px-2.5 py-[3px] text-xs font-bold text-sky-700">
            {filtered.length}/{rows.length}
          </span>
          {!canEdit && (
            <span className="flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1  font-semibold text-amber-700">
              <FiAlertCircle size={12}/> Read-only
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="analytics-table-scroll max-h-[72vh] overflow-auto rounded-[14px] border border-sky-100 bg-white shadow-sm">
        <table className="w-full min-w-[1300px] border-collapse ">
          <thead className="sticky top-0 z-20">
            <tr className="border-b border-sky-700 bg-sky-800">
              <th rowSpan={2} className="sticky left-0 z-30 min-w-[200px] border-r border-sky-700 bg-sky-800 px-3.5 py-[9px] text-left text-xs font-extrabold uppercase tracking-[0.5px] text-sky-200">
                Category
              </th>
              <th rowSpan={2} className="min-w-[110px] px-3 py-[9px] text-left text-xs font-bold uppercase tracking-[0.5px] text-sky-200">
                
              </th>
              <th rowSpan={2} className="min-w-[100px] px-3 py-[9px] text-right tabular-nums text-xs font-bold uppercase text-sky-200">
                Prev Month
              </th>
              {months.map((m) => (
                <th key={m} colSpan={3} className="border-l border-sky-700 px-3 py-[9px] text-center  font-bold text-white">{m}</th>
              ))}
              <th colSpan={2} className="border-l border-sky-700 bg-sky-900 px-3 py-[9px] text-center text-xs font-bold text-sky-200">Qtr Total</th>
              <th className="min-w-[130px] border-l border-sky-700 px-3 py-[9px] text-center text-xs font-bold text-sky-200">Overall Note</th>
            </tr>
            <tr className="sticky top-[34px] z-[19] border-b border-sky-600 bg-sky-700">
              {months.map((m) => (
                <React.Fragment key={m}>
                  <th className="min-w-[80px] border-l border-sky-600 px-2.5 py-[5px] text-right  font-bold uppercase text-sky-200">AI</th>
                  <th className="min-w-[100px] px-2.5 py-[5px] text-right  font-extrabold uppercase text-white">Adjusted</th>
                  <th className="min-w-[42px] px-2 py-[5px] text-center font-bold uppercase text-sky-200">
                    <FiMessageSquare size={11} className="mx-auto opacity-70"/>
                  </th>
                </React.Fragment>
              ))}
              <th className="min-w-[80px] border-l border-sky-600 px-2.5 py-[5px] text-right  font-bold uppercase text-sky-200">AI</th>
              <th className="min-w-[80px] px-2.5 py-[5px] text-right  font-extrabold uppercase text-white">Adj</th>
              <th className="border-l border-sky-600 px-2 py-[5px]" />
            </tr>
          </thead>
          <tbody className="text-sm">
            {filtered.length === 0
              ? <tr><td colSpan={99} className="text-center py-8 text-slate-400">No components match your search.</td></tr>
              : filtered.map((row, idx) => {
                  const cc   = catColor(row.component);
                  // toCalcNumber, not `|| 0`: an adjusted cell can hold the raw string the
                  // user is mid-typing, and `0 + "<string>"` concatenates instead of adding.
                  const qAi  = months.reduce((s, _, mi) => s+toCalcNumber(row[`month${mi+1}_ai`]), 0);
                  const qAdj = months.reduce((s, _, mi) => s+toCalcNumber(row[`month${mi+1}_adjusted`]), 0);
                  const changed = qAdj !== qAi;
                  const bg   = idx % 2 === 0 ? "bg-white" : "bg-sky-50";

                  return (
                    <tr key={row.component} className={`cf-row border-b border-sky-50 ${bg}`}>
                      {/* Sticky component name */}
                      <td className={`px-3.5 py-2 sticky left-0 bg-white border-r border-sky-100 z-5 ${bg}`}>
                        <div className="flex items-center gap-2">
                          {/* <div style={{ width: 10, height: 28, borderRadius: 3, background: cc.dot, flexShrink: 0 }}/> */}
                          <div>
                            <div className="font-bold text-sky-900">{row.component}</div>
                            {row.label && row.label !== row.component && (
                              <div className="text-slate-500">{row.label}</div>
                            )}
                          </div>
                          {changed && <span className="w-1.5 h-1.5 rounded-full bg-sky-600 flex-shrink-0" title="Has adjustments"/>}
                        </div>
                      </td>

                      {/* Category */}
                      <td className={`px-3 py-2 ${bg}`}>
                        {row.category && (
                          <span className="px-2 py-0.5 rounded-full font-bold" style={{ background: cc.badge, color: cc.badgeText, border: `1px solid ${cc.badgeText}22` }}>
                            {row.category}
                          </span>
                        )}
                      </td>

                      {/* Prev month */}
                      <td className={`px-3 py-2 text-right tabular-nums text-slate-600 ${bg}`}>
                        {fmt(row.previous_month)}
                      </td>

                      {/* Per-month columns (dynamic) */}
                      {months.map((_, mi) => {
                        const m   = mi + 1;
                        const ai  = row[`month${m}_ai`];
                        const adj = row[`month${m}_adjusted`];
                        const cellChanged = adj !== ai && ai != null;
                        const ck  = `${row.component}-month${m}`;
                        const cellKey = `${row.component}-month${m}`;
                        return (
                          <React.Fragment key={m}>
                            <td className={`px-2.5 py-2 text-right tabular-nums text-slate-600 border-l border-sky-50 ${bg}`}>
                              {fmt(ai)}
                            </td>
                            <td className={`px-2 py-1.5 ${bg}`}>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={displayAdjustedCommaCF(adj, focusedCellKey === cellKey)}
                                disabled={!canEdit}
                                onFocus={(e) => { setFocusedCellKey(cellKey); focusValuesRef.current[cellKey] = adj; e.target.select(); }}
                                onBlur={() => {
                                  setFocusedCellKey(null);
                                  const startVal = focusValuesRef.current[cellKey];
                                  delete focusValuesRef.current[cellKey];
                                  onAdjBlur?.(row.component, m, startVal);
                                }}
                                onChange={(e) => onAdjChange(row.component, `month${m}_adjusted`, e.target.value.replace(/[^0-9.-]/g, ""))}
                                className={`adj-input-cf${cellChanged ? " changed" : ""}`}
                              />
                            </td>
                            <td className={`px-1 py-1.5 text-center ${bg}`}>
                              <InlineCommentIcon
                                commentKey={ck}
                                value={cellComments[ck] || ""}
                                disabled={!canEdit}
                                onChange={(v) => onCommentChange(ck, v)}
                                label={`${row.component} — month ${m}`}
                              />
                            </td>
                          </React.Fragment>
                        );
                      })}

                      {/* Quarter totals */}
                      <td className="px-2.5 py-2 text-right tabular-nums text-sky-600 font-bold border-l border-sky-100 bg-sky-50">
                        {fmt(qAi)}
                      </td>
                      <td className={`px-2.5 py-2 text-right tabular-nums font-bold bg-sky-50 ${qAdj > qAi ? "text-emerald-600" : qAdj < qAi ? "text-rose-600" : "text-sky-900"}`}>
                        {fmt(qAdj)}
                      </td>

                      {/* Overall note */}
                      <td className={`px-2 py-1.5 border-l border-sky-50 ${bg}`}>
                        <input
                          type="text"
                          value={overallComments[row.component] || ""}
                          disabled={!canEdit}
                          placeholder="overall note"
                          onChange={(e) => onOverallChange(row.component, e.target.value)}
                          className="note-input-cf w-[130px]"
                        />
                      </td>
                    </tr>
                  );
                })}
          </tbody>

          {/* Grand total footer */}
          {filtered.length > 0 && (() => {
            const monthTotals = months.map((_, mi) => ({
              ai:  filtered.reduce((s,r) => s+toCalcNumber(r[`month${mi+1}_ai`]), 0),
              adj: filtered.reduce((s,r) => s+toCalcNumber(r[`month${mi+1}_adjusted`]), 0),
            }));
            const qAiT  = monthTotals.reduce((s, t) => s + t.ai,  0);
            const qAdjT = monthTotals.reduce((s, t) => s + t.adj, 0);
            const vari  = qAdjT - qAiT;
            return (
              <tfoot>
                <tr className="bg-sky-900 text-white sticky bottom-0 z-10">
                  <td className="px-3.5 py-2.5 font-bold sticky left-0 bg-sky-900 border-r border-sky-700 z-20">GRAND TOTAL</td>
                  <td className="bg-sky-900"/>
                  <td className="bg-sky-900"/>
                  {monthTotals.map(({ ai, adj }, i) => (
                    <React.Fragment key={i}>
                      <td className="px-2.5 py-2.5 text-right tabular-nums text-sky-200 border-l border-sky-700 bg-sky-800">{fmt(ai)}</td>
                      <td className="px-2.5 py-2.5 text-right tabular-nums font-bold text-white bg-sky-800">{fmt(adj)}</td>
                      <td className="bg-sky-800"/>
                    </React.Fragment>
                  ))}
                  <td className="px-2.5 py-2.5 text-right tabular-nums text-sky-200 border-l border-sky-700">{fmt(qAiT)}</td>
                  <td className="px-2.5 py-2.5 text-right tabular-nums font-bold text-white">{fmt(qAdjT)}</td>
                  <td className="px-2.5 py-2.5 border-l border-sky-700">
                    <span className="tabular-nums font-bold" style={{ color: vari >= 0 ? "#6ee7b7" : "#fca5a5" }}>
                      {vari >= 0 ? "▲" : "▼"} {fmt(Math.abs(vari))}
                    </span>
                  </td>
                </tr>
              </tfoot>
            );
          })()}
        </table>
      </div>
    </div>
  );
}

// ─── Drivers Tab ──────────────────────────────────────────────────────────────
function DriversTab({ rows, months, monthPeriods, quarterGroups, viewType, canEdit, fmt, driverAdj = {}, onDriverChange }) {
  // Key of the units/rate "Adjusted" cell currently focused. While focused,
  // show the raw typed value so a not-yet-finished decimal isn't rounded
  // off mid-keystroke.
  const [focusedCellKey, setFocusedCellKey] = useState(null);

  const updateDriver = (comp, monthKey, field, val) => {
    onDriverChange?.(comp, monthKey, field, val);
  };

  const getMonthAdj = (row, mi) => {
    const monthKey = (monthPeriods && monthPeriods[mi]) || months[mi];
    const drv      = driverAdj[`${row.component}|${monthKey}`] || {};
    const aiVal    = row[`month${mi + 1}_ai`] || 0;
    const unitsAi  = Math.round(aiVal / 1000) || 1;
    const rateAi   = 1000;
    const unitsAdj = drv.unitsAdj !== "" && drv.unitsAdj != null ? toCalcNumber(drv.unitsAdj) : unitsAi;
    const rateAdj  = drv.rateAdj  !== "" && drv.rateAdj  != null ? toCalcNumber(drv.rateAdj)  : rateAi;
    return { monthKey, drv, aiVal, unitsAi, rateAi, unitsAdj, rateAdj, cfAdj: unitsAdj * rateAdj };
  };

  /* ── Quarter Summary — compact: one CF AI + CF Adj column per quarter ── */
  if (viewType === "quarter_summary") {
    return (
      <div className="analytics-table-scroll rounded-xl border border-sky-100 bg-white overflow-auto max-h-[60vh] shadow-sm">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-sky-800 border-b border-sky-700 sticky top-0 z-20">
              <th className="sticky left-0 z-30 bg-sky-800 px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700 min-w-[180px]">Component</th>
              {(quarterGroups || []).map((qg) => (
                <th key={qg.key} colSpan={2} className="px-4 py-2.5 text-center text-xs font-semibold text-white border-l border-sky-700 bg-sky-800">{qg.label}</th>
              ))}
              <th colSpan={2} className="px-4 py-2.5 text-center text-xs font-semibold text-white border-l border-sky-700 bg-sky-900">Total CF</th>
            </tr>
            <tr className="bg-sky-700 border-b border-sky-600 sticky top-[44px] z-10">
              <th className="sticky left-0 z-30 bg-sky-700 border-r border-sky-600"></th>
              {(quarterGroups || []).map((qg) => (
                <React.Fragment key={qg.key}>
                  <th className="px-3 py-2 text-xs font-medium text-white uppercase border-l border-sky-600 text-right whitespace-nowrap">CF AI</th>
                  <th className="px-3 py-2 text-xs font-semibold text-white uppercase text-right whitespace-nowrap">CF Adj</th>
                </React.Fragment>
              ))}
              <th className="px-3 py-2 text-xs font-medium text-white uppercase border-l border-sky-600 text-right">AI</th>
              <th className="px-3 py-2 text-xs font-semibold text-white uppercase text-right">Adj</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => {
              const isEven = rowIdx % 2 === 0;
              const qCFs = (quarterGroups || []).map((qg) => {
                const ai  = qg.monthIdxs.reduce((s, mi) => s + (row[`month${mi + 1}_ai`] || 0), 0);
                const adj = qg.monthIdxs.reduce((s, mi) => s + getMonthAdj(row, mi).cfAdj, 0);
                return { key: qg.key, ai, adj };
              });
              const totalAi  = qCFs.reduce((s, q) => s + q.ai,  0);
              const totalAdj = qCFs.reduce((s, q) => s + q.adj, 0);
              return (
                <tr key={row.component} className={`border-b border-sky-50 ${isEven ? "bg-white" : "bg-sky-50/40"}`}>
                  <td className="sticky left-0 z-[5] border-r border-sky-200 px-4 py-2.5 bg-white">
                    <div className="font-bold text-sky-900">{row.component}</div>
                    {row.label && <div className="text-xs text-slate-500">{row.label}</div>}
                  </td>
                  {qCFs.map((qc) => (
                    <React.Fragment key={qc.key}>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600 border-l border-sky-100">{fmt(qc.ai)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-bold ${qc.adj < qc.ai ? "text-rose-600" : "text-emerald-600"}`}>{fmt(qc.adj)}</td>
                    </React.Fragment>
                  ))}
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600 border-l border-sky-200 bg-sky-50">{fmt(totalAi)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-bold ${totalAdj < totalAi ? "text-rose-600" : "text-emerald-600"}`}>{fmt(totalAdj)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  /* ── Monthly Breakdown — horizontal: components as rows, months as columns ── */
  return (
    <div className="analytics-table-scroll rounded-xl border border-sky-100 bg-white overflow-auto max-h-[60vh] shadow-sm">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-sky-800 border-b border-sky-700 sticky top-0 z-20">
            <th className="sticky left-0 z-30 bg-sky-800 px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700 min-w-[180px]">Component</th>
            {months.map((m) => (
              <th key={m} colSpan={6} className="px-4 py-2.5 text-center text-xs font-semibold text-white border-l border-sky-700 bg-sky-800">{m}</th>
            ))}
            <th colSpan={2} className="px-4 py-2.5 text-center text-xs font-semibold text-white border-l border-sky-700 bg-sky-900">Total CF</th>
          </tr>
          <tr className="bg-sky-700 border-b border-sky-600 sticky top-[44px] z-10">
            <th className="sticky left-0 z-30 bg-sky-700 border-r border-sky-600"></th>
            {months.map((m) => (
              <React.Fragment key={m}>
                <th className="px-2 py-2 text-xs font-medium text-white uppercase border-l border-sky-600 text-right whitespace-nowrap">Units AI</th>
                <th className="px-2 py-2 text-xs font-medium text-white uppercase text-right whitespace-nowrap">Units Adj</th>
                <th className="px-2 py-2 text-xs font-medium text-white uppercase text-right whitespace-nowrap">Rate AI</th>
                <th className="px-2 py-2 text-xs font-medium text-white uppercase text-right whitespace-nowrap">Rate Adj</th>
                <th className="px-2 py-2 text-xs font-medium text-white uppercase text-right whitespace-nowrap">CF AI</th>
                <th className="px-2 py-2 text-xs font-semibold text-white uppercase text-right whitespace-nowrap">CF Adj</th>
              </React.Fragment>
            ))}
            <th className="px-3 py-2 text-xs font-medium text-white uppercase border-l border-sky-600 text-right">AI</th>
            <th className="px-3 py-2 text-xs font-semibold text-white uppercase text-right">Adj</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => {
            const isEven = rowIdx % 2 === 0;
            let totalAi = 0, totalAdj = 0;
            const cells = months.map((m, mi) => {
              const { monthKey, drv, aiVal, unitsAi, rateAi, unitsAdj, rateAdj, cfAdj } = getMonthAdj(row, mi);
              totalAi  += aiVal;
              totalAdj += cfAdj;
              const unitsCellKey = `${row.component}-${monthKey}-units`;
              const rateCellKey  = `${row.component}-${monthKey}-rate`;
              const unitsFocused = focusedCellKey === unitsCellKey;
              const rateFocused  = focusedCellKey === rateCellKey;
              return (
                <React.Fragment key={m}>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-500 border-l border-sky-100">{unitsAi}</td>
                  <td className="px-1.5 py-1.5">
                    <input type="number"
                      value={unitsFocused ? (drv.unitsAdj ?? "") : (unitsAdj !== unitsAi ? unitsAdj : "")}
                      placeholder="units" disabled={!canEdit}
                      onFocus={(e) => { setFocusedCellKey(unitsCellKey); e.target.select(); }}
                      onBlur={() => setFocusedCellKey(null)}
                      onChange={(e) => updateDriver(row.component, monthKey, "unitsAdj", e.target.value)}
                      className="w-16 px-1.5 py-1 rounded border border-sky-200 text-xs tabular-nums text-right outline-none disabled:bg-sky-50 disabled:cursor-not-allowed"/>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{rateAi}</td>
                  <td className="px-1.5 py-1.5">
                    <input type="number"
                      value={rateFocused ? (drv.rateAdj ?? "") : (rateAdj !== rateAi ? rateAdj : "")}
                      placeholder="rate" disabled={!canEdit}
                      onFocus={(e) => { setFocusedCellKey(rateCellKey); e.target.select(); }}
                      onBlur={() => setFocusedCellKey(null)}
                      onChange={(e) => updateDriver(row.component, monthKey, "rateAdj", e.target.value)}
                      className="w-16 px-1.5 py-1 rounded border border-sky-200 text-xs tabular-nums text-right outline-none disabled:bg-sky-50 disabled:cursor-not-allowed"/>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-sky-700">{fmt(aiVal)}</td>
                  <td className={`px-2 py-1.5 text-right tabular-nums font-bold ${cfAdj < aiVal ? "text-rose-600" : "text-emerald-600"}`}>{fmt(cfAdj)}</td>
                </React.Fragment>
              );
            });
            return (
              <tr key={row.component} className={`border-b border-sky-50 ${isEven ? "bg-white" : "bg-sky-50/40"}`}>
                <td className="sticky left-0 z-[5] border-r border-sky-200 px-4 py-2.5 bg-white">
                  <div className="font-bold text-sky-900">{row.component}</div>
                  {row.label && <div className="text-xs text-slate-500">{row.label}</div>}
                </td>
                {cells}
                <td className="px-3 py-2 text-right tabular-nums text-slate-500 border-l border-sky-200 bg-sky-50">{fmt(totalAi)}</td>
                <td className={`px-3 py-2 text-right tabular-nums font-bold ${totalAdj < totalAi ? "text-rose-600" : "text-emerald-600"}`}>{fmt(totalAdj)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Cashflow Quarter Summary Table ──────────────────────────────────────────
function CashflowQuarterSummaryTable({ rows, quarterGroups, fmt, filterText, setFilterText, canEdit }) {
  const filtered = rows.filter((r) =>
    r.component.toLowerCase().includes(filterText.toLowerCase()) ||
    (r.category || "").toLowerCase().includes(filterText.toLowerCase())
  );

  const grandTotals = quarterGroups.map((qg) => ({
    key: qg.key,
    ai:  filtered.reduce((s, r) => s + qg.monthIdxs.reduce((a, mi) => a + toCalcNumber(r[`month${mi+1}_ai`]), 0), 0),
    adj: filtered.reduce((s, r) => s + qg.monthIdxs.reduce((a, mi) => a + toCalcNumber(r[`month${mi+1}_adjusted`]), 0), 0),
  }));
  const totalPeriodAi  = grandTotals.reduce((s, q) => s + q.ai, 0);
  const totalPeriodAdj = grandTotals.reduce((s, q) => s + q.adj, 0);

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <div className="relative">
          <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13}/>
          <input value={filterText} onChange={(e) => setFilterText(e.target.value)}
            placeholder="Search component or category…"
            className="w-[220px] rounded-lg border border-slate-300 bg-white py-1 pl-8 pr-2.5 text-x outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/>
        </div>
        {filterText && (
          <button onClick={() => setFilterText("")} className="flex cursor-pointer items-center gap-1 bg-transparent text-slate-500">
            <FiX size={12}/> Clear
          </button>
        )}
        <span className="rounded-full bg-sky-100 px-2.5 py-[3px] text-xs font-bold text-sky-700">
          {filtered.length}/{rows.length}
        </span>
        {!canEdit && (
          <span className="flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
            <FiAlertCircle size={12}/> Read-only
          </span>
        )}
      </div>

      <div className="analytics-table-scroll max-h-[72vh] overflow-auto rounded-[14px] border border-sky-100 bg-white shadow-sm">
        <table className="w-full min-w-[700px] border-collapse">
          <thead className="sticky top-0 z-20">
            <tr className="border-b border-sky-700 bg-sky-800">
              <th rowSpan={2} className="sticky left-0 z-30 min-w-[200px] border-r border-sky-700 bg-sky-800 px-3.5 py-[9px] text-left text-xs font-extrabold uppercase tracking-[0.5px] text-sky-200">
                Category
              </th>
              <th rowSpan={2} className="min-w-[100px] px-3 py-[9px] text-right tabular-nums text-xs font-bold uppercase text-sky-200">
                Prev Month
              </th>
              {quarterGroups.map((qg) => (
                <th key={qg.key} colSpan={2} className="border-l border-sky-700 px-3 py-[9px] text-center font-bold text-white">
                  {qg.label}
                </th>
              ))}
              <th colSpan={2} className="border-l border-sky-700 bg-sky-900 px-3 py-[9px] text-center text-xs font-bold text-sky-200">
                Period Total
              </th>
            </tr>
            <tr className="sticky top-[34px] z-[19] border-b border-sky-600 bg-sky-700">
              {quarterGroups.map((qg) => (
                <React.Fragment key={qg.key}>
                  <th className="min-w-[90px] border-l border-sky-600 px-2.5 py-[5px] text-right font-bold uppercase text-sky-200">AI</th>
                  <th className="min-w-[90px] px-2.5 py-[5px] text-right font-extrabold uppercase text-white">Adjusted</th>
                </React.Fragment>
              ))}
              <th className="min-w-[90px] border-l border-sky-600 px-2.5 py-[5px] text-right font-bold uppercase text-sky-200">AI</th>
              <th className="min-w-[90px] px-2.5 py-[5px] text-right font-extrabold uppercase text-white">Adj</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {filtered.length === 0
              ? <tr><td colSpan={99} className="text-center py-8 text-slate-400">No components match.</td></tr>
              : filtered.map((row, idx) => {
                  const bg = idx % 2 === 0 ? "bg-white" : "bg-sky-50";
                  const qCells = quarterGroups.map((qg) => ({
                    key: qg.key,
                    ai:  qg.monthIdxs.reduce((s, mi) => s + toCalcNumber(row[`month${mi+1}_ai`]), 0),
                    adj: qg.monthIdxs.reduce((s, mi) => s + toCalcNumber(row[`month${mi+1}_adjusted`]), 0),
                  }));
                  const periodAi  = qCells.reduce((s, q) => s + q.ai,  0);
                  const periodAdj = qCells.reduce((s, q) => s + q.adj, 0);
                  const changed   = periodAdj !== periodAi;
                  return (
                    <tr key={row.component} className={`border-b border-sky-50 ${bg}`}>
                      <td className={`px-3.5 py-2 sticky left-0 border-r border-sky-100 z-[5] ${bg}`}>
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-bold text-sky-900">{row.component}</div>
                            {row.label && row.label !== row.component && (
                              <div className="text-slate-500 text-xs">{row.label}</div>
                            )}
                          </div>
                          {changed && <span className="w-1.5 h-1.5 rounded-full bg-sky-600 flex-shrink-0"/>}
                        </div>
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums text-slate-600 ${bg}`}>{fmt(row.previous_month)}</td>
                      {qCells.map((qc, qi) => (
                        <React.Fragment key={qc.key}>
                          <td className={`px-2.5 py-2 text-right tabular-nums text-slate-500 border-l border-sky-50 ${bg}`}>{fmt(qc.ai)}</td>
                          <td className={`px-2.5 py-2 text-right tabular-nums font-bold ${bg} ${qc.adj>qc.ai?"text-emerald-600":qc.adj<qc.ai?"text-rose-600":"text-sky-900"}`}>{fmt(qc.adj)}</td>
                        </React.Fragment>
                      ))}
                      <td className="px-2.5 py-2 text-right tabular-nums text-sky-600 font-bold border-l border-sky-100 bg-sky-50">{fmt(periodAi)}</td>
                      <td className={`px-2.5 py-2 text-right tabular-nums font-bold bg-sky-50 ${periodAdj>periodAi?"text-emerald-600":periodAdj<periodAi?"text-rose-600":"text-sky-900"}`}>{fmt(periodAdj)}</td>
                    </tr>
                  );
                })}
          </tbody>
          <tfoot>
            <tr className="bg-sky-900 text-white sticky bottom-0 z-10">
              <td className="px-3.5 py-2.5 font-bold sticky left-0 bg-sky-900 border-r border-sky-700 z-20">GRAND TOTAL</td>
              <td className="bg-sky-900"/>
              {grandTotals.map(({ key, ai, adj }) => (
                <React.Fragment key={key}>
                  <td className="px-2.5 py-2.5 text-right tabular-nums text-sky-200 border-l border-sky-700 bg-sky-800">{fmt(ai)}</td>
                  <td className="px-2.5 py-2.5 text-right tabular-nums font-bold text-white bg-sky-800">{fmt(adj)}</td>
                </React.Fragment>
              ))}
              <td className="px-2.5 py-2.5 text-right tabular-nums text-sky-200 border-l border-sky-700">{fmt(totalPeriodAi)}</td>
              <td className="px-2.5 py-2.5 text-right tabular-nums font-bold text-white">{fmt(totalPeriodAdj)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Scenarios Tab ────────────────────────────────────────────────────────────
function ScenariosTab({ year, quarter, token, apiData, scenariosList, scenariosLoading, onNewScenario, onEdit, onDelete, openMenuId, setOpenMenuId, fmt }) {
  const STYLES = {
    baseline:   { icon: "◎", top: "from-sky-700 to-sky-600" },
    best_case:  { icon: "🚀", top: "from-emerald-700 to-emerald-600" },
    worst_case: { icon: "⚠️", top: "from-amber-700 to-amber-600" },
  };
  const getStyle = (sc) => STYLES[sc.scenario_name] || { icon: "💧", top: "from-cyan-700 to-cyan-600" };

  if (scenariosLoading) return <div className="text-center py-10 text-slate-500 text-xs">Loading scenarios…</div>;

  return (
    <div>
      <div className="flex justify-between mb-4 items-start gap-4">
        <div>
          <div className="font-bold text-sky-900 text-base">📈 Cashflow Scenarios</div>
          <div className="text-xs text-slate-600 mt-1">Baseline, Best Case, Worst Case & Custom</div>
        </div>
        <button onClick={onNewScenario} className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors">
          <FiPlus size={13}/> New Scenario
        </button>
      </div>

      {scenariosList.length === 0
        ? <div className="text-center py-10 text-slate-400 text-xs">No scenarios. Create your first scenario.</div>
        : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
              {scenariosList.map((sc) => {
                const st = getStyle(sc);
                const base = toCalcNumber(apiData?.compare_cashflow_scenarios?.baseline?.total_ai);
                const comp = apiData?.compare_cashflow_scenarios?.[sc.scenario_name];
                const compAi   = toCalcNumber(comp?.total_ai);
                const compUser = toCalcNumber(comp?.total_user);
                const multiplier = toCalcNumber(sc.multiplier) || 1;
                const totalAi   = compAi   || base * multiplier;
                const totalUser = compUser || base * multiplier;
                const vAmt = totalUser - (compAi || base);
                const id = sc.id || sc.scenario_name;
                return (
                  <div key={id} className="rounded-xl border border-sky-100 bg-white overflow-hidden shadow-sm hover:shadow-md transition-all">
                    <div className={`h-1 bg-gradient-to-r ${st.top}`}/>
                    <div className="p-3.5">
                      <div className="flex justify-between mb-2.5 items-start gap-2">
                        <div className="flex gap-2 items-center">
                          <span className="text-lg">{st.icon}</span>
                          <div>
                            <div className="font-bold text-sky-900 text-sm capitalize">
                              {sc.scenario_name?.replace(/_/g, " ")}
                            </div>
                            <div className="text-xs text-slate-500 tabular-nums">{year} · {quarter} · {sc.multiplier}×</div>
                          </div>
                          {sc.is_system && (
                            <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">System</span>
                          )}
                        </div>
                        <div className="relative">
                          <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === id ? null : id); }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center bg-white border border-sky-100 hover:border-sky-200 cursor-pointer text-slate-600 transition-colors">
                            <FiMoreVertical size={14}/>
                          </button>
                          {openMenuId === id && (
                            <div className="absolute right-0 top-8 z-20 bg-white rounded-lg border border-sky-100 shadow-lg w-[120px]" onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => { onEdit(sc); setOpenMenuId(null); }} disabled={sc.is_system && !sc.id}
                                className="flex items-center gap-1.5 w-full px-3 py-2 text-xs text-sky-600 hover:bg-sky-50 font-semibold transition-colors">
                                <FiEdit2 size={12}/> Edit
                              </button>
                              <button onClick={() => { onDelete(sc); setOpenMenuId(null); }} disabled={sc.is_system}
                                className="flex items-center gap-1.5 w-full px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 font-semibold border-t border-sky-100 transition-colors">
                                <FiTrash2 size={12}/> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2.5">
                        {[["AI Total", totalAi], ["Adjusted", totalUser]].map(([lbl, val]) => (
                          <div key={lbl} className="bg-sky-50 rounded-lg p-2.5 border border-sky-100">
                            <div className="text-xs text-slate-600 mb-1">{lbl}</div>
                            <div className="text-sm font-bold text-sky-900 tabular-nums">{fmt(val)}</div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between bg-sky-50 rounded-lg p-2 border border-sky-100 mb-2">
                        <span className="text-xs text-slate-600 font-semibold">Variance</span>
                        <span className={`text-xs font-bold tabular-nums ${vAmt >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {vAmt >= 0 ? "+" : ""}{fmt(vAmt)}
                        </span>
                      </div>
                      {sc.description && <div className="text-xs text-slate-600 leading-relaxed">{sc.description}</div>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Comparison table */}
            <div className="rounded-xl border border-sky-100 bg-white overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 border-b border-sky-100 bg-sky-50 flex items-center gap-2">
                <FiBarChart2 color="#64748b" size={14}/>
                <span className="font-bold text-sky-900 text-sm">Scenario Comparison — {year} {quarter}</span>
              </div>
              <div className="analytics-table-scroll overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-sky-100 bg-sky-50">
                      <th className="px-3.5 py-2 text-left font-bold text-xs uppercase text-slate-600">Metric</th>
                      {scenariosList.map((sc) => (
                        <th key={sc.id || sc.scenario_name} className="px-3.5 py-2 text-right font-bold text-xs capitalize text-slate-600">
                          {sc.scenario_name?.replace(/_/g, " ")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {["Multiplier", "AI Total", "User Forecast"].map((label, ri) => (
                      <tr key={label} className="border-b border-sky-50 bg-white">
                        <td className="px-3.5 py-2 font-semibold text-sky-700">{label}</td>
                        {scenariosList.map((sc) => {
                          const base = toCalcNumber(apiData?.compare_cashflow_scenarios?.baseline?.total_ai);
                          const comp = apiData?.compare_cashflow_scenarios?.[sc.scenario_name];
                          const multiplier = toCalcNumber(sc.multiplier) || 1;
                          const val = label === "Multiplier" ? `${sc.multiplier}×`
                            : label === "AI Total"      ? fmt(toCalcNumber(comp?.total_ai)   || base * multiplier)
                            : fmt(toCalcNumber(comp?.total_user) || base * multiplier);
                          return (
                            <td key={sc.id || sc.scenario_name} className="px-3.5 py-2 text-right tabular-nums font-semibold text-sky-900">
                              {val}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
    </div>
  );
}

// ─── Comments Tab ─────────────────────────────────────────────────────────────
// Uses OverallChat from RevenueForecastHelpers for consistency across forecasting modules

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CashflowForecasting() {
  const {
    token,
    selectedCurrency,
  } = useContext(AuthContext);
  const currency = selectedCurrency;

  /* Forecast Year / Rolling Start Month are no longer user-selectable —
     they're derived from Settings & Customization -> FY Management
     (BudgetYearContext), same convention as the Budget module's
     `currentFiscalYear = budgetYear - 1`. `year` (used throughout this
     file for every forecasting API call) IS the forecast year now — there
     is no separate AuthContext-driven override anymore. */
  const { budgetYear, fiscalYearStartMonth } = useContext(BudgetYearContext);
  const forecastYear      = budgetYear - 1;
  const year               = forecastYear;
  const rollingStartMonth = MONTH_ABBR[(fiscalYearStartMonth || 1) - 1];

  // ── State ──────────────────────────────────────────────────────────────────
  const [quarter,           setQuarter]           = useCurrentQuarter(fiscalYearStartMonth);
  const [currencyFilter,    setCurrencyFilter]    = useState("actualvalue");
  const [activeTab,         setActiveTab]         = useState("cashflow");

  /* Forecast creation mode — which view is the "source of truth" input
     surface. Cashflow Components and Drivers data are kept numerically in
     sync (see handleAdjChange / handleDriverChange below) regardless of
     mode. */
  const [forecastMode, setForecastMode] = useState("summary"); // summary | drivers

  const [forecastType,      setForecastType]      = useState("quarter");
  const [viewType,          setViewType]          = useState("monthly_breakdown");

  const [apiData,       setApiData]       = useState(null);
  const [rows,          setRows]          = useState([]);
  const [stage,         setStage]         = useState("draft");
  const [workflowMeta,  setWorkflowMeta]  = useState({});

  const [loading,    setLoading]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [applyAllMonthsModal, setApplyAllMonthsModal] = useState({ open: false, component: null, value: null });
  const [applyingAllMonths,   setApplyingAllMonths]   = useState(false);

  const [cellComments,    setCellComments]    = useState({});
  const [overallComments, setOverallComments] = useState({});
  const [driverAdj,       setDriverAdj]       = useState({});

  const [modal,           setModal]           = useState({ open: false, target: null });
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [centerError,     setCenterError]     = useState(null);
  const [filterText,      setFilterText]      = useState("");

  const [scenariosList,    setScenariosList]    = useState([]);
  const [scenariosLoading, setScenariosLoading] = useState(false);
  const [scenarioModal,    setScenarioModal]    = useState({ open: false, edit: null });
  const [scenarioSaving,   setScenarioSaving]   = useState(false);
  const [deleteModal,      setDeleteModal]      = useState({ open: false, scenario: null });
  const [deleteLoading,    setDeleteLoading]    = useState(false);
  const [openMenuId,       setOpenMenuId]       = useState(null);

  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingAction,    setPendingAction]    = useState(null);
  const [guardSaving,      setGuardSaving]      = useState(false);

  const { toasts, add: addToast } = useToast();

  const fmt      = makeFmt(currencyFilter, currency);
  const canEdit  = stage === "draft";
  const stageCfg = STAGE_CONFIG?.[stage] || STAGE_CONFIG?.draft || {};

  // ── Dynamic months (quarter vs 12months vs rolling) ────────────────────────
  const months = useMemo(() => {
    if (forecastType !== "quarter" && Array.isArray(apiData?.selected_months) && apiData.selected_months.length) {
      const SHORT = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
      return apiData.selected_months.map((p) => {
        const [y, m] = String(p).split("-");
        const idx = Math.max(0, Math.min(11, Number(m) - 1));
        return Number(y) === Number(forecastYear) ? SHORT[idx] : `${SHORT[idx]} ${y}`;
      });
    }
    return getQuarterMonths(fiscalYearStartMonth)[quarter] || [];
  }, [forecastType, apiData, quarter, forecastYear, fiscalYearStartMonth]);

  // ── Month period labels ("YYYY-MM") aligned 1:1 with months ───────────────
  const monthPeriods = useMemo(() => {
    if (Array.isArray(apiData?.selected_months) && apiData.selected_months.length) {
      return apiData.selected_months;
    }
    return [0, 1, 2].map((i) => getMonthKey(forecastYear, i, quarter, fiscalYearStartMonth));
  }, [apiData, quarter, forecastYear, fiscalYearStartMonth]);

  // ── Group monthPeriods into fiscal quarters (for Quarter Summary view) ───
  const quarterGroups = useMemo(() => {
    const groups = new Map();
    monthPeriods.forEach((p, idx) => {
      const [y, m] = String(p).split("-");
      const pos = (Number(m) - (fiscalYearStartMonth || 1) + 12) % 12;
      const qNum = Math.floor(pos / 3) + 1;
      const key = `${y}-Q${qNum}`;
      if (!groups.has(key)) {
        groups.set(key, { key, label: `Q${qNum} ${y}`, year: y, q: qNum, monthIdxs: [] });
      }
      groups.get(key).monthIdxs.push(idx);
    });
    return Array.from(groups.values());
  }, [monthPeriods, fiscalYearStartMonth]);

  // ── Scroll to top on mount ─────────────────────────────────────────────────
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);

  // ── beforeunload guard ─────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => { if (!hasChanges) return; e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [hasChanges]);

  // ── Close context menus on outside click ───────────────────────────────────
  useEffect(() => {
    const h = () => setOpenMenuId(null);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);

  // ── Guarded navigation ─────────────────────────────────────────────────────
  const guardedAction = useCallback((action) => {
    if (hasChanges) { setPendingAction(() => action); setShowUnsavedModal(true); }
    else action();
  }, [hasChanges]);

  const handleGuardSave = async () => {
    setGuardSaving(true);
    try { await _doSave(); } catch { /* toast shown */ }
    finally { setGuardSaving(false); }
    setShowUnsavedModal(false);
    const a = pendingAction; setPendingAction(null); a?.();
  };
  const handleGuardDiscard = () => {
    setHasChanges(false); setDriverAdj({}); setShowUnsavedModal(false);
    const a = pendingAction; setPendingAction(null); a?.();
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!token || !year || !currency) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ quarter, currency_filter: currencyFilter });
      if (forecastType && forecastType !== "quarter") {
        params.set("forecast_type", forecastType);
      }
      if (forecastType === "rolling") {
        params.set("rolling_start_month", rollingStartMonth);
      }
      // Tells the backend which side is authoritative when a cell has an
      // explicit value in both the Cashflow Components tab and Drivers.
      params.set("forecast_mode", forecastMode);
      const url = `${API_BASE}/${year}/${currency}?${params.toString()}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = await res.json();
      setApiData(data);

      const monthCount = Array.isArray(data?.selected_months) && data.selected_months.length
        ? data.selected_months.length
        : 3;

      const mapped = (data.rows || data.components || []).map((r) => {
        const base = {
          component:              r.component,
          label:                  r.label || r.component,
          category:               r.category || "",
          previous_month:         toBackendNumber(r.previous_month),
          quarter_total_ai:       toBackendNumber(r.quarter_total_ai),
          quarter_total_adjusted: toBackendNumber(r.quarter_total_adjusted),
          overall_comment:        r.overall_comment || "",
        };
        // For 12months/rolling the backend packs all months into monthly_data;
        // for quarter view it uses flat month1/2/3 fields.
        if (Array.isArray(r.monthly_data) && r.monthly_data.length > 0) {
          r.monthly_data.forEach((md, i) => {
            base[`month${i+1}_ai`]       = toBackendNumber(md.ai);
            base[`month${i+1}_adjusted`] = toBackendNumber(md.adjusted) ?? toBackendNumber(md.ai) ?? 0;
            base[`month${i+1}_comment`]  = md.comment || "";
          });
        } else {
          for (let i = 1; i <= monthCount; i++) {
            base[`month${i}_ai`]       = toBackendNumber(r[`month${i}_ai`]);
            base[`month${i}_adjusted`] = toBackendNumber(r[`month${i}_adjusted`]) ?? toBackendNumber(r[`month${i}_ai`]) ?? 0;
            base[`month${i}_comment`]  = r[`month${i}_comment`] || "";
          }
        }
        return base;
      });
      setRows(mapped);

      const cc = {}, oc = {};
      mapped.forEach((r) => {
        for (let m = 1; m <= monthCount; m++) {
          cc[`${r.component}-month${m}`] = r[`month${m}_comment`] || "";
        }
        oc[r.component] = r.overall_comment || "";
      });
      setCellComments(cc); setOverallComments(oc);

      const loadedDriverAdj = {};
      (data.drivers || []).forEach((drvSummary) => {
        const comp = drvSummary.component;
        (drvSummary.months || []).forEach((m) => {
          if (m.units_adjusted != null || m.rate_adjusted != null || m.month_comment) {
            loadedDriverAdj[`${comp}|${m.month}`] = {
              unitsAdj: m.units_adjusted,
              rateAdj: m.rate_adjusted,
              monthComment: m.month_comment || "",
            };
          }
        });
      });
      setDriverAdj(loadedDriverAdj);

      setStage(data.workflow_stage || "draft");
      setWorkflowMeta({ submitted_by: data.submitted_by, submitted_at: data.submitted_at, reviewed_by: data.reviewed_by, approved_by: data.approved_by });
      setHasChanges(false);
    } catch (e) { addToast(`Failed to load: ${e.message}`, "error"); }
    finally { setLoading(false); }
  }, [year, currency, quarter, currencyFilter, token, forecastYear, forecastType, rollingStartMonth, forecastMode]);

  const fetchScenarios = useCallback(async () => {
    if (!token || !year) return;
    setScenariosLoading(true);
    try {
      const res = await fetch(`${API_BASE}/${year}/scenarios?quarter=${quarter}`, {
        headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = await res.json();
      setScenariosList(data.scenarios || []);
    } catch (e) { addToast(`Failed to load scenarios: ${e.message}`, "error"); }
    finally { setScenariosLoading(false); }
  }, [year, quarter, token]);

  useEffect(() => { fetchData(); }, [
    year, currency, quarter, currencyFilter, token,
    forecastYear, forecastType, rollingStartMonth, forecastMode,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (activeTab === "scenarios") fetchScenarios(); }, [activeTab, fetchScenarios]);

  // ── Save ───────────────────────────────────────────────────────────────────
  const _doSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const saveSummary = async () => {
        const payload = rows.map((r) => {
          const entry = { component: r.component, overall_comment: overallComments[r.component] || "" };
          let qTotal = 0;
          months.forEach((_, mi) => {
            const m = mi + 1;
            // toBackendNumber(...) ?? 0, not `|| 0`: a cell can still hold the
            // raw string the user typed (e.g. "" while editing), and `|| 0`
            // would send that string straight to the backend.
            const val = toBackendNumber(r[`month${m}_adjusted`]) ?? 0;
            entry[`month${m}_adjusted`] = val;
            entry[`month${m}_comment`]  = cellComments[`${r.component}-month${m}`] || "";
            qTotal += val;
          });
          entry.quarter_total_adjusted = qTotal;
          return entry;
        });
        for (let i = 0; i < payload.length; i += 50) {
          const res = await fetch(`${API_BASE}/adjustments/${year}?quarter=${quarter}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", accept: "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload.slice(i, i + 50)),
          });
          if (!res.ok) throw new Error(await parseApiError(res));
        }
      };

      const saveDrivers = async () => {
        // Save driver adjustments if any have been set. "" counts as
        // not-set (cleared back to the AI default), same as null.
        const driverEntries = Object.entries(driverAdj).filter(([, v]) =>
          (v.unitsAdj != null && v.unitsAdj !== "") || (v.rateAdj != null && v.rateAdj !== "")
        );
        if (driverEntries.length === 0) return;
        const driverPayload = driverEntries.map(([key, adj]) => {
          const [component, month] = key.split("|");
          return { component, month, units_adjusted: toBackendNumber(adj.unitsAdj) ?? null, rate_adjusted: toBackendNumber(adj.rateAdj) ?? null, month_comment: adj.monthComment || "" };
        });
        for (let i = 0; i < driverPayload.length; i += 50) {
          const dRes = await fetch(`${API_BASE}/driver-adjustments/${year}?quarter=${quarter}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", accept: "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(driverPayload.slice(i, i + 50)),
          });
          if (!dRes.ok) throw new Error(await parseApiError(dRes));
        }
      };

      // The backend now lets whichever row was saved more recently win when
      // both Summary and Drivers hold an explicit value for the same month
      // — not just forecast_mode. So whichever tab the user is on when they
      // hit Save must be patched LAST, or its edit can be masked by the
      // other table's (cross-synced, but possibly rounding-divergent) value.
      if (activeTab === "drivers") {
        await saveSummary();
        await saveDrivers();
      } else {
        await saveDrivers();
        await saveSummary();
      }

      addToast("Cashflow adjustments saved ✓", "success");
      // Refresh from the backend so the grid shows persisted values and
      // hasChanges is cleared by fetchData's own reset — without this the
      // grid kept showing pre-save local state and stayed "dirty".
      await fetchData();
    } catch (e) { setCenterError(e.message); throw e; }
    finally { setSaving(false); }
  };

  // ── Workflow ───────────────────────────────────────────────────────────────
  const handleWorkflow = async (target, comment) => {
    setWorkflowLoading(true);
    try {
      const res = await fetch(`${API_BASE}/workflow/${year}?quarter=${quarter}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ target_stage: target, comment }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      setStage(target);
      setModal({ open: false, target: null });
      addToast(`Stage → ${STAGE_LABELS?.[target] || target} ✓`, "success");
      fetchData();
    } catch (e) { addToast(`Workflow failed: ${e.message}`, "error"); }
    finally { setWorkflowLoading(false); }
  };

  // ── Scenario CRUD ──────────────────────────────────────────────────────────
  const handleCreateScenario = async (form) => {
    setScenarioSaving(true);
    try {
      const res = await fetch(`${API_BASE}/${year}/scenarios?quarter=${quarter}`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      addToast("Scenario created ✓", "success"); setScenarioModal({ open: false, edit: null }); fetchScenarios();
    } catch (e) { addToast(`Failed: ${e.message}`, "error"); }
    finally { setScenarioSaving(false); }
  };

  const handleUpdateScenario = async (form) => {
    if (!scenarioModal.edit?.id) { addToast("Cannot edit system scenarios", "error"); return; }
    setScenarioSaving(true);
    try {
      const res = await fetch(`${API_BASE}/${year}/scenarios/${scenarioModal.edit.id}?quarter=${quarter}`, {
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      addToast("Scenario updated ✓", "success"); setScenarioModal({ open: false, edit: null }); fetchScenarios();
    } catch (e) { addToast(`Failed: ${e.message}`, "error"); }
    finally { setScenarioSaving(false); }
  };

  const handleDeleteScenario = async () => {
    if (!deleteModal.scenario?.id) { addToast("Cannot delete system scenarios", "error"); return; }
    setDeleteLoading(true);
    try {
      const res = await fetch(`${API_BASE}/${year}/scenarios/${deleteModal.scenario.id}?quarter=${quarter}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      addToast("Scenario deleted ✓", "success"); setDeleteModal({ open: false, scenario: null }); fetchScenarios();
    } catch (e) { addToast(`Failed: ${e.message}`, "error"); }
    finally { setDeleteLoading(false); }
  };

  // ── Row edit helpers ───────────────────────────────────────────────────────
  /* Summary edit → Drivers sync. Editing an "Adjusted" CF cell in Summary
     Based mode keeps whatever rate this cell already had (default 1000,
     matching DriversTab's own AI rate model) and backs out the implied
     units, so the Drivers Based view reflects the same dollar figure. */
  const handleAdjChange = (componentName, field, val) => {
    // Store exactly what the user typed — "", "13", "13.5" — instead of
    // parsing it on every keystroke. The old `parseFloat(val) || 0`
    // collapsed both "" and any not-yet-finished number to 0 immediately,
    // which then re-rendered straight back into the input, making the field
    // impossible to clear or use right. Numeric coercion now only happens
    // where a real number is actually required: the cross-tab sync math
    // below, and at save time (toBackendNumber(...) ?? 0).
    setRows((prev) => prev.map((r) => r.component === componentName ? { ...r, [field]: val } : r));
    setHasChanges(true);

    const monthMatch = /^month(\d+)_adjusted$/.exec(field);
    if (monthMatch) {
      const monthLabel = monthPeriods?.[Number(monthMatch[1]) - 1];
      if (monthLabel) {
        const syncVal = toCalcNumber(val);
        const key = `${componentName}|${monthLabel}`;
        setDriverAdj((prev) => {
          const existing = prev[key] || {};
          const rate = existing.rateAdj != null ? existing.rateAdj : 1000;
          return { ...prev, [key]: { ...existing, rateAdj: rate, unitsAdj: rate ? syncVal / rate : 0 } };
        });
      }
    }
  };
  /* onBlur for a Summary "Adjusted" month input — the "navigate to another
     row or column" moment. If the value actually changed since the cell was
     focused, offer to propagate it to all 12 months for this component. */
  const handleAdjBlur = (componentName, m, startVal) => {
    if (!canEdit) return;
    const row = rows.find((r) => r.component === componentName);
    if (!row) return;
    const curNum = toBackendNumber(row[`month${m}_adjusted`]);
    if (curNum == null || toBackendNumber(startVal) === curNum) return;
    setApplyAllMonthsModal({ open: true, component: componentName, value: curNum });
  };

  const closeApplyAllMonthsModal = () => setApplyAllMonthsModal({ open: false, component: null, value: null });

  /* "Yes, apply to all 12 months" — write the value into every currently
     visible month column locally and persist it across all 4 quarters on
     the backend, since cashflow_forecast_adjustments stores each quarter
     as its own row. */
  const applyAdjustedToAllMonths = async () => {
    const { component, value } = applyAllMonthsModal;
    if (!component) { closeApplyAllMonthsModal(); return; }
    setApplyingAllMonths(true);
    try {
      months.forEach((_, mi) => handleAdjChange(component, `month${mi + 1}_adjusted`, value));

      const res = await fetch(`${API_BASE}/adjustments/${year}/apply-all-months`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ component, value }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = await res.json();

      const skipped = data?.skipped_quarters || [];
      addToast(
        skipped.length
          ? `Applied to all 12 months for ${component} — ${skipped.join(", ")} skipped (not in draft) ✓`
          : `Applied to all 12 months for ${component} ✓`,
        "success"
      );
    } catch (e) {
      addToast(`Failed to apply to all 12 months: ${e.message}`, "error");
    } finally {
      setApplyingAllMonths(false);
      closeApplyAllMonthsModal();
    }
  };

  const handleCommentChange = (key, val) => { setCellComments((p) => ({ ...p, [key]: val })); setHasChanges(true); };
  const handleOverallChange = (comp, val) => { setOverallComments((p) => ({ ...p, [comp]: val })); setHasChanges(true); };

  /* Drivers edit → Summary sync. unitsAdj/rateAdj recompute the dollar
     value as units*rate (mirroring DriversTab's own getMonthAdj) and push
     it into the matching Summary "Adjusted" cell. */
  const handleDriverChange = (comp, monthKey, field, val) => {
    const key = `${comp}|${monthKey}`;
    let updatedEntry = null;
    setDriverAdj((prev) => {
      // Store the raw typed value ("", "13", "13.5") instead of immediately
      // running it through `parseFloat`, which rounds off a not-yet-finished
      // decimal (e.g. "13." -> 13) on every keystroke. "" still means
      // "cleared — fall back to the AI default", same as the old `null`.
      const entry = { ...(prev[key] || {}), [field]: val };
      updatedEntry = entry;
      return { ...prev, [key]: entry };
    });
    setHasChanges(true);

    const monthIdx = monthPeriods?.indexOf(monthKey) ?? -1;
    if (monthIdx !== -1) {
      setRows((prev) => {
        const rIdx = prev.findIndex((r) => r.component === comp);
        if (rIdx === -1) return prev;
        const row = prev[rIdx];
        const aiVal = row[`month${monthIdx + 1}_ai`] || 0;
        const unitsAi = Math.round(aiVal / 1000) || 1;
        const rateAi = 1000;
        const units = updatedEntry.unitsAdj !== "" && updatedEntry.unitsAdj != null ? toCalcNumber(updatedEntry.unitsAdj) : unitsAi;
        const rate  = updatedEntry.rateAdj  !== "" && updatedEntry.rateAdj  != null ? toCalcNumber(updatedEntry.rateAdj)  : rateAi;
        const n = [...prev];
        n[rIdx] = { ...row, [`month${monthIdx + 1}_adjusted`]: units * rate };
        return n;
      });
    }
  };

  // ── Derived totals (dynamic month count) ──────────────────────────────────
  // toCalcNumber, not `|| 0`: an adjusted cell can hold the raw string the
  // user is mid-typing, and `0 + "<string>"` concatenates instead of adding.
  const totals = {
    aiTotal:  rows.reduce((s, r) => s + months.reduce((acc, _, mi) => acc + (r[`month${mi+1}_ai`]||0), 0), 0),
    usrTotal: rows.reduce((s, r) => s + months.reduce((acc, _, mi) => acc + toCalcNumber(r[`month${mi+1}_adjusted`]), 0), 0),
  };
  const variance = totals.usrTotal - totals.aiTotal;
  const varPct   = totals.aiTotal ? ((variance / totals.aiTotal) * 100).toFixed(getDecimalPrecision()) : "0.0";

  // ── Tab/Quarter change guards ──────────────────────────────────────────────
  const handleTabChange               = (id) => guardedAction(() => setActiveTab(id));
  const handleQuarterChange           = (q)  => guardedAction(() => setQuarter(q));
  const handleCurrencyChange          = (v)  => guardedAction(() => setCurrencyFilter(v));
  const handleRefresh                 = ()   => guardedAction(fetchData);
  const handleForecastTypeChange      = (v)  => guardedAction(() => setForecastType(v));
  const handleViewTypeChange          = (v)  => guardedAction(() => setViewType(v));
  const handleForecastModeChange      = (v)  => guardedAction(() => {
    setForecastMode(v);
    setActiveTab(v === "drivers" ? "drivers" : "cashflow");
  });

  // ── Stage pill colour ──────────────────────────────────────────────────────
  const STAGE_PILL = {
    draft:     { bg: "#64748b" },
    submitted: { bg: "#f59e0b" },
    reviewed:  { bg: "#8b5cf6" },
    approved:  { bg: "#10b981" },
    locked:    { bg: "#dc2626" },
  };
  const pillStyle = STAGE_PILL[stage] || STAGE_PILL.draft;

  // ── Download/upload ────────────────────────────────────────────────────────
  const [downloading, setDownloading] = useState(false);
  const [uploadOpen,  setUploadOpen]  = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const downloadTemplate = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`${API_BASE}/${year}/excel-template/cashflow-adjustments?quarter=${quarter}`,
        { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } });
      if (!res.ok) throw new Error(await parseApiError(res));
      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement("a"); a.href = url; a.download = `cashflow-${year}-${quarter}.xlsx`; a.click();
      window.URL.revokeObjectURL(url);
      addToast("Template downloaded ✓", "success");
    } catch (e) { addToast(`Download failed: ${e.message}`, "error"); }
    finally { setDownloading(false); }
  };

  const handleExcelUpload = async (file) => {
    setUploading(true); setUploadError(null);
    try {
      const form = new FormData(); form.append("file", file);
      const res = await fetch(`${API_BASE}/${year}/excel-upload/cashflow-adjustments?quarter=${quarter}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      if (!res.ok) throw new Error(await parseApiError(res));
      addToast("Uploaded ✓", "success"); setUploadOpen(false); fetchData();
    } catch (e) { setUploadError(e.message); addToast(`Upload failed: ${e.message}`, "error"); }
    finally { setUploading(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="planning-compact forecasting-pnl-theme cashflow-forecast-page min-h-screen bg-sky-50 font-sans text-sky-900">

      <ToastContainer toasts={toasts}/>
      <CenterErrorModal error={centerError} onClose={() => setCenterError(null)}/>
      <WorkflowModal
        open={modal.open} target={modal.target}
        onClose={() => setModal({ open: false, target: null })}
        onConfirm={handleWorkflow} loading={workflowLoading}
      />
      <ScenarioModal
        open={scenarioModal.open} editScenario={scenarioModal.edit}
        onClose={() => setScenarioModal({ open: false, edit: null })}
        onSave={scenarioModal.edit ? handleUpdateScenario : handleCreateScenario}
        loading={scenarioSaving}
      />
      <DeleteConfirmModal
        open={deleteModal.open} scenarioName={deleteModal.scenario?.scenario_name}
        onClose={() => setDeleteModal({ open: false, scenario: null })}
        onConfirm={handleDeleteScenario} loading={deleteLoading}
      />
      <UnsavedChangesModal
        open={showUnsavedModal} saving={guardSaving}
        onSave={handleGuardSave} onDiscard={handleGuardDiscard}
        onCancel={() => { setShowUnsavedModal(false); setPendingAction(null); }}
      />
      <ApplyAllMonthsModal
        open={applyAllMonthsModal.open} componentLabel={applyAllMonthsModal.component}
        value={applyAllMonthsModal.value} applying={applyingAllMonths} fmt={fmt}
        onYes={applyAdjustedToAllMonths} onNo={closeApplyAllMonthsModal}
      />
      {uploadOpen && (
        <ImportModal
          open={uploadOpen} onClose={() => setUploadOpen(false)}
          title="Upload Cashflow Adjustments"
          description="Upload your filled Cashflow Adjustments template (.xlsx / .xls / .csv)."
          uploading={uploading} error={uploadError} onUpload={handleExcelUpload}
        />
      )}

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header className="forecasting-page-header bg-gradient-to-r from-sky-950 via-sky-900 to-sky-700 rounded-xl px-4 py-2.5 md:px-6 sticky -top-5 z-40 shadow-sm">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-white">Cashflow Forecast</h1>
            <p className="text-white/90 text-xs mt-0.5">Cash movement, drivers, scenarios and forecast discussion</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="tabular-nums text-x text-sky-200">{forecastYear} · {quarter} · {currency}</span>

            <span className="flex items-center gap-1 rounded-full px-2.5 py-[3px] text-xs font-bold text-white" style={{ background: pillStyle.bg }}>
              ● {STAGE_LABELS?.[stage] || stage}
            </span>

            {hasChanges && (
              <span className="flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/20 px-2.5 py-[3px] text-xs font-bold text-amber-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" /> Unsaved
              </span>
            )}

            <select value={currencyFilter} onChange={(e) => handleCurrencyChange(e.target.value)}
              className="cursor-pointer rounded-md border border-sky-200 bg-white px-2.5 py-1 text-x font-bold text-sky-800 outline-none">
              {CURRENCY_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <button onClick={handleRefresh}
              className="flex cursor-pointer items-center gap-1 rounded-md border border-white/20 bg-white/10 px-3 py-1 text-x font-bold text-white">
              <FiRefreshCw size={12}/> Refresh
            </button>
            <button onClick={() => window.print()}
              className="flex cursor-pointer items-center gap-1 rounded-md border border-white/20 bg-white/10 px-3 py-1 text-x font-bold text-white">
              <FiDownload size={12}/> Export
            </button>
          </div>
        </div>
      </header>

      {/* ── WORKFLOW PROGRESS ─────────────────────────────────────────── */}
      <div className="mt-2">
        <WorkflowProgress
          stage={stage} workflowMeta={workflowMeta}
          onAction={(t) => setModal({ open: true, target: t })}
        />
      </div>

      <main className="max-w-screen-2xl mx-auto px-0 py-2">

        {/* ── FILTER BAR (forecast_year / forecast_type / quarter / rolling_start / view_type) ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-s">
          <div className="flex items-center gap-2">
            <label className="font-semibold text-slate-700">Year</label>
            <span
              title="Set in Settings & Customization → FY Management"
              className="px-3 py-1 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-x font-semibold"
            >
              FY{forecastYear}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <label className="font-semibold text-slate-700">Forecast Type</label>
            <select
              value={forecastType}
              onChange={(e) => handleForecastTypeChange(e.target.value)}
              className="px-3 py-1 rounded-lg bg-white border border-slate-300 text-slate-900 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200"
            >
              <option value="quarter">Quarter Forecast</option>
              <option value="12months">12 Months</option>
              <option value="rolling">Rolling</option>
            </select>
          </div>

          {forecastType === "quarter" && (
            <div className="flex items-center gap-2">
              <label className="font-semibold text-slate-700">Quarter</label>
              <select
                value={quarter}
                onChange={(e) => handleQuarterChange(e.target.value)}
                className="px-3 py-1 rounded-lg bg-white border border-slate-300 text-slate-900 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200"
              >
                {Object.entries(getQuarterMonths(fiscalYearStartMonth)).map(([q, [first, , last]]) => (
                  <option key={q} value={q}>{q} ({first}–{last})</option>
                ))}
              </select>
            </div>
          )}

          {forecastType === "rolling" && (
            <div className="flex items-center gap-2">
              <label className="font-semibold text-slate-700">Rolling Start Month</label>
              <span
                title="Set in Settings & Customization → FY Management"
                className="px-3 py-1 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-x font-semibold"
              >
                {rollingStartMonth}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="font-semibold text-slate-700">View Type</label>
            <select
              value={viewType}
              onChange={(e) => handleViewTypeChange(e.target.value)}
              className="px-3 py-1 rounded-lg bg-white border border-slate-300 text-slate-900 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200"
            >
              <option value="monthly_breakdown">Monthly Breakdown</option>
              <option value="quarter_summary">Quarter Summary</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="font-semibold text-slate-700">Forecast Creation Mode</label>
            <select
              value={forecastMode}
              onChange={(e) => handleForecastModeChange(e.target.value)}
              title="Choose which view drives input. Components and Drivers values stay in sync regardless of mode."
              className="px-3 py-1 rounded-lg bg-white border border-slate-300 text-slate-900 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200"
            >
              <option value="summary">Summary Based</option>
              <option value="drivers">Drivers Based</option>
            </select>
          </div>
        </div>

        {/* ── KPI ROW ──────────────────────────────────────────────────────── */}
        <KpiRow summary={apiData?.cashflow_summary || apiData?.forecast_summary || {}} fmt={fmt}/>

        {/* ── TABS BAR ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b-2 border-slate-200 mb-2 gap-2 flex-wrap">
          <div className="flex gap-2">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => handleTabChange(t.id)}
                className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-x font-semibold transition-all ${
                  activeTab === t.id
                    ? "bg-white text-sky-600 rounded-t-xl -mb-0.5 border-l border-t border-r border-slate-200 border-b-2 border-b-white shadow-sm"
                    : "text-slate-500 hover:text-sky-700 hover:bg-white/60 rounded-t-xl"
                }`}>
                {t.icon} {t.label}
                {t.id === "cashflow" && (
                  <span className="rounded-md bg-sky-100 px-1.5 py-px font-extrabold text-sky-900">
                    {rows.length}
                  </span>
                )}
                {t.id === "comments" && (
                  <span className="rounded-md bg-sky-100 px-1.5 py-px font-extrabold text-sky-900">
                    0
                  </span>
                )}
              </button>
            ))}
          </div>
          {activeTab === "cashflow" && (
            <div className="flex gap-1.5">
              <button onClick={downloadTemplate} disabled={downloading}
                className={`flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1 text-x font-semibold text-sky-700 ${downloading ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
                <FiDownload size={12}/> Template
              </button>
              {canEdit && (
                <button onClick={() => { setUploadError(null); setUploadOpen(true); }}
                  className="flex cursor-pointer items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1 text-x font-bold text-white">
                  <FiUpload size={12}/> Upload Excel
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── CONTENT ──────────────────────────────────────────────────────── */}

        {/* Cashflow Components */}
        {activeTab === "cashflow" && (
          loading
            ? <TableSkeleton columns={5} rows={8} />
            : viewType === "quarter_summary"
            ? <CashflowQuarterSummaryTable
                rows={rows} quarterGroups={quarterGroups} fmt={fmt}
                filterText={filterText} setFilterText={setFilterText} canEdit={canEdit}
              />
            : <CashflowTable
                rows={rows} months={months} canEdit={canEdit}
                cellComments={cellComments} overallComments={overallComments}
                onAdjChange={handleAdjChange}
                onAdjBlur={handleAdjBlur}
                onCommentChange={handleCommentChange}
                onOverallChange={handleOverallChange}
                fmt={fmt} filterText={filterText} setFilterText={setFilterText}
              />
        )}

        {/* Driver Adjustments */}
        {activeTab === "drivers" && (
          loading
            ? <TableSkeleton columns={5} rows={8} />
            : <DriversTab rows={rows} months={months} monthPeriods={monthPeriods} quarterGroups={quarterGroups} viewType={viewType} canEdit={canEdit} fmt={fmt} driverAdj={driverAdj} onDriverChange={handleDriverChange}/>
        )}

        {/* Scenarios */}
        {activeTab === "scenarios" && (
          <ScenariosTab
            year={year} quarter={quarter} token={token} apiData={apiData}
            scenariosList={scenariosList} scenariosLoading={scenariosLoading}
            onNewScenario={() => setScenarioModal({ open: true, edit: null })}
            onEdit={(sc) => setScenarioModal({ open: true, edit: sc })}
            onDelete={(sc) => setDeleteModal({ open: true, scenario: sc })}
            openMenuId={openMenuId} setOpenMenuId={setOpenMenuId}
            fmt={fmt}
          />
        )}

        {/* Comments */}
        {activeTab === "comments" && (
          <OverallChat year={year} quarter={quarter} token={token} API_BASE={API_BASE} addToast={addToast}/>
        )}

        <SaveBar hasChanges={hasChanges} saving={saving} onSave={_doSave} disabled={!canEdit} label="Save Adjustments"/>

      </main>

      {/* Footer summary bar hidden on request
      {apiData && (
        <div className="flex flex-wrap items-center gap-4 border-t border-sky-100 bg-white px-5 py-2 tabular-nums text-xs text-slate-500">
          <span><span className="mr-1 inline-block h-[7px] w-[7px] rounded-full bg-sky-700" />{rows.length} components</span>
          <span>Net Cash Flow: <strong className="text-sky-900">{fmt(totals.usrTotal)}</strong></span>
          <span>AI Total: <strong className="text-sky-900">{fmt(totals.aiTotal)}</strong></span>
          <span className={`font-extrabold ${variance >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{variance >= 0 ? "▲" : "▼"} {Math.abs(Number(varPct))}% variance</span>
          <span>Stage: <strong className="text-sky-700">{STAGE_LABELS?.[stage] || stage}</strong></span>
          <span>Currency: <strong className="text-sky-700">{currency}</strong></span>
          <span>Display: <strong className="text-sky-700">{CURRENCY_FILTER_OPTIONS.find((o) => o.value === currencyFilter)?.label}</strong></span>
        </div>
      )}
      */}

      {/* ── SAVE BAR ─────────────────────────────────────────────────────── */}
      {hasChanges && (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-sky-200 bg-white px-5 py-2.5 shadow-lg">
          <span className="text-x font-semibold text-amber-700">⚠ Unsaved changes</span>
          <button onClick={() => { setHasChanges(false); setDriverAdj({}); fetchData(); }}
            className="cursor-pointer rounded-lg border-0 bg-slate-100 px-3.5 py-[7px] text-x text-slate-500">
            Discard
          </button>
          <button onClick={_doSave} disabled={saving || !canEdit}
            className={`flex items-center gap-1.5 rounded-lg border-0 bg-sky-700 px-[18px] py-[7px] text-x font-bold text-white ${(saving || !canEdit) ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
            {saving ? <><span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"/> Saving…</> : "💾 Save"}
          </button>
        </div>
      )}
    </div>
  );
}

