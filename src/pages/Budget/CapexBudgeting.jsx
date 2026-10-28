// CapexBudgeting.jsx — PRD §53-64: Capital Expenditure Planning.
// Backed by real endpoints under /api/v1/budget/capex/{year}/... — AI
// baselines come from the real CAPEX forecasting ML pipeline (already used
// by the Forecasting module's CAPEX Forecast screen) plus real fixed-asset
// register actuals (fpna_landing.finance_fixed_asset). Categories are real
// and dynamic (whatever exists in the fixed-asset register), not a fixed
// PRD list. Individual named capital projects (vendor, ROI, payback, status
// routing) live alongside a per-category AI-seed monthly baseline, same
// pattern as OpexBudgeting.jsx's driver items. Summary/Drivers view split,
// filters, and Excel template download/upload mirror OpexBudgeting.jsx's
// (now Revenue-Forecast-aligned) conventions.
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  FiPackage, FiSave, FiPlus, FiX, FiMessageSquare, FiTrash2,
  FiList, FiLayers, FiSearch, FiDownload, FiUpload, FiAlertCircle,
} from "react-icons/fi";
import {
  KpiRow, WorkflowModal, WorkflowProgress,
  ExplainPopover, OverrideReasonModal, StatusPill,
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

const API_BASE = `${API_BASE_URL}/api/v1/budget/capex`;

async function parseErr(res) {
  try {
    const data = await res.json();
    return data?.detail || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

// apply_smart_currency formats money fields as comma-formatted display
// strings server-side — parseMoney() converts them back to real numbers.
// roi_percent/payback_period_years are plain (non-money) numbers server-side
// and pass through untouched.
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
    npv: parseMoney(i.npv),
    annual_benefit: parseMoney(i.annual_benefit),
  })),
}));

const CapexBudgeting = () => {
  const { token } = useContext(AuthContext);
  const { toasts, add } = useToast();
  const { budgetYear, fiscalYearStartMonth } = useContext(BudgetYearContext);
  const { methodology } = useContext(BudgetMethodologyContext);
  const { guidelines, frequency } = useContext(BudgetGuidelinesContext);

  const [capexAllocAdj, setCapexAllocAdj] = useState({});
  const [stage, setStage] = useState("draft");
  const [editable, setEditable] = useState(true);
  const [modal, setModal] = useState({ open: false, target: null });
  const [reasonModal, setReasonModal] = useState({ open: false, category: null, period: null });
  const [showNewRequest, setShowNewRequest] = useState(false);

  // Summary ⇄ Drivers view — same split as OpexBudgeting.jsx's opexView.
  const [capexView, setCapexView] = useState("summary");

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
  const [dirtyItems, setDirtyItems] = useState({}); // itemId -> { adjusted_unit_cost?, status?, override_reason?, override_note? }
  const [saving, setSaving] = useState(false);
  const hasChanges = Object.keys(dirtyItems).length > 0;

  // Budget Guideline & Exception Engine — capex_limit/total_planned/
  // remaining_capacity/limit_exception are backend-authoritative (§10, §12),
  // computed fresh on every load; capexTarget below stays a client-side
  // instant-feedback echo of the same guideline value for typing responsiveness.
  const [limitInfo, setLimitInfo] = useState(null);
  const capexExceptions = useExceptions(budgetYear, "capex");
  const [exceptionDrawerCat, setExceptionDrawerCat] = useState(null);
  const [exceptionDrawerItem, setExceptionDrawerItem] = useState(null);
  const [limitDrawerOpen, setLimitDrawerOpen] = useState(false);

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
      setLimitInfo({
        capex_limit: parseMoney(data.capex_limit), total_planned: parseMoney(data.total_planned),
        remaining_capacity: parseMoney(data.remaining_capacity), limit_exception: data.limit_exception || null,
      });
    } catch (e) {
      if (e?.name === "AbortError") return;
      if (seq !== categoriesFetchSeqRef.current) return;
      setError(e.message || "Failed to load CAPEX Budgeting.");
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

  const filteredCategories = useMemo(() => categories.filter((c) => {
    if (filterText && !c.name.toLowerCase().includes(filterText.toLowerCase())) return false;
    if (fConfidence !== "All" && c.confidence !== fConfidence) return false;
    if (fStatus === "within" && c.exception) return false;
    if (fStatus === "exception" && !c.exception) return false;
    if (fStatus === "pending" && c.exception?.approval_status !== "pending") return false;
    if (fStatus === "approved" && c.exception?.approval_status !== "approved") return false;
    if (fStatus === "rejected" && c.exception?.approval_status !== "rejected") return false;
    return true;
  }), [categories, filterText, fConfidence, fStatus]);

  const totals = useMemo(() => {
    const ai = categories.reduce((s, c) => s + catAiTotal(c), 0);
    const user = categories.reduce((s, c) => s + catUserTotal(c), 0);
    const priorYearActual = categories.reduce((s, c) => s + (c.prior_year_actual || 0), 0);
    const currentForecast = categories.reduce((s, c) => s + (c.current_forecast || 0), 0);
    const forecastExit = categories.reduce((s, c) => s + (c.forecast_exit || 0), 0);
    const approvedProjects = categories.reduce((s, c) => s + c.items.filter((i) => !i.is_ai_seed && i.status === "Approved").length, 0);
    const totalProjects = categories.reduce((s, c) => s + c.items.filter((i) => !i.is_ai_seed).length, 0);
    return { ai, user, variance: user - ai, variancePct: ai ? ((user - ai) / ai) * 100 : 0, priorYearActual, currentForecast, forecastExit, approvedProjects, totalProjects };
  }, [categories]);

  // Planning Frequency (Budget Setup & Guidelines) — same client-side-only
  // bucketing pattern as OpexBudgeting.jsx: the backend always returns the
  // real 12 monthly periods/items, so a frequency change never refetches
  // here, it only changes how the Summary table groups/edits what's already
  // loaded. `periods` stays the raw months (still needed for item matching
  // and the Drivers-tab grids below, which always stay monthly-grain);
  // `summaryPeriods` is the column set the Summary table renders.
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

  // Top-Down target (PRD §7) — CAPEX Limit is an absolute $ cap, not a
  // growth rate, so it's used directly as the target, same as the original
  // mock had it (guidelines are now real, fetched from the backend).
  const capexCategoryAllocationRows = useMemo(() => categories.map((c) => {
    const baseline = c.forecast_exit ?? catAiTotal(c);
    const target = catAiTotal(c);
    const growthPct = baseline ? ((target - baseline) / baseline) * 100 : 0;
    return { key: c.key, name: c.name, priorShare: baseline, growthPct };
  }), [categories]);

  const capexBaseline = useMemo(
    () => capexCategoryAllocationRows.reduce((s, r) => s + r.priorShare, 0),
    [capexCategoryAllocationRows]
  );
  const capexTarget = Number(guidelines.capexLimit) || 0;
  const capexGrowthPct = totals.ai ? ((capexTarget - totals.ai) / totals.ai) * 100 : 0;

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

  // Quantity edit — Drivers view only, same recompute path Opex's
  // updateItemQuantity uses. Budget Total = Quantity x Budget Unit Cost.
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

  const updateItemStatus = (catKey, itemId, status) => {
    setCategories((prev) => prev.map((c) => {
      if (c.key !== catKey) return c;
      return { ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, status } : i)) };
    }));
    setDirtyItems((prev) => ({ ...prev, [itemId]: { ...prev[itemId], status } }));
  };

  // Summary <-> Drivers bidirectional sync for a period with more than one
  // line (an AI baseline row plus one or more named capital requests in the
  // same month) — same convention as OpexBudgeting.jsx's
  // updateCategoryPeriodTotal: the new total is distributed back across
  // those lines by scaling each one's existing Budget Cost by the same
  // ratio (preserving each line's relative share), or split evenly if every
  // line is currently $0. Ported in as part of the Planning Frequency
  // feature — previously this Summary cell was read-only ("switch to
  // Drivers view to edit") whenever a period had multiple lines, which
  // Quarterly/Annual buckets always do (they cover several months' worth of
  // lines at once), so this had to exist before bucket-grain editing could
  // work at all.
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
  // bucket total, identical algorithm to OpexBudgeting.jsx's
  // updateCategoryBucketTotal: split the bucket total across its months
  // (proportional to each month's AI total), then reuse
  // updateCategoryPeriodTotal's per-month multi-line redistribution. PATCH
  // payload shape stays {id, adjusted_unit_cost} — no backend changes.
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
      add("CAPEX Budgeting saved.", "success");
      await fetchCategories();
    } catch (e) {
      add(e.message || "Failed to save CAPEX Budgeting.", "error");
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

  const submitNewRequest = async (form) => {
    try {
      const res = await fetch(`${API_BASE}/${budgetYear}/items`, {
        method: "POST", headers: authHeaders(true),
        body: JSON.stringify({
          category_key: form.category, period: form.period, project_name: form.project,
          department_id: form.departmentId || null, vendor: form.vendor || null,
          in_service_period: form.inService || null, useful_life_years: Number(form.usefulLife) || null,
          quantity: Number(form.quantity) || 1, unit_cost: Number(form.unitCost) || 0,
          justification: form.justification || null,
        }),
      });
      if (!res.ok) throw new Error(await parseErr(res));
      add("Capital request added.", "success");
      setShowNewRequest(false);
      await fetchCategories();
    } catch (e) {
      add(e.message || "Failed to add capital request.", "error");
    }
  };

  const removeRequest = async (itemId) => {
    try {
      const res = await fetch(`${API_BASE}/${budgetYear}/items/${itemId}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error(await parseErr(res));
      add("Capital request removed.", "success");
      await fetchCategories();
    } catch (e) {
      add(e.message || "Failed to remove capital request.", "error");
    }
  };

  const saveOverrideReason = async ({ reason, note }) => {
    const cat = reasonModal.category;
    if (!cat) { setReasonModal({ open: false, category: null, period: null }); return; }
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
  // convention RevenueBudgeting.jsx/OpexBudgeting.jsx use.
  const templateEndpointSegment = capexView === "drivers" ? "driver-adjustments" : "summary-adjustments";

  const downloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const res = await fetch(`${API_BASE}/${budgetYear}/excel-template/${templateEndpointSegment}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(await parseErr(res));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `capex-budget-${capexView}-template-FY${budgetYear}.xlsx`;
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
      add(data.detail || "CAPEX requests uploaded ✓", "success");
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
    { label: "AI Recommended CAPEX", value: fmt(totals.ai), sub: `${totals.totalProjects} capital request(s)`, icon: <FiPackage size={16} /> },
    { label: "Budgeted CAPEX", value: fmt(totals.user), sub: fmtPct(totals.variancePct, { sign: true }) + " vs AI baseline", icon: <FiPackage size={16} /> },
    { label: "Annual CAPEX Limit", value: fmt(capexTarget), sub: `${fmt(capexTarget - totals.user)} headroom remaining`, icon: <FiPackage size={16} /> },
    { label: "Approved Projects", value: `${totals.approvedProjects}/${totals.totalProjects}`, sub: "By count", icon: <FiPackage size={16} /> },
  ];

  const staticHeader = (
    <header className="forecasting-page-header bg-gradient-to-r from-sky-950 via-sky-900 to-sky-700 rounded-xl px-4 py-2.5 md:px-6 sticky -top-5 z-40 shadow-sm">
      <div className="max-w-screen-2xl mx-auto">
        <h1 className="text-lg font-bold text-white">CAPEX Budgeting</h1>
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
        <EmptyState label={`Couldn't load CAPEX Budgeting — ${error}`} />
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
        guidelineLabel={exceptionDrawerCat?.guideline_key === "techInvestment" ? "Technology Investment" : "Asset Replacement"}
        guidelineValue={exceptionDrawerCat ? fmt(exceptionDrawerCat.guideline_value) : ""}
        reasonOptions={GENERAL_EXCEPTION_REASONS}
        onClose={() => setExceptionDrawerCat(null)}
        onChanged={async () => { await Promise.all([fetchCategories(), capexExceptions.refetch()]); }}
      />
      <ExceptionDrawer
        open={Boolean(exceptionDrawerItem)}
        exception={exceptionDrawerItem?.exception}
        entityLabel={exceptionDrawerItem ? `${exceptionDrawerItem.project_name} (${exceptionDrawerItem.category_name})` : ""}
        systemValue={0}
        userValue={exceptionDrawerItem ? exceptionDrawerItem.quantity * exceptionDrawerItem.adjusted_unit_cost : null}
        guidelineLabel="Office Expansion"
        guidelineValue="Not Planned"
        reasonOptions={GENERAL_EXCEPTION_REASONS}
        onClose={() => setExceptionDrawerItem(null)}
        onChanged={async () => { await Promise.all([fetchCategories(), capexExceptions.refetch()]); }}
      />
      <ExceptionDrawer
        open={limitDrawerOpen}
        exception={limitInfo?.limit_exception}
        entityLabel="Annual CAPEX Limit"
        systemValue={limitInfo?.capex_limit}
        userValue={limitInfo?.total_planned}
        guidelineLabel="Annual CAPEX Limit"
        guidelineValue={limitInfo ? fmt(limitInfo.capex_limit) : ""}
        reasonOptions={GENERAL_EXCEPTION_REASONS}
        onClose={() => setLimitDrawerOpen(false)}
        onChanged={async () => { await Promise.all([fetchCategories(), capexExceptions.refetch()]); }}
      />
      <OverrideReasonModal
        open={reasonModal.open}
        context={reasonModal.category ? `${reasonModal.category.name}${reasonModal.period ? ` — ${reasonModal.period}` : " (all items)"}` : ""}
        readOnly={!editable}
        stage={stage}
        onClose={() => setReasonModal({ open: false, category: null, period: null })}
        onSave={saveOverrideReason}
      />
      <ImportModal open={templateUploadOpen} onClose={() => setTemplateUploadOpen(false)}
        title={capexView === "drivers" ? "Upload Driver Adjustments" : "Upload Summary Adjustments"}
        description={capexView === "drivers"
          ? "Upload your filled Drivers template. Matching Category + Period + Project Name rows update Quantity, Budget Cost, and other fields; unmatched rows (with a Project Name) are added as new capital requests. Rows with a blank Project Name update that month's AI baseline."
          : "Upload your filled Summary template. Matching Category + Period rows update Budget Total, redistributed proportionally across that period's lines — same as editing the Budget Total cell directly."}
        uploading={templateUploading} error={templateUploadError} onUpload={handleTemplateUpload} />
      {showNewRequest && (
        <NewRequestModal categories={categories.map((c) => c.key)} periods={periods} departments={meta.departments}
          onClose={() => setShowNewRequest(false)} onCreate={submitNewRequest} />
      )}

      <header className="forecasting-page-header bg-gradient-to-r from-sky-950 via-sky-900 to-sky-700 rounded-xl px-4 py-2.5 md:px-6 sticky -top-5 z-40 shadow-sm">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-white">CAPEX Budgeting</h1>
            <p className="text-xs text-sky-200 mt-0.5">Capital request planning, ROI, and approval routing</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value)}
              className="px-3 py-1 rounded-lg bg-white border border-sky-200 text-sky-900 text-x font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-sky-200">
              {CURRENCY_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={() => setShowNewRequest(true)} disabled={!editable}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 border border-white/20 text-white text-x font-semibold hover:bg-white/20 transition-colors disabled:opacity-40">
              <FiPlus size={12} /> New Request
            </button>
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
      {limitInfo?.limit_exception && (
        <button onClick={() => setLimitDrawerOpen(true)} className="w-full text-left">
          <div className="flex items-center justify-between gap-3 px-4 py-1.5 rounded-xl bg-red-50 border border-red-200 hover:bg-red-100 transition-colors">
            <span className="text-x font-semibold text-red-700">
              CAPEX Limit Exception — Total Planned ({fmt(limitInfo.total_planned)}) exceeds the Annual CAPEX Limit ({fmt(limitInfo.capex_limit)})
            </span>
            <ExceptionBadge exception={limitInfo.limit_exception} onClick={() => setLimitDrawerOpen(true)} />
          </div>
        </button>
      )}
      <ExceptionSummaryStrip totalEvaluated={categories.length} summary={capexExceptions.summary}
        activeFilter={fStatus} onFilterChange={setFStatus} />
      <WorkflowProgress stage={stage} onAction={handleWorkflowAction} />

      {/* Budget Methodology (PRD §6) — same convention as Revenue/Workforce/Opex. */}
      {methodology === "Top-Down" ? (
        <>
          <TopDownTargetCard title="Capital Expenditure" baseline={capexBaseline} baselineLabel="Forecast Exit"
            growthPct={capexGrowthPct} growthLabel="vs. AI Baseline" target={capexTarget} icon={<FiPackage className="text-sky-600" size={16} />} />
          <TopDownAllocationTable dimensionLabel="Asset Category" target={capexTarget}
            rows={capexCategoryAllocationRows} adjustedByKey={capexAllocAdj}
            onAdjust={(key, value) => setCapexAllocAdj((prev) => ({ ...prev, [key]: value === "" ? "" : Number(value) }))} />
        </>
      ) : (
      <>
      {methodology === "Hybrid" && (
        <ReconciliationBanner target={capexTarget} actual={totals.user} label="Bottom-Up Total (Budgeted CAPEX)" />
      )}

      {/* Tabs — Summary / Drivers, same style as the fixed OpexBudgeting.jsx. */}
      <div className="flex items-center justify-between border-b-2 border-slate-200 mb-2 gap-2 flex-wrap">
        <div className="flex items-end gap-0.5">
          <button onClick={() => setCapexView("summary")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-s font-semibold whitespace-nowrap transition-all
              ${capexView === "summary"
                ? "bg-white text-sky-600 rounded-t-xl -mb-0.5 border-l border-t border-r border-slate-200 border-b-2 border-b-white shadow-sm"
                : "text-slate-500 hover:text-sky-700 hover:bg-white/60 rounded-t-xl"}`}>
            <FiList size={13} /> Summary
          </button>
          <button onClick={() => setCapexView("drivers")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-s font-semibold whitespace-nowrap transition-all
              ${capexView === "drivers"
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

      {/* Filter row — search/department/confidence, same sky palette
          as the fixed OpexBudgeting.jsx (matched to Revenue Forecast). */}
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
            title="Filters which capital projects are shown. The fixed-asset register has no department field, so this does not scope the AI baseline itself.">
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

      {filteredCategories.length === 0 ? <EmptyState label="No categories match the current filters." /> : capexView === "summary" ? (
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
                    <td className={`px-2 py-1 text-right text-xs font-bold tabular-nums border-r border-slate-300 ${user > ai ? "text-emerald-600" : user < ai ? "text-red-500" : "text-sky-700"}`}>{fmt(user)}</td>
                    {summaryPeriods.map((p) => {
                      const monthsInCol = monthsForColumn(p);
                      const pItems = c.items.filter((i) => monthsInCol.includes(i.period));
                      // A single directly-editable line only exists at
                      // Monthly grain — Quarterly/Annual columns always cover
                      // multiple months and go through the bucket-total
                      // redistribution path instead, same convention
                      // OpexBudgeting.jsx uses.
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
                              // Multiple lines in this column (several capital
                              // requests/baseline in one month, or a
                              // Quarterly/Annual bucket spanning several
                              // months) — editing the combined total
                              // distributes it back proportionally (see
                              // updateCategoryPeriodTotal/
                              // updateCategoryBucketTotal above).
                              <input type="number" value={agg.adjusted_total} disabled={!editable}
                                onChange={(e) => (frequency === "Monthly" ? updateCategoryPeriodTotal(c.key, p, e.target.value) : updateCategoryBucketTotal(c.key, p, e.target.value))}
                                title={`${pItems.length} line(s) across ${monthsInCol.length} month(s) — editing distributes proportionally`}
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
                        <ExceptionBadge exception={c.exception} onClick={() => setExceptionDrawerCat(c)} />
                      </div>
                    </td>
                    <td className="px-1.5 py-1 text-center border-l border-slate-100">
                      <button onClick={() => setReasonModal({ open: true, category: c, period: null })}
                        className={`relative flex items-center gap-1 px-1.5 py-1 rounded-md transition-all max-w-[115px] mx-auto ${anyReason ? "bg-sky-100 text-sky-700 border border-sky-200 hover:bg-sky-200" : "text-slate-300 hover:text-sky-500 hover:bg-sky-50 border border-transparent hover:border-sky-200"}`}
                        title={anyReason ? `${anyReason.override_reason}${anyReason.override_note ? ": " + anyReason.override_note : ""}` : "Add override reason for every item in this category"}>
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
                <td className="border-l border-sky-700/50"></td><td className="border-l border-sky-700"></td><td className="border-l border-sky-700"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      ) : (
      <>
      {/* AI Baseline — one row per category, months as a repeating Qty/AI Cost/
          Budget Cost column group, same horizontal layout convention Opex's
          Drivers view uses. Unlike Opex's driver lines, CAPEX has exactly one
          recurring baseline "driver" per category (the monthly AI forecast),
          so no per-driver grouping is needed — just index it by period. Real
          named capital requests don't repeat monthly (each belongs to one
          purchase period) and keep their own list below instead of being
          forced into this grid. */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible mb-4">
        <div className="flex items-center gap-1.5 px-4 pt-3 pb-2 text-sky-700 text-x">
          <FiLayers size={13} /> AI Baseline — Editing Quantity or Budget Cost here recalculates Budget Total instantly and stays in sync with the Summary view.
          {frequency !== "Monthly" && " Drivers always shows real months, regardless of Planning Frequency — switch to Summary for the " + frequency.toLowerCase() + " view."}
        </div>
        <div className="analytics-table-scroll relative overflow-x-auto max-h-[50vh] overflow-y-auto">
          <table className="relative w-full border-collapse text-sm" style={{ minWidth: `${370 + periods.length * 250}px` }}>
            <thead className="sticky top-0 z-20">
              <tr className="bg-sky-800 border-b border-sky-700">
                <th rowSpan={2} className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide border-r border-sky-700 sticky left-0 bg-sky-800 z-30 min-w-[220px]">Category</th>
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
              {filteredCategories.map((c, rowIdx) => {
                const baselineByPeriod = {};
                c.items.forEach((i) => { if (i.is_ai_seed) baselineByPeriod[i.period] = i; });
                const totalAi = periods.reduce((s, p) => s + (baselineByPeriod[p] ? baselineByPeriod[p].quantity * baselineByPeriod[p].ai_unit_cost : 0), 0);
                const totalBudget = periods.reduce((s, p) => s + (baselineByPeriod[p] ? baselineByPeriod[p].quantity * (Number(baselineByPeriod[p].adjusted_unit_cost) || 0) : 0), 0);
                const rowBg = rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/60";
                return (
                  <tr key={c.key} className={`rf-row border-b border-slate-200 transition-colors hover:bg-sky-50/50 ${rowBg}`}>
                    <td className={`px-3 py-1 sticky left-0 border-r border-slate-200 z-[5] ${rowBg}`}>
                      <span className="font-semibold text-slate-900 text-xs leading-tight">{c.name}</span>
                    </td>
                    <td className="px-2 py-1 text-right text-xs text-slate-500 tabular-nums border-r border-slate-100 bg-slate-50/60">{fmt(totalAi)}</td>
                    <td className={`px-2 py-1 text-right text-xs font-bold tabular-nums border-r border-slate-300 ${totalBudget > totalAi ? "text-emerald-600" : totalBudget < totalAi ? "text-red-500" : "text-sky-700"}`}>{fmt(totalBudget)}</td>
                    {periods.map((p) => {
                      const item = baselineByPeriod[p];
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
                            <input type="number" value={item.adjusted_unit_cost} disabled={!editable}
                              onChange={(e) => updateItemCost(c.key, item.id, e.target.value)}
                              className={`w-20 px-1 py-0.5 rounded-md border text-right tabular-nums text-xs outline-none transition-all
                                ${!editable ? "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200" :
                                  Number(item.adjusted_unit_cost) !== item.ai_unit_cost ? "border-sky-400 bg-sky-50 text-sky-900 focus:ring-2 ring-sky-100" :
                                  "border-slate-300 bg-white hover:border-slate-400 focus:border-sky-500 focus:ring-2 ring-sky-100"}`} />
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Capital Requests — real named projects, each tied to one specific
          purchase period rather than recurring monthly, so this stays its
          own vertical list (unchanged layout) instead of joining the
          horizontal AI Baseline grid above. Quantity is now shown/editable
          here too, matching Opex's Drivers view. */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
        <div className="px-4 pt-3 pb-1 text-xs font-semibold text-slate-600">Capital Requests</div>
        <div className="analytics-table-scroll relative overflow-x-auto max-h-[72vh] overflow-y-auto">
          <table className="relative w-full border-collapse text-sm min-w-[1550px]">
            <thead className="sticky top-0 z-20">
              <tr className="bg-sky-800 border-b border-sky-700">
                <th className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide sticky left-0 bg-sky-800 z-30 min-w-[220px] border-r border-sky-700">Project</th>
                <th className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide min-w-[90px] border-r border-sky-700">Period</th>
                <th className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide min-w-[110px] border-r border-sky-700">Department</th>
                <th className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide min-w-[110px] border-r border-sky-700">Vendor</th>
                <th className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide min-w-[100px] border-r border-sky-700">In-Service</th>
                <th className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide min-w-[75px] border-r border-sky-700">Life (yrs)</th>
                <th className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide min-w-[75px] border-r border-sky-700">Quantity</th>
                <th className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide min-w-[110px] border-r border-sky-700">AI Cost</th>
                <th className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide min-w-[110px] border-r border-sky-700">Budget Cost</th>
                <th className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide min-w-[70px] border-r border-sky-700">ROI</th>
                <th className="px-3 py-1.5 text-right text-xs font-semibold text-white uppercase tracking-wide min-w-[85px] border-r border-sky-700">Payback</th>
                <th className="px-3 py-1.5 text-left text-xs font-semibold text-white uppercase tracking-wide min-w-[110px] border-r border-sky-700">Status</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredCategories.map((c) => {
                const projects = c.items.filter((i) => !i.is_ai_seed);
                return (
                  <React.Fragment key={c.key}>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <td colSpan={13} className="px-3 py-1 text-xs font-bold text-slate-700 uppercase tracking-wide sticky left-0 bg-slate-100 z-[5]">{c.name}</td>
                    </tr>
                    {projects.length === 0 ? (
                      <tr className="border-b border-slate-200">
                        <td colSpan={13} className="px-3 py-1.5 text-xs text-slate-300 italic sticky left-0 bg-white z-[4]">No capital requests yet for this category.</td>
                      </tr>
                    ) : projects.map((i) => {
                      const dept = meta.departments.find((d) => d.id === i.department_id);
                      const variance = (Number(i.adjusted_unit_cost) || 0) - i.ai_unit_cost;
                      return (
                        <tr key={i.id} className="rf-row border-b border-slate-200 last:border-b-0 hover:bg-sky-50/40 align-top">
                          <td className="px-3 py-1.5 sticky left-0 bg-white z-[4] border-r border-slate-200">
                            <div className="flex items-start gap-1.5">
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-900">{i.project_name}</div>
                                {i.justification && <div className="text-xs text-slate-400 leading-snug mt-0.5 max-w-[220px]">{i.justification}</div>}
                              </div>
                              <ExplainPopover reasons={i.reasons?.length ? i.reasons : c.reasons} confidence={i.confidence || c.confidence} label={`${i.project_name} — AI Reasoning`} />
                              <ExceptionBadge exception={i.exception} onClick={() => setExceptionDrawerItem({ ...i, category_name: c.name })} />
                            </div>
                          </td>
                          <td className="px-3 py-1.5 text-left tabular-nums text-xs text-slate-500 border-r border-slate-100">{i.period}</td>
                          <td className="px-3 py-1.5 text-xs text-slate-600 border-r border-slate-100">{dept?.name || "—"}</td>
                          <td className="px-3 py-1.5 text-xs text-slate-600 border-r border-slate-100">{i.vendor || "—"}</td>
                          <td className="px-3 py-1.5 text-xs text-slate-600 whitespace-nowrap border-r border-slate-100">{i.in_service_period || "—"}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-xs text-slate-500 border-r border-slate-300">{i.useful_life_years}</td>
                          <td className="px-1.5 py-1.5 border-r border-slate-100">
                            <input type="number" value={i.quantity} disabled={!editable}
                              onChange={(e) => updateItemQuantity(c.key, i.id, e.target.value)}
                              className={`w-16 px-1.5 py-0.5 rounded-md border text-right tabular-nums text-xs outline-none transition-all
                                ${!editable ? "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200" :
                                  "border-slate-300 bg-white hover:border-slate-400 focus:border-sky-500 focus:ring-2 ring-sky-100"}`} />
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-xs text-slate-500 border-r border-slate-100">{fmt(i.ai_unit_cost)}</td>
                          <td className="px-1.5 py-1.5 border-r border-slate-100">
                            <input type="number" value={i.adjusted_unit_cost} disabled={!editable}
                              onChange={(e) => updateItemCost(c.key, i.id, e.target.value)}
                              className={`w-24 px-1.5 py-0.5 rounded-md border text-right tabular-nums text-xs outline-none transition-all
                                ${!editable ? "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200" :
                                  variance !== 0 ? "border-sky-400 bg-sky-50 text-sky-900 focus:ring-2 ring-sky-100" :
                                  "border-slate-300 bg-white hover:border-slate-400 focus:border-sky-500 focus:ring-2 ring-sky-100"}`} />
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-xs text-slate-600 border-r border-slate-100">{fmtPct(i.roi_percent)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-xs text-slate-600 whitespace-nowrap border-r border-slate-100">{i.payback_period_years ? `${i.payback_period_years} yrs` : "—"}</td>
                          <td className="px-3 py-1.5 border-r border-slate-100">
                            {editable ? (
                              <select value={i.status} onChange={(e) => updateItemStatus(c.key, i.id, e.target.value)}
                                className="px-1.5 py-1 rounded-md border border-slate-200 text-xs outline-none focus:border-sky-500 bg-white">
                                {["Draft", "Pending", "Approved", "Rejected"].map((s) => <option key={s} value={s}>{s}</option>)}
                              </select>
                            ) : <StatusPill status={i.status} />}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            {editable && (
                              <button onClick={() => removeRequest(i.id)} title="Remove capital request"
                                className="text-slate-300 hover:text-red-500 transition-colors">
                                <FiTrash2 size={12} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}
      </>
      )}
    </div>
  );
};

function NewRequestModal({ categories, periods, departments, onClose, onCreate }) {
  const [form, setForm] = useState({
    project: "", category: categories[0] || "", period: periods[0] || "", departmentId: "", vendor: "",
    inService: "", usefulLife: 5, quantity: 1, unitCost: 0, justification: "",
  });
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-[560px] shadow-2xl border border-slate-200 overflow-hidden max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200">
          <h3 className="font-bold text-slate-900 text-s">New Capital Request</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"><FiX size={13} /></button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3 overflow-y-auto">
          <label className="col-span-2 text-x font-semibold text-slate-600">Project Name
            <input value={form.project} onChange={set("project")} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-s outline-none focus:border-sky-500 focus:ring-2 ring-sky-100" />
          </label>
          <label className="text-x font-semibold text-slate-600">Asset Category
            <select value={form.category} onChange={set("category")} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-s outline-none focus:border-sky-500 focus:ring-2 ring-sky-100">
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="text-x font-semibold text-slate-600">Purchase Period
            <select value={form.period} onChange={set("period")} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-s outline-none focus:border-sky-500 focus:ring-2 ring-sky-100">
              {periods.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label className="text-x font-semibold text-slate-600">Department
            <select value={form.departmentId} onChange={set("departmentId")} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-s outline-none focus:border-sky-500 focus:ring-2 ring-sky-100">
              <option value="">—</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className="text-x font-semibold text-slate-600">Vendor
            <input value={form.vendor} onChange={set("vendor")} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-s outline-none focus:border-sky-500 focus:ring-2 ring-sky-100" />
          </label>
          <label className="text-x font-semibold text-slate-600">In-Service Period
            <input placeholder="e.g. 2026-04" value={form.inService} onChange={set("inService")} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-s outline-none focus:border-sky-500 focus:ring-2 ring-sky-100" />
          </label>
          <label className="text-x font-semibold text-slate-600">Useful Life (yrs)
            <input type="number" value={form.usefulLife} onChange={set("usefulLife")} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-s outline-none focus:border-sky-500 focus:ring-2 ring-sky-100" />
          </label>
          <label className="text-x font-semibold text-slate-600">Quantity
            <input type="number" value={form.quantity} onChange={set("quantity")} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-s outline-none focus:border-sky-500 focus:ring-2 ring-sky-100" />
          </label>
          <label className="text-x font-semibold text-slate-600">Estimated Cost ($)
            <input type="number" value={form.unitCost} onChange={set("unitCost")} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-s outline-none focus:border-sky-500 focus:ring-2 ring-sky-100" />
          </label>
          <label className="col-span-2 text-x font-semibold text-slate-600">Business Justification
            <textarea rows={2} value={form.justification} onChange={set("justification")} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-s outline-none resize-none focus:border-sky-500 focus:ring-2 ring-sky-100" />
          </label>
        </div>
        <div className="flex gap-3 justify-end px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-s font-semibold">Cancel</button>
          <button onClick={() => form.project.trim() && form.category && form.period && onCreate(form)} disabled={!form.project.trim() || !form.category || !form.period}
            className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-s font-semibold">Add Request</button>
        </div>
      </div>
    </div>
  );
}

export default CapexBudgeting;
