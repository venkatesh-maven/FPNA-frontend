// Column groups for the Director Overview's tables: recruiters, lead teams,
// account managers (billing first, then recruiting), open job orders,
// clients and months.

const col = (key, label, unit = "money") => ({ key, label, unit });

const ACTIVITY = [col("opened", "Job orders", "count"), col("submittals", "Submittals", "count"), col("interviews", "Interviews", "count"), col("offers", "Offers", "count"), col("placements", "Placements", "count")];
const CONVERSION = [col("subToInterview", "Submittal → interview", "pct"), col("interviewToOffer", "Interview → offer", "pct"), col("offerAcceptance", "Offer acceptance", "pct"), col("fillRate", "Fill rate", "pct"), col("fallOffs", "Early ends", "count")];
const SPEED = [col("daysToSubmit", "Time to submit", "days"), col("daysToFill", "Time to fill", "days"), col("openJobOrders", "Open job orders", "count")];
const BILLING = [
  col("activeContractors", "Active contractors", "count"), col("billedHours", "Billed hours", "hours"),
  col("billRevenue", "Bill revenue"), col("payroll", "Payroll"), col("gp", "GP"), col("gmPct", "GM", "pct"),
];
const RATES = [col("avgBillRate", "Bill rate", "rate"), col("avgPayRate", "Pay rate", "rate"), col("spread", "Spread", "rate")];

const groupsFor = (identity) => [
  { id: "identity", label: "Who", always: true, columns: identity },
  { id: "billing", label: "Contractors & billing", columns: BILLING },
  { id: "rates", label: "Rates", columns: RATES },
  { id: "activity", label: "Activity", columns: ACTIVITY },
  { id: "conversion", label: "Conversion", columns: CONVERSION },
  { id: "speed", label: "Speed", columns: SPEED },
];
// Shown when a leaderboard opens; the recruiting groups are a click away.
export const DEFAULT_LEADERBOARD_GROUPS = ["identity", "billing", "rates"];

export const RECRUITER_GROUPS = groupsFor([col("name", "Recruiter", "text"), col("team", "Lead team", "text")]);
export const LEAD_TEAM_GROUPS = groupsFor([col("name", "Lead team", "text"), col("lead", "Recruiter lead", "text"), col("accountManager", "Account manager", "text"), col("recruiters", "Recruiters", "count")]);
export const MANAGER_GROUPS = groupsFor([col("name", "Account manager", "text"), col("recruiters", "Recruiters", "count")]);

export const OPEN_JOB_ORDER_COLUMNS = [
  col("client", "Client", "text"), col("recruiter", "Recruiter", "text"), col("id", "Job order", "text"), col("openedDate", "Opened", "date"), col("daysOpen", "Days open", "count"),
  col("stage", "Stage", "text"), col("submittals", "Submittals", "count"), col("interviews", "Interviews", "count"), col("offers", "Offers", "count"),
];

export const CLIENT_GROUPS = [
  { id: "client", label: "Client", always: true, columns: [col("client", "Client", "text"), col("owner", "Recruiters (GP share)", "text")] },
  { id: "financial", label: "Contractors & billing", columns: [col("contractors", "Avg contractors", "count"), col("revenue", "Bill revenue"), col("payroll", "Payroll (wages)"), col("gp", "GP"), col("gmPct", "GM", "pct")] },
  { id: "rates", label: "Rates", columns: [col("avgBillRate", "Bill rate", "rate"), col("avgPayRate", "Pay rate", "rate")] },
  { id: "recruiting", label: "Recruiting", columns: [col("opened", "Job orders", "count"), col("submittals", "Submittals", "count"), col("placements", "Placements", "count"), col("fillRate", "Fill rate", "pct"), col("daysToFill", "Time to fill", "days"), col("openJobOrders", "Open job orders", "count")] },
];

export const MONTHLY_COLUMNS = [col("label", "Month", "text"), ...ACTIVITY, col("subToInterview", "Submittal → interview", "pct"), col("fillRate", "Fill rate", "pct"), col("daysToFill", "Time to fill", "days")];
export const BILLING_MONTHLY_COLUMNS = [
  col("label", "Month", "text"), col("avgActive", "Average active contractors", "count"), col("billedHours", "Billed hours", "hours"),
  col("billRevenue", "Bill revenue"), col("payroll", "Payroll"), col("gp", "GP"), col("avgBillRate", "Bill rate", "rate"), col("avgPayRate", "Pay rate", "rate"), col("spread", "Spread", "rate"),
];
export const FUNNEL_COLUMNS = [col("stage", "Stage", "text"), col("count", "Candidates", "count"), col("ofPrevious", "Of previous stage", "pct")];
