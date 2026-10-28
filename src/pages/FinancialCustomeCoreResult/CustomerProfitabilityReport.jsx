import React, { useState, useRef, useEffect } from 'react';
import { CSVLink } from 'react-csv';
import { FiDownload, FiPrinter, FiSend, FiFilter, FiTrendingUp, FiTrendingDown, FiAlertCircle, FiDollarSign, FiInfo } from 'react-icons/fi';
import { BsStars } from 'react-icons/bs';
import { Tooltip } from 'react-tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { getDecimalPrecision } from '../../utils/formatters';

const CustomerProfitabilityReport = () => {
  // Sample data for the report
  const customerData = [
    {
      id: 1,
      customer: 'Acme Corporation',
      revenue: 250000,
      cost: 150000,
      profit: 100000,
      margin: 40.0,
      rank: 1,
      industry: 'Manufacturing',
      region: 'North America',
      contact: 'John Smith',
      lastOrder: '2023-05-15',
      ytdRevenue: 750000,
      ytdProfit: 280000,
      ytdMargin: 37.3,
      lifetimeValue: 1200000,
      segments: ['High Value', 'Strategic'],
      insights: [
        'Top performing customer with consistent growth',
        'High margin products account for 65% of sales',
        'Potential for additional service offerings'
      ]
    },
    {
      id: 2,
      customer: 'Globex Inc',
      revenue: 180000,
      cost: 120000,
      profit: 60000,
      margin: 33.3,
      rank: 2,
      industry: 'Technology',
      region: 'Europe',
      contact: 'Sarah Johnson',
      lastOrder: '2023-05-20',
      ytdRevenue: 520000,
      ytdProfit: 160000,
      ytdMargin: 30.8,
      lifetimeValue: 950000,
      segments: ['Strategic', 'Growth'],
      insights: [
        'Strong growth potential in European markets',
        'Responds well to targeted promotions',
        'High customer satisfaction scores'
      ]
    },
    {
      id: 3,
      customer: 'Initech',
      revenue: 150000,
      cost: 105000,
      profit: 45000,
      margin: 30.0,
      rank: 3,
      industry: 'Financial Services',
      region: 'North America',
      contact: 'Michael Lee',
      lastOrder: '2023-04-28',
      ytdRevenue: 420000,
      ytdProfit: 125000,
      ytdMargin: 29.8,
      lifetimeValue: 800000,
      segments: ['Stable', 'Service-heavy'],
      insights: [
        'Consistent performer with steady demand',
        'High service requirements impact margins',
        'Potential to upsell premium services'
      ]
    },
    {
      id: 4,
      customer: 'Umbrella Corp',
      revenue: 120000,
      cost: 90000,
      profit: 30000,
      margin: 25.0,
      rank: 4,
      industry: 'Healthcare',
      region: 'Asia',
      contact: 'Dr. Emma Zhang',
      lastOrder: '2023-05-10',
      ytdRevenue: 350000,
      ytdProfit: 85000,
      ytdMargin: 24.3,
      lifetimeValue: 600000,
      segments: ['Emerging', 'High Potential'],
      insights: [
        'Fastest growing customer in Asia region',
        'Lower margins due to competitive pricing',
        'Opportunity to increase order frequency'
      ]
    },
    {
      id: 5,
      customer: 'Stark Industries',
      revenue: 80000,
      cost: 64000,
      profit: 16000,
      margin: 20.0,
      rank: 5,
      industry: 'Aerospace',
      region: 'North America',
      contact: 'Tony Stark',
      lastOrder: '2023-03-15',
      ytdRevenue: 220000,
      ytdProfit: 45000,
      ytdMargin: 20.5,
      lifetimeValue: 500000,
      segments: ['Legacy', 'Low Growth'],
      insights: [
        'Declining order volume year-over-year',
        'High maintenance requirements',
        'Consider account review for profitability'
      ]
    }
  ];

  // Filter options
  const regions = ['All Regions', 'North America', 'Europe', 'Asia', 'Other'];
  const industries = ['All Industries', 'Manufacturing', 'Technology', 'Financial Services', 'Healthcare', 'Aerospace'];
  const segments = ['All Segments', 'High Value', 'Strategic', 'Growth', 'Stable', 'Emerging', 'Legacy'];

  // State management
  const [filters, setFilters] = useState({
    region: 'All Regions',
    industry: 'All Industries',
    segment: 'All Segments',
    minRevenue: '',
    minMargin: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [activeInsight, setActiveInsight] = useState(0);
  const [sortConfig, setSortConfig] = useState({ key: 'rank', direction: 'asc' });
  const [showAIDropdown, setShowAIDropdown] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiHistory, setAiHistory] = useState([]);
  const aiChatbotRef = useRef(null);
  const filtersRef = useRef(null);

  // Apply filters to data
  const filteredData = customerData.filter(customer => {
    return (
      (filters.region === 'All Regions' || customer.region === filters.region) &&
      (filters.industry === 'All Industries' || customer.industry === filters.industry) &&
      (filters.segment === 'All Segments' || customer.segments.includes(filters.segment)) &&
      (!filters.minRevenue || customer.revenue >= Number(filters.minRevenue)) &&
      (!filters.minMargin || customer.margin >= Number(filters.minMargin))
  )});

  // Sort data
  const sortedData = [...filteredData].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  // Handle sort request
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Rotate insights every 5 seconds for the selected customer
  useEffect(() => {
    if (selectedCustomer?.insights?.length > 1) {
      const interval = setInterval(() => {
        setActiveInsight((prev) => (prev + 1) % selectedCustomer.insights.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedCustomer]);

  // Handle click outside for dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (aiChatbotRef.current && !aiChatbotRef.current.contains(event.target)) {
        setShowAIDropdown(false);
      }
      if (filtersRef.current && !filtersRef.current.contains(event.target)) {
        setShowFilters(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle AI query submission
  const handleSendAIQuery = () => {
    if (aiInput.trim()) {
      const response = `AI analysis for customer profitability: ${aiInput} (This is a mock response. In a real app, this would connect to an AI service.)`;
      setAiHistory([...aiHistory, { query: aiInput, response }]);
      setAiInput('');
    }
  };

  // Format currency values
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: getDecimalPrecision(),
      maximumFractionDigits: getDecimalPrecision()
    }).format(value);
  };

  // Format percentage values
  const formatPercentage = (value) => {
    return `${value.toFixed(getDecimalPrecision())}%`;
  };

  // Calculate summary metrics
  const summaryMetrics = {
    totalRevenue: filteredData.reduce((sum, customer) => sum + customer.revenue, 0),
    totalProfit: filteredData.reduce((sum, customer) => sum + customer.profit, 0),
    avgMargin: filteredData.length > 0 
      ? (filteredData.reduce((sum, customer) => sum + customer.margin, 0) / filteredData.length)
      : 0,
    topCustomer: filteredData.length > 0 ? filteredData[0].customer : 'N/A',
    bottomCustomer: filteredData.length > 0 ? filteredData[filteredData.length - 1].customer : 'N/A'
  };

  // Prepare CSV data
  const csvData = [
    ['Customer', 'Revenue', 'Cost', 'Profit', 'Margin', 'Rank', 'Industry', 'Region', 'Last Order'],
    ...filteredData.map(customer => [
      customer.customer,
      customer.revenue,
      customer.cost,
      customer.profit,
      customer.margin,
      customer.rank,
      customer.industry,
      customer.region,
      customer.lastOrder
    ])
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Customer Profitability Report</h1>
            <p className="text-sky-100 text-x">Analyze profitability by customer to identify valuable relationships</p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 transition-colors duration-200"
          >
            <FiDownload className="text-sky-50" />
            <span className="text-sky-50">Export</span>
          </button>
        </div>
      </div>

      {/* Breadcrumbs */}
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
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Customer Profitability Dashboard</span>
            </div>
          </li>
        </ol>
      </nav>
      {/* Main Content */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {/* Report Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Customer Profitability Analysis</h2>
              <p className="text-gray-600 mt-1">
                {filteredData.length} customers matching current filters
              </p>
            </div>
            <div className="flex gap-2">
              <div className="relative" ref={filtersRef}>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 rounded-lg px-3 py-2 text-s hover:bg-gray-50"
                >
                  <FiFilter className="text-gray-500" />
                  Filters
                </button>

                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute z-10 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-4 right-0"
                  >
                    <div className="space-y-4">
                      <div>
                        <label className="block text-s font-medium text-gray-700 mb-1">Region</label>
                        <select
                          value={filters.region}
                          onChange={(e) => setFilters({...filters, region: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded text-s"
                        >
                          {regions.map(region => (
                            <option key={region} value={region}>{region}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-s font-medium text-gray-700 mb-1">Industry</label>
                        <select
                          value={filters.industry}
                          onChange={(e) => setFilters({...filters, industry: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded text-s"
                        >
                          {industries.map(industry => (
                            <option key={industry} value={industry}>{industry}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-s font-medium text-gray-700 mb-1">Segment</label>
                        <select
                          value={filters.segment}
                          onChange={(e) => setFilters({...filters, segment: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded text-s"
                        >
                          {segments.map(segment => (
                            <option key={segment} value={segment}>{segment}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-s font-medium text-gray-700 mb-1">Min Revenue ($)</label>
                        <input
                          type="number"
                          value={filters.minRevenue}
                          onChange={(e) => setFilters({...filters, minRevenue: e.target.value})}
                          placeholder="Any"
                          className="w-full p-2 border border-gray-300 rounded text-s"
                        />
                      </div>

                      <div>
                        <label className="block text-s font-medium text-gray-700 mb-1">Min Margin (%)</label>
                        <input
                          type="number"
                          value={filters.minMargin}
                          onChange={(e) => setFilters({...filters, minMargin: e.target.value})}
                          placeholder="Any"
                          className="w-full p-2 border border-gray-300 rounded text-s"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              <CSVLink
                data={csvData}
                filename="customer-profitability-report.csv"
                className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 rounded-lg px-3 py-2 text-s hover:bg-gray-50"
              >
                <FiDownload className="text-gray-500" />
                CSV
              </CSVLink>

              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 rounded-lg px-3 py-2 text-s hover:bg-gray-50"
              >
                <FiPrinter className="text-gray-500" />
                Print
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowAIDropdown(!showAIDropdown)}
                  className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 rounded-lg px-3 py-2 text-s hover:bg-gray-50"
                >
                  <BsStars className="text-gray-500" />
                  Ask AI
                </button>

                {showAIDropdown && (
                  <motion.div
                    ref={aiChatbotRef}
                    className="absolute z-10 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 p-4 right-0"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <h3 className="text-s font-semibold text-gray-800 mb-2">Ask about Customer Profitability</h3>
                    <div className="flex items-center space-x-2 mb-4">
                      <input
                        type="text"
                        value={aiInput}
                        onChange={(e) => setAiInput(e.target.value)}
                        placeholder="Ask AI about this report..."
                        className="w-full p-2 border border-gray-300 rounded text-s focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={handleSendAIQuery}
                        className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={!aiInput.trim()}
                      >
                        <FiSend className="w-4 h-4" />
                      </button>
                    </div>
                    {aiHistory.length > 0 && (
                      <div className="space-y-2 max-h-40 overflow-y-auto text-x text-gray-700">
                        {aiHistory.map((entry, index) => (
                          <div key={index} className="p-2 bg-gray-50 rounded">
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
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-gray-50 border-b border-gray-200">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-s font-medium text-gray-500">Total Revenue</h3>
              <FiDollarSign className="text-blue-500" />
            </div>
            <p className="text-2xl font-bold mt-1 text-gray-800">
              {formatCurrency(summaryMetrics.totalRevenue)}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-s font-medium text-gray-500">Total Profit</h3>
              <FiTrendingUp className="text-green-500" />
            </div>
            <p className="text-2xl font-bold mt-1 text-gray-800">
              {formatCurrency(summaryMetrics.totalProfit)}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-s font-medium text-gray-500">Avg. Margin</h3>
              <div className={`p-1 rounded-full ${summaryMetrics.avgMargin >= 30 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {summaryMetrics.avgMargin >= 30 ? <FiTrendingUp /> : <FiTrendingDown />}
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-gray-800">
              {formatPercentage(summaryMetrics.avgMargin)}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-s font-medium text-gray-500">Top Customer</h3>
              <span className="px-2 py-1 text-x font-medium bg-blue-100 text-blue-800 rounded-full">
                #1
              </span>
            </div>
            <p className="text-lg font-semibold mt-1 text-gray-800 truncate">
              {summaryMetrics.topCustomer}
            </p>
          </div>
        </div>

        {/* Main Report Content */}
        <div className="p-6">
          {selectedCustomer ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-800">
                  {selectedCustomer.customer} - Detailed Analysis
                </h3>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-s text-blue-600 hover:text-blue-800"
                >
                  Back to Report
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="text-s font-medium text-gray-700 mb-3">Financial Metrics</h4>
                  <div className="space-y-4">
                    <div>
                      <p className="text-x text-gray-500">Current Period Revenue</p>
                      <p className="text-lg font-semibold text-gray-800">
                        {formatCurrency(selectedCustomer.revenue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-x text-gray-500">Current Period Profit</p>
                      <p className="text-lg font-semibold text-gray-800">
                        {formatCurrency(selectedCustomer.profit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-x text-gray-500">Profit Margin</p>
                      <p className={`text-lg font-semibold ${
                        selectedCustomer.margin >= 30 ? 'text-green-600' : 'text-yellow-600'
                      }`}>
                        {formatPercentage(selectedCustomer.margin)}
                      </p>
                    </div>
                    <div>
                      <p className="text-x text-gray-500">Year-to-Date Revenue</p>
                      <p className="text-lg font-semibold text-gray-800">
                        {formatCurrency(selectedCustomer.ytdRevenue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-x text-gray-500">Lifetime Value</p>
                      <p className="text-lg font-semibold text-gray-800">
                        {formatCurrency(selectedCustomer.lifetimeValue)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="text-s font-medium text-gray-700 mb-3">Customer Details</h4>
                  <div className="space-y-4">
                    <div>
                      <p className="text-x text-gray-500">Industry</p>
                      <p className="text-s font-medium text-gray-800">
                        {selectedCustomer.industry}
                      </p>
                    </div>
                    <div>
                      <p className="text-x text-gray-500">Region</p>
                      <p className="text-s font-medium text-gray-800">
                        {selectedCustomer.region}
                      </p>
                    </div>
                    <div>
                      <p className="text-x text-gray-500">Primary Contact</p>
                      <p className="text-s font-medium text-gray-800">
                        {selectedCustomer.contact}
                      </p>
                    </div>
                    <div>
                      <p className="text-x text-gray-500">Last Order Date</p>
                      <p className="text-s font-medium text-gray-800">
                        {new Date(selectedCustomer.lastOrder).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-x text-gray-500">Customer Segments</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {selectedCustomer.segments.map(segment => (
                          <span key={segment} className="px-2 py-1 text-x font-medium bg-blue-100 text-blue-800 rounded-full">
                            {segment}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="text-s font-medium text-gray-700 mb-3">Strategic Insights</h4>
                  <div className="space-y-3">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeInsight}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="p-3 bg-white rounded-lg border border-gray-200 shadow-xs"
                      >
                        <p className="text-s text-gray-700">
                          {selectedCustomer.insights[activeInsight]}
                        </p>
                      </motion.div>
                    </AnimatePresence>
                    <div className="mt-4">
                      <h5 className="text-x font-medium text-gray-700 mb-2">Recommended Actions</h5>
                      <ul className="space-y-2 text-s text-gray-700">
                        <li className="flex items-start">
                          <span className="flex-shrink-0 h-4 w-4 text-green-500 mt-0.5">•</span>
                          <span className="ml-2">Review product mix for margin improvement</span>
                        </li>
                        <li className="flex items-start">
                          <span className="flex-shrink-0 h-4 w-4 text-green-500 mt-0.5">•</span>
                          <span className="ml-2">Schedule quarterly business review</span>
                        </li>
                        <li className="flex items-start">
                          <span className="flex-shrink-0 h-4 w-4 text-green-500 mt-0.5">•</span>
                          <span className="ml-2">Identify cross-sell opportunities</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => requestSort('rank')}
                      >
                        <div className="flex items-center">
                          Rank
                          {sortConfig.key === 'rank' && (
                            <span className="ml-1">
                              {sortConfig.direction === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => requestSort('customer')}
                      >
                        <div className="flex items-center">
                          Customer
                          {sortConfig.key === 'customer' && (
                            <span className="ml-1">
                              {sortConfig.direction === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => requestSort('revenue')}
                      >
                        <div className="flex items-center">
                          Revenue
                          {sortConfig.key === 'revenue' && (
                            <span className="ml-1">
                              {sortConfig.direction === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => requestSort('profit')}
                      >
                        <div className="flex items-center">
                          Profit
                          {sortConfig.key === 'profit' && (
                            <span className="ml-1">
                              {sortConfig.direction === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => requestSort('margin')}
                      >
                        <div className="flex items-center">
                          Margin
                          {sortConfig.key === 'margin' && (
                            <span className="ml-1">
                              {sortConfig.direction === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Industry
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Region
                      </th>
                      <th scope="col" className="relative px-6 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedData.map((customer) => (
                      <tr key={customer.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-s font-medium text-gray-900">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-x font-medium ${
                            customer.rank <= 3 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {customer.rank}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-s font-medium text-gray-900">
                          {customer.customer}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-500">
                          {formatCurrency(customer.revenue)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-500">
                          {formatCurrency(customer.profit)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-s">
                          <span className={`px-2 inline-flex text-x leading-5 font-semibold rounded-full ${
                            customer.margin >= 30 ? 'bg-green-100 text-green-800' : 
                            customer.margin >= 20 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {formatPercentage(customer.margin)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-500">
                          {customer.industry}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-500">
                          {customer.region}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-s font-medium">
                          <button
                            onClick={() => setSelectedCustomer(customer)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredData.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No customers match the current filters</p>
                  <button
                    onClick={() => setFilters({
                      region: 'All Regions',
                      industry: 'All Industries',
                      segment: 'All Segments',
                      minRevenue: '',
                      minMargin: ''
                    })}
                    className="mt-2 text-s text-blue-600 hover:text-blue-800"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerProfitabilityReport;