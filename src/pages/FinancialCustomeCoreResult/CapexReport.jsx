import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  FiDownload,
  FiPrinter,
  FiSend,
  FiFilter,
  FiAlertCircle,
  FiDollarSign,
  FiTrendingUp,
  FiTrendingDown,
  FiHardDrive,
} from "react-icons/fi";
import { BsStars } from "react-icons/bs";
import { CSVLink } from "react-csv";
import { GrLinkNext } from "react-icons/gr";
import { getDecimalPrecision } from '../../utils/formatters';

const CapexReport = () => {
  const [drillDownData, setDrillDownData] = useState(null);
  const [filters, setFilters] = useState({
    status: "all",
    department: "all",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [activeInsight, setActiveInsight] = useState(0);
  const [showAIDropdown, setShowAIDropdown] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiHistory, setAiHistory] = useState([]);

  // Sample data for CapEx report
  const capexData = {
    tableData: [
      { id: 1, project: "New Production Line", department: "Operations", budget: 500000, actual: 525000, completion: 95, status: "In Progress" },
      { id: 2, project: "IT Server Infrastructure Upgrade", department: "IT", budget: 150000, actual: 145000, completion: 100, status: "Completed" },
      { id: 3, project: "R&D Lab Equipment", department: "R&D", budget: 85000, actual: 85000, completion: 100, status: "Completed" },
      { id: 4, project: "Sales Vehicle Fleet Expansion", department: "Sales", budget: 120000, actual: 130000, completion: 100, status: "Completed" },
      { id: 5, project: "Headquarters Renovation", department: "G&A", budget: 300000, actual: 200000, completion: 60, status: "In Progress" },
    ],
    metrics: {
      totalBudget: 1155000,
      totalActual: 1085000,
      totalVariance: 70000,
      completedProjects: 3,
      inProgressProjects: 2,
      insights: [
        "Overall capital expenditure is currently $70k under budget, mainly due to the phased spending on the HQ Renovation.",
        "The New Production Line is trending 5% over budget; recommend a review of contractor costs.",
        "IT Server Upgrade completed under budget, realizing a $5k saving for the department."
      ]
    }
  };

  const handleDrillDown = (rowData) => {
    const variance = rowData.budget - rowData.actual;
    setDrillDownData({
      title: `${rowData.project} Details`,
      data: [
        { field: "Department", value: rowData.department },
        { field: "Status", value: rowData.status },
        { field: "Budget", value: formatCurrency(rowData.budget) },
        { field: "Actual Cost", value: formatCurrency(rowData.actual) },
        { field: "Variance", value: formatCurrency(variance), isPositive: variance >= 0 },
        { field: "Completion", value: `${rowData.completion}%` },
      ],
      insights: [
        getDrillDownInsight(rowData),
        "Primary costs allocated to equipment and third-party contractors.",
        "Project Lead: Michael Chen (m.chen@company.com)"
      ]
    });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: getDecimalPrecision(),
      maximumFractionDigits: getDecimalPrecision()
    }).format(value);
  };

  const getDrillDownInsight = (rowData) => {
    const variance = rowData.budget - rowData.actual;
    const isOverBudget = variance < 0;
    if (isOverBudget) {
      return `This project is ${formatCurrency(Math.abs(variance))} over budget. AI suggests reviewing vendor invoices for potential discrepancies.`;
    } else {
      return `This project is ${formatCurrency(variance)} under budget, indicating effective cost control and negotiation.`;
    }
  };

  const getCSVData = () => {
    return capexData.tableData.map(row => ({
        Project: row.project,
        Department: row.department,
        Budget: row.budget,
        Actual: row.actual,
        Variance: row.budget - row.actual,
        Completion: `${row.completion}%`,
        Status: row.status,
    }));
  };

  const renderTable = () => {
    const filteredTableData = capexData.tableData.filter(row => 
        (filters.department === 'all' || row.department === filters.department) &&
        (filters.status === 'all' || row.status === filters.status)
    );

    return (
      <div className="overflow-y-auto bg-white/50 rounded-lg border border-sky-100 max-h-[30rem]">
        <table className="w-full text-x">
          <thead className="sticky top-0 bg-sky-100 text-sky-900">
            <tr>
              <th className="px-4 py-2 text-left">Project</th>
              <th className="px-4 py-2 text-right">Budget</th>
              <th className="px-4 py-2 text-right">Actual Cost</th>
              <th className="px-4 py-2 text-right">Variance</th>
              <th className="px-4 py-2 text-left w-1/4">Completion</th>
              <th className="px-4 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredTableData.map((row, index) => {
                const variance = row.budget - row.actual;
                return (
                    <tr 
                        key={index} 
                        className="border-b border-sky-200 hover:bg-sky-50 cursor-pointer"
                        onClick={() => handleDrillDown(row)}
                    >
                        <td className="px-4 py-2 font-medium">
                            <div>{row.project}</div>
                            <div className="text-gray-500 text-x">{row.department}</div>
                        </td>
                        <td className="px-4 py-2 text-right">{formatCurrency(row.budget)}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(row.actual)}</td>
                        <td className={`px-4 py-2 text-right font-semibold ${variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {formatCurrency(variance)}
                        </td>
                        <td className="px-4 py-2">
                           <div className="w-full bg-gray-200 rounded-full h-2.5">
                             <div className={`h-2.5 rounded-full ${row.completion >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{width: `${row.completion}%`}}></div>
                           </div>
                        </td>
                        <td className="px-4 py-2 text-center">
                            <span className={`px-2 py-1 text-x font-medium rounded-full ${
                                row.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                                {row.status}
                            </span>
                        </td>
                    </tr>
                )
            })}
             <tr className="bg-gray-100 font-semibold sticky bottom-0">
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2 text-right">{formatCurrency(capexData.metrics.totalBudget)}</td>
              <td className="px-4 py-2 text-right">{formatCurrency(capexData.metrics.totalActual)}</td>
              <td className={`px-4 py-2 text-right ${capexData.metrics.totalVariance >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(capexData.metrics.totalVariance)}
              </td>
              <td colSpan="2"></td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const renderKeyMetrics = () => {
    const { metrics } = capexData;
    return (
      <div className="space-y-3">
        <h3 className="text-s font-semibold text-sky-900 mb-2">Key Metrics</h3>
        <ul className="text-s text-black space-y-2">
          <li className="flex justify-between items-center">
            <span>Total Budget:</span>
            <span className="font-medium text-sky-800">{formatCurrency(metrics.totalBudget)}</span>
          </li>
          <li className="flex justify-between items-center">
            <span>Total Actual Spend:</span>
            <span className="font-medium text-sky-800">{formatCurrency(metrics.totalActual)}</span>
          </li>
          <li className="flex justify-between items-center">
            <span>Overall Variance:</span>
            <span className={`font-medium ${metrics.totalVariance >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(metrics.totalVariance)}
              {metrics.totalVariance >= 0 ? <FiTrendingUp className="inline ml-1"/> : <FiTrendingDown className="inline ml-1"/>}
            </span>
          </li>
          <li className="flex justify-between items-center">
            <span>Completed Projects:</span>
            <span className="font-medium text-green-600">{metrics.completedProjects}</span>
          </li>
        </ul>

        {metrics.insights && (
          <div className="mt-4">
            <h4 className="text-x font-semibold text-sky-900 mb-2 flex items-center">
              <FiAlertCircle className="mr-1" /> CAPEX Insights
            </h4>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeInsight}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="text-x bg-sky-100 p-3 rounded-lg border border-sky-200"
              >
                {metrics.insights[activeInsight]}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>
    );
  };

  const renderDrillDownView = () => {
    if (!drillDownData) return null;
    
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-sky-900">{drillDownData.title}</h3>
          <button onClick={() => setDrillDownData(null)} className="text-s text-sky-600 hover:text-sky-800">
            Back to CAPEX Report
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-sky-50 rounded-lg p-4">
            <h4 className="text-s font-medium text-sky-800 mb-3">Project Financials</h4>
            <table className="w-full text-s">
              <tbody>
                {drillDownData.data.map((item, index) => (
                  <tr key={index} className="border-b border-sky-100">
                    <td className="py-2 font-medium text-sky-900">{item.field}</td>
                    <td className={`py-2 text-right ${item.isPositive === true ? "text-green-600" : item.isPositive === false ? "text-red-600" : "text-gray-700"}`}>
                      {item.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="bg-sky-50 rounded-lg p-4">
            <h4 className="text-s font-medium text-sky-800 mb-3">Insights</h4>
            <ul className="space-y-3 text-s">
              {drillDownData.insights.map((insight, index) => (
                <li key={index} className="flex items-start">
                  <div className="flex-shrink-0 h-5 w-5 text-sky-500">
                    <FiAlertCircle className="h-full w-full" />
                  </div>
                  <p className="ml-2 text-gray-700">{insight}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  const handleSendAIQuery = () => {
    if (aiInput.trim()) {
      const response = `AI analysis for CAPEX: ${aiInput} (This is a mock response)`;
      setAiHistory(prev => [...prev, { query: aiInput, response }]);
      setAiInput("");
      setShowAIDropdown(false);
    }
  };

  const aiChatbotRef = useRef(null);
  const filtersRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (aiChatbotRef.current && !aiChatbotRef.current.contains(event.target)) setShowAIDropdown(false);
      if (filtersRef.current && !filtersRef.current.contains(event.target)) setShowFilters(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (capexData.metrics.insights?.length > 1) {
      const interval = setInterval(() => {
        setActiveInsight((prev) => (prev + 1) % capexData.metrics.insights.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [capexData.metrics.insights]);

  return (
    <div className="min-h-screen bg-sky-50 p-6">
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Capital Expenditure (CAPEX) Report</h1>
            <p className="text-sky-100 text-x">Tracks capital expenditures vs. budgeted amounts.</p>
          </div>
          <button onClick={() => window.print()} className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 transition-colors">
            <FiDownload /><span>Export</span>
          </button>
        </div>
      </div>

      <nav className="flex mb-6" aria-label="Breadcrumb">
        <ol className="inline-flex items-center space-x-1 md:space-x-2">
          <li className="inline-flex items-center">
            <Link to="/financial-core-reports" className="inline-flex items-center text-s font-medium text-sky-900 hover:text-blue-600">
              Financial Reports
            </Link>
          </li>
          <li aria-current="page">
            <div className="flex items-center">
              <GrLinkNext className="w-3 h-3 text-gray-400 mx-1" />
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">CAPEX Report</span>
            </div>
          </li>
        </ol>
      </nav>

      <div className="bg-white p-6 rounded-xl shadow-md">
        <div className="mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-semibold text-sky-900 flex items-center gap-2">
                {drillDownData ? drillDownData.title : "CAPEX Project Summary"}
              </h2>
              <p className="text-sky-600 text-s mb-2">
                {drillDownData ? "Detailed view of selected project" : "Budget vs. Actual for capital projects"}
              </p>
            </div>
            <Link to="/financial-core-reports" className="text-sky-500 hover:text-sky-700 mt-1">
              <button type="button" className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200">
                Back to Reports <GrLinkNext className="ml-1 w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>

        {!drillDownData && (
          <div className="mb-4 flex flex-wrap gap-2 justify-end items-center">
             <div className="relative" ref={filtersRef}>
                <button onClick={() => setShowFilters(!showFilters)} className="flex items-center bg-sky-100 hover:bg-sky-200 text-sky-800 rounded-lg px-3 py-2 text-x">
                  <FiFilter className="mr-2" /> Filter
                </button>
                <AnimatePresence>
                  {showFilters && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute z-10 mt-2 w-64 bg-white rounded-lg shadow-lg border border-sky-200 p-4 right-0">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-x font-medium text-sky-700 mb-1">Status</label>
                          <select value={filters.status} onChange={(e) => setFilters(f => ({...f, status: e.target.value}))} className="w-full p-2 border border-sky-300 rounded text-x">
                            <option value="all">All</option>
                            <option value="Completed">Completed</option>
                            <option value="In Progress">In Progress</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-x font-medium text-sky-700 mb-1">Department</label>
                          <select value={filters.department} onChange={(e) => setFilters(f => ({...f, department: e.target.value}))} className="w-full p-2 border border-sky-300 rounded text-x">
                            <option value="all">All Departments</option>
                            <option value="IT">IT</option>
                            <option value="Operations">Operations</option>
                            <option value="R&D">R&D</option>
                            <option value="Sales">Sales</option>
                            <option value="G&A">G&A</option>
                          </select>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
            </div>
            <CSVLink data={getCSVData()} filename={"capex-report.csv"} className="flex items-center px-3 py-2 bg-sky-100 text-sky-800 rounded-lg text-x hover:bg-sky-200">
              <FiDownload className="mr-1" /> CSV
            </CSVLink>
            <div className="relative">
              <button onClick={() => setShowAIDropdown(true)} className="flex items-center px-3 py-2 text-sky-800 rounded-lg bg-sky-100 hover:bg-sky-200 text-x">
                <BsStars className="mr-1" /> Ask AI
              </button>
              {showAIDropdown && (
                  <motion.div ref={aiChatbotRef} className="absolute z-50 mt-2 right-0 w-80 bg-white/90 backdrop-blur-md rounded-lg shadow-lg border border-sky-200 p-2" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                    <h1 className="text-s font-semibold text-sky-900 mb-2">Ask about CAPEX</h1>
                    <div className="flex items-center space-x-2 mb-4">
                      <input type="text" value={aiInput} onChange={(e) => setAiInput(e.target.value)} placeholder="e.g., Which projects are over budget?" className="w-full p-2 border border-sky-300 rounded-lg bg-sky-50 text-sky-900 text-s focus:outline-none focus:ring-2 focus:ring-sky-500" onClick={(e) => e.stopPropagation()} />
                      <button onClick={handleSendAIQuery} className="p-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50" disabled={!aiInput.trim()}>
                        <FiSend className="w-5 h-5" />
                      </button>
                    </div>
                  </motion.div>
              )}
            </div>
          </div>
        )}

        <div className="mb-6">
          {drillDownData ? renderDrillDownView() : renderTable()}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>{!drillDownData && renderKeyMetrics()}</div>
          <div>{/* Placeholder for a potential chart or additional analysis */}</div>
        </div>
      </div>
    </div>
  );
};

export default CapexReport;