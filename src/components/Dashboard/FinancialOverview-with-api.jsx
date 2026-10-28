import React, { useState, useRef, useEffect, useContext } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  RadialLinearScale,
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
  Radar,
  PolarArea,
  Bubble,
} from "react-chartjs-2";
import { motion } from "framer-motion";
import {
  FiTrendingUp,
  FiTrendingDown,
  FiDownload,
  FiDollarSign,
  FiPieChart,
  FiFilter,
  FiPlus,
  FiChevronDown,
  FiSend,
  FiUsers,
} from "react-icons/fi";
import { BsStars, BsThreeDotsVertical } from "react-icons/bs";
import { Tooltip as ReactTooltip } from "react-tooltip";
import { RiDragMove2Fill } from "react-icons/ri";
import { AuthContext } from "../../context/AuthContext";
import WidgetSelector from "./WidgetSelector";
import { getDecimalPrecision } from '../../utils/formatters';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
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

const FinancialOverviewApi = () => {
  const navigate = useNavigate();
  const [showAIChatbot, setShowAIChatbot] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const { currentUser } = useContext(AuthContext);
  const [financialData, setFinancialData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeWidgets, setActiveWidgets] = useState([
    "revenueTrend",
    "expenseBreakdown",
    "profitAnalysis",
    "cashFlow",
    "Expenses",
    "netProfit",
    "headcount",
  ]);
  const [chartTypes, setChartTypes] = useState({
    revenueTrend: "line",
    expenseBreakdown: "pie",
    profitAnalysis: "bar",
    cashFlow: "line",
    Expenses: "line",
    netProfit: "bar",
    headcount: "line",
  });

  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const [aiInput, setaiInput] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const [showChartTypeDropdown, setShowChartTypeDropdown] = useState({});

  const filtersRef = useRef(null);
  const aiChatbotRef = useRef(null);

  // Sample headcount data (to be replaced with API data when available)
  const sampleHeadcountData = {
    value: 126,
    change: "+1%",
    trend: {
      Jan: 120,
      Feb: 122,
      Mar: 124,
      Apr: 125,
      May: 126,
      Jun: 126,
      Jul: 127,
      Aug: 128,
      Sep: 130,
      Oct: 131,
      Nov: 132,
      Dec: 133,
    },
  };

  useEffect(() => {
    const fetchFinancialData = async () => {
      try {
        const response = await axios.get(
          "https://fpnainsightsapi.mavenerp.in/api/v1/company/financial/financial-overview"
        );
        setFinancialData(response.data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchFinancialData();
  }, []);

  // Generate KPI data from API
  const getKPIData = () => {
    if (!financialData) return {};

    return {
      revenue: {
        value: financialData.revenue,
        change: calculateChange(financialData.revenue, financialData.revenue * 0.95), // Example: comparing with 5% less
        componentPath: "/revenue-component",
      },
      gross_profit: {
        value: financialData.gross_profit,
        change: calculateChange(financialData.gross_profit, financialData.gross_profit * 0.93),
        componentPath: "/revenue-component",
      },
      expenses: {
        value: financialData.expenses,
        change: calculateChange(financialData.expenses, financialData.expenses * 0.97),
        componentPath: "/expense-component",
      },
      net_profit: {
        value: financialData.net_profit,
        change: calculateChange(financialData.net_profit, financialData.net_profit * 1.03), // Negative profit improvement
        componentPath: "/revenue-component",
      },
      cash_flow: {
        value: financialData.cash_flow,
        change: calculateChange(financialData.cash_flow, financialData.cash_flow * 1.05),
        componentPath: "/revenue-component",
      },
      headcount: {
        value: sampleHeadcountData.value,
        change: sampleHeadcountData.change,
        componentPath: "/hr-component",
      },
    };
  };

  // Helper function to calculate percentage change
  const calculateChange = (current, previous) => {
    const change = ((current - previous) / Math.abs(previous)) * 100;
    return `${change >= 0 ? '+' : ''}${change.toFixed(getDecimalPrecision())}%`;
  };

  // Generate chart data from API
  const getChartsData = () => {
    if (!financialData) return {};

    return {
      revenueTrend: {
        title: "Revenue Trend",
        componentPath: "/revenue-component",
        data: {
          labels: Object.keys(financialData.revenue_trend),
          datasets: [
            {
              label: "Revenue",
              data: Object.values(financialData.revenue_trend),
              backgroundColor: "rgba(14, 165, 233, 0.2)",
              borderColor: "rgba(14, 165, 233, 1)",
              borderWidth: 2,
              tension: 0.4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom" } },
        },
        defaultType: "line",
      },
      expenseBreakdown: {
        title: "Expense Breakdown",
        componentPath: "/expense-component",
        data: {
          labels: Object.keys(financialData.expense_breakdown).map(key => 
            key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')
          ),
          datasets: [
            {
              label: "Expenses",
              data: Object.values(financialData.expense_breakdown),
              backgroundColor: [
                "rgba(239, 68, 68, 0.7)",
                "rgba(59, 130, 246, 0.7)",
                "rgba(234, 179, 8, 0.7)",
                "rgba(16, 185, 129, 0.7)",
                "rgba(139, 92, 246, 0.7)",
                "rgba(20, 184, 166, 0.7)",
                "rgba(245, 158, 11, 0.7)",
                "rgba(236, 72, 153, 0.7)",
              ],
              borderColor: [
                "rgba(239, 68, 68, 1)",
                "rgba(59, 130, 246, 1)",
                "rgba(234, 179, 8, 1)",
                "rgba(16, 185, 129, 1)",
                "rgba(139, 92, 246, 1)",
                "rgba(20, 184, 166, 1)",
                "rgba(245, 158, 11, 1)",
                "rgba(236, 72, 153, 1)",
              ],
              borderWidth: 1,
            },
          ],
        },
        options: {
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom" } },
        },
        defaultType: "pie",
      },
      profitAnalysis: {
        title: "Profit Analysis",
        componentPath: "/revenue-component",
        data: {
          labels: Object.keys(financialData.profit_analysis),
          datasets: [
            {
              label: "Gross Profit",
              data: Object.values(financialData.profit_analysis).map(q => q.gross),
              backgroundColor: "rgba(16, 185, 129, 0.2)",
              borderColor: "rgba(16, 185, 129, 1)",
              borderWidth: 1,
            },
            {
              label: "Net Profit",
              data: Object.values(financialData.profit_analysis).map(q => q.net),
              backgroundColor: "rgba(139, 92, 246, 0.2)",
              borderColor: "rgba(139, 92, 246, 1)",
              borderWidth: 1,
            },
          ],
        },
        options: {
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom" } },
        },
        defaultType: "bar",
      },
      cashFlow: {
        title: "Cash Flow",
        componentPath: "/revenue-component",
        data: {
          labels: Object.keys(financialData.revenue_trend),
          datasets: [
            {
              label: "Cash Flow",
              data: Object.keys(financialData.revenue_trend).map(() => financialData.cash_flow),
              backgroundColor: "rgba(14, 165, 233, 0.2)",
              borderColor: "rgba(14, 165, 233, 1)",
              borderWidth: 2,
              tension: 0.4,
            },
          ],
        },
        options: {
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom" } },
        },
        defaultType: "line",
      },
      headcount: {
        title: "Headcount Trend",
        componentPath: "/hr-component",
        data: {
          labels: Object.keys(sampleHeadcountData.trend),
          datasets: [
            {
              label: "Employees",
              data: Object.values(sampleHeadcountData.trend),
              backgroundColor: "rgba(167, 139, 250, 0.2)",
              borderColor: "rgba(167, 139, 250, 1)",
              borderWidth: 2,
            },
            {
              label: "Target",
              data: Object.values(sampleHeadcountData.trend).map(val => val - 2),
              backgroundColor: "rgba(126, 99, 235, 0.2)",
              borderColor: "rgba(126, 99, 235, 1)",
              borderWidth: 2,
              borderDash: [5, 5],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom" } },
        },
        defaultType: "line",
      },
    };
  };

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
      setaiInput((prev) => ({
        ...prev,
        [widgetId]: "", // Clear only this widget's input
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
      case "radar":
        return <Radar data={data} options={options} />;
      case "polarArea":
        return <PolarArea data={data} options={options} />;
      case "bubble":
        return <Bubble data={data} options={options} />;
      default:
        return <Line data={data} options={options} />;
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
                                "line",
                                "bar",
                                "pie",
                                "doughnut",
                                "radar",
                                "polarArea",
                                "bubble",
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
                            setaiInput((prev) => ({
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
  const KPICard = ({
    title,
    value,
    change,
    isPositive,
    icon,
    componentPath,
  }) => {
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
      "revenue",
      "gross_profit",
      "expenses",
      "net_profit",
      "cash_flow",
    ].includes(title.toLowerCase().replace(/ /g, "_"));

    return (
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        whileHover={{ y: -3 }}
        className="bg-white p-3 rounded-lg shadow-sm border border-sky-100 relative"
        onClick={() => navigate(componentPath)}>
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-sky-600 uppercase tracking-wider truncate">
                {title.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1')}
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation(); // This stops the event from bubbling up
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
                  onClick={(e) => e.stopPropagation()}>
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

  // Placeholder Table Component
  const DataTable = () => {
    if (!financialData) return null;
    
    const kpiData = getKPIData();
    
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <h3 className="text-s font-semibold text-sky-800 mb-2">Summary Table</h3>
        <table className="w-full text-x text-gray-700">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left">Metric</th>
              <th className="p-2 text-left">Value</th>
              <th className="p-2 text-left">Change</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(kpiData).map(([key, value], index) => {
              const needsDollarSign = [
                "revenue",
                "gross_profit",
                "expenses",
                "net_profit",
                "cash_flow",
              ].includes(key);
              return (
                <tr key={index} className="border-b">
                  <td className="p-2">{key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1')}</td>
                  <td className="p-2">
                    {needsDollarSign && "$"}
                    {typeof value.value === "number"
                      ? value.value.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })
                      : value.value}
                  </td>
                  <td className="p-2">{value.change}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  if (!financialData) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div>No data available</div>
      </div>
    );
  }

  const kpiData = getKPIData();
  const chartsData = getChartsData();

  return (
    <div className="space-y-6 p-4 min-h-screen relative bg-sky-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">
              Financial Dashboard
            </h1>
            <p className="text-sky-100 text-x">{currentUser.company_name}</p>
          </div>
          <div className="flex space-x-2">
            <button
              type="button"
              className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200"
              onClick={() => setShowFilters(!showFilters)}>
              <FiFilter className="mr-1" />
              Filters
            </button>
            {/* <button
              type="button"
              className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200">
              <FiPlus className="mr-1" />
              Add Widget
            </button> */}
            <WidgetSelector activeWidgets={activeWidgets} setActiveWidgets={setActiveWidgets} />

            <button
              onClick={() => window.print()}
              className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white  bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 hover:text-sky-900 transition-colors duration-200">
              <FiDownload className="text-sky-50 hover:text-sky-900" />
              <span className="text-sky-50 hover:text-sky-900">Export</span>
            </button>
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
                <option>Month</option>
                <option>Quarter</option>
                <option>YTD</option>
                <option>Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-x font-medium text-gray-700 mb-1">
                Business Unit
              </label>
              <select className="w-full p-2 border border-gray-300 rounded-md text-x">
                <option>All</option>
                <option>North America</option>
                <option>Europe</option>
                <option>Asia</option>
              </select>
            </div>
            <div>
              <label className="block text-x font-medium text-gray-700 mb-1">
                Geography
              </label>
              <select className="w-full p-2 border border-gray-300 rounded-md text-x">
                <option>All</option>
                <option>USA</option>
                <option>UK</option>
                <option>Germany</option>
              </select>
            </div>
            <div>
              <label className="block text-x font-medium text-gray-700 mb-1">
                Client Demographics
              </label>
              <select className="w-full p-2 border border-gray-300 rounded-md text-x">
                <option>All</option>
                <option>By Industry</option>
                <option>By Revenue Person</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {Object.entries(kpiData).map(([key, value], index) => {
          const isPositive = value.change.startsWith('+');
          return (
            <KPICard
              key={key}
              title={key}
              value={value.value}
              change={value.change}
              isPositive={isPositive}
              icon={
                key === "revenue" ? (
                  <FiTrendingUp size={16} />
                ) : key === "gross_profit" ||
                  key === "expenses" ||
                  key === "net_profit" ? (
                  <FiDollarSign size={16} />
                ) : key === "cash_flow" ? (
                  <FiTrendingUp size={16} />
                ) : key === "headcount" ? (
                  <FiUsers size={16} />
                ) : (
                  <FiPieChart size={16} />
                )
              }
              componentPath={value.componentPath}
            />
          );
        })}
      </div>

      {/* Charts Section - Widgets with Drag and Drop */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="charts" isDropDisabled={false}>
          {(provided) => (
            <div
              className="grid gap-6"
              {...provided.droppableProps}
              ref={provided.innerRef}>
              {/* Row 1: 3 charts (2 vertical + 1 spanning 2 columns) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                <EnhancedChartCard
                  title={chartsData.revenueTrend.title}
                  chartType={chartTypes.revenueTrend}
                  chartData={chartsData.revenueTrend}
                  widgetId="revenueTrend"
                  index={0}
                  componentPath={chartsData.revenueTrend.componentPath}
                />
                <EnhancedChartCard
                  title={chartsData.expenseBreakdown.title}
                  chartType={chartTypes.expenseBreakdown}
                  chartData={chartsData.expenseBreakdown}
                  widgetId="expenseBreakdown"
                  index={1}
                  componentPath={chartsData.expenseBreakdown.componentPath}
                />
                <EnhancedChartCard
                  title={chartsData.profitAnalysis.title}
                  chartType={chartTypes.profitAnalysis}
                  chartData={chartsData.profitAnalysis}
                  widgetId="profitAnalysis"
                  index={2}
                  componentPath={chartsData.revenueTrend.componentPath}
                />
              </div>

              {/* Row 2: 2 charts side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <EnhancedChartCard
                  title={chartsData.cashFlow.title}
                  chartType={chartTypes.cashFlow}
                  chartData={chartsData.cashFlow}
                  widgetId="cashFlow"
                  index={3}
                  componentPath={chartsData.revenueTrend.componentPath}
                />
                <EnhancedChartCard
                  title={chartsData.headcount.title}
                  chartType={chartTypes.headcount}
                  chartData={chartsData.headcount}
                  widgetId="headcount"
                  index={4}
                  componentPath={chartsData.headcount.componentPath}
                />
              </div>

              {/* Row 3: Data table */}
              <div className="grid grid-cols-1 gap-6 items-start">
                <DataTable />
              </div>

              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Tooltips */}
      <ReactTooltip id="chart-type-tooltip" place="top" effect="solid" />
      <ReactTooltip id="ai-tooltip" place="top" effect="solid" />
    </div>
  );
};

export default FinancialOverviewApi;