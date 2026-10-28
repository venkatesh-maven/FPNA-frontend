import React from "react";
import { FiX } from "react-icons/fi";
import DrilldownDrawer, { DrilldownBodySkeleton, DrilldownFadeIn, DrilldownSummarySkeleton } from "../../../FinancialReports/DrilldownDrawer";
import { getClientDetail } from "../../services/salesAnalyticsApi";
import { useSalesQuery } from "../../hooks/useSalesQuery";
import { useSalesFilters } from "../../filters/SalesFiltersContext";
import { useSalesAccess } from "../../access/SalesAccessContext";
import SimpleTable from "../table/SimpleTable";
import { ActualVsTargetChart } from "../charts/Charts";
import { formatDate, formatYmShort } from "../../calc/dates";
import { compactMoney, hours, pct } from "../../utils/format";

const col = (key, label, unit = "money") => ({ key, label, unit });

const Summary = ({ label, value, sub }) => (
  <div>
    <div className="text-sky-200 text-xs">{label}</div>
    <div className="font-bold text-lg">{value}</div>
    {sub ? <div className="text-sky-200 text-xs">{sub}</div> : null}
  </div>
);

/** One client: monthly actual vs target, the assignments behind the period, and open job orders. */
export default function ClientDetailDrawer({ clientId, repId, onClose }) {
  const { filters } = useSalesFilters();
  const { viewer } = useSalesAccess();
  const args = { clientId, ...(repId ? { repId } : {}) };
  const { data, meta, loading } = useSalesQuery(getClientDetail, filters, viewer, args, { enabled: !!clientId });
  const c = data?.client;
  const months = (data?.monthly || []).map((m) => ({ ...m, label: formatYmShort(m.ym) }));

  return (
    <DrilldownDrawer open={!!clientId} onClose={onClose}>
      <div className="px-6 py-5 bg-gradient-to-r from-sky-900 to-sky-700 text-white">
        <div className="flex justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold">{c ? c.name : "Client"}</h2>
            <p className="text-sky-200 text-sm mt-1">
              {c ? `${c.vertical} · ${c.location} · ${c.serviceType}${c.isMsp ? " · MSP / VMS" : ""} · client since ${formatDate(c.acquiredDate)}` : "Loading…"}
            </p>
            {c ? <p className="text-sky-200 text-xs mt-0.5">Recruiters (GP share): {c.owners.map((o) => `${o.name}${o.share < 100 ? ` (${Math.round(o.share)}%)` : ""}`).join(", ")}</p> : null}
            {loading && !c ? <DrilldownSummarySkeleton /> : null}
            {data?.totals ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mt-4">
                <Summary label={`Revenue · ${meta?.period?.label}`} value={compactMoney(data.totals.revenue)} />
                <Summary label="GP" value={compactMoney(data.totals.gp)} sub={`GM ${pct(data.totals.gmPct)}`} />
                <Summary label="Billed hours" value={hours(data.totals.billedHours)} />
                <Summary label="Assignments billed" value={data.assignments.length} sub={`${data.openOpportunities.length} open job orders`} />
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
        {data && !c ? <p className="text-sm text-sky-700">This client isn't in your scope.</p> : null}
        {c ? (
          <DrilldownFadeIn className="space-y-5">
            <div className="bg-white rounded-xl shadow-sm border border-sky-100 p-4">
              <h3 className="font-semibold text-sky-900 text-sm mb-2">Revenue by month against Recruiting Target, with billable contractors</h3>
              <ActualVsTargetChart data={months} actualKey="revenue" targetKey="revenueTarget" actualLabel="Revenue" targetLabel="Revenue target" lineKey="contractors" lineLabel="Contractors" height={240} />
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-sky-100 p-4">
              <h3 className="font-semibold text-sky-900 text-sm mb-2">Assignments and contractors in the period</h3>
              <SimpleTable
                columns={[
                  col("contractor", "Contractor", "text"), col("title", "Role", "text"), col("placementType", "Type", "text"),
                  col("startDate", "Start", "date"), col("endDate", "End / planned end", "date"),
                  col("billedHours", "Billed hrs", "hours"), col("paidHours", "Paid hrs", "hours"),
                  col("avgBillRate", "Bill rate", "rate"), col("avgPayRate", "Pay rate", "rate"),
                  col("wages", "Wages"), col("burden", "Burden"), col("otherDirect", "Other direct"),
                  col("revenue", "Revenue"), col("gp", "GP"), col("gmPct", "GM", "pct"),
                ]}
                rows={data.assignments}
                maxHeight="360px"
              />
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-sky-100 p-4">
              <h3 className="font-semibold text-sky-900 text-sm mb-2">Open job orders and expected first billing</h3>
              <SimpleTable
                columns={[col("id", "Job order", "text"), col("owner", "Recruiter", "text"), col("stage", "Stage", "text"), col("probability", "Probability", "pct"), col("headcount", "Contractors", "count"), col("weightedGp", "Weighted GP"), col("expectedStart", "Expected start", "date"), col("expectedFirstBilling", "First billing", "date")]}
                rows={data.openOpportunities}
                emptyLabel="No open job orders with this client."
              />
            </div>
          </DrilldownFadeIn>
        ) : null}
      </div>
    </DrilldownDrawer>
  );
}
