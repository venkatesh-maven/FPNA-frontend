import React, { useEffect, useRef, useState } from "react";
import {
  FiX,
  FiCheck,
  FiCheckCircle,
  FiLoader,
  FiShield,
  FiArrowRight,
  FiArrowLeft,
  FiInfo,
  FiRepeat,
  FiLock,
} from "react-icons/fi";
import IntegrationLogo from "./IntegrationLogo";
import { QB_COMPANIES, QB_DATASETS, QB_DEMO_USER } from "./demoData";

// Demo-only walkthrough of connecting QuickBooks Online. No request leaves the
// browser: "authorize" and "sync" are timers over the sample data in demoData.js.
// `companies` / `demoUser` come from the logged-in organization when available.

const STEPS = ["Overview", "Authorize", "Company", "Sync", "Done"];
const HISTORY_OPTIONS = ["Last 12 months", "Last 24 months", "Since FY2023 start"];
const FREQUENCY_OPTIONS = ["Every hour", "Daily at 2:00 AM", "Manual only"];
const TOTAL_RECORDS = QB_DATASETS.reduce((sum, d) => sum + d.records, 0);

const FpnaTile = () => (
  <span className="w-16 h-16 shrink-0 flex items-center justify-center rounded-lg bg-sky-800 text-white text-lg font-bold">
    FP
  </span>
);

const Stepper = ({ step }) => (
  <ol className="flex items-center gap-2 overflow-x-auto">
    {STEPS.map((label, i) => {
      const done = i < step;
      const active = i === step;
      return (
        <li key={label} className="flex items-center gap-2 shrink-0">
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold ${
              done ? "bg-emerald-500 text-white" : active ? "bg-sky-800 text-white" : "bg-gray-100 text-gray-400"
            }`}
          >
            {done ? <FiCheck className="w-3.5 h-3.5" /> : i + 1}
          </span>
          <span className={`text-xs ${active ? "text-sky-900 font-semibold" : "text-gray-400"}`}>{label}</span>
          {i < STEPS.length - 1 && <span className="w-6 h-px bg-gray-200" />}
        </li>
      );
    })}
  </ol>
);

const DemoNote = () => (
  <div className="flex items-start gap-2 rounded-lg bg-sky-50 border border-sky-100 px-3 py-2 text-xs text-sky-800">
    <FiInfo className="w-4 h-4 mt-0.5 shrink-0" />
    Demo mode: this walkthrough uses sample data. No real QuickBooks account is contacted and nothing leaves this browser.
  </div>
);

const QuickBooksConnectWizard = ({
  item,
  companies = QB_COMPANIES,
  demoUser = QB_DEMO_USER,
  onClose,
  onComplete,
  onViewData,
}) => {
  const companyList = companies.length ? companies : QB_COMPANIES;
  const [step, setStep] = useState(0);
  const [authorizing, setAuthorizing] = useState(false);
  const [companyId, setCompanyId] = useState(companyList[0].id);
  const [connectionName, setConnectionName] = useState("");
  const [history, setHistory] = useState(HISTORY_OPTIONS[1]);
  const [frequency, setFrequency] = useState(FREQUENCY_OPTIONS[1]);
  const [progress, setProgress] = useState(() => QB_DATASETS.map(() => 0));
  const [created, setCreated] = useState(null);
  const authTimer = useRef(null);

  // The company list can arrive after the wizard opens; fall back to the first one.
  const company = companyList.find((c) => c.id === companyId) || companyList[0];
  const syncing = step === 3;
  const syncedRecords = progress.reduce((sum, n) => sum + n, 0);
  const syncDone = progress.every((n, i) => n >= QB_DATASETS[i].records);

  useEffect(() => () => clearTimeout(authTimer.current), []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !syncing && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, syncing]);

  // Sync animation: fill each dataset in turn, a fifth of its records per tick.
  useEffect(() => {
    if (!syncing) return undefined;
    const timer = setInterval(() => {
      setProgress((prev) => {
        const idx = prev.findIndex((n, i) => n < QB_DATASETS[i].records);
        if (idx === -1) return prev;
        const total = QB_DATASETS[idx].records;
        const next = [...prev];
        next[idx] = Math.min(total, next[idx] + Math.max(1, Math.ceil(total / 5)));
        return next;
      });
    }, 110);
    return () => clearInterval(timer);
  }, [syncing]);

  useEffect(() => {
    if (!syncing || !syncDone) return undefined;
    const timer = setTimeout(() => {
      const now = new Date().toISOString();
      const connection = {
        id: Date.now(),
        name: connectionName.trim() || `QuickBooks - ${company.name}`,
        account: demoUser,
        company: company.name,
        country: company.country,
        currency: company.currency,
        realmId: company.realmId,
        history,
        frequency,
        connectedAt: now,
        lastSyncedAt: now,
        demo: true,
      };
      setCreated(connection);
      onComplete(connection);
      setStep(4);
    }, 600);
    return () => clearTimeout(timer);
  }, [syncing, syncDone, connectionName, company, demoUser, history, frequency, onComplete]);

  const handleAuthorize = () => {
    setAuthorizing(true);
    authTimer.current = setTimeout(() => {
      setAuthorizing(false);
      setStep(2);
    }, 1400);
  };

  const startSync = () => {
    setProgress(QB_DATASETS.map(() => 0));
    setStep(3);
  };

  const footerButton = "flex items-center gap-2 px-4 py-2 text-sm rounded-lg";
  const primary = `${footerButton} bg-sky-800 hover:bg-sky-900 text-white disabled:opacity-60`;
  const secondary = `${footerButton} border border-gray-200 text-gray-700 hover:bg-white`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onMouseDown={(e) => e.target === e.currentTarget && !syncing && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qb-wizard-title"
        className="w-full max-w-2xl bg-white rounded-xl shadow-xl max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <IntegrationLogo item={item} />
            <h3 id="qb-wizard-title" className="text-base font-semibold text-sky-900 truncate">
              Connect QuickBooks Online
            </h3>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-700 bg-sky-50 border border-sky-100 rounded px-1.5 py-0.5">
              Demo
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={syncing}
            aria-label="Close"
            className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-40"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-3 border-b border-gray-100">
          <Stepper step={step} />
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {step === 0 && (
            <div className="space-y-5">
              <div className="flex items-center justify-center gap-4 py-2">
                <IntegrationLogo item={item} size="xl" />
                <FiRepeat className="w-5 h-5 text-gray-300" />
                <FpnaTile />
              </div>
              <div className="text-center">
                <h4 className="text-lg font-semibold text-sky-900">Bring your QuickBooks books into FP&amp;A</h4>
                <p className="text-sm text-gray-500 mt-1">
                  Actuals flow into reports, budgets and forecasts automatically, with no more monthly exports.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">What we&apos;ll import</p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {QB_DATASETS.map((d) => (
                    <li key={d.id} className="flex items-center gap-2 text-sm text-gray-700">
                      <FiCheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                      {d.name}
                    </li>
                  ))}
                </ul>
              </div>
              <DemoNote />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <IntegrationLogo item={item} size="lg" />
                  <FiArrowRight className="w-4 h-4 text-gray-300" />
                  <span className="w-12 h-12 flex items-center justify-center rounded-lg bg-sky-800 text-white font-bold">
                    FP
                  </span>
                </div>
                <p className="text-center text-sm text-gray-700">
                  <span className="font-semibold">FPnA Insights</span> wants to access your QuickBooks Online company
                </p>
                <div className="mt-4 flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
                  <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-semibold uppercase">
                    {demoUser.charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">{demoUser}</p>
                    <p className="text-[11px] text-gray-400">Signed in (demo)</p>
                  </div>
                </div>
                <p className="mt-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">This will allow FPnA Insights to</p>
                <ul className="mt-2 space-y-2">
                  {[
                    "View your company information",
                    "View accounting data: accounts, transactions and reports",
                    "View customers, vendors, invoices and bills",
                  ].map((scope) => (
                    <li key={scope} className="flex items-start gap-2 text-sm text-gray-700">
                      <FiShield className="w-4 h-4 mt-0.5 text-sky-600 shrink-0" />
                      {scope}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 flex items-center gap-2 text-[11px] text-gray-400">
                  <FiLock className="w-3.5 h-3.5" />
                  Read-only access. FPnA Insights can&apos;t create, edit or delete anything in QuickBooks.
                </p>
              </div>
              <DemoNote />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold text-sky-900 mb-2">
                  {companyList.length > 1 ? "Choose a company to connect" : "Company to connect"}
                </p>
                <div className="space-y-2">
                  {companyList.map((c) => (
                    <label
                      key={c.id}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition ${
                        company.id === c.id ? "border-sky-500 bg-sky-50" : "border-gray-200 hover:border-sky-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="qb-company"
                        value={c.id}
                        checked={company.id === c.id}
                        onChange={() => setCompanyId(c.id)}
                        className="accent-sky-700"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800">{c.name}</p>
                        <p className="text-[11px] text-gray-400">
                          {[c.country, c.currency, `Company ID ${c.realmId}`].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="qb-connection-name" className="block text-sm font-semibold text-sky-900 mb-1">
                    Connection name
                  </label>
                  <input
                    id="qb-connection-name"
                    value={connectionName}
                    onChange={(e) => setConnectionName(e.target.value)}
                    placeholder={`QuickBooks - ${company.name}`}
                    className="w-full border border-sky-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="qb-history" className="block text-sm font-semibold text-sky-900 mb-1">
                    Import history
                  </label>
                  <select
                    id="qb-history"
                    value={history}
                    onChange={(e) => setHistory(e.target.value)}
                    className="w-full border border-sky-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  >
                    {HISTORY_OPTIONS.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="qb-frequency" className="block text-sm font-semibold text-sky-900 mb-1">
                    Sync frequency
                  </label>
                  <select
                    id="qb-frequency"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full border border-sky-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  >
                    {FREQUENCY_OPTIONS.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="font-semibold text-sky-900">Importing data from {company.name}</span>
                  <span className="text-gray-500">{Math.round((syncedRecords / TOTAL_RECORDS) * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-150"
                    style={{ width: `${(syncedRecords / TOTAL_RECORDS) * 100}%` }}
                  />
                </div>
              </div>
              <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
                {QB_DATASETS.map((d, i) => {
                  const count = progress[i];
                  const done = count >= d.records;
                  const active = !done && (i === 0 || progress[i - 1] >= QB_DATASETS[i - 1].records);
                  return (
                    <li key={d.id} className="flex items-center gap-3 px-3 py-2">
                      {done ? (
                        <FiCheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : active ? (
                        <FiLoader className="w-4 h-4 text-sky-600 animate-spin shrink-0" />
                      ) : (
                        <span className="w-4 h-4 rounded-full border-2 border-gray-200 shrink-0" />
                      )}
                      <span className={`flex-1 text-sm ${done || active ? "text-gray-800" : "text-gray-400"}`}>{d.name}</span>
                      <span className="text-xs tabular-nums text-gray-500">
                        {count.toLocaleString()} / {d.records.toLocaleString()}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-gray-400">Keep this window open while the first sync finishes.</p>
            </div>
          )}

          {step === 4 && created && (
            <div className="space-y-5">
              <div className="text-center py-2">
                <span className="mx-auto w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                  <FiCheckCircle className="w-8 h-8 text-emerald-500" />
                </span>
                <h4 className="mt-3 text-lg font-semibold text-sky-900">QuickBooks connected</h4>
                <p className="text-sm text-gray-500">
                  {created.company} is synced and ready to use in reports and forecasts.
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Connection", created.name],
                  ["Company ID", created.realmId],
                  ["Datasets", QB_DATASETS.length],
                  ["Records imported", TOTAL_RECORDS.toLocaleString()],
                  ["History", created.history],
                  ["Sync frequency", created.frequency],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-gray-50 px-3 py-2">
                    <dt className="text-[11px] text-gray-400">{label}</dt>
                    <dd className="text-gray-800 truncate">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <div>
            {(step === 1 || step === 2) && (
              <button type="button" onClick={() => setStep(step - 1)} disabled={authorizing} className={secondary}>
                <FiArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
            {step === 0 && (
              <button type="button" onClick={onClose} className={secondary}>
                Cancel
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {step === 0 && (
              <button type="button" onClick={() => setStep(1)} className={primary}>
                Continue <FiArrowRight className="w-4 h-4" />
              </button>
            )}
            {step === 1 && (
              <button type="button" onClick={handleAuthorize} disabled={authorizing} className={primary}>
                {authorizing ? (
                  <>
                    <FiLoader className="w-4 h-4 animate-spin" /> Redirecting to QuickBooks...
                  </>
                ) : (
                  <>
                    <FiShield className="w-4 h-4" /> Authorize
                  </>
                )}
              </button>
            )}
            {step === 2 && (
              <button type="button" onClick={startSync} className={primary}>
                Connect &amp; start sync <FiArrowRight className="w-4 h-4" />
              </button>
            )}
            {step === 3 && (
              <button type="button" disabled className={primary}>
                <FiLoader className="w-4 h-4 animate-spin" /> Syncing...
              </button>
            )}
            {step === 4 && (
              <>
                <button type="button" onClick={onClose} className={secondary}>
                  Done
                </button>
                <button type="button" onClick={onViewData} className={primary}>
                  View data <FiArrowRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickBooksConnectWizard;
