import React, { useState, useEffect, useContext } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { FiInfo, FiDownload, FiArrowLeft, FiChevronRight } from 'react-icons/fi';
import { useNavigate, Link } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { AuthContext } from '../../context/AuthContext';
import { FinancialYearContext } from '../../context/FinancialYearContext';
import { API_BASE_URL } from '../../config/config';
import { getDecimalPrecision } from '../../utils/formatters';

const categoryColors = {
  'Cost Reduction': '#ef4444',
  'Revenue Acceleration': '#22c55e',
  'Working Capital': '#3b82f6',
  'Risk Mitigation': '#f59e0b',
  'Strategic Planning': '#8b5cf6'
};

const AlertDetailTemplate = ({
  title,
  subtitle,
  endpointPath,
  firstMetricLabel,
  firstMetricNoneLabel,
  chartTitle,
}) => {
  const navigate = useNavigate();
  const { token } = useContext(AuthContext);
  const { selectedYear } = useContext(FinancialYearContext);

  const [detailData, setDetailData] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const year = selectedYear || 2025;
        const res = await fetch(
          `${API_BASE_URL}/api/v1/alerts/${endpointPath}/analysis?year=${year}&projection_days=30`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error(`API error ${res.status}`);

        const data = await res.json();

        const historical = (data.historical || []).map(d => ({
          date: new Date(d.date).getTime(),
          balance: d.balance,
          type: 'historical'
        }));

        const projection = (data.projection || []).map(d => ({
          date: new Date(d.date).getTime(),
          projected: d.balance,
          type: 'projection'
        }));

        const anchor = historical.length
          ? [{ date: historical[historical.length - 1].date, projected: historical[historical.length - 1].balance }]
          : [];

        setChartData([...historical, ...anchor, ...projection]);

        const isRisk = Boolean(data.is_shortfall_predicted);
        setDetailData({
          title: isRisk ? `${title} - Action Needed` : `${title} - Stable`,
          message: isRisk
            ? `AI predicts elevated risk in the next ${data.timeframe_days} days.`
            : `Trend appears stable for the next ${data.timeframe_days} days.`,
          severity: isRisk ? 'high' : 'low',
          resolved: false,
          anchorDate: data.anchor_date,
          avgDailyFlow: data.avg_daily_flow,
          details: {
            predictedShortfall: isRisk
              ? `$${Number(data.predicted_shortfall || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`
              : firstMetricNoneLabel,
            timeframe: `Next ${data.timeframe_days} days`,
            confidence: `${data.confidence_percent}%`,
            suggestions: (data.suggestions || []).map(s => typeof s === 'string'
              ? { action: s, impact_percent: 0, time_to_impact_weeks: 0, difficulty: 'N/A', category: 'N/A', mini_chart: [] }
              : s
            )
          }
        });

        if (isRisk) {
          toast.error(`${title}: elevated risk detected`, { position: 'top-right', autoClose: 7000 });
        }
      } catch (error) {
        console.error(`Error fetching ${title} data:`, error);
        toast.error(`Failed to load ${title} data`, { position: 'top-right', autoClose: 5000 });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, selectedYear, endpointPath, title, firstMetricNoneLabel]);

  const exportToExcel = () => {
    if (!detailData) {
      toast.warn('No data available to export', { position: 'top-right', autoClose: 5000 });
      return;
    }

    const wsData = [
      ['Title', detailData.title],
      ['Message', detailData.message],
      ['Severity', detailData.severity],
      [firstMetricLabel, detailData.details.predictedShortfall],
      ['Timeframe', detailData.details.timeframe],
      ['Confidence', detailData.details.confidence],
      ['Avg Daily Trend', `$${Number(detailData.avgDailyFlow || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}/day`],
      ...detailData.details.suggestions.map((s, i) => ['Suggestion ' + (i + 1), s.action || String(s)]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AlertDetail');
    XLSX.writeFile(wb, `${title.replace(/\s+/g, '_')}.xlsx`);
    toast.success('Exported to Excel', { position: 'top-right', autoClose: 3000 });
  };

  const exportToPDF = () => {
    if (!detailData) {
      toast.warn('No data available to export', { position: 'top-right', autoClose: 5000 });
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(title, 14, 15);
    doc.autoTable({
      head: [['Field', 'Value']],
      body: [
        ['Message', detailData.message],
        [firstMetricLabel, detailData.details.predictedShortfall],
        ['Timeframe', detailData.details.timeframe],
        ['Confidence', detailData.details.confidence],
        ['Avg Daily Trend', `$${Number(detailData.avgDailyFlow || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}/day`],
      ],
      startY: 20
    });
    doc.autoTable({
      head: [['Suggestion', 'Impact', 'Timeline', 'Difficulty']],
      body: detailData.details.suggestions.map(s => [
        s.action,
        `+${s.impact_percent || 0}%`,
        `${s.time_to_impact_weeks || 0}w`,
        s.difficulty || 'N/A'
      ]),
      startY: doc.lastAutoTable.finalY + 10
    });
    doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
    toast.success('Exported to PDF', { position: 'top-right', autoClose: 3000 });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <ToastContainer />
      <div className="max-w-7xl mx-auto">
        <nav className="flex mb-4" aria-label="Breadcrumb">
          <ol className="inline-flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse">
            <li className="inline-flex items-center">
              <Link to="/" className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600">Home</Link>
            </li>
            <li>
              <div className="flex items-center">
                <FiChevronRight className="w-3 h-3 text-gray-400 mx-1" />
                <Link to="/smart-financial-alerts" className="ms-1 text-sm font-medium text-gray-700 hover:text-blue-600 md:ms-2">Smart Financial Alerts</Link>
              </div>
            </li>
            <li aria-current="page">
              <div className="flex items-center">
                <FiChevronRight className="w-3 h-3 text-gray-400 mx-1" />
                <span className="ms-1 text-sm font-medium text-gray-500 md:ms-2">Detailed View</span>
              </div>
            </li>
          </ol>
        </nav>

        <div className="mb-5 flex justify-between items-center bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm w-full">
          <div>
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            <p className="text-white mt-1">{subtitle}</p>
          </div>
          <div className="flex space-x-4">
            <button onClick={() => navigate('/smart-financial-alerts')} className="mr-4 flex p-2 rounded-full hover:bg-gray-200 transition-colors" aria-label="Go back to alerts">
              <FiArrowLeft size={24} className="text-gray-600" /> Back
            </button>
            <button onClick={exportToExcel} className="bg-green-600 text-white px-3 py-2 rounded-md text-sm hover:bg-green-700 flex items-center disabled:opacity-50" disabled={loading}>
              <FiDownload className="mr-1" /> Excel
            </button>
            <button onClick={exportToPDF} className="bg-red-600 text-white px-3 py-2 rounded-md text-sm hover:bg-red-700 flex items-center disabled:opacity-50" disabled={loading}>
              <FiDownload className="mr-1" /> PDF
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-md">
              <div className="flex items-center mb-4">
                <h2 className="text-lg font-semibold">Alert Details</h2>
                <FiInfo data-tooltip-id="details-tooltip" className="ml-2 text-gray-500 cursor-pointer" />
                <ReactTooltip id="details-tooltip" place="top" className="max-w-xs">AI-predicted details for this alert module.</ReactTooltip>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-sm text-gray-600">{firstMetricLabel}</p>
                  <p className="text-lg font-semibold text-red-600">{detailData?.details.predictedShortfall || 'N/A'}</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-sm text-gray-600">Timeframe</p>
                  <p className="text-lg font-semibold text-red-600">{detailData?.details.timeframe || 'N/A'}</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-sm text-gray-600">Confidence</p>
                  <p className="text-lg font-semibold text-red-600">{detailData?.details.confidence || 'N/A'}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Avg Daily Trend</p>
                  <p className="text-lg font-semibold text-blue-700">{detailData?.avgDailyFlow != null ? `$${Number(detailData.avgDailyFlow).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}/day` : 'N/A'}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Data As Of</p>
                  <p className="text-lg font-semibold text-blue-700">{detailData?.anchorDate ? new Date(detailData.anchorDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Status</p>
                  <p className={`text-lg font-semibold ${detailData?.severity === 'high' ? 'text-red-600' : 'text-green-600'}`}>{detailData?.severity === 'high' ? 'At Risk' : 'Stable'}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md">
              <div className="flex items-center mb-4">
                <h2 className="text-lg font-semibold">Suggested Corrective Actions</h2>
              </div>
              <div className="space-y-4">
                {detailData?.details.suggestions?.length ? detailData.details.suggestions.map((s, index) => {
                  const diffColor = s.difficulty === 'Low' ? 'bg-green-100 text-green-700' : s.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
                  const barColor = categoryColors[s.category] || '#3b82f6';
                  return (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-bold text-gray-400">#{index + 1}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${diffColor}`}>{s.difficulty}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700">{s.category}</span>
                          </div>
                          <p className="text-gray-800 font-medium text-sm">{s.action}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span>Impact: <strong className="text-green-600">+{s.impact_percent}%</strong></span>
                            <span>Time to impact: <strong>{s.time_to_impact_weeks} week{s.time_to_impact_weeks !== 1 ? 's' : ''}</strong></span>
                          </div>
                        </div>
                        {s.mini_chart?.length > 0 && (
                          <div className="w-36 h-16 flex-shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={s.mini_chart} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
                                <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                <YAxis hide domain={[0, 'auto']} />
                                <Tooltip formatter={(value) => [`+${value}%`, 'Improvement']} contentStyle={{ fontSize: 11, padding: '4px 8px' }} />
                                <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                                  {s.mini_chart.map((entry, i) => (
                                    <Cell key={i} fill={entry.value > 0 ? barColor : '#e5e7eb'} opacity={0.7 + (i * 0.05)} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }) : <p className="text-gray-500">No suggestions available</p>}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md">
              <div className="flex items-center mb-4">
                <h2 className="text-lg font-semibold">{chartTitle}</h2>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={time => new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      type="number"
                      domain={['dataMin', 'dataMax']}
                      scale="time"
                    />
                    <YAxis tickFormatter={value => `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`} domain={['auto', 'auto']} />
                    <Tooltip
                      formatter={(value, name) => [`$${Number(value).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`, name]}
                      labelFormatter={time => new Date(time).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="balance" stroke="#3b82f6" dot={false} name="Historical Trend" connectNulls={false} />
                    <Line type="monotone" dataKey="projected" stroke="#ef4444" strokeDasharray="5 5" dot={false} name="Projected Trend" connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertDetailTemplate;
