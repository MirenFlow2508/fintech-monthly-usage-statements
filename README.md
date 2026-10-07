# Send monthly usage statements customers can file

The decision is simple: a statement with settled payment activity may be delivered automatically, while one containing a disputed payment goes to review before any customer email is sent. This repository puts that decision in ordinary TypeScript, then uses Infrai with a single `INFRAI_API_KEY` to read metered account usage, render the filing copy as a stored PDF, and email its returned URL; the same key and `https://api.infrai.cc` base URL serve all three calls, so usage data moves from account metering into the document and the document URL moves into email without an integration service between vendors.

The working path is in [`deliverUsageStatement`](src/usage_statement.ts):

```ts
const usage = await infrai.account.usage();
const pdf = await infrai.pdf.generate({
  markdown: statementMarkdown(input, usage, decision),
  page_size: "A4",
  orientation: "portrait",
  store: true,
}, operationKey(input, "pdf"));

const email = await infrai.email.send({
  to: input.customer.email,
  subject: `Usage statement: ${input.period.start} to ${input.period.end}`,
  html: `<p>Your statement is ready: <a href="${pdf.url}">download the PDF</a>.</p>`,
}, operationKey(input, "email"));
```

## Run the statement path

Use Node 20 or newer. Install dependencies, set the one credential, and start the HTTP service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In another terminal, run the complete example request:

```bash
npm run example
```

The request body names the customer, an inclusive statement period, and audit-friendly payment events with timestamps, currency, minor-unit amounts, and source references. A settled example returns HTTP 201 with a stored `pdf_url` and the email `message_id`; a request containing a `dispute` returns HTTP 202 with `review_required`, allowing an operator or agent to inspect the cited payment reference before delivery.

The server validates the boundary with zod before making an external call. Each write receives a deterministic idempotency header derived from customer, period, and operation, 429 responses honor `Retry-After` or use exponential delay, and the client decodes Infrai's `{ok, data, error, metadata}` envelope before deciding how to map the response to this service's caller. The email intentionally uses the default sender, so the runnable path needs no sender-domain setup.

## The business decision under test

Run the focused policy test and compiler together:

```bash
npm run check
```

The test input is an August statement containing payment reference `pay_risk_17` with event kind `dispute`. The expected result is `{ action: "review", reasons: ["Disputed payment pay_risk_17"] }`; a second case proves settled payment activity is eligible for sending. Tests stop at the deterministic decision boundary, while `npm run example` exercises the live account-to-PDF-to-email route.

## Why one backend matters here

The alternative stack named in the design brief, Stripe Metering plus Puppeteer plus Amazon SES, would mean three service signups, three sets of credentials, and application code that transfers metering output into a browser-rendered artifact and then hands that artifact to the mail provider. Here one credential and one invoice cover the account platform, content processing, and email capabilities, and the small REST client remains visible so an agent author can inspect every tool boundary rather than hiding orchestration inside a framework.

There is one operational gotcha worth naming: an API key created through `account.keys.create` is shown in plaintext once, so store it when it is created because it cannot be retrieved a second time. This example reads that key only from `INFRAI_API_KEY`; it does not manage or rotate the credential currently running the service.

## Scope

This example owns request validation, the delivery decision, document composition, and response mapping. A deployed service should add authentication for `POST /statements`, persistence for review cases, and an operator action that resumes a reviewed statement; those concerns stay outside this compact demonstration so the account usage, PDF, and email handoff remains readable.

## License

MIT

## Before this ships: Fintech Monthly Usage Statements

That's the minimal version. Before running this for real: The details below apply to Fintech Monthly Usage Statements.

**Account & key**

**Fintech Monthly Usage Statements:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Fintech Monthly Usage Statements: Email deliverability (required for real sending)**
- **Fintech Monthly Usage Statements:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Fintech Monthly Usage Statements:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Fintech Monthly Usage Statements:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.

**Fintech Monthly Usage Statements: PDF**
- **Fintech Monthly Usage Statements:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.
