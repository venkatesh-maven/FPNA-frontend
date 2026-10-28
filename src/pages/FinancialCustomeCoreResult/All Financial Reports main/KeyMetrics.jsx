import React from "react";
// import { motion, AnimatePresence } from "framer-motion";
import { FiAlertCircle, FiTrendingUp, FiTrendingDown } from "react-icons/fi";
import { getDecimalPrecision } from '../../../utils/formatters';

const KeyMetrics = ({ filteredData, activeInsight,  }) => {
  if (!filteredData.metrics) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-s font-semibold text-sky-900 mb-2">Key Metrics</h3>
      <ul className="text-s text-black space-y-2">
        {Object.entries(filteredData.metrics).map(([key, val]) => {
          if (key === "insights") return null;

          const isNegative =
            typeof val === "number" &&
            (key.toLowerCase().includes("variance") ||
              key.toLowerCase().includes("deficit") ||
              key.toLowerCase().includes("loss")) &&
            val < 0;
          const isPositive =
            typeof val === "number" &&
            (key.toLowerCase().includes("variance") ||
              key.toLowerCase().includes("surplus") ||
              key.toLowerCase().includes("profit")) &&
            val > 0;
          const isCurrency =
            typeof val === "number" &&
            !key.toLowerCase().includes("percentage") &&
            !key.toLowerCase().includes("ratio") &&
            !key.toLowerCase().includes("rate");

          return (
            <li key={key} className="flex justify-between items-center">
              <span className="capitalize">
                {key
                  .replace(/([A-Z])/g, " $1")
                  .replace(/^./, (str) => str.toUpperCase())}
                :
              </span>
              <span
                className={`font-medium ${
                  isNegative
                    ? "text-red-600"
                    : isPositive
                    ? "text-green-600"
                    : "text-sky-800"
                }`}>
                {isCurrency
                  ? `$${Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`
                  : typeof val === "number"
                  ? `${val.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}${
                      key.toLowerCase().includes("percentage") ||
                      key.toLowerCase().includes("margin") ||
                      key.toLowerCase().includes("rate")
                        ? "%"
                        : ""
                    }`
                  : val}
                {isNegative && <FiTrendingDown className="inline ml-1" />}
                {isPositive && <FiTrendingUp className="inline ml-1" />}
              </span>
            </li>
          );
        })}
      </ul>

      {filteredData.metrics.insights && (
        <div className="mt-4">
          <h4 className="text-x font-semibold text-sky-900 mb-2 flex items-center">
            <FiAlertCircle className="mr-1" /> Performance Insights
          </h4>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeInsight}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="text-x bg-sky-100 p-3 rounded-lg border border-sky-200">
              {filteredData.metrics.insights[activeInsight]}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default KeyMetrics;