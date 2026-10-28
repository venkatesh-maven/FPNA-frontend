
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
  FiClock, 
  FiDollarSign, 
  FiCheckSquare,
  FiFilter, 
  FiUsers,
  FiChevronDown,
  FiSend,
  FiZap, // For Sourcing Effectiveness
  FiSmile, // For Candidate Our platform connects every facet of your business
  FiChevronRight,
  FiTarget, // Alternative for Sourcing/Goals
  FiBriefcase, // For Job Family/Roles
  FiUserCheck // For Recruiter
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

const HiringFunnelMetrics = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    timePeriod: "Last Quarter",
    department: "All Departments",
    jobFamily: "All Job Families",
    recruiter: "All Recruiters"
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedChartType, setSelectedChartType] = useState({
    timeToHireTrend: "line",
    costPerHireByDept: "bar"
  });
  const [aiInput, setAiInput] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const filtersRef = useRef(null);

  // Sample data for hiring metrics
  const hiringData = {
    timeToHireTrend: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"],
      datasets: [
        {
          label: "Avg. Time-to-Hire (Days)",
          data: [48, 46, 45, 47, 44, 45, 42, 40],
          backgroundColor: "rgba(59, 130, 246, 0.2)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 2,
          tension: 0.4
        },
        {
          label: "AI Forecast",
          data: [null, null, null, null, null, null, 42, 40],
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderColor: "rgba(59, 130, 246, 0.5)",
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.4,
          pointRadius: 0
        }
      ]
    },
    costPerHireByDept: {
      labels: ["Tech", "Sales", "HR", "Marketing", "Product", "Finance"],
      datasets: [
        {
          label: "Cost per Hire (₹)",
          data: [32000, 25000, 18000, 28000, 30000, 22000],
          backgroundColor: [
            "rgba(59, 130, 246, 0.7)",
            "rgba(16, 185, 129, 0.7)",
            "rgba(234, 179, 8, 0.7)",
            "rgba(239, 68, 68, 0.7)",
            "rgba(139, 92, 246, 0.7)",
            "rgba(245, 158, 11, 0.7)"
          ],
          borderColor: [
            "rgba(59, 130, 246, 1)",
            "rgba(16, 185, 129, 1)",
            "rgba(234, 179, 8, 1)",
            "rgba(239, 68, 68, 1)",
            "rgba(139, 92, 246, 1)",
            "rgba(245, 158, 11, 1)"
          ],
          borderWidth: 1
        }
      ]
    },
    offerAcceptanceRateBySource: {
      labels: ["LinkedIn", "Referrals", "Job Boards", "Careers Page", "Campus"],
      datasets: [{
        label: "Offer Acceptance Rate",
        data: [92, 95, 85, 88, 82],
        backgroundColor: [
          "rgba(59, 130, 246, 0.7)",
          "rgba(16, 185, 129, 0.7)",
          "rgba(234, 179, 8, 0.7)",
          "rgba(139, 92, 246, 0.7)",
          "rgba(239, 68, 68, 0.7)"
        ],
        borderColor: [
          "rgba(59, 130, 246, 1)",
          "rgba(16, 185, 129, 1)",
          "rgba(234, 179, 8, 1)",
          "rgba(139, 92, 246, 1)",
          "rgba(239, 68, 68, 1)"
        ],
        borderWidth: 1
      }]
    },
    hiringFunnelConversion: { // Candidates per stage
      labels: ["Applied", "Screened", "Interviewed", "Offered", "Hired"],
      datasets: [
        {
          label: "Candidate Count",
          data: [500, 250, 100, 25, 20],
          backgroundColor: "rgba(16, 185, 129, 0.7)",
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 1
        }
      ]
    }
  };

  const kpiData = [
    {
      title: "Time-to-Hire",
      value: "42 days",
      change: "-3 days",
      isPositive: true,
      icon: <FiClock />,
      description: "Avg. time from job opening to acceptance",
      forecast: "Targeting 38 days next quarter",
      componentPath: "/hr-workforce-table"
    },
    {
      title: "Cost per Hire",
      value: "₹26,500",
      change: "+₹1,200",
      isPositive: false,
      icon: <FiDollarSign />,
      description: "Avg. cost to acquire a new employee",
      forecast: "Projected ₹27,000 if trend continues",
      componentPath: "/hr-workforce-table"
    },
    {
      title: "Offer Acceptance Rate",
      value: "89%",
      change: "+2%",
      isPositive: true,
      icon: <FiCheckSquare />,
      description: "Percentage of offers accepted by candidates",
      forecast: "Aiming for 92% acceptance",
      componentPath: "/hr-workforce-table"
    },
    {
      title: "Sourcing Effectiveness",
      value: "Top Source: Referrals (35%)",
      change: "LinkedIn ↑5%",
      isPositive: true,
      icon: <FiZap />,
      description: "Effectiveness of various hiring channels",
      forecast: "Explore partnerships for niche roles",
      componentPath: "/hr-workforce-table"
    },
    {
      title: "Candidate Experience",
      value: "4.3 / 5.0",
      change: "+0.1",
      isPositive: true,
      icon: <FiSmile />,
      description: "Avg. rating from post-interview surveys",
      forecast: "Target 4.5 with new feedback process",
      componentPath: "/hr-workforce-table"
    }
  ];

  const funnelBreakdownTableData = [
    {
      item: "Tech Department",
      applied: 200,
      screened: 80,
      interviewed: 30,
      offered: 10,
      hired: 8,
      conversion: "4%",
      timeToFill: 55,
      aiSuggestion: "High drop-off post-screen. Review JD & screening criteria."
    },
    {
      item: "Sales Department",
      applied: 150,
      screened: 70,
      interviewed: 40,
      offered: 15,
      hired: 12,
      conversion: "8%",
      timeToFill: 40,
      aiSuggestion: "Good conversion. Leverage top performing recruiters for Sales."
    },
    {
      item: "Marketing Department",
      applied: 100,
      screened: 45,
      interviewed: 20,
      offered: 8,
      hired: 7,
      conversion: "7%",
      timeToFill: 48,
      aiSuggestion: "Consider targeted campaigns for hard-to-fill marketing roles."
    },
     {
      item: "Product Management",
      applied: 80,
      screened: 30,
      interviewed: 12,
      offered: 5,
      hired: 4,
      conversion: "5%",
      timeToFill: 60,
      aiSuggestion: "Lenghty TTH. Expedite interview scheduling for Product roles."
    }
  ];

  const keyPerformanceIndicators = [
    {
      metric: "Qualified Applicants/Source",
      value: "Referrals: 60%",
      trend: "LinkedIn: +8%",
      benchmark: "Industry Avg: 45%"
    },
    {
      metric: "Interviews per Hire",
      value: "4.2",
      trend: "-0.3",
      benchmark: "Target: 4.0"
    },
    {
      metric: "Diversity Hire Rate",
      value: "38%",
      trend: "+3%",
      benchmark: "Company Goal: 40%"
    },
    {
      metric: "New Hire Performance (90 days)",
      value: "85% Met/Exceeded",
      trend: "+2%",
      benchmark: "Target: 88%"
    }
  ];

  const toggleChartType = (chartId, type) => {
    setSelectedChartType(prev => ({ ...prev, [chartId]: type }));
  };

  const handleSendAIQuery = (widgetId) => {
    if (aiInput[widgetId]?.trim()) {
      console.log(`AI Query for ${widgetId}:`, aiInput[widgetId]);
      // Add actual AI query logic here
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
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Hiring Funnel Metrics</span>
            </div>
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Hiring Funnel Metrics Analysis</h1>
            <p className="text-sky-100 text-x">Track key hiring stages, efficiency, and costs.</p>
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
            <Link to="/hr-hiring-table">
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
                <option>Marketing</option>
                <option>Product</option>
                <option>Finance</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Job Family</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.jobFamily}
                onChange={(e) => setFilters({...filters, jobFamily: e.target.value})}
              >
                <option>All Job Families</option>
                <option>Engineering</option>
                <option>Product Management</option>
                <option>Sales & Business Development</option>
                <option>Marketing & Communications</option>
                <option>Human Resources & Admin</option>
                <option>Finance & Accounting</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Recruiter</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.recruiter}
                onChange={(e) => setFilters({...filters, recruiter: e.target.value})}
              >
                <option>All Recruiters</option>
                <option>Priya Sharma</option>
                <option>Amit Singh</option>
                <option>Neha Reddy</option>
                <option>Rajesh Kumar</option>
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
        <EnhancedChartCard 
          title="Time-to-Hire Trend with AI Forecast" 
          chartType={selectedChartType.timeToHireTrend} 
          chartData={{
            data: hiringData.timeToHireTrend,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: 'bottom' } },
              scales: { y: { beginAtZero: false, title: { display: true, text: 'Days' } } }
            }
          }} 
          widgetId="timeToHireTrend" 
          index={0} 
          componentPath="/hr-workforce-table" 
        />

        <EnhancedChartCard 
          title="Cost per Hire by Department" 
          chartType={selectedChartType.costPerHireByDept} 
          chartData={{
            data: hiringData.costPerHireByDept,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              indexAxis: 'y',
              plugins: { legend: { display: false } },
              scales: { x: { beginAtZero: true, title: { display: true, text: 'Cost (₹)' } } }
            }
          }} 
          widgetId="costPerHireByDept" 
          index={1} 
          componentPath="/hr-workforce-table" 
        />
      </div>

      {/* Secondary Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EnhancedChartCard 
          title="Offer Acceptance Rate by Source" 
          chartType="doughnut" 
          chartData={{
            data: hiringData.offerAcceptanceRateBySource,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'right' },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      return `${context.label}: ${context.raw}%`;
                    }
                  }
                }
              }
            }
          }} 
          widgetId="offerAcceptanceRateBySource" 
          index={2} 
          componentPath="/hr-workforce-table" 
        />

        <EnhancedChartCard 
          title="Hiring Funnel Conversion (Candidates per Stage)" 
          chartType="bar" 
          chartData={{
            data: hiringData.hiringFunnelConversion,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true, title: { display: true, text: 'Number of Candidates' } } }
            }
          }} 
          widgetId="hiringFunnelConversion" 
          index={3} 
          componentPath="/hr-workforce-table" 
        />
      </div>

      {/* Hiring Funnel Breakdown Table */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">Hiring Funnel Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-s text-left text-gray-700">
            <thead className="text-x text-sky-700 uppercase bg-sky-50">
              <tr>
                <th className="px-4 py-2">Department / Job Family</th>
                <th className="px-4 py-2 text-center">Applied</th>
                <th className="px-4 py-2 text-center">Screened</th>
                <th className="px-4 py-2 text-center">Interviewed</th>
                <th className="px-4 py-2 text-center">Offered</th>
                <th className="px-4 py-2 text-center">Hired</th>
                <th className="px-4 py-2 text-center">Conversion %</th>
                <th className="px-4 py-2 text-center">Time-to-Fill (Days)</th>
                <th className="px-4 py-2">AI Suggestion</th>
              </tr>
            </thead>
            <tbody>
              {funnelBreakdownTableData.map((row, i) => (
                <tr key={i} className="border-b hover:bg-sky-50">
                  <td className="px-4 py-2 font-medium">{row.item}</td>
                  <td className="px-4 py-2 text-center">{row.applied}</td>
                  <td className="px-4 py-2 text-center">{row.screened}</td>
                  <td className="px-4 py-2 text-center">{row.interviewed}</td>
                  <td className="px-4 py-2 text-center">{row.offered}</td>
                  <td className="px-4 py-2 text-center">{row.hired}</td>
                  <td className={`px-4 py-2 text-center font-semibold ${parseFloat(row.conversion) >= 7 ? "text-green-500" : parseFloat(row.conversion) >= 4 ? "text-amber-500" : "text-red-500"}`}>{row.conversion}</td>
                  <td className={`px-4 py-2 text-center ${row.timeToFill <= 45 ? "text-green-500" : row.timeToFill <= 60 ? "text-amber-500" : "text-red-500"}`}>{row.timeToFill}</td>
                  <td className="px-4 py-2 text-x">{row.aiSuggestion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">Key Performance Indicators</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {keyPerformanceIndicators.map((metric, i) => (
            <div key={i} className="bg-sky-50 p-3 rounded-lg">
              <p className="text-x font-semibold text-sky-700">{metric.metric}</p>
              <div className="flex items-end mt-1">
                <p className="text-lg font-bold text-sky-900">{metric.value}</p>
              </div>
               <p className={`text-x mt-1 ${metric.trend.includes('+') ? "text-green-500" : metric.trend.includes('-') ? "text-red-500" : "text-gray-500"}`}>
                  {metric.trend}
                </p>
              <p className="text-x text-gray-500 mt-1">Benchmark: {metric.benchmark}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Recommendations Section */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">AI-Powered Hiring Recommendations</h3>
          <div className="flex items-center space-x-2">
            <BsStars className="text-sky-600" />
            <span className="text-x text-sky-600">AI Generated</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg border-l-4 border-red-400">
            <div className="flex items-center mb-2">
              <div className="p-2 bg-red-200 rounded-full mr-3">
                <FiClock className="text-red-600" />
              </div>
              <div>
                <h4 className="text-s font-semibold text-red-800">High Time-to-Fill Alert</h4>
                <p className="text-x text-red-600">Product Management Roles</p>
              </div>
            </div>
            <p className="text-x text-red-700 mb-2">
              Avg. 60 days to fill Product roles. Recommend streamlining technical assessments and dedicating recruiter focus for these critical positions.
            </p>
            <div className="flex justify-between items-center">
              <span className="text-x bg-red-200 text-red-800 px-2 py-1 rounded-full">Priority: High</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-lg border-l-4 border-amber-400">
            <div className="flex items-center mb-2">
              <div className="p-2 bg-amber-200 rounded-full mr-3">
                <FiCheckSquare className="text-amber-600" />
              </div>
              <div>
                <h4 className="text-s font-semibold text-amber-800">Offer Acceptance Dip</h4>
                <p className="text-x text-amber-600">Sales Department</p>
              </div>
            </div>
            <p className="text-x text-amber-700 mb-2">
              Sales offer acceptance rate dropped to 82% (target 90%). Review compensation benchmarks and enhance offer negotiation training for recruiters.
            </p>
            <div className="flex justify-between items-center">
              <span className="text-x bg-amber-200 text-amber-800 px-2 py-1 rounded-full">Priority: Medium</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border-l-4 border-green-400">
            <div className="flex items-center mb-2">
              <div className="p-2 bg-green-200 rounded-full mr-3">
                <FiDollarSign className="text-green-600" />
              </div>
              <div>
                <h4 className="text-s font-semibold text-green-800">Cost Optimization Opportunity</h4>
                <p className="text-x text-green-600">Reduce Agency Spend</p>
              </div>
            </div>
            <p className="text-x text-green-700 mb-2">
              Current Cost per Hire for Tech is ₹32,000. Boosting employee referral program and optimizing job board spend could save up to ₹4,000 per hire.
            </p>
            <div className="flex justify-between items-center">
              <span className="text-x bg-green-200 text-green-800 px-2 py-1 rounded-full">Impact: High</span>
            </div>
          </div>
        </div>

        {/* Action Items */}
        <div className="mt-6 bg-sky-50 p-4 rounded-lg">
          <h4 className="text-s font-semibold text-sky-800 mb-3">Immediate Action Items</h4>
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <input type="checkbox" className="w-4 h-4 text-sky-600 bg-gray-100 border-gray-300 rounded focus:ring-sky-500" />
              <span className="text-x text-gray-700">Review and revise technical assessment process for Product Management roles.</span>
              <span className="text-x bg-red-100 text-red-800 px-2 py-1 rounded-full ml-auto">Due: This Week</span>
            </div>
            <div className="flex items-center space-x-3">
              <input type="checkbox" className="w-4 h-4 text-sky-600 bg-gray-100 border-gray-300 rounded focus:ring-sky-500" />
              <span className="text-x text-gray-700">Conduct market analysis of Sales compensation packages.</span>
              <span className="text-x bg-amber-100 text-amber-800 px-2 py-1 rounded-full ml-auto">Due: Next Week</span>
            </div>
            <div className="flex items-center space-x-3">
              <input type="checkbox" className="w-4 h-4 text-sky-600 bg-gray-100 border-gray-300 rounded focus:ring-sky-500" />
              <span className="text-x text-gray-700">Launch enhanced employee referral campaign with updated incentives.</span>
              <span className="text-x bg-green-100 text-green-800 px-2 py-1 rounded-full ml-auto">Due: This Month</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Quick Actions Panel (kept commented as per original) */}
      {/* <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <h3 className="text-md font-semibold text-sky-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <button 
            onClick={() => navigate('/post-new-job')} // Example path
            className="flex items-center justify-center p-3 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 transition-colors duration-200"
          >
            <FiBriefcase className="mr-2 text-sky-600" />
            <span className="text-s text-sky-700">Post New Job</span>
          </button>
          <button 
            onClick={() => navigate('/candidate-database')} // Example path
            className="flex items-center justify-center p-3 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 transition-colors duration-200"
          >
            <FiUsers className="mr-2 text-sky-600" />
            <span className="text-s text-sky-700">Candidate Database</span>
          </button>
          <button 
            onClick={() => navigate('/recruiter-performance')} // Example path
            className="flex items-center justify-center p-3 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 transition-colors duration-200"
          >
            <FiUserCheck className="mr-2 text-sky-600" />
            <span className="text-s text-sky-700">Recruiter Performance</span>
          </button>
          <button 
            onClick={() => navigate('/job-board-integrations')} // Example path
            className="flex items-center justify-center p-3 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 transition-colors duration-200"
          >
            <FiTarget className="mr-2 text-sky-600" />
            <span className="text-s text-sky-700">Manage Job Boards</span>
          </button>
        </div>
      </div> */}

      {/* Tooltips */}
      <ReactTooltip id="chart-type-tooltip" place="top" effect="solid" />
      <ReactTooltip id="ai-tooltip" place="top" effect="solid" />
    </div>
  );
};

export default HiringFunnelMetrics;
