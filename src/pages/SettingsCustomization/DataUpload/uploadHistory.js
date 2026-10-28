// Upload history kept in this browser (localStorage) until the server-side history is built.
const KEY = 'fpna.glUploadHistory.v1';
const MAX = 30;

export function loadHistory() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function addHistoryEntry(entry) {
  const list = [entry, ...loadHistory()].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage full or blocked — keep only the newest few.
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 5))); } catch { /* ignore */ }
  }
  window.dispatchEvent(new Event('fpna-upload-history'));
  return list;
}

export function clearHistory() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  window.dispatchEvent(new Event('fpna-upload-history'));
}

const PREF_KEY = 'fpna.glUpload.dateFormat';
export function loadDateFormatPref() {
  try { return localStorage.getItem(PREF_KEY); } catch { return null; }
}
export function saveDateFormatPref(v) {
  try { localStorage.setItem(PREF_KEY, v); } catch { /* ignore */ }
}
