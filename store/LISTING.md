# Chrome Web Store submission: copy-paste answers

Upload `release/strike-pac-copilot-<version>.zip` (built with `npm run package`).

## Store listing tab

**Name** (from the manifest): Strike — PAC Compliance Copilot

**Summary** (from the manifest): Explains what belongs in each field of your PAC compliance forms. Never fills or submits anything for you.

**Category:** Productivity → Workflow & Planning

**Language:** English (United States)

**Description:**

> Strike sits beside your PAC's compliance forms and explains, field by field, what belongs there. It is a helper, never a blocker: it doesn't fill in, change, or submit anything.
>
> • Inline guidance: click into a field and a short card beside the form tells you what to enter, where the official value comes from, and an example.
> • Pre-submit review: see which required fields are still empty, errors the site is showing, and likely slips such as a bad ZIP code, dates out of order, or itemized amounts that exceed a total. Click any item to jump to the field.
> • Ask questions: open the panel to ask what a field or term means in plain English.
>
> Privacy: values from bank, SSN, tax ID, password, and PIN fields never leave the page. Guidance requests don't include what you type. Nothing is stored beyond a few minutes in memory.
>
> Setup: inline guidance and questions are answered by the Strike assist service, which runs on your own computer (see the project README). Without it, field detection and the pre-submit review still work, and guidance quietly shows as unavailable.
>
> Loads automatically on webforms.fec.gov and ethics.state.tx.us. On any other site, click the toolbar icon to open it for that tab.
>
> General guidance only, not legal advice. Confirm requirements with your filing authority.

**Graphic assets:**
- Store icon: `store/assets/icon-128.png`
- Screenshots (1280×800), in this order: `store/assets/screenshot-1-inline-guidance.png`, `screenshot-2-review.png`, `screenshot-3-ask.png`
- Promo tiles are optional and only affect placement in search, so skip them while unlisted.

## Privacy practices tab

**Single purpose:**

> Explains what belongs in each field of PAC campaign-finance compliance forms and flags missing or inconsistent entries before the user submits. It never fills in or submits anything.

**Permission justifications:**

| Permission | Justification |
| --- | --- |
| storage | Saves one optional setting: the address of the Strike assist service on the user's computer. |
| activeTab | When the user clicks the toolbar icon, opens the assistant on that tab only, for sites not listed in the manifest. |
| scripting | Used with activeTab to inject the assistant into the current tab after the user clicks the toolbar icon. |
| Host permissions (localhost, 127.0.0.1) | The extension talks only to the Strike assist service that runs on the user's own computer. |
| Content script sites (webforms.fec.gov, ethics.state.tx.us, local demo) | Loads the assistant automatically on these campaign-finance filing sites, which are the forms it is designed to explain. |

**Remote code:** No, I am not using remote code. All JavaScript is bundled in the package; the extension only exchanges JSON with the local service.

**Data usage**, tick these:
- Personally identifiable information: names, addresses, and emails entered in form fields can be included in questions sent to the local service.
- Financial and payment information: contribution and expenditure amounts entered in form fields can be included in questions. Bank account, routing, and card numbers are never read.
- Website content: form labels, help text, and headings are read to explain the form.

Leave the others unticked. Passwords and PINs are never read. Focus and typing events are only used to tell which field is in use; they are never logged or sent as activity.

**Certify all three:** data is not sold or transferred to third parties outside the approved use cases, not used for purposes unrelated to the single purpose, and not used for creditworthiness or lending.

**Privacy policy URL:** <https://github.com/tmgorusu/crowdstrike-plugin/blob/main/store/PRIVACY.md>

## Distribution tab

- **Visibility:** Unlisted
- **Regions:** United States (all regions is fine too)
- **Pricing:** Free

## Test instructions tab (for reviewers)

> Strike's guidance and questions are answered by a companion service that runs on the user's computer, so without it they show "Service offline" or "Guidance isn't available right now". That is the designed fallback.
>
> Without the service you can still test field detection and the pre-submit review: open any page with a form, click the Strike toolbar icon, click the gold star, then open the Review tab. To test everything: clone https://github.com/tmgorusu/crowdstrike-plugin, run `npm install && npm start`, and open http://localhost:3000/copilot-demo/ (a fictional form).
