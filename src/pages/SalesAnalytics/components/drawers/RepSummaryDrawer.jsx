import React from "react";
import { FiX } from "react-icons/fi";
import DrilldownDrawer, { DrilldownBodySkeleton, DrilldownFadeIn, DrilldownSummarySkeleton } from "../../../FinancialReports/DrilldownDrawer";
import { getRepSummary } from "../../services/salesAnalyticsApi";
import { useSalesQuery } from "../../hooks/useSalesQuery";
import { useSalesFilters } from "../../filters/SalesFiltersContext";
import { useSalesAccess } from "../../access/SalesAccessContext";
import SimpleTable from "../table/SimpleTable";
import MaskedValue from "../MaskedValue";
import { ActualVsTargetChart } from "../charts/Charts";
import { formatYmShort } from "../../calc/dates";
import { compactMoney, money, pct } from "../../utils/format";

const col = (key, label, unit = "money") => ({ key, label, unit });
const CATEGORY = { commission: "Commission", travel: "Travel", entertainment: "Entertainment", acquisition: "Acquisition", salary: "Salary allocation" };

const Summary = ({ label, value, sub }) => (
  <div>
    <div className="text-sky-200 text-xs">{label}</div>
    <div className="font-bold text-lg">{value}</div>
    {sub ? <div className="text-sky-200 text-xs">{sub}</div> : null}
  </div>
);

/** One salesperson for a director: headline figures, months, clients, deals and expenses. */
export default function RepSummaryDrawer({ repId, onClose, onOpenClient }) {
  const { filters } = useSalesFilters();
  const { viewer } = useSalesAccess();
  const { data, meta, loading } = useSalesQuery(getRepSummary, filters, viewer, { repId }, { enabled: !!repId });
  const r = data?.rep;
  const months = (data?.monthly || []).map((m) => ({ ...m, label: formatYmShort(m.ym) }));

  return (
    <DrilldownDrawer open={!!repId} onClose={onClose}>
      <div className="px-6 py-5 bg-gradient-to-r from-sky-900 to-sky-700 text-white">
        <div className="flex justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold">{r ? r.name : "Salesperson"}</h2>
            <p className="text-sky-200 text-sm mt-1">{r ? `${r.team} · ${r.territory} · ${meta?.period?.label}` : "Loading…"}</p>
            {loading && !r ? <DrilldownSummarySkeleton /> : null}
            {r ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mt-4">
                <Summary label="GP" value={compactMoney(r.gp)} sub={`${r.gpAttainment != null ? pct(r.gpAttainment, 0) : "—"} of target`} />
                <Summary label="Revenue" value={compactMoney(r.revenue)} sub={`Target ${compactMoney(r.revenueTarget)}`} />
                <Summary label="Contribution" value={compactMoney(r.contribution)} sub={r.salesExpense == null ? null : `Sales expense ${compactMoney(r.salesExpense)}`} />
                <Summary label="Contractors on billing" value={r.contractors} sub={`${r.starts} starts · ${r.ends} ends`} />
              </div>
            ) : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="self-start">
            <FiX size={22} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6 space-y-5">
        {loading && !data ? <DrilldownBodySkeleton /> : null}
        {data ? (
          <DrilldownFadeIn className="space-y-5">
            <div className="bg-white rounded-xl shadow-sm border border-sky-100 p-4">
              <h3 className="font-semibold text-sky-900 text-sm mb-2">GP by month against Sales Target (fiscal year)</h3>
              <ActualVsTargetChart data={months} actualKey="gp" targetKey="gpTarget" actualLabel="GP" targetLabel="GP target" height={240} />
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-sky-100 p-4">
              <h3 className="font-semibold text-sky-900 text-sm mb-2">Clients</h3>
              <SimpleTable
                columns={[col("client", "Client", "text"), col("revenue", "Revenue"), col("gp", "GP"), col("gmPct", "GM", "pct"), col("contractors", "Avg contractors", "count"), col("avgBillRate", "Bill rate", "rate"), col("avgPayRate", "Pay rate", "rate"), col("contribution", "Contribution")]}
                rows={data.clients}
                maxHeight="320px"
                onRowClick={onOpenClient ? (row) => onOpenClient(row.clientId, repId) : undefined}
              />
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-sky-100 p-4">
              <h3 className="font-semibold text-sky-900 text-sm mb-2">Open opportunities</h3>
              <SimpleTable
                columns={[col("name", "Client / prospect", "text"), col("stage", "Stage", "text"), col("probability", "Probability", "pct"), col("weightedGp", "Weighted GP"), col("expectedStart", "Expected start", "date"), col("daysInStage", "Days in stage", "count"), col("nextAction", "Next action", "text")]}
                rows={data.openOpportunities}
                maxHeight="280px"
              />
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-sky-100 p-4">
              <h3 className="font-semibold text-sky-900 text-sm mb-2">Sales expense transactions in the period</h3>
              <SimpleTable
                columns={[
                  col("ym", "Month", "text"),
                  { key: "category", label: "Category", unit: "text", render: (row) => CATEGORY[row.category] || row.category },
                  { key: "status", label: "Status", unit: "text", render: (row) => (row.category === "commission" ? (row.status === "approved" ? "Approved / payable" : "Earned / accrued") : "Posted") },
                  { key: "amount", label: "Amount", unit: "money", render: (row) => (row.amount == null ? <MaskedValue /> : money(row.amount)) },
                  col("memo", "Description", "text"),
                ]}
                rows={data.expenses}
                maxHeight="320px"
                emptyLabel="No sales expense recorded, or the detail is restricted for your role."
              />
            </div>
          </DrilldownFadeIn>
        ) : null}
      </div>
    </DrilldownDrawer>
  );
}
