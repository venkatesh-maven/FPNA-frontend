// Sales Health (spec section 11) reads. Same contract as salesAnalyticsApi:
// async (filters, viewer, args) → { data, meta }, with scope and field masking
// resolved server-side from the viewer. A salesperson is always narrowed to
// their own rep; executives and directors may name a rep in their scope.

import { handle } from "./mockServer/handle";
import { resolveRepId } from "./mockServer/salesperson";
import { salesHealthOpportunityView, salesHealthStageView, salesHealthView } from "./mockServer/salesHealth";

export const SALES_HEALTH_CAPABILITIES = ["view_executive_analytics", "view_team_analytics", "view_own_analytics"];

/** Narrow a query to one rep when the caller names one (or is a salesperson). */
const contextOptions = (args, access, ds) =>
  args.repId || access.scope.kind === "own" ? { repIds: [resolveRepId(args, access, ds)].filter(Boolean) } : undefined;

export const getSalesHealth = handle(SALES_HEALTH_CAPABILITIES, salesHealthView, { contextOptions });

/** One opportunity's stage history, close-date moves, drivers and client capacity. */
export const getSalesHealthOpportunity = handle(SALES_HEALTH_CAPABILITIES, salesHealthOpportunityView, { contextOptions });

/** One funnel stage's cohort by owner, client and opportunity. */
export const getSalesHealthStage = handle(SALES_HEALTH_CAPABILITIES, salesHealthStageView, { contextOptions });
