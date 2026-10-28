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
  FiFilter, 
  FiDollarSign,
  FiUser,
  FiDownload,
  FiSend,
  FiChevronDown,
  FiChevronRight,
  FiRefreshCw,
  FiUsers
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

const ChurnRetention = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    timePeriod: "Last Quarter",
    segment: "All Segments",
    product: "All Products"
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedChartType, setSelectedChartType] = useState({
    churnTrend: "line",
    retentionBySegment: "bar"
  });
  const [aiInput, setAiInput] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const filtersRef = useRef(null);
  const aiChatbotRef = useRef(null);

  // Sample data for churn and retention metrics
  const churnData = {
    churnTrend: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"],
      datasets: [
        {
          label: "Churn Rate (%)",
          data: [5.2, 4.8, 5.1, 6.3, 7.1, 6.8, 8.2, 7.5],
          backgroundColor: "rgba(239, 68, 68, 0.2)",
          borderColor: "rgba(239, 68, 68, 1)",
          borderWidth: 2,
          tension: 0.4
        },
        {
          label: "Retention Rate (%)",
          data: [94.8, 95.2, 94.9, 93.7, 92.9, 93.2, 91.8, 92.5],
          backgroundColor: "rgba(16, 185, 129, 0.2)",
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 2,
          tension: 0.4
        }
      ]
    },
    retentionBySegment: {
      labels: ["Enterprise", "SMB", "Startup", "Education"],
      datasets: [
        {
          label: "Churned",
          data: [45, 120, 85, 65],
          backgroundColor: "rgba(239, 68, 68, 0.7)",
          borderColor: "rgba(239, 68, 68, 1)",
          borderWidth: 1
        },
        {
          label: "Retained",
          data: [955, 880, 915, 935],
          backgroundColor: "rgba(16, 185, 129, 0.7)",
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 1
        }
      ]
    },
    revenueImpact: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"],
      datasets: [
        {
          label: "Revenue Lost ($K)",
          data: [52, 48, 51, 63, 71, 68, 82, 75],
          backgroundColor: "rgba(239, 68, 68, 0.7)",
          borderColor: "rgba(239, 68, 68, 1)",
          borderWidth: 1
        },
        {
          label: "Revenue Retained ($K)",
          data: [948, 952, 949, 937, 929, 932, 918, 925],
          backgroundColor: "rgba(16, 185, 129, 0.7)",
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 1
        }
      ]
    },
    churnReasons: {
      labels: ["Price", "Competitor", "Features", "Support", "Other"],
      datasets: [{
        label: "Churn Reasons",
        data: [45, 30, 15, 8, 2],
        backgroundColor: [
          "rgba(239, 68, 68, 0.7)",
          "rgba(234, 179, 8, 0.7)",
          "rgba(59, 130, 246, 0.7)",
          "rgba(139, 92, 246, 0.7)",
          "rgba(14, 165, 233, 0.7)"
        ],
        borderColor: [
          "rgba(239, 68, 68, 1)",
          "rgba(234, 179, 8, 1)",
          "rgba(59, 130, 246, 1)",
          "rgba(139, 92, 246, 1)",
          "rgba(14, 165, 233, 1)"
        ],
        borderWidth: 1
      }]
    }
  };

  const cohortData = [
    {
      cohort: "Jan 2024",
      "1m": "95%",
      "3m": "88%",
      "6m": "82%",
      "12m": "75%"
    },
    {
      cohort: "Feb 2024",
      "1m": "96%",
      "3m": "89%",
      "6m": "83%",
      "12m": "-"
    },
    {
      cohort: "Mar 2024",
      "1m": "94%",
      "3m": "87%",
      "6m": "-",
      "12m": "-"
    },
    {
      cohort: "Apr 2024",
      "1m": "93%",
      "3m": "-",
      "6m": "-",
      "12m": "-"
    },
    {
      cohort: "May 2024",
      "1m": "92%",
      "3m": "-",
      "6m": "-",
      "12m": "-"
    }
  ];

  const kpiData = [
    {
      title: "Churn Rate",
      value: "7.5%",
      change: "+1.2%",
      isPositive: false,
      icon: <FiTrendingDown />,
      description: "Percentage of customers lost",
      componentPath: "/sales-performance-table"
    },
    {
      title: "Retention Rate",
      value: "92.5%",
      change: "-1.2%",
      isPositive: false,
      icon: <FiTrendingDown />,
      description: "Percentage of customers retained",
      componentPath: "/sales-performance-table"
    },
    {
      title: "Revenue Lost",
      value: "$75K",
      change: "+$7K",
      isPositive: false,
      icon: <FiDollarSign />,
      description: "MRR lost from churn",
      componentPath: "/sales-performance-table"
    },
    {
      title: "Avg Tenure",
      value: "22",
      change: "-2",
      isPositive: false,
      icon: <FiUser />,
      description: "Average months before churn",
      componentPath: "/sales-performance-table"
    }
  ];

  const toggleChartType = (chartId, type) => {
    setSelectedChartType(prev => ({ ...prev, [chartId]: type }));
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
              onClick={() =>  setShowAIDropdown(showAIDropdown === widgetId ? null : widgetId)} 
              className="p-1 rounded hover:bg-gray-100" 
              data-tooltip-id="ai-tooltip" 
              data-tooltip-content="Ask AI"
            >
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

  const KPICard = ({ title, value, change, isPositive, icon, componentPath, description }) => {
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
            <p className="text-s font-bold text-sky-900 mt-1">{value}</p>
            <div className={`flex items-center mt-2 ${isPositive ? "text-green-500" : "text-red-500"}`}>
              <span className="text-[10px] font-medium">{change} {isPositive ? "↑" : "↓"} vs last period</span>
            </div>
            <div className="mt-1">
              <p className="text-[10px] text-gray-500">{description}</p>
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
                      <Link to="/sales-performance-dashboard" className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                        Sales Dashboard
                      </Link>
                    </div>
                  </li>
                  <li aria-current="page">
                    <div className="flex items-center">
                      <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
                      <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Churn Retention</span>
                    </div>
                  </li>
                </ol>
              </nav>
        
      {/* Header */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Churn & Retention Analysis</h1>
            <p className="text-sky-100 text-x">Lost Revenue & Retained Customers Per Period</p>
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

      {/* Filters */}
      {showFilters && (
        <div className="bg-white p-4 rounded-lg shadow-sm" ref={filtersRef}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <label className="block text-s font-medium text-gray-700 mb-1">Customer Segment</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.segment}
                onChange={(e) => setFilters({...filters, segment: e.target.value})}
              >
                <option>All Segments</option>
                <option>Enterprise</option>
                <option>SMB</option>
                <option>Startup</option>
                <option>Education</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Product</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.product}
                onChange={(e) => setFilters({...filters, product: e.target.value})}
              >
                <option>All Products</option>
                <option>Data Science</option>
                <option>Computer Science</option>
                <option>Business</option>
                <option>Arts</option>
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
          />
        ))}
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Churn Trend */}
        <EnhancedChartCard 
          title="Monthly Churn & Retention Rate" 
          chartType={selectedChartType.churnTrend} 
          chartData={{
            data: churnData.churnTrend,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom' }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  max: 100,
                  title: {
                    display: true,
                    text: 'Percentage (%)'
                  }
                }
              }
            }
          }} 
          widgetId="churnTrend" 
          index={0} 
          componentPath="/sales-performance-table" 
        />

        {/* Retention by Segment */}
        <EnhancedChartCard 
          title="Churned vs Retained by Segment" 
          chartType={selectedChartType.retentionBySegment} 
          chartData={{
            data: churnData.retentionBySegment,
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
                    text: 'Number of Customers'
                  }
                }
              }
            }
          }} 
          widgetId="retentionBySegment" 
          index={1} 
          componentPath="/sales-performance-table" 
        />
      </div>

      {/* Secondary Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Impact */}
        <EnhancedChartCard 
          title="Revenue Lost vs Retained" 
          chartType="bar" 
          chartData={{
            data: churnData.revenueImpact,
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
                    text: 'Revenue ($K)'
                  }
                }
              }
            }
          }} 
          widgetId="revenueImpact" 
          index={2} 
          componentPath="/sales-performance-table" 
        />

        {/* Churn Reasons */}
        <EnhancedChartCard 
          title="Primary Churn Reasons" 
          chartType="doughnut" 
          chartData={{
            data: churnData.churnReasons,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'right' }
              }
            }
          }} 
          widgetId="churnReasons" 
          index={3} 
          componentPath="/sales-performance-table" 
        />
      </div>

      {/* Cohort Analysis Table */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">Customer Cohort Retention</h3>
          
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-s text-left text-gray-700">
            <thead className="text-x text-sky-700 uppercase bg-sky-50">
              <tr>
                <th className="px-4 py-2">Cohort</th>
                <th className="px-4 py-2">1 Month</th>
                <th className="px-4 py-2">3 Months</th>
                <th className="px-4 py-2">6 Months</th>
                <th className="px-4 py-2">12 Months</th>
              </tr>
            </thead>
            <tbody>
              {cohortData.map((row, i) => (
                <tr key={i} className="border-b hover:bg-sky-50">
                  <td className="px-4 py-2 font-medium">{row.cohort}</td>
                  <td className={`px-4 py-2 ${
                    parseFloat(row["1m"]) > 94 ? "text-green-500" : 
                    parseFloat(row["1m"]) > 92 ? "text-amber-500" : "text-red-500"
                  }`}>{row["1m"]}</td>
                  <td className={`px-4 py-2 ${
                    parseFloat(row["3m"] || 0) > 88 ? "text-green-500" : 
                    parseFloat(row["3m"] || 0) > 85 ? "text-amber-500" : "text-red-500"
                  }`}>{row["3m"]}</td>
                  <td className={`px-4 py-2 ${
                    parseFloat(row["6m"] || 0) > 82 ? "text-green-500" : 
                    parseFloat(row["6m"] || 0) > 80 ? "text-amber-500" : "text-red-500"
                  }`}>{row["6m"]}</td>
                  <td className={`px-4 py-2 ${
                    parseFloat(row["12m"] || 0) > 75 ? "text-green-500" : 
                    parseFloat(row["12m"] || 0) > 70 ? "text-amber-500" : "text-red-500"
                  }`}>{row["12m"]}</td>
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

export default ChurnRetention;