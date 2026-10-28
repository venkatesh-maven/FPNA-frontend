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
import { Bar, Line, Doughnut, Pie } from "react-chartjs-2";
import { motion } from "framer-motion";
import { 
  FiTrendingUp, 
  FiTrendingDown, 
  FiFilter, 
  FiDollarSign,
  FiGlobe,
  FiPieChart,
  FiUsers,
  FiSend,
  FiChevronDown,
  FiChevronRight,
  FiRefreshCw,
  FiDownload,
  FiCalendar
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

const RevenueBreakdown = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    timePeriod: "FY 2024 Q1-Q4",
    viewMode: "Actual",
    region: "All Regions"
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDimension, setSelectedDimension] = useState("region");
  const [selectedChartType, setSelectedChartType] = useState({
    revenueBreakdown: "bar",
    productMix: "pie"
  });
  const [aiInput, setAiInput] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const filtersRef = useRef(null);
  const aiChatbotRef = useRef(null);

  // Sample data for 
  
  const revenueData = {
    byRegion: {
      labels: ["North America", "Europe", "Asia", "Africa", "South America"],
      datasets: [
        {
          label: "Actual Revenue ($M)",
          data: [18.0, 12.0, 9.0, 3.0, 2.0],
          backgroundColor: "rgba(59, 130, 246, 0.7)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 1
        },
        {
          label: "Forecast Revenue ($M)",
          data: [20.0, 12.5, 10.2, 3.4, 2.2],
          backgroundColor: "rgba(139, 92, 246, 0.7)",
          borderColor: "rgba(139, 92, 246, 1)",
          borderWidth: 1
        }
      ]
    },
    byProduct: {
      labels: ["Product X", "Product Y", "Product Z", "Product W"],
      datasets: [{
        label: "Revenue ($M)",
        data: [25.6, 12.3, 5.4, 2.3],
        backgroundColor: [
          "rgba(16, 185, 129, 0.7)",
          "rgba(59, 130, 246, 0.7)",
          "rgba(234, 179, 8, 0.7)",
          "rgba(239, 68, 68, 0.7)"
        ],
        borderColor: [
          "rgba(16, 185, 129, 1)",
          "rgba(59, 130, 246, 1)",
          "rgba(234, 179, 8, 1)",
          "rgba(239, 68, 68, 1)"
        ],
        borderWidth: 1
      }]
    },
    bySegment: {
      labels: ["Enterprise", "SMB", "Startup", "Education", "Government"],
      datasets: [{
        label: "Revenue ($M)",
        data: [28.5, 10.2, 3.8, 2.5, 0.6],
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
    bySubscription: {
      labels: ["Recurring", "One-Time"],
      datasets: [{
        label: "Revenue ($M)",
        data: [35.6, 10.0],
        backgroundColor: [
          "rgba(16, 185, 129, 0.7)",
          "rgba(59, 130, 246, 0.7)"
        ],
        borderColor: [
          "rgba(16, 185, 129, 1)",
          "rgba(59, 130, 246, 1)"
        ],
        borderWidth: 1
      }]
    }
  };

  const tableData = {
    byRegion: [
      { dimension: "North America", actual: 18.0, forecast: 20.0, growth: "+11.1%", share: "39.5%" },
      { dimension: "Europe", actual: 12.0, forecast: 12.5, growth: "+4.2%", share: "26.3%" },
      { dimension: "Asia", actual: 9.0, forecast: 10.2, growth: "+13.3%", share: "22.4%" },
      { dimension: "Africa", actual: 3.0, forecast: 3.4, growth: "+13.3%", share: "7.0%" },
      { dimension: "South America", actual: 2.0, forecast: 2.2, growth: "+10.0%", share: "4.8%" }
    ],
    byProduct: [
      { dimension: "Product X", actual: 25.6, forecast: 28.0, growth: "+9.4%", share: "56.1%" },
      { dimension: "Product Y", actual: 12.3, forecast: 13.5, growth: "+9.8%", share: "27.0%" },
      { dimension: "Product Z", actual: 5.4, forecast: 6.0, growth: "+11.1%", share: "11.8%" },
      { dimension: "Product W", actual: 2.3, forecast: 2.5, growth: "+8.7%", share: "5.1%" }
    ],
    bySegment: [
      { dimension: "Enterprise", actual: 28.5, forecast: 31.0, growth: "+8.8%", share: "62.5%" },
      { dimension: "SMB", actual: 10.2, forecast: 11.0, growth: "+7.8%", share: "22.4%" },
      { dimension: "Startup", actual: 3.8, forecast: 4.2, growth: "+10.5%", share: "8.3%" },
      { dimension: "Education", actual: 2.5, forecast: 2.7, growth: "+8.0%", share: "5.5%" },
      { dimension: "Government", actual: 0.6, forecast: 0.7, growth: "+16.7%", share: "1.3%" }
    ],
    bySubscription: [
      { dimension: "Recurring", actual: 35.6, forecast: 39.0, growth: "+9.6%", share: "78.1%" },
      { dimension: "One-Time", actual: 10.0, forecast: 11.0, growth: "+10.0%", share: "21.9%" }
    ]
  };

  const kpiData = [
    {
      title: "Total Revenue",
      value: "$45.6M",
      change: "+12.3%",
      isPositive: true,
      icon: <FiDollarSign />,
      description: "FY 2024 YTD",
      componentPath: "/sales-performance-table"
    },
    {
      title: "YoY Growth",
      value: "+12.3%",
      change: "+2.1%",
      isPositive: true,
      icon: <FiTrendingUp />,
      description: "vs. FY 2023",
      componentPath: "/sales-performance-table"
    },
    {
      title: "Top Region",
      value: "N. America",
      change: "39.5% share",
      isPositive: true,
      icon: <FiGlobe />,
      description: "$18M revenue",
      componentPath: "/sales-performance-table"
    },
    {
      title: "Top Product",
      value: "Product X",
      change: "56.1% share",
      isPositive: true,
      icon: <FiPieChart />,
      description: "$25.6M revenue",
      componentPath: "/sales-performance-table"
    },
    {
      title: "Recurring %",
      value: "78.1%",
      change: "+3.2%",
      isPositive: true,
      icon: <FiUsers />,
      description: "of total revenue",
      componentPath: "/sales-performance-table"
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
      case "pie": return <Pie data={data} options={options} />;
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
                          {["bar", "line", "pie", "doughnut"].map((type) => (
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
                    <div 
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log(`Export ${title} data`);
                        setDropdownWidget(null);
                      }}
                    >
                      <FiDownload className="mr-2" /> Export
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
              <div ref={aiChatbotRef} className="absolute right-0 top-5 mt-2 w-full sm:w-64 bg-white rounded-md shadow-lg z-10 border border-gray-200 py-2">
                <div className="flex flex-col items-center space-x-2">
                  <h1 className="text-x">Ask regarding the {title}</h1>
                  <div className="flex justify-between gap-3">
                    <input type="text" value={aiInput[widgetId] || ""} onChange={(e) => setAiInput(prev => ({ ...prev, [widgetId]: e.target.value }))} placeholder="Ask AI..." className="w-full p-1 border border-gray-300 rounded text-x" />
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

  const getChartDataForDimension = (dimension) => {
    switch (dimension) {
      case "region":
        return {
          data: revenueData.byRegion,
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
                  text: 'Revenue ($M)'
                }
              }
            }
          }
        };
      case "product":
        return {
          data: revenueData.byProduct,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'right' }
            }
          }
        };
      case "segment":
        return {
          data: revenueData.bySegment,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'right' }
            }
          }
        };
      case "subscription":
        return {
          data: revenueData.bySubscription,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'right' }
            }
          }
        };
      default:
        return {
          data: revenueData.byRegion,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom' }
            }
          }
        };
    }
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
              <Link to="/sales-performance-dashboard" className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                Sales Dashboard
              </Link>
            </div>
          </li>
          <li aria-current="page">
            <div className="flex items-center">
              <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Revenue Breakdown</span>
            </div>
          </li>
        </ol>
      </nav>
      
      {/* Header */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Revenue Breakdown</h1>
            <p className="text-sky-100 text-x">Detailed analysis across multiple business dimensions</p>
            <p className="text-sky-100 text-x mt-1">Data showing from Q1 2024 - Q4 2024</p>
          </div>
          <div className="flex space-x-2">
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
          {/* <div className="flex space-x-2">
            <button 
              type="button" 
              className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200" 
              onClick={() => setShowFilters(!showFilters)}
            >
              <FiFilter className="mr-1" /> Filters
            </button>
          </div> */}
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
                <option>FY 2024 Q1-Q4</option>
                <option>FY 2023</option>
                <option>Last Quarter</option>
                <option>Last Month</option>
                <option>Custom Range</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">View Mode</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.viewMode}
                onChange={(e) => setFilters({...filters, viewMode: e.target.value})}
              >
                <option>Actual</option>
                <option>Forecast</option>
                <option>Combined</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Region</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.region}
                onChange={(e) => setFilters({...filters, region: e.target.value})}
              >
                <option>All Regions</option>
                <option>North America</option>
                <option>Europe</option>
                <option>Asia</option>
                <option>Africa</option>
                <option>South America</option>
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
          />
        ))}
      </div>

      {/* Dimension Selector */}
      <div className="bg-white p-3 rounded-lg shadow-sm border border-sky-100">
        <div className="flex flex-wrap gap-2">
          {["region", "product", "segment", "subscription"].map((dimension) => (
            <button
              key={dimension}
              onClick={() => setSelectedDimension(dimension)}
              className={`px-4 py-2 text-x font-medium rounded-full transition-colors duration-200 ${
                selectedDimension === dimension
                  ? "bg-sky-500 text-white"
                  : "bg-sky-100 text-sky-800 hover:bg-sky-200"
              }`}
            >
              {dimension === "region" && <FiGlobe className="inline mr-1" />}
              {dimension === "product" && <FiPieChart className="inline mr-1" />}
              {dimension === "segment" && <FiUsers className="inline mr-1" />}
              {dimension === "subscription" && <FiCalendar className="inline mr-1" />}
              By {dimension.charAt(0).toUpperCase() + dimension.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Main Chart Section */}
      <EnhancedChartCard 
        title={`Revenue by ${selectedDimension.charAt(0).toUpperCase() + selectedDimension.slice(1)}`} 
        chartType={selectedChartType.revenueBreakdown} 
        chartData={getChartDataForDimension(selectedDimension)} 
        widgetId="revenueBreakdown" 
        index={0} 
        componentPath={`/sales-performance-table`} 
      />

      {/* Detailed Table View */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">Detailed Revenue Data</h3>
          <button 
            className="flex items-center text-x text-sky-600 hover:text-sky-800"
            onClick={() => console.log("Export table data")}
          >
            <FiDownload className="mr-1" /> Export
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-s text-left text-gray-700">
            <thead className="text-x text-sky-700 uppercase bg-sky-50">
              <tr>
                <th className="px-4 py-2">{selectedDimension.charAt(0).toUpperCase() + selectedDimension.slice(1)}</th>
                <th className="px-4 py-2">Revenue (Actual)</th>
                <th className="px-4 py-2">Revenue (Forecast)</th>
                <th className="px-4 py-2">Growth %</th>
                <th className="px-4 py-2">Total Share %</th>
              </tr>
            </thead>
            <tbody>
              {tableData[`by${selectedDimension.charAt(0).toUpperCase() + selectedDimension.slice(1)}`]?.map((row, i) => (
                <tr key={i} className="border-b hover:bg-sky-50">
                  <td className="px-4 py-2 font-medium">{row.dimension}</td>
                  <td className="px-4 py-2">${row.actual}M</td>
                  <td className="px-4 py-2">${row.forecast}M</td>
                  <td className={`px-4 py-2 ${
                    parseFloat(row.growth) > 0 ? "text-green-500" : "text-red-500"
                  }`}>{row.growth}</td>
                  <td className="px-4 py-2">{row.share}</td>
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
          {/* <button 
            className="flex items-center text-x text-sky-600 hover:text-sky-800"
            onClick={() => setShowAIDropdown("aiRecommendations")}
          >
            <BsStars className="mr-1" /> Ask Another Question
          </button> */}
        </div>
        {showAIDropdown === "aiRecommendations" && (
          <div className="mb-4 bg-sky-50 p-3 rounded-lg">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={aiInput["aiRecommendations"] || ""}
                onChange={(e) => setAiInput(prev => ({ ...prev, ["aiRecommendations"]: e.target.value }))}
                placeholder="Ask about revenue trends, forecasts, anomalies..."
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
            <h4 className="text-s font-medium text-sky-800 mb-2">Growth Opportunity</h4>
            <p className="text-x text-gray-700">Asia shows the highest growth potential at +13.3%. Consider increasing marketing investment in this region for Q3.</p>
          </div>
          <div className="bg-sky-50 p-3 rounded-lg">
            <h4 className="text-s font-medium text-sky-800 mb-2">Product Concentration</h4>
            <p className="text-x text-gray-700">Product X accounts for 56.1% of revenue. Diversification strategy recommended to reduce dependency.</p>
          </div>
          <div className="bg-sky-50 p-3 rounded-lg">
            <h4 className="text-s font-medium text-sky-800 mb-2">Recurring Revenue Strength</h4>
            <p className="text-x text-gray-700">78.1% recurring revenue indicates strong subscription model. Focus on renewal rates and upsell opportunities.</p>
          </div>
        </div>
      </div>

      <ReactTooltip id="chart-type-tooltip" place="top" effect="solid" />
      <ReactTooltip id="ai-tooltip" place="top" effect="solid" />
    </div>
  );
};

export default RevenueBreakdown;