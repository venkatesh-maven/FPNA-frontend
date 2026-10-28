import React from "react";
import { FiSearch } from "react-icons/fi";
import AppCard from "../../../../components/ui/AppCard";
import AppSelect from "../../../../components/ui/AppSelect";
import { FINANCIAL_CUSTOM_REPORT_FIELD_DEFS } from "../financialCustomReportFields";
import { PRIMARY_METRIC_OPTIONS, driversFor } from "../financialCustomReportMetricDrivers";

const FIELD_LABEL = Object.fromEntries(FINANCIAL_CUSTOM_REPORT_FIELD_DEFS.map((f) => [f.field, f.label]));

const AGG_FUNC_OPTIONS = [
  { value: "sum", label: "Sum" },
  { value: "avg", label: "Average" },
  { value: "count", label: "Count" },
  { value: "min", label: "Minimum" },
  { value: "max", label: "Maximum" },
];

const CHECKBOX_CLASS = "w-4 h-4 text-sky-600 bg-gray-100 border-gray-300 rounded focus:ring-sky-500";

// "Which financial metric do I want?" — two pathways per the redesign spec:
// Standard Financial Metrics (a governed Primary Metric + dynamic
// supporting drivers, financialCustomReportMetricDrivers.js) or GL Account
// Analysis (raw chart-of-accounts rows, a second pathway rather than one
// more checkbox in the same list — the spec calls this distinction out
// explicitly: standard metrics are governed calculations, GL accounts are
// raw financial dimensions).
export default function WhatToShowStep({
  pathway,
  onPathwayChange,
  primaryMetric,
  onPrimaryMetricChange,
  selectedDrivers,
  onToggleDriver,
  aggFunc,
  onAggFuncChange,
  glAccounts,
  glAccountsLoading,
  selectedGLAccountIds,
  onToggleGLAccount,
  glAccountSearch,
  onGLAccountSearchChange,
}) {
  const drivers = driversFor(primaryMetric);

  const filteredGLAccounts = (glAccounts || []).filter((a) => {
    const q = (glAccountSearch || "").trim().toLowerCase();
    if (!q) return true;
    return a.account_name.toLowerCase().includes(q) || a.account_type.toLowerCase().includes(q);
  });

  return (
    <AppCard>
      <h3 className="text-md font-semibold text-sky-800 mb-1">2. What to Show</h3>
      <p className="text-x text-slate-500 mb-3">Which financial metric do you want to analyze?</p>

      <div className="flex gap-2 mb-4 border-b border-sky-100 pb-3">
        <button
          type="button"
          onClick={() => onPathwayChange("standard")}
          className={[
            "px-3 py-1.5 rounded-lg text-x font-semibold border transition-colors",
            pathway === "standard" ? "bg-sky-900 text-white border-sky-900" : "bg-white text-sky-800 border-sky-200 hover:bg-sky-50",
          ].join(" ")}
        >
          Standard Financial Metrics
        </button>
        <button
          type="button"
          onClick={() => onPathwayChange("gl_account")}
          className={[
            "px-3 py-1.5 rounded-lg text-x font-semibold border transition-colors",
            pathway === "gl_account" ? "bg-sky-900 text-white border-sky-900" : "bg-white text-sky-800 border-sky-200 hover:bg-sky-50",
          ].join(" ")}
        >
          GL Account Analysis
        </button>
      </div>

      {pathway === "gl_account" ? (
        <div>
          <div className="relative mb-3">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search GL accounts…"
              value={glAccountSearch}
              onChange={(e) => onGLAccountSearchChange(e.target.value)}
              className="w-full rounded-lg border border-sky-200 bg-white pl-8 pr-3 py-2 text-x text-slate-700 outline-none transition-colors duration-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </div>
          <div className="max-h-56 overflow-auto rounded-lg border border-sky-100 divide-y divide-sky-50">
            {glAccountsLoading ? (
              <p className="p-3 text-x text-slate-400">Loading GL accounts…</p>
            ) : filteredGLAccounts.length === 0 ? (
              <p className="p-3 text-x text-slate-400">No matching GL accounts with activity this year.</p>
            ) : (
              filteredGLAccounts.map((a) => (
                <label key={a.account_id} className="flex items-center gap-2 px-3 py-2 text-s text-slate-700 hover:bg-sky-50 cursor-pointer">
                  <input
                    type="checkbox"
                    className={CHECKBOX_CLASS}
                    checked={selectedGLAccountIds.includes(a.account_id)}
                    onChange={() => onToggleGLAccount(a.account_id)}
                  />
                  <span className="flex-1">{a.account_name}</span>
                  <span className="text-x text-slate-400">{a.account_type}</span>
                </label>
              ))
            )}
          </div>
          {selectedGLAccountIds.length > 0 ? (
            <p className="text-x text-sky-600 mt-2">{selectedGLAccountIds.length} account(s) selected</p>
          ) : (
            <p className="text-x text-slate-400 mt-2">Select one or more GL accounts to analyze.</p>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {PRIMARY_METRIC_OPTIONS.map((m) => (
              <button
                key={m.field}
                type="button"
                onClick={() => onPrimaryMetricChange(m.field)}
                className={[
                  "px-3 py-1.5 rounded-full text-x font-medium border transition-colors",
                  primaryMetric === m.field
                    ? "bg-sky-900 text-white border-sky-900"
                    : "bg-white text-sky-800 border-sky-200 hover:bg-sky-50",
                ].join(" ")}
              >
                {m.label}
              </button>
            ))}
          </div>

          {drivers.length > 0 ? (
            <div className="rounded-lg bg-sky-50 border border-sky-100 p-3">
              <p className="text-x font-medium text-sky-700 mb-2">Supporting Drivers (optional)</p>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {drivers.map((field) => (
                  <label key={field} className="flex items-center gap-2 text-s text-slate-700">
                    <input
                      type="checkbox"
                      className={CHECKBOX_CLASS}
                      checked={selectedDrivers.includes(field)}
                      onChange={() => onToggleDriver(field)}
                    />
                    {FIELD_LABEL[field] || field}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      <div className="mt-4 max-w-[220px]">
        <AppSelect label="Aggregation" value={aggFunc} onChange={(e) => onAggFuncChange(e.target.value)} options={AGG_FUNC_OPTIONS} />
      </div>
    </AppCard>
  );
}
