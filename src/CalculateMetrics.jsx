// CashFlowReport.jsx
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  FiBarChart2,
  FiPlusCircle,
  FiTrash2,
  FiRefreshCw,
  FiSearch,
  FiChevronDown,
  FiChevronUp,
  FiCode,
  FiInfo,
} from "react-icons/fi";

import { API_BASE_URL } from "./config/config";
import { AuthContext } from "./context/AuthContext";
import { getDecimalPrecision } from "./utils/formatters";

import { Bar, Line, Pie, Doughnut, Radar, Bubble } from "react-chartjs-2";
import { Chart as ChartJS } from "chart.js/auto";

/* =========================
   Helpers / Theme
========================= */
const cx = (...cls) => cls.filter(Boolean).join(" ");

const SKY = {
  50: "#f0f9ff",
  100: "#e0f2fe",
  200: "#bae6fd",
  300: "#7dd3fc",
  400: "#38bdf8",
  500: "#0ea5e9",
  600: "#0284c7",
  700: "#0369a1",
  800: "#075985",
  900: "#0c4a6e",
};

const chartTypeMap = {
  bar_chart: "bar",
  line_chart: "line",
  pie_chart: "pie",
  doughnut_chart: "doughnut",
  Doughnut_chart: "doughnut",
  Doughnut_Chart: "doughnut",
  bubble_chart: "bubble",
  radar_chart: "radar",
};

const CFG_KEYS = new Set(["position", "chart_type", "enableordisable"]);

function toTitle(key) {
  return String(key)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function safeNum(v) {
  if (v === null || v === undefined || v === "") return null;
  // Stored/derived metric amounts are currency-formatted strings (e.g. "45,000.00") -
  // Number() returns NaN on the thousands separator, so strip it first.
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatMoney(n) {
  if (n === null) return "-";
  const dp = getDecimalPrecision();
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function trendKeyToBase(trendKey) {
  return String(trendKey || "").replace(/_trend$/i, "");
}

function normalizeFormulaToBase(formula) {
  // convert any *_trend in pasted formula => base token
  return String(formula || "").replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)_trend\b/gi, "$1");
}

function extractBaseRefs(formula) {
  const s = String(formula || "");
  const matches = s.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];

  const reserved = new Set([
    "if",
    "else",
    "then",
    "and",
    "or",
    "not",
    "min",
    "max",
    "abs",
    "round",
    "floor",
    "ceil",
    "pow",
    "sqrt",
    "log",
    "ln",
    "exp",
    "pi",
    "e",
    "true",
    "false",
    "null",
  ]);

  const uniq = [];
  for (const t of matches) {
    const low = t.toLowerCase();
    if (reserved.has(low)) continue;
    if (/^\d/.test(t)) continue;
    uniq.push(t);
  }
  return Array.from(new Set(uniq));
}

function pickValueKeyFromPoints(points = []) {
  const ignore = new Set(["period", "position", "chart_type", "enableordisable"]);
  const sample = points.find((p) => p && typeof p === "object" && p.period) || points[0] || {};
  const keys = Object.keys(sample).filter((k) => !ignore.has(k));
  for (const k of keys) if (safeNum(sample[k]) !== null) return k;
  return keys[0] || null;
}

function getValueFieldLabel(points = []) {
  const key = pickValueKeyFromPoints(points);
  return key ? toTitle(key) : "-";
}

function hasAnyPeriod(points = []) {
  return Array.isArray(points) && points.some((p) => p && typeof p === "object" && "period" in p);
}

function getTrendEntries(metricsApiResponse) {
  const items = Array.isArray(metricsApiResponse?.metrics) ? metricsApiResponse.metrics : [];

  return items
    .map((obj, idx) => {
      const entry = Object.entries(obj || {})[0];
      if (!entry) return null;

      const [trendKey, arr] = entry;
      const rows = Array.isArray(arr) ? arr : [];

      const maybeConfig = rows.length ? rows[rows.length - 1] : null;
      const hasConfig =
        maybeConfig &&
        typeof maybeConfig === "object" &&
        ("chart_type" in maybeConfig || "position" in maybeConfig || "enableordisable" in maybeConfig);

      const config = hasConfig ? maybeConfig : null;
      const points = hasConfig ? rows.slice(0, -1) : rows;

      const enabled = typeof config?.enableordisable === "boolean" ? config.enableordisable : true;

      return {
        id: `${trendKey}-${idx}`,
        key: trendKey, // e.g. expense_trend
        baseKey: trendKeyToBase(trendKey), // e.g. expense
        title: toTitle(trendKey),
        config,
        points,
        enabled,
      };
    })
    .filter(Boolean);
}

function getAvailableBaseKeys(raw, onlyEnabled = true) {
  const items = Array.isArray(raw?.metrics) ? raw.metrics : [];
  const out = [];

  for (const obj of items) {
    const entry = Object.entries(obj || {})[0];
    if (!entry) continue;

    const [trendKey, arr] = entry;
    const rows = Array.isArray(arr) ? arr : [];
    const last = rows.length ? rows[rows.length - 1] : null;

    const hasCfg =
      last &&
      typeof last === "object" &&
      Object.keys(last).some((k) => CFG_KEYS.has(k));

    const enabled = hasCfg ? !!last.enableordisable : true;

    if (!onlyEnabled || enabled) out.push(trendKeyToBase(trendKey));
  }

  return Array.from(new Set(out)).sort((a, b) => a.localeCompare(b));
}

function TrendPreviewLine({ points }) {
  // If points are nested (no period), show a useful summary
  if (!hasAnyPeriod(points)) {
    const p0 = points?.[0];
    const keys = p0 && typeof p0 === "object" ? Object.keys(p0) : [];
    if (keys.length) {
      return (
        <div className="text-x text-sky-700/70">
          Nested series: <span className="font-semibold text-sky-900">{keys.slice(0, 4).join(", ")}</span>
          {keys.length > 4 ? <span className="text-sky-700/50"> (+{keys.length - 4} more)</span> : null}
        </div>
      );
    }
    return <div className="text-x text-sky-700/70">No point data</div>;
  }

  const sample = points.slice(0, 3);
  const rest = points.length - sample.length;

  const text = sample
    .map((p) => {
      const period = p.period ?? "-";
      const numKey = Object.keys(p).find((k) => k !== "period" && safeNum(p[k]) !== null);
      const numVal = numKey ? safeNum(p[numKey]) : null;
      return `${period}: ${formatMoney(numVal)}`;
    })
    .join("  •  ");

  return (
    <div className="text-x text-sky-700/70">
      {text}
      {rest > 0 ? <span className="ml-2 text-sky-700/50">(+{rest} more)</span> : null}
    </div>
  );
}

function buildChartJsData(points = [], label = "Value") {
  const rows = (points || []).filter((p) => p?.period);
  const labels = rows.map((r) => r.period);
  const valueKey = pickValueKeyFromPoints(rows);
  const data = rows.map((r) => (valueKey ? safeNum(r[valueKey]) ?? 0 : 0));

  return {
    labels,
    datasets: [
      {
        label: valueKey ? toTitle(valueKey) : label,
        data,
        borderColor: SKY[700],
        backgroundColor: [SKY[200], SKY[300], SKY[400], SKY[500], SKY[600], SKY[700]],
        pointBackgroundColor: SKY[700],
        pointBorderColor: SKY[50],
        borderWidth: 2,
      },
    ],
  };
}

function getChartOptions(type) {
  const isCircle = type === "pie" || type === "doughnut";
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "bottom" }, tooltip: { enabled: true } },
    scales: isCircle
      ? undefined
      : {
        x: { grid: { display: false } },
        y: { grid: { color: "rgba(2,132,199,0.10)" } },
      },
  };
}

function MetricChart({ points, chartTypeFromApi, title }) {
  // If nested series, chart is not supported by this simple builder
  if (!hasAnyPeriod(points)) {
    return (
      <div className="h-full flex items-center justify-center text-s text-sky-700/60 text-center px-4">
        Chart not available for nested series.
        <br />
        Please expand table to view values.
      </div>
    );
  }

  const type = chartTypeMap[chartTypeFromApi] || "bar";
  const data = useMemo(() => buildChartJsData(points, title), [points, title]);
  const options = useMemo(() => getChartOptions(type), [type]);

  const Comp = { line: Line, bar: Bar, pie: Pie, doughnut: Doughnut, radar: Radar, bubble: Bubble }[type] || Bar;

  const noData =
    !Array.isArray(data?.labels) ||
    data.labels.length === 0 ||
    !Array.isArray(data?.datasets) ||
    data.datasets.length === 0;

  if (noData) return <div className="h-full flex items-center justify-center text-s text-sky-700/60">No chart data</div>;
  return <Comp data={data} options={options} />;
}

function insertAtCursor(inputEl, textToInsert) {
  if (!inputEl) return;
  const start = inputEl.selectionStart ?? inputEl.value.length;
  const end = inputEl.selectionEnd ?? inputEl.value.length;
  const before = inputEl.value.slice(0, start);
  const after = inputEl.value.slice(end);
  const next = before + textToInsert + after;
  inputEl.value = next;
  const caret = start + textToInsert.length;
  inputEl.setSelectionRange(caret, caret);
  inputEl.focus();
  return next;
}

/* =========================
   Main Component (2 Tabs)
========================= */
export default function CashFlowReport() {
  const { token, selectedYear: year, selectedCurrency } = useContext(AuthContext);
  const currency = selectedCurrency || "USD";

  const [activeTab, setActiveTab] = useState("metrics"); // metrics | derived
  const [loading, setLoading] = useState(false);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
const [loadingDerived, setLoadingDerived] = useState(false);
const [loadingDeleteMetric, setLoadingDeleteMetric] = useState(false);
const [loadingDeleteDerived, setLoadingDeleteDerived] = useState(false);
const [loadingFetch, setLoadingFetch] = useState(false);

  const [metricsRaw, setMetricsRaw] = useState(null);
  const [derivedRaw, setDerivedRaw] = useState(null);

  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState("actualvalue");

  // Add Metric form
  const [metricName, setMetricName] = useState("");
  const [accountName, setAccountName] = useState("");

  // Add Derived form
  const [derivedName, setDerivedName] = useState("");
  const [derivedFormula, setDerivedFormula] = useState("");
  const [derivedDisplayIn, setDerivedDisplayIn] = useState("financial_overview");
  const formulaRef = useRef(null);

  // Delete selection
  const [deleteMetricKey, setDeleteMetricKey] = useState("");
  const [deleteDerivedKey, setDeleteDerivedKey] = useState("");


  const [accountDropdown, setAccountDropdown] = useState([]);
  const [derivedDropdown, setDerivedDropdown] = useState([]);

  const headers = useMemo(
    () => ({
      accept: "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const metrics = useMemo(() => getTrendEntries(metricsRaw), [metricsRaw]);
  const derivedMetrics = useMemo(() => getTrendEntries(derivedRaw), [derivedRaw]);

  // derivedRaw ("/derived-metric/all") returns every metric_trend entry - both
  // regular metrics and previously created derived metrics - so formulas can
  // reference either kind, not just regular ones.
  const enabledMetricBaseTokens = useMemo(() => getAvailableBaseKeys(derivedRaw, true), [derivedRaw]);

  const filteredMetrics = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return metrics;
    return metrics.filter(
      (m) =>
        m.key.toLowerCase().includes(q) ||
        m.baseKey.toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q) ||
        (m.config?.chart_type || "").toLowerCase().includes(q)
    );
  }, [metrics, search]);

  const filteredDerived = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return derivedMetrics;
    return derivedMetrics.filter(
      (m) =>
        m.key.toLowerCase().includes(q) ||
        m.baseKey.toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q) ||
        (m.config?.chart_type || "").toLowerCase().includes(q)
    );
  }, [derivedMetrics, search]);

async function fetchAll() {
  if (!token || !year) return;

  const toastId = toast.loading("Loading financial metrics...");

  try {
    setLoadingFetch(true);

    const [metricsRes, derivedRes] = await Promise.all([
      axios.get(`${API_BASE_URL}/api/v1/company/financial/metric/all/${year}`, { headers }),
      axios.get(`${API_BASE_URL}/api/v1/company/financial/derived-metric/all/${year}`, { headers }),
    ]);

    setMetricsRaw(metricsRes.data);
    setDerivedRaw(derivedRes.data);

    toast.update(toastId, {
      render: "Reports loaded successfully ✅",
      type: "success",
      isLoading: false,
      autoClose: 2000,
    });
  } catch (err) {
    toast.update(toastId, {
      render: "Failed to load reports ❌",
      type: "error",
      isLoading: false,
      autoClose: 3000,
    });
  } finally {
    setLoadingFetch(false);
  }
}

useEffect(() => {
  fetchAll();
  fetchAccountDropdown();
  fetchDerivedDropdown();   // 👈 ADD THIS
}, [token, year, currencyFilter]);




  async function fetchAccountDropdown() {
    try {
      const url =
        `${API_BASE_URL}/api/v1/company/financial/metric/add/${year}/${currency}` +
        `?currency_filter=${currencyFilter}`;

      const res = await axios.post(url, "", { headers });

      if (res?.data?.dropdown_list) {
        setAccountDropdown(res.data.dropdown_list);
      }
    } catch (err) {
      console.error("Dropdown fetch error", err);
    }
  }



  async function fetchDerivedDropdown() {
  try {
    const url =
      `${API_BASE_URL}/api/v1/company/financial/derived-metric/add/${year}/${currency}` +
      `?currency_filter=${currencyFilter}`;

    const res = await axios.post(url, "", { headers });

    if (res?.data?.dropdown_list) {
      setDerivedDropdown(res.data.dropdown_list);
    }
  } catch (err) {
    console.error("Derived dropdown fetch error", err);
  }
}

 async function handleAddMetric(e) {
  e.preventDefault();

  if (!metricName) return toast.warn("Enter metric_name");
  if (!accountName) return toast.warn("Select account_name");

  const toastId = toast.loading("Adding metric...");

  try {
    setLoadingMetrics(true);

    const url =
      `${API_BASE_URL}/api/v1/company/financial/metric/add/${year}/${currency}` +
      `?metric_name=${encodeURIComponent(metricName)}` +
      `&account_name=${encodeURIComponent(accountName)}` +
      `&currency_filter=${encodeURIComponent(currencyFilter)}`;

    await axios.post(url, "", { headers });

    toast.update(toastId, {
      render: "Metric added successfully ✅",
      type: "success",
      isLoading: false,
      autoClose: 2000,
    });

    setMetricName("");
    setAccountName("");

    await fetchAll();
  } catch (err) {
    toast.update(toastId, {
      render: "Failed to add metric ❌",
      type: "error",
      isLoading: false,
      autoClose: 3000,
    });
  } finally {
    setLoadingMetrics(false);
  }
}

async function handleDeleteMetric(e) {
  e.preventDefault();

  if (!deleteMetricKey) return toast.warn("Select metric");

  const toastId = toast.loading("Deleting metric...");

  try {
    setLoadingDeleteMetric(true);

    const url =
      `${API_BASE_URL}/api/v1/company/financial/metric/delete/${year}/${deleteMetricKey}`;

    await axios.delete(url, { headers });

    toast.update(toastId, {
      render: "Metric deleted successfully 🗑️",
      type: "success",
      isLoading: false,
      autoClose: 2000,
    });

    setDeleteMetricKey("");
    await fetchAll();
  } catch (err) {
    toast.update(toastId, {
      render: "Delete failed ❌",
      type: "error",
      isLoading: false,
      autoClose: 3000,
    });
  } finally {
    setLoadingDeleteMetric(false);
  }
}

  async function handleAddDerived(e) {
    e.preventDefault();

    const name = derivedName.trim();
    let formula = derivedFormula.trim();

    if (!name) return toast.warn("Enter derived metric_name");
    if (!formula) return toast.warn("Enter formula");

    // backend expects NO _trend
    formula = normalizeFormulaToBase(formula);

    // unary minus normalize: "- expense" => "-(expense)"
    if (/^\-\s*[a-zA-Z_]/.test(formula)) {
      formula = formula.replace(/^\-\s*([a-zA-Z_][a-zA-Z0-9_]*)\b/, "-($1)");
    }

    // validate formula refs exist (enabled metrics base keys)
    const available = new Set(enabledMetricBaseTokens);
    const refs = extractBaseRefs(formula);
    const missing = refs.filter((r) => !available.has(r));

    if (missing.length) {
      toast.error(`Formula references metrics not in report: ${missing.join(", ")}`);
      return;
    }

    try {
      setLoading(true);
      const url =
        `${API_BASE_URL}/api/v1/company/financial/derived-metric/add/${year}/${currency}` +
        `?metric_name=${encodeURIComponent(name)}` +
        `&formula=${encodeURIComponent(formula)}` +
        `&currency_filter=${encodeURIComponent(currencyFilter)}` +
        `&display_in=${encodeURIComponent(derivedDisplayIn)}`;

      await axios.post(url, "", { headers });

      toast.success("Derived metric added.");
      setDerivedName("");
      setDerivedFormula("");
      setDerivedDisplayIn("financial_overview");
      await fetchAll();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to add derived metric.";
      toast.error(typeof msg === "string" ? msg : "Failed to add derived metric.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteDerived(e) {
    e.preventDefault();

    if (!deleteDerivedKey) return toast.warn("Select derived metric");

    try {
      setLoading(true);

      const url =
        `${API_BASE_URL}/api/v1/company/financial/derived-metric/delete/${year}/${deleteDerivedKey}`;

      await axios.delete(url, { headers });

      toast.success("Derived metric deleted");

      setDeleteDerivedKey("");

      await fetchAll();
    } catch (err) {
      console.error(err);
      toast.error("Delete failed");
    } finally {
      setLoading(false);
    }
  }

  const insertOp = (op) => {
    const el = formulaRef.current;
    if (!el) return;
    const next = insertAtCursor(el, op);
    if (typeof next === "string") setDerivedFormula(next);
  };

  const insertToken = (baseKey) => {
    if (!baseKey) return;
    insertOp(baseKey);
  };

  const MetricList = ({ data, emptyText = "No data found." }) => {
    if (!data?.length) {
      return (
        <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50 p-6 text-s text-sky-800/70">
          {emptyText}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {data.map((m) => {
          const open = expandedId === m.id;

          return (
            <div key={m.id} className="rounded-3xl border border-sky-100 overflow-hidden bg-white">
              <button
                onClick={() => setExpandedId(open ? null : m.id)}
                className="w-full px-4 py-4 flex items-start justify-between gap-4 hover:bg-sky-50/60 transition"
              >
                <div className="text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-bold text-sky-900">{m.title}</div>

                    {m.baseKey ? (
                      <span className="text-x rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-sky-900">
                        token: <b>{m.baseKey}</b>
                      </span>
                    ) : null}

                    <span className="text-x rounded-full border border-sky-200 bg-white px-2 py-0.5 text-sky-700">
                      value: <b className="text-sky-900">{getValueFieldLabel(m.points)}</b>
                    </span>

                    {m.config?.chart_type ? (
                      <span className="text-x rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-sky-800">
                        {m.config.chart_type}
                      </span>
                    ) : null}

                    {typeof m.config?.enableordisable === "boolean" ? (
                      <span
                        className={cx(
                          "text-x rounded-full px-2 py-0.5 border",
                          m.config.enableordisable
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-rose-200 bg-rose-50 text-rose-700"
                        )}
                      >
                        {m.config.enableordisable ? "Enabled" : "Disabled"}
                      </span>
                    ) : null}

                    {typeof m.config?.position === "number" ? (
                      <span className="text-x rounded-full border border-sky-200 bg-white px-2 py-0.5 text-sky-700">
                        position: {m.config.position}
                      </span>
                    ) : null}

                    {m.config?.display_in === "key_financial_kpis" ? (
                      <span className="text-x rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-indigo-700">
                        Key Financial KPIs
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-1">
                    <TrendPreviewLine points={m.points} />
                  </div>
                </div>

                <div className="mt-0.5 text-sky-900">{open ? <FiChevronUp /> : <FiChevronDown />}</div>
              </button>

              {open && (
                <div className="px-4 pb-5">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Table */}
                    <div className="overflow-auto rounded-2xl border border-sky-100">
                      <table className="min-w-full text-s">
                        <thead className="bg-sky-50">
                          <tr>
                            <th className="text-left px-3 py-2 font-semibold text-sky-900">Period</th>
                            <th className="text-left px-3 py-2 font-semibold text-sky-900">Values</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(m.points || []).length === 0 ? (
                            <tr>
                              <td colSpan={2} className="px-3 py-4 text-sky-700/70">
                                No rows available.
                              </td>
                            </tr>
                          ) : (
                            m.points.map((p, i) => {
                              const period = p?.period ?? "-";
                              const entries = Object.entries(p || {}).filter(([k]) => k !== "period");
                              return (
                                <tr key={i} className="border-t border-sky-100">
                                  <td className="px-3 py-2 text-sky-900 whitespace-nowrap">{period}</td>
                                  <td className="px-3 py-2 text-sky-900">
                                    <div className="flex flex-wrap gap-2">
                                      {entries.map(([k, v]) => (
                                        <span
                                          key={k}
                                          className="rounded-full border border-sky-200 bg-white px-2 py-0.5 text-x"
                                        >
                                          <span className="text-sky-800/70">{k}:</span>{" "}
                                          <span className="font-bold text-sky-900">
                                            {safeNum(v) !== null ? formatMoney(safeNum(v)) : Array.isArray(v) ? "[array]" : String(v)}
                                          </span>
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Chart */}
                    <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-sky-50 p-3">
                      <div className="text-s font-bold text-sky-900 mb-2">Chart Preview</div>
                      <div className="h-[320px]">
                        <MetricChart points={m.points} chartTypeFromApi={m.config?.chart_type} title={m.title} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full">
      {/* Top Header */}
      <div className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-900 via-sky-800 to-sky-700 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">Financial Metrics Management</h2>
            <p className="text-s text-white/80 mt-1">
              Year: <span className="font-semibold text-white">{year}</span> • Currency:{" "}
              <span className="font-semibold text-white">{currency}</span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            {/* <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-700/50" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, token, chart type..."
                className="w-full sm:w-80 rounded-2xl border border-sky-100 bg-white pl-10 pr-3 py-2 text-s outline-none focus:ring-2 focus:ring-sky-200"
              />
            </div> */}

            <button
              onClick={fetchAll}
              disabled={loading}
              className={cx(
                "inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2 text-s font-semibold",
                "border-sky-100 bg-white hover:bg-sky-50",
                loading && "opacity-60 cursor-not-allowed"
              )}
              title="Refresh"
            >
              <FiRefreshCw className={cx("text-sky-900", loading && "animate-spin")} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Tabs + currency filter */}
      <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
  onClick={() => {
    setActiveTab("metrics");
    setExpandedId(null);
    fetchAll(); // refresh
  }}
  className={cx(
    "inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-s font-semibold transition",
    activeTab === "metrics"
      ? "bg-sky-900 text-white shadow"
      : "bg-white border border-sky-100 text-sky-900 hover:bg-sky-50"
  )}
>
  <FiBarChart2 />
  Metrics
   <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-x">
    {derivedRaw?.total_metrics ?? derivedMetrics.length ?? 0}
  </span>
</button>
<button
  onClick={() => {
    setActiveTab("derived");
    setExpandedId(null);
    fetchAll(); // 🔄 refresh API when switching tab
  }}
  className={cx(
    "inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-s font-semibold transition",
    activeTab === "derived"
      ? "bg-sky-900 text-white shadow"
      : "bg-white border border-sky-100 text-sky-900 hover:bg-sky-50"
  )}
>
  <FiCode />
  Derived Metrics
  <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-x">
    {derivedRaw?.total_metrics ?? derivedMetrics.length ?? 0}
  </span>
</button>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-s text-sky-900">
            Currency Filter: <span className="font-semibold text-sky-800">{currencyFilter}</span>
          </div>
          <select
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
            className="w-full sm:w-56 rounded-2xl border border-sky-100 bg-white px-3 py-2 text-s outline-none focus:ring-2 focus:ring-sky-200"
          >
            <option value="actualvalue">actualvalue</option>
            <option value="thousands">thousands</option>
            <option value="millions">millions</option>
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="mt-4 grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* LEFT: List */}
        <div className="xl:col-span-2 rounded-3xl border border-sky-100 bg-white p-4 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-bold text-sky-900">
              {activeTab === "metrics" ? "Metrics (Table + Charts)" : "Derived Metrics (Table + Charts)"}
            </h3>
            <span className="text-s text-sky-800/70">
              Total:{" "}
              <span className="font-semibold text-sky-900">
                {activeTab === "metrics"
                  ? metricsRaw?.total_metrics ?? metrics.length
                  : derivedRaw?.total_metrics ?? derivedMetrics.length}
              </span>
            </span>
          </div>

          <div className="mt-4">
            {activeTab === "metrics" ? (
              <MetricList data={filteredMetrics} emptyText="No metrics found." />
            ) : (
              <MetricList data={filteredDerived} emptyText="No derived metrics found." />
            )}
          </div>
        </div>

        {/* RIGHT: Actions */}
        <div className="rounded-3xl border border-sky-100 bg-white p-4 sm:p-6 shadow-sm">
          {activeTab === "metrics" ? (
            <>
              {/* Add Metric */}
              <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-sky-50 p-4">
                <div className="flex items-center gap-2">
                  <FiPlusCircle className="text-sky-900" />
                  <h4 className="font-bold text-sky-900">Add Metric</h4>
                </div>

                <form onSubmit={handleAddMetric} className="mt-4 space-y-3">
                  <div>
                    <label className="text-x font-semibold text-sky-900">metric_name</label>
                    <input
                      value={metricName}
                      onChange={(e) => setMetricName(e.target.value)}
                      placeholder="e.g. marketing_rent"
                      className="mt-1 w-full rounded-2xl border border-sky-100 bg-white px-4 py-2.5 text-s outline-none focus:ring-2 focus:ring-sky-200"
                    />
                    <div className="mt-1  text-[11p] text-sky-800/70">
                      Use a clean token (no spaces). Example: <b>marketing_rent</b>
                    </div>
                  </div>

                  <div>
                    <label className="text-x font-semibold text-sky-900">
                      account_name <span className="text-sky-700/70">(Display name)</span>
                    </label>
                    <select
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-sky-100 bg-white px-4 py-2.5 text-s outline-none focus:ring-2 focus:ring-sky-200"
                    >
                      <option value="">Select account</option>

                      {accountDropdown.map((acc) => (
                        <option key={acc.account_id} value={acc.account_name}>
                          {acc.account_name}
                        </option>
                      ))}
                    </select>
                    <div className="mt-1  text-[11p] text-sky-800/70">
                      This is the label users see. Example: <b>Marketing Rent</b>
                    </div>
                  </div>

                 <button
  type="submit"
  disabled={loading}
  className={cx(
    "w-full inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-s font-bold",
    "bg-sky-900 text-white hover:bg-sky-800 transition",
    loading && "opacity-60 cursor-not-allowed"
  )}
>
  {loading ? (
    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
  ) : (
    <>
      <FiPlusCircle /> Add Metric
    </>
  )}
</button>
                </form>
              </div>

              {/* Delete Metric */}
              <div className="mt-4 rounded-2xl border border-sky-100 bg-white p-4">
                <div className="flex items-center gap-2">
                  <FiTrash2 className="text-rose-600" />
                  <h4 className="font-bold text-sky-900">Delete Metric</h4>
                </div>

                <form onSubmit={handleDeleteMetric} className="mt-3 space-y-3">
                  <div>
                    <label className="text-x font-semibold text-sky-900">Select metric key</label>
                    <select
                      value={deleteMetricKey}
                      onChange={(e) => setDeleteMetricKey(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-sky-100 bg-white px-3 py-2.5 text-s outline-none focus:ring-2 focus:ring-sky-200"
                    >
                      <option value="">Select...</option>

                      {metrics.map((m) => (
                        <option key={m.baseKey} value={m.baseKey}>
                          {m.baseKey}
                        </option>
                      ))}
                    </select>
                    <div className="mt-1  text-[11p] text-sky-800/70">
                      Delete expects <b>trend key</b> (example: <b>revenue_trend</b>)
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className={cx(
                      "w-full inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-s font-bold",
                      "bg-rose-600 text-white hover:bg-rose-700 transition",
                      loading && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    <FiTrash2 /> Delete Metric
                  </button>
                </form>
              </div>
            </>
          ) : (
            <>
              {/* Add Derived */}
              <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-sky-50 p-4">
                <div className="flex items-center gap-2">
                  <FiPlusCircle className="text-sky-900" />
                  <h4 className="font-bold text-sky-900">Add Derived Metric</h4>
                </div>

                <form onSubmit={handleAddDerived} className="mt-4 space-y-3">
                  <div>
                    <label className="text-x font-semibold text-sky-900">metric_name</label>
                    <input
                      value={derivedName}
                      onChange={(e) => setDerivedName(e.target.value)}
                      placeholder="e.g. Sample2"
                      className="mt-1 w-full rounded-2xl border border-sky-100 bg-white px-4 py-2.5 text-s outline-none focus:ring-2 focus:ring-sky-200"
                    />
                  </div>

                  <div>
                   <div>
  

  {/* Metric dropdown */}
  <div className="mt-3">
    <label className="text-x font-semibold text-sky-900">
    Select The Metrics
    </label>

    <select
      className="mt-1 w-full rounded-2xl border border-sky-100 bg-white px-3 py-2.5 text-s outline-none focus:ring-2 focus:ring-sky-200"
      defaultValue=""
      onChange={(e) => {
        const token = e.target.value;
        if (!token) return;

        const baseToken = token.replace("_trend", ""); // remove _trend
        insertToken(baseToken);

        e.target.value = "";
      }}
    >
      <option value="">Select metric...</option>

      {derivedDropdown.map((item) => (
        <option key={item} value={item}>
          {item}
        </option>
      ))}
    </select>
  </div>

  <label className="text-x font-semibold text-sky-900">formula</label>

  <input
    ref={formulaRef}
    value={derivedFormula}
    onChange={(e) => setDerivedFormula(e.target.value)}
    placeholder="e.g. expense + net_profit"
    className="mt-1 w-full rounded-2xl border border-sky-100 bg-white px-4 py-2.5 text-s outline-none focus:ring-2 focus:ring-sky-200"
  />

  <div className="mt-3">
    <label className="text-x font-semibold text-sky-900">Display In</label>
    <select
      value={derivedDisplayIn}
      onChange={(e) => setDerivedDisplayIn(e.target.value)}
      className="mt-1 w-full rounded-2xl border border-sky-100 bg-white px-3 py-2.5 text-s outline-none focus:ring-2 focus:ring-sky-200"
    >
      <option value="financial_overview">Financial Overview</option>
      <option value="key_financial_kpis">Key Financial KPIs</option>
    </select>
  </div>
</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[
                        { k: "+", v: " + " },
                        { k: "-", v: " - " },
                        { k: "*", v: " * " },
                        { k: "/", v: " / " },
                        { k: "(", v: "(" },
                        { k: ")", v: ")" },
                      ].map((b) => (
                        <button
                          key={b.k}
                          type="button"
                          onClick={() => insertOp(b.v)}
                          className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-x font-bold text-sky-900 hover:bg-sky-100"
                        >
                          {b.k}
                        </button>
                      ))}

                     
                    </div>

                    <div className="mt-3">
                      {/* <label className="text-x font-semibold text-sky-900">Insert metric token</label>
                      <select
                        className="mt-1 w-full rounded-2xl border border-sky-100 bg-white px-3 py-2.5 text-s outline-none focus:ring-2 focus:ring-sky-200"
                        defaultValue=""
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!v) return;
                          insertToken(v);
                          e.target.value = "";
                        }}
                      >
                        <option value="">Select token…</option>
                        {enabledMetricBaseTokens.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select> */}
                      {/* <div className="mt-1  text-[11p] text-sky-800/70">
                        Only <b>enabled metrics</b> are allowed in formula.
                      </div> */}
                    </div>
                  </div>

                 <button
  type="submit"
  disabled={loading}
  className={cx(
    "w-full inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-s font-bold",
    "bg-sky-900 text-white hover:bg-sky-800 transition",
    loading && "opacity-60 cursor-not-allowed"
  )}
>
  {loading ? (
    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
  ) : (
    <>
      <FiPlusCircle /> Add Derived Metric
    </>
  )}
</button>
                </form>
              </div>

              {/* Delete Derived */}
              <div className="mt-4 rounded-2xl border border-sky-100 bg-white p-4">
                <div className="flex items-center gap-2">
                  <FiTrash2 className="text-rose-600" />
                  <h4 className="font-bold text-sky-900">Delete Derived Metric</h4>
                </div>

                <form onSubmit={handleDeleteDerived} className="mt-3 space-y-3">
                  <div>
                    <label className="text-x font-semibold text-sky-900">Select derived metric key</label>
                    <select
                      value={deleteDerivedKey}
                      onChange={(e) => setDeleteDerivedKey(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-sky-100 bg-white px-3 py-2.5 text-s outline-none focus:ring-2 focus:ring-sky-200"
                    >
                      <option value="">Select...</option>
                      {(derivedMetrics || []).map((m) => (
                        <option key={m.baseKey} value={m.baseKey}>
                          {m.key}
                        </option>
                      ))}
                    </select>
                    <div className="mt-1  text-[11p] text-sky-800/70">
                      Delete expects <b>trend key</b> (example: <b>testing_trend</b>)
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className={cx(
                      "w-full inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-s font-bold",
                      "bg-rose-600 text-white hover:bg-rose-700 transition",
                      loading && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    <FiTrash2 /> Delete Derived Metric
                  </button>
                </form>
              </div>
            </>
          )}

          <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-x text-sky-900">
            <div className="flex items-center gap-2 font-bold">
              <FiInfo /> Notes
            </div>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-sky-900/80">
              <li>
                Derived formula must use base tokens (example: <b>expense + net_profit</b>) — not <b>expense_trend</b>.
              </li>
              <li>
                “account_name” is used when adding metric (example: <b>Marketing Rent</b>). Your GET response doesn’t return
                it, so we show token/value-field on the list.
              </li>
              <li>Metric delete uses trend key like <b>revenue_trend</b>.</li>
            </ul>
          </div>

          <div className="mt-3 text-x text-sky-800/70">
            {loading ? "Loading..." : "Ready"} • Expand any row to see table + chart.
          </div>
        </div>
      </div>
    </div>
  );
}