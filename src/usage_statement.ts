import { createHash } from "node:crypto";
import type { InfraiClient } from "./infrai.ts";
import {
  decideDelivery,
  statementMarkdown,
  type StatementRequest,
} from "./statement_policy.ts";

function operationKey(input: StatementRequest, operation: "pdf" | "email"): string {
  return createHash("sha256")
    .update(JSON.stringify({ customer_id: input.customer.id, period: input.period, operation }))
    .digest("hex");
}

export type StatementResult =
  | { status: "review_required"; reasons: string[] }
  | { status: "sent"; pdf_url: string; message_id: string };

export async function deliverUsageStatement(
  infrai: InfraiClient,
  input: StatementRequest,
): Promise<StatementResult> {
  const decision = decideDelivery(input);
  if (decision.action === "review") {
    return { status: "review_required", reasons: decision.reasons };
  }

  const usage = await infrai.account.usage();
  const pdf = await infrai.pdf.generate({
    markdown: statementMarkdown(input, usage, decision),
    page_size: "A4",
    orientation: "portrait",
    store: true,
    idempotency_key: operationKey(input, "pdf"),
  });

  const email = await infrai.email.send({
    to: input.customer.email,
    subject: `Usage statement: ${input.period.start} to ${input.period.end}`,
    html: `<p>Hello ${input.customer.name},</p><p>Your monthly usage statement is ready: <a href="${pdf.url}">download the PDF</a>.</p>`,
    idempotency_key: operationKey(input, "email"),
  });

  return { status: "sent", pdf_url: pdf.url, message_id: email.message_id };
}
