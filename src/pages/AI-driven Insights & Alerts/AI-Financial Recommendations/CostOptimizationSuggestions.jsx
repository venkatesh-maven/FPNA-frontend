import React, { useState } from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';
import { 
  FiAlertTriangle, 
  FiDownload, 
  FiDollarSign, 
  FiPieChart, 
  FiTrendingDown, 
  FiBarChart2 
} from 'react-icons/fi';

const CostOptimizationSuggestions = () => {
  const [activeTab, setActiveTab] = useState('summary');

  // Chart data
  const costDistributionData = {
    labels: ['Personnel', 'Technology', 'Facilities', 'Marketing', 'Operations', 'Other'],
    datasets: [{
      data: [42, 18, 12, 15, 8, 5],
      backgroundColor: [
        'rgba(255, 99, 132, 0.7)',
        'rgba(54, 162, 235, 0.7)',
        'rgba(255, 206, 86, 0.7)',
        'rgba(75, 192, 192, 0.7)',
        'rgba(153, 102, 255, 0.7)',
        'rgba(255, 159, 64, 0.7)'
      ],
      borderWidth: 1
    }]
  };

  const savingsPotentialData = {
    labels: ['Software', 'Vendor', 'Office', 'Travel', 'Utilities', 'Marketing'],
    datasets: [{
      label: 'Savings Potential (%)',
      data: [22, 18, 15, 12, 8, 25],
      backgroundColor: 'rgba(75, 192, 192, 0.7)',
      borderColor: 'rgba(75, 192, 192, 1)',
      borderWidth: 1
    }]
  };

  const departmentComparisonData = {
    labels: ['IT', 'Marketing', 'Operations', 'HR', 'Finance', 'R&D'],
    datasets: [{
      label: 'Cost per Employee ($K)',
      data: [25, 32, 18, 15, 22, 28],
      backgroundColor: 'rgba(153, 102, 255, 0.7)',
    }]
  };

  const tabs = [
    { id: 'summary', label: 'Summary', icon: <FiPieChart /> },
    { id: 'detailed', label: 'Recommendations', icon: <FiAlertTriangle /> },
    { id: 'department', label: 'Departments', icon: <FiBarChart2 /> },
    { id: 'vendor', label: 'Vendors', icon: <FiDollarSign /> },
    { id: 'historical', label: 'Trends', icon: <FiTrendingDown /> },
  ];

  return (
    <div className="bg-gray-50 min-h-screen p-4 md:p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
      <div className=" flex items-center justify-between bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg mb-6 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-gray-50 flex items-center">
              {/* <FiTrendingDown className="text-red-500 mr-2" /> */}
              Cost Optimization Suggestions
            </h1>
            <p className="text-s text-gray-50 mt-1">AI-identified areas to reduce expenses without operational impact</p>
          </div>
          <button className="flex items-center py-2 px-4 text-s font-medium text-white bg-sky-800 rounded-lg hover:bg-sky-700">
            <FiDownload className="mr-2" /> Export Report
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-4 py-2 text-s font-medium border-b-2 transition-colors ${
                activeTab === tab.id ? 'border-red-500 text-red-600' : 'border-transparent text-gray-600 hover:text-red-500'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="space-y-6">
          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:border-red-300 transition-colors">
                <h3 className="text-md font-semibold text-gray-800 mb-3">Cost Distribution</h3>
                <div className="h-48">
                  <Doughnut
                    data={costDistributionData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 10 } },
                        tooltip: {
                          callbacks: {
                            label: function(context) {
                              return `${context.label}: ${context.raw}% of total costs`;
                            }
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:border-red-300 transition-colors">
                <h3 className="text-md font-semibold text-gray-800 mb-3">Total Savings Potential</h3>
                <div className="text-3xl font-bold text-red-600">18.5%</div>
                <div className="text-s text-gray-600 mt-2">Annualized Savings: $487,500</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:border-red-300 transition-colors">
                <h3 className="text-md font-semibold text-gray-800 mb-3">Top Opportunities</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-s">
                    <span className="text-red-600 font-medium">Software Licenses</span>
                    <span>$112K (22%)</span>
                  </div>
                  <div className="flex justify-between text-s">
                    <span className="text-red-600 font-medium">Vendor Contracts</span>
                    <span>$85K (18%)</span>
                  </div>
                  <div className="flex justify-between text-s">
                    <span className="text-red-600 font-medium">Office Expenses</span>
                    <span>$62K (15%)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Detailed Recommendations Tab */}
          {activeTab === 'detailed' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:border-red-300 transition-colors">
                <h3 className="text-md font-semibold text-gray-800 mb-3">Savings Potential by Category</h3>
                <div className="h-48">
                  <Bar
                    data={savingsPotentialData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: {
                          beginAtZero: true,
                          title: { display: true, text: 'Savings Potential (%)', font: { size: 10 } }
                        },
                        x: { ticks: { font: { size: 10 } } }
                      },
                      plugins: { legend: { display: false } }
                    }}
                  />
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:border-red-300 transition-colors">
                <h3 className="text-md font-semibold text-gray-800 mb-3">Implementation Priority</h3>
                <div className="space-y-3 text-s">
                  {[
                    { label: 'Software Optimization', priority: 'High', width: '90%' },
                    { label: 'Vendor Negotiation', priority: 'High', width: '85%' },
                    { label: 'Office Expense Reduction', priority: 'Medium', width: '70%' }
                  ].map((item, index) => (
                    <div key={index}>
                      <div className="flex justify-between mb-1">
                        <span>{item.label}</span>
                        <span className="font-medium">{item.priority}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className={`h-2 rounded-full ${item.priority === 'High' ? 'bg-red-500' : 'bg-orange-500'}`} style={{ width: item.width }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {[
                {
                  title: 'Software License Consolidation',
                  savings: '$112K',
                  description: 'AI identified 18 redundant or underutilized software licenses across departments. Consolidating these could save 22% of current software costs without impacting productivity.',
                  tags: ['SaaS Tools', 'Department: All', '1-3 months'],
                  color: 'red'
                },
                {
                  title: 'Vendor Contract Renegotiation',
                  savings: '$85K',
                  description: '5 vendor contracts are up for renewal with 18% potential savings through volume discounts and payment term adjustments.',
                  tags: ['Suppliers', 'Category: Operations', '2-4 months'],
                  color: 'orange'
                },
                {
                  title: 'Hybrid Work Policy Implementation',
                  savings: '$62K',
                  description: 'Implementing a 3-day office policy could reduce office space needs by 30%, saving 15% on facilities costs.',
                  tags: ['Facilities', 'Department: All', '3-6 months'],
                  color: 'yellow'
                }
              ].map((rec, index) => (
                <div key={index} className={`bg-white rounded-lg p-4 border border-gray-200 hover:border-${rec.color}-300 transition-colors`}>
                  <h4 className={`text-md font-semibold text-${rec.color}-700 mb-2`}>{rec.title}</h4>
                  <div className={`text-s text-${rec.color}-600 font-medium mb-2`}>Savings: {rec.savings}</div>
                  <p className="text-s text-gray-600 mb-3">{rec.description}</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {rec.tags.map((tag, i) => (
                      <span key={i} className="bg-gray-100 text-gray-700 text-x px-2 py-1 rounded">{tag}</span>
                    ))}
                  </div>
                  <button className={`text-s text-${rec.color}-600 hover:text-${rec.color}-800 font-medium`}>
                    View Details →
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Departmental Cost Analysis Tab */}
          {activeTab === 'department' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:border-red-300 transition-colors">
                <h3 className="text-md font-semibold text-gray-800 mb-3">Cost per Employee by Department</h3>
                <div className="h-48">
                  <Bar
                    data={departmentComparisonData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: {
                          beginAtZero: true,
                          title: { display: true, text: 'Cost per Employee ($K)', font: { size: 10 } }
                        },
                        x: { ticks: { font: { size: 10 } } }
                      },
                      plugins: { legend: { display: false } }
                    }}
                  />
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:border-red-300 transition-colors">
                <h3 className="text-md font-semibold text-gray-800 mb-3">Department Insights</h3>
                <div className="space-y-3 text-s">
                  <div>
                    <div className="font-medium text-red-600">Highest Cost: Marketing</div>
                    <div>$32K per employee (23% above benchmark)</div>
                  </div>
                  <div>
                    <div className="font-medium text-green-600">Most Efficient: HR</div>
                    <div>$15K per employee (12% below benchmark)</div>
                  </div>
                  <div>
                    <div className="font-medium text-orange-600">Savings Opportunity: IT</div>
                    <div>Potential 17% reduction ($4.25K/employee)</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:border-red-300 transition-colors">
                <h3 className="text-md font-semibold text-gray-800 mb-3">Recommendations</h3>
                <ul className="space-y-2 text-s">
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    <span><strong>Marketing:</strong> Reduce agency spend by 15%</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    <span><strong>IT:</strong> Consolidate cloud services</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    <span><strong>R&D:</strong> Implement equipment sharing</span>
                  </li>
                </ul>
                <button className="mt-3 text-s text-blue-600 hover:text-blue-800 font-medium">
                  View Full Analysis →
                </button>
              </div>
            </div>
          )}

          {/* Vendor Optimization Tab */}
          {activeTab === 'vendor' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:border-red-300 transition-colors">
                <h3 className="text-md font-semibold text-gray-800 mb-3">Vendor Savings Opportunities</h3>
                <div className="space-y-3 text-s">
                  {[
                    { vendor: 'Cloud Services Provider A', savings: '18%', width: '90%' },
                    { vendor: 'Office Supplies Vendor B', savings: '15%', width: '85%' },
                    { vendor: 'Marketing Agency C', savings: '12%', width: '80%' }
                  ].map((item, index) => (
                    <div key={index}>
                      <div className="flex justify-between mb-1">
                        <span>{item.vendor}</span>
                        <span className="font-medium text-red-600">{item.savings}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className={`h-2 rounded-full ${index === 0 ? 'bg-red-500' : index === 1 ? 'bg-red-400' : 'bg-orange-500'}`} style={{ width: item.width }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:border-red-300 transition-colors">
                <h3 className="text-md font-semibold text-gray-800 mb-3">Vendor Performance Scorecard</h3>
                <div className="grid grid-cols-3 gap-2 text-s">
                  <div className="font-medium">Vendor</div>
                  <div className="font-medium">Cost Score</div>
                  <div className="font-medium">Delivery</div>
                  <div>Provider A</div>
                  <div className="text-red-600">65/100</div>
                  <div className="text-green-600">92/100</div>
                  <div>Vendor B</div>
                  <div className="text-orange-600">78/100</div>
                  <div className="text-green-600">88/100</div>
                  <div>Agency C</div>
                  <div className="text-red-600">62/100</div>
                  <div className="text-orange-600">75/100</div>
                </div>
                <button className="mt-3 text-s text-blue-600 hover:text-blue-800 font-medium">
                  View Full Analysis →
                </button>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:border-red-300 transition-colors">
                <h3 className="text-md font-semibold text-gray-800 mb-3">AI Negotiation Suggestions</h3>
                <div className="space-y-3 text-s">
                  <div>
                    <div className="font-medium">Cloud Services Provider A</div>
                    <ul className="list-disc list-inside mt-1 text-gray-600">
                      <li>Request 15% volume discount</li>
                      <li>Negotiate pricing cap</li>
                    </ul>
                  </div>
                  <div>
                    <div className="font-medium">Office Supplies Vendor B</div>
                    <ul className="list-disc list-inside mt-1 text-gray-600">
                      <li>Consolidate orders</li>
                      <li>Request free shipping</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Historical Cost Trends Tab */}
          {activeTab === 'historical' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:border-red-300 transition-colors">
                <h3 className="text-md font-semibold text-gray-800 mb-3">Cost Trends (Last 12 Months)</h3>
                <div className="h-40 bg-gray-100 rounded flex items-center justify-center text-gray-400">
                  [Line Chart Placeholder]
                </div>
                <div className="mt-3 text-s text-gray-600">
                  <div className="flex justify-between">
                    <span>Total Cost Growth:</span>
                    <span className="text-red-600 font-medium">+8.2%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Industry Benchmark:</span>
                    <span className="text-gray-800 font-medium">+5.1%</span>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:border-red-300 transition-colors">
                <h3 className="text-md font-semibold text-gray-800 mb-3">Cost Efficiency Benchmarks</h3>
                <div className="space-y-3 text-s">
                  {[
                    { label: 'Revenue per $1 of Cost', value: '$2.15', width: '72%', avg: '$2.45' },
                    { label: 'Admin Cost % of Revenue', value: '8.2%', width: '65%', avg: '6.8%' },
                    { label: 'Cost per Employee', value: '$82K', width: '58%', avg: '$78K' }
                  ].map((item, index) => (
                    <div key={index}>
                      <div className="flex justify-between mb-1">
                        <span>{item.label}</span>
                        <span className="font-medium">{item.value}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className={`h-2 rounded-full ${index === 0 ? 'bg-blue-500' : index === 1 ? 'bg-red-500' : 'bg-orange-500'}`} style={{ width: item.width }}></div>
                      </div>
                      <div className="text-x text-gray-500 mt-1">Avg: {item.avg}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200 hover:border-red-300 transition-colors">
                <h3 className="text-md font-semibold text-gray-800 mb-3">AI Efficiency Recommendations</h3>
                <div className="space-y-2 text-s">
                  {[
                    { title: 'Process Automation', description: 'Implement RPA to reduce admin costs by 15%' },
                    { title: 'Energy Efficiency', description: 'Upgrade to LED lighting to cut utility costs by 20%' },
                    { title: 'Inventory Optimization', description: 'Reduce carrying costs by 12% via just-in-time ordering' },
                    { title: 'Travel Policy Update', description: 'Implement virtual meetings to reduce travel costs by 30%' }
                  ].map((rec, index) => (
                    <div key={index} className="p-2 bg-green-50 rounded">
                      <div className="font-medium text-green-800">{rec.title}</div>
                      <p className="text-gray-600">{rec.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CostOptimizationSuggestions;