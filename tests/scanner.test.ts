// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { scanPage } from "../extension/src/content/scanner";
import { reviewForm } from "../extension/src/content/review";

// jsdom has no layout; give every element a box so visibility checks pass, except off-screen ones.
beforeEach(() => {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const off = (this as HTMLElement).style?.left === "-9999px";
    return { x: off ? -9999 : 10, y: 10, left: off ? -9999 : 10, top: 10, right: off ? -9800 : 210, bottom: 40, width: 200, height: 30, toJSON() {} } as DOMRect;
  };
});

const page = (html: string) => { document.body.innerHTML = html; return scanPage(null); };
const labels = (r: ReturnType<typeof scanPage>) => r.context.fields.map((f) => f.label);

describe("scanner", () => {
  it("resolves labels from every fallback source", () => {
    const r = page(`<form>
      <h2>Committee</h2>
      <label for="a">Committee Name <span class="req">*</span></label><input id="a" required>
      <span id="t">Treasurer</span><input aria-labelledby="t">
      <input aria-label="Fax number">
      <input placeholder="Website">
      <input title="Expected members" type="number">
      <table><tr><td>City</td><td><input name="addr_city"></td></tr></table>
      <label>Email <input type="email" name="e"></label>
      <input name="assistant_treasurer_name">
    </form>`);
    expect(labels(r)).toEqual(["Committee Name", "Treasurer", "Fax number", "Website", "Expected members", "City", "Email", "Assistant treasurer name"]);
    expect(r.context.fields.map((f) => f.labelSource)).toEqual(["label", "aria-labelledby", "aria-label", "placeholder", "title", "nearby-text", "label", "name"]);
    expect(r.context.fields[0].required).toBe(true);
    expect(r.context.sections.map((s) => s.heading)).toEqual(["Committee"]);
  });

  it("groups radios, reads selects, and skips hidden/honeypot/search inputs", () => {
    const r = page(`<form>
      <fieldset><legend>Connected organization? *</legend>
        <label><input type="radio" name="c" value="y" required> Yes</label><label><input type="radio" name="c" value="n"> No</label></fieldset>
      <div>Federal activity?</div><div><label><input type="radio" name="f"> Yes</label><label><input type="radio" name="f"> No</label></div>
      <label for="s">Type</label><select id="s"><option value="">-- Select --</option><option>GPAC</option><option>SPAC</option></select>
      <input type="hidden" name="csrf"><input name="hp" style="position:absolute;left:-9999px">
      <input type="search" name="q"><button>Go</button>
    </form>`);
    expect(labels(r)).toEqual(["Connected organization?", "Federal activity?", "Type"]);
    expect(r.context.fields[0].options).toEqual(["Yes", "No"]);
    expect(r.context.fields[0].required).toBe(true);
    expect(r.context.fields[2].options).toEqual(["GPAC", "SPAC"]);
    expect(r.filled.get(r.context.fields[2].id)).toBe(false);
  });

  it("never exposes sensitive values but still knows they are filled", () => {
    const r = page(`<form><label for="p">Portal PIN</label><input id="p" type="password" value="1234">
      <label for="b">Bank account number</label><input id="b" value="000123456789"></form>`);
    expect(r.context.fields.every((f) => f.sensitive && f.value === undefined)).toBe(true);
    expect(JSON.stringify(r.context)).not.toMatch(/1234|000123456789/);
    expect([...r.filled.values()]).toEqual([true, true]);
  });

  it("captures hints and site validation errors", () => {
    const r = page(`<form><div><label for="z">ZIP Code</label><input id="z" value="7870" aria-describedby="zh">
      <small id="zh">5-digit ZIP</small><span class="error" role="alert">ZIP code must be 5 digits</span></div></form>`);
    expect(r.context.fields[0].hint).toBe("5-digit ZIP");
    expect(r.context.fields[0].error).toBe("ZIP code must be 5 digits");
  });

  it("ignores navigation chrome when the page has no <form>", () => {
    const r = page(`<nav><input aria-label="Site search box"></nav><main><h2>Report</h2><label for="x">Payee</label><input id="x"></main>`);
    expect(labels(r)).toEqual(["Payee"]);
  });
});

describe("review", () => {
  it("lists missing required fields, site errors and inconsistencies", () => {
    const r = page(`<form>
      <h2>Report</h2>
      <label for="n">Committee Name *</label><input id="n">
      <label for="cs">Coverage Start</label><input type="date" id="cs" value="2026-07-01">
      <label for="ce">Coverage End</label><input type="date" id="ce" value="2026-06-01">
      <label for="t">Total Political Contributions</label><input id="t" value="100">
      <h3>Itemized Contributions</h3><input aria-label="Contribution amount" value="250">
      <div><label for="e">Email</label><input id="e" value="treasurer@"><span class="error">Enter a valid email</span></div>
      <label><input type="checkbox" required> I certify this is true</label>
    </form>`);
    const rev = reviewForm(r);
    expect(rev.missing.map((m) => m.label)).toEqual(["Committee Name", "I certify this is true"]);
    expect(rev.siteErrors.map((m) => m.message)).toEqual(["Enter a valid email"]);
    expect(rev.warnings.map((w) => w.label)).toEqual(expect.arrayContaining(["Email", "Coverage End", "Total Political Contributions"]));
    expect(rev.ready).toBe(false);
  });
});
