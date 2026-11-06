import React, { Suspense, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { FiAlertCircle, FiInfo } from "react-icons/fi";
import { SalesAccessProvider } from "./access/SalesAccessContext";
import { SalesFiltersProvider, useSalesFilters } from "./filters/SalesFiltersContext";
import ViewAsSwitcher from "./access/ViewAsSwitcher";
import SalesHeader from "./components/SalesHeader";
import SampleDataBanner from "./components/SampleDataBanner";
import SalesTabBar from "./components/SalesTabBar";
import FilterBar from "./filters/FilterBar";
import { Spinner } from "../Budget/budgetHelpers";
import { compareLabel, resolvePeriod } from "./calc/periods";
import { DATASET_AS_OF, FISCAL_START_MONTH } from "./config/dataset";
import { TABS } from "./config/tabs";
import { setCurrencyUnit } from "./utils/format";
import { loadLiveData, refreshTabData } from "./services/liveData";
import { AuthContext } from "../../context/AuthContext";

const Chevron = () => (
  <svg className="w-3 h-3 text-gray-400 mx-1" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 9 4-4-4-4" />
  </svg>
);

function Shell() {
  const location = useLocation();
  const { filters } = useSalesFilters();
  const tab = TABS.find((t) => location.pathname.startsWith(t.path));
  // Each tab has its own API (GET /company/staffing-analytics/<tab>): called as
  // the tab opens, it brings in what others saved since the module loaded.
  useEffect(() => {
    if (!tab) return;
    refreshTabData(tab.key).catch((e) => console.error(`Staffing analytics: could not refresh the ${tab.label} tab`, e));
  }, [tab?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  // Set here, above the page, so everything rendered below formats in the chosen unit.
  setCurrencyUnit(tab?.filters === false ? null : filters.currencyUnit);
  const asOf = DATASET_AS_OF;
  const headerMeta = useMemo(() => {
    const period = resolvePeriod({ preset: filters.period, from: filters.from, to: filters.to }, { asOf, fiscalStartMonth: FISCAL_START_MONTH });
    return { period: { label: period.label }, compareBasis: compareLabel(filters.compare), asOf };
  }, [filters.period, filters.from, filters.to, filters.compare, asOf]);

  return (
    <div className="min-h-screen bg-sky-50 space-y-2">
      <SalesHeader meta={tab?.filters === false ? { asOf } : headerMeta} actions={<ViewAsSwitcher />} />
      <nav className="flex" aria-label="Breadcrumb">
        <ol className="inline-flex items-center space-x-1 md:space-x-2 text-sm">
          <li><Link to="/" className="font-medium text-sky-900 hover:text-blue-600">Home</Link></li>
          <li className="flex items-center"><Chevron /><Link to="/performance-analytics-dashboard" className="font-medium text-sky-900 hover:text-blue-600">Performance Analytics</Link></li>
          <li className="flex items-center"><Chevron /><span className="font-medium text-gray-500">Staffing Sales Analytics</span></li>
          {tab ? <li className="flex items-center"><Chevron /><span className="font-medium text-gray-500">{tab.label}</span></li> : null}
        </ol>
      </nav>
      <SampleDataBanner />
      {location.state?.notice ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-100 border border-sky-200 text-sky-900 text-xs">
          <FiInfo size={13} /> {location.state.notice}
        </div>
      ) : null}
      <div>
        <SalesTabBar standalone={tab?.filters === false} />
        {tab?.filters === false ? null : <FilterBar showCurrencyUnit />}
      </div>
      <Suspense fallback={<Spinner />}>
        <Outlet />
      </Suspense>
    </div>
  );
}

/** Loads the module's data once; nothing renders on the sample while it does. */
function LiveDataGate({ children }) {
  const token = useContext(AuthContext)?.token;
  const [state, setState] = useState({ ready: false, error: null });
  const load = useCallback(() => {
    if (!token) return; // the app sends a signed-out user to the login page
    setState({ ready: false, error: null });
    loadLiveData(token).then(
      () => setState({ ready: true, error: null }),
      (error) => setState({ ready: false, error })
    );
  }, [token]);
  useEffect(load, [load]);

  if (state.error) {
    return (
      <div className="m-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <FiAlertCircle className="mt-0.5 shrink-0" />
        <div>
          <p>{state.error.message}</p>
          <button type="button" onClick={load} className="mt-2 rounded border border-red-300 bg-white px-3 py-1 text-xs font-medium hover:bg-red-100">
            Try again
          </button>
        </div>
      </div>
    );
  }
  return state.ready ? children : <Spinner label="Loading Staffing Sales Analytics…" />;
}

/** Shell for every Sales Performance tab; providers stay mounted across tab switches. */
export default function SalesAnalyticsLayout() {
  return (
    <LiveDataGate>
      <SalesAccessProvider>
        <SalesFiltersProvider>
          <Shell />
        </SalesFiltersProvider>
      </SalesAccessProvider>
    </LiveDataGate>
  );
}
