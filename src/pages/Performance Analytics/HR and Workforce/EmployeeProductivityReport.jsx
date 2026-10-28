import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { motion } from "framer-motion";
import { 
  FiTrendingUp, 
  FiTrendingDown, 
  FiChevronRight,
  FiDollarSign,
  FiUsers, 
  FiCalendar, 
  FiClock, 
  FiPieChart,
  FiFilter,
  FiPlus,
  FiChevronDown,
  FiSend,
  FiUser,
  FiRefreshCw,
  FiAlertCircle
} from "react-icons/fi";
import { BsStars, BsThreeDotsVertical, BsLightningFill } from "react-icons/bs";
import { Tooltip as ReactTooltip } from "react-tooltip";
import { RiDragMove2Fill } from "react-icons/ri";
import { GrLinkNext } from "react-icons/gr";
import { getDecimalPrecision } from '../../../utils/formatters';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
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

const kpiData = {
  revenuePerEmployee: { 
    value: 125000, 
    change: "+8%", 
    componentPath: "/hr-workforce-table", 
    forecast: "$132K predicted next quarter",
    definition: "Total revenue divided by number of full-time employees"
  },
  outputPerEmployee: { 
    value: 420, 
    change: "+5%", 
    componentPath: "/hr-workforce-table", 
    forecast: "440 units predicted next quarter",
    definition: "Total output units divided by number of employees"
  },
  absenteeismRate: { 
    value: 3.2, 
    change: "-0.5", 
    componentPath: "/hr-workforce-table", 
    forecast: "2.9% predicted next quarter",
    definition: "Percentage of unplanned days off"
  },
  spanOfControl: { 
    value: 6.8, 
    change: "+0.3", 
    componentPath: "/hr-workforce-table", 
    forecast: "7.0 predicted next quarter",
    definition: "Average number of direct reports per manager"
  },
  overtimeRate: { 
    value: 12.5, 
    change: "+2.1", 
    componentPath: "/hr-workforce-table", 
    forecast: "13.8% predicted next quarter",
    definition: "Percentage of hours worked as overtime"
  },
};

const charts = {
  revenuePerDept: {
    title: "Revenue per Employee by Department",
    componentPath: "/hr-workforce-table",
    data: {
      labels: ["Sales", "Marketing", "Engineering", "Customer Support", "Finance", "HR"],
      datasets: [
        { 
          label: "Revenue per Employee (K)", 
          data: [215, 180, 195, 120, 150, 110], 
          backgroundColor: "rgba(59, 130, 246, 0.7)", 
          borderColor: "rgba(59, 130, 246, 1)", 
          borderWidth: 1 
        }
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: $${context.raw}K`;
            }
          }
        }
      },
    },
  },
  productivityTrend: {
    title: "Productivity Trends Over the Last 12 Months",
    componentPath: "/hr-workforce-table",
    data: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      datasets: [
        { 
          label: "Revenue per Employee (K)", 
          data: [110, 115, 112, 118, 120, 122, 125, 123, 127, 130, 128, 125], 
          backgroundColor: "rgba(59, 130, 246, 0.2)", 
          borderColor: "rgba(59, 130, 246, 1)", 
          borderWidth: 2,
          tension: 0.4 
        },
        { 
          label: "Output per Employee", 
          data: [380, 390, 385, 400, 405, 410, 415, 420, 425, 430, 425, 420], 
          backgroundColor: "rgba(16, 185, 129, 0.2)", 
          borderColor: "rgba(16, 185, 129, 1)", 
          borderWidth: 2,
          tension: 0.4 
        },
        { 
          label: "Absenteeism Rate (%)", 
          data: [4.2, 4.0, 3.8, 3.5, 3.2, 3.0, 2.8, 2.9, 3.0, 3.1, 3.2, 3.2], 
          backgroundColor: "rgba(239, 68, 68, 0.2)", 
          borderColor: "rgba(239, 68, 68, 1)", 
          borderWidth: 2,
          tension: 0.4 
        }
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
    },
  },
  
  outputHeatmap: {
    title: "Output per Employee by Role & Business Unit",
    componentPath: "/hr-workforce-table",
    data: {
      labels: ["Sales", "Marketing", "Engineering", "Customer Support"],
      datasets: [
        { label: "Junior", data: [320, 280, 350, 290], backgroundColor: "rgba(16, 185, 129, 0.7)" },
        { label: "Mid-level", data: [420, 380, 450, 390], backgroundColor: "rgba(234, 179, 8, 0.7)" },
        { label: "Senior", data: [520, 480, 550, 490], backgroundColor: "rgba(239, 68, 68, 0.7)" },
        { label: "Manager", data: [450, 420, 480, 430], backgroundColor: "rgba(139, 92, 246, 0.7)" }
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label} ${context.label}: ${context.raw} units`;
            }
          }
        }
      },
    },
  },
};

const aiInsights = [
  {
    title: "Marketing Productivity Drop",
    content: "Marketing department shows consistent productivity drop and higher absenteeism — investigate workload distribution.",
    severity: "warning",
    reasoning: "Based on 3-month trend of 15% lower output and 25% higher absenteeism compared to other departments."
  },
  {
    title: "Attrition Risk Detected",
    content: "AI predicts 3 teams may face attrition risks due to low engagement + overtime trends.",
    severity: "critical",
    reasoning: "Teams with >20% overtime and <70% engagement scores have 85% correlation with attrition."
  },
  {
    title: "Training Opportunity",
    content: "Suggested training for underperforming roles in Sales based on skill gap analysis.",
    severity: "opportunity",
    reasoning: "Junior sales roles show 30% lower output than industry benchmarks with similar tenure."
  }
];

const recommendations = [
  {
    title: "Increase Span of Control",
    content: "Increase span of control in Finance team to industry benchmark of 8 direct reports per manager.",
    metric: "Current: 5.2 | Benchmark: 8.0",
    icon: <FiUsers />
  },
  {
    title: "Optimize Overtime",
    content: "Optimize overtime scheduling in Customer Support to reduce burnout and absenteeism.",
    metric: "Current overtime: 18% | Target: <12%",
    icon: <FiClock />
  },
  {
    title: "Cross-Training Program",
    content: "Invest in cross-training for Sales Assistants based on output gaps identified.",
    metric: "Output gap: 22% below team average",
    icon: <BsLightningFill />
  }
];

const EmployeeProductivityReport = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    timePeriod: "Last Quarter",
    department: "All Departments",
    businessUnit: "All Units",
    role: "All Roles"
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const [aiInput, setAiInput] = useState({});
  const filtersRef = useRef(null);

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

  const KPICard = ({ title, value, change, isPositive, icon, componentPath, forecast, definition }) => {
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
              <p className="text-[10px] font-semibold text-sky-600 uppercase tracking-wider truncate">
                {title}
                <span 
                  className="ml-1 text-gray-400 cursor-help" 
                  data-tooltip-id={`${title}-tooltip`} 
                  data-tooltip-content={definition}
                >
                  <FiAlertCircle size={12} />
                </span>
              </p>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowAIDropdown(!showAIDropdown); }} 
                className="p-1 rounded hover:bg-gray-100" 
                data-tooltip-id="ai-tooltip" 
                data-tooltip-content="Ask AI"
              >
                <BsStars />
              </button>
              {showAIDropdown && (
                <div 
                  ref={dropdownRef} 
                  className="absolute right-0 top-5 mt-2 w-full sm:w-44 bg-white rounded-md shadow-lg z-10 border border-gray-200 p-2" 
                  onClick={(e) => e.stopPropagation()}
                >
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
            <p className="text-s font-bold text-sky-900 mt-1">
              {title === "Revenue per Employee" && "$"}
              {typeof value === "number" ? 
                title.includes("Rate") || title.includes("Ratio") ? 
                  `${value}%` : 
                  value.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }) : 
                value}
              {title === "Span of Control" && " reports"}
            </p>
            <div className={`flex items-center mt-2 ${isPositive ? "text-green-500" : "text-red-500"}`}>
              {isPositive ? <FiTrendingUp className="mr-1" /> : <FiTrendingDown className="mr-1" />}
              <span className="text-[10px] font-medium">{change} vs last period</span>
            </div>
            <div className="mt-1">
              <p className="text-[10px] text-gray-500 italic">AI Forecast: {forecast}</p>
            </div>
          </div>
          <div className="p-2 rounded-full bg-sky-100 hover:bg-sky-200 transition-colors duration-200">
            <div className="text-sky-600 hover:text-sky-800 transition-colors duration-200">{icon}</div>
          </div>
        </div>
        <ReactTooltip id={`${title}-tooltip`} place="top" effect="solid" />
        <ReactTooltip id="ai-tooltip" place="top" effect="solid" />
      </motion.div>
    );
  };

  const EnhancedChartCard = ({ title, chartType, chartData, widgetId, index, componentPath }) => {
    const dropdownRef = useOutsideClick(() => setShowAIDropdown(null));
    
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border border-sky-100">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-md font-semibold text-sky-800">{title}</h3>
          <div className="flex space-x-2 relative">
            <button 
              onClick={() => setShowAIDropdown(showAIDropdown === widgetId ? null : widgetId)} 
              className="p-1 rounded hover:bg-gray-100" 
              data-tooltip-id="ai-tooltip" 
              data-tooltip-content="Ask AI"
            >
              <BsStars />
            </button>
            {showAIDropdown === widgetId && (
              <div 
                ref={dropdownRef} 
                className="absolute right-0 top-5 mt-2 w-full sm:w-64 bg-white rounded-md shadow-lg z-10 border border-gray-200 py-2"
              >
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
          </div>
        </div>
        <div className="h-48">
          {renderChart(chartType, chartData.data, chartData.options)}
        </div>
      </div>
    );
  };

  const ProductivityTable = () => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
      <h3 className="text-s font-semibold text-sky-800 mb-2">Employee Productivity Breakdown</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-x text-gray-700">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left">Department</th>
              <th className="p-2 text-left">Revenue/Employee</th>
              <th className="p-2 text-left">Output/Employee</th>
              <th className="p-2 text-left">Absenteeism Rate</th>
              <th className="p-2 text-left">Overtime Cost</th>
              <th className="p-2 text-left">Span of Control</th>
            </tr>
          </thead>
          <tbody>
            {[
              { department: "Sales", revenue: "$215K", output: "420", absenteeism: "2.8%", overtime: "$12K", span: "7.2" },
              { department: "Marketing", revenue: "$180K", output: "380", absenteeism: "4.2%", overtime: "$18K", span: "5.5" },
              { department: "Engineering", revenue: "$195K", output: "450", absenteeism: "2.5%", overtime: "$15K", span: "6.8" },
              { department: "Customer Support", revenue: "$120K", output: "390", absenteeism: "3.5%", overtime: "$22K", span: "8.0" },
              { department: "Finance", revenue: "$150K", output: "410", absenteeism: "2.2%", overtime: "$8K", span: "5.2" },
              { department: "HR", revenue: "$110K", output: "350", absenteeism: "3.0%", overtime: "$5K", span: "7.5" }
            ].map((row, i) => (
              <tr key={i} className="border-b hover:bg-sky-50">
                <td className="p-2">{row.department}</td>
                <td className="p-2">{row.revenue}</td>
                <td className="p-2">{row.output}</td>
                <td className={`p-2 ${parseFloat(row.absenteeism) > 3.5 ? "text-red-500" : "text-green-500"}`}>{row.absenteeism}</td>
                <td className="p-2">{row.overtime}</td>
                <td className="p-2">{row.span}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between items-center mt-2 text-x">
        <span>Showing 1 to 6 of 6 entries</span>
        {/* <div className="flex space-x-1">
          <button className="px-2 py-1 border rounded">Previous</button>
          <button className="px-2 py-1 border rounded bg-sky-500 text-white">1</button>
          <button className="px-2 py-1 border rounded">Next</button>
        </div> */}
      </div>
    </div>
  );

  const WorkforceSummary = () => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
      <h3 className="text-s font-semibold text-sky-800 mb-2">Workforce Composition</h3>
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-sky-50 p-3 rounded-lg">
          <p className="text-x text-sky-600">Total Headcount</p>
          <p className="text-lg font-bold text-sky-800">245</p>
          <p className="text-x text-gray-500">(220 FTE, 25 Contractors)</p>
        </div>
        <div className="bg-sky-50 p-3 rounded-lg">
          <p className="text-x text-sky-600">Avg Tenure</p>
          <p className="text-lg font-bold text-sky-800">3.2 yrs</p>
          <p className="text-x text-gray-500">(+0.4 vs last year)</p>
        </div>
        <div className="bg-sky-50 p-3 rounded-lg">
          <p className="text-x text-sky-600">Turnover Rate</p>
          <p className="text-lg font-bold text-sky-800">8.5%</p>
          <p className="text-x text-gray-500">(-1.2% vs industry)</p>
        </div>
        <div className="bg-sky-50 p-3 rounded-lg">
  <p className="text-x text-sky-600">HR-to-Employee Ratio</p>
  <p className="text-lg font-bold text-sky-800">1:45</p>
  <p className="text-x text-gray-500">(Industry avg: 1:50)</p>
</div>
        <div className="bg-sky-50 p-3 rounded-lg">
          <p className="text-x text-sky-600">Avg Age</p>
          <p className="text-lg font-bold text-sky-800">34</p>
          <p className="text-x text-gray-500">(Range: 22-58)</p>
        </div>
      </div>
    </div>
  );

  const AIInsightCard = ({ title, content, severity, reasoning }) => {
    const [showReasoning, setShowReasoning] = useState(false);
    
    return (
      <motion.div 
        variants={cardVariants}
        className={`p-3 rounded-lg shadow-sm border ${
          severity === "critical" ? "border-red-200 bg-red-50" :
          severity === "warning" ? "border-yellow-200 bg-yellow-50" :
          "border-green-200 bg-green-50"
        }`}
      >
        <div className="flex items-start">
          <div className={`p-1 rounded-full mr-2 ${
            severity === "critical" ? "bg-red-100 text-red-600" :
            severity === "warning" ? "bg-yellow-100 text-yellow-600" :
            "bg-green-100 text-green-600"
          }`}>
            <BsStars size={14} />
          </div>
          <div className="flex-1">
            <h4 className="text-s font-semibold">{title}</h4>
            <p className="text-x">{content}</p>
            <button 
              onClick={() => setShowReasoning(!showReasoning)} 
              className="text-x text-sky-600 mt-1 flex items-center"
            >
              {showReasoning ? "Hide reasoning" : "Why this insight?"}
              <FiChevronDown className={`ml-1 transition-transform ${showReasoning ? "rotate-180" : ""}`} />
            </button>
            {showReasoning && (
              <div className="mt-2 p-2 bg-white rounded text-x text-gray-600 border border-gray-200">
                {reasoning}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const RecommendationCard = ({ title, content, metric, icon }) => (
    <motion.div 
      variants={cardVariants}
      className="bg-white p-3 rounded-lg shadow-sm border border-sky-100 hover:shadow-md transition-all"
    >
      <div className="flex items-start">
        <div className="p-2 rounded-full bg-sky-100 text-sky-600 mr-2">
          {icon}
        </div>
        <div className="flex-1">
          <h4 className="text-s font-semibold text-sky-800">{title}</h4>
          <p className="text-x text-gray-600 mb-1">{content}</p>
          <p className="text-x text-gray-500 font-medium">{metric}</p>
        </div>
      </div>
    </motion.div>
  );

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
                              <Link to="/hr-workforce" className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                                HR & Workforce
                              </Link>
                            </div>
                          </li>
                          <li aria-current="page">
                            <div className="flex items-center">
                              <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
                              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Employee Productivity Report</span>
                            </div>
                          </li>
                        </ol>
                      </nav>
      {/* Header Section */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Employee Productivity Report</h1>
            <p className="text-sky-100 text-x mt-1">Data showing from 01/01/24 - 03/31/24</p>
          </div>
          <div className="flex space-x-2">
            <button 
              type="button" 
              className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200" 
              onClick={() => setShowFilters(!showFilters)}
            >
              <FiFilter className="mr-1" /> Filters
            </button>
             <Link
     to="/hr-workforce-table">
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

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white p-4 rounded-lg shadow-sm" ref={filtersRef}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {["Time Period", "Department", "Business Unit", "Role"].map((filter, i) => (
              <div key={i}>
                <label className="block text-s font-medium text-gray-700 mb-1">{filter}</label>
                <select 
                  className="w-full p-2 border border-gray-300 rounded-md text-s"
                  value={filters[filter.toLowerCase().replace(" ", "")]}
                  onChange={(e) => setFilters({...filters, [filter.toLowerCase().replace(" ", "")]: e.target.value})}
                >
                  <option>All {filter === "Time Period" ? "Periods" : filter + "s"}</option>
                  {filter === "Department" && ["Sales", "Marketing", "Engineering", "Customer Support", "Finance", "HR"].map(opt => <option key={opt}>{opt}</option>)}
                  {filter === "Business Unit" && ["North America", "Europe", "Asia", "Global"].map(opt => <option key={opt}>{opt}</option>)}
                  {filter === "Role" && ["Junior", "Mid-level", "Senior", "Manager", "Executive"].map(opt => <option key={opt}>{opt}</option>)}
                  {filter === "Time Period" && ["Last Quarter", "Last Month", "Last Week", "Year to Date", "Custom Range"].map(opt => <option key={opt}>{opt}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-4 space-x-2">
            <button className="px-4 py-2 text-s bg-gray-200 rounded hover:bg-gray-300">Reset</button>
            <button className="px-4 py-2 text-s bg-blue-600 text-white rounded hover:bg-blue-700">Apply Filters</button>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {Object.entries(kpiData).map(([key, value], index) => (
          <KPICard
            key={key}
            title={key.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase())}
            value={value.value}
            change={value.change}
            isPositive={value.change?.startsWith("+")}
            icon={
              key === "revenuePerEmployee" ? <FiDollarSign size={16} /> :
              key === "outputPerEmployee" ? <FiPieChart size={16} /> :
              key === "absenteeismRate" ? <FiCalendar size={16} /> :
              key === "spanOfControl" ? <FiUsers size={16} /> :
              <FiClock size={16} />
            }
            componentPath={value.componentPath}
            forecast={value.forecast}
            definition={value.definition}
          />
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EnhancedChartCard 
          title={charts.revenuePerDept.title} 
          chartType="bar" 
          chartData={charts.revenuePerDept} 
          widgetId="revenuePerDept" 
          index={0}
          componentPath={charts.revenuePerDept.componentPath}
        />
        <EnhancedChartCard 
          title={charts.productivityTrend.title} 
          chartType="line" 
          chartData={charts.productivityTrend} 
          widgetId="productivityTrend" 
          index={1}
          componentPath={charts.productivityTrend.componentPath}
        />
        <EnhancedChartCard 
          title={charts.outputHeatmap.title} 
          chartType="bar" 
          chartData={charts.outputHeatmap} 
          widgetId="outputHeatmap" 
          index={2}
          componentPath={charts.outputHeatmap.componentPath}
        />
      </div>


  {/* Tables Section - Single Column Layout */}
<div className="space-y-6">

  <div>
    <ProductivityTable />
  </div>

  <div>
    <WorkforceSummary />
  </div>

  {/* Side-by-side: AI Insights and Recommendations */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    {/* AI-driven Insights */}
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-sky-800">AI-Driven Insights</h3>
      <div className="space-y-3">
        {aiInsights.map((insight, index) => (
          <AIInsightCard 
            key={index}
            title={insight.title}
            content={insight.content}
            severity={insight.severity}
            reasoning={insight.reasoning}
          />
        ))}
      </div>
    </div>

    {/* Recommendations */}
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-sky-800">Recommendations</h3>
      <div className="space-y-3">
        {recommendations.map((rec, index) => (
          <RecommendationCard 
            key={index}
            title={rec.title}
            content={rec.content}
            metric={rec.metric}
            icon={rec.icon}
          />
        ))}
      </div>
    </div>
  </div>
</div>



      {/* Footer Section */}
      {/* <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100 text-x text-gray-500">
        <h3 className="text-s font-semibold text-sky-800 mb-2">Notes & Definitions</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Revenue per Employee:</strong> Total revenue divided by number of full-time equivalent employees</li>
          <li><strong>Output per Employee:</strong> Department-specific output metrics normalized per employee</li>
          <li><strong>Absenteeism Rate:</strong> Percentage of unplanned days off excluding approved PTO</li>
          <li><strong>AI Forecasts:</strong> Based on historical trends with 85% confidence interval</li>
          <li>Data sources: HRMS (Workday), Payroll (ADP), CRM (Salesforce)</li>
        </ul>
      </div> */}

      
    </div>
  );
};

export default EmployeeProductivityReport;