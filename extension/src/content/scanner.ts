import type { DetectedField, FieldKind, FormSection, PageContext } from "../../../shared/contract";

// Reads the page's form structure without changing it. Everything here is read-only DOM work.

export type ScanResult = {
  context: PageContext;
  elements: Map<string, HTMLElement[]>; // field id -> backing controls (radios share one id)
  filled: Map<string, boolean>;         // tracked locally so sensitive values never leave the page
};

const SKIP_TYPES = new Set(["hidden", "submit", "button", "reset", "image", "file", "search"]);
const NOISE = "nav, footer, aside, header, [role=navigation], [role=search], [role=banner], [role=contentinfo], [aria-hidden=true]";
const SENSITIVE = /pass(word|code)|\bpin\b|ssn|social security|account\s*(number|no\.?|#)|acct|routing|aba\b|card\s*(number|no)|cvv|cvc|security code|token|secret|tax\s*id|\btin\b/i;
const HEADING = "h1, h2, h3, h4, h5, h6, [role=heading], legend";
const ERROR_CLASS = /(^|[\s_-])(error|invalid|danger|field-error|validation)([\s_-]|$)/i;

const ids = new WeakMap<Element, string>();
let nextId = 1;
function idFor(el: Element) {
  let id = ids.get(el);
  if (!id) { id = `f${nextId++}`; ids.set(el, id); }
  return id;
}

const clean = (s: string | null | undefined, max = 200) =>
  (s ?? "").replace(/\s+/g, " ").replace(/\s*\*+\s*$/, "").replace(/^\s*\*+\s*/, "").trim().slice(0, max);

function textOf(el: Element | null, exclude?: Element): string {
  if (!el) return "";
  const copy = el.cloneNode(true) as Element;
  // Drop the control's own text (selects list options inside a wrapping label) and error/help noise.
  copy.querySelectorAll("input, select, textarea, script, style, option, [role=alert], .sr-only-ignore").forEach((n) => n.remove());
  if (exclude && el.contains(exclude)) copy.querySelectorAll("select, textarea").forEach((n) => n.remove());
  return copy.textContent ?? "";
}

function visible(el: HTMLElement) {
  if (el.closest("[hidden], [aria-hidden=true]")) return false;
  const style = getComputedStyle(el);
  const toggle = el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox");
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = el.getBoundingClientRect();
  if ((rect.width < 2 && rect.height < 2) || (toggle && Number(style.opacity) === 0)) {
    // Native radios/checkboxes are often visually replaced; trust their label instead.
    const lbl = (el as HTMLInputElement).labels?.[0];
    if (!lbl || lbl.getBoundingClientRect().width < 2) return false;
  }
  // Off-screen honeypots.
  if (rect.right + window.scrollX < -500 || rect.bottom + window.scrollY < -500) return false;
  return true;
}

function kindOf(el: HTMLElement): FieldKind {
  if (el instanceof HTMLSelectElement) return "select";
  if (el instanceof HTMLTextAreaElement) return "textarea";
  const t = (el as HTMLInputElement).type;
  if (t === "checkbox" || t === "radio" || t === "email" || t === "tel" || t === "number" || t === "date" || t === "url") return t;
  if (t === "month" || t === "datetime-local") return "date";
  if (t === "text" || t === "password" || t === "" ) return "text";
  return "other";
}

function byIds(list: string | null) {
  return (list ?? "").split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
}

/** Text immediately before the control: preceding sibling text, or the previous table cell. */
function nearbyText(el: HTMLElement): string {
  let node: Node | null = el;
  for (let depth = 0; node && depth < 3; depth++) {
    let sib: Node | null = node.previousSibling;
    while (sib) {
      // Text belonging to another control (its own label, or a wrapper around it) is not ours.
      if (sib instanceof HTMLElement && (sib.matches("input, select, textarea, button, label[for]") || sib.querySelector("input, select, textarea"))) break;
      const t = clean(sib instanceof Element ? textOf(sib) : sib.textContent);
      if (t && t.length <= 120) return t;
      sib = sib.previousSibling;
    }
    const parent: HTMLElement | null = (node as HTMLElement).parentElement;
    if (parent?.matches("td, th")) {
      const prev = parent.previousElementSibling;
      const t = clean(textOf(prev));
      if (t) return t;
    }
    node = parent;
  }
  return "";
}

function resolveLabel(el: HTMLElement): { label: string; source: DetectedField["labelSource"]; raw: string } {
  const tryText = (raw: string, source: DetectedField["labelSource"]) => (clean(raw) ? { label: clean(raw), source, raw } : null);
  const labelled = byIds(el.getAttribute("aria-labelledby")).map((n) => textOf(n)).join(" ");
  const labels = (el as HTMLInputElement).labels ? Array.from((el as HTMLInputElement).labels!) : [];
  return (
    tryText(labelled, "aria-labelledby") ??
    tryText(labels.map((l) => textOf(l, el)).join(" "), "label") ??
    tryText(el.getAttribute("aria-label") ?? "", "aria-label") ??
    tryText(el.getAttribute("title") ?? "", "title") ??
    tryText(el.getAttribute("placeholder") ?? "", "placeholder") ??
    tryText(nearbyText(el), "nearby-text") ??
    { label: humanize(el.getAttribute("name") || el.id || "Unlabeled field"), source: "name", raw: "" }
  );
}

const cssEscape = (s: string) => (typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(s) : s.replace(/["\\]/g, "\\$&"));
const humanize = (s: string) => s.replace(/[_\-[\].]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim().replace(/^./, (c) => c.toUpperCase());

/** Radio groups without a fieldset: the text that precedes the group container. */
function groupLabel(radios: HTMLInputElement[]): { label: string; source: DetectedField["labelSource"] } | null {
  const first = radios[0];
  const group = first.closest("[role=radiogroup]");
  if (group) {
    const t = clean(byIds(group.getAttribute("aria-labelledby")).map((n) => textOf(n)).join(" ") || group.getAttribute("aria-label"));
    if (t) return { label: t, source: group.hasAttribute("aria-labelledby") ? "aria-labelledby" : "aria-label" };
  }
  const fs = first.closest("fieldset");
  if (fs && radios.every((r) => fs.contains(r))) {
    const t = clean(textOf(fs.querySelector(":scope > legend")));
    if (t) return { label: t, source: "legend" };
  }
  // Smallest ancestor holding every radio; take its leading text, else the text right before it.
  let box: HTMLElement | null = first.parentElement;
  while (box && !radios.every((r) => box!.contains(r))) box = box.parentElement;
  if (box) {
    for (const child of Array.from(box.childNodes)) {
      if (child instanceof HTMLElement && (child.matches("input, label") || child.querySelector("input"))) break;
      const t = clean(child instanceof Element ? textOf(child) : child.textContent);
      if (t) return { label: t, source: "nearby-text" };
    }
    const t = nearbyText(box);
    if (t) return { label: t, source: "nearby-text" };
  }
  return null;
}

function isRequired(el: HTMLElement, rawLabel: string) {
  if ((el as HTMLInputElement).required || el.getAttribute("aria-required") === "true") return true;
  if (/\*\s*$|^\s*\*|\(required\)/i.test(rawLabel)) return true;
  const lbl = (el as HTMLInputElement).labels?.[0];
  return Boolean(lbl?.querySelector(".required, .req, abbr[title*=required i]") || /\*/.test(lbl?.textContent ?? ""));
}

/** Elements that belong to this control alone: its wrapper if it holds only this question,
 *  otherwise the siblings that follow it up to the next control (flat, poorly structured forms). */
function ownNodes(el: HTMLElement, selector: string): HTMLElement[] {
  const anchor = (el.closest("label") as HTMLElement | null) ?? el;
  const wrap = anchor.parentElement;
  if (wrap && questionCount(wrap) <= 1) return Array.from(wrap.querySelectorAll<HTMLElement>(selector)).filter((n) => !n.contains(el));
  const out: HTMLElement[] = [];
  for (let sib = anchor.nextElementSibling; sib; sib = sib.nextElementSibling) {
    if (sib.matches("input, select, textarea, label, " + HEADING) || sib.querySelector("input, select, textarea")) break;
    if (sib.matches(selector)) out.push(sib as HTMLElement);
    out.push(...Array.from(sib.querySelectorAll<HTMLElement>(selector)));
  }
  return out;
}

function hintFor(el: HTMLElement): string | undefined {
  const described = byIds(el.getAttribute("aria-describedby")).filter((n) => !isErrorNode(n)).map((n) => n.textContent).join(" ");
  if (clean(described)) return clean(described, 400);
  const help = ownNodes(el, "small, .help, .hint, .help-text, .form-text, .description").find((n) => !isErrorNode(n));
  if (help) return clean(help.textContent, 400) || undefined;
}

function isErrorNode(n: Element) {
  return n.getAttribute("role") === "alert" || ERROR_CLASS.test(n.className?.toString() ?? "") || n.getAttribute("aria-live") === "assertive";
}

function errorFor(el: HTMLElement): string | undefined {
  const msg = byIds(el.getAttribute("aria-errormessage")).concat(byIds(el.getAttribute("aria-describedby")).filter(isErrorNode));
  const fromAria = clean(msg.map((n) => (visible(n) ? n.textContent : "")).join(" "));
  if (fromAria) return fromAria;
  // Error text rendered next to the control by the site.
  const hit = ownNodes(el, "[role=alert], .error, .invalid-feedback, .field-error, .error-message, .errors").find((n) => visible(n) && clean(n.textContent));
  if (hit) return clean(hit.textContent);
  if (el.getAttribute("aria-invalid") === "true" && (el as HTMLInputElement).validationMessage) return clean((el as HTMLInputElement).validationMessage);
}

function scanRoots(host: Element | null): HTMLElement[] {
  const forms = Array.from(document.querySelectorAll<HTMLElement>("form, [role=form]")).filter((f) => !host?.contains(f) && !f.closest(NOISE) && f.querySelector("input, select, textarea"));
  if (forms.length) return forms;
  const main = document.querySelector<HTMLElement>("main, [role=main]");
  return [main ?? document.body];
}

function controlsIn(root: HTMLElement, host: Element | null) {
  const insideForm = root.matches("form, [role=form]");
  return Array.from(root.querySelectorAll<HTMLElement>("input, select, textarea")).filter((el) => {
    if (host?.contains(el)) return false;
    if (el instanceof HTMLInputElement && SKIP_TYPES.has(el.type)) return false;
    if ((el as HTMLInputElement).disabled && !(el as HTMLInputElement).value) return false;
    if (el.tabIndex < 0 && el.getAttribute("autocomplete") === "off" && !el.closest("label")) return false; // honeypot pattern
    if (!insideForm && el.closest(NOISE)) return false;
    return visible(el);
  });
}

function sectionsFor(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(HEADING)).filter((h) => visible(h) && clean(h.textContent));
}

function questionCount(box: Element) {
  const radios = new Set(Array.from(box.querySelectorAll<HTMLInputElement>("input[type=radio]")).map((r) => r.name || r));
  return box.querySelectorAll("select, textarea, input:not([type=radio]):not([type=hidden]):not([type=submit]):not([type=button])").length + radios.size;
}

function instructionsAfter(h: HTMLElement): string | undefined {
  const target = h.nextElementSibling;
  if (target?.matches("p, small, .help, .instructions, .note") && !target.querySelector("input, select, textarea")) return clean(target.textContent, 500) || undefined;
}

export function scanPage(host: Element | null): ScanResult {
  const elements = new Map<string, HTMLElement[]>();
  const filled = new Map<string, boolean>();
  const fields: DetectedField[] = [];
  const sections: FormSection[] = [];
  const sectionIds = new Map<HTMLElement, string>();
  const roots = scanRoots(host);
  const seenRadio = new Set<string>();
  const pageHeading = clean(document.querySelector("h1")?.textContent) || undefined;

  const general = { id: "s0", heading: pageHeading || clean(document.title) || "Form" };
  sections.push(general);

  for (const root of roots) {
    const headings = sectionsFor(root);
    const sectionOf = (el: HTMLElement) => {
      // An enclosing fieldset is a section when it holds more than one question; a fieldset
      // around a single radio group is that group's label, not a section.
      const fs = el.closest("fieldset");
      const legend = fs?.querySelector<HTMLElement>(":scope > legend");
      let heading: HTMLElement | undefined = legend && questionCount(fs!) > 1 ? legend : undefined;
      if (!heading) for (const h of headings) {
        if (h.tagName === "LEGEND" && !(h.parentElement?.contains(el) && questionCount(h.parentElement) > 1)) continue;
        if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) heading = h; else break;
      }
      if (!heading || heading.tagName === "H1") return general.id;
      let id = sectionIds.get(heading);
      if (!id) {
        id = `s${sectionIds.size + 1}`;
        sectionIds.set(heading, id);
        sections.push({ id, heading: clean(heading.textContent), instructions: instructionsAfter(heading) });
      }
      return id;
    };

    for (const el of controlsIn(root, host)) {
      const input = el as HTMLInputElement;
      const kind = kindOf(el);
      if (kind === "radio") {
        const key = input.name ? `${input.form?.id ?? ""}::${input.name}` : `solo::${idFor(el)}`;
        if (seenRadio.has(key)) continue;
        seenRadio.add(key);
        const radios = input.name
          ? Array.from((input.form ?? root).querySelectorAll<HTMLInputElement>(`input[type=radio][name="${cssEscape(input.name)}"]`)).filter(visible)
          : [input];
        const group = groupLabel(radios) ?? { label: humanize(input.name || "Choice"), source: "name" as const };
        const options = radios.map((r) => clean(Array.from(r.labels ?? []).map((l) => textOf(l, r)).join(" ") || r.value, 120));
        const chosen = radios.find((r) => r.checked);
        const id = idFor(radios[0]);
        elements.set(id, radios);
        filled.set(id, Boolean(chosen));
        const groupBox = radios[0].closest("fieldset, [role=radiogroup]") as HTMLElement | null;
        fields.push({
          id, label: group.label, labelSource: group.source, kind, name: input.name || undefined,
          required: radios.some((r) => r.required || r.getAttribute("aria-required") === "true") || groupBox?.getAttribute("aria-required") === "true" || /\*/.test(groupBox?.querySelector("legend")?.textContent ?? ""),
          options, value: chosen ? options[radios.indexOf(chosen)] : undefined, sensitive: false,
          hint: (groupBox && hintFor(groupBox)) || undefined, error: errorFor(radios[radios.length - 1]) ?? (groupBox ? errorFor(groupBox) : undefined),
          sectionId: sectionOf(radios[0]),
        });
        continue;
      }
      const { label, source, raw } = resolveLabel(el);
      const id = idFor(el);
      const name = el.getAttribute("name") || undefined;
      const sensitive = input.type === "password" || /^cc-/.test(el.getAttribute("autocomplete") ?? "") || SENSITIVE.test(`${label} ${name ?? ""} ${el.id}`);
      let value: string | undefined;
      let isFilled: boolean;
      let options: string[] | undefined;
      if (el instanceof HTMLSelectElement) {
        options = Array.from(el.options).filter((o) => o.value !== "" && !/^(-+|select|choose)/i.test(o.text.trim())).map((o) => clean(o.text, 120)).slice(0, 60);
        const opt = el.selectedOptions[0];
        isFilled = Boolean(opt && opt.value !== "" && !/^(-+|select|choose)/i.test(opt.text.trim()));
        value = isFilled ? clean(opt.text, 120) : undefined;
      } else if (kind === "checkbox") {
        isFilled = input.checked;
      } else {
        isFilled = input.value.trim().length > 0;
        value = isFilled ? input.value.trim().slice(0, 500) : undefined;
      }
      elements.set(id, [el]);
      filled.set(id, isFilled);
      fields.push({
        id, label, labelSource: source, kind, name, required: isRequired(el, raw),
        placeholder: clean(el.getAttribute("placeholder")) || undefined, options,
        value: sensitive ? undefined : value, checked: kind === "checkbox" ? input.checked : undefined,
        sensitive, hint: hintFor(el), error: errorFor(el), sectionId: sectionOf(el),
      });
    }
  }

  const used = new Set(fields.map((f) => f.sectionId));
  return {
    context: {
      url: location.origin + location.pathname,
      title: clean(document.title),
      pageHeading,
      sections: sections.filter((s) => used.has(s.id)),
      fields,
      scannedAt: new Date().toISOString(),
    },
    elements,
    filled,
  };
}

/** Field id for a control the user interacted with, if it is one we track. */
export function fieldIdOf(target: EventTarget | null, scan: ScanResult | null): string | undefined {
  if (!scan || !(target instanceof HTMLElement)) return;
  for (const [id, els] of scan.elements) if (els.includes(target)) return id;
}
