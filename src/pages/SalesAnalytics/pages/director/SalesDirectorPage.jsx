import React, { useMemo, useState } from "react";
import { getDirectorView } from "../../services/salesAnalyticsApi";
import { useSalesQuery } from "../../hooks/useSalesQuery";
import { useCommentary } from "../../hooks/useCommentary";
import { useSalesFilters } from "../../filters/SalesFiltersContext";
import { useSalesAccess } from "../../access/SalesAccessContext";
import SectionBlock, { SectionAccordion, insightsFor } from "../../components/SectionBlock";
import { InsightActionsProvider } from "../../components/insights/InsightActions";
import ContextFooter from "../../components/ContextFooter";
import PageToolbar from "../../components/PageToolbar";
import DataTable from "../../components/table/DataTable";
import TableTabs from "../../components/table/TableTabs";
import KpiBreakdownDrawer from "../../components/drawers/KpiBreakdownDrawer";
import RepSummaryDrawer from "../../components/drawers/RepSummaryDrawer";
import ClientDetailDrawer from "../../components/drawers/ClientDetailDrawer";
import { EmptyState, Spinner } from "../../../Budget/budgetHelpers";
import { exportPage, kpiCsvRows } from "../../utils/exportRows";
import { visibleColumns } from "../../calc/table";
import { LEADERBOARD_GROUPS, LEADERBOARD_PRESETS, DIRECTOR_TABLES } from "./directorColumns";

const sumKeys = ["revenue", "revenueTarget", "revenueVar", "gp", "gpTarget", "gpVar", "contractors", "starts", "ends", "billedHours", "directCost", "commission", "commissionApproved", "travel", "entertainment", "salary", "salesExpense", "salesCostOverrun", "contribution", "newClientsWon", "weightedPipeline", "weightedGpPipeline", "agingOpportunities", "priorQuarterRevenue", "priorQuarterGp", "quarterForecastRevenue", "quarterForecastGp", "contractorGrowth"];

// Which team tables sit in which section.
const SECTION_TABLES = {
  "team-financial": ["leaderboard", "clientPerformance"],
  "team-costs": ["repExpenses"],
  "team-staffing": ["staffingRateCost"],
  "team-pipeline": ["newClientWins", "pipelineSlippage", "teamForecast"],
};

function leaderboardTotals(rows) {
  if (!rows.length) return null;
  const t = {};
  for (const k of sumKeys) {
    if (rows.some((r) => r[k] == null && r.__masked?.includes(k))) {
      t[k] = null;
      t.__masked = [...(t.__masked || []), k];
    } else t[k] = rows.reduce((s, r) => s + (r[k] || 0), 0);
  }
  t.gmPct = t.revenue ? (t.gp / t.revenue) * 100 : null;
  t.gpAttainment = t.gpTarget ? (t.gp / t.gpTarget) * 100 : null;
  return t;
}

export default function SalesDirectorPage() {
  const { viewer, access } = useSalesAccess();
  const { filters } = useSalesFilters();
  const { data, meta, loading, error } = useSalesQuery(getDirectorView, filters, viewer);
  const [tile, setTile] = useState(null);
  const [repId, setRepId] = useState(null);
  const [client, setClient] = useState(null);
  const [lbColumns, setLbColumns] = useState([]);
  const commentary = useCommentary("director", {
    savedBy: access?.user?.name || "",
    filtersLabel: meta ? `${meta.period.label} vs ${meta.compareBasis} · ${meta.scope.label}` : "",
  });
  const totals = useMemo(() => leaderboardTotals(data?.leaderboard || []), [data]);

  if (error) return <div className="bg-white rounded-xl border border-sky-100"><EmptyState label={error.message} /></div>;
  if (!data) return <Spinner label="Loading team performance…" />;

  const openRow = (table) => (row) => {
    if (table.rowOpens === "client" && row.clientId) setClient({ clientId: row.clientId });
    else if (table.rowOpens === "rep" && row.repId) setRepId(row.repId);
  };

  const tabFor = (id) => {
    if (id === "leaderboard") {
      return {
        id,
        label: "Salesperson leaderboard",
        count: data.leaderboard.length,
        description: "Choose column groups and a ranking; select a salesperson for their detail. YTD attainment is against the Sales Target; quarter forecasts use submissions where they exist and a system run-rate otherwise.",
        render: () => (
          <DataTable
            groups={LEADERBOARD_GROUPS}
            rows={data.leaderboard}
            rowKey="repId"
            presets={LEADERBOARD_PRESETS}
            defaultSort={{ key: "gp", dir: "desc" }}
            defaultGroups={["identity", "performance", "staffing", "costs"]}
            totals={totals}
            onRowClick={(r) => setRepId(r.repId)}
            onVisibleColumnsChange={setLbColumns}
          />
        ),
      };
    }
    const table = DIRECTOR_TABLES.find((t) => t.id === id);
    const rows = data.tables[id] || [];
    return {
      id,
      label: table.label,
      count: rows.length,
      description: table.description,
      render: () => (
        <DataTable
          key={id}
          groups={table.groups}
          rows={rows}
          rowKey={table.rowKey}
          defaultSort={table.defaultSort}
          onRowClick={table.rowOpens ? openRow(table) : undefined}
          emptyLabel={table.emptyLabel}
        />
      ),
    };
  };

  const onExport = (includeCommentary) =>
    exportPage({
      filename: `sales-performance-director-${meta.period.label}.csv`,
      meta,
      blocks: [
        { title: "Team metrics", rows: kpiCsvRows(data.kpiSections) },
        { title: "Salesperson leaderboard", columns: lbColumns.length ? lbColumns : visibleColumns(LEADERBOARD_GROUPS, LEADERBOARD_GROUPS.map((g) => g.id)), data: data.leaderboard },
        ...DIRECTOR_TABLES.map((t) => ({ title: t.label, columns: visibleColumns(t.groups, t.groups.map((g) => g.id)), data: data.tables[t.id] || [] })),
      ],
      commentaryItems: commentary.items,
      includeCommentary,
    });

  return (
    <InsightActionsProvider pageKey="director" pageLabel="Sales Director" meta={meta} sections={data.kpiSections}>
      <SectionAccordion defaultOpen={data.kpiSections[0]?.id}>
        <div className={`space-y-3 ${loading ? "opacity-70 transition-opacity" : ""}`}>
          <PageToolbar
            title="Sales Director Performance"
            subtitle={`${meta.scope.label} · ${data.leaderboard.length} salespeople · ${meta.period.label} vs ${meta.compareBasis}`}
            onExport={onExport}
            commentaryCount={commentary.items.length}
          />

          {data.kpiSections.map((s) => (
            <SectionBlock key={s.id} section={s} insights={insightsFor(data.insights, s.id)} onDrill={setTile}>
              {SECTION_TABLES[s.id] ? <TableTabs tabs={SECTION_TABLES[s.id].map(tabFor)} label={`${s.title} tables`} /> : null}
            </SectionBlock>
          ))}

          <ContextFooter meta={meta} />

          <KpiBreakdownDrawer tile={tile} onClose={() => setTile(null)} />
          <RepSummaryDrawer repId={repId} onClose={() => setRepId(null)} onOpenClient={(clientId, rid) => setClient({ clientId, repId: rid })} />
          <ClientDetailDrawer clientId={client?.clientId} repId={client?.repId} onClose={() => setClient(null)} />
        </div>
      </SectionAccordion>
    </InsightActionsProvider>
  );
}
