import React from "react";
import AppChip from "../../../components/ui/AppChip";
import { formatDate } from "../calc/dates";

/**
 * Module banner. Same look as the Financial Reports header, but its chips
 * show the sample data's own period, comparison and as-of date rather than
 * the app's global year (which this data doesn't follow).
 */
export default function SalesHeader({ meta, actions }) {
  return (
    <div className="mb-2 rounded-xl bg-gradient-to-r from-sky-950 via-sky-900 to-sky-700 px-4 py-2 shadow-md">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h1 className="text-lg font-bold text-white">Staffing Recruiter Analytics</h1>
          <p className="text-sm text-sky-100">Revenue, gross profit, contractors and recruiting cost by recruiter, team and client</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {meta?.period?.label ? <AppChip label={`Period: ${meta.period.label}`} /> : null}
          {meta?.compareBasis ? <AppChip label={`vs ${meta.compareBasis}`} /> : null}
          <AppChip label="Currency: USD" />
          {meta?.asOf ? <AppChip label={`Data as of ${formatDate(meta.asOf)}`} /> : null}
          {actions}
        </div>
      </div>
    </div>
  );
}
