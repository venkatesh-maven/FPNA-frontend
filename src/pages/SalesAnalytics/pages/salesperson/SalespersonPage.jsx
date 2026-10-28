import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiPlayCircle } from "react-icons/fi";
import { getSalespersonView } from "../../services/salesAnalyticsApi";
import { useSalesQuery } from "../../hooks/useSalesQuery";
import { useCommentary } from "../../hooks/useCommentary";
import { useSalesFilters } from "../../filters/SalesFiltersContext";
import { useSalesAccess } from "../../access/SalesAccessContext";
import SectionBlock, { SectionAccordion, insightsFor } from "../../components/SectionBlock";
import { InsightActionsProvider } from "../../components/insights/InsightActions";
import ContextFooter from "../../components/ContextFooter";
import PageToolbar from "../../components/PageToolbar";
import DataTable from "../../components/table/DataTable";
import SimpleTable from "../../components/table/SimpleTable";
import ChartCard from "../../components/ChartCard";
import KpiBreakdownDrawer from "../../components/drawers/KpiBreakdownDrawer";
import ClientDetailDrawer from "../../components/drawers/ClientDetailDrawer";
import MaskedValue from "../../components/MaskedValue";
import { ActualVsTargetChart } from "../../components/charts/Charts";
import { EmptyState, Spinner } from "../../../Budget/budgetHelpers";
import { formatYmShort } from "../../calc/dates";
import { exportPage, kpiCsvRows } from "../../utils/exportRows";
import { money } from "../../utils/format";
import { SALES_ANALYTICS_BASE } from "../../config/tabs";
import { CLIENT_GROUPS } from "./salespersonColumns";

const col = (key, label, unit = "money") => ({ key, label, unit });

const ENDING_COLUMNS = [col("client", "Client", "text"), col("contractor", "Contractor", "text"), col("title", "Role", "text"), col("plannedEndDate", "Planned end", "date"), col("billRate", "Bill rate", "rate"), col("extensions", "Extensions so far", "count")];
const DEAL_COLUMNS = [col("name", "Opportunity", "text"), col("type", "Type", "text"), col("stage", "Stage", "text"), col("probability", "Probability", "pct"), col("expectedRevenue", "Expected revenue"), col("weightedGp", "Weighted GP"), col("expectedStart", "Expected start", "date"), col("daysInStage", "Days in stage", "count"), col("nextAction", "Next action", "text")];

function CommissionPlan({ commission, onSimulate }) {
  const value = (v) => (v == null ? <MaskedValue /> : money(v));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-100 bg-sky-50/50 px-3 py-2">
      <div className="text-xs text-sky-800 space-y-0.5">
        <p>
          <span className="font-semibold text-sky-900">Commission plan:</span> {commission.plan}.
        </p>
        <p>
          Earned this period {value(commission.earned)} (approved {value(commission.commissionApproved)}, accrued not yet approved {value(commission.commissionAccrued)}) · projected for
          the rest of the quarter {value(commission.commissionProjected)}. Projected amounts are not earned until the GP bills.
        </p>
      </div>
      {onSimulate ? (
        <button type="button" onClick={onSimulate} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-800 print:hidden">
          <FiPlayCircle size={13} /> Simulate my commission
        </button>
      ) : null}
    </div>
  );
}

export default function SalespersonPage() {
  const { viewer, access, can } = useSalesAccess();
  const { filters, options } = useSalesFilters();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const repParam = params.get("sp") || undefined;
  const args = access?.scope?.kind === "own" ? {} : { repId: repParam };
  const { data, meta, loading, error } = useSalesQuery(getSalespersonView, filters, viewer, args);
  const [tile, setTile] = useState(null);
  const [clientId, setClientId] = useState(null);
  const pageKey = `salesperson-${data?.rep?.id || "me"}`;
  const commentary = useCommentary(pageKey, {
    savedBy: access?.user?.name || "",
    filtersLabel: meta ? `${meta.period.label} vs ${meta.compareBasis}` : "",
  });

  if (error) return <div className="bg-white rounded-xl border border-sky-100"><EmptyState label={error.message} /></div>;
  if (!data) return <Spinner label="Loading performance…" />;
  if (!data.rep) return <div className="bg-white rounded-xl border border-sky-100"><EmptyState label="No salesperson in your scope." /></div>;

  const months = data.monthly.map((m) => ({ ...m, label: formatYmShort(m.ym) }));
  const simulate = can("create_scenario")
    ? (focus) => navigate({ pathname: `${SALES_ANALYTICS_BASE}/what-if`, search: params.toString() }, { state: { prefill: { focus }, repId: data.rep.id } })
    : null;
  const picker =
    access?.scope?.kind !== "own" ? (
      <label className="flex items-center gap-2 text-sm text-sky-800">
        Salesperson
        <select
          value={data.rep.id}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            next.set("sp", e.target.value);
            setParams(next);
          }}
          className="border border-sky-200 rounded-md bg-white px-2 py-1.5 text-sm"
        >
          {(options?.reps || []).map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </label>
    ) : null;

  const onExport = (includeCommentary) =>
    exportPage({
      filename: `sales-performance-${data.rep.name}-${meta.period.label}.csv`,
      meta,
      blocks: [
        { title: "My metrics", rows: kpiCsvRows(data.kpiSections) },
        { title: "Clients", columns: CLIENT_GROUPS.flatMap((g) => g.columns), data: data.clients },
      ],
      commentaryItems: commentary.items,
      includeCommentary,
    });

  const sectionChildren = {
    "my-financial": (
      <ChartCard title="GP by month against target (fiscal year)" subtitle="Bars: actual vs Sales Target · line: average contractors on billing">
        <ActualVsTargetChart data={months} actualKey="gp" targetKey="gpTarget" actualLabel="GP" targetLabel="GP target" lineKey="contractors" lineLabel="Contractors" height={240} />
      </ChartCard>
    ),
    "my-staffing": (
      <ChartCard
        title="Assignments ending in the next 60 days"
        subtitle="Extension and redeployment opportunities"
        table={{ columns: ENDING_COLUMNS, rows: data.endingSoon }}
        exportName="assignments-ending-soon"
        actions={
          simulate ? (
            <button type="button" onClick={() => simulate("staffing")} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-sky-700 hover:text-sky-950">
              <FiPlayCircle size={12} /> Model extensions
            </button>
          ) : null
        }
      >
        <SimpleTable columns={ENDING_COLUMNS} rows={data.endingSoon} maxHeight="260px" emptyLabel="No assignments end in the next 60 days." />
      </ChartCard>
    ),
    "my-commission": <CommissionPlan commission={data.commission} onSimulate={simulate ? () => simulate("commission") : null} />,
    "my-pipeline": (
      <ChartCard title="My open deals" subtitle="Ranked by weighted GP" table={{ columns: DEAL_COLUMNS, rows: data.openDeals }} exportName="my-open-deals">
        <SimpleTable columns={DEAL_COLUMNS} rows={data.openDeals} maxHeight="300px" emptyLabel="No open deals for the current filters." />
      </ChartCard>
    ),
  };

  return (
    <InsightActionsProvider pageKey={pageKey} pageLabel="My Performance" meta={meta} sections={data.kpiSections} repId={data.rep.id}>
      <SectionAccordion defaultOpen={data.kpiSections[0]?.id}>
        <div className={`space-y-3 ${loading ? "opacity-70 transition-opacity" : ""}`}>
          <PageToolbar
            title={`My Performance · ${data.rep.name}`}
            subtitle={`${data.rep.title} · ${data.rep.team} · ${data.rep.branch} · ${meta.period.label} vs ${meta.compareBasis}`}
            onExport={onExport}
            commentaryCount={commentary.items.length}
          >
            {picker}
          </PageToolbar>

          {data.kpiSections.map((s) => (
            <SectionBlock key={s.id} section={s} insights={insightsFor(data.insights, s.id)} onDrill={setTile}>
              {sectionChildren[s.id] || null}
            </SectionBlock>
          ))}

          <SectionBlock section={{ id: "my-clients", title: "My clients" }} subtitle="Revenue and GP credited by your ownership share; select a client for assignments, months and open deals">
            <DataTable
              groups={CLIENT_GROUPS}
              rows={data.clients}
              rowKey="clientId"
              defaultSort={{ key: "gp", dir: "desc" }}
              defaultGroups={["client", "financial", "staffing", "action"]}
              onRowClick={(r) => setClientId(r.clientId)}
            />
          </SectionBlock>

          <ContextFooter meta={meta} />

          <KpiBreakdownDrawer tile={tile} repId={data.rep.id} onClose={() => setTile(null)} />
          <ClientDetailDrawer clientId={clientId} repId={data.rep.id} onClose={() => setClientId(null)} />
        </div>
      </SectionAccordion>
    </InsightActionsProvider>
  );
}
