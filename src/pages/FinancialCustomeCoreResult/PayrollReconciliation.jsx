import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  FiDownload,
  FiPrinter,
  FiSend,
  FiFilter,
  FiAlertCircle,
  FiCheckCircle,
  FiUsers,
} from "react-icons/fi";
import { BsStars } from "react-icons/bs";
import { CSVLink } from "react-csv";
import { GrLinkNext } from "react-icons/gr";
import { getDecimalPrecision } from '../../utils/formatters';

const PayrollReconciliation = () => {
  const [drillDownData, setDrillDownData] = useState(null);
  const [filters, setFilters] = useState({
    period: "monthly",
    department: "all",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [activeInsight, setActiveInsight] = useState(0);
  const [showAIDropdown, setShowAIDropdown] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiHistory, setAiHistory] = useState([]);

  // Sample data for Payroll Reconciliation report
  const payrollData = {
    tableData: [
      { period: "Jan", grossWages: 250000, taxes: 50000, benefits: 25000, netPay: 175000, disbursed: 175000 },
      { period: "Feb", grossWages: 252000, taxes: 50400, benefits: 25200, netPay: 176400, disbursed: 176400 },
      { period: "Mar", grossWages: 255000, taxes: 51000, benefits: 25500, netPay: 178500, disbursed: 178250 },
      { period: "Apr", grossWages: 258000, taxes: 51600, benefits: 25800, netPay: 180600, disbursed: 180600 },
      { period: "May", grossWages: 260000, taxes: 52000, benefits: 26000, netPay: 182000, disbursed: 182000 },
      { period: "Jun", grossWages: 261000, taxes: 52200, benefits: 26100, netPay: 182700, disbursed: 182700 },
    ],
    drillDown: {
        Mar: [
            { department: "Sales", gross: 80000, taxes: 16000, benefits: 8000, net: 56000 },
            { department: "R&D", gross: 95000, taxes: 19000, benefits: 9500, net: 66500 },
            { department: "Marketing", gross: 40000, taxes: 8000, benefits: 4000, net: 28000 },
            { department: "G&A", gross: 40000, taxes: 8000, benefits: 4000, net: 28000 },
        ]
    },
    metrics: {
      totalGross: 1536000,
      totalTaxes: 307200,
      totalBenefits: 153600,
      totalNet: 1075200,
      totalDisbursed: 1074950,
      totalVariance: 250,
      insights: [
        "Overall variance of $250 is within the acceptable threshold of 0.05%. Reconciliation successful.",
        "A minor variance of $250 was detected in March. AI suggests reviewing manual bonus payouts for that period.",
        "Tax withholding rates are consistent with employee records and federal guidelines."
      ]
    }
  };

  const handleDrillDown = (rowData) => {
    const drillData = payrollData.drillDown[rowData.period];
    if (!drillData) return;

    setDrillDownData({
      title: `Departmental Payroll Breakdown for ${rowData.period}`,
      data: drillData,
      insights: [
        `The $250 variance in ${rowData.period} appears to originate from the R&D department.`,
        "Check for off-cycle payments or one-time reimbursements for R&D staff."
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

  const getCSVData = () => {
    return payrollData.tableData.map(row => ({
        Period: row.period,
        "Gross Wages": row.grossWages,
        Taxes: row.taxes,
        Benefits: row.benefits,
        "Net Pay (Calculated)": row.netPay,
        "Amount Disbursed": row.disbursed,
        Variance: row.netPay - row.disbursed,
    }));
  };

  const renderTable = () => {
    return (
      <div className="overflow-y-auto bg-white/50 rounded-lg border border-sky-100 max-h-[30rem]">
        <table className="w-full text-x">
          <thead className="sticky top-0 bg-sky-100 text-sky-900">
            <tr>
              <th className="px-4 py-2 text-left">Period</th>
              <th className="px-4 py-2 text-right">Gross Wages</th>
              <th className="px-4 py-2 text-right">Taxes Withheld</th>
              <th className="px-4 py-2 text-right">Benefits Deducted</th>
              <th className="px-4 py-2 text-right">Net Pay (Calculated)</th>
              <th className="px-4 py-2 text-right">Amount Disbursed</th>
              <th className="px-4 py-2 text-right">Variance</th>
            </tr>
          </thead>
          <tbody>
            {payrollData.tableData.map((row, index) => {
                const variance = row.netPay - row.disbursed;
                return (
                    <tr 
                        key={index} 
                        className="border-b border-sky-200 hover:bg-sky-50 cursor-pointer"
                        onClick={() => handleDrillDown(row)}
                    >
                        <td className="px-4 py-2 font-medium">{row.period}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(row.grossWages)}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{formatCurrency(row.taxes)}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{formatCurrency(row.benefits)}</td>
                        <td className="px-4 py-2 text-right font-semibold">{formatCurrency(row.netPay)}</td>
                        <td className="px-4 py-2 text-right font-semibold">{formatCurrency(row.disbursed)}</td>
                        <td className={`px-4 py-2 text-right font-bold ${variance === 0 ? "text-green-600" : "text-red-600"}`}>
                            {variance === 0 ? <FiCheckCircle className="inline-block"/> : formatCurrency(variance)}
                        </td>
                    </tr>
                )
            })}
             <tr className="bg-gray-100 font-semibold sticky bottom-0">
                <td className="px-4 py-2">Total</td>
                <td className="px-4 py-2 text-right">{formatCurrency(payrollData.metrics.totalGross)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(payrollData.metrics.totalTaxes)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(payrollData.metrics.totalBenefits)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(payrollData.metrics.totalNet)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(payrollData.metrics.totalDisbursed)}</td>
                <td className={`px-4 py-2 text-right ${payrollData.metrics.totalVariance === 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(payrollData.metrics.totalVariance)}
                </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const renderKeyMetrics = () => {
    const { metrics } = payrollData;
    return (
      <div className="space-y-3">
        <h3 className="text-s font-semibold text-sky-900 mb-2">Key Metrics</h3>
        <ul className="text-s text-black space-y-2">
          <li className="flex justify-between items-center">
            <span>Total Gross Payroll:</span>
            <span className="font-medium text-sky-800">{formatCurrency(metrics.totalGross)}</span>
          </li>
          <li className="flex justify-between items-center">
            <span>Total Disbursed:</span>
            <span className="font-medium text-sky-800">{formatCurrency(metrics.totalDisbursed)}</span>
          </li>
          <li className="flex justify-between items-center">
            <span>Total Reconciliation Variance:</span>
            <span className={`font-medium ${metrics.totalVariance === 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(metrics.totalVariance)}
            </span>
          </li>
        </ul>

        {metrics.insights && (
          <div className="mt-4">
            <h4 className="text-x font-semibold text-sky-900 mb-2 flex items-center">
              <FiAlertCircle className="mr-1" /> Reconciliation Insights
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
            Back to Reconciliation Summary
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-sky-50 rounded-lg p-4">
            <h4 className="text-s font-medium text-sky-800 mb-3">Department Breakdown</h4>
            <table className="w-full text-s">
                 <thead className="text-x text-gray-500 uppercase">
                    <tr>
                        <th className="py-2 text-left">Department</th>
                        <th className="py-2 text-right">Gross</th>
                        <th className="py-2 text-right">Net</th>
                    </tr>
                 </thead>
              <tbody>
                {drillDownData.data.map((item, index) => (
                  <tr key={index} className="border-b border-sky-100">
                    <td className="py-2 font-medium text-sky-900">{item.department}</td>
                    <td className="py-2 text-right text-gray-700">{formatCurrency(item.gross)}</td>
                    <td className="py-2 text-right font-semibold">{formatCurrency(item.net)}</td>
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
      const response = `AI analysis for Payroll: ${aiInput} (This is a mock response)`;
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
    if (payrollData.metrics.insights?.length > 1) {
      const interval = setInterval(() => {
        setActiveInsight((prev) => (prev + 1) % payrollData.metrics.insights.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [payrollData.metrics.insights]);

  return (
    <div className="min-h-screen bg-sky-50 p-6">
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Payroll Reconciliation Report</h1>
            <p className="text-sky-100 text-x">Compares payroll disbursements with financial records for accuracy.</p>
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
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Payroll Reconciliation</span>
            </div>
          </li>
        </ol>
      </nav>

      <div className="bg-white p-6 rounded-xl shadow-md">
        <div className="mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-semibold text-sky-900 flex items-center gap-2">
                {drillDownData ? drillDownData.title : "Payroll Reconciliation Summary"}
              </h2>
              <p className="text-sky-600 text-s mb-2">
                {drillDownData ? "Detailed breakdown of payroll components" : "Summary of payroll vs. disbursements"}
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
                          <label className="block text-x font-medium text-sky-700 mb-1">Period</label>
                          <select value={filters.period} onChange={(e) => setFilters(f => ({...f, period: e.target.value}))} className="w-full p-2 border border-sky-300 rounded text-x">
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                          </select>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
            </div>
            <CSVLink data={getCSVData()} filename={"payroll-reconciliation.csv"} className="flex items-center px-3 py-2 bg-sky-100 text-sky-800 rounded-lg text-x hover:bg-sky-200">
              <FiDownload className="mr-1" /> CSV
            </CSVLink>
            <div className="relative">
              <button onClick={() => setShowAIDropdown(true)} className="flex items-center px-3 py-2 text-sky-800 rounded-lg bg-sky-100 hover:bg-sky-200 text-x">
                <BsStars className="mr-1" /> Ask AI
              </button>
              {showAIDropdown && (
                  <motion.div ref={aiChatbotRef} className="absolute z-50 mt-2 right-0 w-80 bg-white/90 backdrop-blur-md rounded-lg shadow-lg border border-sky-200 p-2" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                    <h1 className="text-s font-semibold text-sky-900 mb-2">Ask about Payroll</h1>
                    <div className="flex items-center space-x-2 mb-4">
                      <input type="text" value={aiInput} onChange={(e) => setAiInput(e.target.value)} placeholder="e.g., Explain the variance in March" className="w-full p-2 border border-sky-300 rounded-lg bg-sky-50 text-sky-900 text-s focus:outline-none focus:ring-2 focus:ring-sky-500" onClick={(e) => e.stopPropagation()} />
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

export default PayrollReconciliation;