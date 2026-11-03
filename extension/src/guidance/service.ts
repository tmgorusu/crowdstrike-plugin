import type { ZodType } from "zod";
import { postJson, type Failure } from "./transport";
import { Breaker, cacheKey, TtlCache } from "./resilience";
import type { GuidanceQuery, GuidanceResult, GuidanceView } from "./types";

/** A backend that can answer field guidance. Only the source knows its wire format. */
export type GuidanceSource<R> = {
  timeoutMs: number;
  endpoint: () => Promise<string>;
  /** Must include only what the backend needs; this is exactly what goes over the network. */
  toRequest: (q: GuidanceQuery) => unknown;
  schema: ZodType<R, any, any>;
  toView: (r: R) => GuidanceView | null;
};

type Deps = { cache?: TtlCache<GuidanceView>; breaker?: Breaker; fetchImpl?: typeof fetch; log?: (reason: Failure | "error", status?: number) => void };

// Logs carry failure codes only, never request or response bodies.
const defaultLog: NonNullable<Deps["log"]> = (reason, status) => console.warn(`strike: guidance unavailable (${reason}${status ? ` ${status}` : ""})`);
const MAX_PAUSE = 10 * 60_000;

/** Resolves every query to a result the card can render. Never throws, never blocks on a dead backend. */
export function createGuidanceService<R>(source: GuidanceSource<R>, deps: Deps = {}) {
  const cache = deps.cache ?? new TtlCache<GuidanceView>();
  const breaker = deps.breaker ?? new Breaker();
  const log = deps.log ?? defaultLog;

  return async (q: GuidanceQuery): Promise<GuidanceResult> => {
    try {
      const url = await source.endpoint();
      const body = source.toRequest(q);
      const key = await cacheKey(url, body);
      const hit = cache.get(key);
      if (hit) return { status: "ok", view: hit };
      if (breaker.isOpen()) return { status: "unavailable" };

      const r = await postJson(url, body, source.schema, { timeoutMs: source.timeoutMs, fetchImpl: deps.fetchImpl });
      const view = r.ok ? source.toView(r.data) : null;
      if (view) { breaker.success(); cache.set(key, view); return { status: "ok", view }; }

      const reason: Failure = r.ok ? "malformed" : r.reason;
      log(reason, r.ok ? undefined : r.status);
      if (reason === "unauthorized") return { status: "unauthorized" };
      if (reason === "rate_limited") breaker.failure(Math.min((r.ok ? undefined : r.retryAfterMs) ?? 30_000, MAX_PAUSE));
      else if (reason !== "rejected") breaker.failure(); // a rejected request is our payload's fault, not an outage
      return { status: "unavailable" };
    } catch {
      log("error");
      return { status: "unavailable" };
    }
  };
}
