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
  FiDollarSign,
  FiDownload,
  FiPercent,
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
import { getDecimalPrecision } from '../../../utils/formatters';

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

const DebtCoverage = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    timePeriod: "Last 12 Months",
    loanType: "All Loans",
    businessUnit: "All Units",
    riskFilter: "All"
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedChartType, setSelectedChartType] = useState({
    debtEquityTrend: "line",
    interestCoverage: "bar"
  });
  const [aiInput, setAiInput] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const filtersRef = useRef(null);

  // Sample data for financial metrics
  const financialData = {
    debtEquityTrend: {
      labels: ["Q1 2023", "Q2 2023", "Q3 2023", "Q4 2023", "Q1 2024", "Q2 2024"],
      datasets: [
        {
          label: "Debt-to-Equity Ratio",
          data: [2.1, 2.0, 1.9, 1.8, 1.7, 1.6],
          backgroundColor: "rgba(59, 130, 246, 0.2)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 2,
          tension: 0.4,
          yAxisID: 'y'
        },
        {
          label: "AI Forecast",
          data: [null, null, null, null, 1.7, 1.6],
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderColor: "rgba(59, 130, 246, 0.5)",
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.4,
          pointRadius: 0
        }
      ]
    },
    loanRepaymentTimeline: {
      labels: ["2023", "2024", "2025", "2026", "2027"],
      datasets: [
        {
          label: "Principal Repayments",
          data: [5000000, 8000000, 12000000, 15000000, 10000000],
          backgroundColor: "rgba(239, 68, 68, 0.7)",
          borderColor: "rgba(239, 68, 68, 1)",
          borderWidth: 1
        },
        {
          label: "Interest Payments",
          data: [3800000, 3200000, 2800000, 2200000, 1800000],
          backgroundColor: "rgba(234, 179, 8, 0.7)",
          borderColor: "rgba(234, 179, 8, 1)",
          borderWidth: 1
        }
      ]
    },
    interestCoverageByUnit: {
      labels: ["North America", "EMEA", "APAC", "Latin America", "Corporate"],
      datasets: [{
        label: "Interest Coverage Ratio (EBIT/Interest)",
        data: [3.2, 2.8, 1.7, 2.5, 2.1],
        backgroundColor: [
          "rgba(16, 185, 129, 0.7)",
          "rgba(16, 185, 129, 0.7)",
          "rgba(239, 68, 68, 0.7)",
          "rgba(234, 179, 8, 0.7)",
          "rgba(234, 179, 8, 0.7)"
        ],
        borderColor: [
          "rgba(16, 185, 129, 1)",
          "rgba(16, 185, 129, 1)",
          "rgba(239, 68, 68, 1)",
          "rgba(234, 179, 8, 1)",
          "rgba(234, 179, 8, 1)"
        ],
        borderWidth: 1
      }]
    },
    debtServicingRisk: {
      labels: ["Current", "Next Quarter", "Q3 Forecast", "Q4 Forecast"],
      datasets: [{
        label: "Interest Coverage Ratio",
        data: [2.3, 2.4, 2.6, 2.8],
        backgroundColor: [
          "rgba(234, 179, 8, 0.7)",
          "rgba(234, 179, 8, 0.7)",
          "rgba(16, 185, 129, 0.7)",
          "rgba(16, 185, 129, 0.7)"
        ],
        borderColor: [
          "rgba(234, 179, 8, 1)",
          "rgba(234, 179, 8, 1)",
          "rgba(16, 185, 129, 1)",
          "rgba(16, 185, 129, 1)"
        ],
        borderWidth: 1
      }]
    }
  };

  const kpiData = [
    {
      title: "Debt-to-Equity Ratio",
      value: "1.8",
      change: "-0.2",
      isPositive: true,
      icon: <FiPercent />,
      description: "Total debt divided by total equity",
      forecast: "1.6 predicted next quarter",
      componentPath: "/finance-accounting-table"
    },
    {
      title: "Interest Coverage",
      value: "2.3x",
      change: "+0.3x",
      isPositive: true,
      icon: <FiPieChart />,
      description: "EBIT divided by interest expense",
      forecast: "2.5x predicted next quarter",
      componentPath: "/finance-accounting-table"
    },
    {
      title: "Total Debt",
      value: "$42.5M",
      change: "-$2.1M",
      isPositive: true,
      icon: <FiDollarSign />,
      description: "Outstanding principal balance",
      forecast: "$40.2M predicted next quarter",
      componentPath: "/finance-accounting-table"
    },
    {
      title: "Interest Expense",
      value: "$3.8M",
      change: "-$0.4M",
      isPositive: true,
      icon: <FiAlertCircle />,
      description: "Annual interest payments",
      forecast: "$3.5M predicted next year",
      componentPath: "/finance-accounting-table"
    },
    {
      title: "Coverage Period",
      value: "18 months",
      change: "+2 months",
      isPositive: true,
      icon: <FiClock />,
      description: "Cash runway for debt obligations",
      forecast: "20 months with current EBITDA",
      componentPath: "/finance-accounting-table"
    }
  ];

  const loanTableData = [
    {
      loanId: "L-203",
      lender: "Wells Fargo",
      amount: "$5,500,000",
      rate: "4.2%",
      startDate: "Jan 2022",
      maturityDate: "Jan 2027",
      remaining: "$3,200,000",
      monthly: "$95,000",
      status: "🟡 Active",
      risk: "Medium",
      suggestion: "Consider early repayment to save $220K interest"
    },
    {
      loanId: "L-312",
      lender: "Citi Bank",
      amount: "$10,000,000",
      rate: "6.1%",
      startDate: "Jul 2021",
      maturityDate: "Jul 2026",
      remaining: "$6,800,000",
      monthly: "$145,000",
      status: "🔴 Nearing Due",
      risk: "High",
      suggestion: "Refinance recommended before Q3 2024"
    },
    {
      loanId: "L-415",
      lender: "JPMorgan Chase",
      amount: "$8,000,000",
      rate: "3.8%",
      startDate: "Mar 2023",
      maturityDate: "Mar 2028",
      remaining: "$7,600,000",
      monthly: "$78,000",
      status: "🟢 Healthy",
      risk: "Low",
      suggestion: "No action needed - favorable terms"
    },
    {
      loanId: "L-528",
      lender: "Bank of America",
      amount: "$12,000,000",
      rate: "5.5%",
      startDate: "Nov 2020",
      maturityDate: "Nov 2025",
      remaining: "$4,200,000",
      monthly: "$210,000",
      status: "🟡 Active",
      risk: "Medium",
      suggestion: "Monitor cash flow impact in 2025"
    },
    {
      loanId: "L-619",
      lender: "Goldman Sachs",
      amount: "$6,500,000",
      rate: "7.2%",
      startDate: "Feb 2022",
      maturityDate: "Feb 2027",
      remaining: "$5,100,000",
      monthly: "$125,000",
      status: "🔴 High Interest",
      risk: "Critical",
      suggestion: "Priority for refinancing or early payoff"
    }
  ];

  const riskMetrics = [
    {
      metric: "DSCR (Debt Service Coverage)",
      value: "1.8x",
      trend: "+0.2x",
      benchmark: "1.5x min"
    },
    {
      metric: "Current Ratio",
      value: "1.5x",
      trend: "0.0x",
      benchmark: "1.2x min"
    },
    {
      metric: "Fixed Charge Coverage",
      value: "1.3x",
      trend: "+0.1x",
      benchmark: "1.25x min"
    },
    {
      metric: "EBITDA Margin",
      value: "22%",
      trend: "+2%",
      benchmark: "20% target"
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
                Finance Dashboard
              </Link>
            </div>
          </li>
          <li aria-current="page">
            <div className="flex items-center">
              <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Debt & Coverage Metrics</span>
            </div>
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Debt & Interest Coverage Metrics</h1>
            <p className="text-sky-100 text-x">Financial Leverage, Debt Servicing Capacity</p>
            <p className="text-sky-100 text-x mt-1">Data showing from Q1 2023 - Q2 2024 with forecasts</p>
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
                <option>Last 12 Months</option>
                <option>Year to Date</option>
                <option>Last Quarter</option>
                <option>Next 12 Months (Forecast)</option>
                <option>Custom Range</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Loan Type</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.loanType}
                onChange={(e) => setFilters({...filters, loanType: e.target.value})}
              >
                <option>All Loans</option>
                <option>Secured</option>
                <option>Unsecured</option>
                <option>Revolving Credit</option>
                <option>Term Loans</option>
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
                <option>North America</option>
                <option>EMEA</option>
                <option>APAC</option>
                <option>Latin America</option>
                <option>Corporate</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Risk Filter</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.riskFilter}
                onChange={(e) => setFilters({...filters, riskFilter: e.target.value})}
              >
                <option>All</option>
                <option>High-Interest</option>
                <option>Near-Maturity</option>
                <option>Low Coverage</option>
                <option>Critical</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
        {/* Debt-to-Equity Trend */}
        <EnhancedChartCard 
          title="Debt-to-Equity Trend with Forecast" 
          chartType={selectedChartType.debtEquityTrend} 
          chartData={{
            data: financialData.debtEquityTrend,
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
                    text: 'Debt-to-Equity Ratio'
                  }
                }
              }
            }
          }} 
          widgetId="debtEquityTrend" 
          index={0} 
          componentPath="/finance-accounting-table" 
        />

        {/* Loan Repayment Timeline */}
        <EnhancedChartCard 
          title="Loan Repayment Timeline (Principal vs Interest)" 
          chartType="bar" 
          chartData={{
            data: financialData.loanRepaymentTimeline,
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
                    text: 'Amount ($)'
                  },
                  ticks: {
                    callback: function(value) {
                      return '$' + (value / 1000000).toFixed(getDecimalPrecision()) + 'M';
                    }
                  }
                }
              }
            }
          }} 
          widgetId="loanRepaymentTimeline" 
          index={1} 
          componentPath="/finance-accounting-table" 
        />
      </div>

      {/* Secondary Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Interest Coverage by Unit */}
        <EnhancedChartCard 
          title="Interest Coverage by Business Unit" 
          chartType="bar" 
          chartData={{
            data: financialData.interestCoverageByUnit,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      return `${context.label}: ${context.raw}x coverage`;
                    }
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: 'Interest Coverage Ratio (EBIT/Interest)'
                  }
                }
              }
            }
          }} 
          widgetId="interestCoverageByUnit" 
          index={2} 
          componentPath="/finance-accounting-table" 
        />

        {/* Debt Servicing Risk */}
        <EnhancedChartCard 
          title="Debt Servicing Risk Indicator" 
          chartType="bar" 
          chartData={{
            data: financialData.debtServicingRisk,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                annotation: {
                  annotations: {
                    line1: {
                      type: 'line',
                      yMin: 1.5,
                      yMax: 1.5,
                      borderColor: 'rgb(234, 179, 8)',
                      borderWidth: 2,
                      borderDash: [6, 6],
                      label: {
                        content: 'Warning Threshold',
                        enabled: true,
                        position: 'left'
                      }
                    },
                    line2: {
                      type: 'line',
                      yMin: 3,
                      yMax: 3,
                      borderColor: 'rgb(16, 185, 129)',
                      borderWidth: 2,
                      borderDash: [6, 6],
                      label: {
                        content: 'Safe Threshold',
                        enabled: true,
                        position: 'left'
                      }
                    }
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: 'Interest Coverage Ratio'
                  }
                }
              }
            }
          }} 
          widgetId="debtServicingRisk" 
          index={3} 
          componentPath="/finance-accounting-table" 
        />
      </div>

      {/* Loan Repayment Schedule Table */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">Loan Repayment Schedule</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-s text-left text-gray-700">
            <thead className="text-x text-sky-700 uppercase bg-sky-50">
              <tr>
                <th className="px-4 py-2">Loan ID</th>
                <th className="px-4 py-2">Lender</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Rate</th>
                <th className="px-4 py-2">Start Date</th>
                <th className="px-4 py-2">Maturity Date</th>
                <th className="px-4 py-2">Remaining</th>
                <th className="px-4 py-2">Monthly</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">AI Suggestion</th>
              </tr>
            </thead>
            <tbody>
              {loanTableData.map((row, i) => (
                <tr key={i} className="border-b hover:bg-sky-50">
                  <td className="px-4 py-2 font-medium">{row.loanId}</td>
                  <td className="px-4 py-2">{row.lender}</td>
                  <td className="px-4 py-2">{row.amount}</td>
                  <td className={`px-4 py-2 ${
                    parseFloat(row.rate.replace('%', '')) < 5 ? "text-green-500" : 
                    parseFloat(row.rate.replace('%', '')) < 6.5 ? "text-amber-500" : "text-red-500"
                  }`}>{row.rate}</td>
                  <td className="px-4 py-2">{row.startDate}</td>
                  <td className="px-4 py-2">{row.maturityDate}</td>
                  <td className="px-4 py-2">{row.remaining}</td>
                  <td className="px-4 py-2">{row.monthly}</td>
                  <td className="px-4 py-2">{row.status}</td>
                  <td className="px-4 py-2 text-x text-gray-600">{row.suggestion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Risk Metrics */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">Risk & Coverage Metrics</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {riskMetrics.map((metric, i) => (
  <div key={i} className="bg-sky-50 p-3 rounded-lg">
    <p className="text-x font-semibold text-sky-700">{metric.metric}</p>
    <div className="flex items-end mt-1">
      <p className="text-lg font-bold text-sky-900">{metric.value}</p>
      <p className={`text-x ml-2 ${
        metric.trend.startsWith("+") ? "text-green-600" : "text-red-500"
      }`}>
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

export default DebtCoverage;
