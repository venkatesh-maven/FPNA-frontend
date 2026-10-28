import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line, Pie, Doughnut } from "react-chartjs-2";
import { motion } from "framer-motion";
import { 
  FiTrendingUp, 
  FiTrendingDown, 
  FiChevronRight,
  FiClock, 
  FiDollarSign, 
  FiPieChart, 
  FiFilter, 
  FiChevronDown, 
  FiSend, 
  FiUser, 
  FiUsers,
  FiAlertCircle,
  FiActivity
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

const kpiData = {
  utilizationRate: { 
    value: 72.5, 
    change: "+3.2", 
    componentPath: "/hr-workforce-table", 
    forecast: "74% predicted next quarter",
    definition: "Billable Hours / Total Available Hours"
  },
  billableRatio: { 
    value: 65, 
    change: "-2.1", 
    componentPath: "/hr-workforce-table", 
    forecast: "63% predicted next quarter",
    definition: "Billable Hours / Total Hours Worked"
  },
  avgOvertime: { 
    value: 8.2, 
    change: "+1.5", 
    componentPath: "/hr-workforce-table", 
    forecast: "9.0 hours predicted next quarter",
    definition: "Average overtime hours per employee"
  },
  overtimeCost: { 
    value: 125000, 
    change: "+18%", 
    componentPath: "/hr-workforce-table", 
    forecast: "$145K predicted next quarter",
    definition: "Total overtime cost for current period"
  },
  peakUtilizationDept: { 
    value: "Consulting", 
    change: "0", 
    componentPath: "/hr-workforce-table", 
    forecast: "No change expected",
    definition: "Department with highest utilization rate"
  },
//   underutilizedTeams: { 
//     value: 3, 
//     change: "-1", 
//     componentPath: "/hr-workforce-table", 
//     forecast: "2 teams predicted next quarter",
//     definition: "Teams with utilization below 60%"
//   },
};

const charts = {
  billableVsNonBillable: {
    title: "Billable vs. Non-Billable Hours by Department",
    componentPath: "/hr-workforce-table",
    data: {
      labels: ["Consulting", "Engineering", "Marketing", "Customer Success", "IT", "Admin"],
      datasets: [
        { 
          label: "Billable Hours", 
          data: [12000, 9500, 4500, 8200, 3800, 1500], 
          backgroundColor: "rgba(16, 185, 129, 0.7)",
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 1
        },
        { 
          label: "Non-Billable Hours", 
          data: [3000, 4500, 8500, 4800, 6200, 7500], 
          backgroundColor: "rgba(239, 68, 68, 0.7)",
          borderColor: "rgba(239, 68, 68, 1)",
          borderWidth: 1
        },
        { 
          label: "Overtime Hours", 
          data: [1500, 1200, 800, 1100, 900, 500], 
          backgroundColor: "rgba(234, 179, 8, 0.7)",
          borderColor: "rgba(234, 179, 8, 1)",
          borderWidth: 1
        }
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: {
        x: { stacked: true },
        y: { stacked: true }
      }
    },
    defaultType: "bar",
  },
  utilizationTrend: {
    title: "Utilization Trend Over Last 12 Months",
    componentPath: "/hr-workforce-table",
    data: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      datasets: [
        { 
          label: "Utilization Rate (%)", 
          data: [68, 69, 70, 71, 72, 73, 72, 71, 72, 73, 72, 72.5], 
          backgroundColor: "rgba(59, 130, 246, 0.2)", 
          borderColor: "rgba(59, 130, 246, 1)", 
          borderWidth: 2,
          tension: 0.4,
          yAxisID: 'y'
        },
        { 
          label: "Overtime Hours", 
          data: [650, 700, 720, 750, 780, 800, 820, 810, 800, 790, 810, 820], 
          backgroundColor: "rgba(234, 179, 8, 0.2)", 
          borderColor: "rgba(234, 179, 8, 1)", 
          borderWidth: 2,
          tension: 0.4,
          yAxisID: 'y1'
        },
        { 
          label: "Billable Ratio (%)", 
          data: [67, 66, 66.5, 65, 64, 65, 65.5, 65, 64.5, 64, 65, 65], 
          backgroundColor: "rgba(16, 185, 129, 0.2)", 
          borderColor: "rgba(16, 185, 129, 1)", 
          borderWidth: 2,
          tension: 0.4,
          yAxisID: 'y2'
        }
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: {
        y: { 
          type: 'linear',
          display: true,
          position: 'left',
          title: { display: true, text: 'Utilization %' }
        },
        y1: { 
          type: 'linear',
          display: true,
          position: 'right',
          title: { display: true, text: 'Overtime Hours' },
          grid: { drawOnChartArea: false }
        },
        y2: {
          type: 'linear',
          display: false
        }
      }
    },
    defaultType: "line",
  },
  timeAllocation: {
    title: "Time Allocation (Billable / Non-Billable / Overtime)",
    componentPath: "/hr-workforce-table",
    data: {
      labels: ["Billable", "Non-Billable", "Overtime"],
      datasets: [{
        data: [42000, 34500, 6000],
        backgroundColor: [
          "rgba(16, 185, 129, 0.7)",
          "rgba(239, 68, 68, 0.7)",
          "rgba(234, 179, 8, 0.7)"
        ],
        borderColor: [
          "rgba(16, 185, 129, 1)",
          "rgba(239, 68, 68, 1)",
          "rgba(234, 179, 8, 1)"
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.label}: ${context.raw} hours (${((context.raw / 82500) * 100).toFixed(getDecimalPrecision())}%)`;
            }
          }
        }
      }
    },
    defaultType: "doughnut",
  },
  utilizationHeatmap: {
    title: "Utilization by Role & Business Unit",
    componentPath: "/hr-workforce-table",
    data: {
      labels: ["Junior", "Mid-level", "Senior", "Manager"],
      datasets: [
        { label: "Consulting", data: [85, 88, 90, 82], backgroundColor: "rgba(16, 185, 129, 0.7)" },
        { label: "Engineering", data: [75, 78, 82, 75], backgroundColor: "rgba(59, 130, 246, 0.7)" },
        { label: "Marketing", data: [55, 58, 62, 65], backgroundColor: "rgba(234, 179, 8, 0.7)" },
        { label: "Customer Success", data: [72, 75, 78, 70], backgroundColor: "rgba(139, 92, 246, 0.7)" }
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
              return `${context.dataset.label} ${context.label}: ${context.raw}% utilization`;
            }
          }
        }
      },
    },
    defaultType: "bar",
  }
};

const aiInsights = [
  {
    title: "Marketing Team Underutilized",
    content: "Marketing team's billable utilization is below 60% — suggest capacity rebalancing.",
    severity: "warning",
    reasoning: "3-month trend shows 58% utilization vs company average of 72%"
  },
  {
    title: "Overtime Cost Alert",
    content: "IT department overtime costs exceeded budget by 22% last quarter.",
    severity: "critical",
    reasoning: "High non-billable hours combined with overtime indicates inefficiency"
  },
  {
    title: "Utilization Forecast",
    content: "Utilization expected to dip during holiday season; adjust resourcing plans.",
    severity: "info",
    reasoning: "Historical patterns show 8-12% seasonal dip in Q4"
  },
  {
    title: "Top Performers",
    content: "5 consultants maintained >90% utilization for 6 months — consider for leadership.",
    severity: "positive",
    reasoning: "Consistently high utilization with positive client feedback"
  }
];

const recommendations = [
  {
    title: "Rebalance Capacity",
    content: "Reallocate excess capacity in Admin team to project-based roles.",
    metric: "Current utilization: 45% | Target: 65%",
    icon: <FiUsers />
  },
  {
    title: "Reduce Overtime",
    content: "Reduce reliance on overtime in Sales Ops — exceeded cost thresholds.",
    metric: "Overtime cost: $78K | Budget: $60K",
    icon: <FiDollarSign />
  },
  {
    title: "Training Program",
    content: "Boost training in Non-billable-heavy departments to increase deployability.",
    metric: "Potential utilization gain: 15-20%",
    icon: <BsLightningFill />
  }
];

const UtilizationRateReport = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    timePeriod: "Last Quarter",
    department: "All Departments",
    role: "All Roles",
    location: "All Locations"
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const [aiInput, setAiInput] = useState({});
  const [chartTypes, setChartTypes] = useState({
    billableVsNonBillable: "bar",
    utilizationTrend: "line",
    timeAllocation: "doughnut",
    utilizationHeatmap: "bar"
  });
  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const filtersRef = useRef(null);

  const toggleChartType = (widgetId, type) => {
    setChartTypes(prev => ({ ...prev, [widgetId]: type }));
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
      case "pie": return <Pie data={data} options={options} />;
      case "doughnut": return <Doughnut data={data} options={options} />;
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
              {typeof value === "number" ? 
                title.includes("Rate") || title.includes("Ratio") ? 
                  `${value}%` : 
                  title.includes("Cost") ? `$${value.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}` :
                  value.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }) : 
                value}
            </p>
            <div className={`flex items-center mt-2 ${isPositive ? "text-green-500" : "text-red-500"}`}>
              {isPositive ? <FiTrendingUp className="mr-1" /> : <FiTrendingDown className="mr-1" />}
              <span className="text-[10px] font-medium">{change}% vs last period</span>
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
    const dropdownRef = useOutsideClick(() => {
      setDropdownWidget(null);
      setHoveredChartType(null);
    });
    
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
                        Chart Type <FiChevronDown className="ml-1 text-x" />
                      </div>
                      {hoveredChartType === widgetId && (
                        <div className="absolute top-0 left-full w-40 bg-white rounded-md shadow-lg border border-gray-200 z-20 py-1" style={{ marginLeft: "-1px" }}>
                          {["line", "bar", "pie", "doughnut"].map((type) => (
                            <button 
                              key={type} 
                              onClick={(e) => { e.stopPropagation(); toggleChartType(widgetId, type); setDropdownWidget(null); setHoveredChartType(null); }} 
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
                      onClick={(e) => { e.stopPropagation(); navigate(componentPath); setDropdownWidget(null); setHoveredChartType(null); }}
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
              <div 
                ref={useOutsideClick(() => setShowAIDropdown(null))} 
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

  const UtilizationTable = () => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
      <h3 className="text-s font-semibold text-sky-800 mb-2">Utilization by Team</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-x text-gray-700">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left">Department / Team</th>
              <th className="p-2 text-left">Total Hours</th>
              <th className="p-2 text-left">Billable Hours</th>
              <th className="p-2 text-left">Non-Billable Hours</th>
              <th className="p-2 text-left">Overtime Hours</th>
              <th className="p-2 text-left">Utilization Rate</th>
              <th className="p-2 text-left">Overtime Cost</th>
            </tr>
          </thead>
          <tbody>
            {[
              { department: "Consulting", total: 16500, billable: 12000, nonBillable: 3000, overtime: 1500, utilization: 72.7, cost: 67500 },
              { department: "Engineering", total: 15200, billable: 9500, nonBillable: 4500, overtime: 1200, utilization: 62.5, cost: 54000 },
              { department: "Marketing", total: 13800, billable: 4500, nonBillable: 8500, overtime: 800, utilization: 32.6, cost: 36000 },
              { department: "Customer Success", total: 14100, billable: 8200, nonBillable: 4800, overtime: 1100, utilization: 58.2, cost: 49500 },
              { department: "IT", total: 10900, billable: 3800, nonBillable: 6200, overtime: 900, utilization: 34.9, cost: 40500 },
              { department: "Admin", total: 9500, billable: 1500, nonBillable: 7500, overtime: 500, utilization: 15.8, cost: 22500 }
            ].map((row, i) => (
              <tr key={i} className="border-b hover:bg-sky-50">
                <td className="p-2">{row.department}</td>
                <td className="p-2">{row.total.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                <td className="p-2">{row.billable.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                <td className="p-2">{row.nonBillable.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                <td className="p-2">{row.overtime.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                <td className={`p-2 ${row.utilization > 70 ? "text-green-500" : row.utilization < 50 ? "text-red-500" : "text-yellow-500"}`}>
                  {row.utilization}%
                </td>
                <td className="p-2">${row.cost.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between items-center mt-2 text-x">
        <span>Showing 1 to 6 of 6 entries</span>
        <div className="flex space-x-1">
          <button className="px-2 py-1 border rounded">Previous</button>
          <button className="px-2 py-1 border rounded bg-sky-500 text-white">1</button>
          <button className="px-2 py-1 border rounded">Next</button>
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
          severity === "positive" ? "border-green-200 bg-green-50" :
          "border-blue-200 bg-blue-50"
        }`}
      >
        <div className="flex items-start">
          <div className={`p-1 rounded-full mr-2 ${
            severity === "critical" ? "bg-red-100 text-red-600" :
            severity === "warning" ? "bg-yellow-100 text-yellow-600" :
            severity === "positive" ? "bg-green-100 text-green-600" :
            "bg-blue-100 text-blue-600"
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
                                    <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Utilization Rate Report</span>
                                  </div>
                                </li>
                              </ol>
                            </nav>
      {/* Header Section */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Utilization Rate Report</h1>
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
                                                                to="/hr-workforce-table"
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

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white p-4 rounded-lg shadow-sm" ref={filtersRef}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {["Time Period", "Department", "Role", "Location"].map((filter, i) => (
              <div key={i}>
                <label className="block text-s font-medium text-gray-700 mb-1">{filter}</label>
                <select 
                  className="w-full p-2 border border-gray-300 rounded-md text-s"
                  value={filters[filter.toLowerCase().replace(" ", "")]}
                  onChange={(e) => setFilters({...filters, [filter.toLowerCase().replace(" ", "")]: e.target.value})}
                >
                  <option>All {filter === "Time Period" ? "Periods" : filter + "s"}</option>
                  {filter === "Department" && ["Consulting", "Engineering", "Marketing", "Customer Success", "IT", "Admin"].map(opt => <option key={opt}>{opt}</option>)}
                  {filter === "Role" && ["Junior", "Mid-level", "Senior", "Manager", "Executive"].map(opt => <option key={opt}>{opt}</option>)}
                  {filter === "Location" && ["North America", "Europe", "Asia", "Global"].map(opt => <option key={opt}>{opt}</option>)}
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
              key === "utilizationRate" || key === "billableRatio" ? <FiActivity size={16} /> :
              key === "avgOvertime" || key === "overtimeCost" ? <FiClock size={16} /> :
              key === "peakUtilizationDept" ? <FiTrendingUp size={16} /> :
              <FiUsers size={16} />
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
          title={charts.billableVsNonBillable.title} 
          chartType={chartTypes.billableVsNonBillable} 
          chartData={charts.billableVsNonBillable} 
          widgetId="billableVsNonBillable" 
          index={0}
          componentPath={charts.billableVsNonBillable.componentPath}
        />
        <EnhancedChartCard 
          title={charts.utilizationTrend.title} 
          chartType={chartTypes.utilizationTrend} 
          chartData={charts.utilizationTrend} 
          widgetId="utilizationTrend" 
          index={1}
          componentPath={charts.utilizationTrend.componentPath}
        />
        {/* <EnhancedChartCard 
          title={charts.timeAllocation.title} 
          chartType={chartTypes.timeAllocation} 
          chartData={charts.timeAllocation} 
          widgetId="timeAllocation" 
          index={2}
          componentPath={charts.timeAllocation.componentPath}
        /> */}
      </div>


      {/* Tables and Recommendations Section */}
<div className="space-y-8">
  {/* Utilization by Team Table */}
  <div>
    <h3 className="text-md font-semibold text-sky-800 mb-2">Utilization by Team</h3>
    <UtilizationTable />
  </div>

  {/* AI Recommendations & AI-Driven Insights in 2-column layout */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

    {/* AI-Driven Insights */}
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

    {/* AI Recommendations */}
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-sky-800">AI Recommendations</h3>
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
      {/* <div className="bg-white p-4 rounded-lg shadow-sm text-center text-x text-gray-500">
        <p>Last updated: May 12, 2025 | Data source: Enterprise WorkForce Analytics (EWFA) | <span className="text-sky-600 cursor-pointer">Send feedback</span></p>
      </div> */}
    </div>
  );
};

export default UtilizationRateReport;