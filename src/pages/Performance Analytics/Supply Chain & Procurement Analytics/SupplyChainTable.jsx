
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiDownload, FiChevronRight, FiDollarSign, FiTruck, FiPackage, FiAlertTriangle, FiFilter, FiSend } from 'react-icons/fi';
import { BsStars, BsBoxSeam, BsShieldCheck, BsGraphUp } from 'react-icons/bs';
import { CSVLink } from 'react-csv';
import * as XLSX from 'xlsx';
import { Tooltip as ReactTooltip } from 'react-tooltip'; // Renamed to avoid conflict if used
import { motion } from 'framer-motion';

const SupplyChainTable = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('supplierPerformance');
  const [aiInput, setAiInput] = useState('');
  const [aiResponses, setAiResponses] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(false);

  // --- DATA DEFINITIONS ---

  // Supplier Performance Scorecard Data
  const supplierPerformanceData = [
    { id: 1, supplier: 'Acme Materials', onTimeDelivery: '98%', contractAdherence: '95%', costCompetitiveness: '4.8/5', riskLevel: 'Low', aiSuggestion: 'Top performer. Lock in long-term contract.', aiScore: 92 },
    { id: 2, supplier: 'Global Logistics', onTimeDelivery: '89%', contractAdherence: '91%', costCompetitiveness: '4.2/5', riskLevel: 'Medium', aiSuggestion: 'Delivery slipping. Monitor closely and explore alternatives.', aiScore: 75 },
    { id: 3, supplier: 'Tech Components Inc', onTimeDelivery: '93%', contractAdherence: '97%', costCompetitiveness: '4.6/5', riskLevel: 'Low', aiSuggestion: 'Strong performer. Good candidate for strategic partnership.', aiScore: 88 },
    { id: 4, supplier: 'Bulk Goods Co.', onTimeDelivery: '95%', contractAdherence: '90%', costCompetitiveness: '4.1/5', riskLevel: 'Medium', aiSuggestion: 'Cost slightly high for adherence level. Negotiate volume discounts.', aiScore: 80 },
    { id: 5, supplier: 'Precision Parts Ltd.', onTimeDelivery: '99%', contractAdherence: '98%', costCompetitiveness: '4.9/5', riskLevel: 'Low', aiSuggestion: 'Excellent. Consider for critical components.', aiScore: 95 },
    { id: 6, supplier: 'Overseas Solutions', onTimeDelivery: '85%', contractAdherence: '88%', costCompetitiveness: '3.9/5', riskLevel: 'High', aiSuggestion: 'High risk, lower performance. Develop contingency plan.', aiScore: 60 },
  ];

  // Inventory Turnover Analysis Data
  const inventoryAnalysisData = [
    { id: 1, category: 'Electronics', turnoverRate: '5.2x', stockLevelDays: '45 days', carryingCost: '$12,500', reorderEfficiency: '88%', aiSuggestion: 'Good turnover. Optimize stock for key SKUs to reduce carrying cost.', aiScore: 82 },
    { id: 2, category: 'Raw Materials', turnoverRate: '3.8x', stockLevelDays: '68 days', carryingCost: '$8,200', reorderEfficiency: '75%', aiSuggestion: 'Slow turnover, high stock. Review demand forecasting.', aiScore: 65 },
    { id: 3, category: 'Packaging', turnoverRate: '7.1x', stockLevelDays: '32 days', carryingCost: '$3,100', reorderEfficiency: '92%', aiSuggestion: 'Excellent turnover. Ensure no stockouts during peak.', aiScore: 90 },
    { id: 4, category: 'Finished Goods A', turnoverRate: '4.5x', stockLevelDays: '55 days', carryingCost: '$18,000', reorderEfficiency: '80%', aiSuggestion: 'Carrying cost high for this turnover. Investigate storage.', aiScore: 70 },
    { id: 5, category: 'Finished Goods B', turnoverRate: '6.0x', stockLevelDays: '40 days', carryingCost: '$9,500', reorderEfficiency: '85%', aiSuggestion: 'Balanced. Monitor seasonal demand shifts.', aiScore: 78 },
  ];

  // Procurement Spend Breakdown Data
  const procurementSpendData = [
    { id: 1, category: 'Electronics', vendorPayments: '$350,000', budget: '$320,000', variance: '+9.38%', costVarianceTracking: 'Over Budget', aiSuggestion: 'Electronics spend over budget. Review component pricing.', aiScore: 60 },
    { id: 2, category: 'Raw Materials', vendorPayments: '$250,000', budget: '$260,000', variance: '-3.85%', costVarianceTracking: 'Under Budget', aiSuggestion: 'Raw material costs well managed. Explore bulk discounts.', aiScore: 85 },
    { id: 3, category: 'Packaging', vendorPayments: '$150,000', budget: '$140,000', variance: '+7.14%', costVarianceTracking: 'Over Budget', aiSuggestion: 'Packaging costs increased. Evaluate alternative suppliers.', aiScore: 68 },
    { id: 4, category: 'Logistics', vendorPayments: '$150,000', budget: '$160,000', variance: '-6.25%', costVarianceTracking: 'Under Budget', aiSuggestion: 'Logistics spend efficient. Could consolidate shipments.', aiScore: 80 },
    { id: 5, category: 'Services (Consulting, Maintenance)', vendorPayments: '$100,000', budget: '$120,000', variance: '-16.67%', costVarianceTracking: 'Under Budget', aiSuggestion: 'Service costs significantly under. Verify scope completion.', aiScore: 90 },
  ];

  // Freight & Logistics Optimization Data
  const freightLogisticsData = [
    { id: 1, route: 'Asia-NA West Coast', mode: 'Ocean', shippingCost: '$85,000', avgLeadTimeDays: '35 days', onTimeDelivery: '88%', aiSuggestion: 'High volume route. Slight delay in lead time. Optimize container utilization.', aiScore: 78 },
    { id: 2, route: 'EU-NA East Coast', mode: 'Air', shippingCost: '$120,000', avgLeadTimeDays: '7 days', onTimeDelivery: '95%', aiSuggestion: 'Expensive but fast. Use for critical/high-value shipments only.', aiScore: 85 },
    { id: 3, route: 'Domestic US-Midwest', mode: 'Truck', shippingCost: '$45,000', avgLeadTimeDays: '3 days', onTimeDelivery: '98%', aiSuggestion: 'Efficient. Explore LTL consolidation for further savings.', aiScore: 92 },
    { id: 4, route: 'LatAm-NA South', mode: 'Ocean/Truck', shippingCost: '$60,000', avgLeadTimeDays: '25 days', onTimeDelivery: '90%', aiSuggestion: 'Good performance. Monitor port congestion impact.', aiScore: 80 },
  ];

  // Operational Risk Assessment Data
  const operationalRiskData = [
    { id: 1, supplier: 'Acme Materials', dependencyRisk: 'Medium (Single Source for X)', geopoliticalRisk: 'Low (Domestic)', financialRisk: 'Low', overallRiskScore: '4/10', aiSuggestion: 'Diversify sourcing for component X to mitigate dependency.', aiScore: 70 },
    { id: 2, supplier: 'Global Logistics', dependencyRisk: 'High (Primary Logistics)', geopoliticalRisk: 'Medium (Global Routes)', financialRisk: 'Medium', overallRiskScore: '7/10', aiSuggestion: 'High overall risk. Develop backup logistics partner relationships.', aiScore: 55 },
    { id: 3, supplier: 'Overseas Solutions', dependencyRisk: 'High (Sole Supplier for Y)', geopoliticalRisk: 'High (Region Z)', financialRisk: 'High', overallRiskScore: '9/10', aiSuggestion: 'Critical risk. Expedite search for alternative for Y.', aiScore: 30 },
    { id: 4, supplier: 'Tech Components Inc', dependencyRisk: 'Low (Multiple Sources)', geopoliticalRisk: 'Low (Stable Region)', financialRisk: 'Low', overallRiskScore: '2/10', aiSuggestion: 'Low risk. Maintain strong relationship.', aiScore: 90 },
  ];

  // Cost-Saving Opportunity Identification Data
  const costSavingData = [
    { id: 1, opportunity: 'Renegotiate with Global Logistics', currentSpend: '$1.2M/year', potentialSaving: '$144,000 (12%)', confidence: '75%', action: 'Initiate renegotiation based on volume.', aiSuggestion: 'AI projects 75% success probability for 10-12% savings by leveraging volume increase.', aiScore: 80 },
    { id: 2, opportunity: 'Consolidate electronics suppliers (A&B)', currentSpend: '$800K/year', potentialSaving: '$72,000 (9%)', confidence: '65%', action: 'RFQ for consolidated volume.', aiSuggestion: 'Consolidation could yield 8-10% savings. Ensure quality standards are met by chosen supplier.', aiScore: 72 },
    { id: 3, opportunity: 'Switch to regional packaging supplier', currentSpend: '$300K/year', potentialSaving: '$30,000 (10%)', confidence: '80%', action: 'Source and vet regional packaging options.', aiSuggestion: 'Regional sourcing likely to reduce freight and lead times. AI estimates 10% net savings.', aiScore: 85 },
    { id: 4, opportunity: 'Optimize Inventory for Raw Material Z', currentSpend: '$50K (carrying cost)', potentialSaving: '$15,000 (30%)', confidence: '70%', action: 'Implement JIT for Material Z.', aiSuggestion: 'Reducing safety stock for Material Z could save significantly in carrying costs. Monitor supply stability.', aiScore: 77 },
  ];
  
  // AI Suggestions for each tab
  const aiTabSuggestions = {
    supplierPerformance: "Overall supplier performance is strong, with an average on-time delivery of 93%. Focus on mitigating risks with 'Global Logistics' and 'Overseas Solutions'. AI predicts a 5% improvement in overall score by addressing these two.",
    inventoryAnalysis: "Inventory turnover varies significantly by category. 'Raw Materials' show slow turnover. Implementing demand-driven replenishment for raw materials could reduce carrying costs by 15%.",
    procurementSpend: "Spend is generally well-managed, but 'Electronics' and 'Packaging' are over budget. AI suggests exploring alternative suppliers for packaging could yield 8-12% cost reduction.",
    freightLogistics: "Air freight for EU-NA route is costly but maintains high on-time delivery. AI indicates that shifting 20% of non-urgent air freight to ocean on this route could save $25K/quarter with minimal impact on lead times for those items.",
    operationalRisk: "'Overseas Solutions' poses the highest operational risk. Prioritize developing alternative sources. AI identifies a 60% chance of disruption from this supplier in the next 12 months.",
    costSaving: "Significant cost-saving opportunities exist, particularly in logistics renegotiation and inventory optimization. AI models suggest pursuing the top 3 opportunities could yield over $200K in annual savings."
  };

  // --- END DATA DEFINITIONS ---

  const handleSendAIQuery = () => {
    if (!aiInput.trim()) return;
    // Mock AI response based on active tab
    const mockResponse = `AI insights for ${activeTab}: ${aiTabSuggestions[activeTab] || 'Further analysis required for this specific query.'}`;
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
    XLSX.writeFile(workbook, `SupplyChain_${sheetName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const getCurrentData = () => {
    switch (activeTab) {
      case 'supplierPerformance': return supplierPerformanceData;
      case 'inventoryAnalysis': return inventoryAnalysisData;
      case 'procurementSpend': return procurementSpendData;
      case 'freightLogistics': return freightLogisticsData;
      case 'operationalRisk': return operationalRiskData;
      case 'costSaving': return costSavingData;
      default: return [];
    }
  };

  const getCurrentColumns = () => {
    switch (activeTab) {
      case 'supplierPerformance':
        return [
          { header: 'Supplier', accessor: 'supplier' },
          { header: 'On-Time Delivery', accessor: 'onTimeDelivery' },
          { header: 'Contract Adherence', accessor: 'contractAdherence' },
          { header: 'Cost Competitiveness', accessor: 'costCompetitiveness' },
          { header: 'Risk Level', accessor: 'riskLevel' },
          { header: 'AI Score', accessor: 'aiScore' },
          { header: 'AI Insight', accessor: 'aiSuggestion' },
        ];
      case 'inventoryAnalysis':
        return [
          { header: 'Category', accessor: 'category' },
          { header: 'Turnover Rate', accessor: 'turnoverRate' },
          { header: 'Stock Level (Days)', accessor: 'stockLevelDays' },
          { header: 'Carrying Cost', accessor: 'carryingCost' },
          { header: 'Reorder Efficiency', accessor: 'reorderEfficiency' },
          { header: 'AI Score', accessor: 'aiScore' },
          { header: 'AI Insight', accessor: 'aiSuggestion' },
        ];
      case 'procurementSpend':
        return [
          { header: 'Category', accessor: 'category' },
          { header: 'Vendor Payments', accessor: 'vendorPayments' },
          { header: 'Budget', accessor: 'budget' },
          { header: 'Variance (%)', accessor: 'variance' },
          { header: 'Status', accessor: 'costVarianceTracking' },
          { header: 'AI Score', accessor: 'aiScore' },
          { header: 'AI Insight', accessor: 'aiSuggestion' },
        ];
      case 'freightLogistics':
        return [
          { header: 'Route', accessor: 'route' },
          { header: 'Mode', accessor: 'mode' },
          { header: 'Shipping Cost', accessor: 'shippingCost' },
          { header: 'Avg. Lead Time (Days)', accessor: 'avgLeadTimeDays' },
          { header: 'On-Time %', accessor: 'onTimeDelivery' },
          { header: 'AI Score', accessor: 'aiScore' },
          { header: 'AI Insight', accessor: 'aiSuggestion' },
        ];
      case 'operationalRisk':
        return [
          { header: 'Supplier', accessor: 'supplier' },
          { header: 'Dependency Risk', accessor: 'dependencyRisk' },
          { header: 'Geopolitical Risk', accessor: 'geopoliticalRisk' },
          { header: 'Financial Risk', accessor: 'financialRisk' },
          { header: 'Overall Score (Lower is Better)', accessor: 'overallRiskScore' },
          { header: 'AI Score (Higher is Better for Insight Quality)', accessor: 'aiScore' },
          { header: 'AI Insight', accessor: 'aiSuggestion' },
        ];
      case 'costSaving':
        return [
          { header: 'Opportunity', accessor: 'opportunity' },
          { header: 'Current Spend', accessor: 'currentSpend' },
          { header: 'Potential Saving', accessor: 'potentialSaving' },
          { header: 'AI Confidence', accessor: 'confidence' },
          { header: 'Recommended Action', accessor: 'action' },
          { header: 'AI Score', accessor: 'aiScore' },
          { header: 'AI Insight', accessor: 'aiSuggestion' },
        ];
      default:
        return [];
    }
  };

  const tabConfig = [
    { id: 'supplierPerformance', label: 'Supplier Performance' },
    { id: 'inventoryAnalysis', label: 'Inventory Analysis' },
    { id: 'procurementSpend', label: 'Procurement Spend' },
    { id: 'freightLogistics', label: 'Freight & Logistics' },
    { id: 'operationalRisk', label: 'Operational Risk' },
    { id: 'costSaving', label: 'Cost Savings' },
  ];

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
              <Link to="/SupplyChainAnalytics" className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                Supply Chain Analytics
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
            <h1 className="text-lg font-bold text-white">Supply Chain & Procurement Data</h1>
            <p className="text-sky-100 text-x">Detailed tabular view of supply chain metrics with AI insights</p>
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
              filename={`SupplyChain_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`}
              className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200"
            >
              <FiDownload className="mr-1" /> Export to CSV
            </CSVLink>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {tabConfig.map((tab) => (
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
              {tabConfig.find(t => t.id === activeTab)?.label || 'Data Table'}
            </h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowAIDropdown(!showAIDropdown)}
                className="flex items-center px-3 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-s"
              >
                <BsStars className="mr-1" /> AI Insights for this Table
              </button>
            </div>
          </div>

          {showAIDropdown && (
            <motion.div
              className="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-100"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h3 className="text-s font-semibold text-blue-800 mb-2">AI Suggestions for {tabConfig.find(t => t.id === activeTab)?.label}</h3>
              <p className="text-s text-blue-700 mb-3">{aiTabSuggestions[activeTab]}</p>
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
                  <tr key={row.id || rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50 hover:bg-sky-50'}>
                    {getCurrentColumns().map((column, colIndex) => {
                      const cellValue = row[column.accessor];
                      if (column.accessor === 'aiSuggestion') {
                        return (
                          <td key={colIndex} className="px-4 py-3 text-s text-gray-700 max-w-xs">
                            <div className="flex items-start">
                              <BsStars className="flex-shrink-0 mt-0.5 mr-2 text-blue-500" />
                              <span className="text-x">{cellValue}</span>
                            </div>
                          </td>
                        );
                      }
                      if (column.accessor === 'aiScore' || column.accessor === 'confidence') {
                        const score = parseFloat(cellValue);
                        let bgColor = 'bg-red-100 text-red-800';
                        if (score >= 80) bgColor = 'bg-green-100 text-green-800';
                        else if (score >= 65) bgColor = 'bg-yellow-100 text-yellow-800';
                        
                        return (
                          <td key={colIndex} className="px-4 py-3 whitespace-nowrap text-s">
                            <span className={`px-2 py-1 rounded-full text-x font-medium ${bgColor}`}>
                              {cellValue}{column.accessor === 'aiScore' ? '' : '%'}
                            </span>
                          </td>
                        );
                      }
                       if (column.accessor === 'riskLevel' || column.accessor === 'dependencyRisk' || column.accessor === 'geopoliticalRisk' || column.accessor === 'financialRisk' ) {
                        let riskColor = 'text-gray-700';
                        if (cellValue?.toLowerCase() === 'low') riskColor = 'text-green-600';
                        else if (cellValue?.toLowerCase() === 'medium') riskColor = 'text-yellow-600';
                        else if (cellValue?.toLowerCase() === 'high') riskColor = 'text-red-600';
                        return (
                            <td key={colIndex} className={`px-4 py-3 whitespace-nowrap text-s font-medium ${riskColor}`}>
                                {cellValue}
                            </td>
                        );
                      }
                      if (column.accessor === 'costVarianceTracking') {
                        let statusColor = 'text-gray-700';
                        if (cellValue?.toLowerCase().includes('under')) statusColor = 'text-green-600';
                        else if (cellValue?.toLowerCase().includes('over')) statusColor = 'text-red-600';
                         return (
                            <td key={colIndex} className={`px-4 py-3 whitespace-nowrap text-s font-medium ${statusColor}`}>
                                {cellValue}
                            </td>
                        );
                      }
                      return (
                        <td key={colIndex} className="px-4 py-3 whitespace-nowrap text-s text-gray-700">
                          {cellValue}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* AI Summary Box for the current tab */}
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
                <h3 className="text-s font-semibold text-blue-800">AI Analysis Summary for {tabConfig.find(t => t.id === activeTab)?.label}</h3>
                <p className="text-s text-blue-700 mt-1">{aiTabSuggestions[activeTab]}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
      <ReactTooltip id="global-table-tooltip" />
    </div>
  );
};

export default SupplyChainTable;
