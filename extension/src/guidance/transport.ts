import type { ZodType } from "zod";

export type Failure = "timeout" | "network" | "unauthorized" | "rate_limited" | "server" | "rejected" | "malformed";
export type FetchResult<T> = { ok: true; data: T } | { ok: false; reason: Failure; status?: number; retryAfterMs?: number };

const TIMED_OUT = Symbol("timeout");
const isTimeout = (e: unknown) => (e as { name?: string } | null)?.name === "TimeoutError" || (e as { name?: string } | null)?.name === "AbortError";

export function retryAfterMs(header: string | null, now = Date.now()): number | undefined {
  if (!header) return;
  const secs = Number(header);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const at = Date.parse(header);
  return Number.isNaN(at) ? undefined : Math.max(0, at - now);
}

/** POSTs JSON and never throws: every outcome, including a bad payload, comes back as a typed result. */
export async function postJson<T>(url: string, body: unknown, schema: ZodType<T, any, any>, opts: { timeoutMs: number; headers?: Record<string, string>; fetchImpl?: typeof fetch }): Promise<FetchResult<T>> {
  let res: Response;
  try {
    res = await (opts.fetchImpl ?? fetch)(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...opts.headers },
      body: JSON.stringify(body),
      credentials: "omit", // never forward cookies or sessions from the compliance site
      signal: AbortSignal.timeout(opts.timeoutMs), // also bounds reading the body below
    });
  } catch (error) {
    return { ok: false, reason: isTimeout(error) ? "timeout" : "network" };
  }
  if (res.status === 401 || res.status === 403) return { ok: false, reason: "unauthorized", status: res.status };
  if (res.status === 429) return { ok: false, reason: "rate_limited", status: 429, retryAfterMs: retryAfterMs(res.headers.get("retry-after")) };
  if (res.status >= 500) return { ok: false, reason: "server", status: res.status };
  if (!res.ok) return { ok: false, reason: "rejected", status: res.status };
  const json = await res.json().catch((e) => (isTimeout(e) ? TIMED_OUT : undefined));
  if (json === TIMED_OUT) return { ok: false, reason: "timeout", status: res.status };
  const parsed = schema.safeParse(json);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, reason: "malformed", status: res.status };
}
