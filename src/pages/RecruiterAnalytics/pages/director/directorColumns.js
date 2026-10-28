// Column groups and ranking presets for the Account Manager and Recruiter Lead screens.

const col = (key, label, unit = "money") => ({ key, label, unit });
const pctOfRatio = (key) => ({ key, label: "Expense / GP", unit: "pct", csv: (r) => (r[key] == null ? "" : Math.round(r[key] * 1000) / 10) });

export const LEADERBOARD_GROUPS = [
  { id: "identity", label: "Identity", always: true, columns: [col("name", "Recruiter", "text"), col("team", "Team", "text"), col("territory", "Territory", "text"), col("vertical", "Vertical", "text")] },
  {
    id: "staffing",
    label: "Contractors & billing",
    columns: [
      col("contractors", "Active contractors", "count"), col("starts", "Starts", "count"), col("ends", "Ends", "count"), col("contractorGrowth", "Net change", "count"),
      col("billedHours", "Billed hours", "hours"), col("billRevenue", "Bill revenue"), col("payroll", "Payroll"),
      col("avgBillRate", "Avg bill rate", "rate"), col("avgPayRate", "Avg pay rate", "rate"), col("spread", "Spread", "rate"),
    ],
  },
  {
    id: "performance",
    label: "Performance",
    columns: [
      col("revenue", "Revenue"), col("revenueTarget", "Revenue target"), col("revenueVar", "Revenue var"),
      col("gp", "GP"), col("gpTarget", "GP target"), col("gpVar", "GP var"),
      col("gmPct", "GM %", "pct"), col("gmTarget", "GM target", "pct"), col("gpAttainment", "GP attainment", "pct"), col("ytdGpAttainment", "YTD GP attainment", "pct"),
    ],
  },
  {
    id: "costs",
    label: "Costs",
    columns: [
      col("directCost", "Direct costs"), col("commission", "Commission earned"), col("commissionApproved", "Commission approved"),
      col("travel", "Travel"), col("entertainment", "Entertainment"), col("salary", "Allocated recruiting cost"),
      col("salesCostOverrun", "Recruiting cost vs budget"), col("contribution", "Recruiting contribution"),
    ],
  },
  {
    id: "pipeline",
    label: "Pipeline",
    columns: [col("newClientsWon", "New clients won", "count"), col("largestClientWon", "Largest client won", "text"), col("weightedPipeline", "Weighted revenue pipeline"), col("weightedGpPipeline", "Weighted GP pipeline"), col("winRate", "Fill rate", "pct"), col("agingOpportunities", "Aging job orders", "count")],
  },
  {
    id: "forecast",
    label: "Forecast",
    columns: [col("priorQuarterRevenue", "Prior-quarter revenue"), col("priorQuarterGp", "Prior-quarter GP"), col("quarterForecastRevenue", "Quarter forecast revenue"), col("quarterForecastGp", "Quarter forecast GP"), col("qoqGrowth", "QoQ growth", "pct"), col("forecastStatus", "Submission", "text")],
  },
];

export const LEADERBOARD_PRESETS = [
  { id: "gp", label: "Highest GP $", key: "gp", dir: "desc" },
  { id: "attainment", label: "Highest GP target attainment", key: "gpAttainment", dir: "desc" },
  { id: "ytd-over", label: "YTD over budget (revenue & GP)", key: "ytdGpOverBudget", dir: "desc", filter: (r) => r.ytdOverBudget },
  { id: "new-clients", label: "Most new clients", key: "newClientsWon", dir: "desc" },
  { id: "largest-won", label: "Largest client won", key: "largestClientWonValue", dir: "desc", filter: (r) => r.largestClientWonValue > 0 },
  { id: "contribution", label: "Highest recruiting contribution", key: "contribution", dir: "desc" },
  { id: "overrun", label: "Largest recruiting cost overrun", key: "salesCostOverrun", dir: "desc" },
  { id: "bill-revenue", label: "Highest bill revenue", key: "billRevenue", dir: "desc" },
  { id: "contractors", label: "Most active contractors", key: "contractors", dir: "desc" },
  { id: "bill-rate", label: "Highest bill rate", key: "avgBillRate", dir: "desc" },
  { id: "growth", label: "Contractor growth", key: "contractorGrowth", dir: "desc" },
];

export const DIRECTOR_TABLES = [
  {
    id: "clientPerformance",
    label: "Client performance",
    description: "Clients your team's recruiters work. Contribution deducts commission at plan rate and any acquisition cost tied to the client. Select a client for assignments and months.",
    rowKey: "clientId",
    rowOpens: "client",
    defaultSort: { key: "gp", dir: "desc" },
    groups: [
      { id: "client", label: "Client", always: true, columns: [col("client", "Client", "text"), col("owner", "Recruiters (GP share)", "text")] },
      { id: "financial", label: "Revenue & GP", columns: [col("revenue", "Bill revenue"), col("gp", "GP"), col("gmPct", "GM", "pct"), col("gpBudgetVar", "GP vs budget")] },
      { id: "staffing", label: "Staffing", columns: [col("contractors", "Avg contractors", "count"), col("avgBillRate", "Bill rate", "rate"), col("avgPayRate", "Pay rate", "rate")] },
      { id: "costs", label: "Payroll & costs", columns: [col("payroll", "Payroll (wages)"), col("burden", "Payroll burden"), col("directCost", "Direct costs"), col("contribution", "Contribution")] },
    ],
  },
  {
    id: "newClientWins",
    label: "New client wins",
    description: "New clients won in the period. A client win, the first filled requisition, the placement and the first billable start are separate events.",
    rowKey: "id",
    rowOpens: "client",
    defaultSort: { key: "expectedGp", dir: "desc" },
    emptyLabel: "No new clients won in this period.",
    groups: [
      { id: "win", label: "Win", always: true, columns: [col("name", "Client", "text"), col("owner", "Recruiter", "text"), col("winDate", "Win date", "date")] },
      { id: "billing", label: "Billing", columns: [col("expectedFirstBilling", "Expected first billing", "date"), col("firstBilledMonth", "First billed", "text")] },
      { id: "economics", label: "Economics", columns: [col("headcount", "Projected contractors", "count"), col("billRate", "Bill rate", "rate"), col("payRate", "Pay rate", "rate"), col("expectedRevenue", "Expected revenue"), col("expectedGp", "Expected GP"), col("leadSource", "Pipeline source", "text")] },
    ],
  },
  {
    id: "repExpenses",
    label: "Recruiter expense analysis",
    description: "Recruiting expense by recruiter. Select a recruiter for the transactions behind each category.",
    rowKey: "repId",
    rowOpens: "rep",
    defaultSort: { key: "salesExpense", dir: "desc" },
    groups: [
      { id: "rep", label: "Recruiter", always: true, columns: [col("name", "Recruiter", "text"), col("team", "Team", "text")] },
      { id: "expense", label: "Expense", columns: [col("commission", "Commissions"), col("travel", "Travel"), col("entertainment", "Entertainment"), col("acquisition", "Acquisition"), col("salary", "Salary allocation"), col("salesExpense", "Total recruiting expense")] },
      { id: "efficiency", label: "Efficiency", columns: [{ ...pctOfRatio("expensePerGp"), render: (r) => (r.expensePerGp == null ? "—" : `${(r.expensePerGp * 100).toFixed(1)}%`) }, col("gp", "GP"), col("contribution", "Contribution")] },
    ],
  },
  {
    id: "pipelineSlippage",
    label: "Pipeline slippage",
    description: "Open job orders whose expected fill date has moved.",
    rowKey: "id",
    defaultSort: { key: "weightedGp", dir: "desc" },
    emptyLabel: "No open job orders have slipped.",
    groups: [
      { id: "deal", label: "Job order", always: true, columns: [col("name", "Client / prospect", "text"), col("id", "Job order", "text"), col("owner", "Recruiter", "text"), col("stage", "Stage", "text")] },
      { id: "timing", label: "Timing", columns: [col("daysInStage", "Days in stage", "count"), col("originalCloseDate", "Original fill date", "date"), col("closeDate", "Revised fill date", "date"), col("pushes", "Pushes", "count")] },
      { id: "value", label: "Value & action", columns: [col("weightedGp", "Weighted GP"), col("nextAction", "Next action", "text")] },
    ],
  },
  {
    id: "staffingRateCost",
    label: "Staffing rate & cost",
    description: "Hours, hours-weighted rates and direct costs by client.",
    rowKey: "clientId",
    rowOpens: "client",
    defaultSort: { key: "billedHours", dir: "desc" },
    groups: [
      { id: "client", label: "Client", always: true, columns: [col("client", "Client", "text"), col("owner", "Recruiters (GP share)", "text")] },
      { id: "rates", label: "Hours & rates", columns: [col("billedHours", "Billed hours", "hours"), col("avgBillRate", "Avg bill rate", "rate"), col("avgPayRate", "Avg pay rate", "rate")] },
      { id: "costs", label: "Costs & GP", columns: [col("payroll", "Payroll (wages)"), col("burden", "Payroll burden"), col("otherDirect", "Other direct costs"), col("gp", "GP"), col("gmPct", "GM", "pct")] },
    ],
  },
  {
    id: "teamForecast",
    label: "Team forecast",
    description: "Current quarter by recruiter on a system run-rate. Submissions, confirmation and Send to Forecasting arrive with the forecasting phase.",
    rowKey: "repId",
    rowOpens: "rep",
    defaultSort: { key: "quarterForecastRevenue", dir: "desc" },
    groups: [
      { id: "rep", label: "Recruiter", always: true, columns: [col("name", "Recruiter", "text"), col("team", "Team", "text")] },
      { id: "quarter", label: "Quarter", columns: [col("priorQuarterRevenue", "Prior-quarter revenue"), col("priorQuarterGp", "Prior-quarter GP"), col("quarterActualRevenue", "Actual to date"), col("quarterRemainingRevenue", "Remaining (run-rate)"), col("quarterForecastRevenue", "Full quarter"), col("quarterForecastGp", "Full-quarter GP")] },
      { id: "vs", label: "Comparison", columns: [col("qoqGrowth", "QoQ", "pct"), col("quarterVsTarget", "vs target"), col("forecastStatus", "Status", "text")] },
    ],
  },
];

/** Lead teams in an Account Manager's book, rolled up from the recruiter leaderboard. */
export const LEAD_TEAM_GROUPS = [
  { id: "identity", label: "Team", always: true, columns: [col("team", "Lead team", "text"), col("lead", "Recruiter lead", "text"), col("accountManager", "Account manager", "text"), col("recruiters", "Recruiters", "count")] },
  {
    id: "staffing",
    label: "Contractors & billing",
    columns: [
      col("contractors", "Active contractors", "count"), col("contractorGrowth", "Net change", "count"), col("billedHours", "Billed hours", "hours"),
      col("billRevenue", "Bill revenue"), col("payroll", "Payroll"), col("avgBillRate", "Avg bill rate", "rate"), col("avgPayRate", "Avg pay rate", "rate"), col("spread", "Spread", "rate"),
    ],
  },
  {
    id: "performance",
    label: "Performance",
    columns: [col("revenue", "Revenue"), col("gp", "GP"), col("gmPct", "GM %", "pct"), col("gpTarget", "GP target"), col("gpVar", "GP var"), col("gpAttainment", "GP attainment", "pct")],
  },
  { id: "costs", label: "Costs", columns: [col("directCost", "Direct costs"), col("commission", "Commission earned"), col("salesExpense", "Recruiting expense"), col("contribution", "Recruiting contribution")] },
];
