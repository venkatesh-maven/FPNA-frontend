import React, { useState } from "react";
import { NavLink, useLocation, useSearchParams } from "react-router-dom";
import { TbLayoutSidebarLeftCollapse, TbLayoutSidebarLeftExpand, TbScale } from "react-icons/tb";
import {
  FiBarChart2,
  FiBriefcase,
  FiCreditCard,
  FiDollarSign,
  FiFileText,
  FiFilter,
  FiGlobe,
  FiPackage,
  FiPieChart,
  FiPlusSquare,
  FiUsers,
} from "react-icons/fi";
import { useCustomReportSavedViewsContext } from "../../context/CustomReportSavedViewsContext";

const standardReports = [
  { id: "pnl", name: "Profit & Loss Statement", path: "/reports/pnl", icon: FiBarChart2 },
  { id: "cashflow", name: "Cash Flow Statement", path: "/reports/cashflow", icon: FiDollarSign },
  { id: "revenue", name: "Revenue By Customer", path: "/reports/revenue", icon: FiUsers },
  { id: "customer-profit", name: "Customer Profitability Report", path: "/reports/customer-profit", icon: FiPieChart },
  { id: "balance-sheet", name: "Balance Sheet", path: "/reports/balance-sheet", icon: TbScale },
  { id: "project-costing", name: "Project Costing Report", path: "/reports/project-costing", icon: FiBriefcase },
  { id: "operating-expenses", name: "Operating Expenses", path: "/reports/operating-expenses", icon: FiCreditCard },
  { id: "fixed-asset-report", name: "Fixed Asset Report", path: "/reports/fixed-asset-report", icon: FiPackage },
  // { id: "payroll-reconciliation", name: "Payroll Reconciliation", path: "/reports/payroll-reconciliation" },
  { id: "sales-funnel-report-data", name: "Sales Funnel Report", path: "/reports/sales-funnel-report-data", icon: FiFilter },
];

const CUSTOM_REPORT_BUILDER_PATH = "/reports/custom-report-builder";

const linkClass = (active) =>
  `flex items-center gap-2 px-3 py-2 rounded-md text-s transition ${
    active
      ? "bg-sky-100 text-sky-800 font-semibold border-l-4 border-sky-600"
      : "text-sky-700 hover:bg-sky-50"
  }`;

// Collapsed rail — same look as the main left menu's icon-only state.
const railLinkClass = (active) =>
  `flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
    active ? "bg-sky-100 text-sky-800" : "text-sky-700 hover:bg-sky-50"
  }`;

const asideClass = "w-1/4 shrink-0 bg-white p-4 rounded-xl sticky top-[0px] self-start h-fit shadow-md";

const SECTION_HEADING = "text-sky-600 text-xs font-semibold uppercase tracking-wide mb-3";

// Heading row for the open panel, with the button that collapses it (pinned
// open) or pins it open (hover preview over the collapsed rail).
const PanelHeading = ({ className, title, button }) => (
  <div className="flex items-start justify-between gap-2">
    <h2 className={className}>{title}</h2>
    {button}
  </div>
);

const IconButton = ({ onClick, label, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    aria-label={label}
    className="-mt-1 -mr-1 p-1 rounded-md text-sky-700 hover:bg-sky-50 cursor-pointer"
  >
    {children}
  </button>
);

// Icon + name list used by the open panel and the hover preview. The first
// section's title is the panel heading; later ones get a small heading.
const LabeledSections = ({ sections, onSelect }) =>
  sections.map((section, i) => (
    <div key={section.title} className={i > 0 ? "mt-5" : ""}>
      {i > 0 ? <h3 className={SECTION_HEADING}>{section.title}</h3> : null}
      <ul className="space-y-2">
        {section.items.map((item) => (
          <li key={item.key}>
            <NavLink to={item.to} end={item.end} className={linkClass(item.active)} title={item.name} onClick={onSelect}>
              <item.icon size={16} className="shrink-0" />
              <span className="truncate">{item.name}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  ));

const ReportSidebar = ({ collapsible = false, collapsed = false, onToggle, onSelect }) => {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const { savedViews } = useCustomReportSavedViewsContext();
  const [hovered, setHovered] = useState(false);

  const isCustomReportsSection = pathname.startsWith(CUSTOM_REPORT_BUILDER_PATH);
  // Every saved-view link (and the plain builder link) share the same
  // pathname, so NavLink's own isActive (pathname-only) can't tell them
  // apart — the CustomReportBuilder page keeps ?view=<id> as the persistent
  // marker of which one is open, so use that instead.
  const activeViewId = searchParams.get("view") || "";
  const panelTitle = isCustomReportsSection ? "My Reports" : "Standard Reports";

  // "Custom Reports" is the main left nav's grouping (Financial Reports ->
  // Custom Reports -> My Reports) — this panel IS the My Reports
  // destination, so it doesn't repeat that outer label.
  const titleClass = isCustomReportsSection
    ? "text-sky-600 text-xs font-semibold uppercase tracking-wide"
    : "text-sky-800 text-md font-semibold";

  const viewItem = (view, keyPrefix, icon) => ({
    key: `${keyPrefix}${view.id}`,
    name: view.name,
    to: `${CUSTOM_REPORT_BUILDER_PATH}?view=${view.id}`,
    icon,
    active: activeViewId === view.id,
  });

  let sections;
  if (isCustomReportsSection) {
    const publishedViews = savedViews.filter((v) => v.published);
    sections = [
      {
        title: "My Reports",
        items: [
          { key: "builder", name: "Custom Report Builder", to: CUSTOM_REPORT_BUILDER_PATH, end: true, icon: FiPlusSquare, active: !activeViewId },
          ...savedViews.map((view) => viewItem(view, "", FiFileText)),
        ],
      },
      // Curated, company-wide gallery — distinct from "shared" above: a
      // shared report is reachable if you know to look for it, a published
      // one is promoted here for everyone.
      ...(publishedViews.length > 0
        ? [{ title: "Published Reports", items: publishedViews.map((view) => viewItem(view, "published-", FiGlobe)) }]
        : []),
    ];
  } else {
    sections = [
      {
        title: "Standard Reports",
        items: standardReports.map((report) => ({
          key: report.id,
          name: report.name,
          to: report.path,
          icon: report.icon,
          active: pathname === report.path || pathname.startsWith(`${report.path}/`),
        })),
      },
    ];
  }

  const handleSelect = () => {
    setHovered(false);
    onSelect?.();
  };

  const handleToggle = () => {
    setHovered(false);
    onToggle?.();
  };

  if (collapsed) {
    const pinButton = (
      <button
        type="button"
        onClick={handleToggle}
        title={`Keep ${panelTitle.toLowerCase()} open`}
        aria-label={`Keep ${panelTitle.toLowerCase()} open`}
        className="flex items-center justify-center w-10 h-10 shrink-0 rounded-lg text-sky-700 hover:bg-sky-50 cursor-pointer"
      >
        <TbLayoutSidebarLeftExpand size={20} />
      </button>
    );

    return (
      // Icon rail like the main menu: hovering previews the full list over
      // the report (the report doesn't shift); the top button pins it open.
      <div
        className="sticky top-0 z-40 self-start w-14 shrink-0"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <nav
          aria-label={panelTitle}
          className="bg-white rounded-xl shadow-md py-2 flex flex-col items-center gap-1 max-h-[calc(100vh-10rem)] overflow-y-auto"
        >
          {pinButton}
          {sections.map((section) => (
            <React.Fragment key={section.title}>
              <div className="w-8 border-t border-sky-100 my-1" />
              {section.items.map((item) => (
                <NavLink
                  key={item.key}
                  to={item.to}
                  end={item.end}
                  title={item.name}
                  aria-label={item.name}
                  className={railLinkClass(item.active)}
                  onClick={handleSelect}
                >
                  <item.icon size={18} />
                </NavLink>
              ))}
            </React.Fragment>
          ))}
        </nav>

        {hovered ? (
          // Same top padding and x-offset as the rail, so the pin button stays
          // exactly under the cursor when the preview opens over it.
          <div className="absolute left-0 top-0 w-80 max-h-[calc(100vh-10rem)] overflow-y-auto bg-white py-2 rounded-xl shadow-xl ring-1 ring-sky-100">
            <div className="flex items-center gap-1 px-2">
              {pinButton}
              <h2 className={titleClass}>{panelTitle}</h2>
            </div>
            <div className="px-4 pt-2 pb-2">
              <LabeledSections sections={sections} onSelect={handleSelect} />
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <aside className={asideClass}>
      <PanelHeading
        className={`${titleClass} ${isCustomReportsSection ? "mb-3" : "mb-4"}`}
        title={panelTitle}
        button={
          // The collapse button only shows when the layout has a report
          // beside the list to give the space to.
          collapsible ? (
            <IconButton onClick={handleToggle} label="Hide reports list">
              <TbLayoutSidebarLeftCollapse size={20} />
            </IconButton>
          ) : null
        }
      />
      <LabeledSections sections={sections} onSelect={onSelect} />
    </aside>
  );
};

export default ReportSidebar;
