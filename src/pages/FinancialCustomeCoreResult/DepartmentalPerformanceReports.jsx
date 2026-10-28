import React, { useState, useRef, useEffect } from 'react';
import { FiDownload, FiFilter, FiChevronDown, FiTrendingUp, FiTrendingDown, FiAlertCircle } from 'react-icons/fi';
import { BsStars } from 'react-icons/bs';
import { CSVLink } from 'react-csv';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { GrLinkNext } from 'react-icons/gr';
import { getDecimalPrecision } from '../../utils/formatters';

// Sample data for Departmental Performance
const departmentData = {
  tableData: [
    { department: 'Sales', revenue: 250000, costs: 150000, profit: 100000, margin: 40, budgetVariance: 12 },
    { department: 'Marketing', revenue: 180000, costs: 120000, profit: 60000, margin: 33.3, budgetVariance: 8 },
    { department: 'Operations', revenue: 220000, costs: 160000, profit: 60000, margin: 27.3, budgetVariance: -5 },
    { department: 'R&D', revenue: 90000, costs: 80000, profit: 10000, margin: 11.1, budgetVariance: -15 },
    { department: 'HR', revenue: 50000, costs: 45000, profit: 5000, margin: 10, budgetVariance: -2 },
  ],
  metrics: {
    totalRevenue: 790000,
    totalCosts: 555000,
    totalProfit: 235000,
    avgMargin: 24.3,
    topDepartment: 'Sales',
    worstDepartment: 'HR',
    insights: [
      'Sales department contributes 42% of total profit',
      'R&D has the lowest margin at 11.1%',
      'Operations has negative budget variance of -5%'
    ]
  }
};

const timePeriods = [
  { id: "all", name: "All Periods" },
  { id: "current", name: "Current Quarter" },
  { id: "last", name: "Last Quarter" },
  { id: "ytd", name: "Year to Date" },
  { id: "custom", name: "Custom Range" },
];

const DepartmentalPerformanceReports = () => {
  const [filters, setFilters] = useState({
    period: "all",
    entity: "all",
    hierarchy: "department",
    customRange: { start: "", end: "" },
  });
  const [showFilters, setShowFilters] = useState(false);
  const [activeInsight, setActiveInsight] = useState(0);
  const [showAIDropdown, setShowAIDropdown] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiHistory, setAiHistory] = useState([]);
  const aiChatbotRef = useRef(null);
  const filtersRef = useRef(null);

  const filteredData = departmentData;

  useEffect(() => {
    if (filteredData.metrics.insights?.length > 1) {
      const interval = setInterval(() => {
        setActiveInsight((prev) => (prev + 1) % filteredData.metrics.insights.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [filteredData]);

  const handleSendAIQuery = () => {
    if (aiInput.trim()) {
      const response = `AI Insight: ${aiInput} (mock response showing analysis of departmental performance)`;
      setAiHistory([...aiHistory, { query: aiInput, response }]);
      setAiInput("");
      setShowAIDropdown(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (aiChatbotRef.current && !aiChatbotRef.current.contains(event.target)) {
        setShowAIDropdown(false);
      }
      if (filtersRef.current && !filtersRef.current.contains(event.target)) {
        setShowFilters(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-sky-50 p-6">
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Departmental Performance Reports</h1>
            <p className="text-sky-100 text-x">
              Analyze performance by department with cost and profit metrics
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 hover:text-sky-900 transition-colors duration-200">
            <FiDownload className="text-sky-50 hover:text-sky-900" />
            <span className="text-sky-50 hover:text-sky-900">Export</span>
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        <aside className="w-1/4 bg-white p-4 rounded-xl shadow-md">
          <h2 className="text-sky-800 text-md font-semibold mb-4">Reports</h2>
          <ul className="space-y-2">
            <li className="px-3 py-2 rounded-md text-s cursor-pointer transition bg-sky-100 text-sky-800 font-semibold">
              Departmental Performance
            </li>
            <Link to="/financial-reports">
              <li className="px-3 py-2 rounded-md text-s cursor-pointer transition text-sky-700 hover:bg-sky-50">
                Back to Financial Reports
              </li>
            </Link>
          </ul>
        </aside>

        <main className="w-3/4 bg-white p-6 rounded-xl shadow-md">
          <div className="mb-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-semibold text-sky-900 flex items-center gap-2">
                  Departmental Performance Report
                </h2>
                <p className="text-sky-600 text-s mb-2">
                  Cost centers and P&L by business unit with margin analysis
                </p>
              </div>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2 justify-end items-center">
            <div className="flex gap-2">
              <div className="relative" ref={filtersRef}>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center bg-sky-100 hover:bg-sky-200 text-sky-800 rounded-lg px-3 py-2 text-x">
                  <FiFilter className="mr-2" /> Filter
                </button>

                <AnimatePresence>
                  {showFilters && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute z-10 mt-2 w-64 bg-white rounded-lg shadow-lg border border-sky-200 p-4">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-x font-medium text-sky-700 mb-1">
                            Time Period
                          </label>
                          <select
                            value={filters.period}
                            onChange={(e) =>
                              setFilters({
                                ...filters,
                                period: e.target.value,
                              })
                            }
                            className="w-full p-2 border border-sky-300 rounded text-x">
                            {timePeriods.map((period) => (
                              <option key={period.id} value={period.id}>
                                {period.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {filters.period === "custom" && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-x font-medium text-sky-700 mb-1">
                                Start Date
                              </label>
                              <input
                                type="date"
                                value={filters.customRange.start}
                                onChange={(e) =>
                                  setFilters({
                                    ...filters,
                                    customRange: {
                                      ...filters.customRange,
                                      start: e.target.value,
                                    },
                                  })
                                }
                                className="w-full p-2 border border-sky-300 rounded text-x"
                              />
                            </div>
                            <div>
                              <label className="block text-x font-medium text-sky-700 mb-1">
                                End Date
                              </label>
                              <input
                                type="date"
                                value={filters.customRange.end}
                                onChange={(e) =>
                                  setFilters({
                                    ...filters,
                                    customRange: {
                                      ...filters.customRange,
                                      end: e.target.value,
                                    },
                                  })
                                }
                                className="w-full p-2 border border-sky-300 rounded text-x"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex gap-2">
              <CSVLink
                data={filteredData.tableData}
                filename={"departmental-performance.csv"}
                className="flex items-center px-3 py-2 bg-sky-100 text-sky-800 rounded-lg text-x hover:bg-sky-200">
                <FiDownload className="mr-1" /> CSV
              </CSVLink>
              <button
                onClick={() => window.print()}
                className="flex items-center px-3 py-2 bg-sky-100 text-sky-800 rounded-lg text-x hover:bg-sky-200">
                <FiPrinter className="mr-1" /> Print
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowAIDropdown(true)}
                  className="flex items-center px-3 py-2 text-sky-800 rounded-lg bg-sky-100 hover:bg-sky-200 text-x">
                  <BsStars className="mr-1" /> Ask AI
                </button>

                {showAIDropdown && (
                  <motion.div
                    ref={aiChatbotRef}
                    className="absolute z-50 mt-2 right-0 w-80 bg-white/90 backdrop-blur-md rounded-lg shadow-lg border border-sky-200 p-2"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}>
                    <h1 className="text-s font-semibold text-sky-900 mb-2">
                      Ask about Departmental Performance
                    </h1>
                    <div className="flex items-center space-x-2 mb-4">
                      <input
                        type="text"
                        value={aiInput}
                        onChange={(e) => setAiInput(e.target.value)}
                        placeholder="Ask AI about this report..."
                        className="w-full p-2 border border-sky-300 rounded-lg bg-sky-50 text-sky-900 text-s focus:outline-none focus:ring-2 focus:ring-sky-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSendAIQuery();
                        }}
                        className="p-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                        disabled={!aiInput.trim()}>
                        <FiSend className="w-5 h-5" />
                      </button>
                    </div>
                    {aiHistory.length > 0 && (
                      <div className="space-y-2 max-h-32 overflow-y-auto text-x text-sky-700">
                        {aiHistory.map((entry, index) => (
                          <div key={index}>
                            <strong>Q:</strong> {entry.query}
                            <br />
                            <strong>A:</strong> {entry.response}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="overflow-y-auto bg-white/50 rounded-lg border border-sky-100">
              <table className="w-full text-x">
                <thead>
                  <tr className="bg-sky-100 text-sky-900">
                    <th className="px-2 py-1 text-left">Department</th>
                    <th className="px-2 py-1 text-right">Revenue</th>
                    <th className="px-2 py-1 text-right">Costs</th>
                    <th className="px-2 py-1 text-right">Profit</th>
                    <th className="px-2 py-1 text-right">Margin %</th>
                    <th className="px-2 py-1 text-right">Budget Variance %</th>
                    <th className="px-2 py-1 text-right">Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.tableData.map((row, index) => (
                    <tr key={index} className="border-b border-sky-200 hover:bg-sky-50">
                      <td className="px-2 py-1 font-medium">{row.department}</td>
                      <td className="px-2 py-1 text-right">${row.revenue.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                      <td className="px-2 py-1 text-right">${row.costs.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                      <td className="px-2 py-1 text-right">${row.profit.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                      <td className="px-2 py-1 text-right">{row.margin}%</td>
                      <td className="px-2 py-1 text-right">
                        <span className={row.budgetVariance >= 0 ? "text-green-600" : "text-red-600"}>
                          {row.budgetVariance >= 0 ? "+" : ""}{row.budgetVariance}%
                        </span>
                      </td>
                      <td className="px-2 py-1 text-right">
                        {row.budgetVariance >= 0 ? (
                          <span className="text-green-600 flex items-center justify-end">
                            <FiTrendingUp className="mr-1" /> Above Budget
                          </span>
                        ) : (
                          <span className="text-red-600 flex items-center justify-end">
                            <FiTrendingDown className="mr-1" /> Below Budget
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-s font-semibold text-sky-900 mb-2">Key Metrics</h3>
              <ul className="text-s text-black space-y-2">
                <li className="flex justify-between items-center">
                  <span>Total Revenue:</span>
                  <span className="font-medium text-sky-800">
                    ${filteredData.metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
                  </span>
                </li>
                <li className="flex justify-between items-center">
                  <span>Total Costs:</span>
                  <span className="font-medium text-sky-800">
                    ${filteredData.metrics.totalCosts.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
                  </span>
                </li>
                <li className="flex justify-between items-center">
                  <span>Total Profit:</span>
                  <span className="font-medium text-sky-800">
                    ${filteredData.metrics.totalProfit.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
                  </span>
                </li>
                <li className="flex justify-between items-center">
                  <span>Average Margin:</span>
                  <span className="font-medium text-sky-800">
                    {filteredData.metrics.avgMargin}%
                  </span>
                </li>
                <li className="flex justify-between items-center">
                  <span>Top Performing Department:</span>
                  <span className="font-medium text-green-600">
                    {filteredData.metrics.topDepartment}
                  </span>
                </li>
                <li className="flex justify-between items-center">
                  <span>Lowest Performing Department:</span>
                  <span className="font-medium text-red-600">
                    {filteredData.metrics.worstDepartment}
                  </span>
                </li>
              </ul>

              {filteredData.metrics.insights && (
                <div className="mt-4">
                  <h4 className="text-x font-semibold text-sky-900 mb-2 flex items-center">
                    <FiAlertCircle className="mr-1" /> Performance Insights
                  </h4>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeInsight}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="text-x bg-sky-100 p-3 rounded-lg border border-sky-200">
                      {filteredData.metrics.insights[activeInsight]}
                    </motion.div>
                  </AnimatePresence>
                </div>
              )}
            </div>
            <div>
              <div className="bg-sky-50/50 p-4 rounded-lg border border-sky-200">
                <h3 className="text-s font-semibold text-sky-900 mb-3">
                  Departmental Analysis
                </h3>
                <div className="text-x text-sky-700 space-y-3">
                  <div className="flex items-start">
                    <div className="p-2 rounded-full mr-3 bg-green-100 text-green-700">
                      <FiTrendingUp size={16} />
                    </div>
                    <div>
                      <p className="font-medium">Best Performing Department</p>
                      <p className="text-black">
                        {filteredData.metrics.topDepartment} with {filteredData.tableData.find(d => d.department === filteredData.metrics.topDepartment).margin}% margin
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="p-2 rounded-full mr-3 bg-red-100 text-red-700">
                      <FiTrendingDown size={16} />
                    </div>
                    <div>
                      <p className="font-medium">Lowest Performing Department</p>
                      <p className="text-black">
                        {filteredData.metrics.worstDepartment} with {filteredData.tableData.find(d => d.department === filteredData.metrics.worstDepartment).margin}% margin
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="p-2 rounded-full mr-3 bg-blue-100 text-blue-700">
                      <FiAlertCircle size={16} />
                    </div>
                    <div>
                      <p className="font-medium">Key Observation</p>
                      <p className="text-black">
                        Sales contributes {Math.round((filteredData.tableData.find(d => d.department === 'Sales').profit / filteredData.metrics.totalProfit) * 100)}% of total profit
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DepartmentalPerformanceReports;