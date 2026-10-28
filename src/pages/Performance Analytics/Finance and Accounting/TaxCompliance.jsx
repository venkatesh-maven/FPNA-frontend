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
  FiUsers,
  FiChevronDown,
  FiSend,
  FiPieChart,
  FiShield,
  FiAlertTriangle,
  FiFileText,
  FiCheckCircle,
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

const TaxCompliance = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    timePeriod: "Last Quarter",
    taxType: "All Types",
    region: "All Regions",
    riskLevel: "All Levels",
    showOverdueOnly: false
  });
  const [showFilters, setShowFilters] = useState(true);
  const [selectedChartType, setSelectedChartType] = useState({
    complianceTrend: "line",
    filingStatus: "bar"
  });
  const [aiInput, setAiInput] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const filtersRef = useRef(null);

  // Sample data for compliance metrics
  const complianceData = {
    complianceTrend: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"],
      datasets: [
        {
          label: "Compliance Score (%)",
          data: [92, 90, 88, 85, 84, 83, 82, 82],
          backgroundColor: "rgba(59, 130, 246, 0.2)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 2,
          tension: 0.4
        },
        {
          label: "AI Forecast",
          data: [null, null, null, null, null, null, 82, 78],
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderColor: "rgba(59, 130, 246, 0.5)",
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.4,
          pointRadius: 0
        }
      ]
    },
    filingStatus: {
      labels: ["Q1", "Q2", "Q3", "Q4"],
      datasets: [
        {
          label: "Filed",
          data: [28, 25, 22, 18],
          backgroundColor: "rgba(16, 185, 129, 0.7)",
        },
        {
          label: "Pending",
          data: [2, 5, 8, 7],
          backgroundColor: "rgba(234, 179, 8, 0.7)",
        },
        {
          label: "Overdue",
          data: [0, 0, 0, 5],
          backgroundColor: "rgba(239, 68, 68, 0.7)",
        }
      ]
    }
  };

  const kpiData = [
    {
      title: "Compliance Score",
      value: "82%",
      change: "-8%",
      isPositive: false,
      icon: <FiShield />,
      description: "Overall compliance rating",
      forecast: "78% predicted next quarter",
      componentPath: "/finance-accounting-table"
    },
    {
      title: "Penalty Exposure",
      value: "₹3,50,000",
      change: "+45%",
      isPositive: false,
      icon: <FiAlertTriangle />,
      description: "Potential financial risk",
      forecast: "₹4,20,000 if unresolved",
      componentPath: "/finance-accounting-table"
    },
    {
      title: "Pending Returns",
      value: "5",
      change: "+2",
      isPositive: false,
      icon: <FiFileText />,
      description: "Unfiled tax documents",
      forecast: "3 likely to miss deadline",
      componentPath: "/finance-accounting-table"
    },
    {
      title: "On-Time Filing Rate",
      value: "89%",
      change: "+3%",
      isPositive: true,
      icon: <FiCheckCircle />,
      description: "Historical compliance",
      forecast: "91% next quarter",
      componentPath: "/finance-accounting-table"
    }
  ];

  const complianceTableData = [
    {
      entity: "India Finance",
      taxType: "GST Monthly",
      dueDate: "10-May-2025",
      status: "filed",
      daysOverdue: 0,
      penaltyRisk: "₹0",
      riskLevel: "low",
      complianceScore: "98%",
      suggestedAction: "No action needed"
    },
    {
      entity: "US Ops",
      taxType: "Income Tax",
      dueDate: "15-Apr-2025",
      status: "missed",
      daysOverdue: 37,
      penaltyRisk: "₹80,000",
      riskLevel: "high",
      complianceScore: "72%",
      suggestedAction: "File immediately"
    },
    {
      entity: "UK Marketing",
      taxType: "VAT Quarterly",
      dueDate: "05-May-2025",
      status: "pending",
      daysOverdue: -2,
      penaltyRisk: "₹0",
      riskLevel: "medium",
      complianceScore: "88%",
      suggestedAction: "Reminder sent"
    },
    {
      entity: "R&D Division",
      taxType: "TDS Quarterly",
      dueDate: "31-Mar-2025",
      status: "missed",
      daysOverdue: 50,
      penaltyRisk: "₹1,20,000",
      riskLevel: "high",
      complianceScore: "64%",
      suggestedAction: "Investigate reasons"
    }
  ];

  const heatmapData = [
    { department: "Finance", gst: "compliant", incomeTax: "compliant", tds: "compliant", vat: "compliant" },
    { department: "US Ops", gst: "na", incomeTax: "atRisk", tds: "compliant", vat: "na" },
    { department: "UK Marketing", gst: "na", incomeTax: "na", tds: "na", vat: "atRisk" },
    { department: "R&D", gst: "compliant", incomeTax: "compliant", tds: "nonCompliant", vat: "na" }
  ];

  const aiRecommendations = [
    {
      title: "TDS Compliance Issue",
      description: "TDS filings for R&D have been delayed 3 quarters in a row. Recommend centralizing responsibility under Finance Ops.",
      priority: "high"
    },
    {
      title: "US Entity Alert",
      description: "US entity missed filing twice. Suggest setting automated reminders and assigning local compliance head.",
      priority: "medium"
    },
    {
      title: "Score Projection",
      description: "Compliance score projected to drop below 80% next quarter. 3 high-risk filings still pending.",
      priority: "high"
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
                    <div className="relative" onMouseEnter={() => setHoveredChartType(widgetId)} onMouseLeave={() => setHoveredChartType(null)}>
                      <div className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center">
                        All Chart Types <FiChevronDown className="ml-1 text-x" />
                      </div>
                      {hoveredChartType === widgetId && (
                        <div className="absolute top-0 left-full w-40 bg-white rounded-md shadow-lg border border-gray-200 z-20 py-1" style={{ marginLeft: "-1px" }}>
                          {["line", "bar"].map((type) => (
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

  const RiskHeatmap = ({ data }) => {
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <h3 className="text-md font-semibold text-sky-800 mb-4">Compliance Risk by Department</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-s">
            <thead>
              <tr className="text-x text-sky-700 uppercase bg-sky-50">
                <th className="p-2">Department</th>
                <th className="p-2">GST</th>
                <th className="p-2">Income Tax</th>
                <th className="p-2">TDS</th>
                <th className="p-2">VAT</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2 font-medium">{row.department}</td>
                  {['gst', 'incomeTax', 'tds', 'vat'].map((taxType) => (
                    <td key={taxType} className="p-2 text-center">
                      <span className={`inline-block w-6 h-6 rounded-full ${
                        row[taxType] === 'compliant' ? 'bg-green-500' :
                        row[taxType] === 'atRisk' ? 'bg-amber-500' : 
                        row[taxType] === 'nonCompliant' ? 'bg-red-500' : 'bg-gray-300'
                      }`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const ComplianceTable = ({ data }) => {
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">Tax & Compliance Tracking</h3>
          <div className="flex space-x-2">
            <button className="text-x text-sky-600 hover:text-sky-800 flex items-center">
              <FiDownload className="mr-1" /> Export
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-s text-left">
            <thead className="text-x text-sky-700 uppercase bg-sky-50">
              <tr>
                <th className="px-4 py-2">Entity</th>
                <th className="px-4 py-2">Tax Type</th>
                <th className="px-4 py-2">Due Date</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Days Overdue</th>
                <th className="px-4 py-2">Penalty Risk</th>
                <th className="px-4 py-2">AI Forecast</th>
                <th className="px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, i) => (
                <tr key={i} className="border-b hover:bg-sky-50">
                  <td className="px-4 py-2 font-medium">{item.entity}</td>
                  <td className="px-4 py-2">{item.taxType}</td>
                  <td className="px-4 py-2">{item.dueDate}</td>
                  <td className="px-4 py-2">
                    {item.status === 'filed' ? (
                      <span className="text-green-500">✅ Filed</span>
                    ) : item.status === 'pending' ? (
                      <span className="text-amber-500">⏳ Pending</span>
                    ) : (
                      <span className="text-red-500">❌ Missed</span>
                    )}
                  </td>
                  <td className="px-4 py-2">{item.daysOverdue || '-'}</td>
                  <td className="px-4 py-2">{item.penaltyRisk}</td>
                  <td className="px-4 py-2">
                    {item.riskLevel === 'high' ? '🔴 High' : 
                     item.riskLevel === 'medium' ? '🟠 Medium' : '🟢 Low'}
                  </td>
                  <td className="px-4 py-2 text-sky-600 hover:text-sky-800 cursor-pointer">
                    {item.suggestedAction}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const AIRecommendations = ({ recommendations }) => {
    const [showQuery, setShowQuery] = useState(false);
    const [aiInput, setAiInput] = useState("");
    
    const handleSendQuery = () => {
      if (aiInput.trim()) {
        console.log("AI Query:", aiInput);
        setAiInput("");
        setShowQuery(false);
      }
    };

    return (
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">AI Insights & Recommendations</h3>
          <button 
            onClick={() => setShowQuery(!showQuery)}
            className="flex items-center text-x text-sky-600 hover:text-sky-800"
          >
            <BsStars className="mr-1" /> Ask AI
          </button>
        </div>
        
        {showQuery && (
          <div className="mb-4 bg-sky-50 p-3 rounded-lg">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Ask about compliance risks, optimization..."
                className="w-full p-2 border border-gray-300 rounded-md text-s"
              />
              <button
                onClick={handleSendQuery}
                className="p-2 bg-sky-500 text-white rounded hover:bg-sky-600"
                disabled={!aiInput.trim()}
              >
                <FiSend />
              </button>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recommendations.map((rec, i) => (
            <div key={i} className="bg-sky-50 p-3 rounded-lg">
              <h4 className="text-s font-medium text-sky-800 mb-2">{rec.title}</h4>
              <p className="text-x text-gray-700">{rec.description}</p>
              {rec.priority === 'high' && (
                <span className="inline-block mt-2 px-2 py-1 text-x bg-red-100 text-red-800 rounded">
                  High Priority
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
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
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Tax & Compliance</span>
            </div>
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Tax & Compliance Risk Assessments</h1>
            <p className="text-sky-100 text-x">Monitor filings, audit readiness, and compliance status</p>
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Time Period</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.timePeriod}
                onChange={(e) => setFilters({...filters, timePeriod: e.target.value})}
              >
                <option>Last Month</option>
                <option>Last Quarter</option>
                <option>Year to Date</option>
                <option>Custom Range</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Tax Type</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.taxType}
                onChange={(e) => setFilters({...filters, taxType: e.target.value})}
              >
                <option>All Types</option>
                <option>GST</option>
                <option>Income Tax</option>
                <option>TDS</option>
                <option>VAT</option>
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
                <option>India</option>
                <option>US</option>
                <option>UK</option>
                <option>EU</option>
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
            <div className="flex items-end">
              <label className="inline-flex items-center mt-1">
                <input 
                  type="checkbox" 
                  checked={filters.showOverdueOnly}
                  onChange={(e) => setFilters({...filters, showOverdueOnly: e.target.checked})}
                  className="rounded border-gray-300 text-sky-600 shadow-sm focus:border-sky-300 focus:ring focus:ring-offset-0 focus:ring-sky-200 focus:ring-opacity-50"
                />
                <span className="ml-2 text-s text-gray-700">Show Overdue Only</span>
              </label>
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
        {/* Compliance Score Trend */}
        <EnhancedChartCard 
          title="Compliance Score Trend" 
          chartType={selectedChartType.complianceTrend} 
          chartData={{
            data: complianceData.complianceTrend,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom' }
              },
              scales: {
                y: {
                  beginAtZero: false,
                  min: 70,
                  max: 100,
                  title: {
                    display: true,
                    text: 'Score (%)'
                  }
                }
              }
            }
          }} 
          widgetId="complianceTrend" 
          index={0} 
          componentPath="/finance-accounting-table" 
        />

        {/* Filing Status */}
        <EnhancedChartCard 
          title="Filed vs Pending Tax Returns" 
          chartType={selectedChartType.filingStatus} 
          chartData={{
            data: complianceData.filingStatus,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom' }
              },
              scales: {
                x: { stacked: true },
                y: { 
                  stacked: true,
                  title: {
                    display: true,
                    text: 'Number of Returns'
                  }
                }
              }
            }
          }} 
          widgetId="filingStatus" 
          index={1} 
          componentPath="/finance-accounting-table" 
        />
      </div>

      {/* Risk Heatmap */}
      <RiskHeatmap data={heatmapData} />

      {/* Compliance Table */}
      <ComplianceTable data={complianceTableData} />

      {/* AI Recommendations */}
      <AIRecommendations recommendations={aiRecommendations} />

      <ReactTooltip id="chart-type-tooltip" place="top" effect="solid" />
      <ReactTooltip id="ai-tooltip" place="top" effect="solid" />
    </div>
  );
};

export default TaxCompliance;