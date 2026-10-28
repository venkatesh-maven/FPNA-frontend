import { createVersionedStore } from "./versionedStore";
import { DEFAULT_ACCESS_CONFIG } from "../../access/capabilities";

export const accessStore = createVersionedStore({ key: "access", defaults: DEFAULT_ACCESS_CONFIG });
export const viewAsStore = createVersionedStore({ key: "viewAs", defaults: { userId: "E1" } });
// { [pageKey]: [{ id, insightId, title, text, savedAt, savedBy, filtersLabel }] }
export const commentaryStore = createVersionedStore({ key: "commentary", defaults: {} });
// { scenarios: [{ id, repId, ownerId, ownerName, name, assumptions, isMyForecast, createdAt, updatedAt }] }
export const scenarioStore = createVersionedStore({ key: "scenarios", defaults: { scenarios: [] } });
// Sales forecast workflow: salesperson submissions (immutable snapshots, newest
// version wins), director team confirmations and transfers to Forecasting.
export const forecastStore = createVersionedStore({
  key: "forecast",
  defaults: { seededFor: null, submissions: [], confirmations: [], transfers: [] },
});
