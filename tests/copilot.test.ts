import { describe, expect, it } from "vitest";
import type { AssistRequest, DetectedField } from "../shared/contract";
import { assistResponseSchema } from "../shared/contract";
import { offlineAnswer } from "../server/offline";
import { buildContext, buildPrompt, CONTEXT_CHAR_CAP } from "../server/prompt";
import { sanitizeRequest } from "../server/sanitize";

const SECRET = "998877665544";
const f = (id: string, label: string, extra: Partial<DetectedField> = {}): DetectedField => ({ id, label, labelSource: "label", kind: "text", required: false, sensitive: false, sectionId: "s1", ...extra });
const req = (question: string, fields: DetectedField[], focusFieldId?: string): AssistRequest => ({
  question, focusFieldId,
  context: { url: "http://localhost:3000/copilot-demo/", title: "Committee Registration", pageHeading: "Statement of Organization", scannedAt: "2026-11-03T00:00:00Z",
    sections: [{ id: "s1", heading: "Committee" }, { id: "s2", heading: "Bank" }], fields },
});
const fields = [
  f("f1", "Committee name", { required: true, value: "Citizens for Example PAC" }),
  f("f2", "Committee type", { kind: "select", required: true, options: ["General-purpose committee", "Specific-purpose committee"] }),
  f("f3", "Treasurer name", { required: true }),
  f("f4", "Treasurer email", { kind: "email", error: "Enter a valid email address" , value: "bad@" }),
  f("f5", "Bank account number", { required: true, sensitive: true, sectionId: "s2" }),
  f("f6", "Routing", { sectionId: "s2", value: SECRET }),
];

describe("copilot offline guidance", () => {
  it("explains the focused treasurer name field", () => {
    const a = offlineAnswer(req("What goes here?", fields, "f3"));
    expect(assistResponseSchema.parse(a).source).toBe("offline");
    expect(a.fieldId).toBe("f3");
    expect(a.whatGoesHere).toMatch(/treasurer/i);
    expect(a.officialSource).toMatch(/registration/i);
    expect(a.example).toMatch(/fictional/i);
  });
  it("answers committee type with its options and lists needed facts", () => {
    const a = offlineAnswer(req("What should I pick for committee type?", fields));
    expect(a.fieldId).toBe("f2");
    expect(a.whatGoesHere).toContain("General-purpose committee");
    expect(a.needsInfo?.length).toBeGreaterThan(0);
    expect(a.jurisdictionNote).toMatch(/federal/i);
  });
  it("lists required empty fields and site errors", () => {
    const a = offlineAnswer(req("What am I missing?", fields));
    expect(a.answer).toContain("Committee type");
    expect(a.answer).toContain("Treasurer name");
    expect(a.answer).toContain("Enter a valid email address");
    expect(a.answer).not.toContain("Committee name,");
    expect(a.answer).not.toMatch(/Bank account number/); // sensitive values are withheld, so not "empty"
  });
  it("defines in-kind in plain English", () => {
    const a = offlineAnswer(req("What does in-kind mean?", fields));
    expect(a.answer).toMatch(/goods or services/i);
    expect(a.confidence).toBe("high");
  });
  it("asks which field when nothing matches", () => {
    expect(offlineAnswer(req("What goes in this field?", [])).confidence).toBe("low");
  });
  it("never echoes sensitive values", () => {
    for (const q of ["What goes here?", "What am I missing?", "Explain this form", "routing"]) {
      expect(JSON.stringify(offlineAnswer(req(q, fields, "f6")))).not.toContain(SECRET);
    }
  });
});

describe("copilot prompt", () => {
  it("marks focus, includes options, and withholds sensitive values", () => {
    const p = buildPrompt(req("What goes here?", fields, "f3"));
    expect(p.user).toContain(">> FOCUS [f3]");
    expect(p.user).toContain("Specific-purpose committee");
    expect(p.user).toContain("Citizens for Example PAC");
    expect(p.user).not.toContain(SECRET);
    expect(p.system).toMatch(/untrusted/i);
  });
  it("caps context size", () => {
    const many = Array.from({ length: 150 }, (_, i) => f(`x${i}`, `Field ${i} ${"lorem ".repeat(30)}`, { hint: "h".repeat(500), value: "v".repeat(400) }));
    const c = buildContext(req("Explain this form", many));
    expect(c.text.length).toBeLessThanOrEqual(CONTEXT_CHAR_CAP);
    expect(c.truncated).toBe(true);
    expect(c.text).toMatch(/omitted/);
  });
});

describe("copilot sanitizer", () => {
  it("strips values from sensitive or sensitive-looking fields", () => {
    const s = sanitizeRequest(req("q", [f("a", "Routing number", { value: SECRET }), f("b", "Notes", { name: "user_password", value: SECRET }), f("c", "SSN", { sensitive: true, value: SECRET }), f("d", "City", { value: "Austin" })]));
    expect(JSON.stringify(s)).not.toContain(SECRET);
    expect(s.context.fields.find((x) => x.id === "d")?.value).toBe("Austin");
    expect(s.context.fields.every((x) => x.id === "d" || x.sensitive)).toBe(true);
  });
});
