/** Stops calling a failing service for a while, so a dead backend costs nothing per keystroke. */
export class Breaker {
  private failures = 0;
  private openUntil = 0;
  constructor(private threshold = 3, private coolMs = 60_000, private now = Date.now) {}

  isOpen() { return this.now() < this.openUntil; }
  success() { this.failures = 0; this.openUntil = 0; }
  /** pauseMs comes from the service (Retry-After); otherwise trip after `threshold` failures in a row. */
  failure(pauseMs?: number) {
    if (pauseMs !== undefined) { this.openUntil = this.now() + pauseMs; return; }
    if (++this.failures < this.threshold) return;
    this.openUntil = this.now() + this.coolMs;
    this.failures = this.threshold - 1; // after the pause, one more failure re-trips
  }
}

/** In-memory only. MV3 service workers are torn down when idle, so entries rarely outlive the TTL anyway. */
export class TtlCache<V> {
  private entries = new Map<string, { value: V; expires: number }>();
  constructor(private ttlMs = 5 * 60_000, private max = 100, private now = Date.now) {}

  get(key: string) {
    const e = this.entries.get(key);
    if (!e) return undefined;
    if (e.expires <= this.now()) { this.entries.delete(key); return undefined; }
    return e.value;
  }
  set(key: string, value: V) {
    this.entries.delete(key);
    if (this.entries.size >= this.max) this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(key, { value, expires: this.now() + this.ttlMs });
  }
  clear() { this.entries.clear(); }
}

/** Cache keys are digests, so raw user-entered values are never held as map keys. */
export async function cacheKey(url: string, body: unknown) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${url}\n${JSON.stringify(body)}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
