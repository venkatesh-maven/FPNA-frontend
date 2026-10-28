import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { AuthContext } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config/config";
import { getDecimalPrecision } from "../../utils/formatters";

import FinancialHeader from "./FinancialHeader";
import FinancialFilters from "./FinancialFilters";
import FinancialCharts from "./FinancialCharts";
import SmartAlertsCard from "./SmartAlertsCard";
import Loader from "../Loading/Loading";
import FinancialMetrics from "./FinancialMetrics";
import PinnedCustomReports from "./PinnedCustomReports";
import ExecutiveInsight from "./ExecutiveInsight";
import { useNavigate } from "react-router-dom";
import { exportPagePdf } from "../../utils/exportPagePdf";

/** ===================== ROUTES (View More / Analytics) ===================== */
const VIEW_MORE_PATHS = {
  revenue_trend: "/reports/revenue",
  expense_trend: "/reports/operating-expenses",
  gross_profit_trend: "/reports/pnl",
  net_profit_trend: "/reports/pnl",
  __default: "/reports/pnl",
};

/** ===================== CHART TYPE MAPS ===================== */
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

const reverseChartTypeMap = {
  bar: "bar_chart",
  line: "line_chart",
  pie: "pie_chart",
  // backend's ChartTypeEnum (src/constants.py) defines DOUGHNUT_CHART = "doughnut_chart" —
  // any other casing fails Pydantic validation (422) and the PATCH is rejected
  doughnut: "doughnut_chart",
  bubble: "bubble_chart",
  radar: "radar_chart",
};

/** ===================== HELPERS ===================== */
export const parseMetric = (v) => {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;

  if (typeof v === "string") {
    const s = v.trim();
    const match = s.match(/^(-?\d+(?:\.\d+)?)\s*([KMB])?$/i);
    if (!match) {
      const n = Number(s.replace(/,/g, ""));
      return Number.isFinite(n) ? n : 0;
    }
    const num = Number(match[1]);
    const unit = (match[2] || "").toUpperCase();
    const mult =
      unit === "K" ? 1_000 :
      unit === "M" ? 1_000_000 :
      unit === "B" ? 1_000_000_000 : 1;

    return (Number.isFinite(num) ? num : 0) * mult;
  }

  return 0;
};

export const divisorFromCurrencyFilter = (currencyFilter) => {
  if (currencyFilter === "thousands") return 1_000;
  if (currencyFilter === "millions") return 1_000_000;
  return 1;
};

export const suffixFromCurrencyFilter = (currencyFilter) => {
  if (currencyFilter === "thousands") return " K";
  if (currencyFilter === "millions") return " M";
  return "";
};

export const renderValue = (valueBase, currency, currencyFilter = "actualvalue") => {
  if (valueBase == null || valueBase === "") return "—";
  const n = Number(valueBase);
  if (!Number.isFinite(n)) return "—";

  const div = divisorFromCurrencyFilter(currencyFilter);
  const suffix = suffixFromCurrencyFilter(currencyFilter);
  const scaled = n / div;
  const dp = getDecimalPrecision();

  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(scaled);

  return `${formatted}${suffix}`;
};

/** ===================== AVB NORMALIZERS ===================== */
const objectColumnsToRows = (obj) => {
  if (!obj || typeof obj !== "object") return [];
  const periodCol = obj.period || {};
  const idxs = Object.keys(periodCol || {});
  return idxs.map((i) => {
    const row = { period: periodCol[i] };
    Object.keys(obj).forEach((k) => {
      if (k === "period") return;
      row[k] = obj?.[k]?.[i];
    });
    return row;
  });
};

const normalizeRows = (rowsOrObj) => {
  if (Array.isArray(rowsOrObj)) return rowsOrObj;
  if (rowsOrObj && typeof rowsOrObj === "object") return objectColumnsToRows(rowsOrObj);
  return [];
};

const pickKey = (row, candidates = []) => {
  for (const k of candidates) {
    if (row && row[k] != null) return k;
  }
  return null;
};

const buildAVBChartFlexible = (rowsOrObj, actualCandidates, budgetCandidates, titleA, titleB) => {
  const rows = normalizeRows(rowsOrObj);
  const labels = rows.map((r) => r?.period).filter(Boolean);

  const first = rows[0] || {};
  const actualKey = pickKey(first, actualCandidates);
  const budgetKey = pickKey(first, budgetCandidates);

  const actual = rows.map((r) => parseMetric(actualKey ? r?.[actualKey] : 0));
  const budget = rows.map((r) => parseMetric(budgetKey ? r?.[budgetKey] : 0));

  return {
    labels,
    datasets: [
      { label: titleA, data: actual },
      { label: titleB, data: budget },
    ],
  };
};

const parseAvbArrayResponse = (dataArray) => {
  const first = dataArray?.[0] || {};
  const configRow = dataArray?.find((x) => x && x.chart_type) || {};

  return {
    charts: {
      AVB_Revenue: {
        title: "Actual vs Budget (Revenue)",
        data: buildAVBChartFlexible(
          first?.revenue,
          ["actual_revenue", "revenue"],
          ["budget_revenue", "budget"],
          "Actual Revenue",
          "Budget Revenue"
        ),
      },
      AVB_COGS: {
        title: "Actual vs Budget (COGS)",
        data: buildAVBChartFlexible(
          first?.cogs,
          ["actual_cogs", "cogs"],
          ["budget_cogs"],
          "Actual COGS",
          "Budget COGS"
        ),
      },
      AVB_OPEX: {
        title: "Actual vs Budget (Opex)",
        data: buildAVBChartFlexible(
          first?.operating_expense,
          ["actual_operating_expense", "operating_expense"],
          ["budget_opex", "budget_operating_expense"],
          "Actual Opex",
          "Budget Opex"
        ),
      },
    },
    configRow,
  };
};

const parseAvfArrayResponse = (dataArray) => {
  // Accept both array wrapper [{...}] and bare dict {...}
  const first = Array.isArray(dataArray) ? (dataArray[0] || {}) : (dataArray || {});
  const configRow = Array.isArray(dataArray)
    ? (dataArray.find((x) => x && x.chart_type) || {})
    : {};

  return {
    charts: {
      AVF_Revenue: {
        title: "Actual vs Forecast (Revenue)",
        data: buildAVBChartFlexible(
          first?.revenue,
          ["actual_revenue", "revenue"],
          ["forecast_revenue"],
          "Actual Revenue",
          "Forecast Revenue"
        ),
      },
      AVF_COGS: {
        title: "Actual vs Forecast (COGS)",
        data: buildAVBChartFlexible(
          first?.cogs,
          ["actual_cogs", "cogs"],
          ["forecast_cogs"],
          "Actual COGS",
          "Forecast COGS"
        ),
      },
      AVF_OPEX: {
        title: "Actual vs Forecast (Opex)",
        data: buildAVBChartFlexible(
          first?.operating_expense,
          ["actual_operating_expense", "operating_expense"],
          ["forecast_operating_expense"],
          "Actual Opex",
          "Forecast Opex"
        ),
      },
      AVF_GrossProfit: {
        title: "Actual vs Forecast (Gross Profit)",
        data: buildAVBChartFlexible(
          first?.gross_profit,
          ["actual_gross_profit"],
          ["forecast_gross_profit"],
          "Actual Gross Profit",
          "Forecast Gross Profit"
        ),
      },
      AVF_NetProfit: {
        title: "Actual vs Forecast (Net Profit)",
        data: buildAVBChartFlexible(
          first?.net_profit,
          ["actual_net_profit"],
          ["forecast_net_profit"],
          "Actual Net Profit",
          "Forecast Net Profit"
        ),
      },
      AVF_Expense: {
        title: "Actual vs Forecast (Expense)",
        data: buildAVBChartFlexible(
          first?.expense,
          ["actual_expense"],
          ["forecast_expense"],
          "Actual Expense",
          "Forecast Expense"
        ),
      },
      AVF_Cashflow: {
        title: "Actual vs Forecast (Cash Flow)",
        data: buildAVBChartFlexible(
          first?.cashflow,
          ["actual_cashflow"],
          ["forecast_cashflow"],
          "Actual Cash Flow",
          "Forecast Cash Flow"
        ),
      },
    },
    configRow,
  };
};

/** ===================== ✅ DYNAMIC OVERVIEW HELPERS ===================== */
const getWidgetConfigRow = (arr = []) =>
  (arr || []).find(
    (x) =>
      x &&
      typeof x === "object" &&
      ("chart_type" in x || "position" in x || "enableordisable" in x)
  ) || {};

const isTrendArray = (v) => {
  if (!Array.isArray(v)) return false;

  return v.some(
    (x) =>
      x &&
      typeof x === "object" &&
      ("period" in x || "chart_type" in x || "position" in x)
  );
};

const toTitle = (key) =>
  String(key)
    .replace(/_trend$/i, "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());

const pickNumericValueKey = (rows = []) => {
  const ignore = new Set(["period", "position", "chart_type", "enableordisable"]);
  const sample = rows.find((r) => r && typeof r === "object" && r.period) || rows[0] || {};
  const keys = Object.keys(sample || {}).filter((k) => !ignore.has(k));

  const preferred = [
    "revenue",
    "total_expense",
    "expense",
    "net_profit",
    "gross_profit",
    "cashflow",
    "Total_amount",
    "amount",
    "value",
    "total",
  ];
  for (const p of preferred) if (keys.includes(p)) return p;

  for (const k of keys) {
    const n = parseMetric(sample?.[k]);
    if (Number.isFinite(n) && n !== 0) return k;
  }
  return keys[0] || null;
};

const buildChartJsDataFromAnyTrend = (arr = [], fallbackLabel = "Value") => {
  const rows = (arr || []).filter((x) => x?.period);
  const labels = rows.map((r) => r.period);
  const valueKey = pickNumericValueKey(rows);
  const data = rows.map((r) => parseMetric(valueKey ? r?.[valueKey] : 0));
  return { labels, datasets: [{ label: valueKey || fallbackLabel, data }] };
};

const normalizeOverviewResponse = (apiData) => {
  const entities = apiData?.entities || [];
  const keymetrics = apiData?.keymetrics || {};

  const charts = {};
  const widgets = [];

  Object.entries(apiData || {}).forEach(([key, value]) => {

    // ❗ Skip non-trend data
    if (!isTrendArray(value)) return;

    // ❗ Skip AVB in overview
    if (key === "actual_vs_budget_trend") return;

    const cfg = getWidgetConfigRow(value);

    charts[key] = {
      title: toTitle(key),
      data: buildChartJsDataFromAnyTrend(value, toTitle(key)),
    };

    widgets.push({
      key,
      name: key,
      chart_type: cfg?.chart_type ?? "bar_chart",
      position: Number(cfg?.position ?? widgets.length + 1),
      enableordisable: cfg?.enableordisable ?? true,
    });
  });

  widgets.sort((a, b) => (a.position || 0) - (b.position || 0));

  return { entities, keymetrics, charts, widgets };
};




const parseWidgetsApiResponse = (arr = []) => {
  const widgets = [];

  arr.forEach((obj) => {
    const key = Object.keys(obj)[0];
    const rows = obj[key] || [];

    const cfg =
      rows.find(
        (r) =>
          r &&
          typeof r === "object" &&
          ("position" in r || "chart_type" in r || "enableordisable" in r)
      ) || {};

    widgets.push({
      name: key,
      key: key,
      chart_type: cfg.chart_type || "bar_chart",
      position: Number(cfg.position || widgets.length + 1),
      enableordisable:
        typeof cfg.enableordisable === "boolean"
          ? cfg.enableordisable
          : true,
    });
  });

  widgets.sort((a, b) => a.position - b.position);

  return widgets;
};





const FinancialOverview = () => {
  const { token, selectedYear } = useContext(AuthContext);
  const navigate = useNavigate();

  // filters
  const [showFilters, setShowFilters] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [currencyFilter, setCurrencyFilter] = useState("actualvalue");
  const [timeFilter, setTimeFilter] = useState("monthly");
  const [entity, setEntity] = useState("");

  // mode: "None" | "ActualVsBudget" | "ActualVsForecast"
  const [comparison, setComparison] = useState("None");
  const [comparisonOptions, setComparisonOptions] = useState([
    "None",
    "ActualVsBudget",
    "ActualVsForecast",
  ]);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const dashboardRef = useRef(null);

  // base data
  const [financialData, setFinancialData] = useState(null);

  // widgets list (show both enable + disable)
  const [widgets, setWidgets] = useState([]);
  const [activeWidgets, setActiveWidgets] = useState([]);
  const [showManageModal, setShowManageModal] = useState(false);

  // AVB widgets (local only)
  const [avbWidgets, setAvbWidgets] = useState([
    { name: "AVB_Revenue", chart_type: "bar_chart", position: 1, enableordisable: true },
    { name: "AVB_COGS", chart_type: "bar_chart", position: 2, enableordisable: true },
    { name: "AVB_OPEX", chart_type: "bar_chart", position: 3, enableordisable: true },
  ]);

  // AVF widgets (local only)
  const [avfWidgets, setAvfWidgets] = useState([
    { name: "AVF_Revenue",     chart_type: "bar_chart", position: 1, enableordisable: true },
    { name: "AVF_COGS",        chart_type: "bar_chart", position: 2, enableordisable: true },
    { name: "AVF_OPEX",        chart_type: "bar_chart", position: 3, enableordisable: true },
    { name: "AVF_GrossProfit", chart_type: "bar_chart", position: 4, enableordisable: true },
    { name: "AVF_NetProfit",   chart_type: "bar_chart", position: 5, enableordisable: true },
    { name: "AVF_Expense",     chart_type: "bar_chart", position: 6, enableordisable: true },
    { name: "AVF_Cashflow",    chart_type: "bar_chart", position: 7, enableordisable: true },
  ]);


const fetchWidgetsForModal = async () => {
  try {
    const res = await axios.get(
      `${API_BASE_URL}/api/v1/company/financial/widgets`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { year: selectedYear },
      }
    );

    const parsed = parseWidgetsApiResponse(res.data);

    // 🔥 merge instead of replacing
    setWidgets((prev) => {
      const map = new Map(prev.map((w) => [w.name, w]));

      parsed.forEach((p) => {
        if (map.has(p.name)) {
          map.set(p.name, { ...map.get(p.name), ...p });
        } else {
          map.set(p.name, p);
        }
      });

      return Array.from(map.values()).sort((a, b) => (a.position || 0) - (b.position || 0));
    });

  } catch (err) {
    console.error(err);
    toast.error("Failed to load widgets");
  }
};
  
  // AVB charts data
  const [avbCharts, setAvbCharts] = useState({});

  // AVF charts data
  const [avfCharts, setAvfCharts] = useState({});

  // prevent late response overwrite
  const requestIdRef = useRef(0);

  /** =============== ACTIVE WIDGETS (base) =============== */
  useEffect(() => {
    const active = (widgets || [])
      .filter((w) => w.enableordisable)
      .sort((a, b) => (a.position || 0) - (b.position || 0));
    setActiveWidgets(active);
  }, [widgets]);

  /** ===================== FETCH (BASE or AVB ONLY) ===================== */
  const fetchFinancialData = useCallback(
    async (overrides = {}) => {
      if (!token || !selectedYear) return;

      const myReqId = ++requestIdRef.current;

      const effCurrency = overrides.currency ?? currency;
      const effCurrencyFilter = overrides.currencyFilter ?? currencyFilter;
      const effTimeFilter = overrides.timeFilter ?? timeFilter;
      const effEntity = overrides.entity ?? entity;
      const effComparison = overrides.comparison ?? comparison;

      try {
        setLoading(true);

        const baseParams = {
          currency_filter: effCurrencyFilter,
          time_filter: effTimeFilter,
          entity: effEntity || undefined,
        };

        const url = `${API_BASE_URL}/api/v1/company/financial/financial-overview/${selectedYear}/${effCurrency}`;

        // ✅ AVF MODE
        if (effComparison === "ActualVsForecast") {
          const res = await axios.get(url, {
            headers: { Authorization: `Bearer ${token}` },
            params: { ...baseParams, comparison: "ActualVsForecast" },
          });

          if (myReqId !== requestIdRef.current) return;

          // Accept both [{...}] array and bare {...} dict from backend
          const avfRaw = res.data;
          if (!avfRaw || (typeof avfRaw !== "object")) {
            setAvfCharts({});
            return;
          }

          if (Array.isArray(avfRaw?.comparison_filter?.options)) {
            setComparisonOptions(avfRaw.comparison_filter.options);
          }

          const parsed = parseAvfArrayResponse(avfRaw);
          setAvfCharts(parsed.charts);

          const defaultChartType = parsed?.configRow?.chart_type || "bar_chart";
          setAvfWidgets((prev) => {
            const base = [
              { name: "AVF_Revenue",     chart_type: defaultChartType, position: 1, enableordisable: true },
              { name: "AVF_COGS",        chart_type: defaultChartType, position: 2, enableordisable: true },
              { name: "AVF_OPEX",        chart_type: defaultChartType, position: 3, enableordisable: true },
              { name: "AVF_GrossProfit", chart_type: defaultChartType, position: 4, enableordisable: true },
              { name: "AVF_NetProfit",   chart_type: defaultChartType, position: 5, enableordisable: true },
              { name: "AVF_Expense",     chart_type: defaultChartType, position: 6, enableordisable: true },
              { name: "AVF_Cashflow",    chart_type: defaultChartType, position: 7, enableordisable: true },
            ];
            const map = new Map((prev || []).map((w) => [w.name, w]));
            return base.map((w) => ({ ...w, ...(map.get(w.name) || {}) }));
          });

          setFinancialData(null);
          setWidgets([]);
          return;
        }

        // ✅ AVB MODE
        if (effComparison === "ActualVsBudget") {
          const res = await axios.get(url, {
            headers: { Authorization: `Bearer ${token}` },
            params: { ...baseParams, comparison: "ActualVsBudget" },
          });

          if (myReqId !== requestIdRef.current) return;

          if (Array.isArray(res.data?.comparison_filter?.options)) {
            setComparisonOptions(res.data.comparison_filter.options);
          }

          const avbPayload = res.data?.actual_vs_budget_trend;
          if (!Array.isArray(avbPayload)) {
            toast.error("AVB response shape is invalid");
            setAvbCharts({});
            return;
          }

          const parsed = parseAvbArrayResponse(avbPayload);
          setAvbCharts(parsed.charts);

          const defaultChartType = parsed?.configRow?.chart_type || "bar_chart";
          setAvbWidgets((prev) => {
            const base = [
              { name: "AVB_Revenue", chart_type: defaultChartType, position: 1, enableordisable: true },
              { name: "AVB_COGS", chart_type: defaultChartType, position: 2, enableordisable: true },
              { name: "AVB_OPEX", chart_type: defaultChartType, position: 3, enableordisable: true },
            ];
            const map = new Map((prev || []).map((w) => [w.name, w]));
            return base.map((w) => ({ ...w, ...(map.get(w.name) || {}) }));
          });

          setFinancialData(null);
          setWidgets([]); // base widgets not shown in AVB mode
          return;
        }

        // ✅ BASE MODE
        const baseRes = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
          params: baseParams,
        });

        if (myReqId !== requestIdRef.current) return;

        const data = baseRes.data;
        if (Array.isArray(data?.comparison_filter?.options)) {
          setComparisonOptions(data.comparison_filter.options);
        }
        const normalized = normalizeOverviewResponse(data);

        setFinancialData({
          year: data?.year,
          entities: normalized.entities,
          keymetrics: normalized.keymetrics,
          charts: normalized.charts,
          // Not charted in this mode, but the executive insight compares against it.
          budget: Array.isArray(data?.actual_vs_budget_trend)
            ? parseAvbArrayResponse(data.actual_vs_budget_trend).charts
            : {},
        });

        setWidgets(normalized.widgets || []);
        setAvbCharts({});
      } catch (err) {
        console.error(err);
        toast.error("Failed to load financial overview");
      } finally {
        if (myReqId === requestIdRef.current) setLoading(false);
      }
    },
    [token, selectedYear, currency, currencyFilter, timeFilter, entity, comparison]
  );

  useEffect(() => {
    fetchFinancialData();
  }, [fetchFinancialData]);

  /** ===================== ✅ PATCH UPDATE (BASE ONLY) ===================== */
  const updateWidget = async (widget) => {
    const patchName = widget?.name || widget?.key; // must match backend (case sensitive)

    // IMPORTANT: return response so we can update UI immediately
    const res = await axios.patch(
      `${API_BASE_URL}/api/v1/company/financial/overview/widgets`,
      {
        year: selectedYear,
        name: patchName,
        chart_Type: widget.chart_type,
        enableordisable: widget.enableordisable,
        position: widget.position,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return res?.data;
  };

  /** ===================== TOGGLES / CHART TYPE / DRAG ===================== */
 const toggleWidgetVisibility = async (widgetNameEnum) => {

  const oldWidget = widgets.find((w) => w.name === widgetNameEnum);
  if (!oldWidget) return;

  const updatedWidget = {
    ...oldWidget,
    enableordisable: !oldWidget.enableordisable,
  };

  setWidgets((prev) =>
    prev.map((w) => (w.name === widgetNameEnum ? updatedWidget : w))
  );

  try {
    // ❗ Do NOT merge the PATCH response into financialData.charts: the
    // backend returns the raw, frozen `metric_trend` blob (only chart_type/
    // position/enableordisable are mutated in place; the data rows are
    // never refreshed), so applying it here would overwrite every widget's
    // live chart data with stale values.
    await updateWidget(updatedWidget);

    toast.success(
      updatedWidget.enableordisable
        ? "Widget enabled"
        : "Widget disabled"
    );
  } catch (err) {
    toast.error("Failed to update widget");

    setWidgets((prev) =>
      prev.map((w) => (w.name === widgetNameEnum ? oldWidget : w))
    );
  }
};

  const toggleAvbVisibility = (name) => {
    setAvbWidgets((prev) =>
      (prev || []).map((w) => (w.name === name ? { ...w, enableordisable: !w.enableordisable } : w))
    );
  };

  const toggleAvfVisibility = (name) => {
    setAvfWidgets((prev) =>
      (prev || []).map((w) => (w.name === name ? { ...w, enableordisable: !w.enableordisable } : w))
    );
  };

  const handleRemoveWidget = async (widgetNameEnum) => {
    if (comparison === "ActualVsForecast") {
      toggleAvfVisibility(widgetNameEnum);
      toast.success("Widget hidden");
      return;
    }
    if (comparison === "ActualVsBudget") {
      toggleAvbVisibility(widgetNameEnum);
      toast.success("Widget hidden");
      return;
    }
    await toggleWidgetVisibility(widgetNameEnum);
  };

  const handleChartTypeChange = async (widgetNameEnum, typeUi) => {
    const apiChartType = reverseChartTypeMap[typeUi] || "bar_chart";

    if (comparison === "ActualVsForecast") {
      setAvfWidgets((prev) =>
        (prev || []).map((w) => (w.name === widgetNameEnum ? { ...w, chart_type: apiChartType } : w))
      );
      toast.success("Chart type updated");
      return;
    }

    if (comparison === "ActualVsBudget") {
      setAvbWidgets((prev) =>
        (prev || []).map((w) => (w.name === widgetNameEnum ? { ...w, chart_type: apiChartType } : w))
      );
      toast.success("Chart type updated");
      return;
    }

    const oldW = widgets.find((w) => w.name === widgetNameEnum);
    if (!oldW) return;

    const next = { ...oldW, chart_type: apiChartType };
    setWidgets((prev) => prev.map((w) => (w.name === widgetNameEnum ? next : w)));

    try {
      // ❗ See toggleWidgetVisibility: the PATCH response carries stale
      // metric data, not a refreshed trend, so it must not be merged back
      // into financialData.charts here either.
      await updateWidget(next);
      toast.success("Chart type updated successfully");
    } catch (e) {
      toast.error("Failed to update chart type");
      setWidgets((prev) => prev.map((w) => (w.name === widgetNameEnum ? oldW : w)));
    }
  };

  const onDragEnd = async (result) => {
    if (!result.destination) return;

    // AVF drag reorder (local)
    if (comparison === "ActualVsForecast") {
      const active = (avfWidgets || [])
        .filter((w) => w.enableordisable)
        .sort((a, b) => (a.position || 0) - (b.position || 0));

      const items = Array.from(active);
      const [moved] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, moved);

      const reordered = items.map((w, i) => ({ ...w, position: i + 1 }));
      const map = new Map(reordered.map((w) => [w.name, w]));
      setAvfWidgets((prev) => (prev || []).map((w) => (map.has(w.name) ? map.get(w.name) : w)));
      return;
    }

    // AVB drag reorder (local)
    if (comparison === "ActualVsBudget") {
      const active = (avbWidgets || [])
        .filter((w) => w.enableordisable)
        .sort((a, b) => (a.position || 0) - (b.position || 0));

      const items = Array.from(active);
      const [moved] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, moved);

      const reordered = items.map((w, i) => ({ ...w, position: i + 1 }));
      const map = new Map(reordered.map((w) => [w.name, w]));
      setAvbWidgets((prev) => (prev || []).map((w) => (map.has(w.name) ? map.get(w.name) : w)));
      return;
    }

    // Base reorder + patch
    const items = Array.from(activeWidgets);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);

    const reorderedActive = items.map((w, i) => ({ ...w, position: i + 1 }));
    const map = new Map(reorderedActive.map((w) => [w.name, w]));

    // update local positions for enabled widgets
    const merged = widgets.map((w) => (map.has(w.name) ? map.get(w.name) : w));
    setWidgets(merged);

    try {
      // ✅ single atomic request for the whole new order, instead of one
      // PATCH per widget (which could partially fail and leave positions
      // inconsistent when reordering, especially around the last slot)
      // ❗ See toggleWidgetVisibility: don't merge the PATCH response's
      // stale metric data back into financialData.charts.
      await axios.patch(
        `${API_BASE_URL}/api/v1/company/financial/overview/widgets/reorder`,
        {
          year: selectedYear,
          widgets: reorderedActive.map((w) => ({
            name: w?.name || w?.key,
            position: w.position,
          })),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Widget positions updated");
    } catch (e) {
      toast.error("Failed to save widget order");
      fetchFinancialData();
    }
  };

  /** ===================== KPI DATA (BASE ONLY) ===================== */
  const getKPIData = useCallback(() => {
    if (comparison === "ActualVsBudget" || comparison === "ActualVsForecast") return {};
    const km = financialData?.keymetrics || {};

    const revenue = parseMetric(km.Revenue);
    const grossProfit = parseMetric(km.Grossprofit);
    const netProfit = parseMetric(km.NetProfit);
    const expenses = parseMetric(km.Expense);
    const cashFlow = parseMetric(km.cashflow);
    const headcount = Number(km.headcount ?? 0);

    return {
      revenue: { value: revenue, change: "+0%" },
      gross_profit: { value: grossProfit, change: "+0%" },
      expenses: { value: expenses, change: "+0%" },
      net_profit: { value: netProfit, change: "+0%" },
      cash_flow: { value: cashFlow, change: "+0%" },
      headcount: { value: headcount, change: "+0%" },
    };
  }, [financialData, comparison]);

  /** ===================== chartsData + widgets for <FinancialCharts /> ===================== */
  const chartsData = useMemo(() => {
    if (comparison === "ActualVsForecast") return avfCharts || {};
    if (comparison === "ActualVsBudget") return avbCharts || {};
    return financialData?.charts || {};
  }, [comparison, avfCharts, avbCharts, financialData]);

  const effectiveWidgets = useMemo(() => {
    if (comparison === "ActualVsForecast") {
      return (avfWidgets || [])
        .filter((w) => w.enableordisable)
        .sort((a, b) => (a.position || 0) - (b.position || 0));
    }
    if (comparison === "ActualVsBudget") {
      return (avbWidgets || [])
        .filter((w) => w.enableordisable)
        .sort((a, b) => (a.position || 0) - (b.position || 0));
    }
    return activeWidgets || [];
  }, [comparison, avfWidgets, avbWidgets, activeWidgets]);

  const activeChartTypes = useMemo(() => {
    const list =
      comparison === "ActualVsForecast" ? avfWidgets
      : comparison === "ActualVsBudget" ? avbWidgets
      : activeWidgets;
    return Object.fromEntries((list || []).map((w) => [w.name, chartTypeMap[w.chart_type] || "bar"]));
  }, [comparison, avfWidgets, avbWidgets, activeWidgets]);

  /** ===================== View More handler ===================== */
  const handleViewMore = useCallback(
    (widgetNameEnum) => {
      const path = VIEW_MORE_PATHS[widgetNameEnum] || VIEW_MORE_PATHS.__default;
      navigate(path);
    },
    [navigate]
  );

 /** ===================== Manage Modal ===================== */
const ManageWidgetsModal = ({ onClose }) => {
  // ✅ base mode: show ALL widgets (enabled + disabled)
// Always show every widget from backend
const list =
  comparison === "ActualVsForecast"
    ? avfWidgets
    : comparison === "ActualVsBudget"
    ? avbWidgets
    : [...widgets].sort((a, b) => (a.position || 0) - (b.position || 0));
const toggle =
  comparison === "ActualVsForecast" ? toggleAvfVisibility
  : comparison === "ActualVsBudget" ? toggleAvbVisibility
  : toggleWidgetVisibility;

  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const items = (list || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((w) => toTitle(w.name).toLowerCase().includes(s));
  }, [list, q]);

  const enabledCount = useMemo(
    () => (list || []).filter((x) => x.enableordisable).length,
    [list]
  );




 


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 bg-black/55 backdrop-blur-[6px]"
      />

      {/* Modal */}
      <div className="relative w-full max-w-6xl overflow-hidden rounded-3xl border border-white/20 bg-white shadow-[0_30px_90px_-35px_rgba(0,0,0,0.55)]">
        {/* Header */}
        <div className="relative px-6 py-5">
          <div className="absolute inset-0 bg-gradient-to-r from-sky-950 to-sky-800" />
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.65),transparent_55%)]" />

          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white">
                Manage Overview Widgets
              </h2>
              <p className="mt-1 text-s text-white/80">
                Enable / Disable charts • Drag order is handled on dashboard
              </p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-x text-white/90 ring-1 ring-white/20">
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                Enabled: <span className="font-semibold">{enabledCount}</span> /{" "}
                <span className="font-semibold">{(list || []).length}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative w-full md:w-[320px]">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search widget..."
                  className="w-full rounded-2xl bg-white/15 px-4 py-2 text-s text-white placeholder:text-white/60 outline-none ring-1 ring-white/20 focus:ring-2 focus:ring-white/50"
                />
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-white/60">
                  ⌕
                </div>
              </div>

              {/* Close */}
              <button
                onClick={onClose}
                className="rounded-2xl bg-white/10 px-3 py-2 text-white/90 hover:bg-white/15 transition focus:outline-none focus:ring-2 focus:ring-white/50"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Scroll only here */}
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            {/* Grid: each row shows items nicely */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((w) => {
                const enabled = !!w.enableordisable;
                const chartLabel =
                  String(w.chart_type || "").replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());

                return (
                  <div
                    key={w.name}
                    className={[
                      "group relative rounded-2xl border bg-white p-4 shadow-sm transition",
                      enabled
                        ? "border-emerald-100 hover:border-emerald-200 hover:shadow-md"
                        : "border-slate-100 hover:border-slate-200 hover:shadow-md",
                    ].join(" ")}
                  >
                    {/* Glow */}
                    <div
                      className={[
                        "pointer-events-none absolute inset-0 rounded-2xl opacity-0 blur-2xl transition group-hover:opacity-100",
                        enabled ? "bg-emerald-200/30" : "bg-slate-200/30",
                      ].join(" ")}
                    />

                    <div className="relative flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-s font-semibold text-slate-900">
                            {toTitle(w.name)}
                          </h3>

                          <span
                            className={[
                              "shrink-0 rounded-full px-2 py-0.5  text-[11p] font-semibold ring-1",
                              enabled
                                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                : "bg-slate-50 text-slate-600 ring-slate-200",
                            ].join(" ")}
                          >
                            {enabled ? "Enabled" : "Disabled"}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-x text-slate-600">
                          {/* <span className="rounded-full bg-slate-50 px-2 py-1 ring-1 ring-slate-200">
                            Position: <span className="font-semibold">{w.position ?? "—"}</span>
                          </span> */}
                          <span className="rounded-full bg-slate-50 px-2 py-1 ring-1 ring-slate-200">
                            Type: <span className="font-semibold">{chartLabel || "—"}</span>
                          </span>
                        </div>
                      </div>

                      {/* Toggle */}
                      <button
                        onClick={() => toggle(w.name)}
                        className={[
                          "relative inline-flex h-6 w-12 items-center rounded-full border transition-colors",
                          "focus:outline-none focus:ring-2 focus:ring-sky-500/40",
                          enabled ? "bg-emerald-600 border-emerald-600" : "bg-slate-200 border-slate-200",
                        ].join(" ")}
                        aria-pressed={enabled}
                        aria-label={enabled ? "Disable widget" : "Enable widget"}
                      >
                        <span
                          className={[
                            "inline-block h-5 w-5 transform rounded-full bg-white shadow",
                            "transition-transform duration-200",
                            enabled ? "translate-x-6" : "translate-x-1",
                          ].join(" ")}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {filtered.length === 0 && (
  <div className="py-14 text-center text-s text-slate-500">
      No widgets found.
  </div>
)}
          </div>

          {/* Footer */}
          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-x text-slate-500">
              Tip: Disabled widgets won’t appear on the dashboard charts.
            </div>
            <button
              onClick={onClose}
              className="rounded-2xl bg-sky-950 px-5 py-2.5 text-s font-semibold text-white shadow-sm hover:bg-sky-900 transition focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

  if (loading) {
    return (
      <div className="absolute top-0 left-0 right-0 bottom-0 z-50 flex justify-center items-center h-screen">
        <Loader />
      </div>
    );
  }

  // Export: the dashboard as a PDF, paginated between cards rather than through them.
  const handleExportPdf = async ({ subtitle }) => {
    if (!dashboardRef.current || exporting) return;
    setExporting(true);
    try {
      await exportPagePdf(dashboardRef.current, {
        filename: `financial-dashboard-FY${selectedYear || ""}.pdf`,
        title: `Financial Dashboard${selectedYear ? ` – FY ${selectedYear}` : ""}`,
        subtitle,
      });
    } catch (e) {
      console.error("Dashboard PDF export failed", e);
      toast.error("Couldn't create the PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="relative space-y-6 min-h-screen" ref={dashboardRef}>
      <FinancialHeader
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        onManageWidgets={() => {
  fetchWidgetsForModal();
  setShowManageModal(true);
}}
        currency={currency}
        setCurrency={setCurrency}
        currencyFilter={currencyFilter}
        setCurrencyFilter={setCurrencyFilter}
        timeFilter={timeFilter}
        setTimeFilter={setTimeFilter}
        entity={entity}
        setEntity={setEntity}
        entities={financialData?.entities || []}
        onApply={fetchFinancialData}
        comparison={comparison}
        setComparison={setComparison}
        onExport={handleExportPdf}
        exporting={exporting}
      />

      <FinancialFilters
        showFilters={showFilters}
        currency={currency}
        setCurrency={setCurrency}
        currencyFilter={currencyFilter}
        setCurrencyFilter={setCurrencyFilter}
        timeFilter={timeFilter}
        setTimeFilter={setTimeFilter}
        entities={financialData?.entities || []}
        entity={entity}
        setEntity={setEntity}
        onApply={fetchFinancialData}
        comparison={comparison}
        setComparison={setComparison}
        comparisonOptions={comparisonOptions}
      />

      {comparison === "None" && (
        <FinancialMetrics
          kpiData={getKPIData()}
          currency={currency}
          currencyFilter={currencyFilter}
          renderValue={renderValue}
          year={selectedYear}
        />
      )}

      {/* Two-column layout: Charts (left) + Smart Alerts sidebar (right) */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="w-full lg:flex-1 min-w-0">
          <FinancialCharts
            widgets={effectiveWidgets}
            chartsData={chartsData}
            currency={currency}
            currencyFilter={currencyFilter}
            renderValue={renderValue}
            chartTypes={activeChartTypes}
            onDragEnd={onDragEnd}
            onChartTypeChange={handleChartTypeChange}
            onRemoveWidget={handleRemoveWidget}
            onViewMore={handleViewMore}
            year={selectedYear}
          />
        </div>
        <div className="w-full lg:w-72 xl:w-80 lg:flex-shrink-0 lg:sticky lg:top-4 lg:self-start" data-pdf-keep>
          <SmartAlertsCard />
        </div>
      </div>

      <PinnedCustomReports />

      {comparison === "None" && financialData && (
        <ExecutiveInsight
          keymetrics={financialData.keymetrics}
          charts={financialData.charts}
          budget={financialData.budget}
          parseMetric={parseMetric}
          renderValue={renderValue}
          currency={currency}
          currencyFilter={currencyFilter}
        />
      )}

      {showManageModal && <ManageWidgetsModal onClose={() => setShowManageModal(false)} />}
    </div>
  );
};

export default FinancialOverview;