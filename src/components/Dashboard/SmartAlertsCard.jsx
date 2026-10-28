import React, { useState, useEffect, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { BsBellFill } from "react-icons/bs";
import { FiAlertCircle, FiArrowRight, FiSettings, FiCheckSquare } from "react-icons/fi";
import { AuthContext } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config/config";

const SEVERITY_PRIORITY = { high: 0, medium: 1, low: 2, success: 3 };

const severityConfig = {
  high: {
    color: "text-red-700", bg: "bg-red-50", border: "border-red-200",
    leftBar: "border-l-red-500", dot: "bg-red-500", label: "Critical",
  },
  medium: {
    color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200",
    leftBar: "border-l-amber-500", dot: "bg-amber-500", label: "Warning",
  },
  low: {
    color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200",
    leftBar: "border-l-blue-500", dot: "bg-blue-500", label: "Info",
  },
  success: {
    color: "text-green-700", bg: "bg-green-50", border: "border-green-200",
    leftBar: "border-l-green-500", dot: "bg-green-500", label: "Success",
  },
};

const sortAlerts = (list) =>
  [...list].sort((a, b) => {
    const pa = SEVERITY_PRIORITY[a.severity] ?? 99;
    const pb = SEVERITY_PRIORITY[b.severity] ?? 99;
    if (pa !== pb) return pa - pb;
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });

const getWrapperRing = (alerts) => {
  if (alerts.some((a) => a.severity === "high"))
    return "ring-2 ring-red-300 shadow-xl shadow-red-100/60";
  if (alerts.some((a) => a.severity === "medium"))
    return "ring-2 ring-amber-300 shadow-xl shadow-amber-100/60";
  if (alerts.length > 0)
    return "ring-2 ring-blue-200 shadow-lg shadow-blue-50/60";
  return "ring-1 ring-slate-200 shadow-sm";
};

const SmartAlertsCard = () => {
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(() => {
    if (!token) { setLoading(false); return; }
    let cancelled = false;
    fetch(`${API_BASE_URL}/api/v1/alerts/`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (cancelled) return;
        setAlerts(sortAlerts((data || []).filter((a) => a.status !== "resolved")));
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    const cleanup = fetchAlerts();
    return cleanup;
  }, [fetchAlerts]);

  const handleMarkAllRead = () => setAlerts([]);

  const activeCount = alerts.length;
  const hasCritical = alerts.some((a) => a.severity === "high");

  return (
    <div className={`rounded-xl overflow-hidden flex flex-col bg-white transition-shadow duration-300 ${getWrapperRing(alerts)}`}>

      {/* ── Gradient Header ── */}
      <div className="relative px-4 pt-4 pb-3 flex-shrink-0">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-950 to-sky-700" />
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.7),transparent_60%)]" />

        <div className="relative">
          {/* Title row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-white/15 border border-white/25 flex items-center justify-center">
                  <BsBellFill className="text-white text-sm" />
                </div>
                {activeCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${hasCritical ? "bg-red-400" : "bg-amber-400"}`} />
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${hasCritical ? "bg-red-500" : "bg-amber-500"}`} />
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white leading-tight">
                  Smart Financial Alerts
                </h3>
                <p className="text-[10px] text-white/60 leading-none mt-0.5">
                  AI-powered monitoring
                </p>
              </div>
            </div>

            {!loading && activeCount > 0 && (
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                hasCritical
                  ? "bg-red-500/20 text-red-200 border-red-400/40"
                  : "bg-amber-500/20 text-amber-200 border-amber-400/40"
              }`}>
                {activeCount} Active
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate("/smart-financial-alerts")}
              className="flex-1 flex items-center justify-center gap-1 text-xs font-medium text-white/90 bg-white/10 border border-white/20 rounded-lg py-1.5 hover:bg-white/20 transition-colors"
            >
              View All <FiArrowRight size={11} />
            </button>
            <button
              onClick={handleMarkAllRead}
              disabled={activeCount === 0}
              className="flex-1 flex items-center justify-center gap-1 text-xs font-medium text-white/90 bg-white/10 border border-white/20 rounded-lg py-1.5 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <FiCheckSquare size={11} /> Mark Read
            </button>
            <button
              onClick={() => navigate("/smart-financial-alerts")}
              title="Alert Settings"
              className="w-8 h-8 flex items-center justify-center text-white/70 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition-colors"
            >
              <FiSettings size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Alert list ── */}
      <div className="overflow-y-auto p-3 space-y-2 bg-slate-50/60" style={{ maxHeight: "420px" }}>
        {loading ? (
          <div className="flex items-center justify-center h-28 text-xs text-slate-400">
            Loading…
          </div>
        ) : activeCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2.5 text-center px-3">
            <div className="w-11 h-11 rounded-full bg-green-50 border-2 border-green-100 flex items-center justify-center">
              <FiAlertCircle size={22} className="text-green-400" />
            </div>
            <p className="text-xs font-semibold text-slate-700">No active financial alerts</p>
            <p className="text-[11px] text-slate-400 leading-snug">
              All monitored metrics are within expected ranges.
            </p>
          </div>
        ) : (
          <>
            {alerts.slice(0, 5).map((a) => {
              const sev = severityConfig[a.severity] || severityConfig.low;
              const dateStr = a.created_at
                ? new Date(a.created_at).toLocaleString(undefined, {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                  })
                : null;
              return (
                <div
                  key={a.id}
                  onClick={() =>
                    navigate(`/smart-financial-alerts/insights/${a.id}`, {
                      state: { alertTitle: a.title, severity: a.severity },
                    })
                  }
                  className={`rounded-lg border border-l-4 ${sev.leftBar} ${sev.bg} ${sev.border} px-3 py-2.5 shadow-sm cursor-pointer hover:shadow-md transition-shadow`}
                >
                  <div className="flex items-start gap-2 mb-1">
                    <span className={`shrink-0 mt-0.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${sev.bg} ${sev.color} border ${sev.border}`}>
                      {sev.label}
                    </span>
                    <p className={`text-xs font-semibold leading-tight ${sev.color} flex-1 min-w-0`}>
                      {a.title}
                    </p>
                  </div>
                  {a.message && (
                    <p className="text-[11px] text-slate-600 leading-snug line-clamp-2 mb-1">
                      {a.message}
                    </p>
                  )}
                  {dateStr && <p className="text-[10px] text-slate-400">{dateStr}</p>}
                </div>
              );
            })}

            {alerts.length > 5 && (
              <button
                onClick={() => navigate("/smart-financial-alerts")}
                className="w-full text-center text-xs text-sky-600 font-medium py-2 hover:text-sky-800 transition-colors"
              >
                +{alerts.length - 5} more alerts →
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="px-4 py-2.5 border-t border-slate-100 bg-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-400">Updated just now</span>
          <button
            onClick={fetchAlerts}
            className="text-[10px] text-sky-600 font-medium hover:text-sky-800 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

export default SmartAlertsCard;
