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
  FiDollarSign,
} from "react-icons/fi";
import { BsStars } from "react-icons/bs";
import { CSVLink } from "react-csv";
import { GrLinkNext } from "react-icons/gr";
import { AuthContext } from "../../context/AuthContext";
import { API_BASE_URL } from '../../config/config';
import { getDecimalPrecision } from '../../utils/formatters';


// Comprehensive Sample Data for all reports
const sampleData = {
  pnl: {
    tableData: [
      {
        month: "Jan",
        ActualRevenue: 12000,
        ActualCosts: 8000,
        BudgetRevenue: 15000,
        BudgetCosts: 9000,
        ActualProfit: 4000,
        BudgetProfit: 6000,
        Variance: -2000,
        VariancePercentage: -33.3,
      },
      {
        month: "Feb",
        ActualRevenue: 19000,
        ActualCosts: 10000,
        BudgetRevenue: 15000,
        BudgetCosts: 9500,
        ActualProfit: 9000,
        BudgetProfit: 5500,
        Variance: 3500,
        VariancePercentage: 63.6,
      },
      {
        month: "Mar",
        ActualRevenue: 15000,
        ActualCosts: 11000,
        BudgetRevenue: 17000,
        BudgetCosts: 10500,
        ActualProfit: 4000,
        BudgetProfit: 6500,
        Variance: -2500,
        VariancePercentage: -38.5,
      },
      {
        month: "Apr",
        ActualRevenue: 18000,
        ActualCosts: 12000,
        BudgetRevenue: 20000,
        BudgetCosts: 11500,
        ActualProfit: 6000,
        BudgetProfit: 8500,
        Variance: -2500,
        VariancePercentage: -29.4,
      },
      {
        month: "May",
        ActualRevenue: 22000,
        ActualCosts: 13000,
        BudgetRevenue: 21000,
        BudgetCosts: 12500,
        ActualProfit: 9000,
        BudgetProfit: 8500,
        Variance: 500,
        VariancePercentage: 5.9,
      },
      {
        month: "Jun",
        ActualRevenue: 24000,
        ActualCosts: 14000,
        BudgetRevenue: 23000,
        BudgetCosts: 13500,
        ActualProfit: 10000,
        BudgetProfit: 9500,
        Variance: 500,
        VariancePercentage: 5.3,
      },
    ],
    metrics: {
      totalActualProfit: 36000,
      totalBudgetProfit: 39500,
      overallVariance: -3500,
      overallVariancePercentage: -8.9,
      bestMonth: "Feb",
      worstMonth: "Mar",
      insights: [
        "February showed strongest performance with 63.6% above budget profit",
        "March had the largest negative variance at -38.5% below budget",
        "Overall performance was 8.9% below budget expectations",
      ],
    },
  },
  cashFlow: {
    tableData: [
      { month: "Jan", Operational: 5000, Investing: -2000, Financing: 3000, NetChange: 6000 },
      { month: "Feb", Operational: 6000, Investing: -1500, Financing: 2500, NetChange: 7000 },
      { month: "Mar", Operational: 7000, Investing: -1000, Financing: 2000, NetChange: 8000 },
      { month: "Apr", Operational: 8000, Investing: -500, Financing: 1500, NetChange: 9000 },
      { month: "May", Operational: 9000, Investing: 0, Financing: 1000, NetChange: 10000 },
      { month: "Jun", Operational: 10000, Investing: -200, Financing: 800, NetChange: 10600 },
    ],
    metrics: {
      netCashFlow: 50600,
      operationalTotal: 45000,
      investingTotal: -5200,
      financingTotal: 10800,
      insights: [
        "Positive operational cash flow throughout all months",
        "Investing activities show consistent capital expenditure",
        "Financing activities indicate steady funding",
      ],
    },
  },
  balanceSheet: {
    tableData: [
      { account: "Cash", current: 45000, previous: 38000, change: 7000, changePercentage: 18.4 },
      { account: "Accounts Receivable", current: 32000, previous: 28000, change: 4000, changePercentage: 14.3 },
      { account: "Inventory", current: 28000, previous: 31000, change: -3000, changePercentage: -9.7 },
      { account: "Total Current Assets", current: 105000, previous: 97000, change: 8000, changePercentage: 8.2 },
      { account: "Property, Plant & Equipment", current: 80000, previous: 75000, change: 5000, changePercentage: 6.7 },
      { account: "Total Assets", current: 185000, previous: 172000, change: 13000, changePercentage: 7.6 },
      { account: "Accounts Payable", current: 22000, previous: 18000, change: 4000, changePercentage: 22.2 },
      { account: "Short-Term Debt", current: 15000, previous: 12000, change: 3000, changePercentage: 25.0 },
      { account: "Total Current Liabilities", current: 37000, previous: 30000, change: 7000, changePercentage: 23.3 },
      { account: "Long-Term Debt", current: 48000, previous: 48000, change: 0, changePercentage: 0 },
      { account: "Total Liabilities", current: 85000, previous: 78000, change: 7000, changePercentage: 9.0 },
      { account: "Retained Earnings", current: 100000, previous: 94000, change: 6000, changePercentage: 6.4 },
      { account: "Total Equity", current: 100000, previous: 94000, change: 6000, changePercentage: 6.4 },
    ],
    metrics: {
      totalAssets: 185000,
      totalLiabilities: 85000,
      netEquity: 100000,
      assetGrowth: 7.6,
      liabilityGrowth: 9.0,
      currentRatio: 2.84,
      debtToEquity: 0.85,
      insights: [
        "15% increase in cash reserves from improved collections",
        "Inventory reduction of 9.7% reflects better stock management",
        "Increased liabilities due to new equipment financing",
      ],
    },
  },
  arAging: {
    tableData: [
      { category: "Current", amount: 45000, percentage: 61.6 },
      { category: "1-30 days", amount: 12000, percentage: 16.4 },
      { category: "31-60 days", amount: 8000, percentage: 11.0 },
      { category: "61-90 days", amount: 5000, percentage: 6.8 },
      { category: "90+ days", amount: 3000, percentage: 4.1 },
    ],
    metrics: {
      totalReceivables: 73000,
      overdue: 28000,
      overduePercentage: 38.4,
      averageDaysOutstanding: 42,
      insights: [
        "90+ days overdue accounts represent 4.1% of total receivables",
        "Current accounts show healthy 61.6% of total",
        "Focus needed on 31-60 days bracket to prevent further aging",
      ],
    },
  },
  apAging: {
    tableData: [
      { category: "Current", amount: 35000, percentage: 61.4 },
      { category: "1-30 days", amount: 10000, percentage: 17.5 },
      { category: "31-60 days", amount: 6000, percentage: 10.5 },
      { category: "61-90 days", amount: 4000, percentage: 7.0 },
      { category: "90+ days", amount: 2000, percentage: 3.5 },
    ],
    metrics: {
      totalPayables: 57000,
      overdue: 22000,
      overduePercentage: 38.6,
      averageDaysPayable: 45,
      insights: [
        "Vendor payments mostly current (61.4%)",
        "90+ days overdue payables represent 3.5% of total",
        "Review needed for 1-30 days bracket to maintain good relationships",
      ],
    },
  },
  budgetVsActuals: {
    tableData: [
      { month: "Jan", Actual: 12000, Budget: 15000, Variance: -3000, VariancePercentage: -20.0 },
      { month: "Feb", Actual: 19000, Budget: 15000, Variance: 4000, VariancePercentage: 26.7 },
      { month: "Mar", Actual: 15000, Budget: 17000, Variance: -2000, VariancePercentage: -11.8 },
      { month: "Apr", Actual: 18000, Budget: 20000, Variance: -2000, VariancePercentage: -10.0 },
      { month: "May", Actual: 22000, Budget: 21000, Variance: 1000, VariancePercentage: 4.8 },
      { month: "Jun", Actual: 24000, Budget: 23000, Variance: 1000, VariancePercentage: 4.3 },
    ],
    metrics: {
      totalActual: 110000,
      totalBudget: 111000,
      variance: -1000,
      variancePercentage: -0.9,
      favorableVariance: 13000,
      unfavorableVariance: -14000,
      insights: [
        "February showed highest positive variance (+26.7%)",
        "April had largest negative variance (-10.0%)",
        "Overall performance within 1% of budget",
      ],
    },
  },
  financialRatios: {
    tableData: [
      { ratio: "Current Ratio", value: 2.5, benchmark: 1.5, status: "Good" },
      { ratio: "Quick Ratio", value: 1.8, benchmark: 1.0, status: "Good" },
      { ratio: "Debt-to-Equity", value: 0.8, benchmark: 1.0, status: "Good" },
      { ratio: "ROE", value: 18, benchmark: 15, status: "Good" },
      { ratio: "ROA", value: 8.5, benchmark: 7.0, status: "Good" },
      { ratio: "Gross Margin", value: 35, benchmark: 30, status: "Good" },
      { ratio: "Operating Margin", value: 22, benchmark: 20, status: "Good" },
      { ratio: "Net Margin", value: 12, benchmark: 10, status: "Good" },
      { ratio: "Inventory Turnover", value: 6.2, benchmark: 8.0, status: "Needs Improvement" },
    ],
    metrics: {
      aboveBenchmark: 8,
      belowBenchmark: 1,
      averageRatio: 2.5,
      insights: [
        "All ratios except one are above industry benchmarks",
        "Strong current ratio indicates good liquidity position",
        "ROE of 18% shows effective use of equity",
      ],
    },
  },
  departmental: {
    tableData: [
      { department: "Sales", revenue: 200000, cost: 150000, profit: 50000, margin: 25.0 },
      { department: "Marketing", revenue: 150000, cost: 100000, profit: 50000, margin: 33.3 },
      { department: "Operations", revenue: 180000, cost: 140000, profit: 40000, margin: 22.2 },
      { department: "R&D", revenue: 80000, cost: 54000, profit: 26000, margin: 32.5 },
      { department: "HR", revenue: 50000, cost: 40000, profit: 10000, margin: 20.0 },
      { department: "Finance", revenue: 60000, cost: 45000, profit: 15000, margin: 25.0 },
    ],
    metrics: {
      totalRevenue: 720000,
      totalCost: 539000,
      totalProfit: 181000,
      profitMargin: 25.1,
      mostProfitable: "Marketing",
      leastProfitable: "HR",
      insights: [
        "Sales department generates highest absolute profit",
        "Marketing shows best profit margin at 33.3%",
        "R&D investment showing good returns at 32.5% margin",
      ],
    },
  },
  customerProfitability: {
    tableData: [
      { customer: "Acme Corp", revenue: 120000, cost: 80000, profit: 40000, margin: 33.3, rank: 1 },
      { customer: "Globex Inc", revenue: 95000, cost: 65000, profit: 30000, margin: 31.6, rank: 2 },
      { customer: "Initech", revenue: 80000, cost: 60000, profit: 20000, margin: 25.0, rank: 3 },
      { customer: "Umbrella Corp", revenue: 70000, cost: 60000, profit: 10000, margin: 14.3, rank: 4 },
      { customer: "Stark Industries", revenue: 50000, cost: 45000, profit: 5000, margin: 10.0, rank: 5 },
    ],
    metrics: {
      totalRevenue: 415000,
      totalCost: 310000,
      totalProfit: 105000,
      profitMargin: 25.3,
      topCustomer: "Acme Corp",
      bottomCustomer: "Stark Industries",
      insights: [
        "Top 3 customers generate 85.7% of total profits",
        "Acme Corp has highest margin at 33.3%",
        "Stark Industries has lowest margin at 10.0%",
      ],
    },
  },
  projectCosting: {
    tableData: [
      { project: "Website Redesign", budget: 50000, actual: 45000, variance: 5000, completion: 100 },
      { project: "Mobile App", budget: 80000, actual: 85000, variance: -5000, completion: 90 },
      { project: "CRM Implementation", budget: 60000, actual: 55000, variance: 5000, completion: 100 },
      { project: "ERP Upgrade", budget: 120000, actual: 115000, variance: 5000, completion: 95 },
      { project: "Data Migration", budget: 40000, actual: 45000, variance: -5000, completion: 100 },
    ],
    metrics: {
      totalBudget: 350000,
      totalActual: 345000,
      totalVariance: 5000,
      onBudgetProjects: 3,
      overBudgetProjects: 2,
      insights: [
        "Overall projects came in under budget by $5,000",
        "Mobile App and Data Migration went over budget",
        "ERP Upgrade is 95% complete and on track",
      ],
    },
  },
  revenueReport: {
    tableData: [
      { product: "Product A", Q1: 25000, Q2: 28000, Q3: 30000, Q4: 32000, Total: 115000 },
      { product: "Product B", Q1: 20000, Q2: 22000, Q3: 24000, Q4: 26000, Total: 92000 },
      { product: "Product C", Q1: 15000, Q2: 18000, Q3: 20000, Q4: 22000, Total: 75000 },
      { product: "Product D", Q1: 10000, Q2: 12000, Q3: 15000, Q4: 18000, Total: 55000 },
    ],
    metrics: {
      totalRevenue: 337000,
      highestProduct: "Product A",
      lowestProduct: "Product D",
      growthRate: 12.5,
      insights: [
        "Product A accounts for 34.1% of total revenue",
        "Quarter-over-quarter growth across all products",
        "Product D shows highest growth potential at 20% QoQ",
      ],
    },
  },
  opexReport: {
    tableData: [
      { category: "Salaries", budget: 300000, actual: 310000, variance: -10000 },
      { category: "Rent", budget: 120000, actual: 120000, variance: 0 },
      { category: "Utilities", budget: 30000, actual: 28000, variance: 2000 },
      { category: "Marketing", budget: 50000, actual: 55000, variance: -5000 },
      { category: "Travel", budget: 20000, actual: 18000, variance: 2000 },
      { category: "Training", budget: 15000, actual: 10000, variance: 5000 },
      { category: "IT", budget: 40000, actual: 45000, variance: -5000 },
    ],
    metrics: {
      totalBudget: 575000,
      totalActual: 586000,
      totalVariance: -11000,
      favorableCategories: 3,
      unfavorableCategories: 4,
      insights: [
        "Overall operating expenses 1.9% over budget",
        "Salaries account for 52.9% of total expenses",
        "Training came in significantly under budget",
      ],
    },
  },
  fixedAssets: {
    tableData: [
      { asset: "Office Building", cost: 500000, accumulatedDepreciation: 150000, netBookValue: 350000 },
      { asset: "Company Vehicles", cost: 120000, accumulatedDepreciation: 80000, netBookValue: 40000 },
      { asset: "Computers", cost: 80000, accumulatedDepreciation: 60000, netBookValue: 20000 },
      { asset: "Office Equipment", cost: 50000, accumulatedDepreciation: 30000, netBookValue: 20000 },
      { asset: "Software Licenses", cost: 60000, accumulatedDepreciation: 40000, netBookValue: 20000 },
    ],
    metrics: {
      totalCost: 810000,
      totalDepreciation: 360000,
      netBookValue: 450000,
      averageAge: 3.5,
      insights: [
        "Office Building represents 61.7% of total asset value",
        "Company vehicles are 66.7% depreciated",
        "Average asset age is 3.5 years",
      ],
    },
  },
  capexReport: {
    tableData: [
      { project: "New Facility", budget: 200000, actual: 210000, variance: -10000, completion: 80 },
      { project: "Production Equipment", budget: 150000, actual: 145000, variance: 5000, completion: 100 },
      { project: "IT Infrastructure", budget: 80000, actual: 75000, variance: 5000, completion: 100 },
      { project: "Fleet Expansion", budget: 50000, actual: 60000, variance: -10000, completion: 90 },
    ],
    metrics: {
      totalBudget: 480000,
      totalActual: 490000,
      totalVariance: -10000,
      completedProjects: 2,
      inProgressProjects: 2,
      insights: [
        "Overall capital expenditures 2.1% over budget",
        "Production Equipment and IT Infrastructure completed under budget",
        "New Facility is 80% complete and on track",
      ],
    },
  },
  payrollReconciliation: {
    tableData: [
      { period: "Jan", payroll: 75000, benefits: 15000, taxes: 20000, total: 110000 },
      { period: "Feb", payroll: 75000, benefits: 15000, taxes: 20000, total: 110000 },
      { period: "Mar", payroll: 80000, benefits: 16000, taxes: 21000, total: 117000 },
      { period: "Apr", payroll: 80000, benefits: 16000, taxes: 21000, total: 117000 },
      { period: "May", payroll: 82000, benefits: 16400, taxes: 21500, total: 119900 },
      { period: "Jun", payroll: 82000, benefits: 16400, taxes: 21500, total: 119900 },
    ],
    metrics: {
      totalPayroll: 474000,
      totalBenefits: 94800,
      totalTaxes: 125000,
      grandTotal: 693800,
      averagePerMonth: 115633,
      insights: [
        "Payroll costs increased 9.3% year-to-date",
        "Benefits account for 13.7% of total compensation",
        "Taxes represent 18.0% of total payroll costs",
      ],
    },
  },
  marketingSpend: {
    tableData: [
      { channel: "Digital Ads", budget: 50000, spend: 55000, leads: 1200, costPerLead: 45.83 },
      { channel: "Trade Shows", budget: 30000, spend: 28000, leads: 400, costPerLead: 70.00 },
      { channel: "Content Marketing", budget: 20000, spend: 18000, leads: 600, costPerLead: 30.00 },
      { channel: "Email Campaigns", budget: 15000, spend: 12000, leads: 800, costPerLead: 15.00 },
      { channel: "Social Media", budget: 10000, spend: 9000, leads: 500, costPerLead: 18.00 },
    ],
    metrics: {
      totalBudget: 125000,
      totalSpend: 122000,
      totalLeads: 3500,
      averageCostPerLead: 34.86,
      mostEffectiveChannel: "Email Campaigns",
      leastEffectiveChannel: "Trade Shows",
      insights: [
        "Email campaigns have lowest cost per lead at $15.00",
        "Trade shows have highest cost per lead at $70.00",
        "Overall marketing efficiency is within industry benchmarks",
      ],
    },
  },
  salesFunnel: {
    tableData: [
      { stage: "Leads", count: 5000, conversionRate: 100 },
      { stage: "Qualified", count: 1500, conversionRate: 30 },
      { stage: "Proposal", count: 750, conversionRate: 50 },
      { stage: "Negotiation", count: 300, conversionRate: 40 },
      { stage: "Closed Won", count: 150, conversionRate: 50 },
    ],
    metrics: {
      totalLeads: 5000,
      totalWon: 150,
      overallConversion: 3.0,
      averageSalesCycle: 45,
      insights: [
        "Lead to qualified conversion rate is 30%",
        "Proposal to negotiation stage has 40% conversion",
        "Overall win rate is 3% of total leads",
      ],
    },
  },
};
 
// Reports configuration
const reports = [
  {
    id: "pnl",
    title: "Profit & Loss Statement",
    desc: "Summarizes revenues, costs, and expenses over a specific period",
    route: "/p&l-Dashboard",
  },
  {
    id: "cashFlow",
    title: "Cash Flow Statement",
    desc: "Tracks inflow and outflow of cash, highlighting operational activities",
    route: "/cash-flow-dashboard",
  },
  {
    id: "balanceSheet",
    title: "Balance Sheet",
    desc: "Provides a snapshot of assets, liabilities, and equity",
    route: "/balance-sheet-dashboard",
  },
  // {
  //   id: "arAging",
  //   title: "AR Aging Report",
  //   desc: "Details outstanding receivables by aging periods",
  //   route: "/ar-aging-dashboard",
  // },
  // {
  //   id: "apAging",
  //   title: "AP Aging Report",
  //   desc: "Lists outstanding payables by aging periods",
  //   route: "/ap-aging-dashboard",
  // },
  {
    id: "customerProfitability",
    title: "Customer Profitability Report",
    desc: "Analyzes profitability by customer",
    route: "/customer-profitability-dashboard",
  },
  {
    id: "projectCosting",
    title: "Project Costing Report",
    desc: "Monitors expenses and profitability of projects",
    route: "/project-costing-report-dashboard",
  },
  {
    id: "revenueReport",
    title: "Revenue Report",
    desc: "Analyzes revenue by product, geography, or segment",
    route: "/revenue-dashboard",
  },
  {
    id: "opexReport",
    title: "Operating Expenses Report",
    desc: "Details operating expenses by category",
    route: "/opex-dashboard",
  },
  {
    id: "fixedAssets",
    title: "Fixed Asset Register",
    desc: "Lists all fixed assets with depreciation schedules",
    route: "/fixed-assets-dashboard",
  },
  {
    id: "capexReport",
    title: "Capital Expenditure Report",
    desc: "Tracks capital expenditures vs budget",
    route: "/capex-dashboard",
  },
  {
    id: "payrollReconciliation",
    title: "Payroll Reconciliation",
    desc: "Compares payroll disbursements with records",
    route: "/payroll-dashboard",
  },
  {
    id: "marketingSpend",
    title: "Marketing Spend Efficiency",
    desc: "Analyzes ROI of marketing expenses by channel",
    route: "/marketing-dashboard",
  },
  {
    id: "salesFunnel",
    title: "Sales Funnel Metrics",
    desc: "Visualizes stages of the sales funnel",
    route: "/sales-funnel-dashboard",
  },
];

// Filter options
const timePeriods = [
  { id: "all", name: "All Periods" },
  { id: "current", name: "Current Month" },
  { id: "last", name: "Last Month" },
  { id: "qtd", name: "Quarter to Date" },
  { id: "ytd", name: "Year to Date" },
  { id: "custom", name: "Custom Range" },
];

const entities = [
  { id: "all", name: "All Entities" },
  { id: "ny", name: "New York Branch" },
  { id: "sf", name: "San Francisco Branch" },
  { id: "tx", name: "Texas Branch" },
];

const hierarchies = [
  { id: "group", name: "Group Level" },
  { id: "department", name: "Department Level" },
  { id: "product", name: "Product Level" },
];

const FinancialReports = () => {
    const { token } = useContext(AuthContext);
  
  const [selectedReport, setSelectedReport] = useState("pnl");
  const [aiInputs, setAiInputs] = useState({});
  const [aiHistory, setAiHistory] = useState({});
  const [showAIDropdown, setShowAIDropdown] = useState(null);
  const [drillDownData, setDrillDownData] = useState(null);
  const [filters, setFilters] = useState({
    period: "all",
    entity: "all",
    hierarchy: "group",
    customRange: { start: "", end: "" },
  });
  const [showFilters, setShowFilters] = useState(false);
  const [activeInsight, setActiveInsight] = useState(0);

  const data = sampleData[selectedReport];
  const currentReport = reports.find((r) => r.id === selectedReport);

  // Filter data based on selected filters
  const filteredData = React.useMemo(() => {
    if (!data || !data.tableData) return { tableData: [], metrics: {} };

    let result = [...data.tableData];

    // Apply period filter
    if (filters.period === "current") {
      result = result.slice(-1);
    } else if (filters.period === "last") {
      result = result.slice(-2, -1);
    } else if (filters.period === "qtd") {
      result = result.slice(-3);
    } else if (filters.period === "ytd") {
      result = result; // Show all data for year-to-date (adjust if needed)
    }
    // For 'all' period, we don't filter - show everything

    return {
      tableData: result,
      metrics: data.metrics,
    };
  }, [data, filters]);

  // Rotate insights every 5 seconds
  useEffect(() => {
    if (data?.metrics?.insights?.length > 1) {
      const interval = setInterval(() => {
        setActiveInsight((prev) => (prev + 1) % data.metrics.insights.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [data]);

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
      title: `${currentReport.title} - ${Object.values(rowData)[0]}`,
      data: Object.entries(rowData).map(([key, value]) => ({
        field: key,
        value: typeof value === "number" ? formatValue(key, value) : value,
      })),
      insights: [
        `Detailed analysis for ${Object.values(rowData)[0]}`,
        keyInsightsForRow(rowData),
      ],
    });
  };

  const formatValue = (key, value) => {
    if (key.toLowerCase() === "rank") {
      return `#${value}`;
    }
    if (key.toLowerCase() === "completion") {
      return `${value}%`;
    }
    if (key.toLowerCase() === "conversionrate") {
      return `${value}%`;
    }
    if (key.toLowerCase().includes("percentage") || key.toLowerCase().includes("margin")) {
      return `${value.toFixed(getDecimalPrecision())}%`;
    }
    if (typeof value === "number") {
      if (Math.abs(value) >= 1000) {
        return `$${(value / 1000).toFixed(getDecimalPrecision())}k`;
      }
      return `$${value.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`;
    }
    return value;
  };

  const keyInsightsForRow = (rowData) => {
    if (selectedReport === "pnl") {
      const variance = rowData.ActualProfit - rowData.BudgetProfit;
      if (variance > 0) {
        return `Performance exceeded budget by $${Math.abs(
          variance,
        ).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} (${Math.round(
          (variance / rowData.BudgetProfit) * 100,
        )}%)`;
      } else {
        return `Performance below budget by $${Math.abs(
          variance,
        ).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })} (${Math.round(
          (variance / rowData.BudgetProfit) * 100,
        )}%)`;
      }
    }
    if (selectedReport === "balanceSheet") {
      if (rowData.change > 0) {
        return `Increased by ${rowData.changePercentage}% from previous period`;
      } else if (rowData.change < 0) {
        return `Decreased by ${Math.abs(rowData.changePercentage)}% from previous period`;
      }
      return "No change from previous period";
    }
    if (selectedReport === "cashFlow") {
      if (rowData.NetChange > 0) {
        return `Positive net cash flow of $${rowData.NetChange.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`;
      }
      return `Negative net cash flow of $${Math.abs(rowData.NetChange).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`;
    }
    // Add insights for other report types
    return "Key metrics within expected ranges";
  };

  const renderQuickAnalysis = () => {
    if (!filteredData.metrics) return null;

    return (
      <div className="bg-sky-50/50 p-4 rounded-lg border border-sky-200">
        <h3 className="text-s font-semibold text-sky-900 mb-3">
          {currentReport.title} Summary
        </h3>
        <div className="text-x text-sky-700 space-y-3">
          {selectedReport === "pnl" && (
            <>
              <div className="flex items-start">
                <div
                  className={`p-2 rounded-full mr-3 ${
                    filteredData.metrics.overallVariance >= 0
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}>
                  {filteredData.metrics.overallVariance >= 0 ? (
                    <FiTrendingUp size={16} />
                  ) : (
                    <FiTrendingDown size={16} />
                  )}
                </div>
                <div>
                  <p className="font-medium">Total Period Performance</p>
                  <p className="text-black">
                    {filteredData.metrics.overallVariance >= 0
                      ? "Surplus"
                      : "Deficit"}{" "}
                    of $
                    {Math.abs(
                      filteredData.metrics.overallVariance,
                    ).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}{" "}
                    ({filteredData.metrics.overallVariancePercentage}%) compared to
                    budget
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="p-2 rounded-full mr-3 bg-green-100 text-green-700">
                  <FiTrendingUp size={16} />
                </div>
                <div>
                  <p className="font-medium">Best Performing Month</p>
                  <p className="text-black">
                    {filteredData.metrics.bestMonth} with $
                    {filteredData.tableData
                      .find((m) => m.month === filteredData.metrics.bestMonth)
                      ?.ActualProfit?.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }) || "N/A"}{" "}
                    profit
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="p-2 rounded-full mr-3 bg-red-100 text-red-700">
                  <FiTrendingDown size={16} />
                </div>
                <div>
                  <p className="font-medium">Worst Performing Month</p>
                  <p className="text-black">
                    {filteredData.metrics.worstMonth} with $
                    {filteredData.tableData
                      .find((m) => m.month === filteredData.metrics.worstMonth)
                      ?.ActualProfit?.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() }) || "N/A"}{" "}
                    profit
                  </p>
                </div>
              </div>
            </>
          )}
          {selectedReport === "balanceSheet" && (
            <>
              <div className="flex items-start">
                <div className="p-2 rounded-full mr-3 bg-green-100 text-green-700">
                  <FiTrendingUp size={16} />
                </div>
                <div>
                  <p className="font-medium">Assets Growth</p>
                  <p className="text-black">
                    Total assets increased by {filteredData.metrics.assetGrowth}%
                    compared to previous period
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="p-2 rounded-full mr-3 bg-blue-100 text-blue-700">
                  <FiAlertCircle size={16} />
                </div>
                <div>
                  <p className="font-medium">Financial Health</p>
                  <p className="text-black">
                    Current ratio of {filteredData.metrics.currentRatio} indicates
                    strong liquidity position
                  </p>
                </div>
              </div>
            </>
          )}
          {selectedReport === "cashFlow" && (
            <>
              <div className="flex items-start">
                <div className="p-2 rounded-full mr-3 bg-green-100 text-green-700">
                  <FiTrendingUp size={16} />
                </div>
                <div>
                  <p className="font-medium">Operational Cash Flow</p>
                  <p className="text-black">
                    Positive operational cash flow of $
                    {filteredData.metrics.operationalTotal.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="p-2 rounded-full mr-3 bg-blue-100 text-blue-700">
                  <FiDollarSign size={16} />
                </div>
                <div>
                  <p className="font-medium">Investing Activities</p>
                  <p className="text-black">
                    Net investing outflow of $
                    {Math.abs(filteredData.metrics.investingTotal).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
                  </p>
                </div>
              </div>
            </>
          )}
          {selectedReport === "arAging" && (
            <>
              <div className="flex items-start">
                <div className="p-2 rounded-full mr-3 bg-blue-100 text-blue-700">
                  <FiAlertCircle size={16} />
                </div>
                <div>
                  <p className="font-medium">Receivables Overview</p>
                  <p className="text-black">
                    {filteredData.metrics.overduePercentage}% of receivables are
                    overdue (${filteredData.metrics.overdue.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })})
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="p-2 rounded-full mr-3 bg-green-100 text-green-700">
                  <FiTrendingUp size={16} />
                </div>
                <div>
                  <p className="font-medium">Collection Efficiency</p>
                  <p className="text-black">
                    Average days outstanding: {filteredData.metrics.averageDaysOutstanding} days
                  </p>
                </div>
              </div>
            </>
          )}
          {/* Add analysis for other report types */}
        </div>
      </div>
    );
  };

  const renderTable = () => {
    if (!filteredData || !filteredData.tableData) return <p>No data available</p>;

    // Get column headers based on the first row of data
    const columns = Object.keys(filteredData.tableData[0] || {});

    return (
      <div className="overflow-y-auto bg-white/50 rounded-lg border border-sky-100 max-h-96">
        <table className="w-full text-x">
          <thead>
            <tr className="bg-sky-100 text-sky-900">
              {columns.map((col) => (
                <th key={col} className="px-2 py-1 text-left capitalize">
                  {col.replace(/([A-Z])/g, " $1")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.tableData.map((row, index) => (
              <tr
                key={index}
                className="border-b border-sky-200 hover:bg-sky-50 cursor-pointer"
                onClick={() => handleDrillDown(row)}>
                {columns.map((col) => (
                  <td
                    key={col}
                    className={`px-2 py-1 ${
                      typeof row[col] === "number"
                        ? row[col] < 0
                          ? "text-red-600"
                          : "text-green-600"
                        : ""
                    }`}>
                    {formatValue(col, row[col])}
                  </td>
                ))}
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
          <h3 className="text-lg font-semibold text-sky-900">{drillDownData.title}</h3>
          <button
            onClick={() => setDrillDownData(null)}
            className="text-s text-sky-600 hover:text-sky-800">
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
                      {item.field.replace(/([A-Z])/g, " $1")}
                    </td>
                    <td className={`py-2 text-right ${
                      typeof item.value === "string" && item.value.includes("-$")
                        ? "text-red-600"
                        : typeof item.value === "string" && item.value.includes("$")
                        ? "text-green-600"
                        : ""
                    }`}>
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
    if (!filteredData.metrics) return null;

    return (
      <div className="space-y-3">
        <h3 className="text-s font-semibold text-sky-900 mb-2">Key Metrics</h3>
        <ul className="text-s text-black space-y-2">
          {Object.entries(filteredData.metrics).map(([key, val]) => {
            if (key === "insights") return null;

            const isNegative =
              typeof val === "number" &&
              (key.toLowerCase().includes("variance") ||
                key.toLowerCase().includes("deficit") ||
                key.toLowerCase().includes("loss")) &&
              val < 0;
            const isPositive =
              typeof val === "number" &&
              (key.toLowerCase().includes("variance") ||
                key.toLowerCase().includes("surplus") ||
                key.toLowerCase().includes("profit")) &&
              val > 0;
            const isCurrency =
              typeof val === "number" &&
              !key.toLowerCase().includes("percentage") &&
              !key.toLowerCase().includes("ratio") &&
              !key.toLowerCase().includes("rate");

            return (
              <li key={key} className="flex justify-between items-center">
                <span className="capitalize">
                  {key
                    .replace(/([A-Z])/g, " $1")
                    .replace(/^./, (str) => str.toUpperCase())}
                  :
                </span>
                <span
                  className={`font-medium ${
                    isNegative
                      ? "text-red-600"
                      : isPositive
                      ? "text-green-600"
                      : "text-sky-800"
                  }`}>
                  {isCurrency
                    ? `$${Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}`
                    : typeof val === "number"
                    ? `${val.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}${
                        key.toLowerCase().includes("percentage") ||
                        key.toLowerCase().includes("margin") ||
                        key.toLowerCase().includes("rate")
                          ? "%"
                          : ""
                      }`
                    : val}
                  {isNegative && <FiTrendingDown className="inline ml-1" />}
                  {isPositive && <FiTrendingUp className="inline ml-1" />}
                </span>
              </li>
            );
          })}
        </ul>

        {filteredData.metrics.insights && (
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
                className="text-x bg-sky-100 p-3 rounded-lg border border-sky-200">
                {filteredData.metrics.insights[activeInsight]}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>
    );
  };

  const aiChatbotRef = useRef(null);
  const filtersRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (aiChatbotRef.current && !aiChatbotRef.current.contains(event.target)) {
        setShowAIDropdown(null);
      }
      if (filtersRef.current && !filtersRef.current.contains(event.target)) {
        setShowFilters(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-sky-50 p-6">
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Financial Reports</h1>
            <p className="text-sky-100 text-x">Discover actionable  financial insights</p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex gap-2 items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-sky-700 hover:text-sky-900 transition-colors duration-200">
            <FiDownload className="text-sky-50 hover:text-sky-900" />
            <span className="text-sky-50 hover:text-sky-900">Export</span>
          </button>
        </div>
      </div>

      <nav className="flex mb-6" aria-label="Breadcrumb">
        <ol className="inline-flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse">
          <li className="inline-flex items-center">
            <Link to="/" className="inline-flex items-center text-s font-medium text-sky-900 hover:text-blue-600">
              Home
            </Link>
          </li>
          <li aria-current="page">
            <div className="flex items-center">
              <svg className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 9 4-4-4-4"/>
              </svg>
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">Financial Reports</span>
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
                  setDrillDownData(null);
                }}
                className={`px-3 py-2 rounded-md text-s cursor-pointer transition ${
                  selectedReport === r.id
                    ? "bg-sky-100 text-sky-800 font-semibold"
                    : "text-sky-700 hover:bg-sky-50"
                }`}>
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
                  className="text-sky-500 hover:text-sky-700 mt-1">
                  <button
                    type="button"
                    className="flex items-center py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg border border-sky-200 hover:bg-white hover:text-sky-900 transition-colors duration-200">
                    View More
                    <GrLinkNext className="ml-1 w-4 h-4 hover:w-5 hover:h-5 transition-all" />
                  </button>
                </Link>
              )}
            </div>
          </div>

          {!drillDownData && (
            <div className="mb-4 flex flex-wrap gap-2 justify-end items-center">
              <div className="flex gap-2">
                <div className="relative" ref={filtersRef}>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center bg-sky-100 hover:bg-sky-200 text-sky-800 rounded-lg px-3 py-2 text-x">
                    <FiFilter className="mr-2" /> Filter
                  </button>

                  <AnimatePresence>
                    {showFilters && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute z-10 mt-2 w-64 bg-white rounded-lg shadow-lg border border-sky-200 p-4 right-0">
                        <div className="space-y-3">
                          <div>
                            <label className="block text-x font-medium text-sky-700 mb-1">
                              Time Period 
                            </label>
                            <select
                              value={filters.period}
                              onChange={(e) =>
                                setFilters({
                                  ...filters,
                                  period: e.target.value,
                                })
                              }
                              className="w-full p-2 border border-sky-300 rounded text-x">
                              {timePeriods.map((period) => (
                                <option key={period.id} value={period.id}>
                                  {period.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-x font-medium text-sky-700 mb-1">
                              Entity
                            </label>
                            <select
                              value={filters.entity}
                              onChange={(e) =>
                                setFilters({
                                  ...filters,
                                  entity: e.target.value,
                                })
                              }
                              className="w-full p-2 border border-sky-300 rounded text-x">
                              {entities.map((entity) => (
                                <option key={entity.id} value={entity.id}>
                                  {entity.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-x font-medium text-sky-700 mb-1">
                              Hierarchy
                            </label>
                            <select
                              value={filters.hierarchy}
                              onChange={(e) =>
                                setFilters({
                                  ...filters,
                                  hierarchy: e.target.value,
                                })
                              }
                              className="w-full p-2 border border-sky-300 rounded text-x">
                              {hierarchies.map((hierarchy) => (
                                <option key={hierarchy.id} value={hierarchy.id}>
                                  {hierarchy.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {filters.period === "custom" && (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-x font-medium text-sky-700 mb-1">
                                  Start Date
                                </label>
                                <input
                                  type="date"
                                  value={filters.customRange.start}
                                  onChange={(e) =>
                                    setFilters({
                                      ...filters,
                                      customRange: {
                                        ...filters.customRange,
                                        start: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full p-2 border border-sky-300 rounded text-x"
                                />
                              </div>
                              <div>
                                <label className="block text-x font-medium text-sky-700 mb-1">
                                  End Date
                                </label>
                                <input
                                  type="date"
                                  value={filters.customRange.end}
                                  onChange={(e) =>
                                    setFilters({
                                      ...filters,
                                      customRange: {
                                        ...filters.customRange,
                                        end: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full p-2 border border-sky-300 rounded text-x"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="flex gap-2">
                <CSVLink
                  data={filteredData.tableData || []}
                  filename={`${currentReport?.title.replace(/\s+/g, "-")}.csv`}
                  className="flex items-center px-3 py-2 bg-sky-100 text-sky-800 rounded-lg text-x hover:bg-sky-200">
                  <FiDownload className="mr-1" /> CSV
                </CSVLink>
                <button
                  onClick={() => window.print()}
                  className="flex items-center px-3 py-2 bg-sky-100 text-sky-800 rounded-lg text-x hover:bg-sky-200">
                  <FiPrinter className="mr-1" /> Print
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowAIDropdown(selectedReport)}
                    className="flex items-center px-3 py-2 text-sky-800 rounded-lg bg-sky-100 hover:bg-sky-200 text-x">
                    <BsStars className="mr-1" /> Ask AI
                  </button>

                  {showAIDropdown === selectedReport && currentReport && (
                    <motion.div
                      ref={aiChatbotRef}
                      className="absolute z-50 mt-2 right-0 w-80 bg-white/90 backdrop-blur-md rounded-lg shadow-lg border border-sky-200 p-2"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}>
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
                          disabled={!aiInputs[selectedReport]?.trim()}>
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

export default FinancialReports;
