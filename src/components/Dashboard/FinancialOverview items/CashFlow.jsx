import React, { useState, useEffect, useMemo, useContext } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { CSVLink } from 'react-csv';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FaDownload, FaInfoCircle, FaChevronDown, FaChevronRight, FaHome } from 'react-icons/fa';
import { AuthContext } from '../../../context/AuthContext';
import { API_BASE_URL } from '../../../config/config';
import { FinancialYearContext } from '../../../context/FinancialYearContext';
import FinancialDashboardSkeleton from '../../../Skeletons/FinancialDashboardSkeleton';
import { getDecimalPrecision } from '../../../utils/formatters';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

const CashFlow = () => {
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();

      const { selectedYear, setSelectedYear, years: availableYears } = useContext(FinancialYearContext);
  
  // const [selectedYear, setSelectedYear] = useState('2023');
  const [selectedView, setSelectedView] = useState('flow');
  const [cashFlowData, setCashFlowData] = useState(null);
  // const [availableYears, setAvailableYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch cash flow data from API
  useEffect(() => {
    const fetchCashFlowData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/v1/company/financial/analytics/cash-flow/${selectedYear}`, {
          headers: {
            'accept': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch cash flow data');
        }

        const data = await response.json();
        setCashFlowData(data);
        // setAvailableYears([2023]); // Update this if API provides available years
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchCashFlowData();
  }, [selectedYear, token]);

  // Process data for display
  const processedData = useMemo(() => {
    if (!cashFlowData) return null;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthKeys = Object.keys(cashFlowData.monthly_cash_flow).sort();
    
    return {
      months,
      monthKeys,
      totalCashFlow: cashFlowData.total_cash_flow,
      yearlyInflow: cashFlowData.yearly_inflow,
      yearlyOutflow: cashFlowData.yearly_outflow,
      monthlyCashFlow: monthKeys.map(key => cashFlowData.monthly_cash_flow[key]),
      monthlyInflow: monthKeys.map(key => cashFlowData.monthly_inflow[key]),
      monthlyOutflow: monthKeys.map(key => cashFlowData.monthly_outflow[key]),
      quarterlyCashFlow: [
        cashFlowData.quarterly_cash_flow.Q1,
        cashFlowData.quarterly_cash_flow.Q2,
        cashFlowData.quarterly_cash_flow.Q3,
        cashFlowData.quarterly_cash_flow.Q4
      ],
      quarterlyInflow: [
        cashFlowData.quarterly_inflow.Q1,
        cashFlowData.quarterly_inflow.Q2,
        cashFlowData.quarterly_inflow.Q3,
        cashFlowData.quarterly_inflow.Q4
      ],
      quarterlyOutflow: [
        cashFlowData.quarterly_outflow.Q1,
        cashFlowData.quarterly_outflow.Q2,
        cashFlowData.quarterly_outflow.Q3,
        cashFlowData.quarterly_outflow.Q4
      ]
    };
  }, [cashFlowData]);

  // Calculate KPIs
  const kpiMetrics = useMemo(() => {
    if (!processedData) {
      return {
        totalCashFlow: '0',
        totalInflow: '0',
        totalOutflow: '0',
        growthRate: '0.00',
        quarterlyBreakdown: [],
      };
    }

    const monthlyFlows = selectedView === 'flow' 
      ? processedData.monthlyCashFlow 
      : (selectedView === 'inflow' ? processedData.monthlyInflow : processedData.monthlyOutflow);
      
    const growthRate = monthlyFlows.length > 1 
      ? ((monthlyFlows[monthlyFlows.length - 1] - monthlyFlows[0]) / Math.abs(monthlyFlows[0] || 1) * 100) 
      : 0;

    return {
      totalCashFlow: processedData.totalCashFlow.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }),
      totalInflow: processedData.yearlyInflow.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }),
      totalOutflow: processedData.yearlyOutflow.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }),
      growthRate: growthRate.toFixed(getDecimalPrecision()),
      quarterlyBreakdown: [
        { 
          quarter: 'Q1', 
          flow: selectedView === 'flow' ? processedData.quarterlyCashFlow[0] : 
                (selectedView === 'inflow' ? processedData.quarterlyInflow[0] : processedData.quarterlyOutflow[0]),
          inflow: processedData.quarterlyInflow[0],
          outflow: processedData.quarterlyOutflow[0]
        },
        { 
          quarter: 'Q2', 
          flow: selectedView === 'flow' ? processedData.quarterlyCashFlow[1] : 
                (selectedView === 'inflow' ? processedData.quarterlyInflow[1] : processedData.quarterlyOutflow[1]),
          inflow: processedData.quarterlyInflow[1],
          outflow: processedData.quarterlyOutflow[1]
        },
        { 
          quarter: 'Q3', 
          flow: selectedView === 'flow' ? processedData.quarterlyCashFlow[2] : 
                (selectedView === 'inflow' ? processedData.quarterlyInflow[2] : processedData.quarterlyOutflow[2]),
          inflow: processedData.quarterlyInflow[2],
          outflow: processedData.quarterlyOutflow[2]
        },
        { 
          quarter: 'Q4', 
          flow: selectedView === 'flow' ? processedData.quarterlyCashFlow[3] : 
                (selectedView === 'inflow' ? processedData.quarterlyInflow[3] : processedData.quarterlyOutflow[3]),
          inflow: processedData.quarterlyInflow[3],
          outflow: processedData.quarterlyOutflow[3]
        },
      ],
    };
  }, [processedData, selectedView]);

  // Chart data for trend view
  const getTrendChartData = () => {
    if (!processedData) return { labels: [], datasets: [] };

    const mainData = selectedView === 'flow' 
      ? processedData.monthlyCashFlow 
      : (selectedView === 'inflow' ? processedData.monthlyInflow : processedData.monthlyOutflow);

    return {
      labels: processedData.months.slice(0, processedData.monthKeys.length),
      datasets: [
        {
          label: selectedView === 'flow' ? 'Monthly Cash Flow' : 
                (selectedView === 'inflow' ? 'Monthly Inflow' : 'Monthly Outflow'),
          data: mainData,
          borderColor: selectedView === 'flow' ? '#4BC0C0' : 
                     (selectedView === 'inflow' ? '#36A2EB' : '#FF6384'),
          backgroundColor: selectedView === 'flow' ? 'rgba(75, 192, 192, 0.2)' : 
                          (selectedView === 'inflow' ? 'rgba(54, 162, 235, 0.2)' : 'rgba(255, 99, 132, 0.2)'),
          fill: true,
          tension: 0.3,
        }
      ]
    };
  };

  // Chart data for breakdown view
  const getBreakdownChartData = () => {
    if (!processedData) return { labels: [], datasets: [] };

    if (selectedView === 'flow') {
      return {
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        datasets: [
          {
            label: 'Quarterly Cash Flow',
            data: processedData.quarterlyCashFlow,
            backgroundColor: 'rgba(75, 192, 192, 0.7)',
            borderColor: '#4BC0C0',
            borderWidth: 1,
          }
        ],
      };
    } else if (selectedView === 'inflow') {
      return {
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        datasets: [
          {
            label: 'Quarterly Inflow',
            data: processedData.quarterlyInflow,
            backgroundColor: 'rgba(54, 162, 235, 0.7)',
            borderColor: '#36A2EB',
            borderWidth: 1,
          }
        ],
      };
    } else {
      return {
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        datasets: [
          {
            label: 'Quarterly Outflow',
            data: processedData.quarterlyOutflow,
            backgroundColor: 'rgba(255, 99, 132, 0.7)',
            borderColor: '#FF6384',
            borderWidth: 1,
          }
        ],
      };
    }
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: {
        display: true,
        text: selectedView === 'flow' 
          ? `Cash Flow Trend for ${selectedYear}` 
          : (selectedView === 'inflow' 
              ? `Cash Inflow Trend for ${selectedYear}` 
              : `Cash Outflow Trend for ${selectedYear}`),
        color: '#083344',
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: $${context.parsed.y.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: { 
          callback: (value) => `$${value / 1000}k`,
          color: '#075985',
        },
        title: { 
          display: true, 
          text: 'Amount ($)', 
          color: '#075985',
        },
      },
      x: {
        ticks: {
          color: '#075985',
        },
      },
    },
  };

  // CSV data
  const csvData = useMemo(() => {
    if (!processedData) return [];

    const headers = [
      'Month',
      'Cash Flow',
      'Inflow',
      'Outflow',
      'Net Flow'
    ];

    const rows = processedData.monthKeys.map((key, index) => {
      return {
        Month: processedData.months[index],
        'Cash Flow': processedData.monthlyCashFlow[index],
        'Inflow': processedData.monthlyInflow[index],
        'Outflow': processedData.monthlyOutflow[index],
        'Net Flow': processedData.monthlyInflow[index] - processedData.monthlyOutflow[index]
      };
    });

    // Add yearly summary as the last row
    rows.push({
      Month: 'Year Total',
      'Cash Flow': processedData.totalCashFlow,
      'Inflow': processedData.yearlyInflow,
      'Outflow': processedData.yearlyOutflow,
      'Net Flow': processedData.yearlyInflow - processedData.yearlyOutflow
    });

    return [headers, ...rows.map(row => Object.values(row))];
  }, [processedData]);

  // Table data for trend view
  const trendTableData = useMemo(() => {
    if (!processedData) return [];

    return processedData.monthKeys.map((key, index) => {
      const month = processedData.months[index];
      const cashFlow = processedData.monthlyCashFlow[index];
      const inflow = processedData.monthlyInflow[index];
      const outflow = processedData.monthlyOutflow[index];
      
      return {
        month,
        cashFlow,
        inflow,
        outflow,
      };
    });
  }, [processedData]);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  if (loading) {
    return <div className="text-sky-700"><FinancialDashboardSkeleton /></div>;
  }

  if (error) {
    return <div className="text-red-600">Error: {error}</div>;
  }

  if (!cashFlowData) {
    return <div className="text-sky-700">No cash flow data available</div>;
  }

  return (
    <motion.div
      className="rounded-lg"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <button
        onClick={() => navigate('/financial-overview')}
        className="flex items-center justify-between text-sky-800 mb-2"
      >
        <FaHome className="mr-2" /> Dashboard | <span className='ml-2 text-gray-400 cursor-text'> Cash Flow Analysis</span>
      </button>
      <div className="flex bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold text-sky-50">Cash Flow Analysis</h2>
        </div>
        <div className="flex space-x-4 items-center">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="rounded-md px-3 py-2 text-white bg-sky-900 outline-0"
          >
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <select
            value={selectedView}
            onChange={(e) => setSelectedView(e.target.value)}
            className="rounded-md px-3 py-2 text-white bg-sky-900 outline-0"
          >
            <option value="flow">Cash Flow</option>
            <option value="inflow">Inflow</option>
            <option value="outflow">Outflow</option>
          </select>
          <CSVLink
            data={csvData}
            filename={`cash-flow-analysis-${selectedYear}.csv`}
            className="flex items-center bg-sky-500 text-white px-4 py-2 rounded-md hover:bg-sky-600 transition"
          >
            <FaDownload className="mr-2" /> Export
          </CSVLink>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500">
          <h3 className="text-s font-semibold text-sky-700 flex items-center">
            Total Cash Flow ({selectedYear})
            <span className="ml-1 text-sky-500" title="Net cash flow for the selected year">
              <FaInfoCircle size={14} />
            </span>
          </h3>
          <p className={`text-2xl font-bold ${kpiMetrics.totalCashFlow.startsWith('-') ? 'text-red-600' : 'text-green-600'}`}>
            ${kpiMetrics.totalCashFlow}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500">
          <h3 className="text-s font-semibold text-sky-700 flex items-center">
            Total Inflow ({selectedYear})
            <span className="ml-1 text-sky-500" title="Total cash inflow for the selected year">
              <FaInfoCircle size={14} />
            </span>
          </h3>
          <p className="text-2xl font-bold text-sky-900">${kpiMetrics.totalInflow}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500">
          <h3 className="text-s font-semibold text-sky-700 flex items-center">
            Total Outflow ({selectedYear})
            <span className="ml-1 text-sky-500" title="Total cash outflow for the selected year">
              <FaInfoCircle size={14} />
            </span>
          </h3>
          <p className="text-2xl font-bold text-sky-900">${kpiMetrics.totalOutflow}</p>
        </div>
      </div>

      {/* Chart and Table Layout */}
      <div className="flex gap-2 mb-6">
        <div className="flex flex-col w-[70%] lg:flex-row gap-6">
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-sky-900 mb-3">
              Monthly Cash Flow Details
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full bg-white border border-sky-200">
                <thead>
                  <tr className="bg-sky-100">
                    <th className="py-3 px-6 border-b text-left text-base font-semibold text-sky-700 min-w-[120px] whitespace-nowrap">Month</th>
                    <th className="py-3 px-6 border-b text-right text-base font-semibold text-sky-700 min-w-[120px] whitespace-nowrap">Cash Flow ($)</th>
                    <th className="py-3 px-6 border-b text-right text-base font-semibold text-sky-700 min-w-[120px] whitespace-nowrap">Inflow ($)</th>
                    <th className="py-3 px-6 border-b text-right text-base font-semibold text-sky-700 min-w-[120px] whitespace-nowrap">Outflow ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {trendTableData.map((row, index) => (
                    <tr key={index} className="hover:bg-sky-50">
                      <td className="py-3 px-6 border-b text-base text-sky-700 min-w-[120px] whitespace-nowrap">
                        {row.month}
                      </td>
                      <td className={`py-3 px-6 border-b text-base min-w-[120px] whitespace-nowrap text-right ${row.cashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${row.cashFlow.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
                      </td>
                      <td className="py-3 px-6 border-b text-base text-sky-700 min-w-[120px] whitespace-nowrap text-right">
                        ${row.inflow.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
                      </td>
                      <td className="py-3 px-6 border-b text-base text-sky-700 min-w-[120px] whitespace-nowrap text-right">
                        ${row.outflow.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-sky-50 p-4 rounded-lg border border-sky-200">
            <div className="h-64">
              <Line data={getTrendChartData()} options={chartOptions} />
            </div>
          </div>

          <div className="bg-sky-50 p-4 rounded-lg border border-sky-200">
            <div className="h-64">
              <Bar
                data={getBreakdownChartData()}
                options={{
                  ...chartOptions,
                  plugins: {
                    ...chartOptions.plugins,
                    title: {
                      ...chartOptions.plugins.title,
                      text: selectedView === 'flow' 
                        ? `Quarterly Cash Flow (${selectedYear})` 
                        : (selectedView === 'inflow' 
                            ? `Quarterly Inflow (${selectedYear})` 
                            : `Quarterly Outflow (${selectedYear})`)
                    }
                  }
                }}
              />
            </div>
          </div>

          <div className="p-4 bg-sky-50 rounded-lg border border-sky-200">
            <h4 className="text-base font-semibold text-sky-900 mb-2 flex items-center">
              <FaInfoCircle className="mr-2 text-sky-500" />
              Cash Flow Insights
            </h4>
            

            <ul className="list-disc pl-5 text-sky-700 text-base space-y-1">
              <li>
                <strong className="text-sky-800">Cash Burn Rate:</strong>{' '}
                ${(processedData.totalOutflow / 12).toLocaleString(undefined, {minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision()})} per month
              </li>
              <li>
                <strong className="text-sky-800">Best Performing Quarter:</strong>{' '}
                {kpiMetrics.quarterlyBreakdown.reduce((max, quarter) => 
                  quarter.flow > max.flow ? quarter : max, 
                  kpiMetrics.quarterlyBreakdown[0]
                ).quarter} (${Math.max(...kpiMetrics.quarterlyBreakdown.map(q => q.flow)).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })})
              </li>
              <li>
                <strong className="text-sky-800">Trend:</strong>{' '}
                {parseFloat(kpiMetrics.growthRate) > 0 ? 'Positive' : 'Negative'} cash flow trend year-to-date
              </li>
              <li>
                <strong className="text-sky-800">Outflow/Inflow Ratio:</strong>{' '}
                {processedData.yearlyInflow > 0 
                  ? (processedData.yearlyOutflow / processedData.yearlyInflow).toFixed(getDecimalPrecision()) 
                  : 'N/A'}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default CashFlow;