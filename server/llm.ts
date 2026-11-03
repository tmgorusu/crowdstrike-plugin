import { assistResponseSchema, type AssistRequest, type AssistResponse } from "../shared/contract";
import { buildPrompt } from "./prompt";

export class CopilotNotConfiguredError extends Error { code = "copilot_not_configured" as const; }

export function copilotModelConfig() {
  const key = process.env.OPENAI_API_KEY ?? "", model = process.env.COPILOT_MODEL ?? "";
  return key.length > 0 && model.length > 0 ? { key, model } : null;
}

const str = { type: ["string", "null"] }, list = { type: ["array", "null"], items: { type: "string" } };
const props = { answer: { type: "string" }, fieldId: str, whatGoesHere: str, example: str, whyItMatters: str, officialSource: str, jurisdictionNote: str, needsInfo: list, followUps: list, confidence: { type: "string", enum: ["high", "medium", "low"] } };
export const RESPONSE_JSON_SCHEMA = { type: "object", additionalProperties: false, required: Object.keys(props), properties: props };

function outputText(payload: any): string {
  if (typeof payload.output_text === "string") return payload.output_text;
  for (const item of payload.output ?? []) for (const part of item.content ?? []) if (part.type === "output_text" && typeof part.text === "string") return part.text;
  throw new Error("Model returned no structured output.");
}

export async function askModel(req: AssistRequest): Promise<AssistResponse> {
  const cfg = copilotModelConfig();
  if (!cfg) throw new CopilotNotConfiguredError("Copilot AI needs OPENAI_API_KEY and COPILOT_MODEL.");
  const { system, user } = buildPrompt(req);
  const r = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${cfg.key}` }, body: JSON.stringify({
    model: cfg.model, store: false, max_output_tokens: 1200,
    input: [{ role: "system", content: system }, { role: "user", content: user }],
    text: { format: { type: "json_schema", name: "copilot_assist_response", strict: true, schema: RESPONSE_JSON_SCHEMA } },
  }), signal: AbortSignal.timeout(30000) });
  const payload: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Model request failed (${r.status}).`);
  const raw = JSON.parse(outputText(payload));
  const clean = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== null && !(Array.isArray(v) && v.length === 0)));
  if (clean.fieldId && !req.context.fields.some((f) => f.id === clean.fieldId)) delete clean.fieldId;
  return assistResponseSchema.parse({ ...clean, source: "ai", model: cfg.model });
}
