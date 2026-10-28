// RevenueForecasting.jsx
import React, { useState, useRef, useEffect, useMemo, useCallback, useContext } from "react";
import {
  FiRefreshCw, FiDownload, FiUpload, FiSearch, FiX,
  FiMessageSquare, FiTrendingUp, FiBarChart2, FiSettings,
  FiDatabase, FiAlertCircle, FiPlus, FiEdit2, FiTrash2, FiMoreVertical,
} from "react-icons/fi";

import customersSampleUrl       from "../../assets/sampleExcelfiles/customers.csv?url";
import chartOfAccountsSampleUrl from "../../assets/sampleExcelfiles/chart_of_accounts.csv?url";
import glTransactionsSampleUrl  from "../../assets/sampleExcelfiles/general_ledger_transactions.csv?url";
import { AuthContext }          from "../../context/AuthContext";
import { BudgetYearContext }    from "../../context/BudgetYearContext";
import { useCurrentQuarter } from "../../hooks/useCurrentQuarter";
import { API_BASE_URL }         from "../../config/config";

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

import {
  getQuarterMonths, STAGE_LABELS, STAGE_CONFIG,
  fmt, parseApiError, getInitials, avatarClass, getMonthKey,
  useToast, ToastContainer, Spinner, EmptyState,
  CenterErrorModal, WorkflowModal, ImportModal,
  WorkflowProgress, KpiCards, SaveBar, CommentCell,
  ScenarioModal, OverallChat,
  InlineCommentIcon,   // NEW
} from "./RevenueForecastHelpers";
import TableSkeleton from "../Skeleton/TableSkeleton";
import { getDecimalPrecision } from '../../utils/formatters';

const API_BASE = `${API_BASE_URL}/api/v1/forecasting/managemet/revenue-forecast`;

// ─── Global CSS ───────────────────────────────────────────────────────────────
// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "summary",   label: "Summary",    icon: <FiBarChart2 size={13}/> },
  { id: "drivers",   label: "Drivers",    icon: <FiSettings size={13}/> },
  { id: "scenarios", label: "Scenarios",  icon: <FiTrendingUp size={13}/> },
];

const CURRENCY_FILTER_OPTIONS = [
  { value: "actualvalue", label: "Actual" },
  { value: "thousands", label: "Thousands" },
  { value: "millions", label: "Millions" },
];

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

// Shared display logic for the editable "Adjusted" number inputs (Summary
// month cells and Drivers units/rate/revenue cells). While focused we show
// the raw value as-is — including "" or a partially-typed "13." — so the
// rounding below never overwrites what the user is mid-typing. The old code
// ran `Number(value).toFixed(precision)` unconditionally, and since
// `Number("").toFixed(n)` is "0.00" (not ""), an emptied field re-rendered
// straight back to 0 before the user could finish clearing it.
export function displayEditableNumber(value, isFocused) {
  if (isFocused) return value ?? "";
  return value != null && value !== "" ? +Number(value).toFixed(getDecimalPrecision()) : "";
}

function pickField(obj, keys, fallback = null) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] != null && obj[key] !== "") {
      return obj[key];
    }
  }
  return fallback;
}

function pickMonthField(row, month, suffix, fallback = null) {
  return pickField(row, [
    `month${month}_${suffix}`,
    `month_${month}_${suffix}`,
    `m${month}_${suffix}`,
  ], fallback);
}

// ─── UnsavedChangesModal ──────────────────────────────────────────────────────
function UnsavedChangesModal({ open, saving, onSave, onDiscard, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1100] bg-sky-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-[400px] shadow-2xl border border-slate-200 overflow-visible animate-in fade-in zoom-in-95 duration-200">
        <div className="h-1 bg-amber-400"/>
        <div className="px-6 py-5">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <FiAlertCircle className="text-amber-500" size={20}/>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Unsaved Changes</h3>
              <p className="text-slate-500 text-s mt-1 leading-relaxed">
                You have unsaved changes. Would you like to save before continuing?
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button onClick={onCancel}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sky-700 text-s font-semibold transition-colors">
              Stay
            </button>
            <button onClick={onDiscard}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-s font-semibold transition-colors">
              Discard
            </button>
            <button onClick={onSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-s font-semibold transition-all disabled:opacity-50">
              {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</> : "💾 Save & Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ApplyAllMonthsModal ──────────────────────────────────────────────────────
// Shown when the user edits an "Adjusted" month cell and then navigates away
// (blurs the input) with the value actually changed. Offers to propagate that
// same value to all 12 months for the customer, or keep it scoped to the one
// month that was edited.
function ApplyAllMonthsModal({ open, customerName, value, applying, onYes, onNo }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1100] bg-sky-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-[420px] shadow-2xl border border-slate-200 overflow-visible animate-in fade-in zoom-in-95 duration-200">
        <div className="h-1 bg-blue-500"/>
        <div className="px-6 py-5">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
              <FiTrendingUp className="text-blue-500" size={20}/>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Apply to all 12 months?</h3>
              <p className="text-slate-500 text-s mt-1 leading-relaxed">
                Would you like to apply this Adjusted value ({fmt(value)}) to all 12 months
                for <span className="font-semibold text-sky-800">{customerName}</span>?
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button onClick={onNo} disabled={applying}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sky-700 text-s font-semibold transition-colors disabled:opacity-50">
              No, just this month
            </button>
            <button onClick={onYes} disabled={applying}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-s font-semibold transition-all disabled:opacity-50">
              {applying ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Applying…</> : "Yes, apply to all 12 months"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TabActionButtons ─────────────────────────────────────────────────────────
function TabActionButtons({ activeTab, year, quarter, token, canEdit, onSuccess, addToast }) {
  const [summaryUploadOpen, setSummaryUploadOpen] = useState(false);
  const [driverUploadOpen,  setDriverUploadOpen]  = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [downloading, setDownloading] = useState(null);

  const downloadTemplate = async (type) => {
    setDownloading(type);
    try {
      const res = await fetch(`${API_BASE}/${year}/excel-template/${type}?quarter=${quarter}`, {
        headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `${type}-${year}-${quarter}.xlsx`; a.click();
      window.URL.revokeObjectURL(url);
      addToast("Template downloaded ✓", "success");
    } catch (e) { addToast(`Download failed: ${e.message}`, "error"); }
    finally { setDownloading(null); }
  };

  const handleExcelUpload = async (file, uploadType) => {
    setUploading(true); setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const endpoint = uploadType === "revenue"
        ? `${API_BASE}/${year}/excel-upload/revenue-adjustments?quarter=${quarter}`
        : `${API_BASE}/${year}/excel-upload/driver-adjustments?quarter=${quarter}`;
      const res = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      if (!res.ok) throw new Error(await parseApiError(res));
      addToast(`${uploadType === "revenue" ? "Revenue" : "Driver"} adjustments uploaded ✓`, "success");
      setSummaryUploadOpen(false); setDriverUploadOpen(false);
      onSuccess?.();
    } catch (e) {
      setUploadError(e.message);
      addToast(`Upload failed: ${e.message}`, "error");
    } finally { setUploading(false); }
  };

  if (activeTab === "summary") return (
    <>
      <div className="flex items-center gap-2">
        <button onClick={() => downloadTemplate("revenue-adjustments")} disabled={downloading === "revenue-adjustments"}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-sky-700 text-x font-semibold transition-all disabled:opacity-60">
          {downloading === "revenue-adjustments" ? <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"/> : <FiDownload size={12}/>}
          Download Template
        </button>
        {canEdit && (
          <button onClick={() => { setUploadError(null); setSummaryUploadOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-x font-semibold transition-all shadow-sm">
            <FiUpload size={12}/> Upload Excel
          </button>
        )}
      </div>
      <ImportModal open={summaryUploadOpen} onClose={() => setSummaryUploadOpen(false)}
        title="Upload Revenue Adjustments" description="Upload your filled Revenue Adjustments template."
        uploading={uploading} error={uploadError} onUpload={(f) => handleExcelUpload(f, "revenue")}/>
    </>
  );

  if (activeTab === "drivers") return (
    <>
      <div className="flex items-center gap-2">
        <button onClick={() => downloadTemplate("driver-adjustments")} disabled={downloading === "driver-adjustments"}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-sky-700 text-x font-semibold transition-all disabled:opacity-60">
          {downloading === "driver-adjustments" ? <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"/> : <FiDownload size={12}/>}
          Download Template
        </button>
        {canEdit && (
          <button onClick={() => { setUploadError(null); setDriverUploadOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-x font-semibold transition-all shadow-sm">
            <FiUpload size={12}/> Upload Excel
          </button>
        )}
      </div>
      <ImportModal open={driverUploadOpen} onClose={() => setDriverUploadOpen(false)}
        title="Upload Driver Adjustments" description="Upload your filled Driver Adjustments template."
        uploading={uploading} error={uploadError} onUpload={(f) => handleExcelUpload(f, "driver")}/>
    </>
  );
  return null;
}

// ─── DeleteConfirmModal ───────────────────────────────────────────────────────
function DeleteConfirmModal({ open, scenarioName, onClose, onConfirm, loading }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1001] bg-sky-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-[380px] shadow-2xl border border-slate-200 text-center">
        <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-3">
          <FiTrash2 className="text-red-500" size={22}/>
        </div>
        <h3 className="font-bold text-slate-900 text-base mb-1">Delete Scenario</h3>
        <p className="text-slate-500 text-s mb-1">Are you sure you want to delete</p>
        <p className="font-semibold text-sky-800 text-s mb-4">"{scenarioName}"?</p>
        <p className="text-x text-slate-400 mb-5">This cannot be undone.</p>
        <div className="flex gap-2 justify-center">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sky-700 text-s font-semibold transition-colors">Cancel</button>
          <button onClick={onConfirm} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-s font-semibold transition-all disabled:opacity-50">
            {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Deleting…</> : <><FiTrash2 size={13}/> Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RevenueForecasting() {
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

  // ── FIX 1: Scroll to top — use a wrapper ref + scrollTop on the scrollable parent ──
  const pageRef = useRef(null);

  useEffect(() => {
    // Scroll the page container itself (not window) to the very top on mount
    if (pageRef.current) {
      pageRef.current.scrollTop = 0;
    }
    // Also attempt window-level scroll
    window.scrollTo({ top: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  const [quarter, setQuarter]     = useCurrentQuarter(fiscalYearStartMonth);
  const [currencyFilter, setCurrencyFilter] = useState("actualvalue");
  const [activeTab, setActiveTab] = useState("summary");

  /* Forecast creation mode — which view is the "source of truth" input
     surface. Summary and Drivers data are always kept numerically in sync
     (see handleAdjChange / handleDriverChange below) regardless of mode;
     this only controls which tab is shown by default. */
  const [forecastMode, setForecastMode] = useState("summary"); // summary | drivers

  /* ── New filter state (swagger params) ───────────────────────────── */
  const [forecastType,       setForecastType]       = useState("quarter");      // quarter | 12months | rolling
  const [viewType,           setViewType]           = useState("monthly_breakdown"); // monthly_breakdown | quarter_summary
  const [debouncedCustomer,  setDebouncedCustomer]  = useState("");

  /* ── Pagination (server-side) ─────────────────────────────────────── */
  const [page,       setPage]       = useState(1);
  const [pageSize,   setPageSize]   = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1;

  const [apiData,  setApiData]  = useState(null);
  const [rows,     setRows]     = useState([]);
  const [drivers,  setDrivers]  = useState([]);
  const [comments, setComments] = useState([]);
  const [stage,    setStage]    = useState("draft");
  const [workflowMeta, setWorkflowMeta] = useState({});

  const [loading,          setLoading]          = useState(false);
  const [saving,           setSaving]           = useState(false);
  const [hasChanges,       setHasChanges]       = useState(false);
  const [driverSaving,     setDriverSaving]     = useState(false);
  const [driverHasChanges, setDriverHasChanges] = useState(false);

  // Key of the "Adjusted" numeric input currently focused (Summary or
  // Drivers table). While a cell is focused we show its raw, unrounded
  // value (including "") so the user can fully clear it and type decimals
  // without the toFixed() display formatting fighting their keystrokes;
  // once it blurs we go back to showing the rounded value.
  const [focusedCellKey, setFocusedCellKey] = useState(null);

  // Remembers each Summary "Adjusted" cell's value at the moment it was
  // focused (keyed by the same cellKey used for focusedCellKey), so onBlur
  // can tell whether the user actually changed it — vs. just tabbing through
  // without editing — before offering the "apply to all 12 months" prompt.
  const focusValuesRef = useRef({});
  const [applyAllMonthsModal, setApplyAllMonthsModal] = useState({
    open: false, idx: null, field: null, value: null, customerName: null,
  });
  const [applyingAllMonths, setApplyingAllMonths] = useState(false);

  // ── FIX 2: Separate comment state for inline icon popups ──
  const [summaryComments,    setSummaryComments]    = useState({});
  const [summaryRowComments, setSummaryRowComments] = useState({});
  const [driverComments,     setDriverComments]     = useState({});

  const [modal,           setModal]           = useState({ open: false, target: null });
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [filterText,      setFilterText]      = useState("");
  const [centerError,     setCenterError]     = useState(null);

  /* Debounce search box → API customer_name (avoid per-keystroke fetch). */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCustomer(filterText.trim()), 450);
    return () => clearTimeout(t);
  }, [filterText]);

  const rawImportRef = useRef(null);
  const [importing,   setImporting]   = useState(false);
  const [importError, setImportError] = useState(null);

  /* Guards against stale fetchData responses when filters change quickly. */
  const fetchSeqRef       = useRef(0);
  const fetchAbortCtrlRef = useRef(null);

  /* Tracks which customers have unsaved edits so we only PATCH the changed
     rows instead of all 492 every time. Cleared after a successful save. */
  const dirtyCustomersRef = useRef(new Set());
  const dirtyDriverKeysRef = useRef(new Set());   // `${customer}|${monthKey}`

  const [scenariosList,    setScenariosList]    = useState([]);
  const [scenariosLoading, setScenariosLoading] = useState(false);
  const [scenarioModal,    setScenarioModal]    = useState({ open: false, edit: null });
  const [scenarioSaving,   setScenarioSaving]   = useState(false);
  const [deleteModal,      setDeleteModal]      = useState({ open: false, scenario: null });
  const [deleteLoading,    setDeleteLoading]    = useState(false);
  const [openMenuId,       setOpenMenuId]       = useState(null);

  // Unsaved guard
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingAction,    setPendingAction]    = useState(null);
  const [guardSaving,      setGuardSaving]      = useState(false);
  const hasUnsavedChanges = hasChanges || driverHasChanges;

  const { toasts, add: addToast } = useToast();
  /* `months` drives every column in the summary/drivers tables.
     - Quarter view: 3 months from getQuarterMonths(fiscalYearStartMonth)[quarter].
     - 12months / rolling: the N "YYYY-MM" periods returned by the API.
     The display label uses the short month name (with year if outside the
     selected year, so rolling forecasts that cross a boundary stay clear). */
  const months = useMemo(() => {
    if (forecastType !== "quarter" && Array.isArray(apiData?.selected_months) && apiData.selected_months.length) {
      const SHORT = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
      return apiData.selected_months.map((p) => {
        const [y, m] = String(p).split("-");
        const idx = Math.max(0, Math.min(11, Number(m) - 1));
        return Number(y) === Number(forecastYear || year) ? SHORT[idx] : `${SHORT[idx]} ${y}`;
      });
    }
    return getQuarterMonths(fiscalYearStartMonth)[quarter];
  }, [forecastType, apiData, quarter, forecastYear, year, fiscalYearStartMonth]);
  /* The actual API period labels ("YYYY-MM"), aligned 1:1 with `months`.
     Drivers tab uses these to look up month_comment / units / rate. */
  const monthPeriods = useMemo(() => {
    if (Array.isArray(apiData?.selected_months) && apiData.selected_months.length) {
      return apiData.selected_months;
    }
    return [0, 1, 2].map((i) => getMonthKey(forecastYear || year, i, quarter, fiscalYearStartMonth));
  }, [apiData, quarter, forecastYear, year, fiscalYearStartMonth]);

  /* Group the month columns into fiscal quarters for the Quarter Summary
     view. Each entry has the label ("Q1 2025"), the indices of the months
     in `months`/`monthPeriods` that fall in this quarter, and the period
     span. Quarter number is the month's position within the fiscal year
     (starting at fiscalYearStartMonth), not the calendar quarter. */
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

  const canEdit  = stage === "draft";
  const stageCfg = STAGE_CONFIG[stage] || STAGE_CONFIG.draft;

  // beforeunload
  useEffect(() => {
    const h = (e) => { if (!hasUnsavedChanges) return; e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [hasUnsavedChanges]);

  // close context menu
  useEffect(() => {
    const h = () => setOpenMenuId(null);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);

  const guardedAction = useCallback((action) => {
    if (hasUnsavedChanges) { setPendingAction(() => action); setShowUnsavedModal(true); }
    else action();
  }, [hasUnsavedChanges]);

  const handleGuardSave = async () => {
    setGuardSaving(true);
    try {
      const savedSomething = hasChanges || driverHasChanges;
      if (hasChanges)       await _doSave();
      if (driverHasChanges) await _doSaveDrivers();
      // Refresh from the backend so the grid reflects persisted values and
      // the dirty flags/refs are authoritatively cleared (see handleSave).
      if (savedSomething) await fetchData();
    } catch { /* shown via toast */ }
    finally { setGuardSaving(false); }
    setShowUnsavedModal(false);
    const a = pendingAction; setPendingAction(null); a?.();
  };

  const handleGuardDiscard = () => {
    setHasChanges(false); setDriverHasChanges(false);
    setShowUnsavedModal(false);
    const a = pendingAction; setPendingAction(null); a?.();
  };

  const validateFileName = (name) =>
    [/^customers( \d{2}-\d{4})?\.(xlsx|xls|csv)$/i,
     /^chart_of_accounts( \d{2}-\d{4})?\.(xlsx|xls|csv)$/i,
     /^general_ledger_transactions( \d{2}-\d{4})?\.(xlsx|xls|csv)$/i,
    ].some((p) => p.test(name));

  // ── Fetch data ── (FIX 3: Don't auto-fetch comments on mount; defer to scroll/tab) ──
  const fetchData = useCallback(async () => {
    if (!token || !year || !currency) return;

    /* Cancel any in-flight request and bump the sequence so only the
       latest response can write state. Protects against race conditions
       when the user toggles filters rapidly. */
    if (fetchAbortCtrlRef.current) fetchAbortCtrlRef.current.abort();
    const controller = new AbortController();
    fetchAbortCtrlRef.current = controller;
    const seq = ++fetchSeqRef.current;

    setLoading(true);
    try {
      const params = new URLSearchParams({ quarter, currency_filter: currencyFilter });
      if (forecastType && forecastType !== "quarter") {
        params.set("forecast_type", forecastType);
      }
      // Always fetch monthly_breakdown — the "Quarter Summary" view is a
      // pure frontend rollup (sums months into Q1/Q2/Q3/Q4 columns) so we
      // need the per-month values from the API regardless of viewType.
      if (forecastType === "rolling") {
        params.set("rolling_start_month", rollingStartMonth);
      }
      if (debouncedCustomer) {
        params.set("customer_name", debouncedCustomer);
      }
      if (pageSize > 0) {
        params.set("page", String(page));
        params.set("page_size", String(pageSize));
      }
      // Tells the backend which side is authoritative when a cell has an
      // explicit value in both Summary and Drivers — the selected mode
      // always wins, instead of whichever table was saved more recently.
      params.set("forecast_mode", forecastMode);

      const res = await fetch(`${API_BASE}/${year}/${currency}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = await res.json();

      /* Drop the response if a newer fetch has started in the meantime. */
      if (seq !== fetchSeqRef.current) return;

      setApiData(data);
      setTotalCount(Number(data?.pagination?.total_count ?? (data?.rows?.length || 0)));

      // Determine how many month columns this response carries (3 for
      // quarter, up to 12 for rolling/12months).
      const monthCount = Array.isArray(data?.selected_months) && data.selected_months.length
        ? data.selected_months.length
        : 3;

      const mappedRows = (data.rows || []).map((r) => {
        const prevRaw = pickField(r, ["previous_month", "s_month", "previousMonth", "prev_month"]);
        const qAiRaw  = pickField(r, ["quarter_total_ai", "quarter_ai", "qtr_total_ai"]);
        const qAdjRaw = pickField(r, ["quarter_total_adjusted", "quarter_adjusted", "qtr_total_adjusted"]);

        const mapped = {
          customer_name:              r.customer_name,
          previous_month_raw:         prevRaw,
          previous_month:             toBackendNumber(prevRaw),
          quarter_total_ai_raw:       qAiRaw,
          quarter_total_ai:           toBackendNumber(qAiRaw),
          quarter_total_adjusted_raw: qAdjRaw,
          quarter_total_adjusted:     toBackendNumber(qAdjRaw) ?? toBackendNumber(qAiRaw) ?? 0,
          overall_comment:            pickField(r, ["overall_comment", "overallComment"], ""),
        };

        for (let i = 1; i <= monthCount; i++) {
          const aiRaw  = pickMonthField(r, i, "ai");
          const adjRaw = pickMonthField(r, i, "adjusted");
          const aiNum  = toBackendNumber(aiRaw);
          mapped[`month${i}_ai_raw`]   = aiRaw;
          mapped[`month${i}_ai`]       = aiNum;
          mapped[`month${i}_adjusted`] = toBackendNumber(adjRaw) ?? aiNum ?? 0;
          mapped[`month${i}_comment`]  = pickMonthField(r, i, "comment", "");
        }
        return mapped;
      });
      setRows(mappedRows);

      const sc = {}, src = {};
      mappedRows.forEach((r) => {
        for (let m = 1; m <= monthCount; m++) {
          sc[`${r.customer_name}-month${m}`] = r[`month${m}_comment`] || "";
        }
        src[r.customer_name] = r.overall_comment || "";
      });
      setSummaryComments(sc); setSummaryRowComments(src);

      if (Array.isArray(data.drivers)) {
        const flat = [];
        data.drivers.forEach((d) => {
          (d.months || []).forEach((m) => flat.push({
            customer_name:            d.customer_name,
            month:                    m.month,
            units_ai:                 toBackendNumber(m.units_ai),
            units_adjusted:           toBackendNumber(m.units_adjusted)  ?? toBackendNumber(m.units_ai)   ?? 0,
            rate_ai:                  toBackendNumber(m.rate_ai),
            rate_adjusted:            toBackendNumber(m.rate_adjusted)   ?? toBackendNumber(m.rate_ai)    ?? 0,
            revenue_ai:               toBackendNumber(m.revenue_ai),
            revenue_adjusted:         toBackendNumber(m.revenue_adjusted) ?? toBackendNumber(m.revenue_ai) ?? 0,
            month_comment:            m.month_comment   || "",
            quarter_revenue_ai:       toBackendNumber(d.quarter_revenue_ai),
            quarter_revenue_adjusted: toBackendNumber(d.quarter_revenue_adjusted) ?? toBackendNumber(d.quarter_revenue_ai) ?? 0,
            overall_comment:          d.overall_comment || "",
          }));
        });
        setDrivers(flat);
        const dc = {};
        flat.forEach((f) => { dc[`${f.customer_name}-${f.month}`] = f.month_comment || ""; });
        setDriverComments(dc);
      }
      setStage(data.workflow_stage || "draft");
      setWorkflowMeta({ reviewed_by: data.reviewed_by, approved_by: data.approved_by, locked_by: data.locked_by });
      // Fresh server data — any previously-tracked dirty edits are now
      // either persisted (after a save+refetch) or about to be overwritten
      // (after a filter change). Either way the dirty sets must reset.
      dirtyCustomersRef.current.clear();
      dirtyDriverKeysRef.current.clear();
      setHasChanges(false); setDriverHasChanges(false);
    } catch (e) {
      if (e?.name === "AbortError") return;          // newer request aborted us
      if (seq !== fetchSeqRef.current) return;       // result is stale
      addToast(`Failed to load: ${e.message}`, "error");
    }
    finally {
      /* Only the latest fetch is allowed to clear the spinner; otherwise a
         stale resolution would hide the spinner while a fresher request is
         still in flight. */
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }, [year, currency, quarter, currencyFilter, token, forecastYear, forecastType, rollingStartMonth, viewType, debouncedCustomer, page, pageSize, forecastMode]);

  const fetchScenarios = useCallback(async () => {
    if (!token || !year) return;
    setScenariosLoading(true);
    try {
      const params = new URLSearchParams({ quarter });
      const res = await fetch(`${API_BASE}/${year}/scenarios?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = await res.json();
      setScenariosList(data.scenarios || []);
    } catch (e) { addToast(`Failed to load scenarios: ${e.message}`, "error"); }
    finally { setScenariosLoading(false); }
  }, [year, quarter, token]);

  const fetchComments = useCallback(async (customerName) => {
    try {
      const url = customerName
        ? `${API_BASE}/line-item-comments/${year}?quarter=${quarter}&customer_name=${encodeURIComponent(customerName)}`
        : `${API_BASE}/line-item-comments/${year}?quarter=${quarter}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } });
      if (!res.ok) return;
      const data = await res.json();
      setComments(Array.isArray(data) ? data : data.comments || []);
    } catch { /* silent */ }
  }, [year, quarter, token]);

  // FIX: Only fetch data on mount — do NOT fetch comments eagerly.
  // Depend on the primitive filter values, NOT the fetchData reference,
  // so React's "function identity changed" doesn't trigger phantom fetches.
  useEffect(() => { fetchData(); }, [
    year, currency, quarter, currencyFilter, token,
    forecastYear, forecastType, rollingStartMonth, viewType, debouncedCustomer,
    page, pageSize, forecastMode,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // When a filter changes, jump back to page 1. Filter-change-while-paginated
  // would otherwise silently show stale page numbers.
  useEffect(() => { setPage(1); }, [
    forecastYear, forecastType, rollingStartMonth, viewType, quarter, debouncedCustomer,
  ]);
  // FIX: Comments only fetched when scenarios tab or comments tab active
  useEffect(() => { if (activeTab === "scenarios") fetchScenarios(); }, [activeTab, fetchScenarios]);

  // ── Save helpers ──────────────────────────────────────────────────────────
  const _doSave = async () => {
    if (!canEdit) return;

    // Only PATCH the customers the user actually touched. If nothing is
    // dirty (e.g. user pressed Save without changes), bail early.
    const dirty = dirtyCustomersRef.current;
    if (dirty.size === 0) { setHasChanges(false); return; }

    setSaving(true);
    try {
      const payload = rows
        .filter((r) => dirty.has(r.customer_name))
        .map((r) => {
          // toBackendNumber(...) ?? 0, not `|| 0`: an adjusted cell can be a
          // raw, not-yet-fully-typed string (e.g. "13.") while being edited,
          // and `|| 0` would send that string straight to the backend
          // instead of converting it to a number.
          const m1 = toBackendNumber(r.month1_adjusted) ?? 0;
          const m2 = toBackendNumber(r.month2_adjusted) ?? 0;
          const m3 = toBackendNumber(r.month3_adjusted) ?? 0;
          return {
            customer_name:          r.customer_name,
            month1_adjusted:        m1,
            month1_comment:         summaryComments[`${r.customer_name}-month1`] || "",
            month2_adjusted:        m2,
            month2_comment:         summaryComments[`${r.customer_name}-month2`] || "",
            month3_adjusted:        m3,
            month3_comment:         summaryComments[`${r.customer_name}-month3`] || "",
            quarter_total_adjusted: m1 + m2 + m3,
            overall_comment:        summaryRowComments[r.customer_name] || "",
          };
        });

      // Batch in 100s and fire in parallel — the backend bulk-upserts each
      // batch in one round-trip, so concurrent batches don't dogpile.
      const BATCH = 100;
      const batches = [];
      for (let i = 0; i < payload.length; i += BATCH) batches.push(payload.slice(i, i + BATCH));
      const responses = await Promise.all(batches.map((b) =>
        fetch(`${API_BASE}/adjustments/${year}?quarter=${quarter}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", accept: "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(b),
        })
      ));
      for (const res of responses) {
        if (!res.ok) throw new Error(await parseApiError(res));
      }

      dirtyCustomersRef.current.clear();
      setHasChanges(false);
      addToast(`Saved ${payload.length} customer${payload.length === 1 ? "" : "s"} ✓`, "success");
    } catch (e) { setCenterError(e.message); throw e; }
    finally { setSaving(false); }
  };

  const _doSaveDrivers = async () => {
    if (!canEdit) return;

    const dirtyKeys = dirtyDriverKeysRef.current;
    if (dirtyKeys.size === 0) { setDriverHasChanges(false); return; }

    setDriverSaving(true);
    try {
      const byCustomer = {};
      drivers.forEach((d) => {
        if (!byCustomer[d.customer_name]) byCustomer[d.customer_name] = { qAdj: 0, overallComment: d.overall_comment || "" };
        // toCalcNumber, not `|| 0`: revenue_adjusted may still be a raw
        // string ("" or "5000") if the user is mid-edit, and `0 + "5000"`
        // is string concatenation ("05000"), not addition.
        byCustomer[d.customer_name].qAdj += toCalcNumber(d.revenue_adjusted);
      });
      const payload = drivers
        .filter((d) => dirtyKeys.has(`${d.customer_name}|${d.month}`))
        .map((d) => ({
          customer_name:            d.customer_name,
          month:                    d.month,
          // toBackendNumber(...) ?? 0, not `?? 0` alone, because an emptied
          // field is stored as "" (not null/undefined) while editing — `??`
          // wouldn't catch that and would send "" to the backend.
          units_adjusted:           toBackendNumber(d.units_adjusted)    ?? 0,
          rate_adjusted:            toBackendNumber(d.rate_adjusted)     ?? 0,
          revenue_adjusted:         toBackendNumber(d.revenue_adjusted)  ?? 0,
          month_comment:            driverComments[`${d.customer_name}-${d.month}`] || "",
          quarter_revenue_adjusted: byCustomer[d.customer_name]?.qAdj || 0,
          overall_comment:          byCustomer[d.customer_name]?.overallComment || "",
        }));
      const res = await fetch(`${API_BASE}/driver-adjustments/${year}?quarter=${quarter}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      dirtyDriverKeysRef.current.clear();
      setDriverHasChanges(false);
      addToast(`Saved ${payload.length} driver row${payload.length === 1 ? "" : "s"} ✓`, "success");
    } catch (e) { setCenterError(e.message); throw e; }
    finally { setDriverSaving(false); }
  };

  /* Cross-sync (handleAdjChange / handleDriverChange) marks both dirty sets
     whenever a change in one mode implies a change in the other, so saving
     from either tab must persist both to keep the two tables consistent
     server-side.

     After a successful save we re-fetch from the backend rather than just
     clearing the local dirty flags: fetchData() rebuilds rows/drivers from
     the server response (which already merges Summary+Drivers per the
     read-side precedence logic) and resets hasChanges/driverHasChanges/
     dirty refs itself. That's what keeps the grid showing the persisted
     values and stops the unsaved-changes prompt from firing on the next
     tab switch — skipping the refetch was the bug: the dirty refs/flags
     were cleared, but the grid kept showing pre-save local state forever. */
  // Whichever side the user explicitly saves from is patched LAST, since the
  // backend now lets the row with the more recent updated_at win when both
  // tables hold an explicit value for the same month — not just forecast_mode.
  // Saving the active tab last guarantees it's the one the next GET shows.
  // setSaving/setDriverSaving up front — not left to _doSave/_doSaveDrivers
  // alone — because the cross-sync (handleAdjChange/handleDriverChange) can
  // mark the *other* tab's hasChanges too, so the visible Save bar's own
  // save may run second, behind an invisible save on the other tab. Without
  // this, the spinner wouldn't appear until that hidden save finished,
  // making the UI look unresponsive right after the click.
  const handleSave = async () => {
    setSaving(true);
    try {
      if (driverHasChanges) await _doSaveDrivers();
      await _doSave();
      await fetchData();
    } catch { /* shown via toast/centerError */ }
    finally { setSaving(false); }
  };
  const handleSaveDrivers = async () => {
    setDriverSaving(true);
    try {
      if (hasChanges) await _doSave();
      await _doSaveDrivers();
      await fetchData();
    } catch { /* shown via toast/centerError */ }
    finally { setDriverSaving(false); }
  };

  const handleWorkflow = async (target, comment) => {
    setWorkflowLoading(true);
    try {
      const res = await fetch(`${API_BASE}/workflow/${year}?quarter=${quarter}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ target_stage: target, comment }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      setStage(target); setModal({ open: false, target: null });
      addToast(`Stage → ${STAGE_LABELS[target]} ✓`, "success"); fetchData();
    } catch (e) { addToast(`Workflow failed: ${e.message}`, "error"); }
    finally { setWorkflowLoading(false); }
  };

  const handleCreateScenario = async (form) => {
    setScenarioSaving(true);
    try {
      const res = await fetch(`${API_BASE}/${year}/scenarios?quarter=${quarter}`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
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
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
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

  const handleRawImport = async (file) => {
    if (!file) return;
    if (!validateFileName(file.name)) {
      const msg = "Invalid file name. Use: customers, chart_of_accounts, or general_ledger_transactions (optionally with mm-yyyy)";
      addToast(msg, "error"); setImportError(msg); return;
    }
    setImporting(true); setImportError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/import/${year}?quarter=${quarter}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      addToast("Import completed ✓", "success"); fetchData();
    } catch (e) { setImportError(e.message); addToast(`Import failed: ${e.message}`, "error"); }
    finally { setImporting(false); if (rawImportRef.current) rawImportRef.current.value = ""; }
  };

  const downloadSample = (type) => {
    const map = { customers: [customersSampleUrl,"customers.csv"], coa: [chartOfAccountsSampleUrl,"chart_of_accounts.csv"], gl: [glTransactionsSampleUrl,"general_ledger_transactions.csv"] };
    const [url, name] = map[type] || [];
    if (!url) return;
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  };

  /* Summary edit → Drivers sync. Editing an "Adjusted" revenue cell in
     Summary Based mode keeps the rate the user (or AI) already had for that
     customer/month and backs out the implied units, so the Drivers Based
     view always reflects the same revenue figure. */
  const handleAdjChange = (idx, field, val) => {
    // Store exactly what the user typed — "", "13", "13.", "13.5" — instead
    // of parsing it on every keystroke. The old `parseFloat(val) || 0`
    // collapsed both "" and any not-yet-finished number (e.g. mid-typing a
    // decimal) to 0 immediately, which then re-rendered straight back into
    // the input, making the field impossible to clear or use right. Numeric
    // coercion now only happens where a real number is actually required:
    // the cross-tab sync math below, and at save time (see _doSave, which
    // runs every adjusted value through toBackendNumber(...) ?? 0).
    let customerName = null;
    setRows((prev) => {
      const n = [...prev];
      n[idx] = { ...n[idx], [field]: val };
      customerName = n[idx].customer_name;
      dirtyCustomersRef.current.add(customerName);
      return n;
    });
    setHasChanges(true);

    const monthMatch = /^month(\d+)_adjusted$/.exec(field);
    if (monthMatch && customerName) {
      const monthLabel = monthPeriods[Number(monthMatch[1]) - 1];
      if (monthLabel) {
        // Cross-sync math always needs a real number, even mid-edit (e.g. an
        // empty or partial value contributes 0 until the user finishes typing).
        const syncVal = toCalcNumber(val);
        setDrivers((prev) => {
          const dIdx = prev.findIndex((d) => d.customer_name === customerName && d.month === monthLabel);
          if (dIdx === -1) return prev;
          const u = [...prev];
          const rate = toCalcNumber(u[dIdx].rate_adjusted) || toCalcNumber(u[dIdx].rate_ai) || 1000;
          u[dIdx] = {
            ...u[dIdx],
            rate_adjusted: rate,
            units_adjusted: rate ? syncVal / rate : 0,
            revenue_adjusted: syncVal,
          };
          dirtyDriverKeysRef.current.add(`${customerName}|${monthLabel}`);
          return u;
        });
        setDriverHasChanges(true);
      }
    }
  };

  /* onBlur for a Summary "Adjusted" month input — this is the "navigate to
     another row or column" moment. If the value actually changed since the
     cell was focused, offer to propagate it to all 12 months for this
     customer instead of leaving it scoped to just the one month edited. */
  const handleAdjBlur = (idx, m) => {
    const cellKey = `summary-${idx}-month${m}`;
    setFocusedCellKey(null);
    const startVal = focusValuesRef.current[cellKey];
    delete focusValuesRef.current[cellKey];
    if (!canEdit) return;
    const row = rows[idx];
    if (!row) return;
    const curNum = toBackendNumber(row[`month${m}_adjusted`]);
    if (curNum == null || toBackendNumber(startVal) === curNum) return;
    setApplyAllMonthsModal({ open: true, idx, field: `month${m}_adjusted`, value: curNum, customerName: row.customer_name });
  };

  const closeApplyAllMonthsModal = () =>
    setApplyAllMonthsModal({ open: false, idx: null, field: null, value: null, customerName: null });

  /* "Yes, apply to all 12 months" — write the value into every currently
     visible month column locally (instant feedback + Drivers cross-sync via
     handleAdjChange) and persist it across all 4 quarters for this customer
     on the backend, since revenue_forecast_adjustments stores each quarter
     as its own row (month1..month3) rather than one row per year. */
  const applyAdjustedToAllMonths = async () => {
    const { idx, value, customerName } = applyAllMonthsModal;
    if (idx == null || customerName == null) { closeApplyAllMonthsModal(); return; }
    setApplyingAllMonths(true);
    try {
      months.forEach((_, mi) => handleAdjChange(idx, `month${mi + 1}_adjusted`, value));

      const res = await fetch(`${API_BASE}/adjustments/${year}/apply-all-months`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ customer_name: customerName, value }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = await res.json();

      // Already fully persisted for all 4 quarters — this customer no
      // longer needs a separate Save for the months just synced above.
      dirtyCustomersRef.current.delete(customerName);
      setHasChanges(dirtyCustomersRef.current.size > 0);
      monthPeriods.forEach((monthLabel) => dirtyDriverKeysRef.current.delete(`${customerName}|${monthLabel}`));
      setDriverHasChanges(dirtyDriverKeysRef.current.size > 0);

      const skipped = data?.skipped_quarters || [];
      addToast(
        skipped.length
          ? `Applied to all 12 months for ${customerName} — ${skipped.join(", ")} skipped (not in draft) ✓`
          : `Applied to all 12 months for ${customerName} ✓`,
        "success"
      );
    } catch (e) {
      addToast(`Failed to apply to all 12 months: ${e.message}`, "error");
    } finally {
      setApplyingAllMonths(false);
      closeApplyAllMonthsModal();
    }
  };

  /* Drivers edit → Summary sync. Whichever of units/rate/revenue the user
     just typed, revenue_adjusted is recomputed as units*rate (matching how
     the backend persists it) and that figure is pushed into the matching
     Summary "Adjusted" cell for the same customer/month. */
  const handleDriverChange = (index, field, value) => {
    let updated = null;
    setDrivers((prev) => {
      const u = [...prev];
      // Store the raw typed value ("", "13", "13.5", ...) rather than
      // `parseFloat(value)`, which rounds off a not-yet-finished decimal
      // (e.g. "13." -> 13) and turns "" into NaN, both of which fought the
      // user's typing once re-rendered. toCalcNumber below parses leniently
      // for the derived units/revenue math, which always needs a real number.
      u[index] = { ...u[index], [field]: value };

      if (field === "revenue_adjusted") {
        const rate = toCalcNumber(u[index].rate_adjusted);
        u[index].units_adjusted = rate ? toCalcNumber(value) / rate : 0;
      } else {
        u[index].revenue_adjusted = toCalcNumber(u[index].units_adjusted) * toCalcNumber(u[index].rate_adjusted);
      }

      dirtyDriverKeysRef.current.add(`${u[index].customer_name}|${u[index].month}`);
      updated = u[index];
      return u;
    });
    setDriverHasChanges(true);

    if (updated) {
      const { customer_name, month, revenue_adjusted } = updated;
      const monthIdx = monthPeriods.indexOf(month);
      if (monthIdx !== -1) {
        setRows((prev) => {
          const rIdx = prev.findIndex((r) => r.customer_name === customer_name);
          if (rIdx === -1) return prev;
          const n = [...prev];
          n[rIdx] = { ...n[rIdx], [`month${monthIdx + 1}_adjusted`]: toCalcNumber(revenue_adjusted) };
          return n;
        });
        dirtyCustomersRef.current.add(customer_name);
        setHasChanges(true);
      }
    }
  };

  const handleTabChange     = (id)  => guardedAction(() => setActiveTab(id));
  const handleQuarterChange = (q)   => guardedAction(() => setQuarter(q));
  const handleCurrencyFilterChange = (v) => guardedAction(() => setCurrencyFilter(v));
  const handleRefresh       = ()    => guardedAction(fetchData);

  /* Hard refresh: trigger backend precompute (rebuilds Prophet/ML, invalidates
     cache) and then re-fetch the page. Use only when underlying GL data
     changed and the user explicitly wants fresh numbers. */
  const handleHardRefresh = () => guardedAction(async () => {
    try {
      const fy = forecastYear;
      const res = await fetch(`${API_BASE}/${fy}/precompute`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      addToast("Forecast refresh queued — recalculating in background", "success");
      // Give the backend a beat to start the job before re-fetching.
      setTimeout(fetchData, 1500);
    } catch (e) {
      addToast(`Refresh failed: ${e.message}`, "error");
    }
  });

  const handleForecastTypeChange       = (v) => guardedAction(() => setForecastType(v));
  const handleViewTypeChange           = (v) => guardedAction(() => setViewType(v));
  const handleForecastModeChange       = (v) => guardedAction(() => {
    setForecastMode(v);
    setActiveTab(v === "drivers" ? "drivers" : "summary");
  });

  // Totals — keyed by month index so this works for both 3-month (quarter)
  // and 12-month (rolling / 12months) views without special-casing.
  // Quarter Summary is a frontend-only rollup so we still have monthly data.
  const totals = (() => {
    const t = { prev: 0, ai: [], usr: [] };
    for (let i = 0; i < months.length; i++) { t.ai[i] = 0; t.usr[i] = 0; }
    rows.forEach((r) => {
      t.prev += toCalcNumber(r.previous_month);
      for (let i = 0; i < months.length; i++) {
        t.ai[i]  += toCalcNumber(r[`month${i + 1}_ai`]);
        t.usr[i] += toCalcNumber(r[`month${i + 1}_adjusted`]);
      }
    });
    t.aiTotal  = t.ai.reduce((a, b) => a + b, 0);
    t.usrTotal = t.usr.reduce((a, b) => a + b, 0);
    return t;
  })();
  const variance = totals.usrTotal - totals.aiTotal;
  const varPct   = totals.aiTotal ? ((variance/totals.aiTotal)*100).toFixed(getDecimalPrecision()) : "0.0";

  const forecastSummary        = apiData?.Baseline_forecast_summary || {};
  const summaryVarianceAmount  = forecastSummary.variance_amount ?? variance;
  const summaryVariancePercent = forecastSummary.variance_percent != null ? Number(forecastSummary.variance_percent) : Number(varPct);

  const filteredRows    = rows.filter((r) => r.customer_name.toLowerCase().includes(filterText.toLowerCase()));
  const driverCustomers = [...new Set(drivers.map((d) => d.customer_name))];

  // Month theme
  const monthTheme = [
    { border: "border-slate-200", bg: "bg-slate-50/60",  hbg: "bg-slate-100",  label: "text-sky-700" },
    { border: "border-blue-200",  bg: "bg-blue-50/30",   hbg: "bg-blue-50",    label: "text-blue-700"  },
    { border: "border-indigo-200",bg: "bg-indigo-50/20", hbg: "bg-indigo-50",  label: "text-indigo-700"},
  ];

  // Scenario card styles
  const scenarioStyles = {
    baseline:   { icon: "◎", accent: "bg-blue-600",    badge: "bg-blue-50 text-blue-700 border-blue-200",    top: "bg-blue-600"    },
    best_case:  { icon: "🚀", accent: "bg-emerald-600", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", top: "bg-emerald-500" },
    worst_case: { icon: "⚠️", accent: "bg-red-600",    badge: "bg-red-50 text-red-700 border-red-200",      top: "bg-red-500"     },
  };
  const getScStyle = (sc) => scenarioStyles[sc.scenario_name] || { icon: "📊", accent: "bg-sky-700", badge: "bg-slate-100 text-sky-700 border-slate-200", top: "bg-slate-600" };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    // FIX: pageRef on the outermost div; overflow-y-auto so scrollTop works
    <div ref={pageRef} className="planning-compact forecasting-pnl-theme revenue-forecast-page min-h-screen bg-sky-50 font-sans text-sky-900">

      <ToastContainer toasts={toasts}/>
      <CenterErrorModal error={centerError} onClose={() => setCenterError(null)}/>
      <WorkflowModal open={modal.open} target={modal.target}
        onClose={() => setModal({ open:false, target:null })} onConfirm={handleWorkflow} loading={workflowLoading}/>
      <ScenarioModal open={scenarioModal.open} editScenario={scenarioModal.edit}
        onClose={() => setScenarioModal({ open:false, edit:null })}
        onSave={scenarioModal.edit ? handleUpdateScenario : handleCreateScenario} loading={scenarioSaving}/>
      <DeleteConfirmModal open={deleteModal.open} scenarioName={deleteModal.scenario?.scenario_name}
        onClose={() => setDeleteModal({ open:false, scenario:null })}
        onConfirm={handleDeleteScenario} loading={deleteLoading}/>
      <UnsavedChangesModal open={showUnsavedModal} saving={guardSaving}
        onSave={handleGuardSave} onDiscard={handleGuardDiscard} onCancel={() => { setShowUnsavedModal(false); setPendingAction(null); }}/>
      <ApplyAllMonthsModal open={applyAllMonthsModal.open} customerName={applyAllMonthsModal.customerName}
        value={applyAllMonthsModal.value} applying={applyingAllMonths}
        onYes={applyAdjustedToAllMonths} onNo={closeApplyAllMonthsModal}/>

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <header className="forecasting-page-header bg-gradient-to-r from-sky-950 via-sky-900 to-sky-700 rounded-xl px-4 py-2.5 md:px-6 sticky -top-5 z-40 shadow-sm">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-bold text-white">Revenue Forecast</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Year/Quarter breadcrumb + Quarter dropdown removed — same
                controls already live in the filter bar below. Keep the
                currency-unit dropdown here since the filter bar doesn't
                have a Thousands/Millions toggle yet. */}
            <select value={currencyFilter} onChange={(e) => handleCurrencyFilterChange(e.target.value)}
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
              title="Choose which view drives input. Summary and Drivers values stay in sync regardless of mode."
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

        <KpiCards forecastSummary={forecastSummary} months={months} variance={variance} varPct={varPct}
          summaryVarianceAmount={summaryVarianceAmount} summaryVariancePercent={summaryVariancePercent}/>
        <WorkflowProgress stage={stage} workflowMeta={workflowMeta} onAction={(t) => setModal({ open:true, target:t })}/>

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
            <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12}/>
                  <input value={filterText} onChange={(e) => setFilterText(e.target.value)}
                    placeholder="Search customer…"
                    className="pl-7 pr-3 py-1 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-2 ring-blue-100 transition-all w-48 shadow-sm"/>
                </div>
                {filterText && (
                  <button onClick={() => setFilterText("")}
                    className="flex items-center gap-1 text-x text-slate-500 hover:text-sky-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors">
                    <FiX size={12}/> Clear
                  </button>
                )}
                <span className="text-x text-slate-500 bg-white px-2.5 py-1 rounded-lg tabular-nums border border-slate-200">
                  {filteredRows.length}/{rows.length}
                  {totalCount > rows.length && (
                    <span className="text-slate-400"> of {totalCount}</span>
                  )}
                </span>
              </div>
              {!canEdit && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-x font-semibold">
                  <FiAlertCircle size={12}/> Editing disabled — {STAGE_LABELS[stage]}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
              {loading ? <TableSkeleton columns={5} rows={8} /> : viewType === "quarter_summary" ? (
                /* ── QUARTER SUMMARY ──
                   Sums monthly_breakdown data into Q1/Q2/Q3/Q4 columns
                   (AI + Adjusted per quarter). Works whether the underlying
                   forecast is 12 months, a single quarter (1 column), or
                   rolling (typically 1 column spanning the rolling window). */
                <div className="analytics-table-scroll relative overflow-x-auto max-h-[72vh] overflow-y-auto">
                  <table className="relative w-full min-w-[900px] border-collapse text-sm">
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-sky-800 border-b border-sky-700">
                        <th rowSpan={2} className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700 sticky left-0 bg-sky-800 z-30 min-w-[180px]">Customer</th>
                        <th rowSpan={2} className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide min-w-[100px]">Prev Month</th>
                        {quarterGroups.map((qg) => (
                          <th key={qg.key} colSpan={2} className="px-3 py-1.5 text-center text-xs font-semibold border-l text-white border-sky-700 bg-sky-800">
                            {qg.label}
                          </th>
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
                      {filteredRows.length === 0
                        ? <tr><td colSpan={4 + quarterGroups.length * 2}><EmptyState label="No customers match your search."/></td></tr>
                        : filteredRows.map((row, idx) => {
                            const isEven = idx % 2 === 0;
                            const avCls  = avatarClass(row.customer_name);
                            // Aggregate this row's monthly values by quarter group.
                            const quarterCells = quarterGroups.map((qg) => {
                              const ai  = qg.monthIdxs.reduce((s, mi) => s + toCalcNumber(row[`month${mi+1}_ai`]), 0);
                              const adj = qg.monthIdxs.reduce((s, mi) => s + toCalcNumber(row[`month${mi+1}_adjusted`]), 0);
                              return { key: qg.key, ai, adj };
                            });
                            const periodAi  = quarterCells.reduce((s, q) => s + q.ai, 0);
                            const periodAdj = quarterCells.reduce((s, q) => s + q.adj, 0);
                            const changed = periodAdj !== periodAi;
                            const rowBg = isEven ? "bg-white" : "bg-slate-50/60";
                            return (
                              <tr key={row.customer_name} className={`rf-row border-b border-slate-100 transition-colors hover:bg-sky-50/50 ${rowBg}`}>
                                <td className={`px-3 py-1 sticky left-0 border-r border-slate-200 z-[5] ${rowBg}`}>
                                  <div className="flex items-center gap-1.5">
                                    <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${avCls}`}>{getInitials(row.customer_name)}</div>
                                    <span className="font-semibold text-slate-900 text-xs leading-tight truncate" title={row.customer_name}>{row.customer_name}</span>
                                    {changed && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" title="Has adjustments"/>}
                                  </div>
                                </td>
                                <td className="px-3 py-1 text-right tabular-nums text-xs text-slate-500">{fmt(row.previous_month_raw ?? row.previous_month)}</td>
                                {quarterCells.map((qc, qi) => (
                                  <React.Fragment key={qc.key}>
                                    <td className={`px-2 py-1 text-right text-xs text-slate-500 tabular-nums border-l border-slate-100 ${monthTheme[qi % monthTheme.length].bg}`}>{fmt(qc.ai)}</td>
                                    <td className={`px-2 py-1 text-right text-xs tabular-nums ${monthTheme[qi % monthTheme.length].bg} ${qc.adj>qc.ai?"text-emerald-600 font-bold":qc.adj<qc.ai?"text-red-500 font-bold":"text-slate-700"}`}>{fmt(qc.adj)}</td>
                                  </React.Fragment>
                                ))}
                                <td className="px-2 py-1 text-right text-xs text-slate-500 tabular-nums border-l border-slate-200 bg-slate-50/60">{fmt(periodAi)}</td>
                                <td className={`px-2 py-1 text-right text-xs font-bold tabular-nums ${periodAdj>periodAi?"text-emerald-600":periodAdj<periodAi?"text-red-500":"text-sky-700"}`}>{fmt(periodAdj)}</td>
                                <td className="px-1 py-1 text-center border-l border-slate-100">
                                  <InlineCommentIcon
                                    commentKey={`overall-${row.customer_name}`}
                                    value={summaryRowComments[row.customer_name]}
                                    disabled={!canEdit}
                                    onChange={(v) => { setSummaryRowComments((p) => ({...p,[row.customer_name]:v})); dirtyCustomersRef.current.add(row.customer_name); setHasChanges(true); }}
                                    label={`${row.customer_name} — Overall Note`}
                                    isOverall
                                  />
                                </td>
                              </tr>
                            );
                          })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-sky-900 text-white sticky bottom-0 z-10 font-semibold">
                        <td className="px-3 py-1.5 text-xs sticky left-0 bg-sky-900 border-r border-sky-700 z-[9]">GRAND TOTAL</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-xs text-white">{fmt(totals.prev)}</td>
                        {quarterGroups.map((qg, qi) => {
                          const qAi  = qg.monthIdxs.reduce((s, mi) => s + (totals.ai[mi]  || 0), 0);
                          const qAdj = qg.monthIdxs.reduce((s, mi) => s + (totals.usr[mi] || 0), 0);
                          return (
                            <React.Fragment key={qg.key}>
                              <td className="px-2 py-1.5 text-right tabular-nums text-xs text-white border-l border-sky-700 bg-sky-800">{fmt(qAi)}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums text-xs font-bold bg-sky-800">{fmt(qAdj)}</td>
                            </React.Fragment>
                          );
                        })}
                        <td className="px-2 py-1.5 text-right tabular-nums text-xs text-white border-l border-sky-700">{fmt(totals.aiTotal)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-xs font-bold">{fmt(totals.usrTotal)}</td>
                        <td className="px-2 py-1.5 border-l border-sky-700">
                          <span className={`text-xs font-bold tabular-nums ${variance>=0?"text-emerald-400":"text-red-400"}`}>
                            {variance>=0?"+":""}{fmt(variance)} ({varPct}%)
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="analytics-table-scroll relative overflow-x-auto max-h-[72vh] overflow-y-auto">
                  <table className="relative w-full min-w-[1300px] border-collapse text-sm">
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-sky-800 border-b border-sky-700">
                        <th rowSpan={2} className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700 sticky left-0 bg-sky-800 z-30 min-w-[170px]">Customer</th>
                        <th rowSpan={2} className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide min-w-[90px]">Prev Month</th>
                        {months.map((m, mi) => (
                          <th key={m} colSpan={3} className={`px-3 py-1.5 text-center text-xs font-semibold border-l text-white border-sky-700 bg-sky-800`}>{m}</th>
                        ))}
                        <th colSpan={2} className="px-3 py-1.5 text-center text-xs font-semibold text-slate-50 border-l border-sky-700 bg-sky-900">
                          {forecastType === "quarter" ? "Quarter Total" : "Period Total"}
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
                      {filteredRows.length === 0
                        ? <tr><td colSpan={99}><EmptyState label="No customers match your search."/></td></tr>
                        : filteredRows.map((row, idx) => {
                            const origIdx = rows.findIndex((r) => r.customer_name === row.customer_name);
                            const isEven  = idx % 2 === 0;
                            const avCls   = avatarClass(row.customer_name);
                            // Sum across however many months this view has (3 or 12). Use
                            // toCalcNumber, not raw `+`/`|| 0` — a month's `*_adjusted` field
                            // can hold a raw not-yet-finished typed string (e.g. "13.") while
                            // that cell is focused, and `0 + "13."` is string concatenation,
                            // not addition, which silently corrupted this total mid-edit.
                            const qAi  = months.reduce((s, _, i) => s + toCalcNumber(row[`month${i+1}_ai`]), 0);
                            const qAdj = months.reduce((s, _, i) => s + toCalcNumber(row[`month${i+1}_adjusted`]), 0);
                            const changed = qAdj !== qAi;
                            const qAiDisplay = row.quarter_total_ai_raw != null && row.quarter_total_ai_raw !== ""
                              ? fmt(row.quarter_total_ai_raw)
                              : fmt(qAi);
                            // Adjusted quarter total is always the live sum of the (possibly
                            // just-edited) monthly Adjusted cells — never the server's stale
                            // `quarter_total_adjusted_raw`, which only reflects what was true
                            // as of the last fetch/save and doesn't move as the user types.
                            const qAdjDisplay = fmt(qAdj);
                            const rowBg = isEven ? "bg-white" : "bg-slate-50/60";
                            return (
                              <tr key={row.customer_name} className={`rf-row border-b border-slate-100 transition-colors hover:bg-sky-50/50 ${rowBg}`}>
                                <td className={`px-3 py-1 sticky left-0 border-r border-slate-200 z-[5] ${rowBg}`}>
                                  <div className="flex items-center gap-1.5">
                                    <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${avCls}`}>{getInitials(row.customer_name)}</div>
                                    <span className="font-semibold text-slate-900 text-xs leading-tight truncate" title={row.customer_name}>{row.customer_name}</span>
                                    {changed && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" title="Has adjustments"/>}
                                  </div>
                                </td>
                                <td className="px-3 py-1 text-right tabular-nums text-xs text-slate-500">{fmt(row.previous_month_raw ?? row.previous_month)}</td>

                                {/* ── Per-month columns: iterates over `months` so the same
                                       JSX renders 3 (quarter) or 12 (rolling/12months). ── */}
                                {months.map((_, mi) => {
                                  const m   = mi + 1;
                                  const ai  = row[`month${m}_ai`];
                                  const adj = row[`month${m}_adjusted`];
                                  const cellChanged = adj !== ai && ai != null;
                                  const ck  = `${row.customer_name}-month${m}`;
                                  const th  = monthTheme[mi % monthTheme.length];
                                  // While this cell is focused, show the raw value (including ""
                                  // or a partially-typed "13.") so toFixed() rounding never fights
                                  // the user's keystrokes; once blurred, show the rounded value.
                                  const cellKey = `summary-${origIdx}-month${m}`;
                                  const displayAdj = displayEditableNumber(adj, focusedCellKey === cellKey);
                                  return (
                                    <React.Fragment key={m}>
                                      <td className={`px-2 py-1 text-right text-xs text-slate-500 tabular-nums border-l border-slate-100 ${th.bg}`}>{fmt(row[`month${m}_ai_raw`] ?? ai)}</td>
                                      <td className={`px-1.5 py-1 ${th.bg}`}>
                                        <input type="number" value={displayAdj} step={Math.pow(10, -getDecimalPrecision())} disabled={!canEdit}
                                          onFocus={(e) => { setFocusedCellKey(cellKey); focusValuesRef.current[cellKey] = adj; e.target.select(); }}
                                          onBlur={() => handleAdjBlur(origIdx, m)}
                                          onChange={(e) => handleAdjChange(origIdx, `month${m}_adjusted`, e.target.value)}
                                          className={`w-full px-1.5 py-0.5 rounded-md border text-right text-xs tabular-nums outline-none transition-all
                                            ${!canEdit?"bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200"
                                              :cellChanged?"border-blue-400 bg-blue-50 text-blue-900 focus:ring-2 ring-blue-100"
                                              :"border-slate-300 bg-white hover:border-slate-400 focus:border-blue-500 focus:ring-2 ring-blue-100"}`}/>
                                      </td>
                                      <td className={`px-1 py-1 relative text-center ${th.bg}`}>
                                        <InlineCommentIcon
                                          commentKey={ck}
                                          value={summaryComments[ck]}
                                          disabled={!canEdit}
                                          onChange={(v) => { setSummaryComments((p) => ({...p,[ck]:v})); dirtyCustomersRef.current.add(row.customer_name); setHasChanges(true); }}
                                          label={`${row.customer_name} — ${months[mi]}`}
                                          className="-z-50 rela"
                                        />
                                      </td>
                                    </React.Fragment>
                                  );
                                })}

                                <td className="px-2 py-1 text-right text-xs text-slate-500 tabular-nums border-l border-slate-200 bg-slate-50/60">{qAiDisplay}</td>
                                <td className={`px-2 py-1 text-right text-xs font-bold tabular-nums ${qAdj>qAi?"text-emerald-600":qAdj<qAi?"text-red-500":"text-sky-700"}`}>{qAdjDisplay}</td>

                                <td className="px-1 py-1 text-center border-l border-slate-100">
                                  <InlineCommentIcon
                                    commentKey={`overall-${row.customer_name}`}
                                    value={summaryRowComments[row.customer_name]}
                                    disabled={!canEdit}
                                    onChange={(v) => { setSummaryRowComments((p) => ({...p,[row.customer_name]:v})); dirtyCustomersRef.current.add(row.customer_name); setHasChanges(true); }}
                                    label={`${row.customer_name} — Overall Note`}
                                    isOverall
                                  />
                                </td>
                              </tr>
                            );
                          })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-sky-900 text-white sticky bottom-0 z-10 font-semibold">
                        <td className="px-3 py-1.5 text-xs sticky left-0 bg-sky-900 border-r border-sky-700 z-[9]">GRAND TOTAL</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-xs text-white">{fmt(totals.prev)}</td>
                        {months.map((_, i) => (
                          <React.Fragment key={i}>
                            <td className="px-2 py-1.5 text-right tabular-nums text-xs text-white border-l border-sky-700 bg-sky-800">{fmt(totals.ai[i] || 0)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-xs font-bold bg-sky-800">{fmt(totals.usr[i] || 0)}</td>
                            <td className="px-1 py-1.5 bg-sky-800"></td>
                          </React.Fragment>
                        ))}
                        <td className="px-2 py-1.5 text-right tabular-nums text-xs text-white border-l border-sky-700">{fmt(totals.aiTotal)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-xs font-bold">{fmt(totals.usrTotal)}</td>
                        <td className="px-2 py-1.5 border-l border-sky-700">
                          <span className={`text-xs font-bold tabular-nums ${variance>=0?"text-emerald-400":"text-red-400"}`}>
                            {variance>=0?"+":""}{fmt(variance)} ({varPct}%)
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
            {/* ── Pagination bar (server-side) ──────────────────────────── */}
            {totalCount > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-x text-slate-600">
                <div className="flex items-center gap-2">
                  <span>Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                    className="px-2 py-1 rounded-lg border border-slate-300 bg-white font-medium outline-none focus:ring-2 ring-blue-100"
                  >
                    {[50, 100, 200, 500].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <span className="text-slate-500">
                    {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(1)} disabled={page <= 1}
                    className="px-2 py-1 rounded-lg border border-slate-300 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                  >« First</button>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                    className="px-2 py-1 rounded-lg border border-slate-300 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                  >‹ Prev</button>
                  <span className="px-3 py-1 tabular-nums text-slate-700">
                    Page {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                    className="px-2 py-1 rounded-lg border border-slate-300 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                  >Next ›</button>
                  <button
                    onClick={() => setPage(totalPages)} disabled={page >= totalPages}
                    className="px-2 py-1 rounded-lg border border-slate-300 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                  >Last »</button>
                </div>
              </div>
            )}

            <SaveBar hasChanges={hasChanges} saving={saving} onSave={handleSave} disabled={!canEdit}/>
          </div>
        )}

        {/* ══ DRIVERS TAB ════════════════════════════════════════════ */}
        {activeTab === "drivers" && (
          <div>
            {loading ? <Spinner label="Loading drivers…"/> : driverCustomers.length === 0
              ? <EmptyState label="No driver data available for this period."/>
              : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
                  <div className="analytics-table-scroll overflow-x-auto max-h-[66vh] overflow-y-auto">
                    <table className="w-full min-w-[1900px] border-collapse text-sm">
                      <thead className="sticky top-0 z-20">
                        <tr className="bg-sky-800 border-b border-sky-700">
                          <th className="sticky left-0 z-30 bg-sky-800 px-4 py-3 text-left  text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700 min-w-[150px]">Customer</th>
                          {months.map((m, mi) => (
                            <th key={m} colSpan={7} className={`px-4 py-2.5 text-center text-x font-semibold text-white border-l border-sky-700 bg-sky-800`}>{m}</th>
                          ))}
                          <th colSpan={2} className="px-4 py-2.5 text-center text-x font-semibold text-white border-l border-sky-700 bg-sky-900">Quarter Rev</th>
                        </tr>
                        <tr className="bg-sky-700 border-b border-slate-600 sticky top-[44px] z-10">
                          <th className="sticky left-0 z-30 bg-sky-700 border-r border-slate-600"></th>
                          {months.map((m) => (
                            <React.Fragment key={m}>
                              {["Units AI","Units Adj","Rate AI","Rate Adj","Rev AI","Rev Adj",""].map((h, hi) => (
                                <th key={hi} className={`px-3 py-2 text-xs font-medium text-white uppercase whitespace-nowrap
                                  ${hi===0?"border-l border-slate-600 text-right":hi===6?"text-center w-10":h==="Comment"?"text-left":"text-right"}`}>
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
                        {driverCustomers.map((cust, rowIdx) => {
                          const isEven = rowIdx % 2 === 0;
                          const avCls  = avatarClass(cust);
                          let qRevAi = 0, qRevAdj = 0;
                          const cells = months.map((month, mi) => {
                            const monthKey = monthPeriods[mi] ?? getMonthKey(year, mi, quarter, fiscalYearStartMonth);
                            const d        = drivers.find((x) => x.customer_name === cust && x.month === monthKey);
                            const origIdx  = drivers.findIndex((x) => x.customer_name === cust && x.month === monthKey);
                            const th       = monthTheme[mi % monthTheme.length];
                            const ck       = `${cust}-${monthKey}`;
                            // toCalcNumber, not `|| 0`: revenue_adjusted can be a raw
                            // string while the user is mid-edit, and `0 + "<string>"` is
                            // concatenation, not addition — it would corrupt the quarter total.
                            if (d) { qRevAi += d.revenue_ai||0; qRevAdj += toCalcNumber(d.revenue_adjusted); }
                            if (!d) return (
                              <React.Fragment key={month}>
                                {Array(7).fill(0).map((_,i)=>(
                                  <td key={i} className={`px-3 py-2 text-center text-slate-300 text-x ${i===0?"border-l border-slate-100":""} ${th.bg}`}>—</td>
                                ))}
                              </React.Fragment>
                            );
                            const revChg = d.revenue_adjusted !== d.revenue_ai;
                            return (
                              <React.Fragment key={month}>
                                <td className={`px-3 py-2 text-right text-x text-slate-500 tabular-nums border-l border-slate-100 ${th.bg}`}>{d.units_ai?.toFixed(getDecimalPrecision())??"—"}</td>
                                <td className={`px-2 py-1.5 ${th.bg}`}>
                                  <input type="number" value={displayEditableNumber(d.units_adjusted, focusedCellKey === `driver-${origIdx}-units`)} step={Math.pow(10, -getDecimalPrecision())} disabled={!canEdit}
                                    onFocus={(e) => { setFocusedCellKey(`driver-${origIdx}-units`); e.target.select(); }}
                                    onBlur={() => setFocusedCellKey(null)}
                                    onChange={(e)=>handleDriverChange(origIdx,"units_adjusted",e.target.value)}
                                    className={`w-20 px-2 py-1 rounded-lg border text-right text-x tabular-nums outline-none transition-all
                                      ${!canEdit?"bg-slate-50 border-slate-200 cursor-not-allowed text-slate-400":"border-slate-300 bg-white hover:border-slate-400 focus:border-blue-500 focus:ring-2 ring-blue-100"}`}/>
                                </td>
                                <td className={`px-3 py-2 text-right text-x text-slate-500 tabular-nums ${th.bg}`}>${d.rate_ai?.toFixed(getDecimalPrecision())??"—"}</td>
                                <td className={`px-2 py-1.5 ${th.bg}`}>
                                  <input type="number" value={displayEditableNumber(d.rate_adjusted, focusedCellKey === `driver-${origIdx}-rate`)} step={Math.pow(10, -getDecimalPrecision())} disabled={!canEdit}
                                    onFocus={(e) => { setFocusedCellKey(`driver-${origIdx}-rate`); e.target.select(); }}
                                    onBlur={() => setFocusedCellKey(null)}
                                    onChange={(e)=>handleDriverChange(origIdx,"rate_adjusted",e.target.value)}
                                    className={`w-20 px-2 py-1 rounded-lg border text-right text-x tabular-nums outline-none transition-all
                                      ${!canEdit?"bg-slate-50 border-slate-200 cursor-not-allowed text-slate-400":"border-slate-300 bg-white hover:border-slate-400 focus:border-blue-500 focus:ring-2 ring-blue-100"}`}/>
                                </td>
                                <td className={`px-3 py-2 text-right text-x text-sky-700 font-semibold tabular-nums ${th.bg}`}>{fmt(d.revenue_ai)}</td>
                                <td className={`px-2 py-1.5 ${th.bg}`}>
                                  <input type="number" value={displayEditableNumber(d.revenue_adjusted, focusedCellKey === `driver-${origIdx}-revenue`)} step={Math.pow(10, -getDecimalPrecision())} disabled={!canEdit}
                                    onFocus={(e) => { setFocusedCellKey(`driver-${origIdx}-revenue`); e.target.select(); }}
                                    onBlur={() => setFocusedCellKey(null)}
                                    onChange={(e)=>handleDriverChange(origIdx,"revenue_adjusted",e.target.value)}
                                    className={`w-24 px-2 py-1 rounded-lg border text-right text-x tabular-nums outline-none transition-all
                                      ${!canEdit?"bg-slate-50 border-slate-200 cursor-not-allowed text-slate-400"
                                        :revChg?"border-blue-400 bg-blue-50 text-blue-900 focus:ring-2 ring-blue-100"
                                        :"border-slate-300 bg-white hover:border-slate-400 focus:border-blue-500 focus:ring-2 ring-blue-100"}`}/>
                                </td>
                                {/* NEW: Driver comment icon */}
                                <td className={`px-1.5 py-1.5 text-center ${th.bg}`}>
                                  <InlineCommentIcon
                                    commentKey={ck}
                                    value={driverComments[ck]}
                                    disabled={!canEdit}
                                    onChange={(v)=>{ setDriverComments((p)=>({...p,[ck]:v})); dirtyDriverKeysRef.current.add(`${cust}|${monthKey}`); setDriverHasChanges(true); }}
                                    label={`${cust} — ${month}`}
                                  />
                                </td>
                              </React.Fragment>
                            );
                          });
                          return (
                            <tr key={cust} className={`rf-row border-b border-slate-100 transition-colors ${isEven?"bg-white":"bg-slate-50/60"}`}>
                              <td className="sticky left-0 z-[5] border-r border-slate-200 px-4 py-2.5 bg-white">
                                <div className="flex items-center gap-2">
                                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${avCls}`}>{getInitials(cust)}</div>
                                  <span className="font-bold text-slate-900 text-x whitespace-nowrap">{cust}</span>
                                </div>
                              </td>
                              {cells}
                              <td className="px-3 py-2 text-right text-x text-slate-500 tabular-nums border-l border-slate-200 bg-slate-50">{fmt(qRevAi)}</td>
                              <td className={`px-3 py-2 text-right text-x font-bold tabular-nums ${qRevAdj>qRevAi?"text-emerald-600":qRevAdj<qRevAi?"text-red-500":"text-sky-700"}`}>{fmt(qRevAdj)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            <SaveBar hasChanges={driverHasChanges} saving={driverSaving} onSave={handleSaveDrivers} label="Save Driver Adjustments" disabled={!canEdit}/>
          </div>
        )}

        {/* ══ SCENARIOS TAB ══════════════════════════════════════════ */}
        {activeTab === "scenarios" && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="font-bold text-slate-900 text-s">Forecast Scenarios</h2>
                <p className="text-x text-slate-500 mt-0.5">Manage and compare forecast scenarios</p>
              </div>
              <button onClick={() => setScenarioModal({ open:true, edit:null })}
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
                      const style     = getScStyle(sc);
                      const baseAi    = toCalcNumber(apiData?.Compare_Revenue_Forecast_Scenarios?.baseline?.total_ai);
                      const multiplier = toCalcNumber(sc.multiplier);
                      const computed  = sc.is_system && apiData?.Compare_Revenue_Forecast_Scenarios?.[sc.scenario_name];
                      const compAi    = toCalcNumber(computed?.total_ai);
                      const compUser  = toCalcNumber(computed?.total_user);
                      const totalAi   = compAi   || (baseAi * multiplier);
                      const totalUser = compUser || (baseAi * multiplier);
                      const vAmt      = totalUser - (compAi || baseAi);
                      const vPct      = baseAi ? ((vAmt/baseAi)*100).toFixed(getDecimalPrecision()) : "0.0";

                      return (
                        <div key={sc.id||sc.scenario_name}
                          className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-visible">
                          <div className={`h-1 ${style.top}`}/>
                          <div className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2.5">
                                <span className="text-xl leading-none">{style.icon}</span>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <p className="font-semibold text-slate-900 text-s capitalize">{sc.scenario_name.replace(/_/g," ")}</p>
                                    {sc.is_system && <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold border border-slate-200">System</span>}
                                  </div>
                                  <p className=" text-xs text-slate-400 tabular-nums">{year} · {quarter} · {sc.multiplier}×</p>
                                </div>
                              </div>
                              <div className="relative">
                                <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId===(sc.id||sc.scenario_name)?null:(sc.id||sc.scenario_name)); }}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-sky-700 transition-colors">
                                  <FiMoreVertical size={14}/>
                                </button>
                                {openMenuId===(sc.id||sc.scenario_name) && (
                                  <div className="absolute right-0 top-8 z-20 bg-white rounded-xl border border-slate-200 shadow-xl overflow-visible w-32" onClick={(e)=>e.stopPropagation()}>
                                    <button onClick={()=>{setScenarioModal({open:true,edit:sc});setOpenMenuId(null);}} disabled={sc.is_system&&!sc.id}
                                      className="flex items-center gap-2 w-full px-3 py-2.5 text-x text-sky-700 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                      <FiEdit2 size={12}/> Edit
                                    </button>
                                    <button onClick={()=>{setDeleteModal({open:true,scenario:sc});setOpenMenuId(null);}} disabled={sc.is_system}
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
                                <p className="text-s font-bold text-sky-700 tabular-nums">{fmt(totalAi)}</p>
                              </div>
                              <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200">
                                <p className="text-xs text-slate-500 font-medium mb-0.5">Adjusted</p>
                                <p className="text-s font-bold text-slate-900 tabular-nums">{fmt(totalUser)}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 border border-slate-200">
                              <span className=" text-xs text-slate-500 font-medium">Variance</span>
                              <span className={`text-x font-bold tabular-nums ${vAmt>=0?"text-emerald-600":"text-red-600"}`}>
                                {vAmt>=0?"+":""}{fmt(vAmt)} ({vPct}%)
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
                      <span className="ml-auto  text-xs text-slate-400 tabular-nums">{scenariosList.length} scenarios</span>
                    </div>
                    <div className="analytics-table-scroll overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-4 py-3 text-left  text-xs font-semibold text-slate-500 uppercase tracking-wide">Metric</th>
                            {scenariosList.map(sc => (
                              <th key={sc.id||sc.scenario_name} className="px-4 py-3 text-right  text-xs font-semibold text-sky-700 capitalize tracking-wide">
                                {sc.scenario_name.replace(/_/g," ")}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {[
                            { label:"Multiplier",    fn:(sc)=>`${sc.multiplier}×` },
                            { label:"AI Total",      fn:(sc)=>{ const b=toCalcNumber(apiData?.Compare_Revenue_Forecast_Scenarios?.baseline?.total_ai); const d=apiData?.Compare_Revenue_Forecast_Scenarios?.[sc.scenario_name]; return fmt(toCalcNumber(d?.total_ai)||b*toCalcNumber(sc.multiplier)); } },
                            { label:"User Forecast", fn:(sc)=>{ const b=toCalcNumber(apiData?.Compare_Revenue_Forecast_Scenarios?.baseline?.total_ai); const d=apiData?.Compare_Revenue_Forecast_Scenarios?.[sc.scenario_name]; return fmt(toCalcNumber(d?.total_user)||b*toCalcNumber(sc.multiplier)); }, bold:true },
                          ].map((row,ri)=>(
                            <tr key={row.label} className={`border-b border-slate-100 ${ri%2===0?"bg-white":"bg-slate-50/40"}`}>
                              <td className="px-4 py-3 font-medium text-sky-700 text-s">{row.label}</td>
                              {scenariosList.map(sc=>(
                                <td key={sc.id||sc.scenario_name} className={`px-4 py-3 text-right tabular-nums text-s ${row.bold?"font-bold text-slate-900":"text-slate-600"}`}>
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
        )}

        {/* Footer summary bar hidden on request
        {apiData && (
          <div className="mt-5 flex items-center flex-wrap gap-3 px-4 py-2.5 bg-white rounded-xl border border-slate-200  text-xs text-slate-400 tabular-nums shadow-sm">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"/>{rows.length} customers</span>
            <span className="text-slate-300">·</span>
            <span>Year: <strong className="text-slate-600">{year}</strong></span>
            <span className="text-slate-300">·</span>
            <span>Quarter: <strong className="text-slate-600">{quarter}</strong></span>
            <span className="text-slate-300">·</span>
            <span>Stage: <strong className="text-sky-700">{STAGE_LABELS[stage]}</strong></span>
            <span className="text-slate-300">·</span>
            <span>AI: <strong className="text-slate-600">{fmt(totals.aiTotal)}</strong></span>
            <span className="text-slate-300">·</span>
            <span>Adj: <strong className="text-sky-700">{fmt(totals.usrTotal)}</strong></span>
            <span className={`font-bold ${variance>=0?"text-emerald-600":"text-red-500"}`}>{variance>=0?"▲":"▼"} {Math.abs(Number(varPct))}%</span>
          </div>
        )}
        */}

        {/* ── Overall Chat — lazy-loaded below the fold ──────────────────── */}
        <OverallChat year={year} quarter={quarter} token={token} API_BASE={API_BASE} addToast={addToast}/>

      </main>
    </div>
  );
}

