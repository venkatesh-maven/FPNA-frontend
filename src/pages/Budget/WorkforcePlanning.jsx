// WorkforcePlanning.jsx — Existing Employees / New Positions / Position
// Changes. Backed by real endpoints under /api/v1/budget/workforce/{year}/...
// AI Recommended values come from the Forecasting module's per-employee
// payroll ML pipeline (fpna_config.payroll_forecast_precomputed); user edits
// persist to fpna_config.budget_workforce_* tables. Architecture mirrors
// RevenueBudgeting.jsx exactly — same currency filter, workflow, pagination,
// and table styling conventions.
import React, { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  FiUsers, FiUserPlus, FiRepeat, FiSearch, FiX, FiMessageSquare,
  FiBarChart2, FiDownload, FiUpload, FiAlertTriangle, FiPlus, FiList, FiLayers,
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
import {
  ExceptionBadge, ExceptionDrawer, ExceptionSummaryStrip, useExceptions,
  WORKFORCE_EXCEPTION_REASONS,
} from "./exceptionHelpers";

const API_BASE = `${API_BASE_URL}/api/v1/budget/workforce`;

async function parseErr(res) {
  try {
    const data = await res.json();
    return data?.detail || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

const normalizeEmployees = (list) => (list || []).map((e) => ({
  ...e,
  prior_salary: parseMoney(e.prior_salary),
  current_salary: parseMoney(e.current_salary),
  ai_salary: parseMoney(e.ai_salary),
  ai_bonus: parseMoney(e.ai_bonus),
  ai_benefits: parseMoney(e.ai_benefits),
  ai_taxes: parseMoney(e.ai_taxes),
  ai_total_cost: parseMoney(e.ai_total_cost),
  adjusted_salary: parseMoney(e.adjusted_salary),
  adjusted_benefits: parseMoney(e.adjusted_benefits),
  adjusted_taxes: parseMoney(e.adjusted_taxes),
  adjusted_total_cost: parseMoney(e.adjusted_total_cost),
  current_forecast: parseMoney(e.current_forecast),
  forecast_exit: parseMoney(e.forecast_exit),
  months: (e.months || []).map((m) => ({
    ...m,
    ai_salary: parseMoney(m.ai_salary), ai_bonus: parseMoney(m.ai_bonus),
    ai_benefits: parseMoney(m.ai_benefits), ai_taxes: parseMoney(m.ai_taxes),
    adjusted_salary: parseMoney(m.adjusted_salary),
    // Headcount x Budget Salary = Budget Total — adjusted_total is the
    // headcount-scaled figure the backend now computes; everywhere that
    // used to sum raw adjusted_salary reads this instead so headcount edits
    // flow through to Summary/KPI totals, not just the Drivers row itself.
    // headcount defaults to 1 (never null after normalize) so downstream
    // math never has to guard against a missing value, only the transient
    // "" while a cell is actively being typed into.
    headcount: m.headcount ?? 1,
    adjusted_total: parseMoney(m.adjusted_total) ?? (parseMoney(m.adjusted_salary) || 0) * (m.headcount ?? 1),
    adjusted_benefits: parseMoney(m.adjusted_benefits), adjusted_taxes: parseMoney(m.adjusted_taxes),
    // Backend returns the saved per-month override as `override_reason`/
    // `override_note`; the row/modal read it as `m.override` (same shape as
    // the yearly `e.reason`) so both reason buttons share rendering logic.
    override: m.override_reason ? { reason: m.override_reason, note: m.override_note || "" } : null,
  })),
}));
const normalizePositions = (list) => (list || []).map((p) => ({
  ...p,
  ai_salary: parseMoney(p.ai_salary), adjusted_salary: parseMoney(p.adjusted_salary),
  ai_benefits: parseMoney(p.ai_benefits), ai_taxes: parseMoney(p.ai_taxes),
  adjusted_benefits: parseMoney(p.adjusted_benefits), adjusted_taxes: parseMoney(p.adjusted_taxes),
}));
const normalizeChanges = (list) => (list || []).map((c) => ({
  ...c, from_salary: parseMoney(c.from_salary), to_salary: parseMoney(c.to_salary),
}));
const normalizeCompareRows = (list) => (list || []).map((r) => ({
  ...r,
  prior_salary: parseMoney(r.prior_salary), current_forecast: parseMoney(r.current_forecast),
  ai_budget: parseMoney(r.ai_budget), user_budget: parseMoney(r.user_budget), variance_vs_forecast: parseMoney(r.variance_vs_forecast),
}));

// Benefits/tax rates match the backend exactly (workforce_controller.py) —
// used only to recompute the derived columns instantly on edit, before Save
// round-trips to the server and returns the authoritative numbers.
const BENEFITS_RATE = 0.20;
const TAX_RATE = 0.09;

const rowStatus = (e, totalAi, totalAdj) => {
  const changed = Number(totalAdj) !== Number(totalAi);
  if (!changed) return { label: "AI Baseline", cls: "bg-slate-100 text-slate-600" };
  if (e.reason) return { label: "Modified", cls: "bg-sky-50 text-sky-700" };
  return { label: "Needs Reason", cls: "bg-amber-50 text-amber-700" };
};

const TABS = [
  { id: "existing", label: "Existing Employees", icon: <FiUsers size={13} /> },
  { id: "new", label: "New Positions", icon: <FiUserPlus size={13} /> },
  { id: "changes", label: "Position Changes", icon: <FiRepeat size={13} /> },
];

const EMPLOYEE_PAGE_SIZE = 100;

// One row per employee, with each period's AI/Adjusted salary as repeating
// column groups — same horizontal layout convention as Revenue Budgeting's
// Summary table. Each month is a true (already prorated) monthly amount, so
// Total AI/Adjusted is the SUM of the 12 months — same additive convention
// as Forecasting's People Expense breakdown.
const ExistingEmployeeRow = memo(function ExistingEmployeeRow({ e, rowIdx, editable, onSalary, onSalaryFocus, onSalaryBlur, onOpenReason, onOpenException }) {
  const totalAi = e.months.reduce((a, m) => a + m.ai_salary, 0);
  // Headcount x Budget Salary — same as the Drivers view's own total, so a
  // headcount edit made there is reflected here too without a refetch.
  const totalAdj = e.months.reduce((a, m) => a + (Number(m.adjusted_total) || 0), 0);
  const benefits = round2(totalAdj * BENEFITS_RATE);
  const taxes = round2(totalAdj * TAX_RATE);
  const total = round2(totalAdj + e.ai_bonus + benefits + taxes);
  const variance = round2(total - e.ai_total_cost);
  const status = rowStatus(e, totalAi, totalAdj);
  const rowBg = rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/60";
  return (
    <tr className={`rf-row border-b border-slate-200 transition-colors hover:bg-sky-50/50 ${rowBg}`}>
      <td className={`px-3 py-1 sticky left-0 border-r border-slate-200 z-[5] ${rowBg}`}>
        <div className="flex items-center gap-1.5">
          <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${avatarClass(e.employee_name)}`}>{getInitials(e.employee_name)}</div>
          <span className="font-semibold text-slate-900 text-xs leading-tight truncate" title={e.employee_name}>{e.employee_name}</span>
        </div>
      </td>
      <td className="px-3 py-1 text-xs text-slate-600 truncate border-r border-slate-100">{e.department}</td>
      <td className="px-3 py-1 text-xs text-slate-600 truncate border-r border-slate-100">{e.role}</td>
      <td className="px-3 py-1 text-right tabular-nums text-xs text-slate-500 border-r border-slate-100">{fmt(e.prior_salary)}</td>
      <td className="px-3 py-1 text-right tabular-nums text-xs text-slate-500 border-r border-slate-100">{fmt(e.current_salary)}</td>
      <td className={`px-3 py-1 text-right tabular-nums text-xs font-semibold border-r border-slate-300 ${e.merit_pct > 0 ? "text-emerald-600" : e.merit_pct < 0 ? "text-red-500" : "text-slate-400"}`}>{e.merit_pct === 0 ? "—" : `${e.merit_pct > 0 ? "+" : ""}${e.merit_pct}%`}</td>
      <td className="px-2 py-1 text-right text-xs text-slate-500 tabular-nums border-r border-slate-100 bg-slate-50/60">{fmt(totalAi)}</td>
      <td className={`px-2 py-1 text-right text-xs font-bold tabular-nums border-r border-slate-300 ${totalAdj > totalAi ? "text-emerald-600" : totalAdj < totalAi ? "text-red-500" : "text-sky-700"}`}>{fmt(totalAdj)}</td>
      {e.months.map((m, mi) => (
        <React.Fragment key={m.period}>
          <td className="px-2 py-1 text-right text-xs text-slate-500 tabular-nums border-r border-slate-100">{fmt(m.ai_salary)}</td>
          <td className="px-1.5 py-1 border-r border-slate-100">
            <input type="number" value={m.adjusted_salary ?? ""} disabled={!editable}
              onFocus={() => onSalaryFocus?.(e.employee_id, m.period, m.adjusted_salary)}
              onBlur={() => onSalaryBlur?.(e.employee_id, m.period)}
              onChange={(ev) => onSalary(e.employee_id, mi, ev.target.value)}
              className={`w-full px-1.5 py-0.5 rounded-md border text-right text-xs tabular-nums outline-none transition-all
                ${!editable ? "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200" :
                  Number(m.adjusted_salary) !== m.ai_salary ? "border-sky-400 bg-sky-50 text-sky-900 focus:ring-2 ring-sky-100" :
                  "border-slate-300 bg-white hover:border-slate-400 focus:border-sky-500 focus:ring-2 ring-sky-100"}`} />
          </td>
          <td className="px-0.5 py-1 text-center border-r border-slate-300">
            <button onClick={() => onOpenReason(e, m.period)}
              className={`w-6 h-6 rounded-md flex items-center justify-center transition-all mx-auto ${m.override ? "bg-sky-100 text-sky-600 border border-sky-200 hover:bg-sky-200" : "text-slate-300 hover:text-sky-500 hover:bg-sky-50"}`}
              title={m.override ? `${m.override.reason}${m.override.note ? ": " + m.override.note : ""}` : `Add reason for ${m.period}`}>
              <FiMessageSquare size={11} />
            </button>
          </td>
        </React.Fragment>
      ))}
      <td className="px-3 py-1 text-right tabular-nums text-xs text-slate-500 border-r border-slate-100">{fmt(benefits)}</td>
      <td className="px-3 py-1 text-right tabular-nums text-xs text-slate-500 border-r border-slate-100">{fmt(taxes)}</td>
      <td className="px-3 py-1 text-right tabular-nums text-xs font-semibold text-sky-800 border-r border-slate-100">{fmt(total)}</td>
      <td className={`px-3 py-1 text-right tabular-nums text-xs font-semibold border-r border-slate-100 ${variance > 0 ? "text-emerald-600" : variance < 0 ? "text-red-500" : "text-slate-400"}`}>{variance === 0 ? "—" : `${variance > 0 ? "+" : ""}${fmt(variance)}`}</td>
      <td className="px-2 py-1 text-center border-r border-slate-100">
        <div className="flex flex-col items-center gap-1">
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${status.cls}`}>{status.label}</span>
          <ExceptionBadge exception={e.exception} onClick={() => onOpenException(e)} />
        </div>
      </td>
      <td className="px-1.5 py-1 text-center border-l border-slate-100">
        <button onClick={() => onOpenReason(e)}
          className={`flex items-center gap-1 px-1.5 py-1 rounded-md transition-all max-w-[115px] mx-auto ${e.reason ? "bg-sky-100 text-sky-700 border border-sky-200 hover:bg-sky-200" : "text-slate-300 hover:text-sky-500 hover:bg-sky-50"}`}
          title={e.reason ? `${e.reason.reason}${e.reason.note ? ": " + e.reason.note : ""}` : "Add override reason"}>
          <FiMessageSquare size={11} className="shrink-0" />
          {e.reason && <span className="text-xs font-semibold truncate">{e.reason.reason}</span>}
        </button>
      </td>
      <td className="px-2 py-1 border-l border-slate-300">
        <ExplainPopover reasons={e.reasons} confidence={e.confidence} label={`${e.employee_name} — AI Reasoning`}
          value={fmt(e.ai_salary)} valueLabel="AI Recommended Salary" variant="cell" />
      </td>
    </tr>
  );
});

// Drivers view — same horizontal layout convention as Opex/CAPEX's Drivers
// views: Headcount x Budget Salary = Budget Total, repeating per month.
// Headcount defaults to 1 (one named person) but is editable — e.g. to model
// a job-share or a role being budgeted at more/less than one FTE — and
// changing it recalculates Budget Total (here and on the Summary tab) live.
// AI Salary is never scaled by headcount: it's a real single-person
// compensation figure, not a per-head rate.
const ExistingEmployeeDriverRow = memo(function ExistingEmployeeDriverRow({ e, rowIdx, editable, onSalary, onSalaryFocus, onSalaryBlur, onHeadcount }) {
  const totalAi = e.months.reduce((a, m) => a + m.ai_salary, 0);
  const totalAdj = e.months.reduce((a, m) => a + (Number(m.adjusted_total) || 0), 0);
  const rowBg = rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/60";
  return (
    <tr className={`rf-row border-b border-slate-200 transition-colors hover:bg-sky-50/50 ${rowBg}`}>
      <td className={`px-3 py-1 sticky left-0 border-r border-slate-200 z-[5] ${rowBg}`}>
        <div className="flex items-center gap-1.5">
          <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${avatarClass(e.employee_name)}`}>{getInitials(e.employee_name)}</div>
          <span className="font-semibold text-slate-900 text-xs leading-tight truncate" title={e.employee_name}>{e.employee_name}</span>
        </div>
      </td>
      <td className="px-2 py-1 text-right text-xs text-slate-500 tabular-nums border-r border-slate-100 bg-slate-50/60">{fmt(totalAi)}</td>
      <td className={`px-2 py-1 text-right text-xs font-bold tabular-nums border-r border-slate-300 ${totalAdj > totalAi ? "text-emerald-600" : totalAdj < totalAi ? "text-red-500" : "text-sky-700"}`}>{fmt(totalAdj)}</td>
      {e.months.map((m, mi) => (
        <React.Fragment key={m.period}>
          <td className="px-1 py-1 border-r border-slate-100">
            <div className="flex items-center justify-center gap-1">
              <input type="number" value={m.headcount ?? 1} disabled={!editable}
                onChange={(ev) => onHeadcount(e.employee_id, mi, ev.target.value)}
                className={`w-14 px-1 py-0.5 rounded-md border text-right tabular-nums text-xs outline-none transition-all block
                  ${!editable ? "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200" :
                    Number(m.headcount) !== 1 ? "border-sky-400 bg-sky-50 text-sky-900 focus:ring-2 ring-sky-100" :
                    "border-slate-300 bg-white hover:border-slate-400 focus:border-sky-500 focus:ring-2 ring-sky-100"}`} />
              {m.headcount_mixed && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"
                  title="The months in this period don't all have the same headcount — editing here will overwrite them all with one value." />
              )}
            </div>
          </td>
          <td className="px-2 py-1 text-right text-xs text-slate-500 tabular-nums border-r border-slate-100">{fmt(m.ai_salary)}</td>
          <td className="px-1.5 py-1 border-r border-slate-300">
            <input type="number" value={m.adjusted_salary ?? ""} disabled={!editable}
              onFocus={() => onSalaryFocus?.(e.employee_id, m.period, m.adjusted_salary)}
              onBlur={() => onSalaryBlur?.(e.employee_id, m.period)}
              onChange={(ev) => onSalary(e.employee_id, mi, ev.target.value)}
              className={`w-full px-1.5 py-0.5 rounded-md border text-right text-xs tabular-nums outline-none transition-all
                ${!editable ? "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200" :
                  Number(m.adjusted_salary) !== m.ai_salary ? "border-sky-400 bg-sky-50 text-sky-900 focus:ring-2 ring-sky-100" :
                  "border-slate-300 bg-white hover:border-slate-400 focus:border-sky-500 focus:ring-2 ring-sky-100"}`} />
          </td>
        </React.Fragment>
      ))}
    </tr>
  );
});

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

const WorkforcePlanning = () => {
  const { token } = useContext(AuthContext);
  const { toasts, add } = useToast();
  const [activeTab, setActiveTab] = useState("existing");
  // Existing Employees / New Positions Summary ⇄ Drivers — same split
  // convention as Revenue/Opex/CAPEX Budgeting's own Summary/Drivers tabs.
  const [employeesView, setEmployeesView] = useState("summary");
  const [positionsView, setPositionsView] = useState("summary");
  const [stage, setStage] = useState("draft");
  const [modal, setModal] = useState({ open: false, target: null });
  // `period: null` = the yearly bulk-set button (unchanged legacy behavior);
  // `period` set = the per-month reason button, scoped to one employee+month.
  const [reasonModal, setReasonModal] = useState({ open: false, employee: null, period: null });
  const [savingReason, setSavingReason] = useState(false);

  const { budgetYear, fiscalYearStartMonth } = useContext(BudgetYearContext);
  const { methodology } = useContext(BudgetMethodologyContext);
  const { guidelines, frequency } = useContext(BudgetGuidelinesContext);
  // Top-Down allocation edits are local-only in this static-data-first pass —
  // keyed by department name.
  const [workforceAllocAdj, setWorkforceAllocAdj] = useState({});
  const currentFiscalYear = budgetYear - 1;
  const priorFiscalYear = budgetYear - 2;
  const [departmentId, setDepartmentId] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState("actualvalue");

  const [filterText, setFilterText] = useState("");
  const [fConfidence, setFConfidence] = useState("All");
  // Which ExceptionSummaryStrip tile is active — "all" | "within" |
  // "exception" | "pending" | "approved" | "rejected". Replaces the old
  // fExceptionsOnly boolean so every tile (not just "Exceptions") filters
  // the table; the "Show only exceptions" checkbox is now just a shortcut
  // that reads/writes the same state (checked === fStatus === "exception").
  const [fStatus, setFStatus] = useState("all");
  const [exceptionDrawerEmp, setExceptionDrawerEmp] = useState(null);
  const exceptions = useExceptions(budgetYear, "workforce");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [editable, setEditable] = useState(true);
  const [meta, setMeta] = useState({ departments: [] });

  const [positions, setPositions] = useState([]);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [positionsLoaded, setPositionsLoaded] = useState(false);
  const [changes, setChanges] = useState([]);
  const [changesLoading, setChangesLoading] = useState(false);
  const [changesLoaded, setChangesLoaded] = useState(false);
  const [showNewPosition, setShowNewPosition] = useState(false);

  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [guardSaving, setGuardSaving] = useState(false);

  // Remembers each salary cell's value at focus time (keyed by
  // `${employee_id}|${period}`), so onBlur can tell whether the user
  // actually changed it before offering "apply to all 12 months".
  const focusValuesRef = useRef({});
  const [applyAllMonthsModal, setApplyAllMonthsModal] = useState({ open: false, employeeId: null, employeeName: null, value: null });
  const [applyingAllMonths, setApplyingAllMonths] = useState(false);

  const dirtyEmployeesRef = useRef(new Set());   // `${employee_id}::${period}`
  const dirtyPositionsRef = useRef(new Set());   // id
  const [periods, setPeriods] = useState([]);

  const [employeePage, setEmployeePage] = useState(1);
  useEffect(() => { setEmployeePage(1); }, [filterText, departmentId, fConfidence, fStatus]);

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

  // budgetYear starts from a localStorage display cache and gets corrected
  // shortly after mount once BudgetYearContext resolves the real value from
  // the backend — without a sequence guard, a slow response for the stale
  // guessed year can land AFTER the corrected year's response and silently
  // overwrite it, showing the wrong year's data. Same fix RevenueBudgeting.jsx
  // already applies to its own fetch.
  const employeesFetchSeqRef = useRef(0);
  const employeesAbortCtrlRef = useRef(null);

  const fetchEmployees = useCallback(async () => {
    if (employeesAbortCtrlRef.current) employeesAbortCtrlRef.current.abort();
    const controller = new AbortController();
    employeesAbortCtrlRef.current = controller;
    const seq = ++employeesFetchSeqRef.current;

    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ currency_filter: currencyFilter });
      if (departmentId) q.set("department_id", departmentId);
      const [res, wfRes] = await Promise.all([
        fetch(`${API_BASE}/${budgetYear}/existing-employees?${q}`, { headers: authHeaders(), signal: controller.signal }),
        fetch(`${API_BASE}/${budgetYear}/workflow`, { headers: authHeaders(), signal: controller.signal }),
      ]);
      for (const r of [res, wfRes]) if (!r.ok) throw new Error(await parseErr(r));
      const data = await res.json();
      const wfData = await wfRes.json();
      if (seq !== employeesFetchSeqRef.current) return; // a newer fetch has since started

      setEmployees(normalizeEmployees(data.employees));
      setPeriods(data.periods || []);
      setEditable(data.editable !== false);
      // Spread onto the { departments: [] } default rather than replacing it
      // outright — older/un-upgraded backend deployments may not include
      // `departments` in meta yet, and overwriting wholesale would leave
      // meta.departments undefined and crash the dropdown/filter below.
      if (data.meta) setMeta((prev) => ({ ...prev, ...data.meta }));
      setStage(wfData.stage || "draft");
    } catch (e) {
      if (e?.name === "AbortError") return;
      if (seq !== employeesFetchSeqRef.current) return;
      setError(e.message || "Failed to load Workforce Planning data.");
    } finally {
      if (seq === employeesFetchSeqRef.current) setLoading(false);
    }
  // Planning Frequency (Setup & Guidelines) drives what grain the backend
  // returns `employees[].months` at — the backend derives it itself (no
  // `view` query param needed here, mirroring Revenue Budgeting), but a
  // `frequency` change still needs to trigger a refetch.
  }, [budgetYear, departmentId, currencyFilter, frequency, authHeaders, fiscalYearStartMonth]);

  const fetchPositions = useCallback(async () => {
    setPositionsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/${budgetYear}/new-positions?currency_filter=${currencyFilter}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(await parseErr(res));
      const data = await res.json();
      setPositions(normalizePositions(data.positions));
      setPositionsLoaded(true);
    } catch (e) {
      add(`Failed to load new positions: ${e.message}`, "error");
    } finally {
      setPositionsLoading(false);
    }
  }, [budgetYear, currencyFilter, authHeaders, add]);

  const fetchChanges = useCallback(async () => {
    setChangesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/${budgetYear}/position-changes?currency_filter=${currencyFilter}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(await parseErr(res));
      const data = await res.json();
      setChanges(normalizeChanges(data.changes));
      setChangesLoaded(true);
    } catch (e) {
      add(`Failed to load position changes: ${e.message}`, "error");
    } finally {
      setChangesLoading(false);
    }
  }, [budgetYear, currencyFilter, authHeaders, add, fiscalYearStartMonth]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);
  // Fetched eagerly (not gated on the "New Positions" tab being opened) because
  // the "New Positions Cost"/"Total Workforce Budget" KPI cards are always
  // visible and need this data from first render, not just once the tab is clicked.
  useEffect(() => { fetchPositions(); }, [fetchPositions]);
  useEffect(() => { setChangesLoaded(false); }, [budgetYear]);
  useEffect(() => {
    if (activeTab === "changes" && !changesLoaded && !changesLoading) fetchChanges();
  }, [activeTab, changesLoaded, changesLoading, fetchChanges]);

  const refetchLoaded = useCallback(() => {
    fetchEmployees();
    if (positionsLoaded) fetchPositions();
  }, [fetchEmployees, fetchPositions, positionsLoaded]);

  // Department name for the selected department_id — the dropdown carries ids
  // (a real GL/HR column), each employee's `department` field is already the
  // real name (employees have one genuine department, unlike Revenue's
  // derived-by-revenue customers), so the row filter compares by name.
  const selectedDepartmentName = useMemo(
    () => (meta.departments || []).find((d) => d.id === departmentId)?.name,
    [meta.departments, departmentId]
  );

  const filteredEmployees = useMemo(
    () => employees.filter((e) =>
      e.employee_name.toLowerCase().includes(filterText.toLowerCase()) &&
      (!departmentId || e.department === selectedDepartmentName) &&
      (fConfidence === "All" || e.confidence === fConfidence) &&
      (fStatus === "all" ||
        (fStatus === "within" && !e.exception) ||
        (fStatus === "exception" && !!e.exception) ||
        (fStatus === "pending" && e.exception?.approval_status === "pending") ||
        (fStatus === "approved" && e.exception?.approval_status === "approved") ||
        (fStatus === "rejected" && e.exception?.approval_status === "rejected"))
    ),
    [employees, filterText, departmentId, selectedDepartmentName, fConfidence, fStatus]
  );

  const employeePageCount = Math.max(1, Math.ceil(filteredEmployees.length / EMPLOYEE_PAGE_SIZE));
  const safeEmployeePage = Math.min(Math.max(1, employeePage), employeePageCount);
  const pagedEmployees = useMemo(() => {
    const start = (safeEmployeePage - 1) * EMPLOYEE_PAGE_SIZE;
    return filteredEmployees.slice(start, start + EMPLOYEE_PAGE_SIZE);
  }, [filteredEmployees, safeEmployeePage]);

  const employeeIndexById = useMemo(() => {
    const map = new Map();
    employees.forEach((e, i) => map.set(e.employee_id, i));
    return map;
  }, [employees]);

  // Live per-employee AI/Adjusted annual totals — recomputed from e.months
  // every render (not the stale top-level e.ai_salary/adjusted_salary, which
  // only reflect the server's last-known values) so KPIs/footer reflect
  // edits instantly, same as each row's own totalAi/totalAdj. Each month is
  // a true (already prorated) monthly amount, so the annual figure is a SUM
  // of the 12 months, not an average.
  const totals = useMemo(() => {
    let aiSalarySum = 0, userSalarySum = 0, benefitsSum = 0, taxesSum = 0, aiCostSum = 0, userCostSum = 0;
    filteredEmployees.forEach((e) => {
      const aiTotal = e.months.reduce((a, m) => a + m.ai_salary, 0);
      const adjTotal = e.months.reduce((a, m) => a + (Number(m.adjusted_total) || 0), 0);
      const benefits = round2(adjTotal * BENEFITS_RATE);
      const taxes = round2(adjTotal * TAX_RATE);
      aiSalarySum += aiTotal;
      userSalarySum += adjTotal;
      benefitsSum += benefits;
      taxesSum += taxes;
      aiCostSum += e.ai_total_cost;
      userCostSum += adjTotal + e.ai_bonus + benefits + taxes;
    });
    return {
      aiSalarySum, userSalarySum, benefitsSum, taxesSum, aiTotal: aiCostSum, userTotal: userCostSum,
      variance: userCostSum - aiCostSum, variancePct: aiCostSum ? ((userCostSum - aiCostSum) / aiCostSum) * 100 : 0,
    };
  }, [filteredEmployees]);

  // Department-level aggregation for the Top-Down allocation view — Top-Down
  // budgets at department grain, not per-employee.
  const departmentAllocationRows = useMemo(() => {
    const map = new Map();
    filteredEmployees.forEach((e) => {
      const key = e.department || "Unassigned";
      map.set(key, (map.get(key) || 0) + (e.forecast_exit || 0));
    });
    return Array.from(map.entries()).map(([name, priorShare]) => ({ key: name, name, priorShare }));
  }, [filteredEmployees]);

  const workforceForecastExitTotal = useMemo(
    () => filteredEmployees.reduce((s, e) => s + (e.forecast_exit || 0), 0),
    [filteredEmployees]
  );

  // Per-period sums across employees for the Grand Total footer row — this
  // one genuinely IS additive (total payroll cost across the whole roster
  // for a given month), unlike a single employee's own monthly readings.
  const employeeSummaryTotals = useMemo(() => {
    const perPeriod = periods.map((p, mi) => {
      let ai = 0, adj = 0, headcount = 0;
      filteredEmployees.forEach((e) => {
        const m = e.months[mi];
        if (m) { ai += m.ai_salary || 0; adj += Number(m.adjusted_total) || 0; headcount += Number(m.headcount) || 0; }
      });
      return { period: p, ai, adj, headcount };
    });
    return { perPeriod };
  }, [filteredEmployees, periods]);

  const newPositionsCost = useMemo(() => positions.reduce((s, p) => {
    const salary = Number(p.adjusted_salary) || 0;
    return s + (salary + round2(salary * BENEFITS_RATE) + round2(salary * TAX_RATE)) * (p.quantity || 0);
  }, 0), [positions]);

  const updateSalary = useCallback((employeeId, monthIndex, value) => {
    const idx = employeeIndexById.get(employeeId);
    if (idx == null) return;
    setHasChanges(true);
    setEmployees((prev) => {
      const next = [...prev];
      const e = { ...next[idx], months: next[idx].months.map((m) => ({ ...m })) };
      const m = e.months[monthIndex];
      const salary = value === "" ? "" : Number(value);
      m.adjusted_salary = salary;
      m.adjusted_total = (Number(salary) || 0) * (Number(m.headcount) || 0);
      dirtyEmployeesRef.current.add(`${employeeId}::${m.period}`);
      next[idx] = e;
      return next;
    });
  }, [employeeIndexById]);

  // Headcount x Budget Salary = Budget Total, same Quantity x Unit Cost
  // convention Opex/CAPEX's driver lines use — recalculates live here and
  // (via the shared adjusted_total field) on the Summary tab and KPI totals.
  const updateHeadcount = useCallback((employeeId, monthIndex, value) => {
    const idx = employeeIndexById.get(employeeId);
    if (idx == null) return;
    setHasChanges(true);
    setEmployees((prev) => {
      const next = [...prev];
      const e = { ...next[idx], months: next[idx].months.map((m) => ({ ...m })) };
      const m = e.months[monthIndex];
      const headcount = value === "" ? "" : Number(value);
      m.headcount = headcount;
      m.adjusted_total = (Number(m.adjusted_salary) || 0) * (Number(headcount) || 0);
      dirtyEmployeesRef.current.add(`${employeeId}::${m.period}`);
      next[idx] = e;
      return next;
    });
  }, [employeeIndexById]);

  // Track each salary cell's value at focus time so onBlur can tell whether
  // the user actually changed it before offering "apply to all 12 months".
  const handleSalaryFocus = useCallback((employeeId, period, value) => {
    focusValuesRef.current[`${employeeId}|${period}`] = value;
  }, []);
  const handleSalaryBlur = useCallback((employeeId, period) => {
    const key = `${employeeId}|${period}`;
    const startVal = focusValuesRef.current[key];
    delete focusValuesRef.current[key];
    if (!editable) return;
    const idx = employeeIndexById.get(employeeId);
    if (idx == null) return;
    const emp = employees[idx];
    const m = emp?.months.find((mm) => mm.period === period);
    if (!m) return;
    const curNum = toBackendNumber(m.adjusted_salary);
    if (curNum == null || toBackendNumber(startVal) === curNum) return;
    setApplyAllMonthsModal({ open: true, employeeId, employeeName: emp.employee_name, value: curNum });
  }, [editable, employeeIndexById, employees]);
  const closeApplyAllMonthsModal = () => setApplyAllMonthsModal({ open: false, employeeId: null, employeeName: null, value: null });

  // "Yes, apply to all 12 months" — write the value into every visible month
  // column locally and persist it across all 12 periods on the backend in
  // one shot (budget_workforce_adjustments is one row per month, and the
  // budget has a single workflow stage for the whole year).
  const applySalaryToAllMonths = async () => {
    const { employeeId, employeeName, value } = applyAllMonthsModal;
    if (employeeId == null) { closeApplyAllMonthsModal(); return; }
    setApplyingAllMonths(true);
    try {
      const idx = employeeIndexById.get(employeeId);
      if (idx != null) {
        employees[idx].months.forEach((m, mi) => updateSalary(employeeId, mi, value));
      }
      const res = await fetch(`${API_BASE}/${budgetYear}/existing-employees/apply-all-months`, {
        method: "PATCH", headers: authHeaders(true),
        body: JSON.stringify({ employee_id: employeeId, value }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "Failed to apply to all 12 months");
      add(`Applied to all 12 months for ${employeeName} ✓`, "success");
    } catch (e) {
      add(`Failed to apply to all 12 months: ${e.message}`, "error");
    } finally {
      setApplyingAllMonths(false);
      closeApplyAllMonthsModal();
    }
  };

  // New Positions Drivers — Planned Headcount x Budget Salary = Budget Total,
  // same Quantity x Unit Cost convention as Opex/CAPEX's driver items. Shared
  // by both the Summary and Drivers tables so edits in either place update
  // the same underlying `positions` state and stay in sync.
  const updatePositionQuantity = useCallback((id, value) => {
    const qty = Number(value) || 0;
    setHasChanges(true);
    dirtyPositionsRef.current.add(id);
    setPositions((prev) => prev.map((x) => (x.id === id ? { ...x, quantity: qty } : x)));
  }, []);
  const updatePositionSalary = useCallback((id, value) => {
    const salary = value === "" ? "" : Number(value);
    setHasChanges(true);
    dirtyPositionsRef.current.add(id);
    setPositions((prev) => prev.map((x) => (x.id === id ? { ...x, adjusted_salary: salary } : x)));
  }, []);

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
  const [downloadingEmployeeTemplate, setDownloadingEmployeeTemplate] = useState(false);
  const [employeeTemplateUploadOpen, setEmployeeTemplateUploadOpen] = useState(false);
  const [employeeTemplateUploading, setEmployeeTemplateUploading] = useState(false);
  const [employeeTemplateUploadError, setEmployeeTemplateUploadError] = useState(null);
  const [downloadingPositionTemplate, setDownloadingPositionTemplate] = useState(false);
  const [positionTemplateUploadOpen, setPositionTemplateUploadOpen] = useState(false);
  const [positionTemplateUploading, setPositionTemplateUploading] = useState(false);
  const [positionTemplateUploadError, setPositionTemplateUploadError] = useState(null);

  const openCompareForecast = async () => {
    setCompareModal({ open: true, loading: true, data: null });
    try {
      const res = await fetch(`${API_BASE}/${budgetYear}/compare-forecast?currency_filter=${currencyFilter}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(await parseErr(res));
      const data = await res.json();
      data.employees = normalizeCompareRows(data.employees);
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
      a.download = `workforce-budget-FY${budgetYear}.xlsx`;
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

  // Summary (Adjusted Salary only) and Drivers (Headcount + Adjusted
  // Salary) each get their own template/upload endpoint — same convention
  // RevenueBudgeting.jsx/OpexBudgeting.jsx/CapexBudgeting.jsx use.
  const employeeTemplateSegment = employeesView === "drivers" ? "driver-adjustments" : "summary-adjustments";

  const downloadEmployeeTemplate = async () => {
    setDownloadingEmployeeTemplate(true);
    try {
      const res = await fetch(`${API_BASE}/${budgetYear}/excel-template/existing-employees/${employeeTemplateSegment}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(await parseErr(res));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `workforce-budget-employees-${employeesView}-template-FY${budgetYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      add("Template downloaded ✓", "success");
    } catch (e) {
      add(`Download failed: ${e.message}`, "error");
    } finally {
      setDownloadingEmployeeTemplate(false);
    }
  };

  const handleEmployeeTemplateUpload = async (file) => {
    setEmployeeTemplateUploading(true);
    setEmployeeTemplateUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/${budgetYear}/excel-upload/existing-employees/${employeeTemplateSegment}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
      });
      if (!res.ok) throw new Error(await parseErr(res));
      add("Salary adjustments uploaded ✓", "success");
      setEmployeeTemplateUploadOpen(false);
      refetchLoaded();
    } catch (e) {
      setEmployeeTemplateUploadError(e.message);
      add(`Upload failed: ${e.message}`, "error");
    } finally {
      setEmployeeTemplateUploading(false);
    }
  };

  const downloadPositionTemplate = async () => {
    setDownloadingPositionTemplate(true);
    try {
      const res = await fetch(`${API_BASE}/${budgetYear}/excel-template/new-positions`, { headers: authHeaders() });
      if (!res.ok) throw new Error(await parseErr(res));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `workforce-budget-positions-template-FY${budgetYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      add("Template downloaded ✓", "success");
    } catch (e) {
      add(`Download failed: ${e.message}`, "error");
    } finally {
      setDownloadingPositionTemplate(false);
    }
  };

  const handlePositionTemplateUpload = async (file) => {
    setPositionTemplateUploading(true);
    setPositionTemplateUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/${budgetYear}/excel-upload/new-positions`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
      });
      if (!res.ok) throw new Error(await parseErr(res));
      add("New positions uploaded ✓", "success");
      setPositionTemplateUploadOpen(false);
      refetchLoaded();
    } catch (e) {
      setPositionTemplateUploadError(e.message);
      add(`Upload failed: ${e.message}`, "error");
    } finally {
      setPositionTemplateUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const employeeItems = !editable ? [] : employees.flatMap((e) =>
        e.months
          .filter((m) => dirtyEmployeesRef.current.has(`${e.employee_id}::${m.period}`))
          .map((m) => ({
            employee_id: e.employee_id, period: m.period,
            salary_adjusted: m.adjusted_salary === "" ? null : m.adjusted_salary,
            headcount: m.headcount === "" ? null : m.headcount,
            override_reason: e.reason?.reason ?? null,
            override_note: e.reason?.note ?? null,
          }))
      );
      const dirtyPositions = positions.filter((p) => dirtyPositionsRef.current.has(p.id));

      const groups = [];
      if (employeeItems.length) {
        groups.push({
          label: "Existing Employees",
          clear: () => dirtyEmployeesRef.current.clear(),
          run: () => fetch(`${API_BASE}/${budgetYear}/existing-employees`, { method: "PATCH", headers: authHeaders(true), body: JSON.stringify({ items: employeeItems }) }),
        });
      }
      if (dirtyPositions.length) {
        groups.push({
          label: "New Positions",
          clear: () => dirtyPositions.forEach((p) => dirtyPositionsRef.current.delete(p.id)),
          run: async () => {
            const rs = await Promise.all(dirtyPositions.map((p) => fetch(`${API_BASE}/${budgetYear}/new-positions/${p.id}`, {
              method: "PATCH", headers: authHeaders(true),
              body: JSON.stringify({ quantity: p.quantity, adjusted_salary: p.adjusted_salary, override_reason: p.override?.reason ?? null, override_note: p.override?.note ?? null }),
            })));
            const bad = rs.find((r) => !r.ok);
            return bad || rs[0];
          },
        });
      }

      if (!groups.length) { setHasChanges(false); return; }

      const results = await Promise.allSettled(groups.map((g) => g.run()));
      const failed = [];
      for (let i = 0; i < results.length; i++) {
        const outcome = results[i];
        const ok = outcome.status === "fulfilled" && outcome.value.ok;
        if (ok) groups[i].clear();
        else {
          const detail = outcome.status === "fulfilled" ? await parseErr(outcome.value) : outcome.reason?.message || "Network error";
          failed.push(`${groups[i].label}: ${detail}`);
        }
      }
      if (failed.length) {
        add(`Save failed — ${failed.join("; ")}. Unsaved items were kept so you can retry.`, "error");
      } else {
        add("Saved to the backend.", "success");
        setHasChanges(false);
        refetchLoaded();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleGuardSave = async () => {
    setGuardSaving(true);
    try {
      await handleSave();
      setShowUnsavedModal(false);
      if (pendingAction) { pendingAction(); setPendingAction(null); }
    } finally {
      setGuardSaving(false);
    }
  };
  const handleGuardDiscard = () => {
    setHasChanges(false);
    dirtyEmployeesRef.current.clear();
    dirtyPositionsRef.current.clear();
    setShowUnsavedModal(false);
    if (pendingAction) { pendingAction(); setPendingAction(null); }
  };

  const openReasonModal = useCallback((employee, period = null) => setReasonModal({ open: true, employee, period }), []);

  const kpis = [
    { label: "AI Recommended Payroll", value: fmt(totals.aiTotal), sub: "Existing employees, fully burdened", icon: <FiUsers size={16} /> },
    { label: "Budgeted Payroll", value: fmt(totals.userTotal), sub: fmtPct(totals.variancePct, { sign: true }) + " vs AI baseline", icon: <FiRepeat size={16} /> },
    { label: "New Positions Cost", value: fmt(newPositionsCost), sub: `${positions.reduce((s, p) => s + (p.quantity || 0), 0)} planned hires`, icon: <FiUserPlus size={16} /> },
    { label: "Total Workforce Budget", value: fmt(totals.userTotal + newPositionsCost), sub: "Existing + new positions", icon: <FiUsers size={16} /> },
  ];

  const toolbarAction = (label) => {
    if (label === "Compare Forecast") { openCompareForecast(); return; }
    if (label === "Export Excel") { exportExcel(); return; }
    if (label === "Download Employee Template") { downloadEmployeeTemplate(); return; }
    if (label === "Upload Employee Excel") { setEmployeeTemplateUploadOpen(true); return; }
    if (label === "Download Position Template") { downloadPositionTemplate(); return; }
    if (label === "Upload Position Excel") { setPositionTemplateUploadOpen(true); return; }
  };

  // Loading/error states render this ahead of TableSkeleton/EmptyState so
  // that content is never the theme wrapper's first child — .forecasting-
  // pnl-theme forces ITS first child to a solid navy header treatment, which
  // otherwise painted the loading skeleton's rows navy instead of leaving
  // the header/skeleton split Revenue/Opex/CAPEX Budgeting already use.
  const staticHeader = (
    <header className="forecasting-page-header bg-gradient-to-r from-sky-950 via-sky-900 to-sky-700 rounded-xl px-4 py-2.5 md:px-6 sticky -top-5 z-40 shadow-sm">
      <div className="max-w-screen-2xl mx-auto">
        <h1 className="text-lg font-bold text-white">Workforce Planning</h1>
      </div>
    </header>
  );

  if (loading) {
    return (
      <div className="planning-compact forecasting-pnl-theme revenue-forecast-page space-y-2 min-h-screen bg-sky-50 font-sans text-sky-900 pb-12">
        {staticHeader}
        <TableSkeleton columns={10} rows={10} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="planning-compact forecasting-pnl-theme revenue-forecast-page space-y-2 min-h-screen bg-sky-50 font-sans text-sky-900 pb-12">
        {staticHeader}
        <EmptyState label={`Failed to load Workforce Planning: ${error}`} />
      </div>
    );
  }

  return (
    <div className="planning-compact forecasting-pnl-theme revenue-forecast-page space-y-2 min-h-screen bg-sky-50 font-sans text-sky-900 pb-12">
      <ToastContainer toasts={toasts} />
      <WorkflowModal open={modal.open} target={modal.target} onClose={() => setModal({ open: false, target: null })} onConfirm={confirmWorkflow} />
      <UnsavedChangesModal open={showUnsavedModal} saving={guardSaving}
        onSave={handleGuardSave} onDiscard={handleGuardDiscard} onCancel={() => { setShowUnsavedModal(false); setPendingAction(null); }} />
      <ApplyAllMonthsModal open={applyAllMonthsModal.open} label={applyAllMonthsModal.employeeName}
        value={applyAllMonthsModal.value} applying={applyingAllMonths}
        onYes={applySalaryToAllMonths} onNo={closeApplyAllMonthsModal} />
      <ExceptionDrawer
        open={Boolean(exceptionDrawerEmp)}
        exception={exceptionDrawerEmp?.exception}
        entityLabel={exceptionDrawerEmp ? `${exceptionDrawerEmp.employee_name} — ${exceptionDrawerEmp.role}` : ""}
        systemValue={exceptionDrawerEmp?.ai_salary}
        userValue={exceptionDrawerEmp?.adjusted_salary}
        guidelineLabel="Payroll Growth Limit"
        guidelineValue={exceptionDrawerEmp ? `${exceptionDrawerEmp.guideline_pct}%` : ""}
        reasonOptions={WORKFORCE_EXCEPTION_REASONS}
        onClose={() => setExceptionDrawerEmp(null)}
        onChanged={async () => { await Promise.all([fetchEmployees(), exceptions.refetch()]); }}
      />
      <ImportModal open={employeeTemplateUploadOpen} onClose={() => setEmployeeTemplateUploadOpen(false)}
        title={employeesView === "drivers" ? "Upload Driver Adjustments" : "Upload Summary Adjustments"}
        description={employeesView === "drivers"
          ? "Upload your filled Drivers template. Headcount / Adjusted Salary / Override Reason / Override Note are updated for matching Employee + Period rows — leave a cell blank to keep its current value."
          : "Upload your filled Summary template. Adjusted Salary / Override Reason / Override Note are updated for matching Employee + Period rows; Headcount is untouched (edit it from the Drivers tab) — leave a cell blank to keep its current value."}
        uploading={employeeTemplateUploading} error={employeeTemplateUploadError} onUpload={handleEmployeeTemplateUpload} />
      <ImportModal open={positionTemplateUploadOpen} onClose={() => setPositionTemplateUploadOpen(false)}
        title="Upload New Positions"
        description="Upload your filled New Positions template. Quantity / Adjusted Salary / Override Reason / Override Note are updated for matching Position ID rows."
        uploading={positionTemplateUploading} error={positionTemplateUploadError} onUpload={handlePositionTemplateUpload} />
      <OverrideReasonModal
        open={reasonModal.open}
        context={reasonModal.employee ? (reasonModal.period ? `${reasonModal.employee.employee_name} — ${reasonModal.period}` : `${reasonModal.employee.employee_name} — ${reasonModal.employee.role}`) : ""}
        current={reasonModal.period
          ? reasonModal.employee?.months.find((m) => m.period === reasonModal.period)?.override
          : reasonModal.employee?.reason}
        readOnly={!editable}
        stage={stage}
        saving={savingReason}
        onClose={() => setReasonModal({ open: false, employee: null, period: null })}
        onSave={async ({ reason, note }) => {
          const emp = reasonModal.employee;
          const period = reasonModal.period;
          setSavingReason(true);
          try {
            if (period) {
              // Per-month reason — scoped to a single employee+period row so
              // sibling months (and their own reasons) are left untouched.
              // salary_adjusted is re-sent at its current value (not
              // blanked) since the backend's upsert overwrites that column
              // unconditionally on conflict, unlike override_reason/_note.
              const m = emp.months.find((mm) => mm.period === period);
              if (!m) return;
              const item = {
                employee_id: emp.employee_id, period,
                salary_adjusted: m.adjusted_salary === "" ? null : m.adjusted_salary,
                override_reason: reason, override_note: note,
              };
              const res = await fetch(`${API_BASE}/${budgetYear}/existing-employees`, {
                method: "PATCH", headers: authHeaders(true), body: JSON.stringify({ items: [item] }),
              });
              if (!res.ok) throw new Error(await parseErr(res));
              dirtyEmployeesRef.current.delete(`${emp.employee_id}::${period}`);
              setEmployees((prev) => prev.map((e) => (e.employee_id !== emp.employee_id ? e : {
                ...e,
                months: e.months.map((mm) => (mm.period === period ? { ...mm, override: { reason, note } } : mm)),
              })));
              add(`Reason saved for ${period}.`, "success");
            } else {
              // Yearly bulk-set — unchanged: stamps the same reason across
              // every month's row as a quick shortcut; per-month edits made
              // afterward via the button above still override it individually.
              const items = emp.months.map((m) => ({
                employee_id: emp.employee_id, period: m.period,
                salary_adjusted: m.adjusted_salary === "" ? null : m.adjusted_salary,
                override_reason: reason, override_note: note,
              }));
              const res = await fetch(`${API_BASE}/${budgetYear}/existing-employees`, {
                method: "PATCH", headers: authHeaders(true), body: JSON.stringify({ items }),
              });
              if (!res.ok) throw new Error(await parseErr(res));
              emp.months.forEach((m) => dirtyEmployeesRef.current.delete(`${emp.employee_id}::${m.period}`));
              setEmployees((prev) => prev.map((e) => (e.employee_id === emp.employee_id ? {
                ...e,
                reason: { reason, note },
                months: e.months.map((mm) => ({ ...mm, override: { reason, note } })),
              } : e)));
              add("Override reason saved.", "success");
            }
            setReasonModal({ open: false, employee: null, period: null });
          } catch (e) {
            add(`Failed to save override reason: ${e.message}`, "error");
          } finally {
            setSavingReason(false);
          }
        }}
      />
      {compareModal.open && (
        <WorkforceCompareModal loading={compareModal.loading} data={compareModal.data} budgetYear={budgetYear}
          onClose={() => setCompareModal({ open: false, loading: false, data: null })} />
      )}
      {showNewPosition && (
        <NewPositionModal
          onClose={() => setShowNewPosition(false)}
          onCreate={async (form) => {
            try {
              const res = await fetch(`${API_BASE}/${budgetYear}/new-positions`, { method: "POST", headers: authHeaders(true), body: JSON.stringify(form) });
              if (!res.ok) throw new Error(await parseErr(res));
              setShowNewPosition(false);
              add("New position created.", "success");
              await fetchPositions();
            } catch (e) { add(`Failed to create position: ${e.message}`, "error"); }
          }}
        />
      )}

      <header className="forecasting-page-header bg-gradient-to-r from-sky-950 via-sky-900 to-sky-700 rounded-xl px-4 py-2.5 md:px-6 sticky -top-5 z-40 shadow-sm">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-white">Workforce Planning</h1>
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

      <main className="max-w-screen-2xl mx-auto px-4 md:px-6 space-y-2">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">Budget Year</span>
            <span className="px-2.5 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-x font-semibold text-slate-700" title="Set in Settings & Customization → FY Management.">
              FY{budgetYear}
            </span>
          </div>
        </div>

        <KpiRow cards={kpis} />
        <WorkflowProgress stage={stage} onAction={handleWorkflowAction} />

        {/* Budget Methodology (PRD §6) — same convention as Revenue Budgeting. */}
        {methodology === "Top-Down" ? (
          <>
            <TopDownTargetCard title="Workforce" baseline={workforceForecastExitTotal} baselineLabel="Forecast Exit"
              growthPct={guidelines.payrollGrowthLimit} growthLabel="Payroll Growth Limit" icon={<FiUsers className="text-sky-600" size={16} />} />
            <TopDownAllocationTable dimensionLabel="Department" target={computeTopDownTarget(workforceForecastExitTotal, guidelines.payrollGrowthLimit)}
              rows={departmentAllocationRows} adjustedByKey={workforceAllocAdj}
              onAdjust={(key, value) => setWorkforceAllocAdj((prev) => ({ ...prev, [key]: value === "" ? "" : Number(value) }))} />
          </>
        ) : (
        <>
        {methodology === "Hybrid" && (
          <ReconciliationBanner target={computeTopDownTarget(workforceForecastExitTotal, guidelines.payrollGrowthLimit)} actual={totals.userTotal} label="Bottom-Up Total (Budgeted Payroll)" />
        )}

        <div className="flex items-center justify-between border-b-2 border-sky-100 gap-2 flex-wrap">
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
            <div className="flex items-center gap-2 pb-1.5">
              <button onClick={() => toolbarAction("Download Employee Template")} disabled={downloadingEmployeeTemplate}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-sky-700 text-x font-semibold transition-all disabled:opacity-60">
                {downloadingEmployeeTemplate ? <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" /> : <FiDownload size={12} />}
                Download Template
              </button>
              {stage === "draft" && (
                <button onClick={() => toolbarAction("Upload Employee Excel")}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-x font-semibold transition-all shadow-sm">
                  <FiUpload size={12} /> Upload Excel
                </button>
              )}
            </div>
          )}
          {activeTab === "new" && (
            <div className="flex items-center gap-2 pb-1.5">
              <button onClick={() => toolbarAction("Download Position Template")} disabled={downloadingPositionTemplate}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-sky-700 text-x font-semibold transition-all disabled:opacity-60">
                {downloadingPositionTemplate ? <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" /> : <FiDownload size={12} />}
                Download Template
              </button>
              {stage === "draft" && (
                <button onClick={() => toolbarAction("Upload Position Excel")}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-x font-semibold transition-all shadow-sm">
                  <FiUpload size={12} /> Upload Excel
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Existing Employees ── */}
        {activeTab === "existing" && (
          <div className="space-y-2">
            <ExceptionSummaryStrip totalEvaluated={employees.length} summary={exceptions.summary}
              activeFilter={fStatus} onFilterChange={setFStatus} />
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-end gap-0.5 mr-1">
                <button onClick={() => setEmployeesView("summary")}
                  className={`flex items-center gap-1.5 px-3 py-1 text-s font-semibold whitespace-nowrap transition-all
                    ${employeesView === "summary"
                      ? "bg-white text-sky-600 rounded-t-xl -mb-0.5 border-l border-t border-r border-slate-200 border-b-2 border-b-white shadow-sm"
                      : "text-slate-500 hover:text-sky-700 hover:bg-white/60 rounded-t-xl"}`}>
                  <FiList size={13} /> Summary
                </button>
                <button onClick={() => setEmployeesView("drivers")}
                  className={`flex items-center gap-1.5 px-3 py-1 text-s font-semibold whitespace-nowrap transition-all
                    ${employeesView === "drivers"
                      ? "bg-white text-sky-600 rounded-t-xl -mb-0.5 border-l border-t border-r border-slate-200 border-b-2 border-b-white shadow-sm"
                      : "text-slate-500 hover:text-sky-700 hover:bg-white/60 rounded-t-xl"}`}>
                  <FiLayers size={13} /> Drivers
                </button>
              </div>
              <div className="relative flex-1 min-w-[220px]">
                <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-400" />
                <input type="text" value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="Search employee…"
                  className="w-full pl-8 pr-3 py-1 rounded-lg border border-sky-200 text-x outline-none focus:ring-2 focus:ring-sky-200" />
              </div>
              <select value={departmentId} onChange={(e) => guardedAction(() => setDepartmentId(e.target.value))}
                className="px-3 py-1 rounded-lg border border-sky-200 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200"
                title="Filters to employees in this department.">
                <option value="">All Departments</option>
                {(meta.departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select value={fConfidence} onChange={(e) => setFConfidence(e.target.value)}
                className="px-3 py-1 rounded-lg border border-sky-200 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200">
                {["All", "High", "Medium", "Low"].map((c) => <option key={c} value={c}>{c === "All" ? "All Confidence" : c}</option>)}
              </select>
              <label className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-x font-semibold cursor-pointer transition-colors ${fStatus === "exception" ? "border-red-300 bg-red-50 text-red-700" : "border-sky-200 text-slate-600 hover:bg-sky-50"}`}>
                <input type="checkbox" checked={fStatus === "exception"} onChange={(e) => setFStatus(e.target.checked ? "exception" : "all")} className="accent-red-600" />
                Show only exceptions
              </label>
              {fStatus !== "all" && fStatus !== "exception" && (
                <button onClick={() => setFStatus("all")}
                  className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-800 px-1.5 py-1 rounded-md hover:bg-sky-50 border border-sky-200 transition-colors">
                  <FiX size={10} /> Clear status filter
                </button>
              )}
              {!editable && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                  <FiAlertTriangle size={11} /> Editing disabled — {stage === "draft" ? "wrong department" : STAGE_LABELS[stage] || stage}
                </div>
              )}
              <span className="text-xs text-sky-500 bg-white px-2 py-1 rounded-md tabular-nums border border-sky-200">
                {filteredEmployees.length}/{employees.length}
              </span>
            </div>

            {filteredEmployees.length === 0 ? <EmptyState label="No employees match the current filters." /> : employeesView === "summary" ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
                <div className="analytics-table-scroll relative overflow-x-auto max-h-[72vh] overflow-y-auto">
                <table className="relative w-full border-collapse text-sm" style={{ minWidth: `${170 + 210 + 95 + 95 + 80 + periods.length * 192 + 160 + 90 + 90 + 100 + 90 + 95 + 130 + 220}px` }}>
                  <thead className="sticky top-0 z-20">
                    <tr className="bg-sky-800 border-b border-sky-700">
                      <th rowSpan={2} className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700 sticky left-0 bg-sky-800 z-30 min-w-[170px]">Employee</th>
                      <th rowSpan={2} className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide min-w-[100px] border-r border-sky-700/50">Department</th>
                      <th rowSpan={2} className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide min-w-[110px] border-r border-sky-700/50">Role</th>
                      <th rowSpan={2} className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide min-w-[95px] border-r border-sky-700/50">
                        Prior Salary<br /><span className="text-xs font-normal normal-case text-sky-200">FY{priorFiscalYear}</span>
                      </th>
                      <th rowSpan={2} className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide min-w-[95px] border-r border-sky-700/50">
                        Current Salary<br /><span className="text-xs font-normal normal-case text-sky-200">FY{currentFiscalYear}</span>
                      </th>
                      <th rowSpan={2} className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700 min-w-[80px]">Merit %</th>
                      <th colSpan={2} className="px-3 py-1.5 text-center text-xs font-semibold text-slate-50 border-l border-r border-sky-700 bg-sky-900 min-w-[160px]" title="Salary only — see Total Cost (right) for the fully-burdened figure shown in the KPI cards above">Total Salary</th>
                      {periods.map((p) => <th key={p} colSpan={3} className="px-3 py-1.5 text-center text-xs font-semibold border-l border-r text-white border-sky-700 bg-sky-800 min-w-[192px]">{p}</th>)}
                      <th rowSpan={2} className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide border-l border-sky-700 min-w-[90px]">Benefits</th>
                      <th rowSpan={2} className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide min-w-[90px] border-l border-sky-700/50">Taxes</th>
                      <th rowSpan={2} className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide min-w-[100px] border-l border-sky-700/50" title="Fully burdened (salary + bonus + benefits + taxes) — matches the KPI cards above">Total Cost</th>
                      <th rowSpan={2} className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide min-w-[90px] border-l border-sky-700/50">Variance</th>
                      <th rowSpan={2} className="px-3 py-1.5 text-center text-xs font-semibold text-white uppercase tracking-wide min-w-[95px] border-l border-sky-700/50">Status</th>
                      <th rowSpan={2} className="px-3 py-1.5 text-center text-xs font-semibold text-slate-50 border-l border-sky-700 bg-sky-800 min-w-[130px]">Reason</th>
                      <th rowSpan={2} className="px-3 py-1.5 text-center text-xs font-semibold text-white uppercase tracking-wide border-l border-sky-700 min-w-[220px]">Insight</th>
                    </tr>
                    <tr className="bg-sky-700 border-b border-slate-600 sticky top-[28px] z-10">
                      <th className="px-2 py-1 text-right text-xs font-medium text-white uppercase border-l border-r border-l-slate-600 border-r-slate-600/60 min-w-[75px]">AI</th>
                      <th className="px-2 py-1 text-right text-xs font-semibold text-white uppercase min-w-[85px]">Adjusted</th>
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
                    {pagedEmployees.map((e, rowIdx) => (
                      <ExistingEmployeeRow key={e.employee_id} e={e} rowIdx={rowIdx} editable={editable} onSalary={updateSalary}
                        onSalaryFocus={handleSalaryFocus} onSalaryBlur={handleSalaryBlur}
                        onOpenReason={openReasonModal} onOpenException={setExceptionDrawerEmp} />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-sky-900 text-white sticky bottom-0 z-10 font-semibold">
                      <td className="px-3 py-1.5 text-xs sticky left-0 bg-sky-900 border-r border-sky-700 z-[9]">GRAND TOTAL</td>
                      <td className="border-r border-sky-700/50"></td>
                      <td className="border-r border-sky-700/50"></td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-xs border-r border-sky-700/50">{fmt(filteredEmployees.reduce((s, e) => s + e.prior_salary, 0))}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-xs border-r border-sky-700/50">{fmt(filteredEmployees.reduce((s, e) => s + e.current_salary, 0))}</td>
                      <td className="border-r border-sky-700"></td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-xs text-white border-l border-sky-700">{fmt(totals.aiSalarySum)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-xs font-bold border-r border-sky-700">{fmt(totals.userSalarySum)}</td>
                      {employeeSummaryTotals.perPeriod.map((p) => (
                        <React.Fragment key={p.period}>
                          <td className="px-2 py-1.5 text-right tabular-nums text-xs text-white border-l border-r border-sky-700/50 bg-sky-800">{fmt(p.ai)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-xs font-bold border-r border-sky-700/50 bg-sky-800">{fmt(p.adj)}</td>
                          <td className="border-r border-sky-700 bg-sky-800"></td>
                        </React.Fragment>
                      ))}
                      <td className="px-3 py-1.5 text-right tabular-nums text-xs border-l border-sky-700">{fmt(totals.benefitsSum)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-xs border-r border-sky-700/50">{fmt(totals.taxesSum)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-xs font-bold border-r border-sky-700/50">{fmt(totals.userTotal)}</td>
                      <td className={`px-3 py-1.5 text-right tabular-nums text-xs font-bold border-r border-sky-700/50 ${totals.variance >= 0 ? "text-emerald-400" : "text-red-400"}`}>{totals.variance >= 0 ? "+" : ""}{fmt(totals.variance)}</td>
                      <td colSpan={3} className="border-l border-sky-700"></td>
                    </tr>
                  </tfoot>
                </table>
                </div>
                <PaginationBar page={safeEmployeePage} pageCount={employeePageCount} total={filteredEmployees.length}
                  pageSize={EMPLOYEE_PAGE_SIZE} onPrev={() => setEmployeePage((p) => Math.max(1, p - 1))}
                  onNext={() => setEmployeePage((p) => Math.min(employeePageCount, p + 1))} itemLabel="employees" />
              </div>
            ) : (
              // Drivers — horizontal layout, same convention as Opex/CAPEX's
              // Drivers views: Headcount x Budget Salary = Budget Total,
              // repeating per month, one row per employee.
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
                <div className="flex items-center gap-1.5 px-4 pt-3 pb-2 text-sky-700 text-x">
                  <FiLayers size={13} /> Editing Headcount or Budget Salary here recalculates Budget Total instantly and stays in sync with the Summary view.
                </div>
                <div className="analytics-table-scroll relative overflow-x-auto max-h-[72vh] overflow-y-auto">
                <table className="relative w-full border-collapse text-sm" style={{ minWidth: `${320 + periods.length * 250}px` }}>
                  <thead className="sticky top-0 z-20">
                    <tr className="bg-sky-800 border-b border-sky-700">
                      <th rowSpan={2} className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700 sticky left-0 bg-sky-800 z-30 min-w-[190px]">Employee</th>
                      <th colSpan={2} className="px-3 py-1.5 text-center text-xs font-semibold text-slate-50 border-l border-r border-sky-700 bg-sky-900 min-w-[150px]">Total Budget</th>
                      {periods.map((p) => <th key={p} colSpan={3} className="px-3 py-1.5 text-center text-xs font-semibold text-white uppercase border-l border-r border-sky-700 min-w-[250px]">{p}</th>)}
                    </tr>
                    <tr className="bg-sky-700 border-b border-slate-600 sticky top-[28px] z-10">
                      <th className="px-2 py-1 text-right text-xs font-medium text-white uppercase border-l border-r border-l-slate-600 border-r-slate-600/60 min-w-[75px]">AI</th>
                      <th className="px-2 py-1 text-right text-xs font-semibold text-white uppercase min-w-[75px]">Budget</th>
                      {periods.map((p) => (
                        <React.Fragment key={p}>
                          <th className="px-2 py-1 text-right text-xs font-medium text-slate-100 uppercase border-l border-r border-l-slate-600 border-r-slate-600/60 min-w-[70px]">Headcount</th>
                          <th className="px-2 py-1 text-right text-xs font-medium text-slate-100 uppercase border-r border-slate-600/60 min-w-[85px]">AI Salary</th>
                          <th className="px-2 py-1 text-right text-xs font-semibold text-white uppercase min-w-[95px] border-r border-slate-600">Budget Salary</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {pagedEmployees.map((e, rowIdx) => (
                      <ExistingEmployeeDriverRow key={e.employee_id} e={e} rowIdx={rowIdx} editable={editable} onSalary={updateSalary}
                        onSalaryFocus={handleSalaryFocus} onSalaryBlur={handleSalaryBlur}
                        onHeadcount={updateHeadcount} />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-sky-900 text-white sticky bottom-0 z-10 font-semibold">
                      <td className="px-3 py-1.5 text-xs sticky left-0 bg-sky-900 border-r border-sky-700 z-[9]">GRAND TOTAL</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-xs text-white border-l border-r border-sky-700/50">{fmt(totals.aiSalarySum)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-xs font-bold border-r border-sky-700">{fmt(totals.userSalarySum)}</td>
                      {employeeSummaryTotals.perPeriod.map((p) => (
                        <React.Fragment key={p.period}>
                          <td className="px-2 py-1.5 text-right tabular-nums text-xs text-white border-l border-r border-sky-700/50 bg-sky-800">{p.headcount}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-xs text-white border-r border-sky-700/50 bg-sky-800">{fmt(p.ai)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-xs font-bold border-r border-sky-700 bg-sky-800">{fmt(p.adj)}</td>
                        </React.Fragment>
                      ))}
                    </tr>
                  </tfoot>
                </table>
                </div>
                <PaginationBar page={safeEmployeePage} pageCount={employeePageCount} total={filteredEmployees.length}
                  pageSize={EMPLOYEE_PAGE_SIZE} onPrev={() => setEmployeePage((p) => Math.max(1, p - 1))}
                  onNext={() => setEmployeePage((p) => Math.min(employeePageCount, p + 1))} itemLabel="employees" />
              </div>
            )}
          </div>
        )}

        {/* ── New Positions ── */}
        {activeTab === "new" && (
          positionsLoading ? <TableSkeleton columns={7} rows={5} /> : (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-end gap-0.5">
                  <button onClick={() => setPositionsView("summary")}
                    className={`flex items-center gap-1.5 px-3 py-1 text-s font-semibold whitespace-nowrap transition-all
                      ${positionsView === "summary"
                        ? "bg-white text-sky-600 rounded-t-xl -mb-0.5 border-l border-t border-r border-slate-200 border-b-2 border-b-white shadow-sm"
                        : "text-slate-500 hover:text-sky-700 hover:bg-white/60 rounded-t-xl"}`}>
                    <FiList size={13} /> Summary
                  </button>
                  <button onClick={() => setPositionsView("drivers")}
                    className={`flex items-center gap-1.5 px-3 py-1 text-s font-semibold whitespace-nowrap transition-all
                      ${positionsView === "drivers"
                        ? "bg-white text-sky-600 rounded-t-xl -mb-0.5 border-l border-t border-r border-slate-200 border-b-2 border-b-white shadow-sm"
                        : "text-slate-500 hover:text-sky-700 hover:bg-white/60 rounded-t-xl"}`}>
                    <FiLayers size={13} /> Drivers
                  </button>
                </div>
                <button onClick={() => setShowNewPosition(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-x font-semibold transition-colors">
                  <FiPlus size={12} /> Add Position
                </button>
              </div>
              {positions.length === 0 ? <EmptyState label="No new positions yet — click Add Position to create one." /> : positionsView === "summary" ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
                  <div className="analytics-table-scroll relative overflow-x-auto max-h-[72vh] overflow-y-auto">
                  <table className="w-full min-w-[900px] border-collapse text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-sky-800">
                        {["Department", "Position", "Quantity", "Start Period", "Salary (AI/User)", "Total Cost (per hire)", "Total (all hires)"].map((h) => (
                          <th key={h} className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase border-r border-sky-700 last:border-r-0">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((p, idx) => {
                        const rowBg = idx % 2 === 0 ? "bg-white" : "bg-slate-50/60";
                        const salary = Number(p.adjusted_salary) || 0;
                        const benefits = round2(salary * BENEFITS_RATE);
                        const taxes = round2(salary * TAX_RATE);
                        const perHire = round2(salary + benefits + taxes);
                        return (
                          <tr key={p.id} className={`rf-row border-b border-slate-200 transition-colors hover:bg-sky-50/50 ${rowBg}`}>
                            <td className="px-3 py-1 text-xs text-slate-700 border-r border-slate-100">{p.department}</td>
                            <td className="px-3 py-1 font-semibold text-slate-900 text-xs border-r border-slate-100">{p.position}</td>
                            <td className="px-3 py-1 border-r border-slate-100">
                              <input type="number" value={p.quantity} onChange={(e) => updatePositionQuantity(p.id, e.target.value)}
                                className="w-16 px-1.5 py-0.5 rounded-md border border-slate-200 text-right tabular-nums text-xs outline-none transition-all focus:border-sky-500 focus:ring-2 ring-sky-100" />
                            </td>
                            <td className="px-3 py-1 text-xs text-slate-600 border-r border-slate-100">{p.start_period}</td>
                            <td className="px-2 py-1 border-r border-slate-100">
                              <AIAdjustedCell ai={p.ai_salary} adjusted={p.adjusted_salary} editable
                                onChange={(v) => updatePositionSalary(p.id, v)}
                                width="w-20" />
                            </td>
                            <td className="px-3 py-1 text-right tabular-nums text-xs text-slate-700 border-r border-slate-100">{fmt(perHire)}</td>
                            <td className="px-3 py-1 text-right tabular-nums text-xs font-semibold text-sky-800">{fmt(perHire * (p.quantity || 0))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-sky-900 text-white font-semibold sticky bottom-0 z-10">
                        <td colSpan={6} className="px-3 py-1.5 text-xs border-r border-sky-700">NEW POSITIONS TOTAL ({positions.reduce((s, p) => s + (p.quantity || 0), 0)} planned hires)</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-xs">{fmt(newPositionsCost)}</td>
                      </tr>
                    </tfoot>
                  </table>
                  </div>
                </div>
              ) : (
                // Drivers — same Quantity x Unit Cost = Total convention as
                // Opex/CAPEX's Drivers views, with Planned Headcount / AI
                // Salary / Budget Salary broken out into their own clearly
                // labeled (non-wrapping) columns instead of Summary's
                // combined AI/User cell, and Budget Total recalculating live
                // as either field changes. Positions have no monthly
                // dimension (each is a single planned hire at Start Period),
                // so — unlike Opex/CAPEX — this stays one row per position
                // rather than repeating columns per month.
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
                  <div className="flex items-center gap-1.5 px-4 pt-3 pb-2 text-sky-700 text-x">
                    <FiLayers size={13} /> Editing Planned Headcount or Budget Salary here recalculates Budget Total instantly and stays in sync with the Summary view.
                  </div>
                  <div className="analytics-table-scroll relative overflow-x-auto max-h-[72vh] overflow-y-auto">
                  <table className="w-full min-w-[1000px] border-collapse text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-sky-800">
                        <th className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide whitespace-nowrap border-r border-sky-700 min-w-[160px]">Position</th>
                        <th className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide whitespace-nowrap min-w-[110px] border-r border-sky-700">Start Period</th>
                        <th className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide whitespace-nowrap min-w-[130px] border-r border-sky-700">Planned Headcount</th>
                        <th className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide whitespace-nowrap min-w-[110px] border-r border-sky-700">AI Salary</th>
                        <th className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide whitespace-nowrap min-w-[120px] border-r border-sky-700">Budget Salary</th>
                        <th className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide whitespace-nowrap min-w-[110px] border-r border-sky-700">AI Total</th>
                        <th className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide whitespace-nowrap min-w-[120px]">Budget Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((p, idx) => {
                        const rowBg = idx % 2 === 0 ? "bg-white" : "bg-slate-50/60";
                        const qty = Number(p.quantity) || 0;
                        const aiSalary = Number(p.ai_salary) || 0;
                        const budgetSalary = Number(p.adjusted_salary) || 0;
                        return (
                          <tr key={p.id} className={`rf-row border-b border-slate-200 transition-colors hover:bg-sky-50/50 ${rowBg}`}>
                            <td className="px-3 py-1 border-r border-slate-100">
                              <div className="font-semibold text-slate-900 text-xs leading-tight">{p.position}</div>
                              <div className="text-xs text-slate-400">{p.department}</div>
                            </td>
                            <td className="px-3 py-1 text-xs text-slate-600 border-r border-slate-100">{p.start_period}</td>
                            <td className="px-1.5 py-1 border-r border-slate-100">
                              <input type="number" value={p.quantity} disabled={!editable}
                                onChange={(e) => updatePositionQuantity(p.id, e.target.value)}
                                className={`w-20 px-1.5 py-0.5 rounded-md border text-right tabular-nums text-xs outline-none transition-all ml-auto block
                                  ${!editable ? "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200" :
                                    "border-slate-300 bg-white hover:border-slate-400 focus:border-sky-500 focus:ring-2 ring-sky-100"}`} />
                            </td>
                            <td className="px-3 py-1 text-right tabular-nums text-xs text-slate-500 border-r border-slate-100">{fmt(aiSalary)}</td>
                            <td className="px-1.5 py-1 border-r border-slate-100">
                              <input type="number" value={p.adjusted_salary} disabled={!editable}
                                onChange={(e) => updatePositionSalary(p.id, e.target.value)}
                                className={`w-24 px-1.5 py-0.5 rounded-md border text-right tabular-nums text-xs outline-none transition-all ml-auto block
                                  ${!editable ? "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200" :
                                    budgetSalary !== aiSalary ? "border-sky-400 bg-sky-50 text-sky-900 focus:ring-2 ring-sky-100" :
                                    "border-slate-300 bg-white hover:border-slate-400 focus:border-sky-500 focus:ring-2 ring-sky-100"}`} />
                            </td>
                            <td className="px-3 py-1 text-right tabular-nums text-xs text-slate-500 border-r border-slate-100">{fmt(qty * aiSalary)}</td>
                            <td className="px-3 py-1 text-right tabular-nums text-xs font-semibold text-sky-800">{fmt(qty * budgetSalary)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-sky-900 text-white font-semibold sticky bottom-0 z-10">
                        <td colSpan={5} className="px-3 py-1.5 text-xs border-r border-sky-700">NEW POSITIONS TOTAL ({positions.reduce((s, p) => s + (p.quantity || 0), 0)} planned hires)</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-xs border-r border-sky-700/50">{fmt(positions.reduce((s, p) => s + (Number(p.quantity) || 0) * (Number(p.ai_salary) || 0), 0))}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-xs">{fmt(positions.reduce((s, p) => s + (Number(p.quantity) || 0) * (Number(p.adjusted_salary) || 0), 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {/* ── Position Changes ── */}
        {activeTab === "changes" && (
          changesLoading ? <TableSkeleton columns={5} rows={6} /> : (
            changes.length === 0 ? <EmptyState label="No salary-adjustment history found for the current + prior fiscal year." /> : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
                <div className="analytics-table-scroll relative overflow-x-auto max-h-[72vh] overflow-y-auto">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-sky-800">
                      {["Type", "Employee", "Effective", "From", "To"].map((h) => (
                        <th key={h} className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase border-r border-sky-700 last:border-r-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {changes.map((c, idx) => {
                      const rowBg = idx % 2 === 0 ? "bg-white" : "bg-slate-50/60";
                      const delta = c.to_salary - c.from_salary;
                      return (
                        <tr key={`${c.employee_name}-${c.effective}`} className={`rf-row border-b border-slate-200 transition-colors hover:bg-sky-50/50 ${rowBg}`}>
                          <td className="px-3 py-1 border-r border-slate-100"><span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">{c.type}</span></td>
                          <td className="px-3 py-1 font-semibold text-slate-900 text-xs border-r border-slate-100">{c.employee_name}</td>
                          <td className="px-3 py-1 text-xs text-slate-600 border-r border-slate-100">{c.effective}</td>
                          <td className="px-3 py-1 text-right tabular-nums text-xs text-slate-500 border-r border-slate-100">{fmt(c.from_salary)}</td>
                          <td className="px-3 py-1 text-right tabular-nums text-xs font-semibold text-slate-700">
                            {fmt(c.to_salary)} <span className={delta >= 0 ? "text-emerald-600" : "text-red-500"}>({delta >= 0 ? "+" : ""}{fmt(delta)})</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
                <p className="text-x text-slate-400 px-3 py-3">Derived from real compensation history — only Salary Adjustment events are shown; job-title/department change history isn't tracked in the source HR system.</p>
              </div>
            )
          )
        )}

        <SaveBar hasChanges={hasChanges} saving={saving} onSave={handleSave} label="Save Adjustments" />
        </>
        )}
      </main>
    </div>
  );
};

function WorkforceCompareModal({ loading, data, budgetYear, onClose }) {
  const priorFY = budgetYear - 2;
  const currentFY = budgetYear - 1;
  const headers = data ? [
    { label: "Employee" },
    { label: "Prior Salary", year: priorFY },
    { label: "Current Forecast", year: currentFY },
    { label: "AI Budget", year: budgetYear },
    { label: "User Budget", year: budgetYear },
    { label: "Variance vs. Forecast" },
  ] : [];
  return (
    <div className="fixed inset-0 z-[1000] bg-sky-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl border border-slate-200 overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200 shrink-0">
          <div>
            <h3 className="font-bold text-slate-900 text-s">Workforce Budget vs. Forecast — FY{budgetYear}</h3>
            <p className="text-x text-slate-500 mt-0.5">Fully burdened totals, per employee</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"><FiX size={13} /></button>
        </div>
        <div className="overflow-y-auto p-5">
          {loading ? (
            <TableSkeleton columns={6} rows={6} />
          ) : !data || data.employees.length === 0 ? (
            <EmptyState label="No employees to compare." />
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
                  {data.employees.map((e) => (
                    <tr key={e.employee_name} className="rf-row border-b border-slate-200 hover:bg-sky-50/50">
                      <td className="px-3 py-1 font-semibold text-slate-900 text-xs leading-tight border-r border-slate-100">{e.employee_name}</td>
                      <td className="px-3 py-1 text-right tabular-nums text-xs text-slate-500 border-r border-slate-100">{fmt(e.prior_salary)}</td>
                      <td className="px-3 py-1 text-right tabular-nums text-xs text-slate-500 border-r border-slate-100">{fmt(e.current_forecast)}</td>
                      <td className="px-3 py-1 text-right tabular-nums text-xs text-slate-500 border-r border-slate-100">{fmt(e.ai_budget)}</td>
                      <td className="px-3 py-1 text-right tabular-nums text-xs font-semibold text-sky-800 border-r border-slate-100">{fmt(e.user_budget)}</td>
                      <td className={`px-3 py-1 text-right tabular-nums text-xs font-semibold ${e.variance_vs_forecast > 0 ? "text-emerald-600" : e.variance_vs_forecast < 0 ? "text-red-500" : "text-slate-400"}`}>{e.variance_vs_forecast === 0 ? "—" : `${e.variance_vs_forecast > 0 ? "+" : ""}${fmt(e.variance_vs_forecast)}`}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-sky-900 text-white font-semibold">
                    <td className="px-3 py-1.5 text-xs border-r border-sky-700">TOTAL</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-xs border-r border-sky-700/50">{fmt(data.totals.prior_salary)}</td>
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

function NewPositionModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ department: "", position: "", quantity: 1, start_period: "" });
  return (
    <div className="fixed inset-0 z-[1000] bg-sky-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-[440px] shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200">
          <h3 className="font-bold text-slate-900 text-s">New Position</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"><FiX size={13} /></button>
        </div>
        <div className="p-5 flex flex-col gap-3">
          <div>
            <label className="block text-x font-semibold text-slate-600 mb-1.5">Department *</label>
            <input value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
              placeholder="e.g. Data Analytics"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-s text-slate-900 outline-none focus:border-sky-500 focus:ring-2 ring-sky-100" />
          </div>
          <div>
            <label className="block text-x font-semibold text-slate-600 mb-1.5">Position *</label>
            <input value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
              placeholder="e.g. ML Engineer"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-s text-slate-900 outline-none focus:border-sky-500 focus:ring-2 ring-sky-100" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-x font-semibold text-slate-600 mb-1.5">Quantity</label>
              <input type="number" min={1} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) || 1 }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-s text-slate-900 outline-none focus:border-sky-500 focus:ring-2 ring-sky-100" />
            </div>
            <div className="flex-1">
              <label className="block text-x font-semibold text-slate-600 mb-1.5">Start Period *</label>
              <input value={form.start_period} onChange={(e) => setForm((f) => ({ ...f, start_period: e.target.value }))}
                placeholder="YYYY-MM"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-s text-slate-900 outline-none focus:border-sky-500 focus:ring-2 ring-sky-100" />
            </div>
          </div>
          <p className="text-xs text-slate-400">AI-suggested salary will be set automatically to the department's real current average compensation.</p>
          <div className="flex gap-3 justify-end pt-1">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-s font-semibold">Cancel</button>
            <button onClick={() => form.department && form.position && form.start_period && onCreate(form)}
              disabled={!form.department || !form.position || !form.start_period}
              className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-s font-semibold disabled:opacity-50">Create</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkforcePlanning;
