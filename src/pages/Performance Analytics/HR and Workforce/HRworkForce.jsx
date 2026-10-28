import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from "react-router-dom";
import { 
  BsStars, 
  BsFilter, 
  BsDownload,
  BsInfoCircle,
  BsGraphUp,
  BsPeople,
  BsCashStack,
  BsClock,
  BsPieChart,
  BsBarChart,
  BsServer,
  BsShieldLock,
  BsCodeSquare,
  BsChatSquareText,
  BsThreeDotsVertical
} from 'react-icons/bs';
import { FiSend, FiChevronDown } from 'react-icons/fi';
import { RiDragMove2Fill } from 'react-icons/ri';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { GrLinkNext } from "react-icons/gr";
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
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
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';
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

export const HRworkForce = () => {
  const navigate = useNavigate();
  const [timePeriod, setTimePeriod] = useState('Last Quarter');
  const [department, setDepartment] = useState('All Departments');
  const [jobLevel, setJobLevel] = useState('All Levels');
  const [location, setLocation] = useState('All Locations');
  const [employmentType, setEmploymentType] = useState('All Types');
  const [showFilters, setShowFilters] = useState(false);
  const [activeWidgets, setActiveWidgets] = useState([
    'productivity', 
    'utilization', 
    'retention', 
    'hiringFunnel',
    'diversity',
    'compensation'
  ]);
  const [chartTypes, setChartTypes] = useState({
    productivity: 'bar',
    utilization: 'bar',
    retention: 'line',
    hiringFunnel: 'doughnut',
    diversity: 'pie',
    compensation: 'bar'
  });
  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const [aiInput, setAiInput] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const filtersRef = useRef(null);
  const aiChatbotRef = useRef(null);

  // Mock data
  const departments = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations'];
  const jobLevels = ['Entry', 'Mid', 'Senior', 'Lead', 'Executive'];
  const locations = ['North America', 'Europe', 'Asia', 'Remote'];
  const employmentTypes = ['Full-time', 'Part-time', 'Contract', 'Intern'];

  // KPI data
  const kpis = [
    {
      id: 1,
      name: 'Revenue per Employee',
      value: '$245,000',
      change: '+12%',
      trend: 'up',
      forecast: '$255,000 next quarter',
      icon: <BsCashStack size={20} />,
      color: 'text-green-600',
      componentPath: "/hr-workforce-table"
    },
    {
      id: 2,
      name: 'Utilization Rate',
      value: '78%',
      change: '-3%',
      trend: 'down',
      forecast: '75% next quarter',
      icon: <BsGraphUp size={20} />,
      color: 'text-amber-600'
    },
    {
      id: 3,
      name: 'Turnover Rate',
      value: '8.2%',
      change: '+1.5%',
      trend: 'up',
      forecast: '7.8% next quarter',
      icon: <BsPeople size={20} />,
      color: 'text-red-600'
    },
    {
      id: 4,
      name: 'Time to Hire',
      value: '32 days',
      change: '-4 days',
      trend: 'down',
      forecast: '30 days next quarter',
      icon: <BsClock size={20} />,
      color: 'text-green-600'
    }
  ];

  const navItems = [
    { name: "Employee Productivity Report", icon: <BsPieChart />, path: "/employee-productivity-report" },
    { name: "Utilization Rate Report", icon: <BsBarChart />, path: "/utilization-rate-report" },
    { name: "Retention & Attrition Rate Analysis", icon: <BsServer />, path: "/retention-attrition-rate" },
    { name: "Hiring Funnel Metrics", icon: <BsGraphUp />, path: "/hiring-funnel-metrics" },
    { name: "Diversity & Inclusion Metrics", icon: <BsShieldLock />, path: "/diversity-inclusion-metrics" },
    { name: "Compensation & Benefits Analysis", icon: <BsCodeSquare />, path: "/compensation-benefits" }
  ];

  // Chart data
  const chartData = {
    productivity: {
      title: "Revenue per Employee",
      componentPath: "/hr-workforce-table",
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
          {
            label: 'Engineering',
            data: [210, 225, 230, 240, 235, 245],
            backgroundColor: '#4BC0C0',
          },
          {
            label: 'Marketing',
            data: [180, 185, 190, 195, 200, 205],
            backgroundColor: '#FF6384',
          },
          {
            label: 'Sales',
            data: [250, 260, 270, 280, 290, 300],
            backgroundColor: '#FFCE56',
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
              label: (context) => `$${context.raw.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}K`
            }
          }
        },
        scales: {
          y: {
            ticks: {
              callback: (value) => `$${value}K`
            }
          }
        }
      },
      defaultType: 'bar'
    },
    utilization: {
      title: "Utilization Rate",
      componentPath: "/hr-workforce-table",
      data: {
        labels: departments,
        datasets: [
          {
            label: 'Billable Hours',
            data: [75, 65, 80, 70, 60, 72],
            backgroundColor: '#36A2EB',
          },
          {
            label: 'Non-Billable Hours',
            data: [25, 35, 20, 30, 40, 28],
            backgroundColor: '#FF9F40',
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
              label: (context) => `${context.raw}%`
            }
          }
        },
        scales: {
          x: { stacked: true },
          y: {
            stacked: true,
            max: 100,
            ticks: {
              callback: (value) => `${value}%`
            }
          }
        }
      },
      defaultType: 'bar'
    },
    retention: {
      title: "Retention Trends",
      componentPath: "/hr-workforce-table",
      data: {
        labels: ['Q1 2022', 'Q2 2022', 'Q3 2022', 'Q4 2022', 'Q1 2023'],
        datasets: [
          {
            label: 'Retention Rate',
            data: [92, 91, 90, 89, 88],
            borderColor: '#4BC0C0',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            fill: true,
            tension: 0.4,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `${context.raw}%`
            }
          }
        },
        scales: {
          y: {
            max: 100,
            min: 80,
            ticks: {
              callback: (value) => `${value}%`
            }
          }
        }
      },
      defaultType: 'line'
    },
    hiringFunnel: {
      title: "Hiring Funnel",
      componentPath: "/hr-workforce-table",
      data: {
        labels: ['Applicants', 'Screened', 'Interviews', 'Offers', 'Hires'],
        datasets: [
          {
            data: [1000, 400, 150, 75, 50],
            backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'],
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
              label: (context) => `${context.label}: ${context.raw}`
            }
          }
        }
      },
      defaultType: 'doughnut'
    },
    diversity: {
      title: "Diversity Metrics",
      componentPath: "/hr-workforce-table",
      data: {
        labels: ['Male', 'Female', 'Non-binary', 'Prefer not to say'],
        datasets: [
          {
            data: [62, 35, 2, 1],
            backgroundColor: ['#36A2EB', '#FF6384', '#FFCE56', '#4BC0C0'],
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
              label: (context) => `${context.label}: ${context.raw}%`
            }
          }
        }
      },
      defaultType: 'pie'
    },
    compensation: {
      title: "Compensation Analysis",
      componentPath: "/hr-workforce-table",
      data: {
        labels: jobLevels,
        datasets: [
          {
            label: 'Median Salary',
            data: [65000, 95000, 135000, 175000, 250000],
            backgroundColor: '#9966FF',
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
        }
      },
      defaultType: 'bar'
    }
  };

  // Retention table data
  const retentionTableData = departments.map(dept => ({
    department: dept,
    retentionRate: `${85 + Math.floor(Math.random() * 10)}%`,
    tenure: `${2 + Math.random() * 3 | 0}.${Math.random() * 10 | 0} yrs`,
    trend: Math.random() > 0.5 ? 'up' : 'down'
  }));

  // Compensation table data
  const compensationTableData = jobLevels.map(level => ({
    level,
    medianSalary: `$${(60000 + (Math.random() * 200000)).toLocaleString(undefined, {minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision()})}`,
    equity: `${Math.random() * 30 | 0}%`,
    bonus: `${Math.random() * 25 | 0}%`
  }));

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

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(activeWidgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setActiveWidgets(items);
  };

  const EnhancedChartCard = ({ title, componentPath, chartType, chartData, widgetId, index }) => {
    const dropdownRef = useRef(null);
    
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownWidget(null);
      }
    };

    useEffect(() => {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

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

  const KPICard = ({ title, value, change, isPositive, icon, componentPath, forecast }) => {
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
    <Link to={componentPath || "/hr-workforce-table"} className="block">
      <div className="bg-white p-4 rounded-lg border border-sky-100 shadow-sm relative hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-x font-semibold text-sky-600 uppercase tracking-wider">{title}</p>
              <button 
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowAIDropdown(!showAIDropdown); }} 
                className="p-1 rounded hover:bg-gray-100" 
                data-tooltip-id="ai-tooltip" 
                data-tooltip-content="Ask AI"
              >
                <BsStars />
              </button>
              {showAIDropdown && (
                <div ref={dropdownRef} className="absolute right-0 top-8 mt-2 w-44 bg-white rounded-md shadow-lg z-10 border border-gray-200 p-2">
                  <div className="flex items-center space-x-2">
                    <input 
                      type="text" 
                      value={localAIInput} 
                      onChange={(e) => setLocalAIInput(e.target.value)} 
                      placeholder="Ask AI..." 
                      className="w-full p-1 border border-gray-300 rounded text-x" 
                    />
                    <button 
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleSendAIQuery(); }} 
                      className="p-1 bg-sky-500 text-white rounded hover:bg-sky-600" 
                      disabled={!localAIInput.trim()}
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
            <div className="mt-1">
              <p className="text-x text-gray-500 italic">AI Forecast: {forecast}</p>
            </div>
          </div>
          <div className="p-2 rounded-full bg-sky-100 hover:bg-sky-200 transition-colors duration-200">
            <div className="text-sky-600 hover:text-sky-800 transition-colors duration-200">{icon}</div>
          </div>
        </div>
      </div>
    </Link>
  );
};

  return (
    <div className="space-y-6 p-4 min-h-screen relative bg-sky-50">
      {/* Header with filters */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">HR & Workforce Analytics</h1>
            <p className="text-sky-100 text-x">Employee Productivity & Engagement Metrics</p>
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200"
            >
              <BsFilter className="mr-1" /> Filters
            </button>
            <button 
              className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200"
            >
              <BsDownload className="mr-1" /> Export
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
              <label className="block text-s font-medium text-gray-700 mb-1">Job Level</label>
              <select 
                value={jobLevel} 
                onChange={(e) => setJobLevel(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md text-s"
              >
                <option>All Levels</option>
                {jobLevels.map(level => <option key={level}>{level}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Location</label>
              <select 
                value={location} 
                onChange={(e) => setLocation(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md text-s"
              >
                <option>All Locations</option>
                {locations.map(loc => <option key={loc}>{loc}</option>)}
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <KPICard
            key={kpi.id}
            title={kpi.name}
            value={kpi.value}
            change={kpi.change}
            isPositive={kpi.trend === 'up'}
            icon={kpi.icon}
            componentPath={kpi.componentPath}
            forecast={kpi.forecast}
          />
        ))}
      </div>


      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="charts" isDropDisabled={false}>
          {(provided) => (
            <div className="grid gap-6" {...provided.droppableProps} ref={provided.innerRef}>
              {/* First Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <EnhancedChartCard 
                  title={chartData.productivity.title} 
                  chartType={chartTypes.productivity} 
                  chartData={chartData.productivity} 
                  widgetId="productivity" 
                  index={0} 
                  componentPath={chartData.productivity.componentPath} 
                />
                <EnhancedChartCard 
                  title={chartData.utilization.title} 
                  chartType={chartTypes.utilization} 
                  chartData={chartData.utilization} 
                  widgetId="utilization" 
                  index={1} 
                  componentPath={chartData.utilization.componentPath} 
                />
              </div>

              {/* Second Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <EnhancedChartCard 
                  title={chartData.retention.title} 
                  chartType={chartTypes.retention} 
                  chartData={chartData.retention} 
                  widgetId="retention" 
                  index={2} 
                  componentPath={chartData.retention.componentPath} 
                />
                <EnhancedChartCard 
                  title={chartData.hiringFunnel.title} 
                  chartType={chartTypes.hiringFunnel} 
                  chartData={chartData.hiringFunnel} 
                  widgetId="hiringFunnel" 
                  index={3} 
                  componentPath={chartData.hiringFunnel.componentPath} 
                />
              </div>

              {/* Third Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <EnhancedChartCard 
                  title={chartData.diversity.title} 
                  chartType={chartTypes.diversity} 
                  chartData={chartData.diversity} 
                  widgetId="diversity" 
                  index={4} 
                  componentPath={chartData.diversity.componentPath} 
                />
                <EnhancedChartCard 
                  title={chartData.compensation.title} 
                  chartType={chartTypes.compensation} 
                  chartData={chartData.compensation} 
                  widgetId="compensation" 
                  index={5} 
                  componentPath={chartData.compensation.componentPath} 
                />
              </div>

              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>


      {/* Tables Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Retention Table */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-sky-100">
          <h3 className="text-lg font-semibold text-sky-800 mb-4">Retention by Department</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-sky-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-x font-medium text-sky-500 uppercase tracking-wider">Department</th>
                  <th className="px-4 py-2 text-left text-x font-medium text-sky-500 uppercase tracking-wider">Retention %</th>
                  <th className="px-4 py-2 text-left text-x font-medium text-sky-500 uppercase tracking-wider">Avg Tenure</th>
                  <th className="px-4 py-2 text-left text-x font-medium text-sky-500 uppercase tracking-wider">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-200">
                {retentionTableData.map((row, index) => (
                  <tr key={index}>
                    <td className="px-4 py-2 whitespace-nowrap text-s font-medium text-sky-900">{row.department}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-s text-sky-900">{row.retentionRate}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-s text-sky-900">{row.tenure}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-s">
                      <span className={`${row.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                        {row.trend === 'up' ? '↑ Improving' : '↓ Declining'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Compensation Table */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-sky-100">
          <h3 className="text-lg font-semibold text-sky-800 mb-4">Compensation by Level</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-sky-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-x font-medium text-sky-500 uppercase tracking-wider">Job Level</th>
                  <th className="px-4 py-2 text-left text-x font-medium text-sky-500 uppercase tracking-wider">Median Salary</th>
                  <th className="px-4 py-2 text-left text-x font-medium text-sky-500 uppercase tracking-wider">Equity %</th>
                  <th className="px-4 py-2 text-left text-x font-medium text-sky-500 uppercase tracking-wider">Bonus %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-200">
                {compensationTableData.map((row, index) => (
                  <tr key={index}>
                    <td className="px-4 py-2 whitespace-nowrap text-s font-medium text-sky-900">{row.level}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-s text-sky-900">{row.medianSalary}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-s text-sky-900">{row.equity}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-s text-sky-900">{row.bonus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* AI Insights Panel */}
      <div className="bg-gradient-to-r from-sky-100 to-blue-50 p-5 rounded-xl shadow-sm border border-sky-200 mt-6">
        <h3 className="text-lg font-semibold text-sky-800 mb-3 flex items-center">
          <BsStars className="text-blue-500 mr-2" />
          AI Workforce Insights
        </h3>
        <div className="space-y-3 text-s">
          <div className="bg-white p-3 rounded-lg shadow-sm">
            <div className="font-medium text-sky-900">Turnover Risk</div>
            <div className="text-sky-700">Engineering department shows 15% higher turnover risk than company average. Top factors: competitive market, promotion wait time.</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow-sm">
            <div className="font-medium text-sky-900">Hiring Bottleneck</div>
            <div className="text-sky-700">Time-to-hire increased by 8 days for Senior roles. Screening-to-interview conversion dropped to 28% (from 35% last quarter).</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow-sm">
            <div className="font-medium text-sky-900">Compensation Insight</div>
            <div className="text-sky-700">Mid-level salaries are 7% below market in Engineering. Equity grants are competitive but cash compensation lags peers.</div>
          </div>
        </div>
      </div>

      <ReactTooltip id="chart-type-tooltip" place="top" effect="solid" />
      <ReactTooltip id="ai-tooltip" place="top" effect="solid" />
    </div>
  );
};

export default HRworkForce;