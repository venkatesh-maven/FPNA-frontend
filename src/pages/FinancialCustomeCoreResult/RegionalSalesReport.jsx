import React, { useState, useRef, useEffect } from 'react';
import { FiDownload, FiFilter, FiChevronDown, FiTrendingUp, FiTrendingDown, FiAlertCircle } from 'react-icons/fi';
import { BsStars } from 'react-icons/bs';
import { CSVLink } from 'react-csv';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { GrLinkNext } from 'react-icons/gr';
import { getDecimalPrecision } from '../../utils/formatters';

// Sample data for Regional Sales Report
const regionalData = {
  tableData: [
    { region: 'North America', q1: 120000, q2: 135000, q3: 150000, q4: 165000, total: 570000, growth: 37.5 },
    { region: 'Europe', q1: 90000, q2: 95000, q3: 100000, q4: 105000, total: 390000, growth: 16.7 },
    { region: 'Asia', q1: 60000, q2: 75000, q3: 90000, q4: 105000, total: 330000, growth: 75 },
    { region: 'South America', q1: 30000, q2: 35000, q3: 40000, q4: 45000, total: 150000, growth: 50 },
  ],
  metrics: {
    totalSales: 1440000,
    avgGrowth: 44.8,
    topRegion: 'North America',
    topRegionPercentage: 39.6,
    fastestGrowing: 'Asia',
    regionalMix: {
      na: 39.6,
      eu: 27.1,
      asia: 22.9,
      sa: 10.4
    },
    insights: [
      'North America contributes 39.6% of total sales',
      'Asia shows fastest growth at 75% year-over-year',
      'All regions show consistent quarterly growth'
    ]
  }
};

const timePeriods = [
  { id: "all", name: "All Quarters" },
  { id: "current", name: "Current Quarter" },
  { id: "last", name: "Last Quarter" },
  { id: "ytd", name: "Year to Date" },
];

const RegionalSalesReport = () => {
  const [filters, setFilters] = useState({
    period: "all",
    region: "all",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [activeInsight, setActiveInsight] = useState(0);
  const [showAIDropdown, setShowAIDropdown] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiHistory, setAiHistory] = useState([]);
  const aiChatbotRef = useRef(null);
  const filtersRef = useRef(null);

  const filteredData = regionalData;

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
      const response = `AI Insight: ${aiInput} (mock response showing analysis of regional sales trends)`;
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
            <h1 className="text-lg font-bold text-white">Regional Sales Report</h1>
            <p className="text-sky-100 text-x">
              Analyze sales performance by geographic region
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
              Regional Sales
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
                  Regional Sales Performance
                </h2>
                <p className="text-sky-600 text-s mb-2">
                  Quarterly sales breakdown by geographic region
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
                filename={"regional-sales.csv"}
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
                      Ask about Regional Sales
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
                    <th className="px-2 py-1 text-left">Region</th>
                    <th className="px-2 py-1 text-right">Q1</th>
                    <th className="px-2 py-1 text-right">Q2</th>
                    <th className="px-2 py-1 text-right">Q3</th>
                    <th className="px-2 py-1 text-right">Q4</th>
                    <th className="px-2 py-1 text-right">Total</th>
                    <th className="px-2 py-1 text-right">YoY Growth %</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.tableData.map((row, index) => (
                    <tr key={index} className="border-b border-sky-200 hover:bg-sky-50">
                      <td className="px-2 py-1 font-medium">{row.region}</td>
                      <td className="px-2 py-1 text-right">${row.q1.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                      <td className="px-2 py-1 text-right">${row.q2.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                      <td className="px-2 py-1 text-right">${row.q3.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                      <td className="px-2 py-1 text-right">${row.q4.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
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
                  <span>Total Annual Sales:</span>
                  <span className="font-medium text-sky-800">
                    ${filteredData.metrics.totalSales.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
                  </span>
                </li>
                <li className="flex justify-between items-center">
                  <span>Average Growth:</span>
                  <span className="font-medium text-green-600">
                    +{filteredData.metrics.avgGrowth}%
                  </span>
                </li>
                <li className="flex justify-between items-center">
                  <span>Top Performing Region:</span>
                  <span className="font-medium text-green-600">
                    {filteredData.metrics.topRegion} ({filteredData.metrics.topRegionPercentage}%)
                  </span>
                </li>
                <li className="flex justify-between items-center">
                  <span>Fastest Growing Region:</span>
                  <span className="font-medium text-green-600">
                    {filteredData.metrics.fastestGrowing} (+{filteredData.tableData.find(r => r.region === filteredData.metrics.fastestGrowing).growth}%)
                  </span>
                </li>
              </ul>

              {filteredData.metrics.insights && (
                <div className="mt-4">
                  <h4 className="text-x font-semibold text-sky-900 mb-2 flex items-center">
                    <FiAlertCircle className="mr-1" /> Regional Insights
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
                  Regional Analysis
                </h3>
                <div className="text-x text-sky-700 space-y-3">
                  <div className="flex items-start">
                    <div className="p-2 rounded-full mr-3 bg-green-100 text-green-700">
                      <FiTrendingUp size={16} />
                    </div>
                    <div>
                      <p className="font-medium">Market Leader</p>
                      <p className="text-black">
                        {filteredData.metrics.topRegion} dominates with {filteredData.metrics.topRegionPercentage}% of sales
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="p-2 rounded-full mr-3 bg-blue-100 text-blue-700">
                      <FiAlertCircle size={16} />
                    </div>
                    <div>
                      <p className="font-medium">Growth Potential</p>
                      <p className="text-black">
                        {filteredData.metrics.fastestGrowing} shows highest growth at +{filteredData.tableData.find(r => r.region === filteredData.metrics.fastestGrowing).growth}%
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="p-2 rounded-full mr-3 bg-purple-100 text-purple-700">
                      <FiTrendingUp size={16} />
                    </div>
                    <div>
                      <p className="font-medium">Consistent Performance</p>
                      <p className="text-black">
                        All regions show quarter-over-quarter growth
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

export default RegionalSalesReport;