// src/pages/FinancialReports/pnl/PnLKeyMetrics.jsx
import React, { useEffect, useState } from "react";
import {
  FiTrendingUp,
  FiTrendingDown,
  FiAlertCircle,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { getDecimalPrecision } from '../../../utils/formatters';

export default function PnLKeyMetrics({ metrics }) {
  const insights = metrics?.insights || [];
  const [active, setActive] = useState(0);

  /* Rotate insights automatically */
  useEffect(() => {
    if (!insights.length) return;
    const t = setInterval(
      () => setActive((p) => (p + 1) % insights.length),
      3500
    );
    return () => clearInterval(t);
  }, [insights]);

  if (!metrics) return null;

  const Row = ({ label, value, positive }) => (
    <div className="flex justify-between items-center text-s">
      <span>{label}</span>
      <span
        className={`font-medium flex items-center gap-1 ${
          positive ? "text-green-600" : "text-red-600"
        }`}
      >
        {value}
        {positive ? <FiTrendingUp /> : <FiTrendingDown />}
      </span>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      {/* LEFT : KEY METRICS */}
      <div>
        <h3 className="text-s font-semibold text-sky-900 mb-3">
          Key Metrics
        </h3>

        <div className="space-y-2">
          <Row
            label="Total Actual Profit"
            value={`$${metrics.totalActualProfit?.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`}
            positive={metrics.totalActualProfit >= 0}
          />
          <Row
            label="Total Budget Profit"
            value={`$${metrics.totalBudgetProfit?.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`}
            positive={metrics.totalBudgetProfit >= 0}
          />
          <Row
            label="Overall Variance"
            value={`$${Math.abs(metrics.overallVariance)?.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`}
            positive={metrics.overallVariance >= 0}
          />
          <Row
            label="Overall Variance %"
            value={`${metrics.overallVariancePercentage}%`}
            positive={metrics.overallVariancePercentage >= 0}
          />

          <div className="flex justify-between text-s">
            <span>Best Month</span>
            <span className="font-medium text-sky-800">
              {metrics.bestMonth}
            </span>
          </div>

          <div className="flex justify-between text-s">
            <span>Worst Month</span>
            <span className="font-medium text-sky-800">
              {metrics.worstMonth}
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT : SUMMARY CARD */}
      <div className="border border-sky-200 rounded-xl p-4 bg-sky-50">
        <h3 className="text-s font-semibold text-sky-900 mb-3">
          Profit & Loss Statement Summary
        </h3>

        <div className="space-y-3 text-s">
          <div className="flex gap-3">
            <span className="p-2 rounded-full bg-red-100 text-red-600">
              <FiTrendingDown />
            </span>
            <div>
              <p className="font-medium">Total Period Performance</p>
              <p>
                Deficit of ${Math.abs(metrics.overallVariance).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} (
                {metrics.overallVariancePercentage}%)
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="p-2 rounded-full bg-green-100 text-green-600">
              <FiTrendingUp />
            </span>
            <div>
              <p className="font-medium">Best Performing Month</p>
              <p>
                {metrics.bestMonth} with $
                {metrics.bestMonthProfit?.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} profit
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="p-2 rounded-full bg-red-100 text-red-600">
              <FiTrendingDown />
            </span>
            <div>
              <p className="font-medium">Worst Performing Month</p>
              <p>
                {metrics.worstMonth} with $
                {metrics.worstMonthProfit?.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} profit
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* PERFORMANCE INSIGHTS */}
      {insights.length > 0 && (
        <div className="lg:col-span-2 mt-4">
          <h4 className="text-x font-semibold text-sky-900 mb-2 flex items-center gap-1">
            <FiAlertCircle /> Performance Insights
          </h4>

          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="bg-sky-100 border border-sky-200 p-3 rounded-lg text-s"
            >
              {insights[active]}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
