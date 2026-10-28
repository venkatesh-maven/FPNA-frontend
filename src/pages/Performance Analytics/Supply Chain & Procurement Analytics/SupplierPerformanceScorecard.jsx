import React, { useState } from 'react';
import { Bar, Pie } from 'react-chartjs-2';
import Chart from 'react-apexcharts';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { FiChevronRight} from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import { GrLinkNext } from "react-icons/gr";
// It's good practice to register Chart.js components if not done globally
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, RadialLinearScale, Title, Tooltip, Legend, Filler } from 'chart.js';
import { getDecimalPrecision } from '../../../utils/formatters';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

const SupplierPerformanceScorecard = () => {
  const [timePeriod, setTimePeriod] = useState('Last Quarter');
  const [businessUnit, setBusinessUnit] = useState('All Units');
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  // Supplier data - unchanged
  const suppliers = [
    { 
      id: 1,
      name: 'Acme Materials', 
      delivery: '98%', 
      deliveryTrend: [92, 94, 96, 95, 97, 98],
      contract: '95%', 
      contractTrend: [90, 92, 93, 94, 95, 95],
      cost: '4.8/5', 
      costTrend: [4.5, 4.6, 4.7, 4.7, 4.8, 4.8],
      risk: 'Low',
      spend: '$1.2M',
      relationship: 'Strategic Partner',
      since: '2018'
    },
    { 
      id: 2,
      name: 'Global Logistics', 
      delivery: '89%', 
      deliveryTrend: [85, 86, 88, 87, 89, 89],
      contract: '91%', 
      contractTrend: [88, 89, 90, 90, 91, 91],
      cost: '4.2/5', 
      costTrend: [4.0, 4.1, 4.1, 4.2, 4.2, 4.2],
      risk: 'Medium',
      spend: '$850K',
      relationship: 'Preferred Vendor',
      since: '2020'
    },
    { 
      id: 3,
      name: 'Tech Components Inc', 
      delivery: '93%', 
      deliveryTrend: [90, 91, 92, 92, 93, 93],
      contract: '97%', 
      contractTrend: [95, 96, 96, 96, 97, 97],
      cost: '4.6/5', 
      costTrend: [4.4, 4.5, 4.5, 4.5, 4.6, 4.6],
      risk: 'Low',
      spend: '$1.5M',
      relationship: 'Strategic Partner',
      since: '2019'
    },
  ];

  // Performance trend data for the selected supplier - unchanged
  const performanceTrendData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'On-Time Delivery',
        data: selectedSupplier ? selectedSupplier.deliveryTrend : [],
        borderColor: '#004a80',
        backgroundColor: 'rgba(0, 74, 128, 0.1)',
        tension: 0.3,
        fill: true
      },
      {
        label: 'Contract Adherence',
        data: selectedSupplier ? selectedSupplier.contractTrend : [],
        borderColor: '#3a7ca5',
        backgroundColor: 'rgba(58, 124, 165, 0.1)',
        tension: 0.3,
        fill: true
      },
      {
        label: 'Cost Competitiveness',
        data: selectedSupplier ? selectedSupplier.costTrend.map(x => x * 20) : [], // Scale to 100 for chart
        borderColor: '#7fb2d0',
        backgroundColor: 'rgba(127, 178, 208, 0.1)',
        tension: 0.3,
        fill: true,
        yAxisID: 'y1'
      }
    ]
  };

  // Supplier comparison radar chart data - unchanged
  const comparisonData = {
    labels: ['Delivery', 'Contract', 'Cost', 'Risk', 'Spend'],
    datasets: suppliers.map((supplier, idx) => ({
      label: supplier.name,
      data: [
        parseFloat(supplier.delivery),
        parseFloat(supplier.contract),
        parseFloat(supplier.cost) * 20, // Scale to 100
        supplier.risk === 'Low' ? 90 : supplier.risk === 'Medium' ? 60 : 30,
        parseFloat(supplier.spend.replace(/[^0-9.]/g, '')) / 20 // Scale down for chart
      ],
      backgroundColor: `rgba(${idx === 0 ? '0, 74, 128' : idx === 1 ? '58, 124, 165' : '127, 178, 208'}, 0.2)`,
      borderColor: idx === 0 ? '#004a80' : idx === 1 ? '#3a7ca5' : '#7fb2d0',
      borderWidth: 2
    }))
  };

  // Spend distribution pie chart - unchanged
  const spendDistributionData = {
    labels: suppliers.map(s => s.name),
    datasets: [{
      data: suppliers.map(s => parseFloat(s.spend.replace(/[^0-9.]/g, ''))),
      backgroundColor: ['#004a80', '#3a7ca5', '#7fb2d0'],
      borderWidth: 0
    }]
  };

  return (
    <div className="min-h-screen bg-blue-50 p-4">
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
                    <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Supplier Performance Scorecard</span>
                  </div>
                </li>
              </ol>
            </nav>
      {/* Header */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm mb-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-white">Supplier Performance Scorecard</h1>
            <p className="text-sky-100 text-x mt-1">Track and analyze supplier performance metrics.</p>
          </div>
          <div className="flex space-x-3">
            <div className="p-2 bg-sky-900 rounded-lg border border-sky-700 hover:bg-white group transition-colors duration-200">
              <label className="block text-x font-medium text-blue-100 group-hover:text-sky-900 mb-0.5">Time Period</label>
              <select 
                className="p-1 text-x w-full rounded-md border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-blue-50 text-blue-800 group-hover:bg-gray-50"
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value)}
              >
                <option>Last Quarter</option>
                <option>Year to Date</option>
                <option>Custom Range</option>
              </select>
            </div>
            
            <div className="p-2 bg-sky-900 rounded-lg border border-sky-700 hover:bg-white group transition-colors duration-200">
              <label className="block text-x font-medium text-blue-100 group-hover:text-sky-900 mb-0.5">Business Unit</label>
              <select 
                className="p-1 text-x w-full rounded-md border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-blue-50 text-blue-800 group-hover:bg-gray-50"
                value={businessUnit}
                onChange={(e) => setBusinessUnit(e.target.value)}
              >
                <option>All Units</option>
                <option>North America</option>
                <option>Europe</option>
                <option>Asia-Pacific</option>
              </select>
            </div>
            <Link to="/SupplyChainTable">
                            <button type="button" className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200">
                              View More <GrLinkNext className="ml-1 w-10 h-10 hover:w-5 hover:h-5 transition-all" />
                            </button>
                          </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div> {/* This div now acts as a simple container for rows */}
        
        {/* Row 1: Supplier Table and Trend Chart */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-4"> {/* Added mb-4 for spacing */}
          <h2 className="text-lg font-semibold text-blue-800 mb-3">Supplier Performance Metrics</h2>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-blue-100">
              <thead className="bg-blue-50">
                <tr>
                  <th className="px-4 py-2 text-left text-x font-medium text-blue-700 uppercase tracking-wider">Supplier</th>
                  <th className="px-4 py-2 text-left text-x font-medium text-blue-700 uppercase tracking-wider">On-Time Delivery</th>
                  <th className="px-4 py-2 text-left text-x font-medium text-blue-700 uppercase tracking-wider">Contract Adherence</th>
                  <th className="px-4 py-2 text-left text-x font-medium text-blue-700 uppercase tracking-wider">Cost</th>
                  <th className="px-4 py-2 text-left text-x font-medium text-blue-700 uppercase tracking-wider">Risk</th>
                  <th className="px-4 py-2 text-left text-x font-medium text-blue-700 uppercase tracking-wider">Annual Spend</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-blue-100">
                {suppliers.map((supplier) => (
                  <tr 
                    key={supplier.id} 
                    className={`cursor-pointer ${selectedSupplier?.id === supplier.id ? 'bg-blue-50' : 'hover:bg-blue-50'}`}
                    onClick={() => setSelectedSupplier(supplier)}
                  >
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="font-medium text-s text-blue-800">{supplier.name}</div>
                      <div className="text-x text-blue-500">{supplier.relationship}</div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-x font-medium ${parseFloat(supplier.delivery) >= 95 ? 'bg-green-100 text-green-800' : parseFloat(supplier.delivery) >= 90 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                          {supplier.delivery}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                       <div className="flex items-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-x font-medium ${parseFloat(supplier.contract) >= 95 ? 'bg-green-100 text-green-800' : parseFloat(supplier.contract) >= 90 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                          {supplier.contract}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-12 h-12">
                          <Chart
                            options={{
                              chart: { sparkline: { enabled: true } },
                              colors: ['#004a80'],
                              plotOptions: {
                                radialBar: {
                                  startAngle: -90, endAngle: 90, hollow: { margin: 0, size: '65%' },
                                  dataLabels: {
                                    name: { show: false },
                                    value: { offsetY: -1, fontSize: '11px', formatter: (val) => parseFloat(val/20).toFixed(getDecimalPrecision()) }
                                  }
                                }
                              },
                            }}
                            series={[parseFloat(supplier.cost) * 20]} type="radialBar" width="100%" height="100%"
                          />
                        </div>
                        <span className="ml-1 text-s text-blue-600">{supplier.cost}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-x font-medium ${supplier.risk === 'Low' ? 'bg-green-100 text-green-800' : supplier.risk === 'Medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                        {supplier.risk}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-s font-medium text-blue-800">
                      {supplier.spend}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {selectedSupplier && (
            <div className="mt-4 border-t border-blue-100 pt-3">
              <h3 className="text-md font-medium text-blue-800 mb-2">{selectedSupplier.name} Performance Trend</h3>
              <div className="h-60">
                <Bar 
                  data={performanceTrendData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'top', labels: { boxWidth: 12, font: {size: 10} } },
                      tooltip: {
                        mode: 'index', intersect: false,
                        callbacks: {
                          label: function(context) {
                            let label = context.dataset.label || '';
                            if (label === 'Cost Competitiveness') return `${label}: ${(context.raw / 20).toFixed(getDecimalPrecision())}/5`;
                            if (label) label += ': ';
                            if (context.parsed.y !== null) label += context.parsed.y + (label.includes('Delivery') || label.includes('Contract') ? '%' : '');
                            return label;
                          }
                        }
                      }
                    },
                    scales: {
                      y: { 
                        beginAtZero: false, min: 80, max: 100, 
                        ticks: { callback: (value) => value + '%', font: {size: 10} }
                      },
                      y1: {
                        position: 'right', min: 80, max: 100, grid: { drawOnChartArea: false },
                        ticks: { callback: (value) => (value / 20).toFixed(getDecimalPrecision()), font: {size: 10} }
                      }
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Row 2: Supplier Comparison, Spend Distribution, Performance Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Supplier Comparison */}
          <div className="bg-white rounded-xl shadow-md p-4">
            <h2 className="text-lg font-semibold text-blue-800 mb-3">Supplier Comparison</h2>
            <div className="h-60">
              <Chart
                options={{
                  chart: { type: 'radar', toolbar: { show: false } },
                  colors: ['#004a80', '#3a7ca5', '#7fb2d0'],
                  xaxis: { categories: comparisonData.labels, labels: { style: { fontSize: '10px' } } },
                  yaxis: { show: false, min: 0, max: 100 },
                  legend: { show: true, fontSize: '10px', markers: { width: 8, height: 8 } },
                  tooltip: {
                    y: {
                      formatter: function(val, { seriesIndex, dataPointIndex }) { 
                        const label = comparisonData.labels[dataPointIndex];
                        if (label === 'Cost') return (val / 20).toFixed(getDecimalPrecision()) + '/5';
                        if (label === 'Risk') return val > 80 ? 'Low' : val > 50 ? 'Medium' : 'High';
                        if (label === 'Spend') return '$' + (val * 20).toFixed(getDecimalPrecision()) + 'K';
                        return val + '%';
                      }
                    }
                  },
                  plotOptions: { radar: { polygons: { strokeColors: '#e9e9e9', connectorColors: '#e9e9e9' } } }
                }}
                series={comparisonData.datasets.map(d => ({ name: d.label, data: d.data }))}
                type="radar"
                height="100%"
              />
            </div>
          </div>

          {/* Spend Distribution */}
          <div className="bg-white rounded-xl shadow-md p-4">
            <h2 className="text-lg font-semibold text-blue-800 mb-3">Spend Distribution</h2>
            <div className="h-56">
              <Pie
                data={spendDistributionData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'right', labels: { boxWidth: 12, font: {size: 10} } },
                    tooltip: {
                      callbacks: {
                        label: (context) => `${context.label}: $${context.raw.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`,
                        afterLabel: (context) => {
                          const supplier = suppliers.find(s => s.name === context.label);
                          return `Rel: ${supplier.relationship}\nSince: ${supplier.since}`;
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* Performance Summary */}
          <div className="bg-white rounded-xl shadow-md p-4">
            <h2 className="text-lg font-semibold text-blue-800 mb-3">Performance Summary</h2>
            <div className="space-y-2">
              <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-x font-medium text-blue-700">Best On-Time Delivery</p>
                <p className="text-lg font-bold text-blue-600">Acme Materials <span className="text-green-600 text-base">98%</span></p>
              </div>
              <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-x font-medium text-blue-700">Best Contract Adherence</p>
                <p className="text-lg font-bold text-blue-600">Tech Components <span className="text-green-600 text-base">97%</span></p>
              </div>
              <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-x font-medium text-blue-700">Most Cost Competitive</p>
                <p className="text-lg font-bold text-blue-600">Acme Materials <span className="text-green-600 text-base">4.8/5</span></p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ReactTooltip place="top" type="dark" effect="solid" />
    </div>
  );
};

export default SupplierPerformanceScorecard;