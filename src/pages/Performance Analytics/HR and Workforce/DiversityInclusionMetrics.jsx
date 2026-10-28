
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
} from "chart.js";
// REMOVED: import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar, Line, Doughnut, Pie } from "react-chartjs-2";
import { motion } from "framer-motion";
import { 
  FiUsers,
  FiFilter, 
  FiChevronDown,
  FiSend,
  FiGlobe, // For Ethnicity/Global Diversity
  FiTrendingUp, // For progress/improvement
  FiAward, // For achievements or positive scores
  FiChevronRight,
  FiBriefcase // For Seniority/Roles
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
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
  // REMOVED: ChartDataLabels
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

const DiversityInclusionMetrics = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    timePeriod: "Current Snapshot",
    department: "All Departments",
    location: "All Locations",
    employeeType: "All Types"
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedChartType, setSelectedChartType] = useState({
    genderComposition: "doughnut",
    ethnicityBreakdown: "pie",
    genderBySeniority: "bar",
    inclusionScoreTrend: "line"
  });
  const [aiInput, setAiInput] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const filtersRef = useRef(null);

  const diData = {
    genderComposition: {
      labels: ["Female", "Male", "Non-Binary", "Prefer not to say"],
      datasets: [
        {
          label: "Gender Composition",
          data: [45, 52, 1, 2], 
          backgroundColor: [
            "rgba(236, 72, 153, 0.7)", 
            "rgba(59, 130, 246, 0.7)", 
            "rgba(139, 92, 246, 0.7)", 
            "rgba(156, 163, 175, 0.7)"  
          ],
          borderColor: [
            "rgba(236, 72, 153, 1)",
            "rgba(59, 130, 246, 1)",
            "rgba(139, 92, 246, 1)",
            "rgba(156, 163, 175, 1)"
          ],
          borderWidth: 1
        }
      ]
    },
    ethnicityBreakdown: {
      labels: ["Asian", "Black/African American", "Hispanic/Latinx", "White", "Two or More Races", "Other"],
      datasets: [
        {
          label: "Ethnicity Breakdown",
          data: [30, 15, 18, 32, 3, 2], 
          backgroundColor: [
            "rgba(16, 185, 129, 0.7)", 
            "rgba(234, 179, 8, 0.7)",  
            "rgba(249, 115, 22, 0.7)", 
            "rgba(107, 114, 128, 0.7)",
            "rgba(75, 85, 99, 0.7)",   
            "rgba(209, 213, 219, 0.7)" 
          ],
          borderColor: [
            "rgba(16, 185, 129, 1)",
            "rgba(234, 179, 8, 1)",
            "rgba(249, 115, 22, 1)",
            "rgba(107, 114, 128, 1)",
            "rgba(75, 85, 99, 1)",
            "rgba(209, 213, 219, 1)"
          ],
          borderWidth: 1
        }
      ]
    },
    genderBySeniority: {
      labels: ["Junior", "Mid-Level", "Senior", "Leadership", "Executive"],
      datasets: [
        {
          label: "Female",
          data: [55, 48, 35, 25, 18], 
          backgroundColor: "rgba(236, 72, 153, 0.7)",
          borderColor: "rgba(236, 72, 153, 1)",
          borderWidth: 1
        },
        {
          label: "Male",
          data: [43, 50, 62, 70, 78], 
          backgroundColor: "rgba(59, 130, 246, 0.7)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 1
        },
        {
          label: "Other/Non-Binary",
          data: [2, 2, 3, 5, 4], 
          backgroundColor: "rgba(139, 92, 246, 0.7)",
          borderColor: "rgba(139, 92, 246, 1)",
          borderWidth: 1
        }
      ]
    },
    inclusionScoreTrend: {
        labels: ["Q1 '23", "Q2 '23", "Q3 '23", "Q4 '23", "Q1 '24", "Q2 '24"],
        datasets: [
          {
            label: "Overall Inclusion Score (out of 100)",
            data: [68, 70, 72, 71, 75, 78],
            backgroundColor: "rgba(16, 185, 129, 0.2)",
            borderColor: "rgba(16, 185, 129, 1)",
            borderWidth: 2,
            tension: 0.3,
            fill: true
          },
           {
            label: "Industry Benchmark",
            data: [65, 66, 67, 68, 69, 70],
            backgroundColor: "rgba(156, 163, 175, 0.1)",
            borderColor: "rgba(156, 163, 175, 0.5)",
            borderWidth: 2,
            borderDash: [5,5],
            tension: 0.3,
            pointRadius: 0
          }
        ]
    }
  };

  const kpiData = [
    {
      title: "Gender Ratio (F/M)",
      value: "45% / 52%",
      change: "+2% F",
      isPositive: true,
      icon: <FiUsers />,
      description: "Overall female to male representation",
      forecast: "Targeting 48% Female by EOY",
      componentPath: "/hr-workforce-table"
    },
    {
      title: "Leadership Diversity (Female)",
      value: "25%",
      change: "+3% vs LY",
      isPositive: true,
      icon: <FiBriefcase />,
      description: "Female representation in leadership roles",
      forecast: "Aiming for 30% in 2 years",
      componentPath: "/hr-workforce-table"
    },
    {
      title: "Ethnic Minority Representation",
      value: "38%",
      change: "+1.5% vs LY",
      isPositive: true,
      icon: <FiGlobe />,
      description: "Employees from underrepresented ethnic groups",
      forecast: "Focus on inclusive hiring practices",
      componentPath: "/hr-workforce-table"
    },
    // {
    //   title: "Inclusion Survey Score",
    //   value: "78/100",
    //   change: "+3 pts",
    //   isPositive: true,
    //   icon: <FiAward />,
    //   description: "Average score from D&I surveys",
    //   forecast: "Target 82+ with new initiatives",
    //   componentPath: "/hr-workforce-table"
    // },
    {
      title: "Pay Equity Status",
      value: "99.2 Cents",
      change: "↑ 0.2c",
      isPositive: true,
      icon: <FiTrendingUp />,
      description: "Female earnings per male dollar (adjusted)",
      forecast: "Continuous monitoring for 1:1 parity",
      componentPath: "/hr-workforce-table"
    }
  ];

  const diversityBreakdownTableData = [
    { department: "Technology", level: "Senior", female: "28%", male: "70%", other: "2%", ethnicityURM: "22%", aiSuggestion: "Sponsor high-potential women in tech for leadership programs." },
    { department: "Sales", level: "Mid-Level", female: "52%", male: "47%", other: "1%", ethnicityURM: "40%", aiSuggestion: "Showcase diverse sales leaders to attract varied talent." },
    { department: "Marketing", level: "Junior", female: "65%", male: "33%", other: "2%", ethnicityURM: "35%", aiSuggestion: "Ensure inclusive language in marketing job descriptions." },
    { department: "HR", level: "All Levels", female: "70%", male: "28%", other: "2%", ethnicityURM: "45%", aiSuggestion: "Leverage HR's diversity to champion D&I across company." },
    { department: "Finance", level: "Leadership", female: "30%", male: "70%", other: "0%", ethnicityURM: "18%", aiSuggestion: "Partner with finance ERGs to identify diverse talent pipelines." }
  ];

  const additionalDIIndicators = [
    { metric: "Promotion Rate (Female vs Male)", value: "0.95 : 1", trend: "Improving", benchmark: "Target: 1:1" },
    { metric: "Attrition Rate (URM vs Non-URM)", value: "1.1 : 1", trend: "Needs Focus", benchmark: "Target: <1:1" },
    { metric: "Employees with Disabilities", value: "5.2%", trend: "+0.5%", benchmark: "Nat'l Avg: 7%" },
    { metric: "LGBTQ+ Representation (Self-ID)", value: "8%", trend: "Stable", benchmark: "Industry: 7-9%" }
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
      case "pie": return <Pie data={data} options={options} />;
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
                          {["bar", "line", "doughnut", "pie"].map((type) => (
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
              <span className="text-[10px] font-medium">{change} {isPositive === null ? "" : isPositive ? "↑" : "↓"}</span>
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

  // Default chart options - these can be overridden or extended by specific chart options below
  const defaultChartOptions = {
    responsive: true, 
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' }, // Default legend position
      tooltip: {
        callbacks: { // Default tooltip, can be customized per chart
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y;
            }
            // For pie/doughnut, raw value is often more direct if data is in percentages
            if ((context.chart.config.type === 'pie' || context.chart.config.type === 'doughnut') && context.raw) {
                label = `${context.label}: ${context.raw}%`;
            }
            return label;
          }
        }
      }
      // REMOVED: datalabels plugin configuration from here
    }
  };

  const genderCompositionOptions = {
    ...defaultChartOptions, // Start with defaults
    plugins: {
      ...defaultChartOptions.plugins, // Keep existing plugins like tooltip
      legend: { position: 'right', labels: { boxWidth: 15, font: { size: 10 } } },
      // REMOVED: datalabels specific configuration
    }
  };

  const ethnicityBreakdownOptions = {
    ...defaultChartOptions,
    plugins: {
      ...defaultChartOptions.plugins,
      legend: { position: 'right', labels: { boxWidth: 15, font: { size: 10 } } },
      // REMOVED: datalabels specific configuration
    }
  };
  
  const genderBySeniorityOptions = {
    ...defaultChartOptions,
    scales: {
      x: { stacked: true, title: { display: true, text: 'Seniority Level' } },
      y: { stacked: true, title: { display: true, text: 'Percentage (%)' }, ticks: { callback: value => value + "%" } }
    },
    plugins: {
        ...defaultChartOptions.plugins, // Keep existing plugins like tooltip
        legend: { position: 'bottom' }, // Override legend position if needed
         // REMOVED: datalabels specific configuration (was already display: false)
    }
  };

  const inclusionScoreTrendOptions = {
    ...defaultChartOptions,
    scales: { 
        ...defaultChartOptions.scales, // Keep potential default scales
        y: { beginAtZero: false, title: { display: true, text: 'Score (out of 100)' } } 
    },
    plugins: { 
        ...defaultChartOptions.plugins,
        legend: { position: 'bottom' },
        // REMOVED: datalabels specific configuration (was already display: false)
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
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Diversity & Inclusion</span>
            </div>
          </li>
        </ol>
      </nav>

      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Diversity & Inclusion Metrics</h1>
            <p className="text-sky-100 text-x">Workforce Composition, Representation & Equity Analysis</p>
            <p className="text-sky-100 text-x mt-1">Data snapshot as of 08/31/24. Strong D&I correlates with improved innovation and financial performance.</p>
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
                Detailed View
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
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.timePeriod}
                onChange={(e) => setFilters({...filters, timePeriod: e.target.value})}
              >
                <option>Current Snapshot</option>
                <option>Last Quarter</option>
                <option>Year to Date</option>
                <option>Last Year</option>
              </select>
            </div>
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
                <option>Operations</option>
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
                <option>Headquarters</option>
                <option>New York Office</option>
                <option>London Office</option>
                <option>Remote</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Employee Type</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md text-s"
                value={filters.employeeType}
                onChange={(e) => setFilters({...filters, employeeType: e.target.value})}
              >
                <option>All Types</option>
                <option>Full-time</option>
                <option>Part-time</option>
                <option>Contractor</option>
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
          title="Overall Gender Composition" 
          chartType={selectedChartType.genderComposition} 
          chartData={{ data: diData.genderComposition, options: genderCompositionOptions }} 
          widgetId="genderComposition" 
          componentPath="/hr-workforce-table"
        />
        <EnhancedChartCard 
          title="Overall Ethnicity Breakdown" 
          chartType={selectedChartType.ethnicityBreakdown} 
          chartData={{ data: diData.ethnicityBreakdown, options: ethnicityBreakdownOptions }} 
          widgetId="ethnicityBreakdown" 
          componentPath="/hr-workforce-table"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EnhancedChartCard 
          title="Gender Representation by Seniority Level" 
          chartType={selectedChartType.genderBySeniority} 
          chartData={{ data: diData.genderBySeniority, options: genderBySeniorityOptions }} 
          widgetId="genderBySeniority" 
          componentPath="/hr-workforce-table"
        />
         <EnhancedChartCard 
          title="Inclusion Score Trend" 
          chartType={selectedChartType.inclusionScoreTrend} 
          chartData={{ data: diData.inclusionScoreTrend, options: inclusionScoreTrendOptions }} 
          widgetId="inclusionScoreTrend" 
          componentPath="/hr-workforce-table" 
        />
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">Diversity Snapshot by Department & Level</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-s text-left text-gray-700">
            <thead className="text-x text-sky-700 uppercase bg-sky-50">
              <tr>
                <th className="px-4 py-2">Department</th>
                <th className="px-4 py-2">Level</th>
                <th className="px-4 py-2 text-center">Female %</th>
                <th className="px-4 py-2 text-center">Male %</th>
                <th className="px-4 py-2 text-center">Other %</th>
                <th className="px-4 py-2 text-center">URM %</th>
                <th className="px-4 py-2">AI Insight & Action Area</th>
              </tr>
            </thead>
            <tbody>
              {diversityBreakdownTableData.map((row, i) => (
                <tr key={i} className="border-b hover:bg-sky-50">
                  <td className="px-4 py-2 font-medium">{row.department}</td>
                  <td className="px-4 py-2">{row.level}</td>
                  <td className="px-4 py-2 text-center">{row.female}</td>
                  <td className="px-4 py-2 text-center">{row.male}</td>
                  <td className="px-4 py-2 text-center">{row.other}</td>
                  <td className={`px-4 py-2 text-center font-semibold ${parseFloat(row.ethnicityURM) >= 30 ? "text-green-500" : parseFloat(row.ethnicityURM) >= 20 ? "text-amber-500" : "text-red-500"}`}>{row.ethnicityURM}</td>
                  <td className="px-4 py-2 text-x">{row.aiSuggestion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">Additional D&I Indicators</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {additionalDIIndicators.map((metric, i) => (
            <div key={i} className="bg-sky-50 p-3 rounded-lg">
              <p className="text-x font-semibold text-sky-700">{metric.metric}</p>
              <p className="text-lg font-bold text-sky-900 mt-1">{metric.value}</p>
              <p className={`text-x mt-1 ${metric.trend.toLowerCase().includes('improving') || metric.trend.includes('+') ? "text-green-500" : metric.trend.toLowerCase().includes('focus') || metric.trend.includes('-') ? "text-red-500" : "text-gray-500"}`}>
                  Trend: {metric.trend}
              </p>
              <p className="text-x text-gray-500 mt-1">Benchmark: {metric.benchmark}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold text-sky-800">AI-Powered D&I Strategy Recommendations</h3>
          <div className="flex items-center space-x-2">
            <BsStars className="text-sky-600" />
            <span className="text-x text-sky-600">AI Generated</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-4 rounded-lg border-l-4 border-pink-400">
            <div className="flex items-center mb-2">
              <div className="p-2 bg-pink-200 rounded-full mr-3"><FiUsers className="text-pink-600" /></div>
              <div>
                <h4 className="text-s font-semibold text-pink-800">Boost Female Leadership in Tech</h4>
                <p className="text-x text-pink-600">Current: 28% Sr. Tech Women</p>
              </div>
            </div>
            <p className="text-x text-pink-700 mb-2">
              Develop targeted mentorship and sponsorship programs for high-potential women in Technology. Set a goal of 35% female representation in senior tech roles within 2 years. Studies show gender-diverse leadership improves financial returns.
            </p>
            <span className="text-x bg-pink-200 text-pink-800 px-2 py-1 rounded-full">Priority: High</span>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border-l-4 border-purple-400">
            <div className="flex items-center mb-2">
              <div className="p-2 bg-purple-200 rounded-full mr-3"><FiGlobe className="text-purple-600" /></div>
              <div>
                <h4 className="text-s font-semibold text-purple-800">Enhance Ethnic Diversity in Finance</h4>
                <p className="text-x text-purple-600">URM in Finance Leadership: 18%</p>
              </div>
            </div>
            <p className="text-x text-purple-700 mb-2">
              Partner with diverse professional networks and universities to broaden talent pipelines for Finance roles. Implement blind resume reviews to mitigate unconscious bias in hiring. Diverse perspectives in finance can lead to more robust risk management.
            </p>
            <span className="text-x bg-purple-200 text-purple-800 px-2 py-1 rounded-full">Priority: Medium</span>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border-l-4 border-green-400">
            <div className="flex items-center mb-2">
              <div className="p-2 bg-green-200 rounded-full mr-3"><FiAward className="text-green-600" /></div>
              <div>
                <h4 className="text-s font-semibold text-green-800">Foster Inclusive Culture Company-Wide</h4>
                <p className="text-x text-green-600">Inclusion Score: 78/100</p>
              </div>
            </div>
            <p className="text-x text-green-700 mb-2">
              Expand Employee Resource Groups (ERGs) and provide them with adequate funding. Launch company-wide unconscious bias training. An inclusive culture is key to retaining diverse talent and maximizing their contribution.
            </p>
            <span className="text-x bg-green-200 text-green-800 px-2 py-1 rounded-full">Impact: High</span>
          </div>
        </div>

        <div className="mt-6 bg-sky-50 p-4 rounded-lg">
          <h4 className="text-s font-semibold text-sky-800 mb-3">Immediate Action Items</h4>
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <input type="checkbox" className="w-4 h-4 text-sky-600 bg-gray-100 border-gray-300 rounded focus:ring-sky-500" />
              <span className="text-x text-gray-700">Launch 'Women in Tech Leadership' sponsorship pilot program.</span>
              <span className="text-x bg-pink-100 text-pink-800 px-2 py-1 rounded-full ml-auto">Due: Next Quarter</span>
            </div>
            <div className="flex items-center space-x-3">
              <input type="checkbox" className="w-4 h-4 text-sky-600 bg-gray-100 border-gray-300 rounded focus:ring-sky-500" />
              <span className="text-x text-gray-700">Review Finance department hiring practices for bias; implement blind CV screening.</span>
              <span className="text-x bg-purple-100 text-purple-800 px-2 py-1 rounded-full ml-auto">Due: This Month</span>
            </div>
            <div className="flex items-center space-x-3">
              <input type="checkbox" className="w-4 h-4 text-sky-600 bg-gray-100 border-gray-300 rounded focus:ring-sky-500" />
              <span className="text-x text-gray-700">Allocate budget and resources for 2 new ERGs based on employee interest.</span>
              <span className="text-x bg-green-100 text-green-800 px-2 py-1 rounded-full ml-auto">Due: Next Month</span>
            </div>
          </div>
        </div>
      </div>
      
      <ReactTooltip id="chart-type-tooltip" place="top" effect="solid" />
      <ReactTooltip id="ai-tooltip" place="top" effect="solid" />
    </div>
  );
};

export default DiversityInclusionMetrics;
