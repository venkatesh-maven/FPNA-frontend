import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  FiDownload, 
  FiChevronRight, 
  FiDollarSign, 
  FiTrendingUp, 
  FiTrendingDown,
  FiPieChart, 
  FiFilter, 
  FiSend,
  FiClock,
  FiCreditCard,
  FiFileText,
  FiPercent
} from 'react-icons/fi';
import { BsStars } from 'react-icons/bs';
import { CSVLink } from 'react-csv';
import * as XLSX from 'xlsx';
import { Tooltip } from 'react-tooltip';
import { motion } from 'framer-motion';

const FinanceAccountingTable = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('liquidity');
  const [aiInput, setAiInput] = useState('');
  const [aiResponses, setAiResponses] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(false);

  // Liquidity & Working Capital Data
  const liquidityData = [
    { 
      metric: 'Current Ratio', 
      value: 1.8, 
      benchmark: '2.0', 
      trend: '-0.2', 
      isPositive: false,
      aiSuggestion: 'Current ratio below benchmark. Consider reducing short-term liabilities or increasing current assets.',
      lastQuarter: 2.0
    },
    { 
      metric: 'Quick Ratio', 
      value: 1.2, 
      benchmark: '1.5', 
      trend: '+0.1', 
      isPositive: true,
      aiSuggestion: 'Improving but still below ideal. Inventory reduction could help improve further.',
      lastQuarter: 1.1
    },
    { 
      metric: 'Cash Conversion Cycle (days)', 
      value: 45, 
      benchmark: '30', 
      trend: '-5', 
      isPositive: true,
      aiSuggestion: 'Improving trend but still long. Focus on receivables collection and inventory turnover.',
      lastQuarter: 50
    },
    { 
      metric: 'Working Capital (₹ Cr)', 
      value: 12.5, 
      benchmark: '15.0', 
      trend: '+1.2', 
      isPositive: true,
      aiSuggestion: 'Growing working capital. Ensure optimal allocation between current assets.',
      lastQuarter: 11.3
    },
    { 
      metric: 'Operating Cash Flow (₹ Cr)', 
      value: 8.2, 
      benchmark: '10.0', 
      trend: '-0.8', 
      isPositive: false,
      aiSuggestion: 'Declining cash flow. Review accounts receivable and inventory management.',
      lastQuarter: 9.0
    }
  ];

  // Profitability Ratios Data
  const profitabilityData = [
    { 
      metric: 'Gross Margin %', 
      value: '42%', 
      benchmark: '45%', 
      trend: '+2%', 
      isPositive: true,
      aiSuggestion: 'Improving but below target. Review product mix and direct costs.',
      lastQuarter: '40%'
    },
    { 
      metric: 'Operating Margin %', 
      value: '22%', 
      benchmark: '25%', 
      trend: '-1%', 
      isPositive: false,
      aiSuggestion: 'Declining due to rising SG&A. Identify cost reduction opportunities.',
      lastQuarter: '23%'
    },
    { 
      metric: 'Net Profit Margin %', 
      value: '15%', 
      benchmark: '18%', 
      trend: '+0.5%', 
      isPositive: true,
      aiSuggestion: 'Steady improvement. Focus on tax optimization and interest expenses.',
      lastQuarter: '14.5%'
    },
    { 
      metric: 'ROA (Return on Assets)', 
      value: '8%', 
      benchmark: '10%', 
      trend: '+0.8%', 
      isPositive: true,
      aiSuggestion: 'Asset efficiency improving. Consider divesting underperforming assets.',
      lastQuarter: '7.2%'
    },
    { 
      metric: 'ROE (Return on Equity)', 
      value: '18%', 
      benchmark: '20%', 
      trend: '-1.2%', 
      isPositive: false,
      aiSuggestion: 'Declining due to increased equity base. Review dividend policy.',
      lastQuarter: '19.2%'
    }
  ];

  // Debt & Coverage Metrics Data
  const debtData = [
    { 
      metric: 'Debt-to-Equity Ratio', 
      value: 0.8, 
      benchmark: '0.6', 
      trend: '+0.1', 
      isPositive: false,
      aiSuggestion: 'Above optimal level. Consider equity financing for next capital raise.',
      lastQuarter: 0.7
    },
    { 
      metric: 'Interest Coverage Ratio', 
      value: 4.5, 
      benchmark: '5.0', 
      trend: '-0.3', 
      isPositive: false,
      aiSuggestion: 'Declining coverage. Monitor EBIT trends and interest rates.',
      lastQuarter: 4.8
    },
    { 
      metric: 'Debt Service Coverage', 
      value: 1.8, 
      benchmark: '2.0', 
      trend: '+0.2', 
      isPositive: true,
      aiSuggestion: 'Improving but still below covenant requirements.',
      lastQuarter: 1.6
    },
    { 
      metric: 'Short-term Debt (₹ Cr)', 
      value: 25.4, 
      benchmark: '20.0', 
      trend: '+3.1', 
      isPositive: false,
      aiSuggestion: 'Growing short-term obligations. Refinance to longer terms where possible.',
      lastQuarter: 22.3
    },
    { 
      metric: 'Long-term Debt (₹ Cr)', 
      value: 45.2, 
      benchmark: '50.0', 
      trend: '+5.4', 
      isPositive: true,
      aiSuggestion: 'Within range but growing. Align with capital expenditure plans.',
      lastQuarter: 39.8
    }
  ];

  // Budget Utilization Data
  const budgetData = [
    { 
      department: 'Sales', 
      allocated: '₹12.5 Cr', 
      utilized: '₹13.8 Cr', 
      variance: '+10.4%',
      isPositive: false,
      aiSuggestion: 'Over-spend due to unplanned marketing campaigns. Review discretionary spend.',
      lastQuarterVariance: '+8.2%'
    },
    { 
      department: 'R&D', 
      allocated: '₹8.0 Cr', 
      utilized: '₹7.2 Cr', 
      variance: '-10.0%',
      isPositive: true,
      aiSuggestion: 'Under-utilization may delay product roadmap. Check project timelines.',
      lastQuarterVariance: '-5.3%'
    },
    { 
      department: 'Operations', 
      allocated: '₹6.5 Cr', 
      utilized: '₹6.7 Cr', 
      variance: '+3.1%',
      isPositive: false,
      aiSuggestion: 'Slight overage due to logistics cost increases. Negotiate carrier contracts.',
      lastQuarterVariance: '+1.8%'
    },
    { 
      department: 'HR', 
      allocated: '₹4.2 Cr', 
      utilized: '₹4.0 Cr', 
      variance: '-4.8%',
      isPositive: true,
      aiSuggestion: 'Savings from delayed hires. Align with recruitment plan.',
      lastQuarterVariance: '-2.1%'
    },
    { 
      department: 'IT', 
      allocated: '₹3.8 Cr', 
      utilized: '₹4.5 Cr', 
      variance: '+18.4%',
      isPositive: false,
      aiSuggestion: 'Major overage from cloud services. Optimize instance sizing.',
      lastQuarterVariance: '+12.6%'
    }
  ];

  // Tax & Compliance Data
  const taxData = [
    { 
      area: 'Income Tax Provision', 
      status: 'Filed', 
      risk: 'Low', 
      dueDate: '15-Oct-2024',
      aiSuggestion: 'No outstanding issues. Maintain documentation for potential audit.',
      lastQuarterStatus: 'Filed'
    },
    { 
      area: 'GST Compliance', 
      status: 'Pending Review', 
      risk: 'Medium', 
      dueDate: '20-Sep-2024',
      aiSuggestion: 'Two minor discrepancies identified. Resolve before filing.',
      lastQuarterStatus: 'Filed'
    },
    { 
      area: 'Transfer Pricing', 
      status: 'In Progress', 
      risk: 'High', 
      dueDate: '30-Nov-2024',
      aiSuggestion: 'Major documentation required. Start preparation early.',
      lastQuarterStatus: 'Filed'
    },
    { 
      area: 'Payroll Taxes', 
      status: 'Filed', 
      risk: 'Low', 
      dueDate: '07-Sep-2024',
      aiSuggestion: 'All filings complete. No penalties in last 3 years.',
      lastQuarterStatus: 'Filed'
    },
    { 
      area: 'International VAT', 
      status: 'Review Needed', 
      risk: 'High', 
      dueDate: '15-Dec-2024',
      aiSuggestion: 'New EU regulations require changes to reporting.',
      lastQuarterStatus: 'Filed'
    }
  ];

  // Expense Trend Data
  const expenseData = [
    { 
      category: 'Employee Benefits', 
      amount: '₹4.8 Cr', 
      trend: '+12%', 
      isPositive: false,
      aiSuggestion: 'Rising healthcare costs. Consider alternative benefit plans.',
      lastQuarter: '₹4.3 Cr'
    },
    { 
      category: 'Technology', 
      amount: '₹3.5 Cr', 
      trend: '+25%', 
      isPositive: false,
      aiSuggestion: 'Cloud costs growing rapidly. Initiate cost optimization program.',
      lastQuarter: '₹2.8 Cr'
    },
    { 
      category: 'Marketing', 
      amount: '₹2.9 Cr', 
      trend: '-8%', 
      isPositive: true,
      aiSuggestion: 'Reduction from efficiency gains. Reallocate savings to high-ROI channels.',
      lastQuarter: '₹3.2 Cr'
    },
    { 
      category: 'Facilities', 
      amount: '₹2.1 Cr', 
      trend: '+5%', 
      isPositive: false,
      aiSuggestion: 'Moderate increase from inflation. Renegotiate leases where possible.',
      lastQuarter: '₹2.0 Cr'
    },
    { 
      category: 'Professional Services', 
      amount: '₹1.8 Cr', 
      trend: '+15%', 
      isPositive: false,
      aiSuggestion: 'Growing legal and consulting fees. Bring some services in-house.',
      lastQuarter: '₹1.6 Cr'
    }
  ];

  // AI Suggestions
  const aiSuggestions = {
    liquidity: "Liquidity position requires attention with current ratio below benchmark. AI recommends: 1) Accelerate receivables collection, 2) Renegotiate payment terms with suppliers, 3) Maintain cash reserve of ₹5Cr for contingencies.",
    profitability: "Profitability ratios show mixed trends. Highest opportunity in reducing COGS by 2% through supplier renegotiation (85% probability of success) and optimizing product mix (potential 3% margin improvement).",
    debt: "Debt levels approaching covenant thresholds. AI suggests: 1) Refinance ₹10Cr short-term debt to longer maturity, 2) Prepay high-interest loans, 3) Maintain DSCR above 1.5x to avoid covenant breaches.",
    budget: "Budget variances highlight need for tighter controls. AI identifies 12% potential savings in IT and Operations through: 1) Cloud cost optimization, 2) Logistics route optimization, 3) Vendor consolidation.",
    tax: "Tax compliance risks concentrated in international operations. AI recommends: 1) Conduct EU VAT training by Oct 2024, 2) Allocate ₹25L for transfer pricing documentation, 3) Implement automated tax tracking system.",
    expense: "Expense trends show technology as fastest growing cost center. AI suggests: 1) Right-size cloud instances (potential 18% savings), 2) Renegotiate SaaS contracts, 3) Implement usage monitoring dashboard."
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
      case 'liquidity': return liquidityData;
      case 'profitability': return profitabilityData;
      case 'debt': return debtData;
      case 'budget': return budgetData;
      case 'tax': return taxData;
      case 'expense': return expenseData;
      default: return liquidityData;
    }
  };

  const getCurrentColumns = () => {
    switch (activeTab) {
      case 'liquidity':
        return [
          { header: 'Metric', accessor: 'metric' },
          { header: 'Current Value', accessor: 'value' },
          { header: 'Benchmark', accessor: 'benchmark' },
          { header: 'Trend', accessor: 'trend' },
          { header: 'Last Quarter', accessor: 'lastQuarter' },
          { header: 'AI Recommendation', accessor: 'aiSuggestion' }
        ];
      case 'profitability':
        return [
          { header: 'Ratio', accessor: 'metric' },
          { header: 'Current', accessor: 'value' },
          { header: 'Target', accessor: 'benchmark' },
          { header: 'Change', accessor: 'trend' },
          { header: 'Last Quarter', accessor: 'lastQuarter' },
          { header: 'AI Optimization', accessor: 'aiSuggestion' }
        ];
      case 'debt':
        return [
          { header: 'Metric', accessor: 'metric' },
          { header: 'Value', accessor: 'value' },
          { header: 'Target', accessor: 'benchmark' },
          { header: 'Trend', accessor: 'trend' },
          { header: 'Last Quarter', accessor: 'lastQuarter' },
          { header: 'AI Risk Advice', accessor: 'aiSuggestion' }
        ];
      case 'budget':
        return [
          { header: 'Department', accessor: 'department' },
          { header: 'Allocated', accessor: 'allocated' },
          { header: 'Utilized', accessor: 'utilized' },
          { header: 'Variance', accessor: 'variance' },
          { header: 'Last Qtr Variance', accessor: 'lastQuarterVariance' },
          { header: 'AI Cost Advice', accessor: 'aiSuggestion' }
        ];
      case 'tax':
        return [
          { header: 'Area', accessor: 'area' },
          { header: 'Status', accessor: 'status' },
          { header: 'Risk Level', accessor: 'risk' },
          { header: 'Due Date', accessor: 'dueDate' },
          { header: 'Last Qtr Status', accessor: 'lastQuarterStatus' },
          { header: 'AI Compliance Tip', accessor: 'aiSuggestion' }
        ];
      case 'expense':
        return [
          { header: 'Category', accessor: 'category' },
          { header: 'Amount', accessor: 'amount' },
          { header: 'YoY Trend', accessor: 'trend' },
          { header: 'Last Quarter', accessor: 'lastQuarter' },
          { header: 'Is Optimized', accessor: 'isPositive' },
          { header: 'AI Savings Idea', accessor: 'aiSuggestion' }
        ];
      default:
        return [];
    }
  };

  const getIconForTab = (tab) => {
    switch (tab) {
      case 'liquidity': return <FiClock className="mr-2" />;
      case 'profitability': return <FiPercent className="mr-2" />;
      case 'debt': return <FiCreditCard className="mr-2" />;
      case 'budget': return <FiFileText className="mr-2" />;
      case 'tax': return <FiDollarSign className="mr-2" />;
      case 'expense': return <FiTrendingDown className="mr-2" />;
      default: return <FiDollarSign className="mr-2" />;
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
              <Link to="/finance-accounting-dashboard" className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                Finance Dashboard
              </Link>
            </div>
          </li>
          <li aria-current="page">
            <div className="flex items-center">
              <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Accounting Analytics</span>
            </div>
          </li>
        </ol>
      </nav>

      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Finance & Accounting Analytics</h1>
            <p className="text-sky-100 text-x">Financial health monitoring, risk management, and optimization insights</p>
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
              filename={`finance_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`}
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
            { id: 'liquidity', label: 'Liquidity' },
            { id: 'profitability', label: 'Profitability' },
            { id: 'debt', label: 'Debt Metrics' },
            { id: 'budget', label: 'Budget' },
            { id: 'tax', label: 'Tax & Compliance' },
            { id: 'expense', label: 'Expense Trends' }
          ].map((tab) => (
            <button
              key={tab.id}
              className={`flex items-center px-4 py-3 text-s font-medium whitespace-nowrap ${activeTab === tab.id ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500 hover:text-blue-500'}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {getIconForTab(tab.id)}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              {activeTab === 'liquidity' && 'Liquidity & Working Capital Analysis'}
              {activeTab === 'profitability' && 'Profitability Ratios'}
              {activeTab === 'debt' && 'Debt & Interest Coverage Metrics'}
              {activeTab === 'budget' && 'Budget Utilization & Variance Reports'}
              {activeTab === 'tax' && 'Tax & Compliance Risk Assessments'}
              {activeTab === 'expense' && 'Expense Trend Analysis'}
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
              <h3 className="text-s font-semibold text-blue-800 mb-2">AI Recommendations</h3>
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
                                  <FiTrendingUp className="mr-1" /> Optimized
                                </>
                              ) : (
                                <>
                                  <FiTrendingDown className="mr-1" /> Needs Work
                                </>
                              )}
                            </span>
                          </td>
                        );
                      }
                      if (column.accessor === 'risk') {
                        let bgColor = 'bg-green-100 text-green-800';
                        if (row.risk === 'Medium') bgColor = 'bg-yellow-100 text-yellow-800';
                        if (row.risk === 'High') bgColor = 'bg-red-100 text-red-800';
                        
                        return (
                          <td key={colIndex} className="px-4 py-3 whitespace-nowrap text-s">
                            <span className={`px-2 py-1 rounded-full text-x font-medium ${bgColor}`}>
                              {row.risk}
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

export default FinanceAccountingTable;