import React, { useState, useEffect, useMemo, useContext } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { CSVLink } from 'react-csv';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FaDownload, FaInfoCircle, FaChevronDown, FaChevronRight, FaHome, FaChartLine, FaTrophy } from 'react-icons/fa';
import { AuthContext } from '../../../context/AuthContext';
import { API_BASE_URL } from '../../../config/config';
import { FaArrowTrendUp } from 'react-icons/fa6';
import { FinancialYearContext } from '../../../context/FinancialYearContext';
import FinancialDashboardSkeleton from '../../../Skeletons/FinancialDashboardSkeleton';
import { getDecimalPrecision } from '../../../utils/formatters';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

const ProfitAnalysis = () => {
  const { token } = useContext(AuthContext);
    const { selectedYear, setSelectedYear, years: availableYears } = useContext(FinancialYearContext);

    console.log("ProfitAnalysis - Selected Year:", selectedYear);
  
  const navigate = useNavigate();
  // const [selectedYear, setSelectedYear] = useState('2023');
  const [selectedView, setSelectedView] = useState('gross');
  const [expandedRows, setExpandedRows] = useState([]);
  const [profitData, setProfitData] = useState(null);
  // const [availableYears, setAvailableYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  

  useEffect(() => {
      if (!selectedYear) return;  

    const fetchProfitData = async () => {
      try {
        setLoading(true);
        const response = await fetch(
`${API_BASE_URL}/api/v1/company/financial/analytics/profit-analysis/${selectedYear}`,           {
          headers: {
            'accept': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch profit data');
        }

        const data = await response.json();
        setProfitData(data);
        console.log("Profit Data:", data);
        // setAvailableYears([2023]); // Update this if API provides available years
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchProfitData();
  }, [selectedYear, token]);

  // Process data for display
  const processedData = useMemo(() => {
    if (!profitData) return null;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthKeys = Object.keys(profitData.monthly_gross_profit).sort();
    
    return {
      months,
      monthKeys,
      yearlySummary: profitData.yearly_summary,
      monthlyGrossProfit: monthKeys.map(key => profitData.monthly_gross_profit[key]),
      monthlyNetProfit: monthKeys.map(key => profitData.monthly_net_profit[key]),
      quarterlyGrossProfit: [
        profitData.quarterly_gross_profit.Q1,
        profitData.quarterly_gross_profit.Q2,
        profitData.quarterly_gross_profit.Q3,
        profitData.quarterly_gross_profit.Q4
      ],
      quarterlyNetProfit: [
        profitData.quarterly_net_profit.Q1,
        profitData.quarterly_net_profit.Q2,
        profitData.quarterly_net_profit.Q3,
        profitData.quarterly_net_profit.Q4
      ]
    };
  }, [profitData]);

  // Calculate KPIs
  const kpiMetrics = useMemo(() => {
    if (!processedData) {
      return {
        grossProfit: '0',
        netProfit: '0',
        revenue: '0',
        cogs: '0',
        expenses: '0',
        growthRate: '0.00',
        quarterlyBreakdown: [],
      };
    }

    const monthlyProfits = selectedView === 'gross' 
      ? processedData.monthlyGrossProfit 
      : processedData.monthlyNetProfit;
      
    const growthRate = monthlyProfits.length > 1 
      ? ((monthlyProfits[monthlyProfits.length - 1] - monthlyProfits[0]) / Math.abs(monthlyProfits[0]) * 100) 
      : 0;

    return {
      grossProfit: processedData.yearlySummary.gross_profit.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }),
      netProfit: processedData.yearlySummary.net_profit.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }),
      revenue: processedData.yearlySummary.revenue.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }),
      cogs: processedData.yearlySummary.cogs.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }),
      expenses: processedData.yearlySummary.expenses.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }),
      growthRate: growthRate.toFixed(getDecimalPrecision()),
      quarterlyBreakdown: [
        { quarter: 'Q1', value: selectedView === 'gross' ? processedData.quarterlyGrossProfit[0] : processedData.quarterlyNetProfit[0] },
        { quarter: 'Q2', value: selectedView === 'gross' ? processedData.quarterlyGrossProfit[1] : processedData.quarterlyNetProfit[1] },
        { quarter: 'Q3', value: selectedView === 'gross' ? processedData.quarterlyGrossProfit[2] : processedData.quarterlyNetProfit[2] },
        { quarter: 'Q4', value: selectedView === 'gross' ? processedData.quarterlyGrossProfit[3] : processedData.quarterlyNetProfit[3] },
      ],
    };
  }, [processedData, selectedView]);

  // Chart data for trend view
  const getTrendChartData = () => {
    if (!processedData) return { labels: [], datasets: [] };

    return {
      labels: processedData.months.slice(0, processedData.monthKeys.length),
      datasets: [
        {
          label: selectedView === 'gross' ? 'Monthly Gross Profit' : 'Monthly Net Profit',
          data: selectedView === 'gross' ? processedData.monthlyGrossProfit : processedData.monthlyNetProfit,
          borderColor: selectedView === 'gross' ? '#4BC0C0' : '#FF6384',
          backgroundColor: selectedView === 'gross' ? 'rgba(75, 192, 192, 0.2)' : 'rgba(255, 99, 132, 0.2)',
          fill: true,
          tension: 0.3,
        }
      ]
    };
  };

  // Chart data for breakdown view
  const getBreakdownChartData = () => {
    if (!processedData) return { labels: [], datasets: [] };

    return {
      labels: ['Q1', 'Q2', 'Q3', 'Q4'],
      datasets: [
        {
          label: selectedView === 'gross' ? 'Quarterly Gross Profit' : 'Quarterly Net Profit',
          data: selectedView === 'gross' ? processedData.quarterlyGrossProfit : processedData.quarterlyNetProfit,
          backgroundColor: selectedView === 'gross' ? 'rgba(75, 192, 192, 0.7)' : 'rgba(255, 99, 132, 0.7)',
          borderColor: selectedView === 'gross' ? '#4BC0C0' : '#FF6384',
          borderWidth: 1,
        }
      ],
    };
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: {
        display: true,
        text: selectedView === 'gross' 
          ? `Gross Profit Trend for ${selectedYear}` 
          : `Net Profit Trend for ${selectedYear}`,
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
      'Gross Profit',
      'Net Profit',
      'Revenue',
      'COGS',
      'Expenses'
    ];

    const rows = processedData.monthKeys.map((key, index) => {
      return {
        Month: processedData.months[index],
        'Gross Profit': processedData.monthlyGrossProfit[index],
        'Net Profit': processedData.monthlyNetProfit[index],
        'Revenue': profitData.monthly_revenue?.[key] || 0,
        'COGS': profitData.monthly_cogs?.[key] || 0,
        'Expenses': profitData.monthly_expenses?.[key] || 0
      };
    });

    // Add yearly summary as the last row
    rows.push({
      Month: 'Year Total',
      'Gross Profit': processedData.yearlySummary.gross_profit,
      'Net Profit': processedData.yearlySummary.net_profit,
      'Revenue': processedData.yearlySummary.revenue,
      'COGS': processedData.yearlySummary.cogs,
      'Expenses': processedData.yearlySummary.expenses
    });

    return [headers, ...rows.map(row => Object.values(row))];
  }, [processedData, profitData]);

  // Table data for trend view
  const trendTableData = useMemo(() => {
    if (!processedData) return [];

    return processedData.monthKeys.map((key, index) => {
      const month = processedData.months[index];
      const grossProfit = processedData.monthlyGrossProfit[index];
      const netProfit = processedData.monthlyNetProfit[index];
      
      return {
        month,
        grossProfit,
        netProfit,
      };
    });
  }, [processedData]);

  // Toggle row expansion
  const toggleRow = (index) => {
    setExpandedRows(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

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

  if (!profitData) {
    return <div className="text-sky-700">No profit data available</div>;
  }

  return (
   <motion.div
  className="rounded-lg bg-sky-50 p-4"
  variants={containerVariants}
  initial="hidden"
  animate="visible"
>
  {/* Breadcrumb Navigation */}
  <div className="mb-6">
    <button
      onClick={() => navigate('/financial-overview')}
      className="flex items-center text-sky-700 hover:text-sky-900 transition-colors"
    >
      <FaHome className="mr-2" />
      <span className="font-medium">Dashboard</span>
      <span className="mx-2 text-sky-400">/</span>
      <span className="text-gray-400 cursor-text">Profit Analysis</span>
    </button>
  </div>

  {/* Header Section */}
      <div className="flex bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm justify-between items-center mb-6">
    <div>
      <h1 className="text-2xl md:text-xl font-bold text-sky-50">Profit Analysis</h1>
      <p className="text-sky-50">Track and analyze your profit performance</p>
    </div>
    
    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
      <select
        value={selectedYear}
        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
        className="rounded-lg px-4 py-2 text-sky-900 bg-white border border-sky-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none"
      >
        {availableYears.map(year => (
          <option key={year} value={year}>{year}</option>
        ))}
      </select>
      
      <select
        value={selectedView}
        onChange={(e) => setSelectedView(e.target.value)}
        className="rounded-lg px-4 py-2 text-sky-900 bg-white border border-sky-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none"
      >
        <option value="gross">Gross Profit</option>
        <option value="net">Net Profit</option>
      </select>
      
      <CSVLink
        data={csvData}
        filename={`profit-analysis-${selectedYear}.csv`}
        className="flex items-center justify-center bg-sky-600 text-white px-4 py-2 rounded-lg hover:bg-sky-700 transition-colors shadow-sm"
      >
        <FaDownload className="mr-2" />
        <span>Export</span>
      </CSVLink>
    </div>
  </div>

  {/* KPI Cards */}
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
    <div className="bg-white p-4 rounded-xl shadow-sm border border-sky-100">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-s font-medium text-sky-700">
          {selectedView === 'gross' ? 'Gross Profit' : 'Net Profit'}
        </h3>
        <FaInfoCircle className="text-sky-400" title={`Sum of all ${selectedView === 'gross' ? 'gross' : 'net'} profit for the selected year`} />
      </div>
      <p className={`text-s font-bold ${(selectedView === 'gross' ? parseFloat(kpiMetrics.grossProfit.replace(/,/g, '')) : parseFloat(kpiMetrics.netProfit.replace(/,/g, ''))) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        ${selectedView === 'gross' ? kpiMetrics.grossProfit : kpiMetrics.netProfit}
      </p>
      <p className="text-x text-sky-500 mt-1">{selectedYear}</p>
    </div>
    
    <div className="bg-white p-4 rounded-xl shadow-sm border border-sky-100">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-s font-medium text-sky-700">Revenue</h3>
        <FaInfoCircle className="text-sky-400" title="Total revenue for the selected year" />
      </div>
      <p className="text-s font-bold  text-sky-900">${kpiMetrics.revenue}</p>
      <p className="text-x text-sky-500 mt-1">{selectedYear}</p>
    </div>
    
    <div className="bg-white p-4 rounded-xl shadow-sm border border-sky-100">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-s font-medium text-sky-700">Growth Rate</h3>
        <FaInfoCircle className="text-sky-400" title="Percentage growth from start to end of year" />
      </div>
      <p className={`text-s font-bold ${parseFloat(kpiMetrics.growthRate) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {kpiMetrics.growthRate}%
      </p>
      <p className="text-x text-sky-500 mt-1">YoY Change</p>
    </div>
    
    <div className="bg-white p-4 rounded-xl shadow-sm border border-sky-100">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-s font-medium text-sky-700">COGS</h3>
        <FaInfoCircle className="text-sky-400" title="Total COGS for the selected year" />
      </div>
      <p className="text-s font-bold text-sky-900">${kpiMetrics.cogs}</p>
      <p className="text-x text-sky-500 mt-1">{selectedYear}</p>
    </div>
    
    <div className="bg-white p-4 rounded-xl shadow-sm border border-sky-100">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-s font-medium text-sky-700">Expenses</h3>
        <FaInfoCircle className="text-sky-400" title="Total expenses for the selected year" />
      </div>
      <p className="text-s font-bold text-sky-900">${kpiMetrics.expenses}</p>
      <p className="text-x text-sky-500 mt-1">{selectedYear}</p>
    </div>
  </div>

  {/* Main Content Area */}
  <div className="flex flex-col lg:flex-row gap-6 mb-6">
    {/* Left Column - Table */}
    <div className="lg:w-2/3">
      <div className="bg-white p-5 rounded-xl shadow-sm border border-sky-100">
        <h3 className="text-lg font-semibold text-sky-900 mb-4">
          Monthly {selectedView === 'gross' ? 'Gross Profit' : 'Net Profit'} Details
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-sky-50 text-sky-700">
                <th className="py-3 px-4 text-left font-medium text-s border-b border-sky-200">Month</th>
                <th className="py-3 px-4 text-right font-medium text-s border-b border-sky-200">Gross Profit ($)</th>
                <th className="py-3 px-4 text-right font-medium text-s border-b border-sky-200">Net Profit ($)</th>
              </tr>
            </thead>
            <tbody>
              {trendTableData.map((row, index) => (
                <tr key={index} className="hover:bg-sky-50 even:bg-sky-50/50">
                  <td className="py-3 px-4 text-s text-sky-800 border-b border-sky-100">{row.month}</td>
                  <td className={`py-3 px-4 text-s text-right border-b border-sky-100 ${row.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${row.grossProfit.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
                  </td>
                  <td className={`py-3 px-4 text-s text-right border-b border-sky-100 ${row.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${row.netProfit.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    
    {/* Right Column - Charts and Insights */}
    <div className="lg:w-1/3 space-y-6">
      {/* Trend Chart */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-sky-100">
        <h3 className="text-lg font-semibold text-sky-900 mb-4">
          Monthly {selectedView === 'gross' ? 'Gross Profit' : 'Net Profit'} Trend
        </h3>
        <div className="h-64">
          <Line 
            data={getTrendChartData()} 
            options={{
              ...chartOptions,
              plugins: {
                ...chartOptions.plugins,
                legend: {
                  position: 'bottom',
                  labels: {
                    usePointStyle: true,
                    padding: 20
                  }
                }
              }
            }} 
          />
        </div>
      </div>
      
      {/* Quarterly Breakdown */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-sky-100">
        <h3 className="text-lg font-semibold text-sky-900 mb-4">
          Quarterly {selectedView === 'gross' ? 'Gross Profit' : 'Net Profit'} Breakdown
        </h3>
        <div className="h-64">
          <Bar
            data={getBreakdownChartData()}
            options={{
              ...chartOptions,
              plugins: {
                ...chartOptions.plugins,
                legend: {
                  position: 'bottom',
                  labels: {
                    usePointStyle: true,
                    padding: 20
                  }
                }
              }
            }}
          />
        </div>
      </div>
      
      {/* Insights Card */}
      <div className="bg-sky-100 p-5 rounded-xl border border-sky-200">
        <div className="flex items-center mb-3">
          <FaInfoCircle className="text-sky-600 mr-2" />
          <h4 className="text-lg font-semibold text-sky-900">Profit Insights</h4>
        </div>
        <ul className="space-y-3">
          <li className="flex items-start">
            <span className="bg-sky-200 text-sky-800 rounded-full p-1 mr-3">
              <FaChartLine className="text-x" />
            </span>
            <div>
              <p className="text-s font-medium text-sky-800">Profit Margin</p>
              <p className="text-sky-700">
                {selectedView === 'gross' 
                  ? ((processedData.yearlySummary.gross_profit / processedData.yearlySummary.revenue) * 100).toFixed(getDecimalPrecision())
                  : ((processedData.yearlySummary.net_profit / processedData.yearlySummary.revenue) * 100).toFixed(getDecimalPrecision())
                }%
              </p>
            </div>
          </li>
          <li className="flex items-start">
            <span className="bg-sky-200 text-sky-800 rounded-full p-1 mr-3">
              <FaTrophy className="text-x" />
            </span>
            <div>
              <p className="text-s font-medium text-sky-800">Best Quarter</p>
              <p className="text-sky-700">
                {kpiMetrics.quarterlyBreakdown.reduce((max, quarter) => 
                  quarter.value > max.value ? quarter : max, 
                  kpiMetrics.quarterlyBreakdown[0]
                ).quarter} (${Math.max(...kpiMetrics.quarterlyBreakdown.map(q => q.value)).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })})
              </p>
            </div>
          </li>
          <li className="flex items-start">
            <span className="bg-sky-200 text-sky-800 rounded-full p-1 mr-3">
              <FaArrowTrendUp className="text-x" />
            </span>
            <div>
              <p className="text-s font-medium text-sky-800">Trend</p>
              <p className={`${parseFloat(kpiMetrics.growthRate) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {parseFloat(kpiMetrics.growthRate) > 0 ? 'Positive' : 'Negative'} growth year-to-date
              </p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</motion.div>
  );
};

export default ProfitAnalysis;