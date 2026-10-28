import React, { useState } from "react";
import { getExecutiveOverview } from "../../services/salesAnalyticsApi";
import { useSalesQuery } from "../../hooks/useSalesQuery";
import { useCommentary } from "../../hooks/useCommentary";
import { useSalesFilters } from "../../filters/SalesFiltersContext";
import { useSalesAccess } from "../../access/SalesAccessContext";
import SectionBlock, { SectionAccordion, insightsFor } from "../../components/SectionBlock";
import { InsightActionsProvider } from "../../components/insights/InsightActions";
import ChartCard from "../../components/ChartCard";
import TrendDrillCard from "../../components/TrendDrillCard";
import ContextFooter from "../../components/ContextFooter";
import PageToolbar from "../../components/PageToolbar";
import SimpleTable from "../../components/table/SimpleTable";
import DataTable from "../../components/table/DataTable";
import TableTabs from "../../components/table/TableTabs";
import EvidenceDrawer from "../../components/drawers/EvidenceDrawer";
import KpiBreakdownDrawer from "../../components/drawers/KpiBreakdownDrawer";
import ClientDetailDrawer from "../../components/drawers/ClientDetailDrawer";
import { ActivityChart, BillingChart, HorizontalBars, SalesCostChart } from "../../components/charts/Charts";
import { EmptyState, Spinner } from "../../../Budget/budgetHelpers";
import { exportPage, kpiCsvRows } from "../../utils/exportRows";
import { visibleColumns } from "../../calc/table";
import { formatYmShort } from "../../calc/dates";
import { count } from "../../utils/format";
import {
  BILLING_MONTHLY_COLUMNS, CLIENT_GROUPS, DEFAULT_LEADERBOARD_GROUPS, FUNNEL_COLUMNS, LEAD_TEAM_GROUPS, MANAGER_GROUPS, MONTHLY_COLUMNS,
  OPEN_JOB_ORDER_COLUMNS, RECRUITER_GROUPS,
} from "./directorOverviewColumns";

const col = (key, label, unit = "money") => ({ key, label, unit });
const allColumns = (groups) => visibleColumns(groups, groups.map((g) => g.id));
const fmtCount = (v) => count(v);

const TREND_COLUMNS = [col("label", "Month", "text"), col("revenue", "Revenue"), col("cmpRevenue", "Comparison revenue"), col("gp", "GP"), col("cmpGp", "Comparison GP"), col("gmPct", "GM", "pct")];

/**
 * Director Overview: how the recruiting org is performing financially —
 * active contractors and billing first, then revenue & GP, each recruiter's
 * billing, clients and recruiting cost, with candidate activity, conversion
 * and speed after them as the pipeline that feeds billing.
 */
export default function ExecutiveOverviewPage() {
  const { viewer, access } = useSalesAccess();
  const { filters } = useSalesFilters();
  const { data, meta, loading, error } = useSalesQuery(getExecutiveOverview, filters, viewer);
  const [tile, setTile] = useState(null);
  const [evidence, setEvidence] = useState(null);
  const [clientId, setClientId] = useState(null);
  const commentary = useCommentary("executive", {
    savedBy: access?.user?.name || "",
    filtersLabel: meta ? `${meta.period.label} vs ${meta.compareBasis}` : "",
  });

  if (error) return <div className="bg-white rounded-xl border border-sky-100"><EmptyState label={error.message} /></div>;
  if (!data) return <Spinner label="Loading director overview…" />;

  const sectionById = Object.fromEntries(data.kpiSections.map((s) => [s.id, s]));
  const section = (id, children, extra = {}) => (
    <SectionBlock key={id} section={sectionById[id]} insights={insightsFor(data.insights, id)} onDrill={setTile} {...extra}>
      {children}
    </SectionBlock>
  );

  const rec = data.recruiting;
  const monthly = rec.monthly.map((m) => ({ ...m, label: formatYmShort(m.ym) }));
  const funnel = rec.funnel.map((s, i) => ({ ...s, ofPrevious: i && rec.funnel[i - 1].count ? (s.count / rec.funnel[i - 1].count) * 100 : null }));
  const costTable = {
    columns: [col("label", "Month", "text"), col("gp", "GP"), col("commission", "Commissions"), col("travel", "Travel"), col("entertainment", "Entertainment"), col("acquisition", "Acquisition"), col("salary", "Salary allocation"), col("salesExpense", "Total recruiting expense"), col("contribution", "Contribution")],
    rows: data.salesCost,
  };
  const growthTable = {
    columns: [col("label", "Category", "text"), col("count", "Clients", "count"), col("revenue", "Revenue now"), col("revenueBase", "Revenue prior year"), col("change", "Change")],
    rows: data.growth,
  };
  const billingMonthly = data.billingMonthly;
  const leaderboards = [
    { id: "recruiters", label: "Recruiters", groups: RECRUITER_GROUPS, rows: rec.recruiters, rowKey: "repId", description: "Each recruiter's active contractors, billed hours, bill revenue, payroll, GP and rates this period. Add the Activity, Conversion and Speed groups for their recruiting." },
    { id: "teams", label: "Lead teams", groups: LEAD_TEAM_GROUPS, rows: rec.leadTeams, rowKey: "key", description: "Recruiters summed into their Recruiter Lead's team; rates are recalculated from the team's totals." },
    { id: "managers", label: "Account managers", groups: MANAGER_GROUPS, rows: rec.accountManagers, rowKey: "key", description: "Each Account Manager's book of lead teams." },
  ];

  const onExport = (includeCommentary) =>
    exportPage({
      filename: `recruiter-analytics-director-${meta.period.label}.csv`,
      meta,
      blocks: [
        { title: "Key metrics", rows: kpiCsvRows(data.kpiSections) },
        { title: "Contractors & billing by month", columns: BILLING_MONTHLY_COLUMNS, data: billingMonthly },
        ...leaderboards.map((l) => ({ title: l.label, columns: allColumns(l.groups), data: l.rows })),
        { title: "Open job orders", columns: OPEN_JOB_ORDER_COLUMNS, data: rec.openJobOrders },
        { title: "Recruiting activity by month", columns: MONTHLY_COLUMNS, data: monthly },
        { title: "Client performance", columns: allColumns(CLIENT_GROUPS), data: data.clientPerformance },
      ],
      commentaryItems: commentary.items,
      includeCommentary,
    });

  return (
    <InsightActionsProvider pageKey="executive" pageLabel="Director Overview" meta={meta} sections={data.kpiSections}>
      <SectionAccordion defaultOpen="staffing">
        <div className={`space-y-3 ${loading ? "opacity-70 transition-opacity" : ""}`}>
          <PageToolbar
            title="Director Overview"
            subtitle={`${meta.period.label} · revenue & GP vs ${meta.compareBasis}, contractors, billing and recruiting vs Prior Year · ${meta.scope.label}`}
            onExport={onExport}
            commentaryCount={commentary.items.length}
          />

          {section(
            "staffing",
            <ChartCard
              title="Contractors & billing by month"
              subtitle="Last 12 months · bill revenue, payroll and GP with average active contractors; the current month to date"
              table={{ columns: BILLING_MONTHLY_COLUMNS, rows: billingMonthly }}
              exportName="contractors-billing"
            >
              <BillingChart data={billingMonthly} height={270} />
            </ChartCard>
          )}

          {section(
            "financial",
            <TrendDrillCard
              trend={data.trend}
              compareLabel={meta.compareBasis}
              onAnalyze={() => setEvidence({ title: "Revenue & GP by month", sections: [{ title: "Last 12 months", columns: TREND_COLUMNS, rows: data.trend }] })}
            />
          )}

          {section(
            "productivity",
            <TableTabs
              label="Recruiter billing tables"
              tabs={leaderboards.map((l) => ({
                id: l.id,
                label: l.label,
                count: l.rows.length,
                description: l.description,
                render: () => <DataTable key={l.id} groups={l.groups} rows={l.rows} rowKey={l.rowKey} defaultGroups={DEFAULT_LEADERBOARD_GROUPS} defaultSort={{ key: "billRevenue", dir: "desc" }} />,
              }))}
            />
          )}

          {section(
            "clients",
            <div className="space-y-3">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-sky-900">
                  Client performance <span className="font-normal text-slate-500">· job orders, placements, fill rate, bill revenue, rates, payroll and GP by client</span>
                </p>
                <DataTable groups={CLIENT_GROUPS} rows={data.clientPerformance} rowKey="clientId" defaultSort={{ key: "revenue", dir: "desc" }} onRowClick={(r) => setClientId(r.clientId)} />
              </div>
              <ChartCard title="Client growth against prior year" subtitle="Revenue change by client movement; select a bar for the clients behind it" table={growthTable} exportName="client-growth">
                <HorizontalBars
                  data={data.growth}
                  dataKey="change"
                  nameKey="label"
                  height={200}
                  onSelect={(g) =>
                    setEvidence({
                      title: `${g.label} clients`,
                      subtitle: "Revenue this period against the same period last year",
                      sections: [{ title: `${g.label} (${g.count})`, columns: [col("name", "Client", "text"), col("revenue", "Revenue now"), col("revenueBase", "Revenue prior year"), col("change", "Change"), col("gp", "GP")], rows: g.clients }],
                    })
                  }
                />
              </ChartCard>
            </div>
          )}

          {section(
            "economics",
            <ChartCard
              title="Recruiting cost & contribution"
              subtitle="Monthly recruiting expense by category against GP; contribution = GP less recruiting expense (not EBITDA)"
              table={costTable}
              exportName="recruiting-cost-contribution"
              onAnalyze={() => setTile({ key: "salesContribution", label: "Recruiting contribution" })}
            >
              <SalesCostChart data={data.salesCost} height={240} />
            </ChartCard>
          )}

          {section(
            "activity",
            <ChartCard title="Recruiting activity by month" subtitle="Last 12 months · the current month to date" table={{ columns: MONTHLY_COLUMNS, rows: monthly }} exportName="recruiting-activity">
              <ActivityChart data={monthly} height={260} />
            </ChartCard>
          )}

          {section(
            "conversion",
            <ChartCard title="Candidate funnel this period" subtitle="Candidates by stage reached in this period, from submittal to accepted offer" table={{ columns: FUNNEL_COLUMNS, rows: funnel }} exportName="candidate-funnel">
              <HorizontalBars data={funnel} dataKey="count" nameKey="stage" formatter={fmtCount} height={190} />
            </ChartCard>
          )}

          {section(
            "speed",
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-sky-900">
                Open job orders, oldest first <span className="font-normal text-slate-500">· stage and candidates as of the data date</span>
              </p>
              <SimpleTable columns={OPEN_JOB_ORDER_COLUMNS} rows={rec.openJobOrders} maxHeight="360px" emptyLabel="No open job orders." />
            </div>
          )}

          <ContextFooter meta={meta} />

          <KpiBreakdownDrawer tile={tile} onClose={() => setTile(null)} />
          <ClientDetailDrawer clientId={clientId} onClose={() => setClientId(null)} />
          <EvidenceDrawer open={!!evidence} onClose={() => setEvidence(null)} title={evidence?.title || ""} subtitle={evidence?.subtitle} sections={evidence?.sections} />
        </div>
      </SectionAccordion>
    </InsightActionsProvider>
  );
}
