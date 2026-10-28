// HeadcountPayrollForecasting.jsx
import React, { useState, useRef, useEffect, useCallback, useContext, useMemo } from "react";
import {
  FiRefreshCw, FiDownload, FiUpload, FiSearch, FiX,
  FiTrendingUp, FiBarChart2, FiSettings, FiUsers,
  FiAlertCircle, FiPlus, FiEdit2, FiTrash2, FiMoreVertical, FiFilter,
} from "react-icons/fi";

import { AuthContext } from "../../context/AuthContext";
import { BudgetYearContext } from "../../context/BudgetYearContext";
import { useCurrentQuarter } from "../../hooks/useCurrentQuarter";
import { API_BASE_URL } from "../../config/config";

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

import {
  getQuarterMonths, STAGE_LABELS, STAGE_CONFIG,
  fmt, fmtNum, parseApiError, getInitials, avatarClass,
  useToast, ToastContainer, Spinner, EmptyState,
  CenterErrorModal, WorkflowModal, WorkflowProgress,
  KpiCards, SaveBar,
  ScenarioModal, ExcelUploadPreviewModal, OverallChat,
} from "./HeadcountPayrollHelpers";
import TableSkeleton from "../Skeleton/TableSkeleton";
import { InlineCommentIcon } from "./RevenueForecastHelpers";
import { getDecimalPrecision } from '../../utils/formatters';

// NOTE: backend typo "managemet" kept as-is
const API_BASE = `${API_BASE_URL}/api/v1/forecasting/managemet/headcount_and_Payroll_forecast`;

const TABS = [
  { id: "summary",   label: "Payroll Summary", icon: <FiBarChart2 size={13}/> },
  { id: "headcount", label: "Headcount",        icon: <FiUsers size={13}/>    },
  { id: "drivers",   label: "Drivers",          icon: <FiSettings size={13}/> },
  { id: "scenarios", label: "Scenarios",        icon: <FiTrendingUp size={13}/> },
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

const monthTheme = [
  { bg: "bg-white", label: "text-white" },
  { bg: "bg-white", label: "text-white" },
  { bg: "bg-white", label: "text-white" },
];

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
              {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</> : "💾 Save & Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ApplyAllMonthsModal ──────────────────────────────────────────────────────
// Shown when the user edits an employee salary/bonus/benefits Adjusted cell
// (or a department headcount Adjusted cell) and blurs it with the value
// actually changed — offers to propagate that value to all 12 months.
function ApplyAllMonthsModal({ open, label, value, isCount, applying, onYes, onNo }) {
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
                Would you like to apply this Adjusted value ({isCount ? value : fmt(value)}) to all 12 months for <span className="font-semibold text-sky-800">{label}</span>?
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

// ─── TabActionButtons ─────────────────────────────────────────────────────────
function TabActionButtons({ activeTab, year, quarter, token, canEdit, onSuccess, addToast }) {
  const [empUploadOpen,    setEmpUploadOpen]    = useState(false);
  const [driverUploadOpen, setDriverUploadOpen] = useState(false);
  const [uploading,        setUploading]        = useState(false);
  const [uploadError,      setUploadError]      = useState(null);
  const [downloading,      setDownloading]      = useState(null);

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
      a.download = type === "employee-adjustments"
        ? `payroll_employee_adjustments_${year}_${quarter}.xlsx`
        : `payroll_driver_adjustments_${year}_${quarter}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      addToast("Template downloaded ✓", "success");
    } catch (e) { addToast(`Download failed: ${e.message}`, "error"); }
    finally { setDownloading(null); }
  };

  // Called by ExcelUploadPreviewModal with (possibly edited) File object
  const handleExcelUpload = async (file, type) => {
    setUploading(true); setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const endpoint = type === "employee"
        ? `${API_BASE}/${year}/excel-upload/employee-adjustments?quarter=${quarter}`
        : `${API_BASE}/${year}/excel-upload/driver-adjustments?quarter=${quarter}`;
      const res = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      if (!res.ok) throw new Error(await parseApiError(res));
      addToast(`${type === "employee" ? "Employee" : "Driver"} adjustments uploaded ✓`, "success");
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
        <button onClick={() => downloadTemplate("employee-adjustments")} disabled={downloading === "employee-adjustments"}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-sky-700 text-x font-semibold transition-all disabled:opacity-60">
          {downloading === "employee-adjustments" ? <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"/> : <FiDownload size={12}/>}
          Download Template
        </button>
        {canEdit && (
          <button onClick={() => { setUploadError(null); setEmpUploadOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-x font-semibold transition-all shadow-sm">
            <FiUpload size={12}/> Upload Excel
          </button>
        )}
      </div>
      <ExcelUploadPreviewModal open={empUploadOpen} onClose={() => setEmpUploadOpen(false)}
        title="Employee Adjustments Upload"
        uploading={uploading} uploadError={uploadError}
        onUpload={(f) => handleExcelUpload(f, "employee")}/>
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
        title="Driver Adjustments Upload"
        uploading={uploading} uploadError={uploadError}
        onUpload={(f) => handleExcelUpload(f, "driver")}/>
    </>
  );
  return null;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function HeadcountPayrollForecasting() {
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

  const [quarter,   setQuarter]   = useCurrentQuarter(fiscalYearStartMonth);
  const [currencyFilter, setCurrencyFilter] = useState("actualvalue");
  const [activeTab, setActiveTab] = useState("summary");

  /* Forecast creation mode — which view is the "source of truth" input
     surface for payroll. Payroll Summary and Drivers data are kept
     numerically in sync (see handleEmpFieldChange / handleDriverFieldChange
     below) regardless of mode. Does not affect the independent Headcount
     tab. */
  const [forecastMode, setForecastMode] = useState("summary"); // summary | drivers

  const [forecastType,      setForecastType]      = useState("quarter");
  const [viewType,          setViewType]          = useState("monthly_breakdown");

  // ── API state ───────────────────────────────────────────────────────────
  const [apiData,       setApiData]       = useState(null);
  const [employees,     setEmployees]     = useState([]);   // summary tab rows
  const [deptRows,      setDeptRows]      = useState([]);   // headcount tab rows
  const [driverRows,    setDriverRows]    = useState([]);   // drivers tab — flat [{employee_name, month, ...}]
  const [stage,         setStage]         = useState("draft");
  const [workflowMeta,  setWorkflowMeta]  = useState({});

  // ── Edit state ──────────────────────────────────────────────────────────
  // Summary (employee) adjustments
  const [empChanges,    setEmpChanges]    = useState({});   // key: employee_name, val: {month1_adjusted_salary,...}
  const [empComments,   setEmpComments]   = useState({});   // key: `emp-month{N}` | `emp-overall`
  const [hasEmpChanges, setHasEmpChanges] = useState(false);

  // Headcount (department) adjustments
  const [deptChanges,    setDeptChanges]    = useState({});
  const [deptComments,   setDeptComments]   = useState({});
  const [hasDeptChanges, setHasDeptChanges] = useState(false);

  // Driver adjustments
  const [driverChanges,    setDriverChanges]    = useState({});   // key: `emp-YYYY-MM-DD`
  const [driverComments,   setDriverComments]   = useState({});
  const [hasDriverChanges, setHasDriverChanges] = useState(false);

  // Key of the "Adjusted" numeric input currently focused (Payroll Summary,
  // Drivers, or Department Headcount table). While a cell is focused we show
  // its raw, unrounded value so the user can fully clear it and type
  // decimals without toFixed() display formatting fighting their keystrokes.
  const [focusedCellKey, setFocusedCellKey] = useState(null);

  // Remembers each Adjusted cell's value at the moment it was focused (keyed
  // by the same cellKey used for focusedCellKey), so onBlur can tell whether
  // the user actually changed it before offering "apply to all 12 months".
  const focusValuesRef = useRef({});
  const [applyAllMonthsModal, setApplyAllMonthsModal] = useState({
    open: false, kind: null, label: null, value: null, isCount: false,
    employeeName: null, field: null, departmentName: null,
  });
  const [applyingAllMonths, setApplyingAllMonths] = useState(false);

  // ── UI state ────────────────────────────────────────────────────────────
  const [loading,         setLoading]         = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [centerError,     setCenterError]     = useState(null);
  const [modal,           setModal]           = useState({ open: false, target: null });
  const [workflowLoading, setWorkflowLoading] = useState(false);

  const [filterText, setFilterText] = useState("");
  const [filterDept, setFilterDept] = useState("");

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

  const { toasts, add: addToast } = useToast();

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

  const canEdit  = stage === "draft";
  const stageCfg = STAGE_CONFIG[stage] || STAGE_CONFIG.draft;

  const hasAnyChanges = hasEmpChanges || hasDeptChanges || hasDriverChanges;

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
      const savedSomething = hasEmpChanges || hasDeptChanges || hasDriverChanges;
      if (hasEmpChanges)    await _doSaveEmployees();
      if (hasDeptChanges)   await _doSaveDepartments();
      if (hasDriverChanges) await _doSaveDrivers();
      // Refresh from the backend so the grid reflects persisted values and
      // the dirty flags/refs are authoritatively cleared (see
      // handleSaveEmployees / handleSaveDriversChained).
      if (savedSomething) await fetchData();
    } catch { /* toasted internally */ }
    finally { setGuardSaving(false); }
    setShowUnsavedModal(false);
    const a = pendingAction; setPendingAction(null); a?.();
  };
  const handleGuardDiscard = () => {
    setHasEmpChanges(false); setHasDeptChanges(false); setHasDriverChanges(false);
    setEmpChanges({}); setDeptChanges({}); setDriverChanges({});
    setShowUnsavedModal(false);
    const a = pendingAction; setPendingAction(null); a?.();
  };

  // ── Fetch main data ───────────────────────────────────────────────────
  // GET /{year}/{currency}?quarter=Q1&currency_filter=actualvalue
  const fetchData = useCallback(async () => {
    if (!token || !year || !currency) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        quarter,
        currency_filter: currencyFilter,
        forecast_year: forecastYear,
        forecast_type: forecastType,
        view_type: "monthly_breakdown",
      });
      if (forecastType === "rolling") params.set("rolling_start_month", rollingStartMonth);
      // Tells the backend which side is authoritative when a cell has an
      // explicit value in both Payroll Summary and Drivers.
      params.set("forecast_mode", forecastMode);
      const res = await fetch(`${API_BASE}/${forecastYear}/${currency}?${params.toString()}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = await res.json();
      setApiData(data);

      // employees[] → summary tab
      const prevSalaryBase = {};
      setEmployees((data.employees || []).map((e) => {
        const mapped = { ...e };
        const prevSal = toBackendNumber(e.previous_month_salary);
        // Normalize previous_month_salary to a plain number (backend may send formatted string)
        mapped.previous_month_salary  = prevSal;
        mapped.previous_month_bonus   = toBackendNumber(e.previous_month_bonus);
        mapped.previous_month_benefits = toBackendNumber(e.previous_month_benefits);
        mapped.quarter_total_ai       = toBackendNumber(e.quarter_total_ai);
        mapped.quarter_total_adjusted = toBackendNumber(e.quarter_total_adjusted);
        if (Array.isArray(e.monthly_data) && e.monthly_data.length > 0) {
          e.monthly_data.forEach((md, i) => {
            const n = i + 1;
            // Try multiple field name patterns the backend might use
            const salAi  = toBackendNumber(md.salary_ai  ?? md.ai_salary  ?? md.monthly_salary_ai);
            const salAdj = toBackendNumber(md.salary_adjusted ?? md.adjusted_salary ?? md.monthly_salary_adjusted);
            const bonAi  = toBackendNumber(md.bonus_ai   ?? md.ai_bonus   ?? md.monthly_bonus_ai);
            const bonAdj = toBackendNumber(md.bonus_adjusted ?? md.adjusted_bonus ?? md.monthly_bonus_adjusted);
            const benAi  = toBackendNumber(md.benefits_ai ?? md.ai_benefits ?? md.monthly_benefits_ai);
            const benAdj = toBackendNumber(md.benefits_adjusted ?? md.adjusted_benefits ?? md.monthly_benefits_adjusted);
            mapped[`month${n}_ai_salary`]         = salAi;
            mapped[`month${n}_adjusted_salary`]   = salAdj ?? salAi ?? prevSal ?? 0;
            mapped[`month${n}_ai_bonus`]          = bonAi;
            mapped[`month${n}_adjusted_bonus`]    = bonAdj ?? bonAi ?? 0;
            mapped[`month${n}_ai_benefits`]       = benAi;
            mapped[`month${n}_adjusted_benefits`] = benAdj ?? benAi ?? 0;
            mapped[`month${n}_comment`]           = md.comment || md.month_comment || "";
          });
        } else {
          // Flat fields – normalize all monthly values from formatted strings to plain numbers
          for (let n = 1; n <= 12; n++) {
            const salAi  = toBackendNumber(e[`month${n}_ai_salary`]);
            const salAdj = toBackendNumber(e[`month${n}_adjusted_salary`]);
            const bonAi  = toBackendNumber(e[`month${n}_ai_bonus`]);
            const bonAdj = toBackendNumber(e[`month${n}_adjusted_bonus`]);
            const benAi  = toBackendNumber(e[`month${n}_ai_benefits`]);
            const benAdj = toBackendNumber(e[`month${n}_adjusted_benefits`]);
            mapped[`month${n}_ai_salary`]         = salAi;
            mapped[`month${n}_ai_bonus`]          = bonAi;
            mapped[`month${n}_ai_benefits`]       = benAi;
            mapped[`month${n}_adjusted_salary`]   = (salAi === null && (salAdj === null || salAdj === 0))
              ? (prevSal ?? 0)
              : (salAdj ?? salAi ?? prevSal ?? 0);
            mapped[`month${n}_adjusted_bonus`]    = bonAdj ?? bonAi ?? 0;
            mapped[`month${n}_adjusted_benefits`] = benAdj ?? benAi ?? 0;
          }
        }
        return mapped;
      }));

      // department_headcount_projections.Departments[] → headcount tab
      setDeptRows((data.department_headcount_projections?.Departments || []).map((d) => {
        const mapped = { ...d };
        if (Array.isArray(d.monthly_data) && d.monthly_data.length > 0) {
          d.monthly_data.forEach((md, i) => {
            const n = i + 1;
            mapped[`month${n}_ai_count`]       = toBackendNumber(md.ai_count ?? md.count_ai);
            mapped[`month${n}_adjusted_count`] = toBackendNumber(md.adjusted_count ?? md.count_adjusted) ?? mapped[`month${n}_ai_count`] ?? 0;
            mapped[`month${n}_comment`]        = md.comment || "";
          });
        }
        return mapped;
      }));

      // drivers[] → flatten to per-employee-per-month for drivers tab
      const flat = [];
      (data.drivers || []).forEach((d) => {
        (d.months || []).forEach((m) => {
          flat.push({
            employee_name:         d.employee_name,
            month:                 m.month,
            salary_ai:             toBackendNumber(m.salary_ai),
            bonus_ai:              toBackendNumber(m.bonus_ai),
            benefits_ai:           toBackendNumber(m.benefits_ai),
            total_cost_ai:         toBackendNumber(m.total_cost_ai),
            salary_adjusted:       toBackendNumber(m.salary_adjusted) ?? toBackendNumber(m.salary_ai) ?? 0,
            bonus_adjusted:        toBackendNumber(m.bonus_adjusted) ?? toBackendNumber(m.bonus_ai) ?? 0,
            benefits_adjusted:     toBackendNumber(m.benefits_adjusted) ?? toBackendNumber(m.benefits_ai) ?? 0,
            total_cost_adjusted:   toBackendNumber(m.total_cost_adjusted) ?? toBackendNumber(m.total_cost_ai) ?? 0,
            month_comment:         m.month_comment || "",
            quarter_total_cost_ai:       toBackendNumber(d.quarter_total_cost_ai),
            quarter_total_cost_adjusted: toBackendNumber(d.quarter_total_cost_adjusted) ?? toBackendNumber(d.quarter_total_cost_ai) ?? 0,
            overall_comment:       d.overall_comment || "",
          });
        });
      });
      setDriverRows(flat);

      // reset change tracking
      setEmpChanges({}); setEmpComments({});
      setDeptChanges({}); setDeptComments({});
      setDriverChanges({}); setDriverComments({});
      setHasEmpChanges(false); setHasDeptChanges(false); setHasDriverChanges(false);

      setStage(data.workflow_stage || "draft");
      setWorkflowMeta({ reviewed_by: data.reviewed_by, approved_by: data.approved_by, locked_by: data.locked_by });
    } catch (e) { addToast(`Failed to load: ${e.message}`, "error"); }
    finally { setLoading(false); }
  }, [year, currency, quarter, currencyFilter, forecastYear, forecastType, rollingStartMonth, token, forecastMode]);

  const fetchScenarios = useCallback(async () => {
    if (!token || !year) return;
    setScenarioLoading(true);
    try {
      const params = new URLSearchParams({ quarter });
      const res = await fetch(`${API_BASE}/${year}/scenarios?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = await res.json();
      setScenariosList(Array.isArray(data) ? data : (data.scenarios || []));
    } catch (e) { addToast(`Failed to load scenarios: ${e.message}`, "error"); }
    finally { setScenarioLoading(false); }
  }, [year, quarter, token]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (activeTab === "scenarios") fetchScenarios(); }, [activeTab, fetchScenarios]);

  // ── SAVE: Employee Adjustments ────────────────────────────────────────
  // PATCH /employee-adjustments/{year}?quarter=Q1
  // Body: [{ employee_name, month1_adjusted_salary, month1_adjusted_bonus, month1_adjusted_benefits,
  //          month2_*, month3_*, month1_comment, month2_comment, month3_comment, overall_comment }]
  // Resolves the first set candidate (skipping null/undefined/"") to a
  // number. "" no longer falls through `??` the way null does, since
  // empChanges/driverChanges can now hold the raw "" the user typed mid-edit.
  const pickAmount = (...vals) => {
    for (const v of vals) if (v !== undefined && v !== null && v !== "") return toCalcNumber(v);
    return 0;
  };
  const _doSaveEmployees = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const changedEmpNames = new Set([...Object.keys(empChanges), ...Object.keys(empComments)]);
      const payload = employees
        .filter((e) => changedEmpNames.has(e.employee))
        .map((e) => {
          const ec = empChanges[e.employee]  || {};
          const mc = empComments[e.employee] || {};
          return {
            employee_name:            e.employee,
            month1_adjusted_salary:   pickAmount(ec.month1_adjusted_salary,   e.month1_adjusted_salary,   e.month1_ai_salary),
            month2_adjusted_salary:   pickAmount(ec.month2_adjusted_salary,   e.month2_adjusted_salary,   e.month2_ai_salary),
            month3_adjusted_salary:   pickAmount(ec.month3_adjusted_salary,   e.month3_adjusted_salary,   e.month3_ai_salary),
            month1_adjusted_bonus:    pickAmount(ec.month1_adjusted_bonus,    e.month1_adjusted_bonus,    e.month1_ai_bonus),
            month2_adjusted_bonus:    pickAmount(ec.month2_adjusted_bonus,    e.month2_adjusted_bonus,    e.month2_ai_bonus),
            month3_adjusted_bonus:    pickAmount(ec.month3_adjusted_bonus,    e.month3_adjusted_bonus,    e.month3_ai_bonus),
            month1_adjusted_benefits: pickAmount(ec.month1_adjusted_benefits, e.month1_adjusted_benefits, e.month1_ai_benefits),
            month2_adjusted_benefits: pickAmount(ec.month2_adjusted_benefits, e.month2_adjusted_benefits, e.month2_ai_benefits),
            month3_adjusted_benefits: pickAmount(ec.month3_adjusted_benefits, e.month3_adjusted_benefits, e.month3_ai_benefits),
            month1_comment:  mc.month1  || e.month1_comment  || "",
            month2_comment:  mc.month2  || e.month2_comment  || "",
            month3_comment:  mc.month3  || e.month3_comment  || "",
            overall_comment: mc.overall || e.overall_comment || "",
          };
        });

      const batches = [];
      for (let i = 0; i < payload.length; i += 50) batches.push(payload.slice(i, i + 50));
      await Promise.all(batches.map((batch) =>
        fetch(`${API_BASE}/employee-adjustments/${year}?quarter=${quarter}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(batch),
        }).then(async (res) => { if (!res.ok) throw new Error(await parseApiError(res)); })
      ));
      setHasEmpChanges(false); addToast("Employee adjustments saved ✓", "success");
    } catch (e) { setCenterError(e.message); throw e; }
    finally { setSaving(false); }
  };

  // ── SAVE: Department Adjustments ──────────────────────────────────────
  // PATCH /department-adjustments/{year}?quarter=Q1
  // Body: [{ department_name, month1_adjusted_count, month2_adjusted_count, month3_adjusted_count,
  //          month1_comment, month2_comment, month3_comment, overall_comment }]
  const [deptSaving, setDeptSaving] = useState(false);
  // Resolves the first set candidate (skipping null/undefined/"") to a
  // whole-number count. "" no longer falls through `??` the way null does,
  // since deptChanges can now hold the raw "" the user typed mid-edit.
  const pickCount = (...vals) => {
    for (const v of vals) if (v !== undefined && v !== null && v !== "") return Math.round(toCalcNumber(v));
    return 0;
  };
  const _doSaveDepartments = async () => {
    if (!canEdit) return;
    setDeptSaving(true);
    try {
      const payload = deptRows.map((d) => {
        const dc = deptChanges[d.Department]  || {};
        const mc = deptComments[d.Department] || {};
        return {
          department_name:       d.Department,
          month1_adjusted_count: pickCount(dc.month1_adjusted_count, d.month1_adjusted_count, d.month1_ai_count),
          month2_adjusted_count: pickCount(dc.month2_adjusted_count, d.month2_adjusted_count, d.month2_ai_count),
          month3_adjusted_count: pickCount(dc.month3_adjusted_count, d.month3_adjusted_count, d.month3_ai_count),
          month1_comment:  mc.month1  || d.month1_comment  || "",
          month2_comment:  mc.month2  || d.month2_comment  || "",
          month3_comment:  mc.month3  || d.month3_comment  || "",
          overall_comment: mc.overall || d.overall_comment || "",
        };
      });
      const res = await fetch(`${API_BASE}/department-adjustments/${year}?quarter=${quarter}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      addToast("Department adjustments saved ✓", "success");
      await fetchData();
    } catch (e) { setCenterError(e.message); throw e; }
    finally { setDeptSaving(false); }
  };

  // ── SAVE: Driver Adjustments ──────────────────────────────────────────
  // PATCH /driver-adjustments/{year}?quarter=Q1
  // Body: [{ employee_name, month, salary_adjusted, bonus_adjusted, benefits_adjusted,
  //          month_comment, overall_comment }]
  const [driverSaving, setDriverSaving] = useState(false);
  const _doSaveDrivers = async () => {
    if (!canEdit) return;
    setDriverSaving(true);
    try {
      const changedKeys = new Set([...Object.keys(driverChanges), ...Object.keys(driverComments)]);

      const overallMap = {};
      driverRows.forEach((r) => {
        if (!overallMap[r.employee_name]) overallMap[r.employee_name] = r.overall_comment || "";
      });

      const payload = driverRows
        .filter((r) => changedKeys.has(`${r.employee_name}-${r.month}`))
        .map((r) => {
          const k  = `${r.employee_name}-${r.month}`;
          const dc = driverChanges[k]  || {};
          const mc = driverComments[k] || "";
          return {
            employee_name:     r.employee_name,
            month:             r.month,
            salary_adjusted:   pickAmount(dc.salary_adjusted,   r.salary_adjusted,   r.salary_ai),
            bonus_adjusted:    pickAmount(dc.bonus_adjusted,    r.bonus_adjusted,    r.bonus_ai),
            benefits_adjusted: pickAmount(dc.benefits_adjusted, r.benefits_adjusted, r.benefits_ai),
            month_comment:     mc || r.month_comment || "",
            overall_comment:   overallMap[r.employee_name] || "",
          };
        });

      const batches = [];
      for (let i = 0; i < payload.length; i += 50) batches.push(payload.slice(i, i + 50));
      await Promise.all(batches.map((batch) =>
        fetch(`${API_BASE}/driver-adjustments/${year}?quarter=${quarter}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(batch),
        }).then(async (res) => { if (!res.ok) throw new Error(await parseApiError(res)); })
      ));
      setHasDriverChanges(false); addToast("Driver adjustments saved ✓", "success");
    } catch (e) { setCenterError(e.message); throw e; }
    finally { setDriverSaving(false); }
  };

  /* Cross-sync (handleEmpFieldChange / handleDriverFieldChange) writes into
     both empChanges and driverChanges whenever a change in one mode implies
     a change in the other, so saving from either tab must persist both to
     keep payroll_forecast_adjustments and payroll_driver_adjustments
     consistent server-side. Headcount (department counts) is an unrelated
     concept and is intentionally not chained here. */
  // Whichever side the user explicitly saves from is patched LAST, since the
  // backend now lets the row with the more recent updated_at win when both
  // tables hold an explicit value for the same month — not just forecast_mode.
  // Saving the active tab last guarantees it's the one the next GET shows.
  // setSaving/setDriverSaving up front — not left to _doSaveEmployees/
  // _doSaveDrivers alone — because the cross-sync (handleEmpFieldChange/
  // handleDriverFieldChange) can mark the *other* tab's changes too, so the
  // visible Save bar's own save may run second, behind an invisible save on
  // the other tab. Without this, the spinner wouldn't appear until that
  // hidden save finished, making the UI look unresponsive right after click.
  const handleSaveEmployees = async () => {
    setSaving(true);
    try {
      if (hasDriverChanges) await _doSaveDrivers();
      await _doSaveEmployees();
      await fetchData();
    } catch { /* shown via toast/centerError */ }
    finally { setSaving(false); }
  };
  const handleSaveDriversChained = async () => {
    setDriverSaving(true);
    try {
      if (hasEmpChanges) await _doSaveEmployees();
      await _doSaveDrivers();
      await fetchData();
    } catch { /* shown via toast/centerError */ }
    finally { setDriverSaving(false); }
  };

  // ── Workflow ───────────────────────────────────────────────────────────
  // PATCH /workflow/{year}?quarter=Q1  Body: { target_stage, comment }
  const handleWorkflow = async (target, comment) => {
    setWorkflowLoading(true);
    try {
      const res = await fetch(`${API_BASE}/workflow/${year}?quarter=${quarter}`, {
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

  // ── Change helpers ─────────────────────────────────────────────────────
  /* Payroll Summary edit → Drivers sync. month{N}_adjusted_salary/bonus/
     benefits and the Drivers tab's salary_adjusted/bonus_adjusted/
     benefits_adjusted are literally the same figures (no units*rate
     decomposition here, unlike Revenue/Expense/Cashflow/CAPEX) — just
     mirror the value across. Headcount (department counts) is unrelated
     and is not touched here. */
  const handleEmpFieldChange = (empName, field, val) => {
    // Store exactly what the user typed — "", "13", "13.5" — instead of
    // parsing it on every keystroke. The old `parseFloat(val) || 0`
    // collapsed both "" and any not-yet-finished number to 0 immediately,
    // which then re-rendered straight back into the input, making the field
    // impossible to clear or use right. Numeric coercion now only happens
    // where a real number is actually required: the cross-tab sync below,
    // and at save time (toBackendNumber(...) ?? 0).
    setEmpChanges((p) => ({ ...p, [empName]: { ...(p[empName] || {}), [field]: val } }));
    setHasEmpChanges(true);

    const m = /^month(\d+)_adjusted_(salary|bonus|benefits)$/.exec(field);
    if (m) {
      const monthIso = monthPeriods[Number(m[1]) - 1]?.iso;
      if (monthIso) {
        const syncVal = toCalcNumber(val);
        const k = `${empName}-${monthIso}`;
        setDriverChanges((p) => ({ ...p, [k]: { ...(p[k] || {}), [`${m[2]}_adjusted`]: syncVal } }));
        setHasDriverChanges(true);
      }
    }
  };
  const handleEmpCommentChange = (empName, monthKey, val) => {
    setEmpComments((p) => ({ ...p, [empName]: { ...(p[empName] || {}), [monthKey]: val } }));
    setHasEmpChanges(true);
  };
  const handleDeptFieldChange = (deptName, field, val) => {
    // Keep "" as "" while editing instead of collapsing it to 0 immediately
    // with `parseInt(val, 10) || 0` — that's what made the field impossible
    // to clear. Numeric coercion happens at save time (see
    // _doSaveDepartments' pickCount helper).
    setDeptChanges((p) => ({ ...p, [deptName]: { ...(p[deptName] || {}), [field]: val } }));
    setHasDeptChanges(true);
  };
  const handleDeptCommentChange = (deptName, monthKey, val) => {
    setDeptComments((p) => ({ ...p, [deptName]: { ...(p[deptName] || {}), [monthKey]: val } }));
    setHasDeptChanges(true);
  };

  /* onBlur for an employee salary/bonus/benefits Adjusted cell — the
     "navigate to another row or column" moment. If the value actually
     changed since the cell was focused, offer to propagate it to all 12
     months (for that one component — salary, bonus, or benefits). */
  const handleEmpFieldBlur = (empName, field, m, startVal) => {
    setFocusedCellKey(null);
    if (!canEdit) return;
    const emp = employees.find((e) => e.employee === empName);
    if (!emp) return;
    const ec = empChanges[empName] || {};
    const curVal = ec[field] ?? emp[field];
    const curNum = toBackendNumber(curVal);
    if (curNum == null || toBackendNumber(startVal) === curNum) return;
    const fieldMatch = /_(salary|bonus|benefits)$/.exec(field);
    const componentField = fieldMatch ? fieldMatch[1] : "salary";
    setApplyAllMonthsModal({
      open: true, kind: "employee",
      label: `${empName} (${componentField})`, value: curNum, isCount: false,
      employeeName: empName, field: componentField, departmentName: null,
    });
  };

  /* onBlur for a department headcount Adjusted cell (Monthly Breakdown view
     only — a Quarter Summary cell represents an end-of-quarter count, not a
     single month, so "apply to all 12 months" doesn't apply there). */
  const handleDeptFieldBlur = (deptName, m, startVal) => {
    setFocusedCellKey(null);
    if (!canEdit) return;
    const dept = deptRows.find((d) => d.Department === deptName);
    if (!dept) return;
    const dc = deptChanges[deptName] || {};
    const curVal = dc[`month${m}_adjusted_count`] ?? dept[`month${m}_adjusted_count`];
    const curNum = toBackendNumber(curVal);
    if (curNum == null || toBackendNumber(startVal) === curNum) return;
    setApplyAllMonthsModal({
      open: true, kind: "department",
      label: deptName, value: curNum, isCount: true,
      employeeName: null, field: null, departmentName: deptName,
    });
  };

  const closeApplyAllMonthsModal = () => setApplyAllMonthsModal({
    open: false, kind: null, label: null, value: null, isCount: false,
    employeeName: null, field: null, departmentName: null,
  });

  /* "Yes, apply to all 12 months" — write the value into every currently
     visible month column locally (instant feedback + Drivers cross-sync for
     the employee case) and persist it across all 4 quarters on the backend,
     since both payroll_forecast_adjustments and
     department_headcount_forecast_adjustments store each quarter as its own
     row (month1..month3 each). */
  const applyAdjustedToAllMonths = async () => {
    const { kind, value, employeeName, field, departmentName } = applyAllMonthsModal;
    if (!kind) { closeApplyAllMonthsModal(); return; }
    setApplyingAllMonths(true);
    try {
      if (kind === "employee") {
        months.forEach((_, mi) => handleEmpFieldChange(employeeName, `month${mi + 1}_adjusted_${field}`, value));
        const res = await fetch(`${API_BASE}/employee-adjustments/${year}/apply-all-months`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", accept: "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ employee_name: employeeName, field, value }),
        });
        if (!res.ok) throw new Error(await parseApiError(res));
        const data = await res.json();
        const skipped = data?.skipped_quarters || [];
        addToast(
          skipped.length
            ? `Applied to all 12 months for ${employeeName} (${field}) — ${skipped.join(", ")} skipped (not in draft) ✓`
            : `Applied to all 12 months for ${employeeName} (${field}) ✓`,
          "success"
        );
      } else {
        months.forEach((_, mi) => handleDeptFieldChange(departmentName, `month${mi + 1}_adjusted_count`, value));
        const res = await fetch(`${API_BASE}/department-adjustments/${year}/apply-all-months`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", accept: "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ department_name: departmentName, value }),
        });
        if (!res.ok) throw new Error(await parseApiError(res));
        const data = await res.json();
        const skipped = data?.skipped_quarters || [];
        addToast(
          skipped.length
            ? `Applied to all 12 months for ${departmentName} — ${skipped.join(", ")} skipped (not in draft) ✓`
            : `Applied to all 12 months for ${departmentName} ✓`,
          "success"
        );
      }
    } catch (e) {
      addToast(`Failed to apply to all 12 months: ${e.message}`, "error");
    } finally {
      setApplyingAllMonths(false);
      closeApplyAllMonthsModal();
    }
  };

  /* Drivers edit → Payroll Summary sync. salary_adjusted/bonus_adjusted/
     benefits_adjusted mirror straight into the matching month{N}_adjusted_*
     field for the same employee. */
  const handleDriverFieldChange = (empName, month, field, val) => {
    const k = `${empName}-${month}`;
    // Keep the raw typed value; toCalcNumber below parses leniently for the
    // cross-tab sync, which always needs a real number.
    setDriverChanges((p) => ({ ...p, [k]: { ...(p[k] || {}), [field]: val } }));
    setHasDriverChanges(true);

    const m = /^(salary|bonus|benefits)_adjusted$/.exec(field);
    if (m) {
      const idx = monthPeriods.findIndex((mp) => mp.iso === month);
      if (idx !== -1) {
        const syncVal = toCalcNumber(val);
        const empField = `month${idx + 1}_adjusted_${m[1]}`;
        setEmpChanges((p) => ({ ...p, [empName]: { ...(p[empName] || {}), [empField]: syncVal } }));
        setHasEmpChanges(true);
      }
    }
  };
  const handleDriverCommentChange = (empName, month, val) => {
    const k = `${empName}-${month}`;
    setDriverComments((p) => ({ ...p, [k]: val }));
    setHasDriverChanges(true);
  };

  const handleTabChange     = (id) => guardedAction(() => setActiveTab(id));
  const handleQuarterChange = (q)  => guardedAction(() => setQuarter(q));
  const handleCurrencyFilterChange  = (v) => guardedAction(() => setCurrencyFilter(v));
  const handleForecastTypeChange      = (v) => guardedAction(() => setForecastType(v));
  const handleViewTypeChange          = (v) => guardedAction(() => setViewType(v));
  const handleForecastModeChange      = (v) => guardedAction(() => {
    setForecastMode(v);
    setActiveTab(v === "drivers" ? "drivers" : "summary");
  });
  const handleRefresh       = ()   => guardedAction(fetchData);

  // ── Derived ────────────────────────────────────────────────────────────
  const deptOptions = [...new Set(employees.map((e) => e.department).filter(Boolean))].sort();

  const filteredEmployees = employees.filter((e) => {
    const q = filterText.toLowerCase();
    const matchText = !filterText || e.employee?.toLowerCase().includes(q) || e.role?.toLowerCase().includes(q) || e.department?.toLowerCase().includes(q);
    const matchDept = !filterDept || e.department === filterDept;
    return matchText && matchDept;
  });

  // Unique employees for drivers tab
  const driverEmpNames = [...new Set(driverRows.map((r) => r.employee_name))];

  // Payroll totals
  const base = apiData?.Baseline_forecast_summary || {};

  const scenarioStyles = {
    baseline:   { icon: "◎", top: "bg-blue-600"    },
    best_case:  { icon: "🚀", top: "bg-emerald-500" },
    worst_case: { icon: "⚠️", top: "bg-red-500"     },
  };
  const getScStyle = (sc) => scenarioStyles[sc.scenario_name] || { icon: "📊", top: "bg-slate-600" };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div ref={pageTopRef} className="planning-compact forecasting-pnl-theme headcount-payroll-page min-h-screen bg-sky-50 font-sans text-sky-900">

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
      <ApplyAllMonthsModal open={applyAllMonthsModal.open} label={applyAllMonthsModal.label}
        value={applyAllMonthsModal.value} isCount={applyAllMonthsModal.isCount} applying={applyingAllMonths}
        onYes={applyAdjustedToAllMonths} onNo={closeApplyAllMonthsModal}/>

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <header className="forecasting-page-header bg-gradient-to-r from-sky-950 via-sky-900 to-sky-700 rounded-xl px-4 py-2.5 md:px-6 sticky -top-5 z-40 shadow-sm">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
              <FiUsers className="text-white" size={16}/>
            </div>
            <h1 className="text-lg font-bold text-white">Headcount & Payroll Forecast</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <p className="text-white text-xs tabular-nums">{forecastYear} · {forecastType === "quarter" ? quarter : forecastType} · {currency}</p>
            <select value={currencyFilter} onChange={(e) => handleCurrencyFilterChange(e.target.value)}
              className="px-3 py-1 rounded-lg bg-white border border-sky-200 text-sky-900 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200">
              {CURRENCY_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={handleRefresh}
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

      {/* ── WORKFLOW PROGRESS ─────────────────────────────────────────── */}
      <div className="mt-2">
        <WorkflowProgress stage={stage} workflowMeta={workflowMeta} onAction={(t) => setModal({ open:true, target:t })}/>
      </div>

      {/* ── FILTER BAR ───────────────────────────────────────────────── */}
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
              title="Choose which view drives input. Payroll Summary and Drivers values stay in sync regardless of mode."
              className="px-3 py-1 rounded-lg bg-white border border-slate-300 text-slate-900 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200">
              <option value="summary">Summary Based</option>
              <option value="drivers">Drivers Based</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── MAIN ───────────────────────────────────────────────────── */}
      <main className="max-w-screen-2xl mx-auto px-0 py-2">

        <KpiCards apiData={apiData}/>

        {/* ── TABS ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b-2 border-slate-200 mb-2 gap-2 flex-wrap">
          <div className="flex items-end gap-2">
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

        {/* ══ PAYROLL SUMMARY TAB ══════════════════════════════════════ */}
        {activeTab === "summary" && (
          <div>
            {/* Filters */}
            <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13}/>
                  <input value={filterText} onChange={(e) => setFilterText(e.target.value)}
                    placeholder="Search employee, role…"
                    className="pl-8 pr-4 py-1 rounded-xl border border-slate-300 bg-white text-s text-slate-900 outline-none focus:border-blue-500 focus:ring-2 ring-blue-100 transition-all w-52 shadow-sm"/>
                </div>
                {filterText && <button onClick={() => setFilterText("")} className="flex items-center gap-1 text-x text-slate-500 hover:text-sky-700 px-2 py-1 rounded-lg hover:bg-slate-100"><FiX size={12}/> Clear</button>}
                <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}
                  className="px-3 py-1 rounded-xl border border-slate-300 bg-white text-x text-slate-700 outline-none focus:border-blue-500 cursor-pointer">
                  <option value="">All Departments</option>
                  {deptOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                {filterDept && <button onClick={() => setFilterDept("")} className="flex items-center gap-1 text-x text-sky-600 hover:text-sky-800 px-2 py-1 rounded-lg hover:bg-sky-50 border border-sky-200"><FiFilter size={11}/> Clear</button>}
                <span className="text-x text-slate-500 bg-white px-2.5 py-1 rounded-lg tabular-nums border border-slate-200">{filteredEmployees.length}/{employees.length}</span>
              </div>
              {!canEdit && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-x font-semibold">
                  <FiAlertCircle size={12}/> Editing disabled — {STAGE_LABELS[stage]}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {loading ? <TableSkeleton columns={6} rows={8} /> : viewType === "quarter_summary" && quarterGroups ? (
                /* ── QUARTER SUMMARY VIEW ─────────────────────────── */
                <div className="analytics-table-scroll overflow-x-auto max-h-[72vh] overflow-y-auto">
                  <table className="w-full border-collapse text-x">
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-sky-800 border-b border-sky-700">
                        <th rowSpan={2} className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700 sticky left-0 bg-sky-800 z-30 min-w-[180px]">Employee</th>
                        <th rowSpan={2} className="px-3 py-3 text-left text-xs font-semibold text-white uppercase min-w-[100px]">Dept</th>
                        <th rowSpan={2} className="px-3 py-3 text-left text-xs font-semibold text-white uppercase min-w-[110px]">Role</th>
                        <th rowSpan={2} className="px-4 py-3 text-right text-xs font-semibold text-white uppercase min-w-[90px]">Prev Salary</th>
                        {quarterGroups.map((qg, qi) => (
                          <th key={qg.key} colSpan={6} className={`px-4 py-2.5 text-center text-x font-semibold text-white border-l border-sky-700 bg-sky-800`}>{qg.label}</th>
                        ))}
                        <th colSpan={2} className="px-4 py-2.5 text-center text-x font-semibold text-white border-l border-sky-700 bg-sky-900">Period Total</th>
                        <th className="px-4 py-2.5 text-center text-x font-semibold text-white border-l border-sky-700 bg-sky-800 min-w-[50px]">Note</th>
                      </tr>
                      <tr className="bg-sky-700 border-b border-slate-600 sticky top-[32px] z-10">
                        {quarterGroups.map((qg) => (
                          <React.Fragment key={qg.key}>
                            {["Sal AI","Sal Adj","Bon AI","Bon Adj","Ben AI","Ben Adj"].map((h, hi) => (
                              <th key={h} className={`px-2 py-2 text-xs font-medium text-white uppercase whitespace-nowrap ${hi===0?"border-l border-slate-600":""} text-right`}>{h}</th>
                            ))}
                          </React.Fragment>
                        ))}
                        <th className="px-3 py-2 text-right text-xs font-medium text-white uppercase border-l border-slate-600">AI</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase">Adj</th>
                        <th className="px-3 py-2 border-l border-slate-600"/>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {filteredEmployees.length === 0
                        ? <tr><td colSpan={99}><EmptyState label="No employees match your filters."/></td></tr>
                        : filteredEmployees.map((emp, idx) => {
                            const isEven = idx % 2 === 0;
                            const avCls  = avatarClass(emp.employee);
                            const ec     = empChanges[emp.employee] || {};
                            const mc     = empComments[emp.employee] || {};
                            // toCalcNumber, not `|| 0`/bare `??`: ec's values are the raw
                            // string the user is mid-typing, and `0 + "<string>"` concatenates
                            // instead of adding.
                            const qCells = quarterGroups.map((qg) => ({
                              key:    qg.key,
                              salAi:  qg.monthIdxs.reduce((s, mi) => s + toCalcNumber(emp[`month${mi+1}_ai_salary`]), 0),
                              salAdj: qg.monthIdxs.reduce((s, mi) => s + toCalcNumber(ec[`month${mi+1}_adjusted_salary`] ?? emp[`month${mi+1}_adjusted_salary`] ?? emp[`month${mi+1}_ai_salary`]), 0),
                              bonAi:  qg.monthIdxs.reduce((s, mi) => s + toCalcNumber(emp[`month${mi+1}_ai_bonus`]), 0),
                              bonAdj: qg.monthIdxs.reduce((s, mi) => s + toCalcNumber(ec[`month${mi+1}_adjusted_bonus`] ?? emp[`month${mi+1}_adjusted_bonus`] ?? emp[`month${mi+1}_ai_bonus`]), 0),
                              benAi:  qg.monthIdxs.reduce((s, mi) => s + toCalcNumber(emp[`month${mi+1}_ai_benefits`]), 0),
                              benAdj: qg.monthIdxs.reduce((s, mi) => s + toCalcNumber(ec[`month${mi+1}_adjusted_benefits`] ?? emp[`month${mi+1}_adjusted_benefits`] ?? emp[`month${mi+1}_ai_benefits`]), 0),
                            }));
                            const periodAi  = qCells.reduce((s, q) => s + q.salAi + q.bonAi + q.benAi, 0);
                            const periodAdj = qCells.reduce((s, q) => s + q.salAdj + q.bonAdj + q.benAdj, 0);
                            const rowBg = isEven ? "bg-white" : "bg-slate-50/60";
                            return (
                              <tr key={`${emp.employee}-${idx}`} className={`hc-row border-b border-slate-100 ${rowBg}`}>
                                <td className="px-4 py-2.5 sticky left-0 border-r border-slate-200 z-[5] bg-white">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${avCls}`}>{getInitials(emp.employee)}</div>
                                    <span className="font-bold text-slate-900 text-x whitespace-nowrap">{emp.employee}</span>
                                  </div>
                                </td>
                                <td className={`px-3 py-2.5 ${rowBg}`}><span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">{emp.department || "—"}</span></td>
                                <td className={`px-3 py-2.5 text-x text-slate-600 ${rowBg}`}>{emp.role || "—"}</td>
                                <td className={`px-4 py-2.5 text-right tabular-nums text-x text-slate-500 ${rowBg}`}>{fmt(emp.previous_month_salary)}</td>
                                {qCells.map((qc, qi) => (
                                  <React.Fragment key={qc.key}>
                                    <td className={`px-2 py-2 text-right text-x text-slate-500 tabular-nums border-l border-slate-100 ${monthTheme[qi % 3].bg}`}>{fmt(qc.salAi)}</td>
                                    <td className={`px-2 py-2 text-right text-x tabular-nums font-semibold ${monthTheme[qi % 3].bg} ${qc.salAdj>qc.salAi?"text-red-500":qc.salAdj<qc.salAi?"text-emerald-600":"text-slate-700"}`}>{fmt(qc.salAdj)}</td>
                                    <td className={`px-2 py-2 text-right text-x text-slate-500 tabular-nums ${monthTheme[qi % 3].bg}`}>{fmt(qc.bonAi)}</td>
                                    <td className={`px-2 py-2 text-right text-x tabular-nums ${monthTheme[qi % 3].bg} text-slate-600`}>{fmt(qc.bonAdj)}</td>
                                    <td className={`px-2 py-2 text-right text-x text-slate-500 tabular-nums ${monthTheme[qi % 3].bg}`}>{fmt(qc.benAi)}</td>
                                    <td className={`px-2 py-2 text-right text-x tabular-nums ${monthTheme[qi % 3].bg} text-slate-600`}>{fmt(qc.benAdj)}</td>
                                  </React.Fragment>
                                ))}
                                <td className="px-3 py-2 text-right text-x text-slate-500 tabular-nums border-l border-slate-200 bg-slate-50/60">{fmt(periodAi)}</td>
                                <td className={`px-3 py-2 text-right text-x font-bold tabular-nums ${periodAdj>periodAi?"text-red-500":periodAdj<periodAi?"text-emerald-600":"text-sky-700"}`}>{fmt(periodAdj)}</td>
                                <td className="px-2 py-1.5 border-l border-slate-100 text-center">
                                  <InlineCommentIcon commentKey={`overall-${emp.employee}`} value={mc.overall || emp.overall_comment || ""}
                                    disabled={!canEdit} onChange={(v) => handleEmpCommentChange(emp.employee, "overall", v)}
                                    label={`${emp.employee} — Overall`} isOverall/>
                                </td>
                              </tr>
                            );
                          })}
                    </tbody>
                    <tfoot>
                      {(() => {
                        // Local helpers so the grand total follows the same "live sum,
                        // default-to-AI" rule as each employee's own row: `empAdj` prefers
                        // an in-progress edit from empChanges (`ec`), falls back to the
                        // row's last-saved adjusted value, and defaults to AI when neither
                        // exists — never a stale snapshot field that edits don't update.
                        const empAdj = (e, m, comp) => {
                          const ec = empChanges[e.employee] || {};
                          return toCalcNumber(ec[`month${m}_adjusted_${comp}`] ?? e[`month${m}_adjusted_${comp}`] ?? e[`month${m}_ai_${comp}`]);
                        };
                        const empAi = (e, m, comp) => toCalcNumber(e[`month${m}_ai_${comp}`]);
                        return (
                          <tr className="bg-sky-900 text-white sticky bottom-0 z-10 font-semibold">
                            <td className="px-4 py-3 text-s sticky left-0 bg-sky-900 border-r border-sky-700 z-[9]">TOTAL</td>
                            <td colSpan={3} className="bg-sky-900"/>
                            {quarterGroups.map((qg) => {
                              const qSalAi  = filteredEmployees.reduce((s,e) => s + qg.monthIdxs.reduce((ss,mi) => ss + empAi(e, mi+1, "salary"), 0), 0);
                              const qSalAdj = filteredEmployees.reduce((s,e) => s + qg.monthIdxs.reduce((ss,mi) => ss + empAdj(e, mi+1, "salary"), 0), 0);
                              const qBonAi  = filteredEmployees.reduce((s,e) => s + qg.monthIdxs.reduce((ss,mi) => ss + empAi(e, mi+1, "bonus"), 0), 0);
                              const qBonAdj = filteredEmployees.reduce((s,e) => s + qg.monthIdxs.reduce((ss,mi) => ss + empAdj(e, mi+1, "bonus"), 0), 0);
                              const qBenAi  = filteredEmployees.reduce((s,e) => s + qg.monthIdxs.reduce((ss,mi) => ss + empAi(e, mi+1, "benefits"), 0), 0);
                              const qBenAdj = filteredEmployees.reduce((s,e) => s + qg.monthIdxs.reduce((ss,mi) => ss + empAdj(e, mi+1, "benefits"), 0), 0);
                              return (
                                <React.Fragment key={qg.key}>
                                  <td className="px-2 py-3 text-right tabular-nums text-x border-l border-sky-700 bg-sky-800">{fmt(qSalAi)}</td>
                                  <td className="px-2 py-3 text-right tabular-nums text-x bg-sky-800 font-bold">{fmt(qSalAdj)}</td>
                                  <td className="px-2 py-3 text-right tabular-nums text-xs bg-sky-800 text-slate-300">{fmt(qBonAi)}</td>
                                  <td className="px-2 py-3 text-right tabular-nums text-xs bg-sky-800 text-slate-300">{fmt(qBonAdj)}</td>
                                  <td className="px-2 py-3 text-right tabular-nums text-xs bg-sky-800 text-slate-300">{fmt(qBenAi)}</td>
                                  <td className="px-2 py-3 text-right tabular-nums text-xs bg-sky-800 text-slate-300">{fmt(qBenAdj)}</td>
                                </React.Fragment>
                              );
                            })}
                            <td className="px-3 py-3 text-right tabular-nums text-x border-l border-sky-700">{fmt(employees.reduce((s,e) => s + months.reduce((ss,_,mi) => ss + empAi(e, mi+1, "salary") + empAi(e, mi+1, "bonus") + empAi(e, mi+1, "benefits"), 0), 0))}</td>
                            <td className="px-3 py-3 text-right tabular-nums text-s font-bold">{fmt(employees.reduce((s,e) => s + months.reduce((ss,_,mi) => ss + empAdj(e, mi+1, "salary") + empAdj(e, mi+1, "bonus") + empAdj(e, mi+1, "benefits"), 0), 0))}</td>
                            <td className="px-3 py-3 border-l border-sky-700"/>
                          </tr>
                        );
                      })()}
                    </tfoot>
                  </table>
                </div>
              ) : (
                /* ── MONTHLY BREAKDOWN VIEW ───────────────────────── */
                <div className="analytics-table-scroll overflow-x-auto max-h-[72vh] overflow-y-auto">
                  {/* minWidth: employee col + dept + role + prev + N×(salary ai+adj + bonus ai+adj + benefits ai+adj + comment) + total + overall */}
                  <table className="w-full min-w-[2400px] border-collapse text-x">
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-sky-800 border-b border-sky-700">
                        <th rowSpan={2} className="px-4 py-3 text-left  text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700 sticky left-0 bg-sky-800 z-30 min-w-[180px]">Employee</th>
                        <th rowSpan={2} className="px-3 py-3 text-left  text-xs font-semibold text-white uppercase min-w-[100px]">Department</th>
                        <th rowSpan={2} className="px-3 py-3 text-left  text-xs font-semibold text-white uppercase min-w-[130px]">Role</th>
                        <th rowSpan={2} className="px-4 py-3 text-right  text-xs font-semibold text-white uppercase min-w-[90px]">Prev Salary</th>
                        {months.map((m, mi) => (
                          <th key={m} colSpan={7} className={`px-4 py-2.5 text-center text-x font-semibold text-white border-l border-sky-700 bg-sky-800 ${monthTheme[mi % 3].label}`}>{m}</th>
                        ))}
                        <th colSpan={2} className="px-4 py-2.5 text-center text-x font-semibold text-white border-l border-sky-700 bg-sky-900">Quarter Total</th>
                        <th className="px-4 py-2.5 text-center text-x font-semibold text-white border-l border-sky-700 bg-sky-800 min-w-[120px]">Overall Note</th>
                      </tr>
                      <tr className="bg-sky-700 border-b border-slate-600 sticky top-[32px] z-10">
                        {months.map((_, mi) => (
                          <React.Fragment key={mi}>
                            {["Sal AI","Sal Adj","Bon AI","Bon Adj","Ben AI","Ben Adj","Note"].map((h, hi) => (
                              <th key={h} className={`px-2 py-2 text-xs font-medium text-white uppercase whitespace-nowrap ${hi===0?"border-l border-slate-600 text-right":h==="Note"?"text-center":"text-right"}`}>{h}</th>
                            ))}
                          </React.Fragment>
                        ))}
                        <th className="px-3 py-2 text-right text-xs font-medium text-white uppercase border-l border-slate-600">AI</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase">Adj</th>
                        <th className="px-3 py-2 text-center border-l border-slate-600"/>
                      </tr>
                    </thead>
                    <tbody className="text-sm [&_td]:text-sm [&_span]:text-sm [&_input]:text-sm">
                      {filteredEmployees.length === 0
                        ? <tr><td colSpan={99}><EmptyState label="No employees match your filters."/></td></tr>
                        : filteredEmployees.map((emp, idx) => {
                            const isEven  = idx % 2 === 0;
                            const avCls   = avatarClass(emp.employee);
                            const ec      = empChanges[emp.employee]  || {};
                            const mc      = empComments[emp.employee] || {};
                            // Quarter Total is always the live sum of the (possibly just-
                            // edited) monthly salary+bonus+benefits Adjusted cells — never
                            // `emp.quarter_total_adjusted`, which is only set once at load
                            // and is never written back to by handleEmpFieldChange (edits
                            // live in empChanges/`ec`, not on the row itself), so reading it
                            // directly meant this total never moved as the user typed.
                            const qAi = months.reduce((s, _, mi) => {
                              const m = mi + 1;
                              return s + toCalcNumber(emp[`month${m}_ai_salary`]) + toCalcNumber(emp[`month${m}_ai_bonus`]) + toCalcNumber(emp[`month${m}_ai_benefits`]);
                            }, 0);
                            const qAdj = months.reduce((s, _, mi) => {
                              const m = mi + 1;
                              const salAdj = ec[`month${m}_adjusted_salary`]   ?? emp[`month${m}_adjusted_salary`]   ?? emp[`month${m}_ai_salary`];
                              const bonAdj = ec[`month${m}_adjusted_bonus`]    ?? emp[`month${m}_adjusted_bonus`]    ?? emp[`month${m}_ai_bonus`];
                              const benAdj = ec[`month${m}_adjusted_benefits`] ?? emp[`month${m}_adjusted_benefits`] ?? emp[`month${m}_ai_benefits`];
                              return s + toCalcNumber(salAdj) + toCalcNumber(bonAdj) + toCalcNumber(benAdj);
                            }, 0);
                            const hasAdj  = qAdj !== qAi;

                            return (
                              <tr key={`${emp.employee}-${idx}`} className="hc-row border-b border-slate-100 transition-colors">
                                {/* Employee */}
                                <td className="px-4 py-2.5 sticky left-0 border-r border-slate-200 z-[5] bg-white">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${avCls}`}>{getInitials(emp.employee)}</div>
                                    <span className="font-bold text-slate-900 text-x whitespace-nowrap">{emp.employee}</span>
                                    {hasAdj && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"/>}
                                  </div>
                                </td>
                                <td className={`px-3 py-2.5 ${isEven?"bg-white":"bg-slate-50/80"}`}>
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">{emp.department || "—"}</span>
                                </td>
                                <td className={`px-3 py-2.5 text-x text-slate-600 ${isEven?"bg-white":"bg-slate-50/80"}`}>{emp.role || "—"}</td>
                                <td className={`px-4 py-2.5 text-right tabular-nums text-x text-slate-500 ${isEven?"bg-white":"bg-slate-50/80"}`}>{fmt(emp.previous_month_salary)}</td>

                                {/* Month columns */}
                                {months.map((_, mi) => {
                                  const m        = mi + 1;
                                  const th       = monthTheme[mi % 3];
                                  const salAi    = emp[`month${m}_ai_salary`];
                                  const salAdj   = ec[`month${m}_adjusted_salary`]   ?? emp[`month${m}_adjusted_salary`]   ?? salAi;
                                  const bonAi    = emp[`month${m}_ai_bonus`];
                                  const bonAdj   = ec[`month${m}_adjusted_bonus`]    ?? emp[`month${m}_adjusted_bonus`]    ?? bonAi;
                                  const benAi    = emp[`month${m}_ai_benefits`];
                                  const benAdj   = ec[`month${m}_adjusted_benefits`] ?? emp[`month${m}_adjusted_benefits`] ?? benAi;
                                  const salChg   = salAdj !== salAi;
                                  const bonChg   = bonAdj !== bonAi;
                                  const benChg   = benAdj !== benAi;
                                  const monthKey = `month${m}`;
                                  const commentVal = mc[monthKey] || emp[`month${m}_comment`] || "";
                                  const salCellKey = `emp-${emp.employee}-month${m}-salary`;
                                  const bonCellKey = `emp-${emp.employee}-month${m}-bonus`;
                                  const benCellKey = `emp-${emp.employee}-month${m}-benefits`;

                                  return (
                                    <React.Fragment key={mi}>
                                      {/* Salary AI */}
                                      <td className={`px-2 py-2 text-right text-x text-slate-500 tabular-nums border-l border-slate-100 ${th.bg}`}>{fmt(salAi)}</td>
                                      {/* Salary Adj */}
                                      <td className={`px-1.5 py-1.5 ${th.bg}`}>
                                        <input type="number" value={displayEditableNumber(salAdj, focusedCellKey === salCellKey)} step={Math.pow(10, -getDecimalPrecision())} disabled={!canEdit}
                                          onFocus={(e) => { setFocusedCellKey(salCellKey); focusValuesRef.current[salCellKey] = salAdj; e.target.select(); }}
                                          onBlur={() => handleEmpFieldBlur(emp.employee, `month${m}_adjusted_salary`, m, focusValuesRef.current[salCellKey])}
                                          onChange={(e) => handleEmpFieldChange(emp.employee, `month${m}_adjusted_salary`, e.target.value)}
                                          className={`w-24 px-2 py-1 rounded-lg border text-right text-x tabular-nums outline-none transition-all
                                            ${!canEdit?"bg-slate-50 border-slate-200 cursor-not-allowed text-slate-400"
                                              :salChg?"border-blue-400 bg-blue-50 text-blue-900 focus:ring-2 ring-blue-100"
                                              :"border-slate-300 bg-white hover:border-slate-400 focus:border-blue-500 focus:ring-2 ring-blue-100"}`}/>
                                      </td>
                                      {/* Bonus AI */}
                                      <td className={`px-2 py-2 text-right text-x text-slate-500 tabular-nums ${th.bg}`}>{fmtNum(bonAi)}</td>
                                      {/* Bonus Adj */}
                                      <td className={`px-1.5 py-1.5 ${th.bg}`}>
                                        <input type="number" value={displayEditableNumber(bonAdj, focusedCellKey === bonCellKey)} step={Math.pow(10, -getDecimalPrecision())} disabled={!canEdit}
                                          onFocus={(e) => { setFocusedCellKey(bonCellKey); focusValuesRef.current[bonCellKey] = bonAdj; e.target.select(); }}
                                          onBlur={() => handleEmpFieldBlur(emp.employee, `month${m}_adjusted_bonus`, m, focusValuesRef.current[bonCellKey])}
                                          onChange={(e) => handleEmpFieldChange(emp.employee, `month${m}_adjusted_bonus`, e.target.value)}
                                          className={`w-20 px-2 py-1 rounded-lg border text-right text-x tabular-nums outline-none transition-all
                                            ${!canEdit?"bg-slate-50 border-slate-200 cursor-not-allowed text-slate-400"
                                              :bonChg?"border-violet-400 bg-violet-50 text-violet-900 focus:ring-2 ring-violet-100"
                                              :"border-slate-300 bg-white hover:border-slate-400 focus:border-blue-500 focus:ring-2 ring-blue-100"}`}/>
                                      </td>
                                      {/* Benefits AI */}
                                      <td className={`px-2 py-2 text-right text-x text-slate-500 tabular-nums ${th.bg}`}>{fmt(benAi)}</td>
                                      {/* Benefits Adj */}
                                      <td className={`px-1.5 py-1.5 ${th.bg}`}>
                                        <input type="number" value={displayEditableNumber(benAdj, focusedCellKey === benCellKey)} step={Math.pow(10, -getDecimalPrecision())} disabled={!canEdit}
                                          onFocus={(e) => { setFocusedCellKey(benCellKey); focusValuesRef.current[benCellKey] = benAdj; e.target.select(); }}
                                          onBlur={() => handleEmpFieldBlur(emp.employee, `month${m}_adjusted_benefits`, m, focusValuesRef.current[benCellKey])}
                                          onChange={(e) => handleEmpFieldChange(emp.employee, `month${m}_adjusted_benefits`, e.target.value)}
                                          className={`w-24 px-2 py-1 rounded-lg border text-right text-x tabular-nums outline-none transition-all
                                            ${!canEdit?"bg-slate-50 border-slate-200 cursor-not-allowed text-slate-400"
                                              :benChg?"border-emerald-400 bg-emerald-50 text-emerald-900 focus:ring-2 ring-emerald-100"
                                              :"border-slate-300 bg-white hover:border-slate-400 focus:border-blue-500 focus:ring-2 ring-blue-100"}`}/>
                                      </td>
                                      {/* Month Comment */}
                                      <td className={`px-1.5 py-1.5 text-center ${th.bg}`}>
                                        <InlineCommentIcon commentKey={`${emp.employee}-${monthKey}`} value={commentVal}
                                          disabled={!canEdit} onChange={(v) => handleEmpCommentChange(emp.employee, monthKey, v)}
                                          label={`${months[mi] || `Month ${m}`} — ${emp.employee}`}/>
                                      </td>
                                    </React.Fragment>
                                  );
                                })}
                                {/* Quarter totals */}
                                <td className="px-3 py-2 text-right text-x text-slate-500 tabular-nums border-l border-slate-200 bg-slate-50/60">{fmt(qAi)}</td>
                                <td className={`px-3 py-2 text-right text-x font-bold tabular-nums ${qAdj>qAi?"text-red-500":qAdj<qAi?"text-emerald-600":"text-sky-700"}`}>{fmt(qAdj)}</td>
                                {/* Overall comment */}
                                <td className="px-2 py-1.5 border-l border-slate-100 text-center">
                                  <InlineCommentIcon commentKey={`${emp.employee}-overall`} value={mc.overall || emp.overall_comment || ""}
                                    disabled={!canEdit} onChange={(v) => handleEmpCommentChange(emp.employee, "overall", v)}
                                    label={`${emp.employee} — Overall`} isOverall/>
                                </td>
                              </tr>
                            );
                          })}
                    </tbody>
                    {/* Footer totals */}
                    <tfoot>
                      <tr className="bg-sky-900 text-white sticky bottom-0 z-10 font-semibold">
                        <td className="px-4 py-3 text-s sticky left-0 bg-sky-900 border-r border-sky-700 z-[9]">TOTAL</td>
                        <td colSpan={2} className="bg-sky-900"/>
                        <td className="px-4 py-3 text-right tabular-nums text-x">
                          {fmt(employees.reduce((s,e)=>s+(e.previous_month_salary||0),0))}
                        </td>
                        {months.map((_, mi) => {
                          const m = mi + 1;
                          return (
                          <React.Fragment key={mi}>
                            <td className="px-2 py-3 text-right tabular-nums text-x border-l border-sky-700 bg-sky-800">{fmt(employees.reduce((s,e)=>s+toCalcNumber(e[`month${m}_ai_salary`]),0))}</td>
                            {/* Merge in empChanges — this total must reflect in-progress
                                edits too, not just what was true at last fetch. */}
                            <td className="px-2 py-3 text-right tabular-nums text-x bg-sky-800 font-bold">{fmt(employees.reduce((s,e)=>{ const ec = empChanges[e.employee] || {}; return s + toCalcNumber(ec[`month${m}_adjusted_salary`] ?? e[`month${m}_adjusted_salary`] ?? e[`month${m}_ai_salary`]); },0))}</td>
                            <td className="px-2 py-3 text-right tabular-nums text-xs bg-sky-800 text-slate-300">{fmt(employees.reduce((s,e)=>s+(e[`month${m}_ai_bonus`]||0),0))}</td>
                            <td className="px-2 py-3 bg-sky-800"/>
                            <td className="px-2 py-3 text-right tabular-nums text-xs bg-sky-800 text-slate-300">{fmt(employees.reduce((s,e)=>s+(e[`month${m}_ai_benefits`]||0),0))}</td>
                            <td className="px-2 py-3 bg-sky-800"/>
                            <td className="px-2 py-3 bg-sky-800"/>
                          </React.Fragment>
                          );
                        })}
                        <td className="px-3 py-3 text-right tabular-nums text-x border-l border-sky-700">{fmt(base.total_ai)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-s font-bold">{fmt(base.total_user)}</td>
                        <td className="px-3 py-3 border-l border-sky-700">
                          <span className={`text-x font-bold tabular-nums ${(base.variance_amount||0)<=0?"text-emerald-400":"text-red-400"}`}>
                            {(base.variance_amount||0)>=0?"+":""}{fmt(base.variance_amount)} ({Number(base.variance_percent||0).toFixed(getDecimalPrecision())}%)
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
            {viewType !== "quarter_summary" && (
              <SaveBar hasChanges={hasEmpChanges} saving={saving} onSave={handleSaveEmployees} disabled={!canEdit}
                label="Save Employee Adjustments"/>
            )}
          </div>
        )}

        {/* ══ HEADCOUNT TAB ════════════════════════════════════════════ */}
        {activeTab === "headcount" && (
          <div>
            {/* Headcount summary bar */}
            {apiData?.headcount_summary && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: "Target Headcount (End)", value: apiData.headcount_summary.target_headcount_end, color: "text-sky-700" },
                  { label: "Projected Headcount (End)", value: apiData.headcount_summary.projected_headcount_end, color: "text-slate-700" },
                  { label: "Variance (Target vs Projected)", value: apiData.headcount_summary.variance_target_vs_projected,
                    color: apiData.headcount_summary.variance_target_vs_projected > 0 ? "text-red-500" : "text-emerald-600" },
                ].map((item) => (
                  <div key={item.label} className="bg-white rounded-xl border border-slate-200 px-5 py-4 shadow-sm flex items-center justify-between">
                    <span className="text-x text-slate-500 font-medium">{item.label}</span>
                    <span className={`text-2xl font-bold tabular-nums ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            )}


            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {loading ? <TableSkeleton columns={5} rows={8} /> : (
                <div className="analytics-table-scroll overflow-x-auto max-h-[72vh] overflow-y-auto">
                  <table className="w-full min-w-[1100px] border-collapse text-s">
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-sky-800 border-b border-sky-700">
                        <th rowSpan={2} className="px-4 py-3 text-left  text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700 sticky left-0 bg-sky-800 z-30 min-w-[160px]">Department</th>
                        <th rowSpan={2} className="px-4 py-3 text-right  text-xs font-semibold text-white uppercase min-w-[90px]">Prev Count</th>
                        {viewType === "quarter_summary" && quarterGroups
                          ? quarterGroups.map((qg, qi) => (
                              <th key={qg.key} colSpan={2} className={`px-4 py-2.5 text-center text-x font-semibold text-white border-l border-sky-700 bg-sky-800 ${monthTheme[qi % 3].label}`}>{qg.label}</th>
                            ))
                          : months.map((m, mi) => (
                              <th key={m} colSpan={3} className={`px-4 py-2.5 text-center text-x font-semibold text-white border-l border-sky-700 bg-sky-800 ${monthTheme[mi % 3].label}`}>{m}</th>
                            ))
                        }
                        <th rowSpan={2} className="px-4 py-3 text-center  text-xs font-semibold text-white border-l border-sky-700 min-w-[130px]">Overall Note</th>
                      </tr>
                      <tr className="bg-sky-700 border-b border-slate-600 sticky top-[32px] z-10">
                        {viewType === "quarter_summary" && quarterGroups
                          ? quarterGroups.map((qg) => (
                              <React.Fragment key={qg.key}>
                                <th className="px-3 py-2 text-right text-xs font-medium text-white uppercase border-l border-slate-600 min-w-[70px]">AI (End)</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase min-w-[90px]">Adjusted</th>
                              </React.Fragment>
                            ))
                          : months.map((_, mi) => (
                              <React.Fragment key={mi}>
                                <th className="px-3 py-2 text-right text-xs font-medium text-white uppercase border-l border-slate-600 min-w-[70px]">AI</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase min-w-[90px]">Adjusted</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-white uppercase min-w-[120px]">Comment</th>
                              </React.Fragment>
                            ))
                        }
                      </tr>
                    </thead>
                    <tbody className="text-sm [&_td]:text-sm [&_span]:text-sm [&_input]:text-sm">
                      {deptRows.length === 0
                        ? <tr><td colSpan={99}><EmptyState label="No department data available."/></td></tr>
                        : deptRows.map((dept, idx) => {
                            const isEven = idx % 2 === 0;
                            const avCls  = avatarClass(dept.Department);
                            const dc     = deptChanges[dept.Department]  || {};
                            const mc     = deptComments[dept.Department] || {};

                            return (
                              <tr key={dept.Department} className="hc-row border-b border-slate-100 transition-colors">
                                <td className="px-4 py-2.5 sticky left-0 border-r border-slate-200 z-[5] bg-white">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${avCls}`}>{getInitials(dept.Department)}</div>
                                    <span className="font-bold text-slate-900 text-x">{dept.Department}</span>
                                  </div>
                                </td>
                                <td className={`px-4 py-2.5 text-right tabular-nums text-x text-slate-600 font-semibold ${isEven?"bg-white":"bg-slate-50/80"}`}>{dept.previous_month_count}</td>

                                {viewType === "quarter_summary" && quarterGroups
                                  ? quarterGroups.map((qg, qi) => {
                                      // Use the last month of the quarter as end-of-quarter count
                                      const lastMi = qg.monthIdxs[qg.monthIdxs.length - 1];
                                      const m = lastMi + 1;
                                      const th = monthTheme[qi % 3];
                                      const aiVal  = dept[`month${m}_ai_count`];
                                      const adjVal = dc[`month${m}_adjusted_count`] ?? dept[`month${m}_adjusted_count`] ?? aiVal;
                                      const changed = adjVal !== aiVal;
                                      const cellKey = `dept-${dept.Department}-month${m}`;
                                      return (
                                        <React.Fragment key={qg.key}>
                                          <td className={`px-3 py-2 text-right text-x text-slate-500 tabular-nums border-l border-slate-100 ${th.bg}`}>{aiVal}</td>
                                          <td className={`px-2 py-1.5 ${th.bg}`}>
                                            <input type="number" value={adjVal ?? ""} disabled={!canEdit}
                                              onFocus={(e) => { setFocusedCellKey(cellKey); e.target.select(); }}
                                              onBlur={() => setFocusedCellKey(null)}
                                              onChange={(e) => handleDeptFieldChange(dept.Department, `month${m}_adjusted_count`, e.target.value)}
                                              className={`w-20 px-2 py-1 rounded-lg border text-right text-x tabular-nums outline-none transition-all
                                                ${!canEdit?"bg-slate-50 border-slate-200 cursor-not-allowed text-slate-400"
                                                  :changed?"border-blue-400 bg-blue-50 text-blue-900 focus:ring-2 ring-blue-100"
                                                  :"border-slate-300 bg-white hover:border-slate-400 focus:border-blue-500 focus:ring-2 ring-blue-100"}`}/>
                                          </td>
                                        </React.Fragment>
                                      );
                                    })
                                  : months.map((_, mi) => {
                                      const m      = mi + 1;
                                      const th     = monthTheme[mi % 3];
                                      const aiVal  = dept[`month${m}_ai_count`];
                                      const adjVal = dc[`month${m}_adjusted_count`] ?? dept[`month${m}_adjusted_count`] ?? aiVal;
                                      const changed = adjVal !== aiVal;
                                      const commentVal = mc[`month${m}`] || dept[`month${m}_comment`] || "";
                                      const cellKey = `dept-${dept.Department}-month${m}`;
                                      return (
                                        <React.Fragment key={mi}>
                                          <td className={`px-3 py-2 text-right text-x text-slate-500 tabular-nums border-l border-slate-100 ${th.bg}`}>{aiVal}</td>
                                          <td className={`px-2 py-1.5 ${th.bg}`}>
                                            <input type="number" value={adjVal ?? ""} disabled={!canEdit}
                                              onFocus={(e) => { setFocusedCellKey(cellKey); focusValuesRef.current[cellKey] = adjVal; e.target.select(); }}
                                              onBlur={() => handleDeptFieldBlur(dept.Department, m, focusValuesRef.current[cellKey])}
                                              onChange={(e) => handleDeptFieldChange(dept.Department, `month${m}_adjusted_count`, e.target.value)}
                                              className={`w-20 px-2 py-1 rounded-lg border text-right text-x tabular-nums outline-none transition-all
                                                ${!canEdit?"bg-slate-50 border-slate-200 cursor-not-allowed text-slate-400"
                                                  :changed?"border-blue-400 bg-blue-50 text-blue-900 focus:ring-2 ring-blue-100"
                                                  :"border-slate-300 bg-white hover:border-slate-400 focus:border-blue-500 focus:ring-2 ring-blue-100"}`}/>
                                          </td>
                                          <td className={`px-2 py-1.5 text-center ${th.bg}`}>
                                            <InlineCommentIcon commentKey={`${dept.Department}-month${m}`} value={commentVal}
                                              disabled={!canEdit} onChange={(v) => handleDeptCommentChange(dept.Department, `month${m}`, v)}
                                              label={`${months[mi] || `Month ${m}`} — ${dept.Department}`}/>
                                          </td>
                                        </React.Fragment>
                                      );
                                    })
                                }

                                <td className="px-2 py-1.5 border-l border-slate-100 text-center">
                                  <InlineCommentIcon commentKey={`${dept.Department}-overall`} value={mc.overall || dept.overall_comment || ""}
                                    disabled={!canEdit} onChange={(v) => handleDeptCommentChange(dept.Department, "overall", v)}
                                    label={`${dept.Department} — Overall`} isOverall/>
                                </td>
                              </tr>
                            );
                          })}
                    </tbody>
                    {apiData?.department_headcount_projections?.Total_Projected && (() => {
                      const tp = apiData.department_headcount_projections.Total_Projected;
                      return (
                        <tfoot>
                          <tr className="bg-sky-900 text-white sticky bottom-0 z-10">
                            <td className="px-4 py-3 font-bold text-s uppercase tracking-wide sticky left-0 bg-sky-900 border-r border-sky-700 z-[9]">
                              Grand Total
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums font-bold text-s">
                              {tp.previous_month_count}
                            </td>
                            {viewType === "quarter_summary" && quarterGroups
                              ? quarterGroups.map((qg) => {
                                  const lastMi = qg.monthIdxs[qg.monthIdxs.length - 1];
                                  const m = lastMi + 1;
                                  return (
                                    <React.Fragment key={qg.key}>
                                      <td className="px-3 py-3 text-right tabular-nums text-x border-l border-sky-700 text-sky-200">
                                        {tp[`month${m}_ai_count`]}
                                      </td>
                                      <td className="px-3 py-3 text-right tabular-nums font-bold text-s text-white">
                                        {tp[`month${m}_adjusted_count`]}
                                      </td>
                                    </React.Fragment>
                                  );
                                })
                              : months.map((_, mi) => {
                                  const m = mi + 1;
                                  return (
                                    <React.Fragment key={mi}>
                                      <td className="px-3 py-3 text-right tabular-nums text-x border-l border-sky-700 text-sky-200">
                                        {tp[`month${m}_ai_count`]}
                                      </td>
                                      <td className="px-3 py-3 text-right tabular-nums font-bold text-s text-white">
                                        {tp[`month${m}_adjusted_count`]}
                                      </td>
                                      <td className="px-3 py-3 border-l border-sky-700" />
                                    </React.Fragment>
                                  );
                                })
                            }
                            <td className="px-3 py-3 border-l border-sky-700" />
                          </tr>
                        </tfoot>
                      );
                    })()}
                  </table>
                </div>
              )}
            </div>
            <SaveBar hasChanges={hasDeptChanges} saving={deptSaving} onSave={_doSaveDepartments} disabled={!canEdit}
              label="Save Headcount Adjustments"/>
          </div>
        )}

        {/* ══ DRIVERS TAB ══════════════════════════════════════════════ */}
        {activeTab === "drivers" && (
          <div>
            {loading ? <Spinner label="Loading drivers…"/> : driverEmpNames.length === 0
              ? <EmptyState label="No driver data available."/>
              : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="analytics-table-scroll overflow-x-auto max-h-[66vh] overflow-y-auto">
                    <table className="w-full min-w-[2100px] border-collapse text-x">
                      <thead className="sticky top-0 z-20">
                        <tr className="bg-sky-800 border-b border-sky-700">
                          <th className="sticky left-0 z-30 bg-sky-800 px-4 py-3 text-left  text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700 min-w-[180px]">Employee</th>
                          {viewType === "quarter_summary" && quarterGroups
                            ? quarterGroups.map((qg, qi) => (
                                <th key={qg.key} colSpan={6} className={`px-4 py-2.5 text-center text-x font-semibold text-white border-l border-sky-700 bg-sky-800 ${monthTheme[qi % 3].label}`}>{qg.label}</th>
                              ))
                            : months.map((m, mi) => (
                                <th key={m} colSpan={7} className={`px-4 py-2.5 text-center text-x font-semibold text-white border-l border-sky-700 bg-sky-800 ${monthTheme[mi % 3].label}`}>{m}</th>
                              ))
                          }
                          <th colSpan={2} className="px-4 py-2.5 text-center text-x font-semibold text-white border-l border-sky-700 bg-sky-900">Total</th>
                        </tr>
                        <tr className="bg-sky-700 border-b border-slate-600 sticky top-[32px] z-10">
                          <th className="sticky left-0 z-30 bg-sky-700 border-r border-slate-600"/>
                          {viewType === "quarter_summary" && quarterGroups
                            ? quarterGroups.map((qg) => (
                                <React.Fragment key={qg.key}>
                                  {["Sal AI","Sal Adj","Bon AI","Bon Adj","Ben AI","Ben Adj"].map((h, hi) => (
                                    <th key={h} className={`px-2 py-2 text-xs font-medium text-white uppercase whitespace-nowrap ${hi===0?"border-l border-slate-600 text-right":"text-right"}`}>{h}</th>
                                  ))}
                                </React.Fragment>
                              ))
                            : months.map((_, mi) => (
                                <React.Fragment key={mi}>
                                  {["Sal AI","Sal Adj","Bon AI","Bon Adj","Ben AI","Ben Adj","Comment"].map((h, hi) => (
                                    <th key={h} className={`px-2 py-2 text-xs font-medium text-white uppercase whitespace-nowrap ${hi===0?"border-l border-slate-600 text-right":h==="Comment"?"text-left":"text-right"}`}>{h}</th>
                                  ))}
                                </React.Fragment>
                              ))
                          }
                          <th className="px-3 py-2 text-right text-xs font-medium text-white uppercase border-l border-slate-600">AI</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase">Adj</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm [&_td]:text-sm [&_span]:text-sm [&_input]:text-sm">
                        {driverEmpNames.map((empName, rowIdx) => {
                          const isEven = rowIdx % 2 === 0;
                          const avCls  = avatarClass(empName);
                          const empDriverRows = driverRows.filter((r) => r.employee_name === empName);
                          let qAi = 0, qAdj = 0;

                          const cells = viewType === "quarter_summary" && quarterGroups
                            ? quarterGroups.map((qg, qi) => {
                                const th = monthTheme[qi % 3];
                                const qRows = qg.monthIdxs.map((mi) => empDriverRows[mi]).filter(Boolean);
                                if (!qRows.length) return (
                                  <React.Fragment key={qg.key}>
                                    {Array(6).fill(0).map((_,i)=><td key={i} className={`px-2 py-2 text-center text-slate-300 ${i===0?"border-l border-slate-100":""} ${th.bg}`}>—</td>)}
                                  </React.Fragment>
                                );
                                const salAi  = qRows.reduce((s,r) => s+(r.salary_ai   ||0),0);
                                const bonAi  = qRows.reduce((s,r) => s+(r.bonus_ai    ||0),0);
                                const benAi  = qRows.reduce((s,r) => s+(r.benefits_ai ||0),0);
                                // toCalcNumber, not a bare `??`/`+`: a row's adjusted value can be
                                // the raw string the user is mid-typing, and `0 + "<string>"` would
                                // concatenate instead of adding.
                                const salAdj = qRows.reduce((s,r) => { const dc=driverChanges[`${empName}-${r.month}`]||{}; return s+toCalcNumber(dc.salary_adjusted   ?? r.salary_adjusted   ?? r.salary_ai); },0);
                                const bonAdj = qRows.reduce((s,r) => { const dc=driverChanges[`${empName}-${r.month}`]||{}; return s+toCalcNumber(dc.bonus_adjusted     ?? r.bonus_adjusted    ?? r.bonus_ai); },0);
                                const benAdj = qRows.reduce((s,r) => { const dc=driverChanges[`${empName}-${r.month}`]||{}; return s+toCalcNumber(dc.benefits_adjusted  ?? r.benefits_adjusted ?? r.benefits_ai); },0);
                                qAi  += salAi  + bonAi  + benAi;
                                qAdj += salAdj + bonAdj + benAdj;
                                return (
                                  <React.Fragment key={qg.key}>
                                    <td className={`px-2 py-2 text-right text-x text-slate-500 tabular-nums border-l border-slate-100 ${th.bg}`}>{fmt(salAi)}</td>
                                    <td className={`px-2 py-2 text-right text-x tabular-nums font-semibold ${th.bg} ${salAdj>salAi?"text-red-500":salAdj<salAi?"text-emerald-600":"text-slate-700"}`}>{fmt(salAdj)}</td>
                                    <td className={`px-2 py-2 text-right text-x text-slate-500 tabular-nums ${th.bg}`}>{fmtNum(bonAi)}</td>
                                    <td className={`px-2 py-2 text-right text-x tabular-nums ${th.bg} ${bonAdj>bonAi?"text-red-500":bonAdj<bonAi?"text-emerald-600":"text-slate-600"}`}>{fmtNum(bonAdj)}</td>
                                    <td className={`px-2 py-2 text-right text-x text-slate-500 tabular-nums ${th.bg}`}>{fmt(benAi)}</td>
                                    <td className={`px-2 py-2 text-right text-x tabular-nums ${th.bg} ${benAdj>benAi?"text-red-500":benAdj<benAi?"text-emerald-600":"text-slate-600"}`}>{fmt(benAdj)}</td>
                                  </React.Fragment>
                                );
                              })
                            : months.map((_, mi) => {
                            // drivers use full date "2025-01-01" format
                            const monthDate = empDriverRows[mi]?.month;
                            const r = empDriverRows[mi];
                            if (!r) return <React.Fragment key={mi}>{Array(7).fill(0).map((_,i)=><td key={i} className={`px-2 py-2 text-center text-slate-300 ${i===0?"border-l border-slate-100":""}  ${monthTheme[mi % 3].bg}`}>—</td>)}</React.Fragment>;

                            const k  = `${empName}-${r.month}`;
                            const dc = driverChanges[k]  || {};
                            const th = monthTheme[mi % 3];
                            const salAi  = r.salary_ai;
                            const salAdj = dc.salary_adjusted   ?? r.salary_adjusted   ?? salAi;
                            const bonAi  = r.bonus_ai;
                            const bonAdj = dc.bonus_adjusted     ?? r.bonus_adjusted    ?? bonAi;
                            const benAi  = r.benefits_ai;
                            const benAdj = dc.benefits_adjusted  ?? r.benefits_adjusted ?? benAi;
                            // toCalcNumber, not `||0`: salAdj/bonAdj/benAdj can be the raw
                            // string the user is mid-typing, and `0 + "<string>"` concatenates.
                            const totAdj = toCalcNumber(salAdj) + toCalcNumber(bonAdj) + toCalcNumber(benAdj);
                            qAi  += r.total_cost_ai  || 0;
                            qAdj += totAdj;
                            const salChg = salAdj !== salAi;
                            const bonChg = bonAdj !== bonAi;
                            const benChg = benAdj !== benAi;
                            const commentVal = driverComments[k] || r.month_comment || "";
                            const salCellKey = `driver-${k}-salary`;
                            const bonCellKey = `driver-${k}-bonus`;
                            const benCellKey = `driver-${k}-benefits`;

                            return (
                              <React.Fragment key={mi}>
                                <td className={`px-2 py-2 text-right text-x text-slate-500 tabular-nums border-l border-slate-100 ${th.bg}`}>{fmt(salAi)}</td>
                                <td className={`px-1.5 py-1.5 ${th.bg}`}>
                                  <input type="number" value={salAdj ?? ""} disabled={!canEdit}
                                    onFocus={(e) => { setFocusedCellKey(salCellKey); e.target.select(); }}
                                    onBlur={() => setFocusedCellKey(null)}
                                    onChange={(e) => handleDriverFieldChange(empName, r.month, "salary_adjusted", e.target.value)}
                                    className={`w-24 px-2 py-1 rounded-lg border text-right text-x tabular-nums outline-none transition-all
                                      ${!canEdit?"bg-slate-50 border-slate-200 cursor-not-allowed text-slate-400":salChg?"border-blue-400 bg-blue-50 text-blue-900 focus:ring-2 ring-blue-100":"border-slate-300 bg-white hover:border-slate-400 focus:border-blue-500 focus:ring-2 ring-blue-100"}`}/>
                                </td>
                                <td className={`px-2 py-2 text-right text-x text-slate-500 tabular-nums ${th.bg}`}>{fmtNum(bonAi)}</td>
                                <td className={`px-1.5 py-1.5 ${th.bg}`}>
                                  <input type="number" value={bonAdj ?? ""} disabled={!canEdit}
                                    onFocus={(e) => { setFocusedCellKey(bonCellKey); e.target.select(); }}
                                    onBlur={() => setFocusedCellKey(null)}
                                    onChange={(e) => handleDriverFieldChange(empName, r.month, "bonus_adjusted", e.target.value)}
                                    className={`w-20 px-2 py-1 rounded-lg border text-right text-x tabular-nums outline-none transition-all
                                      ${!canEdit?"bg-slate-50 border-slate-200 cursor-not-allowed text-slate-400":bonChg?"border-violet-400 bg-violet-50 text-violet-900 focus:ring-2 ring-violet-100":"border-slate-300 bg-white hover:border-slate-400 focus:border-blue-500 focus:ring-2 ring-blue-100"}`}/>
                                </td>
                                <td className={`px-2 py-2 text-right text-x text-slate-500 tabular-nums ${th.bg}`}>{fmt(benAi)}</td>
                                <td className={`px-1.5 py-1.5 ${th.bg}`}>
                                  <input type="number" value={benAdj ?? ""} disabled={!canEdit}
                                    onFocus={(e) => { setFocusedCellKey(benCellKey); e.target.select(); }}
                                    onBlur={() => setFocusedCellKey(null)}
                                    onChange={(e) => handleDriverFieldChange(empName, r.month, "benefits_adjusted", e.target.value)}
                                    className={`w-24 px-2 py-1 rounded-lg border text-right text-x tabular-nums outline-none transition-all
                                      ${!canEdit?"bg-slate-50 border-slate-200 cursor-not-allowed text-slate-400":benChg?"border-emerald-400 bg-emerald-50 text-emerald-900 focus:ring-2 ring-emerald-100":"border-slate-300 bg-white hover:border-slate-400 focus:border-blue-500 focus:ring-2 ring-blue-100"}`}/>
                                </td>
                                <td className={`px-1.5 py-1.5 text-center ${th.bg}`}>
                                  <InlineCommentIcon commentKey={`${empName}-${r.month}`} value={commentVal}
                                    disabled={!canEdit} onChange={(v) => handleDriverCommentChange(empName, r.month, v)}
                                    label={`${months[mi] || `Month ${mi+1}`} — ${empName}`}/>
                                </td>
                              </React.Fragment>
                            );
                          });

                          return (
                            <tr key={empName} className={`hc-row border-b border-slate-100 transition-colors ${isEven?"bg-white":"bg-slate-50/60"}`}>
                              <td className="sticky left-0 z-[5] border-r border-slate-200 px-4 py-2.5 bg-white">
                                <div className="flex items-center gap-2">
                                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${avCls}`}>{getInitials(empName)}</div>
                                  <span className="font-bold text-slate-900 text-x whitespace-nowrap">{empName}</span>
                                </div>
                              </td>
                              {cells}
                              {/* qAi/qAdj were just live-accumulated across the cells above —
                                  use those, not the row's stale `quarter_total_cost_ai/_adjusted`
                                  snapshot fields, which don't move as the user edits. */}
                              <td className="px-3 py-2 text-right text-x text-slate-500 tabular-nums border-l border-slate-200 bg-slate-50">{fmt(qAi)}</td>
                              <td className={`px-3 py-2 text-right text-x font-bold tabular-nums ${qAdj > qAi?"text-red-500":qAdj < qAi?"text-emerald-600":"text-sky-700"}`}>
                                {fmt(qAdj)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            <SaveBar hasChanges={hasDriverChanges} saving={driverSaving} onSave={handleSaveDriversChained} disabled={!canEdit}
              label="Save Driver Adjustments"/>
          </div>
        )}

        {/* ══ SCENARIOS TAB ════════════════════════════════════════════ */}
        {activeTab === "scenarios" && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="font-bold text-slate-900 text-s">Payroll Forecast Scenarios</h2>
                <p className="text-x text-slate-500 mt-0.5">Manage baseline, best case, worst case and custom payroll scenarios</p>
              </div>
              <button onClick={() => setScenarioModal({ open:true, edit:null })}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-x font-semibold transition-all shadow-sm">
                <FiPlus size={13}/> New Scenario
              </button>
            </div>

            {scenarioLoading ? <Spinner label="Loading scenarios…"/> : scenariosList.length === 0
              ? <EmptyState label="No scenarios found. Create your first scenario."/>
              : (
                <div className="flex flex-col gap-4">
                  {/* Scenario cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {scenariosList.map((sc) => {
                      const style    = getScStyle(sc);
                      const compData = apiData?.Compare_Payroll_Forecast_Scenarios;
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
                                  <p className=" text-xs text-slate-400 tabular-nums">{year} · {quarter} · {sc.multiplier}×</p>
                                  {sc.parameter_types?.length > 0 && (
                                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                                      {sc.parameter_types.map((pt) => (
                                        <span key={pt} className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 text-xs font-semibold border border-sky-200 capitalize">{pt}</span>
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
                                    <button onClick={() => { setScenarioModal({open:true,edit:sc}); setOpenMenuId(null); }} disabled={sc.is_system && !sc.id}
                                      className="flex items-center gap-2 w-full px-3 py-2.5 text-x text-sky-700 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                      <FiEdit2 size={12}/> Edit
                                    </button>
                                    <button onClick={() => { setDeleteModal({open:true,scenario:sc}); setOpenMenuId(null); }} disabled={sc.is_system}
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
                                <p className="text-xs text-slate-500 font-medium mb-0.5">User Total</p>
                                <p className="text-s font-bold text-slate-900 tabular-nums">{fmt(totalUser)}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 border border-slate-200">
                              <span className=" text-xs text-slate-500 font-medium">Variance</span>
                              <span className={`text-x font-bold tabular-nums ${Number(vAmt)>0?"text-red-600":"Number(vAmt)<0"?"text-emerald-600":"text-slate-500"}`}>
                                {Number(vAmt)>=0?"+":""}{fmt(vAmt)} ({vPct}%)
                              </span>
                            </div>
                            {sc.description && <p className="text-x text-slate-500 mt-2.5 leading-relaxed line-clamp-2">{sc.description}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Comparison table */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                      <FiBarChart2 className="text-slate-500" size={14}/>
                      <span className="font-semibold text-sky-800 text-s">Scenario Comparison — {year} {quarter}</span>
                      <span className="ml-auto  text-xs text-slate-400 tabular-nums">{scenariosList.length} scenarios</span>
                    </div>
                    <div className="analytics-table-scroll overflow-x-auto">
                      <table className="w-full border-collapse text-s">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-4 py-3 text-left  text-xs font-semibold text-slate-500 uppercase tracking-wide">Metric</th>
                            {scenariosList.map((sc) => (
                              <th key={sc.id??sc.scenario_name} className="px-4 py-3 text-right  text-xs font-semibold text-sky-700 capitalize tracking-wide">
                                {sc.scenario_name.replace(/_/g," ")}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="text-sm [&_td]:text-sm [&_span]:text-sm [&_input]:text-sm">
                          {[
                            { label: "Multiplier",    fn: (sc) => `${sc.multiplier}×` },
                            { label: "AI Total",      fn: (sc) => { const c=apiData?.Compare_Payroll_Forecast_Scenarios; const b=toCalcNumber(c?.baseline?.total_ai); const d=c?.[sc.scenario_name]; return fmt(toCalcNumber(d?.total_ai)||(b*(toCalcNumber(sc.multiplier)||1))); } },
                            { label: "User Forecast", fn: (sc) => { const c=apiData?.Compare_Payroll_Forecast_Scenarios; const b=toCalcNumber(c?.baseline?.total_ai); const d=c?.[sc.scenario_name]; return fmt(toCalcNumber(d?.total_user)||(b*(toCalcNumber(sc.multiplier)||1))); }, bold: true },
                            { label: "Variance ($)",  fn: (sc) => { const c=apiData?.Compare_Payroll_Forecast_Scenarios; const d=c?.[sc.scenario_name]; if(!d)return"—"; const dAi=toCalcNumber(d.total_ai); const dUser=toCalcNumber(d.total_user); const v=toCalcNumber(d.variance_amount)||(dUser-dAi); return <span className={v>0?"text-red-600 font-bold":"text-emerald-600 font-bold"}>{v>=0?"+":""}{fmt(v)}</span>; } },
                            { label: "Variance (%)",  fn: (sc) => { const c=apiData?.Compare_Payroll_Forecast_Scenarios; const d=c?.[sc.scenario_name]; if(!d)return"—"; const v=toCalcNumber(d.variance_percent); return <span className={v>0?"text-red-600 font-bold":"text-emerald-600 font-bold"}>{v>=0?"+":""}{v.toFixed(getDecimalPrecision())}%</span>; } },
                            { label: "Parameters",    fn: (sc) => sc.parameter_types?.join(", ") || "—" },
                          ].map((row, ri) => (
                            <tr key={row.label} className={`border-b border-slate-100 ${ri%2===0?"bg-white":"bg-slate-50/40"}`}>
                              <td className="px-4 py-3 font-medium text-sky-700 text-s">{row.label}</td>
                              {scenariosList.map((sc) => (
                                <td key={sc.id??sc.scenario_name} className={`px-4 py-3 text-right tabular-nums text-s ${row.bold?"font-bold text-slate-900":"text-slate-600"}`}>
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
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-sky-500"/>{employees.length} employees</span>
            <span className="text-slate-200">·</span>
            <span>{deptRows.length} departments</span>
            <span className="text-slate-200">·</span>
            <span>Year: <strong className="text-slate-600">{year}</strong></span>
            <span className="text-slate-200">·</span>
            <span>Quarter: <strong className="text-slate-600">{quarter}</strong></span>
            <span className="text-slate-200">·</span>
            <span>Stage: <strong className="text-sky-700">{STAGE_LABELS[stage]}</strong></span>
            <span className="text-slate-200">·</span>
            <span>AI Total: <strong className="text-slate-600">{fmt(base.total_ai)}</strong></span>
            <span className="text-slate-200">·</span>
            <span>Adjusted: <strong className="text-sky-700">{fmt(base.total_user)}</strong></span>
          </div>
        )}
        */}

        <OverallChat year={year} quarter={quarter} token={token} API_BASE={API_BASE} addToast={addToast}/>

      </main>
    </div>
  );
}

