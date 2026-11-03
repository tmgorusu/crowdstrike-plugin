import { describe, expect, it } from "vitest";
import { z } from "zod";
import { postJson, retryAfterMs } from "../extension/src/guidance/transport";
import { Breaker, cacheKey, TtlCache } from "../extension/src/guidance/resilience";

const schema = z.object({ answer: z.string() });
const respond = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  (async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers })) as typeof fetch;
const hang: typeof fetch = (_url, init) => new Promise((_, reject) => init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason)));
const call = (fetchImpl: typeof fetch, timeoutMs = 1000) => postJson("https://hub.test/x", { q: 1 }, schema, { timeoutMs, fetchImpl });

describe("postJson", () => {
  it("returns parsed data on success", async () => {
    expect(await call(respond(200, { answer: "ok" }))).toEqual({ ok: true, data: { answer: "ok" } });
  });
  it("omits cookies and sends JSON", async () => {
    let seen: RequestInit | undefined;
    await call((async (_u, init) => { seen = init; return new Response("{\"answer\":\"a\"}"); }) as typeof fetch);
    expect(seen?.credentials).toBe("omit");
    expect(seen?.method).toBe("POST");
    expect(JSON.parse(String(seen?.body))).toEqual({ q: 1 });
  });
  it("times out instead of waiting on a slow service", async () => {
    const started = Date.now();
    expect(await call(hang, 50)).toMatchObject({ ok: false, reason: "timeout" });
    expect(Date.now() - started).toBeLessThan(1000);
  });
  it("reports network failures", async () => {
    expect(await call((async () => { throw new TypeError("Failed to fetch"); }) as typeof fetch)).toMatchObject({ ok: false, reason: "network" });
  });
  it("maps status codes", async () => {
    expect(await call(respond(500, {}))).toMatchObject({ ok: false, reason: "server", status: 500 });
    expect(await call(respond(503, "down"))).toMatchObject({ ok: false, reason: "server", status: 503 });
    expect(await call(respond(401, {}))).toMatchObject({ ok: false, reason: "unauthorized" });
    expect(await call(respond(403, {}))).toMatchObject({ ok: false, reason: "unauthorized" });
    expect(await call(respond(400, {}))).toMatchObject({ ok: false, reason: "rejected", status: 400 });
    expect(await call(respond(429, {}, { "retry-after": "12" }))).toMatchObject({ ok: false, reason: "rate_limited", retryAfterMs: 12000 });
  });
  it("treats malformed bodies as failures, not data", async () => {
    expect(await call(respond(200, "<html>oops</html>"))).toMatchObject({ ok: false, reason: "malformed" });
    expect(await call(respond(200, ""))).toMatchObject({ ok: false, reason: "malformed" });
    expect(await call(respond(200, { answer: 42 }))).toMatchObject({ ok: false, reason: "malformed" });
    expect(await call(respond(200, null))).toMatchObject({ ok: false, reason: "malformed" });
  });
});

describe("retryAfterMs", () => {
  it("reads seconds and HTTP dates", () => {
    expect(retryAfterMs("3")).toBe(3000);
    expect(retryAfterMs(new Date(10_000).toUTCString(), 4_000)).toBe(6000);
    expect(retryAfterMs("soon")).toBeUndefined();
    expect(retryAfterMs(null)).toBeUndefined();
  });
});

describe("Breaker", () => {
  it("opens after repeated failures, cools off, and re-trips on the next failure", () => {
    let t = 0;
    const b = new Breaker(3, 60_000, () => t);
    b.failure(); b.failure();
    expect(b.isOpen()).toBe(false);
    b.failure();
    expect(b.isOpen()).toBe(true);
    t = 60_001;
    expect(b.isOpen()).toBe(false);
    b.failure();
    expect(b.isOpen()).toBe(true);
    b.success();
    expect(b.isOpen()).toBe(false);
  });
  it("honors a server-provided pause", () => {
    let t = 0;
    const b = new Breaker(3, 60_000, () => t);
    b.failure(5_000);
    expect(b.isOpen()).toBe(true);
    t = 5_001;
    expect(b.isOpen()).toBe(false);
  });
});

describe("TtlCache", () => {
  it("expires entries and caps its size", () => {
    let t = 0;
    const c = new TtlCache<number>(1000, 2, () => t);
    c.set("a", 1); c.set("b", 2); c.set("c", 3);
    expect(c.get("a")).toBeUndefined();
    expect(c.get("c")).toBe(3);
    t = 1001;
    expect(c.get("c")).toBeUndefined();
  });
  it("keys by digest, not by raw content", async () => {
    const k = await cacheKey("https://hub.test/x", { value: "Citizens for Example PAC" });
    expect(k).toMatch(/^[0-9a-f]{64}$/);
    expect(k).not.toContain("Citizens");
    expect(await cacheKey("https://hub.test/x", { value: "Citizens for Example PAC" })).toBe(k);
  });
});
