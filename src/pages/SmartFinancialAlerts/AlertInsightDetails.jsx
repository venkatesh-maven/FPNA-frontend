import React, { useContext, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { FiAlertTriangle, FiChevronRight } from 'react-icons/fi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AuthContext } from '../../context/AuthContext';
import { API_BASE_URL } from '../../config/config';
import { formatCurrencyValue, formatNumber } from '../../utils/formatters';

const UNIT_LABELS = {
  currency: 'Amount',
  percent: '%',
  days: 'Days',
  count: 'Count',
};

const formatByUnit = (value, unit) => {
  if (value === null || value === undefined) return 'N/A';
  if (unit === 'currency') return formatCurrencyValue(value);
  if (unit === 'percent') return `${formatNumber(value)}%`;
  return formatNumber(value);
};

const friendlyLabel = (key) => key
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (c) => c.toUpperCase());

const SEVERITY_BADGE = {
  high: 'bg-red-100 text-red-800',
  critical: 'bg-red-100 text-red-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-blue-100 text-blue-800',
};

const BreakdownTable = ({ label, rows }) => {
  if (!rows || rows.length === 0) {
    return <p className="text-sm text-gray-500">No breakdown data available.</p>;
  }

  const extraKeys = Array.from(
    new Set(rows.flatMap((r) => Object.keys(r).filter((k) => !['name'].includes(k))))
  );

  const isNumericVariance = extraKeys.includes('variance_amount') || extraKeys.includes('variance_percent');

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="py-2 pr-4 font-medium">{label}</th>
            {extraKeys.map((key) => (
              <th key={key} className="py-2 pr-4 font-medium">{friendlyLabel(key)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="border-b border-gray-100">
              <td className="py-2 pr-4 font-medium text-gray-800">{row.name}</td>
              {extraKeys.map((key) => {
                const val = row[key];
                let display = val;
                if (typeof val === 'number') {
                  if (key.toLowerCase().includes('percent')) display = `${formatNumber(val)}%`;
                  else display = formatCurrencyValue(val);
                } else if (val === null || val === undefined) {
                  display = '—';
                }
                const isVarianceCol = key === 'variance_amount' || key === 'variance_percent';
                const color = isVarianceCol && isNumericVariance
                  ? (Number(val) < 0 ? 'text-red-600' : Number(val) > 0 ? 'text-green-600' : 'text-gray-600')
                  : 'text-gray-700';
                return (
                  <td key={key} className={`py-2 pr-4 ${color}`}>{display}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const AlertInsightDetails = () => {
  const { alertId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = useContext(AuthContext);

  const alertTitle = location.state?.alertTitle || 'Alert Details';
  const severity = location.state?.severity;

  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!alertId || !token) return;

    const fetchInsights = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/alerts/${alertId}/insights`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`Failed to load insights: ${res.status}`);
        const data = await res.json();
        setInsights(data);
      } catch (err) {
        console.error('Error fetching alert insights:', err);
        setError('Could not load detailed insights for this alert.');
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [alertId, token]);

  const summary = insights?.summary || {};
  const unit = summary.unit || 'currency';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-5xl mx-auto">
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
                <Link to="/smart-financial-alerts" className="ms-1 text-s font-medium text-gray-700 hover:text-blue-600 md:ms-2">
                  Smart Financial Alerts
                </Link>
              </div>
            </li>
            <li aria-current="page">
              <div className="flex items-center">
                <FiChevronRight className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" />
                <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">{alertTitle}</span>
              </div>
            </li>
          </ol>
        </nav>

        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="flex items-start justify-between p-5 border-b border-gray-200">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{alertTitle}</h1>
              {severity && (
                <span className={`inline-block mt-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${SEVERITY_BADGE[severity] || 'bg-gray-100 text-gray-800'}`}>
                  {severity.charAt(0).toUpperCase() + severity.slice(1)}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate('/smart-financial-alerts')}
              className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back to Alerts
            </button>
          </div>

          <div className="p-5 space-y-6">
            {loading && (
              <div className="flex justify-center items-center h-40">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
              </div>
            )}

            {!loading && error && (
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 p-4 rounded-lg">
                <FiAlertTriangle />
                <span>{error}</span>
              </div>
            )}

            {!loading && !error && insights && (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Summary</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Object.entries(summary)
                      .filter(([key]) => key !== 'unit')
                      .map(([key, value]) => (
                        <div key={key} className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500">{friendlyLabel(key)}</p>
                          <p className="text-base font-semibold text-gray-900">
                            {typeof value === 'number'
                              ? (key.toLowerCase().includes('percent') ? `${formatNumber(value)}%` : formatByUnit(value, unit))
                              : (value ?? 'N/A')}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Breakdown by {insights.breakdown_label || 'Item'}
                  </h3>
                  <BreakdownTable label={insights.breakdown_label || 'Item'} rows={insights.breakdown} />
                </div>

                {insights.secondary_breakdown?.items?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      {insights.secondary_breakdown.label}
                    </h3>
                    <BreakdownTable label="Name" rows={insights.secondary_breakdown.items} />
                  </div>
                )}

                {insights.trend?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Trend</h3>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={insights.trend}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatNumber(v, 0)} />
                          <Tooltip formatter={(value) => [formatCurrencyValue(value), 'Value']} />
                          <Line type="monotone" dataKey="value" stroke="#4f46e5" dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {insights.root_cause && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Root Cause &amp; Trend Analysis</h3>
                    <p className="text-sm text-gray-700 bg-indigo-50 p-4 rounded-lg">{insights.root_cause}</p>
                  </div>
                )}

                {insights.recommended_actions?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Recommended Actions</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                      {insights.recommended_actions.map((action, idx) => (
                        <li key={idx}>{action}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertInsightDetails;
