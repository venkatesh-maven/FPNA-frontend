import React, { useEffect, useMemo, useRef, useState, useContext, useCallback } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Bar, Pie, Doughnut, Radar, Bubble } from "react-chartjs-2";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { BsStars, BsThreeDotsVertical } from "react-icons/bs";
import { FiPlus, FiX, FiSend, FiRefreshCw, FiEyeOff, FiTrendingUp, FiDollarSign, FiUsers, FiPackage } from "react-icons/fi";
import { RiDragMove2Fill } from "react-icons/ri";
import SmallAIChatBot from "../../pages/SmallAIChatBot";
import { AuthContext } from "../../context/AuthContext";
import { BudgetYearContext } from "../../context/BudgetYearContext";
import { API_BASE_URL } from "../../config/config";
import TableSkeleton from "../Skeleton/TableSkeleton";
import { getDecimalPrecision } from '../../utils/formatters';

ChartJS.register(
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Title,
  Tooltip,
  Legend,
);

/* ─── API URLs ─────────────────────────────────────────────────── */
const DASHBOARD_URL = (year, currency, cf) =>
  `${API_BASE_URL}/api/v1/forecasting/managemet/forecast_dashboard/${year}/${currency}?currency_filter=${cf}`;
const WIDGET_UPDATE_URL = `${API_BASE_URL}/api/v1/forecasting/managemet/forecast_dashboard/widgets/update`;

/* ─── Chart type mapping (API ↔ UI) ───────────────────────────── */
const API_TO_UI = {
  bar_chart: "bar",
  line_chart: "line",
  area_chart: "area",
  pie_chart: "pie",
  doughnut_chart: "doughnut",
  radar_chart: "radar",
  bubble_chart: "bubble",
};
const UI_TO_API = {
  bar: "bar_chart",
  line: "line_chart",
  area: "area_chart",
  pie: "pie_chart",
  // backend's ChartTypeEnum (src/constants.py) defines DOUGHNUT_CHART = "doughnut_chart" —
  // any other casing fails the `chart_Type not in valid_chart_types` check (400)
  doughnut: "doughnut_chart",
  radar: "radar_chart",
  bubble: "bubble_chart",
};

// Backend casing for chart_type is inconsistent (e.g. "Doughnut_Chart" vs
// "bar_chart"), so match case-insensitively instead of hardcoding every variant.
const apiChartTypeToUi = (apiType) => {
  if (!apiType) return "bar";
  const key = Object.keys(API_TO_UI).find(
    (k) => k.toLowerCase() === String(apiType).toLowerCase()
  );
  return key ? API_TO_UI[key] : "bar";
};

const CHART_TYPE_OPTIONS = [
  { id: "line", label: "Line Chart" },
  { id: "bar", label: "Bar Chart" },
  { id: "area", label: "Area Chart" },
  { id: "pie", label: "Pie Chart" },
  { id: "doughnut", label: "Doughnut Chart" },
  { id: "radar", label: "Radar Chart" },
  { id: "bubble", label: "Bubble Chart" },
];

// Same icon-in-a-circle KPI treatment Financial Dashboard's FinancialMetrics.jsx
// uses (FiTrendingUp for revenue/cash-flow, FiDollarSign for expense-like
// figures, FiUsers for headcount) — this page's summary metric cards were
// missing that icon badge entirely.
const METRIC_ICON = {
  "Revenue": <FiTrendingUp size={16} />,
  "Expenses": <FiDollarSign size={16} />,
  "Cash Flow": <FiTrendingUp size={16} />,
  "Headcount": <FiUsers size={16} />,
  "Payroll": <FiDollarSign size={16} />,
  "CAPEX": <FiPackage size={16} />,
};

/* ─── Static widget config (title, API/UI wiring) ────────────────
   Colors used to be hardcoded per widget here (a different hue for each
   of the 6 charts) plus a fake static "breakdown" for pie/doughnut mode.
   Both removed — Financial Dashboard's own charts never set an explicit
   bar/line/radar color at all (Chart.js's default palette renders the
   same blue everywhere), and pie/doughnut now plot the widget's real
   period values instead of made-up percentages. See renderChart(). ─── */
const WIDGET_CFG = {
  revenue_forecasting: {
    title: "Revenue Forecasting",
    apiKey: "revenue_forecasting",
    dataField: "revenue",
    analyzePath: "/revenueForecasting",
  },
  expense_forecasting: {
    title: "Expense Forecasting",
    apiKey: "expense_forecasting",
    dataField: "expenses",
    analyzePath: "/expenseForecasting",
  },
  capex_forecast: {
    title: "CAPEX Forecast",
    apiKey: "capex_forecast",
    dataField: "capex",
    analyzePath: "/CAPEX-forecast-screen",
  },
  cash_flow_projections: {
    title: "Cash Flow Projections",
    apiKey: "cash_flow_projections",
    dataField: "cash_flow",
    analyzePath: "/cashFlow-projections",
  },
  headcount_forecast: {
    title: "Headcount Forecast",
    apiKey: "headcount_forecast",
    dataField: "headcount",
    analyzePath: "/headcount-payroll",
  },
  payroll_forecast: {
    title: "Payroll Forecast",
    apiKey: "payroll_forecast",
    dataField: "payroll",
    analyzePath: "/headcount-payroll",
  },
};

const ALL_IDS = Object.keys(WIDGET_CFG);

/* ─── Helpers ──────────────────────────────────────────────────── */
const MONTH_SHORT = { "01":"Jan","02":"Feb","03":"Mar","04":"Apr","05":"May","06":"Jun","07":"Jul","08":"Aug","09":"Sep","10":"Oct","11":"Nov","12":"Dec" };

function periodToLabel(p) {
  const [, mm] = (p || "").split("-");
  return MONTH_SHORT[mm] || p;
}

function toChartNum(v) {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v.replace(/[$,\s]/g, "")) || 0;
  return 0;
}

function displayMetricVal(v, isMonetary = true) {
  if (v == null) return "-";
  if (typeof v === "string") {
    const cleaned = v.trim().replace(/[$,\s]/g, "");
    if (!cleaned || cleaned === "-" || cleaned === "—") return "-";
    if (/[a-zA-Z%]/.test(cleaned)) return isMonetary ? `$${v}` : v;
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed)) return isMonetary ? `$${v}` : v;
    v = parsed;
  }
  if (!isMonetary) return String(v);
  const dp = getDecimalPrecision();
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: dp, maximumFractionDigits: dp }).format(v);
}

function parseSection(arr, field) {
  if (!arr?.length) return { rows: [], meta: { position: 99, chart_type: "bar_chart", enableordisable: true } };
  const last = arr[arr.length - 1];
  const isMeta = last.position !== undefined || last.chart_type !== undefined;
  const rows = (isMeta ? arr.slice(0, -1) : arr).map((r) => ({
    label: periodToLabel(r.period),
    value: toChartNum(r[field]),
    display: r[field] ?? 0,
  }));
  const meta = isMeta ? last : { position: 99, chart_type: "bar_chart", enableordisable: true };
  return { rows, meta };
}

const fmtUSD = (n) => {
  const dp = getDecimalPrecision();
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: dp, maximumFractionDigits: dp }).format(n ?? 0);
};

/* ─── Shared chart options ─────────────────────────────────────── */
// Same exact axis-tick currency formatting + hidden x-gridlines Financial
// Dashboard's FinancialCharts.jsx getChartOptions() applies — this page's
// axes were showing plain "8,000,000" instead of "$8,000,000.00".
const chartCurrency = (n) => {
  const v = Number(n);
  return Number.isFinite(v) ? fmtUSD(v) : "—";
};
// Canvas text doesn't inherit the page font, so charts name it explicitly
// (Poppins, 12px — the Planning Engine / reports type scale).
const CHART_FONT = { family: "Poppins, sans-serif", size: 12 };

const getBaseOpts = (isCircular) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: "bottom", labels: { font: CHART_FONT } }, title: { display: false } },
  scales: !isCircular
    ? {
        x: { grid: { display: false }, ticks: { font: CHART_FONT } },
        y: { ticks: { font: CHART_FONT, callback: (val) => chartCurrency(val) } },
      }
    : undefined,
});
const baseOpts = getBaseOpts(false);

// Same palette FinancialCharts.jsx (SLICE_COLORS) uses for pie/doughnut
// slices — the only place either dashboard sets an explicit chart color.
// Bar/line/radar/bubble deliberately set none, so Chart.js's own default
// palette renders identically to the Financial Dashboard everywhere else.
const SLICE_COLORS = ["#38bdf8", "#0ea5e9", "#0284c7", "#7dd3fc", "#fb923c", "#f97316", "#facc15", "#34d399", "#a3e635", "#f472b6"];

/* ─── Tiny components ──────────────────────────────────────────── */
function Spin({ label = "Loading..." }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16">
      <div className="w-8 h-8 rounded-full border-4 border-sky-200 border-t-sky-700 animate-spin" />
      <span className="text-x text-sky-600">{label}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
════════════════════════════════════════════════════════════════ */
const ForecastingScenarioOverview = () => {
  const { token, selectedCurrency: ctxCurrency } = useContext(AuthContext);
  const { budgetYear, fiscalYearStartMonth } = useContext(BudgetYearContext);

  const year = budgetYear - 1;
  const currency = ctxCurrency || "USD";

  const [currencyFilter, setCurrencyFilter] = useState("actualvalue");
  const [loading, setLoading] = useState(true);
  const [summaryMetrics, setSummaryMetrics] = useState(null);
  const [widgetData, setWidgetData] = useState({});

  const [widgetOrder, setWidgetOrder] = useState(ALL_IDS);
  const [enabledWidgets, setEnabledWidgets] = useState(
    Object.fromEntries(ALL_IDS.map((id) => [id, true]))
  );
  const [chartTypes, setChartTypes] = useState(
    Object.fromEntries(ALL_IDS.map((id) => [id, "bar"]))
  );

  const [showAIChatbot, setShowAIChatbot] = useState(false);
  const aiChatbotRef = useRef(null);
  const [widgetAI, setWidgetAI] = useState(null);
  const [widgetAIText, setWidgetAIText] = useState("");
  const [metricAI, setMetricAI] = useState(null);
  const [metricAIText, setMetricAIText] = useState("");
  const [showManage, setShowManage] = useState(false);
  const manageRef = useRef(null);
  const [ctMenuOpen, setCtMenuOpen] = useState(null);
  const dragIdRef = useRef(null);

  /* ── Fetch dashboard ────────────────────────────────────────── */
  const fetchDashboard = useCallback(async ({ silent = false } = {}) => {
    if (!token) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(DASHBOARD_URL(year, currency, currencyFilter), {
        headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      setSummaryMetrics(json.summary_metrics);

      const parsed = {};
      parsed.revenue_forecasting   = parseSection(json.revenue_forecasting,   "revenue");
      parsed.expense_forecasting   = parseSection(json.expense_forecasting,   "expenses");
      parsed.capex_forecast        = parseSection(json.capex_forecast,        "capex");
      parsed.cash_flow_projections = parseSection(json.cash_flow_projections, "cash_flow");
      parsed.headcount_forecast    = parseSection(json.headcount_forecast,    "headcount");
      parsed.payroll_forecast      = parseSection(json.payroll_forecast,      "payroll");

      setWidgetData(parsed);

      const sorted = ALL_IDS.slice().sort((a, b) =>
        (parsed[a]?.meta?.position ?? 99) - (parsed[b]?.meta?.position ?? 99)
      );
      setWidgetOrder(sorted);

      const enabled = {};
      const types = {};
      ALL_IDS.forEach((id) => {
        enabled[id] = parsed[id]?.meta?.enableordisable ?? true;
        types[id]   = apiChartTypeToUi(parsed[id]?.meta?.chart_type);
      });
      setEnabledWidgets(enabled);
      setChartTypes(types);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token, year, currency, currencyFilter, fiscalYearStartMonth]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  /* ── PATCH widget ────────────────────────────────────────────── */
  const patchWidget = useCallback(async (widgetId, overrides) => {
    if (!token) return false;
    const meta = widgetData[widgetId]?.meta || {};
    const body = {
      year,
      name: widgetId,
      // Prefer the last server-confirmed chart_type (meta.chart_type) over the
      // local UI state — the backend's update endpoint requires the full
      // widget snapshot on every call, so falling back to a possibly-stale
      // client value here would silently overwrite an unrelated field.
      chart_Type: overrides.chart_Type ?? meta.chart_type ?? UI_TO_API[chartTypes[widgetId]] ?? "bar_chart",
      enableordisable: overrides.enableordisable ?? meta.enableordisable ?? enabledWidgets[widgetId] ?? true,
      position: overrides.position ?? meta.position ?? 1,
    };
    try {
      const res = await fetch(WIDGET_UPDATE_URL, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.detail || `HTTP ${res.status}`);
      }
      const data = await res.json().catch(() => null);
      // The PATCH response already echoes back exactly what the server
      // persisted, so we can trust it directly instead of paying for a full
      // dashboard rebuild (4 quarters of metrics) just to confirm one field.
      if (data?.updated_widget) {
        setWidgetData((prev) => ({
          ...prev,
          [widgetId]: {
            ...prev[widgetId],
            meta: {
              position: data.updated_widget.position,
              chart_type: data.updated_widget.chart_Type,
              enableordisable: data.updated_widget.enableordisable,
            },
          },
        }));
      }
      return true;
    } catch (err) {
      console.error("Widget patch error:", err);
      toast.error("Failed to update widget");
      return false;
    }
  }, [token, year, widgetData, chartTypes, enabledWidgets]);

  /* ── Outside click: close manage modal + chart-type menus ───── */
  useEffect(() => {
    const onDown = (e) => {
      if (showManage && manageRef.current && !manageRef.current.contains(e.target))
        setShowManage(false);
      if (!e.target.closest?.("[data-ct-menu]"))
        setCtMenuOpen(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showManage]);

  /* ── Chart type change ──────────────────────────────────────── */
  const changeChartType = async (widgetId, type) => {
    const previous = chartTypes[widgetId];
    setChartTypes((p) => ({ ...p, [widgetId]: type }));
    setCtMenuOpen(null);
    const ok = await patchWidget(widgetId, { chart_Type: UI_TO_API[type] });
    if (!ok) {
      setChartTypes((p) => ({ ...p, [widgetId]: previous }));
    } else {
      const label = CHART_TYPE_OPTIONS.find((c) => c.id === type)?.label || type;
      toast.success(`${WIDGET_CFG[widgetId]?.title || widgetId} updated to ${label}`);
    }
  };

  /* ── Toggle enable/disable ──────────────────────────────────── */
  const toggleEnabled = async (widgetId) => {
    const next = !enabledWidgets[widgetId];
    setEnabledWidgets((p) => ({ ...p, [widgetId]: next }));
    const ok = await patchWidget(widgetId, { enableordisable: next });
    if (ok) {
      toast.success(next ? "Widget enabled" : "Widget disabled");
    } else {
      setEnabledWidgets((p) => ({ ...p, [widgetId]: !next }));
    }
  };

  /* ── Drag & drop ────────────────────────────────────────────── */
  const onDragStart = (id) => { dragIdRef.current = id; };
  const onDropOn = (targetId) => {
    const dragged = dragIdRef.current;
    if (!dragged || dragged === targetId) return;
    dragIdRef.current = null;
    setWidgetOrder((prev) => {
      const from = prev.indexOf(dragged);
      const to   = prev.indexOf(targetId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      next.splice(from, 1);
      next.splice(to, 0, dragged);
      setTimeout(() => {
        patchWidget(dragged,  { position: to + 1 });
        patchWidget(targetId, { position: from + 1 });
      }, 0);
      return next;
    });
  };

  /* ── Render chart ────────────────────────────────────────────── */
  const renderChart = (widgetId) => {
    const cfg  = WIDGET_CFG[widgetId];
    const data = widgetData[widgetId];
    const type = chartTypes[widgetId];

    if (!data?.rows?.length)
      return (
        <div className="h-[200px] flex items-center justify-center text-x text-sky-600">
          No data available
        </div>
      );

    const labels   = data.rows.map((r) => r.label);
    const values   = data.rows.map((r) => r.value);
    const displays = data.rows.map((r) => r.display);

    const tooltipLabel = (ctx) => {
      const raw = displays[ctx.dataIndex];
      const formatted = typeof raw === "string" ? `$${raw}` : fmtUSD(raw);
      return ` ${ctx.dataset.label}: ${formatted}`;
    };
    const withTooltip = (opts) => ({
      ...opts,
      plugins: {
        ...opts.plugins,
        tooltip: { titleFont: CHART_FONT, bodyFont: CHART_FONT, callbacks: { label: tooltipLabel } },
      },
    });
    const chartOpts = withTooltip(baseOpts);

    if (type === "pie" || type === "doughnut") {
      // Real period breakdown (not the old static mock bdLabels/bdData) —
      // same SLICE_COLORS palette FinancialCharts.jsx uses for its own
      // pie/doughnut slices.
      const d = {
        labels,
        datasets: [{ data: values, backgroundColor: labels.map((_, i) => SLICE_COLORS[i % SLICE_COLORS.length]), borderWidth: 0 }],
      };
      const circularOpts = withTooltip(getBaseOpts(true));
      return (
        <div className="h-[200px]">
          {type === "pie" ? <Pie data={d} options={circularOpts} /> : <Doughnut data={d} options={circularOpts} />}
        </div>
      );
    }

    if (type === "bar") {
      // No explicit color — same as Financial Dashboard's own bar charts,
      // which never set backgroundColor either, so Chart.js's default
      // palette renders the identical blue on both dashboards instead of
      // each widget getting its own custom hue.
      const d = {
        labels,
        datasets: [{ label: cfg.title, data: values, borderRadius: 6 }],
      };
      return <div className="h-[200px]"><Bar data={d} options={chartOpts} /></div>;
    }

    if (type === "radar") {
      const d = { labels, datasets: [{ label: cfg.title, data: values, borderWidth: 2 }] };
      return <div className="h-[200px]"><Radar data={d} options={baseOpts} /></div>;
    }

    if (type === "bubble") {
      const d = {
        datasets: [{
          label: cfg.title,
          data: values.map((v, i) => ({ x: i, y: v, r: Math.min(20, Math.max(4, Math.abs(v) / 1000)) })),
        }],
      };
      return <div className="h-[200px]"><Bubble data={d} options={chartOpts} /></div>;
    }

    const d = {
      labels,
      datasets: [{
        label: cfg.title,
        data: values,
        borderWidth: 2,
        tension: 0.35,
        pointRadius: 2,
        fill: type === "area",
      }],
    };
    return <div className="h-[200px]"><Line data={d} options={chartOpts} /></div>;
  };

  /* ── Summary metrics ─────────────────────────────────────────── */
  const metrics = useMemo(() => {
    if (!summaryMetrics) return [];
    const { forecast_revenue, forecast_expenses, forecast_cashflow, forecast_headcount, forecast_payroll, forecast_capex } = summaryMetrics;
    return [
      { title: "Revenue",   value: displayMetricVal(forecast_revenue) },
      { title: "Expenses",  value: displayMetricVal(forecast_expenses) },
      { title: "Cash Flow", value: displayMetricVal(forecast_cashflow) },
      { title: "Headcount", value: displayMetricVal(forecast_headcount, false) },
      { title: "Payroll",   value: displayMetricVal(forecast_payroll) },
      { title: "CAPEX",     value: displayMetricVal(forecast_capex) },
    ];
  }, [summaryMetrics]);

  const visibleWidgets = widgetOrder.filter((id) => enabledWidgets[id]);

  /* ── Manage Widgets modal ────────────────────────────────────── */
  const [manageSearch, setManageSearch] = useState("");

  const manageList = useMemo(
    () => widgetOrder.map((wid) => ({
      id: wid,
      title: WIDGET_CFG[wid]?.title || wid,
      chartType: chartTypes[wid],
      enabled: !!enabledWidgets[wid],
    })),
    [widgetOrder, chartTypes, enabledWidgets]
  );

  const manageEnabledCount = useMemo(
    () => manageList.filter((w) => w.enabled).length,
    [manageList]
  );

  const filteredManageList = useMemo(() => {
    const s = manageSearch.trim().toLowerCase();
    if (!s) return manageList;
    return manageList.filter((w) => w.title.toLowerCase().includes(s));
  }, [manageList, manageSearch]);

  const ManageModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        onClick={() => setShowManage(false)}
        aria-label="Close"
        className="absolute inset-0 bg-black/55 backdrop-blur-[6px]"
      />

      <motion.div
        ref={manageRef}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        className="relative w-full max-w-6xl overflow-hidden rounded-3xl border border-white/20 bg-white shadow-[0_30px_90px_-35px_rgba(0,0,0,0.55)]"
      >
        {/* Header */}
        <div className="relative px-6 py-5">
          <div className="absolute inset-0 bg-gradient-to-r from-sky-950 to-sky-800" />
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.65),transparent_55%)]" />

          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-white">
                Manage Forecasting Widgets
              </h2>
              <p className="mt-1 text-s text-white/80">
                Enable / Disable charts • Drag order is handled on dashboard
              </p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-x text-white/90 ring-1 ring-white/20">
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                Enabled: <span className="font-semibold">{manageEnabledCount}</span> /{" "}
                <span className="font-semibold">{manageList.length}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-full md:w-[320px]">
                <input
                  value={manageSearch}
                  onChange={(e) => setManageSearch(e.target.value)}
                  placeholder="Search widget..."
                  className="w-full rounded-2xl bg-white/15 px-4 py-2 text-s text-white placeholder:text-white/60 outline-none ring-1 ring-white/20 focus:ring-2 focus:ring-white/50"
                />
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-white/60">
                  ⌕
                </div>
              </div>

              <button
                onClick={() => setShowManage(false)}
                className="rounded-2xl bg-white/10 px-3 py-2 text-white/90 hover:bg-white/15 transition focus:outline-none focus:ring-2 focus:ring-white/50"
                title="Close"
              >
                <FiX />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filteredManageList.map((w) => {
                const chartLabel = CHART_TYPE_OPTIONS.find((c) => c.id === w.chartType)?.label || "—";
                return (
                  <div
                    key={w.id}
                    className={[
                      "group relative rounded-2xl border bg-white p-4 shadow-sm transition",
                      w.enabled
                        ? "border-emerald-100 hover:border-emerald-200 hover:shadow-md"
                        : "border-slate-100 hover:border-slate-200 hover:shadow-md",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "pointer-events-none absolute inset-0 rounded-2xl opacity-0 blur-2xl transition group-hover:opacity-100",
                        w.enabled ? "bg-emerald-200/30" : "bg-slate-200/30",
                      ].join(" ")}
                    />

                    <div className="relative flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-s font-semibold text-slate-900">{w.title}</h3>
                          <span
                            className={[
                              "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ring-1",
                              w.enabled
                                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                : "bg-slate-50 text-slate-600 ring-slate-200",
                            ].join(" ")}
                          >
                            {w.enabled ? "Enabled" : "Disabled"}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-x text-slate-600">
                          <span className="rounded-full bg-slate-50 px-2 py-1 ring-1 ring-slate-200">
                            Type: <span className="font-semibold">{chartLabel}</span>
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => toggleEnabled(w.id)}
                        className={[
                          "relative inline-flex h-6 w-12 items-center rounded-full border transition-colors",
                          "focus:outline-none focus:ring-2 focus:ring-sky-500/40",
                          // Bracket values, not bg-emerald-*/bg-slate-* — this page
                          // is wrapped in .forecasting-pnl-theme, whose global CSS
                          // force-overrides any bg-slate-*/bg-sky-*/bg-emerald-*
                          // class found on a <button> to navy (substring match,
                          // fires even inside conditional class strings like this).
                          w.enabled ? "bg-[#059669] border-[#059669]" : "bg-[#e2e8f0] border-[#e2e8f0]",
                        ].join(" ")}
                        aria-pressed={w.enabled}
                        aria-label={w.enabled ? "Disable widget" : "Enable widget"}
                      >
                        <span
                          className={[
                            "inline-block h-5 w-5 transform rounded-full bg-white shadow",
                            "transition-transform duration-200",
                            w.enabled ? "translate-x-6" : "translate-x-1",
                          ].join(" ")}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredManageList.length === 0 && (
              <div className="py-14 text-center text-s text-slate-500">No widgets found.</div>
            )}
          </div>

          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-x text-slate-500">
              Tip: Disabled widgets won’t appear on the dashboard charts.
            </div>
            <button
              onClick={() => setShowManage(false)}
              className="rounded-2xl bg-sky-950 px-5 py-2.5 text-s font-semibold text-white shadow-sm hover:bg-sky-900 transition focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            >
              Done
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div className="forecasting-pnl-theme space-y-6 min-h-screen bg-sky-50 text-sky-900 relative">
      {showAIChatbot && (
        <div className="fixed right-0 top-16 h-[90%] z-50" ref={aiChatbotRef}>
          <SmallAIChatBot onClose={() => setShowAIChatbot(false)} />
        </div>
      )}

      <AnimatePresence>{showManage && <ManageModal />}</AnimatePresence>

      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-sky-950 via-sky-900 to-sky-700 p-4 rounded-lg shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-white">Forecasting &amp; Scenario Planning</h1>
            <p className="text-s text-white/80">Revenue, expense &amp; cash flow projections</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center h-9 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200">
              Year {year}
            </span>

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

            <button
              onClick={fetchDashboard}
              className="flex items-center h-9 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition"
            >
              <FiRefreshCw className="mr-1.5" size={13} />
              Refresh
            </button>

            <button
              onClick={() => setShowManage(true)}
              className="flex items-center h-9 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition"
            >
              <FiPlus className="mr-1.5" />
              Manage Widgets
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <TableSkeleton columns={6} rows={6} />
      ) : (
        <>
          {/* ── Summary Metrics ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
            {metrics.map((m) => (
              <motion.div
                key={m.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="bg-white rounded-xl border border-sky-200 shadow-sm hover:shadow-md transition p-3 relative"
                onMouseLeave={() => setMetricAI(null)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="w-full min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <div className="text-xs font-semibold text-sky-600 uppercase tracking-wider truncate">{m.title}</div>
                      <div
                        className="relative flex-shrink-0"
                        onMouseEnter={() => setMetricAI(m.title)}
                        onMouseLeave={() => setMetricAI(null)}
                      >
                        <button className="p-1.5 rounded-lg text-[#0369a1] hover:text-[#075985] hover:bg-[#f0f9ff] transition-colors" type="button">
                          <BsStars size={13} />
                        </button>
                        <AnimatePresence>
                          {metricAI === m.title && (
                            <motion.div
                              initial={{ opacity: 0, y: -6, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -6, scale: 0.98 }}
                              transition={{ duration: 0.15 }}
                              className="absolute right-0 top-9 w-[240px] bg-white rounded-xl shadow-lg border border-sky-200 z-30 p-3"
                              onClick={(e) => e.stopPropagation()}
                              onMouseEnter={() => setMetricAI(m.title)}
                              onMouseLeave={() => setMetricAI(null)}
                            >
                              <div className="text-x font-semibold text-sky-700 mb-2">Ask AI about {m.title}</div>
                              <div className="flex items-center gap-2">
                                <input
                                  value={metricAIText}
                                  onChange={(e) => setMetricAIText(e.target.value)}
                                  placeholder="Ask AI..."
                                  className="w-full px-3 py-1.5 border border-sky-200 rounded-lg text-x outline-none focus:ring-2 focus:ring-sky-200"
                                />
                                <button
                                  onClick={() => { console.log("Ask AI metric:", m.title, metricAIText); setMetricAIText(""); setMetricAI(null); }}
                                  disabled={!metricAIText.trim()}
                                  className="p-1.5 rounded-lg bg-sky-900 text-white hover:bg-sky-800 disabled:opacity-50"
                                  type="button"
                                >
                                  <FiSend size={12} />
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                    {/* No truncate here — matches FinancialMetrics.jsx's KPICard
                        exactly. Cutting a dollar figure off with "…" hides real
                        digits, which is worse than letting it wrap. */}
                    <div className="text-s font-bold text-sky-900 mt-1">{m.value}</div>
                  </div>
                  <div className="rounded-full bg-sky-100 p-2 shrink-0">
                    <div className="text-sky-600">{METRIC_ICON[m.title] || <FiDollarSign size={16} />}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* ── Widgets Grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {visibleWidgets.map((wid) => {
              const cfg = WIDGET_CFG[wid];
              const currentType = chartTypes[wid];

              return (
                <motion.div
                  key={wid}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28 }}
                  className="bg-white rounded-xl border border-sky-200 shadow-sm hover:shadow-md transition"
                  draggable
                  onDragStart={() => onDragStart(wid)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDropOn(wid)}
                >
                  {/* Card Header */}
                  <div className="p-4 border-b border-sky-100 flex items-start justify-between gap-2 bg-sky-50 rounded-t-xl">
                    <div className="text-s font-semibold text-sky-900">{cfg.title}</div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Ask AI hover popup */}
                      <div
                        className="relative"
                        onMouseEnter={() => setWidgetAI(wid)}
                        onMouseLeave={() => setWidgetAI(null)}
                      >
                        <button className="p-2 rounded-lg text-[#0369a1] hover:text-[#075985] hover:bg-[#f0f9ff] transition-colors" type="button">
                          <BsStars size={14} />
                        </button>
                        <AnimatePresence>
                          {widgetAI === wid && (
                            <motion.div
                              initial={{ opacity: 0, y: -6, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -6, scale: 0.98 }}
                              transition={{ duration: 0.15 }}
                              className="absolute right-0 top-10 w-[250px] bg-white rounded-xl shadow-lg border border-sky-200 z-30 p-3"
                              onClick={(e) => e.stopPropagation()}
                              onMouseEnter={() => setWidgetAI(wid)}
                              onMouseLeave={() => setWidgetAI(null)}
                            >
                              <div className="text-x font-semibold text-sky-700 mb-2">Ask AI about {cfg.title}</div>
                              <div className="flex items-center gap-2">
                                <input
                                  value={widgetAIText}
                                  onChange={(e) => setWidgetAIText(e.target.value)}
                                  placeholder="Ask AI..."
                                  className="w-full px-3 py-1.5 border border-sky-200 rounded-lg text-x outline-none focus:ring-2 focus:ring-sky-200"
                                />
                                <button
                                  onClick={() => { console.log("Ask AI widget:", wid, widgetAIText); setWidgetAIText(""); setWidgetAI(null); }}
                                  disabled={!widgetAIText.trim()}
                                  className="p-1.5 rounded-lg bg-sky-900 text-white hover:bg-sky-800 disabled:opacity-50"
                                  type="button"
                                >
                                  <FiSend size={12} />
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Hide widget — same eye-off toolbar icon Financial
                          Dashboard's ChartCard uses; toggles the same
                          enable/disable flag the Manage Widgets modal does. */}
                      <button
                        onClick={() => toggleEnabled(wid)}
                        title="Hide widget"
                        className="p-2 rounded-lg text-[#0369a1] hover:text-[#075985] hover:bg-[#f0f9ff] transition-colors"
                        type="button"
                      >
                        <FiEyeOff size={14} />
                      </button>

                      {/* Chart type + Analyze dropdown */}
                      <div className="relative" data-ct-menu>
                        <button
                          onClick={() => setCtMenuOpen((p) => (p === wid ? null : wid))}
                          className="p-2 rounded-lg text-[#0369a1] hover:text-[#075985] hover:bg-[#f0f9ff] transition-colors"
                          type="button"
                        >
                          <BsThreeDotsVertical size={14} />
                        </button>

                        {ctMenuOpen === wid && (
                          <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-lg z-30 border border-sky-200 overflow-hidden">
                            {CHART_TYPE_OPTIONS.map((x) => (
                              <button
                                key={x.id}
                                onClick={() => changeChartType(wid, x.id)}
                                className={`block w-full text-left px-4 py-2 text-x hover:bg-[#f0f9ff] ${
                                  currentType === x.id ? "text-sky-900 font-semibold bg-[#f0f9ff]" : "text-sky-700"
                                }`}
                              >
                                {x.label}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => (window.location.href = cfg.analyzePath)}
                              className="w-full h-9 px-4 bg-[#f0f9ff] text-sky-700 text-x font-medium hover:bg-[#e0f2fe] transition"
                            >
                              Analyze
                            </button>
                          </div>
                        )}

                        <button
                          className="p-2 rounded-lg text-[#0369a1] hover:text-[#075985] hover:bg-[#f0f9ff] cursor-grab transition-colors"
                          title="Drag to reorder"
                        >
                          <RiDragMove2Fill size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Chart area */}
                  <div className="p-4">
                    <motion.div
                      key={`${wid}-${currentType}-${currencyFilter}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22 }}
                      className="rounded-xl border border-sky-100 p-3 bg-white"
                    >
                      {renderChart(wid)}
                    </motion.div>
                  </div>

                  {/* <div className="h-1 w-full bg-gradi ent-to-r from-sky-400 via-blue-400 to-purple-400 opacity-0 hover:opacity-100 transition" /> */}
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default ForecastingScenarioOverview;

