// CashflowForecasting.jsx
import React, { useState, useRef, useEffect, useCallback, useContext, useMemo } from "react";
import {
  FiRefreshCw, FiDownload, FiUpload, FiSearch, FiX,
  FiTrendingUp, FiBarChart2, FiAlertCircle, FiPlus,
  FiEdit2, FiTrash2, FiMoreVertical, FiArrowUp, FiArrowDown,
  FiDroplet, FiMessageSquare, FiSend, FiSettings, FiCpu, FiEdit,
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

// ─── TABS ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "summary",   label: "Summary",   icon: <FiBarChart2 size={13}/> },
  { id: "drivers",   label: "Drivers",   icon: <FiSettings size={13}/> },
  { id: "scenarios", label: "Scenarios", icon: <FiTrendingUp size={13}/> },
];

// ─── KPI Cards ────────────────────────────────────────────────────────────────
// Same cards as the Revenue Forecast (RevenueForecastHelpers KpiCards), on
// the net cash change (receipts − payments) plus the closing cash balance.
function KpiRow({ summary, months, fmt }) {
  const ai  = toCalcNumber(summary?.net_cashflow_ai);
  const adj = toCalcNumber(summary?.net_cashflow_adjusted);
  const varAmt = adj - ai;
  const varPct = ai ? (varAmt / Math.abs(ai)) * 100 : 0;
  const has = summary && summary.net_cashflow_adjusted != null;
  const period = months.length > 1 ? `${months[0]}–${months[months.length - 1]}` : months[0] || "";

  const cards = [
    {
      label: "AI Net Cash Change", value: has ? fmt(ai) : "—",
      sub: `${period} AI forecast`, icon: <FiCpu size={16}/>,
    },
    {
      label: "Adjusted Net Cash Change", value: has ? fmt(adj) : "—",
      sub: "Receipts − payments, adjusted", icon: <FiEdit size={16}/>,
    },
    {
      label: "Variance ($)", value: has ? fmt(varAmt) : "—",
      sub: `${varPct.toFixed(1)}% vs AI baseline`,
      icon: varAmt >= 0 ? <FiArrowUp size={16}/> : <FiArrowDown size={16}/>,
    },
    {
      label: "Variance (%)", value: has ? `${varPct >= 0 ? "+" : ""}${varPct.toFixed(1)}%` : "—",
      sub: "Relative to AI baseline",
      icon: varPct >= 0 ? <FiArrowUp size={16}/> : <FiArrowDown size={16}/>,
    },
    {
      label: "Closing Balance", value: has ? fmt(summary.closing_balance) : "—",
      sub: has ? `Opening ${fmt(summary.opening_cash)}` : "Month-ending cash position",
      icon: <FiDroplet size={16}/>,
    },
  ];

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2 mb-2">
      {cards.map((card) => (
        <div
          key={card.label}
          className="min-w-0 bg-white rounded-xl border border-sky-200 px-3 py-2 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-xs text-sky-600 font-semibold uppercase tracking-wider truncate">{card.label}</span>
            <span className="w-6 h-6 shrink-0 rounded-lg bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-700 [&_svg]:size-3.5">
              {card.icon}
            </span>
          </div>
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-base font-bold text-sky-900 tabular-nums whitespace-nowrap">{card.value}</span>
            <span className="text-[11px] text-sky-600 truncate" title={card.sub}>{card.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab action buttons ───────────────────────────────────────────────────────
// Template download + Excel upload for the Summary and Drivers tabs, as on the
// Revenue Forecast (backend: /excel-template/{adjustments,driver-adjustments},
// /excel-upload/{adjustments,driver-adjustments}).
function TabActionButtons({ activeTab, year, quarter, token, canEdit, onSuccess, addToast }) {
  const [uploadOpen,  setUploadOpen]  = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const type = activeTab === "summary" ? "adjustments" : activeTab === "drivers" ? "driver-adjustments" : null;
  if (!type) return null;
  const isDrivers = type === "driver-adjustments";

  const downloadTemplate = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`${API_BASE}/${year}/excel-template/${type}?quarter=${quarter}`, {
        headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `cashflow-${type}-${year}-${quarter}.xlsx`; a.click();
      window.URL.revokeObjectURL(url);
      addToast("Template downloaded ✓", "success");
    } catch (e) { addToast(`Download failed: ${e.message}`, "error"); }
    finally { setDownloading(false); }
  };

  const handleExcelUpload = async (file) => {
    setUploading(true); setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/${year}/excel-upload/${type}?quarter=${quarter}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      addToast(`${isDrivers ? "Driver" : "Cashflow"} adjustments uploaded ✓`, "success");
      setUploadOpen(false);
      onSuccess?.();
    } catch (e) {
      setUploadError(e.message);
      addToast(`Upload failed: ${e.message}`, "error");
    } finally { setUploading(false); }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button onClick={downloadTemplate} disabled={downloading}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-sky-700 text-x font-semibold transition-all disabled:opacity-60">
          {downloading ? <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"/> : <FiDownload size={12}/>}
          Download Template
        </button>
        {canEdit && (
          <button onClick={() => { setUploadError(null); setUploadOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-x font-semibold transition-all shadow-sm">
            <FiUpload size={12}/> Upload Excel
          </button>
        )}
      </div>
      <ImportModal open={uploadOpen} onClose={() => setUploadOpen(false)}
        title={isDrivers ? "Upload Driver Adjustments" : "Upload Cashflow Adjustments"}
        description={`Upload your filled ${isDrivers ? "Driver" : "Cashflow"} Adjustments template.`}
        uploading={uploading} error={uploadError} onUpload={handleExcelUpload}/>
    </>
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
// ─── Direct-method layout (same lines as the Cash Flow Statement) ─────────────
// Rows carry `section` / `sign` from the backend (cashflow_lines.LINE_SECTIONS):
// receipts add to cash, payments (COGS / operating / additional) take it away.
const CF_SECTION_TITLES = {
  receipts:   { heading: "(+) Cash Receipts",       total: "Total Cash Receipts" },
  cogs:       { heading: "(−) Cost of Goods Sold",  total: "Total Cost of Goods Sold" },
  opex:       { heading: "(−) Operating Expenses",  total: "Total Operating Expenses" },
  additional: { heading: "(−) Additional Expenses", total: "Total Additional Expenses" },
};

// Same alternating month shading as the Revenue Forecast tables.
const CF_MONTH_THEME = [
  { bg: "bg-slate-50/60" },
  { bg: "bg-blue-50/30" },
  { bg: "bg-indigo-50/20" },
];

// Sections in row order: [{ key, label, sign, rows }].
function groupBySection(rows) {
  const out = [];
  rows.forEach((r) => {
    const key = r.section || "other";
    let sec = out.find((s) => s.key === key);
    if (!sec) {
      sec = { key, label: r.category || key, sign: r.sign < 0 ? -1 : 1, rows: [] };
      out.push(sec);
    }
    sec.rows.push(r);
  });
  return out;
}

// A line with nothing in it: no history, no forecast, no adjustment.
function isEmptyCfLine(row, monthCount) {
  if (toCalcNumber(row.previous_month)) return false;
  for (let m = 1; m <= monthCount; m++) {
    if (toCalcNumber(row[`month${m}_ai`]) || toCalcNumber(row[`month${m}_adjusted`])) return false;
  }
  return true;
}

// Per-month AI / Adjusted totals for every section, total payments, net cash
// change and cash position (opening = cash on hand going into month 1).
function cfAggregates(rows, monthCount, openingCash) {
  const months = Array.from({ length: monthCount }, (_, mi) => mi + 1);
  const total = (list) => ({
    prev: list.reduce((s, r) => s + toCalcNumber(r.previous_month), 0),
    ai:   months.map((m) => list.reduce((s, r) => s + toCalcNumber(r[`month${m}_ai`]), 0)),
    adj:  months.map((m) => list.reduce((s, r) => s + toCalcNumber(r[`month${m}_adjusted`]), 0)),
  });
  const sections = groupBySection(rows).map((s) => ({ ...s, total: total(s.rows) }));
  const receipts = total(rows.filter((r) => r.sign >= 0));
  const payments = total(rows.filter((r) => r.sign < 0));
  const net = {
    prev: receipts.prev - payments.prev,
    ai:   receipts.ai.map((v, i) => v - payments.ai[i]),
    adj:  receipts.adj.map((v, i) => v - payments.adj[i]),
  };
  const running = (list) => {
    let cash = openingCash;
    return list.map((v) => { const open = cash; cash += v; return { open, close: cash }; });
  };
  return { sections, receipts, payments, net, positionAi: running(net.ai), positionAdj: running(net.adj) };
}

const sumOf = (list) => list.reduce((s, v) => s + v, 0);

// Green / red for an Adjusted value vs its AI value: a rise is good for a
// receipt or the net change, bad for a payment.
const cfTone = (adj, ai, sign = 1) => {
  const better = sign < 0 ? adj < ai : adj > ai;
  const worse  = sign < 0 ? adj > ai : adj < ai;
  return better ? "text-emerald-600" : worse ? "text-red-500" : "text-sky-700";
};

// Search box, match count, "show empty lines" and the read-only notice — the
// Revenue Forecast summary toolbar.
function CfToolbar({ filterText, setFilterText, shown, total, showEmpty, setShowEmpty, canEdit, stage }) {
  return (
    <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
      <div className="flex items-center gap-2">
        <div className="relative">
          <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12}/>
          <input value={filterText} onChange={(e) => setFilterText(e.target.value)}
            placeholder="Search line…"
            className="pl-7 pr-3 py-1 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-2 ring-blue-100 transition-all w-48 shadow-sm"/>
        </div>
        {filterText && (
          <button onClick={() => setFilterText("")}
            className="flex items-center gap-1 text-x text-slate-500 hover:text-sky-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors">
            <FiX size={12}/> Clear
          </button>
        )}
        <span className="text-x text-slate-500 bg-white px-2.5 py-1 rounded-lg tabular-nums border border-slate-200">
          {shown}/{total}
        </span>
        <label className="flex items-center gap-1.5 text-x text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200 cursor-pointer">
          <input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} className="accent-sky-600"/>
          Show empty lines
        </label>
      </div>
      {!canEdit && (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-x font-semibold">
          <FiAlertCircle size={12}/> Editing disabled — {STAGE_LABELS?.[stage] || stage}
        </div>
      )}
    </div>
  );
}

// A cash flow line's name cell: initials badge + name, as the Revenue
// Forecast shows a customer.
function CfLineName({ name, changed, rowBg }) {
  return (
    <td className={`px-3 py-1 pl-5 sticky left-0 border-r border-slate-200 z-[5] ${rowBg}`}>
      <div className="flex items-center gap-1.5">
        <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${avatarClass(name)}`}>{getInitials(name)}</div>
        <span className="font-semibold text-slate-900 text-xs leading-tight truncate" title={name}>{name}</span>
        {changed && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" title="Has adjustments"/>}
      </div>
    </td>
  );
}

const CF_TOTAL_STYLES = {
  section:  { row: "bg-sky-50 text-sky-900", cell: "bg-sky-50" },
  payments: { row: "bg-sky-100 text-sky-900", cell: "bg-sky-100" },
  net:      { row: "bg-sky-900 text-white", cell: "bg-sky-900" },
};

function CashflowTable({ rows, months, canEdit, stage, cellComments, overallComments, onAdjChange, onAdjBlur, onCommentChange, onOverallChange, fmt, filterText, setFilterText, openingCash = 0 }) {
  // Key of the "Adjusted" cell currently focused. While focused we show the
  // raw, unrounded value (see displayEditableNumber) instead of fighting the
  // user's keystrokes with toFixed() rounding.
  const [focusedCellKey, setFocusedCellKey] = useState(null);
  const [showEmpty, setShowEmpty] = useState(false);
  // Remembers each cell's value at focus time so onBlur can tell whether it
  // actually changed, for the parent's "apply to all 12 months" prompt.
  const focusValuesRef = useRef({});
  const q = filterText.toLowerCase();
  const matches = (r) =>
    (r.label || r.component).toLowerCase().includes(q) ||
    r.component.toLowerCase().includes(q) ||
    (r.category || "").toLowerCase().includes(q);
  const visible = (r) => matches(r) && (showEmpty || q || !isEmptyCfLine(r, months.length));
  const shownCount = rows.filter(visible).length;
  const agg = cfAggregates(rows, months.length, openingCash);
  const lastPaymentSection = [...agg.sections].reverse().find((s) => s.sign < 0)?.key;
  const netAiTotal = sumOf(agg.net.ai);
  const netAdjTotal = sumOf(agg.net.adj);

  // A non-editable totals row: label, prev month, AI / Adj per month, period.
  const totalRow = (key, label, t, tone, last = null) => {
    const st = CF_TOTAL_STYLES[tone];
    const dark = tone === "net";
    return (
      <tr key={key} className={`border-b ${dark ? "border-sky-700" : "border-slate-200"} font-semibold ${st.row}`}>
        <td className={`px-3 py-1.5 text-xs uppercase sticky left-0 border-r ${dark ? "border-sky-700" : "border-slate-200"} z-[9] ${st.cell}`}>{label}</td>
        <td className="px-3 py-1.5 text-right tabular-nums text-xs">{t.prev != null ? fmt(t.prev) : ""}</td>
        {months.map((_, mi) => (
          <React.Fragment key={mi}>
            <td className={`px-2 py-1.5 text-right tabular-nums text-xs border-l ${dark ? "border-sky-700 bg-sky-800" : "border-slate-200"}`}>{fmt(t.ai[mi])}</td>
            <td className={`px-2 py-1.5 text-right tabular-nums text-xs font-bold ${dark ? "bg-sky-800" : ""}`}>{fmt(t.adj[mi])}</td>
            <td className={`px-1 py-1.5 ${dark ? "bg-sky-800" : ""}`}/>
          </React.Fragment>
        ))}
        <td className={`px-2 py-1.5 text-right tabular-nums text-xs border-l ${dark ? "border-sky-700" : "border-slate-200"}`}>{fmt(t.qAi ?? sumOf(t.ai))}</td>
        <td className="px-2 py-1.5 text-right tabular-nums text-xs font-bold">{fmt(t.qAdj ?? sumOf(t.adj))}</td>
        <td className={`px-2 py-1.5 border-l ${dark ? "border-sky-700" : "border-slate-200"}`}>{last}</td>
      </tr>
    );
  };

  const lineRow = (row, idx) => {
    // toCalcNumber, not `|| 0`: an adjusted cell can hold the raw string the
    // user is mid-typing, and `0 + "<string>"` concatenates instead of adding.
    const qAi  = months.reduce((s, _, mi) => s+toCalcNumber(row[`month${mi+1}_ai`]), 0);
    const qAdj = months.reduce((s, _, mi) => s+toCalcNumber(row[`month${mi+1}_adjusted`]), 0);
    const rowBg = idx % 2 === 0 ? "bg-white" : "bg-slate-50/60";
    const name = row.label || row.component;

    return (
      <tr key={row.component} className={`rf-row border-b border-slate-100 transition-colors hover:bg-sky-50/50 ${rowBg}`}>
        <CfLineName name={name} changed={qAdj !== qAi} rowBg={rowBg}/>
        <td className="px-3 py-1 text-right tabular-nums text-xs text-slate-500">{fmt(row.previous_month)}</td>

        {months.map((_, mi) => {
          const m   = mi + 1;
          const ai  = row[`month${m}_ai`];
          const adj = row[`month${m}_adjusted`];
          const cellChanged = toCalcNumber(adj) !== toCalcNumber(ai) && ai != null;
          const cellKey = `${row.component}-month${m}`;
          const th  = CF_MONTH_THEME[mi % CF_MONTH_THEME.length];
          return (
            <React.Fragment key={m}>
              <td className={`px-2 py-1 text-right text-xs text-slate-500 tabular-nums border-l border-slate-100 ${th.bg}`}>{fmt(ai)}</td>
              <td className={`px-1.5 py-1 ${th.bg}`}>
                <input type="number" value={displayEditableNumber(adj, focusedCellKey === cellKey)} step={Math.pow(10, -getDecimalPrecision())} disabled={!canEdit}
                  onFocus={(e) => { setFocusedCellKey(cellKey); focusValuesRef.current[cellKey] = adj; e.target.select(); }}
                  onBlur={() => {
                    setFocusedCellKey(null);
                    const startVal = focusValuesRef.current[cellKey];
                    delete focusValuesRef.current[cellKey];
                    onAdjBlur?.(row.component, m, startVal);
                  }}
                  onChange={(e) => onAdjChange(row.component, `month${m}_adjusted`, e.target.value)}
                  className={`w-full px-1.5 py-0.5 rounded-md border text-right text-xs tabular-nums outline-none transition-all
                    ${!canEdit?"bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200"
                      :cellChanged?"border-blue-400 bg-blue-50 text-blue-900 focus:ring-2 ring-blue-100"
                      :"border-slate-300 bg-white hover:border-slate-400 focus:border-blue-500 focus:ring-2 ring-blue-100"}`}/>
              </td>
              <td className={`px-1 py-1 relative text-center ${th.bg}`}>
                <InlineCommentIcon
                  commentKey={cellKey}
                  value={cellComments[cellKey] || ""}
                  disabled={!canEdit}
                  onChange={(v) => onCommentChange(cellKey, v)}
                  label={`${name} — ${months[mi]}`}
                />
              </td>
            </React.Fragment>
          );
        })}

        <td className="px-2 py-1 text-right text-xs text-slate-500 tabular-nums border-l border-slate-200 bg-slate-50/60">{fmt(qAi)}</td>
        <td className={`px-2 py-1 text-right text-xs font-bold tabular-nums ${cfTone(qAdj, qAi, row.sign)}`}>{fmt(qAdj)}</td>

        <td className="px-1 py-1 text-center border-l border-slate-100">
          <InlineCommentIcon
            commentKey={`overall-${row.component}`}
            value={overallComments[row.component] || ""}
            disabled={!canEdit}
            onChange={(v) => onOverallChange(row.component, v)}
            label={`${name} — Overall Note`}
            isOverall
          />
        </td>
      </tr>
    );
  };

  const body = [];
  agg.sections.forEach((sec) => {
    const titles = CF_SECTION_TITLES[sec.key] || { heading: sec.label, total: `Total ${sec.label}` };
    const shown = sec.rows.filter(visible);
    body.push(
      <tr key={`h-${sec.key}`} className="border-b border-slate-200 bg-slate-100">
        <td colSpan={99} className="sticky left-0 px-3 py-1 text-xs font-bold uppercase tracking-wide text-sky-800">
          {titles.heading}
          {shown.length < sec.rows.length && (
            <span className="ml-2 font-medium normal-case tracking-normal text-slate-500">
              {shown.length} of {sec.rows.length} lines shown
            </span>
          )}
        </td>
      </tr>,
    );
    shown.forEach((r, i) => body.push(lineRow(r, i)));
    body.push(totalRow(`t-${sec.key}`, titles.total, sec.total, "section"));
    if (sec.key === lastPaymentSection) body.push(totalRow("t-payments", "Total Cash Payments", agg.payments, "payments"));
  });

  const variance = netAdjTotal - netAiTotal;
  const varPct = netAiTotal ? ((variance / Math.abs(netAiTotal)) * 100).toFixed(getDecimalPrecision()) : "0.0";

  return (
    <div>
      <CfToolbar filterText={filterText} setFilterText={setFilterText} shown={shownCount} total={rows.length}
        showEmpty={showEmpty} setShowEmpty={setShowEmpty} canEdit={canEdit} stage={stage}/>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
        <div className="analytics-table-scroll relative overflow-x-auto max-h-[72vh] overflow-y-auto">
          <table className="relative w-full min-w-[1300px] border-collapse text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="bg-sky-800 border-b border-sky-700">
                <th rowSpan={2} className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700 sticky left-0 bg-sky-800 z-30 min-w-[230px]">Cash Flow Line</th>
                <th rowSpan={2} className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide min-w-[90px]">Prev Month</th>
                {months.map((m) => (
                  <th key={m} colSpan={3} className="px-3 py-1.5 text-center text-xs font-semibold border-l text-white border-sky-700 bg-sky-800">{m}</th>
                ))}
                <th colSpan={2} className="px-3 py-1.5 text-center text-xs font-semibold text-slate-50 border-l border-sky-700 bg-sky-900">
                  {months.length === 3 ? "Quarter Total" : "Period Total"}
                </th>
                <th className="px-3 py-1.5 text-center text-xs font-semibold text-slate-50 border-l border-sky-700 bg-sky-800 min-w-[70px]">Note</th>
              </tr>
              <tr className="bg-sky-700 border-b border-slate-600 sticky top-[28px] z-10">
                {months.map((m) => (
                  <React.Fragment key={m}>
                    <th className="px-2 py-1 text-right text-xs font-medium text-slate-100 uppercase border-l border-slate-600 min-w-[75px]">AI</th>
                    <th className="px-2 py-1 text-right text-xs font-semibold text-white uppercase min-w-[85px]">Adjusted</th>
                    <th className="px-1 py-1 text-center text-xs font-medium text-slate-100 uppercase min-w-[36px]">
                      <FiMessageSquare size={11} className="mx-auto opacity-70"/>
                    </th>
                  </React.Fragment>
                ))}
                <th className="px-2 py-1 text-right text-xs font-medium text-white uppercase border-l border-slate-600 min-w-[75px]">AI</th>
                <th className="px-2 py-1 text-right text-xs font-semibold text-white uppercase min-w-[75px]">Adj</th>
                <th className="px-1 py-1 text-center border-l border-slate-600 text-white">
                  <FiMessageSquare size={11} className="mx-auto opacity-70"/>
                </th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {totalRow("cash-open", "Cash on Hand (Beginning of Month)", {
                prev: null,
                ai: agg.positionAi.map((p) => p.open),
                adj: agg.positionAdj.map((p) => p.open),
                qAi: openingCash,
                qAdj: openingCash,
              }, "section")}
              {shownCount === 0 && (
                <tr><td colSpan={99}><EmptyState label="No lines match your search."/></td></tr>
              )}
              {body}
            </tbody>
            {/* Net change and cash position — all lines, whatever the search. */}
            <tfoot className="sticky bottom-0 z-10">
              {totalRow("net", "Net Cash Change", agg.net, "net", (
                <span className={`text-xs font-bold tabular-nums ${variance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {variance >= 0 ? "+" : ""}{fmt(variance)} ({varPct}%)
                </span>
              ))}
              {totalRow("cash-close", "Month-Ending Cash Position", {
                prev: openingCash,
                ai: agg.positionAi.map((p) => p.close),
                adj: agg.positionAdj.map((p) => p.close),
                qAi: agg.positionAi.length ? agg.positionAi[agg.positionAi.length - 1].close : openingCash,
                qAdj: agg.positionAdj.length ? agg.positionAdj[agg.positionAdj.length - 1].close : openingCash,
              }, "net")}
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Drivers Tab ──────────────────────────────────────────────────────────────
function DriversTab({ rows, months, monthPeriods, quarterGroups, viewType, canEdit, fmt, driverAdj = {}, onDriverChange, onDriverCommentChange }) {
  // Key of the units/rate "Adjusted" cell currently focused. While focused,
  // show the raw typed value so a not-yet-finished decimal isn't rounded
  // off mid-keystroke.
  const [focusedCellKey, setFocusedCellKey] = useState(null);

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

  const inputCls = `w-20 px-2 py-1 rounded-lg border text-right text-x tabular-nums outline-none transition-all
    ${!canEdit ? "bg-slate-50 border-slate-200 cursor-not-allowed text-slate-400" : "border-slate-300 bg-white hover:border-slate-400 focus:border-blue-500 focus:ring-2 ring-blue-100"}`;

  if (!rows.length) return <EmptyState label="No driver data available for this period."/>;

  /* ── Quarter Summary — one CF AI + CF Adj column per quarter ── */
  if (viewType === "quarter_summary") {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
        <div className="analytics-table-scroll overflow-x-auto max-h-[66vh] overflow-y-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="bg-sky-800 border-b border-sky-700">
                <th className="sticky left-0 z-30 bg-sky-800 px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700 min-w-[200px]">Cash Flow Line</th>
                {(quarterGroups || []).map((qg) => (
                  <th key={qg.key} colSpan={2} className="px-4 py-2.5 text-center text-x font-semibold text-white border-l border-sky-700 bg-sky-800">{qg.label}</th>
                ))}
                <th colSpan={2} className="px-4 py-2.5 text-center text-x font-semibold text-white border-l border-sky-700 bg-sky-900">Total CF</th>
              </tr>
              <tr className="bg-sky-700 border-b border-slate-600 sticky top-[44px] z-10">
                <th className="sticky left-0 z-30 bg-sky-700 border-r border-slate-600"></th>
                {(quarterGroups || []).map((qg) => (
                  <React.Fragment key={qg.key}>
                    <th className="px-3 py-2 text-xs font-medium text-white uppercase border-l border-slate-600 text-right whitespace-nowrap">CF AI</th>
                    <th className="px-3 py-2 text-xs font-semibold text-white uppercase text-right whitespace-nowrap">CF Adj</th>
                  </React.Fragment>
                ))}
                <th className="px-3 py-2 text-right text-xs font-medium text-white uppercase border-l border-slate-600">AI</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase">Adj</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {rows.map((row, rowIdx) => {
                const qCFs = (quarterGroups || []).map((qg) => ({
                  key: qg.key,
                  ai:  qg.monthIdxs.reduce((s, mi) => s + (row[`month${mi + 1}_ai`] || 0), 0),
                  adj: qg.monthIdxs.reduce((s, mi) => s + getMonthAdj(row, mi).cfAdj, 0),
                }));
                const totalAi  = qCFs.reduce((s, q) => s + q.ai,  0);
                const totalAdj = qCFs.reduce((s, q) => s + q.adj, 0);
                const name = row.label || row.component;
                return (
                  <tr key={row.component} className={`rf-row border-b border-slate-100 transition-colors ${rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
                    <td className="sticky left-0 z-[5] border-r border-slate-200 px-4 py-2.5 bg-white">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${avatarClass(name)}`}>{getInitials(name)}</div>
                        <span className="font-bold text-slate-900 text-x whitespace-nowrap">{name}</span>
                      </div>
                    </td>
                    {qCFs.map((qc, qi) => (
                      <React.Fragment key={qc.key}>
                        <td className={`px-3 py-2 text-right text-x text-slate-500 tabular-nums border-l border-slate-100 ${CF_MONTH_THEME[qi % CF_MONTH_THEME.length].bg}`}>{fmt(qc.ai)}</td>
                        <td className={`px-3 py-2 text-right text-x font-bold tabular-nums ${CF_MONTH_THEME[qi % CF_MONTH_THEME.length].bg} ${cfTone(qc.adj, qc.ai, row.sign)}`}>{fmt(qc.adj)}</td>
                      </React.Fragment>
                    ))}
                    <td className="px-3 py-2 text-right text-x text-slate-500 tabular-nums border-l border-slate-200 bg-slate-50">{fmt(totalAi)}</td>
                    <td className={`px-3 py-2 text-right text-x font-bold tabular-nums ${cfTone(totalAdj, totalAi, row.sign)}`}>{fmt(totalAdj)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  /* ── Monthly Breakdown — lines as rows, months as columns ── */
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
      <div className="analytics-table-scroll overflow-x-auto max-h-[66vh] overflow-y-auto">
        <table className="w-full min-w-[1600px] border-collapse text-sm">
          <thead className="sticky top-0 z-20">
            <tr className="bg-sky-800 border-b border-sky-700">
              <th className="sticky left-0 z-30 bg-sky-800 px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700 min-w-[200px]">Cash Flow Line</th>
              {months.map((m) => (
                <th key={m} colSpan={7} className="px-4 py-2.5 text-center text-x font-semibold text-white border-l border-sky-700 bg-sky-800">{m}</th>
              ))}
              <th colSpan={2} className="px-4 py-2.5 text-center text-x font-semibold text-white border-l border-sky-700 bg-sky-900">
                {months.length === 3 ? "Quarter CF" : "Period CF"}
              </th>
            </tr>
            <tr className="bg-sky-700 border-b border-slate-600 sticky top-[44px] z-10">
              <th className="sticky left-0 z-30 bg-sky-700 border-r border-slate-600"></th>
              {months.map((m) => (
                <React.Fragment key={m}>
                  {["Units AI", "Units Adj", "Rate AI", "Rate Adj", "CF AI", "CF Adj", ""].map((h, hi) => (
                    <th key={hi} className={`px-3 py-2 text-xs font-medium text-white uppercase whitespace-nowrap
                      ${hi === 0 ? "border-l border-slate-600 text-right" : hi === 6 ? "text-center w-10" : "text-right"}`}>
                      {hi === 6 ? <FiMessageSquare size={11} className="mx-auto opacity-70"/> : h}
                    </th>
                  ))}
                </React.Fragment>
              ))}
              <th className="px-3 py-2 text-right text-xs font-medium text-white uppercase border-l border-slate-600">AI</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase">Adj</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {rows.map((row, rowIdx) => {
              let totalAi = 0, totalAdj = 0;
              const name = row.label || row.component;
              const cells = months.map((m, mi) => {
                const { monthKey, drv, aiVal, unitsAi, rateAi, unitsAdj, rateAdj, cfAdj } = getMonthAdj(row, mi);
                totalAi  += aiVal;
                totalAdj += cfAdj;
                const th = CF_MONTH_THEME[mi % CF_MONTH_THEME.length];
                const unitsCellKey = `${row.component}-${monthKey}-units`;
                const rateCellKey  = `${row.component}-${monthKey}-rate`;
                return (
                  <React.Fragment key={m}>
                    <td className={`px-3 py-2 text-right text-x text-slate-500 tabular-nums border-l border-slate-100 ${th.bg}`}>{unitsAi}</td>
                    <td className={`px-2 py-1.5 ${th.bg}`}>
                      <input type="number" placeholder="units" disabled={!canEdit}
                        value={focusedCellKey === unitsCellKey ? (drv.unitsAdj ?? "") : (unitsAdj !== unitsAi ? unitsAdj : "")}
                        onFocus={(e) => { setFocusedCellKey(unitsCellKey); e.target.select(); }}
                        onBlur={() => setFocusedCellKey(null)}
                        onChange={(e) => onDriverChange?.(row.component, monthKey, "unitsAdj", e.target.value)}
                        className={inputCls}/>
                    </td>
                    <td className={`px-3 py-2 text-right text-x text-slate-500 tabular-nums ${th.bg}`}>{rateAi}</td>
                    <td className={`px-2 py-1.5 ${th.bg}`}>
                      <input type="number" placeholder="rate" disabled={!canEdit}
                        value={focusedCellKey === rateCellKey ? (drv.rateAdj ?? "") : (rateAdj !== rateAi ? rateAdj : "")}
                        onFocus={(e) => { setFocusedCellKey(rateCellKey); e.target.select(); }}
                        onBlur={() => setFocusedCellKey(null)}
                        onChange={(e) => onDriverChange?.(row.component, monthKey, "rateAdj", e.target.value)}
                        className={inputCls}/>
                    </td>
                    <td className={`px-3 py-2 text-right text-x text-sky-700 font-semibold tabular-nums ${th.bg}`}>{fmt(aiVal)}</td>
                    <td className={`px-3 py-2 text-right text-x font-bold tabular-nums ${th.bg} ${cfTone(cfAdj, aiVal, row.sign)}`}>{fmt(cfAdj)}</td>
                    <td className={`px-1.5 py-1.5 text-center ${th.bg}`}>
                      <InlineCommentIcon
                        commentKey={`drv-${row.component}-${monthKey}`}
                        value={drv.monthComment || ""}
                        disabled={!canEdit}
                        onChange={(v) => onDriverCommentChange?.(row.component, monthKey, v)}
                        label={`${name} — ${m}`}
                      />
                    </td>
                  </React.Fragment>
                );
              });
              return (
                <tr key={row.component} className={`rf-row border-b border-slate-100 transition-colors ${rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
                  <td className="sticky left-0 z-[5] border-r border-slate-200 px-4 py-2.5 bg-white">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${avatarClass(name)}`}>{getInitials(name)}</div>
                      <span className="font-bold text-slate-900 text-x whitespace-nowrap">{name}</span>
                    </div>
                  </td>
                  {cells}
                  <td className="px-3 py-2 text-right text-x text-slate-500 tabular-nums border-l border-slate-200 bg-slate-50">{fmt(totalAi)}</td>
                  <td className={`px-3 py-2 text-right text-x font-bold tabular-nums ${cfTone(totalAdj, totalAi, row.sign)}`}>{fmt(totalAdj)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Cashflow Quarter Summary Table ──────────────────────────────────────────
function CashflowQuarterSummaryTable({ rows, quarterGroups, fmt, filterText, setFilterText, canEdit, stage, overallComments = {}, onOverallChange, openingCash = 0 }) {
  const [showEmpty, setShowEmpty] = useState(false);
  const monthCount = quarterGroups.reduce((n, qg) => Math.max(n, ...qg.monthIdxs.map((mi) => mi + 1)), 0);
  const q = filterText.toLowerCase();
  const matches = (r) =>
    (r.label || r.component).toLowerCase().includes(q) ||
    r.component.toLowerCase().includes(q) ||
    (r.category || "").toLowerCase().includes(q);
  const visible = (r) => matches(r) && (showEmpty || q || !isEmptyCfLine(r, monthCount));
  const shownCount = rows.filter(visible).length;
  const agg = cfAggregates(rows, monthCount, openingCash);
  const lastPaymentSection = [...agg.sections].reverse().find((s) => s.sign < 0)?.key;

  // Monthly arrays -> one value per quarter group.
  const byQuarter = (list) => quarterGroups.map((qg) => qg.monthIdxs.reduce((s, mi) => s + (list[mi] || 0), 0));
  // Cash position at the end of each quarter group.
  const closeByQuarter = (positions) => quarterGroups.map((qg) => {
    const last = Math.max(...qg.monthIdxs);
    return positions[last] ? positions[last].close : openingCash;
  });

  const totalRow = (key, label, t, tone, period = null, last = null) => {
    const st = CF_TOTAL_STYLES[tone];
    const dark = tone === "net";
    const ai = t.qAiList ?? byQuarter(t.ai);
    const adj = t.qAdjList ?? byQuarter(t.adj);
    return (
      <tr key={key} className={`border-b ${dark ? "border-sky-700" : "border-slate-200"} font-semibold ${st.row}`}>
        <td className={`px-3 py-1.5 text-xs uppercase sticky left-0 border-r ${dark ? "border-sky-700" : "border-slate-200"} z-[9] ${st.cell}`}>{label}</td>
        <td className="px-3 py-1.5 text-right tabular-nums text-xs">{t.prev != null ? fmt(t.prev) : ""}</td>
        {quarterGroups.map((qg, qi) => (
          <React.Fragment key={qg.key}>
            <td className={`px-2 py-1.5 text-right tabular-nums text-xs border-l ${dark ? "border-sky-700 bg-sky-800" : "border-slate-200"}`}>{fmt(ai[qi])}</td>
            <td className={`px-2 py-1.5 text-right tabular-nums text-xs font-bold ${dark ? "bg-sky-800" : ""}`}>{fmt(adj[qi])}</td>
          </React.Fragment>
        ))}
        <td className={`px-2 py-1.5 text-right tabular-nums text-xs border-l ${dark ? "border-sky-700" : "border-slate-200"}`}>{fmt(period ? period.ai : sumOf(ai))}</td>
        <td className="px-2 py-1.5 text-right tabular-nums text-xs font-bold">{fmt(period ? period.adj : sumOf(adj))}</td>
        <td className={`px-2 py-1.5 border-l ${dark ? "border-sky-700" : "border-slate-200"}`}>{last}</td>
      </tr>
    );
  };

  const lineRow = (row, idx) => {
    const rowBg = idx % 2 === 0 ? "bg-white" : "bg-slate-50/60";
    const name = row.label || row.component;
    const qCells = quarterGroups.map((qg) => ({
      key: qg.key,
      ai:  qg.monthIdxs.reduce((s, mi) => s + toCalcNumber(row[`month${mi+1}_ai`]), 0),
      adj: qg.monthIdxs.reduce((s, mi) => s + toCalcNumber(row[`month${mi+1}_adjusted`]), 0),
    }));
    const periodAi  = qCells.reduce((s, c) => s + c.ai,  0);
    const periodAdj = qCells.reduce((s, c) => s + c.adj, 0);
    return (
      <tr key={row.component} className={`rf-row border-b border-slate-100 transition-colors hover:bg-sky-50/50 ${rowBg}`}>
        <CfLineName name={name} changed={periodAdj !== periodAi} rowBg={rowBg}/>
        <td className="px-3 py-1 text-right tabular-nums text-xs text-slate-500">{fmt(row.previous_month)}</td>
        {qCells.map((qc, qi) => (
          <React.Fragment key={qc.key}>
            <td className={`px-2 py-1 text-right text-xs text-slate-500 tabular-nums border-l border-slate-100 ${CF_MONTH_THEME[qi % CF_MONTH_THEME.length].bg}`}>{fmt(qc.ai)}</td>
            <td className={`px-2 py-1 text-right text-xs font-bold tabular-nums ${CF_MONTH_THEME[qi % CF_MONTH_THEME.length].bg} ${cfTone(qc.adj, qc.ai, row.sign)}`}>{fmt(qc.adj)}</td>
          </React.Fragment>
        ))}
        <td className="px-2 py-1 text-right text-xs text-slate-500 tabular-nums border-l border-slate-200 bg-slate-50/60">{fmt(periodAi)}</td>
        <td className={`px-2 py-1 text-right text-xs font-bold tabular-nums ${cfTone(periodAdj, periodAi, row.sign)}`}>{fmt(periodAdj)}</td>
        <td className="px-1 py-1 text-center border-l border-slate-100">
          <InlineCommentIcon
            commentKey={`overall-${row.component}`}
            value={overallComments[row.component] || ""}
            disabled={!canEdit}
            onChange={(v) => onOverallChange?.(row.component, v)}
            label={`${name} — Overall Note`}
            isOverall
          />
        </td>
      </tr>
    );
  };

  const body = [];
  agg.sections.forEach((sec) => {
    const titles = CF_SECTION_TITLES[sec.key] || { heading: sec.label, total: `Total ${sec.label}` };
    const shown = sec.rows.filter(visible);
    body.push(
      <tr key={`h-${sec.key}`} className="border-b border-slate-200 bg-slate-100">
        <td colSpan={99} className="sticky left-0 px-3 py-1 text-xs font-bold uppercase tracking-wide text-sky-800">
          {titles.heading}
          {shown.length < sec.rows.length && (
            <span className="ml-2 font-medium normal-case tracking-normal text-slate-500">
              {shown.length} of {sec.rows.length} lines shown
            </span>
          )}
        </td>
      </tr>,
    );
    shown.forEach((r, i) => body.push(lineRow(r, i)));
    body.push(totalRow(`t-${sec.key}`, titles.total, sec.total, "section"));
    if (sec.key === lastPaymentSection) body.push(totalRow("t-payments", "Total Cash Payments", agg.payments, "payments"));
  });

  const closeAi = closeByQuarter(agg.positionAi);
  const closeAdj = closeByQuarter(agg.positionAdj);
  const netAi = sumOf(agg.net.ai), netAdj = sumOf(agg.net.adj);
  const variance = netAdj - netAi;
  const varPct = netAi ? ((variance / Math.abs(netAi)) * 100).toFixed(getDecimalPrecision()) : "0.0";

  return (
    <div>
      <CfToolbar filterText={filterText} setFilterText={setFilterText} shown={shownCount} total={rows.length}
        showEmpty={showEmpty} setShowEmpty={setShowEmpty} canEdit={canEdit} stage={stage}/>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
        <div className="analytics-table-scroll relative overflow-x-auto max-h-[72vh] overflow-y-auto">
          <table className="relative w-full min-w-[900px] border-collapse text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="bg-sky-800 border-b border-sky-700">
                <th rowSpan={2} className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700 sticky left-0 bg-sky-800 z-30 min-w-[230px]">Cash Flow Line</th>
                <th rowSpan={2} className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide min-w-[100px]">Prev Month</th>
                {quarterGroups.map((qg) => (
                  <th key={qg.key} colSpan={2} className="px-3 py-1.5 text-center text-xs font-semibold border-l text-white border-sky-700 bg-sky-800">{qg.label}</th>
                ))}
                <th colSpan={2} className="px-3 py-1.5 text-center text-xs font-semibold text-slate-50 border-l border-sky-700 bg-sky-900">Period Total</th>
                <th rowSpan={2} className="px-1 py-1.5 text-center border-l border-sky-700 text-white min-w-[42px]">
                  <FiMessageSquare size={11} className="mx-auto opacity-70"/>
                </th>
              </tr>
              <tr className="bg-sky-700 border-b border-slate-600 sticky top-[28px] z-10">
                {quarterGroups.map((qg) => (
                  <React.Fragment key={qg.key}>
                    <th className="px-2 py-1 text-right text-xs font-medium text-slate-100 uppercase border-l border-slate-600 min-w-[90px]">AI</th>
                    <th className="px-2 py-1 text-right text-xs font-semibold text-white uppercase min-w-[90px]">Adjusted</th>
                  </React.Fragment>
                ))}
                <th className="px-2 py-1 text-right text-xs font-medium text-white uppercase border-l border-slate-600 min-w-[90px]">AI</th>
                <th className="px-2 py-1 text-right text-xs font-semibold text-white uppercase min-w-[90px]">Adj</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {totalRow("cash-open", "Cash on Hand (Beginning of Period)", {
                prev: null,
                qAiList: quarterGroups.map((qg) => agg.positionAi[Math.min(...qg.monthIdxs)]?.open ?? openingCash),
                qAdjList: quarterGroups.map((qg) => agg.positionAdj[Math.min(...qg.monthIdxs)]?.open ?? openingCash),
              }, "section", { ai: openingCash, adj: openingCash })}
              {shownCount === 0 && (
                <tr><td colSpan={99}><EmptyState label="No lines match your search."/></td></tr>
              )}
              {body}
            </tbody>
            <tfoot className="sticky bottom-0 z-10">
              {totalRow("net", "Net Cash Change", agg.net, "net", null, (
                <span className={`text-xs font-bold tabular-nums ${variance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {variance >= 0 ? "+" : ""}{fmt(variance)} ({varPct}%)
                </span>
              ))}
              {totalRow("cash-close", "Ending Cash Position", { prev: openingCash, qAiList: closeAi, qAdjList: closeAdj }, "net", {
                ai: closeAi.length ? closeAi[closeAi.length - 1] : openingCash,
                adj: closeAdj.length ? closeAdj[closeAdj.length - 1] : openingCash,
              })}
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Scenarios Tab ────────────────────────────────────────────────────────────
// Same cards / comparison table as the Revenue Forecast; totals are the net
// cash change (receipts − payments).
const CF_SCENARIO_STYLES = {
  baseline:   { icon: "◎",  top: "bg-blue-600" },
  best_case:  { icon: "🚀", top: "bg-emerald-600" },
  worst_case: { icon: "⚠️", top: "bg-amber-500" },
};

function ScenariosTab({ year, quarter, apiData, scenariosList, scenariosLoading, onNewScenario, onEdit, onDelete, openMenuId, setOpenMenuId, fmt }) {
  const getStyle = (sc) => CF_SCENARIO_STYLES[sc.scenario_name] || { icon: "💧", top: "bg-cyan-600" };
  const compare = apiData?.compare_cashflow_scenarios || {};
  const baseAi = toCalcNumber(compare.baseline?.total_ai);
  const totalsFor = (sc) => {
    const multiplier = toCalcNumber(sc.multiplier) || 1;
    const comp = compare[sc.scenario_name];
    const compAi = toCalcNumber(comp?.total_ai);
    return {
      ai: compAi || baseAi * multiplier,
      user: toCalcNumber(comp?.total_user) || baseAi * multiplier,
      baseForVariance: compAi || baseAi,
    };
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="font-bold text-slate-900 text-s">Forecast Scenarios</h2>
          <p className="text-x text-slate-500 mt-0.5">Manage and compare forecast scenarios · totals are net cash change (receipts − payments)</p>
        </div>
        <button onClick={onNewScenario}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-x font-semibold transition-all shadow-sm">
          <FiPlus size={13}/> New Scenario
        </button>
      </div>

      {scenariosLoading ? <Spinner label="Loading scenarios…"/> : scenariosList.length === 0
        ? <EmptyState label="No scenarios found. Create your first scenario."/>
        : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {scenariosList.map((sc) => {
                const style = getStyle(sc);
                const { ai, user, baseForVariance } = totalsFor(sc);
                const vAmt = user - baseForVariance;
                const vPct = baseForVariance ? ((vAmt / Math.abs(baseForVariance)) * 100).toFixed(getDecimalPrecision()) : "0.0";
                const id = sc.id || sc.scenario_name;
                return (
                  <div key={id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-visible">
                    <div className={`h-1 ${style.top}`}/>
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl leading-none">{style.icon}</span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-slate-900 text-s capitalize">{sc.scenario_name?.replace(/_/g, " ")}</p>
                              {sc.is_system && <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold border border-slate-200">System</span>}
                            </div>
                            <p className="text-xs text-slate-400 tabular-nums">{year} · {quarter} · {sc.multiplier}×</p>
                          </div>
                        </div>
                        <div className="relative">
                          <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === id ? null : id); }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-sky-700 transition-colors">
                            <FiMoreVertical size={14}/>
                          </button>
                          {openMenuId === id && (
                            <div className="absolute right-0 top-8 z-20 bg-white rounded-xl border border-slate-200 shadow-xl overflow-visible w-32" onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => { onEdit(sc); setOpenMenuId(null); }} disabled={sc.is_system && !sc.id}
                                className="flex items-center gap-2 w-full px-3 py-2.5 text-x text-sky-700 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                <FiEdit2 size={12}/> Edit
                              </button>
                              <button onClick={() => { onDelete(sc); setOpenMenuId(null); }} disabled={sc.is_system}
                                className="flex items-center gap-2 w-full px-3 py-2.5 text-x text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed border-t border-slate-100">
                                <FiTrash2 size={12}/> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200">
                          <p className="text-xs text-slate-500 font-medium mb-0.5">AI Total</p>
                          <p className="text-s font-bold text-sky-700 tabular-nums">{fmt(ai)}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200">
                          <p className="text-xs text-slate-500 font-medium mb-0.5">Adjusted</p>
                          <p className="text-s font-bold text-slate-900 tabular-nums">{fmt(user)}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="text-xs text-slate-500 font-medium">Variance</span>
                        <span className={`text-x font-bold tabular-nums ${vAmt >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {vAmt >= 0 ? "+" : ""}{fmt(vAmt)} ({vPct}%)
                        </span>
                      </div>
                      {sc.description && <p className="text-x text-slate-500 mt-2.5 leading-relaxed line-clamp-2">{sc.description}</p>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                <FiBarChart2 className="text-slate-500" size={14}/>
                <span className="font-semibold text-sky-800 text-s">Scenario Comparison — {year} {quarter}</span>
                <span className="ml-auto text-xs text-slate-400 tabular-nums">{scenariosList.length} scenarios</span>
              </div>
              <div className="analytics-table-scroll overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Metric</th>
                      {scenariosList.map((sc) => (
                        <th key={sc.id || sc.scenario_name} className="px-4 py-3 text-right text-xs font-semibold text-sky-700 capitalize tracking-wide">
                          {sc.scenario_name?.replace(/_/g, " ")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {[
                      { label: "Multiplier",    fn: (sc) => `${sc.multiplier}×` },
                      { label: "AI Total",      fn: (sc) => fmt(totalsFor(sc).ai) },
                      { label: "User Forecast", fn: (sc) => fmt(totalsFor(sc).user), bold: true },
                    ].map((row, ri) => (
                      <tr key={row.label} className={`border-b border-slate-100 ${ri % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                        <td className="px-4 py-3 font-medium text-sky-700 text-s">{row.label}</td>
                        {scenariosList.map((sc) => (
                          <td key={sc.id || sc.scenario_name} className={`px-4 py-3 text-right tabular-nums text-s ${row.bold ? "font-bold text-slate-900" : "text-slate-600"}`}>
                            {row.fn(sc)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
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
  const [activeTab,         setActiveTab]         = useState("summary");

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

  // Cash on hand going into the first forecast month (backend opening_cash).
  const openingCash = toCalcNumber(apiData?.opening_cash ?? apiData?.cashflow_summary?.opening_cash);

  // KPI cards follow the Adjusted values as they are edited, not only on load.
  const liveSummary = useMemo(() => {
    if (!rows.length) return {};
    const agg = cfAggregates(rows, months.length, openingCash);
    const receipts = sumOf(agg.receipts.adj);
    const payments = sumOf(agg.payments.adj);
    return {
      opening_cash: openingCash,
      total_receipts: receipts,
      total_payments: payments,
      net_cashflow_adjusted: receipts - payments,
      closing_balance: openingCash + receipts - payments,
    };
  }, [rows, months.length, openingCash]);

  // Drivers: the lines with data or a driver adjustment; the empty template
  // lines have nothing to drive.
  const driverRows = useMemo(
    () => rows.filter((r) =>
      !isEmptyCfLine(r, months.length) || Object.keys(driverAdj).some((k) => k.startsWith(`${r.component}|`))),
    [rows, months.length, driverAdj],
  );

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
          section:                r.section || "",
          sign:                   Number(r.sign) < 0 ? -1 : 1,
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
          (v.unitsAdj != null && v.unitsAdj !== "") || (v.rateAdj != null && v.rateAdj !== "") || v.monthComment
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
      const lineName = rows.find((r) => r.component === component)?.label || component;
      addToast(
        skipped.length
          ? `Applied to all 12 months for ${lineName} — ${skipped.join(", ")} skipped (not in draft) ✓`
          : `Applied to all 12 months for ${lineName} ✓`,
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

  // A driver month comment: stored on its own, so it never re-derives the
  // month's Adjusted value the way a units / rate edit does.
  const handleDriverCommentChange = (comp, monthKey, val) => {
    const key = `${comp}|${monthKey}`;
    setDriverAdj((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), monthComment: val } }));
    setHasChanges(true);
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
    setActiveTab(v === "drivers" ? "drivers" : "summary");
  });

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
        open={applyAllMonthsModal.open}
        componentLabel={rows.find((r) => r.component === applyAllMonthsModal.component)?.label || applyAllMonthsModal.component}
        value={applyAllMonthsModal.value} applying={applyingAllMonths} fmt={fmt}
        onYes={applyAdjustedToAllMonths} onNo={closeApplyAllMonthsModal}
      />
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <header className="forecasting-page-header bg-gradient-to-r from-sky-950 via-sky-900 to-sky-700 rounded-xl px-4 py-2.5 md:px-6 sticky -top-5 z-40 shadow-sm">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-bold text-white">Cashflow Forecast</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select value={currencyFilter} onChange={(e) => handleCurrencyChange(e.target.value)}
              className="px-3 py-1 rounded-lg bg-white border border-sky-200 text-sky-900 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200">
              {CURRENCY_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value} className="bg-white text-sky-900">{o.label}</option>)}
            </select>
            <button onClick={handleRefresh}
              title="Reload from cache"
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 border border-white/20 text-white text-x font-semibold hover:bg-white/20 transition-colors">
              <FiRefreshCw size={12}/> Refresh
            </button>
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 border border-white/20 text-white text-x font-semibold hover:bg-white/20 transition-colors">
              <FiDownload size={12}/> Export
            </button>
          </div>
        </div>
      </header>

      {/* ── FILTER BAR (forecast_year / forecast_type / quarter / view_type) ── */}
      <div className="max-w-screen-2xl mx-auto px-0 mt-2">
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
      </div>

      {/* ── MAIN ───────────────────────────────────────────────────── */}
      <main className="max-w-screen-2xl mx-auto px-0 py-2">

        <KpiRow summary={liveSummary} months={months} fmt={fmt}/>
        <WorkflowProgress stage={stage} workflowMeta={workflowMeta} onAction={(t) => setModal({ open: true, target: t })}/>

        {/* ── TABS ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b-2 border-slate-200 mb-2 gap-2 flex-wrap">
          <div className="flex items-end gap-0.5">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => handleTabChange(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-s font-semibold whitespace-nowrap transition-all
                  ${activeTab === t.id
                    ? "bg-white text-sky-600 rounded-t-xl -mb-0.5 border-l border-t border-r border-slate-200 border-b-2 border-b-white shadow-sm"
                    : "text-slate-500 hover:text-sky-700 hover:bg-white/60 rounded-t-xl"}`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <TabActionButtons activeTab={activeTab} year={year} quarter={quarter} token={token}
            canEdit={canEdit} onSuccess={fetchData} addToast={addToast}/>
        </div>

        {/* ══ SUMMARY TAB ════════════════════════════════════════════ */}
        {activeTab === "summary" && (
          <div>
            {loading
              ? <div className="bg-white rounded-xl border border-slate-200 shadow-sm"><TableSkeleton columns={5} rows={8} /></div>
              : viewType === "quarter_summary"
              ? <CashflowQuarterSummaryTable
                  rows={rows} quarterGroups={quarterGroups} fmt={fmt}
                  filterText={filterText} setFilterText={setFilterText} canEdit={canEdit} stage={stage}
                  overallComments={overallComments} onOverallChange={handleOverallChange}
                  openingCash={openingCash}
                />
              : <CashflowTable
                  rows={rows} months={months} canEdit={canEdit} stage={stage}
                  cellComments={cellComments} overallComments={overallComments}
                  onAdjChange={handleAdjChange}
                  onAdjBlur={handleAdjBlur}
                  onCommentChange={handleCommentChange}
                  onOverallChange={handleOverallChange}
                  fmt={fmt} filterText={filterText} setFilterText={setFilterText}
                  openingCash={openingCash}
                />}
            <SaveBar hasChanges={hasChanges} saving={saving} onSave={_doSave} disabled={!canEdit}/>
          </div>
        )}

        {/* ══ DRIVERS TAB ════════════════════════════════════════════ */}
        {activeTab === "drivers" && (
          <div>
            {loading
              ? <Spinner label="Loading drivers…"/>
              : <DriversTab rows={driverRows} months={months} monthPeriods={monthPeriods} quarterGroups={quarterGroups}
                  viewType={viewType} canEdit={canEdit} fmt={fmt} driverAdj={driverAdj}
                  onDriverChange={handleDriverChange} onDriverCommentChange={handleDriverCommentChange}/>}
            <SaveBar hasChanges={hasChanges} saving={saving} onSave={_doSave} label="Save Driver Adjustments" disabled={!canEdit}/>
          </div>
        )}

        {/* ══ SCENARIOS TAB ══════════════════════════════════════════ */}
        {activeTab === "scenarios" && (
          <ScenariosTab
            year={year} quarter={quarter} apiData={apiData}
            scenariosList={scenariosList} scenariosLoading={scenariosLoading}
            onNewScenario={() => setScenarioModal({ open: true, edit: null })}
            onEdit={(sc) => setScenarioModal({ open: true, edit: sc })}
            onDelete={(sc) => setDeleteModal({ open: true, scenario: sc })}
            openMenuId={openMenuId} setOpenMenuId={setOpenMenuId}
            fmt={fmt}
          />
        )}

        {/* ── Overall Chat — below the tabs, as on the Revenue Forecast ── */}
        <OverallChat year={year} quarter={quarter} token={token} API_BASE={API_BASE} addToast={addToast}/>

      </main>
    </div>
  );
}
