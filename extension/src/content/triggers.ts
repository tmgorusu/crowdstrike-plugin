import type { TriggerReason } from "../guidance/types";

type Options = {
  host: Element;
  resolve: (target: EventTarget | null) => string | undefined;
  onTrigger: (fieldId: string, reason: TriggerReason) => void;
  typingMs?: number;
  focusMs?: number;
};

const immediate = (t: EventTarget | null) => t instanceof HTMLSelectElement || (t instanceof HTMLInputElement && (t.type === "checkbox" || t.type === "radio"));

/** Reports when guidance for a field should refresh: shortly after focus (so tabbing through a form
 *  stays cheap), right away on a committed change, and after a pause in typing. */
export function watchFieldActivity({ host, resolve, onTrigger, typingMs = 700, focusMs = 150 }: Options) {
  let pending: { id: string; reason: TriggerReason; timer: number } | undefined;
  const cancel = () => { if (pending) window.clearTimeout(pending.timer); pending = undefined; };
  const later = (id: string, reason: TriggerReason, ms: number) => {
    cancel();
    pending = { id, reason, timer: window.setTimeout(() => { pending = undefined; onTrigger(id, reason); }, ms) };
  };
  const idOf = (e: Event) => (host.contains(e.target as Node) ? undefined : resolve(e.target));

  const onFocus = (e: Event) => { const id = idOf(e); if (id) later(id, "focus", focusMs); };
  const onInput = (e: Event) => { const id = idOf(e); if (id && !immediate(e.target)) later(id, "input", typingMs); };
  const onChange = (e: Event) => { const id = idOf(e); if (id) { cancel(); onTrigger(id, "commit"); } };
  // Leaving a field flushes unfinished typing; a field the user only tabbed through gets nothing.
  const onBlur = (e: Event) => {
    const id = idOf(e);
    if (!id || pending?.id !== id) return;
    const typed = pending.reason === "input";
    cancel();
    if (typed) onTrigger(id, "commit");
  };

  document.addEventListener("focusin", onFocus, true);
  document.addEventListener("input", onInput, true);
  document.addEventListener("change", onChange, true);
  document.addEventListener("focusout", onBlur, true);
  return () => {
    cancel();
    document.removeEventListener("focusin", onFocus, true);
    document.removeEventListener("input", onInput, true);
    document.removeEventListener("change", onChange, true);
    document.removeEventListener("focusout", onBlur, true);
  };
}
