interface Entry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) if (v.expiresAt <= now) store.delete(k);
}, 60_000).unref?.();

/**
 * Cache memoire avec deduplication des appels concurrents.
 *
 * L application WinDev rappelle GET_ALL_INFOS_CLUB a chaque ecran ; ici
 * un seul appel amont sert toutes les requetes simultanees sur la meme cle.
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  producer: () => Promise<T>,
): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = producer()
    .then((value) => {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, promise);
  return promise;
}

export function invalidate(prefix: string): void {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
