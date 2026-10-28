import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config/config";
import { FiDownload, FiPrinter } from "react-icons/fi";
import { motion } from "framer-motion";
import { CSVLink } from "react-csv";
import TableSkeleton from "../Skeleton/TableSkeleton";
import { getDecimalPrecision } from '../../utils/formatters';
import ActionHoverLabel from "../FinancialReports/ActionHoverLabel";
import ViewMoreHeader, { VIEW_MORE_FILTER_BAR, VIEW_MORE_HEADER_BUTTON, VIEW_MORE_SELECT } from "./ViewMoreHeader";

/* ================= UTILS ================= */

const money = (v) => {
  const n = Number(v);
  return isNaN(n) ? "-" : `$${n.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`;
};

/* ================= COMPONENT ================= */

export default function RevenueReportDashboard() {
  const { token, selectedYear, selectedCurrency } = useContext(AuthContext);

  const [products, setProducts] = useState([]);
  const [months, setMonths] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [grandTotal, setGrandTotal] = useState(null);
  const [loading, setLoading] = useState(false);

  /* API SUPPORTED FILTERS ONLY */
  const [period, setPeriod] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("actualvalue");

  /* ================= FETCH ================= */

  useEffect(() => {
    if (!token || !selectedYear || !selectedCurrency) return;

    const fetchRevenue = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          period,
          currency_filter: currencyFilter,
        });

        const res = await fetch(
          `${API_BASE_URL}/api/v1/company/financial/Revenue_Report_ViewMore/${selectedYear}/${selectedCurrency}?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const json = await res.json();

        setProducts(json.products || []);
        setMetrics(json.key_metrics || null);
        setGrandTotal(json.grand_total || null);

        if (json.products?.length) {
          const cols = Object.keys(json.products[0]).filter((k) =>
            /^\d{4}-\d{2}$/.test(k)
          );
          setMonths(cols);
        }
      } catch (e) {
        console.error("Revenue API error", e);
      } finally {
        setLoading(false);
      }
    };

    fetchRevenue();
  }, [token, selectedYear, selectedCurrency, period, currencyFilter]);

  /* ================= CSV ================= */

  const csvData = [
    ["Account", ...months, "Total"],
    ...products.map((p) => [
      p.account_name,
      ...months.map((m) => p[m] ?? 0),
      p.total,
    ]),
    ...(grandTotal
      ? [
          [
            "Revenue Total",
            ...months.map((m) => grandTotal[m] ?? 0),
            grandTotal.total,
          ],
        ]
      : []),
  ];

  /* ================= UI ================= */

  return (
    <main className="bg-slate-50 min-h-screen space-y-3">

      <ViewMoreHeader title="Revenue Report" year={selectedYear} currency={selectedCurrency}>
        <CSVLink
          data={csvData}
          filename={`Revenue_${selectedYear}.csv`}
          aria-label="Download CSV"
          className={VIEW_MORE_HEADER_BUTTON}
        >
          <FiDownload />
          <ActionHoverLabel>Download CSV</ActionHoverLabel>
        </CSVLink>
        <button onClick={() => window.print()} aria-label="Print" className={VIEW_MORE_HEADER_BUTTON}>
          <FiPrinter />
          <ActionHoverLabel>Print</ActionHoverLabel>
        </button>
      </ViewMoreHeader>

      {/* KPI METRICS */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Metric label="Total Revenue" value={metrics.total_revenue} />
          <Metric label="Top Product" value={metrics.highest_product} />
          <Metric label="Lowest Product" value={metrics.lowest_product} />
          <Metric label="Growth Rate (%)" value={metrics.growth_rate} />
        </div>
      )}

      {/* FILTER BAR */}
      <div className={VIEW_MORE_FILTER_BAR}>
        <div className="flex flex-wrap items-center gap-2 ml-auto">
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className={VIEW_MORE_SELECT}>
          <option value="all">Period: All</option>
          <option value="current_month">Period: Current Month</option>
          <option value="last_month">Period: Last Month</option>
          <option value="quarter_to_date">Period: Quarter to Date</option>
          <option value="year_to_date">Period: Year to Date</option>
        </select>

        <select value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value)} className={VIEW_MORE_SELECT}>
          <option value="actualvalue">Value: Actual</option>
          <option value="thousands">Value: Thousands</option>
          <option value="millions">Value: Millions</option>
        </select>
        </div>
      </div>

      {/* TABLE */}
      {loading && <TableSkeleton />}

      {!loading && products.length > 0 && (
        <div className="overflow-auto border rounded-xl bg-white">
          <table className="w-full text-x">
            <thead className="bg-sky-900 text-white sticky top-0">
              <tr>
                <th className="p-2 text-left">ACCOUNT</th>
                {months.map((m) => (
                  <th key={m} className="p-2 text-right">
                    {m}
                  </th>
                ))}
                <th className="p-2 text-right">TOTAL</th>
                <th className="p-2 text-left max-w-[200px]">
                  AI INSIGHT
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={i} className="border-b hover:bg-sky-50">
                  <td className="p-2 font-semibold">
                    {p.account_name}
                  </td>
                  {months.map((m) => (
                    <td key={m} className="p-2 text-right">
                      {money(p[m])}
                    </td>
                  ))}
                  <td className="p-2 text-right font-bold">
                    {money(p.total)}
                  </td>
                  <td className="p-2 italic text-sky-700 max-w-[200px] truncate">
                    {p.ai_insights?.[0] || "AI insights coming soon"}
                  </td>
                </tr>
              ))}

              {/* GRAND TOTAL ROW */}
              {grandTotal && (
                <tr className="bg-sky-100 font-bold">
                  <td className="p-2">Revenue Total</td>
                  {months.map((m) => (
                    <td key={m} className="p-2 text-right">
                      {money(grandTotal[m])}
                    </td>
                  ))}
                  <td className="p-2 text-right">
                    {money(grandTotal.total)}
                  </td>
                  <td className="p-2 text-sky-800 max-w-[200px] truncate">
                    {metrics?.ai_insights?.[0] || "AI insights coming soon"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

/* ================= METRIC CARD ================= */

const Metric = ({ label, value }) => (
  <motion.div
    whileHover={{ y: -3 }}
    className="bg-gradient-to-br from-sky-700 to-sky-800 text-white p-4 rounded-xl"
  >
    <p className="text-x uppercase opacity-90">{label}</p>
    <p className="text-xl font-bold mt-1">
      {typeof value === "number" ? value.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }) : value}
    </p>
  </motion.div>
);
