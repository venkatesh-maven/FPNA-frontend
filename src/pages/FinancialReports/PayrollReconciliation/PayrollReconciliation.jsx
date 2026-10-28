// src/components/Reports/Payroll/PayrollReconciliationReport.jsx
import React, { useContext, useEffect, useMemo, useState, useRef } from "react";
import { AuthContext } from "../../../context/AuthContext";
import { API_BASE_URL } from "../../../config/config";
import ReportsLayout from "../ReportsLayout";
import TableSkeleton from "../../Skeleton/TableSkeleton";
import AskAI from "../AskAI";
import ActionHoverLabel from "../ActionHoverLabel";
import { FiFilter, FiDownload, FiPrinter } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { CSVLink } from "react-csv";
import { Link } from "react-router-dom";
import { FaArrowRightToBracket } from "react-icons/fa6";
import { getDecimalPrecision } from '../../../utils/formatters';

/* ================================================================ CONSTANTS */

const TIME_FILTERS = [
  { id: "all",             label: "All Periods"     },
  { id: "current_month",   label: "Current Month"   },
  { id: "last_month",      label: "Last Month"      },
  { id: "quarter_to_date", label: "Quarter to Date" },
  { id: "year_to_date",    label: "Year to Date"    },
];
const CURRENCY_FILTERS = [
  { id: "actualvalue", label: "Actual"        },
  { id: "thousands",   label: "Thousands (K)" },
  { id: "millions",    label: "Millions (M)"  },
];
const COMPARISON_FILTERS = [
  { id: "",               label: "No Comparison"  },
  { id: "month_on_month", label: "Month vs Month" },
  { id: "year_on_year",   label: "Year vs Year"   },
];
const COLS = [
  { key: "payroll",  label: "Payroll"  },
  { key: "benefits", label: "Benefits" },
  { key: "taxes",    label: "Taxes"    },
  { key: "total",    label: "Total"    },
];
const DEFAULT_FILTERS = {
  period: "all", department_name: "", entity_name: "",
  region: "", comparison: "", currency_filter: "actualvalue",
  show_period: true, show_department: false, show_entity: false, show_region: false,
};

/* ================================================================ HELPERS */

const fmt = (v) => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") {
    const t = v.trim();
    if (!t || t === "--" || t === "-" || t === "0") return "$0";
    if (/[KMB]$/i.test(t)) return `$${t}`;
    const n = parseFloat(t);
    if (!isNaN(n)) return `$${n.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`;
    return t;
  }
  if (typeof v === "number") {
    if (v === 0) return "$0";
    return `$${v.toLocaleString(undefined, { maximumFractionDigits: getDecimalPrecision() })}`;
  }
  return "—";
};

const toNumber = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const cleaned = v.replace(/[$,]/g, "").trim();
    const n = parseFloat(cleaned);
    if (!Number.isFinite(n)) return 0;
    if (/K$/i.test(cleaned)) return n * 1000;
    if (/M$/i.test(cleaned)) return n * 1000000;
    if (/B$/i.test(cleaned)) return n * 1000000000;
    return n;
  }
  return 0;
};

const normalizePayrollResponse = (json) => {
  const legacyRows = Array.isArray(json?.monthly_data) ? json.monthly_data : [];
  if (legacyRows.length) return legacyRows;

  const records = Array.isArray(json?.records) ? json.records : [];
  if (records.length) {
    return records.flatMap((record) =>
      (Object.entries(record.months || {}).length
        ? Object.entries(record.months || {})
        : [["", record.total || {}]]
      ).map(([period, month]) => ({
        period,
        department: record.department,
        entity: record.entity,
        region: record.region,
        payroll: month.payroll ?? 0,
        benefits: month.benefits ?? 0,
        taxes: month.taxes ?? 0,
        total: month.total ?? 0,
        comparisons: month.comparison || {},
      }))
    );
  }

  const periods = Array.isArray(json?.periods) ? json.periods : [];
  const grandMonths = json?.grand_total?.months || {};

  if (periods.length && Object.keys(grandMonths).length) {
    return periods.map((period) => {
      const month = grandMonths[period] || {};
      return {
        period,
        payroll: month.payroll ?? 0,
        benefits: month.benefits ?? 0,
        taxes: month.taxes ?? 0,
        total: month.total ?? 0,
        comparisons: month.comparison || {},
      };
    });
  }
  return [];
};

const getVarianceUI = (val) => {
  const n = toNumber(val);
  if (isNaN(n) || n === 0) return { bg: "bg-slate-50",  pill: "bg-slate-200 text-slate-700", arrow: "•" };
  if (n > 0)               return { bg: "bg-green-50",  pill: "bg-green-600 text-white",      arrow: "▲" };
  return                          { bg: "bg-red-50",    pill: "bg-red-600 text-white",        arrow: "▼" };
};

/* ================================================================ SUB-COMPONENTS */

const SelectField = ({ label, value, options, onChange }) => (
  <div>
    <label className="block mb-1 text-sky-700 font-medium text-x">{label}</label>
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}
      className="w-full border border-sky-200 rounded-lg p-2 bg-white text-sky-900 text-x focus:outline-none focus:ring-2 focus:ring-sky-400">
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  </div>
);

/**
 * ✅ Two-line column sub-header
 * top    = role label  ("Current" / "Previous" / "Δ Change")
 * bottom = period string ("2024-02" / "2024-01" / "Variance")
 */
const ColHeader = ({ top, bottom }) => (
  <div className="flex flex-col leading-tight items-end">
    <span className="text-[10px] text-white/60 font-normal">{top}</span>
    <span className="text-xs font-semibold text-white">{bottom}</span>
  </div>
);

const AIDriverText = ({ messages }) => {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!messages?.length) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % messages.length), 3500);
    return () => clearInterval(t);
  }, [messages]);
  return (
    <AnimatePresence mode="wait">
      <motion.p key={idx}
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.4 }}
        className="text-s font-medium leading-relaxed bg-gradient-to-r from-sky-500 to-purple-500 bg-clip-text text-transparent">
        {messages[idx]}
      </motion.p>
    </AnimatePresence>
  );
};

const MetricRow = ({ label, value }) => {
  const display = fmt(value);
  const n = typeof value === "number" ? value : parseFloat(value);
  const color = isNaN(n) ? "text-sky-900" : n > 0 ? "text-green-600" : n < 0 ? "text-red-600" : "text-sky-900";
  return (
    <div className="flex justify-between items-center py-1 border-b border-sky-100 last:border-0">
      <span className="text-s text-sky-600">{label}</span>
      <span className={`text-s font-semibold ${color}`}>{display}</span>
    </div>
  );
};

/* ================================================================ MAIN */

export default function PayrollReconciliationReport() {
  const { token, selectedYear: year, selectedCurrency } = useContext(AuthContext);
  const currency = selectedCurrency || "USD";

  const [monthlyData,      setMonthlyData]      = useState([]);
  const [keyMetrics,       setKeyMetrics]       = useState(null);
  const [departments,      setDepartments]      = useState([]);
  const [entities,         setEntities]         = useState([]);
  const [regions,          setRegions]          = useState([]);
  const [comparisonActive, setComparisonActive] = useState(false);
  const [loading,          setLoading]          = useState(false);
  const [draft,   setDraft]   = useState(DEFAULT_FILTERS);
  const [applied, setApplied] = useState(DEFAULT_FILTERS);
  const [open,    setOpen]    = useState(false);
  const panelRef = useRef(null);

  /* ── FETCH ── */
  const fetchData = async (filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.period && filters.period !== "all") params.set("period", filters.period);
      if (filters.department_name) params.set("department_name", filters.department_name);
      if (filters.entity_name)     params.set("entity_name",     filters.entity_name);
      if (filters.region)          params.set("region",          filters.region);
      if (filters.comparison)      params.set("comparison",      filters.comparison);
      if (filters.currency_filter && filters.currency_filter !== "actualvalue")
        params.set("currency_filter", filters.currency_filter);
      params.set("show_period", String(Boolean(filters.show_period)));
      params.set("show_department", String(Boolean(filters.show_department)));
      params.set("show_entity", String(Boolean(filters.show_entity)));
      params.set("show_region", String(Boolean(filters.show_region)));

      const res  = await fetch(
        `${API_BASE_URL}/api/v1/company/financial/financials/Payroll_Reconciliation/${year}/${currency}?${params}`,
        { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } }
      );
      const json = await res.json();
      const rows = normalizePayrollResponse(json);
      setMonthlyData(rows);
      setKeyMetrics(json.keymetrics || json.key_metrics || json.keyMetrics || null);
      setDepartments(json.departments || []);
      setEntities(json.entities       || []);
      setRegions(json.regions         || []);
      setComparisonActive(
        rows.some((r) => r.comparisons && Object.keys(r.comparisons).length > 0)
      );
    } catch (e) {
      console.error(e);
      setMonthlyData([]); setKeyMetrics(null);
    }
    setLoading(false);
  };

  useEffect(() => { if (!token || !year) return; fetchData(applied); }, [token, year, currency]); // eslint-disable-line
  useEffect(() => {
    const h = (e) => panelRef.current && !panelRef.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  /* ── AGGREGATE ── */
  const aggregated = useMemo(() => {
    const map = {};
    monthlyData.forEach((r) => {
      if (!map[r.period]) map[r.period] = { period: r.period, payroll: 0, benefits: 0, taxes: 0, total: 0, comparisons: {} };
      const agg = map[r.period];
      agg.payroll  += toNumber(r.payroll);
      agg.benefits += toNumber(r.benefits);
      agg.taxes    += toNumber(r.taxes);
      agg.total    += toNumber(r.total);
      if (r.comparisons && Object.keys(r.comparisons).length > 0) agg.comparisons = r.comparisons;
    });
    return Object.values(map).sort((a, b) => String(a.period).localeCompare(String(b.period)));
  }, [monthlyData]);

  /* ✅ PERIOD LABELS for comparison header — read from first row with comparisons */
  const { currentPeriod, comparePeriod } = useMemo(() => {
    const first = aggregated.find((r) => r.comparisons?.compare_period);
    return {
      currentPeriod: first?.period                      ?? "Current",
      comparePeriod: first?.comparisons?.compare_period ?? "Previous",
    };
  }, [aggregated]);

  /* ── GRAND TOTALS ── */
  const grandTotals = useMemo(() =>
    COLS.reduce((acc, col) => { acc[col.key] = aggregated.reduce((s, r) => s + (r[col.key] || 0), 0); return acc; }, {}),
  [aggregated]);

  const visibleDimensionColumns = useMemo(() => [
    applied.show_department && { key: "department", label: "Department" },
    applied.show_entity && { key: "entity", label: "Entity" },
    applied.show_region && { key: "region", label: "Region" },
  ].filter(Boolean), [applied.show_department, applied.show_entity, applied.show_region]);

  const periodColumns = useMemo(
    () => applied.show_period ? aggregated.map((r) => r.period) : [],
    [aggregated, applied.show_period]
  );

  const categoryMatrixRows = useMemo(() => {
    const dims = visibleDimensionColumns.map((c) => c.key);
    const groups = {};

    if (dims.length === 0) {
      groups.all = { label: {}, items: aggregated };
    } else {
      monthlyData.forEach((row) => {
        const key = dims.map((d) => row[d] || "All").join("||");
        if (!groups[key]) {
          groups[key] = {
            label: Object.fromEntries(dims.map((d) => [d, row[d] || "All"])),
            items: [],
          };
        }
        groups[key].items.push(row);
      });
    }

    return Object.values(groups).flatMap((group) =>
      COLS.map((col) => {
        const periodValues = {};

        group.items.forEach((item) => {
          const period = item.period;
          periodValues[period] = (periodValues[period] || 0) + toNumber(item[col.key]);
        });

        return {
          ...group.label,
          category: col.label,
          values: periodValues,
          total: Object.values(periodValues).reduce((sum, value) => sum + value, 0),
        };
      })
    );
  }, [aggregated, monthlyData, visibleDimensionColumns]);

  /* ── PENDING / TAGS ── */
  const hasPending = useMemo(() => JSON.stringify(draft) !== JSON.stringify(applied), [draft, applied]);
  const activeTags = useMemo(() => {
    const tags = [];
    if (applied.period && applied.period !== "all")
      tags.push({ key: "period", label: TIME_FILTERS.find((t) => t.id === applied.period)?.label });
    if (applied.department_name) tags.push({ key: "department_name", label: `Dept: ${applied.department_name}` });
    if (applied.entity_name)     tags.push({ key: "entity_name",     label: `Entity: ${applied.entity_name}` });
    if (applied.region)          tags.push({ key: "region",          label: `Region: ${applied.region}` });
    if (applied.comparison)
      tags.push({ key: "comparison", label: COMPARISON_FILTERS.find((c) => c.id === applied.comparison)?.label });
    if (applied.currency_filter && applied.currency_filter !== "actualvalue")
      tags.push({ key: "currency_filter", label: CURRENCY_FILTERS.find((c) => c.id === applied.currency_filter)?.label });
    if (!applied.show_period) tags.push({ key: "show_period", label: "Hide Period" });
    if (applied.show_department) tags.push({ key: "show_department", label: "Show Department" });
    if (applied.show_entity) tags.push({ key: "show_entity", label: "Show Entity" });
    if (applied.show_region) tags.push({ key: "show_region", label: "Show Region" });
    return tags.filter(Boolean);
  }, [applied]);

  const removeTag = (tag) => {
    const next = { ...applied };
    if      (tag.key === "period")          next.period = "all";
    else if (tag.key === "currency_filter") next.currency_filter = "actualvalue";
    else if (tag.key === "comparison")      next.comparison = "";
    else if (tag.key === "show_period")     next.show_period = true;
    else if (tag.key === "show_department") next.show_department = false;
    else if (tag.key === "show_entity")     next.show_entity = false;
    else if (tag.key === "show_region")     next.show_region = false;
    else                                    next[tag.key] = "";
    setApplied(next); setDraft(next); fetchData(next);
  };
  const applyFilters = () => { setApplied(draft); fetchData(draft); setOpen(false); };
  const resetAll     = () => { setDraft(DEFAULT_FILTERS); setApplied(DEFAULT_FILTERS); fetchData(DEFAULT_FILTERS); setOpen(false); };

  /* ── CSV ── */
  const csvData = useMemo(() => {
    if (!categoryMatrixRows.length) return [];
    return [
      ["Category", ...visibleDimensionColumns.map((c) => c.label), ...periodColumns, "Total"],
      ...categoryMatrixRows.map((row) => [
        row.category,
        ...visibleDimensionColumns.map((c) => row[c.key] || ""),
        ...periodColumns.map((period) => row.values[period] || 0),
        row.total,
      ]),
    ];
  }, [categoryMatrixRows, periodColumns, visibleDimensionColumns]);

  /* ── AI MESSAGES ── */
  const aiMessages = (keyMetrics?.ai_insights?.length ? keyMetrics.ai_insights : null) || [
    "📊 Payroll reconciliation data loaded — review monthly cost trends",
    "💡 Filter by Department or Entity to drill into specific cost centers",
    "🔍 Enable Month vs Month comparison to track payroll changes over time",
    "📈 Benefits and taxes together represent a significant share of total cost",
    "🧠 AI-powered analysis enhances payroll reconciliation accuracy",
  ];

  const deptOpts   = [{ id: "", label: "All Departments" }, ...departments.map((d) => ({ id: d, label: d }))];
  const entityOpts = [{ id: "", label: "All Entities"    }, ...entities.map((e)    => ({ id: e, label: e }))];
  const regionOpts = [{ id: "", label: "All Regions"     }, ...regions.map((r)     => ({ id: r, label: r }))];

  /* ================================================================ RENDER */
  return (
    <ReportsLayout>
      <main className="flex-1 min-w-0 bg-white p-3 rounded-xl shadow-md">

        {/* HEADER */}
        {/* <div className="mb-3">
          <h2 className="text-lg font-semibold text-sky-900">Payroll Reconciliation</h2>
          <p className="text-s text-sky-600">Payroll, benefits &amp; tax analysis by period</p>
        </div> */}

         <div className="flex justify-between items-center gap-3 mb-2">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <h2 className="text-lg font-semibold text-sky-900">Payroll Reconciliation</h2>
                    <p className="text-s text-sky-500">Payroll, benefits &amp; tax analysis by period</p>
                  </div>
                  {/* <Link
                    to="/payroll-reconciliation-dashboard"
                    className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg hover:bg-white hover:text-sky-900 transition border border-sky-900"
                  >
                    View More <FaArrowRightToBracket className="ml-1" />
                  </Link> */}
                </div>

        {/* ACTION BAR */}
        <div className="mb-3 flex items-start justify-between gap-3 flex-wrap" ref={panelRef}>
          {/* Active chips */}
          <div className="flex flex-wrap gap-2 min-h-[34px] items-center">
            {activeTags.length === 0 ? (
              <span className="text-x text-sky-400 italic">No filters applied</span>
            ) : activeTags.map((t) => (
              <motion.span key={`${t.key}-${t.label}`}
                initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1 px-3 py-1 text-x rounded-full bg-sky-800 text-white">
                {t.label}
                <button onClick={() => removeTag(t)} className="ml-1 text-sky-200 hover:text-white font-bold leading-none">×</button>
              </motion.span>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Filter dropdown */}
            <div className="relative">
              <button onClick={() => setOpen((o) => !o)}
                aria-label="Filters"
                className="relative group flex items-center gap-1 px-3 py-2.5 text-x font-medium rounded-lg border transition bg-sky-100 border-sky-200 text-sky-800 hover:bg-sky-200">
                <FiFilter size={14} />
                <ActionHoverLabel>Filters</ActionHoverLabel>
                {hasPending && <span className="ml-1 px-2 py-[2px] rounded-full bg-amber-200 text-amber-900 text-[10px] font-bold">Pending</span>}
              </button>
              <AnimatePresence>
                {open && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="absolute right-0 mt-2 w-[440px] bg-sky-50 border border-sky-200 rounded-xl shadow-xl z-50">
                    <div className="p-4 grid grid-cols-2 gap-3">
                      <SelectField label="Period"     value={draft.period}          options={TIME_FILTERS}       onChange={(v) => setDraft((f) => ({ ...f, period: v }))} />
                      <SelectField label="Currency"   value={draft.currency_filter} options={CURRENCY_FILTERS}   onChange={(v) => setDraft((f) => ({ ...f, currency_filter: v }))} />
                      <SelectField label="Comparison" value={draft.comparison}      options={COMPARISON_FILTERS}  onChange={(v) => setDraft((f) => ({ ...f, comparison: v }))} />
                      <SelectField label="Department" value={draft.department_name} options={deptOpts}           onChange={(v) => setDraft((f) => ({ ...f, department_name: v }))} />
                      <SelectField label="Entity"     value={draft.entity_name}     options={entityOpts}         onChange={(v) => setDraft((f) => ({ ...f, entity_name: v }))} />
                      <SelectField label="Region"     value={draft.region}          options={regionOpts}         onChange={(v) => setDraft((f) => ({ ...f, region: v }))} />
                    </div>
                    <div className="p-3 border-t border-sky-200 flex gap-2">
                      <button onClick={resetAll} className="w-1/2 py-2 text-x bg-sky-200 text-sky-900 rounded-lg hover:bg-sky-300 transition font-medium">Reset All</button>
                      <button onClick={applyFilters} disabled={!hasPending}
                        className={["w-1/2 py-2 text-x rounded-lg font-semibold transition",
                          hasPending ? "bg-sky-900 text-white hover:bg-sky-800" : "bg-sky-200 text-sky-500 cursor-not-allowed"].join(" ")}>
                        Apply
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* <CSVLink data={csvData} filename={`Payroll_Reconciliation_${year}_${currency}.csv`}
              className="flex items-center gap-2 px-3 py-2 text-x bg-white text-sky-800 border border-sky-300 rounded-lg hover:bg-sky-100 transition">
              <FiDownload size={13} /> CSV
            </CSVLink> */}
            <button onClick={() => window.print()}
              aria-label="Print"
              className="relative group flex items-center px-3 py-2.5 text-x bg-sky-100 text-sky-800 rounded-lg border border-sky-200 hover:bg-sky-200">
              <FiPrinter />
              <ActionHoverLabel>Print</ActionHoverLabel>
            </button>
            <button
              type="button"
              disabled
              aria-label="Sort"
              className="relative group flex items-center px-3 py-2.5 text-x bg-sky-100 text-sky-700 rounded-lg border border-sky-200 cursor-not-allowed opacity-60"
            >
              <FiFilter size={13} />
              <ActionHoverLabel>Sort</ActionHoverLabel>
            </button>
            <span className="h-6 w-px bg-sky-200" aria-hidden="true" />
            <AskAI reportId="payroll" />
          </div>
        </div>

        {loading && <TableSkeleton />}

        <div className="mb-2 flex flex-wrap items-center gap-4 border-y border-sky-200 bg-sky-50 px-3 py-1 shadow-sm">
          {[
            { key: "show_region", label: "Region" },
            { key: "show_entity", label: "Entity" },
            { key: "show_department", label: "Department" },
          ].map((item) => (
            <label key={item.key} className="inline-flex items-center gap-2 text-s font-medium text-sky-800">
              <input
                type="checkbox"
                checked={Boolean(applied[item.key])}
                onChange={(e) => {
                  const next = { ...applied, [item.key]: e.target.checked };
                  setApplied(next);
                  setDraft(next);
                  fetchData(next);
                }}
                className="h-3.5 w-3.5 rounded border-sky-300 text-sky-800 focus:ring-sky-500"
              />
              {item.label}
            </label>
          ))}
          <span className="h-6 border-l border-sky-300" />
          <label className="inline-flex items-center gap-2 text-s font-medium text-sky-800">
            <input
              type="checkbox"
              checked={Boolean(applied.show_period)}
              onChange={(e) => {
                const next = { ...applied, show_period: e.target.checked };
                setApplied(next);
                setDraft(next);
                fetchData(next);
              }}
              className="h-3.5 w-3.5 rounded border-sky-300 text-sky-800 focus:ring-sky-500"
            />
            Show Period Columns
          </label>
        </div>

        {/* ── NORMAL TABLE ── */}
        {!loading && categoryMatrixRows.length > 0 && !comparisonActive && (
          <div className="report-table-scroll overflow-auto mt-2 max-h-[440px] border border-sky-200 rounded-lg bg-white">
            <table
              className="w-full text-x text-sky-900"
              style={{ minWidth: `${260 + visibleDimensionColumns.length * 140 + periodColumns.length * 130}px` }}
            >
              <thead className="bg-sky-900 text-white sticky top-0 z-20">
                <tr>
                  <th className="px-3 py-3 text-left whitespace-nowrap sticky left-0 z-30 bg-sky-900 font-semibold border-r border-white/20">CATEGORY</th>
                  {visibleDimensionColumns.map((col) => (
                    <th key={col.key} className="px-3 py-3 text-left whitespace-nowrap font-semibold border-r border-white/20">
                      {col.label.toUpperCase()}
                    </th>
                  ))}
                  {periodColumns.map((period) => (
                    <th key={period} className="px-3 py-3 text-right whitespace-nowrap font-semibold border-l border-white/20">
                      {period}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right whitespace-nowrap font-semibold border-l border-white/20 bg-sky-950">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {categoryMatrixRows.map((row, idx) => (
                  <motion.tr key={`${visibleDimensionColumns.map((col) => row[col.key] || "").join("-")}-${row.category}-${idx}`}
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}
                    className="border-b border-sky-50 hover:bg-sky-50 transition-colors">
                    <td className="px-3 py-3 font-semibold text-sky-900 whitespace-nowrap bg-sky-50 sticky left-0 z-10 border-r border-sky-100">{row.category}</td>
                    {visibleDimensionColumns.map((col) => (
                      <td key={col.key} className="px-3 py-3 whitespace-nowrap border-r border-sky-100">
                        {row[col.key] || "All"}
                      </td>
                    ))}
                    {periodColumns.map((period) => (
                      <td key={period} className="px-3 py-3 whitespace-nowrap text-right text-sky-900 border-l border-sky-100">
                        {fmt(row.values[period] || 0)}
                      </td>
                    ))}
                    <td className="px-3 py-3 whitespace-nowrap text-right text-sky-900 font-semibold border-l border-sky-200 bg-sky-50">{fmt(row.total)}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── COMPARISON TABLE ── */}
        {!loading && comparisonActive && aggregated.length > 0 && (
          <div className="report-table-scroll overflow-auto mt-2 max-h-[520px] border border-sky-200 rounded-lg bg-white">
            <table className="min-w-max w-full text-x">
              <thead className="sticky top-0 z-20">
                {/* ROW 1 — CATEGORY + period group labels */}
                <tr className="bg-[#04577c] text-white">
                  <th rowSpan={2} className="px-3 py-3 text-left whitespace-nowrap sticky left-0 z-30 bg-[#04577c] font-semibold border-r border-white/15 min-w-[120px]">
                    CATEGORY
                  </th>
                  {aggregated.map((row, idx) => {
                    const cp = row.comparisons?.compare_period || "";
                    return (
                      <th key={row.period} colSpan={3}
                        className={["px-3 py-3 text-center whitespace-nowrap font-bold", idx > 0 ? "border-l-2 border-white/20" : ""].join(" ")}>
                        {row.period}{cp ? ` vs ${cp}` : ""}
                      </th>
                    );
                  })}
                  <th colSpan={1} className="px-3 py-3 text-center whitespace-nowrap font-bold border-l-2 border-white/20 bg-sky-950">
                    TOTAL
                  </th>
                </tr>
                {/* ROW 2 — sub-column headers with period dates */}
                <tr className="bg-[#0b6a92] text-white">
                  {aggregated.flatMap((row, idx) => {
                    const cp = row.comparisons?.compare_period || "";
                    return [
                      <th key={`${row.period}-cur`} className={["px-3 py-2 text-center whitespace-nowrap", idx > 0 ? "border-l-2 border-white/20" : ""].join(" ")}>
                        <div className="text-white/60 text-[10px] leading-tight">{row.period}</div>
                        <div className="font-semibold text-xs">Current</div>
                      </th>,
                      <th key={`${row.period}-prev`} className="px-3 py-2 text-center whitespace-nowrap border-l border-white/15">
                        <div className="text-white/60 text-[10px] leading-tight">{cp}</div>
                        <div className="font-semibold text-xs">Previous</div>
                      </th>,
                      <th key={`${row.period}-var`} className="px-3 py-2 text-center whitespace-nowrap border-l border-white/15">
                        <div className="text-white/60 text-[10px] leading-tight">&nbsp;</div>
                        <div className="font-semibold text-xs">Variance</div>
                      </th>,
                    ];
                  })}
                  <th className="px-3 py-2 text-center whitespace-nowrap border-l-2 border-white/20 bg-sky-950">
                    <div className="text-white/60 text-[10px] leading-tight">&nbsp;</div>
                    <div className="font-semibold text-xs">Total</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {COLS.map((col, rowIdx) => (
                  <motion.tr key={col.key}
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: rowIdx * 0.04 }}
                    className="border-b border-sky-100 hover:bg-sky-50 transition-colors">
                    <td className="px-3 py-2.5 font-semibold whitespace-nowrap text-sky-900 bg-sky-50 sticky left-0 z-10 border-r border-sky-100">
                      {col.label}
                    </td>
                    {aggregated.map((row, idx) => {
                      const current  = row[col.key];
                      const comp     = row.comparisons || {};
                      const previous = comp[`compare_${col.key}`] ?? null;
                      const rawDiff  =
                        comp[`${col.key}_varience`] ??
                        comp[`${col.key}_variance`] ??
                        comp[`${col.key}_diff`]     ??
                        (previous !== null ? toNumber(current) - toNumber(previous) : null);
                      const ui = getVarianceUI(rawDiff);
                      return (
                        <React.Fragment key={row.period}>
                          <td className={["px-3 py-2.5 text-right whitespace-nowrap font-semibold text-sky-900", idx > 0 ? "border-l-2 border-sky-100" : ""].join(" ")}>
                            {fmt(current)}
                          </td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap text-sky-500 border-l border-sky-100">
                            {previous !== null ? fmt(previous) : "—"}
                          </td>
                          <td className={["px-3 py-2.5 text-center whitespace-nowrap border-l border-sky-100", ui.bg].join(" ")}>
                            {rawDiff !== null ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${ui.pill}`}>
                                <span>{ui.arrow}</span>{fmt(Math.abs(Number(rawDiff)))}
                              </span>
                            ) : "—"}
                          </td>
                        </React.Fragment>
                      );
                    })}
                    <td className="px-3 py-2.5 text-right whitespace-nowrap font-semibold text-sky-900 border-l-2 border-sky-200 bg-sky-50">
                      {fmt(aggregated.reduce((sum, row) => sum + toNumber(row[col.key]), 0))}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && categoryMatrixRows.length === 0 && (
          <div className="h-[420px] flex flex-col items-center justify-center border border-sky-100 rounded-xl bg-sky-50">
            <p className="text-sky-700 text-s font-medium">No data available for selected filters</p>
            <p className="text-sky-400 text-x mt-1">Try adjusting your filters or selecting a different period</p>
          </div>
        )}

        {/* KEY METRICS + AI INSIGHTS */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="mt-6 bg-white border border-sky-200 rounded-xl p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 space-y-1">
              <h3 className="text-s font-semibold text-sky-900 mb-2">Key Payroll Metrics</h3>
              <MetricRow label="Total Payroll"  value={keyMetrics?.total_payroll     ?? null} />
              <MetricRow label="Total Benefits" value={keyMetrics?.total_benefits    ?? null} />
              <MetricRow label="Total Taxes"    value={keyMetrics?.total_taxes       ?? null} />
              <MetricRow label="Grand Total"    value={keyMetrics?.grand_total       ?? null} />
              <MetricRow label="Avg per Month"  value={keyMetrics?.average_per_month ?? null} />
            </div>
            <div className="bg-sky-50 md:col-span-2 border border-sky-200 rounded-lg p-3 flex flex-col justify-between gap-3">
              <h4 className="text-x font-semibold text-sky-900">AI Insights</h4>
              <div className="flex-1 flex items-center">
                <AIDriverText messages={aiMessages} />
              </div>
              {keyMetrics && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-sky-200">
                  {[
                    { label: "Payroll",  value: keyMetrics.total_payroll,  cls: "bg-sky-100 text-sky-800"       },
                    { label: "Benefits", value: keyMetrics.total_benefits, cls: "bg-purple-100 text-purple-800" },
                    { label: "Taxes",    value: keyMetrics.total_taxes,    cls: "bg-amber-100 text-amber-800"   },
                    { label: "Total",    value: keyMetrics.grand_total,    cls: "bg-green-100 text-green-800"   },
                  ].map((item) => (
                    <motion.span key={item.label}
                      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}
                      className={`px-2 py-1 rounded-full  text-[11p] font-semibold ${item.cls}`}>
                      {item.label}: {fmt(item.value)}
                    </motion.span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>

      </main>
    </ReportsLayout>
  );
}
