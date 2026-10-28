import React, { useMemo, useRef, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { BsThreeDotsVertical } from "react-icons/bs";
import { RiDragMove2Fill } from "react-icons/ri";
import { FiEyeOff } from "react-icons/fi";
import { Bar, Line, Pie, Doughnut, Radar, Bubble } from "react-chartjs-2";
import { Chart as ChartJS } from "chart.js/auto";
import AppCard from "../ui/AppCard";
import AppButton from "../ui/AppButton";
import WidgetAskAI from "./WidgetAskAI";
import { buildChartContext, buildChartQuestions } from "../../utils/chartAiContext";

const SLICE_COLORS = [
  "#38bdf8", "#0ea5e9", "#0284c7", "#7dd3fc", "#fb923c",
  "#f97316", "#facc15", "#34d399", "#a3e635", "#f472b6",
];
const colorsForSlices = (n) => Array.from({ length: n }, (_, i) => SLICE_COLORS[i % SLICE_COLORS.length]);

const getChartOptions = (chartType, currency, currencyFilter, renderValue, labels = []) => {
  const isCircle = chartType === "pie" || chartType === "doughnut";
  const isBubble = chartType === "bubble";
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const raw = isBubble
              ? ctx?.raw?.y
              : (ctx?.parsed && typeof ctx.parsed === "object" && "y" in ctx.parsed)
                ? ctx.parsed.y
                : (ctx?.parsed ?? ctx?.raw ?? 0);

            const n = Number(raw);
            if (!Number.isFinite(n)) return `${ctx.dataset.label || "Value"}: —`;
            return `${ctx.dataset.label || "Value"}: ${renderValue(n, currency, currencyFilter)}`;
          },
        },
      },
    },
    scales: !isCircle
      ? {
          x: {
            grid: { display: false },
            // bubble uses a numeric (linear) x-axis under the hood. Chart.js's
            // auto-generated "nice" ticks on a linear axis don't necessarily land
            // on the same integers as the point indices, so pin min/max/stepSize
            // to the data range and round before mapping back to the period label.
            ...(isBubble
              ? {
                  min: 0,
                  max: Math.max(labels.length - 1, 0),
                  ticks: { stepSize: 1, callback: (val) => labels[Math.round(val)] ?? val },
                }
              : {}),
          },
          y: {
            ticks: {
              callback: (val) => renderValue(Number(val), currency, currencyFilter),
            },
          },
        }
      : undefined,
  };
};

// Chart.js Bubble charts require { x, y, r } points, not a flat array of values
const toBubblePoints = (values = []) =>
  values.map((v, i) => ({ x: i, y: Number(v) || 0, r: 10 }));

// Single sort applied once, upstream of every chart type, so Bar/Bubble/Doughnut/etc.
// can never end up showing a different point order than Line for the same widget
// regardless of what order the API/cache happened to hand back.
const sortDataByLabel = (data) => {
  const labels = Array.isArray(data?.labels) ? data.labels : [];
  const datasets = Array.isArray(data?.datasets) ? data.datasets : [];
  if (labels.length < 2) return data;

  const order = labels.map((_, i) => i).sort((a, b) => String(labels[a]).localeCompare(String(labels[b])));
  if (order.every((idx, i) => idx === i)) return data;

  return {
    ...data,
    labels: order.map((i) => labels[i]),
    datasets: datasets.map((ds) => ({
      ...ds,
      data: Array.isArray(ds.data) ? order.map((i) => ds.data[i]) : ds.data,
    })),
  };
};

const renderChart = (type, data, currency, currencyFilter, renderValue) => {
  const hasLabels = Array.isArray(data?.labels) && data.labels.length > 0;
  const hasDatasets = Array.isArray(data?.datasets) && data.datasets.length > 0;

  if (!hasLabels || !hasDatasets) {
    return <div className="h-full flex items-center justify-center text-x text-red-400">No Data</div>;
  }

  const options = getChartOptions(type, currency, currencyFilter, renderValue, data.labels);
  const Comp =
    { line: Line, bar: Bar, pie: Pie, doughnut: Doughnut, radar: Radar, bubble: Bubble }[type] || Bar;

  const chartData =
    type === "bubble"
      ? { ...data, datasets: data.datasets.map((ds) => ({ ...ds, data: toBubblePoints(ds.data) })) }
      : type === "pie" || type === "doughnut"
      ? {
          ...data,
          datasets: data.datasets.map((ds) => ({
            ...ds,
            backgroundColor: ds.backgroundColor || colorsForSlices(ds.data.length),
          })),
        }
      : data;

  return <Comp data={chartData} options={options} />;
};

const ChartCard = ({
  widget,
  index,
  chartType,
  chartData,
  title,
  onChartTypeChange,
  onRemoveWidget,
  currency,
  currencyFilter,
  renderValue,
  onViewMore,
  year,
  // ✅ NEW
  wrapperClassName = "",
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const timerRef = useRef(null);

  const openMenu = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMenuOpen(true);
  };
  const closeMenu = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMenuOpen(false), 200);
  };

  return (
    <Draggable draggableId={widget.name} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={wrapperClassName} // ✅ wrapper controls responsive span
          data-pdf-keep
        >
          <AppCard className="relative">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-s font-semibold text-sky-800">{title}</h3>

              <div className="flex items-center gap-2 relative" data-pdf-hide>
                {/* Ask AI */}
                <WidgetAskAI
                  title={title}
                  context={buildChartContext(title, chartData, year)}
                  questions={buildChartQuestions(title)}
                />

                {/* Hide widget */}
                <AppButton
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveWidget?.(widget.name);
                  }}
                  variant="icon"
                  size="icon"
                  title="Hide widget"
                >
                  <FiEyeOff />
                </AppButton>

                {/* Menu */}
                <div className="relative" onMouseEnter={openMenu} onMouseLeave={closeMenu}>
                  <AppButton variant="icon" size="icon" title="Options">
                    <BsThreeDotsVertical />
                  </AppButton>

                  {menuOpen && (
                    <div
                      className="absolute right-0 top-7 w-40 bg-white rounded-lg shadow-lg border border-sky-200 z-20"
                      onMouseEnter={openMenu}
                      onMouseLeave={closeMenu}
                    >
                      <div className="px-3 py-2 text-x text-slate-700">Change Chart Type</div>

                      <div className="border-t">
                        {["line", "bar", "pie", "doughnut", "radar", "bubble"].map((t) => (
                          <button
                            key={t}
                            className="block w-full text-left px-3 py-2 text-x hover:bg-gray-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              onChartTypeChange?.(widget.name, t);
                              setMenuOpen(false);
                            }}
                          >
                            {t.toUpperCase()}
                          </button>
                        ))}
                      </div>

                      <button
                        className="block w-full text-left px-3 py-2 text-x text-sky-700 hover:bg-sky-50 border-t"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewMore?.(widget.name);
                          setMenuOpen(false);
                        }}
                      >
                        Analytics
                      </button>
                    </div>
                  )}
                </div>

                {/* Drag */}
                <div
                  {...provided.dragHandleProps}
                  className="cursor-move rounded p-1 transition-colors duration-200 hover:bg-slate-100"
                  title="Drag"
                >
                  <RiDragMove2Fill />
                </div>
              </div>
            </div>

            {/* ✅ responsive height */}
            <div className="h-56 sm:h-60 md:h-64 lg:h-72">
              {renderChart(chartType, chartData, currency, currencyFilter, renderValue)}
            </div>
          </AppCard>
        </div>
      )}
    </Draggable>
  );
};

const FinancialCharts = ({
  widgets = [],
  chartsData = {},
  chartTypes = {},
  onDragEnd,
  onChartTypeChange,
  onRemoveWidget,
  currency = "USD",
  currencyFilter = "actualvalue",
  renderValue,
  onViewMore,
  year,
}) => {
  const processed = useMemo(() => {
    return (widgets || []).reduce((acc, w) => {
      const x = chartsData[w.name] || {};
      acc[w.name] = {
        title: x.title || w.name.replace(/_/g, " "),
        data: sortDataByLabel(x.data || { labels: [], datasets: [] }),
      };
      return acc;
    }, {});
  }, [widgets, chartsData]);

  // 2 cards per row; last row: 1 card => full width
  const cols = 2;
  const remainder = widgets.length % cols;
  const lastRowCount = remainder === 0 ? cols : remainder;
  const lastRowStartIndex = widgets.length - lastRowCount;

  const spanClassForIndex = (idx) => {
    const isLastRow = idx >= lastRowStartIndex;
    if (isLastRow && lastRowCount === 1) return "md:col-span-2"; // full width
    return "md:col-span-1"; // normal 50/50
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="charts">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps}>
            {/* ✅ One grid only, fully responsive */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 items-start">
              {widgets.map((w, idx) => (
                <ChartCard
                  key={w.name}
                  widget={w}
                  index={idx}
                  chartType={chartTypes[w.name] || "bar"}
                  chartData={processed[w.name]?.data}
                  title={processed[w.name]?.title}
                  onChartTypeChange={onChartTypeChange}
                  onRemoveWidget={onRemoveWidget}
                  currency={currency}
                  currencyFilter={currencyFilter}
                  renderValue={renderValue}
                  onViewMore={onViewMore}
                  year={year}
                  wrapperClassName={spanClassForIndex(idx)} // ✅ spans
                />
              ))}
            </div>

            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};

export default FinancialCharts;
