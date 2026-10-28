import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  FiDownload,
  FiPrinter,
  FiSend,
  FiFilter,
  FiTrendingUp,
  FiTrendingDown,
  FiAlertCircle,
  FiBarChart2,
  FiPieChart,
} from "react-icons/fi";
import { BsStars } from "react-icons/bs";
import { CSVLink } from "react-csv";
import { GrLinkNext } from "react-icons/gr";
import { getDecimalPrecision } from '../../utils/formatters';

const FinancialRatioAnalysis = () => {
  const [drillDownData, setDrillDownData] = useState(null);
  const [filters, setFilters] = useState({
    period: "current",
    entity: "all",
    ratioType: "all",
    customRange: { start: "", end: "" },
  });
  const [showFilters, setShowFilters] = useState(false);
  const [activeInsight, setActiveInsight] = useState(0);
  const [showAIDropdown, setShowAIDropdown] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiHistory, setAiHistory] = useState([]);
  const aiChatbotRef = useRef(null);
  const filtersRef = useRef(null);

  // Sample data for Financial Ratio Analysis
  const ratioData = {
    tableData: [
      { 
        ratio: "Current Ratio", 
        value: 2.5, 
        benchmark: 1.5, 
        trend: "up", 
        category: "Liquidity",
        description: "Measures ability to pay short-term obligations",
        formula: "Current Assets / Current Liabilities"
      },
      { 
        ratio: "Quick Ratio", 
        value: 1.8, 
        benchmark: 1.0, 
        trend: "up", 
        category: "Liquidity",
        description: "Measures ability to meet short-term obligations with most liquid assets",
        formula: "(Current Assets - Inventory) / Current Liabilities"
      },
      { 
        ratio: "Debt-to-Equity", 
        value: 0.8, 
        benchmark: 1.0, 
        trend: "down", 
        category: "Leverage",
        description: "Indicates relative proportion of shareholders' equity and debt",
        formula: "Total Liabilities / Shareholders' Equity"
      },
      { 
        ratio: "Interest Coverage", 
        value: 6.5, 
        benchmark: 4.0, 
        trend: "up", 
        category: "Leverage",
        description: "Measures ability to pay interest on outstanding debt",
        formula: "EBIT / Interest Expense"
      },
      { 
        ratio: "Gross Margin", 
        value: 0.35, 
        benchmark: 0.30, 
        trend: "up", 
        category: "Profitability",
        description: "Shows percentage of revenue that exceeds cost of goods sold",
        formula: "(Revenue - COGS) / Revenue"
      },
      { 
        ratio: "Net Profit Margin", 
        value: 0.18, 
        benchmark: 0.15, 
        trend: "up", 
        category: "Profitability",
        description: "Shows percentage of revenue remaining after all expenses",
        formula: "Net Income / Revenue"
      },
      { 
        ratio: "ROE", 
        value: 0.22, 
        benchmark: 0.18, 
        trend: "up", 
        category: "Profitability",
        description: "Measures profitability relative to shareholders' equity",
        formula: "Net Income / Shareholders' Equity"
      },
      { 
        ratio: "ROA", 
        value: 0.12, 
        benchmark: 0.10, 
        trend: "up", 
        category: "Profitability",
        description: "Measures profitability relative to total assets",
        formula: "Net Income / Total Assets"
      },
      { 
        ratio: "Inventory Turnover", 
        value: 6.0, 
        benchmark: 5.0, 
        trend: "up", 
        category: "Efficiency",
        description: "Shows how many times inventory is sold and replaced",
        formula: "COGS / Average Inventory"
      },
      { 
        ratio: "Receivables Turnover", 
        value: 8.5, 
        benchmark: 7.0, 
        trend: "up", 
        category: "Efficiency",
        description: "Measures how efficiently receivables are collected",
        formula: "Net Credit Sales / Average Accounts Receivable"
      },
    ],
    metrics: {
      liquidityScore: 85,
      leverageScore: 90,
      profitabilityScore: 88,
      efficiencyScore: 82,
      overallScore: 86,
      insights: [
        "Strong liquidity position with current ratio well above benchmark",
        "Conservative capital structure with debt-to-equity below industry average",
        "Profitability ratios consistently outperform industry benchmarks"
      ]
    }
  };

  const handleDrillDown = (rowData) => {
    setDrillDownData({
      title: `${rowData.ratio} Analysis`,
      data: [
        { field: "Current Value", value: rowData.value.toFixed(getDecimalPrecision()) },
        { field: "Industry Benchmark", value: rowData.benchmark.toFixed(getDecimalPrecision()) },
        { field: "Variance", value: `${((rowData.value - rowData.benchmark) / rowData.benchmark * 100).toFixed(getDecimalPrecision())}%`, isPositive: rowData.value > rowData.benchmark },
        { field: "Category", value: rowData.category },
        { field: "Trend", value: rowData.trend === "up" ? "Improving" : "Declining", isPositive: rowData.trend === "up" },
      ],
      details: [
        { field: "Description", value: rowData.description },
        { field: "Calculation Formula", value: rowData.formula },
      ],
      insights: [
        getRatioInsight(rowData),
        "Historical trend shows consistent improvement over past 4 quarters"
      ]
    });
  };

  const getRatioInsight = (rowData) => {
    const variance = ((rowData.value - rowData.benchmark) / rowData.benchmark) * 100;
    
    if (variance > 20) {
      return `${rowData.ratio} significantly outperforms benchmark by ${variance.toFixed(1)}%`;
    } else if (variance > 0) {
      return `${rowData.ratio} exceeds benchmark by ${variance.toFixed(1)}%`;
    } else if (variance < -20) {
      return `${rowData.ratio} significantly underperforms benchmark by ${Math.abs(variance).toFixed(1)}%`;
    } else if (variance < 0) {
      return `${rowData.ratio} slightly below benchmark by ${Math.abs(variance).toFixed(1)}%`;
    } else {
      return `${rowData.ratio} exactly matches benchmark`;
    }
  };

  const renderDrillDownView = () => {
    if (!drillDownData) return null;

    return (
      <div className="bg-white/50 rounded-lg border border-sky-100 p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-sky-900">{drillDownData.title}</h3>
          <button
            onClick={() => setDrillDownData(null)}
            className="text-x bg-sky-100 hover:bg-sky-200 text-sky-800 px-3 py-1 rounded"
          >
            Back to Overview
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="bg-sky-50/50 rounded-lg border border-sky-200 p-4 mb-4">
              <h4 className="text-s font-medium text-sky-800 mb-3">Key Metrics</h4>
              <table className="w-full text-x">
                <tbody>
                  {drillDownData.data.map((item, index) => (
                    <tr key={index} className="border-b border-sky-100">
                      <td className="py-2 font-medium">{item.field}</td>
                      <td className={`py-2 text-right ${
                        item.isPositive ? 'text-green-600' : 
                        item.isPositive === false ? 'text-red-600' : ''
                      }`}>
                        {item.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-sky-50/50 rounded-lg border border-sky-200 p-4">
              <h4 className="text-s font-medium text-sky-800 mb-3">Details</h4>
              <table className="w-full text-x">
                <tbody>
                  {drillDownData.details.map((item, index) => (
                    <tr key={index} className="border-b border-sky-100">
                      <td className="py-2 font-medium">{item.field}</td>
                      <td className="py-2">{item.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-sky-50/50 rounded-lg border border-sky-200 p-4">
            <h4 className="text-s font-medium text-sky-800 mb-3">Insights</h4>
            <div className="space-y-3 text-x">
              {drillDownData.insights.map((insight, index) => (
                <div key={index} className="flex items-start">
                  <div className="p-1 rounded-full mr-2 bg-blue-100 text-blue-700 mt-1">
                    <FiAlertCircle size={12} />
                  </div>
                  <p>{insight}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTable = () => {
    const filteredData = filters.ratioType === "all" 
      ? ratioData.tableData 
      : ratioData.tableData.filter(ratio => ratio.category === filters.ratioType);
    
    return (
      <div className="overflow-y-auto bg-white/50 rounded-lg border border-sky-100">
        <table className="w-full text-x">
          <thead>
            <tr className="bg-sky-100 text-sky-900">
              <th className="px-4 py-2 text-left">Ratio</th>
              <th className="px-4 py-2 text-left">Category</th>
              <th className="px-4 py-2 text-right">Value</th>
              <th className="px-4 py-2 text-right">Benchmark</th>
              <th className="px-4 py-2 text-right">Variance</th>
              <th className="px-4 py-2 text-right">Trend</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, index) => {
              const variance = ((row.value - row.benchmark) / row.benchmark) * 100;
              
              return (
                <tr 
                  key={index} 
                  className="border-b border-sky-200 hover:bg-sky-50 cursor-pointer"
                  onClick={() => handleDrillDown(row)}
                >
                  <td className="px-4 py-2 font-medium">{row.ratio}</td>
                  <td className="px-4 py-2">{row.category}</td>
                  <td className="px-4 py-2 text-right">{row.value.toFixed(getDecimalPrecision())}</td>
                  <td className="px-4 py-2 text-right">{row.benchmark.toFixed(getDecimalPrecision())}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={variance >= 0 ? "text-green-600" : "text-red-600"}>
                      {variance >= 0 ? "+" : ""}{variance.toFixed(getDecimalPrecision())}%
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {row.trend === "up" ? (
                      <span className="text-green-600 flex items-center justify-end">
                        <FiTrendingUp className="mr-1" /> Improving
                      </span>
                    ) : (
                      <span className="text-red-600 flex items-center justify-end">
                        <FiTrendingDown className="mr-1" /> Declining
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderKeyMetrics = () => {
    return (
      <div className="space-y-3">
        <h3 className="text-s font-semibold text-sky-900 mb-2">Key Metrics</h3>
        <ul className="text-s text-black space-y-2">
          <li className="flex justify-between items-center">
            <span>Liquidity Score:</span>
            <span className="font-medium text-green-600">
              {ratioData.metrics.liquidityScore}/100
            </span>
          </li>
          <li className="flex justify-between items-center">
            <span>Leverage Score:</span>
            <span className="font-medium text-green-600">
              {ratioData.metrics.leverageScore}/100
            </span>
          </li>
          <li className="flex justify-between items-center">
            <span>Profitability Score:</span>
            <span className="font-medium text-green-600">
              {ratioData.metrics.profitabilityScore}/100
            </span>
          </li>
          <li className="flex justify-between items-center">
            <span>Efficiency Score:</span>
            <span className="font-medium text-green-600">
              {ratioData.metrics.efficiencyScore}/100
            </span>
          </li>
          <li className="flex justify-between items-center">
            <span>Overall Financial Health:</span>
            <span className="font-medium text-green-600">
              {ratioData.metrics.overallScore}/100
            </span>
          </li>
        </ul>

        {ratioData.metrics.insights && (
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
                {ratioData.metrics.insights[activeInsight]}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>
    );
  };

  const handleSendAIQuery = () => {
    if (aiInput.trim()) {
      const response = `AI Insight: ${aiInput} (mock response showing analysis of financial ratios)`;
      setAiHistory([...aiHistory, { query: aiInput, response }]);
      setAiInput("");
      setShowAIDropdown(false);
    }
  };

  useEffect(() => {
    if (ratioData.metrics.insights?.length > 1) {
      const interval = setInterval(() => {
        setActiveInsight((prev) => (prev + 1) % ratioData.metrics.insights.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, []);

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
            <h1 className="text-lg font-bold text-white">Financial Ratio Analysis</h1>
            <p className="text-sky-100 text-x">
              Liquidity, Profitability, and Efficiency Ratios
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
              Ratio Analysis
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
                  {drillDownData ? drillDownData.title : "Financial Ratio Analysis"}
                </h2>
                <p className="text-sky-600 text-s mb-2">
                  {drillDownData ? "Detailed ratio analysis" : "Key financial ratios compared to industry benchmarks"}
                </p>
              </div>
            </div>
          </div>

          {!drillDownData && (
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
                              Ratio Category
                            </label>
                            <select
                              value={filters.ratioType}
                              onChange={(e) =>
                                setFilters({
                                  ...filters,
                                  ratioType: e.target.value,
                                })
                              }
                              className="w-full p-2 border border-sky-300 rounded text-x">
                              <option value="all">All Categories</option>
                              <option value="Liquidity">Liquidity</option>
                              <option value="Leverage">Leverage</option>
                              <option value="Profitability">Profitability</option>
                              <option value="Efficiency">Efficiency</option>
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
                  data={ratioData.tableData}
                  filename={"financial-ratios.csv"}
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
                        Ask about Financial Ratios
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
          )}

          <div className="mb-6">
            {drillDownData ? renderDrillDownView() : renderTable()}
          </div>

          {!drillDownData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                {renderKeyMetrics()}
              </div>
              <div>
                <div className="bg-sky-50/50 p-4 rounded-lg border border-sky-200">
                  <h3 className="text-s font-semibold text-sky-900 mb-3">
                    Financial Health Summary
                  </h3>
                  <div className="text-x text-sky-700 space-y-3">
                    <div className="flex items-start">
                      <div className="p-2 rounded-full mr-3 bg-green-100 text-green-700">
                        <FiTrendingUp size={16} />
                      </div>
                      <div>
                        <p className="font-medium">Strong Liquidity</p>
                        <p className="text-black">
                          Current ratio of 2.5 indicates excellent ability to cover short-term obligations
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <div className="p-2 rounded-full mr-3 bg-blue-100 text-blue-700">
                        <FiAlertCircle size={16} />
                      </div>
                      <div>
                        <p className="font-medium">Conservative Leverage</p>
                        <p className="text-black">
                          Debt-to-equity of 0.8 shows balanced capital structure
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <div className="p-2 rounded-full mr-3 bg-purple-100 text-purple-700">
                        <FiTrendingUp size={16} />
                      </div>
                      <div>
                        <p className="font-medium">Profitability Strength</p>
                        <p className="text-black">
                          ROE of 22% indicates effective use of shareholder equity
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default FinancialRatioAnalysis;