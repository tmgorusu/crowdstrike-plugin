import { useCallback, useEffect, useRef, useState } from "react";
import { buildQuery, type GuidanceMessage, type GuidanceResult, type TriggerReason } from "../guidance/types";
import { fieldIdOf, type ScanResult } from "./scanner";
import { watchFieldActivity } from "./triggers";

export type GuidanceState = { fieldId: string } & ({ status: "loading" } | GuidanceResult);

async function fetchGuidance(message: GuidanceMessage): Promise<GuidanceResult> {
  try {
    const reply = await chrome.runtime.sendMessage(message);
    return reply?.ok ? (reply.data as GuidanceResult) : { status: "unavailable" };
  } catch {
    return { status: "unavailable" }; // extension reloaded or worker gone: guidance quietly sits out
  }
}

/** Inline guidance for the field the user is working in. Only the latest request's answer is shown. */
export function useGuidance(host: HTMLElement, current: () => ScanResult | null, rescan: () => ScanResult) {
  const [state, setState] = useState<GuidanceState>();
  const seq = useRef(0);
  const last = useRef<{ sig: string; result?: GuidanceResult }>(undefined);

  const request = useCallback(async (fieldId: string, reason: TriggerReason, force = false) => {
    const scan = rescan();
    const field = scan.context.fields.find((f) => f.id === fieldId);
    if (!field) return;
    const query = buildQuery(scan.context, field, reason);
    const sig = JSON.stringify({ ...query, reason: undefined });
    const prev = last.current;
    if (!force && prev?.sig === sig && (!prev.result || prev.result.status === "ok")) {
      if (prev.result) setState({ fieldId, ...prev.result });
      return; // same field, same input: in flight or already answered
    }
    const n = ++seq.current;
    const entry: { sig: string; result?: GuidanceResult } = { sig };
    last.current = entry;
    setState({ fieldId, status: "loading" });
    const result = await fetchGuidance({ type: "guidance:field", payload: query });
    if (n !== seq.current) return;
    entry.result = result;
    setState({ fieldId, ...result });
  }, [rescan]);

  useEffect(() => watchFieldActivity({ host, resolve: (t) => fieldIdOf(t, current()), onTrigger: (id, reason) => void request(id, reason) }), [host, current, request]);

  const retry = useCallback(() => { if (state) void request(state.fieldId, "commit", true); }, [state, request]);
  return { state, retry };
}
