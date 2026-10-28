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
import {
  Bar,
  Line,
  Pie,
  Doughnut,
  Scatter,
  Bubble,
} from "react-chartjs-2";
import { motion } from "framer-motion";
import {
  FiTrendingUp,
  FiTrendingDown,
  FiDollarSign,
  FiPieChart,
  FiFilter,
  FiDownload,
  FiPlus,
  FiChevronDown,
  FiChevronRight,
  FiSend,
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
} from "react-icons/fi";
import { BsStars, BsThreeDotsVertical } from "react-icons/bs";
import { Tooltip as ReactTooltip } from "react-tooltip";
import { RiDragMove2Fill } from "react-icons/ri";
import { GrLinkNext } from "react-icons/gr";
import { getDecimalPrecision } from '../../../utils/formatters';
// import { AuthContext } from "../../context/AuthContext";
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
  totalBudget: { 
    value: 3200000, 
    change: "+5%", 
    isPositive: true,
    componentPath: "/it-spend-table" 
  },
  actualSpend: { 
    value: 2700000, 
    change: "-15%", 
    isPositive: false,
    componentPath: "/it-spend-table" 
  },
  costVariance: { 
    value: "-15%", 
    change: "+2%", 
    isPositive: true,
    componentPath: "/it-spend-table" 
  },
  projectsOnBudget: { 
    value: "65%", 
    change: "+8%", 
    isPositive: true,
    componentPath: "/it-spend-table" 
  },
  avgROI: { 
    value: "3.8x", 
    change: "+0.2x", 
    isPositive: true,
    componentPath: "/it-spend-table" 
  },
  projectsAtRisk: { 
    value: 4, 
    change: "-1", 
    isPositive: false,
    componentPath: "/it-spend-table" 
  },
};

const projectsData = [
  {
    name: "CRM Upgrade",
    owner: "IT Ops",
    budgetedCost: 500000,
    actualCost: 640000,
    variance: "+28%",
    status: "Completed",
    roi: "2.9x",
    startDate: "Jan 2024",
    endDate: "Mar 2025",
    risk: "🔴 Overrun",
    category: "Software"
  },
  {
    name: "Security Audit",
    owner: "InfoSec",
    budgetedCost: 150000,
    actualCost: 90000,
    variance: "-40%",
    status: "In Progress",
    roi: "TBD",
    startDate: "Feb 2025",
    endDate: "Jun 2025",
    risk: "🟡 Underbudget",
    category: "Security"
  },
  {
    name: "Cloud Migration",
    owner: "Infrastructure",
    budgetedCost: 1200000,
    actualCost: 950000,
    variance: "-21%",
    status: "In Progress",
    roi: "4.2x (est)",
    startDate: "Jul 2024",
    endDate: "Dec 2025",
    risk: "🟢 On Track",
    category: "Infrastructure"
  },
  {
    name: "ERP Implementation",
    owner: "Finance IT",
    budgetedCost: 800000,
    actualCost: 920000,
    variance: "+15%",
    status: "Delayed",
    roi: "1.5x",
    startDate: "Oct 2024",
    endDate: "Sep 2025",
    risk: "🔴 Overrun",
    category: "Software"
  },
  {
    name: "Employee Portal",
    owner: "HR Tech",
    budgetedCost: 250000,
    actualCost: 210000,
    variance: "-16%",
    status: "Completed",
    roi: "5.1x",
    startDate: "Jan 2024",
    endDate: "Jun 2024",
    risk: "🟢 On Track",
    category: "Internal Tools"
  },
];

const aiRecommendations = [
  {
    id: 1,
    type: "reallocation",
    message: "Reallocate $100k from underutilized Cloud Migration to over-budgeted ERP Implementation to avoid delays.",
    confidence: "85%",
    action: "Reallocate Funds"
  },
  {
    id: 2,
    type: "delay",
    message: "Delay non-critical Phase 2 of Security Audit to Q1 next year to reduce Q4 budget stress.",
    confidence: "78%",
    action: "Reschedule"
  },
  {
    id: 3,
    message: "Historical pattern suggests annual maintenance costs are under-budgeted — adjust +12% next cycle.",
    confidence: "92%",
    action: "Adjust Budget"
  }
];

const charts = {
  budgetVsActual: {
    title: "Budget vs. Actual by Project",
    componentPath: "/it-spend-table",
    data: {
      labels: projectsData.map(project => project.name),
      datasets: [
        {
          label: "Budgeted",
          data: projectsData.map(project => project.budgetedCost),
          backgroundColor: "rgba(59, 130, 246, 0.7)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 1,
        },
        {
          label: "Actual",
          data: projectsData.map(project => project.actualCost),
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
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              label += '$' + context.raw.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() });
              return label;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return '$' + value.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() });
            }
          }
        }
      }
    },
    defaultType: "bar",
  },
  cumulativeSpend: {
    title: "Cumulative Spend Over Time",
    componentPath: "/it-spend-table",
    data: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"],
      datasets: [
        {
          label: "Budgeted",
          data: [200000, 450000, 750000, 1100000, 1500000, 1950000, 2450000, 2900000, 3200000],
          borderColor: "rgba(59, 130, 246, 1)",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderWidth: 2,
          tension: 0.4,
          fill: true
        },
        {
          label: "Actual",
          data: [180000, 400000, 650000, 950000, 1300000, 1700000, 2100000, 2400000, 2700000],
          borderColor: "rgba(16, 185, 129, 1)",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          borderWidth: 2,
          tension: 0.4,
          fill: true
        },
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
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              label += '$' + context.raw.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() });
              return label;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return '$' + value.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() });
            }
          }
        }
      }
    },
    defaultType: "line",
  },
  roiVsSpend: {
    title: "ROI vs. Spend",
    componentPath: "/it-spend-table",
    data: {
      datasets: projectsData
        .filter(project => project.roi !== "TBD")
        .map(project => ({
          label: project.name,
          data: [{
            x: project.actualCost,
            y: parseFloat(project.roi)
          }],
          backgroundColor: project.risk.includes("🔴") 
            ? "rgba(239, 68, 68, 0.7)" 
            : project.risk.includes("🟡") 
              ? "rgba(234, 179, 8, 0.7)" 
              : "rgba(16, 185, 129, 0.7)",
          borderColor: project.risk.includes("🔴") 
            ? "rgba(239, 68, 68, 1)" 
            : project.risk.includes("🟡") 
              ? "rgba(234, 179, 8, 1)" 
              : "rgba(16, 185, 129, 1)",
          borderWidth: 1,
          radius: 8
        }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              const project = projectsData.find(p => p.name === context.dataset.label);
              return [
                `Project: ${project.name}`,
                `Spend: $${project.actualCost.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`,
                `ROI: ${project.roi}`,
                `Status: ${project.status}`,
                `Risk: ${project.risk}`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Actual Spend ($)',
          },
          ticks: {
            callback: function(value) {
              return '$' + value.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() });
            }
          }
        },
        y: {
          title: {
            display: true,
            text: 'ROI (x)',
          }
        }
      }
    },
    defaultType: "scatter",
  },
  spendBreakdown: {
    title: "Spend Breakdown by Category",
    componentPath: "/it-spend-table",
    data: {
      labels: ["Software", "Hardware", "Consulting", "Salaries", "Misc"],
      datasets: [
        {
          label: "Spend",
          data: [1200000, 750000, 500000, 600000, 150000],
          backgroundColor: [
            "rgba(59, 130, 246, 0.7)",
            "rgba(139, 92, 246, 0.7)",
            "rgba(16, 185, 129, 0.7)",
            "rgba(234, 179, 8, 0.7)",
            "rgba(239, 68, 68, 0.7)",
          ],
          borderColor: [
            "rgba(59, 130, 246, 1)",
            "rgba(139, 92, 246, 1)",
            "rgba(16, 185, 129, 1)",
            "rgba(234, 179, 8, 1)",
            "rgba(239, 68, 68, 1)",
          ],
          borderWidth: 1,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { 
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.label || '';
              if (label) {
                label += ': ';
              }
              label += '$' + context.raw.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() });
              label += ` (${((context.raw / 3200000) * 100).toFixed(getDecimalPrecision())}%)`;
              return label;
            }
          }
        }
      },
    },
    defaultType: "doughnut",
  },
};

const ITBudgetVsActuals = () => {
  const navigate = useNavigate();
  // const { currentUser } = useContext(AuthContext);
  const [showFilters, setShowFilters] = useState(false);
  const [activeWidgets, setActiveWidgets] = useState([
    "budgetVsActual",
    "cumulativeSpend",
    "roiVsSpend",
    "spendBreakdown",
  ]);
  const [chartTypes, setChartTypes] = useState({
    budgetVsActual: "bar",
    cumulativeSpend: "line",
    roiVsSpend: "scatter",
    spendBreakdown: "doughnut",
  });
  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const [aiInput, setAiInput] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const [showChartTypeDropdown, setShowChartTypeDropdown] = useState({});
  const [showAIRecommendations, setShowAIRecommendations] = useState(true);
  const [filters, setFilters] = useState({
    timeRange: "FY",
    status: "All",
    variance: "All",
    department: "All",
    category: "All",
    roiThreshold: "All",
    riskLevel: "All"
  });

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
      case "scatter":
        return <Scatter data={data} options={options} />;
      case "bubble":
        return <Bubble data={data} options={options} />;
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
                              {[
                                "bar",
                                "line",
                                "doughnut",
                                "scatter",
                              ].map((type) => (
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
  const KPICard = ({ title, value, change, isPositive, icon, componentPath }) => {
    const [showAIDropdown, setShowAIDropdown] = useState(false);
    const [localAIInput, setLocalAIInput] = useState("");
    const dropdownRef = useRef(null);

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

    const handleSendAIQuery = () => {
      if (localAIInput.trim()) {
        console.log(`AI Query for ${title}:`, localAIInput);
        setLocalAIInput("");
        setShowAIDropdown(false);
      }
    };

    const needsDollarSign = [
      "totalBudget",
      "actualSpend",
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
                data-tooltip-content="Ask AI"
              >
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

  // Handle drag and drop
  const onDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(activeWidgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setActiveWidgets(items);
  };

  // AI Recommendation Card
  const AIRecommendationCard = ({ recommendation }) => {
    const [acknowledged, setAcknowledged] = useState(false);
    
    return (
      <motion.div 
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className={`bg-white p-3 rounded-lg shadow-sm border ${
          acknowledged ? "border-gray-200 opacity-70" : "border-sky-100"
        }`}>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center mb-1">
              {recommendation.type === "reallocation" && (
                <FiDollarSign className="text-blue-500 mr-1" />
              )}
              {recommendation.type === "delay" && (
                <FiClock className="text-yellow-500 mr-1" />
              )}
              {!recommendation.type && (
                <FiAlertCircle className="text-purple-500 mr-1" />
              )}
              <span className="text-x font-semibold">
                {recommendation.confidence} Confidence
              </span>
            </div>
            <p className="text-x mb-2">{recommendation.message}</p>
          </div>
          {!acknowledged && (
            <button
              onClick={() => setAcknowledged(true)}
              className="text-x bg-sky-500 text-white px-2 py-1 rounded hover:bg-sky-600 transition">
              {recommendation.action}
            </button>
          )}
        </div>
        {acknowledged && (
          <div className="flex items-center justify-end mt-1">
            <FiCheckCircle className="text-green-500 mr-1" />
            <span className="text-x text-gray-500">Acknowledged</span>
          </div>
        )}
      </motion.div>
    );
  };

  // Data Table Component
  const DataTable = () => {
    const filteredProjects = projectsData.filter(project => {
      return (
        (filters.status === "All" || project.status === filters.status) &&
        (filters.department === "All" || project.owner.includes(filters.department)) &&
        (filters.category === "All" || project.category === filters.category) &&
        (filters.variance === "All" || 
          (filters.variance === "Over" && project.variance.startsWith("+")) ||
          (filters.variance === "Under" && project.variance.startsWith("-")) ||
          (filters.variance === "On Target" && !project.variance.startsWith("+") && !project.variance.startsWith("-")))
      );
    });

    return (
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100 overflow-x-auto">
        <h3 className="text-s font-semibold text-sky-800 mb-2">IT Project Budget Tracker</h3>
        <table className="w-full text-x text-gray-700">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left">Project Name</th>
              <th className="p-2 text-left">Owner</th>
              <th className="p-2 text-left">Budgeted Cost</th>
              <th className="p-2 text-left">Actual Cost</th>
              <th className="p-2 text-left">Variance</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">ROI</th>
              <th className="p-2 text-left">Risk Flag</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map((project, index) => (
              <tr key={index} className="border-b hover:bg-gray-50">
                <td className="p-2">{project.name}</td>
                <td className="p-2">{project.owner}</td>
                <td className="p-2">${project.budgetedCost.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                <td className="p-2">${project.actualCost.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                <td className={`p-2 ${
                  project.variance.startsWith("+") ? "text-red-500" : 
                  project.variance.startsWith("-") ? "text-green-500" : 
                  "text-gray-500"
                }`}>
                  {project.variance}
                </td>
                <td className="p-2">{project.status}</td>
                <td className="p-2">{project.roi}</td>
                <td className="p-2">{project.risk}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
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
                                                  <Link to="/it-technology-spend" className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                                                    IT & Technology
                                                  </Link>
                                                </div>
                                              </li>
                                              <li aria-current="page">
                                                <div className="flex items-center">
                                                  <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
                                                  <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Budget VS Actuals</span>
                                                </div>
                                              </li>
                                            </ol>
                                          </nav>
      {/* Header */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">
              IT Project Budget vs. Actuals
            </h1>
            {/* <p className="text-sky-100 text-x">{currentUser.company_name}</p> */}
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
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-x"
                value={filters.timeRange}
                onChange={(e) => setFilters({...filters, timeRange: e.target.value})}>
                <option>FY</option>
                <option>Q1</option>
                <option>Q2</option>
                <option>Q3</option>
                <option>Q4</option>
                <option>Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-x font-medium text-gray-700 mb-1">
                Project Status
              </label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-x"
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}>
                <option>All</option>
                <option>In Progress</option>
                <option>Completed</option>
                <option>Delayed</option>
                <option>Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-x font-medium text-gray-700 mb-1">
                Budget Variance
              </label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-x"
                value={filters.variance}
                onChange={(e) => setFilters({...filters, variance: e.target.value})}>
                <option>All</option>
                <option>Over</option>
                <option>Under</option>
                <option>On Target</option>
              </select>
            </div>
            <div>
              <label className="block text-x font-medium text-gray-700 mb-1">
                Category
              </label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-x"
                value={filters.category}
                onChange={(e) => setFilters({...filters, category: e.target.value})}>
                <option>All</option>
                <option>Software</option>
                <option>Hardware</option>
                <option>Security</option>
                <option>Infrastructure</option>
                <option>Internal Tools</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KPICard
          key="totalBudget"
          title="Total Budget"
          value={kpiData.totalBudget.value}
          change={kpiData.totalBudget.change}
          isPositive={kpiData.totalBudget.isPositive}
          icon={<FiDollarSign size={16} />}
          componentPath={kpiData.totalBudget.componentPath}
        />
        <KPICard
          key="actualSpend"
          title="Actual Spend"
          value={kpiData.actualSpend.value}
          change={kpiData.actualSpend.change}
          isPositive={kpiData.actualSpend.isPositive}
          icon={<FiDollarSign size={16} />}
          componentPath={kpiData.actualSpend.componentPath}
        />
        <KPICard
          key="costVariance"
          title="Cost Variance"
          value={kpiData.costVariance.value}
          change={kpiData.costVariance.change}
          isPositive={kpiData.costVariance.isPositive}
          icon={<FiTrendingDown size={16} />}
          componentPath={kpiData.costVariance.componentPath}
        />
                <KPICard
          key="projectsOnBudget"
          title="On Budget %"
          value={kpiData.projectsOnBudget.value}
          change={kpiData.projectsOnBudget.change}
          isPositive={kpiData.projectsOnBudget.isPositive}
          icon={<FiPieChart size={16} />}
          componentPath={kpiData.projectsOnBudget.componentPath}
        />
        <KPICard
          key="avgROI"
          title="Average ROI"
          value={kpiData.avgROI.value}
          change={kpiData.avgROI.change}
          isPositive={kpiData.avgROI.isPositive}
          icon={<FiTrendingUp size={16} />}
          componentPath={kpiData.avgROI.componentPath}
        />
        <KPICard
          key="projectsAtRisk"
          title="Projects at Risk"
          value={kpiData.projectsAtRisk.value}
          change={kpiData.projectsAtRisk.change}
          isPositive={kpiData.projectsAtRisk.isPositive}
          icon={<FiAlertCircle size={16} />}
          componentPath={kpiData.projectsAtRisk.componentPath}
        />
      </div>

  
      {/* Draggable Chart Widgets */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="chart-widgets" direction="vertical">
          {(provided) => (
            <div
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
              ref={provided.innerRef}
              {...provided.droppableProps}>
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

       {/* AI Recommendations */}
      {showAIRecommendations && (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-s font-semibold text-sky-800">
              AI Budget Recommendations
            </h3>
            {/* <button
              onClick={() => setShowAIRecommendations(false)}
              className="text-x text-red-500 hover:text-red-700">
              Dismiss
            </button> */}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {aiRecommendations.map((recommendation) => (
              <AIRecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
              />
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default ITBudgetVsActuals;
