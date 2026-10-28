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
  FiUsers,
  FiChevronDown,
  FiSend,
  FiPieChart,
  FiDollarSign
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

const RetentionAttritionRate = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    timePeriod: "Last Quarter",
    department: "All Departments",
    roleLevel: "All Levels",
    turnoverType: "All Types"
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedChartType, setSelectedChartType] = useState({
    attritionTrend: "line",
    attritionByDept: "bar"
  });
  const [aiInput, setAiInput] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const filtersRef = useRef(null);

  // Sample data for attrition metrics
  const attritionData = {
    attritionTrend: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"],
      datasets: [
        {
          label: "Attrition Rate (%)",
          data: [12.5, 13.2, 14.8, 15.1, 14.3, 13.7, 14.2, 14.6],
          backgroundColor: "rgba(239, 68, 68, 0.2)",
          borderColor: "rgba(239, 68, 68, 1)",
          borderWidth: 2,
          tension: 0.4
        },
        {
          label: "AI Forecast",
          data: [null, null, null, null, null, null, 14.2, 14.6],
          backgroundColor: "rgba(239, 68, 68, 0.1)",
          borderColor: "rgba(239, 68, 68, 0.5)",
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.4,
          pointRadius: 0
        }
      ]
    },
    attritionByDept: {
      labels: ["Tech", "Sales", "HR", "Support", "Marketing", "Finance"],
      datasets: [
        {
          label: "Attrition Rate (%)",
          data: [18.2, 15.7, 12.3, 11.8, 10.5, 9.2],
          backgroundColor: [
            "rgba(239, 68, 68, 0.7)",
            "rgba(234, 179, 8, 0.7)",
            "rgba(234, 179, 8, 0.7)",
            "rgba(16, 185, 129, 0.7)",
            "rgba(16, 185, 129, 0.7)",
            "rgba(16, 185, 129, 0.7)"
          ],
          borderColor: [
            "rgba(239, 68, 68, 1)",
            "rgba(234, 179, 8, 1)",
            "rgba(234, 179, 8, 1)",
            "rgba(16, 185, 129, 1)",
            "rgba(16, 185, 129, 1)",
            "rgba(16, 185, 129, 1)"
          ],
          borderWidth: 1
        }
      ]
    },
    turnoverByRoleLevel: {
      labels: ["Junior", "Mid-Level", "Senior", "Leadership"],
      datasets: [{
        label: "Turnover Distribution",
        data: [45, 30, 20, 5],
        backgroundColor: [
          "rgba(239, 68, 68, 0.7)",
          "rgba(234, 179, 8, 0.7)",
          "rgba(59, 130, 246, 0.7)",
          "rgba(139, 92, 246, 0.7)"
        ],
        borderColor: [
          "rgba(239, 68, 68, 1)",
          "rgba(234, 179, 8, 1)",
          "rgba(59, 130, 246, 1)",
          "rgba(139, 92, 246, 1)"
        ],
        borderWidth: 1
      }]
    },
    retentionHeatmap: {
      labels: ["Tech", "Sales", "HR", "Support", "Marketing"],
      datasets: [
        {
          label: "Jan",
          data: [15, 12, 8, 7, 6],
          backgroundColor: "rgba(239, 68, 68, 0.7)"
        },
        {
          label: "Feb",
          data: [14, 11, 7, 6, 5],
          backgroundColor: "rgba(239, 68, 68, 0.6)"
        },
        {
          label: "Mar",
          data: [18, 14, 9, 8, 7],
          backgroundColor: "rgba(239, 68, 68, 0.8)"
        },
        {
          label: "Apr",
          data: [16, 13, 8, 7, 6],
          backgroundColor: "rgba(239, 68, 68, 0.7)"
        },
        {
          label: "May",
          data: [12, 10, 6, 5, 4],
          backgroundColor: "rgba(234, 179, 8, 0.7)"
        },
        {
          label: "Jun",
          data: [10, 8, 5, 4, 3],
          backgroundColor: "rgba(16, 185, 129, 0.7)"
        }
      ]
    }
  };

  const kpiData = [
    {
      title: "Overall Attrition Rate",
      value: "14.2%",
      change: "+1.8%",
      isPositive: false,
      icon: <FiTrendingUp />,
      description: "Percentage of employees who left",
      forecast: "15.7% by next quarter",
      componentPath: "/hr-workforce-table"
    },
    {
      title: "Voluntary Turnover",
      value: "9.6%",
      change: "-0.5%",
      isPositive: true,
      icon: <FiTrendingDown />,
      description: "Employees who resigned voluntarily",
      forecast: "9.1% if current trend holds",
      componentPath: "/hr-workforce-table"
    },
    {
      title: "Avg. Tenure",
      value: "22.3 mo",
      change: "+1.2",
      isPositive: true,
      icon: <FiUsers />,
      description: "Average time before exit",
      forecast: "24 months forecasted",
      componentPath: "/hr-workforce-table"
    },
    {
      title: "High-risk Roles",
      value: "6 roles",
      change: "—",
      isPositive: null,
      icon: <FiPieChart />,
      description: "Roles with highest attrition risk",
      forecast: "3 new roles flagged this Q",
      componentPath: "/hr-workforce-table"
    },
    {
      title: "Rehire Cost",
      value: "₹85,000",
      change: "↑ ₹4,000",
      isPositive: false,
      icon: <FiDollarSign />,
      description: "Average cost to replace employee",
      forecast: "₹92,000 next quarter",
      componentPath: "/hr-workforce-table"
    }
  ];

  const turnoverTableData = [
    {
      name: "S. Patel",
      department: "Tech",
      role: "Backend Dev",
      exitDate: "01-May-25",
      tenure: 14,
      reason: "Better offer",
      voluntary: true,
      replacementStatus: "Pending",
      aiSuggestion: "Reassign current juniors"
    },
    {
      name: "A. Sharma",
      department: "HR",
      role: "Recruiter",
      exitDate: "15-Apr-25",
      tenure: 9,
      reason: "Burnout",
      voluntary: true,
      replacementStatus: "Hired",
      aiSuggestion: "Add mental health sessions"
    },
    {
      name: "R. Rao",
      department: "Sales",
      role: "Manager",
      exitDate: "28-Mar-25",
      tenure: 26,
      reason: "Retirement",
      voluntary: false,
      replacementStatus: "Filled",
      aiSuggestion: "Transfer key clients to new lead"
    },
    {
      name: "P. Mehta",
      department: "Tech",
      role: "UI Designer",
      exitDate: "10-Apr-25",
      tenure: 18,
      reason: "Career change",
      voluntary: true,
      replacementStatus: "Interviewing",
      aiSuggestion: "Offer internal role transition"
    },
    {
      name: "K. Singh",
      department: "Support",
      role: "Team Lead",
      exitDate: "22-Feb-25",
      tenure: 32,
      reason: "Relocation",
      voluntary: true,
      replacementStatus: "Promoted internally",
      aiSuggestion: "Create remote work option"
    }
  ];

  const engagementMetrics = [
    {
      metric: "Engagement Score",
      value: "72%",
      trend: "+3%",
      benchmark: "Industry: 68%"
    },
    {
      metric: "Exit Interviews",
      value: "85%",
      trend: "+5%",
      benchmark: "Target: 90%"
    },
    {
      metric: "Promotion Rate",
      value: "12%",
      trend: "+2%",
      benchmark: "Industry: 10%"
    },
    {
      metric: "Regretted Losses",
      value: "28%",
      trend: "-4%",
      benchmark: "Last year: 32%"
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
            <div className={`flex items-center mt-2 ${isPositive === null ? "text-gray-500" : isPositive ? "text-green-500" : "text-red-500"}`}>
              <span className="text-[10px] font-medium">{change} {isPositive === null ? "" : isPositive ? "↑" : "↓"} vs last period</span>
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
              <Link to="/hr-workforce" className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                HR Analytics
              </Link>
            </div>
          </li>
          <li aria-current="page">
            <div className="flex items-center">
              <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Retention & Attrition</span>
            </div>
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Retention & Attrition Rate Analysis</h1>
            <p className="text-sky-100 text-x">Employee Turnover Trends & Risk Identification</p>
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
            <Link to="/hr-workforce-table">
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
                <option>Last Month</option>
                <option>Last 6 Months</option>
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
                <option>Tech</option>
                <option>Sales</option>
                <option>HR</option>
                <option>Support</option>
                <option>Marketing</option>
                <option>Finance</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Role Level</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.roleLevel}
                onChange={(e) => setFilters({...filters, roleLevel: e.target.value})}
              >
                <option>All Levels</option>
                <option>Junior</option>
                <option>Mid-Level</option>
                <option>Senior</option>
                <option>Leadership</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Turnover Type</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.turnoverType}
                onChange={(e) => setFilters({...filters, turnoverType: e.target.value})}
              >
                <option>All Types</option>
                <option>Voluntary</option>
                <option>Involuntary</option>
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
        {/* Attrition Trend */}
        <EnhancedChartCard 
          title="Monthly Attrition Trend with AI Forecast" 
          chartType={selectedChartType.attritionTrend} 
          chartData={{
            data: attritionData.attritionTrend,
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
                    text: 'Attrition Rate (%)'
                  }
                }
              }
            }
          }} 
          widgetId="attritionTrend" 
          index={0} 
          componentPath="/hr-workforce-table" 
        />

        {/* Attrition by Department */}
        <EnhancedChartCard 
          title="Attrition by Department" 
          chartType={selectedChartType.attritionByDept} 
          chartData={{
            data: attritionData.attritionByDept,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              indexAxis: 'y',
              plugins: {
                legend: { display: false }
              },
              scales: {
                x: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: 'Attrition Rate (%)'
                  }
                }
              }
            }
          }} 
          widgetId="attritionByDept" 
          index={1} 
          componentPath="/hr-workforce-table" 
        />
      </div>

      {/* Secondary Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Turnover by Role Level */}
        <EnhancedChartCard 
          title="Turnover Distribution by Role Level" 
          chartType="doughnut" 
          chartData={{
            data: attritionData.turnoverByRoleLevel,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'right' },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      return `${context.label}: ${context.raw}% of turnover`;
                    }
                  }
                }
              }
            }
          }} 
          widgetId="turnoverByRoleLevel" 
          index={2} 
          componentPath="/hr-workforce-table" 
        />

        {/* Retention Heatmap */}
        <EnhancedChartCard 
          title="Retention Heat Map by Department" 
          chartType="bar" 
          chartData={{
            data: attritionData.retentionHeatmap,
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
                    text: 'Attrition Rate (%)'
                  }
                }
              }
            }
          }} 
          widgetId="retentionHeatmap" 
          index={3} 
          componentPath="/hr-workforce-table" 
        />
      </div>

      {/* Turnover Events Table */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">Turnover Events</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-s text-left text-gray-700">
            <thead className="text-x text-sky-700 uppercase bg-sky-50">
              <tr>
                <th className="px-4 py-2">Employee</th>
                <th className="px-4 py-2">Department</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Exit Date</th>
                <th className="px-4 py-2">Tenure (Months)</th>
                <th className="px-4 py-2">Reason</th>
                <th className="px-4 py-2">Voluntary?</th>
                <th className="px-4 py-2">Replacement Status</th>
                <th className="px-4 py-2">AI Suggestion</th>
              </tr>
            </thead>
            <tbody>
              {turnoverTableData.map((row, i) => (
                <tr key={i} className="border-b hover:bg-sky-50">
                  <td className="px-4 py-2 font-medium">{row.name}</td>
                  <td className="px-4 py-2">{row.department}</td>
                  <td className="px-4 py-2">{row.role}</td>
                  <td className="px-4 py-2">{row.exitDate}</td>
                  <td className={`px-4 py-2 ${
                    row.tenure < 12 ? "text-red-500" : 
                    row.tenure < 24 ? "text-amber-500" : "text-green-500"
                  }`}>{row.tenure}</td>
                  <td className="px-4 py-2">{row.reason}</td>
                  <td className={`px-4 py-2 ${row.voluntary ? "text-green-500" : "text-red-500"}`}>
                    {row.voluntary ? "✅ Yes" : "❌ No"}
                  </td>
                  <td className={`px-4 py-2 ${
                    row.replacementStatus === "Pending" ? "text-red-500" : 
                    row.replacementStatus === "Interviewing" ? "text-amber-500" : "text-green-500"
                  }`}>{row.replacementStatus}</td>
                  <td className="px-4 py-2 text-x">{row.aiSuggestion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Engagement Metrics */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">Engagement Metrics</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {engagementMetrics.map((metric, i) => (
            <div key={i} className="bg-sky-50 p-3 rounded-lg">
              <p className="text-x font-semibold text-sky-700">{metric.metric}</p>
              <div className="flex items-end mt-1">
                <p className="text-lg font-bold text-sky-900">{metric.value}</p>
                <p className={`text-x ml-2 ${metric.trend.startsWith('+') ? "text-green-500" : "text-red-500"}`}>
                  {metric.trend} vs last period
                </p>
              </div>
              <p className="text-x text-gray-500 mt-1">Benchmark: {metric.benchmark}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Recommendations Section */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">AI-Powered Retention Recommendations</h3>
          <div className="flex items-center space-x-2">
            <BsStars className="text-sky-600" />
            <span className="text-x text-sky-600">AI Generated</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg border-l-4 border-red-400">
            <div className="flex items-center mb-2">
              <div className="p-2 bg-red-200 rounded-full mr-3">
                <FiTrendingUp className="text-red-600" />
              </div>
              <div>
                <h4 className="text-s font-semibold text-red-800">High Risk Alert</h4>
                <p className="text-x text-red-600">Tech Department</p>
              </div>
            </div>
            <p className="text-x text-red-700 mb-2">
              18.2% attrition rate detected. Recommend immediate intervention with competitive compensation review and flexible work arrangements.
            </p>
            <div className="flex justify-between items-center">
              <span className="text-x bg-red-200 text-red-800 px-2 py-1 rounded-full">Priority: High</span>
              {/* <button className="text-x text-red-600 hover:text-red-800 font-medium">View Details →</button> */}
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-lg border-l-4 border-amber-400">
            <div className="flex items-center mb-2">
              <div className="p-2 bg-amber-200 rounded-full mr-3">
                <FiUsers className="text-amber-600" />
              </div>
              <div>
                <h4 className="text-s font-semibold text-amber-800">Career Development</h4>
                <p className="text-x text-amber-600">Junior Level Focus</p>
              </div>
            </div>
            <p className="text-x text-amber-700 mb-2">
              45% of turnover from junior roles. Implement mentorship programs and clear advancement pathways to improve retention.
            </p>
            <div className="flex justify-between items-center">
              <span className="text-x bg-amber-200 text-amber-800 px-2 py-1 rounded-full">Priority: Medium</span>
              {/* <button className="text-x text-amber-600 hover:text-amber-800 font-medium">View Details →</button> */}
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border-l-4 border-green-400">
            <div className="flex items-center mb-2">
              <div className="p-2 bg-green-200 rounded-full mr-3">
                <FiDollarSign className="text-green-600" />
              </div>
              <div>
                <h4 className="text-s font-semibold text-green-800">Cost Optimization</h4>
                <p className="text-x text-green-600">Rehire Costs</p>
              </div>
            </div>
            <p className="text-x text-green-700 mb-2">
              Focus on internal promotions and knowledge transfer. Potential savings of ₹2.5L per quarter through reduced rehire costs.
            </p>
            <div className="flex justify-between items-center">
              <span className="text-x bg-green-200 text-green-800 px-2 py-1 rounded-full">Impact: High</span>
              {/* <button className="text-x text-green-600 hover:text-green-800 font-medium">View Details →</button> */}
            </div>
          </div>
        </div>

        {/* Action Items */}
        <div className="mt-6 bg-sky-50 p-4 rounded-lg">
          <h4 className="text-s font-semibold text-sky-800 mb-3">Immediate Action Items</h4>
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <input type="checkbox" className="w-4 h-4 text-sky-600 bg-gray-100 border-gray-300 rounded focus:ring-sky-500" />
              <span className="text-x text-gray-700">Schedule one-on-one meetings with high-risk employees in Tech department</span>
              <span className="text-x bg-red-100 text-red-800 px-2 py-1 rounded-full ml-auto">Due: This Week</span>
            </div>
            <div className="flex items-center space-x-3">
              <input type="checkbox" className="w-4 h-4 text-sky-600 bg-gray-100 border-gray-300 rounded focus:ring-sky-500" />
              <span className="text-x text-gray-700">Review and update compensation packages for junior developers</span>
              <span className="text-x bg-amber-100 text-amber-800 px-2 py-1 rounded-full ml-auto">Due: Next Week</span>
            </div>
            <div className="flex items-center space-x-3">
              <input type="checkbox" className="w-4 h-4 text-sky-600 bg-gray-100 border-gray-300 rounded focus:ring-sky-500" />
              <span className="text-x text-gray-700">Launch mentorship program pilot for junior employees</span>
              <span className="text-x bg-green-100 text-green-800 px-2 py-1 rounded-full ml-auto">Due: This Month</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Panel */}
      {/* <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <h3 className="text-md font-semibold text-sky-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <button 
            onClick={() => navigate('/exit-interviews')}
            className="flex items-center justify-center p-3 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 transition-colors duration-200"
          >
            <FiUsers className="mr-2 text-sky-600" />
            <span className="text-s text-sky-700">Exit Interviews</span>
          </button>
          <button 
            onClick={() => navigate('/employee-surveys')}
            className="flex items-center justify-center p-3 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 transition-colors duration-200"
          >
            <FiPieChart className="mr-2 text-sky-600" />
            <span className="text-s text-sky-700">Employee Surveys</span>
          </button>
          <button 
            onClick={() => navigate('/retention-programs')}
            className="flex items-center justify-center p-3 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 transition-colors duration-200"
          >
            <FiTrendingUp className="mr-2 text-sky-600" />
            <span className="text-s text-sky-700">Retention Programs</span>
          </button>
          <button 
            onClick={() => navigate('/predictive-analytics')}
            className="flex items-center justify-center p-3 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 transition-colors duration-200"
          >
            <BsStars className="mr-2 text-sky-600" />
            <span className="text-s text-sky-700">AI Predictions</span>
          </button>
        </div>
      </div> */}

      {/* Tooltips */}
      <ReactTooltip id="chart-type-tooltip" place="top" effect="solid" />
      <ReactTooltip id="ai-tooltip" place="top" effect="solid" />
    </div>
  );
};

export default RetentionAttritionRate;