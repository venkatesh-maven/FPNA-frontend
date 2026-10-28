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
  FiDollarSign,
  FiPieChart,
  FiDownload,
  FiSearch,
  FiChevronDown,
  FiSend,
  FiAlertCircle
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

const BudgetUtilization= () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    timePeriod: "Current Quarter",
    department: "All Departments",
    riskLevel: "All Levels"
  });
  const [showFilters, setShowFilters] = useState(false);
  const [aiInput, setAiInput] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const [dropdownWidget, setDropdownWidget] = useState(null);
  const filtersRef = useRef(null);

  // Sample data for budget metrics
  const budgetData = {
    departments: ["HR", "Marketing", "IT", "Operations", "Finance", "R&D"],
    budgetVsActual: {
      labels: ["HR", "Marketing", "IT", "Operations", "Finance", "R&D"],
      datasets: [
        {
          label: "Budgeted (₹L)",
          data: [50, 80, 100, 120, 60, 90],
          backgroundColor: "rgba(59, 130, 246, 0.7)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 1
        },
        {
          label: "Actual Spend (₹L)",
          data: [47, 86, 92, 115, 51, 95],
          backgroundColor: "rgba(16, 185, 129, 0.7)",
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 1
        },
        {
          label: "Forecasted (₹L)",
          data: [58, 92, 103, 135, 55, 105],
          backgroundColor: "rgba(239, 68, 68, 0.7)",
          borderColor: "rgba(239, 68, 68, 1)",
          borderWidth: 1,
          borderDash: [5, 5],
          type: 'line',
          tension: 0.1
        }
      ]
    },
    varianceTrend: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"],
      datasets: [
        {
          label: "HR Variance (₹L)",
          data: [-2, -3, -5, -4, -3, -2.5, -3, -3.5],
          borderColor: "rgba(59, 130, 246, 1)",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          tension: 0.4,
          fill: false
        },
        {
          label: "Marketing Variance (₹L)",
          data: [3, 4, 5, 6, 5.5, 6, 6.5, 6],
          borderColor: "rgba(239, 68, 68, 1)",
          backgroundColor: "rgba(239, 68, 68, 0.1)",
          tension: 0.4,
          fill: false
        },
        {
          label: "IT Variance (₹L)",
          data: [-5, -6, -8, -7, -8, -8.5, -8, -8.5],
          borderColor: "rgba(234, 179, 8, 1)",
          backgroundColor: "rgba(234, 179, 8, 0.1)",
          tension: 0.4,
          fill: false
        },
        {
          label: "Forecast Trend",
          data: [null, null, null, null, null, null, -3.5, -4],
          borderColor: "rgba(59, 130, 246, 0.5)",
          backgroundColor: "rgba(59, 130, 246, 0.05)",
          borderDash: [5, 5],
          tension: 0.4,
          pointRadius: 0
        }
      ]
    }
  };

  const kpiData = [
    {
      title: "Total Budget",
      value: "₹50M",
      change: "+10%",
      isPositive: true,
      icon: <FiDollarSign />,
      description: "Total budget allocated this year",
      forecast: "₹55M next fiscal year",
      componentPath: "/finance-accounting-table"
    },
    {
      title: "Actual Spend",
      value: "₹48.6M",
      change: "+12%",
      isPositive: false,
      icon: <FiTrendingUp />,
      description: "Total actual spend YTD",
      forecast: "₹53.5M projected",
      componentPath: "/finance-accounting-table"
    },
    {
      title: "Avg Variance",
      value: "-2.8%",
      change: "+1.2%",
      isPositive: true,
      icon: <FiTrendingDown />,
      description: "Average variance across departments",
      forecast: "-3.5% projected",
      componentPath: "/finance-accounting-table"
    },
    {
      title: "Utilization Rate",
      value: "97.2%",
      change: "+2.5%",
      isPositive: false,
      icon: <FiPieChart />,
      description: "Average budget utilization",
      forecast: "102% projected",
      componentPath: "/finance-accounting-table"
    }
  ];

  const budgetTableData = [
    {
      department: "HR",
      budgeted: "₹5,00,000",
      actual: "₹4,70,000",
      variance: "-₹30,000",
      variancePct: "-6%",
      utilization: "94%",
      forecasted: "₹5,80,000",
      riskLevel: "High",
      aiSuggestion: "Review training vendor costs"
    },
    {
      department: "Marketing",
      budgeted: "₹8,00,000",
      actual: "₹8,60,000",
      variance: "+₹60,000",
      variancePct: "+7.5%",
      utilization: "107.5%",
      forecasted: "₹9,20,000",
      riskLevel: "Medium",
      aiSuggestion: "Cut ad budget for Q4 campaigns"
    },
    {
      department: "IT",
      budgeted: "₹10,00,000",
      actual: "₹9,20,000",
      variance: "-₹80,000",
      variancePct: "-8%",
      utilization: "92%",
      forecasted: "₹10,30,000",
      riskLevel: "Low",
      aiSuggestion: "Allocate extra to cloud infrastructure"
    },
    {
      department: "Operations",
      budgeted: "₹12,00,000",
      actual: "₹11,50,000",
      variance: "-₹50,000",
      variancePct: "-4.2%",
      utilization: "95.8%",
      forecasted: "₹13,50,000",
      riskLevel: "Medium",
      aiSuggestion: "Optimize logistics routes"
    },
    {
      department: "Finance",
      budgeted: "₹6,00,000",
      actual: "₹5,10,000",
      variance: "-₹90,000",
      variancePct: "-15%",
      utilization: "85%",
      forecasted: "₹5,50,000",
      riskLevel: "Low",
      aiSuggestion: "Reallocate surplus to high-performing departments"
    },
    {
      department: "R&D",
      budgeted: "₹9,00,000",
      actual: "₹9,50,000",
      variance: "+₹50,000",
      variancePct: "+5.6%",
      utilization: "105.6%",
      forecasted: "₹10,50,000",
      riskLevel: "High",
      aiSuggestion: "Prioritize projects with highest ROI"
    }
  ];

  const utilizationHeatmap = [
    {
      department: "HR",
      jan: "85%",
      feb: "88%",
      mar: "92%",
      apr: "90%",
      may: "93%",
      jun: "94%",
      jul: "95%",
      aug: "96%"
    },
    {
      department: "Marketing",
      jan: "98%",
      feb: "102%",
      mar: "105%",
      apr: "104%",
      may: "106%",
      jun: "107%",
      jul: "108%",
      aug: "107.5%"
    },
    {
      department: "IT",
      jan: "88%",
      feb: "89%",
      mar: "90%",
      apr: "91%",
      may: "91.5%",
      jun: "92%",
      jul: "92.5%",
      aug: "92%"
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
                    <div 
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer" 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        navigate(componentPath); 
                        setDropdownWidget(null); 
                      }}
                    >
                      Analyze
                    </div>
                    <div 
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Implement export functionality
                        console.log(`Exporting ${title} data`);
                        setDropdownWidget(null);
                      }}
                    >
                      Export Data
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

  const getRiskLevelColor = (level) => {
    switch (level.toLowerCase()) {
      case "high": return "bg-red-100 text-red-800";
      case "medium": return "bg-amber-100 text-amber-800";
      case "low": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getUtilizationColor = (value) => {
    const percent = parseFloat(value);
    if (percent < 90) return "bg-green-100 text-green-800";
    if (percent <= 100) return "bg-amber-100 text-amber-800";
    return "bg-red-100 text-red-800";
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
              <Link to="/finance-accounting-dashboard" className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                Finance Dashboard
              </Link>
            </div>
          </li>
          <li aria-current="page">
            <div className="flex items-center">
              <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Budget Utilization</span>
            </div>
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Budget Utilization & Variance Reports</h1>
            <p className="text-sky-100 text-x">Track spending against budgets, identify variances</p>
            <p className="text-sky-100 text-x mt-1">Data showing from 01/04/24 - 30/09/24 (Current Fiscal Year)</p>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Time Period</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.timePeriod}
                onChange={(e) => setFilters({...filters, timePeriod: e.target.value})}
              >
                <option>Current Quarter</option>
                <option>Current Month</option>
                <option>Year to Date</option>
                <option>Last Fiscal Year</option>
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
                <option>HR</option>
                <option>Marketing</option>
                <option>IT</option>
                <option>Operations</option>
                <option>Finance</option>
                <option>R&D</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Risk Level</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.riskLevel}
                onChange={(e) => setFilters({...filters, riskLevel: e.target.value})}
              >
                <option>All Levels</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <FiSearch className="text-gray-400" />
                </div>
                <input 
                  type="text" 
                  className="w-full p-2 pl-10 border border-gray-300 rounded-md text-s" 
                  placeholder="Search departments..." 
                />
              </div>
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
        {/* Budget vs Actual */}
        <EnhancedChartCard 
          title="Department Budget vs Actual Spend" 
          chartType="bar" 
          chartData={{
            data: budgetData.budgetVsActual,
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
          widgetId="budgetVsActual" 
          index={0} 
          componentPath="/finance-accounting-table" 
        />

        {/* Variance Trend */}
        <EnhancedChartCard 
          title="Variance Trend Over Time" 
          chartType="line" 
          chartData={{
            data: budgetData.varianceTrend,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom' }
              },
              scales: {
                y: {
                  title: {
                    display: true,
                    text: 'Variance (₹L)'
                  }
                }
              }
            }
          }} 
          widgetId="varianceTrend" 
          index={1} 
          componentPath="/finance-accounting-table" 
        />
      </div>

      {/* Budget Utilization Table */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">Department Budget Utilization</h3>
          <div className="flex space-x-2">
            <button 
              className="flex items-center text-x text-sky-600 hover:text-sky-800"
              onClick={() => navigate("/finance-accounting-table-detail")}
            >
              View Details <FiChevronDown className="ml-1" />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-s text-left text-gray-700">
            <thead className="text-x text-sky-700 uppercase bg-sky-50">
              <tr>
                <th className="px-4 py-2">Department</th>
                <th className="px-4 py-2">Budgeted (₹)</th>
                <th className="px-4 py-2">Actual Spend (₹)</th>
                <th className="px-4 py-2">Variance (₹)</th>
                <th className="px-4 py-2">Variance (%)</th>
                <th className="px-4 py-2">Utilization</th>
                <th className="px-4 py-2">Forecasted (₹)</th>
                <th className="px-4 py-2">Risk Level</th>
                <th className="px-4 py-2">AI Suggestion</th>
              </tr>
            </thead>
            <tbody>
              {budgetTableData.map((row, i) => (
                <tr key={i} className="border-b hover:bg-sky-50">
                  <td className="px-4 py-2 font-medium">{row.department}</td>
                  <td className="px-4 py-2">{row.budgeted}</td>
                  <td className="px-4 py-2">{row.actual}</td>
                  <td className={`px-4 py-2 ${row.variance.startsWith('+') ? "text-red-500" : "text-green-500"}`}>
                    {row.variance}
                  </td>
                  <td className={`px-4 py-2 ${row.variancePct.startsWith('+') ? "text-red-500" : "text-green-500"}`}>
                    {row.variancePct}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded-full text-x ${getUtilizationColor(row.utilization)}`}>
                      {row.utilization}
                    </span>
                  </td>
                  <td className="px-4 py-2">{row.forecasted}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded-full text-x ${getRiskLevelColor(row.riskLevel)}`}>
                      {row.riskLevel}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-x text-gray-600 flex items-center">
                    <FiAlertCircle className="mr-1 text-amber-500" />
                    {row.aiSuggestion}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Utilization Heatmap */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">Monthly Utilization Heatmap</h3>
          <button 
            className="flex items-center text-x text-sky-600 hover:text-sky-800"
            onClick={() => navigate("/utilization-heatmap")}
          >
            View Full Heatmap <FiChevronDown className="ml-1" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-s text-left text-gray-700">
            <thead className="text-x text-sky-700 uppercase bg-sky-50">
              <tr>
                <th className="px-4 py-2">Department</th>
                <th className="px-4 py-2">Jan</th>
                <th className="px-4 py-2">Feb</th>
                <th className="px-4 py-2">Mar</th>
                <th className="px-4 py-2">Apr</th>
                <th className="px-4 py-2">May</th>
                <th className="px-4 py-2">Jun</th>
                <th className="px-4 py-2">Jul</th>
                <th className="px-4 py-2">Aug</th>
              </tr>
            </thead>
            <tbody>
              {utilizationHeatmap.map((row, i) => (
                <tr key={i} className="border-b hover:bg-sky-50">
                  <td className="px-4 py-2 font-medium">{row.department}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded-full text-x ${getUtilizationColor(row.jan)}`}>
                      {row.jan}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded-full text-x ${getUtilizationColor(row.feb)}`}>
                      {row.feb}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded-full text-x ${getUtilizationColor(row.mar)}`}>
                      {row.mar}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded-full text-x ${getUtilizationColor(row.apr)}`}>
                      {row.apr}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded-full text-x ${getUtilizationColor(row.may)}`}>
                      {row.may}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded-full text-x ${getUtilizationColor(row.jun)}`}>
                      {row.jun}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded-full text-x ${getUtilizationColor(row.jul)}`}>
                      {row.jul}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded-full text-x ${getUtilizationColor(row.aug)}`}>
                      {row.aug}
                    </span>
                  </td>
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
                            placeholder="Ask about churn patterns, retention strategies..."
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-sky-50 p-3 rounded-lg">
                        <h4 className="text-s font-medium text-sky-800 mb-2">High Risk Segment</h4>
                        <p className="text-x text-gray-700">Startups have the highest churn rate at 8.5%. Consider adding onboarding support or tailored pricing for this segment.</p>
                      </div>
                      <div className="bg-sky-50 p-3 rounded-lg">
                        <h4 className="text-s font-medium text-sky-800 mb-2">Q3 Churn Spike</h4>
                        <p className="text-x text-gray-700">August saw 8.2% churn, likely due to competitor promotions. Recommend loyalty incentives during this period.</p>
                      </div>
                      <div className="bg-sky-50 p-3 rounded-lg">
                        <h4 className="text-s font-medium text-sky-800 mb-2">Retention Opportunity</h4>
                        <p className="text-x text-gray-700">Customers reaching 18 months show 92% retention. Consider extending contracts at this milestone.</p>
                      </div>
                    </div>
                  </div>
            
                  <ReactTooltip id="chart-type-tooltip" place="top" effect="solid" />
                  <ReactTooltip id="ai-tooltip" place="top" effect="solid" />
                </div>
              );
            };
            
            export default BudgetUtilization;