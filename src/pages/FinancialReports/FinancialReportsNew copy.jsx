import React, { useState, useRef, useEffect, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  FiDownload,
  FiPrinter,
  FiSend,
  FiFilter,
  FiTrendingUp,
  FiTrendingDown,
  FiAlertCircle,
} from "react-icons/fi";
import { BsStars } from "react-icons/bs";
import { CSVLink } from "react-csv";
import { GrLinkNext } from "react-icons/gr";
import { AuthContext } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config/config";
import { getDecimalPrecision } from '../../utils/formatters';

// Reports configuration
const reports = [
  {
    id: "pnl",
    title: "Profit & Loss Statement",
    desc: "Summarizes revenues, costs, and expenses over a specific period",
    route: "/p&l-Dashboard",
    apiEndpoint: "/api/v1/company/financial/profitandloss_statement",
  },
  {
    id: "cashFlow",
    title: "Cash Flow Statement",
    desc: "Tracks inflow and outflow of cash, highlighting operational activities",
    route: "/cash-flow-dashboard",
    apiEndpoint: "/api/v1/company/financial/cashflow_statement",
  },
  {
    id: "customerProfit",
    title: "Customer Profitability Report",
    desc: "Customer-wise revenue, cost and profit analysis",
    route: "/customer-profitability",
    apiEndpoint:
      "/api/v1/company/financial/financials/customer-summary-with-metrics",
  },

  {
    id: "revenue",
    title: "Revenue Report",
    desc: "Product, department and entity wise revenue",
    route: "/revenue-report",
    apiEndpoint: "/api/v1/company/financial/Revenue_Report",
  },

  // ... other reports remain the same
];

// Filter options
const timePeriods = [
  { id: "all", name: "All Periods" },
  { id: "current", name: "Current Month" },
  { id: "last", name: "Last Month" },
  { id: "qtd", name: "Quarter to Date" },
  { id: "ytd", name: "Year to Date" },
];

const hierarchies = [
  { id: "group", name: "Group Level" },
  { id: "department", name: "Department Level" },
  { id: "product", name: "Product Level" },
];

const FinancialReportsNewCopy = () => {
  const { token, selectedYear: year } = useContext(AuthContext);

  const [selectedReport, setSelectedReport] = useState("pnl");
  const [aiInputs, setAiInputs] = useState({});
  const [aiHistory, setAiHistory] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const [drillDownData, setDrillDownData] = useState(null);
  const [filters, setFilters] = useState({
    period: "all",
    entity: "all",
    hierarchy: "group",
    department: "all",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [activeInsight, setActiveInsight] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiData, setApiData] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [hasEntityColumn, setHasEntityColumn] = useState(false);
  const [profitView, setProfitView] = useState("entity");

  const [entities, setEntities] = useState([
    { id: "all", name: "All Entities" },
  ]);
  const [departments, setDepartments] = useState([
    { id: "all", name: "All Departments" },
  ]);

  // ✅ Helper: build applied filter labels (for showing above table)
  const getFilterLabel = (filters, entities, departments) => {
    const labels = [];

    const periodMap = {
      all: "All Periods",
      current: "Current Month",
      last: "Last Month",
      qtd: "Quarter to Date",
      ytd: "Year to Date",
    };

    // Time Period
    if (filters.period !== "all") {
      labels.push(`Period: ${periodMap[filters.period]}`);
    }

    // Hierarchy
    if (filters.hierarchy !== "group") {
      labels.push(`Hierarchy: ${filters.hierarchy}`);
    }

    // Entity
    if (filters.entity !== "all") {
      const entityName =
        entities.find((e) => e.id === filters.entity)?.name || filters.entity;
      labels.push(`Entity: ${entityName}`);
    }

    // Department
    if (filters.department !== "all") {
      const deptName =
        departments.find((d) => d.id === filters.department)?.name ||
        filters.department;
      labels.push(`Department: ${deptName}`);
    }

    return labels;
  };

  // Refs for click outside detection
  const aiChatbotRef = useRef(null);
  const filtersRef = useRef(null);

  const activeFilterLabels = React.useMemo(
    () => getFilterLabel(filters, entities, departments),
    [filters, entities, departments]
  );

  // Fetch data from API - only when report, year, or specific filters change
  useEffect(() => {
    const fetchData = async () => {
      const currentReport = reports.find((r) => r.id === selectedReport);

      // Only fetch data for P&L and Cash Flow reports
      if (!currentReport?.apiEndpoint) {
        setSampleData();
        return;
      }

      if (!year) {
        setError("Please select a year from the dashboard");
        setSampleData();
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Build query parameters - CORRECTED VERSION
        const queryParams = new URLSearchParams();

        // TIME PERIOD FILTERS - Send "yes" only for selected period
        // ✅ CORRECT QUERY PARAMS
        if (filters.period !== "all") {
          const map = {
            current: "current_month",
            last: "last_month",
            qtd: "quarter_to_date",
            ytd: "year_to_date",
          };
          queryParams.append("time_filter", map[filters.period]);
        }

        if (filters.entity !== "all") {
          queryParams.append("entity", filters.entity);
        }
        if (filters.entity !== "all") {
          const entityName = entities.find(
            (e) => e.id === filters.entity
          )?.name;
          if (entityName) {
            queryParams.append("entity", entityName); // ✅ backend expects NAME
          }
        }

        if (filters.hierarchy !== "group") {
          queryParams.append("hierarchy", filters.hierarchy); // ✅ spelling fixed
        }

        const url = `${API_BASE_URL}${currentReport.apiEndpoint}/${year}${
          queryParams.toString() ? `?${queryParams.toString()}` : ""
        }`;

        console.log("Fetching from:", url); // Debug log

        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setApiData(data);

        // Process the data based on report type
        if (selectedReport === "pnl") {
          processPnlData(data);
        } else if (selectedReport === "cashFlow") {
          processCashFlowData(data);
        } else if (selectedReport === "customerProfit") {
          processCustomerProfitData(data);
        } else if (selectedReport === "revenue") {
          processRevenueData(data);
        }

        // Extract dynamic filter values from the data
        extractDynamicFilters(data);
      } catch (error) {
        console.error(`Error fetching ${selectedReport} data:`, error);
        setError(`Failed to load ${selectedReport} data. Please try again.`);
        setSampleData();
      } finally {
        setLoading(false);
      }
    };

    if (token && year) {
      fetchData();
    } else if (!year) {
      setError("Please select a year from the dashboard");
      setSampleData();
    } else {
      setSampleData();
    }
  }, [
    selectedReport,
    token,
    year,
    filters.period,
    filters.entity,
    filters.hierarchy,
  ]); // Add department dependency

  // Build query parameters

  const queryParams = new URLSearchParams();

  /* ================= TIME PERIOD ================= */
  if (filters.period !== "all") {
    const periodMap = {
      current: "current_month",
      last: "last_month",
      qtd: "quarter_to_date",
      ytd: "year_to_date",
    };

    // Revenue API uses "period"
    if (selectedReport === "revenue") {
      queryParams.append("period", periodMap[filters.period]);
    } else {
      queryParams.append("time_filter", periodMap[filters.period]);
    }
  }

  /* ================= ENTITY ================= */
  if (filters.entity !== "all") {
    const entityName = entities.find((e) => e.id === filters.entity)?.name;

    if (entityName) {
      // Revenue & Customer Profit use entity_name
      if (selectedReport === "revenue" || selectedReport === "customerProfit") {
        queryParams.append("entity_name", entityName);
      } else {
        queryParams.append("entity", entityName);
      }
    }
  }

  /* ================= HIERARCHY ================= */
  if (filters.hierarchy !== "group" && selectedReport !== "revenue") {
    queryParams.append("hierarchy", filters.hierarchy);
  }

  /* ---------------- REVENUE REPORT ---------------- */

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close AI dropdown if clicked outside
      if (
        aiChatbotRef.current &&
        !aiChatbotRef.current.contains(event.target)
      ) {
        // Check if click is on the AI button itself
        const aiButton = event.target.closest("button");
        if (!aiButton || !aiButton.textContent.includes("Ask AI")) {
          setShowAIDropdown(null);
        }
      }

      // Close filters dropdown if clicked outside
      if (filtersRef.current && !filtersRef.current.contains(event.target)) {
        // Check if click is on the Filter button itself
        const filterButton = event.target.closest("button");
        if (!filterButton || !filterButton.textContent.includes("Filter")) {
          setShowFilters(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Extract dynamic filter values from API data
  const extractDynamicFilters = (data) => {
    // Extract entities from entity_filter data
    if (data.entity_filter && data.entity_filter.length > 0) {
      const uniqueEntities = [];
      const entityMap = new Map();

      data.entity_filter.forEach((item) => {
        if (
          item.entity_id &&
          item.entity_name &&
          !entityMap.has(item.entity_id)
        ) {
          entityMap.set(item.entity_id, item.entity_name);
          uniqueEntities.push({
            id: item.entity_id.toString(),
            name: item.entity_name,
          });
        }
      });

      // Sort entities by name
      uniqueEntities.sort((a, b) => a.name.localeCompare(b.name));
      setEntities([{ id: "all", name: "All Entities" }, ...uniqueEntities]);
    } else if (data.entity_filter && data.entity_filter.length === 0) {
      setEntities([{ id: "all", name: "All Entities" }]);
    }

    // Extract departments from hirarchy_data
    if (data.hirarchy_data && data.hirarchy_data.length > 0) {
      const uniqueDepartments = [];
      const deptMap = new Map();

      data.hirarchy_data.forEach((item) => {
        if (
          item.department_id &&
          item.department_name &&
          !deptMap.has(item.department_id)
        ) {
          deptMap.set(item.department_id, item.department_name);
          uniqueDepartments.push({
            id: item.department_id.toString(),
            name: item.department_name,
          });
        }
      });

      // Sort departments by name
      uniqueDepartments.sort((a, b) => a.name.localeCompare(b.name));
      setDepartments([
        { id: "all", name: "All Departments" },
        ...uniqueDepartments,
      ]);
    } else if (data.hirarchy_data && data.hirarchy_data.length === 0) {
      setDepartments([{ id: "all", name: "All Departments" }]);
    }
  };

  // Process P&L data
  // ✅ FIXED P&L DATA PROCESSOR
  const processPnlData = (data) => {
    // ✅ NEW API RETURNS ARRAY DIRECTLY
    if (!Array.isArray(data)) {
      console.error("Unexpected P&L response format", data);
      setTableData([]);
      setMetrics({});
      return;
    }

    if (data.length === 0) {
      setTableData([]);
      setMetrics({});
      return;
    }

    const transformedData = data.map((item) => ({
      period: item.period,
      actual_revenue: Number(item.actual_revenue) || 0,
      actual_costs: Number(item.actual_costs) || 0,
      budget_revenue: Number(item.budget_revenue) || null,
      budget_cost: Number(item.budget_cost) || null,
      actual_profit:
        Number(item.actual_profit) ??
        Number(item.actual_revenue) - Number(item.actual_costs),
      budget_profit: Number(item.budget_profit) || null,
      variance: Number(item.variance) || null,
      variance_percentage: Number(item.variance_percentage) || null,
    }));

    setTableData(transformedData);
    calculatePnlMetrics(transformedData);
  };

  const calculatePnlMetrics = (data) => {
    if (data.length > 0) {
      const totalActualProfit = data.reduce(
        (sum, item) => sum + (item.actual_profit || 0),
        0
      );
      const totalBudgetProfit = data.reduce(
        (sum, item) => sum + (item.budget_profit || 0),
        0
      );
      const overallVariance = totalActualProfit - totalBudgetProfit;
      const overallVariancePercentage =
        totalBudgetProfit !== 0
          ? (overallVariance / totalBudgetProfit) * 100
          : 0;

      let bestMonth = { actual_profit: -Infinity, period: "N/A" };
      let worstMonth = { actual_profit: Infinity, period: "N/A" };

      data.forEach((item) => {
        if (item.actual_profit > bestMonth.actual_profit) {
          bestMonth = item;
        }
        if (item.actual_profit < worstMonth.actual_profit) {
          worstMonth = item;
        }
      });

      setMetrics({
        totalActualProfit,
        totalBudgetProfit,
        overallVariance,
        overallVariancePercentage: overallVariancePercentage.toFixed(getDecimalPrecision()),
        bestMonth: bestMonth.period,
        worstMonth: worstMonth.period,
        bestMonthProfit: bestMonth.actual_profit,
        worstMonthProfit: worstMonth.actual_profit,
        insights: [
          `Total actual profit: $${totalActualProfit.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`,
          `Overall variance: ${
            overallVariance >= 0 ? "+" : ""
          }${overallVariancePercentage.toFixed(getDecimalPrecision())}%`,
          `Best performing month: ${bestMonth.period} with $${
            bestMonth.actual_profit?.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }) || 0
          } profit`,
          `Worst performing month: ${worstMonth.period} with $${
            worstMonth.actual_profit?.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }) || 0
          } profit`,
        ],
      });
    }
  };

  // Process Cash Flow data
  // ✅ CASH FLOW DATA PROCESSOR (NEW API FORMAT)
  const processCashFlowData = (data) => {
    if (!Array.isArray(data)) {
      console.error("Unexpected Cashflow response format", data);
      setTableData([]);
      setMetrics({});
      return;
    }

    // 1️⃣ Monthly rows (period present)
    const monthlyData = data.filter((item) => item.period);

    const entityExists = monthlyData.some((item) => item.entity_name);

    setHasEntityColumn(entityExists);

    const transformedTable = monthlyData.map((item) => {
      const row = {
        period: item.period,
        operating_cf: Number(item.operating_cf) || 0,
        investinging_cf: Number(item.investing_cf) || 0,
        financing_cf: Number(item.financing_cf) || 0,
        net_cash_change: Number(item.net_cash_change) || 0,
      };

      if (entityExists) {
        row.entity = item.entity_name || "—";
      }

      return row;
    });

    setTableData(transformedTable);

    // 2️⃣ Key Metrics
    const keyMetricsObj = data.find((item) => item.keymetrics)?.keymetrics;

    if (keyMetricsObj) {
      setMetrics({
        totalOperatingCF: keyMetricsObj.operational_total || 0,
        totalInvestingCF: keyMetricsObj.investing_total || 0,
        totalFinancingCF: keyMetricsObj.finalcial_total || 0,
        totalNetCashFlow: keyMetricsObj.net_cash_flow || 0,
        insights: [
          `Total net cash flow: $${keyMetricsObj.net_cash_flow?.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`,
          `Operating cash flow total: $${keyMetricsObj.operational_total?.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`,
          `Investing cash flow total: $${keyMetricsObj.investing_total?.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`,
        ],
      });
    } else {
      calculateCashFlowMetrics(transformedTable);
    }

    // 3️⃣ Entities for filter dropdown
    const entityBlock = data.find((item) => item.entities)?.entities;

    if (Array.isArray(entityBlock)) {
      setEntities([
        { id: "all", name: "All Entities" },
        ...entityBlock.map((e) => ({
          id: e.entity_id.toString(),
          name: e.entity_name,
        })),
      ]);
    }
  };

  const calculateCashFlowMetrics = (data) => {
    if (data.length > 0) {
      const totalOperatingCF = data.reduce(
        (sum, item) => sum + (item.operating_cf || 0),
        0
      );
      const totalInvestingCF = data.reduce(
        (sum, item) => sum + (item.investing_cf || 0),
        0
      );
      const totalFinancingCF = data.reduce(
        (sum, item) => sum + (item.financing_cf || 0),
        0
      );
      const totalNetCashFlow =
        totalOperatingCF + totalInvestingCF + totalFinancingCF;

      let bestMonth = { operating_cf: -Infinity, period: "N/A" };
      let worstMonth = { operating_cf: Infinity, period: "N/A" };

      data.forEach((item) => {
        if (item.operating_cf > bestMonth.operating_cf) {
          bestMonth = item;
        }
        if (item.operating_cf < worstMonth.operating_cf) {
          worstMonth = item;
        }
      });

      const operatingPositiveMonths = data.filter(
        (item) => item.operating_cf > 0
      ).length;
      const operatingCFPercentage =
        (operatingPositiveMonths / data.length) * 100;

      setMetrics({
        totalOperatingCF,
        totalInvestingCF,
        totalFinancingCF,
        totalNetCashFlow,
        avgOperatingCF: totalOperatingCF / data.length,
        avgInvestingCF: totalInvestingCF / data.length,
        avgFinancingCF: totalFinancingCF / data.length,
        operatingPositiveMonths,
        operatingNegativeMonths: data.length - operatingPositiveMonths,
        operatingCFPercentage: operatingCFPercentage.toFixed(getDecimalPrecision()),
        bestMonth: bestMonth.period,
        worstMonth: worstMonth.period,
        bestMonthCF: bestMonth.operating_cf,
        worstMonthCF: worstMonth.operating_cf,
        insights: [
          `Total operating cash flow: $${totalOperatingCF.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`,
          `Total net cash flow: $${totalNetCashFlow.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`,
          `${operatingPositiveMonths} months with positive operating cash flow (${operatingCFPercentage.toFixed(
            1
          )}%)`,
          `Best operating cash flow month: ${bestMonth.period} with $${
            bestMonth.operating_cf?.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }) || 0
          }`,
          `Worst operating cash flow month: ${worstMonth.period} with $${
            worstMonth.operating_cf?.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }) || 0
          }`,
        ],
      });
    }
  };

  // process Customer Profit Data

  const processCustomerProfitData = (data) => {
    if (!data?.Customers || !Array.isArray(data.Customers)) {
      setTableData([]);
      setMetrics({});
      return;
    }

    // Table rows
    const table = data.Customers.map((c) => ({
      rank: c.rank,
      customer: c.customer_name,
      entity: profitView === "entity" ? c.entity_name : c.product_name,
      revenue: Number(c.revenue),
      cost: Number(c.cost),
      profit: Number(c.profit),
      margin_pct: Number(c.margin_pct),
    }));

    setTableData(table);

    // Metrics
    const km = data["Key Metrics"];
    setMetrics({
      totalRevenue: km.total_revenue,
      totalCost: km.total_cost,
      totalProfit: km.total_profit,
      profitMargin: km.profit_margin_pct,
      insights: [
        `Total Profit: $${km.total_profit.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`,
        `Profit Margin: ${km.profit_margin_pct}%`,
        `Top Customer: ${table[0]?.customer}`,
      ],
    });
  };

  // Revenue DAta

  const processRevenueData = (data) => {
    // ✅ Revenue API returns { products: [] }
    if (!data?.products || !Array.isArray(data.products)) {
      console.error("Invalid Revenue API response", data);
      setTableData([]);
      setMetrics({});
      return;
    }

    const table = data.products.map((row) => ({
      product: row.product_name,
      department: row.department_name,
      entity: row.entity_name,
      q1: Number(row.q1) || 0,
      q2: Number(row.q2) || 0,
      q3: Number(row.q3) || 0,
      q4: Number(row.q4) || 0,
      total: Number(row.total) || 0,
    }));

    setTableData(table);

    const totalRevenue = table.reduce((sum, r) => sum + r.total, 0);

    setMetrics({
      totalRevenue,
      insights: [
        `Total Revenue: $${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`,
        `Products: ${new Set(table.map((t) => t.product)).size}`,
        `Entities: ${new Set(table.map((t) => t.entity)).size}`,
      ],
    });
  };

  // Fallback sample data function for other reports
  const setSampleData = () => {
    if (selectedReport === "pnl") {
      const sampleTableData = [
        {
          period: "2025-01",
          actual_revenue: 4181468.76,
          actual_costs: 749608.04,
          budget_revenue: 9250822.32,
          budget_cost: 6666743.24,
          actual_profit: 1871435.67,
          budget_profit: 2584079.08,
          variance: -1901103.74,
          variance_percentage: -2858.15,
        },
        {
          period: "2025-02",
          actual_revenue: 4012507.73,
          actual_costs: 835169.18,
          budget_revenue: 8671482.24,
          budget_cost: 6929159.04,
          actual_profit: 1632664.16,
          budget_profit: 1742323.2,
          variance: -677619.87,
          variance_percentage: -3699.05,
        },
        {
          period: "2025-03",
          actual_revenue: 4000577.07,
          actual_costs: 800069.84,
          budget_revenue: 11764478.4,
          budget_cost: 8695374.88,
          actual_profit: 1582756.15,
          budget_profit: 3069103.52,
          variance: -2247069.8,
          variance_percentage: -3113.14,
        },
      ];

      setTableData(sampleTableData);
      calculatePnlMetrics(sampleTableData);

      if (!year) {
        setMetrics((prev) => ({
          ...prev,
          insights: [
            "Using sample data - please select a year from dashboard",
            ...(prev.insights || []),
          ],
        }));
      }
    } else if (selectedReport === "cashFlow") {
      const sampleTableData = [
        {
          period: "2023-01",
          operating_cf: 261617.13,
          investing_cf: 5422779.13,
          financing_cf: 0,
          net_cash_change: 5684396.26,
        },
        {
          period: "2023-02",
          operating_cf: 518780.32,
          investing_cf: 5434914.98,
          financing_cf: 0,
          net_cash_change: 5953695.3,
        },
        {
          period: "2023-03",
          operating_cf: 816701.81,
          investing_cf: 5566205.98,
          financing_cf: 0,
          net_cash_change: 6382907.79,
        },
      ];

      setTableData(sampleTableData);
      calculateCashFlowMetrics(sampleTableData);

      if (!year) {
        setMetrics((prev) => ({
          ...prev,
          insights: [
            "Using sample data - please select a year from dashboard",
            ...(prev.insights || []),
          ],
        }));
      }
    } else {
      // Dummy data for other reports
      const dummyData = [
        {
          period: "2025-01",
          metric1: 1500000,
          metric2: 1200000,
          metric3: 300000,
        },
        {
          period: "2025-02",
          metric1: 1600000,
          metric2: 1300000,
          metric3: 300000,
        },
        {
          period: "2025-03",
          metric1: 1700000,
          metric2: 1400000,
          metric3: 300000,
        },
      ];

      setTableData(dummyData);
      setMetrics({
        insights: [
          "This is dummy data for demonstration purposes",
          "Connect this report to your actual data source",
          "Configure API endpoints for real data integration",
        ],
      });
    }
  };

  // Filter data based on selected filters - Client-side filtering for non-API calls
  const filteredData = React.useMemo(() => {
    // ✅ Revenue: just return table data
    if (selectedReport === "revenue") {
      return tableData;
    }

    if (!apiData || !tableData.length) return [];

    let result = [...tableData];

    if (
      filters.hierarchy === "department" &&
      filters.department !== "all" &&
      apiData?.hirarchy_data
    ) {
      const departmentData = apiData.hirarchy_data.filter(
        (item) => item.department_id?.toString() === filters.department
      );

      result = departmentData.map((item) => ({
        period: item.period,
        department: item.department_name,
        actual_revenue: item.actual_revenue || 0,
        actual_costs: item.actual_costs || 0,
        actual_profit: item.actual_profit || 0,
        budget_revenue: item.budget_revenue || null,
        budget_cost: item.budget_cost || null,
        budget_profit: item.budget_profit || null,
        variance: item.variance || null,
        variance_percentage: item.variance_percentage || null,
      }));
    }

    return result;
  }, [tableData, filters, apiData, selectedReport]);

  const currentReport = reports.find((r) => r.id === selectedReport);

  // Rotate insights every 5 seconds
  useEffect(() => {
    if (metrics?.insights?.length > 1) {
      const interval = setInterval(() => {
        setActiveInsight((prev) => (prev + 1) % metrics.insights.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [metrics]);

  const handleSendAIQuery = () => {
    const input = aiInputs[selectedReport] || "";
    if (input.trim()) {
      const response = `AI Insight for ${selectedReport}: ${input} (mock insight)`;
      setAiHistory((prev) => ({
        ...prev,
        [selectedReport]: [
          ...(prev[selectedReport] || []),
          { query: input, response },
        ],
      }));
      setAiInputs((prev) => ({ ...prev, [selectedReport]: "" }));
      setShowAIDropdown(null);
    }
  };

  const handleDrillDown = (rowData) => {
    setDrillDownData({
      title: `${currentReport?.title || "Report"} - ${
        rowData.period || "Period"
      }${rowData.entity ? ` - ${rowData.entity}` : ""}${
        rowData.department ? ` - ${rowData.department}` : ""
      }`,
      data: Object.entries(rowData).map(([key, value]) => ({
        field: key,
        value: formatValue(key, value),
      })),
      insights: [
        `Detailed analysis for ${rowData.period || "selected period"}`,
        keyInsightsForRow(rowData),
      ],
    });
  };

  const formatValue = (key, value) => {
    if (value === null || value === undefined) return "N/A";

    // Format based on key type
    if (key === "period" || key === "department" || key === "entity") {
      return value;
    }

    if (key.includes("percentage")) {
      return `${parseFloat(value).toFixed(getDecimalPrecision())}%`;
    }

    if (typeof value === "number") {
      // Format currency values
      if (Math.abs(value) >= 1000000) {
        return `$${(value / 1000000).toFixed(getDecimalPrecision())}M`;
      } else if (Math.abs(value) >= 1000) {
        return `$${(value / 1000).toFixed(getDecimalPrecision())}k`;
      }
      return `$${value.toLocaleString(undefined, {
        minimumFractionDigits: getDecimalPrecision(),
        maximumFractionDigits: getDecimalPrecision(),
      })}`;
    }

    return value;
  };

  const keyInsightsForRow = (rowData) => {
    if (selectedReport === "pnl") {
      const variance = rowData.variance;
      const variancePercentage = rowData.variance_percentage;

      if (variance > 0) {
        return `Performance exceeded budget by $${Math.abs(
          variance
        ).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} (${Math.abs(variancePercentage).toFixed(getDecimalPrecision())}%)`;
      } else if (variance < 0) {
        return `Performance below budget by $${Math.abs(
          variance
        ).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} (${Math.abs(variancePercentage).toFixed(getDecimalPrecision())}%)`;
      }
      return "Performance exactly matches budget";
    }
    return "Key metrics within expected ranges";
  };

  const handleFilterChange = (filterType, value) => {
    setFilters((prev) => {
      const newFilters = { ...prev, [filterType]: value };

      // Reset dependent filters
      if (filterType === "hierarchy") {
        if (value !== "department") {
          newFilters.department = "all";
        }
        if (value !== "entity") {
          newFilters.entity = "all";
        }
      }

      // When changing entity, reset department if not in entity hierarchy
      if (filterType === "entity" && prev.hierarchy !== "entity") {
        newFilters.department = "all";
      }

      return newFilters;
    });

    // Keep filters dropdown open for hierarchy selection
    if (filterType !== "hierarchy") {
      setShowFilters(false);
    }
  };

  const renderQuickAnalysis = () => {
    if (!metrics) return null;

    return (
      <div className="bg-sky-50/50 p-4 rounded-lg border border-sky-200">
        <h3 className="text-s font-semibold text-sky-900 mb-3">
          {currentReport?.title || "Report"} Summary
        </h3>
        <div className="text-x text-sky-700 space-y-3">
          {selectedReport === "pnl" && metrics && (
            <>
              <div className="flex items-start">
                <div
                  className={`p-2 rounded-full mr-3 ${
                    metrics.overallVariance >= 0
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {metrics.overallVariance >= 0 ? (
                    <FiTrendingUp size={16} />
                  ) : (
                    <FiTrendingDown size={16} />
                  )}
                </div>
                <div>
                  <p className="font-medium">Total Period Performance</p>
                  <p className="text-black">
                    {metrics.overallVariance >= 0 ? "Surplus" : "Deficit"} of $
                    {Math.abs(metrics.overallVariance).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} (
                    {metrics.overallVariancePercentage}%) compared to budget
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="p-2 rounded-full mr-3 bg-green-100 text-green-700">
                  <FiTrendingUp size={16} />
                </div>
                <div>
                  <p className="font-medium">Best Performing Period</p>
                  <p className="text-black">
                    {metrics.bestMonth} with $
                    {metrics.bestMonthProfit?.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }) || "N/A"} profit
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="p-2 rounded-full mr-3 bg-red-100 text-red-700">
                  <FiTrendingDown size={16} />
                </div>
                <div>
                  <p className="font-medium">Worst Performing Period</p>
                  <p className="text-black">
                    {metrics.worstMonth} with $
                    {metrics.worstMonthProfit?.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }) || "N/A"} profit
                  </p>
                </div>
              </div>
            </>
          )}
          {selectedReport === "cashFlow" && metrics && (
            <>
              <div className="flex items-start">
                <div
                  className={`p-2 rounded-full mr-3 ${
                    metrics.totalOperatingCF >= 0
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {metrics.totalOperatingCF >= 0 ? (
                    <FiTrendingUp size={16} />
                  ) : (
                    <FiTrendingDown size={16} />
                  )}
                </div>
                <div>
                  <p className="font-medium">Operating Cash Flow</p>
                  <p className="text-black">
                    {metrics.totalOperatingCF >= 0 ? "Positive" : "Negative"}{" "}
                    cash flow of $
                    {Math.abs(metrics.totalOperatingCF).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <div
                  className={`p-2 rounded-full mr-3 ${
                    metrics.totalNetCashFlow >= 0
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {metrics.totalNetCashFlow >= 0 ? (
                    <FiTrendingUp size={16} />
                  ) : (
                    <FiTrendingDown size={16} />
                  )}
                </div>
                <div>
                  <p className="font-medium">Net Cash Position</p>
                  <p className="text-black">
                    {metrics.totalNetCashFlow >= 0
                      ? "Net increase"
                      : "Net decrease"}{" "}
                    of ${Math.abs(metrics.totalNetCashFlow).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="p-2 rounded-full mr-3 bg-blue-100 text-blue-700">
                  <FiAlertCircle size={16} />
                </div>
                <div>
                  <p className="font-medium">Cash Flow Health</p>
                  <p className="text-black">
                    {metrics.operatingPositiveMonths} of {tableData.length}{" "}
                    months with positive operating cash flow
                  </p>
                </div>
              </div>
            </>
          )}

          {selectedReport === "customerProfit" && (
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setProfitView("entity")}
                className={`px-3 py-1 text-x rounded ${
                  profitView === "entity"
                    ? "bg-sky-900 text-white"
                    : "bg-sky-100 text-sky-800"
                }`}
              >
                Entity View
              </button>

              <button
                onClick={() => setProfitView("product")}
                className={`px-3 py-1 text-x rounded ${
                  profitView === "product"
                    ? "bg-sky-900 text-white"
                    : "bg-sky-100 text-sky-800"
                }`}
              >
                Product View
              </button>
            </div>
          )}

          {selectedReport === "revenue" && metrics && (
            <div className="flex justify-between">
              <span>Total Revenue</span>
              <span className="text-green-600">
                ${metrics.totalRevenue?.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
              </span>
            </div>
          )}

          {!["pnl", "cashFlow", "customerProfit", "revenue"].includes(
            selectedReport
          ) && (
            <div className="flex items-start">
              <div className="p-2 rounded-full mr-3 bg-blue-100 text-blue-700">
                <FiAlertCircle size={16} />
              </div>
              <div>
                <p className="font-medium">Report Analysis</p>
                <p className="text-black">
                  Select P&L or Cash Flow report for detailed financial
                  analysis.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTable = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-500"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center text-red-700">
            <FiAlertCircle className="mr-2" />
            <p>{error}</p>
          </div>
          {!year && (
            <p className="mt-2 text-s text-red-600">
              Please select a year from the dashboard to view real data.
            </p>
          )}
        </div>
      );
    }

    if (!filteredData || filteredData.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <FiAlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-2" />
          <p>No data available for the selected filters</p>
          <p className="text-s mt-1">Try selecting different filter options</p>
        </div>
      );
    }

    // Get column headers based on the first row of data
    const columns = Object.keys(filteredData[0]);

    return (
      <div className="overflow-y-auto bg-white/50 rounded-lg border border-sky-100 max-h-96">
        <table className="w-full text-x">
          <thead>
            <tr className="bg-sky-100 text-sky-900 sticky top-0">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-2 py-1 text-left capitalize whitespace-nowrap"
                >
                  {col.replace(/_/g, " ").replace(/([A-Z])/g, " $1")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, index) => (
              <tr
                key={index}
                className="border-b border-sky-200 hover:bg-sky-50 cursor-pointer"
                onClick={() => handleDrillDown(row)}
              >
                {columns.map((col) => {
                  const value = row[col];
                  let cellClass = "px-2 py-1 whitespace-nowrap";

                  if (typeof value === "number") {
                    if (value < 0) {
                      cellClass += " text-red-600";
                    } else if (
                      col.includes("profit") ||
                      col.includes("revenue")
                    ) {
                      cellClass += " text-green-600";
                    } else {
                      cellClass += " text-sky-600";
                    }
                  } else {
                    cellClass += " text-sky-900";
                  }

                  return (
                    <td key={col} className={cellClass}>
                      {formatValue(col, value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderDrillDownView = () => {
    if (!drillDownData) return null;

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-sky-900">
            {drillDownData.title}
          </h3>
          <button
            onClick={() => setDrillDownData(null)}
            className="text-s text-sky-600 hover:text-sky-800"
          >
            Back to Report
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-sky-50 rounded-lg p-4">
            <h4 className="text-s font-medium text-sky-800 mb-3">Details</h4>
            <table className="w-full text-s">
              <tbody>
                {drillDownData.data.map((item, index) => (
                  <tr key={index} className="border-b border-sky-100">
                    <td className="py-2 font-medium text-sky-900 capitalize">
                      {item.field.replace(/_/g, " ").replace(/([A-Z])/g, " $1")}
                    </td>
                    <td
                      className={`py-2 text-right ${
                        typeof item.value === "string" &&
                        item.value.includes("-$")
                          ? "text-red-600"
                          : typeof item.value === "string" &&
                            item.value.includes("$") &&
                            !item.value.includes("-$")
                          ? item.field.includes("profit") ||
                            item.field.includes("revenue")
                            ? "text-green-600"
                            : "text-sky-500"
                          : ""
                      }`}
                    >
                      {item.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-sky-50 rounded-lg p-4">
            <h4 className="text-s font-medium text-sky-800 mb-3">Insights</h4>
            <ul className="space-y-3 text-s">
              {drillDownData.insights.map((insight, index) => (
                <li key={index} className="flex items-start">
                  <div className="flex-shrink-0 h-5 w-5 text-sky-500">
                    <FiAlertCircle className="h-full w-full" />
                  </div>
                  <p className="ml-2 text-gray-700">{insight}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  const renderKeyMetrics = () => {
    if (!metrics) return null;

    return (
      <div className="space-y-3">
        <h3 className="text-s font-semibold text-sky-900 mb-2">Key Metrics</h3>
        <div className="text-s text-black space-y-2">
          {selectedReport === "pnl" && metrics && (
            <>
              <div className="flex justify-between items-center">
                <span>Total Actual Profit:</span>
                <span
                  className={`font-medium ${
                    metrics.totalActualProfit >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  ${Math.abs(metrics.totalActualProfit || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
                  {metrics.totalActualProfit >= 0 ? (
                    <FiTrendingUp className="inline ml-1" />
                  ) : (
                    <FiTrendingDown className="inline ml-1" />
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Overall Variance:</span>
                <span
                  className={`font-medium ${
                    metrics.overallVariance >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  ${Math.abs(metrics.overallVariance || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} (
                  {metrics.overallVariancePercentage || 0}%)
                  {metrics.overallVariance >= 0 ? (
                    <FiTrendingUp className="inline ml-1" />
                  ) : (
                    <FiTrendingDown className="inline ml-1" />
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Best Month:</span>
                <span className="font-medium text-green-600">
                  {metrics.bestMonth} ($
                  {Math.abs(metrics.bestMonthProfit || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })})
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Worst Month:</span>
                <span className="font-medium text-red-600">
                  {metrics.worstMonth} ($
                  {Math.abs(metrics.worstMonthProfit || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })})
                </span>
              </div>
            </>
          )}

          {selectedReport === "cashFlow" && metrics && (
            <>
              <div className="flex justify-between items-center">
                <span>Operating Cash Flow:</span>
                <span
                  className={`font-medium ${
                    metrics.totalOperatingCF >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  ${Math.abs(metrics.totalOperatingCF || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
                  {metrics.totalOperatingCF >= 0 ? (
                    <FiTrendingUp className="inline ml-1" />
                  ) : (
                    <FiTrendingDown className="inline ml-1" />
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Net Cash Flow:</span>
                <span
                  className={`font-medium ${
                    metrics.totalNetCashFlow >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  ${Math.abs(metrics.totalNetCashFlow || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
                  {metrics.totalNetCashFlow >= 0 ? (
                    <FiTrendingUp className="inline ml-1" />
                  ) : (
                    <FiTrendingDown className="inline ml-1" />
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Positive Cash Flow Months:</span>
                <span className="font-medium text-green-600">
                  {metrics.operatingPositiveMonths || 0} (
                  {metrics.operatingCFPercentage || 0}%)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Best Operating CF Month:</span>
                <span className="font-medium text-green-600">
                  {metrics.bestMonth} ($
                  {Math.abs(metrics.bestMonthCF || 0).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })})
                </span>
              </div>
            </>
          )}

          {!["pnl", "cashFlow"].includes(selectedReport) && (
            <div className="text-center text-gray-500 py-4">
              Select P&L or Cash Flow report to view key metrics
            </div>
          )}
        </div>

        {metrics.insights && (
          <div className="mt-4">
            <h4 className="text-x font-semibold text-sky-900 mb-2 flex items-center">
              <FiAlertCircle className="mr-1" /> Performance Insights
            </h4>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeInsight}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="text-x bg-sky-100 p-3 rounded-lg border border-sky-200"
              >
                {metrics.insights[activeInsight]}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>
    );
  };

  // Reset department filter when hierarchy changes
  useEffect(() => {
    if (filters.hierarchy !== "department") {
      setFilters((prev) => ({ ...prev, department: "all" }));
    }
    if (filters.hierarchy !== "entity") {
      setFilters((prev) => ({ ...prev, entity: "all" }));
    }
  }, [filters.hierarchy]);

  // Reset filters when report changes
  // Reset filters ONLY when report changes
  useEffect(() => {
    setFilters({
      period: "all",
      entity: "all",
      hierarchy: "group",
      department: "all",
    });
    setDrillDownData(null);
  }, [selectedReport]);

  return (
    <div className="min-h-screen bg-sky-50 p-6">
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Financial Reports</h1>
            <p className="text-sky-100 text-x">
              Discover actionable financial insights
            </p>
            {year && (
              <p className="text-sky-100 text-x mt-1">
                Selected Year: <span className="font-semibold">{year}</span>
              </p>
            )}
          </div>
          <button
            onClick={() => window.print()}
            className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 hover:text-sky-900 transition-colors duration-200"
          >
            <FiDownload className="text-sky-50 hover:text-sky-900" />
            <span className="text-sky-50 hover:text-sky-900">Export</span>
          </button>
        </div>
      </div>

      <nav className="flex mb-6" aria-label="Breadcrumb">
        <ol className="inline-flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse">
          <li className="inline-flex items-center">
            <Link
              to="/"
              className="inline-flex items-center text-s font-medium text-sky-900 hover:text-blue-600"
            >
              Home
            </Link>
          </li>
          <li aria-current="page">
            <div className="flex items-center">
              <svg
                className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 6 10"
              >
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="m1 9 4-4-4-4"
                />
              </svg>
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">
                Financial Reports
              </span>
            </div>
          </li>
        </ol>
      </nav>

      <div className="flex gap-6">
        <aside className="w-1/4 bg-white p-4 rounded-xl shadow-md">
          <h2 className="text-sky-800 text-md font-semibold mb-4">Reports</h2>
          <ul className="space-y-2">
            {reports.map((r) => (
              <li
                key={r.id}
                onClick={() => {
                  setSelectedReport(r.id);
                }}
                className={`px-3 py-2 rounded-md text-s cursor-pointer transition ${
                  selectedReport === r.id
                    ? "bg-sky-100 text-sky-800 font-semibold"
                    : "text-sky-700 hover:bg-sky-50"
                }`}
              >
                {r.title}
              </li>
            ))}
          </ul>
        </aside>

        <main className="w-3/4 bg-white p-6 rounded-xl shadow-md">
          <div className="mb-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-semibold text-sky-900 flex items-center gap-2">
                  {drillDownData ? drillDownData.title : currentReport?.title}
                  {!year && selectedReport !== "balanceSheet" && (
                    <span className="text-x bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                      Sample Data
                    </span>
                  )}
                </h2>
                <p className="text-sky-600 text-s mb-2">
                  {drillDownData
                    ? "Detailed view of selected item"
                    : currentReport?.desc}
                </p>
              </div>
              {!drillDownData && currentReport?.route && (
                <Link
                  to={currentReport.route}
                  className="text-sky-500 hover:text-sky-700 mt-1"
                >
                  <button
                    type="button"
                    className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200"
                  >
                    View More
                    <GrLinkNext className="ml-1 w-4 h-4 hover:w-5 hover:h-5 transition-all" />
                  </button>
                </Link>
              )}
            </div>
          </div>

          {!drillDownData && (
            <div className="mb-4 flex flex-wrap gap-2 justify-end items-center">
              <div className="flex gap-2 items-center flex-wrap">
                {/* Applied Filters */}
                {activeFilterLabels.length > 0 && (
                  <div className="flex flex-wrap gap-2 ml-2">
                    {activeFilterLabels.map((label, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-2 text-x rounded-xl bg-sky-900 text-white border border-sky-200 animate-pulse"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}

                <div className="relative" ref={filtersRef}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowFilters(!showFilters);
                    }}
                    className="flex items-center bg-sky-100 hover:bg-sky-200 text-sky-800 rounded-lg px-3 py-2 text-x"
                  >
                    <FiFilter className="mr-2" /> Filter
                  </button>

                  <AnimatePresence>
                    {showFilters && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute z-50 mt-2 w-64 bg-white rounded-lg shadow-lg border border-sky-200 p-4 right-0"
                      >
                        <div className="space-y-3">
                          <div>
                            <label className="block text-x font-medium text-sky-700 mb-1">
                              Time Period
                            </label>
                            <select
                              value={filters.period}
                              onChange={(e) =>
                                handleFilterChange("period", e.target.value)
                              }
                              className="w-full p-2 border border-sky-300 rounded text-x"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {timePeriods.map((period) => (
                                <option key={period.id} value={period.id}>
                                  {period.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-x font-medium text-sky-700 mb-1">
                              Hierarchy Level
                            </label>
                            <select
                              value={filters.hierarchy}
                              onChange={(e) =>
                                handleFilterChange("hierarchy", e.target.value)
                              }
                              className="w-full p-2 border border-sky-300 rounded text-x"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {hierarchies.map((hierarchy) => (
                                <option key={hierarchy.id} value={hierarchy.id}>
                                  {hierarchy.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {(filters.hierarchy === "entity" ||
                            filters.hierarchy === "group") && (
                            <div>
                              <label className="block text-x font-medium text-sky-700 mb-1">
                                Entity
                              </label>
                              <select
                                value={filters.entity}
                                onChange={(e) =>
                                  handleFilterChange("entity", e.target.value)
                                }
                                className="w-full p-2 border border-sky-300 rounded text-x"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {entities.map((entity) => (
                                  <option key={entity.id} value={entity.id}>
                                    {entity.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {filters.hierarchy === "department" && (
                            <div>
                              <label className="block text-x font-medium text-sky-700 mb-1">
                                Department
                              </label>
                              <select
                                value={filters.department}
                                onChange={(e) =>
                                  handleFilterChange(
                                    "department",
                                    e.target.value
                                  )
                                }
                                className="w-full p-2 border border-sky-300 rounded text-x"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {departments.map((dept) => (
                                  <option key={dept.id} value={dept.id}>
                                    {dept.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          <div className="pt-2 border-t border-sky-200">
                            <button
                              onClick={() => {
                                setFilters({
                                  period: "all",
                                  entity: "all",
                                  hierarchy: "group",
                                  department: "all",
                                });
                                setShowFilters(false);
                              }}
                              className="w-full py-2 text-x bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                            >
                              Reset Filters
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="flex gap-2">
                <CSVLink
                  data={filteredData || []}
                  filename={`${currentReport?.title.replace(/\s+/g, "-")}_${
                    year || "sample"
                  }.csv`}
                  className="flex items-center px-3 py-2 bg-sky-100 text-sky-800 rounded-lg text-x hover:bg-sky-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FiDownload className="mr-1" /> CSV
                </CSVLink>
                <button
                  onClick={() => window.print()}
                  className="flex items-center px-3 py-2 bg-sky-100 text-sky-800 rounded-lg text-x hover:bg-sky-200"
                  onClickCapture={(e) => e.stopPropagation()}
                >
                  <FiPrinter className="mr-1" /> Print
                </button>
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAIDropdown(selectedReport);
                    }}
                    className="flex items-center px-3 py-2 text-sky-800 rounded-lg bg-sky-100 hover:bg-sky-200 text-x"
                  >
                    <BsStars className="mr-1" /> Ask AI
                  </button>

                  {showAIDropdown === selectedReport && currentReport && (
                    <motion.div
                      ref={aiChatbotRef}
                      className="absolute z-50 mt-2 right-0 w-80 bg-white/90 backdrop-blur-md rounded-lg shadow-lg border border-sky-200 p-2"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <h1 className="text-s font-semibold text-sky-900 mb-2">
                        Ask about {currentReport.title}
                      </h1>
                      <div className="flex items-center space-x-2 mb-4">
                        <input
                          type="text"
                          value={aiInputs[selectedReport] || ""}
                          onChange={(e) =>
                            setAiInputs((prev) => ({
                              ...prev,
                              [selectedReport]: e.target.value,
                            }))
                          }
                          placeholder="Ask AI about this report..."
                          className="w-full p-2 border border-sky-300 rounded-lg bg-sky-50 text-sky-900 text-s focus:outline-none focus:ring-2 focus:ring-sky-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendAIQuery();
                          }}
                          className="p-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                          disabled={!aiInputs[selectedReport]?.trim()}
                        >
                          <FiSend className="w-5 h-5" />
                        </button>
                      </div>
                      {aiHistory[selectedReport]?.length > 0 && (
                        <div className="space-y-2 max-h-32 overflow-y-auto text-x text-sky-700">
                          {aiHistory[selectedReport].map((entry, index) => (
                            <div key={index}>
                              <strong>Q:</strong> {entry.query}
                              <br />
                              <strong>A:</strong> {entry.response}
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="mb-6">
            {drillDownData ? renderDrillDownView() : renderTable()}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>{!drillDownData && renderKeyMetrics()}</div>
            <div>{renderQuickAnalysis()}</div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default FinancialReportsNewCopy;
