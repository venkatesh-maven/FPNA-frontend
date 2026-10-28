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
  FiPieChart,
  FiChevronDown,
  FiSend,
  FiDownload
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

const ExpenseTrendAnalysis = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    timePeriod: "Last Quarter",
    department: "All Departments",
    category: "All Categories",
    expenseType: "All Types",
    variance: "All"
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedChartType, setSelectedChartType] = useState({
    expenseTrend: "line",
    topCategories: "bar"
  });
  const [aiInput, setAiInput] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const filtersRef = useRef(null);

  // Sample data for expense metrics
  const expenseData = {
    expenseTrend: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"],
      datasets: [
        {
          label: "Actual Spend (₹L)",
          data: [85, 92, 105, 120, 115, 125, 130, 135],
          backgroundColor: "rgba(59, 130, 246, 0.2)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 2,
          tension: 0.4
        },
        {
          label: "Budget (₹L)",
          data: [80, 85, 90, 95, 100, 105, 110, 115],
          backgroundColor: "rgba(16, 185, 129, 0.2)",
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.1
        },
        {
          label: "AI Forecast",
          data: [null, null, null, null, null, null, 130, 135],
          backgroundColor: "rgba(139, 92, 246, 0.1)",
          borderColor: "rgba(139, 92, 246, 0.5)",
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.4,
          pointRadius: 0
        }
      ]
    },
    topCategories: {
      labels: ["Marketing", "IT Infra", "Salaries", "Travel", "Office Supplies"],
      datasets: [
        {
          label: "Spend (₹L)",
          data: [40, 28, 25, 18, 12],
          backgroundColor: [
            "rgba(239, 68, 68, 0.7)",
            "rgba(59, 130, 246, 0.7)",
            "rgba(16, 185, 129, 0.7)",
            "rgba(234, 179, 8, 0.7)",
            "rgba(139, 92, 246, 0.7)"
          ],
          borderColor: [
            "rgba(239, 68, 68, 1)",
            "rgba(59, 130, 246, 1)",
            "rgba(16, 185, 129, 1)",
            "rgba(234, 179, 8, 1)",
            "rgba(139, 92, 246, 1)"
          ],
          borderWidth: 1
        }
      ]
    },
    departmentSpend: {
      labels: ["Sales", "Marketing", "IT", "HR", "Finance", "Operations"],
      datasets: [
        {
          label: "Q1 Spend (₹L)",
          data: [25, 35, 20, 15, 12, 18],
          backgroundColor: "rgba(59, 130, 246, 0.7)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 1
        },
        {
          label: "Q2 Spend (₹L)",
          data: [28, 40, 22, 18, 15, 20],
          backgroundColor: "rgba(16, 185, 129, 0.7)",
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 1
        }
      ]
    },
    budgetVariance: {
      labels: ["Sales", "Marketing", "IT", "HR", "Finance"],
      datasets: [
        {
          label: "Budget (₹L)",
          data: [28, 35, 20, 15, 12],
          backgroundColor: "rgba(16, 185, 129, 0.7)",
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 1
        },
        {
          label: "Actual (₹L)",
          data: [30, 40, 22, 18, 15],
          backgroundColor: "rgba(239, 68, 68, 0.7)",
          borderColor: "rgba(239, 68, 68, 1)",
          borderWidth: 1
        }
      ]
    }
  };

  const kpiData = [
    {
      title: "Total Expenses",
      value: "₹1.2 Cr",
      change: "+12.4%",
      isPositive: false,
      icon: <FiDollarSign />,
      description: "This quarter's total spend",
      forecast: "₹1.35 Cr predicted next quarter",
      componentPath: "/finance-accounting-table"
    },
    {
      title: "Top Spending Category",
      value: "Marketing - ₹40L",
      change: "+18%",
      isPositive: false,
      icon: <FiPieChart />,
      description: "Highest spend category",
      forecast: "₹48L predicted next quarter",
      componentPath: "/finance-accounting-table"
    },
    {
      title: "Variance vs Budget",
      value: "+8.6%",
      change: "+2.1%",
      isPositive: false,
      icon: <FiTrendingUp />,
      description: "Over budget this quarter",
      forecast: "May reach +12% variance",
      componentPath: "/finance-accounting-table"
    },
    {
      title: "Cost per ₹1L Revenue",
      value: "₹9,400",
      change: "-3.2%",
      isPositive: true,
      icon: <FiTrendingDown />,
      description: "Efficiency metric",
      forecast: "₹9,100 predicted next quarter",
      componentPath: "/finance-accounting-table"
    }
  ];

  const expenseTableData = [
    {
      date: "10-May-25",
      department: "Marketing",
      category: "Advertising",
      description: "Paid Google Ad campaign",
      amount: "₹2,50,000",
      budget: "₹2,00,000",
      variance: "+25%",
      recurring: "Yes",
      status: "Over Budget",
      aiInsight: "High ROI, but overspent"
    },
    {
      date: "05-May-25",
      department: "IT",
      category: "SaaS Subscriptions",
      description: "Slack & Zoom renewal",
      amount: "₹95,000",
      budget: "₹1,00,000",
      variance: "-5%",
      recurring: "Yes",
      status: "On Track",
      aiInsight: "Consider annual billing"
    },
    {
      date: "02-May-25",
      department: "HR",
      category: "Recruitment",
      description: "LinkedIn job posts",
      amount: "₹80,000",
      budget: "₹50,000",
      variance: "+60%",
      recurring: "No",
      status: "Over Budget",
      aiInsight: "High surge in hiring"
    },
    {
      date: "01-May-25",
      department: "Sales",
      category: "Travel",
      description: "Client visit to Mumbai",
      amount: "₹45,000",
      budget: "₹30,000",
      variance: "+50%",
      recurring: "No",
      status: "Over Budget",
      aiInsight: "Reduce in-person travel"
    },
    {
      date: "28-Apr-25",
      department: "Finance",
      category: "Software",
      description: "QuickBooks renewal",
      amount: "₹75,000",
      budget: "₹70,000",
      variance: "+7%",
      recurring: "Yes",
      status: "On Track",
      aiInsight: "Price increased by vendor"
    }
  ];

  const aiRecommendations = [
    {
      title: "Marketing Budget Alert",
      content: "Marketing has exceeded budget 4 months in a row. Suggest reallocation or capping.",
      severity: "high"
    },
    {
      title: "SaaS Cost Optimization",
      content: "SaaS expenses could be cut by 15% with annual plans instead of monthly.",
      severity: "medium"
    },
    {
      title: "Travel Cost Reduction",
      content: "Sales team travel cost per client is high. Consider more virtual meetings.",
      severity: "medium"
    },
    {
      title: "Software License Audit",
      content: "80% of recurring software licenses haven't been renegotiated in 12 months.",
      severity: "low"
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
              <span className="text-[10px] font-medium">{change} {isPositive ? "↓" : "↑"} vs last period</span>
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
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Expense Trend Analysis</span>
            </div>
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Expense Trend Analysis</h1>
            <p className="text-sky-100 text-x">Track spending patterns, budget variances, and cost optimization</p>
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
              type="button" 
              className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200"
            >
              <FiDownload className="mr-1" /> Export
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Time Period</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.timePeriod}
                onChange={(e) => setFilters({...filters, timePeriod: e.target.value})}
              >
                <option>Last Quarter</option>
                <option>Last Month</option>
                <option>Last Week</option>
                <option>Year to Date</option>
                <option>Custom Range</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Department</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.department}
                onChange={(e) => setFilters({...filters, department: e.target.value})}
              >
                <option>All Departments</option>
                <option>Sales</option>
                <option>Marketing</option>
                <option>IT</option>
                <option>HR</option>
                <option>Finance</option>
                <option>Operations</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Category</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.category}
                onChange={(e) => setFilters({...filters, category: e.target.value})}
              >
                <option>All Categories</option>
                <option>Advertising</option>
                <option>SaaS Subscriptions</option>
                <option>Recruitment</option>
                <option>Travel</option>
                <option>Software</option>
                <option>Office Supplies</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Expense Type</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.expenseType}
                onChange={(e) => setFilters({...filters, expenseType: e.target.value})}
              >
                <option>All Types</option>
                <option>Recurring</option>
                <option>One-time</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Variance</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.variance}
                onChange={(e) => setFilters({...filters, variance: e.target.value})}
              >
                <option>All</option>
                <option>Over Budget Only</option>
                <option>Under Budget</option>
                <option>Within Budget</option>
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
        {/* Expense Trend */}
        <EnhancedChartCard 
          title="Expense Trend with Budget & Forecast" 
          chartType={selectedChartType.expenseTrend} 
          chartData={{
            data: expenseData.expenseTrend,
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
                    text: 'Amount (₹L)'
                  }
                }
              }
            }
          }} 
          widgetId="expenseTrend" 
          index={0} 
          componentPath="/finance-accounting-table" 
        />

        {/* Top Categories */}
        <EnhancedChartCard 
          title="Top 5 Spending Categories" 
          chartType={selectedChartType.topCategories} 
          chartData={{
            data: expenseData.topCategories,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      return `${context.label}: ₹${context.raw}L`;
                    }
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: 'Amount (₹L)'
                  }
                }
              }
            }
          }} 
          widgetId="topCategories" 
          index={1} 
          componentPath="/finance-accounting-table" 
        />
      </div>

      {/* Secondary Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Spend */}
        <EnhancedChartCard 
          title="Department Spend Comparison (Q1 vs Q2)" 
          chartType="bar" 
          chartData={{
            data: expenseData.departmentSpend,
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
                    text: 'Amount (₹L)'
                  }
                }
              }
            }
          }} 
          widgetId="departmentSpend" 
          index={2} 
          componentPath="/finance-accounting-table" 
        />

        {/* Budget vs Actual */}
        <EnhancedChartCard 
          title="Budget vs Actual Variance by Department" 
          chartType="bar" 
          chartData={{
            data: expenseData.budgetVariance,
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
                    text: 'Amount (₹L)'
                  }
                }
              }
            }
          }} 
          widgetId="budgetVariance" 
          index={3} 
          componentPath="/finance-accounting-table" 
        />
      </div>

      {/* AI Recommendations Section */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">AI Insights & Cost Optimization</h3>
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
                placeholder="Ask about expense trends, optimization..."
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
            <div key={i} className={`p-3 rounded-lg border ${
              rec.severity === "high" ? "border-red-200 bg-red-50" :
              rec.severity === "medium" ? "border-amber-200 bg-amber-50" :
              "border-green-200 bg-green-50"
            }`}>
              <h4 className="text-s font-medium text-sky-800 mb-1">{rec.title}</h4>
              <p className="text-x text-gray-700">{rec.content}</p>
              <div className="mt-2 text-right">
                <span className={`text-x px-2 py-1 rounded ${
                  rec.severity === "high" ? "bg-red-100 text-red-800" :
                  rec.severity === "medium" ? "bg-amber-100 text-amber-800" :
                  "bg-green-100 text-green-800"
                }`}>
                  {rec.severity === "high" ? "Urgent" : rec.severity === "medium" ? "Warning" : "Suggestion"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Expense Details Table */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">Expense Details</h3>
          <button 
            className="flex items-center text-x text-sky-600 hover:text-sky-800"
            onClick={() => navigate("/expense-details")}
          >
            View All Expenses <FiChevronDown className="ml-1" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-s text-left text-gray-700">
            <thead className="text-x text-sky-700 uppercase bg-sky-50">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Department</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Budget</th>
                <th className="px-4 py-2">Variance</th>
                <th className="px-4 py-2">Recurring</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">AI Insight</th>
              </tr>
            </thead>
            <tbody>
              {expenseTableData.map((expense, i) => (
                <tr key={i} className="border-b border-gray-200 hover:bg-sky-50">
                  <td className="px-4 py-2 text-x">{expense.date}</td>
                  <td className="px-4 py-2 text-x">{expense.department}</td>
                  <td className="px-4 py-2 text-x">{expense.category}</td>
                  <td className="px-4 py-2 text-x">{expense.description}</td>
                  <td className="px-4 py-2 text-x font-medium">{expense.amount}</td>
                  <td className="px-4 py-2 text-x">{expense.budget}</td>
                  <td className={`px-4 py-2 text-x font-medium ${
                    expense.variance.includes('+') ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {expense.variance}
                  </td>
                  <td className="px-4 py-2 text-x">
                    <span className={`px-2 py-1 rounded-full ${
                      expense.recurring === 'Yes' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {expense.recurring}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-x">
                    <span className={`px-2 py-1 rounded-full ${
                      expense.status === 'Over Budget' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {expense.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-x text-gray-600 italic">
                    {expense.aiInsight}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tooltips */}
      <ReactTooltip id="ai-tooltip" place="top" effect="solid" />
      <ReactTooltip id="chart-type-tooltip" place="top" effect="solid" />
    </div>
  );
};

export default ExpenseTrendAnalysis;