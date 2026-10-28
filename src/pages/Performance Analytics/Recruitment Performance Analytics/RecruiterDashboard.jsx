import React, { useState, useRef, useEffect, useMemo } from "react";
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
import { FiChevronRight, FiDownload, FiFilter, FiChevronDown, FiSend, FiDollarSign, FiPercent, FiClock, FiUserCheck } from "react-icons/fi";
import { BsStars, BsThreeDotsVertical } from "react-icons/bs";
import { Tooltip as ReactTooltip } from "react-tooltip";
import { RiDragMove2Fill } from "react-icons/ri";
import { GrLinkNext } from "react-icons/gr";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

const useOutsideClick = (callback) => {
  const ref = useRef();
  useEffect(() => {
    const handleClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) callback();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [callback]);
  return ref;
};

const cardVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

// Recruiter role (PDF §2 + §17): personal performance, assigned requisitions, candidates, rehire pool
const recruiterProfiles = {
  "Priya Shah": {
    kpis: { starts: "14", revenue: "$812K", gm: "35.2%", rehireRate: "41.7%" },
    funnel: [42, 26, 18, 16, 14],
    workload: { open: 18, aging: 2 },
    score: [92, 88, 90, 85, 96],
    ttf: [22, 21, 23, 24, 22, 21, 20, 21, 22, 21, 20, 22],
  },
  "Michael Lee": {
    kpis: { starts: "12", revenue: "$705K", gm: "32.8%", rehireRate: "28.6%" },
    funnel: [38, 22, 15, 13, 12],
    workload: { open: 15, aging: 4 },
    score: [80, 78, 76, 70, 88],
    ttf: [30, 29, 28, 30, 29, 28, 27, 28, 29, 28, 27, 29],
  },
  "Anita Rao": {
    kpis: { starts: "11", revenue: "$684K", gm: "29.4%", rehireRate: "15.8%" },
    funnel: [35, 18, 12, 12, 11],
    workload: { open: 22, aging: 9 },
    score: [65, 60, 58, 45, 78],
    ttf: [37, 36, 38, 35, 36, 37, 35, 34, 36, 35, 36, 36],
  },
  "David Kim": {
    kpis: { starts: "8", revenue: "$472K", gm: "31.1%", rehireRate: "22.0%" },
    funnel: [28, 14, 9, 8, 8],
    workload: { open: 14, aging: 3 },
    score: [58, 52, 50, 55, 62],
    ttf: [41, 40, 42, 40, 41, 42, 40, 39, 41, 40, 39, 41],
  },
};

const myOpenRequisitions = {
  "Priya Shah": [
    { id: "R-4442", client: "Umbrella Corp", role: "Frontend Engineer", stage: "Offer Extended", daysOpen: 19 },
    { id: "R-4451", client: "Globex Inc", role: "UX Designer", stage: "Interviewing", daysOpen: 8 },
  ],
  "Michael Lee": [
    { id: "R-4431", client: "Initech", role: "Platform Engineer", stage: "Interviewing", daysOpen: 31 },
    { id: "R-4460", client: "Acme Corporation", role: "SRE", stage: "Sourcing", daysOpen: 12 },
  ],
  "Anita Rao": [
    { id: "R-4410", client: "Acme Corporation", role: "Sr. Data Engineer", stage: "Sourcing", daysOpen: 48 },
    { id: "R-4438", client: "Acme Corporation", role: "Business Analyst", stage: "Sourcing", daysOpen: 26 },
  ],
  "David Kim": [
    { id: "R-4423", client: "Globex Inc", role: "QA Manager", stage: "Sourcing", daysOpen: 37 },
    { id: "R-4318", client: "Initech", role: "DevOps Engineer", stage: "Interviewing", daysOpen: 22 },
  ],
};

const myRehireMatches = {
  "Priya Shah": [{ candidate: "J. Alvarez", matchScore: "94%", openReq: "Umbrella Corp — Frontend Engineer" }],
  "Michael Lee": [{ candidate: "R. Chen", matchScore: "91%", openReq: "Initech — Platform Engineer" }],
  "Anita Rao": [{ candidate: "M. Patel", matchScore: "82%", openReq: "Acme Corporation — Business Analyst" }],
  "David Kim": [{ candidate: "S. Okafor", matchScore: "89%", openReq: "Globex Inc — QA Manager" }],
};

const KPICard = ({ title, value, icon, componentPath }) => {
  const navigate = useNavigate();
  const [showAI, setShowAI] = useState(false);
  const [localInput, setLocalInput] = useState("");
  const aiRef = useOutsideClick(() => setShowAI(false));
  const kpiId = title.replace(/\s+/g, "-").toLowerCase();

  return (
    <motion.div variants={cardVariants} initial="hidden" animate="visible" whileHover={{ y: -3 }} className="bg-white p-3 rounded-lg shadow-sm border border-sky-100 relative cursor-pointer" onClick={() => navigate(componentPath)}>
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center justify-between relative">
            <p className="text-[10px] font-semibold text-sky-600 uppercase tracking-wider truncate">{title}</p>
            <button onClick={(e) => { e.stopPropagation(); setShowAI(!showAI); }} className="p-1 rounded hover:bg-gray-100 z-20" data-tooltip-id={`ai-tooltip-${kpiId}`} data-tooltip-content="Ask AI">
              <BsStars />
            </button>
            {showAI && (
              <div ref={aiRef} className="absolute right-0 top-5 mt-2 w-full sm:w-44 bg-white rounded-md shadow-lg z-30 border border-gray-200 p-2" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center space-x-2">
                  <input type="text" value={localInput} onChange={(e) => setLocalInput(e.target.value)} placeholder="Ask AI..." className="w-full p-1 border border-gray-300 rounded text-x" />
                  <button onClick={() => setLocalInput("")} className="p-1 bg-sky-500 text-white rounded hover:bg-sky-600" disabled={!localInput.trim()}>
                    <FiSend />
                  </button>
                </div>
              </div>
            )}
          </div>
          <p className="text-s font-bold text-sky-900 mt-1">{value}</p>
        </div>
        <div className="p-2 rounded-full bg-sky-100 hover:bg-sky-200 transition-colors duration-200">
          <div className="text-sky-600 hover:text-sky-800 transition-colors duration-200">{icon}</div>
        </div>
      </div>
      <ReactTooltip id={`ai-tooltip-${kpiId}`} place="top" effect="solid" />
    </motion.div>
  );
};

const RecruiterDashboard = () => {
  const navigate = useNavigate();
  const [selectedRecruiter, setSelectedRecruiter] = useState("Priya Shah");
  const [showFilters, setShowFilters] = useState(false);
  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const [aiInputChart, setAiInputChart] = useState({});
  const [showAIDropdownChart, setShowAIDropdownChart] = useState(null);
  const filtersRef = useOutsideClick(() => setShowFilters(false));

  const profile = recruiterProfiles[selectedRecruiter];

  const chartsRecruiter = useMemo(() => ({
    myFunnel: {
      title: "My Recruiting Funnel",
      componentPath: "/recruiter-analytics",
      data: {
        labels: ["Submissions", "Interviews", "Offers", "Accepted", "Starts"],
        datasets: [{ label: "Count", data: profile.funnel, backgroundColor: ["rgba(59,130,246,0.7)", "rgba(20,184,166,0.7)", "rgba(234,179,8,0.7)", "rgba(139,92,246,0.7)", "rgba(16,185,129,0.7)"] }],
      },
      options: { responsive: true, maintainAspectRatio: false, indexAxis: "y", plugins: { legend: { display: false } } },
      defaultType: "bar",
    },
    myWorkload: {
      title: "My Requisition Workload",
      componentPath: "/recruitment-cost-leverage",
      data: {
        labels: ["Open Requisitions", "Aging (30d+)"],
        datasets: [{ label: "Count", data: [profile.workload.open, profile.workload.aging], backgroundColor: ["rgba(59,130,246,0.7)", "rgba(239,68,68,0.7)"] }],
      },
      options: { maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
      defaultType: "doughnut",
    },
    myScore: {
      title: "My Score Components (0-100)",
      componentPath: "/recruiter-analytics",
      data: {
        labels: ["Gross Profit", "Starts & Fill Rate", "Conversion & Speed", "Rehire/Redeploy", "Placement Quality"],
        datasets: [{ label: "Score", data: profile.score, backgroundColor: "rgba(20, 184, 166, 0.7)" }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { max: 100 } } },
      defaultType: "bar",
    },
    myTimeToFill: {
      title: "My Time-to-Fill Trend (days)",
      componentPath: "/recruitment-cost-leverage",
      data: {
        labels: ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"],
        datasets: [{ label: "Time-to-Fill", data: profile.ttf, borderColor: "rgba(59, 130, 246, 1)", backgroundColor: "rgba(59, 130, 246, 0.12)", borderWidth: 2, tension: 0.35 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
      defaultType: "line",
    },
  }), [profile]);

  const initialChartTypes = Object.keys(chartsRecruiter).reduce((acc, key) => ({ ...acc, [key]: chartsRecruiter[key].defaultType }), {});
  const [chartTypes, setChartTypes] = useState(initialChartTypes);
  const [activeWidgets, setActiveWidgets] = useState(Object.keys(chartsRecruiter));

  const toggleChartType = (widgetId, type) => {
    setChartTypes((prev) => ({ ...prev, [widgetId]: type }));
    setDropdownWidget(null);
    setHoveredChartType(null);
  };

  const handleSendAIQueryChart = (widgetId) => {
    if (aiInputChart[widgetId]?.trim()) {
      setAiInputChart((prev) => ({ ...prev, [widgetId]: "" }));
      setShowAIDropdownChart(null);
    }
  };

  const renderChart = (type, data, options = {}) => {
    const chartOptions = { ...options, responsive: true, maintainAspectRatio: false };
    switch (type) {
      case "line": return <Line data={data} options={chartOptions} />;
      case "bar": return <Bar data={data} options={chartOptions} />;
      case "doughnut": return <Doughnut data={data} options={chartOptions} />;
      default: return <Bar data={data} options={chartOptions} />;
    }
  };

  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;
    const items = Array.from(activeWidgets);
    const [reordered] = items.splice(source.index, 1);
    items.splice(destination.index, 0, reordered);
    setActiveWidgets(items);
  };

  const EnhancedChartCard = ({ widgetId, index }) => {
    const chartInfo = chartsRecruiter[widgetId];
    const chartType = chartTypes[widgetId];
    const threeDotsRef = useOutsideClick(() => setDropdownWidget(null));
    const aiRef = useOutsideClick(() => { if (showAIDropdownChart === widgetId) setShowAIDropdownChart(null); });

    return (
      <Draggable draggableId={widgetId} index={index}>
        {(provided) => (
          <div className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border border-sky-100" ref={provided.innerRef} {...provided.draggableProps}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-md font-semibold text-sky-800">{chartInfo.title}</h3>
              <div className="flex space-x-1 relative">
                <div className="relative">
                  <button onClick={(e) => { e.stopPropagation(); setDropdownWidget(dropdownWidget === widgetId ? null : widgetId); }} className="p-1 rounded hover:bg-gray-100" data-tooltip-id={`chart-options-${widgetId}`} data-tooltip-content="Options">
                    <BsThreeDotsVertical />
                  </button>
                  {dropdownWidget === widgetId && (
                    <div ref={threeDotsRef} className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-20 border border-gray-200">
                      <div className="py-1 text-x text-gray-800">
                        <div className="relative" onMouseEnter={() => setHoveredChartType(widgetId)} onMouseLeave={() => setHoveredChartType(null)}>
                          <div className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center">
                            All Chart Types <FiChevronDown className="ml-1 text-x" />
                          </div>
                          {hoveredChartType === widgetId && (
                            <div className="absolute top-0 left-full w-40 bg-white rounded-md shadow-lg border border-gray-200 z-30 py-1" style={{ marginLeft: "-1px" }}>
                              {["line", "bar", "doughnut"].map((type) => (
                                <button key={type} onClick={(e) => { e.stopPropagation(); toggleChartType(widgetId, type); }} className="block w-full text-left px-4 py-2 text-x text-gray-700 hover:bg-gray-100 transition">
                                  {type.charAt(0).toUpperCase() + type.slice(1)} Chart
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="px-4 py-2 hover:bg-gray-100 cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(chartInfo.componentPath); setDropdownWidget(null); }}>
                          Analyze
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={(e) => { e.stopPropagation(); setShowAIDropdownChart(showAIDropdownChart === widgetId ? null : widgetId); }} className="p-1 rounded hover:bg-gray-100" data-tooltip-id={`ai-tooltip-chart-${widgetId}`} data-tooltip-content="Ask AI">
                  <BsStars />
                </button>
                {showAIDropdownChart === widgetId && (
                  <div ref={aiRef} className="absolute right-0 top-full mt-2 w-full sm:w-64 bg-white rounded-md shadow-lg z-20 border border-gray-200 p-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-col items-center space-y-1">
                      <h1 className="text-x text-gray-700">Ask about {chartInfo.title}</h1>
                      <div className="flex justify-between gap-2 w-full">
                        <input type="text" value={aiInputChart[widgetId] || ""} onChange={(e) => setAiInputChart((prev) => ({ ...prev, [widgetId]: e.target.value }))} placeholder="Your question..." className="w-full p-1 border border-gray-300 rounded text-x" />
                        <button onClick={() => handleSendAIQueryChart(widgetId)} className="p-2 bg-sky-500 text-white rounded hover:bg-sky-600 text-x" disabled={!aiInputChart[widgetId]?.trim()}>
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
            <div className="h-64 md:h-72">{renderChart(chartType, chartInfo.data, chartInfo.options)}</div>
            <ReactTooltip id={`chart-options-${widgetId}`} place="top" effect="solid" />
            <ReactTooltip id={`ai-tooltip-chart-${widgetId}`} place="top" effect="solid" />
          </div>
        )}
      </Draggable>
    );
  };

  return (
    <div className="space-y-6 p-4 min-h-screen relative bg-sky-50">
      <nav className="flex mb-4" aria-label="Breadcrumb">
        <ol className="inline-flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse">
          <li className="inline-flex items-center">
            <Link to="/" className="inline-flex items-center text-s font-medium text-gray-700 hover:text-blue-600">
              <svg className="w-3 h-3 me-2.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                <path d="m19.707 9.293-2-2-7-7a1 1 0 0 0-1.414 0l-7 7-2 2a1 1 0 0 0 1.414 1.414L2 10.414V18a2 2 0 0 0 2 2h3a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h3a2 2 0 0 0 2-2v-7.586l.293.293a1 1 0 0 0 1.414-1.414Z" />
              </svg>
              Home
            </Link>
          </li>
          <li>
            <div className="flex items-center">
              <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
              <Link to="/recruitment-performance-dashboard" className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                Recruitment Performance Dashboard
              </Link>
            </div>
          </li>
          <li aria-current="page">
            <div className="flex items-center">
              <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Recruiter Dashboard</span>
            </div>
          </li>
        </ol>
      </nav>

      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-white">Recruiter Dashboard</h1>
            <p className="text-sky-100 text-x mt-1">My personal performance, assigned requisitions, candidates and rehire matches.</p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center gap-2 bg-white/95 rounded-lg px-2">
              <FiUserCheck className="text-sky-700" />
              <select value={selectedRecruiter} onChange={(e) => setSelectedRecruiter(e.target.value)} className="h-9 px-2 rounded-lg bg-transparent text-slate-800 text-s outline-none">
                {Object.keys(recruiterProfiles).map((name) => <option key={name}>{name}</option>)}
              </select>
            </div>
            <button type="button" className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200" onClick={() => setShowFilters(!showFilters)}>
              <FiFilter className="mr-1" /> Filters
            </button>
            <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 hover:text-sky-50 transition-colors duration-200">
              <FiDownload className="text-sky-50" />
              <span className="text-sky-50">Export</span>
            </button>
            <Link to="/recruiter-analytics">
              <button type="button" className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200">
                Team View
                <GrLinkNext className="ml-1 w-4 h-4 hover:w-5 hover:h-5 transition-all" />
              </button>
            </Link>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white p-4 rounded-lg shadow-sm" ref={filtersRef}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Client</label>
              <select className="w-full p-2 border border-gray-300 rounded-md text-s"><option>All My Clients</option></select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Status</label>
              <select className="w-full p-2 border border-gray-300 rounded-md text-s"><option>Open</option><option>Interviewing</option><option>Offer Extended</option><option>Started</option></select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Period</label>
              <select className="w-full p-2 border border-gray-300 rounded-md text-s"><option>QTD</option><option>MTD</option><option>YTD</option></select>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="My Starts" value={profile.kpis.starts} icon={<FiUserCheck size={16} />} componentPath="/recruiter-analytics" />
        <KPICard title="My Revenue" value={profile.kpis.revenue} icon={<FiDollarSign size={16} />} componentPath="/recruitment-revenue-analytics" />
        <KPICard title="My Gross Margin" value={profile.kpis.gm} icon={<FiPercent size={16} />} componentPath="/recruitment-gross-margin" />
        <KPICard title="My Rehire Rate" value={profile.kpis.rehireRate} icon={<FiClock size={16} />} componentPath="/rehire-redeployment" />
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="recruiterDashboardCharts">
          {(provided) => (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" {...provided.droppableProps} ref={provided.innerRef}>
              {activeWidgets.map((widgetId, index) => (
                <EnhancedChartCard key={widgetId} widgetId={widgetId} index={index} />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
          <h3 className="text-s font-semibold text-sky-800 mb-2">My Open Requisitions</h3>
          <table className="w-full text-x text-gray-700">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left">Req ID</th>
                <th className="p-2 text-left">Client</th>
                <th className="p-2 text-left">Role</th>
                <th className="p-2 text-left">Stage</th>
                <th className="p-2 text-left">Days Open</th>
              </tr>
            </thead>
            <tbody>
              {myOpenRequisitions[selectedRecruiter].map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="p-2">{row.id}</td>
                  <td className="p-2">{row.client}</td>
                  <td className="p-2">{row.role}</td>
                  <td className="p-2">{row.stage}</td>
                  <td className="p-2">{row.daysOpen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
          <h3 className="text-s font-semibold text-sky-800 mb-2">My Rehire-Ready Matches</h3>
          <table className="w-full text-x text-gray-700">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left">Candidate</th>
                <th className="p-2 text-left">Match Score</th>
                <th className="p-2 text-left">Matched Open Requisition</th>
              </tr>
            </thead>
            <tbody>
              {myRehireMatches[selectedRecruiter].map((row) => (
                <tr key={row.candidate} className="border-b">
                  <td className="p-2">{row.candidate}</td>
                  <td className="p-2 font-semibold text-emerald-600">{row.matchScore}</td>
                  <td className="p-2">{row.openReq}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RecruiterDashboard;
