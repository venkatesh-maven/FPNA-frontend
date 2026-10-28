// BudgetPnLStatement.jsx — "P&L Statement" for the AI-Powered Budget module.
//
// No new backend work: this reuses the already-live GET /api/v1/budget/overview/{year}
// endpoint (same one BudgetOverview.jsx calls) and re-shapes its revenue_trend/
// workforce_trend/opex_trend/capex_trend arrays into a period-by-period statement,
// mirroring the layout of Forecasting's PnLForecastReport.jsx (sticky header/first
// column, Total column, bold subtotal rows with a divider above).
//
// Important data-model gap (see overview_controller.py): the Budget module has no
// COGS/cost-of-sales concept, so a real Gross Profit line cannot be computed from
// existing data — only Revenue, Payroll, Operating Expense and a resulting Net
// Operating Income (Revenue - Payroll - Opex) are derivable. CAPEX is a balance-sheet
// item (excluded from net income, same convention as GET /budget/review) and is shown
// as a separate memo row for context only.
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  FiRefreshCw, FiPrinter, FiTrendingUp, FiTrendingDown, FiDollarSign, FiUsers, FiBriefcase, FiArrowUp, FiArrowDown,
} from "react-icons/fi";
import { BudgetYearContext } from "../../context/BudgetYearContext";
import { AuthContext } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config/config";
import {
  PageHeader, KpiRow, EmptyState, parseMoney, CURRENCY_FILTER_OPTIONS, displayPeriods, bucketMonths, proportionalSplit,
} from "./budgetHelpers";
import TableSkeleton from "../Skeleton/TableSkeleton";

// Same Monthly/Quarterly/Annual grouping every other Budget page's Planning
// Frequency uses (see budgetHelpers' displayPeriods/bucketMonths) — applied
// here purely as a display filter (not persisted/backend-driven), since the
// overview endpoint only ever returns monthly-grain trend data.
const PERIOD_VIEW_OPTIONS = ["Monthly", "Quarterly", "Annual"];

// Forecast overlays Forecasting's live pnl-forecast endpoint (real monthly
// data). Actual overlays GET /budget/overview's per-module `prior_year_actual`
// (added there specifically for this — see overview_controller.py) — that
// figure is annual-only (no monthly GL breakdown exists anywhere in the
// Budget module), so its monthly comparison line is an ESTIMATE: the annual
// actual is spread across months using the current Budget's own monthly
// shape as weights, via the same proportionalSplit() helper OpexBudgeting.jsx
// already uses for spreading a quarter/year edit across its months. This
// assumes prior year had similar seasonality to this year's budget — not
// exact, but far more useful than only showing a flat annual number.
const COMPARISON_OPTIONS = ["None", "Actual", "Forecast"];

const API_BASE = `${API_BASE_URL}/api/v1/budget`;
const FORECAST_API_BASE = `${API_BASE_URL}/api/v1/forecasting/managemet`;

// Re-projects a {period -> value} map onto `periods`' order, so a second
// series (Forecast) lines up positionally with the Budget series even if the
// two responses don't return periods in the same order/count.
function alignToPeriods(map, periods) {
  return periods.map((p) => (Object.prototype.hasOwnProperty.call(map, p) ? map[p] : null));
}

// GET /budget/overview/{year} can take 7-15s on a cache miss (real GL/DB
// compute, not a frontend issue — confirmed with repeated direct timing
// against the live API). A single transient network blip on a call that
// slow otherwise surfaces as a hard "Failed to fetch" on first load, so this
// retries once after a short pause before giving up.
async function fetchWithRetry(url, options, retries = 1, delayMs = 1500) {
  try {
    return await fetch(url, options);
  } catch (e) {
    if (retries <= 0) throw e;
    await new Promise((r) => setTimeout(r, delayMs));
    return fetchWithRetry(url, options, retries - 1, delayMs);
  }
}

// Renders one period's value as either a single "Budget" cell (no comparison
// active) or a grouped Budget | Actual-or-Forecast | Variance% triple of
// cells (comparison active) — matching the column header's own single-vs-
// grouped layout below. `cv == null` (that period/bucket genuinely has no
// comparable data) renders "—" for the compare/variance cells rather than a
// misleading value. `unavailableNote`, when set, replaces the whole
// compare+variance pair with a single merged, explicitly-labeled cell — used
// for rows that have NO comparison data source at all (vs. just a gap in one
// period), so it reads as "not tracked" rather than "still loading"/"broken".
function ValueCells({ v, cv, hasCompare, fmtScaled, bold, unavailableNote }) {
  const mainCls = `text-right px-4 py-2.5 whitespace-nowrap tabular-nums ${bold ? "font-bold" : ""} ${v < 0 ? "text-red-600" : "text-sky-900"}`;
  if (!hasCompare) return <td className={mainCls}>{fmtScaled(v)}</td>;

  if (unavailableNote) {
    return (
      <>
        <td className={`${mainCls} border-l border-sky-100`}>{fmtScaled(v)}</td>
        <td colSpan={2} className="text-center px-3 py-2.5 whitespace-nowrap text-slate-400 italic text-x" title={unavailableNote}>
          {unavailableNote}
        </td>
      </>
    );
  }

  const diffPct = cv != null && cv !== 0 ? ((v - cv) / Math.abs(cv)) * 100 : null;
  return (
    <>
      <td className={`${mainCls} border-l border-sky-100`}>{fmtScaled(v)}</td>
      <td className={`text-right px-3 py-2.5 whitespace-nowrap tabular-nums text-slate-500 ${bold ? "font-semibold" : ""}`}>
        {cv != null ? fmtScaled(cv) : "—"}
      </td>
      <td className={`text-right px-3 py-2.5 whitespace-nowrap tabular-nums text-x ${diffPct == null ? "text-slate-300" : diffPct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
        {diffPct != null ? (
          <span className="inline-flex items-center gap-0.5 justify-end">
            {diffPct >= 0 ? <FiArrowUp size={10} /> : <FiArrowDown size={10} />}{Math.abs(diffPct).toFixed(1)}%
          </span>
        ) : "—"}
      </td>
    </>
  );
}

// Same `[{period, <field>}, ..., {position, chart_type, enableordisable}]` shape
// BudgetOverview.jsx's parseTrend() unpacks — the last entry is widget config, not data.
function parseTrend(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return { periods: [], values: [] };
  const points = arr.slice(0, -1);
  const field = Object.keys(points[0] || {}).find((k) => k !== "period");
  return {
    periods: points.map((p) => p.period),
    values: points.map((p) => parseMoney(p[field]) || 0),
  };
}

const BudgetPnLStatement = () => {
  const { token } = useContext(AuthContext);
  const { budgetYear, fiscalYearStartMonth } = useContext(BudgetYearContext);
  const year = `FY${budgetYear}`;

  const [currencyFilter, setCurrencyFilter] = useState("actualvalue");
  const [periodView, setPeriodView] = useState("Monthly");
  const [comparison, setComparison] = useState("None");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [series, setSeries] = useState({ revenue: [], payroll: [], opex: [], capex: [] });
  // Raw modules[] from GET /budget/overview — carries prior_year_actual per
  // module, kept regardless of which Compare option is active so switching
  // to "Actual" derives from data already in hand instead of refetching.
  const [moduleTotals, setModuleTotals] = useState([]);
  // Forecast comparison series, aligned to `periods`. null = not loaded /
  // not applicable (comparison !== "Forecast", or the forecast fetch failed).
  const [forecast, setForecast] = useState(null);
  // True only while the (separate, comparison-only) Forecast request is in
  // flight — lets the compare columns show a "Loading…" cell instead of
  // either stale data or an "unavailable" note while the fetch is pending.
  const [forecastLoading, setForecastLoading] = useState(false);

  const fmtScaled = useCallback((n) => {
    if (n == null || n === "") return "—";
    const num = typeof n === "string" ? Number(n.replace(/,/g, "")) : n;
    if (!Number.isFinite(num)) return "—";
    const dp = currencyFilter === "actualvalue" ? 0 : 2;
    const sign = num < 0 ? "-" : "";
    return `${sign}$${Math.abs(num).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
  }, [currencyFilter]);

  // GET /budget/overview/{year} is the slow call (7-15s on a cache miss — see
  // fetchWithRetry's note above). It depends only on budgetYear/currencyFilter,
  // NOT on `comparison` — so toggling the Compare dropdown must never re-run
  // this, only the (cheap, independent) comparison fetch below. Previously a
  // single combined fetchData() re-ran this full request on every Compare
  // change, needlessly paying its worst-case latency just to flip a filter.
  const fetchOverview = useCallback(async () => {
    setError(null);
    try {
      const authHeaders = { Authorization: `Bearer ${token}`, accept: "application/json" };
      const res = await fetchWithRetry(`${API_BASE}/overview/${budgetYear}?currency_filter=${currencyFilter}`, { headers: authHeaders });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || `Request failed (${res.status})`);
      }
      const data = await res.json();
      const revenue = parseTrend(data.revenue_trend);
      const payroll = parseTrend(data.workforce_trend);
      const opex = parseTrend(data.opex_trend);
      const capex = parseTrend(data.capex_trend);
      const nextPeriods = revenue.periods.length ? revenue.periods : payroll.periods;
      setPeriods(nextPeriods);
      setSeries({ revenue: revenue.values, payroll: payroll.values, opex: opex.values, capex: capex.values });
      // Kept regardless of the current Compare selection — switching to
      // "Actual" later derives from this without a second round trip.
      setModuleTotals(data.modules || []);
      return true;
    } catch (e) {
      setError(e.message || "Failed to load the P&L Statement.");
      toast.error("Failed to load the P&L Statement");
      return false;
    }
  }, [budgetYear, token, currencyFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchOverview().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchOverview]);

  // Forecast comparison: Forecasting's own live P&L endpoint, fetched only
  // when actually selected and independently of the overview fetch above.
  // `year` here must be `budgetYear` itself (NOT budgetYear-1, which is what
  // Forecasting's own PnLForecastReport.jsx passes for its own "nowcast the
  // year in progress" use case) — both endpoints build their periods from
  // the identical fiscal_year_periods(year, start_month), so year=budgetYear
  // is what lines the two series up on the same calendar months.
  const fetchForecastComparison = useCallback(async () => {
    if (comparison !== "Forecast" || periods.length === 0) { setForecast(null); return; }
    setForecastLoading(true);
    try {
      const authHeaders = { Authorization: `Bearer ${token}`, accept: "application/json" };
      const fRes = await fetchWithRetry(`${FORECAST_API_BASE}/pnl-forecast/${budgetYear}/USD?currency_filter=${currencyFilter}&period_filter=monthly`, { headers: authHeaders });
      if (fRes.ok) {
        const fdata = await fRes.json();
        const rows = Array.isArray(fdata.pnl_forecast) ? fdata.pnl_forecast : [];
        const revMap = {}, opexMap = {};
        rows.forEach((r) => { revMap[r.period] = parseMoney(r.revenue) || 0; opexMap[r.period] = parseMoney(r.operating_expense) || 0; });
        setForecast({ revenue: alignToPeriods(revMap, periods), opex: alignToPeriods(opexMap, periods) });
      } else {
        setForecast(null);
        toast.error("Couldn't load Forecast comparison data");
      }
    } catch (e) {
      setForecast(null);
      toast.error("Couldn't load Forecast comparison data");
    } finally {
      setForecastLoading(false);
    }
  }, [comparison, budgetYear, token, currencyFilter, periods]);

  useEffect(() => {
    fetchForecastComparison();
  }, [fetchForecastComparison]);

  // Actual (prior-year-actual) comparison is annual-only figures per module,
  // already present in `moduleTotals` from the overview fetch — no extra
  // request needed, so this just derives it whenever Compare is "Actual".
  const actualPriorYear = useMemo(() => {
    if (comparison !== "Actual") return null;
    const byKey = {};
    moduleTotals.forEach((m) => { byKey[m.key] = parseMoney(m.prior_year_actual); });
    if (byKey.revenue == null || byKey.workforce == null || byKey.opex == null) return null;
    const totalOpex = byKey.workforce + byKey.opex;
    return {
      revenue: byKey.revenue, payroll: byKey.workforce, opex: byKey.opex,
      totalOpex, netIncome: byKey.revenue - totalOpex, capex: byKey.capex ?? null,
    };
  }, [comparison, moduleTotals]);

  // Defensive fallback for an older/un-upgraded backend that doesn't return
  // prior_year_actual per module yet.
  useEffect(() => {
    if (comparison === "Actual" && moduleTotals.length > 0 && actualPriorYear == null) {
      toast.info("Actual comparison data isn't available from this API yet.");
    }
  }, [comparison, moduleTotals, actualPriorYear]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOverview();
    if (comparison === "Forecast") await fetchForecastComparison();
    setRefreshing(false);
  };

  const sum = (arr) => arr.reduce((a, b) => a + (Number(b) || 0), 0);
  const n = periods.length;
  const totalOpexRow = Array.from({ length: n }, (_, i) => (series.payroll[i] || 0) + (series.opex[i] || 0));
  const netIncomeRow = Array.from({ length: n }, (_, i) => (series.revenue[i] || 0) - totalOpexRow[i]);

  const totalRevenue = sum(series.revenue);
  const totalPayroll = sum(series.payroll);
  const totalOpex = sum(series.opex);
  const totalOperatingExpense = totalPayroll + totalOpex;
  const netOperatingIncome = totalRevenue - totalOperatingExpense;
  const totalCapex = sum(series.capex);
  const operatingMarginPct = totalRevenue ? (netOperatingIncome / totalRevenue) * 100 : 0;

  // Monthly periods -> the columns actually rendered, per the Period filter.
  // "Monthly" passes `periods` straight through; "Quarterly"/"Annual" collapse
  // them into fiscal buckets (Q1 FY.../FY...) and each bucket's value is the
  // sum of the months it covers.
  const displayCols = useMemo(
    () => displayPeriods(periodView, fiscalYearStartMonth, budgetYear, periods),
    [periodView, fiscalYearStartMonth, budgetYear, periods],
  );
  const aggregate = useCallback((values) => displayCols.map((label) => {
    const months = bucketMonths(periodView, fiscalYearStartMonth, budgetYear, label);
    return months.reduce((s, m) => {
      const idx = periods.indexOf(m);
      return s + (idx >= 0 ? (values[idx] || 0) : 0);
    }, 0);
  }), [displayCols, periodView, fiscalYearStartMonth, budgetYear, periods]);

  // Same bucketing as aggregate(), but for a comparison series that may have
  // gaps (a period the Forecast endpoint didn't return) — a bucket with no
  // real data anywhere in it stays null so the cell renders "—" instead of a
  // misleading $0.
  const aggregateCompare = useCallback((values) => {
    if (!values) return null;
    return displayCols.map((label) => {
      const months = bucketMonths(periodView, fiscalYearStartMonth, budgetYear, label);
      let s = 0, any = false;
      months.forEach((m) => {
        const idx = periods.indexOf(m);
        const v = idx >= 0 ? values[idx] : null;
        if (v != null) { s += v; any = true; }
      });
      return any ? s : null;
    });
  }, [displayCols, periodView, fiscalYearStartMonth, budgetYear, periods]);

  const sumRaw = (arr) => (arr || []).reduce((s, v) => s + (v || 0), 0);
  const forecastRevenueCols = comparison === "Forecast" ? aggregateCompare(forecast?.revenue) : null;
  const forecastOpexCols = comparison === "Forecast" ? aggregateCompare(forecast?.opex) : null;
  const forecastRevenueTotal = forecast ? sumRaw(forecast.revenue) : null;
  const forecastOpexTotal = forecast ? sumRaw(forecast.opex) : null;
  // Forecasting has no payroll figure anywhere (confirmed — the one endpoint
  // that could supply it is a 5MB+ response with numbers ~3x Budget's own
  // Workforce Planning scope, unusable). Total Operating Expenses and Net
  // Operating Income under Forecast are therefore Opex-only estimates —
  // Total Opex forecast = Opex forecast alone (excludes payroll), Net Income
  // forecast = Revenue forecast − Opex forecast (excludes payroll too). Real
  // numbers, but not the same scope as Budget's own totals (which include
  // payroll) — the Payroll row itself and CAPEX stay blank since there's
  // genuinely zero forecast data for either.
  const forecastNetIncomeCols = (forecastRevenueCols && forecastOpexCols)
    ? forecastRevenueCols.map((r, i) => (r != null && forecastOpexCols[i] != null ? r - forecastOpexCols[i] : null))
    : null;
  const forecastNetIncomeTotal = (forecastRevenueTotal != null && forecastOpexTotal != null)
    ? forecastRevenueTotal - forecastOpexTotal : null;

  // Actual is a single annual figure (no monthly GL breakdown exists), so its
  // monthly comparison line is an ESTIMATE: spread the annual actual across
  // the raw months using the current Budget's own monthly shape as weights
  // (same proportionalSplit() convention OpexBudgeting.jsx already uses for
  // spreading a quarter/year edit across months), then run it through the
  // same aggregate() bucketing as the Budget series so Monthly/Quarterly/
  // Annual all stay consistent — the Annual bucket always reproduces the
  // exact annual actual figure, since proportionalSplit's output sums to it.
  const spreadActual = (annualValue, weights) => {
    if (annualValue == null) return null;
    return aggregate(proportionalSplit(annualValue, weights));
  };
  const actualRevenueCols = comparison === "Actual" ? spreadActual(actualPriorYear?.revenue, series.revenue) : null;
  const actualPayrollCols = comparison === "Actual" ? spreadActual(actualPriorYear?.payroll, series.payroll) : null;
  const actualOpexCols = comparison === "Actual" ? spreadActual(actualPriorYear?.opex, series.opex) : null;
  const actualTotalOpexCols = comparison === "Actual" ? spreadActual(actualPriorYear?.totalOpex, totalOpexRow) : null;
  const actualNetIncomeCols = comparison === "Actual" ? spreadActual(actualPriorYear?.netIncome, netIncomeRow) : null;
  const actualCapexCols = comparison === "Actual" ? spreadActual(actualPriorYear?.capex, series.capex) : null;

  // Payroll & CAPEX have NO forecast data source at all (see comment above) —
  // rendered as a single explicit "Not in Forecast" note rather than blank
  // "—" cells, so it reads as an expected data-scope gap rather than a
  // loading glitch or a bug. While the (separate, comparison-only) forecast
  // request is still in flight, the note reads "Loading…" instead.
  const forecastUnavailableNote = forecastLoading ? "Loading…" : "Not in Forecast";

  const PNL_ROWS = [
    {
      key: "revenue", label: "Revenue", values: aggregate(series.revenue), total: totalRevenue,
      compareLabel: comparison, compareValues: forecastRevenueCols || actualRevenueCols,
      compareTotal: comparison === "Forecast" ? forecastRevenueTotal : actualPriorYear?.revenue ?? null,
    },
    {
      key: "payroll", label: "Payroll & Workforce Cost", values: aggregate(series.payroll), total: totalPayroll, isExpense: true,
      compareLabel: comparison, compareValues: actualPayrollCols, compareTotal: actualPriorYear?.payroll ?? null,
      unavailableNote: comparison === "Forecast" ? forecastUnavailableNote : null,
    },
    {
      key: "opex", label: "Operating Expense", values: aggregate(series.opex), total: totalOpex, isExpense: true,
      compareLabel: comparison, compareValues: forecastOpexCols || actualOpexCols,
      compareTotal: comparison === "Forecast" ? forecastOpexTotal : actualPriorYear?.opex ?? null,
    },
    {
      key: "total_opex", label: "Total Operating Expenses", values: aggregate(totalOpexRow), total: totalOperatingExpense, isExpense: true, subtotal: true,
      compareLabel: comparison, compareValues: forecastOpexCols || actualTotalOpexCols,
      compareTotal: comparison === "Forecast" ? forecastOpexTotal : actualPriorYear?.totalOpex ?? null,
      labelNote: comparison === "Forecast" ? "*" : null,
    },
    {
      key: "net_income", label: "Net Operating Income", values: aggregate(netIncomeRow), total: netOperatingIncome, subtotal: true, isNet: true,
      compareLabel: comparison, compareValues: forecastNetIncomeCols || actualNetIncomeCols,
      compareTotal: comparison === "Forecast" ? forecastNetIncomeTotal : actualPriorYear?.netIncome ?? null,
      labelNote: comparison === "Forecast" ? "*" : null,
    },
  ];
  const capexCols = aggregate(series.capex);
  // Grouped Budget|Actual/Forecast|Variance columns only render when a
  // comparison is actually selected — "None" keeps the plain single-column
  // layout every row already had.
  const hasCompare = comparison !== "None";

  const kpis = [
    { label: "Total Revenue", value: fmtScaled(totalRevenue), sub: year, icon: <FiDollarSign size={16} /> },
    { label: "Total Payroll", value: fmtScaled(totalPayroll), sub: "Workforce Planning", icon: <FiUsers size={16} /> },
    { label: "Total Operating Expense", value: fmtScaled(totalOpex), sub: "Opex Budgeting", icon: <FiBriefcase size={16} /> },
    {
      label: "Net Operating Income", value: fmtScaled(netOperatingIncome),
      sub: `${operatingMarginPct >= 0 ? "+" : ""}${operatingMarginPct.toFixed(1)}% margin`,
      icon: netOperatingIncome >= 0 ? <FiTrendingUp size={16} /> : <FiTrendingDown size={16} />,
    },
  ];

  const staticHeader = (
    <PageHeader title="P&L Statement" subtitle="Revenue, Payroll & Operating Expense — consolidated from Budget Overview"
      right={
        <>
          <span className="h-8 px-3 rounded-lg bg-white/10 text-white text-s font-semibold flex items-center border border-white/20">{year}</span>
          <div className="flex items-center gap-2">
            <span className="text-x font-semibold text-white/90">Period</span>
            <select
              value={periodView}
              onChange={(e) => setPeriodView(e.target.value)}
              className="h-8 px-3 rounded-lg bg-white/95 text-sky-900 text-x outline-none border border-white/70"
            >
              {PERIOD_VIEW_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-x font-semibold text-white/90">View</span>
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              className="h-8 px-3 rounded-lg bg-white/95 text-sky-900 text-x outline-none border border-white/70"
            >
              {CURRENCY_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-x font-semibold text-white/90">Compare</span>
            <select
              value={comparison}
              onChange={(e) => setComparison(e.target.value)}
              className="h-8 px-3 rounded-lg bg-white/95 text-sky-900 text-x outline-none border border-white/70"
            >
              {COMPARISON_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button onClick={handleRefresh} disabled={refreshing}
            className="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-s font-semibold flex items-center gap-1.5 border border-white/20 transition-colors disabled:opacity-60">
            <FiRefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
          <button onClick={() => window.print()}
            className="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-s font-semibold flex items-center gap-1.5 border border-white/20 transition-colors">
            <FiPrinter size={14} /> Export
          </button>
        </>
      } />
  );

  if (loading) {
    return (
      <div className="planning-compact space-y-2 min-h-screen bg-sky-50 font-sans text-sky-900 pb-12">
        {staticHeader}
        <TableSkeleton columns={6} rows={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="planning-compact space-y-2 min-h-screen bg-sky-50 font-sans text-sky-900 pb-12">
        {staticHeader}
        <EmptyState label={`Couldn't load the P&L Statement — ${error}. Click Refresh to try again.`} />
      </div>
    );
  }

  return (
    <div className="planning-compact space-y-2 min-h-screen bg-sky-50 font-sans text-sky-900 pb-12">
      {staticHeader}

      <KpiRow cards={kpis} />

      <div className="bg-white rounded-xl border border-sky-200 shadow-sm overflow-hidden">
        <div className="overflow-auto max-h-[620px]">
          <table className="min-w-full text-x border-collapse">
            <thead>
              <tr className="bg-sky-900 text-white">
                <th rowSpan={hasCompare ? 2 : 1} className="sticky left-0 top-0 z-20 bg-sky-900 text-left px-4 py-2.5 font-semibold min-w-[220px] align-bottom">Metric</th>
                {displayCols.map((p) => (
                  hasCompare
                    ? <th key={p} colSpan={3} className="sticky top-0 z-10 bg-sky-900 text-center px-4 py-1.5 font-semibold whitespace-nowrap border-l border-sky-700">{p}</th>
                    : <th key={p} className="sticky top-0 z-10 bg-sky-900 text-right px-4 py-2.5 font-semibold whitespace-nowrap">{p}</th>
                ))}
                {hasCompare
                  ? <th colSpan={3} className="sticky top-0 z-10 bg-sky-950 text-center px-4 py-1.5 font-semibold whitespace-nowrap border-l border-sky-700">Total</th>
                  : <th className="sticky top-0 right-0 z-20 bg-sky-950 text-right px-4 py-2.5 font-semibold whitespace-nowrap">Total</th>}
              </tr>
              {hasCompare && (
                <tr className="bg-sky-800 text-white">
                  {displayCols.map((p) => (
                    <React.Fragment key={p}>
                      <th className="bg-sky-800 text-right px-3 py-1.5 text-x font-semibold whitespace-nowrap border-l border-sky-700">Budget</th>
                      <th className="bg-sky-800 text-right px-3 py-1.5 text-x font-semibold whitespace-nowrap">{comparison}</th>
                      <th className="bg-sky-800 text-right px-3 py-1.5 text-x font-semibold whitespace-nowrap">Var</th>
                    </React.Fragment>
                  ))}
                  <th className="bg-sky-900 text-right px-3 py-1.5 text-x font-semibold whitespace-nowrap border-l border-sky-700">Budget</th>
                  <th className="bg-sky-900 text-right px-3 py-1.5 text-x font-semibold whitespace-nowrap">{comparison}</th>
                  <th className="bg-sky-900 text-right px-3 py-1.5 text-x font-semibold whitespace-nowrap">Var</th>
                </tr>
              )}
            </thead>
            <tbody>
              {PNL_ROWS.map((row) => (
                <tr key={row.key} className={row.subtotal ? "border-t-2 border-sky-300 bg-sky-50" : "border-t border-sky-100"}>
                  <td className={`sticky left-0 z-10 px-4 py-2.5 whitespace-nowrap ${row.subtotal ? "bg-sky-50 font-bold" : "bg-white font-medium"} ${row.isNet ? "text-sky-900" : ""}`}
                      title={row.labelNote ? "Opex only — Forecasting has no payroll-level breakdown, see note below" : undefined}>
                    {row.label}{row.labelNote}
                  </td>
                  {row.values.map((v, i) => (
                    <ValueCells key={i} v={v} cv={row.compareValues ? row.compareValues[i] : null} hasCompare={hasCompare} fmtScaled={fmtScaled} bold={row.subtotal} unavailableNote={row.unavailableNote} />
                  ))}
                  {hasCompare ? (
                    <ValueCells v={row.total} cv={row.compareTotal} hasCompare bold fmtScaled={fmtScaled} unavailableNote={row.unavailableNote} />
                  ) : (
                    <td className={`text-right px-4 py-2.5 whitespace-nowrap tabular-nums sticky right-0 ${row.subtotal ? "bg-sky-50 font-bold" : "bg-white font-semibold"} ${row.total < 0 ? "text-red-600" : "text-sky-900"}`}>
                      {fmtScaled(row.total)}
                    </td>
                  )}
                </tr>
              ))}
              <tr className="border-t border-sky-100">
                <td className="sticky left-0 z-10 bg-white px-4 py-2.5 whitespace-nowrap font-medium">CAPEX</td>
                {capexCols.map((v, i) => (
                  <ValueCells key={i} v={v} cv={actualCapexCols ? actualCapexCols[i] : null} hasCompare={hasCompare} fmtScaled={fmtScaled}
                    unavailableNote={comparison === "Forecast" ? forecastUnavailableNote : null} />
                ))}
                {hasCompare ? (
                  <ValueCells v={totalCapex} cv={actualPriorYear?.capex ?? null} hasCompare bold fmtScaled={fmtScaled}
                    unavailableNote={comparison === "Forecast" ? forecastUnavailableNote : null} />
                ) : (
                  <td className={`text-right px-4 py-2.5 whitespace-nowrap tabular-nums sticky right-0 bg-white font-semibold ${totalCapex < 0 ? "text-red-600" : "text-sky-900"}`}>
                    {fmtScaled(totalCapex)}
                  </td>
                )}
              </tr>
            </tbody>
          </table>
        </div>
        {comparison === "Forecast" && (
          <div className="px-4 py-2 text-x text-slate-500 border-t border-sky-100 bg-sky-50/50">
            * Total Operating Expenses and Net Operating Income under Forecast reflect Operating Expense only — Forecasting has no payroll-level breakdown, so Payroll &amp; Workforce Cost and CAPEX have no comparable Forecast figure.
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetPnLStatement;
