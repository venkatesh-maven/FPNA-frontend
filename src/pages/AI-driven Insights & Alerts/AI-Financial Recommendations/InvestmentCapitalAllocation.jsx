import React, { useState } from 'react';
import { Pie, Bar } from 'react-chartjs-2';
import { 
  FiDownload, 
  FiInfo, 
  FiDollarSign, 
  FiPieChart, 
  FiBarChart2, 
//   MdOutlineSort, 
  FiHelpCircle 
} from 'react-icons/fi';
import { MdOutlineSort } from "react-icons/md";
import { getDecimalPrecision } from '../../../utils/formatters';


const InvestmentCapitalAllocation = () => {
  const [sortConfig, setSortConfig] = useState({ key: 'roi', direction: 'desc' });

  // Chart data for capital allocation
  const allocationData = {
    labels: ['R&D', 'Marketing', 'Infrastructure', 'Operations', 'Technology', 'Other'],
    datasets: [{
      data: [30, 20, 25, 15, 5, 5],
      backgroundColor: [
        'rgba(14, 165, 233, 0.7)', // sky-500
        'rgba(56, 189, 248, 0.7)', // sky-400
        'rgba(125, 211, 252, 0.7)', // sky-300
        'rgba(186, 230, 253, 0.7)', // sky-200
        'rgba(224, 242, 254, 0.7)', // sky-100
        'rgba(240, 249, 255, 0.7)', // sky-50
      ],
      borderWidth: 1,
    }]
  };

  // Chart data for ROI by category
  const roiData = {
    labels: ['R&D', 'Marketing', 'Infrastructure', 'Operations', 'Technology'],
    datasets: [{
      label: 'ROI (%)',
      data: [12, 8, 10, 6, 15],
      backgroundColor: 'rgba(14, 165, 233, 0.7)', // sky-500
      borderColor: 'rgba(14, 165, 233, 1)',
      borderWidth: 1,
    }]
  };

  // Table data for investment opportunities
  const investmentOpportunities = [
    { category: 'R&D Expansion', amount: 500000, roi: 12, risk: 'Medium', timeline: '12 months' },
    { category: 'Marketing Campaign', amount: 300000, roi: 8, risk: 'Low', timeline: '6 months' },
    { category: 'Infrastructure Upgrade', amount: 400000, roi: 10, risk: 'Medium', timeline: '18 months' },
    { category: 'Tech Innovation', amount: 200000, roi: 15, risk: 'High', timeline: '24 months' },
    { category: 'Operational Efficiency', amount: 150000, roi: 6, risk: 'Low', timeline: '9 months' },
  ];

  const sortTable = (key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });
    investmentOpportunities.sort((a, b) => {
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
              <FiDollarSign className="text-white mr-3 text-xl" />
              <div>
                <h1 className="text-xl font-bold text-white">Investment & Capital Allocation</h1>
                <p className="text-sky-100 text-s">Optimize your capital investments with AI-driven insights</p>
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
            <h3 className="text-s font-medium text-gray-600">Total Capital Allocated</h3>
            <div className="text-2xl font-bold text-sky-600">$1,550,000</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h3 className="text-s font-medium text-gray-600">Average ROI</h3>
            <div className="text-2xl font-bold text-sky-600">10.2%</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h3 className="text-s font-medium text-gray-600">High-Impact Opportunity</h3>
            <div className="text-2xl font-bold text-sky-600">Tech Innovation</div>
          </div>
        </div>

        {/* Capital Allocation and ROI Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg p-4 border border-gray-200 relative">
            <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
              Capital Allocation Breakdown
              <div className="ml-2 relative group">
                <FiHelpCircle className="text-gray-400 w-4 h-4" />
                <div className="absolute hidden group-hover:block bg-gray-800 text-white text-x rounded p-2 -mt-10 w-48 z-10">
                  AI Analysis: Allocation based on historical performance and projected returns.
                </div>
              </div>
            </h3>
            <div className="h-64">
              <Pie
                data={allocationData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 10 } },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          return `${context.label}: ${context.raw}% of total capital`;
                        }
                      }
                    }
                  }
                }}
              />
            </div>
            <button className="absolute top-4 right-4 text-s text-sky-600 hover:text-sky-800 font-medium flex items-center">
              Ask AI <FiHelpCircle className="ml-1" />
            </button>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 relative">
            <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
              ROI by Investment Category
              <div className="ml-2 relative group">
                <FiHelpCircle className="text-gray-400 w-4 h-4" />
                <div className="absolute hidden group-hover:block bg-gray-800 text-white text-x rounded p-2 -mt-10 w-48 z-10">
                  AI Analysis: ROI calculated based on past 12 months of performance data.
                </div>
              </div>
            </h3>
            <div className="h-64">
              <Bar
                data={roiData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      title: { display: true, text: 'ROI (%)', font: { size: 10 } }
                    },
                    x: { ticks: { font: { size: 10 } } }
                  },
                  plugins: { legend: { display: false } }
                }}
              />
            </div>
            <button className="absolute top-4 right-4 text-s text-sky-600 hover:text-sky-800 font-medium flex items-center">
              Ask AI <FiHelpCircle className="ml-1" />
            </button>
          </div>
        </div>

        {/* Investment Opportunities Table */}
        <div className="bg-white rounded-lg p-4 border border-gray-200 mb-6">
          <h3 className="text-md font-semibold text-gray-800 mb-3">Investment Opportunities</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-s text-left text-gray-600">
              <thead className="bg-sky-50 text-sky-800">
                <tr>
                  <th className="py-2 px-4 cursor-pointer" onClick={() => sortTable('category')}>
                    Category <MdOutlineSort  className="inline ml-1" />
                  </th>
                  <th className="py-2 px-4 cursor-pointer" onClick={() => sortTable('amount')}>
                    Amount ($) <MdOutlineSort  className="inline ml-1" />
                  </th>
                  <th className="py-2 px-4 cursor-pointer" onClick={() => sortTable('roi')}>
                    ROI (%) <MdOutlineSort  className="inline ml-1" />
                  </th>
                  <th className="py-2 px-4 cursor-pointer" onClick={() => sortTable('risk')}>
                    Risk Level <MdOutlineSort  className="inline ml-1" />
                  </th>
                  <th className="py-2 px-4 cursor-pointer" onClick={() => sortTable('timeline')}>
                    Timeline <MdOutlineSort  className="inline ml-1" />
                  </th>
                  <th className="py-2 px-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {investmentOpportunities.map((opp, index) => (
                  <tr key={index} className="border-b hover:bg-sky-50">
                    <td className="py-2 px-4">{opp.category}</td>
                    <td className="py-2 px-4">${opp.amount.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                    <td className="py-2 px-4">{opp.roi}%</td>
                    <td className={`py-2 px-4 ${opp.risk === 'High' ? 'text-red-600' : opp.risk === 'Medium' ? 'text-orange-600' : 'text-green-600'}`}>
                      {opp.risk}
                    </td>
                    <td className="py-2 px-4">{opp.timeline}</td>
                    <td className="py-2 px-4">
                      <button className="text-s text-sky-600 hover:text-sky-800 font-medium">
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI-Driven Recommendations */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h3 className="text-md font-semibold text-gray-800 mb-3">AI-Driven Recommendations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                title: 'Increase Tech Investment',
                description: 'Allocate an additional $100K to Technology for a projected ROI of 15%, the highest among categories.',
                impact: 'High ROI, High Risk',
                color: 'sky'
              },
              {
                title: 'Reallocate Marketing Budget',
                description: 'Shift $50K from Marketing to Infrastructure to balance risk and improve ROI stability.',
                impact: 'Moderate ROI, Low Risk',
                color: 'sky'
              },
              {
                title: 'Delay Operational Investment',
                description: 'Postpone $50K in Operational Efficiency investments until next quarter to reduce short-term risk.',
                impact: 'Low ROI, Low Risk',
                color: 'sky'
              }
            ].map((rec, index) => (
              <div key={index} className={`bg-${rec.color}-50 rounded-lg p-4 border border-${rec.color}-200`}>
                <h4 className={`text-s font-semibold text-${rec.color}-800 mb-2`}>{rec.title}</h4>
                <p className="text-s text-gray-600 mb-2">{rec.description}</p>
                <div className="text-x text-gray-500">Impact: {rec.impact}</div>
                <button className={`mt-2 text-s text-${rec.color}-600 hover:text-${rec.color}-800 font-medium`}>
                  Implement Now
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvestmentCapitalAllocation;