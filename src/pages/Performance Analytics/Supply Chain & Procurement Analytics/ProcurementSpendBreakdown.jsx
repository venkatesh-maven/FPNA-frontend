
import React, { useState, useEffect } from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { FiInfo, FiDownload, FiChevronRight } from 'react-icons/fi';
import { Link, useNavigate } from "react-router-dom";
import { GrLinkNext } from "react-icons/gr";
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import ReactApexChart from 'react-apexcharts';
import { getDecimalPrecision } from '../../../utils/formatters';

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend);

const ProcurementSpendBreakdown = () => {
  const [spendData, setSpendData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('quarterly');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [vendorFilter, setVendorFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Sample vendors and categories for filters
  const vendors = ['All Vendors', 'Tech Solutions Inc.', 'OfficeWorld', 'Global Logistics', 'SupplyChain Pros'];
  const categories = ['All Categories', 'IT Equipment', 'Office Supplies', 'Facilities', 'Professional Services', 'Travel'];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = generateSampleData();
        setSpendData(data);
        setLoading(false);
      } catch (error) {
        toast.error('Failed to load procurement data');
        setLoading(false);
      }
    };

    fetchData();
  }, [timeRange, filterYear, vendorFilter, categoryFilter]);

  const generateSampleData = () => {
    const baseData = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const vendors = ['Tech Solutions Inc.', 'OfficeWorld', 'Global Logistics', 'SupplyChain Pros'];
    const categories = ['IT Equipment', 'Office Supplies', 'Facilities', 'Professional Services', 'Travel'];

    for (let i = 0; i < 50; i++) {
      const vendor = vendors[Math.floor(Math.random() * vendors.length)];
      const category = categories[Math.floor(Math.random() * categories.length)];
      const month = months[Math.floor(Math.random() * months.length)];
      const budget = Math.floor(Math.random() * 50000) + 10000;
      const actual = budget * (0.8 + Math.random() * 0.4);
      const variance = actual - budget;
      const variancePct = ((variance / budget) * 100).toFixed(getDecimalPrecision());

      baseData.push({
        id: i + 1,
        vendor,
        category,
        month,
        year: filterYear,
        budget: budget.toFixed(getDecimalPrecision()),
        actual: actual.toFixed(getDecimalPrecision()),
        variance: variance.toFixed(getDecimalPrecision()),
        variancePct,
        status: variancePct > 5 ? 'Over' : variancePct < -5 ? 'Under' : 'On Target',
      });
    }

    return baseData.filter(item => (
      (vendorFilter === 'all' || item.vendor === vendorFilter) &&
      (categoryFilter === 'all' || item.category === categoryFilter)
    ));
  };

  // Column definitions for the table
  const columnDefs = [
    { field: 'vendor', headerName: 'Vendor' },
    { field: 'category', headerName: 'Category' },
    { field: 'month', headerName: 'Month' },
    { field: 'year', headerName: 'Year' },
    { field: 'budget', headerName: 'Budget ($)' },
    { field: 'actual', headerName: 'Actual ($)' },
    { field: 'variance', headerName: 'Variance ($)' },
    { field: 'variancePct', headerName: 'Variance (%)' },
    { field: 'status', headerName: 'Status' },
  ];

  // Pie chart data for spend by category
  const spendByCategoryData = {
    labels: Array.from(new Set(spendData.map(item => item.category))),
    datasets: [
      {
        data: Array.from(new Set(spendData.map(item => item.category))).map(category => 
          spendData.filter(item => item.category === category).reduce((sum, item) => sum + parseFloat(item.actual), 0)
        ),
        backgroundColor: ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'],
        borderWidth: 1,
      },
    ],
  };

  // Pie chart data for spend by vendor
  const spendByVendorData = {
    labels: Array.from(new Set(spendData.map(item => item.vendor))),
    datasets: [
      {
        data: Array.from(new Set(spendData.map(item => item.vendor))).map(vendor => 
          spendData.filter(item => item.vendor === vendor).reduce((sum, item) => sum + parseFloat(item.actual), 0)
        ),
        backgroundColor: ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6'],
        borderWidth: 1,
      },
    ],
  };

  // ApexCharts configuration for variance trend
  const varianceTrendOptions = {
    series: [{
      name: 'Variance (%)',
      data: spendData.slice(0, 12).map(item => parseFloat(item.variancePct))
    }],
    chart: {
      height: 350,
      type: 'line',
      zoom: { enabled: false }
    },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth' },
    title: { text: 'Monthly Spend Variance Trend', align: 'left' },
    grid: { row: { colors: ['#f3f3f3', 'transparent'], opacity: 0.5 } },
    xaxis: { categories: spendData.slice(0, 12).map(item => item.month) },
    yaxis: { title: { text: 'Variance (%)' }, min: -20, max: 20 },
    markers: {
      size: 5,
      colors: ['#3b82f6'],
      strokeColors: '#fff',
      strokeWidth: 2,
      hover: { size: 7 }
    },
    tooltip: { y: { formatter: val => `${val}%` } }
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(spendData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ProcurementSpend');
    XLSX.writeFile(wb, 'Procurement_Spend_Breakdown.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('Procurement Spend Breakdown', 14, 15);
    doc.autoTable({
      head: [columnDefs.map(col => col.headerName)],
      body: spendData.map(item => [
        item.vendor,
        item.category,
        item.month,
        item.year,
        `$${Number(item.budget).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`,
        `$${Number(item.actual).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`,
        `$${Number(item.variance).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`,
        `${item.variancePct}%`,
        item.status,
      ]),
    });
    doc.save('Procurement_Spend_Breakdown.pdf');
  };

  return (
		<div className="space-y-6 p- min-h-screen relative bg-sky-50">
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
                          <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Procurement Spend Breakdown</span>
                        </div>
                      </li>
                    </ol>
                  </nav>
      <div className="max-w-7xl mx-auto">
			<div className="flex justify-between items-center mb-5 bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
          <h1 className="text-2xl font-bold text-white">Procurement Spend Breakdown</h1>
          <div className="flex space-x-4">
            <button
              onClick={exportToExcel}
              className="bg-sky-800 text-white px-3 py-1 rounded-md text-s hover:bg-green-700 flex items-center"
            >
              <FiDownload className="mr-1" /> Excel
            </button>
            <button
              onClick={exportToPDF}
              className="bg-sky-800 text-white px-3 py-1 rounded-md text-s hover:bg-red-700 flex items-center"
            >
              <FiDownload className="mr-1" /> PDF
            </button>
            <Link to="/SupplyChainTable">
                                                  <button type="button" className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200">
                                                    View More <GrLinkNext className="ml-1 w-4 h-4 hover:w-5 hover:h-5 transition-all" />
                                                  </button>
                                                </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Time Range</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-s"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Year</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-s"
                value={filterYear}
                onChange={(e) => setFilterYear(parseInt(e.target.value))}
              >
                {[2023, 2022, 2021].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Vendor</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-s"
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
              >
                <option value="all">All Vendors</option>
                {vendors.filter(v => v !== 'All Vendors').map(vendor => (
                  <option key={vendor} value={vendor}>{vendor}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Category</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-s"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">All Categories</option>
                {categories.filter(c => c !== 'All Categories').map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center mb-4">
                  <h2 className="text-lg font-semibold">Spend by Category</h2>
                  <FiInfo
                    data-tooltip-id="category-tooltip"
                    className="ml-2 text-gray-500 cursor-pointer"
                  />
                  <ReactTooltip id="category-tooltip" place="right">
                    Breakdown of total procurement spend by category. Helps identify which categories
                    consume the largest portion of your budget.
                  </ReactTooltip>
                </div>
                <div className="h-64">
                  <Pie
                    data={spendByCategoryData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'right' },
                        tooltip: {
                          callbacks: {
                            label: function(context) {
                              const label = context.label || '';
                              const value = context.raw || 0;
                              const total = context.dataset.data.reduce((a, b) => a + b, 0);
                              const percentage = Math.round((value / total) * 100);
                              return `${label}: $${value.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} (${percentage}%)`;
                            }
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center mb-4">
                  <h2 className="text-lg font-semibold">Spend by Vendor</h2>
                  <FiInfo
                    data-tooltip-id="vendor-tooltip"
                    className="ml-2 text-gray-500 cursor-pointer"
                  />
                  <ReactTooltip id="vendor-tooltip" place="right">
                    Distribution of procurement spend across vendors. Helps identify which vendors
                    receive the majority of your business and potential consolidation opportunities.
                  </ReactTooltip>
                </div>
                <div className="h-64">
                  <Pie
                    data={spendByVendorData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'right' },
                        tooltip: {
                          callbacks: {
                            label: function(context) {
                              const label = context.label || '';
                              const value = context.raw || 0;
                              const total = context.dataset.data.reduce((a, b) => a + b, 0);
                              const percentage = Math.round((value / total) * 100);
                              return `${label}: $${value.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} (${percentage}%)`;
                            }
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>

                 <div className="bg-white p-4 rounded-lg shadow mb-6">
              <div className="flex items-center mb-4">
                <h2 className="text-lg font-semibold">Spend Variance Analysis</h2>
                <FiInfo
                  data-tooltip-id="variance-tooltip"
                  className="ml-2 text-gray-500 cursor-pointer"
                />
                <ReactTooltip id="variance-tooltip" place="right">
                  Tracks the percentage difference between budgeted and actual spend over time.
                  Positive values indicate overspending, negative values indicate savings.
                </ReactTooltip>
              </div>
              <div className="h-64">
                <ReactApexChart 
                  options={varianceTrendOptions} 
                  series={varianceTrendOptions.series} 
                  type="line" 
                  height="100%" 
                />
              </div>
            </div>
            </div>

         

            <div className="bg-white p-4 rounded-lg shadow mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Detailed Spend Transactions</h2>
                <span className="text-s text-gray-500">{spendData.length} records</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-blue-50">
                    <tr>
                      {columnDefs.map(col => (
                        <th
                          key={col.field}
                          className="px-6 py-3 text-left text-x font-medium text-gray-700 uppercase tracking-wider"
                        >
                          {col.headerName}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y overflow-y-scroll h-[50%] divide-gray-200">
                    {spendData.map((item, index) => (
                      <tr key={item.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-900">{item.vendor}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-900">{item.category}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-900">{item.month}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-900">{item.year}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-900">${Number(item.budget).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-900">${Number(item.actual).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-900">${Number(item.variance).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-900" style={{ color: item.variancePct > 5 ? '#ef4444' : item.variancePct < -5 ? '#3b82f6' : '#22c55e' }}>
                          {item.variancePct}%
                        </td>
                        <td className={`px-6 whitespace-nowrap text-s font-medium rounded- ${item.status === 'Over' ? 'bg-red-100 text-red-800' : item.status === 'Under' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                          {item.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white p-4 rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-4">Top Cost Variances</h2>
                <div className="space-y-4">
                  {spendData
                    .sort((a, b) => Math.abs(parseFloat(b.variancePct)) - Math.abs(parseFloat(a.variancePct)))
                    .slice(0, 5)
                    .map((item, index) => (
                      <div key={index} className="border-b pb-2 last:border-b-0">
                        <div className="flex justify-between">
                          <span className="font-medium">{item.vendor}</span>
                          <span className={`font-medium ${item.variancePct > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {item.variancePct}%
                          </span>
                        </div>
                        <div className="flex justify-between text-s text-gray-600">
                          <span>{item.category}</span>
                          <span>${Math.abs(parseFloat(item.variance)).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-4">Cost Savings Opportunities</h2>
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    <span className="font-medium">Vendor Consolidation:</span> 35% of office supplies spend is distributed across 3 vendors. Potential 12% savings through consolidation.
                  </li>
                  <li>
                    <span className="font-medium">Contract Renegotiation:</span> Tech Solutions Inc. shows consistent 8-12% overspend. Opportunity to renegotiate terms.
                  </li>
                  <li>
                    <span className="font-medium">Budget Adjustment:</span> Travel category consistently under-spends by 15%. Consider reallocating budget.
                  </li>
                  <li>
                    <span className="font-medium">Process Improvement:</span> Facilities category has high variance (-18% to +22%). Implement better forecasting.
                  </li>
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProcurementSpendBreakdown;
