import { useState } from 'react';
import { 
  FiPieChart, 
  FiDollarSign, 
  FiTrendingUp, 
  FiBarChart2,
  FiSettings,
  FiDownload,
  FiChevronRight,
  FiChevronDown,
  FiRefreshCw
} from 'react-icons/fi';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

const ProfitabilityEnhancement = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedSections, setExpandedSections] = useState({
    costStructure: true,
    marginAnalysis: false,
    efficiency: false
  });

  // Chart data
  const marginTrendData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Gross Margin',
        data: [42, 45, 44, 46, 48, 47],
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        fill: true,
        tension: 0.3
      },
      {
        label: 'Net Margin',
        data: [18, 20, 19, 21, 22, 21],
        borderColor: 'rgba(153, 102, 255, 1)',
        backgroundColor: 'rgba(153, 102, 255, 0.1)',
        fill: true,
        tension: 0.3
      }
    ]
  };

  const costBreakdownData = {
    labels: ['COGS', 'Operations', 'Marketing', 'R&D', 'Admin'],
    datasets: [{
      data: [45, 20, 15, 12, 8],
      backgroundColor: [
        'rgba(255, 99, 132, 0.7)',
        'rgba(54, 162, 235, 0.7)',
        'rgba(255, 206, 86, 0.7)',
        'rgba(75, 192, 192, 0.7)',
        'rgba(153, 102, 255, 0.7)'
      ],
      borderWidth: 1
    }]
  };

  const efficiencyData = {
    labels: ['Revenue/Employee', 'Profit/Employee', 'Asset Turnover', 'Inventory Turns'],
    datasets: [
      {
        label: 'Your Company',
        data: [120, 25, 1.8, 5.2],
        backgroundColor: 'rgba(54, 162, 235, 0.7)'
      },
      {
        label: 'Industry Avg',
        data: [95, 18, 1.5, 4.8],
        backgroundColor: 'rgba(255, 159, 64, 0.7)'
      }
    ]
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800 flex items-center">
            <FiPieChart className="mr-2 text-blue-600" />
            Profitability
          </h2>
          <p className="text-x text-gray-500">Enhancement strategies</p>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <nav className="p-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center p-3 rounded-lg mb-1 ${activeTab === 'overview' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <FiPieChart className="mr-3" />
              Profitability Overview
            </button>
            
            <button
              onClick={() => setActiveTab('cost')}
              className={`w-full flex items-center p-3 rounded-lg mb-1 ${activeTab === 'cost' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <FiDollarSign className="mr-3" />
              Cost Optimization
            </button>
            
            <button
              onClick={() => setActiveTab('margin')}
              className={`w-full flex items-center p-3 rounded-lg mb-1 ${activeTab === 'margin' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <FiTrendingUp className="mr-3" />
              Margin Enhancement
            </button>
            
            <button
              onClick={() => setActiveTab('efficiency')}
              className={`w-full flex items-center p-3 rounded-lg mb-1 ${activeTab === 'efficiency' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <FiBarChart2 className="mr-3" />
              Efficiency Metrics
            </button>
            
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center p-3 rounded-lg ${activeTab === 'settings' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <FiSettings className="mr-3" />
              Settings
            </button>
          </nav>
        </div>
        
        <div className="p-4 border-t border-gray-200">
          <button className="w-full flex items-center justify-center py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <FiDownload className="mr-2" />
            Export Report
          </button>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {activeTab === 'overview' && 'Profitability Overview'}
              {activeTab === 'cost' && 'Cost Optimization Strategies'}
              {activeTab === 'margin' && 'Margin Enhancement'}
              {activeTab === 'efficiency' && 'Efficiency Metrics'}
              {activeTab === 'settings' && 'Settings'}
            </h1>
            <p className="text-gray-600">
              {activeTab === 'overview' && 'Key metrics and trends impacting profitability'}
              {activeTab === 'cost' && 'AI-identified opportunities to reduce costs'}
              {activeTab === 'margin' && 'Strategies to improve gross and net margins'}
              {activeTab === 'efficiency' && 'Operational efficiency benchmarks'}
              {activeTab === 'settings' && 'Configure profitability parameters'}
            </p>
          </div>
          <button className="flex items-center text-s bg-white py-2 px-3 rounded-lg border border-gray-300 hover:bg-gray-50">
            <FiRefreshCw className="mr-2" />
            Refresh Data
          </button>
        </div>
        
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="text-s text-gray-500">Gross Margin</div>
                <div className="text-2xl font-bold text-green-600">47.2%</div>
                <div className="text-x text-gray-500 flex items-center">
                  <span className="text-green-500 mr-1">↑ 2.1%</span> vs last quarter
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="text-s text-gray-500">Net Margin</div>
                <div className="text-2xl font-bold text-blue-600">21.5%</div>
                <div className="text-x text-gray-500 flex items-center">
                  <span className="text-green-500 mr-1">↑ 1.3%</span> vs last quarter
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="text-s text-gray-500">EBITDA</div>
                <div className="text-2xl font-bold text-purple-600">28.7%</div>
                <div className="text-x text-gray-500">Industry: 24.2%</div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="text-s text-gray-500">Potential Upside</div>
                <div className="text-2xl font-bold text-orange-600">5.8%</div>
                <div className="text-x text-gray-500">With optimizations</div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="h-80">
                <Line 
                  data={marginTrendData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      tooltip: {
                        callbacks: {
                          label: function(context) {
                            return `${context.dataset.label}: ${context.raw}%`;
                          }
                        }
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: false,
                        min: 15,
                        max: 50,
                        ticks: {
                          callback: function(value) {
                            return value + '%';
                          }
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>
            
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h3 className="font-medium mb-3">Top Margin Drivers</h3>
                <ul className="space-y-2">
                  <li className="flex justify-between">
                    <span>Product Mix Shift</span>
                    <span className="text-green-600">+2.1%</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Supplier Negotiations</span>
                    <span className="text-green-600">+1.5%</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Operational Efficiency</span>
                    <span className="text-green-600">+0.8%</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h3 className="font-medium mb-3">Margin Headwinds</h3>
                <ul className="space-y-2">
                  <li className="flex justify-between">
                    <span>Material Costs</span>
                    <span className="text-red-600">-1.2%</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Wage Inflation</span>
                    <span className="text-red-600">-0.7%</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Currency Impact</span>
                    <span className="text-red-600">-0.4%</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h3 className="font-medium mb-3">Quick Wins</h3>
                <ul className="space-y-2 text-s">
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    <span>Automate invoice processing ($15K savings)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    <span>Renegotiate 3 vendor contracts (1.2% margin boost)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    <span>Shift 15% marketing budget to higher ROI channels</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
        
        {/* Cost Optimization Tab */}
        {activeTab === 'cost' && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-medium">Cost Structure Analysis</h2>
                <button 
                  onClick={() => toggleSection('costStructure')}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {expandedSections.costStructure ? <FiChevronDown /> : <FiChevronRight />}
                </button>
              </div>
              
              {expandedSections.costStructure && (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="h-64">
                    <Doughnut 
                      data={costBreakdownData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { position: 'right' },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                return `${context.label}: ${context.raw}% of revenue`;
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                  <div>
                    <h3 className="font-medium mb-3">Top Cost Reduction Opportunities</h3>
                    <div className="space-y-3">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="flex justify-between">
                          <span className="font-medium">Supplier Consolidation</span>
                          <span className="text-green-600">12-15% savings</span>
                        </div>
                        <p className="text-s text-gray-600 mt-1">
                          3 material categories with duplicate suppliers identified
                        </p>
                      </div>
                      
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="flex justify-between">
                          <span className="font-medium">SaaS Optimization</span>
                          <span className="text-green-600">$28K savings</span>
                        </div>
                        <p className="text-s text-gray-600 mt-1">
                          18 underutilized software licenses across departments
                        </p>
                      </div>
                      
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="flex justify-between">
                          <span className="font-medium">Energy Efficiency</span>
                          <span className="text-green-600">8% reduction</span>
                        </div>
                        <p className="text-s text-gray-600 mt-1">
                          LED lighting upgrade with 14 month payback period
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h3 className="font-medium mb-3">Cost by Department</h3>
                <div className="h-64">
                  <Bar 
                    data={{
                      labels: ['R&D', 'Marketing', 'Sales', 'Operations', 'Admin'],
                      datasets: [{
                        label: 'Cost per Employee ($K)',
                        data: [28, 32, 25, 18, 15],
                        backgroundColor: 'rgba(54, 162, 235, 0.7)'
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: {
                          beginAtZero: true
                        }
                      }
                    }}
                  />
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h3 className="font-medium mb-3">Cost Benchmarking</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-s mb-1">
                      <span>Admin Cost % Revenue</span>
                      <span>8.2%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-red-500 h-2 rounded-full" 
                        style={{width: '82%'}}
                      ></div>
                    </div>
                    <div className="text-x text-gray-500 mt-1">Industry best: 5.8%</div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-s mb-1">
                      <span>Marketing % Revenue</span>
                      <span>15.3%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{width: '65%'}}
                      ></div>
                    </div>
                    <div className="text-x text-gray-500 mt-1">Industry avg: 12.1%</div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-s mb-1">
                      <span>Facilities Cost/Employee</span>
                      <span>$8.2K</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-500 h-2 rounded-full" 
                        style={{width: '58%'}}
                      ></div>
                    </div>
                    <div className="text-x text-gray-500 mt-1">Peer avg: $7.1K</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Margin Enhancement Tab */}
        {activeTab === 'margin' && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <h2 className="font-medium mb-4">Margin Enhancement Strategies</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
                  <h3 className="font-bold text-green-800 mb-2">Product Mix</h3>
                  <p className="text-s text-gray-700 mb-3">
                    Shift 15% of volume to higher-margin products (A & C)
                  </p>
                  <div className="text-x text-gray-600">
                    <span className="font-medium">Impact:</span> +2.8% gross margin
                  </div>
                </div>
                
                <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                  <h3 className="font-bold text-blue-800 mb-2">Pricing</h3>
                  <p className="text-s text-gray-700 mb-3">
                    Implement 5% price increase on low-elasticity products
                  </p>
                  <div className="text-x text-gray-600">
                    <span className="font-medium">Impact:</span> +1.5% net margin
                  </div>
                </div>
                
                <div className="p-4 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                  <h3 className="font-bold text-purple-800 mb-2">Operations</h3>
                  <p className="text-s text-gray-700 mb-3">
                    Automate 3 manual processes in order fulfillment
                  </p>
                  <div className="text-x text-gray-600">
                    <span className="font-medium">Impact:</span> +0.9% operating margin
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-medium">Margin by Product Line</h2>
                <button 
                  onClick={() => toggleSection('marginAnalysis')}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {expandedSections.marginAnalysis ? <FiChevronDown /> : <FiChevronRight />}
                </button>
              </div>
              
              {expandedSections.marginAnalysis && (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="h-64">
                    <Bar 
                      data={{
                        labels: ['Product A', 'Product B', 'Product C', 'Service X'],
                        datasets: [
                          {
                            label: 'Gross Margin',
                            data: [52, 38, 48, 62],
                            backgroundColor: 'rgba(75, 192, 192, 0.7)'
                          },
                          {
                            label: 'Net Margin',
                            data: [28, 15, 22, 35],
                            backgroundColor: 'rgba(153, 102, 255, 0.7)'
                          }
                        ]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: {
                              callback: function(value) {
                                return value + '%';
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                  <div>
                    <h3 className="font-medium mb-3">Optimization Opportunities</h3>
                    <div className="space-y-3">
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <div className="flex justify-between">
                          <span className="font-medium">Product B COGS Reduction</span>
                          <span className="text-green-600">+5% margin</span>
                        </div>
                        <p className="text-s text-gray-600 mt-1">
                          Source alternative materials from 3 pre-vetted suppliers
                        </p>
                      </div>
                      
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <div className="flex justify-between">
                          <span className="font-medium">Service X Packaging</span>
                          <span className="text-green-600">+8% margin</span>
                        </div>
                        <p className="text-s text-gray-600 mt-1">
                          Premium tier with additional features at 15% higher price
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Efficiency Metrics Tab */}
        {activeTab === 'efficiency' && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-medium">Efficiency Benchmarks</h2>
                <button 
                  onClick={() => toggleSection('efficiency')}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {expandedSections.efficiency ? <FiChevronDown /> : <FiChevronRight />}
                </button>
              </div>
              
              {expandedSections.efficiency && (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="h-64">
                    <Bar 
                      data={efficiencyData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                          x: {
                            grid: {
                              display: false
                            }
                          },
                          y: {
                            beginAtZero: true
                          }
                        }
                      }}
                    />
                  </div>
                  <div>
                    <h3 className="font-medium mb-3">Improvement Opportunities</h3>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-s mb-1">
                          <span>Revenue per Employee</span>
                          <span className="text-green-600">+26% vs industry</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{width: '80%'}}
                          ></div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-s mb-1">
                          <span>Inventory Turns</span>
                          <span className="text-green-600">+8% vs industry</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full" 
                            style={{width: '65%'}}
                          ></div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-s mb-1">
                          <span>Asset Turnover</span>
                          <span className="text-red-600">-20% opportunity</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-purple-500 h-2 rounded-full" 
                            style={{width: '45%'}}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h3 className="font-medium mb-3">Working Capital Efficiency</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-s">Days Sales Outstanding</span>
                    <span className="font-medium">42 days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-s">Days Payable Outstanding</span>
                    <span className="font-medium">58 days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-s">Inventory Days</span>
                    <span className="font-medium">35 days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-s">Cash Conversion Cycle</span>
                    <span className="font-medium">19 days</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h3 className="font-medium mb-3">Efficiency Actions</h3>
                <ul className="space-y-2 text-s">
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    <span>Reduce DSO by 5 days through early payment incentives</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    <span>Implement JIT inventory for 3 product lines</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    <span>Automate AR collections for top 50 customers</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
        
        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold mb-6">Profitability Settings</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="font-medium mb-3">Margin Targets</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="border rounded-lg p-3">
                    <label className="block text-s text-gray-500 mb-1">Gross Margin</label>
                    <div className="flex items-center">
                      <input 
                        type="number" 
                        defaultValue="45" 
                        className="w-16 border-b py-1 text-right"
                      />
                      <span className="ml-1">%</span>
                    </div>
                  </div>
                  
                  <div className="border rounded-lg p-3">
                    <label className="block text-s text-gray-500 mb-1">Operating Margin</label>
                    <div className="flex items-center">
                      <input 
                        type="number" 
                        defaultValue="25" 
                        className="w-16 border-b py-1 text-right"
                      />
                      <span className="ml-1">%</span>
                    </div>
                  </div>
                  
                  <div className="border rounded-lg p-3">
                    <label className="block text-s text-gray-500 mb-1">Net Margin</label>
                    <div className="flex items-center">
                      <input 
                        type="number" 
                        defaultValue="18" 
                        className="w-16 border-b py-1 text-right"
                      />
                      <span className="ml-1">%</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-3">Efficiency Targets</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="border rounded-lg p-3">
                    <label className="block text-s text-gray-500 mb-1">Revenue/Employee</label>
                    <div className="flex items-center">
                      <span className="mr-1">$</span>
                      <input 
                        type="number" 
                        defaultValue="150000" 
                        className="flex-1 border-b py-1"
                      />
                    </div>
                  </div>
                  
                  <div className="border rounded-lg p-3">
                    <label className="block text-s text-gray-500 mb-1">Inventory Turns</label>
                    <input 
                      type="number" 
                      defaultValue="6.5" 
                      className="w-16 border-b py-1 text-right"
                    />
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-3">Alert Thresholds</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="border rounded-lg p-3">
                    <label className="block text-s text-gray-500 mb-1">Margin Decline</label>
                    <div className="flex items-center">
                      <input 
                        type="number" 
                        defaultValue="2" 
                        className="w-16 border-b py-1 text-right"
                      />
                      <span className="ml-1">%</span>
                    </div>
                  </div>
                  
                  <div className="border rounded-lg p-3">
                    <label className="block text-s text-gray-500 mb-1">Cost Increase</label>
                    <div className="flex items-center">
                      <input 
                        type="number" 
                        defaultValue="5" 
                        className="w-16 border-b py-1 text-right"
                      />
                      <span className="ml-1">%</span>
                    </div>
                  </div>
                  
                  <div className="border rounded-lg p-3">
                    <label className="block text-s text-gray-500 mb-1">Efficiency Drop</label>
                    <div className="flex items-center">
                      <input 
                        type="number" 
                        defaultValue="10" 
                        className="w-16 border-b py-1 text-right"
                      />
                      <span className="ml-1">%</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfitabilityEnhancement;