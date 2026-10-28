// Column groups, ranking presets and row-drill targets for the Recruiting
// Health tables (spec 11.3). `opens` says what a row drills into in place:
// "opportunity", "client", "rep" or "stage".

const col = (key, label, unit = "money") => ({ key, label, unit });
const one = (columns) => [{ id: "all", label: "All", always: true, columns }];

export const PIPELINE_TABLE = {
  rowKey: "id",
  opens: "opportunity",
  defaultSort: { key: "weightedGp", dir: "desc" },
  defaultGroups: ["profile", "value", "timing", "action"],
  groups: [
    { id: "deal", label: "Job order", always: true, columns: [col("client", "Client / prospect", "text"), col("owner", "Recruiter", "text"), col("stage", "Stage", "text")] },
    { id: "profile", label: "Profile", columns: [col("type", "Type", "text"), col("vertical", "Vertical", "text"), col("serviceType", "Service type", "text"), col("region", "Territory", "text")] },
    { id: "value", label: "Value", columns: [col("expectedRevenue", "Expected revenue"), col("expectedGp", "Expected GP"), col("probability", "Probability", "pct"), col("weightedGp", "Weighted GP")] },
    { id: "timing", label: "Timing", columns: [col("expectedStart", "Expected start", "date"), col("expectedFirstBilling", "Expected first billing", "date"), col("daysInStage", "Days in stage", "days"), col("closeDateChanges", "Fill-date changes", "count"), col("closeDate", "Expected fill date", "date")] },
    { id: "action", label: "Next action", columns: [col("nextAction", "Next action", "text")] },
  ],
  presets: [
    { id: "weighted", label: "Highest weighted GP", key: "weightedGp", dir: "desc" },
    { id: "stuck", label: "Stuck beyond stage threshold", key: "daysOverThreshold", dir: "desc", filter: (r) => r.stale },
    { id: "slipped", label: "Fill date moved", key: "closeDateChanges", dir: "desc", filter: (r) => r.closeDateChanges > 0 },
    { id: "closing", label: "Soonest expected fill", key: "closeDate", dir: "asc" },
  ],
};

const pipelineGroupColumns = (label) => [
  col("name", label, "text"), col("count", "Open job orders", "count"), col("expectedRevenue", "Expected revenue"), col("expectedGp", "Expected GP"),
  col("weightedRevenue", "Weighted revenue"), col("weightedGp", "Weighted GP"), col("stale", "Stuck", "count"), col("slipped", "Slipped", "count"), col("avgDaysInStage", "Avg days in stage", "days"),
];
export const PIPELINE_BY_OWNER = { rowKey: "key", opens: "rep", defaultSort: { key: "weightedGp", dir: "desc" }, groups: one([...pipelineGroupColumns("Recruiter").slice(0, 1), col("team", "Team", "text"), ...pipelineGroupColumns("Recruiter").slice(1)]) };
export const PIPELINE_BY_VERTICAL = { rowKey: "key", defaultSort: { key: "weightedGp", dir: "desc" }, groups: one(pipelineGroupColumns("Vertical")) };
export const PIPELINE_BY_REGION = { rowKey: "key", defaultSort: { key: "weightedGp", dir: "desc" }, groups: one(pipelineGroupColumns("Territory")) };

export const FUNNEL_COLUMNS = [
  col("stage", "Stage", "text"), col("opening", "In stage at window start", "count"), col("entered", "Entered", "count"), col("advanced", "Advanced", "count"),
  col("won", "Eventually filled", "count"), col("lost", "Lost at stage", "count"), col("open", "Still in stage", "count"), col("conversion", "Conversion", "pct"),
  col("avgStageDays", "Avg stage duration", "days"), col("expectedGp", "Expected GP"),
];
export const FUNNEL_TYPE_COLUMNS = FUNNEL_COLUMNS.filter((c) => c.key !== "opening");

const conversionColumns = [
  col("entered", "Stage entries", "count"), col("advanced", "Advanced", "count"), col("lost", "Lost", "count"), col("open", "Still in stage", "count"),
  col("conversion", "Conversion", "pct"), col("cohortWinRate", "Sourcing → filled", "pct"), col("weakestStage", "Weakest stage", "text"), col("avgStageDays", "Avg stage days", "days"), col("expectedGp", "Expected GP"),
];
export const CONVERSION_BY_REP = { rowKey: "key", opens: "rep", defaultSort: { key: "conversion", dir: "desc" }, groups: one([col("name", "Recruiter", "text"), col("team", "Team", "text"), ...conversionColumns]) };
export const CONVERSION_BY_VERTICAL = { rowKey: "key", defaultSort: { key: "entered", dir: "desc" }, groups: one([col("name", "Vertical", "text"), ...conversionColumns]) };

export const REQUISITIONS_TABLE = {
  rowKey: "clientId",
  opens: "client",
  defaultSort: { key: "eligible", dir: "desc" },
  groups: one([
    col("client", "Client", "text"), col("location", "Location", "text"), col("vertical", "Vertical", "text"), col("eligible", "Opened", "count"), col("filled", "Filled", "count"),
    col("cancelled", "Cancelled", "count"), col("open", "Still open", "count"), col("fillRate", "Fill rate", "pct"), col("avgDaysToFill", "Days to fill", "days"), col("avgFillToBilling", "Fill to first billing", "days"),
  ]),
};

export const WINLOSS_TABLE = {
  rowKey: "id",
  opens: "opportunity",
  defaultSort: { key: "decisionDate", dir: "desc" },
  defaultGroups: ["decision", "value"],
  groups: [
    { id: "deal", label: "Job order", always: true, columns: [col("client", "Client / prospect", "text"), col("id", "Job order", "text"), col("owner", "Recruiter", "text")] },
    { id: "decision", label: "Decision", columns: [col("dealType", "Type", "text"), col("decisionDate", "Decision date", "date"), col("outcome", "Filled / lost", "text"), col("reason", "Reason", "text"), col("competitor", "Competitor", "text")] },
    { id: "value", label: "Value", columns: [col("expectedGp", "Expected GP"), col("cycleDays", "Cycle", "days"), col("sizeBand", "Job-order size", "text"), col("leadSource", "Lead source", "text")] },
  ],
  presets: [
    { id: "lost-gp", label: "Largest losses", key: "expectedGp", dir: "desc", filter: (r) => r.status === "lost" },
    { id: "avoidable", label: "Avoidable losses", key: "expectedGp", dir: "desc", filter: (r) => r.avoidable },
    { id: "wins", label: "Largest fills", key: "expectedGp", dir: "desc", filter: (r) => r.status === "won" },
    { id: "cycle", label: "Longest cycle", key: "cycleDays", dir: "desc" },
  ],
};

const winLossGroupColumns = (label) => [
  col("name", label, "text"), col("closed", "Decided", "count"), col("won", "Filled", "count"), col("lost", "Lost", "count"), col("winRate", "Fill rate", "pct"),
  col("wonGp", "Expected GP filled"), col("lostGp", "Expected GP lost"), col("avoidable", "Avoidable losses", "count"), col("avgCycleDays", "Avg cycle", "days"),
];
export const WINLOSS_BY_REASON = { rowKey: "key", defaultSort: { key: "lost", dir: "desc" }, groups: one([col("reason", "Loss reason", "text"), col("avoidableReason", "Avoidable", "text"), col("lost", "Job orders lost", "count"), col("lostGp", "Expected GP lost"), col("avgCycleDays", "Avg cycle", "days")]) };
export const WINLOSS_BY_REP = { rowKey: "key", opens: "rep", defaultSort: { key: "closed", dir: "desc" }, groups: one([...winLossGroupColumns("Recruiter").slice(0, 1), col("team", "Team", "text"), ...winLossGroupColumns("Recruiter").slice(1)]) };
export const WINLOSS_BY_COMPETITOR = { rowKey: "key", defaultSort: { key: "lost", dir: "desc" }, groups: one([col("competitor", "Competitor", "text"), col("lost", "Job orders lost", "count"), col("lostGp", "Expected GP lost"), col("avgCycleDays", "Avg cycle", "days")]) };
export const WINLOSS_BY_VERTICAL = { rowKey: "key", defaultSort: { key: "closed", dir: "desc" }, groups: one(winLossGroupColumns("Vertical")) };
export const WINLOSS_BY_SIZE = { rowKey: "key", groups: one(winLossGroupColumns("Job-order size (expected GP)")) };

export const churnTable = (baseLabel) => ({
  rowKey: "clientId",
  opens: "client",
  defaultSort: { key: "lostGp", dir: "desc" },
  defaultGroups: ["financial", "drivers", "risk"],
  groups: [
    { id: "client", label: "Client", always: true, columns: [col("client", "Client", "text"), col("owner", "Recruiters", "text"), col("status", "Status", "text")] },
    { id: "financial", label: "Revenue & GP", columns: [col("baseRevenue", `Revenue · ${baseLabel}`), col("revenue", "Revenue now"), col("baseGp", `GP · ${baseLabel}`), col("gp", "GP now"), col("lostGp", "Lost GP")] },
    { id: "drivers", label: "Drivers", columns: [col("contractorsNow", "On billing", "count"), col("contractorStarts", "Starts", "count"), col("contractorEnds", "Contractor ends", "count"), col("plannedEnds", "Planned ends", "count"), col("churnReason", "Churn / end reason", "text")] },
    { id: "risk", label: "Risk", columns: [col("atRisk", "At risk (est.)", "text"), col("riskFlags", "Signals", "text"), col("gpLast3Months", "GP last 3 months"), col("nextAssignmentEnd", "Next assignment end", "date")] },
  ],
  presets: [
    { id: "lost-gp", label: "Most GP lost", key: "lostGp", dir: "desc", filter: (r) => r.lostGp > 0 },
    { id: "risk", label: "At risk (estimated)", key: "riskCount", dir: "desc", filter: (r) => r.riskCount > 0 },
    { id: "lost", label: "Lost clients", key: "baseGp", dir: "desc", filter: (r) => r.status === "Lost" },
    { id: "growing", label: "Growing clients", key: "revenueChange", dir: "desc", filter: (r) => r.revenueChange > 0 },
  ],
});

export const AT_RISK_TABLE = {
  rowKey: "clientId",
  opens: "client",
  defaultSort: { key: "riskCount", dir: "desc" },
  groups: one([
    col("client", "Client", "text"), col("owner", "Recruiters", "text"), col("atRisk", "Risk (est.)", "text"), col("riskFlags", "Signals", "text"), col("gpLast3Months", "GP last 3 months"),
    col("gpPrior3Months", "GP prior 3 months"), col("contractorsNow", "On billing", "count"), col("expiringAssignments", "Ending in 60 days", "count"), col("nextAssignmentEnd", "Next assignment end", "date"),
  ]),
};

export const MOVEMENT_TABLE = {
  rowKey: "clientId",
  opens: "client",
  defaultSort: { key: "ends", dir: "desc" },
  defaultGroups: ["counts", "effect"],
  groups: [
    { id: "client", label: "Client", always: true, columns: [col("client", "Client", "text"), col("owner", "Recruiters", "text")] },
    { id: "counts", label: "Movement", columns: [col("opening", "Opening billable", "count"), col("starts", "Starts", "count"), col("ends", "Ends", "count"), col("redeployed", "Redeployments", "count"), col("closing", "Closing billable", "count"), col("netChange", "Net change", "count")] },
    { id: "ends", label: "End types", columns: [col("planned", "Planned", "count"), col("early", "Early terminations", "count"), col("conversion", "Converted", "count"), col("clientDriven", "Client-driven", "count")] },
    { id: "effect", label: "Hours & GP effect", columns: [col("billedHours", "Billed hours", "hours"), col("revenue", "Revenue"), col("gp", "GP"), col("gpFromStarts", "GP from starts"), col("endedMonthlyGp", "Monthly GP of ends (est.)")] },
  ],
  presets: [
    { id: "ends", label: "Most ends", key: "ends", dir: "desc" },
    { id: "decline", label: "Largest net decline", key: "netChange", dir: "asc", filter: (r) => r.netChange < 0 },
    { id: "starts", label: "Most starts", key: "starts", dir: "desc" },
    { id: "early", label: "Most early terminations", key: "early", dir: "desc", filter: (r) => r.early > 0 },
  ],
};

export const EXPIRING_TABLE = {
  rowKey: "assignmentId",
  opens: "client",
  defaultSort: { key: "plannedEndDate", dir: "asc" },
  groups: one([
    col("client", "Client", "text"), col("owner", "Recruiters", "text"), col("contractor", "Contractor", "text"), col("title", "Role", "text"), col("placementType", "Type", "text"),
    col("plannedEndDate", "Planned end", "date"), col("daysLeft", "Days left", "days"), col("extensions", "Extensions so far", "count"), col("billRate", "Bill rate", "rate"), col("monthlyGp", "Monthly GP"),
  ]),
};

export const MOVEMENT_BY_REP = {
  rowKey: "repId",
  opens: "rep",
  defaultSort: { key: "ends", dir: "desc" },
  groups: one([
    col("name", "Recruiter", "text"), col("team", "Team", "text"), col("opening", "Opening", "count"), col("starts", "Starts", "count"), col("ends", "Ends", "count"),
    col("early", "Early terminations", "count"), col("closing", "Closing", "count"), col("netChange", "Net change", "count"), col("attritionRate", "Attrition", "pct"), col("earlyRate", "Early-termination rate", "pct"),
  ]),
};

export const TIMELINE_TABLE = {
  rowKey: "id",
  opens: "opportunity",
  defaultSort: { key: "winDate", dir: "desc" },
  groups: one([
    col("client", "Client", "text"), col("owner", "Recruiter", "text"), col("createdDate", "Job order opened", "date"), col("winDate", "Job order filled", "date"), col("daysToWin", "Days to fill", "days"),
    col("firstFillDate", "First requisition fill", "date"), col("firstStartDate", "First start", "date"), col("firstBillingDate", "First billing", "date"),
    col("daysToFirstFill", "Filled → requisition fill", "days"), col("daysToFirstStart", "Filled → start", "days"), col("daysToFirstBilling", "Filled → billing", "days"),
  ]),
};

export const STAGE_AGING_COLUMNS = [
  col("stage", "Stage", "text"), col("count", "Open job orders", "count"), col("avgDaysInStage", "Avg days in stage", "days"), col("maxDaysInStage", "Longest", "days"),
  col("threshold", "Threshold", "days"), col("stale", "Over threshold", "count"), col("staleGp", "Expected GP over threshold"), col("weightedGp", "Weighted GP"),
];

export const SLIPPAGE_TABLE = {
  rowKey: "id",
  opens: "opportunity",
  defaultSort: { key: "daysMoved", dir: "desc" },
  groups: one([
    col("client", "Client / prospect", "text"), col("owner", "Recruiter", "text"), col("stage", "Stage", "text"), col("originalCloseDate", "Original fill date", "date"), col("closeDate", "Current fill date", "date"),
    col("closeDateChanges", "Pushes", "count"), col("daysMoved", "Days moved", "days"), col("expectedGp", "Expected GP"), col("weightedGp", "Weighted GP"), col("expectedStart", "Expected start", "date"),
  ]),
};

export const DELAYED_TABLE = {
  rowKey: "id",
  opens: "opportunity",
  defaultSort: { key: "expectedStart", dir: "asc" },
  groups: one([
    col("client", "Client / prospect", "text"), col("owner", "Recruiter", "text"), col("stage", "Stage", "text"), col("expectedStart", "Expected start", "date"),
    col("probability", "Probability", "pct"), col("weightedGp", "Weighted GP"), col("nextAction", "Next action", "text"),
  ]),
};

export const VELOCITY_BY_REP = {
  rowKey: "repId",
  opens: "rep",
  defaultSort: { key: "stale", dir: "desc" },
  groups: one([
    col("name", "Recruiter", "text"), col("team", "Team", "text"), col("open", "Open job orders", "count"), col("avgDaysInStage", "Avg days in stage", "days"), col("stale", "Stuck", "count"),
    col("slipped", "Slipped", "count"), col("delayed", "Past expected start", "count"), col("wonDeals", "Filled in period", "count"), col("avgWonCycle", "Fill cycle", "days"),
  ]),
};

export const EFFICIENCY_BY_REP = {
  rowKey: "repId",
  opens: "rep",
  defaultSort: { key: "contribution", dir: "desc" },
  defaultGroups: ["costs", "wins"],
  groups: [
    { id: "who", label: "Recruiter", always: true, columns: [col("name", "Recruiter", "text"), col("team", "Team", "text"), col("gp", "GP"), col("salesExpense", "Recruiting expense"), col("costToGp", "Cost-to-GP", "pct"), col("contribution", "GP after recruiting expense")] },
    { id: "costs", label: "Cost detail", columns: [col("commission", "Commission"), col("travel", "Travel"), col("entertainment", "Entertainment"), col("acquisition", "Acquisition"), col("salary", "Salary allocation")] },
    { id: "wins", label: "Fills", columns: [col("wins", "Job orders filled", "count"), col("costPerWin", "Cost per fill")] },
  ],
};

export const EFFICIENCY_MONTHLY = {
  rowKey: "ym",
  defaultSort: null,
  groups: one([
    col("label", "Month", "text"), col("gp", "GP"), col("commission", "Commission"), col("travel", "Travel"), col("entertainment", "Entertainment"),
    col("acquisition", "Acquisition"), col("salary", "Salary allocation"), col("salesExpense", "Recruiting expense"), col("contribution", "GP after recruiting expense"),
  ]),
};
