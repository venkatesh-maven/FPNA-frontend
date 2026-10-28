import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { TABS } from "../config/tabs";
import { useSalesAccess } from "../access/SalesAccessContext";

/** Tabs the viewer may open; links keep the current filters. */
export default function SalesTabBar({ standalone = false }) {
  const { canAny } = useSalesAccess();
  const { search } = useLocation();
  const tabs = TABS.filter((t) => canAny(t.any));
  return (
    <nav className={`flex gap-1 border-b border-sky-200 bg-white px-2 ${standalone ? "rounded-xl" : "rounded-t-xl"}`} aria-label="Staffing Recruiter Analytics views">
      {tabs.map((t) => (
        <NavLink
          key={t.key}
          to={{ pathname: t.path, search }}
          className={({ isActive }) =>
            `px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              isActive ? "border-sky-800 text-sky-900" : "border-transparent text-sky-600 hover:text-sky-900"
            }`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
