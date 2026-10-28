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
import { FiTrendingUp, FiDownload, FiTrendingDown, FiDollarSign, FiPieChart, FiFilter, FiPlus, FiChevronDown, FiSend, FiUser, FiMap, FiLayers, FiRefreshCw, FiUsers} from "react-icons/fi";
import { BsStars, BsThreeDotsVertical, BsCashCoin} from "react-icons/bs";
import { Tooltip as ReactTooltip } from "react-tooltip";
import { RiDragMove2Fill } from "react-icons/ri";
import { GrLinkNext } from "react-icons/gr";
import { getDecimalPrecision } from '../../../utils/formatters';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

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

const kpiData = {
  totalRevenue: { value: 2546000, change: "-25%", componentPath: "/sales-performance-table", forecast: "$2.8M predicted next quarter" },
  revenuePerSegment: { value: 152000, change: "+8%", componentPath: "/sales-performance-table", forecast: "$165K predicted next quarter" },
  salesTeamCost: { value: 485000, change: "+12%", componentPath: "/sales-performance-table", forecast: "$520K predicted next quarter" },
  roi: { value: 5.2, change: "-0.8", componentPath: "/sales-performance-table", forecast: "5.5 predicted next quarter" },
  // leads: { value: 12500, change: "+15%", componentPath: "/sales-performance-dashboard", forecast: "13,500 predicted next quarter" },
  // opportunities: { value: 4890, change: "+10%", componentPath: "/sales-performance-dashboard", forecast: "5,200 predicted next quarter" },
  // wins: { value: 628, change: "+5%", componentPath: "/sales-performance-dashboard", forecast: "700 predicted next quarter" },
};


// Navigation items
  const navItems = [
    { name: "Sales Dashboard", icon: <FiDollarSign />, path: "/sales-performance-dashboard" },
    { name: "Pipeline & Conversion", icon: <FiTrendingUp />, path: "/pipeline-conversion" },
    { name: "CAC & CLV", icon: <BsCashCoin />, path: "/cac-clv" },
    { name: "Churn & Retention", icon: <FiRefreshCw />, path: "/churn-retention" },
    { name: "Marketing Campaigns", icon: <FiUsers />, path: "/marketing-campaign" },
    { name: "Revenue Breakdown", icon: <FiPieChart />, path: "/revenue-breakdown" }
  ];


const charts = {
  revenueTrend: {
    title: "Oppty, Wins & Revenue by Week",
    componentPath: "/sales-performance-table",
    data: {
      labels: ["Jun 1", "Jun 8", "Jun 15", "Jun 22", "Jun 29", "Jul 6", "Jul 13", "Jul 20", "Jul 27", "Aug 3", "Aug 10", "Aug 17", "Aug 24", "Aug 31"],
      datasets: [
        { label: "Opportunities", data: [320, 310, 290, 330, 340, 350, 360, 370, 380, 390, 400, 410, 420, 430], backgroundColor: "rgba(229, 233, 14, 0.2)", borderColor: "rgb(233, 182, 14)", borderWidth: 2, tension: 0.4 },
        { label: "Wins", data: [40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105], backgroundColor: "rgba(16, 185, 129, 0.2)", borderColor: "rgba(16, 185, 129, 1)", borderWidth: 2, tension: 0.4 },
        { label: "Revenue (K)", data: [150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250, 260, 270, 280], backgroundColor: "rgba(139, 92, 246, 0.2)", borderColor: "rgba(139, 92, 246, 1)", borderWidth: 2, tension: 0.4 }
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: {
        y: { 
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Count'
          }
        },
        y1: { 
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Revenue (K)'
          },
          grid: { drawOnChartArea: false }
        },
      },
    },
    defaultType: "line",
  },
  leadSource: {
    title: "Oppty & Avg Revenue by Lead Source",
    componentPath: "/sales-performance-table",
    data: {
      labels: ["Web", "Social Media", "Phone", "Others", "Email", "PPC", "Event"],
      datasets: [
        { label: "Opportunities", data: [1213, 1136, 948, 635, 508, 306, 153], backgroundColor: "rgba(59, 130, 246, 0.7)", borderColor: "rgba(59, 130, 246, 1)", borderWidth: 1, yAxisID: 'y' },
        { label: "Avg Revenue (K)", data: [152.8, 119.3, 227.4, 201.4, 137.6, 94.8, 84.2], backgroundColor: "rgba(234, 179, 8, 0.7)", borderColor: "rgba(234, 179, 8, 1)", borderWidth: 1, yAxisID: 'y1' }
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: {
        y: { type: 'linear', display: true, position: 'left' },
        y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false } },
      },
    },
    defaultType: "bar",
  },
  revenueByProduct: {
    title: "Revenue by Product",
    componentPath: "/sales-performance-table",
    data: {
      labels: ["Data Science", "Computer Science", "Arts", "Business"],
      datasets: [{
        label: "Revenue",
        data: [64.89, 18.86, 8.19, 8.07],
        backgroundColor: ["rgba(16, 185, 129, 0.7)", "rgba(59, 130, 246, 0.7)", "rgba(234, 179, 8, 0.7)", "rgba(239, 68, 68, 0.7)"],
        borderColor: ["rgba(16, 185, 129, 1)", "rgba(59, 130, 246, 1)", "rgba(234, 179, 8, 1)", "rgba(239, 68, 68, 1)"],
        borderWidth: 1,
      }],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { 
        legend: { position: "bottom" },
        tooltip: { callbacks: { label: function(context) { return `${context.label}: ${context.raw}% ($${(context.raw / 100 * 2545729).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })})`; } } }
      },
    },
    defaultType: "doughnut",
  },
  revenueByRegion: {
    title: "Revenue by Region",
    componentPath: "/sales-performance-table",
    data: {
      labels: ["North America", "Europe", "Asia", "South America", "Africa"],
      datasets: [{
        label: "Revenue (K)",
        data: [1500, 600, 300, 100, 46],
        backgroundColor: ["rgba(59, 130, 246, 0.7)", "rgba(16, 185, 129, 0.7)", "rgba(234, 179, 8, 0.7)", "rgba(139, 92, 246, 0.7)", "rgba(239, 68, 68, 0.7)"],
        borderColor: ["rgba(59, 130, 246, 1)", "rgba(16, 185, 129, 1)", "rgba(234, 179, 8, 1)", "rgba(139, 92, 246, 1)", "rgba(239, 68, 68, 1)"],
        borderWidth: 1,
      }],
    },
    options: { maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
    defaultType: "bar",
  },
  customersByStage: {
    title: "Number of Customers by Stage",
    componentPath: "/sales-performance-table",
    data: {
      labels: ["Prospect", "Qualify", "Presentation/Demo", "Proposal", "Negotiation", "Close"],
      datasets: [{
        label: "Customers",
        data: [5000, 4000, 3000, 2000, 1000, 628],
        backgroundColor: ["rgba(59, 130, 246, 0.7)", "rgba(16, 185, 129, 0.7)", "rgba(234, 179, 8, 0.7)", "rgba(139, 92, 246, 0.7)", "rgba(239, 68, 68, 0.7)", "rgba(14, 165, 233, 0.7)"],
        borderColor: ["rgba(59, 130, 246, 1)", "rgba(16, 185, 129, 1)", "rgba(234, 179, 8, 1)", "rgba(139, 92, 246, 1)", "rgba(239, 68, 68, 1)", "rgba(14, 165, 233, 1)"],
        borderWidth: 1,
      }],
    },
    options: { maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
    defaultType: "bar",
  },
  revenueBySalesPerson: {
    title: "Revenue by Sales Manager",
    componentPath: "/sales-performance-table",
    data: {
      labels: ["Andree Repp", "Salla Yes", "Shannah Biden", "Hanny Giraudoux", "Thali Bour"],
      datasets: [{
        label: "Revenue (K)",
        data: [227.4, 201.4, 119.3, 152.8, 94.8],
        backgroundColor: "rgba(14, 165, 233, 0.7)",
        borderColor: "rgba(14, 165, 233, 1)",
        borderWidth: 1,
      }],
    },
    options: { maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
    defaultType: "bar",
  },
  salesTeamCost: {
    title: "Sales Team Cost Analysis",
    componentPath: "/sales-performance-table",
    data: {
      labels: ["Salaries", "Commissions", "Training", "Travel", "Tools"],
      datasets: [{
        label: "Cost (K)",
        data: [300, 120, 35, 20, 10],
        backgroundColor: ["rgba(239, 68, 68, 0.7)", "rgba(234, 179, 8, 0.7)", "rgba(59, 130, 246, 0.7)", "rgba(16, 185, 129, 0.7)", "rgba(139, 92, 246, 0.7)"],
        borderColor: ["rgba(239, 68, 68, 1)", "rgba(234, 179, 8, 1)", "rgba(59, 130, 246, 1)", "rgba(16, 185, 129, 1)", "rgba(139, 92, 246, 1)"],
        borderWidth: 1,
      }],
    },
    options: { maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
    defaultType: "pie",
  },
  funnelMetrics: {
    title: "Leads to Wins ",
    componentPath: "/sales-performance-table",
    data: {
      labels: ["Leads", "Opportunities", "Wins"],
      datasets: [{
        label: "Count",
        data: [12500, 4890, 628],
        backgroundColor: ["rgba(59, 130, 246, 0.7)", "rgba(234, 179, 8, 0.7)", "rgba(16, 185, 129, 0.7)"],
        borderColor: ["rgba(59, 130, 246, 1)", "rgba(234, 179, 8, 1)", "rgba(16, 185, 129, 1)"],
        borderWidth: 1,
      }],
    },
    options: { maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
    defaultType: "bar",
  },
};


const SalesPerformanceDashboard = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    timePeriod: "Last Quarter",
    region: "All Regions",
    product: "All Products",
    segment: "All Segments",
    team: "All Teams"
  });
  const [filteredData, setFilteredData] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [activeWidgets, setActiveWidgets] = useState(["revenueTrend", "revenueByProduct", "revenueByRegion", "customersByStage", "revenueBySalesPerson", "salesTeamCost"]);
  const [chartTypes, setChartTypes] = useState({
    revenueTrend: "line", revenueByProduct: "doughnut", revenueByRegion: "bar", customersByStage: "bar", revenueBySalesPerson: "bar", salesTeamCost: "pie", funnelMetrics: "bar"
  });
  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const [aiInput, setaiInput] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const [showChartTypeDropdown, setShowChartTypeDropdown] = useState({});
  const filtersRef = useRef(null);
  const aiChatbotRef = useRef(null);

  const toggleChartType = (widgetId, type) => {
    setChartTypes(prev => ({ ...prev, [widgetId]: type }));
  };

  const handleSendAIQuery = (widgetId) => {
    if (aiInput[widgetId]?.trim()) {
      console.log(`AI Query for ${widgetId}:`, aiInput[widgetId]);
      setaiInput(prev => ({ ...prev, [widgetId]: "" }));
      setShowAIDropdown(null);
    }
  };

  const renderChart = (type, data, options = {}) => {
    switch (type) {
      case "line": return <Line data={data} options={options} />;
      case "bar": return <Bar data={data} options={options} />;
      case "pie": return <Pie data={data} options={options} />;
      case "doughnut": return <Doughnut data={data} options={options} />;
      default: return <Line data={data} options={options} />;
    }
  };

  const EnhancedChartCard = ({ title, componentPath, chartType, chartData, widgetId, index }) => {
    const dropdownRef = useOutsideClick(() => setDropdownWidget(null));
    return (
      <Draggable draggableId={widgetId} index={index}>
        {(provided) => (
          <div className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border border-sky-100" ref={provided.innerRef} {...provided.draggableProps}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-md font-semibold text-sky-800">{title}</h3>
              <div className="flex space-x-2 relative">
                <div className="relative chart-dropdown">
                  <button onClick={(e) => { e.stopPropagation(); setDropdownWidget(dropdownWidget === widgetId ? null : widgetId); }} className="p-1 rounded hover:bg-gray-100" data-tooltip-id="chart-type-tooltip" data-tooltip-content="Options">
                    <BsThreeDotsVertical />
                  </button>
                  {dropdownWidget === widgetId && (
                    <div ref={dropdownRef} className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                      <div className="py-1 text-x text-gray-800">
                        <div className="relative" onMouseEnter={() => setHoveredChartType(widgetId)} onMouseLeave={() => setHoveredChartType(null)}>
                          <div className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center">
                            All Chart Types <FiChevronDown className="ml-1 text-x" />
                          </div>
                          {hoveredChartType === widgetId && (
                            <div className="absolute top-0 left-full w-40 bg-white rounded-md shadow-lg border border-gray-200 z-20 py-1" style={{ marginLeft: "-1px" }}>
                              {["line", "bar", "pie", "doughnut"].map((type) => (
                                <button key={type} onClick={(e) => { e.stopPropagation(); toggleChartType(widgetId, type); setDropdownWidget(null); setHoveredChartType(null); }} className="block w-full text-left px-4 py-2 text-x text-gray-700 hover:bg-gray-100 transition">
                                  {type.charAt(0).toUpperCase() + type.slice(1)} Chart
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="px-4 py-2 hover:bg-gray-100 cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(componentPath); setDropdownWidget(null); setHoveredChartType(null); }}>
                          Analyze
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={() => setShowAIDropdown(showAIDropdown === widgetId ? null : widgetId)} className="p-1 rounded hover:bg-gray-100" data-tooltip-id="ai-tooltip" data-tooltip-content="Ask AI">
                  <BsStars />
                </button>
                {showAIDropdown === widgetId && (
                  <div ref={aiChatbotRef} className="absolute right-0 top-5 mt-2 w-full sm:w-64 bg-white rounded-md shadow-lg z-10 border border-gray-200 py-2">
                    <div className="flex flex-col items-center space-x-2">
                      <h1 className="text-x">Ask regarding the {title}</h1>
                      <div className="flex justify-between gap-3">
                        <input type="text" value={aiInput[widgetId] || ""} onChange={(e) => setaiInput(prev => ({ ...prev, [widgetId]: e.target.value }))} placeholder="Ask AI..." className="w-full p-1 border border-gray-300 rounded text-x" />
                        <button onClick={() => handleSendAIQuery(widgetId)} className="p-2 bg-sky-500 text-white rounded hover:bg-sky-600" disabled={!aiInput[widgetId]?.trim()}>
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
            <div className="h-48">
              {renderChart(chartType, chartData.data, chartData.options)}
            </div>
          </div>
        )}
      </Draggable>
    );
  };

  const KPICard = ({ title, value, change, isPositive, icon, componentPath, forecast }) => {
    const [showAIDropdown, setShowAIDropdown] = useState(false);
    const [localAIInput, setLocalAIInput] = useState("");
    const dropdownRef = useRef(null);
    useEffect(() => {
      const handleClickOutside = (event) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
          setShowAIDropdown(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSendAIQuery = () => {
      if (localAIInput.trim()) {
        console.log(`AI Query for ${title}:`, localAIInput);
        setLocalAIInput("");
        setShowAIDropdown(false);
      }
    };

    const needsDollarSign = ["totalRevenue", "revenuePerSegment", "salesTeamCost"].includes(title.replace(/ /g, ""));
    return (
      <motion.div variants={cardVariants} initial="hidden" animate="visible" whileHover={{ y: -3 }} className="bg-white p-3 rounded-lg shadow-sm border border-sky-100 relative" onClick={() => navigate(componentPath)}>
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center justify-between relative ">
              <p className="text-[10px] font-semibold text-sky-600 uppercase tracking-wider truncate">{title}</p>
              <button onClick={(e) => { e.stopPropagation(); setShowAIDropdown(!showAIDropdown); }} className="p-1 rounded hover:bg-gray-100" data-tooltip-id="ai-tooltip" data-tooltip-content="Ask AI">
                <BsStars />
              </button>
              {showAIDropdown && (
                <div ref={dropdownRef} className="absolute right-0 top-5 mt-2 w-full sm:w-44 bg-white rounded-md shadow-lg z-10 border border-gray-200 p-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center space-x-2">
                    <input type="text" value={localAIInput} onChange={(e) => setLocalAIInput(e.target.value)} placeholder="Ask AI..." className="w-full p-1 border border-gray-300 rounded text-x" onClick={(e) => e.stopPropagation()} />
                    <button onClick={handleSendAIQuery} className="p-1 bg-sky-500 text-white rounded hover:bg-sky-600" disabled={!localAIInput.trim()}>
                      <FiSend />
                    </button>
                  </div>
                </div>
              )}
            </div>
            <p className="text-s font-bold text-sky-900 mt-1">
              {needsDollarSign && "$"}
              {typeof value === "number" ? title === "roi" ? value.toFixed(getDecimalPrecision()) : value.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }) : value}
              {title === "roi" && "x"}
            </p>
            <div className={`flex items-center mt-2 ${isPositive ? "text-green-500" : "text-red-500"}`}>
              <span className="text-[10px] font-medium">{change} {isPositive ? "↑" : "↓"} vs last period</span>
            </div>
            <div className="mt-1">
              <p className="text-[10px] text-gray-500 italic">AI Forecast: {forecast}</p>
            </div>
          </div>
          <div className="p-2 rounded-full bg-sky-100 hover:bg-sky-200 transition-colors duration-200">
            <div className="text-sky-600 hover:text-sky-800 transition-colors duration-200">{icon}</div>
          </div>
        </div>
        <ReactTooltip id="ai-tooltip" place="top" effect="solid" />
      </motion.div>
    );
  };


  const RevenueTargetTable = () => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
      <h3 className="text-s font-semibold text-sky-800 mb-2">Revenue vs Target (with AI Forecast)</h3>
      <table className="w-full text-x text-gray-700">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left">Sales Manager</th>
            <th className="p-2 text-left">Revenue</th>
            <th className="p-2 text-left">Target</th>
            <th className="p-2 text-left">Forecast</th>
          </tr>
        </thead>
        <tbody>
          {[
            { name: "Andree Repp", revenue: "$227,412", target: "$250,000", forecast: "$245,000", positive: true },
            { name: "Salla Yes", revenue: "$201,384", target: "$200,000", forecast: "$210,000", positive: true },
            { name: "Shannah Biden", revenue: "$119,267", target: "$150,000", forecast: "$125,000", positive: false },
            { name: "Hanny Giraudoux", revenue: "$152,803", target: "$175,000", forecast: "$160,000", positive: false },
            { name: "Thali Bour", revenue: "$94,763", target: "$100,000", forecast: "$102,000", positive: true }
          ].map((row, i) => (
            <tr key={i} className="border-b">
              <td className="p-2">{row.name}</td>
              <td className="p-2">{row.revenue}</td>
              <td className="p-2">{row.target}</td>
              <td className={`p-2 ${row.positive ? "text-green-500" : "text-red-500"}`}>{row.forecast}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(activeWidgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setActiveWidgets(items);
  };

  return (
    <div className="space-y-6 p-4 min-h-screen relative bg-sky-50">
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Sales Performance Dashboard</h1>
            <p className="text-sky-100 text-x">{selectedCompany}</p>
            <p className="text-sky-100 text-x mt-1">Data showing from 06/01/25 - 07/31/25</p>
          </div>
          <div className="flex space-x-2">
            <button type="button" className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200" onClick={() => setShowFilters(!showFilters)}>
              <FiFilter className="mr-1" /> Filters
            </button>
            <button
                                                    onClick={() => window.print()}
                                                    className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 hover:text-sky-50 transition-colors duration-200">
                                                    <FiDownload className="text-sky-50" />
                                                    <span className="text-sky-50">Export</span>
                                                </button>
            <Link
                to="/sales-performance-table"
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

      {showFilters && (
        <div className="bg-white p-4 rounded-lg shadow-sm" ref={filtersRef}>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {["Time Period", "Region", "Product", "Customer Segment", "Sales Team"].map((filter, i) => (
              <div key={i}>
                <label className="block text-s font-medium text-gray-700 mb-1">{filter}</label>
                <select className="w-full p-2 border border-gray-300 rounded-md text-s">
                  <option>All {filter === "Time Period" ? "Periods" : filter + "s"}</option>
                  {filter === "Region" && ["North America", "Europe", "Asia", "South America", "Africa"].map(opt => <option key={opt}>{opt}</option>)}
                  {filter === "Product" && ["Data Science", "Computer Science", "Business", "Arts"].map(opt => <option key={opt}>{opt}</option>)}
                  {filter === "Customer Segment" && ["Enterprise", "SMB", "Startup", "Education"].map(opt => <option key={opt}>{opt}</option>)}
                  {filter === "Sales Team" && ["Enterprise Sales", "SMB Sales", "Inside Sales"].map(opt => <option key={opt}>{opt}</option>)}
                  {filter === "Time Period" && ["Last Quarter", "Last Month", "Last Week", "Year to Date", "Custom Range"].map(opt => <option key={opt}>{opt}</option>)}
                </select>
              </div>
            ))}
          </div>
          {/* <div className="flex justify-end mt-4 space-x-2">
            <button className="px-4 py-2 text-s bg-gray-200 rounded hover:bg-gray-300">Reset</button>
            <button className="px-4 py-2 text-s bg-blue-600 text-white rounded hover:bg-blue-700">Apply Filters</button>
          </div> */}
        </div>
      )}

      {/* Quick Links to Sub-Pages */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-sky-100 mt-6">
        <h3 className="text-md font-semibold text-sky-800 mb-4">Explore Detailed Analytics</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {navItems.map((item, index) => (
            <Link 
              to={item.path} 
              key={index} 
              className="bg-sky-50 hover:bg-sky-100 p-3 rounded-lg text-center text-s font-medium text-sky-800 transition-colors"
            >
              <div className="mx-auto w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center mb-2 text-sky-600">
                {item.icon}
              </div>
              {item.name}
            </Link>
          ))}
        </div>
      </div>

      <div className=" grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(kpiData).map(([key, value], index) => (
          <KPICard
            key={key}
            title={key.replace(/([A-Z])/g, " $1")}
            value={value.value}
            change={value.change}
            isPositive={value.change?.startsWith("+")}
            icon={key === "totalRevenue" || key === "revenuePerSegment" ? <FiDollarSign size={16} /> : 
                  key === "salesTeamCost" ? <FiUser size={16} /> : 
                  key === "leads" || key === "opportunities" || key === "wins" ? <FiTrendingUp size={16} /> : 
                  <FiTrendingUp size={16} />}
            componentPath={value.componentPath}
            forecast={value.forecast}
          />
        ))}
      </div>


      {/* Navigation Cards
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {navItems.map((item, index) => (
          <Link to={item.path} key={index}>
            <motion.div 
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -3 }}
              className="bg-white p-4 rounded-lg border border-sky-100 shadow-sm hover:shadow-md transition-all duration-300"
            >
              <div className="flex flex-col items-center text-center">
                <div className="p-3 rounded-full bg-sky-100 text-sky-600 mb-2">
                  {item.icon}
                </div>
                <h3 className="text-s font-medium text-sky-800">{item.name}</h3>
              </div>
            </motion.div>
          </Link>
        ))}
      </div> */}

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="charts" isDropDisabled={false}>
          {(provided) => (
            <div className="grid gap-6" {...provided.droppableProps} ref={provided.innerRef}>

               {/* First Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <EnhancedChartCard title={charts.revenueTrend.title} chartType={chartTypes.revenueTrend} chartData={charts.revenueTrend} widgetId="revenueTrend" index={0} componentPath={charts.revenueTrend.componentPath} />
                <EnhancedChartCard title={charts.leadSource.title} chartType={chartTypes.leadSource} chartData={charts.leadSource} widgetId="leadSource" index={6} componentPath={charts.leadSource.componentPath} />
              </div>

              {/* Second Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <EnhancedChartCard title={charts.customersByStage.title} chartType={chartTypes.customersByStage} chartData={charts.customersByStage} widgetId="customersByStage" index={5} componentPath={charts.customersByStage.componentPath} />
                <EnhancedChartCard title={charts.salesTeamCost.title} chartType={chartTypes.salesTeamCost} chartData={charts.salesTeamCost} widgetId="salesTeamCost" index={6} componentPath={charts.salesTeamCost.componentPath} />
                <EnhancedChartCard title={charts.funnelMetrics.title} chartType={chartTypes.funnelMetrics} chartData={charts.funnelMetrics} widgetId="funnelMetrics" index={1} componentPath={charts.funnelMetrics.componentPath} />
              </div>

              {/* Third Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <EnhancedChartCard title={charts.revenueByProduct.title} chartType={chartTypes.revenueByProduct} chartData={charts.revenueByProduct} widgetId="revenueByProduct" index={2} componentPath={charts.revenueByProduct.componentPath} />
                <EnhancedChartCard title={charts.revenueByRegion.title} chartType={chartTypes.revenueByRegion} chartData={charts.revenueByRegion} widgetId="revenueByRegion" index={3} componentPath={charts.revenueByRegion.componentPath} />
                <EnhancedChartCard title={charts.revenueBySalesPerson.title} chartType={chartTypes.revenueBySalesPerson} chartData={charts.revenueBySalesPerson} widgetId="revenueBySalesPerson" index={4} componentPath={charts.revenueBySalesPerson.componentPath} />
              </div>

              {/* Fourth Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <RevenueTargetTable />              
              </div>

              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <ReactTooltip id="chart-type-tooltip" place="top" effect="solid" />
      <ReactTooltip id="ai-tooltip" place="top" effect="solid" />

      
    </div>
  );
};

export default SalesPerformanceDashboard;