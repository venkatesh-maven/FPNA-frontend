// Centralized cache for all financial report API calls.
// Strategy: memory-first (instant) → sessionStorage (survives refresh) → network.
// Deduplicates concurrent requests to the same URL.

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
// Bumped to v2 (2026-08-01): entries cached before fiscal-year invalidation
// was wired up could be silently serving stale pre-fiscal-year-change data
// for up to an hour. Bumping the prefix orphans old entries instantly
// instead of waiting for every user to hit the TTL or clear storage by hand.
// v3 (2026-10-16): customer drilldowns gained `drivers` (Breakdown tab); cached
// responses from before that would hide the new sections for up to an hour.
const STORAGE_PREFIX = "fpna_rc_v3_";
const MAX_STORAGE_ENTRIES = 50;

const memCache = new Map(); // url -> { data, ts }
const inFlight = new Map(); // url -> Promise<data>

// ─── storage helpers ────────────────────────────────────────────────────────

function tryReadStorage(url) {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + url);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) {
      sessionStorage.removeItem(STORAGE_PREFIX + url);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function tryWriteStorage(url, data) {
  try {
    // Evict oldest entries if storage is getting large
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(STORAGE_PREFIX)) keys.push(k);
    }
    if (keys.length >= MAX_STORAGE_ENTRIES) {
      sessionStorage.removeItem(keys[0]);
    }
    sessionStorage.setItem(
      STORAGE_PREFIX + url,
      JSON.stringify({ data, ts: Date.now() })
    );
  } catch {
    // sessionStorage full — memory cache still works
  }
}

// ─── public API ─────────────────────────────────────────────────────────────

/**
 * Drop-in replacement for fetch(...).then(r => r.json()).
 * Returns cached JSON instantly if available, otherwise fetches and caches.
 */
export async function cachedFetch(url, options = {}) {
  // 1. Memory hit — zero network cost
  const mem = memCache.get(url);
  if (mem && Date.now() - mem.ts < CACHE_TTL_MS) return mem.data;

  // 2. SessionStorage hit — survives page refresh
  const stored = tryReadStorage(url);
  if (stored) {
    memCache.set(url, { data: stored, ts: Date.now() });
    return stored;
  }

  // 3. Deduplicate concurrent requests for the same URL
  if (inFlight.has(url)) return inFlight.get(url);

  const promise = fetch(url, options)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      memCache.set(url, { data, ts: Date.now() });
      tryWriteStorage(url, data);
      inFlight.delete(url);
      return data;
    })
    .catch((err) => {
      inFlight.delete(url);
      throw err;
    });

  inFlight.set(url, promise);
  return promise;
}

/**
 * Force-invalidate cache entries whose URL contains the given substring.
 * Call this after a user action that mutates report data.
 */
export function invalidateReportCache(urlSubstring = "") {
  for (const key of memCache.keys()) {
    if (!urlSubstring || key.includes(urlSubstring)) memCache.delete(key);
  }
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(STORAGE_PREFIX) && (!urlSubstring || k.includes(urlSubstring))) {
        sessionStorage.removeItem(k);
      }
    }
  } catch {}
}

/**
 * Warm the cache for a URL in the background (fire-and-forget prefetch).
 * Use this to pre-load an adjacent report while the user is reading another.
 */
export function prefetchReport(url, options = {}) {
  cachedFetch(url, options).catch(() => {});
}
