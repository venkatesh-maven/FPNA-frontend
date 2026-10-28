// CapexForecasting.jsx
import React, { useState, useRef, useEffect, useCallback, useContext, useMemo } from "react";
import {
  FiRefreshCw, FiDownload, FiUpload, FiSearch, FiX,
  FiTrendingUp, FiBarChart2, FiSettings,
  FiAlertCircle, FiPlus, FiEdit2, FiTrash2, FiMoreVertical,
  FiInfo, FiMessageSquare,
} from "react-icons/fi";

import { AuthContext } from "../../context/AuthContext";
import { BudgetYearContext } from "../../context/BudgetYearContext";
import { useCurrentQuarter } from "../../hooks/useCurrentQuarter";
import { API_BASE_URL } from "../../config/config";

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

import {
  getQuarterMonths, STAGE_LABELS, STAGE_CONFIG,
  fmt, fmtPct, parseApiError, getInitials, avatarClass, getMonthKey,
  useToast, ToastContainer, Spinner, EmptyState,
  CenterErrorModal, WorkflowModal, WorkflowProgress,
  KpiCards, SaveBar, InlineCommentIcon,
  ScenarioModal, ExcelUploadPreviewModal, OverallChat,
  RoiBadge,
} from "./CapexForecastHelpers";
import TableSkeleton from "../Skeleton/TableSkeleton";
import { getDecimalPrecision } from '../../utils/formatters';

// NOTE: backend typo "managemet" kept as-is
const API_BASE = `${API_BASE_URL}/api/v1/forecasting/managemet/capex-forecast`;

const WORKFLOW_ACTIONS = {
  submitted: "submit_for_review",
  reviewed:  "mark_as_reviewed",
  approved:  "approve",
  locked:    "lock",
  draft:     "reject",
};

const TABS = [
  { id: "summary",   label: "Summary",  icon: <FiBarChart2 size={13}/> },
  { id: "drivers",   label: "Drivers",  icon: <FiSettings size={13}/> },
  { id: "scenarios", label: "Scenarios",icon: <FiTrendingUp size={13}/> },
];

const CURRENCY_FILTER_OPTIONS = [
  { value: "actualvalue", label: "Actual" },
  { value: "thousands",   label: "Thousands" },
  { value: "millions",    label: "Millions" },
];

const monthTheme = [
  { bg: "bg-white", label: "text-white" },
  { bg: "bg-white", label: "text-white" },
  { bg: "bg-white", label: "text-white" },
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

// ─── UnsavedChangesModal ──────────────────────────────────────────────────────
function UnsavedChangesModal({ open, saving, onSave, onDiscard, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1100] bg-sky-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-[400px] shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="h-1 bg-amber-400"/>
        <div className="px-6 py-5">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0"><FiAlertCircle className="text-amber-500" size={20}/></div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Unsaved Changes</h3>
              <p className="text-slate-500 text-s mt-1 leading-relaxed">You have unsaved changes. Would you like to save before continuing?</p>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sky-700 text-s font-semibold transition-colors">Stay</button>
            <button onClick={onDiscard} className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-s font-semibold transition-colors">Discard</button>
            <button onClick={onSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-s font-semibold transition-all disabled:opacity-50">
              {saving?<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</>:"💾 Save & Continue"}
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
// months for the CAPEX item instead of just the one month edited.
function ApplyAllMonthsModal({ open, itemLabel, value, applying, onYes, onNo }) {
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
                for <span className="font-semibold text-sky-800">{itemLabel}</span>?
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

// ─── DeleteConfirmModal ───────────────────────────────────────────────────────
function DeleteConfirmModal({ open, scenarioName, onClose, onConfirm, loading }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1001] bg-sky-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-[380px] shadow-2xl border border-slate-200 text-center">
        <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-3"><FiTrash2 className="text-red-500" size={22}/></div>
        <h3 className="font-bold text-slate-900 text-base mb-1">Delete Scenario</h3>
        <p className="text-slate-500 text-s mb-1">Are you sure you want to delete</p>
        <p className="font-semibold text-sky-800 text-s mb-4">"{scenarioName}"?</p>
        <p className=" text-slate-400 mb-5">This cannot be undone.</p>
        <div className="flex gap-2 justify-center">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sky-700 text-s font-semibold transition-colors">Cancel</button>
          <button onClick={onConfirm} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-s font-semibold transition-all disabled:opacity-50">
            {loading?<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Deleting…</>:<><FiTrash2 size={13}/> Delete</>}
          </button>
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
      const res = await fetch(
        `${API_BASE}/${year}/excel-template/${type}?quarter=${quarter}`,
        { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } }
      );
      if (!res.ok) throw new Error(await parseApiError(res));
      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = type === "capex-adjustments"
        ? `capex_adjustments_${year}_${quarter}.xlsx`
        : `capex_driver_adjustments_${year}_${quarter}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      addToast("Template downloaded ✓", "success");
    } catch (e) { addToast(`Download failed: ${e.message}`, "error"); }
    finally { setDownloading(null); }
  };

  const handleExcelUpload = async (file, type) => {
    setUploading(true); setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const endpoint = type === "capex"
        ? `${API_BASE}/${year}/excel-upload/capex-adjustments?quarter=${quarter}`
        : `${API_BASE}/${year}/excel-upload/driver-adjustments?quarter=${quarter}`;
      const res = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      if (!res.ok) throw new Error(await parseApiError(res));
      addToast(`${type === "capex" ? "CAPEX" : "Driver"} adjustments uploaded ✓`, "success");
      onSuccess?.();
    } catch (e) {
      setUploadError(e.message);
      addToast(`Upload failed: ${e.message}`, "error");
      throw e;
    } finally { setUploading(false); }
  };

  if (activeTab === "summary") return (
    <>
      <div className="flex items-center gap-2">
        <button onClick={() => downloadTemplate("capex-adjustments")} disabled={downloading === "capex-adjustments"}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-sky-700 text-x font-semibold transition-all disabled:opacity-60">
          {downloading === "capex-adjustments" ? <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"/> : <FiDownload size={12}/>}
          Download Template
        </button>
        {canEdit && (
          <button onClick={() => { setUploadError(null); setSummaryUploadOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-x font-semibold transition-all shadow-sm">
            <FiUpload size={12}/> Upload Excel
          </button>
        )}
      </div>
      <ExcelUploadPreviewModal open={summaryUploadOpen} onClose={() => setSummaryUploadOpen(false)}
        title="CAPEX Adjustments Upload" uploading={uploading} uploadError={uploadError}
        onUpload={(f) => handleExcelUpload(f, "capex")}/>
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
      <ExcelUploadPreviewModal open={driverUploadOpen} onClose={() => setDriverUploadOpen(false)}
        title="Driver Adjustments Upload" uploading={uploading} uploadError={uploadError}
        onUpload={(f) => handleExcelUpload(f, "driver")}/>
    </>
  );
  return null;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CapexForecasting() {
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

  const pageTopRef = useRef(null);
  useEffect(() => {
    pageTopRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
    window.scrollTo(0, 0);
  }, []);

  const [quarter,        setQuarter]        = useCurrentQuarter(fiscalYearStartMonth);
  const [currencyFilter, setCurrencyFilter] = useState("actualvalue");
  const [activeTab,      setActiveTab]      = useState("summary");

  /* Forecast creation mode — which view is the "source of truth" input
     surface. Summary and Drivers data are kept numerically in sync (see
     handleAdjChange / handleDriverChange below) regardless of mode. */
  const [forecastMode, setForecastMode] = useState("summary"); // summary | drivers

  // ── Forecast filter state ────────────────────────────────────────────
  const [forecastType,      setForecastType]      = useState("quarter");
  const [viewType,          setViewType]          = useState("monthly_breakdown");

  const [apiData,      setApiData]      = useState(null);
  const [rows,         setRows]         = useState([]);
  const [drivers,      setDrivers]      = useState([]);
  const [stage,        setStage]        = useState("draft");
  const [workflowMeta, setWorkflowMeta] = useState({});

  const [loading,          setLoading]          = useState(false);
  const [saving,           setSaving]           = useState(false);
  const [hasChanges,       setHasChanges]       = useState(false);
  const [driverSaving,     setDriverSaving]     = useState(false);
  const [driverHasChanges, setDriverHasChanges] = useState(false);

  // Key of the "Adjusted" numeric input currently focused (Summary or
  // Drivers table). While a cell is focused we show its raw, unrounded
  // value so the user can fully clear it and type decimals without
  // toFixed() display formatting fighting their keystrokes.
  const [focusedCellKey, setFocusedCellKey] = useState(null);

  // Remembers each Summary "Adjusted" cell's value at the moment it was
  // focused, so onBlur can tell whether the user actually changed it before
  // offering the "apply to all 12 months" prompt.
  const focusValuesRef = useRef({});
  const [applyAllMonthsModal, setApplyAllMonthsModal] = useState({ open: false, idx: null, value: null, itemLabel: null });
  const [applyingAllMonths,   setApplyingAllMonths]   = useState(false);

  const [summaryComments,    setSummaryComments]    = useState({});
  const [summaryRowComments, setSummaryRowComments] = useState({});
  const [driverComments,     setDriverComments]     = useState({});

  const [modal,           setModal]           = useState({ open: false, target: null });
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [centerError,     setCenterError]     = useState(null);

  const [filterText, setFilterText] = useState("");

  const [scenariosList,   setScenariosList]   = useState([]);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioModal,   setScenarioModal]   = useState({ open: false, edit: null });
  const [scenarioSaving,  setScenarioSaving]  = useState(false);
  const [deleteModal,     setDeleteModal]     = useState({ open: false, scenario: null });
  const [deleteLoading,   setDeleteLoading]   = useState(false);
  const [openMenuId,      setOpenMenuId]      = useState(null);

  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingAction,    setPendingAction]    = useState(null);
  const [guardSaving,      setGuardSaving]      = useState(false);

  const [roiPanelItem, setRoiPanelItem] = useState(null);

  const { toasts, add: addToast } = useToast();

  const canEdit  = stage === "draft";
  const stageCfg = STAGE_CONFIG[stage] || STAGE_CONFIG.draft;
  const hasAnyChanges = hasChanges || driverHasChanges;
  // effectiveYear === forecastYear: kept as its own binding (rather than
  // inlining forecastYear at every call site) because save/upload/workflow/
  // scenario calls throughout this file already reference it.
  const effectiveYear = forecastYear;

  // ── Dynamic months ───────────────────────────────────────────────────
  const months = useMemo(() => {
    if (forecastType === "quarter") return getQuarterMonths(fiscalYearStartMonth)[quarter];
    if (apiData?.selected_months?.length) {
      return apiData.selected_months.map((iso) => {
        const [, m] = iso.split("-");
        return new Date(2000, Number(m) - 1, 1).toLocaleString("en", { month: "short" });
      });
    }
    return getQuarterMonths(fiscalYearStartMonth)[quarter];
  }, [forecastType, quarter, apiData, fiscalYearStartMonth]);

  const monthPeriods = useMemo(() => {
    if (apiData?.selected_months?.length) {
      return apiData.selected_months.map((iso, i) => {
        const [, m] = iso.split("-");
        const label = new Date(2000, Number(m) - 1, 1).toLocaleString("en", { month: "short" });
        return { label, iso, index: i };
      });
    }
    return months.map((lbl, i) => ({ label: lbl, iso: null, index: i }));
  }, [apiData, months]);

  const quarterGroups = useMemo(() => {
    if (viewType !== "quarter_summary" || !monthPeriods.length) return null;
    const groups = new Map();
    monthPeriods.forEach((mp, idx) => {
      if (!mp.iso) return;
      const [, m] = mp.iso.split("-");
      const pos = (Number(m) - (fiscalYearStartMonth || 1) + 12) % 12;
      const qNum = Math.floor(pos / 3) + 1;
      const qKey = `Q${qNum}`;
      if (!groups.has(qKey)) groups.set(qKey, { key: qKey, label: `${qKey} ${forecastYear}`, monthIdxs: [] });
      groups.get(qKey).monthIdxs.push(idx);
    });
    return [...groups.values()];
  }, [viewType, monthPeriods, forecastYear, fiscalYearStartMonth]);

  useEffect(() => {
    const h = (e) => { if (!hasAnyChanges) return; e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [hasAnyChanges]);

  useEffect(() => {
    const h = () => setOpenMenuId(null);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);

  const guardedAction = useCallback((action) => {
    if (hasAnyChanges) { setPendingAction(() => action); setShowUnsavedModal(true); }
    else action();
  }, [hasAnyChanges]);

  const handleGuardSave = async () => {
    setGuardSaving(true);
    try {
      const savedSomething = hasChanges || driverHasChanges;
      if (hasChanges)       await _doSave();
      if (driverHasChanges) await _doSaveDrivers();
      // Refresh from the backend so the grid reflects persisted values and
      // the dirty flags are authoritatively cleared (see handleSave).
      if (savedSomething) await fetchData();
    } catch { /* toasted */ }
    finally { setGuardSaving(false); }
    setShowUnsavedModal(false);
    const a = pendingAction; setPendingAction(null); a?.();
  };
  const handleGuardDiscard = () => {
    setHasChanges(false); setDriverHasChanges(false);
    setShowUnsavedModal(false);
    const a = pendingAction; setPendingAction(null); a?.();
  };

  // ── Fetch main data ───────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!token || !year || !currency) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        quarter,
        currency_filter: currencyFilter,
        forecast_year:   forecastYear,
        forecast_type:   forecastType,
        view_type:       "monthly_breakdown",
      });
      if (forecastType === "rolling") params.set("rolling_start_month", rollingStartMonth);
      // Tells the backend which side is authoritative when a cell has an
      // explicit value in both Summary and Drivers.
      params.set("forecast_mode", forecastMode);
      const res = await fetch(`${API_BASE}/${forecastYear}/${currency}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = await res.json();
      setApiData(data);

      const mappedRows = (data.rows || []).map((r) => {
        const mapped = {
          capex_item:                 r.capex_item,
          previous_month_raw:         r.previous_month ?? r.s_month,
          previous_month:             toBackendNumber(r.previous_month ?? r.s_month),
          quarter_total_ai_raw:       r.quarter_total_ai,
          quarter_total_ai:           toBackendNumber(r.quarter_total_ai),
          quarter_total_adjusted_raw: r.quarter_total_adjusted,
          quarter_total_adjusted:     toBackendNumber(r.quarter_total_adjusted) ?? toBackendNumber(r.quarter_total_ai) ?? 0,
          overall_comment:            r.overall_comment || "",
          roi:                        r.roi || null,
        };
        if (Array.isArray(r.monthly_data) && r.monthly_data.length > 0) {
          r.monthly_data.forEach((md, i) => {
            const n = i + 1;
            const aiVal  = toBackendNumber(md.ai ?? md.capex_ai ?? md.monthly_ai);
            const adjVal = toBackendNumber(md.adjusted ?? md.capex_adjusted ?? md.monthly_adjusted);
            mapped[`month${n}_ai_raw`]   = md.ai ?? md.capex_ai ?? null;
            mapped[`month${n}_ai`]       = aiVal;
            mapped[`month${n}_adjusted`] = adjVal ?? aiVal ?? 0;
            mapped[`month${n}_comment`]  = md.comment || md.month_comment || "";
          });
        } else {
          for (let n = 1; n <= 12; n++) {
            mapped[`month${n}_ai_raw`]   = r[`month${n}_ai`] ?? null;
            mapped[`month${n}_ai`]       = toBackendNumber(r[`month${n}_ai`]);
            mapped[`month${n}_adjusted`] = toBackendNumber(r[`month${n}_adjusted`]) ?? toBackendNumber(r[`month${n}_ai`]) ?? 0;
            mapped[`month${n}_comment`]  = r[`month${n}_comment`] || "";
          }
        }
        return mapped;
      });
      setRows(mappedRows);

      // init comment state (dynamic month count)
      const sc = {}, src = {};
      const nMonths = data.selected_months?.length || 3;
      mappedRows.forEach((r) => {
        for (let n = 1; n <= Math.max(3, nMonths); n++) {
          sc[`${r.capex_item}-month${n}`] = r[`month${n}_comment`] || "";
        }
        src[r.capex_item] = r.overall_comment || "";
      });
      setSummaryComments(sc); setSummaryRowComments(src);

      // flatten drivers
      if (Array.isArray(data.drivers)) {
        const flat = [];
        data.drivers.forEach((d) => {
          (d.months || []).forEach((m) => flat.push({
            capex_item:             d.capex_item,
            month:                  m.month,
            units_ai:               toBackendNumber(m.units_ai),
            rate_ai:                toBackendNumber(m.rate_ai),
            capex_ai:               toBackendNumber(m.capex_ai),
            units_adjusted:         toBackendNumber(m.units_adjusted) ?? toBackendNumber(m.units_ai) ?? 0,
            rate_adjusted:          toBackendNumber(m.rate_adjusted)  ?? toBackendNumber(m.rate_ai)  ?? 0,
            capex_adjusted:         toBackendNumber(m.capex_adjusted) ?? toBackendNumber(m.capex_ai) ?? 0,
            month_comment:          m.month_comment  || "",
            roi:                    m.roi || null,
            quarter_capex_ai:       toBackendNumber(d.quarter_capex_ai),
            quarter_capex_adjusted: toBackendNumber(d.quarter_capex_adjusted) ?? toBackendNumber(d.quarter_capex_ai) ?? 0,
            overall_comment:        d.overall_comment || "",
          }));
        });
        setDrivers(flat);
        const dc = {};
        flat.forEach((f) => { dc[`${f.capex_item}-${f.month}`] = f.month_comment || ""; });
        setDriverComments(dc);
      }

      setStage(data.workflow_stage || "draft");
      setWorkflowMeta({ reviewed_by: data.reviewed_by, approved_by: data.approved_by, locked_by: data.locked_by });
      setHasChanges(false); setDriverHasChanges(false);
    } catch (e) { addToast(`Failed to load: ${e.message}`, "error"); }
    finally { setLoading(false); }
  }, [year, currency, quarter, currencyFilter, forecastYear, forecastType, rollingStartMonth, token, forecastMode]);

  const fetchScenarios = useCallback(async () => {
    if (!token || !effectiveYear || !currency) return;
    setScenarioLoading(true);
    try {
      const params = new URLSearchParams({ quarter, currency_filter: currencyFilter });
      const res = await fetch(`${API_BASE}/${effectiveYear}/scenarios?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = await res.json();
      setScenariosList(Array.isArray(data) ? data : (data.scenarios || []));
    } catch (e) { addToast(`Failed to load scenarios: ${e.message}`, "error"); }
    finally { setScenarioLoading(false); }
  }, [effectiveYear, currency, quarter, currencyFilter, token]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (activeTab === "scenarios") fetchScenarios(); }, [activeTab, fetchScenarios]);

  // ── Save CAPEX Adjustments ────────────────────────────────────────────
  const _doSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const payload = rows.map((r) => {
        const obj = { capex_item: r.capex_item, overall_comment: summaryRowComments[r.capex_item] || "" };
        months.forEach((_, mi) => {
          const n = mi + 1;
          // toBackendNumber(...) ?? 0, not `|| 0`: a cell can still hold the
          // raw string the user typed (e.g. "" while editing), and `|| 0`
          // would send that string straight to the backend.
          obj[`month${n}_adjusted`] = toBackendNumber(r[`month${n}_adjusted`]) ?? 0;
          obj[`month${n}_comment`]  = summaryComments[`${r.capex_item}-month${n}`] || "";
        });
        return obj;
      });
      const saveParams = new URLSearchParams({ quarter, forecast_year: effectiveYear, forecast_type: forecastType });
      if (forecastType === "rolling") saveParams.set("rolling_start_month", rollingStartMonth);
      const res = await fetch(`${API_BASE}/adjustments/${effectiveYear}?${saveParams.toString()}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      setHasChanges(false); addToast("CAPEX adjustments saved ✓", "success");
    } catch (e) { setCenterError(e.message); throw e; }
    finally { setSaving(false); }
  };

  // ── Save Driver Adjustments ───────────────────────────────────────────
  const _doSaveDrivers = async () => {
    if (!canEdit) return;
    setDriverSaving(true);
    try {
      const overallMap = {};
      drivers.forEach((d) => { if (!overallMap[d.capex_item]) overallMap[d.capex_item] = d.overall_comment || ""; });
      const payload = drivers.map((d) => {
        const ck = `${d.capex_item}-${d.month}`;
        return {
          capex_item:      d.capex_item,
          month:           d.month,
          // toBackendNumber(...) ?? ..., not `?? 0` alone: a raw string ("")
          // wouldn't be caught by `??`, which only checks null/undefined.
          units_adjusted:  toBackendNumber(d.units_adjusted) ?? toBackendNumber(d.units_ai) ?? 0,
          rate_adjusted:   toBackendNumber(d.rate_adjusted)  ?? toBackendNumber(d.rate_ai)  ?? 0,
          month_comment:   driverComments[ck] || "",
          overall_comment: overallMap[d.capex_item] || "",
        };
      });
      const res = await fetch(`${API_BASE}/driver-adjustments/${effectiveYear}?quarter=${quarter}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      setDriverHasChanges(false); addToast("Driver adjustments saved ✓", "success");
    } catch (e) { setCenterError(e.message); throw e; }
    finally { setDriverSaving(false); }
  };

  /* Cross-sync (handleAdjChange / handleDriverChange) marks both dirty
     flags whenever a change in one mode implies a change in the other, so
     saving from either tab must persist both to keep the two tables
     consistent server-side. */
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

  // ── Workflow ───────────────────────────────────────────────────────────
  const handleWorkflow = async (target, comment) => {
    setWorkflowLoading(true);
    try {
      const action = WORKFLOW_ACTIONS[target];
      if (!action) throw new Error(`Unknown workflow target: ${target}`);
      const res = await fetch(`${API_BASE}/workflow/${effectiveYear}?quarter=${quarter}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ target_stage: target, comment }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      setStage(target); setModal({ open: false, target: null });
      addToast(`Stage → ${STAGE_LABELS[target]} ✓`, "success"); fetchData();
    } catch (e) { addToast(`Workflow failed: ${e.message}`, "error"); }
    finally { setWorkflowLoading(false); }
  };

  // ── Scenarios ──────────────────────────────────────────────────────────
  const handleCreateScenario = async (form) => {
    setScenarioSaving(true);
    try {
      const res = await fetch(`${API_BASE}/${effectiveYear}/scenarios?quarter=${quarter}`, {
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
      const res = await fetch(`${API_BASE}/${effectiveYear}/scenarios/${scenarioModal.edit.id}?quarter=${quarter}`, {
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
      const res = await fetch(`${API_BASE}/${effectiveYear}/scenarios/${deleteModal.scenario.id}?quarter=${quarter}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      addToast("Scenario deleted ✓", "success"); setDeleteModal({ open: false, scenario: null }); fetchScenarios();
    } catch (e) { addToast(`Failed: ${e.message}`, "error"); }
    finally { setDeleteLoading(false); }
  };

  // ── Row change helpers ─────────────────────────────────────────────────
  /* Summary edit → Drivers sync. Editing an "Adjusted" capex cell in Summary
     Based mode keeps whatever rate this cell already had (falls back to the
     AI rate) and backs out the implied units, so the Drivers Based view
     reflects the same capex figure. */
  const handleAdjChange = (idx, field, val) => {
    // Store exactly what the user typed — "", "13", "13.5" — instead of
    // parsing it on every keystroke. The old `parseFloat(val) || 0`
    // collapsed both "" and any not-yet-finished number to 0 immediately,
    // which then re-rendered straight back into the input, making the field
    // impossible to clear or use right. Numeric coercion now only happens
    // where a real number is actually required: the cross-tab sync below,
    // and at save time (toBackendNumber(...) ?? 0).
    let capexItem = null;
    setRows((prev) => {
      const n = [...prev];
      n[idx] = { ...n[idx], [field]: val };
      capexItem = n[idx].capex_item;
      return n;
    });
    setHasChanges(true);

    const monthMatch = /^month(\d+)_adjusted$/.exec(field);
    if (monthMatch && capexItem) {
      const monthLabel = monthPeriods[Number(monthMatch[1]) - 1]?.iso;
      if (monthLabel) {
        const syncVal = toCalcNumber(val);
        setDrivers((prev) => {
          const dIdx = prev.findIndex((d) => d.capex_item === capexItem && d.month === monthLabel);
          if (dIdx === -1) return prev;
          const u = [...prev];
          const rate = toCalcNumber(u[dIdx].rate_adjusted) || toCalcNumber(u[dIdx].rate_ai) || 1000;
          u[dIdx] = {
            ...u[dIdx],
            rate_adjusted: rate,
            units_adjusted: rate ? syncVal / rate : 0,
            capex_adjusted: syncVal,
          };
          return u;
        });
        setDriverHasChanges(true);
      }
    }
  };

  /* onBlur for a Summary "Adjusted" month input — the "navigate to another
     row or column" moment. If the value actually changed since the cell was
     focused, offer to propagate it to all 12 months for this CAPEX item. */
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
    setApplyAllMonthsModal({ open: true, idx, value: curNum, itemLabel: row.capex_item });
  };

  const closeApplyAllMonthsModal = () => setApplyAllMonthsModal({ open: false, idx: null, value: null, itemLabel: null });

  /* "Yes, apply to all 12 months" — write the value into every currently
     visible month column locally (instant feedback + Drivers cross-sync via
     handleAdjChange) and persist it across all 4 quarters on the backend,
     since capex_forecast_adjustments stores each quarter as its own row. */
  const applyAdjustedToAllMonths = async () => {
    const { idx, value, itemLabel } = applyAllMonthsModal;
    if (idx == null || itemLabel == null) { closeApplyAllMonthsModal(); return; }
    setApplyingAllMonths(true);
    try {
      months.forEach((_, mi) => handleAdjChange(idx, `month${mi + 1}_adjusted`, value));

      const res = await fetch(`${API_BASE}/adjustments/${year}/apply-all-months`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ capex_item: itemLabel, value }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = await res.json();

      const skipped = data?.skipped_quarters || [];
      addToast(
        skipped.length
          ? `Applied to all 12 months for ${itemLabel} — ${skipped.join(", ")} skipped (not in draft) ✓`
          : `Applied to all 12 months for ${itemLabel} ✓`,
        "success"
      );
    } catch (e) {
      addToast(`Failed to apply to all 12 months: ${e.message}`, "error");
    } finally {
      setApplyingAllMonths(false);
      closeApplyAllMonthsModal();
    }
  };

  /* Drivers edit → Summary sync. units_adjusted/rate_adjusted recompute
     capex_adjusted = units*rate (matching how the backend persists it) and
     that figure is pushed into the matching Summary "Adjusted" cell. */
  const handleDriverChange = (index, field, val) => {
    let updated = null;
    setDrivers((prev) => {
      const u = [...prev];
      // Store the raw typed value rather than `parseFloat(val)`, which
      // rounds off a not-yet-finished decimal (e.g. "13." -> 13).
      u[index] = { ...u[index], [field]: val };
      u[index].capex_adjusted = toCalcNumber(u[index].units_adjusted) * toCalcNumber(u[index].rate_adjusted);
      updated = u[index];
      return u;
    });
    setDriverHasChanges(true);

    if (updated) {
      const { capex_item, month, capex_adjusted } = updated;
      const monthIdx = monthPeriods.findIndex((mp) => mp.iso === month);
      if (monthIdx !== -1) {
        setRows((prev) => {
          const rIdx = prev.findIndex((r) => r.capex_item === capex_item);
          if (rIdx === -1) return prev;
          const n = [...prev];
          n[rIdx] = { ...n[rIdx], [`month${monthIdx + 1}_adjusted`]: toCalcNumber(capex_adjusted) };
          return n;
        });
        setHasChanges(true);
      }
    }
  };

  const handleTabChange              = (id) => guardedAction(() => setActiveTab(id));
  const handleQuarterChange          = (q)  => guardedAction(() => setQuarter(q));
  const handleCurrencyFilterChange   = (v)  => guardedAction(() => setCurrencyFilter(v));
  const handleRefresh                = ()   => guardedAction(fetchData);
  const handleForecastTypeChange     = (v)  => guardedAction(() => setForecastType(v));
  const handleViewTypeChange         = (v)  => guardedAction(() => setViewType(v));
  const handleForecastModeChange     = (v)  => guardedAction(() => {
    setForecastMode(v);
    setActiveTab(v === "drivers" ? "drivers" : "summary");
  });

  // ── Derived ────────────────────────────────────────────────────────────
  const filteredRows = rows.filter((r) => {
    const q = filterText.toLowerCase();
    return !filterText || r.capex_item.toLowerCase().includes(q);
  });

  const totalsData = useMemo(() => {
    const gt = apiData?.total;
    const t = {
      prev: gt?.previous_month != null ? toCalcNumber(gt.previous_month) : rows.reduce((s, r) => s + toCalcNumber(r.previous_month), 0),
      monthTotals: [],
      aiTotal:  0,
      usrTotal: 0,
    };
    months.forEach((_, mi) => {
      const n   = mi + 1;
      const ai  = gt?.[`month${n}_ai`]       != null ? toCalcNumber(gt[`month${n}_ai`])       : rows.reduce((s, r) => s + toCalcNumber(r[`month${n}_ai`]),       0);
      const usr = gt?.[`month${n}_adjusted`] != null ? toCalcNumber(gt[`month${n}_adjusted`]) : rows.reduce((s, r) => s + toCalcNumber(r[`month${n}_adjusted`]), 0);
      t.monthTotals.push({ ai, usr });
      t.aiTotal  += ai;
      t.usrTotal += usr;
    });
    return t;
  }, [rows, apiData, months]);

  const variance = totalsData.usrTotal - totalsData.aiTotal;
  const varPct   = totalsData.aiTotal ? ((variance / totalsData.aiTotal) * 100).toFixed(getDecimalPrecision()) : "0.0";

  const forecastSummary = apiData?.Baseline_forecast_summary || {};
  const driverItems = [...new Set(drivers.map((d) => d.capex_item))];

  const scenarioStyles = {
    baseline:               { icon: "◎",  top: "bg-blue-600"    },
    accelerated_investment: { icon: "🚀", top: "bg-emerald-500" },
    delayed_spending:       { icon: "⏳", top: "bg-amber-500"   },
  };
  const getScStyle = (sc) => scenarioStyles[sc.scenario_name] || { icon: "📊", top: "bg-slate-600" };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div ref={pageTopRef} className="planning-compact forecasting-pnl-thee capex-forecast-pae min-h-screen bg-sky-50 font-sans text-sky-900">

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
        onSave={handleGuardSave} onDiscard={handleGuardDiscard}
        onCancel={() => { setShowUnsavedModal(false); setPendingAction(null); }}/>
      <ApplyAllMonthsModal open={applyAllMonthsModal.open} itemLabel={applyAllMonthsModal.itemLabel}
        value={applyAllMonthsModal.value} applying={applyingAllMonths}
        onYes={applyAdjustedToAllMonths} onNo={closeApplyAllMonthsModal}/>

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <header className="forecasting-page-header bg-gradient-to-r from-sky-950 via-sky-900 to-sky-700 rounded-xl px-4 py-2.5 md:px-6 sticky -top-5 z-40 shadow-sm">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
              <FiTrendingUp className="text-white" size={16}/>
            </div>
            <h1 className="text-lg font-bold text-white">CAPEX Forecast</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <p className="text-white text-xs tabular-nums">{forecastYear} · {forecastType === "quarter" ? quarter : forecastType} · {currency}</p>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${stageCfg.pill}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${stageCfg.dot}`}/>{STAGE_LABELS[stage]}
            </div>
            {hasAnyChanges && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"/> Unsaved
              </div>
            )}
            <select value={currencyFilter} onChange={(e) => handleCurrencyFilterChange(e.target.value)}
              className="px-3 py-1 rounded-lg bg-white border border-sky-200 text-sky-900 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200">
              {CURRENCY_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={handleRefresh} className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 border border-white/20 text-white text-x font-semibold hover:bg-white/20 transition-colors">
              <FiRefreshCw size={12}/> Refresh
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 border border-white/20 text-white text-x font-semibold hover:bg-white/20 transition-colors">
              <FiDownload size={12}/> Export
            </button>
          </div>
        </div>
      </header>

      {/* ── WORKFLOW PROGRESS ───────────────────────────────────────── */}
      <div className="max-w-screen-2xl mx-auto px-0 mt-2">
        <WorkflowProgress stage={stage} workflowMeta={workflowMeta} onAction={(t) => setModal({ open:true, target:t })}/>
      </div>

      {/* ── FILTER BAR ─────────────────────────────────────────────── */}
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
            <select value={forecastType} onChange={(e) => handleForecastTypeChange(e.target.value)}
              className="px-3 py-1 rounded-lg bg-white border border-slate-300 text-slate-900 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200">
              <option value="quarter">Quarter Forecast</option>
              <option value="12months">12 Months</option>
              <option value="rolling">Rolling</option>
            </select>
          </div>
          {forecastType === "quarter" && (
            <div className="flex items-center gap-2">
              <label className="font-semibold text-slate-700">Quarter</label>
              <select value={quarter} onChange={(e) => handleQuarterChange(e.target.value)}
                className="px-3 py-1 rounded-lg bg-white border border-slate-300 text-slate-900 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200">
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
            <select value={viewType} onChange={(e) => handleViewTypeChange(e.target.value)}
              className="px-3 py-1 rounded-lg bg-white border border-slate-300 text-slate-900 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200">
              <option value="monthly_breakdown">Monthly Breakdown</option>
              <option value="quarter_summary">Quarter Summary</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="font-semibold text-slate-700">Forecast Creation Mode</label>
            <select value={forecastMode} onChange={(e) => handleForecastModeChange(e.target.value)}
              title="Choose which view drives input. Summary and Drivers values stay in sync regardless of mode."
              className="px-3 py-1 rounded-lg bg-white border border-slate-300 text-slate-900 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200">
              <option value="summary">Summary Based</option>
              <option value="drivers">Drivers Based</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── MAIN ───────────────────────────────────────────────────── */}
      <main className="max-w-screen-2xl mx-auto px-0 py-2">

        <KpiCards forecastSummary={forecastSummary} months={months} rows={rows}/>

        {/* ── TABS ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b-2 border-slate-200 mb-2 gap-2 flex-wrap">
          <div className="flex items-end gap-0.5">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => handleTabChange(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-s font-semibold whitespace-nowrap transition-all
                  ${activeTab===t.id
                    ?"bg-white text-sky-600 rounded-t-xl -mb-0.5 border-l border-t border-r border-slate-200 border-b-2 border-b-white shadow-sm"
                    :"text-slate-500 hover:text-sky-700 hover:bg-white/60 rounded-t-xl"}`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <TabActionButtons activeTab={activeTab} year={effectiveYear} quarter={quarter} token={token}
            canEdit={canEdit} onSuccess={fetchData} addToast={addToast}/>
        </div>

        {/* ══ SUMMARY TAB ════════════════════════════════════════════ */}
        {activeTab === "summary" && (
          <div>
            {/* Search + edit lock */}
            <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13}/>
                  <input value={filterText} onChange={(e) => setFilterText(e.target.value)}
                    placeholder="Search CAPEX item…"
                    className="pl-8 pr-4 py-1 rounded-xl border border-slate-300 bg-white text-s text-slate-900 outline-none focus:border-blue-500 focus:ring-2 ring-blue-100 transition-all w-52 shadow-sm"/>
                </div>
                {filterText && <button onClick={() => setFilterText("")} className="flex items-center gap-1 text-x text-slate-500 hover:text-sky-700 px-2 py-1 rounded-lg hover:bg-slate-100"><FiX size={12}/> Clear</button>}
                <span className="text-x text-slate-500 bg-white px-2.5 py-1 rounded-lg tabular-nums border border-slate-200">{filteredRows.length}/{rows.length}</span>
              </div>
              {!canEdit && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-x font-semibold">
                  <FiAlertCircle size={12}/> Editing disabled — {STAGE_LABELS[stage]}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {loading ? <TableSkeleton columns={5} rows={8} /> : viewType === "quarter_summary" && quarterGroups ? (
                /* ── Quarter Summary View ── */
                <div className="analytics-table-scroll overflow-x-auto max-h-[72vh] overflow-y-auto">
                  <table className="w-full min-w-[900px] border-collapse text-sm">
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-sky-800 border-b border-sky-700">
                        <th rowSpan={2} className="px-4 py-3 text-left font-semibold text-white uppercase tracking-wide border-r border-sky-700 sticky left-0 bg-sky-800 z-30 min-w-[200px]">CAPEX Item</th>
                        <th rowSpan={2} className="px-4 py-3 text-right font-semibold text-white uppercase min-w-[100px]">Prev Month</th>
                        {quarterGroups.map((qg) => (
                          <th key={qg.key} colSpan={2} className="px-4 py-2.5 text-center font-semibold text-white border-l border-sky-700 bg-sky-800">{qg.label}</th>
                        ))}
                        <th rowSpan={2} className="px-4 py-2.5 text-center font-semibold text-white border-l border-sky-700 bg-sky-800 min-w-[80px]">ROI</th>
                        <th rowSpan={2} className="px-4 py-2.5 text-center font-semibold text-white border-l border-sky-700 bg-sky-800 min-w-[52px]">Note</th>
                      </tr>
                      <tr className="bg-sky-700 border-b border-slate-600 sticky top-[44px] z-10">
                        {quarterGroups.map((qg) => (
                          <React.Fragment key={qg.key}>
                            <th className="px-3 py-2 text-right font-medium text-slate-100 uppercase border-l border-slate-600 min-w-[90px]">AI</th>
                            <th className="px-3 py-2 text-right font-semibold text-white uppercase min-w-[100px]">Adjusted</th>
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {filteredRows.length === 0
                        ? <tr><td colSpan={99}><EmptyState label="No CAPEX items found."/></td></tr>
                        : filteredRows.map((row) => {
                            const avCls  = avatarClass(row.capex_item);
                            const qCells = quarterGroups.map((qg) => ({
                              ai:  qg.monthIdxs.reduce((s, mi) => s + toCalcNumber(row[`month${mi+1}_ai`]), 0),
                              usr: qg.monthIdxs.reduce((s, mi) => s + toCalcNumber(row[`month${mi+1}_adjusted`]), 0),
                            }));
                            const totalAi  = qCells.reduce((s, c) => s + c.ai,  0);
                            const totalAdj = qCells.reduce((s, c) => s + c.usr, 0);
                            const changed  = totalAdj !== totalAi;
                            const isRoiPanel = roiPanelItem === row.capex_item;
                            return (
                              <React.Fragment key={row.capex_item}>
                                <tr className="cx-row border-b border-slate-100 transition-colors">
                                  <td className="px-4 py-2.5 sticky left-0 border-r border-slate-200 z-[5] bg-white">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${avCls}`}>{getInitials(row.capex_item)}</div>
                                      <span className="font-bold text-slate-900">{row.capex_item}</span>
                                      {changed && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" title="Has adjustments"/>}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 bg-white">{fmt(row.previous_month_raw ?? row.previous_month)}</td>
                                  {qCells.map((c, qi) => (
                                    <React.Fragment key={qi}>
                                      <td className="px-3 py-2 text-right text-slate-500 tabular-nums border-l border-slate-100">{fmt(c.ai)}</td>
                                      <td className={`px-3 py-2 text-right font-bold tabular-nums ${c.usr > c.ai ? "text-red-500" : c.usr < c.ai ? "text-emerald-600" : "text-sky-700"}`}>{fmt(c.usr)}</td>
                                    </React.Fragment>
                                  ))}
                                  <td className="px-2 py-1.5 border-l border-slate-100 text-center">
                                    {row.roi && (
                                      <button onClick={() => setRoiPanelItem(isRoiPanel ? null : row.capex_item)}
                                        className={`flex items-center gap-1 px-2 py-1 rounded-lg font-semibold transition-all border ${isRoiPanel ? "bg-sky-600 text-white border-sky-600" : "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100"}`}>
                                        <FiInfo size={10}/> ROI
                                      </button>
                                    )}
                                  </td>
                                  <td className="px-1.5 py-1.5 text-center border-l border-slate-100">
                                    <InlineCommentIcon
                                      commentKey={`overall-${row.capex_item}`}
                                      value={summaryRowComments[row.capex_item]}
                                      disabled={!canEdit}
                                      onChange={(v) => { setSummaryRowComments((p) => ({...p, [row.capex_item]: v})); setHasChanges(true); }}
                                      label={`${row.capex_item} — Overall Note`}
                                      isOverall
                                    />
                                  </td>
                                </tr>
                                {isRoiPanel && row.roi && (
                                  <tr className="border-b border-sky-100 bg-white">
                                    <td colSpan={99} className="px-6 py-3 bg-white">
                                      <div className="flex items-center gap-6 flex-wrap">
                                        <span className="font-semibold text-sky-800 flex items-center gap-1.5"><FiTrendingUp size={12}/> ROI — {row.capex_item}</span>
                                        {[
                                          { label: "ROI %",          value: fmtPct(row.roi.roi_percent),           color: row.roi.roi_percent >= 0 ? "text-emerald-600" : "text-red-500" },
                                          { label: "NPV",            value: fmt(row.roi.npv),                     color: (row.roi.npv||0) >= 0 ? "text-emerald-600" : "text-red-500" },
                                          { label: "Payback Period", value: `${row.roi.payback_period_years} yrs`, color: "text-sky-700" },
                                          { label: "Annual Benefit", value: fmt(row.roi.annual_benefit),          color: "text-teal-600" },
                                        ].map((item) => (
                                          <div key={item.label} className="flex flex-col items-center bg-white border border-sky-100 rounded-xl px-4 py-2 min-w-[90px]">
                                            <span className="text-slate-400 font-medium">{item.label}</span>
                                            <span className={`text-s font-bold tabular-nums ${item.color}`}>{item.value}</span>
                                          </div>
                                        ))}
                                        <button onClick={() => setRoiPanelItem(null)} className="ml-auto text-slate-400 hover:text-sky-700 transition-colors"><FiX size={14}/></button>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-sky-900 text-white sticky bottom-0 z-10 font-semibold">
                        <td className="px-4 py-3 text-s sticky left-0 bg-sky-900 border-r border-sky-700 z-[9]">GRAND TOTAL</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmt(totalsData.prev)}</td>
                        {quarterGroups.map((qg, qi) => {
                          const ai  = qg.monthIdxs.reduce((s, mi) => s + (totalsData.monthTotals[mi]?.ai  || 0), 0);
                          const usr = qg.monthIdxs.reduce((s, mi) => s + (totalsData.monthTotals[mi]?.usr || 0), 0);
                          return (
                            <React.Fragment key={qi}>
                              <td className="px-3 py-3 text-right tabular-nums border-l border-sky-700 bg-sky-800">{fmt(ai)}</td>
                              <td className="px-3 py-3 text-right tabular-nums text-s font-bold bg-sky-800">{fmt(usr)}</td>
                            </React.Fragment>
                          );
                        })}
                        <td className="px-3 py-3 border-l border-sky-700"/>
                        <td className="px-3 py-3 border-l border-sky-700">
                          <span className={`font-bold tabular-nums ${variance > 0 ? "text-red-400" : "text-emerald-400"}`}>
                            {variance >= 0 ? "+" : ""}{fmt(variance)} ({varPct}%)
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                /* ── Monthly Breakdown View ── */
                <div className="analytics-table-scroll overflow-x-auto max-h-[72vh] overflow-y-auto">
                  <table className="w-full min-w-[1700px] border-collapse text-sm">
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-sky-800 border-b border-sky-700">
                        <th rowSpan={2} className="px-4 py-3 text-left font-semibold text-white uppercase tracking-wide border-r border-sky-700 sticky left-0 bg-sky-800 z-30 min-w-[200px]">CAPEX Item</th>
                        <th rowSpan={2} className="px-4 py-3 text-right font-semibold text-white uppercase min-w-[100px]">Prev Month</th>
                        {months.map((m, mi) => (
                          <th key={m} colSpan={3} className={`px-4 py-2.5 text-center font-semibold border-l text-white border-sky-700 bg-sky-800 ${monthTheme[mi % 3].label}`}>{m}</th>
                        ))}
                        <th colSpan={2} className="px-4 py-2.5 text-center font-semibold text-slate-50 border-l border-sky-700 bg-sky-900">Quarter Total</th>
                        <th className="px-4 py-2.5 text-center font-semibold text-slate-50 border-l border-sky-700 bg-sky-800 min-w-[80px]">ROI</th>
                        <th className="px-4 py-2.5 text-center font-semibold text-slate-50 border-l border-sky-700 bg-sky-800 min-w-[52px]">Note</th>
                      </tr>
                      <tr className="bg-sky-700 border-b border-slate-600 sticky top-[44px] z-10">
                        {months.map((_, mi) => (
                          <React.Fragment key={mi}>
                            <th className="px-3 py-2 text-right font-medium text-slate-100 uppercase border-l border-slate-600 min-w-[90px]">AI</th>
                            <th className="px-3 py-2 text-right font-semibold text-white uppercase min-w-[100px]">Adjusted</th>
                            <th className="px-2 py-2 text-center font-medium text-slate-100 uppercase min-w-[42px]">
                              <FiMessageSquare size={11} className="mx-auto opacity-70"/>
                            </th>
                          </React.Fragment>
                        ))}
                        <th className="px-3 py-2 text-right font-medium text-white uppercase border-l border-slate-600 min-w-[85px]">AI</th>
                        <th className="px-3 py-2 text-right font-semibold text-white uppercase min-w-[85px]">Adj</th>
                        <th className="px-3 py-2 border-l border-slate-600"/>
                        <th className="px-2 py-2 text-center border-l border-slate-600">
                          <FiMessageSquare size={11} className="mx-auto opacity-70 text-slate-100"/>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {filteredRows.length === 0
                        ? <tr><td colSpan={99}><EmptyState label="No CAPEX items found."/></td></tr>
                        : filteredRows.map((row, idx) => {
                            const origIdx  = rows.findIndex((r) => r.capex_item === row.capex_item);
                            const avCls    = avatarClass(row.capex_item);
                            const qAi      = months.reduce((s, _, mi) => s + (row[`month${mi+1}_ai`] || 0), 0);
                            // toCalcNumber, not `|| 0`: an adjusted cell can hold the raw string
                            // the user is mid-typing, and `0 + "<string>"` concatenates instead of adding.
                            const qAdj     = months.reduce((s, _, mi) => s + toCalcNumber(row[`month${mi+1}_adjusted`]), 0);
                            const changed  = qAdj !== qAi;
                            const qAiDisplay  = row.quarter_total_ai_raw  != null && row.quarter_total_ai_raw  !== "" ? fmt(row.quarter_total_ai_raw)  : fmt(qAi);
                            // Adjusted quarter total is always the live sum of the (possibly
                            // just-edited) monthly Adjusted cells — never the server's stale
                            // `quarter_total_adjusted_raw`, which doesn't move as the user types.
                            const qAdjDisplay = fmt(qAdj);
                            const isRoiPanel  = roiPanelItem === row.capex_item;
                            return (
                              <React.Fragment key={row.capex_item}>
                                <tr className="cx-row border-b border-slate-100 transition-colors">
                                  <td className="px-4 py-2.5 sticky left-0 border-r border-slate-200 z-[5] bg-white">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${avCls}`}>{getInitials(row.capex_item)}</div>
                                      <span className="font-bold text-slate-900">{row.capex_item}</span>
                                      {changed && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" title="Has adjustments"/>}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 bg-white">{fmt(row.previous_month_raw ?? row.previous_month)}</td>

                                  {/* Month columns */}
                                  {months.map((_, mi) => {
                                    const m   = mi + 1;
                                    const ai  = row[`month${m}_ai`];
                                    const adj = row[`month${m}_adjusted`];
                                    const cellChanged = adj !== ai && ai != null;
                                    const ck  = `${row.capex_item}-month${m}`;
                                    const th  = monthTheme[mi % 3];
                                    const cellKey = `summary-${origIdx}-month${m}`;
                                    return (
                                      <React.Fragment key={m}>
                                        <td className={`px-3 py-2 text-right text-slate-500 tabular-nums border-l border-slate-100 ${th.bg}`}>{fmt(row[`month${m}_ai_raw`] ?? ai)}</td>
                                        <td className={`px-2 py-1.5 ${th.bg}`}>
                                          <input type="number" value={displayEditableNumber(adj, focusedCellKey === cellKey)} step={Math.pow(10, -getDecimalPrecision())} disabled={!canEdit}
                                            onFocus={(e) => { setFocusedCellKey(cellKey); focusValuesRef.current[cellKey] = adj; e.target.select(); }}
                                            onBlur={() => handleAdjBlur(origIdx, m)}
                                            onChange={(e) => handleAdjChange(origIdx, `month${m}_adjusted`, e.target.value)}
                                            className={`w-full px-2 py-1.5 rounded-lg border text-right tabular-nums outline-none transition-all
                                              ${!canEdit?"bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200"
                                                :cellChanged?"border-blue-400 bg-blue-50 text-blue-900 focus:ring-2 ring-blue-100"
                                                :"border-slate-300 bg-white hover:border-slate-400 focus:border-blue-500 focus:ring-2 ring-blue-100"}`}/>
                                        </td>
                                        <td className={`px-1.5 py-1.5 text-center ${th.bg}`}>
                                          <InlineCommentIcon
                                            commentKey={ck}
                                            value={summaryComments[ck]}
                                            disabled={!canEdit}
                                            onChange={(v) => { setSummaryComments((p) => ({...p,[ck]:v})); setHasChanges(true); }}
                                            label={`${row.capex_item} — ${months[mi]}`}
                                          />
                                        </td>
                                      </React.Fragment>
                                    );
                                  })}

                                  {/* Quarter totals */}
                                  <td className="px-3 py-2 text-right text-slate-500 tabular-nums border-l border-slate-200 bg-white">{qAiDisplay}</td>
                                  <td className={`px-3 py-2 text-right font-bold tabular-nums ${qAdj>qAi?"text-red-500":qAdj<qAi?"text-emerald-600":"text-sky-700"}`}>{qAdjDisplay}</td>

                                  {/* ROI */}
                                  <td className="px-2 py-1.5 border-l border-slate-100 text-center">
                                    {row.roi && (
                                      <button onClick={() => setRoiPanelItem(isRoiPanel ? null : row.capex_item)}
                                        className={`flex items-center gap-1 px-2 py-1 rounded-lg font-semibold transition-all border ${isRoiPanel?"bg-sky-600 text-white border-sky-600":"bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100"}`}>
                                        <FiInfo size={10}/> ROI
                                      </button>
                                    )}
                                  </td>

                                  {/* Overall note */}
                                  <td className="px-1.5 py-1.5 text-center border-l border-slate-100">
                                    <InlineCommentIcon
                                      commentKey={`overall-${row.capex_item}`}
                                      value={summaryRowComments[row.capex_item]}
                                      disabled={!canEdit}
                                      onChange={(v) => { setSummaryRowComments((p) => ({...p,[row.capex_item]:v})); setHasChanges(true); }}
                                      label={`${row.capex_item} — Overall Note`}
                                      isOverall
                                    />
                                  </td>
                                </tr>

                                {isRoiPanel && row.roi && (
                                  <tr className="border-b border-sky-100 bg-white">
                                    <td colSpan={99} className="px-6 py-3 bg-white">
                                      <div className="flex items-center gap-6 flex-wrap">
                                        <span className="font-semibold text-sky-800 flex items-center gap-1.5"><FiTrendingUp size={12}/> ROI — {row.capex_item}</span>
                                        {[
                                          { label: "ROI %",          value: fmtPct(row.roi.roi_percent),           color: row.roi.roi_percent >= 0 ? "text-emerald-600" : "text-red-500" },
                                          { label: "NPV",            value: fmt(row.roi.npv),                     color: (row.roi.npv||0) >= 0 ? "text-emerald-600" : "text-red-500" },
                                          { label: "Payback Period", value: `${row.roi.payback_period_years} yrs`, color: "text-sky-700" },
                                          { label: "Annual Benefit", value: fmt(row.roi.annual_benefit),          color: "text-teal-600" },
                                        ].map((item) => (
                                          <div key={item.label} className="flex flex-col items-center bg-white border border-sky-100 rounded-xl px-4 py-2 min-w-[90px]">
                                            <span className="text-slate-400 font-medium">{item.label}</span>
                                            <span className={`text-s font-bold tabular-nums ${item.color}`}>{item.value}</span>
                                          </div>
                                        ))}
                                        <button onClick={() => setRoiPanelItem(null)} className="ml-auto text-slate-400 hover:text-sky-700 transition-colors"><FiX size={14}/></button>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                    </tbody>

                    {/* Footer */}
                    <tfoot>
                      <tr className="bg-sky-900 text-white sticky bottom-0 z-10 font-semibold">
                        <td className="px-4 py-3 text-s sticky left-0 bg-sky-900 border-r border-sky-700 z-[9]">GRAND TOTAL</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmt(totalsData.prev)}</td>
                        {totalsData.monthTotals.map(({ ai, usr }, i) => (
                          <React.Fragment key={i}>
                            <td className="px-3 py-3 text-right tabular-nums border-l border-sky-700 bg-sky-800">{fmt(ai)}</td>
                            <td className="px-3 py-3 text-right tabular-nums text-s font-bold bg-sky-800">{fmt(usr)}</td>
                            <td className="px-3 py-3 bg-sky-800"/>
                          </React.Fragment>
                        ))}
                        <td className="px-3 py-3 text-right tabular-nums border-l border-sky-700">{fmt(totalsData.aiTotal)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-s font-bold">{fmt(totalsData.usrTotal)}</td>
                        <td className="px-3 py-3 border-l border-sky-700"/>
                        <td className="px-3 py-3 border-l border-sky-700">
                          <span className={`font-bold tabular-nums ${variance>0?"text-red-400":"text-emerald-400"}`}>
                            {variance>=0?"+":""}{fmt(variance)} ({varPct}%)
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
            {viewType !== "quarter_summary" && (
              <SaveBar hasChanges={hasChanges} saving={saving} onSave={handleSave} disabled={!canEdit}
                label="Save CAPEX Adjustments"/>
            )}
          </div>
        )}

        {/* ══ DRIVERS TAB ════════════════════════════════════════════ */}
        {activeTab === "drivers" && (
          <div>
            {loading ? <Spinner label="Loading drivers…"/> : driverItems.length === 0
              ? <EmptyState label="No driver data available for this period."/>
              : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="analytics-table-scroll overflow-x-auto max-h-[66vh] overflow-y-auto">
                    {viewType === "quarter_summary" && quarterGroups ? (
                    /* ── QUARTER SUMMARY ── */
                    <table className="w-full min-w-[600px] border-collapse text-sm">
                      <thead className="sticky top-0 z-20">
                        <tr className="bg-sky-800 border-b border-sky-700">
                          <th className="sticky left-0 z-30 bg-sky-800 px-4 py-3 text-left font-semibold text-white uppercase tracking-wide border-r border-sky-700 min-w-[200px]">CAPEX Item</th>
                          {quarterGroups.map((qg, qi) => (
                            <th key={qg.key} colSpan={2} className={`px-4 py-2.5 text-center font-semibold text-white border-l border-sky-700 bg-sky-800 ${monthTheme[qi % 3].label}`}>{qg.label}</th>
                          ))}
                          <th colSpan={2} className="px-4 py-2.5 text-center font-semibold text-white border-l border-sky-700 bg-sky-900">Total CAPEX</th>
                        </tr>
                        <tr className="bg-sky-700 border-b border-slate-600 sticky top-[32px] z-10">
                          <th className="sticky left-0 z-30 bg-sky-700 border-r border-slate-600"/>
                          {quarterGroups.map((qg) => (
                            <React.Fragment key={qg.key}>
                              <th className="px-3 py-2 text-right font-medium text-white uppercase whitespace-nowrap border-l border-slate-600">CAPEX AI</th>
                              <th className="px-3 py-2 text-right font-semibold text-white uppercase whitespace-nowrap">CAPEX Adj</th>
                            </React.Fragment>
                          ))}
                          <th className="px-3 py-2 text-right font-medium text-white uppercase border-l border-slate-600">AI</th>
                          <th className="px-3 py-2 text-right font-semibold text-white uppercase">Adj</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {driverItems.map((itemName) => {
                          const avCls  = avatarClass(itemName);
                          const firstD = drivers.find((x) => x.capex_item === itemName);
                          const qCells = quarterGroups.map((qg) => {
                            let ai = 0, adj = 0;
                            qg.monthIdxs.forEach((mi) => {
                              const monthKey = monthPeriods[mi]?.iso || getMonthKey(forecastYear, mi);
                              const d = drivers.find((x) => x.capex_item === itemName && x.month === monthKey);
                              if (d) { ai += d.capex_ai || 0; adj += d.capex_adjusted ?? d.capex_ai ?? 0; }
                            });
                            return { key: qg.key, ai, adj };
                          });
                          const totalAi  = qCells.reduce((s, q) => s + q.ai,  0);
                          const totalAdj = qCells.reduce((s, q) => s + q.adj, 0);
                          return (
                            <tr key={itemName} className="cx-row border-b border-slate-100 transition-colors bg-white">
                              <td className="sticky left-0 z-[5] border-r border-slate-200 px-4 py-2.5 bg-white">
                                <div className="flex items-center gap-2">
                                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${avCls}`}>{getInitials(itemName)}</div>
                                  <div>
                                    <span className="font-bold text-slate-900 whitespace-nowrap">{itemName}</span>
                                    {firstD?.roi && <div className="mt-0.5"><RoiBadge roi={firstD.roi}/></div>}
                                  </div>
                                </div>
                              </td>
                              {qCells.map((qc, qi) => (
                                <React.Fragment key={qc.key}>
                                  <td className={`px-3 py-2 text-right text-sky-700 font-semibold tabular-nums border-l border-slate-100 ${monthTheme[qi % 3].bg}`}>{fmt(qc.ai)}</td>
                                  <td className={`px-3 py-2 text-right tabular-nums ${monthTheme[qi % 3].bg} ${qc.adj!==qc.ai?"text-blue-700 font-bold":"text-slate-500"}`}>{fmt(qc.adj)}</td>
                                </React.Fragment>
                              ))}
                              <td className="px-3 py-2 text-right text-slate-500 tabular-nums border-l border-slate-200 bg-slate-50">{fmt(totalAi)}</td>
                              <td className={`px-3 py-2 text-right font-bold tabular-nums ${totalAdj>totalAi?"text-red-500":totalAdj<totalAi?"text-emerald-600":"text-sky-700"}`}>{fmt(totalAdj)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    ) : (
                    /* ── MONTHLY BREAKDOWN ── */
                    <table className="w-full min-w-[1900px] border-collapse text-sm">
                      <thead className="sticky top-0 z-20">
                        <tr className="bg-sky-800 border-b border-sky-700">
                          <th className="sticky left-0 z-30 bg-sky-800 px-4 py-3 text-left font-semibold text-white uppercase tracking-wide border-r border-sky-700 min-w-[200px]">CAPEX Item</th>
                          {months.map((m, mi) => (
                            <th key={m} colSpan={7} className={`px-4 py-2.5 text-center font-semibold text-white border-l border-sky-700 bg-sky-800 ${monthTheme[mi % 3].label}`}>{m}</th>
                          ))}
                          <th colSpan={2} className="px-4 py-2.5 text-center font-semibold text-white border-l border-sky-700 bg-sky-900">Total CAPEX</th>
                        </tr>
                        <tr className="bg-sky-700 border-b border-slate-600 sticky top-[32px] z-10">
                          <th className="sticky left-0 z-30 bg-sky-700 border-r border-slate-600"/>
                          {months.map((_, mi) => (
                            <React.Fragment key={mi}>
                              {["Units AI","Units Adj","Rate AI","Rate Adj","CAPEX AI","CAPEX Adj",""].map((h, hi) => (
                                <th key={hi} className={`px-3 py-2 font-medium text-white uppercase whitespace-nowrap ${hi===0?"border-l border-slate-600 text-right":hi===6?"text-center w-10":"text-right"}`}>
                                  {hi===6 ? <FiMessageSquare size={11} className="mx-auto opacity-70"/> : h}
                                </th>
                              ))}
                            </React.Fragment>
                          ))}
                          <th className="px-3 py-2 text-right font-medium text-white uppercase border-l border-slate-600">AI</th>
                          <th className="px-3 py-2 text-right font-semibold text-white uppercase">Adj</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {driverItems.map((itemName, rowIdx) => {
                          const avCls = avatarClass(itemName);
                          let qCapexAi = 0, qCapexAdj = 0;

                          const cells = months.map((_, mi) => {
                            const monthKey = monthPeriods[mi]?.iso || getMonthKey(forecastYear, mi);
                            const d       = drivers.find((x) => x.capex_item === itemName && x.month === monthKey);
                            const origIdx = drivers.findIndex((x) => x.capex_item === itemName && x.month === monthKey);
                            const th  = monthTheme[mi % 3];
                            const ck  = `${itemName}-${monthKey}`;
                            // toCalcNumber, not `??`/`+`: capex_adjusted can be a raw string
                            // mid-edit, and `0 + "<string>"` would concatenate instead of adding.
                            if (d) { qCapexAi += d.capex_ai || 0; qCapexAdj += toCalcNumber(d.capex_adjusted ?? d.capex_ai); }
                            if (!d) return (
                              <React.Fragment key={mi}>
                                {Array(7).fill(0).map((_,i) => <td key={i} className={`px-3 py-2 text-center text-slate-300 ${i===0?"border-l border-slate-100":""} ${th.bg}`}>—</td>)}
                              </React.Fragment>
                            );
                            const unitsChg = (d.units_adjusted != null && d.units_adjusted !== d.units_ai);
                            const rateChg  = (d.rate_adjusted  != null && d.rate_adjusted  !== d.rate_ai);
                            return (
                              <React.Fragment key={mi}>
                                <td className={`px-3 py-2 text-right text-slate-500 tabular-nums border-l border-slate-100 ${th.bg}`}>{d.units_ai?.toFixed(getDecimalPrecision())??"—"}</td>
                                <td className={`px-2 py-1.5 ${th.bg}`}>
                                  <input type="number" value={displayEditableNumber(d.units_adjusted, focusedCellKey === `driver-${origIdx}-units`)} step={Math.pow(10, -getDecimalPrecision())} disabled={!canEdit}
                                    onFocus={(e) => { setFocusedCellKey(`driver-${origIdx}-units`); e.target.select(); }}
                                    onBlur={() => setFocusedCellKey(null)}
                                    onChange={(e)=>handleDriverChange(origIdx,"units_adjusted",e.target.value)}
                                    className={`w-24 px-2 py-1 rounded-lg border text-right tabular-nums outline-none transition-all
                                      ${!canEdit?"bg-slate-50 border-slate-200 cursor-not-allowed text-slate-400"
                                        :unitsChg?"border-blue-400 bg-blue-50 text-blue-900 focus:ring-2 ring-blue-100"
                                        :"border-slate-300 bg-white hover:border-slate-400 focus:border-blue-500 focus:ring-2 ring-blue-100"}`}/>
                                </td>
                                <td className={`px-3 py-2 text-right text-slate-500 tabular-nums ${th.bg}`}>${d.rate_ai?.toFixed(getDecimalPrecision())??"—"}</td>
                                <td className={`px-2 py-1.5 ${th.bg}`}>
                                  <input type="number" value={displayEditableNumber(d.rate_adjusted, focusedCellKey === `driver-${origIdx}-rate`)} step={Math.pow(10, -getDecimalPrecision())} disabled={!canEdit}
                                    onFocus={(e) => { setFocusedCellKey(`driver-${origIdx}-rate`); e.target.select(); }}
                                    onBlur={() => setFocusedCellKey(null)}
                                    onChange={(e)=>handleDriverChange(origIdx,"rate_adjusted",e.target.value)}
                                    className={`w-20 px-2 py-1 rounded-lg border text-right tabular-nums outline-none transition-all
                                      ${!canEdit?"bg-slate-50 border-slate-200 cursor-not-allowed text-slate-400"
                                        :rateChg?"border-blue-400 bg-blue-50 text-blue-900 focus:ring-2 ring-blue-100"
                                        :"border-slate-300 bg-white hover:border-slate-400 focus:border-blue-500 focus:ring-2 ring-blue-100"}`}/>
                                </td>
                                <td className={`px-3 py-2 text-right text-sky-700 font-semibold tabular-nums ${th.bg}`}>{fmt(d.capex_ai)}</td>
                                <td className={`px-3 py-2 text-right tabular-nums ${th.bg} ${d.capex_adjusted!=null&&d.capex_adjusted!==d.capex_ai?"text-blue-700 font-semibold":"text-slate-500"}`}>
                                  {fmt(d.capex_adjusted ?? d.capex_ai)}
                                </td>
                                <td className={`px-1.5 py-1.5 text-center ${th.bg}`}>
                                  <InlineCommentIcon
                                    commentKey={ck}
                                    value={driverComments[ck]}
                                    disabled={!canEdit}
                                    onChange={(v)=>{ setDriverComments((p)=>({...p,[ck]:v})); setDriverHasChanges(true); }}
                                    label={`${itemName} — ${months[mi]}`}
                                  />
                                </td>
                              </React.Fragment>
                            );
                          });

                          const firstD = drivers.find((x) => x.capex_item === itemName);
                          return (
                            <tr key={itemName} className="cx-row border-b border-slate-100 transition-colors bg-white">
                              <td className="sticky left-0 z-[5] border-r border-slate-200 px-4 py-2.5 bg-white">
                                <div className="flex items-center gap-2">
                                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${avCls}`}>{getInitials(itemName)}</div>
                                  <div>
                                    <span className="font-bold text-slate-900 whitespace-nowrap">{itemName}</span>
                                    {firstD?.roi && (
                                      <div className="mt-0.5">
                                        <RoiBadge roi={firstD.roi}/>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              {cells}
                              <td className="px-3 py-2 text-right text-slate-500 tabular-nums border-l border-slate-200 bg-white">{fmt(qCapexAi)}</td>
                              <td className={`px-3 py-2 text-right font-bold tabular-nums ${qCapexAdj>qCapexAi?"text-red-500":qCapexAdj<qCapexAi?"text-emerald-600":"text-sky-700"}`}>
                                {fmt(qCapexAdj)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    )}
                  </div>
                </div>
              )}
            <SaveBar hasChanges={driverHasChanges} saving={driverSaving} onSave={handleSaveDrivers}
              label="Save Driver Adjustments" disabled={!canEdit}/>
          </div>
        )}

        {/* ══ SCENARIOS TAB ══════════════════════════════════════════ */}
        {activeTab === "scenarios" && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="font-bold text-slate-900 text-s">CAPEX Forecast Scenarios</h2>
                <p className="text-slate-500 mt-0.5">Manage baseline, accelerated, delayed and custom CAPEX scenarios</p>
              </div>
              <button onClick={() => setScenarioModal({ open:true, edit:null })}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all shadow-sm">
                <FiPlus size={13}/> New Scenario
              </button>
            </div>

            {scenarioLoading ? <Spinner label="Loading scenarios…"/> : scenariosList.length === 0
              ? <EmptyState label="No scenarios found. Create your first scenario."/>
              : (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {scenariosList.map((sc) => {
                      const style    = getScStyle(sc);
                      const compData = apiData?.Compare_CAPEX_Forecast_Scenarios;
                      const baseAi   = toCalcNumber(compData?.baseline?.total_ai);
                      const multiplier = toCalcNumber(sc.multiplier) || 1;
                      const d        = compData?.[sc.scenario_name];
                      const dAi      = toCalcNumber(d?.total_ai);
                      const dUser    = toCalcNumber(d?.total_user);
                      const totalAi   = d ? dAi   : (baseAi * multiplier);
                      const totalUser = d ? dUser : (baseAi * multiplier);
                      const vAmt = d ? (toCalcNumber(d.variance_amount) || (dUser - dAi)) : (totalUser - baseAi);
                      const vPct = d?.variance_percent != null
                        ? toCalcNumber(d.variance_percent).toFixed(getDecimalPrecision())
                        : (baseAi ? ((vAmt / baseAi) * 100).toFixed(getDecimalPrecision()) : "0.0");
                      return (
                        <div key={sc.id ?? sc.scenario_name} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden">
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
                                  <p className="text-xs text-slate-400 tabular-nums">{year} · {quarter} · {sc.multiplier}×</p>
                                  {sc.parameter_types?.length > 0 && (
                                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                                      {sc.parameter_types.map((pt) => (
                                        <span key={pt} className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200 capitalize">{pt}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="relative">
                                <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId===(sc.id??sc.scenario_name)?null:(sc.id??sc.scenario_name)); }}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-sky-700 transition-colors">
                                  <FiMoreVertical size={14}/>
                                </button>
                                {openMenuId===(sc.id??sc.scenario_name) && (
                                  <div className="absolute right-0 top-8 z-20 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden w-32" onClick={(e)=>e.stopPropagation()}>
                                    <button onClick={()=>{setScenarioModal({open:true,edit:sc});setOpenMenuId(null);}} disabled={sc.is_system&&!sc.id}
                                      className="flex items-center gap-2 w-full px-3 py-2.5 text-sky-700 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                      <FiEdit2 size={12}/> Edit
                                    </button>
                                    <button onClick={()=>{setDeleteModal({open:true,scenario:sc});setOpenMenuId(null);}} disabled={sc.is_system}
                                      className="flex items-center gap-2 w-full px-3 py-2.5 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed border-t border-slate-100">
                                      <FiTrash2 size={12}/> Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200">
                                <p className="text-slate-500 font-medium mb-0.5">AI Total</p>
                                <p className="text-s font-bold text-sky-700 tabular-nums">{fmt(totalAi)}</p>
                              </div>
                              <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200">
                                <p className="text-slate-500 font-medium mb-0.5">Adjusted</p>
                                <p className="text-s font-bold text-slate-900 tabular-nums">{fmt(totalUser)}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 border border-slate-200">
                              <span className="text-xs text-slate-500 font-medium">Variance</span>
                              <span className={`font-bold tabular-nums ${Number(vAmt)>0?"text-red-600":"text-emerald-600"}`}>
                                {Number(vAmt)>=0?"+":""}{fmt(vAmt)} ({vPct}%)
                              </span>
                            </div>
                            {sc.description && <p className="text-slate-500 mt-2.5 leading-relaxed line-clamp-2">{sc.description}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                      <FiBarChart2 className="text-slate-500" size={14}/>
                      <span className="font-semibold text-sky-800 text-s">Scenario Comparison — {year} {quarter}</span>
                      <span className="ml-auto text-xs text-slate-400 tabular-nums">{scenariosList.length} scenarios</span>
                    </div>
                    <div className="analytics-table-scroll overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-4 py-3 text-left text-s font-semibold text-slate-500 uppercase tracking-wide">Metric</th>
                            {scenariosList.map((sc) => (
                              <th key={sc.id??sc.scenario_name} className="px-4 py-3 text-right text-s font-semibold text-sky-700 capitalize tracking-wide">
                                {sc.scenario_name.replace(/_/g," ")}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {[
                            { label:"Multiplier",    fn:(sc)=>`${sc.multiplier}×` },
                            { label:"AI Total",      fn:(sc)=>{ const c=apiData?.Compare_CAPEX_Forecast_Scenarios; const b=toCalcNumber(c?.baseline?.total_ai); const d=c?.[sc.scenario_name]; return fmt(toCalcNumber(d?.total_ai)||(b*(toCalcNumber(sc.multiplier)||1))); } },
                            { label:"User Forecast", fn:(sc)=>{ const c=apiData?.Compare_CAPEX_Forecast_Scenarios; const b=toCalcNumber(c?.baseline?.total_ai); const d=c?.[sc.scenario_name]; return fmt(toCalcNumber(d?.total_user)||(b*(toCalcNumber(sc.multiplier)||1))); }, bold:true },
                            { label:"Variance ($)",  fn:(sc)=>{ const c=apiData?.Compare_CAPEX_Forecast_Scenarios; const d=c?.[sc.scenario_name]; if(!d)return"—"; const dAi=toCalcNumber(d.total_ai); const dUser=toCalcNumber(d.total_user); const v=toCalcNumber(d.variance_amount)||(dUser-dAi); return <span className={v>0?"text-red-600 font-bold":"text-emerald-600 font-bold"}>{v>=0?"+":""}{fmt(v)}</span>; } },
                            { label:"Variance (%)",  fn:(sc)=>{ const c=apiData?.Compare_CAPEX_Forecast_Scenarios; const d=c?.[sc.scenario_name]; if(!d)return"—"; const v=toCalcNumber(d.variance_percent); return <span className={v>0?"text-red-600 font-bold":"text-emerald-600 font-bold"}>{v>=0?"+":""}{v.toFixed(getDecimalPrecision())}%</span>; } },
                            { label:"Parameters",    fn:(sc)=>sc.parameter_types?.join(", ")||"—" },
                          ].map((row) => (
                            <tr key={row.label} className="border-b border-slate-100 bg-white">
                              <td className="px-4 py-3 font-medium text-sky-700 text-s">{row.label}</td>
                              {scenariosList.map((sc) => (
                                <td key={sc.id??sc.scenario_name} className={`px-4 py-3 text-right tabular-nums text-s ${row.bold?"font-bold text-slate-900":"text-slate-600"}`}>{row.fn(sc)}</td>
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

        <OverallChat year={year} quarter={quarter} token={token} API_BASE={API_BASE} addToast={addToast}/>
      </main>
    </div>
  );
}
