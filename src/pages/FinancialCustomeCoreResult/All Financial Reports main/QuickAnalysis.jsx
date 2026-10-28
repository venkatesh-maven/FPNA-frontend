import React from "react";
import { FiTrendingUp, FiTrendingDown, FiAlertCircle, FiDollarSign } from "react-icons/fi";
import { getDecimalPrecision } from '../../../utils/formatters';

const QuickAnalysis = ({ filteredData, currentReport, selectedReport }) => {
  if (!filteredData.metrics) return null;

  return (
    <div className="bg-sky-50/50 p-4 rounded-lg border border-sky-200">
      <h3 className="text-s font-semibold text-sky-900 mb-3">
        {currentReport.title} Summary
      </h3>
      <div className="text-x text-sky-700 space-y-3">
        {selectedReport === "pnl" && (
          <>
            <div className="flex items-start">
              <div
                className={`p-2 rounded-full mr-3 ${
                  filteredData.metrics.overallVariance >= 0
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}>
                {filteredData.metrics.overallVariance >= 0 ? (
                  <FiTrendingUp size={16} />
                ) : (
                  <FiTrendingDown size={16} />
                )}
              </div>
              <div>
                <p className="font-medium">Total Period Performance</p>
                <p className="text-black">
                  {filteredData.metrics.overallVariance >= 0
                    ? "Surplus"
                    : "Deficit"}{" "}
                  of $
                  {Math.abs(
                    filteredData.metrics.overallVariance,
                  ).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}{" "}
                  ({filteredData.metrics.overallVariancePercentage}%) compared to
                  budget
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="p-2 rounded-full mr-3 bg-green-100 text-green-700">
                <FiTrendingUp size={16} />
              </div>
              <div>
                <p className="font-medium">Best Performing Month</p>
                <p className="text-black">
                  {filteredData.metrics.bestMonth} with $
                  {filteredData.tableData
                    .find((m) => m.month === filteredData.metrics.bestMonth)
                    ?.ActualProfit?.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }) || "N/A"}{" "}
                  profit
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="p-2 rounded-full mr-3 bg-red-100 text-red-700">
                <FiTrendingDown size={16} />
              </div>
              <div>
                <p className="font-medium">Worst Performing Month</p>
                <p className="text-black">
                  {filteredData.metrics.worstMonth} with $
                  {filteredData.tableData
                    .find((m) => m.month === filteredData.metrics.worstMonth)
                    ?.ActualProfit?.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }) || "N/A"}{" "}
                  profit
                </p>
              </div>
            </div>
          </>
        )}
        {selectedReport === "balanceSheet" && (
          <>
            <div className="flex items-start">
              <div className="p-2 rounded-full mr-3 bg-green-100 text-green-700">
                <FiTrendingUp size={16} />
              </div>
              <div>
                <p className="font-medium">Assets Growth</p>
                <p className="text-black">
                  Total assets increased by {filteredData.metrics.assetGrowth}%
                  compared to previous period
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="p-2 rounded-full mr-3 bg-blue-100 text-blue-700">
                <FiAlertCircle size={16} />
              </div>
              <div>
                <p className="font-medium">Financial Health</p>
                <p className="text-black">
                  Current ratio of {filteredData.metrics.currentRatio} indicates
                  strong liquidity position
                </p>
              </div>
            </div>
          </>
        )}
        {selectedReport === "cashFlow" && (
          <>
            <div className="flex items-start">
              <div className="p-2 rounded-full mr-3 bg-green-100 text-green-700">
                <FiTrendingUp size={16} />
              </div>
              <div>
                <p className="font-medium">Operational Cash Flow</p>
                <p className="text-black">
                  Positive operational cash flow of $
                  {filteredData.metrics.operationalTotal.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="p-2 rounded-full mr-3 bg-blue-100 text-blue-700">
                <FiDollarSign size={16} />
              </div>
              <div>
                <p className="font-medium">Investing Activities</p>
                <p className="text-black">
                  Net investing outflow of $
                  {Math.abs(filteredData.metrics.investingTotal).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
                </p>
              </div>
            </div>
          </>
        )}
        {selectedReport === "arAging" && (
          <>
            <div className="flex items-start">
              <div className="p-2 rounded-full mr-3 bg-blue-100 text-blue-700">
                <FiAlertCircle size={16} />
              </div>
              <div>
                <p className="font-medium">Receivables Overview</p>
                <p className="text-black">
                  {filteredData.metrics.overduePercentage}% of receivables are
                  overdue (${filteredData.metrics.overdue.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })})
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="p-2 rounded-full mr-3 bg-green-100 text-green-700">
                <FiTrendingUp size={16} />
              </div>
              <div>
                <p className="font-medium">Collection Efficiency</p>
                <p className="text-black">
                  Average days outstanding: {filteredData.metrics.averageDaysOutstanding} days
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default QuickAnalysis;