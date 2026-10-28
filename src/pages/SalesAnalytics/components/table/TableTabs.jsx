import React, { useState } from "react";

/**
 * A few related tables inside one section, one at a time.
 * `tabs` = [{ id, label, count?, description?, render() }].
 */
export default function TableTabs({ tabs, label = "Tables" }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const tab = tabs.find((t) => t.id === active) || tabs[0];
  if (!tab) return null;
  return (
    <div className="rounded-lg border border-sky-100 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label={label}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab.id === t.id}
            onClick={() => setActive(t.id)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium ${tab.id === t.id ? "border-sky-900 bg-sky-900 text-white" : "border-sky-200 bg-white text-sky-800 hover:bg-sky-50"}`}
          >
            {t.label}
            {t.count != null ? <span className={`ml-1.5 ${tab.id === t.id ? "text-sky-200" : "text-sky-500"}`}>{t.count}</span> : null}
          </button>
        ))}
      </div>
      {tab.description ? <p className="text-xs text-sky-600">{tab.description}</p> : null}
      <div role="tabpanel">{tab.render()}</div>
    </div>
  );
}
