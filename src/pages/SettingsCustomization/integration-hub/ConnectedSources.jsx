import React, { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { FiPlus, FiSearch, FiRefreshCw, FiGrid, FiTrash2, FiX, FiDatabase, FiArrowRight } from "react-icons/fi";
import IntegrationLogo from "./IntegrationLogo";
import { INTEGRATION_BY_ID, connectionKey, timeAgo } from "./catalog";
import { datasetsFor } from "./demoData";

const STATUS_STYLES = {
  Paid: "bg-emerald-50 text-emerald-700",
  Open: "bg-sky-50 text-sky-700",
  Overdue: "bg-red-50 text-red-700",
};

const formatMoney = (value, currency) => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(value);
  } catch {
    // Not an ISO currency code the browser knows - show the number with the code as-is.
    const amount = Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return currency ? `${currency} ${amount}` : amount;
  }
};

const formatCell = (value, column, currency) => {
  if (column.money) return formatMoney(value, currency);
  if (column.status) {
    return (
      <span className={`text-[11px] font-medium rounded px-1.5 py-0.5 ${STATUS_STYLES[value] || "bg-gray-100 text-gray-600"}`}>
        {value}
      </span>
    );
  }
  return value;
};

const DatasetPreview = ({ dataset, currency, onClose }) => (
  <div className="mt-5 border border-gray-100 rounded-lg">
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-sky-900 truncate">{dataset.name}</p>
        <p className="text-[11px] text-gray-400">
          {dataset.rows
            ? `Showing ${dataset.rows.length} of ${dataset.records.toLocaleString()} records (demo sample)`
            : "Preview isn't available for this dataset in the demo"}
        </p>
      </div>
      <button type="button" onClick={onClose} aria-label="Close preview"
        className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100">
        <FiX className="w-4 h-4" />
      </button>
    </div>
    {dataset.rows && (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500">
              {dataset.columns.map((c) => (
                <th key={c.key} className={`px-4 py-2 font-medium whitespace-nowrap ${c.money ? "text-right" : ""}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {dataset.rows.map((row, i) => (
              <tr key={i}>
                {dataset.columns.map((c) => (
                  <td key={c.key} className={`px-4 py-2 whitespace-nowrap text-gray-700 ${c.money ? "text-right tabular-nums" : ""}`}>
                    {formatCell(row[c.key], c, currency)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const ConnectedSources = ({
  connections,
  customers = [],
  selectedKey,
  onSelect,
  onAdd,
  onSync,
  onDisconnect,
  onTryQuickBooks,
}) => {
  const [search, setSearch] = useState("");
  const [datasetSearch, setDatasetSearch] = useState("");
  const [previewId, setPreviewId] = useState(null);
  const [syncingKey, setSyncingKey] = useState(null);

  const list = useMemo(
    () =>
      Object.entries(connections)
        .flatMap(([integrationId, items]) =>
          (items || []).map((c) => ({
            ...c,
            integration: INTEGRATION_BY_ID[integrationId],
            key: connectionKey(integrationId, c.id),
          }))
        )
        .filter((c) => c.integration)
        .sort((a, b) => new Date(b.connectedAt) - new Date(a.connectedAt)),
    [connections]
  );

  if (list.length === 0) {
    return (
      <div className="border border-dashed border-gray-200 rounded-xl py-16 px-6 text-center">
        <FiDatabase className="w-8 h-8 mx-auto text-sky-300" />
        <h3 className="mt-3 text-base font-semibold text-sky-900">No data sources connected yet</h3>
        <p className="mt-1 text-sm text-gray-500">Connect a source to see its datasets here.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={onTryQuickBooks}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-sky-800 hover:bg-sky-900 text-white">
            Try the QuickBooks demo <FiArrowRight className="w-4 h-4" />
          </button>
          <button type="button" onClick={onAdd}
            className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">
            Browse integrations
          </button>
        </div>
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const filtered = list.filter(
    (c) => !q || `${c.integration.name} ${c.name} ${c.account || ""} ${c.company || ""}`.toLowerCase().includes(q)
  );
  const selected = list.find((c) => c.key === selectedKey) || list[0];
  const datasets = datasetsFor(selected.integration, customers);
  const dq = datasetSearch.trim().toLowerCase();
  const visibleDatasets = datasets.filter((d) => !dq || d.name.toLowerCase().includes(dq));
  const preview = datasets.find((d) => d.id === previewId);
  const isSyncing = syncingKey === selected.key;

  const select = (key) => {
    onSelect(key);
    setPreviewId(null);
    setDatasetSearch("");
  };

  const handleSync = (c) => {
    setSyncingKey(c.key);
    setTimeout(() => {
      onSync(c.integration.id, c.id);
      setSyncingKey(null);
      toast.success(`${c.integration.name} synced`);
    }, 1500);
  };

  const handleDisconnect = (c) => {
    if (!window.confirm(`Disconnect ${c.name}?`)) return;
    onDisconnect(c.integration, c.id);
    setPreviewId(null);
  };

  return (
    <div className="flex flex-col lg:flex-row border border-gray-100 rounded-xl overflow-hidden bg-white">
      {/* ================= CONNECTION LIST ================= */}
      <aside className="lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-gray-100">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <h3 className="text-sm font-semibold text-sky-900">Data</h3>
          <button type="button" onClick={onAdd} aria-label="Add data source" title="Add data source"
            className="w-7 h-7 flex items-center justify-center rounded-md bg-sky-800 hover:bg-sky-900 text-white">
            <FiPlus className="w-4 h-4" />
          </button>
        </div>
        <div className="px-4 pb-3">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search" aria-label="Search connections"
              className="w-full bg-gray-50 border border-gray-100 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none" />
          </div>
        </div>
        <ul className="max-h-72 lg:max-h-[560px] overflow-y-auto px-2 pb-3 space-y-0.5">
          {filtered.map((c) => (
            <li key={c.key}>
              <button type="button" onClick={() => select(c.key)}
                className={`w-full flex items-center gap-3 text-left rounded-lg px-2 py-2 transition ${
                  c.key === selected.key ? "bg-sky-50" : "hover:bg-gray-50"
                }`}>
                <IntegrationLogo item={c.integration} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{c.integration.name}</p>
                  <p className="text-[11px] text-gray-400 truncate">{c.company || c.account || c.name}</p>
                </div>
                <span className="flex items-center gap-1 text-[10px] text-gray-400 shrink-0">
                  <FiRefreshCw className="w-3 h-3" />
                  {timeAgo(c.lastSyncedAt || c.connectedAt)}
                </span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="px-2 py-6 text-center text-xs text-gray-400">No matches</li>}
        </ul>
      </aside>

      {/* ================= SELECTED CONNECTION ================= */}
      <section className="flex-1 min-w-0 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <IntegrationLogo item={selected.integration} size="lg" />
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-sky-900 flex items-center gap-2">
                <span className="truncate">{selected.integration.name}</span>
                {selected.demo && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-700 bg-sky-50 border border-sky-100 rounded px-1.5 py-0.5">
                    Demo
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-500 truncate">
                {selected.account || selected.name}
                {selected.company ? ` · ${selected.company}` : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => handleSync(selected)} disabled={isSyncing}
              className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-60">
              <FiRefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Syncing..." : "Sync now"}
            </button>
            <button type="button" onClick={() => handleDisconnect(selected)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg text-red-600 hover:bg-red-50">
              <FiTrash2 className="w-4 h-4" /> Disconnect
            </button>
          </div>
        </div>

        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <div className="flex gap-1"><dt className="text-gray-400">Connection:</dt><dd className="text-gray-700">{selected.name}</dd></div>
          {selected.currency && (
            <div className="flex gap-1"><dt className="text-gray-400">Currency:</dt><dd className="text-gray-700">{selected.currency}</dd></div>
          )}
          {selected.frequency && (
            <div className="flex gap-1"><dt className="text-gray-400">Sync:</dt><dd className="text-gray-700">{selected.frequency}</dd></div>
          )}
          <div className="flex gap-1">
            <dt className="text-gray-400">Last synced:</dt>
            <dd className="text-gray-700">{timeAgo(selected.lastSyncedAt || selected.connectedAt)}</dd>
          </div>
        </dl>

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datasets</p>
          <div className="relative w-48">
            <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input type="search" value={datasetSearch} onChange={(e) => setDatasetSearch(e.target.value)}
              placeholder="Search" aria-label="Search datasets"
              className="w-full bg-gray-50 border border-gray-100 rounded-lg pl-8 pr-2 py-1.5 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none" />
          </div>
        </div>

        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="py-2 font-medium">Dataset name</th>
                <th className="py-2 font-medium text-right">Records</th>
                <th className="py-2 pl-4 font-medium text-right whitespace-nowrap">Last synced</th>
              </tr>
            </thead>
            <tbody>
              {visibleDatasets.map((d) => (
                <tr key={d.id} onClick={() => setPreviewId(d.id)}
                  className={`border-b border-gray-50 cursor-pointer ${previewId === d.id ? "bg-sky-50" : "hover:bg-gray-50"}`}>
                  <td className="py-2.5">
                    <span className="flex items-center gap-2 text-gray-800">
                      <FiGrid className="w-4 h-4 text-violet-500 shrink-0" />
                      {d.name}
                    </span>
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-gray-600">{d.records.toLocaleString()}</td>
                  <td className="py-2.5 pl-4 text-right text-gray-400 whitespace-nowrap">
                    {timeAgo(selected.lastSyncedAt || selected.connectedAt)}
                  </td>
                </tr>
              ))}
              {visibleDatasets.length === 0 && (
                <tr><td colSpan={3} className="py-6 text-center text-xs text-gray-400">No datasets match</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {preview && <DatasetPreview dataset={preview} currency={selected.currency} onClose={() => setPreviewId(null)} />}
      </section>
    </div>
  );
};

export default ConnectedSources;
