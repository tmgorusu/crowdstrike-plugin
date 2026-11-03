import { describe, expect, it } from "vitest";
import { localServerSource } from "../extension/src/guidance/localSource";
import { postJson } from "../extension/src/guidance/transport";
import { createGuidanceService } from "../extension/src/guidance/service";
import type { GuidanceQuery } from "../extension/src/guidance/types";

// Opt-in: STRIKE_E2E_BASE=http://localhost:3000 npx vitest run tests/guidance.e2e.test.ts
// Runs against a live server and checks its real responses against the schema the plugin expects.
const BASE = process.env.STRIKE_E2E_BASE;

const query = (label: string, extra: Partial<GuidanceQuery["field"]> = {}): GuidanceQuery => ({
  reason: "focus",
  page: { url: `${BASE}/copilot-demo/`, title: "Statement of Organization" },
  section: "Committee",
  field: { id: "f1", label, labelSource: "label", kind: "text", required: true, sensitive: false, ...extra },
});

describe.skipIf(!BASE)("guidance against a running server", () => {
  const source = localServerSource(async () => BASE!);

  it("returns responses that match the expected schema", async () => {
    for (const q of [query("Treasurer name"), query("Committee type", { kind: "select", options: ["General-purpose committee"] }), query("Bank account number", { sensitive: true }), query("Favorite color")]) {
      const r = await postJson(await source.endpoint(), source.toRequest(q), source.schema, { timeoutMs: source.timeoutMs });
      expect(r, q.field.label).toMatchObject({ ok: true });
    }
  });

  it("produces a renderable card end to end", async () => {
    const r = await createGuidanceService(source)(query("Treasurer name"));
    expect(r.status).toBe("ok");
    if (r.status === "ok") {
      expect(r.view.headline.length).toBeGreaterThan(0);
      expect(r.view.steps.length).toBeLessThanOrEqual(3);
    }
  });
});
