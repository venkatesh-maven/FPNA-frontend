import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "react-toastify";
import { FiCloud, FiEdit2, FiFilter, FiFolder, FiGrid, FiRefreshCw, FiSave, FiTrash2 } from "react-icons/fi";
import AppButton from "../../../components/ui/AppButton";
import AppCard from "../../../components/ui/AppCard";
import AppSelect from "../../../components/ui/AppSelect";
import { API_BASE_URL } from "../../../config/config";
import { AuthContext } from "../../../context/AuthContext";
import { useCustomReportSavedViewsContext } from "../../../context/CustomReportSavedViewsContext";
import TableSkeleton from "../../Skeleton/TableSkeleton";
import { cachedFetch } from "../../../utils/reportCache";
import { BsChatLeftText, BsChatLeftTextFill } from "react-icons/bs";
import ReportsLayout from "../ReportsLayout";
import AddAutomation from "../AddAutomation";
import ActionHoverLabel from "../ActionHoverLabel";
import AIActionsMenu from "../AIActionsMenu";
import ExportMenu from "../ExportMenu";
import { collectCommentary, commentaryCount, commentaryRows } from "../reportExport";
import AIHelpTooltip from "../AIHelpTooltip";
import LineItemCommentary from "../LineItemCommentary";
import LineItemRefineWithAI, { LineItemAIButton } from "../LineItemRefineWithAI";
import ReportCommentary from "../ReportCommentary";
import useReportCommentary from "../../../hooks/useReportCommentary";
import useLineItemCommentary from "../../../hooks/useLineItemCommentary";
import {
  buildCustomReportContext,
  buildCustomRowContext,
  buildNodeInsights,
  customReportQuestions,
  indexHierarchy,
  nodeKey,
  nodeLabel,
} from "./financialCustomReportInsights";
import { aggregateRows, attachShareMetrics, buildHierarchy, computeTotals, sortHierarchyNodes } from "./financialCustomReportAggregate";
import { FINANCIAL_CUSTOM_REPORT_FIELD_DEFS } from "./financialCustomReportFields";
import { defaultDriversFor } from "./financialCustomReportMetricDrivers";
import {
  attachComparison,
  filterBudgetRowsToWindow,
  getComparisonRows,
  getCurrentWindow,
  isBudgetComparisonAvailable,
  isForecastComparisonAvailable,
  mapBudgetRowsToMetricShape,
} from "./financialCustomReportCompare";
import GroupByStep from "./builder/GroupByStep";
import WhatToShowStep from "./builder/WhatToShowStep";
import DisplayByStep, { DISPLAY_BY_OPTIONS } from "./builder/DisplayByStep";
import CompareWithStep from "./builder/CompareWithStep";
import MyReportsPanel from "./builder/MyReportsPanel";
import HierarchyTable from "./builder/HierarchyTable";
import PostGenerationControls from "./builder/PostGenerationControls";

const FIELD_LABEL = Object.fromEntries(FINANCIAL_CUSTOM_REPORT_FIELD_DEFS.map((f) => [f.field, f.label]));
const FIELD_FORMAT = Object.fromEntries(FINANCIAL_CUSTOM_REPORT_FIELD_DEFS.map((f) => [f.field, f.format || "currency"]));

// Month is no longer a filterable/groupable field on its own — Display By
// now owns "how time is presented" (DisplayByStep.jsx), so it's dropped
// from the filter list along with the old flat-dimension checkbox panel.
const FILTER_KEYS = [
  { key: "Entity", plural: "Entities" },
  { key: "Department", plural: "Departments" },
  { key: "CostCenter", label: "Cost Center", plural: "Cost Centers" },
  { key: "Category", plural: "Categories" },
  { key: "Customer", plural: "Customers" },
  { key: "Product", plural: "Products" },
];
const DEFAULT_FILTERS = FILTER_KEYS.reduce((acc, f) => ({ ...acc, [f.key]: "All" }), {});

const CURRENCY = "USD";
const DEFAULT_DIMENSIONS = ["Department"];
const DEFAULT_PRIMARY_METRIC = "Revenue";

// Icon-only toolbar button, same look as the P&L report's toolbar. Pair it
// with an aria-label and an ActionHoverLabel for the name.
const ICON_BUTTON_CLASS =
  "relative group flex items-center px-3 py-2.5 text-x bg-sky-100 text-sky-800 rounded-lg border border-sky-200 hover:bg-sky-200 disabled:opacity-50 disabled:cursor-not-allowed";

function applyFilters(rows, filters) {
  return rows.filter((row) => {
    for (const { key } of FILTER_KEYS) {
      if (filters[key] !== "All" && row[key] !== filters[key]) return false;
    }
    return true;
  });
}

// ReportsLayout is what actually creates CustomReportSavedViewsProvider (so
// it can also share it with ReportSidebar) — this component must be
// rendered AS ReportsLayout's children, not wrap ReportsLayout itself,
// otherwise useCustomReportSavedViewsContext() below would run before the
// Provider exists in the tree and throw on every render.
export default function FinancialCustomReportBuilder() {
  return (
    <ReportsLayout>
      <CustomReportBuilderContent />
    </ReportsLayout>
  );
}

function CustomReportBuilderContent() {
  const fetchSeqRef = useRef(0);
  const { token, selectedYear } = useContext(AuthContext);
  const { savedViews, saveView, updateView, deleteView, publishView, pinView } = useCustomReportSavedViewsContext();
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [priorYearRows, setPriorYearRows] = useState([]);
  const [budgetRows, setBudgetRows] = useState([]);
  const [forecastRows, setForecastRows] = useState([]);
  const [availableScenarios, setAvailableScenarios] = useState([]);

  const [selectedDimensions, setSelectedDimensions] = useState(DEFAULT_DIMENSIONS);
  const [primaryMetric, setPrimaryMetric] = useState(DEFAULT_PRIMARY_METRIC);
  const [selectedDrivers, setSelectedDrivers] = useState(() => defaultDriversFor(DEFAULT_PRIMARY_METRIC));
  const [aggFunc, setAggFunc] = useState("sum");
  const [displayBy, setDisplayBy] = useState("month");
  const [compareWith, setCompareWith] = useState("none");
  const [scenario, setScenario] = useState("baseline");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  // What to Show pathway: "standard" (governed Primary Metric + drivers) or
  // "gl_account" (raw chart-of-accounts rows) — a second pathway, not one
  // more checkbox in the same list (see WhatToShowStep.jsx).
  const [pathway, setPathway] = useState("standard");
  const [glAccounts, setGlAccounts] = useState([]);
  const [glAccountsLoading, setGlAccountsLoading] = useState(false);
  const [selectedGLAccountIds, setSelectedGLAccountIds] = useState([]);
  const [glAccountSearch, setGlAccountSearch] = useState("");

  // Post-generation report controls (spec section 7).
  const [topBottom, setTopBottom] = useState("none");
  const [showPercentOfTotal, setShowPercentOfTotal] = useState(false);
  const [exceptionsEnabled, setExceptionsEnabled] = useState(false);
  const [exceptionsThreshold, setExceptionsThreshold] = useState(10);
  const [conditionalFormattingEnabled, setConditionalFormattingEnabled] = useState(false);
  const [cfDirection, setCfDirection] = useState("above");
  const [cfThreshold, setCfThreshold] = useState(0);
  const [viewNameInput, setViewNameInput] = useState("");
  const [selectedSavedView, setSelectedSavedView] = useState("");
  // "view" = a locked, standard-report-style layout for a saved report
  // (opened from the sidebar or My Reports) — the 4-step builder is
  // hidden, only "Edit Selections" brings it back. "edit" is the
  // free-form builder. Fresh visits (no ?view= deep link) start in edit
  // mode, same as before this existed.
  const [mode, setMode] = useState("edit");
  const activeView = useMemo(
    () => savedViews.find((v) => v.id === selectedSavedView) || null,
    [savedViews, selectedSavedView]
  );

  const fetchData = useCallback(async () => {
    if (!token || !selectedYear) return;
    const seq = ++fetchSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const glParam =
        pathway === "gl_account" && selectedGLAccountIds.length > 0
          ? `?gl_account_ids=${selectedGLAccountIds.map(encodeURIComponent).join(",")}`
          : "";
      const url = `${API_BASE_URL}/api/v1/company/financial/custom_report/${selectedYear}/${CURRENCY}${glParam}`;
      const data = await cachedFetch(url, {
        headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
      });
      if (seq !== fetchSeqRef.current) return;
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      if (seq !== fetchSeqRef.current) return;
      console.error(e);
      setError("Couldn't load report data. Please try again.");
      setRows([]);
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }, [token, selectedYear, pathway, selectedGLAccountIds]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // GL Account Analysis pathway: the searchable account list, fetched once
  // per year (cached), not re-fetched as the user checks/unchecks accounts.
  useEffect(() => {
    if (pathway !== "gl_account" || !token || !selectedYear) return;
    let cancelled = false;
    setGlAccountsLoading(true);
    const url = `${API_BASE_URL}/api/v1/company/financial/custom_report/gl_accounts/${selectedYear}`;
    cachedFetch(url, { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } })
      .then((data) => {
        if (!cancelled) setGlAccounts(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setGlAccounts([]);
      })
      .finally(() => {
        if (!cancelled) setGlAccountsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pathway, token, selectedYear]);

  // Forecast rows, only fetched when Compare With -> Forecast/Scenario is
  // selected — refetches when the chosen scenario changes.
  useEffect(() => {
    if (compareWith !== "forecast" || !token || !selectedYear) return;
    let cancelled = false;
    const url = `${API_BASE_URL}/api/v1/company/financial/custom_report/forecast/${selectedYear}/${CURRENCY}?scenario=${encodeURIComponent(scenario)}`;
    cachedFetch(url, { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } })
      .then((data) => {
        if (!cancelled) setForecastRows(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setForecastRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [compareWith, scenario, token, selectedYear]);

  // Available scenario names (system + any custom scenarios created in
  // Scenario Modeling) to populate the Compare With -> Forecast scenario
  // picker — same endpoint that screen itself uses.
  useEffect(() => {
    if (compareWith !== "forecast" || !token || !selectedYear) return;
    let cancelled = false;
    const url = `${API_BASE_URL}/api/v1/forecasting/managemet/scenario-modeling/${selectedYear}/available-scenarios`;
    fetch(url, { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } })
      .then((res) => (res.ok ? res.json() : { scenarios: [] }))
      .then((data) => {
        if (cancelled) return;
        const names = Array.isArray(data.scenarios) ? data.scenarios : [];
        setAvailableScenarios(names.map((n) => ({ value: n, label: n })));
      })
      .catch(() => {
        if (!cancelled) setAvailableScenarios([]);
      });
    return () => {
      cancelled = true;
    };
  }, [compareWith, token, selectedYear]);

  // Prior-year raw rows — needed when a period/year comparison is selected
  // (Prior Period can spill into these too, e.g. comparing January against
  // the prior December) and also for Display By -> Rolling 12 Months, whose
  // trailing window can reach back past the fetched fiscal year.
  const needsPriorYear = compareWith === "prior_period" || compareWith === "prior_year" || displayBy === "rolling_12";
  useEffect(() => {
    if (!needsPriorYear || !token || !selectedYear) return;
    let cancelled = false;
    const url = `${API_BASE_URL}/api/v1/company/financial/custom_report/${selectedYear - 1}/${CURRENCY}`;
    cachedFetch(url, { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } })
      .then((data) => {
        if (!cancelled) setPriorYearRows(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setPriorYearRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [needsPriorYear, token, selectedYear]);

  // Budget rows, only fetched when Compare With -> Budget is selected.
  useEffect(() => {
    if (compareWith !== "budget" || !token || !selectedYear) return;
    let cancelled = false;
    const url = `${API_BASE_URL}/api/v1/company/financial/custom_report/budget/${selectedYear}/${CURRENCY}`;
    cachedFetch(url, { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } })
      .then((data) => {
        if (!cancelled) setBudgetRows(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setBudgetRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [compareWith, token, selectedYear]);

  const toggleDimension = useCallback((field) => {
    setSelectedDimensions((prev) => {
      if (prev.includes(field)) return prev.filter((f) => f !== field);
      if (prev.length >= 3) return prev;
      return [...prev, field];
    });
  }, []);

  // Switching Primary Metric resets driver selection to that metric's
  // defaults (mirrors the spec's mockups showing pre-checked drivers).
  const handlePrimaryMetricChange = useCallback((field) => {
    setPrimaryMetric(field);
    setSelectedDrivers(defaultDriversFor(field));
  }, []);

  const toggleDriver = useCallback((field) => {
    setSelectedDrivers((prev) => (prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]));
  }, []);

  const handlePathwayChange = useCallback((next) => {
    setPathway(next);
    setSelectedGLAccountIds([]);
    setGlAccountSearch("");
  }, []);

  const toggleGLAccount = useCallback((accountId) => {
    setSelectedGLAccountIds((prev) => (prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId]));
  }, []);

  // The report's actual primary metric — "Amount" (scoped to the selected
  // GL accounts) in the GL Account Analysis pathway, otherwise the Standard
  // Financial Metrics step's Primary Metric. Everything downstream (Compare
  // With availability, sorting default, % of Total, conditional
  // formatting) reasons about this, not the raw `primaryMetric` state,
  // which the GL pathway doesn't use.
  const effectivePrimaryMetric = pathway === "gl_account" ? "Amount" : primaryMetric;

  // If a Group By/metric/pathway change makes Budget or Forecast no longer
  // joinable, fall back to No Comparison instead of silently keeping a
  // comparison that can't be computed correctly for the new selection.
  useEffect(() => {
    if (compareWith === "budget" && !isBudgetComparisonAvailable(selectedDimensions, effectivePrimaryMetric)) {
      setCompareWith("none");
    }
    if (compareWith === "forecast" && !isForecastComparisonAvailable(effectivePrimaryMetric)) {
      setCompareWith("none");
    }
  }, [compareWith, selectedDimensions, effectivePrimaryMetric]);

  // Only offer filters for fields actually used as the report's grouping —
  // filtering by a dimension that isn't even shown would let a user hide
  // data with no visible column explaining why.
  const activeFilterKeys = useMemo(
    () => FILTER_KEYS.filter(({ key }) => selectedDimensions.includes(key)),
    [selectedDimensions]
  );

  const filterOptions = useMemo(() => {
    const opts = {};
    activeFilterKeys.forEach(({ key }) => {
      opts[key] = [...new Set(rows.map((r) => r[key]).filter(Boolean))].sort();
    });
    return opts;
  }, [rows, activeFilterKeys]);

  // Drop any applied filter whose dimension just got unchecked.
  useEffect(() => {
    const activeKeys = new Set(activeFilterKeys.map((f) => f.key));
    setFilters((prev) => {
      let changed = false;
      const next = { ...prev };
      FILTER_KEYS.forEach(({ key }) => {
        if (!activeKeys.has(key) && next[key] !== "All") {
          next[key] = "All";
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [activeFilterKeys]);

  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const filterPanelRef = useRef(null);

  useEffect(() => {
    const closeOnOutsideClick = (e) => {
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target)) {
        setFilterPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const hasPendingFilterChanges = useMemo(
    () => JSON.stringify(draftFilters) !== JSON.stringify(filters),
    [draftFilters, filters]
  );

  const activeFilterTags = useMemo(
    () => activeFilterKeys.filter(({ key }) => filters[key] !== "All").map(({ key, label }) => ({ key, label: label || key, value: filters[key] })),
    [filters, activeFilterKeys]
  );

  const handleOpenFilterPanel = useCallback(() => {
    setDraftFilters(filters);
    setFilterPanelOpen((prev) => !prev);
  }, [filters]);

  const handleDraftFilterChange = useCallback((key, value) => {
    setDraftFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleApplyFilters = useCallback(() => {
    setFilters(draftFilters);
    setFilterPanelOpen(false);
  }, [draftFilters]);

  const handleResetAllFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setDraftFilters(DEFAULT_FILTERS);
    setFilterPanelOpen(false);
  }, []);

  const handleRemoveFilterTag = useCallback((key) => {
    setFilters((prev) => ({ ...prev, [key]: "All" }));
    setDraftFilters((prev) => ({ ...prev, [key]: "All" }));
  }, []);

  const metricFields = useMemo(() => {
    if (pathway === "gl_account") return ["Amount"];
    const list = [];
    if (primaryMetric) list.push(primaryMetric);
    selectedDrivers.forEach((d) => {
      if (!list.includes(d)) list.push(d);
    });
    return list;
  }, [pathway, primaryMetric, selectedDrivers]);

  // In the GL Account pathway, the "Amount" column is scoped to whichever
  // account(s) are selected — label it with their name(s) instead of the
  // generic "Amount (All Categories)" so the column header actually says
  // what it's showing.
  const glAccountAmountLabel = useMemo(() => {
    if (selectedGLAccountIds.length === 0) return FIELD_LABEL.Amount;
    if (selectedGLAccountIds.length === 1) {
      const acct = glAccounts.find((a) => a.account_id === selectedGLAccountIds[0]);
      return acct ? acct.account_name : FIELD_LABEL.Amount;
    }
    return `Amount (${selectedGLAccountIds.length} accounts)`;
  }, [selectedGLAccountIds, glAccounts]);

  const metricColumns = useMemo(
    () =>
      metricFields.map((f) => ({
        field: f,
        label: pathway === "gl_account" && f === "Amount" ? glAccountAmountLabel : FIELD_LABEL[f] || f,
        format: FIELD_FORMAT[f] || "currency",
      })),
    [metricFields, pathway, glAccountAmountLabel]
  );

  const isValidConfig =
    selectedDimensions.length > 0 && (pathway === "gl_account" ? selectedGLAccountIds.length > 0 : !!primaryMetric);

  const filteredRows = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const priorYearFilteredRows = useMemo(() => applyFilters(priorYearRows, filters), [priorYearRows, filters]);

  // Only pivot into one column per month when there's a single metric
  // column (no drivers) and no comparison is active — combining a full
  // month-by-month breakdown with driver columns or Compare With columns
  // at once is out of scope for Phase 1 (see plan). In every other case,
  // Display By instead scopes *which* rows are included (see getCurrentWindow).
  const isMonthPivot = displayBy === "month" && metricFields.length === 1 && compareWith === "none";

  const { rows: windowRows, windowStart, windowEnd } = useMemo(
    () => getCurrentWindow(displayBy, filteredRows, priorYearFilteredRows),
    [displayBy, filteredRows, priorYearFilteredRows]
  );

  const hierarchyBaseRows = isMonthPivot ? filteredRows : windowRows;

  const sharedRows = useMemo(
    () => (isValidConfig ? attachShareMetrics(hierarchyBaseRows, metricFields) : hierarchyBaseRows),
    [hierarchyBaseRows, metricFields, isValidConfig]
  );

  const hierarchy = useMemo(() => {
    if (!isValidConfig) return [];
    return buildHierarchy(sharedRows, selectedDimensions, metricFields, aggFunc);
  }, [sharedRows, selectedDimensions, metricFields, aggFunc, isValidConfig]);

  const compareRowsFinal = useMemo(() => {
    if (!isValidConfig || compareWith === "none") return [];
    if (compareWith === "budget") {
      const mapped = mapBudgetRowsToMetricShape(budgetRows);
      const windowed = filterBudgetRowsToWindow(mapped, windowStart, windowEnd);
      return applyFilters(windowed, filters);
    }
    if (compareWith === "forecast") {
      // No Entity/Department/etc. fields on forecast rows at all, so
      // attachComparison's per-group join naturally finds nothing for any
      // leaf node — only the Grand Total (computed directly from this row
      // set below, not via the hierarchy join) shows a real number. No
      // `applyFilters` here either, for the same reason: forecast rows
      // don't carry the fields those filters check.
      return filterBudgetRowsToWindow(forecastRows, windowStart, windowEnd);
    }
    return getComparisonRows(compareWith, windowStart, windowEnd, filteredRows, priorYearFilteredRows);
  }, [isValidConfig, compareWith, budgetRows, forecastRows, windowStart, windowEnd, filteredRows, priorYearFilteredRows, filters]);

  const hierarchyWithCompare = useMemo(() => {
    if (compareWith === "none" || hierarchy.length === 0) return hierarchy;
    return attachComparison(hierarchy, compareRowsFinal, selectedDimensions, metricFields, aggFunc);
  }, [hierarchy, compareRowsFinal, compareWith, selectedDimensions, metricFields, aggFunc]);

  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const handleSort = useCallback((key) => {
    setSortConfig((prev) => (prev.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }));
  }, []);

  const sortedHierarchy = useMemo(() => {
    if (!sortConfig.key || isMonthPivot) return hierarchyWithCompare;
    return sortHierarchyNodes(hierarchyWithCompare, sortConfig.key, sortConfig.direction);
  }, [hierarchyWithCompare, sortConfig, isMonthPivot]);

  const periods = useMemo(
    () => (isMonthPivot ? [...new Set(filteredRows.map((r) => r.Month))].filter(Boolean).sort() : []),
    [isMonthPivot, filteredRows]
  );

  const grandTotal = useMemo(() => {
    if (!isValidConfig) return null;
    const metrics = computeTotals(hierarchyBaseRows, metricFields, aggFunc);
    if (isMonthPivot) {
      const monthValues = {};
      periods.forEach((p) => {
        const inMonth = filteredRows.filter((r) => r.Month === p);
        monthValues[p] = inMonth.length ? computeTotals(inMonth, [metricFields[0]], "sum")[metricFields[0]] : 0;
      });
      return { metrics, monthValues };
    }
    if (compareWith !== "none") {
      // No comparison rows at all (e.g. no prior-year GL data exists yet)
      // should read as "no data" (—), matching what every individual row
      // already shows via a null lookup — not a misleading "$0.00", which
      // computeTotals would otherwise return for a zero-row input.
      if (compareRowsFinal.length === 0) {
        return { metrics, compare: null, variance: null, variancePercent: null };
      }
      const compare = computeTotals(compareRowsFinal, metricFields, aggFunc);
      const variance = {};
      const variancePercent = {};
      metricFields.forEach((m) => {
        variance[m] = (metrics[m] || 0) - (compare[m] || 0);
        variancePercent[m] = compare[m] ? ((metrics[m] - compare[m]) / Math.abs(compare[m])) * 100 : null;
      });
      return { metrics, compare, variance, variancePercent };
    }
    return { metrics };
  }, [isValidConfig, hierarchyBaseRows, metricFields, aggFunc, isMonthPivot, periods, filteredRows, compareWith, compareRowsFinal]);

  const compareLabel =
    compareWith === "budget"
      ? "Budget"
      : compareWith === "forecast"
      ? "Forecast"
      : compareWith === "prior_year"
      ? "Prior Year"
      : compareWith === "prior_period"
      ? "Prior Period"
      : "";

  // Top/Bottom N and Exceptions both operate on the top-level hierarchy
  // rows (post-generation controls, spec section 7) — applied after
  // sorting so the user's explicit column sort still governs order within
  // a Top/Bottom slice.
  const displayHierarchy = useMemo(() => {
    let nodes = sortedHierarchy;
    if (topBottom !== "none") {
      const n = topBottom.includes("5") ? 5 : 10;
      const dir = topBottom.startsWith("top") ? -1 : 1;
      nodes = [...nodes]
        .sort((a, b) => (Number(a.metrics[metricFields[0]]) - Number(b.metrics[metricFields[0]])) * dir)
        .slice(0, n);
    }
    if (exceptionsEnabled && compareWith !== "none") {
      nodes = nodes.filter((node) => {
        const vp = node.variancePercent?.[metricFields[0]];
        return vp != null && Math.abs(vp) >= exceptionsThreshold;
      });
    }
    return nodes;
  }, [sortedHierarchy, topBottom, exceptionsEnabled, compareWith, exceptionsThreshold, metricFields]);

  const percentOfTotalBase = grandTotal?.metrics?.[metricFields[0]] || 0;

  // `withCommentary` = the commentary to append below the data (collectCommentary), or null.
  const handleExportCsv = useCallback((withCommentary = null) => {
    const flatRows = aggregateRows(hierarchyBaseRows, selectedDimensions, metricFields, aggFunc);
    const columns = [...selectedDimensions, ...metricFields];
    const csvEscape = (value) => {
      const s = String(value ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [columns.map((f) => FIELD_LABEL[f] || f).map(csvEscape).join(",")];
    flatRows.forEach((row) => {
      lines.push(columns.map((f) => csvEscape(row[f])).join(","));
    });
    if (grandTotal) {
      const totalRow = [...selectedDimensions.map((f, idx) => (idx === 0 ? "Grand Total" : "")), ...metricFields.map((f) => grandTotal.metrics[f])];
      lines.push(totalRow.map(csvEscape).join(","));
    }
    if (withCommentary) {
      const extra = commentaryRows(withCommentary);
      if (extra.length) lines.push("", ...extra.map((r) => r.map(csvEscape).join(",")));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "financial-custom-report.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }, [hierarchyBaseRows, selectedDimensions, metricFields, aggFunc, grandTotal]);

  // ?view=<id> is kept as the persistent source of truth for "which saved
  // report is currently open" — see the sidebar/URL-sync effect below.
  const appliedViewIdRef = useRef(undefined);

  const applyView = useCallback((view) => {
    if (view) {
      // Pre-redesign saved views could have "Month" as a Group By
      // dimension (it was just another checkbox back then) — Display By
      // owns that role now, so drop it here rather than leaving a
      // dimension the new Group By step can't show a chip for.
      setSelectedDimensions((view.dimensions || []).filter((d) => d !== "Month"));
      // Pre-redesign saved views could also have the old, differently-
      // defined "Rate" metric (row's Volume share, not a price) — map it to
      // its closest replacement so an old view still renders a real number
      // instead of a column of zeros against today's row shape.
      const migratedMetrics = (view.metrics || []).map((m) => (m === "Rate" ? "RatePrice" : m));
      const [first, ...rest] = migratedMetrics;
      const hasGLAccounts = (view.gl_account_ids || []).length > 0;
      setPathway(hasGLAccounts ? "gl_account" : "standard");
      setSelectedGLAccountIds(view.gl_account_ids || []);
      setPrimaryMetric(hasGLAccounts ? DEFAULT_PRIMARY_METRIC : first || DEFAULT_PRIMARY_METRIC);
      setSelectedDrivers(hasGLAccounts ? [] : rest);
      setAggFunc(view.agg_func || "sum");
      setFilters({ ...DEFAULT_FILTERS, ...(view.filters || {}) });
      setDisplayBy(view.display_by || "month");
      setCompareWith(view.compare_with || "none");
      setScenario("baseline");
      setSelectedSavedView(view.id);
      setMode("view");
    } else {
      setPathway("standard");
      setSelectedGLAccountIds([]);
      setGlAccountSearch("");
      setSelectedDimensions(DEFAULT_DIMENSIONS);
      setPrimaryMetric(DEFAULT_PRIMARY_METRIC);
      setSelectedDrivers(defaultDriversFor(DEFAULT_PRIMARY_METRIC));
      setAggFunc("sum");
      setFilters(DEFAULT_FILTERS);
      setDisplayBy("month");
      setCompareWith("none");
      setScenario("baseline");
      setSelectedSavedView("");
      setMode("edit");
    }
  }, []);

  const selectView = useCallback(
    (view) => {
      appliedViewIdRef.current = view ? view.id : "";
      applyView(view);
      setSearchParams(view ? { view: view.id } : {}, { replace: true });
    },
    [applyView, setSearchParams]
  );

  const isUpdatingActiveView = !viewNameInput.trim() && !!selectedSavedView;

  const [saveVisibilityModalOpen, setSaveVisibilityModalOpen] = useState(false);
  const [pendingVisibility, setPendingVisibility] = useState("only_me");

  const handleOpenSaveVisibilityModal = useCallback(() => {
    setPendingVisibility(isUpdatingActiveView ? activeView?.visibility || "only_me" : "only_me");
    setSaveVisibilityModalOpen(true);
  }, [isUpdatingActiveView, activeView]);

  const handleSaveView = useCallback(
    async (visibility) => {
      const name = viewNameInput.trim();
      const updating = !name && !!selectedSavedView;
      if (!name && !selectedSavedView) return;

      const statePayload = {
        selectedDimensions,
        selectedMetrics: metricFields,
        aggFunc,
        filters,
        displayBy,
        compareWith,
        glAccountIds: pathway === "gl_account" ? selectedGLAccountIds : [],
      };

      const run = async () => {
        if (updating) {
          const updated = await updateView(selectedSavedView, activeView?.name || "", statePayload, visibility);
          selectView(updated);
          return updated;
        }
        const created = await saveView(name, statePayload, visibility);
        setViewNameInput("");
        selectView(created);
        return created;
      };

      try {
        await toast.promise(run(), {
          pending: updating ? "Updating custom report…" : "Saving custom report…",
          success: { render: ({ data }) => `Saved "${data.name}" to Custom Reports` },
          error: { render: ({ data }) => data?.message || "Failed to save the custom report" },
        });
      } catch (e) {
        console.error(e);
      } finally {
        setSaveVisibilityModalOpen(false);
      }
    },
    [viewNameInput, selectedSavedView, activeView, selectedDimensions, metricFields, aggFunc, filters, displayBy, compareWith, pathway, selectedGLAccountIds, saveView, updateView, selectView]
  );

  const handleLoadView = useCallback(
    (id) => {
      const view = savedViews.find((v) => v.id === id);
      if (view) selectView(view);
    },
    [savedViews, selectView]
  );

  const handleTogglePublish = useCallback(async () => {
    if (!selectedSavedView || !activeView) return;
    try {
      await toast.promise(publishView(selectedSavedView, !activeView.published), {
        pending: activeView.published ? "Unpublishing…" : "Publishing…",
        success: activeView.published ? "Removed from Published Reports" : "Published to the company-wide gallery",
        error: { render: ({ data }) => data?.message || "Failed to update publish status" },
      });
    } catch (e) {
      console.error(e);
    }
  }, [selectedSavedView, activeView, publishView]);

  const handleAddToDashboard = useCallback(async () => {
    if (!selectedSavedView) return;
    try {
      await pinView(selectedSavedView);
      toast.success("Added to Dashboard");
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to add to dashboard");
    }
  }, [selectedSavedView, pinView]);

  const handleDeleteView = useCallback(async () => {
    if (!selectedSavedView) return;
    const deletedName = activeView?.name || "view";

    try {
      await toast.promise(deleteView(selectedSavedView).then(() => selectView(null)), {
        pending: `Deleting "${deletedName}"…`,
        success: `Deleted "${deletedName}"`,
        error: { render: ({ data }) => data?.message || `Failed to delete "${deletedName}"` },
      });
    } catch (e) {
      console.error(e);
    }
  }, [selectedSavedView, activeView, deleteView, selectView]);

  useEffect(() => {
    const viewId = searchParams.get("view") || "";
    if (viewId === appliedViewIdRef.current) return;
    if (!viewId) {
      appliedViewIdRef.current = "";
      applyView(null);
      return;
    }
    if (savedViews.length === 0) return; // retry once savedViews finishes loading
    const view = savedViews.find((v) => v.id === viewId);
    if (view) {
      appliedViewIdRef.current = viewId;
      applyView(view);
    }
  }, [searchParams, savedViews, applyView]);

  const summaryLabel = isValidConfig
    ? `${metricColumns.map((m) => m.label).join(", ")} by ${selectedDimensions.map((f) => FIELD_LABEL[f] || f).join(" → ")}`
    : "";

  /* ── Report AI: Insights / Recommendation columns, row commentary, AI insights & Ask AI ── */
  const aiReportId = `custom_report:${selectedSavedView || "unsaved"}`;
  const aiReportLabel = activeView?.name || "Custom Report";
  // Saved commentary belongs to one configuration of the report plus its
  // filters, so changing what the report shows starts a fresh view — the
  // same way filters do on the other reports.
  const aiViewFilters = useMemo(
    () => ({
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== "All")),
      group_by: selectedDimensions.join(","),
      metrics: metricFields.join(","),
      gl_accounts: pathway === "gl_account" ? selectedGLAccountIds.join(",") : "",
      agg: aggFunc,
      display_by: displayBy,
      compare_with: compareWith === "none" ? "" : compareWith,
    }),
    [filters, selectedDimensions, metricFields, pathway, selectedGLAccountIds, aggFunc, displayBy, compareWith]
  );
  const aiViewKey = `${aiReportId}|${selectedYear}|${JSON.stringify(aiViewFilters)}`;

  const commentary = useReportCommentary({
    token,
    reportId: aiReportId,
    year: selectedYear,
    currency: CURRENCY,
    filters: aiViewFilters,
  });
  const lineCommentary = useLineItemCommentary({
    token,
    reportId: aiReportId,
    year: selectedYear,
    currency: CURRENCY,
    filters: aiViewFilters,
  });

  const [refineLine, setRefineLine] = useState(null);
  useEffect(() => {
    setRefineLine(null);
  }, [aiViewKey]);

  const insightFilterLabels = useMemo(
    () => [
      ...activeFilterTags.map((t) => `${t.label}: ${t.value}`),
      compareLabel ? `Compared with: ${compareLabel}` : null,
    ].filter(Boolean),
    [activeFilterTags, compareLabel]
  );

  const aiContextOptions = {
    metricColumns,
    dimensionLabels: selectedDimensions.map((f) => FIELD_LABEL[f] || f),
    aggFunc,
    displayByLabel: DISPLAY_BY_OPTIONS.find((o) => o.value === displayBy)?.label || displayBy,
    compareLabel,
    isMonthPivot,
    grandTotal,
  };

  // Rule-based text per row, ranked over the full report (not just a Top/Bottom slice).
  const nodeInsights = useMemo(
    () =>
      buildNodeInsights({
        hierarchy: hierarchyWithCompare,
        metric: metricColumns[0],
        aggFunc,
        grandTotal,
        compareLabel,
        isMonthPivot,
      }),
    [hierarchyWithCompare, metricColumns, aggFunc, grandTotal, compareLabel, isMonthPivot]
  );
  const hierarchyIndex = useMemo(() => indexHierarchy(hierarchyWithCompare), [hierarchyWithCompare]);

  const buildInsightsContext = () => buildCustomReportContext({ hierarchy: hierarchyWithCompare, ...aiContextOptions });
  const buildLineItemContext = (key) => buildCustomRowContext(hierarchyIndex.get(key), aiContextOptions);

  const askConfig = {
    label: aiReportLabel,
    questions: customReportQuestions(aiContextOptions),
    getContext: buildInsightsContext,
  };

  // Rows in table order, for the saved row commentary section.
  const commentaryLines = useMemo(() => {
    const lines = [];
    const visit = (nodes) =>
      nodes.forEach((n) => {
        lines.push({ key: nodeKey(n), label: nodeLabel(n) });
        if (n.children?.length) visit(n.children);
      });
    visit(displayHierarchy);
    return lines;
  }, [displayHierarchy]);

  // The commentary shown under the report, offered with the CSV export.
  const exportCommentary = collectCommentary({
    lineTitle: "Row Commentary",
    lines: commentaryLines,
    byLine: lineCommentary.byLine,
    reportItems: commentary.items,
  });

  const openRefine = (node) => setRefineLine({ key: nodeKey(node), label: nodeLabel(node) });

  // Saved "Refine with AI" commentary (one per row for this view) wins over
  // the rule-based insight.
  const aiColumns = {
    renderLabelAction: (node) => (
      <LineItemAIButton
        label={nodeLabel(node)}
        noun="commentary"
        hasCommentary={!!lineCommentary.byLine[nodeKey(node)]}
        onClick={() => openRefine(node)}
      />
    ),
    renderInsight: (node) => {
      const key = nodeKey(node);
      const saved = lineCommentary.byLine[key];
      const text = saved?.explanation || nodeInsights.get(key) || "—";
      return (
        <p className="w-[220px] line-clamp-2 leading-snug whitespace-normal" title={text}>
          {saved?.explanation && (
            <BsChatLeftTextFill size={11} className="inline mr-1 align-[-1px] text-emerald-600" aria-label="Saved AI commentary" />
          )}
          {text}
        </p>
      );
    },
    renderRecommendation: (node) => {
      const saved = lineCommentary.byLine[nodeKey(node)];
      return saved?.recommendation ? (
        <p className="w-[190px] line-clamp-2 leading-snug whitespace-normal" title={saved.recommendation}>
          {saved.recommendation}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => openRefine(node)}
          className="inline-flex items-center gap-1 text-left text-sky-500 hover:text-sky-800"
        >
          <BsChatLeftText size={12} /> Get AI recommendation
        </button>
      );
    },
  };

  return (
    <>
      <main className="flex-1 min-w-0 bg-white p-3 rounded-xl shadow-md space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-lg font-semibold text-sky-900">
              {mode === "view" && activeView ? activeView.name : "Custom Report Builder"}
            </h2>
            <p className="text-s text-sky-600">
              Live data from your organization's General Ledger, fiscal year {selectedYear || "—"}.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {mode === "view" ? (
              <AppButton variant="outline" onClick={() => setMode("edit")} className="whitespace-nowrap">
                <FiEdit2 className="mr-1" />
                Edit Selections
              </AppButton>
            ) : null}
            <button onClick={fetchData} disabled={loading} aria-label="Refresh" className={ICON_BUTTON_CLASS}>
              <FiRefreshCw className={loading ? "animate-spin" : ""} />
              <ActionHoverLabel>Refresh</ActionHoverLabel>
            </button>
          </div>
        </div>

        {error ? (
          <AppCard className="border-red-200 bg-red-50">
            <div className="flex items-center justify-between gap-3">
              <p className="text-s text-red-700">{error}</p>
              <AppButton variant="outline" onClick={fetchData}>
                Retry
              </AppButton>
            </div>
          </AppCard>
        ) : null}

        {loading ? (
          <TableSkeleton columns={5} rows={6} />
        ) : (
          <>
            {mode === "edit" ? (
              <div className="space-y-4">
                <GroupByStep selectedDimensions={selectedDimensions} onToggle={toggleDimension} />
                <WhatToShowStep
                  pathway={pathway}
                  onPathwayChange={handlePathwayChange}
                  primaryMetric={primaryMetric}
                  onPrimaryMetricChange={handlePrimaryMetricChange}
                  selectedDrivers={selectedDrivers}
                  onToggleDriver={toggleDriver}
                  aggFunc={aggFunc}
                  onAggFuncChange={setAggFunc}
                  glAccounts={glAccounts}
                  glAccountsLoading={glAccountsLoading}
                  selectedGLAccountIds={selectedGLAccountIds}
                  onToggleGLAccount={toggleGLAccount}
                  glAccountSearch={glAccountSearch}
                  onGLAccountSearchChange={setGlAccountSearch}
                />
                <DisplayByStep displayBy={displayBy} onChange={setDisplayBy} />
                <CompareWithStep
                  compareWith={compareWith}
                  onChange={setCompareWith}
                  selectedDimensions={selectedDimensions}
                  primaryMetric={effectivePrimaryMetric}
                  scenario={scenario}
                  onScenarioChange={setScenario}
                  availableScenarios={availableScenarios}
                />
                {isValidConfig ? (
                  <div className="mt-1">
                    <AppChipInline label={`Showing: ${summaryLabel}`} />
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap gap-2 min-h-[34px]">
                {activeFilterTags.length === 0 ? (
                  <span className="text-x text-sky-600">No filters applied</span>
                ) : (
                  activeFilterTags.map((tag) => (
                    <span key={tag.key} className="flex items-center gap-2 px-3 py-1 text-x rounded-full bg-sky-800 text-white">
                      {tag.label}: {tag.value}
                      <button onClick={() => handleRemoveFilterTag(tag.key)} className="text-sky-200 hover:text-white font-bold" title="Remove">
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative" ref={filterPanelRef}>
                  <button
                    onClick={handleOpenFilterPanel}
                    aria-label="Filters"
                    className={`${ICON_BUTTON_CLASS} gap-1 font-medium`}
                  >
                    <FiFilter size={14} />
                    <ActionHoverLabel>Filters</ActionHoverLabel>
                    {hasPendingFilterChanges ? (
                      <span className="ml-1 px-2 py-[2px] rounded-full bg-amber-200 text-amber-900 text-[10px] font-bold">Pending</span>
                    ) : null}
                  </button>

                  <AnimatePresence>
                    {filterPanelOpen ? (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="absolute right-0 mt-2 w-[520px] bg-sky-50 border border-sky-200 rounded-xl shadow-lg z-50"
                      >
                        <div className="p-4 grid grid-cols-2 gap-3 text-x">
                          {activeFilterKeys.length === 0 ? (
                            <p className="col-span-2 text-slate-500">Pick a Group By field above to filter by it.</p>
                          ) : null}
                          {activeFilterKeys.map(({ key, label, plural }) => (
                            <AppSelect
                              key={key}
                              label={label || key}
                              value={draftFilters[key]}
                              onChange={(e) => handleDraftFilterChange(key, e.target.value)}
                              options={[{ value: "All", label: `All ${plural}` }, ...(filterOptions[key] || []).map((o) => ({ value: o, label: o }))]}
                            />
                          ))}
                        </div>
                        <div className="p-3 border-t border-sky-200 flex gap-2">
                          <button onClick={handleResetAllFilters} className="w-1/2 py-2 text-x bg-slate-900 text-white rounded-lg hover:bg-slate-800">
                            Reset All
                          </button>
                          <button
                            onClick={handleApplyFilters}
                            disabled={!hasPendingFilterChanges}
                            className={[
                              "w-1/2 py-2 text-x rounded-lg font-semibold",
                              hasPendingFilterChanges ? "bg-sky-900 text-white hover:bg-sky-800" : "bg-sky-200 text-sky-600 cursor-not-allowed",
                            ].join(" ")}
                          >
                            Apply
                          </button>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>

                {selectedSavedView ? (
                  <AddAutomation customReportViewId={selectedSavedView} reportLabel={activeView?.name || "Custom Report"} year={selectedYear} currency={CURRENCY} iconOnly />
                ) : null}

                <button
                  onClick={handleAddToDashboard}
                  disabled={!selectedSavedView}
                  aria-label="Add to Dashboard"
                  className={ICON_BUTTON_CLASS}
                >
                  <FiGrid />
                  <ActionHoverLabel>
                    {!selectedSavedView ? "Save the report first to add it to the dashboard" : "Add to Dashboard"}
                  </ActionHoverLabel>
                </button>

                {/* Icon-only, so a published report shows as a filled button. */}
                <button
                  onClick={handleTogglePublish}
                  disabled={!selectedSavedView || activeView?.visibility !== "all_users"}
                  aria-label={activeView?.published ? "Unpublish" : "Publish"}
                  className={
                    activeView?.published
                      ? `${ICON_BUTTON_CLASS} !bg-sky-900 !text-white !border-sky-900`
                      : ICON_BUTTON_CLASS
                  }
                >
                  <FiCloud />
                  <ActionHoverLabel>
                    {!selectedSavedView
                      ? "Save the report first"
                      : activeView?.visibility !== "all_users"
                      ? "Share with All Users before publishing"
                      : activeView?.published
                      ? "Unpublish"
                      : "Publish"}
                  </ActionHoverLabel>
                </button>

                <ExportMenu
                  label="CSV"
                  disabled={!isValidConfig || filteredRows.length === 0}
                  commentaryCount={commentaryCount(exportCommentary)}
                  onExport={(include) => handleExportCsv(include ? exportCommentary : null)}
                  className={ICON_BUTTON_CLASS}
                />

                <span className="h-6 w-px bg-sky-200" aria-hidden="true" />

                <AIActionsMenu
                  reportId={aiReportId}
                  ask={askConfig}
                  insights={{
                    commentary,
                    reportLabel: aiReportLabel,
                    filterLabels: insightFilterLabels,
                    viewKey: aiViewKey,
                    buildContext: buildInsightsContext,
                    disabled: loading || !hierarchyWithCompare.length,
                  }}
                />
              </div>
            </div>

            <PostGenerationControls
              topBottom={topBottom}
              onTopBottomChange={setTopBottom}
              showPercentOfTotal={showPercentOfTotal}
              onTogglePercentOfTotal={setShowPercentOfTotal}
              exceptionsEnabled={exceptionsEnabled}
              onToggleExceptions={setExceptionsEnabled}
              exceptionsThreshold={exceptionsThreshold}
              onExceptionsThresholdChange={setExceptionsThreshold}
              hasCompare={compareWith !== "none"}
              conditionalFormattingEnabled={conditionalFormattingEnabled}
              onToggleConditionalFormatting={setConditionalFormattingEnabled}
              cfDirection={cfDirection}
              onCfDirectionChange={setCfDirection}
              cfThreshold={cfThreshold}
              onCfThresholdChange={setCfThreshold}
            />

            {mode === "edit" ? (
              <AppCard>
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                  <h3 className="text-md font-semibold text-sky-800">Save for Me / Share</h3>
                  <div className="flex flex-wrap items-end gap-2">
                    <input
                      type="text"
                      placeholder={selectedSavedView ? "Leave blank to update, or name a new report" : "New report name"}
                      value={viewNameInput}
                      onChange={(e) => setViewNameInput(e.target.value)}
                      className="rounded-lg border border-sky-200 bg-white px-2 py-2 text-x text-slate-700 outline-none transition-colors duration-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 min-w-[260px]"
                    />
                    <AppButton variant="primary" onClick={handleOpenSaveVisibilityModal} disabled={!viewNameInput.trim() && !selectedSavedView}>
                      <FiSave className="mr-1" />
                      {isUpdatingActiveView ? `Update "${activeView?.name || ""}"` : "Save for Me"}
                    </AppButton>
                    <AppSelect
                      value={selectedSavedView}
                      onChange={(e) => handleLoadView(e.target.value)}
                      placeholder="Load a saved report"
                      options={savedViews.map((v) => ({ value: v.id, label: v.visibility === "all_users" ? `${v.name} (Shared)` : v.name }))}
                      className="min-w-[200px]"
                    />
                    <AppButton variant="outline" onClick={handleDeleteView} disabled={!selectedSavedView}>
                      <FiTrash2 className="mr-1" />
                      Delete
                    </AppButton>
                  </div>
                </div>
                {savedViews.length === 0 ? (
                  <p className="flex items-center text-x text-slate-500">
                    <FiFolder className="mr-1" />
                    No saved reports yet — build one above, then click Save for Me.
                  </p>
                ) : null}
              </AppCard>
            ) : null}

            <AppCard className="!p-0" hover={false}>
              {rows.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-s text-slate-500">
                  <p className="font-medium text-slate-600">No GL data found for fiscal year {selectedYear}</p>
                  <p>Upload General Ledger data for this year to build a report.</p>
                </div>
              ) : !isValidConfig ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-s text-slate-500">
                  <p className="font-medium text-slate-600">Pick a Group By field and a metric to see a report</p>
                </div>
              ) : displayHierarchy.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-s text-slate-500">
                  <p className="font-medium text-slate-600">No data matches the selected filters.</p>
                </div>
              ) : (
                <HierarchyTable
                  key={selectedDimensions.join(",")}
                  hierarchy={displayHierarchy}
                  groupByLabels={selectedDimensions.map((f) => FIELD_LABEL[f] || f)}
                  metricColumns={metricColumns}
                  isMonthPivot={isMonthPivot}
                  periods={periods}
                  compareWith={compareWith}
                  compareLabel={compareLabel}
                  grandTotal={grandTotal}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                  showPercentOfTotal={showPercentOfTotal}
                  percentOfTotalBase={percentOfTotalBase}
                  conditionalFormatting={{ enabled: conditionalFormattingEnabled, direction: cfDirection, threshold: cfThreshold }}
                  aiColumns={aiColumns}
                />
              )}
            </AppCard>

            {isValidConfig && displayHierarchy.length > 0 ? (
              <LineItemCommentary
                lineCommentary={lineCommentary}
                lines={commentaryLines}
                onRefine={(line) => setRefineLine({ key: line.key, label: line.label })}
                title="Row Commentary"
              />
            ) : null}

            <ReportCommentary commentary={commentary} />

            {mode === "edit" && !selectedSavedView ? <MyReportsPanel savedViews={savedViews} onSelect={selectView} /> : null}
          </>
        )}

        <LineItemRefineWithAI
          line={refineLine}
          onClose={() => setRefineLine(null)}
          lineCommentary={lineCommentary}
          reportLabel={aiReportLabel}
          filterLabels={insightFilterLabels}
          buildContext={buildLineItemContext}
          subtitle="explanation & recommendation"
        />

        {/* Hover help for the commentary buttons in the table */}
        <AIHelpTooltip />
      </main>

      <AnimatePresence>
        {saveVisibilityModalOpen ? (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSaveVisibilityModalOpen(false)}
            />
            <motion.div
              className="fixed left-1/2 top-1/2 z-50 w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-2xl"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <h3 className="text-md font-semibold text-sky-900 mb-1">Save Report For</h3>
              <p className="text-x text-slate-500 mb-4">Choose who can see this custom report.</p>

              <div className="space-y-2">
                <label className="flex items-start gap-2 rounded-lg border border-sky-200 p-3 cursor-pointer hover:bg-sky-50">
                  <input
                    type="radio"
                    name="save-visibility"
                    className="mt-0.5"
                    checked={pendingVisibility === "only_me"}
                    onChange={() => setPendingVisibility("only_me")}
                  />
                  <span>
                    <span className="block text-s font-medium text-slate-800">Only Me</span>
                    <span className="block text-x text-slate-500">Private — only you can see and access this report.</span>
                  </span>
                </label>
                <label className="flex items-start gap-2 rounded-lg border border-sky-200 p-3 cursor-pointer hover:bg-sky-50">
                  <input
                    type="radio"
                    name="save-visibility"
                    className="mt-0.5"
                    checked={pendingVisibility === "all_users"}
                    onChange={() => setPendingVisibility("all_users")}
                  />
                  <span>
                    <span className="block text-s font-medium text-slate-800">Share with All Users</span>
                    <span className="block text-x text-slate-500">Every user in your company can see and access this report.</span>
                  </span>
                </label>
              </div>

              <div className="mt-5 flex gap-2">
                <AppButton variant="outline" className="w-1/2" onClick={() => setSaveVisibilityModalOpen(false)}>
                  Cancel
                </AppButton>
                <AppButton variant="primary" className="w-1/2" onClick={() => handleSaveView(pendingVisibility)}>
                  {isUpdatingActiveView ? "Update" : "Save"}
                </AppButton>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function AppChipInline({ label }) {
  return <span className="inline-block px-3 py-1.5 rounded-lg text-x font-medium bg-sky-900 text-white">{label}</span>;
}
