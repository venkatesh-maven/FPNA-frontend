
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
import { Bar, Line, Pie, Doughnut } from "react-chartjs-2";
import { motion } from "framer-motion";
import { FiTrendingUp, FiChevronRight, FiDownload, FiDollarSign, FiFilter, FiChevronDown, FiSend, FiUserPlus, FiTarget, FiPercent, FiBarChart2, FiUsers, FiCheckSquare } from "react-icons/fi";
import { BsStars, BsThreeDotsVertical } from "react-icons/bs";
import { Tooltip as ReactTooltip } from "react-tooltip";
import { RiDragMove2Fill } from "react-icons/ri";
import { GrLinkNext } from "react-icons/gr";
import { getDecimalPrecision } from '../../../utils/formatters';


ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

// Custom hook for detecting outside clicks
const useOutsideClick = (callback) => {
  const ref = useRef();
  useEffect(() => {
    const handleClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        callback();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [callback]);
  return ref;
};

// Animation variants for cards
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// --- Data specific to Pipeline & Conversion ---
const kpiDataPipeline = {
  leads: { 
    value: 12500, 
    change: "+15%", 
    icon: <FiUserPlus size={16} />, 
    componentPath: "/sales-performance-table", 
    forecast: "13,500 predicted next period" 
  },
  opportunities: { 
    value: 4890, 
    change: "+10%", 
    icon: <FiTarget size={16} />, 
    componentPath: "/sales-performance-table", 
    forecast: "5,200 predicted next period" 
  },
  conversionRate: { 
    value: "39.12%", 
    change: "-1.2%", 
    icon: <FiPercent size={16} />, 
    componentPath: "/sales-performance-table", 
    forecast: "40% predicted next period" 
  },
  avgDealSize: { 
    value: 15750, 
    change: "+5%", 
    icon: <FiDollarSign size={16} />, 
    componentPath: "/sales-performance-table", 
    forecast: "$16,000 predicted next period" 
  },
};

const chartsPipeline = {
  pipelineFunnel: {
    title: "Sales Pipeline Funnel",
    componentPath: "/sales-performance-table",
    data: {
      labels: ["Leads", "Qualified Leads", "Opportunities", "Proposals", "Wins"],
      datasets: [
        {
          label: "Count",
          data: [12500, 9800, 4890, 2100, 628],
          backgroundColor: [
            "rgba(59, 130, 246, 0.7)",
            "rgba(16, 185, 129, 0.7)",
            "rgba(234, 179, 8, 0.7)",
            "rgba(139, 92, 246, 0.7)",
            "rgba(239, 68, 68, 0.7)",
          ],
          borderColor: [
            "rgba(59, 130, 246, 1)",
            "rgba(16, 185, 129, 1)",
            "rgba(234, 179, 8, 1)",
            "rgba(139, 92, 246, 1)",
            "rgba(239, 68, 68, 1)",
          ],
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      indexAxis: 'y', // For a horizontal funnel-like bar chart
    },
    defaultType: "bar",
  },
  conversionByStage: {
    title: "Conversion Rate by Stage",
    componentPath: "/sales-performance-table",
    data: {
      labels: ["Lead to Qualified", "Qualified to Oppty", "Oppty to Proposal", "Proposal to Win"],
      datasets: [
        {
          label: "Conversion Rate (%)",
          data: [78.4, 49.9, 42.9, 29.9], // (9800/12500), (4890/9800), (2100/4890), (628/2100)
          backgroundColor: "rgba(16, 185, 129, 0.2)",
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 2,
          tension: 0.4,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (value) => `${value}%` } } },
    },
    defaultType: "line",
  },
  opportunityAge: {
    title: "Average Opportunity Age by Stage",
    componentPath: "/sales-performance-table",
    data: {
        labels: ["Qualified", "Needs Analysis", "Proposal", "Negotiation"],
        datasets: [{
            label: "Avg. Days",
            data: [12, 25, 38, 45],
            backgroundColor: "rgba(234, 179, 8, 0.7)",
            borderColor: "rgba(234, 179, 8, 1)",
            borderWidth: 1,
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
    },
    defaultType: "bar",
  },
  winLossReason: {
    title: "Win/Loss Reasons",
    componentPath: "/sales-performance-table",
    data: {
        labels: ["Price", "Feature Set", "Competition", "Timing", "Product Fit"],
        datasets: [
            {
                label: "Lost Deals",
                data: [45, 30, 25, 15, 10], // Example data
                backgroundColor: "rgba(239, 68, 68, 0.7)",
            },
            {
                label: "Won Deals (Reasons)",
                data: [20, 50, 10, 5, 15], // Example data related to positive reasons if applicable
                backgroundColor: "rgba(16, 185, 129, 0.7)",
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: { x: { stacked: true }, y: { stacked: true } },
    },
    defaultType: "bar",
  }
};
// --- END Data specific to Pipeline & Conversion ---


// KPICard Component (Adapted from SalesPerformanceDashboard.jsx)
const KPICard = ({ title, value, change, isPositive, icon, componentPath, forecast }) => {
  const navigate = useNavigate();
  const [showAIDropdown, setShowAIDropdown] = useState(false);
  const [localAIInput, setLocalAIInput] = useState("");
  const aiDropdownRef = useOutsideClick(() => setShowAIDropdown(false));

  const handleSendAIQuery = (e) => {
    e.stopPropagation(); // Prevent card click navigation
    if (localAIInput.trim()) {
      console.log(`AI Query for ${title}:`, localAIInput);
      // Implement actual AI query logic here
      setLocalAIInput("");
      setShowAIDropdown(false);
    }
  };
  
  const kpiTitleId = title.replace(/\s+/g, '-').toLowerCase();


  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -3 }}
      className="bg-white p-3 rounded-lg shadow-sm border border-sky-100 relative cursor-pointer"
      onClick={() => navigate(componentPath)}
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center justify-between relative ">
            <p className="text-[10px] font-semibold text-sky-600 uppercase tracking-wider truncate">{title}</p>
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent card click navigation
                setShowAIDropdown(!showAIDropdown);
              }}
              className="p-1 rounded hover:bg-gray-100 z-20" // z-20 to be above other elements
              data-tooltip-id={`ai-tooltip-kpi-${kpiTitleId}`}
              data-tooltip-content="Ask AI"
            >
              <BsStars />
            </button>
            {showAIDropdown && (
              <div
                ref={aiDropdownRef}
                className="absolute right-0 top-5 mt-2 w-full sm:w-44 bg-white rounded-md shadow-lg z-30 border border-gray-200 p-2" // z-30 to be on top
                onClick={(e) => e.stopPropagation()} // Prevent card click and closing dropdown
              >
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={localAIInput}
                    onChange={(e) => setLocalAIInput(e.target.value)}
                    placeholder="Ask AI..."
                    className="w-full p-1 border border-gray-300 rounded text-x"
                  />
                  <button
                    onClick={handleSendAIQuery}
                    className="p-1 bg-sky-500 text-white rounded hover:bg-sky-600"
                    disabled={!localAIInput.trim()}
                  >
                    <FiSend />
                  </button>
                </div>
              </div>
            )}
          </div>
          <p className="text-s font-bold text-sky-900 mt-1">
            {typeof value === "number" && title.toLowerCase().includes("deal size") && "$"}
            {typeof value === "number" ? value.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }) : value}
          </p>
          <div className={`flex items-center mt-2 ${isPositive ? "text-green-500" : "text-red-500"}`}>
            <span className="text-[10px] font-medium">{change} {isPositive ? "↑" : "↓"} vs last period</span>
          </div>
          {forecast && (
            <div className="mt-1">
              <p className="text-[10px] text-gray-500 italic">AI Forecast: {forecast}</p>
            </div>
          )}
        </div>
        <div className="p-2 rounded-full bg-sky-100 hover:bg-sky-200 transition-colors duration-200">
          <div className="text-sky-600 hover:text-sky-800 transition-colors duration-200">{icon}</div>
        </div>
      </div>
      <ReactTooltip id={`ai-tooltip-kpi-${kpiTitleId}`} place="top" effect="solid" />
    </motion.div>
  );
};


const PipelineConversion = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ /* Initial filters if any */ });
  const [showFilters, setShowFilters] = useState(false);
  
  // Initialize chartTypes from defaultType in chartsPipeline
  const initialChartTypes = Object.keys(chartsPipeline).reduce((acc, key) => {
    acc[key] = chartsPipeline[key].defaultType;
    return acc;
  }, {});
  const [chartTypes, setChartTypes] = useState(initialChartTypes);

  const [activeWidgets, setActiveWidgets] = useState(Object.keys(chartsPipeline)); // For drag & drop
  const [dropdownWidget, setDropdownWidget] = useState(null); // For BsThreeDotsVertical dropdown
  const [hoveredChartType, setHoveredChartType] = useState(null); // For "All Chart Types" submenu
  const [aiInputChart, setAiInputChart] = useState({}); // AI input for each chart
  const [showAIDropdownChart, setShowAIDropdownChart] = useState(null); // Which chart's AI dropdown is open

  const filtersRef = useOutsideClick(() => setShowFilters(false)); // If filters should close on outside click

  const toggleChartType = (widgetId, type) => {
    setChartTypes(prev => ({ ...prev, [widgetId]: type }));
    setDropdownWidget(null); // Close main dropdown
    setHoveredChartType(null); // Close submenu
  };

  const handleSendAIQueryChart = (widgetId) => {
    if (aiInputChart[widgetId]?.trim()) {
      console.log(`AI Query for ${chartsPipeline[widgetId].title}:`, aiInputChart[widgetId]);
      // Implement actual AI query logic here
      setAiInputChart(prev => ({ ...prev, [widgetId]: "" }));
      setShowAIDropdownChart(null); // Close AI dropdown
    }
  };

  const renderChart = (type, data, options = {}) => {
    const chartOptions = {
        ...options,
        responsive: true,
        maintainAspectRatio: false,
    };
    switch (type) {
      case "line": return <Line data={data} options={chartOptions} />;
      case "bar": return <Bar data={data} options={chartOptions} />;
      case "pie": return <Pie data={data} options={chartOptions} />;
      case "doughnut": return <Doughnut data={data} options={chartOptions} />;
      default: return <Line data={data} options={chartOptions} />;
    }
  };

  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;
    const items = Array.from(activeWidgets);
    const [reorderedItem] = items.splice(source.index, 1);
    items.splice(destination.index, 0, reorderedItem);
    setActiveWidgets(items);
  };

  // EnhancedChartCard Component (Adapted from SalesPerformanceDashboard.jsx)
  const EnhancedChartCard = ({ widgetId, index }) => {
    const chartInfo = chartsPipeline[widgetId];
    const chartType = chartTypes[widgetId];
    
    const threeDotsDropdownRef = useOutsideClick(() => setDropdownWidget(null));
    const aiDropdownRef = useOutsideClick(() => {
      // Only close if this specific AI dropdown is open
      if (showAIDropdownChart === widgetId) {
          setShowAIDropdownChart(null);
      }
    });


    return (
      <Draggable draggableId={widgetId} index={index}>
        {(provided) => (
          <div 
            className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border border-sky-100" 
            ref={provided.innerRef} 
            {...provided.draggableProps}
          >
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-md font-semibold text-sky-800">{chartInfo.title}</h3>
              <div className="flex space-x-1 relative">
                {/* Three Dots Menu */}
                <div className="relative">
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setDropdownWidget(dropdownWidget === widgetId ? null : widgetId); 
                    }} 
                    className="p-1 rounded hover:bg-gray-100"
                    data-tooltip-id={`chart-options-tooltip-${widgetId}`}
                    data-tooltip-content="Options"
                  >
                    <BsThreeDotsVertical />
                  </button>
                  {dropdownWidget === widgetId && (
                    <div 
                      ref={threeDotsDropdownRef} 
                      className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-20 border border-gray-200"
                    >
                      <div className="py-1 text-x text-gray-800">
                        <div 
                          className="relative" 
                          onMouseEnter={() => setHoveredChartType(widgetId)} 
                          onMouseLeave={() => setHoveredChartType(null)}
                        >
                          <div className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center">
                            All Chart Types <FiChevronDown className="ml-1 text-x" />
                          </div>
                          {hoveredChartType === widgetId && (
                            <div 
                              className="absolute top-0 left-full w-40 bg-white rounded-md shadow-lg border border-gray-200 z-30 py-1" 
                              style={{ marginLeft: "-1px" }} // Slight overlap to maintain hover
                            >
                              {["line", "bar", "pie", "doughnut"].map((type) => (
                                <button 
                                  key={type} 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    toggleChartType(widgetId, type);
                                  }} 
                                  className="block w-full text-left px-4 py-2 text-x text-gray-700 hover:bg-gray-100 transition"
                                >
                                  {type.charAt(0).toUpperCase() + type.slice(1)} Chart
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div 
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            navigate(chartInfo.componentPath); 
                            setDropdownWidget(null); 
                          }}
                        >
                          Analyze
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                 {/* AI Button */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAIDropdownChart(showAIDropdownChart === widgetId ? null : widgetId);
                  }} 
                  className="p-1 rounded hover:bg-gray-100"
                  data-tooltip-id={`ai-tooltip-chart-${widgetId}`}
                  data-tooltip-content="Ask AI"
                >
                  <BsStars />
                </button>
                {showAIDropdownChart === widgetId && (
                  <div 
                    ref={aiDropdownRef} // useOutsideClick for this specific dropdown
                    className="absolute right-0 top-full mt-2 w-full sm:w-64 bg-white rounded-md shadow-lg z-20 border border-gray-200 p-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-col items-center space-y-1">
                      <h1 className="text-x text-gray-700">Ask about {chartInfo.title}</h1>
                      <div className="flex justify-between gap-2 w-full">
                        <input 
                          type="text" 
                          value={aiInputChart[widgetId] || ""} 
                          onChange={(e) => setAiInputChart(prev => ({ ...prev, [widgetId]: e.target.value }))} 
                          placeholder="Your question..." 
                          className="w-full p-1 border border-gray-300 rounded text-x"
                          onClick={(e) => e.stopPropagation()} 
                        />
                        <button 
                          onClick={() => handleSendAIQueryChart(widgetId)} 
                          className="p-2 bg-sky-500 text-white rounded hover:bg-sky-600 text-x"
                          disabled={!aiInputChart[widgetId]?.trim()}
                        >
                          <FiSend />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {/* Drag Handle */}
                <div {...provided.dragHandleProps} className="p-1 rounded hover:bg-gray-100 cursor-move">
                  <RiDragMove2Fill />
                </div>
              </div>
            </div>
            <div className="h-64 md:h-72"> {/* Adjusted height */}
              {renderChart(chartType, chartInfo.data, chartInfo.options)}
            </div>
            <ReactTooltip id={`chart-options-tooltip-${widgetId}`} place="top" effect="solid" />
            <ReactTooltip id={`ai-tooltip-chart-${widgetId}`} place="top" effect="solid" />
          </div>
        )}
      </Draggable>
    );
  };


  return (
    <div className="space-y-6 p-4 min-h-screen relative bg-sky-50">
      {/* Breadcrumb Navigation */}
                    <nav className="flex mb-4" aria-label="Breadcrumb">
                      <ol className="inline-flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse">
                        <li className="inline-flex items-center">
                          <Link to="/" className="inline-flex items-center text-s font-medium text-gray-700 hover:text-blue-600">
                            <svg className="w-3 h-3 me-2.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                              <path d="m19.707 9.293-2-2-7-7a1 1 0 0 0-1.414 0l-7 7-2 2a1 1 0 0 0 1.414 1.414L2 10.414V18a2 2 0 0 0 2 2h3a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h3a2 2 0 0 0 2-2v-7.586l.293.293a1 1 0 0 0 1.414-1.414Z"/>
                            </svg>
                            Home
                          </Link>
                        </li>
                        <li>
                          <div className="flex items-center">
                            <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
                            <Link to="/sales-performance-dashboard" className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                              Sales Dashboard
                            </Link>
                          </div>
                        </li>
                        <li aria-current="page">
                          <div className="flex items-center">
                            <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
                            <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">CAC & CLV</span>
                          </div>
                        </li>
                      </ol>
                    </nav>
      {/* Header */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Pipeline & Conversion Analytics</h1>
            <p className="text-sky-100 text-x mt-1">Deep dive into your sales funnel performance.</p>
          </div>
          <div className="flex space-x-2">
            <button 
              type="button" 
              className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200" 
              onClick={() => setShowFilters(!showFilters)}
            >
              <FiFilter className="mr-1" /> Filters
            </button>
             <button
                onClick={() => window.print()}
                className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 hover:text-sky-50 transition-colors duration-200">
                <FiDownload className="text-sky-50" />
                <span className="text-sky-50">Export</span>
            </button>
            <Link
                to="/sales-performance-table" // Example, or to a more specific table view if exists
                >
                     <button
                         type="button"
                         className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200">
                          View More
                          <GrLinkNext className="ml-1 w-4 h-4 hover:w-5 hover:h-5 transition-all" />
                     </button>
             </Link>
          </div>
        </div>
      </div>

      {/* Filters Section (Optional, can be customized) */}
      {showFilters && (
        <div className="bg-white p-4 rounded-lg shadow-sm" ref={filtersRef}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Example Filters - customize as needed */}
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Time Period</label>
              <select className="w-full p-2 border border-gray-300 rounded-md text-s">
                <option>Last Quarter</option>
                <option>Last Month</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Sales Team</label>
              <select className="w-full p-2 border border-gray-300 rounded-md text-s">
                <option>All Teams</option>
                {/* Add team options */}
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Product Category</label>
              <select className="w-full p-2 border border-gray-300 rounded-md text-s">
                <option>All Categories</option>
                {/* Add product category options */}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(kpiDataPipeline).map(([key, kpi]) => (
          <KPICard
            key={key}
            title={key.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase())} // Format title
            value={kpi.value}
            change={kpi.change}
            isPositive={kpi.change?.startsWith("+")}
            icon={kpi.icon}
            componentPath={kpi.componentPath}
            forecast={kpi.forecast}
          />
        ))}
      </div>

      {/* Charts Section */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="pipelineCharts">
          {(provided) => (
            <div 
              className="grid grid-cols-1 lg:grid-cols-2 gap-6" 
              {...provided.droppableProps} 
              ref={provided.innerRef}
            >
              {activeWidgets.map((widgetId, index) => (
                <EnhancedChartCard
                  key={widgetId}
                  widgetId={widgetId}
                  index={index}
                />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      
      {/* Global Tooltips */}
      <ReactTooltip id="global-tooltip" place="top" effect="solid" />
    </div>
  );
};

export default PipelineConversion;
