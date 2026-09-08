# Data model

Schema: [`packages/db/prisma/schema.prisma`](../packages/db/prisma/schema.prisma).

## Naming

All SRS section 6 entities exist. Two differ:

| SRS | Model | Why |
| --- | --- | --- |
| Row | `SeatRow` | `ROW` is reserved in SQL |
| Attendee | `User` (role `ATTENDEE`) and `Attendee` | `Attendee` is the name/email on a specific ticket, which need not be the buyer |

Added beyond the SRS list: `Session`/`Account`/`Verification` (better-auth),
`PaidSalesActivation`, `Payout`, `CampaignTicketType`, `ProcessedWebhookEvent`,
`PlatformSetting`, `EventReport`.

## Money

Integer whole KZT everywhere. No `Float` or `Decimal` money column exists, and none may be
added. Use [`packages/shared/src/money.ts`](../packages/shared/src/money.ts); do not
recompute totals inline.

The processing fee is deducted from the organizer payout, not added to the attendee total:
`Order.totalKzt = subtotalKzt - discountKzt`, and `feeKzt` is recorded for payout math only.

## Four invariants enforced in SQL

Read-then-write in application code loses these races. Each is one statement.

### Inventory

```sql
UPDATE "TicketType"
SET reserved = reserved + $1
WHERE id = $2 AND (quantity - sold - reserved) >= $1;
```

Zero rows affected means sold out — fail the checkout. Use `$executeRaw` and check the
count. On payment success, in the ticket-issuing transaction: `sold += n, reserved -= n`.
On expiry or cancel: `reserved -= n`.

### Promo limits

```sql
UPDATE "PromotionalCampaign"
SET redeemed = redeemed + 1
WHERE id = $1 AND status = 'ACTIVE'
  AND (max_redemptions IS NULL OR redeemed < max_redemptions);
```

Per-user limit is backed by `@@unique([campaignId, userId])` on `PromoRedemption`.

### One active check-in per ticket

Prisma cannot express a partial unique index. Run `pnpm db:migrate --create-only`, then
append to the generated `migration.sql`:

```sql
CREATE UNIQUE INDEX "CheckInRecord_active_ticket_key"
  ON "CheckInRecord" ("ticketId")
  WHERE "reversedAt" IS NULL;
```

A double scan then fails with a unique violation, which the handler maps to
`ALREADY_CHECKED_IN`. A reversed check-in keeps its history row and permits a new one —
the SRS 4.8 undo behaviour.

### One order per seat (bonus scope)

```sql
CREATE UNIQUE INDEX "SeatHold_active_seat_key"
  ON "SeatHold" ("seatId")
  WHERE "status" = 'ACTIVE';
```

Plus `SELECT ... FOR UPDATE` on the seat rows inside the reservation transaction.

## Expiry

`Order.expiresAt` and `SeatHold.expiresAt`, released two ways:

1. **Lazy** — availability reads treat `expiresAt < now()` as released, so the UI is right
   even if the sweeper is down.
2. **Sweeper** — one 60s interval marks expired `PENDING` orders `EXPIRED`, releases their
   reserved inventory, and sets holds `RELEASED`.

No Redis, no queue, no cron container.

## Audit log

Append-only. No update or delete path in application code.

Write through one helper — `audit({ actor, event, action, entityType, entityId,
description, metadata })` — called inside the same transaction as the mutation. Add the
call when the mutation is written; retrofitting in week 9 leaves permanent gaps.

Actions the SRS 4.16 timeline needs: `event.published`, `event.cancelled`, `event.updated`,
`ticket_type.price_changed`, `ticket_type.capacity_changed`, `order.refunded`,
`campaign.created`, `campaign.disabled`, `support_case.status_changed`, `checkin.recorded`,
`checkin.reversed`, `paid_sales.activated`, `paid_sales.suspended`.

## Simulated money

`Payment`, `Refund`, and `Payout` carry `simulated Boolean @default(true)`. Any UI showing
these rows must show the simulated badge (SRS 4.6). No code path sets it to `false`.
