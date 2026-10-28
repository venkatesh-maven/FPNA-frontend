import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { AuthContext } from "../../context/AuthContext";
import FinancialHeader from "./FinancialHeader";
import FinancialFilters from "./FinancialFilters";
import FinancialMetrics from "./FinancialMetrics";
import FinancialCharts from "./FinancialCharts";
import FinancialDataTable from "./FinancialDataTable";
import { toast } from "react-toastify";
import { API_BASE_URL } from "../../config/config";
import Loader from "../Loading/Loading";
import WelcomeDashboard from "./WelcomeDashboard";
import { getDecimalPrecision } from '../../utils/formatters';

// Sample headcount data
const sampleHeadcountData = {
  value: 126,
  change: "+1%",
  trend: {
    Jan: 120,
    Feb: 122,
    Mar: 124,
    Apr: 125,
    May: 126,
    Jun: 126,
    Jul: 127,
    Aug: 128,
    Sep: 130,
    Oct: 131,
    Nov: 132,
    Dec: 133,
  },
};

// Map API chart types to our component types
const chartTypeMap = {
  bar_chart: "bar",
  line_chart: "line",
  pie_chart: "pie",
  Doughnut_Chart: "doughnut",
  bubble_chart: "bubble",
  area_chart: "area",
  radar_chart: "radar",
};

const reverseChartTypeMap = Object.fromEntries(
  Object.entries(chartTypeMap).map(([key, value]) => [value, key])
);

/**
 * ✅ Convert API response (arrays) into the same shape your UI already expects.
 * API sample:
 *  revenue: [{ period: "2025-01", revenue: 123 }]
 *  gross_profit: [{ period: "2025-01", gross_profit: 123 }]
 *  expenses: [{ period: "2025-01", total_expense: 123 }]
 *  net_profit: [{ period: "2025-01", net_profit: 123 }]
 *  keymetrics: { Revenue: 123, Grossprofit: 456, ... }
 */
const normalizeFinancialOverviewSkeliton = (apiData) => {
  if (!apiData || typeof apiData !== "object") return null;

  const revenueArr = Array.isArray(apiData.revenue) ? apiData.revenue : [];
  const grossArr = Array.isArray(apiData.gross_profit) ? apiData.gross_profit : [];
  const expArr = Array.isArray(apiData.expenses) ? apiData.expenses : [];
  const netArr = Array.isArray(apiData.net_profit) ? apiData.net_profit : [];

  // Build month label map (e.g. "2025-01" -> value)
  const revenueTrend = {};
  revenueArr.forEach((x) => {
    if (x?.period) revenueTrend[x.period] = Number(x.revenue ?? 0);
  });

  const expensesTrend = {};
  expArr.forEach((x) => {
    if (x?.period) expensesTrend[x.period] = Number(x.total_expense ?? 0);
  });

  const profitAnalysis = {};
  // merge by period using revenue/gross/net arrays
  const periodSet = new Set([
    ...revenueArr.map((x) => x?.period).filter(Boolean),
    ...grossArr.map((x) => x?.period).filter(Boolean),
    ...netArr.map((x) => x?.period).filter(Boolean),
  ]);

  const grossByPeriod = {};
  grossArr.forEach((x) => {
    if (x?.period) grossByPeriod[x.period] = Number(x.gross_profit ?? 0);
  });

  const netByPeriod = {};
  netArr.forEach((x) => {
    if (x?.period) netByPeriod[x.period] = Number(x.net_profit ?? 0);
  });

  periodSet.forEach((p) => {
    profitAnalysis[p] = {
      gross: grossByPeriod[p] ?? 0,
      net: netByPeriod[p] ?? 0,
    };
  });

  // KPI totals (prefer keymetrics if provided)
  const km = apiData.keymetrics || {};
  const totalRevenue =
    Number(km.Revenue ?? 0) || revenueArr.reduce((s, x) => s + Number(x?.revenue ?? 0), 0);

  const totalGross =
    Number(km.Grossprofit ?? 0) || grossArr.reduce((s, x) => s + Number(x?.gross_profit ?? 0), 0);

  const totalExpense =
    Number(km.Expense ?? 0) || expArr.reduce((s, x) => s + Number(x?.total_expense ?? 0), 0);

  const totalNet =
    Number(km.NetProfit ?? 0) || netArr.reduce((s, x) => s + Number(x?.net_profit ?? 0), 0);

  const totalCashFlow = Number(km.cashflow ?? apiData.cashflow ?? apiData.cash_flow ?? 0);

  return {
    ...apiData,
    revenue: totalRevenue,         // ✅ number (your KPI expects number)
    gross_profit: totalGross,      // ✅ number
    expenses: totalExpense,        // ✅ number
    net_profit: totalNet,          // ✅ number
    cash_flow: totalCashFlow,      // ✅ number (your KPI expects this key)

    revenue_trend: revenueTrend,   // ✅ object for your chart
    expenses_trend: expensesTrend, // ✅ object
    profit_analysis: profitAnalysis, // ✅ object for Profit_Analysis chart

    // keep any others as they are
    expense_breakdown: apiData.expense_breakdown || {},

    // entities etc. remains
  };
};

const FinancialOverview = () => {
  const navigate = useNavigate();
  const { currentUser, token, selectedYear: year, setSelectedYear: setYear } =
    useContext(AuthContext);

  const [showFilters, setShowFilters] = useState(false);
  const [financialData, setFinancialData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [widgets, setWidgets] = useState([]);
  const [availableWidgets, setAvailableWidgets] = useState([]);

  // ✅ currency required by API
  const [currency, setCurrency] = useState("USD");
  // ✅ matches your swagger example
  const [currencyFilter, setCurrencyFilter] = useState("actualvalue");

  useEffect(() => {
    const fetchWidgets = async () => {
      try {
        const response = await axios.get(
          `${API_BASE_URL}/api/v1/company/financial/widgets`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const financialWidgets = response.data.message["financial dashboard"] || [];
        const enabledWidgets = financialWidgets
          .filter((w) => w.enable_or_disable)
          .sort((a, b) => a.position - b.position);

        const disabledWidgets = financialWidgets.filter((w) => !w.enable_or_disable);

        setWidgets(enabledWidgets);
        setAvailableWidgets(disabledWidgets);
      } catch (err) {
        console.error("Error fetching widgets:", err);
        setError("Failed to load widget configuration");
      }
    };

    const fetchFinancialData = async (year, currency) => {
      if (!year) {
        console.warn("Skipping fetchFinancialData: year is missing");
        return;
      }
      if (!currency) {
        console.warn("Skipping fetchFinancialData: currency is missing");
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // ✅ FIX: endpoint needs /{year}/{currency}
        // ✅ FIX: add query string currency_filter
        const response = await axios.get(
          `${API_BASE_URL}/api/v1/company/financial/financial-overview/${year}/${currency}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params: {
              currency_filter: currencyFilter, // "actualvalue"
              // entity: "...",       // optional if backend supports
              // time_filter: "...",  // optional
              // currency_filter: "...", // already used
            },
          }
        );

        const normalized = normalizeFinancialOverview(response.data);
        setFinancialData(normalized);
        setLoading(false);
      } catch (err) {
        console.error("Financial API error:", err);

        // Show better error message
        const msg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Failed to load financial data";

        setError(msg);
        setLoading(false);

        toast.error(msg);
      }
    };

    if (token) fetchWidgets();
    if (token) fetchFinancialData(year, currency);
  }, [year, token, currency, currencyFilter]);

  const calculateChange = (current, previous) => {
    const change = ((current - previous) / Math.abs(previous)) * 100;
    return `${change >= 0 ? "+" : ""}${change.toFixed(getDecimalPrecision())}%`;
  };

  const getKPIData = () => {
    if (!financialData) return {};

    return {
      revenue: {
        value: financialData.revenue,
        change: calculateChange(financialData.revenue, financialData.revenue * 0.95),
        componentPath: "/revenue-component",
      },
      gross_profit: {
        value: financialData.gross_profit,
        change: calculateChange(financialData.gross_profit, financialData.gross_profit * 0.93),
        componentPath: "/revenue-component",
      },
      expenses: {
        value: financialData.expenses,
        change: calculateChange(financialData.expenses, financialData.expenses * 0.97),
        componentPath: "/expense-component",
      },
      net_profit: {
        value: financialData.net_profit,
        change: calculateChange(financialData.net_profit, financialData.net_profit * 1.03),
        componentPath: "/revenue-component",
      },
      cash_flow: {
        value: financialData.cash_flow,
        change: calculateChange(financialData.cash_flow, financialData.cash_flow * 1.05),
        componentPath: "/cash-flow",
      },
      headcount: {
        value: sampleHeadcountData.value,
        change: sampleHeadcountData.change,
        componentPath: "/hr-component",
      },
    };
  };

  const getChartsData = () => {
    if (!financialData) return {};

    const chartDataMap = {
      Revenue_Trend: {
        title: "Revenue Trend",
        componentPath: "/revenue-component",
        data: {
          labels: Object.keys(financialData.revenue_trend || {}),
          datasets: [
            {
              label: "Revenue",
              data: Object.values(financialData.revenue_trend || {}),
              backgroundColor: "rgba(14, 165, 233, 0.2)",
              borderColor: "rgba(14, 165, 233, 1)",
              borderWidth: 2,
              tension: 0.4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom" } },
        },
      },

      Expense_Breakdown: {
        title: "Expense Breakdown",
        componentPath: "/expense-component",
        data: {
          labels: Object.keys(financialData.expense_breakdown || {}).map((key) =>
            key.charAt(0).toUpperCase() +
            key.slice(1).replace(/([A-Z])/g, " $1")
          ),
          datasets: [
            {
              label: "Expenses",
              data: Object.values(financialData.expense_breakdown || {}),
              backgroundColor: [
                "rgba(239, 68, 68, 0.7)",
                "rgba(59, 130, 246, 0.7)",
                "rgba(234, 179, 8, 0.7)",
                "rgba(16, 185, 129, 0.7)",
                "rgba(139, 92, 246, 0.7)",
                "rgba(20, 184, 166, 0.7)",
                "rgba(245, 158, 11, 0.7)",
                "rgba(236, 72, 153, 0.7)",
              ],
              borderColor: [
                "rgba(239, 68, 68, 1)",
                "rgba(59, 130, 246, 1)",
                "rgba(234, 179, 8, 1)",
                "rgba(16, 185, 129, 1)",
                "rgba(139, 92, 246, 1)",
                "rgba(20, 184, 166, 1)",
                "rgba(245, 158, 11, 1)",
                "rgba(236, 72, 153, 1)",
              ],
              borderWidth: 1,
            },
          ],
        },
        options: {
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom" } },
        },
      },

      Profit_Analysis: {
        title: "Profit Analysis",
        componentPath: "/profit-analysis",
        data: {
          labels: Object.keys(financialData.profit_analysis || {}),
          datasets: [
            {
              label: "Gross Profit",
              data: Object.values(financialData.profit_analysis || {}).map((q) => q.gross),
              backgroundColor: "rgba(16, 185, 129, 0.2)",
              borderColor: "rgba(16, 185, 129, 1)",
              borderWidth: 1,
            },
            {
              label: "Net Profit",
              data: Object.values(financialData.profit_analysis || {}).map((q) => q.net),
              backgroundColor: "rgba(139, 92, 246, 0.2)",
              borderColor: "rgba(139, 92, 246, 1)",
              borderWidth: 1,
            },
          ],
        },
        options: {
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom" } },
        },
      },

      Cash_Flow: {
        title: "Cash Flow",
        componentPath: "/cash-flow",
        data: {
          labels: Object.keys(financialData.revenue_trend || {}),
          datasets: [
            {
              label: "Cash Flow",
              data: Object.keys(financialData.revenue_trend || {}).map(
                () => financialData.cash_flow
              ),
              backgroundColor: "rgba(14, 165, 233, 0.2)",
              borderColor: "rgba(14, 165, 233, 1)",
              borderWidth: 2,
              tension: 0.4,
            },
          ],
        },
        options: {
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom" } },
        },
      },

      Headcount_Trend: {
        title: "Headcount Trend",
        componentPath: "/hr-component",
        data: {
          labels: Object.keys(sampleHeadcountData.trend),
          datasets: [
            {
              label: "Employees",
              data: Object.values(sampleHeadcountData.trend),
              backgroundColor: "rgba(167, 139, 250, 0.2)",
              borderColor: "rgba(167, 139, 250, 1)",
              borderWidth: 2,
            },
            {
              label: "Target",
              data: Object.values(sampleHeadcountData.trend).map((val) => val - 2),
              backgroundColor: "rgba(126, 99, 235, 0.2)",
              borderColor: "rgba(126, 99, 235, 1)",
              borderWidth: 2,
              borderDash: [5, 5],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom" } },
        },
      },
    };

    const chartsData = {};
    widgets.forEach((widget) => {
      if (chartDataMap[widget.name]) {
        chartsData[widget.name] = chartDataMap[widget.name];
      }
    });

    return chartsData;
  };

  const onDragEnd = async (result) => {
    if (!result.destination) return;

    const items = Array.from(widgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const updatedWidgets = items.map((widget, index) => ({
      ...widget,
      position: index + 1,
    }));

    try {
      await Promise.all(
        updatedWidgets.map((widget) =>
          axios.patch(
            `${API_BASE_URL}/api/v1/company/financial/overview/widgets`,
            {
              name: widget.name,
              chart_Type: widget.Type,
              enableordisable: widget.enable_or_disable,
              position: widget.position,
            },
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          )
        )
      );

      setWidgets(updatedWidgets);
      toast.success("Widget positions updated successfully");
    } catch (err) {
      console.error("Error updating widget positions:", err);
      toast.error("Failed to update widget positions");
    }
  };

  const handleChartTypeChange = async (widgetId, type) => {
    try {
      const widgetToUpdate = widgets.find((w) => w.name === widgetId);
      if (!widgetToUpdate) return;

      const updatedWidgets = widgets.map((w) =>
        w.name === widgetId ? { ...w, Type: reverseChartTypeMap[type] } : w
      );

      await axios.patch(
        `${API_BASE_URL}/api/v1/company/financial/overview/widgets`,
        {
          name: widgetId,
          chart_Type: reverseChartTypeMap[type],
          enableordisable: true,
          position: widgetToUpdate.position,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setWidgets(updatedWidgets);
      toast.success("Chart type updated successfully");
    } catch (err) {
      console.error("Error updating chart type:", err);
      toast.error("Failed to update chart type");
    }
  };

  const handleAddWidget = async (widgetName) => {
    try {
      const widgetToAdd = availableWidgets.find((w) => w.name === widgetName);
      if (!widgetToAdd) return;

      const nextPosition =
        widgets.length > 0 ? Math.max(...widgets.map((w) => w.position)) + 1 : 1;

      await axios.patch(
        `${API_BASE_URL}/api/v1/company/financial/overview/widgets`,
        {
          name: widgetName,
          chart_Type: widgetToAdd.Type,
          enableordisable: true,
          position: nextPosition,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const updatedAvailableWidgets = availableWidgets.filter(
        (w) => w.name !== widgetName
      );

      const addedWidget = {
        ...widgetToAdd,
        enable_or_disable: true,
        position: nextPosition,
      };

      setWidgets([...widgets, addedWidget]);
      setAvailableWidgets(updatedAvailableWidgets);
      toast.success("Widget added successfully");
    } catch (err) {
      console.error("Error adding widget:", err);
      toast.error("Failed to add widget");
    }
  };

  const handleRemoveWidget = async (widgetName) => {
    try {
      const widgetToRemove = widgets.find((w) => w.name === widgetName);
      if (!widgetToRemove) return;

      await axios.patch(
        `${API_BASE_URL}/api/v1/company/financial/overview/widgets`,
        {
          name: widgetName,
          chart_Type: widgetToRemove.Type,
          enableordisable: false,
          position: 0,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const updatedWidgets = widgets.filter((w) => w.name !== widgetName);
      const removedWidget = {
        ...widgetToRemove,
        enable_or_disable: false,
      };

      setWidgets(updatedWidgets);
      setAvailableWidgets([...availableWidgets, removedWidget]);
      toast.success("Widget removed successfully");
    } catch (err) {
      console.error("Error removing widget:", err);
      toast.error("Failed to remove widget");
    }
  };

  const handleAIQuery = (widgetId, query) => {
    console.log(`AI Query for ${widgetId}:`, query);
    toast.info(`AI query sent for ${widgetId}: ${query}`);
  };

  // ✅ (Optional) show loader - you had it commented, I am NOT changing your logic.
  // If you want, uncomment below:
  // if (loading) return <Loader />

  // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  // date /12/12/2025 commented
  if (error) {
    return (
      <div className="flex justify-center items-center">
        <WelcomeDashboard />
      </div>
    );
  }

  // ✅ FIX: your API returns OBJECT, not array. So this check must be object-safe.
  // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  if (!financialData || (typeof financialData === "object" && Object.keys(financialData).length === 0)) {
    return (
      <div className="flex justify-center items-center h-screen">
        <WelcomeDashboard />
      </div>
    );
  }
  // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

  const kpiData = getKPIData();
  const chartsData = getChartsData();

  const chartTypes = {};
  widgets.forEach((widget) => {
    chartTypes[widget.name] = chartTypeMap[widget.Type] || "bar";
  });

  return (
    <div className="space-y-6 p-4 min-h-screen relative bg-sky-50">
      {loading && (
  <div className="fixed inset-0 z-[9999] bg-white/60 backdrop-blur-sm flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <Loader />
      <p className="text-sky-700 font-medium">Loading...</p>
    </div>
  </div>
)}

      <FinancialHeader
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        year={year}
        setYear={setYear}
        availableWidgets={availableWidgets}
        onAddWidget={handleAddWidget}

        // ✅ OPTIONAL: If you want currency selection in header later, keep these props ready
        // currency={currency}
        // setCurrency={setCurrency}
        // currencyFilter={currencyFilter}
        // setCurrencyFilter={setCurrencyFilter}
      />

      <FinancialFilters showFilters={showFilters} setShowFilters={setShowFilters} />

      <FinancialMetrics kpiData={kpiData} />

      <FinancialCharts
        widgets={widgets}
        chartsData={chartsData}
        chartTypes={chartTypes}
        onDragEnd={onDragEnd}
        onChartTypeChange={handleChartTypeChange}
        onAIQuery={handleAIQuery}
        onRemoveWidget={handleRemoveWidget}
      />

      <FinancialDataTable kpiData={kpiData} />
    </div>
  );
};

export default FinancialOverviewSkeliton;
