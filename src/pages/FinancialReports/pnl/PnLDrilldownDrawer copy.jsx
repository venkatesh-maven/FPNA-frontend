// src/components/Reports/PnL/PnLDrilldownDrawer.jsx

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiArrowUp, FiArrowDown, FiMinus } from "react-icons/fi";
import {
  FiX,
  FiChevronRight,
  FiChevronDown,
  FiTrendingUp,
  FiBarChart2,
  FiLayers,
  FiZap
} from "react-icons/fi";
import TableSkeleton from "../../Skeleton/TableSkeleton";
import { API_BASE_URL } from "../../../config/config";
import { getDecimalPrecision } from '../../../utils/formatters';

/* ===================== Helpers ===================== */

const formatMoney = (val, symbol = "$") => {
  if (val === null || val === undefined) return "—";
  const num = Number(val);
  return isNaN(num)
    ? "—"
    : `${symbol}${num.toLocaleString(undefined, {
      minimumFractionDigits: getDecimalPrecision(),
      maximumFractionDigits: getDecimalPrecision()
    })}`;
};

const formatPercent = (val) => {
  if (val === null || val === undefined) return "—";
  const num = Number(val);
  return isNaN(num)
    ? "—"
    : `${num > 0 ? "+" : ""}${num.toFixed(getDecimalPrecision())}%`;
};

const ValueBadge = ({ value, type = "currency", currencySymbol = "$" }) => {
  if (value === null || value === undefined) return <span>—</span>;
  const positive = Number(value) >= 0;

  return (
    <span
      className={`font-semibold ${positive ? "text-emerald-600" : "text-rose-600"
        }`}
    >
      {type === "currency"
        ? formatMoney(value, currencySymbol)
        : formatPercent(value)}
    </span>
  );
};

/* ===================== Tabs ===================== */

const TABS = [
  { key: "insights", label: "Insights", icon: FiZap },
  { key: "waterfall", label: "Waterfall", icon: FiBarChart2 },
  { key: "breakdown", label: "Breakdown", icon: FiLayers },
  { key: "impact", label: "Top Impact", icon: FiTrendingUp }
];

/* ===================== Tree Config ===================== */

const LEVELS = [
  { key: "customer", label: "Customer", field: "customer_name", childrenField: "by_customer_by_product" },
  { key: "product", label: "Product", field: "product_name", childrenField: "by_customer_by_product_by_entity" },
  { key: "entity", label: "Entity", field: "entity_name", childrenField: "by_customer_by_product_by_entity_by_industry" },
  { key: "industry", label: "Industry", field: "industry", childrenField: null }
];

const getNodeValues = (node) => {
  const current = Number(
    node?.current ??
    node?.selected_revenue ??
    node?.selected_value ??
    0
  );

  const previous = Number(
    node?.previous ??
    node?.previous_revenue ??
    node?.previous_value ??
    0
  );

  const change =
    node?.change !== undefined
      ? Number(node.change)
      : current - previous;

  const pct =
    node?.change_pct !== undefined && node?.change_pct !== null
      ? Number(node.change_pct)
      : previous
        ? (change / previous) * 100
        : 0;

  return { current, previous, change, pct };
};

/* ===================== Tree Row ===================== */

const TrendBadge = ({ trend }) => {
  if (!trend) return <span>—</span>;

  if (trend === "up") {
    return (
      <span className="flex items-center justify-end gap-1 text-emerald-600 font-semibold">
        <FiArrowUp size={14} />
        Up
      </span>
    );
  }

  if (trend === "down") {
    return (
      <span className="flex items-center justify-end gap-1 text-rose-600 font-semibold">
        <FiArrowDown size={14} />
        Down
      </span>
    );
  }

  return (
    <span className="flex items-center justify-end gap-1 text-gray-500">
      <FiMinus size={14} />
      Flat
    </span>
  );
};



const TreeRow = ({
  node,
  level,
  path,
  expanded,
  toggle,
  currencySymbol,
  depth = 0
}) => {
  const values = getNodeValues(node);
  const childrenKey = LEVELS[level].childrenField;
  const children = childrenKey ? node[childrenKey] : null;
  const hasChildren = children?.length > 0;
  const id = path.join("|");
  const isOpen = expanded[id];

  return (
    <>
      <tr className="border-b hover:bg-sky-50 transition">
        <td
          className="px-4 py-3 cursor-pointer"
          onClick={() => hasChildren && toggle(id)}
        >
          <div
            className="flex items-center gap-2"
            style={{ paddingLeft: depth * 20 }}
          >
            {hasChildren ? (
              isOpen ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />
            ) : (
              <span className="w-4" />
            )}

            <span className="font-medium">
              {node[LEVELS[level].field] || "—"}
            </span>
            <span className="text-x text-gray-400 ml-2">
              {LEVELS[level].label}
            </span>
          </div>
        </td>

        <td className="px-4 py-3 text-right">
          {formatMoney(values.current, currencySymbol)}
        </td>
        <td className="px-4 py-3 text-right">
          {formatMoney(values.previous, currencySymbol)}
        </td>
        <td className="px-4 py-3 text-right">
          <ValueBadge value={values.change} currencySymbol={currencySymbol} />
        </td>
        <td className="px-4 py-3 text-right">
          <ValueBadge value={values.pct} type="percent" />
        </td>
        <td className="px-4 py-3 text-right">
          <TrendBadge trend={node.trend} />
        </td>
      </tr>

      {isOpen &&
        hasChildren &&
        children.map((child, idx) => (
          <TreeRow
            key={`${id}-${idx}`}
            node={child}
            level={level + 1}
            path={[...path, `${LEVELS[level].key}-${idx}`]}
            expanded={expanded}
            toggle={toggle}
            currencySymbol={currencySymbol}
            depth={depth + 1}
          />
        ))}
    </>
  );
};

/* ===================== Tree Table ===================== */

const TreeTable = ({ data, currencySymbol }) => {
  const [expanded, setExpanded] = useState({});

  const toggle = useCallback((id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  if (!data?.length)
    return (
      <div className="text-center py-10 text-gray-500">
        No breakdown data available
      </div>
    );

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <div className="overflow-auto max-h-[500px]">
        <table className="w-full text-s">
          <thead className="bg-gray-50 sticky top-0 border-b">
            <tr>
              <th className="px-4 py-3 text-left">Hierarchy</th>
              <th className="px-4 py-3 text-right">Current</th>
              <th className="px-4 py-3 text-right">Previous</th>
              <th className="px-4 py-3 text-right">Change</th>
              <th className="px-4 py-3 text-right">% Change</th>
              <th className="px-4 py-3 text-right">Trend</th>

            </tr>
          </thead>
          <tbody>
            {data.map((node, idx) => (
              <TreeRow
                key={`root-${idx}`}
                node={node}
                level={0}
                path={[`root-${idx}`]}
                expanded={expanded}
                toggle={toggle}
                currencySymbol={currencySymbol}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ===================== MAIN COMPONENT ===================== */

export default function PnLDrilldownDrawer({
  open,
  onClose,
  token,
  currency = "USD",
  currencySymbol = "$",
  metric = "revenue",
  period
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("insights");

  const queryParams = useMemo(() => {
    if (!period) return null;
    return new URLSearchParams({
      currency_filter: "actualvalue",
      period
    });
  }, [period]);

  useEffect(() => {
    if (!open || !token || !queryParams) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/v1/company/financial/pnl-drilldown/${metric}/${currency}?${queryParams}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, token, queryParams, metric, currency]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 top-0 h-full w-[1000px] max-w-[95vw] bg-white z-50 shadow-2xl flex flex-col"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
          >
            {/* HEADER */}
            <div className="px-6 py-5 bg-gradient-to-r from-sky-900 to-sky-700 text-white">
              <div className="flex justify-between item-center">
                <div>
                  <h2 className="text-xl font-bold">
                    {data?.title || "P&L Analysis"}
                  </h2>
                  <p className="text-s text-white/80">{data?.subtitle}</p>

                  {data?.summary && (
                    <div className="flex gap-8 mt-4 text-s">
                      <div>
                        <div className="text-white/70">
                          {data.summary.current_period}
                        </div>
                        <div className="text-lg font-bold">
                          {formatMoney(
                            data.summary.current_value,
                            currencySymbol
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-white/70">
                          {data.summary.previous_period}
                        </div>
                        <div className="text-lg font-bold">
                          {formatMoney(
                            data.summary.previous_value,
                            currencySymbol
                          )}
                        </div>
                      </div>
                      <div >
                        <div className="text-white/70 ">Change</div>
                        <div className="text-lg font-bold"><ValueBadge
                          value={data.summary.variance}
                          currencySymbol={currencySymbol}
                        /></div>


                      </div>
                      <div>
                        <div className="text-white/70">PCT Change</div>

                        <div className="text-lg font-bold">
                          <ValueBadge
                            value={data.summary.pct}
                            type="percent"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={onClose}>
                  <FiX size={20} />
                </button>
              </div>
            </div>

            {/* TABS */}
            <div className="flex border-b bg-sky-50">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-2 px-5 py-3 text-s font-medium ${activeTab === tab.key
                      ? "bg-white border-b-2 border-sky-700 text-sky-800"
                      : "text-sky-700 hover:bg-sky-100"
                      }`}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-auto p-6 bg-sky-50">
              {loading ? (
                <TableSkeleton />
              ) : (
                <>
                  {/* INSIGHTS */}
                  {activeTab === "insights" && data?.insights && (
                    <div className="space-y-6">
                      <div className="bg-white p-6 rounded-xl shadow">
                        <h3 className="font-semibold text-sky-800 mb-2">
                          Executive Summary
                        </h3>
                        <p>{data.insights.summary}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {data.insights.drivers?.map((d, i) => (
                          <div
                            key={i}
                            className="bg-white p-4 rounded-xl shadow"
                          >
                            <div className="flex justify-between">
                              <span className="font-medium">
                                {d.description}
                              </span>
                              <ValueBadge
                                value={d.amount}
                                currencySymbol={currencySymbol}
                              />
                            </div>
                            <div className="text-x text-gray-500 mt-1">
                              {d.detail}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="bg-white p-6 rounded-xl shadow">
                        <h3 className="font-semibold text-sky-800 mb-3">
                          Recommendations
                        </h3>
                        <ul className="list-disc pl-5 text-s space-y-1">
                          {data.insights.recommendations?.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* BREAKDOWN */}
                  {activeTab === "breakdown" && (
                    <TreeTable
                      data={data?.breakdowns}
                      currencySymbol={currencySymbol}
                    />
                  )}





                  {/* WATERFALL */}
                  {activeTab === "waterfall" && data?.waterfall && (
                    <div className="bg-white p-6 rounded-xl shadow">
                      <h3 className="font-semibold text-sky-800 mb-4">
                        Revenue Waterfall Analysis
                      </h3>

                      <div className="space-y-3">
                        {data.waterfall.map((step, index) => (
                          <div
                            key={index}
                            className="flex justify-between items-center border-b pb-2"
                          >
                            <div>
                              <div className="font-medium">{step.label}</div>
                              <div className="text-x text-gray-500">
                                {step.description}
                              </div>
                            </div>

                            <ValueBadge
                              value={step.value}
                              currencySymbol={currencySymbol}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TOP IMPACT */}
                  {activeTab === "impact" && data?.top_impact && (
                    <div className="bg-white rounded-xl shadow overflow-auto">
                      <table className="w-full text-s">
                        <thead className="bg-sky-100 border-b">
                          <tr>
                            <th className="px-4 py-3 text-left">Entity</th>
                            <th className="px-4 py-3 text-left">Product</th>
                            <th className="px-4 py-3 text-left">Region</th>
                            <th className="px-4 py-3 text-right">Current</th>
                            <th className="px-4 py-3 text-right">Previous</th>
                            <th className="px-4 py-3 text-right">Change</th>
                            <th className="px-4 py-3 text-right">% Change</th>
                            <th className="px-4 py-3 text-right">Impact</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.top_impact.map((item, i) => (
                            <tr key={i} className="border-b hover:bg-sky-50">
                              <td className="px-4 py-2 font-medium">
                                {item.entity}
                              </td>
                              <td className="px-4 py-2">
                                {item.category}
                              </td>
                              <td className="px-4 py-2">
                                {item.region}
                              </td>
                              <td className="px-4 py-2 text-right">
                                {formatMoney(
                                  item.current,
                                  currencySymbol
                                )}
                              </td>
                              <td className="px-4 py-2 text-right">
                                {formatMoney(
                                  item.previous,
                                  currencySymbol
                                )}
                              </td>
                              <td className="px-4 py-2 text-right">
                                <ValueBadge
                                  value={item.change}
                                  currencySymbol={currencySymbol}
                                />
                              </td>
                              <td className="px-4 py-2 text-right">
                                <ValueBadge
                                  value={item.change_pct}
                                  type="percent"
                                />
                              </td>
                              <td className="px-4 py-2 text-right font-semibold">
                                <ValueBadge
                                  value={item.impact}
                                  currencySymbol={currencySymbol}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}