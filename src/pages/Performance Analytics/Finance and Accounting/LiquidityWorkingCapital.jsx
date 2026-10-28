import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { motion } from "framer-motion";
import { 
  FiTrendingUp, 
  FiTrendingDown, 
  FiChevronRight,
  FiFilter, 
  FiDownload,
  FiDollarSign,
  FiClock,
  FiAlertCircle,
  FiChevronDown,
  FiSend,
  FiPieChart
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

const LiquidityWorkingCapital = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    timePeriod: "Last Quarter",
    businessUnit: "All Units",
    currency: "USD",
    forecastHorizon: "6 months"
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedChartType, setSelectedChartType] = useState({
    cashConversionCycle: "line",
    workingCapitalComponents: "bar",
    ratiosTrend: "line"
  });
  const [aiInput, setAiInput] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const filtersRef = useRef(null);

  // Sample data for liquidity and working capital metrics
  const liquidityData = {
    cashConversionCycle: {
      labels: ["Q1", "Q2", "Q3", "Q4"],
      datasets: [
        {
          label: "Cash Conversion Cycle (Days)",
          data: [45, 42, 39, 36],
          backgroundColor: "rgba(59, 130, 246, 0.2)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 2,
          tension: 0.4
        },
        {
          label: "AI Forecast",
          data: [null, null, null, 36, 38, 41, 44],
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderColor: "rgba(59, 130, 246, 0.5)",
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.4,
          pointRadius: 0
        }
      ]
    },
    workingCapitalComponents: {
      labels: ["Q1", "Q2", "Q3", "Q4"],
      datasets: [
        {
          label: "Receivables",
          data: [1200, 1350, 1420, 1580],
          backgroundColor: "rgba(16, 185, 129, 0.7)",
        },
        {
          label: "Payables",
          data: [950, 1020, 980, 1100],
          backgroundColor: "rgba(239, 68, 68, 0.7)",
        },
        {
          label: "Inventory",
          data: [800, 750, 820, 780],
          backgroundColor: "rgba(234, 179, 8, 0.7)",
        },
        {
          label: "Cash",
          data: [500, 650, 720, 850],
          backgroundColor: "rgba(139, 92, 246, 0.7)",
        }
      ]
    },
    ratiosTrend: {
      labels: ["Q1", "Q2", "Q3", "Q4"],
      datasets: [
        {
          label: "Current Ratio",
          data: [1.7, 1.8, 1.9, 2.0],
          backgroundColor: "rgba(16, 185, 129, 0.2)",
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 2,
          tension: 0.4,
          yAxisID: 'y'
        },
        {
          label: "Quick Ratio",
          data: [1.2, 1.3, 1.4, 1.5],
          backgroundColor: "rgba(59, 130, 246, 0.2)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 2,
          tension: 0.4,
          yAxisID: 'y'
        },
        {
          label: "Cash Position ($M)",
          data: [0.5, 0.65, 0.72, 0.85],
          backgroundColor: "rgba(139, 92, 246, 0.1)",
          borderColor: "rgba(139, 92, 246, 0.5)",
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.4,
          pointRadius: 0,
          yAxisID: 'y1'
        }
      ]
    }
  };

  const kpiData = [
    {
      title: "Current Ratio",
      value: "1.8",
      change: "+6%",
      isPositive: true,
      icon: <FiPieChart />,
      description: "Ideal range: 1.5–2.0",
      forecast: "Projected: 1.9 next quarter",
      componentPath: "/finance-accounting-table"
    },
    {
      title: "Quick Ratio",
      value: "1.3",
      change: "+4%",
      isPositive: true,
      icon: <FiAlertCircle />,
      description: "Acid-test liquidity measure",
      forecast: "Projected: 1.4 next quarter",
      componentPath: "/finance-accounting-table"
    },
    {
      title: "Cash Conv. Cycle",
      value: "42 Days",
      change: "-3 Days",
      isPositive: true,
      icon: <FiClock />,
      description: "Time to convert inventory to cash",
      forecast: "Projected: 44 Days next quarter",
      componentPath: "/finance-accounting-table"
    },
    {
      title: "Working Capital",
      value: "$4.2M",
      change: "+8%",
      isPositive: true,
      icon: <FiDollarSign />,
      description: "Current assets minus liabilities",
      forecast: "Projected: $4.5M next quarter",
      componentPath: "/finance-accounting-table"
    }
  ];

  const daysMetrics = [
    {
      title: "Receivables Days",
      value: "36 Days",
      change: "+2 Days",
      isPositive: false,
      icon: <FiTrendingUp />,
      description: "Time to collect from customers",
      forecast: "Projected: 38 Days next quarter",
      componentPath: "/finance-accounting-table"
    },
    {
      title: "Payables Days",
      value: "19 Days",
      change: "-1 Day",
      isPositive: true,
      icon: <FiTrendingDown />,
      description: "Time to pay suppliers",
      forecast: "Projected: 18 Days next quarter",
      componentPath: "/finance-accounting-table"
    },
    {
      title: "Inventory Days",
      value: "25 Days",
      change: "-3 Days",
      isPositive: true,
      icon: <FiTrendingDown />,
      description: "Time to sell inventory",
      forecast: "Projected: 24 Days next quarter",
      componentPath: "/finance-accounting-table"
    }
  ];

  const workingCapitalTableData = [
    {
      businessUnit: "US Operations",
      receivables: "$1.2M",
      payables: "$950K",
      inventory: "$800K",
      ccc: "45 Days",
      currentRatio: "1.7",
      aiAlert: "⚠️ Receivables rising fast"
    },
    {
      businessUnit: "EMEA",
      receivables: "$650K",
      payables: "$720K",
      inventory: "$400K",
      ccc: "38 Days",
      currentRatio: "1.9",
      aiAlert: "✅ Healthy liquidity"
    },
    {
      businessUnit: "APAC",
      receivables: "$480K",
      payables: "$520K",
      inventory: "$350K",
      ccc: "42 Days",
      currentRatio: "1.6",
      aiAlert: "⚠️ Inventory turnover slowing"
    },
    {
      businessUnit: "Latin America",
      receivables: "$320K",
      payables: "$380K",
      inventory: "$280K",
      ccc: "51 Days",
      currentRatio: "1.4",
      aiAlert: "🔴 High CCC risk"
    }
  ];

  const aiRecommendations = [
    {
      title: "Receivables Optimization",
      content: "Negotiate faster payment terms with top 3 customers – could reduce CCC by 6 days."
    },
    {
      title: "Inventory Reduction",
      content: "Reduce stock for SKU-342 to save $120K in holding costs."
    },
    {
      title: "Payables Strategy",
      content: "Consider delaying non-critical payables to boost Q3 liquidity cushion."
    },
    {
      title: "Process Automation",
      content: "Automate receivables tracking to shorten AR days by 12%."
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
      default: return <Line data={data} options={options} />;
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
                          {["line", "bar"].map((type) => (
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
            <Link to="/financial-overview" className="inline-flex items-center text-s font-medium text-gray-700 hover:text-blue-600">
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
                Finance Dashboard
              </Link>
            </div>
          </li>
          <li aria-current="page">
            <div className="flex items-center">
              <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Liquidity & Working Capital</span>
            </div>
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Liquidity & Working Capital Analysis</h1>
            <p className="text-sky-100 text-x">Short-term Solvency, Cash Efficiency Metrics</p>
            <p className="text-sky-100 text-x mt-1">Data showing from Q1 2024 - Q4 2024</p>
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
                                                                to="/financial-accounting-table"
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
                <option>Last Quarter</option>
                <option>Last 6 Months</option>
                <option>Year to Date</option>
                <option>Last 12 Months</option>
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
                <option>US Operations</option>
                <option>EMEA</option>
                <option>APAC</option>
                <option>Latin America</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Currency</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.currency}
                onChange={(e) => setFilters({...filters, currency: e.target.value})}
              >
                <option>USD</option>
                <option>EUR</option>
                <option>GBP</option>
                <option>JPY</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Forecast Horizon</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.forecastHorizon}
                onChange={(e) => setFilters({...filters, forecastHorizon: e.target.value})}
              >
                <option>3 months</option>
                <option>6 months</option>
                <option>1 year</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

      {/* Days Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {daysMetrics.map((metric, index) => (
          <KPICard
            key={index}
            title={metric.title}
            value={metric.value}
            change={metric.change}
            isPositive={metric.isPositive}
            icon={metric.icon}
            componentPath={metric.componentPath}
            description={metric.description}
            forecast={metric.forecast}
          />
        ))}
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cash Conversion Cycle */}
        <EnhancedChartCard 
          title="Cash Conversion Cycle Trend with Forecast" 
          chartType={selectedChartType.cashConversionCycle} 
          chartData={{
            data: liquidityData.cashConversionCycle,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom' }
              },
              scales: {
                y: {
                  beginAtZero: false,
                  title: {
                    display: true,
                    text: 'Days'
                  }
                }
              }
            }
          }} 
          widgetId="cashConversionCycle" 
          index={0} 
          componentPath="/finance-accounting-table" 
        />

        {/* Working Capital Components */}
        <EnhancedChartCard 
          title="Working Capital Components" 
          chartType={selectedChartType.workingCapitalComponents} 
          chartData={{
            data: liquidityData.workingCapitalComponents,
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
                    text: 'Amount ($K)'
                  }
                }
              }
            }
          }} 
          widgetId="workingCapitalComponents" 
          index={1} 
          componentPath="/finance-accounting-table" 
        />
      </div>

      {/* Ratios Trend Chart */}
      <div className="grid grid-cols-1 gap-6">
        <EnhancedChartCard 
          title="Current Ratio vs Quick Ratio with Cash Position" 
          chartType={selectedChartType.ratiosTrend} 
          chartData={{
            data: liquidityData.ratiosTrend,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom' }
              },
              scales: {
                y: {
                  type: 'linear',
                  display: true,
                  position: 'left',
                  title: {
                    display: true,
                    text: 'Ratio'
                  }
                },
                y1: {
                  type: 'linear',
                  display: true,
                  position: 'right',
                  title: {
                    display: true,
                    text: 'Cash ($M)'
                  },
                  grid: {
                    drawOnChartArea: false
                  }
                }
              }
            }
          }} 
          widgetId="ratiosTrend" 
          index={2} 
          componentPath="/finance-accounting-table" 
        />
      </div>

      {/* Working Capital Detail Table */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">Working Capital by Business Unit</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-s text-left text-gray-700">
            <thead className="text-x text-sky-700 uppercase bg-sky-50">
              <tr>
                <th className="px-4 py-2">Business Unit</th>
                <th className="px-4 py-2">Receivables</th>
                <th className="px-4 py-2">Payables</th>
                <th className="px-4 py-2">Inventory</th>
                <th className="px-4 py-2">CCC (Days)</th>
                <th className="px-4 py-2">Current Ratio</th>
                <th className="px-4 py-2">AI Alert</th>
              </tr>
            </thead>
            <tbody>
              {workingCapitalTableData.map((row, i) => (
                <tr key={i} className="border-b hover:bg-sky-50">
                  <td className="px-4 py-2 font-medium">{row.businessUnit}</td>
                  <td className="px-4 py-2">{row.receivables}</td>
                  <td className="px-4 py-2">{row.payables}</td>
                  <td className="px-4 py-2">{row.inventory}</td>
                  <td className={`px-4 py-2 ${
                    parseFloat(row.ccc) < 40 ? "text-green-500" : 
                    parseFloat(row.ccc) < 50 ? "text-amber-500" : "text-red-500"
                  }`}>{row.ccc}</td>
                  <td className={`px-4 py-2 ${
                    parseFloat(row.currentRatio) > 1.8 ? "text-green-500" : 
                    parseFloat(row.currentRatio) > 1.5 ? "text-amber-500" : "text-red-500"
                  }`}>{row.currentRatio}</td>
                  <td className="px-4 py-2">{row.aiAlert}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Recommendations Section */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">AI Insights & Recommendations</h3>
          <button 
            className="flex items-center text-x text-sky-600 hover:text-sky-800"
            onClick={() => setShowAIDropdown("aiRecommendations")}
          >
            <BsStars className="mr-1" /> Ask Another Question
          </button>
        </div>
        {showAIDropdown === "aiRecommendations" && (
          <div className="mb-4 bg-sky-50 p-3 rounded-lg">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={aiInput["aiRecommendations"] || ""}
                onChange={(e) => setAiInput(prev => ({ ...prev, ["aiRecommendations"]: e.target.value }))}
                placeholder="Ask about liquidity, working capital optimization..."
                className="w-full p-2 border border-gray-300 rounded-md text-s"
              />
              <button
                onClick={() => handleSendAIQuery("aiRecommendations")}
                className="p-2 bg-sky-500 text-white rounded hover:bg-sky-600"
                disabled={!aiInput["aiRecommendations"]?.trim()}
              >
                <FiSend />
              </button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {aiRecommendations.map((rec, i) => (
            <div key={i} className="bg-sky-50 p-3 rounded-lg">
              <h4 className="text-s font-medium text-sky-800 mb-2">{rec.title}</h4>
              <p className="text-x text-gray-700">{rec.content}</p>
              {/* <button className="mt-2 text-x text-sky-600 hover:text-sky-800">
                View Action Plan →
              </button> */}
            </div>
          ))}
        </div>
      </div>

      <ReactTooltip id="chart-type-tooltip" place="top" effect="solid" />
      <ReactTooltip id="ai-tooltip" place="top" effect="solid" />
    </div>
  );
};

export default LiquidityWorkingCapital;