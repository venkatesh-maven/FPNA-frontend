import React, { useState, useRef, useEffect } from "react";
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
import { Bar, Line, Doughnut } from "react-chartjs-2";
import { motion } from "framer-motion";
import { 
  FiTrendingUp, 
  FiTrendingDown, 
  FiChevronRight,
  FiFilter, 
  FiDownload,
  FiDollarSign,
  FiPieChart,
  FiChevronDown,
  FiSend,
  FiActivity
} from "react-icons/fi";
import { BsStars, BsThreeDotsVertical } from "react-icons/bs";
import { Tooltip as ReactTooltip } from "react-tooltip";
import { RiDragMove2Fill } from "react-icons/ri";
import { GrLinkNext } from "react-icons/gr";

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

const ProfitabilityRatios = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    timePeriod: "Last 6 Months",
    businessUnit: "All Units",
    viewType: "All Margins",
    forecastView: "Show Forecast"
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedChartType, setSelectedChartType] = useState({
    marginTrend: "line",
    marginBySegment: "bar"
  });
  const [aiInput, setAiInput] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const filtersRef = useRef(null);

  // Sample data for profitability metrics
  const profitabilityData = {
    marginTrend: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"],
      datasets: [
        {
          label: "Gross Margin (%)",
          data: [62.1, 62.8, 63.5, 63.2, 63.8, 64.1, 64.5, 64.8],
          backgroundColor: "rgba(16, 185, 129, 0.2)",
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 2,
          tension: 0.3
        },
        {
          label: "Operating Margin (%)",
          data: [20.5, 20.8, 21.2, 20.9, 21.5, 21.8, 21.5, 21.3],
          backgroundColor: "rgba(59, 130, 246, 0.2)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 2,
          tension: 0.3
        },
        {
          label: "Net Profit Margin (%)",
          data: [13.2, 13.5, 13.8, 13.5, 14.0, 14.2, 13.9, 13.7],
          backgroundColor: "rgba(139, 92, 246, 0.2)",
          borderColor: "rgba(139, 92, 246, 1)",
          borderWidth: 2,
          tension: 0.3
        },
        {
          label: "Forecast",
          data: [null, null, null, null, null, null, 13.9, 13.7],
          backgroundColor: "rgba(139, 92, 246, 0.1)",
          borderColor: "rgba(139, 92, 246, 0.5)",
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.3,
          pointRadius: 0
        }
      ]
    },
    marginBySegment: {
      labels: ["US Region", "EMEA", "APAC", "Global"],
      datasets: [
        {
          label: "Gross Margin (%)",
          data: [66.1, 56.3, 47.3, 62.5],
          backgroundColor: "rgba(16, 185, 129, 0.7)",
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 1
        },
        {
          label: "Operating Margin (%)",
          data: [22.5, 18.4, 11.2, 21.3],
          backgroundColor: "rgba(59, 130, 246, 0.7)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 1
        },
        {
          label: "Net Profit Margin (%)",
          data: [14.7, 12.2, 6.8, 13.9],
          backgroundColor: "rgba(139, 92, 246, 0.7)",
          borderColor: "rgba(139, 92, 246, 1)",
          borderWidth: 1
        }
      ]
    },
    forecastTrend: {
      labels: ["Q1", "Q2", "Q3", "Q4", "Q1 '25", "Q2 '25"],
      datasets: [
        {
          label: "Actual Net Margin (%)",
          data: [13.2, 13.8, 13.9, null, null, null],
          backgroundColor: "rgba(139, 92, 246, 0.2)",
          borderColor: "rgba(139, 92, 246, 1)",
          borderWidth: 2,
          tension: 0.3
        },
        {
          label: "Forecast Net Margin (%)",
          data: [null, null, 13.9, 13.1, 12.8, 13.5],
          backgroundColor: "rgba(139, 92, 246, 0.1)",
          borderColor: "rgba(139, 92, 246, 0.5)",
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.3,
          pointRadius: 0
        }
      ]
    },
    marginHeatmap: {
      labels: ["Product A", "Product B", "Product C", "Product D", "Product E"],
      datasets: [
        {
          label: "Gross Margin (%)",
          data: [68.2, 59.4, 52.1, 71.5, 61.3],
          backgroundColor: [
            "rgba(16, 185, 129, 0.7)",
            "rgba(234, 179, 8, 0.7)",
            "rgba(234, 179, 8, 0.7)",
            "rgba(16, 185, 129, 0.7)",
            "rgba(16, 185, 129, 0.7)"
          ],
          borderColor: [
            "rgba(16, 185, 129, 1)",
            "rgba(234, 179, 8, 1)",
            "rgba(234, 179, 8, 1)",
            "rgba(16, 185, 129, 1)",
            "rgba(16, 185, 129, 1)"
          ],
          borderWidth: 1
        },
        {
          label: "Net Margin (%)",
          data: [16.5, 12.8, 9.2, 18.1, 13.4],
          backgroundColor: [
            "rgba(16, 185, 129, 0.7)",
            "rgba(239, 68, 68, 0.7)",
            "rgba(239, 68, 68, 0.7)",
            "rgba(16, 185, 129, 0.7)",
            "rgba(16, 185, 129, 0.7)"
          ],
          borderColor: [
            "rgba(16, 185, 129, 1)",
            "rgba(239, 68, 68, 1)",
            "rgba(239, 68, 68, 1)",
            "rgba(16, 185, 129, 1)",
            "rgba(16, 185, 129, 1)"
          ],
          borderWidth: 1
        }
      ]
    }
  };

  const kpiData = [
    {
      title: "Gross Margin",
      value: "62.5%",
      change: "+0.7%",
      isPositive: true,
      icon: <FiPieChart />,
      description: "Revenue after COGS",
      forecast: "63.2% predicted next quarter",
      componentPath: "/finance-accounting-table"
    },
    {
      title: "Operating Margin",
      value: "21.3%",
      change: "+0.4%",
      isPositive: true,
      icon: <FiActivity />,
      description: "After operating expenses",
      forecast: "20.8% predicted next quarter",
      componentPath: "/finance-accounting-table"
    },
    {
      title: "Net Profit Margin",
      value: "13.9%",
      change: "+0.5%",
      isPositive: true,
      icon: <FiDollarSign />,
      description: "Bottom line profitability",
      forecast: "13.1% predicted Q4",
      componentPath: "/finance-accounting-table"
    },
    {
      title: "EBITDA Margin",
      value: "18.6%",
      change: "+0.3%",
      isPositive: true,
      icon: <FiTrendingUp />,
      description: "Earnings before interest/taxes",
      forecast: "18.2% predicted Q4",
      componentPath: "/finance-accounting-table"
    }
  ];

  const profitabilityTableData = [
    {
      segment: "US Region",
      revenue: "$12.4M",
      cogs: "$4.2M",
      grossMargin: "66.1%",
      operatingMargin: "22.5%",
      netMargin: "14.7%",
      aiComment: "Strong margin trend"
    },
    {
      segment: "EMEA",
      revenue: "$7.1M",
      cogs: "$3.1M",
      grossMargin: "56.3%",
      operatingMargin: "18.4%",
      netMargin: "12.2%",
      aiComment: "OPEX pressure increasing"
    },
    {
      segment: "APAC",
      revenue: "$5.5M",
      cogs: "$2.9M",
      grossMargin: "47.3%",
      operatingMargin: "11.2%",
      netMargin: "6.8%",
      aiComment: "Profit margin declining"
    },
    {
      segment: "Global",
      revenue: "$25.0M",
      cogs: "$9.4M",
      grossMargin: "62.5%",
      operatingMargin: "21.3%",
      netMargin: "13.9%",
      aiComment: "Overall stable performance"
    }
  ];

  const marginBenchmarks = [
    {
      metric: "Gross Margin",
      value: "62.5%",
      trend: "+0.7%",
      benchmark: "Industry Avg: 58.2%"
    },
    {
      metric: "Operating Margin",
      value: "21.3%",
      trend: "+0.4%",
      benchmark: "Industry Avg: 19.8%"
    },
    {
      metric: "Net Margin",
      value: "13.9%",
      trend: "+0.5%",
      benchmark: "Industry Avg: 12.1%"
    },
    {
      metric: "EBITDA Margin",
      value: "18.6%",
      trend: "+0.3%",
      benchmark: "Industry Avg: 16.9%"
    }
  ];

  const toggleChartType = (chartId, type) => {
    setSelectedChartType(prev => ({ ...prev, [chartId]: type }));
  };

  const handleSendAIQuery = (widgetId) => {
    if (aiInput[widgetId]?.trim()) {
      console.log(`AI Query for ${widgetId}:`, aiInput[widgetId]);
      setAiInput(prev => ({ ...prev, [widgetId]: "" }));
      setShowAIDropdown(null);
    }
  };

  const renderChart = (type, data, options = {}) => {
    switch (type) {
      case "line": return <Line data={data} options={options} />;
      case "bar": return <Bar data={data} options={options} />;
      case "doughnut": return <Doughnut data={data} options={options} />;
      default: return <Bar data={data} options={options} />;
    }
  };

  const EnhancedChartCard = ({ title, componentPath, chartType, chartData, widgetId, index }) => {
    const dropdownRef = useOutsideClick(() => setDropdownWidget(null));
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border border-sky-100">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-md font-semibold text-sky-800">{title}</h3>
          <div className="flex space-x-2 relative">
            <div className="relative chart-dropdown">
              <button 
                onClick={(e) => { e.stopPropagation(); setDropdownWidget(dropdownWidget === widgetId ? null : widgetId); }} 
                className="p-1 rounded hover:bg-gray-100" 
                data-tooltip-id="chart-type-tooltip" 
                data-tooltip-content="Options"
              >
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
                          {["line", "bar", "doughnut"].map((type) => (
                            <button 
                              key={type} 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                toggleChartType(widgetId, type); 
                                setDropdownWidget(null); 
                                setHoveredChartType(null); 
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
                        navigate(componentPath); 
                        setDropdownWidget(null); 
                        setHoveredChartType(null); 
                      }}
                    >
                      Analyze
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button 
              onClick={() => setShowAIDropdown(showAIDropdown === widgetId ? null : widgetId)} 
              className="p-1 rounded hover:bg-gray-100" 
              data-tooltip-id="ai-tooltip" 
              data-tooltip-content="Ask AI"
            >
              <BsStars />
            </button>
            {showAIDropdown === widgetId && (
              <div className="absolute right-0 top-5 mt-2 w-full sm:w-64 bg-white rounded-md shadow-lg z-10 border border-gray-200 py-2">
                <div className="flex flex-col items-center space-x-2">
                  <h1 className="text-x">Ask regarding the {title}</h1>
                  <div className="flex justify-between gap-3">
                    <input 
                      type="text" 
                      value={aiInput[widgetId] || ""} 
                      onChange={(e) => setAiInput(prev => ({ ...prev, [widgetId]: e.target.value }))} 
                      placeholder="Ask AI..." 
                      className="w-full p-1 border border-gray-300 rounded text-x" 
                    />
                    <button 
                      onClick={() => handleSendAIQuery(widgetId)} 
                      className="p-2 bg-sky-500 text-white rounded hover:bg-sky-600" 
                      disabled={!aiInput[widgetId]?.trim()}
                    >
                      <FiSend />
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="p-1 rounded hover:bg-gray-100 cursor-move">
              <RiDragMove2Fill />
            </div>
          </div>
        </div>
        <div className="h-48">
          {renderChart(chartType, chartData.data, chartData.options)}
        </div>
      </div>
    );
  };

  const KPICard = ({ title, value, change, isPositive, icon, componentPath, description, forecast }) => {
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

    return (
      <motion.div 
        variants={cardVariants} 
        initial="hidden" 
        animate="visible" 
        whileHover={{ y: -3 }} 
        className="bg-white p-3 rounded-lg shadow-sm border border-sky-100 relative" 
        onClick={() => navigate(componentPath)}
      >
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center justify-between relative">
              <p className="text-[10px] font-semibold text-sky-600 uppercase tracking-wider truncate">{title}</p>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowAIDropdown(!showAIDropdown); }} 
                className="p-1 rounded hover:bg-gray-100" 
                data-tooltip-id="ai-tooltip" 
                data-tooltip-content="Ask AI"
              >
                <BsStars />
              </button>
              {showAIDropdown && (
                <div ref={dropdownRef} className="absolute right-0 top-5 mt-2 w-full sm:w-44 bg-white rounded-md shadow-lg z-10 border border-gray-200 p-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="text" 
                      value={localAIInput} 
                      onChange={(e) => setLocalAIInput(e.target.value)} 
                      placeholder="Ask AI..." 
                      className="w-full p-1 border border-gray-300 rounded text-x" 
                      onClick={(e) => e.stopPropagation()} 
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
            <p className="text-s font-bold text-sky-900 mt-1">{value}</p>
            <div className={`flex items-center mt-2 ${isPositive ? "text-green-500" : "text-red-500"}`}>
              <span className="text-[10px] font-medium">{change} {isPositive ? "↑" : "↓"} vs last period</span>
            </div>
            <div className="mt-1">
              <p className="text-[10px] text-gray-500">{description}</p>
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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filtersRef.current && !filtersRef.current.contains(event.target)) {
        setShowFilters(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
              <Link to="/finance-accounting-dashboard" className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                Financial Dashboard
              </Link>
            </div>
          </li>
          <li aria-current="page">
            <div className="flex items-center">
              <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Profitability Ratios</span>
            </div>
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Profitability Ratios Analysis</h1>
            <p className="text-sky-100 text-x">Margin Health, Cost Efficiency, Forecasts</p>
            <p className="text-sky-100 text-x mt-1">Data showing from 01/01/24 - 08/31/24</p>
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
   className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 hover:text-sky-50 	transition-colors duration-200">
   <FiDownload className="text-sky-50" />
   <span className="text-sky-50">Export</span>
</button>


            <Link
              to="/finance-accounting-table"
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

      {/* Filters */}
      {showFilters && (
        <div className="bg-white p-4 rounded-lg shadow-sm" ref={filtersRef}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Time Period</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.timePeriod}
                onChange={(e) => setFilters({...filters, timePeriod: e.target.value})}
              >
                <option>Last 6 Months</option>
                <option>Year to Date</option>
                <option>Last Quarter</option>
                <option>Custom Range</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Business Unit</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.businessUnit}
                onChange={(e) => setFilters({...filters, businessUnit: e.target.value})}
              >
                <option>All Units</option>
                <option>US Region</option>
                <option>EMEA</option>
                <option>APAC</option>
                <option>Global</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">View Type</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.viewType}
                onChange={(e) => setFilters({...filters, viewType: e.target.value})}
              >
                <option>All Margins</option>
                <option>Gross Margin</option>
                <option>Operating Margin</option>
                <option>Net Margin</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Forecast View</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.forecastView}
                onChange={(e) => setFilters({...filters, forecastView: e.target.value})}
              >
                <option>Show Forecast</option>
                <option>Hide Forecast</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map((kpi, index) => (
          <KPICard
            key={index}
            title={kpi.title}
            value={kpi.value}
            change={kpi.change}
            isPositive={kpi.isPositive}
            icon={kpi.icon}
            componentPath={kpi.componentPath}
            description={kpi.description}
            forecast={kpi.forecast}
          />
        ))}
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Margin Trend */}
        <EnhancedChartCard 
          title="Profitability Ratios Over Time" 
          chartType={selectedChartType.marginTrend} 
          chartData={{
            data: profitabilityData.marginTrend,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom' }
              },
              scales: {
                y: {
                  beginAtZero: false,
                  min: 10,
                  title: {
                    display: true,
                    text: 'Margin (%)'
                  }
                }
              }
            }
          }} 
          widgetId="marginTrend" 
          index={0} 
          componentPath="/finance-accounting-table" 
        />

        {/* Margin by Segment */}
        <EnhancedChartCard 
          title="Profitability by Business Segment" 
          chartType={selectedChartType.marginBySegment} 
          chartData={{
            data: profitabilityData.marginBySegment,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom' }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: 'Margin (%)'
                  }
                }
              }
            }
          }} 
          widgetId="marginBySegment" 
          index={1} 
          componentPath="/finance-accounting-table" 
        />
      </div>

      {/* Secondary Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Forecast Trend */}
        <EnhancedChartCard 
          title="Net Profit Margin Forecast" 
          chartType="line" 
          chartData={{
            data: profitabilityData.forecastTrend,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom' }
              },
              scales: {
                y: {
                  beginAtZero: false,
                  min: 5,
                  title: {
                    display: true,
                    text: 'Net Margin (%)'
                  }
                }
              }
            }
          }} 
          widgetId="forecastTrend" 
          index={2} 
          componentPath="/finance-accounting-table" 
        />

        {/* Margin Heatmap */}
        <EnhancedChartCard 
          title="Margin Performance by Product" 
          chartType="bar" 
          chartData={{
            data: profitabilityData.marginHeatmap,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom' }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: 'Margin (%)'
                  }
                }
              }
            }
          }} 
          widgetId="marginHeatmap" 
          index={3} 
          componentPath="/finance-accounting-table" 
        />
      </div>

      {/* Profitability Breakdown Table */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">Profitability Breakdown by Business Unit</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-s text-left text-gray-700">
            <thead className="text-x text-sky-700 uppercase bg-sky-50">
              <tr>
                <th className="px-4 py-2">Segment / BU</th>
                <th className="px-4 py-2">Revenue ($)</th>
                <th className="px-4 py-2">COGS ($)</th>
                <th className="px-4 py-2">Gross Margin (%)</th>
                <th className="px-4 py-2">Operating Margin (%)</th>
                <th className="px-4 py-2">Net Profit Margin (%)</th>
                <th className="px-4 py-2">AI Comment</th>
              </tr>
            </thead>
            <tbody>
              {profitabilityTableData.map((row, i) => (
                <tr key={i} className="border-b hover:bg-sky-50">
                  <td className="px-4 py-2 font-medium">{row.segment}</td>
                  <td className="px-4 py-2">{row.revenue}</td>
                  <td className="px-4 py-2">{row.cogs}</td>
                  <td className={`px-4 py-2 ${
                    parseFloat(row.grossMargin) > 60 ? "text-green-500" : 
                    parseFloat(row.grossMargin) > 50 ? "text-amber-500" : "text-red-500"
                  }`}>{row.grossMargin}</td>
                  <td className={`px-4 py-2 ${
                    parseFloat(row.operatingMargin) > 20 ? "text-green-500" : 
                    parseFloat(row.operatingMargin) > 15 ? "text-amber-500" : "text-red-500"
                  }`}>{row.operatingMargin}</td>
                  <td className={`px-4 py-2 font-medium ${
                    parseFloat(row.netMargin) > 15 ? "text-green-500" : 
                    parseFloat(row.netMargin) > 10 ? "text-amber-500" : "text-red-500"
                  }`}>{row.netMargin}</td>
                  <td className="px-4 py-2 text-x">
                    {row.aiComment.includes("Strong") ? (
                      <span className="text-green-500">👍 {row.aiComment}</span>
                    ) : row.aiComment.includes("OPEX") ? (
                      <span className="text-amber-500">⚠️ {row.aiComment}</span>
                    ) : (
                      <span className="text-red-500">🚨 {row.aiComment}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

            {/* Benchmark Metrics */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">Margin Benchmarks</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {marginBenchmarks.map((metric, i) => (
            <div key={i} className="bg-sky-50 p-3 rounded-lg">
              <p className="text-x font-semibold text-sky-700">{metric.metric}</p>
              <div className="flex items-end mt-1">
                <p className="text-lg font-bold text-sky-900">{metric.value}</p>
                <p
                  className={`text-x ml-2 ${
                    metric.trend.startsWith("+") ? "text-green-600" : "text-red-500"
                  }`}
                >
                  {metric.trend}
                </p>
              </div>
              <p className="text-x text-gray-600 mt-1">{metric.benchmark}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProfitabilityRatios;
