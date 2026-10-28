import React, { useCallback, useEffect, useState } from "react";
import { FiRotateCcw, FiShield } from "react-icons/fi";
import { useSalesAccess } from "../../access/SalesAccessContext";
import PageToolbar from "../../components/PageToolbar";
import SectionBlock, { SectionAccordion, useSectionAccordion } from "../../components/SectionBlock";
import { EmptyState, Spinner, ToastContainer, useToast } from "../../../Budget/budgetHelpers";
import { getAccessAdmin, listAudit, resetToDefaults } from "../../services/accessAdminApi";
import { ConfirmButton } from "./AccessBits";
import { BTN, fmtDate } from "./accessHelpers";
import RoleMatrix from "./RoleMatrix";
import PeoplePanel from "./PeoplePanel";
import HierarchyPanel from "./HierarchyPanel";
import DelegationsPanel from "./DelegationsPanel";
import AccessPreview from "./AccessPreview";
import AuditLog from "./AuditLog";

const SECTIONS = [
  { id: "access-roles", title: "Role templates" },
  { id: "access-people", title: "People & assignments" },
  { id: "access-hierarchy", title: "Team hierarchy" },
  { id: "access-delegations", title: "Delegations" },
  { id: "access-preview", title: "Effective access preview" },
  { id: "access-audit", title: "Audit log" },
];

/** Section shortcuts: open the section (closing the one that's open), then scroll to it. */
function JumpNav() {
  const accordion = useSectionAccordion();
  const jump = (id) => {
    accordion.open(id);
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  return (
    <nav aria-label="Access sections" className="flex flex-wrap gap-1.5 print:hidden">
      {SECTIONS.map((s) => (
        <button key={s.id} type="button" onClick={() => jump(s.id)} className={`${BTN.secondary} rounded-full py-1`}>
          {s.title}
        </button>
      ))}
    </nav>
  );
}

/**
 * Access administration for Sales Performance: role templates, people's
 * roles and exceptions, reporting lines, delegated cover, a preview of
 * anyone's effective access, and the audit log. Shows no sales figures.
 * Every change goes to the access service, which checks the caller and the
 * inputs, records an audit entry and re-scopes cached analytics.
 */
export default function AccessAdminPage() {
  const { viewer } = useSalesAccess();
  const [data, setData] = useState(null);
  const [audit, setAudit] = useState([]);
  const [error, setError] = useState(null);
  const [rev, setRev] = useState(0);
  const [busy, setBusy] = useState(false);
  const { toasts, add: toast } = useToast();

  const load = useCallback(async () => {
    try {
      const [d, a] = await Promise.all([getAccessAdmin(viewer), listAudit(viewer)]);
      setData(d);
      setAudit(a);
      setError(null);
      setRev((r) => r + 1);
    } catch (e) {
      setError(e);
    }
  }, [viewer]);

  useEffect(() => {
    load();
  }, [load]);

  /** Run one change; toast the outcome and reload. Resolves null when it was refused. */
  const run = useCallback(
    async (call, success) => {
      setBusy(true);
      try {
        const res = await call(viewer);
        toast(res?.changed === false ? "Nothing to change — that's already in force." : success, res?.changed === false ? "info" : "success");
        return res;
      } catch (e) {
        toast(e.message, "error");
        return null;
      } finally {
        await load();
        setBusy(false);
      }
    },
    [viewer, load, toast]
  );

  if (error && !data) return <div className="rounded-xl border border-sky-100 bg-white"><EmptyState label={error.message} /></div>;
  if (!data) return <Spinner label="Loading access rules…" />;

  const exceptions = data.people.filter((p) => p.override).length;
  const reassigned = data.teams.filter((t) => t.reassigned).length;
  const subtitles = {
    "access-roles": `${data.roles.length} roles × ${data.capabilities.length} permissions · scope decides which records a role reaches`,
    "access-people": `${data.people.length} people · ${exceptions} with exceptions`,
    "access-hierarchy": `${data.teams.length} teams · ${reassigned} reassigned from the org record`,
    "access-delegations": `${data.delegations.filter((d) => d.status === "active").length} active of ${data.delegations.length}`,
    "access-preview": "What one person can do and see on a date, and why",
    "access-audit": `${audit.length} entries, newest first`,
  };
  const block = (id, children) => (
    <SectionBlock id={id} section={{ id, title: SECTIONS.find((s) => s.id === id).title }} subtitle={subtitles[id]}>
      {children}
    </SectionBlock>
  );

  return (
    <SectionAccordion defaultOpen={SECTIONS[0].id}>
      <div className={`space-y-3 ${busy ? "cursor-progress" : ""}`}>
        <PageToolbar title="Access administration" subtitle={`Who can do and see what in Staffing Sales Analytics · signed in as ${data.caller.name}`}>
          <ConfirmButton
            className="relative flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-100 px-3 py-2.5 text-sm text-sky-800 hover:bg-sky-200"
            confirmLabel="Reset every rule? Click to confirm"
            disabled={busy}
            title="Restore the shipped roles, assignments, exceptions, delegations and reporting lines. The audit log is kept."
            onConfirm={() => run((v) => resetToDefaults(v), "Access rules reset to defaults")}
          >
            <FiRotateCcw aria-hidden="true" /> Reset to defaults
          </ConfirmButton>
        </PageToolbar>

        <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs text-sky-800">
          <FiShield size={14} className="mt-0.5 shrink-0 text-sky-600" aria-hidden="true" />
          <p>
            <b>Client-side preview of rules the server will enforce.</b> They're kept in this browser for now, and the sample service applies them to
            every request, drill-down and export — the production API will check the same rules server-side. Changes apply from the next request and
            clear cached results; dates are judged against the data date, {fmtDate(data.asOf)}. Managing access gives you no sales data yourself, and
            nobody can widen their own access here. Role templates save with <i>Save changes</i>; everything else saves as you change it. Every change
            is in the audit log, and <i>Reset to defaults</i> puts the shipped rules back.
          </p>
        </div>

        <JumpNav />

        {block("access-roles", <RoleMatrix data={data} run={run} busy={busy} />)}
        {block("access-people", <PeoplePanel data={data} run={run} busy={busy} />)}
        {block("access-hierarchy", <HierarchyPanel data={data} run={run} busy={busy} />)}
        {block("access-delegations", <DelegationsPanel data={data} run={run} busy={busy} viewer={viewer} rev={rev} />)}
        {block("access-preview", <AccessPreview data={data} viewer={viewer} rev={rev} />)}
        {block("access-audit", <AuditLog events={audit} />)}

        <ToastContainer toasts={toasts} />
      </div>
    </SectionAccordion>
  );
}
