import React, { useState, useRef, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { Link, useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import { motion } from "framer-motion";
import { FiChevronRight, FiDownload, FiFilter, FiChevronDown, FiSend, FiDollarSign, FiPercent, FiClock, FiTrendingUp } from "react-icons/fi";
import { BsStars, BsThreeDotsVertical } from "react-icons/bs";
import { Tooltip as ReactTooltip } from "react-tooltip";
import { RiDragMove2Fill } from "react-icons/ri";
import { GrLinkNext } from "react-icons/gr";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

const useOutsideClick = (callback) => {
  const ref = useRef();
  useEffect(() => {
    const handleClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) callback();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [callback]);
  return ref;
};

const cardVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

// PDF sections 10 (Cost & Operating Leverage) + 11 (Funnel & Cycle-Time)
const kpiCost = {
  recruitingPayrollPct: { value: "11.1%", change: "+0.4 pts", icon: <FiPercent size={16} />, componentPath: "/recruitment-performance-table", forecast: "10.8% predicted next quarter" },
  sourcingCostPerStart: { value: "$612", change: "-$34", icon: <FiDollarSign size={16} />, componentPath: "/recruitment-performance-table", forecast: "$580 predicted next quarter" },
  benchCost: { value: "$182K", change: "+$9K", icon: <FiDollarSign size={16} />, componentPath: "/recruitment-performance-table", forecast: "$175K predicted next quarter" },
  operatingLeverageRatio: { value: "1.6x", change: "+0.2x", icon: <FiTrendingUp size={16} />, componentPath: "/recruitment-performance-table", forecast: "1.7x predicted next quarter" },
};

const chartsCost = {
  costLayers: {
    title: "Cost Layer Breakdown",
    componentPath: "/recruitment-performance-table",
    data: {
      labels: ["Direct Delivery Costs", "Recruiting Acquisition Costs", "Operating Support Costs"],
      datasets: [{ label: "Cost ($M)", data: [8.76, 1.42, 0.68], backgroundColor: ["rgba(59,130,246,0.7)", "rgba(20,184,166,0.7)", "rgba(234,179,8,0.7)"] }],
    },
    options: { maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
    defaultType: "doughnut",
  },
  sourcingCostTrend: {
    title: "Sourcing Cost per Start — Trend",
    componentPath: "/recruitment-performance-table",
    data: {
      labels: ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"],
      datasets: [{ label: "Sourcing Cost / Start ($)", data: [720, 705, 690, 680, 665, 655, 645, 635, 628, 620, 615, 612], borderColor: "rgba(239, 68, 68, 1)", backgroundColor: "rgba(239, 68, 68, 0.12)", borderWidth: 2, tension: 0.35 }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
    defaultType: "line",
  },
  cycleTime: {
    title: "Recruiting Funnel Cycle-Time (avg days)",
    componentPath: "/recruitment-performance-table",
    data: {
      labels: ["Time-to-Submit", "Time-to-Interview", "Time-to-Offer", "Time-to-Fill", "Time-to-Start"],
      datasets: [
        { label: "Actual", data: [6, 11, 22, 31, 40], backgroundColor: "rgba(59, 130, 246, 0.7)" },
        { label: "Target", data: [5, 9, 18, 26, 34], backgroundColor: "rgba(234, 179, 8, 0.7)" },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
    defaultType: "bar",
  },
  fillRateFunnel: {
    title: "Funnel Conversion Rates",
    componentPath: "/recruiter-analytics",
    data: {
      labels: ["Submission Rate", "Submission→Interview", "Interview→Offer", "Offer Acceptance", "Offer→Start", "Fill Rate"],
      datasets: [{
        label: "Conversion %",
        data: [68.2, 47.3, 39.1, 88.9, 74.1, 61.5],
        backgroundColor: "rgba(20, 184, 166, 0.2)",
        borderColor: "rgba(20, 184, 166, 1)",
        borderWidth: 2,
        tension: 0.35,
        fill: true,
      }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}%` } } } },
    defaultType: "line",
  },
};

const requisitionAging = [
  { requisition: "Acme Corporation — Sr. Data Engineer (R-4410)", opened: "2026-06-18", daysOpen: 48, recruiter: "Anita Rao", status: "Open" },
  { requisition: "Globex Inc — QA Manager (R-4423)", opened: "2026-06-29", daysOpen: 37, recruiter: "David Kim", status: "Open" },
  { requisition: "Initech — Platform Engineer (R-4431)", opened: "2026-07-05", daysOpen: 31, recruiter: "Michael Lee", status: "Open" },
  { requisition: "Acme Corporation — Business Analyst (R-4438)", opened: "2026-07-10", daysOpen: 26, recruiter: "Anita Rao", status: "Open" },
];

const KPICard = ({ title, value, change, isPositive, icon, componentPath, forecast }) => {
  const navigate = useNavigate();
  const [showAI, setShowAI] = useState(false);
  const [localInput, setLocalInput] = useState("");
  const aiRef = useOutsideClick(() => setShowAI(false));
  const kpiId = title.replace(/\s+/g, "-").toLowerCase();

  return (
    <motion.div variants={cardVariants} initial="hidden" animate="visible" whileHover={{ y: -3 }} className="bg-white p-3 rounded-lg shadow-sm border border-sky-100 relative cursor-pointer" onClick={() => navigate(componentPath)}>
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center justify-between relative">
            <p className="text-[10px] font-semibold text-sky-600 uppercase tracking-wider truncate">{title}</p>
            <button onClick={(e) => { e.stopPropagation(); setShowAI(!showAI); }} className="p-1 rounded hover:bg-gray-100 z-20" data-tooltip-id={`ai-tooltip-${kpiId}`} data-tooltip-content="Ask AI">
              <BsStars />
            </button>
            {showAI && (
              <div ref={aiRef} className="absolute right-0 top-5 mt-2 w-full sm:w-44 bg-white rounded-md shadow-lg z-30 border border-gray-200 p-2" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center space-x-2">
                  <input type="text" value={localInput} onChange={(e) => setLocalInput(e.target.value)} placeholder="Ask AI..." className="w-full p-1 border border-gray-300 rounded text-x" />
                  <button onClick={() => setLocalInput("")} className="p-1 bg-sky-500 text-white rounded hover:bg-sky-600" disabled={!localInput.trim()}>
                    <FiSend />
                  </button>
                </div>
              </div>
            )}
          </div>
          <p className="text-s font-bold text-sky-900 mt-1">{value}</p>
          <div className={`flex items-center mt-2 ${isPositive ? "text-green-500" : "text-red-500"}`}>
            <span className="text-[10px] font-medium">{change}</span>
          </div>
          {forecast && <p className="text-[10px] text-gray-500 italic mt-1">AI Forecast: {forecast}</p>}
        </div>
        <div className="p-2 rounded-full bg-sky-100 hover:bg-sky-200 transition-colors duration-200">
          <div className="text-sky-600 hover:text-sky-800 transition-colors duration-200">{icon}</div>
        </div>
      </div>
      <ReactTooltip id={`ai-tooltip-${kpiId}`} place="top" effect="solid" />
    </motion.div>
  );
};

const CostOperatingLeverage = () => {
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const initialChartTypes = Object.keys(chartsCost).reduce((acc, key) => ({ ...acc, [key]: chartsCost[key].defaultType }), {});
  const [chartTypes, setChartTypes] = useState(initialChartTypes);
  const [activeWidgets, setActiveWidgets] = useState(Object.keys(chartsCost));
  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const [aiInputChart, setAiInputChart] = useState({});
  const [showAIDropdownChart, setShowAIDropdownChart] = useState(null);
  const filtersRef = useOutsideClick(() => setShowFilters(false));

  const toggleChartType = (widgetId, type) => {
    setChartTypes((prev) => ({ ...prev, [widgetId]: type }));
    setDropdownWidget(null);
    setHoveredChartType(null);
  };

  const handleSendAIQueryChart = (widgetId) => {
    if (aiInputChart[widgetId]?.trim()) {
      setAiInputChart((prev) => ({ ...prev, [widgetId]: "" }));
      setShowAIDropdownChart(null);
    }
  };

  const renderChart = (type, data, options = {}) => {
    const chartOptions = { ...options, responsive: true, maintainAspectRatio: false };
    switch (type) {
      case "line": return <Line data={data} options={chartOptions} />;
      case "bar": return <Bar data={data} options={chartOptions} />;
      case "doughnut": return <Doughnut data={data} options={chartOptions} />;
      default: return <Bar data={data} options={chartOptions} />;
    }
  };

  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;
    const items = Array.from(activeWidgets);
    const [reordered] = items.splice(source.index, 1);
    items.splice(destination.index, 0, reordered);
    setActiveWidgets(items);
  };

  const EnhancedChartCard = ({ widgetId, index }) => {
    const chartInfo = chartsCost[widgetId];
    const chartType = chartTypes[widgetId];
    const threeDotsRef = useOutsideClick(() => setDropdownWidget(null));
    const aiRef = useOutsideClick(() => { if (showAIDropdownChart === widgetId) setShowAIDropdownChart(null); });

    return (
      <Draggable draggableId={widgetId} index={index}>
        {(provided) => (
          <div className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border border-sky-100" ref={provided.innerRef} {...provided.draggableProps}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-md font-semibold text-sky-800">{chartInfo.title}</h3>
              <div className="flex space-x-1 relative">
                <div className="relative">
                  <button onClick={(e) => { e.stopPropagation(); setDropdownWidget(dropdownWidget === widgetId ? null : widgetId); }} className="p-1 rounded hover:bg-gray-100" data-tooltip-id={`chart-options-${widgetId}`} data-tooltip-content="Options">
                    <BsThreeDotsVertical />
                  </button>
                  {dropdownWidget === widgetId && (
                    <div ref={threeDotsRef} className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-20 border border-gray-200">
                      <div className="py-1 text-x text-gray-800">
                        <div className="relative" onMouseEnter={() => setHoveredChartType(widgetId)} onMouseLeave={() => setHoveredChartType(null)}>
                          <div className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center">
                            All Chart Types <FiChevronDown className="ml-1 text-x" />
                          </div>
                          {hoveredChartType === widgetId && (
                            <div className="absolute top-0 left-full w-40 bg-white rounded-md shadow-lg border border-gray-200 z-30 py-1" style={{ marginLeft: "-1px" }}>
                              {["line", "bar", "doughnut"].map((type) => (
                                <button key={type} onClick={(e) => { e.stopPropagation(); toggleChartType(widgetId, type); }} className="block w-full text-left px-4 py-2 text-x text-gray-700 hover:bg-gray-100 transition">
                                  {type.charAt(0).toUpperCase() + type.slice(1)} Chart
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="px-4 py-2 hover:bg-gray-100 cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(chartInfo.componentPath); setDropdownWidget(null); }}>
                          Analyze
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={(e) => { e.stopPropagation(); setShowAIDropdownChart(showAIDropdownChart === widgetId ? null : widgetId); }} className="p-1 rounded hover:bg-gray-100" data-tooltip-id={`ai-tooltip-chart-${widgetId}`} data-tooltip-content="Ask AI">
                  <BsStars />
                </button>
                {showAIDropdownChart === widgetId && (
                  <div ref={aiRef} className="absolute right-0 top-full mt-2 w-full sm:w-64 bg-white rounded-md shadow-lg z-20 border border-gray-200 p-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-col items-center space-y-1">
                      <h1 className="text-x text-gray-700">Ask about {chartInfo.title}</h1>
                      <div className="flex justify-between gap-2 w-full">
                        <input type="text" value={aiInputChart[widgetId] || ""} onChange={(e) => setAiInputChart((prev) => ({ ...prev, [widgetId]: e.target.value }))} placeholder="Your question..." className="w-full p-1 border border-gray-300 rounded text-x" />
                        <button onClick={() => handleSendAIQueryChart(widgetId)} className="p-2 bg-sky-500 text-white rounded hover:bg-sky-600 text-x" disabled={!aiInputChart[widgetId]?.trim()}>
                          <FiSend />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <div {...provided.dragHandleProps} className="p-1 rounded hover:bg-gray-100 cursor-move">
                  <RiDragMove2Fill />
                </div>
              </div>
            </div>
            <div className="h-64 md:h-72">{renderChart(chartType, chartInfo.data, chartInfo.options)}</div>
            <ReactTooltip id={`chart-options-${widgetId}`} place="top" effect="solid" />
            <ReactTooltip id={`ai-tooltip-chart-${widgetId}`} place="top" effect="solid" />
          </div>
        )}
      </Draggable>
    );
  };

  return (
    <div className="space-y-6 p-4 min-h-screen relative bg-sky-50">
      <nav className="flex mb-4" aria-label="Breadcrumb">
        <ol className="inline-flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse">
          <li className="inline-flex items-center">
            <Link to="/" className="inline-flex items-center text-s font-medium text-gray-700 hover:text-blue-600">
              <svg className="w-3 h-3 me-2.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                <path d="m19.707 9.293-2-2-7-7a1 1 0 0 0-1.414 0l-7 7-2 2a1 1 0 0 0 1.414 1.414L2 10.414V18a2 2 0 0 0 2 2h3a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h3a2 2 0 0 0 2-2v-7.586l.293.293a1 1 0 0 0 1.414-1.414Z" />
              </svg>
              Home
            </Link>
          </li>
          <li>
            <div className="flex items-center">
              <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
              <Link to="/recruitment-performance-dashboard" className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                Recruitment Performance Dashboard
              </Link>
            </div>
          </li>
          <li aria-current="page">
            <div className="flex items-center">
              <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Cost & Operating Leverage</span>
            </div>
          </li>
        </ol>
      </nav>

      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-white">Cost & Operating Leverage</h1>
            <p className="text-sky-100 text-x mt-1">Delivery, acquisition and support costs plus recruiting funnel cycle-time.</p>
          </div>
          <div className="flex space-x-2">
            <button type="button" className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200" onClick={() => setShowFilters(!showFilters)}>
              <FiFilter className="mr-1" /> Filters
            </button>
            <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 hover:text-sky-50 transition-colors duration-200">
              <FiDownload className="text-sky-50" />
              <span className="text-sky-50">Export</span>
            </button>
            <Link to="/recruitment-performance-table">
              <button type="button" className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200">
                View More
                <GrLinkNext className="ml-1 w-4 h-4 hover:w-5 hover:h-5 transition-all" />
              </button>
            </Link>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white p-4 rounded-lg shadow-sm" ref={filtersRef}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Business Unit</label>
              <select className="w-full p-2 border border-gray-300 rounded-md text-s"><option>All</option></select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Time-to-Fill Policy</label>
              <select className="w-full p-2 border border-gray-300 rounded-md text-s"><option>Offer Acceptance</option><option>Candidate Start</option></select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Period</label>
              <select className="w-full p-2 border border-gray-300 rounded-md text-s"><option>QTD</option><option>MTD</option><option>YTD</option></select>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(kpiCost).map(([key, kpi]) => (
          <KPICard key={key} title={key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())} value={kpi.value} change={kpi.change} isPositive={!kpi.change.startsWith("+") || key === "operatingLeverageRatio"} icon={kpi.icon} componentPath={kpi.componentPath} forecast={kpi.forecast} />
        ))}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="costCharts">
          {(provided) => (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" {...provided.droppableProps} ref={provided.innerRef}>
              {activeWidgets.map((widgetId, index) => (
                <EnhancedChartCard key={widgetId} widgetId={widgetId} index={index} />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex items-center gap-2 mb-2">
          <FiClock className="text-amber-500" />
          <h3 className="text-s font-semibold text-sky-800">Requisition Aging (Open, 25+ days)</h3>
        </div>
        <table className="w-full text-x text-gray-700">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left">Requisition</th>
              <th className="p-2 text-left">Opened</th>
              <th className="p-2 text-left">Days Open</th>
              <th className="p-2 text-left">Recruiter</th>
              <th className="p-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {requisitionAging.map((row) => (
              <tr key={row.requisition} className="border-b">
                <td className="p-2">{row.requisition}</td>
                <td className="p-2">{row.opened}</td>
                <td className={`p-2 font-semibold ${row.daysOpen > 40 ? "text-red-600" : "text-amber-600"}`}>{row.daysOpen}</td>
                <td className="p-2">{row.recruiter}</td>
                <td className="p-2">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CostOperatingLeverage;
