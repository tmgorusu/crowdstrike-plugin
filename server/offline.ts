import type { AssistRequest, AssistResponse, DetectedField } from "../shared/contract";
import { isSensitiveField } from "./sanitize";

type Entry = { id: string; match: RegExp; title: string; whatGoesHere: string; whyItMatters: string; officialSource: string; example?: string; jurisdictionNote?: string; needsInfo?: string[] };

const CHECK = "Requirements differ between federal (FEC), state, and local filings — check the official instructions for your jurisdiction.";

// Order matters: more specific patterns first.
export const FIELD_KB: Entry[] = [
  { id: "account-number", match: /account\s*(number|no\b|#)|acct|routing|iban/i, title: "bank account number",
    whatGoesHere: "The committee's depository account number, exactly as printed by the bank. Type it yourself — this assistant never reads or repeats it.",
    whyItMatters: "Some filings or bank-verification steps require it; a typo can misroute funds or stall registration.",
    officialSource: "The committee's bank statement or account-opening documents.",
    jurisdictionNote: "Many public disclosure forms do not ask for account numbers at all. If a public report asks, confirm with the filing authority's instructions before entering it." },
  { id: "bank", match: /bank|depositor|financial\s*institution|campaign\s*depository/i, title: "bank / depository",
    whatGoesHere: "The legal name (and, if asked, address) of the financial institution where the committee keeps its funds.",
    whyItMatters: "Regulators use it to tie reported cash balances to a real account; most jurisdictions expect committee funds to be kept in a designated account.",
    officialSource: "The committee's bank statement or account agreement.", example: "Example Community Bank, 100 Main St, Austin, TX 78701 (fictional)", jurisdictionNote: CHECK },
  { id: "assistant-treasurer", match: /assistant\s*treasurer|deputy\s*treasurer/i, title: "assistant treasurer",
    whatGoesHere: "The full legal name and contact details of the designated assistant/deputy treasurer, if the committee has one.",
    whyItMatters: "This person can typically act when the treasurer is unavailable; listing them keeps authority to sign clear.",
    officialSource: "The committee's current registration / statement of organization.", example: "Jordan Sample (fictional)", jurisdictionNote: "Whether an assistant treasurer is allowed or required varies — " + CHECK },
  { id: "treasurer-contact", match: /treasurer.*(address|street|city|zip|phone|telephone|email|e-mail)|(address|phone|email).*treasurer/i, title: "treasurer contact information",
    whatGoesHere: "The treasurer's contact details as listed on the committee's registration — not the committee's general office unless they are the same.",
    whyItMatters: "The filing authority sends notices, deficiency letters, and deadline reminders here.",
    officialSource: "The treasurer appointment on the committee's registration; update the registration first if it has changed.", example: "PO Box 1234, Austin, TX 78701 / (512) 555-0100 / treasurer@example.org (fictional)", jurisdictionNote: CHECK },
  { id: "treasurer", match: /treasurer/i, title: "treasurer name",
    whatGoesHere: "The full legal name of the committee's treasurer of record — the person currently appointed on the committee's registration.",
    whyItMatters: "The treasurer is generally the person legally responsible for the committee's records and reports, so the name must match the registration on file.",
    officialSource: "The committee's most recent registration / statement of organization (or treasurer appointment form).", example: "Alex Q. Example (fictional)",
    jurisdictionNote: "Federal committees designate a treasurer with the FEC; state and local committees designate one with the state or local filing authority. Use the one for the report you are filing." },
  { id: "custodian", match: /custodian/i, title: "custodian of records",
    whatGoesHere: "The name and contact details of the person who keeps the committee's books and records.",
    whyItMatters: "Auditors and regulators contact this person to inspect records.",
    officialSource: "The committee's registration and internal recordkeeping designation.", example: "Sam Placeholder (fictional)", jurisdictionNote: "Mostly a federal (FEC Form 1) concept; some states ask too. " + CHECK },
  { id: "committee-id", match: /(committee|filer|fec|candidate)\s*(id|identification|number|no\b|#)|filer\s*id|\bid\s*number/i, title: "committee / filer ID",
    whatGoesHere: "The identification number the filing authority assigned when the committee registered.",
    whyItMatters: "It links this filing to the right committee; a wrong ID can attach the report to someone else's record.",
    officialSource: "The acknowledgment letter or account page from the filing authority (for federal committees, the FEC ID begins with \"C\").", example: "C00000000 or 00012345 (fictional)",
    jurisdictionNote: "Federal (FEC) IDs and state filer IDs are different numbers; use the one issued by the authority you are filing with." },
  { id: "committee-type", match: /committee\s*(type|class)|classification|type\s*of\s*committee|filer\s*type|pac\s*type/i, title: "committee type / classification",
    whatGoesHere: "The category the committee registered under, chosen from the options on the form.",
    whyItMatters: "Classification can change which contribution limits, disclosure schedules, and reporting deadlines apply.",
    officialSource: "The committee's registration / statement of organization.",
    jurisdictionNote: "Federal categories (e.g., separate segregated fund vs. nonconnected PAC) differ from state categories (e.g., a Texas general-purpose committee). " + CHECK,
    needsInfo: ["Which authority you file with (FEC, state, or local)", "Whether the committee has a connected/sponsoring organization", "How the committee was classified when it registered"] },
  { id: "connected-org", match: /connected|sponsor|parent\s*org/i, title: "connected / sponsoring organization",
    whatGoesHere: "The name of the corporation, union, membership organization, or trade association that established, administers, or financially supports the committee — or \"None\" if it is nonconnected.",
    whyItMatters: "Having a connected organization often changes who the committee may solicit and how it is classified.",
    officialSource: "The committee's registration and organizing documents.", example: "Example Widgets, Inc. (fictional)", jurisdictionNote: CHECK },
  { id: "affiliated", match: /affiliat/i, title: "affiliated committees",
    whatGoesHere: "Other committees established, financed, maintained, or controlled by the same organization or people.",
    whyItMatters: "Affiliated committees may share contribution limits, so they are disclosed together.",
    officialSource: "The committee's registration and the registrations of related committees.", jurisdictionNote: CHECK },
  { id: "committee-name", match: /(committee|pac|political\s*committee|organization)\s*name|name\s*of\s*(the\s*)?(committee|pac)/i, title: "committee name",
    whatGoesHere: "The committee's full official name, spelled exactly as registered (including any required sponsor name or acronym).",
    whyItMatters: "Reports are matched to the registration by name and ID; mismatches cause rejections or confusion in public records.",
    officialSource: "The committee's registration / statement of organization.", example: "Citizens for Example County PAC (fictional)", jurisdictionNote: CHECK },
  { id: "in-kind", match: /in[-\s]?kind|non[-\s]?monetary/i, title: "in-kind contribution",
    whatGoesHere: "A description and fair-market value of goods or services given to the committee instead of money.",
    whyItMatters: "In-kind contributions usually count toward the same limits and disclosure as cash, and are often reported both as received and as spent.",
    officialSource: "A written statement from the donor describing what was provided and its value, or the vendor invoice the donor paid.", example: "Catering for fundraiser, valued at $350.00 (fictional)", jurisdictionNote: CHECK },
  { id: "aggregate", match: /aggregate|year[-\s]?to[-\s]?date|ytd|cycle[-\s]?to[-\s]?date|cumulative/i, title: "aggregate / year-to-date",
    whatGoesHere: "The running total this contributor (or payee) has given (or received) over the period your jurisdiction specifies, including this transaction.",
    whyItMatters: "Aggregates determine when itemization or employer/occupation disclosure kicks in, and whether limits are reached.",
    officialSource: "The committee's contribution ledger or accounting software, summing all transactions from this source in the period.", example: "$150 earlier + $100 today = $250 aggregate (fictional)",
    jurisdictionNote: "The aggregation period (calendar year, election cycle, reporting period) differs by jurisdiction. " + CHECK },
  { id: "contribution-amount", match: /(contribution|receipt|donation)?\s*amount|amount\s*(received|given)/i, title: "contribution amount",
    whatGoesHere: "The dollar amount of this single transaction, in dollars and cents.",
    whyItMatters: "Totals must reconcile with the bank deposits and the report summary.",
    officialSource: "The check, deposit record, or payment processor report for this transaction.", example: "250.00 (fictional)" },
  { id: "contribution-date", match: /(contribution|receipt|donation|expenditure|payment)\s*date|date\s*(received|of\s*(receipt|contribution|expenditure|payment)|paid|made)/i, title: "transaction date",
    whatGoesHere: "The date the committee received the contribution (or made the payment), as defined by your jurisdiction's rules.",
    whyItMatters: "The date determines which reporting period the transaction belongs to.",
    officialSource: "The check date, deposit slip, processor report, or invoice payment record.", example: "03/15/2026 (fictional)",
    jurisdictionNote: "Whether \"received\" means the date in hand, deposited, or the check date varies — " + CHECK },
  { id: "employer", match: /employer/i, title: "employer",
    whatGoesHere: "The name of the contributor's employer (or \"Self-employed\" / \"Not employed\" as appropriate).",
    whyItMatters: "Many jurisdictions require employer and occupation for itemized individual contributions above a threshold.",
    officialSource: "The contributor's own statement on the contribution card or online form.", example: "Example Hospital (fictional)", jurisdictionNote: CHECK },
  { id: "occupation", match: /occupation|job\s*title|profession/i, title: "occupation",
    whatGoesHere: "The contributor's principal occupation or job title.",
    whyItMatters: "Often required alongside employer for itemized individual contributions; vague entries may draw a deficiency notice.",
    officialSource: "The contributor's own statement on the contribution card or online form.", example: "Registered Nurse (fictional)", jurisdictionNote: CHECK },
  { id: "contributor", match: /contributor|donor|(name\s*of\s*)?(person|individual)\s*(contributing|giving)|from\s*whom/i, title: "contributor name",
    whatGoesHere: "The full name of the individual or organization that made the contribution, as it appears on the payment.",
    whyItMatters: "Itemized contributions are public record; the name ties the transaction to aggregates and limits.",
    officialSource: "The check, payment processor record, or contribution card.", example: "Pat Example (fictional)", jurisdictionNote: CHECK },
  { id: "payee", match: /payee|vendor|paid\s*to|recipient/i, title: "expenditure payee",
    whatGoesHere: "The name of the person or business the committee paid.",
    whyItMatters: "Expenditure itemization shows the public where committee money went.",
    officialSource: "The invoice, receipt, or cancelled check.", example: "Example Print Shop LLC (fictional)", jurisdictionNote: CHECK },
  { id: "purpose", match: /purpose|description\s*of\s*(expenditure|payment)|what\s*(was|it)\s*for/i, title: "expenditure purpose",
    whatGoesHere: "A short, specific description of what the payment was for.",
    whyItMatters: "Vague purposes (e.g., \"miscellaneous\") are a common reason for deficiency notices.",
    officialSource: "The invoice or receipt describing the goods or services.", example: "Yard signs for voter outreach (fictional)", jurisdictionNote: CHECK },
  { id: "category", match: /category|expenditure\s*type|type\s*of\s*expenditure/i, title: "expenditure category",
    whatGoesHere: "The category from the form's list that best matches the purpose of the payment.",
    whyItMatters: "Categories let regulators and the public summarize spending.",
    officialSource: "The form instructions' category definitions plus the invoice.", jurisdictionNote: CHECK },
  { id: "report-type", match: /report\s*type|type\s*of\s*report|filing\s*period|reporting\s*period|coverage|period\s*(begin|end|start|from|through)|from\s*date|through\s*date/i, title: "report type / coverage period",
    whatGoesHere: "The kind of report you are filing and the first and last dates of activity it covers.",
    whyItMatters: "The coverage dates must pick up exactly where the previous report ended so no transactions are skipped or double-counted.",
    officialSource: "The filing authority's reporting calendar and the end date of the committee's last filed report.",
    jurisdictionNote: "Report names and schedules differ by jurisdiction and election year. Check the official calendar; this assistant won't guess deadlines.",
    needsInfo: ["Which authority you file with", "The end date of your last report", "Whether this is a regular, pre-election, or special report"] },
  { id: "signature", match: /signature|\bsign(ed|ature)?\b|certif|attest|affirm|verification|date\s*signed/i, title: "signature / certification",
    whatGoesHere: "The name (or electronic signature) of the person certifying the report — usually the treasurer — and the date they sign.",
    whyItMatters: "Signing generally certifies under penalty that the report is true and complete, so the signer should review it first.",
    officialSource: "The treasurer of record (or other authorized signer) personally.",
    jurisdictionNote: "Who may sign and how (typed name, PIN, wet signature) varies — " + CHECK },
  { id: "street-address", match: /street|mailing|address(\s*line)?|\bpo\s*box/i, title: "address",
    whatGoesHere: "The complete street or mailing address requested, including suite or PO box.",
    whyItMatters: "Official correspondence goes here; some forms require a physical street address rather than a PO box.",
    officialSource: "The committee's registration, or for contributors/payees, their own records or invoice.", example: "123 Example Ave, Suite 4 (fictional)", jurisdictionNote: CHECK },
  { id: "city-state-zip", match: /\bcity\b|\bstate\b|\bzip|postal/i, title: "city / state / ZIP",
    whatGoesHere: "The city, two-letter state abbreviation, and 5- or 9-digit ZIP code for the address above.",
    whyItMatters: "Location data is used for public disclosure and, for contributors, sometimes for in-state/out-of-state rules.",
    officialSource: "The same source as the address above.", example: "Austin, TX 78701 (fictional)" },
  { id: "email", match: /e-?mail/i, title: "email",
    whatGoesHere: "An email address that is monitored for official notices.",
    whyItMatters: "Filing authorities increasingly send deadline reminders and deficiency notices electronically.",
    officialSource: "The committee's registration contact info.", example: "treasurer@example.org (fictional)" },
  { id: "phone", match: /phone|telephone|\btel\b|mobile/i, title: "phone",
    whatGoesHere: "A daytime phone number for the committee or person named.",
    whyItMatters: "Staff use it to resolve questions about a filing quickly.",
    officialSource: "The committee's registration contact info.", example: "(512) 555-0100 (fictional)" },
];

const GLOSSARY: { match: RegExp; term: string; text: string; jurisdictionNote?: string }[] = [
  { match: /in[-\s]?kind/i, term: "in-kind contribution", text: "An in-kind contribution is a gift of goods or services (or paying a bill for the committee) instead of money — like donated catering or office space. It is usually valued at fair-market value and reported much like a cash contribution." },
  { match: /earmark/i, term: "earmarked contribution", text: "An earmarked contribution is money a donor gives to one committee with instructions that it be passed on to a specific candidate or committee. The intermediary usually has to disclose both the original donor and the recipient." },
  { match: /aggregat/i, term: "aggregate", text: "\"Aggregate\" means the running total from one source over a defined period, including the current transaction. It decides when a contributor must be itemized and whether limits are reached.", jurisdictionNote: "The period (calendar year, cycle, report period) depends on your jurisdiction." },
  { match: /independent\s*expenditure/i, term: "independent expenditure", text: "An independent expenditure is spending that expressly advocates for or against a clearly identified candidate and is made without coordinating with that candidate or their campaign. These often carry extra, faster reporting rules." },
  { match: /connected\s*org/i, term: "connected organization", text: "A connected organization is the corporation, union, membership group, or trade association that sets up, runs, or pays the overhead of a PAC. Committees with one are often called separate segregated funds (SSFs)." },
  { match: /\bssf\b|separate\s*segregated/i, term: "separate segregated fund (SSF)", text: "An SSF is a federal term for a PAC established by a corporation, union, or similar organization (its connected organization). The organization may pay its overhead, but solicitations are typically limited to a restricted class such as employees or members.", jurisdictionNote: "SSF is a federal (FEC) classification; states use their own terms." },
  { match: /non[-\s]?connected/i, term: "nonconnected committee", text: "A nonconnected committee is a PAC that is not sponsored by a corporation, union, or similar organization. It pays its own expenses and can generally solicit the general public." },
  { match: /\bgpac\b|general[-\s]?purpose\s*(political\s*)?committee/i, term: "GPAC (general-purpose committee)", text: "In Texas, a general-purpose committee (GPAC) is a political committee that supports or opposes candidates or measures generally rather than one specific candidate or measure. It registers and files with the Texas Ethics Commission (or local filing authority) on its own schedule.", jurisdictionNote: "GPAC is a Texas state term; federal committees use FEC categories instead." },
  { match: /treasurer\s*of\s*record/i, term: "treasurer of record", text: "The treasurer of record is the person currently appointed as treasurer on the committee's registration with the filing authority. Until a change is filed, that person is treated as responsible for the committee's reports." },
  { match: /coverage\s*(period|date)|reporting\s*period/i, term: "coverage period", text: "The coverage period is the span of dates a report includes. It normally starts the day after your last report ended and ends on the closing date set by the reporting calendar.", jurisdictionNote: "Check your filing authority's calendar for the exact dates." },
  { match: /itemiz/i, term: "itemization", text: "Itemizing means listing a transaction individually (with name, address, date, amount) rather than only including it in a lump-sum total. Whether you must itemize usually depends on an aggregate threshold set by your jurisdiction." },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const labelOf = (f: DetectedField) => `${f.label} ${f.name ?? ""}`;
export const entryFor = (f: DetectedField) => FIELD_KB.find((e) => e.match.test(labelOf(f)));
const isEmpty = (f: DetectedField) => f.kind === "checkbox" ? !f.checked : !isSensitiveField(f) && !(f.value ?? "").trim();
const listOf = (xs: string[], n = 8) => xs.slice(0, n).join("; ") + (xs.length > n ? `; and ${xs.length - n} more` : "");

function fieldAnswer(f: DetectedField): AssistResponse {
  const e = entryFor(f);
  const sensitive = isSensitiveField(f);
  const extra = [f.hint ? `The page's hint says: "${f.hint.slice(0, 200)}".` : "", f.error ? `The site is currently showing an error: "${f.error.slice(0, 160)}".` : ""].filter(Boolean).join(" ");
  if (!e) return {
    answer: `I don't have built-in guidance for "${f.label}". ${f.required ? "The form marks it required. " : ""}Check the form's instructions for this field${f.options?.length ? `; it offers these choices: ${listOf(f.options, 6)}` : ""}.${extra ? " " + extra : ""}`,
    fieldId: f.id, confidence: "low", source: "offline", jurisdictionNote: CHECK,
    followUps: ["Explain this form", "What am I missing?"],
  };
  const options = f.options?.length ? ` Choose one of the listed options (${listOf(f.options, 6)}).` : "";
  return {
    // whatGoesHere carries the detail, so the headline stays short instead of repeating it.
    answer: `This field asks for the ${e.title}${f.required ? ", and the form marks it required" : ""}.${extra ? " " + extra : ""}`,
    fieldId: f.id, whatGoesHere: e.whatGoesHere + options, whyItMatters: e.whyItMatters, officialSource: e.officialSource,
    example: sensitive ? undefined : e.example, jurisdictionNote: e.jurisdictionNote, needsInfo: e.needsInfo,
    confidence: e.needsInfo || f.options?.length ? "medium" : "high", source: "offline",
    followUps: ["What am I missing?", "Explain this form"],
  };
}

function explainForm(req: AssistRequest): AssistResponse {
  const c = req.context, fields = c.fields;
  const required = fields.filter((f) => f.required).length;
  const text = norm(`${c.title} ${c.pageHeading ?? ""} ${c.sections.map((s) => s.heading).join(" ")} ${fields.map((f) => f.label).join(" ")}`);
  const guess = /contribution|donor|contributor/.test(text) && /expenditure|payee/.test(text) ? "a campaign finance report covering contributions and expenditures"
    : /statement of organization|registration|appointment|treasurer/.test(text) && /committee/.test(text) ? "a committee registration or statement of organization"
    : /contribution|donor|contributor/.test(text) ? "a contribution entry form"
    : /expenditure|payee|vendor/.test(text) ? "an expenditure entry form"
    : /report|period|coverage/.test(text) ? "a campaign finance report form" : "a form";
  const sections = c.sections.map((s) => s.heading).filter(Boolean);
  return {
    answer: `This page ("${c.pageHeading || c.title}") appears to be ${guess}. It has ${fields.length} field${fields.length === 1 ? "" : "s"} (${required} marked required)${sections.length ? ` across ${sections.length} section${sections.length === 1 ? "" : "s"}: ${listOf(sections, 6)}` : ""}.`,
    confidence: guess === "a form" ? "low" : "medium", source: "offline", jurisdictionNote: CHECK,
    followUps: ["What am I missing?", ...fields.filter((f) => f.required).slice(0, 2).map((f) => `What goes in "${f.label}"?`)],
  };
}

function review(req: AssistRequest): AssistResponse {
  const fields = req.context.fields;
  const empties = fields.filter((f) => f.required && isEmpty(f));
  const errors = fields.filter((f) => f.error);
  if (!empties.length && !errors.length) return {
    answer: "I don't see any required fields left empty or any error messages on this page. Review each value against your source records before submitting — I can't verify accuracy.",
    confidence: "medium", source: "offline", followUps: ["Explain this form"],
  };
  const parts = [
    empties.length ? `${empties.length} required field${empties.length === 1 ? " is" : "s are"} empty: ${listOf(empties.map((f) => f.label))}.` : "",
    errors.length ? `${errors.length} field${errors.length === 1 ? " shows" : "s show"} a site error: ${listOf(errors.map((f) => `${f.label} ("${(f.error ?? "").slice(0, 80)}")`), 5)}.` : "",
  ].filter(Boolean);
  const first = empties[0] ?? errors[0];
  return {
    answer: parts.join(" "), fieldId: first?.id, confidence: "high", source: "offline",
    needsInfo: [...empties, ...errors.filter((f) => !empties.includes(f))].slice(0, 10).map((f) => f.label),
    followUps: [...new Set([...empties, ...errors])].slice(0, 3).map((f) => `What goes in "${f.label}"?`),
  };
}

function bestFieldInQuestion(req: AssistRequest) {
  const q = norm(req.question);
  let best: { f: DetectedField; score: number } | undefined;
  for (const f of req.context.fields) {
    const l = norm(f.label);
    if (!l) continue;
    let score = q.includes(l) ? 100 + l.length : 0;
    if (!score) { const words = l.split(" ").filter((w) => w.length > 2); const hits = words.filter((w) => q.includes(w)).length; if (words.length && hits) score = (hits / words.length) * 50 + hits; }
    if (score > (best?.score ?? 15)) best = { f, score };
  }
  return best?.f;
}

export function offlineAnswer(req: AssistRequest): AssistResponse {
  const q = req.question.toLowerCase();
  const focus = req.context.fields.find((f) => f.id === req.focusFieldId);
  if (/\b(missing|review|check (my|the) (form|page)|incomplete|left to (fill|do)|what('?s| is) (left|wrong)|errors?)\b/.test(q)) return review(req);
  if (/explain (this|the) (form|page)|what is this (form|page)|what('?s| is) this (form|page)|summar|overview/.test(q)) return explainForm(req);
  const asksField = /what (goes|do i (put|enter|write)|should i (put|enter))|this field|fill (in|out)|enter here|mean\b/.test(q);
  const named = bestFieldInQuestion(req);
  const glossary = GLOSSARY.find((g) => g.match.test(q));
  const definitional = /what (is|are|does)|\bmean|defin|explain|plain english/.test(q) && !/this field|goes (here|in)/.test(q);
  const term = glossary && { answer: glossary.text, confidence: "high" as const, source: "offline" as const, jurisdictionNote: glossary.jurisdictionNote ?? CHECK, followUps: ["Explain this form", "What am I missing?"] };
  if (term && definitional) return term;
  if (focus && /this field|\bhere\b|\bit\b/.test(q)) return fieldAnswer(focus);
  if (named) return fieldAnswer(named);
  if (focus) return fieldAnswer(focus);
  if (term) return term;
  if (asksField) return {
    answer: "Which field do you mean? Click into the field on the page (or include its label in your question) and I'll explain what goes there.",
    confidence: "low", source: "offline", needsInfo: ["The field you're asking about"],
    followUps: req.context.fields.filter((f) => f.required).slice(0, 3).map((f) => `What goes in "${f.label}"?`),
  };
  return {
    answer: "I'm running on built-in guidance and don't have a specific answer for that. I can explain the form, list what's missing, explain a field, or define terms like in-kind, aggregate, or independent expenditure.",
    confidence: "low", source: "offline", jurisdictionNote: CHECK,
    followUps: ["Explain this form", "What am I missing?", "What does in-kind mean?"],
  };
}
