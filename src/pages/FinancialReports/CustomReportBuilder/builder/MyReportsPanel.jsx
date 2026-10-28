import React from "react";
import { FiBarChart2, FiUsers } from "react-icons/fi";
import AppCard from "../../../../components/ui/AppCard";

// "My Reports" — a card grid over the same saved views the sidebar already
// lists (useCustomReportSavedViewsContext), rendered on the page itself per
// the redesign spec ("Create a section below custom reports and add 'My
// Reports'"). Purely additive to the sidebar listing — same data, same
// selectView navigation, just a second, more visual entry point.
export default function MyReportsPanel({ savedViews, onSelect }) {
  if (savedViews.length === 0) return null;

  return (
    <AppCard>
      <h3 className="text-md font-semibold text-sky-800 mb-3">My Reports</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {savedViews.map((view) => (
          <button
            key={view.id}
            type="button"
            onClick={() => onSelect(view)}
            className="flex flex-col items-start gap-1 rounded-lg border border-sky-200 bg-white p-3 text-left transition-colors hover:bg-sky-50 hover:border-sky-300"
          >
            <span className="flex items-center gap-2 text-s font-medium text-sky-900">
              <FiBarChart2 className="text-sky-600" />
              {view.name}
            </span>
            <span className="text-x text-slate-500">
              {(view.dimensions || []).join(" → ")}
            </span>
            {view.visibility === "all_users" ? (
              <span className="flex items-center gap-1 text-x text-sky-600">
                <FiUsers size={12} /> Shared
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </AppCard>
  );
}
