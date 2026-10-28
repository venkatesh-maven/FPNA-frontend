import { useState } from 'react';
import { 
  FiAlertTriangle, 
  FiActivity,
  FiShield,
  FiGlobe,
  FiTrendingDown,
  FiBarChart2,
  FiDownload,
  FiRefreshCw,
  FiChevronDown,
  FiChevronRight
} from 'react-icons/fi';
import { Bar, Line, Radar } from 'react-chartjs-2';

const PredictiveRiskManagement = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedSections, setExpandedSections] = useState({
    financial: true,
    operational: false,
    market: false
  });

  // Chart data
  const riskTrendData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Financial Risk',
        data: [65, 59, 70, 72, 68, 75],
        borderColor: 'rgba(255, 99, 132, 1)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        fill: true,
        tension: 0.3
      },
      {
        label: 'Operational Risk',
        data: [45, 52, 60, 65, 58, 62],
        borderColor: 'rgba(54, 162, 235, 1)',
        backgroundColor: 'rgba(54, 162, 235, 0.1)',
        fill: true,
        tension: 0.3
      },
      {
        label: 'Market Risk',
        data: [30, 35, 42, 50, 55, 60],
        borderColor: 'rgba(255, 206, 86, 1)',
        backgroundColor: 'rgba(255, 206, 86, 0.1)',
        fill: true,
        tension: 0.3
      }
    ]
  };

  const currentExposuresData = {
    labels: ['Credit', 'Liquidity', 'Fraud', 'Supply Chain', 'Compliance', 'Cyber'],
    datasets: [{
      label: 'Risk Level',
      data: [75, 65, 58, 82, 45, 70],
      backgroundColor: 'rgba(153, 102, 255, 0.7)',
      borderColor: 'rgba(153, 102, 255, 1)',
      borderWidth: 1
    }]
  };

  const riskRadarData = {
    labels: ['Financial', 'Operational', 'Strategic', 'Compliance', 'Reputation', 'Market'],
    datasets: [
      {
        label: 'Your Business',
        data: [75, 65, 60, 45, 55, 70],
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        borderColor: 'rgba(255, 99, 132, 1)',
        pointBackgroundColor: 'rgba(255, 99, 132, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(255, 99, 132, 1)'
      },
      {
        label: 'Industry Average',
        data: [60, 55, 50, 60, 50, 65],
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        pointBackgroundColor: 'rgba(54, 162, 235, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(54, 162, 235, 1)'
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


    <div>

        
            <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-6 rounded-lg shadow-sm mb-5">
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-lg font-bold text-white">
                                    Predictive Risk Management
                                </h1>
                                {/* <p className="text-sky-100 text-x">{currentUser.company_name}</p> */}
                            </div>
                            <div className="flex space-x-2">
                                {/* <button
                                    type="button"
                                    className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200"
                                    onClick={() => setShowFilters(!showFilters)}>
                                    <FiFilter className="mr-1" />
                                    Filters
                                </button>
                                <button
                                    type="button"
                                    className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200">
                                    <FiPlus className="mr-1" />
                                    Add Widget
                                </button> */}
                            </div>
                        </div>
                    </div>
   
    <div className="flex h-screen bg-gray-50">













      {/* Sidebar Navigation */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b bg-sky-800 border-gray-200">
          <h2 className="text-xl font-bold text-gray-50 flex items-center">
            {/* <FiShield className="mr-2 text-red-600" /> */}
            Risk Management
          </h2>
          <p className="text-x text-red-400">AI-Powered Early Warning System</p>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <nav className="p-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center p-3 rounded-lg mb-1 ${activeTab === 'overview' ? 'bg-red-50 text-red-700' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <FiActivity className="mr-3" />
              Risk Overview
            </button>
            
            <button
              onClick={() => setActiveTab('financial')}
              className={`w-full flex items-center p-3 rounded-lg mb-1 ${activeTab === 'financial' ? 'bg-red-50 text-red-700' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <FiTrendingDown className="mr-3" />
              Financial Risks
            </button>
            
            <button
              onClick={() => setActiveTab('operational')}
              className={`w-full flex items-center p-3 rounded-lg mb-1 ${activeTab === 'operational' ? 'bg-red-50 text-red-700' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <FiAlertTriangle className="mr-3" />
              Operational Risks
            </button>
            
            <button
              onClick={() => setActiveTab('market')}
              className={`w-full flex items-center p-3 rounded-lg mb-1 ${activeTab === 'market' ? 'bg-red-50 text-red-700' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <FiGlobe className="mr-3" />
              Market Risks
            </button>
            
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center p-3 rounded-lg ${activeTab === 'settings' ? 'bg-red-50 text-red-700' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <FiBarChart2 className="mr-3" />
              Risk Settings
            </button>
          </nav>
        </div>
        
        <div className="p-4 border-t border-gray-200">
          <button className="w-full flex items-center justify-center py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700">
            <FiDownload className="mr-2" />
            Export Risk Report
          </button>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6">
        <div className="mb-6 flex bg-sky-900 rounded-3xl p-3 px-6 justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-sky-50">
              {activeTab === 'overview' && 'Risk Management Dashboard'}
              {activeTab === 'financial' && 'Financial Risk Monitoring'}
              {activeTab === 'operational' && 'Operational Risk Alerts'}
              {activeTab === 'market' && 'Market Risk Analysis'}
              {activeTab === 'settings' && 'Risk Settings'}
            </h1>
            <p className="text-sky-50">
              {activeTab === 'overview' && 'AI-powered early warning system for predictive risk management'}
              {activeTab === 'financial' && 'Monitor credit, liquidity, and financial health risks'}
              {activeTab === 'operational' && 'Identify and mitigate operational vulnerabilities'}
              {activeTab === 'market' && 'Analyze market volatility and competitive risks'}
              {activeTab === 'settings' && 'Configure risk thresholds and alerts'}
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
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-s text-gray-500">Overall Risk Level</div>
                    <div className="text-2xl font-bold text-red-600">High</div>
                  </div>
                  <div className="bg-red-100 text-red-800 text-x px-2 py-1 rounded-full">
                    72/100
                  </div>
                </div>
                <div className="mt-2 text-x text-gray-500">
                  <span className="text-red-500 mr-1">↑ 8%</span> from last month
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-s text-gray-500">Active Alerts</div>
                    <div className="text-2xl font-bold text-orange-600">12</div>
                  </div>
                  <div className="bg-orange-100 text-orange-800 text-x px-2 py-1 rounded-full">
                    5 Critical
                  </div>
                </div>
                <div className="mt-2 text-x text-gray-500">
                  <span className="text-orange-500 mr-1">↑ 3</span> new this week
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-s text-gray-500">Risk Mitigation</div>
                    <div className="text-2xl font-bold text-green-600">35%</div>
                  </div>
                  <div className="bg-green-100 text-green-800 text-x px-2 py-1 rounded-full">
                    +5% this month
                  </div>
                </div>
                <div className="mt-2 text-x text-gray-500">
                  15 actions completed of 42 recommended
                </div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="h-80">
                <Line 
                  data={riskTrendData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      tooltip: {
                        callbacks: {
                          label: function(context) {
                            return `${context.dataset.label}: ${context.raw}/100`;
                          }
                        }
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        max: 100
                      }
                    }
                  }}
                />
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h3 className="font-medium mb-3">Current Exposures</h3>
                <div className="h-64">
                  <Bar 
                    data={currentExposuresData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: {
                          beginAtZero: true,
                          max: 100
                        }
                      }
                    }}
                  />
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h3 className="font-medium mb-3">Risk Profile Comparison</h3>
                <div className="h-64">
                  <Radar 
                    data={riskRadarData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        r: {
                          angleLines: {
                            display: true
                          },
                          suggestedMin: 0,
                          suggestedMax: 100
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <h3 className="font-medium mb-3">Critical Risk Alerts</h3>
              <div className="space-y-3">
                <div className="p-3 bg-red-50 rounded-lg border-l-4 border-red-500">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-red-700">Supply Chain Disruption</h4>
                      <p className="text-s text-gray-600">2 key suppliers in high-risk regions</p>
                    </div>
                    <div className="bg-white text-red-600 text-x px-2 py-1 rounded-full border border-red-200">
                      Critical
                    </div>
                  </div>
                </div>
                
                <div className="p-3 bg-orange-50 rounded-lg border-l-4 border-orange-500">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-orange-700">Credit Risk Increase</h4>
                      <p className="text-s text-gray-600">3 major customers showing financial stress</p>
                    </div>
                    <div className="bg-white text-orange-600 text-x px-2 py-1 rounded-full border border-orange-200">
                      High
                    </div>
                  </div>
                </div>
                
                <div className="p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-yellow-700">Regulatory Change</h4>
                      <p className="text-s text-gray-600">New compliance requirements in 2 markets</p>
                    </div>
                    <div className="bg-white text-yellow-600 text-x px-2 py-1 rounded-full border border-yellow-200">
                      Medium
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Financial Risk Tab */}
        {activeTab === 'financial' && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-medium">Financial Risk Indicators</h2>
                <button 
                  onClick={() => toggleSection('financial')}
                  className="text-red-600 hover:text-red-800"
                >
                  {expandedSections.financial ? <FiChevronDown /> : <FiChevronRight />}
                </button>
              </div>
              
              {expandedSections.financial && (
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-medium mb-3">Key Metrics</h3>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-s mb-1">
                          <span>Liquidity Risk</span>
                          <span className="text-red-600">High (78/100)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-red-500 h-2 rounded-full" 
                            style={{width: '78%'}}
                          ></div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-s mb-1">
                          <span>Credit Exposure</span>
                          <span className="text-orange-600">Elevated (65/100)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-orange-500 h-2 rounded-full" 
                            style={{width: '65%'}}
                          ></div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-s mb-1">
                          <span>Debt Service Coverage</span>
                          <span className="text-yellow-600">Moderate (55/100)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-yellow-500 h-2 rounded-full" 
                            style={{width: '55%'}}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-medium mb-3">AI Recommendations</h3>
                    <div className="space-y-3">
                      <div className="p-3 bg-red-50 rounded-lg">
                        <div className="flex justify-between">
                          <span className="font-medium">Liquidity Buffer</span>
                          <span className="text-red-600">Urgent</span>
                        </div>
                        <p className="text-s text-gray-600 mt-1">
                          Increase cash reserves by $250K to cover 60-day operating needs
                        </p>
                      </div>
                      
                      <div className="p-3 bg-orange-50 rounded-lg">
                        <div className="flex justify-between">
                          <span className="font-medium">Credit Review</span>
                          <span className="text-orange-600">High Priority</span>
                        </div>
                        <p className="text-s text-gray-600 mt-1">
                          Reassess credit terms for 5 high-risk customers
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h3 className="font-medium mb-3">Cash Flow Risk</h3>
                <div className="h-64 bg-gray-100 rounded flex items-center justify-center text-gray-400">
                  [Cash Flow Forecast Chart]
                </div>
                <div className="mt-3 text-s text-gray-600">
                  <div className="flex justify-between">
                    <span>Next 30-Day Shortfall Risk:</span>
                    <span className="text-red-600 font-medium">42% probability</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Recommended Buffer:</span>
                    <span className="font-medium">$185K</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h3 className="font-medium mb-3">Customer Credit Health</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-2 bg-red-50 rounded">
                    <span>Customer A</span>
                    <span className="text-red-600">High Risk</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-orange-50 rounded">
                    <span>Customer B</span>
                    <span className="text-orange-600">Elevated Risk</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-yellow-50 rounded">
                    <span>Customer C</span>
                    <span className="text-yellow-600">Watch</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                    <span>Customer D</span>
                    <span className="text-green-600">Stable</span>
                  </div>
                </div>
                <button className="mt-3 text-s text-blue-600 hover:text-blue-800">
                  View Full Credit Report →
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Operational Risk Tab */}
        {activeTab === 'operational' && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-medium">Operational Risk Dashboard</h2>
                <button 
                  onClick={() => toggleSection('operational')}
                  className="text-red-600 hover:text-red-800"
                >
                  {expandedSections.operational ? <FiChevronDown /> : <FiChevronRight />}
                </button>
              </div>
              
              {expandedSections.operational && (
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-medium mb-3">Risk Heatmap</h3>
                    <div className="h-64 bg-gray-100 rounded flex items-center justify-center text-gray-400">
                      [Operational Risk Heatmap]
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-medium mb-3">Top Vulnerabilities</h3>
                    <div className="space-y-3">
                      <div className="p-3 bg-red-50 rounded-lg">
                        <div className="flex justify-between">
                          <span className="font-medium">Supplier Concentration</span>
                          <span className="text-red-600">Critical</span>
                        </div>
                        <p className="text-s text-gray-600 mt-1">
                          75% of Component X sourced from single supplier
                        </p>
                      </div>
                      
                      <div className="p-3 bg-orange-50 rounded-lg">
                        <div className="flex justify-between">
                          <span className="font-medium">IT System Resilience</span>
                          <span className="text-orange-600">High</span>
                        </div>
                        <p className="text-s text-gray-600 mt-1">
                          No failover system for critical order processing
                        </p>
                      </div>
                      
                      <div className="p-3 bg-yellow-50 rounded-lg">
                        <div className="flex justify-between">
                          <span className="font-medium">Employee Turnover</span>
                          <span className="text-yellow-600">Medium</span>
                        </div>
                        <p className="text-s text-gray-600 mt-1">
                          Key team showing 25% attrition risk
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h3 className="font-medium mb-3">Process Failure Risks</h3>
                <div className="space-y-3">
                  <div className="flex items-start">
                    <span className="text-red-500 mr-2">•</span>
                    <div>
                      <span className="font-medium">Order Fulfillment</span>
                      <p className="text-s text-gray-600">15% error rate in last 30 days</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <span className="text-orange-500 mr-2">•</span>
                    <div>
                      <span className="font-medium">Inventory Management</span>
                      <p className="text-s text-gray-600">8 stockouts in critical items</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <div>
                      <span className="font-medium">Quality Control</span>
                      <p className="text-s text-gray-600">12% defect rate increase</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h3 className="font-medium mb-3">Mitigation Progress</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-s mb-1">
                      <span>Supplier Diversification</span>
                      <span>35% complete</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{width: '35%'}}
                      ></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-s mb-1">
                      <span>System Redundancy</span>
                      <span>15% complete</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{width: '15%'}}
                      ></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-s mb-1">
                      <span>Employee Retention</span>
                      <span>60% complete</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{width: '60%'}}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Market Risk Tab */}
        {activeTab === 'market' && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-medium">Market Risk Indicators</h2>
                <button 
                  onClick={() => toggleSection('market')}
                  className="text-red-600 hover:text-red-800"
                >
                  {expandedSections.market ? <FiChevronDown /> : <FiChevronRight />}
                </button>
              </div>
              
              {expandedSections.market && (
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-medium mb-3">Economic Exposure</h3>
                    <div className="h-64 bg-gray-100 rounded flex items-center justify-center text-gray-400">
                      [Market Risk Chart]
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-medium mb-3">Top Market Risks</h3>
                    <div className="space-y-3">
                      <div className="p-3 bg-red-50 rounded-lg">
                        <div className="flex justify-between">
                          <span className="font-medium">Commodity Price Volatility</span>
                          <span className="text-red-600">Critical</span>
                        </div>
                        <p className="text-s text-gray-600 mt-1">
                          Key input prices projected to rise 18-25% next quarter
                        </p>
                      </div>
                      
                      <div className="p-3 bg-orange-50 rounded-lg">
                        <div className="flex justify-between">
                          <span className="font-medium">Competitor Pricing</span>
                          <span className="text-orange-600">High</span>
                        </div>
                        <p className="text-s text-gray-600 mt-1">
                          3 competitors preparing aggressive pricing moves
                        </p>
                      </div>
                      
                      <div className="p-3 bg-yellow-50 rounded-lg">
                        <div className="flex justify-between">
                          <span className="font-medium">Regulatory Changes</span>
                          <span className="text-yellow-600">Medium</span>
                        </div>
                        <p className="text-s text-gray-600 mt-1">
                          New trade policies may impact 2 key markets
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h3 className="font-medium mb-3">Currency Risk</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-s">
                    <span>USD Exposure</span>
                    <span className="text-red-600">$1.2M</span>
                  </div>
                  <div className="flex justify-between text-s">
                    <span>EUR Exposure</span>
                    <span className="text-orange-600">$850K</span>
                  </div>
                  <div className="flex justify-between text-s">
                    <span>GBP Exposure</span>
                    <span className="text-yellow-600">$420K</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h3 className="font-medium mb-3">Commodity Risk</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-s">
                    <span>Steel</span>
                    <span className="text-red-600">+22% forecast</span>
                  </div>
                  <div className="flex justify-between text-s">
                    <span>Plastics</span>
                    <span className="text-orange-600">+15% forecast</span>
                  </div>
                  <div className="flex justify-between text-s">
                    <span>Energy</span>
                    <span className="text-yellow-600">+8% forecast</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h3 className="font-medium mb-3">Hedging Status</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-s">
                    <span>Currency Coverage</span>
                    <span>65%</span>
                  </div>
                  <div className="flex justify-between text-s">
                    <span>Commodity Coverage</span>
                    <span>40%</span>
                  </div>
                  <div className="flex justify-between text-s">
                    <span>Interest Rate</span>
                    <span>80%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold mb-6">Risk Management Settings</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="font-medium mb-3">Alert Thresholds</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="border rounded-lg p-3">
                    <label className="block text-s text-gray-500 mb-1">Financial Risk</label>
                    <div className="flex items-center">
                      <input 
                        type="number" 
                        defaultValue="70" 
                        className="w-16 border-b py-1 text-right"
                      />
                      <span className="ml-1">/100</span>
                    </div>
                  </div>
                  
                  <div className="border rounded-lg p-3">
                    <label className="block text-s text-gray-500 mb-1">Operational Risk</label>
                    <div className="flex items-center">
                      <input 
                        type="number" 
                        defaultValue="65" 
                        className="w-16 border-b py-1 text-right"
                      />
                      <span className="ml-1">/100</span>
                    </div>
                  </div>
                  
                  <div className="border rounded-lg p-3">
                    <label className="block text-s text-gray-500 mb-1">Market Risk</label>
                    <div className="flex items-center">
                      <input 
                        type="number" 
                        defaultValue="60" 
                        className="w-16 border-b py-1 text-right"
                      />
                      <span className="ml-1">/100</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-3">Notification Preferences</h3>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input type="checkbox" id="email-alerts" className="mr-2" checked />
                    <label htmlFor="email-alerts">Email Alerts</label>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" id="push-alerts" className="mr-2" checked />
                    <label htmlFor="push-alerts">Push Notifications</label>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" id="sms-alerts" className="mr-2" />
                    <label htmlFor="sms-alerts">SMS Alerts (Critical Only)</label>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-3">Risk Model Parameters</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="border rounded-lg p-3">
                    <label className="block text-s text-gray-500 mb-1">Lookback Period</label>
                    <select className="w-full border-b py-1">
                      <option>3 months</option>
                      <option selected>6 months</option>
                      <option>12 months</option>
                    </select>
                  </div>
                  
                  <div className="border rounded-lg p-3">
                    <label className="block text-s text-gray-500 mb-1">Forecast Horizon</label>
                    <select className="w-full border-b py-1">
                      <option>30 days</option>
                      <option selected>90 days</option>
                      <option>180 days</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end">
                <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
     </div>
  );
};

export default PredictiveRiskManagement;