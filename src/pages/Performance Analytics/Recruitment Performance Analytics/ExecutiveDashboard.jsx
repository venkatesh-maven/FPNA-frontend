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
import { FiChevronRight, FiDownload, FiFilter, FiChevronDown, FiSend, FiDollarSign, FiPercent, FiTrendingUp, FiAlertTriangle } from "react-icons/fi";
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

// Consolidated, no candidate PII — CFO / COO / Business Unit Leader view
const kpiExecutive = {
  revenue: { value: "$12.8M", change: "+8.4%", icon: <FiDollarSign size={16} />, componentPath: "/recruitment-performance-table", forecast: "$13.6M predicted next quarter" },
  grossMargin: { value: "31.6%", change: "-1.8 pts", icon: <FiPercent size={16} />, componentPath: "/recruitment-gross-margin", forecast: "32.4% predicted next quarter" },
  contributionMargin: { value: "18.7%", change: "-1.1 pts vs plan", icon: <FiPercent size={16} />, componentPath: "/recruitment-cost-leverage", forecast: "19.4% predicted next quarter" },
  operatingLeverage: { value: "1.6x", change: "+0.2x", icon: <FiTrendingUp size={16} />, componentPath: "/recruitment-cost-leverage", forecast: "1.7x predicted next quarter" },
};

const chartsExecutive = {
  revenueGmTrend: {
    title: "Revenue & Gross Margin Trend",
    componentPath: "/recruitment-revenue-analytics",
    data: {
      labels: ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"],
      datasets: [
        { type: "bar", label: "Revenue ($M)", data: [0.82, 0.95, 0.88, 0.90, 1.02, 0.98, 1.10, 1.18, 1.24, 1.30, 1.36, 1.42], backgroundColor: "rgba(20, 184, 166, 0.55)", borderRadius: 6, yAxisID: "y" },
        { type: "line", label: "Gross Margin %", data: [35.1, 34.6, 34.2, 33.8, 34.0, 33.4, 32.9, 32.5, 32.1, 31.9, 31.7, 31.6], borderColor: "rgba(13, 118, 128, 1)", backgroundColor: "rgba(13, 118, 128, 0.15)", borderWidth: 2, tension: 0.35, yAxisID: "y1" },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } },
      scales: { y: { type: "linear", position: "left" }, y1: { type: "linear", position: "right", grid: { drawOnChartArea: false } } },
    },
    defaultType: "bar",
  },
  buPerformance: {
    title: "Revenue & GM % by Business Unit",
    componentPath: "/recruitment-performance-table",
    data: {
      labels: ["IT", "Clinical", "Finance", "Engineering", "Light Industrial"],
      datasets: [
        { label: "Revenue ($M)", data: [4.6, 3.1, 1.9, 2.2, 1.0], backgroundColor: "rgba(59, 130, 246, 0.7)", yAxisID: "y" },
        { label: "GM %", data: [33.2, 29.8, 34.1, 31.5, 27.4], type: "line", borderColor: "rgba(234, 179, 8, 1)", backgroundColor: "rgba(234,179,8,0.1)", borderWidth: 2, yAxisID: "y1" },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } },
      scales: { y: { type: "linear", position: "left" }, y1: { type: "linear", position: "right", grid: { drawOnChartArea: false } } },
    },
    defaultType: "bar",
  },
  clientConcentration: {
    title: "Client Concentration",
    componentPath: "/recruitment-revenue-analytics",
    data: {
      labels: ["Acme Corporation", "Globex Inc", "Initech", "Umbrella Corp", "Others"],
      datasets: [{ label: "Revenue Share %", data: [18.2, 14.5, 12.0, 10.0, 45.3], backgroundColor: ["rgba(59,130,246,0.7)", "rgba(16,185,129,0.7)", "rgba(234,179,8,0.7)", "rgba(139,92,246,0.7)", "rgba(148,163,184,0.7)"] }],
    },
    options: { maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
    defaultType: "doughnut",
  },
  riskSummary: {
    title: "Open Risk & Exception Counts",
    componentPath: "/recruitment-performance-table",
    data: {
      labels: ["Margin-Risk Placements", "Aging Requisitions (30d+)", "Clients w/ Revenue at Risk", "Capacity Imbalances"],
      datasets: [{ label: "Count", data: [5, 4, 2, 1], backgroundColor: "rgba(239, 68, 68, 0.7)" }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    defaultType: "bar",
  },
};

const exceptionsSummary = [
  { type: "Margin Risk", detail: "Five placements are below the approved 28% GM threshold.", impact: "-$62K GP", priority: "High" },
  { type: "Rehire Opportunity", detail: "38 previously successful candidates match current open requisitions.", impact: "+$1.2M potential", priority: "High" },
  { type: "Capacity Imbalance", detail: "Healthcare recruiters at 118% of target load; Professional Services 22% available.", impact: "Delivery risk", priority: "Medium" },
  { type: "Client Risk", detail: "Acme Corporation revenue up 12%, but GM declined 3.1 pts on overtime and rate-card exceptions.", impact: "-3.1 pts GM", priority: "High" },
  { type: "Funnel Bottleneck", detail: "Interview-to-offer conversion is 8 pts below target, concentrated in two job categories.", impact: "Slower starts", priority: "Medium" },
];

const priorityColor = { High: "text-red-600 bg-red-50", Medium: "text-amber-600 bg-amber-50", Low: "text-sky-600 bg-sky-50" };

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

const ExecutiveDashboard = () => {
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const initialChartTypes = Object.keys(chartsExecutive).reduce((acc, key) => ({ ...acc, [key]: chartsExecutive[key].defaultType }), {});
  const [chartTypes, setChartTypes] = useState(initialChartTypes);
  const [activeWidgets, setActiveWidgets] = useState(Object.keys(chartsExecutive));
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
    const chartInfo = chartsExecutive[widgetId];
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
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Executive Dashboard</span>
            </div>
          </li>
        </ol>
      </nav>

      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-white">Executive Dashboard</h1>
            <p className="text-sky-100 text-x mt-1">Consolidated recruitment P&L view for CFO / COO / Business Unit Leaders — no candidate PII.</p>
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
              <select className="w-full p-2 border border-gray-300 rounded-md text-s"><option>All</option><option>IT</option><option>Clinical</option><option>Finance</option><option>Engineering</option><option>Light Industrial</option></select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Geography</label>
              <select className="w-full p-2 border border-gray-300 rounded-md text-s"><option>All</option><option>US</option><option>Canada</option><option>Europe</option><option>APAC</option></select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Period</label>
              <select className="w-full p-2 border border-gray-300 rounded-md text-s"><option>QTD</option><option>MTD</option><option>YTD</option></select>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(kpiExecutive).map(([key, kpi]) => (
          <KPICard key={key} title={key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())} value={kpi.value} change={kpi.change} isPositive={!kpi.change.startsWith("-")} icon={kpi.icon} componentPath={kpi.componentPath} forecast={kpi.forecast} />
        ))}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="executiveCharts">
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
          <FiAlertTriangle className="text-amber-500" />
          <h3 className="text-s font-semibold text-sky-800">Prioritized Exceptions & AI Insights</h3>
        </div>
        <table className="w-full text-x text-gray-700">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Observation</th>
              <th className="p-2 text-left">Estimated Impact</th>
              <th className="p-2 text-left">Priority</th>
            </tr>
          </thead>
          <tbody>
            {exceptionsSummary.map((row) => (
              <tr key={row.type} className="border-b">
                <td className="p-2 font-medium">{row.type}</td>
                <td className="p-2">{row.detail}</td>
                <td className="p-2">{row.impact}</td>
                <td className="p-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${priorityColor[row.priority]}`}>{row.priority}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExecutiveDashboard;
