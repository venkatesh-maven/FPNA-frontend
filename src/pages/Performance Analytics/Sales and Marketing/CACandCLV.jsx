

import React, { useState, useRef, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { Link, useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line, Doughnut, Pie } from "react-chartjs-2";
import { motion } from "framer-motion";
import { 
  FiTrendingUp, 
  FiTrendingDown,
  FiChevronRight, 
  FiFilter, 
  FiDollarSign,
  FiDownload,
  FiPieChart, // Kept for potential future use if needed
  FiUsers,    // Kept for potential future use if needed
  FiSend,
  FiChevronDown,
  FiRefreshCw
} from "react-icons/fi";
import { BsStars, BsThreeDotsVertical, BsCashCoin } from "react-icons/bs";
import { Tooltip as ReactTooltip } from "react-tooltip";
import { GrLinkNext } from "react-icons/gr";
import { RiDragMove2Fill } from "react-icons/ri";


ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

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


const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// --- Data structured for charts ---
const initialChartsData = {
  cacClvTrend: {
    title: "CAC & CLV Trend",
    componentPath: "/sales-performance-table",
    defaultType: "line",
    data: {
      labels: ["Q1", "Q2", "Q3", "Q4"],
      datasets: [
        {
          label: "CAC ($)",
          data: [450, 420, 390, 410],
          backgroundColor: "rgba(239, 68, 68, 0.2)", // Adjusted for line chart fill
          borderColor: "rgba(239, 68, 68, 1)",
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          yAxisID: 'y'
        },
        {
          label: "CLV ($)",
          data: [3200, 3500, 3800, 4100],
          backgroundColor: "rgba(16, 185, 129, 0.2)", // Adjusted for line chart fill
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: {
        y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'CAC ($)' } },
        y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'CLV ($)' }, grid: { drawOnChartArea: false } }
      }
    }
  },
  cacBreakdown: {
    title: "CAC by Acquisition Channel",
    componentPath: "/sales-performance-table",
    defaultType: "doughnut",
    data: {
      labels: ["Paid Ads", "Content Marketing", "Events", "SEO", "Referrals"],
      datasets: [{
        label: "CAC Contribution",
        data: [45, 25, 15, 10, 5], // Percentages
        backgroundColor: ["rgba(59, 130, 246, 0.7)", "rgba(234, 179, 8, 0.7)", "rgba(16, 185, 129, 0.7)", "rgba(139, 92, 246, 0.7)", "rgba(239, 68, 68, 0.7)"],
        borderColor: ["rgba(59, 130, 246, 1)", "rgba(234, 179, 8, 1)", "rgba(16, 185, 129, 1)", "rgba(139, 92, 246, 1)", "rgba(239, 68, 68, 1)"],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right' },
        tooltip: {
          callbacks: {
            label: function(context) {
              // Assuming total CAC is $410 for this example calculation
              const totalCACValue = 410; 
              const percentage = context.raw;
              const valueForChannel = (percentage / 100 * totalCACValue).toFixed(0);
              return `${context.label}: ${percentage}% ($${valueForChannel})`;
            }
          }
        }
      }
    }
  },
  segmentPerformance: {
    title: "CAC & CLV by Customer Segment",
    componentPath: "/sales-performance-table",
    defaultType: "bar",
    data: {
      labels: ["Enterprise", "SMB", "Startup", "Education"],
      datasets: [
        { label: "CAC ($)", data: [850, 350, 280, 420], backgroundColor: "rgba(239, 68, 68, 0.7)", borderColor: "rgba(239, 68, 68, 1)", borderWidth: 1 },
        { label: "CLV ($)", data: [12500, 4200, 3800, 3500], backgroundColor: "rgba(16, 185, 129, 0.7)", borderColor: "rgba(16, 185, 129, 1)", borderWidth: 1 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true, title: { display: true, text: 'Amount ($)' } } }
    }
  },
  ratioTrend: {
    title: "CAC:CLV Ratio Trend",
    componentPath: "/sales-performance-table",
    defaultType: "line",
    data: {
      labels: ["Q1", "Q2", "Q3", "Q4"],
      datasets: [{
        label: "CAC:CLV Ratio",
        data: [7.1, 8.3, 9.7, 10.0],
        backgroundColor: "rgba(139, 92, 246, 0.2)", // Adjusted for line chart fill
        borderColor: "rgba(139, 92, 246, 1)",
        borderWidth: 2,
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function(context) { return `Ratio: 1:${context.parsed.y.toFixed(1)}`; } } }
      },
      scales: { y: { beginAtZero: true, title: { display: true, text: 'CLV / CAC Ratio' } } }
    }
  }
};

const kpiData = [
  {
    id: "averageCAC",
    title: "Average CAC",
    value: "$410",
    change: "+5%",
    isPositive: false, // Higher CAC is generally negative
    icon: <FiTrendingDown />,
    description: "Cost to acquire a new customer",
    componentPath: "/sales-performance-table",
    forecast: "$420 predicted next period"
  },
  {
    id: "averageCLV",
    title: "Average CLV",
    value: "$4,100",
    change: "+8%",
    isPositive: true,
    icon: <FiTrendingUp />,
    description: "Lifetime value per customer",
    componentPath: "/sales-performance-table",
    forecast: "$4,300 predicted next period"
  },
  {
    id: "cacClvRatio",
    title: "CAC:CLV Ratio",
    value: "1:10",
    change: "+0.3", // Assuming this means ratio improved from 1:9.7 to 1:10
    isPositive: true,
    icon: <BsCashCoin />,
    description: "Ideal is 1:3 or better",
    componentPath: "/sales-performance-table",
    forecast: "1:10.5 predicted next period"
  },
  {
    id: "paybackPeriod",
    title: "Payback Period",
    value: "14 months", // Changed to string to include "months"
    change: "-2 months", // Shorter payback is positive
    isPositive: true,
    icon: <FiRefreshCw />,
    description: "Months to recover CAC",
    componentPath: "/sales-performance-table",
    forecast: "13 months predicted"
  }
];

// --- START KPICard Component ---
const KPICard = ({ id, title, value, change, isPositive, icon, description, componentPath, forecast }) => {
  const navigate = useNavigate();
  const [showAIDropdownKpi, setShowAIDropdownKpi] = useState(false);
  const [localAIInputKpi, setLocalAIInputKpi] = useState("");
  const kpiAiDropdownRef = useOutsideClick(() => setShowAIDropdownKpi(false));

  const handleSendAIQueryKpi = (e) => {
    e.stopPropagation();
    if (localAIInputKpi.trim()) {
      console.log(`AI Query for ${title}:`, localAIInputKpi);
      setLocalAIInputKpi("");
      setShowAIDropdownKpi(false);
    }
  };

  return (
    <motion.div
      key={id}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -3 }}
      className="bg-white p-4 rounded-lg shadow-sm border border-sky-100 cursor-pointer"
      onClick={() => navigate(componentPath)}
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center justify-between relative">
            <p className="text-x font-semibold text-sky-600 uppercase tracking-wider truncate">{title}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAIDropdownKpi(!showAIDropdownKpi);
              }}
              className="p-1 rounded hover:bg-gray-100 z-20"
              data-tooltip-id={`ai-tooltip-kpi-${id}`}
              data-tooltip-content="Ask AI"
            >
              <BsStars />
            </button>
            {showAIDropdownKpi && (
              <div
                ref={kpiAiDropdownRef}
                className="absolute right-0 top-5 mt-2 w-full sm:w-44 bg-white rounded-md shadow-lg z-30 border border-gray-200 p-2"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={localAIInputKpi}
                    onChange={(e) => setLocalAIInputKpi(e.target.value)}
                    placeholder="Ask AI..."
                    className="w-full p-1 border border-gray-300 rounded text-x"
                  />
                  <button
                    onClick={handleSendAIQueryKpi}
                    className="p-1 bg-sky-500 text-white rounded hover:bg-sky-600"
                    disabled={!localAIInputKpi.trim()}
                  >
                    <FiSend />
                  </button>
                </div>
              </div>
            )}
          </div>
          <p className="text-lg font-bold text-sky-900 mt-1">{value}</p>
          <div className={`flex items-center mt-2 ${isPositive ? "text-green-500" : "text-red-500"}`}>
            <span className="text-x font-medium">{change} {isPositive ? "↑" : "↓"} vs last period</span>
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
      <p className="text-x text-gray-500 mt-2">{description}</p>
      <ReactTooltip id={`ai-tooltip-kpi-${id}`} place="top" effect="solid" />
    </motion.div>
  );
};
// --- END KPICard Component ---


const CACandCLV = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    timePeriod: "Last Quarter",
    segment: "All Segments",
    channel: "All Channels"
  });
  const [showFilters, setShowFilters] = useState(false);
  
  const initialChartTypesState = Object.keys(initialChartsData).reduce((acc, key) => {
    acc[key] = initialChartsData[key].defaultType;
    return acc;
  }, {});
  const [chartTypes, setChartTypes] = useState(initialChartTypesState);
  
  const [activeWidgets, setActiveWidgets] = useState(Object.keys(initialChartsData));
  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const [aiInputChart, setAiInputChart] = useState({});
  const [showAIDropdownChart, setShowAIDropdownChart] = useState(null);

  // Global AI state (for the top bar AI)
  const [globalAiInput, setGlobalAiInput] = useState("");
  const [showGlobalAIDropdown, setShowGlobalAIDropdown] = useState(false);
  
  const filtersRef = useOutsideClick(() => setShowFilters(false));
  const globalAiDropdownRef = useOutsideClick(() => setShowGlobalAIDropdown(false));


  const toggleChartType = (widgetId, type) => {
    setChartTypes(prev => ({ ...prev, [widgetId]: type }));
    setDropdownWidget(null);
    setHoveredChartType(null);
  };

  const handleSendAIQueryChart = (widgetId) => {
    if (aiInputChart[widgetId]?.trim()) {
      console.log(`AI Query for ${initialChartsData[widgetId].title}:`, aiInputChart[widgetId]);
      setAiInputChart(prev => ({ ...prev, [widgetId]: "" }));
      setShowAIDropdownChart(null);
    }
  };
  
  const handleSendGlobalAIQuery = () => {
    if (globalAiInput.trim()) {
      console.log("Global AI Query:", globalAiInput);
      setGlobalAiInput("");
      setShowGlobalAIDropdown(false);
    }
  };

  const renderChart = (type, data, options = {}) => {
    const chartOptions = { ...options, responsive: true, maintainAspectRatio: false };
    switch (type) {
      case "line": return <Line data={data} options={chartOptions} />;
      case "bar": return <Bar data={data} options={chartOptions} />;
      case "doughnut": return <Doughnut data={data} options={chartOptions} />;
      case "pie": return <Pie data={data} options={chartOptions} />;
      default: return <Bar data={data} options={chartOptions} />; // Default to Bar
    }
  };
  
  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(activeWidgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setActiveWidgets(items);
  };

  // --- START EnhancedChartCard Component ---
  const EnhancedChartCard = ({ widgetId, index }) => {
    const chartInfo = initialChartsData[widgetId];
    const currentChartType = chartTypes[widgetId];
    
    const chartDropdownRef = useOutsideClick(() => setDropdownWidget(null));
    const chartAiDropdownRef = useOutsideClick(() => {
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
                <div className="relative">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setDropdownWidget(dropdownWidget === widgetId ? null : widgetId); }} 
                    className="p-1 rounded hover:bg-gray-100"
                    data-tooltip-id={`chart-options-${widgetId}`}
                    data-tooltip-content="Options"
                  >
                    <BsThreeDotsVertical />
                  </button>
                  {dropdownWidget === widgetId && (
                    <div ref={chartDropdownRef} className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-20 border border-gray-200">
                      <div className="py-1 text-x text-gray-800">
                        <div className="relative" onMouseEnter={() => setHoveredChartType(widgetId)} onMouseLeave={() => setHoveredChartType(null)}>
                          <div className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center">
                            All Chart Types <FiChevronDown className="ml-1 text-x" />
                          </div>
                          {hoveredChartType === widgetId && (
                            <div className="absolute top-0 left-full w-40 bg-white rounded-md shadow-lg border border-gray-200 z-30 py-1" style={{ marginLeft: "-1px" }}>
                              {["line", "bar", "pie", "doughnut"].map((type) => (
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
                <button onClick={(e) => { e.stopPropagation(); setShowAIDropdownChart(showAIDropdownChart === widgetId ? null : widgetId); }} className="p-1 rounded hover:bg-gray-100" data-tooltip-id={`chart-ai-${widgetId}`} data-tooltip-content="Ask AI">
                  <BsStars />
                </button>
                {showAIDropdownChart === widgetId && (
                  <div ref={chartAiDropdownRef} className="absolute right-0 top-full mt-2 w-full sm:w-64 bg-white rounded-md shadow-lg z-20 border border-gray-200 p-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-col items-center space-y-1">
                      <h1 className="text-x text-gray-700">Ask about {chartInfo.title}</h1>
                      <div className="flex justify-between gap-2 w-full">
                        <input type="text" value={aiInputChart[widgetId] || ""} onChange={(e) => setAiInputChart(prev => ({ ...prev, [widgetId]: e.target.value }))} placeholder="Your question..." className="w-full p-1 border border-gray-300 rounded text-x" onClick={(e) => e.stopPropagation()} />
                        <button onClick={() => handleSendAIQueryChart(widgetId)} className="p-2 bg-sky-500 text-white rounded hover:bg-sky-600 text-x" disabled={!aiInputChart[widgetId]?.trim()}>
                          <FiSend />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <div {...provided.dragHandleProps} className="p-1 rounded hover:bg-gray-100 cursor-move" data-tooltip-id={`chart-drag-${widgetId}`} data-tooltip-content="Rearrange">
                  <RiDragMove2Fill />
                </div>
              </div>
            </div>
            <div className="h-64 md:h-72">
              {renderChart(currentChartType, chartInfo.data, chartInfo.options)}
            </div>
            <ReactTooltip id={`chart-options-${widgetId}`} place="top" effect="solid" />
            <ReactTooltip id={`chart-ai-${widgetId}`} place="top" effect="solid" />
            <ReactTooltip id={`chart-drag-${widgetId}`} place="top" effect="solid" />
          </div>
        )}
      </Draggable>
    );
  };
  // --- END EnhancedChartCard Component ---

  // Data for tables (unchanged from original, just moved for clarity)
  const campaignData = [ { campaign: "Q3 Webinar Series", spend: "$45,000", leads: 420, customers: 38, cac: "$1,184", clv: "$4,200", ratio: "1:3.5", channel: "Events" }, { campaign: "Google Ads - Brand", spend: "$85,000", leads: 1250, customers: 92, cac: "$924", clv: "$3,800", ratio: "1:4.1", channel: "Paid Ads" }, { campaign: "LinkedIn Content", spend: "$32,000", leads: 680, customers: 45, cac: "$711", clv: "$4,500", ratio: "1:6.3", channel: "Content" }, { campaign: "SEO Organic", spend: "$28,000", leads: 950, customers: 65, cac: "$431", clv: "$5,200", ratio: "1:12.1", channel: "SEO" }, { campaign: "Referral Program", spend: "$15,000", leads: 320, customers: 42, cac: "$357", clv: "$6,800", ratio: "1:19.0", channel: "Referrals" } ];
  const segmentData = [ { segment: "Enterprise", cac: "$850", clv: "$12,500", ratio: "1:14.7", retention: "36 months", profitMargin: "42%" }, { segment: "SMB", cac: "$350", clv: "$4,200", ratio: "1:12.0", retention: "24 months", profitMargin: "38%" }, { segment: "Startup", cac: "$280", clv: "$3,800", ratio: "1:13.6", retention: "18 months", profitMargin: "35%" }, { segment: "Education", cac: "$420", clv: "$3,500", ratio: "1:8.3", retention: "12 months", profitMargin: "30%" } ];

  return (
    <div className="space-y-6 p-4 min-h-screen bg-sky-50">
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
            <h1 className="text-lg font-bold text-white">Customer Acquisition Cost (CAC) & Lifetime Value (CLV)</h1>
            <p className="text-sky-100 text-x">Profitability by customer segment</p>
            <p className="text-sky-100 text-x mt-1">Data showing from 06/01/24 - 07/31/24</p>
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
              type="button" 
              className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200"
              onClick={() => setShowGlobalAIDropdown(!showGlobalAIDropdown)}
            >
              <BsStars className="mr-1" /> Ask AI
            </button>
            <button
                onClick={() => window.print()}
                className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 hover:text-sky-50 transition-colors duration-200">
                <FiDownload className="text-sky-50" />
                <span className="text-sky-50">Export</span>
            </button>
            <Link to="/sales-performance-table">
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

      {/* Global AI Dropdown */}
      {showGlobalAIDropdown && (
        <div ref={globalAiDropdownRef} className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
          <h3 className="text-s font-semibold text-sky-800 mb-2">AI Assistant for CAC/CLV Analysis</h3>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={globalAiInput}
              onChange={(e) => setGlobalAiInput(e.target.value)}
              placeholder="Ask about CAC trends, CLV predictions, or channel efficiency..."
              className="w-full p-2 border border-gray-300 rounded-md text-s"
            />
            <button
              onClick={handleSendGlobalAIQuery}
              className="p-2 bg-sky-500 text-white rounded hover:bg-sky-600"
              disabled={!globalAiInput.trim()}
            >
              <FiSend />
            </button>
          </div>
          <div className="mt-2 text-x text-gray-500">
            <p>Try asking:</p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>"Which channel gives the lowest CAC?"</li>
              <li>"Forecast CAC next quarter for SMB vs Enterprise"</li>
              <li>"What's the optimal marketing spend to maintain 1:10 ratio?"</li>
            </ul>
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="bg-white p-4 rounded-lg shadow-sm" ref={filtersRef}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Filter options remain the same */}
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Time Period</label>
              <select className="w-full p-2 border border-gray-300 rounded-md text-s" value={filters.timePeriod} onChange={(e) => setFilters({...filters, timePeriod: e.target.value})}>
                <option>Last Quarter</option><option>Last Month</option><option>Last Week</option><option>Year to Date</option><option>Custom Range</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Customer Segment</label>
              <select className="w-full p-2 border border-gray-300 rounded-md text-s" value={filters.segment} onChange={(e) => setFilters({...filters, segment: e.target.value})}>
                <option>All Segments</option><option>Enterprise</option><option>SMB</option><option>Startup</option><option>Education</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Acquisition Channel</label>
              <select className="w-full p-2 border border-gray-300 rounded-md text-s" value={filters.channel} onChange={(e) => setFilters({...filters, channel: e.target.value})}>
                <option>All Channels</option><option>Paid Ads</option><option>Content Marketing</option><option>Events</option><option>SEO</option><option>Referrals</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map((kpi) => (
          <KPICard
            key={kpi.id}
            id={kpi.id}
            title={kpi.title}
            value={kpi.value}
            change={kpi.change}
            isPositive={kpi.isPositive}
            icon={kpi.icon}
            description={kpi.description}
            componentPath={kpi.componentPath}
            forecast={kpi.forecast}
          />
        ))}
      </div>

      {/* Charts Section with Drag and Drop */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="cacClvCharts">
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
      

      {/* Campaign Performance Table */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">Campaign Performance</h3>
            <Link to="/sales-performance-table" className="text-x text-sky-600 hover:text-sky-800 font-medium">View Details <FiChevronRight className="inline-block"/></Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-s text-left text-gray-700">
            <thead className="text-x text-sky-700 uppercase bg-sky-50">
              <tr>
                <th className="px-4 py-2">Campaign</th> <th className="px-4 py-2">Channel</th> <th className="px-4 py-2">Spend</th> <th className="px-4 py-2">Leads</th> <th className="px-4 py-2">Customers</th> <th className="px-4 py-2">CAC</th> <th className="px-4 py-2">CLV</th> <th className="px-4 py-2">Ratio</th>
              </tr>
            </thead>
            <tbody>
              {campaignData.map((row, i) => (
                <tr key={i} className="border-b hover:bg-sky-50 cursor-pointer" onClick={() => navigate("/sales-performance-table")}>
                  <td className="px-4 py-2 font-medium">{row.campaign}</td> <td className="px-4 py-2">{row.channel}</td> <td className="px-4 py-2">{row.spend}</td> <td className="px-4 py-2">{row.leads}</td> <td className="px-4 py-2">{row.customers}</td> <td className="px-4 py-2">{row.cac}</td> <td className="px-4 py-2">{row.clv}</td>
                  <td className={`px-4 py-2 font-medium ${parseFloat(row.ratio.split(':')[1]) > 5 ? 'text-green-500' : parseFloat(row.ratio.split(':')[1]) >= 3 ? 'text-amber-500' : 'text-red-500'}`}>
                    {row.ratio}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Segment Profitability Table */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">Segment Profitability</h3>
          <Link to="/sales-performance-table" className="text-x text-sky-600 hover:text-sky-800 font-medium">View Details <FiChevronRight className="inline-block"/></Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-s text-left text-gray-700">
            <thead className="text-x text-sky-700 uppercase bg-sky-50">
              <tr>
                <th className="px-4 py-2">Segment</th> <th className="px-4 py-2">CAC</th> <th className="px-4 py-2">CLV</th> <th className="px-4 py-2">Ratio</th> <th className="px-4 py-2">Retention</th> <th className="px-4 py-2">Profit Margin</th>
              </tr>
            </thead>
            <tbody>
              {segmentData.map((row, i) => (
                <tr key={i} className="border-b hover:bg-sky-50 cursor-pointer" onClick={() => navigate("/sales-performance-table")}>
                  <td className="px-4 py-2 font-medium">{row.segment}</td> <td className="px-4 py-2">{row.cac}</td> <td className="px-4 py-2">{row.clv}</td>
                  <td className={`px-4 py-2 font-medium ${parseFloat(row.ratio.split(':')[1]) > 5 ? 'text-green-500' : parseFloat(row.ratio.split(':')[1]) >= 3 ? 'text-amber-500' : 'text-red-500'}`}>
                    {row.ratio}
                  </td>
                  <td className="px-4 py-2">{row.retention}</td> <td className="px-4 py-2">{row.profitMargin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Recommendations Section */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">AI Recommendations</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Recommendation cards remain the same */}
          <div className="bg-sky-50 p-3 rounded-lg"> <h4 className="text-s font-medium text-sky-800 mb-2">Most Efficient Channel</h4> <p className="text-x text-gray-700">Referral program has the lowest CAC at $357 and highest ratio at 1:19. Consider increasing referral incentives by 20% to scale this channel.</p> </div>
          <div className="bg-sky-50 p-3 rounded-lg"> <h4 className="text-s font-medium text-sky-800 mb-2">Segment Opportunity</h4> <p className="text-x text-gray-700">Education segment has the lowest ratio (1:8.3). Recommend reducing CAC through targeted content marketing rather than paid ads.</p> </div>
          <div className="bg-sky-50 p-3 rounded-lg"> <h4 className="text-s font-medium text-sky-800 mb-2">Budget Optimization</h4> <p className="text-x text-gray-700">Reallocating 15% of paid ads budget to SEO could improve overall CAC by ~8% based on current performance metrics.</p> </div>
        </div>
      </div>
      <ReactTooltip id="global-tooltip" place="top" effect="solid" /> {/* General tooltip, can be removed if specific ones cover all needs */}
    </div>
  );
};

export default CACandCLV;
