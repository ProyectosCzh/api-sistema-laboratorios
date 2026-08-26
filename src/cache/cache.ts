export interface CacheSetOptions {
  ttlMs?: number;
  tags?: string[];
  staleWhileRevalidateMs?: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

export interface Cache {
  get<T>(key: string): T | undefined;
  set(key: string, value: unknown, opts?: CacheSetOptions): void;
  del(key: string): void;
  getOrSet<T>(key: string, fn: () => Promise<T>, opts?: CacheSetOptions): Promise<T>;
  invalidateTag(tag: string): number;
  invalidatePrefix(prefix: string): number;
  stats(): CacheStats;
}

interface Entry {
  value: unknown;
  expiresAt: number;
  swrUntil: number;
  tags: string[];
}

const DEFAULT_TTL_MS = 60_000;

/**
 * Cache en memoria (Map) con single-flight y stale-while-revalidate.
 * Interfaz estrecha pensada para swap futuro a Redis: solo operaciones
 * por clave + invalidación por tag/prefijo.
 */
export function createCache(): Cache {
  const store = new Map<string, Entry>();
  const inflight = new Map<string, Promise<unknown>>();
  let hits = 0;
  let misses = 0;

  function isUsable(entry: Entry, now: number): boolean {
    return entry.expiresAt > now || entry.swrUntil > now;
  }

  function setInternal(key: string, value: unknown, opts: CacheSetOptions): void {
    const now = Date.now();
    const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
    store.set(key, {
      value,
      expiresAt: now + ttlMs,
      swrUntil: now + ttlMs + Math.max(opts.staleWhileRevalidateMs ?? 0, 0),
      tags: opts.tags ?? [],
    });
  }

  async function loadSingleFlight<T>(key: string, fn: () => Promise<T>, opts: CacheSetOptions): Promise<T> {
    const existing = inflight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = (async () => {
      try {
        const value = await fn();
        setInternal(key, value, opts);
        return value;
      } finally {
        inflight.delete(key);
      }
    })();
    inflight.set(key, promise);
    return promise;
  }

  return {
    get<T>(key: string): T | undefined {
      const now = Date.now();
      const entry = store.get(key);
      if (!entry) {
        misses++;
        return undefined;
      }
      if (entry.expiresAt <= now) {
        if (!isUsable(entry, now)) store.delete(key);
        misses++;
        return undefined;
      }
      hits++;
      return entry.value as T;
    },

    set(key, value, opts = {}): void {
      setInternal(key, value, opts);
    },

    del(key): void {
      store.delete(key);
    },

    async getOrSet<T>(key: string, fn: () => Promise<T>, opts: CacheSetOptions = {}): Promise<T> {
      const now = Date.now();
      const entry = store.get(key);

      if (entry && entry.expiresAt > now) {
        hits++;
        return entry.value as T;
      }

      // SWR: servir el valor vencido y recalcular en background una sola vez.
      if (entry && entry.swrUntil > now) {
        hits++;
        void loadSingleFlight(key, fn, opts).catch(() => undefined);
        return entry.value as T;
      }

      if (entry) store.delete(key);
      misses++;
      return loadSingleFlight(key, fn, opts);
    },

    invalidateTag(tag): number {
      let removed = 0;
      for (const [key, entry] of store) {
        if (entry.tags.includes(tag)) {
          store.delete(key);
          removed++;
        }
      }
      return removed;
    },

    invalidatePrefix(prefix): number {
      let removed = 0;
      for (const key of store.keys()) {
        if (key.startsWith(prefix)) {
          store.delete(key);
          removed++;
        }
      }
      return removed;
    },

    stats() {
      return { hits, misses, size: store.size };
    },
  };
}

export const cache: Cache = createCache();

/** Serialización determinista para claves con filtros/queries. */
export function stableStringify(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "undefined";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}
