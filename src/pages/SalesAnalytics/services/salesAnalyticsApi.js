// The only module pages import for data. Every function is async and returns
// { data, meta } shaped like the future REST API, so replacing the mock with
// real endpoints is confined to this file. `viewer` identifies who is asking
// ({ userId }); the server side resolves scope and masking from it.

import { getDataset } from "../mock/dataset";
import { handle, resolveAccess } from "./mockServer/handle";
import { executiveView } from "./mockServer/executive";
import { directorView, repSummaryView } from "./mockServer/director";
import { clientDetailView, resolveRepId, salespersonView } from "./mockServer/salesperson";
import { kpiBreakdownView, trendDrillView } from "./mockServer/drill";
import { filterOptionsFor } from "./mockServer/filterOptions";
import { commentaryStore, forecastStore, scenarioStore } from "./store/stores";
import { whatIfBaselineView } from "./mockServer/whatIf";
import * as fc from "./mockServer/forecast";
import { DEFAULT_FILTERS } from "../filters/filterSchema";

const ANY_ANALYTICS = ["view_executive_analytics", "view_team_analytics", "view_own_analytics"];

/** Narrow a query to one rep when the caller names one (or is a salesperson). */
const oneRep = (args, access, ds) => (args.repId || access.scope.kind === "own" ? { repIds: [resolveRepId(args, access, ds)].filter(Boolean) } : undefined);

export async function getMyAccess(viewer) {
  const access = resolveAccess(viewer);
  return {
    user: access.user,
    roleId: access.roleId,
    roleLabel: access.roleLabel,
    capabilities: [...access.capabilities],
    scope: { kind: access.scope.kind, label: access.scope.label, repIds: [...access.scope.repIds], teamIds: [...access.scope.teamIds] },
    maskedFields: [...access.maskedFields],
  };
}

/** Demo personas for the View-as switcher. */
export function listViewAsUsers() {
  const ds = getDataset();
  const team = (id) => ds.index.teamById.get(id)?.name;
  return ds.org.people.map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    title: p.title,
    team: p.teamId ? team(p.teamId) : null,
    restricted: ds.index.repById.get(p.id)?.restricted || false,
  }));
}

export async function getFilterOptions(viewer) {
  return filterOptionsFor(getDataset(), resolveAccess(viewer));
}

export const getExecutiveOverview = handle(["view_executive_analytics"], executiveView);
export const getTrendDrill = handle(ANY_ANALYTICS, trendDrillView, { contextOptions: oneRep });
export const getKpiBreakdown = handle(ANY_ANALYTICS, kpiBreakdownView, { contextOptions: oneRep });
export const getDirectorView = handle(["view_team_analytics"], directorView);
export const getRepSummary = handle(["view_team_analytics"], repSummaryView, { contextOptions: (args) => ({ repIds: [args.repId] }) });
export const getSalespersonView = handle(["view_own_analytics"], salespersonView, {
  contextOptions: (args, access, ds) => ({ repIds: [resolveRepId(args, access, ds)].filter(Boolean) }),
});
export const getClientDetail = handle(ANY_ANALYTICS, clientDetailView, {
  contextOptions: (args, access, ds) => ({ ...oneRep(args, access, ds), clientIds: [args.clientId] }),
});

/** Saved insight commentary, per page view. Stored in this browser until the backend exists. */
export const commentary = {
  list(pageKey) {
    return commentaryStore.read()[pageKey] || [];
  },
  save(pageKey, item) {
    commentaryStore.update((all) => {
      const list = all[pageKey] || [];
      all[pageKey] = [...list.filter((c) => c.id !== item.id), { ...item, id: item.id || `cm-${Date.now()}` }];
      return all;
    });
  },
  remove(pageKey, id) {
    commentaryStore.update((all) => {
      all[pageKey] = (all[pageKey] || []).filter((c) => c.id !== id);
      return all;
    });
  },
  subscribe: (fn) => commentaryStore.subscribe(fn),
};

/* ---------------- What-If and sales forecast ---------------- */

const whatIfHandler = handle(["create_scenario"], whatIfBaselineView, {
  contextOptions: (args, access, ds) => ({ repIds: [resolveRepId(args, access, ds)].filter(Boolean) }),
});
/** One salesperson's current-quarter baseline. Page filters don't apply: the forecast covers the whole book. */
export const getWhatIfBaseline = (filters, viewer, args) => whatIfHandler(DEFAULT_FILTERS, viewer, args);

const teamForecastHandler = handle(["review_team_forecast"], fc.teamForecastView);
/** Consolidated current-quarter forecast for the viewer's teams (all of them, whatever the page filters). */
export const getTeamForecast = (filters, viewer, args) => teamForecastHandler(DEFAULT_FILTERS, viewer, args);

export const scenarios = {
  list: fc.listScenarios,
  save: fc.saveScenario,
  remove: fc.deleteScenario,
  setMyForecast: fc.setMyForecast,
  subscribe: (fn) => scenarioStore.subscribe(fn),
};

export const salesForecast = {
  submit: fc.submitForecast,
  status: fc.getForecastStatus,
  submission: fc.getSubmission,
  returnToRep: fc.returnSubmission,
  confirm: fc.confirmSubmission,
  addAdjustment: fc.addAdjustment,
  removeAdjustment: fc.removeAdjustment,
  confirmTeam: fc.confirmTeamForecast,
  sendToForecasting: fc.sendToForecasting,
  subscribe: (fn) => forecastStore.subscribe(fn),
};
