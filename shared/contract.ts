// Shared data contract between the Chrome extension (extension/) and the assist server
// (server/). Keep this file free of Node- and browser-only imports: it is
// bundled into the extension by esbuild and imported by the server.
import { z } from "zod";

export const FIELD_KINDS = ["text", "email", "tel", "number", "date", "url", "textarea", "select", "checkbox", "radio", "other"] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

/** One user-facing question on the page. Radio buttons sharing a name collapse into one field. */
export type DetectedField = {
  id: string;                 // stable id assigned by the scanner (not the element id)
  label: string;              // best human label found; never empty (falls back to name/placeholder)
  labelSource: "label" | "aria-labelledby" | "aria-label" | "legend" | "placeholder" | "title" | "nearby-text" | "name";
  kind: FieldKind;
  name?: string;
  placeholder?: string;
  required: boolean;
  options?: string[];         // select options / radio choices
  value?: string;             // current value; omitted for sensitive fields
  checked?: boolean;          // checkbox state
  sensitive: boolean;         // bank/SSN/password-like: value never leaves the page
  hint?: string;              // nearby help text or aria-describedby
  error?: string;             // validation message the site is showing
  sectionId: string;
};

export type FormSection = { id: string; heading: string; instructions?: string };

export type PageContext = {
  url: string;                // origin + path only; query and hash are stripped
  title: string;
  pageHeading?: string;
  sections: FormSection[];
  fields: DetectedField[];
  scannedAt: string;
};

export type AssistRequest = {
  question: string;
  focusFieldId?: string;      // the field the user clicked / asked about
  context: PageContext;
  history?: { role: "user" | "assistant"; text: string }[];
};

/** Structured answer the panel renders. Every field is optional except answer and source. */
export type AssistResponse = {
  answer: string;                       // 1-4 sentence plain-English answer
  fieldId?: string;                     // field the answer is about, if any
  whatGoesHere?: string;                // what to enter
  example?: string;                     // illustrative example (clearly fictional)
  whyItMatters?: string;
  officialSource?: string;              // where the value must come from (e.g. bank statement)
  jurisdictionNote?: string;            // federal vs state vs local caveat
  needsInfo?: string[];                 // facts the assistant needs before it can be specific
  followUps?: string[];                 // suggested next questions
  confidence: "high" | "medium" | "low";
  source: "ai" | "offline";             // offline = built-in guidance, no model call
  model?: string;
  notice?: string;                      // set when the server fell back to offline guidance
};

const MAX = { label: 200, value: 500, hint: 600, fields: 150, sections: 40, question: 800 };
const short = (n: number) => z.string().max(n * 4).transform((s) => s.slice(0, n));

export const assistRequestSchema = z.object({
  question: z.string().trim().min(1).max(MAX.question),
  focusFieldId: z.string().max(80).optional(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: short(1200) })).max(8).optional(),
  context: z.object({
    url: short(300),
    title: short(200),
    pageHeading: short(200).optional(),
    scannedAt: z.string().max(40),
    sections: z.array(z.object({ id: z.string().max(80), heading: short(MAX.label), instructions: short(MAX.hint).optional() })).max(MAX.sections),
    fields: z.array(z.object({
      id: z.string().max(80),
      label: short(MAX.label),
      labelSource: z.enum(["label", "aria-labelledby", "aria-label", "legend", "placeholder", "title", "nearby-text", "name"]),
      kind: z.enum(FIELD_KINDS),
      name: short(120).optional(),
      placeholder: short(MAX.label).optional(),
      required: z.boolean(),
      options: z.array(short(120)).max(60).optional(),
      value: short(MAX.value).optional(),
      checked: z.boolean().optional(),
      sensitive: z.boolean(),
      hint: short(MAX.hint).optional(),
      error: short(MAX.label).optional(),
      sectionId: z.string().max(80),
    })).max(MAX.fields),
  }),
});

export const assistResponseSchema = z.object({
  answer: z.string(),
  fieldId: z.string().optional(),
  whatGoesHere: z.string().optional(),
  example: z.string().optional(),
  whyItMatters: z.string().optional(),
  officialSource: z.string().optional(),
  jurisdictionNote: z.string().optional(),
  needsInfo: z.array(z.string()).optional(),
  followUps: z.array(z.string()).optional(),
  confidence: z.enum(["high", "medium", "low"]),
  source: z.enum(["ai", "offline"]),
  model: z.string().optional(),
  notice: z.string().optional(),
});

// Messages between content script and service worker.
export type ExtensionMessage =
  | { type: "copilot:assist"; payload: AssistRequest }
  | { type: "copilot:health" };
export type ExtensionReply<T> = { ok: true; data: T } | { ok: false; error: string };
