# Strike — PAC Compliance Copilot: Privacy Policy

Effective November 3, 2026

Strike is a Chrome extension that explains what belongs in the fields of political action committee (PAC) compliance forms and flags missing or inconsistent entries. It never fills in, changes, or submits anything.

## What the extension reads

On pages where it runs, the extension reads the structure of the form on the page: field labels, field types, required markers, help text, section headings, the options in dropdowns and choice lists, and error messages the site displays. It also reads the values you have entered so it can tell you which required fields are still empty and check for problems such as a malformed ZIP code.

It never reads or sends the values of sensitive fields, including passwords, PINs, bank account and routing numbers, card numbers, Social Security numbers, and tax ID numbers. It only notes whether those fields are filled in.

## Where data goes

The extension sends data only to the Strike assist service, which runs on your own computer (by default at `http://localhost:3000`). It does not send data to the extension's developer or to any other server.

- **Inline guidance** sends the label, type, help text, options, and on-screen error message of the field you are working in, plus the page title and address. It does not send what you typed.
- **Questions you ask in the assistant panel** send your question, recent messages in that conversation, and the page's form structure, including the values of non-sensitive fields.
- Page addresses are sent without query strings or fragments, and requests never include your cookies.
- **The pre-submit review** runs entirely inside the extension and sends nothing.

If you configure the local assist service with your own OpenAI API key, that service forwards questions and the page context described above to OpenAI to generate answers. It asks OpenAI not to store them (`store: false`). Without a key, the service answers from built-in guidance and contacts no one.

## What is stored

- Conversation history is kept in memory for the open tab only and is gone when you close or reload the page.
- Inline guidance answers are cached in memory for up to 5 minutes.
- The only thing saved to disk is an optional setting with the address of the local assist service.
- The local assist service does not log the contents of requests.

## What we don't do

We do not sell or transfer user data to third parties, use it for advertising, use it to determine creditworthiness or for lending, or use it for any purpose unrelated to explaining the form in front of you. The extension contains no analytics or tracking.

## Not legal advice

Strike provides general guidance only. Confirm requirements with your filing authority.

## Contact

Questions or requests: open an issue at <https://github.com/tmgorusu/crowdstrike-plugin/issues>.
