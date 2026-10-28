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
import { Bar, Line, Doughnut } from "react-chartjs-2";
import { motion } from "framer-motion";
import { FiTrendingUp, FiDownload, FiDollarSign, FiPieChart, FiFilter, FiChevronDown, FiSend, FiUserCheck, FiRepeat, FiDollarSign as FiDollarSign2, FiUsers, FiAlertTriangle } from "react-icons/fi";
import { BsStars, BsThreeDotsVertical } from "react-icons/bs";
import { Tooltip as ReactTooltip } from "react-tooltip";
import { RiDragMove2Fill } from "react-icons/ri";
import { GrLinkNext } from "react-icons/gr";

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

// Executive KPI layer (PDF section 5)
const kpiData = {
  revenue: { value: 12800000, display: "$12.8M", change: "+8.4%", componentPath: "/recruitment-performance-table", forecast: "$13.6M predicted next quarter" },
  grossMargin: { value: 31.6, display: "31.6%", change: "-1.8 pts", componentPath: "/recruitment-gross-margin", forecast: "32.4% predicted next quarter" },
  activeContractors: { value: 486, display: "486", change: "+29 QTD", componentPath: "/recruitment-performance-table", forecast: "510 predicted next quarter" },
  revenuePerRecruiter: { value: 376000, display: "$376K", change: "+5.2%", componentPath: "/recruiter-analytics", forecast: "$392K predicted next quarter" },
  rehireRate: { value: 28.4, display: "28.4%", change: "+4.2 pts", componentPath: "/rehire-redeployment", forecast: "31% predicted next quarter" },
  costPerStart: { value: 4860, display: "$4,860", change: "+6.3%", componentPath: "/recruitment-cost-leverage", forecast: "$4,650 predicted next quarter" },
};

// Quick links mirroring the 6 sidebar sub-pages
const navItems = [
  { name: "Performance Dashboard", icon: <FiDollarSign />, path: "/recruitment-performance-dashboard" },
  { name: "Recruiter Analytics", icon: <FiUserCheck />, path: "/recruiter-analytics" },
  { name: "Rehire & Redeployment", icon: <FiRepeat />, path: "/rehire-redeployment" },
  { name: "Revenue Analytics", icon: <FiTrendingUp />, path: "/recruitment-revenue-analytics" },
  { name: "Gross Margin & Profitability", icon: <FiPieChart />, path: "/recruitment-gross-margin" },
  { name: "Cost & Operating Leverage", icon: <FiDollarSign2 />, path: "/recruitment-cost-leverage" },
];

const charts = {
  revenueGmTrend: {
    title: "Revenue and Gross Margin Trend",
    componentPath: "/recruitment-revenue-analytics",
    data: {
      labels: ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"],
      datasets: [
        { type: "bar", label: "Revenue ($M)", data: [0.82, 0.95, 0.88, 0.90, 1.02, 0.98, 1.10, 1.18, 1.24, 1.30, 1.36, 1.42], backgroundColor: "rgba(20, 184, 166, 0.55)", borderRadius: 6, yAxisID: "y" },
        { type: "line", label: "Gross Margin %", data: [35.1, 34.6, 34.2, 33.8, 34.0, 33.4, 32.9, 32.5, 32.1, 31.9, 31.7, 31.6], borderColor: "rgba(13, 118, 128, 1)", backgroundColor: "rgba(13, 118, 128, 0.15)", borderWidth: 2, tension: 0.35, yAxisID: "y1" },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: {
        y: { type: "linear", display: true, position: "left", title: { display: true, text: "Revenue ($M)" } },
        y1: { type: "linear", display: true, position: "right", title: { display: true, text: "Gross Margin %" }, grid: { drawOnChartArea: false } },
      },
    },
    defaultType: "bar",
  },
  recruitingFunnel: {
    title: "Recruiting Funnel",
    componentPath: "/recruitment-performance-table",
    data: {
      labels: ["Open Requisitions", "Qualified Submissions", "Interviews", "Offers", "Starts"],
      datasets: [{
        label: "Count",
        data: [214, 146, 69, 27, 20],
        backgroundColor: ["rgba(59, 130, 246, 0.7)", "rgba(20, 184, 166, 0.7)", "rgba(234, 179, 8, 0.7)", "rgba(139, 92, 246, 0.7)", "rgba(16, 185, 129, 0.7)"],
        borderColor: ["rgba(59, 130, 246, 1)", "rgba(20, 184, 166, 1)", "rgba(234, 179, 8, 1)", "rgba(139, 92, 246, 1)", "rgba(16, 185, 129, 1)"],
        borderWidth: 1,
      }],
    },
    options: { responsive: true, maintainAspectRatio: false, indexAxis: "y", plugins: { legend: { display: false } } },
    defaultType: "bar",
  },
  costLeverage: {
    title: "Cost and Operating Leverage",
    componentPath: "/recruitment-cost-leverage",
    data: {
      labels: ["Recruiter Payroll", "Bench Cost", "Contribution Margin (%)", "Rehire Savings"],
      datasets: [{
        label: "Value",
        data: [1420, 182, 18.7, 86],
        backgroundColor: ["rgba(59, 130, 246, 0.7)", "rgba(239, 68, 68, 0.7)", "rgba(16, 185, 129, 0.7)", "rgba(234, 179, 8, 0.7)"],
        borderColor: ["rgba(59, 130, 246, 1)", "rgba(239, 68, 68, 1)", "rgba(16, 185, 129, 1)", "rgba(234, 179, 8, 1)"],
        borderWidth: 1,
      }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    defaultType: "bar",
  },
  rehireMix: {
    title: "Starts by Candidate Type",
    componentPath: "/rehire-redeployment",
    data: {
      labels: ["First-time Hire", "Rehire", "Redeployed Contractor", "Referral"],
      datasets: [{
        label: "Starts",
        data: [58, 28, 10, 4],
        backgroundColor: ["rgba(59, 130, 246, 0.7)", "rgba(16, 185, 129, 0.7)", "rgba(234, 179, 8, 0.7)", "rgba(139, 92, 246, 0.7)"],
        borderColor: ["rgba(59, 130, 246, 1)", "rgba(16, 185, 129, 1)", "rgba(234, 179, 8, 1)", "rgba(139, 92, 246, 1)"],
        borderWidth: 1,
      }],
    },
    options: { maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
    defaultType: "doughnut",
  },
};

const recruiterPerformance = [
  { name: "Priya Shah", starts: 14, revenue: "$812K", gm: "35.2%", rehire: "41.7%", status: "Top" },
  { name: "Michael Lee", starts: 12, revenue: "$705K", gm: "32.8%", rehire: "28.6%", status: "On plan" },
  { name: "Anita Rao", starts: 11, revenue: "$684K", gm: "29.4%", rehire: "15.8%", status: "Margin risk" },
  { name: "David Kim", starts: 8, revenue: "$472K", gm: "31.1%", rehire: "22.0%", status: "Attention" },
];

const statusColor = {
  Top: "text-emerald-600 bg-emerald-50",
  "On plan": "text-sky-600 bg-sky-50",
  "Margin risk": "text-amber-600 bg-amber-50",
  Attention: "text-red-600 bg-red-50",
};

const RecruitmentPerformanceDashboard = () => {
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [activeWidgets, setActiveWidgets] = useState(["revenueGmTrend", "recruitingFunnel", "costLeverage", "rehireMix"]);
  const [chartTypes, setChartTypes] = useState({ revenueGmTrend: "bar", recruitingFunnel: "bar", costLeverage: "bar", rehireMix: "doughnut" });
  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const [aiInput, setAiInput] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const filtersRef = useOutsideClick(() => setShowFilters(false));

  const toggleChartType = (widgetId, type) => {
    setChartTypes((prev) => ({ ...prev, [widgetId]: type }));
    setDropdownWidget(null);
    setHoveredChartType(null);
  };

  const handleSendAIQuery = (widgetId) => {
    if (aiInput[widgetId]?.trim()) {
      console.log(`AI Query for ${widgetId}:`, aiInput[widgetId]);
      setAiInput((prev) => ({ ...prev, [widgetId]: "" }));
      setShowAIDropdown(null);
    }
  };

  const renderChart = (type, data, options = {}) => {
    switch (type) {
      case "line":
        return <Line data={data} options={options} />;
      case "bar":
        return <Bar data={data} options={options} />;
      case "doughnut":
        return <Doughnut data={data} options={options} />;
      default:
        return <Bar data={data} options={options} />;
    }
  };

  const EnhancedChartCard = ({ title, componentPath, chartType, chartData, widgetId, index, availableTypes = ["bar", "line", "doughnut"] }) => {
    const dropdownRef = useOutsideClick(() => setDropdownWidget(null));
    return (
      <Draggable draggableId={widgetId} index={index}>
        {(provided) => (
          <div className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border border-sky-100" ref={provided.innerRef} {...provided.draggableProps}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-md font-semibold text-sky-800">{title}</h3>
              <div className="flex space-x-2 relative">
                <div className="relative chart-dropdown">
                  <button onClick={(e) => { e.stopPropagation(); setDropdownWidget(dropdownWidget === widgetId ? null : widgetId); }} className="p-1 rounded hover:bg-gray-100" data-tooltip-id="chart-type-tooltip" data-tooltip-content="Options">
                    <BsThreeDotsVertical />
                  </button>
                  {dropdownWidget === widgetId && (
                    <div ref={dropdownRef} className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                      <div className="py-1 text-x text-gray-800">
                        <div className="relative" onMouseEnter={() => setHoveredChartType(widgetId)} onMouseLeave={() => setHoveredChartType(null)}>
                          <div className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center">
                            All Chart Types <FiChevronDown className="ml-1 text-x" />
                          </div>
                          {hoveredChartType === widgetId && (
                            <div className="absolute top-0 left-full w-40 bg-white rounded-md shadow-lg border border-gray-200 z-20 py-1" style={{ marginLeft: "-1px" }}>
                              {availableTypes.map((type) => (
                                <button key={type} onClick={(e) => { e.stopPropagation(); toggleChartType(widgetId, type); }} className="block w-full text-left px-4 py-2 text-x text-gray-700 hover:bg-gray-100 transition">
                                  {type.charAt(0).toUpperCase() + type.slice(1)} Chart
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="px-4 py-2 hover:bg-gray-100 cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(componentPath); setDropdownWidget(null); setHoveredChartType(null); }}>
                          Analyze
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={() => setShowAIDropdown(showAIDropdown === widgetId ? null : widgetId)} className="p-1 rounded hover:bg-gray-100" data-tooltip-id="ai-tooltip" data-tooltip-content="Ask AI">
                  <BsStars />
                </button>
                {showAIDropdown === widgetId && (
                  <div className="absolute right-0 top-5 mt-2 w-full sm:w-64 bg-white rounded-md shadow-lg z-10 border border-gray-200 py-2">
                    <div className="flex flex-col items-center space-x-2">
                      <h1 className="text-x">Ask regarding the {title}</h1>
                      <div className="flex justify-between gap-3">
                        <input type="text" value={aiInput[widgetId] || ""} onChange={(e) => setAiInput((prev) => ({ ...prev, [widgetId]: e.target.value }))} placeholder="Ask AI..." className="w-full p-1 border border-gray-300 rounded text-x" />
                        <button onClick={() => handleSendAIQuery(widgetId)} className="p-2 bg-sky-500 text-white rounded hover:bg-sky-600" disabled={!aiInput[widgetId]?.trim()}>
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
            <div className="h-56">{renderChart(chartType, chartData.data, chartData.options)}</div>
          </div>
        )}
      </Draggable>
    );
  };

  const KPICard = ({ title, display, change, isPositive, icon, componentPath, forecast }) => {
    const [showAI, setShowAI] = useState(false);
    const [localInput, setLocalInput] = useState("");
    const dropdownRef = useOutsideClick(() => setShowAI(false));

    return (
      <motion.div variants={cardVariants} initial="hidden" animate="visible" whileHover={{ y: -3 }} className="bg-white p-3 rounded-lg shadow-sm border border-sky-100 relative cursor-pointer" onClick={() => navigate(componentPath)}>
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center justify-between relative">
              <p className="text-[10px] font-semibold text-sky-600 uppercase tracking-wider truncate">{title}</p>
              <button onClick={(e) => { e.stopPropagation(); setShowAI(!showAI); }} className="p-1 rounded hover:bg-gray-100" data-tooltip-id="ai-tooltip" data-tooltip-content="Ask AI">
                <BsStars />
              </button>
              {showAI && (
                <div ref={dropdownRef} className="absolute right-0 top-5 mt-2 w-full sm:w-44 bg-white rounded-md shadow-lg z-10 border border-gray-200 p-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center space-x-2">
                    <input type="text" value={localInput} onChange={(e) => setLocalInput(e.target.value)} placeholder="Ask AI..." className="w-full p-1 border border-gray-300 rounded text-x" />
                    <button onClick={() => setLocalInput("")} className="p-1 bg-sky-500 text-white rounded hover:bg-sky-600" disabled={!localInput.trim()}>
                      <FiSend />
                    </button>
                  </div>
                </div>
              )}
            </div>
            <p className="text-s font-bold text-sky-900 mt-1">{display}</p>
            <div className={`flex items-center mt-2 ${isPositive ? "text-green-500" : "text-red-500"}`}>
              <span className="text-[10px] font-medium">{change} {isPositive ? "↑" : "↓"} vs plan</span>
            </div>
            <div className="mt-1">
              <p className="text-[10px] text-gray-500 italic">AI Forecast: {forecast}</p>
            </div>
          </div>
          <div className="p-2 rounded-full bg-sky-100 hover:bg-sky-200 transition-colors duration-200">
            <div className="text-sky-600 hover:text-sky-800 transition-colors duration-200">{icon}</div>
          </div>
        </div>
      </motion.div>
    );
  };

  const RecruiterPerformanceTable = () => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-s font-semibold text-sky-800">Recruiter Performance</h3>
        <Link to="/recruiter-analytics" className="text-x font-medium text-sky-700 hover:underline">View full scorecard</Link>
      </div>
      <table className="w-full text-x text-gray-700">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left">Recruiter</th>
            <th className="p-2 text-left">Starts</th>
            <th className="p-2 text-left">Revenue</th>
            <th className="p-2 text-left">GM %</th>
            <th className="p-2 text-left">Rehire %</th>
            <th className="p-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {recruiterPerformance.map((row) => (
            <tr key={row.name} className="border-b">
              <td className="p-2">{row.name}</td>
              <td className="p-2">{row.starts}</td>
              <td className="p-2">{row.revenue}</td>
              <td className="p-2">{row.gm}</td>
              <td className="p-2">{row.rehire}</td>
              <td className="p-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor[row.status]}`}>{row.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(activeWidgets);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    setActiveWidgets(items);
  };

  return (
    <div className="space-y-6 p-4 min-h-screen relative bg-sky-50">
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-white">Recruitment Performance Analytics</h1>
            <p className="text-sky-100 text-x">Operational and financial performance in one connected view</p>
            <p className="text-sky-100 text-x mt-1">Period: QTD • Business Unit: All • Geography: US • Client: All • Recruiter: All</p>
          </div>
          <div className="flex space-x-2">
            <button type="button" className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200" onClick={() => setShowFilters(!showFilters)}>
              <FiFilter className="mr-1" /> Filters
            </button>
            <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 hover:text-sky-50 transition-colors duration-200">
              <FiDownload className="text-sky-50" />
              <span className="text-sky-50">Export</span>
            </button>
            <Link to="/recruitment-performance-table">
              <button type="button" className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200">
                View More
                <GrLinkNext className="ml-1 w-4 h-4 hover:w-5 hover:h-5 transition-all" />
              </button>
            </Link>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white p-4 rounded-lg shadow-sm" ref={filtersRef}>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {["Period", "Business Unit", "Geography", "Client", "Recruiter"].map((filter, i) => (
              <div key={i}>
                <label className="block text-s font-medium text-gray-700 mb-1">{filter}</label>
                <select className="w-full p-2 border border-gray-300 rounded-md text-s">
                  <option>All</option>
                  {filter === "Period" && ["QTD", "MTD", "YTD", "Custom Range"].map((opt) => <option key={opt}>{opt}</option>)}
                  {filter === "Business Unit" && ["IT", "Clinical", "Finance", "Engineering", "Light Industrial"].map((opt) => <option key={opt}>{opt}</option>)}
                  {filter === "Geography" && ["US", "Canada", "Europe", "APAC"].map((opt) => <option key={opt}>{opt}</option>)}
                  {filter === "Client" && ["Acme Corporation", "Globex Inc", "Initech"].map((opt) => <option key={opt}>{opt}</option>)}
                  {filter === "Recruiter" && recruiterPerformance.map((r) => <option key={r.name}>{r.name}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white p-5 rounded-xl shadow-sm border border-sky-100">
        <h3 className="text-md font-semibold text-sky-800 mb-4">Explore Detailed Analytics</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {navItems.map((item, index) => (
            <Link to={item.path} key={index} className="bg-sky-50 hover:bg-sky-100 p-3 rounded-lg text-center text-s font-medium text-sky-800 transition-colors">
              <div className="mx-auto w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center mb-2 text-sky-600">{item.icon}</div>
              {item.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Object.entries(kpiData).map(([key, value]) => (
          <KPICard
            key={key}
            title={key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
            display={value.display}
            change={value.change}
            isPositive={value.change?.startsWith("+")}
            icon={
              key === "revenue" || key === "revenuePerRecruiter" ? <FiDollarSign size={16} /> :
              key === "grossMargin" ? <FiPieChart size={16} /> :
              key === "activeContractors" ? <FiUsers size={16} /> :
              key === "rehireRate" ? <FiRepeat size={16} /> :
              <FiAlertTriangle size={16} />
            }
            componentPath={value.componentPath}
            forecast={value.forecast}
          />
        ))}
      </div>

      <div className="bg-red-50 border border-red-100 text-red-700 text-x rounded-lg p-3">
        <span className="font-semibold">Bottleneck:</span> Interview-to-offer conversion is 8 pts below target. •{" "}
        <span className="font-semibold">AI Insight:</span> 38 rehire-ready candidates match current open requisitions.
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="recruitmentCharts" isDropDisabled={false}>
          {(provided) => (
            <div className="grid gap-6" {...provided.droppableProps} ref={provided.innerRef}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                <EnhancedChartCard title={charts.revenueGmTrend.title} chartType={chartTypes.revenueGmTrend} chartData={charts.revenueGmTrend} widgetId="revenueGmTrend" index={0} componentPath={charts.revenueGmTrend.componentPath} availableTypes={["bar", "line"]} />
                <EnhancedChartCard title={charts.recruitingFunnel.title} chartType={chartTypes.recruitingFunnel} chartData={charts.recruitingFunnel} widgetId="recruitingFunnel" index={1} componentPath={charts.recruitingFunnel.componentPath} availableTypes={["bar"]} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                <EnhancedChartCard title={charts.costLeverage.title} chartType={chartTypes.costLeverage} chartData={charts.costLeverage} widgetId="costLeverage" index={2} componentPath={charts.costLeverage.componentPath} availableTypes={["bar"]} />
                <EnhancedChartCard title={charts.rehireMix.title} chartType={chartTypes.rehireMix} chartData={charts.rehireMix} widgetId="rehireMix" index={3} componentPath={charts.rehireMix.componentPath} availableTypes={["doughnut", "bar"]} />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <RecruiterPerformanceTable />
              </div>
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <ReactTooltip id="chart-type-tooltip" place="top" effect="solid" />
      <ReactTooltip id="ai-tooltip" place="top" effect="solid" />
    </div>
  );
};

export default RecruitmentPerformanceDashboard;
