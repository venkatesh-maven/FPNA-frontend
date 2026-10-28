import React, { useState, useRef, useEffect, useMemo } from "react";
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
import { FiChevronRight, FiDownload, FiFilter, FiChevronDown, FiSend, FiBriefcase, FiCheckCircle, FiClock, FiPercent, FiX } from "react-icons/fi";
import { BsStars, BsThreeDotsVertical } from "react-icons/bs";
import { Tooltip as ReactTooltip } from "react-tooltip";
import { RiDragMove2Fill } from "react-icons/ri";

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

// Client-level summary: positions received from the customer vs. filled vs. still in process.
const clientPositionSummary = [
  { client: "Acme Corporation", received: 42, filled: 19, inProcess: 15, open: 6, cancelled: 2, fillRate: "45.2%", avgTTF: "34 days" },
  { client: "Globex Inc", received: 31, filled: 18, inProcess: 9, open: 3, cancelled: 1, fillRate: "58.1%", avgTTF: "27 days" },
  { client: "Initech", received: 24, filled: 11, inProcess: 8, open: 4, cancelled: 1, fillRate: "45.8%", avgTTF: "31 days" },
  { client: "Umbrella Corp", received: 18, filled: 12, inProcess: 4, open: 2, cancelled: 0, fillRate: "66.7%", avgTTF: "24 days" },
  { client: "Stark Industries", received: 9, filled: 3, inProcess: 4, open: 2, cancelled: 0, fillRate: "33.3%", avgTTF: "19 days" },
];

// Requisition-level detail — drills down from a client row, one row per position.
const positionDetail = [
  { reqId: "R-4410", client: "Acme Corporation", role: "Sr. Data Engineer", recruiter: "Anita Rao", status: "In Process", candidatesInProcess: 3, daysOpen: 48 },
  { reqId: "R-4423", client: "Globex Inc", role: "QA Manager", recruiter: "David Kim", status: "In Process", candidatesInProcess: 2, daysOpen: 37 },
  { reqId: "R-4431", client: "Initech", role: "Platform Engineer", recruiter: "Michael Lee", status: "In Process", candidatesInProcess: 4, daysOpen: 31 },
  { reqId: "R-4438", client: "Acme Corporation", role: "Business Analyst", recruiter: "Anita Rao", status: "Open", candidatesInProcess: 0, daysOpen: 26 },
  { reqId: "R-4442", client: "Umbrella Corp", role: "Frontend Engineer", recruiter: "Priya Shah", status: "Filled", candidatesInProcess: 0, daysOpen: 19 },
  { reqId: "R-4451", client: "Globex Inc", role: "UX Designer", recruiter: "Priya Shah", status: "In Process", candidatesInProcess: 2, daysOpen: 8 },
  { reqId: "R-4460", client: "Acme Corporation", role: "SRE", recruiter: "Michael Lee", status: "In Process", candidatesInProcess: 1, daysOpen: 12 },
  { reqId: "R-4318", client: "Initech", role: "DevOps Engineer", recruiter: "David Kim", status: "In Process", candidatesInProcess: 2, daysOpen: 22 },
  { reqId: "R-4470", client: "Stark Industries", role: "Business Analyst", recruiter: "David Kim", status: "In Process", candidatesInProcess: 3, daysOpen: 15 },
  { reqId: "R-4475", client: "Umbrella Corp", role: "QA Engineer", recruiter: "Priya Shah", status: "Filled", candidatesInProcess: 0, daysOpen: 21 },
  { reqId: "R-4480", client: "Acme Corporation", role: "Data Analyst", recruiter: "Anita Rao", status: "Cancelled", candidatesInProcess: 0, daysOpen: 40 },
  { reqId: "R-4485", client: "Stark Industries", role: "Support Engineer", recruiter: "Michael Lee", status: "Open", candidatesInProcess: 0, daysOpen: 6 },
];

const statusColor = {
  Filled: "text-emerald-600 bg-emerald-50",
  "In Process": "text-sky-600 bg-sky-50",
  Open: "text-amber-600 bg-amber-50",
  Cancelled: "text-red-600 bg-red-50",
};

const chartsFulfillment = {
  statusByClient: {
    title: "Positions by Status — per Client",
    data: {
      labels: clientPositionSummary.map((c) => c.client),
      datasets: [
        { label: "Filled", data: clientPositionSummary.map((c) => c.filled), backgroundColor: "rgba(16, 185, 129, 0.75)" },
        { label: "In Process", data: clientPositionSummary.map((c) => c.inProcess), backgroundColor: "rgba(59, 130, 246, 0.75)" },
        { label: "Open", data: clientPositionSummary.map((c) => c.open), backgroundColor: "rgba(234, 179, 8, 0.75)" },
        { label: "Cancelled", data: clientPositionSummary.map((c) => c.cancelled), backgroundColor: "rgba(239, 68, 68, 0.75)" },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, scales: { x: { stacked: true }, y: { stacked: true } } },
    defaultType: "bar",
  },
  fillRateByClient: {
    title: "Fill Rate % by Client",
    data: {
      labels: clientPositionSummary.map((c) => c.client),
      datasets: [{ label: "Fill Rate %", data: clientPositionSummary.map((c) => parseFloat(c.fillRate)), backgroundColor: "rgba(20, 184, 166, 0.7)" }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    defaultType: "bar",
  },
  receivedVsFilledTrend: {
    title: "Positions Received vs Filled — Trend",
    data: {
      labels: ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"],
      datasets: [
        { label: "Received", data: [9, 11, 8, 10, 12, 13, 11, 14, 12, 15, 13, 14], borderColor: "rgba(59, 130, 246, 1)", backgroundColor: "rgba(59, 130, 246, 0.1)", borderWidth: 2, tension: 0.35 },
        { label: "Filled", data: [4, 6, 5, 5, 6, 7, 6, 8, 7, 8, 8, 9], borderColor: "rgba(16, 185, 129, 1)", backgroundColor: "rgba(16, 185, 129, 0.1)", borderWidth: 2, tension: 0.35 },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
    defaultType: "line",
  },
  statusMix: {
    title: "Overall Position Status Mix",
    data: {
      labels: ["Filled", "In Process", "Open", "Cancelled"],
      datasets: [{
        label: "Positions",
        data: [
          clientPositionSummary.reduce((s, c) => s + c.filled, 0),
          clientPositionSummary.reduce((s, c) => s + c.inProcess, 0),
          clientPositionSummary.reduce((s, c) => s + c.open, 0),
          clientPositionSummary.reduce((s, c) => s + c.cancelled, 0),
        ],
        backgroundColor: ["rgba(16,185,129,0.75)", "rgba(59,130,246,0.75)", "rgba(234,179,8,0.75)", "rgba(239,68,68,0.75)"],
      }],
    },
    options: { maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
    defaultType: "doughnut",
  },
};

const KPICard = ({ title, value, subtext, icon, componentPath }) => {
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
          {subtext && <p className="text-[10px] text-gray-500 mt-2">{subtext}</p>}
        </div>
        <div className="p-2 rounded-full bg-sky-100 hover:bg-sky-200 transition-colors duration-200">
          <div className="text-sky-600 hover:text-sky-800 transition-colors duration-200">{icon}</div>
        </div>
      </div>
      <ReactTooltip id={`ai-tooltip-${kpiId}`} place="top" effect="solid" />
    </motion.div>
  );
};

const PositionFulfillmentReport = () => {
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const initialChartTypes = Object.keys(chartsFulfillment).reduce((acc, key) => ({ ...acc, [key]: chartsFulfillment[key].defaultType }), {});
  const [chartTypes, setChartTypes] = useState(initialChartTypes);
  const [activeWidgets, setActiveWidgets] = useState(Object.keys(chartsFulfillment));
  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const [aiInputChart, setAiInputChart] = useState({});
  const [showAIDropdownChart, setShowAIDropdownChart] = useState(null);
  const filtersRef = useOutsideClick(() => setShowFilters(false));

  const totals = useMemo(() => ({
    received: clientPositionSummary.reduce((s, c) => s + c.received, 0),
    filled: clientPositionSummary.reduce((s, c) => s + c.filled, 0),
    inProcess: clientPositionSummary.reduce((s, c) => s + c.inProcess, 0),
    open: clientPositionSummary.reduce((s, c) => s + c.open, 0),
    cancelled: clientPositionSummary.reduce((s, c) => s + c.cancelled, 0),
  }), []);
  const overallFillRate = ((totals.filled / totals.received) * 100).toFixed(1);

  const filteredDetail = selectedClient ? positionDetail.filter((p) => p.client === selectedClient) : positionDetail;

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
    const chartInfo = chartsFulfillment[widgetId];
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
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Client Position Fulfillment Report</span>
            </div>
          </li>
        </ol>
      </nav>

      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-white">Client Position Fulfillment Report</h1>
            <p className="text-sky-100 text-x mt-1">Positions received from each customer vs. filled, still in process, open and cancelled.</p>
          </div>
          <div className="flex space-x-2">
            <button type="button" className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200" onClick={() => setShowFilters(!showFilters)}>
              <FiFilter className="mr-1" /> Filters
            </button>
            <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 hover:text-sky-50 transition-colors duration-200">
              <FiDownload className="text-sky-50" />
              <span className="text-sky-50">Export</span>
            </button>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white p-4 rounded-lg shadow-sm" ref={filtersRef}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Client</label>
              <select className="w-full p-2 border border-gray-300 rounded-md text-s" value={selectedClient || ""} onChange={(e) => setSelectedClient(e.target.value || null)}>
                <option value="">All Clients</option>
                {clientPositionSummary.map((c) => <option key={c.client} value={c.client}>{c.client}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Recruiter</label>
              <select className="w-full p-2 border border-gray-300 rounded-md text-s"><option>All Recruiters</option></select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Period</label>
              <select className="w-full p-2 border border-gray-300 rounded-md text-s"><option>QTD</option><option>MTD</option><option>YTD</option></select>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Positions Received" value={totals.received} subtext="From all customers, selected period" icon={<FiBriefcase size={16} />} componentPath="/recruitment-performance-table" />
        <KPICard title="Positions Filled" value={totals.filled} subtext={`${overallFillRate}% overall fill rate`} icon={<FiCheckCircle size={16} />} componentPath="/recruitment-cost-leverage" />
        <KPICard title="Candidates In Process" value={totals.inProcess} subtext="Currently continuing in the funnel" icon={<FiClock size={16} />} componentPath="/recruiter-analytics" />
        <KPICard title="Overall Fill Rate" value={`${overallFillRate}%`} subtext={`${totals.open} open • ${totals.cancelled} cancelled`} icon={<FiPercent size={16} />} componentPath="/recruitment-revenue-analytics" />
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="fulfillmentCharts">
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
        <h3 className="text-s font-semibold text-sky-800 mb-2">Positions Received vs. Filled — by Client</h3>
        <p className="text-[10px] text-gray-500 mb-2">Click a row to drill into that client's requisitions below.</p>
        <table className="w-full text-x text-gray-700">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left">Client</th>
              <th className="p-2 text-left">Total Received</th>
              <th className="p-2 text-left">Filled</th>
              <th className="p-2 text-left">In Process</th>
              <th className="p-2 text-left">Open</th>
              <th className="p-2 text-left">Cancelled</th>
              <th className="p-2 text-left">Fill Rate</th>
              <th className="p-2 text-left">Avg Time-to-Fill</th>
            </tr>
          </thead>
          <tbody>
            {clientPositionSummary.map((row) => (
              <tr
                key={row.client}
                className={`border-b cursor-pointer hover:bg-sky-50 ${selectedClient === row.client ? "bg-sky-50" : ""}`}
                onClick={() => setSelectedClient(selectedClient === row.client ? null : row.client)}
              >
                <td className="p-2 font-medium">{row.client}</td>
                <td className="p-2">{row.received}</td>
                <td className="p-2 text-emerald-600 font-semibold">{row.filled}</td>
                <td className="p-2 text-sky-600 font-semibold">{row.inProcess}</td>
                <td className="p-2 text-amber-600">{row.open}</td>
                <td className="p-2 text-red-600">{row.cancelled}</td>
                <td className="p-2">{row.fillRate}</td>
                <td className="p-2">{row.avgTTF}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-semibold">
              <td className="p-2">Total</td>
              <td className="p-2">{totals.received}</td>
              <td className="p-2 text-emerald-600">{totals.filled}</td>
              <td className="p-2 text-sky-600">{totals.inProcess}</td>
              <td className="p-2 text-amber-600">{totals.open}</td>
              <td className="p-2 text-red-600">{totals.cancelled}</td>
              <td className="p-2">{overallFillRate}%</td>
              <td className="p-2">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-s font-semibold text-sky-800">
            Position Detail{selectedClient ? ` — ${selectedClient}` : " — All Clients"}
          </h3>
          {selectedClient && (
            <button onClick={() => setSelectedClient(null)} className="flex items-center gap-1 text-[11px] text-sky-700 hover:underline">
              <FiX size={12} /> Clear filter
            </button>
          )}
        </div>
        <table className="w-full text-x text-gray-700">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left">Req ID</th>
              <th className="p-2 text-left">Client</th>
              <th className="p-2 text-left">Role</th>
              <th className="p-2 text-left">Recruiter</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Candidates In Process</th>
              <th className="p-2 text-left">Days Open</th>
            </tr>
          </thead>
          <tbody>
            {filteredDetail.map((row) => (
              <tr key={row.reqId} className="border-b">
                <td className="p-2">{row.reqId}</td>
                <td className="p-2">{row.client}</td>
                <td className="p-2">{row.role}</td>
                <td className="p-2">{row.recruiter}</td>
                <td className="p-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor[row.status]}`}>{row.status}</span></td>
                <td className="p-2">{row.candidatesInProcess}</td>
                <td className="p-2">{row.daysOpen}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PositionFulfillmentReport;
