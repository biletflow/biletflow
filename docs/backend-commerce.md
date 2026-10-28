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
and Abandon. No real money moves. When `PAYMENT_WEBHOOK_SECRET` is empty, local
and CI runs use `dev-payment-webhook-secret`.

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
