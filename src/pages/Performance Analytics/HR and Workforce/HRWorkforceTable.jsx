import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  FiDownload, FiChevronRight, FiDollarSign, FiTrendingUp, 
  FiUser, FiPieChart, FiFilter, FiSend, FiClock, FiUsers 
} from 'react-icons/fi';
import { BsStars, BsLightningFill } from 'react-icons/bs';
import { CSVLink } from 'react-csv';
import * as XLSX from 'xlsx';
import { Tooltip } from 'react-tooltip';
import { motion } from 'framer-motion';
import { getDecimalPrecision } from '../../../utils/formatters';

const HRWorkforceTable = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('salesPerformance');
  const [aiInput, setAiInput] = useState('');
  const [aiResponses, setAiResponses] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(false);
  const [showAdvancedInsights, setShowAdvancedInsights] = useState(false);

  // Sales Performance Data (from SalesPerformanceTable.jsx)
  const salesData = {
    kpis: [
      { title: 'Total Revenue', value: '$2,546,000', change: '-25%', isPositive: false, forecast: '$2.8M predicted next quarter', aiSuggestion: 'Revenue decline detected. Review pricing strategy.' },
      { title: 'Revenue Per Segment', value: '$152,000', change: '+8%', isPositive: true, forecast: '$165K predicted next quarter', aiSuggestion: 'Strong growth in segment revenue.' },
      { title: 'Sales Team Cost', value: '$485,000', change: '+12%', isPositive: false, forecast: '$520K predicted next quarter', aiSuggestion: 'Costs rising faster than revenue.' },
      { title: 'Leads', value: '12,500', change: '+15%', isPositive: true, forecast: '13,500 predicted next quarter', aiSuggestion: 'Lead generation performing well.' },
      { title: 'Opportunities', value: '4,890', change: '+10%', isPositive: true, forecast: '5,200 predicted next quarter', aiSuggestion: 'Opportunity growth is healthy.' },
      { title: 'Wins', value: '628', change: '+5%', isPositive: true, forecast: '700 predicted next quarter', aiSuggestion: 'Win rate needs improvement.' }
    ],
    revenueTrend: [
      { week: 'Jun 1', opportunities: 320, wins: 40, revenue: '$150K', winProbability: '68%', aiSuggestion: 'Starting point shows baseline performance' },
      { week: 'Jun 8', opportunities: 310, wins: 45, revenue: '$160K', winProbability: '72%', aiSuggestion: 'Slight dip in opportunities but win rate improved' },
      // More weeks...
    ],
    leadSource: [
      { source: 'Web', opportunities: 1213, avgRevenue: '$152.8K', aiScore: 85, optimalPricing: '+5-8%', aiSuggestion: 'High volume with good revenue.' },
      { source: 'Social Media', opportunities: 1136, avgRevenue: '$119.3K', aiScore: 72, optimalPricing: 'Current', aiSuggestion: 'Strong volume but lower value.' },
      // More sources...
    ]
  };

  // Employee Productivity Data
  const productivityData = {
    kpis: [
      { title: 'Revenue/Employee', value: '$125K', change: '+8%', isPositive: true, forecast: '$132K predicted next quarter', aiSuggestion: 'Steady improvement in productivity' },
      { title: 'Output/Employee', value: '420 units', change: '+5%', isPositive: true, forecast: '440 units predicted next quarter', aiSuggestion: 'Output gains consistent with training' },
      { title: 'Absenteeism Rate', value: '3.2%', change: '-0.5', isPositive: true, forecast: '2.9% predicted next quarter', aiSuggestion: 'Absenteeism trending downward' },
      { title: 'Span of Control', value: '6.8', change: '+0.3', isPositive: true, forecast: '7.0 predicted next quarter', aiSuggestion: 'Approaching optimal span' },
      { title: 'Overtime Rate', value: '12.5%', change: '+2.1', isPositive: false, forecast: '13.8% predicted next quarter', aiSuggestion: 'Overtime increasing - monitor burnout' }
    ],
    departmentBreakdown: [
      { department: "Sales", revenue: "$215K", output: "420", absenteeism: "2.8%", overtime: "$12K", span: "7.2", aiSuggestion: "Strong performance with optimal span" },
      { department: "Marketing", revenue: "$180K", output: "380", absenteeism: "4.2%", overtime: "$18K", span: "5.5", aiSuggestion: "Productivity drop detected - investigate" },
      // More departments...
    ]
  };

  // Utilization Rate Data
  const utilizationData = {
    kpis: [
      { title: 'Utilization Rate', value: '72.5%', change: '+3.2', isPositive: true, forecast: '74% predicted next quarter', aiSuggestion: 'Utilization improving steadily' },
      { title: 'Billable Ratio', value: '65%', change: '-2.1', isPositive: false, forecast: '63% predicted next quarter', aiSuggestion: 'Non-billable work increasing' },
      { title: 'Avg Overtime', value: '8.2 hrs', change: '+1.5', isPositive: false, forecast: '9.0 hours predicted next quarter', aiSuggestion: 'Overtime trending upward' },
      { title: 'Overtime Cost', value: '$125K', change: '+18%', isPositive: false, forecast: '$145K predicted next quarter', aiSuggestion: 'Cost control needed' },
      { title: 'Peak Utilization Dept', value: 'Consulting', change: '0', isPositive: true, forecast: 'No change expected', aiSuggestion: 'Consistent high performance' }
    ],
    departmentUtilization: [
      { department: "Consulting", total: 16500, billable: 12000, nonBillable: 3000, overtime: 1500, utilization: 72.7, cost: 67500, aiSuggestion: "Optimal utilization achieved" },
      { department: "Engineering", total: 15200, billable: 9500, nonBillable: 4500, overtime: 1200, utilization: 62.5, cost: 54000, aiSuggestion: "Room for improvement in billable work" },
      // More departments...
    ]
  };

  // Add 3 more datasets for other sub-menus here...

  // AI Insights
  const aiSuggestions = {
    salesPerformance: "Revenue shows steady weekly growth but overall quarterly decline. Focus on improving conversion rates from opportunities to wins.",
    employeeProductivity: "Productivity metrics show improvement but overtime is increasing. Marketing department shows concerning absenteeism trends.",
    utilizationRate: "Utilization improving but billable ratio declining. Consulting team at optimal levels while others need improvement.",
    // Add insights for other sub-menus...
  };

  const handleSendAIQuery = () => {
    if (!aiInput.trim()) return;
    const mockResponse = `AI analysis for ${activeTab}: ${aiSuggestions[activeTab]}`;
    setAiResponses(prev => ({
      ...prev,
      [activeTab]: [...(prev[activeTab] || []), { query: aiInput, response: mockResponse }]
    }));
    setAiInput('');
  };

  const exportToExcel = (data, sheetName) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${sheetName}_export.xlsx`);
  };

  const getCurrentData = () => {
    switch (activeTab) {
      case 'salesPerformance': return salesData.kpis;
      case 'employeeProductivity': return productivityData.kpis;
      case 'utilizationRate': return utilizationData.kpis;
      // Add cases for other sub-menus...
      default: return [];
    }
  };

  const getCurrentColumns = () => {
    switch (activeTab) {
      case 'salesPerformance':
      case 'employeeProductivity':
      case 'utilizationRate':
        return [
          { header: 'Metric', accessor: 'title' },
          { header: 'Value', accessor: 'value' },
          { header: 'Change', accessor: 'change' },
          { header: 'Trend', accessor: 'isPositive' },
          { header: 'Forecast', accessor: 'forecast' },
          { header: 'AI Insight', accessor: 'aiSuggestion' }
        ];
      // Add column definitions for other sub-menus...
      default: return [];
    }
  };

  return (
    <div className="space-y-6 p-4 min-h-screen relative bg-sky-50">
      {/* Breadcrumb Navigation */}
            <nav className="flex mb-4" aria-label="Breadcrumb">
              <ol className="inline-flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse">
                <li className="inline-flex items-center">
                  <Link to="/" className="inline-flex items-center text-s font-medium text-gray-700 hover:text-blue-600">
                    <svg className="w-3 h-3 me-2.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                      <path d="m19.707 9.293-2-2-7-7a1 1 0 0 0-1.414 0l-7 7-2 2a1 1 0 0 0 1.414 1.414L2 10.414V18a2 2 0 0 0 2 2h3a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h3a2 2 0 0 0 2-2v-7.586l.293.293a1 1 0 0 0 1.414-1.414Z"/>
                    </svg>
                    Home
                  </Link>
                </li>
                <li>
                  <div className="flex items-center">
                    <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
                    <Link to="/hr-workforce" className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                      HR workForce
                    </Link>
                  </div>
                </li>
                <li aria-current="page">
                  <div className="flex items-center">
                    <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
                    <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Detailed View</span>
                  </div>
                </li>
              </ol>
            </nav>

      {/* Header */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Combined Performance Dashboard</h1>
            <p className="text-sky-100 text-x">All metrics in one view with AI-powered insights</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => exportToExcel(getCurrentData(), activeTab)}
              className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200"
            >
              <FiDownload className="mr-1" /> Export to Excel
            </button>
            <CSVLink
              data={getCurrentData()}
              filename={`${activeTab}_export.csv`}
              className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200"
            >
              <FiDownload className="mr-1" /> Export to CSV
            </CSVLink>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {[
            { id: 'salesPerformance', label: 'Sales Performance' },
            { id: 'employeeProductivity', label: 'Employee Productivity' },
            { id: 'utilizationRate', label: 'Utilization Rate' },
            // Add more tabs for other sub-menus...
          ].map((tab) => (
            <button
              key={tab.id}
              className={`px-4 py-3 text-s font-medium whitespace-nowrap ${activeTab === tab.id ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500 hover:text-blue-500'}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              {activeTab === 'salesPerformance' && 'Sales Performance Metrics'}
              {activeTab === 'employeeProductivity' && 'Employee Productivity Metrics'}
              {activeTab === 'utilizationRate' && 'Utilization Rate Metrics'}
              {/* Add titles for other sub-menus... */}
            </h2>
            <button
              onClick={() => setShowAIDropdown(!showAIDropdown)}
              className="flex items-center px-3 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-s"
            >
              <BsStars className="mr-1" /> AI Insights
            </button>
          </div>

          {showAIDropdown && (
            <motion.div
              className="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-100"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h3 className="text-s font-semibold text-blue-800 mb-2">AI Suggestions</h3>
              <p className="text-s text-blue-700 mb-3">{aiSuggestions[activeTab]}</p>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Ask about this data..."
                  className="flex-1 p-2 border border-blue-300 rounded-lg text-s focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSendAIQuery}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={!aiInput.trim()}
                >
                  <FiSend />
                </button>
              </div>
              {aiResponses[activeTab]?.length > 0 && (
                <div className="mt-3 space-y-2">
                  {aiResponses[activeTab].map((response, index) => (
                    <div key={index} className="text-x bg-white p-2 rounded border border-blue-100">
                      <strong>Q:</strong> {response.query}<br />
                      <strong>A:</strong> {response.response}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {getCurrentColumns().map((column, index) => (
                    <th
                      key={index}
                      className="px-4 py-3 text-left text-x font-bold text-gray-700 uppercase tracking-wider"
                    >
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getCurrentData().map((row, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {getCurrentColumns().map((column, colIndex) => {
                      if (column.accessor === 'isPositive') {
                        return (
                          <td key={colIndex} className="px-4 py-3 whitespace-nowrap text-s">
                            <span className={`inline-flex items-center ${row.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                              {row.isPositive ? (
                                <>
                                  <FiTrendingUp className="mr-1" /> Positive
                                </>
                              ) : (
                                <>
                                  <FiTrendingUp className="mr-1 transform rotate-180" /> Negative
                                </>
                              )}
                            </span>
                          </td>
                        );
                      }
                      if (column.accessor === 'aiSuggestion') {
                        return (
                          <td key={colIndex} className="px-4 py-3 text-s text-gray-700">
                            <div className="flex items-start">
                              <BsStars className="flex-shrink-0 mt-0.5 mr-2 text-blue-500" />
                              <span className="text-x">{row.aiSuggestion}</span>
                            </div>
                          </td>
                        );
                      }
                      return (
                        <td key={colIndex} className="px-4 py-3 whitespace-nowrap text-s text-gray-700">
                          {row[column.accessor]}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detailed Tables for Each Section */}
          {activeTab === 'employeeProductivity' && (
            <div className="mt-6">
              <h3 className="text-s font-semibold text-sky-800 mb-2">Department Productivity Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-x text-gray-700">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2 text-left">Department</th>
                      <th className="p-2 text-left">Revenue/Employee</th>
                      <th className="p-2 text-left">Output/Employee</th>
                      <th className="p-2 text-left">Absenteeism Rate</th>
                      <th className="p-2 text-left">Overtime Cost</th>
                      <th className="p-2 text-left">Span of Control</th>
                      <th className="p-2 text-left">AI Insight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productivityData.departmentBreakdown.map((row, i) => (
                      <tr key={i} className="border-b hover:bg-sky-50">
                        <td className="p-2">{row.department}</td>
                        <td className="p-2">{row.revenue}</td>
                        <td className="p-2">{row.output}</td>
                        <td className={`p-2 ${parseFloat(row.absenteeism) > 3.5 ? "text-red-500" : "text-green-500"}`}>{row.absenteeism}</td>
                        <td className="p-2">{row.overtime}</td>
                        <td className="p-2">{row.span}</td>
                        <td className="p-2 text-x text-gray-600">{row.aiSuggestion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'utilizationRate' && (
            <div className="mt-6">
              <h3 className="text-s font-semibold text-sky-800 mb-2">Department Utilization Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-x text-gray-700">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2 text-left">Department</th>
                      <th className="p-2 text-left">Total Hours</th>
                      <th className="p-2 text-left">Billable Hours</th>
                      <th className="p-2 text-left">Non-Billable Hours</th>
                      <th className="p-2 text-left">Overtime Hours</th>
                      <th className="p-2 text-left">Utilization Rate</th>
                      <th className="p-2 text-left">Overtime Cost</th>
                      <th className="p-2 text-left">AI Insight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {utilizationData.departmentUtilization.map((row, i) => (
                      <tr key={i} className="border-b hover:bg-sky-50">
                        <td className="p-2">{row.department}</td>
                        <td className="p-2">{row.total.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                        <td className="p-2">{row.billable.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                        <td className="p-2">{row.nonBillable.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                        <td className="p-2">{row.overtime.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                        <td className={`p-2 ${row.utilization > 70 ? "text-green-500" : row.utilization < 50 ? "text-red-500" : "text-yellow-500"}`}>
                          {row.utilization}%
                        </td>
                        <td className="p-2">${row.cost.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                        <td className="p-2 text-x text-gray-600">{row.aiSuggestion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Add similar detailed tables for other sub-menus... */}

          {/* AI Summary Box */}
          <motion.div 
            className="mt-6 bg-blue-50 rounded-lg p-4 border border-blue-100"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-start">
              <div className="flex-shrink-0 mt-1">
                <BsStars className="h-5 w-5 text-blue-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-s font-semibold text-blue-800">AI Analysis Summary</h3>
                <p className="text-s text-blue-700 mt-1">{aiSuggestions[activeTab]}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default HRWorkforceTable;