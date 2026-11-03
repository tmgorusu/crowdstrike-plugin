# Copilot demo form (FICTIONAL)

`/copilot-demo/` is a fake state-ethics "Statement of Organization — General-Purpose Committee"
filing portal for testing the form-recognition Chrome extension. Nothing is sent anywhere: Submit
calls `preventDefault()` and shows `alert("Demo: nothing was submitted")`.

Open at `http://localhost:3000/copilot-demo/` after `npm start`.
Main content is capped at ~860px plus a 220px sidebar, so the bottom-right ~400x560 corner is free
for the assistant widget on desktop widths of about 1400px and up.

## Steps

| Step | Rendering |
|------|-----------|
| 1 Committee, 2 Officers, 3 Banking | In the DOM from page load; toggled with the `hidden` attribute |
| 4 First Report | `<section id="step4">` is empty until first visited; JS injects all fields then (MutationObserver test) |

## Tricky cases to verify

### Label association
| Quirk | Field (`name`) | Expected label |
|---|---|---|
| `<label for>` | `committee_name`, `committee_acronym`, `committee_email` (email), `committee_phone` (tel), `date_created` (date), `bank_*`, `treasurer_name` | Label text |
| `aria-label` only (a nearby visual span is NOT associated) | `committee_fax` | "Committee fax number" |
| `aria-labelledby` -> `<span>` | `committee_ein` | "Federal Employer Identification Number (EIN)" |
| Placeholder only | `committee_website` (type=url) | "Committee website (https://...)" |
| Legacy table: label is only the preceding `<td>` text | `addr_street`, `addr_suite` (no id either), `addr_city`, `addr_state` (select), `addr_zip` | "Street Address", "Suite / Unit", "City", "State", "ZIP Code" |
| Input wrapped in `<label>` (no `for`/`id`) | `treasurer_email` | "Treasurer Email" |
| `title` only (number input, plus unassociated "(approx. members)" text after it) | `expected_members` | Title text |
| `aria-labelledby` -> table `<th>` (repeating rows) | `officers[N][name/title/email]` | "Name" / "Title" / "Email" |
| Mixed in repeating rows: `aria-label` and placeholder-only | `contributors[N][name]` (aria-label), `[employer]`/`[occupation]` (placeholder), `[amount]`, `[date]` (aria-label) | as noted |

### Selects, radios, checkboxes, textarea
| Quirk | Field |
|---|---|
| Select with 5 committee types | `committee_type` |
| State select inside legacy table | `addr_state` |
| Filing Period select (Step 4, dynamic) | `filing_period` |
| Radio group in `<fieldset><legend>` | `has_connected_org` ("Does the committee have a connected organization?") |
| Radio group WITHOUT fieldset; question is a plain `<div>`, options use `<label for>` | `federal_activity` ("Will the committee make contributions to federal candidates?") |
| Optional checkbox wrapped in label | `accepts_corporate` |
| Required certification checkbox (Step 4, dynamic) | `certify` |
| Textarea with `aria-describedby` | `committee_purpose` |

### Required indicators
| Style | Fields |
|---|---|
| `required` attribute (+ red asterisk) | `committee_name`, `committee_type`, `date_created`, `addr_street`, `addr_zip`, `committee_email`, `committee_purpose`, `has_connected_org`, `treasurer_name`, `treasurer_email`, `bank_name`, `bank_routing`, `bank_account`, `filing_period`, `coverage_start/end`, `certify`, `portal_pin` |
| `aria-required="true"` only | `addr_city`, `addr_state`, `bank_holder`, `total_contributions` |
| Visual red asterisk only (no attribute) | `treasurer_appointed` (Date of Appointment) |

### Help text
| Style | Fields |
|---|---|
| `aria-describedby` | `committee_name`, `committee_email`, `committee_purpose`, `bank_holder` ("Enter the name exactly as it appears on your bank account."), `cash_on_hand_start` |
| Plain nearby `<small>` (not associated) | `committee_acronym`, `committee_ein`, `accepts_corporate`, `bank_routing`, `bank_account`, `connected_org_relationship`, `total_contributions` |
| Section-level `.instructions` paragraphs | Top of each step |

### Dynamic DOM
| Trigger | What appears |
|---|---|
| "Yes" on `has_connected_org` | `connected_org_name` (text) and `connected_org_relationship` (select) inserted into `#connectedOrgSlot`; "No" removes them |
| "+ Add another officer" | New officer row `officers[N][...]` with a Remove button |
| First visit to Step 4 (Next or step tab) | Entire Step 4 injected into `#step4` |
| "+ Add contributor" (Step 4) | New contributor row `contributors[N][...]` |
| Blur / "Validate step" | `<span class="error" role="alert">` nodes added/removed (scanner should not treat these as fields, but may read them as site errors) |

### Validation messages (site-style)
- On blur: ZIP (`addr_zip`) -> "ZIP code must be 5 digits"; emails (`committee_email`, `treasurer_email`, officer emails) -> "Enter a valid email address ..."; routing (`bank_routing`) -> "Routing number must be exactly 9 digits"; amounts (`cash_on_hand_start`, `total_contributions`, `contributors[N][amount]`) -> "Amount must be a dollar value, e.g. 250.00".
- "Validate step": "<Label> is required" for each empty required field (all three required styles, including asterisk-only), plus a summary box at the top of the step.

### Sensitive fields (must be flagged / never auto-filled or sent)
| Field | Why |
|---|---|
| `bank_account` | Account number; plain `type="text"` so only name/label reveal sensitivity |
| `bank_routing` | Routing number |
| `committee_ein` | Tax ID |
| `portal_pin` | `type="password"` in the "Re-authenticate to sign" box (Step 4) |

### Must be ignored
| Element | Why |
|---|---|
| `csrf_token` | `type="hidden"` |
| `website_url` | Honeypot: positioned off-screen, `tabindex="-1"`, inside `aria-hidden="true"` wrapper, label "Leave this field blank" |
| Sidebar search `q` | Separate `<form id="siteSearch">` in `<aside>`; unrelated to the filing |
| Sidebar news/links, header links, footer | Unrelated page content |
| Fields in hidden steps | Present in DOM but `hidden`; scanner should decide consistently whether to include them |
