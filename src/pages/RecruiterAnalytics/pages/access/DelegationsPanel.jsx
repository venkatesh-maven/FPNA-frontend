import React, { useEffect, useState } from "react";
import { FiArrowRight, FiPlus } from "react-icons/fi";
import SimpleTable from "../../components/table/SimpleTable";
import { addDelegation, previewAccess, removeDelegation } from "../../services/accessAdminApi";
import { Badge, CapabilityPicker, Chip, ConfirmButton, Field, StatusBadge } from "./AccessBits";
import { BTN, INPUT, ORG_ROLE_GROUPS, addDays, capLabelOf, dateRange } from "./accessHelpers";

function PersonSelect({ people, value, onChange, label, exclude }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={`${INPUT} w-56`}>
      <option value="">Choose…</option>
      {ORG_ROLE_GROUPS.map(([role, groupLabel]) => (
        <optgroup key={role} label={groupLabel}>
          {people
            .filter((p) => p.orgRole === role && p.id !== exclude)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.teamName ? ` · ${p.teamName}` : ""}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

/** Dated cover: one person temporarily gets some of another's permissions and teams. */
export default function DelegationsPanel({ data, run, busy, viewer, rev }) {
  const blank = { fromUserId: "", toUserId: "", capabilities: [], scopeTeamIds: [], startDate: data.asOf, endDate: addDays(data.asOf, 14), reason: "" };
  const [form, setForm] = useState(blank);
  const [from, setFrom] = useState(null); // the delegator's access on the start date
  const set = (change) => setForm((f) => ({ ...f, ...change }));
  const name = (id) => data.people.find((p) => p.id === id)?.name || id;
  const teamName = (id) => data.teams.find((t) => t.id === id)?.name || id;

  useEffect(() => {
    if (!form.fromUserId) return undefined;
    let live = true;
    previewAccess(viewer, form.fromUserId, form.startDate || data.asOf)
      .then((p) => live && setFrom(p))
      .catch(() => live && setFrom(null));
    return () => {
      live = false;
    };
  }, [viewer, form.fromUserId, form.startDate, data.asOf, rev]);

  const fromCurrent = form.fromUserId && from?.person.id === form.fromUserId ? from : null;
  const held = new Set(fromCurrent?.capabilities.map((c) => c.id) || []);
  const heldTeams = fromCurrent?.scope.teams || [];
  // Drop picks the delegator doesn't hold (after changing who delegates or when).
  const caps = form.capabilities.filter((c) => held.has(c));
  const teams = form.scopeTeamIds.filter((t) => heldTeams.some((x) => x.id === t));

  const submit = async (e) => {
    e.preventDefault();
    const res = await run((v) => addDelegation(v, { ...form, capabilities: caps, scopeTeamIds: teams }), `Delegation from ${name(form.fromUserId)} to ${name(form.toUserId)} added`);
    if (res) setForm({ ...blank, startDate: form.startDate, endDate: form.endDate });
  };

  const columns = [
    {
      key: "who",
      label: "From → to",
      unit: "text",
      render: (d) => (
        <span className="inline-flex items-center gap-1 font-medium text-sky-900">
          {name(d.fromUserId)} <FiArrowRight size={11} className="text-sky-400" aria-hidden="true" /> {name(d.toUserId)}
        </span>
      ),
    },
    {
      key: "capabilities",
      label: "Permissions",
      unit: "text",
      render: (d) =>
        d.capabilities.length ? (
          <div className="flex max-w-[360px] flex-wrap gap-1">
            {d.capabilities.map((c) => (
              <Badge key={c}>{capLabelOf(data.capabilities, c)}</Badge>
            ))}
          </div>
        ) : (
          <span className="text-sky-400">—</span>
        ),
    },
    { key: "scopeTeamIds", label: "Teams", unit: "text", render: (d) => (d.scopeTeamIds.length ? d.scopeTeamIds.map(teamName).join(", ") : <span className="text-sky-400">—</span>) },
    { key: "dates", label: "Dates", unit: "text", render: (d) => dateRange(d.startDate, d.endDate) },
    { key: "status", label: "Today", unit: "text", render: (d) => <StatusBadge status={d.status} /> },
    { key: "reason", label: "Reason", unit: "text", render: (d) => <span className="block max-w-[220px] truncate" title={d.reason}>{d.reason}</span> },
    {
      key: "remove",
      label: "",
      unit: "text",
      render: (d) => (
        <ConfirmButton className={BTN.danger} disabled={busy} confirmLabel="Remove?" onConfirm={() => run((v) => removeDelegation(v, d.id), "Delegation removed")}>
          Remove
        </ConfirmButton>
      ),
    },
  ];

  const canSubmit = form.fromUserId && form.toUserId && (caps.length || teams.length) && form.startDate && form.endDate && form.reason.trim() && !busy;

  return (
    <div className="space-y-3">
      <SimpleTable columns={columns} rows={data.delegations} emptyLabel="No delegations. Add one below for holiday or leave cover." />

      <form onSubmit={submit} className="space-y-3 rounded-lg border border-sky-100 p-3">
        <h4 className="text-xs font-semibold text-sky-900">Add delegation</h4>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="From (delegator)">
            <PersonSelect people={data.people} value={form.fromUserId} onChange={(v) => set({ fromUserId: v })} label="Delegate from" exclude={form.toUserId} />
          </Field>
          <Field label="To (covering)">
            <PersonSelect people={data.people} value={form.toUserId} onChange={(v) => set({ toUserId: v })} label="Delegate to" exclude={form.fromUserId} />
          </Field>
          <Field label="Start">
            <input type="date" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} className={INPUT} required />
          </Field>
          <Field label="End">
            <input type="date" value={form.endDate} min={form.startDate || undefined} onChange={(e) => set({ endDate: e.target.value })} className={INPUT} required />
          </Field>
          <Field label="Reason" className="min-w-[220px] flex-1">
            <input value={form.reason} onChange={(e) => set({ reason: e.target.value })} maxLength={200} placeholder="e.g. Annual leave cover" className={INPUT} />
          </Field>
        </div>

        {form.fromUserId ? (
          fromCurrent ? (
            <div className="space-y-2">
              <CapabilityPicker
                label="Permissions to delegate"
                hint={`Only what ${fromCurrent.person.name} holds on ${form.startDate || data.asOf} can be delegated.`}
                capabilities={data.capabilities}
                value={caps}
                onChange={(v) => set({ capabilities: v })}
                disabled={(id) => (held.has(id) ? null : `${fromCurrent.person.name} doesn't hold this`)}
              />
              <fieldset>
                <legend className="text-xs font-semibold text-sky-900">Teams to cover</legend>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {heldTeams.length ? (
                    heldTeams.map((t) => (
                      <Chip key={t.id} active={teams.includes(t.id)} onClick={() => set({ scopeTeamIds: teams.includes(t.id) ? teams.filter((x) => x !== t.id) : [...teams, t.id] })}>
                        {t.name}
                      </Chip>
                    ))
                  ) : (
                    <span className="text-[11px] text-sky-500">{fromCurrent.person.name} has no teams in scope to delegate.</span>
                  )}
                </div>
              </fieldset>
            </div>
          ) : (
            <p className="text-[11px] text-sky-500">Checking what {name(form.fromUserId)} holds…</p>
          )
        ) : (
          <p className="text-[11px] text-sky-600">Pick who is delegating to see the permissions and teams they can hand on.</p>
        )}

        <button type="submit" className={BTN.primary} disabled={!canSubmit}>
          <FiPlus size={12} aria-hidden="true" /> Add delegation
        </button>
      </form>
    </div>
  );
}
