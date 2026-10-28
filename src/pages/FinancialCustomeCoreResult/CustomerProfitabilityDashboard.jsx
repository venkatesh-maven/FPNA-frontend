import React, { useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config/config";
import {
  FiFilter,
  FiDownload,
  FiPrinter,
  FiTrendingUp,
  FiTrendingDown,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { CSVLink } from "react-csv";
import AskAI from "../FinancialReports/AskAI";
import AddAutomation from "../FinancialReports/AddAutomation";
import ActionHoverLabel from "../FinancialReports/ActionHoverLabel";
import ViewMoreHeader, { VIEW_MORE_FILTER_BAR, VIEW_MORE_HEADER_BUTTON } from "./ViewMoreHeader";
import TableSkeleton from "../Skeleton/TableSkeleton";
import { getDecimalPrecision } from '../../utils/formatters';

/* ================= CONSTANTS ================= */

// periods from docs: all, current_month, last_month, quarter_to_date, year_to_date [file:32]
const TIME_FILTERS = [
  { id: "all", label: "All Periods" },
  { id: "current_month", label: "Current Month" },
  { id: "last_month", label: "Last Month" },
  { id: "quarter_to_date", label: "Quarter to Date" },
  { id: "year_to_date", label: "Year to Date" },
];

// currency_filter: thousands, millions, actualvalue (default). [file:32]
const CURRENCY_FILTERS = [
  { id: "actualvalue", label: "Actual" },
  { id: "thousands", label: "Thousands" },
  { id: "millions", label: "Millions" },
];

// table columns based on Customers items. [file:32]
const TABLE_COLUMNS = [
  "customer_id",
  "customer_name",
  "industry",
  "region",
  "segment",
  "period",
  "revenue",
  "cost",
  "profit",
  "margin_pct",
  "rank",
];

/* ================= HELPERS ================= */

const getTimeLabel = (id) =>
  TIME_FILTERS.find((t) => t.id === id)?.label || id;

const getCurrencyFilterLabel = (id) =>
  CURRENCY_FILTERS.find((c) => c.id === id)?.label || "Actual";

const safeMetric = (v) =>
  v === null || v === undefined || v === "" ? "--" : v;

// Simple USD-style formatter; adjust to selectedCurrency if needed. [web:35][web:36]
const formatCurrency = (value, isPercent = false) => {
  if (value === null || value === undefined || value === "") return "--";

  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return String(value);

  if (isPercent) {
    return `${num.toFixed(getDecimalPrecision())}%`;
  }

  return `$${num.toLocaleString("en-US", {
    minimumFractionDigits: getDecimalPrecision(),
    maximumFractionDigits: getDecimalPrecision(),
  })}`;
};

/* ================= COMPONENT ================= */

export default function CustomerProfitabilityDashboard() {
  const { token, selectedYear: year, selectedCurrency } = useContext(AuthContext);

  const [rows, setRows] = useState([]);
  const [metrics, setMetrics] = useState(null);

  const [industries, setIndustries] = useState(["All"]);
  const [regions, setRegions] = useState(["All"]);
  const [segments, setSegments] = useState(["All"]);

 const [filters, setFilters] = useState({
  period: "all",
  currency_filter: "actualvalue",
});


  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /* ================= ACTIVE FILTER CHIPS ================= */

 const activeTags = [
  filters.period !== "all" ? getTimeLabel(filters.period) : null,
  filters.currency_filter !== "actualvalue"
    ? getCurrencyFilterLabel(filters.currency_filter)
    : null,
].filter(Boolean);


 const removeFilter = (tag) => {
  setFilters((prev) => {
    if (getTimeLabel(prev.period) === tag) {
      return { ...prev, period: "all" };
    }
    if (getCurrencyFilterLabel(prev.currency_filter) === tag) {
      return { ...prev, currency_filter: "actualvalue" };
    }
    return prev;
  });
};


  /* ================= FILTER POPUP ================= */

  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) =>
      ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  /* ================= FETCH ================= */

  useEffect(() => {
    if (!token || !year || !selectedCurrency) return;

    const fetchReport = async () => {
      setLoading(true);
      setError(null);

      try {
       const params = new URLSearchParams();
params.append("period", filters.period);
params.append("currency_filter", filters.currency_filter);

const url = `${API_BASE_URL}/api/v1/company/financial/financials/customer-profitability_viewmore/${year}/${selectedCurrency}?${params.toString()}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("API error");

        const data = await res.json();
        processResponse(data);
      } catch (e) {
        console.error(e);
        setError("Failed to load customer profitability");
        setRows([]);
        setMetrics(null);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [token, year, selectedCurrency, filters]);

  /* ================= PROCESS RESPONSE ================= */

const processResponse = (apiData) => {
  const revenueRows = Array.isArray(apiData?.revenue)
    ? apiData.revenue
    : [];

  setRows(revenueRows);

  // metrics only if data exists
  if (revenueRows.length > 0) {
    setMetrics({
      total_revenue: apiData.revenue_grand_total?.Total,
      total_profit: apiData.profit?.Total,
      average_margin_pct: apiData.margin?.Total,
      top_customer: null,
    });
  } else {
    setMetrics(null);
  }
};



  /* ================= CSV ================= */

  const csvData = [
    TABLE_COLUMNS.map((c) => c.toUpperCase()),
    ...rows.map((r) =>
      TABLE_COLUMNS.map((c) => {
        const v = r[c];
        return v === null || v === undefined ? "" : v;
      })
    ),
  ];

  /* ================= GROUP (optional) ================= */

  const groupedRows = rows.reduce((acc, r) => {
    const key = r.industry || "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  /* ================= UI ================= */

  return (
    <main className="bg-slate-50 min-h-screen space-y-3">
      <ViewMoreHeader title="Customer Profitability" year={year} currency={selectedCurrency}>
        <CSVLink
          data={csvData}
          filename={`Customer_Profitability_${year}.csv`}
          aria-label="Download CSV"
          className={VIEW_MORE_HEADER_BUTTON}
        >
          <FiDownload />
          <ActionHoverLabel>Download CSV</ActionHoverLabel>
        </CSVLink>
        <AddAutomation reportType="customer_profitability" reportLabel="Customer Profitability Report" iconOnly />
        <button onClick={() => window.print()} aria-label="Print" className={VIEW_MORE_HEADER_BUTTON}>
          <FiPrinter />
          <ActionHoverLabel>Print</ActionHoverLabel>
        </button>
        <AskAI reportId="customer_profit" />
      </ViewMoreHeader>

      {/* FILTER BAR */}
      <div className={`${VIEW_MORE_FILTER_BAR} sticky top-0 z-20`} ref={ref}>
        <div className="flex gap-2 mr-auto">
          {activeTags.map((t) => (
            <span
              key={t}
              className="flex items-center gap-2 px-3 py-1 text-x rounded-full bg-sky-800 text-white"
            >
              {t}
              <button onClick={() => removeFilter(t)}>×</button>
            </span>
          ))}
        </div>

        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 px-2.5 py-1.5 text-x font-semibold bg-sky-100 text-sky-800 rounded-lg hover:bg-sky-200"
          >
            <FiFilter size={14} /> Filters
          </button>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute right-0 mt-2 w-72 bg-sky-50 border rounded-xl shadow-lg z-50"
              >
            <div className="p-4 space-y-3 text-x">
  <Select
    label="Period"
    value={filters.period}
    options={TIME_FILTERS.map((t) => t.id)}
    displayMap={getTimeLabel}
    onChange={(v) =>
      setFilters((f) => ({ ...f, period: v }))
    }
  />

  <Select
    label="Currency Display"
    value={filters.currency_filter}
    options={CURRENCY_FILTERS.map((c) => c.id)}
    displayMap={getCurrencyFilterLabel}
    onChange={(v) =>
      setFilters((f) => ({ ...f, currency_filter: v }))
    }
  />
</div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* METRICS */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric
            label="Total Revenue"
            value={formatCurrency(metrics.total_revenue)}
          />
          <Metric
            label="Total Profit"
            value={formatCurrency(metrics.total_profit)}
          />
          <Metric
            label="Avg Margin %"
            value={formatCurrency(metrics.average_margin_pct, true)}
          />
          <Metric
            label="Top Customer"
            value={safeMetric(
              metrics.top_customer && metrics.top_customer.name
            )}
          />
        </div>
      )}

      {/* TABLE */}
      {loading && <TableSkeleton />}
      {error && <p className="text-red-600 text-s">{error}</p>}

      {!loading && (
        <div className="overflow-auto max-h-[420px] border rounded-lg bg-white">
    <table className="w-full text-x overfls">
      {/* thead stays SAME */}
      <thead className="sticky top-0 bg-sky-900 text-white">
  <tr>
    <th className="px-2 py-2">Account</th>

    {Object.keys(rows[0] || {})
      .filter((k) => /^\d{4}-\d{2}$/.test(k))
      .map((month) => (
        <th key={month} className="px-3 py-2 text-right">
          {month}
        </th>
      ))}

    <th className="px-3 py-2 text-right">Total</th>
    <th className="px-3 py-2 min-w-[280px] bg-sky-900 text-white">
      AI INSIGHT
    </th>
  </tr>
</thead>

      <tbody>
        {rows.length === 0 ? (
          <tr>
            <div
              colSpan={
                2 +
                Object.keys(rows[0] || {}).filter((k) =>
                  /^\d{4}-\d{2}$/.test(k)
                ).length
              }
              className="text-center py-10 text-sky-500  flex justify-center items-center italic"
            >
              No customer profitability data available for the selected period
            </div>
          </tr>
        ) : (
          rows.map((r, i) => {
            const aiInsights =
              Array.isArray(r.aiDriver) && r.aiDriver.length > 0
                ? r.aiDriver
                : DEFAULT_AI_DRIVER;

            const monthKeys = Object.keys(r).filter((k) =>
              /^\d{4}-\d{2}$/.test(k)
            );

            return (
              <tr
                key={i}
                className="border-b border-sky-200 hover:bg-sky-100 align-top"
              >
                <td className="px-3 py-2 font-medium font-semibold text-sky-800">
                  {r.account_name}
                </td>

                {monthKeys.map((m) => (
                  <td key={m} className="px-3 py-2 text-right text-sky-800">
                    {formatCurrency(r[m])}
                  </td>
                ))}

                <td className="px-3 py-2 text-right font-semibold text-sky-800">
                  {formatCurrency(r.Total)}
                </td>

                <td className="px-3 py-2 bg-sky-100 border-l border-sky-300 text-sky-800">
                  <AIDriverTicker insights={aiInsights} />
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  </div>
)}


      
    </main>
  );
}

/* ================= SMALL COMPONENTS ================= */

const Select = ({ label, value, options, onChange, displayMap }) => (
  <div>
    <label className="block mb-1 text-sky-700">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border rounded p-2"
    >
      {options.map((o) => (
        <option key={String(o)} value={o}>
          {displayMap ? displayMap(o) : o}
        </option>
      ))}
    </select>
  </div>
);

const Metric = ({ label, value }) => {
  const isNegative =
    typeof value === "number"
      ? value < 0
      : typeof value === "string" && value.trim().startsWith("-");

  return (
<div className="p-4 rounded-lg border border-sky-300 bg-gradient-to-br from-sky-900 via-sky-700 to-sky-700 text-white">
      <div className="flex items-center gap-2">
        {isNegative ? <FiTrendingDown /> : <FiTrendingUp />}
<span className="font-medium text-sky-100">{label}</span>
      </div>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
};



/* ================= AI DRIVER TICKER ================= */

const DEFAULT_AI_DRIVER = [
  "AI-powered insights coming soon",
  "AI enhances efficiency through automated financial analysis",
];

const AIDriverTicker = ({ insights = DEFAULT_AI_DRIVER }) => {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (!insights || insights.length === 0) return;

    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % insights.length);
    }, 3000);

    return () => clearInterval(timer);
  }, [insights]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.3 }}
        className=" text-[11p] italic text-sky-800 leading-snug w-full
"
      >
        {insights[index]}
      </motion.div>
    </AnimatePresence>
  );
};
