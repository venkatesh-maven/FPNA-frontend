import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Bar, Pie, Doughnut } from "react-chartjs-2";
import { motion, AnimatePresence } from "framer-motion";
import { BsStars, BsThreeDotsVertical } from "react-icons/bs";
import { FiPlus, FiX, FiSend } from "react-icons/fi";
import { RiDragMove2Fill } from "react-icons/ri";
import SmallAIChatBot from "../../pages/SmallAIChatBot";
import { getDecimalPrecision } from '../../utils/formatters';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
);

/* =========================
   Helpers
========================= */
const MONTHS_12 = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const sum = (arr) => arr.reduce((a, b) => a + (Number(b) || 0), 0);
const fmtUSD = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }).format(n);

const chartBaseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: "bottom" } },
};

const smallLegendOptions = {
  ...chartBaseOptions,
  plugins: { legend: { position: "bottom", labels: { boxWidth: 10, boxHeight: 10 } } },
};

/* =========================
   Page
========================= */
const BudgetingHub = () => {
  const [year, setYear] = useState("2024");
  const [periodMode, setPeriodMode] = useState("month_on_month"); // month_on_month | quarter
  const [viewMode, setViewMode] = useState("budget_vs_actual"); // budget_vs_actual | budget_only

  // AI drawer
  const [showAIChatbot, setShowAIChatbot] = useState(false);
  const aiChatbotRef = useRef(null);

  // Widget Ask AI (hover popup)
  const [showAIDropdownFor, setShowAIDropdownFor] = useState(null);
  const [aiText, setAiText] = useState("");

  const openAI = (id) => setShowAIDropdownFor(id);
  const closeAI = (id) => setShowAIDropdownFor((p) => (p === id ? null : p));
  const onAskAI = (widgetId) => {
    const q = aiText.trim();
    if (!q) return;
    console.log("Ask AI (Widget):", { widgetId, question: q, year, periodMode, viewMode });
    setAiText("");
    setShowAIDropdownFor(null);
  };

  // Metric Ask AI (hover popup)
  const [showMetricAIDropdownFor, setShowMetricAIDropdownFor] = useState(null);
  const [metricAiText, setMetricAiText] = useState("");

  const openMetricAI = (key) => setShowMetricAIDropdownFor(key);
  const closeMetricAI = (key) => setShowMetricAIDropdownFor((p) => (p === key ? null : p));
  const onAskMetricAI = (metric) => {
    const q = metricAiText.trim();
    if (!q) return;
    console.log("Ask AI (Metric):", { metricKey: metric.key, metricTitle: metric.title, question: q, year, periodMode, viewMode });
    setMetricAiText("");
    setShowMetricAIDropdownFor(null);
  };

  // Manage modal
  const [showManage, setShowManage] = useState(false);
  const manageRef = useRef(null);

  // Widgets order + enabled
  const [widgetOrder, setWidgetOrder] = useState([
    "operationalBudgeting",
    "revenueBasedBudgeting",
    "capexBudgeting",
    "workforcePayroll",
    "zeroBasedBudgeting",
    "rollingFlexible",
    "scenarioWhatIf",
  ]);

  const [enabledWidgets, setEnabledWidgets] = useState({
    operationalBudgeting: true,
    revenueBasedBudgeting: true,
    capexBudgeting: true,
    workforcePayroll: true,
    zeroBasedBudgeting: true,
    rollingFlexible: true,
    scenarioWhatIf: true,
  });

  // Each widget supports changing chart types (for 3 charts)
  // trendType: line/bar
  // mixType: pie/doughnut
  const [chartPrefs, setChartPrefs] = useState({
    operationalBudgeting: { trendType: "line", mixType: "doughnut" },
    revenueBasedBudgeting: { trendType: "line", mixType: "pie" },
    capexBudgeting: { trendType: "bar", mixType: "doughnut" },
    workforcePayroll: { trendType: "line", mixType: "doughnut" },
    zeroBasedBudgeting: { trendType: "bar", mixType: "pie" },
    rollingFlexible: { trendType: "line", mixType: "doughnut" },
    scenarioWhatIf: { trendType: "bar", mixType: "doughnut" },
  });

  // Hover dropdown per widget
  const [showChartTypeDropdown, setShowChartTypeDropdown] = useState({});

  // DnD
  const dragIdRef = useRef(null);
  const onDragStart = (id) => (dragIdRef.current = id);
  const onDropOn = (targetId) => {
    const draggedId = dragIdRef.current;
    if (!draggedId || draggedId === targetId) return;

    setWidgetOrder((prev) => {
      const from = prev.indexOf(draggedId);
      const to = prev.indexOf(targetId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      next.splice(from, 1);
      next.splice(to, 0, draggedId);
      return next;
    });

    dragIdRef.current = null;
  };

  // Close outside dropdowns + modals
  useEffect(() => {
    const onDown = (e) => {
      if (showManage && manageRef.current && !manageRef.current.contains(e.target)) {
        setShowManage(false);
      }

      const isMenuClick = e.target.closest?.("[data-ct-menu]");
      if (!isMenuClick) setShowChartTypeDropdown({});
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showManage]);

  /* =========================
     Labels
  ========================= */
  const labels = useMemo(() => {
    if (periodMode === "quarter") return ["Q1", "Q2", "Q3", "Q4"];
    return MONTHS_12;
  }, [periodMode]);

  /* =========================
     Demo Budget Data (12 months)
     - budget vs actual
     - per category breakdown
  ========================= */
  const baseBudget12 = [98000,102000,104000,106000,110000,112000,114000,116000,118000,120000,123000,126000];
  const baseActual12 = [96000,104000,101000,109000,108000,115000,111000,118000,120000,119000,125000,129000];

  const asQuarter = (arr) => [
    sum(arr.slice(0, 3)),
    sum(arr.slice(3, 6)),
    sum(arr.slice(6, 9)),
    sum(arr.slice(9, 12)),
  ];

  const budgetSeries = useMemo(() => (periodMode === "quarter" ? asQuarter(baseBudget12) : baseBudget12), [periodMode]);
  const actualSeries = useMemo(() => (periodMode === "quarter" ? asQuarter(baseActual12) : baseActual12), [periodMode]);

  /* =========================
     7 Metrics
  ========================= */
  const metrics = useMemo(() => {
    const budgetTotal = sum(budgetSeries);
    const actualTotal = sum(actualSeries);
    const variance = actualTotal - budgetTotal;
    const variancePct = budgetTotal ? Math.round((variance / budgetTotal) * 100) : 0;

    // Simple demo metrics
    const opBudget = Math.round(budgetTotal * 0.62);
    const capexBudget = Math.round(budgetTotal * 0.12);
    const payrollBudget = Math.round(budgetTotal * 0.18);
    const contingency = Math.round(budgetTotal * 0.03);

    return [
      { key: "budget_total", title: "Total Budget", value: fmtUSD(budgetTotal) },
      { key: "actual_total", title: "Total Actual", value: fmtUSD(actualTotal) },
      { key: "variance", title: "Variance", value: `${fmtUSD(variance)} (${variancePct}%)` },
      { key: "operational_budget", title: "Operational Budget", value: fmtUSD(opBudget) },
      { key: "payroll_budget", title: "Payroll Budget", value: fmtUSD(payrollBudget) },
      { key: "capex_budget", title: "CAPEX Budget", value: fmtUSD(capexBudget) },
      { key: "contingency", title: "Contingency", value: fmtUSD(contingency) },
    ];
  }, [budgetSeries, actualSeries]);

  /* =========================
     Widget Meta (Budgeting)
     - Each widget = 3 charts row
     - Trend chart: budget trend (budget only)
     - Compare chart: budget vs actual (bar)
     - Mix chart: category mix (pie/doughnut)
  ========================= */
  const widgetMeta = useMemo(() => {
    return {
      operationalBudgeting: {
        title: "Operational Budgeting",
        subtitle: "Core Business Expense Planning",
        analyzePath: "/budgeting/operational",
        mix: {
          labels: ["Marketing", "Sales", "Operations", "HR", "IT", "R&D"],
          data: [18, 14, 26, 10, 12, 20],
          colors: [
            "rgba(14, 165, 233, 0.85)",
            "rgba(59, 130, 246, 0.85)",
            "rgba(16, 185, 129, 0.85)",
            "rgba(234, 179, 8, 0.85)",
            "rgba(139, 92, 246, 0.85)",
            "rgba(239, 68, 68, 0.85)",
          ],
        },
      },
      revenueBasedBudgeting: {
        title: "Revenue-Based Budgeting",
        subtitle: "Aligning Spending with Income Trends",
        analyzePath: "/budgeting/revenue-based",
        mix: {
          labels: ["Acquisition", "Retention", "Success", "Partnerships", "Product"],
          data: [30, 24, 16, 12, 18],
          colors: [
            "rgba(16, 185, 129, 0.85)",
            "rgba(14, 165, 233, 0.85)",
            "rgba(234, 179, 8, 0.85)",
            "rgba(59, 130, 246, 0.85)",
            "rgba(239, 68, 68, 0.85)",
          ],
        },
      },
      capexBudgeting: {
        title: "CAPEX Budgeting",
        subtitle: "Long-Term Asset Planning & Investments",
        analyzePath: "/budgeting/capex",
        mix: {
          labels: ["Equipment", "Facilities", "R&D", "Software"],
          data: [34, 26, 22, 18],
          colors: [
            "rgba(234, 179, 8, 0.85)",
            "rgba(14, 165, 233, 0.85)",
            "rgba(16, 185, 129, 0.85)",
            "rgba(139, 92, 246, 0.85)",
          ],
        },
      },
      workforcePayroll: {
        title: "Workforce & Payroll Budgeting",
        subtitle: "Strategic Staffing Cost Management",
        analyzePath: "/budgeting/workforce",
        mix: {
          labels: ["Salaries", "Benefits", "Bonus", "Commissions"],
          data: [62, 18, 12, 8],
          colors: [
            "rgba(59, 130, 246, 0.85)",
            "rgba(16, 185, 129, 0.85)",
            "rgba(234, 179, 8, 0.85)",
            "rgba(239, 68, 68, 0.85)",
          ],
        },
      },
      zeroBasedBudgeting: {
        title: "Zero-Based Budgeting (ZBB)",
        subtitle: "Justification-Based Expense Planning",
        analyzePath: "/budgeting/zbb",
        mix: {
          labels: ["Must-have", "Nice-to-have", "Deferred", "Removed"],
          data: [55, 22, 15, 8],
          colors: [
            "rgba(16, 185, 129, 0.85)",
            "rgba(14, 165, 233, 0.85)",
            "rgba(234, 179, 8, 0.85)",
            "rgba(239, 68, 68, 0.85)",
          ],
        },
      },
      rollingFlexible: {
        title: "Rolling & Flexible Budgeting",
        subtitle: "Dynamic, Real-Time Budget Adjustments",
        analyzePath: "/budgeting/rolling",
        mix: {
          labels: ["Run-rate", "Growth", "Contingency", "One-time"],
          data: [58, 22, 12, 8],
          colors: [
            "rgba(14, 165, 233, 0.85)",
            "rgba(16, 185, 129, 0.85)",
            "rgba(234, 179, 8, 0.85)",
            "rgba(239, 68, 68, 0.85)",
          ],
        },
      },
      scenarioWhatIf: {
        title: "Scenario Modeling & What-If",
        subtitle: "Advanced Budgeting Simulations",
        analyzePath: "/budgeting/scenarios",
        mix: {
          labels: ["Revenue growth", "Cost-cutting", "Trade-offs", "Inflation impact"],
          data: [32, 26, 22, 20],
          colors: [
            "rgba(16, 185, 129, 0.85)",
            "rgba(239, 68, 68, 0.85)",
            "rgba(14, 165, 233, 0.85)",
            "rgba(234, 179, 8, 0.85)",
          ],
        },
      },
    };
  }, []);

  /* =========================
     3-Chart builders per widget
  ========================= */
  const trendChart = (wid) => {
    const trendType = chartPrefs[wid]?.trendType || "line";
    const d = {
      labels,
      datasets: [
        {
          label: "Budget",
          data: budgetSeries,
          backgroundColor: "rgba(14, 165, 233, 0.18)",
          borderColor: "rgba(14, 165, 233, 1)",
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 2,
        },
      ],
    };

    return (
      <div className="h-[190px]">
        {trendType === "bar" ? (
          <Bar
            data={{
              labels,
              datasets: [
                {
                  label: "Budget",
                  data: budgetSeries,
                  backgroundColor: budgetSeries.map((_, i) =>
                    i % 2 === 0 ? "rgba(14, 165, 233, 0.55)" : "rgba(59, 130, 246, 0.55)"
                  ),
                  borderRadius: 10,
                },
              ],
            }}
            options={smallLegendOptions}
          />
        ) : (
          <Line data={d} options={smallLegendOptions} />
        )}
      </div>
    );
  };

  const compareChart = () => {
    const d = {
      labels,
      datasets: [
        {
          label: "Budget",
          data: budgetSeries,
          backgroundColor: "rgba(59, 130, 246, 0.55)",
          borderRadius: 10,
        },
        ...(viewMode === "budget_vs_actual"
          ? [
              {
                label: "Actual",
                data: actualSeries,
                backgroundColor: "rgba(16, 185, 129, 0.55)",
                borderRadius: 10,
              },
            ]
          : []),
      ],
    };
    return (
      <div className="h-[190px]">
        <Bar data={d} options={smallLegendOptions} />
      </div>
    );
  };

  const mixChart = (wid) => {
    const mixType = chartPrefs[wid]?.mixType || "doughnut";
    const mix = widgetMeta[wid].mix;

    const d = {
      labels: mix.labels,
      datasets: [
        {
          label: "Mix",
          data: mix.data,
          backgroundColor: mix.colors,
          borderWidth: 0,
        },
      ],
    };

    return (
      <div className="h-[190px]">
        {mixType === "pie" ? <Pie data={d} options={smallLegendOptions} /> : <Doughnut data={d} options={smallLegendOptions} />}
      </div>
    );
  };

  /* =========================
     Manage Modal
  ========================= */
  const ManageModal = () => (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <motion.div
        ref={manageRef}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        className="bg-white w-full max-w-lg rounded-xl shadow-lg border border-slate-100"
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold text-sky-900">Manage Budget Widgets</div>
            <div className="text-s text-slate-500">Enable/disable and reorder by drag.</div>
          </div>
          <button onClick={() => setShowManage(false)} className="p-2 rounded-lg hover:bg-slate-100" title="Close">
            <FiX />
          </button>
        </div>

        <div className="p-4 space-y-3 max-h-[65vh] overflow-y-auto">
          {widgetOrder.map((wid) => (
            <div
              key={wid}
              draggable
              onDragStart={() => onDragStart(wid)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDropOn(wid)}
              className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-grab active:cursor-grabbing"
              title="Drag to reorder"
            >
              <div>
                <div className="font-medium text-slate-800">{widgetMeta[wid]?.title}</div>
                <div className="text-x text-slate-500">{widgetMeta[wid]?.subtitle}</div>
              </div>

              <button
                className={`px-3 py-2 rounded-md text-s font-medium border ${
                  enabledWidgets[wid] ? "bg-sky-900 text-white border-sky-900" : "bg-white text-slate-700 border-slate-200"
                }`}
                onClick={() => setEnabledWidgets((p) => ({ ...p, [wid]: !p[wid] }))}
              >
                {enabledWidgets[wid] ? "Enabled" : "Disabled"}
              </button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end">
          <button onClick={() => setShowManage(false)} className="px-4 py-2 rounded-lg bg-sky-900 text-white hover:bg-sky-800">
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );

  /* =========================
     Visible widgets
  ========================= */
  const visibleWidgets = widgetOrder.filter((wid) => enabledWidgets[wid]);

  return (
    <div className="space-y-6 min-h-screen bg-slate-50 relative">
      {/* AI drawer */}
      {showAIChatbot && (
        <div className="fixed right-0 top-16 h-[90%] z-50" ref={aiChatbotRef}>
          <SmallAIChatBot onClose={() => setShowAIChatbot(false)} />
        </div>
      )}

      <AnimatePresence>{showManage && <ManageModal />}</AnimatePresence>

      {/* Header */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Budgeting</h1>
            <p className="text-sky-100 text-s">Operational • Revenue-Based • CAPEX • Workforce • ZBB • Rolling • What-If</p>
          </div>

          <div className="flex  items-center gap-2">
            <div className="flex items-center gap-2">
              {/* <span className="text-x font-semibold text-white/90">Year</span> */}
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="h-9 px-3 rounded-lg bg-white/95 text-slate-800 text-s outline-none border border-white/70"
              >
                <option>2024</option>
                {/* <option>2025</option>
                <option>2026</option> */}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-x font-semibold text-white/90">Period</span>
              <select
                value={periodMode}
                onChange={(e) => setPeriodMode(e.target.value)}
                className="h-9 px-3 rounded-lg bg-white/95 text-slate-800 text-s outline-none border border-white/70"
              >
                <option value="month_on_month">month_on_month</option>
                <option value="quarter">quarter</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-x font-semibold text-white/90">View</span>
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                className="h-9 px-3 rounded-lg bg-white/95 text-slate-800 text-s outline-none border border-white/70"
              >
                <option value="budget_vs_actual">budget_vs_actual</option>
                <option value="budget_only">budget_only</option>
              </select>
            </div>

            <button
              type="button"
              className="flex items-center h-9 px-3 text-s font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition"
              onClick={() => setShowManage(true)}
            >
              <FiPlus className="mr-2" />
               Widgets
            </button>

            {/* <button
              type="button"
              className="flex items-center h-9 px-3 text-s font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition"
              onClick={() => setShowAIChatbot((s) => !s)}
              title="Open AI"
            >
              <BsStars className="mr-2" />
              Ask AI
            </button> */}
          </div>
        </div>
      </div>

      {/* 7 Metrics + Ask AI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2">
        {metrics.map((m) => (
          <motion.div
            key={m.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition p-4 relative"
            onMouseLeave={() => closeMetricAI(m.key)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-x font-semibold text-sky-700">{m.title}</div>

              <div
                className="relative"
                onMouseEnter={() => openMetricAI(m.key)}
                onMouseLeave={() => closeMetricAI(m.key)}
              >
                <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600" title="Ask AI" type="button">
                  <BsStars />
                </button>

                <AnimatePresence>
                  {showMetricAIDropdownFor === m.key && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.16 }}
                      className="absolute right-0 top-10 w-[260px] bg-white rounded-xl shadow-lg border z-30 p-3"
                      onClick={(e) => e.stopPropagation()}
                      onMouseEnter={() => openMetricAI(m.key)}
                      onMouseLeave={() => closeMetricAI(m.key)}
                    >
                      <div className="text-x font-semibold text-slate-700 mb-2">Ask AI about {m.title}</div>
                      <div className="flex items-center gap-2">
                        <input
                          value={metricAiText}
                          onChange={(e) => setMetricAiText(e.target.value)}
                          placeholder="Ask AI..."
                          className="w-full px-3 py-2 border rounded-lg text-x outline-none focus:ring-2 focus:ring-sky-200"
                        />
                        <button
                          onClick={() => onAskMetricAI(m)}
                          disabled={!metricAiText.trim()}
                          className="p-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
                          title="Send"
                          type="button"
                        >
                          <FiSend size={14} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="mt-2 text-lg font-bold text-sky-900">{m.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Widgets Grid (each card shows 3 charts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {visibleWidgets.map((wid) => {
          const meta = widgetMeta[wid];
          const pref = chartPrefs[wid];

          return (
            <motion.div
              key={wid}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.26 }}
              className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition overflow-hidden"
              draggable
              onDragStart={() => onDragStart(wid)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDropOn(wid)}
              title="Drag to change position"
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-2">
                <div>
                  <div className="text-base font-semibold text-sky-900">{meta.title}</div>
                  <div className="text-x text-slate-500 mt-1">{meta.subtitle}</div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Ask AI */}
                  <div className="relative" onMouseEnter={() => openAI(wid)} onMouseLeave={() => closeAI(wid)}>
                    <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-600" title="Ask AI" type="button">
                      <BsStars />
                    </button>

                    <AnimatePresence>
                      {showAIDropdownFor === wid && (
                        <motion.div
                          initial={{ opacity: 0, y: -6, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.98 }}
                          transition={{ duration: 0.16 }}
                          className="absolute right-0 top-11 w-[260px] bg-white rounded-xl shadow-lg border z-30 p-3"
                          onClick={(e) => e.stopPropagation()}
                          onMouseEnter={() => openAI(wid)}
                          onMouseLeave={() => closeAI(wid)}
                        >
                          <div className="text-x font-semibold text-slate-700 mb-2">Ask AI about {meta.title}</div>
                          <div className="flex items-center gap-2">
                            <input
                              value={aiText}
                              onChange={(e) => setAiText(e.target.value)}
                              placeholder="Ask AI..."
                              className="w-full px-3 py-2 border rounded-lg text-x outline-none focus:ring-2 focus:ring-sky-200"
                            />
                            <button
                              onClick={() => onAskAI(wid)}
                              disabled={!aiText.trim()}
                              className="p-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
                              title="Send"
                              type="button"
                            >
                              <FiSend size={14} />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Chart type menu (hover open) */}
                  <div
                    className="relative"
                    data-ct-menu
                    onMouseEnter={() => setShowChartTypeDropdown((p) => ({ ...p, [wid]: true }))}
                    onMouseLeave={() => setShowChartTypeDropdown((p) => ({ ...p, [wid]: false }))}
                  >
                    <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-600" title="Chart type" type="button">
                      <BsThreeDotsVertical />
                    </button>

                    {showChartTypeDropdown[wid] && (
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg z-30 border border-slate-200 overflow-hidden">
                        <div className="px-3 py-2 text-x font-semibold text-slate-600 bg-slate-50">Trend chart</div>
                        {[
                          { id: "line", label: "Line" },
                          { id: "bar", label: "Bar" },
                        ].map((x) => (
                          <button
                            key={x.id}
                            onClick={() =>
                              setChartPrefs((p) => ({
                                ...p,
                                [wid]: { ...p[wid], trendType: x.id },
                              }))
                            }
                            className={`block w-full text-left px-4 py-2 text-s hover:bg-slate-50 ${
                              pref?.trendType === x.id ? "text-sky-900 font-semibold" : "text-slate-700"
                            }`}
                          >
                            {x.label}
                          </button>
                        ))}

                        <div className="px-3 py-2 text-x font-semibold text-slate-600 bg-slate-50 border-t">Mix chart</div>
                        {[
                          { id: "pie", label: "Pie" },
                          { id: "doughnut", label: "Doughnut" },
                        ].map((x) => (
                          <button
                            key={x.id}
                            onClick={() =>
                              setChartPrefs((p) => ({
                                ...p,
                                [wid]: { ...p[wid], mixType: x.id },
                              }))
                            }
                            className={`block w-full text-left px-4 py-2 text-s hover:bg-slate-50 ${
                              pref?.mixType === x.id ? "text-sky-900 font-semibold" : "text-slate-700"
                            }`}
                          >
                            {x.label}
                          </button>
                        ))}

                        <button
                          type="button"
                          onClick={() => (window.location.href = meta.analyzePath)}
                          className="w-full px-4 py-2 text-s font-semibold bg-sky-900 text-white hover:bg-sky-800"
                          title="Analyze"
                        >
                          Analyze
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => setEnabledWidgets((p) => ({ ...p, [wid]: false }))}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
                    title="Remove widget"
                  >
                    <FiX />
                  </button>

                  {/* Drag icon */}
                  <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-600" title="Drag">
                    <RiDragMove2Fill />
                  </button>
                </div>
              </div>

              {/* 3 charts row */}
              <div className="p-1">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
                  {/* Chart 1: Trend */}
                  <motion.div
                    key={`${wid}-trend-${chartPrefs[wid]?.trendType}-${periodMode}-${year}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <div className="text-x font-semibold text-slate-700 mb-2">Budget Trend</div>
                    {trendChart(wid)}
                  </motion.div>

                  {/* Chart 2: Budget vs Actual */}
                  <motion.div
                    key={`${wid}-compare-${viewMode}-${periodMode}-${year}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <div className="text-x font-semibold text-slate-700 mb-2">Budget vs Actual</div>
                    {compareChart()}
                  </motion.div>

                  {/* Chart 3: Mix */}
                  <motion.div
                    key={`${wid}-mix-${chartPrefs[wid]?.mixType}-${year}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <div className="text-x font-semibold text-slate-700 mb-2">Allocation Mix</div>
                    {mixChart(wid)}
                  </motion.div>
                </div>
              </div>

              {/* bottom glow */}
              <div className="h-1 w-full bg-gradient-to-r from-sky-400 via-blue-400 to-purple-400 opacity-0 hover:opacity-100 transition" />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default BudgetingHub;
