import React, { useContext, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AuthContext } from "../../context/AuthContext";
import AddAutomation from "../FinancialReports/AddAutomation";
import ViewMoreHeader, { VIEW_MORE_FILTER_BAR, ViewMoreSelect } from "./ViewMoreHeader";
import { API_BASE_URL } from "../../config/config";
import TableSkeleton from "../Skeleton/TableSkeleton";
import { getDecimalPrecision } from '../../utils/formatters';

/* ================= UTILS ================= */
const safeNum = (v) => {
  const cleaned = typeof v === "string" ? v.replace(/,/g, "") : v;
  const n = Number(cleaned || 0);
  return Number.isFinite(n) ? n : 0;
};

const money = (v, c) => {
  const dp = getDecimalPrecision();
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: c || "USD",
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(safeNum(v));
};

/* ================= CONSTANTS ================= */
const PERIOD_OPTIONS = [
  { value: "all",             label: "All Periods"     },
  { value: "current_month",   label: "Current Month"   },
  { value: "last_month",      label: "Last Month"      },
  { value: "quarter_to_date", label: "Quarter to Date" },
  { value: "year_to_date",    label: "Year to Date"    },
];

const CURRENCY_OPTIONS = [
  { value: "actualvalue", label: "Actual Value" },
  { value: "thousands",   label: "Thousands"    },
  { value: "millions",    label: "Millions"     },
];

/* ================= MAIN ================= */
export default function ProjectCostingReportDashboard() {
  const { token, selectedYear, selectedCurrency } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [apiData, setApiData] = useState(null);

  const [period,         setPeriod]         = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("actualvalue");
  const [projectFilter,  setProjectFilter]  = useState("All");
  const [projectOptions, setProjectOptions] = useState(["All"]);

  /* ================= FETCH ================= */
  useEffect(() => {
    if (!token || !selectedYear || !selectedCurrency) return;
    const controller = new AbortController();

    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.append("currency_filter", currencyFilter);
        if (period !== "all")        params.append("period", period);
        if (projectFilter !== "All") params.append("project_name", projectFilter);

        const res = await fetch(
          `${API_BASE_URL}/api/v1/company/financial/Project_Costing_viewmore/${selectedYear}/${selectedCurrency}?${params}`,
          { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }
        );
        const json = await res.json();
        setApiData(json);

        const names = [
          "All",
          ...Array.from(new Set(
            (json?.data || [])
              .filter((r) => r.type === "actual" && r.project_name !== "total")
              .map((r) => r.project_name)
              .filter(Boolean)
          )),
        ];
        setProjectOptions(names);
      } catch (e) {
        if (e.name !== "AbortError") console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    return () => controller.abort();
  }, [token, selectedYear, selectedCurrency, period, currencyFilter, projectFilter]);

  /* ================= DERIVED DATA ================= */
  const months = useMemo(() => apiData?.months || [], [apiData]);

  const { actualRows, budgetRows, actualTotal, budgetTotal } = useMemo(() => {
    const data = apiData?.data || [];
    // Backend sets type="total" for BOTH grand-total rows (not "budget"/"actual").
    // Data order is: [...budget rows, budget grand-total, ...actual rows, actual grand-total]
    // So totals[0] = budget total, totals[1] = actual total.
    const totals = data.filter((r) => r.type === "total");
    return {
      budgetRows:  data.filter((r) => r.type === "budget"),
      actualRows:  data.filter((r) => r.type === "actual"),
      budgetTotal: totals[0] ?? null,
      actualTotal: totals[1] ?? null,
    };
  }, [apiData]);

  const totalActual   = safeNum(actualTotal?.total);
  const totalBudget   = safeNum(budgetTotal?.total);
  const totalVariance = totalActual - totalBudget;

  /* ================= UI ================= */
  return (
    <main className="bg-slate-50 min-h-screen space-y-3">

      <ViewMoreHeader title="Project Costing" year={selectedYear} currency={selectedCurrency}>
        <AddAutomation reportType="project_costing" reportLabel="Project Costing Report" iconOnly />
      </ViewMoreHeader>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MetricCard title="Total Actual"    value={totalActual}   currency={selectedCurrency} />
        <MetricCard title="Total Budget"    value={totalBudget}   currency={selectedCurrency} />
        <MetricCard
          title="Overall Variance"
          value={totalVariance}
          currency={selectedCurrency}
          highlight={totalVariance < 0 ? "red" : "green"}
        />
      </div>

      {/* FILTER BAR */}
      <div className={VIEW_MORE_FILTER_BAR}>
        <div className="flex flex-wrap justify-end items-center gap-2 ml-auto">
          <FilterSelect label="Period"     value={period}         onChange={setPeriod}         options={PERIOD_OPTIONS} />
          <FilterSelect label="Project"    value={projectFilter}  onChange={setProjectFilter}  options={projectOptions.map((p) => ({ value: p, label: p }))} />
          <FilterSelect label="Value"      value={currencyFilter} onChange={setCurrencyFilter} options={CURRENCY_OPTIONS} />
        </div>
      </div>

      {loading && <TableSkeleton />}

      {!loading && !apiData && (
        <div className="text-center py-16 text-slate-400 text-s">No project costing data available.</div>
      )}

      {/* ACTUAL COSTS TABLE */}
      {!loading && apiData && (
        <ProjectTable
          title="Actual Costs"
          headerColor="from-sky-900 to-sky-800"
          rows={actualRows}
          totalRow={actualTotal}
          months={months}
          currency={selectedCurrency}
        />
      )}

      {/* BUDGET TABLE */}
      {!loading && apiData && (
        <ProjectTable
          title="Budget"
          headerColor="from-sky-700 to-sky-600"
          rows={budgetRows}
          totalRow={budgetTotal}
          months={months}
          currency={selectedCurrency}
        />
      )}
    </main>
  );
}

/* ================= FILTER SELECT ================= */
// Options may be plain strings or { value, label }.
const FilterSelect = ({ options, ...props }) => (
  <ViewMoreSelect
    {...props}
    options={options.map((o) => (o && typeof o === "object" ? o : { value: o, label: o }))}
  />
);

/* ================= METRIC CARD ================= */
const MetricCard = ({ title, value, currency, highlight }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className="bg-gradient-to-br from-sky-900 to-sky-700 text-white p-4 rounded-xl shadow"
  >
    <p className="text-s opacity-80 mb-1">{title}</p>
    <h2 className={`text-xl font-bold ${
      highlight === "red" ? "text-red-300" : highlight === "green" ? "text-green-300" : "text-white"
    }`}>
      {money(value, currency)}
    </h2>
    <p className="text-x opacity-60 mt-1">Year to date</p>
  </motion.div>
);

/* ================= PROJECT TABLE ================= */
const ProjectTable = ({ title, headerColor, rows, totalRow, months, currency }) => (
  <div className="bg-white rounded-xl border border-sky-200 shadow-sm overflow-hidden">

    {/* Title bar */}
    <div className={`bg-gradient-to-r ${headerColor} text-white px-5 py-3`}>
      <h3 className="font-semibold text-s tracking-wide">{title}</h3>
    </div>

    {rows.length === 0 ? (
      <div className="py-10 text-center text-slate-400 text-x">No data available.</div>
    ) : (
      <div className="overflow-x-auto">
        <table
          className="w-full text-x"
          style={{ minWidth: `${240 + months.length * 140}px` }}
        >
          <thead className="bg-sky-800 text-white">
            <tr>
              <th className="px-4 py-3 text-left font-semibold sticky left-0 bg-sky-800 whitespace-nowrap">
                Project
              </th>
              {months.map((m) => (
                <th key={m} className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                  {m}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-semibold whitespace-nowrap bg-sky-950">
                Total
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                className="border-b border-sky-50 hover:bg-sky-50 transition-colors"
              >
                <td className="px-4 py-2.5 font-medium text-sky-800 sticky left-0 bg-white border-r border-sky-100 whitespace-nowrap">
                  {r.project_name}
                </td>
                {months.map((m) => (
                  <td key={m} className="px-4 py-2.5 text-right tabular-nums">
                    {money(r[m], currency)}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right font-semibold bg-sky-50 tabular-nums">
                  {money(r.total, currency)}
                </td>
              </tr>
            ))}
          </tbody>

          {totalRow && (
            <tfoot>
              <tr className={`bg-gradient-to-r ${headerColor} text-white font-semibold`}>
                <td className="px-4 py-3 sticky left-0 whitespace-nowrap"
                    style={{ background: "inherit" }}>
                  Grand Total
                </td>
                {months.map((m) => (
                  <td key={m} className="px-4 py-3 text-right tabular-nums">
                    {money(totalRow[m], currency)}
                  </td>
                ))}
                <td className="px-4 py-3 text-right tabular-nums bg-sky-950">
                  {money(totalRow.total, currency)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    )}
  </div>
);
