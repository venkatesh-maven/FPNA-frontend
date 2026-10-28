import React, { Suspense, useMemo } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { FiInfo } from "react-icons/fi";
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

const Chevron = () => (
  <svg className="w-3 h-3 text-gray-400 mx-1" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 9 4-4-4-4" />
  </svg>
);

function Shell() {
  const location = useLocation();
  const { filters } = useSalesFilters();
  const tab = TABS.find((t) => location.pathname.startsWith(t.path));
  const headerMeta = useMemo(() => {
    const period = resolvePeriod({ preset: filters.period, from: filters.from, to: filters.to }, { asOf: DATASET_AS_OF, fiscalStartMonth: FISCAL_START_MONTH });
    return { period: { label: period.label }, compareBasis: compareLabel(filters.compare), asOf: DATASET_AS_OF };
  }, [filters.period, filters.from, filters.to, filters.compare]);

  return (
    <div className="min-h-screen bg-sky-50 space-y-2">
      <SalesHeader meta={tab?.filters === false ? { asOf: DATASET_AS_OF } : headerMeta} actions={<ViewAsSwitcher />} />
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
        {tab?.filters === false ? null : <FilterBar />}
      </div>
      <Suspense fallback={<Spinner />}>
        <Outlet />
      </Suspense>
    </div>
  );
}

/** Shell for every Sales Performance tab; providers stay mounted across tab switches. */
export default function SalesAnalyticsLayout() {
  return (
    <SalesAccessProvider>
      <SalesFiltersProvider>
        <Shell />
      </SalesFiltersProvider>
    </SalesAccessProvider>
  );
}
