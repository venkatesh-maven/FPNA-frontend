import { useState } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  FiTrendingUp,
  FiChevronDown,
  FiChevronRight,
  FiDownload,
  FiDollarSign,
  FiUsers,
  FiGlobe,
  FiPieChart,
  FiBarChart2
} from 'react-icons/fi';

const RevenueGrowthStrategies = () => {
  const [expandedSections, setExpandedSections] = useState({
    overview: true,
    customer: false,
    product: false,
    market: false,
    pricing: false
  });

  // Chart data
  const revenueTrendData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
    datasets: [
      {
        label: 'Actual Revenue',
        data: [120, 135, 142, 155, 148, 165, 180],
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        fill: true,
        tension: 0.3
      },
      {
        label: 'Target Revenue',
        data: [125, 140, 150, 160, 170, 180, 190],
        borderColor: 'rgba(255, 99, 132, 1)',
        backgroundColor: 'rgba(255, 99, 132, 0.05)',
        borderDash: [5, 5],
        fill: true
      }
    ]
  };

  const customerSegmentsData = {
    labels: ['Enterprise', 'Mid-Market', 'SMB', 'Consumer'],
    datasets: [{
      data: [35, 25, 30, 10],
      backgroundColor: [
        'rgba(54, 162, 235, 0.7)',
        'rgba(255, 206, 86, 0.7)',
        'rgba(75, 192, 192, 0.7)',
        'rgba(153, 102, 255, 0.7)'
      ],
      borderWidth: 1
    }]
  };

  const productPerformanceData = {
    labels: ['Product A', 'Product B', 'Product C', 'Product D', 'Service X'],
    datasets: [{
      label: 'Revenue Contribution',
      data: [45, 25, 15, 10, 5],
      backgroundColor: 'rgba(153, 102, 255, 0.7)'
    }]
  };

  const regionalGrowthData = {
    labels: ['North America', 'Europe', 'Asia', 'South America', 'Africa'],
    datasets: [
      {
        label: 'Current Revenue',
        data: [65, 40, 35, 15, 5],
        backgroundColor: 'rgba(54, 162, 235, 0.7)'
      },
      {
        label: 'Growth Potential',
        data: [15, 25, 45, 30, 20],
        backgroundColor: 'rgba(75, 192, 192, 0.7)'
      }
    ]
  };

  const pricingSensitivityData = {
    labels: ['-10% Price', 'Current', '+5% Price', '+10% Price'],
    datasets: [{
      label: 'Projected Revenue Impact',
      data: [125, 100, 108, 95],
      borderColor: 'rgba(255, 159, 64, 1)',
      backgroundColor: 'rgba(255, 159, 64, 0.2)',
      fill: true,
      tension: 0.3
    }]
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className=" flex items-center justify-between bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg mb-6 shadow-sm">
        <div className="flex justify-between items-center">
          <div className="flex justify-between items-center">
            <FiTrendingUp className="text-white mr-3 text-xl" />
            <div>
              <h1 className="text-xl font-bold text-white">Revenue Growth Strategies</h1>
              <p className="text-green-100 text-s">AI-powered recommendations to accelerate revenue streams</p>
            </div>
          </div>
          {/* <button className="flex items-center py-2 px-3 text-x font-medium text-green-700 bg-white rounded-lg hover:bg-green-50">
            <FiDownload className="mr-1" /> Export Report
          </button> */}
        </div>
      </div>

      {/* Revenue Overview */}
      <div className="border-b">
        <div 
          className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50"
          onClick={() => toggleSection('overview')}
        >
          <div className="flex items-center">
            <FiDollarSign className="text-green-600 mr-3" />
            <h3 className="font-semibold">Revenue Performance Overview</h3>
          </div>
          {expandedSections.overview ? <FiChevronDown /> : <FiChevronRight />}
        </div>
        
        {expandedSections.overview && (
          <div className="grid md:grid-cols-2 gap-6 p-4 bg-green-50">
            <div className="h-64">
              <Line 
                data={revenueTrendData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: false,
                      title: {
                        display: true,
                        text: 'Revenue ($K)'
                      }
                    }
                  },
                  plugins: {
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          return `${context.dataset.label}: $${context.raw}K`;
                        }
                      }
                    }
                  }
                }}
              />
            </div>
            <div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <div className="text-s text-gray-500">YTD Revenue</div>
                  <div className="text-2xl font-bold text-green-600">$1.02M</div>
                  <div className="text-x text-gray-500">+12% vs LY</div>
                </div>
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <div className="text-s text-gray-500">Revenue Gap</div>
                  <div className="text-2xl font-bold text-red-500">$78K</div>
                  <div className="text-x text-gray-500">-7% vs target</div>
                </div>
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <div className="text-s text-gray-500">Growth Rate</div>
                  <div className="text-2xl font-bold text-green-600">12%</div>
                  <div className="text-x text-gray-500">Industry: 9%</div>
                </div>
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <div className="text-s text-gray-500">Potential Upside</div>
                  <div className="text-2xl font-bold text-blue-600">$245K</div>
                  <div className="text-x text-gray-500">With optimization</div>
                </div>
              </div>
              <div className="p-3 bg-white rounded-lg shadow-sm">
                <h4 className="font-medium text-gray-700 mb-2">Top Growth Opportunities</h4>
                <div className="flex justify-between text-s">
                  <span>Customer Expansion</span>
                  <span className="font-medium text-green-600">$98K potential</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div className="bg-green-500 h-2 rounded-full" style={{width: '72%'}}></div>
                </div>
                <div className="flex justify-between text-s mt-2">
                  <span>New Market Entry</span>
                  <span className="font-medium text-green-600">$85K potential</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div className="bg-blue-500 h-2 rounded-full" style={{width: '65%'}}></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Customer Expansion Strategies */}
      <div className="border-b">
        <div 
          className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50"
          onClick={() => toggleSection('customer')}
        >
          <div className="flex items-center">
            <FiUsers className="text-green-600 mr-3" />
            <h3 className="font-semibold">Customer Expansion Strategies</h3>
          </div>
          {expandedSections.customer ? <FiChevronDown /> : <FiChevronRight />}
        </div>
        
        {expandedSections.customer && (
          <div className="grid md:grid-cols-2 gap-6 p-4 bg-gray-50">
            <div className="h-64">
              <Doughnut 
                data={customerSegmentsData}
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
              <h4 className="font-medium text-gray-700 mb-3">AI Recommendations</h4>
              <div className="space-y-3">
                <div className="p-3 bg-white rounded-lg shadow-sm border-l-4 border-green-500">
                  <div className="flex justify-between items-start">
                    <h5 className="font-bold text-green-700">Enterprise Account Expansion</h5>
                    <span className="bg-green-100 text-green-800 text-x px-2 py-1 rounded">$65K potential</span>
                  </div>
                  <p className="text-s text-gray-600 mt-1">
                    Expand usage within 12 enterprise accounts showing 80%+ satisfaction scores.
                    AI identifies 28 cross-sell opportunities.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="bg-gray-100 text-gray-800 text-x px-2 py-1 rounded">Upsell</span>
                    <span className="bg-gray-100 text-gray-800 text-x px-2 py-1 rounded">Enterprise</span>
                    <span className="bg-gray-100 text-gray-800 text-x px-2 py-1 rounded">6-9 month ROI</span>
                  </div>
                </div>
                
                <div className="p-3 bg-white rounded-lg shadow-sm border-l-4 border-blue-500">
                  <div className="flex justify-between items-start">
                    <h5 className="font-bold text-blue-700">SMB Customer Retention</h5>
                    <span className="bg-blue-100 text-blue-800 text-x px-2 py-1 rounded">$32K potential</span>
                  </div>
                  <p className="text-s text-gray-600 mt-1">
                    Reduce churn by 15% through targeted success programs for 45 at-risk SMB customers.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="bg-gray-100 text-gray-800 text-x px-2 py-1 rounded">Retention</span>
                    <span className="bg-gray-100 text-gray-800 text-x px-2 py-1 rounded">SMB</span>
                    <span className="bg-gray-100 text-gray-800 text-x px-2 py-1 rounded">Quick Win</span>
                  </div>
                </div>
                
                <div className="p-3 bg-white rounded-lg shadow-sm border-l-4 border-purple-500">
                  <div className="flex justify-between items-start">
                    <h5 className="font-bold text-purple-700">Mid-Market Referral Program</h5>
                    <span className="bg-purple-100 text-purple-800 text-x px-2 py-1 rounded">$28K potential</span>
                  </div>
                  <p className="text-s text-gray-600 mt-1">
                    Launch referral incentives for top 20% of mid-market customers, projected to generate 15 new deals.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="bg-gray-100 text-gray-800 text-x px-2 py-1 rounded">Referral</span>
                    <span className="bg-gray-100 text-gray-800 text-x px-2 py-1 rounded">Mid-Market</span>
                    <span className="bg-gray-100 text-gray-800 text-x px-2 py-1 rounded">3-6 month ROI</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Product Revenue Optimization */}
      <div className="border-b">
        <div 
          className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50"
          onClick={() => toggleSection('product')}
        >
          <div className="flex items-center">
            <FiPieChart className="text-green-600 mr-3" />
            <h3 className="font-semibold">Product Revenue Optimization</h3>
          </div>
          {expandedSections.product ? <FiChevronDown /> : <FiChevronRight />}
        </div>
        
        {expandedSections.product && (
          <div className="grid md:grid-cols-2 gap-6 p-4 bg-gray-50">
            <div className="h-64">
              <Bar 
                data={productPerformanceData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      title: {
                        display: true,
                        text: 'Revenue Contribution (%)'
                      }
                    }
                  }
                }}
              />
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-3">Product Growth Strategies</h4>
              <div className="space-y-3">
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Product A</span>
                    <span className="bg-green-100 text-green-800 text-x px-2 py-1 rounded">Growth: +22%</span>
                  </div>
                  <p className="text-s text-gray-600 mt-1">
                    Expand to 3 new use cases identified by AI, targeting finance and healthcare verticals.
                  </p>
                  <div className="text-x text-gray-500 mt-1">Potential: $45K additional revenue</div>
                </div>
                
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Product B</span>
                    <span className="bg-blue-100 text-blue-800 text-x px-2 py-1 rounded">Upsell Potential</span>
                  </div>
                  <p className="text-s text-gray-600 mt-1">
                    Bundle with Product A for 15% premium, increasing average deal size by $8K.
                  </p>
                  <div className="text-x text-gray-500 mt-1">Potential: $28K additional revenue</div>
                </div>
                
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Service X</span>
                    <span className="bg-purple-100 text-purple-800 text-x px-2 py-1 rounded">Untapped Market</span>
                  </div>
                  <p className="text-s text-gray-600 mt-1">
                    Offer as standalone to SMB segment with 85% satisfaction in pilot.
                  </p>
                  <div className="text-x text-gray-500 mt-1">Potential: $35K new revenue</div>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                <h5 className="font-medium text-yellow-800 mb-2">New Revenue Streams</h5>
                <ul className="text-s space-y-2">
                  <li className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span><strong>Premium Support Tier:</strong> $15K potential from top 20 customers</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span><strong>Data Insights Add-on:</strong> $25K potential from 35% of customer base</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span><strong>Training Certification:</strong> $18K potential from partner network</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Market Expansion Opportunities */}
      <div className="border-b">
        <div 
          className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50"
          onClick={() => toggleSection('market')}
        >
          <div className="flex items-center">
            <FiGlobe className="text-green-600 mr-3" />
            <h3 className="font-semibold">Market Expansion Opportunities</h3>
          </div>
          {expandedSections.market ? <FiChevronDown /> : <FiChevronRight />}
        </div>
        
        {expandedSections.market && (
          <div className="grid md:grid-cols-2 gap-6 p-4 bg-gray-50">
            <div className="h-64">
              <Bar 
                data={regionalGrowthData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      title: {
                        display: true,
                        text: 'Revenue ($K)'
                      }
                    }
                  }
                }}
              />
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-3">Top Geographic Opportunities</h4>
              <div className="space-y-3">
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Southeast Asia</span>
                    <span className="bg-green-100 text-green-800 text-x px-2 py-1 rounded">High Potential</span>
                  </div>
                  <p className="text-s text-gray-600 mt-1">
                    $85K revenue potential with localized offering and 2 regional partners.
                  </p>
                  <div className="text-x text-gray-500 mt-1">Market growth: 18% YoY</div>
                </div>
                
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Northern Europe</span>
                    <span className="bg-blue-100 text-blue-800 text-x px-2 py-1 rounded">Quick Win</span>
                  </div>
                  <p className="text-s text-gray-600 mt-1">
                    $45K potential from 15 inbound leads not currently served.
                  </p>
                  <div className="text-x text-gray-500 mt-1">Customer fit: 92% match</div>
                </div>
                
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Brazil</span>
                    <span className="bg-purple-100 text-purple-800 text-x px-2 py-1 rounded">Emerging</span>
                  </div>
                  <p className="text-s text-gray-600 mt-1">
                    $32K potential with localized pricing and payment options.
                  </p>
                  <div className="text-x text-gray-500 mt-1">Competition: Low</div>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <h5 className="font-medium text-blue-800 mb-2">Expansion Readiness</h5>
                <div className="grid grid-cols-3 gap-2 text-s">
                  <div className="font-medium">Market</div>
                  <div className="font-medium">Investment</div>
                  <div className="font-medium">Timeline</div>
                  
                  <div>Southeast Asia</div>
                  <div>$25K</div>
                  <div>6-9 months</div>
                  
                  <div>Northern Europe</div>
                  <div>$15K</div>
                  <div>3-6 months</div>
                  
                  <div>Brazil</div>
                  <div>$20K</div>
                  <div>9-12 months</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pricing Optimization */}
      <div>
        <div 
          className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50"
          onClick={() => toggleSection('pricing')}
        >
          <div className="flex items-center">
            <FiBarChart2 className="text-green-600 mr-3" />
            <h3 className="font-semibold">Pricing Strategy Optimization</h3>
          </div>
          {expandedSections.pricing ? <FiChevronDown /> : <FiChevronRight />}
        </div>
        
        {expandedSections.pricing && (
          <div className="grid md:grid-cols-2 gap-6 p-4 bg-gray-50">
            <div className="h-64">
              <Line 
                data={pricingSensitivityData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: false,
                      title: {
                        display: true,
                        text: 'Revenue Index (Current = 100)'
                      }
                    }
                  }
                }}
              />
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-3">AI Pricing Recommendations</h4>
              <div className="space-y-3">
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Premium Tier Pricing</span>
                    <span className="bg-green-100 text-green-800 text-x px-2 py-1 rounded">+8% Revenue</span>
                  </div>
                  <p className="text-s text-gray-600 mt-1">
                    Introduce 15% premium tier with enhanced features for top 20% customers.
                  </p>
                </div>
                
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Volume Discount Structure</span>
                    <span className="bg-blue-100 text-blue-800 text-x px-2 py-1 rounded">+5% Volume</span>
                  </div>
                  <p className="text-s text-gray-600 mt-1">
                    Adjust discount tiers to encourage larger purchases without eroding margins.
                  </p>
                </div>
                
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">SMB Pricing Package</span>
                    <span className="bg-purple-100 text-purple-800 text-x px-2 py-1 rounded">+12% Adoption</span>
                  </div>
                  <p className="text-s text-gray-600 mt-1">
                    Create simplified package at 20% lower price point for SMB segment.
                  </p>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                <h5 className="font-medium text-purple-800 mb-2">Pricing Test Plan</h5>
                <div className="grid grid-cols-4 gap-2 text-x">
                  <div className="font-medium">Segment</div>
                  <div className="font-medium">Test</div>
                  <div className="font-medium">Size</div>
                  <div className="font-medium">Duration</div>
                  
                  <div>Enterprise</div>
                  <div>Premium Tier</div>
                  <div>15 accounts</div>
                  <div>3 months</div>
                  
                  <div>Mid-Market</div>
                  <div>Volume Discounts</div>
                  <div>30 accounts</div>
                  <div>2 months</div>
                  
                  <div>SMB</div>
                  <div>Starter Package</div>
                  <div>50 accounts</div>
                  <div>3 months</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RevenueGrowthStrategies;