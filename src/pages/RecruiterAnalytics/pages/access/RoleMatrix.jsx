import React, { Fragment, useState } from "react";
import { FiPlus, FiSave, FiTrash2 } from "react-icons/fi";
import { createRole, deleteRole, updateRole } from "../../services/accessAdminApi";
import { ConfirmButton, Field } from "./AccessBits";
import { BTN, INPUT, groupCapabilities } from "./accessHelpers";

const sameRole = (a, b) =>
  a.label === b.label && a.scope === b.scope && [...a.capabilities].sort().join() === [...b.capabilities].sort().join();

/**
 * Roles × permissions. Edits stay as a draft per role until "Save changes",
 * so several boxes can be ticked and reviewed before anything takes effect;
 * each saved role is one audit entry.
 */
export default function RoleMatrix({ data, run, busy }) {
  const [edits, setEdits] = useState({});
  const [newRole, setNewRole] = useState({ label: "", scope: "own", copyFrom: "" });
  const { roles, capabilities, scopes, maskedFieldsByCapability } = data;

  const view = (r) => ({ ...r, ...edits[r.id] });
  const patch = (id, change) => setEdits((e) => ({ ...e, [id]: { ...e[id], ...change } }));
  const dirty = roles.filter((r) => edits[r.id] && !sameRole(r, view(r)));
  const toggle = (r, cap) => {
    const caps = view(r).capabilities;
    patch(r.id, { capabilities: caps.includes(cap) ? caps.filter((c) => c !== cap) : [...caps, cap] });
  };
  const forget = (id) =>
    setEdits((e) => {
      const next = { ...e };
      delete next[id];
      return next;
    });

  const save = async () => {
    for (const r of dirty) {
      const v = view(r);
      const res = await run((viewer) => updateRole(viewer, r.id, { label: v.label, scope: v.scope, capabilities: v.capabilities }), `Saved role “${v.label}”`);
      if (!res) return; // keep the draft so the problem can be fixed
      forget(r.id);
    }
  };

  const create = async (e) => {
    e.preventDefault();
    const res = await run(
      (viewer) => createRole(viewer, { label: newRole.label, scope: newRole.copyFrom ? undefined : newRole.scope, copyFrom: newRole.copyFrom || undefined }),
      `Created role “${newRole.label.trim()}”`
    );
    if (res) setNewRole({ label: "", scope: "own", copyFrom: "" });
  };

  const cols = roles.length + 1;
  return (
    <div className="space-y-3">
      <div className="overflow-auto rounded-lg border border-sky-100 report-table-scroll">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-sky-900 text-white">
            <tr>
              <th className="min-w-[260px] px-3 py-2 text-left font-semibold">Permission</th>
              {roles.map((r) => (
                <th key={r.id} className="min-w-[150px] px-2 py-2 align-bottom font-semibold">
                  <input
                    value={view(r).label}
                    onChange={(e) => patch(r.id, { label: e.target.value })}
                    aria-label={`Name of role ${r.label}`}
                    className="w-full rounded bg-white px-1.5 py-1 text-center text-xs font-semibold text-sky-900"
                  />
                  <span className="mt-0.5 block font-mono text-[10px] font-normal text-sky-300">{r.id}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-sky-50">
              <td className="px-3 py-1.5">
                <span className="font-semibold text-sky-900">Data scope</span>
                <span className="block text-[10px] text-sky-600">Which recruiters' records the role reaches</span>
              </td>
              {roles.map((r) => (
                <td key={r.id} className={`px-2 py-1.5 text-center ${view(r).scope !== r.scope ? "bg-amber-50" : ""}`}>
                  <select
                    value={view(r).scope}
                    onChange={(e) => patch(r.id, { scope: e.target.value })}
                    aria-label={`Data scope for ${view(r).label}`}
                    className={`${INPUT} w-full py-1`}
                  >
                    {scopes.map((s) => (
                      <option key={s.id} value={s.id} title={s.description}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </td>
              ))}
            </tr>
            {groupCapabilities(capabilities).map(({ group, items }) => (
              <Fragment key={group}>
                <tr>
                  <td colSpan={cols} className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wide text-sky-500">
                    {group}
                  </td>
                </tr>
                {items.map((c) => {
                  const hidden = maskedFieldsByCapability[c.id];
                  return (
                    <tr key={c.id} className="border-t border-sky-50 hover:bg-sky-50/50">
                      <td className="px-3 py-1.5 text-sky-900">
                        {c.label}
                        <span className="block text-[10px] text-sky-500">
                          <span className="font-mono">{c.id}</span>
                          {hidden ? ` · without it, ${hidden.length} fields show as Restricted` : ""}
                          {c.id === "manage_access" ? " · gives no recruiting data by itself" : ""}
                        </span>
                      </td>
                      {roles.map((r) => {
                        const on = view(r).capabilities.includes(c.id);
                        const changed = on !== r.capabilities.includes(c.id);
                        return (
                          <td key={r.id} className={`px-2 py-1.5 text-center ${changed ? "bg-amber-50" : ""}`}>
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => toggle(r, c.id)}
                              aria-label={`${c.label} for ${view(r).label}`}
                              className="h-4 w-4 cursor-pointer accent-sky-700"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
            <tr className="border-t border-sky-100 bg-sky-50/60">
              <td className="px-3 py-1.5 text-sky-700">People with this role</td>
              {roles.map((r) => (
                <td key={r.id} className="px-2 py-1.5 text-center">
                  <span className="mr-1.5 tabular-nums text-sky-900">{r.usedBy}</span>
                  <ConfirmButton
                    className={BTN.danger}
                    disabled={busy || r.builtIn || r.usedBy > 0}
                    title={r.builtIn ? "Default role behind people's org roles — edit it instead" : r.usedBy > 0 ? "Reassign its people first" : "Delete this role"}
                    confirmLabel="Delete?"
                    onConfirm={() => run((viewer) => deleteRole(viewer, r.id), `Deleted role “${r.label}”`)}
                  >
                    <FiTrash2 size={11} aria-hidden="true" />
                    <span className="sr-only">Delete {r.label}</span>
                  </ConfirmButton>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs ${dirty.length ? "border border-amber-200 bg-amber-50 text-amber-800" : "bg-sky-50 text-sky-700"}`}>
        <span>
          {dirty.length
            ? `Unsaved changes to ${dirty.map((r) => view(r).label || r.id).join(", ")}. Highlighted cells differ from what's in force.`
            : "Role templates match what's in force. Tick boxes, then save; each saved role is recorded in the audit log."}
        </span>
        <div className="flex gap-2">
          <button type="button" className={BTN.secondary} disabled={!dirty.length || busy} onClick={() => setEdits({})}>
            Discard
          </button>
          <button type="button" className={BTN.primary} disabled={!dirty.length || busy} onClick={save}>
            <FiSave size={12} aria-hidden="true" /> Save changes
          </button>
        </div>
      </div>

      <form onSubmit={create} className="flex flex-wrap items-end gap-2 rounded-lg border border-sky-100 p-3">
        <Field label="New role name">
          <input value={newRole.label} onChange={(e) => setNewRole({ ...newRole, label: e.target.value })} placeholder="e.g. Regional Analyst" className={`${INPUT} w-52`} maxLength={60} />
        </Field>
        <Field label="Start from">
          <select value={newRole.copyFrom} onChange={(e) => setNewRole({ ...newRole, copyFrom: e.target.value })} className={INPUT}>
            <option value="">No permissions</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                Copy of {r.label}
              </option>
            ))}
          </select>
        </Field>
        {!newRole.copyFrom ? (
          <Field label="Data scope">
            <select value={newRole.scope} onChange={(e) => setNewRole({ ...newRole, scope: e.target.value })} className={INPUT}>
              {scopes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <button type="submit" className={BTN.primary} disabled={busy || !newRole.label.trim()}>
          <FiPlus size={12} aria-hidden="true" /> Create role
        </button>
        <p className="basis-full text-[11px] text-sky-600">New roles appear as a column above; tick their permissions and save, then assign people below.</p>
      </form>
    </div>
  );
}
