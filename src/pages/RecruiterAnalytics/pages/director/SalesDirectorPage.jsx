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
import { LEADERBOARD_GROUPS, LEADERBOARD_PRESETS, DIRECTOR_TABLES, LEAD_TEAM_GROUPS } from "./directorColumns";

const sumKeys = ["revenue", "revenueTarget", "revenueVar", "gp", "gpTarget", "gpVar", "contractors", "starts", "ends", "billedHours", "paidHours", "billRevenue", "payroll", "directCost", "commission", "commissionApproved", "travel", "entertainment", "salary", "salesExpense", "salesCostOverrun", "contribution", "newClientsWon", "weightedPipeline", "weightedGpPipeline", "agingOpportunities", "priorQuarterRevenue", "priorQuarterGp", "quarterForecastRevenue", "quarterForecastGp", "contractorGrowth"];

// Which team tables sit in which section. Contractors & billing carries the
// recruiter leaderboard; the Account Manager view leads it with its lead teams.
const SECTION_TABLES = {
  "team-staffing": ["leaderboard", "staffingRateCost"],
  "team-financial": ["clientPerformance"],
  "team-costs": ["repExpenses"],
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
  // Rates from the summed hours and dollars (payroll is null when masked).
  t.avgBillRate = t.billedHours ? t.billRevenue / t.billedHours : null;
  t.avgPayRate = t.payroll != null && t.paidHours ? t.payroll / t.paidHours : null;
  t.spread = t.payroll != null && t.billedHours ? (t.billRevenue - t.payroll) / t.billedHours : null;
  return t;
}

/** Lead-team rows for the Account Manager view: the recruiter leaderboard summed by team. */
function leadTeamRows(leaderboard, leadTeams = []) {
  return leadTeams.map((t) => {
    const rows = leaderboard.filter((r) => r.teamId === t.teamId);
    return { ...(leaderboardTotals(rows) || {}), ...t, recruiters: rows.length };
  });
}

/**
 * Team performance for two layers of the recruiting hierarchy: an Account
 * Manager's book (lead teams, then recruiters) or a Recruiter Lead's team.
 */
export default function SalesDirectorPage({ level = "lead" }) {
  const manager = level === "manager";
  const pageLabel = manager ? "Account Manager" : "Recruiter Lead";
  const { viewer, access } = useSalesAccess();
  const { filters } = useSalesFilters();
  const { data, meta, loading, error } = useSalesQuery(getDirectorView, filters, viewer);
  const [tile, setTile] = useState(null);
  const [repId, setRepId] = useState(null);
  const [client, setClient] = useState(null);
  const [lbColumns, setLbColumns] = useState([]);
  const commentary = useCommentary(level, {
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
    if (id === "leadTeams") {
      const rows = leadTeamRows(data.leaderboard, data.leadTeams);
      return {
        id,
        label: "Lead teams",
        count: rows.length,
        description: "Each Recruiter Lead's team under you, summed from its recruiters. Select a recruiter on the leaderboard for their detail.",
        render: () => <DataTable groups={LEAD_TEAM_GROUPS} rows={rows} rowKey="teamId" defaultSort={{ key: "billRevenue", dir: "desc" }} totals={totals} />,
      };
    }
    if (id === "leaderboard") {
      return {
        id,
        label: "Recruiter leaderboard",
        count: data.leaderboard.length,
        description: "Each recruiter's active contractors, billed hours, bill revenue, payroll and rates, then revenue & GP. Choose column groups and a ranking; select a recruiter for their detail. YTD attainment is against the Recruiting Target; quarter forecasts use submissions where they exist and a system run-rate otherwise.",
        render: () => (
          <DataTable
            groups={LEADERBOARD_GROUPS}
            rows={data.leaderboard}
            rowKey="repId"
            presets={LEADERBOARD_PRESETS}
            defaultSort={{ key: "billRevenue", dir: "desc" }}
            defaultGroups={["identity", "staffing", "performance"]}
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
      filename: `recruiter-analytics-team-${meta.period.label}.csv`,
      meta,
      blocks: [
        { title: "Team metrics", rows: kpiCsvRows(data.kpiSections) },
        { title: "Recruiter leaderboard", columns: lbColumns.length ? lbColumns : visibleColumns(LEADERBOARD_GROUPS, LEADERBOARD_GROUPS.map((g) => g.id)), data: data.leaderboard },
        ...DIRECTOR_TABLES.map((t) => ({ title: t.label, columns: visibleColumns(t.groups, t.groups.map((g) => g.id)), data: data.tables[t.id] || [] })),
      ],
      commentaryItems: commentary.items,
      includeCommentary,
    });

  return (
    <InsightActionsProvider pageKey={level} pageLabel={pageLabel} meta={meta} sections={data.kpiSections}>
      <SectionAccordion defaultOpen={data.kpiSections[0]?.id}>
        <div className={`space-y-3 ${loading ? "opacity-70 transition-opacity" : ""}`}>
          <PageToolbar
            title={`${pageLabel} Performance`}
            subtitle={`${meta.scope.label} · ${manager ? `${data.leadTeams.length} lead teams · ` : ""}${data.leaderboard.length} recruiters · ${meta.period.label} vs ${meta.compareBasis}`}
            onExport={onExport}
            commentaryCount={commentary.items.length}
          />

          {data.kpiSections.map((s) => (
            <SectionBlock key={s.id} section={s} insights={insightsFor(data.insights, s.id)} onDrill={setTile}>
              {SECTION_TABLES[s.id] ? <TableTabs tabs={(manager && s.id === "team-staffing" ? ["leadTeams", ...SECTION_TABLES[s.id]] : SECTION_TABLES[s.id]).map(tabFor)} label={`${s.title} tables`} /> : null}
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
