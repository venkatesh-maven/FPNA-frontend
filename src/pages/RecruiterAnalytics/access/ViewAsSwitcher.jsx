import React, { useMemo } from "react";
import { FiUser } from "react-icons/fi";
import { listViewAsUsers } from "../services/salesAnalyticsApi";
import { useSalesAccess } from "./SalesAccessContext";

const GROUPS = [
  ["executive", "Executives"],
  ["recruiting_director", "Recruiting Directors"],
  ["account_manager", "Account Managers"],
  ["lead", "Recruiter Leads"],
  ["recruiter", "Recruiters"],
  ["finance", "Finance"],
  ["access_admin", "Access administration"],
];

/** Demo control: whose access the module shows. Replaced by the signed-in user once the API exists. */
export default function ViewAsSwitcher() {
  const { viewer, setViewAs, access } = useSalesAccess();
  const users = useMemo(() => listViewAsUsers(), []);
  return (
    <label className="flex items-center gap-1.5 rounded-full bg-white/15 pl-2.5 pr-1 py-0.5 text-xs text-white" title="Demo only — the server will use your signed-in role">
      <FiUser size={12} aria-hidden="true" />
      <span className="whitespace-nowrap">View as</span>
      <select
        value={viewer.userId}
        onChange={(e) => setViewAs(e.target.value)}
        className="bg-white text-sky-900 rounded-full px-2 py-0.5 text-xs max-w-[220px]"
        aria-label="View as (demo persona)"
      >
        {GROUPS.map(([role, label]) => (
          <optgroup key={role} label={label}>
            {users
              .filter((u) => u.role === role)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.team ? ` · ${u.team}` : u.title ? ` · ${u.title}` : ""}
                  {u.restricted ? " (restricted)" : ""}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      {access ? <span className="hidden xl:inline text-sky-100 pr-1">{access.roleLabel}</span> : null}
    </label>
  );
}
