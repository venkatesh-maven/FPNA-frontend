import React, { useEffect, useState } from "react";
import DrilldownDrawer, { DrilldownBodySkeleton, DrilldownFadeIn, DrilldownSummarySkeleton } from "../DrilldownDrawer";
import { FiX, FiChevronRight, FiChevronDown } from "react-icons/fi";
import { cachedFetch } from "../../../utils/reportCache";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell
} from "recharts";
import { getDecimalPrecision } from '../../../utils/formatters';
import { API_BASE_URL } from '../../../config/config';

/* ================= HELPERS ================= */

const formatMoney = (val, symbol = "$") => {
  if (val === null || val === undefined || val === "") return "—";
  const num = typeof val === "string" ? Number(val.replace(/,/g, "")) : Number(val);
  if (Number.isNaN(num)) return "—";
  return `${symbol}${num.toLocaleString(undefined, {
    minimumFractionDigits: getDecimalPrecision(),
    maximumFractionDigits: getDecimalPrecision()
  })}`;
};

const formatPercent = (val) => {
  if (val === null || val === undefined) return "—";
  return `${val > 0 ? "+" : ""}${Number(val).toFixed(getDecimalPrecision())}%`;
};

const parseChartValue = (val) => {
  if (val === null || val === undefined || val === "") return 0;
  const num = typeof val === "string" ? Number(val.replace(/,/g, "")) : Number(val);
  return Number.isNaN(num) ? 0 : num;
};

/* ================= COMPONENT ================= */

export default function PnLDrilldownDrawer({
  open,
  onClose,
  token,
  currency = "USD",
  currencySymbol = "$",
  period,
  query = "" // comparison basis + report filters, from PnLPage
}) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("insights");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [showChart, setShowChart] = useState(true);

  /* ================= FETCH ================= */

  useEffect(() => {
    if (!open || !period) return;

    const fetchData = async () => {
      setLoading(true);
      setData(null);
      try {
        const json = await cachedFetch(
          `${API_BASE_URL}/api/v1/company/financial/pnl-revenue-drilldown/${currency}?currency_filter=actualvalue&period=${period}${query ? `&${query}` : ""}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json"
            }
          }
        );
        setData(json);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, currency, period, token, query]);

  const toggle = (key) =>
    setExpanded((p) => ({ ...p, [key]: !p[key] }));

  const isBudget = data?.compare_to === "budget";

  /* ================= RECURSIVE BREAKDOWN ================= */

  const renderBreakdownRows = (
    rows,
    level = 0,
    parentKey = ""
  ) => {
    if (!Array.isArray(rows)) return null;

    return rows.map((row, idx) => {
      const key = `${parentKey}-${idx}`;
      const isOpen = expanded[key];

      const children =
        row.by_customer_by_product ||
        row.by_customer_by_product_by_entity ||
        row.by_customer_by_product_by_entity_by_industry ||
        row.children;

      return (
        <React.Fragment key={key}>
          <tr
            className="border-b hover:bg-sky-50 cursor-pointer"
            onClick={() =>
              children && toggle(key)
            }
          >
            <td className="p-3 flex items-center gap-2">
              <div style={{ marginLeft: level * 20 }}>
                {children &&
                  (isOpen ? (
                    <FiChevronDown />
                  ) : (
                    <FiChevronRight />
                  ))}
              </div>
              {row.customer_name ||
                row.product_name ||
                row.entity_name ||
                row.industry ||
                row.category}
            </td>

            <td className="text-right p-3">
              {formatMoney(
                row.selected_revenue,
                currencySymbol
              )}
            </td>
            <td className="text-right p-3">
              {formatMoney(
                row.previous_revenue,
                currencySymbol
              )}
            </td>
            <td
              className={`text-right p-3 ${row.trend === "up"
                ? "text-green-600"
                : "text-red-600"
                }`}
            >
              {formatMoney(row.change, currencySymbol)}
            </td>
            <td className="text-right p-3">
              {formatPercent(row.change_pct)}
            </td>
          </tr>

          {children &&
            isOpen &&
            renderBreakdownRows(
              children,
              level + 1,
              key
            )}
        </React.Fragment>
      );
    });
  };

  return (
    <DrilldownDrawer open={open} onClose={onClose}>
          {/* ================= HEADER ================= */}

          <div className="px-8 py-6 bg-gradient-to-r from-sky-900 to-sky-700 text-white">
            <div className="flex justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  {data?.title}
                </h2>
                <p className="text-sky-200 mt-1">
                  {data?.subtitle}
                </p>

                {loading && <DrilldownSummarySkeleton />}
                {data?.summary && (
                  <div className="grid grid-cols-4 gap-6 mt-6">
                    <SummaryCard
                      label={data.summary.current_label || data.summary.current_period}
                      value={formatMoney(
                        data.summary.current_value,
                        currencySymbol
                      )}
                    />
                    <SummaryCard
                      label={data.summary.previous_label || data.summary.previous_period}
                      value={formatMoney(
                        data.summary.previous_value,
                        currencySymbol
                      )}
                    />
                    <SummaryCard
                      label="Variance"
                      value={formatMoney(
                        data.summary.variance,
                        currencySymbol
                      )}
                    />
                    <SummaryCard
                      label="% Change"
                      value={formatPercent(
                        data.summary.pct
                      )}
                    />
                  </div>
                )}
              </div>

              <button onClick={onClose}>
                <FiX size={22} />
              </button>
            </div>
          </div>

          {/* ================= TABS ================= */}

          <div className="flex border-b bg-white">
            {["insights", "waterfall", "breakdown", "impact"].map(
              (t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-6 py-3 text-s font-medium ${tab === t
                    ? "border-b-2 border-sky-800 text-sky-900"
                    : "text-sky-600"
                    }`}
                >
                  {t.toUpperCase()}
                </button>
              )
            )}
          </div>

          <div className="flex-1 overflow-auto p-8">
            {loading && <DrilldownBodySkeleton />}

            <DrilldownFadeIn key={`${tab}-${data ? "loaded" : "empty"}`}>

            {/* ================= INSIGHTS ================= */}

            {tab === "insights" && data?.insights && (
              <div className="space-y-6 max-w-5xl mx-auto">

                <Card title="Summary">
                  {data.insights.summary}
                </Card>

                <Card title="Drivers">
                  <Card title="Drivers">
                    {data.insights.drivers?.map((d, i) => {
                      const driverKey = d.key;
                      const details =
                        data.insights?.drivers_detail?.[driverKey];

                      const isOpen = expanded[driverKey];

                      return (
                        <div key={i} className="border-b last:border-none">
                          {/* DRIVER ROW */}
                          <div
                            className="flex justify-between py-3 cursor-pointer hover:bg-sky-50 px-2 rounded"
                            onClick={() =>
                              setExpanded((prev) => ({
                                ...prev,
                                [driverKey]: !prev[driverKey]
                              }))
                            }
                          >
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {isOpen ? (
                                  <FiChevronDown />
                                ) : (
                                  <FiChevronRight />
                                )}
                                {d.description}
                              </div>
                              <div className="text-s text-sky-600 ml-6">
                                {d.detail}
                              </div>
                            </div>

                            <div
                              className={
                                d.type === "positive"
                                  ? "text-green-600 font-semibold"
                                  : "text-red-600 font-semibold"
                              }
                            >
                              {formatMoney(d.amount, currencySymbol)}
                            </div>
                          </div>

                          {/* DRIVER DETAILS TABLE */}
                          {isOpen && Array.isArray(details) && (
                            <div className="ml-8 mb-4">
                              <div className="h-70 overflow-y-scroll rounded-lg border border-sky-100">
                                <table className="w-full text-s bg-sky-50">
                                  <thead className="bg-sky-100 text-sky-800 sticky top-0">
                                    <tr>
                                      <th className="p-2 text-left">
                                        Customer
                                      </th>
                                      <th className="p-2 text-right">
                                        Revenue
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {details.map((cust, idx) => (
                                      <tr
                                        key={idx}
                                        className="border-b last:border-none"
                                      >
                                        <td className="p-2">
                                          {cust.customer_name}
                                        </td>
                                        <td
                                          className={`p-2 text-right ${cust.revenue >= 0
                                            ? "text-green-600"
                                            : "text-red-600"
                                            }`}
                                        >
                                          {formatMoney(
                                            cust.revenue,
                                            currencySymbol
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </Card>
                </Card>

                <Card title="Recommendations">
                  <ul className="list-disc pl-6 space-y-2">
                    {data.insights.recommendations?.map(
                      (r, i) => (
                        <li key={i}>{r}</li>
                      )
                    )}
                  </ul>
                </Card>
              </div>
            )}

            {/* ================= WATERFALL ================= */}

            {tab === "waterfall" &&
              Array.isArray(data?.waterfall) && (
                <Card title="Waterfall Analysis">
                  {/* <div className="flex justify-end mb-4">
                    <button
                      onClick={() =>
                        setShowChart(!showChart)
                      }
                      className="text-sky-700 underline text-s"
                    >
                      {showChart
                        ? "Show Table"
                        : "Show Chart"}
                    </button>
                  </div> */}

                  <div className="flex justify-center items-center gap-10">





                    <table className="w-full text-s">
                      <thead className="bg-sky-100">
                        <tr>
                          <th className="p-3 text-left">
                            Label
                          </th>
                          <th className="p-3 text-right">
                            Value
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.waterfall.map(
                          (w, i) => (
                            <tr
                              key={i}
                              className="border-b"
                            >
                              <td className="p-3">
                                {w.label}
                              </td>
                              <td className="p-3 text-right">
                                {formatMoney(
                                  w.value,
                                  currencySymbol
                                )}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>




                    <ResponsiveContainer
                      width="100%"
                      height={350}
                      className="p-3"
                    >
                      <BarChart
                        data={data.waterfall.map((w) => ({
                          ...w,
                          value: parseChartValue(w.value)
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value">
                          {data.waterfall.map(
                            (entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={
                                  entry.type ===
                                    "positive"
                                    ? "#16a34a"
                                    : entry.type ===
                                      "negative"
                                      ? "#dc2626"
                                      : "#0369a1"
                                }
                              />
                            )
                          )}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* {showChart ? (
                    <ResponsiveContainer
                      width="100%"
                      height={350}
                    >
                      <BarChart
                        data={data.waterfall.map((w) => ({
                          ...w,
                          value: parseChartValue(w.value)
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value">
                          {data.waterfall.map(
                            (entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={
                                  entry.type ===
                                    "positive"
                                    ? "#16a34a"
                                    : entry.type ===
                                      "negative"
                                      ? "#dc2626"
                                      : "#0369a1"
                                }
                              />
                            )
                          )}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <table className="w-full text-s">
                      <thead className="bg-sky-100">
                        <tr>
                          <th className="p-3 text-left">
                            Label
                          </th>
                          <th className="p-3 text-right">
                            Value
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.waterfall.map(
                          (w, i) => (
                            <tr
                              key={i}
                              className="border-b"
                            >
                              <td className="p-3">
                                {w.label}
                              </td>
                              <td className="p-3 text-right">
                                {formatMoney(
                                  w.value,
                                  currencySymbol
                                )}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  )} */}
                </Card>
              )}

            {/* ================= BREAKDOWN ================= */}

            {tab === "breakdown" &&
              Array.isArray(data?.breakdowns) && (
                <Card title="Revenue Breakdown">
                  <table className="w-full text-s">
                    <thead className="bg-sky-100">
                      <tr>
                        <th className="p-3 text-left">
                          Hierarchy
                        </th>
                        <th className="p-3 text-right">
                          {isBudget ? "Actual" : "Current"}
                        </th>
                        <th className="p-3 text-right">
                          {isBudget ? "Budget" : "Previous"}
                        </th>
                        <th className="p-3 text-right">
                          Change
                        </th>
                        <th className="p-3 text-right">
                          PCT Change
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {renderBreakdownRows(
                        [...data.breakdowns].sort(
                          (a, b) =>
                            (b.selected_revenue || 0) -
                            (a.selected_revenue || 0)
                        )
                      )}
                    </tbody>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    
                  </table>
                </Card>
              )}

            {/* ================= IMPACT ================= */}

            {tab === "impact" && (
              <div className="grid grid-cols-2 gap-6">
                <ImpactCard
                  title="Top Increases"
                  items={data?.top_impact?.increases}
                  positive
                  currencySymbol={currencySymbol}
                />
                <ImpactCard
                  title="Top Decreases"
                  items={data?.top_impact?.decreases}
                  currencySymbol={currencySymbol}
                />
              </div>
            )}
            </DrilldownFadeIn>
          </div>
    </DrilldownDrawer>
  );
}

/* ================= SMALL COMPONENTS ================= */

const Card = ({ title, children }) => (
  <div className="bg-white p-6 rounded-xl shadow">
    <h3 className="font-semibold text-sky-800 mb-4">
      {title}
    </h3>
    {children}
  </div>
);

const SummaryCard = ({ label, value }) => (
  <div>
    <div className="text-sky-200 text-s">
      {label}
    </div>
    <div className="font-bold text-lg">
      {value}
    </div>
  </div>
);

const ImpactCard = ({
  title,
  items,
  positive,
  currencySymbol
}) => (
  <div className="bg-white p-6 rounded-xl shadow">
    <h3
      className={`font-semibold mb-4 ${positive
        ? "text-green-600"
        : "text-red-600"
        }`}
    >
      {title}
    </h3>

    {items?.map((i, idx) => (
      <div
        key={idx}
        className="flex justify-between py-2 border-b"
      >
        <span>{i.customer_name}</span>
        <span
          className={
            positive
              ? "text-green-600"
              : "text-red-600"
          }
        >
          {formatMoney(
            i.change,
            currencySymbol
          )}
        </span>
      </div>
    ))}
  </div>
);