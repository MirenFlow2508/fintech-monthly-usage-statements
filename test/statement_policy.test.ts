import assert from "node:assert/strict";
import test from "node:test";
import { decideDelivery, statementRequestSchema } from "../src/statement_policy.ts";

test("a disputed payment routes the statement to review before delivery", () => {
  const input = statementRequestSchema.parse({
    customer: { id: "cust_9", name: "Example Finance", email: "ops@example.com" },
    period: { start: "2026-08-01", end: "2026-08-31" },
    payment_events: [
      {
        occurred_at: "2026-08-21T12:00:00Z",
        kind: "dispute",
        amount_minor: 4800,
        currency: "USD",
        reference: "pay_risk_17",
      },
    ],
  });

  assert.deepEqual(decideDelivery(input), {
    action: "review",
    reasons: ["Disputed payment pay_risk_17"],
  });
});

test("settled payment activity is ready to send", () => {
  const input = statementRequestSchema.parse({
    customer: { id: "cust_10", name: "Example Finance", email: "ops@example.com" },
    period: { start: "2026-08-01", end: "2026-08-31" },
    payment_events: [
      {
        occurred_at: "2026-08-10T12:00:00Z",
        kind: "payment",
        amount_minor: 4800,
        currency: "USD",
        reference: "pay_clear_18",
      },
    ],
  });

  assert.deepEqual(decideDelivery(input), { action: "send", reasons: [] });
});
