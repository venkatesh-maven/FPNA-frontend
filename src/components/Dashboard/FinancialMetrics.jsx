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

// For these KPIs a decrease is the favourable direction (shown green).
const LOWER_IS_BETTER = new Set(["expenses"]);
// Direction carries no good/bad meaning — always shown neutral.
const NEUTRAL_KPIS = new Set(["headcount"]);

const KPICard = ({ title, displayValue, change, changePct, prevLabel, prevDetail, prevDisplay, prevLoading, note, icon, year }) => {
  const niceTitle = title.replace(/_/g, " ").replace(/([A-Z])/g, " $1");

  // changePct may be absent when callers pass only a change string (e.g. "+5%").
  const pct = Number.isFinite(changePct) ? changePct : parseFloat(String(change ?? "").replace(/[^\d.+-]/g, ""));
  const hasChange = change != null && change !== "" && Number.isFinite(pct);
  const direction = !hasChange || pct === 0 ? 0 : pct > 0 ? 1 : -1;
  const favourable = LOWER_IS_BETTER.has(title) ? direction < 0 : direction > 0;
  // `note` = a ready-made status line (e.g. "81.0% of FY forecast") with its own tone.
  const colorClass = note
    ? note.tone === "good"
      ? "text-green-500"
      : note.tone === "bad"
        ? "text-red-500"
        : "text-gray-500"
    : direction === 0 || NEUTRAL_KPIS.has(title)
      ? "text-gray-500"
      : favourable
        ? "text-green-500"
        : "text-red-500";
  const arrow = direction > 0 ? "↑" : direction < 0 ? "↓" : "";
  const periodLabel = prevLabel ? `vs ${prevLabel}` : "vs last period";

  const context =
    `KPI tile "${niceTitle}"${year ? ` for fiscal year ${year}` : ""}: ` +
    `current value = ${displayValue}, ` +
    (note
      ? `${note.text}${note.tooltip ? ` (${note.tooltip})` : ""}. `
      : hasChange
      ? `change = ${change} ${periodLabel}${prevDisplay ? ` (${prevDetail || prevLabel} value = ${prevDisplay})` : ""}. `
      : `no prior-period data available for comparison. `) +
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

          <div className={`flex items-center mt-2 ${colorClass}`}>
            {note ? (
              <span
                className="text-[10px] font-medium"
                {...(note.tooltip ? { "data-tooltip-id": "ai-tooltip", "data-tooltip-content": note.tooltip } : {})}
              >
                {note.text}
              </span>
            ) : hasChange ? (
              <span
                className="text-[10px] font-medium"
                {...(prevDisplay ? { "data-tooltip-id": "ai-tooltip", "data-tooltip-content": `${prevDetail || prevLabel}: ${prevDisplay}` } : {})}
              >
                {change} {arrow} {periodLabel}
              </span>
            ) : prevLoading ? (
              <span className="text-[10px] font-medium">comparing {periodLabel}…</span>
            ) : (
              <span className="text-[10px] font-medium">
                — no {prevLabel || "prior period"} data
              </span>
            )}
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
        const isMoney = ["revenue", "gross_profit", "expenses", "net_profit", "cash_flow"].includes(key);

        const formatValue = (v) =>
          isMoney && renderValue
            ? renderValue(v, currency, currencyFilter)
            : Number.isFinite(Number(v))
              ? Number(v).toLocaleString("en-US")
              : String(v ?? "—");

        const displayValue = formatValue(value.value);
        const prevDisplay = value.prevValue != null ? formatValue(value.prevValue) : null;

        return (
          <KPICard
            key={key}
            title={key}
            displayValue={displayValue}
            change={value.change}
            changePct={value.changePct}
            prevLabel={value.prevLabel}
            prevDetail={value.prevDetail}
            prevDisplay={prevDisplay}
            prevLoading={value.prevLoading}
            note={value.note}
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
