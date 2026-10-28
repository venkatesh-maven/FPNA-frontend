import { FiFileText } from "react-icons/fi";
import { BsMicrosoft, BsMicrosoftTeams } from "react-icons/bs";
import { PiMicrosoftExcelLogo } from "react-icons/pi";
import { TbBrandOnedrive } from "react-icons/tb";
import {
  SiSage,
  SiQuickbooks,
  SiXero,
  SiSap,
  SiOdoo,
  SiOracle,
  SiZoho,
  SiSalesforce,
  SiHubspot,
  SiGooglesheets,
  SiGoogledrive,
  SiDropbox,
  SiAirtable,
  SiGusto,
  SiAdp,
  SiGreenhouse,
  SiStripe,
  SiPaypal,
  SiRazorpay,
  SiBrex,
  SiSnowflake,
  SiGooglebigquery,
  SiAmazonredshift,
  SiDatabricks,
  SiPostgresql,
  SiMysql,
  SiMongodb,
  SiAmazons3,
  SiTableau,
  SiLooker,
  SiMetabase,
  SiQlik,
  SiIntercom,
  SiSlack,
  SiGmail,
  SiShopify,
  SiZapier,
  SiGoogleanalytics,
  SiAsana,
  SiJira,
  SiZendesk,
  SiLinear,
  SiClickup,
  SiWise,
  SiRevolut,
} from "react-icons/si";

export const CATEGORIES = [
  { id: "accounting", label: "Accounting & ERP", blurb: "Sync chart of accounts, journal entries, GL balances and vendor/customer ledgers." },
  { id: "crm", label: "CRM", blurb: "Pull pipeline, bookings and customer data to drive revenue forecasts." },
  { id: "spreadsheets", label: "Spreadsheets", blurb: "Import budgets, drivers and ad-hoc data straight from your sheets and files." },
  { id: "hris", label: "HRIS & ATS", blurb: "Bring in headcount, payroll and hiring plans for workforce planning." },
  { id: "billing", label: "Billing & Invoicing", blurb: "Sync subscriptions, invoices and payments for ARR and cash forecasting." },
  { id: "databases", label: "Databases & Warehouses", blurb: "Query operational and warehouse data directly into your models." },
  { id: "bi", label: "BI", blurb: "Share FP&A outputs with your BI tools and pull in existing dashboards." },
  { id: "csm", label: "Customer Success Management", blurb: "Use health scores, renewals and churn signals in retention forecasts." },
  { id: "others", label: "Others", blurb: "Notifications, collaboration and automation tools." },
  { id: "ticketing", label: "Ticketing", blurb: "Link tasks and approvals in your ticketing tools to planning workflows." },
  { id: "currency", label: "Currency Exchange Provider", blurb: "Keep FX rates up to date for multi-currency consolidation." },
];

// icon: a react-icons component (brand logo). Items without an available logo
// render as a coloured monogram tile using `color`.
// demo: has a guided demo connection flow (see QuickBooksConnectWizard).
export const INTEGRATIONS = [
  // Accounting & ERP
  { id: "netsuite", name: "NetSuite", category: "accounting", color: "#1B3A57" },
  { id: "sage-intacct", name: "Sage Intacct", category: "accounting", icon: SiSage, color: "#00A94F" },
  { id: "quickbooks", name: "QuickBooks", category: "accounting", icon: SiQuickbooks, color: "#2CA01C", demo: true },
  { id: "rillet", name: "Rillet", category: "accounting", color: "#1E1B4B", premium: true },
  { id: "xero", name: "Xero", category: "accounting", icon: SiXero, color: "#13B5EA" },
  { id: "ms-business-central", name: "Microsoft Dynamics 365 Business Central", category: "accounting", icon: BsMicrosoft, color: "#0078D4" },
  { id: "sap", name: "SAP", category: "accounting", icon: SiSap, color: "#0FAAFF", premium: true },
  { id: "campfire", name: "Campfire", category: "accounting", color: "#27272A", premium: true },
  { id: "odoo", name: "Odoo", category: "accounting", icon: SiOdoo, color: "#714B67" },
  { id: "oracle-fusion", name: "Oracle Fusion", category: "accounting", icon: SiOracle, color: "#F80000", premium: true },
  { id: "zoho-books", name: "Zoho Books", category: "accounting", icon: SiZoho, color: "#E42527" },
  { id: "tally", name: "Tally Prime", category: "accounting", color: "#1F4E9C" },

  // CRM
  { id: "salesforce-sandbox", name: "Salesforce Sandbox", category: "crm", icon: SiSalesforce, color: "#8FB9D6" },
  { id: "salesforce", name: "Salesforce", category: "crm", icon: SiSalesforce, color: "#00A1E0" },
  { id: "naviga", name: "Naviga", category: "crm", color: "#374151" },
  { id: "hubspot", name: "HubSpot", category: "crm", icon: SiHubspot, color: "#FF7A59" },
  { id: "ms-dynamics-365", name: "MS Dynamics 365", category: "crm", icon: BsMicrosoft, color: "#002050" },
  { id: "pipedrive", name: "Pipedrive", category: "crm", color: "#1A1A1A" },
  { id: "zoho-crm", name: "Zoho", category: "crm", icon: SiZoho, color: "#E42527", premium: true },
  { id: "freshsales", name: "Freshsales", category: "crm", color: "#F36D21" },
  { id: "close", name: "Close", category: "crm", color: "#2A5BD7" },
  { id: "copper", name: "Copper", category: "crm", color: "#F76B4A" },
  { id: "attio", name: "Attio", category: "crm", color: "#111827" },

  // Spreadsheets
  { id: "google-sheets", name: "Google Sheets", category: "spreadsheets", icon: SiGooglesheets, color: "#34A853" },
  { id: "onedrive", name: "OneDrive", category: "spreadsheets", icon: TbBrandOnedrive, color: "#0078D4" },
  { id: "google-drive", name: "Google Drive", category: "spreadsheets", icon: SiGoogledrive, color: "#4285F4" },
  { id: "csv", name: "CSV", category: "spreadsheets", icon: FiFileText, color: "#10B981", premium: true },
  { id: "sharepoint", name: "SharePoint", category: "spreadsheets", color: "#038387" },
  { id: "excel", name: "Microsoft Excel", category: "spreadsheets", icon: PiMicrosoftExcelLogo, color: "#217346" },
  { id: "dropbox", name: "Dropbox", category: "spreadsheets", icon: SiDropbox, color: "#0061FF" },
  { id: "airtable", name: "Airtable", category: "spreadsheets", icon: SiAirtable, color: "#18BFFF" },

  // HRIS & ATS
  { id: "deel", name: "Deel", category: "hris", color: "#15357A" },
  { id: "charthop", name: "ChartHop", category: "hris", color: "#111827" },
  { id: "namely", name: "Namely", category: "hris", color: "#1F6FEB", premium: true },
  { id: "ukg-pro", name: "UKG Pro", category: "hris", color: "#005151" },
  { id: "proliant", name: "Proliant", category: "hris", color: "#1F2937" },
  { id: "teamohana", name: "TeamOhana", category: "hris", color: "#F97316", premium: true },
  { id: "gusto", name: "Gusto", category: "hris", icon: SiGusto, color: "#F45D48" },
  { id: "adp", name: "ADP", category: "hris", icon: SiAdp, color: "#D0271D" },
  { id: "greenhouse", name: "Greenhouse", category: "hris", icon: SiGreenhouse, color: "#24A47F" },
  { id: "workday", name: "Workday", category: "hris", color: "#0875E1", premium: true },
  { id: "bamboohr", name: "BambooHR", category: "hris", color: "#73C41D" },
  { id: "rippling", name: "Rippling", category: "hris", color: "#502D3C" },
  { id: "keka", name: "Keka", category: "hris", color: "#6C3FE8" },
  { id: "darwinbox", name: "Darwinbox", category: "hris", color: "#1D4ED8" },

  // Billing & Invoicing
  { id: "stripe", name: "Stripe", category: "billing", icon: SiStripe, color: "#635BFF" },
  { id: "chargebee", name: "Chargebee", category: "billing", color: "#FF3300" },
  { id: "paypal", name: "PayPal", category: "billing", icon: SiPaypal, color: "#003087" },
  { id: "razorpay", name: "Razorpay", category: "billing", icon: SiRazorpay, color: "#0C2451" },
  { id: "zuora", name: "Zuora", category: "billing", color: "#0D4AC3", premium: true },
  { id: "recurly", name: "Recurly", category: "billing", color: "#7C3AED" },
  { id: "bill-com", name: "BILL", category: "billing", color: "#F15A29" },
  { id: "brex", name: "Brex", category: "billing", icon: SiBrex, color: "#171717" },

  // Databases & Warehouses
  { id: "snowflake", name: "Snowflake", category: "databases", icon: SiSnowflake, color: "#29B5E8", premium: true },
  { id: "bigquery", name: "Google BigQuery", category: "databases", icon: SiGooglebigquery, color: "#669DF6" },
  { id: "redshift", name: "Amazon Redshift", category: "databases", icon: SiAmazonredshift, color: "#8C4FFF" },
  { id: "databricks", name: "Databricks", category: "databases", icon: SiDatabricks, color: "#FF3621", premium: true },
  { id: "postgresql", name: "PostgreSQL", category: "databases", icon: SiPostgresql, color: "#4169E1" },
  { id: "mysql", name: "MySQL", category: "databases", icon: SiMysql, color: "#4479A1" },
  { id: "sql-server", name: "SQL Server", category: "databases", icon: BsMicrosoft, color: "#CC2927" },
  { id: "mongodb", name: "MongoDB", category: "databases", icon: SiMongodb, color: "#47A248" },
  { id: "amazon-s3", name: "Amazon S3", category: "databases", icon: SiAmazons3, color: "#569A31" },

  // BI
  { id: "tableau", name: "Tableau", category: "bi", icon: SiTableau, color: "#E97627" },
  { id: "power-bi", name: "Power BI", category: "bi", color: "#E8B400" },
  { id: "looker", name: "Looker", category: "bi", icon: SiLooker, color: "#4285F4" },
  { id: "metabase", name: "Metabase", category: "bi", icon: SiMetabase, color: "#509EE3" },
  { id: "qlik", name: "Qlik Sense", category: "bi", icon: SiQlik, color: "#009848", premium: true },

  // Customer Success Management
  { id: "gainsight", name: "Gainsight", category: "csm", color: "#0C3B61", premium: true },
  { id: "churnzero", name: "ChurnZero", category: "csm", color: "#E4003A" },
  { id: "totango", name: "Totango", category: "csm", color: "#3F4DE1" },
  { id: "vitally", name: "Vitally", category: "csm", color: "#8B5CF6" },
  { id: "intercom", name: "Intercom", category: "csm", icon: SiIntercom, color: "#1F8DED" },

  // Others
  { id: "slack", name: "Slack", category: "others", icon: SiSlack, color: "#4A154B" },
  { id: "ms-teams", name: "Microsoft Teams", category: "others", icon: BsMicrosoftTeams, color: "#6264A7" },
  { id: "gmail", name: "Gmail", category: "others", icon: SiGmail, color: "#EA4335" },
  { id: "shopify", name: "Shopify", category: "others", icon: SiShopify, color: "#5E8E3E" },
  { id: "zapier", name: "Zapier", category: "others", icon: SiZapier, color: "#FF4F00" },
  { id: "google-analytics", name: "Google Analytics", category: "others", icon: SiGoogleanalytics, color: "#E37400" },
  { id: "asana", name: "Asana", category: "others", icon: SiAsana, color: "#F06A6A" },

  // Ticketing
  { id: "jira", name: "Jira", category: "ticketing", icon: SiJira, color: "#0052CC" },
  { id: "zendesk", name: "Zendesk", category: "ticketing", icon: SiZendesk, color: "#03363D" },
  { id: "freshdesk", name: "Freshdesk", category: "ticketing", color: "#25C16F" },
  { id: "servicenow", name: "ServiceNow", category: "ticketing", color: "#293E40", premium: true },
  { id: "linear", name: "Linear", category: "ticketing", icon: SiLinear, color: "#5E6AD2" },
  { id: "clickup", name: "ClickUp", category: "ticketing", icon: SiClickup, color: "#7B68EE" },

  // Currency Exchange Provider
  { id: "open-exchange-rates", name: "Open Exchange Rates", category: "currency", color: "#0F766E" },
  { id: "xe", name: "XE Currency Data", category: "currency", color: "#0A1D4E", premium: true },
  { id: "fixer", name: "Fixer.io", category: "currency", color: "#2563EB" },
  { id: "currencylayer", name: "currencylayer", category: "currency", color: "#0EA5E9" },
  { id: "wise", name: "Wise", category: "currency", icon: SiWise, color: "#163300" },
  { id: "revolut", name: "Revolut Business", category: "currency", icon: SiRevolut, color: "#191C1F" },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
export const INTEGRATION_BY_ID = Object.fromEntries(INTEGRATIONS.map((i) => [i.id, i]));

export const connectionKey = (integrationId, connectionId) => `${integrationId}:${connectionId}`;

// Frontend-only for now: connections are simulated and kept in localStorage.
// When the backend is ready, replace these two with real API calls.
const STORAGE_KEY = "fpna.integrations.connections";

export const loadConnections = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export const saveConnections = (connections) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
  } catch {
    // storage unavailable (private mode etc.) - connections stay in memory only
  }
};

export const timeAgo = (iso) => {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.floor(minutes)}m ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = hours / 24;
  if (days < 30) return `${Math.floor(days)}d ago`;
  const months = days / 30;
  if (months < 12) return `${Math.floor(months)}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};
