// ExpenseForecasting.jsx
import React, { useState, useRef, useEffect, useMemo, useCallback, useContext } from "react";
import {
  FiRefreshCw, FiDownload, FiUpload, FiSearch, FiX,
  FiTrendingUp, FiBarChart2, FiSettings, FiUsers,
  FiAlertCircle, FiPlus, FiEdit2, FiTrash2, FiMoreVertical,
  FiFilter, FiChevronDown, FiChevronRight, FiMessageSquare,
} from "react-icons/fi";

import { AuthContext } from "../../context/AuthContext";
import { BudgetYearContext } from "../../context/BudgetYearContext";
import { useCurrentQuarter } from "../../hooks/useCurrentQuarter";
import { API_BASE_URL } from "../../config/config";

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

import {
  getQuarterMonths, STAGE_LABELS, STAGE_CONFIG, CAT_CONFIG, TYPE_CONFIG,
  fmt, parseApiError, getInitials, avatarClass,
  useToast, ToastContainer, Spinner, EmptyState,
  CenterErrorModal, WorkflowModal, ExcelUploadPreviewModal,
  WorkflowProgress, KpiCards, SaveBar, CommentCell,
  InlineCommentIcon,      // NEW
  ScenarioModal, OverallChat,
} from "./ExpenseForecastHelpers";
import TableSkeleton from "../Skeleton/TableSkeleton";
import { getDecimalPrecision } from '../../utils/formatters';

const API_BASE = `${API_BASE_URL}/api/v1/forecasting/managemet/expense-forecast`;

const WORKFLOW_ACTIONS = {
  submitted: "submit_for_review",
  reviewed:  "mark_as_reviewed",
  approved:  "approve",
  locked:    "lock",
  draft:     "reject",
};

const TABS = [
  { id: "summary",   label: "Summary",          icon: <FiBarChart2 size={13}/> },
  { id: "drivers",   label: "Drivers",           icon: <FiSettings size={13}/> },
  { id: "people",    label: "Employee Expenses", icon: <FiUsers size={13}/>    },
  { id: "scenarios", label: "Scenarios",         icon: <FiTrendingUp size={13}/> },
];

const CURRENCY_FILTER_OPTIONS = [
  { value: "actualvalue", label: "Actual" },
  { value: "thousands", label: "Thousands" },
  { value: "millions", label: "Millions" },
];

const SUMMARY_TABLE_COLSPAN = 15;

/* Employee expense compensation components — the backend's
   employee_expense_adjustments table keys rows by these exact
   (capitalized) expense_item strings, separate from the lowercase keys
   used on the emp.salary / emp.bonus / etc objects in the API response. */
const EMPLOYEE_COMPONENTS = ["salary", "bonus", "benefits", "pension"];
const EMPLOYEE_COMPONENT_TO_EXPENSE_ITEM = {
  salary: "Salaries", bonus: "Bonus", benefits: "Benefits", pension: "Pension",
};
/* The employee_expense_adjustments table only has month1/2/3 columns
   (quarter-only) — adjustments beyond the 3rd selected month can't be
   persisted, regardless of forecast type, so those cells stay read-only. */
const EMPLOYEE_EDITABLE_MONTH_LIMIT = 3;

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

  // Accept values like "$1,234.50", "(1,234.50)", and plain numeric strings.
  const negativeWrapped = /^\(.*\)$/.test(t);
  const cleaned = t.replace(/[,$\s]/g, "").replace(/[()]/g, "");
  const parsed = Number(cleaned);
  if (Number.isFinite(parsed)) return negativeWrapped ? -parsed : parsed;
  return null;
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

function getQuarterMonthKey(year, quarter, monthIndex, fiscalYearStartMonth = 1) {
  const quarterStartPos = { Q1: 0, Q2: 3, Q3: 6, Q4: 9 }[quarter] ?? 0;
  const offset = (fiscalYearStartMonth || 1) - 1 + quarterStartPos + monthIndex;
  const month = (offset % 12) + 1;
  const yearAdd = Math.floor(offset / 12);
  return `${year + yearAdd}-${String(month).padStart(2, "0")}`;
}

// ─── UnsavedChangesModal ──────────────────────────────────────────────────────
function UnsavedChangesModal({ open, saving, onSave, onDiscard, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1100] bg-sky-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-[400px] shadow-2xl border border-sky-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="h-1 bg-amber-400"/>
        <div className="px-6 py-5">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <FiAlertCircle className="text-amber-500" size={20}/>
            </div>
            <div>
              <h3 className="font-bold text-sky-900 text-base">Unsaved Changes</h3>
              <p className="text-sky-500 text-s mt-1 leading-relaxed">You have unsaved changes. Would you like to save before continuing?</p>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-sky-200 bg-white hover:bg-sky-50 text-sky-700 text-s font-semibold transition-colors">Stay</button>
            <button onClick={onDiscard} className="px-4 py-2 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-600 text-s font-semibold transition-colors">Discard</button>
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
// Shown when the user edits a Summary "Adjusted" month cell and then blurs it
// with the value actually changed — offers to propagate that value to all 12
// months for the item instead of leaving it scoped to just that one month.
function ApplyAllMonthsModal({ open, itemLabel, value, applying, onYes, onNo }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1100] bg-sky-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-[420px] shadow-2xl border border-sky-200 overflow-visible animate-in fade-in zoom-in-95 duration-200">
        <div className="h-1 bg-blue-500"/>
        <div className="px-6 py-5">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
              <FiTrendingUp className="text-blue-500" size={20}/>
            </div>
            <div>
              <h3 className="font-bold text-sky-900 text-base">Apply to all 12 months?</h3>
              <p className="text-sky-500 text-s mt-1 leading-relaxed">
                Would you like to apply this Adjusted value ({fmt(value)}) to all 12 months
                for <span className="font-semibold text-sky-800">{itemLabel}</span>?
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button onClick={onNo} disabled={applying}
              className="px-4 py-2 rounded-xl border border-sky-200 bg-white hover:bg-sky-50 text-sky-700 text-s font-semibold transition-colors disabled:opacity-50">
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
function TabActionButtons({ activeTab, year, quarter, token, canEdit, filterType, filterCat, onSuccess, addToast }) {
  const [summaryUploadOpen, setSummaryUploadOpen] = useState(false);
  const [driverUploadOpen,  setDriverUploadOpen]  = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [downloading, setDownloading] = useState(null);

  const downloadTemplate = async (templateType) => {
    setDownloading(templateType);
    try {
      const p = new URLSearchParams({ quarter });
      p.set("expense_type",     filterType || "ALL");
      p.set("expense_category", filterCat  || "ALL");
      const url = templateType === "expense-adjustments"
        ? `${API_BASE}/${year}/excel-template/expense-adjustments?${p}`
        : `${API_BASE}/${year}/excel-template/driver-adjustments?${p}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } });
      if (!res.ok) throw new Error(await parseApiError(res));
      const blob = await res.blob();
      const burl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = burl;
      a.download = templateType === "expense-adjustments"
        ? `expense_adjustments_${year}_${quarter}.xlsx`
        : `expense_driver_adjustments_${year}_${quarter}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(burl);
      addToast("Template downloaded ✓", "success");
    } catch (e) { addToast(`Download failed: ${e.message}`, "error"); }
    finally { setDownloading(null); }
  };

  const handleExcelUpload = async (file, uploadType) => {
    setUploading(true); setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const endpoint = uploadType === "expense"
        ? `${API_BASE}/${year}/excel-upload/expense-adjustments?quarter=${quarter}`
        : `${API_BASE}/${year}/excel-upload/driver-adjustments?quarter=${quarter}`;
      const res = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      if (!res.ok) throw new Error(await parseApiError(res));
      addToast(`${uploadType === "expense" ? "Expense" : "Driver"} adjustments uploaded ✓`, "success");
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
        <button onClick={() => downloadTemplate("expense-adjustments")} disabled={downloading === "expense-adjustments"}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-300 hover:bg-sky-50 text-sky-700 text-x font-semibold transition-all disabled:opacity-60">
          {downloading === "expense-adjustments" ? <span className="w-3 h-3 border-2 border-sky-300 border-t-sky-600 rounded-full animate-spin"/> : <FiDownload size={12}/>}
          Download Template
        </button>
        {canEdit && (
          <button onClick={() => { setUploadError(null); setSummaryUploadOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-x font-semibold transition-all shadow-sm">
            <FiUpload size={12}/> Upload Excel
          </button>
        )}
      </div>
      <ExcelUploadPreviewModal
        open={summaryUploadOpen} onClose={() => setSummaryUploadOpen(false)}
        title="Expense Adjustments Upload"
        uploading={uploading} uploadError={uploadError}
        onUpload={(f) => handleExcelUpload(f, "expense")}/>
    </>
  );

  if (activeTab === "drivers") return (
    <>
      <div className="flex items-center gap-2">
        <button onClick={() => downloadTemplate("driver-adjustments")} disabled={downloading === "driver-adjustments"}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-300 hover:bg-sky-50 text-sky-700 text-x font-semibold transition-all disabled:opacity-60">
          {downloading === "driver-adjustments" ? <span className="w-3 h-3 border-2 border-sky-300 border-t-sky-600 rounded-full animate-spin"/> : <FiDownload size={12}/>}
          Download Template
        </button>
        {canEdit && (
          <button onClick={() => { setUploadError(null); setDriverUploadOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-x font-semibold transition-all shadow-sm">
            <FiUpload size={12}/> Upload Excel
          </button>
        )}
      </div>
      <ExcelUploadPreviewModal
        open={driverUploadOpen} onClose={() => setDriverUploadOpen(false)}
        title="Driver Adjustments Upload"
        uploading={uploading} uploadError={uploadError}
        onUpload={(f) => handleExcelUpload(f, "driver")}/>
    </>
  );
  return null;
}

// ─── DeleteConfirmModal ───────────────────────────────────────────────────────
function DeleteConfirmModal({ open, scenarioName, onClose, onConfirm, loading }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1001] bg-sky-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-[380px] shadow-2xl border border-sky-200 text-center">
        <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-3">
          <FiTrash2 className="text-red-500" size={22}/>
        </div>
        <h3 className="font-bold text-sky-900 text-base mb-1">Delete Scenario</h3>
        <p className="text-sky-500 text-s mb-1">Are you sure you want to delete</p>
        <p className="font-semibold text-sky-800 text-s mb-4">"{scenarioName}"?</p>
        <p className="text-x text-sky-400 mb-5">This cannot be undone.</p>
        <div className="flex gap-2 justify-center">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-sky-200 bg-white hover:bg-sky-50 text-sky-700 text-s font-semibold transition-colors">Cancel</button>
          <button onClick={onConfirm} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-s font-semibold transition-all disabled:opacity-50">
            {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Deleting…</> : <><FiTrash2 size={13}/> Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ExpenseFilterBar ─────────────────────────────────────────────────────────
// Shared search/category/type/department filter row — used on the Summary,
// Drivers and Employee Expenses tabs so filtering stays consistent across
// all three.
function ExpenseFilterBar({
  filterText, setFilterText,
  filterCat,  setFilterCat,
  filterType, setFilterType,
  filterDept, setFilterDept,
  deptOptions,
  matchedCount, totalCount,
  meta,
}) {
  const hasActiveFilters = filterCat || filterType || filterDept;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative">
        <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-sky-400" size={12}/>
        <input value={filterText} onChange={(e) => setFilterText(e.target.value)}
          placeholder="Search expense item…"
          className="pl-7 pr-3 py-1 rounded-lg border border-sky-300 bg-white text-xs text-sky-900 outline-none focus:border-blue-500 focus:ring-2 ring-blue-100 transition-all w-48 shadow-sm"/>
      </div>
      {filterText && (
        <button onClick={() => setFilterText("")}
          className="flex items-center gap-1 text-xs text-sky-500 hover:text-sky-700 px-1.5 py-1 rounded-md hover:bg-sky-100 transition-colors">
          <FiX size={11}/> Clear
        </button>
      )}
      <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
        className="px-2 py-1 rounded-lg border border-sky-300 bg-white text-xs text-sky-700 outline-none focus:border-blue-500 cursor-pointer">
        <option value="">All Categories</option>
        <option value="COGS">COGS</option>
        <option value="Non-COGS">Non-COGS</option>
      </select>
      <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
        className="px-2 py-1 rounded-lg border border-sky-300 bg-white text-xs text-sky-700 outline-none focus:border-blue-500 cursor-pointer">
        <option value="">All Types</option>
        <option value="Fixed">Fixed</option>
        <option value="Variable">Variable</option>
      </select>
      <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}
        className="px-2 py-1 rounded-lg border border-sky-300 bg-white text-xs text-sky-700 outline-none focus:border-blue-500 cursor-pointer">
        <option value="">All Departments</option>
        {deptOptions.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      {hasActiveFilters && (
        <button onClick={() => { setFilterCat(""); setFilterType(""); setFilterDept(""); }}
          className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-800 px-1.5 py-1 rounded-md hover:bg-sky-50 border border-sky-200 transition-colors">
          <FiFilter size={10}/> Clear filters
        </button>
      )}
      {matchedCount != null && totalCount != null && (
        <span className="text-xs text-sky-500 bg-white px-2 py-1 rounded-md tabular-nums border border-sky-200">
          {matchedCount}/{totalCount}
        </span>
      )}
      {meta && <span className="text-xs text-sky-400">· {meta}</span>}
    </div>
  );
}

// ─── PeopleExpenseTab ─────────────────────────────────────────────────────────
function PeopleExpenseTab({ breakdown, months, viewType = "monthly_breakdown", quarterGroups = [], canEdit = false, onChange }) {
  const [expanded,    setExpanded]    = useState({});
  const [empExpanded, setEmpExpanded] = useState({});
  // Key of the per-employee "Adjusted" cell currently focused. While focused,
  // show the raw value (see displayEditableNumber) instead of the rounded
  // one, so toFixed() formatting never fights the user's keystrokes.
  const [focusedCellKey, setFocusedCellKey] = useState(null);

  if (!breakdown || breakdown.length === 0) return <EmptyState label="No people expense data available."/>;

  const toggle    = (k) => setExpanded((p)    => ({ ...p, [k]: !(p[k] ?? true) }));
  const toggleEmp = (k) => setEmpExpanded((p) => ({ ...p, [k]: !(p[k] ?? true) }));

  const COMP_TYPES  = EMPLOYEE_COMPONENTS;
  const COMP_COLORS = {
    salary:   "bg-sky-50 text-sky-700 border-sky-200",
    bonus:    "bg-violet-50 text-violet-700 border-violet-200",
    benefits: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pension:  "bg-amber-50 text-amber-700 border-amber-200",
  };

  return (
    <div className="flex flex-col gap-4">
      {breakdown.map((dept) => {
        const deptKey  = `${dept.department}|${dept.expense_category}|${dept.expense_subcategory || ""}`;
        const isOpen   = expanded[deptKey] ?? true;
        const hcSummary = dept.headcount_summary || {};
        return (
          <div key={deptKey} className="bg-white rounded-xl border border-sky-200 shadow-sm overflow-hidden">
            <button onClick={() => toggle(deptKey)}
              className="w-full flex items-center justify-between px-5 py-4 !bg-white hover:!bg-white transition-colors text-left">
              <div className="flex items-center gap-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-x font-bold shrink-0 ${avatarClass(dept.department)}`}>
                  {getInitials(dept.department)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sky-900 text-s">{dept.department}</span>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${(CAT_CONFIG[dept.expense_category] || CAT_CONFIG["Non-COGS"]).badge}`}>{dept.expense_category}</span>
                    {dept.expense_subcategory && <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-sky-100 text-sky-600 border border-sky-200">{dept.expense_subcategory}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className=" text-xs text-sky-500">{hcSummary.active_employees ?? "—"} employees</span>
                    {hcSummary.new_hires_this_quarter > 0 && <span className=" text-xs text-emerald-600 font-medium">+{hcSummary.new_hires_this_quarter} hire{hcSummary.new_hires_this_quarter!==1?"s":""}</span>}
                    {hcSummary.terminations_this_quarter > 0 && <span className=" text-xs text-red-500 font-medium">−{hcSummary.terminations_this_quarter} term{hcSummary.terminations_this_quarter!==1?"s":""}</span>}
                    <span className=" text-xs text-sky-400">Benefits: {((dept.benefits_percent_used||0)*100).toFixed(getDecimalPrecision())}% · Pension: {((dept.pension_percent_used||0)*100).toFixed(getDecimalPrecision())}%</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6 shrink-0">
                <div className="text-right">
                  <p className="text-xs text-sky-400 uppercase tracking-wide">AI Total</p>
                  <p className="text-s font-bold text-sky-700 tabular-nums">{fmt(dept.department_total_ai)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-sky-400 uppercase tracking-wide">Adjusted</p>
                  <p className={`text-s font-bold tabular-nums ${dept.department_total_adjusted<dept.department_total_ai?"text-emerald-600":dept.department_total_adjusted>dept.department_total_ai?"text-red-500":"text-sky-900"}`}>
                    {fmt(dept.department_total_adjusted)}
                  </p>
                </div>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform ${isOpen?"rotate-90":""}`}>
                  <FiChevronRight size={16} className="text-sky-400"/>
                </div>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-sky-100">
                {(dept.employees || []).map((emp) => {
                  const empKey = emp.employee_id;
                  const empOpen = empExpanded[empKey] ?? true;
                  return (
                    <div key={empKey} className="border-b border-sky-100 last:border-0">
                      <button onClick={() => toggleEmp(empKey)}
                        className="w-full flex items-center justify-between px-6 py-3 !bg-white hover:!bg-white transition-colors text-left">
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${avatarClass(emp.employee_name)}`}>
                            {getInitials(emp.employee_name)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sky-900 text-x">{emp.employee_name}</span>
                              <span className="text-xs text-sky-400">{emp.job_title}</span>
                              <span className="text-xs text-sky-300 tabular-nums">{emp.employee_id}</span>
                              {emp.is_prorated && (
                                <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${emp.adjustment_type==="new_hire"?"bg-emerald-50 text-emerald-700 border border-emerald-200":"bg-amber-50 text-amber-700 border border-amber-200"}`}>
                                  {emp.adjustment_type==="new_hire"?"New Hire":"Terminated"}
                                </span>
                              )}
                              {emp.termination_date && <span className="text-xs text-red-400 tabular-nums">term: {emp.termination_date}</span>}
                            </div>
                            <p className="text-xs text-sky-400 mt-0.5">Hired {emp.hire_date}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <p className="text-xs text-sky-400">Total</p>
                            <p className="text-x font-bold text-sky-900 tabular-nums">{fmt(emp.employee_total_adjusted??emp.employee_total_ai)}</p>
                          </div>
                          <FiChevronDown size={14} className={`text-sky-400 transition-transform ${empOpen?"rotate-180":""}`}/>
                        </div>
                      </button>
                      {empOpen && (
                        <div className="bg-sky-50/60 px-6 pb-4 pt-2">
                          <div className="analytics-table-scroll overflow-x-auto rounded-xl border border-sky-200 bg-white">
                            <table className="w-full text-sm border-collapse">
                              <thead>
                                <tr className="bg-sky-100 border-b border-sky-200">
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-sky-500 uppercase tracking-wide">Component</th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-sky-500 uppercase">Type</th>
                                  {viewType === "quarter_summary" ? (
                                    quarterGroups.map((qg) => (
                                      <React.Fragment key={qg.key}>
                                        <th className="px-3 py-2 text-right text-xs font-semibold text-sky-500 uppercase">{qg.label} AI</th>
                                        <th className="px-3 py-2 text-right text-xs font-semibold text-sky-600 uppercase">{qg.label} Adj</th>
                                      </React.Fragment>
                                    ))
                                  ) : (
                                    months.map((m) => (
                                      <React.Fragment key={m}>
                                        <th className="px-3 py-2 text-right text-xs font-semibold text-sky-500 uppercase">{m} AI</th>
                                        <th className="px-3 py-2 text-right text-xs font-semibold text-sky-600 uppercase">{m} Adj</th>
                                      </React.Fragment>
                                    ))
                                  )}
                                  <th className="px-3 py-2 text-right text-xs font-semibold text-sky-500 uppercase">Total AI</th>
                                  <th className="px-3 py-2 text-right text-xs font-semibold text-sky-600 uppercase">Total Adj</th>
                                </tr>
                              </thead>
                              <tbody className="text-sm">
                                {COMP_TYPES.map((ct) => {
                                  const comp = emp[ct];
                                  if (!comp) return null;
                                  const hasAdj = comp.quarter_total_adjusted !== comp.quarter_total_ai;
                                  return (
                                    <tr key={ct} className="border-b border-sky-100 last:border-0 hover:bg-sky-50/20">
                                      <td className="px-3 py-2">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${COMP_COLORS[ct]}`}>{ct}</span>
                                        {(ct==="benefits"||ct==="pension") && comp.percent_of_salary!=null && (
                                          <span className="ml-1.5 text-xs text-sky-400">({(comp.percent_of_salary*100).toFixed(getDecimalPrecision())}%)</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-sky-500">{comp.expense_type||"—"}</td>
                                      {viewType === "quarter_summary" ? (
                                        quarterGroups.map((qg) => {
                                          const qAi  = qg.monthIdxs.reduce((s, mi) => s + toCalcNumber(comp[`month${mi+1}_ai`]), 0);
                                          const qAdj = qg.monthIdxs.reduce((s, mi) => s + toCalcNumber(comp[`month${mi+1}_adjusted`]), 0);
                                          return (
                                            <React.Fragment key={qg.key}>
                                              <td className="px-3 py-2 text-right tabular-nums text-sky-500">{fmt(qAi)}</td>
                                              <td className={`px-3 py-2 text-right tabular-nums ${qAdj!==qAi?"text-blue-700 font-semibold":"text-sky-500"}`}>{fmt(qAdj)}</td>
                                            </React.Fragment>
                                          );
                                        })
                                      ) : (
                                        months.map((_, i) => {
                                          const m = i + 1;
                                          const changed = comp[`month${m}_adjusted`] !== comp[`month${m}_ai`];
                                          const editable = canEdit && m <= EMPLOYEE_EDITABLE_MONTH_LIMIT;
                                          return (
                                            <React.Fragment key={m}>
                                              <td className="px-3 py-2 text-right tabular-nums text-sky-500">{fmt(comp[`month${m}_ai`])}</td>
                                              {editable ? (() => {
                                                const cellKey = `${dept.department}-${emp.employee_id}-${ct}-month${m}`;
                                                return (
                                                <td className="px-2 py-1.5">
                                                  <input type="number"
                                                    value={displayEditableNumber(comp[`month${m}_adjusted`], focusedCellKey === cellKey)}
                                                    step={Math.pow(10, -getDecimalPrecision())}
                                                    onFocus={(e) => { setFocusedCellKey(cellKey); e.target.select(); }}
                                                    onBlur={() => setFocusedCellKey(null)}
                                                    onChange={(e) => onChange?.(dept.department, emp.employee_id, ct, `month${m}_adjusted`, e.target.value)}
                                                    title={comp[`month${m}_comment`] || undefined}
                                                    className={`w-24 px-2 py-1 rounded-lg border text-right text-x tabular-nums outline-none transition-all ${changed?"border-blue-400 bg-blue-50 text-blue-900 focus:ring-2 ring-blue-100":"border-sky-300 bg-white hover:border-sky-400 focus:border-blue-500 focus:ring-2 ring-blue-100"}`}/>
                                                </td>
                                                );
                                              })() : (
                                                <td className={`px-3 py-2 text-right tabular-nums ${changed?"text-blue-700 font-semibold":"text-sky-500"}`}
                                                  title={m > EMPLOYEE_EDITABLE_MONTH_LIMIT ? "Editable only within the first 3 forecast months" : undefined}>
                                                  {fmt(comp[`month${m}_adjusted`])}
                                                  {comp[`month${m}_comment`] && <span className="ml-1 text-xs text-amber-500" title={comp[`month${m}_comment`]}>●</span>}
                                                </td>
                                              )}
                                            </React.Fragment>
                                          );
                                        })
                                      )}
                                      <td className="px-3 py-2 text-right tabular-nums text-sky-500">{fmt(comp.quarter_total_ai)}</td>
                                      <td className={`px-3 py-2 text-right font-bold tabular-nums ${hasAdj?"text-blue-700":"text-sky-700"}`}>{fmt(comp.quarter_total_adjusted)}</td>
                                    </tr>
                                  );
                                })}
                                <tr className="bg-sky-50 border-t-2 border-sky-200">
                                  <td colSpan={2} className="px-3 py-2 font-semibold text-sky-700 text-x">Employee Total</td>
                                  {(viewType === "quarter_summary" ? quarterGroups : months).map((_, i) => <React.Fragment key={i}><td/><td/></React.Fragment>)}
                                  <td className="px-3 py-2 text-right font-bold tabular-nums text-sky-700">{fmt(emp.employee_total_ai)}</td>
                                  <td className={`px-3 py-2 text-right font-bold tabular-nums ${emp.employee_total_adjusted!==emp.employee_total_ai?"text-blue-700":"text-sky-700"}`}>{fmt(emp.employee_total_adjusted)}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          {emp.salary?.overall_comment && (
                            <p className="mt-2  text-xs text-sky-500 italic px-1">"{emp.salary.overall_comment}"</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ExpenseForecastingDashboard() {
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

  // FIX: scroll-to-top on mount
  const pageRef = useRef(null);
  useEffect(() => {
    if (pageRef.current) pageRef.current.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  const [quarter,   setQuarter]   = useCurrentQuarter(fiscalYearStartMonth);
  const [currencyFilter, setCurrencyFilter] = useState("actualvalue");
  const [activeTab, setActiveTab] = useState("summary");

  /* Forecast creation mode — which view is the "source of truth" input
     surface. Summary and Drivers data are kept numerically in sync (see
     handleAdjChange / handleDriverChange below) regardless of mode. */
  const [forecastMode, setForecastMode] = useState("summary"); // summary | drivers

  /* New filter state — mirrors revenue forecast: forecast_type
     (quarter/12months/rolling), view_type. */
  const [forecastType,       setForecastType]       = useState("quarter");
  const [viewType,           setViewType]           = useState("monthly_breakdown");

  const [apiData,      setApiData]      = useState(null);
  const [rows,         setRows]         = useState([]);
  const [drivers,      setDrivers]      = useState([]);
  const [peopleData,   setPeopleData]   = useState([]);
  const [stage,        setStage]        = useState("draft");
  const [workflowMeta, setWorkflowMeta] = useState({});

  const [loading,          setLoading]          = useState(false);
  const [saving,           setSaving]           = useState(false);
  const [hasChanges,       setHasChanges]       = useState(false);
  const [driverSaving,     setDriverSaving]     = useState(false);
  const [driverHasChanges, setDriverHasChanges] = useState(false);
  const [employeeSaving,     setEmployeeSaving]     = useState(false);
  const [employeeHasChanges, setEmployeeHasChanges] = useState(false);

  // Key of the "Adjusted" numeric input currently focused (Summary, Drivers,
  // or Employee Expenses table). While a cell is focused we show its raw,
  // unrounded value so the user can fully clear it and type decimals
  // without toFixed() display formatting fighting their keystrokes.
  const [focusedCellKey, setFocusedCellKey] = useState(null);

  // Remembers each Summary "Adjusted" cell's value at the moment it was
  // focused (keyed by the same cellKey used for focusedCellKey), so onBlur
  // can tell whether the user actually changed it before offering the
  // "apply to all 12 months" prompt.
  const focusValuesRef = useRef({});
  const [applyAllMonthsModal, setApplyAllMonthsModal] = useState({
    open: false, idx: null, value: null, itemLabel: null,
    expenseItem: null, department: null, expenseType: null,
  });
  const [applyingAllMonths, setApplyingAllMonths] = useState(false);

  // NEW: inline comment state (replaces inline text inputs)
  const [summaryComments,    setSummaryComments]    = useState({});
  const [summaryRowComments, setSummaryRowComments] = useState({});
  const [driverComments,     setDriverComments]     = useState({});

  const [modal,           setModal]           = useState({ open: false, target: null });
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [centerError,     setCenterError]     = useState(null);

  const [filterText, setFilterText] = useState("");
  const [filterCat,  setFilterCat]  = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [collapsedSummaryGroups, setCollapsedSummaryGroups] = useState({});

  /* Debounce the search box so we don't re-fetch (or re-render) on every
     keystroke — same pattern as revenue forecasting. */
  const [debouncedFilterText, setDebouncedFilterText] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilterText(filterText.trim()), 350);
    return () => clearTimeout(t);
  }, [filterText]);

  /* Race-guards: cancel stale fetches so a slow older response can't
     overwrite a newer one. */
  const fetchSeqRef       = useRef(0);
  const fetchAbortCtrlRef = useRef(null);

  /* Dirty tracking — only PATCH the rows the user actually edited. Keyed by
     `${expense_item}|${department}|${expense_type}` for summary rows and
     `...|${month}` for driver rows. */
  const dirtyRowsRef    = useRef(new Set());
  const dirtyDriversRef = useRef(new Set());
  /* Employee dirty keys: `${employee_id}|${component}|${department}`. */
  const dirtyEmployeesRef = useRef(new Set());

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
  const hasUnsavedChanges = hasChanges || driverHasChanges || employeeHasChanges;

  const { toasts, add: addToast } = useToast();
  /* `months` drives every column in the summary/drivers tables.
     - Quarter view: 3 months from getQuarterMonths(fiscalYearStartMonth)[quarter].
     - 12months / rolling: the N "YYYY-MM" periods returned by the API. */
  const months = useMemo(() => {
    if (forecastType !== "quarter" && Array.isArray(apiData?.selected_months) && apiData.selected_months.length) {
      const SHORT = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
      return apiData.selected_months.map((p) => {
        const [y, m] = String(p).split("-");
        const idx = Math.max(0, Math.min(11, Number(m) - 1));
        return Number(y) === Number(forecastYear) ? SHORT[idx] : `${SHORT[idx]} ${y}`;
      });
    }
    return getQuarterMonths(fiscalYearStartMonth)[quarter];
  }, [forecastType, apiData, quarter, forecastYear, fiscalYearStartMonth]);
  const monthPeriods = useMemo(() => {
    if (Array.isArray(apiData?.selected_months) && apiData.selected_months.length) {
      return apiData.selected_months;
    }
    return null;
  }, [apiData]);
  /* Group month columns into fiscal quarters for the Quarter Summary view. */
  const quarterGroups = useMemo(() => {
    const source = monthPeriods || [];
    const groups = new Map();
    source.forEach((p, idx) => {
      const [y, m] = String(p).split("-");
      const pos = (Number(m) - (fiscalYearStartMonth || 1) + 12) % 12;
      const qNum = Math.floor(pos / 3) + 1;
      const key = `${y}-Q${qNum}`;
      if (!groups.has(key)) groups.set(key, { key, label: `Q${qNum} ${y}`, monthIdxs: [] });
      groups.get(key).monthIdxs.push(idx);
    });
    return Array.from(groups.values());
  }, [monthPeriods, fiscalYearStartMonth]);
  const canEdit  = stage === "draft";
  const stageCfg = STAGE_CONFIG[stage] || STAGE_CONFIG.draft;

  useEffect(() => {
    const h = (e) => { if (!hasUnsavedChanges) return; e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [hasUnsavedChanges]);

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
      const savedSomething = hasChanges || driverHasChanges || employeeHasChanges;
      if (hasChanges)         await _doSave();
      if (driverHasChanges)   await _doSaveDrivers();
      if (employeeHasChanges) await _doSaveEmployees();
      // Refresh from the backend so the grid reflects persisted values and
      // the dirty flags/refs are authoritatively cleared (see handleSave).
      if (savedSomething) await fetchData();
    } catch { /* shown via toast */ }
    finally { setGuardSaving(false); }
    setShowUnsavedModal(false);
    const a = pendingAction; setPendingAction(null); a?.();
  };
  const handleGuardDiscard = () => {
    setHasChanges(false); setDriverHasChanges(false); setEmployeeHasChanges(false);
    setShowUnsavedModal(false);
    const a = pendingAction; setPendingAction(null); a?.();
  };

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!token || !year || !currency) return;

    /* Cancel any in-flight request and bump the sequence so only the
       latest response can write state. */
    if (fetchAbortCtrlRef.current) fetchAbortCtrlRef.current.abort();
    const controller = new AbortController();
    fetchAbortCtrlRef.current = controller;
    const seq = ++fetchSeqRef.current;

    setLoading(true);
    try {
      const p = new URLSearchParams({ quarter });
      p.set("currency_filter", currencyFilter);
      p.set("expense_type",     filterType || "ALL");
      p.set("expense_category", filterCat  || "ALL");
      if (filterDept) p.set("department", filterDept);
      /* New swagger filters — only append when changed from defaults so
         the default URL stays byte-identical to pre-existing behavior. */
      if (forecastType && forecastType !== "quarter")             p.set("forecast_type", forecastType);
      // Always fetch monthly_breakdown — Quarter Summary is a pure frontend
      // rollup so we need monthly data regardless.
      if (forecastType === "rolling")                             p.set("rolling_start_month", rollingStartMonth);
      // Tells the backend which side is authoritative when a cell has an
      // explicit value in both Summary and Drivers.
      p.set("forecast_mode", forecastMode);

      const res = await fetch(`${API_BASE}/${year}/${currency}?${p}`, {
        headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = await res.json();

      // Drop the response if a newer fetch has started in the meantime.
      if (seq !== fetchSeqRef.current) return;

      setApiData(data);

      const rawRows = Array.isArray(data.rows)
        ? data.rows
        : (data.rows && typeof data.rows === "object")
          ? Object.entries(data.rows).flatMap(([expenseItem, groupedRows]) => {
              if (!Array.isArray(groupedRows)) return [];
              return groupedRows.map((r) => ({ ...r, expense_item: r.expense_item || expenseItem }));
            })
          : [];

      // Determine how many month columns this response carries (3 for
      // quarter, up to 12 for rolling/12months).
      const monthCount = Array.isArray(data?.selected_months) && data.selected_months.length
        ? data.selected_months.length
        : 3;

      const mappedRows = rawRows.map((r) => {
        const mapped = {
          expense_item:               r.expense_item,
          department:                 r.department,
          expense_type:               r.expense_type,
          expense_category:           r.expense_category,
          expense_subcategory:        r.expense_subcategory || "",
          previous_month_raw:         r.previous_month ?? r.s_month,
          previous_month:             toBackendNumber(r.previous_month ?? r.s_month),
          quarter_total_ai_raw:       r.quarter_total_ai,
          quarter_total_ai:           toBackendNumber(r.quarter_total_ai),
          quarter_total_adjusted_raw: r.quarter_total_adjusted,
          quarter_total_adjusted:     toBackendNumber(r.quarter_total_adjusted) ?? toBackendNumber(r.quarter_total_ai) ?? 0,
          overall_comment:            r.overall_comment || "",
          forecast_model_used:        r.forecast_model_used || "",
        };
        // For 12months/rolling the backend packs all months into monthly_data;
        // for quarter view it uses flat month1/2/3 fields.
        if (Array.isArray(r.monthly_data) && r.monthly_data.length > 0) {
          r.monthly_data.forEach((md, i) => {
            const aiNum = toBackendNumber(md.ai);
            mapped[`month${i+1}_ai_raw`]   = md.ai;
            mapped[`month${i+1}_ai`]       = aiNum;
            mapped[`month${i+1}_adjusted`] = toBackendNumber(md.adjusted) ?? aiNum ?? 0;
            mapped[`month${i+1}_comment`]  = md.comment || "";
          });
        } else {
          for (let i = 1; i <= monthCount; i++) {
            const aiRaw  = r[`month${i}_ai`];
            const adjRaw = r[`month${i}_adjusted`];
            const aiNum  = toBackendNumber(aiRaw);
            mapped[`month${i}_ai_raw`]   = aiRaw;
            mapped[`month${i}_ai`]       = aiNum;
            mapped[`month${i}_adjusted`] = toBackendNumber(adjRaw) ?? aiNum ?? 0;
            mapped[`month${i}_comment`]  = r[`month${i}_comment`] || "";
          }
        }
        return mapped;
      });
      setRows(mappedRows);

      // Build comment maps
      const sc = {}, src = {};
      mappedRows.forEach((r) => {
        const k = `${r.expense_item}|${r.department}|${r.expense_type}`;
        for (let m = 1; m <= monthCount; m++) sc[`${k}-month${m}`] = r[`month${m}_comment`] || "";
        src[k] = r.overall_comment || "";
      });
      setSummaryComments(sc); setSummaryRowComments(src);

      if (Array.isArray(data.drivers)) {
        const flat = [];
        data.drivers.forEach((d) => {
          (d.months || []).forEach((m) => flat.push({
            expense_item:          d.expense_item,
            department:            d.department,
            expense_type:          d.expense_type,
            expense_category:      d.expense_category,
            expense_subcategory:   d.expense_subcategory || "",
            month:                 m.month,
            units_ai:              toBackendNumber(m.units_ai),
            units_adjusted:        toBackendNumber(m.units_adjusted) ?? toBackendNumber(m.units_ai) ?? 0,
            rate_ai:               toBackendNumber(m.rate_ai),
            rate_adjusted:         toBackendNumber(m.rate_adjusted)  ?? toBackendNumber(m.rate_ai)  ?? 0,
            cost_ai:               toBackendNumber(m.cost_ai),
            cost_adjusted:         toBackendNumber(m.cost_adjusted)  ?? toBackendNumber(m.cost_ai)  ?? 0,
            month_comment:         m.month_comment  || "",
            quarter_cost_ai:       toBackendNumber(d.quarter_cost_ai),
            quarter_cost_adjusted: toBackendNumber(d.quarter_cost_adjusted) ?? toBackendNumber(d.quarter_cost_ai) ?? 0,
            overall_comment:       d.overall_comment || "",
          }));
        });
        setDrivers(flat);
        const dc = {};
        flat.forEach((f) => { dc[`${f.expense_item}|${f.department}|${f.expense_type}-${f.month}`] = f.month_comment || ""; });
        setDriverComments(dc);
      }

      // Same "adjusted falls back to AI when absent" guard already applied
      // to summary rows (month{i}_adjusted) and driver rows (units/rate/cost
      // _adjusted) above — people_expense_breakdown was a bare passthrough
      // and could surface a blank input instead of the AI baseline whenever
      // the backend omits month{i}_adjusted for a component.
      const rawPeople = Array.isArray(data.people_expense_breakdown) ? data.people_expense_breakdown : [];
      const mappedPeople = rawPeople.map((dept) => ({
        ...dept,
        employees: (dept.employees || []).map((emp) => {
          const mappedEmp = { ...emp };
          EMPLOYEE_COMPONENTS.forEach((c) => {
            const comp = emp[c];
            if (!comp) return;
            const mappedComp = { ...comp };
            for (let i = 1; i <= 3; i++) {
              const aiVal = toBackendNumber(comp[`month${i}_ai`]);
              mappedComp[`month${i}_adjusted`] = toBackendNumber(comp[`month${i}_adjusted`]) ?? aiVal ?? 0;
            }
            mappedEmp[c] = mappedComp;
          });
          return mappedEmp;
        }),
      }));
      setPeopleData(mappedPeople);
      setStage(data.workflow_stage || "draft");
      setWorkflowMeta({ reviewed_by: data.reviewed_by, approved_by: data.approved_by, locked_by: data.locked_by });
      // Fresh server data — clear dirty trackers so re-loads start clean.
      dirtyRowsRef.current.clear();
      dirtyDriversRef.current.clear();
      dirtyEmployeesRef.current.clear();
      setHasChanges(false); setDriverHasChanges(false); setEmployeeHasChanges(false);
    } catch (e) {
      if (e?.name === "AbortError") return;
      if (seq !== fetchSeqRef.current) return;
      addToast(`Failed to load: ${e.message}`, "error");
    }
    finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }, [year, currency, quarter, currencyFilter, token, filterType, filterCat, filterDept,
      forecastYear, forecastType, rollingStartMonth, viewType, forecastMode]);

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
      setScenariosList(Array.isArray(data) ? data : data.scenarios || []);
    } catch (e) { addToast(`Failed to load scenarios: ${e.message}`, "error"); }
    finally { setScenariosLoading(false); }
  }, [year, quarter, token]);

  // Depend on the primitive filter values, NOT the `fetchData` reference,
  // so React's "function identity changed" doesn't trigger phantom fetches.
  useEffect(() => { fetchData(); }, [
    year, currency, quarter, currencyFilter, token,
    filterType, filterCat, filterDept,
    forecastYear, forecastType, rollingStartMonth, viewType, forecastMode,
  ]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (activeTab === "scenarios") fetchScenarios(); }, [activeTab, fetchScenarios]);

  // ── Save adjustments ──────────────────────────────────────────────────────
  const _doSave = async () => {
    if (!canEdit) return;

    // Only PATCH the rows the user actually touched.
    const dirty = dirtyRowsRef.current;
    if (dirty.size === 0) { setHasChanges(false); return; }

    setSaving(true);
    try {
      const payload = rows
        .filter((r) => dirty.has(`${r.expense_item}|${r.department}|${r.expense_type}`))
        .map((r) => {
          const k = `${r.expense_item}|${r.department}|${r.expense_type}`;
          const entry = {
            expense_item:    r.expense_item,
            department:      r.department,
            expense_type:    r.expense_type,
            overall_comment: summaryRowComments[k] || "",
          };
          months.forEach((_, mi) => {
            const m = mi + 1;
            // toBackendNumber(...) ?? 0, not `|| 0`: a cell can still hold the
            // raw string the user typed (e.g. "" while editing), and `|| 0`
            // would send that string straight to the backend.
            entry[`month${m}_adjusted`] = toBackendNumber(r[`month${m}_adjusted`]) ?? 0;
            entry[`month${m}_comment`]  = summaryComments[`${k}-month${m}`] || "";
          });
          return entry;
        });

      // Parallel batches — the backend bulk-upserts each batch in one
      // round-trip, so concurrent batches don't dogpile the DB.
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

      dirtyRowsRef.current.clear();
      setHasChanges(false);
      addToast(`Saved ${payload.length} expense row${payload.length === 1 ? "" : "s"} ✓`, "success");
    } catch (e) { setCenterError(e.message); throw e; }
    finally { setSaving(false); }
  };

  const _doSaveDrivers = async () => {
    if (!canEdit) return;

    const dirtyKeys = dirtyDriversRef.current;
    if (dirtyKeys.size === 0) { setDriverHasChanges(false); return; }

    setDriverSaving(true);
    try {
      const overallMap = {};
      drivers.forEach((d) => {
        const k = `${d.expense_item}|${d.department}|${d.expense_type}`;
        if (!overallMap[k]) overallMap[k] = d.overall_comment || "";
      });
      const payload = drivers
        .filter((d) => dirtyKeys.has(`${d.expense_item}|${d.department}|${d.expense_type}|${d.month}`))
        .map((d) => {
          const k  = `${d.expense_item}|${d.department}|${d.expense_type}`;
          const ck = `${k}-${d.month}`;
          return {
            expense_item:    d.expense_item,
            department:      d.department,
            expense_type:    d.expense_type,
            month:           d.month,
            // toBackendNumber(...) ?? 0, not `?? 0` alone: a raw string ("")
            // wouldn't be caught by `??`, which only checks null/undefined.
            units_adjusted:  toBackendNumber(d.units_adjusted) ?? 0,
            rate_adjusted:   toBackendNumber(d.rate_adjusted)  ?? 0,
            cost_adjusted:   toCalcNumber(d.cost_adjusted),
            month_comment:   driverComments[ck] || "",
            overall_comment: overallMap[k] || "",
          };
        });
      const res = await fetch(`${API_BASE}/driver-adjustments/${year}?quarter=${quarter}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      dirtyDriversRef.current.clear();
      setDriverHasChanges(false);
      addToast(`Saved ${payload.length} driver row${payload.length === 1 ? "" : "s"} ✓`, "success");
    } catch (e) { setCenterError(e.message); throw e; }
    finally { setDriverSaving(false); }
  };

  const _doSaveEmployees = async () => {
    if (!canEdit) return;

    const dirty = dirtyEmployeesRef.current;
    if (dirty.size === 0) { setEmployeeHasChanges(false); return; }

    setEmployeeSaving(true);
    try {
      const payload = [];
      peopleData.forEach((dept) => {
        const deptVal = dept.department || "";
        (dept.employees || []).forEach((emp) => {
          EMPLOYEE_COMPONENTS.forEach((component) => {
            if (!dirty.has(`${emp.employee_id}|${component}|${deptVal}`)) return;
            const comp = emp[component];
            if (!comp) return;
            payload.push({
              employee_id:     emp.employee_id,
              expense_item:    EMPLOYEE_COMPONENT_TO_EXPENSE_ITEM[component],
              department:      dept.department || null,
              month1_adjusted: toCalcNumber(comp.month1_adjusted),
              month2_adjusted: toCalcNumber(comp.month2_adjusted),
              month3_adjusted: toCalcNumber(comp.month3_adjusted),
              overall_comment: comp.overall_comment || "",
              adjustment_type: emp.adjustment_type || null,
            });
          });
        });
      });
      const res = await fetch(`${API_BASE}/employee-adjustments/${year}?quarter=${quarter}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      dirtyEmployeesRef.current.clear();
      setEmployeeHasChanges(false);
      addToast(`Saved ${payload.length} employee expense row${payload.length === 1 ? "" : "s"} ✓`, "success");
    } catch (e) { setCenterError(e.message); throw e; }
    finally { setEmployeeSaving(false); }
  };
  const handleSaveEmployees = async () => {
    await _doSaveEmployees();
    await fetchData();
  };

  /* Cross-sync (handleAdjChange / handleDriverChange) marks both dirty sets
     whenever a change in one mode implies a change in the other, so saving
     from either tab must persist both to keep the two tables consistent
     server-side. Refetching afterward keeps the grid showing persisted
     values and authoritatively clears hasChanges/driverHasChanges/dirty
     refs via fetchData's own reset logic — without it, the dirty flags get
     cleared but the grid keeps showing pre-save local state. */
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
      const action = WORKFLOW_ACTIONS[target];
      if (!action) throw new Error(`Unknown workflow target: ${target}`);
      const res = await fetch(`${API_BASE}/workflow/${year}?quarter=${quarter}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, comment }),
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

  /* Summary edit → Drivers sync. Editing an "Adjusted" cost cell in Summary
     Based mode keeps the rate this cell already had and backs out the
     implied units, so the Drivers Based view reflects the same cost. */
  const handleAdjChange = (idx, field, val) => {
    // Store exactly what the user typed — "", "13", "13.", "13.5" — instead
    // of parsing it on every keystroke. The old `parseFloat(val) || 0`
    // collapsed both "" and any not-yet-finished number to 0 immediately,
    // which then re-rendered straight back into the input, making the field
    // impossible to clear or use right. Numeric coercion now only happens
    // where a real number is actually required: the cross-tab sync math
    // below, and at save time (toBackendNumber(...) ?? 0).
    let rowKey = null;
    setRows((prev) => {
      const n = [...prev];
      n[idx] = { ...n[idx], [field]: val };
      const r = n[idx];
      rowKey = `${r.expense_item}|${r.department}|${r.expense_type}`;
      dirtyRowsRef.current.add(rowKey);
      return n;
    });
    setHasChanges(true);

    const monthMatch = /^month(\d+)_adjusted$/.exec(field);
    if (monthMatch && rowKey) {
      const monthLabel = monthPeriods?.[Number(monthMatch[1]) - 1];
      if (monthLabel) {
        // Cross-sync math always needs a real number, even mid-edit.
        const syncVal = toCalcNumber(val);
        setDrivers((prev) => {
          const dIdx = prev.findIndex((d) => `${d.expense_item}|${d.department}|${d.expense_type}` === rowKey && d.month === monthLabel);
          if (dIdx === -1) return prev;
          const u = [...prev];
          const rate = toCalcNumber(u[dIdx].rate_adjusted) || toCalcNumber(u[dIdx].rate_ai) || 1000;
          u[dIdx] = {
            ...u[dIdx],
            rate_adjusted: rate,
            units_adjusted: rate ? syncVal / rate : 0,
            cost_adjusted: syncVal,
          };
          dirtyDriversRef.current.add(`${rowKey}|${monthLabel}`);
          return u;
        });
        setDriverHasChanges(true);
      }
    }
  };

  /* onBlur for a Summary "Adjusted" month input — the "navigate to another
     row or column" moment. If the value actually changed since the cell was
     focused, offer to propagate it to all 12 months for this item. */
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
    setApplyAllMonthsModal({
      open: true, idx, value: curNum,
      itemLabel: row.expense_item,
      expenseItem: row.expense_item, department: row.department, expenseType: row.expense_type,
    });
  };

  const closeApplyAllMonthsModal = () =>
    setApplyAllMonthsModal({ open: false, idx: null, value: null, itemLabel: null, expenseItem: null, department: null, expenseType: null });

  /* "Yes, apply to all 12 months" — write the value into every currently
     visible month column locally (instant feedback + Drivers cross-sync via
     handleAdjChange) and persist it across all 4 quarters on the backend,
     since expense_forecast_adjustments stores each quarter as its own row. */
  const applyAdjustedToAllMonths = async () => {
    const { idx, value, expenseItem, department, expenseType } = applyAllMonthsModal;
    if (idx == null || expenseItem == null) { closeApplyAllMonthsModal(); return; }
    setApplyingAllMonths(true);
    try {
      months.forEach((_, mi) => handleAdjChange(idx, `month${mi + 1}_adjusted`, value));

      const res = await fetch(`${API_BASE}/adjustments/${year}/apply-all-months`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", accept: "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ expense_item: expenseItem, department, expense_type: expenseType, value }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = await res.json();

      const rowKey = `${expenseItem}|${department}|${expenseType}`;
      dirtyRowsRef.current.delete(rowKey);
      setHasChanges(dirtyRowsRef.current.size > 0);
      monthPeriods?.forEach((monthLabel) => dirtyDriversRef.current.delete(`${rowKey}|${monthLabel}`));
      setDriverHasChanges(dirtyDriversRef.current.size > 0);

      const skipped = data?.skipped_quarters || [];
      addToast(
        skipped.length
          ? `Applied to all 12 months for ${expenseItem} — ${skipped.join(", ")} skipped (not in draft) ✓`
          : `Applied to all 12 months for ${expenseItem} ✓`,
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
     cost_adjusted = units*rate (matching how the backend persists it) and
     that figure is pushed into the matching Summary "Adjusted" cell.
     Editing Cost Adj directly is the inverse: the backend has no
     cost_adjusted column (it only stores/derives units*rate), so a direct
     cost edit keeps the row's current rate fixed and backs out the implied
     units_adjusted — same approach used by the Summary "Adjusted" cell sync
     just above. */
  const handleDriverChange = (index, field, value) => {
    let updated = null;
    setDrivers((prev) => {
      const u = [...prev];
      // Store the raw typed value ("", "13", "13.5", ...) rather than
      // `parseFloat(value)`, which rounds off a not-yet-finished decimal
      // (e.g. "13." -> 13) and turns "" into NaN. toCalcNumber below parses
      // leniently for the derived units/cost math, which always needs a
      // real number.
      if (field === "cost_adjusted") {
        const costVal = toCalcNumber(value);
        const rate = toCalcNumber(u[index].rate_adjusted) || toCalcNumber(u[index].rate_ai) || 1000;
        u[index] = {
          ...u[index],
          cost_adjusted: value,
          rate_adjusted: rate,
          units_adjusted: rate ? costVal / rate : 0,
        };
      } else {
        u[index] = { ...u[index], [field]: value };
        u[index].cost_adjusted = toCalcNumber(u[index].units_adjusted) * toCalcNumber(u[index].rate_adjusted);
      }
      const d = u[index];
      dirtyDriversRef.current.add(`${d.expense_item}|${d.department}|${d.expense_type}|${d.month}`);
      updated = d;
      return u;
    });
    setDriverHasChanges(true);

    if (updated) {
      const { expense_item, department, expense_type, month, cost_adjusted } = updated;
      const monthIdx = monthPeriods?.indexOf(month) ?? -1;
      if (monthIdx !== -1) {
        const rowKey = `${expense_item}|${department}|${expense_type}`;
        setRows((prev) => {
          const rIdx = prev.findIndex((r) => `${r.expense_item}|${r.department}|${r.expense_type}` === rowKey);
          if (rIdx === -1) return prev;
          const n = [...prev];
          n[rIdx] = { ...n[rIdx], [`month${monthIdx + 1}_adjusted`]: toCalcNumber(cost_adjusted) };
          return n;
        });
        dirtyRowsRef.current.add(rowKey);
        setHasChanges(true);
      }
    }
  };

  /* Employee Expenses tab edit. Recomputes the touched component's quarter
     total, the employee total, and the department total locally so the
     grid stays internally consistent until the next save+refetch — mirrors
     how Drivers/Summary already keep their own rollups in sync on edit. */
  const handleEmployeeChange = (department, employeeId, component, field, value) => {
    // Keep the raw typed value ("", "13.5", ...); toCalcNumber below
    // parses leniently for the rollup totals, which always need a number.
    const deptKeyVal = department || "";
    setPeopleData((prev) => prev.map((dept) => {
      if ((dept.department || "") !== deptKeyVal) return dept;
      const employees = dept.employees.map((emp) => {
        if (emp.employee_id !== employeeId) return emp;
        const updatedComp = { ...emp[component], [field]: value };
        const monthTotal = Object.keys(updatedComp)
          .filter((k) => /^month\d+_adjusted$/.test(k))
          .reduce((s, k) => s + toCalcNumber(updatedComp[k]), 0);
        updatedComp.quarter_total_adjusted = Math.round(monthTotal * 100) / 100;
        const updatedEmp = { ...emp, [component]: updatedComp };
        const empTotal = EMPLOYEE_COMPONENTS.reduce((s, c) => s + toCalcNumber(updatedEmp[c]?.quarter_total_adjusted), 0);
        updatedEmp.employee_total_adjusted = Math.round(empTotal * 100) / 100;
        return updatedEmp;
      });
      const departmentTotal = employees.reduce((s, e) => s + toCalcNumber(e.employee_total_adjusted), 0);
      return { ...dept, employees, department_total_adjusted: Math.round(departmentTotal * 100) / 100 };
    }));
    dirtyEmployeesRef.current.add(`${employeeId}|${component}|${deptKeyVal}`);
    setEmployeeHasChanges(true);
  };

  const handleTabChange     = (id) => guardedAction(() => setActiveTab(id));
  const handleQuarterChange = (q)  => guardedAction(() => setQuarter(q));
  const handleCurrencyFilterChange = (v) => guardedAction(() => setCurrencyFilter(v));
  const handleRefresh       = ()   => guardedAction(fetchData);

  const handleForecastTypeChange       = (v) => guardedAction(() => setForecastType(v));
  const handleViewTypeChange           = (v) => guardedAction(() => setViewType(v));
  const handleForecastModeChange       = (v) => guardedAction(() => {
    setForecastMode(v);
    setActiveTab(v === "drivers" ? "drivers" : "summary");
  });

  // ── Derived ───────────────────────────────────────────────────────────────
  const deptOptions = apiData?.departments
    ? [...apiData.departments].sort()
    : [...new Set(rows.map((r) => r.department).filter(Boolean))].sort();

  const filteredRows = rows.filter((r) => {
    const q = filterText.toLowerCase();
    return r.expense_item.toLowerCase().includes(q) || (r.department || "").toLowerCase().includes(q);
  });

  const groupedSummaryRows = [];
  const groupedSummaryMap = new Map();
  filteredRows.forEach((row) => {
    const groupKey = row.expense_item || "—";
    if (!groupedSummaryMap.has(groupKey)) {
      const group = { expenseItem: groupKey, rows: [] };
      groupedSummaryMap.set(groupKey, group);
      groupedSummaryRows.push(group);
    }
    groupedSummaryMap.get(groupKey).rows.push(row);
  });

  const summaryGroupsWithAdjustments = groupedSummaryRows.reduce((count, group) => {
    const hasAdj = group.rows.some((r) => {
      const ai = (toCalcNumber(r.month1_ai) + toCalcNumber(r.month2_ai) + toCalcNumber(r.month3_ai));
      const adj = (toCalcNumber(r.month1_adjusted) + toCalcNumber(r.month2_adjusted) + toCalcNumber(r.month3_adjusted));
      return ai !== adj;
    });
    return count + (hasAdj ? 1 : 0);
  }, 0);

  const gt = apiData?.grand_total;
  // Totals — keyed by month index so this works for 3-month (quarter) and
  // 12-month (rolling / 12months) views without special-casing. Falls back
  // to backend's `grand_total` for the first 3 months when present.
  const totals = (() => {
    const t = { prev: 0, ai: [], usr: [] };
    for (let i = 0; i < months.length; i++) { t.ai[i] = 0; t.usr[i] = 0; }
    t.prev = gt?.previous_month != null
      ? toCalcNumber(gt.previous_month)
      : rows.reduce((s, r) => s + toCalcNumber(r.previous_month), 0);
    rows.forEach((r) => {
      for (let i = 0; i < months.length; i++) {
        t.ai[i]  += toCalcNumber(r[`month${i + 1}_ai`]);
        t.usr[i] += toCalcNumber(r[`month${i + 1}_adjusted`]);
      }
    });
    // Keep legacy m1ai/m1usr/m2ai/... accessors so existing JSX that
    // references them still works while we migrate.
    for (let i = 0; i < Math.min(3, months.length); i++) {
      const gtAi  = gt?.[`month${i+1}_ai`];
      const gtAdj = gt?.[`month${i+1}_adjusted`];
      t[`m${i+1}ai`]  = gtAi  != null ? toCalcNumber(gtAi)  : t.ai[i];
      t[`m${i+1}usr`] = gtAdj != null ? toCalcNumber(gtAdj) : t.usr[i];
    }
    t.aiTotal  = t.ai.reduce((a, b) => a + b, 0);
    t.usrTotal = t.usr.reduce((a, b) => a + b, 0);
    return t;
  })();
  const variance = totals.usrTotal - totals.aiTotal;
  const varPct   = totals.aiTotal ? ((variance/totals.aiTotal)*100).toFixed(getDecimalPrecision()) : "0.0";

  const forecastSummary        = apiData?.baseline_forecast_summary || {};
  const summaryVarianceAmount  = forecastSummary.variance_amount  ?? variance;
  const summaryVariancePercent = forecastSummary.variance_percent != null ? Number(forecastSummary.variance_percent) : Number(varPct);

  const driverGroups = [];
  const seenGroups   = new Set();
  drivers.forEach((d) => {
    const k = `${d.expense_item}|${d.department}|${d.expense_type}`;
    if (!seenGroups.has(k)) { seenGroups.add(k); driverGroups.push(k); }
  });

  const filteredDriverGroups = driverGroups.filter((groupKey) => {
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    const [expItem, dept] = groupKey.split("|");
    return expItem.toLowerCase().includes(q) || (dept || "").toLowerCase().includes(q);
  });
  const driverGroupsWithAdjustments = filteredDriverGroups.reduce((count, groupKey) => {
    const [expItem, dept, expType] = groupKey.split("|");
    const hasAdj = drivers.some((d) =>
      d.expense_item === expItem && d.department === dept && d.expense_type === expType &&
      toCalcNumber(d.cost_adjusted) !== toCalcNumber(d.cost_ai));
    return count + (hasAdj ? 1 : 0);
  }, 0);

  const filteredPeopleData = (() => {
    if (!filterText) return peopleData;
    const q = filterText.toLowerCase();
    return peopleData
      .map((dept) => {
        const deptMatches = (dept.department || "").toLowerCase().includes(q) ||
          (dept.expense_category || "").toLowerCase().includes(q) ||
          (dept.expense_subcategory || "").toLowerCase().includes(q);
        if (deptMatches) return dept;
        const matchedEmployees = (dept.employees || []).filter((emp) =>
          (emp.employee_name || "").toLowerCase().includes(q) ||
          (emp.job_title || "").toLowerCase().includes(q));
        return matchedEmployees.length ? { ...dept, employees: matchedEmployees } : null;
      })
      .filter(Boolean);
  })();

  const monthTheme = [
    { bg: "bg-sky-50/60",  label: "text-sky-700"    },
    { bg: "bg-blue-50/30",   label: "text-blue-700"   },
    { bg: "bg-indigo-50/20", label: "text-indigo-700" },
  ];
  const scenarioStyles = {
    baseline:   { icon: "◎", top: "bg-blue-600"    },
    best_case:  { icon: "🚀", top: "bg-emerald-500" },
    worst_case: { icon: "⚠️", top: "bg-red-500"     },
  };
  const getScStyle = (sc) => scenarioStyles[sc.scenario_name] || { icon: "📊", top: "bg-sky-600" };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={pageRef} className="planning-compact forecasting-pnl-theme expense-forecast-page min-h-screen bg-sky-50 font-sans text-sky-900">

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
      <header className="forecasting-page-header bg-gradient-to-r from-sky-950 via-sky-900 to-sky-700 rounded-xl px-4 md:px-6 py-2.5 sticky -top-5 z-40 shadow-sm">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-lg font-bold text-white">Expense Forecast</h1>
          <div className="flex items-center gap-2">
            {/* Year/Quarter breadcrumb + Quarter dropdown moved to the
                filter bar below. Currency-unit stays here since the filter
                bar doesn't host it. */}
            <select value={currencyFilter} onChange={(e) => handleCurrencyFilterChange(e.target.value)}
              className="px-3 py-1 rounded-lg bg-white border border-sky-200 text-sky-900 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200">
              {CURRENCY_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value} className="bg-white text-sky-900">{o.label}</option>)}
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

      <main className="max-w-screen-2xl mx-auto px-0 py-2">

        {/* ── FILTER BAR (forecast_year / forecast_type / quarter / view_type) ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-s mb-2">
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

        <KpiCards forecastSummary={forecastSummary} months={months} variance={variance} varPct={varPct}
          summaryVarianceAmount={summaryVarianceAmount} summaryVariancePercent={summaryVariancePercent}/>

        {/* ── TABS ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b-2 border-slate-200 mb-2 gap-2 flex-wrap">
          <div className="flex items-end gap-2">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => handleTabChange(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-s font-semibold whitespace-nowrap transition-all
                  ${activeTab === t.id
                    ? "bg-white text-sky-600 rounded-t-xl -mb-0.5 border-l border-t border-r border-slate-200 border-b-2 border-b-white shadow-sm"
                    : "text-slate-500 hover:text-sky-700 hover:bg-white/60 rounded-t-xl"}`}>
                {t.icon} {t.label}
                {t.id === "people" && peopleData.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-600 text-xs font-bold">{peopleData.length}</span>
                )}
              </button>
            ))}
          </div>
          <TabActionButtons activeTab={activeTab} year={year} quarter={quarter} token={token}
            canEdit={canEdit} filterType={filterType} filterCat={filterCat}
            onSuccess={fetchData} addToast={addToast}/>
        </div>

        {/* ══ SUMMARY TAB ════════════════════════════════════════════ */}
        {activeTab === "summary" && (
          <div>
            <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
              <ExpenseFilterBar
                filterText={filterText} setFilterText={setFilterText}
                filterCat={filterCat}   setFilterCat={setFilterCat}
                filterType={filterType} setFilterType={setFilterType}
                filterDept={filterDept} setFilterDept={setFilterDept}
                deptOptions={deptOptions}
                matchedCount={filteredRows.length} totalCount={rows.length}
                meta={`${groupedSummaryRows.length} groups · ${summaryGroupsWithAdjustments} adjusted`}
              />
              {!canEdit && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                  <FiAlertCircle size={11}/> Editing disabled — {STAGE_LABELS[stage]}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-sky-200 shadow-sm overflow-hidden">
              {loading ? <TableSkeleton columns={6} rows={8} /> : viewType === "quarter_summary" ? (
                /* ── QUARTER SUMMARY ──
                   Groups monthly_breakdown data into Q1/Q2/Q3/Q4 columns
                   (AI + Adjusted per quarter). Each customer/group/row sums
                   its monthly values into the corresponding quarter bucket. */
                <div className="analytics-table-scroll overflow-x-auto max-h-[78vh] overflow-y-auto">
                  <table className="w-full min-w-[1200px] border-collapse text-sm">
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-sky-800 border-b border-sky-700">
                        <th rowSpan={2} className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700 sticky left-0 bg-sky-800 z-30 min-w-[200px]">Expense Item</th>
                        <th rowSpan={2} className="px-2 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide min-w-[110px]">Department</th>
                        <th rowSpan={2} className="px-2 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide min-w-[70px]">Type</th>
                        <th rowSpan={2} className="px-2 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide min-w-[80px]">Category</th>
                        <th rowSpan={2} className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide min-w-[90px]">Prev Month</th>
                        {quarterGroups.map((qg) => (
                          <th key={qg.key} colSpan={2} className="px-3 py-1.5 text-center text-xs font-semibold border-l text-white border-sky-700 bg-sky-800">
                            {qg.label}
                          </th>
                        ))}
                        <th colSpan={2} className="px-3 py-1.5 text-center text-xs font-semibold text-sky-50 border-l border-sky-700 bg-sky-900">Period Total</th>
                        <th rowSpan={2} className="px-1 py-1.5 text-center border-l border-sky-700 text-white min-w-[36px]">
                          <FiMessageSquare size={11} className="mx-auto opacity-70"/>
                        </th>
                      </tr>
                      <tr className="bg-sky-700 border-b border-sky-600 sticky top-[28px] z-10">
                        {quarterGroups.map((qg) => (
                          <React.Fragment key={qg.key}>
                            <th className="px-2 py-1 text-right text-xs font-medium text-sky-100 uppercase border-l border-sky-600 min-w-[90px]">AI</th>
                            <th className="px-2 py-1 text-right text-xs font-semibold text-white uppercase min-w-[90px]">Adjusted</th>
                          </React.Fragment>
                        ))}
                        <th className="px-2 py-1 text-right text-xs font-medium text-white uppercase border-l border-sky-600 min-w-[90px]">AI</th>
                        <th className="px-2 py-1 text-right text-xs font-semibold text-white uppercase min-w-[90px]">Adj</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {filteredRows.length === 0
                        ? <tr><td colSpan={6 + quarterGroups.length * 2}><EmptyState label="No expense items match your filters."/></td></tr>
                        : groupedSummaryRows.flatMap((group) => (
                            group.rows.map((row, idxInGroup) => {
                              const origIdx = rows.indexOf(row);
                              const rowKey  = `${row.expense_item}|${row.department}|${row.expense_type}`;
                              const isEven  = origIdx % 2 === 0;
                              const avCls   = avatarClass(row.expense_item);
                              const catCfg  = CAT_CONFIG[row.expense_category] || { badge: "bg-sky-100 text-sky-500 border-sky-200" };
                              const typeCfg = TYPE_CONFIG[row.expense_type]     || { badge: "bg-sky-100 text-sky-500 border-sky-200" };
                              const quarterCells = quarterGroups.map((qg) => {
                                const ai  = qg.monthIdxs.reduce((s, mi) => s + toCalcNumber(row[`month${mi+1}_ai`]),       0);
                                const adj = qg.monthIdxs.reduce((s, mi) => s + toCalcNumber(row[`month${mi+1}_adjusted`]), 0);
                                return { key: qg.key, ai, adj };
                              });
                              const periodAi  = quarterCells.reduce((s, q) => s + q.ai,  0);
                              const periodAdj = quarterCells.reduce((s, q) => s + q.adj, 0);
                              const changed   = periodAdj !== periodAi;
                              return (
                                <tr key={`qs-${rowKey}-${origIdx}-${idxInGroup}`} className="ef-row border-b border-sky-100 transition-colors hover:bg-sky-50/30">
                                  {idxInGroup === 0 && (
                                    <td rowSpan={group.rows.length} className="px-2 py-1 align-top sticky left-0 border-r border-sky-200 z-[5] bg-white">
                                      <div className="flex items-center gap-1.5">
                                        <div className={`w-4 h-4 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${avCls}`}>{getInitials(row.expense_item)}</div>
                                        <span className="font-semibold text-sky-900 text-xs leading-tight truncate" title={row.expense_item}>{row.expense_item}</span>
                                        {changed && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" title="Has adjustments"/>}
                                      </div>
                                    </td>
                                  )}
                                  <td className={`px-2 py-1 text-xs ${isEven?"bg-white":"bg-sky-50/80"}`}>
                                    <span className="px-1.5 py-0 rounded bg-sky-100 text-sky-600 text-xs font-medium border border-sky-200">{row.department||"—"}</span>
                                  </td>
                                  <td className={`px-2 py-1 ${isEven?"bg-white":"bg-sky-50/80"}`}>
                                    <span className={`px-1.5 py-0 rounded text-xs font-semibold border ${typeCfg.badge}`}>{row.expense_type||"—"}</span>
                                  </td>
                                  <td className={`px-2 py-1 ${isEven?"bg-white":"bg-sky-50/80"}`}>
                                    <span className={`px-1.5 py-0 rounded text-xs font-semibold border ${catCfg.badge}`}>{row.expense_category||"—"}</span>
                                  </td>
                                  <td className={`px-3 py-1 text-right tabular-nums text-xs text-sky-500 ${isEven?"bg-white":"bg-sky-50/80"}`}>{fmt(row.previous_month_raw ?? row.previous_month)}</td>
                                  {quarterCells.map((qc, qi) => (
                                    <React.Fragment key={qc.key}>
                                      <td className={`px-2 py-1 text-right text-xs text-sky-500 tabular-nums border-l border-sky-100 ${monthTheme[qi % monthTheme.length].bg}`}>{fmt(qc.ai)}</td>
                                      <td className={`px-2 py-1 text-right text-xs tabular-nums ${monthTheme[qi % monthTheme.length].bg} ${qc.adj<qc.ai?"text-emerald-600 font-bold":qc.adj>qc.ai?"text-red-500 font-bold":"text-sky-700"}`}>{fmt(qc.adj)}</td>
                                    </React.Fragment>
                                  ))}
                                  <td className="px-2 py-1 text-right text-xs text-sky-500 tabular-nums border-l border-sky-200 bg-sky-50/60">{fmt(periodAi)}</td>
                                  <td className={`px-2 py-1 text-right text-xs font-bold tabular-nums ${periodAdj<periodAi?"text-emerald-600":periodAdj>periodAi?"text-red-500":"text-sky-700"}`}>{fmt(periodAdj)}</td>
                                  <td className="px-1 py-1 text-center border-l border-sky-100">
                                    <InlineCommentIcon
                                      commentKey={`overall-${rowKey}`}
                                      value={summaryRowComments[rowKey]}
                                      disabled={!canEdit}
                                      onChange={(v) => { setSummaryRowComments((p)=>({...p,[rowKey]:v})); dirtyRowsRef.current.add(rowKey); setHasChanges(true); }}
                                      label={`${row.expense_item} — Overall Note`}
                                      isOverall
                                    />
                                  </td>
                                </tr>
                              );
                            })
                          ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-sky-900 text-white sticky bottom-0 z-10 font-semibold text-xs">
                        <td className="px-3 py-1.5 text-xs sticky left-0 bg-sky-900 border-r border-sky-700 z-[9]">GRAND TOTAL</td>
                        <td colSpan={3} className="px-2 py-1.5 bg-sky-900"></td>
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
                          <span className={`text-xs font-bold tabular-nums ${variance<=0?"text-emerald-400":"text-red-400"}`}>
                            {variance>=0?"+":""}{fmt(variance)} ({varPct}%)
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="analytics-table-scroll overflow-x-auto max-h-[78vh] overflow-y-auto">
                  <table className="w-full min-w-[1860px] border-collapse text-sm">
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-sky-800 border-b border-sky-700">
                        <th rowSpan={2} className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700 sticky left-0 bg-sky-800 z-30 min-w-[200px]">Expense Item</th>
                        <th rowSpan={2} className="px-2 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide min-w-[110px]">Department</th>
                        <th rowSpan={2} className="px-2 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide min-w-[70px]">Type</th>
                        <th rowSpan={2} className="px-2 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide min-w-[80px]">Category</th>
                        <th rowSpan={2} className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide min-w-[90px]">Prev Month</th>
                        {months.map((m, mi) => (
                          <th key={m} colSpan={3} className={`px-3 py-1.5 text-center text-xs font-semibold border-l text-white border-sky-700 ${monthTheme[mi % monthTheme.length].label} bg-sky-800`}>{m}</th>
                        ))}
                        <th colSpan={2} className="px-3 py-1.5 text-center text-xs font-semibold text-sky-50 border-l border-sky-700 bg-sky-900">
                          {forecastType === "quarter" ? "Quarter Total" : "Period Total"}
                        </th>
                        <th rowSpan={2} className="px-2 py-1.5 text-center border-l border-sky-700 bg-sky-800 min-w-[42px] text-white">
                          <FiMessageSquare size={11} className="mx-auto opacity-70"/>
                        </th>
                      </tr>
                      <tr className="bg-sky-700 border-b border-sky-600 sticky top-[28px] z-10">
                        {months.map((_, mi) => (
                          <React.Fragment key={mi}>
                            <th className="px-2 py-1 text-right text-xs font-medium text-sky-100 uppercase border-l border-sky-600 min-w-[80px]">AI</th>
                            <th className="px-2 py-1 text-right text-xs font-semibold text-white uppercase min-w-[90px]">Adjusted</th>
                            <th className="px-1 py-1 text-center min-w-[36px]">
                              <FiMessageSquare size={11} className="mx-auto opacity-70 text-sky-100"/>
                            </th>
                          </React.Fragment>
                        ))}
                        <th className="px-2 py-1 text-right text-xs font-medium text-white uppercase border-l border-sky-600 min-w-[80px]">AI</th>
                        <th className="px-2 py-1 text-right text-xs font-semibold text-white uppercase min-w-[80px]">Adj</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {filteredRows.length === 0
                        ? <tr><td colSpan={99}><EmptyState label="No expense items match your filters."/></td></tr>
                        : groupedSummaryRows.flatMap((group) => {
                            // Always the live sum of the monthly cells — never the row's
                            // stale `quarter_total_ai`/`quarter_total_adjusted` fields, which
                            // are only set once at load and don't move as the user types (and
                            // toCalcNumber, not `|| 0`, since an adjusted cell can hold the raw
                            // string the user is mid-typing, which `0 + "<string>"` would
                            // concatenate instead of add).
                            const groupAi = group.rows.reduce((sum, r) => sum + toCalcNumber(r.month1_ai)+toCalcNumber(r.month2_ai)+toCalcNumber(r.month3_ai), 0);
                            const groupAdj = group.rows.reduce((sum, r) => sum + toCalcNumber(r.month1_adjusted)+toCalcNumber(r.month2_adjusted)+toCalcNumber(r.month3_adjusted), 0);
                            const groupVar = groupAdj - groupAi;
                            const groupHasChanges = group.rows.some((r) => (toCalcNumber(r.month1_adjusted)+toCalcNumber(r.month2_adjusted)+toCalcNumber(r.month3_adjusted)) !== (toCalcNumber(r.month1_ai)+toCalcNumber(r.month2_ai)+toCalcNumber(r.month3_ai)));
                            const isCollapsed = collapsedSummaryGroups[group.expenseItem] ?? false;

                            const groupHeader = (
                              <tr key={`group-${group.expenseItem}`} className="bg-sky-900 border-b border-sky-700">
                                <td colSpan={SUMMARY_TABLE_COLSPAN} className="px-2 py-1">
                                  <button
                                    type="button"
                                    onClick={() => setCollapsedSummaryGroups((p) => ({ ...p, [group.expenseItem]: !isCollapsed }))}
                                    className="w-full flex items-center justify-between gap-3 rounded-md border border-sky-700 bg-sky-800 px-2 py-1 hover:bg-sky-700 transition-colors"
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <FiChevronRight size={12} className={`text-sky-200 transition-transform ${isCollapsed ? "" : "rotate-90"}`}/>
                                      <div className={`w-4 h-4 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${avatarClass(group.expenseItem)}`}>
                                        {getInitials(group.expenseItem)}
                                      </div>
                                      <span className="font-semibold text-white text-xs truncate">{group.expenseItem}</span>
                                      <span className="px-1.5 py-0 rounded-full bg-white text-sky-800 text-xs font-semibold border border-white/60">
                                        {group.rows.length}
                                      </span>
                                      {groupHasChanges && (
                                        <span className="px-1.5 py-0 rounded-full bg-cyan-100 text-cyan-800 text-xs font-semibold border border-cyan-200">
                                          Adj
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0 text-xs tabular-nums">
                                      <span className="text-sky-200">AI <span className="text-white font-bold">{fmt(groupAi)}</span></span>
                                      <span className="text-sky-200">Adj <span className="text-white font-bold">{fmt(groupAdj)}</span></span>
                                      <span className={`font-bold ${groupVar <= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                                        {groupVar >= 0 ? "+" : ""}{fmt(groupVar)}
                                      </span>
                                    </div>
                                  </button>
                                </td>
                              </tr>
                            );

                            if (isCollapsed) return [groupHeader];

                            return [
                              groupHeader,
                              ...group.rows.map((row, idxInGroup) => {
                            const origIdx = rows.indexOf(row);
                            const rowKey  = `${row.expense_item}|${row.department}|${row.expense_type}`;
                            const isEven  = origIdx % 2 === 0;
                            const avCls   = avatarClass(row.expense_item);
                            const qAi  = months.reduce((s, _, i) => s + toCalcNumber(row[`month${i+1}_ai`]), 0);
                            const qAdj = months.reduce((s, _, i) => s + toCalcNumber(row[`month${i+1}_adjusted`]), 0);
                            const changed = qAdj !== qAi;
                            const qAiDisplay = row.quarter_total_ai_raw != null && row.quarter_total_ai_raw !== ""
                              ? fmt(row.quarter_total_ai_raw)
                              : fmt(qAi);
                            // Adjusted quarter total is always the live sum of the (possibly
                            // just-edited) monthly Adjusted cells — never the server's stale
                            // `quarter_total_adjusted_raw`, which doesn't move as the user types.
                            const qAdjDisplay = fmt(qAdj);
                            const catCfg  = CAT_CONFIG[row.expense_category]  || { badge: "bg-sky-100 text-sky-500 border-sky-200" };
                            const typeCfg = TYPE_CONFIG[row.expense_type]      || { badge: "bg-sky-100 text-sky-500 border-sky-200" };
                            return (
                              <tr key={`${rowKey}-${origIdx}-${idxInGroup}`} className="ef-row border-b border-sky-100 transition-colors hover:bg-sky-50/30">
                                {idxInGroup === 0 && (
                                  <td rowSpan={group.rows.length} className="px-2 py-1 align-top sticky left-0 border-r border-sky-200 z-[5] bg-white">
                                    <div className="flex items-center gap-1.5">
                                      <div className={`w-4 h-4 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${avCls}`}>{getInitials(row.expense_item)}</div>
                                      <span className="font-semibold text-sky-900 text-xs leading-tight truncate" title={row.expense_item}>{row.expense_item}</span>
                                      {group.rows.some((r) => (toCalcNumber(r.month1_adjusted)+toCalcNumber(r.month2_adjusted)+toCalcNumber(r.month3_adjusted)) !== (toCalcNumber(r.month1_ai)+toCalcNumber(r.month2_ai)+toCalcNumber(r.month3_ai))) && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" title="Has adjustments"/>
                                      )}
                                    </div>
                                  </td>
                                )}
                                <td className={`px-2 py-1 text-xs ${isEven?"bg-white":"bg-sky-50/80"}`}>
                                  <span className="px-1.5 py-0 rounded bg-sky-100 text-sky-600 text-xs font-medium border border-sky-200">{row.department||"—"}</span>
                                </td>
                                <td className={`px-2 py-1 ${isEven?"bg-white":"bg-sky-50/80"}`}>
                                  <span className={`px-1.5 py-0 rounded text-xs font-semibold border ${typeCfg.badge}`}>{row.expense_type||"—"}</span>
                                </td>
                                <td className={`px-2 py-1 ${isEven?"bg-white":"bg-sky-50/80"}`}>
                                  <span className={`px-1.5 py-0 rounded text-xs font-semibold border ${catCfg.badge}`}>{row.expense_category||"—"}</span>
                                </td>
                                <td className={`px-3 py-1 text-right tabular-nums text-xs text-sky-500 ${isEven?"bg-white":"bg-sky-50/80"}`}>{fmt(row.previous_month_raw ?? row.previous_month)}</td>

                                {/* ── Per-month: AI | Adjusted | Icon ── Iterates `months`
                                       so 3-month (quarter) and N-month (rolling/12months)
                                       render with the same JSX. */}
                                {months.map((_, mi) => {
                                  const m   = mi + 1;
                                  const ai  = row[`month${m}_ai`];
                                  const adj = row[`month${m}_adjusted`];
                                  const cellChanged = adj !== ai && ai != null;
                                  const ck  = `${rowKey}-month${m}`;
                                  const th  = monthTheme[mi % monthTheme.length];
                                  const cellKey = `summary-${origIdx}-month${m}`;
                                  return (
                                    <React.Fragment key={m}>
                                      <td className={`px-2 py-1 text-right text-xs text-sky-500 tabular-nums border-l border-sky-100 ${th.bg}`}>{fmt(row[`month${m}_ai_raw`] ?? ai)}</td>
                                      <td className={`px-1.5 py-1 ${th.bg}`}>
                                        <input type="number" value={displayEditableNumber(adj, focusedCellKey === cellKey)} step={Math.pow(10, -getDecimalPrecision())} disabled={!canEdit}
                                          onFocus={(e) => { setFocusedCellKey(cellKey); focusValuesRef.current[cellKey] = adj; e.target.select(); }}
                                          onBlur={() => handleAdjBlur(origIdx, m)}
                                          onChange={(e) => handleAdjChange(origIdx, `month${m}_adjusted`, e.target.value)}
                                          className={`w-full px-1.5 py-0.5 rounded-md border text-right text-xs tabular-nums outline-none transition-all
                                            ${!canEdit?"bg-sky-50 text-sky-400 cursor-not-allowed border-sky-200"
                                              :cellChanged?"border-blue-400 bg-blue-50 text-blue-900 focus:ring-2 ring-blue-100"
                                              :"border-sky-300 bg-white hover:border-sky-400 focus:border-blue-500 focus:ring-2 ring-blue-100"}`}/>
                                      </td>
                                      <td className={`px-1 py-1 text-center ${th.bg}`}>
                                        <InlineCommentIcon
                                          commentKey={ck}
                                          value={summaryComments[ck]}
                                          disabled={!canEdit}
                                          onChange={(v) => { setSummaryComments((p)=>({...p,[ck]:v})); dirtyRowsRef.current.add(rowKey); setHasChanges(true); }}
                                          label={`${row.expense_item} — ${months[mi]}`}
                                        />
                                      </td>
                                    </React.Fragment>
                                  );
                                })}

                                <td className="px-2 py-1 text-right text-xs text-sky-500 tabular-nums border-l border-sky-200 bg-sky-50/60">{qAiDisplay}</td>
                                <td className={`px-2 py-1 text-right text-xs font-bold tabular-nums ${qAdj<qAi?"text-emerald-600":qAdj>qAi?"text-red-500":"text-sky-700"}`}>{qAdjDisplay}</td>
                                <td className="px-1 py-1 text-center border-l border-sky-100">
                                  <InlineCommentIcon
                                    commentKey={`overall-${rowKey}`}
                                    value={summaryRowComments[rowKey]}
                                    disabled={!canEdit}
                                    onChange={(v) => { setSummaryRowComments((p)=>({...p,[rowKey]:v})); dirtyRowsRef.current.add(rowKey); setHasChanges(true); }}
                                    label={`${row.expense_item} — Overall Note`}
                                    isOverall
                                  />
                                </td>
                              </tr>
                            );
                          }),
                            ];
                          })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-sky-900 text-white sticky bottom-0 z-10 font-semibold text-xs">
                        <td className="px-3 py-1.5 text-xs sticky left-0 bg-sky-900 border-r border-sky-700 z-[9]">GRAND TOTAL</td>
                        <td colSpan={3} className="px-2 py-1.5 bg-sky-900"></td>
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
                          <span className={`text-xs font-bold tabular-nums ${variance<=0?"text-emerald-400":"text-red-400"}`}>
                            {variance>=0?"+":""}{fmt(variance)} ({varPct}%)
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
            <SaveBar hasChanges={hasChanges} saving={saving} onSave={handleSave} disabled={!canEdit}/>
          </div>
        )}

        {/* ══ DRIVERS TAB ════════════════════════════════════════════ */}
        {activeTab === "drivers" && (
          <div>
            <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
              <ExpenseFilterBar
                filterText={filterText} setFilterText={setFilterText}
                filterCat={filterCat}   setFilterCat={setFilterCat}
                filterType={filterType} setFilterType={setFilterType}
                filterDept={filterDept} setFilterDept={setFilterDept}
                deptOptions={deptOptions}
                matchedCount={filteredDriverGroups.length} totalCount={driverGroups.length}
                meta={`${driverGroupsWithAdjustments} adjusted`}
              />
            </div>
            {loading ? <Spinner label="Loading drivers…"/> : driverGroups.length === 0
              ? <EmptyState label="No driver data available for this period."/>
              : filteredDriverGroups.length === 0
              ? <EmptyState label="No driver items match your filters."/>
              : (
                <div className="bg-white rounded-xl border border-sky-200 shadow-sm overflow-hidden">
                  <div className="analytics-table-scroll overflow-x-auto max-h-[66vh] overflow-y-auto">
                    {viewType === "quarter_summary" ? (
                    <table className="w-full min-w-[600px] border-collapse text-sm">
                      <thead className="sticky top-0 z-20">
                        <tr className="bg-sky-800 border-b border-sky-700">
                          <th className="sticky left-0 z-30 bg-sky-800 px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700 min-w-[200px]">Expense Item</th>
                          {quarterGroups.map((qg, qi) => (
                            <th key={qg.key} colSpan={2} className={`px-4 py-2.5 text-center text-x font-semibold text-white border-l border-sky-700 ${monthTheme[qi % monthTheme.length].label} bg-sky-800`}>{qg.label}</th>
                          ))}
                          <th colSpan={2} className="px-4 py-2.5 text-center text-x font-semibold text-white border-l border-sky-700 bg-sky-900">Total Cost</th>
                        </tr>
                        <tr className="bg-sky-700 border-b border-sky-600 sticky top-[44px] z-10">
                          <th className="sticky left-0 z-30 bg-sky-700 border-r border-sky-600"></th>
                          {quarterGroups.map((qg) => (
                            <React.Fragment key={qg.key}>
                              <th className="px-3 py-2 text-xs font-medium text-white uppercase whitespace-nowrap border-l border-sky-600 text-right">Cost AI</th>
                              <th className="px-3 py-2 text-xs font-semibold text-white uppercase whitespace-nowrap text-right">Cost Adj</th>
                            </React.Fragment>
                          ))}
                          <th className="px-3 py-2 text-right text-xs font-medium text-white uppercase border-l border-sky-600">AI</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase">Adj</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {filteredDriverGroups.map((groupKey, rowIdx) => {
                          const [expItem, dept, expType] = groupKey.split("|");
                          const isEven  = rowIdx % 2 === 0;
                          const avCls   = avatarClass(expItem);
                          const typeCfg = TYPE_CONFIG[expType] || { badge: "bg-sky-100 text-sky-500 border-sky-200" };
                          const sampleD = drivers.find((x) => x.expense_item===expItem && x.department===dept && x.expense_type===expType);
                          const quarterCosts = quarterGroups.map((qg) => {
                            let ai = 0, adj = 0;
                            qg.monthIdxs.forEach((mi) => {
                              const monthKey = (monthPeriods && monthPeriods[mi]) ?? getQuarterMonthKey(year, quarter, mi, fiscalYearStartMonth);
                              const d = drivers.find((x) => x.expense_item===expItem && x.department===dept && x.expense_type===expType && x.month===monthKey);
                              ai  += d?.cost_ai || 0;
                              // toCalcNumber, not `|| 0`: cost_adjusted can be a raw string
                              // mid-edit, and `0 + "<string>"` concatenates instead of adding.
                              adj += toCalcNumber(d?.cost_adjusted);
                            });
                            return { key: qg.key, ai, adj };
                          });
                          const totalAi  = quarterCosts.reduce((s, q) => s + q.ai,  0);
                          const totalAdj = quarterCosts.reduce((s, q) => s + q.adj, 0);
                          return (
                            <tr key={groupKey} className={`ef-row border-b border-sky-100 transition-colors ${isEven?"bg-white":"bg-sky-50/60"}`}>
                              <td className="sticky left-0 z-[5] border-r border-sky-200 px-4 py-2.5 bg-white">
                                <div className="flex items-center gap-2">
                                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${avCls}`}>{getInitials(expItem)}</div>
                                  <div>
                                    <span className="font-bold text-sky-900 text-x whitespace-nowrap">{expItem}</span>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <span className="text-xs text-sky-400">{dept}</span>
                                      <span className={`px-1.5 py-0 rounded text-xs font-semibold border ${typeCfg.badge}`}>{expType}</span>
                                      {sampleD?.expense_subcategory && <span className="text-xs text-sky-400">{sampleD.expense_subcategory}</span>}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              {quarterCosts.map((qc, qi) => (
                                <React.Fragment key={qc.key}>
                                  <td className={`px-3 py-2 text-right text-x text-sky-500 tabular-nums border-l border-sky-100 ${monthTheme[qi % monthTheme.length].bg}`}>{fmt(qc.ai)}</td>
                                  <td className={`px-3 py-2 text-right text-x tabular-nums ${monthTheme[qi % monthTheme.length].bg} ${qc.adj<qc.ai?"text-emerald-600 font-bold":qc.adj>qc.ai?"text-red-500 font-bold":"text-sky-700"}`}>{fmt(qc.adj)}</td>
                                </React.Fragment>
                              ))}
                              <td className="px-3 py-2 text-right text-x text-sky-500 tabular-nums border-l border-sky-200 bg-sky-50">{fmt(totalAi)}</td>
                              <td className={`px-3 py-2 text-right text-x font-bold tabular-nums ${totalAdj<totalAi?"text-emerald-600":totalAdj>totalAi?"text-red-500":"text-sky-700"}`}>{fmt(totalAdj)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    ) : (
                    <table className="w-full min-w-[2000px] border-collapse text-sm">
                      <thead className="sticky top-0 z-20">
                        <tr className="bg-sky-800 border-b border-sky-700">
                          <th className="sticky left-0 z-30 bg-sky-800 px-4 py-3 text-left  text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700 min-w-[200px]">Expense Item</th>
                          {months.map((m, mi) => (
                            <th key={m} colSpan={7} className={`px-4 py-2.5 text-center text-x font-semibold text-white border-l border-sky-700 ${monthTheme[mi % monthTheme.length].label} bg-sky-800`}>{m}</th>
                          ))}
                          <th colSpan={2} className="px-4 py-2.5 text-center text-x font-semibold text-white border-l border-sky-700 bg-sky-900">Quarter Cost</th>
                        </tr>
                        <tr className="bg-sky-700 border-b border-sky-600 sticky top-[44px] z-10">
                          <th className="sticky left-0 z-30 bg-sky-700 border-r border-sky-600"></th>
                          {months.map((_, mi) => (
                            <React.Fragment key={mi}>
                              {["Units AI","Units Adj","Rate AI","Rate Adj","Cost AI","Cost Adj",""].map((h, hi) => (
                                <th key={hi} className={`px-3 py-2 text-xs font-medium text-white uppercase whitespace-nowrap
                                  ${hi===0?"border-l border-sky-600 text-right":hi===6?"text-center w-10":h==="Comment"?"text-left":"text-right"}`}>
                                  {hi===6 ? <FiMessageSquare size={11} className="mx-auto opacity-70"/> : h}
                                </th>
                              ))}
                            </React.Fragment>
                          ))}
                          <th className="px-3 py-2 text-right text-xs font-medium text-white uppercase border-l border-sky-600">AI</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase">Adj</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {filteredDriverGroups.map((groupKey, rowIdx) => {
                          const [expItem, dept, expType] = groupKey.split("|");
                          const isEven  = rowIdx % 2 === 0;
                          const avCls   = avatarClass(expItem);
                          let qCostAi = 0, qCostAdj = 0;
                          const typeCfg  = TYPE_CONFIG[expType] || { badge: "bg-sky-100 text-sky-500 border-sky-200" };
                          const sampleD  = drivers.find((x) => x.expense_item===expItem && x.department===dept && x.expense_type===expType);

                          const cells = months.map((_, mi) => {
                            const monthKey = (monthPeriods && monthPeriods[mi]) ?? getQuarterMonthKey(year, quarter, mi, fiscalYearStartMonth);
                            const d = drivers.find((x) => x.expense_item===expItem && x.department===dept && x.expense_type===expType && x.month===monthKey);
                            const origIdx = drivers.findIndex((x) => x.expense_item===expItem && x.department===dept && x.expense_type===expType && x.month===monthKey);
                            const th = monthTheme[mi % monthTheme.length];
                            const ck = `${groupKey}-${monthKey}`;
                            // toCalcNumber, not `|| 0`: cost_adjusted can be a raw string
                            // while mid-edit, and `0 + "<string>"` concatenates instead of adding.
                            if (d) { qCostAi += d.cost_ai||0; qCostAdj += toCalcNumber(d.cost_adjusted); }
                            if (!d) return (
                              <React.Fragment key={mi}>
                                {Array(7).fill(0).map((_,i)=>(<td key={i} className={`px-3 py-2 text-center text-sky-300 text-x ${i===0?"border-l border-sky-100":""} ${th.bg}`}>—</td>))}
                              </React.Fragment>
                            );
                            const unitsChg = (d.units_adjusted??d.units_ai) !== d.units_ai;
                            const rateChg  = (d.rate_adjusted??d.rate_ai)   !== d.rate_ai;
                            const costChg  = toCalcNumber(d.cost_adjusted) !== toCalcNumber(d.cost_ai);
                            return (
                              <React.Fragment key={mi}>
                                <td className={`px-3 py-2 text-right text-x text-sky-500 tabular-nums border-l border-sky-100 ${th.bg}`}>{d.units_ai?.toFixed(getDecimalPrecision())??"—"}</td>
                                <td className={`px-2 py-1.5 ${th.bg}`}>
                                  <input type="number" value={displayEditableNumber(d.units_adjusted, focusedCellKey === `driver-${origIdx}-units`)} step={Math.pow(10, -getDecimalPrecision())} disabled={!canEdit}
                                    onFocus={(e) => { setFocusedCellKey(`driver-${origIdx}-units`); e.target.select(); }}
                                    onBlur={() => setFocusedCellKey(null)}
                                    onChange={(e)=>handleDriverChange(origIdx,"units_adjusted",e.target.value)}
                                    className={`w-20 px-2 py-1 rounded-lg border text-right text-x tabular-nums outline-none transition-all ${!canEdit?"bg-sky-50 border-sky-200 cursor-not-allowed text-sky-400":unitsChg?"border-blue-400 bg-blue-50 text-blue-900 focus:ring-2 ring-blue-100":"border-sky-300 bg-white hover:border-sky-400 focus:border-blue-500 focus:ring-2 ring-blue-100"}`}/>
                                </td>
                                <td className={`px-3 py-2 text-right text-x text-sky-500 tabular-nums ${th.bg}`}>${d.rate_ai?.toFixed(getDecimalPrecision())??"—"}</td>
                                <td className={`px-2 py-1.5 ${th.bg}`}>
                                  <input type="number" value={displayEditableNumber(d.rate_adjusted, focusedCellKey === `driver-${origIdx}-rate`)} step={Math.pow(10, -getDecimalPrecision())} disabled={!canEdit}
                                    onFocus={(e) => { setFocusedCellKey(`driver-${origIdx}-rate`); e.target.select(); }}
                                    onBlur={() => setFocusedCellKey(null)}
                                    onChange={(e)=>handleDriverChange(origIdx,"rate_adjusted",e.target.value)}
                                    className={`w-20 px-2 py-1 rounded-lg border text-right text-x tabular-nums outline-none transition-all ${!canEdit?"bg-sky-50 border-sky-200 cursor-not-allowed text-sky-400":rateChg?"border-blue-400 bg-blue-50 text-blue-900 focus:ring-2 ring-blue-100":"border-sky-300 bg-white hover:border-sky-400 focus:border-blue-500 focus:ring-2 ring-blue-100"}`}/>
                                </td>
                                <td className={`px-3 py-2 text-right text-x text-sky-700 font-semibold tabular-nums ${th.bg}`}>{fmt(d.cost_ai)}</td>
                                <td className={`px-2 py-1.5 ${th.bg}`}>
                                  <input type="number" value={displayEditableNumber(d.cost_adjusted, focusedCellKey === `driver-${origIdx}-cost`)} step="0.01" disabled={!canEdit}
                                    onFocus={(e) => { setFocusedCellKey(`driver-${origIdx}-cost`); e.target.select(); }}
                                    onBlur={() => setFocusedCellKey(null)}
                                    onChange={(e)=>handleDriverChange(origIdx,"cost_adjusted",e.target.value)}
                                    title="Editing cost directly keeps the current rate and recalculates units"
                                    className={`w-24 px-2 py-1 rounded-lg border text-right text-x tabular-nums outline-none transition-all ${!canEdit?"bg-sky-50 border-sky-200 cursor-not-allowed text-sky-400":costChg?"border-blue-400 bg-blue-50 text-blue-900 focus:ring-2 ring-blue-100":"border-sky-300 bg-white hover:border-sky-400 focus:border-blue-500 focus:ring-2 ring-blue-100"}`}/>
                                </td>
                                {/* NEW: driver comment icon */}
                                <td className={`px-1.5 py-1.5 text-center ${th.bg}`}>
                                  <InlineCommentIcon
                                    commentKey={ck}
                                    value={driverComments[ck]}
                                    disabled={!canEdit}
                                    onChange={(v)=>{ setDriverComments((p)=>({...p,[ck]:v})); dirtyDriversRef.current.add(`${expItem}|${dept}|${expType}|${monthKey}`); setDriverHasChanges(true); }}
                                    label={`${expItem} — ${months[mi]}`}
                                  />
                                </td>
                              </React.Fragment>
                            );
                          });

                          return (
                            <tr key={groupKey} className={`ef-row border-b border-sky-100 transition-colors ${isEven?"bg-white":"bg-sky-50/60"}`}>
                              <td className="sticky left-0 z-[5] border-r border-sky-200 px-4 py-2.5 bg-white">
                                <div className="flex items-center gap-2">
                                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${avCls}`}>{getInitials(expItem)}</div>
                                  <div>
                                    <span className="font-bold text-sky-900 text-x whitespace-nowrap">{expItem}</span>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <span className="text-xs text-sky-400">{dept}</span>
                                      <span className={`px-1.5 py-0 rounded text-xs font-semibold border ${typeCfg.badge}`}>{expType}</span>
                                      {sampleD?.expense_subcategory && <span className="text-xs text-sky-400">{sampleD.expense_subcategory}</span>}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              {cells}
                              <td className="px-3 py-2 text-right text-x text-sky-500 tabular-nums border-l border-sky-200 bg-sky-50">{fmt(qCostAi)}</td>
                              <td className={`px-3 py-2 text-right text-x font-bold tabular-nums ${qCostAdj<qCostAi?"text-emerald-600":qCostAdj>qCostAi?"text-red-500":"text-sky-700"}`}>{fmt(qCostAdj)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    )}
                  </div>
                </div>
              )}
            <SaveBar hasChanges={driverHasChanges} saving={driverSaving} onSave={handleSaveDrivers} label="Save Driver Adjustments" disabled={!canEdit}/>
          </div>
        )}

        {/* ══ PEOPLE TAB ═════════════════════════════════════════════ */}
        {activeTab === "people" && (
          <div>
            <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
              <ExpenseFilterBar
                filterText={filterText} setFilterText={setFilterText}
                filterCat={filterCat}   setFilterCat={setFilterCat}
                filterType={filterType} setFilterType={setFilterType}
                filterDept={filterDept} setFilterDept={setFilterDept}
                deptOptions={deptOptions}
                matchedCount={filteredPeopleData.length} totalCount={peopleData.length}
              />
              {!canEdit && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                  <FiAlertCircle size={11}/> Editing disabled — {STAGE_LABELS[stage]}
                </div>
              )}
            </div>
            {loading ? <Spinner label="Loading employee expenses…"/> : (
              <PeopleExpenseTab breakdown={filteredPeopleData} months={months} viewType={viewType} quarterGroups={quarterGroups}
                canEdit={canEdit} onChange={handleEmployeeChange}/>
            )}
            <SaveBar hasChanges={employeeHasChanges} saving={employeeSaving} onSave={handleSaveEmployees} label="Save Employee Adjustments" disabled={!canEdit}/>
          </div>
        )}

        {/* ══ SCENARIOS TAB ══════════════════════════════════════════ */}
        {activeTab === "scenarios" && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="font-bold text-sky-900 text-s">Expense Forecast Scenarios</h2>
                <p className="text-x text-sky-500 mt-0.5">Manage baseline, best case, worst case and custom expense scenarios</p>
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
                      const style    = getScStyle(sc);
                      const compData = apiData?.Compare_Expense_Forecast_Scenarios;
                      const baseAi   = toCalcNumber(compData?.baseline?.total_ai);
                      const multiplier = toCalcNumber(sc.multiplier) || 1;
                      const d        = compData?.[sc.scenario_name];
                      const dAi      = toCalcNumber(d?.total_ai);
                      const dUser    = toCalcNumber(d?.total_user);
                      const totalAi   = dAi   || (baseAi * multiplier);
                      const totalUser = dUser || (baseAi * multiplier);
                      const vAmt = d ? (toCalcNumber(d.variance_amount) || (dUser - dAi)) : (totalUser - baseAi);
                      const vPct = d?.variance_percent != null ? toCalcNumber(d.variance_percent).toFixed(getDecimalPrecision()) : (baseAi ? ((vAmt/baseAi)*100).toFixed(getDecimalPrecision()) : "0.0");
                      return (
                        <div key={sc.id??sc.scenario_name} className="bg-white rounded-xl border border-sky-200 shadow-sm hover:shadow-md transition-all overflow-hidden">
                          <div className={`h-1 ${style.top}`}/>
                          <div className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2.5">
                                <span className="text-xl leading-none">{style.icon}</span>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <p className="font-semibold text-sky-900 text-s capitalize">{sc.scenario_name.replace(/_/g," ")}</p>
                                    {sc.is_system && <span className="px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-500 text-xs font-semibold border border-sky-200">System</span>}
                                  </div>
                                  <p className=" text-xs text-sky-400 tabular-nums">{year} · {quarter} · {sc.multiplier}×</p>
                                </div>
                              </div>
                              <div className="relative">
                                <button onClick={(e)=>{ e.stopPropagation(); setOpenMenuId(openMenuId===(sc.id??sc.scenario_name)?null:(sc.id??sc.scenario_name)); }}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sky-400 hover:bg-sky-100 hover:text-sky-700 transition-colors">
                                  <FiMoreVertical size={14}/>
                                </button>
                                {openMenuId===(sc.id??sc.scenario_name) && (
                                  <div className="absolute right-0 top-8 z-20 bg-white rounded-xl border border-sky-200 shadow-xl overflow-hidden w-32" onClick={(e)=>e.stopPropagation()}>
                                    <button onClick={()=>{setScenarioModal({open:true,edit:sc});setOpenMenuId(null);}} disabled={sc.is_system&&!sc.id}
                                      className="flex items-center gap-2 w-full px-3 py-2.5 text-x text-sky-700 hover:bg-sky-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                      <FiEdit2 size={12}/> Edit
                                    </button>
                                    <button onClick={()=>{setDeleteModal({open:true,scenario:sc});setOpenMenuId(null);}} disabled={sc.is_system}
                                      className="flex items-center gap-2 w-full px-3 py-2.5 text-x text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed border-t border-sky-100">
                                      <FiTrash2 size={12}/> Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              <div className="bg-sky-50 rounded-lg p-2.5 border border-sky-200">
                                <p className="text-xs text-sky-500 font-medium mb-0.5">AI Total</p>
                                <p className="text-s font-bold text-sky-700 tabular-nums">{fmt(totalAi)}</p>
                              </div>
                              <div className="bg-sky-50 rounded-lg p-2.5 border border-sky-200">
                                <p className="text-xs text-sky-500 font-medium mb-0.5">Adjusted</p>
                                <p className="text-s font-bold text-sky-900 tabular-nums">{fmt(totalUser)}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-sky-50 border border-sky-200">
                              <span className=" text-xs text-sky-500 font-medium">Variance</span>
                              <span className={`text-x font-bold tabular-nums ${Number(vAmt)<=0?"text-emerald-600":"text-red-600"}`}>
                                {Number(vAmt)>=0?"+":""}{fmt(vAmt)} ({vPct}%)
                              </span>
                            </div>
                            {sc.description && <p className="text-x text-sky-500 mt-2.5 leading-relaxed line-clamp-2">{sc.description}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-white rounded-xl border border-sky-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-sky-200 bg-sky-50 flex items-center gap-2">
                      <FiBarChart2 className="text-sky-500" size={14}/>
                      <span className="font-semibold text-sky-800 text-s">Scenario Comparison — {year} {quarter}</span>
                      <span className="ml-auto  text-xs text-sky-400 tabular-nums">{scenariosList.length} scenarios</span>
                    </div>
                    <div className="analytics-table-scroll overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-sky-50 border-b border-sky-200">
                            <th className="px-4 py-3 text-left  text-xs font-semibold text-sky-500 uppercase tracking-wide">Metric</th>
                            {scenariosList.map(sc => (
                              <th key={sc.id??sc.scenario_name} className="px-4 py-3 text-right  text-xs font-semibold text-sky-700 capitalize tracking-wide">
                                {sc.scenario_name.replace(/_/g," ")}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {[
                            { label:"Multiplier",   fn:(sc)=>`${sc.multiplier}×` },
                            { label:"AI Total",     fn:(sc)=>{ const c=apiData?.Compare_Expense_Forecast_Scenarios; const b=toCalcNumber(c?.baseline?.total_ai); const d=c?.[sc.scenario_name]; return fmt(toCalcNumber(d?.total_ai)||b*(toCalcNumber(sc.multiplier)||1)); } },
                            { label:"User Forecast",fn:(sc)=>{ const c=apiData?.Compare_Expense_Forecast_Scenarios; const b=toCalcNumber(c?.baseline?.total_ai); const d=c?.[sc.scenario_name]; return fmt(toCalcNumber(d?.total_user)||b*(toCalcNumber(sc.multiplier)||1)); }, bold:true },
                            { label:"Variance ($)", fn:(sc)=>{ const c=apiData?.Compare_Expense_Forecast_Scenarios; const d=c?.[sc.scenario_name]; if(!d)return"—"; const dAi=toCalcNumber(d.total_ai); const dUser=toCalcNumber(d.total_user); const v=toCalcNumber(d.variance_amount)||(dUser-dAi); return <span className={v<=0?"text-emerald-600 font-bold":"text-red-600 font-bold"}>{v>=0?"+":""}{fmt(v)}</span>; } },
                            { label:"Variance (%)", fn:(sc)=>{ const c=apiData?.Compare_Expense_Forecast_Scenarios; const d=c?.[sc.scenario_name]; if(!d)return"—"; const v=toCalcNumber(d.variance_percent); return <span className={v<=0?"text-emerald-600 font-bold":"text-red-600 font-bold"}>{v>=0?"+":""}{v.toFixed(getDecimalPrecision())}%</span>; } },
                          ].map((row,ri)=>(
                            <tr key={row.label} className={`border-b border-sky-100 ${ri%2===0?"bg-white":"bg-sky-50/40"}`}>
                              <td className="px-4 py-3 font-medium text-sky-700 text-md">{row.label}</td>
                              {scenariosList.map(sc=>(
                                <td key={sc.id??sc.scenario_name} className={`px-4 py-3 text-right tabular-nums text-md ${row.bold?"font-bold text-sky-900":"text-sky-600"}`}>{row.fn(sc)}</td>
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
          <div className="mt-5 flex items-center flex-wrap gap-3 px-4 py-2.5 bg-white rounded-xl border border-sky-200  text-xs text-sky-400 tabular-nums shadow-sm">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"/>{rows.length} expense items</span>
            <span className="text-sky-300">·</span>
            <span>Year: <strong className="text-sky-600">{year}</strong></span>
            <span className="text-sky-300">·</span>
            <span>Quarter: <strong className="text-sky-600">{quarter}</strong></span>
            <span className="text-sky-300">·</span>
            <span>Stage: <strong className="text-sky-700">{STAGE_LABELS[stage]}</strong></span>
            <span className="text-sky-300">·</span>
            <span>AI: <strong className="text-sky-600">{fmt(totals.aiTotal)}</strong></span>
            <span className="text-sky-300">·</span>
            <span>Adj: <strong className="text-sky-700">{fmt(totals.usrTotal)}</strong></span>
            <span className={`font-bold ${variance<=0?"text-emerald-600":"text-red-500"}`}>{variance<=0?"▼":"▲"} {Math.abs(Number(varPct))}%</span>
          </div>
        )}
        */}

        {/* FIX: Lazy-loaded discussion — only fetches when scrolled into view */}
        <OverallChat year={year} quarter={quarter} token={token} API_BASE={API_BASE} addToast={addToast}/>

      </main>
    </div>
  );
}

