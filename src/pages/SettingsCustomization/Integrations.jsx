import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  FiSearch,
  FiX,
  FiChevronDown,
  FiChevronUp,
  FiLink,
  FiCheckCircle,
  FiGrid,
  FiTrash2,
  FiLock,
  FiDatabase,
} from "react-icons/fi";
import { FaCrown } from "react-icons/fa";
import { TbPlugConnected } from "react-icons/tb";
import IntegrationLogo from "./integration-hub/IntegrationLogo";
import ConnectedSources from "./integration-hub/ConnectedSources";
import QuickBooksConnectWizard from "./integration-hub/QuickBooksConnectWizard";
import useDemoCompanyData from "./integration-hub/useDemoCompanyData";
import {
  CATEGORIES,
  INTEGRATIONS,
  CATEGORY_BY_ID,
  connectionKey,
  loadConnections,
  saveConnections,
} from "./integration-hub/catalog";

const PREVIEW_COUNT = 8;

const IntegrationCard = ({ item, connectionCount, onOpen }) => (
  <button
    type="button"
    onClick={() => onOpen(item)}
    className="group flex items-center gap-3 w-full text-left bg-white border border-gray-100 rounded-lg px-3 py-2.5
               hover:border-sky-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400 transition"
  >
    <IntegrationLogo item={item} />
    <span className="flex-1 min-w-0 text-sm text-gray-700 leading-snug line-clamp-2 group-hover:text-sky-900">
      {item.name}
    </span>
    {item.demo && (
      <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-700 bg-sky-50 border border-sky-100 rounded px-1.5 py-0.5">
        Demo
      </span>
    )}
    {connectionCount > 0 && (
      <span
        className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5"
        title={`${connectionCount} connected`}
      >
        <FiLink className="w-3 h-3" />
        {connectionCount}
      </span>
    )}
    {item.premium && (
      <FaCrown className="w-3.5 h-3.5 text-amber-400 shrink-0" title="Premium integration" />
    )}
  </button>
);

const ConnectModal = ({ item, connections, onClose, onConnect, onDisconnect }) => {
  const [accountName, setAccountName] = useState("");
  const [connecting, setConnecting] = useState(false);
  const category = CATEGORY_BY_ID[item.category];

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleConnect = () => {
    setConnecting(true);
    // Simulated OAuth / credential handshake until the backend exists.
    setTimeout(() => {
      onConnect(item, accountName.trim() || `${item.name} account ${connections.length + 1}`);
      setAccountName("");
      setConnecting(false);
    }, 1000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="integration-title"
        className="w-full max-w-lg bg-white rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start gap-4 p-5 border-b border-gray-100">
          <IntegrationLogo item={item} size="lg" />
          <div className="flex-1 min-w-0">
            <h3 id="integration-title" className="text-lg font-semibold text-sky-900 flex items-center gap-2">
              {item.name}
              {item.premium && <FaCrown className="w-4 h-4 text-amber-400" title="Premium integration" />}
            </h3>
            <p className="text-xs text-sky-600 mt-0.5">{category?.label}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <p className="text-sm text-gray-600">{category?.blurb}</p>

          {item.premium && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800">
              <FiLock className="w-4 h-4 mt-0.5 shrink-0" />
              This is a premium integration. It may require an upgraded plan once integrations go live.
            </div>
          )}

          {connections.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-sky-900 mb-2">Connected accounts</h4>
              <ul className="space-y-2">
                {connections.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2">
                    <FiCheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">{c.name}</p>
                      <p className="text-[11px] text-gray-400">
                        Connected {new Date(c.connectedAt).toLocaleString()}
                      </p>
                    </div>
                    <button type="button" onClick={() => onDisconnect(item, c.id)}
                      className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50">
                      <FiTrash2 className="w-3.5 h-3.5" /> Disconnect
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label htmlFor="integration-account" className="block text-sm font-semibold text-sky-900 mb-1">
              {connections.length > 0 ? "Add another account" : "Connection name"}
            </label>
            <input
              id="integration-account"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder={`e.g. ${item.name} - Production`}
              className="w-full border border-sky-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              You'll be asked to sign in to {item.name} and authorize read access.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-white">
            Close
          </button>
          <button type="button" onClick={handleConnect} disabled={connecting}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-sky-800 hover:bg-sky-900 text-white disabled:opacity-60">
            <TbPlugConnected className="w-4 h-4" />
            {connecting ? "Connecting..." : `Connect ${item.name}`}
          </button>
        </div>
      </div>
    </div>
  );
};

const Integrations = () => {
  const [connections, setConnections] = useState(loadConnections);
  const [view, setView] = useState(() => (Object.keys(connections).length ? "connected" : "browse"));
  const [selectedKey, setSelectedKey] = useState(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [connectedOnly, setConnectedOnly] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [selected, setSelected] = useState(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  // Logged-in organization + its real customers, used to personalise the demo data.
  const { companies, customers, demoUser } = useDemoCompanyData();

  useEffect(() => saveConnections(connections), [connections]);

  const countFor = (id) => (connections[id] || []).length;
  const totalConnected = INTEGRATIONS.filter((i) => countFor(i.id) > 0).length;
  const totalConnections = Object.values(connections).reduce((sum, list) => sum + (list || []).length, 0);

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CATEGORIES
      .filter((c) => activeCategory === "all" || c.id === activeCategory)
      .map((c) => ({
        ...c,
        items: INTEGRATIONS.filter(
          (i) =>
            i.category === c.id &&
            (!q || i.name.toLowerCase().includes(q)) &&
            (!connectedOnly || (connections[i.id] || []).length > 0)
        ),
      }))
      .filter((c) => c.items.length > 0);
  }, [activeCategory, search, connectedOnly, connections]);

  // Collapse long sections only in the default "all" browsing view.
  const collapsible = activeCategory === "all" && !search.trim() && !connectedOnly;

  const addConnection = useCallback((integrationId, connection) => {
    setConnections((prev) => ({ ...prev, [integrationId]: [...(prev[integrationId] || []), connection] }));
    setSelectedKey(connectionKey(integrationId, connection.id));
  }, []);

  const openIntegration = (item) => (item.id === "quickbooks" ? setWizardOpen(true) : setSelected(item));

  const handleConnect = (item, name) => {
    const now = new Date().toISOString();
    addConnection(item.id, { id: Date.now(), name, account: name, connectedAt: now, lastSyncedAt: now, demo: true });
    toast.success(`${item.name} connected`);
  };

  const handleWizardComplete = useCallback(
    (connection) => {
      addConnection("quickbooks", connection);
      toast.success("QuickBooks connected");
    },
    [addConnection]
  );

  const closeWizard = useCallback(() => setWizardOpen(false), []);
  const closeModal = useCallback(() => setSelected(null), []);

  const handleViewData = () => {
    setWizardOpen(false);
    setView("connected");
  };

  const handleSync = (integrationId, connectionId) => {
    setConnections((prev) => ({
      ...prev,
      [integrationId]: (prev[integrationId] || []).map((c) =>
        c.id === connectionId ? { ...c, lastSyncedAt: new Date().toISOString() } : c
      ),
    }));
  };

  const handleDisconnect = (item, connectionId) => {
    setConnections((prev) => {
      const remaining = (prev[item.id] || []).filter((c) => c.id !== connectionId);
      const next = { ...prev };
      if (remaining.length) next[item.id] = remaining;
      else delete next[item.id];
      return next;
    });
    toast.info(`${item.name} account disconnected`);
  };

  const navItems = [{ id: "all", label: "All datasources" }, ...CATEGORIES];
  const tabClass = (active) =>
    `flex items-center gap-2 px-4 py-1.5 text-sm rounded-md transition ${
      active ? "bg-white text-sky-900 font-semibold shadow-sm" : "text-gray-600 hover:text-sky-900"
    }`;

  return (
    <div className="rounded-xl">
      {/* ================= HEADER ================= */}
      <div className="mb-6 bg-gradient-to-r from-sky-700 to-sky-900 text-white p-3 rounded-xl flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Integrations</h2>
          <p className="text-sky-100 text-s mt-1">
            Connect a datasource to bring your ERP, CRM, HR, billing and other data into FP&amp;A
          </p>
        </div>
        <span className="flex items-center gap-2 bg-white/15 rounded-lg px-3 py-1.5 text-sm">
          <FiLink className="w-4 h-4" />
          {totalConnected} of {INTEGRATIONS.length} connected
        </span>
      </div>

      {/* ================= VIEW SWITCH ================= */}
      <div className="flex flex-wrap gap-1 bg-sky-50 p-1 rounded-lg w-fit mb-6">
        <button type="button" onClick={() => setView("connected")} className={tabClass(view === "connected")}>
          <FiDatabase className="w-4 h-4" />
          Connected sources
          <span className="text-[11px] text-gray-400">{totalConnections}</span>
        </button>
        <button type="button" onClick={() => setView("browse")} className={tabClass(view === "browse")}>
          <FiGrid className="w-4 h-4" />
          Browse integrations
        </button>
      </div>

      {view === "connected" ? (
        <ConnectedSources
          connections={connections}
          customers={customers}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          onAdd={() => setView("browse")}
          onSync={handleSync}
          onDisconnect={handleDisconnect}
          onTryQuickBooks={() => setWizardOpen(true)}
        />
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* ================= CATEGORY NAV ================= */}
          <nav className="lg:w-60 shrink-0">
            <ul className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 lg:sticky lg:top-4">
              {navItems.map((c) => {
                const count = c.id === "all"
                  ? INTEGRATIONS.length
                  : INTEGRATIONS.filter((i) => i.category === c.id).length;
                const active = activeCategory === c.id;
                return (
                  <li key={c.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveCategory(c.id)}
                      className={`w-full flex items-center justify-between gap-3 whitespace-nowrap text-left text-sm px-3 py-2 rounded-lg transition ${
                        active ? "bg-sky-100 text-sky-900 font-semibold" : "text-gray-600 hover:bg-sky-50 hover:text-sky-900"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {c.id === "all" && <FiGrid className="w-4 h-4" />}
                        {c.label}
                      </span>
                      <span className="text-[11px] text-gray-400">{count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* ================= LIST ================= */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
              <div className="relative flex-1 max-w-md">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search"
                  aria-label="Search integrations"
                  className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={connectedOnly}
                  onChange={(e) => setConnectedOnly(e.target.checked)}
                  className="accent-sky-700"
                />
                Connected only
              </label>
            </div>

            {sections.length === 0 && (
              <div className="text-center py-16 text-sm text-gray-500 border border-dashed border-gray-200 rounded-xl">
                {connectedOnly && !search.trim()
                  ? "No integrations connected yet. Pick a datasource to get started."
                  : `No integrations match "${search}".`}
              </div>
            )}

            <div className="space-y-8">
              {sections.map((section) => {
                const isExpanded = !collapsible || expanded[section.id];
                const visible = isExpanded ? section.items : section.items.slice(0, PREVIEW_COUNT);
                const hidden = section.items.length - PREVIEW_COUNT;
                return (
                  <section key={section.id}>
                    <h3 className="text-sm font-semibold text-sky-900 mb-3">{section.label}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                      {visible.map((item) => (
                        <IntegrationCard
                          key={item.id}
                          item={item}
                          connectionCount={countFor(item.id)}
                          onOpen={openIntegration}
                        />
                      ))}
                    </div>
                    {collapsible && hidden > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpanded((prev) => ({ ...prev, [section.id]: !prev[section.id] }))}
                        className="mt-3 flex items-center gap-1 text-xs text-sky-700 hover:text-sky-900"
                      >
                        {isExpanded ? (
                          <>Show less <FiChevronUp className="w-3.5 h-3.5" /></>
                        ) : (
                          <>Show {hidden} more <FiChevronDown className="w-3.5 h-3.5" /></>
                        )}
                      </button>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {selected && (
        <ConnectModal
          item={selected}
          connections={connections[selected.id] || []}
          onClose={closeModal}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />
      )}

      {wizardOpen && (
        <QuickBooksConnectWizard
          item={INTEGRATIONS.find((i) => i.id === "quickbooks")}
          companies={companies}
          demoUser={demoUser}
          onClose={closeWizard}
          onComplete={handleWizardComplete}
          onViewData={handleViewData}
        />
      )}
    </div>
  );
};

export default Integrations;
