// Small localStorage-backed store for the module's saved state (View-as
// choice, commentary; scenarios and forecasts in Phase 3). Keys are
// namespaced `fpna.sa.v1.*` so they never touch the app's other settings.
// Storage can be unavailable (private mode, blocked site data), so every
// read and write falls back to memory.

const PREFIX = "fpna.sa.v";

export function createVersionedStore({ key, version = 1, defaults, storage = safeStorage() }) {
  const fullKey = `${PREFIX}${version}.${key}`;
  let memory = null;
  const listeners = new Set();

  const read = () => {
    if (memory) return memory;
    try {
      const raw = storage?.getItem(fullKey);
      memory = raw ? JSON.parse(raw) : clone(defaults);
    } catch {
      memory = clone(defaults);
    }
    return memory;
  };

  const write = (value) => {
    memory = value;
    try {
      storage?.setItem(fullKey, JSON.stringify(value));
    } catch {
      // Storage full or blocked: the in-memory copy still works this session.
    }
    listeners.forEach((l) => l(value));
  };

  return {
    key: fullKey,
    read,
    write,
    update: (fn) => write(fn(clone(read()))),
    reset: () => write(clone(defaults)),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

function safeStorage() {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}
