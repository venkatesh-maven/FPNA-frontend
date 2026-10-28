import React, { useState, useRef, useEffect } from "react";
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
  FiDollarSign, 
  FiFilter, 
  FiDownload,
  FiPlus, 
  FiChevronDown, 
  FiSend, 
  FiTrendingUp, 
  FiTrendingDown,
  FiClock,
  FiPieChart,
  FiShield,
  FiCreditCard,
  FiFileText,
  FiBarChart2
} from "react-icons/fi";
import { BsStars, BsThreeDotsVertical, BsCashStack } from "react-icons/bs";
import { Tooltip as ReactTooltip } from "react-tooltip";
import { RiDragMove2Fill } from "react-icons/ri";
import { GrLinkNext } from "react-icons/gr";
import { getDecimalPrecision } from '../../../utils/formatters';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

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

// Navigation items for finance dashboard
const navItems = [
  { name: "Liquidity Analysis", icon: <BsCashStack />, path: "/liquidity-working-capital" },
  { name: "Profitability Ratios", icon: <FiTrendingUp />, path: "/profitability-ratios" },
  { name: "Debt Coverage", icon: <FiCreditCard />, path: "/debt-coverage" },
  { name: "Budget Variance", icon: <FiBarChart2 />, path: "/budget-utilization" },
  { name: "Tax Compliance", icon: <FiShield />, path: "/tax-compliance" },
  { name: "Expense Trends", icon: <FiFileText />, path: "/expense-trend-analysis" }
];

// KPI Data for finance dashboard
const kpiData = {
  currentRatio: { 
    value: 1.8, 
    change: "+0.2", 
    isPositive: true, 
    componentPath: "/finance-accounting-table",
    forecast: "1.9 next quarter",
    description: "Current Assets / Current Liabilities"
  },
//   cashConversionCycle: { 
//     value: 45, 
//     change: "-5", 
//     isPositive: true, 
//     componentPath: "/finance-accounting-table",
//     forecast: "42 days next quarter",
//     description: "Days inventory + receivables - payables"
//   },
  grossMargin: { 
    value: 42, 
    change: "+1.5", 
    isPositive: true, 
    componentPath: "/finance-accounting-table",
    forecast: "43% next quarter",
    description: "Gross Profit / Revenue"
  },
  operatingMargin: { 
    value: 18, 
    change: "-0.5", 
    isPositive: false, 
    componentPath: "/finance-accounting-table",
    forecast: "17.5% next quarter",
    description: "Operating Income / Revenue"
  },
  debtToEquity: { 
    value: 0.65, 
    change: "+0.05", 
    isPositive: false, 
    componentPath: "/finance-accounting-table",
    forecast: "0.68 next quarter",
    description: "Total Liabilities / Shareholders' Equity"
  },
  budgetVariance: { 
    value: -3.2, 
    change: "+1.8", 
    isPositive: true, 
    componentPath: "/finance-accounting-table",
    forecast: "-2.5% next quarter",
    description: "Actual vs Budget Variance"
  },
};

// Chart configurations for finance dashboard
const charts = {
  liquidityMetrics: {
    title: "Liquidity Metrics Trend",
    componentPath: "/finance-accounting-table",
    data: {
      labels: ["Q1", "Q2", "Q3", "Q4", "Q1 Forecast"],
      datasets: [
        { 
          label: "Current Ratio", 
          data: [1.5, 1.6, 1.7, 1.8, 1.9], 
          backgroundColor: "rgba(16, 185, 129, 0.2)", 
          borderColor: "rgba(16, 185, 129, 1)", 
          borderWidth: 2,
          yAxisID: 'y'
        },
        { 
          label: "Quick Ratio", 
          data: [1.2, 1.3, 1.25, 1.35, 1.4], 
          backgroundColor: "rgba(59, 130, 246, 0.2)", 
          borderColor: "rgba(59, 130, 246, 1)", 
          borderWidth: 2,
          yAxisID: 'y'
        },
        { 
          label: "Cash Conv. Cycle (days)", 
          data: [55, 50, 48, 45, 42], 
          backgroundColor: "rgba(234, 179, 8, 0.2)", 
          borderColor: "rgba(234, 179, 8, 1)", 
          borderWidth: 2,
          yAxisID: 'y1'
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
          title: { display: true, text: 'Ratio' }
        },
        y1: { 
          type: 'linear',
          display: true,
          position: 'right',
          title: { display: true, text: 'Days' },
          grid: { drawOnChartArea: false }
        },
      },
    },
    defaultType: "line",
  },
  profitabilityTrend: {
    title: "Profitability Trend",
    componentPath: "/finance-accounting-table",
    data: {
      labels: ["Q1", "Q2", "Q3", "Q4", "Q1 Forecast"],
      datasets: [
        { 
          label: "Gross Margin", 
          data: [40, 41, 41.5, 42, 43], 
          backgroundColor: "rgba(16, 185, 129, 0.2)", 
          borderColor: "rgba(16, 185, 129, 1)", 
          borderWidth: 2 
        },
        { 
          label: "Operating Margin", 
          data: [19, 18.5, 18.2, 18, 17.5], 
          backgroundColor: "rgba(59, 130, 246, 0.2)", 
          borderColor: "rgba(59, 130, 246, 1)", 
          borderWidth: 2 
        },
        { 
          label: "Net Margin", 
          data: [12, 11.5, 11.2, 11, 10.8], 
          backgroundColor: "rgba(234, 179, 8, 0.2)", 
          borderColor: "rgba(234, 179, 8, 1)", 
          borderWidth: 2 
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
              return `${context.dataset.label}: ${context.raw}%`;
            }
          }
        }
      },
      scales: {
        y: {
          min: 0,
          max: 50,
          ticks: {
            callback: function(value) {
              return value + '%';
            }
          }
        }
      }
    },
    defaultType: "line",
  },
  debtCoverage: {
    title: "Debt & Coverage Metrics",
    componentPath: "/finance-accounting-table",
    data: {
      labels: ["Q1", "Q2", "Q3", "Q4", "Q1 Forecast"],
      datasets: [
        { 
          label: "Debt-to-Equity", 
          data: [0.6, 0.62, 0.63, 0.65, 0.68], 
          backgroundColor: "rgba(239, 68, 68, 0.2)", 
          borderColor: "rgba(239, 68, 68, 1)", 
          borderWidth: 2 
        },
        { 
          label: "Interest Coverage", 
          data: [5.2, 5.0, 4.8, 4.6, 4.4], 
          backgroundColor: "rgba(59, 130, 246, 0.2)", 
          borderColor: "rgba(59, 130, 246, 1)", 
          borderWidth: 2 
        }
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: {
        y: { 
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return value.toFixed(getDecimalPrecision()) + 'x';
            }
          }
        }
      }
    },
    defaultType: "bar",
  },
  budgetVariance: {
    title: "Department Budget Variance",
    componentPath: "/finance-accounting-table",
    data: {
      labels: ["R&D", "Sales", "Marketing", "Operations", "Finance"],
      datasets: [
        { 
          label: "Budget Variance (%)", 
          data: [-2.5, -4.2, -5.8, -1.9, -3.2], 
          backgroundColor: [
            "rgba(239, 68, 68, 0.7)", 
            "rgba(239, 68, 68, 0.7)", 
            "rgba(239, 68, 68, 0.7)", 
            "rgba(16, 185, 129, 0.7)", 
            "rgba(239, 68, 68, 0.7)"
          ],
          borderColor: [
            "rgba(239, 68, 68, 1)", 
            "rgba(239, 68, 68, 1)", 
            "rgba(239, 68, 68, 1)", 
            "rgba(16, 185, 129, 1)", 
            "rgba(239, 68, 68, 1)"
          ],
          borderWidth: 1 
        }
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `Variance: ${context.raw}%`;
            }
          }
        }
      },
      scales: {
        y: {
          ticks: {
            callback: function(value) {
              return value + '%';
            }
          }
        }
      }
    },
    defaultType: "bar",
  },
  expenseBreakdown: {
    title: "Expense Breakdown",
    componentPath: "/finance-accounting-table",
    data: {
      labels: ["Salaries", "Office", "Travel", "Software", "Marketing"],
      datasets: [
        { 
          label: "Expenses", 
          data: [45, 15, 10, 20, 10], 
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
              return `${context.label}: ${context.raw}%`;
            }
          }
        }
      }
    },
    defaultType: "doughnut",
  },
  complianceStatus: {
    title: "Compliance Status",
    componentPath: "/finance-accounting-table",
    data: {
      labels: ["Fully Compliant", "Partially Compliant", "Non-Compliant"],
      datasets: [
        { 
          label: "Policies", 
          data: [85, 10, 5], 
          backgroundColor: [
            "rgba(16, 185, 129, 0.7)", 
            "rgba(234, 179, 8, 0.7)", 
            "rgba(239, 68, 68, 0.7)"
          ],
          borderColor: [
            "rgba(16, 185, 129, 1)", 
            "rgba(234, 179, 8, 1)", 
            "rgba(239, 68, 68, 1)"
          ],
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
              return `${context.label}: ${context.raw}%`;
            }
          }
        }
      }
    },
    defaultType: "pie",
  }
};

const FinanceAccountingDashboard = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    timePeriod: "Last Quarter",
    department: "All Departments",
    region: "All Regions",
    fiscalYear: "FY2024"
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [activeWidgets, setActiveWidgets] = useState([
    "liquidityMetrics", 
    "profitabilityTrend", 
    "debtCoverage", 
    "budgetVariance", 
    "expenseBreakdown", 
    "complianceStatus"
  ]);
  const [chartTypes, setChartTypes] = useState({
    liquidityMetrics: "line",
    profitabilityTrend: "line",
    debtCoverage: "bar",
    budgetVariance: "bar",
    expenseBreakdown: "doughnut",
    complianceStatus: "pie"
  });
  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const [aiInput, setAiInput] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const filtersRef = useRef(null);
  const aiChatbotRef = useRef(null);

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
      default: return <Line data={data} options={options} />;
    }
  };

  const EnhancedChartCard = ({ title, componentPath, chartType, chartData, widgetId, index }) => {
    const dropdownRef = useOutsideClick(() => setDropdownWidget(null));
    return (
      <Draggable draggableId={widgetId} index={index}>
        {(provided) => (
          <div className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border border-sky-100" 
               ref={provided.innerRef} {...provided.draggableProps}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-md font-semibold text-sky-800">{title}</h3>
              <div className="flex space-x-2 relative">
                <div className="relative chart-dropdown">
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setDropdownWidget(dropdownWidget === widgetId ? null : widgetId); 
                    }} 
                    className="p-1 rounded hover:bg-gray-100" 
                    data-tooltip-id="chart-type-tooltip" 
                    data-tooltip-content="Options"
                  >
                    <BsThreeDotsVertical />
                  </button>
                  {dropdownWidget === widgetId && (
                    <div ref={dropdownRef} className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                      <div className="py-1 text-x text-gray-800">
                        <div 
                          className="relative" 
                          onMouseEnter={() => setHoveredChartType(widgetId)} 
                          onMouseLeave={() => setHoveredChartType(null)}
                        >
                          <div className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center">
                            All Chart Types <FiChevronDown className="ml-1 text-x" />
                          </div>
                          {hoveredChartType === widgetId && (
                            <div 
                              className="absolute top-0 left-full w-40 bg-white rounded-md shadow-lg border border-gray-200 z-20 py-1" 
                              style={{ marginLeft: "-1px" }}
                            >
                              {["line", "bar", "pie", "doughnut"].map((type) => (
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
                  <div ref={aiChatbotRef} className="absolute right-0 top-5 mt-2 w-full sm:w-64 bg-white rounded-md shadow-lg z-10 border border-gray-200 py-2">
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
                <div {...provided.dragHandleProps} className="p-1 rounded hover:bg-gray-100 cursor-move">
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

  const KPICard = ({ title, value, change, isPositive, icon, componentPath, forecast, description }) => {
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
              {typeof value === "number" ? 
                title.includes("Ratio") || title.includes("Margin") ? 
                  value.toFixed(getDecimalPrecision()) + (title.includes("Margin") ? "%" : "") : 
                  value.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }) : 
                value}
              {title === "Debt-to-Equity" && "x"}
            </p>
            <div className={`flex items-center mt-2 ${isPositive ? "text-green-500" : "text-red-500"}`}>
              {isPositive ? <FiTrendingUp className="mr-1" /> : <FiTrendingDown className="mr-1" />}
              <span className="text-[10px] font-medium">
                {change} {isPositive ? "↑" : "↓"} vs last period
              </span>
            </div>
            <div className="mt-1">
              <p className="text-[10px] text-gray-500 italic">Forecast: {forecast}</p>
              <p className="text-[10px] text-gray-400">{description}</p>
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

  const DebtScheduleTable = () => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
      <h3 className="text-s font-semibold text-sky-800 mb-2">Debt Repayment Schedule (with AI Forecast)</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-x text-gray-700">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left">Loan</th>
              <th className="p-2 text-left">Principal</th>
              <th className="p-2 text-left">Interest Rate</th>
              <th className="p-2 text-left">Next Payment</th>
              <th className="p-2 text-left">Forecasted Impact</th>
            </tr>
          </thead>
          <tbody>
            {[
              { 
                loan: "Term Loan A", 
                principal: "$1,200,000", 
                rate: "5.25%", 
                payment: "$25,000 (Jul 15)", 
                impact: "🟢 No liquidity issues forecasted" 
              },
              { 
                loan: "Line of Credit", 
                principal: "$500,000", 
                rate: "6.75%", 
                payment: "$8,750 (Jul 20)", 
                impact: "🟡 Monitor cash position" 
              },
              { 
                loan: "Equipment Loan", 
                principal: "$350,000", 
                rate: "4.50%", 
                payment: "$12,000 (Aug 1)", 
                impact: "🟢 No liquidity issues forecasted" 
              },
              { 
                loan: "Term Loan B", 
                principal: "$2,000,000", 
                rate: "6.25%", 
                payment: "$45,000 (Aug 15)", 
                impact: "🔴 Potential cash shortfall forecasted" 
              }
            ].map((row, i) => (
              <tr key={i} className={`border-b ${row.impact.includes("🔴") ? "bg-red-50" : row.impact.includes("🟡") ? "bg-yellow-50" : ""}`}>
                <td className="p-2">{row.loan}</td>
                <td className="p-2">{row.principal}</td>
                <td className="p-2">{row.rate}</td>
                <td className="p-2">{row.payment}</td>
                <td className="p-2">{row.impact}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(activeWidgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setActiveWidgets(items);
  };

  return (
    <div className="space-y-6 p-4 min-h-screen relative bg-sky-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Finance & Accounting Analytics</h1>
            <p className="text-sky-100 text-x">{selectedCompany}</p>
            <p className="text-sky-100 text-x mt-1">Financial Health & Risk Management</p>
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
            {/* <button
              type="button"
              className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200"
            >
              <GrLinkNext className="mr-1" /> Export Report
            </button> */}
             <Link
     to="/finance-accounting-table">
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

      {/* Filter Options */}
      {showFilters && (
        <div className="bg-white p-4 rounded-lg shadow-sm" ref={filtersRef}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {["Time Period", "Department", "Region", "Fiscal Year"].map((filter, i) => (
              <div key={i}>
                <label className="block text-s font-medium text-gray-700 mb-1">{filter}</label>
                <select 
                  className="w-full p-2 border border-gray-300 rounded-md text-s"
                  value={filters[filter.toLowerCase().replace(" ", "")]}
                  onChange={(e) => setFilters(prev => ({ ...prev, [filter.toLowerCase().replace(" ", "")]: e.target.value }))}
                >
                  {filter === "Time Period" && ["Last Quarter", "Last Month", "Year to Date", "Custom Range"].map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                  {filter === "Department" && ["All Departments", "R&D", "Sales", "Marketing", "Operations", "Finance"].map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                  {filter === "Region" && ["All Regions", "North America", "Europe", "Asia", "South America"].map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                  {filter === "Fiscal Year" && ["FY2024", "FY2023", "FY2022"].map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* Quick Links to Sub-Pages */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-sky-100 mt-6">
              <h3 className="text-md font-semibold text-sky-800 mb-4">Explore Detailed Analytics</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {navItems.map((item, index) => (
                  <Link 
                    to={item.path} 
                    key={index} 
                    className="bg-sky-50 hover:bg-sky-100 p-3 rounded-lg text-center text-s font-medium text-sky-800 transition-colors"
                  >
                    <div className="mx-auto w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center mb-2 text-sky-600">
                      {item.icon}
                    </div>
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>



      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Object.entries(kpiData).map(([key, value], index) => (
          <KPICard
            key={key}
            title={key.replace(/([A-Z])/g, " $1")}
            value={value.value}
            change={value.change}
            isPositive={value.isPositive}
            icon={
              key.includes("Ratio") || key.includes("Margin") ? <FiTrendingUp size={16} /> :
              key.includes("Cycle") ? <FiClock size={16} /> :
              key.includes("Debt") ? <FiCreditCard size={16} /> :
              key.includes("Budget") ? <FiBarChart2 size={16} /> :
              <FiDollarSign size={16} />
            }
            componentPath={value.componentPath}
            forecast={value.forecast}
            description={value.description}
          />
        ))}
      </div>


        
      {/* Charts Section */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="charts" isDropDisabled={false}>
          {(provided) => (
            <div className="grid gap-6" {...provided.droppableProps} ref={provided.innerRef}>
              {/* First Row - 2 charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <EnhancedChartCard 
                  title={charts.liquidityMetrics.title} 
                  chartType={chartTypes.liquidityMetrics} 
                  chartData={charts.liquidityMetrics} 
                  widgetId="liquidityMetrics" 
                  index={0} 
                  componentPath={charts.liquidityMetrics.componentPath} 
                />
                <EnhancedChartCard 
                  title={charts.profitabilityTrend.title} 
                  chartType={chartTypes.profitabilityTrend} 
                  chartData={charts.profitabilityTrend} 
                  widgetId="profitabilityTrend" 
                  index={1} 
                  componentPath={charts.profitabilityTrend.componentPath} 
                />
              </div>

              {/* Second Row - 2 charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <EnhancedChartCard 
                  title={charts.debtCoverage.title} 
                  chartType={chartTypes.debtCoverage} 
                  chartData={charts.debtCoverage} 
                  widgetId="debtCoverage" 
                  index={2} 
                  componentPath={charts.debtCoverage.componentPath} 
                />
                <EnhancedChartCard 
                  title={charts.budgetVariance.title} 
                  chartType={chartTypes.budgetVariance} 
                  chartData={charts.budgetVariance} 
                  widgetId="budgetVariance" 
                  index={3} 
                  componentPath={charts.budgetVariance.componentPath} 
                />
              </div>

                            {/* Third Row - 2 charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <EnhancedChartCard 
                  title={charts.expenseBreakdown.title} 
                  chartType={chartTypes.expenseBreakdown} 
                  chartData={charts.expenseBreakdown} 
                  widgetId="expenseBreakdown" 
                  index={4} 
                  componentPath={charts.expenseBreakdown.componentPath} 
                />
                <EnhancedChartCard 
                  title={charts.complianceStatus.title} 
                  chartType={chartTypes.complianceStatus} 
                  chartData={charts.complianceStatus} 
                  widgetId="complianceStatus" 
                  index={5} 
                  componentPath={charts.complianceStatus.componentPath} 
                />
              </div>
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Debt Schedule Table */}
      <DebtScheduleTable />

    </div>
  );
};

export default FinanceAccountingDashboard;
 
               