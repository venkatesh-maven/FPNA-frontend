import React, { useState, useEffect, useMemo, useContext } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { CSVLink } from 'react-csv';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FaDownload, FaChevronDown, FaChevronRight, FaHome, FaInfoCircle } from 'react-icons/fa';
import { AuthContext } from '../../../context/AuthContext';
import { FinancialYearContext } from '../../../context/FinancialYearContext';
import { API_BASE_URL } from '../../../config/config';
import FinancialDashboardSkeleton from '../../../Skeletons/FinancialDashboardSkeleton';
import { getDecimalPrecision } from '../../../utils/formatters';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

const RevenueComponent = () => {
  const { token } = useContext(AuthContext);
  const { selectedYear, setSelectedYear, years: availableYears } = useContext(FinancialYearContext);

  const navigate = useNavigate();
  const [selectedView, setSelectedView] = useState('trend');
  const [expandedRows, setExpandedRows] = useState([]);
  const [revenueData, setRevenueData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch revenue data from API
  useEffect(() => {
    // do not call API until year is available
    if (!selectedYear) return;

    const fetchRevenueData = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `${API_BASE_URL}/api/v1/company/financial/analytics/revenue/${selectedYear}`,
          {
            headers: {
              accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch revenue data');
        }

        const data = await response.json();
        setRevenueData(data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchRevenueData();
  }, [selectedYear, token]);
  // Process data for display
  const processedData = useMemo(() => {
    if (!revenueData) return null;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthKeys = Object.keys(revenueData.monthly_revenue).sort();
    
    // Get all unique categories from the data
    const allCategories = new Set();
    Object.values(revenueData.monthly_category_revenue).forEach(monthData => {
      Object.keys(monthData).forEach(category => allCategories.add(category));
    });
    
    const categories = Array.from(allCategories);

    return {
      months,
      monthKeys,
      categories,
      monthlyRevenue: monthKeys.map(key => revenueData.monthly_revenue[key]),
      monthlyCategoryRevenue: categories.map(category => ({
        category,
        data: monthKeys.map(key => revenueData.monthly_category_revenue[key]?.[category] || 0)
      })),
      quarterlyCategoryRevenue: categories.map(category => ({
        category,
        q1: revenueData.quarterly_category_revenue.Q1?.[category] || 0,
        q2: revenueData.quarterly_category_revenue.Q2?.[category] || 0,
        q3: revenueData.quarterly_category_revenue.Q3?.[category] || 0,
        q4: revenueData.quarterly_category_revenue.Q4?.[category] || 0
      })),
      yearlyCategoryRevenue: categories.map(category => ({
        category,
        amount: revenueData.yearly_category_revenue[category] || 0,
        percentage: revenueData.yearly_contribution_percentages[category] || 0
      }))
    };
  }, [revenueData]);

  // Calculate KPIs
  const kpiMetrics = useMemo(() => {
    if (!processedData) {
      return {
        totalRevenue: '0',
        incrementalRevenue: '0',
        growthRate: '0.00',
        categoryContributions: [],
        quarterlyBreakdown: [],
      };
    }

    const monthlyRevenue = processedData.monthlyRevenue;
    const totalRevenue = revenueData.total_revenue;
    const incrementalRevenue = monthlyRevenue.length > 1 
      ? monthlyRevenue[monthlyRevenue.length - 1] - monthlyRevenue[monthlyRevenue.length - 2] 
      : 0;
    const growthRate = monthlyRevenue.length > 1 
      ? ((monthlyRevenue[monthlyRevenue.length - 1] - monthlyRevenue[0]) / monthlyRevenue[0] * 100) : (0);

    return {
      totalRevenue: totalRevenue.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }),
      incrementalRevenue: incrementalRevenue.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }),
      growthRate: growthRate.toFixed(getDecimalPrecision()),
      categoryContributions: processedData.yearlyCategoryRevenue.map(item => ({
        category: item.category,
        contribution: item.percentage.toFixed(2),
      })),
      quarterlyBreakdown: processedData.quarterlyCategoryRevenue,
    };
  }, [processedData, revenueData]);

  // Chart data for trend view
  const getTrendChartData = () => {
    if (!processedData) return { labels: [], datasets: [] };

    return {
      labels: processedData.months.slice(0, processedData.monthKeys.length),
      datasets: [
        {
          label: `Monthly Revenue (${selectedYear})`,
          data: processedData.monthlyRevenue,
          borderColor: '#4BC0C0',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          fill: true,
          tension: 0.3,
        },
        ...processedData.monthlyCategoryRevenue.map((categoryData, index) => ({
          label: categoryData.category,
          data: categoryData.data,
          borderColor: `hsl(${index * 360 / processedData.categories.length}, 70%, 50%)`,
          backgroundColor: `hsla(${index * 360 / processedData.categories.length}, 70%, 50%, 0.2)`,
          hidden: true,
          tension: 0.3,
        }))
      ]
    };
  };

  // Chart data for breakdown view
  const getBreakdownChartData = () => {
    if (!processedData) return { labels: [], datasets: [] };

    return {
      labels: ['Q1', 'Q2', 'Q3', 'Q4'],
      datasets: processedData.quarterlyCategoryRevenue.map((category, index) => ({
        label: category.category,
        data: [category.q1, category.q2, category.q3, category.q4],
        backgroundColor: `hsla(${index * 360 / processedData.categories.length}, 70%, 50%, 0.7)`,
        borderColor: `hsl(${index * 360 / processedData.categories.length}, 70%, 50%)`,
        borderWidth: 1,
      })),
    };
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: {
        display: true,
        text: selectedView === 'trend' ? `Revenue Trend for ${selectedYear}` : `Revenue Breakdown by Category (${selectedYear})`,
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
        beginAtZero: true,
        ticks: { 
          callback: (value) => `$${value / 1000}k`,
          color: '#075985',
        },
        title: { 
          display: true, 
          text: 'Revenue ($)', 
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
      'Total Revenue',
      ...processedData.categories.map(c => `${c} Revenue`),
      ...processedData.categories.map(c => `${c} Contribution (%)`)
    ];

    const rows = processedData.monthKeys.map((key, index) => {
      const month = processedData.months[index];
      const total = processedData.monthlyRevenue[index];
      const rowData = {
        Month: month,
        'Total Revenue': total,
      };

      processedData.categories.forEach(category => {
        const categoryRevenue = processedData.monthlyCategoryRevenue
          .find(c => c.category === category)?.data[index] || 0;
        const percentage = total > 0 ? (categoryRevenue / total * 100).toFixed(2) : 0;
        
        rowData[`${category} Revenue`] = categoryRevenue;
        rowData[`${category} Contribution (%)`] = percentage;
      });

      return rowData;
    });

    return [headers, ...rows.map(row => Object.values(row))];
  }, [processedData]);

  // Table data for trend view
  const trendTableData = useMemo(() => {
    if (!processedData) return [];

    return processedData.monthKeys.map((key, index) => {
      const month = processedData.months[index];
      const total = processedData.monthlyRevenue[index];
      
      const detailData = processedData.categories.map(category => {
        const categoryRevenue = processedData.monthlyCategoryRevenue
          .find(c => c.category === category)?.data[index] || 0;
        const percentage = total > 0 ? (categoryRevenue / total * 100).toFixed(2) : 0;
        
        return {
          category,
          contribution: categoryRevenue,
          contributionPct: percentage,
        };
      });

      return {
        month,
        total,
        detailData,
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
    // return <div className="text-sky-700">Loading revenue data...</div>;
  }

  if (error) {
    return <div className="text-red-600">Error: {error}</div>;
  }

  if (!revenueData) {
    return <div className="text-sky-700">No revenue data available</div>;
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
        <FaHome className="mr-2" /> Dashboard | <span className='ml-2 text-gray-400 cursor-text'> Revenue Breakdown</span>
      </button>
      <div className="flex bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold text-sky-50">Revenue Breakdown</h2>
        </div>
        <div className="flex space-x-4 items-center">
           <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="rounded-md px-3 py-2 text-white bg-sky-900 outline-0"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={selectedView}
            onChange={(e) => setSelectedView(e.target.value)}
            className="rounded-md px-3 py-2 text-white bg-sky-900 outline-0"
          >
            <option value="trend">Trend View</option>
            <option value="breakdown">Breakdown View</option>
          </select>
          <CSVLink
            data={csvData}
            filename={`revenue-analytics-${selectedYear}.csv`}
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
            Total Revenue ({selectedYear})
            <span className="ml-1 text-sky-500" title="Sum of all revenue for the selected year">
              <FaInfoCircle size={14} />
            </span>
          </h3>
          <p className="text-2xl font-bold text-sky-900">${kpiMetrics.totalRevenue}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500">
          <h3 className="text-s font-semibold text-sky-700 flex items-center">
            Incremental Revenue (Last Month)
            <span className="ml-1 text-sky-500" title="Change from previous month">
              <FaInfoCircle size={14} />
            </span>
          </h3>
          <p className="text-2xl font-bold text-sky-900">${kpiMetrics.incrementalRevenue}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500">
          <h3 className="text-s font-semibold text-sky-700 flex items-center">
            Annual Growth Rate
            <span className="ml-1 text-sky-500" title="Percentage growth from start to end of year">
              <FaInfoCircle size={14} />
            </span>
          </h3>
          <p className="text-2xl font-bold text-sky-900">{kpiMetrics.growthRate}%</p>
        </div>
      </div>

      {/* Chart and Table Layout */}
      <div className="flex gap-2 mb-6 ">
        <div className="flex flex-col w-[70%] lg:flex-row gap-6">
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-sky-900 mb-3">
              {selectedView === 'trend' ? 'Monthly Revenue Details' : 'Category Breakdown'}
            </h3>
            <div className="overflow-x-auto">
              {selectedView === 'trend' ? (
                <table className="w-full bg-white border border-sky-200">
                  <thead>
                    <tr className="bg-sky-100">
                      <th className="py-3 px-6 border-b text-left text-base font-semibold text-sky-700 min-w-[120px] whitespace-nowrap">Month</th>
                      <th className="py-3 px-6 border-b text-right text-base font-semibold text-sky-700 min-w-[120px] whitespace-nowrap">Total Revenue ($)</th>
                      <th className="py-3 px-6 border-b text-left text-base font-semibold text-sky-700 min-w-[120px] whitespace-nowrap">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trendTableData.map((row, index) => (
                      <React.Fragment key={index}>
                        <tr
                          className="hover:bg-sky-50 cursor-pointer"
                          onClick={() => toggleRow(index)}
                        >
                          <td className="py-3 px-6 border-b text-base text-sky-700 min-w-[120px] whitespace-nowrap flex items-center">
                            {expandedRows.includes(index) ? (
                              <FaChevronDown className="mr-2" />
                            ) : (
                              <FaChevronRight className="mr-2" />
                            )}
                            {row.month}
                          </td>
                          <td className="py-3 px-6 border-b text-base text-sky-700 min-w-[120px] whitespace-nowrap text-right">${row.total.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                          <td className="py-3 px-6 border-b text-base text-sky-700 min-w-[120px] whitespace-nowrap">
                            <button 
                              className="text-sky-600 hover:text-sky-800"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRow(index);
                              }}
                            >
                              View breakdown
                            </button>
                          </td>
                        </tr>
                        {expandedRows.includes(index) && (
                          <tr>
                            <td colSpan="3" className="py-3 px-6 bg-sky-50">
                              <div>
                                <h4 className="text-base font-semibold text-sky-700 mb-2">Category Breakdown</h4>
                                <table className="w-full bg-white border border-sky-200">
                                  <thead>
                                    <tr className="bg-sky-100">
                                      <th className="py-3 px-6 border-b text-left text-base font-semibold text-sky-700 min-w-[120px] whitespace-nowrap">Category</th>
                                      <th className="py-3 px-6 border-b text-right text-base font-semibold text-sky-700 min-w-[120px] whitespace-nowrap">Amount ($)</th>
                                      <th className="py-3 px-6 border-b text-right text-base font-semibold text-sky-700 min-w-[120px] whitespace-nowrap">Contribution (%)</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {row.detailData.map((detail, i) => (
                                      <tr key={i}>
                                        <td className="py-3 px-6 border-b text-base text-sky-700 min-w-[120px] whitespace-nowrap">{detail.category}</td>
                                        <td className="py-3 px-6 border-b text-base text-sky-700 min-w-[120px] whitespace-nowrap text-right">${detail.contribution.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                                        <td className="py-3 px-6 border-b text-base text-sky-700 min-w-[120px] whitespace-nowrap text-right">{detail.contributionPct}%</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full bg-white border border-sky-200">
                  <thead>
                    <tr className="bg-sky-100">
                      <th className="py-3 px-6 border-b text-left text-base font-semibold text-sky-700 min-w-[120px] whitespace-nowrap">Category</th>
                      <th className="py-3 px-6 border-b text-right text-base font-semibold text-sky-700 min-w-[120px] whitespace-nowrap">Q1 ($)</th>
                      <th className="py-3 px-6 border-b text-right text-base font-semibold text-sky-700 min-w-[120px] whitespace-nowrap">Q2 ($)</th>
                      <th className="py-3 px-6 border-b text-right text-base font-semibold text-sky-700 min-w-[120px] whitespace-nowrap">Q3 ($)</th>
                      <th className="py-3 px-6 border-b text-right text-base font-semibold text-sky-700 min-w-[120px] whitespace-nowrap">Q4 ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpiMetrics.quarterlyBreakdown.map((category, index) => (
                      <tr key={index} className="hover:bg-sky-50">
                        <td className="py-3 px-6 border-b text-base text-sky-700 min-w-[120px] whitespace-nowrap">{category.category}</td>
                        <td className="py-3 px-6 border-b text-base text-sky-700 min-w-[120px] whitespace-nowrap text-right">${category.q1.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                        <td className="py-3 px-6 border-b text-base text-sky-700 min-w-[120px] whitespace-nowrap text-right">${category.q2.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                        <td className="py-3 px-6 border-b text-base text-sky-700 min-w-[120px] whitespace-nowrap text-right">${category.q3.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                        <td className="py-3 px-6 border-b text-base text-sky-700 min-w-[120px] whitespace-nowrap text-right">${category.q4.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <h3 className="text-xl font-semibold text-sky-900 mb-3">Category Contribution</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {kpiMetrics.categoryContributions.map((category, index) => (
                <div key={index} className="p-4 bg-sky-50 rounded-lg  border border-sky-200">
                  <h4 className="text-base font-medium text-sky-700 ">{category.category}</h4>
                  <p className="text-xl font-bold text-sky-900">{category.contribution}%</p>
                </div>
              ))}
            </div>
          </div>


          

          <div className="bg-sky-50 p-4 rounded-lg border border-sky-200">
            <div className="h-64">
              {selectedView === 'trend' ? (
                <Line data={getTrendChartData()} options={chartOptions} />
              ) : (
                <Bar
                  data={getBreakdownChartData()}
                  options={{
                    ...chartOptions,
                    scales: {
                      ...chartOptions.scales,
                      x: { stacked: true },
                      y: { ...chartOptions.scales.y, stacked: false },
                    },
                  }}
                />
              )}
            </div>
          </div>
          <div className="p-4 bg-sky-50 rounded-lg border border-sky-200">
            <h4 className="text-base font-semibold text-sky-900 mb-2 flex items-center">
              <FaInfoCircle className="mr-2 text-sky-500" />
              Revenue Insights
            </h4>
            <ul className="list-disc pl-5 text-sky-700 text-base space-y-1">
              <li>
                <strong className="text-sky-800">Highest Revenue Category:</strong>{' '}
                {kpiMetrics.categoryContributions.reduce(
                  (max, c) => parseFloat(c.contribution) > parseFloat(max.contribution) ? c : max,
                  kpiMetrics.categoryContributions[0] || { category: 'N/A', contribution: '0' }
                ).category} (
                {kpiMetrics.categoryContributions.reduce(
                  (max, c) => parseFloat(c.contribution) > parseFloat(max.contribution) ? c : max,
                  kpiMetrics.categoryContributions[0] || { category: 'N/A', contribution: '0' }
                ).contribution}% contribution)
              </li>
              <li>
                <strong className="text-sky-800">Revenue Trend:</strong>{' '}
                {parseFloat(kpiMetrics.growthRate) > 0 ? 'Increasing' : 'Decreasing'} revenue observed year-to-date
              </li>
              <li>
                <strong className="text-sky-800">Average Monthly Revenue:</strong>{' '}
                ${(revenueData.total_revenue / processedData.monthKeys.length).toLocaleString(undefined, {minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision()})}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default RevenueComponent;