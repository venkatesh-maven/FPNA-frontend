
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
  ScatterController, // For scatter plots
  BubbleController,  // For bubble charts
} from "chart.js";
import { Bar, Line, Doughnut, Scatter , Pie} from "react-chartjs-2"; // Added Scatter
import { motion } from "framer-motion";
import { 
  FiDollarSign, // Core for compensation
  FiTrendingUp, // For trends, growth
  FiUsers,      // For employee groups
  FiPieChart,   // For distribution
  FiFilter, 
  FiChevronDown,
  FiSend,
  FiGift,       // For benefits
  FiShield,     // For equity/security
  FiBarChart2,  // For comparisons
  FiChevronRight,
  FiAward       // For total rewards
} from "react-icons/fi";
import { BsStars, BsThreeDotsVertical } from "react-icons/bs";
import { Tooltip as ReactTooltip } from "react-tooltip";
import { RiDragMove2Fill } from "react-icons/ri";
import { GrLinkNext } from "react-icons/gr";
import { getDecimalPrecision } from '../../../utils/formatters';

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
  Filler,
  ScatterController,
  BubbleController
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

const CompensationBenefits = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    department: "All Departments",
    roleLevel: "All Levels",
    location: "All Locations",
    year: "Current Year"
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedChartType, setSelectedChartType] = useState({
    salaryBenchmark: "bar",
    equityDistribution: "doughnut",
    totalRewardsMix: "bar", // Could be a stacked bar
    benefitsUptake: "pie"
  });
  const [aiInput, setAiInput] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const filtersRef = useRef(null);

  // Sample data for Compensation & Benefits
  const compBenData = {
    salaryBenchmark: { // Comparatio by department
      labels: ["Tech", "Sales", "Marketing", "HR", "Finance", "Product"],
      datasets: [
        {
          label: "Average Comparatio (vs Market)",
          data: [0.98, 1.02, 0.95, 0.99, 1.00, 1.05], // 1.00 = at market
          backgroundColor: (context) => {
            const value = context.dataset.data[context.dataIndex];
            if (value < 0.97) return "rgba(239, 68, 68, 0.7)"; // Red - below market
            if (value > 1.03) return "rgba(16, 185, 129, 0.7)"; // Green - above market
            return "rgba(234, 179, 8, 0.7)"; // Yellow - at market
          },
          borderColor: (context) => {
            const value = context.dataset.data[context.dataIndex];
            if (value < 0.97) return "rgba(239, 68, 68, 1)";
            if (value > 1.03) return "rgba(16, 185, 129, 1)";
            return "rgba(234, 179, 8, 1)";
          },
          borderWidth: 1
        }
      ]
    },
    equityDistribution: { // By role level
      labels: ["Junior", "Mid-Level", "Senior", "Leadership", "Executive"],
      datasets: [
        {
          label: "Equity Value Distribution (%)",
          data: [5, 15, 25, 30, 25],
          backgroundColor: [
            "rgba(59, 130, 246, 0.7)",
            "rgba(16, 185, 129, 0.7)",
            "rgba(234, 179, 8, 0.7)",
            "rgba(139, 92, 246, 0.7)",
            "rgba(236, 72, 153, 0.7)"
          ],
          borderColor: [
            "rgba(59, 130, 246, 1)",
            "rgba(16, 185, 129, 1)",
            "rgba(234, 179, 8, 1)",
            "rgba(139, 92, 246, 1)",
            "rgba(236, 72, 153, 1)"
          ],
          borderWidth: 1
        }
      ]
    },
    totalRewardsMix: { // Average mix for an employee
      labels: ["Base Salary", "Bonus/Incentive", "Equity (Annualized)", "Benefits Value"],
      datasets: [
        {
          label: "Tech Department",
          data: [65, 15, 10, 10], // Percentages
          backgroundColor: "rgba(59, 130, 246, 0.7)",
        },
        {
          label: "Sales Department",
          data: [50, 30, 5, 15], // Percentages
          backgroundColor: "rgba(16, 185, 129, 0.7)",
        }
      ]
    },
    benefitsUptake: {
      labels: ["Health Insurance", "Retirement Plan", "Wellness Program", "Childcare Support", "Tuition Reimbursement"],
      datasets: [
        {
          label: "Benefit Uptake Rate (%)",
          data: [92, 78, 45, 22, 30],
          backgroundColor: [
            "rgba(34, 197, 94, 0.7)",  // Green
            "rgba(245, 158, 11, 0.7)", // Amber
            "rgba(99, 102, 241, 0.7)", // Indigo
            "rgba(217, 70, 239, 0.7)", // Fuchsia
            "rgba(20, 184, 166, 0.7)"  // Teal
          ],
          borderWidth: 1
        }
      ]
    }
  };

  const kpiData = [
    {
      title: "Avg. Salary Comparatio",
      value: "0.99",
      change: "+0.01 vs LY",
      isPositive: true, // Closer to 1.00 is good
      icon: <FiDollarSign />,
      description: "Average salary vs. market median",
      forecast: "Targeting 1.00-1.02 range",
      componentPath: "/hr-workforce-table"
    },
    {
      title: "Total Rewards Investment",
      value: "₹45 Cr",
      change: "+₹3 Cr",
      isPositive: null, // Depends on strategy
      icon: <FiAward />,
      description: "Total annual spend on compensation & benefits",
      forecast: "Budgeted ₹48 Cr for next year",
      componentPath: "/hr-workforce-table"
    },
    {
      title: "Equity Burn Rate",
      value: "1.8% p.a.",
      change: "-0.2%",
      isPositive: true, // Lower burn can be good
      icon: <FiShield />,
      description: "Annual equity pool utilization",
      forecast: "Maintain < 2% to conserve pool",
      componentPath: "/hr-workforce-table"
    },
    {
      title: "Benefits Cost per Employee",
      value: "₹1.2 Lakhs",
      change: "+₹5k",
      isPositive: false, // Higher cost needs justification
      icon: <FiGift />,
      description: "Average annual cost of benefits package",
      forecast: "Analyze ROI on high-cost benefits",
      componentPath: "/hr-workforce-table"
    },
    // {
    //   title: "Salary Range Penetration (Avg)",
    //   value: "65%",
    //   change: "+2%",
    //   isPositive: true, // Shows progression within bands
    //   icon: <FiTrendingUp />,
    //   description: "Avg. position of salaries within their ranges",
    //   forecast: "Monitor for compression at top of bands",
    //   componentPath: "/hr-workforce-table"
    // }
  ];

  const compensationDetailTable = [
    { role: "Software Engineer II", department: "Tech", location: "Bangalore", currentSalary: "₹18L", marketMedian: "₹17.5L", comparatio: 1.03, equityGrant: "500 RSUs", aiSuggestion: "Slightly above market. Monitor performance for justification." },
    { role: "Sales Manager", department: "Sales", location: "Mumbai", currentSalary: "₹25L + 10L Var", marketMedian: "₹26L Fixed", comparatio: 0.96, equityGrant: "800 RSUs", aiSuggestion: "Base below market. High variable potential. Review base at next cycle." },
    { role: "Marketing Specialist", department: "Marketing", location: "Remote", currentSalary: "₹12L", marketMedian: "₹13L", comparatio: 0.92, equityGrant: "200 RSUs", aiSuggestion: "Below market. Prioritize for salary review to improve retention." },
    { role: "HR Business Partner", department: "HR", location: "Delhi", currentSalary: "₹20L", marketMedian: "₹20L", comparatio: 1.00, equityGrant: "400 RSUs", aiSuggestion: "At market. Focus on non-monetary rewards & career pathing." },
  ];

  const rewardBreakdownMetrics = [
    { metric: "Avg. Bonus Payout %", value: "115% of Target", trend: "+5%", benchmark: "Target: 100-120%" },
    { metric: "High-Performer Equity Allocation", value: "60% of Pool", trend: "Stable", benchmark: "Target: >55%" },
    { metric: "Gender Pay Gap (Unadjusted)", value: "12%", trend: "-1.5%", benchmark: "Target: <5% (Adjusted <1%)" },
    { metric: "Benefits Satisfaction Score", value: "4.1/5", trend: "+0.2", benchmark: "Industry: 3.9/5" }
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
      case "pie": return <Pie data={data} options={options} />; // Pie was in D&I, keep for consistency if needed
      case "scatter": return <Scatter data={data} options={options} />;
      default: return <Bar data={data} options={options} />;
    }
  };

  const EnhancedChartCard = ({ title, componentPath, chartType, chartData, widgetId }) => {
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
                        Chart Types <FiChevronDown className="ml-1 text-x" />
                      </div>
                      {hoveredChartType === widgetId && (
                        <div className="absolute top-0 left-full w-40 bg-white rounded-md shadow-lg border border-gray-200 z-20 py-1" style={{ marginLeft: "-1px" }}>
                          {["bar", "line", "doughnut", "pie",].map((type) => (
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
                  <h1 className="text-x">Ask regarding {title}</h1>
                  <div className="flex justify-between gap-3 p-2">
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
        <div className="h-56">
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

    const handleSendAIQueryLocal = () => {
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
                      onClick={handleSendAIQueryLocal} 
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
            <div className={`flex items-center mt-2 ${isPositive === null ? "text-gray-500" : isPositive ? "text-green-500" : "text-red-500"}`}>
              <span className="text-[10px] font-medium">{change} {isPositive === null ? "" : (isPositive ? "↑" : "↓")}</span>
            </div>
            <div className="mt-1">
              <p className="text-[10px] text-gray-500">{description}</p>
              <p className="text-[10px] text-gray-500 italic">AI Insight: {forecast}</p>
            </div>
          </div>
          <div className="p-2 rounded-full bg-sky-100 hover:bg-sky-200 transition-colors duration-200">
            <div className="text-sky-600 hover:text-sky-800 transition-colors duration-200">{icon}</div>
          </div>
        </div>
      </motion.div>
    );
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filtersRef.current && !filtersRef.current.contains(event.target)) {
        setShowFilters(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const defaultChartOptions = {
    responsive: true, 
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || context.label || '';
            if (label) { label += ': '; }
            if (context.parsed?.y !== null && context.parsed?.y !== undefined) {
              label += context.parsed.y.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }); // For bar/line/scatter Y values
            } else if (context.raw !== null && context.raw !== undefined) {
               // For pie/doughnut, raw value is often direct (e.g. percentage)
               if (context.chart.config.type === 'pie' || context.chart.config.type === 'doughnut'){
                   label = `${context.label}: ${context.raw}%`;
               } else {
                   label += context.raw.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() });
               }
            }
            return label;
          }
        }
      }
    }
  };

  const salaryBenchmarkOptions = {
    ...defaultChartOptions,
    scales: {
      y: { 
        beginAtZero: false, // Comparatios can be around 1.0
        title: { display: true, text: 'Comparatio (Market Median = 1.0)' },
        ticks: { stepSize: 0.05 } 
      },
      x: { title: { display: true, text: 'Department' } }
    },
    plugins: {
        ...defaultChartOptions.plugins,
        tooltip: {
            callbacks: {
                label: function(context) {
                    return `${context.dataset.label}: ${context.raw.toFixed(getDecimalPrecision())}`;
                }
            }
        }
    }
  };

  const equityDistributionOptions = {
    ...defaultChartOptions,
    plugins: {
      ...defaultChartOptions.plugins,
      legend: { position: 'right', labels: { boxWidth: 15, font: { size: 10 } } },
    }
  };
  
  const totalRewardsMixOptions = {
    ...defaultChartOptions,
    scales: {
      x: { stacked: true, title: { display: true, text: 'Reward Component' } },
      y: { stacked: true, title: { display: true, text: 'Percentage of Total Reward (%)' }, ticks: { callback: value => value + "%"} }
    },
     plugins: {
      ...defaultChartOptions.plugins,
      legend: { position: 'top' },
    }
  };

  const benefitsUptakeOptions = {
    ...defaultChartOptions,
    plugins: {
      ...defaultChartOptions.plugins,
      legend: { position: 'right', labels: { boxWidth: 15, font: { size: 10 } } },
    }
  };

  return (
    <div className="space-y-6 p-4 min-h-screen relative bg-sky-50">
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
              <Link to="/hr-workforce" className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                HR Analytics
              </Link>
            </div>
          </li>
          <li aria-current="page">
            <div className="flex items-center">
              <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Compensation & Benefits</span>
            </div>
          </li>
        </ol>
      </nav>

      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Compensation & Benefits Analysis</h1>
            <p className="text-sky-100 text-x">Salary Benchmarking, Equity, and Total Rewards Insights</p>
            <p className="text-sky-100 text-x mt-1">Data for FY2024. Effective C&B strategy is crucial for talent attraction, motivation, and retention, impacting overall financial health.</p>
          </div>
          <div className="flex space-x-2">
            <button 
              type="button" 
              className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200" 
              onClick={() => setShowFilters(!showFilters)}
            >
              <FiFilter className="mr-1" /> Filters
            </button>
            <Link to="/hr-workforce-table">
              <button
                type="button"
                className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200">
                Detailed Data
                <GrLinkNext className="ml-1 w-4 h-4 hover:w-5 hover:h-5 transition-all" />
              </button>
            </Link>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white p-4 rounded-lg shadow-sm" ref={filtersRef}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Department</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.department}
                onChange={(e) => setFilters({...filters, department: e.target.value})}
              >
                <option>All Departments</option>
                <option>Technology</option>
                <option>Sales</option>
                <option>Marketing</option>
                <option>HR</option>
                <option>Finance</option>
                <option>Product</option>
                <option>Operations</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Role Level</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.roleLevel}
                onChange={(e) => setFilters({...filters, roleLevel: e.target.value})}
              >
                <option>All Levels</option>
                <option>Junior</option>
                <option>Mid-Level</option>
                <option>Senior</option>
                <option>Manager</option>
                <option>Leadership</option>
                <option>Executive</option>
              </select>
            </div>
             <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Location</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.location}
                onChange={(e) => setFilters({...filters, location: e.target.value})}
              >
                <option>All Locations</option>
                <option>Bangalore</option>
                <option>Mumbai</option>
                <option>Delhi</option>
                <option>Remote</option>
                <option>USA</option>
                <option>UK</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Year</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.year}
                onChange={(e) => setFilters({...filters, year: e.target.value})}
              >
                <option>Current Year</option>
                <option>Last Year</option>
                <option>Two Years Ago</option>
              </select>
            </div>
          </div>
        </div>
      )}

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EnhancedChartCard 
          title="Salary Benchmarking (Comparatio by Dept)" 
          chartType={selectedChartType.salaryBenchmark} 
          chartData={{ data: compBenData.salaryBenchmark, options: salaryBenchmarkOptions }} 
          widgetId="salaryBenchmark" 
          componentPath="/hr-workforce-table"
        />
        <EnhancedChartCard 
          title="Equity Value Distribution by Role Level" 
          chartType={selectedChartType.equityDistribution} 
          chartData={{ data: compBenData.equityDistribution, options: equityDistributionOptions }} 
          widgetId="equityDistribution" 
          componentPath="/hr-workforce-table"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EnhancedChartCard 
          title="Total Rewards Mix by Department" 
          chartType={selectedChartType.totalRewardsMix} 
          chartData={{ data: compBenData.totalRewardsMix, options: totalRewardsMixOptions }} 
          widgetId="totalRewardsMix" 
          componentPath="/hr-workforce-table"
        />
         <EnhancedChartCard 
          title="Benefits Uptake Rate" 
          chartType={selectedChartType.benefitsUptake} 
          chartData={{ data: compBenData.benefitsUptake, options: benefitsUptakeOptions }} 
          widgetId="benefitsUptake" 
          componentPath="/hr-workforce-table" 
        />
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">Compensation Detail & Market Comparison</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-s text-left text-gray-700">
            <thead className="text-x text-sky-700 uppercase bg-sky-50">
              <tr>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Department</th>
                <th className="px-4 py-2">Location</th>
                <th className="px-4 py-2">Current Salary</th>
                <th className="px-4 py-2">Market Median</th>
                <th className="px-4 py-2 text-center">Comparatio</th>
                <th className="px-4 py-2">Equity Grant</th>
                <th className="px-4 py-2">AI Suggestion</th>
              </tr>
            </thead>
            <tbody>
              {compensationDetailTable.map((row, i) => (
                <tr key={i} className="border-b hover:bg-sky-50">
                  <td className="px-4 py-2 font-medium">{row.role}</td>
                  <td className="px-4 py-2">{row.department}</td>
                  <td className="px-4 py-2">{row.location}</td>
                  <td className="px-4 py-2">{row.currentSalary}</td>
                  <td className="px-4 py-2">{row.marketMedian}</td>
                  <td className={`px-4 py-2 text-center font-semibold ${row.comparatio < 0.95 ? "text-red-500" : row.comparatio > 1.05 ? "text-green-500" : "text-amber-500"}`}>{row.comparatio.toFixed(getDecimalPrecision())}</td>
                  <td className="px-4 py-2">{row.equityGrant}</td>
                  <td className="px-4 py-2 text-x">{row.aiSuggestion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">Key Reward Program Indicators</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {rewardBreakdownMetrics.map((metric, i) => (
            <div key={i} className="bg-sky-50 p-3 rounded-lg">
              <p className="text-x font-semibold text-sky-700">{metric.metric}</p>
              <p className="text-lg font-bold text-sky-900 mt-1">{metric.value}</p>
              <p className={`text-x mt-1 ${metric.trend.toLowerCase().includes('improving') || metric.trend.includes('+') ? "text-green-500" : metric.trend.toLowerCase().includes('focus') || metric.trend.includes('-') || metric.trend.toLowerCase().includes('target:') ? "text-amber-500" : "text-gray-500"}`}>
                  {metric.trend.includes("Target") ? "" : "Trend: "}{metric.trend}
              </p>
              <p className="text-x text-gray-500 mt-1">Benchmark: {metric.benchmark}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">AI-Powered Compensation Strategy Insights</h3>
          <div className="flex items-center space-x-2">
            <BsStars className="text-sky-600" />
            <span className="text-x text-sky-600">AI Generated</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg border-l-4 border-red-400">
            <div className="flex items-center mb-2">
              <div className="p-2 bg-red-200 rounded-full mr-3"><FiDollarSign className="text-red-600" /></div>
              <div>
                <h4 className="text-s font-semibold text-red-800">Marketing Salaries Below Market</h4>
                <p className="text-x text-red-600">Avg. Comparatio: 0.95</p>
              </div>
            </div>
            <p className="text-x text-red-700 mb-2">
              Marketing roles are trending below market median. This poses a retention risk. Recommend targeted salary adjustments for key marketing talent and review overall Marketing pay bands.
            </p>
            <span className="text-x bg-red-200 text-red-800 px-2 py-1 rounded-full">Priority: High</span>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-lg border-l-4 border-amber-400">
            <div className="flex items-center mb-2">
              <div className="p-2 bg-amber-200 rounded-full mr-3"><FiShield className="text-amber-600" /></div>
              <div>
                <h4 className="text-s font-semibold text-amber-800">Optimize Equity Allocation</h4>
                <p className="text-x text-amber-600">Junior Level Equity: 5% of Pool</p>
              </div>
            </div>
            <p className="text-x text-amber-700 mb-2">
              While executive equity is substantial, consider slightly increasing equity grants for high-potential junior to mid-level talent to improve long-term retention and incentivize growth. Model impact on burn rate.
            </p>
            <span className="text-x bg-amber-200 text-amber-800 px-2 py-1 rounded-full">Priority: Medium</span>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border-l-4 border-green-400">
            <div className="flex items-center mb-2">
              <div className="p-2 bg-green-200 rounded-full mr-3"><FiGift className="text-green-600" /></div>
              <div>
                <h4 className="text-s font-semibold text-green-800">Enhance Benefits Communication</h4>
                <p className="text-x text-green-600">Wellness Program Uptake: 45%</p>
              </div>
            </div>
            <p className="text-x text-green-700 mb-2">
              Significant investment in wellness programs but uptake is moderate. Launch a communication campaign highlighting benefits and ease of access. Gather feedback to tailor offerings, maximizing ROI on benefits spend.
            </p>
            <span className="text-x bg-green-200 text-green-800 px-2 py-1 rounded-full">Impact: High Potential</span>
          </div>
        </div>

        <div className="mt-6 bg-sky-50 p-4 rounded-lg">
          <h4 className="text-s font-semibold text-sky-800 mb-3">Immediate Action Items</h4>
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <input type="checkbox" className="w-4 h-4 text-sky-600 bg-gray-100 border-gray-300 rounded focus:ring-sky-500" />
              <span className="text-x text-gray-700">Conduct a deep-dive salary review for all Marketing department roles.</span>
              <span className="text-x bg-red-100 text-red-800 px-2 py-1 rounded-full ml-auto">Due: Next Month</span>
            </div>
            <div className="flex items-center space-x-3">
              <input type="checkbox" className="w-4 h-4 text-sky-600 bg-gray-100 border-gray-300 rounded focus:ring-sky-500" />
              <span className="text-x text-gray-700">Model scenarios for adjusting equity grants for Junior/Mid-level high performers.</span>
              <span className="text-x bg-amber-100 text-amber-800 px-2 py-1 rounded-full ml-auto">Due: This Quarter</span>
            </div>
            <div className="flex items-center space-x-3">
              <input type="checkbox" className="w-4 h-4 text-sky-600 bg-gray-100 border-gray-300 rounded focus:ring-sky-500" />
              <span className="text-x text-gray-700">Develop and launch a communication plan for underutilized employee benefits.</span>
              <span className="text-x bg-green-100 text-green-800 px-2 py-1 rounded-full ml-auto">Due: Next 2 Weeks</span>
            </div>
          </div>
        </div>
      </div>
      
      <ReactTooltip id="chart-type-tooltip" place="top" effect="solid" />
      <ReactTooltip id="ai-tooltip" place="top" effect="solid" />
    </div>
  );
};

export default CompensationBenefits;
