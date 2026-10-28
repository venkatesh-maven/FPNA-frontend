// Reports configuration
export const reports = [
  {
    id: "pnl",
    title: "Profit & Loss Statement",
    desc: "Summarizes revenues, costs, and expenses over a specific period",
    route: "/p&l-Dashboard",
  },
  // ... all other report definitions
];

// Comprehensive Sample Data for all reports
export const sampleData = {
  pnl: {
    tableData: [
      // ... P&L data
    ],
    metrics: {
      // ... P&L metrics
    },
  },
  // ... all other sample data
};

// Filter options
export const timePeriods = [
  { id: "all", name: "All Periods" },
  { id: "current", name: "Current Month" },
  { id: "last", name: "Last Month" },
  { id: "qtd", name: "Quarter to Date" },
  { id: "ytd", name: "Year to Date" },
  { id: "custom", name: "Custom Range" },
];

export const entities = [
  { id: "all", name: "All Entities" },
  { id: "ny", name: "New York Branch" },
  { id: "sf", name: "San Francisco Branch" },
  { id: "tx", name: "Texas Branch" },
];

export const hierarchies = [
  { id: "group", name: "Group Level" },
  { id: "department", name: "Department Level" },
  { id: "product", name: "Product Level" },
];