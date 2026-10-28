import React from "react";
import SimpleTable from "../../components/table/SimpleTable";
import { setTeamDirector } from "../../services/accessAdminApi";
import { Badge } from "./AccessBits";
import { BTN, INPUT } from "./accessHelpers";

/** Lead team → Account Manager reporting lines. Moving a team moves who can see it; past placements keep their recruiter. */
export default function HierarchyPanel({ data, run, busy }) {
  const person = (id) => data.people.find((p) => p.id === id);
  const scopeOf = (p) => data.roles.find((r) => r.id === p?.roleId)?.scope;
  const candidates = data.people.filter((p) => p.orgRole === "account_manager" || scopeOf(p) === "teams");

  const columns = [
    { key: "name", label: "Team", unit: "text", render: (t) => <span className="font-medium text-sky-900">{t.name}</span> },
    { key: "repCount", label: "Recruiters", unit: "text", render: (t) => <span className="tabular-nums">{t.repCount}</span> },
    {
      key: "directorId",
      label: "Account manager",
      unit: "text",
      render: (t) => {
        const options = candidates.some((p) => p.id === t.directorId) ? candidates : [...candidates, person(t.directorId)].filter(Boolean);
        const warn = scopeOf(person(t.directorId)) !== "teams";
        return (
          <div className="flex items-center gap-2">
            <select
              value={t.directorId}
              disabled={busy}
              aria-label={`Account manager of ${t.name}`}
              onChange={(e) => {
                const next = e.target.value;
                run((viewer) => setTeamDirector(viewer, t.id, next), `${t.name} now reports to ${person(next)?.name}`);
              }}
              className={`${INPUT} py-1 ${t.reassigned ? "border-amber-300 bg-amber-50" : ""}`}
            >
              {options.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.roleLabel}
                </option>
              ))}
            </select>
            {warn ? (
              <Badge tone="amber" title="Their access role doesn't use team scope, so leading this team gives them no extra visibility.">
                role isn't team-scoped
              </Badge>
            ) : null}
          </div>
        );
      },
    },
    { key: "defaultDirectorId", label: "Org record", unit: "text", render: (t) => person(t.defaultDirectorId)?.name || t.defaultDirectorId },
    {
      key: "status",
      label: "",
      unit: "text",
      render: (t) =>
        t.reassigned ? (
          <div className="flex items-center gap-2">
            <Badge tone="amber">Reassigned</Badge>
            <button type="button" className={BTN.link} disabled={busy} onClick={() => run((viewer) => setTeamDirector(viewer, t.id, null), `${t.name} is back with ${person(t.defaultDirectorId)?.name}`)}>
              Restore
            </button>
          </div>
        ) : (
          <span className="text-sky-400">As org record</span>
        ),
    },
  ];

  return (
    <div className="space-y-2">
      <SimpleTable columns={columns} rows={data.teams} />
      <p className="text-[11px] text-sky-600">
        A change saves straight away and applies from the next request: the old account manager stops seeing the team, the new one sees it in totals,
        rankings and drill-downs. Past placements stay credited to the recruiter who filled them.
      </p>
    </div>
  );
}
