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
  FiDollarSign,
  FiPieChart,
} from "react-icons/fi";
import { BsStars } from "react-icons/bs";
import { CSVLink } from "react-csv";
import { GrLinkNext } from "react-icons/gr";
import { getDecimalPrecision } from '../../utils/formatters';

const BudgetVsActuals = () => {
  const [drillDownData, setDrillDownData] = useState(null);
  const [filters, setFilters] = useState({
    period: "quarterly",
    entity: "all",
    view: "summary",
    customRange: { start: "", end: "" },
  });
  const [showFilters, setShowFilters] = useState(false);
  const [activeInsight, setActiveInsight] = useState(0);
  const [showAIDropdown, setShowAIDropdown] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiHistory, setAiHistory] = useState([]);

  // Sample data for Budget vs Actuals report
  const budgetData = {
    quarterly: {
      tableData: [
        { category: "Revenue", Q1Budget: 50000, Q1Actual: 52000, Q2Budget: 55000, Q2Actual: 58000, Q3Budget: 60000, Q3Actual: 62000, Q4Budget: 65000, Q4Actual: 68000, isHeader: true },
        { category: "Product Sales", Q1Budget: 40000, Q1Actual: 42000, Q2Budget: 44000, Q2Actual: 46000, Q3Budget: 48000, Q3Actual: 50000, Q4Budget: 52000, Q4Actual: 54000 },
        { category: "Service Revenue", Q1Budget: 10000, Q1Actual: 10000, Q2Budget: 11000, Q2Actual: 12000, Q3Budget: 12000, Q3Actual: 12000, Q4Budget: 13000, Q4Actual: 14000 },
        
        { category: "Expenses", Q1Budget: 35000, Q1Actual: 34000, Q2Budget: 37000, Q2Actual: 36000, Q3Budget: 39000, Q3Actual: 38000, Q4Budget: 42000, Q4Actual: 41000, isHeader: true },
        { category: "Salaries", Q1Budget: 20000, Q1Actual: 19500, Q2Budget: 21000, Q2Actual: 20500, Q3Budget: 22000, Q3Actual: 21500, Q4Budget: 23000, Q4Actual: 22500 },
        { category: "Marketing", Q1Budget: 5000, Q1Actual: 4500, Q2Budget: 6000, Q2Actual: 5500, Q3Budget: 7000, Q3Actual: 6500, Q4Budget: 8000, Q4Actual: 7500 },
        { category: "Operations", Q1Budget: 10000, Q1Actual: 10000, Q2Budget: 10000, Q2Actual: 10000, Q3Budget: 10000, Q3Actual: 10000, Q4Budget: 11000, Q4Actual: 11000 },
        
        { category: "Net Income", Q1Budget: 15000, Q1Actual: 18000, Q2Budget: 18000, Q2Actual: 22000, Q3Budget: 21000, Q3Actual: 24000, Q4Budget: 23000, Q4Actual: 27000, isTotal: true },
      ],
      metrics: {
        totalRevenueVariance: 13000,
        totalExpenseVariance: -3000,
        netIncomeVariance: 16000,
        revenueVariancePercentage: 5.7,
        expenseVariancePercentage: -2.3,
        netIncomeVariancePercentage: 20.8,
        insights: [
          "Revenue exceeded budget by 5.7% overall, led by strong product sales",
          "Expenses came in 2.3% under budget due to cost control measures",
          "Net income outperformed budget by 20.8% for the fiscal year"
        ]
      }
    },
    monthly: {
      tableData: [
        { category: "Revenue", M1Budget: 15000, M1Actual: 16000, M2Budget: 16000, M2Actual: 17000, M3Budget: 17000, M3Actual: 18000, M4Budget: 18000, M4Actual: 19000, isHeader: true },
        { category: "Product Sales", M1Budget: 12000, M1Actual: 13000, M2Budget: 13000, M2Actual: 14000, M3Budget: 14000, M3Actual: 15000, M4Budget: 15000, M4Actual: 16000 },
        { category: "Service Revenue", M1Budget: 3000, M1Actual: 3000, M2Budget: 3000, M2Actual: 3000, M3Budget: 3000, M3Actual: 3000, M4Budget: 3000, M4Actual: 3000 },
        
        { category: "Expenses", M1Budget: 10000, M1Actual: 9500, M2Budget: 10500, M2Actual: 10000, M3Budget: 11000, M3Actual: 10500, M4Budget: 11500, M4Actual: 11000, isHeader: true },
        { category: "Salaries", M1Budget: 6000, M1Actual: 6000, M2Budget: 6000, M2Actual: 6000, M3Budget: 6000, M3Actual: 6000, M4Budget: 6000, M4Actual: 6000 },
        { category: "Marketing", M1Budget: 2000, M1Actual: 1500, M2Budget: 2500, M2Actual: 2000, M3Budget: 3000, M3Actual: 2500, M4Budget: 3500, M4Actual: 3000 },
        { category: "Operations", M1Budget: 2000, M1Actual: 2000, M2Budget: 2000, M2Actual: 2000, M3Budget: 2000, M3Actual: 2000, M4Budget: 2000, M4Actual: 2000 },
        
        { category: "Net Income", M1Budget: 5000, M1Actual: 6500, M2Budget: 5500, M2Actual: 7000, M3Budget: 6000, M3Actual: 7500, M4Budget: 6500, M4Actual: 8000, isTotal: true },
      ],
      metrics: {
        totalRevenueVariance: 4000,
        totalExpenseVariance: -1500,
        netIncomeVariance: 5500,
        revenueVariancePercentage: 6.1,
        expenseVariancePercentage: -3.6,
        netIncomeVariancePercentage: 23.9,
        insights: [
          "Monthly revenue consistently exceeded budget by 6-7%",
          "Marketing expenses came in under budget each month",
          "Net income outperformed budget by average of 23.9% monthly"
        ]
      }
    }
  };

  const handleDrillDown = (rowData) => {
    if (rowData.isHeader || rowData.isTotal) return;
    
    const quarters = ["Q1", "Q2", "Q3", "Q4"];
    const months = ["M1", "M2", "M3", "M4"];
    const periods = filters.period === "quarterly" ? quarters : months;
    
    const data = periods.map(period => ({
      period: period.replace("M", "Month ").replace("Q", "Quarter "),
      budget: rowData[`${period}Budget`],
      actual: rowData[`${period}Actual`],
      variance: rowData[`${period}Actual`] - rowData[`${period}Budget`],
      variancePercentage: ((rowData[`${period}Actual`] - rowData[`${period}Budget`]) / rowData[`${period}Budget`] * 100
    )}));
    
    setDrillDownData({
      title: `${rowData.category} Budget vs Actuals`,
      data: data,
      insights: [
        getDrillDownInsight(rowData),
        "Detailed transaction history available upon further drill down"
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
    const quarters = ["Q1", "Q2", "Q3", "Q4"];
    const months = ["M1", "M2", "M3", "M4"];
    const periods = filters.period === "quarterly" ? quarters : months;
    
    const totalBudget = periods.reduce((sum, period) => sum + (rowData[`${period}Budget`] || 0), 0);
    const totalActual = periods.reduce((sum, period) => sum + (rowData[`${period}Actual`] || 0), 0);
    const variance = totalActual - totalBudget;
    const variancePercentage = (variance / totalBudget) * 100;
    
    if (variance > 0) {
      return `${rowData.category} exceeded budget by ${formatCurrency(variance)} (${variancePercentage.toFixed(getDecimalPrecision())}%)`;
    } else if (variance < 0) {
      return `${rowData.category} under budget by ${formatCurrency(Math.abs(variance))} (${Math.abs(variancePercentage).toFixed(getDecimalPrecision())}%)`;
    } else {
      return `${rowData.category} exactly matched budget`;
    }
  };

  const renderTable = () => {
    const currentData = budgetData[filters.period].tableData;
    const periods = filters.period === "quarterly" 
      ? ["Q1", "Q2", "Q3", "Q4"] 
      : ["Month 1", "Month 2", "Month 3", "Month 4"];
    
    return (
      <div className="overflow-y-auto bg-white/50 rounded-lg border border-sky-100">
        <table className="w-full text-x">
          <thead>
            <tr className="bg-sky-100 text-sky-900">
              <th className="px-4 py-2 text-left">Category</th>
              {periods.map((period, idx) => (
                <React.Fragment key={idx}>
                  <th className="px-2 py-2 text-right">Budget</th>
                  <th className="px-2 py-2 text-right">Actual</th>
                  <th className="px-2 py-2 text-right">Variance</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentData.map((row, index) => {
              const isHeader = row.isHeader;
              const isTotal = row.isTotal;
              
              return (
                <tr 
                  key={index}
                  className={`border-b border-sky-200 ${
                    isHeader ? "bg-gray-100 font-semibold" : 
                    isTotal ? "bg-blue-50 font-bold" : 
                    "hover:bg-sky-50 cursor-pointer"
                  }`}
                  onClick={() => !isHeader && !isTotal && handleDrillDown(row)}
                >
                  <td className={`px-4 py-2 ${
                    isHeader ? "text-gray-700" : 
                    isTotal ? "text-blue-700" : "text-gray-900"
                  }`}>
                    {row.category}
                  </td>
                  {periods.map((_, colIdx) => {
                    const period = filters.period === "quarterly" ? `Q${colIdx + 1}` : `M${colIdx + 1}`;
                    const budget = row[`${period}Budget`];
                    const actual = row[`${period}Actual`];
                    const variance = actual - budget;
                    const variancePercentage = (variance / budget) * 100;
                    
                    return (
                      <React.Fragment key={colIdx}>
                        <td className="px-2 py-2 text-right text-gray-600">
                          {formatCurrency(budget)}
                        </td>
                        <td className="px-2 py-2 text-right text-gray-800">
                          {formatCurrency(actual)}
                        </td>
                        <td className={`px-2 py-2 text-right ${
                          variance >= 0 ? "text-green-600" : "text-red-600"
                        }`}>
                          {formatCurrency(variance)} ({variance >= 0 ? "+" : ""}{variancePercentage.toFixed(getDecimalPrecision())}%)
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderKeyMetrics = () => {
    const metrics = budgetData[filters.period].metrics;
    
    return (
      <div className="space-y-3">
        <h3 className="text-s font-semibold text-sky-900 mb-2">Key Metrics</h3>
        <ul className="text-s text-black space-y-2">
          <li className="flex justify-between items-center">
            <span>Revenue Variance:</span>
            <span className="font-medium text-green-600">
              {formatCurrency(metrics.totalRevenueVariance)} ({metrics.revenueVariancePercentage >= 0 ? "+" : ""}{metrics.revenueVariancePercentage}%)
              <FiTrendingUp className="inline ml-1" />
            </span>
          </li>
          <li className="flex justify-between items-center">
            <span>Expense Variance:</span>
            <span className="font-medium text-red-600">
              {formatCurrency(metrics.totalExpenseVariance)} ({metrics.expenseVariancePercentage >= 0 ? "+" : ""}{metrics.expenseVariancePercentage}%)
              <FiTrendingDown className="inline ml-1" />
            </span>
          </li>
          <li className="flex justify-between items-center">
            <span>Net Income Variance:</span>
            <span className="font-medium text-green-600">
              {formatCurrency(metrics.netIncomeVariance)} ({metrics.netIncomeVariancePercentage >= 0 ? "+" : ""}{metrics.netIncomeVariancePercentage}%)
              <FiTrendingUp className="inline ml-1" />
            </span>
          </li>
        </ul>

        {metrics.insights && (
          <div className="mt-4">
            <h4 className="text-x font-semibold text-sky-900 mb-2 flex items-center">
              <FiAlertCircle className="mr-1" /> Budget Insights
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
          <button 
            onClick={() => setDrillDownData(null)}
            className="text-s text-sky-600 hover:text-sky-800"
          >
            Back to Budget Report
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-sky-50 rounded-lg p-4">
            <h4 className="text-s font-medium text-sky-800 mb-3">Period Details</h4>
            <table className="w-full text-s">
              <thead>
                <tr className="border-b border-sky-200">
                  <th className="px-2 py-2 text-left">Period</th>
                  <th className="px-2 py-2 text-right">Budget</th>
                  <th className="px-2 py-2 text-right">Actual</th>
                  <th className="px-2 py-2 text-right">Variance</th>
                </tr>
              </thead>
              <tbody>
                {drillDownData.data.map((item, index) => (
                  <tr key={index} className="border-b border-sky-100">
                    <td className="px-2 py-2 font-medium text-sky-900">{item.period}</td>
                    <td className="px-2 py-2 text-right text-gray-600">{formatCurrency(item.budget)}</td>
                    <td className="px-2 py-2 text-right text-gray-800">{formatCurrency(item.actual)}</td>
                    <td className={`px-2 py-2 text-right ${
                      item.variance >= 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {formatCurrency(item.variance)} ({item.variance >= 0 ? "+" : ""}{item.variancePercentage.toFixed(getDecimalPrecision())}%)
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
      const response = `AI analysis for Budget vs Actuals: ${aiInput} (This is a mock response showing how AI insights would appear)`;
      setAiHistory(prev => [...prev, { query: aiInput, response }]);
      setAiInput("");
      setShowAIDropdown(false);
    }
  };

  const aiChatbotRef = useRef(null);
  const filtersRef = useRef(null);

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

  // Rotate insights every 5 seconds
  useEffect(() => {
    const insights = budgetData[filters.period].metrics.insights;
    if (insights?.length > 1) {
      const interval = setInterval(() => {
        setActiveInsight((prev) => (prev + 1) % insights.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [filters.period]);

  return (
    <div className="min-h-screen bg-sky-50 p-6">
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Budget vs Actuals</h1>
            <p className="text-sky-100 text-x">
              Variance analysis between budgeted and actual figures
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 hover:text-sky-900 transition-colors duration-200"
          >
            <FiDownload className="text-sky-50 hover:text-sky-900" />
            <span className="text-sky-50 hover:text-sky-900">Export</span>
          </button>
        </div>
      </div>

      <nav className="flex mb-6" aria-label="Breadcrumb">
        <ol className="inline-flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse">
          <li className="inline-flex items-center">
            <Link to="/financial-core-reports" className="inline-flex items-center text-s font-medium text-sky-900 hover:text-blue-600">
              Financial Reports
            </Link>
          </li>
          <li aria-current="page">
            <div className="flex items-center">
              <svg className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 9 4-4-4-4"/>
              </svg>
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Budget vs Actuals</span>
            </div>
          </li>
        </ol>
      </nav>

      <div className="bg-white p-6 rounded-xl shadow-md">
        <div className="mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-semibold text-sky-900 flex items-center gap-2">
                {drillDownData ? drillDownData.title : "Budget vs Actuals Report"}
              </h2>
              <p className="text-sky-600 text-s mb-2">
                {drillDownData ? "Detailed view of selected item" : "Comparison of budgeted amounts to actual performance"}
              </p>
            </div>
            <Link to="/financial-core-reports" className="text-sky-500 hover:text-sky-700 mt-1">
              <button
                type="button"
                className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200"
              >
                Back to Reports
                <GrLinkNext className="ml-1 w-4 h-4 hover:w-5 hover:h-5 transition-all" />
              </button>
            </Link>
          </div>
        </div>

        {!drillDownData && (
          <div className="mb-4 flex flex-wrap gap-2 justify-end items-center">
            <div className="flex gap-2">
              <div className="relative" ref={filtersRef}>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center bg-sky-100 hover:bg-sky-200 text-sky-800 rounded-lg px-3 py-2 text-x"
                >
                  <FiFilter className="mr-2" /> Filter
                </button>

                <AnimatePresence>
                  {showFilters && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute z-10 mt-2 w-64 bg-white rounded-lg shadow-lg border border-sky-200 p-4 right-0"
                    >
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
                            className="w-full p-2 border border-sky-300 rounded text-x"
                          >
                            <option value="quarterly">Quarterly</option>
                            <option value="monthly">Monthly</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-x font-medium text-sky-700 mb-1">
                            View
                          </label>
                          <select
                            value={filters.view}
                            onChange={(e) =>
                              setFilters({
                                ...filters,
                                view: e.target.value,
                              })
                            }
                            className="w-full p-2 border border-sky-300 rounded text-x"
                          >
                            <option value="summary">Summary View</option>
                            <option value="detailed">Detailed View</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-x font-medium text-sky-700 mb-1">
                            Entity
                          </label>
                          <select
                            value={filters.entity}
                            onChange={(e) =>
                              setFilters({
                                ...filters,
                                entity: e.target.value,
                              })
                            }
                            className="w-full p-2 border border-sky-300 rounded text-x"
                          >
                            <option value="all">All Entities</option>
                            <option value="ny">New York Branch</option>
                            <option value="sf">San Francisco Branch</option>
                            <option value="tx">Texas Branch</option>
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
                data={budgetData[filters.period].tableData}
                filename={"budget-vs-actuals.csv"}
                className="flex items-center px-3 py-2 bg-sky-100 text-sky-800 rounded-lg text-x hover:bg-sky-200"
              >
                <FiDownload className="mr-1" /> CSV
              </CSVLink>
              <button
                onClick={() => window.print()}
                className="flex items-center px-3 py-2 bg-sky-100 text-sky-800 rounded-lg text-x hover:bg-sky-200"
              >
                <FiPrinter className="mr-1" /> Print
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowAIDropdown(true)}
                  className="flex items-center px-3 py-2 text-sky-800 rounded-lg bg-sky-100 hover:bg-sky-200 text-x"
                >
                  <BsStars className="mr-1" /> Ask AI
                </button>

                {showAIDropdown && (
                  <motion.div
                    ref={aiChatbotRef}
                    className="absolute z-50 mt-2 right-0 w-80 bg-white/90 backdrop-blur-md rounded-lg shadow-lg border border-sky-200 p-2"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <h1 className="text-s font-semibold text-sky-900 mb-2">
                      Ask about Budget vs Actuals
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
                        onClick={handleSendAIQuery}
                        className="p-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                        disabled={!aiInput.trim()}
                      >
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>{!drillDownData && renderKeyMetrics()}</div>
          <div>
            <div className="bg-sky-50/50 p-4 rounded-lg border border-sky-200">
              <h3 className="text-s font-semibold text-sky-900 mb-3">
                Performance Analysis
              </h3>
              <div className="text-x text-sky-700 space-y-3">
                <div className="flex items-start">
                  <div className="p-2 rounded-full mr-3 bg-green-100 text-green-700">
                    <FiTrendingUp size={16} />
                  </div>
                  <div>
                    <p className="font-medium">Revenue Performance</p>
                    <p className="text-black">
                      Exceeded budget by {budgetData[filters.period].metrics.revenueVariancePercentage}% overall
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="p-2 rounded-full mr-3 bg-blue-100 text-blue-700">
                    <FiPieChart size={16} />
                  </div>
                  <div>
                    <p className="font-medium">Expense Management</p>
                    <p className="text-black">
                      Came in under budget by {Math.abs(budgetData[filters.period].metrics.expenseVariancePercentage)}% through cost controls
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="p-2 rounded-full mr-3 bg-purple-100 text-purple-700">
                    <FiDollarSign size={16} />
                  </div>
                  <div>
                    <p className="font-medium">Profitability</p>
                    <p className="text-black">
                      Net income outperformed budget by {budgetData[filters.period].metrics.netIncomeVariancePercentage}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BudgetVsActuals;