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
  FiUsers,
  FiDownload,
  FiAlertCircle,
  FiPieChart,
  FiDatabase,
  FiCalendar,
  FiChevronDown,
  FiSend
} from "react-icons/fi";
import { BsStars, BsThreeDotsVertical, BsLightningCharge } from "react-icons/bs";
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

const SoftwareLicenseUtilization = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    period: "Current Quarter",
    vendor: "All Vendors",
    department: "All Departments",
    status: "All Statuses"
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedChartType, setSelectedChartType] = useState({
    utilizationBySoftware: "bar",
    trendAnalysis: "line"
  });
  const [aiInput, setAiInput] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const filtersRef = useRef(null);

  // Financial-grade license data
  const licenseData = {
    kpis: [
      {
        title: "Total Licenses",
        value: "2,850",
        change: "+8%",
        isPositive: false,
        icon: <FiDatabase />,
        description: "Total software licenses owned",
        forecast: "2,900 predicted next quarter",
        financialImpact: null,
        componentPath: "/it-spend-table"
      },
      {
        title: "Active Ratio",
        value: "68%",
        change: "+3%",
        isPositive: true,
        icon: <FiUsers />,
        description: "Active licenses / Total licenses",
        forecast: "70% predicted next quarter",
        financialImpact: null,
        componentPath: "/it-spend-table"
      },
      {
        title: "Underutilized",
        value: "24",
        change: "-5",
        isPositive: true,
        icon: <FiAlertCircle />,
        description: "Software products <50% utilized",
        forecast: "20 predicted next quarter",
        financialImpact: null,
        componentPath: "/it-spend-table"
      },
      {
        title: "Wasted Spend",
        value: "$42K",
        change: "+$3K",
        isPositive: false,
        icon: <FiDollarSign />,
        description: "Monthly cost of inactive licenses",
        forecast: "$38K predicted next quarter",
        financialImpact: "$504K annualized",
        componentPath: "/it-spend-table"
      },
      {
        title: "Utilization Rate",
        value: "72%",
        change: "+2%",
        isPositive: true,
        icon: <FiPieChart />,
        description: "Overall license utilization",
        forecast: "74% predicted next quarter",
        financialImpact: "Benchmark: 80%",
        componentPath: "/it-spend-table"
      },
      {
        title: "Top Waste",
        value: "MS Office",
        change: "12% worse",
        isPositive: false,
        icon: <BsLightningCharge />,
        description: "Highest cost underutilization",
        forecast: "Adobe CC next quarter",
        financialImpact: "$15K/month",
        componentPath: "/it-spend-table"
      }
    ],
    utilizationBySoftware: {
      labels: ["MS Office", "Adobe CC", "Zoom", "Salesforce", "Slack", "AWS", "GSuite"],
      datasets: [{
        label: "Utilization %",
        data: [58, 72, 85, 68, 91, 78, 82],
        backgroundColor: [
          "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#14B8A6"
        ].map(c => `${c}80`),
        borderColor: [
          "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#14B8A6"
        ],
        borderWidth: 1
      }]
    },
    licenseDistribution: {
      labels: ["Active", "Inactive", "Unassigned"],
      datasets: [{
        data: [1938, 762, 150],
        backgroundColor: ["#10B981", "#EF4444", "#F59E0B"],
        borderColor: ["#059669", "#DC2626", "#D97706"],
        borderWidth: 1
      }]
    },
    departmentUtilization: {
      labels: ["Engineering", "Sales", "Marketing", "Finance", "HR", "Operations"],
      datasets: [
        {
          label: "Active",
          data: [420, 380, 210, 150, 120, 180],
          backgroundColor: "#10B981"
        },
        {
          label: "Inactive",
          data: [80, 120, 65, 45, 60, 55],
          backgroundColor: "#EF4444"
        },
        {
          label: "Unassigned",
          data: [25, 15, 10, 5, 20, 10],
          backgroundColor: "#F59E0B"
        }
      ]
    },
    utilizationTrend: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"],
      datasets: [
        {
          label: "Utilization Rate",
          data: [65, 68, 70, 69, 71, 72, 73, 72],
          borderColor: "#3B82F6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          tension: 0.3,
          fill: true
        },
        {
          label: "AI Forecast",
          data: [null, null, null, null, null, null, 73, 72],
          borderColor: "#3B82F6",
          borderDash: [5, 5],
          backgroundColor: "transparent",
          tension: 0.3,
          pointRadius: 0
        }
      ]
    }
  };

  const licenseTableData = [
    {
      software: "Microsoft Office 365",
      vendor: "Microsoft",
      licenses: 850,
      active: 490,
      inactive: 360,
      utilization: "58%",
      costPerLicense: "$12",
      totalCost: "$10,200",
      wasted: "$4,320",
      renewal: "2024-12-15",
      department: "Company-wide"
    },
    {
      software: "Adobe Creative Cloud",
      vendor: "Adobe",
      licenses: 320,
      active: 230,
      inactive: 90,
      utilization: "72%",
      costPerLicense: "$45",
      totalCost: "$14,400",
      wasted: "$4,050",
      renewal: "2024-11-01",
      department: "Marketing"
    },
    {
      software: "Zoom Pro",
      vendor: "Zoom",
      licenses: 280,
      active: 238,
      inactive: 42,
      utilization: "85%",
      costPerLicense: "$15",
      totalCost: "$4,200",
      wasted: "$630",
      renewal: "2025-03-01",
      department: "Company-wide"
    },
    {
      software: "Salesforce Enterprise",
      vendor: "Salesforce",
      licenses: 180,
      active: 122,
      inactive: 58,
      utilization: "68%",
      costPerLicense: "$150",
      totalCost: "$27,000",
      wasted: "$8,700",
      renewal: "2024-09-30",
      department: "Sales"
    },
    {
      software: "Slack Enterprise",
      vendor: "Slack",
      licenses: 300,
      active: 273,
      inactive: 27,
      utilization: "91%",
      costPerLicense: "$12",
      totalCost: "$3,600",
      wasted: "$324",
      renewal: "2025-01-15",
      department: "Company-wide"
    }
  ];

  const aiRecommendations = [
    {
      title: "Microsoft License Reclamation",
      description: "360 inactive Office 365 licenses identified. Reclaiming could save $4,320/month.",
      action: "Reclaim Licenses",
      impact: "$51,840 annual savings",
      urgency: "high"
    },
    {
      title: "Adobe License Tier Adjustment",
      description: "72 casual users could downgrade to lower-tier plan, saving $2,880/month.",
      action: "Downgrade Plan",
      impact: "$34,560 annual savings",
      urgency: "medium"
    },
    {
      title: "Salesforce License Reallocation",
      description: "22 inactive Sales licenses could be reassigned to new Marketing hires.",
      action: "Reassign Licenses",
      impact: "$3,300 monthly cost avoidance",
      urgency: "medium"
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

  const EnhancedChartCard = ({ title, chartType, chartData, widgetId, componentPath }) => {
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
                  <h1 className="text-x">Ask about {title}</h1>
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

  const KPICard = ({ title, value, change, isPositive, icon, description, forecast, financialImpact, componentPath }) => {
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
              {financialImpact && (
                <p className="text-[10px] font-medium text-gray-700">{financialImpact}</p>
              )}
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
              <Link to="/it-technology-spend" className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                IT & Technology
              </Link>
            </div>
          </li>
          <li aria-current="page">
            <div className="flex items-center">
              <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">License Utilization</span>
            </div>
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Software License Utilization</h1>
            <p className="text-sky-100 text-x">Optimize license allocation and reduce wasted spend</p>
            <p className="text-sky-100 text-x mt-1">Data updated: {new Date().toLocaleDateString()}</p>
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
            <Link to="/it-spend-table">
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
                value={filters.period}
                onChange={(e) => setFilters({...filters, period: e.target.value})}
              >
                <option>Current Quarter</option>
                <option>Last Quarter</option>
                <option>Year to Date</option>
                <option>Custom Range</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Vendor</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.vendor}
                onChange={(e) => setFilters({...filters, vendor: e.target.value})}
              >
                <option>All Vendors</option>
                <option>Microsoft</option>
                <option>Adobe</option>
                <option>Salesforce</option>
                <option>Zoom</option>
                <option>Slack</option>
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
                <option>Engineering</option>
                <option>Sales</option>
                <option>Marketing</option>
                <option>Finance</option>
                <option>HR</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Status</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
              >
                <option>All Statuses</option>
                <option>Active</option>
                <option>Inactive</option>
                <option>Underutilized</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        {licenseData.kpis.map((kpi, index) => (
          <KPICard
            key={index}
            title={kpi.title}
            value={kpi.value}
            change={kpi.change}
            isPositive={kpi.isPositive}
            icon={kpi.icon}
            description={kpi.description}
            forecast={kpi.forecast}
            financialImpact={kpi.financialImpact}
            componentPath={kpi.componentPath}
          />
        ))}
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Utilization by Software */}
        <EnhancedChartCard 
          title="License Utilization by Software" 
          chartType={selectedChartType.utilizationBySoftware} 
          chartData={{
            data: licenseData.utilizationBySoftware,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      return `${context.label}: ${context.raw}% utilization`;
                    }
                  }
                }
              },
              scales: {
                y: {
                  min: 0,
                  max: 100,
                  ticks: {
                    callback: function(value) {
                      return value + '%';
                    }
                  }
                }
              }
            }
          }} 
          widgetId="utilizationBySoftware"
          componentPath="/it-spend-table"
        />

        {/* License Distribution */}
        <EnhancedChartCard 
          title="License Distribution" 
          chartType="doughnut" 
          chartData={{
            data: licenseData.licenseDistribution,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'right' },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      const label = context.label || '';
                      const value = context.raw || 0;
                      const total = context.dataset.data.reduce((a, b) => a + b, 0);
                      const percentage = Math.round((value / total) * 100);
                      return `${label}: ${value} licenses (${percentage}%)`;
                    }
                  }
                }
              }
            }
          }} 
          widgetId="licenseDistribution"
          componentPath="/it-spend-table"
        />
      </div>

      {/* Secondary Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Utilization */}
        <EnhancedChartCard 
          title="Department-wise License Utilization" 
          chartType="bar" 
          chartData={{
            data: licenseData.departmentUtilization,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom' }
              },
              scales: {
                x: {
                  stacked: true,
                },
                y: {
                  stacked: true
                }
              }
            }
          }} 
          widgetId="departmentUtilization"
          componentPath="/it-spend-table"
        />

        {/* Utilization Trend */}
        <EnhancedChartCard 
          title="Utilization Trend with Forecast" 
          chartType={selectedChartType.trendAnalysis} 
          chartData={{
            data: licenseData.utilizationTrend,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom' }
              },
              scales: {
                y: {
                  min: 50,
                  max: 100,
                  ticks: {
                    callback: function(value) {
                      return value + '%';
                    }
                  }
                }
              }
            }
          }} 
          widgetId="trendAnalysis"
          componentPath="/it-spend-table"
        />
      </div>

      {/* License Details Table */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">License Inventory Details</h3>
          <div className="flex space-x-2">
            <button className="text-x text-sky-600 hover:text-sky-800">
              Export CSV
            </button>
            <button className="text-x text-sky-600 hover:text-sky-800">
              Export PDF
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-s text-left text-gray-700">
            <thead className="text-x text-sky-700 uppercase bg-sky-50">
              <tr>
                <th className="px-4 py-2">Software</th>
                <th className="px-4 py-2">Vendor</th>
                <th className="px-4 py-2">Licenses</th>
                <th className="px-4 py-2">Active</th>
                <th className="px-4 py-2">Inactive</th>
                <th className="px-4 py-2">Utilization</th>
                <th className="px-4 py-2">Monthly Cost</th>
                <th className="px-4 py-2">Wasted</th>
                <th className="px-4 py-2">Renewal</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {licenseTableData.map((row, i) => (
                <tr key={i} className="border-b hover:bg-sky-50">
                  <td className="px-4 py-2 font-medium">{row.software}</td>
                  <td className="px-4 py-2">{row.vendor}</td>
                  <td className="px-4 py-2">{row.licenses}</td>
                  <td className="px-4 py-2">{row.active}</td>
                  <td className="px-4 py-2">{row.inactive}</td>
                  <td className={`px-4 py-2 font-medium ${
                    parseFloat(row.utilization) > 80 ? "text-green-500" : 
                    parseFloat(row.utilization) > 60 ? "text-amber-500" : "text-red-500"
                  }`}>{row.utilization}</td>
                  <td className="px-4 py-2">{row.totalCost}</td>
                  <td className="px-4 py-2 text-red-500">{row.wasted}</td>
                  <td className="px-4 py-2">{row.renewal}</td>
                  <td className="px-4 py-2">
                    <button className="text-x text-sky-600 hover:text-sky-800 mr-2">
                      Optimize
                    </button>
                    <button className="text-x text-gray-600 hover:text-gray-800">
                      Review
                    </button>
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
          <h3 className="text-md font-semibold text-sky-800">AI-Powered Optimization Recommendations</h3>
          <button 
            className="flex items-center text-x text-sky-600 hover:text-sky-800"
            onClick={() => setShowAIDropdown("aiRecommendations")}
          >
            <BsStars className="mr-1" /> Ask AI
          </button>
        </div>
        {showAIDropdown === "aiRecommendations" && (
          <div className="mb-4 bg-sky-50 p-3 rounded-lg">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={aiInput["aiRecommendations"] || ""}
                onChange={(e) => setAiInput(prev => ({ ...prev, ["aiRecommendations"]: e.target.value }))}
                placeholder="Ask about license optimization..."
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
          {aiRecommendations.map((rec, i) => (
            <div key={i} className={`p-3 rounded-lg border ${
              rec.urgency === "high" ? "border-red-200 bg-red-50" : 
              rec.urgency === "medium" ? "border-amber-200 bg-amber-50" : 
              "border-green-200 bg-green-50"
            }`}>
              <div className="flex justify-between items-start mb-2">
                <h4 className="text-s font-semibold text-gray-800">{rec.title}</h4>
                <span className={`text-x px-2 py-1 rounded-full ${
                  rec.urgency === "high" ? "bg-red-200 text-red-800" :
                  rec.urgency === "medium" ? "bg-amber-200 text-amber-800" :
                  "bg-green-200 text-green-800"
                }`}>
                  {rec.urgency.toUpperCase()}
                </span>
              </div>
              <p className="text-x text-gray-600 mb-3">{rec.description}</p>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-x font-medium text-gray-800">{rec.impact}</p>
                </div>
                <button className={`text-x px-3 py-1 rounded-md font-medium ${
                  rec.urgency === "high" ? "bg-red-600 text-white hover:bg-red-700" :
                  rec.urgency === "medium" ? "bg-amber-600 text-white hover:bg-amber-700" :
                  "bg-green-600 text-white hover:bg-green-700"
                } transition-colors duration-200`}>
                  {rec.action}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <h3 className="text-md font-semibold text-sky-800 mb-4">License Optimization Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-sky-600">$42K</div>
            <div className="text-x text-gray-600">Monthly Waste</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">$504K</div>
            <div className="text-x text-gray-600">Annual Potential Savings</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-600">24</div>
            <div className="text-x text-gray-600">Underutilized Products</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">762</div>
            <div className="text-x text-gray-600">Inactive Licenses</div>
          </div>
        </div>
      </div>

      {/* Action Items */}
      <div className="bg-gradient-to-r from-sky-100 to-sky-50 p-4 rounded-lg border border-sky-200">
        <h3 className="text-md font-semibold text-sky-800 mb-3">Recommended Next Steps</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-6 h-6 bg-sky-600 text-white rounded-full flex items-center justify-center text-x font-bold">1</div>
            <div>
              <h4 className="text-s font-medium text-sky-800">Immediate License Reclamation</h4>
              <p className="text-x text-gray-600">Review and reclaim 360 inactive Office 365 licenses to save $4,320/month</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-6 h-6 bg-sky-600 text-white rounded-full flex items-center justify-center text-x font-bold">2</div>
            <div>
              <h4 className="text-s font-medium text-sky-800">Department Usage Review</h4>
              <p className="text-x text-gray-600">Conduct quarterly reviews with department heads to optimize allocation</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-6 h-6 bg-sky-600 text-white rounded-full flex items-center justify-center text-x font-bold">3</div>
            <div>
              <h4 className="text-s font-medium text-sky-800">Automated Monitoring</h4>
              <p className="text-x text-gray-600">Implement automated alerts for licenses unused for 30+ days</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-6 h-6 bg-sky-600 text-white rounded-full flex items-center justify-center text-x font-bold">4</div>
            <div>
              <h4 className="text-s font-medium text-sky-800">Renewal Optimization</h4>
              <p className="text-x text-gray-600">Renegotiate contracts based on actual usage patterns before renewals</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer with Last Updated */}
      {/* <div className="text-center text-x text-gray-500 mt-6">
        <p>License utilization data last synchronized: {new Date().toLocaleString()}</p>
        <p>Next scheduled update: {new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
      </div> */}

      {/* Tooltips */}
      <ReactTooltip id="chart-type-tooltip" place="top" effect="solid" />
      <ReactTooltip id="ai-tooltip" place="top" effect="solid" />
    </div>
  );
};

export default SoftwareLicenseUtilization;