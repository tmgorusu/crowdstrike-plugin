import type { AssistRequest, DetectedField } from "../shared/contract";

export const SENSITIVE_PATTERN = /password|passcode|ssn|social\s*security|account\s*(number|no\b|#)|acct\s*(number|no\b|#)|routing|card\s*number|credit\s*card|cvv|cvc|\bpin\b|token|secret|tax\s*id|\bein\b|\btin\b/i;

export function isSensitiveField(f: Pick<DetectedField, "label" | "sensitive"> & { name?: string }) {
  return f.sensitive || SENSITIVE_PATTERN.test(f.label) || (f.name ? SENSITIVE_PATTERN.test(f.name) : false);
}

/** Defense in depth: drop any value the extension should not have sent. */
export function sanitizeRequest(req: AssistRequest): AssistRequest {
  return { ...req, context: { ...req.context, fields: req.context.fields.map((f) => {
    if (!isSensitiveField(f)) return f;
    const { value: _drop, ...rest } = f;
    return { ...rest, sensitive: true };
  }) } };
}
