import React, { useState, useRef, useEffect, useContext } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
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
  FiDollarSign,
  FiPieChart,
  FiChevronRight,
  FiFilter,
  FiDownload,
  FiPlus,
  FiChevronDown,
  FiSend,
  FiServer,
  FiCloud,
  FiDatabase,
} from "react-icons/fi";
import { BsStars, BsThreeDotsVertical } from "react-icons/bs";
import { Tooltip as ReactTooltip } from "react-tooltip";
import { RiDragMove2Fill } from "react-icons/ri";
import { GrLinkNext } from "react-icons/gr";
import { getDecimalPrecision } from '../../../utils/formatters';
// import { AuthContext } from "../../../../context/AuthContext";
// import { AuthContext } from "@/context/AuthContext";



// Register ChartJS components
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

// Outside Click logic
const useOutsideClick = (callback) => {
  const ref = useRef();

  useEffect(() => {
    const handleClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        callback();
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [callback]);

  return ref;
};

// Animation variants
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// Static Data
const kpiData = {
  totalSpend: { value: 285000, change: "+12%", componentPath: "/it-spend-table" },
  onPremCost: { value: 185000, percentage: "65%", change: "+5%", componentPath: "/it-spend-table" },
  cloudCost: { value: 100000, percentage: "35%", change: "+25%", componentPath: "/it-spend-table" },
  costPerEmployee: { value: 1250, change: "-3%", componentPath: "/it-spend-table" },
  utilizationRate: { value: "68%", target: "75%", change: "+2%", componentPath: "/it-spend-table" },
  idleResourceCost: { value: 42000, change: "-8%", componentPath: "/it-spend-table" },
  cloudROI: { value: "1.8x", change: "+0.2x", componentPath: "/it-spend-table" },
};

const charts = {
  monthlySpendTrend: {
    title: "Monthly Infrastructure Spend Trend",
    componentPath: "/it-spend-table",
    data: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"],
      datasets: [
        {
          label: "On-Prem",
          data: [32000, 30000, 31000, 29000, 28000, 27000, 26000],
          backgroundColor: "rgba(59, 130, 246, 0.7)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 1,
        },
        {
          label: "Cloud",
          data: [12000, 13000, 14000, 15000, 16000, 17000, 18000],
          backgroundColor: "rgba(16, 185, 129, 0.7)",
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { position: "bottom" },
        title: { display: true, text: "Monthly Infrastructure Spend Trend" }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Cost ($)"
          }
        }
      }
    },
    defaultType: "bar",
  },
  spendBreakdown: {
    title: "Current Infrastructure Spend Breakdown",
    componentPath: "/it-spend-table",
    data: {
      labels: ["On-Prem (65%)", "Cloud (35%)"],
      datasets: [
        {
          label: "Spend",
          data: [65, 35],
          backgroundColor: [
            "rgba(59, 130, 246, 0.7)",
            "rgba(16, 185, 129, 0.7)",
          ],
          borderColor: [
            "rgba(59, 130, 246, 1)",
            "rgba(16, 185, 129, 1)",
          ],
          borderWidth: 1,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { 
        legend: { position: "bottom" },
        title: { display: true, text: "Current Infrastructure Spend Breakdown" }
      },
    },
    defaultType: "doughnut",
  },
  spendByDepartment: {
    title: "Infrastructure Spend by Department",
    componentPath: "/it-spend-table",
    data: {
      labels: ["IT", "Engineering", "Finance", "HR", "Marketing"],
      datasets: [
        {
          label: "On-Prem",
          data: [75000, 60000, 20000, 15000, 15000],
          backgroundColor: "rgba(59, 130, 246, 0.7)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 1,
        },
        {
          label: "Cloud",
          data: [40000, 35000, 10000, 8000, 7000],
          backgroundColor: "rgba(16, 185, 129, 0.7)",
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { 
        legend: { position: "bottom" },
        title: { display: true, text: "Infrastructure Spend by Department" }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Cost ($)"
          }
        }
      }
    },
    defaultType: "bar",
  },
  cloudForecast: {
    title: "Cloud Spend Forecast (Next 6 Months)",
    componentPath: "/it-spend-table",
    data: {
      labels: ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan"],
      datasets: [
        {
          label: "Projected",
          data: [19000, 21000, 23000, 25000, 27000, 29000],
          backgroundColor: "rgba(16, 185, 129, 0.2)",
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 2,
          tension: 0.4,
        },
        {
          label: "Budget",
          data: [18000, 19000, 20000, 21000, 22000, 23000],
          backgroundColor: "rgba(245, 158, 11, 0.2)",
          borderColor: "rgba(245, 158, 11, 1)",
          borderWidth: 2,
          borderDash: [5, 5],
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { 
        legend: { position: "bottom" },
        title: { display: true, text: "Cloud Spend Forecast (Next 6 Months)" }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Cost ($)"
          }
        }
      }
    },
    defaultType: "line",
  },
  utilizationVsCost: {
    title: "Utilization vs Cost by Server",
    componentPath: "/it-spend-table",
    data: {
      labels: ["Server A", "Server B", "Server C", "Server D", "Server E"],
      datasets: [
        {
          label: "Utilization %",
          data: [85, 60, 45, 30, 15],
          backgroundColor: "rgba(139, 92, 246, 0.7)",
          borderColor: "rgba(139, 92, 246, 1)",
          borderWidth: 2,
        },
        {
          label: "Monthly Cost ($)",
          data: [1200, 1800, 2400, 3000, 3600],
          backgroundColor: "rgba(239, 68, 68, 0.7)",
          borderColor: "rgba(239, 68, 68, 1)",
          borderWidth: 2,
          type: "line",
          yAxisID: "y1",
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { 
        legend: { position: "bottom" },
        title: { display: true, text: "Utilization vs Cost by Server" }
      },
      scales: {
        y: {
          type: "linear",
          display: true,
          position: "left",
          title: {
            display: true,
            text: "Utilization %"
          }
        },
        y1: {
          type: "linear",
          display: true,
          position: "right",
          title: {
            display: true,
            text: "Cost ($)"
          },
          grid: {
            drawOnChartArea: false,
          },
        },
      },
    },
    defaultType: "bar",
  },
};

const InfrastructureCostEfficiency = () => {
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  // const { currentUser } = useContext(AuthContext);
  const [activeWidgets, setActiveWidgets] = useState([
    "monthlySpendTrend",
    "spendBreakdown",
    "spendByDepartment",
    "cloudForecast",
    "utilizationVsCost",
  ]);
  const [chartTypes, setChartTypes] = useState({
    monthlySpendTrend: "bar",
    spendBreakdown: "doughnut",
    spendByDepartment: "bar",
    cloudForecast: "line",
    utilizationVsCost: "bar",
  });

  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const [aiInput, setAiInput] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const [showChartTypeDropdown, setShowChartTypeDropdown] = useState({});
  const [aiSuggestions, setAiSuggestions] = useState([
    {
      id: 1,
      title: "Decommission idle servers",
      description: "5 on-prem servers have been idle for 90+ days. Estimated annual savings: $12,000",
      action: "decommission",
      savings: 12000,
      status: "pending",
    },
    {
      id: 2,
      title: "Optimize AWS EC2 instances",
      description: "DevOps team instances are oversized. Switch to smaller tier for 30% savings.",
      action: "optimize",
      savings: 4500,
      status: "pending",
    },
    {
      id: 3,
      title: "Hybrid cloud for seasonal workloads",
      description: "AI detects inconsistent usage pattern. Consider hybrid approach for Finance department apps.",
      action: "migrate",
      savings: 8000,
      status: "pending",
    },
  ]);

  const filtersRef = useRef(null);
  const aiChatbotRef = useRef(null);

  // Toggle chart type
  const toggleChartType = (widgetId, type) => {
    setChartTypes((prev) => ({
      ...prev,
      [widgetId]: type,
    }));
  };

  // Toggle chart type dropdown
  const toggleChartTypeDropdown = (widgetId) => {
    setShowChartTypeDropdown((prev) => ({
      ...prev,
      [widgetId]: !prev[widgetId],
    }));
  };

  // Handle sending AI query
  const handleSendAIQuery = (widgetId) => {
    if (aiInput[widgetId]?.trim()) {
      console.log(`AI Query for ${widgetId}:`, aiInput[widgetId]);
      setAiInput((prev) => ({
        ...prev,
        [widgetId]: "",
      }));
      setShowAIDropdown(null);
    }
  };

  // Handle AI suggestion action
  const handleSuggestionAction = (id, action) => {
    setAiSuggestions(prev => 
      prev.map(suggestion => 
        suggestion.id === id ? { ...suggestion, status: action } : suggestion
      )
    );
  };

  // Render chart based on type
  const renderChart = (type, data, options = {}) => {
    switch (type) {
      case "line":
        return <Line data={data} options={options} />;
      case "bar":
        return <Bar data={data} options={options} />;
      case "pie":
        return <Pie data={data} options={options} />;
      case "doughnut":
        return <Doughnut data={data} options={options} />;
      default:
        return <Bar data={data} options={options} />;
    }
  };

  // Enhanced ChartCard component with drag handle and AI dropdown
  const EnhancedChartCard = ({
    title,
    componentPath,
    chartType,
    chartData,
    widgetId,
    index,
  }) => {
    const dropdownRef = useOutsideClick(() => setDropdownWidget(null));

    return (
      <Draggable draggableId={widgetId} index={index}>
        {(provided) => (
          <div
            className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border border-sky-100"
            ref={provided.innerRef}
            {...provided.draggableProps}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-s font-semibold text-sky-800">{title}</h3>
              <div className="flex space-x-2 relative">
                <div className="relative chart-dropdown">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDropdownWidget(
                        dropdownWidget === widgetId ? null : widgetId,
                      );
                    }}
                    className="p-1 rounded hover:bg-gray-100"
                    data-tooltip-id="chart-type-tooltip"
                    data-tooltip-content="Options">
                    <BsThreeDotsVertical />
                  </button>

                  {dropdownWidget === widgetId && (
                    <div
                      ref={dropdownRef}
                      className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                      <div className="py-1 text-x text-gray-800">
                        <div
                          className="relative"
                          onMouseEnter={() => setHoveredChartType(widgetId)}
                          onMouseLeave={() => setHoveredChartType(null)}>
                          <div className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center">
                            All Chart Types
                            <FiChevronDown className="ml-1 text-x" />
                          </div>

                          {hoveredChartType === widgetId && (
                            <div
                              className="absolute top-0 left-full w-40 bg-white rounded-md shadow-lg border border-gray-200 z-20 py-1"
                              style={{ marginLeft: "-1px" }}>
                              {["line", "bar", "pie", "doughnut"].map((type) => (
                                <button
                                  key={type}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleChartType(widgetId, type);
                                    setDropdownWidget(null);
                                    setHoveredChartType(null);
                                  }}
                                  className="block w-full text-left px-4 py-2 text-x text-gray-700 hover:bg-gray-100 transition">
                                  {type.charAt(0).toUpperCase() + type.slice(1)}{" "}
                                  Chart
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
                          }}>
                          Analyze
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() =>
                    setShowAIDropdown(
                      showAIDropdown === widgetId ? null : widgetId,
                    )
                  }
                  className="p-1 rounded hover:bg-gray-100"
                  data-tooltip-id="ai-tooltip"
                  data-tooltip-content="Ask AI">
                  <BsStars />
                </button>
                {showAIDropdown === widgetId && (
                  <div
                    ref={aiChatbotRef}
                    className="absolute right-0 top-5 mt-2 w-full sm:w-64 bg-white rounded-md shadow-lg z-10 border border-gray-200 py-2">
                    <div className="flex flex-col items-center space-x-2">
                      <h1 className="text-x">Ask regarding the {title}</h1>
                      <div className="flex justify-between gap-3">
                        <input
                          type="text"
                          value={aiInput[widgetId] || ""}
                          onChange={(e) =>
                            setAiInput((prev) => ({
                              ...prev,
                              [widgetId]: e.target.value,
                            }))
                          }
                          placeholder="Ask AI..."
                          className="w-full p-1 border border-gray-300 rounded text-x"
                        />
                        <button
                          onClick={() => handleSendAIQuery(widgetId)}
                          className="p-2 bg-sky-500 text-white rounded hover:bg-sky-600"
                          disabled={!aiInput[widgetId]?.trim()}>
                          <FiSend />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <div
                  {...provided.dragHandleProps}
                  className="p-1 rounded hover:bg-gray-100 cursor-move">
                  <RiDragMove2Fill />
                </div>
              </div>
            </div>

            <div className="h-48">
              {renderChart(chartType, chartData.data, chartData.options)}
            </div>
          </div>
        )}
      </Draggable>
    );
  };

  // KPI Card Component with AI Button
  const KPICard = ({ title, value, change, isPositive, icon, componentPath, percentage }) => {
    const [showAIDropdown, setShowAIDropdown] = useState(false);
    const [localAIInput, setLocalAIInput] = useState("");
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event) => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target)
        ) {
          setShowAIDropdown(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, []);

    // Handle sending AI query
    const handleSendAIQuery = () => {
      if (localAIInput.trim()) {
        console.log(`AI Query for ${title}:`, localAIInput);
        setLocalAIInput("");
        setShowAIDropdown(false);
      }
    };

    // Determine if the metric requires a dollar sign
    const needsDollarSign = [
      "totalSpend",
      "onPremCost",
      "cloudCost",
      "costPerEmployee",
      "idleResourceCost",
    ].includes(title.replace(/ /g, ""));

    return (
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        whileHover={{ y: -3 }}
        className="bg-white p-3 rounded-lg shadow-sm border border-sky-100 relative"
        onClick={() => navigate(componentPath)} >
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-sky-600 uppercase tracking-wider truncate">
                {title}
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAIDropdown(!showAIDropdown);
                }}
                className="p-1 rounded hover:bg-gray-100"
                data-tooltip-id="ai-tooltip"
                data-tooltip-content="Ask AI">
                <BsStars />
              </button>
              {showAIDropdown && (
                <div
                  ref={dropdownRef}
                  className="absolute right-0 top-5 mt-2 w-full sm:w-44 bg-white rounded-md shadow-lg z-10 border border-gray-200 p-2"
                  onClick={(e) => e.stopPropagation()} >
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
                      disabled={!localAIInput.trim()}>
                      <FiSend />
                    </button>
                  </div>
                </div>
              )}
            </div>
            <p className="text-s font-bold text-sky-900 mt-1">
              {needsDollarSign && "$"}
              {typeof value === "number" ? value.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }) : value}
              {percentage && <span className="text-x font-normal ml-1">({percentage})</span>}
            </p>
            <div
              className={`flex items-center mt-2 ${
                isPositive ? "text-green-500" : "text-red-500"
              }`}>
              <span className="text-[10px] font-medium">
                {change} {isPositive ? "↑" : "↓"} vs last period
              </span>
            </div>
          </div>
          <div className="p-2 rounded-full bg-sky-100 hover:bg-sky-200 transition-colors duration-200">
            <div className="text-sky-600 hover:text-sky-800 transition-colors duration-200">
              {icon}
            </div>
          </div>
        </div>
        <ReactTooltip id="ai-tooltip" place="top" effect="solid" />
      </motion.div>
    );
  };

  // AI Suggestion Card Component
  const AISuggestionCard = ({ suggestion }) => {
    return (
      <motion.div 
        variants={cardVariants}
        className="bg-white p-3 rounded-lg shadow-sm border border-sky-100 mb-3">
        <div className="flex justify-between items-start">
          <div>
            <h4 className="text-s font-semibold text-sky-800">{suggestion.title}</h4>
            <p className="text-x text-gray-600 mt-1">{suggestion.description}</p>
            <p className="text-x font-medium text-green-600 mt-1">
              Potential savings: ${suggestion.savings.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}/year
            </p>
          </div>
          {/* {suggestion.status === "pending" ? (
            <div className="flex space-x-1">
              <button 
                onClick={() => handleSuggestionAction(suggestion.id, "approved")}
                className="px-2 py-1 text-x bg-green-500 text-white rounded hover:bg-green-600">
                Approve
              </button>
              <button 
                onClick={() => handleSuggestionAction(suggestion.id, "rejected")}
                className="px-2 py-1 text-x bg-red-500 text-white rounded hover:bg-red-600">
                Reject
              </button>
            </div>
          ) : (
            <span className={`text-x px-2 py-1 rounded ${
              suggestion.status === "approved" 
                ? "bg-green-100 text-green-800" 
                : "bg-red-100 text-red-800"
            }`}>
              {suggestion.status}
            </span>
          )} */}
        </div>
      </motion.div>
    );
  };

  // Data Table Component
  const DataTable = () => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
      <h3 className="text-s font-semibold text-sky-800 mb-2">Infrastructure Asset & Cost Breakdown</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-x text-gray-700">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left">Resource/Service</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Department</th>
              <th className="p-2 text-left">Monthly Cost</th>
              <th className="p-2 text-left">Usage</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Provider</th>
              {/* <th className="p-2 text-left">Actions</th> */}
            </tr>
          </thead>
          <tbody>
            {[
              { id: 1, name: "Web Server Cluster", type: "On-Prem", department: "IT", cost: 8500, usage: "85%", status: "Active", provider: "Internal" },
              { id: 2, name: "AWS EC2 t3.xlarge", type: "Cloud", department: "Engineering", cost: 4200, usage: "65%", status: "Active", provider: "AWS" },
              { id: 3, name: "Database Server 1", type: "On-Prem", department: "Finance", cost: 3200, usage: "45%", status: "Underutilized", provider: "Internal" },
              { id: 4, name: "Azure VM D4s v3", type: "Cloud", department: "Marketing", cost: 2800, usage: "30%", status: "Underutilized", provider: "Azure" },
              { id: 5, name: "Backup Server", type: "On-Prem", department: "IT", cost: 1800, usage: "15%", status: "Idle", provider: "Internal" },
            ].map((item) => (
              <tr key={item.id} className="border-b hover:bg-gray-50">
                <td className="p-2">{item.name}</td>
                <td className="p-2">
                  <span className={`inline-block w-2 h-2 rounded-full mr-1 ${
                    item.type === "Cloud" ? "bg-green-500" : "bg-blue-500"
                  }`}></span>
                  {item.type}
                </td>
                <td className="p-2">{item.department}</td>
                <td className="p-2">${item.cost.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                <td className="p-2">
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full ${
                        parseInt(item.usage) > 70 ? "bg-green-500" : 
                        parseInt(item.usage) > 40 ? "bg-yellow-500" : "bg-red-500"
                      }`} 
                      style={{ width: item.usage }}>
                    </div>
                  </div>
                  <span className="text-x">{item.usage}</span>
                </td>
                <td className="p-2">
                  <span className={`text-x px-2 py-0.5 rounded ${
                    item.status === "Active" ? "bg-green-100 text-green-800" :
                    item.status === "Underutilized" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"
                  }`}>
                    {item.status}
                  </span>
                </td>
                <td className="p-2">{item.provider}</td>
                {/* <td className="p-2">
                  <button className="text-x text-sky-600 hover:text-sky-800 mr-2">
                    Optimize
                  </button>
                  <button className="text-x text-red-600 hover:text-red-800">
                    Flag
                  </button>
                </td> */}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Handle drag and drop
  const onDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(activeWidgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setActiveWidgets(items);
  };

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
                                            <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Infrastructure Cost Efficiency</span>
                                          </div>
                                        </li>
                                      </ol>
                                    </nav>
      {/* Header */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">
              Infrastructure Cost Efficiency
            </h1>
            <p className="text-sky-100 text-x">On-Prem vs. Cloud Cost Analysis</p>
          </div>
          <div className="flex space-x-2">
            <button
              type="button"
              className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200"
              onClick={() => setShowFilters(!showFilters)}>
              <FiFilter className="mr-1" />
              Filters
            </button>
            <button
                                                                onClick={() => window.print()}
                                                                className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 hover:text-sky-50 transition-colors duration-200">
                                                                <FiDownload className="text-sky-50" />
                                                                <span className="text-sky-50">Export</span>
                                                            </button>
            {/* <button
              type="button"
              className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200">
              <FiPlus className="mr-1" />
              Add Widget
            </button> */}
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

      {/* Filter Options (Collapsible) */}
      {showFilters && (
        <div className="bg-white p-4 rounded-lg shadow-sm" ref={filtersRef}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-x font-medium text-gray-700 mb-1">
                Time Range
              </label>
              <select className="w-full p-2 border border-gray-300 rounded-md text-x">
                <option>Last 30 Days</option>
                <option>Last 12 Months</option>
                <option>Year to Date</option>
                <option>Custom Range</option>
              </select>
            </div>
            <div>
              <label className="block text-x font-medium text-gray-700 mb-1">
                Infrastructure Type
              </label>
              <select className="w-full p-2 border border-gray-300 rounded-md text-x">
                <option>All</option>
                <option>On-Prem Only</option>
                <option>Cloud Only</option>
                <option>Hybrid</option>
              </select>
            </div>
            <div>
              <label className="block text-x font-medium text-gray-700 mb-1">
                Cloud Provider
              </label>
              <select className="w-full p-2 border border-gray-300 rounded-md text-x">
                <option>All</option>
                <option>AWS</option>
                <option>Azure</option>
                <option>Google Cloud</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-x font-medium text-gray-700 mb-1">
                Utilization Threshold
              </label>
              <select className="w-full p-2 border border-gray-300 rounded-md text-x">
                <option>All</option>
                <option>High (+70%)</option>
                <option>Medium (40-70%)</option>
                <option>Low (-40%)</option>
                <option>Idle (-10%)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KPICard
          key="totalSpend"
          title="Total Spend"
          value={kpiData.totalSpend.value}
          change={kpiData.totalSpend.change}
          isPositive={false}
          icon={<FiDollarSign size={16} />}
          componentPath={kpiData.totalSpend.componentPath}
        />
        <KPICard
          key="onPremCost"
          title="On-Prem Cost"
          value={kpiData.onPremCost.value}
          percentage={kpiData.onPremCost.percentage}
          change={kpiData.onPremCost.change}
          isPositive={false}
          icon={<FiServer size={16} />}
          componentPath={kpiData.onPremCost.componentPath}
        />
        <KPICard
          key="cloudCost"
          title="Cloud Cost"
          value={kpiData.cloudCost.value}
          percentage={kpiData.cloudCost.percentage}
          change={kpiData.cloudCost.change}
          isPositive={true}
          icon={<FiCloud size={16} />}
          componentPath={kpiData.cloudCost.componentPath}
        />
        <KPICard
          key="costPerEmployee"
          title="Cost Per Employee"
          value={kpiData.costPerEmployee.value}
          change={kpiData.costPerEmployee.change}
          isPositive={kpiData.costPerEmployee.change.startsWith("-")}
          icon={<FiPieChart size={16} />}
          componentPath={kpiData.costPerEmployee.componentPath}
        />
        <KPICard
          key="utilizationRate"
          title="Utilization Rate"
          value={kpiData.utilizationRate.value}
          change={kpiData.utilizationRate.change}
          isPositive={true}
          icon={<FiTrendingUp size={16} />}
          componentPath={kpiData.utilizationRate.componentPath}
        />
        {/* <KPICard
          key="idleResourceCost"
          title="Idle Resource Cost"
          value={kpiData.idleResourceCost.value}
          change={kpiData.idleResourceCost.change}
          isPositive={kpiData.idleResourceCost.change.startsWith("-")}
          icon={<FiDatabase size={16} />}
          componentPath={kpiData.idleResourceCost.componentPath}
        /> */}
        <KPICard
          key="cloudROI"
          title="Cloud ROI"
          value={kpiData.cloudROI.value}
          change={kpiData.cloudROI.change}
          isPositive={true}
          icon={<FiTrendingUp size={16} />}
          componentPath={kpiData.cloudROI.componentPath}
        />
      </div>

      {/* Chart Widgets Section */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="charts" direction="vertical">
          {(provided) => (
            <div
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
              {...provided.droppableProps}
              ref={provided.innerRef}
            >
              {activeWidgets.map((widgetId, index) => (
                <EnhancedChartCard
                  key={widgetId}
                  title={charts[widgetId].title}
                  componentPath={charts[widgetId].componentPath}
                  chartType={chartTypes[widgetId]}
                  chartData={{
                    data: charts[widgetId].data,
                    options: charts[widgetId].options,
                  }}
                  widgetId={widgetId}
                  index={index}
                />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Data Table */}
      <DataTable />

          {/* AI Suggestions Section */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100 mb-6">
        <h3 className="text-s font-semibold text-sky-800 mb-3">AI Optimization Suggestions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {aiSuggestions.map(suggestion => (
            <AISuggestionCard key={suggestion.id} suggestion={suggestion} />
          ))}
        </div>
      </div>

    </div>
  );
};

export default InfrastructureCostEfficiency;