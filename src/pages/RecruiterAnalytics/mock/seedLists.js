// Name lists and reference values for the sample staffing dataset. All names
// are invented.

export const FIRST_NAMES = [
  "Avery", "Jordan", "Riley", "Casey", "Taylor", "Morgan", "Quinn", "Reese", "Hayden", "Parker",
  "Elena", "Marcus", "Priya", "Daniel", "Sofia", "Andre", "Grace", "Victor", "Nadia", "Owen",
  "Leah", "Tomas", "Imani", "Caleb", "Mei", "Rafael", "Hannah", "Isaac", "Zara", "Lucas",
  "Maya", "Ethan", "Aisha", "Noah", "Clara", "Diego", "Ruby", "Samir", "Ivy", "Felix",
];

export const LAST_NAMES = [
  "Bennett", "Okafor", "Lindqvist", "Ramirez", "Chen", "Patel", "Novak", "Sullivan", "Moreau", "Kim",
  "Alvarez", "Brooks", "Haddad", "Ivanova", "Nakamura", "O'Neill", "Fischer", "Mensah", "Costa", "Walsh",
  "Duarte", "Kowalski", "Reyes", "Lambert", "Osei", "Varga", "Holt", "Sato", "Delgado", "Byrne",
  "Ferreira", "Quinlan", "Andersen", "Tanaka", "Murphy", "Rossi", "Grant", "Iqbal", "Pryce", "Vance",
];

export const COMPANY_STEMS = [
  "Northwind", "Bluepeak", "Harborview", "Ironwood", "Silverline", "Crestmark", "Redfield", "Lakeshore",
  "Summit", "Granite", "Evergreen", "Brightwater", "Oakridge", "Riverbend", "Stonegate", "Westbrook",
  "Clearview", "Pinecrest", "Highland", "Meridian", "Beacon", "Fairmont", "Keystone", "Pioneer",
  "Coastal", "Sterling", "Maple", "Horizon", "Cobalt", "Juniper", "Ashford", "Lumen",
];

export const COMPANY_SUFFIXES_BY_VERTICAL = {
  IT: ["Systems", "Software", "Digital", "Data Labs", "Cloud", "Technologies"],
  HC: ["Health", "Medical Group", "Care Partners", "Clinics", "Hospital", "Health Network"],
  FA: ["Capital", "Financial", "Insurance", "Bancorp", "Advisors", "Credit Union"],
  ENG: ["Engineering", "Aerospace", "Energy", "Infrastructure", "Robotics", "Industries"],
  LI: ["Logistics", "Foods", "Manufacturing", "Distribution", "Packaging", "Supply"],
  ADM: ["Services", "Group", "Holdings", "Partners", "Utilities", "Realty"],
};

export const TITLES_BY_VERTICAL = {
  IT: ["Software Engineer", "Data Analyst", "DevOps Engineer", "QA Analyst", "Business Analyst", "Network Engineer"],
  HC: ["Registered Nurse", "Medical Coder", "Patient Coordinator", "Lab Technician", "Pharmacy Tech"],
  FA: ["Staff Accountant", "AP Specialist", "Financial Analyst", "Payroll Specialist", "Auditor"],
  ENG: ["Mechanical Engineer", "Electrical Engineer", "CAD Designer", "Quality Engineer", "Project Engineer"],
  LI: ["Warehouse Associate", "Forklift Operator", "Machine Operator", "Assembler", "Shipping Clerk"],
  ADM: ["Administrative Assistant", "Receptionist", "Data Entry Clerk", "Office Coordinator", "Customer Service Rep"],
};

export const COMPETITORS = ["Apex Talent", "Ridgeline Staffing", "Vector Workforce", "Northstar Resourcing", "Keel Partners", "Brightpath Staffing"];

export const LOSS_REASONS = [
  ["Rate / markup too high", 30],
  ["Filled by another agency", 25],
  ["Client went quiet", 18],
  ["Position put on hold", 14],
  ["No qualified candidates", 8],
  ["Filled internally", 5],
];

export const LEAD_SOURCES = [
  ["Referral", 30],
  ["Outbound prospecting", 28],
  ["Inbound enquiry", 17],
  ["MSP / VMS RFP", 15],
  ["Existing contact", 10],
];

export const CHURN_REASONS = ["Budget cuts", "Moved to a competitor", "Project ended", "Insourced the roles", "MSP consolidation"];

export const END_REASONS = {
  planned: "Planned completion",
  converted: "Converted to permanent",
  client_reduced: "Client reduced headcount",
  client_lost: "Client lost",
  contractor_quit: "Contractor resigned",
  client_ended: "Client ended early",
  performance: "Performance",
};

export const NEXT_ACTIONS = {
  Sourcing: "Source and screen candidates against the job order",
  Submitted: "Chase hiring-manager feedback on submittals",
  Interviewing: "Debrief candidates and the hiring manager after interviews",
  Offer: "Close the offer: confirm rate, start date and background check",
};
