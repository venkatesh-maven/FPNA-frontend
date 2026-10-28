

import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from "react-router-dom";
import { 
  BsStars, 
  BsFilter, 
  // BsDownload, // Already have FiDownload
  BsInfoCircle,
  BsPieChart,
  BsBarChart,
  BsGraphUp,
  BsServer,
  BsShieldLock,
  BsCodeSquare,
  BsThreeDotsVertical
} from 'react-icons/bs';
import { FiSend, FiChevronDown, FiDownload} from 'react-icons/fi'; // FiDownload is used
import { RiDragMove2Fill } from 'react-icons/ri';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { GrLinkNext } from "react-icons/gr";
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { motion } from "framer-motion"; // Added for consistent card animation
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Pie, Bar, Line, Doughnut } from 'react-chartjs-2';
import { getDecimalPrecision } from '../../../utils/formatters';

// Register Chart.js components
ChartJS.register(
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  BarElement, 
  ArcElement, 
  Title, 
  Tooltip, 
  Legend
);

// Custom hook for detecting outside clicks (if needed for other dropdowns, good to have)
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

// Animation variants for cards
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};


export const ITSpendAnalytics = () => {
  const navigate = useNavigate(); // Already available from top level
  const [timePeriod, setTimePeriod] = useState('Last Quarter');
  const [department, setDepartment] = useState('All Departments');
  const [region, setRegion] = useState('All Regions');
  const [platformType, setPlatformType] = useState('All Platforms');
  const [showFilters, setShowFilters] = useState(false);
  const [activeWidgets, setActiveWidgets] = useState([
    'spendByCategory', 
    'budgetVsActual', 
    'monthlySpendTrend',
    'cloudAdoption',
    'licenseUtilization',
    'techDebtAnalysis'
  ]);
  const [chartTypes, setChartTypes] = useState({
    spendByCategory: 'pie',
    budgetVsActual: 'bar',
    monthlySpendTrend: 'line',
    cloudAdoption: 'doughnut',
    licenseUtilization: 'bar',
    techDebtAnalysis: 'bar'
  });
  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const [aiInput, setAiInput] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const filtersRef = useOutsideClick(() => setShowFilters(false)); // Applied useOutsideClick
  const aiChatbotRef = useRef(null); // Keep for chart AI

  // Mock data
  const departments = ['Engineering', 'Finance', 'HR', 'Marketing', 'Operations'];
  const regions = ['North America', 'Europe', 'Asia', 'Global'];
  const platformTypes = ['Cloud', 'On-Prem', 'Hybrid', 'SaaS'];

  // KPI data
  const kpis = [
    {
      id: 1,
      name: 'Total IT Spend',
      value: '$2.45M',
      change: '+8%',
      isPositive: true, // Assuming higher spend might be positive if aligned with growth, or false if cost focus
      trend: 'up', // Kept for clarity, but isPositive will drive color
      forecast: '$2.6M next quarter',
      icon: <BsGraphUp size={20} />, // Changed to size 20 to match icon prop, not color class
      componentPath: "/it-spend-table", // Added for KPICard
    },
    {
      id: 2,
      name: 'Avg License Utilization',
      value: '68%',
      change: '+5%',
      isPositive: true,
      trend: 'up',
      forecast: '72% next quarter',
      icon: <BsPieChart size={20} />,
      componentPath: "/it-spend-table",
    },
    {
      id: 3,
      name: 'Cloud vs On-Prem Ratio',
      value: '65% Cloud',
      change: '+12% Cloud',
      isPositive: true, // Assuming increase in cloud is desired
      trend: 'up',
      forecast: '70% Cloud next quarter',
      icon: <BsServer size={20} />,
      componentPath: "/it-spend-table",
    },
    {
      id: 4,
      name: 'Security Incidents',
      value: '8',
      change: '-3', // Fewer incidents is positive
      isPositive: true, 
      trend: 'down',
      forecast: '6 next quarter',
      icon: <BsShieldLock size={20} />,
      componentPath: "/it-spend-table",
    },
    {
      id: 5,
      name: 'Tech Debt Score',
      value: '6.2/10',
      change: '-0.4', // Lower score is better
      isPositive: true, 
      trend: 'down',
      forecast: '5.8 next quarter',
      icon: <BsCodeSquare size={20} />,
      componentPath: "/it-spend-table",
    }
  ];

  const navItems = [
    { name: "IT Spend Breakdown", icon: <BsPieChart />, path: "/it-spend-breakdown" },
    { name: "License Utilization", icon: <BsBarChart />, path: "/software-license-utilization" },
    { name: "Infra Efficiency", icon: <BsServer />, path: "/infrastructure-cost-efficiency" },
    { name: "Budget vs Actuals", icon: <BsGraphUp />, path: "/it-budget-tracker" },
    { name: "Security Analytics", icon: <BsShieldLock />, path: "/security-compliance" },
    { name: "Tech Debt Index", icon: <BsCodeSquare />, path: "/tech-debt-modernization" }
  ];

  // Chart data remains the same
  const chartData = {
    spendByCategory: {
      title: "IT Spend by Category",
      componentPath: "/it-spend-table",
      data: {
        labels: ['Cloud Services', 'SaaS Subscriptions', 'Infrastructure', 'Security', 'Personnel', 'Other'],
        datasets: [{
          data: [850000, 650000, 420000, 280000, 200000, 50000],
          backgroundColor: ['#4BC0C0', '#FF6384', '#FFCE56', '#36A2EB', '#9966FF', '#FF9F40'],
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (context) => `$${context.raw.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} (${Math.round(context.raw/2450000*100)}%)`
            }
          }
        }
      },
      defaultType: 'pie'
    },
    budgetVsActual: {
      title: "Budget vs Actuals",
      componentPath: "/it-spend-table",
      data: {
        labels: ['ERP Upgrade', 'Cloud Migration', 'Security Suite', 'HR System', 'Marketing Platform'],
        datasets: [
          {
            label: 'Budget',
            data: [500000, 750000, 300000, 250000, 200000],
            backgroundColor: '#4BC0C0',
          },
          {
            label: 'Actual',
            data: [550000, 800000, 280000, 270000, 220000],
            backgroundColor: '#FF6384',
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (context) => `$${context.raw.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`
            }
          }
        },
        scales: {
          y: {
            ticks: {
              callback: (value) => `$${value/1000}k`
            }
          }
        }
      },
      defaultType: 'bar'
    },
    monthlySpendTrend: {
      title: "Monthly Spend Trend",
      componentPath: "/it-spend-table",
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [{
          label: 'Total IT Spend',
          data: [380000, 420000, 450000, 410000, 480000, 500000],
          borderColor: '#4BC0C0',
          backgroundColor: 'rgba(75, 192, 192, 0.1)',
          fill: true,
          tension: 0.4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `$${context.raw.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`
            }
          }
        },
        scales: {
          y: {
            ticks: {
              callback: (value) => `$${value/1000}k`
            }
          }
        }
      },
      defaultType: 'line'
    },
    cloudAdoption: {
      title: "Cloud Adoption",
      componentPath: "/it-spend-table",
      data: {
        labels: ['Production', 'Development', 'Test', 'Disaster Recovery'],
        datasets: [{
          data: [65, 20, 10, 5],
          backgroundColor: ['#36A2EB', '#4BC0C0', '#FFCE56', '#FF6384'],
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (context) => `${context.raw}% of cloud spend`
            }
          }
        }
      },
      defaultType: 'doughnut'
    },
    licenseUtilization: {
      title: "License Utilization",
      componentPath: "/it-spend-table",
      data: {
        labels: ['Microsoft 365', 'Salesforce', 'Adobe CC', 'Zoom', 'Slack'],
        datasets: [{
          label: 'Utilization Rate',
          data: [72, 65, 58, 80, 75],
          backgroundColor: '#9966FF',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `${context.raw}% utilization`
            }
          }
        },
        scales: {
          y: {
            max: 100,
            ticks: {
              callback: (value) => `${value}%`
            }
          }
        }
      },
      defaultType: 'bar'
    },
    techDebtAnalysis: {
      title: "Tech Debt Analysis",
      componentPath: "/it-spend-table",
      data: {
        labels: ['Legacy Systems', 'Custom Code', 'Security Patches', 'Documentation', 'Test Coverage'],
        datasets: [{
          label: 'Tech Debt Score (1-10)',
          data: [8.2, 6.5, 5.8, 4.2, 3.7],
          backgroundColor: '#FF9F40',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `Score: ${context.raw}/10`
            }
          }
        },
        scales: {
          y: {
            max: 10,
            min: 0,
            ticks: {
              stepSize: 1
            }
          }
        }
      },
      defaultType: 'bar'
    }
  };

  const projectsTableData = [
    { name: "ERP Upgrade", budget: "$500K", spent: "$550K", completion: "85%", status: "On Track" },
    { name: "Cloud Migration", budget: "$750K", spent: "$800K", completion: "65%", status: "Over Budget" },
    { name: "Security Suite", budget: "$300K", spent: "$280K", completion: "90%", status: "Under Budget" },
    { name: "HR System", budget: "$250K", spent: "$270K", completion: "75%", status: "On Track" },
    { name: "Marketing Platform", budget: "$200K", spent: "$220K", completion: "95%", status: "Over Budget" }
  ];

  const vendorTableData = [
    { vendor: "AWS", spend: "$420K", contractEnd: "2024-12-31", utilization: "78%", risk: "Low" },
    { vendor: "Microsoft", spend: "$380K", contractEnd: "2025-06-30", utilization: "65%", risk: "Medium" },
    { vendor: "Salesforce", spend: "$250K", contractEnd: "2024-09-15", utilization: "72%", risk: "Low" },
    { vendor: "Oracle", spend: "$180K", contractEnd: "2023-12-31", utilization: "58%", risk: "High" },
    { vendor: "Google Cloud", spend: "$150K", contractEnd: "2025-03-31", utilization: "82%", risk: "Low" }
  ];

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
    const chartOptions = { ...options, responsive: true, maintainAspectRatio: false };
    switch (type) {
      case "line": return <Line data={data} options={chartOptions} />;
      case "bar": return <Bar data={data} options={chartOptions} />;
      case "pie": return <Pie data={data} options={chartOptions} />;
      case "doughnut": return <Doughnut data={data} options={chartOptions} />;
      default: return <Bar data={data} options={chartOptions} />;
    }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(activeWidgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setActiveWidgets(items);
  };

  const EnhancedChartCard = ({ title, componentPath, chartType, chartData: currentChartData, widgetId, index }) => {
    // Renamed chartData prop to currentChartData to avoid conflict with outer scope chartData
    const chartDropdownRef = useOutsideClick(() => setDropdownWidget(null));
    // Removed useEffect for dropdownRef, relying on useOutsideClick hook for its own cleanup.
    // aiChatbotRef is already defined in the parent scope, can be used directly or passed if preferred.

    return (
      <Draggable draggableId={widgetId} index={index}>
        {(provided) => (
          <div 
            className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border border-sky-100" 
            ref={provided.innerRef} 
            {...provided.draggableProps}
          >
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
                    data-tooltip-id={`chart-options-tooltip-${widgetId}`}
                    data-tooltip-content="Options"
                  >
                    <BsThreeDotsVertical />
                  </button>
                  {dropdownWidget === widgetId && (
                    <div ref={chartDropdownRef} className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-10 border border-gray-200">
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
                            <div className="absolute top-0 left-full w-40 bg-white rounded-md shadow-lg border border-gray-200 z-20 py-1" style={{ marginLeft: "-1px" }}>
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
                  data-tooltip-id={`ai-tooltip-chart-${widgetId}`}
                  data-tooltip-content="Ask AI"
                >
                  <BsStars />
                </button>
                {showAIDropdown === widgetId && (
                  <div ref={aiChatbotRef} className="absolute right-0 top-full mt-2 w-full sm:w-64 bg-white rounded-md shadow-lg z-10 border border-gray-200 py-2">
                    <div className="flex flex-col items-center space-y-1 p-2">
                      <h1 className="text-x text-gray-700 self-start">Ask about {title}</h1>
                      <div className="flex justify-between gap-2 w-full">
                        <input 
                          type="text" 
                          value={aiInput[widgetId] || ""} 
                          onChange={(e) => setAiInput(prev => ({ ...prev, [widgetId]: e.target.value }))} 
                          placeholder="Your question..." 
                          className="w-full p-1 border border-gray-300 rounded text-x" 
                        />
                        <button 
                          onClick={() => handleSendAIQuery(widgetId)} 
                          className="p-2 bg-sky-500 text-white rounded hover:bg-sky-600 text-x" 
                          disabled={!aiInput[widgetId]?.trim()}
                        >
                          <FiSend />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <div {...provided.dragHandleProps} className="p-1 rounded hover:bg-gray-100 cursor-move" data-tooltip-id={`drag-tooltip-chart-${widgetId}`} data-tooltip-content="Rearrange">
                  <RiDragMove2Fill />
                </div>
                 <ReactTooltip id={`chart-options-tooltip-${widgetId}`} place="top" effect="solid" />
                 <ReactTooltip id={`ai-tooltip-chart-${widgetId}`} place="top" effect="solid" />
                 <ReactTooltip id={`drag-tooltip-chart-${widgetId}`} place="top" effect="solid" />
              </div>
            </div>
            <div className="h-48">
              {renderChart(chartType, currentChartData.data, currentChartData.options)}
            </div>
          </div>
        )}
      </Draggable>
    );
  };

  // --- Updated KPICard Component ---
  const KPICard = ({ id, title, value, change, isPositive, icon, componentPath, forecast }) => {
    const navigate = useNavigate(); // Use navigate hook from parent scope
    const [showKpiAIDropdown, setShowKpiAIDropdown] = useState(false);
    const [localKpiAIInput, setLocalKpiAIInput] = useState("");
    const kpiDropdownRef = useOutsideClick(() => setShowKpiAIDropdown(false));

    const handleSendKpiAIQuery = (e) => {
      e.stopPropagation(); // Prevent card navigation
      if (localKpiAIInput.trim()) {
        console.log(`AI Query for ${title}:`, localKpiAIInput);
        setLocalKpiAIInput("");
        setShowKpiAIDropdown(false);
      }
    };
    
    const kpiId = `kpi-${id}`; // Create unique ID for tooltip

    return (
      <motion.div
        key={id} // Use the passed id for the key
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        whileHover={{ y: -3 }}
        className="bg-white p-3 rounded-lg shadow-sm border border-sky-100 relative cursor-pointer"
        onClick={() => navigate(componentPath)} // Make card clickable
      >
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center justify-between relative ">
              <p className="text-[10px] font-semibold text-sky-600 uppercase tracking-wider truncate">{title}</p>
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); // Prevent card navigation
                  setShowKpiAIDropdown(!showKpiAIDropdown); 
                }} 
                className="p-1 rounded hover:bg-gray-100 z-20" 
                data-tooltip-id={`ai-tooltip-${kpiId}`}
                data-tooltip-content="Ask AI"
              >
                <BsStars />
              </button>
              {showKpiAIDropdown && (
                <div ref={kpiDropdownRef} className="absolute right-0 top-5 mt-2 w-full sm:w-44 bg-white rounded-md shadow-lg z-30 border border-gray-200 p-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="text" 
                      value={localKpiAIInput} 
                      onChange={(e) => setLocalKpiAIInput(e.target.value)} 
                      placeholder="Ask AI..." 
                      className="w-full p-1 border border-gray-300 rounded text-x" 
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button 
                      onClick={handleSendKpiAIQuery} 
                      className="p-1 bg-sky-500 text-white rounded hover:bg-sky-600" 
                      disabled={!localKpiAIInput.trim()}
                    >
                      <FiSend />
                    </button>
                  </div>
                </div>
              )}
            </div>
            <p className="text-xl font-bold text-sky-900 mt-1">{value}</p>
            <div className={`flex items-center mt-2 ${isPositive ? "text-green-500" : "text-red-500"}`}>
              <span className="text-x font-medium">{change} {isPositive ? "↑" : "↓"} vs last period</span>
            </div>
            {forecast && (
              <div className="mt-1">
                <p className="text-x text-gray-500 italic">AI Forecast: {forecast}</p>
              </div>
            )}
          </div>
          <div className="p-2 rounded-full bg-sky-100 hover:bg-sky-200 transition-colors duration-200">
            <div className="text-sky-600 hover:text-sky-800 transition-colors duration-200">{icon}</div>
          </div>
        </div>
        <ReactTooltip id={`ai-tooltip-${kpiId}`} place="top" effect="solid" />
      </motion.div>
    );
  };
  // --- End of KPICard Component ---


  const ProjectsTable = () => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-s font-semibold text-sky-800">IT Projects Overview</h3>
        <Link to="/it-spend-table" className="text-x text-sky-600 hover:text-sky-800 font-medium">
          View Details <GrLinkNext className="inline-block w-3 h-3" />
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-x text-gray-700">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left">Project</th>
              <th className="p-2 text-left">Budget</th>
              <th className="p-2 text-left">Spent</th>
              <th className="p-2 text-left">Completion</th>
              <th className="p-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {projectsTableData.map((row, i) => (
              <tr key={i} className="border-b hover:bg-sky-50 cursor-pointer" onClick={() => navigate("/it-spend-table")}>
                <td className="p-2">{row.name}</td>
                <td className="p-2">{row.budget}</td>
                <td className="p-2">{row.spent}</td>
                <td className="p-2">{row.completion}</td>
                <td className={`p-2 ${
                  row.status === "On Track" ? "text-green-500" : 
                  row.status === "Under Budget" ? "text-blue-500" : 
                  "text-red-500"
                }`}>
                  {row.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const VendorTable = () => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
       <div className="flex justify-between items-center mb-2">
        <h3 className="text-s font-semibold text-sky-800">Vendor Spend Analysis</h3>
        <Link to="/it-spend-table" className="text-x text-sky-600 hover:text-sky-800 font-medium">
          View Details <GrLinkNext className="inline-block w-3 h-3" />
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-x text-gray-700">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left">Vendor</th>
              <th className="p-2 text-left">Spend</th>
              <th className="p-2 text-left">Contract End</th>
              <th className="p-2 text-left">Utilization</th>
              <th className="p-2 text-left">Risk</th>
            </tr>
          </thead>
          <tbody>
            {vendorTableData.map((row, i) => (
              <tr key={i} className="border-b hover:bg-sky-50 cursor-pointer" onClick={() => navigate("/it-spend-table")}>
                <td className="p-2">{row.vendor}</td>
                <td className="p-2">{row.spend}</td>
                <td className="p-2">{row.contractEnd}</td>
                <td className="p-2">{row.utilization}</td>
                <td className={`p-2 ${
                  row.risk === "Low" ? "text-green-500" : 
                  row.risk === "Medium" ? "text-amber-500" : 
                  "text-red-500"
                }`}>
                  {row.risk}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 p-4 min-h-screen relative bg-sky-50">
      {/* Header with filters */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">IT & Technology Spend Overview</h1>
            <p className="text-sky-100 text-x">Budget utilization, risk, and modernization insights</p>
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200"
            >
              <BsFilter className="mr-1" /> Filters
            </button>
            <button
                onClick={() => window.print()}
                className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 hover:text-sky-50 transition-colors duration-200">
                <FiDownload className="text-sky-50" />
                <span className="text-sky-50">Export</span>
            </button>
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

      {showFilters && (
        <div className="bg-white p-4 rounded-lg shadow-sm" ref={filtersRef}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Time Period</label>
              <select 
                value={timePeriod} 
                onChange={(e) => setTimePeriod(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md text-s"
              >
                <option>Last Quarter</option>
                <option>Last Month</option>
                <option>Last Week</option>
                <option>Year to Date</option>
                <option>Custom Range</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Department</label>
              <select 
                value={department} 
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md text-s"
              >
                <option>All Departments</option>
                {departments.map(dept => <option key={dept}>{dept}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Region</label>
              <select 
                value={region} 
                onChange={(e) => setRegion(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md text-s"
              >
                <option>All Regions</option>
                {regions.map(reg => <option key={reg}>{reg}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Platform Type</label>
              <select 
                value={platformType} 
                onChange={(e) => setPlatformType(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md text-s"
              >
                <option>All Platforms</option>
                {platformTypes.map(type => <option key={type}>{type}</option>)}
              </select>
            </div>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map(kpi => (
          <KPICard
            key={kpi.id}
            id={kpi.id} // Pass id for unique tooltip ids
            title={kpi.name}
            value={kpi.value}
            change={kpi.change}
            isPositive={kpi.isPositive}
            icon={kpi.icon}
            componentPath={kpi.componentPath} // ensure this is passed
            forecast={kpi.forecast}
          />
        ))}
      </div>


      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="itCharts" isDropDisabled={false}> 
        {/* Changed droppableId to be unique */}
          {(provided) => (
            <div className="grid gap-6" {...provided.droppableProps} ref={provided.innerRef}>
              {/* First Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {activeWidgets.slice(0, 3).map((widgetId, index) => (
                  <EnhancedChartCard 
                    key={widgetId}
                    title={chartData[widgetId].title} 
                    chartType={chartTypes[widgetId]} 
                    chartData={chartData[widgetId]} 
                    widgetId={widgetId} 
                    index={index} 
                    componentPath={chartData[widgetId].componentPath} 
                  />
                ))}
              </div>

              {/* Second Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {activeWidgets.slice(3, 6).map((widgetId, index) => (
                   <EnhancedChartCard 
                    key={widgetId}
                    title={chartData[widgetId].title} 
                    chartType={chartTypes[widgetId]} 
                    chartData={chartData[widgetId]} 
                    widgetId={widgetId} 
                    index={index + 3} // Adjust index for dnd
                    componentPath={chartData[widgetId].componentPath} 
                  />
                ))}
              </div>
              
              {/* Render remaining widgets if any (for future flexibility) */}
              {activeWidgets.length > 6 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {activeWidgets.slice(6).map((widgetId, index) => (
                    <EnhancedChartCard 
                      key={widgetId}
                      title={chartData[widgetId].title} 
                      chartType={chartTypes[widgetId]} 
                      chartData={chartData[widgetId]} 
                      widgetId={widgetId} 
                      index={index + 6} // Adjust index for dnd
                      componentPath={chartData[widgetId].componentPath} 
                    />
                  ))}
                </div>
              )}


              {/* Third Row for Tables */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ProjectsTable />
                <VendorTable />
              </div>

              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* AI Insights Panel */}
      <div className="bg-gradient-to-r from-sky-100 to-blue-50 p-5 rounded-xl shadow-sm border border-sky-200 mt-6">
        <h3 className="text-lg font-semibold text-sky-800 mb-3 flex items-center">
          <BsStars className="text-blue-500 mr-2" />
          AI IT Spend Insights
        </h3>
        <div className="space-y-3 text-s">
          <div className="bg-white p-3 rounded-lg shadow-sm">
            <div className="font-medium text-sky-900">Cloud Optimization Opportunity</div>
            <div className="text-sky-700">Right-sizing underutilized cloud resources could save ~$85,000 annually (17% of current cloud spend).</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow-sm">
            <div className="font-medium text-sky-900">License Waste Alert</div>
            <div className="text-sky-700">32% of SaaS licenses are underutilized. Consolidating overlapping tools could save $120,000/year.</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow-sm">
            <div className="font-medium text-sky-900">Tech Debt Impact</div>
            <div className="text-sky-700">Legacy systems account for 28% of IT spend but only 15% of business value. Modernization could yield 23% ROI.</div>
          </div>
        </div>
      </div>
      {/* Global Tooltip for items not covered by specific tooltips in components */}
      <ReactTooltip id="global-tooltip" place="top" effect="solid" /> 
    </div>
  );
};

export default ITSpendAnalytics;
