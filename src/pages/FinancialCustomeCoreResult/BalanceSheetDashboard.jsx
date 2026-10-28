import React, { useContext, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FiFilter } from "react-icons/fi";
import { AuthContext } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config/config";
import TableSkeleton from "../Skeleton/TableSkeleton";
import { getDecimalPrecision } from '../../utils/formatters';

/* ================= CONSTANTS ================= */
const TIME_FILTERS = [
  { id: "all_periods", label: "All Periods" },
  { id: "current_month", label: "Current Month" },
  { id: "last_month", label: "Last Month" },
  { id: "quarter_to_date", label: "Quarter To Date" },
  { id: "year_to_date", label: "Year To Date" },
];

const CURRENCY_FILTERS = [
  { id: "actualvalue", label: "Actual Value" },
  { id: "thousands", label: "Thousands" },
  { id: "millions", label: "Millions" },
];

const safePct = (v) =>
  Number.isFinite(Number(v)) ? `${Number(v).toFixed(getDecimalPrecision())}%` : "-";

const getDummyInsights = ({ timeFilter, currencyFilter, selectedEntity }) => [
  {
    title: "Balance Health",
    text: `Assets are currently stronger than liabilities${
      selectedEntity ? ` for ${selectedEntity}` : ""
    }, indicating a stable financial position.`,
    tone: "positive",
  },
  {
    title: "Liquidity Signal",
    text: `Current ratio appears healthy in ${timeFilter.replaceAll(
      "_",
      " "
    )}, suggesting short-term obligations are manageable.`,
    tone: "neutral",
  },
  {
    title: "Scale Awareness",
    text: `All values are displayed in ${
      currencyFilter === "thousands" ? "thousands" : currencyFilter === "millions" ? "millions" : "actual value"
    }, which may smooth short-term volatility.`,
    tone: "info",
  },
];

/* ================= MAIN ================= */
export default function BalanceSheetViewMore() {
  const { token, selectedYear, selectedCurrency } = useContext(AuthContext);

  const [rows, setRows] = useState([]);
  const [entities, setEntities] = useState([]);

  const [loading, setLoading] = useState(false);
  const [timeFilter, setTimeFilter] = useState("all_periods");
  const [currencyFilter, setCurrencyFilter] = useState("actualvalue");
  const [selectedEntity, setSelectedEntity] = useState("");

  const getLabel = (list, value) => list.find((i) => i.id === value)?.label || value;

  /* ================= FETCH ================= */
  useEffect(() => {
    if (!token || !selectedYear || !selectedCurrency) return;

    const controller = new AbortController();

    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();

        if (timeFilter) params.append("time_filter", timeFilter);
        if (currencyFilter) params.append("currency_filter", currencyFilter);
        if (selectedEntity) params.append("entity", selectedEntity);

        const res = await fetch(
          `${API_BASE_URL}/api/v1/company/financial/balance_sheet_statement/${selectedYear}/${selectedCurrency}?${params}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
            signal: controller.signal,
          }
        );

        const json = await res.json();

        // Extract rows and entities
        const dataRows = [];
        let entityList = [];

        json.forEach((item) => {
          if (item.account_type) dataRows.push(item);
          if (item.entities) entityList = item.entities;
        });

        setRows(dataRows);
        setEntities(entityList);
      } catch (e) {
        if (e.name !== "AbortError") console.error("Balance Sheet Error", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    return () => controller.abort();
  }, [token, selectedYear, selectedCurrency, timeFilter, currencyFilter, selectedEntity]);

  /* ================= GROUP ================= */
  const grouped = useMemo(() => {
    const g = { Asset: [], Liability: [], Equity: [] };

    rows.forEach((r) => {
      const type = r.account_type?.toLowerCase();
      if (type === "asset") g.Asset.push(r);
      else if (type === "liability") g.Liability.push(r);
      else if (type === "equity") g.Equity.push(r);
    });

    return g;
  }, [rows]);

  /* ================= UI ================= */
  return (
    <main className="bg-slate-50 min-h-screen space-y-6 p-4">

      {/* ===== HEADER ===== */}
      <div className="bg-gradient-to-r from-sky-900 to-sky-700 text-white p-5 rounded-xl">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold">Balance Sheet</h1>
            <p className="text-s opacity-90">Assets, Liabilities & Equity</p>
          </div>
          <div className="flex gap-4 text-s">
            <span>Year: <b>{selectedYear}</b></span>
            <span>Currency: <b>{selectedCurrency}</b></span>
          </div>
        </div>
      </div>

      {/* ===== FILTER BAR ===== */}
      <div className="bg-white rounded-xl px-4 py-3 flex items-center gap-4 justify-between sticky top-0 z-20 border shadow-sm">
        {/* LEFT — LABEL */}
        <div className="text-x font-semibold text-sky-900 flex gap-2 flex-wrap">
          <span>Balance Sheet</span>
          <span className="text-slate-400">•</span>
          <span>{getLabel(TIME_FILTERS, timeFilter)}</span>
          <span className="text-slate-400">•</span>
          <span>{selectedEntity || "All Entities"}</span>
          <span className="text-slate-400">•</span>
          <span>{getLabel(CURRENCY_FILTERS, currencyFilter)}</span>
        </div>

        {/* RIGHT — DROPDOWNS */}
        <div className="flex gap-2 items-center shrink-0">
          {/* ENTITY */}
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="px-3 py-2 text-x border border-sky-500 text-sky-900 font-bold rounded-lg bg-white"
          >
            <option value="">All Entities</option>
            {entities.map((e) => (
              <option key={e.entity_id} value={e.entity_name}>
                {e.entity_name}
              </option>
            ))}
          </select>

          {/* TIME FILTER */}
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="px-3 py-2 text-x border border-sky-500 text-sky-900 font-bold rounded-lg bg-white"
          >
            {TIME_FILTERS.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>

          {/* CURRENCY */}
          <select
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
            className="px-3 py-2 text-x border border-sky-500 text-sky-900 font-bold rounded-lg bg-white"
          >
            {CURRENCY_FILTERS.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>

          <FiFilter className="text-sky-700" />
        </div>
      </div>

      {/* ===== TABLE CONTENT ===== */}
      {loading && <TableSkeleton />}

      {!loading && (
        <div className="space-y-6">
          <BalanceTable title="Assets" rows={grouped.Asset} />
          <BalanceTable title="Liabilities" rows={grouped.Liability} />
          <BalanceTable title="Equity" rows={grouped.Equity} />
        </div>
      )}

      {/* ===== AI INSIGHTS ===== */}
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <h3 className="text-s font-semibold text-sky-900 mb-3">🤖 AI Insights</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {getDummyInsights({ timeFilter, currencyFilter, selectedEntity }).map((insight, i) => (
            <div
              key={i}
              className={`rounded-lg p-3 text-x border ${
                insight.tone === "positive"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : insight.tone === "neutral"
                  ? "bg-sky-50 border-sky-200 text-sky-900"
                  : "bg-slate-50 border-slate-200 text-slate-700"
              }`}
            >
              <p className="font-semibold mb-1">{insight.title}</p>
              <p className="leading-relaxed">{insight.text}</p>
            </div>
          ))}
        </div>
      </div>

    </main>
  );
}

/* ================= TABLE ================= */
const BalanceTable = ({ title, rows }) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl border p-4 overflow-x-auto">
    <h3 className="font-semibold text-sky-900 mb-3">{title}</h3>

    <table className="w-full text-s">
      <thead className="bg-sky-900 text-white">
        <tr>
          <th className="p-2 text-left">Account</th>
          <th className="p-2 text-center">Period</th>
          <th className="p-2 text-right">Current</th>
          <th className="p-2 text-right">Previous</th>
          <th className="p-2 text-right">Change</th>
          <th className="p-2 text-right">% Change</th>
        </tr>
      </thead>
      <tbody>
        {rows.length > 0 ? (
          rows.map((r, i) => {
            const change = Number(r.change_value);
            return (
              <tr key={i} className="border-b hover:bg-sky-50">
                <td className="p-2">{r.account_name}</td>
                <td className="p-2 text-center">{r.period?.slice(0, 10) ?? "-"}</td>
                <td className="p-2 text-right font-semibold">{r.current_value ?? "-"}</td>
                <td className="p-2 text-right">{r.previous_value ?? "-"}</td>
                <td className={`p-2 text-right font-medium ${Number.isFinite(change) ? (change < 0 ? "text-red-600" : "text-emerald-600") : ""}`}>{r.change_value ?? "-"}</td>
                <td className="p-2 text-right">{safePct(r.change_pct)}</td>
              </tr>
            );
          })
        ) : (
          <tr>
            <td colSpan={6} className="p-4 text-center text-slate-400">
              No data available
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </motion.div>
);
