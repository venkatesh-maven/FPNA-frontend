import React, { useState, useEffect, useContext, useMemo, useRef } from "react";
import { AuthContext } from "../../../context/AuthContext";
import { API_BASE_URL } from "../../../config/config";
import { cachedFetch } from "../../../utils/reportCache";
import {
  FiFilter,
  FiTrendingUp,
  FiTrendingDown,
  FiPrinter,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import ReportsLayout from "../ReportsLayout";
import TableSkeleton from "../../Skeleton/TableSkeleton";
import ExportMenu from "../ExportMenu";
import { collectCommentary, commentaryCount, csvWithCommentary, downloadCsv } from "../reportExport";
import AIActionsMenu from "../AIActionsMenu";
import ActionHoverLabel from "../ActionHoverLabel";
import ReportCommentary from "../ReportCommentary";
import useReportCommentary from "../../../hooks/useReportCommentary";
import { buildReportAIContext, rankForAI, toNumberForAI } from "../reportAIContext";
import LineItemRefineWithAI, { LineItemAIButton } from "../LineItemRefineWithAI";
import LineItemCommentary from "../LineItemCommentary";
import useLineItemCommentary from "../../../hooks/useLineItemCommentary";
import AnalyzeWithAI, { AnalyzeButton } from "../AnalyzeWithAI";
import AIHelpTooltip from "../AIHelpTooltip";
import { BsStars, BsChatLeftText, BsChatLeftTextFill } from "react-icons/bs";
import AddAutomation from "../AddAutomation";
import { FaArrowRightToBracket } from "react-icons/fa6";
import { getDecimalPrecision } from '../../../utils/formatters';

/* ================== CONSTANTS ================== */

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

const COMPARITY_FILTERS = [
  { id: "", label: "No Comparison" },
  { id: "month_on_month", label: "Month vs Month" },
  { id: "year_on_year", label: "Year vs Year" },
];

const METRICS = [
  { label: "OPERATING CASH FLOW", key: "operating_cf" },
  { label: "INVESTING CASH FLOW", key: "investing_cf" },
  { label: "FINANCING CASH FLOW", key: "financing_cf" },
  { label: "NET CASH CHANGE", key: "net_cash_change" },
];

/* ================== HELPERS ================== */

const isNil = (v) => v === null || v === undefined || v === "";
const safeId = (v) => (v === null || v === undefined ? "" : String(v));

const toYYYYMM = (period) => {
  if (!period) return "";
  const d = new Date(period);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${m}/${y}`;
  }
  return period.slice(0, 7);
};

const formatDollar = (v) => {
  if (isNil(v)) return "—";
  if (typeof v === "string") {
    const cleaned = v.trim().replace(/[$,\s]/g, "");
    if (!cleaned || cleaned === "—" || cleaned === "-") return "—";
    if (/[a-zA-Z%]/.test(cleaned)) return v;
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed)) return v;
    v = parsed;
  }
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  const dp = getDecimalPrecision();
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
};

const pickFirst = (obj, keys) => {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return null;
};

const getPrevValue = (c, key) => pickFirst(c, [`prev_${key}`, key]);
const getDiffValue = (c, key) => pickFirst(c, [`${key}_diff`, `diff_${key}`]);

// "03/2025" (table period) or "2025-03" (API prev_period) -> { y, m }, else null.
const parsePeriodForAI = (period) => {
  const s = String(period || "");
  const a = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (a) return { y: Number(a[2]), m: Number(a[1]) };
  const b = s.match(/^(\d{4})-(\d{1,2})/);
  return b ? { y: Number(b[1]), m: Number(b[2]) } : null;
};

// -> "March 2025" for the AI; anything that isn't a month is returned as-is.
const monthLabelForAI = (period) => {
  const p = parsePeriodForAI(period);
  if (!p || p.m < 1 || p.m > 12) return period;
  return new Date(p.y, p.m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
};

/* ── Inline AI (row commentary + ✦ Explain with AI) ── */

// What each line means (backend report.py cashflow_statement) and which
// direction is favorable — sent with every line-level AI request.
const CF_LINE_NOTES = {
  operating_cf:
    "Operating cash flow = operating income (revenue and other income, credits minus debits) minus operating expenses (COGS and all expense accounts, debits minus credits). Positive = net cash inflow from operations, negative = operations consumed cash. Higher is favorable.",
  investing_cf:
    "Investing cash flow = the gross amount debited to non-cash asset accounts, i.e. asset additions such as purchases / capex. It is normally positive and a higher value means MORE cash spent on assets; it is not netted against disposals. It is neither good nor bad by itself — judge it against operating cash flow (is the investment funded by operations?).",
  financing_cf:
    "Financing cash flow = the net increase in liability balances (credits minus debits, e.g. new borrowing less repayments). Positive = cash raised, which also adds obligations; negative = net repayment. Neither favorable nor unfavorable by itself — judge it against operating cash flow (is borrowing covering an operating shortfall?).",
  net_cash_change:
    "Net cash change = the actual net movement in cash accounts (debits minus credits on the cash accounts), calculated separately, so it need not equal operating + investing + financing. Positive = the cash balance grew. Higher is favorable.",
};

const METRIC_BY_KEY = Object.fromEntries(METRICS.map((m) => [m.key, m]));
// "OPERATING CASH FLOW" -> "Operating Cash Flow" / "operating_cash_flow"
const lineTitle = (key) => METRIC_BY_KEY[key].label.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const lineFieldForAI = (key) => METRIC_BY_KEY[key].label.toLowerCase().replace(/ /g, "_");

const _round2 = (n) => Math.round(n * 100) / 100;
const _sumOf = (list, key) => _round2(list.reduce((acc, x) => acc + (x[key] ?? 0), 0));

// Highest / lowest entry of `list` by `key`, named hiName / loName.
const _extremes = (list, key, hiName, loName) => {
  const valid = list.filter((x) => x[key] !== null && x[key] !== undefined);
  if (!valid.length) return {};
  const sorted = [...valid].sort((a, b) => b[key] - a[key]);
  const pick = (x) => ({ month: x.month, [key]: x[key] });
  return { [hiName]: pick(sorted[0]), [loName]: pick(sorted[sorted.length - 1]) };
};

// "03/2025" (table) or "2025-03" -> "2025-03", else null.
const toApiPeriodForAI = (period) => {
  const p = parsePeriodForAI(period);
  return p && p.m >= 1 && p.m <= 12 ? `${p.y}-${String(p.m).padStart(2, "0")}` : null;
};

const prevMonthForAI = (period) => {
  if (!period) return null;
  const [y, m] = period.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};

const topByAbs = (list, key, n = 8) =>
  [...list].sort((a, b) => Math.abs(b[key] ?? 0) - Math.abs(a[key] ?? 0)).slice(0, n);

// GL-account-level cash flow (cashflow_statement_viewmore, monthly detailed view):
//   { "<GL account>": { data: [{ period: "YYYY-MM", operating_cf, investing_cf,
//     financing_cf, net_cash_change, comparision: { prev_period, operating_cf, … } }],
//     ai_driver }, entities: [...] }
// -> [{ account, byPeriod: { "YYYY-MM": { operating_cf, …, prev_operating_cf, … } } }]
const parseCashflowAccounts = (json) => {
  if (!json || typeof json !== "object" || Array.isArray(json)) return [];
  return Object.entries(json)
    .filter(([name, section]) => name !== "entities" && Array.isArray(section?.data))
    .map(([account, section]) => {
      const byPeriod = {};
      section.data.forEach((d) => {
        if (!/^\d{4}-\d{2}$/.test(d?.period || "")) return;
        const c = d.comparision || {};
        if (!byPeriod[d.period]) byPeriod[d.period] = {};
        const entry = byPeriod[d.period];
        METRICS.forEach(({ key }) => {
          entry[key] = (entry[key] ?? 0) + (toNumberForAI(d[key]) ?? 0);
          entry[`prev_${key}`] = (entry[`prev_${key}`] ?? 0) + (toNumberForAI(c[key]) ?? 0);
        });
      });
      return { account, byPeriod };
    })
    .filter((a) => Object.keys(a.byPeriod).length);
};

// The account-level series behind a line. Investing leaves out cash accounts,
// as the report does. Net cash change is measured on the cash accounts and the
// endpoint can't split it, so its drivers are the three activity lines.
const accountSeriesForAI = (accounts, lineKey) => {
  const keys = lineKey === "net_cash_change" ? ["operating_cf", "investing_cf", "financing_cf"] : [lineKey];
  return keys.flatMap((k) =>
    accounts
      .filter((a) => k !== "investing_cf" || !/cash/i.test(a.account))
      .map((a) => ({ account: a.account, ...(keys.length > 1 && { line: lineTitle(k) }), key: k, byPeriod: a.byPeriod })),
  );
};

// Each account's value in `period`, in the compared period and the change.
const accountMovesForAI = (series, period, comparePeriod) =>
  series
    .map((s) => {
      const cur = s.byPeriod[period];
      const current = cur ? cur[s.key] : 0;
      const previous = cur ? cur[`prev_${s.key}`] : (s.byPeriod[comparePeriod]?.[s.key] ?? 0);
      return {
        account: s.account,
        ...(s.line && { line: s.line }),
        current: _round2(current),
        previous: _round2(previous),
        change: _round2(current - previous),
      };
    })
    .filter((x) => x.current || x.previous);

const getVarianceUI = (value) => {
  const num = Number(value);
  if (Number.isNaN(num) || num === 0)
    return {
      bg: "bg-sky-50",
      color: "text-sky-700",
      pill: "bg-slate-200 text-slate-800",
      arrow: "•",
    };
  if (num > 0)
    return {
      bg: "bg-green-50",
      color: "text-green-700",
      pill: "bg-green-600 text-white",
      arrow: "▲",
    };
  return {
    bg: "bg-red-50",
    color: "text-red-700",
    pill: "bg-red-600 text-white",
    arrow: "▼",
  };
};

/* ── Analytical narrative builder ──
   Deep, data-driven analysis - not a restatement of the numbers already
   visible in the table. Everything is computed from the real cash flow
   figures, nothing here is a fixed template string. */
const _cfNum = (row, key) => {
  const raw = row[key];
  if (typeof raw === "string") {
    const n = Number(raw.replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return Number(raw) || 0;
};

const CF_NOT_ENOUGH_DATA = "Not enough periods in this view to analyze a pattern - widen the date range for a deeper read.";

const buildCashflowNarrative = (allRows) => {
  const periodRows = allRows.filter((r) => r.period !== "total");
  const N = periodRows.length;
  const empty = {
    operating_cf: CF_NOT_ENOUGH_DATA, investing_cf: CF_NOT_ENOUGH_DATA,
    financing_cf: CF_NOT_ENOUGH_DATA, net_cash_change: CF_NOT_ENOUGH_DATA,
    executive: [CF_NOT_ENOUGH_DATA],
  };
  if (N < 3) return empty;

  const operating = periodRows.map((r) => _cfNum(r, "operating_cf"));
  const investing = periodRows.map((r) => _cfNum(r, "investing_cf"));
  const financing = periodRows.map((r) => _cfNum(r, "financing_cf"));

  const totalOp = operating.reduce((a, b) => a + b, 0);
  const totalInv = investing.reduce((a, b) => a + b, 0);
  const totalFin = financing.reduce((a, b) => a + b, 0);
  const totalNet = totalOp + totalInv + totalFin;
  const negOpMonths = operating.filter((v) => v < 0).length;
  const relianceRisk = totalFin > 0 && negOpMonths > 0;

  const avgOperating = totalOp / N;
  const weakOpMonths = periodRows.filter((r, i) => operating[i] < avgOperating);
  const strongOpMonths = periodRows.filter((r, i) => operating[i] >= avgOperating);
  const avgFinancingWhenWeak = weakOpMonths.length
    ? weakOpMonths.reduce((s, r) => s + _cfNum(r, "financing_cf"), 0) / weakOpMonths.length : 0;
  const avgFinancingWhenStrong = strongOpMonths.length
    ? strongOpMonths.reduce((s, r) => s + _cfNum(r, "financing_cf"), 0) / strongOpMonths.length : 0;
  // A business genuinely plugging operating gaps with financing shows a
  // *pattern*: more external funding specifically in the weak months, not a
  // steady drip regardless of how operations are doing that month. That
  // distinction - reactive vs scheduled - is the real story financing
  // activity can tell, not just "was the total positive or negative."
  const financingIsReactive = avgFinancingWhenStrong !== 0
    ? avgFinancingWhenWeak > avgFinancingWhenStrong * 1.4
    : avgFinancingWhenWeak > 0 && weakOpMonths.length > 0;

  // ── Operating CF: is the core business generating its own cash? ──
  const operatingText = negOpMonths > 0
    ? `Operating cash flow went negative in ${negOpMonths} of ${N} months, meaning core operations consumed cash rather than generated it in those periods. ${negOpMonths >= Math.ceil(N / 3) ? "That's frequent enough to be a structural pattern, not a one-off." : "That's occasional enough to likely reflect timing rather than a structural issue, but worth watching."}`
    : `Operating cash flow was positive every month, generating cash consistently from core operations rather than relying on external financing or asset sales to stay liquid.`;

  // ── Investing CF: growth investment or divestiture? ──
  const investingText = totalInv < 0
    ? `Investing activity was a net user of cash overall, consistent with ongoing investment in growth - capex, acquisitions, or asset purchases - rather than one-off divestitures.`
    : `Investing activity was a net source of cash overall, which more often reflects asset sales or investment liquidation than reinvestment in the business - worth confirming this isn't a one-off gain masking a pause in growth investment.`;

  // ── Financing CF: funding growth on a schedule, or reacting to shortfalls as they hit? ──
  const financingText = financingIsReactive
    ? `Financing activity isn't steady month to month - it shows up harder specifically in the months when operating cash flow is weakest, which is the signature of a business plugging gaps as they occur rather than raising capital on a planned schedule.`
    : relianceRisk
    ? `Financing activity ran alongside ${negOpMonths} month${negOpMonths !== 1 ? "s" : ""} of negative operating cash flow, but without concentrating specifically in those weak months - more consistent with planned funding than reactive gap-filling.`
    : totalFin > 0
    ? `Financing activity added to the cash position on top of positive operating cash flow - this looks like funding for growth rather than a rescue for a cash-short core business.`
    : `Financing activity was a net cash outflow overall, consistent with paying down debt or returning capital rather than raising new funding.`;

  // ── Net Cash Change: what's actually driving the change in cash position? ──
  const absSum = Math.abs(totalOp) + Math.abs(totalInv) + Math.abs(totalFin);
  const opShare = absSum ? (Math.abs(totalOp) / absSum) * 100 : 0;
  const opIsMinority = totalOp <= 0 || opShare < 40;
  const dominantSource = totalInv >= totalFin ? "investing" : "financing";
  const netCashChangeText = totalOp <= 0
    ? `The year-end cash position wasn't built by the business earning it - operations were a net cash user overall, so whatever cash the business ended up with came from ${dominantSource} activity instead, which is a far less repeatable way to fund the business long-term.`
    : opIsMinority
    ? `Operating activity accounts for only about ${opShare.toFixed(0)}% of the total cash movement this year - most of it came from ${dominantSource} activity instead. That's a less durable source of cash than core operations, and worth understanding before treating the year-end cash position as a sign of operating strength.`
    : `Operating activity makes up the majority of this year's gross cash movement (roughly ${opShare.toFixed(0)}%) - a healthier mix than one leaning on financing or one-off investing activity to hold the cash position together.`;

  const executive = [
    `The cash position this year was ${opIsMinority ? "not primarily" : "primarily"} built by the business itself: operating activity made up ${opIsMinority ? `only about ${opShare.toFixed(0)}%` : `roughly ${opShare.toFixed(0)}%`} of gross cash movement. ${financingIsReactive ? "Financing activity concentrates specifically in the weakest operating months, which is the pattern of a business covering gaps as they appear rather than funding growth on a schedule." : relianceRisk ? "Financing ran alongside some months of negative operating cash flow, though not concentrated enough in those specific months to call it reactive gap-filling." : opIsMinority ? `Most of the cash build instead traces to ${dominantSource} activity.` : "That's the healthiest source of cash for sustaining the business without outside help."}`,
    `The main thing to monitor going forward is whether operating cash flow can ${negOpMonths > 0 ? "turn consistently positive" : opIsMinority ? "grow into a larger share of the cash position" : "stay consistently positive"}${financingIsReactive ? ", since the business is currently leaning on financing precisely when operations fall short - a source that carries more risk if it becomes harder to access" : " without leaning on financing or asset sales to cover shortfalls, which carries more risk if that source dries up"}.`,
  ];

  return {
    operating_cf: operatingText,
    investing_cf: investingText,
    financing_cf: financingText,
    net_cash_change: netCashChangeText,
    executive,
  };
};

/* ================== NORMALIZE ================== */

const normalizeCashflowResponse = (api) => {
  const out = { rows: [], keymetrics: null, entities: [] };
  if (!Array.isArray(api)) return out;

  out.rows = api
    .filter((x) => x && x.period)
    .map((r) => ({
      ...r,
      period: toYYYYMM(r.period),
      comparision: r?.comparision || {},
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  out.keymetrics = api.find((x) => x?.keymetrics)?.keymetrics || null;
  out.entities = api.find((x) => x?.entities)?.entities || [];

  return out;
};

/* ================== COMPONENT ================== */

export default function CashFlowReport() {
  const {
    token,
    selectedYear: year,
    selectedCurrency,
  } = useContext(AuthContext);

  const DEFAULT_FILTERS = useMemo(
    () => ({
      currency_filter: "actualvalue",
      time_filter: "all_periods",
      entity: null,
      comparity_filter: "",
    }),
    [],
  );

  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);

  const [rows, setRows] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [entities, setEntities] = useState([{ id: null, label: "All" }]);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [noDataMessage, setNoDataMessage] = useState("");

  const hasComparisonSelected = !!appliedFilters.comparity_filter;

  /* ================== FILTER LOGIC ================== */

  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const [sortConfig, setSortConfig] = useState({ sort_by: "period", sort_order: "asc" });
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
      if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const hasPendingChanges =
    JSON.stringify(draftFilters) !== JSON.stringify(appliedFilters);

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setOpen(false);
  };

  const resetAll = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setOpen(false);
  };

  const getEntityLabelNew = (id) =>
    entities.find((e) => safeId(e.id) === safeId(id))?.label;

  /* ================== FETCH ================== */

  useEffect(() => {
    if (!token || !year || !selectedCurrency) return;

    const fetchData = async () => {
      setLoading(true);
      setErrorMsg("");
      setNoDataMessage("");

      try {
        const params = new URLSearchParams();
        params.append("currency_filter", appliedFilters.currency_filter);

        if (appliedFilters.time_filter !== "all_periods")
          params.append("time_filter", appliedFilters.time_filter);

        if (appliedFilters.entity)
          params.append("entity", appliedFilters.entity);

        if (appliedFilters.comparity_filter)
          params.append("comparision", appliedFilters.comparity_filter);

        const api = await cachedFetch(
          `${API_BASE_URL}/api/v1/company/financial/cashflow_statement/${year}/${selectedCurrency}?${params}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              accept: "application/json",
            },
          },
        );
        const normalized = normalizeCashflowResponse(api);

        setRows(normalized.rows);

        if (normalized.keymetrics) {
          setMetrics({
            operating: normalized.keymetrics.operational_total,
            investing: normalized.keymetrics.investing_total,
            financing: normalized.keymetrics.finalcial_total,
            net: normalized.keymetrics.net_cash_flow,
            aiDriver: normalized.keymetrics.aiDriver || [],
          });
        }

        if (normalized.entities.length) {
          setEntities([
            { id: null, label: "All" },
            ...normalized.entities.map((e) => ({
              id: e.entity_id,
              label: e.entity_name,
            })),
          ]);
        }
      } catch (e) {
        setErrorMsg("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, year, selectedCurrency, JSON.stringify(appliedFilters)]);

  /* ================== UI ================== */
  const getEntityLabel = (id) =>
    entities.find((e) => safeId(e.id) === safeId(id))?.label;

  // ✅ ADD THIS BLOCK RIGHT HERE (before FETCH / before return)
  const activeTags = useMemo(() => {
    const tags = [];

    // Period
    if (
      appliedFilters.time_filter &&
      appliedFilters.time_filter !== "all_periods"
    ) {
      const label = TIME_FILTERS.find(
        (t) => t.id === appliedFilters.time_filter,
      )?.label;
      if (label) tags.push({ key: "time_filter", label: `Period: ${label}` });
    }

    // Unit
    if (
      appliedFilters.currency_filter &&
      appliedFilters.currency_filter !== "actualvalue"
    ) {
      const label = CURRENCY_FILTERS.find(
        (c) => c.id === appliedFilters.currency_filter,
      )?.label;
      if (label) tags.push({ key: "currency_filter", label: `Unit: ${label}` });
    }

    // Entity
    if (appliedFilters.entity) {
      tags.push({
        key: "entity",
        label: `Entity: ${getEntityLabel(appliedFilters.entity) || appliedFilters.entity}`,
      });
    }

    // Comparison
    if (appliedFilters.comparity_filter) {
      const label = COMPARITY_FILTERS.find(
        (c) => c.id === appliedFilters.comparity_filter,
      )?.label;
      if (label)
        tags.push({ key: "comparity_filter", label: `Comparison: ${label}` });
    }

    return tags;
  }, [appliedFilters, entities]);

  const removeFilter = (tag) => {
    // remove from draft + applied so UI + API both update
    setDraftFilters((f) => ({
      ...f,
      [tag.key]: tag.key === "entity" ? null : DEFAULT_FILTERS[tag.key],
    }));
    setAppliedFilters((f) => ({
      ...f,
      [tag.key]: tag.key === "entity" ? null : DEFAULT_FILTERS[tag.key],
    }));
  };

  const cashflowNarrative = useMemo(() => buildCashflowNarrative(rows), [rows]);

  /* ================== SORTED ROWS (frontend-only sort) ================== */
  const sortedRows = useMemo(() => {
    if (!rows.length) return rows;
    const { sort_by, sort_order } = sortConfig;
    const asc = sort_order === "asc";

    return [...rows].sort((a, b) => {
      if (sort_by === "period") {
        const cmp = String(a.period).localeCompare(String(b.period));
        return asc ? cmp : -cmp;
      }
      const toNum = (v) => {
        const cleaned = typeof v === "string" ? v.replace(/,/g, "") : v;
        const n = Number(cleaned);
        return Number.isFinite(n) ? n : 0;
      };
      const diff = toNum(a[sort_by]) - toNum(b[sort_by]);
      return asc ? diff : -diff;
    });
  }, [rows, sortConfig]);

  // Same param names the fetch above sends, so a scheduled send reproduces
  // this exact filtered view.
  const scheduleFilters = useMemo(() => ({
    currency_filter: appliedFilters.currency_filter,
    ...(appliedFilters.time_filter !== "all_periods" && { time_filter: appliedFilters.time_filter }),
    ...(appliedFilters.entity && { entity: appliedFilters.entity }),
    ...(appliedFilters.comparity_filter && { comparision: appliedFilters.comparity_filter }),
  }), [appliedFilters]);

  /* ================== CSV EXPORT (mirrors the rendered table exactly,
     including the comparison columns when a comparison filter is applied)
     ================== */
  const csvData = useMemo(() => {
    if (!sortedRows.length) return [];

    if (!hasComparisonSelected) {
      const header = ["METRICS", ...sortedRows.map((r) => r.period)];
      const body = METRICS.map((m) => [
        m.label,
        ...sortedRows.map((r) => r[m.key] ?? ""),
      ]);
      return [header, ...body];
    }

    const header = [
      "METRIC",
      ...sortedRows.flatMap((r) => [
        `${r.period} current`,
        `${r.period} previous`,
        `${r.period} variance`,
      ]),
    ];
    const body = METRICS.map((m) => [
      m.label,
      ...sortedRows.flatMap((r) => {
        const c = r?.comparision || {};
        const cur = r?.[m.key] ?? "";
        const prev = getPrevValue(c, m.key) ?? "";
        const diff = getDiffValue(c, m.key) ?? "";
        return [cur, prev, diff];
      }),
    ]);
    return [header, ...body];
  }, [sortedRows, hasComparisonSelected]);

  /* ================== AI INSIGHTS / COMMENTARY ================== */
  // Every applied filter (unit, period, entity, comparison) changes the data on screen.
  const commentary = useReportCommentary({
    token,
    reportId: "cash_flow",
    year,
    currency: selectedCurrency,
    filters: appliedFilters,
  });

  const insightFilterLabels = useMemo(() => activeTags.map((t) => t.label), [activeTags]);

  const viewKey = `${year}|${selectedCurrency}|${JSON.stringify(appliedFilters)}`;

  const buildInsightsContext = () => {
    if (!rows.length) return "";

    // Chronological by real year/month (not the UI sort order).
    const monthRows = rows
      .filter((r) => r.period !== "total")
      .map((r) => ({ r, p: parsePeriodForAI(r.period) }))
      .sort((a, b) => (a.p ? a.p.y * 100 + a.p.m : 0) - (b.p ? b.p.y * 100 + b.p.m : 0))
      .map(({ r }) => r);
    const totalRow = rows.find((r) => r.period === "total");

    const lineKey = (m) => m.label.toLowerCase().replace(/ /g, "_");
    const toAIRow = (r, label) => {
      const c = r.comparision || {};
      const out = { period: label };
      if (hasComparisonSelected && c.prev_period) out.compared_with = monthLabelForAI(c.prev_period);
      METRICS.forEach((m) => {
        out[lineKey(m)] = hasComparisonSelected
          ? { current: r[m.key], previous: getPrevValue(c, m.key), change: getDiffValue(c, m.key) }
          : r[m.key];
      });
      return out;
    };

    const monthName = (r) => monthLabelForAI(r.period);
    const facts =
      monthRows.length > 1
        ? {
            operating_cash_flow_by_month: rankForAI(monthRows, (r) => r.operating_cf, monthName),
            net_cash_change_by_month: rankForAI(monthRows, (r) => r.net_cash_change, monthName),
            months_with_negative_operating_cash_flow: monthRows
              .filter((r) => (toNumberForAI(r.operating_cf) ?? 0) < 0)
              .map(monthName),
          }
        : undefined;

    return buildReportAIContext({
      valueScale:
        CURRENCY_FILTERS.find((c) => c.id === appliedFilters.currency_filter)?.label || "Actual",
      notes: [
        "Operating cash flow is operating income minus operating expenses, and financing cash flow is the net increase in liability balances (credits minus debits, e.g. new borrowing less repayments); for both, positive values are net cash inflows and negative values are net outflows.",
        "Investing cash flow is the gross amount debited to non-cash asset accounts (asset additions such as purchases), so it is normally positive and is not netted against disposals.",
        "Net cash change is the actual net movement in cash accounts, calculated separately, so it need not equal operating + investing + financing; the 'Total (all periods shown)' row sums every month in the view.",
        hasComparisonSelected &&
          "Each line shows current, previous (the compared_with period) and change = current - previous.",
      ]
        .filter(Boolean)
        .join(" "),
      keyMetrics: metrics && {
        operating_cash_flow: metrics.operating,
        investing_cash_flow: metrics.investing,
        financing_cash_flow: metrics.financing,
        net_cash_flow: metrics.net,
      },
      facts,
      rows: [
        ...monthRows.map((r) => toAIRow(r, monthName(r))),
        ...(totalRow ? [toAIRow(totalRow, "Total (all periods shown)")] : []),
      ],
    });
  };

  /* ================== REFINE WITH AI (LINE-ITEM COMMENTARY) ================== */
  // Same view as the report commentary: every applied filter.
  const lineCommentary = useLineItemCommentary({
    token,
    reportId: "cash_flow",
    year,
    currency: selectedCurrency,
    filters: appliedFilters,
  });

  const [refineLine, setRefineLine] = useState(null);
  const [analyzeTarget, setAnalyzeTarget] = useState(null);
  useEffect(() => {
    setRefineLine(null);
    setAnalyzeTarget(null);
  }, [viewKey]);

  const tableScaleLabel =
    CURRENCY_FILTERS.find((c) => c.id === appliedFilters.currency_filter)?.label || "Actual";

  // Month columns in real chronological order (never the UI sort), no "total".
  const monthRowsForAI = useMemo(
    () =>
      rows
        .filter((r) => toApiPeriodForAI(r.period))
        .sort((a, b) => toApiPeriodForAI(a.period).localeCompare(toApiPeriodForAI(b.period))),
    [rows],
  );

  // One line by month as the table shows it: value, the compared value (the
  // compared period in the comparison view, else the previous month) and change.
  const lineSeriesForAI = (key) => {
    const byPeriod = Object.fromEntries(monthRowsForAI.map((r) => [toApiPeriodForAI(r.period), r]));
    return monthRowsForAI.map((r) => {
      const period = toApiPeriodForAI(r.period);
      const value = toNumberForAI(r[key]);
      if (hasComparisonSelected) {
        const c = r.comparision || {};
        const comparedPeriod = toApiPeriodForAI(c.prev_period);
        return {
          period,
          month: monthLabelForAI(period),
          value,
          compared_period: comparedPeriod,
          compared_with: comparedPeriod ? monthLabelForAI(comparedPeriod) : null,
          previous: toNumberForAI(getPrevValue(c, key)),
          change: toNumberForAI(getDiffValue(c, key)),
        };
      }
      const comparedPeriod = prevMonthForAI(period);
      const previous = byPeriod[comparedPeriod] ? toNumberForAI(byPeriod[comparedPeriod][key]) : null;
      return {
        period,
        month: monthLabelForAI(period),
        value,
        compared_period: comparedPeriod,
        compared_with: monthLabelForAI(comparedPeriod),
        previous,
        change: value !== null && previous !== null ? _round2(value - previous) : null,
      };
    });
  };

  // One line exactly as the table on screen shows it, facts computed in code
  // and the other lines by month for driver context.
  const buildLineItemContext = (lineKey) => {
    if (!METRIC_BY_KEY[lineKey] || !monthRowsForAI.length) return "";
    const series = lineSeriesForAI(lineKey);
    let months;
    let lineFacts;

    if (hasComparisonSelected) {
      months = series.map((m) => ({
        month: m.month,
        compared_with: m.compared_with,
        current: m.value,
        previous: m.previous,
        change: m.change,
      }));
      lineFacts = {
        total_current: _sumOf(months, "current"),
        total_previous: _sumOf(months, "previous"),
        total_change: _sumOf(months, "change"),
        months_increased: months.filter((m) => m.change > 0).map((m) => m.month),
        months_decreased: months.filter((m) => m.change < 0).map((m) => m.month),
        ..._extremes(months, "change", "largest_increase", "largest_decrease"),
      };
    } else {
      months = series.map((m) => ({ month: m.month, value: m.value }));
      const valid = months.filter((m) => m.value !== null);
      const moves = series
        .filter((m) => m.change !== null)
        .map((m) => ({ month: m.month, change_vs_prior_month: m.change }));
      lineFacts = {
        total: _sumOf(months, "value"),
        average: valid.length ? _round2(valid.reduce((acc, m) => acc + m.value, 0) / valid.length) : null,
        ..._extremes(months, "value", "highest_month", "lowest_month"),
        ..._extremes(moves, "change_vs_prior_month", "largest_rise_vs_prior_month", "largest_drop_vs_prior_month"),
        negative_months: valid.filter((m) => m.value < 0).map((m) => m.month),
      };
    }

    const others = METRICS.filter((m) => m.key !== lineKey).map((m) => [lineFieldForAI(m.key), lineSeriesForAI(m.key)]);
    const otherLinesByMonth = series.map((s, i) => ({
      month: s.month,
      ...Object.fromEntries(
        others.map(([field, list]) => [
          field,
          hasComparisonSelected
            ? { current: list[i].value, previous: list[i].previous, change: list[i].change }
            : list[i].value,
        ]),
      ),
    }));

    return JSON.stringify({
      report: "Cash Flow Statement",
      view: hasComparisonSelected ? "Current vs compared period by month" : "Monthly cash flow",
      value_scale: tableScaleLabel,
      notes: [
        CF_LINE_NOTES[lineKey],
        hasComparisonSelected && "change = current - previous (the compared_with period).",
      ]
        .filter(Boolean)
        .join(" "),
      line_item: lineTitle(lineKey),
      line_months: months,
      line_facts: lineFacts,
      other_lines_by_month: otherLinesByMonth,
    });
  };

  /* ================== ANALYZE WITH AI ================== */
  // GL-account-level cash flow behind the ✦ drivers, fetched once per view.
  const accountDetailRef = useRef({ key: null, promise: null });

  const loadAccountDetail = () => {
    if (accountDetailRef.current.key === viewKey) return accountDetailRef.current.promise;
    const get = async (entity) => {
      // Full amounts: the server only rescales values above the unit's
      // threshold, which would mix scales and break the account ranking.
      // The comparison gives each account's compared-period value too.
      const params = new URLSearchParams({
        time_filter: "monthly",
        view_filter: "detailed_view",
        currency_filter: "actualvalue",
        comparision: appliedFilters.comparity_filter || "month_on_month",
      });
      if (entity) params.append("entity", entity);
      const res = await fetch(
        `${API_BASE_URL}/api/v1/company/financial/cashflow_statement_viewmore/${year}/${selectedCurrency}?${params}`,
        { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseCashflowAccounts(await res.json());
    };
    const promise = (async () => {
      // The endpoint's monthly rows carry no entity_id, so its entity filter
      // drops them all — then fall back to every entity and say so.
      if (appliedFilters.entity) {
        const accounts = await get(appliedFilters.entity);
        if (accounts.length) return { accounts, allEntities: false };
      }
      return { accounts: await get(null), allEntities: !!appliedFilters.entity };
    })();
    accountDetailRef.current = { key: viewKey, promise };
    promise.catch(() => {
      if (accountDetailRef.current.promise === promise) accountDetailRef.current = { key: null, promise: null };
    });
    return promise;
  };

  const loadAnalysisContext = async (target) => {
    const lineKey = target.metric;
    const name = lineTitle(lineKey);
    const series = lineSeriesForAI(lineKey);

    // The month to explain: the clicked one, or for a KPI the month that
    // moved the line most.
    const focus =
      target.kind === "kpi"
        ? topByAbs(series.filter((m) => m.change !== null), "change", 1)[0]
        : series.find((m) => m.period === toApiPeriodForAI(target.period));

    let detail = null;
    try {
      detail = await loadAccountDetail();
    } catch (err) {
      console.error("Analyze with AI: cash flow account detail failed", err);
    }
    const accountSeries = accountSeriesForAI(detail?.accounts || [], lineKey);
    const moves = focus ? accountMovesForAI(accountSeries, focus.period, focus.compared_period) : [];
    const accountTotals =
      target.kind === "kpi"
        ? topByAbs(
            accountSeries
              .map((s) => ({
                account: s.account,
                ...(s.line && { line: s.line }),
                total: _round2(series.reduce((acc, m) => acc + (s.byPeriod[m.period]?.[s.key] ?? 0), 0)),
              }))
              .filter((x) => x.total),
            "total",
          )
        : [];

    const focusFacts = focus && {
      month: focus.month,
      ...(target.kind === "cell" && { clicked_value_on_screen: target.value }),
      line_value: focus.value,
      compared_with: focus.compared_with,
      line_value_compared_period: focus.previous,
      change: focus.change,
      other_lines_this_month: Object.fromEntries(
        METRICS.filter((m) => m.key !== lineKey).map((m) => {
          const o = lineSeriesForAI(m.key).find((x) => x.period === focus.period);
          return [lineFieldForAI(m.key), o ? { value: o.value, compared_period: o.previous, change: o.change } : null];
        }),
      ),
    };
    const computedFacts =
      target.kind === "kpi"
        ? {
            kpi: target.title,
            kpi_value_on_screen: target.value,
            line_total_over_view: _sumOf(series, "value"),
            months_in_view: series.length,
            ..._extremes(series, "value", "highest_month", "lowest_month"),
            ...(hasComparisonSelected && {
              total_compared_periods: _sumOf(series, "previous"),
              total_change: _sumOf(series, "change"),
            }),
            ...(focusFacts && { month_that_moved_most: focusFacts }),
          }
        : focusFacts || {};

    const isNet = lineKey === "net_cash_change";
    const accountScale =
      selectedCurrency === "INR"
        ? "Full amounts, except amounts of 1,00,000 or more, which the server returns in lakhs"
        : "Actual (full amounts)";
    const entityNote =
      detail?.allEntities &&
      `Covers ALL entities: the account-level endpoint can't filter by entity, while the table shows ${
        getEntityLabel(appliedFilters.entity) || appliedFilters.entity
      } only, so account figures can differ from the table.`;
    const accountDetail =
      moves.length || accountTotals.length
        ? {
            value_scale: accountScale,
            ...(entityNote && { entity_note: entityNote }),
            ...(isNet && {
              note: "Net cash change is measured on the cash accounts, which the account-level data can't break out, so these are the accounts that moved the operating, investing and financing lines (investing = cash spent on assets, which reduces cash). Treat them as indicative drivers, not a reconciliation.",
            }),
            ...(focus &&
              moves.length && {
                month: focus.month,
                compared_with: focus.compared_with,
                accounts_with_activity: moves.length,
                ...(!isNet && {
                  accounts_total_this_month: _sumOf(moves, "current"),
                  accounts_total_compared_period: _sumOf(moves, "previous"),
                }),
                largest_contributions: topByAbs(moves, "current"),
                largest_changes_vs_compared_period: topByAbs(moves, "change"),
              }),
            ...(accountTotals.length && { largest_account_totals_over_view: accountTotals }),
          }
        : null;

    const context = JSON.stringify({
      report: "Cash Flow Statement",
      table_view: target.mode || (hasComparisonSelected ? "comparison" : "monthly"),
      table_value_scale: tableScaleLabel,
      line_item: name,
      notes: [
        CF_LINE_NOTES[lineKey],
        hasComparisonSelected && "In the comparison view change = current - the compared_with period.",
      ]
        .filter(Boolean)
        .join(" "),
      computed_facts: computedFacts,
      ...(accountDetail
        ? { account_detail: accountDetail }
        : {
            account_detail_unavailable: detail
              ? "No account-level activity was found for this line and month; explain from the table lines only."
              : "Account-level detail could not be loaded; explain from the table lines only.",
          }),
    });

    const money = (key, label, signed) => ({ key, label, type: "money", ...(signed && { signed: true }) });
    const accountCols = [{ key: "account", label: "Account" }, ...(isNet ? [{ key: "line", label: "Line" }] : [])];
    const accountNote = [`Account detail: ${accountScale.toLowerCase()}`, detail?.allEntities && "all entities"]
      .filter(Boolean)
      .join(" · ");
    const supporting = [];
    if (focus && moves.length) {
      const seen = new Set();
      supporting.push({
        title: `Top accounts — ${name}, ${focus.month}`,
        columns: [
          ...accountCols,
          money("current", focus.month),
          money("previous", focus.compared_with || "Previous"),
          money("change", "Change", true),
        ],
        rows: [...topByAbs(moves, "change"), ...topByAbs(moves, "current")].filter((m) => {
          const k = `${m.account}|${m.line || ""}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        }),
        note: accountNote,
      });
    }
    if (accountTotals.length) {
      supporting.push({
        title: `Top accounts — ${name}, all months shown`,
        columns: [...accountCols, money("total", "Total")],
        rows: accountTotals,
        note: accountNote,
      });
    }
    supporting.push({
      title: `${name} by month`,
      columns: [
        { key: "month", label: "Month" },
        money("value", hasComparisonSelected ? "Current" : name),
        money("previous", hasComparisonSelected ? "Compared period" : "Previous month"),
        money("change", "Change", true),
      ],
      rows: series,
      note: tableScaleLabel !== "Actual" ? `Values in ${tableScaleLabel.toLowerCase()}` : undefined,
    });

    return { context, supporting };
  };

  // ✦ pinned to the cell's top-right corner (the cell is `relative`), next to
  // the end of the right-aligned number, so it doesn't widen every column.
  const analyzeCellButton = (metric, r, mode, value) => {
    const period = toApiPeriodForAI(r.period);
    if (!period) return null;
    const month = monthLabelForAI(period);
    const name = lineTitle(metric.key);
    const comparedWith = r?.comparision?.prev_period ? monthLabelForAI(r.comparision.prev_period) : null;
    const title = mode === "comparison" ? `${name} — ${month} vs ${comparedWith || "prior period"}` : `${name} — ${month}`;
    const body =
      mode === "comparison"
        ? `AI explains what drove the change versus ${comparedWith || "the previous period"}, with supporting data, and answers follow-up questions.`
        : "AI breaks down what drove this number, with supporting data, and answers follow-up questions.";
    return (
      <AnalyzeButton
        onClick={() =>
          setAnalyzeTarget({ kind: "cell", component: "table", metric: metric.key, period, mode, title, value })
        }
        title={`Explain ${name} for ${month} with AI`}
        tooltip={{ heading: "Explain with AI", context: `${name} · ${month} · ${value}`, body }}
        className="absolute top-0 right-0 opacity-70 hover:opacity-100 focus:opacity-100"
      />
    );
  };

  const analyzeKpi = (metric, label, value) =>
    setAnalyzeTarget({
      kind: "kpi",
      component: "kpi",
      metric,
      mode: hasComparisonSelected ? "comparison" : "monthly",
      title: label,
      value,
    });

  const renderLineLabel = (m) => (
    <span className="flex items-center justify-between gap-2">
      {m.label}
      <LineItemAIButton
        label={m.label}
        noun="variance commentary"
        hasCommentary={!!lineCommentary.byLine[m.key]}
        onClick={() => setRefineLine({ key: m.key, label: m.label })}
      />
    </span>
  );

  // The commentary shown under the report, offered with the CSV download.
  const exportCommentary = collectCommentary({
    lineTitle: "Cash Flow Line Commentary",
    lines: METRICS,
    byLine: lineCommentary.byLine,
    reportItems: commentary.items,
  });

  return (
    <ReportsLayout>
      <main className="flex-1 min-w-0 bg-white p-3 rounded-xl shadow-md">
        {/* HEADER */}
        <div className="flex justify-between items-center gap-3 mb-2">
          <div>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h2 className="text-lg font-semibold text-sky-900">
                Cash Flow Statement
              </h2>
              <p className="text-s text-sky-600">
                Tracks inflow and outflow of cash
              </p>
            </div>
            <p className="text-s bg-yellow-100 text-sky-900 px-2 py-0.5 rounded-md mt-1 inline-block">
              <strong>Note :</strong> click <BsStars className="inline text-sky-600 align-[-2px]" /> next to a value
              for an AI explanation · click <BsChatLeftText className="inline text-sky-600 align-[-2px]" /> next to a
              line for AI commentary
            </p>
          </div>

          <Link
            to="/cash-flow-dashboard"
            className="flex shrink-0 items-center whitespace-nowrap px-3 py-2 text-x text-white bg-sky-900 rounded-lg"
          >
            View More <FaArrowRightToBracket className="ml-1" />
          </Link>
        </div>

        {/* TAGS + ACTIONS */}
        <div className="flex items-start justify-between gap-3 mb-3" ref={ref}>
          {/* LEFT: ACTIVE TAGS */}
          <div className="flex flex-wrap items-center gap-2 min-h-[34px]">
            {activeTags.length === 0 ? (
              <span className="text-x text-sky-600">No filters applied</span>
            ) : (
              activeTags.map((t) => (
                <span
                  key={`${t.key}-${t.label}`}
                  className="flex items-center gap-2 px-3 py-1 text-x rounded-full bg-sky-800 text-white"
                >
                  {t.label}
                  <button
                    onClick={() => removeFilter(t)}
                    className="text-sky-200 hover:text-white font-bold"
                    title="Remove"
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>

          {/* FILTER BUTTON + TAGS */}
          <div className="flex justify-end gap-2 items-center" ref={ref}>
            <div className="relative">
              <button
                onClick={() => setOpen(!open)}
                aria-label="Filters"
                className="relative group flex items-center gap-1 px-3 py-2.5 text-x font-medium bg-sky-100 text-sky-800 rounded-lg border border-sky-200 hover:bg-sky-200"
              >
                <FiFilter size={14} />
                <ActionHoverLabel>Filters</ActionHoverLabel>
                {hasPendingChanges && (
                  <span className="ml-1 px-2 py-[2px] rounded-full bg-amber-200 text-amber-900 text-[10px] font-bold">
                    Pending 
                  </span>
                )}
              </button>

              <AnimatePresence>
                {open && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute right-0 mt-2 w-[420px] bg-sky-50 border border-sky-200 rounded-xl shadow-lg z-50"
                  >
                    <div className="p-4 grid grid-cols-2 gap-3 text-x">
                      <SelectId
                        label="Period"
                        value={draftFilters.time_filter}
                        options={TIME_FILTERS}
                        onChange={(v) =>
                          setDraftFilters((f) => ({ ...f, time_filter: v }))
                        }
                      />

                      <SelectId
                        label="Unit"
                        value={draftFilters.currency_filter}
                        options={CURRENCY_FILTERS}
                        onChange={(v) =>
                          setDraftFilters((f) => ({
                            ...f,
                            currency_filter: v,
                          }))
                        }
                      />

                      <SelectId
                        label="Entity"
                        value={draftFilters.entity}
                        options={entities}
                        onChange={(v) =>
                          setDraftFilters((f) => ({ ...f, entity: v }))
                        }
                      />

                      <SelectId
                        label="Comparison"
                        value={draftFilters.comparity_filter}
                        options={COMPARITY_FILTERS}
                        onChange={(v) =>
                          setDraftFilters((f) => ({
                            ...f,
                            comparity_filter: v,
                          }))
                        }
                      />
                    </div>

                    <div className="p-3 border-t border-sky-200 flex gap-2">
                      <button
                        onClick={resetAll}
                        className="w-1/2 py-2 text-x bg-slate-900 text-white rounded-lg"
                      >
                        Reset All
                      </button>

                      <button
                        onClick={applyFilters}
                        disabled={!hasPendingChanges}
                        className={`w-1/2 py-2 text-x rounded-lg font-semibold ${
                          hasPendingChanges
                            ? "bg-sky-900 text-white"
                            : "bg-sky-200 text-sky-600 cursor-not-allowed"
                        }`}
                      >
                        Apply
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <ExportMenu
              label="CSV"
              commentaryCount={commentaryCount(exportCommentary)}
              onExport={(include) =>
                downloadCsv(csvWithCommentary(csvData, exportCommentary, include), `CashFlow_${year}_${selectedCurrency}.csv`)
              }
              className="relative group flex items-center px-3 py-2.5 text-x bg-sky-100 text-sky-800 rounded-lg border border-sky-200 hover:bg-sky-200"
            />

            <AddAutomation
              reportType="cash_flow_statement"
              reportLabel="Cash Flow Statement"
              year={year}
              currency={selectedCurrency}
              filters={scheduleFilters}
              iconOnly
            />

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
                  sortConfig.sort_by !== "period" || sortConfig.sort_order !== "asc"
                    ? "bg-sky-900 text-white border-sky-900"
                    : "bg-sky-100 text-sky-800 border-sky-200 hover:bg-sky-200"
                }`}
              >
                <FiFilter size={13} />
                <ActionHoverLabel>Sort</ActionHoverLabel>
                {(sortConfig.sort_by !== "period" || sortConfig.sort_order !== "asc") && (
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
                        <option value="period">Period (Chronological)</option>
                        <option value="operating_cf">Operating Cash Flow</option>
                        <option value="investing_cf">Investing Cash Flow</option>
                        <option value="financing_cf">Financing Cash Flow</option>
                        <option value="net_cash_change">Net Cash Change</option>
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
                      onClick={() => {
                        setSortConfig({ sort_by: "period", sort_order: "asc" });
                        setSortOpen(false);
                      }}
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
              reportId="cash_flow"
              showTableHelp
              insights={{
                commentary,
                reportLabel: "Cash Flow Statement",
                filterLabels: insightFilterLabels,
                viewKey,
                buildContext: buildInsightsContext,
                disabled: loading || !rows.length,
              }}
            />
          </div>
        </div>

        {/* TABLES + METRICS */}
        {loading && <TableSkeleton />}

        {/* NORMAL TABLE (Metrics Row, Period Columns) */}
        {!loading && rows.length > 0 && !hasComparisonSelected && (
          <div className="report-table-scroll overflow-auto mt-4 border border-sky-200 rounded-lg bg-white">
            <table className="min-w-[1100px] w-full text-x text-sky-900">
              <thead className="bg-sky-900 text-white">
                <tr>
                  <th className="px-3 py-1.5 text-left sticky left-0 bg-sky-900">
                    METRICS
                  </th>
                  {sortedRows.map((r) => (
                    <th key={r.period} className="px-3 py-1.5 text-right">
                      {r.period}
                    </th>
                  ))}
                  <th className="px-3 py-1.5 text-left whitespace-nowrap">
                    Insights
                  </th>
                  <th className="px-3 py-1.5 text-left whitespace-nowrap">
                    Recommendation
                  </th>
                </tr>
              </thead>
              <tbody>
                {METRICS.map((metric) => {
                  // Saved "Refine with AI" commentary (one per line for this
                  // view, so always the latest) wins over the rule-based text.
                  const saved = lineCommentary.byLine[metric.key];
                  const insightText = saved?.explanation || cashflowNarrative[metric.key] || "—";
                  return (
                  <tr key={metric.key} className="border-b">
                    <td className="px-3 py-3 font-semibold bg-sky-50 w-[10%] sticky left-0 z-10">
                      {renderLineLabel(metric)}
                    </td>
                    {sortedRows.map((r) => (
                      <td
                        key={`${metric.key}-${r.period}`}
                        className="relative px-3 py-3 text-right"
                      >
                        {analyzeCellButton(metric, r, "monthly", formatDollar(r[metric.key]))}
                        {formatDollar(r[metric.key])}
                      </td>
                    ))}
                    <td className="px-3 py-2 w-[380px] min-w-[380px] text-sky-700">
                      <p className="line-clamp-2 leading-snug" title={insightText}>
                        {saved?.explanation && (
                          <BsChatLeftTextFill
                            size={11}
                            className="inline mr-1 align-[-1px] text-emerald-600"
                            aria-label="Saved AI commentary"
                          />
                        )}
                        {insightText}
                      </p>
                    </td>
                    <td className="px-3 py-2 w-[340px] min-w-[340px] text-sky-700">
                      {saved?.recommendation ? (
                        <p className="line-clamp-2 leading-snug" title={saved.recommendation}>
                          {saved.recommendation}
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRefineLine({ key: metric.key, label: metric.label })}
                          className="inline-flex items-center gap-1 text-sky-500 hover:text-sky-800 whitespace-nowrap"
                        >
                          <BsChatLeftText size={12} /> Get AI recommendation
                        </button>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ====== YOUR COMPARISON TABLE BLOCK (UNCHANGED STYLE) ====== */}
        {!loading && rows.length > 0 && hasComparisonSelected && (
          <div className="report-table-scroll overflow-auto mt-3 border border-sky-200 rounded-lg bg-white">
            <table className="min-w-[1200px] w-full text-x">
              <thead className="z-20">
                <tr className="bg-sky-900 text-white">
                  <th
                    rowSpan={2}
                    className="px-3 py-1.5 text-left whitespace-nowrap sticky left-0 z-30 bg-sky-900"
                  >
                    METRIC
                  </th>
                  {sortedRows.map((r) => (
                    <th
                      key={r.period}
                      colSpan={3}
                      className="px-3 py-1.5 text-right border-l border-white/20 whitespace-nowrap"
                    >
                      {r.period} VS {r?.comparision?.prev_period || "—"}
                    </th>
                  ))}
                </tr>

                <tr className="bg-sky-800 text-white">
                  {sortedRows.map((r, idx) => (
                    <React.Fragment key={`${r.period}-${idx}-sub`}>
                      <th className="px-3 py-1 text-right border-l border-white/20 whitespace-nowrap">
                        <HeaderDates top="Current" bottom="Value" />
                      </th>
                      <th className="px-3 py-1 text-right whitespace-nowrap">
                        <HeaderDates top="Previous" bottom="Value" />
                      </th>
                      <th className="px-3 py-1 text-right whitespace-nowrap">
                        <HeaderDates top="Variance" bottom="Diff" />
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>

              <tbody>
                {METRICS.map((m) => (
                  <tr key={m.key} className="border-b">
                    <td className="px-3 py-3 font-semibold text-sky-900 whitespace-nowrap bg-sky-50 sticky left-0 z-10">
                      {renderLineLabel(m)}
                    </td>

                    {sortedRows.map((r, i) => {
                      const c = r?.comparision || {};
                      const cur = r?.[m.key];
                      const prev = getPrevValue(c, m.key);
                      const diff = getDiffValue(c, m.key);
                      const ui = getVarianceUI(diff);

                      return (
                        <React.Fragment key={`${r.period}-${m.key}-${i}`}>
                          <td className="px-3 py-3 whitespace-nowrap border-l border-sky-100 text-right text-sky-900">
                            {formatDollar(cur)}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-right text-sky-900">
                            {formatDollar(prev)}
                          </td>
                          <td
                            className={`relative px-3 py-3 whitespace-nowrap text-right ${ui.bg}`}
                          >
                            {analyzeCellButton(m, r, "comparison", formatDollar(diff))}
                            <span
                              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full  text-[11p] font-semibold ${ui.pill}`}
                            >
                              <span className="text-[10px]">{ui.arrow}</span>
                              {formatDollar(diff)}
                            </span>
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== KEY METRICS ===== */}
        {metrics && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-6 bg-white border border-sky-200 rounded-xl p-4 shadow-sm"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 space-y-3">
                <h3 className="text-s font-semibold text-sky-900">
                  Key Cash Flow Metrics
                </h3>
                <MetricRow
                  label="Operating Cash Flow"
                  value={metrics.operating}
                  onAnalyze={() => analyzeKpi("operating_cf", "Operating Cash Flow", formatDollar(metrics.operating))}
                />
                <MetricRow
                  label="Investing Cash Flow"
                  value={metrics.investing}
                  onAnalyze={() => analyzeKpi("investing_cf", "Investing Cash Flow", formatDollar(metrics.investing))}
                />
                <MetricRow
                  label="Financing Cash Flow"
                  value={metrics.financing}
                  onAnalyze={() => analyzeKpi("financing_cf", "Financing Cash Flow", formatDollar(metrics.financing))}
                />
                <MetricRow
                  label="Net Cash Flow"
                  value={metrics.net}
                  onAnalyze={() => analyzeKpi("net_cash_change", "Net Cash Flow", formatDollar(metrics.net))}
                />
              </div>

              <div className="bg-sky-50 md:col-span-2 border border-sky-200 rounded-lg p-3 flex flex-col justify-center gap-2">
                <h4 className="text-x font-semibold text-sky-900 mb-1">
                  Executive Financial Insight
                </h4>
                {cashflowNarrative.executive.map((para, i) => (
                  <p key={i} className="text-s text-sky-800 leading-relaxed">
                    {para}
                  </p>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {!loading && rows.length > 0 && (
          <LineItemCommentary
            title="Cash Flow Line Commentary"
            lineCommentary={lineCommentary}
            lines={METRICS}
            onRefine={(m) => setRefineLine({ key: m.key, label: m.label })}
          />
        )}

        {!loading && <ReportCommentary commentary={commentary} />}

        <LineItemRefineWithAI
          line={refineLine}
          onClose={() => setRefineLine(null)}
          lineCommentary={lineCommentary}
          reportLabel="Cash Flow Statement"
          filterLabels={insightFilterLabels}
          buildContext={buildLineItemContext}
        />

        <AnalyzeWithAI
          target={analyzeTarget}
          onClose={() => setAnalyzeTarget(null)}
          token={token}
          reportId="cash_flow"
          reportLabel="Cash Flow Statement"
          year={year}
          currency={selectedCurrency}
          filterLabels={insightFilterLabels}
          loadContext={loadAnalysisContext}
          onAddToReport={({ title, text }) =>
            commentary.addItems([{ title, text, category: "variance", source: "ai" }])
          }
        />

        {/* Hover help for the ✦ and commentary buttons in the tables & KPIs */}
        <AIHelpTooltip />
      </main>
    </ReportsLayout>
  );
}

/* ================= SMALL COMPONENTS ================= */

const SelectId = ({ label, value, options, onChange }) => (
  <div>
    <label className="block mb-1 text-sky-700">{label}</label>
    <select
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "") return onChange(null);
        const num = Number(v);
        onChange(Number.isNaN(num) ? v : num);
      }}
      className="w-full border border-sky-200 rounded p-2 bg-white"
    >
      {options.map((o) => (
        <option key={o.id ?? "all"} value={o.id ?? ""}>
          {o.label}
        </option>
      ))}
    </select>
  </div>
);

const HeaderDates = ({ top, bottom }) => (
  <div className="flex flex-col leading-tight items-end">
    <span className=" text-[11p] text-white/80">{top}</span>
    <span className="text-[12px] font-semibold">{bottom}</span>
  </div>
);

const MetricRow = ({ label, value, onAnalyze }) => {
  const n = Number(value);
  const isNum = Number.isFinite(n);
  const color =
    isNum && n > 0
      ? "text-green-600"
      : isNum && n < 0
        ? "text-red-600"
        : "text-sky-900";

  return (
    <div className="flex justify-between items-center text-s">
      <span className="text-sky-700">
        {label}
        {onAnalyze && (
          <AnalyzeButton
            onClick={onAnalyze}
            title={`Explain ${label} with AI`}
            tooltip={{
              heading: "Explain with AI",
              context: `${label} · ${formatDollar(value)}`,
              body: "AI explains what's behind this figure, with supporting data, and answers follow-up questions.",
            }}
            className="ml-1 opacity-70 hover:opacity-100 focus:opacity-100"
          />
        )}
      </span>
      <span className={`font-medium ${color}`}>{formatDollar(value)}</span>
    </div>
  );
};

const AIDriverText = ({ messages }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!messages?.length) return;
    const t = setInterval(
      () => setIndex((i) => (i + 1) % messages.length),
      3000,
    );
    return () => clearInterval(t);
  }, [messages]);

  return (
    <motion.div
      key={index}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="text-s font-medium bg-gradient-to-r from-sky-500 to-purple-500 bg-clip-text text-transparent"
    >
      {messages[index]}
    </motion.div>
  );
};
