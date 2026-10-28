// BudgetOverview.jsx — AI-Powered Budget module hub. Backed by
// /api/v1/budget/overview/{year}, a real rollup over the 4 live modules
// (Revenue/Workforce/Opex/CAPEX) — no new ML, just aggregation of each
// module's own already-real compute functions.
//
// Shows User Budget values only (no AI Budget figures) — KPIs, charts, and
// the per-module trend widgets below are all computed from the same
// adjusted/user data analysts save in each module. Manage Widgets
// (position/chart_type/enable) mirrors the Financial Dashboard's pattern,
// backend-persisted per company.
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { BsThreeDotsVertical } from "react-icons/bs";
import { RiDragMove2Fill } from "react-icons/ri";
import { BudgetYearContext } from "../../context/BudgetYearContext";
import { AuthContext } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config/config";
import { Chart as ChartJS } from "chart.js/auto";
import { Bar, Line, Pie, Doughnut, Radar } from "react-chartjs-2";
import {
  FiEdit, FiArrowUp, FiArrowDown, FiChevronRight, FiEyeOff,
  FiDollarSign, FiUsers, FiBriefcase, FiPackage, FiClipboard, FiCheckSquare,
  FiClock, FiSettings,
} from "react-icons/fi";
import {
  PageHeader, StatusPill, EmptyState, fmtPct, parseMoney,
} from "./budgetHelpers";
import TableSkeleton from "../Skeleton/TableSkeleton";
import WidgetAskAI from "../../components/Dashboard/WidgetAskAI";
import { buildChartContext, buildChartQuestions } from "../../utils/chartAiContext";

// Same "$1,234,567.89" formatter Financial Dashboard's renderValue()
// (FinancialOverview.jsx) applies to every axis tick/tooltip.
const chartCurrency = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
};

// Canvas text doesn't inherit the page font, so charts name it explicitly
// (Poppins, 12px — the Planning Engine / reports type scale).
const CHART_FONT = { family: "Poppins, sans-serif", size: 12 };

// Mirrors FinancialCharts.jsx's getChartOptions() exactly — same tooltip/
// axis currency formatting, same "no scales for pie/doughnut" branch, same
// plain bottom legend (no custom swatch sizing).
const getChartOpts = (chartType) => {
  const isCircular = chartType === "pie_chart" || chartType === "doughnut_chart";
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", labels: { font: CHART_FONT } },
      tooltip: {
        titleFont: CHART_FONT,
        bodyFont: CHART_FONT,
        callbacks: {
          label: (ctx) => {
            const raw = (ctx?.parsed && typeof ctx.parsed === "object" && "y" in ctx.parsed) ? ctx.parsed.y : (ctx?.parsed ?? ctx?.raw ?? 0);
            const n = Number(raw);
            return `${ctx.dataset.label || "Value"}: ${Number.isFinite(n) ? chartCurrency(n) : "—"}`;
          },
        },
      },
    },
    scales: !isCircular
      ? {
          x: { grid: { display: false }, ticks: { font: CHART_FONT } },
          y: { ticks: { font: CHART_FONT, callback: (val) => chartCurrency(Number(val)) } },
        }
      : undefined,
  };
};

const API_BASE = `${API_BASE_URL}/api/v1/budget`;

const MODULE_META = {
  setup: { icon: <FiClipboard size={18} />, path: "/budget-setup-guidelines", desc: "FY calendar, planning frequency, methodology, and CFO guidance." },
  revenue: { icon: <FiDollarSign size={18} />, path: "/budget-revenue", desc: "Existing customers, pipeline, and strategic revenue." },
  workforce: { icon: <FiUsers size={18} />, path: "/budget-workforce", desc: "Existing employees, new positions, and compensation." },
  opex: { icon: <FiBriefcase size={18} />, path: "/budget-opex", desc: "Marketing, travel, software, facilities, and more — activity-based." },
  capex: { icon: <FiPackage size={18} />, path: "/budget-capex", desc: "Capital requests, ROI, and approval routing." },
  review: { icon: <FiCheckSquare size={18} />, path: "/budget-review-approval", desc: "Consolidated KPIs, audit trail, and scenario comparison." },
};

const STAGE_TO_PILL = { draft: "Draft", submitted: "Pending", reviewed: "Pending", approved: "Approved", locked: "Final" };

const MODULE_KPI_META = {
  revenue: { label: "Total Revenue", icon: <FiDollarSign size={16} /> },
  workforce: { label: "Total Workforce", icon: <FiUsers size={16} /> },
  opex: { label: "Total Operating Expense", icon: <FiBriefcase size={16} /> },
  capex: { label: "Total CAPEX", icon: <FiPackage size={16} /> },
};

// Widget defs for the Manage-Widgets-controlled trend charts — matches the
// backend's fixed 4 widgets (fpna_config.budget_overview_widgets).
const WIDGET_DEFS = [
  { key: "revenue_trend", field: "revenue", label: "Revenue Budget Trend" },
  { key: "workforce_trend", field: "workforce", label: "Workforce Budget Trend" },
  { key: "opex_trend", field: "opex", label: "Opex Budget Trend" },
  { key: "capex_trend", field: "capex", label: "CAPEX Budget Trend" },
];
const WIDGET_LABELS = Object.fromEntries(WIDGET_DEFS.map((w) => [w.key, w.label]));
const WIDGET_KEY_TO_FIELD = Object.fromEntries(WIDGET_DEFS.map((w) => [w.key, w.field]));
// Exact same palette FinancialCharts.jsx (SLICE_COLORS) uses for its pie/
// doughnut slices — the only place either dashboard sets an explicit chart
// color. Bar/line/radar deliberately set no color at all on either
// dashboard, so Chart.js's own default palette renders identically on both.
const SLICE_PALETTE = ["#38bdf8", "#0ea5e9", "#0284c7", "#7dd3fc", "#fb923c", "#f97316", "#facc15", "#34d399", "#a3e635", "#f472b6"];
const CHART_TYPE_OPTIONS = [
  { value: "bar_chart", label: "Bar" },
  { value: "line_chart", label: "Line" },
  { value: "area_chart", label: "Area" },
  { value: "radar_chart", label: "Radar" },
  { value: "pie_chart", label: "Pie" },
  { value: "doughnut_chart", label: "Doughnut" },
];

// Splits the backend's `[{period, <field>}, ..., {position, chart_type, enableordisable}]`
// shape into a clean {periods, values, meta} — the last item is always the
// widget config, never a data point (identified by having "position").
function parseTrend(arr) {
  const fallback = { periods: [], values: [], meta: { position: 1, chart_type: "bar_chart", enableordisable: true } };
  if (!Array.isArray(arr) || arr.length === 0) return fallback;
  const meta = arr[arr.length - 1];
  const points = arr.slice(0, -1);
  const field = Object.keys(points[0] || {}).find((k) => k !== "period");
  return {
    periods: points.map((p) => p.period),
    values: points.map((p) => parseMoney(p[field]) || 0),
    meta: {
      position: meta?.position ?? 1,
      chart_type: meta?.chart_type ?? "bar_chart",
      enableordisable: meta?.enableordisable !== false,
    },
  };
}

// Mirrors Financial Dashboard's KPICard (FinancialMetrics.jsx) structure and
// classes exactly (label/value/delta/icon-circle) — a bespoke card local to
// this page rather than budgetHelpers' shared KpiRow, so other Budget pages
// that already use KpiRow are unaffected.
function OverviewKpiCard({ label, value, sub, positive, icon }) {
  return (
    <div className="rounded-xl p-3 bg-white border border-sky-100 shadow-sm transition-all duration-200 hover:shadow-md">
      <div className="flex justify-between items-start gap-2">
        <div className="w-full min-w-0">
          <p className="text-xs font-semibold text-sky-600 uppercase tracking-wider truncate">{label}</p>
          <p className="text-s font-bold text-sky-900 mt-1 truncate">{value}</p>
          {sub && (
            <div className={`flex items-center mt-2 ${positive == null ? "text-sky-600" : positive ? "text-green-500" : "text-red-500"}`}>
              <span className="text-xs font-medium">{sub}</span>
            </div>
          )}
        </div>
        <div className="rounded-full bg-sky-100 p-2 shrink-0">
          <div className="text-sky-600">{icon}</div>
        </div>
      </div>
    </div>
  );
}

function TrendChart({ widget }) {
  const { periods, values, meta } = widget.trend;
  const isCircular = meta.chart_type === "pie_chart" || meta.chart_type === "doughnut_chart";
  const data = {
    labels: periods,
    datasets: [{
      label: "User Budget",
      data: values,
      // Pie/doughnut need an explicit per-slice color (Chart.js can't derive
      // one automatically for a single multi-slice dataset) — everything
      // else is left unset so Chart.js's own default palette applies, same
      // as Financial Dashboard's bar/line/radar charts.
      ...(isCircular ? { backgroundColor: periods.map((_, i) => SLICE_PALETTE[i % SLICE_PALETTE.length]), borderWidth: 0 } : {}),
      borderRadius: meta.chart_type === "bar_chart" ? 8 : undefined,
      fill: meta.chart_type === "area_chart" ? true : undefined,
      tension: 0.35,
    }],
  };
  const options = getChartOpts(meta.chart_type);
  switch (meta.chart_type) {
    case "line_chart":
    case "area_chart":
      return <Line data={data} options={options} />;
    case "radar_chart":
      return <Radar data={data} options={options} />;
    case "pie_chart":
      return <Pie data={data} options={options} />;
    case "doughnut_chart":
      return <Doughnut data={data} options={options} />;
    default:
      return <Bar data={data} options={options} />;
  }
}

// Hover toolbar (hide / change chart type / drag-to-reorder) — mirrors
// Financial Dashboard's ChartCard (FinancialCharts.jsx) exactly, scoped to
// Budget Overview's own 4 trend widgets + endpoints.
//
// Colors below use arbitrary-value classes (bg-[#f1f5f9] etc.) instead of
// named ones (bg-slate-100) on purpose — this page is wrapped in the
// Budget module's shared .forecasting-pnl-theme, whose global CSS force-
// overrides any bg-slate-*/bg-sky-*/bg-emerald-* class found on a <button>
// to navy (it substring-matches the raw class attribute, so it fires even
// inside a hover: variant). Bracket values render true regardless.
function TrendChartCard({ widget, index, saving, onHide, onChartType, year }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const timerRef = useRef(null);
  const openMenu = () => { if (timerRef.current) clearTimeout(timerRef.current); setMenuOpen(true); };
  const closeMenu = () => { if (timerRef.current) clearTimeout(timerRef.current); timerRef.current = setTimeout(() => setMenuOpen(false), 200); };

  // Same {labels, datasets} shape every other dashboard chart card feeds
  // Ask AI — buildChartContext/buildChartQuestions are widget-name-agnostic,
  // so this "just works" the same way it does on the Financial Dashboard.
  const chartData = { labels: widget.trend.periods, datasets: [{ label: "User Budget", data: widget.trend.values }] };

  return (
    <Draggable draggableId={widget.key} index={index}>
      {(provided) => (
        <div ref={provided.innerRef} {...provided.draggableProps} className="bg-white rounded-xl border border-sky-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-s font-semibold text-sky-800">{widget.label}</h3>
            <div className="flex items-center gap-1 relative">
              <WidgetAskAI
                title={widget.label}
                context={buildChartContext(widget.label, chartData, year)}
                questions={buildChartQuestions(widget.label)}
              />

              <button onClick={() => onHide(widget.key)} disabled={saving} title="Hide widget"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#94a3b8] hover:text-[#334155] hover:bg-[#f1f5f9] transition-colors disabled:opacity-40">
                <FiEyeOff size={14} />
              </button>

              <div className="relative" onMouseEnter={openMenu} onMouseLeave={closeMenu}>
                <button className="w-7 h-7 rounded-lg flex items-center justify-center text-[#94a3b8] hover:text-[#334155] hover:bg-[#f1f5f9] transition-colors" title="Options">
                  <BsThreeDotsVertical size={14} />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-8 w-40 bg-white rounded-lg shadow-lg border border-sky-200 z-20"
                    onMouseEnter={openMenu} onMouseLeave={closeMenu}>
                    <div className="px-3 py-2 text-x text-slate-700">Change Chart Type</div>
                    <div className="border-t border-slate-100">
                      {CHART_TYPE_OPTIONS.map((c) => (
                        <button key={c.value} disabled={saving}
                          className={`block w-full text-left px-3 py-2 text-x hover:bg-[#f8fafc] ${widget.trend.meta.chart_type === c.value ? "text-sky-700 font-semibold" : "text-slate-700"}`}
                          onClick={() => { onChartType(widget.key, c.value); setMenuOpen(false); }}>
                          {c.label.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div {...provided.dragHandleProps} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#94a3b8] hover:text-[#334155] hover:bg-[#f1f5f9] cursor-move transition-colors" title="Drag to reorder">
                <RiDragMove2Fill size={14} />
              </div>
            </div>
          </div>
          <div className="h-56 sm:h-60 md:h-64 lg:h-72"><TrendChart widget={widget} /></div>
        </div>
      )}
    </Draggable>
  );
}

// Manage Widgets modal — matches Financial Dashboard's ManageWidgetsModal
// (FinancialOverview.jsx) styling byte-for-byte: gradient header, search,
// enabled count pill, toggle cards. Reordering/chart-type live on the
// dashboard cards themselves (TrendChartCard above), same split FD uses.
function ManageWidgetsModal({ open, onClose, widgets, saving, onToggle }) {
  const [q, setQ] = useState("");
  if (!open) return null;

  const filtered = widgets.filter((w) => (WIDGET_LABELS[w.name] || w.name).toLowerCase().includes(q.trim().toLowerCase()));
  const enabledCount = widgets.filter((w) => w.enable_or_disable).length;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <button onClick={onClose} aria-label="Close" className="absolute inset-0 bg-black/55 backdrop-blur-[6px]" />
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/20 bg-white shadow-[0_30px_90px_-35px_rgba(0,0,0,0.55)]">
        <div className="relative px-6 py-5">
          <div className="absolute inset-0 bg-gradient-to-r from-sky-950 to-sky-800" />
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.65),transparent_55%)]" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-white">Manage Overview Widgets</h2>
              <p className="mt-1 text-s text-white/80">Enable / Disable charts • Drag order is handled on dashboard</p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-x text-white/90 ring-1 ring-white/20">
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                Enabled: <span className="font-semibold">{enabledCount}</span> / <span className="font-semibold">{widgets.length}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-full md:w-[260px]">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search widget..."
                  className="w-full rounded-2xl bg-white/15 px-4 py-2 text-s text-white placeholder:text-white/60 outline-none ring-1 ring-white/20 focus:ring-2 focus:ring-white/50" />
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-white/60">⌕</div>
              </div>
              <button onClick={onClose} className="rounded-2xl bg-white/10 px-3 py-2 text-white/90 hover:bg-white/15 transition focus:outline-none focus:ring-2 focus:ring-white/50" title="Close">✕</button>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filtered.map((w) => {
                const enabled = !!w.enable_or_disable;
                const chartLabel = CHART_TYPE_OPTIONS.find((c) => c.value === w.chart_type)?.label || "Bar";
                return (
                  <div key={w.name}
                    className={`group relative rounded-2xl border bg-white p-4 shadow-sm transition ${enabled ? "border-emerald-100 hover:border-emerald-200 hover:shadow-md" : "border-slate-100 hover:border-slate-200 hover:shadow-md"}`}>
                    <div className={`pointer-events-none absolute inset-0 rounded-2xl opacity-0 blur-2xl transition group-hover:opacity-100 ${enabled ? "bg-emerald-200/30" : "bg-slate-200/30"}`} />
                    <div className="relative flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-s font-semibold text-slate-900">{WIDGET_LABELS[w.name] || w.name}</h3>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${enabled ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-50 text-slate-600 ring-slate-200"}`}>
                            {enabled ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-x text-slate-600">
                          <span className="rounded-full bg-slate-50 px-2 py-1 ring-1 ring-slate-200">Type: <span className="font-semibold">{chartLabel}</span></span>
                        </div>
                      </div>
                      <button onClick={() => onToggle(w.name, !enabled)} disabled={saving}
                        className={`relative inline-flex h-6 w-12 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/40 ${enabled ? "bg-[#059669] border-[#059669]" : "bg-[#e2e8f0] border-[#e2e8f0]"}`}
                        aria-pressed={enabled} aria-label={enabled ? "Disable widget" : "Enable widget"}>
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${enabled ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {filtered.length === 0 && <div className="py-14 text-center text-s text-slate-500">No widgets found.</div>}
          </div>

          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-x text-slate-500">Tip: Disabled widgets won&rsquo;t appear on the dashboard charts.</div>
            <button onClick={onClose} className="rounded-2xl bg-sky-950 px-5 py-2.5 text-s font-semibold text-white shadow-sm hover:bg-sky-900 transition focus:outline-none focus:ring-2 focus:ring-sky-500/40">Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const BudgetOverview = () => {
  const navigate = useNavigate();
  const { token } = useContext(AuthContext);
  const { budgetYear } = useContext(BudgetYearContext);
  const year = `FY${budgetYear}`;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modules, setModules] = useState([]);
  const [totals, setTotals] = useState({ user: 0, prior_year_actual: 0, yoy_growth_pct: 0 });
  const [forecastExitTotal, setForecastExitTotal] = useState(0);
  const [trends, setTrends] = useState({});
  const [widgetsModalOpen, setWidgetsModalOpen] = useState(false);
  const [widgetsSaving, setWidgetsSaving] = useState(false);
  // Same actualvalue/thousands/millions "View" filter the Forecasting &
  // Scenario Planning page already has — the backend already accepts
  // currency_filter on this endpoint, this was just hardcoded to
  // "actualvalue" on the frontend.
  const [currencyFilter, setCurrencyFilter] = useState("actualvalue");

  // fmt() (budgetHelpers) hardcodes 0 decimal places, which is right for
  // actual-value whole dollars but rounds a millions-scaled figure like
  // 176.59 down to "$177" — no unit context, and 99%+ of the precision
  // gone. Same 2-decimal convention Forecasting/Revenue Report use once
  // currency_filter scales a value down. Kept local to this page — fmt()
  // itself stays untouched since the rest of the Budget module always
  // shows actual-value whole dollars.
  const fmtScaled = useCallback((n) => {
    if (n == null || n === "") return "—";
    const num = typeof n === "string" ? Number(n.replace(/,/g, "")) : n;
    if (!Number.isFinite(num)) return "—";
    const dp = currencyFilter === "actualvalue" ? 0 : 2;
    return `$${num.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
  }, [currencyFilter]);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/overview/${budgetYear}?currency_filter=${currencyFilter}`, {
        headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setModules((data.modules || []).map((m) => ({
        ...m, ai_total: parseMoney(m.ai_total), user_total: parseMoney(m.user_total),
      })));
      setTotals({
        user: parseMoney(data.totals?.user) || 0,
        prior_year_actual: parseMoney(data.totals?.prior_year_actual) || 0,
        yoy_growth_pct: data.totals?.yoy_growth_pct || 0,
      });
      setForecastExitTotal(parseMoney(data.forecast_exit_total) || 0);
      setTrends({
        revenue: parseTrend(data.revenue_trend),
        workforce: parseTrend(data.workforce_trend),
        opex: parseTrend(data.opex_trend),
        capex: parseTrend(data.capex_trend),
      });
      return true;
    } catch (e) {
      setError(e.message || "Failed to load Budget Overview.");
      toast.error("Failed to load Budget Overview");
      return false;
    }
  }, [budgetYear, token, currencyFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await reload();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [reload]);

  // Patches local state straight from the PATCH response instead of calling
  // reload() — GET /overview/{year} recomputes all 4 modules at both annual
  // AND monthly granularity, so refetching it just to reflect a toggle/
  // chart-type change made every Manage Widgets action pay that full cost.
  // The endpoint now returns the updated widget row directly, which is all
  // that actually changed.
  const patchWidget = useCallback(async (name, body) => {
    setWidgetsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/overview/widgets`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ name, ...body }),
      });
      const data = await res.json().catch(() => null);
      const w = data?.widget;
      const field = WIDGET_KEY_TO_FIELD[name];
      if (res.ok && w && field) {
        setTrends((prev) => ({
          ...prev,
          [field]: { ...(prev[field] || parseTrend([])), meta: { position: w.position, chart_type: w.chart_type, enableordisable: w.enable_or_disable } },
        }));
        if (body.enableordisable !== undefined) toast.success(body.enableordisable ? "Widget shown" : "Widget hidden");
        else if (body.chart_type !== undefined) toast.success("Chart type updated");
      } else {
        toast.error(data?.detail || "Failed to update widget");
      }
    } catch {
      toast.error("Failed to update widget");
    } finally {
      setWidgetsSaving(false);
    }
  }, [token]);

  const widgetsList = useMemo(() => WIDGET_DEFS.map((w) => ({
    name: w.key,
    chart_type: trends[w.field]?.meta.chart_type || "bar_chart",
    position: trends[w.field]?.meta.position || 1,
    enable_or_disable: trends[w.field]?.meta.enableordisable !== false,
  })), [trends]);

  const handleToggle = (name, enabled) => patchWidget(name, { enableordisable: enabled });
  const handleChartType = (name, chart_type) => patchWidget(name, { chart_type });

  const chartRows = useMemo(() => modules.filter((m) => m.user_total != null), [modules]);

  const visibleWidgets = useMemo(() => (
    WIDGET_DEFS
      .map((w) => ({ ...w, trend: trends[w.field] || parseTrend([]) }))
      .filter((w) => w.trend.meta.enableordisable)
      .sort((a, b) => a.trend.meta.position - b.trend.meta.position)
  ), [trends]);

  // Drag-to-reorder happens directly on the dashboard cards (not the modal) —
  // same split Financial Dashboard uses. Reassigns sequential positions to
  // the visible widgets in their new order; hidden widgets keep trailing
  // positions so re-enabling one later doesn't collide.
  const handleDragEnd = useCallback(async (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const reorderedVisible = Array.from(visibleWidgets);
    const [moved] = reorderedVisible.splice(result.source.index, 1);
    reorderedVisible.splice(result.destination.index, 0, moved);
    const hiddenKeys = WIDGET_DEFS.map((w) => w.key).filter((k) => !reorderedVisible.some((w) => w.key === k));
    const orderedKeys = [...reorderedVisible.map((w) => w.key), ...hiddenKeys];

    setWidgetsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/overview/widgets/reorder`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ widgets: orderedKeys.map((name, i) => ({ name, position: i + 1 })) }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data?.widgets)) {
        setTrends((prev) => {
          const next = { ...prev };
          for (const w of data.widgets) {
            const field = WIDGET_KEY_TO_FIELD[w.name];
            if (!field) continue;
            next[field] = { ...(prev[field] || parseTrend([])), meta: { position: w.position, chart_type: w.chart_type, enableordisable: w.enable_or_disable } };
          }
          return next;
        });
        toast.success("Widget positions updated");
      } else {
        toast.error(data?.detail || "Failed to save widget order");
      }
    } catch {
      toast.error("Failed to save widget order");
    } finally {
      setWidgetsSaving(false);
    }
  }, [visibleWidgets, token]);

  const kpis = [
    { label: "User Budget Total", value: fmtScaled(totals.user), sub: "After department adjustments", icon: <FiEdit size={16} /> },
    { label: "Prior Year Actual", value: fmtScaled(totals.prior_year_actual), sub: `FY${budgetYear - 1} actuals`, icon: <FiClock size={16} /> },
    { label: "YoY Growth", value: fmtPct(totals.yoy_growth_pct, { sign: true }), sub: `${fmtPct(totals.yoy_growth_pct, { sign: true })} ${totals.yoy_growth_pct >= 0 ? "↑" : "↓"} vs prior year`, positive: totals.yoy_growth_pct >= 0, icon: totals.yoy_growth_pct >= 0 ? <FiArrowUp size={16} /> : <FiArrowDown size={16} /> },
    { label: `Forecast Exit (FY${budgetYear - 1})`, value: fmtScaled(forecastExitTotal), sub: "Budget starting point", icon: <FiDollarSign size={16} /> },
    ...chartRows.map((m) => ({
      label: MODULE_KPI_META[m.key]?.label || `Total ${m.title}`,
      value: fmtScaled(m.user_total),
      sub: STAGE_TO_PILL[m.stage] || m.stage,
      icon: MODULE_KPI_META[m.key]?.icon || <FiDollarSign size={16} />,
    })),
  ];

  const staticHeader = (
    <PageHeader title="Budget" subtitle="AI-Powered Budgeting — review recommendations, don't build from a blank sheet"
      right={
        <>
          <span className="h-9 px-3 rounded-lg bg-white/10 text-white text-s font-semibold flex items-center border border-white/20">{year}</span>
          <div className="flex items-center gap-2">
            <span className="text-x font-semibold text-white/90">View</span>
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              className="h-9 px-3 rounded-lg bg-white/95 text-sky-900 text-x outline-none border border-white/70"
            >
              <option value="actualvalue">Actual Value</option>
              <option value="thousands">Thousands</option>
              <option value="millions">Millions</option>
            </select>
          </div>
          <button onClick={() => setWidgetsModalOpen(true)}
            className="h-9 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-s font-semibold flex items-center gap-1.5 border border-white/20 transition-colors">
            <FiSettings size={14} /> Manage Widgets
          </button>
        </>
      } />
  );

  if (loading) {
    return (
      <div className="planning-compact forecasting-pnl-theme revenue-forecast-page space-y-4 min-h-screen bg-sky-50 font-sans text-sky-900 pb-12">
        {staticHeader}
        <TableSkeleton columns={4} rows={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="planning-compact forecasting-pnl-theme revenue-forecast-page space-y-4 min-h-screen bg-sky-50 font-sans text-sky-900 pb-12">
        {staticHeader}
        <EmptyState label={`Couldn't load Budget Overview — ${error}`} />
      </div>
    );
  }

  return (
    <div className="planning-compact forecasting-pnl-theme revenue-forecast-page space-y-4 min-h-screen bg-sky-50 font-sans text-sky-900 pb-12">
      {staticHeader}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {kpis.map((c) => <OverviewKpiCard key={c.label} {...c} />)}
      </div>

      {visibleWidgets.length > 0 && (
        <div>
          <div className="text-s font-semibold text-sky-900 mb-3">Module Budget Trends</div>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="budget-overview-widgets">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                  {visibleWidgets.map((w, idx) => (
                    <TrendChartCard key={w.key} widget={w} index={idx} saving={widgetsSaving} year={budgetYear}
                      onHide={(name) => handleToggle(name, false)} onChartType={handleChartType} />
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      )}

      <div>
        <div className="text-s font-semibold text-sky-900 mb-3">Planning Modules</div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {modules.map((m) => {
            const meta = MODULE_META[m.key] || {};
            return (
              <button key={m.key} onClick={() => navigate(m.path || meta.path)}
                className="text-left bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-sky-300 transition-all p-4 group">
                <div className="flex items-start justify-between mb-2">
                  <span className="w-9 h-9 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-700">{meta.icon}</span>
                  <div className="flex items-center gap-1.5">
                    {m.exception_count > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 ring-1 ring-red-200"
                        title="Guideline exceptions in this module">
                        {m.exception_count} exception{m.exception_count === 1 ? "" : "s"}
                      </span>
                    )}
                    <StatusPill status={STAGE_TO_PILL[m.stage] || m.stage} />
                  </div>
                </div>
                <div className="font-semibold text-slate-900 text-s flex items-center gap-1">
                  {m.title}
                  <FiChevronRight className="opacity-0 group-hover:opacity-100 transition-opacity text-sky-500" size={14} />
                </div>
                <p className="text-x text-slate-500 mt-1 leading-relaxed">{meta.desc}</p>
                {m.user_total != null && (
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 text-x">
                    <span className="text-slate-400">Budget <b className="text-sky-700 tabular-nums">{fmtScaled(m.user_total)}</b></span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <ManageWidgetsModal
        open={widgetsModalOpen}
        onClose={() => setWidgetsModalOpen(false)}
        widgets={widgetsList}
        saving={widgetsSaving}
        onToggle={handleToggle}
      />
    </div>
  );
};

export default BudgetOverview;
