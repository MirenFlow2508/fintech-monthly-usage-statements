import { z } from "zod";

export const paymentEventSchema = z.object({
  occurred_at: z.string().datetime({ offset: true }),
  kind: z.enum(["payment", "refund", "dispute"]),
  amount_minor: z.number().int().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  reference: z.string().min(1).max(120),
});

export const statementRequestSchema = z.object({
  customer: z.object({
    id: z.string().min(1).max(80),
    name: z.string().min(1).max(160),
    email: z.string().email(),
  }),
  period: z.object({
    start: z.string().date(),
    end: z.string().date(),
  }),
  payment_events: z.array(paymentEventSchema).max(500),
}).superRefine((value, context) => {
  if (value.period.start > value.period.end) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["period", "end"],
      message: "period.end must be on or after period.start",
    });
  }
});

export type StatementRequest = z.infer<typeof statementRequestSchema>;

export type DeliveryDecision =
  | { action: "send"; reasons: [] }
  | { action: "review"; reasons: string[] };

export function decideDelivery(input: StatementRequest): DeliveryDecision {
  const disputed = input.payment_events.filter((event) => event.kind === "dispute");
  if (disputed.length === 0) return { action: "send", reasons: [] };

  return {
    action: "review",
    reasons: disputed.map((event) => `Disputed payment ${event.reference}`),
  };
}

export function statementMarkdown(
  input: StatementRequest,
  accountUsage: unknown,
  decision: DeliveryDecision,
): string {
  const eventRows = input.payment_events.length === 0
    ? "No payment events recorded."
    : input.payment_events.map((event) =>
        `| ${event.occurred_at} | ${event.kind} | ${event.amount_minor} ${event.currency} minor units | ${event.reference} |`
      ).join("\n");

  return [
    `# Monthly usage statement`,
    `Customer: ${input.customer.name} (${input.customer.id})`,
    `Period: ${input.period.start} to ${input.period.end}`,
    `Delivery status: ${decision.action}`,
    "",
    "## Payment events",
    "| Occurred at | Type | Amount | Reference |",
    "| --- | --- | ---: | --- |",
    eventRows,
    "",
    "## Metered account usage",
    "```json",
    JSON.stringify(accountUsage, null, 2),
    "```",
  ].join("\n");
}
