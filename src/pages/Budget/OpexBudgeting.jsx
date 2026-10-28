// OpexBudgeting.jsx — PRD §42–51: Activity-based Operating Expense Budgeting.
// Backed by real endpoints under /api/v1/budget/opex/{year}/... — AI baselines
// come from real GL actuals (fpna_landing.finance_general_ledger_transactions,
// account_type='Expense'), adjusted by the CFO's Expense Guidelines (Travel
// Reduction, Software Consolidation, Marketing Investment). Categories with no
// dedicated chart-of-accounts mapping (Office Expenses, Training) get an
// honest $0 AI baseline instead of a fabricated number. User edits persist to
// fpna_config.budget_opex_items. Summary/Drivers view split, filters, and
// Excel template download/upload mirror RevenueBudgeting.jsx's conventions.
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  FiBriefcase, FiSave, FiMessageSquare, FiPlus, FiTrash2,
  FiList, FiLayers, FiSearch, FiX, FiDownload, FiUpload, FiAlertCircle,
} from "react-icons/fi";
import {
  KpiRow, WorkflowModal, WorkflowProgress,
  ExplainPopover, OverrideReasonModal,
  useToast, ToastContainer, EmptyState, fmt, fmtPct, parseMoney, CURRENCY_FILTER_OPTIONS, STAGE_LABELS,
  TopDownTargetCard, ReconciliationBanner, TopDownAllocationTable,
  displayPeriods, bucketMonths, proportionalSplit,
} from "./budgetHelpers";
import { ImportModal } from "../ForecastingOverview/RevenueForecastHelpers";
import { ExceptionBadge, ExceptionDrawer, ExceptionSummaryStrip, useExceptions, GENERAL_EXCEPTION_REASONS } from "./exceptionHelpers";
import { AuthContext } from "../../context/AuthContext";
import { BudgetYearContext } from "../../context/BudgetYearContext";
import { BudgetMethodologyContext } from "../../context/BudgetMethodologyContext";
import { BudgetGuidelinesContext } from "../../context/BudgetGuidelinesContext";
import { API_BASE_URL } from "../../config/config";
import TableSkeleton from "../Skeleton/TableSkeleton";

const API_BASE = `${API_BASE_URL}/api/v1/budget/opex`;

async function parseErr(res) {
  try {
    const data = await res.json();
    return data?.detail || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

// apply_smart_currency formats money fields as comma-formatted display
// strings server-side — parseMoney() converts them back to real numbers,
// same convention as WorkforcePlanning.jsx's normalizeEmployees. Skipping
// this breaks the number <input>s (a comma string renders blank) and any
// arithmetic on these fields (Number("2,384,621.00") is NaN).
const normalizeCategories = (list) => (list || []).map((c) => ({
  ...c,
  prior_year_actual: parseMoney(c.prior_year_actual),
  current_forecast: parseMoney(c.current_forecast),
  forecast_exit: parseMoney(c.forecast_exit),
  ai_total: parseMoney(c.ai_total),
  adjusted_total: parseMoney(c.adjusted_total),
  months: (c.months || []).map((m) => ({
    ...m,
    ai_total: parseMoney(m.ai_total),
    adjusted_total: parseMoney(m.adjusted_total),
  })),
  items: (c.items || []).map((i) => ({
    ...i,
    ai_unit_cost: parseMoney(i.ai_unit_cost),
    adjusted_unit_cost: parseMoney(i.adjusted_unit_cost),
  })),
}));

const OpexBudgeting = () => {
  const { token } = useContext(AuthContext);
  const { toasts, add } = useToast();
  const { budgetYear, fiscalYearStartMonth } = useContext(BudgetYearContext);
  const opexExceptions = useExceptions(budgetYear, "opex");
  const [exceptionDrawerCat, setExceptionDrawerCat] = useState(null);
  const { methodology } = useContext(BudgetMethodologyContext);
  const { frequency } = useContext(BudgetGuidelinesContext);

  const [opexAllocAdj, setOpexAllocAdj] = useState({});
  const [stage, setStage] = useState("draft");
  const [editable, setEditable] = useState(true);
  const [modal, setModal] = useState({ open: false, target: null });
  // `period: null` = the category-wide bulk-set button (applies to all 12
  // months at once); `period` set = the per-month reason button, scoped to
  // that one item — same yearly-bulk vs per-month duality WorkforcePlanning.jsx
  // already uses elsewhere in this app.
  const [reasonModal, setReasonModal] = useState({ open: false, category: null, period: null });
  const [addDriverFor, setAddDriverFor] = useState(null); // category key with the "add driver" row open

  // Summary ⇄ Drivers view — same split as RevenueBudgeting.jsx's existingView.
  const [opexView, setOpexView] = useState("summary");

  const [currencyFilter, setCurrencyFilter] = useState("actualvalue");
  const [departmentId, setDepartmentId] = useState("");
  const [filterText, setFilterText] = useState("");
  const [fConfidence, setFConfidence] = useState("All");
  // Which ExceptionSummaryStrip tile is active — same convention as
  // RevenueBudgeting.jsx's fStatus.
  const [fStatus, setFStatus] = useState("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [meta, setMeta] = useState({ departments: [] });
  const [notes, setNotes] = useState([]);
  const [currentFiscalYear, setCurrentFiscalYear] = useState(null);
  const [priorFiscalYear, setPriorFiscalYear] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [dirtyItems, setDirtyItems] = useState({}); // itemId -> { adjusted_unit_cost?, override_reason?, override_note? }
  const [saving, setSaving] = useState(false);
  const hasChanges = Object.keys(dirtyItems).length > 0;

  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [templateUploadOpen, setTemplateUploadOpen] = useState(false);
  const [templateUploading, setTemplateUploading] = useState(false);
  const [templateUploadError, setTemplateUploadError] = useState(null);

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
  const categoriesFetchSeqRef = useRef(0);
  const categoriesAbortCtrlRef = useRef(null);
  const workflowFetchSeqRef = useRef(0);
  const workflowAbortCtrlRef = useRef(null);

  const fetchCategories = useCallback(async () => {
    if (categoriesAbortCtrlRef.current) categoriesAbortCtrlRef.current.abort();
    const controller = new AbortController();
    categoriesAbortCtrlRef.current = controller;
    const seq = ++categoriesFetchSeqRef.current;

    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ currency_filter: currencyFilter });
      if (departmentId) q.set("department_id", departmentId);
      const res = await fetch(`${API_BASE}/${budgetYear}?${q}`, { headers: authHeaders(), signal: controller.signal });
      if (!res.ok) throw new Error(await parseErr(res));
      const data = await res.json();
      if (seq !== categoriesFetchSeqRef.current) return; // a newer fetch has since started

      setCategories(normalizeCategories(data.categories));
      setEditable(data.editable !== false);
      setCurrentFiscalYear(data.current_fiscal_year ?? null);
      setPriorFiscalYear(data.prior_fiscal_year ?? null);
      setPeriods(data.periods || []);
      setMeta(data.meta || { departments: [] });
      setNotes(data.notes || []);
      setDirtyItems({});
    } catch (e) {
      if (e?.name === "AbortError") return;
      if (seq !== categoriesFetchSeqRef.current) return;
      setError(e.message || "Failed to load Operating Expense Budgeting.");
    } finally {
      if (seq === categoriesFetchSeqRef.current) setLoading(false);
    }
  }, [budgetYear, currencyFilter, departmentId, authHeaders]);

  const fetchWorkflow = useCallback(async () => {
    if (workflowAbortCtrlRef.current) workflowAbortCtrlRef.current.abort();
    const controller = new AbortController();
    workflowAbortCtrlRef.current = controller;
    const seq = ++workflowFetchSeqRef.current;
    try {
      const res = await fetch(`${API_BASE}/${budgetYear}/workflow`, { headers: authHeaders(), signal: controller.signal });
      if (!res.ok) throw new Error(await parseErr(res));
      const data = await res.json();
      if (seq !== workflowFetchSeqRef.current) return;
      setStage(data.stage || "draft");
    } catch (e) {
      if (e?.name === "AbortError") return;
      if (seq !== workflowFetchSeqRef.current) return;
      add(`Failed to load workflow stage: ${e.message}`, "error");
    }
  }, [budgetYear, authHeaders, add]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { fetchWorkflow(); }, [fetchWorkflow]);

  const catAiTotal = (c) => c.ai_total ?? c.items.reduce((s, i) => s + i.quantity * i.ai_unit_cost, 0);
  const catUserTotal = (c) => c.items.reduce((s, i) => s + i.quantity * (Number(i.adjusted_unit_cost) || 0), 0);

  // Department name for the selected department_id — categories aren't
  // naturally owned by one department (a category like Travel can have spend
  // posted across many), so the backend derives each category's *primary*
  // department (whichever department contributed most of its prior-year
  // spend) the same way Revenue derives a customer's primary department.
  const selectedDepartmentName = useMemo(
    () => meta.departments.find((d) => d.id === departmentId)?.name,
    [meta.departments, departmentId]
  );

  const filteredCategories = useMemo(() => categories.filter((c) => {
    if (filterText && !c.name.toLowerCase().includes(filterText.toLowerCase())) return false;
    if (departmentId && c.department !== selectedDepartmentName) return false;
    if (fConfidence !== "All" && c.confidence !== fConfidence) return false;
    if (fStatus === "within" && c.exception) return false;
    if (fStatus === "exception" && !c.exception) return false;
    if (fStatus === "pending" && c.exception?.approval_status !== "pending") return false;
    if (fStatus === "approved" && c.exception?.approval_status !== "approved") return false;
    if (fStatus === "rejected" && c.exception?.approval_status !== "rejected") return false;
    return true;
  }), [categories, filterText, departmentId, selectedDepartmentName, fConfidence, fStatus]);

  const totals = useMemo(() => {
    const ai = categories.reduce((s, c) => s + catAiTotal(c), 0);
    const user = categories.reduce((s, c) => s + catUserTotal(c), 0);
    const priorYearActual = categories.reduce((s, c) => s + (c.prior_year_actual || 0), 0);
    const currentForecast = categories.reduce((s, c) => s + (c.current_forecast || 0), 0);
    const forecastExit = categories.reduce((s, c) => s + (c.forecast_exit || 0), 0);
    return { ai, user, variance: user - ai, variancePct: ai ? ((user - ai) / ai) * 100 : 0, priorYearActual, currentForecast, forecastExit };
  }, [categories]);

  // Planning Frequency (Budget Setup & Guidelines) — Opex/CAPEX's GET never
  // changes shape (always the real 12 monthly periods/items), so unlike
  // Revenue/Workforce there's no backend round trip on a frequency change:
  // Quarterly/Annual are purely a client-side re-aggregation of the same
  // data already on the page. `periods` stays the raw 'YYYY-MM' months
  // (still needed for item/driver matching); `summaryPeriods` is the column
  // set actually rendered in the Summary table.
  const summaryPeriods = useMemo(
    () => displayPeriods(frequency, fiscalYearStartMonth, budgetYear, periods),
    [frequency, fiscalYearStartMonth, budgetYear, periods]
  );
  const monthsForColumn = useCallback(
    (label) => bucketMonths(frequency, fiscalYearStartMonth, budgetYear, label),
    [frequency, fiscalYearStartMonth, budgetYear]
  );
  const bucketAgg = useCallback((c, label) => {
    const months = monthsForColumn(label);
    return months.reduce((acc, p) => {
      const m = c.months.find((mm) => mm.period === p);
      return { ai_total: acc.ai_total + (m?.ai_total || 0), adjusted_total: acc.adjusted_total + (m?.adjusted_total || 0) };
    }, { ai_total: 0, adjusted_total: 0 });
  }, [monthsForColumn]);

  const periodTotals = useMemo(() => summaryPeriods.map((label) => {
    const ai = filteredCategories.reduce((s, c) => s + bucketAgg(c, label).ai_total, 0);
    const user = filteredCategories.reduce((s, c) => s + bucketAgg(c, label).adjusted_total, 0);
    return { period: label, ai, user };
  }), [summaryPeriods, filteredCategories, bucketAgg]);

  // Top-Down target (PRD §6/§7) — baseline is Forecast Exit, same convention
  // RevenueBudgeting.jsx's own TopDownTargetCard uses (baseline={totals.forecastExit}).
  // Guideline growth for marketing/travel/software is already baked into
  // each category's `ai_total` server-side — using forecast_exit -> ai_total
  // as baseline -> target (rather than re-applying growthPct on top of
  // ai_total) avoids double-counting that same guideline effect again here.
  const opexCategoryAllocationRows = useMemo(() => categories.map((c) => {
    const baseline = c.forecast_exit ?? catAiTotal(c);
    const target = catAiTotal(c);
    const growthPct = baseline ? ((target - baseline) / baseline) * 100 : 0;
    return { key: c.key, name: c.name, priorShare: baseline, growthPct };
  }), [categories]);

  const opexBaseline = useMemo(
    () => opexCategoryAllocationRows.reduce((s, r) => s + r.priorShare, 0),
    [opexCategoryAllocationRows]
  );
  const opexTarget = useMemo(() => categories.reduce((s, c) => s + catAiTotal(c), 0), [categories]);
  const opexBlendedGrowthPct = opexBaseline ? ((opexTarget - opexBaseline) / opexBaseline) * 100 : 0;

  const updateItemCost = (catKey, itemId, value) => {
    const cost = value === "" ? "" : Number(value);
    setCategories((prev) => prev.map((c) => {
      if (c.key !== catKey) return c;
      const items = c.items.map((i) => (i.id === itemId ? { ...i, adjusted_unit_cost: cost } : i));
      const months = c.months.map((m) => {
        const pItems = items.filter((i) => i.period === m.period);
        return { ...m, adjusted_total: pItems.reduce((s, i) => s + i.quantity * (Number(i.adjusted_unit_cost) || 0), 0) };
      });
      return { ...c, items, months, adjusted_total: items.reduce((s, i) => s + i.quantity * (Number(i.adjusted_unit_cost) || 0), 0) };
    }));
    setDirtyItems((prev) => ({ ...prev, [itemId]: { ...prev[itemId], adjusted_unit_cost: cost === "" ? null : cost } }));
  };

  // Quantity edit — Drivers view only. Budget Total = Quantity x Budget Unit
  // Cost recalculates live via the same items/months rebuild updateItemCost
  // uses, just keyed off quantity instead of unit cost.
  const updateItemQuantity = (catKey, itemId, value) => {
    const qty = value === "" ? "" : Number(value);
    setCategories((prev) => prev.map((c) => {
      if (c.key !== catKey) return c;
      const items = c.items.map((i) => (i.id === itemId ? { ...i, quantity: qty } : i));
      const months = c.months.map((m) => {
        const pItems = items.filter((i) => i.period === m.period);
        return { ...m, adjusted_total: pItems.reduce((s, i) => s + i.quantity * (Number(i.adjusted_unit_cost) || 0), 0) };
      });
      return { ...c, items, months, adjusted_total: items.reduce((s, i) => s + i.quantity * (Number(i.adjusted_unit_cost) || 0), 0) };
    }));
    setDirtyItems((prev) => ({ ...prev, [itemId]: { ...prev[itemId], quantity: qty === "" ? null : qty } }));
  };

  // Summary <-> Drivers bidirectional sync — same field-mapping convention
  // RevenueBudgeting.jsx uses for its Revenue (total) <-> Volume/Rate
  // (components) sync. A category-period's Summary cell always edits the
  // Budget Total; when that period has more than one driver line (a
  // "group"), the new total is distributed back across those lines by
  // scaling each one's existing Budget Unit Cost by the same ratio — so
  // each driver's relative share of the group is preserved, quantities are
  // left untouched, and the group's new sum lands exactly on what was
  // typed. If every line in the group is currently $0, the new total is
  // split evenly across lines instead (no existing ratio to preserve).
  const updateCategoryPeriodTotal = (catKey, period, value) => {
    const newTotal = value === "" ? 0 : Number(value) || 0;
    const cat = categories.find((c) => c.key === catKey);
    if (!cat) return;
    const pItems = cat.items.filter((i) => i.period === period);
    if (pItems.length === 0) return;
    const oldTotal = pItems.reduce((s, i) => s + i.quantity * (Number(i.adjusted_unit_cost) || 0), 0);
    const newCostById = new Map();
    if (oldTotal > 0) {
      const ratio = newTotal / oldTotal;
      pItems.forEach((i) => newCostById.set(i.id, (Number(i.adjusted_unit_cost) || 0) * ratio));
    } else {
      const share = newTotal / pItems.length;
      pItems.forEach((i) => newCostById.set(i.id, i.quantity ? share / i.quantity : 0));
    }
    setCategories((prev) => prev.map((c) => {
      if (c.key !== catKey) return c;
      const items = c.items.map((i) => (newCostById.has(i.id) ? { ...i, adjusted_unit_cost: newCostById.get(i.id) } : i));
      const months = c.months.map((m) => {
        const mItems = items.filter((i) => i.period === m.period);
        return { ...m, adjusted_total: mItems.reduce((s, i) => s + i.quantity * (Number(i.adjusted_unit_cost) || 0), 0) };
      });
      return { ...c, items, months, adjusted_total: items.reduce((s, i) => s + i.quantity * (Number(i.adjusted_unit_cost) || 0), 0) };
    }));
    setDirtyItems((prev) => {
      const next = { ...prev };
      newCostById.forEach((cost, id) => { next[id] = { ...next[id], adjusted_unit_cost: cost }; });
      return next;
    });
  };

  // Quarterly/Annual Summary editing — two-level redistribution of one typed
  // bucket total (Planning Frequency feature). Level 1: split the bucket
  // total across its underlying months, proportional to each month's AI
  // total (proportionalSplit — preserves seasonality instead of flattening
  // it). Level 2: reuse the exact same per-month multi-driver redistribution
  // updateCategoryPeriodTotal already does above, once per month. PATCH
  // payload shape stays {id, adjusted_unit_cost} either way — the backend
  // needs no changes for Opex/CAPEX since it always returns full monthly
  // data; frequency only changes how this page groups/edits it.
  const updateCategoryBucketTotal = (catKey, label, value) => {
    const newTotal = value === "" ? 0 : Number(value) || 0;
    const cat = categories.find((c) => c.key === catKey);
    if (!cat) return;
    const monthsInBucket = monthsForColumn(label);
    const monthAiTotals = monthsInBucket.map((p) => cat.months.find((m) => m.period === p)?.ai_total || 0);
    const monthTargets = proportionalSplit(newTotal, monthAiTotals);
    const newCostById = new Map();
    monthsInBucket.forEach((p, i) => {
      const pItems = cat.items.filter((it) => it.period === p);
      if (pItems.length === 0) return;
      const oldTotal = pItems.reduce((s, it) => s + it.quantity * (Number(it.adjusted_unit_cost) || 0), 0);
      const target = monthTargets[i];
      if (oldTotal > 0) {
        const ratio = target / oldTotal;
        pItems.forEach((it) => newCostById.set(it.id, (Number(it.adjusted_unit_cost) || 0) * ratio));
      } else {
        const share = target / pItems.length;
        pItems.forEach((it) => newCostById.set(it.id, it.quantity ? share / it.quantity : 0));
      }
    });
    setCategories((prev) => prev.map((c) => {
      if (c.key !== catKey) return c;
      const items = c.items.map((it) => (newCostById.has(it.id) ? { ...it, adjusted_unit_cost: newCostById.get(it.id) } : it));
      const months = c.months.map((m) => {
        const mItems = items.filter((it) => it.period === m.period);
        return { ...m, adjusted_total: mItems.reduce((s, it) => s + it.quantity * (Number(it.adjusted_unit_cost) || 0), 0) };
      });
      return { ...c, items, months, adjusted_total: items.reduce((s, it) => s + it.quantity * (Number(it.adjusted_unit_cost) || 0), 0) };
    }));
    setDirtyItems((prev) => {
      const next = { ...prev };
      newCostById.forEach((cost, id) => { next[id] = { ...next[id], adjusted_unit_cost: cost }; });
      return next;
    });
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      const items = Object.entries(dirtyItems).map(([id, patch]) => ({ id: Number(id), ...patch }));
      const res = await fetch(`${API_BASE}/${budgetYear}/items`, {
        method: "PATCH", headers: authHeaders(true), body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error(await parseErr(res));
      add("Operating Expense Budgeting saved.", "success");
      await fetchCategories();
    } catch (e) {
      add(e.message || "Failed to save Operating Expense Budgeting.", "error");
    } finally {
      setSaving(false);
    }
  };

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
      add(e.message || "Failed to update workflow stage.", "error");
    } finally {
      setModal({ open: false, target: null });
    }
  };

  const [driverForm, setDriverForm] = useState({ driver: "", quantity: 1, unitCost: 0, period: "" });
  const submitAddDriver = async (catKey) => {
    try {
      const res = await fetch(`${API_BASE}/${budgetYear}/items`, {
        method: "POST", headers: authHeaders(true),
        body: JSON.stringify({
          category_key: catKey, period: driverForm.period || periods[0], driver: driverForm.driver,
          quantity: Number(driverForm.quantity) || 1, unit_cost: Number(driverForm.unitCost) || 0,
        }),
      });
      if (!res.ok) throw new Error(await parseErr(res));
      add("Driver line added.", "success");
      setAddDriverFor(null);
      setDriverForm({ driver: "", quantity: 1, unitCost: 0, period: "" });
      await fetchCategories();
    } catch (e) {
      add(e.message || "Failed to add driver line.", "error");
    }
  };

  const removeDriver = async (itemId) => {
    try {
      const res = await fetch(`${API_BASE}/${budgetYear}/items/${itemId}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error(await parseErr(res));
      add("Driver line removed.", "success");
      await fetchCategories();
    } catch (e) {
      add(e.message || "Failed to remove driver line.", "error");
    }
  };

  const saveOverrideReason = async ({ reason, note }) => {
    const cat = reasonModal.category;
    if (!cat) { setReasonModal({ open: false, category: null, period: null }); return; }
    // Per-column: every item whose real month falls inside that column —
    // reasonModal.period is either a literal 'YYYY-MM' month (Monthly) or a
    // Quarterly/Annual bucket label, and monthsForColumn resolves either the
    // same way. Bulk (no period given): every item in the category, same
    // yearly-bulk-set convention as elsewhere.
    const targetPeriods = reasonModal.period ? monthsForColumn(reasonModal.period) : null;
    const targetItems = targetPeriods
      ? cat.items.filter((i) => targetPeriods.includes(i.period))
      : cat.items;
    if (targetItems.length === 0) { setReasonModal({ open: false, category: null, period: null }); return; }
    try {
      const items = targetItems.map((i) => ({ id: i.id, override_reason: reason, override_note: note }));
      const res = await fetch(`${API_BASE}/${budgetYear}/items`, {
        method: "PATCH", headers: authHeaders(true), body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error(await parseErr(res));
      add("Override reason saved.", "success");
      await fetchCategories();
    } catch (e) {
      add(e.message || "Failed to save override reason.", "error");
    } finally {
      setReasonModal({ open: false, category: null, period: null });
    }
  };

  // Summary and Drivers each get their own template/upload endpoint — same
  // convention RevenueBudgeting.jsx uses (revenue-adjustments vs
  // driver-adjustments) — so whichever tab is active when the button is
  // clicked determines which shape gets downloaded/uploaded.
  const templateEndpointSegment = opexView === "drivers" ? "driver-adjustments" : "summary-adjustments";

  const downloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const res = await fetch(`${API_BASE}/${budgetYear}/excel-template/${templateEndpointSegment}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(await parseErr(res));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `opex-budget-${opexView}-template-FY${budgetYear}.xlsx`;
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
      const data = await res.json();
      add(data.detail || "Opex adjustments uploaded ✓", "success");
      setTemplateUploadOpen(false);
      await fetchCategories();
    } catch (e) {
      setTemplateUploadError(e.message);
      add(`Upload failed: ${e.message}`, "error");
    } finally {
      setTemplateUploading(false);
    }
  };

  const kpis = [
    { label: "AI Suggested Opex", value: fmt(totals.ai), sub: `Across ${categories.length} categories`, icon: <FiBriefcase size={16} /> },
    { label: "User Budgeted Opex", value: fmt(totals.user), sub: fmtPct(totals.variancePct, { sign: true }) + " vs AI baseline", icon: <FiBriefcase size={16} /> },
    { label: "Variance", value: fmt(totals.variance), sub: "User adjustments to date", icon: <FiBriefcase size={16} /> },
    { label: "Categories with GL History", value: `${categories.filter((c) => c.confidence !== "Low").length}/${categories.length}`, sub: "Backed by real prior-year actuals", icon: <FiBriefcase size={16} /> },
  ];

  const staticHeader = (
    <header className="forecasting-page-header bg-gradient-to-r from-sky-950 via-sky-900 to-sky-700 rounded-xl px-4 py-2.5 md:px-6 sticky -top-5 z-40 shadow-sm">
      <div className="max-w-screen-2xl mx-auto">
        <h1 className="text-lg font-bold text-white">Operating Expense Budgeting</h1>
      </div>
    </header>
  );

  if (loading) {
    return (
      <div className="planning-compact forecasting-pnl-theme revenue-forecast-page space-y-2 min-h-screen bg-sky-50 font-sans text-sky-900 pb-12">
        {staticHeader}
        <TableSkeleton columns={6} rows={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="planning-compact forecasting-pnl-theme revenue-forecast-page space-y-2 min-h-screen bg-sky-50 font-sans text-sky-900 pb-12">
        {staticHeader}
        <EmptyState label={`Couldn't load Operating Expense Budgeting — ${error}`} />
      </div>
    );
  }

  return (
    <div className="planning-compact forecasting-pnl-theme revenue-forecast-page space-y-2 min-h-screen bg-sky-50 font-sans text-sky-900 pb-12">
      <ToastContainer toasts={toasts} />
      <WorkflowModal open={modal.open} target={modal.target} onClose={() => setModal({ open: false, target: null })} onConfirm={confirmWorkflow} />
      <ExceptionDrawer
        open={Boolean(exceptionDrawerCat)}
        exception={exceptionDrawerCat?.exception}
        entityLabel={exceptionDrawerCat?.name || ""}
        systemValue={exceptionDrawerCat?.ai_total}
        userValue={exceptionDrawerCat?.adjusted_total}
        guidelineLabel={exceptionDrawerCat?.name ? `${exceptionDrawerCat.name} Guideline` : ""}
        guidelineValue={exceptionDrawerCat?.guideline_display || ""}
        reasonOptions={GENERAL_EXCEPTION_REASONS}
        onClose={() => setExceptionDrawerCat(null)}
        onChanged={async () => { await Promise.all([fetchCategories(), opexExceptions.refetch()]); }}
      />
      <OverrideReasonModal
        open={reasonModal.open}
        context={reasonModal.category ? `${reasonModal.category.name}${reasonModal.period ? ` — ${reasonModal.period}` : " (all months)"}` : ""}
        readOnly={!editable}
        stage={stage}
        onClose={() => setReasonModal({ open: false, category: null, period: null })}
        onSave={saveOverrideReason}
      />
      <ImportModal open={templateUploadOpen} onClose={() => setTemplateUploadOpen(false)}
        title={opexView === "drivers" ? "Upload Driver Adjustments" : "Upload Summary Adjustments"}
        description={opexView === "drivers"
          ? "Upload your filled Drivers template. Matching Category + Period + Driver rows update Quantity and Budget Unit Cost; unmatched rows are added as new custom driver lines for that month."
          : "Upload your filled Summary template. Matching Category + Period rows update Budget Total, redistributed proportionally across that period's driver lines — same as editing the Budget Total cell directly."}
        uploading={templateUploading} error={templateUploadError} onUpload={handleTemplateUpload} />

      {/* Same custom dark-gradient sticky header RevenueBudgeting.jsx uses,
          rather than the shared (lighter-gradient) PageHeader component. */}
      <header className="forecasting-page-header bg-gradient-to-r from-sky-950 via-sky-900 to-sky-700 rounded-xl px-4 py-2.5 md:px-6 sticky -top-5 z-40 shadow-sm">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-white">Operating Expense Budgeting</h1>
          </div>
          <div className="flex items-center gap-2">
            <select value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value)}
              className="px-3 py-1 rounded-lg bg-white border border-sky-200 text-sky-900 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200">
              {CURRENCY_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={handleSave} disabled={!editable || !hasChanges || saving}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 border border-white/20 text-white text-x font-semibold hover:bg-white/20 transition-colors disabled:opacity-40">
              <FiSave size={12} /> {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </header>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-500">Budget Year</span>
          <span className="px-2.5 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-x font-semibold text-slate-700" title="Set in Settings & Customization → FY Management.">
            FY{budgetYear}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-500">Planning Frequency</span>
          <span className="px-2.5 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-x font-semibold text-slate-700" title="Set on Budget Setup & Guidelines — applies to every Budgeting module.">
            {frequency}
          </span>
        </div>
        {notes.map((n, i) => (
          <span key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5">{n}</span>
        ))}
      </div>

      <KpiRow cards={kpis} />
      <WorkflowProgress stage={stage} onAction={handleWorkflowAction} />

      {/* Budget Methodology (PRD §6) — same convention as Revenue/Workforce. */}
      {methodology === "Top-Down" ? (
        <>
          <TopDownTargetCard title="Operating Expense" baseline={opexBaseline} baselineLabel="Forecast Exit"
            growthPct={opexBlendedGrowthPct} growthLabel="Blended Guideline Growth" target={opexTarget} icon={<FiBriefcase className="text-sky-600" size={16} />} />
          <TopDownAllocationTable dimensionLabel="Expense Category" target={opexTarget}
            rows={opexCategoryAllocationRows} adjustedByKey={opexAllocAdj}
            onAdjust={(key, value) => setOpexAllocAdj((prev) => ({ ...prev, [key]: value === "" ? "" : Number(value) }))} />
        </>
      ) : (
      <>
      {methodology === "Hybrid" && (
        <ReconciliationBanner target={opexTarget} actual={totals.user} label="Bottom-Up Total (User Budgeted Opex)" />
      )}
      <ExceptionSummaryStrip totalEvaluated={categories.length} summary={opexExceptions.summary}
        activeFilter={fStatus} onFilterChange={setFStatus} />

      {/* Action row — View toggle + Excel download/upload, same right-aligned
          cluster placement/order as RevenueBudgeting.jsx's tabs row. */}
      <div className="flex items-center justify-between border-b-2 border-slate-200 mb-2 gap-2 flex-wrap">
        <div className="flex items-end gap-0.5">
          <button onClick={() => setOpexView("summary")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-s font-semibold whitespace-nowrap transition-all
              ${opexView === "summary"
                ? "bg-white text-sky-600 rounded-t-xl -mb-0.5 border-l border-t border-r border-slate-200 border-b-2 border-b-white shadow-sm"
                : "text-slate-500 hover:text-sky-700 hover:bg-white/60 rounded-t-xl"}`}>
            <FiList size={13} /> Summary
          </button>
          <button onClick={() => setOpexView("drivers")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-s font-semibold whitespace-nowrap transition-all
              ${opexView === "drivers"
                ? "bg-white text-sky-600 rounded-t-xl -mb-0.5 border-l border-t border-r border-slate-200 border-b-2 border-b-white shadow-sm"
                : "text-slate-500 hover:text-sky-700 hover:bg-white/60 rounded-t-xl"}`}>
            <FiLayers size={13} /> Drivers
          </button>
        </div>
        <div className="flex items-center gap-2 pb-1.5">
          <button onClick={downloadTemplate} disabled={downloadingTemplate}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-sky-700 text-x font-semibold transition-all disabled:opacity-60">
            {downloadingTemplate ? <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" /> : <FiDownload size={12} />}
            Download Template
          </button>
          {stage === "draft" && (
            <button onClick={() => setTemplateUploadOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-x font-semibold transition-all shadow-sm">
              <FiUpload size={12} /> Upload Excel
            </button>
          )}
        </div>
      </div>

      {/* Filter row — search/department/confidence, same convention as
          RevenueBudgeting.jsx's dedicated filter bar under its tabs row. */}
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-sky-400" size={12} />
            <input value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="Search category…"
              className="pl-7 pr-3 py-1 rounded-lg border border-sky-300 bg-white text-xs text-sky-900 outline-none focus:border-sky-500 focus:ring-2 ring-sky-100 transition-all w-48 shadow-sm" />
          </div>
          {filterText && (
            <button onClick={() => setFilterText("")}
              className="flex items-center gap-1 text-xs text-sky-500 hover:text-sky-700 px-1.5 py-1 rounded-md hover:bg-sky-100 transition-colors">
              <FiX size={11} /> Clear
            </button>
          )}
          <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}
            className="px-2 py-1 rounded-lg border border-sky-300 bg-white text-xs text-sky-700 outline-none focus:border-sky-500 cursor-pointer"
            title="Shows only categories whose spend is primarily booked to this department, and scopes Prior Year Actual (and the derived AI baseline) to it.">
            <option value="">All Departments</option>
            {meta.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={fConfidence} onChange={(e) => setFConfidence(e.target.value)}
            className="px-2 py-1 rounded-lg border border-sky-300 bg-white text-xs text-sky-700 outline-none focus:border-sky-500 cursor-pointer">
            <option value="All">All Confidence</option>
            {["High", "Medium", "Low"].map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          {(filterText || departmentId || fConfidence !== "All" || fStatus !== "all") && (
            <button onClick={() => { setFilterText(""); setDepartmentId(""); setFConfidence("All"); setFStatus("all"); }}
              className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-800 px-1.5 py-1 rounded-md hover:bg-sky-50 border border-sky-200 transition-colors">
              <FiX size={10} /> Clear filters
            </button>
          )}
          <span className="text-xs text-sky-500 bg-white px-2 py-1 rounded-md tabular-nums border border-sky-200">
            {filteredCategories.length}/{categories.length}
          </span>
        </div>
        {!editable && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
            <FiAlertCircle size={11} /> Editing disabled — {STAGE_LABELS[stage] || stage}
          </div>
        )}
      </div>

      {filteredCategories.length === 0 ? <EmptyState label="No categories match the current filters." /> : opexView === "summary" ? (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
        <div className="analytics-table-scroll relative overflow-x-auto max-h-[72vh] overflow-y-auto">
          <table className="relative w-full border-collapse text-sm" style={{ minWidth: `${980 + summaryPeriods.length * 210}px` }}>
            <thead className="sticky top-0 z-20">
              <tr className="bg-sky-800 border-b border-sky-700">
                <th rowSpan={2} className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700 sticky left-0 bg-sky-800 z-30 min-w-[200px]">Category</th>
                <th rowSpan={2} className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide min-w-[95px] border-r border-sky-700/50">
                  Prior Year{priorFiscalYear != null && (<><br /><span className="text-xs font-normal normal-case text-sky-200">FY{priorFiscalYear}</span></>)}
                </th>
                <th rowSpan={2} className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide min-w-[95px] border-r border-sky-700/50">
                  Curr. Forecast{currentFiscalYear != null && (<><br /><span className="text-xs font-normal normal-case text-sky-200">FY{currentFiscalYear}</span></>)}
                </th>
                <th rowSpan={2} className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide min-w-[95px] border-r border-sky-700">
                  Forecast Exit{currentFiscalYear != null && (<><br /><span className="text-xs font-normal normal-case text-sky-200">FY{currentFiscalYear}</span></>)}
                </th>
                <th colSpan={2} className="px-3 py-1.5 text-center text-xs font-semibold text-slate-50 border-l border-r border-sky-700 bg-sky-900">Annual Total</th>
                {summaryPeriods.map((p) => <th key={p} colSpan={3} className="px-3 py-1.5 text-center text-xs font-semibold border-l border-r text-white border-sky-700 bg-sky-800">{p}</th>)}
                <th rowSpan={2} className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide border-l border-sky-700 min-w-[85px]">Variance</th>
                <th rowSpan={2} className="px-3 py-1.5 text-center text-xs font-semibold text-white uppercase tracking-wide min-w-[95px] border-l border-sky-700/50">Confidence</th>
                <th rowSpan={2} className="px-3 py-1.5 text-center text-xs font-semibold text-slate-50 border-l border-sky-700 bg-sky-800 min-w-[130px]">Reason</th>
                <th rowSpan={2} className="px-3 py-1.5 text-center text-xs font-semibold text-white uppercase tracking-wide border-l border-sky-700 min-w-[220px]">Insight</th>
              </tr>
              <tr className="bg-sky-700 border-b border-slate-600 sticky top-[28px] z-10">
                <th className="px-2 py-1 text-right text-xs font-medium text-white uppercase border-l border-r border-l-slate-600 border-r-slate-600/60 min-w-[75px]">AI</th>
                <th className="px-2 py-1 text-right text-xs font-semibold text-white uppercase min-w-[85px]">Budget</th>
                {summaryPeriods.map((p) => (
                  <React.Fragment key={p}>
                    <th className="px-2 py-1 text-right text-xs font-medium text-slate-100 uppercase border-l border-r border-l-slate-600 border-r-slate-600/60 min-w-[80px]">AI</th>
                    <th className="px-2 py-1 text-right text-xs font-semibold text-white uppercase min-w-[110px] border-r border-slate-600/60">Budget</th>
                    <th className="px-1 py-1 text-center text-xs font-semibold text-white uppercase min-w-[32px] border-r border-slate-600" title="Reason">
                      <FiMessageSquare size={11} className="mx-auto opacity-70" />
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredCategories.map((c, rowIdx) => {
                const ai = catAiTotal(c);
                const user = catUserTotal(c);
                const variance = user - ai;
                const rowBg = rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/60";
                const anyReason = c.items.find((i) => i.override_reason);
                return (
                  <tr key={c.key} className={`rf-row border-b border-slate-200 transition-colors hover:bg-sky-50/50 ${rowBg}`}>
                    <td className={`px-3 py-1 sticky left-0 border-r border-slate-200 z-[5] ${rowBg}`}>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900 text-xs leading-tight">{c.name}</span>
                        {variance !== 0 && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" title="Has adjustments" />}
                      </div>
                    </td>
                    <td className="px-3 py-1 text-right tabular-nums text-xs text-slate-500 border-r border-slate-100">{fmt(c.prior_year_actual)}</td>
                    <td className="px-3 py-1 text-right tabular-nums text-xs text-slate-500 border-r border-slate-100">{fmt(c.current_forecast)}</td>
                    <td className="px-3 py-1 text-right tabular-nums text-xs text-slate-500 border-r border-slate-300">{fmt(c.forecast_exit)}</td>
                    <td className="px-2 py-1 text-right text-xs text-slate-500 tabular-nums border-r border-slate-100 bg-slate-50/60">{fmt(ai)}</td>
                    {/* Rollup of the 12 monthly Budget cells, never independently
                        editable — same convention as RevenueBudgeting.jsx's
                        Total Adj column (edit the months, not the total). */}
                    <td className={`px-2 py-1 text-right text-xs font-bold tabular-nums border-r border-slate-300 ${user > ai ? "text-emerald-600" : user < ai ? "text-red-500" : "text-sky-700"}`}>{fmt(user)}</td>
                    {summaryPeriods.map((p) => {
                      const monthsInCol = monthsForColumn(p);
                      const pItems = c.items.filter((i) => monthsInCol.includes(i.period));
                      // A single directly-editable item only exists at Monthly
                      // grain (one real month, one driver line) — Quarterly/
                      // Annual columns always cover multiple months and go
                      // through the bucket-total redistribution path instead,
                      // even when each of those months happens to have just
                      // one driver line.
                      const pSingle = frequency === "Monthly" && pItems.length === 1 ? pItems[0] : null;
                      const agg = bucketAgg(c, p);
                      const anyBucketReason = pItems.find((i) => i.override_reason);
                      return (
                        <React.Fragment key={p}>
                          <td className="px-2 py-1 text-right text-xs text-slate-500 tabular-nums border-r border-slate-100">{fmt(agg.ai_total)}</td>
                          <td className="px-1.5 py-1 border-r border-slate-100">
                            {pSingle ? (
                              <input type="number" value={pSingle.adjusted_unit_cost} disabled={!editable}
                                onChange={(e) => updateItemCost(c.key, pSingle.id, e.target.value)}
                                className={`w-full px-1.5 py-0.5 rounded-md border text-right text-xs tabular-nums outline-none transition-all
                                  ${!editable ? "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200" :
                                    Number(pSingle.adjusted_unit_cost) !== pSingle.ai_unit_cost ? "border-sky-400 bg-sky-50 text-sky-900 focus:ring-2 ring-sky-100" :
                                    "border-slate-300 bg-white hover:border-slate-400 focus:border-sky-500 focus:ring-2 ring-sky-100"}`} />
                            ) : (
                              // Multi-driver-line period ("group") or a
                              // Quarterly/Annual bucket — editing the combined
                              // total distributes it back proportionally
                              // (across months, then across driver lines
                              // within each month — see
                              // updateCategoryBucketTotal), so this stays in
                              // sync with the Drivers view (always monthly).
                              <input type="number" value={agg.adjusted_total} disabled={!editable}
                                onChange={(e) => (frequency === "Monthly" ? updateCategoryPeriodTotal(c.key, p, e.target.value) : updateCategoryBucketTotal(c.key, p, e.target.value))}
                                title={`${pItems.length} driver line(s) across ${monthsInCol.length} month(s) — editing distributes proportionally`}
                                className={`w-full px-1.5 py-0.5 rounded-md border text-right text-xs tabular-nums font-semibold outline-none transition-all
                                  ${!editable ? "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200" :
                                    Number(agg.adjusted_total) !== Number(agg.ai_total) ? "border-sky-400 bg-sky-50 text-sky-900 focus:ring-2 ring-sky-100" :
                                    "border-slate-300 bg-white hover:border-slate-400 focus:border-sky-500 focus:ring-2 ring-sky-100"}`} />
                            )}
                          </td>
                          <td className="px-0.5 py-1 text-center border-r border-slate-300">
                            {pItems.length > 0 && (
                              <button onClick={() => setReasonModal({ open: true, category: c, period: p })}
                                className={`relative w-6 h-6 rounded-md flex items-center justify-center transition-all mx-auto ${anyBucketReason ? "bg-sky-100 text-sky-600 border border-sky-200 hover:bg-sky-200" : "text-slate-300 hover:text-sky-500 hover:bg-sky-50 border border-transparent hover:border-sky-200"}`}
                                title={anyBucketReason ? `${anyBucketReason.override_reason}${anyBucketReason.override_note ? ": " + anyBucketReason.override_note : ""}` : `Add reason for ${p}`}>
                                <FiMessageSquare size={11} />
                                {anyBucketReason && (
                                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 border border-white" />
                                )}
                              </button>
                            )}
                          </td>
                        </React.Fragment>
                      );
                    })}
                    <td className={`px-2 py-1 text-right text-xs font-semibold tabular-nums border-r border-slate-100 ${variance > 0 ? "text-emerald-600" : variance < 0 ? "text-red-500" : "text-slate-400"}`}>
                      {variance === 0 ? "—" : `${variance > 0 ? "+" : ""}${fmt(variance)}`}
                    </td>
                    <td className="px-2 py-1 text-center border-r border-slate-100">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.confidence === "High" ? "bg-emerald-50 text-emerald-700" : c.confidence === "Medium" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"}`}>{c.confidence}</span>
                        {c.software_consolidation_active_insufficient_data && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500" title="Software Consolidation guideline is active, but there's no vendor/license line data to quantify the savings.">
                            Consolidation active — no data
                          </span>
                        )}
                        <ExceptionBadge exception={c.exception} onClick={() => setExceptionDrawerCat(c)} />
                      </div>
                    </td>
                    <td className="px-1.5 py-1 text-center border-l border-slate-100">
                      <button onClick={() => setReasonModal({ open: true, category: c, period: null })}
                        className={`relative flex items-center gap-1 px-1.5 py-1 rounded-md transition-all max-w-[115px] mx-auto ${anyReason ? "bg-sky-100 text-sky-700 border border-sky-200 hover:bg-sky-200" : "text-slate-300 hover:text-sky-500 hover:bg-sky-50 border border-transparent hover:border-sky-200"}`}
                        title={anyReason ? `${anyReason.override_reason}${anyReason.override_note ? ": " + anyReason.override_note : ""}` : "Add override reason for all 12 months"}>
                        <FiMessageSquare size={11} className="shrink-0" />
                        {anyReason && <span className="text-xs font-semibold truncate">{anyReason.override_reason}</span>}
                        {anyReason && (
                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 border border-white" />
                        )}
                      </button>
                    </td>
                    <td className="px-2 py-1 border-l border-slate-300">
                      <ExplainPopover reasons={c.reasons} confidence={c.confidence} label={`${c.name} — AI Reasoning`}
                        value={fmt(ai)} valueLabel="AI Suggested" variant="cell" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-sky-900 text-white sticky bottom-0 z-10 font-semibold">
                <td className="px-3 py-1.5 text-xs sticky left-0 bg-sky-900 border-r border-sky-700 z-[9]">GRAND TOTAL</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-xs border-r border-sky-700/50">{fmt(totals.priorYearActual)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-xs border-r border-sky-700/50">{fmt(totals.currentForecast)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-xs border-r border-sky-700">{fmt(totals.forecastExit)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-xs border-l border-r border-sky-700/50">{fmt(totals.ai)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-xs font-bold border-r border-sky-700">{fmt(totals.user)}</td>
                {periodTotals.map((pt) => (
                  <React.Fragment key={pt.period}>
                    <td className="px-2 py-1.5 text-right tabular-nums text-xs border-l border-r border-sky-700/50 bg-sky-800">{fmt(pt.ai)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-xs font-bold border-r border-sky-700/50 bg-sky-800">{fmt(pt.user)}</td>
                    <td className="border-r border-sky-700 bg-sky-800"></td>
                  </React.Fragment>
                ))}
                <td className="px-2 py-1.5 text-right tabular-nums text-xs border-l border-sky-700">{totals.variance === 0 ? "—" : `${totals.variance > 0 ? "+" : ""}${fmt(totals.variance)}`}</td>
                <td></td><td></td><td className="border-l border-sky-700"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      ) : (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
        <div className="flex items-center gap-1.5 px-4 pt-3 pb-2 text-sky-700 text-x">
          <FiLayers size={13} /> Editing Quantity or Budget Unit Cost here recalculates Budget Total instantly and stays in sync with the Summary view.
          {frequency !== "Monthly" && " Drivers always shows real months, regardless of Planning Frequency — switch to Summary for the " + frequency.toLowerCase() + " view."}
        </div>
        <div className="analytics-table-scroll relative overflow-x-auto max-h-[72vh] overflow-y-auto">
          <table className="relative w-full border-collapse text-sm" style={{ minWidth: `${370 + periods.length * 250}px` }}>
            <thead className="sticky top-0 z-20">
              <tr className="bg-sky-800 border-b border-sky-700">
                <th rowSpan={2} className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700 sticky left-0 bg-sky-800 z-30 min-w-[220px]">Category / Driver</th>
                <th colSpan={2} className="px-3 py-1.5 text-center text-xs font-semibold text-slate-50 border-l border-r border-sky-700 bg-sky-900 min-w-[150px]">Total Budget</th>
                {periods.map((p) => <th key={p} colSpan={3} className="px-3 py-1.5 text-center text-xs font-semibold text-white uppercase border-l border-r border-sky-700 min-w-[250px]">{p}</th>)}
              </tr>
              <tr className="bg-sky-700 border-b border-slate-600 sticky top-[28px] z-10">
                <th className="px-2 py-1 text-right text-xs font-medium text-white uppercase border-l border-r border-l-slate-600 border-r-slate-600/60 min-w-[75px]">AI</th>
                <th className="px-2 py-1 text-right text-xs font-semibold text-white uppercase min-w-[75px]">Budget</th>
                {periods.map((p) => (
                  <React.Fragment key={p}>
                    <th className="px-2 py-1 text-right text-xs font-medium text-slate-100 uppercase border-l border-r border-l-slate-600 border-r-slate-600/60 min-w-[70px]">Qty</th>
                    <th className="px-2 py-1 text-right text-xs font-medium text-slate-100 uppercase min-w-[85px] border-r border-slate-600/60">AI Cost</th>
                    <th className="px-2 py-1 text-right text-xs font-semibold text-white uppercase min-w-[95px] border-r border-slate-600">Budget Cost</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredCategories.map((c) => {
                // Drivers repeat across every period they have a line for (the
                // AI-seed driver always does; custom driver lines may only
                // exist for whichever period they were added to) — grouping
                // by driver name turns the old one-row-per-(driver,period)
                // list into one row per driver with each period's Quantity/
                // Cost/Total as a repeating column group, same horizontal
                // layout convention RevenueBudgeting.jsx's Drivers view uses
                // for Volume/Rate/Revenue per customer.
                const driverMap = new Map();
                c.items.forEach((i) => {
                  if (!driverMap.has(i.driver)) driverMap.set(i.driver, {});
                  driverMap.get(i.driver)[i.period] = i;
                });
                const driverCols = 2 + periods.length * 3;
                return (
                  <React.Fragment key={c.key}>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <td colSpan={1 + driverCols} className="px-3 py-1 text-xs font-bold text-slate-700 uppercase tracking-wide sticky left-0 bg-slate-100 z-[5]">{c.name}</td>
                    </tr>
                    {Array.from(driverMap.entries()).map(([driverName, periodItems]) => {
                      const totalAi = periods.reduce((s, p) => s + (periodItems[p] ? periodItems[p].quantity * periodItems[p].ai_unit_cost : 0), 0);
                      const totalBudget = periods.reduce((s, p) => s + (periodItems[p] ? periodItems[p].quantity * (Number(periodItems[p].adjusted_unit_cost) || 0) : 0), 0);
                      return (
                        <tr key={driverName} className="rf-row border-b border-slate-200 last:border-b-0 hover:bg-sky-50/40">
                          <td className="px-3 py-1 text-xs text-slate-700 font-medium sticky left-0 bg-white z-[4] border-r border-slate-200">{driverName}</td>
                          <td className="px-2 py-1 text-right text-xs text-slate-500 tabular-nums border-r border-slate-100 bg-slate-50/60">{fmt(totalAi)}</td>
                          <td className={`px-2 py-1 text-right text-xs font-bold tabular-nums border-r border-slate-300 ${totalBudget > totalAi ? "text-emerald-600" : totalBudget < totalAi ? "text-red-500" : "text-sky-700"}`}>{fmt(totalBudget)}</td>
                          {periods.map((p) => {
                            const item = periodItems[p];
                            if (!item) {
                              return (
                                <React.Fragment key={p}>
                                  <td className="px-1 py-1 border-r border-slate-100 text-center text-slate-300 text-xs">—</td>
                                  <td className="px-1 py-1 border-r border-slate-100 text-center text-slate-300 text-xs">—</td>
                                  <td className="px-1 py-1 border-r border-slate-300 text-center text-slate-300 text-xs">—</td>
                                </React.Fragment>
                              );
                            }
                            return (
                              <React.Fragment key={p}>
                                <td className="px-1 py-1 border-r border-slate-100">
                                  <input type="number" value={item.quantity} disabled={!editable}
                                    onChange={(e) => updateItemQuantity(c.key, item.id, e.target.value)}
                                    className={`w-14 px-1 py-0.5 rounded-md border text-right tabular-nums text-xs outline-none transition-all
                                      ${!editable ? "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200" :
                                        "border-slate-300 bg-white hover:border-slate-400 focus:border-sky-500 focus:ring-2 ring-sky-100"}`} />
                                </td>
                                <td className="px-2 py-1 text-right tabular-nums text-xs text-slate-500 border-r border-slate-100">{fmt(item.ai_unit_cost)}</td>
                                <td className="px-1 py-1 border-r border-slate-300">
                                  <div className="flex items-center gap-1">
                                    <input type="number" value={item.adjusted_unit_cost} disabled={!editable}
                                      onChange={(e) => updateItemCost(c.key, item.id, e.target.value)}
                                      className={`w-20 px-1 py-0.5 rounded-md border text-right tabular-nums text-xs outline-none transition-all
                                        ${!editable ? "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200" :
                                          Number(item.adjusted_unit_cost) !== item.ai_unit_cost ? "border-sky-400 bg-sky-50 text-sky-900 focus:ring-2 ring-sky-100" :
                                          "border-slate-300 bg-white hover:border-slate-400 focus:border-sky-500 focus:ring-2 ring-sky-100"}`} />
                                    {!item.is_ai_seed && editable && (
                                      <button onClick={() => removeDriver(item.id)} title="Remove driver line"
                                        className="text-slate-300 hover:text-red-500 transition-colors shrink-0">
                                        <FiTrash2 size={10} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      );
                    })}
                    {addDriverFor === c.key && (
                      <tr className="border-b border-slate-200 bg-sky-50/40">
                        <td colSpan={1 + driverCols} className="px-3 py-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <input type="text" placeholder="Driver name" value={driverForm.driver}
                              onChange={(e) => setDriverForm((f) => ({ ...f, driver: e.target.value }))}
                              className="w-48 px-2 py-1 rounded-md border border-slate-200 text-xs outline-none focus:border-sky-500" />
                            <select value={driverForm.period || periods[0]} onChange={(e) => setDriverForm((f) => ({ ...f, period: e.target.value }))}
                              className="px-1.5 py-1 rounded-md border border-slate-200 text-xs outline-none focus:border-sky-500">
                              {periods.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <input type="number" placeholder="Quantity" value={driverForm.quantity}
                              onChange={(e) => setDriverForm((f) => ({ ...f, quantity: e.target.value }))}
                              className="w-20 px-1.5 py-0.5 rounded-md border border-slate-200 text-right tabular-nums text-xs outline-none focus:border-sky-500" />
                            <input type="number" placeholder="Unit cost" value={driverForm.unitCost}
                              onChange={(e) => setDriverForm((f) => ({ ...f, unitCost: e.target.value }))}
                              className="w-24 px-1.5 py-0.5 rounded-md border border-slate-200 text-right tabular-nums text-xs outline-none focus:border-sky-500" />
                            <button onClick={() => submitAddDriver(c.key)} className="text-xs font-medium text-sky-700 hover:text-sky-900">Add</button>
                            <button onClick={() => setAddDriverFor(null)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                          </div>
                        </td>
                      </tr>
                    )}
                    {editable && addDriverFor !== c.key && (
                      <tr className="border-b border-slate-200">
                        <td colSpan={1 + driverCols} className="px-3 py-1">
                          <button onClick={() => { setAddDriverFor(c.key); setDriverForm({ driver: "", quantity: 1, unitCost: 0, period: periods[0] }); }}
                            className="flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-900">
                            <FiPlus size={11} /> Add Driver
                          </button>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}
      </>
      )}
    </div>
  );
};

export default OpexBudgeting;
