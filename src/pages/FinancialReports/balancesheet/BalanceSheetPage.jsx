// src/components/Reports/BalanceSheet/BalanceSheetReport.jsx
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AuthContext } from "../../../context/AuthContext";
import { API_BASE_URL } from "../../../config/config";
import { cachedFetch } from "../../../utils/reportCache";

import ReportsLayout from "../ReportsLayout";
import TableSkeleton from "../../Skeleton/TableSkeleton";
import AddAutomation from "../AddAutomation";
import AIActionsMenu from "../AIActionsMenu";
import ActionHoverLabel from "../ActionHoverLabel";
import ReportCommentary from "../ReportCommentary";
import useReportCommentary from "../../../hooks/useReportCommentary";
import { buildReportAIContext, rankForAI, toNumberForAI } from "../reportAIContext";

import BalanceSheetDrilldownDrawer from "./BalanceSheetDrilldownDrawer";

import { FiFilter, FiPrinter } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import ExportMenu from "../ExportMenu";
import { collectCommentary, commentaryCount, csvWithCommentary, downloadCsv } from "../reportExport";
import { Link } from "react-router-dom";
import { FaArrowRightToBracket } from "react-icons/fa6";
import { getDecimalPrecision } from '../../../utils/formatters';

/* ================= CONSTANTS ================= */

const TIME_FILTERS = [
  { id: "all_periods", label: "All Periods" },
  { id: "current_month", label: "Current Month" },
  { id: "last_month", label: "Last Month" },
  { id: "quarter_to_date", label: "Quarter to Date" },
  { id: "year_to_date", label: "Year to Date" },
];

const CURRENCY_FILTERS = [
  { id: "actualvalue", label: "Actual" },
  { id: "thousands", label: "Thousands" },
  { id: "millions", label: "Millions" },
];

const COMPARISONS = [
  { id: "", label: "No Comparison" },
  { id: "month_on_month", label: "Month on Month" },
  { id: "year_on_year", label: "Year on Year" },
];

// main columns (no flat "period" field after refactor — period data lives in months dict)
const BASE_COLS = ["account_type", "account_name"];

/* ================= HELPERS ================= */

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const safeText = (v) => (v === null || v === undefined || v === "" ? "—" : String(v));

const money = (v, currency = "USD") => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string") {
    const cleaned = v.trim().replace(/[$,\s]/g, "");
    if (!cleaned || cleaned === "—" || cleaned === "-" || cleaned.toLowerCase() === "nan") return "—";
    if (/[a-zA-Z%]/.test(cleaned)) return v;
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed)) return v;
    v = parsed;
  }
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  const dp = getDecimalPrecision();
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(n);
};

const keyToNice = (k) => String(k).replace(/_/g, " ").toUpperCase();

/* ── Analytical narrative builder ──
   Deep, data-driven analysis per account (trend + volatility) and an
   executive summary built from the liquidity/leverage ratios the backend
   already computes but the UI never surfaced. Nothing here is a fixed
   template string - everything is derived from the real numbers. */
const _bsNum = (v) => {
  if (typeof v === "string") {
    const n = Number(v.replace(/[$,%\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return Number(v) || 0;
};

const _bsStats = (arr) => {
  const n = arr.length;
  const mean = n ? arr.reduce((a, b) => a + b, 0) / n : 0;
  const variance = n ? arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n : 0;
  const sd = Math.sqrt(variance);
  const cv = mean !== 0 ? (sd / Math.abs(mean)) * 100 : 0;
  return { mean, sd, cv };
};

const buildBalanceAccountInsight = (row, periods) => {
  const values = (periods || [])
    .map((p) => row?.months?.[p]?.current_value)
    .filter((v) => v !== undefined);

  if (!values.length) {
    const val = _bsNum(row?.total?.current_value);
    if (!val) return "—";
    return `${row.account_name} has no month-by-month breakdown for this selection${row.category ? ` (${row.category})` : ""} - only a single period-end balance, so no trend or timing pattern can be read from it.`;
  }

  const nums = values.map(_bsNum);
  if (nums.every((v) => v === 0)) return "—";

  // Frequent exact-zero periods mean this line is really period activity
  // (e.g. that month's asset purchases) rather than a running balance - a
  // real balance sheet line almost never legitimately sits at exactly $0.
  // Describing that as "declined 99%" would misread lumpy activity as
  // deterioration, so give it its own framing instead of a trend.
  const zeroCount = nums.filter((v) => v === 0).length;
  if (zeroCount / nums.length > 0.3) {
    const activeMonths = nums.length - zeroCount;
    const peakIdx = nums.indexOf(Math.max(...nums.map(Math.abs)));
    return `${row.account_name} shows activity in only ${activeMonths} of ${nums.length} months - most heavily in ${periods[peakIdx]} - rather than every period, which points to discrete transactions hitting this account rather than a steady running balance.`;
  }

  const first = nums[0];
  const last = nums[nums.length - 1];
  const changePct = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : null;
  const stats = _bsStats(nums);

  if (stats.cv >= 25) {
    return `${row.account_name} moved unevenly across the period (~${stats.cv.toFixed(0)}% variability) rather than trending steadily${changePct !== null ? `, ending ${changePct >= 0 ? "up" : "down"} ${Math.abs(changePct).toFixed(0)}% from where it started` : ""} - a pattern of swings rather than a single sustained cause.`;
  }
  const direction = last >= first ? "grew" : "declined";
  return `${row.account_name} ${direction} steadily${changePct !== null ? ` (~${Math.abs(changePct).toFixed(0)}%)` : ""} across the period with only ~${stats.cv.toFixed(0)}% month-to-month variability - a single consistent trend rather than a series of unrelated swings.`;
};

const BS_NOT_ENOUGH_DATA = ["Not enough data in this selection to build a liquidity and leverage read - widen the filters for a deeper analysis."];

const buildBalanceSheetExecutive = (metrics) => {
  if (!metrics) return BS_NOT_ENOUGH_DATA;

  const totalAssets = _bsNum(metrics["Total Assets"]);
  const totalLiab = _bsNum(metrics["Total Liabilities"]);
  const netEquity = _bsNum(metrics["Net Equity"]);
  const assetGrowth = _bsNum(metrics["Asset Growth"]);
  const liabGrowth = _bsNum(metrics["Liability Growth"]);
  const currentRatio = metrics["Current Ratio"] != null && metrics["Current Ratio"] !== "" ? _bsNum(metrics["Current Ratio"]) : null;
  const debtToEquity = metrics["Debt To Equity"] != null && metrics["Debt To Equity"] !== "" ? _bsNum(metrics["Debt To Equity"]) : null;

  if (!totalAssets && !totalLiab && !netEquity) return BS_NOT_ENOUGH_DATA;

  const liquidityText = currentRatio == null ? "" :
    currentRatio < 0 ? `Current ratio comes out negative (${currentRatio.toFixed(2)}), which isn't mathematically meaningful for a normal balance sheet - that usually signals a sign or classification issue in how current liabilities are recorded, worth validating against the underlying accounts before drawing conclusions about liquidity.` :
    currentRatio >= 1.5 ? `Liquidity is strong (current ratio of ${currentRatio.toFixed(2)}), meaning short-term assets comfortably cover short-term obligations.` :
    currentRatio >= 1 ? `Liquidity is adequate but not generous (current ratio of ${currentRatio.toFixed(2)}) - there's limited cushion if short-term obligations come due faster than expected.` :
    `Liquidity is a genuine concern (current ratio of ${currentRatio.toFixed(2)}, below 1) - short-term assets don't fully cover short-term obligations, which can force asset sales or new borrowing to meet near-term commitments.`;

  const leverageText = debtToEquity == null ? "" :
    debtToEquity > 2 ? `Leverage is elevated (debt-to-equity of ${debtToEquity.toFixed(2)}), meaning the business relies more heavily on liabilities than owner equity to fund its assets - that amplifies both returns and risk.` :
    debtToEquity < 0 ? `Debt-to-equity is negative (${debtToEquity.toFixed(2)}), which happens when liabilities exceed assets or equity itself is negative - worth a closer look at the underlying account balances.` :
    `Leverage looks manageable (debt-to-equity of ${debtToEquity.toFixed(2)}), with equity funding a healthy share of total assets.`;

  const growthRatio = assetGrowth !== 0 ? liabGrowth / assetGrowth : null;
  const growthText = assetGrowth !== 0 || liabGrowth !== 0
    ? (assetGrowth > 0 && liabGrowth > assetGrowth
        ? `Liabilities grew faster than assets over the period${growthRatio !== null && growthRatio > 0 ? ` - roughly ${growthRatio.toFixed(1)}x the pace` : ""}, meaning the expansion was funded more by taking on debt than by accumulating owned assets.`
        : assetGrowth > 0
        ? `Assets grew at a faster clip than liabilities this period, a sign the balance sheet is strengthening from genuine accumulation rather than just carrying more debt.`
        : `Assets contracted over the period${liabGrowth < 0 ? ", though liabilities pulled back too, which softens the hit to equity" : liabGrowth > 0 ? ", while liabilities kept growing - a combination that squeezes equity from both directions" : ""}.`)
    : "";

  const rawEquityToAssetsPct = totalAssets ? (netEquity / totalAssets) * 100 : null;
  const equityToAssetsPct = rawEquityToAssetsPct !== null && rawEquityToAssetsPct >= 0 && rawEquityToAssetsPct <= 100 ? rawEquityToAssetsPct : null;
  const openingText = equityToAssetsPct !== null
    ? `Equity funds about ${equityToAssetsPct.toFixed(0)}% of total assets, with the remainder financed by liabilities.`
    : totalLiab < 0
    ? `Total liabilities show as a negative figure in the underlying data, which points to a sign-convention or classification issue rather than a real capital-structure fact - worth reconciling before drawing conclusions from the assets/liabilities/equity split.`
    : `Net equity exceeds total assets, an unusual combination worth reconciling against the underlying account balances before drawing capital-structure conclusions.`;
  const para1 = `${openingText} ${liquidityText} ${leverageText}`.replace(/\s+/g, " ").trim();
  const trackingFocus = currentRatio != null && currentRatio < 0
    ? "the current-ratio figure gets reconciled to something economically meaningful"
    : currentRatio != null && currentRatio < 1
    ? "the liquidity gap closes"
    : "leverage stays in check";
  const para2 = `${growthText} The key thing to track from here is whether ${trackingFocus} as the business continues to grow - a balance sheet that strengthens on both fronts at once is the healthiest trajectory.`.replace(/\s+/g, " ").trim();

  return [para1, para2];
};

const normalizeAccountName = (value) => String(value ?? "").trim().toLowerCase();

const FIXED_ASSET_ACCOUNT_NAMES = new Set(["accumulated depreciation"]);
const DERIVED_BALANCE_SHEET_NAMES = new Set([
  "capital",
  "retained earnings",
  "distributions",
  "total equity",
  "liabilities + equity",
]);

const normalizeBalanceSheetRow = (row) => {
  if (!FIXED_ASSET_ACCOUNT_NAMES.has(normalizeAccountName(row.account_name))) {
    return row;
  }

  return {
    ...row,
    category: "Fixed Assets",
  };
};

const parseMoneyValue = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value)
    .replace(/[,$]/g, "")
    .replace(/\s*[KML]\s*$/i, "")
    .trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const parseOptionalMoneyValue = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value)
    .replace(/[,$]/g, "")
    .replace(/\s*[KML]\s*$/i, "")
    .trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const formatBalanceAmount = (value) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: getDecimalPrecision(),
    maximumFractionDigits: getDecimalPrecision(),
  }).format(roundMoney(value));

const rowMonthValue = (row, period, field) =>
  parseMoneyValue(row?.months?.[period]?.[field]);

const rowTotalValue = (row, field) =>
  parseMoneyValue(row?.total?.[field]);

const hasComparisonValues = (row) =>
  Boolean(row?.total && ("previous_value" in row.total || "change_value" in row.total));

const buildMoneyCell = (current, previous, includeComparison) => {
  const curr = roundMoney(current);
  if (!includeComparison) {
    return { current_value: formatBalanceAmount(curr) };
  }

  const prev = roundMoney(previous);
  const change = roundMoney(curr - prev);
  return {
    current_value: formatBalanceAmount(curr),
    previous_value: formatBalanceAmount(prev),
    change_value: formatBalanceAmount(change),
    change_pct: prev !== 0 ? roundMoney((change / prev) * 100) : 0,
  };
};

const buildDerivedBalanceSheetRows = (rows, periods) => {
  const periodKeys = Array.isArray(periods) ? periods : [];
  const findRow = (name) =>
    rows.find((row) => normalizeAccountName(row.account_name) === normalizeAccountName(name));

  const totalAssetsRow = findRow("Total Assets");
  const totalLiabilitiesRow = findRow("Total Liabilities");
  const existingTotalEquityRow = findRow("Total Equity");
  const existingCapitalRow = findRow("Capital");
  const existingDistributionsRow = findRow("Distributions");

  if (!totalLiabilitiesRow && !totalAssetsRow && !existingTotalEquityRow) {
    return rows;
  }

  const includeComparison =
    hasComparisonValues(totalAssetsRow) ||
    hasComparisonValues(totalLiabilitiesRow) ||
    hasComparisonValues(existingTotalEquityRow);

  const getTotalEquity = (field) => {
    if (existingTotalEquityRow) return rowTotalValue(existingTotalEquityRow, field);
    return rowTotalValue(totalAssetsRow, field) - rowTotalValue(totalLiabilitiesRow, field);
  };

  const getMonthTotalEquity = (period, field) => {
    if (existingTotalEquityRow?.months?.[period]) return rowMonthValue(existingTotalEquityRow, period, field);
    return rowMonthValue(totalAssetsRow, period, field) - rowMonthValue(totalLiabilitiesRow, period, field);
  };

  const makeDetailRow = (accountName, getCurrent, getPrevious) => {
    const months = {};
    periodKeys.forEach((period) => {
      months[period] = buildMoneyCell(getCurrent(period), getPrevious(period), includeComparison);
    });

    const currentTotal = periodKeys.length
      ? periodKeys.reduce((sum, period) => sum + getCurrent(period), 0)
      : getCurrent(null);
    const previousTotal = periodKeys.length
      ? periodKeys.reduce((sum, period) => sum + getPrevious(period), 0)
      : getPrevious(null);

    return {
      section: "Equity",
      category: "Equity",
      account_type: "Equity",
      account_name: accountName,
      months,
      total: buildMoneyCell(currentTotal, previousTotal, includeComparison),
      current_value: formatBalanceAmount(currentTotal),
      previous_value: includeComparison ? formatBalanceAmount(previousTotal) : null,
      change_value: includeComparison ? formatBalanceAmount(currentTotal - previousTotal) : null,
      change_pct: includeComparison && previousTotal !== 0
        ? roundMoney(((currentTotal - previousTotal) / previousTotal) * 100)
        : 0,
    };
  };

  const capitalRow = makeDetailRow(
    "Capital",
    (period) => period ? rowMonthValue(existingCapitalRow, period, "current_value") : rowTotalValue(existingCapitalRow, "current_value"),
    (period) => period ? rowMonthValue(existingCapitalRow, period, "previous_value") : rowTotalValue(existingCapitalRow, "previous_value")
  );

  const distributionsRow = makeDetailRow(
    "Distributions",
    (period) => period ? rowMonthValue(existingDistributionsRow, period, "current_value") : rowTotalValue(existingDistributionsRow, "current_value"),
    (period) => period ? rowMonthValue(existingDistributionsRow, period, "previous_value") : rowTotalValue(existingDistributionsRow, "previous_value")
  );

  const retainedRow = makeDetailRow(
    "Retained Earnings",
    (period) => period
      ? getMonthTotalEquity(period, "current_value") + rowMonthValue(distributionsRow, period, "current_value") - rowMonthValue(capitalRow, period, "current_value")
      : getTotalEquity("current_value") + rowTotalValue(distributionsRow, "current_value") - rowTotalValue(capitalRow, "current_value"),
    (period) => period
      ? getMonthTotalEquity(period, "previous_value") + rowMonthValue(distributionsRow, period, "previous_value") - rowMonthValue(capitalRow, period, "previous_value")
      : getTotalEquity("previous_value") + rowTotalValue(distributionsRow, "previous_value") - rowTotalValue(capitalRow, "previous_value")
  );

  const totalEquityRow = makeDetailRow(
    "Total Equity",
    (period) => rowMonthValue(capitalRow, period, "current_value") + rowMonthValue(retainedRow, period, "current_value") - rowMonthValue(distributionsRow, period, "current_value"),
    (period) => rowMonthValue(capitalRow, period, "previous_value") + rowMonthValue(retainedRow, period, "previous_value") - rowMonthValue(distributionsRow, period, "previous_value")
  );

  const liabilitiesPlusEquityRow = makeDetailRow(
    "Liabilities + Equity",
    (period) => rowMonthValue(totalLiabilitiesRow, period, "current_value") + rowMonthValue(totalEquityRow, period, "current_value"),
    (period) => rowMonthValue(totalLiabilitiesRow, period, "previous_value") + rowMonthValue(totalEquityRow, period, "previous_value")
  );
  liabilitiesPlusEquityRow.section = "Summary";
  liabilitiesPlusEquityRow.category = "Summary";
  liabilitiesPlusEquityRow.account_type = "Summary";

  const baseRows = rows.filter((row) => !DERIVED_BALANCE_SHEET_NAMES.has(normalizeAccountName(row.account_name)));
  return [
    ...baseRows,
    capitalRow,
    retainedRow,
    distributionsRow,
    totalEquityRow,
    liabilitiesPlusEquityRow,
  ];
};

const getPrevPeriod = (period, compType) => {
  if (!period || !compType) return "";
  const [y, m] = period.split("-").map(Number);
  if (compType === "month_on_month") {
    const pm = m === 1 ? 12 : m - 1;
    const py = m === 1 ? y - 1 : y;
    return `${py}-${String(pm).padStart(2, "0")}`;
  }
  if (compType === "year_on_year") {
    return `${y - 1}-${String(m).padStart(2, "0")}`;
  }
  return "";
};

const pctInline = (val) => {
  if (val === null || val === undefined) return null;
  const n = parseOptionalMoneyValue(val);
  if (n === null) return null;
  const cls = n > 0 ? "text-green-700" : n < 0 ? "text-red-700" : "text-slate-700";
  const sign = n > 0 ? "+" : "";
  return { text: `${sign}${n.toFixed(getDecimalPrecision())}%`, cls };
};

const diffStyle = (diffVal) => {
  const n = parseMoneyValue(diffVal);
  if (!Number.isFinite(n) || n === 0) {
    return { cellBg: "bg-slate-50", pill: "bg-slate-200 text-slate-800", arrow: "•" };
  }
  if (n > 0) {
    return { cellBg: "bg-green-50", pill: "bg-green-600 text-white", arrow: "▲" };
  }
  return { cellBg: "bg-red-50", pill: "bg-red-600 text-white", arrow: "▼" };
};

// Period can be "2024-01" or "2024-01-01T00:00:00"
const toYYYYMM = (p) => {
  if (!p) return "";
  const s = String(p);
  // already YYYY-MM
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  // ISO date -> YYYY-MM
  const m = s.match(/^(\d{4}-\d{2})/);
  return m ? m[1] : s;
};

/* ── Report AI context helpers ── */
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2025-01" -> "Jan 2025"
const bsMonthLabel = (p) => {
  const [y, m] = String(p).split("-").map(Number);
  return y && m >= 1 && m <= 12 ? `${MONTH_ABBR[m - 1]} ${y}` : String(p);
};

// Subtotal, total and page-derived equity lines, in balance-sheet order —
// sent to the AI ahead of the individual accounts.
const BS_SUMMARY_LINES = [
  "Total Current Assets",
  "Total Fixed Assets",
  "Total Assets",
  "Total Liabilities",
  "Capital",
  "Retained Earnings",
  "Distributions",
  "Total Equity",
  "Liabilities + Equity",
];




const Select = ({ label, value, options, labels = {}, onChange }) => (
  <div>
    <label className="block text-x text-sky-700 mb-1">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-sky-200 rounded p-2 text-x bg-white"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {labels[o] || o}
        </option>
      ))}
    </select>
  </div>
);

const MetricRow = ({ label, value }) => (
  <div className="flex justify-between items-center text-s">
    <span className="text-sky-700">{label}</span>
    <span className="font-medium text-sky-900">{value}</span>
  </div>
);

const AIDriverText = ({ messages }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!messages?.length) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % messages.length), 3000);
    return () => clearInterval(t);
  }, [messages]);

  return (
    <motion.div
      key={index}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="text-s font-medium bg-gradient-to-r from-sky-500 to-purple-500 bg-clip-text text-transparent"
    >
      {messages[index]}
    </motion.div>
  );
};

/* ================= COMPONENT ================= */

export default function BalanceSheetReport() {
  const [rows, setRows] = useState([]);
  const { token, selectedYear: year } = useContext(AuthContext);
  const currency = "USD";

  const DEFAULT_FILTERS = useMemo(
    () => ({
      time_filter: "all_periods",
      currency_filter: "actualvalue",
      entity: "All",
      comparision: "",
    }),
    []
  );

  // drawer state
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillAccount, setDrillAccount] = useState("");
  const [drillPeriod, setDrillPeriod] = useState(""); // YYYY-MM (optional)

  // data
  const [entities, setEntities] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [apiPeriods, setApiPeriods] = useState([]);
  const [grandTotal, setGrandTotal] = useState(null);
  const [showPeriodCols, setShowPeriodCols] = useState(true);
  const [showEntity, setShowEntity] = useState(false);

  // filters: applied vs draft
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);

  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const [sortConfig, setSortConfig] = useState({ sort_by: "default", sort_order: "asc" });
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef(null);

  const isComparisonOn = Boolean(filters.comparision);

  const isDirty = useMemo(
    () => JSON.stringify(draftFilters) !== JSON.stringify(filters),
    [draftFilters, filters]
  );


  const entityNameMap = useMemo(
    () => Object.fromEntries(entities.map((e) => [String(e.entity_id), e.entity_name])),
    [entities]
  );

  /* ================= SORTED ROWS (frontend-only) ================= */
  const SECTION_ORDER = { Asset: 0, Liability: 1, Equity: 2, Summary: 3 };

  const sortedRows = useMemo(() => {
    if (!rows.length) return rows;
    const { sort_by, sort_order } = sortConfig;
    const asc = sort_order === "asc";
    const isDefaultSort = sort_by === "default";
    const CATEGORY_ORDER = {
      "Current Assets": 0,
      "Total Current Assets": 0.5,
      "Fixed Assets": 1,
      "Total Fixed Assets": 1.5,
      "Total Assets": 2,
      "Liabilities": 0,
      "Total Liabilities": 1,
      "Equity": 0,
      "Summary": 0,
    };

    return [...rows].sort((a, b) => {
      // Keep section order: Assets → Liabilities → Equity
      const sa = SECTION_ORDER[a.section ?? a.account_type] ?? 99;
      const sb = SECTION_ORDER[b.section ?? b.account_type] ?? 99;
      if (sa !== sb) return sa - sb;

      const ca = CATEGORY_ORDER[a.category ?? ""] ?? 50;
      const cb = CATEGORY_ORDER[b.category ?? ""] ?? 50;
      if (ca !== cb) return ca - cb;

      if (isDefaultSort) return 0;

      // Keep Total rows pinned at end of their section
      const aIsTotal = String(a.account_name || "").startsWith("Total");
      const bIsTotal = String(b.account_name || "").startsWith("Total");
      if (aIsTotal && !bIsTotal) return 1;
      if (!aIsTotal && bIsTotal) return -1;
      if (aIsTotal && bIsTotal) return 0;

      // Sort regular account rows
      if (sort_by === "account_name") {
        const cmp = String(a.account_name || "").localeCompare(String(b.account_name || ""));
        return asc ? cmp : -cmp;
      }
      const stripNum = (v) => {
        const cleaned = typeof v === "string" ? v.replace(/,/g, "") : v;
        const n = Number(cleaned);
        return Number.isFinite(n) ? n : 0;
      };
      const diff = stripNum(a[sort_by]) - stripNum(b[sort_by]);
      return asc ? diff : -diff;
    });
  }, [rows, sortConfig]);

  const comparisonPivot = useMemo(() => {
    if (!isComparisonOn || !sortedRows.length || !apiPeriods.length)
      return { periods: [], pivot: [] };
    return {
      periods: apiPeriods,
      pivot: sortedRows.map((r) => ({
        account_name: r.account_name,
        account_type: r.account_type,
        entity_id:    r.entity_id ?? null,
        months: r.months || {},
        total:  r.total  || {},
      })),
    };
  }, [sortedRows, isComparisonOn, apiPeriods]);

  const periodPivot = useMemo(() => {
    if (!showPeriodCols || !sortedRows.length || !apiPeriods.length)
      return { periods: [], pivot: [] };
    return {
      periods: apiPeriods,
      pivot: sortedRows.map((r) => ({
        account_name: r.account_name,
        account_type: r.account_type,
        entity_id:    r.entity_id ?? null,
        months: r.months || {},
        total:  r.total  || {},
      })),
    };
  }, [sortedRows, showPeriodCols, apiPeriods]);

  const periodGrandTotals = useMemo(() => {
    if (!showPeriodCols) return {};
    return grandTotal?.months || {};
  }, [grandTotal, showPeriodCols]);


  const hierarchyRows = useMemo(() => {
    const result = [];
    let lastSection = null;
    let lastCategory = null;

    for (const row of sortedRows) {
      const section     = row.section ?? row.account_type ?? "";
      const category    = row.category ?? "";
      const accountName = row.account_name ?? "";

      const isGrandTotal =
        accountName === "Total Assets" ||
        accountName === "Total Equity" ||
        accountName === "Liabilities + Equity";
      const isSubtotal   = !isGrandTotal && accountName.startsWith("Total ");

      if (section !== lastSection) {
        const label =
          section === "Asset"     ? "ASSETS"      :
          section === "Liability" ? "LIABILITIES" :
          section === "Equity"    ? "EQUITY"      :
          section === "Summary"   ? "SUMMARY"     : section.toUpperCase();
        result.push({ rowType: "section-header", label, section });
        lastSection  = section;
        lastCategory = null;
      }

      if (!isSubtotal && !isGrandTotal &&
          (category === "Current Assets" || category === "Fixed Assets") &&
          category !== lastCategory) {
        result.push({ rowType: "sub-header", label: category, section, category });
        lastCategory = category;
      }

      result.push({
        ...row,
        rowType: isGrandTotal ? "section-total" : isSubtotal ? "subtotal" : "account",
      });
    }
    return result;
  }, [sortedRows]);

  /* close dropdowns */
  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
      if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  /* ================= FETCH ================= */
const fetchBalance = useCallback(
  async (applied) => {

    if (!token || !year) return;

    setLoading(true);

    try {

      const params = new URLSearchParams();

      params.set("show_period", "true");
      if (showEntity) params.set("show_entity", "true");

      if (applied?.currency_filter) {
        params.set("currency_filter", applied.currency_filter);
      }

      if (applied?.time_filter && applied.time_filter !== "all_periods") {
        params.set("time_filter", applied.time_filter);
      }

      if (applied?.entity && applied.entity !== "All") {
        params.set("entity", applied.entity);
      }

      if (applied?.comparision) {
        params.set("comparision", applied.comparision);
      }

      const url = `${API_BASE_URL}/api/v1/company/financial/balance_sheet_statement/${year}/${currency}?${params.toString()}`;

      const api = await cachedFetch(url,{
        headers:{
          Authorization:`Bearer ${token}`,
          accept:"application/json"
        }
      });

      if(!api || api?.error){
        throw new Error(api?.message || "Failed to fetch balance sheet");
      }

      const records = Array.isArray(api?.records) ? api.records : [];

      const normalizedRows = records.map((r) => normalizeBalanceSheetRow({
        ...r,
        account_type:   r.section   ?? null,
        current_value:  r.total?.current_value  ?? null,
        previous_value: r.total?.previous_value ?? null,
        change_value:   r.total?.change_value   ?? null,
        change_pct:     r.total?.change_pct     ?? null,
      }));
      const flatRows = buildDerivedBalanceSheetRows(
        normalizedRows,
        Array.isArray(api?.periods) ? api.periods : []
      );

      setRows(flatRows);
      setMetrics(api?.keymetrics || null);
      setEntities(Array.isArray(api?.entities) ? api.entities : []);
      setApiPeriods(Array.isArray(api?.periods) ? api.periods : []);
      setGrandTotal(api?.grand_total || null);

    } catch(e){

      console.error(e);
      setRows([]);
      setMetrics(null);
      setEntities([]);
      setApiPeriods([]);
      setGrandTotal(null);

    } finally {

      setLoading(false);

    }

  },
  [token, year, showEntity]
);

  useEffect(() => {
    if (!token || !year) return;
    fetchBalance(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, year, fetchBalance]);

  /* ================= ACTIVE TAGS ================= */
  const activeTags = useMemo(() => {
    const tags = [];

    if (filters.comparision) {
      tags.push(`Comparison: ${COMPARISONS.find((c) => c.id === filters.comparision)?.label || filters.comparision}`);
    }
    if (filters.time_filter !== "all_periods") {
      tags.push(`Period: ${TIME_FILTERS.find((t) => t.id === filters.time_filter)?.label || filters.time_filter}`);
    }
    if (filters.currency_filter !== "actualvalue") {
      tags.push(`Unit: ${CURRENCY_FILTERS.find((c) => c.id === filters.currency_filter)?.label || filters.currency_filter}`);
    }
if (filters.entity !== "All") {
  const ent = entities.find(e => String(e.entity_id) === String(filters.entity));
  tags.push(`Entity: ${ent?.entity_name || filters.entity}`);
}
    return tags;
  }, [filters, entities]);

  const removeFilter = (tag) => {
    const updater = (prev) => {
      const next = { ...prev };
      if (tag.startsWith("Comparison:")) next.comparision = "";
      else if (tag.startsWith("Period:")) next.time_filter = "all_periods";
      else if (tag.startsWith("Unit:")) next.currency_filter = "actualvalue";
      else if (tag.startsWith("Entity:")) next.entity = "All";
      return next;
    };

    const nextApplied = updater(filters);
    setFilters(nextApplied);
    setDraftFilters(nextApplied);
    fetchBalance(nextApplied);
  };

  const onCancelDraft = () => {
    setDraftFilters(filters);
    setOpen(false);
  };

  const onResetAll = () => {
    setFilters(DEFAULT_FILTERS);
    setDraftFilters(DEFAULT_FILTERS);
    setOpen(false);
    fetchBalance(DEFAULT_FILTERS);
  };

  const onApply = () => {

  const nextFilters = {
    ...draftFilters
  };

  setFilters(nextFilters);
  setOpen(false);

  fetchBalance(nextFilters);

};

  /* ================= CSV ================= */
  const csvData = useMemo(() => {
    if (!sortedRows.length) return [];

    const base = [...BASE_COLS, "current_value", "previous_value", "change_value", "change_pct"];

    // add MoM/YoY extra fields if present
    const hasComp = sortedRows.some((r) => r?.comparision && Object.keys(r.comparision).length);
    const extra = hasComp
      ? ["prev_period", "comparision.prev_period", "comparision.prev_current_value", "comparision.prev_previous_value", "comparision.current_value_diff", "comparision.previous_value_diff"]
      : [];

    const header = [...base, ...extra];

    const getDeep = (obj, path) => {
      const parts = path.split(".");
      let cur = obj;
      for (const p of parts) {
        if (!cur) return "";
        cur = cur[p];
      }
      return cur ?? "";
    };

    const body = sortedRows.map((r) => header.map((h) => (h.includes(".") ? getDeep(r, h) : r?.[h] ?? "")));
    return [header, ...body];
  }, [sortedRows]);

  // Same param names fetchBalance sends, so a scheduled send reproduces
  // this exact filtered view.
  const scheduleFilters = useMemo(() => ({
    show_period: "true",
    ...(showEntity && { show_entity: "true" }),
    ...(filters?.currency_filter && { currency_filter: filters.currency_filter }),
    ...(filters?.time_filter && filters.time_filter !== "all_periods" && { time_filter: filters.time_filter }),
    ...(filters?.entity && filters.entity !== "All" && { entity: filters.entity }),
    ...(filters?.comparision && { comparision: filters.comparision }),
  }), [filters, showEntity]);

  /* ================= EXECUTIVE INSIGHT ================= */
  const bsExecutive = useMemo(() => buildBalanceSheetExecutive(metrics), [metrics]);

  /* ================= AI INSIGHTS / COMMENTARY ================= */
  // `filters` is what the data on screen was fetched with; showEntity only
  // splits the same balances per entity, so it isn't part of the saved view.
  const commentary = useReportCommentary({
    token,
    reportId: "balance_sheet",
    year,
    currency,
    filters,
  });

  // showEntity refetches and repeats the account rows per entity.
  const viewKey = `${year}|${currency}|${JSON.stringify(filters)}|${showEntity}`;

  const buildInsightsContext = () => {
    if (!rows.length) return "";
    const periods = [...apiPeriods].sort();
    const endPeriod = periods[periods.length - 1];

    // The table's per-row "total" adds month-end balances together, which is
    // meaningless for a balance sheet, so give the period-end balance and the
    // change over the period instead. Fixed-asset lines hold each month's
    // purchases (flows), so those get their sum.
    const lines = hierarchyRows
      .filter((r) => r.rowType !== "section-header" && r.rowType !== "sub-header")
      .map((r) => {
        const name = r.account_name || "";
        const cells = periods
          .map((p) => ({ p, m: r.months?.[p], v: toNumberForAI(r.months?.[p]?.current_value) }))
          .filter((c) => c.v !== null);
        if (!cells.length) return null;

        const isSummary = BS_SUMMARY_LINES.includes(name);
        const isPurchases =
          name === "Total Fixed Assets" ||
          (r.category === "Fixed Assets" && !FIXED_ASSET_ACCOUNT_NAMES.has(normalizeAccountName(name)));
        const first = cells[0];
        const last = cells[cells.length - 1];
        const line = {
          account:
            showEntity && r.entity_id != null
              ? `${name} (${entityNameMap[String(r.entity_id)] || r.entity_id})`
              : name,
          ...(!isSummary && { section: r.section ?? r.account_type, category: r.category }),
        };
        if (isPurchases) {
          line.purchases_in_period = cells.reduce((sum, c) => sum + c.v, 0);
        } else {
          line.end_balance = last.v;
          if (last.p !== endPeriod) line.end_period = bsMonthLabel(last.p);
          if (cells.length > 1) line.change_over_period = last.v - first.v;
        }
        line.months = Object.fromEntries(
          cells.map(({ p, m, v }) => [
            bsMonthLabel(p),
            isComparisonOn
              ? { current: v, previous: toNumberForAI(m.previous_value), change: toNumberForAI(m.change_value) }
              : v,
          ])
        );
        return { name, isSummary, line };
      })
      .filter(Boolean);
    if (!lines.length) return "";

    const summary = lines
      .filter((l) => l.isSummary)
      .sort((a, b) => BS_SUMMARY_LINES.indexOf(a.name) - BS_SUMMARY_LINES.indexOf(b.name))
      .map((l) => l.line);
    // Largest accounts first — rows are trimmed from the end if the context is too long.
    const size = (a) => Math.abs(a.end_balance ?? a.purchases_in_period ?? 0);
    const accounts = lines
      .filter((l) => !l.isSummary)
      .map((l) => l.line)
      .sort((a, b) => size(b) - size(a));

    const summaryLine = (name) => summary.find((l) => l.account === name) || {};
    const totalAssets = summaryLine("Total Assets");
    const totalLiabilities = summaryLine("Total Liabilities");
    const totalEquity = summaryLine("Total Equity");
    const liabilitiesNegative = (totalLiabilities.end_balance ?? 0) < 0;

    // Accounts with a balance in the final month (end_period is only set when it's earlier).
    const balances = accounts.filter((a) => a.end_balance !== undefined && !a.end_period);
    const changed = balances.filter((a) => a.change_over_period !== undefined);
    const byName = (a) => a.account;
    const liabilities = balances.filter((a) => a.section === "Liability");

    return buildReportAIContext({
      valueScale: CURRENCY_FILTERS.find((c) => c.id === filters.currency_filter)?.label || "Actual",
      notes: [
        "Balances are point-in-time (month-end) values, not flows — never add them across months; the exception is the Fixed Assets purchase lines and Total Fixed Assets (given as purchases_in_period), which hold each month's asset purchases rather than a running balance.",
        `An increase in assets is generally favorable; an increase in liabilities means more obligations${
          liabilitiesNegative ? " (liabilities are stored as negative credit balances here, so a more negative value means larger obligations)" : ""
        }.`,
        "Equity rows (Capital, Retained Earnings, Distributions, Total Equity, Liabilities + Equity) are derived on the page.",
        isComparisonOn &&
          `In each month, 'previous' is the balance ${
            filters.comparision === "year_on_year" ? "in the same month one year earlier" : "one month earlier"
          }.`,
      ]
        .filter(Boolean)
        .join(" "),
      // The Key Metrics panel's totals add every month's balance together, so
      // the AI gets the period-end totals from the Total rows instead.
      keyMetrics: {
        "Balances as of": endPeriod ? bsMonthLabel(endPeriod) : undefined,
        "Total Assets": totalAssets.end_balance,
        "Total Liabilities": totalLiabilities.end_balance,
        "Net Equity": totalEquity.end_balance,
        "Change in Total Assets over the period": totalAssets.change_over_period,
        "Change in Total Liabilities over the period": totalLiabilities.change_over_period,
        "Change in Net Equity over the period": totalEquity.change_over_period,
        "Current Ratio (selected months combined)": toNumberForAI(metrics?.["Current Ratio"]),
        "Debt To Equity (selected months combined)": toNumberForAI(metrics?.["Debt To Equity"]),
      },
      facts: {
        period_covered:
          periods.length > 1 ? `${bsMonthLabel(periods[0])} to ${bsMonthLabel(endPeriod)}` : endPeriod && bsMonthLabel(endPeriod),
        largest_assets_at_period_end: rankForAI(
          balances.filter((a) => a.section === "Asset" && a.end_balance > 0),
          (a) => a.end_balance,
          byName
        )?.highest,
        largest_liabilities_at_period_end: liabilitiesNegative
          ? rankForAI(liabilities.filter((a) => a.end_balance < 0), (a) => a.end_balance, byName)?.lowest
          : rankForAI(liabilities.filter((a) => a.end_balance > 0), (a) => a.end_balance, byName)?.highest,
        biggest_increases_over_period: rankForAI(changed.filter((a) => a.change_over_period > 0), (a) => a.change_over_period, byName)?.highest,
        biggest_decreases_over_period: rankForAI(changed.filter((a) => a.change_over_period < 0), (a) => a.change_over_period, byName)?.lowest,
        largest_fixed_asset_purchases: rankForAI(
          accounts.filter((a) => a.purchases_in_period !== undefined),
          (a) => a.purchases_in_period,
          byName
        )?.highest,
      },
      rows: [...summary, ...accounts],
    });
  };

  // The commentary shown under the report, offered with the CSV download.
  const exportCommentary = collectCommentary({ reportItems: commentary.items });

  /* ================= UI ================= */
  return (
    <ReportsLayout>
      <main className="flex-1 min-w-0 bg-white p-3 rounded-xl shadow-md">
        {/* HEADER */}
        <div className="flex justify-between items-center gap-3 mb-2">
          <div>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h2 className="text-lg font-semibold text-sky-900">Balance Sheet Report</h2>
              <p className="text-s text-sky-600">Assets, liabilities & equity analysis</p>
            </div>
            <p className="text-s bg-yellow-100 text-sky-900 px-2 py-0.5 rounded-md mt-1 inline-block">
              <strong>Note :</strong> Click on any <strong>ACCOUNT NAME</strong> to view detailed drilldown insights
            </p>
          </div>

          <Link
            to="/balance-sheet-dashboard"
            className="flex shrink-0 items-center whitespace-nowrap py-2 px-3 text-x font-medium text-white bg-sky-900 rounded-lg hover:bg-white hover:text-sky-900 transition border border-sky-900"
          >
            View More <FaArrowRightToBracket className="ml-1" />
          </Link>
        </div>

        {/* FILTER BAR */}
        <div className="mb-3 flex items-center justify-between gap-3 flex-wrap" ref={ref}>

          {/* LEFT: toggles + active tags */}
          <div className="flex items-center gap-2 flex-wrap">

            {/* Show Entity Column */}
            <label className="flex items-center gap-2 px-3 py-2 text-x bg-white border border-sky-300 rounded-lg cursor-pointer hover:bg-sky-50 select-none">
              <input
                type="checkbox"
                checked={showEntity}
                onChange={(e) => setShowEntity(e.target.checked)}
                className="accent-sky-700"
              />
              Show Entity Column
            </label>

            {/* Show Period Columns */}
            <label className="flex items-center gap-2 px-3 py-2 text-x bg-white border border-sky-300 rounded-lg cursor-pointer hover:bg-sky-50 select-none">
              <input
                type="checkbox"
                checked={showPeriodCols}
                onChange={(e) => setShowPeriodCols(e.target.checked)}
                className="accent-sky-700"
              />
              Show Period Columns
            </label>

            {/* Active filter tags */}
            {activeTags.length === 0 ? (
              <span className="text-x text-sky-400 italic">No filters applied</span>
            ) : (
              activeTags.map((tag) => (
                <span key={tag} className="flex items-center gap-2 px-3 py-1 text-x rounded-full bg-sky-800 text-white">
                  {tag}
                  <button onClick={() => removeFilter(tag)} className="text-sky-200 hover:text-white font-bold" title="Remove">×</button>
                </span>
              ))
            )}
          </div>

          {/* RIGHT: action buttons */}
          <div className="relative flex items-center gap-2">

            <button
              onClick={() => { if (!open) setDraftFilters(filters); setOpen(!open); }}
              aria-label="Filters"
              className="relative group flex items-center px-3 py-2.5 text-x font-medium rounded-lg border transition bg-sky-100 border-sky-200 text-sky-800 hover:bg-sky-200"
            >
              <FiFilter size={14} />
              <ActionHoverLabel>Filters</ActionHoverLabel>
            </button>

            <ExportMenu
              label="CSV"
              commentaryCount={commentaryCount(exportCommentary)}
              onExport={(include) =>
                downloadCsv(csvWithCommentary(csvData, exportCommentary, include), `BalanceSheet_${year}_${currency}.csv`)
              }
              className="relative group flex items-center px-3 py-2.5 text-x bg-sky-100 text-sky-800 rounded-lg border border-sky-200 hover:bg-sky-200"
            />

            <AddAutomation
              reportType="balance_sheet"
              reportLabel="Balance Sheet Statement"
              year={year}
              currency={currency}
              filters={scheduleFilters}
              iconOnly
            />

            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute right-0 mt-2 w-[480px] bg-sky-50 border border-sky-200 rounded-xl shadow-lg z-50"
                >
                  <div className="p-4 grid grid-cols-2 gap-3 text-x">
                    <Select
                      label="Time Filter"
                      value={draftFilters.time_filter}
                      options={TIME_FILTERS.map((t) => t.id)}
                      labels={Object.fromEntries(TIME_FILTERS.map((t) => [t.id, t.label]))}
                      onChange={(v) => setDraftFilters((f) => ({ ...f, time_filter: v }))}
                    />
                    <Select
                      label="Currency Unit"
                      value={draftFilters.currency_filter}
                      options={CURRENCY_FILTERS.map((c) => c.id)}
                      labels={Object.fromEntries(CURRENCY_FILTERS.map((c) => [c.id, c.label]))}
                      onChange={(v) => setDraftFilters((f) => ({ ...f, currency_filter: v }))}
                    />
                    <Select
                      label="Comparison"
                      value={draftFilters.comparision}
                      options={COMPARISONS.map((c) => c.id)}
                      labels={Object.fromEntries(COMPARISONS.map((c) => [c.id, c.label]))}
                      onChange={(v) => setDraftFilters((f) => ({ ...f, comparision: v }))}
                    />
                    <Select
                      label="Entity"
                      value={draftFilters.entity}
                      options={["All", ...entities.map((e) => String(e.entity_id))]}
                      labels={{ All: "All", ...Object.fromEntries(entities.map((e) => [String(e.entity_id), e.entity_name])) }}
                      onChange={(v) => setDraftFilters((f) => ({ ...f, entity: v }))}
                    />
                  </div>
                  <div className="p-3 border-t border-sky-200 flex gap-2">
                    <button onClick={onCancelDraft} className="w-full py-2 text-x bg-white border border-sky-200 text-sky-900 rounded-lg hover:bg-sky-100">Cancel</button>
                    <button onClick={onResetAll} className="w-full py-2 text-x bg-sky-200 text-sky-900 rounded-lg hover:bg-sky-300">Reset All</button>
                    <button
                      onClick={onApply}
                      disabled={!isDirty}
                      className={["w-full py-2 text-x rounded-lg font-semibold", isDirty ? "bg-sky-900 text-white hover:bg-sky-800" : "bg-slate-200 text-slate-500 cursor-not-allowed"].join(" ")}
                    >
                      Apply Filters
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={() => window.print()}
              aria-label="Print"
              className="relative group flex items-center px-3 py-2.5 text-x bg-sky-100 text-sky-800 rounded-lg border border-sky-200 hover:bg-sky-200"
            >
              <FiPrinter />
              <ActionHoverLabel>Print</ActionHoverLabel>
            </button>

            <div className="relative" ref={sortRef}>
              <button
                type="button"
                onClick={() => setSortOpen((v) => !v)}
                aria-label="Sort"
                className={`relative group flex items-center gap-1 px-3 py-2.5 text-x font-medium rounded-lg border transition ${
                  sortConfig.sort_by !== "default"
                    ? "bg-sky-900 text-white border-sky-900"
                    : "bg-sky-100 text-sky-800 border-sky-200 hover:bg-sky-200"
                }`}
              >
                <FiFilter size={13} />
                <ActionHoverLabel>Sort</ActionHoverLabel>
                {sortConfig.sort_by !== "default" && (
                  <span className="ml-1 px-1.5 py-[1px] rounded-full bg-white text-sky-900 text-[10px] font-bold">
                    {sortConfig.sort_order === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {sortOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-64 z-50 bg-sky-50 border border-sky-200 rounded-xl shadow-xl p-4 space-y-3"
                  >
                    <div>
                      <label className="block text-xs font-medium text-sky-700 mb-1">Sort By</label>
                      <select
                        value={sortConfig.sort_by}
                        onChange={(e) => setSortConfig((s) => ({ ...s, sort_by: e.target.value }))}
                        className="w-full border border-sky-200 rounded-lg p-2 text-x bg-white text-sky-900"
                      >
                        <option value="default">Default Order</option>
                        <option value="account_name">Account Name</option>
                        <option value="current_value">Current Value</option>
                        <option value="previous_value">Previous Value</option>
                        <option value="change_value">Change Amount</option>
                        <option value="change_pct">Change %</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-sky-700 mb-1">Order</label>
                      <div className="flex gap-2">
                        {["asc", "desc"].map((order) => (
                          <button
                            key={order}
                            onClick={() => setSortConfig((s) => ({ ...s, sort_order: order }))}
                            className={`flex-1 py-2 text-x rounded-lg font-medium border transition ${
                              sortConfig.sort_order === order
                                ? "bg-sky-900 text-white border-sky-900"
                                : "bg-white text-sky-800 border-sky-200 hover:bg-sky-100"
                            }`}
                          >
                            {order === "asc" ? "↑ Ascending" : "↓ Descending"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => { setSortConfig({ sort_by: "default", sort_order: "asc" }); setSortOpen(false); }}
                      className="w-full py-2 text-x bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                    >
                      Reset Sort
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <span className="h-6 w-px bg-sky-200" aria-hidden="true" />

            <AIActionsMenu
              reportId="balance_sheet"
              insights={{
                commentary,
                reportLabel: "Balance Sheet Report",
                // activeTags are already prefixed ("Period: …", "Entity: …").
                filterLabels: activeTags,
                viewKey,
                buildContext: buildInsightsContext,
                disabled: loading || !rows.length,
              }}
            />
          </div>
        </div>

        {loading && <TableSkeleton />}

        {/* ================= NORMAL TABLE ================= */}
        {!loading && rows.length > 0 && !isComparisonOn && !showPeriodCols && (
          <div className="report-table-scroll overflow-auto mt-2 max-h-[440px] border border-sky-200 rounded-lg bg-white">
            <table className="min-w-[1200px] w-full text-x">
              <thead className="sticky top-0 bg-sky-900 text-white z-10">
                <tr>
                  {BASE_COLS.map((c) => (
                    <th key={c} className="px-3 py-1.5 font-semibold whitespace-nowrap text-left">{keyToNice(c)}</th>
                  ))}
                  {showEntity && <th className="px-3 py-1.5 font-semibold whitespace-nowrap text-left">ENTITY</th>}
                  <th className="px-3 py-1.5 font-semibold whitespace-nowrap text-right">Current Value</th>
                  {isComparisonOn && ["Previous Value", "Change", "Change %"].map((h) => (
                    <th key={h} className="px-3 py-1.5 font-semibold whitespace-nowrap text-right">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hierarchyRows.map((r, i) => {
                  if (r.rowType === "section-header") {
                    return (
                      <tr key={`sh-${i}`} className="bg-sky-800 text-white select-none">
                        <td colSpan={999} className="px-4 py-2.5 font-bold text-xs tracking-widest uppercase">{r.label}</td>
                      </tr>
                    );
                  }
                  if (r.rowType === "sub-header") {
                    return (
                      <tr key={`subh-${i}`} className="bg-sky-50 select-none">
                        <td colSpan={999} className="px-4 py-2 pl-10 font-semibold text-xs text-sky-600 uppercase tracking-wider border-l-4 border-sky-300">{r.label}</td>
                      </tr>
                    );
                  }
                  const isTotal = r.rowType === "section-total";
                  const isSub   = r.rowType === "subtotal";
                  const trCls = isTotal
                    ? "bg-sky-900 text-white font-bold border-t-2 border-sky-300"
                    : isSub
                    ? "bg-sky-50 border-t border-b border-sky-200 text-sky-900"
                    : "border-b border-sky-50 hover:bg-sky-50 transition-colors text-sky-900";
                  return (
                    <tr key={i} className={trCls}>
                      <td className={["px-3 py-2.5 whitespace-nowrap text-left text-xs", isTotal ? "text-white/50" : "text-sky-400"].join(" ")}>{safeText(r.account_type)}</td>
                      <td
                        className={["px-3 py-2.5 whitespace-nowrap text-left",
                          r.rowType === "account" ? "pl-12 text-sky-900 hover:text-blue-600 cursor-pointer font-medium" :
                          isSub  ? "pl-10 font-semibold italic text-sky-700" :
                          isTotal ? "pl-4 font-bold"  : "pl-4 font-semibold"
                        ].join(" ")}
                        onClick={r.rowType === "account" ? () => { const a = r?.account_name || ""; if (!a) return; setDrillAccount(a); setDrillPeriod(""); setDrillOpen(true); } : undefined}
                        role={r.rowType === "account" ? "button" : undefined}
                        tabIndex={r.rowType === "account" ? 0 : undefined}
                        onKeyDown={r.rowType === "account" ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); const a = r?.account_name || ""; if (!a) return; setDrillAccount(a); setDrillPeriod(""); setDrillOpen(true); } } : undefined}
                        title={r.rowType === "account" ? "Click to view drilldown" : undefined}
                      >
                        {safeText(r.account_name)}
                      </td>
                      {showEntity && (
                        <td className="px-3 py-2.5 whitespace-nowrap text-left text-sky-700">
                          {entityNameMap[String(r?.entity_id)] || r?.entity_id || "—"}
                        </td>
                      )}
                      <td className="px-3 py-2.5 whitespace-nowrap text-right font-semibold">{money(r?.current_value, currency)}</td>
                      {isComparisonOn && (
                        <>
                          <td className="px-3 py-2.5 whitespace-nowrap text-right">{money(r?.previous_value, currency)}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-right">{money(r?.change_value, currency)}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-right">
                            {(() => { const pct = pctInline(r?.change_pct); return <span className={["font-semibold", pct?.cls || (isTotal ? "text-white/70" : "text-slate-700")].join(" ")}>{pct ? pct.text : "—"}</span>; })()}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}


        {/* ================= COMPARISON TABLE ================= */}
        {!loading && isComparisonOn && !showPeriodCols && rows.length > 0 && (
          <div className="report-table-scroll overflow-auto mt-3 max-h-[520px] border border-sky-200 rounded-lg bg-white">
            <table className="min-w-max w-full text-x">
              <thead className="sticky top-0 z-20">
                <tr className="bg-[#04577c] text-white">
                  <th rowSpan={2} className="px-3 py-1.5 text-left whitespace-nowrap min-w-[140px] border-r border-white/15 font-semibold">ACCOUNT TYPE</th>
                  <th rowSpan={2} className="px-3 py-1.5 text-left whitespace-nowrap min-w-[200px] border-r border-white/15 font-semibold">ACCOUNT NAME</th>
                  {showEntity && <th rowSpan={2} className="px-3 py-1.5 text-left whitespace-nowrap min-w-[140px] border-r border-white/15 font-semibold">ENTITY</th>}
                  {comparisonPivot.periods.map((p, idx) => {
                    const prevP = getPrevPeriod(p, filters.comparision);
                    return (
                      <th key={p} colSpan={3} className={["px-3 py-1.5 text-center whitespace-nowrap font-bold", idx > 0 ? "border-l-2 border-white/20" : ""].join(" ")}>
                        {p}{prevP ? ` vs ${prevP}` : ""}
                      </th>
                    );
                  })}
                  <th colSpan={3} className="px-3 py-1.5 text-center whitespace-nowrap font-bold border-l-2 border-white/20 bg-sky-950">Total</th>
                </tr>
                <tr className="bg-[#0b6a92] text-white">
                  {comparisonPivot.periods.flatMap((p, idx) => {
                    const prevP = getPrevPeriod(p, filters.comparision);
                    return [
                      <th key={`${p}-cur`} className={["px-3 py-1 text-center whitespace-nowrap font-semibold text-xs", idx > 0 ? "border-l-2 border-white/20" : ""].join(" ")}>{p}</th>,
                      <th key={`${p}-prev`} className="px-3 py-1 text-center whitespace-nowrap font-semibold text-xs border-l border-white/15">{prevP || "Previous"}</th>,
                      <th key={`${p}-var`} className="px-3 py-1 text-center whitespace-nowrap text-xs border-l border-white/15 text-white/70">Variance</th>,
                    ];
                  })}
                  <th className="px-3 py-1 text-center whitespace-nowrap font-semibold text-xs border-l-2 border-white/20 bg-sky-950">Current</th>
                  <th className="px-3 py-1 text-center whitespace-nowrap font-semibold text-xs border-l border-white/15 bg-sky-950">Previous</th>
                  <th className="px-3 py-1 text-center whitespace-nowrap text-xs border-l border-white/15 bg-sky-950 text-white/70">Variance</th>
                </tr>
              </thead>
              <tbody>
                {hierarchyRows.map((r, i) => {
                  if (r.rowType === "section-header") {
                    return (
                      <tr key={`sh-${i}`} className="bg-[#04577c] text-white select-none">
                        <td colSpan={999} className="px-4 py-2.5 font-bold text-xs tracking-widest uppercase">{r.label}</td>
                      </tr>
                    );
                  }
                  if (r.rowType === "sub-header") {
                    return (
                      <tr key={`subh-${i}`} className="bg-sky-50 select-none">
                        <td colSpan={999} className="px-4 py-2 pl-10 font-semibold text-xs text-sky-600 uppercase tracking-wider border-l-4 border-sky-300">{r.label}</td>
                      </tr>
                    );
                  }
                  const isTotal = r.rowType === "section-total";
                  const isSub   = r.rowType === "subtotal";
                  const trCls = isTotal
                    ? "bg-[#04577c] text-white font-bold"
                    : isSub
                    ? "bg-sky-50 border-t border-sky-200 text-sky-900"
                    : "border-b border-sky-100 hover:bg-sky-50";
                  return (
                    <tr key={i} className={trCls}>
                      <td className={["px-3 py-2.5 whitespace-nowrap text-left text-xs", isTotal ? "text-white/50" : "text-sky-400"].join(" ")}>{safeText(r.account_type)}</td>
                      <td
                        className={["px-3 py-2.5 whitespace-nowrap border-r border-sky-100",
                          r.rowType === "account" ? "pl-12 font-medium text-sky-900 hover:text-blue-600 cursor-pointer" :
                          isSub   ? "pl-10 font-semibold italic text-sky-700" :
                          isTotal ? "pl-4 font-bold" : "pl-4 font-semibold"
                        ].join(" ")}
                        onClick={r.rowType === "account" ? () => { setDrillAccount(r.account_name || ""); setDrillPeriod(""); setDrillOpen(true); } : undefined}
                        role={r.rowType === "account" ? "button" : undefined}
                        tabIndex={r.rowType === "account" ? 0 : undefined}
                        onKeyDown={r.rowType === "account" ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDrillAccount(r.account_name || ""); setDrillPeriod(""); setDrillOpen(true); } } : undefined}
                      >
                        {safeText(r.account_name)}
                      </td>
                      {showEntity && (
                        <td className="px-3 py-2.5 whitespace-nowrap border-r border-sky-100">
                          {entityNameMap[String(r.entity_id)] || r.entity_id || "—"}
                        </td>
                      )}
                      {comparisonPivot.periods.map((p, idx) => {
                        const m = r.months?.[p];
                        const st = diffStyle(m?.change_value);
                        return (
                          <React.Fragment key={p}>
                            <td className={["px-3 py-2.5 text-right whitespace-nowrap", idx > 0 ? "border-l-2 border-sky-100" : ""].join(" ")}>{money(m?.current_value, currency)}</td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap border-l border-sky-100">{money(m?.previous_value, currency)}</td>
                            <td className={["px-3 py-2.5 text-center whitespace-nowrap border-l border-sky-100", !isTotal ? st.cellBg : ""].join(" ")}>
                              {m ? <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${!isTotal ? st.pill : "bg-sky-500/40 text-white"}`}>{!isTotal && <span>{st.arrow}</span>}{money(m?.change_value, currency)}</span> : "—"}
                            </td>
                          </React.Fragment>
                        );
                      })}
                      <td className={["px-3 py-2.5 text-right whitespace-nowrap font-semibold border-l-2 border-sky-200", isTotal ? "bg-sky-950" : "bg-sky-50 text-sky-900"].join(" ")}>{money(r.total?.current_value, currency)}</td>
                      <td className={["px-3 py-2.5 text-right whitespace-nowrap border-l border-sky-100", isTotal ? "bg-sky-950" : "bg-sky-50 text-sky-700"].join(" ")}>{money(r.total?.previous_value, currency)}</td>
                      <td className={["px-3 py-2.5 text-center whitespace-nowrap border-l border-sky-100", isTotal ? "bg-sky-950" : "bg-sky-50 " + diffStyle(r.total?.change_value).cellBg].join(" ")}>
                        {(() => { const st = diffStyle(r.total?.change_value); return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${!isTotal ? st.pill : "bg-sky-500/40 text-white"}`}>{!isTotal && <span>{st.arrow}</span>}{money(r.total?.change_value, currency)}</span>; })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ================= PERIOD PIVOT TABLE ================= */}
        {!loading && showPeriodCols && rows.length > 0 && (
          <div className="report-table-scroll overflow-auto mt-3 max-h-[520px] border border-sky-200 rounded-lg bg-white">
            <table className="min-w-max w-full text-x">
              <thead className="sticky top-0 z-20">
                <tr className="bg-sky-900 text-white">
                  <th rowSpan={isComparisonOn ? 2 : 1} className="px-3 py-1.5 text-left whitespace-nowrap min-w-[140px] border-r border-white/15 font-semibold">ACCOUNT TYPE</th>
                  <th rowSpan={isComparisonOn ? 2 : 1} className="px-3 py-1.5 text-left whitespace-nowrap min-w-[200px] border-r border-white/15 font-semibold">ACCOUNT NAME</th>
                  {showEntity && <th rowSpan={isComparisonOn ? 2 : 1} className="px-3 py-1.5 text-left whitespace-nowrap min-w-[140px] border-r border-white/15 font-semibold">ENTITY</th>}
                  {periodPivot.periods.map((p, idx) => (
                    <th key={p} colSpan={isComparisonOn ? 4 : 1} className={["px-3 py-1.5 text-center whitespace-nowrap font-bold", idx > 0 ? "border-l-2 border-white/20" : ""].join(" ")}>{p}</th>
                  ))}
                  <th colSpan={isComparisonOn ? 4 : 1} className="px-3 py-1.5 text-center whitespace-nowrap font-bold border-l-2 border-white/20 bg-sky-950">Total</th>
                  <th rowSpan={isComparisonOn ? 2 : 1} className="px-3 py-1.5 text-left whitespace-nowrap font-bold border-l-2 border-white/20">Insights</th>
                </tr>
                {isComparisonOn && (
                  <tr className="bg-[#0b6a92] text-white">
                    {periodPivot.periods.flatMap((p, idx) => {
                      const prevP = getPrevPeriod(p, filters.comparision);
                      return [
                        <th key={`${p}-cv`} className={["px-3 py-1 text-center whitespace-nowrap font-semibold text-xs", idx > 0 ? "border-l-2 border-white/20" : ""].join(" ")}>{p}</th>,
                        <th key={`${p}-pv`} className="px-3 py-1 text-center whitespace-nowrap font-semibold text-xs border-l border-white/15">{prevP || "Previous"}</th>,
                        <th key={`${p}-ch`} className="px-3 py-1 text-center whitespace-nowrap text-xs border-l border-white/15 text-white/70">Change</th>,
                        <th key={`${p}-cp`} className="px-3 py-1 text-center whitespace-nowrap text-xs border-l border-white/15 text-white/70">Change %</th>,
                      ];
                    })}
                    <th className="px-3 py-1 text-center whitespace-nowrap text-xs border-l-2 border-white/20 bg-sky-950 font-semibold">Current</th>
                    <th className="px-3 py-1 text-center whitespace-nowrap text-xs border-l border-white/15 bg-sky-950 font-semibold">Previous</th>
                    <th className="px-3 py-1 text-center whitespace-nowrap text-xs border-l border-white/15 bg-sky-950 text-white/70">Change</th>
                    <th className="px-3 py-1 text-center whitespace-nowrap text-xs border-l border-white/15 bg-sky-950 text-white/70">Change %</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {hierarchyRows.map((r, i) => {
                  if (r.rowType === "section-header") {
                    return (
                      <tr key={`sh-${i}`} className="bg-sky-800 text-white select-none">
                        <td colSpan={999} className="px-4 py-2.5 font-bold text-xs tracking-widest uppercase">{r.label}</td>
                      </tr>
                    );
                  }
                  if (r.rowType === "sub-header") {
                    return (
                      <tr key={`subh-${i}`} className="bg-sky-50 select-none">
                        <td colSpan={999} className="px-4 py-2 pl-10 font-semibold text-xs text-sky-600 uppercase tracking-wider border-l-4 border-sky-300">{r.label}</td>
                      </tr>
                    );
                  }
                  const isTotal = r.rowType === "section-total";
                  const isSub   = r.rowType === "subtotal";
                  const trCls = isTotal
                    ? "bg-sky-900 text-white font-bold border-t-2 border-sky-300"
                    : isSub
                    ? "bg-sky-50 border-t border-sky-200 text-sky-900"
                    : "border-b border-sky-100 hover:bg-sky-50";
                  return (
                    <tr key={i} className={trCls}>
                      <td className={["px-3 py-2.5 whitespace-nowrap text-left text-xs", isTotal ? "text-white/50" : "text-sky-400"].join(" ")}>{safeText(r.account_type)}</td>
                      <td
                        className={["px-3 py-2.5 whitespace-nowrap border-r border-sky-100",
                          r.rowType === "account" ? "pl-12 font-medium text-sky-900 hover:text-blue-600 cursor-pointer" :
                          isSub   ? "pl-10 font-semibold italic text-sky-700" :
                          isTotal ? "pl-4 font-bold" : "pl-4 font-semibold"
                        ].join(" ")}
                        onClick={r.rowType === "account" ? () => { setDrillAccount(r.account_name || ""); setDrillPeriod(""); setDrillOpen(true); } : undefined}
                        role={r.rowType === "account" ? "button" : undefined}
                        tabIndex={r.rowType === "account" ? 0 : undefined}
                        onKeyDown={r.rowType === "account" ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDrillAccount(r.account_name || ""); setDrillPeriod(""); setDrillOpen(true); } } : undefined}
                      >
                        {safeText(r.account_name)}
                      </td>
                      {showEntity && (
                        <td className="px-3 py-2.5 whitespace-nowrap border-r border-sky-100">
                          {entityNameMap[String(r.entity_id)] || r.entity_id || "—"}
                        </td>
                      )}
                      {periodPivot.periods.map((p, idx) => {
                        const m = r.months?.[p];
                        const pct = pctInline(m?.change_pct);
                        return (
                          <React.Fragment key={p}>
                            <td className={["px-3 py-2.5 text-right whitespace-nowrap font-semibold", idx > 0 ? "border-l-2 border-sky-100" : ""].join(" ")}>{money(m?.current_value, currency)}</td>
                            {isComparisonOn && (
                              <>
                                <td className="px-3 py-2.5 text-right whitespace-nowrap border-l border-sky-100">{money(m?.previous_value, currency)}</td>
                                <td className="px-3 py-2.5 text-right whitespace-nowrap border-l border-sky-100">{money(m?.change_value, currency)}</td>
                                <td className="px-3 py-2.5 text-right whitespace-nowrap border-l border-sky-100">
                                  {pct ? <span className={`font-semibold ${pct.cls}`}>{pct.text}</span> : "—"}
                                </td>
                              </>
                            )}
                          </React.Fragment>
                        );
                      })}
                      <td className={["px-3 py-2.5 text-right whitespace-nowrap font-semibold border-l-2 border-sky-200", isTotal ? "bg-sky-950" : "bg-sky-50 text-sky-900"].join(" ")}>{money(r.total?.current_value, currency)}</td>
                      {isComparisonOn && (
                        <>
                          <td className={["px-3 py-2.5 text-right whitespace-nowrap border-l border-sky-100", isTotal ? "bg-sky-950" : "bg-sky-50"].join(" ")}>{money(r.total?.previous_value, currency)}</td>
                          <td className={["px-3 py-2.5 text-right whitespace-nowrap border-l border-sky-100", isTotal ? "bg-sky-950" : "bg-sky-50"].join(" ")}>{money(r.total?.change_value, currency)}</td>
                          <td className={["px-3 py-2.5 text-right whitespace-nowrap border-l border-sky-100", isTotal ? "bg-sky-950" : "bg-sky-50"].join(" ")}>
                            {(() => { const pct = pctInline(r.total?.change_pct); return pct ? <span className={`font-semibold ${pct.cls}`}>{pct.text}</span> : "—"; })()}
                          </td>
                        </>
                      )}
                      <td className="px-3 py-2.5 whitespace-nowrap min-w-[420px] border-l-2 border-sky-200 text-sky-700">
                        {buildBalanceAccountInsight(r, periodPivot.periods)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* NO DATA */}
        {!loading && rows.length === 0 && (
          <div className="h-[420px] flex items-center justify-center border rounded-xl">
            <p className="text-s text-sky-700">No data available for selected filters</p>
          </div>
        )}

        {/* METRICS */}
        {metrics && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-6 bg-white border border-sky-200 rounded-xl p-4 shadow-sm"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 space-y-3">
                <h3 className="text-s font-semibold text-sky-900">Key Balance Sheet Metrics</h3>
                <MetricRow label="Total Assets" value={money(metrics?.["Total Assets"], currency)} />
                <MetricRow label="Total Liabilities" value={money(metrics?.["Total Liabilities"], currency)} />
                <MetricRow label="Net Equity" value={money(metrics?.["Net Equity"], currency)} />
              </div>

              <div className="bg-sky-50 md:col-span-2 border border-sky-200 rounded-lg p-3 flex flex-col justify-center gap-2">
                <h4 className="text-x font-semibold text-sky-900 mb-1">Executive Financial Insight</h4>
                {bsExecutive.map((para, i) => (
                  <p key={i} className="text-s text-sky-800 leading-relaxed">{para}</p>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {!loading && <ReportCommentary commentary={commentary} />}
      </main>

      {/* ✅ DRILLDOWN DRAWER */}
      <BalanceSheetDrilldownDrawer
        open={drillOpen}
        onClose={() => setDrillOpen(false)}
        token={token}
        year={year}
        currency={currency}
        API_BASE_URL={API_BASE_URL}
        filters={filters}
        accountName={drillAccount}
        period={drillPeriod} // optional YYYY-MM
      />
    </ReportsLayout>
  );
}
