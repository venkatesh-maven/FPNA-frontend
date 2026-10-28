import React, { useState } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import { 
  FiDownload, 
  FiHelpCircle, 
  FiTrendingUp, 
  FiDollarSign, 
} from 'react-icons/fi';
import { MdOutlineSort } from "react-icons/md";
import { getDecimalPrecision } from '../../../utils/formatters';

const ForecastAccuracyMonitoring = () => {
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

  // Data for Revenue Forecast Deviation
  const revenueDeviationData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
    datasets: [
      {
        label: 'Predicted Revenue ($M)',
        data: [1.2, 1.3, 1.25, 1.4, 1.35],
        borderColor: 'rgba(14, 165, 233, 1)', // sky-500
        backgroundColor: 'rgba(14, 165, 233, 0.2)',
        fill: true,
      },
      {
        label: 'Actual Revenue ($M)',
        data: [1.18, 1.28, 1.30, 1.38, 1.40],
        borderColor: 'rgba(34, 197, 94, 1)', // green-500
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        fill: true,
      }
    ]
  };

  // Data for Expense Forecast Accuracy
  const expenseAccuracyData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
    datasets: [
      {
        label: 'Budgeted Expenses ($M)',
        data: [0.8, 0.85, 0.9, 0.88, 0.92],
        borderColor: 'rgba(14, 165, 233, 1)', // sky-500
        backgroundColor: 'rgba(14, 165, 233, 0.2)',
        fill: true,
      },
      {
        label: 'Actual Expenses ($M)',
        data: [0.82, 0.87, 0.89, 0.90, 0.91],
        borderColor: 'rgba(34, 197, 94, 1)', // green-500
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        fill: true,
      }
    ]
  };

  // Data for Cash Flow Forecast Reliability
  const cashFlowReliabilityData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
    datasets: [
      {
        label: 'Projected Cash Flow ($M)',
        data: [0.5, 0.55, 0.6, 0.58, 0.62],
        borderColor: 'rgba(14, 165, 233, 1)', // sky-500
        backgroundColor: 'rgba(14, 165, 233, 0.2)',
        fill: true,
      },
      {
        label: 'Actual Cash Flow ($M)',
        data: [0.48, 0.56, 0.59, 0.60, 0.61],
        borderColor: 'rgba(34, 197, 94, 1)', // green-500
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        fill: true,
      }
    ]
  };

  // Data for AI Model Confidence Scores
  const confidenceScoresData = {
    labels: ['Revenue', 'Expenses', 'Cash Flow'],
    datasets: [{
      label: 'Confidence Score (%)',
      data: [92, 88, 90],
      backgroundColor: 'rgba(14, 165, 233, 0.7)', // sky-500
      borderColor: 'rgba(14, 165, 233, 1)',
      borderWidth: 1,
    }]
  };

  // Data for Forecast Adjustment History
  const adjustmentHistory = [
    { date: '2025-05-15', forecastType: 'Revenue', original: 1.35, adjusted: 1.40, actual: 1.40, user: 'John Doe' },
    { date: '2025-04-10', forecastType: 'Expenses', original: 0.88, adjusted: 0.90, actual: 0.90, user: 'Jane Smith' },
    { date: '2025-03-05', forecastType: 'Cash Flow', original: 0.60, adjusted: 0.58, actual: 0.59, user: 'Alex Brown' },
    { date: '2025-02-01', forecastType: 'Revenue', original: 1.30, adjusted: 1.28, actual: 1.28, user: 'Sarah Lee' },
  ];

  // Data for Historical Performance Summary (last 12 months)
  const historicalPerformance = [
    { month: 'May 2025', revenueAccuracy: 98, expenseAccuracy: 97, cashFlowAccuracy: 95 },
    { month: 'Apr 2025', revenueAccuracy: 96, expenseAccuracy: 95, cashFlowAccuracy: 94 },
    { month: 'Mar 2025', revenueAccuracy: 95, expenseAccuracy: 94, cashFlowAccuracy: 93 },
    { month: 'Feb 2025', revenueAccuracy: 97, expenseAccuracy: 96, cashFlowAccuracy: 92 },
    { month: 'Jan 2025', revenueAccuracy: 94, expenseAccuracy: 93, cashFlowAccuracy: 91 },
    { month: 'Dec 2024', revenueAccuracy: 93, expenseAccuracy: 92, cashFlowAccuracy: 90 },
    { month: 'Nov 2024', revenueAccuracy: 92, expenseAccuracy: 91, cashFlowAccuracy: 89 },
    { month: 'Oct 2024', revenueAccuracy: 91, expenseAccuracy: 90, cashFlowAccuracy: 88 },
    { month: 'Sep 2024', revenueAccuracy: 90, expenseAccuracy: 89, cashFlowAccuracy: 87 },
    { month: 'Aug 2024', revenueAccuracy: 89, expenseAccuracy: 88, cashFlowAccuracy: 86 },
    { month: 'Jul 2024', revenueAccuracy: 88, expenseAccuracy: 87, cashFlowAccuracy: 85 },
    { month: 'Jun 2024', revenueAccuracy: 87, expenseAccuracy: 86, cashFlowAccuracy: 84 },
  ];

  const sortTable = (key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });
    adjustmentHistory.sort((a, b) => {
      if (direction === 'asc') return a[key] > b[key] ? 1 : -1;
      return a[key] < b[key] ? 1 : -1;
    });
  };

  return (
    <div className="bg-gray-50 min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-900 to-sky-50 p-4 rounded-lg mb-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <FiTrendingUp className="text-white mr-3 text-xl" />
              <div>
                <h1 className="text-xl font-bold text-white">AI-Driven Forecast Accuracy Monitoring</h1>
                <p className="text-sky-100 text-s">Track prediction reliability with AI insights</p>
              </div>
            </div>
            <button className="flex items-center py-2 px-3 text-s font-medium text-sky-900 bg-white rounded-lg hover:bg-sky-50">
              <FiDownload className="mr-1" /> Export Report
            </button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h3 className="text-s font-medium text-gray-600">Average Forecast Deviation</h3>
            <div className="text-2xl font-bold text-sky-600">±2.5%</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h3 className="text-s font-medium text-gray-600">Most Accurate Forecast</h3>
            <div className="text-2xl font-bold text-sky-600">Revenue (92%)</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h3 className="text-s font-medium text-gray-600">Manual Adjustments</h3>
            <div className="text-2xl font-bold text-sky-600">4</div>
          </div>
        </div>

        {/* Side-by-Side Forecast Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Revenue Forecast Deviation Analysis */}
          <div className="bg-white rounded-lg p-4 border border-gray-200 relative">
            <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
              Revenue Forecast Deviation
              <div className="ml-2 relative group">
                <FiHelpCircle className="text-gray-400 w-4 h-4" />
                <div className="absolute hidden group-hover:block bg-gray-800 text-white text-x rounded p-2 -mt-10 w-48 z-10">
                  AI Analysis: Compares actual revenue against predictions over the past 5 months.
                </div>
              </div>
            </h3>
            <div className="h-48">
              <Line
                data={revenueDeviationData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      title: { display: true, text: 'Revenue ($M)', font: { size: 10 } }
                    },
                    x: { ticks: { font: { size: 10 } } }
                  },
                  plugins: {
                    legend: { position: 'top', labels: { boxWidth: 10, font: { size: 10 } } },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          return `${context.dataset.label}: $${context.raw}M`;
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* Expense Forecast Accuracy */}
          <div className="bg-white rounded-lg p-4 border border-gray-200 relative">
            <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
              Expense Forecast Accuracy
              <div className="ml-2 relative group">
                <FiHelpCircle className="text-gray-400 w-4 h-4" />
                <div className="absolute hidden group-hover:block bg-gray-800 text-white text-x rounded p-2 -mt-10 w-48 z-10">
                  AI Analysis: Tracks how close budgeted expenses were to actual costs.
                </div>
              </div>
            </h3>
            <div className="h-48">
              <Line
                data={expenseAccuracyData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      title: { display: true, text: 'Expenses ($M)', font: { size: 10 } }
                    },
                    x: { ticks: { font: { size: 10 } } }
                  },
                  plugins: {
                    legend: { position: 'top', labels: { boxWidth: 10, font: { size: 10 } } },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          return `${context.dataset.label}: $${context.raw}M`;
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* Cash Flow Forecast Reliability */}
          <div className="bg-white rounded-lg p-4 border border-gray-200 relative">
            <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
              Cash Flow Forecast Reliability
              <div className="ml-2 relative group">
                <FiHelpCircle className="text-gray-400 w-4 h-4" />
                <div className="absolute hidden group-hover:block bg-gray-800 text-white text-x rounded p-2 -mt-10 w-48 z-10">
                  AI Analysis: Monitors variances between projected and actual liquidity positions.
                </div>
              </div>
            </h3>
            <div className="h-48">
              <Line
                data={cashFlowReliabilityData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      title: { display: true, text: 'Cash Flow ($M)', font: { size: 10 } }
                    },
                    x: { ticks: { font: { size: 10 } } }
                  },
                  plugins: {
                    legend: { position: 'top', labels: { boxWidth: 10, font: { size: 10 } } },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          return `${context.dataset.label}: $${context.raw}M`;
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Detailed Deviation Analysis */}
        <div className="bg-white rounded-lg p-4 border border-gray-200 mb-6">
          <h3 className="text-md font-semibold text-gray-800 mb-3">Detailed Deviation Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-sky-50 rounded-lg p-4">
              <h4 className="text-s font-medium text-sky-800 mb-2">Revenue Deviation</h4>
              <div className="text-lg font-bold text-sky-600">±2.1%</div>
              <p className="text-x text-gray-600 mt-1">AI Insight: Seasonal trends slightly impacted predictions in March.</p>
            </div>
            <div className="bg-sky-50 rounded-lg p-4">
              <h4 className="text-s font-medium text-sky-800 mb-2">Expense Deviation</h4>
              <div className="text-lg font-bold text-sky-600">±1.8%</div>
              <p className="text-x text-gray-600 mt-1">AI Insight: Unexpected operational costs in February increased variance.</p>
            </div>
            <div className="bg-sky-50 rounded-lg p-4">
              <h4 className="text-s font-medium text-sky-800 mb-2">Cash Flow Deviation</h4>
              <div className="text-lg font-bold text-sky-600">±2.3%</div>
              <p className="text-x text-gray-600 mt-1">AI Insight: Delayed payments in April affected liquidity projections.</p>
            </div>
          </div>
        </div>

        {/* AI Model Confidence Scores */}

        <div className='flex flex-row justify-between gap-5'>
        <div className="bg-white rounded-lg p-4 border border-gray-200 mb-6">
          <h3 className="text-md font-semibold text-gray-800 mb-3">AI Model Confidence Scores</h3>
          <div className="h-48">
            <Bar
              data={confidenceScoresData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100,
                    title: { display: true, text: 'Confidence Score (%)', font: { size: 10 } }
                  },
                  x: { ticks: { font: { size: 10 } } }
                },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: function(context) {
                        return `${context.label}: ${context.raw}% confidence`;
                      }
                    }
                  }
                }
              }}
            />
          </div>
        </div>

        {/* AI-Driven Improvement Suggestions */}
        <div className="bg-white rounded-lg p-4 border border-gray-200 mb-6">
          <h3 className="text-md font-semibold text-gray-800 mb-3">AI-Driven Improvement Suggestions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-sky-50 rounded-lg p-4">
              <h4 className="text-s font-medium text-sky-800 mb-2">Enhance Revenue Forecasting</h4>
              <p className="text-s text-gray-600 mb-2">Incorporate seasonal sales data to reduce deviation by 1.5%.</p>
              <button className="text-s text-sky-600 hover:text-sky-800 font-medium">Apply Suggestion</button>
            </div>
            <div className="bg-sky-50 rounded-lg p-4">
              <h4 className="text-s font-medium text-sky-800 mb-2">Optimize Expense Predictions</h4>
              <p className="text-s text-gray-600 mb-2">Adjust for unexpected costs by adding a 5% buffer to operational expenses.</p>
              <button className="text-s text-sky-600 hover:text-sky-800 font-medium">Apply Suggestion</button>
            </div>
            <div className="bg-sky-50 rounded-lg p-4">
              <h4 className="text-s font-medium text-sky-800 mb-2">Improve Cash Flow Accuracy</h4>
              <p className="text-s text-gray-600 mb-2">Integrate real-time payment tracking to reduce variance by 2%.</p>
              <button className="text-s text-sky-600 hover:text-sky-800 font-medium">Apply Suggestion</button>
            </div>
          </div>
        </div>

        </div>

        {/* Forecast Adjustment History */}
        <div className="bg-white rounded-lg p-4 border border-gray-200 mb-6">
          <h3 className="text-md font-semibold text-gray-800 mb-3">Forecast Adjustment History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-s text-left text-gray-600">
              <thead className="bg-sky-50 text-sky-800">
                <tr>
                  <th className="py-2 px-4 cursor-pointer" onClick={() => sortTable('date')}>
                    Date <MdOutlineSort className="inline ml-1" />
                  </th>
                  <th className="py-2 px-4 cursor-pointer" onClick={() => sortTable('forecastType')}>
                    Forecast Type <MdOutlineSort className="inline ml-1" />
                  </th>
                  <th className="py-2 px-4 cursor-pointer" onClick={() => sortTable('original')}>
                    Original ($M) <MdOutlineSort className="inline ml-1" />
                  </th>
                  <th className="py-2 px-4 cursor-pointer" onClick={() => sortTable('adjusted')}>
                    Adjusted ($M) <MdOutlineSort className="inline ml-1" />
                  </th>
                  <th className="py-2 px-4 cursor-pointer" onClick={() => sortTable('actual')}>
                    Actual ($M) <MdOutlineSort className="inline ml-1" />
                  </th>
                  <th className="py-2 px-4 cursor-pointer" onClick={() => sortTable('user')}>
                    Adjusted By <MdOutlineSort className="inline ml-1" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {adjustmentHistory.map((entry, index) => (
                  <tr key={index} className="border-b hover:bg-sky-50">
                    <td className="py-2 px-4">{entry.date}</td>
                    <td className="py-2 px-4">{entry.forecastType}</td>
                    <td className="py-2 px-4">${entry.original.toFixed(getDecimalPrecision())}M</td>
                    <td className="py-2 px-4">${entry.adjusted.toFixed(getDecimalPrecision())}M</td>
                    <td className="py-2 px-4">${entry.actual.toFixed(getDecimalPrecision())}M</td>
                    <td className="py-2 px-4">{entry.user}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Historical Performance Summary */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h3 className="text-md font-semibold text-gray-800 mb-3">Historical Performance Summary (Last 12 Months)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-s text-left text-gray-600">
              <thead className="bg-sky-50 text-sky-800">
                <tr>
                  <th className="py-2 px-4">Month</th>
                  <th className="py-2 px-4">Revenue Accuracy (%)</th>
                  <th className="py-2 px-4">Expense Accuracy (%)</th>
                  <th className="py-2 px-4">Cash Flow Accuracy (%)</th>
                </tr>
              </thead>
              <tbody>
                {historicalPerformance.map((entry, index) => (
                  <tr key={index} className="border-b hover:bg-sky-50">
                    <td className="py-2 px-4">{entry.month}</td>
                    <td className="py-2 px-4">{entry.revenueAccuracy}%</td>
                    <td className="py-2 px-4">{entry.expenseAccuracy}%</td>
                    <td className="py-2 px-4">{entry.cashFlowAccuracy}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForecastAccuracyMonitoring;