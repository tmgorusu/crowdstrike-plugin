import type { DetectedField, PageContext } from "../../../shared/contract";

// Plugin-internal guidance shapes. The content script and the inline card only see these; a
// guidance source (the local server today, the hub client once its contract exists) translates
// them to and from its own wire format.

export type TriggerReason = "focus" | "input" | "commit";

/** What the plugin knows about the field in use. Sensitive fields never carry a value. */
export type GuidanceQuery = {
  reason: TriggerReason;
  page: { url: string; title: string; heading?: string };
  section?: string;
  field: Pick<DetectedField, "id" | "label" | "labelSource" | "kind" | "name" | "required" | "options" | "hint" | "error" | "sensitive" | "value" | "checked">;
};

export type GuidanceView = {
  headline: string;    // one line
  steps: string[];     // at most 3 short actions
  detail?: string;     // shown only when the user expands the card
  verify: boolean;     // the source wasn't confident; nudge the user to check official instructions
  sourceLabel: string;
};

export type GuidanceResult =
  | { status: "ok"; view: GuidanceView }
  | { status: "unavailable" }
  | { status: "unauthorized" };

export type GuidanceMessage = { type: "guidance:field"; payload: GuidanceQuery };

export function buildQuery(ctx: PageContext, field: DetectedField, reason: TriggerReason): GuidanceQuery {
  const { id, label, labelSource, kind, name, required, options, hint, error, sensitive, value, checked } = field;
  return {
    reason,
    page: { url: ctx.url, title: ctx.title, heading: ctx.pageHeading },
    section: ctx.sections.find((s) => s.id === field.sectionId)?.heading,
    field: { id, label, labelSource, kind, name, required, options, hint, error, sensitive, checked, ...(sensitive ? {} : { value }) },
  };
}
