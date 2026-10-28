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
  RadarController,
  RadialLinearScale,
} from "chart.js";
import { Bar, Line, Doughnut, Radar } from "react-chartjs-2";
import { motion } from "framer-motion";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiFilter,
  FiDownload,
  FiChevronRight,
  FiPlus,
  FiChevronDown,
  FiSend,
  FiShield,
  FiTrendingUp,
  FiTrendingDown,
  FiServer,
  FiCpu,
  FiDatabase,
} from "react-icons/fi";
import { BsStars, BsThreeDotsVertical } from "react-icons/bs";
import { Tooltip as ReactTooltip } from "react-tooltip";
import { RiDragMove2Fill } from "react-icons/ri";
import { GrLinkNext } from "react-icons/gr";
import { getDecimalPrecision } from '../../../utils/formatters';
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
  Filler,
  RadarController,
  RadialLinearScale
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
  totalTechDebt: {
    value: 2500000,
    change: "+8%",
    isPositive: false,
    componentPath: "/it-spend-table",
  },
  legacySystems: {
    value: 38,
    unit: "%",
    change: "-2%",
    isPositive: true,
    componentPath: "/it-spend-table",
  },
  avgSystemAge: {
    value: 6.4,
    unit: "years",
    change: "+0.3",
    isPositive: false,
    componentPath: "/it-spend-table",
  },
  modernizationCoverage: {
    value: 62,
    unit: "%",
    change: "+5%",
    isPositive: true,
    componentPath: "/it-spend-table",
  },
  annualDelayCost: {
    value: 480000,
    change: "+12%",
    isPositive: false,
    componentPath: "/it-spend-table",
  },
  highRiskSystems: {
    value: 7,
    change: "+2",
    isPositive: false,
    componentPath: "/it-spend-table",
  },
};

const charts = {
  debtByDepartment: {
    title: "Technical Debt by Department",
    componentPath: "/it-spend-table",
    data: {
      labels: ["IT", "Finance", "HR", "Operations", "Marketing"],
      datasets: [
        {
          label: "Hardware",
          data: [320000, 180000, 90000, 150000, 80000],
          backgroundColor: "rgba(239, 68, 68, 0.7)",
          borderColor: "rgba(239, 68, 68, 1)",
          borderWidth: 1,
        },
        {
          label: "Software",
          data: [280000, 220000, 120000, 110000, 70000],
          backgroundColor: "rgba(59, 130, 246, 0.7)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 1,
        },
        {
          label: "Infrastructure",
          data: [150000, 80000, 40000, 120000, 30000],
          backgroundColor: "rgba(234, 179, 8, 0.7)",
          borderColor: "rgba(234, 179, 8, 1)",
          borderWidth: 1,
        },
        {
          label: "Tools",
          data: [90000, 50000, 30000, 60000, 40000],
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
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${context.dataset.label}: $${context.raw.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
        },
        y: {
          stacked: true,
          ticks: {
            callback: function (value) {
              return "$" + (value / 1000) + "K";
            },
          },
        },
      },
    },
    defaultType: "bar",
  },
  costVsProgress: {
    title: "Cost of Delay vs. Modernization Progress",
    componentPath: "/it-spend-table",
    data: {
      labels: ["Q1 2024", "Q2 2024", "Q3 2024", "Q4 2024", "Q1 2025", "Q2 2025"],
      datasets: [
        {
          label: "Estimated Delay Cost",
          data: [320000, 350000, 390000, 430000, 480000, 520000],
          backgroundColor: "rgba(239, 68, 68, 0.2)",
          borderColor: "rgba(239, 68, 68, 1)",
          borderWidth: 2,
          tension: 0.4,
          yAxisID: "y",
        },
        {
          label: "Modernization Progress",
          data: [45, 48, 52, 58, 62, 65],
          backgroundColor: "rgba(16, 185, 129, 0.2)",
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 2,
          tension: 0.4,
          yAxisID: "y1",
        },
        {
          label: "Forecasted Delay Cost",
          data: [null, null, null, null, 480000, 520000, 580000, 650000],
          borderColor: "rgba(239, 68, 68, 0.5)",
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.4,
          yAxisID: "y",
          pointBackgroundColor: "transparent",
          pointBorderColor: "transparent",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: {
        y: {
          type: "linear",
          display: true,
          position: "left",
          title: {
            display: true,
            text: "Cost ($)",
          },
          ticks: {
            callback: function (value) {
              return "$" + (value / 1000) + "K";
            },
          },
        },
        y1: {
          type: "linear",
          display: true,
          position: "right",
          title: {
            display: true,
            text: "Progress (%)",
          },
          min: 0,
          max: 100,
          grid: {
            drawOnChartArea: false,
          },
        },
      },
    },
    defaultType: "line",
  },
  systemAgeDistribution: {
    title: "System Age Distribution",
    componentPath: "/it-spend-table",
    data: {
      labels: ["<3 years", "3-5 years", "6-10 years", "10+ years"],
      datasets: [
        {
          label: "Systems",
          data: [25, 32, 28, 15],
          backgroundColor: [
            "rgba(16, 185, 129, 0.7)",
            "rgba(59, 130, 246, 0.7)",
            "rgba(234, 179, 8, 0.7)",
            "rgba(239, 68, 68, 0.7)",
          ],
          borderColor: [
            "rgba(16, 185, 129, 1)",
            "rgba(59, 130, 246, 1)",
            "rgba(234, 179, 8, 1)",
            "rgba(239, 68, 68, 1)",
          ],
          borderWidth: 1,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
    },
    defaultType: "doughnut",
  },
  readinessScore: {
    title: "Modernization Readiness Score",
    componentPath: "/it-spend-table",
    data: {
      labels: [
        "Security Risk",
        "Performance Impact",
        "Integration Complexity",
        "Cost to Upgrade",
        "Compliance Risk",
      ],
      datasets: [
        {
          label: "ERP Core",
          data: [8, 7, 6, 5, 9],
          backgroundColor: "rgba(239, 68, 68, 0.2)",
          borderColor: "rgba(239, 68, 68, 1)",
          borderWidth: 2,
        },
        {
          label: "HR Suite",
          data: [5, 4, 7, 6, 5],
          backgroundColor: "rgba(59, 130, 246, 0.2)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 2,
        },
        {
          label: "CRM Platform",
          data: [7, 6, 5, 4, 7],
          backgroundColor: "rgba(234, 179, 8, 0.2)",
          borderColor: "rgba(234, 179, 8, 1)",
          borderWidth: 2,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: {
        r: {
          angleLines: {
            display: true,
          },
          suggestedMin: 0,
          suggestedMax: 10,
        },
      },
    },
    defaultType: "radar",
  },
};

const systemsData = [
  {
    id: "SYS-1001",
    name: "ERP Core",
    department: "Finance",
    age: 9,
    status: "Legacy",
    maintenanceCost: 120000,
    riskScore: "High",
    priority: "Urgent",
    aiRecommendation: "Start phased migration Q3",
  },
  {
    id: "SYS-1002",
    name: "HR Suite",
    department: "HR",
    age: 5,
    status: "Active",
    maintenanceCost: 30000,
    riskScore: "Medium",
    priority: "Moderate",
    aiRecommendation: "Update integration APIs",
  },
  {
    id: "SYS-1003",
    name: "CRM Platform",
    department: "Marketing",
    age: 7,
    status: "Legacy",
    maintenanceCost: 85000,
    riskScore: "High",
    priority: "High",
    aiRecommendation: "Cloud migration to SaaS solution",
  },
  {
    id: "SYS-1004",
    name: "Data Warehouse",
    department: "IT",
    age: 4,
    status: "Active",
    maintenanceCost: 65000,
    riskScore: "Medium",
    priority: "Moderate",
    aiRecommendation: "Upgrade to latest version",
  },
  {
    id: "SYS-1005",
    name: "Email Servers",
    department: "IT",
    age: 11,
    status: "Legacy",
    maintenanceCost: 95000,
    riskScore: "Critical",
    priority: "Urgent",
    aiRecommendation: "Migrate to cloud service immediately",
  },
];

const aiInsights = [
  {
    type: "warning",
    message: "Delaying CRM upgrade will cost an estimated additional $320K over next 2 years.",
    action: "Review upgrade timeline with vendor",
  },
  {
    type: "danger",
    message: "Modernization coverage expected to drop to 55% by 2026 due to aging systems.",
    action: "Increase modernization budget allocation",
  },
  {
    type: "warning",
    message: "3 systems will reach end-of-support in next 12 months, increasing risk exposure.",
    action: "Schedule upgrade planning sessions",
  },
];

const aiSuggestions = [
  {
    type: "recommendation",
    icon: "✅",
    message: "Reallocate $150K from low-priority tools to upgrade legacy finance systems with higher ROI.",
    severity: "High Impact",
  },
  {
    type: "warning",
    icon: "⚠️",
    message: "3 systems identified as both outdated and high-risk — recommend immediate modernization.",
    severity: "Critical",
  },
  {
    type: "alert",
    icon: "📉",
    message: "Reduce annual tech maintenance by $220K with cloud migration of 2 infrastructure platforms.",
    severity: "High ROI",
  },
  {
    type: "recommendation",
    icon: "🔄",
    message: "Vendor consolidation could save $180K/year by eliminating duplicate tools.",
    severity: "Medium",
  },
];

const TechDebtModernization = () => {
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  // const { currentUser } = useContext(AuthContext);
  const [activeWidgets, setActiveWidgets] = useState([
    "debtByDepartment",
    "costVsProgress",
    "systemAgeDistribution",
    "readinessScore",
  ]);
  const [chartTypes, setChartTypes] = useState({
    debtByDepartment: "bar",
    costVsProgress: "line",
    systemAgeDistribution: "doughnut",
    readinessScore: "radar",
  });
  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const [aiInput, setAiInput] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const [showChartTypeDropdown, setShowChartTypeDropdown] = useState({});

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
      case "doughnut":
        return <Doughnut data={data} options={options} />;
      case "radar":
        return <Radar data={data} options={options} />;
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
            {...provided.draggableProps}
          >
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-s font-semibold text-sky-800">{title}</h3>
              <div className="flex space-x-2 relative">
                <div className="relative chart-dropdown">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDropdownWidget(
                        dropdownWidget === widgetId ? null : widgetId
                      );
                    }}
                    className="p-1 rounded hover:bg-gray-100"
                    data-tooltip-id="chart-type-tooltip"
                    data-tooltip-content="Options"
                  >
                    <BsThreeDotsVertical />
                  </button>

                  {dropdownWidget === widgetId && (
                    <div
                      ref={dropdownRef}
                      className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-10 border border-gray-200"
                    >
                      <div className="py-1 text-x text-gray-800">
                        <div
                          className="relative"
                          onMouseEnter={() => setHoveredChartType(widgetId)}
                          onMouseLeave={() => setHoveredChartType(null)}
                        >
                          <div className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center">
                            All Chart Types
                            <FiChevronDown className="ml-1 text-x" />
                          </div>

                          {hoveredChartType === widgetId && (
                            <div
                              className="absolute top-0 left-full w-40 bg-white rounded-md shadow-lg border border-gray-200 z-20 py-1"
                              style={{ marginLeft: "-1px" }}
                            >
                              {["bar", "line", "doughnut", "radar"].map((type) => (
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
                          }}
                        >
                          Analyze
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() =>
                    setShowAIDropdown(
                      showAIDropdown === widgetId ? null : widgetId
                    )
                  }
                  className="p-1 rounded hover:bg-gray-100"
                  data-tooltip-id="ai-tooltip"
                  data-tooltip-content="Ask AI"
                >
                  <BsStars />
                </button>
                {showAIDropdown === widgetId && (
                  <div
                    ref={aiChatbotRef}
                    className="absolute right-0 top-5 mt-2 w-full sm:w-64 bg-white rounded-md shadow-lg z-10 border border-gray-200 py-2"
                  >
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
                          disabled={!aiInput[widgetId]?.trim()}
                        >
                          <FiSend />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <div
                  {...provided.dragHandleProps}
                  className="p-1 rounded hover:bg-gray-100 cursor-move"
                >
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
        if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
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
      "totalTechDebt",
      "annualDelayCost",
    ].includes(title.replace(/ /g, ""));

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
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-sky-600 uppercase tracking-wider truncate">
                {title.replace(/([A-Z])/g, " $1")}
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
              {needsDollarSign && "$"}
              {typeof value === "number" ? value.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }) : value}
              {kpiData[title]?.unit && kpiData[title].unit}
            </p>
            <div
              className={`flex items-center mt-2 ${
                isPositive ? "text-green-500" : "text-red-500"
              }`}
            >
              {isPositive ? (
                <FiTrendingUp className="mr-1" />
              ) : (
                <FiTrendingDown className="mr-1" />
              )}
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

  // System Table Component
  const SystemTable = () => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
      <h3 className="text-s font-semibold text-sky-800 mb-2">System Inventory with Tech Debt Score</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-x text-gray-700">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left">System Name</th>
              <th className="p-2 text-left">Department</th>
              <th className="p-2 text-left">Age (Years)</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Maintenance Cost ($)</th>
              <th className="p-2 text-left">Risk Score</th>
              <th className="p-2 text-left">Modernization Priority</th>
              <th className="p-2 text-left">AI Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {systemsData.map((system, index) => (
              <tr
                key={index}
                className={`border-b ${
                  system.riskScore === "Critical" ? "bg-red-50" : 
                  system.riskScore === "High" ? "bg-orange-50" : ""
                }`}
              >
                <td className="p-2 font-medium">{system.name}</td>
                <td className="p-2">{system.department}</td>
                <td className="p-2">{system.age}</td>
                <td className="p-2">
                  <span className={`px-2 py-1 rounded-full text-x ${
                    system.status === "Legacy" ? "bg-red-100 text-red-800" :
                    system.status === "Active" ? "bg-blue-100 text-blue-800" :
                    "bg-green-100 text-green-800"
                  }`}>
                    {system.status}
                  </span>
                </td>
                <td className="p-2">${system.maintenanceCost.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                <td className="p-2">
                  <span className={`px-2 py-1 rounded-full text-x ${
                    system.riskScore === "Critical" ? "bg-red-100 text-red-800" :
                    system.riskScore === "High" ? "bg-orange-100 text-orange-800" :
                    "bg-yellow-100 text-yellow-800"
                  }`}>
                    {system.riskScore}
                  </span>
                </td>
                <td className="p-2">
                  <span className={`px-2 py-1 rounded-full text-x ${
                    system.priority === "Urgent" ? "bg-red-100 text-red-800" :
                    system.priority === "High" ? "bg-orange-100 text-orange-800" :
                    system.priority === "Moderate" ? "bg-blue-100 text-blue-800" :
                    "bg-gray-100 text-gray-800"
                  }`}>
                    {system.priority}
                  </span>
                </td>
                <td className="p-2">
                  <div className="flex items-center">
                    <span className="mr-1">🧠</span>
                    <span 
                      className="truncate max-w-xs"
                      data-tooltip-id={`tooltip-${index}`}
                      data-tooltip-content={system.aiRecommendation}
                    >
                      {system.aiRecommendation}
                    </span>
                    <ReactTooltip id={`tooltip-${index}`} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // AI Insights Card
  const AIInsightsCard = () => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
      <h3 className="text-s font-semibold text-sky-800 mb-2">AI Predictive Insights</h3>
      <div className="space-y-3">
        {aiInsights.map((insight, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg border-l-4 ${
              insight.type === "danger" ? "border-red-500 bg-red-50" :
              "border-yellow-500 bg-yellow-50"
            }`}
          >
            <div className="flex items-start">
              <span className="mr-2">🔮</span>
              <div>
                <p className="text-x font-medium">{insight.message}</p>
                <p className="text-x mt-1 text-gray-600">Suggested action: {insight.action}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // AI Suggestions Card
  const AISuggestionsCard = () => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
      <h3 className="text-s font-semibold text-sky-800 mb-2">AI Recommendations</h3>
      <div className="space-y-3">
        {aiSuggestions.map((suggestion, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg border-l-4 ${
              suggestion.type === "alert" ? "border-red-500 bg-red-50" :
              suggestion.type === "warning" ? "border-yellow-500 bg-yellow-50" :
              "border-green-500 bg-green-50"
            }`}
          >
            <div className="flex items-start">
              <span className="mr-2 text-lg">{suggestion.icon}</span>
              <div>
                <p className="text-x font-medium">{suggestion.message}</p>
                <p className="text-x mt-1 text-gray-600">
                  <span className={`px-2 py-1 rounded-full ${
                    suggestion.severity === "Critical" || suggestion.severity === "High Urgency" ? 
                    "bg-red-100 text-red-800" :
                    suggestion.severity === "High Impact" || suggestion.severity === "High ROI" ?
                    "bg-green-100 text-green-800" :
                    "bg-yellow-100 text-yellow-800"
                  }`}>
                    {suggestion.severity}
                  </span>
                </p>
              </div>
            </div>
          </div>
        ))}
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
                                                  <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Tech Debt & Modernization</span>
                                                </div>
                                              </li>
                                            </ol>
                                          </nav>
      {/* Header */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">
              Tech Debt & Modernization Index
            </h1>
            {/* <p className="text-sky-100 text-x">{currentUser.company_name}</p> */}
          </div>
          <div className="flex space-x-2">
            <button
              type="button"
              className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200"
              onClick={() => setShowFilters(!showFilters)}
            >
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
              className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200"
            >
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
                Date Range
              </label>
              <select className="w-full p-2 border border-gray-300 rounded-md text-x">
                <option>Quarterly</option>
                <option>YTD</option>
                <option>Last 12 Months</option>
                <option>Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-x font-medium text-gray-700 mb-1">
                Department
              </label>
              <select className="w-full p-2 border border-gray-300 rounded-md text-x">
                <option>All</option>
                <option>IT</option>
                <option>Finance</option>
                <option>HR</option>
                <option>Operations</option>
                <option>Marketing</option>
              </select>
            </div>
            <div>
              <label className="block text-x font-medium text-gray-700 mb-1">
                System Type
              </label>
              <select className="w-full p-2 border border-gray-300 rounded-md text-x">
                <option>All</option>
                <option>Infrastructure</option>
                <option>Application</option>
                <option>SaaS</option>
                <option>On-Prem</option>
              </select>
            </div>
            <div>
              <label className="block text-x font-medium text-gray-700 mb-1">
  System Age
</label>
<select className="w-full p-2 border border-gray-300 rounded-md text-x">
  <option>All</option>
  <option>&lt;5 years</option>
  <option>5-10 years</option>
  <option>10+ years</option>
</select>
</div>
</div>
</div>
)}

{/* KPI Cards */}
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
  <KPICard
    title="totalTechDebt"
    value={kpiData.totalTechDebt.value}
    change={kpiData.totalTechDebt.change}
    isPositive={kpiData.totalTechDebt.isPositive}
    icon={<FiDollarSign size={16} />}
    componentPath={kpiData.totalTechDebt.componentPath}
  />
  {/* <KPICard
    title="legacySystems"
    value={kpiData.legacySystems.value}
    change={kpiData.legacySystems.change}
    isPositive={kpiData.legacySystems.isPositive}
    icon={<FiServer size={16} />}
    componentPath={kpiData.legacySystems.componentPath}
  /> */}
  <KPICard
    title="avgSystemAge"
    value={kpiData.avgSystemAge.value}
    change={kpiData.avgSystemAge.change}
    isPositive={kpiData.avgSystemAge.isPositive}
    icon={<FiClock size={16} />}
    componentPath={kpiData.avgSystemAge.componentPath}
  />
  <KPICard
    title="modernizationCoverage"
    value={kpiData.modernizationCoverage.value}
    change={kpiData.modernizationCoverage.change}
    isPositive={kpiData.modernizationCoverage.isPositive}
    icon={<FiShield size={16} />}
    componentPath={kpiData.modernizationCoverage.componentPath}
  />
  <KPICard
    title="annualDelayCost"
    value={kpiData.annualDelayCost.value}
    change={kpiData.annualDelayCost.change}
    isPositive={kpiData.annualDelayCost.isPositive}
    icon={<FiDollarSign size={16} />}
    componentPath={kpiData.annualDelayCost.componentPath}
  />
  <KPICard
    title="highRiskSystems"
    value={kpiData.highRiskSystems.value}
    change={kpiData.highRiskSystems.change}
    isPositive={kpiData.highRiskSystems.isPositive}
    icon={<FiCpu size={16} />}
    componentPath={kpiData.highRiskSystems.componentPath}
  />
</div>

{/* Charts Section */}
<DragDropContext onDragEnd={onDragEnd}>
  <Droppable droppableId="charts">
    {(provided) => (
      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
        {...provided.droppableProps}
        ref={provided.innerRef}
      >
        {activeWidgets.map((widgetId, index) => (
          <EnhancedChartCard
            key={widgetId}
            title={charts[widgetId].title}
            chartType={chartTypes[widgetId]}
            chartData={charts[widgetId]}
            componentPath={charts[widgetId].componentPath}
            widgetId={widgetId}
            index={index}
          />
        ))}
        {provided.placeholder}
      </div>
    )}
  </Droppable>
</DragDropContext>

{/* System Table */}
<SystemTable />

{/* AI Insights and Suggestions */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  <AIInsightsCard />
  <AISuggestionsCard />
</div>
</div>
);
};

export default TechDebtModernization;
