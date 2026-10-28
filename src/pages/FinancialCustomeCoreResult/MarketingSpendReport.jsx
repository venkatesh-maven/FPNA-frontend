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
  FiUsers,
} from "react-icons/fi";
import { BsStars } from "react-icons/bs";
import { CSVLink } from "react-csv";
import { GrLinkNext } from "react-icons/gr";
import { getDecimalPrecision } from '../../utils/formatters';

const MarketingSpendReport = () => {
  const [drillDownData, setDrillDownData] = useState(null);
  const [filters, setFilters] = useState({
    channelType: "all",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [activeInsight, setActiveInsight] = useState(0);
  const [showAIDropdown, setShowAIDropdown] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiHistory, setAiHistory] = useState([]);

  // Sample data for Marketing Spend Efficiency report
  const marketingData = {
    tableData: [
      { id: 1, channel: "Google Ads", type: "Digital", budget: 75000, spend: 72000, leads: 1500, cpl: 48.00 },
      { id: 2, channel: "LinkedIn Campaigns", type: "Digital", budget: 50000, spend: 55000, leads: 550, cpl: 100.00 },
      { id: 3, channel: "Content Syndication", type: "Content", budget: 40000, spend: 40000, leads: 800, cpl: 50.00 },
      { id: 4, channel: "SEO & Organic", type: "Content", budget: 30000, spend: 30000, leads: 2500, cpl: 12.00 },
      { id: 5, channel: "Trade Shows & Events", type: "Events", budget: 100000, spend: 115000, leads: 350, cpl: 328.57 },
      { id: 6, channel: "Webinars", type: "Events", budget: 25000, spend: 22000, leads: 900, cpl: 24.44 },
    ],
    metrics: {
      totalBudget: 320000,
      totalSpend: 334000,
      totalLeads: 6600,
      blendedCPL: 50.61,
      mostEffectiveChannel: "SEO & Organic",
      leastEffectiveChannel: "Trade Shows & Events",
      insights: [
        "SEO & Organic is the most efficient channel with a CPL of $12.00.",
        "Trade Shows are the most expensive channel at $328.57 per lead. A review of event ROI is recommended.",
        "AI suggests reallocating 20% of the Trade Show budget to Webinars, which could generate an additional 500 leads at a much lower CPL."
      ]
    }
  };

  const handleDrillDown = (rowData) => {
    setDrillDownData({
      title: `${rowData.channel} Performance Details`,
      data: [
        { field: "Channel Type", value: rowData.type },
        { field: "Budget", value: formatCurrency(rowData.budget) },
        { field: "Actual Spend", value: formatCurrency(rowData.spend) },
        { field: "Variance", value: formatCurrency(rowData.budget - rowData.spend), isPositive: (rowData.budget - rowData.spend) >= 0 },
        { field: "Leads Generated", value: rowData.leads.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }) },
        { field: "Cost Per Lead (CPL)", value: formatCurrency(rowData.cpl), isTotal: true },
      ],
      insights: [
        getDrillDownInsight(rowData),
        "Lead quality from this channel is rated 'High' based on sales conversion data.",
      ]
    });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: getDecimalPrecision()
    }).format(value);
  };
  
  const getDrillDownInsight = (rowData) => {
    if (rowData.cpl < marketingData.metrics.blendedCPL) {
      return `This channel's CPL of ${formatCurrency(rowData.cpl)} is significantly lower than the blended average of ${formatCurrency(marketingData.metrics.blendedCPL)}, indicating high efficiency.`;
    } else {
      return `This channel's CPL of ${formatCurrency(rowData.cpl)} is higher than the blended average. Consider optimizing campaign targeting to improve efficiency.`;
    }
  };

  const getCSVData = () => {
    return marketingData.tableData.map(row => ({
      Channel: row.channel,
      Type: row.type,
      Budget: row.budget,
      "Actual Spend": row.spend,
      "Leads Generated": row.leads,
      "Cost Per Lead (CPL)": row.cpl.toFixed(getDecimalPrecision()),
    }));
  };

  const renderTable = () => {
    const filteredTableData = filters.channelType === 'all' 
      ? marketingData.tableData 
      : marketingData.tableData.filter(row => row.type === filters.channelType);

    return (
      <div className="overflow-y-auto bg-white/50 rounded-lg border border-sky-100 max-h-[30rem]">
        <table className="w-full text-x">
          <thead className="sticky top-0 bg-sky-100 text-sky-900">
            <tr>
              <th className="px-4 py-2 text-left">Marketing Channel</th>
              <th className="px-4 py-2 text-right">Budget</th>
              <th className="px-4 py-2 text-right">Actual Spend</th>
              <th className="px-4 py-2 text-right">Leads Generated</th>
              <th className="px-4 py-2 text-right">Cost Per Lead (CPL)</th>
            </tr>
          </thead>
          <tbody>
            {filteredTableData.map((row, index) => (
              <tr 
                key={index} 
                className="border-b border-sky-200 hover:bg-sky-50 cursor-pointer"
                onClick={() => handleDrillDown(row)}
              >
                <td className="px-4 py-2 font-medium">
                  <div>{row.channel}</div>
                  <div className="text-gray-500 text-x">{row.type}</div>
                </td>
                <td className="px-4 py-2 text-right">{formatCurrency(row.budget)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(row.spend)}</td>
                <td className="px-4 py-2 text-right font-semibold">{row.leads.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                <td className={`px-4 py-2 text-right font-semibold ${row.cpl < marketingData.metrics.blendedCPL ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(row.cpl)}
                </td>
              </tr>
            ))}
            <tr className="bg-gray-100 font-bold sticky bottom-0">
              <td className="px-4 py-2">Total / Blended</td>
              <td className="px-4 py-2 text-right">{formatCurrency(marketingData.metrics.totalBudget)}</td>
              <td className="px-4 py-2 text-right">{formatCurrency(marketingData.metrics.totalSpend)}</td>
              <td className="px-4 py-2 text-right">{marketingData.metrics.totalLeads.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
              <td className="px-4 py-2 text-right">{formatCurrency(marketingData.metrics.blendedCPL)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const renderKeyMetrics = () => {
    const { metrics } = marketingData;
    return (
      <div className="space-y-3">
        <h3 className="text-s font-semibold text-sky-900 mb-2">Key Metrics</h3>
        <ul className="text-s text-black space-y-2">
          <li className="flex justify-between items-center">
            <span>Total Leads Generated:</span>
            <span className="font-medium text-sky-800">{metrics.totalLeads.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</span>
          </li>
          <li className="flex justify-between items-center">
            <span>Blended Cost Per Lead:</span>
            <span className="font-medium text-sky-800">{formatCurrency(metrics.blendedCPL)}</span>
          </li>
          <li className="flex justify-between items-center">
            <span>Most Effective Channel:</span>
            <span className="font-medium text-green-600">{metrics.mostEffectiveChannel}</span>
          </li>
          <li className="flex justify-between items-center">
            <span>Least Effective Channel:</span>
            <span className="font-medium text-red-600">{metrics.leastEffectiveChannel}</span>
          </li>
        </ul>

        {metrics.insights && (
          <div className="mt-4">
            <h4 className="text-x font-semibold text-sky-900 mb-2 flex items-center">
              <FiAlertCircle className="mr-1" /> Marketing Insights
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
            Back to Spend Report
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-sky-50 rounded-lg p-4">
            <h4 className="text-s font-medium text-sky-800 mb-3">Channel Performance</h4>
            <table className="w-full text-s">
              <tbody>
                {drillDownData.data.map((item, index) => (
                  <tr key={index} className="border-b border-sky-100">
                    <td className="py-2 font-medium text-sky-900">{item.field}</td>
                    <td className={`py-2 text-right ${item.isPositive ? "text-green-600" : item.isPositive === false ? "text-red-600" : (item.isTotal ? "font-semibold text-sky-800" : "text-gray-700")}`}>
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
      const response = `AI analysis for Marketing Spend: ${aiInput} (This is a mock response)`;
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
    if (marketingData.metrics.insights?.length > 1) {
      const interval = setInterval(() => {
        setActiveInsight((prev) => (prev + 1) % marketingData.metrics.insights.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [marketingData.metrics.insights]);

  return (
    <div className="min-h-screen bg-sky-50 p-6">
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Marketing Spend Efficiency Report</h1>
            <p className="text-sky-100 text-x">Analyzes the ROI of marketing expenses by channel.</p>
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
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Marketing Spend Efficiency</span>
            </div>
          </li>
        </ol>
      </nav>

      <div className="bg-white p-6 rounded-xl shadow-md">
        <div className="mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-semibold text-sky-900 flex items-center gap-2">
                {drillDownData ? drillDownData.title : "Marketing Channel Performance"}
              </h2>
              <p className="text-sky-600 text-s mb-2">
                {drillDownData ? "Detailed view of selected channel" : "Budget vs. Spend and lead generation efficiency"}
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
                          <label className="block text-x font-medium text-sky-700 mb-1">Channel Type</label>
                          <select value={filters.channelType} onChange={(e) => setFilters(f => ({...f, channelType: e.target.value}))} className="w-full p-2 border border-sky-300 rounded text-x">
                            <option value="all">All Types</option>
                            <option value="Digital">Digital</option>
                            <option value="Content">Content</option>
                            <option value="Events">Events</option>
                          </select>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
            </div>
            <CSVLink data={getCSVData()} filename={"marketing-spend-report.csv"} className="flex items-center px-3 py-2 bg-sky-100 text-sky-800 rounded-lg text-x hover:bg-sky-200">
              <FiDownload className="mr-1" /> CSV
            </CSVLink>
            <div className="relative">
              <button onClick={() => setShowAIDropdown(true)} className="flex items-center px-3 py-2 text-sky-800 rounded-lg bg-sky-100 hover:bg-sky-200 text-x">
                <BsStars className="mr-1" /> Ask AI
              </button>
              {showAIDropdown && (
                  <motion.div ref={aiChatbotRef} className="absolute z-50 mt-2 right-0 w-80 bg-white/90 backdrop-blur-md rounded-lg shadow-lg border border-sky-200 p-2" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                    <h1 className="text-s font-semibold text-sky-900 mb-2">Ask about Marketing Spend</h1>
                    <div className="flex items-center space-x-2 mb-4">
                      <input type="text" value={aiInput} onChange={(e) => setAiInput(e.target.value)} placeholder="e.g., Why is Trade Show CPL high?" className="w-full p-2 border border-sky-300 rounded-lg bg-sky-50 text-sky-900 text-s focus:outline-none focus:ring-2 focus:ring-sky-500" onClick={(e) => e.stopPropagation()} />
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

export default MarketingSpendReport;