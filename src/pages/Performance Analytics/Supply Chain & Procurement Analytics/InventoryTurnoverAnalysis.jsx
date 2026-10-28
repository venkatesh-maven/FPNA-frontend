
import React, { useState, useEffect } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS } from 'chart.js/auto';
import { Tooltip } from 'react-tooltip';
import { Link, useNavigate } from "react-router-dom";
import { FiInfo, FiChevronRight } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { GrLinkNext } from "react-icons/gr";
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { getDecimalPrecision } from '../../../utils/formatters';

const InventoryTurnoverAnalysis = () => {
  const [inventoryData, setInventoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('monthly');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = generateSampleData();
        setInventoryData(data);
        setLoading(false);
      } catch (error) {
        toast.error('Failed to load inventory data');
        setLoading(false);
      }
    };

    fetchData();
  }, [timeRange]);

  const generateSampleData = () => {
    const categories = ['Electronics', 'Apparel', 'Home Goods', 'Office Supplies', 'Food Items'];
    return categories.map(category => ({
      category,
      stockLevel: Math.floor(Math.random() * 1000),
      carryingCost: Math.floor(Math.random() * 5000),
      turnoverRate: (Math.random() * 10).toFixed(getDecimalPrecision()),
      reorderEfficiency: (Math.random() * 100).toFixed(getDecimalPrecision()),
      lastReorderDate: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000).toLocaleDateString(),
    }));
  };

  // Column definitions for the table
  const columnDefs = [
    { field: 'category', headerName: 'Category' },
    { field: 'stockLevel', headerName: 'Stock Level' },
    { field: 'carryingCost', headerName: 'Carrying Cost ($)' },
    { field: 'turnoverRate', headerName: 'Turnover Rate' },
    { field: 'reorderEfficiency', headerName: 'Reorder Efficiency (%)' },
    { field: 'lastReorderDate', headerName: 'Last Reorder Date' },
  ];

  // Chart data for turnover rate
  const turnoverChartData = {
    labels: inventoryData.map(item => item.category),
    datasets: [
      {
        label: 'Inventory Turnover Rate',
        data: inventoryData.map(item => parseFloat(item.turnoverRate)),
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  };

  // Chart data for stock levels vs carrying costs
  const stockVsCostData = {
    labels: inventoryData.map(item => item.category),
    datasets: [
      {
        label: 'Stock Levels',
        data: inventoryData.map(item => item.stockLevel),
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1,
        yAxisID: 'y',
      },
      {
        label: 'Carrying Costs ($)',
        data: inventoryData.map(item => item.carryingCost),
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
        yAxisID: 'y1',
      },
    ],
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(inventoryData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'InventoryTurnover');
    XLSX.writeFile(wb, 'Inventory_Turnover_Analysis.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('Inventory Turnover Analysis', 14, 15);
    doc.autoTable({
      head: [columnDefs.map(col => col.headerName)],
      body: inventoryData.map(item => [
        item.category,
        item.stockLevel,
        `$${item.carryingCost.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`,
        item.turnoverRate,
        `${item.reorderEfficiency}%`,
        item.lastReorderDate,
      ]),
    });
    doc.save('Inventory_Turnover_Analysis.pdf');
  };

  return (
		<div className="space-y-6 p-4 min-h-screen relative bg-sky-50">
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
                          <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Inventory Turnover Analysis</span>
                        </div>
                      </li>
                    </ol>
                  </nav>
      <div className="max-w-7xl mx-auto">
       




      <div className="bg-gradient-to-r mb-5 from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Inventory Turnover Analysis</h1>
            {/* <p className="text-sky-100 text-x">Optimize vendor performance and cost efficiency across your supply chain</p> */}
          </div>
          <div className="flex space-x-2">
            {/* <div className="flex justify-between items-center  px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200">
              <label className="block w-full text-s font-medium text-blue-50">Time Period</label>
              <select className="mt-1 p-2 outline-0 block w-full rounded-md border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-blue-50 text-blue-800">
                <option>Last Quarter</option>
                <option>Year to Date</option>
                <option>Custom Range</option>
              </select>
            </div> */}
             <button
              onClick={exportToExcel}
            className="w-full  px-6 py-2 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200">
      Export Excel
      
            </button>

              <button
              onClick={exportToPDF}
            className="w-full  px-6 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200">
            
              Export PDF
            </button>
            
              {/* <label className="block w-full text-s font-medium text-blue-50">Business Unit</label> */}
              <select
            className="w-full  px-6 text-x font-medium outline-0 text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200">
                <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
              </select>
          </div>
          <Link to="/SupplyChainTable">
                                      <button type="button" className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200">
                                        View More <GrLinkNext className="ml-1 w-4 h-4 hover:w-5 hover:h-5 transition-all" />
                                      </button>
                                    </Link>
        </div>
      </div>




        {loading ? (
          <div className="flex  justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center mb-4">
                  <h2 className="text-lg font-semibold">Turnover Rate by Category</h2>
                  <FiInfo
                    data-tooltip-id="turnover-tooltip"
                    className="ml-2 text-gray-500 cursor-pointer"
                  />
                  <Tooltip id="turnover-tooltip" place="right">
                    Inventory turnover rate measures how often inventory is sold and replaced over a period.
                    Higher rates indicate more efficient inventory management.
                  </Tooltip>
                </div>
                <div className="h-64">
                  <Bar
                    data={turnoverChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: {
                          beginAtZero: true,
                          title: {
                            display: true,
                            text: 'Turnover Rate',
                          },
                        },
                      },
                    }}
                  />
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center mb-4">
                  <h2 className="text-lg font-semibold">Stock Levels vs Carrying Costs</h2>
                  <FiInfo
                    data-tooltip-id="stock-tooltip"
                    className="ml-2 text-gray-500 cursor-pointer"
                  />
                  <Tooltip id="stock-tooltip" place="right">
                    Carrying costs include storage, insurance, and opportunity costs. This chart helps identify
                    categories where high stock levels may be leading to excessive carrying costs.
                  </Tooltip>
                </div>
                <div className="h-64">
                  <Bar
                    data={stockVsCostData}
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
                            text: 'Stock Levels',
                          },
                        },
                        y1: {
                          type: 'linear',
                          display: true,
                          position: 'right',
                          title: {
                            display: true,
                            text: 'Carrying Costs ($)',
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
                        <div className="bg-white p-4 rounded-lg shadow mb-6">
              <div className="flex items-center mb-4">
                <h2 className="text-lg font-semibold">Reorder Efficiency Trend</h2>
                <FiInfo
                  data-tooltip-id="reorder-tooltip"
                  className="ml-2 text-gray-500 cursor-pointer"
                />
                <Tooltip id="reorder-tooltip" place="right">
                  Reorder efficiency measures how well inventory is replenished to avoid stockouts while minimizing
                  excess inventory. Higher percentages indicate better performance.
                </Tooltip>
              </div>
              <div className="h-64">
                <Line
                  data={{
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                    datasets: [
                      {
                        label: 'Reorder Efficiency (%)',
                        data: [85, 78, 92, 88, 95, 90],
                        fill: false,
                        backgroundColor: 'rgba(153, 102, 255, 0.5)',
                        borderColor: 'rgba(153, 102, 255, 1)',
                        tension: 0.1,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        beginAtZero: false,
                        min: 70,
                        max: 100,
                        title: {
                          display: true,
                          text: 'Efficiency (%)',
                        },
                      },
                    },
                  }}
                />
              </div>
            </div>
            </div>

  

            <div className="bg-white p-4 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-4">Detailed Inventory Metrics</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {columnDefs.map(col => (
                        <th
                          key={col.field}
                          className="px-6 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {col.headerName}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {inventoryData.map((item, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-900">{item.category}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-900">{item.stockLevel}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-900">
                          ${item.carryingCost.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-900">{item.turnoverRate}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-900">
                          {item.reorderEfficiency}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-s text-gray-900">{item.lastReorderDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 bg-white p-4 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-4">Key Recommendations</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <span className="font-medium">Electronics:</span> High carrying costs suggest overstocking.
                  Consider reducing order quantities by 15%.
                </li>
                <li>
                  <span className="font-medium">Apparel:</span> Low/.

System: turnover rate indicates slow-moving items. Implement promotions or markdowns to clear inventory.
                </li>
                <li>
                  <span className="font-medium">Office Supplies:</span> Excellent reorder efficiency. Maintain current inventory management practices.
                </li>
                <li>
                  <span className="font-medium">Food Items:</span> Monitor expiration dates closely to minimize waste from perishable goods.
                </li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default InventoryTurnoverAnalysis;
