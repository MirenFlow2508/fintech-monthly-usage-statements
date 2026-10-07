export {};

const response = await fetch("http://localhost:3000/statements", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    customer: {
      id: "cust_2048",
      name: "Northwind Treasury",
      email: "chenhua@changba.com",
    },
    period: { start: "2026-08-01", end: "2026-08-31" },
    payment_events: [
      {
        occurred_at: "2026-08-04T09:30:00Z",
        kind: "payment",
        amount_minor: 12500,
        currency: "USD",
        reference: "pay_aug_004",
      },
    ],
  }),
});

console.log(response.status, await response.json());
