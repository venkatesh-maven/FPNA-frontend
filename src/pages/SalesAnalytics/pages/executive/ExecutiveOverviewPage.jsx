import React, { useMemo, useState } from "react";
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
import EvidenceDrawer from "../../components/drawers/EvidenceDrawer";
import KpiBreakdownDrawer from "../../components/drawers/KpiBreakdownDrawer";
import { HorizontalBars, SalesCostChart, WaterfallChart } from "../../components/charts/Charts";
import { EmptyState, Spinner } from "../../../Budget/budgetHelpers";
import { exportPage, kpiCsvRows } from "../../utils/exportRows";
import { compactMoney, money } from "../../utils/format";

const col = (key, label, unit = "money") => ({ key, label, unit });

const GEO_DIMS = [
  ["region", "Region"],
  ["branch", "Branch"],
  ["vertical", "Vertical"],
];

const TREND_COLUMNS = [col("label", "Month", "text"), col("revenue", "Revenue"), col("cmpRevenue", "Comparison revenue"), col("gp", "GP"), col("cmpGp", "Comparison GP"), col("gmPct", "GM", "pct")];

export default function ExecutiveOverviewPage() {
  const { viewer, access } = useSalesAccess();
  const { filters } = useSalesFilters();
  const { data, meta, loading, error } = useSalesQuery(getExecutiveOverview, filters, viewer);
  const [tile, setTile] = useState(null);
  const [evidence, setEvidence] = useState(null);
  const [geoDim, setGeoDim] = useState("region");
  const commentary = useCommentary("executive", {
    savedBy: access?.user?.name || "",
    filtersLabel: meta ? `${meta.period.label} vs ${meta.compareBasis}` : "",
  });

  const geoColumns = useMemo(
    () => [
      col("name", GEO_DIMS.find((d) => d[0] === geoDim)[1], "text"),
      col("revenue", "Revenue"),
      col("cmpRevenue", `${meta?.compareBasis || "Comparison"} revenue`),
      col("revenueVar", "Variance"),
      col("revenueVarPct", "Variance %", "pct"),
      col("gp", "GP"),
      col("gmPct", "GM", "pct"),
      col("contribution", "Contribution"),
      col("contractors", "Avg contractors", "count"),
    ],
    [geoDim, meta?.compareBasis]
  );

  if (error) return <div className="bg-white rounded-xl border border-sky-100"><EmptyState label={error.message} /></div>;
  if (!data) return <Spinner label="Loading executive overview…" />;

  const sectionById = Object.fromEntries(data.kpiSections.map((s) => [s.id, s]));
  const section = (id, children, extra = {}) => (
    <SectionBlock key={id} section={sectionById[id]} insights={insightsFor(data.insights, id)} onDrill={setTile} {...extra}>
      {children}
    </SectionBlock>
  );

  const bridgeTable = {
    columns: [col("label", "Step", "text"), col("amount", "Effect on GP")],
    rows: [data.bridge.start, ...data.bridge.steps, data.bridge.end].map((s) => ({ label: s.label, amount: s.amount })),
  };
  const costTable = {
    columns: [col("label", "Month", "text"), col("gp", "GP"), col("commission", "Commissions"), col("travel", "Travel"), col("entertainment", "Entertainment"), col("acquisition", "Acquisition"), col("salary", "Salary allocation"), col("salesExpense", "Total sales expense"), col("contribution", "Contribution")],
    rows: data.salesCost,
  };
  const growthTable = {
    columns: [col("label", "Category", "text"), col("count", "Clients", "count"), col("revenue", "Revenue now"), col("revenueBase", "Revenue prior year"), col("change", "Change")],
    rows: data.growth,
  };
  const stageTable = {
    columns: [col("stage", "Stage", "text"), col("count", "Opportunities", "count"), col("revenue", "Revenue"), col("gp", "Expected GP"), col("weightedRevenue", "Weighted revenue"), col("weightedGp", "Weighted GP"), col("avgDaysInStage", "Avg days in stage", "days")],
    rows: data.pipeline.stages,
  };
  const o = data.outlook;
  const outlookRows = [
    { label: `${o.priorLabel} actual`, ...o.priorQuarter },
    { label: "Actual to date", ...o.actualToDate },
    { label: "Projected remaining", ...o.projectedRemaining },
    { label: "Full-quarter outlook", ...o.fullQuarter },
    { label: "Sales Target", ...o.target },
    { label: "Finance Forecast (read-only)", ...o.financeForecast },
  ];
  const outlookTable = { columns: [col("label", "Measure", "text"), col("revenue", "Revenue"), col("gp", "GP")], rows: outlookRows };

  const onExport = (includeCommentary) =>
    exportPage({
      filename: `sales-performance-executive-${meta.period.label}.csv`,
      meta,
      blocks: [
        { title: "Key metrics", rows: kpiCsvRows(data.kpiSections) },
        { title: `Performance by ${geoDim}`, columns: geoColumns, data: data.geo[geoDim] },
        { title: "GP bridge", columns: bridgeTable.columns, data: bridgeTable.rows },
      ],
      commentaryItems: commentary.items,
      includeCommentary,
    });

  return (
    <InsightActionsProvider pageKey="executive" pageLabel="Executive Overview" meta={meta} sections={data.kpiSections}>
      <SectionAccordion defaultOpen="financial">
        <div className={`space-y-3 ${loading ? "opacity-70 transition-opacity" : ""}`}>
          <PageToolbar
            title="Executive Overview"
            subtitle={`${meta.period.label} · compared with ${meta.compareBasis} · ${meta.scope.label}`}
            onExport={onExport}
            commentaryCount={commentary.items.length}
          />

          {section(
            "financial",
            <div className="grid gap-3 2xl:grid-cols-2">
              <TrendDrillCard
                trend={data.trend}
                compareLabel={meta.compareBasis}
                onAnalyze={() => setEvidence({ title: "Revenue & GP by month", sections: [{ title: "Last 12 months", columns: TREND_COLUMNS, rows: data.trend }] })}
              />
              <ChartCard
                title="GP variance bridge"
                subtitle={data.bridge.method}
                table={bridgeTable}
                exportName="gp-bridge"
                onAnalyze={() =>
                  setEvidence({
                    title: "GP variance bridge",
                    subtitle: data.bridge.method,
                    sections: [
                      { title: "Bridge steps", ...bridgeTable },
                      data.bridge.segments?.length
                        ? {
                            title: `Largest movers by ${data.bridge.segmentKey}`,
                            columns: [col("name", data.bridge.segmentKey === "client" ? "Client" : "Vertical", "text"), col("hours", "Billed hours", "hours"), col("hoursBase", "Hours (comparison)", "hours"), col("avgBillRate", "Bill rate", "rate"), col("billRateBase", "Bill rate (comparison)", "rate"), col("avgPayRate", "Pay per billed hour", "rate"), col("payRateBase", "Pay (comparison)", "rate"), col("gp", "GP"), col("gpBase", "GP (comparison)"), col("gpChange", "GP change")],
                            rows: data.bridge.segments.slice(0, 25),
                          }
                        : null,
                    ].filter(Boolean),
                  })
                }
              >
                <WaterfallChart start={data.bridge.start} steps={data.bridge.steps} end={data.bridge.end} height={280} />
              </ChartCard>
            </div>
          )}

          {section("staffing")}

          {section(
            "clients",
            <ChartCard title="Customer growth against prior year" subtitle="Revenue change by client movement; select a bar for the clients behind it" table={growthTable} exportName="customer-growth">
              <HorizontalBars
                data={data.growth}
                dataKey="change"
                nameKey="label"
                height={220}
                onSelect={(g) =>
                  setEvidence({
                    title: `${g.label} clients`,
                    subtitle: "Revenue this period against the same period last year",
                    sections: [{ title: `${g.label} (${g.count})`, columns: [col("name", "Client", "text"), col("revenue", "Revenue now"), col("revenueBase", "Revenue prior year"), col("change", "Change"), col("gp", "GP")], rows: g.clients }],
                  })
                }
              />
            </ChartCard>
          )}

          {section(
            "pipeline",
            <ChartCard
              title="Pipeline by stage"
              subtitle={`Weighted revenue by stage · ${data.pipeline.won.count} won, ${data.pipeline.lost.count} lost in period`}
              table={stageTable}
              exportName="pipeline-by-stage"
              onAnalyze={() => setTile({ key: "weightedPipeline", label: "Open pipeline" })}
            >
              <HorizontalBars data={data.pipeline.stages} dataKey="weightedRevenue" nameKey="stage" color="#8b5cf6" height={200} />
            </ChartCard>
          )}

          {section(
            "economics",
            <ChartCard
              title="Sales cost & contribution"
              subtitle="Monthly sales expense by category against GP; contribution = GP less sales expense (not EBITDA)"
              table={costTable}
              exportName="sales-cost-contribution"
              onAnalyze={() => setTile({ key: "salesContribution", label: "Sales contribution" })}
            >
              <SalesCostChart data={data.salesCost} height={260} />
            </ChartCard>
          )}

          {section(
            "forecast",
            <ChartCard title={`Quarter snapshot · ${o.label}`} subtitle={o.methodNote} table={outlookTable} exportName="quarter-snapshot" onAnalyze={() => setTile({ key: "quarterForecast", label: "Quarter outlook by salesperson" })}>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 2xl:grid-cols-6">
                {outlookRows.map((r) => (
                  <div key={r.label} className="rounded-lg border border-sky-100 bg-sky-50/50 px-3 py-2">
                    <p className="text-xs text-sky-700">{r.label}</p>
                    <p className="text-base font-bold text-sky-900">{compactMoney(r.revenue)}</p>
                    <p className="text-xs text-sky-600">GP {money(r.gp)}</p>
                  </div>
                ))}
              </div>
            </ChartCard>
          )}

          <SectionBlock
            section={{ id: "geo", title: "Geography & vertical performance" }}
            subtitle={`Contribution allocates each rep's sales expense by their GP in each ${geoDim}`}
            actions={
              <div className="flex overflow-hidden rounded-md border border-sky-200" role="group" aria-label="Group by">
                {GEO_DIMS.map(([id, label]) => (
                  <button key={id} type="button" aria-pressed={geoDim === id} onClick={() => setGeoDim(id)} className={`px-2 py-1 text-xs ${geoDim === id ? "bg-sky-800 text-white" : "bg-white text-sky-700 hover:bg-sky-50"}`}>
                    {label}
                  </button>
                ))}
              </div>
            }
          >
            <SimpleTable columns={geoColumns} rows={data.geo[geoDim]} maxHeight="420px" />
          </SectionBlock>

          <ContextFooter meta={meta} />

          <KpiBreakdownDrawer tile={tile} onClose={() => setTile(null)} />
          <EvidenceDrawer open={!!evidence} onClose={() => setEvidence(null)} title={evidence?.title || ""} subtitle={evidence?.subtitle} sections={evidence?.sections} />
        </div>
      </SectionAccordion>
    </InsightActionsProvider>
  );
}
