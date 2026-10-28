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
  FiServer,
  FiDownload,
  FiCloud,
  FiShield,
  FiPackage,
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

const ITSpendBreakdown = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    timePeriod: "Last Quarter",
    category: "All Categories",
    department: "All Departments",
    vendor: "All Vendors"
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedChartType, setSelectedChartType] = useState({
    spendByCategory: "bar",
    cloudTrend: "line"
  });
  const [aiInput, setAiInput] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const filtersRef = useRef(null);

  // Sample data for IT spend metrics
  const spendData = {
    spendByCategory: {
      labels: ["Q1", "Q2", "Q3", "Q4"],
      datasets: [
        {
          label: "Cloud Services",
          data: [120, 135, 145, 160],
          backgroundColor: "rgba(59, 130, 246, 0.7)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 1
        },
        {
          label: "SaaS Subscriptions",
          data: [85, 92, 105, 115],
          backgroundColor: "rgba(16, 185, 129, 0.7)",
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 1
        },
        {
          label: "Infrastructure",
          data: [65, 70, 75, 80],
          backgroundColor: "rgba(234, 179, 8, 0.7)",
          borderColor: "rgba(234, 179, 8, 1)",
          borderWidth: 1
        },
        {
          label: "Security",
          data: [45, 50, 55, 60],
          backgroundColor: "rgba(239, 68, 68, 0.7)",
          borderColor: "rgba(239, 68, 68, 1)",
          borderWidth: 1
        }
      ]
    },
    cloudTrend: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"],
      datasets: [
        {
          label: "Cloud Spend ($K)",
          data: [45, 48, 52, 55, 58, 62, 65, 68],
          backgroundColor: "rgba(59, 130, 246, 0.2)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 2,
          tension: 0.4
        },
        {
          label: "AI Forecast",
          data: [null, null, null, null, null, null, 65, 68],
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderColor: "rgba(59, 130, 246, 0.5)",
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.4,
          pointRadius: 0
        }
      ]
    },
    spendDistribution: {
      labels: ["Cloud", "SaaS", "Infrastructure", "Security", "IT Services"],
      datasets: [{
        label: "Spend ($K)",
        data: [160, 115, 80, 60, 45],
        backgroundColor: [
          "rgba(59, 130, 246, 0.7)",
          "rgba(16, 185, 129, 0.7)",
          "rgba(234, 179, 8, 0.7)",
          "rgba(239, 68, 68, 0.7)",
          "rgba(139, 92, 246, 0.7)"
        ],
        borderColor: [
          "rgba(59, 130, 246, 1)",
          "rgba(16, 185, 129, 1)",
          "rgba(234, 179, 8, 1)",
          "rgba(239, 68, 68, 1)",
          "rgba(139, 92, 246, 1)"
        ],
        borderWidth: 1
      }]
    },
    spendVsRoi: {
      labels: ["Cloud", "SaaS", "Infrastructure", "Security", "IT Services"],
      datasets: [{
        label: "Spend vs ROI",
        data: [
          { x: 160, y: 2.8, r: 20 },
          { x: 115, y: 3.2, r: 15 },
          { x: 80, y: 1.5, r: 10 },
          { x: 60, y: 3.4, r: 8 },
          { x: 45, y: 2.1, r: 6 }
        ],
        backgroundColor: "rgba(139, 92, 246, 0.7)",
        borderColor: "rgba(139, 92, 246, 1)",
        borderWidth: 1
      }]
    }
  };

  const kpiData = [
    {
      title: "Total IT Spend",
      value: "$460K",
      change: "+18%",
      isPositive: false,
      icon: <FiDollarSign />,
      description: "Total IT expenditure this quarter",
      forecast: "$490K predicted next quarter",
      componentPath: "/it-spend-table"
    },
    {
      title: "% of OpEx",
      value: "22%",
      change: "+3%",
      isPositive: false,
      icon: <FiPieChart />,
      description: "IT spend as % of operating expenses",
      forecast: "23% predicted next quarter",
      componentPath: "/it-spend-table"
    },
    {
      title: "Cloud Spend",
      value: "$160K",
      change: "+25%",
      isPositive: false,
      icon: <FiCloud />,
      description: "Quarterly cloud services spend",
      forecast: "$175K predicted next quarter",
      componentPath: "/it-spend-table"
    },
    {
      title: "SaaS Spend",
      value: "$115K",
      change: "+12%",
      isPositive: false,
      icon: <FiPackage />,
      description: "Quarterly SaaS subscriptions",
      forecast: "$120K predicted next quarter",
      componentPath: "/it-spend-table"
    },
    {
      title: "Security Spend",
      value: "$60K",
      change: "+20%",
      isPositive: true,
      icon: <FiShield />,
      description: "Quarterly security investments",
      forecast: "$65K predicted next quarter",
      componentPath: "/it-spend-table"
    },
    {
      title: "IT ROI",
      value: "2.8x",
      change: "+0.3x",
      isPositive: true,
      icon: <FiTrendingUp />,
      description: "Return on IT investments",
      forecast: "3.0x predicted next quarter",
      componentPath: "/it-spend-table"
    }
  ];

  const spendTableData = [
    {
      category: "Cloud Services",
      vendor: "AWS",
      department: "Engineering",
      monthlySpend: "$45K",
      annualized: "$540K",
      roi: "2.8x",
      costPerUser: "$450",
      budgetConsumed: "32%"
    },
    {
      category: "SaaS",
      vendor: "Salesforce",
      department: "Sales",
      monthlySpend: "$28K",
      annualized: "$336K",
      roi: "3.2x",
      costPerUser: "$280",
      budgetConsumed: "24%"
    },
    {
      category: "Infrastructure",
      vendor: "Dell",
      department: "IT",
      monthlySpend: "$20K",
      annualized: "$240K",
      roi: "1.5x",
      costPerUser: "$200",
      budgetConsumed: "18%"
    },
    {
      category: "Security",
      vendor: "CrowdStrike",
      department: "Security",
      monthlySpend: "$15K",
      annualized: "$180K",
      roi: "3.4x",
      costPerUser: "$150",
      budgetConsumed: "13%"
    },
    {
      category: "IT Services",
      vendor: "Accenture",
      department: "Operations",
      monthlySpend: "$12K",
      annualized: "$144K",
      roi: "2.1x",
      costPerUser: "$120",
      budgetConsumed: "10%"
    }
  ];

  const efficiencyMetrics = [
    {
      metric: "Cloud Utilization",
      value: "68%",
      trend: "+5%",
      benchmark: "65%"
    },
    {
      metric: "SaaS License Usage",
      value: "72%",
      trend: "-3%",
      benchmark: "75%"
    },
    {
      metric: "Infra Uptime",
      value: "99.95%",
      trend: "+0.1%",
      benchmark: "99.9%"
    },
    {
      metric: "Security ROI",
      value: "3.4x",
      trend: "+0.2x",
      benchmark: "3.0x"
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
              <Link to="/it-technology-spend" className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                IT & Technology
              </Link>
            </div>
          </li>
          <li aria-current="page">
            <div className="flex items-center">
              <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">IT Spend Breakdown</span>
            </div>
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">IT Spend Breakdown</h1>
            <p className="text-sky-100 text-x">Cloud, SaaS, Infrastructure, Security & IT Services</p>
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
                                                                className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 hover:text-sky-50 transition-colors duration-200">
                                                                <FiDownload className="text-sky-50" />
                                                                <span className="text-sky-50">Export</span>
                                                            </button>
             <Link
     to="/it-spend-table">
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
                <option>Year to Date</option>
                <option>Custom Range</option>
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
                <option>Cloud Services</option>
                <option>SaaS</option>
                <option>Infrastructure</option>
                <option>Security</option>
                <option>IT Services</option>
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
                <option>Operations</option>
                <option>Security</option>
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
                <option>AWS</option>
                <option>Azure</option>
                <option>Salesforce</option>
                <option>Google Cloud</option>
                <option>CrowdStrike</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
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
        {/* Spend by Category */}
        <EnhancedChartCard 
          title="IT Spend by Category" 
          chartType={selectedChartType.spendByCategory} 
          chartData={{
            data: spendData.spendByCategory,
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
                    text: 'Spend ($K)'
                  }
                }
              }
            }
          }} 
          widgetId="spendByCategory" 
          index={0} 
          componentPath="/it-spend-table" 
        />

        {/* Cloud Spend Trend */}
        <EnhancedChartCard 
          title="Cloud Spend Trend with AI Forecast" 
          chartType={selectedChartType.cloudTrend} 
          chartData={{
            data: spendData.cloudTrend,
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
                    text: 'Spend ($K)'
                  }
                }
              }
            }
          }} 
          widgetId="cloudTrend" 
          index={1} 
          componentPath="/it-spend-table" 
        />
      </div>

      {/* Secondary Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spend Distribution */}
        <EnhancedChartCard 
          title="IT Spend Distribution" 
          chartType="doughnut" 
          chartData={{
            data: spendData.spendDistribution,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'right' },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      return `${context.label}: $${context.raw}K (${Math.round(context.parsed * 100 / context.dataset.data.reduce((a, b) => a + b, 0))}%)`;
                    }
                  }
                }
              }
            }
          }} 
          widgetId="spendDistribution" 
          index={2} 
          componentPath="/it-spend-table" 
        />

        {/* Spend vs ROI */}
        <EnhancedChartCard 
          title="Spend vs ROI by Category" 
          chartType="bar" 
          chartData={{
            data: spendData.spendVsRoi,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: 'ROI (x)'
                  }
                },
                x: {
                  title: {
                    display: true,
                    text: 'Spend ($K)'
                  }
                }
              }
            }
          }} 
          widgetId="spendVsRoi" 
          index={3} 
          componentPath="/it-spend-table" 
        />
      </div>

      {/* IT Spend Table */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">Detailed IT Spend Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-s text-left text-gray-700">
            <thead className="text-x text-sky-700 uppercase bg-sky-50">
              <tr>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Vendor</th>
                <th className="px-4 py-2">Department</th>
                <th className="px-4 py-2">Monthly Spend</th>
                <th className="px-4 py-2">Annualized</th>
                <th className="px-4 py-2">ROI</th>
                <th className="px-4 py-2">Cost/User</th>
                <th className="px-4 py-2">% Budget</th>
              </tr>
            </thead>
            <tbody>
              {spendTableData.map((row, i) => (
                <tr key={i} className="border-b hover:bg-sky-50">
                  <td className="px-4 py-2 font-medium">{row.category}</td>
                  <td className="px-4 py-2">{row.vendor}</td>
                  <td className="px-4 py-2">{row.department}</td>
                  <td className="px-4 py-2">{row.monthlySpend}</td>
                  <td className="px-4 py-2">{row.annualized}</td>
                  <td className={`px-4 py-2 font-medium ${
                    parseFloat(row.roi.replace('x', '')) > 3 ? "text-green-500" : 
                    parseFloat(row.roi.replace('x', '')) > 2 ? "text-amber-500" : "text-red-500"
                  }`}>{row.roi}</td>
                  <td className="px-4 py-2">{row.costPerUser}</td>
                  <td className="px-4 py-2">{row.budgetConsumed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Efficiency Metrics */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">IT Efficiency Metrics</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {efficiencyMetrics.map((metric, i) => (
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
          <h3 className="text-md font-semibold text-sky-800">AI Insights & Recommendations</h3>
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
                placeholder="Ask about IT spend optimization..."
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
            <h4 className="text-s font-medium text-sky-800 mb-2">Cloud Optimization</h4>
            <p className="text-x text-gray-700">"AWS spend increased 25% QoQ. AI recommends rightsizing EC2 instances for potential 15% cost savings."</p>
          </div>
          <div className="bg-sky-50 p-3 rounded-lg">
            <h4 className="text-s font-medium text-sky-800 mb-2">SaaS License Waste</h4>
            <p className="text-x text-gray-700">"28% of Salesforce licenses are unused. Consolidating could save $8,400/month."</p>
          </div>
          <div className="bg-sky-50 p-3 rounded-lg">
            <h4 className="text-s font-medium text-sky-800 mb-2">Security ROI</h4>
            <p className="text-x text-gray-700">"Security investments show highest ROI (3.4x). Consider reallocating 5% from Infrastructure to Security."</p>
          </div>
        </div>
      </div>

      <ReactTooltip id="chart-type-tooltip" place="top" effect="solid" />
      <ReactTooltip id="ai-tooltip" place="top" effect="solid" />
    </div>
  );
};

export default ITSpendBreakdown;