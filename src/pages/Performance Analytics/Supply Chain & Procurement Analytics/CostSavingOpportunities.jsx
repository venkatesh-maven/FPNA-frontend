import React, { useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import { FiInfo, FiDownload, FiFilter, FiChevronRight} from 'react-icons/fi';
import { Link, useNavigate } from "react-router-dom";
import { GrLinkNext } from "react-icons/gr";
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { getDecimalPrecision } from '../../../utils/formatters';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const CostSavingOpportunities = () => {
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiSuggestions, setAiSuggestions] = useState([]);

  useEffect(() => {
    // Simulate API calls
    const fetchData = async () => {
      // Mock vendor data
      const mockVendors = [
        { id: 1, name: 'Global Electronics Inc.', spend: 1250000, contractEnd: '2024-06-30', riskScore: 32 },
        { id: 2, name: 'Premium Materials Co.', spend: 980000, contractEnd: '2024-09-15', riskScore: 45 },
        { id: 3, name: 'Logistics Partners LLC', spend: 750000, contractEnd: '2024-12-31', riskScore: 28 },
        { id: 4, name: 'Office Solutions Ltd.', spend: 420000, contractEnd: '2024-08-20', riskScore: 51 },
        { id: 5, name: 'Industrial Components Corp.', spend: 680000, contractEnd: '2025-03-10', riskScore: 39 },
      ];

      // Mock AI suggestions
      const mockAiSuggestions = [
        {
          vendorId: 1,
          suggestions: [
            {
              category: 'Volume Discount',
              description: 'Increase order volume by 15% to qualify for tier 2 pricing (potential 8% savings)',
              potentialSavings: 100000,
              confidence: 0.85
            },
            {
              category: 'Payment Terms',
              description: 'Extend payment terms from 30 to 45 days for improved cash flow',
              potentialSavings: 25000,
              confidence: 0.78
            }
          ]
        },
        {
          vendorId: 2,
          suggestions: [
            {
              category: 'Alternative Materials',
              description: 'Switch to alternative material grade B (5% cost reduction with minimal quality impact)',
              potentialSavings: 49000,
              confidence: 0.92
            }
          ]
        },
        {
          vendorId: 3,
          suggestions: [
            {
              category: 'Route Optimization',
              description: 'Consolidate shipments to reduce LTL costs by 12%',
              potentialSavings: 90000,
              confidence: 0.87
            }
          ]
        },
        {
          vendorId: 4,
          suggestions: [
            {
              category: 'Contract Length',
              description: 'Extend contract to 3 years for additional 7% discount',
              potentialSavings: 29400,
              confidence: 0.81
            }
          ]
        },
        {
          vendorId: 5,
          suggestions: [
            {
              category: 'Bulk Purchasing',
              description: 'Annual bulk purchase commitment for 10% discount',
              potentialSavings: 68000,
              confidence: 0.89
            },
            {
              category: 'Early Payment',
              description: 'Take 2% discount for payment within 10 days',
              potentialSavings: 13600,
              confidence: 0.95
            }
          ]
        }
      ];

      setVendors(mockVendors);
      setAiSuggestions(mockAiSuggestions);
      setLoading(false);
    };

    fetchData();
  }, []);

  const handleVendorSelect = (vendor) => {
    setSelectedVendor(vendor);
  };

  const getVendorSuggestions = (vendorId) => {
    return aiSuggestions.find(item => item.vendorId === vendorId)?.suggestions || [];
  };

  const vendorChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Vendor Spend Analysis',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return '$' + (value / 1000) + 'k';
          }
        }
      }
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading cost-saving opportunities...</div>;
  }

  const exportToExcel = () => {
      const ws = XLSX.utils.json_to_sheet(riskData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'RiskAssessment');
      XLSX.writeFile(wb, 'Operational_Risk_Assessment.xlsx');
    };
  

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
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
                                        Supply Chain & Procurement
                                      </Link>
                                    </div>
                                  </li>
                                  <li aria-current="page">
                                    <div className="flex items-center">
                                      <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
                                      <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Freight & Logistics Optimization</span>
                                    </div>
                                  </li>
                                </ol>
                              </nav>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-5 bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
          <h1 className="text-2xl font-bold text-white">Cost-Saving Opportunity Identification</h1>
          <div className="flex space-x-4">
                      <button
                        onClick={exportToExcel}
                        className="bg-green-600 text-white px-3 py-1 rounded-md text-s hover:bg-green-700 flex items-center"
                      >
                        <FiDownload className="mr-1" /> Excel
                      </button>
                      {/* <button
                        onClick={exportToPDF}
                        className="bg-red-600 text-white px-3 py-1 rounded-md text-s hover:bg-red-700 flex items-center"
                      >
                        <FiDownload className="mr-1" /> PDF
                      </button> */}
                      <Link to="/SupplyChainTable">
                                                                        <button type="button" className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200">
                                                                          View More <GrLinkNext className="ml-1 w-5 h-5 hover:w-5 hover:h-5 transition-all" />
                                                                        </button>
                                                                      </Link>
                    </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Vendor Spend Chart */}
          <div className="lg:col-span-2 bg-white p-4 rounded-lg shadow">
            <Bar
              options={vendorChartOptions}
              data={{
                labels: vendors.map(v => v.name),
                datasets: [
                  {
                    label: 'Annual Spend',
                    data: vendors.map(v => v.spend),
                    backgroundColor: 'rgba(59, 130, 246, 0.5)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1,
                  },
                  {
                    label: 'Risk Score',
                    data: vendors.map(v => v.spend * v.riskScore / 100),
                    backgroundColor: 'rgba(239, 68, 68, 0.5)',
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 1,
                  }
                ],
              }}
            />
          </div>

          {/* Top Opportunities */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Top 5 Savings Opportunities</h2>
            <div className="space-y-4">
              {aiSuggestions.flatMap(v => v.suggestions)
                .sort((a, b) => b.potentialSavings - a.potentialSavings)
                .slice(0, 5)
                .map((suggestion, index) => (
                  <div key={index} className="border-l-4 border-blue-500 pl-3 py-2">
                    <h3 className="font-medium">{suggestion.category}</h3>
                    <p className="text-s text-gray-600">{suggestion.description}</p>
                    <p className="text-s font-semibold mt-1">Potential Savings: ${(suggestion.potentialSavings / 1000).toFixed(getDecimalPrecision())}k</p>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Vendor List and Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Vendor List */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Vendors with Savings Potential</h2>
            <div className="space-y-2">
              {vendors.map(vendor => (
                <div 
                  key={vendor.id} 
                  className={`p-3 rounded-md cursor-pointer ${selectedVendor?.id === vendor.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border'}`}
                  onClick={() => handleVendorSelect(vendor)}
                >
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium">{vendor.name}</h3>
                    <span className="text-s font-semibold">${(vendor.spend / 1000).toFixed(getDecimalPrecision())}k</span>
                  </div>
                  <div className="flex justify-between text-s text-gray-600 mt-1">
                    <span>Contract ends: {new Date(vendor.contractEnd).toLocaleDateString()}</span>
                    <span className={`px-2 rounded-full ${vendor.riskScore < 40 ? 'bg-green-100 text-green-800' : vendor.riskScore < 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                      Risk: {vendor.riskScore}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Vendor Details and AI Suggestions */}
          <div className="lg:col-span-2 bg-white p-4 rounded-lg shadow">
            {selectedVendor ? (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">{selectedVendor.name}</h2>
                  <div className="text-s">
                    <span className="font-medium">Annual Spend:</span> ${(selectedVendor.spend / 1000).toFixed(getDecimalPrecision())}k
                  </div>
                </div>

                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold text-blue-800 mb-2">AI Analysis Summary</h3>
                  <p className="text-s text-gray-700">
                    Our AI has analyzed this vendor's contract, market benchmarks, and your purchasing patterns to identify {getVendorSuggestions(selectedVendor.id).length} potential cost-saving opportunities.
                  </p>
                </div>

                <h3 className="font-semibold mb-3">Recommended Negotiation Strategies</h3>
                <div className="space-y-4">
                  {getVendorSuggestions(selectedVendor.id).length > 0 ? (
                    getVendorSuggestions(selectedVendor.id).map((suggestion, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{suggestion.category}</h4>
                            <p className="text-s text-gray-600 mt-1">{suggestion.description}</p>
                          </div>
                          <div className="text-right">
                            <span className="inline-block px-2 py-1 bg-green-100 text-green-800 rounded-full text-x font-semibold">
                              ${(suggestion.potentialSavings / 1000).toFixed(getDecimalPrecision())}k savings
                            </span>
                            <div className="mt-2">
                              <span className="text-x font-medium">AI Confidence: </span>
                              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full" 
                                  style={{ width: `${suggestion.confidence * 100}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t">
                          <button className="text-x bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700">
                            Add to Negotiation Plan
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      No specific suggestions available for this vendor.
                    </div>
                  )}
                </div>
              </div>
            ) : (
                <div className="mt-6 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Total Savings Potential</h2>
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <div className="border p-4 rounded-lg">
              <h3 className="font-medium text-gray-700">Immediate Opportunities</h3>
              <p className="text-2xl font-bold text-green-600">
                ${(aiSuggestions.flatMap(v => v.suggestions)
                  .reduce((sum, s) => sum + s.potentialSavings, 0) / 1000).toFixed(getDecimalPrecision())}k
              </p>
              <p className="text-s text-gray-600 mt-1">From contract renegotiations</p>
            </div>
            <div className="border p-4 rounded-lg">
              <h3 className="font-medium text-gray-700">Strategic Alternatives</h3>
              <p className="text-2xl font-bold text-blue-600">
                ${(aiSuggestions.flatMap(v => v.suggestions)
                  .reduce((sum, s) => sum + s.potentialSavings, 0) * 1.5 / 1000).toFixed(getDecimalPrecision())}k
              </p>
              <p className="text-s text-gray-600 mt-1">With vendor diversification</p>
            </div>
            <div className="border p-4 rounded-lg">
              <h3 className="font-medium text-gray-700">Annual Impact</h3>
              <p className="text-2xl font-bold text-purple-600">
                Up to 12.5%
              </p>
              <p className="text-s text-gray-600 mt-1">Potential procurement cost reduction</p>
            </div>
          </div>
        </div>
            )}
          </div>
        </div>

        {/* Total Savings Potential */}
        {/* <div className="mt-6 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Total Savings Potential</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border p-4 rounded-lg">
              <h3 className="font-medium text-gray-700">Immediate Opportunities</h3>
              <p className="text-2xl font-bold text-green-600">
                ${(aiSuggestions.flatMap(v => v.suggestions)
                  .reduce((sum, s) => sum + s.potentialSavings, 0) / 1000).toFixed(getDecimalPrecision())}k
              </p>
              <p className="text-s text-gray-600 mt-1">From contract renegotiations</p>
            </div>
            <div className="border p-4 rounded-lg">
              <h3 className="font-medium text-gray-700">Strategic Alternatives</h3>
              <p className="text-2xl font-bold text-blue-600">
                ${(aiSuggestions.flatMap(v => v.suggestions)
                  .reduce((sum, s) => sum + s.potentialSavings, 0) * 1.5 / 1000).toFixed(getDecimalPrecision())}k
              </p>
              <p className="text-s text-gray-600 mt-1">With vendor diversification</p>
            </div>
            <div className="border p-4 rounded-lg">
              <h3 className="font-medium text-gray-700">Annual Impact</h3>
              <p className="text-2xl font-bold text-purple-600">
                Up to 12.5%
              </p>
              <p className="text-s text-gray-600 mt-1">Potential procurement cost reduction</p>
            </div>
          </div>
        </div> */}
      </div>
    </div>
  );
};

export default CostSavingOpportunities; 