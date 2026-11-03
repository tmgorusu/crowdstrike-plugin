import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AssistRequest, AssistResponse, DetectedField, ExtensionMessage, ExtensionReply } from "../../../../shared/contract";
import { reviewForm, type ReviewItem } from "../review";
import { useScan } from "../useScan";
import { fieldIdOf, type ScanResult } from "../scanner";

type Msg =
  | { role: "user"; text: string }
  | { role: "assistant"; data: AssistResponse }
  | { role: "note"; text: string }
  | { role: "error"; text: string; retry: { question: string; focusFieldId?: string } };
type Mode = "checking" | "ai" | "offline-guidance" | "unreachable";

async function ask<T>(message: ExtensionMessage): Promise<ExtensionReply<T>> {
  try {
    const reply = await chrome.runtime.sendMessage(message);
    return reply ?? { ok: false, error: "No response from the extension. Reload the page and try again." };
  } catch {
    return { ok: false, error: "Strike was updated or restarted. Reload this page to reconnect." };
  }
}

const KIND_LABEL: Record<string, string> = { text: "Text", email: "Email", tel: "Phone", number: "Number", date: "Date", url: "Web address", textarea: "Long text", select: "Dropdown", checkbox: "Checkbox", radio: "Choice", other: "Input" };

export function App({ host, onToggleRequest }: { host: HTMLElement; onToggleRequest: (fn: () => void) => () => void }) {
  const { scan, rescan, focusId, setFocusId } = useScan(host);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"chat" | "review">("chat");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("checking");
  const [highlight, setHighlight] = useState<DOMRect | null>(null);
  const [chipFor, setChipFor] = useState<string>();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => onToggleRequest(() => setOpen((o) => !o)), [onToggleRequest]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [msgs, busy]);
  useEffect(() => {
    if (!open || mode !== "checking") return;
    void ask<{ ok: boolean; ai: boolean }>({ type: "copilot:health" }).then((r) => setMode(r.ok ? (r.data.ai ? "ai" : "offline-guidance") : "unreachable"));
  }, [open, mode]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && open && e.composedPath().includes(host)) setOpen(false); };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, host]);

  const fields = scan?.context.fields ?? [];
  const byId = useMemo(() => new Map(fields.map((f) => [f.id, f])), [fields]);
  const focusField = focusId ? byId.get(focusId) : undefined;
  const review = useMemo(() => (scan ? reviewForm(scan) : null), [scan]);
  const pageName = scan?.context.pageHeading || scan?.context.title || "this page";

  const locate = useCallback((id: string) => {
    const el = scan?.elements.get(id)?.[0];
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    window.setTimeout(() => {
      const els = scan!.elements.get(id)!;
      const target = els.length > 1 ? (el.closest("fieldset, [role=radiogroup]") as HTMLElement) ?? el.parentElement! : (el.closest("label") as HTMLElement) ?? el;
      setHighlight(target.getBoundingClientRect());
      window.setTimeout(() => setHighlight(null), 1800);
    }, 450);
    setFocusId(id);
  }, [scan, setFocusId]);

  const send = useCallback(async (question: string, focusFieldId?: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const fresh: ScanResult = rescan();
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setBusy(true);
    const history = msgs.flatMap((m): NonNullable<AssistRequest["history"]> => (m.role === "user" ? [{ role: "user", text: m.text }] : m.role === "assistant" ? [{ role: "assistant", text: m.data.answer }] : [])).slice(-6);
    const payload: AssistRequest = { question: q, focusFieldId, context: fresh.context, history };
    const reply = await ask<AssistResponse>({ type: "copilot:assist", payload });
    setBusy(false);
    if (reply.ok) {
      setMsgs((m) => [...m, { role: "assistant", data: reply.data }]);
      if (mode === "checking" || mode === "unreachable") setMode(reply.data.source === "ai" ? "ai" : "offline-guidance");
    } else {
      setMsgs((m) => [...m, { role: "error", text: reply.error, retry: { question: q, focusFieldId } }]);
      if (/can't reach/i.test(reply.error)) setMode("unreachable");
    }
  }, [busy, msgs, mode, rescan]);

  const askAboutField = useCallback((id?: string) => {
    const f = id ? byId.get(id) : undefined;
    setOpen(true);
    setTab("chat");
    if (!f) { setMsgs((m) => [...m, { role: "note", text: "Click into any field on the page, then ask again. I'll explain exactly what belongs there." }]); return; }
    void send(`What goes in the "${f.label}" field?`, f.id);
  }, [byId, send]);

  const quick = (action: string) => {
    if (action === "explain") void send("Explain this form: what is it for and what will I need to complete it?");
    else if (action === "field") askAboutField(focusId);
    else { rescan(); setTab("review"); }
  };

  const suggestions = useMemo(() => {
    const picks = fields.filter((f) => f.required && (f.kind === "select" || f.kind === "radio")).slice(0, 2).map((f) => ({ text: `What should I choose for "${f.label}"?`, id: f.id }));
    const jargon = fields.find((f) => /treasurer|connected|in-kind|aggregate|depository|custodian|coverage/i.test(f.label));
    if (jargon && !picks.some((p) => p.id === jargon.id)) picks.push({ text: `What does "${jargon.label}" mean?`, id: jargon.id });
    return picks;
  }, [fields]);

  // Field chip: a small "Ask Strike" tag beside the focused field. It never covers the input itself.
  useEffect(() => {
    const onIn = (e: FocusEvent) => { const id = fieldIdOf(e.target, scanRef.current); if (id) setChipFor(id); };
    const onOut = (e: FocusEvent) => { if (!host.contains(e.relatedTarget as Node)) window.setTimeout(() => setChipFor(undefined), 150); };
    document.addEventListener("focusin", onIn, true);
    document.addEventListener("focusout", onOut, true);
    return () => { document.removeEventListener("focusin", onIn, true); document.removeEventListener("focusout", onOut, true); };
  }, [host]);
  useEffect(() => { if (focusId) setChipFor(focusId); }, [focusId]);
  const scanRef = useRef(scan);
  scanRef.current = scan;

  const count = fields.length;
  const missingCount = review?.missing.length ?? 0;

  return (
    <div className="root">
      {chipFor && scan && <FieldChip scan={scan} id={chipFor} panelOpen={open} onAsk={() => askAboutField(chipFor)} />}
      {highlight && <div className="highlight" style={{ left: highlight.left - 6, top: highlight.top - 6, width: highlight.width + 12, height: highlight.height + 12 }} />}

      {open && (
        <section className="panel" role="dialog" aria-label="Strike compliance copilot">
          <header className="head">
            <Avatar />
            <div className="who">
              <strong>Strike</strong>
              <span className={`mode ${mode}`}>{mode === "ai" ? "AI copilot" : mode === "offline-guidance" ? "Built-in guidance" : mode === "unreachable" ? "Service offline" : "Connecting…"}</span>
            </div>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Minimize assistant" title="Minimize (Esc)">
              <svg viewBox="0 0 20 20" width="16" height="16"><path d="M5 10h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </header>

          <div className="page-id" title={scan?.context.url}>
            <span className="page-dot" aria-hidden />
            <span className="page-name">{pageName}</span>
            <span className="page-meta">{count ? `${count} field${count === 1 ? "" : "s"} · ${scan!.context.sections.length} section${scan!.context.sections.length === 1 ? "" : "s"}` : "No form detected"}</span>
          </div>

          <nav className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === "chat"} className={tab === "chat" ? "on" : ""} onClick={() => setTab("chat")}>Ask</button>
            <button role="tab" aria-selected={tab === "review"} className={tab === "review" ? "on" : ""} onClick={() => { rescan(); setTab("review"); }}>
              Review{missingCount > 0 && <span className="pill">{missingCount}</span>}
            </button>
          </nav>

          {tab === "chat" ? (
            <>
              <div className="msgs" ref={listRef} aria-live="polite">
                <div className="bubble bot greet">
                  <p>Hi, I'm Strike. {count ? <>I can see <b>{count} fields</b> on <b>{pageName}</b>.</> : <>I don't see a form on this page yet. Open a form section and I'll pick it up.</>} Ask me what any field means or what belongs in it.</p>
                  <p className="fine">I explain and flag issues. You stay in control. I never fill in or submit anything.</p>
                </div>
                {msgs.length === 0 && count > 0 && (
                  <div className="chips">
                    <button onClick={() => quick("explain")}>Explain this form</button>
                    <button onClick={() => quick("field")}>What goes in this field?</button>
                    <button onClick={() => quick("missing")}>What am I missing?</button>
                    <button onClick={() => quick("review")}>Review my entries</button>
                    {suggestions.map((s) => <button key={s.id} className="soft" onClick={() => void send(s.text, s.id)}>{s.text}</button>)}
                  </div>
                )}
                {msgs.map((m, i) => (
                  m.role === "user" ? <div key={i} className="bubble me">{m.text}</div>
                  : m.role === "note" ? <div key={i} className="bubble bot"><p>{m.text}</p></div>
                  : m.role === "error" ? (
                    <div key={i} className="bubble err" role="alert">
                      <p>{m.text}</p>
                      <button className="link" onClick={() => void send(m.retry.question, m.retry.focusFieldId)}>Try again</button>
                    </div>
                  ) : <Answer key={i} data={m.data} field={m.data.fieldId ? byId.get(m.data.fieldId) : undefined} onLocate={locate} onFollow={(q) => void send(q, m.data.fieldId)} />
                ))}
                {busy && <div className="bubble bot typing" aria-label="Strike is thinking"><i /><i /><i /></div>}
              </div>

              {focusField && (
                <div className="focus-bar">
                  <div>
                    <span className="focus-k">Field</span> <b>{focusField.label}</b>
                    <span className="focus-meta">{KIND_LABEL[focusField.kind]}{focusField.required ? " · Required" : ""}{focusField.sensitive ? " · Private" : ""}</span>
                  </div>
                  <button className="mini" disabled={busy} onClick={() => askAboutField(focusField.id)}>What goes here?</button>
                  <button className="icon-btn sm" aria-label="Stop asking about this field" onClick={() => setFocusId(undefined)}>×</button>
                </div>
              )}

              <form className="composer" onSubmit={(e) => { e.preventDefault(); void send(input, focusField?.id); }}>
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  placeholder={focusField ? `Ask about "${focusField.label}"…` : "Ask about this form…"}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input, focusField?.id); } }}
                  maxLength={800}
                  aria-label="Ask Strike a question"
                />
                <button type="submit" className="send" disabled={busy || !input.trim()} aria-label="Send">
                  <svg viewBox="0 0 20 20" width="16" height="16"><path d="M3 10l14-7-5 14-2-6-7-1z" fill="currentColor" /></svg>
                </button>
              </form>
            </>
          ) : (
            <ReviewPane scan={scan} review={review} onLocate={locate} onRescan={rescan} onAsk={(item) => { setTab("chat"); void send(`What goes in the "${item.label}" field?`, item.fieldId); }} />
          )}
          <footer className="foot">Guidance only, not legal advice. Confirm with your filing office.</footer>
        </section>
      )}

      <button className={`launcher${open ? " open" : ""}`} onClick={() => setOpen((o) => !o)} aria-label={open ? "Close Strike" : `Open Strike compliance copilot${count ? `, ${count} fields detected` : ""}`} aria-expanded={open}>
        <Avatar large />
        {!open && count > 0 && <span className="badge" aria-hidden>{missingCount > 0 ? missingCount : "✓"}</span>}
      </button>
    </div>
  );
}

function Avatar({ large }: { large?: boolean }) {
  const s = large ? 30 : 26;
  return (
    <span className={`avatar${large ? " lg" : ""}`} aria-hidden>
      <svg viewBox="0 0 32 32" width={s} height={s}>
        <path d="M16 4l3.4 7.6L27 13l-5.8 5.2L22.8 26 16 22l-6.8 4 1.6-7.8L5 13l7.6-1.4z" fill="#F4B740" />
        <circle cx="12.8" cy="15.6" r="1.4" fill="#13294B" /><circle cx="19.2" cy="15.6" r="1.4" fill="#13294B" />
        <path d="M13 19c1.8 1.4 4.2 1.4 6 0" stroke="#13294B" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function Answer({ data, field, onLocate, onFollow }: { data: AssistResponse; field?: DetectedField; onLocate: (id: string) => void; onFollow: (q: string) => void }) {
  const rows: [string, string | undefined][] = [
    ["What to enter", data.whatGoesHere],
    ["Example", data.example],
    ["Why it's needed", data.whyItMatters],
    ["Where it comes from", data.officialSource],
    ["Jurisdiction", data.jurisdictionNote],
  ];
  return (
    <div className="bubble bot answer">
      {field && <button className="field-tag" onClick={() => onLocate(field.id)} title="Show this field on the page">{field.label} <span aria-hidden>↗</span></button>}
      <p>{data.answer}</p>
      {rows.filter(([, v]) => v).map(([k, v]) => <div key={k} className={`row ${k === "Example" ? "ex" : ""}`}><span className="k">{k}</span><span className="v">{v}</span></div>)}
      {data.needsInfo?.length ? <div className="needs"><span className="k">To be specific, I'd need to know</span><ul>{data.needsInfo.map((n) => <li key={n}>{n}</li>)}</ul></div> : null}
      {data.followUps?.length ? <div className="chips inline">{data.followUps.slice(0, 3).map((q) => <button key={q} className="soft" onClick={() => onFollow(q)}>{q}</button>)}</div> : null}
      <div className="meta">
        <span className={`src ${data.source}`}>{data.source === "ai" ? "AI" : "Built-in guidance"}</span>
        {data.confidence !== "high" && <span className={`conf ${data.confidence}`}>{data.confidence === "low" ? "Low confidence: verify" : "Verify with official instructions"}</span>}
        {data.notice && <span className="conf low">{data.notice}</span>}
      </div>
    </div>
  );
}

function ReviewPane({ scan, review, onLocate, onRescan, onAsk }: { scan: ScanResult | null; review: ReturnType<typeof reviewForm> | null; onLocate: (id: string) => void; onRescan: () => void; onAsk: (i: ReviewItem) => void }) {
  if (!scan || !review || scan.context.fields.length === 0) return <div className="review empty"><p>No form fields detected on this page yet.</p><button className="mini" onClick={onRescan}>Scan again</button></div>;
  const pct = review.requiredTotal ? Math.round((review.requiredDone / review.requiredTotal) * 100) : 100;
  const group = (title: string, items: ReviewItem[], tone: string) => items.length > 0 && (
    <div className={`group ${tone}`}>
      <h4>{title} <span>{items.length}</span></h4>
      <ul>{items.map((i, n) => (
        <li key={i.fieldId + n}>
          <button className="item" onClick={() => onLocate(i.fieldId)}>
            <b>{i.label}</b><span>{i.message}</span><em>{i.section}</em>
          </button>
          <button className="ask" onClick={() => onAsk(i)} title="Ask what goes here">?</button>
        </li>
      ))}</ul>
    </div>
  );
  return (
    <div className="review">
      <div className="progress">
        <div className="progress-top"><b>{review.requiredDone} of {review.requiredTotal}</b> required fields complete<button className="link" onClick={onRescan}>Rescan</button></div>
        <div className="bar"><i style={{ width: `${pct}%` }} /></div>
      </div>
      {review.ready && review.warnings.length === 0 && <div className="ok-box">All required fields on this page are filled in and the site shows no errors.</div>}
      {group("Missing required information", review.missing, "bad")}
      {group("Errors shown by the site", review.siteErrors, "bad")}
      {group("Worth a second look", review.warnings, "warn")}
      <div className="group check">
        <h4>Before you submit</h4>
        <ul className="checklist">
          <li>Names, addresses and account details match official records (bank statements, appointment paperwork).</li>
          <li>Committee type and filing period match your registration with the filing office (FEC, state or local).</li>
          <li>Totals tie to your books for the coverage period.</li>
          <li>You review and submit the form yourself. Strike never submits for you.</li>
        </ul>
      </div>
    </div>
  );
}

function FieldChip({ scan, id, panelOpen, onAsk }: { scan: ScanResult; id: string; panelOpen: boolean; onAsk: () => void }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    const els = scan.elements.get(id);
    const el = els && (els.length > 1 ? (els[0].closest("fieldset, [role=radiogroup]") as HTMLElement) ?? els[0] : els[0]);
    if (!el) { setRect(null); return; }
    const update = () => setRect(el.isConnected ? el.getBoundingClientRect() : null);
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [scan, id]);
  if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) return null;
  const W = 112;
  // Prefer the right edge of the field; flip above it if the right side would leave the viewport.
  const right = rect.right + 8 + W < window.innerWidth;
  const style = right ? { left: rect.right + 8, top: rect.top + Math.max(0, rect.height / 2 - 13) } : { left: Math.max(8, rect.right - W), top: Math.max(8, rect.top - 32) };
  return (
    <button className={`chip-float${panelOpen ? " quiet" : ""}`} style={style} onMouseDown={(e) => e.preventDefault()} onClick={onAsk} aria-label="Ask Strike what goes in this field">
      <Avatar /> What goes here?
    </button>
  );
}
