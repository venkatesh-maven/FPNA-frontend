
import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { motion } from "framer-motion";
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
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';
import {
  FiDollarSign,
  FiTruck,
  FiPackage,
  FiBarChart2,
  FiAlertTriangle,
  FiTrendingUp,
  FiFilter,
  FiDownload,
  FiSend,
  FiChevronDown,
  FiCheckSquare,
  FiList,
  FiPieChart
} from 'react-icons/fi';
import { BsStars, BsThreeDotsVertical, BsBoxSeam, BsGraphUp, BsShieldCheck, BsCurrencyDollar } from 'react-icons/bs';
import { RiDragMove2Fill } from 'react-icons/ri';
import { GrLinkNext } from "react-icons/gr";
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { getDecimalPrecision } from '../../../utils/formatters';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler
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

const SupplyChainAnalytics = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    timePeriod: 'Last Quarter',
    businessUnit: 'All Units',
    supplierCategory: 'All Categories'
  });
  const [showFilters, setShowFilters] = useState(false);
  
  const initialChartWidgets = [
    'supplierPerformanceTrend',
    'inventoryTurnover',
    'spendByCategory',
    'freightCostTrend',
    'supplierRiskProfile'
  ];
  const [activeWidgets, setActiveWidgets] = useState(initialChartWidgets);

  const initialChartTypes = {
    supplierPerformanceTrend: 'line',
    inventoryTurnover: 'bar',
    spendByCategory: 'doughnut',
    freightCostTrend: 'line',
    supplierRiskProfile: 'bar',
  };
  const [chartTypes, setChartTypes] = useState(initialChartTypes);

  const [dropdownWidget, setDropdownWidget] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);
  const [aiInput, setAiInput] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const filtersRef = useOutsideClick(() => setShowFilters(false));
  const aiChatbotRef = useRef(null); // For chart AI dropdowns

  // KPI Data
  const kpiData = [
    {
      id: 'avgDelivery',
      title: 'Avg. On-Time Delivery',
      value: '93.5%',
      change: '+1.2%',
      isPositive: true,
      icon: <FiTruck size={16} />,
      componentPath: '/SupplyChainTable',
      forecast: '94% next period',
    },
    {
      id: 'inventoryTurnover',
      title: 'Avg. Inventory Turnover',
      value: '5.4x',
      change: '+0.3x',
      isPositive: true,
      icon: <BsBoxSeam size={16} />,
      componentPath: '/SupplyChainTable',
      forecast: '5.6x next period',
    },
    {
      id: 'totalProcurementSpend',
      title: 'Total Procurement Spend',
      value: '$1.25M',
      change: '-3%',
      isPositive: false, // Lower spend is generally better if efficiency gained
      icon: <FiDollarSign size={16} />,
      componentPath: '/SupplyChainTable',
      forecast: '$1.22M next period',
    },
    {
      id: 'costSavingsIdentified',
      title: 'AI Cost Savings Identified',
      value: '$112K',
      change: 'New',
      isPositive: true,
      icon: <BsCurrencyDollar size={16} />,
      componentPath: '/SupplyChainTable',
      forecast: '$150K potential next quarter',
    },
  ];

  // Navigation items for quick links
  const navItems = [
    { name: "Supplier Performance", icon: <FiCheckSquare />, path: "/SupplierPerformanceScorecard" },
    { name: "Inventory Analysis", icon: <BsBoxSeam />, path: "/InventoryTurnoverAnalysis" },
    { name: "Spend Breakdown", icon: <FiPieChart />, path: "/ProcurementSpendBreakdown" },
    { name: "Logistics & Freight", icon: <FiTruck />, path: "/FreightLogisticsOptimization" },
    { name: "Risk Assessment", icon: <FiAlertTriangle />, path: "/OperationalRiskAssessment" },
    { name: "Cost Savings", icon: <BsGraphUp />, path: "/CostSavingOpportunities" },
  ];

  // Chart Data
  const charts = {
    supplierPerformanceTrend: {
      title: 'Supplier Performance Trend (Overall Score)',
      componentPath: '/SupplyChainTable',
      defaultType: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
          {
            label: 'Acme Materials', data: [92, 94, 96, 95, 97, 98], borderColor: 'rgba(0, 74, 128, 1)', backgroundColor: 'rgba(0, 74, 128, 0.1)', tension: 0.3, fill: true,
          },
          {
            label: 'Global Logistics', data: [85, 86, 88, 87, 89, 89], borderColor: 'rgba(58, 124, 165, 1)', backgroundColor: 'rgba(58, 124, 165, 0.1)', tension: 0.3, fill: true,
          },
          {
            label: 'Tech Components', data: [90, 91, 92, 92, 93, 93], borderColor: 'rgba(127, 178, 208, 1)', backgroundColor: 'rgba(127, 178, 208, 0.1)', tension: 0.3, fill: true,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } },
        scales: { y: { min: 80, max: 100, ticks: { callback: value => `${value}%` } } },
      },
    },
    inventoryTurnover: {
      title: 'Inventory Turnover by Category',
      componentPath: '/SupplyChainTable',
      defaultType: 'bar',
      data: {
        labels: ['Electronics', 'Raw Materials', 'Packaging'],
        datasets: [{
          label: 'Turnover Rate (x)',
          data: [5.2, 3.8, 7.1],
          backgroundColor: ['rgba(0, 74, 128, 0.7)', 'rgba(58, 124, 165, 0.7)', 'rgba(127, 178, 208, 0.7)'],
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } },
      },
    },
    spendByCategory: {
      title: 'Procurement Spend by Category',
      componentPath: '/SupplyChainTable',
      defaultType: 'doughnut',
      data: {
        labels: ['Electronics', 'Raw Materials', 'Packaging', 'Logistics', 'Services'],
        datasets: [{
          data: [350000, 250000, 150000, 150000, 100000], // Assuming total spend is $1M for tooltip example
          backgroundColor: ['#004a80', '#3a7ca5', '#7fb2d0', '#a8cfe0', '#cfe6f7'],
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'right' }, tooltip: { callbacks: { label: (ctx) => `${ctx.label}: $${ctx.raw.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}` } } },
      },
    },
    freightCostTrend: {
      title: 'Quarterly Freight Costs',
      componentPath: '/SupplyChainTable',
      defaultType: 'line',
      data: {
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        datasets: [{
          label: 'Freight Costs (K)', data: [45, 52, 38, 45], borderColor: 'rgba(0, 74, 128, 1)', backgroundColor: 'rgba(0, 74, 128, 0.1)', tension: 0.3, fill: true,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { y: { title: { display: true, text: 'Cost (K $)' } } },
      },
    },
    supplierRiskProfile: {
      title: 'Supplier Risk Profile',
      componentPath: '/SupplyChainTable',
      defaultType: 'bar',
      data: {
        labels: ['Supplier A', 'Supplier B', 'Supplier C', 'Supplier D', 'Supplier E'],
        datasets: [
          { label: 'Financial Risk', data: [3, 5, 2, 4, 1], backgroundColor: 'rgba(239, 68, 68, 0.7)' }, // Red-ish
          { label: 'Operational Risk', data: [4, 3, 5, 2, 3], backgroundColor: 'rgba(234, 179, 8, 0.7)' }, // Yellow-ish
          { label: 'Geopolitical Risk', data: [2, 4, 3, 5, 2], backgroundColor: 'rgba(59, 130, 246, 0.7)' }, // Blue-ish
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } },
        scales: { x: { stacked: true }, y: { stacked: true, max:15, title: {display: true, text: 'Risk Score (max 15)'} } },
      },
    },
  };
  
  // AI Cost Savings Data
  const costSavingsData = [
    { id: 1, text: "Renegotiate contract with Global Logistics - potential 12% savings ($45K/year)", detailsLink: "/SupplyChainTable/savings/1" },
    { id: 2, text: "Consolidate electronics suppliers to reduce administrative costs by 18%", detailsLink: "/SupplyChainTable/savings/2" },
    { id: 3, text: "Switch to regional packaging supplier to reduce freight costs by 22%", detailsLink: "/SupplyChainTable/savings/3" },
  ];
  const [expandedSaving, setExpandedSaving] = useState(null);


  const toggleChartType = (widgetId, type) => {
    setChartTypes(prev => ({ ...prev, [widgetId]: type }));
  };

  const handleSendAIQuery = (widgetId) => {
    if (aiInput[widgetId]?.trim()) {
      console.log(`AI Query for ${charts[widgetId].title}:`, aiInput[widgetId]);
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

  // KPICard Component
  const KPICard = ({ id, title, value, change, isPositive, icon, componentPath, forecast }) => {
    const [showKpiAIDropdown, setShowKpiAIDropdown] = useState(false);
    const [localKpiAIInput, setLocalKpiAIInput] = useState("");
    const kpiDropdownRef = useOutsideClick(() => setShowKpiAIDropdown(false));

    const handleSendKpiAIQuery = (e) => {
      e.stopPropagation();
      if (localKpiAIInput.trim()) {
        console.log(`AI Query for KPI ${title}:`, localKpiAIInput);
        setLocalKpiAIInput("");
        setShowKpiAIDropdown(false);
      }
    };
    const kpiTooltipId = `kpi-ai-${id}`;

    return (
      <motion.div
        variants={cardVariants} initial="hidden" animate="visible" whileHover={{ y: -3 }}
        className="bg-white p-3 rounded-lg shadow-sm border border-sky-100 relative cursor-pointer"
        onClick={() => navigate(componentPath)}
      >
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center justify-between relative">
              <p className="text-[10px] font-semibold text-sky-600 uppercase tracking-wider truncate">{title}</p>
              <button
                onClick={(e) => { e.stopPropagation(); setShowKpiAIDropdown(!showKpiAIDropdown); }}
                className="p-1 rounded hover:bg-gray-100 z-20"
                data-tooltip-id={kpiTooltipId} data-tooltip-content="Ask AI"
              >
                <BsStars />
              </button>
              {showKpiAIDropdown && (
                <div ref={kpiDropdownRef} className="absolute right-0 top-5 mt-2 w-full sm:w-44 bg-white rounded-md shadow-lg z-30 border border-gray-200 p-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center space-x-2">
                    <input type="text" value={localKpiAIInput} onChange={(e) => setLocalKpiAIInput(e.target.value)} placeholder="Ask AI..." className="w-full p-1 border border-gray-300 rounded text-x" onClick={(e) => e.stopPropagation()} />
                    <button onClick={handleSendKpiAIQuery} className="p-1 bg-sky-500 text-white rounded hover:bg-sky-600" disabled={!localKpiAIInput.trim()}><FiSend /></button>
                  </div>
                </div>
              )}
            </div>
            <p className="text-xl font-bold text-sky-900 mt-1">{value}</p>
            <div className={`flex items-center mt-2 ${isPositive ? "text-green-500" : "text-red-500"}`}>
              <span className="text-x font-medium">{change} {isPositive ? "↑" : "↓"} vs last period</span>
            </div>
            {forecast && <p className="text-[10px] text-gray-500 italic mt-1">AI Forecast: {forecast}</p>}
          </div>
          <div className="p-2 rounded-full bg-sky-100 hover:bg-sky-200 text-sky-600">{icon}</div>
        </div>
        <ReactTooltip id={kpiTooltipId} place="top" effect="solid" />
      </motion.div>
    );
  };

  // EnhancedChartCard Component
  const EnhancedChartCard = ({ widgetId, index }) => {
    const chartInfo = charts[widgetId];
    const currentChartType = chartTypes[widgetId];
    const chartDropdownRef = useOutsideClick(() => setDropdownWidget(null));
    const chartAiDropdownRef = useOutsideClick(() => { if (showAIDropdown === widgetId) setShowAIDropdown(null); });
    const tooltipIds = {
        options: `chart-options-${widgetId}`,
        ai: `chart-ai-${widgetId}`,
        drag: `chart-drag-${widgetId}`,
    };

    return (
      <Draggable draggableId={widgetId} index={index}>
        {(provided) => (
          <div className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border border-sky-100" ref={provided.innerRef} {...provided.draggableProps}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-md font-semibold text-sky-800">{chartInfo.title}</h3>
              <div className="flex space-x-1 relative">
                <div className="relative">
                  <button onClick={(e) => { e.stopPropagation(); setDropdownWidget(dropdownWidget === widgetId ? null : widgetId); }} className="p-1 rounded hover:bg-gray-100" data-tooltip-id={tooltipIds.options} data-tooltip-content="Options"><BsThreeDotsVertical /></button>
                  {dropdownWidget === widgetId && (
                    <div ref={chartDropdownRef} className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-20 border border-gray-200">
                      <div className="py-1 text-x text-gray-800">
                        <div className="relative" onMouseEnter={() => setHoveredChartType(widgetId)} onMouseLeave={() => setHoveredChartType(null)}>
                          <div className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center">All Chart Types <FiChevronDown className="ml-1 text-x" /></div>
                          {hoveredChartType === widgetId && (
                            <div className="absolute top-0 left-full w-40 bg-white rounded-md shadow-lg border border-gray-200 z-30 py-1" style={{ marginLeft: "-1px" }}>
                              {["line", "bar", "pie", "doughnut"].map((type) => (
                                <button key={type} onClick={(e) => { e.stopPropagation(); toggleChartType(widgetId, type); }} className="block w-full text-left px-4 py-2 text-x text-gray-700 hover:bg-gray-100 transition">{type.charAt(0).toUpperCase() + type.slice(1)} Chart</button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="px-4 py-2 hover:bg-gray-100 cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(chartInfo.componentPath); setDropdownWidget(null); }}>Analyze</div>
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={(e) => { e.stopPropagation(); setShowAIDropdown(showAIDropdown === widgetId ? null : widgetId); }} className="p-1 rounded hover:bg-gray-100" data-tooltip-id={tooltipIds.ai} data-tooltip-content="Ask AI"><BsStars /></button>
                {showAIDropdown === widgetId && (
                  <div ref={chartAiDropdownRef} className="absolute right-0 top-full mt-2 w-full sm:w-64 bg-white rounded-md shadow-lg z-20 border border-gray-200 p-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-col items-center space-y-1">
                      <h1 className="text-x text-gray-700">Ask about {chartInfo.title}</h1>
                      <div className="flex justify-between gap-2 w-full">
                        <input type="text" value={aiInput[widgetId] || ""} onChange={(e) => setAiInput(prev => ({ ...prev, [widgetId]: e.target.value }))} placeholder="Your question..." className="w-full p-1 border border-gray-300 rounded text-x" onClick={(e) => e.stopPropagation()} />
                        <button onClick={() => handleSendAIQuery(widgetId)} className="p-2 bg-sky-500 text-white rounded hover:bg-sky-600 text-x" disabled={!aiInput[widgetId]?.trim()}><FiSend /></button>
                      </div>
                    </div>
                  </div>
                )}
                <div {...provided.dragHandleProps} className="p-1 rounded hover:bg-gray-100 cursor-move" data-tooltip-id={tooltipIds.drag} data-tooltip-content="Rearrange"><RiDragMove2Fill /></div>
                 <ReactTooltip id={tooltipIds.options} place="top" effect="solid" />
                 <ReactTooltip id={tooltipIds.ai} place="top" effect="solid" />
                 <ReactTooltip id={tooltipIds.drag} place="top" effect="solid" />
              </div>
            </div>
            <div className="h-64 md:h-72">{renderChart(currentChartType, chartInfo.data, chartInfo.options)}</div>
          </div>
        )}
      </Draggable>
    );
  };

  // Supplier Performance Table Component
  const SupplierPerformanceTable = () => {
    const suppliers = [
        { name: 'Acme Materials', delivery: '98%', contract: '95%', cost: '4.8/5', risk: 'Low' },
        { name: 'Global Logistics', delivery: '89%', contract: '91%', cost: '4.2/5', risk: 'Medium' },
        { name: 'Tech Components Inc', delivery: '93%', contract: '97%', cost: '4.6/5', risk: 'Low' },
        { name: 'Bulk Goods Co.', delivery: '95%', contract: '90%', cost: '4.1/5', risk: 'Medium' },
        { name: 'Precision Parts Ltd.', delivery: '99%', contract: '98%', cost: '4.9/5', risk: 'Low' },
    ];
    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-md font-semibold text-sky-800">Supplier Performance Scorecard</h3>
                {/* <Link to="/SupplyChainTable" className="text-x text-sky-600 hover:text-sky-800 font-medium">
                    View All Suppliers <GrLinkNext className="inline-block w-3 h-3" />
                </Link> */}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-x text-left text-gray-700">
                    <thead className="text-x text-sky-700 uppercase bg-sky-50">
                        <tr>
                            <th className="px-4 py-2">Supplier</th>
                            <th className="px-4 py-2">On-Time Delivery</th>
                            <th className="px-4 py-2">Contract Adherence</th>
                            <th className="px-4 py-2">Cost Rating</th>
                            <th className="px-4 py-2">Risk Level</th>
                        </tr>
                    </thead>
                    <tbody>
                        {suppliers.slice(0,5).map((supplier, i) => ( // Display top 5 for dashboard
                            <tr key={i} className="border-b hover:bg-sky-50 cursor-pointer" onClick={() => navigate("/SupplyChainTable")}>
                                <td className="px-4 py-2 font-medium">{supplier.name}</td>
                                <td className={`px-4 py-2 ${parseFloat(supplier.delivery) >= 95 ? 'text-green-600' : parseFloat(supplier.delivery) >= 90 ? 'text-amber-600' : 'text-red-600'}`}>{supplier.delivery}</td>
                                <td className="px-4 py-2">{supplier.contract}</td>
                                <td className="px-4 py-2">{supplier.cost}</td>
                                <td className={`px-4 py-2 font-medium ${supplier.risk === 'Low' ? 'text-green-600' : supplier.risk === 'Medium' ? 'text-amber-600' : 'text-red-600'}`}>{supplier.risk}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
  };

  return (
    <div className="space-y-6 p-4 min-h-screen relative bg-sky-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Supply Chain & Procurement Analytics</h1>
            <p className="text-sky-100 text-x">Vendor performance, cost efficiency, and risk management.</p>
          </div>
          <div className="flex space-x-2">
            <button type="button" onClick={() => setShowFilters(!showFilters)} className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200">
              <FiFilter className="mr-1" /> Filters
            </button>
            <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 hover:text-sky-50 transition-colors duration-200">
              <FiDownload className="text-sky-50" /> <span className="text-sky-50">Export</span>
            </button>
            <Link to="/SupplyChainTable">
              <button type="button" className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200">
                View More <GrLinkNext className="ml-1 w-4 h-4 hover:w-5 hover:h-5 transition-all" />
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      {showFilters && (
        <div className="bg-white p-4 rounded-lg shadow-sm" ref={filtersRef}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Time Period</label>
              <select value={filters.timePeriod} onChange={(e) => setFilters(prev => ({...prev, timePeriod: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md text-s">
                <option>Last Quarter</option><option>Last Month</option><option>Year to Date</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Business Unit</label>
              <select value={filters.businessUnit} onChange={(e) => setFilters(prev => ({...prev, businessUnit: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md text-s">
                <option>All Units</option><option>North America</option><option>Europe</option><option>Asia-Pacific</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Supplier Category</label>
              <select value={filters.supplierCategory} onChange={(e) => setFilters(prev => ({...prev, supplierCategory: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md text-s">
                <option>All Categories</option><option>Raw Materials</option><option>Components</option><option>Services</option><option>Logistics</option>
              </select>
            </div>
          </div>
        </div>
      )}
      
      {/* Quick Links */}
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map(kpi => <KPICard key={kpi.id} {...kpi} />)}
      </div>

      {/* Charts Section */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="supplyChainCharts">
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

      {/* Supplier Performance Table */}
      <SupplierPerformanceTable />

      {/* Cost Savings Opportunities */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-sky-100">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-md font-semibold text-sky-800 flex items-center">
            <BsStars className="text-sky-600 mr-2" />AI-Identified Cost Savings
          </h3>
          <button onClick={() => navigate('/SupplyChainTable/savings-plan')} className="py-1 px-3 text-x font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors">
            Generate Full Plan
          </button>
        </div>
        <div className="space-y-3">
          {costSavingsData.map((saving, index) => (
            <div key={saving.id} className="p-3 bg-sky-50 rounded-lg border border-sky-200 hover:bg-sky-100 transition-colors">
              <div className="flex justify-between items-start">
                <p className="text-s text-gray-700 flex-grow">{saving.text}</p>
                <button onClick={() => setExpandedSaving(expandedSaving === saving.id ? null : saving.id)} className="ml-2 p-1 text-sky-600 hover:text-sky-800">
                  <FiChevronDown className={`w-4 h-4 transition-transform ${expandedSaving === saving.id ? 'rotate-180' : ''}`} />
                </button>
              </div>
              {expandedSaving === saving.id && (
                <div className="mt-2 pl-0 pt-2 border-t border-sky-200 flex items-center space-x-2">
                  <button onClick={() => navigate(saving.detailsLink)} className="text-x py-1 px-2 bg-sky-500 text-white rounded hover:bg-sky-600">View Details</button>
                  <button className="text-x py-1 px-2 border border-sky-300 text-sky-700 rounded hover:bg-sky-100">Track Initiative</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      <ReactTooltip id="global-supply-tooltip" place="top" effect="solid" />
    </div>
  );
};

export default SupplyChainAnalytics;