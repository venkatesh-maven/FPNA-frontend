import React, { useState } from "react";
import SimpleTable from "../../components/table/SimpleTable";
import { AUDIT_ACTIONS } from "../../services/accessAdminApi";
import { Badge } from "./AccessBits";
import { BTN, fmtDateTime } from "./accessHelpers";

const TONE = { "access.denied": "red", "config.reset": "amber", "role.delete": "red", "delegation.remove": "slate", "override.clear": "slate" };

function Snapshot({ label, value }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-sky-500">{label}</div>
      <pre className="max-h-56 overflow-auto rounded-md border border-sky-100 bg-white p-2 font-mono text-[10px] leading-relaxed text-sky-900 report-table-scroll">
        {value == null ? "—" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

/** Privileged-change log, newest first. Select a row for the full before/after. */
export default function AuditLog({ events }) {
  const [openId, setOpenId] = useState(null);
  const open = events.find((e) => e.id === openId);

  const columns = [
    { key: "at", label: "When", unit: "text", render: (e) => <span className="tabular-nums">{fmtDateTime(e.at)}</span> },
    { key: "by", label: "By", unit: "text", render: (e) => `${e.by?.name || "Unknown"} (${e.by?.id || "—"})` },
    { key: "action", label: "Action", unit: "text", render: (e) => <Badge tone={TONE[e.action] || "sky"}>{AUDIT_ACTIONS[e.action] || e.action}</Badge> },
    { key: "target", label: "Target", unit: "text", render: (e) => e.target?.label || "—" },
    { key: "summary", label: "Change", unit: "text", render: (e) => <span className="block max-w-[520px] truncate" title={e.summary}>{e.summary}</span> },
    { key: "reason", label: "Reason", unit: "text", render: (e) => (e.reason ? <span className="block max-w-[200px] truncate" title={e.reason}>{e.reason}</span> : <span className="text-sky-400">—</span>) },
  ];

  return (
    <div className="space-y-2">
      <SimpleTable columns={columns} rows={events} maxHeight={380} onRowClick={(e) => setOpenId(e.id === openId ? null : e.id)} emptyLabel="No changes recorded yet." />
      {open ? (
        <div className="space-y-2 rounded-lg border border-sky-200 bg-sky-50/50 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs text-sky-900">
              <b>{AUDIT_ACTIONS[open.action] || open.action}</b> · {open.summary}
              <span className="text-sky-600"> — {open.by?.name} ({open.by?.id}), {fmtDateTime(open.at)}</span>
            </p>
            <button type="button" className={BTN.link} onClick={() => setOpenId(null)}>
              Close
            </button>
          </div>
          <div className="flex flex-col gap-2 md:flex-row">
            <Snapshot label="Before" value={open.before} />
            <Snapshot label="After" value={open.after} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
