// Sample data for the demo connection flow. Nothing here comes from a real
// QuickBooks account. Company and customer names are swapped for the logged-in
// organization and its real customers when available (see useDemoCompanyData).

export const QB_DEMO_USER = "finance.admin@acme-demo.com";

// Fallback companies when the logged-in organization isn't known.
export const QB_COMPANIES = [
  { id: "acme-us", name: "Acme Corporation", country: "United States", currency: "USD", realmId: "9130 3574 6812 0451" },
  { id: "acme-apac", name: "Acme APAC Pty Ltd", country: "Australia", currency: "AUD", realmId: "9130 3574 6812 0877" },
  { id: "acme-uk", name: "Acme Holdings Ltd", country: "United Kingdom", currency: "GBP", realmId: "9130 3574 6812 1203" },
];

// Stand-ins used when the customer list from the customer-profitability data isn't available.
const FALLBACK_CUSTOMERS = ["Globex Ltd", "Initech Inc", "Umbrella Health", "Stark Industries", "Wayne Enterprises", "Hooli"];

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16) || "customer";

// Column flags: money -> formatted in the connection's currency, status -> pill.
export const buildQbDatasets = (customerNames = []) => {
  const names = customerNames.length ? customerNames.slice(0, 6) : FALLBACK_CUSTOMERS;
  const customer = (i) => names[i % names.length];

  return [
    {
      id: "accounts",
      name: "Chart of Accounts",
      records: 86,
      columns: [
        { key: "number", label: "Account #" },
        { key: "name", label: "Account name" },
        { key: "type", label: "Type" },
        { key: "balance", label: "Balance", money: true },
      ],
      rows: [
        { number: "1000", name: "Checking - Operating", type: "Bank", balance: 245310.55 },
        { number: "1010", name: "Savings - Reserve", type: "Bank", balance: 500000 },
        { number: "1200", name: "Accounts Receivable", type: "Accounts receivable", balance: 182450 },
        { number: "1500", name: "Computer Equipment", type: "Fixed assets", balance: 64200 },
        { number: "2000", name: "Accounts Payable", type: "Accounts payable", balance: -73915.2 },
        { number: "2100", name: "Amex Corporate Card", type: "Credit card", balance: -12480.6 },
        { number: "4000", name: "Subscription Revenue", type: "Income", balance: 1284500 },
        { number: "4100", name: "Professional Services", type: "Income", balance: 236750 },
        { number: "5000", name: "Hosting & Infrastructure", type: "Cost of goods sold", balance: 198340 },
        { number: "6000", name: "Salaries & Wages", type: "Expense", balance: 742100 },
      ],
    },
    {
      id: "general-ledger",
      name: "General Ledger",
      records: 12480,
      columns: [
        { key: "date", label: "Date" },
        { key: "account", label: "Account" },
        { key: "memo", label: "Memo" },
        { key: "debit", label: "Debit", money: true },
        { key: "credit", label: "Credit", money: true },
      ],
      rows: [
        { date: "2026-08-31", account: "6000 Salaries & Wages", memo: "August payroll", debit: 61840, credit: 0 },
        { date: "2026-08-31", account: "1000 Checking - Operating", memo: "August payroll", debit: 0, credit: 61840 },
        { date: "2026-08-28", account: "1200 Accounts Receivable", memo: `INV-1346 ${customer(0)}`, debit: 18500, credit: 0 },
        { date: "2026-08-28", account: "4000 Subscription Revenue", memo: `INV-1346 ${customer(0)}`, debit: 0, credit: 18500 },
        { date: "2026-08-25", account: "5000 Hosting & Infrastructure", memo: "AWS - August", debit: 16420.35, credit: 0 },
        { date: "2026-08-25", account: "2100 Amex Corporate Card", memo: "AWS - August", debit: 0, credit: 16420.35 },
      ],
    },
    {
      id: "profit-loss",
      name: "Profit & Loss (monthly)",
      records: 24,
      columns: [
        { key: "month", label: "Month" },
        { key: "revenue", label: "Revenue", money: true },
        { key: "cogs", label: "COGS", money: true },
        { key: "grossProfit", label: "Gross profit", money: true },
        { key: "opex", label: "Operating expenses", money: true },
        { key: "netIncome", label: "Net income", money: true },
      ],
      rows: [
        { month: "Mar 2026", revenue: 118400, cogs: 17650, grossProfit: 100750, opex: 81200, netIncome: 19550 },
        { month: "Apr 2026", revenue: 121900, cogs: 18020, grossProfit: 103880, opex: 82950, netIncome: 20930 },
        { month: "May 2026", revenue: 126300, cogs: 18410, grossProfit: 107890, opex: 84100, netIncome: 23790 },
        { month: "Jun 2026", revenue: 129750, cogs: 18990, grossProfit: 110760, opex: 86400, netIncome: 24360 },
        { month: "Jul 2026", revenue: 133200, cogs: 19320, grossProfit: 113880, opex: 88150, netIncome: 25730 },
        { month: "Aug 2026", revenue: 137850, cogs: 19870, grossProfit: 117980, opex: 90300, netIncome: 27680 },
      ],
    },
    {
      id: "balance-sheet",
      name: "Balance Sheet (monthly)",
      records: 24,
      columns: [
        { key: "date", label: "As of" },
        { key: "cash", label: "Cash", money: true },
        { key: "assets", label: "Total assets", money: true },
        { key: "liabilities", label: "Total liabilities", money: true },
        { key: "equity", label: "Equity", money: true },
      ],
      rows: [
        { date: "2026-05-31", cash: 668200, assets: 1012400, liabilities: 214300, equity: 798100 },
        { date: "2026-06-30", cash: 689450, assets: 1038900, liabilities: 216750, equity: 822150 },
        { date: "2026-07-31", cash: 712300, assets: 1066200, liabilities: 218400, equity: 847800 },
        { date: "2026-08-31", cash: 745310, assets: 1096650, liabilities: 221170, equity: 875480 },
      ],
    },
    {
      id: "invoices",
      name: "Invoices",
      records: 1346,
      columns: [
        { key: "number", label: "Invoice #" },
        { key: "customer", label: "Customer" },
        { key: "date", label: "Date" },
        { key: "due", label: "Due" },
        { key: "amount", label: "Amount", money: true },
        { key: "status", label: "Status", status: true },
      ],
      rows: [
        { number: "INV-1346", customer: customer(0), date: "2026-08-28", due: "2026-09-27", amount: 18500, status: "Open" },
        { number: "INV-1345", customer: customer(1), date: "2026-08-26", due: "2026-09-25", amount: 7250, status: "Open" },
        { number: "INV-1344", customer: customer(2), date: "2026-08-20", due: "2026-09-04", amount: 12900, status: "Overdue" },
        { number: "INV-1343", customer: customer(3), date: "2026-08-18", due: "2026-09-17", amount: 42000, status: "Paid" },
        { number: "INV-1342", customer: customer(4), date: "2026-08-15", due: "2026-09-14", amount: 26800, status: "Paid" },
        { number: "INV-1341", customer: customer(5), date: "2026-08-12", due: "2026-09-11", amount: 9600, status: "Paid" },
      ],
    },
    {
      id: "bills",
      name: "Bills",
      records: 812,
      columns: [
        { key: "number", label: "Bill #" },
        { key: "vendor", label: "Vendor" },
        { key: "date", label: "Date" },
        { key: "due", label: "Due" },
        { key: "amount", label: "Amount", money: true },
        { key: "status", label: "Status", status: true },
      ],
      rows: [
        { number: "BILL-812", vendor: "Amazon Web Services", date: "2026-08-25", due: "2026-09-24", amount: 16420.35, status: "Open" },
        { number: "BILL-811", vendor: "WeWork", date: "2026-08-01", due: "2026-08-31", amount: 8900, status: "Paid" },
        { number: "BILL-810", vendor: "Salesforce", date: "2026-07-30", due: "2026-08-29", amount: 4380, status: "Paid" },
        { number: "BILL-809", vendor: "Deloitte", date: "2026-07-22", due: "2026-08-21", amount: 15000, status: "Overdue" },
        { number: "BILL-808", vendor: "Google Workspace", date: "2026-07-20", due: "2026-08-19", amount: 1260, status: "Paid" },
      ],
    },
    {
      id: "customers",
      name: "Customers",
      records: 214,
      columns: [
        { key: "name", label: "Customer" },
        { key: "email", label: "Billing email" },
        { key: "balance", label: "Open balance", money: true },
        { key: "since", label: "Customer since" },
      ],
      rows: names.slice(0, 5).map((name, i) => ({
        name,
        email: `billing@${slug(name)}.example`,
        balance: [18500, 7250, 12900, 0, 0][i],
        since: ["2023-02-14", "2024-06-03", "2022-11-21", "2021-09-08", "2022-01-17"][i],
      })),
    },
    {
      id: "vendors",
      name: "Vendors",
      records: 138,
      columns: [
        { key: "name", label: "Vendor" },
        { key: "category", label: "Category" },
        { key: "balance", label: "Open balance", money: true },
        { key: "terms", label: "Terms" },
      ],
      rows: [
        { name: "Amazon Web Services", category: "Hosting", balance: 16420.35, terms: "Net 30" },
        { name: "WeWork", category: "Rent", balance: 0, terms: "Net 30" },
        { name: "Deloitte", category: "Professional fees", balance: 15000, terms: "Net 30" },
        { name: "Salesforce", category: "Software", balance: 0, terms: "Net 30" },
        { name: "Google Workspace", category: "Software", balance: 0, terms: "Due on receipt" },
      ],
    },
    {
      id: "journal-entries",
      name: "Journal Entries",
      records: 642,
      columns: [
        { key: "number", label: "Entry #" },
        { key: "date", label: "Date" },
        { key: "memo", label: "Memo" },
        { key: "amount", label: "Amount", money: true },
        { key: "createdBy", label: "Created by" },
      ],
      rows: [
        { number: "JE-642", date: "2026-08-31", memo: "Accrue August commissions", amount: 14250, createdBy: "R. Mehta" },
        { number: "JE-641", date: "2026-08-31", memo: "Depreciation - August", amount: 3120, createdBy: "R. Mehta" },
        { number: "JE-640", date: "2026-08-31", memo: "Prepaid insurance amortisation", amount: 950, createdBy: "S. Kapoor" },
        { number: "JE-639", date: "2026-08-15", memo: "Reclass marketing spend", amount: 4800, createdBy: "S. Kapoor" },
      ],
    },
  ];
};

// Dataset names and record counts (used by the wizard's import list and sync animation).
export const QB_DATASETS = buildQbDatasets();

const GENERIC_DATASETS = {
  accounting: ["Chart of Accounts", "General Ledger", "Invoices", "Bills"],
  crm: ["Accounts", "Opportunities", "Contacts"],
  spreadsheets: ["Workbook sheets"],
  hris: ["Employees", "Departments", "Compensation"],
  billing: ["Subscriptions", "Invoices", "Payments"],
  databases: ["Tables", "Views"],
  bi: ["Dashboards", "Reports"],
  csm: ["Account health", "Renewals"],
  others: ["Channels"],
  ticketing: ["Tickets", "Projects"],
  currency: ["Daily FX rates"],
};

const hash = (s) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

// QuickBooks has full sample datasets with preview rows; other integrations get
// a plausible dataset list (no preview rows) based on their category.
export const datasetsFor = (integration, customerNames = []) =>
  integration.id === "quickbooks"
    ? buildQbDatasets(customerNames)
    : (GENERIC_DATASETS[integration.category] || ["Records"]).map((name) => ({
        id: name,
        name,
        records: 50 + (hash(integration.id + name) % 4000),
      }));
