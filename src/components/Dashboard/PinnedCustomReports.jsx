import React, { useCallback, useContext, useEffect, useState } from "react";
import { FiBarChart2, FiX } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config/config";
import { formatCurrencyValue, formatNumber } from "../../utils/formatters";

// Custom Reports pinned to the dashboard (Custom Report Builder's "Add to
// Dashboard" action). Deliberately its own small self-contained section
// rather than wired into FinancialOverview's existing widget/chart engine
// (that engine only knows a fixed set of built-in metric_trend keys — see
// CustomReportDashboardPin's docstring in the backend model for why a
// parallel, simpler path was used instead of extending it). Each tile's
// value is always freshly computed server-side from the pinned report's own
// dimensions/metrics/filters, so it can't go stale.
export default function PinnedCustomReports() {
  const { token, selectedYear, selectedCurrency } = useContext(AuthContext);
  const navigate = useNavigate();
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);

  const currency = selectedCurrency || "USD";

  const fetchPins = useCallback(async () => {
    if (!token || !selectedYear) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/company/financial/custom_report/dashboard_pins/${selectedYear}/${currency}`,
        { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } }
      );
      const data = await res.json();
      setPins(Array.isArray(data) ? data : []);
    } catch {
      setPins([]);
    } finally {
      setLoading(false);
    }
  }, [token, selectedYear, currency]);

  useEffect(() => {
    fetchPins();
  }, [fetchPins]);

  const handleUnpin = useCallback(
    async (viewId) => {
      setPins((prev) => prev.filter((p) => p.view_id !== viewId));
      try {
        await fetch(`${API_BASE_URL}/api/v1/company/financial/custom_report/saved_views/${viewId}/pin`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        fetchPins(); // roll back the optimistic removal on failure
      }
    },
    [token, fetchPins]
  );

  if (!loading && pins.length === 0) return null;

  const isCountMetric = (metric) => metric === "Volume";
  const formatValue = (pin) => (isCountMetric(pin.primary_metric) ? formatNumber(pin.value, 0) : formatCurrencyValue(pin.value));

  return (
    <div className="bg-white rounded-xl shadow-md p-4" data-pdf-keep>
      <h3 className="text-sky-900 font-semibold mb-3">Custom Reports</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {loading
          ? Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-sky-50 animate-pulse" />
            ))
          : pins.map((pin) => (
              <button
                key={pin.pin_id}
                type="button"
                onClick={() => navigate(`/reports/custom-report-builder?view=${pin.view_id}`)}
                className="relative flex flex-col items-start gap-1 rounded-lg border border-sky-200 bg-white p-3 text-left transition-colors hover:bg-sky-50 hover:border-sky-300"
              >
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUnpin(pin.view_id);
                  }}
                  className="absolute top-2 right-2 text-slate-300 hover:text-rose-500"
                  title="Remove from dashboard"
                >
                  <FiX size={14} />
                </span>
                <span className="flex items-center gap-2 text-x font-medium text-sky-700">
                  <FiBarChart2 className="text-sky-500" size={14} />
                  {pin.name}
                </span>
                <span className="text-lg font-semibold text-sky-900">{formatValue(pin)}</span>
              </button>
            ))}
      </div>
    </div>
  );
}
