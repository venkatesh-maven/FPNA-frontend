import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  RadialLinearScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line, Pie, Doughnut, Radar, Bubble } from "react-chartjs-2";
import { BsThreeDotsVertical } from "react-icons/bs";
import { RiDragMove2Fill } from "react-icons/ri";
import { FiEye, FiEyeOff, FiFilter } from "react-icons/fi";

import { AuthContext } from "../context/AuthContext";
import { API_BASE_URL } from "../config/config";
import { getDecimalPrecision } from '../utils/formatters';
import WidgetAskAI from "../components/Dashboard/WidgetAskAI";
import { buildChartContext, buildChartQuestions } from "../utils/chartAiContext";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  RadialLinearScale,
  Tooltip,
  Legend,
  Filler
);

/* =========================
   HELPERS (NO K/M scaling)
   ========================= */
const isNil = (v) => v === null || v === undefined;

const titleize = (s = "") =>
  String(s)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());

// If API returns string -> keep it 그대로 for display
// If API returns number -> format with currency symbol
export const renderValue = (value, currency = "USD") => {
  if (isNil(value) || value === "") return "—";
  if (typeof value === "string") {
    const cleaned = value.trim().replace(/[$,\s]/g, "");
    if (!cleaned || cleaned === "—" || cleaned === "-") return "—";
    if (/[a-zA-Z%]/.test(cleaned)) return value;
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed)) return value;
    value = parsed;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const dp = getDecimalPrecision();
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(n);
};

// For charts only (plotting numeric points)
export const toNumberForChart = (v) => {
  if (isNil(v) || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const num = parseFloat(v.replace(/[^\d.-]/g, ""));
    return Number.isFinite(num) ? num : 0;
  }
  return 0;
};

/* =========================
   LOADER
   ========================= */
const CardSkeleton = () => (
  <div className="bg-white rounded-xl shadow-sm border border-sky-100 p-4 animate-pulse">
    <div className="h-4 w-2/3 bg-slate-200 rounded mb-3" />
    <div className="h-44 w-full bg-slate-100 rounded mb-3" />
    <div className="h-6 w-1/2 bg-slate-200 rounded" />
  </div>
);

/* =========================
   CHART OPTIONS
   ========================= */
const getChartOptions = (chartType, currency, labels = []) => {
  const isCircle = chartType === "pie" || chartType === "doughnut";
  const isBubble = chartType === "bubble";

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          padding: 14,
          usePointStyle: true,
          pointStyle: "circle",
          font: { size: 10 },
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const raw = ctx?.parsed?.y ?? ctx?.parsed ?? 0;
            const n = Number(raw);
            const label = ctx.dataset.label || "Value";
            if (!Number.isFinite(n)) return `${label}: —`;
            return `${label}: ${renderValue(n, currency)}`;
          },
          // Bubble points carry {x, y, r} — x is a label index, not the value.
          title: isBubble
            ? (items) => {
                const idx = items?.[0]?.parsed?.x;
                return labels[idx] ?? "";
              }
            : undefined,
        },
      },
    },
    scales: !isCircle
      ? {
          x: isBubble
            ? {
                type: "linear",
                grid: { display: false },
                ticks: {
                  font: { size: 10 },
                  stepSize: 1,
                  callback: (val) => labels[val] ?? "",
                },
              }
            : { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: {
            grid: { color: "rgba(0,0,0,0.06)" },
            ticks: {
              font: { size: 10 },
              callback: (val) => {
                const n = Number(val);
                if (!Number.isFinite(n)) return val;
                return renderValue(n, currency);
              },
            },
          },
        }
      : undefined,
  };
};

// Bubble charts need {x, y, r} points, not the flat number-per-period arrays
// the other chart types share — without this, Chart.js silently plots nothing.
const toBubblePoints = (data) => {
  const maxAbs = Math.max(
    1,
    ...data.datasets.flatMap((d) => (d.data || []).map((v) => Math.abs(Number(v) || 0)))
  );
  return {
    ...data,
    datasets: data.datasets.map((d) => ({
      ...d,
      data: (d.data || []).map((v, i) => {
        const n = Number(v) || 0;
        return { x: i, y: n, r: 4 + (Math.abs(n) / maxAbs) * 14 };
      }),
    })),
  };
};

const renderChart = (type, data, currency) => {
  if (!data?.labels?.length || !data?.datasets?.[0]?.data?.length) {
    return (
      <div className="h-full flex items-center justify-center text-x text-sky-400">
        Loading...
      </div>
    );
  }

  const options = getChartOptions(type, currency, data.labels);

  const Comp =
    {
      line: Line,
      bar: Bar,
      pie: Pie,
      doughnut: Doughnut,
      radar: Radar,
      bubble: Bubble,
      area: Line,
    }[type] || Bar;

  if (type === "area") {
    const patched = {
      ...data,
      datasets: (data.datasets || []).map((d) => ({ ...d, fill: true })),
    };
    return <Comp data={patched} options={options} />;
  }

  if (type === "bubble") {
    return <Comp data={toBubblePoints(data)} options={options} />;
  }

  return <Comp data={data} options={options} />;
};

/* =========================
   HEADER
   ========================= */
const KPIHeader = ({
  currency,
  selectedYear,
  showFilters,
  setShowFilters,
  onManage,
  onApply,
}) => {
  return (
    <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-lg font-bold text-white">Key Financial KPIs</h1>
          <p className="text-sky-100 text-x">
            Year: {selectedYear} • Currency: {currency}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors"
            onClick={() => setShowFilters(!showFilters)}
          >
            <FiFilter className="mr-1" />
            Filters
          </button>

          <button
            onClick={onManage}
            className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors"
          >
            + Manage Widgets
          </button>

          <button
            onClick={onApply}
            className="flex items-center py-2 px-3 text-x font-medium text-sky-900 bg-white rounded-lg border border-sky-200 hover:bg-sky-900 hover:text-white transition-colors"
            title="Apply filters"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================
   FILTERS PANEL (Apply-only)
   ========================= */
const KPIFilters = ({
  showFilters,
  draftCurrencyFilter,
  setDraftCurrencyFilter,
  draftPeriodFilter,
  setDraftPeriodFilter,
  onApply,
}) => {
  if (!showFilters) return null;

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-x font-medium text-gray-700 mb-1">
            Time Filter
          </label>
          <select
            value={draftPeriodFilter}
            onChange={(e) => setDraftPeriodFilter(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md text-x"
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="year_to_date">Year to Date</option>
          </select>
        </div>

        <div>
          <label className="block text-x font-medium text-gray-700 mb-1">
            Currency Filter (API)
          </label>
          <select
            value={draftCurrencyFilter}
            onChange={(e) => setDraftCurrencyFilter(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md text-x"
          >
            <option value="actualvalue">Actual</option>
            <option value="thousands">Thousands (K)</option>
            <option value="millions">Millions (M)</option>
          </select>
        </div>

        <div className="flex items-end justify-end">
          <button
            onClick={onApply}
            className="bg-sky-900 text-white px-4 py-2 rounded hover:bg-sky-800 text-x"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================
   KPI CARD
   - Eye removes card from UI list (no placeholder)
   - 3 dots on hover
   ========================= */
const KPICard = ({
  widget,
  index,
  metric,
  chartType,
  currency,
  year,
  onChartTypeChange,
  isHidden,
  onToggleHidden,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const closeTimer = useRef(null);

  const openMenu = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setMenuOpen(true);
  };
  const closeMenu = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setMenuOpen(false);
      setSubOpen(false);
    }, 160);
  };

  // IMPORTANT: This component will not be rendered at all when hidden.
  // Still keep icon state for toggling back from some place (optional).
  // Here the icon is shown as "eye-off" when card exists (rare), but we keep it consistent.

  return (
    <Draggable draggableId={widget.name} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className="bg-white p-4 rounded-xl shadow-sm border border-sky-100 hover:shadow-md transition"
        >
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-s font-semibold text-sky-800">
              {metric?.title || titleize(widget.name)}
            </h3>

            <div className="flex items-center gap-2 relative">
              {/* Ask AI */}
              <WidgetAskAI
                title={metric?.title || titleize(widget.name)}
                context={buildChartContext(metric?.title || titleize(widget.name), metric?.data, year)}
                questions={buildChartQuestions(metric?.title || titleize(widget.name))}
              />

              {/* Eye -> remove from charts list */}
              <button
                onClick={() => onToggleHidden(widget.name)}
                className="p-1 rounded hover:bg-gray-100 text-sky-700"
                title="Remove this chart"
              >
                {/* when card is visible, show FiEye. after click it disappears */}
                {isHidden ? <FiEyeOff /> : <FiEye />}
              </button>

              {/* 3 dots -> hover */}
              <div className="relative" onMouseEnter={openMenu} onMouseLeave={closeMenu}>
                <button className="p-1 rounded hover:bg-gray-100" title="Options">
                  <BsThreeDotsVertical />
                </button>

                {menuOpen && (
                  <div
                    className="absolute right-0 top-7 w-44 bg-white rounded-lg shadow-lg border z-20"
                    onMouseEnter={openMenu}
                    onMouseLeave={closeMenu}
                  >
                    <div
                      className="px-3 py-2 text-x hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                      onMouseEnter={() => setSubOpen(true)}
                      onMouseLeave={() => setSubOpen(false)}
                    >
                      Change Chart Type <span className="text-gray-400">▾</span>
                    </div>

                    {/* {subOpen && ( */}
                      <div className="border-t">
                        {["line", "bar", "area", "pie", "doughnut", "radar", "bubble"].map((t) => (
                          <button
                            key={t}
                            className="block w-full text-left px-3 py-2 text-x hover:bg-gray-50"
                            onClick={() => onChartTypeChange(widget.name, t)}
                          >
                            {t.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    {/* )} */}
                  </div>
                )}
              </div>

              {/* Drag */}
              <div
                {...provided.dragHandleProps}
                className="p-1 rounded hover:bg-gray-100 cursor-move"
                title="Drag"
              >
                <RiDragMove2Fill />
              </div>
            </div>
          </div>

          <div className="h-56">{renderChart(chartType, metric?.data, currency)}</div>
        </div>
      )}
    </Draggable>
  );
};

/* =========================
   MAIN PAGE
   ========================= */
const KeyFinancialKPIs = () => {
  const { token, selectedYear, selectedCurrency } = useContext(AuthContext);

  const [widgets, setWidgets] = useState([]);
  const [loadingWidgets, setLoadingWidgets] = useState(true);

  const [kpiDetails, setKpiDetails] = useState({});
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  const [showFilters, setShowFilters] = useState(false);
  const [draftCurrencyFilter, setDraftCurrencyFilter] = useState("actualvalue");
  const [draftPeriodFilter, setDraftPeriodFilter] = useState("monthly");
  const [currencyFilter, setCurrencyFilter] = useState("actualvalue"); // applied
  const [periodFilter, setPeriodFilter] = useState("monthly"); // applied

  const [chartTypes, setChartTypes] = useState({});

  // ✅ local-only hide for charts list
  const [hiddenCharts, setHiddenCharts] = useState({}); // { [name]: true }

  const [showManageModal, setShowManageModal] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(null);

  // Visible widgets from API (controls tiles + charts)
  const visibleWidgets = useMemo(
    () =>
      (widgets || [])
        .filter((w) => w.enableordisable)
        .sort((a, b) => (a.position || 0) - (b.position || 0)),
    [widgets]
  );

  // ✅ charts list = visibleWidgets - hiddenCharts
  const visibleCharts = useMemo(() => {
    return visibleWidgets.filter((w) => !hiddenCharts[w.name]);
  }, [visibleWidgets, hiddenCharts]);

  /* =========================
     FETCH WIDGETS
     ========================= */
  const fetchWidgets = useCallback(async () => {
    if (!token) return;
    setLoadingWidgets(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/company/financial/KPI/widgets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (Array.isArray(data)) {
        const normalized = data.map((w) => ({
          ...w,
          enableordisable: w.enableordisable ?? w.enable_or_disable ?? true,
          position: Number(w.position ?? w.Position ?? 0),
          chart_Type: w.chart_Type ?? w.chart_type ?? "line_chart",
        }));

        setWidgets(normalized);

        const types = {};
        normalized.forEach((w) => {
          const ui = String(w.chart_Type || "line_chart")
            .replace("_chart", "")
            .toLowerCase();
          types[w.name] = ui || "line";
        });
        setChartTypes((prev) => ({ ...prev, ...types }));
      } else {
        setWidgets([]);
      }
    } catch (e) {
      console.error("fetchWidgets error", e);
      setWidgets([]);
    } finally {
      setLoadingWidgets(false);
    }
  }, [token]);

  /* =========================
     FETCH METRICS
     ========================= */
  const fetchMetrics = useCallback(async () => {
    if (!token || !selectedYear || !selectedCurrency) return;
    setLoadingMetrics(true);

    try {
      const url =
        `${API_BASE_URL}/api/v1/company/financial/Key_Financial_KPIs/${selectedYear}/${selectedCurrency}` +
        `?currency_filter=${currencyFilter}&filter=${periodFilter}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      const segmentPalette = ["#0ea5e9", "#22c55e", "#f97316", "#a855f7", "#ef4444", "#14b8a6", "#eab308"];

      const detailsMap = {};
      if (Array.isArray(json?.metrics)) {
        json.metrics.forEach((m) => {
          const trend = Array.isArray(m.trend) ? m.trend : [];
          const hasSegments = trend.some((t) => t.segment);

          let chartData;
          if (hasSegments) {
            // Multiple rows share the same period (one per segment) — dedupe the
            // x-axis labels and split into one dataset per segment instead of
            // flattening every row into a single series (which repeated each
            // period/quarter/YTD label once per segment).
            const periods = [];
            const seenPeriods = new Set();
            trend.forEach((t) => {
              const p = t.period || t.quarter;
              if (p && !seenPeriods.has(p)) {
                seenPeriods.add(p);
                periods.push(p);
              }
            });

            const segments = [];
            const seenSegments = new Set();
            trend.forEach((t) => {
              if (t.segment && !seenSegments.has(t.segment)) {
                seenSegments.add(t.segment);
                segments.push(t.segment);
              }
            });

            const datasets = segments.map((seg, i) => {
              const byPeriod = {};
              trend.forEach((t) => {
                if (t.segment === seg) byPeriod[t.period || t.quarter] = toNumberForChart(t.value);
              });
              const color = segmentPalette[i % segmentPalette.length];
              return {
                label: seg,
                data: periods.map((p) => byPeriod[p] ?? 0),
                borderWidth: 2,
                borderColor: color,
                backgroundColor: `${color}40`,
                fill: false,
                tension: 0.35,
                pointRadius: 2,
              };
            });

            chartData = { labels: periods, datasets };
          } else {
            const labels = trend.map((t) => t.period || t.quarter).filter(Boolean);
            const values = trend.map((t) => toNumberForChart(t.value));
            chartData = {
              labels,
              datasets: [
                {
                  label: titleize(m.metric),
                  data: values,
                  borderWidth: 2,
                  borderColor: "#0ea5e9",
                  backgroundColor: "rgba(14,165,233,0.25)",
                  fill: true,
                  tension: 0.35,
                  pointRadius: 2,
                },
              ],
            };
          }

          detailsMap[m.metric] = {
            title: titleize(m.metric),
            value: json?.key_metrics?.[m.metric] ?? "",
            data: chartData,
            onViewDetails: () => setDetailsOpen(m.metric),
            details: { description: "Trend", breakdown: trend },
          };
        });
      }

      setKpiDetails(detailsMap);
    } catch (e) {
      console.error("fetchMetrics error", e);
      setKpiDetails({});
    } finally {
      setLoadingMetrics(false);
    }
  }, [token, selectedYear, selectedCurrency, currencyFilter, periodFilter]);

  useEffect(() => {
    fetchWidgets();
  }, [fetchWidgets]);

  // Re-fetch whenever the set of *enabled* widgets changes (not just count),
  // so toggling a widget on/off in Manage Widgets refreshes its KPI data
  // instead of leaving the card stuck on "Loading...".
  const enabledWidgetsKey = useMemo(
    () => visibleWidgets.map((w) => w.name).sort().join(","),
    [visibleWidgets]
  );

  useEffect(() => {
    if (widgets.length > 0) fetchMetrics();
  }, [widgets.length, enabledWidgetsKey, fetchMetrics]);

  /* =========================
     APPLY => only then fetch (state changes)
     ========================= */
  const onApply = useCallback(() => {
    setCurrencyFilter(draftCurrencyFilter);
    setPeriodFilter(draftPeriodFilter);
    setShowFilters(false);
  }, [draftCurrencyFilter, draftPeriodFilter]);

  /* =========================
     UPDATE WIDGET API (Manage)
     ========================= */
  const updateWidgetAPI = async (payload) => {
    const res = await fetch(`${API_BASE_URL}/api/v1/company/financial/KPI/widgets`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail || `Widget update failed (${res.status})`);
    }
    return res.json();
  };

  // Manage modal toggle => affects tiles + charts
  const toggleWidgetEnable = async (name) => {
    const idx = widgets.findIndex((w) => w.name === name);
    if (idx === -1) return;

    const oldW = widgets[idx];
    const next = { ...oldW, enableordisable: !oldW.enableordisable };

    const copy = [...widgets];
    copy[idx] = next;
    setWidgets(copy);

    try {
      // Omit `position` here — the backend treats a present position as an
      // intentional move and will swap it with whichever widget currently
      // holds that slot. Re-sending the unchanged position on every toggle
      // risked shuffling another widget's position out from under it.
      await updateWidgetAPI({
        name: next.name,
        chart_Type: next.chart_Type,
        enableordisable: next.enableordisable,
      });
    } catch (e) {
      console.error("toggleWidgetEnable failed", e);
      const rollback = [...widgets];
      rollback[idx] = oldW;
      setWidgets(rollback);
    }
  };

  // ✅ Eye logic: remove chart from UI list (no placeholder)
  const toggleChartOnly = (name) => {
    setHiddenCharts((p) => ({ ...p, [name]: !p[name] }));
  };

  const handleChartTypeChange = async (name, typeUi) => {
    setChartTypes((p) => ({ ...p, [name]: typeUi }));

    const idx = widgets.findIndex((w) => w.name === name);
    if (idx === -1) return;

    const oldW = widgets[idx];
    const apiType = `${typeUi}_chart`;

    const nextW = { ...oldW, chart_Type: apiType };
    const copy = [...widgets];
    copy[idx] = nextW;
    setWidgets(copy);

    try {
      // Omit `position` — see note in toggleWidgetEnable. A chart-type change
      // must never trigger the backend's position-swap logic, or it can end
      // up reassigning a *different* widget's position/slot as a side effect.
      await updateWidgetAPI({
        name: nextW.name,
        chart_Type: apiType,
        enableordisable: nextW.enableordisable,
      });
    } catch (e) {
      console.error("chart type update failed", e);
      const rb = [...widgets];
      rb[idx] = oldW;
      setWidgets(rb);
      const oldUi = String(oldW.chart_Type || "line_chart")
        .replace("_chart", "")
        .toLowerCase();
      setChartTypes((p) => ({ ...p, [name]: oldUi || "line" }));
    }
  };

  // Drag reorder should operate on the CURRENTLY VISIBLE charts list (overview logic)
  const onDragEnd = async (result) => {
    if (!result.destination) return;

    const items = Array.from(visibleCharts);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);

    // Keep positions 0-indexed to match the backend defaults (0,1,2,3) —
    // using i + 1 here used to drift the whole set to 1-indexed after the
    // first drag, which could create stray position collisions.
    const reordered = items.map((w, i) => ({ ...w, position: i }));
    const map = new Map(reordered.map((w) => [w.name, w]));
    const merged = widgets.map((w) => (map.has(w.name) ? map.get(w.name) : w));
    setWidgets(merged);

    try {
      for (const w of reordered) {
        await updateWidgetAPI({
          name: w.name,
          chart_Type: w.chart_Type,
          enableordisable: w.enableordisable,
          position: w.position,
        });
      }
    } catch (e) {
      console.error("drag save failed", e);
      fetchWidgets();
    }
  };

  const ManageWidgetsModal = ({ onClose }) => (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-sky-800">Manage KPI Widgets</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <p className="text-s text-gray-500 mb-4">
          Toggle here affects tiles + charts (API).
          <br />
          Eye on chart removes only chart (local).
        </p>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {widgets.map((w) => (
            <div
              key={w.name}
              className="flex items-center justify-between p-2 hover:bg-slate-50 rounded border border-transparent hover:border-slate-100"
            >
              <span className="font-medium text-slate-700">{titleize(w.name)}</span>

              <button
                onClick={() => toggleWidgetEnable(w.name)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  w.enableordisable ? "bg-sky-600" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    w.enableordisable ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="bg-sky-900 text-white px-4 py-2 rounded hover:bg-sky-800">
            Done
          </button>
        </div>
      </div>
    </div>
  );

  /* =========================
     KEY METRICS TILES
     (unchanged: based on enableordisable only)
     ========================= */
  const pageLoading = loadingWidgets || loadingMetrics;

  const keyMetricTiles = useMemo(() => {
    return visibleWidgets
      .map((w) => ({ w, d: kpiDetails[w.name] }))
      .filter(({ d }) => !!d);
  }, [visibleWidgets, kpiDetails]);

  return (
    <div className="space-y-6 bg-sky-50 min-h-screen p-2">
      <KPIHeader
        currency={selectedCurrency}
        selectedYear={selectedYear}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        onManage={() => setShowManageModal(true)}
        onApply={onApply}
      />

      <KPIFilters
        showFilters={showFilters}
        draftCurrencyFilter={draftCurrencyFilter}
        setDraftCurrencyFilter={setDraftCurrencyFilter}
        draftPeriodFilter={draftPeriodFilter}
        setDraftPeriodFilter={setDraftPeriodFilter}
        onApply={onApply}
      />

      {/* Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {pageLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-white p-4 rounded-lg shadow-sm border border-sky-100 h-20 animate-pulse"
              >
                <div className="h-3 w-1/2 bg-slate-200 rounded mb-3" />
                <div className="h-6 w-2/3 bg-slate-200 rounded" />
              </div>
            ))
          : keyMetricTiles.map(({ w, d }) => (
              <div
                key={w.name}
                className="bg-white p-4 rounded-lg shadow-sm border border-l-4 border-l-sky-500 border-y-sky-100 border-r-sky-100 flex flex-col justify-between min-h-20 gap-2 hover:shadow-md transition"
              >
                <div className="flex justify-between items-start gap-2">
                  <h3 className="text-x font-bold text-sky-700 uppercase tracking-wider">
                    {d?.title || titleize(w.name)}
                  </h3>
                  <WidgetAskAI
                    title={d?.title || titleize(w.name)}
                    context={buildChartContext(d?.title || titleize(w.name), d?.data, selectedYear)}
                    questions={buildChartQuestions(d?.title || titleize(w.name))}
                  />
                </div>

                <div className="text-lg font-extrabold text-slate-800 break-words">
                  {renderValue(d?.value, selectedCurrency)}
                </div>
              </div>
            ))}
      </div>

      {/* Charts */}
      {pageLoading && visibleCharts.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="kpis">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                {visibleCharts.map((w, idx) => (
                  <KPICard
                    key={w.name}
                    widget={w}
                    index={idx}
                    metric={kpiDetails[w.name]}
                    chartType={chartTypes[w.name] || "line"}
                    currency={selectedCurrency}
                    year={selectedYear}
                    onChartTypeChange={handleChartTypeChange}
                    isHidden={!!hiddenCharts[w.name]}
                    onToggleHidden={toggleChartOnly}
                  />
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {showManageModal && <ManageWidgetsModal onClose={() => setShowManageModal(false)} />}
      {/* details modal removed from your snippet, keep if you want */}
      {/* {detailsOpen && <DetailsModal name={detailsOpen} onClose={() => setDetailsOpen(null)} />} */}
    </div>
  );
};

export default KeyFinancialKPIs;
