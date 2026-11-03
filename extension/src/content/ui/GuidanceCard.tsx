import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import type { ScanResult } from "../scanner";
import type { GuidanceState } from "../useGuidance";
import { Avatar } from "./Avatar";

const W = 288;
const LOADING_DELAY = 300; // fast answers shouldn't flash a spinner

/** The field's box, plus the right edge of its form: the card sits past the form so it can't cover other inputs. */
function useFieldRect(scan: ScanResult, id: string) {
  const [rect, setRect] = useState<{ field: DOMRect; formRight: number } | null>(null);
  useEffect(() => {
    const els = scan.elements.get(id);
    const el = els && (els.length > 1 ? (els[0].closest("fieldset, [role=radiogroup]") as HTMLElement) ?? els[0] : els[0]);
    if (!el) { setRect(null); return; }
    const form = el.closest("form, [role=form]");
    const update = () => setRect(el.isConnected ? { field: el.getBoundingClientRect(), formRight: form?.getBoundingClientRect().right ?? 0 } : null);
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [scan, id]);
  return rect;
}

type Props = { scan: ScanResult; id: string; state?: GuidanceState; panelOpen: boolean; onAsk: () => void; onRetry: () => void; onDismiss: () => void };

/** Guidance beside the field in use. It never takes focus and never covers the input itself. */
export function GuidanceCard({ scan, id, state, panelOpen, onAsk, onRetry, onDismiss }: Props) {
  const box = useFieldRect(scan, id);
  const [expanded, setExpanded] = useState(false);
  const [slow, setSlow] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => { const h = cardRef.current?.offsetHeight ?? 0; if (h !== height) setHeight(h); });
  useEffect(() => setExpanded(false), [id]);
  useEffect(() => {
    setSlow(false);
    if (state?.status !== "loading") return;
    const t = window.setTimeout(() => setSlow(true), LOADING_DELAY);
    return () => window.clearTimeout(t);
  }, [state]);

  if (!box || box.field.bottom < 0 || box.field.top > window.innerHeight) return null;
  const rect = box.field;
  const cardLeft = Math.max(rect.right, box.formRight) + 8;
  const roomForCard = cardLeft + W < window.innerWidth - 8;
  const keepFocus = (e: MouseEvent) => e.preventDefault();

  // No free column beside the form, or nothing worth showing yet: the compact chip, as before.
  if (!roomForCard || !state || (state.status === "loading" && !slow)) {
    const chipRight = rect.right + 8 + 112 < window.innerWidth;
    const style = chipRight ? { left: rect.right + 8, top: rect.top + Math.max(0, rect.height / 2 - 13) } : { left: Math.max(8, rect.right - 112), top: Math.max(8, rect.top - 32) };
    return (
      <button className={`chip-float${panelOpen ? " quiet" : ""}`} style={style} onMouseDown={keepFocus} onClick={onAsk} aria-label="Ask Strike what goes in this field">
        <Avatar /> What goes here?
      </button>
    );
  }

  // Level with the field, shifted up if needed so it stays on screen.
  const style = { left: cardLeft, top: Math.max(8, Math.min(rect.top - 2, window.innerHeight - height - 8)), width: W };
  const view = state.status === "ok" ? state.view : undefined;
  const quiet = state.status === "unavailable" || state.status === "unauthorized";
  const title = view?.headline
    ?? (state.status === "loading" ? "Checking guidance…" : state.status === "unauthorized" ? "Sign in to Strike to see guidance here." : "Guidance isn't available right now. Keep going; nothing is blocked.");

  return (
    <div ref={cardRef} className={`guide${quiet ? " quiet" : ""}${view?.verify ? " verify" : ""}${panelOpen ? " dim" : ""}`} style={style} onMouseDown={keepFocus} role="note" aria-label="Strike guidance">
      <div className="guide-head">
        <Avatar />
        <p className="guide-title" aria-live="polite">{title}</p>
        <button className="icon-btn sm" onClick={onDismiss} aria-label="Hide guidance for this field" title="Hide for this field">×</button>
      </div>
      {state.status === "loading" && <div className="typing" aria-hidden><i /><i /><i /></div>}
      {view && view.steps.length > 0 && <ul className="guide-steps">{view.steps.map((s) => <li key={s}>{s}</li>)}</ul>}
      {view?.detail && expanded && <p className="guide-detail">{view.detail}</p>}
      {state.status !== "loading" && (
        <div className="guide-foot">
          {view?.detail && <button className="link" onClick={() => setExpanded((x) => !x)} aria-expanded={expanded}>{expanded ? "Less" : "More"}</button>}
          {state.status === "unavailable" ? <button className="link" onClick={onRetry}>Retry</button> : <button className="link" onClick={onAsk}>Ask Strike</button>}
          {view && <span className="guide-src">{view.sourceLabel}{view.verify ? " · verify with official instructions" : ""}</span>}
        </div>
      )}
    </div>
  );
}
