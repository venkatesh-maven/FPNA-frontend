// Recruiting Health (spec section 11) reads. Same contract as salesAnalyticsApi:
// async (filters, viewer, args) → { data, meta }, with scope and field masking
// resolved server-side from the viewer. A recruiter is always narrowed to
// their own desk; the executive, directors, account managers and leads may
// name a recruiter in their scope.

import { handle } from "./mockServer/handle";
import { resolveRepId } from "./mockServer/salesperson";
import { salesHealthOpportunityView, salesHealthStageView, salesHealthView } from "./mockServer/salesHealth";

export const SALES_HEALTH_CAPABILITIES = ["view_executive_analytics", "view_team_analytics", "view_own_analytics"];

/** Narrow a query to one recruiter when the caller names one (or is a recruiter). */
const contextOptions = (args, access, ds) =>
  args.repId || access.scope.kind === "own" ? { repIds: [resolveRepId(args, access, ds)].filter(Boolean) } : undefined;

export const getSalesHealth = handle(SALES_HEALTH_CAPABILITIES, salesHealthView, { contextOptions });

/** One job order's stage history, fill-date moves, drivers and client capacity. */
export const getSalesHealthOpportunity = handle(SALES_HEALTH_CAPABILITIES, salesHealthOpportunityView, { contextOptions });

/** One funnel stage's cohort by recruiter, client and job order. */
export const getSalesHealthStage = handle(SALES_HEALTH_CAPABILITIES, salesHealthStageView, { contextOptions });
