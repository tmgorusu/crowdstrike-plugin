import type { DetectedField } from "../../../shared/contract";
import type { ScanResult } from "./scanner";

// Deterministic pre-submit review. Runs locally against the live scan; it never edits the page.

export type ReviewItem = { fieldId: string; label: string; section: string; message: string };
export type Review = {
  requiredTotal: number;
  requiredDone: number;
  missing: ReviewItem[];
  siteErrors: ReviewItem[];
  warnings: ReviewItem[];
  ready: boolean;
};

const has = (f: DetectedField, re: RegExp) => re.test(`${f.label} ${f.name ?? ""}`);
const money = (v?: string) => {
  if (!v) return undefined;
  const n = Number(v.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};
const asDate = (v?: string) => {
  if (!v) return undefined;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00` : v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

export function reviewForm(scan: ScanResult): Review {
  const { fields, sections } = scan.context;
  const sectionName = (id: string) => sections.find((s) => s.id === id)?.heading ?? "Form";
  const item = (f: DetectedField, message: string): ReviewItem => ({ fieldId: f.id, label: f.label, section: sectionName(f.sectionId), message });
  const required = fields.filter((f) => f.required);
  const missing = required.filter((f) => !scan.filled.get(f.id)).map((f) =>
    item(f, f.kind === "checkbox" ? "Must be checked before you submit." : f.kind === "radio" || f.kind === "select" ? "Choose an option." : "Required and still empty."));
  // A site error on a field already listed as missing would just repeat it.
  const missingIds = new Set(missing.map((m) => m.fieldId));
  const siteErrors = fields.filter((f) => f.error && !missingIds.has(f.id)).map((f) => item(f, f.error!));
  const warnings: ReviewItem[] = [];
  const today = new Date();

  for (const f of fields) {
    const v = f.value;
    if (!v || f.sensitive) continue;
    if ((f.kind === "email" || has(f, /e-?mail/i)) && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) warnings.push(item(f, "This doesn't look like a complete email address."));
    if (has(f, /\bzip\b|postal/i) && !/^\d{5}(-\d{4})?$/.test(v)) warnings.push(item(f, "US ZIP codes are 5 digits (or ZIP+4)."));
    if ((f.kind === "tel" || has(f, /phone|telephone/i)) && v.replace(/\D/g, "").length < 10) warnings.push(item(f, "Phone number looks too short—include the area code."));
    if (has(f, /\bstate\b/i) && f.kind !== "select" && !/^[A-Za-z]{2}$/.test(v)) warnings.push(item(f, "Use the two-letter state abbreviation (e.g., TX)."));
    if (has(f, /amount|total|cash|balance|\$/i) && f.kind !== "select" && f.kind !== "checkbox") {
      const n = money(v);
      if (Number.isNaN(n)) warnings.push(item(f, "Enter a dollar amount using numbers only."));
      else if (n !== undefined && n < 0) warnings.push(item(f, "Amounts are usually entered as positive numbers—check the form's instructions."));
    }
    const d = f.kind === "date" ? asDate(v) : undefined;
    if (d && d > today && !has(f, /end|through|due|expir/i)) warnings.push(item(f, "This date is in the future."));
  }

  // Coverage / period consistency: start must not be after end.
  const start = fields.find((f) => f.kind === "date" && has(f, /start|begin|from/i) && f.value);
  const end = fields.find((f) => f.kind === "date" && has(f, /end|through|\bto\b/i) && f.value);
  if (start && end && asDate(start.value)! > asDate(end.value)!) warnings.push(item(end, `Ends before "${start.label}" begins.`));

  // Itemized contribution rows vs. a reported total, when both are on the page.
  const total = fields.find((f) => has(f, /total\b.*contributions?/i) && money(f.value) !== undefined);
  const rows = fields.filter((f) => f !== total && has(f, /^(contribution )?amount/i) && /contribut/i.test(sectionName(f.sectionId)) && !Number.isNaN(money(f.value)) && money(f.value) !== undefined);
  if (total && rows.length) {
    const sum = rows.reduce((a, f) => a + money(f.value)!, 0);
    const t = money(total.value)!;
    if (!Number.isNaN(t) && sum > t + 0.005) warnings.push(item(total, `Itemized amounts on this page add up to $${sum.toFixed(2)}, more than this total ($${t.toFixed(2)}).`));
  }

  // Same person listed twice in officer roles is usually a data-entry slip, sometimes intentional.
  const treasurer = fields.find((f) => has(f, /^treasurer.*name|treasurer$/i) && f.value);
  const assistant = fields.find((f) => has(f, /assistant treasurer/i) && f.value);
  if (treasurer && assistant && treasurer.value!.toLowerCase() === assistant.value!.toLowerCase())
    warnings.push(item(assistant, "Same name as the treasurer. Confirm your jurisdiction allows one person in both roles."));

  const requiredDone = required.length - missing.length;
  return { requiredTotal: required.length, requiredDone, missing, siteErrors, warnings, ready: missing.length === 0 && siteErrors.length === 0 };
}
