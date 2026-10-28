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
const avg = (arr) => (arr?.length ? sum(arr) / arr.length : 0);
const fmtUSD = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }).format(n);
const fmtPct = (n) => `${Math.round(n)}%`;

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: "bottom" } },
};

const smallLegendOptions = {
  ...baseOptions,
  plugins: { legend: { position: "bottom", labels: { boxWidth: 10, boxHeight: 10 } } },
};

const COLORS = {
  sky: "rgba(14, 165, 233, 0.85)",
  blue: "rgba(59, 130, 246, 0.85)",
  green: "rgba(16, 185, 129, 0.85)",
  yellow: "rgba(234, 179, 8, 0.85)",
  red: "rgba(239, 68, 68, 0.85)",
  purple: "rgba(139, 92, 246, 0.85)",
};

const PerformanceAnalyticsOverview = () => {
  /* =========================
     Header filters
  ========================= */
  const [year, setYear] = useState("2024");
  const [periodMode, setPeriodMode] = useState("month_on_month"); // month_on_month | quarter
  const [focusArea, setFocusArea] = useState("all"); // all | sales | hr | it | finance | supply

  const labels = useMemo(() => {
    if (periodMode === "quarter") return ["Q1", "Q2", "Q3", "Q4"];
    return MONTHS_12;
  }, [periodMode]);

  /* =========================
     AI drawer
  ========================= */
  const [showAIChatbot, setShowAIChatbot] = useState(false);
  const aiChatbotRef = useRef(null);

  /* =========================
     Ask AI (widget hover)
  ========================= */
  const [showAIDropdownFor, setShowAIDropdownFor] = useState(null);
  const [aiText, setAiText] = useState("");
  const openAI = (id) => setShowAIDropdownFor(id);
  const closeAI = (id) => setShowAIDropdownFor((p) => (p === id ? null : p));
  const onAskAI = (widgetId) => {
    const q = aiText.trim();
    if (!q) return;
    console.log("Ask AI (Widget):", { widgetId, question: q, year, periodMode, focusArea });
    setAiText("");
    setShowAIDropdownFor(null);
  };

  /* =========================
     Ask AI (metric hover)
  ========================= */
  const [showMetricAIDropdownFor, setShowMetricAIDropdownFor] = useState(null);
  const [metricAiText, setMetricAiText] = useState("");
  const openMetricAI = (key) => setShowMetricAIDropdownFor(key);
  const closeMetricAI = (key) => setShowMetricAIDropdownFor((p) => (p === key ? null : p));
  const onAskMetricAI = (metric) => {
    const q = metricAiText.trim();
    if (!q) return;
    console.log("Ask AI (Metric):", { metricKey: metric.key, metricTitle: metric.title, question: q, year, periodMode, focusArea });
    setMetricAiText("");
    setShowMetricAIDropdownFor(null);
  };

  /* =========================
     Manage modal
  ========================= */
  const [showManage, setShowManage] = useState(false);
  const manageRef = useRef(null);

  /* =========================
     Widgets order + enabled
  ========================= */
  const [widgetOrder, setWidgetOrder] = useState([
    "salesMarketing",
    "hrWorkforce",
    "itTechSpend",
    "financeAccounting",
    "supplyChain",
    "recruitmentAnalytics",
  ]);

  const [enabledWidgets, setEnabledWidgets] = useState({
    salesMarketing: true,
    hrWorkforce: true,
    itTechSpend: true,
    financeAccounting: true,
    supplyChain: true,
    recruitmentAnalytics: true,
  });

  /* =========================
     Chart types for each widget (3 charts)
     - trendType: line/bar
     - compareType: bar/line
     - mixType: pie/doughnut
  ========================= */
  const [chartPrefs, setChartPrefs] = useState({
    salesMarketing: { trendType: "line", compareType: "bar", mixType: "doughnut" },
    hrWorkforce: { trendType: "line", compareType: "bar", mixType: "pie" },
    itTechSpend: { trendType: "bar", compareType: "bar", mixType: "doughnut" },
    financeAccounting: { trendType: "line", compareType: "bar", mixType: "doughnut" },
    supplyChain: { trendType: "bar", compareType: "bar", mixType: "pie" },
    recruitmentAnalytics: { trendType: "line", compareType: "bar", mixType: "doughnut" },
  });

  const [showChartTypeDropdown, setShowChartTypeDropdown] = useState({});

  /* =========================
     Drag & Drop (native)
  ========================= */
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

  /* =========================
     Close outside dropdowns + modal
  ========================= */
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
     Demo time series data (12 months)
     - each area has: primary trend + secondary compare series
  ========================= */
  const asQuarter = (arr) => [
    sum(arr.slice(0, 3)),
    sum(arr.slice(3, 6)),
    sum(arr.slice(6, 9)),
    sum(arr.slice(9, 12)),
  ];

  // Sales/Marketing (Revenue + Pipeline)
  const revenue12 = [120000,132000,128000,140000,152000,160000,168000,172000,180000,190000,198000,210000];
  const pipeline12 = [520000,540000,560000,590000,610000,640000,660000,680000,710000,740000,770000,800000];

  // HR (Productivity + Utilization)
  const revPerEmp12 = [8200,8400,8600,8700,8900,9100,9300,9450,9600,9800,10050,10300];
  const utilization12 = [72,73,74,75,76,77,76,78,79,80,81,82]; // %

  // IT (Spend + License utilization)
  const itSpend12 = [45000,47000,46000,49000,52000,51000,54000,56000,55000,58000,60000,62000];
  const licenseUtil12 = [64,65,66,67,68,69,70,71,72,73,74,75]; // %

  // Finance (Liquidity + Expense trend)
  const cash12 = [90000,88000,92000,95000,97000,99000,101000,103000,104000,106000,108000,110000];
  const expense12 = [78000,79000,80000,82000,84000,86000,87000,89000,90000,91000,93000,95000];

  // Supply chain (On-time delivery + procurement spend)
  const onTime12 = [88,89,87,90,91,92,90,93,94,92,95,96]; // %
  const procurement12 = [52000,54000,53000,55000,57000,56000,59000,60000,61000,62000,64000,66000];

  // Recruitment (Revenue + Rehire %)
  const recruitmentRevenue12 = [820000,950000,880000,900000,1020000,980000,1100000,1180000,1240000,1300000,1360000,1420000];
  const rehireRate12 = [31,30,27,25,22,23,24,25,26,27,28,28.4]; // %

  const series = useMemo(() => {
    const pick = (arr) => (periodMode === "quarter" ? asQuarter(arr) : arr);

    return {
      salesMarketing: {
        primary: pick(revenue12),
        secondary: pick(pipeline12),
      },
      hrWorkforce: {
        primary: pick(revPerEmp12),
        secondary: pick(utilization12),
      },
      itTechSpend: {
        primary: pick(itSpend12),
        secondary: pick(licenseUtil12),
      },
      financeAccounting: {
        primary: pick(cash12),
        secondary: pick(expense12),
      },
      supplyChain: {
        primary: pick(onTime12),
        secondary: pick(procurement12),
      },
      recruitmentAnalytics: {
        primary: pick(recruitmentRevenue12),
        secondary: pick(rehireRate12),
      },
    };
  }, [periodMode]);

  /* =========================
     Widget meta + mix definitions
  ========================= */
  const widgetMeta = useMemo(() => {
    return {
      salesMarketing: {
        title: "Sales & Marketing Analytics",
        subtitle: "Revenue & Customer Insights",
        analyzePath: "/performance-analytics/sales-marketing",
        primaryLabel: "Total Revenue",
        secondaryLabel: "Pipeline Value",
        mix: {
          title: "Revenue Breakdown",
          labels: ["Region", "Product", "Segment", "Subscription"],
          data: [34, 28, 22, 16],
          colors: [COLORS.sky, COLORS.blue, COLORS.green, COLORS.yellow],
        },
      },
      hrWorkforce: {
        title: "HR & Workforce Analytics",
        subtitle: "Employee Productivity & Engagement",
        analyzePath: "/performance-analytics/hr-workforce",
        primaryLabel: "Revenue per Employee",
        secondaryLabel: "Utilization Rate",
        mix: {
          title: "Workforce Mix",
          labels: ["Engineering", "Sales", "Ops", "HR", "Finance"],
          data: [36, 22, 18, 10, 14],
          colors: [COLORS.blue, COLORS.green, COLORS.sky, COLORS.yellow, COLORS.purple],
        },
      },
      itTechSpend: {
        title: "IT & Technology Spend Analytics",
        subtitle: "IT Budget Optimization & ROI",
        analyzePath: "/performance-analytics/it-technology",
        primaryLabel: "IT Spend",
        secondaryLabel: "License Utilization",
        mix: {
          title: "IT Spend Breakdown",
          labels: ["Cloud", "SaaS", "Infra", "Security", "Services"],
          data: [32, 24, 18, 14, 12],
          colors: [COLORS.sky, COLORS.blue, COLORS.green, COLORS.red, COLORS.yellow],
        },
      },
      financeAccounting: {
        title: "Finance & Accounting Analytics",
        subtitle: "Financial Health & Risk",
        analyzePath: "/performance-analytics/finance-accounting",
        primaryLabel: "Cash / Liquidity",
        secondaryLabel: "Expense Trend",
        mix: {
          title: "Expense Categories",
          labels: ["COGS", "Payroll", "Marketing", "IT", "Other"],
          data: [38, 28, 14, 10, 10],
          colors: [COLORS.red, COLORS.blue, COLORS.yellow, COLORS.purple, COLORS.green],
        },
      },
      supplyChain: {
        title: "Supply Chain & Procurement Analytics",
        subtitle: "Cost Efficiency & Vendor Performance",
        analyzePath: "/performance-analytics/supply-chain",
        primaryLabel: "On-time Delivery",
        secondaryLabel: "Procurement Spend",
        mix: {
          title: "Procurement Spend",
          labels: ["Raw Materials", "Services", "Logistics", "Packaging"],
          data: [40, 24, 20, 16],
          colors: [COLORS.green, COLORS.blue, COLORS.yellow, COLORS.sky],
        },
      },
      recruitmentAnalytics: {
        title: "Recruitment Performance Analytics",
        subtitle: "Recruiter Productivity & Talent Redeployment",
        analyzePath: "/recruitment-performance-dashboard",
        primaryLabel: "Revenue",
        secondaryLabel: "Rehire %",
        mix: {
          title: "Starts by Candidate Type",
          labels: ["First-time Hire", "Rehire", "Redeployed", "Referral"],
          data: [58, 28, 10, 4],
          colors: [COLORS.blue, COLORS.green, COLORS.yellow, COLORS.purple],
        },
      },
    };
  }, []);

  /* =========================
     Metrics (7)
  ========================= */
  const metrics = useMemo(() => {
    const totalRevenue = sum(series.salesMarketing.primary);
    const avgWinRate = 42; // demo
    const avgUtil = Math.round(avg(series.hrWorkforce.secondary));
    const totalITSpend = sum(series.itTechSpend.primary);
    const avgCash = Math.round(avg(series.financeAccounting.primary));
    const avgOnTime = Math.round(avg(series.supplyChain.primary));
    const totalProcSpend = sum(series.supplyChain.secondary);
    const recruitmentRevenue = sum(series.recruitmentAnalytics.primary);
    const avgRehireRate = Math.round(avg(series.recruitmentAnalytics.secondary) * 10) / 10;

    return [
      { key: "total_revenue", title: "Total Revenue", value: fmtUSD(totalRevenue) },
      { key: "win_rate", title: "Win Rate", value: fmtPct(avgWinRate) },
      { key: "utilization", title: "Utilization Rate", value: fmtPct(avgUtil) },
      { key: "it_spend", title: "IT Spend", value: fmtUSD(totalITSpend) },
      { key: "avg_cash", title: "Avg Liquidity", value: fmtUSD(avgCash) },
      { key: "on_time", title: "On-time Delivery", value: fmtPct(avgOnTime) },
      { key: "proc_spend", title: "Procurement Spend", value: fmtUSD(totalProcSpend) },
      { key: "recruitment_revenue", title: "Recruitment Revenue", value: fmtUSD(recruitmentRevenue) },
      { key: "rehire_rate", title: "Rehire Rate", value: fmtPct(avgRehireRate) },
    ];
  }, [series]);

  /* =========================
     3 chart renderers
  ========================= */
  const renderTrend = (wid) => {
    const pref = chartPrefs[wid] || {};
    const meta = widgetMeta[wid];
    const primary = series[wid].primary;

    if (pref.trendType === "bar") {
      return (
        <div className="h-[190px]">
          <Bar
            data={{
              labels,
              datasets: [
                {
                  label: meta.primaryLabel,
                  data: primary,
                  backgroundColor: primary.map((_, i) => (i % 2 === 0 ? "rgba(14, 165, 233, 0.55)" : "rgba(59, 130, 246, 0.55)")),
                  borderRadius: 10,
                },
              ],
            }}
            options={smallLegendOptions}
          />
        </div>
      );
    }

    return (
      <div className="h-[190px]">
        <Line
          data={{
            labels,
            datasets: [
              {
                label: meta.primaryLabel,
                data: primary,
                backgroundColor: "rgba(14, 165, 233, 0.18)",
                borderColor: "rgba(14, 165, 233, 1)",
                borderWidth: 2,
                tension: 0.35,
                pointRadius: 2,
              },
            ],
          }}
          options={smallLegendOptions}
        />
      </div>
    );
  };

  const renderCompare = (wid) => {
    const pref = chartPrefs[wid] || {};
    const meta = widgetMeta[wid];
    const primary = series[wid].primary;
    const secondary = series[wid].secondary;

    // Compare defaults to bar; allow line
    if (pref.compareType === "line") {
      return (
        <div className="h-[190px]">
          <Line
            data={{
              labels,
              datasets: [
                {
                  label: meta.primaryLabel,
                  data: primary,
                  borderColor: "rgba(59, 130, 246, 1)",
                  backgroundColor: "rgba(59, 130, 246, 0.14)",
                  borderWidth: 2,
                  tension: 0.35,
                  pointRadius: 2,
                },
                {
                  label: meta.secondaryLabel,
                  data: secondary,
                  borderColor: "rgba(16, 185, 129, 1)",
                  backgroundColor: "rgba(16, 185, 129, 0.12)",
                  borderWidth: 2,
                  tension: 0.35,
                  pointRadius: 2,
                },
              ],
            }}
            options={smallLegendOptions}
          />
        </div>
      );
    }

    return (
      <div className="h-[190px]">
        <Bar
          data={{
            labels,
            datasets: [
              {
                label: meta.primaryLabel,
                data: primary,
                backgroundColor: "rgba(59, 130, 246, 0.55)",
                borderRadius: 10,
              },
              {
                label: meta.secondaryLabel,
                data: secondary,
                backgroundColor: "rgba(16, 185, 129, 0.55)",
                borderRadius: 10,
              },
            ],
          }}
          options={smallLegendOptions}
        />
      </div>
    );
  };

  const renderMix = (wid) => {
    const pref = chartPrefs[wid] || {};
    const mix = widgetMeta[wid].mix;

    const d = {
      labels: mix.labels,
      datasets: [{ label: mix.title, data: mix.data, backgroundColor: mix.colors, borderWidth: 0 }],
    };

    return (
      <div className="h-[190px]">
        {pref.mixType === "pie" ? <Pie data={d} options={smallLegendOptions} /> : <Doughnut data={d} options={smallLegendOptions} />}
      </div>
    );
  };

  /* =========================
     Manage modal
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
            <div className="text-lg font-semibold text-sky-900">Manage Analytics Widgets</div>
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

  const visibleWidgets = widgetOrder.filter((wid) => enabledWidgets[wid]);

  // Filter widgets by focus area (optional)
  const filteredWidgets = useMemo(() => {
    if (focusArea === "all") return visibleWidgets;
    const map = {
      sales: ["salesMarketing"],
      hr: ["hrWorkforce"],
      it: ["itTechSpend"],
      finance: ["financeAccounting"],
      supply: ["supplyChain"],
      recruitment: ["recruitmentAnalytics"],
    };
    const allow = new Set(map[focusArea] || []);
    return visibleWidgets.filter((w) => allow.has(w));
  }, [visibleWidgets, focusArea]);

  return (
    <div className="space-y-6 min-h-screen bg-slate-50 relative p-4">
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
            <h1 className="text-xl font-bold text-white">Performance Analytics</h1>
            <p className="text-sky-100 text-s">Sales • HR • IT • Finance • Supply Chain • Recruitment</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              {/* <span className="text-x font-semibold text-white/90">Year</span> */}
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="h-9 px-3 rounded-lg bg-white/95 text-slate-800 text-s outline-none border border-white/70"
              >
                <option>2024</option>
                <option>2025</option>
                <option>2026</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              {/* <span className="text-x font-semibold text-white/90">Period</span> */}
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
              <span className="text-x font-semibold text-white/90">Focus</span>
              <select
                value={focusArea}
                onChange={(e) => setFocusArea(e.target.value)}
                className="h-9 px-3 rounded-lg bg-white/95 text-slate-800 text-s outline-none border border-white/70"
              >
                <option value="all">all</option>
                <option value="sales">sales & marketing</option>
                <option value="hr">hr</option>
                <option value="it">it</option>
                <option value="finance">finance</option>
                <option value="supply">supply chain</option>
                <option value="recruitment">recruitment</option>
              </select>
            </div>

            <button
              type="button"
              className="flex items-center h-9 px-3 text-s font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition"
              onClick={() => setShowManage(true)}
            >
              <FiPlus className="mr-2" />
              Manage Widgets
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

      {/* Metrics + Ask AI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-2">
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

              <div className="relative" onMouseEnter={() => openMetricAI(m.key)} onMouseLeave={() => closeMetricAI(m.key)}>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredWidgets.map((wid) => {
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
              {/* Card header */}
              <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-2">
                <div>
                  <div className="text-base font-semibold text-sky-900">{meta.title}</div>
                  <div className="text-x text-slate-500 mt-1">{meta.subtitle}</div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Ask AI (hover popup) */}
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
                      <div className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-lg z-30 border border-slate-200 overflow-hidden">
                        <div className="px-3 py-2 text-x font-semibold text-slate-600 bg-slate-50">Trend chart</div>
                        {[
                          { id: "line", label: "Line" },
                          { id: "bar", label: "Bar" },
                        ].map((x) => (
                          <button
                            key={x.id}
                            onClick={() => setChartPrefs((p) => ({ ...p, [wid]: { ...p[wid], trendType: x.id } }))}
                            className={`block w-full text-left px-4 py-2 text-s hover:bg-slate-50 ${
                              pref?.trendType === x.id ? "text-sky-900 font-semibold" : "text-slate-700"
                            }`}
                          >
                            {x.label}
                          </button>
                        ))}

                        <div className="px-3 py-2 text-x font-semibold text-slate-600 bg-slate-50 border-t">Compare chart</div>
                        {[
                          { id: "bar", label: "Bar" },
                          { id: "line", label: "Line" },
                        ].map((x) => (
                          <button
                            key={x.id}
                            onClick={() => setChartPrefs((p) => ({ ...p, [wid]: { ...p[wid], compareType: x.id } }))}
                            className={`block w-full text-left px-4 py-2 text-s hover:bg-slate-50 ${
                              pref?.compareType === x.id ? "text-sky-900 font-semibold" : "text-slate-700"
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
                            onClick={() => setChartPrefs((p) => ({ ...p, [wid]: { ...p[wid], mixType: x.id } }))}
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
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <motion.div
                    key={`${wid}-trend-${chartPrefs[wid]?.trendType}-${periodMode}-${year}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <div className="text-x font-semibold text-slate-700 mb-2">{meta.primaryLabel} Trend</div>
                    {renderTrend(wid)}
                  </motion.div>

                  <motion.div
                    key={`${wid}-compare-${chartPrefs[wid]?.compareType}-${periodMode}-${year}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <div className="text-x font-semibold text-slate-700 mb-2">Compare: {meta.primaryLabel} vs {meta.secondaryLabel}</div>
                    {renderCompare(wid)}
                  </motion.div>

                  <motion.div
                    key={`${wid}-mix-${chartPrefs[wid]?.mixType}-${year}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <div className="text-x font-semibold text-slate-700 mb-2">{meta.mix.title}</div>
                    {renderMix(wid)}
                  </motion.div>
                </div>
              </div>

              <div className="h-1 w-full bg-gradient-to-r from-sky-400 via-blue-400 to-purple-400 opacity-0 hover:opacity-100 transition" />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default PerformanceAnalyticsOverview;
