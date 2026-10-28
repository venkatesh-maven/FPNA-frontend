import React, { useEffect, useState } from "react";
import DrilldownDrawer, { DrilldownBodySkeleton, DrilldownFadeIn, DrilldownSummarySkeleton } from "../DrilldownDrawer";
import { FiX, FiChevronRight, FiChevronDown } from "react-icons/fi";
import {
  BarChart,
  Bar,
  Cell,
  LabelList,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";
import { cachedFetch } from "../../../utils/reportCache";
import { getDecimalPrecision } from "../../../utils/formatters";
import { API_BASE_URL } from "../../../config/config";

/*
 * One customer's actuals against its budget and forecast, month by month, for
 * the fiscal year. Shared by the Customer Profitability drilldown (revenue,
 * allocated cost and profit) and the Revenue by Customer drilldown (revenue).
 * Variances compare the months that have actuals; the full-year outlook adds
 * the forecast for the remaining months.
 */

/* ---------------- helpers ---------------- */

// Money arrives as a number or a formatted string ("1,234.56"), or null when
// that source isn't available.
const num = (val) => {
  if (val === null || val === undefined || val === "") return null;
  const n = typeof val === "string" ? Number(val.replace(/,/g, "")) : Number(val);
  return Number.isNaN(n) ? null : n;
};

const money = (val, symbol = "$") => {
  const n = num(val);
  if (n === null) return "—";
  const dp = getDecimalPrecision();
  const abs = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
  return `${n < 0 ? "-" : ""}${symbol}${abs}`;
};

const signedMoney = (val, symbol = "$") => {
  const n = num(val);
  if (n === null) return "—";
  return `${n > 0 ? "+" : ""}${money(n, symbol)}`;
};

const pct = (val, signed = true) => {
  const n = num(val);
  if (n === null) return "—";
  return `${signed && n > 0 ? "+" : ""}${n.toFixed(getDecimalPrecision())}%`;
};

// Over plan is good for revenue and profit, bad for cost.
const varianceClass = (val, lowerIsBetter = false) => {
  const n = num(val);
  if (!n) return "text-sky-900";
  return (n > 0) !== lowerIsBetter ? "text-green-600" : "text-red-600";
};

// Units and counts (units can be fractional: they are spread over contract periods).
const count = (val, dp = 0) => {
  const n = num(val);
  return n === null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: dp });
};

const signedCount = (val, dp = 0) => {
  const n = num(val);
  return n === null ? "—" : `${n > 0 ? "+" : ""}${count(n, dp)}`;
};

const compact = (val) => new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(val);

// "<delta> vs last year (<pct>)", coloured; LY can be missing (new customer, first year of data).
const changeVsLy = (cy, ly, fmtDelta) => {
  const a = num(cy);
  const b = num(ly);
  if (a === null || b === null) return { text: "No data last year", cls: "text-sky-600" };
  const d = a - b;
  const p = b ? (d / Math.abs(b)) * 100 : null;
  return { text: `${fmtDelta(d)} vs last year${p === null ? "" : ` (${pct(p)})`}`, cls: varianceClass(d) };
};

// Floating waterfall rows: an invisible `base` bar stacked under the visible `value` bar.
const bridgeRows = (bridge) => {
  let running = 0;
  return (bridge || []).map((b) => {
    const amount = num(b.amount) ?? 0;
    if (b.type === "total") {
      running = amount;
      return { label: b.label, base: 0, value: amount, amount, kind: "total", display: compact(amount) };
    }
    const base = amount >= 0 ? running : running + amount;
    running += amount;
    return {
      label: b.label,
      base,
      value: Math.abs(amount),
      amount,
      kind: amount >= 0 ? "up" : "down",
      display: `${amount > 0 ? "+" : ""}${compact(amount)}`
    };
  });
};

const BRIDGE_COLORS = { total: "#0369a1", up: "#16a34a", down: "#dc2626" };

const LINES = [
  { key: "revenue", label: "Revenue" },
  { key: "cost", label: "Cost (allocated)", lowerIsBetter: true },
  { key: "profit", label: "Profit" }
];

/* ---------------- component ---------------- */

export default function CustomerPlanDrilldownDrawer({
  open,
  onClose,
  token,
  year,
  currency = "USD",
  currencySymbol = "$",
  customerName,
  endpoint, // "customer-profitability-drilldown" | "revenue_product_drilldown"
  includeProfit = false
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("summary");
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    if (!open || !customerName) return;
    setLoading(true);
    setData(null);
    setExpanded({});
    cachedFetch(
      `${API_BASE_URL}/api/v1/company/financial/${endpoint}/${year}/${currency}?currency_filter=actualvalue&customer_name=${encodeURIComponent(customerName)}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
    )
      .then(setData)
      .catch((err) => {
        console.error(err);
        setData({ error: "Could not load drilldown", message: "The request failed. Try again." });
      })
      .finally(() => setLoading(false));
  }, [open, customerName, year, currency, token, endpoint]);

  const lines = includeProfit ? LINES : LINES.slice(0, 1);
  const ytd = data?.ytd || {};
  const fullYear = data?.full_year || {};
  const rev = ytd.revenue || {};
  const through = ytd.through;
  const tabs = ["summary", "monthly", "breakdown"];

  const toggle = (key) => setExpanded((p) => ({ ...p, [key]: !p[key] }));

  const renderMix = (rows, level = 0, parent = "root") =>
    (rows || []).map((row, i) => {
      const key = `${parent}-${i}`;
      const children = row.children && row.children.length ? row.children : null;
      return (
        <React.Fragment key={key}>
          <tr
            className={`border-b hover:bg-sky-50 ${children ? "cursor-pointer" : ""}`}
            onClick={() => children && toggle(key)}
          >
            <td className="p-3">
              <div className="flex items-center gap-2" style={{ paddingLeft: level * 20 }}>
                <span className="w-4">
                  {children && (expanded[key] ? <FiChevronDown /> : <FiChevronRight />)}
                </span>
                {row.name}
              </div>
            </td>
            <td className="p-3 text-right">{money(row.revenue, currencySymbol)}</td>
            <td className="p-3 text-right">{pct(row.share_pct, false)}</td>
            {includeProfit && <td className="p-3 text-right">{money(row.cost, currencySymbol)}</td>}
            {includeProfit && <td className="p-3 text-right">{money(row.profit, currencySymbol)}</td>}
          </tr>
          {children && expanded[key] && renderMix(children, level + 1, key)}
        </React.Fragment>
      );
    });

  const chartData = (data?.monthly || []).map((m) => ({
    period: m.period,
    Actual: num(m.actual_revenue),
    Budget: num(m.budget_revenue),
    Forecast: num(m.forecast_revenue)
  }));

  return (
    <DrilldownDrawer open={open} onClose={onClose}>
          {/* HEADER */}
          <div className="px-8 py-6 bg-gradient-to-r from-sky-900 to-sky-700 text-white">
            <div className="flex justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  {data?.error ? `${customerName}: Actual vs Budget vs Forecast` : data?.title || customerName}
                </h2>
                <p className="text-sky-200 mt-1">
                  {loading ? "Loading…" : data?.error ? data.message : data?.subtitle}
                </p>

                {loading && <DrilldownSummarySkeleton />}
                {data && !data.error && (
                  <div className="grid grid-cols-4 gap-6 mt-6">
                    <SummaryCard
                      label={through ? `Actual revenue (to ${through})` : "Actual revenue"}
                      value={money(rev.actual, currencySymbol)}
                    />
                    <SummaryCard
                      label="vs Budget"
                      value={signedMoney(rev.var_budget, currencySymbol)}
                      sub={rev.budget == null ? "No budget" : `${pct(rev.var_budget_pct)} of ${money(rev.budget, currencySymbol)}`}
                    />
                    <SummaryCard
                      label="vs Forecast"
                      value={signedMoney(rev.var_forecast, currencySymbol)}
                      sub={rev.forecast == null ? "No forecast" : `${pct(rev.var_forecast_pct)} of ${money(rev.forecast, currencySymbol)}`}
                    />
                    {includeProfit ? (
                      <SummaryCard
                        label="Actual profit"
                        value={money(ytd.profit?.actual, currencySymbol)}
                        sub={`Margin ${pct(ytd.margin_pct?.actual_pct, false)}`}
                      />
                    ) : (
                      <SummaryCard
                        label="Full-year outlook"
                        value={money(fullYear.revenue?.outlook, currencySymbol)}
                        sub={
                          fullYear.revenue?.budget == null
                            ? "No budget"
                            : `${signedMoney(fullYear.revenue?.outlook_vs_budget, currencySymbol)} vs budget`
                        }
                      />
                    )}
                  </div>
                )}
              </div>

              <button onClick={onClose} aria-label="Close">
                <FiX size={22} />
              </button>
            </div>
          </div>

          {data?.error ? (
            <div className="flex-1 overflow-auto p-8">
              <Card title={data.error}>
                <p className="text-s text-sky-900">{data.message}</p>
              </Card>
            </div>
          ) : (
            <>
              {/* TABS */}
              <div className="flex border-b bg-white">
                {tabs.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-6 py-3 text-s font-medium ${
                      tab === t ? "border-b-2 border-sky-800 text-sky-900" : "text-sky-600"
                    }`}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-auto p-8">
                {loading && <DrilldownBodySkeleton />}

                <DrilldownFadeIn key={`${tab}-${data ? "loaded" : "empty"}`} className="space-y-6">

                {data && tab === "summary" && (
                  <>
                    {data.notes?.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-s space-y-1">
                        {data.notes.map((n, i) => (
                          <p key={i}>{n}</p>
                        ))}
                      </div>
                    )}

                    <Card title={through ? `Year to date (FY${data.year}, through ${through})` : `FY${data.year} to date`}>
                      <table className="w-full text-s">
                        <thead className="bg-sky-100">
                          <tr>
                            <th className="p-3 text-left">Line</th>
                            <th className="p-3 text-right">Actual</th>
                            <th className="p-3 text-right">Budget</th>
                            <th className="p-3 text-right">Var vs Budget</th>
                            <th className="p-3 text-right">Forecast</th>
                            <th className="p-3 text-right">Var vs Forecast</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lines.map((l) => {
                            const v = ytd[l.key] || {};
                            return (
                              <tr key={l.key} className="border-b">
                                <td className="p-3 font-medium">{l.label}</td>
                                <td className="p-3 text-right">{money(v.actual, currencySymbol)}</td>
                                <td className="p-3 text-right">{money(v.budget, currencySymbol)}</td>
                                <td className={`p-3 text-right font-semibold ${varianceClass(v.var_budget, l.lowerIsBetter)}`}>
                                  {signedMoney(v.var_budget, currencySymbol)}
                                  <span className="block text-x font-normal">{pct(v.var_budget_pct)}</span>
                                </td>
                                <td className="p-3 text-right">{money(v.forecast, currencySymbol)}</td>
                                <td className={`p-3 text-right font-semibold ${varianceClass(v.var_forecast, l.lowerIsBetter)}`}>
                                  {signedMoney(v.var_forecast, currencySymbol)}
                                  <span className="block text-x font-normal">{pct(v.var_forecast_pct)}</span>
                                </td>
                              </tr>
                            );
                          })}
                          {includeProfit && (
                            <tr>
                              <td className="p-3 font-medium">Margin</td>
                              <td className="p-3 text-right">{pct(ytd.margin_pct?.actual_pct, false)}</td>
                              <td className="p-3 text-right">{pct(ytd.margin_pct?.budget_pct, false)}</td>
                              <td />
                              <td className="p-3 text-right">{pct(ytd.margin_pct?.forecast_pct, false)}</td>
                              <td />
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </Card>

                    <Card title={`Full year FY${data.year}`}>
                      <table className="w-full text-s">
                        <thead className="bg-sky-100">
                          <tr>
                            <th className="p-3 text-left">Line</th>
                            <th className="p-3 text-right">Budget</th>
                            <th className="p-3 text-right">Forecast</th>
                            <th className="p-3 text-right">Outlook (actual + forecast)</th>
                            <th className="p-3 text-right">Outlook vs Budget</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lines.map((l) => {
                            const v = fullYear[l.key] || {};
                            return (
                              <tr key={l.key} className="border-b last:border-none">
                                <td className="p-3 font-medium">{l.label}</td>
                                <td className="p-3 text-right">{money(v.budget, currencySymbol)}</td>
                                <td className="p-3 text-right">{money(v.forecast, currencySymbol)}</td>
                                <td className="p-3 text-right">{money(v.outlook, currencySymbol)}</td>
                                <td className={`p-3 text-right font-semibold ${varianceClass(v.outlook_vs_budget, l.lowerIsBetter)}`}>
                                  {signedMoney(v.outlook_vs_budget, currencySymbol)}
                                  <span className="block text-x font-normal">{pct(v.outlook_vs_budget_pct)}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </Card>

                    <Card title="Insights">
                      <ul className="list-disc pl-5 space-y-2 text-s">
                        {(data.insights || []).map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    </Card>
                  </>
                )}

                {data && tab === "monthly" && (
                  <>
                    <Card title="Revenue by month: Actual vs Budget vs Forecast">
                      <ResponsiveContainer width="100%" height={340}>
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="period" />
                          <YAxis />
                          <Tooltip formatter={(v) => money(v, currencySymbol)} />
                          <Legend />
                          <Bar dataKey="Actual" fill="#0369a1" />
                          <Bar dataKey="Budget" fill="#94a3b8" />
                          <Bar dataKey="Forecast" fill="#f59e0b" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>

                    <Card title="Monthly detail">
                      <div className="overflow-x-auto">
                        <table className="w-full text-s">
                          <thead className="bg-sky-100">
                            <tr>
                              <th className="p-3 text-left">Period</th>
                              <th className="p-3 text-right">Actual</th>
                              <th className="p-3 text-right">Budget</th>
                              <th className="p-3 text-right">Var vs Budget</th>
                              <th className="p-3 text-right">Forecast</th>
                              <th className="p-3 text-right">Var vs Forecast</th>
                              {includeProfit && <th className="p-3 text-right">Actual Profit</th>}
                              {includeProfit && <th className="p-3 text-right">Budget Profit</th>}
                              {includeProfit && <th className="p-3 text-right">Forecast Profit</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {(data.monthly || []).map((m) => {
                              const a = num(m.actual_revenue);
                              const b = num(m.budget_revenue);
                              const f = num(m.forecast_revenue);
                              const vb = a !== null && b !== null ? a - b : null;
                              const vf = a !== null && f !== null ? a - f : null;
                              return (
                                <tr key={m.period} className={`border-b ${m.has_actual ? "" : "text-slate-400"}`}>
                                  <td className="p-3">
                                    {m.period}
                                    {!m.has_actual && <span className="ml-2 text-x">(no actuals yet)</span>}
                                  </td>
                                  <td className="p-3 text-right">{money(m.actual_revenue, currencySymbol)}</td>
                                  <td className="p-3 text-right">{money(m.budget_revenue, currencySymbol)}</td>
                                  <td className={`p-3 text-right ${varianceClass(vb)}`}>{signedMoney(vb, currencySymbol)}</td>
                                  <td className="p-3 text-right">{money(m.forecast_revenue, currencySymbol)}</td>
                                  <td className={`p-3 text-right ${varianceClass(vf)}`}>{signedMoney(vf, currencySymbol)}</td>
                                  {includeProfit && <td className="p-3 text-right">{money(m.actual_profit, currencySymbol)}</td>}
                                  {includeProfit && <td className="p-3 text-right">{money(m.budget_profit, currencySymbol)}</td>}
                                  {includeProfit && <td className="p-3 text-right">{money(m.forecast_profit, currencySymbol)}</td>}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  </>
                )}

                {data && tab === "breakdown" && (
                  <>
                    <Drivers drivers={data.drivers} includeProfit={includeProfit} sym={currencySymbol} />

                    <Card title={`Actual mix${through ? ` to ${through}` : ""}: Product → Entity → Region`}>
                      <table className="w-full text-s">
                        <thead className="bg-sky-100">
                          <tr>
                            <th className="p-3 text-left">Product → Entity → Region</th>
                            <th className="p-3 text-right">Revenue</th>
                            <th className="p-3 text-right">Share</th>
                            {includeProfit && <th className="p-3 text-right">Cost (allocated)</th>}
                            {includeProfit && <th className="p-3 text-right">Profit</th>}
                          </tr>
                        </thead>
                        <tbody>{renderMix(data.breakdowns)}</tbody>
                      </table>
                      {!data.breakdowns?.length && <p className="text-s text-sky-700 mt-4">No actuals yet for this year.</p>}
                    </Card>
                  </>
                )}
                </DrilldownFadeIn>
              </div>
            </>
          )}
    </DrilldownDrawer>
  );
}

/* ---------------- UI ---------------- */

const Card = ({ title, children }) => (
  <div className="bg-white p-6 rounded-xl shadow">
    <h3 className="font-semibold text-sky-800 mb-4">{title}</h3>
    {children}
  </div>
);

const SummaryCard = ({ label, value, sub }) => (
  <div>
    <div className="text-sky-200 text-s">{label}</div>
    <div className="font-bold text-lg">{value}</div>
    {sub && <div className="text-sky-200 text-x">{sub}</div>}
  </div>
);

/* ---------------- drivers (Breakdown tab) ---------------- */

// GL drivers reconcile to the header; CRM drivers (units, pipeline) come from a
// separate dataset, so each section says where its numbers come from.
const Drivers = ({ drivers, includeProfit, sym }) => {
  if (!drivers) return null; // response cached before drivers existed
  return (
    <>
      <ProfileLine profile={drivers.profile} />
      <RevenueDrivers rd={drivers.revenue_drivers} cyLabel={drivers.cy_label} lyLabel={drivers.ly_label} sym={sym} />
      <UnitsPricing u={drivers.units} cyLabel={drivers.cy_label} includeProfit={includeProfit} sym={sym} />
      <Pipeline p={drivers.pipeline} sym={sym} />
    </>
  );
};

const SourceNote = ({ children }) => <p className="text-x text-sky-600 -mt-2 mb-4">{children}</p>;

const Empty = ({ children }) => <p className="text-s text-sky-700">{children}</p>;

const TileGrid = ({ children }) => <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">{children}</div>;

const DriverTile = ({ label, value, sub, subClass = "text-sky-600", sub2 }) => (
  <div className="bg-sky-50 border border-sky-100 rounded-lg p-4">
    <div className="text-x text-sky-700">{label}</div>
    <div className="text-lg font-bold text-sky-900 mt-1">{value}</div>
    {sub && <div className={`text-x mt-1 ${subClass}`}>{sub}</div>}
    {sub2 && <div className="text-x mt-0.5 text-sky-600">{sub2}</div>}
  </div>
);

const ProfileLine = ({ profile }) => {
  if (!profile) return null;
  const items = [
    ["Industry", profile.industries],
    ["Region", profile.regions],
    ["Segment", profile.segments],
    ["CRM accounts", profile.crm_accounts]
  ].filter(([, values]) => values?.length);
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2 text-x">
      {items.map(([label, values]) => (
        <span key={label} className="bg-white border border-sky-200 rounded-full px-3 py-1 text-sky-900">
          <span className="text-sky-600">{label}:</span> {values.join(", ")}
        </span>
      ))}
    </div>
  );
};

const BridgeTooltip = ({ active, payload, sym }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="bg-white border border-sky-200 rounded p-2 text-x shadow">
      <div className="font-semibold text-sky-900">{row.label}</div>
      <div>{row.kind === "total" ? money(row.amount, sym) : signedMoney(row.amount, sym)}</div>
    </div>
  );
};

const RevenueDrivers = ({ rd, cyLabel, lyLabel, sym }) => {
  if (!rd) {
    return (
      <Card title="Revenue drivers">
        <Empty>No months with actuals yet for this year.</Empty>
      </Card>
    );
  }
  const revChange = changeVsLy(rd.revenue, rd.revenue_ly, (d) => signedMoney(d, sym));
  const postChange = changeVsLy(rd.postings, rd.postings_ly, (d) => signedCount(d));
  const avgChange = changeVsLy(rd.avg_value, rd.avg_value_ly, (d) => signedMoney(d, sym));
  const rows = bridgeRows(rd.bridge);
  const movers = (rd.streams || []).filter((s) => num(s.change) !== null);
  const topMover = movers.length
    ? movers.reduce((a, b) => (Math.abs(num(b.change)) > Math.abs(num(a.change)) ? b : a)).name
    : null;
  const contraStream = (rd.streams || []).find((s) => /discount|return/i.test(s.name) && num(s.revenue) > 0);

  return (
    <Card title={`Revenue drivers · ${cyLabel} vs ${lyLabel}`}>
      <SourceNote>Source: general ledger. These figures reconcile to the revenue above.</SourceNote>
      <TileGrid>
        <DriverTile label="Revenue" value={money(rd.revenue, sym)} sub={revChange.text} subClass={revChange.cls} />
        <DriverTile
          label="Billing entries"
          value={count(rd.postings)}
          sub={postChange.text}
          subClass={postChange.cls}
          sub2="GL revenue postings"
        />
        <DriverTile label="Avg value per entry" value={money(rd.avg_value, sym)} sub={avgChange.text} subClass={avgChange.cls} />
        <DriverTile
          label="Months billed"
          value={`${count(rd.months_billed)} of ${count(rd.months_total)}`}
          sub={rd.months_billed_ly == null ? "No data last year" : `${count(rd.months_billed_ly)} last year`}
        />
        <DriverTile label="Customer since" value={rd.customer_since || "—"} sub="First month with revenue" />
      </TileGrid>

      {rows.length > 0 && (
        <div className="mt-6">
          <h4 className="text-s font-semibold text-sky-800 mb-2">What changed revenue vs last year: billing volume vs value per entry</h4>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={rows} margin={{ top: 24, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={compact} />
              <Tooltip content={<BridgeTooltip sym={sym} />} cursor={{ fill: "rgba(14,165,233,0.06)" }} />
              <Bar dataKey="base" stackId="bridge" fill="transparent" isAnimationActive={false} />
              <Bar dataKey="value" stackId="bridge">
                {rows.map((r) => (
                  <Cell key={r.label} fill={BRIDGE_COLORS[r.kind]} />
                ))}
                <LabelList dataKey="display" position="top" className="text-x" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {rd.streams?.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <h4 className="text-s font-semibold text-sky-800 mb-2">Revenue by stream</h4>
          <table className="w-full text-s">
            <thead className="bg-sky-100">
              <tr>
                <th className="p-3 text-left">Stream</th>
                <th className="p-3 text-right">This year</th>
                <th className="p-3 text-right">Last year</th>
                <th className="p-3 text-right">Change</th>
                <th className="p-3 text-right">Share</th>
                <th className="p-3 text-right">Entries (LY)</th>
              </tr>
            </thead>
            <tbody>
              {rd.streams.map((s) => (
                <tr key={s.name} className={`border-b ${s.name === topMover ? "bg-amber-50" : ""}`}>
                  <td className="p-3 font-medium">
                    {s.name}
                    {s.name === topMover && <span className="ml-2 text-x text-amber-700">biggest mover</span>}
                  </td>
                  <td className="p-3 text-right">{money(s.revenue, sym)}</td>
                  <td className="p-3 text-right">{money(s.revenue_ly, sym)}</td>
                  <td className={`p-3 text-right font-semibold ${varianceClass(s.change)}`}>
                    {signedMoney(s.change, sym)}
                    <span className="block text-x font-normal">{pct(s.change_pct)}</span>
                  </td>
                  <td className="p-3 text-right">{pct(s.share_pct, false)}</td>
                  <td className="p-3 text-right">
                    {count(s.postings)}
                    {s.postings_ly != null && <span className="text-sky-600"> ({count(s.postings_ly)})</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {contraStream && (
            <p className="text-x text-amber-700 mt-2">
              {contraStream.name} is posted as credits in the ledger, so it adds to revenue here instead of reducing it.
            </p>
          )}
        </div>
      )}
    </Card>
  );
};

const UnitsPricing = ({ u, cyLabel, includeProfit, sym }) => {
  if (!u) return null; // no months with actuals yet: the revenue card already says so
  if (!u.available) {
    return (
      <Card title="Units & pricing">
        <Empty>No CRM bookings for this customer.</Empty>
      </Card>
    );
  }
  const unitsChange = changeVsLy(u.units_recognised, u.units_recognised_ly, (d) => signedCount(d, 1));
  const priceGap = num(u.price_vs_list_pct);
  const chartData = (u.monthly || []).map((m) => ({
    period: m.period,
    "This year": num(m.units),
    "Last year": num(m.units_ly)
  }));

  return (
    <Card title={`Units & pricing · ${cyLabel}`}>
      <SourceNote>
        Source: CRM bookings. CRM is a separate dataset from the ledger, so these figures won't reconcile to the revenue above.
      </SourceNote>
      <TileGrid>
        <DriverTile
          label="Units billed"
          value={count(u.units_recognised, 1)}
          sub={unitsChange.text}
          subClass={unitsChange.cls}
          sub2="Spread over each contract's term"
        />
        <DriverTile
          label="New bookings"
          value={`${count(u.bookings)} orders`}
          sub={`${count(u.units_booked)} units · ${money(u.booked_value, sym)}`}
          sub2={u.bookings_ly == null ? "No data last year" : `Last year: ${count(u.bookings_ly)} orders, ${count(u.units_booked_ly)} units`}
        />
        <DriverTile label="Avg order value" value={money(u.avg_order_value, sym)} sub="Booked value per order" />
        <DriverTile
          label="Realised price / unit"
          value={money(u.realised_price, sym)}
          sub={priceGap === null ? "No list price" : `${pct(priceGap)} vs list ${money(u.list_price, sym)}`}
          subClass={priceGap === null ? "text-sky-600" : varianceClass(priceGap)}
          sub2={u.realised_price_ly == null ? null : `Last year ${money(u.realised_price_ly, sym)}`}
        />
        {includeProfit && (
          <DriverTile
            label="Unit margin"
            value={pct(u.unit_margin_pct, false)}
            sub={`Unit cost ${money(u.unit_cost, sym)}`}
            sub2="Product cost from CRM"
          />
        )}
      </TileGrid>

      {chartData.length > 0 && (
        <div className="mt-6">
          <h4 className="text-s font-semibold text-sky-800 mb-2">Units billed by month</h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="period" />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={(v) => count(v, 1)} />
              <Legend />
              <Bar dataKey="This year" fill="#0369a1" />
              <Bar dataKey="Last year" fill="#94a3b8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {u.products?.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <h4 className="text-s font-semibold text-sky-800 mb-2">By product</h4>
          <table className="w-full text-s">
            <thead className="bg-sky-100">
              <tr>
                <th className="p-3 text-left">Product</th>
                <th className="p-3 text-left">Family</th>
                <th className="p-3 text-right">Units billed</th>
                <th className="p-3 text-right">Units booked</th>
                <th className="p-3 text-right">Realised price</th>
                <th className="p-3 text-right">List price</th>
                <th className="p-3 text-right">vs List</th>
                {includeProfit && <th className="p-3 text-right">Unit cost</th>}
                {includeProfit && <th className="p-3 text-right">Unit margin</th>}
              </tr>
            </thead>
            <tbody>
              {u.products.map((p, i) => (
                <tr key={`${p.product}-${p.family}-${i}`} className="border-b">
                  <td className="p-3 font-medium">{p.product}</td>
                  <td className="p-3">{p.family || "—"}</td>
                  <td className="p-3 text-right">{count(p.units_recognised, 1)}</td>
                  <td className="p-3 text-right">{count(p.units_booked)}</td>
                  <td className="p-3 text-right">{money(p.realised_price, sym)}</td>
                  <td className="p-3 text-right">{money(p.list_price, sym)}</td>
                  <td className={`p-3 text-right ${varianceClass(p.price_vs_list_pct)}`}>{pct(p.price_vs_list_pct)}</td>
                  {includeProfit && <td className="p-3 text-right">{money(p.unit_cost, sym)}</td>}
                  {includeProfit && <td className="p-3 text-right">{pct(p.unit_margin_pct, false)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};

const Pipeline = ({ p, sym }) => {
  if (!p) return null;
  if (!p.available) {
    return (
      <Card title="Pipeline & sales">
        <Empty>No CRM opportunities for this customer.</Empty>
      </Card>
    );
  }
  return (
    <Card title="Pipeline & sales">
      <SourceNote>Source: CRM opportunities, all time. Open deals have no expected close date in CRM.</SourceNote>
      <TileGrid>
        <DriverTile label="Open pipeline" value={money(p.pipeline_value, sym)} sub={`${count(p.open_count)} open deals`} />
        <DriverTile label="Weighted pipeline" value={money(p.weighted_pipeline, sym)} sub="Amount × win probability" />
        <DriverTile
          label="Win rate"
          value={pct(p.win_rate_pct, false)}
          sub={`${count(p.won_count)} won · ${count(p.lost_count)} lost`}
        />
        <DriverTile label="Avg won deal" value={money(p.avg_won_deal, sym)} />
        <DriverTile
          label="Avg sales cycle"
          value={p.avg_cycle_days == null ? "—" : `${count(p.avg_cycle_days)} days`}
          sub="Created to close, won deals"
        />
      </TileGrid>

      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <div className="overflow-x-auto">
          <h4 className="text-s font-semibold text-sky-800 mb-2">Largest open deals</h4>
          {p.top_open?.length ? (
            <table className="w-full text-s">
              <thead className="bg-sky-100">
                <tr>
                  <th className="p-3 text-left">Stage</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3 text-right">Probability</th>
                  <th className="p-3 text-left">Owner</th>
                </tr>
              </thead>
              <tbody>
                {p.top_open.map((o, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-3">{o.stage}</td>
                    <td className="p-3 text-right">{money(o.amount, sym)}</td>
                    <td className="p-3 text-right">{pct(o.probability_pct, false)}</td>
                    <td className="p-3">{o.owner || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>No open deals.</Empty>
          )}
        </div>
        <div className="overflow-x-auto">
          <h4 className="text-s font-semibold text-sky-800 mb-2">Account owners</h4>
          {p.owners?.length ? (
            <table className="w-full text-s">
              <thead className="bg-sky-100">
                <tr>
                  <th className="p-3 text-left">Salesperson</th>
                  <th className="p-3 text-right">Won value</th>
                  <th className="p-3 text-right">Won</th>
                  <th className="p-3 text-right">Open</th>
                </tr>
              </thead>
              <tbody>
                {p.owners.map((o) => (
                  <tr key={o.name} className="border-b">
                    <td className="p-3">{o.name}</td>
                    <td className="p-3 text-right">{money(o.won_value, sym)}</td>
                    <td className="p-3 text-right">{count(o.won_count)}</td>
                    <td className="p-3 text-right">{count(o.open_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>No owners recorded.</Empty>
          )}
        </div>
      </div>
    </Card>
  );
};
