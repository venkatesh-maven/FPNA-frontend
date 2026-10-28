import React, { useState } from "react";
import { Link } from "react-router-dom";
import ReportSidebar from "./ReportSidebar";
import ReportHeader from "./ReportHeader";
import { CustomReportSavedViewsProvider } from "../../context/CustomReportSavedViewsContext";

const ReportsLayout = ({ children }) => {
  // Each report page renders its own ReportsLayout, so picking a report
  // remounts this with the sidebar collapsed and the report taking the full
  // width. With no report to show (the bare landing route) the list stays open.
  const hasReport = React.Children.count(children) > 0;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(hasReport);

  return (
    <div className="min-h-screen bg-sky-50 ">
     
      <ReportHeader />
       <nav className="flex mb-2" aria-label="Breadcrumb">
        <ol className="inline-flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse">
          <li className="inline-flex items-center">
            <Link
              to="/"
              className="inline-flex items-center text-s font-medium text-sky-900 hover:text-blue-600"
            >
              Home
            </Link>
          </li>
          <li aria-current="page">
            <div className="flex items-center">
              <svg
                className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 6 10"
              >
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="m1 9 4-4-4-4"
                />
              </svg>
              <span className="ms-1 text-s font-medium text-gray-500 md:ms-2">
                Financial Reports
              </span>
            </div>
          </li>
        </ol>
      </nav>

       <div className="flex gap-3">
        <CustomReportSavedViewsProvider>
          <ReportSidebar
            collapsible={hasReport}
            collapsed={hasReport && sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((c) => !c)}
            onSelect={() => setSidebarCollapsed(true)}
          />
          {children}
        </CustomReportSavedViewsProvider>
      </div>
    </div>
  );
};

export default ReportsLayout;