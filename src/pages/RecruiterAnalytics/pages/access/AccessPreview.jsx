import React, { useEffect, useState } from "react";
import { FiCheck, FiEyeOff, FiSlash } from "react-icons/fi";
import { previewAccess } from "../../services/accessAdminApi";
import { Badge, Chip, Field, StatusBadge } from "./AccessBits";
import { INPUT, ORG_ROLE_GROUPS, capLabelOf, dateRange, fmtDate, groupCapabilities } from "./accessHelpers";

const QUICK = ["RD1", "AM1", "L01", "R03", "R07", "A1"];
const SOURCE = {
  role: { label: "role", tone: "sky" },
  exception: { label: "exception", tone: "green" },
  delegation: { label: "delegated", tone: "amber" },
};
const SCOPE_KIND = { all: "All teams", teams: "Team scope", own: "Own records", none: "No business data" };

function Card({ title, children, className = "" }) {
  return (
    <div className={`min-w-0 rounded-lg border border-sky-100 p-3 ${className}`}>
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-sky-500">{title}</h4>
      {children}
    </div>
  );
}

/** What a person can do and see on a date, and where each part comes from. */
export default function AccessPreview({ data, viewer, rev }) {
  const [personId, setPersonId] = useState("R07");
  const [date, setDate] = useState(data.asOf);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    previewAccess(viewer, personId, date)
      .then((p) => {
        if (!live) return;
        setPreview(p);
        setError(null);
      })
      .catch((e) => live && setError(e));
    return () => {
      live = false;
    };
  }, [viewer, personId, date, rev]);

  const p = preview;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Person">
          <select value={personId} onChange={(e) => setPersonId(e.target.value)} className={`${INPUT} w-64`}>
            {ORG_ROLE_GROUPS.map(([role, label]) => (
              <optgroup key={role} label={label}>
                {data.people
                  .filter((x) => x.orgRole === role)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                      {x.teamName ? ` · ${x.teamName}` : ` · ${x.title}`}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="As of">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value || data.asOf)} className={INPUT} />
        </Field>
        <div className="flex flex-wrap items-center gap-1.5 pb-1">
          <span className="text-[11px] text-sky-600">Quick pick:</span>
          {QUICK.map((id) => {
            const x = data.people.find((q) => q.id === id);
            return x ? (
              <Chip key={id} active={personId === id} onClick={() => setPersonId(id)}>
                {x.name.split(" ")[0]} · {x.orgRoleLabel}
              </Chip>
            ) : null;
          })}
        </div>
      </div>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error.message}</p> : null}
      {!p ? (
        <p className="py-6 text-center text-xs text-sky-500">Resolving access…</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
            <span className="text-sm font-semibold text-sky-900">{p.person.name}</span>
            <span>{p.person.title}</span>
            <span>
              Role <b>{p.role.label}</b> {p.role.source === "assigned" ? <Badge tone="amber">assigned</Badge> : <Badge tone="slate">org default</Badge>}
            </span>
            <span>
              As of <b>{fmtDate(p.asOf)}</b>
              {p.asOf !== p.datasetAsOf ? <span className="text-sky-600"> (data is loaded to {fmtDate(p.datasetAsOf)})</span> : null}
            </span>
            <span className="ml-auto">
              {p.businessData ? <Badge tone="green">Sees recruiting data</Badge> : <Badge tone="slate">No recruiting data</Badge>}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card title={`Can do · ${p.capabilities.length}`} className="xl:col-span-2">
              {p.capabilities.length ? (
                <div className="space-y-2">
                  {groupCapabilities(p.capabilities).map(({ group, items }) => (
                    <div key={group}>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-sky-400">{group}</div>
                      <ul className="mt-0.5 space-y-0.5">
                        {items.map((c) => (
                          <li key={c.id} className="flex items-center gap-1.5 text-xs text-sky-900">
                            <FiCheck size={12} className="shrink-0 text-emerald-600" aria-hidden="true" />
                            {c.label}
                            <Badge tone={SOURCE[c.source].tone}>{SOURCE[c.source].label}</Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-sky-500">Nothing — this person can't open any part of Staffing Recruiter Analytics.</p>
              )}
              {p.withheld.length ? (
                <ul className="mt-2 space-y-0.5 border-t border-sky-50 pt-2">
                  {p.withheld.map((c) => (
                    <li key={c.id} className="flex items-center gap-1.5 text-xs text-red-700">
                      <FiSlash size={12} className="shrink-0" aria-hidden="true" />
                      <span className="line-through">{c.label}</span>
                      <span className="text-[10px] text-red-600">withheld by exception</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>

            <Card title="Can see">
              <div className="text-xs text-sky-900">
                <div className="font-semibold">{p.scope.label}</div>
                <div className="mt-0.5 text-sky-600">
                  {SCOPE_KIND[p.scope.kind] || p.scope.kind} · records of {p.scope.repCount} {p.scope.repCount === 1 ? "recruiter" : "recruiters"}
                </div>
                {p.scope.teams.length ? (
                  <ul className="mt-2 space-y-0.5">
                    {p.scope.teams.map((t) => (
                      <li key={t.id} className="flex items-center gap-1.5">
                        {t.name}
                        {t.via === "delegation" ? <Badge tone="amber">delegated</Badge> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {p.scope.repCount > 0 && !p.businessData ? (
                  <p className="mt-2 text-[11px] text-sky-600">Has a data scope but no analytics permission, so no recruiting data is shown.</p>
                ) : null}
              </div>
            </Card>

            <Card title={`Hidden fields · ${p.maskedFields.length}`}>
              {p.maskedGroups.length ? (
                <div className="space-y-2">
                  {p.maskedGroups.map((g) => (
                    <details key={g.capability} className="text-xs text-sky-900">
                      <summary className="flex cursor-pointer list-none items-center gap-1.5">
                        <FiEyeOff size={12} className="shrink-0 text-sky-500" aria-hidden="true" />
                        {g.fields.length} fields need “{g.label}”
                      </summary>
                      <p className="mt-1 font-mono text-[10px] leading-relaxed text-sky-600">{g.fields.join(", ")}</p>
                    </details>
                  ))}
                  <p className="text-[11px] text-sky-600">Shown as “Restricted” on screen and in exports.</p>
                </div>
              ) : (
                <p className="text-xs text-sky-600">None — cost and commission detail are visible within their scope.</p>
              )}
            </Card>
          </div>

          <Card title="Exceptions and delegations on this date">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="text-xs text-sky-900">
                {p.override ? (
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold">Exception</span>
                      <StatusBadge status={p.override.status} />
                      <span className="text-sky-600">{dateRange(p.override.startDate, p.override.endDate)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {p.override.grant.map((c) => (
                        <Badge key={c} tone="green">+ {capLabelOf(data.capabilities, c)}</Badge>
                      ))}
                      {p.override.deny.map((c) => (
                        <Badge key={c} tone="red">− {capLabelOf(data.capabilities, c)}</Badge>
                      ))}
                    </div>
                    {p.override.note ? <p className="text-sky-600">{p.override.note}</p> : null}
                    {!p.override.active ? <p className="text-[11px] text-sky-600">Not in force on this date, so it has no effect.</p> : null}
                  </div>
                ) : (
                  <p className="text-sky-500">No exception — access comes from the role alone.</p>
                )}
              </div>
              <div className="text-xs text-sky-900">
                {p.delegations.length ? (
                  <ul className="space-y-1.5">
                    {p.delegations.map((d) => (
                      <li key={d.id} className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold">Cover from {d.fromName}</span>
                          <StatusBadge status={d.status} />
                          <span className="text-sky-600">{dateRange(d.startDate, d.endDate)}</span>
                        </div>
                        <div className="text-sky-700">
                          {[d.capabilities.map((c) => capLabelOf(data.capabilities, c)).join(", "), d.teamNames.join(", ")].filter(Boolean).join(" · ")}
                          {d.reason ? <span className="text-sky-500"> — {d.reason}</span> : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sky-500">No delegations to this person.</p>
                )}
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
