import { assistResponseSchema, type AssistRequest, type AssistResponse } from "../../../shared/contract";
import type { GuidanceSource } from "./service";
import type { GuidanceView } from "./types";

// Temporary source: the local assist server in server/. Replace with the hub client once the hub
// publishes its contract; nothing outside this file depends on the server's request shape.

const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s);
const firstSentence = (s: string, max = 160) => clip((s.trim().match(/^.+?[.!?](?=\s|$)/)?.[0] ?? s).trim(), max);

export function localServerSource(base: () => Promise<string>): GuidanceSource<AssistResponse> {
  return {
    timeoutMs: 4000,
    endpoint: async () => `${await base()}/api/copilot/assist`,
    schema: assistResponseSchema,
    // Field-level guidance from this server doesn't depend on what the user typed, so no value is sent.
    toRequest: ({ page, section, field }): AssistRequest => ({
      question: `What goes in the "${field.label}" field?`,
      focusFieldId: field.id,
      context: {
        url: page.url, title: page.title, pageHeading: page.heading, scannedAt: "",
        sections: [{ id: "s0", heading: section ?? page.heading ?? page.title }],
        fields: [{ id: field.id, label: field.label, labelSource: field.labelSource, kind: field.kind, name: field.name, required: field.required, options: field.options, hint: field.hint, error: field.error, sensitive: field.sensitive, sectionId: "s0" }],
      },
    }),
    toView: (r): GuidanceView | null => {
      const headline = firstSentence(r.answer, 140);
      if (!headline) return null;
      const steps = [
        r.whatGoesHere && firstSentence(r.whatGoesHere),
        r.officialSource && `Source: ${firstSentence(r.officialSource, 140)}`,
        r.example && `Example: ${clip(r.example, 120)}`,
      ].filter((s): s is string => Boolean(s)).slice(0, 3);
      const detail = [r.whyItMatters, r.jurisdictionNote].filter(Boolean).join(" ");
      return { headline, steps, detail: detail || undefined, verify: r.confidence !== "high", sourceLabel: r.source === "ai" ? "AI guidance" : "Built-in guidance" };
    },
  };
}
