import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toWaterfallRows } from "../../calc/waterfall";
import { compactMoney, compactNumber, money } from "../../utils/format";

export const COLORS = {
  actual: "#0369a1",
  gp: "#0ea5e9",
  compare: "#94a3b8",
  positive: "#16a34a",
  negative: "#dc2626",
  total: "#0369a1",
  categories: ["#0369a1", "#0ea5e9", "#f59e0b", "#8b5cf6", "#94a3b8"],
};

const axisMoney = (v) => compactMoney(v);
const tooltipMoney = (v) => (typeof v === "number" ? money(v) : v);

/** Monthly revenue and GP bars with the comparison as dashed lines; months in the period are solid. */
export function TrendComboChart({ data, compareLabel, onSelectMonth, height = 300 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={axisMoney} tick={{ fontSize: 11 }} width={60} />
        <Tooltip formatter={tooltipMoney} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="revenue" name="Revenue" fill={COLORS.actual} onClick={(d) => onSelectMonth?.(d?.payload || d)} cursor={onSelectMonth ? "pointer" : undefined}>
          {data.map((d) => (
            <Cell key={d.ym} fillOpacity={d.inPeriod ? 1 : 0.45} />
          ))}
        </Bar>
        <Bar dataKey="gp" name="GP" fill={COLORS.gp} onClick={(d) => onSelectMonth?.(d?.payload || d)} cursor={onSelectMonth ? "pointer" : undefined}>
          {data.map((d) => (
            <Cell key={d.ym} fillOpacity={d.inPeriod ? 1 : 0.45} />
          ))}
        </Bar>
        <Line type="monotone" dataKey="cmpRevenue" name={`${compareLabel} revenue`} stroke={COLORS.compare} strokeDasharray="5 4" dot={false} />
        <Line type="monotone" dataKey="cmpGp" name={`${compareLabel} GP`} stroke="#64748b" strokeDasharray="2 3" dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function WaterfallTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="bg-white border border-sky-200 rounded p-2 text-xs shadow">
      <div className="font-semibold text-sky-900">{row.label}</div>
      <div>{row.kind === "total" ? money(row.amount) : `${row.amount > 0 ? "+" : ""}${money(row.amount)}`}</div>
    </div>
  );
}

/** Floating waterfall: start total, signed steps, end total. */
export function WaterfallChart({ start, steps, end, height = 300 }) {
  const rows = toWaterfallRows(
    [{ key: "start", label: start.label, amount: start.amount, type: "total" }, ...steps, { key: "end", label: end.label, amount: end.amount, type: "total" }],
    compactMoney
  );
  const fill = { total: COLORS.total, up: COLORS.positive, down: COLORS.negative };
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 22, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
        <YAxis tickFormatter={axisMoney} tick={{ fontSize: 11 }} width={60} />
        <Tooltip content={<WaterfallTooltip />} cursor={{ fill: "rgba(14,165,233,0.06)" }} />
        <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="value" stackId="w">
          {rows.map((r) => (
            <Cell key={r.key || r.label} fill={fill[r.kind]} />
          ))}
          <LabelList dataKey="display" position="top" style={{ fontSize: 10, fill: "#0c4a6e" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Stacked monthly recruiting expense with GP and contribution lines. */
export function SalesCostChart({ data, height = 300 }) {
  const series = [
    ["commission", "Commissions"],
    ["travel", "Travel"],
    ["entertainment", "Entertainment"],
    ["acquisition", "Acquisition"],
    ["salary", "Salary allocation"],
  ];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={axisMoney} tick={{ fontSize: 11 }} width={60} />
        <Tooltip formatter={tooltipMoney} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map(([key, name], i) => (
          <Bar key={key} dataKey={key} name={name} stackId="exp" fill={COLORS.categories[i]} />
        ))}
        <Line type="monotone" dataKey="gp" name="GP" stroke="#0c4a6e" dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="contribution" name="Contribution" stroke={COLORS.positive} dot={false} strokeWidth={2} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Monthly bill revenue, payroll and GP bars with average active contractors as a line on its own axis. */
export function BillingChart({ data, height = 280 }) {
  const tooltip = (v, name) => (name === "Average active contractors" ? compactNumber(v) : tooltipMoney(v));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="money" tickFormatter={axisMoney} tick={{ fontSize: 11 }} width={60} />
        <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 11 }} width={44} allowDecimals={false} />
        <Tooltip formatter={tooltip} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="money" dataKey="billRevenue" name="Bill revenue" fill={COLORS.actual} />
        <Bar yAxisId="money" dataKey="payroll" name="Payroll" fill={COLORS.compare} />
        <Bar yAxisId="money" dataKey="gp" name="GP" fill={COLORS.gp} />
        <Line yAxisId="count" type="monotone" dataKey="avgActive" name="Average active contractors" stroke={COLORS.categories[2]} strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Monthly recruiting activity: submittals, interviews, offers and placements side by side. */
export function ActivityChart({ data, height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} width={40} allowDecimals={false} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="submittals" name="Submittals" fill={COLORS.compare} />
        <Bar dataKey="interviews" name="Interviews" fill={COLORS.gp} />
        <Bar dataKey="offers" name="Offers" fill={COLORS.categories[2]} />
        <Bar dataKey="placements" name="Placements" fill={COLORS.actual} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bars, e.g. weighted pipeline by stage or clients by growth category. */
export function HorizontalBars({ data, dataKey, nameKey, color = COLORS.actual, height = 240, formatter = compactMoney, onSelect }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tickFormatter={formatter} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey={nameKey} tick={{ fontSize: 11 }} width={110} />
        <Tooltip formatter={(v) => formatter(v)} />
        <Bar dataKey={dataKey} fill={color} onClick={(d) => onSelect?.(d?.payload || d)} cursor={onSelect ? "pointer" : undefined}>
          <LabelList dataKey={dataKey} position="right" formatter={formatter} style={{ fontSize: 10, fill: "#0c4a6e" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Grouped monthly bars for actual vs target (revenue or GP), with an optional line. */
export function ActualVsTargetChart({ data, actualKey, targetKey, actualLabel = "Actual", targetLabel = "Target", lineKey, lineLabel, height = 280 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="m" tickFormatter={axisMoney} tick={{ fontSize: 11 }} width={60} />
        {lineKey ? <YAxis yAxisId="c" orientation="right" tickFormatter={(v) => compactNumber(v)} tick={{ fontSize: 11 }} width={40} /> : null}
        <Tooltip formatter={(v, n) => (n === lineLabel ? Math.round(v) : tooltipMoney(v))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="m" dataKey={actualKey} name={actualLabel} fill={COLORS.actual} />
        <Bar yAxisId="m" dataKey={targetKey} name={targetLabel} fill={COLORS.compare} />
        {lineKey ? <Line yAxisId="c" type="monotone" dataKey={lineKey} name={lineLabel} stroke="#f59e0b" strokeWidth={2} dot={false} /> : null}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

