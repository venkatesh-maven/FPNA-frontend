// Client table column groups for My Performance (spec 6.2).
const col = (key, label, unit = "money") => ({ key, label, unit });

export const CLIENT_GROUPS = [
  { id: "client", label: "Client", always: true, columns: [col("client", "Client", "text"), col("vertical", "Vertical", "text"), col("location", "Location", "text"), col("serviceType", "Service type", "text")] },
  { id: "financial", label: "Revenue / GP", columns: [col("revenue", "Bill revenue"), col("revenueTarget", "Revenue target"), col("revenueVar", "Revenue var"), col("payroll", "Payroll (wages)"), col("gp", "GP"), col("gpTarget", "GP target"), col("gpVar", "GP var"), col("gmPct", "GM", "pct"), col("gmTarget", "GM target", "pct")] },
  { id: "staffing", label: "Staffing drivers", columns: [col("contractors", "Active", "count"), col("contractorsTarget", "Target", "count"), col("starts", "Starts", "count"), col("ends", "Ends", "count"), col("billedHours", "Billed hrs", "hours"), col("paidHours", "Paid hrs", "hours"), col("avgBillRate", "Bill rate", "rate"), col("avgPayRate", "Pay rate", "rate")] },
  { id: "direct", label: "Direct costs", columns: [col("wages", "Wages"), col("payrollTaxes", "Payroll taxes"), col("workersComp", "Workers' comp"), col("benefits", "Benefits"), col("otherDirect", "Other direct"), col("directCost", "Total direct cost")] },
  { id: "salesCosts", label: "Recruiter costs", columns: [col("commission", "Commission earned"), col("commissionProjected", "Commission projected"), col("acquisition", "Acquisition costs"), col("clientContribution", "Client contribution")] },
  { id: "opportunity", label: "Job orders", columns: [col("openOpportunities", "Open job orders", "count"), col("weightedRevenue", "Weighted revenue"), col("weightedGp", "Weighted GP"), col("expectedStarts", "Expected starts", "count")] },
  { id: "action", label: "Action", columns: [col("fyGpGap", "FY GP gap"), col("commissionUpside", "Commission upside")] },
];
