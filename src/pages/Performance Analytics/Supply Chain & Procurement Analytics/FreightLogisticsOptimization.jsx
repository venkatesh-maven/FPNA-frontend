import React, { useState, useEffect } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS } from 'chart.js/auto';
import { FiInfo, FiDownload, FiFilter, FiChevronRight} from 'react-icons/fi';
import { Link, useNavigate } from "react-router-dom";
import { GrLinkNext } from "react-icons/gr";
import { Tooltip } from 'react-tooltip';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { getDecimalPrecision } from '../../../utils/formatters';

const FreightLogisticsOptimization = () => {
  const [logisticsData, setLogisticsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('monthly');
  const [carrierFilter, setCarrierFilter] = useState('all');
  const [routeFilter, setRouteFilter] = useState('all');

  useEffect(() => {
    // Simulate API fetch
    const fetchData = async () => {
      try {
        // Replace with actual API call
        const data = generateSampleData();
        setLogisticsData(data);
        setLoading(false);
      } catch (error) {
        toast.error('Failed to load logistics data');
        setLoading(false);
      }
    };

    fetchData();
  }, [timeRange, carrierFilter, routeFilter]);

  const generateSampleData = () => {
    const carriers = ['UPS', 'FedEx', 'DHL', 'Maersk', 'TNT'];
    const routes = [
      'US-West Coast to Europe',
      'US-East Coast to Asia',
      'Intra-Europe',
      'Asia to US-West Coast',
      'South America to Europe'
    ];
    const modes = ['Air', 'Ocean', 'Rail', 'Truck'];
    
    return Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      carrier: carriers[Math.floor(Math.random() * carriers.length)],
      route: routes[Math.floor(Math.random() * routes.length)],
      mode: modes[Math.floor(Math.random() * modes.length)],
      shippingCost: Math.floor(Math.random() * 10000) + 2000,
      leadTime: Math.floor(Math.random() * 20) + 3,
      reliability: (Math.random() * 20 + 80).toFixed(getDecimalPrecision()), // 80-100%
      carbonEmission: Math.floor(Math.random() * 500) + 100,
      status: ['On Time', 'Delayed', 'Early'][Math.floor(Math.random() * 3)],
      date: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000).toLocaleDateString()
    })).filter(item => 
      (carrierFilter === 'all' || item.carrier === carrierFilter) &&
      (routeFilter === 'all' || item.route === routeFilter)
    );
  };

  // Chart data for shipping costs by carrier
  const shippingCostChartData = {
    labels: Array.from(new Set(logisticsData.map(item => item.carrier))),
    datasets: [
      {
        label: 'Average Shipping Cost ($)',
        data: Array.from(new Set(logisticsData.map(item => item.carrier))).map(carrier => {
          const carrierData = logisticsData.filter(item => item.carrier === carrier);
          return carrierData.reduce((sum, item) => sum + item.shippingCost, 0) / carrierData.length;
        }),
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  };

  // Chart data for lead time by mode
  const leadTimeChartData = {
    labels: Array.from(new Set(logisticsData.map(item => item.mode))),
    datasets: [
      {
        label: 'Average Lead Time (days)',
        data: Array.from(new Set(logisticsData.map(item => item.mode))).map(mode => {
          const modeData = logisticsData.filter(item => item.mode === mode);
          return modeData.reduce((sum, item) => sum + item.leadTime, 0) / modeData.length;
        }),
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1,
      },
    ],
  };

  // Chart data for cost vs lead time
  const costVsLeadTimeData = {
    labels: logisticsData.map(item => `${item.carrier} - ${item.route}`).slice(0, 10),
    datasets: [
      {
        label: 'Shipping Cost ($)',
        data: logisticsData.map(item => item.shippingCost).slice(0, 10),
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
        yAxisID: 'y',
      },
      {
        label: 'Lead Time (days)',
        data: logisticsData.map(item => item.leadTime).slice(0, 10),
        backgroundColor: 'rgba(255, 159, 64, 0.5)',
        borderColor: 'rgba(255, 159, 64, 1)',
        borderWidth: 1,
        yAxisID: 'y1',
      },
    ],
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(logisticsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FreightLogistics');
    XLSX.writeFile(wb, 'Freight_Logistics_Optimization.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('Freight & Logistics Optimization', 14, 15);
    doc.autoTable({
      head: [['Carrier', 'Route', 'Mode', 'Cost ($)', 'Lead Time', 'Reliability', 'Status']],
      body: logisticsData.map(item => [
        item.carrier,
        item.route,
        item.mode,
        `$${item.shippingCost.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`,
        `${item.leadTime} days`,
        `${item.reliability}%`,
        item.status,
      ]),
    });
    doc.save('Freight_Logistics_Optimization.pdf');
  };

  // Function to determine row color based on status
  const getRowColor = (status) => {
    switch (status) {
      case 'Delayed': return 'bg-red-50';
      case 'Early': return 'bg-green-50';
      default: return 'bg-white';
    }
  };

  return (
    <div className=" bg-gray-50 min-h-screen">
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
          <h1 className="text-2xl font-bold text-white">Freight & Logistics Optimization</h1>
          <div className="flex space-x-4">
            <button
              onClick={exportToExcel}
              className="bg-sky-800 text-white px-5 py-2 rounded-md text-s hover:bg-green-700 flex items-center"
            >
              <FiDownload className="mr-2" /> Excel
            </button>
            <Link to="/SupplyChainTable">
                                                  <button type="button" className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200">
                                                    View More <GrLinkNext className="ml-1 w-5 h-5 hover:w-5 hover:h-5 transition-all" />
                                                  </button>
                                                </Link>
            {/* <button
              onClick={exportToPDF}
              className="bg-red-600 text-white px-3 py-1 rounded-md text-s hover:bg-red-700 flex items-center"
            >
              <FiDownload className="mr-1" /> PDF
            </button> */}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Time Range</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-s"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Carrier</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-s"
                value={carrierFilter}
                onChange={(e) => setCarrierFilter(e.target.value)}
              >
                <option value="all">All Carriers</option>
                <option value="UPS">UPS</option>
                <option value="FedEx">FedEx</option>
                <option value="DHL">DHL</option>
                <option value="Maersk">Maersk</option>
                <option value="TNT">TNT</option>
              </select>
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Route</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-s"
                value={routeFilter}
                onChange={(e) => setRouteFilter(e.target.value)}
              >
                <option value="all">All Routes</option>
                <option value="US-West Coast to Europe">US-West Coast to Europe</option>
                <option value="US-East Coast to Asia">US-East Coast to Asia</option>
                <option value="Intra-Europe">Intra-Europe</option>
                <option value="Asia to US-West Coast">Asia to US-West Coast</option>
                <option value="South America to Europe">South America to Europe</option>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center mb-4">
                  <h2 className="text-lg font-semibold">Shipping Costs by Carrier</h2>
                  <FiInfo
                    data-tooltip-id="cost-tooltip"
                    className="ml-2 text-gray-500 cursor-pointer"
                  />
                  <Tooltip id="cost-tooltip" place="right">
                    Comparison of average shipping costs across different carriers. Helps identify
                    the most cost-effective options for your shipments.
                  </Tooltip>
                </div>
                <div className="h-64">
                  <Bar
                    data={shippingCostChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: {
                          beginAtZero: true,
                          title: {
                            display: true,
                            text: 'Cost ($)',
                          },
                        },
                      },
                    }}
                  />
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center mb-4">
                  <h2 className="text-lg font-semibold">Lead Time by Transport Mode</h2>
                  <FiInfo
                    data-tooltip-id="leadtime-tooltip"
                    className="ml-2 text-gray-500 cursor-pointer"
                  />
                  <Tooltip id="leadtime-tooltip" place="right">
                    Average delivery lead times for different transportation modes. Air is fastest
                    but most expensive, while ocean is slowest but most economical.
                  </Tooltip>
                </div>
                <div className="h-64">
                  <Bar
                    data={leadTimeChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: {
                          beginAtZero: true,
                          title: {
                            display: true,
                            text: 'Days',
                          },
                        },
                      },
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow mb-6">
              <div className="flex items-center mb-4">
                <h2 className="text-lg font-semibold">Cost vs Lead Time Analysis</h2>
                <FiInfo
                  data-tooltip-id="costvstime-tooltip"
                  className="ml-2 text-gray-500 cursor-pointer"
                />
                <Tooltip id="costvstime-tooltip" place="right">
                  Trade-off between shipping costs and lead times. Helps identify optimal shipping
                  options that balance cost and delivery speed.
                </Tooltip>
              </div>
              <div className="h-64">
                <Bar
                  data={costVsLeadTimeData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                          display: true,
                          text: 'Cost ($)',
                        },
                      },
                      y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                          display: true,
                          text: 'Lead Time (days)',
                        },
                        grid: {
                          drawOnChartArea: false,
                        },
                      },
                    },
                  }}
                />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow mb-6 overflow-hidden">
              <div className="flex justify-between items-center p-4 border-b">
                <h2 className="text-lg font-semibold">Freight Performance Details</h2>
                <div className="flex items-center space-x-2">
                  <span className="text-s text-gray-500">{logisticsData.length} shipments</span>
                  <FiFilter className="text-gray-500" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Carrier</th>
                      <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Route</th>
                      <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Mode</th>
                      <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Cost ($)</th>
                      <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Lead Time</th>
                      <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Reliability</th>
                      <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logisticsData.map((item, index) => (
                      <tr key={index} className={getRowColor(item.status)}>
                        <td className="px-6 py-4 whitespace-nowrap text-s font-medium text-gray-900">{item.carrier}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-500">{item.route}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-500">{item.mode}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-900">${item.shippingCost.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-500">{item.leadTime} days</td>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-500">{item.reliability}%</td>
                        <td className="px-6 py-4 whitespace-nowrap text-s">
                          <span className={`px-2 inline-flex text-x leading-5 font-semibold rounded-full ${
                            item.status === 'Delayed' ? 'bg-red-100 text-red-800' :
                            item.status === 'Early' ? 'bg-green-100 text-green-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-500">{item.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-4 rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-4">Optimization Recommendations</h2>
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    <span className="font-medium">Route Optimization:</span> Consolidate Asia-US shipments to reduce costs by 18%.
                  </li>
                  <li>
                    <span className="font-medium">Mode Shift:</span> Convert 30% of air freight to ocean for non-urgent shipments, saving ~$45k/month.
                  </li>
                  <li>
                    <span className="font-medium">Carrier Negotiation:</span> DHL offers 12% discount for volume commitments on European routes.
                  </li>
                  <li>
                    <span className="font-medium">Reliability Improvement:</span> FedEx has 98% on-time rate for intra-US shipments vs UPS at 92%.
                  </li>
                </ul>
              </div>

              <div className="bg-white p-4 rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-4">Key Performance Metrics</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-s text-gray-600">Avg Shipping Cost</p>
                    <p className="text-xl font-bold">
                      ${(logisticsData.reduce((sum, item) => sum + item.shippingCost, 0) / logisticsData.length).toFixed(getDecimalPrecision())}
                    </p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-s text-gray-600">Avg Lead Time</p>
                    <p className="text-xl font-bold">
                      {(logisticsData.reduce((sum, item) => sum + item.leadTime, 0) / logisticsData.length).toFixed(getDecimalPrecision())} days
                    </p>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <p className="text-s text-gray-600">On-Time Rate</p>
                    <p className="text-xl font-bold">
                      {(
                        (logisticsData.filter(item => item.status === 'On Time').length / logisticsData.length) * 100
                      ).toFixed(getDecimalPrecision())}%
                    </p>
                  </div>
                  <div className="bg-yellow-50 p-3 rounded-lg">
                    <p className="text-s text-gray-600">Cost Savings Potential</p>
                    <p className="text-xl font-bold">12-18%</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FreightLogisticsOptimization;