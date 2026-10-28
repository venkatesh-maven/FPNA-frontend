import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiEdit2, FiSearch } from "react-icons/fi";
import SimpleTable from "../../components/table/SimpleTable";
import { clearOverride, setAssignment, setOverride } from "../../services/accessAdminApi";
import { Badge, CapabilityPicker, ConfirmButton, Field, StatusBadge } from "./AccessBits";
import { BTN, INPUT, capLabelOf, dateRange } from "./accessHelpers";

function ExceptionSummary({ override, capabilities }) {
  if (!override) return <span className="text-sky-400">—</span>;
  return (
    <div className="flex max-w-[420px] flex-wrap items-center gap-1" title={override.note || undefined}>
      <StatusBadge status={override.status} />
      {override.grant.map((c) => (
        <Badge key={`g-${c}`} tone="green">+ {capLabelOf(capabilities, c)}</Badge>
      ))}
      {override.deny.map((c) => (
        <Badge key={`d-${c}`} tone="red">− {capLabelOf(capabilities, c)}</Badge>
      ))}
      {override.startDate || override.endDate ? <span className="text-[10px] text-sky-600">{dateRange(override.startDate, override.endDate)}</span> : null}
    </div>
  );
}

/** Per-person exception: extra permissions, withheld permissions, a note and optional dates. */
function ExceptionEditor({ person, data, run, busy, onClose }) {
  const o = person.override || {};
  const [grant, setGrant] = useState(o.grant || []);
  const [deny, setDeny] = useState(o.deny || []);
  const [note, setNote] = useState(o.note || "");
  const [startDate, setStart] = useState(o.startDate || "");
  const [endDate, setEnd] = useState(o.endDate || "");
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);
  const role = data.roles.find((r) => r.id === person.roleId);
  const inRole = new Set(role?.capabilities || []);

  const save = async () => {
    const res = await run((viewer) => setOverride(viewer, person.id, { grant, deny, note, startDate, endDate }), `Saved exception for ${person.name}`);
    if (res) onClose();
  };
  const remove = async () => {
    const res = await run((viewer) => clearOverride(viewer, person.id), `Removed exception for ${person.name}`);
    if (res) onClose();
  };

  return (
    <div ref={ref} className="space-y-3 rounded-lg border border-sky-200 bg-sky-50/50 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-sky-900">
          Exception for {person.name} <span className="font-normal text-sky-600">· role {person.roleLabel}</span>
        </h4>
        <span className="text-[11px] text-sky-600">A withheld permission wins over the role and any delegation.</span>
      </div>
      <CapabilityPicker
        label="Grant in addition to the role"
        tone="grant"
        capabilities={data.capabilities}
        value={grant}
        onChange={(next) => {
          setGrant(next);
          setDeny((d) => d.filter((x) => !next.includes(x)));
        }}
        disabled={(id) => (inRole.has(id) ? "Already part of their role" : null)}
      />
      <CapabilityPicker
        label="Withhold"
        tone="deny"
        capabilities={data.capabilities}
        value={deny}
        onChange={(next) => {
          setDeny(next);
          setGrant((g) => g.filter((x) => !next.includes(x)));
        }}
      />
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Reason / note" className="min-w-[260px] flex-1">
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Why this person differs from their role" className={INPUT} />
        </Field>
        <Field label="From (optional)">
          <input type="date" value={startDate} onChange={(e) => setStart(e.target.value)} className={INPUT} />
        </Field>
        <Field label="Until (optional)">
          <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEnd(e.target.value)} className={INPUT} />
        </Field>
      </div>
      <p className="text-[11px] text-sky-600">Leave the dates empty for an exception with no end. Outside its dates an exception has no effect.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BTN.primary} disabled={busy || (!grant.length && !deny.length)} onClick={save}>
          Save exception
        </button>
        {person.override ? (
          <ConfirmButton className={BTN.danger} disabled={busy} confirmLabel="Remove exception?" onConfirm={remove}>
            Remove exception
          </ConfirmButton>
        ) : null}
        <button type="button" className={BTN.secondary} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function PeoplePanel({ data, run, busy }) {
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [editing, setEditing] = useState(null);
  const roleLabel = (id) => data.roles.find((r) => r.id === id)?.label || id;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.people.filter(
      (p) =>
        (!roleFilter || p.roleId === roleFilter) &&
        (!needle || [p.name, p.id, p.title, p.teamName].some((v) => v && v.toLowerCase().includes(needle)))
    );
  }, [data.people, q, roleFilter]);

  const editingPerson = data.people.find((p) => p.id === editing);

  const columns = [
    {
      key: "name",
      label: "Person",
      unit: "text",
      render: (p) => (
        <div>
          <div className="font-medium text-sky-900">{p.name}</div>
          <div className="text-[11px] text-sky-500">
            {p.id} · {p.title}
          </div>
        </div>
      ),
    },
    { key: "teamName", label: "Team", unit: "text" },
    { key: "orgRoleLabel", label: "Org role", unit: "text" },
    {
      key: "roleId",
      label: "Access role",
      unit: "text",
      render: (p) => (
        <select
          value={p.roleId}
          disabled={busy}
          aria-label={`Access role for ${p.name}`}
          onChange={(e) => {
            const next = e.target.value;
            run((viewer) => setAssignment(viewer, p.id, next), `${p.name} now has the ${roleLabel(next)} role`);
          }}
          className={`${INPUT} py-1 ${p.assignedRoleId ? "border-amber-300 bg-amber-50" : ""}`}
        >
          {data.roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
              {r.id === p.orgRole ? " (org default)" : ""}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: "scopeLabel",
      label: "Data scope",
      unit: "text",
      render: (p) => <span className={`block max-w-[240px] truncate ${p.scopeKind === "none" ? "text-sky-400" : ""}`} title={p.scopeLabel}>{p.scopeLabel}</span>,
    },
    { key: "override", label: "Exception", unit: "text", render: (p) => <ExceptionSummary override={p.override} capabilities={data.capabilities} /> },
    {
      key: "delegations",
      label: "Cover",
      unit: "text",
      render: (p) => (p.activeDelegations ? <Badge tone="amber">{p.activeDelegations} active delegation{p.activeDelegations > 1 ? "s" : ""}</Badge> : <span className="text-sky-400">—</span>),
    },
    {
      key: "actions",
      label: "",
      unit: "text",
      render: (p) => (
        <button type="button" className={BTN.link} onClick={() => setEditing(p.id)}>
          <FiEdit2 size={11} className="mr-1 inline" aria-hidden="true" />
          {p.override ? "Edit exception" : "Add exception"}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <FiSearch size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-sky-400" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people or teams" aria-label="Search people" className={`${INPUT} w-60 pl-6`} />
        </label>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter by access role" className={INPUT}>
          <option value="">All access roles</option>
          {data.roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label} ({r.usedBy})
            </option>
          ))}
        </select>
        <span className="text-[11px] text-sky-600">
          {rows.length} of {data.people.length} people · a role picked here overrides the org default (highlighted) and saves straight away
        </span>
      </div>
      <SimpleTable columns={columns} rows={rows} maxHeight={440} emptyLabel="Nobody matches." />
      {editingPerson ? (
        <ExceptionEditor key={`${editingPerson.id}:${JSON.stringify(editingPerson.override)}`} person={editingPerson} data={data} run={run} busy={busy} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}
