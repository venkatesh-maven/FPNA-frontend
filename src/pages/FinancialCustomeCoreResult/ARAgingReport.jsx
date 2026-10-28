import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  FiDownload,
  FiPrinter,
  FiSend,
  FiFilter,
  FiAlertCircle,
  FiUser,
  FiDollarSign,
  FiClock,
} from "react-icons/fi";
import { BsStars } from "react-icons/bs";
import { CSVLink } from "react-csv";
import { GrLinkNext } from "react-icons/gr";
import { getDecimalPrecision } from '../../utils/formatters';

const ARAgingReport = () => {
  const [drillDownData, setDrillDownData] = useState(null);
  const [filters, setFilters] = useState({
    period: "current",
    entity: "all",
    agingMethod: "invoiceDate",
    customRange: { start: "", end: "" },
  });
  const [showFilters, setShowFilters] = useState(false);
  const [activeInsight, setActiveInsight] = useState(0);
  const [showAIDropdown, setShowAIDropdown] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiHistory, setAiHistory] = useState([]);

  // Sample data for AR Aging report
  const arAgingData = {
    tableData: [
      { customer: "Acme Corp", current: 12000, days30: 5000, days60: 3000, days90: 2000, over90: 1000, total: 23000 },
      { customer: "Globex Inc", current: 8000, days30: 3000, days60: 1500, days90: 1000, over90: 500, total: 14000 },
      { customer: "Initech", current: 15000, days30: 2000, days60: 1000, days90: 500, over90: 0, total: 18500 },
      { customer: "Umbrella Corp", current: 5000, days30: 2000, days60: 1500, days90: 1000, over90: 2000, total: 11500 },
      { customer: "Wayne Ent", current: 20000, days30: 5000, days60: 3000, days90: 1000, over90: 500, total: 29500 },
    ],
    summary: {
      current: 60000,
      days30: 17000,
      days60: 10000,
      days90: 5500,
      over90: 4000,
      total: 96500,
      percentOver90: 4.1,
      dso: 45,
      insights: [
        "90+ days overdue accounts represent 4.1% of total receivables",
        "Current accounts show healthy 62.2% of total AR",
        "Focus needed on 31-60 days bracket to prevent further aging"
      ]
    }
  };

  const handleDrillDown = (rowData) => {
    setDrillDownData({
      title: `${rowData.customer} AR Details`,
      data: [
        { field: "Current", value: formatCurrency(rowData.current), isCurrent: true },
        { field: "1-30 Days", value: formatCurrency(rowData.days30), isOverdue: rowData.days30 > 0 },
        { field: "31-60 Days", value: formatCurrency(rowData.days60), isOverdue: rowData.days60 > 0 },
        { field: "61-90 Days", value: formatCurrency(rowData.days90), isOverdue: rowData.days90 > 0 },
        { field: "90+ Days", value: formatCurrency(rowData.over90), isOverdue: rowData.over90 > 0 },
        { field: "Total Outstanding", value: formatCurrency(rowData.total), isTotal: true },
      ],
      insights: [
        getCustomerInsight(rowData),
        "Payment history shows consistent on-time payments until recent months",
        "Contact: John Smith (john.smith@company.com) | Phone: (555) 123-4567"
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

  const getCustomerInsight = (rowData) => {
    const overdue = rowData.days30 + rowData.days60 + rowData.days90 + rowData.over90;
    const percentOverdue = (overdue / rowData.total) * 100;
    
    if (percentOverdue > 30) {
      return `High overdue amount (${percentOverdue.toFixed(getDecimalPrecision())}% of total) requires immediate attention`;
    } else if (percentOverdue > 15) {
      return `Moderate overdue amount (${percentOverdue.toFixed(getDecimalPrecision())}% of total) needs follow-up`;
    } else if (overdue > 0) {
      return `Minor overdue amount (${percentOverdue.toFixed(getDecimalPrecision())}% of total)`;
    } else {
      return "All payments current - no overdue amounts";
    }
  };

  const renderTable = () => {
    return (
      <div className="overflow-y-auto bg-white/50 rounded-lg border border-sky-100">
        <table className="w-full text-x">
          <thead>
            <tr className="bg-sky-100 text-sky-900">
              <th className="px-4 py-2 text-left">Customer</th>
              <th className="px-4 py-2 text-right">Current</th>
              <th className="px-4 py-2 text-right">1-30 Days</th>
              <th className="px-4 py-2 text-right">31-60 Days</th>
              <th className="px-4 py-2 text-right">61-90 Days</th>
              <th className="px-4 py-2 text-right">90+ Days</th>
              <th className="px-4 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {arAgingData.tableData.map((row, index) => (
              <tr 
                key={index} 
                className="border-b border-sky-200 hover:bg-sky-50 cursor-pointer"
                onClick={() => handleDrillDown(row)}
              >
                <td className="px-4 py-2 font-medium">{row.customer}</td>
                <td className="px-4 py-2 text-right text-green-600">{formatCurrency(row.current)}</td>
                <td className={`px-4 py-2 text-right ${row.days30 > 0 ? "text-yellow-600" : "text-gray-500"}`}>
                  {formatCurrency(row.days30)}
                </td>
                <td className={`px-4 py-2 text-right ${row.days60 > 0 ? "text-orange-600" : "text-gray-500"}`}>
                  {formatCurrency(row.days60)}
                </td>
                <td className={`px-4 py-2 text-right ${row.days90 > 0 ? "text-red-600" : "text-gray-500"}`}>
                  {formatCurrency(row.days90)}
                </td>
                <td className={`px-4 py-2 text-right ${row.over90 > 0 ? "text-red-700 font-semibold" : "text-gray-500"}`}>
                  {formatCurrency(row.over90)}
                </td>
                <td className="px-4 py-2 text-right font-medium">{formatCurrency(row.total)}</td>
              </tr>
            ))}
            <tr className="bg-gray-100 font-semibold">
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2 text-right text-green-600">{formatCurrency(arAgingData.summary.current)}</td>
              <td className="px-4 py-2 text-right text-yellow-600">{formatCurrency(arAgingData.summary.days30)}</td>
              <td className="px-4 py-2 text-right text-orange-600">{formatCurrency(arAgingData.summary.days60)}</td>
              <td className="px-4 py-2 text-right text-red-600">{formatCurrency(arAgingData.summary.days90)}</td>
              <td className="px-4 py-2 text-right text-red-700">{formatCurrency(arAgingData.summary.over90)}</td>
              <td className="px-4 py-2 text-right">{formatCurrency(arAgingData.summary.total)}</td>
            </tr>
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
            <span>Total Receivables:</span>
            <span className="font-medium text-sky-800">
              {formatCurrency(arAgingData.summary.total)}
            </span>
          </li>
          <li className="flex justify-between items-center">
            <span>Overdue ({">"}30 days):</span>
            <span className="font-medium text-red-600">
              {formatCurrency(arAgingData.summary.days30 + arAgingData.summary.days60 + arAgingData.summary.days90 + arAgingData.summary.over90)}
            </span>
          </li>
          <li className="flex justify-between items-center">
            <span>90+ Days Overdue:</span>
            <span className="font-medium text-red-700">
              {formatCurrency(arAgingData.summary.over90)} ({arAgingData.summary.percentOver90}%)
            </span>
          </li>
          <li className="flex justify-between items-center">
            <span>Days Sales Outstanding (DSO):</span>
            <span className="font-medium text-sky-800">
              {arAgingData.summary.dso} days
            </span>
          </li>
        </ul>

        {arAgingData.summary.insights && (
          <div className="mt-4">
            <h4 className="text-x font-semibold text-sky-900 mb-2 flex items-center">
              <FiAlertCircle className="mr-1" /> Collections Insights
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
                {arAgingData.summary.insights[activeInsight]}
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
            Back to AR Aging
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-sky-50 rounded-lg p-4">
            <h4 className="text-s font-medium text-sky-800 mb-3">Aging Details</h4>
            <table className="w-full text-s">
              <tbody>
                {drillDownData.data.map((item, index) => (
                  <tr key={index} className="border-b border-sky-100">
                    <td className="py-2 font-medium text-sky-900">{item.field}</td>
                    <td className={`py-2 text-right ${
                      item.isCurrent ? "text-green-600" : 
                      item.isOverdue ? "text-red-600" : 
                      item.isTotal ? "font-semibold text-sky-800" : "text-gray-700"
                    }`}>
                      {item.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="bg-sky-50 rounded-lg p-4">
            <h4 className="text-s font-medium text-sky-800 mb-3">Customer Insights</h4>
            <ul className="space-y-3 text-s">
              {drillDownData.insights.map((insight, index) => (
                <li key={index} className="flex items-start">
                  <div className="flex-shrink-0 h-5 w-5 text-sky-500">
                    {index === 2 ? <FiUser className="h-full w-full" /> : <FiAlertCircle className="h-full w-full" />}
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
      const response = `AI analysis for AR Aging: ${aiInput} (This is a mock response showing how AI insights would appear)`;
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
    if (arAgingData.summary.insights?.length > 1) {
      const interval = setInterval(() => {
        setActiveInsight((prev) => (prev + 1) % arAgingData.summary.insights.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [arAgingData.summary.insights]);

  return (
    <div className="min-h-screen bg-sky-50 p-6">
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">AR Aging Report</h1>
            <p className="text-sky-100 text-x">
              Outstanding receivables by aging period
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
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">AR Aging Report</span>
            </div>
          </li>
        </ol>
      </nav>

      <div className="bg-white p-6 rounded-xl shadow-md">
        <div className="mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-semibold text-sky-900 flex items-center gap-2">
                {drillDownData ? drillDownData.title : "Accounts Receivable Aging Report"}
              </h2>
              <p className="text-sky-600 text-s mb-2">
                {drillDownData ? "Detailed view of customer receivables" : "Outstanding invoices categorized by days overdue"}
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
                            Period
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
                            <option value="current">Current</option>
                            <option value="previous">Previous Month</option>
                            <option value="quarter">Quarter-to-Date</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-x font-medium text-sky-700 mb-1">
                            Aging Method
                          </label>
                          <select
                            value={filters.agingMethod}
                            onChange={(e) =>
                              setFilters({
                                ...filters,
                                agingMethod: e.target.value,
                              })
                            }
                            className="w-full p-2 border border-sky-300 rounded text-x"
                          >
                            <option value="invoiceDate">Invoice Date</option>
                            <option value="dueDate">Due Date</option>
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
                data={arAgingData.tableData}
                filename={"ar-aging-report.csv"}
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
                      Ask about AR Aging
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
                Collections Analysis
              </h3>
              <div className="text-x text-sky-700 space-y-3">
                <div className="flex items-start">
                  <div className="p-2 rounded-full mr-3 bg-green-100 text-green-700">
                    <FiDollarSign size={16} />
                  </div>
                  <div>
                    <p className="font-medium">Current Receivables</p>
                    <p className="text-black">
                      {formatCurrency(arAgingData.summary.current)} ({((arAgingData.summary.current / arAgingData.summary.total) * 100).toFixed(getDecimalPrecision())}% of total)
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="p-2 rounded-full mr-3 bg-yellow-100 text-yellow-700">
                    <FiAlertCircle size={16} />
                  </div>
                  <div>
                    <p className="font-medium">1-30 Days Overdue</p>
                    <p className="text-black">
                      {formatCurrency(arAgingData.summary.days30)} ({((arAgingData.summary.days30 / arAgingData.summary.total) * 100).toFixed(getDecimalPrecision())}% of total)
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="p-2 rounded-full mr-3 bg-red-100 text-red-700">
                    <FiClock size={16} />
                  </div>
                  <div>
                    <p className="font-medium">Critical Overdue ({">"}60 days)</p>
                    <p className="text-black">
                      {formatCurrency(arAgingData.summary.days60 + arAgingData.summary.days90 + arAgingData.summary.over90)} ({((arAgingData.summary.days60 + arAgingData.summary.days90 + arAgingData.summary.over90) / arAgingData.summary.total * 100).toFixed(getDecimalPrecision())}% of total)
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

export default ARAgingReport;