import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FiTrendingUp, 
  FiTrendingDown, 
  FiAlertCircle, 
  FiChevronLeft, 
  FiChevronRight,
  FiDollarSign,
  FiPercent
} from "react-icons/fi";
import { getDecimalPrecision } from '../../utils/formatters';

export default function ReportMetrics({ metrics, selectedReport }) {
  const [activeInsight, setActiveInsight] = useState(0);

  if (!metrics) return null;

  const formatMoney = (v) => `$${Math.abs(v || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`;
  const formatPercent = (v) => `${Number(v || 0).toFixed(getDecimalPrecision())}%`;

  // Generate metric rows dynamically with enhanced styling
  const getDynamicMetrics = () => {
    if (!selectedReport || !["pnl", "cashFlow"].includes(selectedReport)) {
      return (
        <div className="text-center py-6">
          <div className="text-gray-400 mb-2">
            <FiDollarSign className="inline-block text-2xl mb-1" />
          </div>
          <p className="text-s text-gray-500">
            Select P&L or Cash Flow report to view key metrics
          </p>
        </div>
      );
    }

    const metricConfig = {
      pnl: [
        {
          key: 'totalActualProfit',
          label: 'Total Actual Profit',
          icon: '💰',
          prefix: '$',
          isCurrency: true
        },
        {
          key: 'overallVariance',
          label: 'Overall Variance',
          icon: '📊',
          prefix: '$',
          suffix: (metrics.overallVariancePercentage || 0) + '%',
          isCurrency: true
        },
        {
          key: 'bestMonthProfit',
          label: 'Best Month',
          icon: '🏆',
          prefix: metrics.bestMonth + ' - ',
          suffix: '$',
          positive: true,
          isCurrency: true
        },
        {
          key: 'worstMonthProfit',
          label: 'Worst Month',
          icon: '⚠️',
          prefix: metrics.worstMonth + ' - ',
          suffix: '$',
          positive: false,
          isCurrency: true
        }
      ],
      cashFlow: [
        {
          key: 'totalOperatingCF',
          label: 'Operating Cash Flow',
          icon: '💼',
          prefix: '$',
          isCurrency: true
        },
        {
          key: 'totalNetCashFlow',
          label: 'Net Cash Flow',
          icon: '📈',
          prefix: '$',
          isCurrency: true
        },
        {
          key: 'operatingPositiveMonths',
          label: 'Positive Cash Flow Months',
          icon: '✅',
          suffix: ' (' + (metrics.operatingCFPercentage || 0) + '%)'
        },
        {
          key: 'bestMonthCF',
          label: 'Best Operating CF Month',
          icon: '⭐',
          prefix: metrics.bestMonth + ' - ',
          suffix: '$',
          positive: true,
          isCurrency: true
        }
      ]
    };

    return metricConfig[selectedReport]?.map((config, index) => {
      const value = metrics[config.key];
      const isPositive = config.positive !== undefined ? config.positive : value >= 0;
      const colorClass = isPositive ? 'text-emerald-600' : 'text-rose-600';
      const bgColorClass = isPositive ? 'bg-emerald-50' : 'bg-rose-50';
      
      return (
        <motion.div
          key={config.key}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className="flex justify-between items-center p-3 rounded-lg hover:bg-gray-50 transition-colors duration-200"
        >
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${bgColorClass}`}>
              <span className="text-lg">{config.icon}</span>
            </div>
            <div>
              <span className="text-s font-medium text-gray-700">{config.label}</span>
              <div className="text-x text-gray-400 mt-1">
                {selectedReport === 'pnl' && config.key.includes('Month') ? 'Monthly Performance' : 'Annual Performance'}
              </div>
            </div>
          </div>
          
          <div className={`text-right ${colorClass}`}>
            <div className="flex items-center justify-end space-x-1">
              <span className="text-lg font-bold">
                {config.prefix && !config.isCurrency && config.prefix}
                {config.isCurrency ? formatMoney(value) : value}
                {config.suffix && config.suffix}
              </span>
              {config.isCurrency && (
                <div className={`p-1 rounded-full ${isPositive ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                  {isPositive ? (
                    <FiTrendingUp className="w-4 h-4" />
                  ) : (
                    <FiTrendingDown className="w-4 h-4" />
                  )}
                </div>
              )}
            </div>
            {config.key === 'overallVariance' && (
              <div className={`text-x mt-1 ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                {isPositive ? 'Above target' : 'Below target'}
              </div>
            )}
          </div>
        </motion.div>
      );
    });
  };

  // Insight navigation
  const nextInsight = () => {
    if (!metrics.insights) return;
    setActiveInsight((prev) => (prev + 1) % metrics.insights.length);
  };
  
  const prevInsight = () => {
    if (!metrics.insights) return;
    setActiveInsight((prev) => (prev - 1 + metrics.insights.length) % metrics.insights.length);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-800">Key Metrics</h3>
          <p className="text-s text-gray-500 mt-1">
            {selectedReport === 'pnl' && 'Profit & Loss Performance'}
            {selectedReport === 'cashFlow' && 'Cash Flow Analysis'}
            {!selectedReport && 'Select a report to view metrics'}
          </p>
        </div>
        <div className="p-2 bg-gradient-to-r from-blue-50 to-sky-50 rounded-lg">
          <FiDollarSign className="w-5 h-5 text-sky-600" />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="space-y-2 mb-6">
        {getDynamicMetrics()}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100 my-6"></div>

      {/* Performance Insights */}
      {metrics.insights && metrics.insights.length > 0 && (
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-amber-50 rounded-lg">
                <FiAlertCircle className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h4 className="text-s font-semibold text-gray-800">Performance Insights</h4>
                <p className="text-x text-gray-500">Actionable recommendations</p>
              </div>
            </div>
            
            {metrics.insights.length > 1 && (
              <div className="flex items-center space-x-2">
                <span className="text-x text-gray-500">
                  {activeInsight + 1} of {metrics.insights.length}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={prevInsight}
                    className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <FiChevronLeft className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={nextInsight}
                    className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <FiChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeInsight}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="bg-gradient-to-r from-sky-50 to-blue-50 p-4 rounded-xl border border-blue-100"
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                </div>
                <p className="text-s text-gray-700 leading-relaxed">
                  {metrics.insights[activeInsight]}
                </p>
              </div>
              
              {metrics.insights.length > 1 && (
                <div className="flex justify-center space-x-1 mt-4">
                  {metrics.insights.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setActiveInsight(index)}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${
                        index === activeInsight 
                          ? 'bg-blue-500 w-4' 
                          : 'bg-blue-200'
                      }`}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}