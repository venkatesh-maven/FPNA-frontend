import React, { useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import { 
  FiDownload, 
  FiHelpCircle, 
  FiTrendingUp, 
  FiMenu, 
  FiX 
} from 'react-icons/fi';

// Import Animate.css for animations
const AnimateCSS = () => (
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css" />
);

const BenchmarkingPeerComparisons = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Trigger animations on mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Data for Industry Profitability Comparison
  const profitabilityData = {
    labels: ['Your Company', 'Industry Avg', 'Top Performer'],
    datasets: [{
      label: 'Profit Margin (%)',
      data: [15, 12, 18],
      backgroundColor: ['rgba(14, 165, 233, 0.7)', 'rgba(209, 213, 219, 0.7)', 'rgba(34, 197, 94, 0.7)'], // sky-500, gray-300, green-500
      borderColor: ['rgba(14, 165, 233, 1)', 'rgba(209, 213, 219, 1)', 'rgba(34, 197, 94, 1)'],
      borderWidth: 1,
    }]
  };

  // Data for Revenue Growth Benchmarking
  const revenueGrowthData = {
    labels: ['Your Company', 'Market Leader', 'Industry Avg'],
    datasets: [{
      label: 'Revenue Growth (%)',
      data: [8, 12, 10],
      backgroundColor: ['rgba(14, 165, 233, 0.7)', 'rgba(34, 197, 94, 0.7)', 'rgba(209, 213, 219, 0.7)'],
      borderColor: ['rgba(14, 165, 233, 1)', 'rgba(34, 197, 94, 1)', 'rgba(209, 213, 219, 1)'],
      borderWidth: 1,
    }]
  };

  // Data for Operational Cost Efficiency Index
  const costEfficiencyData = {
    labels: ['Your Company', 'Peers', 'Industry Best'],
    datasets: [{
      label: 'Cost Efficiency Index',
      data: [82, 78, 90],
      backgroundColor: ['rgba(14, 165, 233, 0.7)', 'rgba(209, 213, 219, 0.7)', 'rgba(34, 197, 94, 0.7)'],
      borderColor: ['rgba(14, 165, 233, 1)', 'rgba(209, 213, 219, 1)', 'rgba(34, 197, 94, 1)'],
      borderWidth: 1,
    }]
  };

  // Data for Debt & Leverage Comparisons
  const debtLeverageData = {
    labels: ['Your Company', 'Industry Std', 'Top Performer'],
    datasets: [{
      label: 'Debt-to-Equity Ratio',
      data: [0.6, 0.5, 0.4],
      backgroundColor: ['rgba(14, 165, 233, 0.7)', 'rgba(209, 213, 219, 0.7)', 'rgba(34, 197, 94, 0.7)'],
      borderColor: ['rgba(14, 165, 233, 1)', 'rgba(209, 213, 219, 1)', 'rgba(34, 197, 94, 1)'],
      borderWidth: 1,
    }]
  };

  // Data for Employee Productivity Metrics
  const employeeProductivityData = {
    labels: ['Your Company', 'Competitor Avg', 'Leader'],
    datasets: [{
      label: 'Revenue per Employee ($K)',
      data: [150, 140, 180],
      backgroundColor: ['rgba(14, 165, 233, 0.7)', 'rgba(209, 213, 219, 0.7)', 'rgba(34, 197, 94, 0.7)'],
      borderColor: ['rgba(14, 165, 233, 1)', 'rgba(209, 213, 219, 1)', 'rgba(34, 197, 94, 1)'],
      borderWidth: 1,
    }]
  };

  // Data for Market Expansion & Performance Trends
  const marketTrends = [
    { competitor: 'Competitor A', region: 'Asia-Pacific', growth: 15, strategy: 'Aggressive digital marketing campaigns' },
    { competitor: 'Competitor B', region: 'Europe', growth: 10, strategy: 'Partnerships with local distributors' },
    { competitor: 'Competitor C', region: 'North America', growth: 12, strategy: 'Product localization for regional markets' },
  ];

  return (
    <>
      <AnimateCSS />
      <div className="bg-gray-50 min-h-screen flex">
        {/* Collapsible Sidebar */}
       

        {/* Main Content */}
        <div className="flex-1 p-4 md:p-4 overflow-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-lg font-bold p-2 text-white">
 {/* <FiTrendingUp className="text-sky-500 mr-2" /> */}
                  AI-Powered Benchmarking & Peer Comparisons                            </h1>
                            {/* <p className="text-sky-100 text-x">{currentUser.company_name}</p> */}
                        </div>
                        <div className="flex space-x-2">
                            
                           <button
                                className="flex items-center py-2 px-5 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200">
              <FiDownload className="mr-1" /> Export
            </button>
                        </div>
                    </div>
                </div>

          {/* Key Insights with Radial Progress */}
          <div className={`grid grid-cols-1 md:grid-cols-3 mt-5 gap-4 mb-6 ${isMounted ? 'animate__animated animate__fadeInUp' : ''}`}>
            <div className="bg-white rounded-lg p-4 border border-gray-200 flex items-center justify-between hover:shadow-lg transition-shadow duration-300">
              <div>
                <h3 className="text-s font-medium text-gray-600">Profit Margin</h3>
                <div className="text-xl font-bold text-sky-600">15% (+3%)</div>
              </div>
              <div className="relative w-16 h-16">
                <svg className="w-full h-full" viewBox="0 0 36 36">
                  <path
                    className="text-gray-200"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    className="text-sky-500 animate__animated animate__fadeIn"
                    style={{ animationDuration: '1.5s' }}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 11.28 4.682 a 15.9155 15.9155 0 0 1 4.682 11.28"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray="75, 100"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-s font-bold text-sky-600">+3%</div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200 flex items-center justify-between hover:shadow-lg transition-shadow duration-300">
              <div>
                <h3 className="text-s font-medium text-gray-600">Revenue Growth Gap</h3>
                <div className="text-xl font-bold text-sky-600">8% (-4%)</div>
              </div>
              <div className="relative w-16 h-16">
                <svg className="w-full h-full" viewBox="0 0 36 36">
                  <path
                    className="text-gray-200"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    className="text-red-500 animate__animated animate__fadeIn"
                    style={{ animationDuration: '1.5s' }}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 11.28 4.682 a 15.9155 15.9155 0 0 1 4.682 11.28"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray="50, 100"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-s font-bold text-red-600">-4%</div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200 flex items-center justify-between hover:shadow-lg transition-shadow duration-300">
              <div>
                <h3 className="text-s font-medium text-gray-600">Employee Productivity</h3>
                <div className="text-xl font-bold text-sky-600">$150K (+$10K)</div>
              </div>
              <div className="relative w-16 h-16">
                <svg className="w-full h-full" viewBox="0 0 36 36">
                  <path
                    className="text-gray-200"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    className="text-sky-500 animate__animated animate__fadeIn"
                    style={{ animationDuration: '1.5s' }}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 11.28 4.682 a 15.9155 15.9155 0 0 1 4.682 11.28"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray="65, 100"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-s font-bold text-sky-600">+10K</div>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Industry Profitability Comparison */}
            <div className={`bg-white rounded-lg p-4 border border-gray-200 relative hover:shadow-lg transition-shadow duration-300 ${isMounted ? 'animate__animated animate__fadeInUp' : ''}`}>
              <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
                Profit Margin
                <div className="ml-2 relative group">
                  <FiHelpCircle className="text-gray-400 w-4 h-4" />
                  <div className="absolute hidden group-hover:block bg-gray-800 text-white text-x rounded p-2 -mt-10 w-48 z-10 animate__animated animate__fadeIn">
                    AI Analysis: Profit margins as of May 2025.
                  </div>
                </div>
              </h3>
              <div className="h-40">
                <Bar
                  data={profitabilityData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: { beginAtZero: true, title: { display: true, text: '%', font: { size: 10 } } },
                      x: { ticks: { font: { size: 10 } } }
                    },
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: function(context) {
                            return `${context.label}: ${context.raw}%`;
                          }
                        }
                      }
                    },
                    animation: {
                      duration: 1500,
                      easing: 'easeOutBounce',
                      delay: (context) => context.dataIndex * 300, // Staggered animation for bars
                    },
                    elements: {
                      bar: {
                        hoverBackgroundColor: 'rgba(14, 165, 233, 1)', // Hover effect
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* Revenue Growth Benchmarking */}
            <div className={`bg-white rounded-lg p-4 border border-gray-200 relative hover:shadow-lg transition-shadow duration-300 ${isMounted ? 'animate__animated animate__fadeInUp animate__delay-1s' : ''}`}>
              <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
                Revenue Growth
                <div className="ml-2 relative group">
                  <FiHelpCircle className="text-gray-400 w-4 h-4" />
                  <div className="absolute hidden group-hover:block bg-gray-800 text-white text-x rounded p-2 -mt-10 w-48 z-10 animate__animated animate__fadeIn">
                    AI Analysis: Revenue growth over the past year.
                  </div>
                </div>
              </h3>
              <div className="h-40">
                <Bar
                  data={revenueGrowthData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: { beginAtZero: true, title: { display: true, text: '%', font: { size: 10 } } },
                      x: { ticks: { font: { size: 10 } } }
                    },
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: function(context) {
                            return `${context.label}: ${context.raw}%`;
                          }
                        }
                      }
                    },
                    animation: {
                      duration: 1500,
                      easing: 'easeOutBounce',
                      delay: (context) => context.dataIndex * 300,
                    },
                    elements: {
                      bar: {
                        hoverBackgroundColor: 'rgba(14, 165, 233, 1)',
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* Operational Cost Efficiency Index */}
            <div className={`bg-white rounded-lg p-4 border border-gray-200 relative hover:shadow-lg transition-shadow duration-300 ${isMounted ? 'animate__animated animate__fadeInUp animate__delay-2s' : ''}`}>
              <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
                Cost Efficiency
                <div className="ml-2 relative group">
                  <FiHelpCircle className="text-gray-400 w-4 h-4" />
                  <div className="absolute hidden group-hover:block bg-gray-800 text-white text-x rounded p-2 -mt-10 w-48 z-10 animate__animated animate__fadeIn">
                    AI Analysis: Cost efficiency index (100 = optimal).
                  </div>
                </div>
              </h3>
              <div className="h-40">
                <Bar
                  data={costEfficiencyData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: { beginAtZero: true, title: { display: true, text: 'Index', font: { size: 10 } } },
                      x: { ticks: { font: { size: 10 } } }
                    },
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: function(context) {
                            return `${context.label}: ${context.raw}`;
                          }
                        }
                      }
                    },
                    animation: {
                      duration: 1500,
                      easing: 'easeOutBounce',
                      delay: (context) => context.dataIndex * 300,
                    },
                    elements: {
                      bar: {
                        hoverBackgroundColor: 'rgba(14, 165, 233, 1)',
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Second Row of Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Debt & Leverage Comparisons */}
            <div className={`bg-white rounded-lg p-4 border border-gray-200 relative hover:shadow-lg transition-shadow duration-300 ${isMounted ? 'animate__animated animate__fadeInUp' : ''}`}>
              <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
                Debt & Leverage
                <div className="ml-2 relative group">
                  <FiHelpCircle className="text-gray-400 w-4 h-4" />
                  <div className="absolute hidden group-hover:block bg-gray-800 text-white text-x rounded p-2 -mt-10 w-48 z-10 animate__animated animate__fadeIn">
                    AI Analysis: Debt-to-equity ratios as of May 2025.
                  </div>
                </div>
              </h3>
              <div className="h-40">
                <Bar
                  data={debtLeverageData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: { beginAtZero: true, title: { display: true, text: 'Ratio', font: { size: 10 } } },
                      x: { ticks: { font: { size: 10 } } }
                    },
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: function(context) {
                            return `${context.label}: ${context.raw}`;
                          }
                        }
                      }
                    },
                    animation: {
                      duration: 1500,
                      easing: 'easeOutBounce',
                      delay: (context) => context.dataIndex * 300,
                    },
                    elements: {
                      bar: {
                        hoverBackgroundColor: 'rgba(14, 165, 233, 1)',
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* Employee Productivity Metrics */}
            <div className={`bg-white rounded-lg p-4 border border-gray-200 relative hover:shadow-lg transition-shadow duration-300 ${isMounted ? 'animate__animated animate__fadeInUp animate__delay-1s' : ''}`}>
              <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
                Employee Productivity
                <div className="ml-2 relative group">
                  <FiHelpCircle className="text-gray-400 w-4 h-4" />
                  <div className="absolute hidden group-hover:block bg-gray-800 text-white text-x rounded p-2 -mt-10 w-48 z-10 animate__animated animate__fadeIn">
                    AI Analysis: Revenue per employee over the past year.
                  </div>
                </div>
              </h3>
              <div className="h-40">
                <Bar
                  data={employeeProductivityData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: { beginAtZero: true, title: { display: true, text: '$K', font: { size: 10 } } },
                      x: { ticks: { font: { size: 10 } } }
                    },
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: function(context) {
                            return `${context.label}: $${context.raw}K`;
                          }
                        }
                      }
                    },
                    animation: {
                      duration: 1500,
                      easing: 'easeOutBounce',
                      delay: (context) => context.dataIndex * 300,
                    },
                    elements: {
                      bar: {
                        hoverBackgroundColor: 'rgba(14, 165, 233, 1)',
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Market Expansion & Performance Trends */}
          <div className={`bg-white rounded-lg p-4 border border-gray-200 ${isMounted ? 'animate__animated animate__fadeInUp' : ''}`}>
            <h3 className="text-md font-semibold text-gray-800 mb-3">Market Expansion & Performance Trends</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-s text-left text-gray-600">
                <thead className="bg-sky-50 text-sky-800">
                  <tr>
                    <th className="py-2 px-4">Competitor</th>
                    <th className="py-2 px-4">Region</th>
                    <th className="py-2 px-4">Growth Rate (%)</th>
                    <th className="py-2 px-4">AI-Suggested Strategy</th>
                    <th className="py-2 px-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {marketTrends.map((trend, index) => (
                    <tr key={index} className="border-b hover:bg-sky-50 transition-colors duration-200">
                      <td className="py-2 px-4">{trend.competitor}</td>
                      <td className="py-2 px-4">{trend.region}</td>
                      <td className="py-2 px-4">{trend.growth}%</td>
                      <td className="py-2 px-4">{trend.strategy}</td>
                      <td className="py-2 px-4">
                        <button className="text-s text-sky-600 hover:text-sky-800 font-medium transition-colors duration-200">
                          Explore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default BenchmarkingPeerComparisons;