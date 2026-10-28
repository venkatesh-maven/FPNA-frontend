
import React, { useState, useRef, useEffect } from 'react';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import { FiDownload, FiBarChart2, FiPieChart, FiDollarSign, FiTrendingUp, FiCalendar, FiInfo, FiSend } from 'react-icons/fi';
import { BsStars } from 'react-icons/bs';
import { CSVLink } from 'react-csv';
import { ResponsivePie } from '@nivo/pie';
import * as XLSX from 'xlsx';
import { Tooltip } from 'react-tooltip';
import { motion } from 'framer-motion';
import { getDecimalPrecision } from '../../utils/formatters';

const PLDataTable = ({
  title,
  data,
  timePeriods,
  showVariance = false,
  showPercentage = false,
  showForecast = false,
  showBudget = false,
  showAICommentary = false,
}) => {
  const renderCellValue = (value) => {
    if (value === undefined || value === null) return '-';
    if (typeof value === 'number') {
      return value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: getDecimalPrecision(),
        maximumFractionDigits: getDecimalPrecision(),
      });
    }
    return value;
  };

  const getRowClass = (rowIndex, isTotal = false) => {
    if (isTotal) return 'font-bold bg-gray-100';
    return rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-800">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider w-1/4">
                Category
              </th>
              {timePeriods.map((period, idx) => (
                <th
                  key={idx}
                  className="px-0 py-3 text-right text-x font-medium text-gray-500 uppercase tracking-wider"
                >
                  {period}
                </th>
              ))}
              {showVariance && (
                <th className="px-4 py-3 text-right text-x font-medium text-gray-500 uppercase tracking-wider">
                  Variance
                </th>
              )}
              {showAICommentary && (
                <th className="px-4 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">
                  AI-driven Commentary
                </th>
              )}
              {showPercentage && (
                <th className="px-4 py-3 text-right text-x font-medium text-gray-500 uppercase tracking-wider">
                  % Achievement
                </th>
              )}
              {showForecast && (
                <>
                  <th className="px-0 py-3 text-right text-x font-medium text-gray-500 uppercase tracking-wider">
                    Forecast[1]
                  </th>
                  <th className="px-4 py-3 text-right text-x font-medium text-gray-500 uppercase tracking-wider">
                    Forecast[2]
                  </th>
                </>
              )}
              {showBudget && (
                <th className="px-4 py-3 text-right text-x font-medium text-gray-500 uppercase tracking-wider">
                  Budget
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className={getRowClass(rowIndex, row.isTotal)}>
                <td className="px-4 py-3 whitespace-nowrap text-s font-medium text-gray-900 flex items-center">
                  {row.category}
                  {row.tooltip && (
                    <>
                      <FiInfo
                        className="ml-1 text-gray-400 cursor-pointer"
                        data-tooltip-id={`tooltip-${rowIndex}`}
                        data-tooltip-content={row.tooltip}
                      />
                      <Tooltip id={`tooltip-${rowIndex}`} />
                    </>
                  )}
                </td>
                {timePeriods.map((_, colIndex) => (
                  <td
                    key={colIndex}
                    className={`px-4 py-3 whitespace-nowrap text-s text-right ${
                      row.isTotal ? 'text-blue-600 font-semibold' : 'text-gray-700'
                    }`}
                  >
                    {renderCellValue(row.values?.[colIndex])}
                  </td>
                ))}
                {showVariance && (
                  <td className="px-4 py-3 whitespace-nowrap text-s text-right">
                    <span className={row.variance >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {renderCellValue(row.variance)}
                    </span>
                  </td>
                )}
                {showAICommentary && (
                  <td className="px-4 py-3 whitespace-normal text-s text-gray-700 max-w-xs">
                    {row.aiCommentary || 'Stable performance with expected growth.'}
                  </td>
                )}
                {showPercentage && (
                  <td className="px-4 py-3 whitespace-nowrap text-s text-right">
                    <span className={row.percentage >= 100 ? 'text-green-600' : 'text-red-600'}>
                      {row.percentage !== undefined ? `${row.percentage}%` : '-'}
                    </span>
                  </td>
                )}
                {showForecast && (
                  <>
                    <td className="px-4 py-3 whitespace-nowrap text-s text-right text-purple-600">
                      {renderCellValue(row.forecast1)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-s text-right text-purple-600">
                      {renderCellValue(row.forecast2)}
                    </td>
                  </>
                )}
                {showBudget && (
                  <td className="px-4 py-3 whitespace-nowrap text-s text-right text-gray-500">
                    {renderCellValue(row.budget)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const PLDashboard = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [timeRange, setTimeRange] = useState('monthly');
  const [chartType, setChartType] = useState('bar');
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const [aiInputs, setAiInputs] = useState({});
  const [aiHistory, setAiHistory] = useState({});
  const aiChatbotRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (aiChatbotRef.current && !aiChatbotRef.current.contains(event.target)) {
        setShowAIDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSendAIQuery = (reportId) => {
    if (!aiInputs[reportId]?.trim()) return;
    const mockResponse = `Analysis for ${reportId}: The data shows consistent performance with expected seasonal variations.`;
    setAiHistory((prev) => ({
      ...prev,
      [reportId]: [...(prev[reportId] || []), { query: aiInputs[reportId], response: mockResponse }],
    }));
    setAiInputs((prev) => ({ ...prev, [reportId]: '' }));
  };

  const monthlyData = {
    revenue: [
      {
        category: 'Income from Sales',
        values: [12000, 15000, 18000, 21000, 24000, 27000, 30000, 33000, 36000, 39000, 42000, 45000],
        tooltip: 'Revenue from product/service sales',
      },
      { category: 'Other Income', values: [1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000, 3200] },
      {
        category: 'TOTAL REVENUE',
        values: [13000, 16200, 19400, 22600, 25800, 29000, 32200, 35400, 38600, 41800, 45000, 48200],
        isTotal: true,
      },
    ],
    cogs: [
      { category: 'Direct Labor Costs', values: [4000, 4500, 5000, 5500, 6000, 6500, 7000, 7500, 8000, 8500, 9000, 9500] },
      { category: 'Subcontractor Costs', values: [2000, 2200, 2400, 2600, 2800, 3000, 3200, 3400, 3600, 3800, 4000, 4200] },
      {
        category: 'TOTAL COGS',
        values: [6000, 6700, 7400, 8100, 8800, 9500, 10200, 10900, 11600, 12300, 13000, 13700],
        isTotal: true,
      },
    ],
    expenses: [
      { category: 'Salaries', values: [3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000] },
      { category: 'Marketing', values: [800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900] },
      {
        category: 'TOTAL EXPENSES',
        values: [3800, 3900, 4000, 4100, 4200, 4300, 4400, 4500, 4600, 4700, 4800, 4900],
        isTotal: true,
      },
    ],
    profit: [
      {
        category: 'GROSS PROFIT',
        values: [7000, 9500, 12000, 14500, 17000, 19500, 22000, 24500, 27000, 29500, 32000, 34500],
      },
      {
        category: 'NET INCOME',
        values: [3200, 5600, 8000, 10400, 12800, 15200, 17600, 20000, 22400, 24800, 27200, 29600],
        isTotal: true,
      },
    ],
  };

  const quarterlyData = {
    revenue: [
      { category: 'Income from Sales', values: [45000, 72000, 99000, 126000] },
      { category: 'Other Income', values: [3600, 5400, 7200, 9000] },
      { category: 'TOTAL REVENUE', values: [48600, 77400, 106200, 135000], isTotal: true },
    ],
    cogs: [
      { category: 'Direct Labor Costs', values: [13500, 21000, 28500, 36000] },
      { category: 'Subcontractor Costs', values: [6600, 10200, 13800, 17400] },
      { category: 'TOTAL COGS', values: [20100, 31200, 42300, 53400], isTotal: true },
    ],
    profit: [
      { category: 'GROSS PROFIT', values: [28500, 46200, 63900, 81600] },
      { category: 'NET INCOME', values: [16800, 29400, 42000, 54600], isTotal: true },
    ],
  };

  const comparisonData = {
    revenue: [
      {
        category: 'Income from Sales',
        values: [12000, 15000, 18000, 21000, 24000],
        variance: 3000,
        forecast1: 27000,
        forecast2: 30000,
        aiCommentary: 'Strong sales growth driven by new product launches',
      },
      {
        category: 'Other Income',
        values: [1000, 1200, 1400, 1600, 1800],
        variance: 200,
        forecast1: 2000,
        forecast2: 2200,
        aiCommentary: 'Stable growth in secondary revenue streams',
      },
      {
        category: 'TOTAL REVENUE',
        values: [13000, 16200, 19400, 22600, 25800],
        variance: 3200,
        forecast1: 29000,
        forecast2: 32200,
        isTotal: true,
        aiCommentary: 'Overall revenue trending positively',
      },
    ],
    expenses: [
      {
        category: 'Salaries',
        values: [3000, 3000, 3000, 3000, 3000],
        variance: 0,
        forecast1: 3000,
        forecast2: 3000,
        aiCommentary: 'Stable salary expenses as planned',
      },
      {
        category: 'Marketing',
        values: [800, 900, 1000, 1100, 1200],
        variance: 100,
        forecast1: 1300,
        forecast2: 1400,
        aiCommentary: 'Increased marketing spend driving sales',
      },
      {
        category: 'TOTAL EXPENSES',
        values: [3800, 3900, 4000, 4100, 4200],
        variance: 100,
        forecast1: 4300,
        forecast2: 4400,
        isTotal: true,
        aiCommentary: 'Controlled expense growth',
      },
    ],
  };

  const budgetData = {
    revenue: [
      {
        category: 'Income from Sales',
        values: [12000],
        budget: 15000,
        percentage: Math.round((12000 / 15000) * 100),
      },
      {
        category: 'Other Income',
        values: [1000],
        budget: 1200,
        percentage: Math.round((1000 / 1200) * 100),
      },
      {
        category: 'TOTAL REVENUE',
        values: [13000],
        budget: 16200,
        percentage: Math.round((13000 / 16200) * 100),
        isTotal: true,
      },
    ],
    expenses: [
      { category: 'Salaries', values: [3000], budget: 3000, percentage: 100 },
      { category: 'Marketing', values: [800], budget: 1000, percentage: 80 },
      {
        category: 'TOTAL EXPENSES',
        values: [3800],
        budget: 4000,
        percentage: 95,
        isTotal: true,
      },
    ],
  };

  const reports = [
    { id: 'monthly', title: 'Monthly P&L' },
    { id: 'quarterly', title: 'Quarterly P&L' },
    { id: 'comparison', title: 'P&L Comparison' },
    { id: 'budget', title: 'Budget vs Actual' },
  ];

  const prepareCSVData = () => {
    if (activeTab === 0) {
      return [...monthlyData.revenue, ...monthlyData.cogs, ...monthlyData.expenses, ...monthlyData.profit].map(
        (item) => ({
          Category: item.category,
          ...item.values.reduce(
            (acc, val, idx) => ({
              ...acc,
              [`Month ${idx + 1}`]: val,
            }),
            {}
          ),
        })
      );
    } else if (activeTab === 1) {
      return [...quarterlyData.revenue, ...quarterlyData.cogs, ...quarterlyData.profit].map((item) => ({
        Category: item.category,
        ...item.values.reduce(
          (acc, val, idx) => ({
            ...acc,
            [`Q${idx + 1}`]: val,
          }),
          {}
        ),
      }));
    } else if (activeTab === 2) {
      return [...comparisonData.revenue, ...comparisonData.expenses].map((item) => ({
        Category: item.category,
        Month1: item.values[0],
        Month2: item.values[1],
        Month3: item.values[2],
        Month4: item.values[3],
        Month5: item.values[4],
        Variance: item.variance,
        AICommentary: item.aiCommentary,
        Forecast1: item.forecast1,
        Forecast2: item.forecast2,
      }));
    } else {
      return [...budgetData.revenue, ...budgetData.expenses].map((item) => ({
        Category: item.category,
        Actual: item.values[0],
        Budget: item.budget,
        Percentage: item.percentage,
      }));
    }
  };

  const csvData = prepareCSVData();

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(csvData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ProfitAndLoss');
    XLSX.writeFile(workbook, `ProfitAndLoss_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const monthlyRowData = [
    ...monthlyData.revenue,
    ...monthlyData.cogs,
    ...monthlyData.expenses,
    ...monthlyData.profit,
  ].map((item) => ({
    category: item.category,
    ...item.values.reduce(
      (acc, val, idx) => ({
        ...acc,
        [`month${idx + 1}`]: val,
      }),
      {}
    ),
  }));

  const quarterlyRowData = [
    ...quarterlyData.revenue,
    ...quarterlyData.cogs,
    ...quarterlyData.profit,
  ].map((item) => ({
    category: item.category,
    q1: item.values[0],
    q2: item.values[1],
    q3: item.values[2],
    q4: item.values[3],
  }));

  const monthlyColumns = [
    { field: 'category', headerName: 'Category' },
    ...Array.from({ length: 12 }, (_, i) => ({
      field: `month${i + 1}`,
      headerName: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
    })),
  ];

  const quarterlyColumns = [
    { field: 'category', headerName: 'Category' },
    { field: 'q1', headerName: 'Q1' },
    { field: 'q2', headerName: 'Q2' },
    { field: 'q3', headerName: 'Q3' },
    { field: 'q4', headerName: 'Q4' },
  ];

  function currencyFormatter(params) {
    if (params.value === undefined || params.value === null) return '-';
    return params.value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: getDecimalPrecision(),
      maximumFractionDigits: getDecimalPrecision(),
    });
  }

  const pieChartData = [
    {
      id: 'Revenue',
      label: 'Revenue',
      value:
        monthlyData.revenue.find((item) => item.category === 'TOTAL REVENUE')?.values.reduce((a, b) => a + b, 0) ||
        0,
      color: 'hsl(120, 70%, 50%)',
    },
    {
      id: 'COGS',
      label: 'COGS',
      value: monthlyData.cogs.find((item) => item.category === 'TOTAL COGS')?.values.reduce((a, b) => a + b, 0) || 0,
      color: 'hsl(30, 70%, 50%)',
    },
    {
      id: 'Expenses',
      label: 'Expenses',
      value:
        monthlyData.expenses.find((item) => item.category === 'TOTAL EXPENSES')?.values.reduce((a, b) => a + b, 0) ||
        0,
      color: 'hsl(240, 70%, 50%)',
    },
    {
      id: 'Net Income',
      label: 'Net Income',
      value:
        monthlyData.profit.find((item) => item.category === 'NET INCOME')?.values.reduce((a, b) => a + b, 0) || 0,
      color: 'hsl(60, 70%, 50%)',
    },
  ];

  return (
    <div className="space-y-6 p-4 py-0 min-h-screen relative bg-sky-5">
      <nav class="flex" aria-label="Breadcrumb">
  <ol class="inline-flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse">
    <li class="inline-flex text-sky-900  items-center">
      <a href="/" class="inline-flex items-center text-s font-medium text-sky-900 hover:text-blue-600 dark:text-gray-400 dark:hover:text-gary-600">
        <svg class="w-3 h-3 me-2.5 text-sky-900" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
          <path d="m19.707 9.293-2-2-7-7a1 1 0 0 0-1.414 0l-7 7-2 2a1 1 0 0 0 1.414 1.414L2 10.414V18a2 2 0 0 0 2 2h3a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h3a2 2 0 0 0 2-2v-7.586l.293.293a1 1 0 0 0 1.414-1.414Z"/>
        </svg>
       <span className='text-sky-900 hover:text-blue-500'>Dashboard</span> 
      </a>
    </li>
    <li>
      <div class="flex items-center">
        <svg class="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 9 4-4-4-4"/>
        </svg>
        <a href="/financial-core-reports" class="ms-1 text-s font-medium text-sky-900 hover:text-blue-600 md:ms-2">Financial-reports</a>
      </div>
    </li>
    <li aria-current="page">
      <div class="flex items-center">
        <svg class="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 9 4-4-4-4"/>
        </svg>
        <span class="ms-1 text-s font-medium text-gray-500 md:ms-2 dark:text-gray-400">Profit & Loss</span>
      </div>
    </li>
  </ol>
</nav>


      <div className="">

 


           <div className="bg-gradient-to-r mb-5 from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
                  <div className="flex justify-between items-center">
                    <div>
                      <h1 className="text-lg font-bold text-white"> Profit  & Loss Statement</h1>
                      <p className="text-sky-100 text-x">Track and analyze your financial performance</p>
                    </div>
                    <div className="flex space-x-2">
                    <div className="relative">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="py-2 px-4 flex items-center gap-1 text-s font-medium cursor-pointer text-sky-50 bg-sky-800 rounded-lg hover:bg-sky-50 hover:text-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
              <FiCalendar className="absolute right-4  top-2.5 text-gray-400" />
            </div>
            <button
              onClick={exportToExcel}
              className="py-2 px-4  flex items-center gap-2 text-s font-medium cursor-pointer text-sky-50 bg-sky-800 rounded-lg hover:bg-sky-50 hover:text-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
              <FiDownload className="" />
              Export to Excel
            </button>
            <CSVLink
              data={csvData}
              filename={`profit-loss-${new Date().toISOString().slice(0, 10)}.csv`}
              className="py-2 px-4 flex items-center gap-1 text-s font-medium cursor-pointer text-sky-50 bg-sky-800 rounded-lg hover:bg-sky-50 hover:text-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <FiDownload className="" />
              Export to CSV
            </CSVLink>
                    </div>
                  </div>
                </div>









        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-800">Total Revenue</h3>
              <FiDollarSign className="text-blue-500 text-xl" />
            </div>
            <p className="text-2xl font-bold mt-2 text-blue-600">
              {currencyFormatter({
                value:
                  monthlyData.revenue.find((item) => item.category === 'TOTAL REVENUE')?.values.reduce((a, b) => a + b, 0) || 0,
              })}
            </p>
            <p className="text-s text-gray-500 mt-1">Year to Date</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-800">Gross Profit</h3>
              <FiTrendingUp className="text-green-500 text-xl" />
            </div>
            <p className="text-2xl font-bold mt-2 text-green-600">
              {currencyFormatter({
                value:
                  monthlyData.profit.find((item) => item.category === 'GROSS PROFIT')?.values.reduce((a, b) => a + b, 0) || 0,
              })}
            </p>
            <p className="text-s text-gray-500 mt-1">Year to Date</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-800">Net Income</h3>
              <FiBarChart2 className="text-purple-500 text-xl" />
            </div>
            <p className="text-2xl font-bold mt-2 text-purple-600">
              {currencyFormatter({
                value:
                  monthlyData.profit.find((item) => item.category === 'NET INCOME')?.values.reduce((a, b) => a + b, 0) || 0,
              })}
            </p>
            <p className="text-s text-gray-500 mt-1">Year to Date</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border h-[540px] border-gray-200 mb-">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-800">Financial Overview</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setChartType('bar')}
                className={`p-2 rounded-md ${chartType === 'bar' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                <FiBarChart2 />
              </button>
              <button
                onClick={() => setChartType('pie')}
                className={`p-2 rounded-md ${chartType === 'pie' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                <FiPieChart />
              </button>
            </div>
          </div>
          <div className="p-4" style={{ height: '400px' }}>
            {chartType === 'pie' ? (
              <ResponsivePie
                data={pieChartData}
                margin={{ top: 40, right: 80, bottom: 80, left: 80 }}
                innerRadius={0.5}
                padAngle={0.7}
                cornerRadius={3}
                activeOuterRadiusOffset={8}
                borderWidth={1}
                borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
                arcLinkLabelsSkipAngle={10}
                arcLinkLabelsTextColor="#333333"
                arcLinkLabelsThickness={2}
                arcLinkLabelsColor={{ from: 'color' }}
                arcLabelsSkipAngle={10}
                arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
                defs={[
                  { id: 'dots', type: 'patternDots', background: 'inherit', color: 'rgba(255, 255, 255, 0.3)', size: 4, padding: 1, stagger: true },
                  { id: 'lines', type: 'patternLines', background: 'inherit', color: 'rgba(255, 255, 255, 0.3)', rotation: -45, lineWidth: 6, spacing: 10 },
                ]}
                fill={[
                  { match: { id: 'Revenue' }, id: 'dots' },
                  { match: { id: 'COGS' }, id: 'dots' },
                  { match: { id: 'Expenses' }, id: 'lines' },
                  { match: { id: 'Net Income' }, id: 'lines' },
                ]}
                legends={[
                  {
                    anchor: 'bottom',
                    direction: 'row',
                    justify: false,
                    translateX: 0,
                    translateY: 56,
                    itemsSpacing: 0,
                    itemWidth: 100,
                    itemHeight: 18,
                    itemTextColor: '#999',
                    itemDirection: 'left-to-right',
                    itemOpacity: 1,
                    symbolSize: 18,
                    symbolShape: 'circle',
                    effects: [{ on: 'hover', style: { itemTextColor: '#000' } }],
                  },
                ]}
              />
            ) : (
            <div className="overflow-x-auto rounded-xl shadow-lg">
  <div className="overflow-x-auto rounded-lg border border-sky-200">
  <table className="min-w-full bg-white">
    <thead className="sticky top-0 bg-sky-50">
      <tr className="border-b border-sky-200">
        {(timeRange === 'monthly' ? monthlyColumns : quarterlyColumns).map((col, idx) => (
          <th
            key={idx}
            className={`px-3 py-2 text-s font-semibold text-sky-900 text-left border-r border-sky-200 ${
              idx === 0 && "sticky left-0 z-20 "
            }`}
          >
            {col.headerName}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {(timeRange === 'monthly' ? monthlyRowData : quarterlyRowData).map((row, rowIndex) => (
        <tr
          key={rowIndex}
          className={`border-b font-bold border-sky-200 hover:bg-sky-50 ${
            row.category.includes('TOTAL') ? 'bg-gray-400 text-sky-950 ' : 'bg-white'
          }`}
        >
          {(timeRange === 'monthly' ? monthlyColumns : quarterlyColumns).map((col, colIndex) => (
            <td
              key={colIndex}
              className={`px-3 py-2  text-s text-gray-900 border-r border-sky-200 ${
                colIndex === 0 ? 'sticky left-0 bg-inherit z-10' : ''
              } ${
                ['TOTAL COGS', 'TOTAL REVENUE', 'TOTAL EXPENSES'].includes(col.headerName) 
                  ? 'font-semibold text-sky-900' 
                  : 'font-normal'
              }`}
            >
              {col.field === 'category' 
                ? row[col.field] 
                : currencyFormatter({ value: row[col.field] })}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
</div>
</div>
            )}
          </div>
        </div>

        <Tabs selectedIndex={activeTab} onSelect={(index) => setActiveTab(index)}>
          <TabList className="flex border-b mt-10 border-gray-200">
            {reports.map((report) => (
              <Tab
                key={report.id}
                className="px-4 py-2 text-s font-medium cursor-pointer focus:outline-none"
                selectedClassName="text-blue-600 border-b-2 border-blue-500"
              >
                {report.title}
              </Tab>
            ))}
          </TabList>

          <TabPanel>
            <div className="space-y-6 mt-6 relative">
              <div className="flex justify-end mb-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAIDropdown('monthly');
                  }}
                  className="flex items-center px-3 py-1 text-sky-800 rounded-lg hover:bg-sky-200 text-x"
                >
                  <BsStars className="mr-1" /> Ask AI
                </button>
              </div>
              {showAIDropdown === 'monthly' && (
                <motion.div
                  ref={aiChatbotRef}
                  className="absolute top-12 right-3 bg-white/90 backdrop-blur-md rounded-lg shadow-lg border border-sky-200 p-2 z-10"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <h1 className="text-s font-semibold text-sky-900 mb-2">Ask about Monthly P&L</h1>
                  <div className="flex items-center space-x-2 mb-4">
                    <input
                      type="text"
                      value={aiInputs['monthly'] || ''}
                      onChange={(e) => setAiInputs((prev) => ({ ...prev, monthly: e.target.value }))}
                      placeholder="Ask AI about this report..."
                      className="w-64 p-2 border border-sky-300 rounded-lg bg-sky-50 text-sky-900 text-s focus:outline-none focus:ring-2 focus:ring-sky-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSendAIQuery('monthly');
                      }}
                      className="p-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                      disabled={!aiInputs['monthly']?.trim()}
                    >
                      <FiSend className="w-5 h-5" />
                    </button>
                  </div>
                  {aiHistory['monthly']?.length > 0 && (
                    <div className="space-y-2 max-h-32 overflow-y-auto text-x text-sky-700">
                      {aiHistory['monthly'].map((entry, index) => (
                        <div key={index}>
                          <strong>Q:</strong> {entry.query}
                          <br />
                          <strong>A:</strong> {entry.response}
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
              <PLDataTable
                title="Revenue"
                data={monthlyData.revenue}
                timePeriods={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']}
              />
              <PLDataTable
                title="Cost of Goods Sold"
                data={monthlyData.cogs}
                timePeriods={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']}
              />
              <PLDataTable
                title="Expenses"
                data={monthlyData.expenses}
                timePeriods={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']}
              />
              <PLDataTable
                title="Profit"
                data={monthlyData.profit}
                timePeriods={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']}
              />
            </div>
          </TabPanel>

          <TabPanel>
            <div className="space-y-6 mt-6 relative">
              <div className="flex justify-end mb-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAIDropdown('quarterly');
                  }}
                  className="flex items-center px-3 py-1 text-sky-800 rounded-lg hover:bg-sky-200 text-x"
                >
                  <BsStars className="mr-1" /> Ask AI
                </button>
              </div>
              {showAIDropdown === 'quarterly' && (
                <motion.div
                  ref={aiChatbotRef}
                  className="absolute top-12 right-3 bg-white/90 backdrop-blur-md rounded-lg shadow-lg border border-sky-200 p-2 z-10"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <h1 className="text-s font-semibold text-sky-900 mb-2">Ask about Quarterly P&L</h1>
                  <div className="flex items-center space-x-2 mb-4">
                    <input
                      type="text"
                      value={aiInputs['quarterly'] || ''}
                      onChange={(e) => setAiInputs((prev) => ({ ...prev, quarterly: e.target.value }))}
                      placeholder="Ask AI about this report..."
                      className="w-64 p-2 border border-sky-300 rounded-lg bg-sky-50 text-sky-900 text-s focus:outline-none focus:ring-2 focus:ring-sky-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSendAIQuery('quarterly');
                      }}
                      className="p-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                      disabled={!aiInputs['quarterly']?.trim()}
                    >
                      <FiSend className="w-5 h-5" />
                    </button>
                  </div>
                  {aiHistory['quarterly']?.length > 0 && (
                    <div className="space-y-2 max-h-32 overflow-y-auto text-x text-sky-700">
                      {aiHistory['quarterly'].map((entry, index) => (
                        <div key={index}>
                          <strong>Q:</strong> {entry.query}
                          <br />
                          <strong>A:</strong> {entry.response}
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
              <PLDataTable
                title="Revenue"
                data={quarterlyData.revenue}
                timePeriods={['Q1', 'Q2', 'Q3', 'Q4']}
              />
              <PLDataTable
                title="Cost of Goods Sold"
                data={quarterlyData.cogs}
                timePeriods={['Q1', 'Q2', 'Q3', 'Q4']}
              />
              <PLDataTable
                title="Profit"
                data={quarterlyData.profit}
                timePeriods={['Q1', 'Q2', 'Q3', 'Q4']}
              />
            </div>
          </TabPanel>

          <TabPanel>
            <div className="space-y-6 mt-6 relative">
              <div className="flex justify-end mb-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAIDropdown('comparison');
                  }}
                  className="flex items-center px-3 py-1 text-sky-800 rounded-lg hover:bg-sky-200 text-x"
                >
                  <BsStars className="mr-1" /> Ask AI
                </button>
              </div>
              {showAIDropdown === 'comparison' && (
                <motion.div
                  ref={aiChatbotRef}
                  className="absolute top-12 right-3 bg-white/90 backdrop-blur-md rounded-lg shadow-lg border border-sky-200 p-2 z-10"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <h1 className="text-s font-semibold text-sky-900 mb-2">Ask about P&L Comparison</h1>
                  <div className="flex items-center space-x-2 mb-4">
                    <input
                      type="text"
                      value={aiInputs['comparison'] || ''}
                      onChange={(e) => setAiInputs((prev) => ({ ...prev, comparison: e.target.value }))}
                      placeholder="Ask AI about this report..."
                      className="w-64 p-2 border border-sky-300 rounded-lg bg-sky-50 text-sky-900 text-s focus:outline-none focus:ring-2 focus:ring-sky-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSendAIQuery('comparison');
                      }}
                      className="p-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                      disabled={!aiInputs['comparison']?.trim()}
                    >
                      <FiSend className="w-5 h-5" />
                    </button>
                  </div>
                  {aiHistory['comparison']?.length > 0 && (
                    <div className="space-y-2 max-h-32 overflow-y-auto text-x text-sky-700">
                      {aiHistory['comparison'].map((entry, index) => (
                        <div key={index}>
                          <strong>Q:</strong> {entry.query}
                          <br />
                          <strong>A:</strong> {entry.response}
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
              <PLDataTable
                title="Revenue Comparison"
                data={comparisonData.revenue}
                timePeriods={['Month 1', 'Month 2', 'Month 3', 'Month 4', 'Month 5']}
                showVariance={true}
                showAICommentary={true}
                showForecast={true}
              />
              <PLDataTable
                title="Expenses Comparison"
                data={comparisonData.expenses}
                timePeriods={['Month 1', 'Month 2', 'Month 3', 'Month 4', 'Month 5']}
                showVariance={true}
                showAICommentary={true}
                showForecast={true}
              />
            </div>
          </TabPanel>

          <TabPanel>
            <div className="space-y-6 mt-6 relative">
              <div className="flex justify-end mb-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAIDropdown('budget');
                  }}
                  className="flex items-center px-3 py-1 text-sky-800 rounded-lg hover:bg-sky-200 text-x"
                >
                  <BsStars className="mr-1" /> Ask AI
                </button>
              </div>
              {showAIDropdown === 'budget' && (
                <motion.div
                  ref={aiChatbotRef}
                  className="absolute top-12 right-3 bg-white/90 backdrop-blur-md rounded-lg shadow-lg border border-sky-200 p-2 z-10"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <h1 className="text-s font-semibold text-sky-900 mb-2">Ask about Budget vs Actual</h1>
                  <div className="flex items-center space-x-2 mb-4">
                    <input
                      type="text"
                      value={aiInputs['budget'] || ''}
                      onChange={(e) => setAiInputs((prev) => ({ ...prev, budget: e.target.value }))}
                      placeholder="Ask AI about this report..."
                      className="w-64 p-2 border border-sky-300 rounded-lg bg-sky-50 text-sky-900 text-s focus:outline-none focus:ring-2 focus:ring-sky-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSendAIQuery('budget');
                      }}
                      className="p-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                      disabled={!aiInputs['budget']?.trim()}
                    >
                      <FiSend className="w-5 h-5" />
                    </button>
                  </div>
                  {aiHistory['budget']?.length > 0 && (
                    <div className="space-y-2 max-h-32 overflow-y-auto text-x text-sky-700">
                      {aiHistory['budget'].map((entry, index) => (
                        <div key={index}>
                          <strong>Q:</strong> {entry.query}
                          <br />
                          <strong>A:</strong> {entry.response}
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
              <PLDataTable
                title="Revenue Budget vs Actual"
                data={budgetData.revenue}
                timePeriods={['Actual']}
                showBudget={true}
                showPercentage={true}
              />
              <PLDataTable
                title="Expenses Budget vs Actual"
                data={budgetData.expenses}
                timePeriods={['Actual']}
                showBudget={true}
                showPercentage={true}
              />
            </div>
          </TabPanel>
        </Tabs>
      </div>
    </div>
  );
};

export default PLDashboard;
