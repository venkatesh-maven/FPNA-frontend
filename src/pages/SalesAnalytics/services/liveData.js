// Loads Staffing Sales Analytics from the server through its separate APIs
// (backend src/staffing_analytics/controller.py, /company/staffing-analytics):
//
//   GET /dataset            the shared data every tab calculates from, once per session
//   GET /filters            the filter-bar options
//   GET /<tab>              a tab's own saved data, fetched each time the tab opens
//   GET|PUT /scenarios, /forecast, /commentary, /access-rules, /access-audit
//                           each saved item, read and written on its own
//
// After the dataset loads, changing a filter needs no further request.

import axios from "axios";
import { API_BASE_URL } from "../../../config/config";
import { attachSessionInterceptor } from "../../../utils/sessionExpiry";
import { applyLiveConfig } from "../config/dataset";
import { setLiveDataset } from "../mock/dataset";
import { buildLiveDataset } from "./liveDataset";
import { mockConfig } from "./mockServer/handle";
import { accessStore, commentaryStore, forecastStore, scenarioStore } from "./store/stores";
import { auditStore } from "./store/auditStore";

const api = attachSessionInterceptor(axios.create({ baseURL: `${API_BASE_URL}/api/v1/company/staffing-analytics` }));
// The signed-in session's token, as every other page uses it (AuthContext), not a fresh read of
// localStorage: another tab logging out or in changes storage, and must not end this tab's session.
let sessionToken = null;
const auth = () => ({ headers: { Authorization: `Bearer ${sessionToken}` } });

// Saved items: store key -> its store and its API path.
const SYNCED = {
  scenarios: { store: scenarioStore, path: "/scenarios" },
  forecast: { store: forecastStore, path: "/forecast" },
  commentary: { store: commentaryStore, path: "/commentary" },
  access: { store: accessStore, path: "/access-rules" },
  accessAudit: { store: auditStore, path: "/access-audit" },
};
const SAVE_DELAY_MS = 400;

let loading = null;
let loadedFor = null;
let filtersLoading = null;
const syncing = new Set();
// Saved items with a change still waiting to be sent: a tab refresh must not overwrite them.
const pendingSave = new Set();

/** Sends a store's changes to its API, batched so typing doesn't send a request per keystroke. */
function syncStore(key) {
  if (syncing.has(key)) return;
  syncing.add(key);
  const { store, path } = SYNCED[key];
  let timer = null;
  store.subscribe((value, info) => {
    if (info?.hydrated) return;
    pendingSave.add(key);
    clearTimeout(timer);
    timer = setTimeout(() => {
      api
        .put(path, { value }, auth())
        .then(() => pendingSave.delete(key))
        .catch((e) => {
          // The change stays on screen; it is retried with the next change to this store.
          console.error(`Staffing analytics: could not save ${key}`, e);
        });
    }, SAVE_DELAY_MS);
  });
}

const failure = (e, what) => new Error(e.response?.data?.detail || `Could not load ${what}. Check the backend is running and try again.`);

/** Loads the dataset and every saved item once per session; every caller shares the same requests. */
export function loadLiveData(token) {
  sessionToken = token;
  if (loadedFor !== token) {
    loading = null; // signed in again, possibly as someone else: their company's data and saved state
    filtersLoading = null;
    loadedFor = token;
  }
  if (!loading) {
    const saved = Object.entries(SYNCED).map(([key, { path }]) =>
      api.get(path, auth()).then(({ data }) => [key, data.value])
    );
    loading = Promise.all([api.get("/dataset", auth()), ...saved])
      .then(([{ data: dataset }, ...state]) => {
        const ds = buildLiveDataset(dataset);
        applyLiveConfig({ asOf: ds.meta.asOf, startYm: ds.meta.startYm, fiscalStartMonth: dataset.meta.fiscalStartMonth });
        setLiveDataset(ds);
        mockConfig.latency = false; // the sample service imitated network time; real data is already here
        for (const [key, value] of state) {
          SYNCED[key].store.hydrate(value);
          syncStore(key);
        }
        return ds;
      })
      .catch((e) => {
        loading = null; // let the next attempt retry
        throw failure(e, "Staffing Sales Analytics");
      });
  }
  return loading;
}

/** The filter-bar options from GET /filters, once per session. */
export function loadFilterOptions() {
  if (!filtersLoading) {
    filtersLoading = api
      .get("/filters", auth())
      .then(({ data }) => data)
      .catch((e) => {
        filtersLoading = null;
        throw failure(e, "the filter options");
      });
  }
  return filtersLoading;
}

/**
 * Fetches a tab's own data (GET /<tab>) when it opens and refreshes its saved
 * items, so it shows what others saved since the module loaded (e.g. a new
 * forecast submission on Team Forecast). A local change not yet sent wins.
 */
export async function refreshTabData(tabKey) {
  if (!sessionToken || !loading) return null;
  await loading;
  const { data } = await api.get(`/${tabKey}`, auth());
  for (const [key, value] of Object.entries(data.state || {})) {
    if (SYNCED[key] && !pendingSave.has(key)) SYNCED[key].store.hydrate(value);
  }
  return data;
}
