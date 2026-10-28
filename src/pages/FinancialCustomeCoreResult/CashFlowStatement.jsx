import React, { useContext, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiChevronDown } from "react-icons/fi";
import AddAutomation from "../FinancialReports/AddAutomation";
import ViewMoreHeader, { VIEW_MORE_FILTER_BAR, ViewMoreSelect } from "./ViewMoreHeader";
import { AuthContext } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config/config";
import TableSkeleton from "../Skeleton/TableSkeleton";
import { getDecimalPrecision } from '../../utils/formatters';

/* ================= UTILS ================= */

const safeNum = (v) => {
  const cleaned = typeof v === "string" ? v.replace(/,/g, "") : v;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const formatCurrency = (v, currency) => {
  const num = safeNum(v);
  const dp = getDecimalPrecision();
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(num);
};

const normalizeRows = (section) => {
  if (Array.isArray(section)) {
    // quarterly detailed: filter out ai_driver entries
    return section.filter((r) => r && r.period);
  }
  if (Array.isArray(section?.data)) {
    // monthly detailed: { data: [...], ai_driver: [...] }
    return section.data.filter((r) => r && r.period);
  }
  return [];
};

const getAllPeriodRows = (payload) => {
  if (Array.isArray(payload)) {
    return payload.filter((r) => r && !r.entities && r.period);
  }
  return Object.entries(payload || {})
    .filter(([key]) => key !== "entities")
    .flatMap(([, section]) => normalizeRows(section));
};

const periodSortValue = (period) => {
  const value = String(period || "");
  const monthMatch = value.match(/^(\d{4})-(\d{2})/);
  if (monthMatch) return Number(monthMatch[1]) * 12 + Number(monthMatch[2]);

  const quarterMatch = value.match(/^(\d{4})Q([1-4])$/);
  if (quarterMatch) return Number(quarterMatch[1]) * 4 + Number(quarterMatch[2]);

  return 0;
};

const sameReportYear = (period, latestPeriod) =>
  String(period || "").slice(0, 4) === String(latestPeriod || "").slice(0, 4);

const sameQuarter = (period, latestPeriod) => {
  const value = String(period || "");
  const latest = String(latestPeriod || "");
  if (/^\d{4}Q[1-4]$/.test(value) && /^\d{4}Q[1-4]$/.test(latest)) {
    return value === latest;
  }

  const month = Number(value.slice(5, 7));
  const latestMonth = Number(latest.slice(5, 7));
  if (!month || !latestMonth) return false;

  return sameReportYear(value, latest) &&
    Math.ceil(month / 3) === Math.ceil(latestMonth / 3);
};

const shouldKeepPeriod = (period, selectedFilter, latestPeriod) => {
  if (selectedFilter === "all_periods") return true;
  if (!period || !latestPeriod) return false;

  const current = periodSortValue(period);
  const latest = periodSortValue(latestPeriod);

  if (selectedFilter === "current_month") return current === latest;
  if (selectedFilter === "last_month") return current === latest - 1;
  if (selectedFilter === "quarter_to_date") {
    return sameQuarter(period, latestPeriod) && current <= latest;
  }
  if (selectedFilter === "year_to_date") {
    return sameReportYear(period, latestPeriod) && current <= latest;
  }

  return true;
};

const filterCashFlowByPeriod = (payload, selectedFilter) => {
  if (selectedFilter === "all_periods") return payload;

  const allRows = getAllPeriodRows(payload);
  const latestPeriod = allRows
    .map((row) => row.period)
    .filter(Boolean)
    .sort((a, b) => periodSortValue(a) - periodSortValue(b))
    .at(-1);

  if (!latestPeriod) return payload;

  if (Array.isArray(payload)) {
    return payload.filter((row) =>
      row?.entities || shouldKeepPeriod(row?.period, selectedFilter, latestPeriod)
    );
  }

  return Object.fromEntries(
    Object.entries(payload || {}).flatMap(([account, section]) => {
      if (account === "entities") return [[account, section]];
      const rows = normalizeRows(section).filter((row) =>
        shouldKeepPeriod(row.period, selectedFilter, latestPeriod)
      );

      if (!rows.length) return [];
      if (Array.isArray(section)) return [[account, rows]];
      return [[account, { ...section, data: rows }]];
    })
  );
};

const hasCashFlowRows = (payload) => getAllPeriodRows(payload).length > 0;

const normalizeEntities = (items = []) =>
  items
    .map((entity) => {
      const id = entity?.entity_id ?? entity?.id;
      if (id === undefined || id === null) return null;

      return {
        entity_id: String(id),
        entity_name: entity?.entity_name ?? entity?.name ?? String(id),
      };
    })
    .filter(Boolean);

/* ================= MAIN ================= */

export default function CashFlowStatement() {
  const { token, selectedYear, selectedCurrency } = useContext(AuthContext);

  const [data, setData] = useState(null);
  const [entities, setEntities] = useState([]);
  const [open, setOpen] = useState({});
  const [loading, setLoading] = useState(false);

  /* FILTERS */
  const [timeFilter, setTimeFilter] = useState("monthly");
  const [periodFilter, setPeriodFilter] = useState("all_periods");
  const [viewFilter, setViewFilter] = useState("detailed_view");
  const [currencyFilter, setCurrencyFilter] = useState("actualvalue");
  const [entity, setEntity] = useState("All");
  const [autoOpened, setAutoOpened] = useState(false);

  const [metrics, setMetrics] = useState(null);

  const isSummaryView = viewFilter === "summery_view";

  /* ================= FETCH ================= */

  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.append("time_filter", timeFilter);
        params.append("view_filter", viewFilter);
        params.append("currency_filter", currencyFilter);
        if (entity !== "All") params.append("entity", String(entity));

        const res = await fetch(
          `${API_BASE_URL}/api/v1/company/financial/cashflow_statement_viewmore/${selectedYear}/${selectedCurrency}?${params}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const json = await res.json();
        const filteredJson = filterCashFlowByPeriod(json, periodFilter);
        setData(hasCashFlowRows(filteredJson) ? filteredJson : null);
        setAutoOpened(false);

        /* ENTITIES */
        if (Array.isArray(json)) {
          const ent = json.find((r) => r.entities);
          setEntities([{ entity_id: "All", entity_name: "All" }, ...normalizeEntities(ent?.entities || [])]);
        } else if (json?.entities) {
          setEntities([{ entity_id: "All", entity_name: "All" }, ...normalizeEntities(json.entities)]);
        } else {
          setEntities([{ entity_id: "All", entity_name: "All" }]);
        }

        /* METRICS — sum all period rows across accounts */
        let operating = 0, investing = 0, financing = 0, net = 0;

        const allRows = getAllPeriodRows(filteredJson);

        allRows.forEach((r) => {
          operating += safeNum(r.operating_cf);
          investing += safeNum(r.investing_cf);
          financing += safeNum(r.financing_cf);
          net       += safeNum(r.net_cash_change);
        });

        setMetrics({ operating, investing, financing, net });
      } catch (e) {
        console.error("Cashflow error", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, selectedYear, selectedCurrency, timeFilter, periodFilter, viewFilter, currencyFilter, entity]);

  /* ================= AUTO OPEN FIRST ACCOUNT ================= */

  useEffect(() => {
    if (!data || isSummaryView || Array.isArray(data) || autoOpened) return;

    const allOpen = Object.keys(data)
      .filter((k) => k !== "entities")
      .reduce((acc, k) => ({ ...acc, [k]: true }), {});

    setOpen(allOpen);
    setAutoOpened(true);
  }, [data, isSummaryView, autoOpened]);

  /* ================= UI ================= */

  return (
    <main className="bg-slate-50 min-h-screen space-y-3">

      <ViewMoreHeader title="Cash Flow Statement" year={selectedYear} currency={selectedCurrency}>
        <AddAutomation reportType="cash_flow_statement" reportLabel="Cash Flow Statement" iconOnly />
      </ViewMoreHeader>

      {/* METRICS CARDS */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard title="Operating CF"  value={metrics.operating}  currency={selectedCurrency} />
          <MetricCard title="Investing CF"  value={metrics.investing}  currency={selectedCurrency} />
          <MetricCard title="Financing CF"  value={metrics.financing}  currency={selectedCurrency} />
          <MetricCard title="Net Cash"      value={metrics.net}        currency={selectedCurrency} />
        </div>
      )}

      {/* FILTER BAR */}
      <div className={VIEW_MORE_FILTER_BAR}>
        <div className="flex flex-wrap justify-end items-center gap-2 ml-auto">

          <FilterSelect
            label="Period"
            value={periodFilter}
            onChange={setPeriodFilter}
            options={[
              { value: "all_periods",      label: "All Periods" },
              { value: "current_month",    label: "Current Month" },
              { value: "last_month",       label: "Last Month" },
              { value: "quarter_to_date",  label: "Quarter to Date" },
              { value: "year_to_date",     label: "Year to Date" },
            ]}
          />

          <FilterSelect
            label="View Period"
            value={timeFilter}
            onChange={setTimeFilter}
            options={[
              { value: "monthly",   label: "Monthly" },
              { value: "quarterly", label: "Quarterly" },
            ]}
          />

          <FilterSelect
            label="View Type"
            value={viewFilter}
            onChange={setViewFilter}
            options={[
              { value: "summery_view",  label: "Summary" },
              { value: "detailed_view", label: "Detailed" },
            ]}
          />

          <FilterSelect
            label="Entity"
            value={entity}
            onChange={setEntity}
            options={entities.map((e) => ({ value: e.entity_id, label: e.entity_name }))}
          />

          <FilterSelect
            label="Currency View"
            value={currencyFilter}
            onChange={setCurrencyFilter}
            options={[
              { value: "actualvalue", label: "Actual" },
              { value: "thousands",   label: "Thousands" },
              { value: "millions",    label: "Millions" },
            ]}
          />
        </div>
      </div>

      {loading && <TableSkeleton />}

      {/* SUMMARY VIEW */}
      {!loading && isSummaryView && Array.isArray(data) && (
        <SummaryTable
          rows={data.filter((r) => r && !r.entities && r.period)}
          currency={selectedCurrency}
        />
      )}

      {/* DETAILED VIEW */}
      {!loading && !isSummaryView && data && !Array.isArray(data) && (
        <div className="space-y-3">
          {Object.entries(data)
            .filter(([k]) => k !== "entities")
            .map(([account, section]) => {
              const rows = normalizeRows(section);
              if (!rows.length) return null;

              const isOpen = !!open[account];
              const totals = rows.reduce(
                (acc, r) => ({
                  operating: acc.operating + safeNum(r.operating_cf),
                  investing: acc.investing + safeNum(r.investing_cf),
                  financing: acc.financing + safeNum(r.financing_cf),
                  net:       acc.net       + safeNum(r.net_cash_change),
                }),
                { operating: 0, investing: 0, financing: 0, net: 0 }
              );

              return (
                <div key={account} className="bg-white rounded-xl border border-sky-200 shadow-sm overflow-hidden">
                  {/* ACCOUNT HEADER */}
                  <button
                    onClick={() => setOpen((o) => ({ ...o, [account]: !o[account] }))}
                    className="w-full flex justify-between items-center px-5 py-3 bg-sky-900 text-white"
                  >
                    <span className="font-semibold tracking-wide">{account.toUpperCase()}</span>
                    <div className="flex items-center gap-6 text-s">
                      <span className="opacity-80">
                        Net: <b>{formatCurrency(totals.net, selectedCurrency)}</b>
                      </span>
                      <FiChevronDown
                        className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                      />
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <DetailTable
                          rows={rows}
                          currency={selectedCurrency}
                          totals={totals}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
        </div>
      )}

      {/* NO DATA */}
      {!loading && !data && (
        <div className="text-center py-16 text-slate-400 text-s">
          No cash flow data available.
        </div>
      )}
    </main>
  );
}

/* ================= SUB-COMPONENTS ================= */

const FilterSelect = ViewMoreSelect;

const MetricCard = ({ title, value, currency }) => {
  const num = value;
  const isNeg = num < 0;
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="bg-gradient-to-br from-sky-900 to-sky-700 text-white p-4 rounded-xl shadow"
    >
      <p className="text-x opacity-80 mb-1">{title}</p>
      <p className={`text-lg font-bold ${isNeg ? "text-red-300" : "text-white"}`}>
        {formatCurrency(num, currency)}
      </p>
    </motion.div>
  );
};

const SUMMARY_METRICS = [
  { key: "operating_cf",    label: "OPERATING CASH FLOW" },
  { key: "investing_cf",    label: "INVESTING CASH FLOW" },
  { key: "financing_cf",    label: "FINANCING CASH FLOW" },
  { key: "net_cash_change", label: "NET CASH",            highlight: true },
];

const SummaryTable = ({ rows, currency }) => {
  const periods = rows.map((r) => r.period || r.quarter || "--");
  return (
    <div className="bg-white rounded-xl border border-sky-200 overflow-x-auto shadow-sm">
      <table className="w-full text-x">
        <thead className="bg-sky-900 text-white">
          <tr>
            <th className="px-4 py-3 text-left font-semibold sticky left-0 bg-sky-900 min-w-[200px]">METRICS</th>
            {periods.map((p, i) => (
              <th key={i} className="px-4 py-3 text-right font-semibold whitespace-nowrap">{p}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SUMMARY_METRICS.map((m) => (
            <tr key={m.key} className="border-b border-sky-50 hover:bg-sky-50 transition-colors">
              <td className="px-4 py-3 font-semibold text-sky-900 sticky left-0 bg-white">{m.label}</td>
              {rows.map((r, i) => (
                <td
                  key={i}
                  className={`px-4 py-3 text-right ${
                    m.highlight
                      ? safeNum(r[m.key]) < 0
                        ? "text-red-600 font-semibold"
                        : "text-emerald-600 font-semibold"
                      : ""
                  }`}
                >
                  {formatCurrency(r[m.key], currency)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const DETAIL_METRICS = [
  { key: "operating_cf",    label: "Operating",  totalKey: "operating" },
  { key: "investing_cf",    label: "Investing",  totalKey: "investing" },
  { key: "financing_cf",    label: "Financing",  totalKey: "financing" },
  { key: "net_cash_change", label: "Net Cash",   totalKey: "net", highlight: true },
];

const DetailTable = ({ rows, currency, totals }) => {
  const periods = rows.map((r) => r.period || r.quarter || "--");
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-x">
        <thead className="bg-sky-50 border-b border-sky-200">
          <tr>
            <th className="px-4 py-2 text-left font-semibold text-sky-800 sticky left-0 bg-sky-50 min-w-[130px]">Metric</th>
            {periods.map((p, i) => (
              <th key={i} className="px-4 py-2 text-right font-semibold text-sky-800 whitespace-nowrap">{p}</th>
            ))}
            <th className="px-4 py-2 text-right font-semibold text-sky-800">Total</th>
          </tr>
        </thead>
        <tbody>
          {DETAIL_METRICS.map((m) => (
            <tr key={m.key} className="border-b border-sky-50 hover:bg-sky-50 transition-colors">
              <td className="px-4 py-2.5 text-sky-700 font-medium sticky left-0 bg-white">{m.label}</td>
              {rows.map((r, i) => (
                <td
                  key={i}
                  className={`px-4 py-2.5 text-right ${
                    m.highlight
                      ? safeNum(r[m.key]) < 0
                        ? "text-red-600 font-semibold"
                        : "text-emerald-600 font-semibold"
                      : ""
                  }`}
                >
                  {formatCurrency(r[m.key], currency)}
                </td>
              ))}
              <td
                className={`px-4 py-2.5 text-right font-semibold ${
                  m.highlight
                    ? totals[m.totalKey] < 0
                      ? "text-red-600"
                      : "text-emerald-600"
                    : "text-sky-900"
                }`}
              >
                {formatCurrency(totals[m.totalKey], currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
