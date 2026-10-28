// Column groups and ranking presets for the Sales Director screen (spec 5.2 / 5.3).

const col = (key, label, unit = "money") => ({ key, label, unit });
const pctOfRatio = (key) => ({ key, label: "Expense / GP", unit: "pct", csv: (r) => (r[key] == null ? "" : Math.round(r[key] * 1000) / 10) });

export const LEADERBOARD_GROUPS = [
  { id: "identity", label: "Identity", always: true, columns: [col("name", "Salesperson", "text"), col("team", "Team", "text"), col("territory", "Territory", "text"), col("vertical", "Vertical", "text")] },
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
    id: "staffing",
    label: "Staffing",
    columns: [col("contractors", "On billing", "count"), col("starts", "Starts", "count"), col("ends", "Ends", "count"), col("contractorGrowth", "Net change", "count"), col("avgBillRate", "Avg bill rate", "rate"), col("avgPayRate", "Avg pay rate", "rate"), col("billedHours", "Billed hours", "hours")],
  },
  {
    id: "costs",
    label: "Costs",
    columns: [
      col("directCost", "Direct costs"), col("commission", "Commission earned"), col("commissionApproved", "Commission approved"),
      col("travel", "Travel"), col("entertainment", "Entertainment"), col("salary", "Allocated sales cost"),
      col("salesCostOverrun", "Sales cost vs budget"), col("contribution", "Sales contribution"),
    ],
  },
  {
    id: "pipeline",
    label: "Pipeline",
    columns: [col("newClientsWon", "New clients won", "count"), col("largestClientWon", "Largest client won", "text"), col("weightedPipeline", "Weighted revenue pipeline"), col("weightedGpPipeline", "Weighted GP pipeline"), col("winRate", "Win rate", "pct"), col("agingOpportunities", "Aging deals", "count")],
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
  { id: "contribution", label: "Highest sales contribution", key: "contribution", dir: "desc" },
  { id: "overrun", label: "Largest sales cost overrun", key: "salesCostOverrun", dir: "desc" },
  { id: "bill-rate", label: "Highest bill rate", key: "avgBillRate", dir: "desc" },
  { id: "growth", label: "Contractor growth", key: "contractorGrowth", dir: "desc" },
];

export const DIRECTOR_TABLES = [
  {
    id: "clientPerformance",
    label: "Client performance",
    description: "Clients owned by your team. Contribution deducts commission at plan rate and any acquisition cost tied to the client. Select a client for assignments and months.",
    rowKey: "clientId",
    rowOpens: "client",
    defaultSort: { key: "gp", dir: "desc" },
    groups: [
      { id: "client", label: "Client", always: true, columns: [col("client", "Client", "text"), col("owner", "Owner", "text")] },
      { id: "financial", label: "Revenue & GP", columns: [col("revenue", "Revenue"), col("gp", "GP"), col("gmPct", "GM", "pct"), col("gpBudgetVar", "GP vs budget")] },
      { id: "staffing", label: "Staffing", columns: [col("contractors", "Avg contractors", "count"), col("avgBillRate", "Bill rate", "rate"), col("avgPayRate", "Pay rate", "rate")] },
      { id: "costs", label: "Costs", columns: [col("directCost", "Direct costs"), col("contribution", "Contribution")] },
    ],
  },
  {
    id: "newClientWins",
    label: "New client wins",
    description: "New logos won in the period. A client win, the first filled requisition, the placement and the first billable start are separate events.",
    rowKey: "id",
    rowOpens: "client",
    defaultSort: { key: "expectedGp", dir: "desc" },
    emptyLabel: "No new clients won in this period.",
    groups: [
      { id: "win", label: "Win", always: true, columns: [col("name", "Client", "text"), col("owner", "Rep", "text"), col("winDate", "Win date", "date")] },
      { id: "billing", label: "Billing", columns: [col("expectedFirstBilling", "Expected first billing", "date"), col("firstBilledMonth", "First billed", "text")] },
      { id: "economics", label: "Economics", columns: [col("headcount", "Projected contractors", "count"), col("billRate", "Bill rate", "rate"), col("payRate", "Pay rate", "rate"), col("expectedRevenue", "Expected revenue"), col("expectedGp", "Expected GP"), col("leadSource", "Pipeline source", "text")] },
    ],
  },
  {
    id: "repExpenses",
    label: "Rep expense analysis",
    description: "Sales expense by salesperson. Select a salesperson for the transactions behind each category.",
    rowKey: "repId",
    rowOpens: "rep",
    defaultSort: { key: "salesExpense", dir: "desc" },
    groups: [
      { id: "rep", label: "Rep", always: true, columns: [col("name", "Salesperson", "text"), col("team", "Team", "text")] },
      { id: "expense", label: "Expense", columns: [col("commission", "Commissions"), col("travel", "Travel"), col("entertainment", "Entertainment"), col("acquisition", "Acquisition"), col("salary", "Salary allocation"), col("salesExpense", "Total sales expense")] },
      { id: "efficiency", label: "Efficiency", columns: [{ ...pctOfRatio("expensePerGp"), render: (r) => (r.expensePerGp == null ? "—" : `${(r.expensePerGp * 100).toFixed(1)}%`) }, col("gp", "GP"), col("contribution", "Contribution")] },
    ],
  },
  {
    id: "pipelineSlippage",
    label: "Pipeline slippage",
    description: "Open opportunities whose close date has moved.",
    rowKey: "id",
    defaultSort: { key: "weightedGp", dir: "desc" },
    emptyLabel: "No open opportunities have slipped.",
    groups: [
      { id: "deal", label: "Deal", always: true, columns: [col("name", "Client / prospect", "text"), col("id", "Opportunity", "text"), col("owner", "Owner", "text"), col("stage", "Stage", "text")] },
      { id: "timing", label: "Timing", columns: [col("daysInStage", "Days in stage", "count"), col("originalCloseDate", "Original close", "date"), col("closeDate", "Revised close", "date"), col("pushes", "Pushes", "count")] },
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
      { id: "client", label: "Client", always: true, columns: [col("client", "Client", "text"), col("owner", "Rep", "text")] },
      { id: "rates", label: "Hours & rates", columns: [col("billedHours", "Billed hours", "hours"), col("avgBillRate", "Avg bill rate", "rate"), col("avgPayRate", "Avg pay rate", "rate")] },
      { id: "costs", label: "Costs & GP", columns: [col("burden", "Payroll burden"), col("otherDirect", "Other direct costs"), col("gp", "GP"), col("gmPct", "GM", "pct")] },
    ],
  },
  {
    id: "teamForecast",
    label: "Team forecast",
    description: "Current quarter by salesperson on a system run-rate. Submissions, confirmation and Send to Forecasting arrive with the forecasting phase.",
    rowKey: "repId",
    rowOpens: "rep",
    defaultSort: { key: "quarterForecastRevenue", dir: "desc" },
    groups: [
      { id: "rep", label: "Rep", always: true, columns: [col("name", "Salesperson", "text"), col("team", "Team", "text")] },
      { id: "quarter", label: "Quarter", columns: [col("priorQuarterRevenue", "Prior-quarter revenue"), col("priorQuarterGp", "Prior-quarter GP"), col("quarterActualRevenue", "Actual to date"), col("quarterRemainingRevenue", "Remaining (run-rate)"), col("quarterForecastRevenue", "Full quarter"), col("quarterForecastGp", "Full-quarter GP")] },
      { id: "vs", label: "Comparison", columns: [col("qoqGrowth", "QoQ", "pct"), col("quarterVsTarget", "vs target"), col("forecastStatus", "Status", "text")] },
    ],
  },
];
