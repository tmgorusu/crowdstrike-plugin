# Strike — PAC Compliance Copilot

A Chrome extension (Manifest V3) that sits beside a PAC's existing compliance website and explains, field by field, what belongs in the form. It reads the form's structure, answers questions in plain English, and runs a pre-submit review. **It never fills in, changes or submits anything.** The user stays in control.

Guidance only, not legal advice.

## Quick start

```bash
npm install
npm start            # builds, then runs the assist server on http://localhost:3000
```

1. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and pick `dist/extension`.
2. Visit <http://localhost:3000/copilot-demo/>, a fictional statement-of-organization form.
3. Click the gold star at the bottom right.

The server works without an API key and answers from built-in guidance. For AI answers, copy `.env.example` to `.env` and set `OPENAI_API_KEY` and `COPILOT_MODEL` (any current model that supports `json_schema` structured outputs).

## What it does

| State | Behavior |
| --- | --- |
| Collapsed | Floating button. Its badge shows how many required fields are still missing, or ✓. |
| Open | Greeting, the page's form name, field and section counts, quick actions ("Explain this form", "What goes in this field?", "What am I missing?", "Review my entries"), and suggested questions built from the detected fields. |
| Field help | Focus any field and a small **What goes here?** chip appears beside it. Answers show what to enter, an example, why it's needed, where the value officially comes from, jurisdiction caveats, and what the assistant still needs to know. |
| Review | Required-field progress, missing required fields, errors the site is showing, inconsistencies (dates out of order, itemized amounts over the total, bad ZIP, email or phone), and a pre-submit checklist. Click an item to scroll to and highlight that field. |

## How it works

```
extension/src/content/scanner.ts   DOM form recognition (read-only)
extension/src/content/review.ts    deterministic pre-submit review (local, no network)
extension/src/content/useScan.ts   MutationObserver + input/focus tracking, debounced rescans
extension/src/content/ui/          React panel, rendered in a shadow root (styles can't leak either way)
extension/src/background.ts        service worker; the only code that calls the server
server/                            Node http server: /api/copilot/assist + the demo form
shared/contract.ts                 types and zod schemas shared by extension and server
demo/                              fictional multi-step PAC form with deliberately messy markup
```

**Form recognition.** Labels are resolved in this order: `aria-labelledby`, `<label for>` or a wrapping label, `aria-label`, `title`, placeholder, nearby text (preceding sibling text or the previous table cell), and finally a humanized `name`. Radios are grouped into one question by `name`, using the fieldset legend, `role=radiogroup`, or the text before the group. Required status comes from `required`, `aria-required`, or a `*` in the label. The scanner also captures hints (`aria-describedby`, adjacent `<small>`/`.help`), site errors (`aria-errormessage`, `role=alert`, `.error`), and sections (headings, plus fieldsets that hold more than one question). It skips hidden inputs, off-screen honeypots, search boxes, and anything inside nav, header, footer or aside when the page has no `<form>`.

**Privacy and safety.**
- Values from password, PIN, account, routing, card, SSN and tax-ID fields never leave the page. Review still knows whether they're filled.
- The server strips them again as defense in depth.
- Query strings and hashes are removed from the URL before it's sent.
- Requests omit cookies.
- The API key lives only on the server.
- The server accepts only local requests and extension/localhost origins (set `COPILOT_ALLOW_REMOTE=true` to override) and never logs request bodies.
- Page text is passed to the model as untrusted data, and the prompt forbids invented thresholds, deadlines or legal requirements.

**Where it runs.** The content script loads automatically on the demo form, `webforms.fec.gov`, and `ethics.state.tx.us`. On any other site, click the toolbar icon to open it for that tab (`activeTab`). To change which sites it loads on, edit `content_scripts.matches` in `extension/manifest.json`. To point the extension at a different server, run `chrome.storage.local.set({ apiBase: "http://localhost:4000" })` from the service worker console.

## Development

```bash
npm run watch        # rebuild on change (reload the extension in chrome://extensions)
npm test             # scanner, review, offline answers, prompt and sanitizer tests
npm run typecheck
```

`/dev/extension/` on the server serves the built bundle, so you can inject `content.js` into a page with a stubbed `chrome.runtime` and test without installing the extension.

## Assumptions and limits

- Styling is hand-written CSS inside the shadow root rather than Tailwind. Tailwind's global preflight doesn't scope cleanly into a shadow DOM, and the panel is small.
- Built-in guidance is general. Committee type, thresholds and deadlines depend on the filing authority (FEC, state or local), and the assistant says so instead of guessing.
- Review covers the fields that are currently rendered, so multi-step forms are reviewed one step at a time.
- Nothing is persisted: chat history lives in memory for the tab.
