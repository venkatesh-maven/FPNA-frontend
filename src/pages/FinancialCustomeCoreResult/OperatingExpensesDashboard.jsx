import React, { useContext, useEffect, useState } from "react";
import { FiCpu } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

import { AuthContext } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config/config";
import TableSkeleton from "../Skeleton/TableSkeleton";
import AddAutomation from "../FinancialReports/AddAutomation";
import ViewMoreHeader, { VIEW_MORE_FILTER_BAR, ViewMoreSelect } from "./ViewMoreHeader";
import { getDecimalPrecision } from '../../utils/formatters';

/* ================= CONSTANTS ================= */

const TABLE_COLUMNS = [
  "period",
  "account_name",
  "actual_operating_expense",
  "budget_operating_expense",
  "variance",
  "ai_insight",
];

const CURRENCY_FILTERS = [
  { id: "actualvalue", label: "Actual Value" },
  { id: "thousands", label: "Thousands" },
  { id: "millions", label: "Millions" },
];

const formatMoney = (v, currency) => {
  const cleaned = typeof v === "string" ? v.replace(/,/g, "") : v;
  const num = Number(cleaned || 0);
  if (!Number.isFinite(num)) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision(),
  }).format(num);
};

/* ================= AI INSIGHTS ================= */

const DEFAULT_AI_DRIVER = [
  "Expense is within expected range",
  "Monitor variance to avoid budget overruns",
  "Consider optimizing recurring costs",
  "AI suggests reviewing this expense category",
];

const getRowAIInsights = (row) => {
  if (!row) return DEFAULT_AI_DRIVER;

  if (row.variance > 0) {
    return [
      "Actual expense exceeded budget",
      "Investigate cost overrun causes",
      "AI flags this as a high-variance item",
    ];
  }

  if (row.variance < 0) {
    return [
      "Expense is under budget",
      "Cost control measures look effective",
      "AI marks this as a positive variance",
    ];
  }

  return DEFAULT_AI_DRIVER;
};

const AIDriverTicker = ({ insights }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(
      () => setIndex((i) => (i + 1) % insights.length),
      3000
    );
    return () => clearInterval(t);
  }, [insights]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.25 }}
        className=" text-[11p] italic text-sky-800 leading-snug max-w-[220px]"
      >
        {insights[index]}
      </motion.div>
    </AnimatePresence>
  );
};

/* ================= MAIN ================= */

export default function OperatingExpensesPLStyle() {
  const { token, selectedYear, selectedCurrency } = useContext(AuthContext);

  const [expenses, setExpenses] = useState([]);
  const [periods, setPeriods]   = useState([]);
  const [loading, setLoading]   = useState(false);

  const [entities, setEntities]       = useState(["All"]);
  const [departments, setDepartments] = useState(["All"]);
  const [costCenters, setCostCenters] = useState(["All"]);

  const [filters, setFilters] = useState({
    entity: "All",
    department: "All",
    cost_center: "All",
  });

  const [currencyFilter, setCurrencyFilter] = useState("actualvalue");

  const [showCols, setShowCols] = useState({
    show_entity: false,
    show_department: false,
    show_cost_center: false,
    show_period: true,
  });

  /* ================= FETCH ================= */

  useEffect(() => {
    if (!token || !selectedYear || !selectedCurrency) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();

        if (filters.entity !== "All") params.append("entity", filters.entity);
        if (filters.department !== "All") params.append("department", filters.department);
        if (filters.cost_center !== "All") params.append("cost_center", filters.cost_center);
        params.append("currency_filter", currencyFilter);
        params.append("show_entity", String(showCols.show_entity));
        params.append("show_department", String(showCols.show_department));
        params.append("show_cost_center", String(showCols.show_cost_center));
        params.append("show_period", String(showCols.show_period));

        const res = await fetch(
          `${API_BASE_URL}/api/v1/company/financial/operating_enpense_report/${selectedYear}/${selectedCurrency}?${params}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const api = await res.json();

        if (typeof api === "string" || api?.message) {
          setExpenses([]); setPeriods([]); return;
        }

        /* ---- old array format: [{period, account_name, actual, budget, variance}] ---- */
        if (Array.isArray(api)) {
          const cleanRows = api.filter((i) => i.period);

          // group by account_name → unified structure (months dict like new format)
          const map = {};
          const orderedPeriods = [];
          cleanRows.forEach((r) => {
            if (!map[r.account_name]) {
              map[r.account_name] = { account_name: r.account_name, total: { actual_operating_expense: 0, budget_operating_expense: 0, variance: 0 }, months: {} };
            }
            map[r.account_name].months[r.period] = r;
            map[r.account_name].total.actual_operating_expense += Number(r.actual_operating_expense || 0);
            map[r.account_name].total.budget_operating_expense += Number(r.budget_operating_expense || 0);
            map[r.account_name].total.variance += Number(r.variance || 0);
            if (!orderedPeriods.includes(r.period)) orderedPeriods.push(r.period);
          });

          setExpenses(Object.values(map));
          setPeriods(orderedPeriods.sort());
          setEntities(["All", ...(api.find((i) => i.entities)?.entities || []).map((e) => e.entity_name)]);
          setDepartments(["All", ...(api.find((i) => i.departments)?.departments || []).map((d) => d.department_name)]);
          setCostCenters(["All"]);
          return;
        }

        /* ---- new object format: { expenses, periods, entities, departments, costcenters } ---- */
        setExpenses(Array.isArray(api?.expenses) ? api.expenses : []);
        setPeriods(Array.isArray(api?.periods) ? api.periods : []);
        setEntities(["All", ...(api.entities || []).map((e) => e.entity_name)]);
        setDepartments(["All", ...(api.departments || []).map((d) => d.department_name)]);
        setCostCenters(["All", ...(api.costcenters || []).map((c) => c.name)]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filters, currencyFilter, showCols, token, selectedYear, selectedCurrency]);

  /* ================= UI ================= */

  return (
    <main className="bg-slate-50 min-h-screen space-y-3">
      <ViewMoreHeader title="Operating Expenses" year={selectedYear} currency={selectedCurrency}>
        <AddAutomation reportType="operating_expense" reportLabel="Operating Expense Report" iconOnly />
      </ViewMoreHeader>

      {/* ===== FILTER BAR: column checkboxes left, dropdowns right ===== */}
      <div className={VIEW_MORE_FILTER_BAR}>
        <div className="flex flex-wrap items-center gap-4">
          {[
            { key: "show_entity",      label: "Show Entity" },
            { key: "show_department",  label: "Show Department" },
            { key: "show_cost_center", label: "Show Cost Center" },
          ].map((item) => (
            <label key={item.key} className="inline-flex items-center gap-2 text-x font-medium text-sky-800 cursor-pointer">
              <input
                type="checkbox"
                checked={showCols[item.key]}
                onChange={(e) => setShowCols((s) => ({ ...s, [item.key]: e.target.checked }))}
                className="h-3.5 w-3.5 rounded border-sky-300 text-sky-800 focus:ring-sky-500"
              />
              {item.label}
            </label>
          ))}
          <span className="h-5 border-l border-sky-300" />
          <label className="inline-flex items-center gap-2 text-x font-medium text-sky-800 cursor-pointer">
            <input
              type="checkbox"
              checked={showCols.show_period}
              onChange={(e) => setShowCols((s) => ({ ...s, show_period: e.target.checked }))}
              className="h-3.5 w-3.5 rounded border-sky-300 text-sky-800 focus:ring-sky-500"
            />
            Show Period Columns
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ViewMoreSelect
            label="Entity"
            value={filters.entity}
            onChange={(v) => setFilters((f) => ({ ...f, entity: v }))}
            options={entities.map((e) => ({ value: e, label: e }))}
          />
          <ViewMoreSelect
            label="Dept"
            value={filters.department}
            onChange={(v) => setFilters((f) => ({ ...f, department: v }))}
            options={departments.map((d) => ({ value: d, label: d }))}
          />
          <ViewMoreSelect
            label="Cost Center"
            value={filters.cost_center}
            onChange={(v) => setFilters((f) => ({ ...f, cost_center: v }))}
            options={costCenters.map((c) => ({ value: c, label: c }))}
          />
          <ViewMoreSelect
            label="Value"
            value={currencyFilter}
            onChange={setCurrencyFilter}
            options={CURRENCY_FILTERS.map((c) => ({ value: c.id, label: c.label }))}
          />
        </div>
      </div>

      {/* ===== TABLE ===== */}
      {loading && <TableSkeleton />}

      {!loading && expenses.length === 0 && (
        <div className="text-center text-s text-slate-500 py-10">
          No operating expense data available
        </div>
      )}

      {/* HORIZONTAL TABLE — periods as columns */}
      {!loading && expenses.length > 0 && showCols.show_period && periods.length > 0 && (
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-s">
            <thead className="bg-sky-900 text-white">
              <tr>
                <th className="p-3 text-left font-semibold whitespace-nowrap sticky left-0 bg-sky-900 min-w-[200px]">ACCOUNT NAME</th>
                {showCols.show_entity      && <th className="p-3 text-left font-semibold whitespace-nowrap">ENTITY</th>}
                {showCols.show_department  && <th className="p-3 text-left font-semibold whitespace-nowrap">DEPARTMENT</th>}
                {showCols.show_cost_center && <th className="p-3 text-left font-semibold whitespace-nowrap">COST CENTER</th>}
                {periods.map((p) => (
                  <th key={p} className="p-3 text-right font-semibold whitespace-nowrap">{p}</th>
                ))}
                <th className="p-3 text-right font-semibold whitespace-nowrap bg-sky-800">TOTAL</th>
                <th className="p-3 text-left font-semibold whitespace-nowrap">AI INSIGHT</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp, i) => {
                const total = exp.total || {};
                const varianceNum = Number(total.variance || 0);
                const aiInsights = getRowAIInsights({ variance: varianceNum });

                return (
                  <tr key={i} className="border-b align-top hover:bg-sky-50">
                    <td className="p-3 font-medium sticky left-0 bg-white">{exp.account_name}</td>
                    {showCols.show_entity      && <td className="p-3 whitespace-nowrap">{exp.entity_name || "--"}</td>}
                    {showCols.show_department  && <td className="p-3 whitespace-nowrap">{exp.department_name || "--"}</td>}
                    {showCols.show_cost_center && <td className="p-3 whitespace-nowrap">{exp.cost_center_name || "--"}</td>}
                    {periods.map((p) => {
                      const pd = exp.months?.[p];
                      return (
                        <td key={p} className="p-3 text-right whitespace-nowrap">
                          {formatMoney(pd?.actual_operating_expense ?? 0, selectedCurrency)}
                        </td>
                      );
                    })}
                    <td className="p-3 text-right font-semibold whitespace-nowrap bg-sky-50">
                      {formatMoney(total.actual_operating_expense, selectedCurrency)}
                    </td>
                    <td className="p-3 bg-sky-50 border-l">
                      <AIDriverTicker insights={aiInsights} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* VERTICAL TABLE — totals only (no period columns) */}
      {!loading && expenses.length > 0 && !showCols.show_period && (
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-s">
            <thead className="bg-sky-900 text-white">
              <tr>
                <th className="p-3 text-left font-semibold whitespace-nowrap">ACCOUNT NAME</th>
                {showCols.show_entity      && <th className="p-3 text-left font-semibold whitespace-nowrap">ENTITY</th>}
                {showCols.show_department  && <th className="p-3 text-left font-semibold whitespace-nowrap">DEPARTMENT</th>}
                {showCols.show_cost_center && <th className="p-3 text-left font-semibold whitespace-nowrap">COST CENTER</th>}
                <th className="p-3 text-right font-semibold whitespace-nowrap">ACTUAL</th>
                <th className="p-3 text-right font-semibold whitespace-nowrap">BUDGET</th>
                <th className="p-3 text-right font-semibold whitespace-nowrap">VARIANCE</th>
                <th className="p-3 text-left font-semibold whitespace-nowrap">AI INSIGHT</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp, i) => {
                const total = exp.total || {};
                const varianceNum = Number(total.variance || 0);
                const aiInsights = getRowAIInsights({ variance: varianceNum });

                return (
                  <tr key={i} className="border-b align-top hover:bg-sky-50">
                    <td className="p-3 font-medium">{exp.account_name}</td>
                    {showCols.show_entity      && <td className="p-3">{exp.entity_name || "--"}</td>}
                    {showCols.show_department  && <td className="p-3">{exp.department_name || "--"}</td>}
                    {showCols.show_cost_center && <td className="p-3">{exp.cost_center_name || "--"}</td>}
                    <td className="p-3 text-right">{formatMoney(total.actual_operating_expense, selectedCurrency)}</td>
                    <td className="p-3 text-right">{formatMoney(total.budget_operating_expense, selectedCurrency)}</td>
                    <td className={`p-3 text-right font-semibold ${varianceNum > 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {formatMoney(total.variance, selectedCurrency)}
                    </td>
                    <td className="p-3 bg-sky-50 border-l">
                      <AIDriverTicker insights={aiInsights} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== AI SUMMARY ===== */}
      <div className="bg-white rounded-xl border p-5 space-y-3">
        <div className="flex items-center gap-2 text-sky-800 font-semibold">
          <FiCpu />
          AI Insights Summary
        </div>

        <ul className="list-disc pl-5 text-s text-slate-700 space-y-1">
          <li>High variance rows require closer budget monitoring</li>
          <li>Under-budget expenses show effective cost control</li>
          <li>Review recurring expenses for long-term optimization</li>
        </ul>
      </div>
    </main>
  );
}
