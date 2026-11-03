import { describe, expect, it, vi } from "vitest";
import type { AssistResponse } from "../shared/contract";
import { localServerSource } from "../extension/src/guidance/localSource";
import { createGuidanceService } from "../extension/src/guidance/service";
import { Breaker } from "../extension/src/guidance/resilience";
import type { GuidanceQuery } from "../extension/src/guidance/types";

// A mock backend: records every request and answers with whatever the test hands it.
function mockBackend(reply: (signal: AbortSignal) => Response | Promise<Response>) {
  const bodies: string[] = [];
  const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => { bodies.push(String(init?.body)); return reply(init!.signal!); }) as unknown as typeof fetch;
  return { fetchImpl, bodies, calls: () => (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls.length };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const TYPED = "Citizens for Example PAC";
const answer: AssistResponse = {
  answer: "This field asks for the committee name, and the form marks it required. More text here.",
  whatGoesHere: "The committee's full official name, spelled exactly as registered. Include any acronym.",
  officialSource: "The committee's registration / statement of organization.",
  example: "Citizens for Example County PAC (fictional)",
  whyItMatters: "Reports are matched to the registration by name and ID.",
  jurisdictionNote: "Check your filing authority.",
  confidence: "high", source: "offline",
};
const query = (value?: string, extra: Partial<GuidanceQuery["field"]> = {}): GuidanceQuery => ({
  reason: "input",
  page: { url: "http://localhost:3000/copilot-demo/", title: "Statement of Organization" },
  section: "Committee",
  field: { id: "f1", label: "Committee name", labelSource: "label", kind: "text", required: true, sensitive: false, value, ...extra },
});
const setup = (reply: (signal: AbortSignal) => Response | Promise<Response>, timeoutMs?: number) => {
  const backend = mockBackend(reply);
  const log = vi.fn();
  const source = localServerSource(async () => "http://localhost:3000");
  const get = createGuidanceService({ ...source, timeoutMs: timeoutMs ?? source.timeoutMs }, { fetchImpl: backend.fetchImpl, breaker: new Breaker(), log });
  return { ...backend, get, log };
};

describe("guidance service with the local server source", () => {
  it("turns a response into a short card", async () => {
    const { get } = setup(() => json(answer));
    const r = await get(query());
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.view.headline).toBe("This field asks for the committee name, and the form marks it required.");
    expect(r.view.steps).toHaveLength(3);
    expect(r.view.steps[0]).toBe("The committee's full official name, spelled exactly as registered.");
    expect(r.view.steps.every((s) => s.length <= 160)).toBe(true);
    expect(r.view.detail).toContain("matched to the registration");
    expect(r.view.verify).toBe(false);
  });

  it("never sends what the user typed, or anything from a sensitive field", async () => {
    const { get, bodies } = setup(() => json(answer));
    await get(query(TYPED));
    await get(query(undefined, { id: "f9", label: "Routing number", sensitive: true }));
    expect(bodies.join("\n")).not.toContain(TYPED);
    expect(JSON.parse(bodies[0]).context.fields).toHaveLength(1);
  });

  it("serves repeat requests from the short-lived cache", async () => {
    const { get, calls } = setup(() => json(answer));
    await get(query("a"));
    await get(query("ab")); // same outgoing request: the value isn't sent
    expect(calls()).toBe(1);
  });

  it("falls back quietly on server errors and malformed responses", async () => {
    for (const reply of [() => json({ error: "boom" }, 500), () => new Response("<html>"), () => json({ answer: 1 }), () => json({ ...answer, answer: "   " })]) {
      expect(await setup(reply).get(query())).toEqual({ status: "unavailable" });
    }
  });

  it("falls back on a slow service", async () => {
    const hang = (signal: AbortSignal) => new Promise<Response>((_, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
    const { get, log } = setup(hang, 50);
    expect(await get(query())).toEqual({ status: "unavailable" });
    expect(log).toHaveBeenCalledWith("timeout", undefined);
  });

  it("stops calling a dead backend after repeated failures", async () => {
    const { get, calls } = setup(() => json({}, 503));
    for (let i = 0; i < 6; i++) await get(query(undefined, { id: `f${i}`, label: `Field ${i}` }));
    expect(calls()).toBe(3);
  });

  it("pauses when rate limited", async () => {
    const { get, calls } = setup(() => new Response("{}", { status: 429, headers: { "retry-after": "30" } }));
    await get(query());
    await get(query(undefined, { id: "f2", label: "Other" }));
    expect(calls()).toBe(1);
  });

  it("reports sign-in problems separately and doesn't trip the breaker for them", async () => {
    const { get, calls } = setup(() => json({}, 401));
    for (let i = 0; i < 4; i++) expect(await get(query(undefined, { id: `f${i}` }))).toEqual({ status: "unauthorized" });
    expect(calls()).toBe(4);
  });

  it("logs failure codes only", async () => {
    const { get, log } = setup(() => json({ echoed: TYPED }, 500));
    await get(query(TYPED));
    expect(log).toHaveBeenCalledWith("server", 500);
    expect(JSON.stringify(log.mock.calls)).not.toContain(TYPED);
  });
});
