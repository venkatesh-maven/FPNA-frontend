import React from "react";
import { motion } from "framer-motion";
import { FiTrendingUp, FiDollarSign, FiUsers, FiPieChart } from "react-icons/fi";
import { Tooltip as ReactTooltip } from "react-tooltip";
import AppCard from "../ui/AppCard";
import WidgetAskAI from "./WidgetAskAI";

// Predefined questions per KPI metric key. Falls back to a generic set for
// any metric key that isn't explicitly listed (keeps this working even if
// the backend starts returning new KPI keys we don't know about yet).
const KPI_QUESTIONS = {
  revenue: [
    "What does this revenue value mean?",
    "Is revenue trending up or down vs last period?",
    "What could be driving this revenue change?",
    "Is this revenue performance healthy?",
  ],
  gross_profit: [
    "What does this gross profit value mean?",
    "How does gross profit compare to last period?",
    "What could improve gross profit?",
  ],
  expenses: [
    "What does this expenses value mean?",
    "Are expenses higher or lower than last period?",
    "What could be driving this expense change?",
  ],
  net_profit: [
    "What does this net profit value mean?",
    "Is net profit growing or shrinking vs last period?",
    "What could be impacting net profit?",
  ],
  cash_flow: [
    "What does this cash flow value mean?",
    "Is this cash flow level healthy?",
    "What could be affecting cash flow?",
  ],
  headcount: [
    "What does this headcount number mean?",
    "Has headcount grown or shrunk vs last period?",
    "What could be driving headcount changes?",
  ],
};
const DEFAULT_KPI_QUESTIONS = [
  "What does this value mean?",
  "How does this compare to last period?",
  "What could be driving this number?",
];

const KPICard = ({ title, displayValue, change, isPositive, icon, year }) => {
  const niceTitle = title.replace(/_/g, " ").replace(/([A-Z])/g, " $1");

  const context =
    `KPI tile "${niceTitle}"${year ? ` for fiscal year ${year}` : ""}: ` +
    `current value = ${displayValue}, change = ${change || "+0%"} vs last period. ` +
    `Use ONLY this as the source of truth.`;

  return (
    <AppCard
      as={motion.div}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      className="relative p-3"
    >
      <div className="flex justify-between items-start">
        <div className="w-full">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold text-sky-600 uppercase tracking-wider truncate">
              {niceTitle}
            </p>

            <div data-tooltip-id="ai-tooltip" data-tooltip-content="Ask AI">
              <WidgetAskAI
                title={niceTitle}
                context={context}
                questions={KPI_QUESTIONS[title] || DEFAULT_KPI_QUESTIONS}
              />
            </div>
          </div>

          {/* ✅ always formatted value (with symbol + K/M) */}
          <p className="text-s font-bold text-sky-900 mt-1">{displayValue}</p>

          <div className={`flex items-center mt-2 ${isPositive ? "text-green-500" : "text-red-500"}`}>
            <span className="text-[10px] font-medium">
              {change} {isPositive ? "↑" : "↓"} vs last period
            </span>
          </div>
        </div>

        <div className="rounded-full bg-sky-100 p-2 transition-colors duration-200 hover:bg-sky-200">
          <div className="text-sky-600 hover:text-sky-800 transition-colors duration-200">
            {icon}
          </div>
        </div>
      </div>

      <ReactTooltip id="ai-tooltip" place="top" effect="solid" />
    </AppCard>
  );
};

const FinancialMetrics = ({ kpiData, currency = "USD", currencyFilter = "actualvalue", renderValue, year }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6" data-pdf-keep>
      {Object.entries(kpiData).map(([key, value]) => {
        const isPositive = String(value.change || "").startsWith("+");

        const isMoney = ["revenue", "gross_profit", "expenses", "net_profit", "cash_flow"].includes(key);

        const displayValue = isMoney
          ? renderValue(value.value, currency, currencyFilter)
          : Number.isFinite(Number(value.value))
            ? Number(value.value).toLocaleString("en-US")
            : String(value.value ?? "—");

        return (
          <KPICard
            key={key}
            title={key}
            displayValue={displayValue}
            change={value.change}
            isPositive={isPositive}
            year={year}
            icon={
              key === "revenue" ? (
                <FiTrendingUp size={16} />
              ) : key === "gross_profit" || key === "expenses" || key === "net_profit" ? (
                <FiDollarSign size={16} />
              ) : key === "cash_flow" ? (
                <FiTrendingUp size={16} />
              ) : key === "headcount" ? (
                <FiUsers size={16} />
              ) : (
                <FiPieChart size={16} />
              )
            }
          />
        );
      })}
    </div>
  );
};

export default FinancialMetrics;
