// Keeps the most recently ACCEPTED GL upload in this browser (IndexedDB, so it
// survives a page refresh) until the server-side load is built. Also provides
// tiny cross-tab helpers so one tab can open another with a filter applied.

const DB_NAME = 'fpna-data-upload';
const STORE = 'datasets';
const KEY = 'gl-latest';
export const ACCEPTED_GL_EVENT = 'fpna-accepted-gl';
export const OPEN_TAB_EVENT = 'fpna-open-tab';

let cache; // undefined = not loaded yet, null = nothing stored

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Save the dataset built by buildGlDataset(). Always updates the in-memory copy, even if IndexedDB fails. */
export async function saveAcceptedGl(dataset) {
  cache = dataset;
  try {
    await idb('readwrite', (s) => s.put(dataset, KEY));
  } catch {
    // Private window / storage blocked: the data still works until the page is refreshed.
  }
  window.dispatchEvent(new CustomEvent(ACCEPTED_GL_EVENT));
}

/** Load the latest accepted GL dataset, or null when none has been accepted in this browser. */
export async function loadAcceptedGl() {
  if (cache !== undefined) return cache;
  try {
    cache = (await idb('readonly', (s) => s.get(KEY))) || null;
  } catch {
    cache = null;
  }
  return cache;
}

export async function clearAcceptedGl() {
  cache = null;
  try { await idb('readwrite', (s) => s.delete(KEY)); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(ACCEPTED_GL_EVENT));
}

// ── Cross-tab navigation ─────────────────────────────────────────────────────
let pendingEntriesFilter = null;

/** Ask the page to switch tab ("create" | "view" | "entries" | "history"), optionally with an Entries filter. */
export function openTab(tab, entriesFilter = null) {
  if (entriesFilter) pendingEntriesFilter = entriesFilter;
  window.dispatchEvent(new CustomEvent(OPEN_TAB_EVENT, { detail: { tab } }));
}

/** Entries tab calls this on mount: returns a filter like { account: '107' } once, then clears it. */
export function takePendingEntriesFilter() {
  const f = pendingEntriesFilter;
  pendingEntriesFilter = null;
  return f;
}
