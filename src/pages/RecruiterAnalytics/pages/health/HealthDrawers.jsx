import React from "react";
import { getSalesHealthOpportunity, getSalesHealthStage } from "../../services/salesHealthApi";
import { useSalesQuery } from "../../hooks/useSalesQuery";
import { useSalesFilters } from "../../filters/SalesFiltersContext";
import { useSalesAccess } from "../../access/SalesAccessContext";
import EvidenceDrawer from "../../components/drawers/EvidenceDrawer";
import MaskedValue from "../../components/MaskedValue";
import { formatDate } from "../../calc/dates";
import { byUnit } from "../../utils/format";

const col = (key, label, unit = "money") => ({ key, label, unit });

function Fact({ label, value, unit = "text", masked }) {
  return (
    <div className="min-w-0 rounded-md border border-sky-100 bg-white px-2.5 py-1.5">
      <p className="truncate text-[11px] text-sky-600">{label}</p>
      <p className="truncate text-sm font-semibold text-sky-900">
        {masked ? <MaskedValue /> : unit === "date" ? (value ? formatDate(value) : "—") : unit === "text" ? value || "—" : byUnit(value, unit, { compact: unit === "money" })}
      </p>
    </div>
  );
}

/**
 * One job order in place: headline, drivers, stage history, fill-date
 * moves and — for existing clients — the client's requisitions and the
 * assignments currently billing there.
 */
export function OpportunityDrawer({ opportunityId, onClose, onOpenClient }) {
  const { filters } = useSalesFilters();
  const { viewer } = useSalesAccess();
  const { data, loading, error } = useSalesQuery(getSalesHealthOpportunity, filters, viewer, { opportunityId }, { enabled: !!opportunityId });
  const o = data?.opportunity;
  const sections = o
    ? [
        { title: "Job-order drivers", columns: [col("headcount", "Headcount", "count"), col("hoursPerWeek", "Hours / week", "count"), col("billRate", "Bill rate", "rate"), col("payRate", "Pay rate", "rate"), col("durationMonths", "Months", "count"), col("monthlyRevenue", "Monthly revenue"), col("monthlyGp", "Monthly GP"), col("gmPct", "GM", "pct")], rows: data.drivers },
        { title: "Stage history", columns: [col("stage", "Stage", "text"), col("enteredDate", "Entered", "date"), col("leftDate", "Left", "date"), col("days", "Days in stage", "days")], rows: data.history },
        data.pushes.length ? { title: "Fill-date changes", columns: [col("from", "From", "date"), col("to", "To", "date"), col("daysMoved", "Days moved", "days")], rows: data.pushes } : null,
        o.clientId ? { title: "Client requisitions since the job order opened (not linked to the job order in the data)", columns: [col("id", "Requisition", "text"), col("openedDate", "Opened", "date"), col("status", "Status", "text"), col("filledDate", "Filled", "date"), col("daysToFill", "Days to fill", "days")], rows: data.requisitions.map((r) => ({ ...r, clientId: o.clientId })) } : null,
        o.clientId ? { title: "Assignments billing at the client · planned ends", columns: [col("contractor", "Contractor", "text"), col("title", "Role", "text"), col("startDate", "Started", "date"), col("plannedEndDate", "Planned end", "date"), col("extensions", "Extensions", "count"), col("billRate", "Bill rate", "rate")], rows: data.assignments.map((r) => ({ ...r, clientId: o.clientId })) } : null,
      ].filter(Boolean)
    : [];
  const masked = (k) => o?.__masked?.includes(k);
  return (
    <EvidenceDrawer
      open={!!opportunityId}
      onClose={onClose}
      title={o ? o.client : "Job order"}
      subtitle={o ? `${o.id} · ${o.type} · ${o.owner} · ${o.vertical || ""}${o.status === "open" ? ` · ${o.stage}` : ` · ${o.status === "won" ? "Filled" : "Lost"}`}` : loading ? "Loading…" : ""}
      loading={loading && !data}
      error={error}
      sections={sections}
      onRowClick={onOpenClient ? (r) => r.clientId && onOpenClient(r.clientId) : undefined}
    >
      {data && !o ? <p className="text-sm text-sky-700">This job order isn't in your scope.</p> : null}
      {o ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
          <Fact label="Expected revenue" value={o.expectedRevenue} unit="money" />
          <Fact label="Expected GP" value={o.expectedGp} unit="money" />
          <Fact label="Probability" value={o.probability} unit="pct" />
          <Fact label="Weighted GP" value={o.weightedGp} unit="money" />
          <Fact label="Days in stage" value={o.daysInStage} unit="days" />
          <Fact label="Fill-date changes" value={o.closeDateChanges} unit="count" />
          <Fact label="Opened" value={o.createdDate} unit="date" />
          <Fact label="Original fill date" value={o.originalCloseDate} unit="date" />
          <Fact label={o.status === "open" ? "Expected fill date" : "Decided"} value={o.closeDate} unit="date" />
          <Fact label="Expected start" value={o.expectedStart} unit="date" />
          <Fact label="Expected first billing" value={o.expectedFirstBilling} unit="date" />
          <Fact label="Service type" value={o.serviceType} />
          {o.status === "open" ? <Fact label="Next action" value={o.nextAction} /> : null}
          {o.status === "lost" ? <Fact label="Loss reason" value={o.lossReason} /> : null}
          {o.status === "lost" ? <Fact label="Competitor" value={o.competitor || "Unknown"} /> : null}
          <Fact label="Lead source" value={o.leadSource} />
          <Fact label="Pay rate" value={o.payRate} unit="rate" masked={masked("payRate")} />
        </div>
      ) : null}
    </EvidenceDrawer>
  );
}

/** One funnel stage's cohort: by recruiter, by client, then the job orders. */
export function StageDrawer({ stage, onClose, onOpenOpportunity, onOpenRep, onOpenClient }) {
  const { filters } = useSalesFilters();
  const { viewer } = useSalesAccess();
  const { data, loading, error } = useSalesQuery(getSalesHealthStage, filters, viewer, { stage }, { enabled: !!stage });
  const groupColumns = (label) => [col("name", label, "text"), col("entered", "Entered", "count"), col("advanced", "Advanced", "count"), col("lost", "Lost", "count"), col("open", "Still in stage", "count"), col("conversion", "Conversion", "pct"), col("avgStageDays", "Avg stage days", "days"), col("expectedGp", "Expected GP")];
  const s = data?.summary;
  const sections = data?.stage
    ? [
        { title: "By recruiter", kind: "rep", columns: groupColumns("Recruiter"), rows: data.byOwner },
        { title: "By client / prospect", kind: "client", columns: groupColumns("Client / prospect"), rows: data.byClient },
        { title: "Job orders entering the stage", kind: "opportunity", columns: [col("name", "Client / prospect", "text"), col("owner", "Recruiter", "text"), col("type", "Type", "text"), col("enteredDate", "Entered", "date"), col("outcome", "Outcome", "text"), col("daysInStage", "Days in stage", "days"), col("expectedGp", "Expected GP")], rows: data.entries },
      ]
    : [];
  const onRowClick = (r, section) => {
    if (section.kind === "opportunity") onOpenOpportunity?.(r.opportunityId);
    else if (section.kind === "rep" && r.repId) onOpenRep?.(r.repId);
    else if (section.kind === "client" && r.clientId) onOpenClient?.(r.clientId);
  };
  return (
    <EvidenceDrawer
      open={!!stage}
      onClose={onClose}
      title={stage ? `${stage} · stage cohort` : ""}
      subtitle={data?.cohort ? `Job orders entering ${stage} ${data.cohort.label}. Conversion = advanced ÷ (advanced + lost at the stage).` : "Loading…"}
      loading={loading && !data}
      error={error}
      sections={sections}
      onRowClick={onRowClick}
    >
      {s ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <Fact label="Entered" value={s.entered} unit="count" />
          <Fact label="Advanced" value={s.advanced} unit="count" />
          <Fact label="Lost at stage" value={s.lost} unit="count" />
          <Fact label="Still in stage" value={s.open} unit="count" />
          <Fact label="Conversion" value={s.conversion} unit="pct" />
        </div>
      ) : null}
    </EvidenceDrawer>
  );
}
