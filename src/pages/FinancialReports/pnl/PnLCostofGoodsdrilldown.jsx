import React, { useEffect, useState } from "react";
import DrilldownDrawer, { DrilldownBodySkeleton, DrilldownFadeIn, DrilldownSummarySkeleton } from "../DrilldownDrawer";
import { FiX, FiChevronRight, FiChevronDown } from "react-icons/fi";
import { cachedFetch } from "../../../utils/reportCache";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    Cell
} from "recharts";
import { getDecimalPrecision } from '../../../utils/formatters';
import { API_BASE_URL } from '../../../config/config';

/* ================= HELPERS ================= */

const formatMoney = (val, symbol = "$") => {
    if (val === null || val === undefined || val === "") return "—";
    const num = typeof val === "string" ? Number(val.replace(/,/g, "")) : Number(val);
    if (Number.isNaN(num)) return "—";
    return `${symbol}${num.toLocaleString(undefined, {
        minimumFractionDigits: getDecimalPrecision(),
        maximumFractionDigits: getDecimalPrecision()
    })}`;
};

const formatPercent = (val) => {
    if (val === null || val === undefined) return "—";
    return `${val > 0 ? "+" : ""}${Number(val).toFixed(getDecimalPrecision())}%`;
};

const parseChartValue = (val) => {
    if (val === null || val === undefined || val === "") return 0;
    const num = typeof val === "string" ? Number(val.replace(/,/g, "")) : Number(val);
    return Number.isNaN(num) ? 0 : num;
};

/* ================= COMPONENT ================= */

export default function PnLCostofGoodsdrilldown({
    open,
    onClose,
    token,
    currency = "USD",
    currencySymbol = "$",
    period,
    query = "" // comparison basis + report filters, from PnLPage
}) {
    const [data, setData] = useState(null);
    const [tab, setTab] = useState("insights");
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState({});
    const [showChart, setShowChart] = useState(true);

    /* ================= FETCH ================= */

    useEffect(() => {
        if (!open || !period) return;

        const fetchData = async () => {
            setLoading(true);
            setData(null);
            try {
                const json = await cachedFetch(
                    `${API_BASE_URL}/api/v1/company/financial/pnl-cost-of-good-sold-drilldown/${currency}?currency_filter=actualvalue&period=${period}${query ? `&${query}` : ""}`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            Accept: "application/json"
                        }
                    }
                );
                setData(json);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [open, currency, period, token, query]);

    const toggle = (key) =>
        setExpanded((p) => ({ ...p, [key]: !p[key] }));

    const isBudget = data?.compare_to === "budget";

    /* ================= RECURSIVE BREAKDOWN ================= */

    const renderRows = (rows, level = 0, parentKey = "") => {
        if (!Array.isArray(rows)) return null;

        return rows.map((row, idx) => {
            const key = `${parentKey}-${idx}`;
            const isOpen = expanded[key];

            const children =
                row.by_account_by_entity ||
                row.by_account_by_entity_by_region ||
                row.children;

            return (
                <React.Fragment key={key}>
                    <tr
                        className="border-b hover:bg-sky-50 cursor-pointer"
                        onClick={() => children && toggle(key)}
                    >
                        <td className="p-3 flex items-center gap-2">
                            <div style={{ marginLeft: level * 20 }}>
                                {children &&
                                    (isOpen ? (
                                        <FiChevronDown />
                                    ) : (
                                        <FiChevronRight />
                                    ))}
                            </div>
                            {row.account_name || row.entity_name || row.region || row.category}
                        </td>

                        <td className="text-right p-3">
                            {formatMoney(
                                row.selected_amount,
                                currencySymbol
                            )}
                        </td>
                        <td className="text-right p-3">
                            {formatMoney(
                                row.previous_amount,
                                currencySymbol
                            )}
                        </td>
                        <td
                            className={`text-right p-3 ${row.trend === "up"
                                ? "text-red-600"
                                : "text-green-600"
                                }`}
                        >
                            {formatMoney(row.change, currencySymbol)}
                        </td>
                        <td className="text-right p-3">
                            {formatPercent(row.change_pct)}
                        </td>
                    </tr>

                    {children &&
                        isOpen &&
                        renderRows(children, level + 1, key)}
                </React.Fragment>
            );
        });
    };

    return (
        <DrilldownDrawer open={open} onClose={onClose}>
                    {/* ================= HEADER ================= */}

                    <div className="px-8 py-6 bg-gradient-to-r from-sky-900 to-sky-700 text-white">
                        <div className="flex justify-between">
                            <div>
                                <h2 className="text-2xl font-bold">
                                    {data?.title}
                                </h2>
                                <p className="text-sky-200 mt-1">
                                    {data?.subtitle}
                                </p>

                                {loading && <DrilldownSummarySkeleton />}
                                {data?.summary && (
                                    <div className="grid grid-cols-4 gap-6 mt-6">
                                        <SummaryCard
                                            label={data.summary.current_label || data.summary.current_period}
                                            value={formatMoney(
                                                data.summary.current_value,
                                                currencySymbol
                                            )}
                                        />
                                        <SummaryCard
                                            label={data.summary.previous_label || data.summary.previous_period}
                                            value={formatMoney(
                                                data.summary.previous_value,
                                                currencySymbol
                                            )}
                                        />
                                        <SummaryCard
                                            label="Variance"
                                            value={formatMoney(
                                                data.summary.variance,
                                                currencySymbol
                                            )}
                                        />
                                        <SummaryCard
                                            label="% Change"
                                            value={formatPercent(
                                                data.summary.pct
                                            )}
                                        />
                                    </div>
                                )}
                            </div>

                            <button onClick={onClose}>
                                <FiX size={22} />
                            </button>
                        </div>
                    </div>

                    {/* ================= TABS ================= */}

                    <div className="flex border-b bg-white">
                        {["insights", "waterfall", "breakdown", "impact"].map(
                            (t) => (
                                <button
                                    key={t}
                                    onClick={() => setTab(t)}
                                    className={`px-6 py-3 text-s font-medium ${tab === t
                                        ? "border-b-2 border-sky-800 text-sky-900"
                                        : "text-sky-600"
                                        }`}
                                >
                                    {t.toUpperCase()}
                                </button>
                            )
                        )}
                    </div>

                    <div className="flex-1 overflow-auto p-8">
                        {loading && <DrilldownBodySkeleton />}

                        <DrilldownFadeIn key={`${tab}-${data ? "loaded" : "empty"}`}>

                        {/* ================= INSIGHTS ================= */}

                        {tab === "insights" && data?.insights && (
                            <div className="space-y-6 max-w-5xl mx-auto">
                                <Card title="Summary">
                                    {data.insights.summary}
                                </Card>

                                <Card title="Drivers">
                                    {data.insights.drivers?.map((d, i) => (
                                        <div
                                            key={i}
                                            className="flex justify-between py-2 border-b"
                                        >
                                            <div>
                                                <div className="font-medium">
                                                    {d.description}
                                                </div>
                                                <div className="text-s text-sky-600">
                                                    {d.detail}
                                                </div>
                                            </div>
                                            <div className="text-red-600 font-semibold">
                                                {formatMoney(
                                                    d.amount,
                                                    currencySymbol
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </Card>

                                <Card title="Recommendations">
                                    <ul className="list-disc pl-6 space-y-2">
                                        {data.insights.recommendations?.map(
                                            (r, i) => (
                                                <li key={i}>{r}</li>
                                            )
                                        )}
                                    </ul>
                                </Card>
                            </div>
                        )}

                        {/* ================= WATERFALL ================= */}

                        {tab === "waterfall" && Array.isArray(data?.waterfall) && (
                            <div className="grid grid-cols-2 gap-8">

                                {/* ================= LEFT SIDE DATA ================= */}
                                <div className="bg-white rounded-xl shadow p-6">
                                    <h3 className="text-sky-800 font-semibold mb-4">
                                        Waterfall Breakdown
                                    </h3>

                                    <div className="h-[420px] overflow-y-auto pr-2">
                                        <table className="w-full text-s">
                                            <thead className="bg-sky-100 sticky top-0">
                                                <tr>
                                                    <th className="p-3 text-left">Step</th>
                                                    <th className="p-3 text-right">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.waterfall.map((w, i) => (
                                                    <tr
                                                        key={i}
                                                        className="border-b hover:bg-sky-50"
                                                    >
                                                        <td className="p-3">
                                                            <div className="font-medium text-sky-900">
                                                                {w.label}
                                                            </div>
                                                            <div className="text-x text-sky-600">
                                                                {w.description}
                                                            </div>
                                                        </td>

                                                        <td
                                                            className={`p-3 text-right font-semibold ${w.type === "baseline"
                                                                ? "text-sky-800"
                                                                : w.type === "positive"
                                                                    ? "text-green-600"
                                                                    : "text-red-600"
                                                                }`}
                                                        >
                                                            {formatMoney(
                                                                w.value,
                                                                currencySymbol
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* ================= RIGHT SIDE CHART ================= */}
                                <div className="bg-white rounded-xl shadow p-6">
                                    <h3 className="text-sky-800 font-semibold mb-4">
                                        Waterfall Chart
                                    </h3>

                                    <ResponsiveContainer width="100%" height={420}>
                                        <BarChart data={data.waterfall.map((w) => ({
                                            ...w,
                                            value: parseChartValue(w.value)
                                        }))}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="label" />
                                            <YAxis />
                                            <Tooltip />
                                            <Bar dataKey="value">
                                                {data.waterfall.map((entry, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={
                                                            entry.type === "positive"
                                                                ? "#16a34a"
                                                                : entry.type === "negative"
                                                                    ? "#dc2626"
                                                                    : "#0369a1"
                                                        }
                                                    />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        {/* ================= BREAKDOWN ================= */}

                        {tab === "breakdown" &&
                            Array.isArray(data?.breakdowns) && (
                                <Card title="Cost Breakdown">
                                    <table className="w-full text-s">
                                        <thead className="bg-sky-100">
                                            <tr>
                                                <th className="p-3 text-left">
                                                    Account
                                                </th>
                                                <th className="p-3 text-right">
                                                    {isBudget ? "Actual" : "Current"}
                                                </th>
                                                <th className="p-3 text-right">
                                                    {isBudget ? "Budget" : "Previous"}
                                                </th>
                                                <th className="p-3 text-right">
                                                    Change
                                                </th>
                                                <th className="p-3 text-right">
                                                    %
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {renderRows(
                                                [...data.breakdowns].sort(
                                                    (a, b) =>
                                                        (b.selected_amount || 0) -
                                                        (a.selected_amount || 0)
                                                )
                                            )}
                                        </tbody>
                                    </table>
                                </Card>
                            )}

                        {/* ================= IMPACT ================= */}

                        {tab === "impact" &&
                            Array.isArray(data?.top_impact) && (
                                <Card title="Top Cost Impact">
                                    {data.top_impact.map((i, idx) => (
                                        <div
                                            key={idx}
                                            className="flex justify-between py-2 border-b"
                                        >
                                            <span>
                                                {i.account} ({i.entity})
                                            </span>
                                            <span className="text-red-600 font-semibold">
                                                {formatMoney(
                                                    i.change,
                                                    currencySymbol
                                                )}
                                            </span>
                                        </div>
                                    ))}
                                </Card>
                            )}
                        </DrilldownFadeIn>
                    </div>
        </DrilldownDrawer>
    );
}

/* ================= SMALL COMPONENTS ================= */

const Card = ({ title, children }) => (
    <div className="bg-white p-6 rounded-xl shadow">
        <h3 className="font-semibold text-sky-800 mb-4">
            {title}
        </h3>
        {children}
    </div>
);

const SummaryCard = ({ label, value }) => (
    <div>
        <div className="text-sky-200 text-s">
            {label}
        </div>
        <div className="font-bold text-lg">
            {value}
        </div>
    </div>
);