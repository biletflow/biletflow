# Orders, payments, activation, and check-in

Implements the backend assigned in issues #76, #78, #81, #85, and #87.
Request bodies use the Zod schemas in `packages/shared`. Every mutation writes
`audit()` in the same database transaction. Money fields are integer KZT.

Inventory, campaign redemption, and check-in uniqueness are single conditional
SQL statements, not read-then-write:

- reserve: `reserved = reserved + n` only when `sold + reserved + n <= quantity`
- sell a free order immediately: the same condition on `sold`
- settle a paid order: `reserved = reserved - n, sold = sold + n` only when `reserved >= n`
- campaign cap: `redeemed = redeemed + 1` only when the campaign is active and under its max
- check-in: one live row per ticket via `CheckInRecord (ticketId, activeKey)`

Free orders are marked `PAID` and tickets are issued in the checkout transaction.
Paid orders stay `AWAITING_PAYMENT` and hold stock. `POST /api/payments/webhook`
is the only place those paid tickets are created. Decline and abandon release the
hold and create no ticket. The webhook checks `x-biletflow-signature` (HMAC-SHA256
of the raw body, hex) and dedupes on `ProcessedWebhookEvent`.

`GET /sandbox/pay/:intentId` is labelled simulated and offers Approve, Decline,
and Abandon. The page speaks in the attendee locale and says whether tickets were
issued, the hold expired, or nothing was charged. Cancelled and refunded tickets
do not expose an admission QR. No real money moves. When `PAYMENT_WEBHOOK_SECRET`
is empty, local and CI runs use `dev-payment-webhook-secret`.

Paid checkout stays locked until the organizer pays the simulated activation fee
and a platform admin approves it. Seeded events that already have
`paidSalesActive` can still be used for demos.

Check-in takes the raw scan. A campaign QR returns `NOT_A_TICKET` and is never
admitted. The HMAC is verified before any ticket lookup.

## Team demo

With a migrated database and the web server running:

```bash
pnpm --filter @biletflow/db exec tsx ../../scripts/team-demo.ts
```

The same path is covered without a server by
`apps/web/src/lib/commerce.integration.test.ts` when `RUN_AUTH_INTEGRATION=1`.

## Regression invariants (#97)

`apps/web/src/lib/commerce.invariants.test.ts` checks the rules that a repeated
request must not duplicate:

- an unsigned, forged, or malformed webhook does not issue a ticket or move inventory
- decline and abandon release the hold once, leave the order cancelled, and create no ticket
- replaying that webhook, or sending it again under a new event key, still creates no ticket
- the same checkout idempotency key returns the same order and reserves one seat
- repeating pay, or the activation-fee payment, returns the open intent
- one approved webhook issues one ticket; a second delivery does not
- accepting terms twice, or paying the fee twice, keeps a single activation row
- a declined fee does not unlock paid checkout, and rejecting an activation locks it again
- two check-ins of the same ticket leave one active check-in record

No backend bug turned up in those cases. Run the file with `RUN_AUTH_INTEGRATION=1`
against a migrated database. Physical scanner checks for issue #99 stay with the
scanner app.
