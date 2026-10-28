import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiDownload, FiChevronRight, FiDollarSign, FiTrendingUp, FiServer, FiCloud, FiShield, FiDatabase } from 'react-icons/fi';
import { BsStars } from 'react-icons/bs';
import { CSVLink } from 'react-csv';
import * as XLSX from 'xlsx';
import { motion } from 'framer-motion';

const ITSpendTable = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('spendBreakdown');
  const [aiInput, setAiInput] = useState('');
  const [aiResponses, setAiResponses] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(false);

  // IT Spend Breakdown Data
  const spendBreakdownData = [
    { 
      category: 'Cloud Services', 
      budget: '$1,250,000', 
      actual: '$1,320,000', 
      variance: '+5.6%', 
      isPositive: false,
      trend: 'Increasing',
      aiSuggestion: 'Cloud costs rising faster than budget. Consider reserved instances or optimizing workloads.',
      roi: '3.2x'
    },
    { 
      category: 'SaaS Subscriptions', 
      budget: '$850,000', 
      actual: '$780,000', 
      variance: '-8.2%', 
      isPositive: true,
      trend: 'Decreasing',
      aiSuggestion: 'Good cost control. Identify unused licenses that could be terminated.',
      roi: '4.1x'
    },
    { 
      category: 'Infrastructure', 
      budget: '$1,500,000', 
      actual: '$1,450,000', 
      variance: '-3.3%', 
      isPositive: true,
      trend: 'Stable',
      aiSuggestion: 'On-prem costs well managed. Evaluate cloud migration for non-critical workloads.',
      roi: '2.8x'
    },
    { 
      category: 'Security', 
      budget: '$600,000', 
      actual: '$650,000', 
      variance: '+8.3%', 
      isPositive: false,
      trend: 'Increasing',
      aiSuggestion: 'Security spend up due to new compliance requirements. Review tool consolidation opportunities.',
      roi: '3.5x'
    },
    { 
      category: 'IT Services', 
      budget: '$1,200,000', 
      actual: '$1,350,000', 
      variance: '+12.5%', 
      isPositive: false,
      trend: 'Increasing',
      aiSuggestion: 'Consulting costs over budget. Evaluate bringing some services in-house.',
      roi: '2.1x'
    }
  ];

  // Software License Utilization Data
  const licenseUtilizationData = [
    { 
      software: 'Microsoft 365', 
      licenses: 850, 
      activeUsers: 720, 
      utilization: '84.7%', 
      aiSuggestion: '15% unused licenses. Consider rightsizing subscription.',
      costSavings: '$45,000/yr'
    },
    { 
      software: 'Salesforce', 
      licenses: 320, 
      activeUsers: 280, 
      utilization: '87.5%', 
      aiSuggestion: 'Good utilization. Monitor seasonal fluctuations.',
      costSavings: 'N/A'
    },
    { 
      software: 'Adobe Creative Cloud', 
      licenses: 150, 
      activeUsers: 90, 
      utilization: '60.0%', 
      aiSuggestion: 'Poor utilization. Switch to pooled licenses or reduce count.',
      costSavings: '$36,000/yr'
    },
    { 
      software: 'Zoom', 
      licenses: 500, 
      activeUsers: 420, 
      utilization: '84.0%', 
      aiSuggestion: 'Consider reducing licenses by 15% during renewal.',
      costSavings: '$18,000/yr'
    },
    { 
      software: 'ServiceNow', 
      licenses: 200, 
      activeUsers: 195, 
      utilization: '97.5%', 
      aiSuggestion: 'Excellent utilization. May need additional licenses soon.',
      costSavings: 'N/A'
    }
  ];

  // Infrastructure Cost Efficiency Data
  const infraCostData = [
    { 
      workload: 'ERP System', 
      onPremCost: '$250,000', 
      cloudCost: '$180,000', 
      savings: '$70,000', 
      migrationDifficulty: 'High',
      aiSuggestion: 'Significant savings potential but complex migration. Phase approach recommended.',
      roi: '2.5 years'
    },
    { 
      workload: 'File Storage', 
      onPremCost: '$120,000', 
      cloudCost: '$45,000', 
      savings: '$75,000', 
      migrationDifficulty: 'Low',
      aiSuggestion: 'Easy win for cloud migration with quick ROI.',
      roi: '8 months'
    },
    { 
      workload: 'Database Servers', 
      onPremCost: '$180,000', 
      cloudCost: '$150,000', 
      savings: '$30,000', 
      migrationDifficulty: 'Medium',
      aiSuggestion: 'Moderate savings. Consider hybrid approach.',
      roi: '1.8 years'
    },
    { 
      workload: 'Development Environments', 
      onPremCost: '$90,000', 
      cloudCost: '$40,000', 
      savings: '$50,000', 
      migrationDifficulty: 'Low',
      aiSuggestion: 'Ideal for cloud with on-demand usage patterns.',
      roi: '10 months'
    },
    { 
      workload: 'Backup Systems', 
      onPremCost: '$75,000', 
      cloudCost: '$25,000', 
      savings: '$50,000', 
      migrationDifficulty: 'Medium',
      aiSuggestion: 'Cloud backup solutions offer better reliability and cost.',
      roi: '1 year'
    }
  ];

  // IT Project Budget Data
  const projectBudgetData = [
    { 
      project: 'CRM Implementation', 
      budget: '$500,000', 
      actual: '$550,000', 
      variance: '+10%', 
      completion: '90%',
      aiSuggestion: 'Scope creep caused overage. Tighten change control for remaining work.',
      roiEstimate: '3.2x'
    },
    { 
      project: 'Network Upgrade', 
      budget: '$1,200,000', 
      actual: '$1,150,000', 
      variance: '-4.2%', 
      completion: '100%',
      aiSuggestion: 'Completed under budget. Vendor negotiations successful.',
      roiEstimate: '2.8x'
    },
    { 
      project: 'Security Modernization', 
      budget: '$750,000', 
      actual: '$900,000', 
      variance: '+20%', 
      completion: '75%',
      aiSuggestion: 'Significant overage due to new compliance requirements. Review remaining scope.',
      roiEstimate: '4.1x'
    },
    { 
      project: 'Cloud Migration', 
      budget: '$2,000,000', 
      actual: '$1,800,000', 
      variance: '-10%', 
      completion: '60%',
      aiSuggestion: 'Ahead of schedule and under budget. Excellent vendor management.',
      roiEstimate: '3.5x'
    },
    { 
      project: 'Helpdesk Automation', 
      budget: '$300,000', 
      actual: '$350,000', 
      variance: '+16.7%', 
      completion: '100%',
      aiSuggestion: 'Initial overage but now showing 40% reduction in helpdesk tickets.',
      roiEstimate: '5.2x'
    }
  ];

  // Security & Compliance Data
  const securityComplianceData = [
    { 
      metric: 'Critical Vulnerabilities', 
      current: 12, 
      previous: 18, 
      change: '-33%', 
      isPositive: true,
      aiSuggestion: 'Improvement trend. Focus on patch management for remaining vulnerabilities.',
      riskLevel: 'Medium'
    },
    { 
      metric: 'Security Incidents', 
      current: 8, 
      previous: 5, 
      change: '+60%', 
      isPositive: false,
      aiSuggestion: 'Increase in phishing attacks. Enhance employee training.',
      riskLevel: 'High'
    },
    { 
      metric: 'Compliance Gaps', 
      current: 3, 
      previous: 7, 
      change: '-57%', 
      isPositive: true,
      aiSuggestion: 'Good progress. Address remaining gaps before next audit.',
      riskLevel: 'Low'
    },
    { 
      metric: 'Patch Latency (days)', 
      current: 14, 
      previous: 21, 
      change: '-33%', 
      isPositive: true,
      aiSuggestion: 'Improved but still above industry standard of 7 days.',
      riskLevel: 'Medium'
    },
    { 
      metric: 'Third-Party Risks', 
      current: 5, 
      previous: 4, 
      change: '+25%', 
      isPositive: false,
      aiSuggestion: 'New vendors added without proper security review. Implement vendor risk management.',
      riskLevel: 'High'
    }
  ];

  // Tech Debt & Modernization Data
  const techDebtData = [
    { 
      system: 'Legacy ERP', 
      age: '12 years', 
      maintenanceCost: '$250,000', 
      businessImpact: 'High',
      aiSuggestion: 'Critical system needing modernization. High risk of failure.',
      modernizationPriority: 'Critical'
    },
    { 
      system: 'Custom CRM', 
      age: '8 years', 
      maintenanceCost: '$120,000', 
      businessImpact: 'Medium',
      aiSuggestion: 'Functionality gaps emerging. Consider replacement with commercial solution.',
      modernizationPriority: 'High'
    },
    { 
      system: 'Reporting Platform', 
      age: '5 years', 
      maintenanceCost: '$75,000', 
      businessImpact: 'High',
      aiSuggestion: 'Modernize with cloud-based analytics tools for better insights.',
      modernizationPriority: 'High'
    },
    { 
      system: 'HR Database', 
      age: '10 years', 
      maintenanceCost: '$90,000', 
      businessImpact: 'Medium',
      aiSuggestion: 'Stable but inefficient. Modernization would improve HR workflows.',
      modernizationPriority: 'Medium'
    },
    { 
      system: 'Email System', 
      age: '7 years', 
      maintenanceCost: '$60,000', 
      businessImpact: 'Low',
      aiSuggestion: 'Adequate for current needs. Lower priority for modernization.',
      modernizationPriority: 'Low'
    }
  ];

  // AI Suggestions
  const aiSuggestions = {
    spendBreakdown: "IT spend is 6.2% over budget overall, primarily due to cloud services and IT services. Cloud costs increasing at 18% YoY - consider reserved instances and workload optimization. IT services overage indicates potential to bring some functions in-house.",
    licenseUtilization: "23% of software licenses are underutilized, representing $120K annual savings potential. Adobe Creative Cloud shows particularly poor utilization (60%). Microsoft 365 has 15% unused licenses that could be reclaimed.",
    infraCost: "Cloud migration could save $275K annually, with file storage and development environments offering quickest ROI. ERP migration is complex but offers significant long-term savings. Hybrid approach recommended for database servers.",
    projectBudget: "Projects are averaging 4.5% over budget, with security modernization showing largest overage (20%). Cloud migration is performing well (10% under budget). Helpdesk automation shows highest ROI despite initial overage.",
    securityCompliance: "Security posture improving with 33% reduction in vulnerabilities, but incidents up 60% due to phishing. Patch latency improved but still above benchmark. Vendor risk management needs attention.",
    techDebt: "Tech debt totals $595K in annual maintenance costs. Legacy ERP is highest priority with high business impact. Reporting platform modernization would enable better analytics. HR system is stable but inefficient."
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
    XLSX.writeFile(workbook, `${sheetName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const getCurrentData = () => {
    switch (activeTab) {
      case 'spendBreakdown': return spendBreakdownData;
      case 'licenseUtilization': return licenseUtilizationData;
      case 'infraCost': return infraCostData;
      case 'projectBudget': return projectBudgetData;
      case 'securityCompliance': return securityComplianceData;
      case 'techDebt': return techDebtData;
      default: return spendBreakdownData;
    }
  };

  const getCurrentColumns = () => {
    switch (activeTab) {
      case 'spendBreakdown':
        return [
          { header: 'Category', accessor: 'category' },
          { header: 'Budget', accessor: 'budget' },
          { header: 'Actual', accessor: 'actual' },
          { header: 'Variance', accessor: 'variance' },
          { header: 'Trend', accessor: 'isPositive' },
          { header: 'ROI', accessor: 'roi' },
          { header: 'AI Insight', accessor: 'aiSuggestion' }
        ];
      case 'licenseUtilization':
        return [
          { header: 'Software', accessor: 'software' },
          { header: 'Licenses', accessor: 'licenses' },
          { header: 'Active Users', accessor: 'activeUsers' },
          { header: 'Utilization', accessor: 'utilization' },
          { header: 'Cost Savings', accessor: 'costSavings' },
          { header: 'AI Insight', accessor: 'aiSuggestion' }
        ];
      case 'infraCost':
        return [
          { header: 'Workload', accessor: 'workload' },
          { header: 'On-Prem Cost', accessor: 'onPremCost' },
          { header: 'Cloud Cost', accessor: 'cloudCost' },
          { header: 'Savings', accessor: 'savings' },
          { header: 'Migration Difficulty', accessor: 'migrationDifficulty' },
          { header: 'ROI', accessor: 'roi' },
          { header: 'AI Insight', accessor: 'aiSuggestion' }
        ];
      case 'projectBudget':
        return [
          { header: 'Project', accessor: 'project' },
          { header: 'Budget', accessor: 'budget' },
          { header: 'Actual', accessor: 'actual' },
          { header: 'Variance', accessor: 'variance' },
          { header: 'Completion', accessor: 'completion' },
          { header: 'ROI Estimate', accessor: 'roiEstimate' },
          { header: 'AI Insight', accessor: 'aiSuggestion' }
        ];
      case 'securityCompliance':
        return [
          { header: 'Metric', accessor: 'metric' },
          { header: 'Current', accessor: 'current' },
          { header: 'Previous', accessor: 'previous' },
          { header: 'Change', accessor: 'isPositive' },
          { header: 'Risk Level', accessor: 'riskLevel' },
          { header: 'AI Insight', accessor: 'aiSuggestion' }
        ];
      case 'techDebt':
        return [
          { header: 'System', accessor: 'system' },
          { header: 'Age', accessor: 'age' },
          { header: 'Maintenance Cost', accessor: 'maintenanceCost' },
          { header: 'Business Impact', accessor: 'businessImpact' },
          { header: 'Modernization Priority', accessor: 'modernizationPriority' },
          { header: 'AI Insight', accessor: 'aiSuggestion' }
        ];
      default:
        return [];
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
              <Link to="/it-technology-spendp" className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                IT Analytics Dashboard
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

      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">IT & Technology Spend Analytics</h1>
            <p className="text-sky-100 text-x">Detailed analysis of IT budgets, utilization, and optimization opportunities</p>
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
              filename={`it_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`}
              className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200"
            >
              <FiDownload className="mr-1" /> Export to CSV
            </CSVLink>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {[
            { id: 'spendBreakdown', label: 'Spend Breakdown' },
            { id: 'licenseUtilization', label: 'License Utilization' },
            { id: 'infraCost', label: 'Infrastructure Costs' },
            { id: 'projectBudget', label: 'Project Budgets' },
            { id: 'securityCompliance', label: 'Security & Compliance' },
            { id: 'techDebt', label: 'Tech Debt' },
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
              {activeTab === 'spendBreakdown' && 'IT Spend Breakdown'}
              {activeTab === 'licenseUtilization' && 'Software License Utilization'}
              {activeTab === 'infraCost' && 'Infrastructure Cost Efficiency'}
              {activeTab === 'projectBudget' && 'IT Project Budget vs. Actuals'}
              {activeTab === 'securityCompliance' && 'Security & Compliance Analytics'}
              {activeTab === 'techDebt' && 'Tech Debt & Modernization'}
            </h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowAIDropdown(!showAIDropdown)}
                className="flex items-center px-3 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-s"
              >
                <BsStars className="mr-1" /> AI Insights
              </button>
            </div>
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
                      if (column.accessor === 'riskLevel') {
                        let bgColor = 'bg-red-100 text-red-800';
                        if (row.riskLevel === 'Low') bgColor = 'bg-green-100 text-green-800';
                        else if (row.riskLevel === 'Medium') bgColor = 'bg-yellow-100 text-yellow-800';
                        
                        return (
                          <td key={colIndex} className="px-4 py-3 whitespace-nowrap text-s">
                            <span className={`px-2 py-1 rounded-full text-x font-medium ${bgColor}`}>
                              {row[column.accessor]}
                            </span>
                          </td>
                        );
                      }
                      if (column.accessor === 'modernizationPriority') {
                        let bgColor = 'bg-gray-100 text-gray-800';
                        if (row.modernizationPriority === 'Critical') bgColor = 'bg-red-100 text-red-800';
                        else if (row.modernizationPriority === 'High') bgColor = 'bg-orange-100 text-orange-800';
                        else if (row.modernizationPriority === 'Medium') bgColor = 'bg-yellow-100 text-yellow-800';
                        
                        return (
                          <td key={colIndex} className="px-4 py-3 whitespace-nowrap text-s">
                            <span className={`px-2 py-1 rounded-full text-x font-medium ${bgColor}`}>
                              {row[column.accessor]}
                            </span>
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

export default ITSpendTable;