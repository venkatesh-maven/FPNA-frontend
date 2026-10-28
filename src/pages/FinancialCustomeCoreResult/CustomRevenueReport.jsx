import React, { useState, useRef, useEffect } from 'react';
import { FiDownload, FiFilter, FiChevronDown, FiTrendingUp, FiTrendingDown, FiAlertCircle, FiPrinter } from 'react-icons/fi';
import { BsStars } from 'react-icons/bs';
import { CSVLink } from 'react-csv';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { GrLinkNext } from 'react-icons/gr';
import { getDecimalPrecision } from '../../utils/formatters';

// Sample data for Custom Revenue Report
const revenueData = {
  tableData: [
    { quarter: 'Q1', productA: 50000, productB: 30000, productC: 20000, total: 100000, growth: 0 },
    { quarter: 'Q2', productA: 55000, productB: 32000, productC: 23000, total: 110000, growth: 10 },
    { quarter: 'Q3', productA: 60000, productB: 34000, productC: 26000, total: 120000, growth: 9.1 },
    { quarter: 'Q4', productA: 65000, productB: 36000, productC: 29000, total: 130000, growth: 8.3 },
  ],
  metrics: {
    totalRevenue: 460000,
    avgQuarterlyGrowth: 6.85,
    bestPerformingProduct: 'Product A',
    worstPerformingProduct: 'Product C',
    productMix: {
      productA: 50,
      productB: 30.4,
      productC: 19.6
    },
    insights: [
      'Product A contributes 50% of total revenue',
      'Consistent quarter-over-quarter growth across all products',
      'Q4 shows highest revenue with $130,000'
    ]
  }
};

const timePeriods = [
  { id: "all", name: "All Quarters" },
  { id: "current", name: "Current Quarter" },
  { id: "last", name: "Last Quarter" },
  { id: "ytd", name: "Year to Date" },
];

const CustomRevenueReport = () => {
  const [filters, setFilters] = useState({
    period: "all",
    product: "all",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [activeInsight, setActiveInsight] = useState(0);
  const [showAIDropdown, setShowAIDropdown] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiHistory, setAiHistory] = useState([]);
  const aiChatbotRef = useRef(null);
  const filtersRef = useRef(null);

  const filteredData = revenueData;

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
      const response = `AI Insight: ${aiInput} (mock response showing analysis of revenue trends)`;
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
            <h1 className="text-lg font-bold text-white">Custom Revenue Report</h1>
            <p className="text-sky-100 text-x">
              Analyze revenue by product and quarter with growth metrics
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
              Custom Revenue
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
                  Product Revenue Analysis
                </h2>
                <p className="text-sky-600 text-s mb-2">
                  Revenue breakdown by product with quarterly growth trends
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
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex gap-2">
              <CSVLink
                data={filteredData.tableData}
                filename={"custom-revenue.csv"}
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
                      Ask about Revenue Trends
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
                    <th className="px-2 py-1 text-left">Quarter</th>
                    <th className="px-2 py-1 text-right">Product A</th>
                    <th className="px-2 py-1 text-right">Product B</th>
                    <th className="px-2 py-1 text-right">Product C</th>
                    <th className="px-2 py-1 text-right">Total Revenue</th>
                    <th className="px-2 py-1 text-right">Quarterly Growth %</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.tableData.map((row, index) => (
                    <tr key={index} className="border-b border-sky-200 hover:bg-sky-50">
                      <td className="px-2 py-1 font-medium">{row.quarter}</td>
                      <td className="px-2 py-1 text-right">${row.productA.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                      <td className="px-2 py-1 text-right">${row.productB.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                      <td className="px-2 py-1 text-right">${row.productC.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                      <td className="px-2 py-1 text-right font-semibold">${row.total.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                      <td className="px-2 py-1 text-right">
                        <span className={row.growth >= 0 ? "text-green-600" : "text-red-600"}>
                          {row.growth >= 0 ? "+" : ""}{row.growth}%
                        </span>
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
                  <span>Total Annual Revenue:</span>
                  <span className="font-medium text-sky-800">
                    ${filteredData.metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
                  </span>
                </li>
                <li className="flex justify-between items-center">
                  <span>Average Quarterly Growth:</span>
                  <span className="font-medium text-green-600">
                    +{filteredData.metrics.avgQuarterlyGrowth}%
                  </span>
                </li>
                <li className="flex justify-between items-center">
                  <span>Best Performing Product:</span>
                  <span className="font-medium text-green-600">
                    {filteredData.metrics.bestPerformingProduct}
                  </span>
                </li>
                <li className="flex justify-between items-center">
                  <span>Revenue Mix:</span>
                  <div className="flex gap-2">
                    <span className="font-medium text-sky-800">
                      A: {filteredData.metrics.productMix.productA}%
                    </span>
                    <span className="font-medium text-sky-800">
                      B: {filteredData.metrics.productMix.productB}%
                    </span>
                    <span className="font-medium text-sky-800">
                      C: {filteredData.metrics.productMix.productC}%
                    </span>
                  </div>
                </li>
              </ul>

              {filteredData.metrics.insights && (
                <div className="mt-4">
                  <h4 className="text-x font-semibold text-sky-900 mb-2 flex items-center">
                    <FiAlertCircle className="mr-1" /> Revenue Insights
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
                  Revenue Trends
                </h3>
                <div className="text-x text-sky-700 space-y-3">
                  <div className="flex items-start">
                    <div className="p-2 rounded-full mr-3 bg-green-100 text-green-700">
                      <FiTrendingUp size={16} />
                    </div>
                    <div>
                      <p className="font-medium">Consistent Growth</p>
                      <p className="text-black">
                        All products show positive growth each quarter
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="p-2 rounded-full mr-3 bg-blue-100 text-blue-700">
                      <FiAlertCircle size={16} />
                    </div>
                    <div>
                      <p className="font-medium">Product Dominance</p>
                      <p className="text-black">
                        Product A accounts for {filteredData.metrics.productMix.productA}% of total revenue
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="p-2 rounded-full mr-3 bg-purple-100 text-purple-700">
                      <FiTrendingUp size={16} />
                    </div>
                    <div>
                      <p className="font-medium">Best Quarter</p>
                      <p className="text-black">
                        Q4 had highest revenue at ${filteredData.tableData[3].total.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
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

export default CustomRevenueReport;