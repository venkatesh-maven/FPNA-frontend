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
  FiDownload,
  FiFilter, 
  FiDollarSign,
  FiUsers,
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

const MarketingCampaign = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    timePeriod: "Last Quarter",
    channel: "All Channels",
    campaignType: "All Types"
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedChartType, setSelectedChartType] = useState({
    spendVsLeads: "bar",
    roiTrend: "line"
  });
  const [aiInput, setAiInput] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const filtersRef = useRef(null);

  // Sample data for marketing campaign metrics
  const campaignData = {
    spendVsLeads: {
      labels: ["Q1", "Q2", "Q3", "Q4"],
      datasets: [
        {
          label: "Ad Spend ($K)",
          data: [85, 92, 105, 120],
          backgroundColor: "rgba(59, 130, 246, 0.7)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 1,
          yAxisID: 'y'
        },
        {
          label: "Leads Generated",
          data: [1250, 1420, 1580, 1850],
          backgroundColor: "rgba(16, 185, 129, 0.7)",
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 1,
          yAxisID: 'y1'
        }
      ]
    },
    roiTrend: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"],
      datasets: [
        {
          label: "Campaign ROI (%)",
          data: [120, 135, 142, 130, 145, 158, 165, 172],
          backgroundColor: "rgba(139, 92, 246, 0.2)",
          borderColor: "rgba(139, 92, 246, 1)",
          borderWidth: 2,
          tension: 0.4
        },
        {
          label: "AI Forecast",
          data: [null, null, null, null, null, null, 165, 172],
          backgroundColor: "rgba(139, 92, 246, 0.1)",
          borderColor: "rgba(139, 92, 246, 0.5)",
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.4,
          pointRadius: 0
        }
      ]
    },
    channelPerformance: {
      labels: ["Paid Search", "Social Ads", "Email", "Content", "Events"],
      datasets: [
        {
          label: "Cost per Lead ($)",
          data: [45, 38, 22, 28, 65],
          backgroundColor: "rgba(239, 68, 68, 0.7)",
          borderColor: "rgba(239, 68, 68, 1)",
          borderWidth: 1
        },
        {
          label: "ROI (%)",
          data: [150, 135, 180, 160, 110],
          backgroundColor: "rgba(16, 185, 129, 0.7)",
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 1
        }
      ]
    },
    roiByCampaignType: {
      labels: ["Awareness", "Consideration", "Conversion", "Retention"],
      datasets: [{
        label: "ROI (%)",
        data: [110, 140, 175, 195],
        backgroundColor: [
          "rgba(59, 130, 246, 0.7)",
          "rgba(16, 185, 129, 0.7)",
          "rgba(234, 179, 8, 0.7)",
          "rgba(139, 92, 246, 0.7)"
        ],
        borderColor: [
          "rgba(59, 130, 246, 1)",
          "rgba(16, 185, 129, 1)",
          "rgba(234, 179, 8, 1)",
          "rgba(139, 92, 246, 1)"
        ],
        borderWidth: 1
      }]
    }
  };

  const kpiData = [
    {
      title: "Total Ad Spend",
      value: "$402K",
      change: "+15%",
      isPositive: false,
      icon: <FiDollarSign />,
      description: "Total marketing spend this year",
      forecast: "$450K predicted next quarter",
      componentPath: "/sales-performance-table"
    },
    {
      title: "Leads Generated",
      value: "6,100",
      change: "+22%",
      isPositive: true,
      icon: <FiUsers />,
      description: "Total leads from campaigns",
      forecast: "6,800 predicted next quarter",
      componentPath: "/sales-performance-table"
    },
    {
      title: "Avg CPL",
      value: "$66",
      change: "-8%",
      isPositive: true,
      icon: <FiTrendingDown />,
      description: "Cost per lead",
      forecast: "$62 predicted next quarter",
      componentPath: "/sales-performance-table"
    },
    {
      title: "Avg ROI",
      value: "145%",
      change: "+12%",
      isPositive: true,
      icon: <FiPieChart />,
      description: "Return on ad spend",
      forecast: "155% predicted next quarter",
      componentPath: "/sales-performance-table"
    }
  ];

  const campaignTableData = [
    {
      campaign: "Summer Sale 2024",
      channel: "Paid Search",
      spend: "$45,000",
      leads: 850,
      cpl: "$53",
      cac: "$210",
      roi: "185%",
      type: "Conversion"
    },
    {
      campaign: "Product Webinar",
      channel: "Email",
      spend: "$18,000",
      leads: 620,
      cpl: "$29",
      cac: "$150",
      roi: "210%",
      type: "Consideration"
    },
    {
      campaign: "Brand Awareness",
      channel: "Social Ads",
      spend: "$32,000",
      leads: 480,
      cpl: "$67",
      cac: "$280",
      roi: "120%",
      type: "Awareness"
    },
    {
      campaign: "Customer Newsletter",
      channel: "Email",
      spend: "$12,000",
      leads: 720,
      cpl: "$17",
      cac: "$90",
      roi: "195%",
      type: "Retention"
    },
    {
      campaign: "Industry Conference",
      channel: "Events",
      spend: "$28,000",
      leads: 320,
      cpl: "$88",
      cac: "$350",
      roi: "110%",
      type: "Consideration"
    }
  ];

  const engagementMetrics = [
    {
      metric: "Email Open Rate",
      value: "32%",
      trend: "+4%",
      benchmark: "28%"
    },
    {
      metric: "CTR (Paid Ads)",
      value: "2.8%",
      trend: "+0.5%",
      benchmark: "2.5%"
    },
    {
      metric: "Landing Page Conv.",
      value: "24%",
      trend: "+3%",
      benchmark: "22%"
    },
    {
      metric: "Social Engagement",
      value: "4.2%",
      trend: "+0.8%",
      benchmark: "3.8%"
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
                      <Link to="/sales-performance-dashboard" className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                        Sales Dashboard
                      </Link>
                    </div>
                  </li>
                  <li aria-current="page">
                    <div className="flex items-center">
                      <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
                      <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Marketing Campaign</span>
                    </div>
                  </li>
                </ol>
              </nav>
      {/* Header */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Marketing Campaign Performance</h1>
            <p className="text-sky-100 text-x">Ad Spend Efficiency, ROI Analysis</p>
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
              <label className="block text-s font-medium text-gray-700 mb-1">Channel</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.channel}
                onChange={(e) => setFilters({...filters, channel: e.target.value})}
              >
                <option>All Channels</option>
                <option>Paid Search</option>
                <option>Social Ads</option>
                <option>Email</option>
                <option>Content</option>
                <option>Events</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Campaign Type</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.campaignType}
                onChange={(e) => setFilters({...filters, campaignType: e.target.value})}
              >
                <option>All Types</option>
                <option>Awareness</option>
                <option>Consideration</option>
                <option>Conversion</option>
                <option>Retention</option>
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
        {/* Spend vs Leads */}
        <EnhancedChartCard 
          title="Ad Spend vs Leads Generated" 
          chartType={selectedChartType.spendVsLeads} 
          chartData={{
            data: campaignData.spendVsLeads,
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
                    text: 'Ad Spend ($K)'
                  }
                },
                y1: {
                  type: 'linear',
                  display: true,
                  position: 'right',
                  title: {
                    display: true,
                    text: 'Leads Generated'
                  },
                  grid: {
                    drawOnChartArea: false
                  }
                }
              }
            }
          }} 
          widgetId="spendVsLeads" 
          index={0} 
          componentPath="/sales-performance-table" 
        />

        {/* ROI Trend */}
        <EnhancedChartCard 
          title="Campaign ROI Trend with AI Forecast" 
          chartType={selectedChartType.roiTrend} 
          chartData={{
            data: campaignData.roiTrend,
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
                    text: 'ROI (%)'
                  }
                }
              }
            }
          }} 
          widgetId="roiTrend" 
          index={1} 
          componentPath="/sales-performance-table" 
        />
      </div>

      {/* Secondary Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Channel Performance */}
        <EnhancedChartCard 
          title="Cost per Lead & ROI by Channel" 
          chartType="bar" 
          chartData={{
            data: campaignData.channelPerformance,
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
                    text: 'Amount ($) / Percentage (%)'
                  }
                }
              }
            }
          }} 
          widgetId="channelPerformance" 
          index={2} 
          componentPath="/sales-performance-table" 
        />

        {/* ROI by Campaign Type */}
        <EnhancedChartCard 
          title="ROI by Campaign Type" 
          chartType="doughnut" 
          chartData={{
            data: campaignData.roiByCampaignType,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'right' },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      return `${context.label}: ${context.raw}% ROI`;
                    }
                  }
                }
              }
            }
          }} 
          widgetId="roiByCampaignType" 
          index={3} 
          componentPath="/sales-performance-table" 
        />
      </div>

      {/* Campaign Performance Table */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">Campaign Performance Details</h3>
          {/* <button 
            className="flex items-center text-x text-sky-600 hover:text-sky-800"
            onClick={() => navigate("/campaign-performance-detail")}
          >
            View All Campaigns <FiChevronDown className="ml-1" />
          </button> */}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-s text-left text-gray-700">
            <thead className="text-x text-sky-700 uppercase bg-sky-50">
              <tr>
                <th className="px-4 py-2">Campaign</th>
                <th className="px-4 py-2">Channel</th>
                <th className="px-4 py-2">Spend</th>
                <th className="px-4 py-2">Leads</th>
                <th className="px-4 py-2">CPL</th>
                <th className="px-4 py-2">CAC</th>
                <th className="px-4 py-2">ROI</th>
                <th className="px-4 py-2">Type</th>
              </tr>
            </thead>
            <tbody>
              {campaignTableData.map((row, i) => (
                <tr key={i} className="border-b hover:bg-sky-50">
                  <td className="px-4 py-2 font-medium">{row.campaign}</td>
                  <td className="px-4 py-2">{row.channel}</td>
                  <td className="px-4 py-2">{row.spend}</td>
                  <td className="px-4 py-2">{row.leads}</td>
                  <td className={`px-4 py-2 ${
                    parseFloat(row.cpl.replace('$', '')) < 50 ? "text-green-500" : 
                    parseFloat(row.cpl.replace('$', '')) < 75 ? "text-amber-500" : "text-red-500"
                  }`}>{row.cpl}</td>
                  <td className={`px-4 py-2 ${
                    parseFloat(row.cac.replace('$', '')) < 200 ? "text-green-500" : 
                    parseFloat(row.cac.replace('$', '')) < 300 ? "text-amber-500" : "text-red-500"
                  }`}>{row.cac}</td>
                  <td className={`px-4 py-2 font-medium ${
                    parseFloat(row.roi.replace('%', '')) > 175 ? "text-green-500" : 
                    parseFloat(row.roi.replace('%', '')) > 125 ? "text-amber-500" : "text-red-500"
                  }`}>{row.roi}</td>
                  <td className="px-4 py-2">{row.type}</td>
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
          {/* <button 
            className="flex items-center text-x text-sky-600 hover:text-sky-800"
            onClick={() => navigate("/sales-performance-table")}
          >
            View Details <FiChevronDown className="ml-1" />
          </button> */}
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
                placeholder="Ask about campaign performance, optimization..."
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
            <h4 className="text-s font-medium text-sky-800 mb-2">Top Performing Campaign</h4>
            <p className="text-x text-gray-700">"Product Webinar" has the highest ROI at 210%. Consider scaling similar educational content across channels.</p>
          </div>
          <div className="bg-sky-50 p-3 rounded-lg">
            <h4 className="text-s font-medium text-sky-800 mb-2">Channel Optimization</h4>
            <p className="text-x text-gray-700">Email has the lowest CPL at $22. AI recommends increasing email budget by 20% while maintaining quality.</p>
          </div>
          <div className="bg-sky-50 p-3 rounded-lg">
            <h4 className="text-s font-medium text-sky-800 mb-2">Forecast Alert</h4>
            <p className="text-x text-gray-700">ROI expected to reach 155% next quarter. Focus on high-ROI retention campaigns to exceed this projection.</p>
          </div>
        </div>
      </div>

      <ReactTooltip id="chart-type-tooltip" place="top" effect="solid" />
      <ReactTooltip id="ai-tooltip" place="top" effect="solid" />
    </div>
  );
};

export default MarketingCampaign;